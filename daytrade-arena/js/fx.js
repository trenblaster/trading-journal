// Day Trade Arena: effects. Confetti and floating P&L text on an overlay canvas, the animated candle
// background on the home screen, and number tweening. Everything respects "reduce motion".
(function () {
  'use strict';
  const DTA = window.DTA;
  const { fitCanvas, alpha, clamp } = DTA;

  const reduced = () => DTA.settings && DTA.settings.reduceMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  class Overlay {
    constructor(canvas) { this.cv = canvas; this.parts = []; this.texts = []; this.running = false; }
    start() { if (!this.running) { this.running = true; requestAnimationFrame((t) => this.frame(t)); } }
    confetti(x, y, n, colors) {
      if (reduced()) return;
      colors = colors || DTA.PLAYER_COLORS;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8;
        this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, g: 0.28, life: 1, decay: 0.006 + Math.random() * 0.01, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length] });
      }
      this.start();
    }
    rain(n) {
      if (reduced()) return;
      const w = window.innerWidth;
      for (let i = 0; i < n; i++) this.parts.push({ x: Math.random() * w, y: -20 - Math.random() * 300, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, g: 0.05, life: 1, decay: 0.003 + Math.random() * 0.004, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: DTA.PLAYER_COLORS[i % 8] });
      this.start();
    }
    floatText(x, y, text, color, size) {
      this.texts.push({ x, y, text, color, size: size || 18, life: 1, vy: reduced() ? 0 : -0.9 });
      this.start();
    }
    frame() {
      const { ctx, w, h } = fitCanvas(this.cv);
      ctx.clearRect(0, 0, w, h);
      this.parts = this.parts.filter((p) => p.life > 0 && p.y < h + 40);
      for (const p of this.parts) {
        p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = clamp(p.life * 1.5, 0, 1);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const t of this.texts) {
        t.y += t.vy; t.life -= 0.012;
        ctx.globalAlpha = clamp(t.life * 2, 0, 1);
        ctx.font = '800 ' + t.size + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1;
      }
      if (this.parts.length || this.texts.length) requestAnimationFrame((tt) => this.frame(tt));
      else { this.running = false; ctx.clearRect(0, 0, w, h); }
    }
  }

  // Scrolling candles for the home screen. Pure decoration: a seeded random walk with trends.
  class CandleBackdrop {
    constructor(canvas) {
      this.cv = canvas; this.bars = []; this.offset = 0; this.running = false; this.rng = new DTA.RNG(Date.now() >>> 0);
      this.p = 100; this.trend = 0; this.last = 0;
      for (let i = 0; i < 160; i++) this.push();
    }
    push() {
      const r = this.rng;
      if (r.chance(0.06)) this.trend = r.normal() * 0.25;
      const o = this.p;
      let hi = o, lo = o, c = o;
      for (let k = 0; k < 6; k++) { c += this.trend * 0.2 + r.normal() * 0.35; hi = Math.max(hi, c); lo = Math.min(lo, c); }
      this.p = c;
      this.bars.push({ o, h: hi + Math.abs(r.normal()) * 0.2, l: lo - Math.abs(r.normal()) * 0.2, c, v: 0.3 + Math.abs(r.normal()) });
      if (this.bars.length > 220) this.bars.shift();
    }
    start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this.frame(t)); }
    stop() { this.running = false; }
    frame(t) {
      if (!this.running) return;
      if (!this.cv.isConnected || this.cv.offsetParent === null) { this.running = false; return; }
      const dt = Math.min(100, t - this.last); this.last = t;
      const { ctx, w, h } = fitCanvas(this.cv);
      const th = DTA.chartTheme();
      const bw = 12;
      if (!reduced()) this.offset += dt * 0.02;
      while (this.offset >= bw) { this.offset -= bw; this.push(); }
      ctx.clearRect(0, 0, w, h);
      const n = Math.min(this.bars.length, Math.ceil(w / bw) + 2);
      const vis = this.bars.slice(-n);
      let lo = Infinity, hi = -Infinity;
      for (const b of vis) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); }
      const y = (p) => h * 0.12 + (hi - p) / (hi - lo || 1) * h * 0.66;
      // grid glow
      ctx.strokeStyle = alpha(th.text, 0.035); ctx.lineWidth = 1; ctx.beginPath();
      for (let gy = 0; gy < h; gy += 48) { ctx.moveTo(0, gy + 0.5); ctx.lineTo(w, gy + 0.5); }
      for (let gx = -this.offset % 48; gx < w; gx += 48) { ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, h); }
      ctx.stroke();
      vis.forEach((b, i) => {
        const x = w - (vis.length - i) * bw - this.offset + bw;
        const up = b.c >= b.o;
        const col = up ? th.up : th.down;
        const fade = clamp(i / vis.length, 0.08, 1) * 0.55;
        ctx.globalAlpha = fade;
        ctx.strokeStyle = col; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x + 0.5, y(b.h)); ctx.lineTo(x + 0.5, y(b.l)); ctx.stroke();
        ctx.fillRect(x - 4, Math.min(y(b.o), y(b.c)), 9, Math.max(1, Math.abs(y(b.o) - y(b.c))));
        ctx.globalAlpha = fade * 0.5;
        ctx.fillRect(x - 4, h - b.v * 30, 9, b.v * 30);
      });
      ctx.globalAlpha = 1;
      const lb = vis[vis.length - 1];
      const ly = y(lb.c);
      const col = lb.c >= lb.o ? th.up : th.down;
      const gr = ctx.createRadialGradient(w - this.offset, ly, 0, w - this.offset, ly, 60);
      gr.addColorStop(0, alpha(col, 0.35)); gr.addColorStop(1, alpha(col, 0));
      ctx.fillStyle = gr; ctx.fillRect(w - 200, ly - 60, 260, 120);
      const fadeG = ctx.createLinearGradient(0, 0, w, 0);
      fadeG.addColorStop(0, th.bg); fadeG.addColorStop(0.25, alpha(th.bg, 0));
      ctx.fillStyle = fadeG; ctx.fillRect(0, 0, w, h);
      requestAnimationFrame((tt) => this.frame(tt));
    }
  }

  // Tween a number shown in an element.
  const tweens = new WeakMap();
  function tweenNumber(elNode, to, fmt, ms) {
    const cur = tweens.get(elNode);
    const from = cur ? cur.value : to;
    if (reduced() || Math.abs(to - from) < 1e-9) { tweens.set(elNode, { value: to }); elNode.textContent = fmt(to); return; }
    const st = { value: from, to, t0: performance.now(), ms: ms || 400 };
    tweens.set(elNode, st);
    const step = (t) => {
      if (tweens.get(elNode) !== st) return;
      const k = clamp((t - st.t0) / st.ms, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      st.value = from + (to - from) * e;
      elNode.textContent = fmt(st.value);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  DTA.fx = { Overlay, CandleBackdrop, tweenNumber, reduced };
})();
