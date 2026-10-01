// Day Trade Arena: connections. Three ways to reach the host, all carrying the same JSON messages:
//   local            the host's own player, in the same page
//   BroadcastChannel other tabs or windows of this browser (no network needed)
//   PeerJS / WebRTC  everyone else: a room code maps to a PeerJS id, the public PeerJS server only
//                    introduces the browsers, and game traffic then flows directly between them.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { Emitter, store } = DTA;

  const PREFIX = 'dtarena-v4-';
  const CHUNK = 5000;              // characters per data-channel message (stays under 16 KB as UTF-8)
  const SILENCE_MS = 12000;        // a connection that says nothing for this long is treated as gone

  // PeerJS options. Default: the free public PeerJS server with public STUN. Override for a self-hosted
  // server with ?peer=host:port/path (&peersecure=0), or in Settings → Connection.
  function peerOptions() {
    const opts = { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] } };
    let cfg = store.get('peerCfg', null) || {};
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('peer')) cfg = Object.assign({}, cfg, { server: q.get('peer'), secure: q.get('peersecure') !== '0' });
    } catch (e) { /* no location */ }
    if (cfg.server) {
      const m = /^([^:/]+)(?::(\d+))?(\/.*)?$/.exec(cfg.server.trim());
      if (m) {
        opts.host = m[1];
        if (m[2]) opts.port = +m[2];
        opts.path = m[3] || '/';
        opts.secure = cfg.secure !== false;
      }
    }
    if (cfg.turn) opts.config.iceServers.push({ urls: cfg.turn, username: cfg.turnUser || '', credential: cfg.turnPass || '' });
    return opts;
  }

  // Splits big JSON messages into chunks and reassembles them. Never splits a surrogate pair, so emoji
  // survive the UTF-8 round trip.
  class Packer {
    constructor() { this.parts = new Map(); this.seq = 0; }
    pack(msg) {
      const s = JSON.stringify(msg);
      if (s.length <= CHUNK) return [s];
      const pieces = [];
      let i = 0;
      while (i < s.length) {
        let j = Math.min(s.length, i + CHUNK);
        const c = s.charCodeAt(j - 1);
        if (j < s.length && c >= 0xd800 && c <= 0xdbff) j--;
        pieces.push(s.slice(i, j));
        i = j;
      }
      const id = (++this.seq).toString(36);
      return pieces.map((p, k) => '\u0001' + id + '|' + k + '|' + pieces.length + '|' + p);
    }
    unpack(d) {
      if (typeof d !== 'string') return null;
      if (d.charCodeAt(0) !== 1) { try { return JSON.parse(d); } catch (e) { return null; } }
      const p1 = d.indexOf('|'), p2 = d.indexOf('|', p1 + 1), p3 = d.indexOf('|', p2 + 1);
      if (p1 < 0 || p2 < 0 || p3 < 0) return null;
      const id = d.slice(1, p1), i = +d.slice(p1 + 1, p2), n = +d.slice(p2 + 1, p3);
      if (!(n > 0 && n <= 4000 && i >= 0 && i < n)) return null;
      let e = this.parts.get(id);
      if (!e) {
        e = { n, got: 0, arr: new Array(n) };
        this.parts.set(id, e);
        if (this.parts.size > 16) this.parts.delete(this.parts.keys().next().value);
      }
      if (e.arr[i] === undefined) { e.arr[i] = d.slice(p3 + 1); e.got++; }
      if (e.got < e.n) return null;
      this.parts.delete(id);
      try { return JSON.parse(e.arr.join('')); } catch (err) { return null; }
    }
  }

  const clone = (m) => (typeof structuredClone === 'function' ? structuredClone(m) : JSON.parse(JSON.stringify(m)));

  // ---------- host side ----------
  class HostNet extends Emitter {
    constructor(code) {
      super();
      this.code = code;
      this.conns = new Map();
      this.peer = null;
      this.bc = null;
      this.status = 'starting';
      this.statusDetail = '';
      this.seq = 0;
      this.watchdog = setInterval(() => this.checkSilence(), 3000);
    }

    setStatus(s, detail) { this.status = s; this.statusDetail = detail || ''; this.emit('status', s, detail); }

    // Practice rooms: other tabs of this browser only, no matchmaking server.
    openLocal() {
      if (typeof BroadcastChannel !== 'undefined') {
        this.bc = new BroadcastChannel('dtarena:' + this.code);
        this.bc.onmessage = (e) => this.onBc(e.data);
      }
      this.setStatus('offline', 'practice room');
      return Promise.resolve('offline');
    }

    // Resolves 'online', 'offline' (PeerJS unreachable, local play still works) or 'taken' (code in use).
    open() {
      if (typeof BroadcastChannel !== 'undefined') {
        this.bc = new BroadcastChannel('dtarena:' + this.code);
        this.bc.onmessage = (e) => this.onBc(e.data);
      }
      return new Promise((resolve) => {
        if (typeof window.Peer === 'undefined') { this.setStatus('offline', 'PeerJS did not load'); resolve('offline'); return; }
        let settled = false;
        const done = (st) => { if (!settled) { settled = true; resolve(st); } };
        let peer;
        try { peer = this.peer = new window.Peer(PREFIX + this.code, peerOptions()); } catch (e) { this.setStatus('offline', String(e.message || e)); done('offline'); return; }
        peer.on('open', () => { this.setStatus('online'); done('online'); });
        peer.on('connection', (conn) => this.onPeerConn(conn));
        peer.on('error', (err) => {
          const type = (err && err.type) || 'error';
          if (type === 'unavailable-id') { this.setStatus('taken'); done('taken'); return; }
          if (type === 'peer-unavailable') return;
          this.setStatus(this.status === 'online' ? 'online' : 'offline', type);
          done(this.status === 'online' ? 'online' : 'offline');
        });
        peer.on('disconnected', () => {
          if (peer.destroyed) return;
          this.setStatus('reconnecting');
          setTimeout(() => { try { if (!peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) { /* ignore */ } }, 2000);
        });
        setTimeout(() => done(this.status === 'online' ? 'online' : 'offline'), 10000);
      });
    }

    onPeerConn(conn) {
      const id = 'pc:' + (++this.seq);
      const packer = new Packer();
      const entry = { kind: 'peer', conn, packer, seen: Date.now(), send: (msg) => { for (const s of packer.pack(msg)) conn.send(s); } };
      conn.on('open', () => { this.conns.set(id, entry); this.emit('connect', id); });
      conn.on('data', (d) => {
        entry.seen = Date.now();
        const msg = packer.unpack(d);
        if (msg) this.emit('message', id, msg);
      });
      const gone = () => { if (this.conns.delete(id)) this.emit('disconnect', id); };
      conn.on('close', gone);
      conn.on('error', gone);
    }

    onBc(data) {
      if (!data || typeof data !== 'object' || typeof data.from !== 'string') return;
      const id = 'bc:' + data.from;
      if (data.k === 'probe') { this.bc.postMessage({ k: 'here', to: data.from, from: 'host' }); return; }
      if (data.k === 'join') {
        const from = data.from;
        const entry = { kind: 'bc', seen: Date.now(), send: (msg) => this.bc.postMessage({ k: 'msg', to: from, from: 'host', m: msg }) };
        this.conns.set(id, entry);
        this.emit('connect', id);
        return;
      }
      const entry = this.conns.get(id);
      if (!entry) return;
      entry.seen = Date.now();
      if (data.k === 'msg' && data.to === 'host') this.emit('message', id, data.m);
      else if (data.k === 'bye') { this.conns.delete(id); this.emit('disconnect', id); }
    }

    attachLocal(client) {
      const entry = { kind: 'local', seen: Date.now(), send: (msg) => { const m = clone(msg); queueMicrotask(() => client.receive(m)); } };
      this.conns.set('local', entry);
    }

    send(connId, msg) { const c = this.conns.get(connId); if (c) c.send(msg); }

    close(connId) {
      const c = this.conns.get(connId);
      if (!c) return;
      this.conns.delete(connId);
      if (c.kind === 'peer') { try { c.conn.close(); } catch (e) { /* ignore */ } }
      else if (c.kind === 'bc' && this.bc) this.bc.postMessage({ k: 'kick', to: connId.slice(3), from: 'host' });
    }

    checkSilence() {
      const now = Date.now();
      for (const [id, c] of this.conns) {
        if (c.kind === 'local') continue;
        if (now - c.seen > SILENCE_MS) { this.close(id); this.emit('disconnect', id); }
      }
    }

    destroy() {
      clearInterval(this.watchdog);
      for (const [id, c] of this.conns) {
        if (c.kind === 'peer') { try { c.conn.close(); } catch (e) { /* ignore */ } }
        void id;
      }
      if (this.bc) { try { this.bc.postMessage({ k: 'closed', from: 'host' }); this.bc.close(); } catch (e) { /* ignore */ } }
      if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
      this.conns.clear();
    }
  }

  // ---------- client side ----------
  // The host's own player: messages go straight into the host object.
  class LocalClientNet extends Emitter {
    constructor(hostNet) { super(); this.hostNet = hostNet; this.kind = 'local'; hostNet.attachLocal(this); }
    connect() { queueMicrotask(() => { this.emit('open'); this.hostNet.emit('connect', 'local'); }); return Promise.resolve('local'); }
    send(msg) { const m = clone(msg); queueMicrotask(() => this.hostNet.emit('message', 'local', m)); }
    receive(msg) { this.emit('message', msg); }
    close() { /* the page owns both ends */ }
  }

  class ClientNet extends Emitter {
    constructor() { super(); this.kind = null; this.closed = false; this.lastMsg = Date.now(); this.pingTimer = null; }

    // Resolves when connected; rejects with a readable message.
    async connect(code, opts) {
      opts = opts || {};
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 4) throw new Error('Enter the 5-letter room code');
      this.code = code;
      if (!opts.forcePeer && typeof BroadcastChannel !== 'undefined') {
        const found = await this.probeBc(code, 400);
        if (found) { this.useBc(code); return 'bc'; }
      }
      await this.usePeer(code, opts.timeout || 15000);
      return 'peer';
    }

    probeBc(code, ms) {
      return new Promise((resolve) => {
        const bc = new BroadcastChannel('dtarena:' + code);
        const me = 'probe' + Math.random().toString(36).slice(2);
        const t = setTimeout(() => { bc.close(); resolve(false); }, ms);
        bc.onmessage = (e) => { if (e.data && e.data.k === 'here' && e.data.to === me) { clearTimeout(t); bc.close(); resolve(true); } };
        bc.postMessage({ k: 'probe', from: me });
      });
    }

    useBc(code) {
      this.kind = 'bc';
      const me = 'c' + Math.random().toString(36).slice(2, 10);
      const bc = this.bc = new BroadcastChannel('dtarena:' + code);
      bc.onmessage = (e) => {
        const d = e.data;
        if (!d || typeof d !== 'object') return;
        if (d.k === 'closed' && d.from === 'host') { this.fail('The host closed the room'); return; }
        if (d.to !== me) return;
        this.lastMsg = Date.now();
        if (d.k === 'msg') this.emit('message', d.m);
        else if (d.k === 'kick') this.fail('Disconnected by the host');
      };
      this._send = (msg) => bc.postMessage({ k: 'msg', from: me, to: 'host', m: msg });
      this._bye = () => { try { bc.postMessage({ k: 'bye', from: me }); bc.close(); } catch (e) { /* ignore */ } };
      bc.postMessage({ k: 'join', from: me });
      this.startHeartbeat();
      queueMicrotask(() => this.emit('open'));
    }

    usePeer(code, timeout) {
      return new Promise((resolve, reject) => {
        if (typeof window.Peer === 'undefined') { reject(new Error('The connection library did not load. Check your internet connection and reload.')); return; }
        this.kind = 'peer';
        const packer = new Packer();
        let settled = false;
        const fail = (msg) => { if (!settled) { settled = true; this.cleanupPeer(); reject(new Error(msg)); } };
        const timer = setTimeout(() => fail('Could not reach that room. Check the code, and that the host still has the game open.'), timeout);
        let peer;
        try { peer = this.peer = new window.Peer(peerOptions()); } catch (e) { clearTimeout(timer); fail(String(e.message || e)); return; }
        peer.on('error', (err) => {
          const type = err && err.type;
          if (!settled) {
            clearTimeout(timer);
            if (type === 'peer-unavailable') fail('No room with code ' + code + '. Check the code with the host.');
            else if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') fail('Could not reach the matchmaking server. Check your internet connection.');
            else if (type === 'browser-incompatible') fail('This browser does not support WebRTC.');
            else fail('Connection failed (' + (type || 'unknown') + ').');
          } else if (type === 'peer-unavailable' || type === 'network') this.fail('Lost the connection to the host');
        });
        peer.on('open', () => {
          const conn = this.conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'raw' });
          conn.on('open', () => {
            clearTimeout(timer);
            settled = true;
            this._send = (msg) => { for (const s of packer.pack(msg)) conn.send(s); };
            this._bye = () => this.cleanupPeer();
            this.startHeartbeat();
            this.emit('open');
            resolve();
          });
          conn.on('data', (d) => { this.lastMsg = Date.now(); const m = packer.unpack(d); if (m) this.emit('message', m); });
          conn.on('close', () => { if (settled) this.fail('The connection to the host closed'); });
          conn.on('error', () => { if (settled) this.fail('Connection error'); else fail('Could not open a connection to the host.'); });
          // ICE failure shows up as the connection never opening; the timeout covers it.
        });
      });
    }

    startHeartbeat() {
      this.lastMsg = Date.now();
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (this.closed) return;
        this.send({ t: 'ping', ts: Date.now() });
        if (Date.now() - this.lastMsg > SILENCE_MS) this.fail('The host stopped responding');
      }, 2000);
    }

    send(msg) { if (!this.closed && this._send) { try { this._send(msg); } catch (e) { /* closed */ } } }

    fail(reason) {
      if (this.closed) return;
      this.closed = true;
      clearInterval(this.pingTimer);
      if (this._bye) this._bye();
      this.emit('close', reason);
    }

    cleanupPeer() {
      try { if (this.conn) this.conn.close(); } catch (e) { /* ignore */ }
      try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      clearInterval(this.pingTimer);
      if (this._bye) this._bye();
    }
  }

  DTA.net = { HostNet, ClientNet, LocalClientNet, Packer, PREFIX, peerOptions };
})();
