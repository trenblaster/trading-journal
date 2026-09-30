// Revision Rally race engine: pseudo-3D projection, player physics, AI rivals and items.
(function () {
  const W = 960, H = 540;
  const SEG = Track.SEG, ROAD = 2000, CAM_H = 1000, FOV = 100, DRAW = 260, FOG = 5;
  const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
  const PLAYER_Z = CAM_H * CAM_DEPTH;
  const BASE_MAX = SEG / (1 / 60);          // top speed: one segment per frame at 60fps
  const KART_WW = 0.34;
  const RIVALS = [
    { name: 'Hoot', color: '#8a5a3c', helmet: '#e8b33a' }, { name: 'Tally', color: '#1f7f72', helmet: '#ffffff' },
    { name: 'Quill', color: '#6c4f9e', helmet: '#ff7aa2' }, { name: 'Ada', color: '#e67e22', helmet: '#2b2233' },
    { name: 'Keynes', color: '#2e86de', helmet: '#ffd23f' }
  ];
  const CLASS = { 50: [0.74, 0.86], 100: [0.84, 0.96], 150: [0.93, 1.05] };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const pct = (n, total) => (n % total) / total;
  const overlap = (x1, w1, x2, w2, k = 1) => { const h = k / 2; return !((x1 + w1 * h) < (x2 - w2 * h) || (x1 - w1 * h) > (x2 + w2 * h)); };

  let R = null;          // current race state
  const input = { left: false, right: false, up: false, down: false };
  const hooks = { box: null, finish: null, hud: null, event: null };

  function start(opts) {
    const t = Track.build(opts.track);
    const up = opts.upgrades || {};
    const maxSpeed = BASE_MAX * (1 + 0.035 * (up.engine || 0));
    const [lo, hi] = CLASS[opts.cc] || CLASS[50];
    const cars = RIVALS.map((r, i) => {
      const skill = lerp(lo, hi, i / (RIVALS.length - 1));
      return { ...r, sprites: [-1, 0, 1].map((l) => Sprites.kart(r.color, r.helmet, l)), offset: [-0.5, 0.5, -0.2, 0.2, 0][i] || 0,
        start: (8 + (RIVALS.length - i) * 5) * SEG, dist: 0, z: (8 + (RIVALS.length - i) * 5) * SEG, lap: 1, speed: 0, top: BASE_MAX * skill, stun: 0, finished: null, lean: 0 };
    });
    R = {
      t, segs: t.segs, len: t.length, laps: t.track.laps, cc: opts.cc, up,
      maxSpeed, accel: maxSpeed / (5.5 - 0.35 * (up.accel || 0)), decel: -maxSpeed / 5, brake: -maxSpeed,
      offDecel: -maxSpeed / 2, offLimit: maxSpeed / 4, centrifugal: 0.3 * (1 - 0.08 * (up.handling || 0)),
      pos: 2 * SEG, startPos: 2 * SEG, dist: 0, x: 0, speed: 0, lap: 1, time: 0, lapStart: 0, lapTimes: [], countdown: 3.5, done: false,
      boost: 0, shield: 0, spin: 0, item: null, cars, skyOff: 0, hillOff: 0, frame: 0, flash: 0,
      playerSprites: [-1, 0, 1].map((l) => Sprites.kart(opts.color || '#d9546b', '#ffffff', l)), paused: false, lastBoxSeg: -1
    };
    placeCars();
    return R;
  }
  function placeCars() { R.segs.forEach((s) => (s.cars = [])); for (const c of R.cars) segAt(c.z).cars.push(c); }
  const segAt = (z) => R.segs[Math.floor(z / SEG) % R.segs.length];
  const wrap = (z) => { let v = z % R.len; if (v < 0) v += R.len; return v; };
  // Progress is total distance from the start line, so pushbacks can never count as laps.
  const carProgress = (c) => c.start + c.dist;
  function playerProgress() { return R.startPos + R.dist + PLAYER_Z; }
  const signed = (d) => { let v = d % R.len; if (v > R.len / 2) v -= R.len; if (v < -R.len / 2) v += R.len; return v; };
  function move(d) { R.dist += d; R.pos = wrap(R.startPos + R.dist); }

  function standings() {
    const list = R.cars.map((c) => ({ name: c.name, prog: c.finished != null ? 1e12 - c.finished : carProgress(c), car: c }));
    list.push({ name: 'You', prog: R.done ? 1e12 - R.time : playerProgress(), you: true });
    list.sort((a, b) => b.prog - a.prog);
    return list;
  }

  function useItem() {
    if (!R || !R.item || R.countdown > 0 || R.done) return;
    const it = R.item; R.item = null;
    if (it === 'boost') { R.boost = 2.6 + 0.4 * (R.up.boost || 0); hooks.event && hooks.event('Boost!'); }
    else if (it === 'shield') { R.shield = 12; hooks.event && hooks.event('Shield up: the next spin is blocked'); }
    else if (it === 'rocket') {
      const me = playerProgress();
      const ahead = R.cars.filter((c) => c.finished == null && carProgress(c) > me).sort((a, b) => carProgress(a) - carProgress(b))[0];
      if (ahead) { ahead.stun = 2.8; hooks.event && hooks.event(`Rocket hit ${ahead.name}!`); } else hooks.event && hooks.event('No one ahead: rocket fizzled');
    }
  }
  // Called by the UI after a question box is answered.
  function answered(ok, cancelled) {
    if (!R || cancelled) return;
    if (ok) {
      const place = standings().findIndex((s) => s.you) + 1;
      const roll = Math.random();
      const item = place >= 4 ? (roll < 0.45 ? 'rocket' : roll < 0.8 ? 'boost' : 'shield') : place >= 2 ? (roll < 0.25 ? 'rocket' : roll < 0.75 ? 'boost' : 'shield') : (roll < 0.7 ? 'boost' : 'shield');
      if (R.item) { R.boost = Math.max(R.boost, 1.2); hooks.event && hooks.event('Item slot full: mini boost!'); }
      else { R.item = item; hooks.event && hooks.event(`Got a ${item}! Press Space to use`); }
      R.flash = 0.3;
    } else if (R.shield > 0) { R.shield = 0; hooks.event && hooks.event('Shield blocked the spin-out'); }
    else { R.spin = 1.1; R.speed *= 0.45; hooks.event && hooks.event('Wrong answer: spin-out!'); }
  }

  function update(dt) {
    if (!R || R.paused) return;
    R.frame++;
    if (R.countdown > 0) { R.countdown -= dt; if (R.countdown <= 0) { R.lapStart = R.time; } return; }
    R.time += dt;
    const pSeg = segAt(R.pos + PLAYER_Z);
    const top = R.maxSpeed * (R.boost > 0 ? 1.35 : 1);
    const speedPct = R.speed / R.maxSpeed;
    const dx = dt * 2 * speedPct;
    const startPos = R.pos;
    move(dt * R.speed);
    if (R.spin > 0) { R.spin -= dt; R.x += Math.sin(R.spin * 20) * dt * 0.8; }
    else if (!R.done) { if (input.left) R.x -= dx * (1 + 0.08 * (R.up.handling || 0)); else if (input.right) R.x += dx * (1 + 0.08 * (R.up.handling || 0)); }
    R.x -= dx * speedPct * pSeg.curve * R.centrifugal;
    if (R.done) R.speed = lerp(R.speed, R.maxSpeed * 0.4, dt);
    else if (R.boost > 0) { R.speed += R.accel * 2 * dt; R.boost -= dt; }
    else if (input.up && R.spin <= 0) R.speed += R.accel * dt;
    else if (input.down) R.speed += R.brake * dt;
    else R.speed += R.decel * dt;
    if (R.shield > 0) R.shield -= dt;
    if (R.flash > 0) R.flash -= dt;
    // off-road: slower, and solid scenery stops you
    if (R.x < -1 || R.x > 1) {
      if (R.speed > R.offLimit && R.boost <= 0) R.speed += R.offDecel * dt;
      for (const sp of pSeg.sprites) {
        if (sp.arch) continue;
        const w = sp.s.ww * 0.5;
        if (Math.abs(sp.offset) < 5 && overlap(R.x, KART_WW * 0.6, sp.offset + (w / 2) * Math.sign(sp.offset), w)) {
          R.speed = R.maxSpeed / 6; move(Math.min(0, signed(segAt(R.pos).p1.world.z - PLAYER_Z - R.pos))); break;
        }
      }
    }
    // bump into rivals
    for (const c of pSeg.cars) {
      if (R.speed > c.speed && overlap(R.x, KART_WW, c.offset, KART_WW, 0.8)) { R.speed = c.speed * (c.speed / R.speed); move(Math.min(0, signed(c.z - PLAYER_Z - R.pos))); break; }
    }
    R.x = clamp(R.x, -3, 3);
    R.speed = clamp(R.speed, 0, top);
    // parallax
    R.skyOff = (R.skyOff + 0.001 * pSeg.curve * (R.pos - startPos + (R.pos < startPos ? R.len : 0)) / SEG) % 1;
    R.hillOff = (R.hillOff + 0.002 * pSeg.curve * (R.pos - startPos + (R.pos < startPos ? R.len : 0)) / SEG) % 1;
    // laps
    const lapNow = Math.floor((R.startPos + R.dist + PLAYER_Z) / R.len) + 1;
    if (lapNow > R.lap && !R.done) {
      R.lapTimes.push(R.time - R.lapStart); R.lapStart = R.time;
      if (R.lap >= R.laps) { R.done = true; const st = standings(); hooks.finish && hooks.finish({ place: st.findIndex((s) => s.you) + 1, time: R.time, lapTimes: R.lapTimes, standings: st }); }
      else { R.lap++; hooks.event && hooks.event(R.lap === R.laps ? 'Final lap!' : `Lap ${R.lap}`); }
    }
    // question boxes
    for (const s of R.segs) if (s.boxes) for (const bx of s.boxes) if (bx.respawn > 0) bx.respawn -= dt;
    if (pSeg.boxes && pSeg.index !== R.lastBoxSeg && !R.done) {
      const hit = pSeg.boxes.find((bx) => bx.respawn <= 0 && Math.abs(R.x - bx.offset) < 0.3);
      if (hit) { R.lastBoxSeg = pSeg.index; pSeg.boxes.forEach((bx) => (bx.respawn = 4)); if (hooks.box) { R.paused = true; hooks.box(); } }
    }
    if (pSeg.index !== R.lastBoxSeg && !pSeg.boxes) R.lastBoxSeg = -1;
    updateCars(dt);
    hooks.hud && hooks.hud(hud());
  }

  function updateCars(dt) {
    const me = playerProgress();
    for (const c of R.cars) {
      const old = segAt(c.z);
      let target = c.top;
      const gap = carProgress(c) - me;
      target *= gap > 3000 ? 0.94 : gap < -3000 ? 1.06 : 1;   // gentle rubber-banding keeps races close
      if (c.stun > 0) { c.stun -= dt; target *= 0.25; }
      c.speed = lerp(c.speed, target, dt * 0.8);
      // steer around the player and other karts just ahead
      let steer = 0;
      const look = 20;
      for (let i = 1; i < look; i++) {
        const s = R.segs[(old.index + i) % R.segs.length];
        if (s === segAt(R.pos + PLAYER_Z) && c.speed > R.speed && overlap(R.x, KART_WW, c.offset, KART_WW, 1.2)) { steer = R.x > 0.5 ? -1 : R.x < -0.5 ? 1 : (c.offset > R.x ? 1 : -1); break; }
        for (const o of s.cars) if (o !== c && c.speed > o.speed && overlap(c.offset, KART_WW, o.offset, KART_WW, 1.2)) { steer = o.offset > 0.5 ? -1 : o.offset < -0.5 ? 1 : (c.offset > o.offset ? 1 : -1); break; }
        if (steer) break;
      }
      c.offset = clamp(c.offset + steer * dt * 1.2 - old.curve * 0.0006 * c.speed * dt / 60, -0.85, 0.85);
      c.lean = steer || -Math.sign(old.curve);
      c.dist += dt * c.speed;
      c.z = wrap(c.start + c.dist);
      const cl = Math.floor(carProgress(c) / R.len) + 1;
      if (cl > c.lap) { if (c.lap >= R.laps && c.finished == null) c.finished = R.time; c.lap = cl; }
      c.percent = pct(c.z, SEG);
      const nw = segAt(c.z);
      if (nw !== old) { old.cars.splice(old.cars.indexOf(c), 1); nw.cars.push(c); }
    }
  }

  function hud() {
    const st = standings();
    return { place: st.findIndex((s) => s.you) + 1, of: st.length, lap: Math.min(R.lap, R.laps), laps: R.laps, time: R.time, speed: Math.round((R.speed / BASE_MAX) * 180),
      item: R.item, boost: R.boost > 0, shield: R.shield > 0, countdown: R.countdown, lapFrac: wrap(R.pos + PLAYER_Z) / R.len,
      rivals: R.cars.map((c) => ({ name: c.name, color: c.color, frac: c.z / R.len })) };
  }

  // ---------------------------------------------------------------- rendering
  function project(p, camX, camY, camZ) {
    p.camera.x = (p.world.x || 0) - camX; p.camera.y = (p.world.y || 0) - camY; p.camera.z = (p.world.z || 0) - camZ;
    p.screen.scale = CAM_DEPTH / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD * W / 2);
  }
  function poly(ctx, x1, y1, x2, y2, x3, y3, x4, y4, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill(); }
  const fogOf = (d) => 1 / Math.pow(Math.E, d * d * FOG);

  let bgCache = null;
  function backgrounds(theme) {
    if (bgCache && bgCache.theme === theme) return bgCache;
    const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
    let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ridge = (x, w, h, col, amp, base, step) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); let y = base; for (let i = 0; i <= w; i += step) { y = clamp(y + (rnd() - 0.5) * amp, h * 0.2, h * 0.9); x.lineTo(i, y); } x.lineTo(w, h); x.closePath(); x.fill(); };
    const far = mk(1920, 260, (x, w, h) => {
      if (theme.night) { for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; x.fillRect(rnd() * w, rnd() * h * 0.5, 2, 2); } x.fillStyle = '#fff6d0'; x.beginPath(); x.arc(1500, 60, 26, 0, 7); x.fill(); }
      else { x.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 9; i++) { const cx = rnd() * w, cy = 30 + rnd() * 70; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(cx + k * 28, cy + (k % 2) * 6, 40, 16, 0, 0, 7); x.fill(); } } }
      ridge(x, w, h, theme.far, 30, h * 0.6, 24);
    });
    const near = mk(1920, 260, (x, w, h) => {
      ridge(x, w, h, theme.hills[0], 40, h * 0.7, 30); ridge(x, w, h, theme.hills[1], 26, h * 0.82, 20);
      if (theme.night) for (let i = 0; i < 40; i++) { const bx = rnd() * w, bh = 40 + rnd() * 120; x.fillStyle = '#10132a'; x.fillRect(bx, h - bh, 30 + rnd() * 30, bh); x.fillStyle = '#ffe28a'; for (let k = 0; k < 6; k++) x.fillRect(bx + 4 + (k % 3) * 9, h - bh + 8 + Math.floor(k / 3) * 12, 4, 5); }
    });
    bgCache = { theme, far, near };
    return bgCache;
  }
  function drawLayer(ctx, img, off, y) {
    const sw = img.width / 2, sx = Math.floor(off * img.width) % img.width;
    const x0 = (sx + img.width) % img.width;
    const first = Math.min(sw, img.width - x0);
    ctx.drawImage(img, x0, 0, first, img.height, 0, y, W * (first / sw), H * (img.height / 540));
    if (first < sw) ctx.drawImage(img, 0, 0, sw - first, img.height, W * (first / sw), y, W * ((sw - first) / sw), H * (img.height / 540));
  }
  function sprite(ctx, img, ww, scale, x, y, offX, clipY) {
    const dw = ww * scale * ROAD * W / 2, dh = dw * (img.height / img.width);
    const dx = x + dw * offX, dy = y - dh;
    const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
    if (clipH < dh && dw > 0.5) ctx.drawImage(img, 0, 0, img.width, img.height - (img.height * clipH) / dh, dx, dy, dw, dh - clipH);
  }

  function render(ctx) {
    if (!R) return;
    const th = R.t.theme, segs = R.segs;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6); sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const bg = backgrounds(th);
    drawLayer(ctx, bg.far, R.skyOff, H * 0.08); drawLayer(ctx, bg.near, R.hillOff, H * 0.16);
    const base = segAt(R.pos), basePct = pct(R.pos, SEG);
    const pSeg = segAt(R.pos + PLAYER_Z), pPct = pct(R.pos + PLAYER_Z, SEG);
    const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
    let maxy = H, x = 0, dx = -(base.curve * basePct);
    for (let n = 0; n < DRAW; n++) {
      const s = segs[(base.index + n) % segs.length];
      s.looped = s.index < base.index; s.fog = fogOf(n / DRAW); s.clip = maxy;
      project(s.p1, R.x * ROAD - x, playerY + CAM_H, R.pos - (s.looped ? R.len : 0));
      project(s.p2, R.x * ROAD - x - dx, playerY + CAM_H, R.pos - (s.looped ? R.len : 0));
      x += dx; dx += s.curve;
      if (s.p1.camera.z <= CAM_DEPTH || s.p2.screen.y >= s.p1.screen.y || s.p2.screen.y >= maxy) continue;
      const a = s.p1.screen, b = s.p2.screen, band = s.band;
      ctx.fillStyle = th.grass[band]; ctx.fillRect(0, b.y, W, a.y - b.y);
      const r1 = a.w / 6, r2 = b.w / 6, l1 = a.w / 32, l2 = b.w / 32;
      poly(ctx, a.x - a.w - r1, a.y, a.x - a.w, a.y, b.x - b.w, b.y, b.x - b.w - r2, b.y, th.rumble[band]);
      poly(ctx, a.x + a.w + r1, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x + b.w + r2, b.y, th.rumble[band]);
      const isStart = s.index < 3 || (s.index > 6 && s.index < 9);
      poly(ctx, a.x - a.w, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x - b.w, b.y, isStart ? (s.index % 2 ? '#fff' : '#222') : th.road[band]);
      if (!band && !isStart) for (const ln of [-1 / 3, 1 / 3]) poly(ctx, a.x + a.w * ln * 2 - l1 / 2, a.y, a.x + a.w * ln * 2 + l1 / 2, a.y, b.x + b.w * ln * 2 + l2 / 2, b.y, b.x + b.w * ln * 2 - l2 / 2, b.y, th.lane);
      if (s.fog < 1) { ctx.globalAlpha = 1 - s.fog; ctx.fillStyle = th.fog; ctx.fillRect(0, b.y, W, a.y - b.y); ctx.globalAlpha = 1; }
      maxy = b.y;
    }
    // sprites, boxes and rivals, far to near
    const boxFrame = Sprites.box[Math.floor(R.frame / 8) % Sprites.box.length];
    for (let n = DRAW - 1; n > 0; n--) {
      const s = segs[(base.index + n) % segs.length];
      const sc = s.p1.screen.scale;
      if (!(sc > 0)) continue;
      for (const sp of s.sprites) sprite(ctx, sp.s.c, sp.s.ww, sc, s.p1.screen.x + sc * sp.offset * ROAD * W / 2, s.p1.screen.y, sp.offset < 0 ? -1 : sp.arch ? -0.5 : 0, s.clip);
      if (s.boxes) for (const bx of s.boxes) if (bx.respawn <= 0) sprite(ctx, boxFrame, Sprites.boxWW, sc, s.p1.screen.x + sc * bx.offset * ROAD * W / 2, s.p1.screen.y - sc * 180 * H / 2, -0.5, s.clip);
      for (const c of s.cars) {
        const csc = lerp(s.p1.screen.scale, s.p2.screen.scale, c.percent || 0);
        const cx = lerp(s.p1.screen.x, s.p2.screen.x, c.percent || 0) + csc * c.offset * ROAD * W / 2;
        const cy = lerp(s.p1.screen.y, s.p2.screen.y, c.percent || 0);
        sprite(ctx, c.sprites[clamp(Math.round(c.lean), -1, 1) + 1], KART_WW, csc, cx, cy, -0.5, s.clip);
        if (c.stun > 0 && csc > 0) { ctx.fillStyle = '#ffd23f'; ctx.font = `bold ${Math.max(10, csc * 9000)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('★', cx, cy - csc * 700 * W / 2 * 0.001); }
      }
    }
    // player kart
    const bounce = (R.speed > 0 && R.countdown <= 0 ? (R.frame % 4 < 2 ? 1 : 0) * 1.5 * (R.speed / R.maxSpeed) : 0);
    const lean = R.spin > 0 ? (Math.floor(R.spin * 12) % 2 ? -1 : 1) : input.left && R.speed > 0 ? -1 : input.right && R.speed > 0 ? 1 : 0;
    const psc = CAM_DEPTH / PLAYER_Z;
    const py = H / 2 - psc * lerp(pSeg.p1.camera.y, pSeg.p2.camera.y, pPct) * H / 2 - bounce;
    if (R.boost > 0) { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,200,60,0.8)' : 'rgba(255,90,40,0.8)'; ctx.beginPath(); ctx.ellipse(W / 2 + (i % 2 ? -26 : 26), py - 8 + Math.random() * 6, 8, 14 + Math.random() * 10, 0, 0, 7); ctx.fill(); } }
    sprite(ctx, R.playerSprites[lean + 1], KART_WW * 0.8, psc, W / 2, py, -0.5, 0);
    if (R.shield > 0) { ctx.strokeStyle = 'rgba(120,220,255,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(W / 2, py - 60, 110, 70, 0, 0, 7); ctx.stroke(); }
    if (R.boost > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const ang = Math.random() * Math.PI * 2, r1 = 200 + Math.random() * 200; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1 * 0.6); ctx.lineTo(W / 2 + Math.cos(ang) * (r1 + 90), H / 2 + Math.sin(ang) * (r1 + 90) * 0.6); ctx.stroke(); } }
    if (R.flash > 0) { ctx.fillStyle = `rgba(255,240,150,${R.flash})`; ctx.fillRect(0, 0, W, H); }
    if (th.night) { const g = ctx.createRadialGradient(W / 2, H, 60, W / 2, H * 0.7, W * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }

  window.Race = { W, H, start, update, render, input, hooks, useItem, answered, get state() { return R; }, stop() { R = null; }, resume() { if (R) R.paused = false; } };
})();
