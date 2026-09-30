// Day Trade Arena: the market simulator. Runs only on the host.
//
// Fair value: each instrument's price comes from shared drivers (stock market, tech, small caps, rates,
// oil, gold) times its exposures, plus its own path (js/paths.js): the day's plan, time-of-day volatility,
// economic data and headlines, and reactions at key levels (js/levels.js). Before the match starts the
// simulator plays the prior session, the overnight or premarket and any of today's session already gone,
// as 1-minute history, so everyone starts with a chart, a prior day and an overnight range to read.
//
// Microstructure: a synthetic order book sits around fair value. Its size at each price is persistent
// but breathing noise, with walls at round numbers and at levels being defended. Players' limit orders sit
// in that book with a queue position, and players' market orders eat through it: levels they take refill
// over time, the quote shifts for a while, and fair value moves a little for good (market impact).
// Background traders print at the best bid/ask, and those prints fill resting orders and build the candles.
// Stocks under $3 halt limit up or down 20% (10% above $3) under LULD and reopen through an auction.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const { RNG, clamp, hash2, hashStr, BAR_SEC, SYMBOLS, NEWS, parseClock, DRIVERS, CROSS, FUTURES, WEEKDAYS } = DTA;
  const LV = DTA.levels;
  const P = DTA.paths;

  const HIST_DT = 20;             // history is simulated in 20-second steps and kept as 1-minute bars
  const DAY_SEC = 86400;
  const DRIVER_ORDER = ['MKT', 'TECH', 'SMALL', 'RATES', 'OIL', 'GOLD'];

  // A price driver. MKT, OIL and GOLD have a price (the S&P, crude and gold futures) and react to their
  // own key levels; the others are relative moves (tech vs the market, small caps vs the market, rates).
  class Driver {
    constructor(m, key, rng) {
      const spec = DRIVERS[key];
      this.m = m; this.key = key; this.name = key; this.spec = spec; this.rng = rng;
      this.path = new P.Path({ name: key, sd: spec.sd, prof: spec.prof, rng: rng.fork('path'), volScale: m.volScale });
      this.meta = null; this.reactor = null;
      if (spec.px) {
        const f = FUTURES[spec.px];
        const p0 = f.p * Math.exp(rng.normal() * 0.03);
        this.meta = { tick: f.tick, kind: 'future', cls: f.cls, rth: f.rth, round: f.round, conf: f.conf, orMin: f.orMin };
        this.c = Math.log(Math.round(p0 / f.tick) * f.tick);
        this.bb = new P.BarBuilder(f.tick, 1000, spec.sd, spec.prof, rng.fork('bars'), false);
        this.prevDev = new LV.Developing(this.meta, -DAY_SEC);
        this.dev = new LV.Developing(this.meta, 0);
        this.prior = null; this.liveDev = null;
        this.zcache = { t: -1e9, z: [] };
        this.reactor = new P.Reactor({
          rng: rng.fork('react'), strength: 1, sd: spec.sd * m.volScale, prof: spec.prof, tick: f.tick,
          price: () => this.c + this.path.lf, target: this.path, zones: (t) => this.zones(t)
        });
      } else this.c = 0;
    }
    get px() { return Math.exp(this.c + this.path.lf); }
    lastIdx() { return Math.round(this.px / this.meta.tick); }
    // Virtual 1-minute bars for the level trackers.
    sample(t) {
      if (!this.meta) return;
      const before = this.bb.bars.length;
      this.bb.sample(t - 1e-6, this.c + this.path.lf, 1);
      if (this.bb.bars.length > before) this.feed(this.bb.bars[this.bb.bars.length - 1]);
    }
    feed(b) {
      const row = [b[0], b[1], b[2], b[3], b[4], b[5]];
      this.prevDev.add(row, 60);
      this.dev.add(row, 60);
    }
    zones(t) {
      if (t - this.zcache.t < 3) return this.zcache.z;
      const meta = this.meta;
      const last = this.lastIdx();
      const u = this.reactor.u(t);
      const away = Math.max(4, Math.round((u * 1.2 * this.px) / meta.tick));
      const w = LV.windows(meta);
      let list;
      if (t < w.prior[1]) list = this.prevDev.list(t, last, away);
      else {
        if (!this.prior) this.prior = LV.priorLevels(meta, this.bb.bars);
        list = this.prior.concat((this.liveDev || this.dev).list(t, last, away));
      }
      const span = Math.max(20, Math.round((this.px * this.spec.sd * 1.5) / meta.tick));
      for (const l of LV.roundLevels(meta, last - span, last + span)) list.push(l);
      const z = LV.zones(meta, list).map((q) => ({ L: Math.log(q.idx * meta.tick), s: q.s, key: q.key, label: q.label }));
      this.zcache = { t, z };
      return z;
    }
  }

  // An instrument's fair value: its base price, times each driver it follows, plus its own path.
  class Composite {
    constructor(c, betas, y, target) { this.c = c; this.betas = betas; this.y = y; this.target = target; }
    total() {
      let v = this.c + this.y.lf;
      for (const [p, b] of this.betas) v += b * p.lf;
      return v;
    }
  }

  // ---------- one instrument ----------
  class SymbolSim {
    constructor(market, def, rng) {
      this.m = market; this.def = def; this.sym = def.sym; this.rng = rng;
      this.tick = def.tick || 0.01;
      this.fut = def.kind === 'future';
      this.meta = { tick: this.tick, kind: def.kind, cls: def.cls, rth: def.rth, round: def.round, conf: def.conf, orMin: def.orMin };
      this.prof = P.profileOf(def);
      this.salt = hashStr(def.sym + ':' + market.seed) % 100000;
      this.lead = def.lead ? market.drivers[def.lead] : null;
      this.y = new P.Path({ name: def.sym, sd: this.lead ? 0 : def.idio || 0, prof: this.prof, rng: rng.fork('path'), volScale: market.volScale, tails: def.cls === 'small' ? 2 : 1 });
      const betas = [];
      for (const k in def.drivers || {}) betas.push([market.drivers[k].path, def.drivers[k]]);
      const c = this.lead ? this.lead.c : Math.log(Math.max(this.tick * 20, def.p * Math.exp(rng.normal() * (def.runner ? 0.02 : 0.05))));
      this.comp = new Composite(c, betas, this.y, this.lead ? this.lead.path : this.y);
      this.reactor = null;
      if (def.reactor && !this.lead) {
        this.reactor = new P.Reactor({
          rng: rng.fork('react'), strength: def.reactor, sd: (def.vol || 0.01) * market.volScale, prof: this.prof, tick: this.tick,
          price: () => this.comp.total(), target: this.y, zones: (t) => this.zones(t)
        });
      }
      this.react = this.lead ? this.lead.reactor : this.reactor;
      this.hb = new P.BarBuilder(this.tick, this.volPerMin(), def.vol || 0.01, this.prof, rng.fork('bars'), false);
      this.hist = [];
      this.prevDev = new LV.Developing(this.meta, -DAY_SEC);
      this.dev = new LV.Developing(this.meta, 0);
      this.prior = null;
      this.zcache = { t: -1e9, z: [] };
      this.temp = 0;            // temporary impact, in ticks
      this.effects = [];
      this.askDep = new Map();  // price level → size taken and not yet refilled
      this.bidDep = new Map();
      this.resting = [];        // players' resting limit orders (engine order objects)
      this.bars = [];           // [o, h, l, c, v, buyVol] in ticks; index = 5-second bar number from match start
      this.devBars = 0;         // live bars already fed to the level tracker
      this.big = [];            // large prints for the chart's bubbles: [t, idx, qty, side]
      this.bigSent = 0;
      this.dirtyFrom = 0;
      this.lastIdx = null;
      this.prevCloseIdx = null;
      this.openIdx = null;
      this.hiIdx = null; this.loIdx = null;
      this.volume = 0; this.pv = 0; this.sessKind = null;
      this.prints = [];         // since the last host flush: [t, idx, qty, side, flags]
      this.halted = false; this.haltUntil = 0; this.haltReason = ''; this.haltStart = 0; this.pendingReopen = 0; this.gapNext = true;
      this.halts = [];          // [start, end, reason]
      this.refSamples = [];     // LULD reference samples [t, idx]
      this.lastRefT = -1e9;
      this.noLocate = false; this.ssr = false;
      this.cPrev = null;
      this.sBid = 0; this.sAsk = 0;
      this.subHi = null; this.subLo = null;
      this.depthMult = 1; this.spreadMult = 1; this.flowBias = 0; this.volMult = 1;
      this.wallInfo = null;
      this.lot = this.fut ? 1 : def.depth >= 2000 ? 100 : 1;
      this.roundMinor = def.round ? Math.max(1, Math.round(def.round[0] / this.tick)) : 100;
      this.roundMajor = def.round ? Math.max(1, Math.round(def.round[1] / this.tick)) : 500;
      const fs = market.flowScale;
      this.bigThreshold = this.fut
        ? Math.max(5, Math.round(Math.max(def.depth * 3, (def.printSize / fs) * 30) / 5) * 5)
        : Math.round(Math.max(def.depth * 6, (def.printSize / fs) * 18) / 100) * 100;
    }

    get lf() { return this.comp.total(); }
    get fair() { return Math.exp(this.comp.total()); }
    get price() { return this.lastIdx * this.tick; }
    // Expected volume per minute at average activity, matching the live print flow.
    volPerMin() { const d = this.def; return d.printRate * 60 * 1.43 * d.printSize * 1.1; }

    // Move fair value by d (log). perm: share that also moves the anchor, so it isn't pulled straight back.
    shiftFair(d, perm) { this.comp.target.shift(d, perm === undefined ? 1 : perm); }

    // A news jump: immediate when trading, otherwise added to the reopening auction.
    jump(j) {
      if (!j) return;
      if (this.halted) { this.pendingReopen += j; return; }
      this.shiftFair(j, 1);
      if (this.reactor) this.reactor.interrupt(this.m.t, 240);
    }

    zones(t) {
      if (t - this.zcache.t < 3) return this.zcache.z;
      const meta = this.meta;
      const px = this.fair;
      const last = this.lastIdx !== null && this.m.live ? this.lastIdx : Math.round(px / this.tick);
      const u = this.reactor ? this.reactor.u(t) : 0.002;
      const away = Math.max(3, Math.round((u * 1.2 * px) / this.tick));
      const w = LV.windows(meta);
      let list;
      if (t < w.prior[1]) list = this.prevDev.list(t, last, away);
      else {
        if (!this.prior) this.prior = LV.priorLevels(meta, this.hb.bars);
        list = this.prior.concat(this.dev.list(t, last, away));
      }
      const span = Math.max(20, Math.round((px * (this.def.vol || 0.01) * 1.5) / this.tick));
      for (const l of LV.roundLevels(meta, last - span, last + span)) list.push(l);
      const z = LV.zones(meta, list).map((q) => ({ L: Math.log(q.idx * this.tick), s: q.s, key: q.key, label: q.label }));
      this.zcache = { t, z };
      return z;
    }

    // History: sample fair value into 1-minute bars while this market is open.
    histSample(t, volMult) {
      if (!LV.isOpen(this.meta, t - 1)) { this.hb.close(); return; }
      const before = this.hb.bars.length;
      if (this.lead) {
        // Lead futures (ES, CL, GC) are their driver, so their history is the driver's bars.
        return;
      }
      this.hb.sample(t - 1e-6, this.comp.total(), volMult);
      if (this.hb.bars.length > before) this.feedHist(this.hb.bars[this.hb.bars.length - 1]);
    }
    feedHist(b) {
      const row = [b[0], b[1], b[2], b[3], b[4], b[5]];
      this.prevDev.add(row, 60);
      this.dev.add(row, 60);
    }

    // After history: set the day's reference prices and hand over to the live simulation.
    finishHistory(t0) {
      if (this.lead) {
        const lb = this.lead.bb;
        lb.close();
        const scale = this.tick / this.lead.meta.tick;
        this.hb.bars = lb.bars.filter((b) => LV.isOpen(this.meta, b[0])).map((b) => [b[0], Math.round(b[1] / scale), Math.round(b[2] / scale), Math.round(b[3] / scale), Math.round(b[4] / scale), Math.round(b[5] * this.volPerMin() / 1000), 0]);
        for (const b of this.hb.bars) b[6] = Math.round(b[5] * clamp(0.5 + (b[4] - b[1]) / Math.max(1, b[2] - b[3]) * 0.4, 0.05, 0.95));
        this.prevDev = new LV.Developing(this.meta, -DAY_SEC);
        this.dev = new LV.Developing(this.meta, 0);
        for (const b of this.hb.bars) this.feedHist(b);
      } else this.hb.close();
      this.hist = this.hb.bars.filter((b) => b[0] < t0);
      this.prior = LV.priorLevels(this.meta, this.hist);
      const w = LV.windows(this.meta);
      const pd = this.hist.filter((b) => b[0] >= w.prior[0] && b[0] < w.prior[1]);
      const fairIdx = Math.max(1, Math.round(this.fair / this.tick));
      this.prevCloseIdx = pd.length ? pd[pd.length - 1][4] : fairIdx;
      this.lastIdx = this.hist.length ? this.hist[this.hist.length - 1][4] : fairIdx;
      // Today's session so far: volume, VWAP, high/low and the open, from history.
      const kind = LV.sessionAt(this.meta, t0);
      const sessStart = kind === 'rth' ? w.rth[0] : w.on[0];
      this.sessKind = kind === 'rth' ? 'rth' : 'pre';
      for (const b of this.hist) {
        if (b[0] < sessStart) continue;
        if (this.hiIdx === null || b[2] > this.hiIdx) this.hiIdx = b[2];
        if (this.loIdx === null || b[3] < this.loIdx) this.loIdx = b[3];
        this.volume += b[5];
        this.pv += ((b[2] + b[3] + b[4]) / 3) * this.tick * b[5];
        if (kind === 'rth' && this.openIdx === null) this.openIdx = b[1];
      }
      if (!this.fut && this.def.cls === 'small' && this.lastIdx <= this.prevCloseIdx * 0.9 && kind === 'rth') this.ssr = true;
      this.quote();
      this.gapNext = false;
    }

    // Recompute the synthetic best bid/ask around fair value plus temporary impact.
    quote() {
      const c = this.fair / this.tick + this.temp;
      const d = this.def;
      const sv = d.spreadVol === undefined ? 0.3 : d.spreadVol;
      const stress = Math.max(0, Math.exp(this.y.lv) * this.volMult - 1) + Math.max(0, (this.react ? this.react.volBoost : 1) - 1);
      const sess = this.sessKind === 'pre' ? (this.fut ? 1.2 : 2.6) : 1;
      const spread = Math.max(1, Math.round(d.spread * this.spreadMult * sess * (1 + sv * stress) + (this.rng.float() < sv * 0.08 ? 1 : 0)));
      this.sBid = Math.floor(c - (spread - 1) / 2);
      this.sAsk = this.sBid + spread;
      if (this.sBid < 1) { this.sBid = 1; this.sAsk = 1 + spread; }
      return c;
    }

    // Synthetic size at a level. side +1 = ask book, −1 = bid book.
    levelSize(side, idx, t) {
      const dist = side > 0 ? idx - this.sAsk : this.sBid - idx;
      if (dist < 0) return 0;
      const bucketLen = this.m.noiseBucket;
      const bt = (t / bucketLen);
      const b0 = Math.floor(bt), fr = bt - b0;
      const key = idx * 2 + (side > 0 ? 1 : 0) + this.salt;
      const n = hash2(key, b0) * (1 - fr) + hash2(key, b0 + 1) * fr;
      let mult = 0.3 + 1.4 * n;
      const wall = hash2(key, 777 + this.salt);
      if (wall > 0.94) mult *= 2 + (wall - 0.94) * 60;       // persistent walls (2x to 5.6x)
      if (idx % this.roundMajor === 0) mult *= 2.6;         // round numbers attract size
      else if (idx % this.roundMinor === 0) mult *= 1.6;
      const w = this.wallInfo;
      if (w && w.idx === idx && w.side === side) mult *= w.mult;
      const profile = 0.55 + 0.5 * Math.min(1, dist / 5) + 0.025 * dist;
      let size = this.def.depth * this.depthMult * this.sessDepth * profile * mult;
      const dep = (side > 0 ? this.askDep : this.bidDep).get(idx);
      if (dep) size -= dep;
      if (size <= 0) return 0;
      return this.lot > 1 ? Math.floor(size / this.lot) * this.lot : Math.floor(size);
    }
    get sessDepth() { return this.sessKind === 'pre' ? (this.fut ? 0.45 : 0.3) : 1; }

    // First synthetic level with size on a side (skips levels that are fully taken).
    synthBest(side, t) {
      let idx = side > 0 ? this.sAsk : this.sBid;
      for (let i = 0; i < 80; i++) {
        if (idx < 1) return null;
        if (this.levelSize(side, idx, t) > 0) return idx;
        idx += side;
      }
      return null;
    }

    restingOn(side, idx, excludePid) {
      const out = [];
      for (const o of this.resting) if (o.side === side && o.limitIdx === idx && o.pid !== excludePid) out.push(o);
      if (out.length > 1) out.sort((a, b) => a.ts - b.ts);
      return out;
    }

    // Best price on the book an aggressor on `side` would trade against (asks for a buyer).
    bestAgainst(side, t, excludePid) {
      const book = side > 0 ? 1 : -1;
      let best = this.synthBest(book, t);
      for (const o of this.resting) {
        if (o.pid === excludePid) continue;
        if (book > 0 && o.side < 0 && (best === null || o.limitIdx < best)) best = o.limitIdx;
        if (book < 0 && o.side > 0 && (best === null || o.limitIdx > best)) best = o.limitIdx;
      }
      return best;
    }
    bestBid(t) { return this.bestAgainst(-1, t, null); }
    bestAsk(t) { return this.bestAgainst(1, t, null); }

    // Walk the book as an aggressor. side +1 buys from asks, −1 sells into bids. Returns {fills:[{idx,qty,cp}], remaining}.
    walk(side, qty, limitIdx, pid, noise, t) {
      const book = side;
      let remaining = qty;
      const fills = [];
      let idx = this.bestAgainst(side, t, pid);
      let guard = 0;
      while (remaining > 0 && idx !== null && guard++ < 160) {
        if (limitIdx !== null && limitIdx !== undefined && (side > 0 ? idx > limitIdx : idx < limitIdx)) break;
        const synth = this.levelSize(book, idx, t);
        const orders = this.restingOn(-side, idx, pid);
        let usedSynth = 0, levelQty = 0, playerHit = false;
        for (const o of orders) {
          if (remaining <= 0) break;
          const ahead = Math.max(0, Math.min(o.queueAhead, synth) - usedSynth);
          const takeS = Math.min(remaining, ahead);
          usedSynth += takeS; remaining -= takeS; levelQty += takeS;
          if (remaining <= 0) break;
          const f = Math.min(remaining, o.qty - o.filled);
          if (f > 0) {
            remaining -= f; levelQty += f; playerHit = true;
            this.m.restingFill(this, o, f, idx, t, pid);
            fills.push({ idx, qty: f, cp: o.pid });
          }
        }
        if (remaining > 0 && synth - usedSynth > 0) {
          const takeS = Math.min(remaining, synth - usedSynth);
          usedSynth += takeS; remaining -= takeS; levelQty += takeS;
        }
        if (usedSynth > 0) {
          fills.push({ idx, qty: usedSynth, cp: null });
          for (const o of this.restingOn(-side, idx, null)) o.queueAhead = Math.max(0, o.queueAhead - usedSynth);
          const depMap = book > 0 ? this.askDep : this.bidDep;
          const w = this.wallInfo;
          const iceberg = w && w.iceberg && w.idx === idx && w.side === book;
          depMap.set(idx, (depMap.get(idx) || 0) + usedSynth * (noise ? (iceberg ? 0.08 : 0.3) : iceberg ? 0.4 : 1));
        }
        if (levelQty > 0) this.print(t, idx, levelQty, side, (pid ? 1 : 0) | (playerHit ? 2 : 0));
        this.resting = this.resting.filter((o) => o.filled < o.qty && o.status === 'working');
        const nb = this.bestAgainst(side, t, pid);
        idx = nb === null ? null : side > 0 ? Math.max(nb, idx + 1) : Math.min(nb, idx - 1);
        if (idx !== null && idx < 1) idx = null;
      }
      const done = qty - remaining;
      if (done >= this.bigThreshold && fills.length) {
        let n = 0, sx = 0;
        for (const f of fills) { n += f.qty; sx += f.qty * f.idx; }
        this.noteBig(t, Math.round(sx / n), done, side);
      }
      if (pid && done > 0) this.impact(side, done);
      else if (noise && qty > this.def.depth * 3) this.impact(side, done * 0.5);
      return { fills, remaining };
    }

    // Aggressive flow moves the quote (temporary) and fair value (permanent). In a lead future the
    // permanent part moves its driver, so buying ES lifts NQ and the stocks that follow the market.
    impact(side, filled) {
      const levels = filled / (this.def.depth * this.depthMult * this.sessDepth);
      this.temp += side * Math.min(levels * 0.45, 25);
      const perm = (side * 0.3 * levels * this.tick) / Math.max(this.tick * 5, this.fair);
      this.shiftFair(perm, 1);
    }

    print(t, idx, qty, side, flags) {
      if (qty <= 0) return;
      this.prints.push([Math.round(t * 10) / 10, idx, qty, side, flags || 0]);
      if (this.prints.length > 600) this.prints.splice(0, this.prints.length - 600);
      this.lastIdx = idx;
      const inRth = LV.sessionAt(this.meta, t) === 'rth';
      if (inRth && this.sessKind !== 'rth') {
        // The opening bell: session stats restart for the regular session.
        this.sessKind = 'rth'; this.hiIdx = null; this.loIdx = null; this.volume = 0; this.pv = 0;
      }
      if (inRth && this.openIdx === null) this.openIdx = idx;
      if (this.hiIdx === null || idx > this.hiIdx) this.hiIdx = idx;
      if (this.loIdx === null || idx < this.loIdx) this.loIdx = idx;
      if (this.subHi === null || idx > this.subHi) this.subHi = idx;
      if (this.subLo === null || idx < this.subLo) this.subLo = idx;
      this.volume += qty;
      this.pv += idx * this.tick * qty;
      const b = this.barAt(t);
      if (this.gapNext) { b[0] = b[1] = b[2] = b[3] = idx; this.gapNext = false; }
      if (idx > b[1]) b[1] = idx;
      if (idx < b[2]) b[2] = idx;
      b[3] = idx;
      b[4] += qty;
      // Aggressor side for volume delta: buys lift the offer, sells hit the bid; auctions split evenly.
      b[5] += side > 0 ? qty : side < 0 ? 0 : qty / 2;
      if (flags & 4) this.noteBig(t, idx, qty, 0);
      if (!this.ssr && !this.fut && inRth && idx <= this.prevCloseIdx * 0.9) {
        this.ssr = true;
        this.m.pushNews(t, this.sym, '{sym} down 10% on the day: short sale restriction (SSR) now in effect', -1, false);
      }
    }

    noteBig(t, idx, qty, side) {
      this.big.push([Math.round(t * 10) / 10, idx, qty, side]);
      if (this.big.length > 3000) { this.big.splice(0, 1000); this.bigSent = Math.max(0, this.bigSent - 1000); }
    }

    barAt(t) {
      const bi = Math.max(0, Math.floor((t - this.m.start) / BAR_SEC));
      while (this.bars.length <= bi) {
        const c = this.lastIdx;
        this.bars.push([c, c, c, c, 0, 0]);
      }
      if (bi < this.dirtyFrom) this.dirtyFrom = bi;
      // Completed bars feed the level tracker (the host's copy of the developing levels).
      while (this.devBars < bi) {
        const b = this.bars[this.devBars];
        this.dev.add([this.m.start + this.devBars * BAR_SEC, b[0], b[1], b[2], b[3], b[4]], BAR_SEC);
        this.devBars++;
      }
      return this.bars[bi];
    }

    // Resting orders that the synthetic book has moved through trade against it as it refills.
    crossResting(t) {
      if (!this.resting.length) return;
      for (const o of this.resting.slice()) {
        if (o.status !== 'working' || o.filled >= o.qty) continue;
        const book = o.side > 0 ? 1 : -1;
        let idx = this.synthBest(book, t);
        let guard = 0;
        while (idx !== null && (o.side > 0 ? idx <= o.limitIdx : idx >= o.limitIdx) && o.filled < o.qty && guard++ < 40) {
          const avail = this.levelSize(book, idx, t);
          const f = Math.min(avail, o.qty - o.filled);
          if (f <= 0) break;
          const depMap = book > 0 ? this.askDep : this.bidDep;
          depMap.set(idx, (depMap.get(idx) || 0) + f);
          this.m.restingFill(this, o, f, idx, t, null);
          this.print(t, idx, f, o.side, 2);
          idx = this.synthBest(book, t);
        }
      }
      this.resting = this.resting.filter((o) => o.filled < o.qty && o.status === 'working');
    }

    applyEffects(t, dt) {
      let volMult = 1, depthMult = 1, flow = 0, spread = 1;
      if (this.effects.length) {
        this.effects = this.effects.filter((e) => e.until > t);
        for (const e of this.effects) {
          const left = clamp((e.until - t) / e.dur, 0, 1);
          if (e.kind === 'drift') this.shiftFair(e.rate * dt, 1);
          else if (e.kind === 'vol') volMult *= 1 + (e.mult - 1) * Math.min(1, left * 1.5);
          else if (e.kind === 'depth') { depthMult *= e.mult; spread *= e.mult < 0.5 ? 2 : 1; }
          else if (e.kind === 'flow') flow += e.bias * Math.min(1, left * 2);
        }
      }
      this.volMult = volMult; this.depthMult = depthMult; this.flowBias = flow; this.spreadMult = spread;
      this.y.extVol = volMult;
    }

    substep(t, dt) {
      const d = this.def, r = this.rng, m = this.m;
      this.subHi = null; this.subLo = null;
      this.applyEffects(t, dt);
      const kind = LV.sessionAt(this.meta, t);
      if (kind !== 'rth' && this.sessKind !== 'rth') this.sessKind = 'pre';
      if (this.halted) {
        if (t >= this.haltUntil) this.reopen(t);
        else { this.barAt(t); return; }
      }
      if (t >= m.end) { this.barAt(Math.min(t, m.end - 0.001)); return; }
      if (kind === 'closed') { this.barAt(t); return; }
      const react = this.react;
      this.wallInfo = react ? react.wall((L) => Math.round(Math.exp(L) / this.tick)) : null;

      // Refill taken liquidity and let temporary impact fade.
      const refill = Math.exp(-dt / 30);
      for (const map of [this.askDep, this.bidDep]) {
        for (const [k, v] of map) { const nv = v * refill; if (nv < 1) map.delete(k); else map.set(k, nv); }
      }
      this.temp *= Math.exp(-dt / 45);
      const c = this.quote();
      for (const k of this.askDep.keys()) if (k < this.sAsk) this.askDep.delete(k);
      for (const k of this.bidDep.keys()) if (k > this.sBid) this.bidDep.delete(k);
      for (const o of this.resting) {
        const sz = this.levelSize(o.side > 0 ? -1 : 1, o.limitIdx, t);
        if (o.queueAhead > sz) o.queueAhead = sz;
      }
      this.crossResting(t);

      // Background prints. Order flow leans with the recent move (so delta and CVD track price like a real
      // tape), with news, and with what is happening at a level: absorption into a level that holds, then
      // the other side taking over; or a burst through a level that breaks.
      const act = P.activity(this.prof, t);
      const volState = Math.exp(this.y.lv) * this.volMult * m.volScale;
      const sigma = (d.vol || 0.01) * Math.sqrt(dt / P.DAY) * Math.sqrt(Math.max(0.05, act)) * volState;
      const mom = this.cPrev === null ? 0 : clamp((c - this.cPrev) / Math.max(0.25, (sigma * this.fair) / this.tick), -2.5, 2.5);
      this.cPrev = c;
      this.momEma = (this.momEma || 0) * 0.85 + mom * 0.15;
      const boost = react ? react.volBoost : 1;
      const rflow = react ? react.flow : 0;
      const rate = d.printRate * act * (0.55 + 0.45 * volState) * m.flowScale * (1 + Math.abs(this.flowBias) * 2) * boost;
      const n = r.poisson(rate * dt);
      const sizeMult = 1 / m.flowScale;
      const pBuy = clamp(0.5 + 0.12 * mom + 0.3 * this.momEma + this.flowBias + rflow, 0.06, 0.94);
      for (let i = 0; i < n; i++) {
        const side = r.chance(pBuy) ? 1 : -1;
        let size = r.lognormal(d.printSize * sizeMult, 0.85);
        if (r.chance(this.fut ? 0.004 : 0.012)) size *= r.range(4, 12);
        size = this.lot > 1 && size >= 100 ? Math.round(size / 100) * 100 : Math.max(1, Math.round(size));
        const pt = t - dt + ((i + r.float()) / n) * dt;
        this.walk(side, size, null, null, true, pt);
      }
      this.barAt(t);
      m.afterSubstep(this, t);
      if (d.halts && kind === 'rth') this.checkLuld(t);
    }

    checkLuld(t) {
      if (t - this.lastRefT >= 10) {
        this.refSamples.push([t, this.lastIdx]);
        this.lastRefT = t;
        while (this.refSamples.length && this.refSamples[0][0] < t - 300) this.refSamples.shift();
      }
      if (!this.refSamples.length || t - this.refSamples[0][0] < 30) return;
      let s = 0;
      for (const x of this.refSamples) s += x[1];
      const ref = s / this.refSamples.length;
      const price = ref * this.tick;
      let band = price >= 3 ? 0.1 : 0.2;
      const [a, b] = this.def.rth;
      const h = LV.tod(t);
      if (h < a + 900 || h > b - 1500) band *= 2;
      if (this.lastIdx > ref * (1 + band)) this.startHalt(t, 300, 'LULD pause: limit up', 1);
      else if (this.lastIdx < ref * (1 - band)) this.startHalt(t, 300, 'LULD pause: limit down', -1);
    }

    startHalt(t, dur, reason, dir) {
      if (this.halted) { this.haltUntil = Math.max(this.haltUntil, t + dur); return; }
      this.halted = true; this.haltStart = t; this.haltUntil = t + dur; this.haltReason = reason;
      if (dir) this.pendingReopen += dir * Math.abs(this.rng.normal()) * 0.02;
      this.halts.push([t, t + dur, reason]);
      this.m.emitHalt(this, true, t);
    }

    reopen(t) {
      this.shiftFair(this.pendingReopen, 1);
      this.pendingReopen = 0;
      this.halted = false;
      if (this.halts.length) this.halts[this.halts.length - 1][1] = t;
      this.askDep.clear(); this.bidDep.clear(); this.temp = 0;
      this.quote();
      const auc = Math.max(1, Math.round(this.fair / this.tick));
      // Reopening auction: every resting order that crosses the auction price fills there.
      let aucVol = Math.round(this.rng.lognormal(this.def.depth * 6, 0.5) / 100) * 100;
      for (const o of this.resting.slice()) {
        if (o.status !== 'working') continue;
        if ((o.side > 0 && o.limitIdx >= auc) || (o.side < 0 && o.limitIdx <= auc)) {
          const f = o.qty - o.filled;
          aucVol += f;
          this.m.restingFill(this, o, f, auc, t, 'AUCTION');
        }
      }
      this.resting = this.resting.filter((o) => o.filled < o.qty && o.status === 'working');
      this.gapNext = true;
      this.print(t, auc, aucVol, 0, 4);
      this.refSamples = [[t, auc]]; this.lastRefT = t;
      if (this.reactor) this.reactor.interrupt(t, 180);
      this.m.emitHalt(this, false, t);
    }

    // Top-of-book and N levels each side for the ladder, including players' resting orders.
    book(t, n) {
      const bids = [], asks = [];
      const add = new Map();
      for (const o of this.resting) {
        const k = o.side * 1e9 + o.limitIdx;
        add.set(k, (add.get(k) || 0) + (o.qty - o.filled));
      }
      const a = this.bestAsk(t), b = this.bestBid(t);
      if (a !== null) {
        for (let i = 0, idx = a; i < n; i++, idx++) asks.push([idx, this.levelSize(1, idx, t) + (add.get(-1 * 1e9 + idx) || 0)]);
      }
      if (b !== null) {
        for (let i = 0, idx = b; i < n && idx > 0; i++, idx--) bids.push([idx, this.levelSize(-1, idx, t) + (add.get(1e9 + idx) || 0)]);
      }
      return { b: bids, a: asks };
    }

    vwap() { return this.volume > 0 ? this.pv / this.volume : this.lastIdx * this.tick; }

    snapshot(t) {
      const d = this.def;
      return {
        sym: d.sym, name: d.name, sector: d.sector, cap: d.cap, float: d.float, desc: d.desc, halts: !!d.halts, htb: !!d.htb,
        borrowFee: d.borrowFee || 0, shortInterest: d.shortInterest || 0,
        kind: d.kind || 'stock', cls: d.cls || 'large', mult: d.mult || 1, comm: d.comm || 0, rth: d.rth, round: d.round, conf: d.conf || 0,
        orMin: d.orMin || 15, micro: !!d.isMicro, full: d.full || null, lead: d.lead || null,
        runner: d.runnerInfo ? { catalyst: d.runnerInfo.catalyst, newsAt: d.runnerInfo.newsAt, gapPct: d.runnerInfo.gapPct } : null,
        tick: this.tick, prev: this.prevCloseIdx, open: this.openIdx, bars: this.bars.map((b) => [b[0], b[1], b[2], b[3], b[4], Math.round(b[5])]),
        hist: LV.packBars(this.hist), prior: this.prior || [],
        last: this.lastIdx, bid: this.bestBid(t), ask: this.bestAsk(t), hi: this.hiIdx, lo: this.loIdx,
        vol: this.volume, pv: Math.round(this.pv), halted: this.halted, haltUntil: this.haltUntil, haltReason: this.haltReason,
        haltList: this.halts.map((h) => h.slice()), noLocate: this.noLocate, ssr: this.ssr, big: this.big.slice(-1500), bigThreshold: this.bigThreshold
      };
    }

    // What changed since the last delta: quote, stats and the bars from the first dirty one.
    delta(t) {
      const from = Math.min(this.dirtyFrom, Math.max(0, this.bars.length - 1));
      const big = this.big.length > this.bigSent ? this.big.slice(this.bigSent) : null;
      this.bigSent = this.big.length;
      const out = [this.lastIdx, this.bestBid(t), this.bestAsk(t), this.volume, Math.round(this.pv), this.halted ? 1 : 0, from, this.bars.slice(from).map((b) => [b[0], b[1], b[2], b[3], b[4], Math.round(b[5])]), this.hiIdx, this.loIdx, this.openIdx, big, this.ssr ? 1 : 0];
      this.dirtyFrom = Math.max(0, this.bars.length - 1);
      return out;
    }
  }

  // ---------- the market ----------
  class MarketSim {
    // opts: {seed, symbols (keys) or defs, start, end, speed, volatility, events, scenario, calendar}
    constructor(opts) {
      this.seed = opts.seed >>> 0;
      this.rng = new RNG(this.seed);
      this.start = opts.start; this.end = opts.end; this.t = opts.start;
      this.speed = Math.max(0.5, opts.speed || 30);
      this.flowScale = Math.min(1, 14 / this.speed);
      this.noiseBucket = Math.max(6, this.speed * 0.9);
      const scen = opts.scenario || null;
      this.scenario = scen;
      this.volScale = ({ calm: 0.75, normal: 1, wild: 1.5 }[opts.volatility] || 1) * (scen && scen.volScale ? scen.volScale : 1);
      this.live = false;
      this.weekday = opts.weekday !== undefined ? opts.weekday : this.rng.fork('day').int(0, 4);
      this.hooks = { restingFill: null, afterSubstep: null, halt: null, news: null, cal: null };
      this.news = []; this.newsSeq = 0; this.tags = {};
      this.schedule = [];
      this.closed = false;

      // Drivers and their plans for yesterday, overnight and today.
      this.drivers = {};
      for (const k of DRIVER_ORDER) this.drivers[k] = new Driver(this, k, this.rng.fork('drv' + k));
      this.factors = this.drivers;
      const planRng = this.rng.fork('plans');
      this.dayTypes = {};
      for (const k of DRIVER_ORDER) {
        const d = this.drivers[k];
        const [a, b] = d.spec.rth;
        const priorType = P.pickDayType(planRng);
        const todayType = scen ? 'flat' : P.pickDayType(planRng);
        this.dayTypes[k] = { prior: priorType, today: todayType };
        d.path.schedule(P.rthPlan(planRng, priorType, a - DAY_SEC, b - DAY_SEC, d.spec.sd * this.volScale));
        d.path.schedule(P.flatPlan(b - DAY_SEC, LV.ON_START, 60, 'post'));
        d.path.schedule(P.onPlan(planRng, LV.ON_START, a, d.spec.sd * this.volScale));
        d.path.schedule(todayType === 'flat' ? P.flatPlan(a, b, 120) : P.rthPlan(planRng, todayType, a, b, d.spec.sd * this.volScale));
        d.path.schedule(P.flatPlan(b, b + 7200, 60, 'post'));
      }

      // Instruments.
      this.syms = {};
      this.list = [];
      const defs = opts.defs || (opts.symbols || []).map((s) => SYMBOLS[s]).filter(Boolean);
      for (const def of defs) {
        const sim = new SymbolSim(this, def, this.rng.fork(def.sym));
        this.syms[def.sym] = sim;
        this.list.push(sim);
        this.planSymbol(sim, planRng, !!scen);
      }
      for (const s of this.list) if (s.lead && !s.lead.liveSim) s.lead.liveSim = s;

      // Scheduled news: runner catalysts, economic data for yesterday and today, scenario scripts.
      this.eventsLevel = scen ? 'off' : (opts.events || 'normal');
      this.calendar = [];
      if (!scen && opts.calendar !== false && this.eventsLevel !== 'off') this.buildCalendar();
      for (const s of this.list) {
        const ri = s.def.runnerInfo;
        if (ri) this.schedule.push({ at: ri.newsAt, fn: (t) => this.pushNews(t, s.sym, ri.catalyst, 1, true) });
      }
      if (scen) this.resolveScenario(scen);
      this.schedule.sort((a, b) => a.at - b.at);
      // Headlines: a realistic number per market day, with a floor so short games still get some news.
      const perDay = { off: 0, calm: 1.2, normal: 2.5, chaos: 7 }[this.eventsLevel] || 0;
      const perGame = { off: 0, calm: 0.4, normal: 0.8, chaos: 2 }[this.eventsLevel] || 0;
      this.newsRate = Math.max(perDay / P.DAY, perGame / Math.max(300, this.end - this.start));
      this.newsRng = this.rng.fork('news');
      this.nextNewsT = this.newsRate > 0 ? this.start + Math.max(60, this.newsRng.exp(1 / this.newsRate)) : Infinity;

      this.runHistory();
      // Opening gaps: events at or before the start are applied now so the first print is the gapped open.
      this.live = true;
      this.runSchedule(this.start);
      for (const s of this.list) { s.quote(); s.cPrev = null; }
    }

    // Each instrument's own path: yesterday, the overnight or premarket, and today's plan or playbook.
    planSymbol(sim, r, scen) {
      const def = sim.def;
      if (sim.lead) return;
      const y = sim.y;
      const [a, b] = def.rth;
      const sd = (def.idio || 0) * this.volScale;
      const priorType = P.pickDayType(r);
      let todayType = scen ? 'flat' : P.pickDayType(r);
      if (def.runnerInfo) {
        // Yesterday the runner was an unknown small cap: quiet.
        y.schedule(P.flatPlan(a - DAY_SEC, b - DAY_SEC, 60, 'quiet'));
        y.effects.push({ kind: 'volc', mult: 0.3, until: def.runnerInfo.newsAt, dur: 1 });
        const rp = P.runnerPlans(r, def.runnerInfo, a, b);
        y.schedule(P.flatPlan(LV.PM_START, def.runnerInfo.newsAt, 60, 'premarket'));
        y.schedule(rp.pm);
        y.schedule(rp.rth);
        todayType = def.runnerInfo.play;
      } else {
        y.schedule(P.rthPlan(r, priorType, a - DAY_SEC, b - DAY_SEC, sd));
        if (sim.fut) {
          y.schedule(P.flatPlan(b - DAY_SEC, LV.ON_START, 60, 'post'));
          y.schedule(P.onPlan(r, LV.ON_START, a, sd));
        } else {
          y.schedule(P.flatPlan(b - DAY_SEC, LV.PM_START, 60, 'closed'));
          y.schedule(P.flatPlan(LV.PM_START, a, 45, 'premarket'));
          // Overnight news gap for the stock itself, known at 4:00.
          const gap = r.normal() * sd * 0.35 + (r.chance(0.04) ? r.sign() * r.range(0.03, 0.07) : 0);
          this.schedule.push({ at: LV.PM_START, fn: () => y.jump(gap) });
        }
        y.schedule(todayType === 'flat' ? P.flatPlan(a, b, 120) : P.rthPlan(r, todayType, a, b, sd));
      }
      y.schedule(P.flatPlan(b, b + 7200, 60, 'post'));
      sim.dayType = { prior: def.runnerInfo ? 'quiet' : priorType, today: todayType };
    }

    // Economic calendar for yesterday and today. Only events that matter to what's traded move prices,
    // but every event on the calendar still moves its drivers (the market moves whether you trade it or not).
    buildCalendar() {
      const r = this.rng.fork('cal');
      const yday = (this.weekday + 4) % 5;
      const evs = DTA.makeCalendar(r, yday, -DAY_SEC).concat(DTA.makeCalendar(r, this.weekday, 0));
      for (const ev of evs) {
        ev.z = clamp(r.normal() * 1.1, -3, 3);
        ev.r = r.fork(ev.id + ev.t);
        ev.released = false;
        this.calendar.push(ev);
        this.schedule.push({ at: ev.t - 300, fn: () => this.calHush(ev) });
        this.schedule.push({ at: ev.t, fn: (t) => this.calRelease(ev, t) });
      }
    }
    calHush(ev) {
      for (const k in ev.hit) {
        const d = this.drivers[k];
        d.path.effects.push({ kind: 'act', mult: 0.55, until: ev.t, dur: 300 });
      }
      for (const s of this.list) if (this.exposed(s, ev)) s.effects.push({ kind: 'depth', mult: 0.55, until: ev.t + 20, dur: 320 });
    }
    exposed(s, ev) {
      for (const k in ev.hit) if (s.def.drivers && s.def.drivers[k]) return true;
      return false;
    }
    calRelease(ev, t) {
      const r = ev.r, z = ev.z;
      const scale = [0, 0.18, 0.32, 0.5][ev.imp] || 0.3;
      ev.released = true;
      if (ev.fmt) ev.act = DTA.fmtCalVal(ev.fmt, ev.fmt.base + ev.fmt.step * Math.round(z * 2) / 2 + (parseFloat(ev.fc) - ev.fmt.base));
      const ws = r.chance(ev.ws);
      for (const k in ev.hit) {
        const d = this.drivers[k];
        const J = z * ev.hit[k] * d.spec.sd * scale * this.volScale;
        d.path.jump(J);
        d.path.effects.push({ kind: 'vol', mult: 1.8 + ev.imp * 0.5, until: t + 600 * ev.imp, dur: 600 * ev.imp });
        if (d.reactor) d.reactor.interrupt(t, 300);
        if (ws) {
          const back = -J * r.range(0.7, 1.3);
          this.schedule.push({ at: t + r.range(40, 150), fn: () => d.path.jump(back) });
          const third = Math.abs(J) * r.range(0.6, 1.2) * (r.chance(0.6) ? Math.sign(J) : -Math.sign(J));
          const dur = r.range(600, 1500);
          this.schedule.push({ at: t + r.range(180, 420), fn: (tt) => d.path.effects.push({ kind: 'drift', rate: third / dur, until: tt + dur, dur }) });
        } else {
          const fol = Math.abs(J) * r.range(0.1, 0.8) * (r.chance(0.65) ? Math.sign(J) : -0.6 * Math.sign(J));
          const dur = r.range(900, 2400);
          d.path.effects.push({ kind: 'drift', rate: fol / dur, until: t + dur, dur });
        }
      }
      this.schedule.sort((a, b) => a.at - b.at);
      for (const s of this.list) {
        if (!this.exposed(s, ev)) continue;
        s.effects.push({ kind: 'depth', mult: 0.35, until: t + 25, dur: 25 });
        if (s.reactor) s.reactor.interrupt(t, 300);
      }
      const main = ev.hit.MKT !== undefined ? 'MKT' : Object.keys(ev.hit)[0];
      const tone = Math.sign(z * ev.hit[main]) || 0;
      this.pushNews(t, null, calHeadline(ev, z), tone, ev.imp >= 2 && Math.abs(z) > 0.8);
      if (this.hooks.cal) this.hooks.cal(ev);
    }

    // Simulate from the prior session to the match start in 20-second steps, as 1-minute history.
    runHistory() {
      let h0 = Infinity;
      for (const s of this.list) h0 = Math.min(h0, s.def.rth[0] - DAY_SEC);
      for (const k of ['MKT', 'OIL', 'GOLD']) h0 = Math.min(h0, this.drivers[k].spec.rth[0] - DAY_SEC);
      h0 = Math.floor(h0 / 60) * 60;
      this.histStart = h0;
      const T0 = this.start;
      // Plans that start before history are applied in order as the clock passes them.
      for (let t = h0; t < T0 - 1e-6;) {
        const dt = Math.min(HIST_DT, T0 - t);
        t += dt;
        this.t = t;
        this.runSchedule(t);
        this.advance(t, dt);
        for (const k of ['MKT', 'OIL', 'GOLD']) this.drivers[k].sample(t);
        for (const s of this.list) s.histSample(t, 1);
      }
      for (const k of ['MKT', 'OIL', 'GOLD']) { const d = this.drivers[k]; const nb = d.bb.bars.length; d.bb.close(); if (d.bb.bars.length > nb) d.feed(d.bb.bars[d.bb.bars.length - 1]); }
      for (const s of this.list) s.finishHistory(T0);
      for (const s of this.list) if (s.lead && s.lead.liveSim === s) s.lead.liveDev = s.dev;
      this.t = T0;
      // News from before the bell stays visible, most recent first.
      this.news = this.news.slice(-40);
    }

    // One step of every price path: drivers (with spill-overs), each instrument's own path, level reactions.
    advance(t, dt) {
      const dl = {};
      for (const k of DRIVER_ORDER) dl[k] = this.drivers[k].path.step(t, dt);
      for (const k in CROSS) {
        const p = this.drivers[k].path;
        for (const src in CROSS[k]) { const v = CROSS[k][src] * dl[src]; p.lf += v; p.aOff += v; }
      }
      for (const k of ['MKT', 'OIL', 'GOLD']) this.drivers[k].reactor.step(t, dt);
      for (const s of this.list) {
        if (!s.lead) s.y.step(t, dt);
        if (s.reactor) s.reactor.step(t, dt);
      }
    }

    resolveScenario(scen) {
      const r = this.rng.fork('scenario');
      let prevT = this.start;
      for (const ev of scen.events) {
        let at;
        if (ev.at === 'open') at = this.start;
        else if (Array.isArray(ev.at)) at = r.range(parseClock(ev.at[0]), parseClock(ev.at[1]));
        else if (typeof ev.at === 'string' && ev.at[0] === '+') at = prevT + parseFloat(ev.at.slice(1));
        else at = parseClock(ev.at);
        if (at === null || isNaN(at)) continue;
        prevT = at;
        this.schedule.push({ at, ev, r: r.fork(String(this.schedule.length)) });
      }
    }

    runSchedule(t) {
      while (this.schedule.length && this.schedule[0].at <= t) {
        const s = this.schedule.shift();
        if (s.fn) s.fn(Math.max(s.at, Math.min(t, s.at + 1)));
        else this.applyEvent(s.ev, s.r, t);
      }
    }

    range(v, r) { return Array.isArray(v) ? r.range(v[0], v[1]) : v; }

    applyEvent(evIn, r, t) {
      let ev = evIn;
      let outcome = 0;
      if (ev.branch) {
        const yes = r.chance(ev.branch.p);
        outcome = yes ? 1 : -1;
        ev = Object.assign({}, ev, yes ? ev.branch.yes : ev.branch.no);
        delete ev.branch;
      }
      let sign = 1;
      if (ev.follow) sign = (this.tags[ev.follow] || 1) * (ev.followSign || 1);
      const targets = this.targetsFor(ev.target);
      const jump = ev.jump !== undefined ? this.range(ev.jump, r) * sign : 0;
      if (ev.tag) this.tags[ev.tag] = outcome || Math.sign(jump) || 1;
      for (const tg of targets) {
        if (tg instanceof Driver) {
          if (jump) tg.path.jump(jump);
          if (ev.drift) { const mv = this.range(ev.drift.move, r) * sign; tg.path.effects.push({ kind: 'drift', rate: Math.log(1 + mv) / ev.drift.dur, until: t + ev.drift.dur, dur: ev.drift.dur }); }
          if (ev.vol) tg.path.effects.push({ kind: 'vol', mult: ev.vol.mult, until: t + ev.vol.dur, dur: ev.vol.dur });
          if (ev.vol && tg.key === 'MKT') for (const s of this.list) s.effects.push({ kind: 'vol', mult: 1 + (ev.vol.mult - 1) * 0.6, until: t + ev.vol.dur, dur: ev.vol.dur });
          if (tg.reactor && (jump || ev.drift)) tg.reactor.interrupt(t, 240);
          if (ev.regime) this.regime(tg.path, ev.regime, t, tg.spec.sd);
          continue;
        }
        const s = tg;
        if (ev.halt) s.startHalt(t, ev.halt, 'Halted: news pending', 0);
        if (ev.reopenJump !== undefined) s.jump(this.range(ev.reopenJump, r) * sign);
        if (jump) s.jump(jump);
        if (ev.drift) { const mv = this.range(ev.drift.move, r) * sign; s.effects.push({ kind: 'drift', rate: Math.log(Math.max(0.05, 1 + mv)) / ev.drift.dur, until: t + ev.drift.dur, dur: ev.drift.dur }); if (s.reactor) s.reactor.interrupt(t, 180); }
        if (ev.vol) s.effects.push({ kind: 'vol', mult: ev.vol.mult, until: t + ev.vol.dur, dur: ev.vol.dur });
        if (ev.depth) s.effects.push({ kind: 'depth', mult: ev.depth.mult, until: t + ev.depth.dur, dur: ev.depth.dur });
        if (ev.flow) s.effects.push({ kind: 'flow', bias: ev.flow.bias * sign, until: t + ev.flow.dur, dur: ev.flow.dur });
        if (ev.noLocate !== undefined) s.noLocate = !!ev.noLocate;
        if (ev.regime && !s.lead) this.regime(s.y, ev.regime, t, s.def.vol || 0.01);
      }
      if (ev.regime && ev.regime.type === 'trendDay' && !targets.includes(this.drivers.MKT)) this.regime(this.drivers.MKT.path, ev.regime, t, DRIVERS.MKT.sd);
      if (ev.headline) {
        const one = targets.length === 1 && !(targets[0] instanceof Driver) ? targets[0] : null;
        this.pushNews(t, one ? one.sym : null, ev.headline.text, ev.headline.tone, !!ev.headline.big);
      }
    }

    // Scenario regimes: trendDay (one direction all day), chopDay (fade every move) or chop (pinned).
    regime(path, rg, t, sd) {
      const until = t + rg.dur;
      if (rg.type === 'trendDay') {
        const dir = this.tags.trendDir || 1;
        const pl = P.rthPlan(this.rng.fork('rg' + t), 'trend', t, Math.min(until, t + 23400), sd * this.volScale, dir);
        path.replacePlan(pl, t);
      } else if (rg.type === 'chopDay') {
        path.replacePlan(new P.Plan(t, [{ t, a: 0, k: P.hl(6) }, { t: until, a: 0, k: P.hl(6) }], 'chop'), t);
      } else if (rg.type === 'chop') {
        const k = rg.kappa || 0.004;
        path.replacePlan(new P.Plan(t, [{ t, a: 0, k }, { t: until, a: 0, k }], 'chop'), t);
      }
    }

    targetsFor(target) {
      if (!target || target === '*') return this.list.slice();
      if (this.drivers[target]) return [this.drivers[target]];
      return this.syms[target] ? [this.syms[target]] : [];
    }

    pushNews(t, sym, text, tone, big) {
      const s = sym ? this.syms[sym] : null;
      const txt = text.replace(/\{sym\}/g, s ? s.sym : '').replace(/\{name\}/g, s ? s.def.name : '');
      const n = { id: ++this.newsSeq, t, sym, text: txt, tone: tone || 0, big: !!big };
      this.news.push(n);
      if (this.news.length > 400) this.news.splice(0, 100);
      if (this.live && this.hooks.news) this.hooks.news(n);
      return n;
    }

    // Random headline for normal games.
    randomNews(t) {
      const r = this.newsRng;
      const stock = (s) => s.def.kind !== 'future' && s.def.sector !== 'Index';
      const has = (fn) => this.list.some(fn);
      const ok = (tpl) => {
        switch (tpl.kind) {
          case 'mkt': return has((s) => s.def.drivers && s.def.drivers.MKT);
          case 'any': return has(stock);
          case 'large': return has((s) => stock(s) && s.def.cls === 'large');
          case 'small': return has((s) => stock(s) && s.def.halts);
          case 'bio': return has((s) => s.def.sector === 'Biotech');
          case 'oil': return has((s) => s.def.drivers && s.def.drivers.OIL);
          case 'gold': return has((s) => s.def.drivers && s.def.drivers.GOLD);
          case 'fin': return has((s) => s.def.drivers && s.def.drivers.RATES && stock(s));
          default: return false;
        }
      };
      const pool = NEWS.filter(ok);
      if (!pool.length) return;
      const tpl = r.weighted(pool, pool.map((p) => p.w));
      if (tpl.target) {
        const d = this.drivers[tpl.target];
        // Headlines move a whole market much less than a single stock.
        const j = r.range(tpl.abs[0], tpl.abs[1]) * 0.45 * this.volScale;
        d.path.jump(j);
        if (d.reactor) d.reactor.interrupt(t, 180);
        const dur = r.range(900, 2400);
        d.path.effects.push({ kind: 'drift', rate: (r.range(tpl.drift[0], tpl.drift[1]) * 0.45 * this.volScale) / dur, until: t + dur, dur });
        if (tpl.rates) this.drivers.RATES.path.jump(tpl.rates * 0.2);
        if (tpl.oilAlso) this.drivers.OIL.path.jump(tpl.oilAlso);
        if (tpl.goldAlso) this.drivers.GOLD.path.jump(tpl.goldAlso);
        this.pushNews(t, null, tpl.text, tpl.tone, Math.abs(j) > d.spec.sd * 0.7);
        return;
      }
      const cands = this.list.filter((s) => {
        if (!stock(s)) return false;
        switch (tpl.kind) {
          case 'large': return s.def.cls === 'large';
          case 'small': return s.def.halts;
          case 'bio': return s.def.sector === 'Biotech';
          case 'fin': return !!(s.def.drivers && s.def.drivers.RATES);
          default: return true;
        }
      });
      if (!cands.length) return;
      const s = r.pick(cands);
      const v = (s.def.vol || 0.02) * this.volScale;
      const jump = r.range(tpl.sig[0], tpl.sig[1]) * v;
      const dur = r.range(600, 1800);
      const mv = r.range(tpl.drift[0], tpl.drift[1]) * v;
      if (tpl.halt && s.def.halts && Math.abs(jump) > 0.06 && !s.halted && LV.sessionAt(s.meta, t) === 'rth') {
        s.startHalt(t, r.range(120, 300), 'Halted: news pending', 0);
        s.pendingReopen += jump;
      } else s.jump(jump);
      s.effects.push({ kind: 'drift', rate: Math.log(Math.max(0.05, 1 + mv)) / dur, until: t + dur, dur });
      s.effects.push({ kind: 'vol', mult: 1.6, until: t + dur, dur });
      if (tpl.flow) s.effects.push({ kind: 'flow', bias: tpl.flow, until: t + dur * 0.6, dur: dur * 0.6 });
      this.pushNews(t, s.sym, tpl.text, tpl.tone, Math.abs(jump) > 1.2 * v);
      if (tpl.rumor) {
        const confirm = r.chance(0.45);
        const at = t + r.range(600, 1500);
        this.schedule.push({
          at, r: r.fork('rumor' + at),
          ev: confirm
            ? { target: s.sym, jump: [Math.abs(jump) * 0.8 + 0.05, Math.abs(jump) * 1.2 + 0.12], halt: s.def.halts ? 180 : 0, headline: { text: '{name} confirms it will be acquired at a 30% premium', tone: 1, big: true } }
            : { target: s.sym, jump: [-Math.abs(jump) * 0.9, -Math.abs(jump) * 0.6], headline: { text: '{name} denies takeover talks: "pure speculation"', tone: -1 } }
        });
        this.schedule.sort((a, b) => a.at - b.at);
      }
    }

    restingFill(sim, order, qty, idx, t, aggressorPid) {
      order.filled += qty;
      if (this.hooks.restingFill) this.hooks.restingFill(sim, order, qty, idx, t, aggressorPid);
    }
    afterSubstep(sim, t) { if (this.hooks.afterSubstep) this.hooks.afterSubstep(sim, t); }
    emitHalt(sim, on, t) { if (this.hooks.halt) this.hooks.halt(sim, on, t); }

    // Advance the market by dt market seconds. Returns false once the closing bell has rung.
    step(dt) {
      if (this.closed) return false;
      const n = clamp(Math.ceil(dt / 1.0), 1, 60);
      const sub = dt / n;
      for (let i = 0; i < n; i++) {
        this.t = Math.min(this.end, this.t + sub);
        const t = this.t;
        this.runSchedule(t);
        while (t >= this.nextNewsT) {
          this.randomNews(this.nextNewsT);
          this.nextNewsT += Math.max(30, this.newsRng.exp(1 / this.newsRate));
        }
        this.advance(t, sub);
        for (const k of ['MKT', 'OIL', 'GOLD']) if (!this.drivers[k].liveDev) this.drivers[k].sample(t);
        for (const s of this.list) s.substep(t, sub);
        if (t >= this.end) { this.closed = true; break; }
      }
      return !this.closed;
    }

    // Public economic calendar: actuals only once released.
    calendarView() {
      return this.calendar.filter((e) => e.t > this.start - 6 * 3600 || e.released).map((e) => ({ id: e.id, name: e.name, long: e.long, t: e.t, imp: e.imp, fc: e.fc, act: e.released ? e.act || null : null, done: e.released, tone: e.released ? Math.sign(e.z * (e.hit.MKT !== undefined ? e.hit.MKT : Object.values(e.hit)[0])) : 0 }));
    }

    snapshot() {
      const syms = {};
      for (const s of this.list) syms[s.sym] = s.snapshot(this.t);
      return {
        t: this.t, start: this.start, end: this.end, speed: this.speed, syms, news: this.news.slice(-60),
        weekday: this.weekday, days: [WEEKDAYS[(this.weekday + 4) % 5], WEEKDAYS[this.weekday]], cal: this.calendarView()
      };
    }

    // What the market did, for the debrief.
    recap() {
      const out = [];
      for (const s of this.list) {
        const d = s.def;
        const type = d.runnerInfo ? DTA.PLAYBOOKS[d.runnerInfo.play].name : s.lead ? (P.DAY_TYPES[this.dayTypes[d.lead].today] || { name: 'Scripted' }).name : s.dayType && P.DAY_TYPES[s.dayType.today] ? P.DAY_TYPES[s.dayType.today].name : null;
        const drvType = !d.runnerInfo && d.drivers && d.drivers.MKT && !s.lead ? (P.DAY_TYPES[this.dayTypes.MKT.today] || {}).name : null;
        const rx = s.react ? s.react.log.filter((x) => x.t >= this.start) : [];
        out.push({
          sym: s.sym, type, marketType: drvType, play: d.runnerInfo ? DTA.PLAYBOOKS[d.runnerInfo.play].desc : null,
          chg: s.prevCloseIdx ? s.lastIdx / s.prevCloseIdx - 1 : 0,
          holds: rx.filter((x) => x.type === 'reject').length, breaks: rx.filter((x) => x.type === 'break').length,
          reactions: rx.slice(-8).map((x) => ({ t: x.t, kind: x.type === 'reject' ? (x.style === 'sweep' ? 'swept and rejected' : x.flip ? 'retested and held' : 'held') : x.style === 'fail' ? 'failed breakout' : 'broke', label: x.label }))
        });
      }
      return { syms: out, cal: this.calendarView().filter((e) => e.done && e.t >= this.start - 3600) };
    }
  }

  function calHeadline(ev, z) {
    const hot = z > 0.35, cold = z < -0.35;
    if (ev.id === 'fomc') return hot ? 'FOMC cuts 25 bp and signals more easing ahead' : cold ? 'FOMC holds; dots show fewer cuts than expected' : 'FOMC holds rates as expected';
    if (ev.id === 'presser') return hot ? 'Fed Chair: "we are prepared to adjust policy as needed"' : cold ? 'Fed Chair: "the job on inflation is not done"' : 'Fed Chair: policy "well positioned"';
    if (ev.id === 'auction') return hot ? '10-year auction tails: weak demand, yields jump' : cold ? '10-year auction stops through on strong demand' : '10-year auction in line';
    if (ev.id === 'speaker') return hot ? 'Fed governor: "further hikes can\'t be ruled out"' : cold ? 'Fed governor open to cuts "sooner rather than later"' : 'Fed governor sticks to the script';
    if (ev.id === 'eia') return 'EIA crude inventories ' + (ev.act || '') + ' vs ' + (ev.fc || '') + ' expected' + (hot ? ': surprise build' : cold ? ': bigger draw' : '');
    const f = ev.fmt || { up: 'higher', down: 'lower' };
    const word = hot ? ' (' + f.up + ' than expected)' : cold ? ' (' + f.down + ' than expected)' : ' (in line)';
    return ev.long + ' ' + (ev.act || '') + ' vs ' + (ev.fc || '') + ' expected' + word;
  }

  DTA.MarketSim = MarketSim;
  DTA.SymbolSim = SymbolSim;
})();
