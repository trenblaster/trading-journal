// Day Trade Arena: the match screen. HUD, watchlist, leaderboard and race, chart and toolbar, order
// ticket, blotter (positions / orders / fills / trades / news), ladder, tape and depth, overlays.
(function () {
  'use strict';
  const DTA = window.DTA;
  const {
    $, $$, el, clamp, fmtMoney, fmtSignedMoney, fmtPct, fmtQty, fmtPrice, fmtClock, fmtDuration, fmtHold, fmtCompactMoney,
    TIMEFRAMES, MODES, DUEL_TYPES, store
  } = DTA;
  const ui = DTA.ui;

  const S = {
    sym: null, bottom: 'pos', board: 'lb', tapeTab: 'tape', mtab: 'chart',
    ticket: { type: 'MKT', qty: 100, qtyStock: 100, qtyFut: 1, px: null, stop: null, trail: null, bracket: false, tp: null, sl: null, pxTouched: false, stopTouched: false },
    tHud: 0, tSlow: 0, tWidgets: 0, lastAcctKey: '', newsSeen: 0, lastPhase: null, watch: null, predictPick: { dir: 0, conf: 1 },
    lbOrder: [], countdownTimer: null, lastCd: null, tapeCount: [], lastFillSound: 0
  };
  let chart, ladder, tape, depth, race, chartEnv;
  const grid = { on: false, charts: [], key: '' };
  const C = () => DTA.app.client;
  const G = () => (C() ? C().game : null);

  // ---------- setup (once) ----------
  function init() {
    const env = {
      sym: () => { const g = G(); return g ? g.syms[S.sym] : null; },
      start: () => G().start, now: () => G().t, speed: () => G().speed,
      orders: (sym) => C().myOrders(sym),
      position: (sym) => C().position(sym),
      fills: (sym) => G().fills.filter((f) => f.sym === sym),
      rivals: (sym) => G().rivalFills.filter((f) => f[2] === sym),
      news: (sym) => G().news.filter((n) => !n.sym || n.sym === sym),
      player: (pid) => C().player(pid),
      days: () => (G() ? G().days : null),
      levels: (sym) => C().levels(sym),
      cal: () => (G() ? G().cal : null),
      ghost: (sym) => ghostPosition(sym),
      refLine: () => refLine(),
      onModify: (id, px) => { C().modify(id, px); DTA.sfx.play('click'); },
      onCancel: (id) => { C().cancel(id); DTA.sfx.play('click'); },
      onContext: (info) => chartMenu(info),
      onAlert: (sym, px) => { ui.toast('🔔 ' + sym + ' crossed ' + fmtPrice(px, G().syms[sym].tick), 'warn', { icon: '🔔' }); DTA.sfx.play('alert'); },
      onToolDone: () => renderTools()
    };
    chartEnv = env;
    chart = new DTA.Chart($('#chart'), env);
    const prefs = DTA.settings;
    if (prefs.ind) Object.assign(chart.show, prefs.ind);
    chart.setType(prefs.chartType || 'candles');
    $('#chartType').value = chart.type;
    ladder = new DTA.Ladder($('#ladder'), {
      sym: env.sym, orders: env.orders, position: env.position,
      onLimit: (side, px) => sendOrder(side, { type: 'LMT', px }),
      onStop: (side, px) => sendOrder(side, { type: 'STP', stop: px }),
      onCancelAt: (sym, px) => { for (const o of C().myOrders(sym)) { const p = o.type === 'LMT' ? o.px : o.stop; if (p && Math.abs(p - px) < 1e-9 + G().syms[sym].tick / 2) C().cancel(o.id); } },
      onScroll: () => {}
    });
    tape = new DTA.Tape($('#tape'), { sym: env.sym, minSize: () => DTA.settings.minPrint || 0 });
    depth = new DTA.Depth($('#depth'), { sym: env.sym });
    race = new DTA.EquityRace($('#raceChart'), {
      hist: () => G() ? G().lbHist : {}, player: (id) => C().player(id), get me() { return C() ? C().me : null; },
      start: () => G().start, end: () => G().end, now: () => G().t, startCash: (id) => { const r = (G().lb || []).find((x) => x.id === id); return r ? r.st : G().settings.startCash; }, live: true
    });
    DTA.emitTheme = () => { chart.refreshTheme(); ladder.refreshTheme(); tape.refreshTheme(); depth.refreshTheme(); race.refreshTheme(); };

    // Toolbar.
    $('#chartType').addEventListener('change', (e) => { chart.setType(e.target.value); DTA.settings.chartType = e.target.value; ui.saveSettings(); });
    buildIndicatorMenu();
    renderTools();
    $('#btnLive').addEventListener('click', () => { chart.resetView(); });
    $('#btnGrid').addEventListener('click', () => toggleGrid());
    $('#btnLevels').addEventListener('click', () => toggleLevels());
    $('#btnToday').addEventListener('click', () => chart.viewToday());
    $('#btnAll').addEventListener('click', () => chart.viewAll());
    $('#btnShot').addEventListener('click', () => snapshot());
    $('#btnWide').addEventListener('click', () => toggleWide());
    if (DTA.settings.wide) toggleWide(true);
    $('#btnDraw').addEventListener('click', (e) => { e.stopPropagation(); $('#drawMenu').hidden = !$('#drawMenu').hidden; $('#indMenu').hidden = true; });
    $('#btnLevels').setAttribute('aria-pressed', String(!!chart.show.levels));
    $('#btnCenter').addEventListener('click', () => ladder.recenter());
    // Tabs.
    for (const b of $$('[data-btab]')) b.addEventListener('click', () => { S.bottom = b.dataset.btab; for (const x of $$('[data-btab]')) x.classList.toggle('active', x === b); if (S.bottom === 'news') { S.newsSeen = G() ? G().news.length : 0; } renderBottom(true); });
    for (const b of $$('[data-boardtab]')) b.addEventListener('click', () => { S.board = b.dataset.boardtab; for (const x of $$('[data-boardtab]')) x.classList.toggle('active', x === b); $('#leaderboard').hidden = S.board !== 'lb'; $('.race-wrap').hidden = S.board !== 'race'; race.dirty = true; });
    for (const b of $$('[data-ttab]')) b.addEventListener('click', () => { S.tapeTab = b.dataset.ttab; for (const x of $$('[data-ttab]')) x.classList.toggle('active', x === b); $('#tape').hidden = S.tapeTab !== 'tape'; $('#depth').hidden = S.tapeTab !== 'depth'; $('#levelsList').hidden = S.tapeTab !== 'levels'; if (S.tapeTab === 'levels') renderLevels(true); });
    $('#levelsList').addEventListener('click', onLevelClick);
    for (const b of $$('.mobile-tabs button')) b.addEventListener('click', () => setMobileTab(b.dataset.mtab));
    for (const b of $$('[data-quick]')) b.addEventListener('click', () => { const k = b.dataset.quick; if (k === 'buy') buy(); else if (k === 'sell') sell(); else flatten(); });
    $('#btnMute').addEventListener('click', () => { DTA.settings.muted = !DTA.settings.muted; ui.saveSettings(); DTA.sfx.unlock(); });
    $('#btnHelpKeys').addEventListener('click', () => ui.keysModal());
    $('#btnMenu').addEventListener('click', (e) => matchMenu(e));
    $('#bottomBody').addEventListener('click', onBottomClick);
    const ro = new ResizeObserver(() => { chart.dirty = true; ladder.dirty = true; race.dirty = true; });
    for (const id of ['#chart', '#ladder', '#tape', '#raceChart', '#depth']) ro.observe($(id));
    S.ticket.qtyStock = DTA.settings.qty || 100;
    S.ticket.qtyFut = DTA.settings.qtyFut || 1;
    S.ticket.qty = S.ticket.qtyStock;
    requestAnimationFrame(frame);
  }

  function buildIndicatorMenu() {
    const menu = $('#indMenu');
    const items = [
      ['vwap', 'VWAP', 'var(--series-4)'], ['vwapBands', 'VWAP ±2σ bands', 'var(--series-4)'], ['ema9', 'EMA 9', 'var(--series-1)'], ['ema20', 'EMA 20', 'var(--series-7)'],
      ['ema50', 'EMA 50', 'var(--series-5)'], ['bb', 'Bollinger 20 2', 'var(--series-3)'], ['vol', 'Volume', 'var(--text-3)'], ['vp', 'Volume profile', 'var(--series-4)'],
      ['heat', 'Liquidity heatmap', 'var(--series-1)'], ['bubbles', 'Big-print bubbles', 'var(--warn)'], ['delta', 'Volume delta pane', 'var(--up)'], ['cvd', 'Cumulative delta (CVD) pane', 'var(--text-2)'],
      ['rsi', 'RSI 14 pane', 'var(--series-7)'], ['macd', 'MACD pane', 'var(--series-1)'], ['fills', 'My fills', 'var(--up)'], ['rivals', "Rivals' fills", 'var(--series-2)'], ['news', 'News flags', 'var(--good)'],
      '-', ['levels', 'Key levels and confluence', 'var(--series-1)'], ['rn', 'Round numbers', 'var(--text-3)'], ['cal', 'Economic calendar', 'var(--warn)'], ['sessions', 'Session shading', 'var(--text-3)'], ['nav', 'Navigator strip', 'var(--accent)']
    ];
    menu.innerHTML = '';
    for (const it of items) {
      if (it === '-') { menu.appendChild(el('div.menu-sep')); continue; }
      const [k, label, color] = it;
      const i = el('input', { type: 'checkbox', checked: !!chart.show[k], dataset: { k } });
      i.addEventListener('change', () => { chart.toggle(k, i.checked); for (const x of grid.charts) x.chart.toggle(k, i.checked); DTA.settings.ind = Object.assign({}, chart.show); ui.saveSettings(); if (k === 'levels') $('#btnLevels').setAttribute('aria-pressed', String(i.checked)); });
      menu.appendChild(el('label', [i, el('span.sw', { style: { background: color } }), label]));
    }
    $('#btnInd').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $('#drawMenu').hidden = true; });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.tb-dropdown')) { menu.hidden = true; $('#drawMenu').hidden = true; } });
  }

  const TOOLS = [['hline', '—', 'Horizontal line', 'H'], ['trend', '╱', 'Trend line', 'T'], ['rect', '▭', 'Rectangle', ''], ['fib', 'Fib', 'Fibonacci retracement', ''], ['measure', '⇕', 'Measure (ticks, $ and time)', ''], ['alert', '🔔', 'Price alert', '']];
  function renderTools() {
    const box = $('#toolGroup');
    box.innerHTML = '';
    for (const [k, icon, name, key] of TOOLS) {
      const b = el('button.tool-item' + (chart && chart.tool === k ? '.active' : ''), { type: 'button', onclick: () => { chart.setTool(chart.tool === k ? null : k); $('#drawMenu').hidden = true; renderTools(); } }, [el('span.ti', icon), el('span', name), key ? el('kbd', key) : null]);
      box.appendChild(b);
    }
    box.appendChild(el('div.menu-sep'));
    box.appendChild(el('button.tool-item', { type: 'button', onclick: () => { chart.clearDrawings(S.sym); $('#drawMenu').hidden = true; } }, [el('span.ti', '🗑'), el('span', 'Clear drawings on this symbol')]));
    const cur = TOOLS.find((x) => chart && x[0] === chart.tool);
    const btn = $('#btnDraw');
    btn.textContent = cur ? '✏️ ' + cur[2].split(' (')[0] + ' ▾' : '✏️ Draw ▾';
    btn.classList.toggle('active', !!cur);
  }
  function toggleLevels(on) {
    const v = on === undefined ? !chart.show.levels : on;
    chart.toggle('levels', v);
    for (const x of grid.charts) x.chart.toggle('levels', v);
    DTA.settings.ind = Object.assign({}, chart.show);
    ui.saveSettings();
    $('#btnLevels').setAttribute('aria-pressed', String(v));
    buildIndicatorMenuState();
  }
  function buildIndicatorMenuState() {
    for (const lab of $$('#indMenu label')) { const i = lab.querySelector('input'); if (i && i.dataset.k) i.checked = !!chart.show[i.dataset.k]; }
  }
  function toggleWide(on) {
    const v = on === undefined ? !$('#game').classList.contains('wide') : on;
    $('#game').classList.toggle('wide', v);
    $('#btnWide').setAttribute('aria-pressed', String(v));
    DTA.settings.wide = v;
    ui.saveSettings();
    chart.dirty = true; ladder.dirty = true;
  }
  function snapshot() {
    const url = chart.snapshotPng();
    if (!url) { ui.toast('Could not capture the chart', 'bad'); return; }
    const a = el('a', { href: url, download: 'day-trade-arena-' + S.sym + '-' + fmtClock(G().t, false).replace(':', '') + '.png' });
    document.body.appendChild(a); a.click(); a.remove();
    ui.toast('Chart saved as a picture', 'good', { icon: '📷' });
  }

  function renderTfs() {
    const box = $('#tfGroup');
    box.innerHTML = '';
    const sel = $('#tfSelect');
    sel.innerHTML = '';
    for (const tf of TIMEFRAMES) {
      const b = el('button' + (chart.tf === tf.sec ? '.active' : ''), { type: 'button', onclick: () => setTf(tf.sec) }, tf.label);
      box.appendChild(b);
      sel.appendChild(el('option', { value: String(tf.sec), selected: chart.tf === tf.sec }, tf.label));
    }
    sel.onchange = () => setTf(+sel.value);
  }
  function setTf(sec) { chart.setTf(sec); for (const x of grid.charts) x.chart.setTf(sec); renderTfs(); }
  function stepTf(d) {
    const i = TIMEFRAMES.findIndex((x) => x.sec === chart.tf);
    setTf(TIMEFRAMES[clamp(i + d, 0, TIMEFRAMES.length - 1)].sec);
  }

  function setMobileTab(t) {
    S.mtab = t;
    $('#game').dataset.mtab = t;
    for (const b of $$('.mobile-tabs button')) b.classList.toggle('active', b.dataset.mtab === t);
    chart.dirty = true; ladder.dirty = true; race.dirty = true;
  }

  // ---------- entering a match ----------
  function enter(g) {
    const c = C();
    S.sym = g.focus;
    S.newsSeen = 0; S.lastAcctKey = ''; S.watch = null; S.predictPick = { dir: 0, conf: 1 }; S.lbOrder = [];
    S.ticket.pxTouched = false; S.ticket.stopTouched = false; S.ticket.px = null; S.ticket.stop = null; S.ticket.tp = null; S.ticket.sl = null;
    chart.setTf(g.predict ? 60 : g.tf);
    chart.resetView();
    chart.setReplay(null);
    if (grid.on && (g.predict || g.symList.length < 2)) toggleGrid(false);
    else if (grid.on) { buildGrid(); toggleGrid(true); }
    ladder.recenter();
    renderTfs();
    const predict = !!g.predict;
    const game = $('#game');
    game.dataset.mode = predict ? 'predict' : g.mode;
    $('#predictPanel').hidden = !predict;
    $('#ticket').hidden = predict;
    for (const p of $$('.ladder-panel, .tape-panel, .bottom-panel')) p.hidden = predict;
    buildWatchlist();
    buildTicket();
    renderLeaderboard(true);
    renderBottom(true);
    renderTicker(true);
    $('#gameChat').innerHTML = '';
    for (const m of c.chat.slice(-60)) ui.appendChat($('#gameChat'), m);
    ui.show('game');
    if (!predict && S.mtab === 'trade' && window.innerWidth < 1000) setMobileTab('chart');
    updatePhase(c.phase, true);
    chart.dirty = true;
    if (!g.newRound) ui.toast(modeTitle(g) + (g.scenario ? ': ' + g.scenario.name : '') + '. Good luck!', 'info', { icon: MODES[g.mode] ? MODES[g.mode].icon : '🏁' });
    if (!g.newRound) setTimeout(maybeCoach, 3800);
    $('#chartInfo').dataset.key = '';
  }

  function modeTitle(g) {
    if (g.duel) return DUEL_TYPES[g.duel].icon + ' ' + DUEL_TYPES[g.duel].name;
    return (MODES[g.mode] || {}).icon + ' ' + (MODES[g.mode] || {}).name;
  }

  // ---------- multi-chart grid ----------
  function buildGrid() {
    const g = G();
    for (const x of grid.charts) x.chart.destroy();
    grid.charts = [];
    const box = $('#chartGrid');
    box.innerHTML = '';
    const n = g.symList.length;
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
    box.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    box.style.gridTemplateRows = 'repeat(' + Math.ceil(n / cols) + ', minmax(0, 1fr))';
    for (const sym of g.symList) {
      const cv = el('canvas', { 'aria-label': sym + ' chart' });
      const cell = el('div.cell' + (sym === S.sym ? '.focus' : ''), { dataset: { sym }, title: 'Click to trade ' + sym + ' · double-click to open it full size' }, [cv]);
      const env = Object.assign({}, chartEnv, { sym: () => (G() ? G().syms[sym] : null), onContext: null, onToolDone: null, ghost: null, refLine: null });
      const ch = new DTA.Chart(cv, env);
      ch.setTf(chart.tf);
      Object.assign(ch.show, chart.show, { rsi: false, macd: false, delta: false, cvd: false, nav: false });
      ch.setType(chart.type);
      cell.addEventListener('click', () => { focus(sym); for (const x of grid.charts) x.cell.classList.toggle('focus', x.sym === sym); });
      cell.addEventListener('dblclick', () => { focus(sym); toggleGrid(false); });
      box.appendChild(cell);
      grid.charts.push({ sym, chart: ch, cell });
    }
    grid.key = g.symList.join(',') + ':' + (g.symList.length && g.syms[g.symList[0]].uid);
  }
  function toggleGrid(on) {
    const g = G();
    if (!g) return;
    grid.on = on === undefined ? !grid.on : on;
    if (grid.on && (grid.key !== g.symList.join(',') + ':' + (g.symList.length && g.syms[g.symList[0]].uid) || !grid.charts.length)) buildGrid();
    if (grid.on) for (const x of grid.charts) { x.chart.setTf(chart.tf); Object.assign(x.chart.show, chart.show, { rsi: false, macd: false, delta: false, cvd: false, nav: false }); x.chart.setType(chart.type); x.chart.dirty = true; }
    $('#chartGrid').hidden = !grid.on;
    $('#chart').style.visibility = grid.on ? 'hidden' : '';
    $('#btnGrid').setAttribute('aria-pressed', String(grid.on));
    chart.dirty = true;
  }

  // ---------- watchlist ----------
  function buildWatchlist() {
    const g = G();
    const box = $('#watchlist');
    box.innerHTML = '';
    g.symList.forEach((sym, k) => {
      const s = g.syms[sym];
      const row = el('div.wl-row', { dataset: { sym }, role: 'button', tabindex: 0, title: s.name + ' · ' + (s.runner ? s.runner.catalyst : s.desc) + ' (key ' + (k + 1) + ')' }, [
        el('div.wl-sym', sym), el('canvas.wl-spark'), el('div.wl-px'), el('div.wl-name', s.name), el('div.wl-chg'), el('div.wl-flags')
      ]);
      row.addEventListener('click', () => focus(sym));
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') focus(sym); });
      box.appendChild(row);
    });
    $('#wlNote').textContent = g.symList.length + (g.symList.length === 1 ? ' symbol' : ' symbols');
    updateWatchlist();
  }
  function watchPrice(row, s, th) {
    const px = s.last * s.tick, prev = s.prev * s.tick;
    const ch = px / prev - 1;
    const pxEl = row.querySelector('.wl-px'), chg = row.querySelector('.wl-chg');
    const txt = fmtPrice(px, s.tick);
    if (pxEl.textContent === txt) return;
    pxEl.textContent = txt;
    chg.textContent = fmtPct(ch);
    // Heat: tint strength grows with the move (full at ±6%); the signed number carries the meaning.
    const a = Math.min(0.55, Math.abs(ch) / 0.06 * 0.55);
    if (typeof th === 'function') th = th();
    chg.style.background = DTA.alpha(ch >= 0 ? th.up : th.down, a);
    chg.style.color = a > 0.3 ? '#fff' : ch >= 0 ? th.up : th.down;
  }

  function updateWatchlist() {
    const g = G();
    if (!g) return;
    const th = DTA.chartTheme();
    for (const row of $$('#watchlist .wl-row')) {
      const s = g.syms[row.dataset.sym];
      if (!s) continue;
      row.classList.toggle('active', row.dataset.sym === S.sym);
      watchPrice(row, s, th);
      const flags = row.querySelector('.wl-flags');
      flags.innerHTML = '';
      if (s.halted) flags.appendChild(el('span.wl-badge.halt', 'HALT'));
      if (s.ssr) flags.appendChild(el('span.wl-badge.ssr', { title: 'Short sale restriction: down 10% on the day' }, 'SSR'));
      const sk = s.meta ? DTA.levels.sessionAt(s.meta, g.t) : 'rth';
      if (sk === 'pre' || sk === 'on') flags.appendChild(el('span.wl-badge.sess', { title: sk === 'on' ? 'Overnight (Globex) session' : 'Premarket' }, sk === 'on' ? 'ON' : 'PM'));
      if (s.kind === 'future') flags.appendChild(el('span.wl-badge.fut', { title: s.name }, s.micro ? 'MICRO' : 'FUT'));
      const pos = C().position(s.sym);
      if (pos && pos.qty) flags.appendChild(el('span.wl-badge.' + (pos.qty > 0 ? 'posL' : 'posS'), (pos.qty > 0 ? 'L ' : 'S ') + fmtQty(Math.abs(pos.qty))));
      DTA.drawSpark(row.querySelector('canvas'), s, th);
    }
  }

  function focus(sym) {
    const g = G();
    if (!g || !g.syms[sym] || sym === S.sym) return;
    S.sym = sym;
    C().setFocus(sym);
    S.ticket.pxTouched = false; S.ticket.stopTouched = false; S.ticket.px = null; S.ticket.stop = null; S.ticket.tp = null; S.ticket.sl = null;
    chart.resetView();
    ladder.recenter();
    buildTicket();
    updateWatchlist();
    chart.dirty = true;
  }

  // ---------- leaderboard ----------
  function boardRows() {
    const g = G(), c = C();
    const rows = (g.lb || []).map((r) => ({ r, p: c.player(r.id) })).filter((x) => x.p);
    const sc = g.score || {};
    if (g.duel === 'predict') rows.sort((a, b) => (sc[b.r.id] ? sc[b.r.id].pts : 0) - (sc[a.r.id] ? sc[a.r.id].pts : 0));
    else if (g.duel === 'scalp') rows.sort((a, b) => ((sc[b.r.id] || {}).wins || 0) - ((sc[a.r.id] || {}).wins || 0) || (b.r.eq - a.r.eq));
    else rows.sort((a, b) => (a.r.out - b.r.out) || (b.r.eq - a.r.eq));
    return rows;
  }
  function renderLeaderboard(force) {
    const g = G(), c = C();
    if (!g) return;
    const list = $('#leaderboard');
    const rows = boardRows();
    const order = rows.map((x) => x.r.id).join(',');
    // Danger zone in Knockout: the lowest live account right now.
    let danger = null;
    if (g.mode === 'elim') {
      const alive = rows.filter((x) => !x.r.out);
      if (alive.length > 1) danger = alive.reduce((a, b) => (b.r.eq < a.r.eq ? b : a)).r.id;
    }
    // FLIP animation when ranks change.
    const before = new Map();
    for (const li of list.children) before.set(li.dataset.pid, li.getBoundingClientRect().top);
    if (force || order !== S.lbOrder) {
      list.innerHTML = '';
      for (const { r, p } of rows) {
        const li = el('li.lb-row', { dataset: { pid: r.id } }, [el('span.lb-rank'), el('span.lb-av', { style: { '--c': p.color } }, p.avatar), el('div.lb-name', [el('b'), el('small')]), el('div.lb-val', [el('b'), el('small')])]);
        li.addEventListener('click', () => watchPlayer(r.id));
        list.appendChild(li);
      }
      S.lbOrder = order;
    }
    rows.forEach(({ r, p }, i) => {
      const li = list.children[i];
      if (!li) return;
      li.classList.toggle('me', r.id === c.me);
      li.classList.toggle('out', !!r.out);
      li.classList.toggle('danger', r.id === danger);
      li.classList.toggle('clickable', r.id !== c.me && g.settings.rivals === 'live');
      li.querySelector('.lb-rank').textContent = r.out ? '✕' : String(i + 1);
      li.querySelector('.lb-name b').textContent = p.name + (r.id === c.me ? ' (you)' : '');
      let sub = '';
      if (r.out) sub = p.outReason || 'Out';
      else if (r.b) sub = 'Busted';
      else if (r.pos && r.pos.length) sub = r.pos.map((x) => (x[1] > 0 ? 'L ' : 'S ') + fmtQty(Math.abs(x[1])) + ' ' + x[0]).join(', ');
      else if (r.pos) sub = 'Flat · ' + r.n + ' fills';
      else sub = p.isBot ? p.style : r.n + ' fills';
      if (r.mc) sub += ' · 💀×' + r.mc;
      li.querySelector('.lb-name small').textContent = sub;
      const vb = li.querySelector('.lb-val b'), vs = li.querySelector('.lb-val small');
      const sc = (g.score || {})[r.id] || {};
      if (g.duel === 'predict') { vb.textContent = (sc.pts || 0) + ' pts'; vs.textContent = sc.streak ? '🔥 ' + sc.streak : (sc.correct || 0) + '/' + (sc.calls || 0); vs.className = ''; }
      else if (g.duel === 'scalp') { vb.textContent = (sc.wins || 0) + ' 🏅'; const pnl = (sc.pnl || 0) + (r.eq - r.st); vs.textContent = fmtSignedMoney(pnl, 0); vs.className = pnl >= 0 ? 'pos' : 'neg'; }
      else { vb.textContent = fmtCompactMoney(r.eq); const ret = r.eq / r.st - 1; vs.textContent = fmtPct(ret); vs.className = ret >= 0 ? 'pos' : 'neg'; }
    });
    if (!DTA.fx.reduced()) {
      for (const li of list.children) {
        const b = before.get(li.dataset.pid);
        if (b === undefined) continue;
        const d = b - li.getBoundingClientRect().top;
        if (Math.abs(d) > 2) { li.style.transition = 'none'; li.style.transform = 'translateY(' + d + 'px)'; requestAnimationFrame(() => { li.style.transition = ''; li.style.transform = ''; }); }
      }
    }
  }

  function emotePop(pid, e) {
    const li = $('#leaderboard .lb-row[data-pid="' + pid + '"]');
    if (li) { const pop = el('span.emote-pop', e); li.appendChild(pop); setTimeout(() => pop.remove(), 1700); }
    const p = C().player(pid);
    if (p && pid !== C().me && ui) { /* shown on the board; chat stays for words */ }
  }

  function watchPlayer(pid) {
    const c = C(), g = G();
    if (pid === c.me) { S.watch = null; c.watch(null); updateSpectate(); return; }
    if (g.settings.rivals !== 'live') { ui.toast("The host hid rivals' positions in this match.", 'info'); return; }
    S.watch = S.watch === pid ? null : pid;
    c.watch(S.watch);
    updateSpectate();
    chart.dirty = true;
  }
  function ghostPosition(sym) {
    const g = G(), c = C();
    if (!S.watch || !g.watch || g.watch.pid !== S.watch || !g.watch.v) return null;
    const p = c.player(S.watch);
    const pos = g.watch.v.pos.find((x) => x[0] === sym);
    if (!p || !pos || !pos[1]) return null;
    return { qty: pos[1], avg: pos[2], color: p.color, name: p.avatar + ' ' + p.name };
  }
  function refLine() {
    const g = G();
    if (!g || !g.predict || g.predict.ref === null || g.predict.ref === undefined || C().phase === 'call') return null;
    const s = g.syms[S.sym];
    return s ? { price: g.predict.ref * s.tick, label: 'Call price' } : null;
  }

  function updateSpectate() {
    const c = C(), bar = $('#spectateBar');
    const g = G();
    if (!g) return;
    const out = c.amOut();
    const part = c.isParticipant();
    let text = '';
    if (!part) text = g.round > 1 || C().phase !== 'countdown' ? '👀 You joined mid-match, so you are watching. You get a seat in the next game.' : '👀 You are watching this match. All seats were taken.';
    else if (out) { const p = c.player(c.me); text = '🥊 You are out: ' + ((p && p.outReason) || 'eliminated') + '. Click a trader on the leaderboard to follow their position.'; }
    if (S.watch) {
      const p = c.player(S.watch);
      if (p) text = (text ? text + ' · ' : '') + 'Watching ' + p.avatar + ' ' + p.name + ' (click again to stop)';
    }
    bar.hidden = !text;
    bar.textContent = text;
    $('#ticket').classList.toggle('disabled', !part || out);
  }

  // ---------- ticket ----------
  function buildTicket() {
    const g = G();
    const box = $('#ticket');
    box.innerHTML = '';
    if (!g || g.predict) return;
    const s = g.syms[S.sym];
    const t = S.ticket;
    const fut = s.kind === 'future';
    t.qty = fut ? t.qtyFut : t.qtyStock;
    const types = [['MKT', 'Market'], ['LMT', 'Limit'], ['STP', 'Stop'], ['STPLMT', 'Stop lmt'], ['TRAIL', 'Trail']];
    const seg = el('div.seg.tk-types', { role: 'group', 'aria-label': 'Order type' });
    for (const [k, label] of types) {
      const b = el('button' + (t.type === k ? '.active' : ''), { type: 'button', onclick: () => { t.type = k; buildTicket(); } }, label);
      seg.appendChild(b);
    }
    const numInput = (id, val, step, onset, label) => {
      const inp = el('input', { id, inputmode: 'decimal', value: val === null || val === undefined ? '' : val, 'aria-label': label, autocomplete: 'off' });
      inp.addEventListener('input', () => onset(inp.value));
      const dec = el('button', { type: 'button', 'aria-label': 'Decrease ' + label, onclick: () => { onset(String(Math.max(0, (+inp.value || 0) - step))); inp.value = formatStep(Math.max(0, (+inp.value || 0) - step), step); } }, '−');
      const inc = el('button', { type: 'button', 'aria-label': 'Increase ' + label, onclick: () => { onset(String((+inp.value || 0) + step)); inp.value = formatStep((+inp.value || 0) + step, step); } }, '+');
      return el('div.tk-input', [dec, inp, inc]);
    };
    const qtyStep = qtyStepFor(s);
    const qtyBox = numInput('tkQty', t.qty, qtyStep, (v) => { setQty(Math.max(0, Math.floor(+v || 0)), true); }, fut ? 'Contracts' : 'Shares');
    const presets = el('div.tk-presets');
    const quick = fut ? [1, 2, 3, 5, 10] : s.last * s.tick < 20 ? [100, 500, 1000, 5000, 10000] : [10, 50, 100, 500, 1000];
    for (const q of quick) presets.appendChild(el('button', { type: 'button', onclick: () => setQty(q) }, fmtQty(q)));
    for (const f of [0.25, 0.5, 1]) presets.appendChild(el('button', { type: 'button', title: fut ? 'Share of your free margin' : 'Share of your remaining buying power', onclick: () => setQty(maxQty(f)) }, f === 1 ? 'Max' : Math.round(f * 100) + '%'));
    box.appendChild(el('div.tk-row', [el('b', S.sym), fut ? el('span.pill.fut', s.micro ? 'Micro' : 'Future') : null, el('span.muted.small', { id: 'tkQuote' }, '')]));
    if (fut) box.appendChild(el('div.tk-spec', futSpec(s)));
    box.appendChild(seg);
    box.appendChild(el('div.tk-row', [el('span.tk-label', fut ? 'Contracts' : 'Shares'), qtyBox]));
    box.appendChild(presets);
    const tick = s.tick;
    if (t.type === 'LMT' || t.type === 'STPLMT') {
      if (!t.pxTouched || t.px === null) t.px = +(s.last * tick).toFixed(DTA.decimalsForTick(tick));
      const pxBox = numInput('tkPx', t.px, tick, (v) => { t.px = +v || null; t.pxTouched = true; refreshTicket(); }, 'Limit price');
      box.appendChild(el('div.tk-row', [el('span.tk-label', 'Limit'), pxBox]));
      const q = el('div.tk-presets');
      for (const [k, label] of [['bid', 'Bid'], ['mid', 'Mid'], ['ask', 'Ask'], ['last', 'Last']]) q.appendChild(el('button', { type: 'button', onclick: () => { t.px = quotePx(k); t.pxTouched = true; $('#tkPx').value = fmtPrice(t.px, tick); refreshTicket(); } }, label));
      box.appendChild(q);
    }
    if (t.type === 'STP' || t.type === 'STPLMT') {
      if (!t.stopTouched || t.stop === null) t.stop = +(s.last * tick).toFixed(DTA.decimalsForTick(tick));
      box.appendChild(el('div.tk-row', [el('span.tk-label', 'Stop'), numInput('tkStop', t.stop, tick, (v) => { t.stop = +v || null; t.stopTouched = true; refreshTicket(); }, 'Stop price')]));
    }
    if (t.type === 'TRAIL') {
      if (!t.trail) t.trail = +(Math.max(tick * 5, s.last * tick * 0.004)).toFixed(DTA.decimalsForTick(tick));
      box.appendChild(el('div.tk-row', [el('span.tk-label', 'Trail $'), numInput('tkTrail', t.trail, tick, (v) => { t.trail = +v || null; refreshTicket(); }, 'Trailing amount')]));
    }
    if (t.type !== 'TRAIL') {
      const chk = el('input', { type: 'checkbox', checked: t.bracket, onchange: (e) => { t.bracket = e.target.checked; buildTicket(); } });
      const auto = el('button.btn.tiny', { type: 'button', title: 'Take-profit 2× and stop 1× the current candle range (ATR)', onclick: () => { autoBracket(); } }, 'Auto');
      box.appendChild(el('div.tk-row', [el('label.toggle', [chk, 'Bracket (take-profit + stop-loss)']), t.bracket ? auto : null]));
      if (t.bracket) {
        if (t.tp === null || t.sl === null) autoBracket(true);
        box.appendChild(el('div.tk-bracket', [
          el('span.tk-label', 'TP'), el('input', { id: 'tkTp', inputmode: 'decimal', value: t.tp === null ? '' : t.tp, 'aria-label': 'Take profit price (for a buy)', oninput: (e) => { t.tp = +e.target.value || null; t.bRef = entryNow(); refreshTicket(); } }),
          el('span.muted.small', 'profit (buy)'),
          el('span.tk-label', 'SL'), el('input', { id: 'tkSl', inputmode: 'decimal', value: t.sl === null ? '' : t.sl, 'aria-label': 'Stop loss price (for a buy)', oninput: (e) => { t.sl = +e.target.value || null; t.bRef = entryNow(); refreshTicket(); } }),
          el('span.muted.small', 'stop (buy)')
        ]));
        box.appendChild(el('p.muted.small', { style: { margin: 0 } }, 'Prices are for a buy. A sell mirrors them around the entry.'));
      }
    }
    box.appendChild(el('div.tk-risk', { id: 'tkRisk' }));
    box.appendChild(el('div.tk-actions', [
      el('button.btn.buy', { id: 'tkBuy', type: 'button', onclick: () => buy() }, ['Buy', el('small')]),
      el('button.btn.sell', { id: 'tkSell', type: 'button', onclick: () => sell() }, ['Sell / Short', el('small')])
    ]));
    box.appendChild(el('div.tk-quick', [
      el('button.btn.small', { type: 'button', title: 'Close this position at market (F)', onclick: () => flatten() }, 'Flatten'),
      el('button.btn.small', { type: 'button', title: 'Flip the position (R)', onclick: () => reverse() }, 'Reverse'),
      el('button.btn.small', { type: 'button', title: 'Cancel orders on this symbol (C)', onclick: () => cancelAll() }, 'Cancel all')
    ]));
    if (window.innerWidth < 1000) box.appendChild(el('div.tk-pos', { id: 'tkPos' }));
    refreshTicket();
    updateSpectate();
  }
  let qtySaveTimer = null;
  function saveQtySoon() { clearTimeout(qtySaveTimer); qtySaveTimer = setTimeout(() => ui.saveSettings(), 800); }
  function formatStep(v, step) { return step < 1 ? v.toFixed(Math.max(2, DTA.decimalsForTick(step))) : String(Math.round(v)); }
  function setQty(q, typed) {
    const t = S.ticket;
    const g = G();
    const fut = g && g.syms[S.sym] && g.syms[S.sym].kind === 'future';
    t.qty = Math.max(0, Math.floor(q));
    if (fut) { t.qtyFut = t.qty; DTA.settings.qtyFut = t.qty; } else { t.qtyStock = t.qty; DTA.settings.qty = t.qty; }
    saveQtySoon();
    const i = $('#tkQty');
    if (i && !typed) i.value = t.qty;
    refreshTicket();
  }
  function qtyStepFor(s) { return s.kind === 'future' ? 1 : s.last * s.tick < 20 ? 100 : 10; }
  // Contract facts: tick size and value, point value, margin.
  function futSpec(s) {
    const tv = s.tick * s.mult;
    return 'Tick ' + fmtPrice(s.tick, s.tick) + ' = ' + fmtMoney(tv, tv < 10 ? 2 : 2) + ' · ' + fmtMoney(s.mult, 0) + ' a point · margin ' + fmtMoney(s.margin || 0, 0) + ' a contract';
  }
  function quotePx(k) {
    const s = G().syms[S.sym];
    const b = s.bid !== null ? s.bid : s.last, a = s.ask !== null ? s.ask : s.last;
    const idx = k === 'bid' ? b : k === 'ask' ? a : k === 'mid' ? Math.round((a + b) / 2) : s.last;
    return +(idx * s.tick).toFixed(DTA.decimalsForTick(s.tick));
  }
  function maxQty(f) {
    const g = G();
    const a = g.acct;
    if (!a) return 0;
    const s = g.syms[S.sym];
    const px = s.last * s.tick;
    const free = Math.max(0, a.free !== undefined ? a.free : (a.bp - a.used) / a.lev);
    let q;
    if (s.kind === 'future') q = Math.floor((free * f) / Math.max(1, s.margin || 1));
    else q = (free * a.lev * f) / px;
    if (s.maxQty) q = Math.min(q, s.maxQty);
    if (s.kind !== 'future') q = px < 20 ? Math.floor(q / 100) * 100 : Math.floor(q);
    return Math.max(0, q);
  }
  // Average true range of the chart's candles (history included), for bracket distances.
  function atrNow() {
    const s = G().syms[S.sym];
    const d = chart.data();
    const bars = d && d.sym === s ? d.bars.slice(-40) : DTA.ind.aggregate(s.bars.slice(-Math.round(chart.tf / DTA.BAR_SEC) * 30), s.tick, 0, chart.tf, 0);
    const a = DTA.ind.atr(bars, 14);
    return Math.max(s.tick * 4, a[a.length - 1] || s.tick * 10);
  }
  function entryNow() {
    const t = S.ticket;
    const s = G().syms[S.sym];
    return t.type === 'LMT' || t.type === 'STPLMT' ? (t.px || s.last * s.tick) : t.type === 'STP' ? (t.stop || s.last * s.tick) : s.last * s.tick;
  }
  function autoBracket(silent) {
    const t = S.ticket;
    const s = G().syms[S.sym];
    const entry = entryNow();
    const atr = atrNow();
    const dp = DTA.decimalsForTick(s.tick);
    t.tp = +(entry + 2 * atr).toFixed(dp);
    t.sl = +(entry - 1 * atr).toFixed(dp);
    t.bRef = entry;
    if (!silent) buildTicket();
  }
  // Bracket prices are written for a buy at the entry they were set against. They keep their distances
  // when the entry moves, and mirror around the entry for a sell.
  function bracketFor(side, entry) {
    const t = S.ticket;
    if (!t.bracket || t.type === 'TRAIL') return {};
    const s = G().syms[S.sym];
    const dp = DTA.decimalsForTick(s.tick);
    const ref = t.bRef === null || t.bRef === undefined ? entry : t.bRef;
    const tpD = t.tp !== null ? t.tp - ref : null, slD = t.sl !== null ? ref - t.sl : null;
    const r = (v) => +(Math.round(v / s.tick) * s.tick).toFixed(dp);
    return { tp: tpD !== null && tpD > 0 ? r(entry + side * tpD) : null, sl: slD !== null && slD > 0 ? r(entry - side * slD) : null };
  }

  function refreshTicket() {
    const g = G();
    if (!g || g.predict) return;
    const s = g.syms[S.sym];
    const t = S.ticket;
    const tick = s.tick;
    const q = $('#tkQuote');
    if (q) q.textContent = 'Bid ' + (s.bid !== null ? fmtPrice(s.bid * tick, tick) : '—') + ' · Ask ' + (s.ask !== null ? fmtPrice(s.ask * tick, tick) : '—') + (s.halted ? ' · HALTED' : '');
    if (!t.pxTouched && (t.type === 'LMT' || t.type === 'STPLMT')) { t.px = +(s.last * tick).toFixed(DTA.decimalsForTick(tick)); const i = $('#tkPx'); if (i && document.activeElement !== i) i.value = fmtPrice(t.px, tick); }
    if (!t.stopTouched && (t.type === 'STP' || t.type === 'STPLMT')) { t.stop = +(s.last * tick).toFixed(DTA.decimalsForTick(tick)); const i = $('#tkStop'); if (i && document.activeElement !== i) i.value = fmtPrice(t.stop, tick); }
    const how = t.type === 'MKT' ? '@ MKT' : t.type === 'LMT' ? '@ ' + fmtPrice(t.px, tick) : t.type === 'STP' ? 'stop ' + fmtPrice(t.stop, tick) : t.type === 'STPLMT' ? 'stop ' + fmtPrice(t.stop, tick) + ' lmt ' + fmtPrice(t.px, tick) : 'trail ' + fmtPrice(t.trail, tick);
    const bs = $('#tkBuy small'), ss = $('#tkSell small');
    if (bs) bs.textContent = fmtQty(t.qty) + ' ' + how;
    if (ss) ss.textContent = fmtQty(t.qty) + ' ' + how;
    const risk = $('#tkRisk');
    if (risk) {
      const entry = t.type === 'LMT' || t.type === 'STPLMT' ? t.px : t.type === 'STP' ? t.stop : s.last * tick;
      const mult = s.mult || 1;
      const cost = t.qty * (entry || 0) * mult;
      const a = g.acct;
      let text;
      if (s.kind === 'future') {
        const perTick = t.qty * tick * mult;
        text = 'Notional ' + fmtCompactMoney(cost) + ' · ' + fmtMoney(perTick, 2) + ' a tick · margin ' + fmtCompactMoney(t.qty * (s.margin || 0)) + (a ? ' · max ' + maxQty(1) + ' more' : '');
      } else text = 'Size ' + fmtCompactMoney(cost) + (a ? ' · BP left ' + fmtCompactMoney(Math.max(0, a.bp - a.used)) : '');
      if (t.bracket && t.tp && t.sl && entry) {
        const bk = bracketFor(1, entry);
        const r = Math.abs(entry - (bk.sl || entry)) * t.qty * mult, w = Math.abs((bk.tp || entry) - entry) * t.qty * mult;
        const eq = C().equity() || 1;
        text = 'Risk ' + fmtMoney(r, 0) + ' (' + fmtPct(r / eq, 2, false) + ') · Reward ' + fmtMoney(w, 0) + ' · R:R ' + (r ? (w / r).toFixed(1) : '—');
      }
      if (s.htb) text += ' · Borrow $' + (s.borrowFee || 0).toFixed(2) + '/sh' + (s.noLocate ? ' (none left)' : '');
      if (s.ssr) text += ' · SSR: shorts only on a limit above the bid';
      risk.textContent = text;
    }
    const pos = C().position(S.sym);
    const pb = $('#tkPos');
    if (pb) {
      if (pos && pos.qty) {
        const u = pos.qty * (s.last * tick - pos.avg) * (s.mult || 1);
        pb.innerHTML = '';
        pb.append((pos.qty > 0 ? 'Long ' : 'Short ') + fmtQty(Math.abs(pos.qty)) + ' @ ' + fmtPrice(pos.avg, tick) + ' · open ');
        pb.appendChild(el('b.' + (u >= 0 ? 'pos' : 'neg'), fmtSignedMoney(u)));
        pb.append(' · closed ' + fmtSignedMoney(pos.realized));
      } else pb.textContent = 'Flat in ' + S.sym + (pos && pos.realized ? ' · closed ' + fmtSignedMoney(pos.realized) : '');
    }
    const qq = $('#quickQty');
    if (qq) qq.textContent = fmtQty(t.qty);
  }

  function sendOrder(side, over) {
    const c = C(), g = G();
    if (!g || !c.isParticipant() || c.amOut()) { ui.toast('You are not trading in this match', 'warn'); return; }
    const t = S.ticket;
    const req = Object.assign({ sym: S.sym, side, type: t.type, qty: t.qty, px: t.px, stop: t.stop, trail: t.trail }, over || {});
    if (!(req.qty > 0)) { ui.toast('Set a quantity first', 'warn'); return; }
    if (!over) {
      const s = g.syms[S.sym];
      const entry = req.type === 'LMT' || req.type === 'STPLMT' ? req.px : req.type === 'STP' ? req.stop : s.last * s.tick;
      Object.assign(req, bracketFor(side, entry));
    }
    c.order(req);
    DTA.sfx.play(side > 0 ? 'buy' : 'sell');
  }
  function buy() { sendOrder(1); }
  function sell() { sendOrder(-1); }
  function flatten(all) { C().flatten(all ? null : S.sym); DTA.sfx.play('click'); }
  function reverse() { C().reverse(S.sym); DTA.sfx.play('click'); }
  function cancelAll() { C().cancelAll(S.sym); DTA.sfx.play('click'); }
  function limitAt(side) { sendOrder(side, { type: 'LMT', px: quotePx(side > 0 ? 'bid' : 'ask') }); }

  function chartMenu(info) {
    const g = G();
    const s = g.syms[S.sym];
    const px = +(Math.round(info.px / s.tick) * s.tick).toFixed(DTA.decimalsForTick(s.tick));
    const last = s.last * s.tick;
    const P = fmtPrice(px, s.tick);
    const q = fmtQty(S.ticket.qty);
    const items = [];
    if (px < last) {
      items.push({ label: 'Buy limit ' + q + ' @ ' + P, run: () => sendOrder(1, { type: 'LMT', px }) });
      items.push({ label: 'Sell stop ' + q + ' @ ' + P, run: () => sendOrder(-1, { type: 'STP', stop: px }) });
    } else {
      items.push({ label: 'Sell limit ' + q + ' @ ' + P, run: () => sendOrder(-1, { type: 'LMT', px }) });
      items.push({ label: 'Buy stop ' + q + ' @ ' + P, run: () => sendOrder(1, { type: 'STP', stop: px }) });
    }
    items.push('-');
    items.push({ label: 'Alert when price crosses ' + P, run: () => { chart.list(s.sym).push({ id: DTA.uid('d'), type: 'alert', p1: { t: g.t, price: px } }); chart.saveDrawings(); chart.dirty = true; } });
    items.push({ label: 'Horizontal line @ ' + P, run: () => { chart.list(s.sym).push({ id: DTA.uid('d'), type: 'hline', p1: { t: g.t, price: px } }); chart.saveDrawings(); chart.dirty = true; } });
    items.push({ label: 'Set ticket limit price to ' + P, run: () => { S.ticket.px = px; S.ticket.pxTouched = true; if (S.ticket.type === 'MKT') S.ticket.type = 'LMT'; buildTicket(); } });
    ui.ctxMenu(items, info.clientX, info.clientY);
  }

  function matchMenu(e) {
    const c = C();
    const r = e.target.getBoundingClientRect();
    const items = [
      { label: 'How to play', run: () => ui.helpModal() },
      { label: 'Hotkeys', hint: '?', run: () => ui.keysModal() },
      { label: 'Settings', run: () => ui.settingsModal() },
      '-',
      { label: 'Copy room code (' + c.code + ')', run: async () => { if (await ui.copyText(c.code)) ui.toast('Copied', 'good'); } }
    ];
    if (c.isHost) {
      const others = [...(c.players || new Map()).values()].some((p) => !p.isBot && p.id !== c.me);
      items.push({ label: 'Switch market or mode…', run: async () => { if (await ui.confirmBox('Switch market or mode?', 'This ends the match' + (others ? ' for everyone' : '') + ' and goes back to the lobby, where you pick index futures, oil & gold, small caps and more.', 'Back to lobby')) { c.skipResults = true; c.abort(); } } });
      items.push({ label: 'End match now', run: async () => { if (await ui.confirmBox('End the match?', 'Everyone goes to the results screen with the current standings.', 'End match')) c.abort(); } });
    }
    items.push({ label: 'Leave match', run: async () => { if (await ui.confirmBox('Leave the match?', c.isHost ? 'You are the host: leaving ends the match for everyone.' : 'Your account stays in the standings. You can rejoin with the room code.', 'Leave')) DTA.app.leave(); } });
    ui.ctxMenu(items, r.left, r.bottom + 4);
  }

  // ---------- blotter ----------
  function renderBottom(force) {
    const g = G(), c = C();
    if (!g || g.predict) return;
    const a = g.acct;
    const key = S.bottom + ':' + (a ? JSON.stringify([a.pos, a.ord]) : '') + ':' + g.fills.length + ':' + g.news.length + (S.bottom === 'pos' || S.bottom === 'cal' ? ':' + Math.floor(performance.now() / 500) : '') + ':' + JSON.stringify(g.cal || []).length;
    if (!force && key === S.lastAcctKey) return;
    S.lastAcctKey = key;
    const body = $('#bottomBody');
    const scroll = body.scrollTop;
    body.innerHTML = '';
    const ordN = a ? a.ord.length : 0;
    $('#ordCount').textContent = ordN ? String(ordN) : '';
    const unread = g.news.length - S.newsSeen;
    $('#newsCount').textContent = S.bottom !== 'news' && unread > 0 ? String(unread) : '';
    const upcoming = (g.cal || []).filter((e) => !e.done && e.t > g.t).length;
    $('#calCount').textContent = upcoming ? String(upcoming) : '';
    if (S.bottom === 'cal') { body.appendChild(calendarTable(g)); body.scrollTop = scroll; return; }
    if (!a) { body.appendChild(el('div.empty', 'You are watching: no account.')); return; }
    const table = (heads, rows, emptyText) => {
      if (!rows.length) return el('div.empty', emptyText);
      return el('table.grid-table', [el('thead', el('tr', heads.map((h) => el('th' + (h[1] ? '.l' : ''), h[0])))), el('tbody', rows)]);
    };
    if (S.bottom === 'pos') {
      const rows = a.pos.slice().sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).map((p) => {
        const s = g.syms[p[0]];
        const last = s.last * s.tick;
        const u = p[1] * (last - p[2]) * (s.mult || 1);
        return el('tr', [
          el('td', el('b', p[0])), el('td.l', p[1] > 0 ? 'Long' : p[1] < 0 ? 'Short' : 'Flat'), el('td', fmtQty(Math.abs(p[1]))),
          el('td', p[1] ? fmtPrice(p[2], s.tick) : '—'), el('td', fmtPrice(last, s.tick)),
          el('td.' + (u >= 0 ? 'pos' : 'neg'), p[1] ? fmtSignedMoney(u) : '—'), el('td.' + (p[3] >= 0 ? 'pos' : 'neg'), fmtSignedMoney(p[3])),
          el('td', p[1] ? el('button.btn.tiny', { dataset: { act: 'flat', sym: p[0] } }, 'Flatten') : '')
        ]);
      });
      body.appendChild(table([['Symbol', 1], ['Side', 1], ['Qty'], ['Avg'], ['Last'], ['Open P&L'], ['Closed P&L'], ['']], rows, 'No positions yet. Buy or short something!'));
      const eq = c.equity();
      body.appendChild(el('div.empty', { style: { textAlign: 'left', padding: '8px 10px' } }, 'Account ' + fmtMoney(eq) + ' · Margin in use ' + fmtCompactMoney(a.mu || 0) + ' · Free ' + fmtCompactMoney(Math.max(0, a.free || 0)) + ' · Gross exposure ' + fmtCompactMoney(a.gross) + ' · Maintenance ' + fmtCompactMoney(a.maint) + ' · Commissions ' + fmtMoney(a.comm) + (a.fees ? ' · Borrow ' + fmtMoney(a.fees) : '') + (a.mc ? ' · Margin calls ' + a.mc : '')));
    } else if (S.bottom === 'ord') {
      const rows = a.ord.map((o) => {
        const [id, sym, side, type, qty, filled, lp, sp, status, tag, , trail] = o;
        const s = g.syms[sym];
        return el('tr', [el('td', el('b', sym)), el('td.l.' + (side > 0 ? 'pos' : 'neg'), side > 0 ? 'Buy' : 'Sell'), el('td.l', (tag ? tag + ' ' : '') + type), el('td', fmtQty(qty)), el('td', fmtQty(filled)),
          el('td', lp ? fmtPrice(lp, s.tick) : '—'), el('td', sp ? fmtPrice(sp, s.tick) : trail ? 'trail ' + fmtPrice(trail, s.tick) : '—'), el('td.l', status === 'pending' ? 'Waits for entry' : 'Working'),
          el('td', el('button.btn.tiny', { dataset: { act: 'cancel', id } }, 'Cancel'))]);
      });
      body.appendChild(table([['Symbol', 1], ['Side', 1], ['Type', 1], ['Qty'], ['Filled'], ['Limit'], ['Stop'], ['Status', 1], ['']], rows, 'No working orders.'));
    } else if (S.bottom === 'fills') {
      const rows = g.fills.slice().reverse().slice(0, 200).map((f) => {
        const s = g.syms[f.sym];
        const liq = { T: 'Took', M: 'Added', A: 'Auction', X: 'Liquidated', C: 'Close' }[f.liq] || f.liq;
        return el('tr', [el('td', fmtClock(f.t)), el('td.l', el('b', f.sym)), el('td.l.' + (f.side > 0 ? 'pos' : 'neg'), f.side > 0 ? 'Buy' : 'Sell'), el('td', fmtQty(f.qty)), el('td', fmtPrice(f.px, s ? s.tick : 0.01)), el('td.l', liq + (f.tag ? ' · ' + f.tag : '') + (f.cp && C().player(f.cp) ? ' · vs ' + C().player(f.cp).avatar : '')), el('td', fmtMoney(f.comm + f.fee)), el('td.' + (f.realized >= 0 ? 'pos' : 'neg'), f.realized ? fmtSignedMoney(f.realized) : '')]);
      });
      body.appendChild(table([['Time'], ['Symbol', 1], ['Side', 1], ['Qty'], ['Price'], ['Liquidity', 1], ['Fees'], ['Realized']], rows, 'No fills yet.'));
    } else if (S.bottom === 'trips') {
      const trips = DTA.roundTrips(g.fills).reverse();
      const rows = trips.map((t) => el('tr', [el('td', el('b', t.sym)), el('td.l.' + (t.side > 0 ? 'pos' : 'neg'), t.side > 0 ? 'Long' : 'Short'), el('td', fmtQty(t.qty)), el('td', fmtPrice(t.entry, 0.0001)), el('td', fmtPrice(t.exit, 0.0001)), el('td.' + (t.pnl >= 0 ? 'pos' : 'neg'), fmtSignedMoney(t.pnl)), el('td', fmtHold(t.close - t.open)), el('td', fmtClock(t.open, false) + '→' + fmtClock(t.close, false))]));
      const w = trips.filter((t) => t.pnl > 0).length;
      body.appendChild(table([['Symbol', 1], ['Side', 1], ['Size'], ['Entry'], ['Exit'], ['P&L'], ['Held'], ['Time']], rows, 'Closed trades show up here.'));
      if (trips.length) body.appendChild(el('div.empty', { style: { textAlign: 'left', padding: '8px 10px' } }, trips.length + ' trades · ' + Math.round((w / trips.length) * 100) + '% winners · net ' + fmtSignedMoney(trips.reduce((x, t) => x + t.pnl, 0))));
    } else {
      S.newsSeen = g.news.length;
      const list = g.news.slice().reverse();
      if (!list.length) body.appendChild(el('div.empty', 'No headlines yet.'));
      for (const n of list) body.appendChild(el('div.news-item', [el('span.t', (n.t < 0 ? g.days[0] + ' ' : '') + fmtClock(n.t, false)), el('span.s', n.sym || 'MKT'), el('span', [el('span.tone.' + (n.tone > 0 ? 'up' : n.tone < 0 ? 'dn' : ''), n.tone > 0 ? '▲' : n.tone < 0 ? '▼' : '•'), n.text])]));
    }
    body.scrollTop = scroll;
  }
  // Today's economic calendar (and yesterday's releases), with countdowns in real time.
  function calendarTable(g) {
    const cal = (g.cal || []).slice().sort((x, y) => x.t - y.t);
    if (!cal.length) return el('div.empty', 'No scheduled data today. Headlines can still move the market.');
    const rows = cal.map((e) => {
      const day = e.t < 0 ? g.days[0] + ' ' : '';
      const when = e.done ? 'Released' : e.t <= g.t ? 'Now' : 'in ' + fmtDuration(((e.t - g.t) / g.speed) * 1000) + ' (' + fmtHold(e.t - g.t) + ' market time)';
      const tone = e.tone > 0 ? 'pos' : e.tone < 0 ? 'neg' : '';
      const mv = e.moves || null;
      const moves = mv && !mv.length ? el('span.muted', 'little here') : mv ? mv.map((k, i) => el('span' + (k === S.sym ? '.mv-me' : ''), (i ? ' ' : '') + k)) : '—';
      return el('tr' + (e.done ? '.done' : e.t - g.t < 1800 ? '.soon' : '') + (mv && !mv.includes(S.sym) ? '.dim' : ''), [
        el('td', day + fmtClock(e.t, false)), el('td.l', el('b', e.long)), el('td.imp', { title: ['', 'Low', 'Medium', 'High'][e.imp] + ' impact' }, '★'.repeat(e.imp) + '☆'.repeat(3 - e.imp)),
        el('td.l', moves), el('td', e.fc || '—'), el('td.' + (tone || 'x'), e.act || (e.done ? '✓' : '—')), el('td.l', when)
      ]);
    });
    const wrap = el('div');
    wrap.appendChild(el('table.grid-table.cal-table', [el('thead', el('tr', [el('th', 'Time'), el('th.l', 'Event'), el('th', 'Impact'), el('th.l', 'Moves'), el('th', 'Expected'), el('th', 'Actual'), el('th.l', 'When')])), el('tbody', rows)]));
    wrap.appendChild(el('div.empty', { style: { textAlign: 'left', padding: '8px 10px' } }, 'Market time is New York time. A release moves the markets it matters to (Moves), and their order books thin out in the minutes before it.'));
    return wrap;
  }

  // ---------- key levels panel ----------
  const GRP_COLOR = { pd: 'var(--series-1)', vp: 'var(--series-3)', on: 'var(--series-7)', or: 'var(--series-4)', ib: 'var(--series-4)', day: 'var(--series-5)', vwap: 'var(--series-4)', rn: 'var(--text-3)' };
  function renderLevels(force) {
    const g = G();
    if (!g) return;
    const s = g.syms[S.sym];
    const lv = C().levels(S.sym);
    const box = $('#levelsList');
    if (!lv || !s || box.hidden) return;
    const K = DTA.levels.KINDS;
    const key = S.sym + ':' + s.last + ':' + lv.zones.map((z) => z.key + z.idx).join(',');
    if (!force && box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = '';
    box.appendChild(el('div.lv-head', [el('b', 'Key levels'), el('span.muted.small', 'click = limit price · ◆ confluence')]));
    const near = s.last * 0.012;
    const zones = lv.zones.filter((z) => z.members.some((m) => K[m.k].label) || (z.members.some((m) => m.k === 'RN') && Math.abs(z.idx - s.last) <= near)).sort((x, y) => y.idx - x.idx);
    let placed = false;
    const lastRow = () => el('div.lv-last', [el('span', 'Last'), el('b', fmtPrice(s.last * s.tick, s.tick))]);
    for (const z of zones) {
      if (!placed && z.idx < s.last) { box.appendChild(lastRow()); placed = true; }
      const named = z.members.filter((m) => K[m.k].label);
      const hasRound = z.members.some((m) => !K[m.k].label);
      const conf = named.length + (hasRound ? 1 : 0) >= 2;
      const px = z.idx * s.tick;
      const dist = (z.idx - s.last) * s.tick;
      const stars = Math.max(1, Math.min(4, Math.round(z.s * 4)));
      const grp = named.length ? K[named[0].k].grp : 'rn';
      const names = named.length ? named.map((m) => K[m.k].label).join(' · ') + (hasRound ? ' · round' : '') : 'Round';
      const title = z.members.map((m) => K[m.k].name + (m.dev ? ' (developing)' : '')).join(' + ');
      box.appendChild(el('div.lv-row' + (conf ? '.conf' : ''), { dataset: { px: String(px) }, title, role: 'button', tabindex: 0 }, [
        el('span.lv-dot', { style: { background: GRP_COLOR[grp] } }), el('span.lv-name', (conf ? '◆ ' : '') + names), el('span.lv-px', fmtPrice(px, s.tick)),
        el('span.lv-dist.' + (dist >= 0 ? 'pos' : 'neg'), (dist >= 0 ? '+' : DTA.MINUS) + fmtPrice(Math.abs(dist), s.tick)), el('span.lv-str', { 'aria-label': 'Strength ' + stars + ' of 4' }, '●'.repeat(stars) + '○'.repeat(4 - stars)),
        el('button.lv-alert', { type: 'button', title: 'Alert when price crosses', 'aria-label': 'Alert at ' + fmtPrice(px, s.tick), dataset: { alert: String(px) } }, '🔔')
      ]));
    }
    if (!placed) box.appendChild(lastRow());
    // Keep the last price in view.
    const lr = box.querySelector('.lv-last');
    if (lr && (force || !box.dataset.scrolled || box.dataset.scrolled !== S.sym)) { box.scrollTop = Math.max(0, lr.offsetTop - box.clientHeight / 2); box.dataset.scrolled = S.sym; }
  }
  function onLevelClick(e) {
    const g = G();
    if (!g) return;
    const s = g.syms[S.sym];
    const ab = e.target.closest('[data-alert]');
    if (ab) {
      const px = +ab.dataset.alert;
      chart.list(s.sym).push({ id: DTA.uid('d'), type: 'alert', p1: { t: g.t, price: px } });
      chart.saveDrawings(); chart.dirty = true;
      ui.toast('🔔 Alert set at ' + fmtPrice(px, s.tick), 'info');
      return;
    }
    const row = e.target.closest('.lv-row');
    if (!row) return;
    const px = +row.dataset.px;
    S.ticket.px = +px.toFixed(DTA.decimalsForTick(s.tick)); S.ticket.pxTouched = true;
    if (S.ticket.type !== 'LMT' && S.ticket.type !== 'STPLMT') S.ticket.type = 'LMT';
    buildTicket();
    ui.toast('Ticket limit price set to ' + fmtPrice(px, s.tick), 'info');
  }

  // ---------- context strip under the toolbar ----------
  function renderInfo() {
    const g = G();
    if (!g) return;
    const s = g.syms[S.sym];
    const box = $('#chartInfo');
    if (!s || !s.meta) { box.innerHTML = ''; return; }
    const K = DTA.levels.KINDS;
    const sk = DTA.levels.sessionAt(s.meta, g.t);
    const parts = [];
    const sessName = { rth: 'Regular session', on: 'Overnight (Globex)', pre: 'Premarket', post: 'After the cash close', closed: 'Closed' }[sk];
    parts.push(el('span.ci.sess.' + sk, sessName));
    const vw = s.dev && s.dev.vwap();
    if (vw) { const d = (s.last - vw) * s.tick; parts.push(el('span.ci', [el('i', { style: { background: 'var(--series-4)' } }), 'VWAP ' + fmtPrice(vw * s.tick, s.tick) + ' ', el('small.' + (d >= 0 ? 'pos' : 'neg'), (d >= 0 ? 'above' : 'below'))])); }
    const lv = C().levels(S.sym);
    if (lv) {
      let up = null, dn = null;
      for (const z of lv.zones) {
        const named = z.members.filter((m) => K[m.k].label && m.k !== 'VWAP');
        if (!named.length) continue;
        if (z.idx > s.last && (!up || z.idx < up.z.idx)) up = { z, named };
        if (z.idx < s.last && (!dn || z.idx > dn.z.idx)) dn = { z, named };
      }
      const chip = (o, dir) => el('span.ci', { title: o.named.map((m) => K[m.k].name).join(' + ') }, [el('b', dir > 0 ? '▲ ' : '▼ '), o.named.map((m) => K[m.k].label).join(' · ') + ' ' + fmtPrice(o.z.idx * s.tick, s.tick) + ' ', el('small.muted', (dir > 0 ? '+' : DTA.MINUS) + Math.abs(o.z.idx - s.last) + ' ticks')]);
      if (up) parts.push(chip(up, 1));
      if (dn) parts.push(chip(dn, -1));
    }
    // The next release that moves this symbol (crude inventories don't matter to a small-cap runner).
    const next = (g.cal || []).filter((e) => !e.done && e.t > g.t && (!e.moves || e.moves.includes(S.sym))).sort((a, b) => a.t - b.t)[0];
    if (next) parts.push(el('span.ci.cal' + (next.imp >= 3 ? '.hot' : ''), { title: next.long + (next.fc ? ' · expected ' + next.fc : '') }, '⏱ ' + next.name + ' ' + fmtClock(next.t, false) + ' · in ' + fmtDuration(((next.t - g.t) / g.speed) * 1000)));
    if (s.ssr) parts.push(el('span.ci.ssr', { title: 'Short sale restriction: down 10% on the day, so a new short must be a limit above the bid' }, 'SSR'));
    if (s.runner) parts.push(el('span.ci.run', { title: s.runner.catalyst }, '📰 ' + s.runner.catalyst));
    const key = parts.map((p) => p.textContent).join('|');
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = '';
    for (const p of parts) box.appendChild(p);
  }

  // What the market looks like before the bell.
  function contextLines(g) {
    const out = [];
    const fut = g.symList.some((k) => g.syms[k].kind === 'future');
    out.push(g.days[1] + '. Yesterday\'s session and the ' + (fut ? 'overnight' : 'premarket') + ' are on the chart, with the key levels drawn.');
    const gaps = g.symList.slice(0, 4).map((k) => { const s = g.syms[k]; return k + ' ' + fmtPct(s.last / s.prev - 1) + (s.runner ? ' (news)' : ''); });
    out.push('Vs the prior close: ' + gaps.join(' · '));
    // Releases during the match that move something here, and what they move when it isn't everything.
    const upc = (g.cal || []).filter((e) => !e.done && e.t >= g.t && e.t <= g.end && (!e.moves || e.moves.length))
      .map((e) => e.name + ' ' + fmtClock(e.t, false) + (e.moves && e.moves.length < g.symList.length ? ' (' + e.moves.join(' ') + ')' : ''));
    if (upc.length) out.push('Data during the match: ' + upc.join(' · '));
    for (const k of g.symList.filter((x) => g.syms[x].runner).slice(0, 2)) out.push('📰 ' + k + ': ' + g.syms[k].runner.catalyst);
    return out;
  }

  // ---------- first-match walkthrough ----------
  function maybeCoach() {
    if (store.get('coached', false) || window.innerWidth < 1000) return;
    const steps = [
      ['#chart', 'The chart shows yesterday, the overnight or premarket, and today on one timeline. Coloured lines are key levels, and ◆ marks a confluence of several. Drag the strip under the time axis to look back.'],
      ['#ladder', 'The price ladder. Click a bid to buy with a limit order, or an ask to sell. Right-click places a stop.'],
      ['#ticket', 'The order ticket: market, limit, stop and bracket orders. Futures trade in contracts, and the ticket shows what a tick is worth. B and S buy and sell at market.'],
      ['#leaderboard', 'Everyone trades the same market. Beat them on the leaderboard. Press ? at any time for the hotkeys.']
    ];
    let i = 0;
    const box = $('#coach');
    const done = () => { box.hidden = true; store.set('coached', true); };
    const show = () => {
      const [sel, text] = steps[i];
      const target = $(sel);
      if (!target || !target.getBoundingClientRect().width) { if (++i < steps.length) show(); else done(); return; }
      const r = target.getBoundingClientRect();
      box.innerHTML = '';
      box.appendChild(el('div.coach-step', (i + 1) + ' of ' + steps.length));
      box.appendChild(el('p', text));
      box.appendChild(el('div.coach-actions', [
        el('button.btn.small.ghost', { type: 'button', onclick: done }, 'Skip'),
        el('button.btn.small.primary', { type: 'button', onclick: () => { i++; if (i < steps.length) show(); else done(); } }, i === steps.length - 1 ? 'Got it' : 'Next')
      ]));
      box.hidden = false;
      const bw = 300;
      let x = r.right + 12, y = r.top + 12;
      if (x + bw > window.innerWidth - 8) x = r.left - bw - 12;
      if (x < 8) { x = Math.min(window.innerWidth - bw - 8, r.left + 24); y = r.top + 48; }
      box.style.left = x + 'px'; box.style.top = Math.min(y, window.innerHeight - 180) + 'px';
      for (const t of $$('.coach-target')) t.classList.remove('coach-target');
      target.classList.add('coach-target');
      setTimeout(() => { if (box.hidden) target.classList.remove('coach-target'); }, 20000);
    };
    show();
  }

  function onBottomClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'flat') C().flatten(b.dataset.sym);
    if (b.dataset.act === 'cancel') C().cancel(b.dataset.id);
    DTA.sfx.play('click');
  }

  // ---------- news ticker ----------
  function renderTicker(force) {
    const g = G();
    const track = $('#tickerTrack');
    if (!g) return;
    const list = g.news.slice(-8).reverse();
    const key = list.map((n) => n.id).join(',');
    if (!force && track.dataset.key === key) return;
    track.dataset.key = key;
    track.innerHTML = '';
    if (!list.length) { track.appendChild(el('span.muted', 'Market open. Headlines will scroll here.')); return; }
    for (const n of list) track.appendChild(el('span', [el('b', (n.t < 0 ? g.days[0] + ' ' : '') + fmtClock(n.t, false) + ' ' + (n.sym || 'MKT')), el('span.tone.' + (n.tone > 0 ? 'up' : n.tone < 0 ? 'dn' : ''), n.tone > 0 ? '▲' : n.tone < 0 ? '▼' : '•'), n.text]));
    track.style.animationDuration = Math.max(30, list.length * 12) + 's';
  }

  // ---------- HUD ----------
  function updateHud() {
    const g = G(), c = C();
    if (!g) return;
    const phase = c.phase;
    $('#hudClock').textContent = fmtClock(g.t);
    const left = c.timeLeftMs();
    const lt = $('#hudLeft');
    const label = phase === 'countdown' ? 'opens in ' : phase === 'intermission' ? 'next round in ' : phase === 'call' ? 'call closes in ' : g.mode === 'elim' ? 'bell in ' : 'left ';
    lt.textContent = phase === 'results' ? 'closed' : phase === 'reveal' ? 'revealing…' : label + fmtDuration(left);
    lt.classList.toggle('urgent', phase === 'live' && left < 15000);
    // Final ten seconds: a tick each second.
    if (phase === 'live' && left < 10500 && left > 300) {
      const sec = Math.ceil(left / 1000);
      if (sec !== S.lastTickSec) { S.lastTickSec = sec; DTA.sfx.play('tick'); }
    } else S.lastTickSec = null;
    let prog = (g.t - g.start) / Math.max(1, g.end - g.start);
    if (g.stopAt) prog = (g.t - (g.stopAt - (g.duel === 'predict' ? g.predict.K * 60 : 900))) / (g.duel === 'predict' ? g.predict.K * 60 : 900);
    $('#hudProgress').style.width = clamp(prog * 100, 0, 100) + '%';
    const a = g.acct;
    const modeBox = $('#hudMode');
    modeBox.innerHTML = '';
    let sub = g.scenario ? g.scenario.icon + ' ' + g.scenario.name : 'Seed ' + g.seed;
    if (g.rounds > 1) sub = 'Round ' + Math.min(g.round, g.rounds) + ' of ' + g.rounds + ' · ' + sub;
    modeBox.append(el('b', modeTitle(g)), el('span', sub));
    if (a && !g.predict) {
      const eq = c.equity();
      DTA.fx.tweenNumber($('#hudEquity'), eq, (v) => fmtMoney(v, 0), 350);
      const ret = eq / a.start - 1;
      const pct = $('#hudPct');
      pct.textContent = fmtPct(ret);
      pct.className = 'stat-sub ' + (ret >= 0 ? 'pos' : 'neg');
      const pnl = eq - a.start;
      const hp = $('#hudPnl');
      hp.textContent = fmtSignedMoney(pnl, 0);
      hp.className = 'stat-value ' + (pnl >= 0 ? 'pos' : 'neg');
      let unreal = 0;
      for (const p of a.pos) if (p[1]) { const s = g.syms[p[0]]; unreal += p[1] * (s.last * s.tick - p[2]) * (s.mult || 1); }
      $('#hudPnlSplit').textContent = 'closed ' + fmtSignedMoney(a.realized, 0) + ' · open ' + fmtSignedMoney(unreal, 0);
      const anyFut = g.symList.some((k) => g.syms[k].kind === 'future');
      if (anyFut) {
        const used = eq > 0 ? (a.mu || 0) / eq : 1;
        $('.hud-bp .stat-label').textContent = 'Margin';
        $('#hudBp').textContent = fmtCompactMoney(Math.max(0, a.free || 0)) + ' free';
        DTA.drawGauge($('#bpGauge'), used, DTA.chartTheme());
      } else {
        const used = a.bp > 0 ? a.used / a.bp : 0;
        $('.hud-bp .stat-label').textContent = 'Buying power';
        $('#hudBp').textContent = fmtCompactMoney(Math.max(0, a.bp - a.used)) + ' left';
        DTA.drawGauge($('#bpGauge'), used, DTA.chartTheme());
      }
    } else if (g.predict) {
      const sc = (g.score || {})[c.me] || {};
      $('#hudEquity').textContent = (sc.pts || 0) + ' pts';
      $('#hudPct').textContent = sc.streak ? '🔥 streak ' + sc.streak : (sc.correct || 0) + ' of ' + (sc.calls || 0) + ' right';
      $('#hudPct').className = 'stat-sub';
      $('#hudPnl').textContent = '—'; $('#hudPnl').className = 'stat-value'; $('#hudPnlSplit').textContent = 'Call It mode';
      $('#hudBp').textContent = '—';
    } else {
      $('#hudEquity').textContent = '—'; $('#hudPct').textContent = 'watching'; $('#hudPnl').textContent = '—'; $('#hudPnlSplit').textContent = ''; $('#hudBp').textContent = '—';
    }
    const rows = boardRows();
    const idx = rows.findIndex((x) => x.r.id === c.me);
    $('#hudRank').textContent = idx >= 0 ? '#' + (idx + 1) + ' of ' + rows.length : '—';
    // Mode extras.
    const ex = $('#hudExtra');
    ex.innerHTML = '';
    if (g.duel === 'target' && a) {
      const tp = g.settings.targetPct;
      const ret = c.equity() / a.start - 1;
      const pos = clamp((ret + tp) / (2 * tp), 0, 1);
      ex.appendChild(el('div.target-meter', { title: 'First to +' + Math.round(tp * 100) + '% wins; −' + Math.round(tp * 100) + '% and you\'re out' }, [
        el('div.tm-bar', el('div.tm-mark', { style: { left: pos * 100 + '%' } })),
        el('div.tm-lbl', [el('span', '−' + (tp * 100).toFixed(tp < 0.02 ? 1 : 0) + '% out'), el('span', fmtPct(ret)), el('span', '+' + (tp * 100).toFixed(tp < 0.02 ? 1 : 0) + '% wins')])
      ]));
    }
    if (g.mode === 'elim' && phase === 'live') {
      const alive = rows.filter((x) => !x.r.out);
      if (alive.length > 1) {
        const worst = alive.reduce((x, y) => (y.r.eq < x.r.eq ? y : x));
        if (worst.r.id === c.me) ex.appendChild(el('span.danger-chip', '⚠ DANGER: you are last'));
      }
    }
    if (g.duel === 'scalp') {
      const sc = (g.score || {})[c.me] || {};
      ex.appendChild(el('span.pill.acc', '🏅 ' + (sc.wins || 0) + ' round wins'));
    }
    const s = g.syms[S.sym];
    const hb = $('#haltBanner');
    hb.hidden = true;
    void s;
    const book = s && s.book;
    $('#spreadNote').textContent = book && book.a.length && book.b.length ? 'spread ' + fmtPrice((book.a[0][0] - book.b[0][0]) * s.tick, s.tick) : s && s.halted ? 'halted' : '';
    // Tape speed.
    if (s) {
      const now = performance.now();
      S.tapeCount.push([now, s.tape.length]);
      while (S.tapeCount.length > 2 && now - S.tapeCount[0][0] > 3000) S.tapeCount.shift();
      const f = S.tapeCount[0], l = S.tapeCount[S.tapeCount.length - 1];
      const rate = l[0] > f[0] ? ((l[1] - f[1]) / (l[0] - f[0])) * 1000 : 0;
      $('#tapeSpeed').textContent = rate > 0 ? Math.round(rate) + '/s' : '';
      $('#tapeSpeed').title = 'Trade prints per second';
    }
    $('#btnLive').hidden = chart.right === null && !chart.yMan;
    // On a phone the quick-trade bar floats over the bottom of the chart: keep the bottom level tag above it.
    const qb = $('#quickBar');
    const inset = qb && qb.offsetParent ? qb.offsetHeight + 10 : 0;
    if (chart.bottomInset !== inset) { chart.bottomInset = inset; chart.dirty = true; }
    refreshTicket();
  }

  // The symbol header and the ticket's bid/ask refresh with the ladder, so every price on screen agrees.
  function updateQuotes() {
    const g = G();
    if (!g) return;
    const s = g.syms[S.sym];
    let th = null;
    const theme = () => th || (th = DTA.chartTheme());
    for (const row of $$('#watchlist .wl-row')) { const w = g.syms[row.dataset.sym]; if (w) watchPrice(row, w, theme); }
    const title = $('#symTitle');
    const q = $('#tkQuote');
    if (s && q && !g.predict) q.textContent = 'Bid ' + (s.bid !== null ? fmtPrice(s.bid * s.tick, s.tick) : '—') + ' · Ask ' + (s.ask !== null ? fmtPrice(s.ask * s.tick, s.tick) : '—') + (s.halted ? ' · HALTED' : '');
    if (s) {
      const px = s.last * s.tick, ch = px / (s.prev * s.tick) - 1;
      const facts = s.kind === 'future'
        ? [fmtMoney(s.tick * s.mult, 2) + '/tick', fmtMoney(s.margin || 0, 0) + ' margin', 'vol ' + fmtQty(s.vol)].join(' · ')
        : [s.sector, s.cap ? 'cap ' + s.cap : '', s.float ? 'float ' + fmtQty(s.float) : '', s.shortInterest ? 'SI ' + Math.round(s.shortInterest * 100) + '%' : '', s.htb ? 'HTB' : '', s.ssr ? 'SSR' : '', 'vol ' + fmtQty(s.vol)].filter(Boolean).join(' · ');
      const key = s.sym + px + facts;
      if (title.dataset.key !== key) {
        title.dataset.key = key;
        title.innerHTML = '';
        title.title = s.runner ? s.runner.catalyst : s.desc || '';
        title.append(el('b', s.sym), el('span.' + (ch >= 0 ? 'pos' : 'neg'), fmtPrice(px, s.tick) + ' ' + fmtPct(ch)), el('span.nm', s.name), el('span.facts', facts));
      }
    }
  }

  // ---------- phases & overlays ----------
  function updatePhase(ph, initial) {
    const g = G(), c = C();
    if (!g) return;
    const cd = $('#countdown'), im = $('#intermission');
    clearInterval(S.countdownTimer);
    if (ph === 'countdown') {
      im.hidden = true;
      cd.hidden = false;
      const draw = () => {
        const left = Math.ceil(c.timeLeftMs() / 1000);
        if (left === S.lastCd) return;
        S.lastCd = left;
        cd.innerHTML = '';
        if (!S.tip) {
          // Mostly a tip about what's on the board (crude's EIA report, gold's 8:20 open, runner halts...).
          const pool = [];
          for (const k of g.symList) for (const tip of DTA.MARKET_TIPS[g.syms[k].cls] || []) if (!pool.includes(tip)) pool.push(tip);
          const list = pool.length && Math.random() < 0.75 ? pool : DTA.TIPS;
          S.tip = list[Math.floor(Math.random() * list.length)];
        }
        const box = el('div.cd-box', [
          el('div.cd-num', { key: left }, left > 0 ? String(left) : 'GO'),
          el('div.cd-title', g.scenario ? g.scenario.icon + ' ' + g.scenario.name : modeTitle(g) + (g.rounds > 1 ? ' · round ' + g.round + ' of ' + g.rounds : '')),
          el('div.cd-brief', g.scenario ? g.scenario.brief : g.duel === 'scalp' ? 'Fresh chart: ' + g.symList.join(', ') + '. Position limit ' + fmtQty(g.settings.scalpMaxShares) + ' shares.' : g.duel === 'target' ? 'First to +' + Math.round(g.settings.targetPct * 100) + '% wins. −' + Math.round(g.settings.targetPct * 100) + '% and you\'re out.' : g.mode === 'elim' ? g.rounds + ' rounds. The lowest account at each bell is out.' : 'Trading ' + g.symList.join(', ') + '. Highest account at the close wins.')
        ]);
        if (!g.predict && !g.newRound) box.appendChild(el('div.cd-context', contextLines(g).map((l) => el('p', l))));
        if (!g.predict) box.appendChild(el('p.muted', { style: { marginTop: '14px', fontSize: '13px' } }, '💡 ' + S.tip));
        cd.appendChild(box);
        if (left > 0 && !initial) DTA.sfx.play('tick');
      };
      S.lastCd = null;
      S.tip = null;
      draw();
      S.countdownTimer = setInterval(draw, 100);
    } else if (ph === 'live') {
      if (!cd.hidden) { cd.innerHTML = ''; cd.appendChild(el('div.cd-box', el('div.cd-num', 'GO'))); setTimeout(() => { cd.hidden = true; }, 450); DTA.sfx.play('bell'); }
      im.hidden = true;
    } else if (ph === 'intermission') {
      cd.hidden = true;
    } else if (ph === 'call' || ph === 'reveal' || ph === 'score') {
      cd.hidden = true; im.hidden = true;
      renderPredict();
    } else if (ph === 'results') {
      cd.hidden = true; im.hidden = true;
    }
    S.lastPhase = ph;
    updateSpectate();
  }

  function showIntermission(kind, data) {
    const im = $('#intermission');
    const c = C(), g = G();
    im.innerHTML = '';
    let card;
    if (kind === 'elim') {
      const p = c.player(data.pid);
      card = el('div.im-card', [
        el('h2', '🔔 Round ' + data.round + ' bell'),
        p ? el('div.out-av', p.avatar) : null,
        el('p', p ? p.name + ' is knocked out' + (data.reason ? ': ' + data.reason.toLowerCase() : '') : ''),
        el('div.im-list', boardRows().filter((x) => !x.r.out && !x.p.out).map((x, i) => el('div', [el('span', (i + 1) + '. ' + x.p.avatar + ' ' + x.p.name), el('b', fmtCompactMoney(x.r.eq))])))
      ]);
    } else {
      const winners = data.winners.map((id) => c.player(id)).filter(Boolean);
      const list = data.res.slice().sort((a, b) => b.pnl - a.pnl);
      card = el('div.im-card', [
        el('h2', '⏱️ Round ' + data.round + ' · ' + data.sym),
        el('p', winners.length ? winners.map((p) => p.avatar + ' ' + p.name).join(' & ') + ' takes the round' : 'Nobody made money. No round winner'),
        el('div.im-list', list.map((r) => { const p = c.player(r.pid); return el('div', [el('span', (p ? p.avatar + ' ' + p.name : r.pid) + (data.winners.includes(r.pid) ? ' 🏅' : '')), el('b.' + (r.pnl >= 0 ? 'pos' : 'neg'), fmtSignedMoney(r.pnl, 0))]); })),
        el('p.muted', { style: { marginTop: '12px' } }, g.round < g.rounds ? 'Next round starts shortly…' : 'Final round done!')
      ]);
    }
    im.appendChild(card);
    im.hidden = false;
  }

  // ---------- Call It ----------
  function renderPredict() {
    const g = G(), c = C();
    const box = $('#predictPanel');
    if (!g || !g.predict) return;
    box.hidden = false;
    const ph = c.phase;
    box.innerHTML = '';
    const sym = g.symList[0];
    const K = g.predict.K;
    box.appendChild(el('div.pr-head', [el('b', '🔮 Round ' + g.round + ' of ' + g.rounds), el('span.muted', sym)]));
    const timer = el('div.pr-timer', el('span', { id: 'prTimer' }));
    box.appendChild(timer);
    box.appendChild(el('p', { style: { margin: 0 } }, ph === 'call' ? 'Higher or lower ' + K + ' candles from now?' : ph === 'reveal' ? 'Revealing the next ' + K + ' candles…' : 'Round scored'));
    const canCall = ph === 'call' && c.isParticipant() && !c.amOut();
    const up = el('button.btn.buy' + (S.predictPick.dir === 1 ? '.picked' : ''), { type: 'button', disabled: !canCall, onclick: () => pick(1) }, ['▲ Higher', el('small', 'Up')]);
    const dn = el('button.btn.sell' + (S.predictPick.dir === -1 ? '.picked' : ''), { type: 'button', disabled: !canCall, onclick: () => pick(-1) }, ['▼ Lower', el('small', 'Down')]);
    box.appendChild(el('div.pr-dirs', [up, dn]));
    const chips = el('div.pr-chips', [el('span.muted.small', 'Chips')]);
    for (const n of [1, 2, 3]) chips.appendChild(el('button' + (S.predictPick.conf === n ? '.active' : ''), { type: 'button', disabled: !canCall, 'aria-label': n + ' chips', onclick: () => { S.predictPick.conf = n; if (S.predictPick.dir) c.predict(S.predictPick.dir, n); renderPredict(); } }, String(n)));
    box.appendChild(chips);
    const called = el('div.pr-called', { id: 'prCalled' });
    for (const p of [...c.players.values()].filter((x) => x.slot >= 0)) called.appendChild(el('span', { dataset: { pid: p.id }, title: p.name, style: { '--c': p.color }, class: (g.predict.calls && g.predict.calls[p.id]) || (S.called && S.called.has(p.id)) ? 'done' : '' }, p.avatar));
    box.appendChild(called);
    if (S.lastPres && ph === 'score') {
      const r = S.lastPres;
      const mine = r.out[c.me];
      const col = r.dir > 0 ? 'var(--up)' : r.dir < 0 ? 'var(--down)' : 'var(--text-2)';
      box.appendChild(el('div.pr-result', { style: { background: DTA.alpha(r.dir > 0 ? DTA.chartTheme().up : DTA.chartTheme().down, 0.15), color: col } }, (r.dir > 0 ? '▲ UP ' : r.dir < 0 ? '▼ DOWN ' : 'FLAT ') + fmtPct(r.move) + (mine ? ' · you ' + (mine.pts >= 0 ? '+' : '') + mine.pts : '')));
    }
    const hist = el('div.pr-hist');
    for (const h of g.predict.history) hist.appendChild(el('span', { style: { color: h.dir > 0 ? 'var(--up)' : h.dir < 0 ? 'var(--down)' : 'var(--text-2)' } }, 'R' + h.round + ' ' + (h.dir > 0 ? '▲' : h.dir < 0 ? '▼' : '•')));
    box.appendChild(hist);
  }
  function pick(dir) {
    S.predictPick.dir = dir;
    C().predict(dir, S.predictPick.conf);
    DTA.sfx.play(dir > 0 ? 'buy' : 'sell');
    renderPredict();
  }

  // ---------- render loop ----------
  // Each piece renders on its own schedule; one failing widget never stops the others.
  const safe = (name, fn) => { try { fn(); } catch (err) { if (!safe.seen[name]) { safe.seen[name] = true; console.error('[ui] ' + name + ' failed', err); } } };
  safe.seen = {};
  function frame(t) {
    requestAnimationFrame(frame);
    if (DTA.app.screen !== 'game' || !G()) return;
    if (grid.on) { for (const x of grid.charts) if (x.chart.dirty) { x.chart.dirty = false; safe('grid', () => x.chart.render()); } }
    else if (chart.dirty) { chart.dirty = false; safe('chart', () => chart.render()); }
    if (t - S.tWidgets > 50) {
      S.tWidgets = t;
      safe('quotes', updateQuotes);
      if (!G().predict) {
        safe('ladder', () => ladder.render());
        if (S.tapeTab === 'tape') safe('tape', () => tape.render()); else safe('depth', () => depth.render());
      }
    }
    if (t - S.tHud > 200) { S.tHud = t; safe('hud', updateHud); }
    if (t - S.tSlow > 500) {
      S.tSlow = t;
      safe('watchlist', updateWatchlist);
      safe('leaderboard', () => renderLeaderboard(false));
      safe('blotter', () => renderBottom(false));
      safe('ticker', () => renderTicker(false));
      safe('info', renderInfo);
      if (S.tapeTab === 'levels') safe('levels', () => renderLevels(false));
      if (S.board === 'race') safe('race', () => race.render());
      const pt = $('#prTimer');
      if (pt && C().phase === 'call') pt.style.width = clamp(C().timeLeftMs() / 9000, 0, 1) * 100 + '%';
    }
  }

  // ---------- client events ----------
  function bind(client) {
    client.on('start', (g) => { S.called = new Set(); S.lastPres = null; S.predictPick = { dir: 0, conf: 1 }; enter(g); });
    client.on('tick', () => {
      chart.dirty = true;
      chart.checkAlerts();
      if (grid.on) for (const x of grid.charts) x.chart.dirty = true;
    });
    client.on('phase', (m) => {
      if (DTA.app.screen !== 'game') return;
      updatePhase(m.ph);
    });
    client.on('fill', (f) => {
      const g = G();
      const s = g && g.syms[f.sym];
      const now = performance.now();
      if (now - S.lastFillSound > 120) { DTA.sfx.play('fill'); S.lastFillSound = now; }
      const liq = f.liq === 'X' ? ' (liquidated)' : f.liq === 'C' ? ' (closing auction)' : f.liq === 'A' ? ' (reopen auction)' : '';
      // Positions closed by the bell show up in the results; no toast storm at the close.
      if (f.liq === 'C') { chart.dirty = true; return; }
      ui.toast((f.side > 0 ? 'Bought ' : 'Sold ') + fmtQty(f.qty) + ' ' + f.sym + ' @ ' + fmtPrice(f.px, s ? s.tick : 0.01) + liq + (f.realized ? ' · ' + fmtSignedMoney(f.realized) : ''), f.realized > 0 ? 'good' : f.realized < 0 ? 'bad' : 'fill', { ms: 2200, icon: f.side > 0 ? '🟢' : '🔴' });
      if (f.realized && Math.abs(f.realized) > 1) {
        const r = $('#hudPnl').getBoundingClientRect();
        DTA.app.overlay.floatText(r.left + r.width / 2, r.bottom + 18, fmtSignedMoney(f.realized, 0), f.realized > 0 ? DTA.chartTheme().up : DTA.chartTheme().down, 20);
        const a = g.acct;
        if (a && f.realized > a.start * 0.01) DTA.app.overlay.confetti(r.left + r.width / 2, r.bottom, 60);
      }
      chart.dirty = true;
    });
    client.on('toast', (t) => { ui.toast(t.text, t.kind); if (t.kind === 'bad') DTA.sfx.play('reject'); });
    client.on('margin', () => {
      ui.toast('MARGIN CALL: your positions are being liquidated at market', 'bad', { big: true, icon: '💥', ms: 5000 });
      DTA.sfx.play('margin');
      document.body.classList.remove('flash-bad'); void document.body.offsetWidth; document.body.classList.add('flash-bad');
      setTimeout(() => document.body.classList.remove('flash-bad'), 1300);
    });
    client.on('news', (n) => {
      renderTicker(true);
      if (n.big || n.sym === S.sym) { ui.toast((n.sym ? n.sym + ': ' : '') + n.text, n.tone > 0 ? 'good' : n.tone < 0 ? 'bad' : 'info', { icon: '📰', ms: 5000 }); DTA.sfx.play('news'); }
      chart.dirty = true;
    });
    client.on('halt', (m) => {
      if (m.on) ui.toast(m.sym + ' ' + (m.reason || 'halted'), 'warn', { icon: '⏸' });
      else ui.toast(m.sym + ' reopened', 'info', { icon: '▶️' });
      DTA.sfx.play('alert');
      chart.dirty = true;
    });
    client.on('rfill', () => { chart.dirty = true; });
    client.on('cal', () => { chart.dirty = true; if (S.bottom === 'cal') renderBottom(true); });
    client.on('chat', (m) => { ui.appendChat($('#gameChat'), m); if (DTA.app.screen === 'game' && !m.sys && m.pid !== C().me) DTA.sfx.play('chat'); });
    client.on('emote', (m) => { if (DTA.app.screen === 'game') emotePop(m.pid, m.e); });
    client.on('elim', (m) => {
      if (DTA.app.screen !== 'game') return;
      const c = C();
      if (m.pid === c.me) { ui.toast('You are out: ' + m.reason, 'bad', { big: true, icon: '🥊', ms: 6000 }); DTA.sfx.play('elim'); }
      const g = G();
      if (g && g.mode === 'elim' && /bell/i.test(m.reason) || /No trades/.test(m.reason)) showIntermission('elim', m);
      updateSpectate();
      renderLeaderboard(true);
    });
    client.on('rres', (m) => { showIntermission('scalp', m); DTA.sfx.play(m.winners.includes(C().me) ? 'win' : 'bell'); });
    client.on('pcalled', (m) => { S.called = S.called || new Set(); S.called.add(m.pid); const sp = $('#prCalled span[data-pid="' + m.pid + '"]'); if (sp) sp.classList.add('done'); });
    client.on('plock', () => { renderPredict(); chart.dirty = true; });
    client.on('pres', (m) => {
      S.lastPres = m; S.called = new Set();
      const mine = m.out[C().me];
      if (mine && mine.pts > 0) { DTA.sfx.play('win'); const r = $('#chart').getBoundingClientRect(); DTA.app.overlay.confetti(r.left + r.width / 2, r.top + r.height / 2, 50); }
      else if (mine && mine.pts < 0) DTA.sfx.play('lose');
      S.predictPick = { dir: 0, conf: S.predictPick.conf };
      renderPredict();
    });
  }

  DTA.ui.game = {
    init, bind, enter, focus, buy, sell, flatten, reverse, cancelAll, limitAt, stepTf, setTf, setMobileTab, pick, toggleGrid,
    chart: () => chart, ladder: () => ladder, state: S,
    qtyStep(d) { const s = G().syms[S.sym]; const step = qtyStepFor(s); setQty(Math.max(step, S.ticket.qty + d * step)); },
    toggleLevels, toggleWide,
    focusIndex(i) { const g = G(); if (g && g.symList[i]) focus(g.symList[i]); }
  };
  void store;
})();
