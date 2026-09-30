// Day Trade Arena: key levels and confluence. Shared by the host (price reacts to these levels) and every
// player's chart (which draws them), so both always agree on where the levels are.
//
// Levels: prior day high/low/close and value area (POC, VAH, VAL), the overnight range (futures) or the
// premarket range (stocks), the opening range, the initial balance (first hour), high and low of day,
// session VWAP and round numbers. Levels within a few ticks of each other merge into a confluence zone,
// and a zone is stronger than any one of its levels.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;

  const DAY_SEC = 86400;
  const ON_START = -6 * 3600;        // 18:00 the evening before: the futures overnight (Globex) session
  const PM_START = 4 * 3600;         // 4:00: premarket for stocks
  const BREAK = [17 * 3600, 18 * 3600];

  const KINDS = {
    PDH: { label: 'PDH', name: 'Prior day high', s: 0.8, grp: 'pd' },
    PDL: { label: 'PDL', name: 'Prior day low', s: 0.8, grp: 'pd' },
    PDC: { label: 'PDC', name: 'Prior close', s: 0.55, grp: 'pd' },
    POC: { label: 'pPOC', name: 'Prior day point of control', s: 0.5, grp: 'vp' },
    VAH: { label: 'pVAH', name: 'Prior value area high', s: 0.42, grp: 'vp' },
    VAL: { label: 'pVAL', name: 'Prior value area low', s: 0.42, grp: 'vp' },
    ONH: { label: 'ONH', name: 'Overnight high', s: 0.65, grp: 'on' },
    ONL: { label: 'ONL', name: 'Overnight low', s: 0.65, grp: 'on' },
    PMH: { label: 'PMH', name: 'Premarket high', s: 0.72, grp: 'on' },
    PML: { label: 'PML', name: 'Premarket low', s: 0.55, grp: 'on' },
    ORH: { label: 'ORH', name: 'Opening range high', s: 0.55, grp: 'or' },
    ORL: { label: 'ORL', name: 'Opening range low', s: 0.55, grp: 'or' },
    IBH: { label: 'IBH', name: 'Initial balance high (first hour)', s: 0.55, grp: 'ib' },
    IBL: { label: 'IBL', name: 'Initial balance low (first hour)', s: 0.55, grp: 'ib' },
    HOD: { label: 'HOD', name: 'High of day', s: 0.5, grp: 'day' },
    LOD: { label: 'LOD', name: 'Low of day', s: 0.5, grp: 'day' },
    VWAP: { label: 'VWAP', name: 'Session VWAP', s: 0.45, grp: 'vwap' },
    RN: { label: '', name: 'Round number', s: 0.48, grp: 'rn' },
    rn: { label: '', name: 'Round number', s: 0.24, grp: 'rn' }
  };

  const tod = (t) => ((t % DAY_SEC) + DAY_SEC) % DAY_SEC;
  const isFut = (meta) => meta.kind === 'future';

  // What part of the trading day time t falls in: 'rth', 'on' (futures overnight), 'pre' (stock
  // premarket), 'post' (futures after the cash close) or 'closed'.
  function sessionAt(meta, t) {
    const h = tod(t);
    const [a, b] = meta.rth;
    if (h >= a && h < b) return 'rth';
    if (isFut(meta)) {
      if (h >= BREAK[0] && h < BREAK[1]) return 'closed';
      if (h >= b && h < BREAK[0]) return 'post';
      return 'on';
    }
    if (h >= PM_START && h < a) return 'pre';
    return 'closed';
  }
  const isOpen = (meta, t) => sessionAt(meta, t) !== 'closed';

  // Contiguous sessions between t0 and t1: [[start, end, kind]].
  function segments(meta, t0, t1) {
    const out = [];
    let t = t0, cur = sessionAt(meta, t0), s0 = t0;
    const edges = [];
    for (let d = Math.floor(t0 / DAY_SEC) - 1; d <= Math.floor(t1 / DAY_SEC) + 1; d++) {
      for (const e of [meta.rth[0], meta.rth[1], PM_START, BREAK[0], BREAK[1]]) edges.push(d * DAY_SEC + e);
    }
    edges.sort((x, y) => x - y);
    for (const e of edges) {
      if (e <= t0 || e >= t1) continue;
      const k = sessionAt(meta, e);
      if (k !== cur) { out.push([s0, e, cur]); s0 = e; cur = k; }
      t = e;
    }
    out.push([s0, t1, cur]);
    void t;
    return out;
  }

  // Windows used by the levels, in seconds from today's midnight.
  // off shifts every window by whole days (−86400 gives yesterday's).
  function windows(meta, off) {
    off = off || 0;
    const a = meta.rth[0] + off, b = meta.rth[1] + off;
    return {
      prior: [a - DAY_SEC, b - DAY_SEC],
      on: [(isFut(meta) ? ON_START : PM_START) + off, a],
      rth: [a, b],
      or: [a, a + (meta.orMin || 15) * 60],
      ib: [a, a + 3600]
    };
  }

  // ---------- history packing (1-minute bars travel delta-encoded) ----------
  // bars: [[t, o, h, l, c, v, buyVol]] with prices in ticks.
  function packBars(bars) {
    const out = [];
    let pt = null, pc = null;
    for (const b of bars) {
      out.push(pt === null ? b[0] : (b[0] - pt) / 60, pc === null ? b[1] : b[1] - pc, b[2] - b[1], b[1] - b[3], b[4] - b[1], b[5], b[6]);
      pt = b[0]; pc = b[4];
    }
    return out;
  }
  function unpackBars(flat) {
    const out = [];
    let pt = null, pc = null;
    for (let i = 0; i + 6 < flat.length; i += 7) {
      const t = pt === null ? flat[i] : pt + flat[i] * 60;
      const o = pc === null ? flat[i + 1] : pc + flat[i + 1];
      const b = [t, o, o + flat[i + 2], o - flat[i + 3], o + flat[i + 4], flat[i + 5], flat[i + 6]];
      out.push(b);
      pt = t; pc = b[4];
    }
    return out;
  }

  // ---------- volume profile ----------
  // Volume at price over bars [[t,o,h,l,c,v]], binned so there are about 120 bins. Returns POC and 70% value area.
  function profile(bars) {
    let lo = Infinity, hi = -Infinity, tot = 0;
    for (const b of bars) { if (b[3] < lo) lo = b[3]; if (b[2] > hi) hi = b[2]; tot += b[5]; }
    if (!bars.length || !isFinite(lo)) return null;
    const bin = Math.max(1, Math.round((hi - lo) / 120));
    const n = Math.floor((hi - lo) / bin) + 1;
    const vol = new Array(n).fill(0);
    for (const b of bars) {
      const i0 = Math.floor((b[3] - lo) / bin), i1 = Math.floor((b[2] - lo) / bin);
      const share = b[5] / (i1 - i0 + 1);
      for (let i = i0; i <= i1; i++) vol[i] += share;
    }
    let poc = 0;
    for (let i = 1; i < n; i++) if (vol[i] > vol[poc]) poc = i;
    let a = poc, z = poc, inside = vol[poc];
    while (inside < tot * 0.7 && (a > 0 || z < n - 1)) {
      const dn = a > 0 ? vol[a - 1] : -1, up = z < n - 1 ? vol[z + 1] : -1;
      if (up >= dn) { z++; inside += vol[z]; } else { a--; inside += vol[a]; }
    }
    const mid = (i) => lo + i * bin + Math.floor(bin / 2);
    return { poc: mid(poc), vah: lo + z * bin + bin - 1, val: lo + a * bin, bin, lo, hi, vol };
  }

  // Levels fixed before today's session: prior day and its value area. hist: 1-minute bars.
  function priorLevels(meta, hist) {
    const w = windows(meta);
    const pd = hist.filter((b) => b[0] >= w.prior[0] && b[0] < w.prior[1]);
    const out = [];
    if (!pd.length) return out;
    let hi = -Infinity, lo = Infinity;
    for (const b of pd) { if (b[2] > hi) hi = b[2]; if (b[3] < lo) lo = b[3]; }
    out.push({ k: 'PDH', idx: hi }, { k: 'PDL', idx: lo }, { k: 'PDC', idx: pd[pd.length - 1][4] });
    const vp = profile(pd);
    if (vp) out.push({ k: 'POC', idx: vp.poc }, { k: 'VAH', idx: vp.vah }, { k: 'VAL', idx: vp.val });
    return out;
  }

  // ---------- developing levels ----------
  // Feed bars in time order (1-minute history, then 5-second live bars); the last bar may still be forming.
  class Developing {
    constructor(meta, off) { this.meta = meta; this.w = windows(meta, off); this.reset(); }
    reset() {
      this.onH = null; this.onL = null; this.hod = null; this.lod = null;
      this.orH = null; this.orL = null; this.ibH = null; this.ibL = null;
      this.pv = 0; this.vv = 0; this.vwStart = null; this.lastEnd = -Infinity; this.committed = 0; this.rthOpen = null;
    }
    // Add one completed bar [t, o, h, l, c, v] lasting dur seconds.
    add(b, dur) {
      const t = b[0], w = this.w;
      if (t + dur <= w.on[0] || t >= w.rth[1]) { this.lastEnd = Math.max(this.lastEnd, t + dur); return; }
      if (t < w.rth[0]) {
        if (this.onH === null || b[2] > this.onH) this.onH = b[2];
        if (this.onL === null || b[3] < this.onL) this.onL = b[3];
        if (this.vwStart !== 'on') { this.vwStart = 'on'; this.pv = 0; this.vv = 0; }
      } else {
        if (this.vwStart !== 'rth') { this.vwStart = 'rth'; this.pv = 0; this.vv = 0; this.rthOpen = b[1]; }
        if (this.hod === null || b[2] > this.hod) this.hod = b[2];
        if (this.lod === null || b[3] < this.lod) this.lod = b[3];
        if (t < w.or[1]) { if (this.orH === null || b[2] > this.orH) this.orH = b[2]; if (this.orL === null || b[3] < this.orL) this.orL = b[3]; }
        if (t < w.ib[1]) { if (this.ibH === null || b[2] > this.ibH) this.ibH = b[2]; if (this.ibL === null || b[3] < this.ibL) this.ibL = b[3]; }
      }
      const tp = (b[2] + b[3] + b[4]) / 3;
      this.pv += tp * b[5]; this.vv += b[5];
      this.lastEnd = Math.max(this.lastEnd, t + dur);
    }
    vwap() { return this.vv > 0 ? this.pv / this.vv : null; }
    // Levels as of time `now`. Opening range and initial balance only count once their window has closed.
    // For the host's price reactions, a high or low of day only matters after price has left it (minAway ticks).
    list(now, lastIdx, minAway) {
      const out = [], w = this.w, fut = isFut(this.meta);
      const away = (v) => minAway === undefined || lastIdx === undefined || Math.abs(v - lastIdx) >= minAway;
      const inRth = now >= w.rth[0];
      if (this.onH !== null && (inRth || away(this.onH))) out.push({ k: fut ? 'ONH' : 'PMH', idx: this.onH, dev: !inRth });
      if (this.onL !== null && (inRth || away(this.onL))) out.push({ k: fut ? 'ONL' : 'PML', idx: this.onL, dev: !inRth });
      if (inRth) {
        if (this.orH !== null && now >= w.or[1]) out.push({ k: 'ORH', idx: this.orH }, { k: 'ORL', idx: this.orL });
        if (this.ibH !== null && now >= w.ib[1] && this.meta.cls !== 'small') out.push({ k: 'IBH', idx: this.ibH }, { k: 'IBL', idx: this.ibL });
        if (this.hod !== null && away(this.hod)) out.push({ k: 'HOD', idx: this.hod, dev: true });
        if (this.lod !== null && away(this.lod)) out.push({ k: 'LOD', idx: this.lod, dev: true });
      }
      const vw = this.vwap();
      if (vw !== null) out.push({ k: 'VWAP', idx: Math.round(vw), dev: true });
      return out;
    }
  }

  // Round numbers between lo and hi (ticks). meta.round = [minor, major] in price.
  function roundLevels(meta, lo, hi) {
    const out = [];
    if (!meta.round) return out;
    const [mi, ma] = meta.round;
    const tick = meta.tick;
    let step = mi;
    if ((hi - lo) * tick / mi > 40) step = ma;
    const k0 = Math.ceil((lo * tick) / step - 1e-9), k1 = Math.floor((hi * tick) / step + 1e-9);
    for (let k = k0; k <= k1 && out.length < 60; k++) {
      const px = k * step;
      const major = Math.abs(px / ma - Math.round(px / ma)) < 1e-7;
      out.push({ k: major ? 'RN' : 'rn', idx: Math.round(px / tick) });
    }
    return out;
  }

  // Confluence tolerance in ticks for a price (in ticks).
  function tolerance(meta, idx) {
    if (meta.conf) return meta.conf;
    const px = idx * meta.tick;
    return Math.max(2, Math.round((px * (meta.cls === 'small' ? 0.004 : 0.00035)) / meta.tick));
  }

  // Merge nearby levels into zones: [{idx, lo, hi, s, members, label, key}] sorted by price.
  function zones(meta, levels) {
    const list = levels.filter((l) => l.idx > 0).map((l) => Object.assign({ s: (KINDS[l.k] || KINDS.rn).s }, l)).sort((a, b) => a.idx - b.idx);
    const out = [];
    let cur = null;
    for (const l of list) {
      const tol = tolerance(meta, l.idx);
      if (cur && l.idx - cur.hi <= tol) { cur.members.push(l); cur.hi = l.idx; }
      else { cur = { lo: l.idx, hi: l.idx, members: [l] }; out.push(cur); }
    }
    for (const z of out) {
      let keep = 1, sw = 0, sx = 0;
      z.members.sort((a, b) => b.s - a.s);
      for (const m of z.members) { keep *= 1 - m.s; sw += m.s; sx += m.s * m.idx; }
      z.s = 1 - keep;
      z.idx = Math.round(sx / sw);
      const named = z.members.filter((m) => KINDS[m.k].label);
      z.label = named.map((m) => KINDS[m.k].label).join(' · ') || roundLabel(meta, z.idx);
      z.key = z.members[0].k + ':' + z.members[0].idx;
      z.n = named.length + (z.members.some((m) => !KINDS[m.k].label) ? 1 : 0);
    }
    return out;
  }
  function roundLabel(meta, idx) {
    const px = idx * meta.tick;
    return px >= 1000 ? String(Math.round(px)) : px.toFixed(px >= 100 ? 0 : 2);
  }

  // Everything together for a chart or a bot: static prior levels + developing + round numbers near price.
  function allLevels(meta, prior, dev, now, lastIdx, span) {
    const list = prior.slice();
    if (dev) for (const l of dev.list(now, lastIdx)) list.push(l);
    if (lastIdx) {
      const r = Math.max(span || 0, lastIdx * 0.03);
      for (const l of roundLevels(meta, lastIdx - r, lastIdx + r)) list.push(l);
    }
    return list;
  }

  DTA.levels = {
    KINDS, DAY_SEC, ON_START, PM_START, sessionAt, isOpen, segments, windows, packBars, unpackBars, profile,
    priorLevels, Developing, roundLevels, zones, tolerance, allLevels, tod
  };
})();
