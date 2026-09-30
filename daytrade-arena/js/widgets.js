// Day Trade Arena: smaller canvas widgets. Price ladder (DOM), time & sales, depth chart, sparklines,
// the equity race and the buying-power gauge.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { clamp, fmtPrice, fmtQty, fmtClock, fitCanvas, alpha, roundRect, fmtPct, fmtSignedMoney } = DTA;
  const FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
  const FONT_B = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
  const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  // Volume traded at each price (in ticks), rebuilt incrementally from the 5-second bars.
  function updateVap(s) {
    let v = s.vap;
    if (!v || v.uid !== s.uid) v = s.vap = { uid: s.uid, map: new Map(), n: 0, last: null, max: 0 };
    if (v.last) { for (const [k, q] of v.last) v.map.set(k, (v.map.get(k) || 0) - q); v.n = Math.max(0, v.n - 1); v.last = null; }
    for (let i = v.n; i < s.bars.length; i++) {
      const b = s.bars[i];
      if (!b[4]) continue;
      const lo = b[2], hi = Math.min(b[1], b[2] + 300);
      const share = b[4] / (hi - lo + 1);
      const contrib = [];
      for (let k = lo; k <= hi; k++) { v.map.set(k, (v.map.get(k) || 0) + share); contrib.push([k, share]); }
      if (i === s.bars.length - 1) v.last = contrib;
    }
    v.n = s.bars.length;
    return v;
  }
  DTA.updateVap = updateVap;

  // ---------- price ladder ----------
  class Ladder {
    // env: {sym(), orders(sym), onLimit(side, px), onStop(side, px), onCancelAt(sym, px)}
    constructor(canvas, env) {
      this.cv = canvas; this.env = env;
      this.center = null; this.follow = true; this.rowH = 19;
      this.flash = new Map(); this.seenTape = 0; this.tapeUid = null;
      this.hover = null; this.dirty = true; this.th = DTA.chartTheme();
      canvas.addEventListener('pointermove', (e) => { this.hover = this.cellAt(e); this.dirty = true; canvas.style.cursor = this.hover && this.hover.col !== 'price' && this.hover.col !== 'vol' ? 'pointer' : 'default'; });
      canvas.addEventListener('pointerleave', () => { this.hover = null; this.dirty = true; });
      canvas.addEventListener('click', (e) => this.onClick(e, false));
      canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onClick(e, true); });
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (this.center === null) return; this.follow = false; this.center += e.deltaY > 0 ? -2 : 2; this.dirty = true; if (this.env.onScroll) this.env.onScroll(false); }, { passive: false });
    }
    refreshTheme() { this.th = DTA.chartTheme(); this.dirty = true; }
    recenter() { this.follow = true; this.center = null; this.dirty = true; if (this.env.onScroll) this.env.onScroll(true); }

    cols(w) {
      const my = w < 300 ? 34 : 44, price = w < 300 ? 56 : 62;
      const rest = Math.max(60, w - my * 2 - price);
      const side = rest * 0.36, vol = rest - side * 2;
      let x = 0;
      const c = {};
      c.myBid = [x, my]; x += my;
      c.bid = [x, side]; x += side;
      c.price = [x, price]; x += price;
      c.ask = [x, side]; x += side;
      c.myAsk = [x, my]; x += my;
      c.vol = [x, vol];
      return c;
    }

    cellAt(e) {
      const r = this.cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (!this.geo || y < this.geo.head) return null;
      const row = Math.floor((y - this.geo.head) / this.rowH);
      const idx = this.geo.topIdx - row;
      let col = null;
      for (const k in this.geo.c) { const [cx, cw] = this.geo.c[k]; if (x >= cx && x < cx + cw) col = k; }
      return { row, idx, col };
    }

    onClick(e, right) {
      const cell = this.cellAt(e);
      const s = this.env.sym();
      if (!cell || !s) return;
      const px = cell.idx * s.tick;
      if (cell.col === 'myBid' || cell.col === 'myAsk') { this.env.onCancelAt(s.sym, px); return; }
      const bestBid = s.bid, bestAsk = s.ask;
      if (cell.col === 'bid') {
        if (right || (bestAsk !== null && cell.idx >= bestAsk)) this.env.onStop(1, px); // above the market a buy is a stop
        else this.env.onLimit(1, px);
      } else if (cell.col === 'ask') {
        if (right || (bestBid !== null && cell.idx <= bestBid)) this.env.onStop(-1, px);
        else this.env.onLimit(-1, px);
      }
    }

    render() {
      const cv = this.cv;
      if (cv.offsetParent === null) return;
      const { ctx, w, h } = fitCanvas(cv);
      const th = this.th;
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
      const s = this.env.sym();
      if (!s) return;
      const head = 22;
      this.rowH = w < 300 ? 20 : 19;
      const rows = Math.max(5, Math.floor((h - head) / this.rowH));
      const bid = s.bid, ask = s.ask;
      const mid = bid !== null && ask !== null ? (bid + ask) / 2 : s.last;
      if (this.center === null) this.center = Math.round(mid);
      if (this.follow) {
        const off = Math.abs(mid - this.center);
        if (off > rows * 0.4) this.center = Math.round(mid);
        else if (off > rows * 0.22) this.center += Math.sign(mid - this.center) * Math.max(1, Math.round(off * 0.5));
      }
      const half = Math.floor(rows / 2);
      const topIdx = Math.round(this.center) + half;
      const c = this.cols(w);
      this.geo = { head, topIdx, c };
      // Flash rows that just printed.
      if (this.tapeUid !== s.uid) { this.tapeUid = s.uid; this.seenTape = s.tape.length; }
      const now = performance.now();
      if (s.tape.length < this.seenTape) this.seenTape = 0;
      for (let k = this.seenTape; k < s.tape.length; k++) { const pr = s.tape[k]; this.flash.set(pr[1], { t: now, side: pr[3], q: pr[2] }); }
      this.seenTape = s.tape.length;
      // Book, my orders and volume at price.
      const bm = new Map(), am = new Map();
      for (const l of s.book.b || []) bm.set(l[0], l[1]);
      for (const l of s.book.a || []) am.set(l[0], l[1]);
      let mx = 1;
      for (let r = 0; r < rows; r++) { const idx = topIdx - r; mx = Math.max(mx, bm.get(idx) || 0, am.get(idx) || 0); }
      const mine = new Map();
      for (const o of this.env.orders(s.sym)) {
        const p = o.type === 'LMT' ? o.px : o.stop;
        if (!p) continue;
        const idx = Math.round(p / s.tick);
        const m = mine.get(idx) || { b: 0, a: 0, bs: false, as: false };
        if (o.side > 0) { m.b += o.qty - o.filled; if (o.type !== 'LMT') m.bs = true; } else { m.a += o.qty - o.filled; if (o.type !== 'LMT') m.as = true; }
        mine.set(idx, m);
      }
      const vap = updateVap(s);
      let vmx = 1;
      for (let r = 0; r < rows; r++) vmx = Math.max(vmx, vap.map.get(topIdx - r) || 0);
      // Header.
      ctx.font = FONT; ctx.fillStyle = th.text3; ctx.textAlign = 'center';
      const hdr = [['myBid', 'Buy'], ['bid', 'Bid size'], ['price', 'Price'], ['ask', 'Ask size'], ['myAsk', 'Sell'], ['vol', 'Volume']];
      for (const [k, t] of hdr) ctx.fillText(t, c[k][0] + c[k][1] / 2, 15);
      ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(0, head - 0.5); ctx.lineTo(w, head - 0.5); ctx.stroke();
      const dp = DTA.decimalsForTick(s.tick);
      const pos = this.env.position ? this.env.position(s.sym) : null;
      const avgIdx = pos && pos.qty ? Math.round(pos.avg / s.tick) : null;
      for (let r = 0; r < rows; r++) {
        const idx = topIdx - r;
        const y = head + r * this.rowH;
        const rh = this.rowH;
        // Row tint: bids below, asks above, neutral in the spread.
        if (bid !== null && idx <= bid) { ctx.fillStyle = alpha(th.up, 0.045); ctx.fillRect(0, y, w, rh); }
        else if (ask !== null && idx >= ask) { ctx.fillStyle = alpha(th.down, 0.045); ctx.fillRect(0, y, w, rh); }
        if (this.hover && this.hover.row === r) { ctx.fillStyle = alpha(th.text, 0.05); ctx.fillRect(0, y, w, rh); }
        const fl = this.flash.get(idx);
        if (fl) {
          const age = (now - fl.t) / 700;
          if (age >= 1) this.flash.delete(idx);
          else { ctx.fillStyle = alpha(fl.side > 0 ? th.up : fl.side < 0 ? th.down : th.warn, 0.35 * (1 - age)); ctx.fillRect(c.price[0], y, c.price[1], rh); this.dirty = true; }
        }
        // Size bars.
        const bq = bm.get(idx), aq = am.get(idx);
        ctx.textBaseline = 'middle';
        if (bq) {
          const bw = (bq / mx) * (c.bid[1] - 4);
          ctx.fillStyle = alpha(th.up, idx === bid ? 0.5 : 0.28);
          ctx.fillRect(c.bid[0] + c.bid[1] - 2 - bw, y + 2, bw, rh - 4);
          ctx.fillStyle = th.text; ctx.font = idx === bid ? FONT_B : FONT; ctx.textAlign = 'right';
          ctx.fillText(fmtQty(bq), c.bid[0] + c.bid[1] - 6, y + rh / 2 + 0.5);
        }
        if (aq) {
          const aw = (aq / mx) * (c.ask[1] - 4);
          ctx.fillStyle = alpha(th.down, idx === ask ? 0.5 : 0.28);
          ctx.fillRect(c.ask[0] + 2, y + 2, aw, rh - 4);
          ctx.fillStyle = th.text; ctx.font = idx === ask ? FONT_B : FONT; ctx.textAlign = 'left';
          ctx.fillText(fmtQty(aq), c.ask[0] + 6, y + rh / 2 + 0.5);
        }
        // Price.
        const isLast = idx === s.last;
        ctx.font = isLast || idx === bid || idx === ask ? FONT_B : FONT;
        ctx.fillStyle = idx === avgIdx ? th.warn : isLast ? th.text : th.text2;
        ctx.textAlign = 'center';
        ctx.fillText((idx * s.tick).toFixed(dp), c.price[0] + c.price[1] / 2, y + rh / 2 + 0.5);
        if (isLast) { ctx.strokeStyle = th.text2; ctx.lineWidth = 1; ctx.strokeRect(c.price[0] + 1.5, y + 1.5, c.price[1] - 3, rh - 3); }
        if (idx === avgIdx) { ctx.fillStyle = th.warn; ctx.fillRect(c.price[0], y + 3, 3, rh - 6); }
        // My orders.
        const m = mine.get(idx);
        if (m && m.b) this.chip(ctx, c.myBid, y, rh, m.b, m.bs ? th.warn : th.up);
        if (m && m.a) this.chip(ctx, c.myAsk, y, rh, m.a, m.as ? th.warn : th.down);
        // Volume at price.
        const vv = vap.map.get(idx);
        if (vv > 0) {
          const vw = (vv / vmx) * (c.vol[1] - 8);
          ctx.fillStyle = alpha(th.s4, 0.3); ctx.fillRect(c.vol[0] + 4, y + 4, vw, rh - 8);
          ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'left';
          if (c.vol[1] > 44) ctx.fillText(fmtQty(Math.round(vv)), c.vol[0] + 6, y + rh / 2 + 0.5);
        }
        ctx.textBaseline = 'alphabetic';
      }
      // Hover hint.
      if (this.hover && (this.hover.col === 'bid' || this.hover.col === 'ask')) {
        const px = this.hover.idx * s.tick;
        const buy = this.hover.col === 'bid';
        const stop = buy ? ask !== null && this.hover.idx >= ask : bid !== null && this.hover.idx <= bid;
        const txt = (buy ? 'Buy ' : 'Sell ') + (stop ? 'stop' : 'limit') + ' @ ' + px.toFixed(dp) + '  ·  right-click: stop';
        ctx.font = FONT;
        const tw = ctx.measureText(txt).width + 14;
        const y = head + this.hover.row * this.rowH - 22;
        const x = clamp((buy ? c.bid[0] : c.ask[0]), 2, w - tw - 2);
        ctx.fillStyle = alpha(th.panel, 0.96); roundRect(ctx, x, Math.max(head, y), tw, 18, 4); ctx.fill();
        ctx.strokeStyle = th.axis; ctx.stroke();
        ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.fillText(txt, x + 7, Math.max(head, y) + 13);
      }
    }

    chip(ctx, col, y, rh, qty, color) {
      const th = this.th;
      roundRect(ctx, col[0] + 3, y + 2, col[1] - 6, rh - 4, 3);
      ctx.fillStyle = alpha(color, 0.25); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = th.text; ctx.font = FONT_B; ctx.textAlign = 'center';
      ctx.fillText(fmtQty(qty), col[0] + col[1] / 2, y + rh / 2 + 0.5);
    }
  }

  // ---------- time & sales ----------
  class Tape {
    constructor(canvas, env) { this.cv = canvas; this.env = env; this.th = DTA.chartTheme(); this.dirty = true; this.offset = 0; this.lastLen = 0; this.lastUid = null; }
    refreshTheme() { this.th = DTA.chartTheme(); this.dirty = true; }
    render() {
      const cv = this.cv;
      if (cv.offsetParent === null) return;
      const { ctx, w, h } = fitCanvas(cv);
      const th = this.th;
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
      const s = this.env.sym();
      if (!s) return;
      const minSize = this.env.minSize ? this.env.minSize() : 0;
      const tape = s.tape;
      if (this.lastUid !== s.uid) { this.lastUid = s.uid; this.lastLen = tape.length; }
      const added = Math.max(0, tape.length - this.lastLen);
      this.lastLen = tape.length;
      const rowH = 17;
      if (added) this.offset = Math.min(rowH * 3, this.offset + added * rowH * 0.6);
      if (this.offset > 0.5) { this.offset *= 0.7; this.dirty = true; } else this.offset = 0;
      // Big print threshold: 4x the median of recent prints.
      const recent = tape.slice(-120).map((p) => p[2]).sort((a, b) => a - b);
      const med = recent.length ? recent[Math.floor(recent.length / 2)] : 0;
      const big = med * 4;
      ctx.font = FONT; ctx.fillStyle = th.text3; ctx.textAlign = 'left';
      ctx.fillText('Time', 8, 14); ctx.textAlign = 'right'; ctx.fillText('Price', w * 0.62, 14); ctx.fillText('Size', w - 8, 14);
      ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(0, 21.5); ctx.lineTo(w, 21.5); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 22, w, h - 22); ctx.clip();
      let y = 22 - this.offset;
      const dp = DTA.decimalsForTick(s.tick);
      for (let k = tape.length - 1; k >= 0 && y < h; k--) {
        const p = tape[k];
        if (p[2] < minSize) continue;
        const col = p[3] > 0 ? th.up : p[3] < 0 ? th.down : th.warn;
        const isBig = p[2] >= big && big > 0;
        if (isBig) { ctx.fillStyle = alpha(col, 0.16); ctx.fillRect(0, y, w, rowH); }
        ctx.textBaseline = 'middle';
        ctx.font = isBig ? FONT_B : FONT;
        ctx.fillStyle = th.text3; ctx.textAlign = 'left'; ctx.fillText(fmtClock(p[0]), 8, y + rowH / 2);
        ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.fillText((p[1] * s.tick).toFixed(dp), w * 0.62, y + rowH / 2);
        ctx.fillStyle = isBig ? th.text : th.text2; ctx.fillText(fmtQty(p[2]), w - 8, y + rowH / 2);
        if (p[4] & 3) { ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(w * 0.62 + 10, y + rowH / 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
        if (p[4] & 4) { ctx.fillStyle = th.warn; ctx.textAlign = 'left'; ctx.fillText('reopen', w * 0.62 + 16, y + rowH / 2); }
        ctx.textBaseline = 'alphabetic';
        y += rowH;
      }
      ctx.restore();
    }
  }

  // ---------- depth chart ----------
  class Depth {
    constructor(canvas, env) {
      this.cv = canvas; this.env = env; this.th = DTA.chartTheme(); this.mx = null;
      canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); this.mx = e.clientX - r.left; });
      canvas.addEventListener('pointerleave', () => { this.mx = null; });
    }
    refreshTheme() { this.th = DTA.chartTheme(); }
    render() {
      const cv = this.cv;
      if (cv.offsetParent === null) return;
      const { ctx, w, h } = fitCanvas(cv);
      const th = this.th;
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
      const s = this.env.sym();
      if (!s || !s.book || !s.book.b.length || !s.book.a.length) { ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'center'; ctx.fillText(s && s.halted ? 'Halted: no book' : 'No book yet', w / 2, h / 2); return; }
      const b = s.book.b, a = s.book.a;
      const cb = [], ca = [];
      let sum = 0;
      for (const l of b) { sum += l[1]; cb.push([l[0], sum]); }
      sum = 0;
      for (const l of a) { sum += l[1]; ca.push([l[0], sum]); }
      const lo = cb[cb.length - 1][0], hi = ca[ca.length - 1][0];
      const maxC = Math.max(cb[cb.length - 1][1], ca[ca.length - 1][1]);
      const pad = 18;
      const x = (idx) => ((idx - lo) / Math.max(1, hi - lo)) * (w - 2) + 1;
      const y = (q) => h - pad - (q / maxC) * (h - pad - 10);
      const area = (pts, col, dir) => {
        ctx.beginPath();
        ctx.moveTo(x(pts[0][0]), h - pad);
        for (const [idx, q] of pts) { ctx.lineTo(x(idx), y(q)); ctx.lineTo(x(idx + dir), y(q)); }
        ctx.lineTo(x(pts[pts.length - 1][0] + dir), h - pad);
        ctx.closePath();
        ctx.fillStyle = alpha(col, 0.22); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      };
      area(cb, th.up, -1);
      area(ca, th.down, 1);
      const midX = x((b[0][0] + a[0][0]) / 2);
      ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(midX + 0.5, 6); ctx.lineTo(midX + 0.5, h - pad); ctx.stroke();
      ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'left';
      ctx.fillText(fmtPrice(lo * s.tick, s.tick), 4, h - 4);
      ctx.textAlign = 'right'; ctx.fillText(fmtPrice(hi * s.tick, s.tick), w - 4, h - 4);
      ctx.textAlign = 'center'; ctx.fillText('spread ' + ((a[0][0] - b[0][0]) * s.tick).toFixed(DTA.decimalsForTick(s.tick)), midX, h - 4);
      const bidSum = cb[cb.length - 1][1], askSum = ca[ca.length - 1][1];
      const imb = bidSum / (bidSum + askSum);
      ctx.textAlign = 'left'; ctx.fillStyle = th.text2;
      ctx.fillText('Bids ' + fmtQty(bidSum) + ' · ' + Math.round(imb * 100) + '%', 6, 14);
      ctx.textAlign = 'right';
      ctx.fillText(Math.round((1 - imb) * 100) + '% · ' + fmtQty(askSum) + ' Asks', w - 6, 14);
      if (this.mx !== null) {
        const idx = Math.round(lo + (this.mx - 1) / (w - 2) * (hi - lo));
        const src = idx <= b[0][0] ? cb : ca;
        let q = 0;
        for (const [i, c] of src) { if ((src === cb && i >= idx) || (src === ca && i <= idx)) q = c; }
        ctx.strokeStyle = alpha(th.text2, 0.6); ctx.beginPath(); ctx.moveTo(this.mx + 0.5, 6); ctx.lineTo(this.mx + 0.5, h - pad); ctx.stroke();
        const txt = fmtPrice(idx * s.tick, s.tick) + ' · ' + fmtQty(q) + ' cumulative';
        ctx.font = FONT; const tw = ctx.measureText(txt).width + 12;
        const tx = clamp(this.mx - tw / 2, 2, w - tw - 2);
        ctx.fillStyle = alpha(th.panel, 0.96); roundRect(ctx, tx, 20, tw, 18, 4); ctx.fill(); ctx.strokeStyle = th.axis; ctx.stroke();
        ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.fillText(txt, tx + tw / 2, 33);
      }
    }
  }

  // ---------- sparkline ----------
  function drawSpark(canvas, s, th) {
    if (!canvas.isConnected) return;
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!s || !s.bars.length) return;
    const n = s.bars.length;
    const pts = Math.min(80, n);
    const step = n / pts;
    const vals = [];
    for (let k = 0; k < pts; k++) vals.push(s.bars[Math.min(n - 1, Math.floor((k + 1) * step) - 1)][3]);
    vals.push(s.last);
    let lo = Math.min(...vals, s.prev), hi = Math.max(...vals, s.prev);
    if (hi - lo < 2) { hi += 1; lo -= 1; }
    const x = (k) => (k / (vals.length - 1)) * (w - 2) + 1;
    const y = (v) => h - 2 - ((v - lo) / (hi - lo)) * (h - 4);
    const up = s.last >= s.prev;
    const col = up ? th.up : th.down;
    ctx.strokeStyle = alpha(th.text3, 0.6); ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Math.round(y(s.prev)) + 0.5); ctx.lineTo(w, Math.round(y(s.prev)) + 0.5); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    vals.forEach((v, k) => (k ? ctx.lineTo(x(k), y(v)) : ctx.moveTo(x(k), y(v))));
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.lineTo(x(vals.length - 1), h); ctx.lineTo(x(0), h); ctx.closePath();
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, alpha(col, 0.25)); gr.addColorStop(1, alpha(col, 0));
    ctx.fillStyle = gr; ctx.fill();
    ctx.beginPath(); ctx.arc(x(vals.length - 1), y(s.last), 2.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  }

  // ---------- equity race ----------
  // One line per player: return since the start, over market time. Each line ends in the player's avatar
  // and name (direct labels, nudged apart so they never overlap). Hover shows everyone at that moment.
  class EquityRace {
    // env: {hist(): {pid: [[t, eq]]}, player(pid), me, start(), end(), now(), startCash(pid), live: bool}
    constructor(canvas, env) {
      this.cv = canvas; this.env = env; this.th = DTA.chartTheme(); this.mx = null; this.dirty = true;
      canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); this.mx = e.clientX - r.left; this.dirty = true; });
      canvas.addEventListener('pointerleave', () => { this.mx = null; this.dirty = true; });
    }
    refreshTheme() { this.th = DTA.chartTheme(); this.dirty = true; }
    render() {
      const cv = this.cv;
      if (cv.offsetParent === null) return;
      const { ctx, w, h } = fitCanvas(cv);
      const th = this.th;
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
      const hist = this.env.hist();
      const ids = Object.keys(hist).filter((id) => hist[id].length && this.env.player(id));
      if (!ids.length) { ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'center'; ctx.fillText('The race starts at the opening bell', w / 2, h / 2); return; }
      const t0 = this.env.start();
      const t1 = Math.max(t0 + 1, this.env.live ? this.env.now() : this.env.end());
      let lo = 0, hi = 0;
      const ret = (id, eq) => eq / this.env.startCash(id) - 1;
      for (const id of ids) for (const [, eq] of hist[id]) { const r = ret(id, eq); if (r < lo) lo = r; if (r > hi) hi = r; }
      const span = Math.max(0.004, hi - lo);
      lo -= span * 0.12; hi += span * 0.12;
      const labelW = Math.min(150, Math.max(70, w * 0.3));
      const L = 44, R = w - labelW, T = 10, B = h - 20;
      const x = (t) => L + ((t - t0) / (t1 - t0)) * (R - L);
      const y = (r) => T + ((hi - r) / (hi - lo)) * (B - T);
      // Grid + zero line.
      ctx.font = FONT; ctx.fillStyle = th.text3; ctx.textAlign = 'right';
      const step = niceStepPct(hi - lo);
      ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.beginPath();
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { const yy = Math.round(y(v)) + 0.5; ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.fillText(fmtPct(v, step < 0.01 ? 1 : 0), L - 6, yy + 4); }
      ctx.stroke();
      ctx.strokeStyle = th.axis; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, Math.round(y(0)) + 0.5); ctx.lineTo(R, Math.round(y(0)) + 0.5); ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillText(fmtClock(t0, false), L, h - 5);
      ctx.textAlign = 'right'; ctx.fillText(fmtClock(t1, false), R, h - 5);
      // Lines: others first, you on top.
      const order = ids.slice().sort((a, b) => (a === this.env.me ? 1 : b === this.env.me ? -1 : 0));
      const heads = [];
      for (const id of order) {
        const p = this.env.player(id);
        const pts = hist[id];
        const mine = id === this.env.me;
        ctx.strokeStyle = p.out ? alpha(p.color, 0.45) : p.color;
        ctx.lineWidth = mine ? 3 : 2; ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach(([t, eq], k) => { const xx = x(t), yy = y(ret(id, eq)); if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); });
        ctx.stroke();
        const [lt, le] = pts[pts.length - 1];
        heads.push({ id, p, x: x(lt), y: y(ret(id, le)), r: ret(id, le), mine });
      }
      // Heads and direct labels, spread vertically.
      heads.sort((a, b) => a.y - b.y);
      const minGap = 17;
      for (let k = 1; k < heads.length; k++) if (heads[k].y - (heads[k - 1].ly || heads[k - 1].y) < minGap) heads[k].ly = (heads[k - 1].ly || heads[k - 1].y) + minGap; else heads[k].ly = heads[k].y;
      if (heads.length) heads[0].ly = heads[0].ly || heads[0].y;
      const over = heads.length ? heads[heads.length - 1].ly - (B + 4) : 0;
      if (over > 0) for (const hd of heads) hd.ly -= over;
      for (const hd of heads) {
        ctx.beginPath(); ctx.arc(hd.x, hd.y, hd.mine ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = hd.p.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.bg; ctx.stroke();
        const lx = R + 8;
        ctx.strokeStyle = alpha(hd.p.color, 0.5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hd.x + 5, hd.y); ctx.lineTo(lx - 2, hd.ly); ctx.stroke();
        ctx.font = '12px ' + EMOJI; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(hd.p.avatar, lx, hd.ly);
        ctx.font = hd.mine ? FONT_B : FONT;
        ctx.fillStyle = hd.p.out ? th.text3 : th.text;
        if (labelW >= 118) {
          const name = hd.p.name.length > 10 ? hd.p.name.slice(0, 9) + '…' : hd.p.name;
          ctx.fillText(name, lx + 18, hd.ly);
          ctx.fillStyle = th.text2;
          ctx.fillText(fmtPct(hd.r, 1), lx + 22 + ctx.measureText(name).width, hd.ly);
        } else {
          // Narrow panel: avatar and return only; the leaderboard next to it carries the names.
          ctx.fillStyle = th.text2;
          ctx.fillText(fmtPct(hd.r, 1), lx + 18, hd.ly);
        }
        ctx.textBaseline = 'alphabetic';
      }
      // Hover: everyone's return at that moment.
      if (this.mx !== null && this.mx >= L && this.mx <= R) {
        const t = t0 + ((this.mx - L) / (R - L)) * (t1 - t0);
        ctx.strokeStyle = alpha(th.text2, 0.6); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(this.mx) + 0.5, T); ctx.lineTo(Math.round(this.mx) + 0.5, B); ctx.stroke();
        const rows = [];
        for (const id of ids) {
          const pts = hist[id];
          let v = null;
          for (const [pt, eq] of pts) { if (pt <= t) v = eq; else break; }
          if (v !== null) rows.push({ p: this.env.player(id), r: ret(id, v) });
        }
        rows.sort((a, b) => b.r - a.r);
        ctx.font = FONT;
        const lines = [fmtClock(t, false)].concat(rows.map((r) => r.p.avatar + ' ' + r.p.name + '  ' + fmtPct(r.r, 2)));
        const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
        const th2 = lines.length * 15 + 8;
        let tx = this.mx + 12;
        if (tx + tw > w) tx = this.mx - tw - 12;
        ctx.fillStyle = alpha(th.panel, 0.97); roundRect(ctx, tx, T, tw, th2, 6); ctx.fill(); ctx.strokeStyle = th.axis; ctx.stroke();
        lines.forEach((l, k) => {
          ctx.fillStyle = k === 0 ? th.text3 : th.text; ctx.textAlign = 'left';
          if (k > 0) { ctx.fillStyle = rows[k - 1].p.color; ctx.fillRect(tx + 6, T + 8 + k * 15 - 6, 3, 10); ctx.fillStyle = th.text; }
          ctx.font = (k === 0 ? FONT : '11px system-ui, ' + EMOJI);
          ctx.fillText(l, tx + 12, T + 16 + k * 15);
        });
      }
    }
  }
  function niceStepPct(range) {
    const target = range / 4;
    const opts = [0.001, 0.0025, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1];
    for (const o of opts) if (o >= target) return o;
    return 1;
  }

  // ---------- buying power ring ----------
  function drawGauge(canvas, frac, th) {
    if (!canvas.isConnected || canvas.offsetParent === null) return;
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const r = Math.min(w, h) / 2 - 3, cx = w / 2, cy = h / 2;
    if (r <= 1) return;
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    const f = clamp(frac, 0, 1);
    const col = f > 0.9 ? th.bad : f > 0.7 ? th.warn : th.accent;
    if (f > 0.002) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
  }

  DTA.Ladder = Ladder;
  DTA.Tape = Tape;
  DTA.Depth = Depth;
  DTA.drawSpark = drawSpark;
  DTA.EquityRace = EquityRace;
  DTA.drawGauge = drawGauge;
  void fmtSignedMoney;
})();
