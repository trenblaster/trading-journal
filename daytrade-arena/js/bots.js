// Day Trade Arena: AI traders. They run on the host and trade through the same engine as people, so they
// pay the same spreads, commissions and borrow, and their orders move the same book. Difficulty changes
// reaction time, how much of the account they risk per trade, and how many signals they skip.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const { ind, BOT_QUIPS, BAR_SEC, clamp } = DTA;

  const LEVELS = {
    easy: { react: [1800, 3600], risk: 0.004, skip: 0.45, flip: 0.35 },
    normal: { react: [800, 1800], risk: 0.007, skip: 0.2, flip: 0.18 },
    hard: { react: [350, 900], risk: 0.01, skip: 0.05, flip: 0.08 }
  };

  // Last n timeframe bars, aligned to timeframe boundaries.
  function recentBars(sim, tfSec, n) {
    const k = Math.max(1, Math.round(tfSec / BAR_SEC));
    const base = sim.bars;
    let from = Math.max(0, base.length - n * k);
    from -= from % k;
    const out = [];
    for (let i = from; i < base.length; i += k) {
      const end = Math.min(base.length, i + k);
      let o = base[i][0], h = base[i][1], l = base[i][2], c = base[i][3], v = base[i][4];
      for (let j = i + 1; j < end; j++) { const b = base[j]; if (b[1] > h) h = b[1]; if (b[2] < l) l = b[2]; c = b[3]; v += b[4]; }
      out.push({ o: o * sim.tick, h: h * sim.tick, l: l * sim.tick, c: c * sim.tick, v });
    }
    return out;
  }

  class Bot {
    // ctx: {market, engine, tfSec, say(pid, text)}
    constructor(ctx, pid, persona, level, rng) {
      this.ctx = ctx; this.pid = pid; this.p = persona; this.style = persona.style;
      this.L = LEVELS[level] || LEVELS.normal;
      this.rng = rng;
      this.next = 0;
      this.mem = {};
      this.pendingNews = [];
      this.lastSay = -1e9;
      this.seenFills = 0;
      this.startedAt = null;
      this.focus = null;
    }

    setContext(ctx) { this.ctx = ctx; this.mem = {}; this.pendingNews = []; this.seenFills = 0; this.startedAt = null; this.focus = null; }

    get m() { return this.ctx.market; }
    get e() { return this.ctx.engine; }
    acct() { return this.e.acct(this.pid); }
    qty(sym) { const a = this.acct(); const p = a && a.pos[sym]; return p ? p.qty : 0; }
    working(sym) {
      for (const o of this.e.orders.values()) if (o.pid === this.pid && o.sym === sym && (o.status === 'working' || o.status === 'pending')) return true;
      return false;
    }
    workingEntry(sym) {
      for (const o of this.e.orders.values()) if (o.pid === this.pid && o.sym === sym && o.status === 'working' && !o.reduceOnly) return o;
      return null;
    }
    bpLeft() { const a = this.acct(); return this.e.buyingPower(a) - this.e.gross(a) - this.e.pendingIncrease(a); }
    canShort(sim) { return !(sim.def.htb && sim.noLocate); }

    size(sim, stopDist, riskMult = 1) {
      const a = this.acct();
      const eq = this.e.equity(a);
      const px = sim.lastIdx * sim.tick;
      let shares = (eq * this.L.risk * riskMult) / Math.max(stopDist, sim.tick * 3);
      shares = Math.min(shares, (this.bpLeft() * 0.9) / px);
      if (this.e.o.maxShares) shares = Math.min(shares, this.e.o.maxShares * 0.8);
      if (sim.def.htb && sim.def.maxShort) shares = Math.min(shares, sim.def.maxShort * 0.8);
      shares = px < 20 && shares > 300 ? Math.floor(shares / 100) * 100 : Math.floor(shares / 10) * 10;
      return Math.max(0, shares);
    }

    place(req) { return this.e.place(this.pid, req, true); }

    say(kind) {
      const now = this.ctx.now || 0;
      if (now - this.lastSay < 25000 || this.rng.float() > 0.35) return;
      const list = BOT_QUIPS[kind];
      if (!list) return;
      this.lastSay = now;
      this.ctx.say(this.pid, this.rng.pick(list));
    }

    think(now) {
      this.ctx.now = now;
      if (now < this.next) return;
      this.next = now + this.rng.range(this.L.react[0], this.L.react[1]);
      const a = this.acct();
      if (!a || a.frozen || !this.e.tradingOpen || this.m.closed) return;
      if (this.startedAt === null) { this.startedAt = now; this.say('start'); }
      // Talk about closed trades.
      if (a.fills.length > this.seenFills) {
        for (let i = this.seenFills; i < a.fills.length; i++) {
          const f = a.fills[i];
          if (f.realized > a.start * 0.004) this.say('win');
          else if (f.realized < -a.start * 0.004) this.say('loss');
        }
        this.seenFills = a.fills.length;
      }
      try {
        if (this.ctx.needTrade && this.ctx.needTrade(this.pid)) this.forcedTrade();
        else this[this.style] ? this[this.style](now) : this.momentum(now);
      } catch (err) {
        if (typeof console !== 'undefined') console.warn('[bot]', this.p.name, err);
      }
    }

    candidates() { return this.m.list.filter((s) => !s.halted); }
    // Signals use completed candles only (the forming one has partial volume and range); px is live.
    ctxFor(sim, n = 40) {
      const all = recentBars(sim, this.ctx.tfSec, n + 1);
      const bars = all.slice(0, -1);
      if (bars.length < 8) return null;
      const cl = bars.map((b) => b.c);
      const at = ind.atr(bars, 14);
      const i = bars.length - 1;
      return { bars, cl, i, last: bars[i], forming: all[all.length - 1], atr: Math.max(at[i] || 0, sim.tick * 3), vwap: sim.vwap(), px: sim.lastIdx * sim.tick };
    }
    skip() { return this.rng.float() < this.L.skip; }

    // --- Momo Mike: breakout of the last 20 bars on volume, above VWAP; trails the stop.
    momentum() {
      let best = null;
      for (const sim of this.candidates()) {
        const q = this.qty(sim.sym);
        const c = this.ctxFor(sim, 30);
        if (!c || c.bars.length < 12) continue;
        if (q !== 0) { this.trail(sim, c, 4); continue; }
        if (this.working(sim.sym)) continue;
        const look = Math.min(20, c.i);
        const dc = ind.donchian(c.bars, look, c.i);
        let volAvg = 0; for (let j = c.i - look; j < c.i; j++) volAvg += c.bars[j].v; volAvg /= look;
        const hot = c.last.v > 1.2 * volAvg;
        if (hot && c.last.c > dc.hi && c.last.c > c.vwap) { const sc = (c.last.c - dc.hi) / c.atr; if (!best || sc > best.sc) best = { sim, c, side: 1, sc }; }
        if (hot && c.last.c < dc.lo && c.last.c < c.vwap && this.canShort(sim)) { const sc = (dc.lo - c.last.c) / c.atr; if (!best || sc > best.sc) best = { sim, c, side: -1, sc }; }
      }
      if (!best || this.skip()) return;
      const { sim, c, side } = best;
      const stop = c.px - side * 1.5 * c.atr;
      const qty = this.size(sim, 1.5 * c.atr);
      if (qty > 0) this.place({ sym: sim.sym, side, type: 'MKT', qty, sl: stop });
    }

    // Knockout: a round with no trades ranks last, so late in a quiet round take a small with-trend trade.
    forcedTrade() {
      const list = this.candidates().filter((s) => !this.working(s.sym));
      if (!list.length) return;
      const sim = list.reduce((a, b) => (b.volume > a.volume ? b : a));
      if (this.qty(sim.sym) !== 0) return;
      const c = this.ctxFor(sim, 12);
      if (!c) return;
      let side = Math.sign(c.px - c.cl[Math.max(0, c.i - 3)]) || 1;
      if (side < 0 && !this.canShort(sim)) side = 1;
      const qty = this.size(sim, 1.2 * c.atr, 0.5);
      if (qty > 0) this.place({ sym: sim.sym, side, type: 'MKT', qty, sl: c.px - side * 1.2 * c.atr, tp: c.px + side * 1.6 * c.atr });
    }

    // Move a bracket stop behind the last few bars.
    trail(sim, c, look) {
      const q = this.qty(sim.sym);
      if (!q) return;
      let sl = null;
      for (const o of this.e.orders.values()) if (o.pid === this.pid && o.sym === sim.sym && o.status === 'working' && (o.type === 'STP') && o.side === -Math.sign(q)) sl = o;
      const lows = c.bars.slice(-look);
      const tick = sim.tick;
      if (!sl) {
        const idx = q > 0 ? Math.min(...lows.map((b) => b.l)) - 0.3 * c.atr : Math.max(...lows.map((b) => b.h)) + 0.3 * c.atr;
        this.place({ sym: sim.sym, side: -Math.sign(q), type: 'STP', qty: Math.abs(q), stop: idx, reduceOnly: true, tag: 'SL' });
        return;
      }
      if (q > 0) {
        const want = Math.min(...lows.map((b) => b.l)) - 0.2 * c.atr;
        if (want / tick > sl.stopIdx + 1 && want < c.px - tick) this.e.modify(this.pid, sl.id, want);
      } else {
        const want = Math.max(...lows.map((b) => b.h)) + 0.2 * c.atr;
        if (want / tick < sl.stopIdx - 1 && want > c.px + tick) this.e.modify(this.pid, sl.id, want);
      }
    }

    // --- Reversion Rita: fades closes outside the Bollinger bands with RSI stretched, targets the middle band.
    meanrev() {
      for (const sim of this.candidates()) {
        const q = this.qty(sim.sym);
        const c = this.ctxFor(sim, 40);
        if (!c || c.bars.length < 14) continue;
        const mem = this.mem[sim.sym] || (this.mem[sim.sym] = {});
        if (q !== 0) {
          mem.held = (mem.held || 0) + 1;
          if (mem.held > 14) { this.e.flatten(this.pid, sim.sym); mem.held = 0; }
          continue;
        }
        mem.held = 0;
        if (this.working(sim.sym)) { const w = this.workingEntry(sim.sym); if (w && this.m.t - w.created > this.ctx.tfSec * 3) this.e.cancel(this.pid, w.id); continue; }
        const bb = ind.bollinger(c.cl, Math.min(20, c.bars.length - 1), 2), r = ind.rsi(c.cl, Math.min(14, c.bars.length - 2));
        const i = c.i;
        if (this.skip()) continue;
        if (c.last.c > bb.up[i] && r[i] > 70 && this.canShort(sim)) {
          const sl = c.last.h + 0.6 * c.atr, tp = bb.mid[i];
          const qty = this.size(sim, sl - c.px);
          if (qty > 0 && tp < c.px - sim.tick) this.place({ sym: sim.sym, side: -1, type: 'MKT', qty, tp, sl });
          return;
        }
        if (c.last.c < bb.lo[i] && r[i] < 30) {
          const sl = c.last.l - 0.6 * c.atr, tp = bb.mid[i];
          const qty = this.size(sim, c.px - sl);
          if (qty > 0 && tp > c.px + sim.tick) this.place({ sym: sim.sym, side: 1, type: 'MKT', qty, tp, sl });
          return;
        }
      }
    }

    // --- Scalper Sam: joins the bid (or offer) when the book leans his way, a few ticks of target.
    scalper(now) {
      const list = this.candidates();
      if (!list.length) return;
      if (!this.focus || !this.m.syms[this.focus] || this.rng.float() < 0.01) {
        const liquid = list.filter((s) => s.def.depth >= 1500) ;
        this.focus = this.rng.pick(liquid.length ? liquid : list).sym;
      }
      const sim = this.m.syms[this.focus];
      if (!sim || sim.halted) return;
      const q = this.qty(sim.sym);
      const w = this.workingEntry(sim.sym);
      if (w) { if (now - (w.botPlaced || now) > 4000 || !w.botPlaced) { if (w.botPlaced) this.e.cancel(this.pid, w.id); else w.botPlaced = now; } return; }
      if (q !== 0) return;
      const c = this.ctxFor(sim, 20) || { px: sim.lastIdx * sim.tick, cl: [sim.lastIdx * sim.tick], i: 0, atr: sim.tick * 8 };
      const book = sim.book(this.m.t, 5);
      const bs = book.b.reduce((x, l) => x + l[1], 0), as = book.a.reduce((x, l) => x + l[1], 0);
      if (!bs || !as || !book.b.length || !book.a.length) return;
      const e9 = c.cl.length > 3 ? ind.ema(c.cl, 9)[c.i] : c.px;
      const tgt = Math.max(4 * sim.tick, 0.2 * c.atr), stp = Math.max(5 * sim.tick, 0.28 * c.atr);
      if (this.skip()) return;
      if (bs > 1.35 * as && c.px >= e9) {
        const px = book.b[0][0] * sim.tick;
        const qty = this.size(sim, stp, 0.7);
        if (qty > 0) { const r = this.place({ sym: sim.sym, side: 1, type: 'LMT', qty, px, tp: px + tgt, sl: px - stp }); if (r.ok) this.e.orders.get(r.id).botPlaced = now; }
      } else if (as > 1.35 * bs && c.px <= e9 && this.canShort(sim)) {
        const px = book.a[0][0] * sim.tick;
        const qty = this.size(sim, stp, 0.7);
        if (qty > 0) { const r = this.place({ sym: sim.sym, side: -1, type: 'LMT', qty, px, tp: px - tgt, sl: px + stp }); if (r.ok) this.e.orders.get(r.id).botPlaced = now; }
      }
    }

    // --- VWAP Val: with-trend pullbacks to VWAP.
    vwap() {
      for (const sim of this.candidates()) {
        const q = this.qty(sim.sym);
        const c = this.ctxFor(sim, 40);
        if (!c || c.bars.length < 10) continue;
        if (q !== 0 || this.working(sim.sym)) {
          const w = this.workingEntry(sim.sym);
          if (w && this.m.t - w.created > this.ctx.tfSec * 4) this.e.cancel(this.pid, w.id);
          continue;
        }
        const e20 = ind.ema(c.cl, 20);
        const rising = e20[c.i] > e20[c.i - 5], falling = e20[c.i] < e20[c.i - 5];
        const hi = Math.max(...c.bars.slice(-15).map((b) => b.h)), lo = Math.min(...c.bars.slice(-15).map((b) => b.l));
        if (this.skip()) continue;
        if (rising && c.px > c.vwap && c.last.l <= c.vwap + 0.3 * c.atr) {
          const entry = Math.max(c.vwap, c.px - 0.2 * c.atr), sl = c.vwap - 0.7 * c.atr;
          let tp = hi > entry + 0.8 * c.atr ? hi : entry + 1.5 * c.atr;
          const qty = this.size(sim, entry - sl);
          if (qty > 0) this.place({ sym: sim.sym, side: 1, type: 'LMT', qty, px: entry, tp, sl });
          return;
        }
        if (falling && c.px < c.vwap && c.last.h >= c.vwap - 0.3 * c.atr && this.canShort(sim)) {
          const entry = Math.min(c.vwap, c.px + 0.2 * c.atr), sl = c.vwap + 0.7 * c.atr;
          let tp = lo < entry - 0.8 * c.atr ? lo : entry - 1.5 * c.atr;
          const qty = this.size(sim, sl - entry);
          if (qty > 0 && tp > 0) this.place({ sym: sim.sym, side: -1, type: 'LMT', qty, px: entry, tp, sl });
          return;
        }
      }
    }

    // --- YOLO Yuki: big size, no stop, averages down.
    yolo(now) {
      const a = this.acct();
      const eq = this.e.equity(a);
      const open = Object.keys(a.pos).filter((s) => a.pos[s].qty);
      if (open.length) {
        const s = open[0];
        const sim = this.m.syms[s];
        const p = a.pos[s];
        const upnl = p.qty * (sim.lastIdx * sim.tick - p.avg);
        if (upnl > eq * 0.035) { this.e.flatten(this.pid, s); this.say('win'); }
        else if (upnl < -eq * 0.05 && !this.mem.added && this.bpLeft() > eq) {
          const px = sim.lastIdx * sim.tick;
          const qty = Math.floor((this.bpLeft() * 0.5) / px / 10) * 10;
          if (qty > 0 && !sim.halted) this.place({ sym: s, side: Math.sign(p.qty), type: 'MKT', qty });
          this.mem.added = true;
        }
        return;
      }
      this.mem.added = false;
      if (!this.mem.wait) this.mem.wait = now + this.rng.range(6000, 25000);
      if (now < this.mem.wait) return;
      this.mem.wait = 0;
      const list = this.candidates();
      if (!list.length) return;
      const sim = this.rng.weighted(list, list.map((s) => s.def.vol));
      let side = this.rng.chance(0.7) ? 1 : -1;
      if (side < 0 && !this.canShort(sim)) side = 1;
      const px = sim.lastIdx * sim.tick;
      let qty = (this.bpLeft() * this.rng.range(0.55, 0.85)) / px;
      if (this.e.o.maxShares) qty = Math.min(qty, this.e.o.maxShares * 0.9);
      if (side < 0 && sim.def.maxShort) qty = Math.min(qty, sim.def.maxShort * 0.9);
      qty = Math.floor(qty / 10) * 10;
      if (qty > 0) this.place({ sym: sim.sym, side, type: 'MKT', qty });
    }

    onNews(n, now) {
      if (this.style !== 'news' || !n.tone) return;
      let sym = n.sym;
      if (!sym) {
        const list = this.m.list.slice().sort((a, b) => (b.def.beta || 0) - (a.def.beta || 0));
        sym = list.length ? list[0].sym : null;
      }
      if (!sym) return;
      this.pendingNews.push({ sym, tone: n.tone, at: now + this.rng.range(this.L.react[0] * 0.3, this.L.react[0] * 0.9) });
      if (this.rng.chance(0.4)) this.say('news');
    }

    // --- Newsy Ned: trades headlines, bracketed.
    news(now) {
      for (const sym of Object.keys(this.mem)) {
        const mem = this.mem[sym];
        if (this.qty(sym) !== 0) { mem.held = (mem.held || 0) + 1; if (mem.held > 20) { this.e.flatten(this.pid, sym); mem.held = 0; } }
      }
      const due = this.pendingNews.filter((p) => p.at <= now);
      this.pendingNews = this.pendingNews.filter((p) => p.at > now);
      for (const p of due) {
        const sim = this.m.syms[p.sym];
        if (!sim || sim.halted || this.qty(p.sym) !== 0 || this.working(p.sym)) continue;
        if (p.tone < 0 && !this.canShort(sim)) continue;
        const c = this.ctxFor(sim, 20);
        if (!c) continue;
        const sl = c.px - p.tone * 1.3 * c.atr, tp = c.px + p.tone * 2.6 * c.atr;
        const qty = this.size(sim, 1.3 * c.atr, 1.2);
        if (qty > 0) { this.place({ sym: p.sym, side: p.tone, type: 'MKT', qty, tp, sl }); this.mem[p.sym] = { held: 0 }; }
      }
    }

    // --- Diamond Dan: buys the strongest stock early, adds once on a dip, never sells.
    diamond() {
      if (this.m.t - this.m.start < 90) return;
      const a = this.acct();
      if (!this.mem.pick) {
        const list = this.candidates().filter((s) => s.def.sector !== 'Index');
        const pool = list.length ? list : this.candidates();
        if (!pool.length) return;
        pool.sort((x, y) => y.lastIdx / y.prevCloseIdx - x.lastIdx / x.prevCloseIdx);
        const sim = pool[0];
        const qty = Math.floor((this.bpLeft() * 0.55) / (sim.lastIdx * sim.tick) / 10) * 10;
        if (qty > 0) { const r = this.place({ sym: sim.sym, side: 1, type: 'MKT', qty }); if (r.ok) this.mem.pick = sim.sym; }
        return;
      }
      const sim = this.m.syms[this.mem.pick];
      if (!this.mem.added && sim && !sim.halted && sim.lastIdx * sim.tick < sim.vwap() * 0.985) {
        const qty = Math.floor((this.bpLeft() * 0.35) / (sim.lastIdx * sim.tick) / 10) * 10;
        if (qty > 0) this.place({ sym: sim.sym, side: 1, type: 'MKT', qty });
        this.mem.added = true;
        if (a) this.ctx.say(this.pid, 'buying the dip 💎🙌');
      }
    }

    // --- Turtle Tom: 20-bar breakout, 2 ATR stop, pyramids up to 3 units, exits on a 10-bar reversal.
    turtle() {
      for (const sim of this.candidates()) {
        const c = this.ctxFor(sim, 30);
        if (!c || c.bars.length < 12) continue;
        const q = this.qty(sim.sym);
        const mem = this.mem[sim.sym] || (this.mem[sim.sym] = { units: 0, last: 0 });
        const dc20 = ind.donchian(c.bars, Math.min(20, c.i), c.i), dc10 = ind.donchian(c.bars, Math.min(10, c.i), c.i);
        if (q === 0) {
          mem.units = 0;
          if (this.working(sim.sym)) this.e.cancelAll(this.pid, sim.sym);
          if (this.skip()) continue;
          let side = 0;
          if (c.last.c > dc20.hi) side = 1; else if (c.last.c < dc20.lo && this.canShort(sim)) side = -1;
          if (!side) continue;
          const qty = this.size(sim, 2 * c.atr, 0.6);
          if (qty <= 0) continue;
          const r = this.place({ sym: sim.sym, side, type: 'MKT', qty });
          if (r.ok) { mem.units = 1; mem.last = c.px; mem.unit = qty; this.place({ sym: sim.sym, side: -side, type: 'STP', qty: 1e6, stop: c.px - side * 2 * c.atr, reduceOnly: true, tag: 'SL' }); }
          return;
        }
        const side = Math.sign(q);
        if ((side > 0 && c.last.c < dc10.lo) || (side < 0 && c.last.c > dc10.hi)) { this.e.flatten(this.pid, sim.sym); continue; }
        if (mem.units < 3 && (c.px - mem.last) * side > 0.5 * c.atr && !this.skip()) {
          const r = this.place({ sym: sim.sym, side, type: 'MKT', qty: mem.unit || this.size(sim, 2 * c.atr, 0.6) });
          if (r.ok) {
            mem.units++; mem.last = c.px;
            for (const o of this.e.orders.values()) if (o.pid === this.pid && o.sym === sim.sym && o.status === 'working' && o.type === 'STP') this.e.modify(this.pid, o.id, c.px - side * 2 * c.atr);
          }
        }
      }
    }

    // Call-It mode: up or down for the next few candles, with 1–3 chips.
    predict(sim, tfSec) {
      const bars = recentBars(sim, tfSec, 40);
      if (bars.length < 6) return { dir: this.rng.sign(), conf: 1 };
      const cl = bars.map((b) => b.c);
      const i = bars.length - 1;
      const trend = Math.sign(cl[i] - cl[Math.max(0, i - 4)]) || 1;
      const r = ind.rsi(cl, 14)[i];
      let dir = trend, conf = 1;
      switch (this.style) {
        case 'meanrev': case 'vwap':
          if (r > 66) { dir = -1; conf = 2; } else if (r < 34) { dir = 1; conf = 2; } else { dir = trend; conf = 1; }
          break;
        case 'scalper': {
          const book = sim.book(this.m.t, 5);
          const bs = book.b.reduce((x, l) => x + l[1], 0), as = book.a.reduce((x, l) => x + l[1], 0);
          dir = bs >= as ? 1 : -1; conf = Math.abs(bs - as) / Math.max(1, bs + as) > 0.2 ? 2 : 1;
          break;
        }
        case 'yolo': dir = this.rng.sign(); conf = 3; break;
        default: {
          const move = Math.abs(cl[i] - cl[Math.max(0, i - 4)]) / (ind.atr(bars, 14)[i] || 1);
          conf = move > 2 ? 3 : move > 1 ? 2 : 1;
        }
      }
      if (this.rng.float() < this.L.flip) dir = -dir;
      return { dir, conf };
    }
  }

  DTA.Bot = Bot;
  DTA.recentBars = recentBars;
})();
