// Procedurally drawn sprites for Revision Rally. Each sprite is an offscreen canvas plus
// `ww`, its width in world units as a fraction of the road's half-width.
(function () {
  function make(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h); return c;
  }
  const rr = (x, a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };

  // Kart seen from behind. lean: -1 left, 0 straight, 1 right.
  function kart(color, helmet, lean) {
    return make(160, 112, (x, w, h) => {
      x.translate(w / 2, h); x.rotate(lean * 0.04); x.translate(-w / 2, -h);
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(80, 104, 70, 8, 0, 0, Math.PI * 2); x.fill();
      // rear tyres
      for (const tx of [8, 118]) { x.fillStyle = '#1d1b22'; rr(x, tx, 62, 34, 42, 8); x.fill(); x.fillStyle = '#3b3842'; x.fillRect(tx + 4, 70, 26, 4); x.fillRect(tx + 4, 82, 26, 4); x.fillRect(tx + 4, 94, 26, 4); }
      // body
      const g = x.createLinearGradient(0, 40, 0, 100); g.addColorStop(0, shade(color, 0.25)); g.addColorStop(1, shade(color, -0.35));
      x.fillStyle = g; x.beginPath(); x.moveTo(30, 96); x.lineTo(40, 58); x.lineTo(120, 58); x.lineTo(130, 96); x.closePath(); x.fill();
      x.fillStyle = shade(color, -0.5); x.fillRect(34, 88, 92, 8);
      // exhaust + lights
      x.fillStyle = '#9a9aa6'; rr(x, 58, 88, 12, 10, 4); x.fill(); rr(x, 90, 88, 12, 10, 4); x.fill();
      x.fillStyle = '#ff5a5a'; rr(x, 40, 70, 16, 8, 3); x.fill(); rr(x, 104, 70, 16, 8, 3); x.fill();
      // rear wing
      x.fillStyle = '#26232d'; x.fillRect(54, 34, 6, 26); x.fillRect(100, 34, 6, 26);
      x.fillStyle = shade(color, 0.1); rr(x, 24, 24, 112, 14, 4); x.fill(); x.fillStyle = shade(color, -0.3); x.fillRect(24, 34, 112, 4);
      // driver helmet
      const hg = x.createRadialGradient(74, 30, 4, 80, 38, 26); hg.addColorStop(0, shade(helmet, 0.5)); hg.addColorStop(1, helmet);
      x.fillStyle = hg; x.beginPath(); x.arc(80, 42, 22, Math.PI, 0); x.lineTo(102, 56); x.lineTo(58, 56); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(64, 44, 32, 3);
    });
  }

  const tree = make(160, 200, (x) => {
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(80, 194, 52, 8, 0, 0, 7); x.fill();
    x.fillStyle = '#6b4220'; x.fillRect(70, 120, 20, 76);
    const blob = (cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
    blob(80, 90, 62, '#2f7a3a'); blob(50, 110, 40, '#2f7a3a'); blob(112, 108, 40, '#2f7a3a');
    blob(76, 78, 46, '#3f9a48'); blob(104, 96, 30, '#3f9a48'); blob(62, 64, 20, '#5bb85e');
  });
  const pine = make(120, 220, (x) => {
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(60, 214, 40, 6, 0, 0, 7); x.fill();
    x.fillStyle = '#5d371b'; x.fillRect(52, 170, 16, 46);
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#1f5a3a' : '#2c7449'; x.beginPath(); x.moveTo(60, 10 + i * 40); x.lineTo(60 - 30 - i * 8, 90 + i * 30); x.lineTo(60 + 30 + i * 8, 90 + i * 30); x.closePath(); x.fill(); }
  });
  const palm = make(160, 240, (x) => {
    x.strokeStyle = '#8a5a30'; x.lineWidth = 14; x.beginPath(); x.moveTo(84, 236); x.quadraticCurveTo(64, 140, 86, 60); x.stroke();
    x.fillStyle = '#2e8b57';
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.6; x.save(); x.translate(86, 60); x.rotate(a); x.beginPath(); x.ellipse(40, 0, 44, 11, 0.25, 0, 7); x.fill(); x.restore(); }
    x.fillStyle = '#6b4220'; x.beginPath(); x.arc(80, 66, 7, 0, 7); x.arc(92, 68, 7, 0, 7); x.fill();
  });
  const cactus = make(100, 170, (x) => {
    x.fillStyle = '#3f8f4a'; rr(x, 38, 20, 24, 150, 12); x.fill(); rr(x, 10, 60, 18, 50, 9); x.fill(); rr(x, 72, 44, 18, 56, 9); x.fill();
    x.fillRect(20, 96, 24, 12); x.fillRect(56, 88, 26, 12);
    x.fillStyle = '#5bb85e'; x.fillRect(44, 24, 4, 140);
  });
  const rock = make(140, 90, (x) => {
    x.fillStyle = '#8a6f55'; x.beginPath(); x.moveTo(10, 88); x.lineTo(24, 30); x.lineTo(60, 8); x.lineTo(104, 22); x.lineTo(132, 88); x.closePath(); x.fill();
    x.fillStyle = '#a88a6c'; x.beginPath(); x.moveTo(24, 30); x.lineTo(60, 8); x.lineTo(70, 50); x.lineTo(30, 60); x.closePath(); x.fill();
  });
  const bush = make(120, 70, (x) => {
    const blob = (cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
    blob(30, 50, 26, '#3f9a48'); blob(64, 40, 32, '#3f9a48'); blob(94, 50, 24, '#3f9a48'); blob(56, 30, 14, '#5bb85e');
    x.fillStyle = '#ff7aa2'; for (const [a, b] of [[40, 34], [74, 28], [90, 44]]) { x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); }
  });
  const lamp = make(60, 240, (x) => {
    x.fillStyle = '#3d404b'; x.fillRect(26, 40, 8, 200); x.fillRect(26, 36, 30, 6);
    const g = x.createRadialGradient(52, 50, 2, 52, 50, 26); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    x.fillStyle = g; x.fillRect(20, 20, 40, 60); x.fillStyle = '#fff6c2'; x.fillRect(46, 42, 12, 8);
  });
  function building(seed) {
    return make(200, 320, (x) => {
      const cols = ['#2b3a5c', '#3a2b5c', '#1f4a55', '#4a3b2b'];
      x.fillStyle = cols[seed % 4]; x.fillRect(10, 20 + (seed % 3) * 30, 180, 300);
      for (let r = 0; r < 12; r++) for (let c = 0; c < 6; c++) {
        const lit = ((seed * 7 + r * 13 + c * 5) % 5) > 1;
        x.fillStyle = lit ? '#ffe28a' : '#1a2238'; x.fillRect(24 + c * 27, 40 + (seed % 3) * 30 + r * 23, 14, 12);
      }
    });
  }
  const boxFrames = [0, 1, 2, 3].map((f) => make(96, 96, (x) => {
    const glow = x.createRadialGradient(48, 48, 10, 48, 48, 48); glow.addColorStop(0, 'rgba(255,230,120,0.7)'); glow.addColorStop(1, 'rgba(255,230,120,0)');
    x.fillStyle = glow; x.fillRect(0, 0, 96, 96);
    const s = 1 - Math.abs(Math.sin(f * Math.PI / 4)) * 0.25;
    x.translate(48, 50); x.scale(s, 1);
    const g = x.createLinearGradient(-30, -30, 30, 30); g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#e8a318');
    x.fillStyle = g; rr(x, -30, -30, 60, 60, 10); x.fill();
    x.strokeStyle = '#fff6c2'; x.lineWidth = 3; rr(x, -26, -26, 52, 52, 8); x.stroke();
    x.fillStyle = '#7a3e00'; x.font = 'bold 44px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 0, 3);
  }));
  function sign(text, bg, fg) {
    return make(260, 170, (x) => {
      x.fillStyle = '#5d371b'; x.fillRect(40, 90, 14, 80); x.fillRect(206, 90, 14, 80);
      x.fillStyle = bg; rr(x, 6, 6, 248, 96, 10); x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 5; rr(x, 12, 12, 236, 84, 8); x.stroke();
      x.fillStyle = fg; x.font = 'bold 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 130, 56);
    });
  }
  function arrowSign(dir) {
    return make(120, 140, (x) => {
      x.fillStyle = '#3d404b'; x.fillRect(54, 80, 12, 60);
      x.fillStyle = '#ffffff'; rr(x, 6, 6, 108, 80, 8); x.fill();
      x.fillStyle = '#d9546b'; for (let i = 0; i < 3; i++) { x.beginPath(); const bx = 20 + i * 28; if (dir > 0) { x.moveTo(bx, 20); x.lineTo(bx + 22, 46); x.lineTo(bx, 72); x.lineTo(bx + 10, 46); } else { x.moveTo(bx + 22, 20); x.lineTo(bx, 46); x.lineTo(bx + 22, 72); x.lineTo(bx + 12, 46); } x.closePath(); x.fill(); }
    });
  }
  const startArch = make(640, 260, (x) => {
    x.fillStyle = '#3d404b'; x.fillRect(0, 40, 28, 220); x.fillRect(612, 40, 28, 220);
    x.fillStyle = '#2b2233'; x.fillRect(0, 20, 640, 70);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#ffffff' : '#111'; x.fillRect(i * 20, 20 + j * 12, 20, 12); }
    x.fillStyle = '#ffd23f'; x.font = 'bold 34px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('REVISION RALLY', 320, 78);
  });

  window.Sprites = {
    kart, shade,
    tree: { c: tree, ww: 0.9 }, pine: { c: pine, ww: 0.7 }, palm: { c: palm, ww: 0.9 }, cactus: { c: cactus, ww: 0.45 },
    rock: { c: rock, ww: 0.7 }, bush: { c: bush, ww: 0.6 }, lamp: { c: lamp, ww: 0.25 },
    buildings: [0, 1, 2, 3, 4, 5].map((s) => ({ c: building(s), ww: 1.4 })),
    box: boxFrames, boxWW: 0.2,
    signs: {
      econ: { c: sign('ECONOMICS', '#c7485f', '#fff'), ww: 0.9 }, acc: { c: sign('ACCOUNTING', '#1f7f72', '#fff'), ww: 0.9 },
      eng: { c: sign('ENGLISH', '#6c4f9e', '#fff'), ww: 0.9 }, left: { c: arrowSign(-1), ww: 0.45 }, right: { c: arrowSign(1), ww: 0.45 }
    },
    arch: { c: startArch, ww: 2.3 }
  };
})();
