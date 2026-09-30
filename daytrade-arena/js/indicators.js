// Day Trade Arena: candle aggregation and technical indicators. Used by the charts and by the bots.
// Base bars arrive as [o, h, l, c, v] in price ticks, one per 5 market seconds. Aggregated bars are
// {t, o, h, l, c, v} in prices, where t is the market time the bar opens.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const BAR_SEC = DTA.BAR_SEC;

  function aggregate(base, tick, start, tfSec, fromBase, out) {
    const k = Math.max(1, Math.round(tfSec / BAR_SEC));
    out = out || [];
    let i = Math.floor((fromBase || 0) / k) * k;
    out.length = Math.floor(i / k);
    for (; i < base.length; i += k) {
      const b0 = base[i];
      let o = b0[0], h = b0[1], l = b0[2], c = b0[3], v = b0[4];
      const end = Math.min(base.length, i + k);
      for (let j = i + 1; j < end; j++) {
        const b = base[j];
        if (b[1] > h) h = b[1];
        if (b[2] < l) l = b[2];
        c = b[3]; v += b[4];
      }
      out.push({ t: start + i * BAR_SEC, o: o * tick, h: h * tick, l: l * tick, c: c * tick, v, n: end - i });
    }
    return out;
  }

  // Incremental aggregator: rebuilds only from the first changed base bar.
  class Agg {
    constructor(tfSec) { this.tf = tfSec; this.bars = []; this.seen = 0; }
    update(base, tick, start, changedFrom) {
      const from = Math.max(0, Math.min(changedFrom === undefined ? this.seen : changedFrom, this.seen));
      aggregate(base, tick, start, this.tf, Math.max(0, from - 1), this.bars);
      this.seen = base.length;
      return this.bars;
    }
    reset() { this.bars = []; this.seen = 0; }
  }

  const closes = (bars) => bars.map((b) => b.c);

  function sma(src, n) {
    const out = new Array(src.length).fill(NaN);
    let s = 0;
    for (let i = 0; i < src.length; i++) {
      s += src[i];
      if (i >= n) s -= src[i - n];
      if (i >= n - 1) out[i] = s / n;
    }
    return out;
  }

  function ema(src, n) {
    const out = new Array(src.length).fill(NaN);
    if (!src.length) return out;
    const k = 2 / (n + 1);
    let e = src[0];
    for (let i = 0; i < src.length; i++) {
      e = i === 0 ? src[0] : src[i] * k + e * (1 - k);
      out[i] = e;
    }
    return out;
  }

  function bollinger(src, n = 20, mult = 2) {
    const mid = sma(src, n), up = new Array(src.length).fill(NaN), lo = new Array(src.length).fill(NaN);
    for (let i = n - 1; i < src.length; i++) {
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += (src[j] - mid[i]) ** 2;
      const sd = Math.sqrt(s / n);
      up[i] = mid[i] + mult * sd;
      lo[i] = mid[i] - mult * sd;
    }
    return { mid, up, lo };
  }

  function rsi(src, n = 14) {
    const out = new Array(src.length).fill(NaN);
    let g = 0, l = 0;
    for (let i = 1; i < src.length; i++) {
      const d = src[i] - src[i - 1];
      const up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
      if (i <= n) {
        g += up; l += dn;
        if (i === n) { g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
      } else {
        g = (g * (n - 1) + up) / n;
        l = (l * (n - 1) + dn) / n;
        out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
      }
    }
    return out;
  }

  function macd(src, f = 12, s = 26, sig = 9) {
    const ef = ema(src, f), es = ema(src, s);
    const line = src.map((_, i) => ef[i] - es[i]);
    const signal = ema(line.map((v) => (isNaN(v) ? 0 : v)), sig);
    const hist = line.map((v, i) => v - signal[i]);
    return { line, signal, hist };
  }

  function atr(bars, n = 14) {
    const out = new Array(bars.length).fill(NaN);
    let a = 0;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const tr = i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c));
      if (i < n) { a += tr; if (i === n - 1) { a /= n; out[i] = a; } else out[i] = a / (i + 1); }
      else { a = (a * (n - 1) + tr) / n; out[i] = a; }
    }
    return out;
  }

  // Session VWAP with 1σ and 2σ volume-weighted bands.
  function vwap(bars) {
    const n = bars.length;
    const v = new Array(n).fill(NaN), u1 = new Array(n).fill(NaN), l1 = new Array(n).fill(NaN), u2 = new Array(n).fill(NaN), l2 = new Array(n).fill(NaN);
    let pv = 0, vv = 0, p2v = 0;
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const tp = (b.h + b.l + b.c) / 3;
      pv += tp * b.v; vv += b.v; p2v += tp * tp * b.v;
      if (vv > 0) {
        const w = pv / vv;
        const sd = Math.sqrt(Math.max(0, p2v / vv - w * w));
        v[i] = w; u1[i] = w + sd; l1[i] = w - sd; u2[i] = w + 2 * sd; l2[i] = w - 2 * sd;
      } else if (i > 0) { v[i] = v[i - 1]; u1[i] = u1[i - 1]; l1[i] = l1[i - 1]; u2[i] = u2[i - 1]; l2[i] = l2[i - 1]; }
    }
    return { v, u1, l1, u2, l2 };
  }

  function heikinAshi(bars) {
    const out = [];
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const c = (b.o + b.h + b.l + b.c) / 4;
      const o = i === 0 ? (b.o + b.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2;
      out.push({ t: b.t, o, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c), c, v: b.v });
    }
    return out;
  }

  function donchian(bars, n, i) {
    let hi = -Infinity, lo = Infinity;
    for (let j = Math.max(0, i - n); j < i; j++) { if (bars[j].h > hi) hi = bars[j].h; if (bars[j].l < lo) lo = bars[j].l; }
    return { hi, lo };
  }

  // Volume at price for bars in [from, to). Each bar's volume is spread evenly over its range.
  function volumeProfile(bars, from, to, lo, hi, nBins) {
    const bins = new Array(nBins).fill(0);
    const w = (hi - lo) / nBins || 1;
    let total = 0;
    for (let i = Math.max(0, from); i < Math.min(bars.length, to); i++) {
      const b = bars[i];
      if (!b.v) continue;
      const a = Math.max(0, Math.floor((b.l - lo) / w)), z = Math.min(nBins - 1, Math.floor((b.h - lo) / w));
      if (z < 0 || a > nBins - 1) continue;
      const share = b.v / (z - a + 1);
      for (let k = a; k <= z; k++) bins[k] += share;
      total += b.v;
    }
    let poc = 0;
    for (let k = 1; k < nBins; k++) if (bins[k] > bins[poc]) poc = k;
    // Value area: grow outward from the POC until 70% of the volume is inside.
    let vaLo = poc, vaHi = poc, inside = bins[poc];
    while (inside < total * 0.7 && (vaLo > 0 || vaHi < nBins - 1)) {
      const dn = vaLo > 0 ? bins[vaLo - 1] : -1, up = vaHi < nBins - 1 ? bins[vaHi + 1] : -1;
      if (up >= dn) { vaHi++; inside += bins[vaHi]; } else { vaLo--; inside += bins[vaLo]; }
    }
    return { bins, w, lo, poc, vaLo, vaHi, total };
  }

  // Default candle size: aims for a new candle roughly every 2.5 real seconds.
  function defaultTf(speed) {
    const want = speed * 2.5;
    let best = DTA.TIMEFRAMES[0];
    for (const tf of DTA.TIMEFRAMES) if (Math.abs(Math.log(tf.sec / want)) < Math.abs(Math.log(best.sec / want))) best = tf;
    return best.sec;
  }

  DTA.ind = { aggregate, Agg, closes, sma, ema, bollinger, rsi, macd, atr, vwap, heikinAshi, donchian, volumeProfile, defaultTf };
})();
