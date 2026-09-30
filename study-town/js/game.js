// Study Town: a cosy town-builder where every chore is a revision question.
(function () {
  'use strict';
  const TILE = 16, MW = 44, MH = 30;
  let VW = 24, VH = 15; // view size in tiles; adapted to the screen shape in fit()
  const SAVE_KEY = 'study-town-save-v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SUBJECTS = ['econ', 'acc', 'eng'];
  const SUBJ_SHORT = { econ: 'Econ', acc: 'Acc', eng: 'Eng', mix: 'Mixed' };

  // ------------------------------------------------------------------ catalogue
  const CROPS = {
    turnip:     { name: 'Turnip',      cost: 10,  days: 2, sell: 35,  house: 0, col: '#f4f1f6', top: '#6cbf4a' },
    carrot:     { name: 'Carrot',      cost: 20,  days: 3, sell: 70,  house: 1, col: '#f08a2b', top: '#4fae3b' },
    tomato:     { name: 'Tomato',      cost: 35,  days: 3, sell: 110, house: 2, col: '#e0412f', top: '#3e9a38' },
    pumpkin:    { name: 'Pumpkin',     cost: 50,  days: 4, sell: 180, house: 2, col: '#f29b2f', top: '#4f8a2e' },
    strawberry: { name: 'Strawberry',  cost: 70,  days: 4, sell: 250, house: 3, col: '#e8364f', top: '#3aa04a' },
    melon:      { name: 'Golden melon', cost: 120, days: 5, sell: 450, house: 4, col: '#f3c83a', top: '#5a9c2e' }
  };
  const HOUSES = [
    { name: 'Tent', cost: 0 }, { name: 'Log cabin', cost: 400 }, { name: 'Cottage', cost: 1200 },
    { name: 'Brick house', cost: 2800 }, { name: 'Manor', cost: 5500 }
  ];
  const CANS = [
    { name: 'Tin can', bonus: 0, cost: 0 }, { name: 'Copper can', bonus: 2, cost: 250 },
    { name: 'Silver can', bonus: 4, cost: 700 }, { name: 'Golden can', bonus: 7, cost: 1500 }
  ];
  const PLOT_POS = [];
  for (const y of [14, 16, 18]) for (const x of [5, 7, 9, 11]) PLOT_POS.push({ x, y });
  const PLOT_PRICES = [150, 300, 500, 800]; // each buys 2 more plots (4 → 12)
  const DECOR = {
    mailbox:  { name: 'Mailbox',          cost: 80,   tiles: [[11, 8]] },
    benches:  { name: 'Park benches',     cost: 150,  tiles: [[19, 14], [26, 14]] },
    flowers:  { name: 'Flower beds',      cost: 120,  tiles: [[20, 19], [25, 19]] },
    lamps:    { name: 'Lamp posts',       cost: 300,  tiles: [[18, 13], [27, 13], [18, 20], [27, 20]] },
    orchard:  { name: 'Orange trees',     cost: 400,  tiles: [[14, 23], [16, 23], [18, 23]], fruit: true },
    fountain: { name: 'Town fountain',    cost: 1500, tiles: [[22, 16], [23, 16], [22, 17], [23, 17]] },
    statue:   { name: 'Scholar statue',   cost: 2500, tiles: [[29, 17]] }
  };
  const BUILDINGS = {
    home:    { x: 6,  y: 3, w: 5, h: 5, door: [8, 7] },
    shop:    { x: 17, y: 3, w: 5, h: 5, door: [19, 7] },
    library: { x: 35, y: 3, w: 5, h: 5, door: [37, 7] }
  };
  const BOARD = [13, 9];
  const FISH = [
    { name: 'minnow', value: 6 }, { name: 'carp', value: 10 }, { name: 'perch', value: 12 }, { name: 'trout', value: 16 },
    { name: 'catfish', value: 20 }, { name: 'golden koi', value: 40 }
  ];
  const GOALS = [
    { id: 'answer', text: 'Answer 10 questions', target: 10, reward: 60 },
    { id: 'combo', text: 'Get 5 right in a row', target: 5, reward: 80 },
    { id: 'water', text: 'Water 4 crops', target: 4, reward: 40 },
    { id: 'long', text: 'Finish 1 Paper 2 style question', target: 1, reward: 50 }
  ];

  // ------------------------------------------------------------------ save state
  function fresh() {
    return {
      v: 1, coins: 60, xp: 0, day: 1, house: 0, can: 0, plots: 4,
      plot: PLOT_POS.map(() => ({ crop: null, stage: 0, watered: false })),
      seeds: { turnip: 3 }, decor: {}, fruitDay: {},
      weeds: [], npcDay: {}, player: { x: 8 * 16 + 8, y: 9 * 16 + 12, dir: 'down' },
      study: { subject: 'econ', paper: { econ: 1, acc: 1, eng: 1 }, topics: {} },
      stats: {}, topicStats: {}, total: { c: 0, w: 0 }, combo: 0, bestCombo: 0,
      streak: { last: null, count: 0 }, daily: { date: null }, custom: [], recent: []
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(fresh(), JSON.parse(raw));
    } catch (e) { /* storage unavailable: play without saving */ }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  function ensureDaily() {
    if (S.daily.date !== today()) S.daily = { date: today(), answer: 0, combo: 0, water: 0, long: 0, claimed: {} };
  }
  function touchStreak() {
    const t = today();
    if (S.streak.last === t) return;
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    S.streak.count = S.streak.last === y ? S.streak.count + 1 : 1;
    S.streak.last = t;
    if (S.streak.count > 1) toast(`Study streak: ${S.streak.count} days in a row`);
  }
  ensureDaily();

  // ------------------------------------------------------------------ map
  // g grass, p path, w water, s sand, b bridge, t tree, f flowers, k fence, r rock
  const map = [];
  (function buildMap() {
    for (let y = 0; y < MH; y++) { map.push(new Array(MW).fill('g')); }
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < MW && y < MH) map[y][x] = c; };
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
    // river with sandy banks
    for (let y = 0; y < MH; y++) { set(30, y, 's'); set(31, y, 'w'); set(32, y, 'w'); set(33, y, 's'); }
    // main road and bridge
    rect(2, 10, 41, 11, 'p'); rect(30, 10, 33, 11, 'b');
    rect(8, 8, 8, 9, 'p'); rect(19, 8, 19, 9, 'p'); rect(37, 8, 37, 9, 'p');
    // plaza
    rect(18, 12, 27, 20, 'p');
    // pond
    rect(3, 21, 10, 27, 's'); rect(4, 22, 9, 26, 'w');
    // farm fence (bottom and sides)
    for (let x = 3; x <= 13; x++) set(x, 20, 'k');
    for (let y = 13; y <= 19; y++) { set(3, y, 'k'); set(13, y, 'k'); }
    // border trees
    for (let x = 0; x < MW; x++) { set(x, 0, 't'); set(x, 1, 't'); set(x, MH - 1, 't'); }
    for (let y = 0; y < MH; y++) { set(0, y, 't'); set(MW - 1, y, 't'); }
    set(31, 0, 'w'); set(32, 0, 'w'); set(31, 1, 'w'); set(32, 1, 'w'); set(31, MH - 1, 'w'); set(32, MH - 1, 'w');
    // scattered trees, flowers and rocks
    [[2, 3], [4, 6], [14, 2], [15, 5], [25, 3], [27, 6], [24, 23], [28, 25], [21, 26], [12, 26], [36, 14], [40, 16], [38, 22], [41, 25], [35, 26], [2, 17], [15, 16], [28, 2], [41, 3], [34, 18]]
      .forEach(([x, y]) => set(x, y, 't'));
    [[5, 9], [12, 6], [16, 13], [29, 13], [36, 12], [39, 19], [26, 24], [11, 28], [22, 8], [24, 7], [40, 8], [2, 12], [16, 19], [35, 20]]
      .forEach(([x, y]) => set(x, y, 'f'));
    [[29, 22], [37, 25], [15, 27], [40, 12]].forEach(([x, y]) => set(x, y, 'r'));
  })();

  function inBuilding(tx, ty) {
    for (const k in BUILDINGS) { const b = BUILDINGS[k]; if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return k; }
    return null;
  }
  function decorAt(tx, ty) {
    for (const k in DECOR) if (S.decor[k]) for (const [x, y] of DECOR[k].tiles) if (x === tx && y === ty) return k;
    return null;
  }
  function solid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    const c = map[ty][tx];
    if (c === 'w' || c === 't' || c === 'k' || c === 'r') return true;
    if (inBuilding(tx, ty)) return true;
    if (tx === BOARD[0] && ty === BOARD[1]) return true;
    if (decorAt(tx, ty) && decorAt(tx, ty) !== 'flowers') return true;
    return false;
  }

  // ------------------------------------------------------------------ canvas setup
  const view = $('#view'), vctx = view.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = VW * TILE; buf.height = VH * TILE;
  const ctx = buf.getContext('2d');
  function fit() {
    const stage = $('#stage'), dpr = window.devicePixelRatio || 1;
    const sw = Math.max(200, stage.clientWidth), sh = Math.max(160, stage.clientHeight);
    if (sh > sw) { VW = 15; VH = clamp(Math.round(15 * sh / sw), 15, 26); }
    else { VH = 15; VW = clamp(Math.round(15 * sw / sh), 20, 30); }
    buf.width = VW * TILE; buf.height = VH * TILE;
    // Use an exact integer pixel scale when the screen is big enough (perfectly crisp);
    // on small screens fill the space and let nearest-neighbour scaling keep pixels sharp.
    const css = Math.min((stage.clientWidth - 8) / buf.width, (stage.clientHeight - 8) / buf.height);
    const exact = Math.floor(css * dpr);
    if (exact >= 3) {
      view.width = buf.width * exact; view.height = buf.height * exact;
      view.style.width = (view.width / dpr) + 'px'; view.style.height = (view.height / dpr) + 'px';
    } else {
      const k = Math.max(1, Math.ceil(css * dpr));
      view.width = buf.width * k; view.height = buf.height * k;
      view.style.width = Math.floor(buf.width * css) + 'px'; view.style.height = Math.floor(buf.height * css) + 'px';
    }
    vctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', fit);

  // Deterministic per-tile noise so grass tufts do not flicker.
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); };

  function drawGround(tx, ty, sx, sy, t) {
    const c = map[ty][tx], n = hash(tx, ty);
    if (c === 'w') {
      R('#4a9ee0', sx, sy, 16, 16);
      const ph = Math.floor(t / 600 + n * 4) % 2;
      R('#79c1f2', sx + 2 + ph * 6, sy + 5, 4, 1); R('#79c1f2', sx + 9 - ph * 5, sy + 11, 4, 1);
      if (ty > 0 && map[ty - 1][tx] !== 'w' && map[ty - 1][tx] !== 'b') R('#d6f0ff', sx, sy, 16, 2);
      return;
    }
    if (c === 'b') {
      R('#4a9ee0', sx, sy, 16, 16);
      R('#b8834e', sx, sy + 1, 16, 14);
      for (let i = 0; i < 4; i++) R('#8f6036', sx + i * 4 + 3, sy + 1, 1, 14);
      if (map[ty - 1][tx] !== 'b') R('#6d4526', sx, sy, 16, 2);
      if (map[ty + 1][tx] !== 'b') R('#6d4526', sx, sy + 14, 16, 2);
      return;
    }
    if (c === 'p') {
      R('#e6cc96', sx, sy, 16, 16);
      if (n > 0.5) R('#d2b47a', sx + (n * 13 | 0), sy + ((n * 97) % 13 | 0), 2, 1);
      if (n < 0.3) R('#f1dcae', sx + 3, sy + 9, 2, 1);
      return;
    }
    if (c === 's') {
      R('#f0dca0', sx, sy, 16, 16);
      if (n > 0.6) R('#dcc584', sx + 5, sy + 7, 1, 1);
      return;
    }
    // grass base for g, t, f, k, r
    R('#7fc756', sx, sy, 16, 16);
    if (n > 0.35) { R('#69b046', sx + (n * 11 | 0), sy + ((n * 53) % 12 | 0) + 2, 1, 2); R('#69b046', sx + (n * 11 | 0) + 2, sy + ((n * 53) % 12 | 0) + 3, 1, 1); }
    if (n < 0.2) R('#96d86a', sx + 9, sy + 4, 2, 1);
    if (c === 'f') {
      const cols = ['#ffffff', '#ffd23f', '#ff7aa2', '#b58cff'];
      for (let i = 0; i < 3; i++) {
        const fx = sx + 2 + ((n * 97 + i * 5) % 11 | 0), fy = sy + 3 + ((n * 61 + i * 4) % 10 | 0);
        R('#4f8f33', fx + 1, fy + 2, 1, 2); R(cols[(i + (n * 4 | 0)) % 4], fx, fy, 3, 2); R('#f7b733', fx + 1, fy, 1, 1);
      }
    }
    if (c === 'k') {
      const horiz = map[ty][tx - 1] === 'k' || map[ty][tx + 1] === 'k';
      if (horiz) { R('#8b5a2b', sx, sy + 6, 16, 2); R('#8b5a2b', sx, sy + 11, 16, 2); R('#6b4220', sx + 7, sy + 4, 3, 11); }
      else { R('#8b5a2b', sx + 6, sy, 2, 16); R('#8b5a2b', sx + 9, sy, 2, 16); R('#6b4220', sx + 5, sy + 6, 7, 3); }
    }
    if (c === 'r') {
      R('#8e8a86', sx + 2, sy + 6, 12, 8); R('#a9a5a0', sx + 3, sy + 5, 9, 4); R('#6f6b67', sx + 2, sy + 13, 12, 1); R('#c4c0bb', sx + 5, sy + 6, 3, 1);
    }
  }

  function drawTree(sx, sy, fruit) {
    R('rgba(0,0,0,0.18)', sx + 2, sy + 13, 12, 3);
    R('#7a4a26', sx + 6, sy + 8, 4, 7); R('#5d371b', sx + 6, sy + 8, 1, 7);
    R('#2f7a3a', sx + 1, sy - 6, 14, 14); R('#2f7a3a', sx - 1, sy - 3, 18, 9);
    R('#3f9a48', sx + 2, sy - 7, 12, 12); R('#3f9a48', sx, sy - 4, 16, 7);
    R('#5bb85e', sx + 4, sy - 6, 6, 4); R('#5bb85e', sx + 2, sy - 3, 3, 2);
    if (fruit) { R('#f08a1c', sx + 3, sy - 1, 3, 3); R('#f08a1c', sx + 10, sy - 4, 3, 3); R('#f08a1c', sx + 7, sy + 2, 3, 3); }
  }

  function drawHouse(level, sx, sy) {
    // footprint 80x80; door centred at local x 40, bottom row.
    const bx = sx, by = sy;
    R('rgba(0,0,0,0.15)', bx + 4, by + 76, 72, 4);
    if (level === 0) {
      for (let i = 0; i < 34; i++) {
        const w = 8 + i * 1.7 | 0;
        R(i % 8 < 4 ? '#e8744f' : '#f3a26b', bx + 40 - w / 2, by + 42 + i, w, 1);
      }
      R('#5a2e1f', bx + 34, by + 58, 12, 18); R('#3d1f14', bx + 39, by + 58, 2, 18);
      R('#6b4220', bx + 39, by + 36, 2, 8);
      return;
    }
    if (level === 1) {
      R('#a0643a', bx + 10, by + 38, 60, 40);
      for (let y = 40; y < 78; y += 5) R('#7d4a28', bx + 10, by + y, 60, 1);
      for (let i = 0; i < 22; i++) R(i % 4 === 0 ? '#9e3029' : '#c0443a', bx + 4 + i, by + 38 - i, 72 - i * 2, 1);
      R('#5a3620', bx + 34, by + 58, 12, 20); R('#e8b33a', bx + 43, by + 68, 2, 2);
      R('#fbe7a1', bx + 16, by + 48, 12, 10); R('#5a3620', bx + 21, by + 48, 2, 10); R('#5a3620', bx + 16, by + 52, 12, 2);
      R('#fbe7a1', bx + 52, by + 48, 12, 10); R('#5a3620', bx + 57, by + 48, 2, 10); R('#5a3620', bx + 52, by + 52, 12, 2);
      return;
    }
    if (level === 2) {
      R('#f3e6c8', bx + 8, by + 34, 64, 44); R('#d9c8a4', bx + 8, by + 74, 64, 4);
      R('#8c8c8c', bx + 56, by + 6, 8, 14); R('#6e6e6e', bx + 55, by + 5, 10, 3);
      for (let i = 0; i < 26; i++) R(i % 5 === 0 ? '#355e9f' : '#4a78c2', bx + 2 + i, by + 34 - i, 76 - i * 2, 1);
      R('#3d7a4a', bx + 34, by + 56, 12, 22); R('#e8b33a', bx + 43, by + 66, 2, 2);
      for (const wx of [14, 54]) { R('#6b4a2f', bx + wx - 1, by + 45, 14, 13); R('#aee0ff', bx + wx, by + 46, 12, 11); R('#6b4a2f', bx + wx + 5, by + 46, 2, 11); R('#e7708d', bx + wx - 1, by + 58, 14, 3); }
      return;
    }
    if (level === 3) {
      R('#b5523b', bx + 6, by + 30, 68, 48);
      for (let y = 32; y < 78; y += 4) { R('#9a4230', bx + 6, by + y, 68, 1); for (let x = (y / 4) % 2 ? 6 : 12; x < 74; x += 12) R('#9a4230', bx + x, by + y - 3, 1, 3); }
      for (let i = 0; i < 26; i++) R(i % 4 === 0 ? '#3d404b' : '#4b4f5c', bx + 0 + i, by + 30 - i, 80 - i * 2, 1);
      R('#6e6e6e', bx + 14, by + 4, 8, 14);
      R('#2e5d8a', bx + 33, by + 54, 14, 24); R('#e8b33a', bx + 44, by + 66, 2, 2); R('#e9e2d0', bx + 31, by + 52, 18, 2);
      for (const wx of [12, 56]) for (const wy of [38, 58]) { R('#e9e2d0', bx + wx - 1, by + wy - 1, 14, 12); R('#aee0ff', bx + wx, by + wy, 12, 10); R('#e9e2d0', bx + wx + 5, by + wy, 2, 10); }
      R('#e9e2d0', bx + 33, by + 38, 14, 12); R('#aee0ff', bx + 34, by + 39, 12, 10);
      return;
    }
    // Manor
    R('#ece6da', bx + 2, by + 26, 76, 52); R('#d8d0c0', bx + 2, by + 50, 76, 2);
    for (let i = 0; i < 24; i++) R(i % 4 === 0 ? '#246360' : '#2f7d78', bx - 2 + i, by + 26 - i, 84 - i * 2, 1);
    R('#e8b33a', bx - 2, by + 25, 84, 2); R('#e8b33a', bx + 36, by + 4, 8, 6);
    for (const cx of [26, 52]) { R('#fffaf0', bx + cx, by + 54, 4, 24); R('#d8d0c0', bx + cx + 3, by + 54, 1, 24); }
    R('#6a3b2a', bx + 32, by + 56, 16, 22); R('#e8b33a', bx + 39, by + 56, 2, 22); R('#e8b33a', bx + 32, by + 55, 16, 2);
    for (const wx of [8, 22, 48, 62]) { R('#aee0ff', bx + wx, by + 32, 10, 12); R('#e8b33a', bx + wx - 1, by + 31, 12, 1); R('#fffaf0', bx + wx + 4, by + 32, 2, 12); }
    for (const wx of [8, 62]) { R('#aee0ff', bx + wx, by + 58, 10, 12); R('#fffaf0', bx + wx + 4, by + 58, 2, 12); }
  }

  function drawShop(sx, sy) {
    R('rgba(0,0,0,0.15)', sx + 4, sy + 76, 72, 4);
    R('#f7d9a8', sx + 6, sy + 30, 68, 48);
    for (let i = 0; i < 20; i++) R('#7a5b8c', sx + 2 + i, sy + 30 - i, 76 - i * 2, 1);
    for (let i = 0; i < 8; i++) R(i % 2 ? '#fff4e0' : '#d9546b', sx + 4 + i * 9, sy + 30, 9, 8);
    for (let i = 0; i < 8; i++) R(i % 2 ? '#fff4e0' : '#d9546b', sx + 6 + i * 9, sy + 38, 5, 3);
    R('#5a3620', sx + 33, sy + 54, 14, 24); R('#aee0ff', sx + 36, sy + 58, 8, 7);
    R('#6b4a2f', sx + 11, sy + 50, 18, 16); R('#aee0ff', sx + 12, sy + 51, 16, 14); R('#e8b33a', sx + 16, sy + 58, 4, 4); R('#e0412f', sx + 22, sy + 57, 4, 5);
    R('#6b4a2f', sx + 51, sy + 50, 18, 16); R('#aee0ff', sx + 52, sy + 51, 16, 14); R('#f08a2b', sx + 55, sy + 59, 3, 4); R('#6cbf4a', sx + 61, sy + 58, 4, 5);
    // hanging coin sign
    R('#6b4a2f', sx + 38, sy + 42, 1, 4); R('#6b4a2f', sx + 41, sy + 42, 1, 4); R('#e8b33a', sx + 35, sy + 45, 10, 8); R('#b8860b', sx + 39, sy + 46, 2, 6);
  }

  function drawLibrary(sx, sy) {
    R('rgba(0,0,0,0.15)', sx + 4, sy + 76, 72, 4);
    R('#cfc7dd', sx + 4, sy + 30, 72, 48); R('#b4abc6', sx + 4, sy + 74, 72, 4);
    for (let i = 0; i < 20; i++) R(i % 4 === 0 ? '#57407f' : '#6c4f9e', sx + 40 - (36 - i * 1.6), sy + 30 - i, (36 - i * 1.6) * 2 | 0, 1);
    R('#e8b33a', sx + 2, sy + 29, 76, 2);
    for (const cx of [10, 22, 54, 66]) { R('#f4f0fa', sx + cx, sy + 34, 5, 42); R('#b4abc6', sx + cx + 4, sy + 34, 1, 42); }
    R('#3f2f5c', sx + 32, sy + 52, 16, 26); R('#e8b33a', sx + 39, sy + 52, 2, 26);
    // open book emblem
    R('#fffaf0', sx + 33, sy + 36, 7, 9); R('#fffaf0', sx + 40, sy + 36, 7, 9); R('#6c4f9e', sx + 39, sy + 36, 2, 10);
    for (let i = 0; i < 3; i++) { R('#9a8fb0', sx + 34, sy + 38 + i * 2, 5, 1); R('#9a8fb0', sx + 41, sy + 38 + i * 2, 5, 1); }
  }

  function drawBoard(sx, sy) {
    R('#6b4220', sx + 2, sy + 6, 2, 10); R('#6b4220', sx + 12, sy + 6, 2, 10);
    R('#8b5a2b', sx, sy - 2, 16, 11); R('#f5e6c4', sx + 2, sy, 12, 7);
    R('#d9546b', sx + 3, sy + 1, 4, 3); R('#4a78c2', sx + 8, sy + 2, 5, 3); R('#9a8fb0', sx + 3, sy + 5, 8, 1);
  }

  function drawDecor(key, sx, sy, t) {
    if (key === 'mailbox') { R('#6b4220', sx + 7, sy + 8, 2, 8); R('#4a78c2', sx + 3, sy + 2, 10, 7); R('#355e9f', sx + 3, sy + 8, 10, 1); R('#d9546b', sx + 12, sy + 1, 1, 5); R('#d9546b', sx + 12, sy + 1, 3, 2); }
    if (key === 'benches') { R('#8b5a2b', sx + 1, sy + 6, 14, 3); R('#a86f3a', sx + 1, sy + 9, 14, 3); R('#4b4f5c', sx + 2, sy + 12, 2, 4); R('#4b4f5c', sx + 12, sy + 12, 2, 4); }
    if (key === 'flowers') { R('#8b5a2b', sx + 1, sy + 9, 14, 6); R('#6b4220', sx + 1, sy + 14, 14, 1); for (let i = 0; i < 4; i++) { R('#3f9a48', sx + 2 + i * 3, sy + 6, 2, 4); R(['#ff7aa2', '#ffd23f', '#b58cff', '#ffffff'][i], sx + 2 + i * 3, sy + 4 + (i % 2), 3, 3); } }
    if (key === 'lamps') { R('#3d404b', sx + 7, sy + 2, 2, 14); R('#3d404b', sx + 5, sy + 15, 6, 1); R('#3d404b', sx + 4, sy - 5, 8, 7); R((Math.floor(t / 800) % 2) ? '#fff2b0' : '#ffe680', sx + 5, sy - 4, 6, 5); }
    if (key === 'orchard') return; // drawn as trees
    if (key === 'fountain') return; // drawn once from its top-left tile
    if (key === 'statue') { R('#9e9a94', sx + 1, sy + 10, 14, 6); R('#c4c0bb', sx + 4, sy - 2, 8, 12); R('#c4c0bb', sx + 5, sy - 7, 6, 6); R('#9e9a94', sx + 3, sy - 8, 10, 2); R('#e8b33a', sx + 10, sy + 2, 3, 4); }
  }
  function drawFountain(sx, sy, t) {
    R('#9e9a94', sx, sy + 6, 32, 24); R('#c4c0bb', sx + 1, sy + 7, 30, 3);
    R('#4a9ee0', sx + 3, sy + 10, 26, 17);
    R('#c4c0bb', sx + 13, sy + 4, 6, 18); R('#e6e2dc', sx + 11, sy + 2, 10, 3);
    const ph = Math.floor(t / 250) % 3;
    R('#bfe6ff', sx + 15, sy - 4 + ph, 2, 6); R('#bfe6ff', sx + 10 - ph, sy + ph, 2, 2); R('#bfe6ff', sx + 20 + ph, sy + ph, 2, 2);
    R('#79c1f2', sx + 6 + ph * 3, sy + 18, 4, 1); R('#79c1f2', sx + 20 - ph * 2, sy + 23, 4, 1);
  }

  function drawPlot(i, sx, sy, t) {
    const p = S.plot[i];
    if (i >= S.plots) { R('#6b8f3e', sx + 7, sy + 5, 2, 9); R('#e9d7b0', sx + 4, sy + 3, 8, 5); R('#b8860b', sx + 6, sy + 4, 4, 3); return; }
    R(p.watered ? '#5a3822' : '#8a5a3b', sx + 1, sy + 1, 14, 14);
    R(p.watered ? '#472c1a' : '#734a2f', sx + 1, sy + 5, 14, 1); R(p.watered ? '#472c1a' : '#734a2f', sx + 1, sy + 10, 14, 1);
    if (!p.crop) return;
    const c = CROPS[p.crop], ratio = p.stage / c.days;
    if (ratio >= 1) {
      const bob = Math.floor(t / 400) % 2;
      R(c.top, sx + 5, sy + 1 + bob, 2, 4); R(c.top, sx + 9, sy + 1 + bob, 2, 4); R(c.top, sx + 7, sy + bob, 2, 4);
      R(c.col, sx + 4, sy + 5 + bob, 8, 7); R('rgba(255,255,255,0.45)', sx + 5, sy + 6 + bob, 2, 2);
      if (Math.floor(t / 300) % 4 === 0) R('#fff6a8', sx + 13, sy + 1, 2, 2);
    } else if (ratio >= 0.5) {
      R(c.top, sx + 7, sy + 6, 2, 7); R(c.top, sx + 4, sy + 5, 3, 3); R(c.top, sx + 9, sy + 4, 3, 3); R(c.col, sx + 7, sy + 11, 2, 2);
    } else if (p.stage > 0) {
      R(c.top, sx + 7, sy + 8, 2, 5); R(c.top, sx + 5, sy + 7, 2, 2); R(c.top, sx + 9, sy + 7, 2, 2);
    } else {
      R('#e9d7b0', sx + 5, sy + 8, 2, 2); R('#e9d7b0', sx + 9, sy + 9, 2, 2);
    }
  }
  function drawWeed(sx, sy) {
    R('#3f7d2b', sx + 4, sy + 8, 2, 6); R('#3f7d2b', sx + 8, sy + 6, 2, 8); R('#3f7d2b', sx + 11, sy + 9, 2, 5);
    R('#58a13a', sx + 3, sy + 7, 3, 2); R('#58a13a', sx + 9, sy + 5, 3, 2); R('#58a13a', sx + 12, sy + 8, 2, 2);
    R('#c4d94a', sx + 8, sy + 4, 2, 2);
  }

  // Characters are composed from pixel rectangles on a 16x16 grid.
  function drawPerson(sx, sy, dir, frame, pal) {
    R('rgba(0,0,0,0.2)', sx + 3, sy + 14, 10, 2);
    const step = frame ? 1 : 0;
    const legL = dir === 'up' || dir === 'down' ? step : 0, legR = dir === 'up' || dir === 'down' ? 1 - step : 0;
    // legs + shoes
    R(pal.pants, sx + 5, sy + 12, 2, 2 - legL); R(pal.pants, sx + 9, sy + 12, 2, 2 - legR);
    R('#4a2e1c', sx + 5, sy + 14 - legL, 2, 1); R('#4a2e1c', sx + 9, sy + 14 - legR, 2, 1);
    // body
    R(pal.shirt, sx + 4, sy + 9, 8, 4); R(pal.shirtDark, sx + 4, sy + 12, 8, 1);
    const arm = frame ? 1 : 0;
    if (dir === 'left') { R(pal.skin, sx + 6 + arm, sy + 10, 2, 2); }
    else if (dir === 'right') { R(pal.skin, sx + 8 - arm, sy + 10, 2, 2); }
    else { R(pal.skin, sx + 3, sy + 10 + arm, 1, 2); R(pal.skin, sx + 12, sy + 11 - arm, 1, 2); }
    // head
    R('#2b2233', sx + 3, sy + 1, 10, 9);
    R(pal.skin, sx + 4, sy + 2, 8, 7);
    if (dir === 'up') { R(pal.hair, sx + 4, sy + 1, 8, 8); }
    else if (dir === 'down') {
      R(pal.hair, sx + 3, sy + 0, 10, 3); R(pal.hair, sx + 3, sy + 3, 1, 4); R(pal.hair, sx + 12, sy + 3, 1, 4);
      R('#2b2233', sx + 5, sy + 5, 2, 2); R('#2b2233', sx + 9, sy + 5, 2, 2); R('#ffffff', sx + 5, sy + 5, 1, 1); R('#ffffff', sx + 9, sy + 5, 1, 1);
      R('#f29aa0', sx + 4, sy + 7, 1, 1); R('#f29aa0', sx + 11, sy + 7, 1, 1);
    } else {
      const r = dir === 'right';
      R(pal.hair, sx + 3, sy + 0, 10, 3); R(pal.hair, r ? sx + 3 : sx + 9, sy + 3, 4, 4);
      R('#2b2233', r ? sx + 9 : sx + 5, sy + 5, 2, 2); R('#f29aa0', r ? sx + 10 : sx + 4, sy + 7, 1, 1);
    }
  }
  const PLAYER_PAL = { skin: '#f2c29b', hair: '#5b3420', shirt: '#3d7dca', shirtDark: '#2d5f9e', pants: '#3b3551' };

  function drawOwl(sx, sy, t) {
    const b = Math.floor(t / 500) % 2;
    R('rgba(0,0,0,0.2)', sx + 3, sy + 14, 10, 2);
    R('#2b2233', sx + 2, sy + 2 + b, 12, 12); R('#8a5a3c', sx + 3, sy + 3 + b, 10, 10); R('#e9d2a9', sx + 5, sy + 8 + b, 6, 5);
    R('#8a5a3c', sx + 2, sy + 1 + b, 2, 2); R('#8a5a3c', sx + 12, sy + 1 + b, 2, 2);
    R('#ffffff', sx + 4, sy + 4 + b, 3, 3); R('#ffffff', sx + 9, sy + 4 + b, 3, 3); R('#2b2233', sx + 5, sy + 5 + b, 1, 1); R('#2b2233', sx + 10, sy + 5 + b, 1, 1);
    R('#f2a23a', sx + 7, sy + 7 + b, 2, 2); R('#f2a23a', sx + 5, sy + 13, 2, 1); R('#f2a23a', sx + 9, sy + 13, 2, 1);
    R('#2b2233', sx + 3, sy - 1 + b, 10, 2); R('#2b2233', sx + 6, sy - 2 + b, 4, 1); R('#e8b33a', sx + 12, sy + b, 1, 3);
  }
  function drawCat(sx, sy, t) {
    const b = Math.floor(t / 520) % 2;
    R('rgba(0,0,0,0.2)', sx + 3, sy + 14, 10, 2);
    R('#9aa0a8', sx + 12, sy + 8 - b, 3, 2); R('#9aa0a8', sx + 14, sy + 6 - b, 1, 3);
    R('#2b2233', sx + 3, sy + 2, 10, 9); R('#b5bbc3', sx + 4, sy + 3, 8, 7);
    R('#b5bbc3', sx + 3, sy + 0, 3, 3); R('#b5bbc3', sx + 10, sy + 0, 3, 3); R('#f29aa0', sx + 4, sy + 1, 1, 1); R('#f29aa0', sx + 11, sy + 1, 1, 1);
    R('#2b2233', sx + 5, sy + 5, 2, 2); R('#2b2233', sx + 9, sy + 5, 2, 2); R('#f29aa0', sx + 7, sy + 7, 2, 1);
    R('#d9546b', sx + 4, sy + 10, 8, 2); R('#b5bbc3', sx + 5, sy + 12, 6, 2); R('#9aa0a8', sx + 5, sy + 14, 2, 1); R('#9aa0a8', sx + 9, sy + 14, 2, 1);
  }
  function drawRaccoon(sx, sy, t) {
    const b = Math.floor(t / 480) % 2;
    R('rgba(0,0,0,0.2)', sx + 3, sy + 14, 10, 2);
    for (let i = 0; i < 4; i++) R(i % 2 ? '#3d404b' : '#8e8a86', sx + 12 + (i > 1 ? 1 : 0), sy + 6 + i * 2 - b, 3, 2);
    R('#2b2233', sx + 3, sy + 2, 10, 9); R('#8e8a86', sx + 4, sy + 3, 8, 7);
    R('#8e8a86', sx + 3, sy + 0, 3, 3); R('#8e8a86', sx + 10, sy + 0, 3, 3);
    R('#3d404b', sx + 4, sy + 5, 8, 2); R('#ffffff', sx + 5, sy + 5, 1, 1); R('#ffffff', sx + 10, sy + 5, 1, 1);
    R('#e8b33a', sx + 4, sy + 4, 3, 1); R('#e8b33a', sx + 9, sy + 4, 3, 1);
    R('#e9d7b0', sx + 6, sy + 7, 4, 3); R('#2b2233', sx + 7, sy + 7, 2, 1);
    R('#2e8b57', sx + 4, sy + 10, 8, 3); R('#8e8a86', sx + 5, sy + 13, 2, 2); R('#8e8a86', sx + 9, sy + 13, 2, 2);
  }

  // ------------------------------------------------------------------ NPC tutors
  const NPCS = [
    { id: 'hoot', name: 'Prof. Hoot', subject: 'econ', draw: drawOwl, home: [24, 13], x: 0, y: 0, tx: 0, ty: 0, wait: 0,
      tips: ['In essays, always label both axes and every curve. Unlabelled diagrams lose marks.', 'Part (b) essays need a judgement. Say "it depends on..." and then say what it depends on.', 'Elasticity: say whether it is elastic or inelastic AND what that means for revenue.', 'Market failure first, then policy, then evaluate the policy. That is a strong essay spine.'] },
    { id: 'tally', name: 'Tally', subject: 'acc', draw: drawRaccoon, home: [38, 13], x: 0, y: 0, tx: 0, ty: 0, wait: 0,
      tips: ['Always show workings. Method marks can save you when the final figure is wrong.', 'Dividends and drawings are never expenses in the income statement.', 'A capital reserve cannot be used for a cash dividend.', 'Check which side the suspense account goes on: it makes the smaller side equal the bigger side.'] },
    { id: 'quill', name: 'Quill', subject: 'eng', draw: drawCat, home: [11, 23], x: 0, y: 0, tx: 0, ty: 0, wait: 0,
      tips: ['Feature, quotation, effect: never name a technique without explaining what it does.', 'Stick to 150–200 words in Q1(a). Going over counts against relevance to purpose.', 'In your reflective commentary, quote your own writing.', 'Match the conventions of the text type: a blog is not a diary, and an editorial is not a news story.'] }
  ];
  NPCS.forEach((n) => { n.x = n.home[0] * 16 + 8; n.y = n.home[1] * 16 + 12; n.tx = n.x; n.ty = n.y; });
  function updateNpcs(dt) {
    for (const n of NPCS) {
      if (n.talking) continue;
      if (n.wait > 0) { n.wait -= dt; continue; }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d < 1) {
        n.wait = 1.5 + Math.random() * 3;
        for (let tries = 0; tries < 8; tries++) {
          const gx = n.home[0] + Math.floor(Math.random() * 7) - 3, gy = n.home[1] + Math.floor(Math.random() * 5) - 2;
          if (!solid(gx, gy)) { n.tx = gx * 16 + 8; n.ty = gy * 16 + 12; break; }
        }
      } else {
        const sp = 22 * dt;
        const nx = n.x + (dx / d) * Math.min(sp, d), ny = n.y + (dy / d) * Math.min(sp, d);
        if (solid(Math.floor(nx / 16), Math.floor((ny - 2) / 16))) { n.tx = n.x; n.ty = n.y; } else { n.x = nx; n.y = ny; }
      }
    }
  }

  // ------------------------------------------------------------------ player + input
  function DIRS_OK(d) { return ['up', 'down', 'left', 'right'].includes(d) ? d : 'down'; }
  const P = { x: S.player.x, y: S.player.y, dir: DIRS_OK(S.player.dir), moving: false, anim: 0 };
  const keys = new Set();
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  function blockedAt(x, y) {
    const pts = [[x - 5, y - 4], [x + 5, y - 4], [x - 5, y], [x + 5, y]];
    return pts.some(([px, py]) => solid(Math.floor(px / 16), Math.floor(py / 16)));
  }
  function updatePlayer(dt) {
    let dx = 0, dy = 0;
    const order = Array.from(keys);
    const last = order[order.length - 1];
    for (const k of order) { const v = DIRS[k]; dx += v[0]; dy += v[1]; }
    P.moving = dx !== 0 || dy !== 0;
    if (!P.moving) { P.anim = 0; return; }
    if (last) P.dir = last;
    const len = Math.hypot(dx, dy), sp = 72 * dt;
    const mx = (dx / len) * sp, my = (dy / len) * sp;
    if (!blockedAt(P.x + mx, P.y)) P.x += mx;
    if (!blockedAt(P.x, P.y + my)) P.y += my;
    P.anim += dt;
  }
  function facing() {
    const [dx, dy] = DIRS[P.dir];
    const ax = P.x + dx * 12, ay = P.y - 4 + dy * 12;
    return { tx: Math.floor(ax / 16), ty: Math.floor(ay / 16), ax, ay };
  }

  // What is in front of the player, and what Space would do.
  function target() {
    const f = facing();
    for (const n of NPCS) if (Math.hypot(n.x - f.ax, n.y - 4 - f.ay) < 12) return { kind: 'npc', npc: n, label: `Talk to ${n.name}` };
    for (const k in BUILDINGS) { const b = BUILDINGS[k]; if (f.tx === b.door[0] && f.ty === b.door[1]) return { kind: 'door', id: k, label: { home: 'Enter your home', shop: 'Enter the General Store', library: 'Enter the Library (study sessions and topics)' }[k] }; }
    if (f.tx === BOARD[0] && f.ty === BOARD[1]) return { kind: 'board', label: 'Read the notice board' };
    const wi = S.weeds.findIndex((w) => w.x === f.tx && w.y === f.ty);
    if (wi >= 0) return { kind: 'weed', i: wi, label: 'Pull weed (answer a question)' };
    const pi = PLOT_POS.findIndex((p) => p.x === f.tx && p.y === f.ty);
    if (pi >= 0) {
      if (pi >= S.plots) return { kind: 'plotlocked', label: 'Plot for sale at the General Store' };
      const p = S.plot[pi];
      if (!p.crop) return { kind: 'plant', i: pi, label: 'Plant seeds' };
      if (p.stage >= CROPS[p.crop].days) return { kind: 'harvest', i: pi, label: `Harvest ${CROPS[p.crop].name}` };
      if (!p.watered) return { kind: 'water', i: pi, label: `Water ${CROPS[p.crop].name} (answer a question)` };
      return { kind: 'watered', i: pi, label: 'Watered today. Sleep at home to let it grow' };
    }
    if (f.ty >= 0 && f.ty < MH && f.tx >= 0 && f.tx < MW && map[f.ty][f.tx] === 'w') return { kind: 'fish', label: 'Fish (answer a question to catch one)' };
    const d = decorAt(f.tx, f.ty);
    if (d === 'orchard') return { kind: 'fruit', key: `${f.tx},${f.ty}`, label: S.fruitDay[`${f.tx},${f.ty}`] === S.day ? 'Already picked today' : 'Shake tree for oranges' };
    if (d === 'fountain') return { kind: 'fountain', label: 'Toss a coin in the fountain' };
    if (d === 'statue') return { kind: 'statue', label: 'Read the plaque' };
    return null;
  }

  // ------------------------------------------------------------------ question engine
  function allItems() { return Bank.items.concat(S.custom); }
  function paperOf(subject) { return S.study.paper[subject] || 1; }
  function selectedTopics(subject) { return S.study.topics[subject + '|' + paperOf(subject)] || []; }
  function activeTopicIds(subject) {
    const paper = paperOf(subject), sel = selectedTopics(subject);
    return Bank.topics[subject].filter((t) => t.papers.includes(paper) && (!sel.length || sel.includes(t.id))).map((t) => t.id);
  }
  function pool(subject) {
    const paper = paperOf(subject), topics = activeTopicIds(subject);
    return allItems().filter((q) => q.subject === subject && q.papers.includes(paper) && topics.includes(q.topic));
  }
  function pickQuestion(forceSubject) {
    let subject = forceSubject || S.study.subject;
    if (subject === 'mix') subject = SUBJECTS[Math.floor(Math.random() * 3)];
    let items = pool(subject);
    if (!items.length) { // selection is empty for this paper: fall back to all topics
      const paper = paperOf(subject);
      items = allItems().filter((q) => q.subject === subject && q.papers.includes(paper));
    }
    const weights = items.map((q) => {
      const st = S.stats[q.id] || { c: 0, w: 0 };
      let w = Math.max(0.25, 1 + 2 * st.w - 0.5 * st.c);
      if (S.recent.includes(q.id)) w *= 0.03;
      if (q.gen) w *= 1.5;
      return w;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0), i = 0;
    while (i < items.length - 1 && (r -= weights[i]) > 0) i++;
    const base = items[i];
    S.recent = [base.id].concat(S.recent.filter((x) => x !== base.id)).slice(0, 10);
    if (base.gen) return Object.assign(base.make(), { id: base.id, subject: base.subject, topic: base.topic, papers: base.papers });
    return base;
  }

  function record(q, ok, fraction) {
    const st = S.stats[q.id] || (S.stats[q.id] = { c: 0, w: 0 });
    const tk = q.subject + '|' + q.topic, ts = S.topicStats[tk] || (S.topicStats[tk] = { c: 0, w: 0 });
    ensureDaily(); touchStreak();
    S.daily.answer++;
    if (q.type === 'self') S.daily.long++;
    if (ok) { st.c++; ts.c++; S.total.c++; S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo); }
    else { st.w++; ts.w++; S.total.w++; S.combo = 0; }
    S.daily.combo = Math.max(S.daily.combo, S.combo);
    S.xp += ok ? Math.round(10 + (q.type === 'self' ? 20 * fraction : 0)) : 2;
  }

  // Ask a question in the modal; resolves with { ok, fraction }.
  function ask(reason, forceSubject, inSession) {
    const q = pickQuestion(forceSubject);
    return new Promise((resolve) => openQuestion(q, reason, (ok, fraction, stopped) => { record(q, ok, fraction); save(); updateHud(); resolve({ ok, fraction, q, stopped }); }, inSession));
  }

  // A run of questions back to back: study sessions, tutor practice.
  async function runSession(title, count, subject, perCorrect) {
    let right = 0, done = 0, earned = 0;
    for (let i = 0; i < count; i++) {
      const r = await ask(`${title} · Q${i + 1}${count < Infinity ? ' of ' + count : ''} · ${right} right so far`, subject, true);
      done++;
      if (r.ok) { right++; const c = perCorrect + comboBonus(); earned += c; S.coins += c; }
      save(); updateHud();
      if (r.stopped) break;
    }
    const pct = done ? Math.round((right / done) * 100) : 0;
    dialog(title, `Session over: ${right} of ${done} correct (${pct}%). You earned ${earned} coins.${pct < 60 && done >= 3 ? ' Check Stats (I) to see which topics need work.' : ''}`);
  }

  const qm = $('#qmodal');
  let qState = null;
  function openQuestion(q, reason, done, inSession) {
    closePanel();
    keys.clear();
    const subj = Bank.subjects[q.subject];
    $('#q-meta').innerHTML = `<span class="chip chip-${q.subject}">${subj.name} ${subj.code}</span><span class="chip">Paper ${q.papers.length === 1 ? q.papers[0] : paperOf(q.subject)}</span><span class="chip chip-soft">${esc(Bank.topicName(q.subject, q.topic))}</span>`;
    $('#q-reason').textContent = reason;
    $('#q-graph').innerHTML = q.graph ? Graphs.render(q.graph) : '';
    $('#q-graph').hidden = !q.graph;
    $('#q-stem').innerHTML = q.q || q.prompt || '';
    $('#q-feedback').hidden = true; $('#q-feedback').innerHTML = '';
    const body = $('#q-body'); body.innerHTML = '';
    const foot = $('#q-foot'); foot.innerHTML = '';
    qState = { q, done, answered: false, sel: 0, order: null, inSession };

    if (q.type === 'mcq') {
      const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
      qState.order = order;
      order.forEach((oi, k) => {
        const b = document.createElement('button');
        b.className = 'opt'; b.type = 'button'; b.id = 'opt-' + k;
        b.innerHTML = `<span class="opt-key">${'ABCD'[k]}</span><span>${q.options[oi]}</span>`;
        b.addEventListener('click', () => answerMcq(k));
        body.appendChild(b);
      });
      highlight(0);
      foot.innerHTML = '<span class="kbd-hint">Arrow keys + Enter, or press A–D</span>';
    } else if (q.type === 'num') {
      body.innerHTML = `<label class="num-label" for="num-in">Your answer</label><div class="num-row"><input id="num-in" inputmode="decimal" autocomplete="off" placeholder="e.g. 1250 or -0.4"><button class="btn" id="num-go" type="button">Check</button></div>`;
      $('#num-go').addEventListener('click', answerNum);
      $('#num-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); answerNum(); } });
      setTimeout(() => $('#num-in').focus(), 30);
      foot.innerHTML = '<span class="kbd-hint">Type a number, then Enter. Commas and $ are fine.</span>';
    } else {
      body.innerHTML = `<label class="num-label" for="draft">Write your answer or a plan (optional, kept only for this question)</label><textarea id="draft" rows="6" placeholder="Plan your points here..."></textarea><button class="btn" id="reveal" type="button">Show the mark scheme</button>`;
      $('#reveal').addEventListener('click', revealSelf);
      foot.innerHTML = '<span class="kbd-hint">Self-marked. Tick each point you really made.</span>';
    }
    qm.hidden = false;
  }
  function highlight(k) {
    if (!qState || !qState.order) return;
    qState.sel = (k + qState.order.length) % qState.order.length;
    $$('.opt', qm).forEach((b, i) => b.classList.toggle('focus', i === qState.sel));
  }
  function answerMcq(k) {
    if (qState.answered) return;
    qState.answered = true;
    const { q, order } = qState, ok = order[k] === q.answer;
    $$('.opt', qm).forEach((b, i) => { b.disabled = true; if (order[i] === q.answer) b.classList.add('right'); else if (i === k) b.classList.add('wrong'); });
    feedback(ok, q.explain);
  }
  function answerNum() {
    if (qState.answered) return;
    const raw = $('#num-in').value.replace(/[,$\s%]/g, '');
    if (raw === '' || isNaN(Number(raw))) { $('#num-in').classList.add('shake'); setTimeout(() => $('#num-in').classList.remove('shake'), 400); return; }
    qState.answered = true;
    const { q } = qState, v = Number(raw), ok = Math.abs(v - q.answer) <= (q.tol != null ? q.tol : 0.01);
    $('#num-in').disabled = true; $('#num-go').disabled = true;
    feedback(ok, `<b>Answer: ${Number(q.answer).toLocaleString('en-US', { maximumFractionDigits: 2 })}</b><br>${q.explain || ''}`);
  }
  function revealSelf() {
    const { q } = qState;
    $('#reveal').remove();
    const d = $('#draft'); d.readOnly = true;
    const list = document.createElement('div');
    list.className = 'points';
    list.innerHTML = `<p class="points-h">Mark scheme points: tick the ones your answer covered</p>` +
      q.points.map((p, i) => `<label class="point"><input type="checkbox" id="pt-${i}"><span>${esc(p)}</span></label>`).join('') +
      (q.model ? `<details class="model"><summary>Examiner-style summary</summary><p>${q.model}</p></details>` : '') +
      `<button class="btn" id="self-go" type="button">Submit my self-mark</button>`;
    $('#q-body').appendChild(list);
    $('#self-go').addEventListener('click', () => {
      if (qState.answered) return;
      qState.answered = true;
      const n = $$('.point input', list).filter((c) => c.checked).length, frac = n / q.points.length;
      $$('.point input', list).forEach((c) => (c.disabled = true));
      $('#self-go').remove();
      feedback(frac >= 0.6, `You covered <b>${n} of ${q.points.length}</b> points (${Math.round(frac * 100)}%). ${frac >= 0.6 ? 'Solid answer.' : 'Revisit the points you missed and try a similar question again.'}`, frac);
    });
  }
  function feedback(ok, html, frac) {
    const fb = $('#q-feedback');
    fb.hidden = false;
    fb.className = 'q-feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `<p class="fb-title">${ok ? 'Correct!' : 'Not quite.'}</p><div>${html || ''}</div>`;
    $('#q-foot').innerHTML = (qState.inSession ? '<button class="btn" id="q-stop" type="button">Stop session <span class="kbd">Esc</span></button>' : '') +
      `<button class="btn btn-primary" id="q-next" type="button">${qState.inSession ? 'Next question' : 'Continue'} <span class="kbd">Enter</span></button>`;
    const finish = (stop) => { if (!qState) return; qm.hidden = true; const d = qState.done; const f = frac != null ? frac : ok ? 1 : 0; qState = null; d(ok, f, stop === true); };
    $('#q-next').addEventListener('click', () => finish(false));
    if ($('#q-stop')) $('#q-stop').addEventListener('click', () => finish(true));
    setTimeout(() => $('#q-next') && $('#q-next').focus(), 30);
    qState.finish = finish;
    if (ok) burst();
  }

  // ------------------------------------------------------------------ actions
  let busy = false;
  const particles = [];
  function burst() { for (let i = 0; i < 14; i++) particles.push({ x: P.x, y: P.y - 10, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, life: 0.9, c: ['#ffd23f', '#ffffff', '#7fdcff'][i % 3] }); }
  function coins(n, why) { S.coins += n; toast(`+${n} coins${why ? ' · ' + why : ''}`); }
  function comboBonus() { return Math.min(10, Math.max(0, S.combo - 1)); }

  async function interact() {
    if (busy || !panel.hidden || !qm.hidden) return;
    const t = target();
    if (!t) return;
    busy = true;
    try {
      if (t.kind === 'door') { if (t.id === 'home') openHome(); else if (t.id === 'shop') openShop(); else await openLibrary(); }
      else if (t.kind === 'board') openBoard();
      else if (t.kind === 'npc') await talkNpc(t.npc);
      else if (t.kind === 'plant') openPlant(t.i);
      else if (t.kind === 'plotlocked') toast('Buy more plots at the General Store.');
      else if (t.kind === 'harvest') {
        const p = S.plot[t.i], c = CROPS[p.crop];
        coins(c.sell, `sold ${c.name.toLowerCase()}`);
        S.xp += 15; p.crop = null; p.stage = 0; p.watered = false; save();
      } else if (t.kind === 'water') {
        const r = await ask(`Watering your ${CROPS[S.plot[t.i].crop].name.toLowerCase()}`);
        if (r.ok) {
          S.plot[t.i].watered = true; ensureDaily(); S.daily.water++;
          coins(5 + CANS[S.can].bonus + comboBonus(), S.combo > 1 ? `combo ×${S.combo}` : 'watered');
        } else toast('The soil stayed dry. Try again with a new question.');
        save();
      } else if (t.kind === 'watered') toast('Already watered today. Sleep at home to grow it.');
      else if (t.kind === 'weed') {
        const w = S.weeds[t.i];
        const r = await ask('Pulling a weed');
        if (r.ok) { S.weeds = S.weeds.filter((x) => x !== w); coins(8 + comboBonus(), 'weed pulled'); }
        else toast('The weed held on. Try again.');
        save();
      } else if (t.kind === 'fruit') {
        if (S.fruitDay[t.key] === S.day) toast('No oranges left today.');
        else { S.fruitDay[t.key] = S.day; coins(15, 'oranges'); save(); }
      } else if (t.kind === 'fish') {
        const r = await ask('Fishing');
        if (r.ok) { const f = FISH[Math.floor(Math.random() * FISH.length)]; const c = f.value + comboBonus(); S.coins += c; S.fish = (S.fish || 0) + 1; toast(`Caught a ${f.name}! +${c} coins`); }
        else toast('It got away. Cast again!');
        save();
      } else if (t.kind === 'fountain') toast('Plink. A wish for top marks.');
      else if (t.kind === 'statue') toast('"The first lesson of economics is scarcity." — plaque by the river');
    } finally { busy = false; updateHud(); }
  }

  async function talkNpc(n) {
    n.talking = true;
    try {
      const subj = Bank.subjects[n.subject].name;
      const tip = n.tips[Math.floor(Math.random() * n.tips.length)];
      if (S.npcDay[n.id] === S.day) {
        const c = await choose(n.name, `${tip} Want to practise some more ${subj}? (Paper ${paperOf(n.subject)}, your chosen topics.)`, ['5 questions', '10 questions', 'Keep going until I stop', 'Not now']);
        if (c >= 0 && c < 3) { n.talking = false; await runSession(`Practice with ${n.name}`, [5, 10, Infinity][c], n.subject, 6); }
        return;
      }
      const go = await choose(n.name, `Fancy a ${subj} challenge? Paper ${paperOf(n.subject)} style. Get it right for a big coin reward. After that you can practise with me as much as you like.`, ['Yes, challenge me', 'Maybe later']);
      if (go !== 0) return;
      const r = await ask(`${n.name}'s daily challenge`, n.subject);
      S.npcDay[n.id] = S.day;
      const reward = Math.round(35 * (r.q.type === 'self' ? Math.max(0.3, r.fraction) : r.ok ? 1 : 0.2));
      coins(reward, r.ok ? 'challenge won' : 'for trying');
      save();
    } finally { n.talking = false; }
  }

  function sleep() {
    S.day++;
    let grew = 0;
    S.plot.forEach((p) => { if (p.crop && p.watered) { p.stage = Math.min(CROPS[p.crop].days, p.stage + 1); grew++; } p.watered = false; });
    const want = Math.min(8, S.weeds.length + 2 + Math.floor(Math.random() * 3));
    for (let tries = 0; S.weeds.length < want && tries < 200; tries++) {
      const x = 2 + Math.floor(Math.random() * (MW - 4)), y = 2 + Math.floor(Math.random() * (MH - 4));
      if (map[y][x] !== 'g' || solid(x, y) || PLOT_POS.some((p) => p.x === x && p.y === y) || S.weeds.some((w) => w.x === x && w.y === y)) continue;
      if (Math.hypot(x * 16 - P.x, y * 16 - P.y) < 40) continue;
      S.weeds.push({ x, y });
    }
    save();
    closePanel();
    fade(`Day ${S.day}`, grew ? `${grew} crop${grew > 1 ? 's' : ''} grew overnight. Weeds popped up around town.` : 'A new day. Weeds popped up around town.');
    updateHud();
  }

  // ------------------------------------------------------------------ panels
  const panel = $('#panel-wrap'), panelBox = $('#panel');
  function openPanel(title, html, cls) {
    $('#panel-title').textContent = title;
    $('#panel-body').innerHTML = html;
    panelBox.className = 'panel ' + (cls || '');
    panel.hidden = false; keys.clear();
    setTimeout(() => { const f = $('#panel-body button, #panel-body input, #panel-body select'); if (f) f.focus(); else $('#panel-close').focus(); }, 30);
  }
  function closePanel() { panel.hidden = true; if (dialogResolve) { const r = dialogResolve; dialogResolve = null; r(-1); } }
  $('#panel-close').addEventListener('click', closePanel);

  let dialogResolve = null;
  function choose(who, text, options) {
    return new Promise((res) => {
      openPanel(who, `<p class="say">${esc(text)}</p><div class="row">${options.map((o, i) => `<button class="btn ${i === 0 ? 'btn-primary' : ''}" data-i="${i}" type="button">${esc(o)}</button>`).join('')}</div>`, 'panel-dialog');
      dialogResolve = res;
      $$('#panel-body [data-i]').forEach((b) => b.addEventListener('click', () => { const r = dialogResolve; dialogResolve = null; panel.hidden = true; r(Number(b.dataset.i)); }));
    });
  }
  function dialog(who, text) { openPanel(who, `<p class="say">${esc(text)}</p><div class="row"><button class="btn btn-primary" id="ok" type="button">OK</button></div>`, 'panel-dialog'); $('#ok').addEventListener('click', closePanel); }

  function openHome() {
    const h = HOUSES[S.house];
    const unwatered = S.plot.slice(0, S.plots).filter((p) => p.crop && !p.watered && p.stage < CROPS[p.crop].days).length;
    openPanel(`Your ${h.name.toLowerCase()}`, `
      <p>Day ${S.day}. ${unwatered ? `<b>${unwatered} crop${unwatered > 1 ? 's are' : ' is'} still unwatered</b>. They won't grow tonight.` : 'All planted crops are watered.'}</p>
      <div class="row"><button class="btn btn-primary" id="sleep" type="button">Sleep until tomorrow</button><button class="btn" id="h-stats" type="button">Study stats</button><button class="btn" id="h-save" type="button">Save and transfer</button></div>
      <p class="muted">Sleeping grows every watered crop by one stage and brings new weeds. Your real-life daily streak counts days on which you answer at least one question.</p>`);
    $('#sleep').addEventListener('click', sleep);
    $('#h-stats').addEventListener('click', openStats);
    $('#h-save').addEventListener('click', openSave);
  }

  function openPlant(i) {
    const owned = Object.keys(CROPS).filter((k) => (S.seeds[k] || 0) > 0);
    if (!owned.length) { dialog('Empty seed pouch', 'You have no seeds. Buy some at the General Store (north of the road, with the striped awning).'); return; }
    openPanel('Plant seeds', `<p>Choose what to plant in this plot.</p><div class="grid-list">${owned.map((k) => `<button class="item" data-k="${k}" type="button"><span class="swatch" style="background:${CROPS[k].col}"></span><span><b>${CROPS[k].name}</b><br><small>${S.seeds[k]} seeds · ${CROPS[k].days} watered days · sells for ${CROPS[k].sell}</small></span></button>`).join('')}</div>`);
    $$('#panel-body .item').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.k; S.seeds[k]--; S.plot[i] = { crop: k, stage: 0, watered: false }; save(); closePanel(); toast(`Planted ${CROPS[k].name.toLowerCase()}. Water it by answering a question.`);
    }));
  }

  function openShop(tab) {
    tab = tab || 'seeds';
    const tabs = { seeds: 'Seeds', home: 'Home and tools', decor: 'Town decor' };
    let html = `<div class="tabs" role="tablist">${Object.keys(tabs).map((k) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}" type="button" role="tab" aria-selected="${k === tab}">${tabs[k]}</button>`).join('')}</div><p class="wallet">You have <b>${S.coins}</b> coins</p><div class="grid-list">`;
    const row = (id, title, sub, cost, can, why) => `<button class="item" data-buy="${id}" type="button" ${can ? '' : 'disabled'}><span><b>${title}</b><br><small>${sub}</small></span><span class="price">${why || cost + ' c'}</span></button>`;
    if (tab === 'seeds') {
      for (const k in CROPS) { const c = CROPS[k]; const lock = S.house < c.house; html += row('seed:' + k, `${c.name} seeds`, `Grows after ${c.days} watered days · sells for ${c.sell} · you have ${S.seeds[k] || 0}`, c.cost, !lock && S.coins >= c.cost, lock ? `Needs ${HOUSES[c.house].name}` : null); }
    } else if (tab === 'home') {
      if (S.house < HOUSES.length - 1) { const h = HOUSES[S.house + 1]; html += row('house', `Upgrade to ${h.name}`, 'Unlocks better seeds and a new look for your home', h.cost, S.coins >= h.cost); }
      else html += '<p class="muted">Your manor is fully upgraded.</p>';
      if (S.plots < 12) { const pr = PLOT_PRICES[(S.plots - 4) / 2]; html += row('plots', 'Two more farm plots', `You own ${S.plots} of 12 plots`, pr, S.coins >= pr); }
      if (S.can < CANS.length - 1) { const c = CANS[S.can + 1]; html += row('can', c.name, `+${c.bonus} coins every time you water correctly`, c.cost, S.coins >= c.cost); }
    } else {
      for (const k in DECOR) { const d = DECOR[k]; html += row('decor:' + k, d.name, S.decor[k] ? 'Placed in town' : k === 'orchard' ? 'Shake daily for 15 coins each' : 'Makes the town prettier', d.cost, !S.decor[k] && S.coins >= d.cost, S.decor[k] ? 'Owned' : null); }
    }
    html += '</div>';
    openPanel('General Store', html, 'panel-wide');
    $$('#panel-body .tab').forEach((b) => b.addEventListener('click', () => openShop(b.dataset.tab)));
    $$('#panel-body [data-buy]').forEach((b) => b.addEventListener('click', () => { buy(b.dataset.buy); openShop(tab); }));
  }
  function buy(id) {
    if (id.startsWith('seed:')) { const k = id.slice(5); S.coins -= CROPS[k].cost; S.seeds[k] = (S.seeds[k] || 0) + 1; toast(`Bought 1 ${CROPS[k].name.toLowerCase()} seed`); }
    else if (id === 'house') { S.house++; S.coins -= HOUSES[S.house].cost; toast(`Your home is now a ${HOUSES[S.house].name.toLowerCase()}!`); }
    else if (id === 'plots') { S.coins -= PLOT_PRICES[(S.plots - 4) / 2]; S.plots += 2; toast('Two new plots are ready by your house.'); }
    else if (id === 'can') { S.can++; S.coins -= CANS[S.can].cost; toast(`New ${CANS[S.can].name.toLowerCase()}!`); }
    else if (id.startsWith('decor:')) {
      const k = id.slice(6);
      if (DECOR[k].tiles.some(([x, y]) => (Math.hypot(x * 16 + 8 - P.x, y * 16 + 8 - P.y) < 12))) { toast('Step aside so it can be placed.'); return; }
      S.coins -= DECOR[k].cost; S.decor[k] = true; S.weeds = S.weeds.filter((w) => !DECOR[k].tiles.some(([x, y]) => x === w.x && y === w.y)); toast(`${DECOR[k].name} added to town!`);
    }
    save(); updateHud();
  }

  function openBoard() {
    ensureDaily();
    const rows = GOALS.map((g) => {
      const v = Math.min(g.target, S.daily[g.id] || 0), done = v >= g.target, claimed = S.daily.claimed[g.id];
      return `<div class="goal"><div><b>${g.text}</b><div class="bar"><span style="width:${(v / g.target) * 100}%"></span></div><small>${v} / ${g.target}</small></div>${claimed ? '<span class="price">Claimed</span>' : `<button class="btn ${done ? 'btn-primary' : ''}" data-claim="${g.id}" type="button" ${done ? '' : 'disabled'}>${g.reward} c</button>`}</div>`;
    }).join('');
    openPanel('Notice board', `<p>Daily goals reset each real day. Current study streak: <b>${S.streak.count || 0} day${S.streak.count === 1 ? '' : 's'}</b>.</p>${rows}<p class="muted">Goals track every question: watering, weeds and tutor challenges.</p>`);
    $$('#panel-body [data-claim]').forEach((b) => b.addEventListener('click', () => {
      const g = GOALS.find((x) => x.id === b.dataset.claim); S.daily.claimed[g.id] = true; coins(g.reward, 'daily goal'); save(); openBoard();
    }));
  }

  async function openLibrary() {
    const s = S.study.subject;
    const what = s === 'mix' ? 'all three subjects' : `${Bank.subjects[s].name}, Paper ${paperOf(s)}`;
    const c = await choose('Library', `Study as many questions as you like here. Currently set to ${what}. Each correct answer earns 5 coins plus your combo bonus.`, ['Study 10 questions', 'Study 20 questions', 'Endless (stop any time)', 'Choose subject, paper and topics']);
    if (c === 3) openStudy();
    else if (c >= 0) await runSession('Library study session', [10, 20, Infinity][c], undefined, 5);
  }

  // Study settings: subject, paper, topics.
  function openStudy(subject) {
    subject = subject || (S.study.subject === 'mix' ? 'econ' : S.study.subject);
    const paper = paperOf(subject), sel = selectedTopics(subject);
    const topics = Bank.topics[subject].filter((t) => t.papers.includes(paper));
    const groups = {};
    topics.forEach((t) => (groups[t.group] = groups[t.group] || []).push(t));
    const count = (id) => allItems().filter((q) => q.subject === subject && q.topic === id && q.papers.includes(paper)).length;
    let html = `<div class="tabs" role="tablist">${SUBJECTS.map((k) => `<button class="tab ${k === subject ? 'on' : ''}" data-subj="${k}" type="button">${Bank.subjects[k].name}</button>`).join('')}</div>
      <div class="row wrap"><span class="lbl">Paper</span>${[1, 2].map((p) => `<button class="seg ${p === paper ? 'on' : ''}" data-paper="${p}" type="button">Paper ${p}</button>`).join('')}</div>
      <p class="paper-note">${Bank.subjects[subject].papers[paper]}</p>
      <div class="row wrap"><button class="btn" id="t-all" type="button">All topics</button><button class="btn" id="t-none" type="button">Untick all</button><span class="muted">${sel.length ? sel.length + ' selected' : 'All topics included'}</span></div>
      <div class="topics">`;
    for (const g in groups) {
      html += `<fieldset><legend>${esc(g)}</legend>${groups[g].map((t) => `<label class="topic"><input type="checkbox" data-topic="${t.id}" ${sel.includes(t.id) ? 'checked' : ''}><span>${/^\d/.test(t.id) ? `<span class="tid">${t.id}</span>` : ''}${esc(t.name)}</span><small>${count(t.id)} Qs</small></label>`).join('')}</fieldset>`;
    }
    html += `</div><div class="row wrap sticky-foot"><span class="lbl">Questions in town come from</span>
      ${SUBJECTS.concat('mix').map((k) => `<button class="seg ${S.study.subject === k ? 'on' : ''}" data-use="${k}" type="button">${k === 'mix' ? 'All three (mixed)' : Bank.subjects[k].name}</button>`).join('')}</div>`;
    openPanel('Library · Choose what to study', html, 'panel-wide');
    $$('#panel-body [data-subj]').forEach((b) => b.addEventListener('click', () => openStudy(b.dataset.subj)));
    $$('#panel-body [data-paper]').forEach((b) => b.addEventListener('click', () => { S.study.paper[subject] = Number(b.dataset.paper); save(); updateHud(); openStudy(subject); }));
    $$('#panel-body [data-use]').forEach((b) => b.addEventListener('click', () => { S.study.subject = b.dataset.use; save(); updateHud(); openStudy(b.dataset.use === 'mix' ? subject : b.dataset.use); }));
    const key = subject + '|' + paper;
    $$('#panel-body [data-topic]').forEach((c) => c.addEventListener('change', () => {
      S.study.topics[key] = $$('#panel-body [data-topic]').filter((x) => x.checked).map((x) => x.dataset.topic); save(); updateHud();
      $('#panel-body .muted').textContent = S.study.topics[key].length ? S.study.topics[key].length + ' selected' : 'All topics included';
    }));
    $('#t-all').addEventListener('click', () => { S.study.topics[key] = []; save(); updateHud(); openStudy(subject); });
    $('#t-none').addEventListener('click', () => { S.study.topics[key] = []; $$('#panel-body [data-topic]').forEach((c) => (c.checked = false)); save(); updateHud(); });
  }

  function openStats() {
    const acc = (s) => (s.c + s.w ? Math.round((s.c / (s.c + s.w)) * 100) : null);
    let html = `<div class="stat-row"><div><b>${S.total.c + S.total.w}</b><small>answered</small></div><div><b>${acc(S.total) == null ? '–' : acc(S.total) + '%'}</b><small>accuracy</small></div><div><b>${S.bestCombo}</b><small>best combo</small></div><div><b>${S.streak.count || 0}</b><small>day streak</small></div></div>`;
    const weak = [];
    for (const subj of SUBJECTS) {
      const rows = Bank.topics[subj].map((t) => ({ t, s: S.topicStats[subj + '|' + t.id] })).filter((r) => r.s && r.s.c + r.s.w > 0);
      html += `<h3>${Bank.subjects[subj].name}</h3>`;
      if (!rows.length) { html += '<p class="muted">No questions answered yet.</p>'; continue; }
      html += '<div class="topic-stats">' + rows.map(({ t, s }) => { const a = acc(s); if (s.c + s.w >= 2) weak.push({ subj, t, a }); return `<div class="ts"><span>${esc(t.name)}</span><div class="bar ${a < 50 ? 'bad' : a < 75 ? 'mid' : ''}"><span style="width:${a}%"></span></div><small>${a}% · ${s.c + s.w}</small></div>`; }).join('') + '</div>';
    }
    weak.sort((a, b) => a.a - b.a);
    const top = weak.slice(0, 5).filter((w) => w.a < 80);
    if (top.length) {
      html = `<div class="weak"><b>Weakest topics</b><ul>${top.map((w) => `<li>${Bank.subjects[w.subj].name}: ${esc(w.t.name)} (${w.a}%)</li>`).join('')}</ul><button class="btn btn-primary" id="focus-weak" type="button">Focus on ${Bank.subjects[top[0].subj].name} weak topics</button></div>` + html;
    }
    openPanel('Study stats', html, 'panel-wide');
    const fb = $('#focus-weak');
    if (fb) fb.addEventListener('click', () => {
      const subj = top[0].subj, paper = paperOf(subj);
      const ids = top.filter((w) => w.subj === subj && w.t.papers.includes(paper)).map((w) => w.t.id);
      S.study.subject = subj; S.study.topics[subj + '|' + paper] = ids; save(); updateHud(); closePanel(); toast('Town questions now focus on your weakest topics.');
    });
  }

  // Custom question editor.
  function openEditor(msg) {
    const sub = $('#ed-subj') ? $('#ed-subj').value : 'econ';
    const pap = $('#ed-paper') ? Number($('#ed-paper').value) : 1;
    const typ = $('#ed-type') ? $('#ed-type').value : 'mcq';
    const topicOpts = (s, p) => Bank.topics[s].filter((t) => t.papers.includes(p)).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    const mine = S.custom;
    openPanel('My questions', `
      ${msg ? `<p class="okmsg">${esc(msg)}</p>` : ''}
      <form id="ed" class="ed">
        <div class="ed-grid">
          <label for="ed-subj">Subject<select id="ed-subj">${SUBJECTS.map((k) => `<option value="${k}" ${k === sub ? 'selected' : ''}>${Bank.subjects[k].name}</option>`).join('')}</select></label>
          <label for="ed-paper">Paper<select id="ed-paper"><option value="1" ${pap === 1 ? 'selected' : ''}>Paper 1</option><option value="2" ${pap === 2 ? 'selected' : ''}>Paper 2</option></select></label>
          <label for="ed-topic">Topic<select id="ed-topic">${topicOpts(sub, pap)}</select></label>
          <label for="ed-type">Type<select id="ed-type"><option value="mcq" ${typ === 'mcq' ? 'selected' : ''}>Multiple choice</option><option value="num" ${typ === 'num' ? 'selected' : ''}>Number answer</option><option value="self" ${typ === 'self' ? 'selected' : ''}>Written, self-marked</option></select></label>
        </div>
        <label for="ed-q">Question<textarea id="ed-q" rows="3" required placeholder="Paste or write the question from your notes"></textarea></label>
        <div id="ed-extra"></div>
        <label for="ed-exp">Explanation / notes shown after answering<textarea id="ed-exp" rows="2"></textarea></label>
        <div class="row"><button class="btn btn-primary" type="submit">Add question</button></div>
      </form>
      <h3>Saved (${mine.length})</h3>
      <div class="mine">${mine.length ? mine.map((q, i) => `<div class="mine-row"><span><span class="chip chip-${q.subject}">${SUBJ_SHORT[q.subject]} P${q.papers[0]}</span> ${esc((q.q || q.prompt).replace(/<[^>]+>/g, '').slice(0, 90))}</span><button class="btn btn-small" data-del="${i}" type="button">Delete</button></div>`).join('') : '<p class="muted">Nothing yet. Questions you add appear in town when their subject, paper and topic are selected.</p>'}</div>
      <details class="io"><summary>Import or export my questions</summary><label for="ed-json">Question data (JSON)</label><textarea id="ed-json" rows="4">${esc(JSON.stringify(mine))}</textarea><div class="row"><button class="btn" id="ed-copy" type="button">Copy</button><button class="btn" id="ed-import" type="button">Import (replace)</button></div></details>`, 'panel-wide');
    const extra = () => {
      const t = $('#ed-type').value, x = $('#ed-extra');
      if (t === 'mcq') x.innerHTML = `<fieldset class="opts"><legend>Options (select the correct one)</legend>${[0, 1, 2, 3].map((i) => `<label class="opt-edit"><input type="radio" name="ed-ans" value="${i}" ${i === 0 ? 'checked' : ''} aria-label="Option ${'ABCD'[i]} is correct"><input id="ed-o${i}" placeholder="Option ${'ABCD'[i]}" ${i < 2 ? 'required' : ''}></label>`).join('')}</fieldset>`;
      else if (t === 'num') x.innerHTML = `<div class="ed-grid"><label for="ed-num">Correct answer<input id="ed-num" inputmode="decimal" required></label><label for="ed-tol">Allowed margin<input id="ed-tol" inputmode="decimal" value="0.01"></label></div>`;
      else x.innerHTML = `<label for="ed-pts">Mark scheme points (one per line)<textarea id="ed-pts" rows="4" required></textarea></label>`;
    };
    extra();
    $('#ed-type').addEventListener('change', extra);
    const retopic = () => { $('#ed-topic').innerHTML = topicOpts($('#ed-subj').value, Number($('#ed-paper').value)); };
    $('#ed-subj').addEventListener('change', retopic); $('#ed-paper').addEventListener('change', retopic);
    $('#ed').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('#ed-type').value, q = { id: 'c-' + Date.now(), custom: true, subject: $('#ed-subj').value, papers: [Number($('#ed-paper').value)], topic: $('#ed-topic').value, type: t, q: esc($('#ed-q').value).replace(/\n/g, '<br>'), explain: esc($('#ed-exp').value) };
      if (t === 'mcq') {
        const opts = [0, 1, 2, 3].map((i) => $('#ed-o' + i).value.trim());
        const ans = Number($$('input[name="ed-ans"]').find((r) => r.checked).value);
        if (!opts[ans]) { toast('The option marked correct is empty.'); return; }
        const keep = opts.map((o, i) => ({ o, i })).filter((x) => x.o);
        q.options = keep.map((x) => esc(x.o)); q.answer = keep.findIndex((x) => x.i === ans);
      } else if (t === 'num') { q.answer = Number($('#ed-num').value.replace(/[,$\s]/g, '')); q.tol = Number($('#ed-tol').value) || 0.01; if (isNaN(q.answer)) { toast('Enter a number for the answer.'); return; } }
      else { q.prompt = q.q; q.points = $('#ed-pts').value.split('\n').map((s) => s.trim()).filter(Boolean); }
      S.custom.push(q); save(); openEditor('Question added.');
    });
    $$('#panel-body [data-del]').forEach((b) => b.addEventListener('click', () => { S.custom.splice(Number(b.dataset.del), 1); save(); openEditor('Question deleted.'); }));
    $('#ed-copy').addEventListener('click', () => copyText($('#ed-json')));
    $('#ed-import').addEventListener('click', () => {
      try { const arr = JSON.parse($('#ed-json').value); if (!Array.isArray(arr)) throw 0; S.custom = arr.filter((q) => q && q.subject && q.type && q.topic).map((q) => Object.assign(q, { custom: true, papers: q.papers || [1] })); save(); openEditor(`Imported ${S.custom.length} questions.`); }
      catch (e) { toast('That text is not valid question data.'); }
    });
  }

  function copyText(ta) {
    const done = () => toast('Copied');
    try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast('Selected: press Ctrl+C to copy'); }); }
    catch (e) { ta.select(); toast('Selected: press Ctrl+C to copy'); }
  }

  function openSave() {
    openPanel('Save and transfer', `<p>Your progress saves automatically in this browser. To move it to another device or browser, copy this code and paste it there.</p>
      <label for="save-json">Save code</label><textarea id="save-json" rows="5">${esc(JSON.stringify(S))}</textarea>
      <div class="row"><button class="btn" id="sv-copy" type="button">Copy</button><button class="btn" id="sv-load" type="button">Load pasted code</button></div>
      <h3>Start over</h3><p class="muted">This wipes coins, crops, stats and your own questions.</p><div class="row"><button class="btn btn-danger" id="sv-reset" type="button">Reset progress</button></div>`);
    $('#sv-copy').addEventListener('click', () => copyText($('#save-json')));
    $('#sv-load').addEventListener('click', () => {
      try { const d = JSON.parse($('#save-json').value); if (!d || typeof d.coins !== 'number') throw 0; S = Object.assign(fresh(), d); P.x = S.player.x; P.y = S.player.y; P.dir = DIRS_OK(S.player.dir); save(); updateHud(); closePanel(); toast('Save loaded'); }
      catch (e) { toast('That save code could not be read.'); }
    });
    $('#sv-reset').addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (b.dataset.armed) { S = fresh(); ensureDaily(); P.x = S.player.x; P.y = S.player.y; save(); updateHud(); closePanel(); toast('Fresh start!'); }
      else { b.dataset.armed = '1'; b.textContent = 'Click again to confirm reset'; }
    });
  }

  function openHelp() {
    openPanel('How to play', `
      <div class="help">
        <p><b>Move</b> with the arrow keys (or WASD). <b>Interact</b> with Space, Enter or Z. <b>Esc</b> closes windows.</p>
        <ul>
          <li><b>Plant</b> seeds in your plots, then <b>water</b> each one by answering a question. Wrong answer? You get the explanation and can try a new question.</li>
          <li><b>Sleep</b> at home to start the next day. Watered crops grow one stage. Harvest ripe crops for coins.</li>
          <li><b>Pull weeds</b> (each one is a question) and take <b>daily challenges</b> from the tutors: Prof. Hoot (Economics), Tally (Accounting) and Quill (English).</li>
          <li><b>Study as much as you want</b>: run 10, 20 or endless question sessions in the <b>Library</b>, practise with any tutor after their daily challenge, or <b>fish</b> in the pond or river (every cast is a question).</li>
          <li>Spend coins at the <b>General Store</b> on better seeds, a bigger home, more plots, better watering cans and town decor.</li>
          <li>The <b>Library</b> across the bridge (or key <span class="kbd">T</span>) sets your subject, Paper 1 or 2, and topics. Paper 1 is mostly multiple choice. Paper 2 is structured: calculations, data response and essays you self-mark against a mark scheme.</li>
          <li>Questions you get wrong come back more often until you get them right.</li>
        </ul>
        <p><b>Shortcuts</b>: <span class="kbd">T</span> study topics · <span class="kbd">I</span> stats · <span class="kbd">N</span> add my own questions · <span class="kbd">H</span> help</p>
        <p class="muted">Questions are written for the Cambridge International AS Level syllabuses: Economics 9708 (2026–2028), Accounting 9706 (2026–2028) and English Language 9093 (2024–2026). They are original practice questions in the style of the papers, not past-paper copies.</p>
      </div>`, 'panel-wide');
  }

  // ------------------------------------------------------------------ HUD, toasts, fades
  function level() { return Math.floor(Math.sqrt(S.xp / 50)) + 1; }
  function updateHud() {
    $('#h-coins').textContent = S.coins;
    $('#h-day').textContent = S.day;
    $('#h-streak').textContent = S.streak.count || 0;
    const lv = level(), cur = 50 * (lv - 1) ** 2, nxt = 50 * lv ** 2;
    $('#h-level').textContent = lv;
    $('#h-xp').style.width = ((S.xp - cur) / (nxt - cur)) * 100 + '%';
    const s = S.study.subject;
    if (s === 'mix') $('#h-study').textContent = 'All three subjects · mixed';
    else { const n = selectedTopics(s).length; $('#h-study').textContent = `${Bank.subjects[s].name} · Paper ${paperOf(s)} · ${n ? n + ' topic' + (n > 1 ? 's' : '') : 'all topics'}`; }
    $('#h-study').className = 'study-chip chip-' + s;
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function fade(title, text) {
    const f = $('#fade');
    $('#fade-t').textContent = title; $('#fade-s').textContent = text;
    f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    setTimeout(() => { f.hidden = true; }, 2400);
  }

  // ------------------------------------------------------------------ render
  const hintEl = $('#hint');
  function render(t) {
    const camX = Math.round(clamp(P.x - (VW * TILE) / 2, 0, MW * TILE - VW * TILE));
    const camY = Math.round(clamp(P.y - 8 - (VH * TILE) / 2, 0, MH * TILE - VH * TILE));
    const tx0 = Math.floor(camX / 16), ty0 = Math.floor(camY / 16);
    for (let ty = ty0; ty <= ty0 + VH; ty++) for (let tx = tx0; tx <= tx0 + VW; tx++) {
      if (tx >= MW || ty >= MH) continue;
      drawGround(tx, ty, tx * 16 - camX, ty * 16 - camY, t);
    }
    // ground-level objects
    PLOT_POS.forEach((p, i) => drawPlot(i, p.x * 16 - camX, p.y * 16 - camY, t));
    S.weeds.forEach((w) => drawWeed(w.x * 16 - camX, w.y * 16 - camY));
    // y-sorted objects
    const list = [];
    for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(MH - 1, ty0 + VH + 1); ty++) for (let tx = Math.max(0, tx0 - 1); tx <= Math.min(MW - 1, tx0 + VW + 1); tx++) {
      if (map[ty][tx] === 't') list.push({ y: ty * 16 + 15, d: () => drawTree(tx * 16 - camX, ty * 16 - camY, false) });
    }
    for (const k in DECOR) if (S.decor[k]) {
      if (k === 'fountain') { const [x, y] = DECOR[k].tiles[0]; list.push({ y: y * 16 + 30, d: () => drawFountain(x * 16 - camX, y * 16 - camY, t) }); continue; }
      for (const [x, y] of DECOR[k].tiles) list.push({ y: y * 16 + 14, d: () => (k === 'orchard' ? drawTree(x * 16 - camX, y * 16 - camY, S.fruitDay[`${x},${y}`] !== S.day) : drawDecor(k, x * 16 - camX, y * 16 - camY, t)) });
    }
    const B = BUILDINGS;
    list.push({ y: (B.home.y + B.home.h) * 16, d: () => drawHouse(S.house, B.home.x * 16 - camX, B.home.y * 16 - camY) });
    list.push({ y: (B.shop.y + B.shop.h) * 16, d: () => drawShop(B.shop.x * 16 - camX, B.shop.y * 16 - camY) });
    list.push({ y: (B.library.y + B.library.h) * 16, d: () => drawLibrary(B.library.x * 16 - camX, B.library.y * 16 - camY) });
    list.push({ y: BOARD[1] * 16 + 15, d: () => drawBoard(BOARD[0] * 16 - camX, BOARD[1] * 16 - camY) });
    for (const n of NPCS) list.push({ y: n.y, d: () => n.draw(Math.round(n.x - 8 - camX), Math.round(n.y - 15 - camY), t) });
    const frame = P.moving ? Math.floor(P.anim * 7) % 2 : 0;
    list.push({ y: P.y + 0.5, d: () => drawPerson(Math.round(P.x - 8 - camX), Math.round(P.y - 15 - camY), P.dir, frame, PLAYER_PAL) });
    list.sort((a, b) => a.y - b.y).forEach((o) => o.d());
    // interaction marker
    const tg = !busy && panel.hidden && qm.hidden ? target() : null;
    if (tg) {
      const f = facing();
      const bob = Math.floor(t / 300) % 2;
      if (tg.kind === 'npc') {
        const mx = Math.round(tg.npc.x - camX), my = Math.round(tg.npc.y - 22 - camY);
        R('#2b2233', mx - 3, my - 5 + bob, 7, 7); R('#ffd23f', mx - 2, my - 4 + bob, 5, 5); R('#2b2233', mx, my - 3 + bob, 1, 2); R('#2b2233', mx, my + bob, 1, 1);
      } else {
        // corner brackets around the tile in front of the player
        const x0 = f.tx * 16 - camX - bob, y0 = f.ty * 16 - camY - bob, s2 = 16 + bob * 2, c = '#ffd23f';
        for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x0 + s2 - 1, y0, -1, 1], [x0, y0 + s2 - 1, 1, -1], [x0 + s2 - 1, y0 + s2 - 1, -1, -1]]) {
          R(c, Math.min(cx, cx + dx * 3), cy, 4, 1); R(c, cx, Math.min(cy, cy + dy * 3), 1, 4);
        }
      }
    }
    for (const p of particles) R(p.c, p.x - camX, p.y - camY, 2, 2);
    vctx.drawImage(buf, 0, 0, view.width, view.height);
    const hint = tg ? `Space: ${tg.label}` : 'Arrow keys to move · Space to interact · T to choose topics';
    if (hintEl && hintEl.textContent !== hint) hintEl.textContent = hint;
  }

  // ------------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    if (!qm.hidden && qState) {
      if (qState.answered) { if (e.key === 'Escape' && qState.inSession) { e.preventDefault(); qState.finish(true); return; } if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.id !== 'draft' && document.activeElement.id !== 'q-stop') { e.preventDefault(); qState.finish && qState.finish(false); } return; }
      if (qState.order) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); highlight(qState.sel + 1); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); highlight(qState.sel - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answerMcq(qState.sel); }
        else { const i = 'abcd'.indexOf(e.key.toLowerCase()); const j = '1234'.indexOf(e.key); const k = i >= 0 ? i : j; if (k >= 0 && k < qState.order.length) { e.preventDefault(); answerMcq(k); } }
      }
      return;
    }
    if (!panel.hidden) { if (e.key === 'Escape') { e.preventDefault(); closePanel(); } return; }
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const d = KEYMAP[e.key];
    if (d) { e.preventDefault(); keys.delete(d); keys.add(d); return; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'z' || e.key === 'Z') { e.preventDefault(); interact(); return; }
    const k = e.key.toLowerCase();
    if (k === 't') openStudy(); else if (k === 'i') openStats(); else if (k === 'n') openEditor(); else if (k === 'h' || k === '?') openHelp();
  });
  window.addEventListener('keyup', (e) => { const d = KEYMAP[e.key]; if (d) keys.delete(d); });
  window.addEventListener('blur', () => keys.clear());

  // on-screen pad for touch screens
  $$('[data-pad]').forEach((b) => {
    const d = b.dataset.pad;
    const on = (e) => { e.preventDefault(); if (d === 'act') interact(); else keys.add(d); };
    const off = (e) => { e.preventDefault(); keys.delete(d); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  $('#b-study').addEventListener('click', () => openStudy());
  $('#h-study').addEventListener('click', () => openStudy());
  $('#b-stats').addEventListener('click', openStats);
  $('#b-edit').addEventListener('click', () => openEditor());
  $('#b-help').addEventListener('click', openHelp);

  // ------------------------------------------------------------------ loop
  let last = performance.now(), saveClock = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (panel.hidden && qm.hidden) updatePlayer(dt); else P.moving = false;
    updateNpcs(dt);
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    saveClock += dt;
    if (saveClock > 3) { saveClock = 0; S.player = { x: P.x, y: P.y, dir: P.dir }; save(); }
    render(now);
    requestAnimationFrame(loop);
  }

  function start() {
    fit(); updateHud();
    if (!S.seenHelp) { S.seenHelp = true; save(); openHelp(); }
    requestAnimationFrame(loop);
  }
  if (window.claude && window.claude.hot) window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({}));
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start();
})();
