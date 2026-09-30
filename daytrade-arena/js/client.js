// Day Trade Arena: the player's side of the connection. Keeps a mirror of everything the host sends
// (market, account, leaderboard, news, chat) and emits events for the interface to draw.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { Emitter, store } = DTA;

  function sessionToken() {
    try {
      let t = sessionStorage.getItem('dta:token');
      if (!t) { t = DTA.randomToken(); sessionStorage.setItem('dta:token', t); }
      return t;
    } catch (e) { return DTA.randomToken(); }
  }

  class GameClient extends Emitter {
    constructor() {
      super();
      this.net = null;
      this.me = null;
      this.isHost = false;
      this.code = '';
      this.players = new Map();
      this.settings = null;
      this.phase = 'none';
      this.phaseDeadline = 0;
      this.game = null;
      this.chat = [];
      this.rtt = 0;
      this.profile = null;
      this.token = sessionToken();
      this.connected = false;
    }

    attach(net, profile) {
      if (this.net && this.net !== net) { try { this.net.close(); } catch (e) { /* ignore */ } }
      this.net = net;
      this.profile = profile;
      net.on('open', () => {
        this.connected = true;
        this.send({ t: 'hello', name: profile.name, avatar: profile.avatar, token: this.token, proto: DTA.PROTO });
      });
      net.on('message', (m) => { try { this.handle(m); } catch (e) { console.error('[client] message failed', m && m.t, e); } });
      net.on('close', (reason) => { if (this.net === net) { this.connected = false; this.emit('disconnected', reason); } });
    }

    send(msg) { if (this.net) this.net.send(msg); }

    // ---------- incoming ----------
    handle(m) {
      if (!m || typeof m.t !== 'string') return;
      const g = this.game;
      switch (m.t) {
        case 'welcome':
          this.me = m.you; this.code = m.code; this.isHost = !!m.isHost;
          this.emit('welcome', m);
          break;
        case 'reject': this.emit('rejected', m.reason); break;
        case 'pong': this.rtt = Date.now() - m.ts; break;
        case 'lobby':
          this.settings = m.settings;
          this.players = new Map(m.players.map((p) => [p.id, p]));
          if (this.phase === 'none' || m.phase === 'lobby') this.phase = m.phase === 'lobby' ? 'lobby' : this.phase;
          this.emit('lobby', m);
          break;
        case 'chat':
          this.chat.push(m);
          if (this.chat.length > 200) this.chat.shift();
          this.emit('chat', m);
          break;
        case 'emote': this.emit('emote', m); break;
        case 'start': this.onStart(m); break;
        case 'phase':
          this.phase = m.ph;
          this.phaseDeadline = performance.now() + (m.left || 0);
          if (g) { g.round = m.round || g.round; g.rounds = m.rounds || g.rounds; }
          if (m.ph === 'lobby') { this.game = null; }
          this.emit('phase', m);
          break;
        case 'k': if (g) this.onTick(m); break;
        case 'fill':
          if (!g) break;
          g.fills.push(m.f);
          if (g.fills.length > 2000) g.fills.shift();
          this.emit('fill', m.f);
          break;
        case 'rf':
          if (!g) break;
          g.rivalFills.push(m.f);
          if (g.rivalFills.length > 3000) g.rivalFills.shift();
          this.emit('rfill', m.f);
          break;
        case 'rej': this.emit('toast', { kind: 'bad', text: m.msg }); break;
        case 'toast': this.emit('toast', { kind: m.kind || 'info', text: m.text }); break;
        case 'margin': this.emit('margin', m); break;
        case 'news':
          if (!g) break;
          g.news.push(m.n);
          if (g.news.length > 200) g.news.shift();
          this.emit('news', m.n);
          break;
        case 'halt': {
          if (!g) break;
          const s = g.syms[m.sym];
          if (s) {
            s.halted = m.on; s.haltUntil = m.until; s.haltReason = m.reason;
            if (m.on) s.haltList.push([m.at, m.until, m.reason]);
            else if (s.haltList.length) s.haltList[s.haltList.length - 1][1] = m.at;
          }
          this.emit('halt', m);
          break;
        }
        case 'elim': {
          const p = this.players.get(m.pid);
          if (p) { p.out = true; p.outReason = m.reason; p.outRound = m.round; }
          this.emit('elim', m);
          break;
        }
        case 'results':
          if (g) g.results = m.r;
          this.emit('results', m.r);
          break;
        case 'pcalled': this.emit('pcalled', m); break;
        case 'plock': if (g && g.predict) { g.predict.ref = m.ref; g.predict.calls = m.calls; } this.emit('plock', m); break;
        case 'pres': if (g) { g.score = m.score; if (g.predict) g.predict.history.push({ round: m.round, dir: m.dir, pct: m.move }); } this.emit('pres', m); break;
        case 'rres': if (g) { g.score = m.score; g.perRound.push(m); } this.emit('rres', m); break;
        default: break;
      }
    }

    onStart(m) {
      const prev = this.game;
      const mk = m.market;
      const syms = {};
      for (const k in mk.syms) {
        const s = mk.syms[k];
        syms[k] = Object.assign({}, s, { uid: DTA.uid('s'), tape: [], book: { b: [], a: [] }, version: 1, dirtyFrom: 0, prevLast: s.last, flash: 0, vap: null, heat: [], big: s.big || [] });
      }
      const symList = Object.keys(syms);
      const keepFocus = prev && prev.focus && syms[prev.focus] ? prev.focus : symList[0];
      this.phase = m.phase;
      this.phaseDeadline = performance.now() + (m.left || 0);
      for (const p of m.players) this.players.set(p.id, p);
      const g = this.game = {
        mode: m.mode, duel: m.duel, seed: m.seed, round: m.round, rounds: m.rounds, roundEnds: m.roundEnds, stopAt: m.stopAt,
        speed: m.speed, tf: m.tf, scenario: m.scenario, settings: m.settings,
        t: mk.t, start: mk.start, end: mk.end, syms, symList, focus: keepFocus,
        acct: m.acct, fills: m.fills || [], rivalFills: m.rivalFills || [],
        lb: m.lb || [], lbHist: {}, news: mk.news || [], score: m.score || {},
        predict: m.predict ? Object.assign({ calls: {}, ref: null }, m.predict) : null,
        perRound: prev && prev.mode === m.mode && m.round > 1 ? prev.perRound : [],
        results: null, watch: null, newRound: !!(prev && m.round > 1)
      };
      if (prev && m.round > 1 && prev.lbHist) g.lbHist = {};
      this.recordLb(g.lb, g.t);
      this.send({ t: 'focus', sym: g.focus });
      this.emit('start', g);
    }

    onTick(m) {
      const g = this.game;
      g.t = m.c;
      if (m.ph && m.ph !== this.phase) this.phase = m.ph;
      for (const sym in m.s) {
        const s = g.syms[sym];
        if (!s) continue;
        const d = m.s[sym];
        s.prevLast = s.last;
        s.last = d[0]; s.bid = d[1]; s.ask = d[2]; s.vol = d[3]; s.pv = d[4]; s.halted = !!d[5];
        const from = d[6], bars = d[7];
        if (from <= s.bars.length) {
          s.bars.length = from;
          for (const b of bars) s.bars.push(b);
          s.dirtyFrom = Math.min(s.dirtyFrom, from);
        }
        if (d[8] !== null) s.hi = d[8];
        if (d[9] !== null) s.lo = d[9];
        if (d[10] !== null) s.open = d[10];
        if (d[11]) { for (const bp of d[11]) s.big.push(bp); if (s.big.length > 3000) s.big.splice(0, s.big.length - 3000); }
        s.version++;
      }
      if (m.f && g.syms[m.f]) {
        const s = g.syms[m.f];
        if (m.pr && m.pr.length) {
          for (const p of m.pr) s.tape.push(p);
          if (s.tape.length > 400) s.tape.splice(0, s.tape.length - 400);
        }
        if (m.bk) { s.book = m.bk; s.bookT = performance.now(); }
      }
      if (m.hb) {
        // Resting-liquidity history for the heatmap: [t, bestBid, bidSizes, bestAsk, askSizes].
        for (const sym in m.hb) {
          const s = g.syms[sym];
          if (!s) continue;
          const h = m.hb[sym];
          s.heat.push([g.t, h[0], h[1], h[2], h[3]]);
          if (s.heat.length > 5000) s.heat.splice(0, 1000);
        }
      }
      if (m.lb) { g.lb = m.lb; this.recordLb(m.lb, g.t); }
      if (m.a) g.acct = m.a;
      if (m.w) g.watch = m.w;
      this.emit('tick', m);
    }

    recordLb(lb, t) {
      const g = this.game;
      for (const r of lb) {
        const h = g.lbHist[r.id] || (g.lbHist[r.id] = []);
        if (!h.length || t - h[h.length - 1][0] >= 1 || h[h.length - 1][1] !== r.eq) h.push([t, r.eq]);
        if (h.length > 3000) h.splice(0, h.length - 3000);
      }
    }

    // ---------- derived ----------
    price(sym) { const s = this.game && this.game.syms[sym]; return s ? s.last * s.tick : 0; }
    position(sym) {
      const a = this.game && this.game.acct;
      if (!a) return null;
      for (const p of a.pos) if (p[0] === sym) return { sym, qty: p[1], avg: p[2], realized: p[3], openT: p[4] };
      return null;
    }
    // Equity marked to the latest prices (smoother than waiting for the next account update).
    equity() {
      const g = this.game;
      const a = g && g.acct;
      if (!a) return 0;
      let e = a.cash;
      for (const p of a.pos) if (p[1]) e += p[1] * this.price(p[0]);
      return e;
    }
    unrealized(sym) {
      const p = this.position(sym);
      if (!p || !p.qty) return 0;
      return p.qty * (this.price(sym) - p.avg);
    }
    myOrders(sym) {
      const a = this.game && this.game.acct;
      if (!a) return [];
      return a.ord.filter((o) => !sym || o[1] === sym).map((o) => ({ id: o[0], sym: o[1], side: o[2], type: o[3], qty: o[4], filled: o[5], px: o[6], stop: o[7], status: o[8], tag: o[9], parent: o[10], trail: o[11] }));
    }
    isParticipant() { const p = this.players.get(this.me); return !!(p && p.slot >= 0); }
    amOut() { const p = this.players.get(this.me); return !!(p && p.out); }
    player(id) { return this.players.get(id); }
    rank() {
      const g = this.game;
      if (!g || !g.lb.length) return null;
      const sorted = g.lb.slice().sort((a, b) => b.eq - a.eq);
      const i = sorted.findIndex((r) => r.id === this.me);
      return i < 0 ? null : { rank: i + 1, of: sorted.length };
    }
    timeLeftMs() {
      const g = this.game;
      if (!g) return 0;
      if (this.phase === 'countdown' || this.phase === 'intermission' || this.phase === 'call' || this.phase === 'score') return Math.max(0, this.phaseDeadline - performance.now());
      let end = g.end;
      if (g.mode === 'elim' && g.roundEnds) end = g.roundEnds[Math.max(0, (g.round || 1) - 1)];
      else if (g.stopAt) end = g.stopAt;
      return Math.max(0, ((end - g.t) / g.speed) * 1000);
    }

    // ---------- outgoing ----------
    order(req) { this.send(Object.assign({ t: 'order' }, req)); }
    cancel(id) { this.send({ t: 'cancel', id }); }
    cancelAll(sym) { this.send({ t: 'cancelAll', sym: sym || null }); }
    modify(id, px) { this.send({ t: 'modify', id, px }); }
    flatten(sym) { this.send({ t: 'flatten', sym: sym || null }); }
    reverse(sym) { this.send({ t: 'reverse', sym }); }
    setFocus(sym) { if (this.game && this.game.syms[sym]) { this.game.focus = sym; this.send({ t: 'focus', sym }); this.emit('focus', sym); } }
    predict(dir, conf) { this.send({ t: 'predict', dir, conf }); }
    say(text) { this.send({ t: 'chat', text }); }
    emote(e) { this.send({ t: 'emote', e }); }
    ready(v) { this.send({ t: 'ready', v }); }
    updateSettings(s) { this.send({ t: 'settings', s }); }
    start() { this.send({ t: 'start' }); }
    kick(pid) { this.send({ t: 'kick', pid }); }
    abort() { this.send({ t: 'abort' }); }
    toLobby() { this.send({ t: 'lobby' }); }
    watch(pid) { this.send({ t: 'watch', pid }); if (this.game) this.game.watch = null; }
  }

  DTA.GameClient = GameClient;
  DTA.sessionToken = sessionToken;
  void store;
})();
