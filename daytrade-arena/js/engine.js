// Day Trade Arena: accounts, orders and risk. Runs only on the host, on top of the market simulator.
//
// Order types: MKT, LMT, STP (stop market), STPLMT (stop limit), TRAIL (trailing stop, market on trigger).
// Any entry can carry a bracket: a take-profit limit and a stop-loss that become live as the entry fills,
// only ever reduce the position, and cancel each other (OCO). Shorts need a locate on hard-to-borrow names
// (a per-share fee, a per-player cap, and none at all during a squeeze). Buying power is equity × leverage;
// when equity falls below maintenance margin the account is liquidated at market, largest position first.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const { COMMISSION, MAINT_MARGIN, MAINT_MARGIN_HTB, clamp, fmtMoney, fmtQty } = DTA;

  const TYPES = ['MKT', 'LMT', 'STP', 'STPLMT', 'TRAIL'];

  class Engine {
    // opts: {startCash, leverage, commissions, maxShares}
    constructor(market, opts) {
      this.m = market;
      this.o = Object.assign({ startCash: 100000, leverage: 4, commissions: true, maxShares: 0 }, opts || {});
      this.accts = new Map();
      this.orders = new Map();
      this.stops = [];
      this.events = [];
      this.pending = [];
      this.seq = 0;
      this.fillSeq = 0;
      this.tsSeq = 0;
      this.tradingOpen = true;
      market.hooks.restingFill = (sim, order, qty, idx, t, aggressor) => this.pending.push([order, qty, idx, t, aggressor]);
      market.hooks.afterSubstep = (sim, t) => this.afterSubstep(sim, t);
    }

    // ---------- accounts ----------
    addAccount(pid, cash) {
      const start = cash || this.o.startCash;
      const a = {
        pid, start, cash: start, pos: {}, realized: 0, comm: 0, fees: 0, fills: [],
        frozen: false, busted: false, marginCalls: 0, eqHist: [], peak: start, maxDD: 0,
        maxGross: 0, dirty: true, orderTimes: []
      };
      this.accts.set(pid, a);
      return a;
    }
    acct(pid) { return this.accts.get(pid); }
    pos(a, sym) { return a.pos[sym] || (a.pos[sym] = { qty: 0, avg: 0, realized: 0, openT: 0 }); }
    mark(sym) { const s = this.m.syms[sym]; return s ? s.lastIdx * s.tick : 0; }
    equity(a) {
      let e = a.cash;
      for (const sym in a.pos) { const p = a.pos[sym]; if (p.qty) e += p.qty * this.mark(sym); }
      return e;
    }
    gross(a) {
      let g = 0;
      for (const sym in a.pos) { const p = a.pos[sym]; if (p.qty) g += Math.abs(p.qty) * this.mark(sym); }
      return g;
    }
    maint(a) {
      let m = 0;
      for (const sym in a.pos) {
        const p = a.pos[sym];
        if (!p.qty) continue;
        const def = this.m.syms[sym].def;
        m += Math.abs(p.qty) * this.mark(sym) * (def.htb ? MAINT_MARGIN_HTB : MAINT_MARGIN);
      }
      return m;
    }
    // Exposure that working orders would add if they all filled (each on its own).
    pendingIncrease(a, exceptId) {
      let inc = 0;
      for (const o of this.orders.values()) {
        if (o.pid !== a.pid || o.id === exceptId || o.reduceOnly) continue;
        if (o.status !== 'working') continue;
        const p = a.pos[o.sym];
        const q = p ? p.qty : 0;
        const left = o.qty - o.filled;
        const more = Math.max(0, Math.abs(q + o.side * left) - Math.abs(q));
        const px = o.limitIdx ? o.limitIdx * this.m.syms[o.sym].tick : o.stopIdx ? o.stopIdx * this.m.syms[o.sym].tick : this.mark(o.sym);
        inc += more * px;
      }
      return inc;
    }
    buyingPower(a) { return Math.max(0, this.equity(a)) * this.o.leverage; }

    emit(ev) { this.events.push(ev); }
    reject(pid, msg, o) {
      this.emit({ k: 'reject', pid, msg, oid: o ? o.id : null });
      return { ok: false, err: msg };
    }

    // ---------- placing orders ----------
    // req: {sym, side (1|-1|'buy'|'sell'), type, qty, px, stop, trail, tp, sl, reduceOnly, tag}
    place(pid, req, internal) {
      const a = this.accts.get(pid);
      if (!a) return { ok: false, err: 'No account' };
      if (a.frozen) return this.reject(pid, a.busted ? 'Account busted: trading disabled' : 'Trading disabled');
      if (!this.tradingOpen || this.m.closed) return this.reject(pid, 'Market is closed');
      const sim = this.m.syms[req && req.sym];
      if (!sim) return this.reject(pid, 'Unknown symbol');
      const side = req.side === 'buy' || req.side === 1 ? 1 : req.side === 'sell' || req.side === -1 ? -1 : 0;
      if (!side) return this.reject(pid, 'Pick buy or sell');
      const type = TYPES.includes(req.type) ? req.type : 'MKT';
      const qty = Math.floor(+req.qty);
      if (!(qty >= 1 && qty <= 5e7)) return this.reject(pid, 'Quantity must be a whole number of shares');
      const tick = sim.tick;
      const toIdx = (v) => (isFinite(+v) && +v > 0 ? Math.round(+v / tick) : null);
      const limitIdx = type === 'LMT' || type === 'STPLMT' ? toIdx(req.px) : null;
      const stopIdx = type === 'STP' || type === 'STPLMT' ? toIdx(req.stop) : null;
      if ((type === 'LMT' || type === 'STPLMT') && !limitIdx) return this.reject(pid, 'Enter a limit price');
      if ((type === 'STP' || type === 'STPLMT') && !stopIdx) return this.reject(pid, 'Enter a stop price');
      let trail = 0;
      if (type === 'TRAIL') {
        trail = Math.round(+req.trail / tick);
        if (!(trail >= 1)) return this.reject(pid, 'Enter a trailing amount');
      }
      const t = this.m.t;
      if (type === 'MKT' && sim.halted) return this.reject(pid, sim.sym + ' is halted. Use a limit order for the reopening auction');

      // Rate limit: 25 orders per real second per player keeps a runaway client from flooding the host.
      if (!internal) {
        const now = Date.now();
        a.orderTimes = a.orderTimes.filter((x) => now - x < 1000);
        if (a.orderTimes.length >= 25) return this.reject(pid, 'Slow down: too many orders');
        a.orderTimes.push(now);
      }

      const p = this.pos(a, sim.sym);
      const reduceOnly = !!req.reduceOnly;
      if (reduceOnly && (p.qty === 0 || Math.sign(p.qty) === side)) return this.reject(pid, 'Nothing to reduce');
      const refPx = limitIdx ? limitIdx * tick : stopIdx ? stopIdx * tick : sim.lastIdx * tick;
      if (!reduceOnly) {
        const risk = this.checkRisk(a, sim, side, qty, refPx);
        if (risk) return this.reject(pid, risk);
      }
      // Self-cross: a limit may not trade through your own resting order on the other side.
      if (limitIdx) {
        for (const o of sim.resting) {
          if (o.pid !== pid || o.side === side) continue;
          if ((side > 0 && limitIdx >= o.limitIdx) || (side < 0 && limitIdx <= o.limitIdx)) return this.reject(pid, 'That would trade against your own ' + (o.side > 0 ? 'bid' : 'offer'));
        }
      }

      const o = {
        id: 'o' + (++this.seq), pid, sym: sim.sym, side, type, qty, filled: 0, limitIdx, stopIdx, trail,
        trailRef: null, status: 'working', ts: t + this.seq * 1e-6, queueAhead: 0, reduceOnly,
        tag: req.tag || null, parent: null, children: null, oco: null, commBilled: 0, notional: 0, avgPx: 0, created: t
      };
      if (type === 'TRAIL') { o.trailRef = sim.lastIdx; o.stopIdx = side < 0 ? sim.lastIdx - trail : sim.lastIdx + trail; }
      this.orders.set(o.id, o);

      // Bracket children (take profit / stop loss), live once the entry fills.
      const tpIdx = toIdx(req.tp), slIdx = toIdx(req.sl);
      if (!reduceOnly && (tpIdx || slIdx)) {
        const refIdx = limitIdx || stopIdx || sim.lastIdx;
        if (tpIdx && (side > 0 ? tpIdx <= refIdx : tpIdx >= refIdx)) { this.orders.delete(o.id); return this.reject(pid, 'Take-profit must be on the profit side of the entry'); }
        if (slIdx && (side > 0 ? slIdx >= refIdx : slIdx <= refIdx)) { this.orders.delete(o.id); return this.reject(pid, 'Stop-loss must be on the loss side of the entry'); }
        o.children = [];
        const mk = (kind, idx) => {
          const c = {
            id: 'o' + (++this.seq), pid, sym: sim.sym, side: -side, type: kind === 'TP' ? 'LMT' : 'STP', qty: 0, filled: 0,
            limitIdx: kind === 'TP' ? idx : null, stopIdx: kind === 'SL' ? idx : null, trail: 0, trailRef: null,
            status: 'pending', ts: t, queueAhead: 0, reduceOnly: true, tag: kind, parent: o.id, children: null, oco: null,
            commBilled: 0, notional: 0, avgPx: 0, created: t
          };
          this.orders.set(c.id, c);
          o.children.push(c.id);
          return c;
        };
        const tp = tpIdx ? mk('TP', tpIdx) : null;
        const sl = slIdx ? mk('SL', slIdx) : null;
        if (tp && sl) { tp.oco = sl.id; sl.oco = tp.id; }
      }

      this.activate(o, t);
      this.drain();
      a.dirty = true;
      return { ok: true, id: o.id };
    }

    checkRisk(a, sim, side, qty, px) {
      const p = a.pos[sim.sym];
      const q = p ? p.qty : 0;
      const nq = q + side * qty;
      const more = Math.max(0, Math.abs(nq) - Math.abs(q));
      if (!more) return null;
      if (this.o.maxShares && Math.abs(nq) > this.o.maxShares) return 'Position limit is ' + fmtQty(this.o.maxShares) + ' shares in this mode';
      if (nq < 0 && Math.abs(nq) > Math.abs(Math.min(0, q))) {
        const def = sim.def;
        if (def.htb && sim.noLocate) return 'No shares available to borrow in ' + sim.sym + ' right now';
        if (def.htb && def.maxShort && Math.abs(nq) > def.maxShort) return 'Locate limit: at most ' + fmtQty(def.maxShort) + ' ' + sim.sym + ' shares short';
      }
      const need = this.gross(a) + this.pendingIncrease(a) + more * px;
      const bp = this.buyingPower(a);
      if (need > bp + 0.01) return 'Not enough buying power: this needs ' + fmtMoney(more * px, 0) + ', you have ' + fmtMoney(Math.max(0, bp - this.gross(a) - this.pendingIncrease(a)), 0) + ' left';
      return null;
    }

    // Send an order to the market (or park it as a stop).
    activate(o, t) {
      const sim = this.m.syms[o.sym];
      o.status = 'working';
      if (o.type === 'STP' || o.type === 'STPLMT' || o.type === 'TRAIL') {
        if (!this.stops.includes(o)) this.stops.push(o);
        return;
      }
      if (o.type === 'MKT') {
        if (sim.halted) { this.cancelOrder(o, 'halted'); return; }
        const res = sim.walk(o.side, o.qty - o.filled, null, o.pid, false, t);
        for (const f of res.fills) this.applyFill(o, f.qty, f.idx, 'T', t, f.cp);
        if (o.filled < o.qty) {
          if (o.filled === 0) this.emit({ k: 'reject', pid: o.pid, msg: 'No liquidity for that market order', oid: o.id });
          this.finish(o, 'cancelled');
        }
        return;
      }
      // LMT: take what's marketable now, rest the remainder.
      if (!sim.halted) {
        const res = sim.walk(o.side, o.qty - o.filled, o.limitIdx, o.pid, false, t);
        for (const f of res.fills) this.applyFill(o, f.qty, f.idx, 'T', t, f.cp);
      }
      if (o.filled < o.qty && o.status === 'working') {
        o.queueAhead = sim.levelSize(o.side > 0 ? -1 : 1, o.limitIdx, t);
        o.ts = t + (++this.tsSeq) * 1e-6;
        sim.resting.push(o);
      }
    }

    // ---------- fills ----------
    commissionFor(o, qty, px) {
      if (!this.o.commissions) return 0;
      const q = o.filled, n = o.notional;
      const target = clamp(q * COMMISSION.perShare, COMMISSION.min, Math.max(COMMISSION.min, n * COMMISSION.maxPct));
      const c = Math.max(0, target - o.commBilled);
      o.commBilled += c;
      return c;
    }

    applyFill(o, qty, idx, liq, t, cp) {
      if (qty <= 0) return;
      const a = this.accts.get(o.pid);
      const sim = this.m.syms[o.sym];
      const px = Math.round(idx * sim.tick * 10000) / 10000;
      const p = this.pos(a, o.sym);
      // Reduce-only children never flip the position.
      if (o.reduceOnly) {
        const room = p.qty !== 0 && Math.sign(p.qty) !== o.side ? Math.abs(p.qty) : 0;
        if (room <= 0) { this.finish(o, 'cancelled'); return; }
        qty = Math.min(qty, room);
      }
      const before = p.qty;
      let realized = 0;
      if (before !== 0 && Math.sign(before) !== o.side) {
        const closeQty = Math.min(qty, Math.abs(before));
        realized = closeQty * (px - p.avg) * Math.sign(before);
      }
      const after = before + o.side * qty;
      if (before === 0 || Math.sign(after) !== Math.sign(before)) {
        p.avg = after !== 0 ? px : 0;
        if (after !== 0) p.openT = t;
      } else if (Math.abs(after) > Math.abs(before)) {
        p.avg = (p.avg * Math.abs(before) + px * qty) / Math.abs(after);
      }
      p.qty = after;
      if (after === 0) p.avg = 0;
      p.realized += realized;
      a.realized += realized;
      a.cash -= o.side * qty * px;
      // Maker and auction fills were already counted on the order by the market as it matched them.
      if (liq === 'T' || liq === 'X' || liq === 'C') o.filled += qty;
      o.notional += qty * px;
      o.avgPx = o.notional / Math.max(1, o.filled);
      const comm = this.commissionFor(o, qty, px);
      a.cash -= comm; a.comm += comm;
      let fee = 0;
      const openedShort = Math.max(0, -after - Math.max(0, -before));
      if (openedShort > 0 && sim.def.htb && sim.def.borrowFee) {
        fee = openedShort * sim.def.borrowFee;
        a.cash -= fee; a.fees += fee;
      }
      const g = this.gross(a);
      if (g > a.maxGross) a.maxGross = g;
      const fill = { id: ++this.fillSeq, t, sym: o.sym, side: o.side, qty, px, liq, oid: o.id, comm, fee, cp: cp || null, tag: o.tag, realized, posAfter: after };
      a.fills.push(fill);
      a.dirty = true;
      this.emit({ k: 'fill', pid: o.pid, fill });
      if (o.filled >= o.qty) this.finish(o, 'filled');
      this.afterFill(o, qty, t);
    }

    afterFill(o, qty, t) {
      // Entry filled → children grow and go live.
      if (o.children) {
        for (const cid of o.children) {
          const c = this.orders.get(cid);
          if (!c || c.status === 'cancelled' || c.status === 'filled') continue;
          c.qty += qty;
          if (c.status === 'pending') this.activate(c, t);
        }
      }
      // A bracket leg filled → shrink or cancel its partner.
      if (o.oco) {
        const s = this.orders.get(o.oco);
        if (s && (s.status === 'working' || s.status === 'pending')) {
          s.qty -= qty;
          if (s.qty - s.filled <= 0 || o.status === 'filled') this.cancelOrder(s, 'oco');
        }
      }
    }

    // Resting fills queued by the market while it was walking the book.
    drain() {
      let guard = 0;
      while (this.pending.length && guard++ < 10000) {
        const [o, qty, idx, t, aggressor] = this.pending.shift();
        // The market already added qty to o.filled; applyFill counts maker fills without adding again.
        const auction = aggressor === 'AUCTION';
        this.applyMakerFill(o, qty, idx, auction ? 'A' : 'M', t, auction ? null : aggressor);
      }
    }
    applyMakerFill(o, qty, idx, liq, t, cp) {
      const a = this.accts.get(o.pid);
      if (!a) return;
      const p = this.pos(a, o.sym);
      if (o.reduceOnly) {
        const room = p.qty !== 0 && Math.sign(p.qty) !== o.side ? Math.abs(p.qty) : 0;
        if (room < qty) {
          // Position already smaller than this leg; count only what reduces it.
          o.filled -= qty - room;
          qty = room;
          if (qty <= 0) { this.finish(o, 'cancelled'); this.m.syms[o.sym].resting = this.m.syms[o.sym].resting.filter((x) => x !== o); return; }
        }
      }
      this.applyFill(o, qty, idx, liq === 'A' ? 'A' : 'M', t, cp);
      if (o.filled >= o.qty && o.status === 'working') this.finish(o, 'filled');
    }

    finish(o, status) {
      if (o.status === 'filled' || o.status === 'cancelled') return;
      o.status = status;
      const sim = this.m.syms[o.sym];
      if (sim) sim.resting = sim.resting.filter((x) => x !== o);
      const i = this.stops.indexOf(o);
      if (i >= 0) this.stops.splice(i, 1);
      const a = this.accts.get(o.pid);
      if (a) a.dirty = true;
    }

    cancelOrder(o, why) {
      if (o.status === 'filled' || o.status === 'cancelled') return false;
      this.finish(o, 'cancelled');
      // Cancelling an entry that never filled also removes its bracket.
      if (o.children && o.filled === 0) for (const cid of o.children) { const c = this.orders.get(cid); if (c) this.cancelOrder(c, 'parent'); }
      if (why === 'user' || why === 'oco') this.emit({ k: 'cancel', pid: o.pid, oid: o.id, why });
      return true;
    }

    cancel(pid, oid) {
      const o = this.orders.get(oid);
      if (!o || o.pid !== pid) return false;
      const ok = this.cancelOrder(o, 'user');
      this.drain();
      return ok;
    }
    cancelAll(pid, sym) {
      let n = 0;
      for (const o of this.orders.values()) {
        if (o.pid !== pid || (sym && o.sym !== sym)) continue;
        if (o.status === 'working' || o.status === 'pending') { this.cancelOrder(o, 'all'); n++; }
      }
      const a = this.accts.get(pid);
      if (a) a.dirty = true;
      return n;
    }

    // Move a working order's price (limit, stop or trail amount).
    modify(pid, oid, px) {
      const o = this.orders.get(oid);
      if (!o || o.pid !== pid || (o.status !== 'working' && o.status !== 'pending')) return false;
      const sim = this.m.syms[o.sym];
      const idx = Math.round(+px / sim.tick);
      if (!(idx >= 1)) return false;
      const t = this.m.t;
      if (o.type === 'LMT') {
        for (const x of sim.resting) {
          if (x.pid !== pid || x.side === o.side || x === o) continue;
          if ((o.side > 0 && idx >= x.limitIdx) || (o.side < 0 && idx <= x.limitIdx)) { this.reject(pid, 'That would trade against your own order'); return false; }
        }
        o.limitIdx = idx;
        if (o.status === 'working') {
          sim.resting = sim.resting.filter((x) => x !== o);
          this.activate(o, t);
        }
      } else if (o.type === 'STP' || o.type === 'STPLMT') o.stopIdx = idx;
      else if (o.type === 'TRAIL') {
        // Dragging a trailing stop re-anchors it at the new stop price.
        o.trail = Math.max(1, Math.abs((o.trailRef || sim.lastIdx) - idx));
        o.stopIdx = idx;
      }
      this.drain();
      const a = this.accts.get(pid);
      if (a) a.dirty = true;
      return true;
    }

    flatten(pid, sym, liq) {
      const a = this.accts.get(pid);
      if (!a) return;
      const syms = sym ? [sym] : Object.keys(a.pos);
      for (const s of syms) {
        this.cancelAll(pid, s);
        const p = a.pos[s];
        if (!p || !p.qty) continue;
        const sim = this.m.syms[s];
        if (sim.halted) { this.reject(pid, s + ' is halted: position can\'t be closed until it reopens'); continue; }
        const o = {
          id: 'o' + (++this.seq), pid, sym: s, side: p.qty > 0 ? -1 : 1, type: 'MKT', qty: Math.abs(p.qty), filled: 0,
          limitIdx: null, stopIdx: null, trail: 0, status: 'working', ts: this.m.t, queueAhead: 0, reduceOnly: true,
          tag: liq === 'X' ? 'LIQ' : 'FLAT', parent: null, children: null, oco: null, commBilled: 0, notional: 0, avgPx: 0, created: this.m.t
        };
        this.orders.set(o.id, o);
        const res = sim.walk(o.side, o.qty, null, pid, false, this.m.t);
        for (const f of res.fills) this.applyFill(o, f.qty, f.idx, liq || 'T', this.m.t, f.cp);
        if (o.status === 'working') this.finish(o, o.filled ? 'filled' : 'cancelled');
      }
      this.drain();
      a.dirty = true;
    }

    reverse(pid, sym) {
      const a = this.accts.get(pid);
      if (!a || a.frozen) return;
      const p = a.pos[sym];
      if (!p || !p.qty) return;
      const q = p.qty;
      this.flatten(pid, sym);
      if (a.pos[sym].qty === 0) this.place(pid, { sym, side: q > 0 ? -1 : 1, type: 'MKT', qty: Math.abs(q) });
    }

    // ---------- per-substep: stops and trailing stops ----------
    afterSubstep(sim, t) {
      if (this.pending.length) this.drain();
      if (!this.stops.length || sim.subHi === null) return;
      const hi = sim.subHi, lo = sim.subLo;
      const fire = [];
      for (const o of this.stops) {
        if (o.sym !== sim.sym || o.status !== 'working') continue;
        if (o.type === 'TRAIL') {
          if (o.side < 0) { o.trailRef = Math.max(o.trailRef || hi, hi); o.stopIdx = o.trailRef - o.trail; }
          else { o.trailRef = Math.min(o.trailRef || lo, lo); o.stopIdx = o.trailRef + o.trail; }
          const a = this.accts.get(o.pid);
          if (a) a.dirty = true;
        }
        if ((o.side > 0 && hi >= o.stopIdx) || (o.side < 0 && lo <= o.stopIdx)) fire.push(o);
      }
      for (const o of fire) {
        const i = this.stops.indexOf(o);
        if (i >= 0) this.stops.splice(i, 1);
        if (o.reduceOnly) {
          const p = this.accts.get(o.pid).pos[o.sym];
          const room = p && p.qty !== 0 && Math.sign(p.qty) !== o.side ? Math.abs(p.qty) : 0;
          if (room <= 0) { this.finish(o, 'cancelled'); continue; }
          if (o.qty - o.filled > room) o.qty = o.filled + room;
        }
        this.emit({ k: 'trigger', pid: o.pid, oid: o.id, sym: o.sym, tag: o.tag, type: o.type });
        if (o.type === 'STPLMT') { o.type = 'LMT'; this.activate(o, t); }
        else { o.type = 'MKT'; o.triggered = true; this.activate(o, t); }
      }
      if (this.pending.length) this.drain();
    }

    // ---------- per-step: margin ----------
    riskCheck() {
      for (const a of this.accts.values()) {
        if (a.frozen) continue;
        const eq = this.equity(a);
        const g = this.gross(a);
        if (g <= 0) continue;
        const mm = this.maint(a);
        if (eq < mm) {
          a.marginCalls++;
          this.emit({ k: 'margin', pid: a.pid, eq, maint: mm });
          this.cancelAll(a.pid);
          const syms = Object.keys(a.pos).filter((s) => a.pos[s].qty).sort((x, y) => Math.abs(a.pos[y].qty) * this.mark(y) - Math.abs(a.pos[x].qty) * this.mark(x));
          for (const s of syms) {
            this.flatten(a.pid, s, 'X');
            if (this.equity(a) >= this.maint(a) * 1.2) break;
          }
        }
        if (this.equity(a) <= 0) this.bust(a);
      }
    }

    bust(a) {
      if (a.busted) return;
      this.cancelAll(a.pid);
      for (const s of Object.keys(a.pos)) {
        if (!a.pos[s].qty) continue;
        if (this.m.syms[s].halted) this.closeAtMark(a.pid, s, 'LIQ'); else this.flatten(a.pid, s, 'X');
      }
      a.busted = true; a.frozen = true; a.dirty = true;
      this.emit({ k: 'bust', pid: a.pid, eq: this.equity(a) });
    }

    freeze(pid, on) { const a = this.accts.get(pid); if (a) { a.frozen = on; a.dirty = true; } }

    // Close one position at the last price without walking the book (closing auction, or a halted stock
    // that has to be closed for an eliminated player). Commissions apply.
    closeAtMark(pid, sym, tag) {
      const a = this.accts.get(pid);
      const p = a && a.pos[sym];
      if (!p || !p.qty) return;
      const sim = this.m.syms[sym];
      const t = this.m.t;
      const o = {
        id: 'o' + (++this.seq), pid, sym, side: p.qty > 0 ? -1 : 1, type: 'MOC', qty: Math.abs(p.qty), filled: 0,
        limitIdx: null, stopIdx: null, trail: 0, status: 'working', ts: t, queueAhead: 0, reduceOnly: true, tag: tag || 'MOC',
        parent: null, children: null, oco: null, commBilled: 0, notional: 0, avgPx: 0, created: t
      };
      this.orders.set(o.id, o);
      this.applyFill(o, o.qty, sim.lastIdx, 'C', t, null);
    }

    // Closing auction: every position closes at the last price (no book walk), commissions apply.
    closeAll(reason) {
      for (const a of this.accts.values()) {
        this.cancelAll(a.pid);
        for (const sym in a.pos) this.closeAtMark(a.pid, sym, reason || 'MOC');
        a.dirty = true;
      }
    }

    sample(t) {
      for (const a of this.accts.values()) {
        const eq = this.equity(a);
        a.eqHist.push([Math.round(t), Math.round(eq * 100) / 100]);
        if (eq > a.peak) a.peak = eq;
        const dd = a.peak > 0 ? (a.peak - eq) / a.peak : 0;
        if (dd > a.maxDD) a.maxDD = dd;
      }
    }

    // What one player sees about their own account.
    view(pid) {
      const a = this.accts.get(pid);
      if (!a) return null;
      const eq = this.equity(a);
      const g = this.gross(a);
      const pos = [];
      for (const sym in a.pos) {
        const p = a.pos[sym];
        if (p.qty || p.realized) pos.push([sym, p.qty, Math.round(p.avg * 10000) / 10000, Math.round(p.realized * 100) / 100, p.openT]);
      }
      const ord = [];
      for (const o of this.orders.values()) {
        if (o.pid !== pid || (o.status !== 'working' && o.status !== 'pending')) continue;
        const tick = this.m.syms[o.sym].tick;
        const px = (idx) => Math.round(idx * tick * 10000) / 10000;
        ord.push([o.id, o.sym, o.side, o.type, o.qty, o.filled, o.limitIdx ? px(o.limitIdx) : null, o.stopIdx ? px(o.stopIdx) : null, o.status, o.tag, o.parent, o.trail ? px(o.trail) : 0]);
      }
      return {
        cash: round2(a.cash), eq: round2(eq), start: a.start, bp: round2(Math.max(0, eq) * this.o.leverage), used: round2(g + this.pendingIncrease(a)),
        gross: round2(g), maint: round2(this.maint(a)), realized: round2(a.realized), comm: round2(a.comm), fees: round2(a.fees),
        busted: a.busted, frozen: a.frozen, mc: a.marginCalls, lev: this.o.leverage, pos, ord
      };
    }
  }

  function round2(v) { return Math.round(v * 100) / 100; }

  // Round trips from a fill list: a trip opens when the position leaves zero and closes when it returns (or
  // flips). Matches how the Tradalytics journal groups imported fills.
  function roundTrips(fills) {
    const bySym = {};
    const trips = [];
    for (const f of fills) {
      const s = bySym[f.sym] || (bySym[f.sym] = { qty: 0, trip: null });
      let q = f.qty;
      while (q > 0) {
        if (!s.trip) s.trip = { sym: f.sym, side: f.side, open: f.t, close: null, qty: 0, maxQty: 0, entryNotional: 0, exitNotional: 0, entryQty: 0, exitQty: 0, pnl: 0, comm: 0, fees: 0, fills: 0 };
        const tr = s.trip;
        const reducing = s.qty !== 0 && Math.sign(s.qty) !== f.side;
        const take = reducing ? Math.min(q, Math.abs(s.qty)) : q;
        const share = take / f.qty;
        tr.comm += (f.comm || 0) * share; tr.fees += (f.fee || 0) * share; tr.fills++;
        if (reducing) { tr.exitNotional += take * f.px; tr.exitQty += take; }
        else { tr.entryNotional += take * f.px; tr.entryQty += take; }
        s.qty += f.side * take;
        tr.maxQty = Math.max(tr.maxQty, Math.abs(s.qty));
        q -= take;
        if (s.qty === 0) {
          tr.close = f.t;
          const entry = tr.entryNotional / tr.entryQty, exit = tr.exitNotional / tr.exitQty;
          tr.entry = entry; tr.exit = exit; tr.qty = tr.maxQty;
          tr.gross = (exit - entry) * tr.exitQty * tr.side;
          tr.pnl = tr.gross - tr.comm - tr.fees;
          trips.push(tr);
          s.trip = null;
        }
      }
    }
    for (const k in bySym) {
      const tr = bySym[k].trip;
      if (tr && tr.entryQty) { tr.entry = tr.entryNotional / tr.entryQty; tr.open_ = true; }
    }
    return trips;
  }

  DTA.Engine = Engine;
  DTA.roundTrips = roundTrips;
})();
