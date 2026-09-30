// Day Trade Arena: the main price chart, drawn on canvas.
//
// Candles / Heikin-Ashi / OHLC bars / line / area, volume, VWAP (+1σ/2σ), EMA 9/20/50, Bollinger, a session
// volume profile, RSI and MACD panes. On top: your working orders (drag to move, × to cancel), your position
// with open P&L, your fills, rivals' fills with their avatar, news flags, halts, price alerts and drawings.
// Wheel/pinch zooms, drag pans, drag the price axis to rescale, double-click to snap back to live.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { clamp, fmtPrice, fmtQty, fmtSignedMoney, fmtClock, fitCanvas, ind } = DTA;

  const AXIS_W = 66, TIME_H = 22, LEGEND_PAD = 8;
  const FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
  const FONT_B = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
  const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  function theme() {
    const v = (n, f) => DTA.cssVar(n, f);
    return {
      bg: v('--chart-bg', '#12161c'), grid: v('--grid', '#1d232c'), axis: v('--axis', '#2b333e'),
      text: v('--text-1', '#e8ebef'), text2: v('--text-2', '#aab2bd'), text3: v('--text-3', '#6f7a87'),
      up: v('--up', '#1fb884'), down: v('--down', '#ef4f5a'), warn: v('--warn', '#fab219'),
      s1: v('--series-1', '#3987e5'), s2: v('--series-2', '#d95926'), s3: v('--series-3', '#199e70'), s4: v('--series-4', '#c98500'),
      s5: v('--series-5', '#d55181'), s7: v('--series-7', '#9085e9'), surface: v('--surface', '#12161c'), panel: v('--panel', '#171c24'),
      good: v('--good', '#0ca30c'), bad: v('--critical', '#d03b3b'), accent: v('--accent', '#3987e5')
    };
  }

  function alpha(hex, a) {
    if (!hex || hex[0] !== '#') return hex;
    const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  DTA.alpha = alpha;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  DTA.roundRect = roundRect;

  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  class Chart {
    // env: {sym(), start(), now(), speed(), orders(sym), position(sym), fills(sym), rivals(sym), news(sym),
    //       player(pid), onModify(id,px), onCancel(id), onContext({px,x,y,clientX,clientY}), onAlert(d), onToolDone(), onHover(info)}
    constructor(canvas, env, opts) {
      this.cv = canvas;
      this.env = env;
      this.o = Object.assign({ interactive: true, replay: false }, opts || {});
      this.tf = 60;
      this.type = 'candles';
      this.show = { vol: true, vwap: true, vwapBands: false, ema9: true, ema20: true, ema50: false, bb: false, vp: true, rsi: false, macd: false, delta: false, cvd: false, heat: false, bubbles: true, rivals: true, fills: true, news: true };
      this.barW = 9;
      this.right = null;       // bar index at the right edge; null = follow live
      this.yMan = null;        // manual price range when the axis was dragged
      this.yCur = null;        // animated range
      this.agg = new ind.Agg(this.tf);
      this.cache = { key: '', bars: [], ha: null, calc: null };
      this.symKey = null;
      this.mouse = { x: -1, y: -1, in: false };
      this.drag = null;
      this.tool = null;
      this.pending = null;     // drawing in progress
      this.drawings = {};      // sym -> [{id,type,p1,p2}]
      this.selected = null;
      this.hits = [];          // clickable things drawn this frame
      this.dirty = true;
      this.animLast = null;
      this.replayT = null;
      this.th = theme();
      this.layout = null;
      if (this.o.interactive) this.bind();
      this.loadDrawings();
    }

    refreshTheme() { this.th = theme(); this.dirty = true; }
    setTf(tf) { if (tf !== this.tf) { this.tf = tf; this.agg = new ind.Agg(tf); this.cache.key = ''; this.right = null; this.dirty = true; } }
    setType(t) { this.type = t; this.dirty = true; }
    toggle(k, v) { this.show[k] = v === undefined ? !this.show[k] : v; this.dirty = true; }
    resetView() { this.right = null; this.yMan = null; this.barW = 9; this.dirty = true; }
    setTool(t) { this.tool = t; this.pending = null; this.cv.style.cursor = t ? 'crosshair' : ''; this.dirty = true; }

    // ---------- data ----------
    data() {
      const s = this.env.sym();
      if (!s) return null;
      const key = (s.uid || s.sym) + ':' + this.tf;
      if (key !== this.symKey) { this.symKey = key; this.agg = new ind.Agg(this.tf); this.cache.key = ''; this.yCur = null; this.animLast = null; }
      const v = key + ':' + s.version + ':' + this.type + ':' + (this.replayT || '') + ':' + this.show.rsi + this.show.macd + this.show.cvd;
      if (this.cache.key === v) return this.cache;
      // Host deltas only ever rewrite the last bar or append, so rebuilding from the last seen bar is enough.
      let bars = this.agg.update(s.bars, s.tick, this.env.start());
      if (this.replayT !== null) {
        const n = Math.max(1, Math.floor((this.replayT - this.env.start()) / this.tf) + 1);
        bars = bars.slice(0, n);
      }
      const cl = bars.map((b) => b.c);
      const calc = {
        vwap: ind.vwap(bars), ema9: ind.ema(cl, 9), ema20: ind.ema(cl, 20), ema50: ind.ema(cl, 50), bb: ind.bollinger(cl, 20, 2),
        rsi: this.show.rsi ? ind.rsi(cl, 14) : null, macd: this.show.macd ? ind.macd(cl) : null, cvd: this.show.cvd ? ind.cvd(bars) : null
      };
      this.cache = { key: v, bars, ha: this.type === 'heikin' ? ind.heikinAshi(bars) : null, calc, sym: s };
      return this.cache;
    }

    // ---------- geometry ----------
    computeLayout(w, h) {
      const subs = [];
      if (this.show.delta) subs.push('delta');
      if (this.show.cvd) subs.push('cvd');
      if (this.show.rsi) subs.push('rsi');
      if (this.show.macd) subs.push('macd');
      const plotW = Math.max(40, w - AXIS_W);
      const subH = subs.length ? Math.max(50, Math.min(110, (h * (subs.length > 2 ? 0.42 : 0.3)) / subs.length)) : 0;
      const mainH = Math.max(80, h - TIME_H - subH * subs.length);
      const panes = [{ id: 'main', y: 0, h: mainH }];
      let y = mainH;
      for (const s of subs) { panes.push({ id: s, y, h: subH }); y += subH; }
      return { w, h, plotW, mainH, panes, timeY: h - TIME_H };
    }
    rightIndex(n) { return this.right === null ? n - 1 + Math.max(4, 70 / this.barW) : this.right; }
    xOf(i, L, n) { return L.plotW - (this.rightIndex(n) - i) * this.barW - this.barW / 2; }
    iOf(x, L, n) { return this.rightIndex(n) - (L.plotW - x - this.barW / 2) / this.barW; }
    yOf(p) { const r = this.yRange; return r.top + (r.max - p) / (r.max - r.min) * (r.bot - r.top); }
    pOf(y) { const r = this.yRange; return r.max - (y - r.top) / (r.bot - r.top) * (r.max - r.min); }

    // ---------- render ----------
    render() {
      const cv = this.cv;
      if (!cv.isConnected || cv.offsetParent === null) return;
      const { ctx, w, h } = fitCanvas(cv);
      const L = this.layout = this.computeLayout(w, h);
      const th = this.th;
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, w, h);
      this.hits = [];
      const d = this.data();
      if (!d || !d.bars.length) { this.drawEmpty(ctx, L); return; }
      const s = d.sym, bars = this.type === 'heikin' && d.ha ? d.ha : d.bars, raw = d.bars, n = bars.length;
      const tick = s.tick;
      // Visible window.
      const rIdx = this.rightIndex(n);
      const i0 = Math.max(0, Math.floor(rIdx - L.plotW / this.barW) - 1), i1 = Math.min(n - 1, Math.ceil(rIdx) + 1);
      // Price range from visible candles (+ overlays that are on).
      let lo = Infinity, hi = -Infinity;
      for (let i = i0; i <= i1; i++) { const b = bars[i]; if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; }
      const c = d.calc;
      const ext = (arr) => { if (!arr) return; for (let i = i0; i <= i1; i++) { const v = arr[i]; if (v > hi) hi = v; if (v < lo) lo = v; } };
      if (this.show.vwap) ext(c.vwap.v);
      if (this.show.bb) { ext(c.bb.up); ext(c.bb.lo); }
      if (!isFinite(lo)) { lo = s.last * tick * 0.99; hi = s.last * tick * 1.01; }
      if (hi - lo < tick * 8) { const m = (hi + lo) / 2; lo = m - tick * 4; hi = m + tick * 4; }
      const pad = (hi - lo) * 0.08;
      let tMin = lo - pad, tMax = hi + pad;
      if (this.yMan) { tMin = this.yMan.min; tMax = this.yMan.max; }
      if (!this.yCur || this.drag || this.yMan) this.yCur = { min: tMin, max: tMax };
      else {
        const k = 0.3;
        this.yCur.min += (tMin - this.yCur.min) * k;
        this.yCur.max += (tMax - this.yCur.max) * k;
        if (Math.abs(this.yCur.min - tMin) > tick * 0.05 || Math.abs(this.yCur.max - tMax) > tick * 0.05) this.dirty = true;
      }
      const volH = this.show.vol ? L.mainH * 0.18 : 0;
      this.yRange = { min: this.yCur.min, max: this.yCur.max, top: 16, bot: L.mainH - 6 - volH * 0.35 };

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, L.plotW, L.mainH); ctx.clip();
      this.drawGrid(ctx, L, bars, i0, i1, n);
      if (this.show.heat) this.drawHeat(ctx, L, s, i0, i1, n);
      this.drawHalts(ctx, L, n, s);
      if (this.show.vp) this.drawProfile(ctx, L, raw, s);
      if (this.show.vol) this.drawVolume(ctx, L, raw, i0, i1, n, volH);
      this.drawPrevClose(ctx, L, s);
      if (this.show.bb) this.drawBands(ctx, L, c.bb.up, c.bb.lo, c.bb.mid, th.s3, i0, i1, n);
      if (this.show.vwap && this.show.vwapBands) this.drawBands(ctx, L, c.vwap.u2, c.vwap.l2, null, th.s4, i0, i1, n, 0.05);
      this.drawPositionZone(ctx, L, s);
      this.drawSeries(ctx, L, bars, i0, i1, n, s);
      if (this.show.ema50) this.drawLine(ctx, L, c.ema50, th.s5, i0, i1, n, 1.25);
      if (this.show.ema20) this.drawLine(ctx, L, c.ema20, th.s7, i0, i1, n, 1.25);
      if (this.show.ema9) this.drawLine(ctx, L, c.ema9, th.s1, i0, i1, n, 1.25);
      if (this.show.vwap) this.drawLine(ctx, L, c.vwap.v, th.s4, i0, i1, n, 2);
      if (this.show.bubbles) this.drawBubbles(ctx, L, n, s);
      this.drawDrawings(ctx, L, n, s);
      if (this.show.rivals) this.drawRivalFills(ctx, L, n, s);
      if (this.show.fills) this.drawMyFills(ctx, L, n, s);
      if (this.show.news) this.drawNews(ctx, L, n, s);
      this.drawLastLine(ctx, L, s, bars);
      this.drawOrders(ctx, L, s);
      this.drawGhost(ctx, L, s);
      this.drawPosition(ctx, L, s);
      this.drawRef(ctx, L, s);
      this.drawPendingTool(ctx, L, n, s);
      ctx.restore();

      this.drawSubPanes(ctx, L, bars, c, i0, i1, n);
      this.drawPriceAxis(ctx, L, s, bars);
      this.drawTimeAxis(ctx, L, bars, i0, i1, n);
      this.drawCrosshair(ctx, L, bars, n, s);
      this.drawLegend(ctx, L, bars, raw, c, n, s);
      if (this.show.heat && s.heat && s.heat.length) this.drawHeatLegend(ctx, L);
      if (s.halted && this.replayT === null) this.drawHaltBadge(ctx, L, s);
    }

    drawEmpty(ctx, L) {
      ctx.fillStyle = this.th.text3;
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for the opening print…', L.plotW / 2, L.mainH / 2);
    }

    drawGrid(ctx, L, bars, i0, i1, n) {
      const th = this.th, r = this.yRange;
      ctx.strokeStyle = th.grid;
      ctx.lineWidth = 1;
      const step = niceStep(r.max - r.min, Math.max(3, L.mainH / 56));
      ctx.beginPath();
      for (let p = Math.ceil(r.min / step) * step; p <= r.max; p += step) {
        const y = Math.round(this.yOf(p)) + 0.5;
        ctx.moveTo(0, y); ctx.lineTo(L.plotW, y);
      }
      // Vertical lines at round times.
      const tStep = this.timeStep();
      const start = this.env.start();
      for (let i = Math.max(0, i0); i <= i1 + 20; i++) {
        const t = start + i * this.tf;
        if (t % tStep === 0) { const x = Math.round(this.xOf(i, L, n) - this.barW / 2) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, L.mainH); }
      }
      ctx.stroke();
      // Symbol watermark.
      const s = this.env.sym();
      ctx.fillStyle = alpha(th.text, 0.035);
      ctx.font = '700 ' + Math.round(Math.min(96, L.plotW / 6)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.sym, L.plotW / 2, L.mainH / 2);
      ctx.textBaseline = 'alphabetic';
    }
    timeStep() {
      const pxPerSec = this.barW / this.tf;
      const opts = [60, 300, 600, 900, 1800, 3600, 7200];
      for (const o of opts) if (o * pxPerSec >= 90) return o;
      return 7200;
    }

    drawHalts(ctx, L, n, s) {
      const th = this.th, start = this.env.start();
      for (const hl of s.haltList || []) {
        const x0 = this.xOf((hl[0] - start) / this.tf - 0.5, L, n) + this.barW / 2;
        const endT = hl[1] > hl[0] ? Math.min(hl[1], this.env.now()) : this.env.now();
        const x1 = this.xOf((endT - start) / this.tf - 0.5, L, n) + this.barW / 2;
        if (x1 < 0 || x0 > L.plotW) continue;
        ctx.fillStyle = alpha(th.warn, 0.07);
        ctx.fillRect(x0, 0, Math.max(2, x1 - x0), L.mainH);
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, 0, Math.max(2, x1 - x0), L.mainH); ctx.clip();
        ctx.strokeStyle = alpha(th.warn, 0.12); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = x0 - L.mainH; k < x1; k += 10) { ctx.moveTo(k, L.mainH); ctx.lineTo(k + L.mainH, 0); }
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = th.warn; ctx.font = FONT_B; ctx.textAlign = 'left';
        ctx.fillText('HALT', x0 + 4, 30);
      }
    }

    // Bookmap-style resting liquidity: for each candle column, the average size resting at each price
    // level while that candle formed. One hue; brighter means more size waiting there.
    drawHeat(ctx, L, s, i0, i1, n) {
      const H = s.heat;
      if (!H || !H.length) return;
      const th = this.th, start = this.env.start(), tf = this.tf, tick = s.tick;
      const r = this.yRange;
      const pxPerTick = ((r.bot - r.top) / (r.max - r.min)) * tick;
      const grp = Math.max(1, Math.ceil(2.5 / Math.max(1e-6, pxPerTick)));
      const t0 = start + i0 * tf;
      let lo = 0, hi = H.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (H[mid][0] < t0) lo = mid + 1; else hi = mid; }
      let k = Math.max(0, lo - 1);
      const cells = [];
      let mx = 0;
      let prev = lo > 0 ? H[lo - 1] : null;
      const minIdx = Math.floor(r.min / tick), maxIdx = Math.ceil(r.max / tick);
      for (let i = i0; i <= i1; i++) {
        const ct0 = start + i * tf, ct1 = ct0 + tf;
        const acc = new Map();
        let cnt = 0;
        while (k < H.length && H[k][0] < ct1) {
          if (H[k][0] >= ct0) { this.accHeat(acc, H[k], grp, minIdx, maxIdx); cnt++; }
          prev = H[k];
          k++;
        }
        if (!cnt && prev && ct0 - prev[0] < tf * 4 + 60) { this.accHeat(acc, prev, grp, minIdx, maxIdx); cnt = 1; }
        if (!cnt) continue;
        for (const [key, v] of acc) { const a = v / cnt; if (a > mx) mx = a; cells.push(i, key, a); }
      }
      if (!mx) return;
      const bw = Math.max(1, this.barW);
      const col = th.s1;
      for (let c = 0; c < cells.length; c += 3) {
        const i = cells[c], key = cells[c + 1], v = cells[c + 2] / mx;
        if (v < 0.04) continue;
        const x = this.xOf(i, L, n) - bw / 2;
        const yTop = this.yOf((key + 1) * grp * tick - tick / 2), yBot = this.yOf(key * grp * tick - tick / 2);
        const a = 0.05 + 0.62 * Math.pow(v, 0.65);
        ctx.fillStyle = v > 0.82 ? alpha('#9cc4f2', a) : alpha(col, a);
        ctx.fillRect(x, yTop, bw + 0.5, Math.max(1, yBot - yTop));
      }
    }
    // Heatmap scale, drawn last so candles never cover it.
    drawHeatLegend(ctx, L) {
      const th = this.th, col = th.s1;
      const lx = L.plotW - 172, ly = 8;
      ctx.fillStyle = alpha(th.panel, 0.9);
      roundRect(ctx, lx - 8, ly - 4, 164, 32, 6); ctx.fill();
      const gr = ctx.createLinearGradient(lx, 0, lx + 148, 0);
      gr.addColorStop(0, alpha(col, 0.08)); gr.addColorStop(0.8, alpha(col, 0.67)); gr.addColorStop(1, alpha('#9cc4f2', 0.7));
      ctx.fillStyle = gr; ctx.fillRect(lx, ly + 2, 148, 6);
      ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'left';
      ctx.fillText('Resting size: less', lx, ly + 22);
      ctx.textAlign = 'right'; ctx.fillText('more', lx + 148, ly + 22);
    }
    accHeat(acc, snap, grp, minIdx, maxIdx) {
      const [, b0, bs, a0, as] = snap;
      for (let j = 0; j < bs.length; j++) { const idx = b0 - j; if (idx < minIdx || idx > maxIdx) continue; const key = Math.floor(idx / grp); acc.set(key, (acc.get(key) || 0) + bs[j]); }
      for (let j = 0; j < as.length; j++) { const idx = a0 + j; if (idx < minIdx || idx > maxIdx) continue; const key = Math.floor(idx / grp); acc.set(key, (acc.get(key) || 0) + as[j]); }
    }

    // Large single orders on the tape, sized by shares traded.
    drawBubbles(ctx, L, n, s) {
      const list = s.big;
      if (!list || !list.length) return;
      const th = this.th, start = this.env.start();
      const thr = s.bigThreshold || 1;
      const x0 = start + (this.rightIndex(n) - L.plotW / this.barW - 2) * this.tf;
      for (let k = list.length - 1; k >= 0; k--) {
        const [t, idx, qty, side] = list[k];
        if (t < x0) break;
        if (this.replayT !== null && t > this.replayT) continue;
        const i = Math.floor((t - start) / this.tf);
        const x = this.xOf(i, L, n);
        if (x < -20 || x > L.plotW + 20) continue;
        const y = this.yOf(idx * s.tick);
        const rad = clamp(4 + 6 * Math.sqrt(Math.max(0, qty / thr - 0.6)), 5, 22);
        const col = side > 0 ? th.up : side < 0 ? th.down : th.warn;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = alpha(col, 0.22); ctx.fill();
        ctx.lineWidth = 1.25; ctx.strokeStyle = alpha(col, 0.85); ctx.stroke();
        this.hits.push({ kind: 'big', x, y, r: rad, text: 'Big print ' + fmtQty(qty) + ' @ ' + fmtPrice(idx * s.tick, s.tick) + (side > 0 ? ' · buyer lifted the offer' : side < 0 ? ' · seller hit the bid' : ' · auction') + ' · ' + fmtClock(t) });
      }
    }

    drawProfile(ctx, L, raw, s) {
      const th = this.th, r = this.yRange;
      const nb = Math.max(20, Math.min(70, Math.round(L.mainH / 7)));
      const prof = ind.volumeProfile(raw, 0, raw.length, r.min, r.max, nb);
      if (!prof.total) return;
      let mx = 0;
      for (const v of prof.bins) if (v > mx) mx = v;
      const maxW = L.plotW * 0.16;
      const x1 = L.plotW - 2;
      for (let k = 0; k < nb; k++) {
        const v = prof.bins[k];
        if (!v) continue;
        const pTop = prof.lo + (k + 1) * prof.w, pBot = prof.lo + k * prof.w;
        const y0 = this.yOf(pTop), y1 = this.yOf(pBot);
        const bw = (v / mx) * maxW;
        const inVA = k >= prof.vaLo && k <= prof.vaHi;
        ctx.fillStyle = k === prof.poc ? alpha(th.s4, 0.45) : alpha(th.text2, inVA ? 0.13 : 0.06);
        ctx.fillRect(x1 - bw, y0 + 1, bw, Math.max(1, y1 - y0 - 2));
      }
    }

    drawVolume(ctx, L, raw, i0, i1, n, volH) {
      const th = this.th;
      let mx = 0;
      for (let i = i0; i <= i1; i++) if (raw[i] && raw[i].v > mx) mx = raw[i].v;
      if (!mx) return;
      const base = L.mainH - 1;
      const bw = Math.max(1, this.barW * 0.7);
      for (let i = i0; i <= i1; i++) {
        const b = raw[i];
        if (!b || !b.v) continue;
        const hgt = (b.v / mx) * volH;
        const x = this.xOf(i, L, n);
        ctx.fillStyle = alpha(b.c >= b.o ? th.up : th.down, 0.28);
        ctx.fillRect(Math.round(x - bw / 2), base - hgt, Math.max(1, Math.round(bw)), hgt);
      }
    }

    drawPrevClose(ctx, L, s) {
      const th = this.th, p = s.prev * s.tick, y = this.yOf(p);
      if (y < 0 || y > L.mainH) return;
      ctx.strokeStyle = alpha(th.text2, 0.45);
      ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(L.plotW, Math.round(y) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'left';
      ctx.fillText('Prev close ' + fmtPrice(p, s.tick), 6, y - 4);
    }

    drawBands(ctx, L, up, lo, mid, color, i0, i1, n, fillA) {
      ctx.beginPath();
      let started = false;
      for (let i = i0; i <= i1; i++) { if (isNaN(up[i])) continue; const x = this.xOf(i, L, n), y = this.yOf(up[i]); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
      for (let i = i1; i >= i0; i--) { if (isNaN(lo[i])) continue; ctx.lineTo(this.xOf(i, L, n), this.yOf(lo[i])); }
      ctx.closePath();
      ctx.fillStyle = alpha(color, fillA || 0.07);
      ctx.fill();
      this.drawLine(ctx, L, up, alpha(color, 0.6), i0, i1, n, 1);
      this.drawLine(ctx, L, lo, alpha(color, 0.6), i0, i1, n, 1);
      if (mid) this.drawLine(ctx, L, mid, alpha(color, 0.5), i0, i1, n, 1);
    }

    drawLine(ctx, L, arr, color, i0, i1, n, lw) {
      if (!arr) return;
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = i0; i <= i1; i++) {
        const v = arr[i];
        if (v === undefined || isNaN(v)) { started = false; continue; }
        const x = this.xOf(i, L, n), y = this.yOf(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    drawSeries(ctx, L, bars, i0, i1, n, s) {
      const th = this.th;
      const last = bars[n - 1];
      // Smoothly animate the live candle's close.
      const liveClose = last.c;
      if (this.animLast === null || this.replayT !== null) this.animLast = liveClose;
      else {
        this.animLast += (liveClose - this.animLast) * 0.4;
        if (Math.abs(this.animLast - liveClose) > s.tick * 0.02) this.dirty = true; else this.animLast = liveClose;
      }
      const closeOf = (i) => (i === n - 1 ? this.animLast : bars[i].c);
      if (this.type === 'line' || this.type === 'area') {
        ctx.beginPath();
        for (let i = i0; i <= i1; i++) { const x = this.xOf(i, L, n), y = this.yOf(closeOf(i)); if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        const up = bars[i1].c >= bars[i0].o;
        const col = up ? th.up : th.down;
        if (this.type === 'area') {
          ctx.save();
          ctx.lineTo(this.xOf(i1, L, n), L.mainH); ctx.lineTo(this.xOf(i0, L, n), L.mainH); ctx.closePath();
          const gr = ctx.createLinearGradient(0, 0, 0, L.mainH);
          gr.addColorStop(0, alpha(col, 0.25)); gr.addColorStop(1, alpha(col, 0));
          ctx.fillStyle = gr; ctx.fill();
          ctx.restore();
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) { const x = this.xOf(i, L, n), y = this.yOf(closeOf(i)); if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        }
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
        return;
      }
      const bw = Math.max(1, Math.round(this.barW * 0.72));
      for (let i = i0; i <= i1; i++) {
        const b = bars[i];
        const c = closeOf(i);
        const up = c >= b.o;
        const col = up ? th.up : th.down;
        const x = Math.round(this.xOf(i, L, n));
        const yh = this.yOf(Math.max(b.h, c)), yl = this.yOf(Math.min(b.l, c));
        const yo = this.yOf(b.o), yc = this.yOf(c);
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
        if (this.type === 'ohlc') {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl);
          ctx.moveTo(x - bw / 2, Math.round(yo) + 0.5); ctx.lineTo(x + 0.5, Math.round(yo) + 0.5);
          ctx.moveTo(x + 0.5, Math.round(yc) + 0.5); ctx.lineTo(x + bw / 2 + 1, Math.round(yc) + 0.5);
          ctx.stroke();
          continue;
        }
        ctx.beginPath(); ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl); ctx.stroke();
        if (bw >= 3) {
          const top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yc - yo));
          ctx.fillRect(x - Math.floor(bw / 2), Math.round(top), bw, Math.max(1, Math.round(hgt)));
        }
      }
      // Glow on the live candle.
      if (this.replayT === null && i1 === n - 1) {
        const x = this.xOf(n - 1, L, n), y = this.yOf(this.animLast);
        const col = this.animLast >= last.o ? th.up : th.down;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 14);
        gr.addColorStop(0, alpha(col, 0.5)); gr.addColorStop(1, alpha(col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawLastLine(ctx, L, s, bars) {
      if (this.replayT !== null) return;
      const th = this.th, last = bars[bars.length - 1];
      const p = this.animLast !== null ? this.animLast : s.last * s.tick;
      const y = Math.round(this.yOf(p)) + 0.5;
      ctx.strokeStyle = alpha(p >= last.o ? th.up : th.down, 0.7);
      ctx.setLineDash([1, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.plotW, y); ctx.stroke();
      ctx.setLineDash([]);
    }

    drawPositionZone(ctx, L, s) {
      if (this.replayT !== null) return;
      const pos = this.env.position(s.sym);
      if (!pos || !pos.qty) return;
      const th = this.th;
      const last = s.last * s.tick;
      const y0 = this.yOf(pos.avg), y1 = this.yOf(last);
      const pnl = pos.qty * (last - pos.avg);
      ctx.fillStyle = alpha(pnl >= 0 ? th.up : th.down, 0.06);
      ctx.fillRect(0, Math.min(y0, y1), L.plotW, Math.abs(y1 - y0));
    }

    // Markers for fills. Buys are triangles pointing up below the price, sells point down above it.
    drawMyFills(ctx, L, n, s) {
      const th = this.th, start = this.env.start();
      const fills = this.env.fills(s.sym);
      for (const f of fills) {
        if (this.replayT !== null && f.t > this.replayT) continue;
        const i = Math.floor((f.t - start) / this.tf);
        const x = this.xOf(i, L, n);
        if (x < -10 || x > L.plotW + 10) continue;
        const y = this.yOf(f.px);
        const up = f.side > 0;
        const col = up ? th.up : th.down;
        const yy = up ? y + 9 : y - 9;
        ctx.beginPath();
        if (up) { ctx.moveTo(x, yy - 6); ctx.lineTo(x - 6, yy + 5); ctx.lineTo(x + 6, yy + 5); }
        else { ctx.moveTo(x, yy + 6); ctx.lineTo(x - 6, yy - 5); ctx.lineTo(x + 6, yy - 5); }
        ctx.closePath();
        ctx.lineWidth = 2; ctx.strokeStyle = th.bg; ctx.stroke();
        ctx.fillStyle = col; ctx.fill();
        this.hits.push({ kind: 'fill', x, y: yy, r: 8, text: (up ? 'You bought ' : 'You sold ') + fmtQty(f.qty) + ' @ ' + fmtPrice(f.px, s.tick) + (f.realized ? ' · ' + fmtSignedMoney(f.realized) : '') + ' · ' + fmtClock(f.t) });
      }
    }

    drawRivalFills(ctx, L, n, s) {
      const start = this.env.start();
      const list = this.env.rivals(s.sym);
      const th = this.th;
      for (const f of list) {
        // [pid, t, sym, side, qty, px, liq]
        if (this.replayT !== null && f[1] > this.replayT) continue;
        const i = Math.floor((f[1] - start) / this.tf);
        const x = this.xOf(i, L, n);
        if (x < -10 || x > L.plotW + 10) continue;
        const p = this.env.player(f[0]);
        if (!p) continue;
        const y = this.yOf(f[5]) + (f[3] > 0 ? 14 : -14);
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = th.bg; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = p.color; ctx.stroke();
        ctx.font = '10px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.avatar, x, y + 0.5);
        ctx.textBaseline = 'alphabetic';
        this.hits.push({ kind: 'rival', x, y, r: 9, text: p.avatar + ' ' + p.name + (f[3] > 0 ? ' bought ' : ' sold ') + fmtQty(f[4]) + ' @ ' + fmtPrice(f[5], s.tick) + ' · ' + fmtClock(f[1]) });
      }
    }

    drawNews(ctx, L, n, s) {
      const th = this.th, start = this.env.start();
      const list = this.env.news(s.sym);
      for (const nw of list) {
        if (this.replayT !== null && nw.t > this.replayT) continue;
        const i = Math.floor((nw.t - start) / this.tf);
        const x = this.xOf(i, L, n);
        if (x < -10 || x > L.plotW + 10) continue;
        const y = L.mainH - 12;
        const col = nw.tone > 0 ? th.good : nw.tone < 0 ? th.bad : th.text2;
        ctx.strokeStyle = alpha(col, 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, y - 8); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = th.bg; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(nw.tone > 0 ? '▲' : nw.tone < 0 ? '▼' : 'N', x, y + 0.5);
        ctx.textBaseline = 'alphabetic';
        this.hits.push({ kind: 'news', x, y, r: 9, text: fmtClock(nw.t, false) + '  ' + nw.text });
      }
    }

    drawOrders(ctx, L, s) {
      if (this.replayT !== null) return;
      const th = this.th;
      const orders = this.env.orders(s.sym);
      const labelsRight = [];
      for (const o of orders) {
        const px = this.drag && this.drag.kind === 'order' && this.drag.id === o.id ? this.drag.px : (o.type === 'LMT' ? o.px : o.stop);
        if (!px) continue;
        let y = this.yOf(px);
        const off = y < 8 ? -1 : y > L.mainH - 8 ? 1 : 0;
        y = clamp(y, 8, L.mainH - 8);
        const isStop = o.type !== 'LMT';
        const col = isStop ? th.warn : o.side > 0 ? th.up : th.down;
        const pendingLeg = o.status === 'pending';
        ctx.strokeStyle = alpha(col, pendingLeg ? 0.4 : 0.9);
        ctx.lineWidth = 1; ctx.setLineDash(isStop ? [6, 4] : [3, 3]);
        const yy = Math.round(y) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(L.plotW, yy); ctx.stroke();
        ctx.setLineDash([]);
        const kind = o.tag === 'TP' ? 'TP' : o.tag === 'SL' ? 'SL' : o.type === 'TRAIL' ? 'TRAIL' : o.type === 'STPLMT' ? 'STP LMT' : o.type === 'STP' ? 'STOP' : 'LMT';
        const text = (off ? (off < 0 ? '▲ ' : '▼ ') : '') + kind + ' ' + (o.side > 0 ? 'BUY ' : 'SELL ') + fmtQty(o.qty - o.filled) + ' @ ' + fmtPrice(px, s.tick) + (pendingLeg ? ' (waits for entry)' : '');
        ctx.font = FONT_B;
        const tw = ctx.measureText(text).width;
        let lx = 8;
        for (const r of labelsRight) if (Math.abs(r.y - y) < 18) lx = Math.max(lx, r.x2 + 6);
        const bw = tw + 30;
        roundRect(ctx, lx, y - 9, bw, 18, 4);
        ctx.fillStyle = alpha(col, 0.18); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, lx + 7, y + 0.5);
        // × button
        const cx = lx + bw - 11;
        ctx.fillStyle = th.text2; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('×', cx, y + 0.5);
        ctx.textBaseline = 'alphabetic';
        labelsRight.push({ y, x2: lx + bw });
        this.hits.push({ kind: 'cancel', id: o.id, x: cx, y, r: 9, text: 'Cancel this order' });
        if (!pendingLeg || o.tag) this.hits.push({ kind: 'orderLine', id: o.id, y, px, x0: lx + bw, text: 'Drag to move · ' + text });
      }
    }

    drawPosition(ctx, L, s) {
      if (this.replayT !== null) return;
      const pos = this.env.position(s.sym);
      if (!pos || !pos.qty) return;
      const th = this.th;
      const last = s.last * s.tick;
      const pnl = pos.qty * (last - pos.avg);
      const col = pnl >= 0 ? th.up : th.down;
      let y = this.yOf(pos.avg);
      y = clamp(y, 8, L.mainH - 8);
      ctx.strokeStyle = th.text2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(L.plotW, Math.round(y) + 0.5); ctx.stroke();
      const text = (pos.qty > 0 ? 'LONG ' : 'SHORT ') + fmtQty(Math.abs(pos.qty)) + ' @ ' + fmtPrice(pos.avg, s.tick) + '   ' + fmtSignedMoney(pnl);
      ctx.font = '700 12px system-ui, sans-serif';
      const tw = ctx.measureText(text).width;
      const x = L.plotW - tw - 22 - (this.show.vp ? L.plotW * 0.02 : 0);
      roundRect(ctx, x, y - 11, tw + 16, 22, 5);
      ctx.fillStyle = th.panel; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const head = (pos.qty > 0 ? 'LONG ' : 'SHORT ') + fmtQty(Math.abs(pos.qty)) + ' @ ' + fmtPrice(pos.avg, s.tick) + '   ';
      ctx.fillText(head, x + 8, y + 0.5);
      ctx.fillStyle = col;
      ctx.fillText(fmtSignedMoney(pnl), x + 8 + ctx.measureText(head).width, y + 0.5);
      ctx.textBaseline = 'alphabetic';
    }

    // The position of a player you are watching, in their colour.
    drawGhost(ctx, L, s) {
      if (this.replayT !== null || !this.env.ghost) return;
      const gp = this.env.ghost(s.sym);
      if (!gp || !gp.qty) return;
      const th = this.th;
      const y = clamp(this.yOf(gp.avg), 8, L.mainH - 8);
      ctx.strokeStyle = gp.color; ctx.lineWidth = 1.5; ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(L.plotW, Math.round(y) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
      const pnl = gp.qty * (s.last * s.tick - gp.avg);
      const text = gp.name + ' · ' + (gp.qty > 0 ? 'long ' : 'short ') + fmtQty(Math.abs(gp.qty)) + ' @ ' + fmtPrice(gp.avg, s.tick) + ' · ' + fmtSignedMoney(pnl, 0);
      ctx.font = '11px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      const tw = ctx.measureText(text).width;
      const x = L.plotW * 0.45 - tw / 2;
      roundRect(ctx, x, y - 10, tw + 14, 20, 10);
      ctx.fillStyle = th.panel; ctx.fill();
      ctx.strokeStyle = gp.color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 7, y + 0.5);
      ctx.textBaseline = 'alphabetic';
    }

    // Call It: the price everyone called from.
    drawRef(ctx, L, s) {
      if (!this.env.refLine) return;
      const r = this.env.refLine();
      if (!r) return;
      const th = this.th;
      const y = Math.round(this.yOf(r.price)) + 0.5;
      ctx.strokeStyle = th.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.plotW, y); ctx.stroke();
      ctx.font = FONT_B;
      const text = r.label + ' ' + fmtPrice(r.price, s.tick);
      const tw = ctx.measureText(text).width;
      roundRect(ctx, 8, y - 10, tw + 14, 20, 4);
      ctx.fillStyle = th.accent; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 15, y + 0.5);
      ctx.textBaseline = 'alphabetic';
    }

    drawSubPanes(ctx, L, bars, c, i0, i1, n) {
      const th = this.th;
      for (const pane of L.panes) {
        if (pane.id === 'main') continue;
        ctx.save();
        ctx.translate(0, pane.y);
        ctx.fillStyle = th.bg; ctx.fillRect(0, 0, L.w, pane.h);
        ctx.strokeStyle = th.axis; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(L.w, 0.5); ctx.stroke();
        ctx.beginPath(); ctx.rect(0, 0, L.plotW, pane.h); ctx.clip();
        const hgt = pane.h;
        if (pane.id === 'delta') {
          const raw = this.cache.bars;
          let mx = 1;
          for (let i = i0; i <= i1; i++) { const d = raw[i] ? Math.abs(raw[i].d || 0) : 0; if (d > mx) mx = d; }
          const y0 = hgt / 2;
          ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(0, Math.round(y0) + 0.5); ctx.lineTo(L.plotW, Math.round(y0) + 0.5); ctx.stroke();
          const bw = Math.max(1, this.barW * 0.7);
          for (let i = i0; i <= i1; i++) {
            const d = raw[i] ? raw[i].d || 0 : 0;
            if (!d) continue;
            const hh = (Math.abs(d) / mx) * (hgt / 2 - 8);
            ctx.fillStyle = alpha(d > 0 ? th.up : th.down, 0.75);
            ctx.fillRect(this.xOf(i, L, n) - bw / 2, d > 0 ? y0 - hh : y0, bw, Math.max(1, hh));
          }
          ctx.restore();
          const m = this.mouse;
          let hi2 = n - 1;
          if (m.in && m.x < L.plotW) hi2 = clamp(Math.round(this.iOf(m.x, L, n)), 0, n - 1);
          const dv = raw[hi2] ? raw[hi2].d || 0 : 0;
          ctx.fillStyle = th.text2; ctx.font = FONT; ctx.textAlign = 'left';
          ctx.fillText('Volume delta (buys − sells)  ' + (dv >= 0 ? '+' : DTA.MINUS) + fmtQty(Math.abs(Math.round(dv))), 8, pane.y + 13);
          continue;
        }
        if (pane.id === 'cvd' && c.cvd) {
          let lo = 0, hi = 0;
          for (let i = i0; i <= i1; i++) { const v = c.cvd[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
          const span = Math.max(1, hi - lo);
          lo -= span * 0.1; hi += span * 0.1;
          const y = (v) => 6 + ((hi - v) / (hi - lo)) * (hgt - 12);
          const yz = y(0);
          ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(0, Math.round(yz) + 0.5); ctx.lineTo(L.plotW, Math.round(yz) + 0.5); ctx.stroke();
          // Area toward zero, green above and red below.
          for (const sign of [1, -1]) {
            ctx.save();
            ctx.beginPath(); ctx.rect(0, sign > 0 ? 0 : yz, L.plotW, sign > 0 ? yz : hgt - yz); ctx.clip();
            ctx.beginPath();
            ctx.moveTo(this.xOf(i0, L, n), yz);
            for (let i = i0; i <= i1; i++) ctx.lineTo(this.xOf(i, L, n), y(c.cvd[i]));
            ctx.lineTo(this.xOf(i1, L, n), yz);
            ctx.closePath();
            ctx.fillStyle = alpha(sign > 0 ? th.up : th.down, 0.18); ctx.fill();
            ctx.restore();
          }
          ctx.strokeStyle = th.text2; ctx.lineWidth = 1.5; ctx.beginPath();
          for (let i = i0; i <= i1; i++) { const xx = this.xOf(i, L, n), yy = y(c.cvd[i]); if (i === i0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
          ctx.stroke();
          ctx.restore();
          const lv = c.cvd[n - 1] || 0;
          ctx.fillStyle = th.text2; ctx.font = FONT; ctx.textAlign = 'left';
          ctx.fillText('Cumulative volume delta  ' + (lv >= 0 ? '+' : DTA.MINUS) + fmtQty(Math.abs(Math.round(lv))), 8, pane.y + 13);
          continue;
        }
        if (pane.id === 'rsi' && c.rsi) {
          const y = (v) => 6 + (100 - v) / 100 * (hgt - 12);
          ctx.fillStyle = alpha(th.s7, 0.06); ctx.fillRect(0, y(70), L.plotW, y(30) - y(70));
          ctx.strokeStyle = th.grid; ctx.beginPath();
          for (const lv of [30, 50, 70]) { ctx.moveTo(0, Math.round(y(lv)) + 0.5); ctx.lineTo(L.plotW, Math.round(y(lv)) + 0.5); }
          ctx.stroke();
          ctx.strokeStyle = th.s7; ctx.lineWidth = 1.5; ctx.beginPath();
          let st = false;
          for (let i = i0; i <= i1; i++) { const v = c.rsi[i]; if (isNaN(v)) continue; const x = this.xOf(i, L, n); if (!st) { ctx.moveTo(x, y(v)); st = true; } else ctx.lineTo(x, y(v)); }
          ctx.stroke();
          ctx.restore();
          this.axisLabel(ctx, L, pane.y + y(70), '70'); this.axisLabel(ctx, L, pane.y + y(30), '30');
          const lastV = c.rsi[n - 1];
          ctx.fillStyle = th.text2; ctx.font = FONT; ctx.textAlign = 'left';
          ctx.fillText('RSI 14  ' + (isNaN(lastV) ? '—' : lastV.toFixed(1)), 8, pane.y + 13);
          continue;
        }
        if (pane.id === 'macd' && c.macd) {
          let mx = 1e-9;
          for (let i = i0; i <= i1; i++) { const a = Math.abs(c.macd.line[i]), b = Math.abs(c.macd.signal[i]), h = Math.abs(c.macd.hist[i]); mx = Math.max(mx, a || 0, b || 0, h || 0); }
          const y = (v) => hgt / 2 - (v / mx) * (hgt / 2 - 8);
          ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(0, Math.round(y(0)) + 0.5); ctx.lineTo(L.plotW, Math.round(y(0)) + 0.5); ctx.stroke();
          const bw = Math.max(1, this.barW * 0.6);
          for (let i = i0; i <= i1; i++) {
            const h = c.macd.hist[i];
            if (isNaN(h)) continue;
            const x = this.xOf(i, L, n);
            ctx.fillStyle = alpha(h >= 0 ? th.up : th.down, 0.5);
            ctx.fillRect(x - bw / 2, Math.min(y(0), y(h)), bw, Math.abs(y(h) - y(0)));
          }
          this.drawLineY(ctx, L, c.macd.line, th.s1, i0, i1, n, y);
          this.drawLineY(ctx, L, c.macd.signal, th.s2, i0, i1, n, y);
          ctx.restore();
          ctx.fillStyle = th.text2; ctx.font = FONT; ctx.textAlign = 'left';
          const lv = c.macd.line[n - 1], sv = c.macd.signal[n - 1];
          ctx.fillText('MACD 12 26 9  ' + (isNaN(lv) ? '—' : lv.toFixed(3)) + '  signal ' + (isNaN(sv) ? '—' : sv.toFixed(3)), 8, pane.y + 13);
          continue;
        }
        ctx.restore();
      }
    }
    drawLineY(ctx, L, arr, color, i0, i1, n, yf) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      let st = false;
      for (let i = i0; i <= i1; i++) { const v = arr[i]; if (isNaN(v)) continue; const x = this.xOf(i, L, n); if (!st) { ctx.moveTo(x, yf(v)); st = true; } else ctx.lineTo(x, yf(v)); }
      ctx.stroke();
    }
    axisLabel(ctx, L, y, text) {
      ctx.fillStyle = this.th.text3; ctx.font = FONT; ctx.textAlign = 'left';
      ctx.fillText(text, L.plotW + 8, y + 4);
    }

    drawPriceAxis(ctx, L, s, bars) {
      const th = this.th, r = this.yRange;
      ctx.fillStyle = th.bg;
      ctx.fillRect(L.plotW, 0, AXIS_W, L.mainH);
      ctx.strokeStyle = th.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L.plotW + 0.5, 0); ctx.lineTo(L.plotW + 0.5, L.h - TIME_H); ctx.stroke();
      ctx.font = FONT; ctx.fillStyle = th.text3; ctx.textAlign = 'left';
      const step = niceStep(r.max - r.min, Math.max(3, L.mainH / 56));
      const dp = Math.max(DTA.decimalsForTick(s.tick), step < 0.01 ? 3 : 2);
      for (let p = Math.ceil(r.min / step) * step; p <= r.max; p += step) {
        const y = this.yOf(p);
        if (y < 10 || y > L.mainH - 4) continue;
        ctx.fillText(p.toFixed(dp), L.plotW + 8, y + 4);
      }
      // VWAP tag
      if (this.show.vwap && this.cache.calc) {
        const v = this.cache.calc.vwap.v[this.cache.bars.length - 1];
        if (!isNaN(v)) this.axisTag(ctx, L, this.yOf(v), fmtPrice(v, s.tick), th.s4, '#111');
      }
      // Position avg tag
      const pos = this.replayT === null ? this.env.position(s.sym) : null;
      if (pos && pos.qty) this.axisTag(ctx, L, this.yOf(pos.avg), fmtPrice(pos.avg, s.tick), th.text2, '#111');
      // Last price tag with candle countdown.
      const last = this.replayT === null ? (this.animLast !== null ? this.animLast : s.last * s.tick) : bars[bars.length - 1].c;
      const lb = bars[bars.length - 1];
      const col = last >= lb.o ? th.up : th.down;
      const y = clamp(this.yOf(last), 10, L.mainH - 10);
      this.axisTag(ctx, L, y, fmtPrice(this.replayT === null ? s.last * s.tick : last, s.tick), col, '#fff', true);
      if (this.replayT === null) {
        const now = this.env.now();
        const left = this.tf - ((now - this.env.start()) % this.tf);
        const secs = Math.max(0, Math.ceil(left / Math.max(0.5, this.env.speed())));
        ctx.fillStyle = alpha(col, 0.85);
        roundRect(ctx, L.plotW + 2, y + 10, AXIS_W - 4, 15, 3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('0:' + String(secs).padStart(2, '0'), L.plotW + AXIS_W / 2, y + 21);
      }
    }
    axisTag(ctx, L, y, text, bg, fg, bold) {
      if (y < -10 || y > L.mainH + 10) return;
      ctx.fillStyle = bg;
      roundRect(ctx, L.plotW + 2, y - 9, AXIS_W - 4, 18, 3); ctx.fill();
      ctx.fillStyle = fg; ctx.font = bold ? FONT_B : FONT; ctx.textAlign = 'left';
      ctx.fillText(text, L.plotW + 8, y + 4);
    }

    drawTimeAxis(ctx, L, bars, i0, i1, n) {
      const th = this.th;
      ctx.fillStyle = th.bg; ctx.fillRect(0, L.timeY, L.w, TIME_H);
      ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(0, L.timeY + 0.5); ctx.lineTo(L.w, L.timeY + 0.5); ctx.stroke();
      ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'center';
      const start = this.env.start();
      const tStep = this.timeStep();
      for (let i = Math.max(0, i0); i <= i1 + 30; i++) {
        const t = start + i * this.tf;
        if (t % tStep !== 0) continue;
        const x = this.xOf(i, L, n) - this.barW / 2;
        if (x < 20 || x > L.plotW - 20) continue;
        ctx.fillText(fmtClock(t, false), x, L.timeY + 15);
      }
    }

    drawCrosshair(ctx, L, bars, n, s) {
      const m = this.mouse;
      if (!m.in || m.x > L.plotW || m.y > L.timeY || this.drag) return;
      const th = this.th;
      ctx.strokeStyle = alpha(th.text2, 0.5); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(m.x) + 0.5, 0); ctx.lineTo(Math.round(m.x) + 0.5, L.timeY);
      if (m.y < L.mainH) { ctx.moveTo(0, Math.round(m.y) + 0.5); ctx.lineTo(L.plotW, Math.round(m.y) + 0.5); }
      ctx.stroke();
      if (m.y < L.mainH) this.axisTag(ctx, L, m.y, fmtPrice(this.pOf(m.y), s.tick), th.axis, th.text);
      const i = Math.round(this.iOf(m.x, L, n));
      const t = this.env.start() + i * this.tf;
      const text = fmtClock(t, this.tf < 60);
      ctx.font = FONT;
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = th.axis;
      roundRect(ctx, m.x - w / 2, L.timeY + 3, w, 17, 3); ctx.fill();
      ctx.fillStyle = th.text; ctx.textAlign = 'center';
      ctx.fillText(text, m.x, L.timeY + 15);
    }

    drawLegend(ctx, L, bars, raw, c, n, s) {
      const th = this.th;
      const m = this.mouse;
      let i = n - 1;
      if (m.in && m.x < L.plotW && m.y < L.timeY) i = clamp(Math.round(this.iOf(m.x, L, n)), 0, n - 1);
      const b = raw[i];
      const prev = i > 0 ? raw[i - 1].c : s.prev * s.tick;
      const ch = b.c - prev;
      const tfl = (DTA.TIMEFRAMES.find((x) => x.sec === this.tf) || {}).label || this.tf + 's';
      let x = LEGEND_PAD;
      const y = 15;
      ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = th.text;
      const head = s.sym + ' · ' + tfl;
      ctx.fillText(head, x, y);
      x += ctx.measureText(head).width + 10;
      ctx.font = FONT;
      const parts = [['O', b.o], ['H', b.h], ['L', b.l], ['C', b.c]];
      const col = b.c >= b.o ? th.up : th.down;
      for (const [k, v] of parts) {
        ctx.fillStyle = th.text3; ctx.fillText(k, x, y); x += ctx.measureText(k).width + 3;
        ctx.fillStyle = col; const tx = fmtPrice(v, s.tick); ctx.fillText(tx, x, y); x += ctx.measureText(tx).width + 8;
      }
      ctx.fillStyle = th.text3; ctx.fillText('V', x, y); x += 10;
      ctx.fillStyle = th.text2; const vt = fmtQty(b.v); ctx.fillText(vt, x, y); x += ctx.measureText(vt).width + 8;
      if (b.d !== undefined && b.v) {
        ctx.fillStyle = th.text3; ctx.fillText('Δ', x, y); x += 10;
        ctx.fillStyle = b.d >= 0 ? th.up : th.down;
        const dt = (b.d >= 0 ? '+' : DTA.MINUS) + fmtQty(Math.abs(Math.round(b.d)));
        ctx.fillText(dt, x, y); x += ctx.measureText(dt).width + 8;
      }
      ctx.fillStyle = ch >= 0 ? th.up : th.down;
      ctx.fillText((ch >= 0 ? '+' : DTA.MINUS) + Math.abs(ch).toFixed(DTA.decimalsForTick(s.tick)) + ' (' + DTA.fmtPct(ch / prev) + ')', x, y);
      // Indicator legend: swatch + name + value (text stays in text colours).
      const items = [];
      if (this.show.vwap) items.push([th.s4, 'VWAP', c.vwap.v[i]]);
      if (this.show.ema9) items.push([th.s1, 'EMA 9', c.ema9[i]]);
      if (this.show.ema20) items.push([th.s7, 'EMA 20', c.ema20[i]]);
      if (this.show.ema50) items.push([th.s5, 'EMA 50', c.ema50[i]]);
      if (this.show.bb) items.push([th.s3, 'BB 20 2', c.bb.mid[i]]);
      let ly = 32;
      x = LEGEND_PAD;
      for (const [color, name, v] of items) {
        ctx.fillStyle = color; ctx.fillRect(x, ly - 7, 10, 3);
        ctx.fillStyle = th.text3; ctx.fillText(name, x + 14, ly - 2);
        const nw = ctx.measureText(name).width;
        ctx.fillStyle = th.text2; ctx.fillText(isNaN(v) ? '—' : fmtPrice(v, s.tick), x + 18 + nw, ly - 2);
        x += 18 + nw + ctx.measureText(isNaN(v) ? '—' : fmtPrice(v, s.tick)).width + 14;
      }
      void ly;
      // Hover tooltip for markers.
      if (m.in && !this.drag) {
        const hit = this.hitAt(m.x, m.y, ['fill', 'rival', 'news', 'cancel', 'big']);
        if (hit) this.tooltip(ctx, L, m.x, m.y, hit.text);
      }
    }

    tooltip(ctx, L, x, y, text) {
      const th = this.th;
      ctx.font = FONT;
      const maxW = Math.min(360, L.plotW - 20);
      const words = text.split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW - 16 && cur) { lines.push(cur); cur = w; } else cur = t; }
      if (cur) lines.push(cur);
      const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16);
      const h = lines.length * 15 + 10;
      let tx = x + 14, ty = y + 14;
      if (tx + w > L.plotW) tx = x - w - 10;
      if (ty + h > L.timeY) ty = y - h - 10;
      ctx.fillStyle = alpha(th.panel, 0.97);
      roundRect(ctx, tx, ty, w, h, 6); ctx.fill();
      ctx.strokeStyle = th.axis; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'left';
      lines.forEach((l, k) => ctx.fillText(l, tx + 8, ty + 17 + k * 15));
    }

    drawHaltBadge(ctx, L, s) {
      const th = this.th;
      const left = Math.max(0, (s.haltUntil - this.env.now()) / Math.max(0.5, this.env.speed()));
      const text = '⏸ ' + (s.haltReason || 'Halted') + ' · reopens in ~' + Math.ceil(left) + 's';
      ctx.font = FONT_B;
      const w = ctx.measureText(text).width + 20;
      const x = (L.plotW - w) / 2, y = 44;
      roundRect(ctx, x, y, w, 24, 12);
      ctx.fillStyle = alpha(th.warn, 0.18); ctx.fill();
      ctx.strokeStyle = th.warn; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'center';
      ctx.fillText(text, L.plotW / 2, y + 16);
    }

    // ---------- drawings ----------
    loadDrawings() { this.drawings = DTA.store.get('drawings', {}) || {}; }
    saveDrawings() { DTA.store.set('drawings', this.drawings); }
    list(sym) { return this.drawings[sym] || (this.drawings[sym] = []); }
    clearDrawings(sym) { this.drawings[sym] = []; this.selected = null; this.saveDrawings(); this.dirty = true; }

    drawDrawings(ctx, L, n, s) {
      const th = this.th, start = this.env.start();
      const xt = (t) => this.xOf((t - start) / this.tf, L, n);
      for (const d of this.list(s.sym)) {
        const sel = this.selected === d;
        const col = d.type === 'alert' ? th.warn : th.accent;
        ctx.strokeStyle = sel ? th.text : col; ctx.lineWidth = sel ? 2 : 1.25;
        ctx.fillStyle = col;
        if (d.type === 'hline' || d.type === 'alert') {
          const y = Math.round(this.yOf(d.p1.price)) + 0.5;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.plotW, y); ctx.stroke();
          ctx.font = FONT_B; ctx.textAlign = 'right';
          ctx.fillText((d.type === 'alert' ? '🔔 ' : '') + fmtPrice(d.p1.price, s.tick), L.plotW - 6, y - 4);
          this.hits.push({ kind: 'drawing', d, y, text: '' });
        } else if (d.type === 'trend') {
          ctx.beginPath(); ctx.moveTo(xt(d.p1.t), this.yOf(d.p1.price)); ctx.lineTo(xt(d.p2.t), this.yOf(d.p2.price)); ctx.stroke();
          this.hits.push({ kind: 'drawing', d, seg: [xt(d.p1.t), this.yOf(d.p1.price), xt(d.p2.t), this.yOf(d.p2.price)] });
        } else if (d.type === 'rect') {
          const x0 = xt(d.p1.t), x1 = xt(d.p2.t), y0 = this.yOf(d.p1.price), y1 = this.yOf(d.p2.price);
          ctx.fillStyle = alpha(col, 0.1); ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          this.hits.push({ kind: 'drawing', d, box: [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)] });
        } else if (d.type === 'fib') {
          const x0 = Math.min(xt(d.p1.t), xt(d.p2.t)), x1 = Math.max(xt(d.p1.t), xt(d.p2.t), x0 + 60);
          ctx.font = FONT; ctx.textAlign = 'left';
          for (const f of FIB) {
            const p = d.p2.price + (d.p1.price - d.p2.price) * f;
            const y = Math.round(this.yOf(p)) + 0.5;
            ctx.strokeStyle = alpha(col, f === 0.5 || f === 0.618 ? 0.9 : 0.55);
            ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 + 80, y); ctx.stroke();
            ctx.fillStyle = th.text2; ctx.fillText(f.toFixed(3) + '  ' + fmtPrice(p, s.tick), x1 + 84, y + 4);
          }
          this.hits.push({ kind: 'drawing', d, box: [x0, Math.min(this.yOf(d.p1.price), this.yOf(d.p2.price)), x1 - x0 + 80, Math.abs(this.yOf(d.p1.price) - this.yOf(d.p2.price))] });
        }
      }
    }

    drawPendingTool(ctx, L, n, s) {
      const p = this.pending;
      if (!p) return;
      const th = this.th, start = this.env.start();
      const xt = (t) => this.xOf((t - start) / this.tf, L, n);
      const m = this.mouse;
      const p2 = { t: start + this.iOf(m.x, L, n) * this.tf, price: this.pOf(m.y) };
      ctx.strokeStyle = th.accent; ctx.lineWidth = 1.25;
      if (p.type === 'measure') {
        const x0 = xt(p.p1.t), y0 = this.yOf(p.p1.price);
        const up = p2.price >= p.p1.price;
        ctx.fillStyle = alpha(up ? th.up : th.down, 0.12);
        ctx.fillRect(Math.min(x0, m.x), Math.min(y0, m.y), Math.abs(m.x - x0), Math.abs(m.y - y0));
        const dp = p2.price - p.p1.price;
        const bars = Math.round((p2.t - p.p1.t) / this.tf);
        const text = (dp >= 0 ? '+' : DTA.MINUS) + Math.abs(dp).toFixed(DTA.decimalsForTick(s.tick)) + ' (' + DTA.fmtPct(dp / p.p1.price) + ') · ' + bars + ' bars';
        this.tooltip(ctx, L, m.x, m.y, text);
        return;
      }
      if (p.type === 'trend') { ctx.beginPath(); ctx.moveTo(xt(p.p1.t), this.yOf(p.p1.price)); ctx.lineTo(m.x, m.y); ctx.stroke(); }
      if (p.type === 'rect' || p.type === 'fib') { const x0 = xt(p.p1.t), y0 = this.yOf(p.p1.price); ctx.strokeRect(Math.min(x0, m.x), Math.min(y0, m.y), Math.abs(m.x - x0), Math.abs(m.y - y0)); }
    }

    // Alerts fire when price crosses the line.
    checkAlerts() {
      const s = this.env.sym();
      if (!s) return;
      const list = this.list(s.sym);
      const p = s.last * s.tick, prev = (s.prevLast || s.last) * s.tick;
      for (const d of list.slice()) {
        if (d.type !== 'alert') continue;
        if ((prev < d.p1.price && p >= d.p1.price) || (prev > d.p1.price && p <= d.p1.price)) {
          list.splice(list.indexOf(d), 1);
          this.saveDrawings();
          if (this.env.onAlert) this.env.onAlert(s.sym, d.p1.price);
          this.dirty = true;
        }
      }
    }

    // ---------- interaction ----------
    hitAt(x, y, kinds) {
      for (let k = this.hits.length - 1; k >= 0; k--) {
        const h = this.hits[k];
        if (kinds && !kinds.includes(h.kind)) continue;
        if (h.r !== undefined && Math.hypot(h.x - x, h.y - y) <= h.r + 2) return h;
        if (h.kind === 'orderLine' && Math.abs(h.y - y) <= 5 && x < (this.layout ? this.layout.plotW : 1e9)) return h;
        if (h.kind === 'drawing') {
          if (h.y !== undefined && Math.abs(h.y - y) <= 5) return h;
          if (h.seg) { const [x0, y0, x1, y1] = h.seg; const dist = segDist(x, y, x0, y0, x1, y1); if (dist <= 5) return h; }
          if (h.box) { const [bx, by, bw, bh] = h.box; if (x >= bx - 3 && x <= bx + bw + 3 && y >= by - 3 && y <= by + bh + 3) return h; }
        }
      }
      return null;
    }

    pos(e) {
      const r = this.cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    bind() {
      const cv = this.cv;
      cv.addEventListener('pointermove', (e) => this.onMove(e));
      cv.addEventListener('pointerdown', (e) => this.onDown(e));
      this._onUp = (e) => this.onUp(e);
      window.addEventListener('pointerup', this._onUp);
      cv.addEventListener('pointerleave', () => { this.mouse.in = false; this.dirty = true; });
      cv.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      cv.addEventListener('dblclick', (e) => { const p = this.pos(e); if (this.layout && p.x > this.layout.plotW) this.yMan = null; else this.resetView(); });
      cv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!this.layout || this.replayT !== null) return;
        const p = this.pos(e);
        if (p.y > this.layout.mainH) return;
        if (this.env.onContext) this.env.onContext({ px: this.pOf(p.y), x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY });
      });
      // Touch: pinch to zoom.
      this.touches = new Map();
      cv.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { e.preventDefault(); this.pinch = { d: touchDist(e), w: this.barW }; } }, { passive: false });
      cv.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && this.pinch) { e.preventDefault(); this.barW = clamp(this.pinch.w * touchDist(e) / this.pinch.d, 2, 40); this.dirty = true; }
      }, { passive: false });
      cv.addEventListener('touchend', () => { this.pinch = null; });
    }

    onMove(e) {
      const p = this.pos(e);
      this.mouse = { x: p.x, y: p.y, in: true };
      this.dirty = true;
      const L = this.layout;
      if (!L) return;
      const d = this.drag;
      if (d) {
        if (d.kind === 'pan') {
          const dx = p.x - d.x0;
          const n = this.cache.bars.length;
          this.right = d.right0 - dx / this.barW;
          if (this.right >= n - 1 + Math.max(4, 70 / this.barW)) this.right = null;
          if (d.y0 !== undefined && this.yMan) {
            const dp = (p.y - d.y0) / (this.yRange.bot - this.yRange.top) * (d.max0 - d.min0);
            this.yMan = { min: d.min0 + dp, max: d.max0 + dp };
          }
        } else if (d.kind === 'axis') {
          const f = Math.exp((p.y - d.y0) / 150);
          const mid = (d.min0 + d.max0) / 2, half = (d.max0 - d.min0) / 2 * f;
          this.yMan = { min: mid - half, max: mid + half };
        } else if (d.kind === 'order') {
          const s = this.env.sym();
          d.px = Math.round(this.pOf(p.y) / s.tick) * s.tick;
        } else if (d.kind === 'drawing' && d.d.type === 'hline' || (d.kind === 'drawing' && d.d.type === 'alert')) {
          d.d.p1.price = this.pOf(p.y);
        }
        return;
      }
      // Cursor feedback.
      if (this.tool) { this.cv.style.cursor = 'crosshair'; return; }
      if (p.x > L.plotW && p.y < L.mainH) { this.cv.style.cursor = 'ns-resize'; return; }
      const hit = this.hitAt(p.x, p.y, ['cancel', 'orderLine', 'drawing']);
      this.cv.style.cursor = hit ? (hit.kind === 'cancel' ? 'pointer' : 'ns-resize') : 'crosshair';
      if (this.env.onHover) this.env.onHover(this.pOf(p.y));
    }

    onDown(e) {
      if (e.button === 2) return;
      const p = this.pos(e);
      const L = this.layout;
      if (!L) return;
      if (this.o.replay && this.replayT !== null && !this.tool) { this.drag = { kind: 'pan', x0: p.x, right0: this.rightIndex(this.cache.bars.length) }; return; }
      const s = this.env.sym();
      const n = this.cache.bars.length;
      if (this.tool && p.x < L.plotW && p.y < L.mainH) {
        const pt = { t: this.env.start() + this.iOf(p.x, L, n) * this.tf, price: this.pOf(p.y) };
        if (this.tool === 'hline' || this.tool === 'alert') {
          this.list(s.sym).push({ id: DTA.uid('d'), type: this.tool, p1: { t: pt.t, price: Math.round(pt.price / s.tick) * s.tick } });
          this.saveDrawings();
          this.finishTool();
          return;
        }
        if (!this.pending) { this.pending = { type: this.tool, p1: pt }; return; }
        if (this.pending.type !== 'measure') { this.list(s.sym).push({ id: DTA.uid('d'), type: this.pending.type, p1: this.pending.p1, p2: pt }); this.saveDrawings(); }
        this.finishTool();
        return;
      }
      if (p.x > L.plotW && p.y < L.mainH) { this.drag = { kind: 'axis', y0: p.y, min0: this.yRange.min, max0: this.yRange.max }; this.yMan = { min: this.yRange.min, max: this.yRange.max }; return; }
      const hit = this.hitAt(p.x, p.y, ['cancel', 'orderLine', 'drawing']);
      if (hit && hit.kind === 'cancel') { this.env.onCancel(hit.id); return; }
      if (hit && hit.kind === 'orderLine') { this.drag = { kind: 'order', id: hit.id, px: hit.px }; this.cv.setPointerCapture && this.cv.setPointerCapture(e.pointerId); return; }
      if (hit && hit.kind === 'drawing') { this.selected = hit.d; this.dirty = true; if (hit.d.type === 'hline' || hit.d.type === 'alert') this.drag = { kind: 'drawing', d: hit.d }; return; }
      this.selected = null;
      this.drag = { kind: 'pan', x0: p.x, right0: this.rightIndex(n) };
      if (e.shiftKey || this.yMan) { this.drag.y0 = p.y; this.yMan = this.yMan || { min: this.yRange.min, max: this.yRange.max }; this.drag.min0 = this.yMan.min; this.drag.max0 = this.yMan.max; }
    }

    onUp() {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      if (d.kind === 'order' && d.px) this.env.onModify(d.id, d.px);
      if (d.kind === 'drawing') this.saveDrawings();
      this.dirty = true;
    }

    finishTool() {
      this.pending = null;
      this.tool = null;
      this.cv.style.cursor = '';
      this.dirty = true;
      if (this.env.onToolDone) this.env.onToolDone();
    }

    deleteSelected() {
      if (!this.selected) return false;
      const s = this.env.sym();
      const list = this.list(s.sym);
      const i = list.indexOf(this.selected);
      if (i >= 0) list.splice(i, 1);
      this.selected = null;
      this.saveDrawings();
      this.dirty = true;
      return true;
    }

    onWheel(e) {
      e.preventDefault();
      const L = this.layout;
      if (!L) return;
      const n = this.cache.bars.length;
      const p = this.pos(e);
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const r = this.rightIndex(n) + (e.deltaX || e.deltaY) / this.barW * 0.6;
        this.right = r >= n - 1 + Math.max(4, 70 / this.barW) ? null : r;
      } else {
        const anchor = this.iOf(p.x, L, n);
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const nw = clamp(this.barW * f, 2, 42);
        const wasFollow = this.right === null;
        this.barW = nw;
        if (!wasFollow) this.right = anchor + (L.plotW - p.x - nw / 2) / nw;
      }
      this.dirty = true;
    }

    // Replay helpers.
    setReplay(t) { this.replayT = t; this.cache.key = ''; this.dirty = true; }

    destroy() { if (this._onUp) window.removeEventListener('pointerup', this._onUp); this._onUp = null; }
  }

  function touchDist(e) { const a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; }
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }

  DTA.Chart = Chart;
  DTA.chartTheme = theme;
})();
