// Day Trade Arena: the main price chart, drawn on canvas.
//
// One timeline: 1-minute history (yesterday's session, the overnight or premarket, and any of today's session
// before the match) followed by the live candles. Sessions are shaded and labelled, and key levels (prior day,
// overnight or premarket range, opening range, initial balance, high/low of day, VWAP, round numbers) are drawn
// with confluence zones where several levels stack up. A navigator strip under the time axis shows the whole
// day; drag its window to move around.
//
// Candles / Heikin-Ashi / OHLC bars / line / area, volume, VWAP (+1σ/2σ, reset each session), EMA 9/20/50,
// Bollinger, a session volume profile, delta, CVD, RSI and MACD panes, a liquidity heatmap and big-print bubbles.
// On top: working orders (drag to move, × to cancel), the position with open P&L, fills, rivals' fills with their
// avatar, news flags, halts, price alerts and drawings. Wheel or pinch zooms, drag pans, drag the price axis to
// rescale, double-click to snap back to live.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { clamp, fmtPrice, fmtQty, fmtSignedMoney, fmtClock, fitCanvas, ind } = DTA;
  const LV = DTA.levels;

  const AXIS_W = 70, TIME_H = 22, NAV_H = 34, LEGEND_PAD = 8;
  const FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
  const FONT_B = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
  const FONT_S = '10px system-ui, -apple-system, "Segoe UI", sans-serif';
  const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  function theme() {
    const v = (n, f) => DTA.cssVar(n, f);
    return {
      bg: v('--chart-bg', '#12161c'), bg2: v('--chart-bg-2', '#151a22'), grid: v('--grid', '#1d232c'), axis: v('--axis', '#2b333e'),
      text: v('--text-1', '#e8ebef'), text2: v('--text-2', '#aab2bd'), text3: v('--text-3', '#6f7a87'),
      up: v('--up', '#1fb884'), down: v('--down', '#ef4f5a'), warn: v('--warn', '#fab219'),
      s1: v('--series-1', '#3987e5'), s2: v('--series-2', '#d95926'), s3: v('--series-3', '#199e70'), s4: v('--series-4', '#c98500'),
      s5: v('--series-5', '#d55181'), s7: v('--series-7', '#9085e9'), surface: v('--surface', '#12161c'), panel: v('--panel', '#171c24'),
      good: v('--good', '#0ca30c'), bad: v('--critical', '#d03b3b'), accent: v('--accent', '#3987e5'),
      sess: v('--session-shade', 'rgba(120,140,170,0.055)')
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

  // History bars [t, o, h, l, c, v, buyVol] (ticks, 1 minute) → chart bars at tfSec (60 or more).
  function aggHist(hist, tick, tfSec) {
    const out = [];
    let cur = null;
    for (const b of hist) {
      const t0 = Math.floor(b[0] / tfSec) * tfSec;
      if (!cur || cur.t !== t0) {
        cur = { t: t0, dur: tfSec, o: b[1] * tick, h: b[2] * tick, l: b[3] * tick, c: b[4] * tick, v: b[5], d: 2 * b[6] - b[5], hist: true };
        out.push(cur);
      } else {
        if (b[2] * tick > cur.h) cur.h = b[2] * tick;
        if (b[3] * tick < cur.l) cur.l = b[3] * tick;
        cur.c = b[4] * tick; cur.v += b[5]; cur.d += 2 * b[6] - b[5];
      }
    }
    return out;
  }

  // Session VWAP with 1σ/2σ bands, restarting at the regular open and at the start of the overnight/premarket.
  function vwapSessions(bars, kinds) {
    const n = bars.length;
    const v = new Array(n).fill(NaN), u1 = new Array(n).fill(NaN), l1 = new Array(n).fill(NaN), u2 = new Array(n).fill(NaN), l2 = new Array(n).fill(NaN);
    const reset = new Uint8Array(n);
    let pv = 0, vv = 0, p2v = 0;
    for (let i = 0; i < n; i++) {
      const k = kinds[i], pk = i > 0 ? kinds[i - 1] : null;
      const ext = (x) => x === 'on' || x === 'pre';
      if (i === 0 || (k === 'rth' && pk !== 'rth') || (ext(k) && !ext(pk))) { pv = 0; vv = 0; p2v = 0; reset[i] = 1; }
      const b = bars[i];
      const tp = (b.h + b.l + b.c) / 3;
      pv += tp * b.v; vv += b.v; p2v += tp * tp * b.v;
      if (vv > 0) {
        const w = pv / vv;
        const sd = Math.sqrt(Math.max(0, p2v / vv - w * w));
        v[i] = w; u1[i] = w + sd; l1[i] = w - sd; u2[i] = w + 2 * sd; l2[i] = w - 2 * sd;
      }
    }
    return { v, u1, l1, u2, l2, reset };
  }

  // Colours for level groups.
  function levelColor(th, grp) {
    switch (grp) {
      case 'pd': return th.s1;
      case 'vp': return th.s3;
      case 'on': return th.s7;
      case 'or': case 'ib': return th.s4;
      case 'day': return th.s5;
      case 'vwap': return th.s4;
      default: return th.text3;
    }
  }

  class Chart {
    // env: {sym(), start(), now(), speed(), days(), orders(sym), position(sym), fills(sym), rivals(sym), news(sym),
    //       levels(sym), cal(), player(pid), onModify(id,px), onCancel(id), onContext({...}), onAlert(d), onToolDone(), onHover(info)}
    constructor(canvas, env, opts) {
      this.cv = canvas;
      this.env = env;
      this.o = Object.assign({ interactive: true, replay: false, nav: true }, opts || {});
      this.tf = 60;
      this.type = 'candles';
      this.show = {
        vol: true, vwap: true, vwapBands: false, ema9: true, ema20: true, ema50: false, bb: false, vp: true, rsi: false, macd: false,
        delta: false, cvd: false, heat: false, bubbles: true, rivals: true, fills: true, news: true,
        levels: true, rn: true, sessions: true, nav: true, cal: true
      };
      this.barW = 8;
      this.right = null;       // bar index at the right edge; null = follow live
      this.yMan = null;        // manual price range when the axis was dragged
      this.yCur = null;        // animated range
      this.agg = new ind.Agg(this.tf);
      this.hcache = { key: '', bars: [] };
      this.cache = { key: '', bars: [], ha: null, calc: null, kinds: [], liveFrom: 0 };
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
    setTf(tf) { if (tf !== this.tf) { this.tf = tf; this.agg = new ind.Agg(tf); this.cache.key = ''; this.hcache.key = ''; this.right = null; this.dirty = true; } }
    setType(t) { this.type = t; this.dirty = true; }
    toggle(k, v) { this.show[k] = v === undefined ? !this.show[k] : v; this.dirty = true; }
    resetView() { this.right = null; this.yMan = null; this.barW = 8; this.dirty = true; }
    setTool(t) { this.tool = t; this.pending = null; this.cv.style.cursor = t ? 'crosshair' : ''; this.dirty = true; }

    // Fit today's session (from the overnight or premarket start) in the window, following live.
    viewToday() {
      const d = this.data();
      if (!d || !this.layout) return;
      const s = d.sym;
      const w = LV.windows(s.meta || { rth: [DTA.RTH_OPEN, DTA.RTH_CLOSE], kind: 'stock' });
      const from = this.env.now() >= w.rth[0] + 1800 ? w.rth[0] : w.on[0];
      const i = Math.max(0, Math.floor(this.idxOfT(from)));
      const n = d.bars.length;
      this.barW = clamp(this.layout.plotW / Math.max(10, n - i + 6), 1.5, 40);
      this.right = null; this.yMan = null; this.dirty = true;
    }
    // Everything from the start of the history.
    viewAll() {
      const d = this.data();
      if (!d || !this.layout) return;
      this.barW = clamp(this.layout.plotW / Math.max(10, d.bars.length + 6), 0.6, 40);
      this.right = null; this.yMan = null; this.dirty = true;
    }
    // Centre a time on screen (trade review, clicking an event).
    viewTime(t, bars) {
      const d = this.data();
      if (!d || !this.layout) return;
      const i = this.idxOfT(t);
      if (bars) this.barW = clamp(this.layout.plotW / bars, 1.5, 40);
      const vis = this.layout.plotW / this.barW;
      const r = i + vis / 2;
      this.right = r >= d.bars.length - 1 + Math.max(4, 70 / this.barW) ? null : r;
      this.dirty = true;
    }
    snapshotPng() { try { return this.cv.toDataURL('image/png'); } catch (e) { return null; } }

    // ---------- data ----------
    data() {
      const s = this.env.sym();
      if (!s) return null;
      const key = (s.uid || s.sym) + ':' + this.tf;
      if (key !== this.symKey) { this.symKey = key; this.agg = new ind.Agg(this.tf); this.cache.key = ''; this.hcache.key = ''; this.yCur = null; this.animLast = null; }
      const v = key + ':' + s.version + ':' + this.type + ':' + (this.replayT || '') + ':' + this.show.rsi + this.show.macd + this.show.cvd;
      if (this.cache.key === v) return this.cache;
      const htf = Math.max(60, this.tf);
      const hk = (s.uid || s.sym) + ':' + htf + ':' + (s.histBars ? s.histBars.length : 0);
      if (this.hcache.key !== hk) {
        const hb = aggHist(s.histBars || [], s.tick, htf);
        const meta = s.meta;
        this.hcache = { key: hk, bars: hb, kinds: meta ? hb.map((b) => LV.sessionAt(meta, b.t)) : hb.map(() => 'rth') };
      }
      // Host deltas only ever rewrite the last bar or append, so rebuilding from the last seen bar is enough.
      let live = this.agg.update(s.bars, s.tick, this.env.start());
      if (this.replayT !== null) {
        const n = Math.max(1, Math.floor((this.replayT - this.env.start()) / this.tf) + 1);
        live = live.slice(0, n);
      }
      for (const b of live) if (!b.dur) b.dur = this.tf;
      const hist = this.hcache.bars;
      const bars = hist.length ? hist.concat(live) : live.slice();
      const kinds = this.hcache.kinds.slice();
      const meta = s.meta;
      for (let i = kinds.length; i < bars.length; i++) kinds.push(meta ? LV.sessionAt(meta, bars[i].t) : 'rth');
      const cl = bars.map((b) => b.c);
      const calc = {
        vwap: vwapSessions(bars, kinds), ema9: ind.ema(cl, 9), ema20: ind.ema(cl, 20), ema50: ind.ema(cl, 50), bb: ind.bollinger(cl, 20, 2),
        rsi: this.show.rsi ? ind.rsi(cl, 14) : null, macd: this.show.macd ? ind.macd(cl) : null, cvd: this.show.cvd ? ind.cvd(bars) : null
      };
      this.cache = { key: v, bars, ha: this.type === 'heikin' ? ind.heikinAshi(bars) : null, calc, sym: s, kinds, liveFrom: hist.length };
      return this.cache;
    }

    // Time ↔ bar index. Bars are equally spaced on screen whatever their duration.
    idxOfT(t) {
      const B = this.cache.bars;
      const n = B.length;
      if (!n) return (t - this.env.start()) / this.tf;
      if (t < B[0].t) return (t - B[0].t) / B[0].dur;
      let lo = 0, hi = n - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m].t <= t) lo = m; else hi = m - 1; }
      const b = B[lo];
      const f = (t - b.t) / b.dur;
      return lo === n - 1 ? lo + f : lo + Math.min(f, 0.999);
    }
    tOfIdx(i) {
      const B = this.cache.bars;
      const n = B.length;
      if (!n) return this.env.start() + i * this.tf;
      if (i < 0) return B[0].t + i * B[0].dur;
      if (i >= n - 1) return B[n - 1].t + (i - (n - 1)) * B[n - 1].dur;
      const k = Math.floor(i);
      return B[k].t + (i - k) * B[k].dur;
    }

    // ---------- geometry ----------
    computeLayout(w, h) {
      const subs = [];
      if (this.show.delta) subs.push('delta');
      if (this.show.cvd) subs.push('cvd');
      if (this.show.rsi) subs.push('rsi');
      if (this.show.macd) subs.push('macd');
      const nav = this.o.nav && this.show.nav && h > 260 ? NAV_H : 0;
      const plotW = Math.max(40, w - AXIS_W);
      const subH = subs.length ? Math.max(50, Math.min(110, (h * (subs.length > 2 ? 0.4 : 0.28)) / subs.length)) : 0;
      const mainH = Math.max(80, h - TIME_H - nav - subH * subs.length);
      const panes = [{ id: 'main', y: 0, h: mainH }];
      let y = mainH;
      for (const s of subs) { panes.push({ id: s, y, h: subH }); y += subH; }
      return { w, h, plotW, mainH, panes, timeY: y, navY: y + TIME_H, navH: nav };
    }
    rightIndex(n) { return this.right === null ? n - 1 + Math.max(4, 70 / this.barW) : this.right; }
    xOf(i, L, n) { return L.plotW - (this.rightIndex(n) - i) * this.barW - this.barW / 2; }
    iOf(x, L, n) { return this.rightIndex(n) - (L.plotW - x - this.barW / 2) / this.barW; }
    xOfT(t, L, n) { return this.xOf(this.idxOfT(t), L, n); }
    yOf(p) { const r = this.yRange; return r.top + (r.max - p) / (r.max - r.min) * (r.bot - r.top); }
    pOf(y) { const r = this.yRange; return r.max - (y - r.top) / (r.bot - r.top) * (r.max - r.min); }

    // ---------- render ----------
    render() {
      const cv = this.cv;
      if (!cv.isConnected || cv.offsetParent === null) return;
      const { ctx, w, h } = fitCanvas(cv);
      const L = this.layout = this.computeLayout(w, h);
      const th = this.th;
      const bgGrad = ctx.createLinearGradient(0, 0, 0, L.mainH);
      bgGrad.addColorStop(0, th.bg2); bgGrad.addColorStop(1, th.bg);
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, L.plotW, L.mainH);
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
      const volH = this.show.vol ? L.mainH * 0.16 : 0;
      this.yRange = { min: this.yCur.min, max: this.yCur.max, top: 18, bot: L.mainH - 6 - volH * 0.4 };
      this.vis = { i0, i1, n };

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, L.plotW, L.mainH); ctx.clip();
      if (this.show.sessions) this.drawSessions(ctx, L, d, i0, i1, n);
      this.drawGrid(ctx, L, bars, i0, i1, n);
      if (this.show.heat) this.drawHeat(ctx, L, s, d, i0, i1, n);
      this.drawHalts(ctx, L, n, s);
      if (this.env.highlight) this.drawHighlight(ctx, L, n, s);
      if (this.show.vp) this.drawProfile(ctx, L, raw, d, s);
      if (this.show.vol) this.drawVolume(ctx, L, raw, i0, i1, n, volH);
      this.lvBoxes = [];
      if (this.show.levels) this.drawLevels(ctx, L, s);
      else this.drawPrevClose(ctx, L, s);
      if (this.show.bb) this.drawBands(ctx, L, c.bb.up, c.bb.lo, c.bb.mid, th.s3, i0, i1, n);
      if (this.show.vwap && this.show.vwapBands) {
        this.drawLine(ctx, L, c.vwap.u1, alpha(th.s4, 0.45), i0, i1, n, 1, c.vwap.reset);
        this.drawLine(ctx, L, c.vwap.l1, alpha(th.s4, 0.45), i0, i1, n, 1, c.vwap.reset);
        this.drawLine(ctx, L, c.vwap.u2, alpha(th.s4, 0.3), i0, i1, n, 1, c.vwap.reset);
        this.drawLine(ctx, L, c.vwap.l2, alpha(th.s4, 0.3), i0, i1, n, 1, c.vwap.reset);
      }
      this.drawPositionZone(ctx, L, s);
      this.drawSeries(ctx, L, bars, i0, i1, n, s);
      if (this.show.ema50) this.drawLine(ctx, L, c.ema50, th.s5, i0, i1, n, 1.25);
      if (this.show.ema20) this.drawLine(ctx, L, c.ema20, th.s7, i0, i1, n, 1.25);
      if (this.show.ema9) this.drawLine(ctx, L, c.ema9, th.s1, i0, i1, n, 1.25);
      if (this.show.vwap) this.drawLine(ctx, L, c.vwap.v, th.s4, i0, i1, n, 2, c.vwap.reset);
      if (this.show.bubbles) this.drawBubbles(ctx, L, n, s);
      this.drawDrawings(ctx, L, n, s);
      if (this.show.rivals) this.drawRivalFills(ctx, L, n, s);
      if (this.show.fills) this.drawMyFills(ctx, L, n, s);
      if (this.show.news) this.drawNews(ctx, L, n, s);
      if (this.show.cal) this.drawCalendar(ctx, L, n, s);
      this.drawLastLine(ctx, L, s, bars);
      this.drawOrders(ctx, L, s);
      this.drawGhost(ctx, L, s);
      this.drawPosition(ctx, L, s);
      this.drawRef(ctx, L, s);
      this.drawPendingTool(ctx, L, n, s);
      if (this.show.levels) this.drawOffscreenLevels(ctx, L, s);
      ctx.restore();

      this.drawSubPanes(ctx, L, bars, c, i0, i1, n);
      this.drawPriceAxis(ctx, L, s, bars);
      this.drawTimeAxis(ctx, L, bars, i0, i1, n);
      if (L.navH) this.drawNav(ctx, L, d, i0, i1, n);
      this.drawCrosshair(ctx, L, bars, n, s);
      this.drawLegend(ctx, L, bars, raw, c, n, s, d);
      if (this.show.heat && s.heat && s.heat.length) this.drawHeatLegend(ctx, L);
      if (s.halted && this.replayT === null) this.drawHaltBadge(ctx, L, s);
    }

    drawEmpty(ctx, L) {
      ctx.fillStyle = this.th.text3;
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for the opening print…', L.plotW / 2, L.mainH / 2);
    }

    // Overnight, premarket and after-hours are shaded; each session change and day change gets a separator.
    drawSessions(ctx, L, d, i0, i1, n) {
      const th = this.th, kinds = d.kinds, bars = d.bars;
      const days = this.env.days ? this.env.days() : null;
      let runStart = null;
      const flush = (a, b) => {
        const x0 = this.xOf(a, L, n) - this.barW / 2, x1 = this.xOf(b, L, n) + this.barW / 2;
        ctx.fillStyle = th.sess;
        ctx.fillRect(x0, 0, x1 - x0, L.mainH);
      };
      for (let i = Math.max(0, i0 - 1); i <= i1; i++) {
        const shaded = kinds[i] !== 'rth';
        if (shaded && runStart === null) runStart = i;
        if ((!shaded || i === i1) && runStart !== null) { flush(runStart, shaded ? i : i - 1); runStart = null; }
      }
      // Separators and labels.
      ctx.font = FONT_S;
      ctx.textAlign = 'left';
      let lastLabelX = -1e9;
      for (let i = Math.max(1, i0); i <= i1; i++) {
        const k = kinds[i], pk = kinds[i - 1];
        const b = bars[i], pb = bars[i - 1];
        const gap = b.t - (pb.t + pb.dur) > pb.dur * 1.5;
        const liveEdge = i === d.liveFrom && d.liveFrom > 0;
        if (k === pk && !gap && !liveEdge) continue;
        const x = Math.round(this.xOf(i, L, n) - this.barW / 2) + 0.5;
        let label = '';
        const dayIdx = Math.floor(b.t / 86400);
        const dayName = days ? (dayIdx < 0 ? days[0] : days[1]) : '';
        if (liveEdge) label = '▶ Match start ' + fmtClock(b.t, false);
        else if (k === 'rth') label = (dayIdx < 0 ? dayName + ' ' : '') + 'Open ' + fmtClock(b.t, false);
        else if (k === 'on') label = 'Globex ' + fmtClock(b.t, false);
        else if (k === 'pre') label = (dayName ? dayName + ' ' : '') + 'Premarket';
        else if (k === 'post') label = 'Cash close';
        ctx.strokeStyle = liveEdge ? alpha(th.accent, 0.7) : alpha(th.text3, k === 'rth' ? 0.55 : 0.35);
        ctx.setLineDash(liveEdge ? [] : [3, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, L.mainH); ctx.stroke();
        ctx.setLineDash([]);
        if (label && x - lastLabelX > 90 && x > 4 && x < L.plotW - 40) {
          ctx.fillStyle = liveEdge ? th.accent : th.text3;
          ctx.fillText(label, x + 4, L.mainH - (liveEdge ? 30 : 18));
          lastLabelX = x;
        }
      }
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
      const tStep = this.timeStep(bars, i0, i1);
      for (let i = Math.max(1, i0); i <= i1; i++) {
        if (Math.floor(bars[i].t / tStep) !== Math.floor(bars[i - 1].t / tStep)) {
          const x = Math.round(this.xOf(i, L, n) - this.barW / 2) + 0.5;
          ctx.moveTo(x, 0); ctx.lineTo(x, L.mainH);
        }
      }
      ctx.stroke();
      // Symbol watermark.
      const s = this.env.sym();
      ctx.fillStyle = alpha(th.text, 0.035);
      ctx.font = '700 ' + Math.round(Math.min(96, L.plotW / 6)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.sym, L.plotW / 2, L.mainH / 2);
      ctx.font = '600 ' + Math.round(Math.min(18, L.plotW / 34)) + 'px system-ui, sans-serif';
      ctx.fillText(s.name || '', L.plotW / 2, L.mainH / 2 + Math.min(58, L.plotW / 10));
      ctx.textBaseline = 'alphabetic';
    }
    // Spacing of time labels from the average bar duration on screen.
    timeStep(bars, i0, i1) {
      const span = bars[i1] && bars[i0] ? (i1 - i0) : 1;
      let secPerBar = this.tf;
      if (bars[i0] && bars[i1] && i1 > i0) secPerBar = Math.max(this.tf, Math.min(bars[i0].dur, bars[i1].dur));
      const pxPerSec = this.barW / secPerBar;
      void span;
      const opts = [60, 300, 600, 900, 1800, 3600, 7200, 14400, 21600];
      for (const o of opts) if (o * pxPerSec >= 90) return o;
      return 21600;
    }

    drawHalts(ctx, L, n, s) {
      const th = this.th;
      for (const hl of s.haltList || []) {
        const x0 = this.xOfT(hl[0], L, n) - this.barW / 2;
        const endT = hl[1] > hl[0] ? Math.min(hl[1], this.env.now()) : this.env.now();
        const x1 = this.xOfT(endT, L, n) - this.barW / 2;
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

    // Trade review: shade the holding period and mark entry and exit prices.
    drawHighlight(ctx, L, n, s) {
      const hl = this.env.highlight();
      if (!hl) return;
      const th = this.th;
      const x0 = this.xOfT(hl.t0, L, n) - this.barW / 2, x1 = this.xOfT(hl.t1, L, n) + this.barW / 2;
      const col = hl.pnl >= 0 ? th.up : th.down;
      ctx.fillStyle = alpha(col, 0.08);
      ctx.fillRect(x0, 0, Math.max(3, x1 - x0), L.mainH);
      ctx.strokeStyle = alpha(col, 0.6); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, 0); ctx.lineTo(Math.round(x0) + 0.5, L.mainH); ctx.moveTo(Math.round(x1) + 0.5, 0); ctx.lineTo(Math.round(x1) + 0.5, L.mainH); ctx.stroke();
      ctx.setLineDash([5, 4]);
      for (const [p, label] of [[hl.entry, 'Entry'], [hl.exit, 'Exit']]) {
        const y = Math.round(this.yOf(p)) + 0.5;
        ctx.strokeStyle = th.text2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.fillStyle = th.text2; ctx.font = FONT; ctx.textAlign = 'right';
        ctx.fillText(label + ' ' + fmtPrice(p, s.tick), x0 - 4, y + 4);
      }
      ctx.setLineDash([]);
      const text = (hl.side > 0 ? 'Long ' : 'Short ') + fmtQty(hl.qty) + ' · ' + fmtSignedMoney(hl.pnl) + ' · held ' + DTA.fmtHold(hl.t1 - hl.t0);
      ctx.font = FONT_B;
      const tw = ctx.measureText(text).width + 16;
      const tx = clamp((x0 + x1) / 2 - tw / 2, 4, L.plotW - tw - 4);
      roundRect(ctx, tx, 26, tw, 22, 5);
      ctx.fillStyle = th.panel; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.fillText(text, tx + tw / 2, 41);
    }

    // Bookmap-style resting liquidity (live candles only): for each candle column, the average size resting at
    // each price level while that candle formed. One hue; brighter means more size waiting there.
    drawHeat(ctx, L, s, d, i0, i1, n) {
      const H = s.heat;
      if (!H || !H.length) return;
      const th = this.th, tick = s.tick, B = d.bars;
      const r = this.yRange;
      const pxPerTick = ((r.bot - r.top) / (r.max - r.min)) * tick;
      const grp = Math.max(1, Math.ceil(2.5 / Math.max(1e-6, pxPerTick)));
      const j0 = Math.max(i0, d.liveFrom);
      if (j0 > i1) return;
      const t0 = B[j0].t;
      let lo = 0, hi = H.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (H[mid][0] < t0) lo = mid + 1; else hi = mid; }
      let k = Math.max(0, lo - 1);
      const cells = [];
      let mx = 0;
      let prev = lo > 0 ? H[lo - 1] : null;
      const minIdx = Math.floor(r.min / tick), maxIdx = Math.ceil(r.max / tick);
      for (let i = j0; i <= i1; i++) {
        const ct0 = B[i].t, ct1 = ct0 + B[i].dur;
        const acc = new Map();
        let cnt = 0;
        while (k < H.length && H[k][0] < ct1) {
          if (H[k][0] >= ct0) { this.accHeat(acc, H[k], grp, minIdx, maxIdx); cnt++; }
          prev = H[k];
          k++;
        }
        if (!cnt && prev && ct0 - prev[0] < B[i].dur * 4 + 60) { this.accHeat(acc, prev, grp, minIdx, maxIdx); cnt = 1; }
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

    // Large single orders on the tape, sized by quantity traded.
    drawBubbles(ctx, L, n, s) {
      const list = s.big;
      if (!list || !list.length) return;
      const th = this.th;
      const thr = s.bigThreshold || 1;
      const x0 = this.tOfIdx(this.rightIndex(n) - L.plotW / this.barW - 2);
      for (let k = list.length - 1; k >= 0; k--) {
        const [t, idx, qty, side] = list[k];
        if (t < x0) break;
        if (this.replayT !== null && t > this.replayT) continue;
        const x = this.xOf(Math.floor(this.idxOfT(t)), L, n);
        if (x < -20 || x > L.plotW + 20) continue;
        const y = this.yOf(idx * s.tick);
        const rad = clamp(3.5 + 5 * Math.sqrt(Math.max(0, qty / thr - 0.6)), 4, 16);
        const col = side > 0 ? th.up : side < 0 ? th.down : th.warn;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = alpha(col, 0.14); ctx.fill();
        ctx.lineWidth = 1.1; ctx.strokeStyle = alpha(col, 0.7); ctx.stroke();
        this.hits.push({ kind: 'big', x, y, r: rad, text: 'Big print ' + fmtQty(qty) + ' @ ' + fmtPrice(idx * s.tick, s.tick) + (side > 0 ? ' · buyer lifted the offer' : side < 0 ? ' · seller hit the bid' : ' · auction') + ' · ' + fmtClock(t) });
      }
    }

    // Volume at price for the current session (regular session once it has opened, else the overnight or premarket).
    drawProfile(ctx, L, raw, d, s) {
      const th = this.th, r = this.yRange;
      const kinds = d.kinds;
      let from = raw.length - 1;
      const k0 = kinds[raw.length - 1];
      while (from > 0 && (kinds[from - 1] === k0 || (k0 !== 'rth' && kinds[from - 1] !== 'rth' && kinds[from - 1] !== 'closed'))) from--;
      const nb = Math.max(20, Math.min(70, Math.round(L.mainH / 7)));
      const prof = ind.volumeProfile(raw, from, raw.length, r.min, r.max, nb);
      if (!prof.total) return;
      let mx = 0;
      for (const v of prof.bins) if (v > mx) mx = v;
      const maxW = L.plotW * 0.14;
      const x1 = L.plotW - 2;
      for (let k = 0; k < nb; k++) {
        const v = prof.bins[k];
        if (!v) continue;
        const pTop = prof.lo + (k + 1) * prof.w, pBot = prof.lo + k * prof.w;
        const y0 = this.yOf(pTop), y1 = this.yOf(pBot);
        const bw = (v / mx) * maxW;
        const inVA = k >= prof.vaLo && k <= prof.vaHi;
        ctx.fillStyle = k === prof.poc ? alpha(th.s4, 0.45) : alpha(th.text2, inVA ? 0.12 : 0.055);
        ctx.fillRect(x1 - bw, y0 + 1, bw, Math.max(1, y1 - y0 - 2));
      }
      void s;
    }

    // Volume bars. History minutes and live candles have different lengths, so height is volume per second.
    drawVolume(ctx, L, raw, i0, i1, n, volH) {
      const th = this.th;
      let mx = 0;
      for (let i = i0; i <= i1; i++) { const b = raw[i]; if (b && b.v) { const r = b.v / b.dur; if (r > mx) mx = r; } }
      if (!mx) return;
      const base = L.mainH - 1;
      const bw = Math.max(1, this.barW * 0.72);
      for (let i = i0; i <= i1; i++) {
        const b = raw[i];
        if (!b || !b.v) continue;
        const hgt = ((b.v / b.dur) / mx) * volH;
        const x = this.xOf(i, L, n);
        ctx.fillStyle = alpha(b.c >= b.o ? th.up : th.down, b.hist ? 0.2 : 0.3);
        ctx.fillRect(Math.round(x - bw / 2), base - hgt, Math.max(1, Math.round(bw)), hgt);
      }
    }

    drawPrevClose(ctx, L, s) {
      if (!s.prev) return;
      const th = this.th, p = s.prev * s.tick, y = this.yOf(p);
      if (y < 0 || y > L.mainH) return;
      ctx.strokeStyle = alpha(th.text2, 0.45);
      ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(L.plotW, Math.round(y) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = th.text3; ctx.font = FONT; ctx.textAlign = 'left';
      ctx.fillText('Prev close ' + fmtPrice(p, s.tick), 6, y - 4);
    }

    // Key levels and confluence zones. Several levels within a few ticks merge into one zone: a band, a
    // heavier line and a combined label. Developing levels (high/low of day, VWAP, overnight while it forms)
    // are dashed. Round numbers are faint unless they line up with something else.
    drawLevels(ctx, L, s) {
      const lv = this.env.levels ? this.env.levels(s.sym) : null;
      if (!lv) return;
      const th = this.th, tick = s.tick, K = LV.KINDS;
      const labels = [];
      this.lvDrawn = [];
      for (const z of lv.zones) {
        const members = z.members.filter((m) => m.k !== 'VWAP' || !this.show.vwap);
        if (!members.length) continue;
        const named = members.filter((m) => K[m.k].label);
        const onlyRound = !named.length;
        if (onlyRound && !this.show.rn) continue;
        const major = members.some((m) => m.k === 'RN');
        const p = z.idx * tick;
        const y = this.yOf(p);
        if (y < -4 || y > L.mainH + 4) continue;
        const main = named.length ? named[0] : members[0];
        const grp = K[main.k].grp;
        const col = levelColor(th, grp);
        const conf = named.length + (members.some((m) => !K[m.k].label) ? 1 : 0) >= 2;
        const dev = named.length && named.every((m) => m.dev);
        const yy = Math.round(y) + 0.5;
        if (conf) {
          const yTop = this.yOf(z.hi * tick + tick / 2), yBot = this.yOf(z.lo * tick - tick / 2);
          ctx.fillStyle = alpha(col, 0.07 + 0.08 * z.s);
          ctx.fillRect(0, yTop, L.plotW, Math.max(3, yBot - yTop));
        }
        ctx.strokeStyle = onlyRound ? alpha(th.text3, major ? 0.45 : 0.22) : alpha(col, conf ? 0.95 : 0.7);
        ctx.lineWidth = conf ? 1.6 : 1;
        ctx.setLineDash(onlyRound ? [1, 5] : dev ? [6, 4] : []);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(L.plotW, yy); ctx.stroke();
        ctx.setLineDash([]);
        if (onlyRound && !major) continue;
        const rm = members.find((m) => m.k === 'RN' || m.k === 'rn');
        const rp = rm ? rm.idx * tick : p;
        const text = (conf ? '◆ ' : '') + (named.length ? named.map((m) => K[m.k].label).join(' · ') + (rm ? ' · ' + roundTxt(rp) : '') : roundTxt(rp));
        labels.push({ y, text, col: onlyRound ? th.text3 : col, conf, z, round: onlyRound, names: members.map((m) => K[m.k].name + (m.k === 'RN' || m.k === 'rn' ? ' ' + roundTxt(m.idx * tick) : ' ' + fmtPrice(m.idx * tick, tick))), p, strong: conf || z.s >= 0.6 });
        this.lvDrawn.push({ y, z, col });
      }
      // Labels at the right edge of the plot, nudged apart so they never overlap.
      labels.sort((a, b) => a.y - b.y);
      // Round numbers on their own only get a label when there's room; named levels always do.
      for (let k = 0, lastR = -1e9; k < labels.length; k++) {
        const lb = labels[k];
        if (!lb.round) continue;
        if (lb.y - lastR < 44) { labels.splice(k, 1); k--; } else lastR = lb.y;
      }
      let lastY = -1e9;
      ctx.font = FONT_S;
      const right = L.plotW - 6 - (this.show.vp ? L.plotW * 0.14 * 0.25 : 0);
      this.lvBoxes = [];
      for (const lb of labels) {
        let y = Math.max(lb.y, lastY + 15);
        if (y > L.mainH - 8) continue;
        lastY = y;
        const tw = ctx.measureText(lb.text).width + 12;
        const x = right - tw;
        this.lvBoxes.push([x, y - 8, tw, 16]);
        roundRect(ctx, x, y - 7.5, tw, 15, 7.5);
        ctx.fillStyle = alpha(this.th.panel, 0.88); ctx.fill();
        ctx.strokeStyle = alpha(lb.col, lb.conf ? 0.95 : 0.6); ctx.lineWidth = lb.conf ? 1.4 : 1; ctx.stroke();
        ctx.fillStyle = lb.conf ? this.th.text : this.th.text2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(lb.text, x + 6, y + 0.5);
        ctx.textBaseline = 'alphabetic';
        this.hits.push({ kind: 'level', box: [x, y - 8, tw, 16], text: (lb.conf ? 'Confluence: ' : '') + lb.names.join(' + ') + ' @ ' + fmtPrice(lb.p, tick) + (lb.conf ? '. Several levels stacked here make a stronger reaction more likely.' : '') });
      }
      function roundTxt(px) { return px >= 1000 ? String(Math.round(px)) : px >= 100 ? px.toFixed(px % 1 ? 2 : 0) : px.toFixed(2); }
    }

    // The nearest strong level above and below the visible range, as tags at the top and bottom edge.
    drawOffscreenLevels(ctx, L, s) {
      const lv = this.env.levels ? this.env.levels(s.sym) : null;
      if (!lv) return;
      const th = this.th, tick = s.tick, K = LV.KINDS, r = this.yRange;
      let above = null, below = null;
      for (const z of lv.zones) {
        const named = z.members.filter((m) => K[m.k].label && m.k !== 'VWAP');
        if (!named.length || z.s < 0.5) continue;
        const p = z.idx * tick;
        if (p > r.max && (!above || p < above.p)) above = { p, z, named };
        if (p < r.min && (!below || p > below.p)) below = { p, z, named };
      }
      ctx.font = FONT_S;
      for (const [o, top] of [[above, true], [below, false]]) {
        if (!o) continue;
        const text = (top ? '▲ ' : '▼ ') + o.named.map((m) => K[m.k].label).join(' · ') + ' ' + fmtPrice(o.p, tick) + '  (' + DTA.fmtPct(o.p / (s.last * tick) - 1, 2) + ')';
        const tw = ctx.measureText(text).width + 12;
        const x = L.plotW - tw - 8;
        // Top tag: level with the legend when there's room beside it, else under it (calendar flags sit lower).
        let y = top ? 12 : L.mainH - 24 - (this.bottomInset || 0);
        const lw1 = this.legendW1 === undefined ? 520 : this.legendW1, lw2 = this.legendW2 === undefined ? 330 : this.legendW2;
        if (top && lw1 > x - 6) y = lw2 > x - 6 ? 46 : 29;
        roundRect(ctx, x, y - 8, tw, 16, 8);
        ctx.fillStyle = alpha(th.panel, 0.9); ctx.fill();
        ctx.strokeStyle = alpha(levelColor(th, K[o.named[0].k].grp), 0.7); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = th.text2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 6, y + 0.5);
        ctx.textBaseline = 'alphabetic';
        this.hits.push({ kind: 'level', box: [x, y - 8, tw, 16], text: 'Off screen: ' + o.named.map((m) => K[m.k].name).join(' + ') + ' at ' + fmtPrice(o.p, tick) });
      }
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

    // A series line; with breaks (1 at an index) it starts a new segment there, e.g. where a session VWAP restarts.
    drawLine(ctx, L, arr, color, i0, i1, n, lw, breaks) {
      if (!arr) return;
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = i0; i <= i1; i++) {
        const v = arr[i];
        if (v === undefined || isNaN(v)) { started = false; continue; }
        if (breaks && breaks[i]) started = false;
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
      const bw = Math.max(1, Math.round(this.barW * 0.74));
      const thin = bw < 3;
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
        ctx.globalAlpha = b.hist ? 0.9 : 1;
        ctx.beginPath(); ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl); ctx.stroke();
        if (!thin) {
          const top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yc - yo));
          const bx = x - Math.floor(bw / 2), by = Math.round(top), bh = Math.max(1, Math.round(hgt));
          if (bw >= 6 && bh >= 4) { roundRect(ctx, bx, by, bw, bh, 1.2); ctx.fill(); }
          else ctx.fillRect(bx, by, bw, bh);
        }
        ctx.globalAlpha = 1;
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
      const th = this.th;
      const fills = this.env.fills(s.sym);
      for (const f of fills) {
        if (this.replayT !== null && f.t > this.replayT) continue;
        const x = this.xOf(Math.floor(this.idxOfT(f.t)), L, n);
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
      const list = this.env.rivals(s.sym);
      const th = this.th;
      for (const f of list) {
        // [pid, t, sym, side, qty, px, liq]
        if (this.replayT !== null && f[1] > this.replayT) continue;
        const x = this.xOf(Math.floor(this.idxOfT(f[1])), L, n);
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
      const th = this.th;
      const list = this.env.news(s.sym);
      for (const nw of list) {
        if (this.replayT !== null && nw.t > this.replayT) continue;
        const x = this.xOf(Math.floor(this.idxOfT(nw.t)), L, n);
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

    // Economic calendar: released events as flags at the top, upcoming ones as a dashed line ahead of price.
    drawCalendar(ctx, L, n, s) {
      const raw = this.env.cal ? this.env.cal() : null;
      if (!raw || !raw.length) return;
      const th = this.th, now = this.env.now();
      // Releases at the same minute share one flag. Ones that don't move this symbol stay faint.
      const byT = new Map();
      for (const e0 of raw) {
        const e = Object.assign({}, e0, { rel: !e0.moves || !s || e0.moves.includes(s.sym) });
        const g = byT.get(e.t);
        if (!g) byT.set(e.t, Object.assign(e, { list: [e] }));
        else { g.list.push(e); g.imp = Math.max(g.imp, e.imp); g.name += ' · ' + e.name; g.long += ' · ' + e.long; g.done = g.done && e.done; g.rel = g.rel || e.rel; }
      }
      const cal = [...byT.values()].sort((a, b) => a.t - b.t);
      // Flags sit just under the legend so they never hide behind it.
      const Y0 = (this.legendW2 === undefined || this.legendW2 ? 37 : 20) + 17;
      let lastRight = -1e9, row = 0;
      for (const e of cal) {
        const x = this.xOfT(e.t, L, n) - this.barW / 2;
        if (x < -10 || x > L.plotW + 10) continue;
        const col = !e.rel ? th.text3 : e.imp >= 3 ? th.warn : e.imp === 2 ? th.s4 : th.text3;
        const text = (e.imp >= 3 && e.rel ? '★ ' : '') + e.name;
        ctx.font = FONT_S;
        const tw = ctx.measureText(text).width + 10;
        const lx = clamp(x - tw / 2, 2, L.plotW - tw - 2);
        // Flags that would overlap stack into a second row; a flag also steps down past level labels.
        row = lx < lastRight + 4 ? (row + 1) % 2 : 0;
        let Y = Y0 + row * 17;
        const hitsLabel = (yy) => (this.lvBoxes || []).some((b) => lx < b[0] + b[2] && lx + tw > b[0] && yy - 13 < b[1] + b[3] && yy + 2 > b[1]);
        for (let k = 0; k < 4 && hitsLabel(Y); k++) Y += 17;
        lastRight = Math.max(row ? lastRight : -1e9, lx + tw);
        const up = e.t > now && e.rel;
        ctx.strokeStyle = alpha(col, !e.rel ? 0.25 : up ? 0.8 : 0.45);
        ctx.setLineDash(up ? [4, 3] : [2, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, Y + 2); ctx.lineTo(Math.round(x) + 0.5, L.mainH); ctx.stroke();
        ctx.setLineDash([]);
        roundRect(ctx, lx, Y - 13, tw, 15, 4);
        ctx.fillStyle = alpha(col, up ? 0.9 : !e.rel || e.t < 0 ? 0.12 : 0.25); ctx.fill();
        ctx.fillStyle = up ? '#111' : !e.rel || e.t < 0 ? th.text3 : th.text2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, lx + tw / 2, Y - 5.5);
        ctx.textBaseline = 'alphabetic';
        const detail = e.list.map((x) => x.long + (x.done ? (x.act ? ': ' + x.act + (x.fc ? ' vs ' + x.fc + ' expected' : '') : ': released') : (x.fc ? ', expected ' + x.fc : ''))).join(' · ') + (e.done ? '' : ' · in ' + DTA.fmtHold(Math.max(0, e.t - now)) + ' of market time') + (e.rel ? '' : ' · little effect on ' + s.sym);
        this.hits.push({ kind: 'cal', box: [lx, Y - 13, tw, 15], text: fmtClock(e.t, false) + ' ' + detail });
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
      const pnl = pos.qty * (last - pos.avg) * (s.mult || 1);
      const col = pnl >= 0 ? th.up : th.down;
      let y = this.yOf(pos.avg);
      y = clamp(y, 8, L.mainH - 8);
      ctx.strokeStyle = th.text2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(L.plotW, Math.round(y) + 0.5); ctx.stroke();
      const unit = s.kind === 'future' ? (Math.abs(pos.qty) === 1 ? ' contract' : ' contracts') : '';
      const head = (pos.qty > 0 ? 'LONG ' : 'SHORT ') + fmtQty(Math.abs(pos.qty)) + unit + ' @ ' + fmtPrice(pos.avg, s.tick) + '   ';
      ctx.font = '700 12px system-ui, sans-serif';
      const tw = ctx.measureText(head + fmtSignedMoney(pnl)).width;
      const x = Math.max(8, L.plotW * 0.52 - tw / 2);
      roundRect(ctx, x, y - 11, tw + 16, 22, 5);
      ctx.fillStyle = th.panel; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
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
      const pnl = gp.qty * (s.last * s.tick - gp.avg) * (s.mult || 1);
      const text = gp.name + ' · ' + (gp.qty > 0 ? 'long ' : 'short ') + fmtQty(Math.abs(gp.qty)) + ' @ ' + fmtPrice(gp.avg, s.tick) + ' · ' + fmtSignedMoney(pnl, 0);
      ctx.font = '11px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      const tw = ctx.measureText(text).width;
      const x = L.plotW * 0.3 - tw / 2;
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
          for (let i = i0; i <= i1; i++) { const d = raw[i] ? Math.abs(raw[i].d || 0) / raw[i].dur : 0; if (d > mx) mx = d; }
          const y0 = hgt / 2;
          ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(0, Math.round(y0) + 0.5); ctx.lineTo(L.plotW, Math.round(y0) + 0.5); ctx.stroke();
          const bw = Math.max(1, this.barW * 0.7);
          for (let i = i0; i <= i1; i++) {
            const d = raw[i] ? (raw[i].d || 0) / raw[i].dur : 0;
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
          const dp = Math.max(2, DTA.decimalsForTick(this.env.sym().tick) + 1);
          ctx.fillText('MACD 12 26 9  ' + (isNaN(lv) ? '—' : lv.toFixed(dp)) + '  signal ' + (isNaN(sv) ? '—' : sv.toFixed(dp)), 8, pane.y + 13);
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
      ctx.beginPath(); ctx.moveTo(L.plotW + 0.5, 0); ctx.lineTo(L.plotW + 0.5, L.timeY); ctx.stroke();
      ctx.font = FONT; ctx.fillStyle = th.text3; ctx.textAlign = 'left';
      const step = niceStep(r.max - r.min, Math.max(3, L.mainH / 56));
      const dp = Math.max(DTA.decimalsForTick(s.tick), step < 0.01 ? 3 : step < 1 && DTA.decimalsForTick(s.tick) === 0 ? 1 : 0);
      for (let p = Math.ceil(r.min / step) * step; p <= r.max; p += step) {
        const y = this.yOf(p);
        if (y < 10 || y > L.mainH - 4) continue;
        ctx.fillText(p.toFixed(dp), L.plotW + 8, y + 4);
      }
      // Tags for strong levels on the axis.
      if (this.show.levels && this.lvDrawn) {
        for (const d of this.lvDrawn) {
          if (d.z.s < 0.55 && d.z.n < 2) continue;
          ctx.fillStyle = alpha(d.col, 0.85);
          ctx.fillRect(L.plotW + 1, d.y - 1, 5, 3);
        }
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
      const tStep = this.timeStep(bars, i0, i1);
      const days = this.env.days ? this.env.days() : null;
      let lastX = -1e9;
      for (let i = Math.max(1, i0); i <= i1; i++) {
        const t = bars[i].t, pt = bars[i - 1].t;
        const dayChange = Math.floor(t / 86400) !== Math.floor(pt / 86400);
        if (Math.floor(t / tStep) === Math.floor(pt / tStep) && !dayChange) continue;
        const x = this.xOf(i, L, n) - this.barW / 2;
        if (x < 20 || x > L.plotW - 20 || x - lastX < 56) continue;
        lastX = x;
        if (dayChange && days) { ctx.fillStyle = th.text2; ctx.font = FONT_B; ctx.fillText(Math.floor(t / 86400) < 0 ? days[0] : days[1], x, L.timeY + 15); ctx.font = FONT; ctx.fillStyle = th.text3; }
        else ctx.fillText(fmtClock(Math.floor(t / tStep) * tStep, false), x, L.timeY + 15);
      }
    }

    // The whole timeline in a strip: price as an area, sessions shaded, the visible window as a box.
    drawNav(ctx, L, d, i0, i1, n) {
      const th = this.th, bars = d.bars, kinds = d.kinds;
      const y0 = L.navY, h = L.navH, x0 = 6, x1 = L.w - 6;
      ctx.fillStyle = th.bg; ctx.fillRect(0, y0, L.w, h);
      ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(0, y0 + 0.5); ctx.lineTo(L.w, y0 + 0.5); ctx.stroke();
      if (n < 2) return;
      const nx = (i) => x0 + (i / (n - 1)) * (x1 - x0);
      let lo = Infinity, hi = -Infinity;
      const step = Math.max(1, Math.floor(n / 600));
      for (let i = 0; i < n; i += step) { const c = bars[i].c; if (c < lo) lo = c; if (c > hi) hi = c; }
      if (!(hi > lo)) { hi = lo + 1; }
      const ny = (p) => y0 + 4 + ((hi - p) / (hi - lo)) * (h - 8);
      // Sessions.
      let runStart = null;
      ctx.fillStyle = th.sess;
      for (let i = 0; i < n; i++) {
        const sh = kinds[i] !== 'rth';
        if (sh && runStart === null) runStart = i;
        if ((!sh || i === n - 1) && runStart !== null) { ctx.fillRect(nx(runStart), y0 + 1, Math.max(1, nx(i) - nx(runStart)), h - 1); runStart = null; }
      }
      // Price.
      ctx.beginPath();
      ctx.moveTo(nx(0), ny(bars[0].c));
      for (let i = step; i < n; i += step) ctx.lineTo(nx(i), ny(bars[i].c));
      ctx.lineTo(nx(n - 1), ny(bars[n - 1].c));
      ctx.strokeStyle = alpha(th.text2, 0.8); ctx.lineWidth = 1; ctx.stroke();
      ctx.lineTo(nx(n - 1), y0 + h); ctx.lineTo(nx(0), y0 + h); ctx.closePath();
      ctx.fillStyle = alpha(th.text2, 0.07); ctx.fill();
      // Match start.
      if (d.liveFrom > 0 && d.liveFrom < n) {
        const lx = Math.round(nx(d.liveFrom)) + 0.5;
        ctx.strokeStyle = alpha(th.accent, 0.8); ctx.beginPath(); ctx.moveTo(lx, y0 + 2); ctx.lineTo(lx, y0 + h); ctx.stroke();
      }
      // Window.
      const wx0 = nx(clamp(i0, 0, n - 1)), wx1 = nx(clamp(i1, 0, n - 1));
      ctx.fillStyle = alpha(th.accent, 0.14);
      ctx.fillRect(wx0, y0 + 2, Math.max(4, wx1 - wx0), h - 3);
      ctx.strokeStyle = alpha(th.accent, 0.9); ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.round(wx0) + 0.5, y0 + 2.5, Math.max(4, Math.round(wx1 - wx0)), h - 4);
      L.nav = { x0, x1, n, wx0, wx1 };
    }

    drawCrosshair(ctx, L, bars, n, s) {
      const m = this.mouse;
      if (!m.in || m.x > L.plotW || m.y > L.timeY || this.drag) return;
      const th = this.th;
      ctx.strokeStyle = alpha(th.text2, 0.5); ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.round(m.x) + 0.5, 0); ctx.lineTo(Math.round(m.x) + 0.5, L.timeY);
      if (m.y < L.mainH) { ctx.moveTo(0, Math.round(m.y) + 0.5); ctx.lineTo(L.plotW, Math.round(m.y) + 0.5); }
      ctx.stroke();
      ctx.setLineDash([]);
      if (m.y < L.mainH) this.axisTag(ctx, L, m.y, fmtPrice(this.pOf(m.y), s.tick), th.axis, th.text);
      const i = clamp(Math.round(this.iOf(m.x, L, n)), 0, n - 1 + 200);
      const t = this.tOfIdx(i);
      const days = this.env.days ? this.env.days() : null;
      const text = (days && t < 0 ? days[0] + ' ' : '') + fmtClock(t, this.tf < 60 && !(bars[Math.min(i, n - 1)] || {}).hist);
      ctx.font = FONT;
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = th.axis;
      roundRect(ctx, m.x - w / 2, L.timeY + 3, w, 17, 3); ctx.fill();
      ctx.fillStyle = th.text; ctx.textAlign = 'center';
      ctx.fillText(text, m.x, L.timeY + 15);
    }

    drawLegend(ctx, L, bars, raw, c, n, s, d) {
      const th = this.th;
      const m = this.mouse;
      let i = n - 1;
      if (m.in && m.x < L.plotW && m.y < L.timeY) i = clamp(Math.round(this.iOf(m.x, L, n)), 0, n - 1);
      const b = raw[i];
      const prev = i > 0 ? raw[i - 1].c : s.prev * s.tick;
      const ch = b.c - prev;
      const tfl = b.hist && b.dur !== this.tf ? '1m history' : ((DTA.TIMEFRAMES.find((x) => x.sec === this.tf) || {}).label || this.tf + 's');
      let x = LEGEND_PAD;
      const y = 15;
      // A soft backing so level lines and drawings never cut through the legend text.
      ctx.fillStyle = alpha(th.bg, 0.7);
      roundRect(ctx, 2, 2, Math.min(L.plotW - 4, this.legendW1 || 420), 18, 4); ctx.fill();
      if (this.legendW2) { roundRect(ctx, 2, 21, Math.min(L.plotW - 4, this.legendW2), 16, 4); ctx.fill(); }
      ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = th.text;
      const kind = d.kinds[i];
      const sessName = { rth: '', on: ' · Globex', pre: ' · Premarket', post: ' · After the close', closed: '' }[kind] || '';
      const head = s.sym + ' · ' + tfl + sessName;
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
      const chText = (ch >= 0 ? '+' : DTA.MINUS) + Math.abs(ch).toFixed(DTA.decimalsForTick(s.tick)) + ' (' + DTA.fmtPct(ch / prev) + ')';
      ctx.fillText(chText, x, y);
      this.legendW1 = x + ctx.measureText(chText).width + 6;
      // Indicator legend: swatch + name + value (text stays in text colours).
      const items = [];
      if (this.show.vwap) items.push([th.s4, 'VWAP', c.vwap.v[i]]);
      if (this.show.ema9) items.push([th.s1, 'EMA 9', c.ema9[i]]);
      if (this.show.ema20) items.push([th.s7, 'EMA 20', c.ema20[i]]);
      if (this.show.ema50) items.push([th.s5, 'EMA 50', c.ema50[i]]);
      if (this.show.bb) items.push([th.s3, 'BB 20 2', c.bb.mid[i]]);
      const ly = 32;
      x = LEGEND_PAD;
      for (const [color, name, v] of items) {
        ctx.fillStyle = color; ctx.fillRect(x, ly - 7, 10, 3);
        ctx.fillStyle = th.text3; ctx.fillText(name, x + 14, ly - 2);
        const nw = ctx.measureText(name).width;
        ctx.fillStyle = th.text2; ctx.fillText(isNaN(v) ? '—' : fmtPrice(v, s.tick), x + 18 + nw, ly - 2);
        x += 18 + nw + ctx.measureText(isNaN(v) ? '—' : fmtPrice(v, s.tick)).width + 14;
      }
      this.legendW2 = items.length ? x - 6 : 0;
      // Hover tooltip for markers and levels.
      if (m.in && !this.drag) {
        const hit = this.hitAt(m.x, m.y, ['fill', 'rival', 'news', 'cancel', 'big', 'level', 'cal']);
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
      const th = this.th;
      const xt = (t) => this.xOfT(t, L, n);
      for (const d of this.list(s.sym)) {
        const sel = this.selected === d;
        const col = d.type === 'alert' ? th.warn : th.accent;
        ctx.strokeStyle = sel ? th.text : col; ctx.lineWidth = sel ? 2 : 1.25;
        ctx.fillStyle = col;
        if (d.type === 'hline' || d.type === 'alert') {
          const y = Math.round(this.yOf(d.p1.price)) + 0.5;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.plotW, y); ctx.stroke();
          ctx.font = FONT_B; ctx.textAlign = 'left';
          ctx.fillText((d.type === 'alert' ? '🔔 ' : '') + fmtPrice(d.p1.price, s.tick), 8, y - 4);
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
      const th = this.th;
      const xt = (t) => this.xOfT(t, L, n);
      const m = this.mouse;
      const p2 = { t: this.tOfIdx(this.iOf(m.x, L, n)), price: this.pOf(m.y) };
      ctx.strokeStyle = th.accent; ctx.lineWidth = 1.25;
      if (p.type === 'measure') {
        const x0 = xt(p.p1.t), y0 = this.yOf(p.p1.price);
        const up = p2.price >= p.p1.price;
        ctx.fillStyle = alpha(up ? th.up : th.down, 0.12);
        ctx.fillRect(Math.min(x0, m.x), Math.min(y0, m.y), Math.abs(m.x - x0), Math.abs(m.y - y0));
        const dp = p2.price - p.p1.price;
        const nb = Math.round(this.iOf(m.x, L, n) - this.idxOfT(p.p1.t));
        const ticks = Math.round(Math.abs(dp) / s.tick);
        const money = s.mult && s.mult > 1 ? ' · ' + DTA.fmtMoney(Math.abs(dp) * s.mult, 0) + ' a contract' : '';
        const text = (dp >= 0 ? '+' : DTA.MINUS) + Math.abs(dp).toFixed(DTA.decimalsForTick(s.tick)) + ' (' + DTA.fmtPct(dp / p.p1.price) + ', ' + ticks + ' ticks' + money + ') · ' + nb + ' bars · ' + DTA.fmtHold(Math.abs(p2.t - p.p1.t));
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
        if ((h.kind === 'level' || h.kind === 'cal') && h.box) { const [bx, by, bw, bh] = h.box; if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return h; }
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
      cv.addEventListener('dblclick', (e) => { const p = this.pos(e); if (this.layout && p.x > this.layout.plotW && p.y < this.layout.mainH) this.yMan = null; else this.resetView(); });
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
        if (e.touches.length === 2 && this.pinch) { e.preventDefault(); this.barW = clamp(this.pinch.w * touchDist(e) / this.pinch.d, 0.6, 42); this.dirty = true; }
      }, { passive: false });
      cv.addEventListener('touchend', () => { this.pinch = null; });
    }

    // Keyboard panning and zooming (arrows, Home/End), called by the game screen.
    key(k) {
      const n = this.cache.bars.length;
      if (!this.layout || !n) return false;
      const vis = this.layout.plotW / this.barW;
      const r = this.rightIndex(n);
      const follow = n - 1 + Math.max(4, 70 / this.barW);
      if (k === 'ArrowLeft') this.right = r - vis * 0.25;
      else if (k === 'ArrowRight') { const nr = r + vis * 0.25; this.right = nr >= follow ? null : nr; }
      else if (k === 'ArrowUp') this.barW = clamp(this.barW * 1.2, 0.6, 42);
      else if (k === 'ArrowDown') this.barW = clamp(this.barW / 1.2, 0.6, 42);
      else if (k === 'End') this.right = null;
      else if (k === 'Home') this.right = Math.min(follow, vis - 2);
      else return false;
      this.dirty = true;
      return true;
    }

    navTo(x) {
      const nv = this.layout && this.layout.nav;
      if (!nv) return;
      const n = this.cache.bars.length;
      const i = clamp(((x - nv.x0) / (nv.x1 - nv.x0)) * (nv.n - 1), 0, n - 1);
      const vis = this.layout.plotW / this.barW;
      const r = i + vis / 2;
      this.right = r >= n - 1 + Math.max(4, 70 / this.barW) - 1 ? null : r;
      this.dirty = true;
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
        } else if (d.kind === 'nav') {
          this.navTo(p.x - d.off);
        } else if (d.kind === 'axis') {
          const f = Math.exp((p.y - d.y0) / 150);
          const mid = (d.min0 + d.max0) / 2, half = (d.max0 - d.min0) / 2 * f;
          this.yMan = { min: mid - half, max: mid + half };
        } else if (d.kind === 'order') {
          const s = this.env.sym();
          d.px = Math.round(this.pOf(p.y) / s.tick) * s.tick;
        } else if (d.kind === 'drawing' && (d.d.type === 'hline' || d.d.type === 'alert')) {
          d.d.p1.price = this.pOf(p.y);
        }
        return;
      }
      // Cursor feedback.
      if (this.tool) { this.cv.style.cursor = 'crosshair'; return; }
      if (L.navH && p.y >= L.navY) { this.cv.style.cursor = 'grab'; return; }
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
      if (L.navH && p.y >= L.navY && L.nav) {
        const nv = L.nav;
        const inside = p.x >= nv.wx0 - 2 && p.x <= nv.wx1 + 2;
        const mid = (nv.wx0 + nv.wx1) / 2;
        this.drag = { kind: 'nav', off: inside ? p.x - mid : 0 };
        if (!inside) this.navTo(p.x);
        return;
      }
      if (this.o.replay && this.replayT !== null && !this.tool) { this.drag = { kind: 'pan', x0: p.x, right0: this.rightIndex(this.cache.bars.length) }; return; }
      const s = this.env.sym();
      const n = this.cache.bars.length;
      if (this.tool && p.x < L.plotW && p.y < L.mainH) {
        const pt = { t: this.tOfIdx(this.iOf(p.x, L, n)), price: this.pOf(p.y) };
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
        const nw = clamp(this.barW * f, 0.6, 42);
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
