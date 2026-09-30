// Day Trade Arena: the market simulator. Runs only on the host.
//
// Each stock has a hidden "fair value" that moves as: market/oil/rates factor moves times its betas, plus
// its own noise (stochastic volatility, stronger at the open and close), plus regime drift (trend, chop,
// pause segments) and news. Around fair value sits a synthetic order book. Its size at each price level
// is persistent but breathing noise, with walls at round numbers. Players' limit orders sit in that book
// with a queue position, and players' market orders eat through it: levels they take refill over time,
// the quote shifts for a while, and fair value moves a little for good (market impact). Background "noise
// traders" print on the tape at the best bid/ask, and those prints are what fill resting orders and build
// the candles. Small caps have limit-up/limit-down halts that reopen through an auction.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const { RNG, clamp, hash2, hashStr, BAR_SEC, SYMBOLS, RTH_OPEN, RTH_CLOSE, NEWS, parseClock } = DTA;

  const DAY = RTH_CLOSE - RTH_OPEN; // 23400 s

  // Intraday activity (U-shape: busy open, lunch lull, busier close), normalised to an average of 1.
  function rawActivity(t) {
    const u = clamp((t - RTH_OPEN) / DAY, 0, 1);
    return 0.72 + 1.5 * Math.exp(-u / 0.05) + 0.5 * Math.exp(-(1 - u) / 0.07) - 0.12 * Math.exp(-(((u - 0.5) / 0.13) ** 2));
  }
  let ACT_NORM = 0;
  for (let i = 0; i <= 1000; i++) ACT_NORM += rawActivity(RTH_OPEN + (DAY * i) / 1000);
  ACT_NORM /= 1001;
  const activity = (t) => rawActivity(t) / ACT_NORM;

  // ---------- factors (market, oil, rates) ----------
  class Factor {
    constructor(name, vol, rng) {
      this.name = name; this.vol = vol; this.rng = rng;
      this.lf = 0; this.lv = 0; this.effects = []; this.seg = null;
      this.dayDir = rng.weighted([-1, 0, 1], [0.3, 0.4, 0.3]);
    }
    newSeg(t) {
      const r = this.rng;
      const type = r.weighted(['trend', 'chop', 'pause'], [0.45, 0.35, 0.2]);
      const dur = clamp(r.exp(2400), 600, 7200);
      const seg = { type, until: t + dur, drift: 0, kappa: 0, anchor: this.lf };
      if (type === 'trend') {
        const dir = this.dayDir && r.chance(0.7) ? this.dayDir : r.sign();
        seg.drift = (dir * r.range(0.8, 1.8) * this.vol * Math.sqrt(dur / DAY)) / dur;
      } else if (type === 'chop') seg.kappa = r.range(0.0008, 0.002);
      else seg.kappa = 0.0004;
      this.seg = seg;
    }
    step(t, dt, volScale) {
      if (!this.seg || t >= this.seg.until) this.newSeg(t);
      let volMult = 1, drift = 0;
      if (this.effects.length) {
        this.effects = this.effects.filter((e) => e.until > t);
        for (const e of this.effects) {
          if (e.kind === 'drift') drift += e.rate;
          else if (e.kind === 'vol') volMult *= 1 + (e.mult - 1) * clamp((e.until - t) / e.dur, 0, 1);
        }
      }
      this.lv += (-this.lv * dt) / 1200 + 0.3 * Math.sqrt(dt / 1200) * this.rng.normal();
      this.lv = clamp(this.lv, -0.8, 1.2);
      const sigma = this.vol * Math.sqrt(dt / DAY) * Math.sqrt(activity(t)) * Math.exp(this.lv) * volMult * volScale;
      let dx = sigma * this.rng.normal() + (this.seg.drift + drift) * dt;
      this.seg.anchor += drift * dt;
      if (this.seg.kappa) dx -= this.seg.kappa * (this.lf - this.seg.anchor) * dt;
      if (this.pendingJump) { dx += this.pendingJump; this.seg.anchor += this.pendingJump; this.pendingJump = 0; }
      this.lf += dx;
      return dx;
    }
  }

  // ---------- one stock ----------
  class SymbolSim {
    constructor(market, def, rng) {
      this.m = market; this.def = def; this.sym = def.sym; this.rng = rng;
      this.tick = def.tick || 0.01;
      this.salt = hashStr(def.sym + ':' + market.seed) % 100000;
      const prev = def.p * Math.exp(rng.normal() * 0.08);
      this.prevCloseIdx = Math.max(20, Math.round(prev / this.tick));
      this.lf = Math.log(this.prevCloseIdx * this.tick);
      this.lv = rng.normal() * 0.2;
      this.temp = 0;            // temporary impact, in ticks
      this.effects = [];
      this.seg = null;
      this.dayDir = rng.weighted([-1, 0, 1], [0.3, 0.4, 0.3]);
      this.regime = null;       // scenario override {type, until, kappa, dir}
      this.askDep = new Map();  // price level → shares taken and not yet refilled
      this.bidDep = new Map();
      this.resting = [];        // players' resting limit orders (engine order objects)
      this.bars = [];           // [o, h, l, c, v, buyVol] in ticks; index = 5-second bar number from session start
      this.big = [];            // large prints for the chart's bubbles: [t, idx, qty, side]
      this.bigSent = 0;
      // A "big print" is one order that trades at least this many shares (about 1 print in 150).
      this.bigThreshold = Math.round(Math.max(def.depth * 3, (def.printSize / market.flowScale) * 8) / 100) * 100;
      this.dirtyFrom = 0;
      this.lastIdx = this.prevCloseIdx;
      this.openIdx = null;
      this.hiIdx = null; this.loIdx = null;
      this.volume = 0; this.pv = 0;
      this.prints = [];         // since the last host flush: [t, idx, qty, side, flags]
      this.halted = false; this.haltUntil = 0; this.haltReason = ''; this.haltStart = 0; this.pendingReopen = 0; this.gapNext = true;
      this.halts = [];          // [start, end, reason]
      this.refSamples = [];     // LULD reference samples [t, idx]
      this.lastRefT = -1e9;
      this.noLocate = false;
      this.cPrev = null;
      this.sBid = 0; this.sAsk = 0;
      this.subHi = null; this.subLo = null;
      this.depthMult = 1; this.spreadMult = 1; this.flowBias = 0; this.volMult = 1;
      this.lot = def.depth >= 2000 ? 100 : 1;
      const px = this.prevCloseIdx * this.tick;
      this.roundStep = px < 10 ? 50 : px < 100 ? 100 : 500;
      this.quote(market.start);
    }

    get price() { return this.lastIdx * this.tick; }

    // A news jump: immediate when trading, otherwise added to the reopening auction. Chop anchors move
    // with it so mean reversion doesn't quietly undo the news.
    jump(j) {
      if (!j) return;
      if (this.halted) { this.pendingReopen += j; return; }
      this.lf += j;
      if (this.seg) this.seg.anchor += j;
    }
    get fair() { return Math.exp(this.lf); }

    newSegment(t) {
      const r = this.rng, d = this.def;
      const ov = this.regime && this.regime.until > t ? this.regime : null;
      let type;
      if (ov && ov.type === 'chop') type = 'chop';
      else if (ov && ov.type === 'chopDay') type = r.chance(0.85) ? 'chop' : 'pause';
      else if (ov && ov.type === 'trendDay') type = r.chance(0.8) ? 'trend' : 'pause';
      else type = r.weighted(['trend', 'chop', 'pause'], [0.42, 0.4, 0.18]);
      let dur = clamp(r.exp(1500), 300, 5400);
      if (ov && ov.type === 'chop') dur = Math.max(60, ov.until - t);
      const seg = { type, until: t + dur, drift: 0, kappa: 0, anchor: this.lf };
      if (type === 'trend') {
        let dir = this.dayDir && r.chance(0.72) ? this.dayDir : r.sign();
        if (ov && ov.type === 'trendDay' && ov.dir) dir = r.chance(0.85) ? ov.dir : -ov.dir;
        const strength = r.range(1.0, 2.4);
        seg.drift = (dir * strength * d.vol * this.m.volScale * Math.sqrt(dur / DAY)) / dur;
      } else if (type === 'chop') {
        seg.kappa = (ov && ov.kappa) || r.range(0.0012, 0.003);
      } else seg.kappa = 0.0006;
      this.seg = seg;
    }

    // Recompute the synthetic best bid/ask around fair value plus temporary impact.
    quote() {
      const c = Math.exp(this.lf) / this.tick + this.temp;
      const spread = Math.max(1, Math.round(this.def.spread * this.spreadMult * (0.8 + 0.25 * Math.exp(this.lv) * this.volMult)));
      this.sBid = Math.floor(c - (spread - 1) / 2);
      this.sAsk = this.sBid + spread;
      if (this.sBid < 1) { this.sBid = 1; this.sAsk = 1 + spread; }
      return c;
    }

    // Synthetic shares at a level. side +1 = ask book, −1 = bid book.
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
      if (idx % this.roundStep === 0) mult *= 2.4;           // round numbers attract size
      const profile = 0.55 + 0.5 * Math.min(1, dist / 5) + 0.025 * dist;
      let size = this.def.depth * this.depthMult * profile * mult;
      const dep = (side > 0 ? this.askDep : this.bidDep).get(idx);
      if (dep) size -= dep;
      if (size <= 0) return 0;
      return this.lot > 1 ? Math.floor(size / this.lot) * this.lot : Math.floor(size);
    }

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
      const book = side > 0 ? 1 : -1;          // buyer takes the ask book (+1); seller takes the bid book (−1)
      let best = this.synthBest(book, t);
      for (const o of this.resting) {
        if (o.pid === excludePid) continue;
        if (book > 0 && o.side < 0 && (best === null || o.limitIdx < best)) best = o.limitIdx;
        if (book < 0 && o.side > 0 && (best === null || o.limitIdx > best)) best = o.limitIdx;
      }
      return best;
    }
    // Best bid/ask including players' orders (what the ladder and the quote show).
    bestBid(t) { return this.bestAgainst(-1, t, null); }
    bestAsk(t) { return this.bestAgainst(1, t, null); }

    // Walk the book as an aggressor. side +1 buys from asks, −1 sells into bids. Returns {fills:[{idx,qty,cp}], remaining}.
    walk(side, qty, limitIdx, pid, noise, t) {
      const book = side;                      // +1 → consume ask book
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
          depMap.set(idx, (depMap.get(idx) || 0) + usedSynth * (noise ? 0.3 : 1));
        }
        if (levelQty > 0) this.print(t, idx, levelQty, side, (pid ? 1 : 0) | (playerHit ? 2 : 0));
        this.resting = this.resting.filter((o) => o.filled < o.qty && o.status === 'working');
        // Never revisit a level within one walk: move outward to the next level with size.
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
      // Aggressive player flow moves the quote (temporary) and fair value (permanent).
      if (pid && qty - remaining > 0) this.impact(side, qty - remaining);
      else if (noise && qty > this.def.depth * 3) this.impact(side, (qty - remaining) * 0.5);
      return { fills, remaining };
    }

    impact(side, filled) {
      const levels = filled / (this.def.depth * this.depthMult);
      this.temp += side * Math.min(levels * 0.45, 25);
      const perm = side * 0.3 * levels * this.tick;
      const fv = Math.exp(this.lf);
      this.lf = Math.log(Math.max(this.tick * 5, fv + perm));
    }

    print(t, idx, qty, side, flags) {
      if (qty <= 0) return;
      this.prints.push([Math.round(t * 10) / 10, idx, qty, side, flags || 0]);
      if (this.prints.length > 600) this.prints.splice(0, this.prints.length - 600);
      this.lastIdx = idx;
      if (this.openIdx === null) this.openIdx = idx;
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
    }

    noteBig(t, idx, qty, side) {
      this.big.push([Math.round(t * 10) / 10, idx, qty, side]);
      if (this.big.length > 3000) { this.big.splice(0, 1000); this.bigSent = Math.max(0, this.bigSent - 1000); }
    }

    barAt(t) {
      const bi = Math.max(0, Math.floor((t - this.m.start) / BAR_SEC));
      while (this.bars.length <= bi) {
        // Before the opening print, empty bars sit at fair value (not yesterday's close).
        const c = this.openIdx === null ? Math.max(1, Math.round(Math.exp(this.lf) / this.tick)) : this.lastIdx;
        this.bars.push([c, c, c, c, 0, 0]);
      }
      if (bi < this.dirtyFrom) this.dirtyFrom = bi;
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

    applyEffects(t) {
      let volMult = 1, depthMult = 1, flow = 0, drift = 0, spread = 1;
      if (this.effects.length) {
        this.effects = this.effects.filter((e) => e.until > t);
        for (const e of this.effects) {
          const left = clamp((e.until - t) / e.dur, 0, 1);
          if (e.kind === 'drift') drift += e.rate;
          else if (e.kind === 'vol') volMult *= 1 + (e.mult - 1) * Math.min(1, left * 1.5);
          else if (e.kind === 'depth') { depthMult *= e.mult; spread *= e.mult < 0.5 ? 2 : 1; }
          else if (e.kind === 'flow') flow += e.bias * Math.min(1, left * 2);
        }
      }
      this.volMult = volMult; this.depthMult = depthMult; this.flowBias = flow; this.spreadMult = spread;
      return drift;
    }

    substep(t, dt, fx) {
      const d = this.def, r = this.rng, m = this.m;
      this.subHi = null; this.subLo = null;
      const drift = this.applyEffects(t);
      if (!this.seg || t >= this.seg.until) this.newSegment(t);
      const act = activity(t);
      this.lv += (-this.lv * dt) / 900 + 0.35 * Math.sqrt(dt / 900) * r.normal();
      this.lv = clamp(this.lv, -1, 1.4);
      const volState = Math.exp(this.lv) * this.volMult * m.volScale;
      const sigma = d.vol * Math.sqrt(dt / DAY) * Math.sqrt(act) * volState * (this.halted ? 1.3 : 1);
      let dl = (d.beta || 0) * fx.MKT + (d.oil || 0) * fx.OIL + (d.rates || 0) * fx.RATES + sigma * r.normal();
      dl += (this.seg.drift + drift) * dt;
      this.seg.anchor += drift * dt;
      if (this.seg.kappa) dl -= this.seg.kappa * (this.lf - this.seg.anchor) * dt;
      if (r.chance((dt / 2400) * act)) dl += r.normal() * d.vol * 0.3;
      this.lf += dl;
      if (this.lf < Math.log(this.tick * 10)) this.lf = Math.log(this.tick * 10);

      if (this.halted) {
        if (t >= this.haltUntil) this.reopen(t);
        else { this.barAt(t); return; }
      }
      if (t >= m.end) { this.barAt(Math.min(t, m.end - 0.001)); return; }

      // Refill taken liquidity and let temporary impact fade.
      const refill = Math.exp(-dt / 30);
      for (const map of [this.askDep, this.bidDep]) {
        for (const [k, v] of map) { const nv = v * refill; if (nv < 1) map.delete(k); else map.set(k, nv); }
      }
      this.temp *= Math.exp(-dt / 45);
      const c = this.quote();
      for (const k of this.askDep.keys()) if (k < this.sAsk) this.askDep.delete(k);
      for (const k of this.bidDep.keys()) if (k > this.sBid) this.bidDep.delete(k);
      // Queue ahead can only shrink (orders ahead cancel) when the level itself shrinks.
      for (const o of this.resting) {
        const sz = this.levelSize(o.side > 0 ? -1 : 1, o.limitIdx, t);
        if (o.queueAhead > sz) o.queueAhead = sz;
      }
      this.crossResting(t);

      // Background prints.
      const mom = this.cPrev === null ? 0 : clamp((c - this.cPrev) / Math.max(0.25, sigma * Math.exp(this.lf) / this.tick), -2.5, 2.5);
      this.cPrev = c;
      // Order flow leans with the recent move, so volume delta and CVD track price like a real tape.
      this.momEma = (this.momEma || 0) * 0.85 + mom * 0.15;
      const rate = d.printRate * act * (0.55 + 0.45 * volState) * m.flowScale * (1 + Math.abs(this.flowBias) * 2);
      const n = r.poisson(rate * dt);
      const sizeMult = 1 / m.flowScale;
      const pBuy = clamp(0.5 + 0.12 * mom + 0.3 * this.momEma + this.flowBias, 0.06, 0.94);
      for (let i = 0; i < n; i++) {
        const side = r.chance(pBuy) ? 1 : -1;
        let size = r.lognormal(d.printSize * sizeMult, 0.85);
        if (r.chance(0.012)) size *= r.range(4, 12);
        size = size >= 100 ? Math.round(size / 100) * 100 : Math.max(1, Math.round(size));
        const pt = t - dt + ((i + r.float()) / n) * dt;
        this.walk(side, size, null, null, true, pt);
      }
      this.barAt(t);
      m.afterSubstep(this, t);
      if (d.halts) this.checkLuld(t);
    }

    checkLuld(t) {
      if (t - this.lastRefT >= 10) {
        this.refSamples.push([t, this.lastIdx]);
        this.lastRefT = t;
        while (this.refSamples.length && this.refSamples[0][0] < t - 300) this.refSamples.shift();
      }
      if (!this.refSamples.length || t - this.m.start < 30) return;
      let s = 0;
      for (const x of this.refSamples) s += x[1];
      const ref = s / this.refSamples.length;
      const price = ref * this.tick;
      let band = price >= 3 ? 0.1 : 0.2;
      if (t < RTH_OPEN + 900 || t > RTH_CLOSE - 1500) band *= 2;
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
      this.lf += this.pendingReopen;
      if (this.seg) this.seg.anchor += this.pendingReopen;
      this.pendingReopen = 0;
      this.halted = false;
      if (this.halts.length) this.halts[this.halts.length - 1][1] = t;
      this.askDep.clear(); this.bidDep.clear(); this.temp = 0;
      this.quote();
      const auc = Math.max(1, Math.round(Math.exp(this.lf) / this.tick));
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
      let a = this.bestAsk(t), b = this.bestBid(t);
      if (a !== null) {
        for (let i = 0, idx = a; i < n; i++, idx++) {
          const sz = this.levelSize(1, idx, t) + (add.get(-1 * 1e9 + idx) || 0);
          asks.push([idx, sz]);
        }
      }
      if (b !== null) {
        for (let i = 0, idx = b; i < n && idx > 0; i++, idx--) {
          const sz = this.levelSize(-1, idx, t) + (add.get(1e9 + idx) || 0);
          bids.push([idx, sz]);
        }
      }
      return { b: bids, a: asks };
    }

    vwap() { return this.volume > 0 ? this.pv / this.volume : this.lastIdx * this.tick; }

    snapshot(t) {
      const d = this.def;
      return {
        sym: d.sym, name: d.name, sector: d.sector, cap: d.cap, float: d.float, desc: d.desc, halts: !!d.halts, htb: !!d.htb,
        borrowFee: d.borrowFee || 0, shortInterest: d.shortInterest || 0,
        tick: this.tick, prev: this.prevCloseIdx, open: this.openIdx, bars: this.bars.map((b) => [b[0], b[1], b[2], b[3], b[4], Math.round(b[5])]),
        last: this.lastIdx, bid: this.bestBid(t), ask: this.bestAsk(t), hi: this.hiIdx, lo: this.loIdx,
        vol: this.volume, pv: Math.round(this.pv), halted: this.halted, haltUntil: this.haltUntil, haltReason: this.haltReason,
        haltList: this.halts.map((h) => h.slice()), noLocate: this.noLocate, big: this.big.slice(-1500), bigThreshold: this.bigThreshold
      };
    }

    // What changed since the last delta: quote, stats and the bars from the first dirty one.
    delta(t) {
      const from = Math.min(this.dirtyFrom, Math.max(0, this.bars.length - 1));
      const big = this.big.length > this.bigSent ? this.big.slice(this.bigSent) : null;
      this.bigSent = this.big.length;
      const out = [this.lastIdx, this.bestBid(t), this.bestAsk(t), this.volume, Math.round(this.pv), this.halted ? 1 : 0, from, this.bars.slice(from).map((b) => [b[0], b[1], b[2], b[3], b[4], Math.round(b[5])]), this.hiIdx, this.loIdx, this.openIdx, big];
      this.dirtyFrom = Math.max(0, this.bars.length - 1);
      return out;
    }
  }

  // ---------- the market ----------
  class MarketSim {
    // opts: {seed, symbols, start, end, speed, volatility, events, scenario}
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
      this.factors = {
        MKT: new Factor('MKT', 0.0085, this.rng.fork('MKT')),
        OIL: new Factor('OIL', 0.016, this.rng.fork('OIL')),
        RATES: new Factor('RATES', 0.009, this.rng.fork('RATES'))
      };
      this.syms = {};
      this.list = [];
      for (const s of opts.symbols) {
        const def = SYMBOLS[s];
        if (!def) continue;
        const sim = new SymbolSim(this, def, this.rng.fork(s));
        this.syms[s] = sim;
        this.list.push(sim);
      }
      this.news = [];
      this.newsSeq = 0;
      this.tags = {};
      this.hooks = { restingFill: null, afterSubstep: null, halt: null, news: null };
      this.eventsLevel = scen ? 'off' : (opts.events || 'normal');
      // Headlines per real minute, converted into a rate per market second.
      const perMin = { off: 0, calm: 0.25, normal: 0.55, chaos: 1.3 }[this.eventsLevel] || 0;
      this.newsRate = perMin / (60 * this.speed);
      this.newsRng = this.rng.fork('news');
      this.nextNewsT = this.newsRate > 0 ? this.start + Math.max(60, this.newsRng.exp(1 / this.newsRate)) : Infinity;
      this.schedule = [];
      if (scen) this.resolveScenario(scen);
      this.closed = false;
      // Opening gaps: events at or before the open are applied now so the first print is the gapped open.
      this.runSchedule(this.start);
      for (const s of this.list) {
        if (!scen) s.lf += s.rng.normal() * s.def.vol * 0.5;
        s.quote(this.start);
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
      this.schedule.sort((a, b) => a.at - b.at);
    }

    runSchedule(t) {
      while (this.schedule.length && this.schedule[0].at <= t) {
        const s = this.schedule.shift();
        this.applyEvent(s.ev, s.r, t);
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
        if (tg instanceof Factor) {
          if (jump) tg.pendingJump = (tg.pendingJump || 0) + jump;
          if (ev.drift) { const mv = this.range(ev.drift.move, r) * sign; tg.effects.push({ kind: 'drift', rate: Math.log(1 + mv) / ev.drift.dur, until: t + ev.drift.dur, dur: ev.drift.dur }); }
          if (ev.vol) tg.effects.push({ kind: 'vol', mult: ev.vol.mult, until: t + ev.vol.dur, dur: ev.vol.dur });
          if (ev.vol && tg.name === 'MKT') for (const s of this.list) s.effects.push({ kind: 'vol', mult: 1 + (ev.vol.mult - 1) * 0.6, until: t + ev.vol.dur, dur: ev.vol.dur });
          continue;
        }
        const s = tg;
        if (ev.halt) s.startHalt(t, ev.halt, 'Halted: news pending', 0);
        if (ev.reopenJump !== undefined) s.jump(this.range(ev.reopenJump, r) * sign);
        if (jump) s.jump(jump);
        if (ev.drift) { const mv = this.range(ev.drift.move, r) * sign; s.effects.push({ kind: 'drift', rate: Math.log(Math.max(0.05, 1 + mv)) / ev.drift.dur, until: t + ev.drift.dur, dur: ev.drift.dur }); }
        if (ev.vol) s.effects.push({ kind: 'vol', mult: ev.vol.mult, until: t + ev.vol.dur, dur: ev.vol.dur });
        if (ev.depth) s.effects.push({ kind: 'depth', mult: ev.depth.mult, until: t + ev.depth.dur, dur: ev.depth.dur });
        if (ev.flow) s.effects.push({ kind: 'flow', bias: ev.flow.bias * sign, until: t + ev.flow.dur, dur: ev.flow.dur });
        if (ev.noLocate !== undefined) s.noLocate = !!ev.noLocate;
        if (ev.regime) {
          const dir = ev.regime.type === 'trendDay' ? (this.tags.trendDir || s.dayDir || 1) : 0;
          s.regime = { type: ev.regime.type, until: t + ev.regime.dur, kappa: ev.regime.kappa, dir };
          s.seg = null;
        }
      }
      if (ev.regime && ev.regime.type === 'trendDay') {
        const f = this.factors.MKT;
        f.dayDir = this.tags.trendDir || 1;
      }
      if (ev.headline) {
        const one = targets.length === 1 && !(targets[0] instanceof Factor) ? targets[0] : null;
        this.pushNews(t, one ? one.sym : null, ev.headline.text, ev.headline.tone, !!ev.headline.big);
      }
    }

    targetsFor(target) {
      if (!target || target === '*') return this.list.slice();
      if (this.factors[target]) return [this.factors[target]];
      return this.syms[target] ? [this.syms[target]] : [];
    }

    pushNews(t, sym, text, tone, big) {
      const s = sym ? this.syms[sym] : null;
      const txt = text.replace(/\{sym\}/g, s ? s.sym : '').replace(/\{name\}/g, s ? s.def.name : '');
      const n = { id: ++this.newsSeq, t, sym, text: txt, tone: tone || 0, big: !!big };
      this.news.push(n);
      if (this.hooks.news) this.hooks.news(n);
      return n;
    }

    // Random headline for normal games.
    randomNews(t) {
      const r = this.newsRng;
      const has = (fn) => this.list.some(fn);
      const ok = (tpl) => {
        switch (tpl.kind) {
          case 'mkt': return true;
          case 'any': return this.list.length > 0;
          case 'large': return has((s) => !s.def.halts && s.def.sector !== 'Index' && s.def.sector !== 'Commodity');
          case 'small': return has((s) => s.def.halts);
          case 'bio': return has((s) => s.def.sector === 'Biotech');
          case 'oil': return has((s) => s.def.oil);
          case 'fin': return has((s) => s.def.rates);
          default: return false;
        }
      };
      const pool = NEWS.filter(ok);
      if (!pool.length) return;
      const tpl = r.weighted(pool, pool.map((p) => p.w));
      if (tpl.target) {
        const f = this.factors[tpl.target];
        const j = r.range(tpl.abs[0], tpl.abs[1]);
        f.pendingJump = (f.pendingJump || 0) + j;
        const dur = r.range(900, 2400);
        f.effects.push({ kind: 'drift', rate: r.range(tpl.drift[0], tpl.drift[1]) / dur, until: t + dur, dur });
        if (tpl.rates) this.factors.RATES.pendingJump = (this.factors.RATES.pendingJump || 0) + tpl.rates;
        if (tpl.oilAlso) this.factors.OIL.pendingJump = (this.factors.OIL.pendingJump || 0) + tpl.oilAlso;
        this.pushNews(t, null, tpl.text, tpl.tone, Math.abs(j) > 0.005);
        return;
      }
      const cands = this.list.filter((s) => {
        switch (tpl.kind) {
          case 'large': return !s.def.halts && s.def.sector !== 'Index' && s.def.sector !== 'Commodity';
          case 'small': return s.def.halts;
          case 'bio': return s.def.sector === 'Biotech';
          case 'fin': return !!s.def.rates;
          default: return s.def.sector !== 'Index' && s.def.sector !== 'Commodity';
        }
      });
      if (!cands.length) return;
      const s = r.pick(cands);
      const v = s.def.vol * this.volScale;
      const jump = r.range(tpl.sig[0], tpl.sig[1]) * v;
      const dur = r.range(600, 1800);
      const mv = r.range(tpl.drift[0], tpl.drift[1]) * v;
      if (tpl.halt && s.def.halts && Math.abs(jump) > 0.06 && !s.halted) {
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
        const fx = {};
        for (const k in this.factors) fx[k] = this.factors[k].step(t, sub, this.volScale);
        for (const s of this.list) s.substep(t, sub, fx);
        if (t >= this.end) { this.closed = true; break; }
      }
      return !this.closed;
    }

    snapshot() {
      const syms = {};
      for (const s of this.list) syms[s.sym] = s.snapshot(this.t);
      return { t: this.t, start: this.start, end: this.end, speed: this.speed, syms, news: this.news.slice(-60) };
    }
  }

  DTA.activity = activity;
  DTA.MarketSim = MarketSim;
})();
