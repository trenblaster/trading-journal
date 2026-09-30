// Day Trade Arena: shared helpers. Seeded randomness, number formatting, small DOM helpers.
// Everything here is plain functions on window.DTA so the simulation files also run under Node for tests.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA = (typeof window !== 'undefined' ? window : globalThis).DTA || {};

  // ---------- seeded randomness ----------
  // mulberry32: tiny, fast and good enough for games. Every stream is derived from the match seed, so the
  // same seed gives the same market as long as the players' orders are the same.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Integer hash of two ints to [0,1). Used for book noise that must be the same at a price level
  // for a while (so the ladder breathes instead of flickering).
  function hash2(a, b) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  class RNG {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.next = mulberry32(this.seed);
      this._spare = null;
    }
    float() { return this.next(); }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    normal() {
      if (this._spare !== null) { const s = this._spare; this._spare = null; return s; }
      let u = 0, v = 0;
      while (u === 0) u = this.next();
      v = this.next();
      const m = Math.sqrt(-2 * Math.log(u));
      this._spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    }
    lognormal(median, sigma) { return median * Math.exp(sigma * this.normal()); }
    exp(mean) { return -mean * Math.log(1 - this.next()); }
    poisson(lambda) {
      if (lambda <= 0) return 0;
      if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * this.normal()));
      const L = Math.exp(-lambda);
      let k = 0, p = 1;
      do { k++; p *= this.next(); } while (p > L);
      return k - 1;
    }
    weighted(items, weights) {
      let total = 0;
      for (const w of weights) total += w;
      let r = this.next() * total;
      for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    }
    fork(label) { return new RNG(hashStr(this.seed + ':' + label)); }
  }

  // ---------- math ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sum = (arr) => { let s = 0; for (const v of arr) s += v; return s; };

  // ---------- formatting ----------
  const MINUS = '−';
  function groupInt(n) {
    const s = String(Math.floor(Math.abs(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtNum(v, dp = 2) {
    if (!isFinite(v)) return '—';
    const neg = v < 0;
    const fixed = Math.abs(v).toFixed(dp);
    const [i, d] = fixed.split('.');
    return (neg && +fixed !== 0 ? MINUS : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
  }
  function fmtMoney(v, dp = 2) {
    if (!isFinite(v)) return '—';
    const neg = v < 0 && Math.abs(v).toFixed(dp) !== (0).toFixed(dp);
    return (neg ? MINUS : '') + '$' + fmtNum(Math.abs(v), dp);
  }
  function fmtSignedMoney(v, dp = 2) {
    if (!isFinite(v)) return '—';
    const zero = Math.abs(v).toFixed(dp) === (0).toFixed(dp);
    return (zero ? '' : v > 0 ? '+' : MINUS) + '$' + fmtNum(Math.abs(v), dp);
  }
  function fmtCompactMoney(v) {
    const a = Math.abs(v);
    const s = v < 0 ? MINUS : '';
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return s + '$' + (a / 1e3).toFixed(1) + 'K';
    return s + '$' + fmtNum(a, a >= 1000 ? 0 : 2);
  }
  function fmtPct(v, dp = 2, signed = true) {
    if (!isFinite(v)) return '—';
    const zero = Math.abs(v * 100).toFixed(dp) === (0).toFixed(dp);
    return (signed && !zero ? (v > 0 ? '+' : MINUS) : (v < 0 && !zero ? MINUS : '')) + Math.abs(v * 100).toFixed(dp) + '%';
  }
  function fmtQty(n) {
    const a = Math.abs(n);
    const s = n < 0 ? MINUS : '';
    if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
    if (a >= 1e4) return s + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
    return s + groupInt(a);
  }
  function fmtInt(n) { return (n < 0 ? MINUS : '') + groupInt(n); }
  // Decimals a tick size needs: 0.25 → 2, 0.1 → 1, 0.01 → 2, 0.0001 → 4.
  function decimalsForTick(tick) {
    let d = 0;
    while (d < 6 && Math.abs(Math.round(tick * 10 ** d) - tick * 10 ** d) > 1e-7) d++;
    return d;
  }
  function fmtPrice(p, tick = 0.01) { return isFinite(p) ? p.toFixed(decimalsForTick(tick)) : '—'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // Market clock: seconds since midnight → "10:42:15".
  // Clock time of day. Times before today's midnight (yesterday's session, the overnight) wrap to 0–24h.
  function fmtClock(sec, withSeconds = true) {
    sec = ((Math.floor(sec) % 86400) + 86400) % 86400;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h + ':' + pad2(m) + (withSeconds ? ':' + pad2(s) : '');
  }
  function fmtDuration(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    return m + ':' + pad2(s % 60);
  }
  function fmtHold(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ' + pad2(sec % 60) + 's';
    return Math.floor(sec / 3600) + 'h ' + pad2(Math.floor((sec % 3600) / 60)) + 'm';
  }
  function parseClock(str) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(str).trim());
    if (!m) return null;
    return (+m[1]) * 3600 + (+m[2]) * 60 + (m[3] ? +m[3] : 0);
  }

  // ---------- ids ----------
  let uidCounter = 0;
  function uid(prefix = 'id') {
    uidCounter = (uidCounter + 1) % 1e9;
    return prefix + Date.now().toString(36).slice(-5) + uidCounter.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function roomCode(len = 5) {
    let s = '';
    const buf = new Uint32Array(len);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
    else for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 4294967296);
    for (let i = 0; i < len; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return s;
  }
  function randomToken() {
    const buf = new Uint32Array(4);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
    else for (let i = 0; i < 4; i++) buf[i] = Math.floor(Math.random() * 4294967296);
    return Array.from(buf, (n) => n.toString(36)).join('');
  }

  // ---------- events ----------
  class Emitter {
    constructor() { this._h = {}; }
    on(type, fn) { (this._h[type] || (this._h[type] = [])).push(fn); return () => this.off(type, fn); }
    off(type, fn) { const l = this._h[type]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
    emit(type, a, b, c) {
      const l = this._h[type];
      if (!l) return;
      for (const fn of l.slice()) {
        try { fn(a, b, c); } catch (e) { console.error('[DTA] handler for', type, 'failed:', e); }
      }
    }
  }

  // ---------- DOM (browser only) ----------
  const hasDOM = typeof document !== 'undefined';
  function $(sel, root) { return hasDOM ? (root || document).querySelector(sel) : null; }
  function $$(sel, root) { return hasDOM ? Array.from((root || document).querySelectorAll(sel)) : []; }
  // el('div.card#main', {onclick, title, dataset}, [children|string])
  function el(spec, attrs, children) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    const node = document.createElement(m[1] || 'div');
    const rest = m[2] || '';
    rest.replace(/([.#])([\w-]+)/g, (_, kind, name) => {
      if (kind === '.') node.classList.add(name); else node.id = name;
      return '';
    });
    if (attrs && (typeof attrs !== 'object' || Array.isArray(attrs) || attrs instanceof Node)) { children = attrs; attrs = null; }
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k in node && typeof v !== 'string') node[k] = v;
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    appendChildren(node, children);
    return node;
  }
  function appendChildren(node, children) {
    if (children === undefined || children === null || children === false) return;
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
      if (c === undefined || c === null || c === false) continue;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Canvas that tracks its CSS size and device pixel ratio. Returns {ctx, w, h, dpr} after resize().
  function fitCanvas(canvas) {
    const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  function cssVar(name, fallback) {
    if (!hasDOM) return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // Safe localStorage (private windows and blocked storage throw).
  const store = {
    get(key, fallback) {
      try { const raw = localStorage.getItem('dta:' + key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('dta:' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
    del(key) { try { localStorage.removeItem('dta:' + key); } catch (e) { /* ignore */ } }
  };

  function downloadText(filename, text, mime = 'text/csv') {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function csvCell(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  Object.assign(DTA, {
    RNG, hashStr, hash2, clamp, lerp, sum,
    MINUS, fmtNum, fmtMoney, fmtSignedMoney, fmtCompactMoney, fmtPct, fmtQty, fmtInt, fmtPrice, decimalsForTick,
    fmtClock, fmtDuration, fmtHold, parseClock, pad2,
    uid, roomCode, randomToken, CODE_ALPHABET,
    Emitter, $, $$, el, esc, fitCanvas, cssVar, store, downloadText, csvCell, appendChildren
  });
})();
