// Road geometry for a pseudo-3D racer: the track is a list of segments, each with a curve
// amount and a height, projected to the screen every frame.
(function () {
  const SEG = 200;          // segment length in world units
  const RUMBLE = 3;         // segments per rumble strip colour band
  const LEN = { S: 25, M: 50, L: 100 };
  const CURVE = { E: 2, M: 4, H: 6 };
  const HILL = { L: 20, M: 40, H: 60 };

  const easeIn = (a, b, p) => a + (b - a) * Math.pow(p, 2);
  const easeInOut = (a, b, p) => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);

  function Builder() {
    const segs = [];
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
    function add(curve, y) {
      const n = segs.length;
      segs.push({
        index: n, curve, sprites: [], cars: [], boxes: null,
        p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
        p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
        band: Math.floor(n / RUMBLE) % 2
      });
    }
    function road(enter, hold, leave, curve, hill) {
      const y0 = lastY(), y1 = y0 + (hill || 0) * SEG, total = enter + hold + leave;
      for (let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter), easeInOut(y0, y1, i / total));
      for (let i = 0; i < hold; i++) add(curve, easeInOut(y0, y1, (enter + i) / total));
      for (let i = 0; i < leave; i++) add(easeInOut(curve, 0, i / leave), easeInOut(y0, y1, (enter + hold + i) / total));
    }
    const api = {
      segs,
      straight: (n = LEN.M) => road(n, n, n, 0, 0),
      curve: (n = LEN.M, c = CURVE.M, h = 0) => road(n, n, n, c, h),
      hill: (n = LEN.M, h = HILL.M) => road(n, n, n, 0, h),
      scurves: () => { road(LEN.M, LEN.M, LEN.M, -CURVE.E, 0); road(LEN.M, LEN.M, LEN.M, CURVE.M, 0); road(LEN.M, LEN.M, LEN.M, CURVE.E, 0); road(LEN.M, LEN.M, LEN.M, -CURVE.E, 0); road(LEN.M, LEN.M, LEN.M, -CURVE.M, 0); },
      bumps: () => { road(10, 10, 10, 0, 5); road(10, 10, 10, 0, -2); road(10, 10, 10, 0, -5); road(10, 10, 10, 0, 8); road(10, 10, 10, 0, 5); road(10, 10, 10, 0, -7); road(10, 10, 10, 0, 5); road(10, 10, 10, 0, -2); },
      downToEnd: (n = 200) => road(n, n, n, -CURVE.E, -lastY() / SEG)
    };
    return api;
  }

  const THEMES = {
    meadow: { sky: ['#5fb4ee', '#d8f1ff'], hills: ['#8fcf7a', '#5fa65a'], far: '#a9d6ef', grass: ['#79c257', '#6db64d'], rumble: ['#ffffff', '#d9546b'], road: ['#707078', '#6a6a72'], lane: '#ffffff', fog: '#d8f1ff', decor: ['tree', 'tree', 'bush', 'pine'] },
    canyon: { sky: ['#f29a4a', '#ffe0a8'], hills: ['#c9784a', '#a55a36'], far: '#e8b27c', grass: ['#e3b76f', '#d9aa60'], rumble: ['#ffffff', '#b33a2e'], road: ['#7a6a5c', '#736356'], lane: '#fff3c4', fog: '#ffe0a8', decor: ['cactus', 'rock', 'cactus', 'rock'] },
    coast: { sky: ['#3fa6e0', '#bfeaff'], hills: ['#3aa0c9', '#2a86b0'], far: '#7cc7e8', grass: ['#f0dca0', '#e8d292'], rumble: ['#ffffff', '#2a86b0'], road: ['#6f7478', '#696e72'], lane: '#ffffff', fog: '#bfeaff', decor: ['palm', 'palm', 'bush', 'rock'] },
    city: { sky: ['#0b1030', '#2a2a5a'], hills: ['#1a1d3a', '#12142a'], far: '#20244a', grass: ['#1f2a33', '#1a242c'], rumble: ['#ffd23f', '#3d404b'], road: ['#3a3d46', '#363941'], lane: '#ffd23f', fog: '#1d2045', decor: ['lamp', 'building', 'lamp', 'building'], night: true }
  };

  const TRACKS = [
    { id: 'meadow', name: 'Market Meadows', blurb: 'Gentle curves and rolling hills. A good first race.', laps: 3,
      build(b) { b.straight(LEN.S); b.curve(LEN.M, CURVE.M); b.hill(LEN.M, HILL.L); b.curve(LEN.M, -CURVE.E, HILL.L); b.straight(LEN.M); b.curve(LEN.L, CURVE.M, -HILL.L); b.bumps(); b.curve(LEN.M, -CURVE.M); b.hill(LEN.M, HILL.M); b.curve(LEN.M, CURVE.E, -HILL.M); b.downToEnd(60); } },
    { id: 'canyon', name: 'Ledger Canyon', blurb: 'Sharp desert bends between the rocks.', laps: 3,
      build(b) { b.straight(LEN.S); b.curve(LEN.M, -CURVE.H); b.straight(LEN.S); b.curve(LEN.M, CURVE.H, HILL.L); b.scurves(); b.hill(LEN.M, HILL.H); b.curve(LEN.L, -CURVE.M, -HILL.M); b.curve(LEN.M, CURVE.H); b.bumps(); b.downToEnd(60); } },
    { id: 'coast', name: "Poet's Coast", blurb: 'Fast seaside sweepers and big crests.', laps: 3,
      build(b) { b.straight(LEN.M); b.hill(LEN.M, HILL.H); b.curve(LEN.L, CURVE.E, -HILL.M); b.curve(LEN.L, -CURVE.E); b.scurves(); b.hill(LEN.M, HILL.M); b.curve(LEN.M, CURVE.M, -HILL.L); b.straight(LEN.L); b.downToEnd(60); } },
    { id: 'city', name: 'Exam City Nights', blurb: 'Neon night streets with tight chicanes.', laps: 3,
      build(b) { b.straight(LEN.S); b.curve(LEN.S, CURVE.H); b.curve(LEN.S, -CURVE.H); b.straight(LEN.M); b.scurves(); b.curve(LEN.M, CURVE.H, HILL.M); b.bumps(); b.curve(LEN.M, -CURVE.H, -HILL.M); b.curve(LEN.S, CURVE.M); b.curve(LEN.S, -CURVE.M); b.downToEnd(60); } }
  ];

  function build(trackId) {
    const t = TRACKS.find((x) => x.id === trackId) || TRACKS[0];
    const theme = THEMES[t.id];
    const b = Builder();
    t.build(b);
    const segs = b.segs;
    // Scenery: themed decor on both verges, arrow signs before bends, subject signs.
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const decorSprite = (name) => (name === 'building' ? pick(Sprites.buildings) : Sprites[name]);
    for (let n = 20; n < segs.length; n += 3 + Math.floor(rnd() * 4)) {
      const side = rnd() < 0.5 ? -1 : 1;
      const name = pick(theme.decor);
      const far = name === 'building' ? 2.2 + rnd() * 1.2 : 1.35 + rnd() * 2.2;
      segs[n].sprites.push({ s: decorSprite(name), offset: side * far });
      if (rnd() < 0.35) segs[n].sprites.push({ s: decorSprite(pick(theme.decor)), offset: -side * (1.4 + rnd() * 2.5) });
    }
    for (let n = 1; n < segs.length - 1; n++) {
      if (Math.abs(segs[n].curve) >= CURVE.M && Math.abs(segs[n - 1].curve) < CURVE.M && n % 1 === 0) {
        for (let k = 0; k < 3; k++) { const s = segs[Math.max(0, n - 30 + k * 10)]; s.sprites.push({ s: segs[n].curve > 0 ? Sprites.signs.right : Sprites.signs.left, offset: segs[n].curve > 0 ? -1.25 : 1.25 }); }
      }
    }
    [['econ', 60], ['acc', 0.45], ['eng', 0.75]].forEach(([k, at], i) => { const idx = i === 0 ? at : Math.floor(segs.length * at); segs[idx].sprites.push({ s: Sprites.signs[k], offset: i % 2 ? 1.6 : -1.6 }); });
    segs[8].sprites.push({ s: Sprites.arch, offset: 0, arch: true });
    // Question box rows spread around the lap.
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const idx = Math.floor(segs.length * ((r + 0.6) / rows));
      segs[idx].boxes = [-0.55, 0, 0.55].map((o) => ({ offset: o, respawn: 0 }));
    }
    return { track: t, theme, segs, length: segs.length * SEG };
  }

  window.Track = { SEG, RUMBLE, TRACKS, THEMES, build };
})();
