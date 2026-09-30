// Day Trade Arena: the game host. One player's browser runs this. It owns the market, the engine, the bots
// and the rules of each mode, and it tells every connected player what they are allowed to see.
// Nothing a client sends is trusted: every message is checked here before it touches the game.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const {
    MarketSim, Engine, Bot, BOTS, SYMBOLS, SYMBOL_SETS, SESSIONS, SCENARIOS, MODES, DUEL_TYPES, DEFAULT_SETTINGS,
    PLAYER_COLORS, MAX_PLAYERS, AVATARS, EMOTES, RNG, hashStr, clamp, ind, roundTrips, fmtSignedMoney, fmtPct, BOT_QUIPS, parseClock
  } = DTA;

  const PROTO = 3;
  const TICK_MS = 100;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const r2 = (v) => Math.round(v * 100) / 100;

  // A timer that keeps running when the host's tab is in the background (worker timers aren't throttled
  // the way page timers are), falling back to setInterval.
  function startTicker(fn, ms) {
    try {
      if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
        const url = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},' + ms + ');'], { type: 'text/javascript' }));
        const w = new Worker(url);
        w.onmessage = fn;
        return { stop() { w.terminate(); URL.revokeObjectURL(url); } };
      }
    } catch (e) { /* fall through */ }
    const id = setInterval(fn, ms);
    return { stop() { clearInterval(id); } };
  }

  function cleanName(s) {
    return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  }

  class GameHost {
    // net: object with send(connId, msg), close(connId), and on('connect'|'message'|'disconnect').
    constructor(net, opts) {
      opts = opts || {};
      this.net = net;
      this.code = opts.code || '';
      this.players = new Map();
      this.byConn = new Map();
      this.settings = Object.assign({}, DEFAULT_SETTINGS, opts.settings || {});
      this.phase = 'lobby';
      this.phaseEnd = 0;
      this.g = null;
      this.pidSeq = 0;
      this.last = nowMs();
      this.botSeq = 0;
      if (net && net.on) {
        net.on('message', (c, m) => this.onMessage(c, m));
        net.on('disconnect', (c) => this.onDisconnect(c));
      }
      this.ticker = opts.manualTick ? null : startTicker(() => this.tick(), TICK_MS);
      this.syncBots();
    }

    destroy() {
      if (this.ticker) this.ticker.stop();
      this.ticker = null;
    }

    // ---------- players ----------
    participants() { return [...this.players.values()].filter((p) => p.slot >= 0); }
    humans() { return [...this.players.values()].filter((p) => !p.isBot); }
    freeSlot() {
      const used = new Set(this.participants().map((p) => p.slot));
      for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
      return -1;
    }
    alive() { return this.participants().filter((p) => !p.eliminated); }

    addPlayer(info) {
      const pid = 'p' + (++this.pidSeq);
      let slot = this.phase === 'lobby' ? this.freeSlot() : -1;
      if (slot < 0 && this.phase === 'lobby' && !info.isBot) {
        // A person takes a bot's seat.
        const bots = this.participants().filter((p) => p.isBot);
        if (bots.length) { const b = bots[bots.length - 1]; slot = b.slot; this.players.delete(b.id); }
      }
      const p = {
        id: pid, name: info.name, avatar: info.avatar, slot, color: slot >= 0 ? PLAYER_COLORS[slot] : '#898781',
        isBot: !!info.isBot, persona: info.persona || null, isHost: !!info.isHost, token: info.token || null,
        connId: info.connId || null, connected: !info.isBot, ready: !!info.isBot || !!info.isHost, focus: null, watch: null,
        eliminated: false, elimReason: '', elimRound: 0, lastChat: 0, joinedAt: Date.now()
      };
      this.players.set(pid, p);
      if (p.connId) this.byConn.set(p.connId, pid);
      return p;
    }

    syncBots() {
      if (this.phase !== 'lobby') return;
      const want = clamp(Math.floor(+this.settings.bots || 0), 0, MAX_PLAYERS - 1);
      let bots = this.participants().filter((p) => p.isBot);
      while (bots.length > want) { const b = bots.pop(); this.players.delete(b.id); }
      const usedKeys = new Set(bots.map((b) => b.persona.key));
      while (bots.length < want && this.freeSlot() >= 0) {
        const persona = BOTS.find((b) => !usedKeys.has(b.key)) || BOTS[this.botSeq % BOTS.length];
        usedKeys.add(persona.key);
        this.botSeq++;
        const p = this.addPlayer({ name: persona.name, avatar: persona.avatar, isBot: true, persona });
        bots.push(p);
      }
    }

    publicPlayer(p) {
      return {
        id: p.id, name: p.name, avatar: p.avatar, slot: p.slot, color: p.color, isBot: p.isBot, isHost: p.isHost,
        ready: p.ready, connected: p.connected, out: p.eliminated, outReason: p.elimReason, outRound: p.elimRound,
        blurb: p.persona ? p.persona.blurb : null, style: p.persona ? p.persona.style : null
      };
    }

    lobbyMsg() {
      return { t: 'lobby', code: this.code, phase: this.phase, settings: this.settings, players: [...this.players.values()].map((p) => this.publicPlayer(p)) };
    }

    // ---------- networking ----------
    sendTo(p, msg) {
      if (!p || p.isBot || !p.connId || !p.connected) return;
      try { this.net.send(p.connId, msg); } catch (e) { /* peer went away */ }
    }
    broadcast(msg, except) {
      for (const p of this.players.values()) if (!p.isBot && p !== except) this.sendTo(p, msg);
    }
    system(text, kind) { this.broadcast({ t: 'chat', sys: true, text, kind: kind || 'info', ts: Date.now() }); }

    onDisconnect(connId) {
      const pid = this.byConn.get(connId);
      this.byConn.delete(connId);
      const p = pid && this.players.get(pid);
      if (!p || p.connId !== connId) return;
      p.connected = false;
      if (this.phase === 'lobby' && !p.isHost) {
        this.players.delete(pid);
        this.system(p.avatar + ' ' + p.name + ' left');
        this.syncBots();
      } else this.system(p.avatar + ' ' + p.name + ' disconnected', 'warn');
      this.broadcast(this.lobbyMsg());
    }

    onMessage(connId, msg) {
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
      const pid = this.byConn.get(connId);
      const p = pid ? this.players.get(pid) : null;
      if (msg.t === 'hello') return this.onHello(connId, msg);
      if (msg.t === 'ping') { this.net.send(connId, { t: 'pong', ts: msg.ts }); return; }
      if (!p) return;
      const isHost = p.isHost;
      const g = this.g;
      switch (msg.t) {
        case 'ready': if (this.phase === 'lobby') { p.ready = !!msg.v; this.broadcast(this.lobbyMsg()); } break;
        case 'chat': return this.onChat(p, msg);
        case 'emote':
          if (EMOTES.includes(msg.e) && Date.now() - (p.lastEmote || 0) > 700) { p.lastEmote = Date.now(); this.broadcast({ t: 'emote', pid: p.id, e: msg.e }); }
          break;
        case 'focus': if (typeof msg.sym === 'string' && g && g.market && g.market.syms[msg.sym]) p.focus = msg.sym; break;
        case 'watch': p.watch = typeof msg.pid === 'string' && this.players.has(msg.pid) ? msg.pid : null; break;
        case 'order': case 'cancel': case 'cancelAll': case 'modify': case 'flatten': case 'reverse':
          return this.onTrade(p, msg);
        case 'predict':
          if (this.phase === 'call' && g && g.predict && p.slot >= 0 && !p.eliminated) {
            const dir = msg.dir === 1 ? 1 : msg.dir === -1 ? -1 : 0;
            const conf = clamp(Math.floor(+msg.conf || 1), 1, 3);
            if (dir) { g.predict.calls[p.id] = { dir, conf }; this.broadcast({ t: 'pcalled', pid: p.id }); }
          }
          break;
        // host-only
        case 'settings': if (isHost && this.phase === 'lobby') this.applySettings(msg.s); break;
        case 'start': if (isHost && this.phase === 'lobby') this.startMatch(); break;
        case 'kick': if (isHost) this.kick(msg.pid); break;
        case 'abort': if (isHost && this.phase !== 'lobby' && this.phase !== 'results') this.finish('The host ended the match early'); break;
        case 'lobby': if (isHost && (this.phase === 'results')) this.backToLobby(); break;
        default: break;
      }
    }

    // Orders and order management from a player. Everything is re-validated by the engine.
    onTrade(p, msg) {
      const g = this.g;
      if (!g || !g.engine || p.slot < 0 || p.eliminated) return;
      const e = g.engine;
      if (!e.accts.has(p.id)) return;
      const live = this.phase === 'live';
      switch (msg.t) {
        case 'order':
          if (!live) { this.sendTo(p, { t: 'rej', msg: this.phase === 'countdown' ? 'Wait for the opening bell' : 'Trading is paused' }); return; }
          e.place(p.id, {
            sym: String(msg.sym || ''), side: msg.side, type: String(msg.type || 'MKT'), qty: msg.qty, px: msg.px, stop: msg.stop,
            trail: msg.trail, tp: msg.tp, sl: msg.sl, reduceOnly: !!msg.reduceOnly
          });
          break;
        case 'cancel': e.cancel(p.id, String(msg.id || '')); break;
        case 'cancelAll': e.cancelAll(p.id, msg.sym ? String(msg.sym) : null); break;
        case 'modify': if (live) e.modify(p.id, String(msg.id || ''), +msg.px); break;
        case 'flatten': if (live) e.flatten(p.id, msg.sym ? String(msg.sym) : null); break;
        case 'reverse': if (live && msg.sym) e.reverse(p.id, String(msg.sym)); break;
        default: break;
      }
      this.routeEvents();
    }

    onHello(connId, msg) {
      if (msg.proto !== PROTO) { this.net.send(connId, { t: 'reject', reason: 'Version mismatch: reload the page to get the latest game.' }); return; }
      const token = typeof msg.token === 'string' ? msg.token.slice(0, 64) : null;
      const name = cleanName(msg.name) || 'Trader';
      const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[0];
      const isHost = connId === 'local';
      let p = null;
      if (token) for (const x of this.players.values()) if (x.token === token && !x.isBot) p = x;
      if (p) {
        if (p.connId && p.connId !== connId) this.byConn.delete(p.connId);
        p.connId = connId; p.connected = true; this.byConn.set(connId, p.id);
        if (this.phase === 'lobby') { p.name = name; p.avatar = avatar; }
        this.system(p.avatar + ' ' + p.name + ' reconnected');
      } else {
        const humans = this.humans().length;
        if (humans >= 16) { this.net.send(connId, { t: 'reject', reason: 'This room is full.' }); return; }
        p = this.addPlayer({ name: this.uniqueName(name), avatar, token, connId, isHost });
        this.system(p.avatar + ' ' + p.name + (p.slot >= 0 ? ' joined' : ' is watching'));
        if (this.phase === 'lobby') this.syncBots();
      }
      this.net.send(connId, { t: 'welcome', you: p.id, code: this.code, isHost: p.isHost, proto: PROTO });
      this.broadcast(this.lobbyMsg());
      if (this.phase !== 'lobby' && this.g) {
        this.sendTo(p, this.snapshotFor(p));
        if (this.phase === 'results' && this.g.results) this.sendTo(p, { t: 'results', r: this.g.results });
      }
    }

    uniqueName(name) {
      const names = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
      if (!names.has(name.toLowerCase())) return name;
      for (let i = 2; i < 99; i++) { const n = (name.slice(0, 13) + ' ' + i); if (!names.has(n.toLowerCase())) return n; }
      return name;
    }

    kick(pid) {
      const p = this.players.get(pid);
      if (!p || p.isHost) return;
      if (p.isBot) { if (this.phase === 'lobby') { this.players.delete(pid); this.settings.bots = Math.max(0, this.participants().filter((x) => x.isBot).length); } }
      else {
        this.sendTo(p, { t: 'reject', reason: 'You were removed from the room by the host.' });
        if (p.connId) { this.byConn.delete(p.connId); try { this.net.close(p.connId); } catch (e) { /* ignore */ } }
        if (this.phase === 'lobby') this.players.delete(pid); else p.connected = false;
      }
      this.broadcast(this.lobbyMsg());
    }

    onChat(p, msg) {
      const text = String(msg.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
      if (!text) return;
      const now = Date.now();
      if (now - p.lastChat < 600) return;
      p.lastChat = now;
      this.broadcast({ t: 'chat', pid: p.id, name: p.name, avatar: p.avatar, color: p.color, text, ts: now });
    }

    botSay(pid, text) {
      const p = this.players.get(pid);
      if (!p) return;
      // Bots share one chat budget so they don't drown out people.
      const now = Date.now();
      if (now - (this.lastBotSay || 0) < 7000) return;
      this.lastBotSay = now;
      this.broadcast({ t: 'chat', pid: p.id, name: p.name, avatar: p.avatar, color: p.color, text, ts: Date.now(), bot: true });
    }

    applySettings(s) {
      if (!s || typeof s !== 'object') return;
      const d = this.settings;
      const pick = (v, list, cur) => (list.includes(v) ? v : cur);
      const num = (v, lo, hi, cur) => (isFinite(+v) ? clamp(+v, lo, hi) : cur);
      const out = Object.assign({}, d);
      if ('mode' in s) out.mode = pick(s.mode, Object.keys(MODES), d.mode);
      if ('duel' in s) out.duel = pick(s.duel, Object.keys(DUEL_TYPES), d.duel);
      if ('scenario' in s) out.scenario = pick(s.scenario, ['random'].concat(SCENARIOS.map((x) => x.id)), d.scenario);
      if ('minutes' in s) out.minutes = Math.round(num(s.minutes, 2, 30, d.minutes));
      if ('session' in s) out.session = pick(s.session, SESSIONS.map((x) => x.id), d.session);
      if ('symbolSet' in s) out.symbolSet = pick(s.symbolSet, SYMBOL_SETS.map((x) => x.id), d.symbolSet);
      if ('startCash' in s) out.startCash = pick(+s.startCash, [10000, 25000, 50000, 100000, 250000, 1000000], d.startCash);
      if ('leverage' in s) out.leverage = pick(+s.leverage, [1, 2, 4, 6, 10], d.leverage);
      if ('commissions' in s) out.commissions = !!s.commissions;
      if ('events' in s) out.events = pick(s.events, ['off', 'calm', 'normal', 'chaos'], d.events);
      if ('volatility' in s) out.volatility = pick(s.volatility, ['calm', 'normal', 'wild'], d.volatility);
      if ('rivals' in s) out.rivals = pick(s.rivals, ['live', 'delayed', 'hidden'], d.rivals);
      if ('bots' in s) out.bots = Math.round(num(s.bots, 0, MAX_PLAYERS - 1, d.bots));
      if ('botLevel' in s) out.botLevel = pick(s.botLevel, ['easy', 'normal', 'hard'], d.botLevel);
      if ('seed' in s) out.seed = String(s.seed || '').replace(/[^\w-]/g, '').slice(0, 24);
      if ('elimRoundSec' in s) out.elimRoundSec = Math.round(num(s.elimRoundSec, 30, 300, d.elimRoundSec));
      if ('bustPct' in s) out.bustPct = num(s.bustPct, 0.1, 0.9, d.bustPct);
      if ('targetPct' in s) out.targetPct = num(s.targetPct, 0.005, 0.25, d.targetPct);
      if ('predictRounds' in s) out.predictRounds = Math.round(num(s.predictRounds, 3, 20, d.predictRounds));
      if ('predictCandles' in s) out.predictCandles = Math.round(num(s.predictCandles, 2, 10, d.predictCandles));
      if ('scalpRounds' in s) out.scalpRounds = Math.round(num(s.scalpRounds, 1, 9, d.scalpRounds));
      if ('scalpSec' in s) out.scalpSec = Math.round(num(s.scalpSec, 30, 240, d.scalpSec));
      if ('scalpMaxShares' in s) out.scalpMaxShares = Math.round(num(s.scalpMaxShares, 100, 100000, d.scalpMaxShares));
      this.settings = out;
      this.syncBots();
      this.broadcast(this.lobbyMsg());
    }

    // ---------- match setup ----------
    startMatch() {
      this.syncBots();
      const parts = this.participants();
      if (!parts.length) return;
      const s = Object.assign({}, this.settings);
      const seed = s.seed ? hashStr(String(s.seed)) : (Math.floor(Math.random() * 4294967296) >>> 0);
      const rng = new RNG(seed);
      for (const p of this.players.values()) { p.eliminated = false; p.elimReason = ''; p.elimRound = 0; p.focus = null; }
      const g = this.g = {
        seed, seedLabel: s.seed || String(seed % 1000000).padStart(6, '0'), rng, s, mode: s.mode, duel: s.mode === 'duel' ? s.duel : null,
        round: 0, rounds: 1, tickN: 0, allFills: [], delayed: [], results: null, market: null, engine: null, bots: [],
        speed: 30, tfSec: 60, scenario: null, roundEnds: null, stopAt: null, score: {}, singleMarket: true, perRound: [], roundFills: {}
      };
      for (const p of parts) g.score[p.id] = { pts: 0, streak: 0, best: 0, correct: 0, calls: 0, wins: 0, pnl: 0, fills: [], eq: [] };
      const mode = s.mode;
      if (mode === 'duel' && (s.duel === 'predict' || s.duel === 'scalp')) {
        g.singleMarket = false;
        g.rounds = s.duel === 'predict' ? s.predictRounds : s.scalpRounds;
        if (s.duel === 'predict') g.predict = { K: s.predictCandles, tf: 60, calls: {}, history: [] };
        this.nextRound();
        return;
      }
      let symbols, start, end, minutes = s.minutes;
      if (mode === 'scenario') {
        const sc = s.scenario === 'random' ? rng.pick(SCENARIOS) : SCENARIOS.find((x) => x.id === s.scenario) || SCENARIOS[0];
        g.scenario = sc;
        symbols = sc.symbols;
        start = parseClock(sc.session[0]); end = parseClock(sc.session[1]);
      } else {
        const set = SYMBOL_SETS.find((x) => x.id === s.symbolSet) || SYMBOL_SETS[0];
        symbols = set.syms;
        const sess = SESSIONS.find((x) => x.id === s.session) || SESSIONS[0];
        start = sess.start; end = sess.end;
      }
      if (mode === 'elim') {
        g.rounds = clamp(parts.length - 1, 1, 7);
        minutes = (g.rounds * s.elimRoundSec) / 60;
        g.roundEnds = [];
        for (let i = 1; i <= g.rounds; i++) g.roundEnds.push(start + ((end - start) * i) / g.rounds);
        g.round = 1;
      }
      g.speed = (end - start) / (minutes * 60);
      g.tfSec = ind.defaultTf(g.speed);
      const market = new MarketSim({ seed, symbols, start, end, speed: g.speed, volatility: s.volatility, events: s.events, scenario: g.scenario });
      this.useMarket(market, { maxShares: 0 });
      for (const p of parts) g.engine.addAccount(p.id, s.startCash);
      this.spawnBots();
      this.broadcastSnapshots();
      this.setPhase('countdown', 3000);
    }

    useMarket(market, engineOpts) {
      const g = this.g, s = g.s;
      g.market = market;
      g.engine = new Engine(market, Object.assign({ startCash: s.startCash, leverage: s.leverage, commissions: s.commissions }, engineOpts || {}));
      market.hooks.news = (n) => this.onNews(n);
      market.hooks.halt = (sim, on, t) => this.broadcast({ t: 'halt', sym: sim.sym, on, at: t, until: sim.haltUntil, reason: sim.haltReason });
      g.lastSample = -1;
      for (const b of g.bots) b.setContext(this.botCtx());
    }

    botCtx() {
      const g = this.g;
      // Bots read faster candles than the players' default (about one per real second) so they get going quickly.
      const botTf = g.duel === 'predict' ? g.tfSec : ind.defaultTf(g.speed * 0.4);
      const ctx = { market: g.market, engine: g.engine, tfSec: botTf, say: (pid, text) => this.botSay(pid, text) };
      if (g.mode === 'elim') {
        ctx.needTrade = (pid) => {
          const m = g.market, end = g.roundEnds[g.round - 1], len = (m.end - m.start) / g.rounds;
          const a = g.engine.acct(pid);
          return this.phase === 'live' && (m.t - (end - len)) / len > 0.55 && a && a.fills.length <= (g.roundFills[pid] || 0);
        };
      }
      return ctx;
    }

    spawnBots() {
      const g = this.g;
      g.bots = [];
      for (const p of this.participants()) {
        if (!p.isBot) continue;
        g.bots.push(new Bot(this.botCtx(), p.id, p.persona, g.s.botLevel, g.rng.fork('bot' + p.id)));
      }
    }

    // Duel rounds (Call It and Scalp Duel) each get a fresh market.
    nextRound() {
      const g = this.g, s = g.s;
      g.round++;
      const r = g.rng.fork('round' + g.round);
      const pool = s.duel === 'predict' ? ['NOVA', 'CHIP', 'MEME', 'QBIT', 'OILX', 'BIOT', 'FINX', 'SPYR'] : ['NOVA', 'CHIP', 'MEME', 'QBIT', 'OILX', 'BIOT', 'FINX'];
      const sym = r.pick(pool);
      const hist = s.duel === 'predict' ? 50 * g.predict.tf : 600;
      const live = s.duel === 'predict' ? g.predict.K * g.predict.tf : 900;
      const t0 = Math.round(r.range(DTA.RTH_OPEN, DTA.RTH_CLOSE - hist - live - 300) / 60) * 60;
      const speed = s.duel === 'predict' ? live / 6 : live / s.scalpSec;
      g.speed = speed;
      g.tfSec = s.duel === 'predict' ? g.predict.tf : ind.defaultTf(speed);
      const market = new MarketSim({ seed: (g.seed + g.round * 7919) >>> 0, symbols: [sym], start: t0, end: t0 + hist + live + (s.duel === 'predict' ? 600 : 0), speed, volatility: s.volatility, events: s.duel === 'predict' ? 'calm' : s.events });
      // Fast-forward the history so everyone starts with a chart to read.
      while (market.t < t0 + hist - 0.001) { market.step(Math.min(5, t0 + hist - market.t)); for (const sm of market.list) sm.prints.length = 0; }
      market.news.length = 0;
      for (const sm of market.list) { sm.dirtyFrom = 0; }
      this.useMarket(market, { maxShares: s.duel === 'scalp' ? s.scalpMaxShares : 0 });
      g.market.hooks.news = (n) => this.onNews(n);
      const alive = this.alive();
      for (const p of this.participants()) g.engine.addAccount(p.id, s.startCash);
      for (const p of this.participants()) if (p.eliminated) g.engine.freeze(p.id, true);
      if (!g.bots.length) this.spawnBots(); else for (const b of g.bots) b.setContext(this.botCtx());
      g.roundStartT = market.t;
      g.stopAt = market.t + live;
      if (s.duel === 'predict') {
        g.engine.tradingOpen = false;
        g.predict.calls = {};
        g.predict.sym = sym;
        this.broadcastSnapshots();
        this.setPhase('call', 9000);
        for (const b of g.bots) {
          const call = b.predict(market.syms[sym], g.tfSec);
          const delay = r.range(1500, 7000);
          g.predict.botCalls = g.predict.botCalls || [];
          g.predict.botCalls.push({ pid: b.pid, call, at: nowMs() + delay });
        }
      } else {
        this.broadcastSnapshots();
        this.setPhase('countdown', 3000);
      }
      void alive;
    }

    setPhase(ph, ms) {
      this.phase = ph;
      this.phaseEnd = nowMs() + (ms || 0);
      const g = this.g;
      this.broadcast({ t: 'phase', ph, left: ms || 0, round: g ? g.round : 0, rounds: g ? g.rounds : 0 });
    }

    snapshotFor(p) {
      const g = this.g;
      const m = g.market;
      return {
        t: 'start', mode: g.mode, duel: g.duel, seed: g.seedLabel, round: g.round, rounds: g.rounds, roundEnds: g.roundEnds,
        stopAt: g.stopAt, speed: g.speed, tf: g.tfSec, phase: this.phase, left: Math.max(0, this.phaseEnd - nowMs()),
        scenario: g.scenario ? { id: g.scenario.id, name: g.scenario.name, icon: g.scenario.icon, brief: g.scenario.brief } : null,
        settings: { startCash: g.s.startCash, leverage: g.s.leverage, commissions: g.s.commissions, rivals: g.s.rivals, targetPct: g.s.targetPct, bustPct: g.s.bustPct, scalpMaxShares: g.s.scalpMaxShares, predictCandles: g.s.predictCandles, minutes: g.s.minutes },
        market: m.snapshot(), players: [...this.players.values()].map((x) => this.publicPlayer(x)),
        acct: p && p.slot >= 0 ? g.engine.view(p.id) : null, lb: this.leaderboard(), score: this.scoreBoard(),
        fills: p && g.engine.acct(p.id) ? g.engine.acct(p.id).fills.slice(-300) : [],
        rivalFills: g.s.rivals === 'live' ? g.allFills.filter((f) => !p || f[0] !== p.id).slice(-400) : [],
        predict: g.predict ? { K: g.predict.K, sym: g.predict.sym, history: g.predict.history } : null
      };
    }
    broadcastSnapshots() {
      for (const p of this.players.values()) if (!p.isBot) this.sendTo(p, this.snapshotFor(p));
    }

    // ---------- the loop ----------
    tick() {
      const now = nowMs();
      const dtReal = clamp((now - this.last) / 1000, 0, 1);
      this.last = now;
      const g = this.g;
      if (!g || this.phase === 'lobby' || this.phase === 'results') return;
      try {
        switch (this.phase) {
          case 'countdown':
            if (now >= this.phaseEnd) { this.setPhase('live'); g.engine.tradingOpen = true; }
            else this.broadcastTick(false);
            break;
          case 'live':
            this.runLive(dtReal, now);
            break;
          case 'intermission':
            if (now >= this.phaseEnd) this.afterIntermission();
            break;
          case 'call':
            if (g.predict.botCalls) {
              for (const bc of g.predict.botCalls) if (!bc.done && now >= bc.at) { bc.done = true; g.predict.calls[bc.pid] = bc.call; this.broadcast({ t: 'pcalled', pid: bc.pid }); }
            }
            if (now >= this.phaseEnd) this.startReveal();
            break;
          case 'reveal':
            this.runReveal(dtReal);
            break;
          case 'score':
            if (now >= this.phaseEnd) { if (g.round >= g.rounds) this.finish(); else this.nextRound(); }
            break;
          default: break;
        }
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[host] tick failed', err);
      }
    }

    runLive(dtReal, now) {
      const g = this.g, m = g.market, e = g.engine;
      let dt = dtReal * g.speed;
      const limit = g.mode === 'elim' ? g.roundEnds[g.round - 1] : g.stopAt;
      if (limit !== null && limit !== undefined) dt = Math.min(dt, Math.max(0, limit - m.t));
      if (dt > 0) m.step(dt);
      e.riskCheck();
      for (const b of g.bots) { const p = this.players.get(b.pid); if (p && !p.eliminated) b.think(now); }
      this.routeEvents();
      g.tickN++;
      if (m.t - g.lastSample >= g.speed * 0.5 || g.lastSample < 0) { e.sample(m.t); g.lastSample = m.t; }
      this.releaseDelayed(now);
      this.modeChecks(limit);
      if (this.phase === 'live') this.broadcastTick(true);
    }

    modeChecks(limit) {
      const g = this.g, m = g.market, e = g.engine, s = g.s;
      if (g.mode === 'race' || g.mode === 'scenario') {
        if (m.closed || m.t >= m.end - 1e-6) this.finish();
        return;
      }
      if (g.mode === 'elim') {
        for (const p of this.alive()) {
          const a = e.acct(p.id);
          if (a.busted || e.equity(a) < a.start * s.bustPct) this.eliminate(p, a.busted ? 'Busted' : 'Blew up (below ' + Math.round(s.bustPct * 100) + '% of starting cash)');
        }
        if (this.alive().length <= 1 && this.participants().length > 1) { this.finish(); return; }
        if (m.t >= limit - 1e-6) this.roundBell();
        return;
      }
      if (g.duel === 'target') {
        for (const p of this.alive()) {
          const a = e.acct(p.id);
          const eq = e.equity(a);
          if (eq >= a.start * (1 + s.targetPct)) { g.targetWinner = p.id; this.system('🎯 ' + p.avatar + ' ' + p.name + ' hit the profit target!', 'good'); this.finish(); return; }
          if (a.busted || eq <= a.start * (1 - s.targetPct)) this.eliminate(p, a.busted ? 'Busted' : 'Hit the loss limit');
        }
        if (!this.alive().length || m.closed || m.t >= m.end - 1e-6) this.finish();
        return;
      }
      if (g.duel === 'scalp') {
        if (m.t >= g.stopAt - 1e-6) this.scalpRoundEnd();
      }
    }

    eliminate(p, reason) {
      if (p.eliminated) return;
      const g = this.g;
      p.eliminated = true; p.elimReason = reason; p.elimRound = g.round;
      const a = g.engine.acct(p.id);
      if (a && !a.frozen) {
        for (const sym of Object.keys(a.pos)) {
          if (!a.pos[sym].qty) continue;
          if (g.market.syms[sym].halted) g.engine.closeAtMark(p.id, sym, 'OUT'); else g.engine.flatten(p.id, sym, 'X');
        }
      }
      g.engine.freeze(p.id, true);
      this.routeEvents();
      this.broadcast({ t: 'elim', pid: p.id, reason, round: g.round });
      this.system('🥊 ' + p.avatar + ' ' + p.name + ' is out: ' + reason, 'bad');
      if (p.isBot && Math.random() < 0.6) this.botSay(p.id, DTA.BOT_QUIPS.elim[Math.floor(Math.random() * DTA.BOT_QUIPS.elim.length)]);
      this.broadcast(this.lobbyMsg());
    }

    roundBell() {
      const g = this.g, e = g.engine;
      e.closeAll('BELL');
      this.routeEvents();
      e.sample(g.market.t);
      const alive = this.alive();
      if (alive.length > 1) {
        // Sitting on your hands isn't a strategy: anyone who made no trades this round ranks below everyone who did.
        const traded = (p) => e.acct(p.id).fills.length > (g.roundFills[p.id] || 0);
        const ranked = alive.map((p) => ({ p, eq: e.equity(e.acct(p.id)), tr: traded(p) })).sort((a, b) => (a.tr === b.tr ? a.eq - b.eq : a.tr ? 1 : -1));
        const worst = ranked[0];
        this.eliminate(worst.p, worst.tr ? 'Lowest account at the round ' + g.round + ' bell' : 'No trades in round ' + g.round);
      }
      for (const p of this.participants()) g.roundFills[p.id] = e.acct(p.id).fills.length;
      this.broadcastTick(true, true);
      if (g.round >= g.rounds || this.alive().length <= 1) { this.finish(); return; }
      g.round++;
      e.tradingOpen = false;
      this.setPhase('intermission', 6000);
    }

    afterIntermission() {
      const g = this.g;
      if (g.duel === 'scalp') {
        if (g.round >= g.rounds || g.clinched) { this.finish(); return; }
        this.nextRound();
        return;
      }
      g.engine.tradingOpen = true;
      this.setPhase('live');
    }

    scalpRoundEnd() {
      const g = this.g, e = g.engine;
      e.closeAll('BELL');
      this.routeEvents();
      e.sample(g.market.t);
      const res = [];
      for (const p of this.participants()) {
        const a = e.acct(p.id);
        const pnl = e.equity(a) - a.start;
        const sc = g.score[p.id];
        sc.pnl += pnl;
        sc.fills = sc.fills.concat(a.fills);
        sc.eq.push(pnl);
        sc.maxDD = Math.max(sc.maxDD || 0, a.maxDD);
        sc.comm = (sc.comm || 0) + a.comm; sc.fees = (sc.fees || 0) + a.fees; sc.mc = (sc.mc || 0) + a.marginCalls;
        sc.maxGross = Math.max(sc.maxGross || 0, a.maxGross);
        res.push({ pid: p.id, pnl: r2(pnl) });
      }
      const best = Math.max(...res.map((x) => x.pnl));
      const winners = best > 0 ? res.filter((x) => x.pnl === best).map((x) => x.pid) : [];
      for (const w of winners) g.score[w].wins++;
      g.perRound.push({ round: g.round, sym: g.market.list[0].sym, res, winners });
      const need = Math.floor(g.rounds / 2) + 1;
      g.clinched = Object.values(g.score).some((x) => x.wins >= need);
      this.broadcast({ t: 'rres', round: g.round, sym: g.market.list[0].sym, res, winners, score: this.scoreBoard() });
      e.tradingOpen = false;
      this.setPhase('intermission', 5500);
    }

    // ---------- Call It ----------
    startReveal() {
      const g = this.g, pr = g.predict;
      const sim = g.market.list[0];
      pr.refIdx = sim.lastIdx;
      pr.refT = g.market.t;
      this.broadcast({ t: 'plock', ref: pr.refIdx, calls: pr.calls });
      this.setPhase('reveal');
    }
    runReveal(dtReal) {
      const g = this.g, m = g.market;
      const dt = Math.min(dtReal * g.speed, Math.max(0, g.stopAt - m.t));
      if (dt > 0) m.step(dt);
      this.broadcastTick(false);
      if (m.t >= g.stopAt - 1e-6) this.scoreReveal();
    }
    scoreReveal() {
      const g = this.g, pr = g.predict;
      const sim = g.market.list[0];
      const move = sim.lastIdx - pr.refIdx;
      const dir = Math.sign(move);
      const out = {};
      for (const p of this.participants()) {
        const sc = g.score[p.id];
        const call = pr.calls[p.id];
        let pts = 0;
        if (call) {
          sc.calls++;
          if (dir === 0) pts = 0;
          else if (call.dir === dir) { sc.streak++; sc.correct++; pts = 100 * call.conf + 25 * (sc.streak - 1); }
          else { sc.streak = 0; pts = -50 * call.conf; }
        } else sc.streak = 0;
        sc.best = Math.max(sc.best, sc.streak);
        sc.pts += pts;
        out[p.id] = { call: call || null, pts };
      }
      const pct = move * sim.tick / (pr.refIdx * sim.tick);
      pr.history.push({ round: g.round, sym: sim.sym, dir, pct });
      this.broadcast({ t: 'pres', round: g.round, dir, move: pct, ref: pr.refIdx, last: sim.lastIdx, out, score: this.scoreBoard() });
      this.setPhase('score', 4500);
    }

    scoreBoard() {
      const g = this.g;
      if (!g) return {};
      const out = {};
      for (const pid in g.score) { const s = g.score[pid]; out[pid] = { pts: s.pts, streak: s.streak, best: s.best, wins: s.wins, pnl: r2(s.pnl), correct: s.correct, calls: s.calls }; }
      return out;
    }

    // ---------- events out ----------
    onNews(n) {
      this.broadcast({ t: 'news', n });
      const g = this.g;
      const now = nowMs();
      if (g) for (const b of g.bots) b.onNews(n, now);
    }

    routeEvents() {
      const g = this.g, e = g.engine;
      if (!e.events.length) return;
      const evs = e.events.splice(0);
      for (const ev of evs) {
        const p = this.players.get(ev.pid);
        switch (ev.k) {
          case 'fill': {
            const f = ev.fill;
            this.sendTo(p, { t: 'fill', f });
            const pub = [ev.pid, f.t, f.sym, f.side, f.qty, f.px, f.liq];
            g.allFills.push(pub);
            if (g.s.rivals === 'live') this.broadcast({ t: 'rf', f: pub }, p);
            else if (g.s.rivals === 'delayed') g.delayed.push({ at: nowMs() + 20000, f: pub, owner: ev.pid });
            break;
          }
          case 'reject': this.sendTo(p, { t: 'rej', msg: ev.msg }); break;
          case 'trigger': this.sendTo(p, { t: 'toast', kind: 'warn', text: (ev.tag === 'SL' ? 'Stop-loss' : ev.type === 'TRAIL' ? 'Trailing stop' : 'Stop') + ' triggered on ' + ev.sym }); break;
          case 'margin':
            if (p) {
              this.sendTo(p, { t: 'margin', eq: ev.eq, maint: ev.maint });
              this.system('💥 ' + p.avatar + ' ' + p.name + ' got margin called', 'bad');
              if (p.isBot && Math.random() < 0.7) this.botSay(p.id, DTA.BOT_QUIPS.margin[Math.floor(Math.random() * DTA.BOT_QUIPS.margin.length)]);
            }
            break;
          case 'bust':
            if (p) this.system('💀 ' + p.avatar + ' ' + p.name + ' blew up the account', 'bad');
            break;
          default: break;
        }
      }
    }

    releaseDelayed(now) {
      const g = this.g;
      if (!g.delayed.length) return;
      while (g.delayed.length && g.delayed[0].at <= now) {
        const d = g.delayed.shift();
        this.broadcast({ t: 'rf', f: d.f }, this.players.get(d.owner));
      }
    }

    leaderboard() {
      const g = this.g, e = g.engine;
      const out = [];
      for (const p of this.participants()) {
        const a = e.acct(p.id);
        if (!a) continue;
        let pos = null;
        if (g.s.rivals === 'live') {
          pos = [];
          for (const sym in a.pos) if (a.pos[sym].qty) pos.push([sym, a.pos[sym].qty, r2(a.pos[sym].avg)]);
        }
        out.push({ id: p.id, eq: r2(e.equity(a)), st: a.start, r: r2(a.realized), n: a.fills.length, pos, out: p.eliminated ? 1 : 0, mc: a.marginCalls, b: a.busted ? 1 : 0 });
      }
      return out;
    }

    broadcastTick(withLb, forceLb) {
      const g = this.g, m = g.market, e = g.engine;
      const t = m.t;
      const deltas = {};
      for (const s of m.list) deltas[s.sym] = s.delta(t);
      const prints = {};
      for (const s of m.list) prints[s.sym] = s.prints.splice(0).slice(-120);
      const sendLb = forceLb || (withLb && g.tickN % 4 === 0);
      const lb = sendLb ? this.leaderboard() : null;
      const books = {};
      // Every 5th tick, a compact book for every symbol so heatmaps have history even off-focus.
      let heat = null;
      if (g.tickN % 5 === 0) {
        heat = {};
        for (const s of m.list) {
          const bk = books[s.sym] || (books[s.sym] = s.book(t, 24));
          heat[s.sym] = [bk.b.length ? bk.b[0][0] : 0, bk.b.map((l) => l[1]), bk.a.length ? bk.a[0][0] : 0, bk.a.map((l) => l[1])];
        }
      }
      for (const p of this.players.values()) {
        if (p.isBot || !p.connected) continue;
        const focus = p.focus && m.syms[p.focus] ? p.focus : m.list[0].sym;
        if (!books[focus]) books[focus] = m.syms[focus].book(t, 24);
        const msg = { t: 'k', c: t, ph: this.phase, s: deltas, f: focus, pr: prints[focus], bk: books[focus] };
        if (heat) msg.hb = heat;
        if (lb) msg.lb = lb;
        const a = e.acct(p.id);
        if (a && (a.dirty || g.tickN % 10 === 0)) msg.a = e.view(p.id);
        if (p.watch && p.watch !== p.id && g.tickN % 5 === 0 && g.s.rivals === 'live') msg.w = { pid: p.watch, v: e.view(p.watch) };
        this.sendTo(p, msg);
      }
      for (const a of e.accts.values()) a.dirty = false;
    }

    // ---------- the end ----------
    finish(note) {
      const g = this.g;
      if (!g || this.phase === 'results') return;
      if (g.singleMarket) {
        g.engine.closeAll('MOC');
        this.routeEvents();
        g.engine.sample(g.market.t);
      } else if (g.duel === 'scalp' && this.phase === 'live') {
        this.scalpRoundEnd();
        this.phase = 'results';
      }
      g.engine.tradingOpen = false;
      g.results = this.buildResults(note);
      this.phase = 'results';
      this.broadcast({ t: 'phase', ph: 'results', left: 0, round: g.round, rounds: g.rounds });
      this.broadcast({ t: 'results', r: g.results });
      this.broadcast(this.lobbyMsg());
    }

    backToLobby() {
      this.phase = 'lobby';
      for (const p of this.players.values()) { p.eliminated = false; p.ready = p.isBot || p.isHost; }
      // Drop people who left during the match.
      for (const p of [...this.players.values()]) if (!p.isBot && !p.connected && !p.isHost) this.players.delete(p.id);
      // People who watched (joined late, or the room was full) get a seat now if there is one, ahead of bots.
      for (const p of this.players.values()) {
        if (p.isBot || p.slot >= 0) continue;
        let slot = this.freeSlot();
        if (slot < 0) {
          const bots = this.participants().filter((x) => x.isBot);
          if (!bots.length) break;
          const bt = bots[bots.length - 1];
          slot = bt.slot;
          this.players.delete(bt.id);
          this.settings.bots = Math.max(0, bots.length - 1);
        }
        p.slot = slot; p.color = PLAYER_COLORS[slot];
      }
      this.syncBots();
      this.g = null;
      this.broadcast({ t: 'phase', ph: 'lobby', left: 0 });
      this.broadcast(this.lobbyMsg());
    }

    statsFor(p) {
      const g = this.g, e = g.engine;
      const a = e.acct(p.id);
      const sc = g.score[p.id] || {};
      const multi = !g.singleMarket;
      const fills = multi ? (sc.fills || []) : a.fills;
      const trips = roundTrips(fills);
      const wins = trips.filter((t) => t.pnl > 0), losses = trips.filter((t) => t.pnl <= 0);
      const sumW = wins.reduce((x, t) => x + t.pnl, 0), sumL = losses.reduce((x, t) => x + t.pnl, 0);
      const start = a ? a.start : g.s.startCash;
      const eq = multi ? start + (sc.pnl || 0) : e.equity(a);
      const holds = trips.map((t) => t.close - t.open);
      return {
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, isBot: p.isBot, out: p.eliminated, outReason: p.elimReason, outRound: p.elimRound,
        start, eq: r2(eq), pnl: r2(eq - start), pnlPct: (eq - start) / start,
        trades: trips.length, winRate: trips.length ? wins.length / trips.length : 0,
        avgWin: wins.length ? sumW / wins.length : 0, avgLoss: losses.length ? sumL / losses.length : 0,
        best: trips.length ? Math.max(...trips.map((t) => t.pnl)) : 0, worst: trips.length ? Math.min(...trips.map((t) => t.pnl)) : 0,
        // null = no losing trades (infinite profit factor); Infinity would not survive JSON over the network.
        pf: sumL < 0 ? sumW / -sumL : sumW > 0 ? null : 0,
        maxDD: multi ? (sc.maxDD || 0) : a.maxDD, comm: r2(multi ? (sc.comm || 0) : a.comm), fees: r2(multi ? (sc.fees || 0) : a.fees),
        shares: fills.reduce((x, f) => x + f.qty, 0), dollars: fills.reduce((x, f) => x + f.qty * f.px, 0),
        mc: multi ? (sc.mc || 0) : a.marginCalls, busted: a ? a.busted : false, maxGross: multi ? (sc.maxGross || 0) : a.maxGross,
        hold: holds.length ? holds.reduce((x, y) => x + y, 0) / holds.length : 0,
        longPnl: trips.filter((t) => t.side > 0).reduce((x, t) => x + t.pnl, 0), shortPnl: trips.filter((t) => t.side < 0).reduce((x, t) => x + t.pnl, 0),
        pts: sc.pts || 0, bestStreak: sc.best || 0, correct: sc.correct || 0, calls: sc.calls || 0, wins: sc.wins || 0,
        tripList: trips.slice(-200).map((t) => ({ sym: t.sym, side: t.side, qty: t.qty, entry: r2(t.entry * 100) / 100, exit: r2(t.exit * 100) / 100, open: t.open, close: t.close, pnl: r2(t.pnl) }))
      };
    }

    buildResults(note) {
      const g = this.g;
      const rows = this.participants().map((p) => this.statsFor(p));
      const byEq = (a, b) => b.eq - a.eq;
      if (g.mode === 'elim') rows.sort((a, b) => (a.out === b.out ? (a.out ? b.outRound - a.outRound || byEq(a, b) : byEq(a, b)) : a.out ? 1 : -1));
      else if (g.duel === 'predict') rows.sort((a, b) => b.pts - a.pts || b.correct - a.correct);
      else if (g.duel === 'scalp') rows.sort((a, b) => b.wins - a.wins || b.pnl - a.pnl);
      else if (g.duel === 'target') rows.sort((a, b) => (a.id === g.targetWinner ? -1 : b.id === g.targetWinner ? 1 : (a.out === b.out ? byEq(a, b) : a.out ? 1 : -1)));
      else rows.sort(byEq);
      const eqHist = {};
      if (g.singleMarket) {
        for (const p of this.participants()) {
          const a = g.engine.acct(p.id);
          const h = a.eqHist;
          const step = Math.max(1, Math.ceil(h.length / 500));
          eqHist[p.id] = h.filter((_, i) => i % step === 0 || i === h.length - 1);
        }
      }
      const syms = g.market.list.map((s) => s.sym);
      return {
        mode: g.mode, duel: g.duel, seed: g.seedLabel, note: note || null, rounds: g.rounds, round: g.round,
        scenario: g.scenario ? { name: g.scenario.name, icon: g.scenario.icon, debrief: g.scenario.debrief, brief: g.scenario.brief } : null,
        rows, awards: awards(rows, g), eqHist, fills: g.singleMarket ? g.allFills : [], singleMarket: g.singleMarket,
        syms, perRound: g.perRound, predict: g.predict ? g.predict.history : null, start: g.market.start, end: g.market.end,
        news: g.singleMarket ? g.market.news.slice() : [], settings: { startCash: g.s.startCash, leverage: g.s.leverage, commissions: g.s.commissions }
      };
    }
  }

  // Awards go to one player each; ties go to the higher finisher.
  function awards(rows, g) {
    const out = [];
    const give = (icon, title, row, detail) => { if (row) out.push({ icon, title, pid: row.id, detail }); };
    const traded = rows.filter((r) => r.trades > 0);
    const maxBy = (list, f) => list.reduce((best, r) => (best === null || f(r) > f(best) ? r : best), null);
    const minBy = (list, f) => list.reduce((best, r) => (best === null || f(r) < f(best) ? r : best), null);
    if (rows.length) give('🏆', 'Champion', rows[0], g.duel === 'predict' ? rows[0].pts + ' points' : g.duel === 'scalp' ? rows[0].wins + ' round wins' : fmtSignedMoney(rows[0].pnl, 0));
    if (g.duel === 'predict') {
      give('🔮', 'Oracle', maxBy(rows.filter((r) => r.bestStreak > 1), (r) => r.bestStreak), 'Streak of ' + (maxBy(rows, (r) => r.bestStreak) || {}).bestStreak);
      return out;
    }
    const sniper = maxBy(traded.filter((r) => r.trades >= 3), (r) => r.winRate + r.trades * 1e-4);
    if (sniper && sniper.winRate >= 0.5) give('🎯', 'Sniper', sniper, Math.round(sniper.winRate * 100) + '% winners over ' + sniper.trades + ' trades');
    const scalper = maxBy(traded.filter((r) => r.trades >= 5), (r) => r.trades);
    give('⚡', 'Machine Gun', scalper, scalper ? scalper.trades + ' round trips' : '');
    const whale = maxBy(traded, (r) => r.dollars);
    give('🐋', 'Whale', whale, whale ? '$' + Math.round(whale.dollars / 1000).toLocaleString() + 'K traded' : '');
    const bear = maxBy(traded.filter((r) => r.shortPnl > 0), (r) => r.shortPnl);
    give('🐻', 'Bear King', bear, bear ? fmtSignedMoney(bear.shortPnl, 0) + ' from shorts' : '');
    const bull = maxBy(traded.filter((r) => r.longPnl > 0), (r) => r.longPnl);
    give('🐂', 'Bull Rider', bull, bull ? fmtSignedMoney(bull.longPnl, 0) + ' from longs' : '');
    const diamond = maxBy(traded.filter((r) => r.pnl > 0), (r) => r.hold);
    give('💎', 'Diamond Hands', diamond, diamond ? 'Held winners ' + DTA.fmtHold(diamond.hold) + ' on average' : '');
    const zen = minBy(traded.filter((r) => r.pnl > 0), (r) => r.maxDD);
    give('🧘', 'Zen Master', zen, zen ? 'Max drawdown only ' + fmtPct(zen.maxDD, 1, false) : '');
    const coaster = maxBy(traded.filter((r) => r.maxDD > 0.02), (r) => r.maxDD);
    give('🎢', 'Rollercoaster', coaster, coaster ? fmtPct(coaster.maxDD, 1, false) + ' peak-to-trough drawdown' : '');
    const broker = maxBy(traded, (r) => r.comm + r.fees);
    give('💸', 'Broker\'s Favorite', broker, broker ? '$' + Math.round(broker.comm + broker.fees).toLocaleString() + ' in commissions and fees' : '');
    const mcs = rows.filter((x) => x.mc > 0).sort((a, b) => b.mc - a.mc);
    if (mcs.length) give('💀', 'Margin Called', mcs[0], mcs[0].mc + (mcs[0].mc === 1 ? ' margin call' : ' margin calls') + (mcs.length > 1 ? ' (and ' + (mcs.length - 1) + ' more traders got the call)' : ''));
    return out;
  }

  DTA.GameHost = GameHost;
  DTA.PROTO = PROTO;
})();
