// Day Trade Arena: results. Podium, standings, awards, the equity race, a full replay of the session with
// every trader's fills, your round trips, and CSV exports for the Tradalytics journal and backtester.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { $, $$, el, fmtMoney, fmtSignedMoney, fmtPct, fmtQty, fmtPrice, fmtClock, fmtHold, fmtCompactMoney, csvCell, downloadText, MODES, DUEL_TYPES, pad2, clamp } = DTA;
  const ui = DTA.ui;

  const R = { r: null, tab: 'stand', replay: null, raceView: null, playing: false, timer: null };
  const C = () => DTA.app.client;

  function title(r) {
    if (r.duel) return DUEL_TYPES[r.duel].icon + ' ' + DUEL_TYPES[r.duel].name;
    return MODES[r.mode].icon + ' ' + MODES[r.mode].name;
  }

  function show(r) {
    R.r = r;
    stopReplay();
    const c = C();
    const me = c.me;
    ui.recordMatch(r, me);
    ui.renderCareer();
    const winner = r.rows[0];
    const myIdx = r.rows.findIndex((x) => x.id === me);
    $('#resTitle').textContent = winner ? (winner.id === me ? '🏆 You win!' : '🏆 ' + winner.avatar + ' ' + winner.name + ' wins') : 'Match over';
    const parts = [title(r)];
    if (r.scenario) parts.push(r.scenario.icon + ' ' + r.scenario.name);
    parts.push('seed ' + r.seed);
    if (myIdx >= 0) parts.push('you finished #' + (myIdx + 1) + ' of ' + r.rows.length);
    if (r.note) parts.push(r.note);
    $('#resSub').textContent = parts.join(' · ');
    $('#btnResLobby').hidden = !c.isHost;
    renderPodium(r);
    R.tab = 'stand';
    for (const b of $$('[data-rtab]')) {
      b.classList.toggle('active', b.dataset.rtab === 'stand');
      if (b.dataset.rtab === 'replay') b.hidden = !r.singleMarket;
      if (b.dataset.rtab === 'race') b.hidden = !r.singleMarket;
      if (b.dataset.rtab === 'charts') b.hidden = !r.singleMarket && !(r.rows.find((x) => x.id === me) || { trades: 0 }).trades;
    }
    renderTab();
    ui.show('results');
    if (myIdx === 0) { DTA.sfx.play('win'); setTimeout(() => DTA.app.overlay.rain(160), 300); }
    else if (myIdx > 0 && myIdx < 3) { DTA.sfx.play('bell'); DTA.app.overlay.rain(50); }
    else DTA.sfx.play('lose');
  }

  function valueText(r, row) {
    if (r.duel === 'predict') return row.pts + ' pts';
    if (r.duel === 'scalp') return row.wins + ' 🏅 · ' + fmtSignedMoney(row.pnl, 0);
    return fmtSignedMoney(row.pnl, 0) + ' (' + fmtPct(row.pnlPct, 1) + ')';
  }

  function renderPodium(r) {
    const box = $('#podium');
    box.innerHTML = '';
    const order = [1, 0, 2];
    const cls = ['first', 'second', 'third'];
    for (const i of order) {
      const row = r.rows[i];
      if (!row) continue;
      box.appendChild(el('div.pod.' + cls[i], [
        el('div.p-av', { style: { '--c': row.color, animationDelay: (i === 0 ? 0.9 : i === 1 ? 0.5 : 0.2) + 's' } }, row.avatar),
        el('div.p-name', row.name + (row.id === C().me ? ' (you)' : '')),
        el('div.p-val.' + (r.duel === 'predict' ? '' : row.pnl >= 0 ? 'pos' : 'neg'), valueText(r, row)),
        el('div.p-step', { style: { animationDelay: (i === 0 ? 0.6 : i === 1 ? 0.3 : 0) + 's' } }, String(i + 1))
      ]));
    }
  }

  function renderTab() {
    const body = $('#resultsBody');
    stopReplay();
    body.innerHTML = '';
    if (R.replay && R.replay.chart) { R.replay.chart.destroy(); R.replay = null; }
    const r = R.r;
    if (!r) return;
    if (R.tab === 'stand') body.appendChild(standings(r));
    else if (R.tab === 'awards') body.appendChild(awardsView(r));
    else if (R.tab === 'race') body.appendChild(raceView(r));
    else if (R.tab === 'charts') body.appendChild(chartsView(r));
    else if (R.tab === 'replay') body.appendChild(replayView(r));
    else if (R.tab === 'trips') body.appendChild(tripsView(r));
    else body.appendChild(exportView(r));
  }

  function standings(r) {
    const wrap = el('div');
    if (r.scenario) wrap.appendChild(el('div.res-panel', [el('div.ph', el('h3', r.scenario.icon + ' What happened: ' + r.scenario.name)), el('div.debrief', r.scenario.debrief)]));
    const me = C().me;
    let heads, row;
    if (r.duel === 'predict') {
      heads = ['#', 'Trader', 'Points', 'Correct', 'Best streak'];
      row = (x, i) => [String(i + 1), who(x), String(x.pts), x.correct + ' / ' + x.calls, String(x.bestStreak)];
    } else {
      heads = ['#', 'Trader'].concat(r.duel === 'scalp' ? ['Round wins'] : []).concat(['Account', 'P&L', 'Return', 'Trades', 'Win %', 'Profit factor', 'Best', 'Worst', 'Max DD', 'Fees', 'Notes']);
      row = (x, i) => {
        const notes = [];
        if (x.out) notes.push('Out: ' + x.outReason);
        if (x.mc) notes.push('💀 ' + x.mc + ' margin call' + (x.mc > 1 ? 's' : ''));
        if (x.busted) notes.push('Busted');
        return [String(i + 1), who(x)].concat(r.duel === 'scalp' ? [String(x.wins)] : []).concat([
          fmtMoney(x.eq, 0), el('span.' + (x.pnl >= 0 ? 'pos' : 'neg'), fmtSignedMoney(x.pnl, 0)), el('span.' + (x.pnl >= 0 ? 'pos' : 'neg'), fmtPct(x.pnlPct, 2)),
          String(x.trades), x.trades ? Math.round(x.winRate * 100) + '%' : '—', x.trades ? (x.pf === null || !isFinite(x.pf) ? '∞' : x.pf.toFixed(2)) : '—',
          x.trades ? fmtSignedMoney(x.best, 0) : '—', x.trades ? fmtSignedMoney(x.worst, 0) : '—', fmtPct(x.maxDD, 1, false), fmtMoney(x.comm + x.fees, 0), notes.join(' · ')
        ]);
      };
    }
    const table = el('table.grid-table', [
      el('thead', el('tr', heads.map((h, k) => el('th' + (k === 1 || h === 'Notes' ? '.l' : ''), h)))),
      el('tbody', r.rows.map((x, i) => el('tr', { style: x.id === me ? { background: 'rgba(57,135,229,.08)' } : null }, row(x, i).map((v, k) => el('td' + (k === 1 ? '.l' : heads[k] === 'Notes' ? '.l.wrap' : ''), v)))))
    ]);
    wrap.appendChild(el('div.res-panel', [el('div.ph', el('h3', 'Standings')), el('div.res-scroll', table)]));
    if (r.duel === 'scalp' && r.perRound.length) {
      const pr = el('table.grid-table', [
        el('thead', el('tr', [el('th', 'Round'), el('th.l', 'Chart')].concat(r.rows.map((x) => el('th', x.avatar + ' ' + x.name))))),
        el('tbody', r.perRound.map((rd) => el('tr', [el('td', String(rd.round)), el('td.l', rd.sym)].concat(r.rows.map((x) => { const e = rd.res.find((y) => y.pid === x.id); const v = e ? e.pnl : 0; return el('td.' + (v >= 0 ? 'pos' : 'neg'), fmtSignedMoney(v, 0) + (rd.winners.includes(x.id) ? ' 🏅' : '')); })))))
      ]);
      wrap.appendChild(el('div.res-panel', [el('div.ph', el('h3', 'Round by round')), el('div.res-scroll', pr)]));
    }
    if (r.duel === 'predict' && r.predict && r.predict.length) {
      wrap.appendChild(el('div.res-panel', [el('div.ph', el('h3', 'The calls')), el('div.debrief', r.predict.map((h) => 'R' + h.round + ' ' + h.sym + ' ' + (h.dir > 0 ? '▲' : h.dir < 0 ? '▼' : '•') + ' ' + fmtPct(h.pct, 2)).join('   ·   '))]));
    }
    if (r.recap) wrap.appendChild(recapView(r.recap));
    return wrap;
  }

  // What the market did: each symbol's day type or small-cap playbook, and how it treated its levels.
  function recapView(rc) {
    const cards = el('div.recap-grid');
    for (const x of rc.syms) {
      const react = x.reactions.length ? el('ul.recap-rx', x.reactions.map((q) => el('li', [el('span.muted', fmtClock(q.t, false)), ' ', el('b', q.label), ' ', q.kind]))) : el('p.muted.small', 'No clean tests of a key level while you were trading.');
      cards.appendChild(el('div.recap-card', [
        el('div.recap-head', [el('b', x.sym), el('span.' + (x.chg >= 0 ? 'pos' : 'neg'), fmtPct(x.chg, 2) + ' on the day')]),
        x.type ? el('div.recap-type', { title: 'How the day was set up to play out. In a short match you only see part of it.' }, x.type + (x.marketType ? ' · market: ' + x.marketType.toLowerCase() : '')) : null,
        x.play ? el('p.small', x.play) : null,
        el('p.small.muted', 'Key levels: ' + x.holds + ' held, ' + x.breaks + ' broke'),
        react
      ]));
    }
    const kids = [el('div.ph', el('h3', '📊 What the market did')), cards];
    if (rc.cal && rc.cal.length) kids.push(el('div.debrief', 'Data: ' + rc.cal.map((e) => e.name + ' ' + fmtClock(e.t, false) + (e.act ? ' ' + e.act + (e.fc ? ' vs ' + e.fc : '') : '')).join(' · ')));
    return el('div.res-panel', kids);
  }
  function who(x) {
    return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, [
      el('span', { style: { font: '18px/1 var(--f-emoji)', width: '26px', height: '26px', borderRadius: '50%', display: 'inline-grid', placeItems: 'center', boxShadow: '0 0 0 2px ' + x.color, background: 'var(--panel-2)' } }, x.avatar),
      el('b', x.name), x.isBot ? el('span.pill', 'Bot') : null, x.id === C().me ? el('span.pill.acc', 'You') : null
    ]);
  }

  function awardsView(r) {
    const grid = el('div.award-grid');
    const c = C();
    if (!r.awards.length) grid.appendChild(el('div.empty', 'No awards this time. Nobody traded enough!'));
    r.awards.forEach((a, i) => {
      const p = r.rows.find((x) => x.id === a.pid);
      grid.appendChild(el('div.award', { style: { animationDelay: i * 0.07 + 's', borderColor: a.pid === c.me ? 'var(--accent)' : '' } }, [
        el('div.ai', a.icon),
        el('div', [el('b', a.title), el('span.who', p ? p.avatar + ' ' + p.name + (a.pid === c.me ? ' (you)' : '') : ''), el('small', a.detail)])
      ]));
    });
    return grid;
  }

  function raceView(r) {
    const cv = el('canvas');
    const panel = el('div.res-panel', [el('div.ph', [el('h3', 'Equity race'), el('span.muted.small', 'Return on starting cash over market time. Hover for everyone at one moment.')]), el('div.race-big', cv)]);
    requestAnimationFrame(() => {
      const players = new Map(r.rows.map((x) => [x.id, { name: x.name, avatar: x.avatar, color: x.color, out: x.out }]));
      const race = new DTA.EquityRace(cv, {
        hist: () => r.eqHist, player: (id) => players.get(id), me: C().me, start: () => r.start, end: () => r.end, now: () => r.end,
        startCash: (id) => { const x = r.rows.find((y) => y.id === id); return x ? x.start : r.settings.startCash; }, live: false
      });
      R.raceView = race;
      const loop = () => { if (!cv.isConnected) return; race.render(); requestAnimationFrame(loop); };
      loop();
    });
    return panel;
  }

  // ---------- charts ----------
  function chartsView(r) {
    const wrap = el('div.charts-grid');
    const me = r.rows.find((x) => x.id === C().me);
    const players = new Map(r.rows.map((x) => [x.id, { name: x.name, avatar: x.avatar, color: x.color }]));
    if (r.singleMarket && Object.keys(r.eqHist).length) {
      const cv = el('canvas');
      const play = el('button.btn.primary.small', { type: 'button' }, '▶ Replay the ranking');
      const range = el('input', { type: 'range', min: r.start, max: r.end, step: 1, value: r.end, 'aria-label': 'Ranking time' });
      wrap.appendChild(el('div.res-panel.wide', [el('div.ph', [el('h3', 'Ranking race'), el('span.muted.small', 'Return on starting cash at each moment of the session'), play]), el('div.chart-box.tall', cv), el('div.replay-ctl', [range])]));
      requestAnimationFrame(() => {
        const rr = new DTA.RankRace(cv, { hist: r.eqHist, player: (id) => players.get(id), startCash: (id) => { const x = r.rows.find((y) => y.id === id); return x ? x.start : r.settings.startCash; }, start: r.start, end: r.end, me: C().me });
        rr.t = r.end;
        let playing = false, last = 0;
        const speed = (r.end - r.start) / 14;
        range.addEventListener('input', () => { rr.t = +range.value; });
        play.addEventListener('click', () => { playing = !playing; play.textContent = playing ? '⏸ Pause' : '▶ Replay the ranking'; if (playing && rr.t >= r.end - 1) rr.t = r.start; last = performance.now(); });
        const loop = (now) => {
          if (!cv.isConnected) return;
          if (playing) { rr.t = Math.min(r.end, rr.t + ((now - last) / 1000) * speed); range.value = rr.t; if (rr.t >= r.end) { playing = false; play.textContent = '▶ Replay the ranking'; } }
          last = now;
          rr.render();
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
    }
    if (me && me.tripList.length) {
      const bySym = {};
      for (const t of me.tripList) bySym[t.sym] = (bySym[t.sym] || 0) + t.pnl;
      const items = Object.entries(bySym).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, v }));
      const cv1 = el('canvas');
      wrap.appendChild(el('div.res-panel', [el('div.ph', [el('h3', 'Your P&L by symbol'), el('span.muted.small', 'Net of commissions and borrow')]), el('div.chart-box', cv1)]));
      // Histogram of trade results.
      const pnls = me.tripList.map((t) => t.pnl);
      const lo = Math.min(...pnls), hi = Math.max(...pnls);
      const nb = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(pnls.length) * 2)));
      const width = (hi - lo) / nb || 1;
      const bins = new Array(nb).fill(0);
      for (const v of pnls) bins[Math.min(nb - 1, Math.floor((v - lo) / width))]++;
      const th = DTA.chartTheme();
      const items2 = bins.map((cnt, k) => { const mid = lo + (k + 0.5) * width; return { label: fmtSignedMoney(mid, 0), v: cnt, color: mid >= 0 ? th.up : th.down }; });
      const cv2 = el('canvas');
      wrap.appendChild(el('div.res-panel', [el('div.ph', [el('h3', 'Your trade results'), el('span.muted.small', pnls.length + ' round trips, grouped by P&L')]), el('div.chart-box', cv2)]));
      requestAnimationFrame(() => {
        DTA.drawBars(cv1, items, { fmtVal: (v) => fmtSignedMoney(v, 0), fmtAxis: (v) => fmtSignedMoney(v, 0) });
        DTA.drawBars(cv2, items2, { fmtVal: (v) => String(v), fmtAxis: (v) => (Number.isInteger(v) ? String(v) : '') });
      });
    } else wrap.appendChild(el('div.res-panel.wide', el('div.empty', 'Close some trades to see your P&L by symbol and the spread of your results.')));
    return wrap;
  }

  // ---------- replay ----------
  function replayView(r) {
    const g = C().game;
    if (!g) return el('div.empty', 'Replay data is not available.');
    const players = new Map(r.rows.map((x) => [x.id, { name: x.name, avatar: x.avatar, color: x.color }]));
    const me = C().me;
    const trip = R.focusTrip;
    R.focusTrip = null;
    const state = { sym: trip && r.syms.includes(trip.sym) ? trip.sym : r.syms[0], t: r.start, speed: 120, showAll: true, trip };
    const cv = el('canvas');
    const env = {
      sym: () => g.syms[state.sym], start: () => r.start, now: () => state.t, speed: () => 1,
      orders: () => [], position: () => null,
      fills: (sym) => r.fills.filter((f) => f[0] === me && f[2] === sym).map((f) => ({ t: f[1], sym: f[2], side: f[3], qty: f[4], px: f[5] })),
      rivals: (sym) => state.showAll ? r.fills.filter((f) => f[0] !== me && f[2] === sym) : [],
      news: (sym) => r.news.filter((n) => !n.sym || n.sym === sym),
      player: (id) => players.get(id), onModify() {}, onCancel() {},
      days: () => g.days, levels: (sym) => C().levels(sym), cal: () => g.cal,
      highlight: () => (state.trip && state.trip.sym === state.sym ? { t0: state.trip.open, t1: state.trip.close, entry: state.trip.entry, exit: state.trip.exit, side: state.trip.side, qty: state.trip.qty, pnl: state.trip.pnl } : null)
    };
    const chart = new DTA.Chart(cv, env, { replay: true });
    chart.setTf(g.tf || 60);
    chart.show.rivals = true;
    chart.setReplay(state.t);
    R.replay = { chart, state };
    const range = el('input', { type: 'range', min: r.start, max: r.end, step: 1, value: state.t, 'aria-label': 'Replay position' });
    const clock = el('b.num', fmtClock(state.t));
    const playBtn = el('button.btn.primary.small', { type: 'button' }, '▶ Play');
    const setT = (t) => { state.t = clamp(t, r.start, r.end); range.value = state.t; clock.textContent = fmtClock(state.t); chart.setReplay(state.t); };
    range.addEventListener('input', () => setT(+range.value));
    playBtn.addEventListener('click', () => {
      if (R.playing) { stopReplay(); playBtn.textContent = '▶ Play'; return; }
      if (state.t >= r.end - 1) setT(r.start);
      R.playing = true; playBtn.textContent = '⏸ Pause';
      let last = performance.now();
      const step = (now) => {
        if (!R.playing || !cv.isConnected) return;
        const dt = (now - last) / 1000; last = now;
        setT(state.t + dt * state.speed);
        if (state.t >= r.end) { stopReplay(); playBtn.textContent = '▶ Play'; return; }
        R.timer = requestAnimationFrame(step);
      };
      R.timer = requestAnimationFrame(step);
    });
    const speed = el('select.select.small', { 'aria-label': 'Replay speed', onchange: (e) => { state.speed = +e.target.value; } }, [[30, '30×'], [60, '60×'], [120, '120×'], [300, '300×'], [900, '900×']].map(([v, l]) => el('option', { value: v, selected: v === state.speed }, l)));
    const symTabs = el('div.tb-group');
    for (const s of r.syms) {
      const b = el('button' + (s === state.sym ? '.active' : ''), { type: 'button', onclick: () => { state.sym = s; for (const x of symTabs.children) x.classList.toggle('active', x === b); chart.resetView(); chart.setReplay(state.t); } }, s);
      symTabs.appendChild(b);
    }
    const tfSel = el('select.select.small', { 'aria-label': 'Candle size', onchange: (e) => { chart.setTf(+e.target.value); chart.setReplay(state.t); } }, DTA.TIMEFRAMES.map((x) => el('option', { value: x.sec, selected: x.sec === chart.tf }, x.label)));
    const allChk = el('input', { type: 'checkbox', checked: true, onchange: (e) => { state.showAll = e.target.checked; chart.dirty = true; } });
    const legend = el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '0 14px 12px' } }, r.rows.map((x) => el('span.small', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [el('span', { style: { width: '10px', height: '10px', borderRadius: '50%', border: '2px solid ' + x.color, display: 'inline-block' } }), x.avatar + ' ' + x.name + (x.id === me ? ' (you: ▲▼ markers)' : '')])));
    const panel = el('div.res-panel', [
      el('div.ph', [el('h3', 'Replay'), symTabs, tfSel, el('label.toggle', [allChk, "Everyone's fills"])]),
      el('div.replay-wrap', cv),
      el('div.replay-ctl', [playBtn, range, clock, speed]),
      legend
    ]);
    requestAnimationFrame(() => {
      if (state.trip) {
        // Frame the trade: its bars take about half the width, with room either side.
        const t = state.trip;
        const tf = t.close - t.open < 600 ? 15 : t.close - t.open < 3600 ? 60 : 300;
        chart.setTf(tf); tfSel.value = String(tf);
        setT(Math.min(r.end, t.close + tf * 20));
        chart.render();
        const plotW = chart.layout ? chart.layout.plotW : 800;
        const bars = Math.max(1, (t.close - t.open) / tf);
        chart.barW = clamp((plotW * 0.45) / bars, 3, 26);
        chart.data();
        chart.right = chart.idxOfT(t.close) + Math.max(6, bars * 0.5);
        chart.dirty = true;
      } else setT(r.end);
      const loop = () => { if (!cv.isConnected) return; if (chart.dirty) { chart.dirty = false; chart.render(); } requestAnimationFrame(loop); };
      loop();
    });
    return panel;
  }
  function stopReplay() {
    R.playing = false;
    if (R.timer) cancelAnimationFrame(R.timer);
    R.timer = null;
    if (R.replay && R.replay.chart && !R.replay.chart.cv.isConnected) { R.replay.chart.destroy(); R.replay = null; }
  }

  function tripsView(r) {
    const me = r.rows.find((x) => x.id === C().me);
    if (!me) return el('div.empty', 'You watched this match.');
    const trips = me.tripList.slice().reverse();
    if (!trips.length) return el('div.res-panel', el('div.empty', 'You made no round trips this match.'));
    const review = (t) => {
      if (!r.singleMarket) return;
      R.focusTrip = t;
      R.tab = 'replay';
      for (const x of $$('[data-rtab]')) x.classList.toggle('active', x.dataset.rtab === 'replay');
      renderTab();
    };
    const rows = trips.map((t) => el('tr', { style: r.singleMarket ? { cursor: 'pointer' } : null, title: r.singleMarket ? 'Replay this trade' : null, onclick: () => review(t) }, [el('td', el('b', t.sym)), el('td.l.' + (t.side > 0 ? 'pos' : 'neg'), t.side > 0 ? 'Long' : 'Short'), el('td', fmtQty(t.qty)), el('td', t.entry.toFixed(2)), el('td', t.exit.toFixed(2)), el('td.' + (t.pnl >= 0 ? 'pos' : 'neg'), fmtSignedMoney(t.pnl)), el('td', fmtHold(t.close - t.open)), el('td', fmtClock(t.open) + ' → ' + fmtClock(t.close))]));
    const w = trips.filter((t) => t.pnl > 0);
    const summary = trips.length + ' trades · ' + Math.round((w.length / trips.length) * 100) + '% winners · average winner ' + fmtSignedMoney(me.avgWin) + ' · average loser ' + fmtSignedMoney(me.avgLoss) + ' · longs ' + fmtSignedMoney(me.longPnl, 0) + ' · shorts ' + fmtSignedMoney(me.shortPnl, 0);
    return el('div.res-panel', [el('div.ph', [el('h3', 'Your trades'), el('span.muted.small', summary + (r.singleMarket ? ' · click a trade to replay it' : ''))]), el('div.res-scroll', el('table.grid-table', [el('thead', el('tr', ['Symbol', 'Side', 'Size', 'Entry', 'Exit', 'P&L', 'Held', 'Time'].map((h, k) => el('th' + (k < 2 ? '.l' : ''), h)))), el('tbody', rows)]))]);
  }

  // ---------- exports ----------
  function today() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function exportFills() {
    const g = C().game;
    const fills = g ? g.fills : [];
    if (!fills.length) { ui.toast('You have no fills to export', 'warn'); return; }
    // Columns follow an IBKR trades export, which the Tradalytics journal's CSV import recognises.
    const lines = [['Symbol', 'Date/Time', 'Buy/Sell', 'Quantity', 'Price', 'Proceeds', 'Commission'].join(',')];
    const day = today();
    for (const f of fills) {
      lines.push([f.sym, day + ', ' + fmtClock(f.t).padStart(8, '0'), f.side > 0 ? 'BUY' : 'SELL', f.side > 0 ? f.qty : -f.qty, f.px.toFixed(4), (-f.side * f.qty * f.px * (f.mult || 1)).toFixed(2), (-(f.comm + f.fee)).toFixed(2)].map(csvCell).join(','));
    }
    downloadText('day-trade-arena-fills-' + day + '.csv', lines.join('\n'));
    ui.toast('Fills exported. In Tradalytics, choose Import and select this file.', 'good');
  }
  // Candles for the whole timeline: yesterday's session and the overnight or premarket (1-minute history),
  // then the match. Timestamps use real dates: today for the match, the day before for yesterday's bars.
  function exportCandles(sym, tf) {
    const g = C().game;
    const s = g && g.syms[sym];
    if (!s) return;
    const tick = s.tick;
    const out = [];
    let cur = null;
    for (const b of s.histBars || []) {
      const t0 = Math.floor(b[0] / tf) * tf;
      if (!cur || cur.t !== t0) { cur = { t: t0, o: b[1] * tick, h: b[2] * tick, l: b[3] * tick, c: b[4] * tick, v: b[5] }; out.push(cur); }
      else { cur.h = Math.max(cur.h, b[2] * tick); cur.l = Math.min(cur.l, b[3] * tick); cur.c = b[4] * tick; cur.v += b[5]; }
    }
    for (const b of DTA.ind.aggregate(s.bars, tick, g.start, tf, 0)) {
      if (!b.v) continue;
      const last = out[out.length - 1];
      if (last && last.t === Math.floor(b.t / tf) * tf) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; last.v += b.v; }
      else out.push({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
    }
    const day = today();
    const dp = DTA.decimalsForTick(tick);
    const lines = ['timestamp,open,high,low,close,volume'];
    for (const b of out) {
      const t = Math.floor(b.t);
      const tod = ((t % 86400) + 86400) % 86400;
      lines.push(dateOffset(Math.floor(t / 86400)) + ' ' + pad2(Math.floor(tod / 3600)) + ':' + pad2(Math.floor((tod % 3600) / 60)) + ',' + b.o.toFixed(dp) + ',' + b.h.toFixed(dp) + ',' + b.l.toFixed(dp) + ',' + b.c.toFixed(dp) + ',' + Math.round(b.v));
    }
    downloadText('day-trade-arena-' + sym + '-' + (tf / 60) + 'm-' + day + '.csv', lines.join('\n'));
    ui.toast(sym + ' candles exported for the Tradalytics backtester (with yesterday and the ' + (s.kind === 'future' ? 'overnight' : 'premarket') + ')', 'good');
  }
  function dateOffset(days) {
    const d = new Date(Date.now() + days * 86400000);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function exportView(r) {
    const g = C().game;
    const grid = el('div.export-grid');
    grid.appendChild(el('div.export-card', [
      el('h4', '📒 Your fills (Tradalytics journal)'),
      el('p', 'Every fill from this match in the IBKR trade-export layout (Symbol, Date/Time, Buy/Sell, Quantity, Price, Proceeds, Commission). Import it into the journal to review your arena trades.'),
      el('button.btn.primary', { type: 'button', onclick: exportFills }, 'Download fills CSV')
    ]));
    if (r.singleMarket && g) {
      const sel = el('select.select.small', r.syms.map((s) => el('option', { value: s }, s)));
      const tf = el('select.select.small', [[60, '1-minute'], [300, '5-minute'], [900, '15-minute']].map(([v, l]) => el('option', { value: v }, l)));
      grid.appendChild(el('div.export-card', [
        el('h4', '🧪 Candles (Tradalytics backtester)'),
        el('p', 'OHLCV bars (timestamp, open, high, low, close, volume): yesterday\'s session, the overnight or premarket, and the match. Load them as a dataset in the backtester and test a strategy on the day you just played.'),
        el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [sel, tf, el('button.btn', { type: 'button', onclick: () => exportCandles(sel.value, +tf.value) }, 'Download candles CSV')])
      ]));
    }
    grid.appendChild(el('div.export-card', [
      el('h4', '🎲 Play this market again'),
      el('p', 'Hosts can type this seed in the lobby to get the same market again. Your orders will change it, though.'),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [el('code', { style: { fontSize: '18px', fontWeight: '800' } }, String(r.seed)), el('button.btn.small', { type: 'button', onclick: async () => { if (await ui.copyText(String(r.seed))) ui.toast('Seed copied', 'good'); } }, 'Copy')])
    ]));
    grid.appendChild(el('div.export-card', [
      el('h4', '📋 Standings'),
      el('p', 'The results table as CSV, with every trader\'s stats.'),
      el('button.btn', { type: 'button', onclick: () => {
        const head = ['rank', 'name', 'bot', 'account', 'pnl', 'return_pct', 'trades', 'win_rate', 'profit_factor', 'max_drawdown', 'fees', 'points', 'round_wins', 'out'];
        const lines = [head.join(',')].concat(r.rows.map((x, i) => [i + 1, x.name, x.isBot ? 'yes' : 'no', x.eq.toFixed(2), x.pnl.toFixed(2), (x.pnlPct * 100).toFixed(3), x.trades, x.trades ? (x.winRate * 100).toFixed(1) : '', x.pf === null || !isFinite(x.pf) ? 'inf' : x.pf.toFixed(3), (x.maxDD * 100).toFixed(2), (x.comm + x.fees).toFixed(2), x.pts, x.wins, x.out ? x.outReason : ''].map(csvCell).join(',')));
        downloadText('day-trade-arena-standings-' + today() + '.csv', lines.join('\n'));
      } }, 'Download standings CSV')
    ]));
    return grid;
  }

  function init() {
    for (const b of $$('[data-rtab]')) b.addEventListener('click', () => { R.tab = b.dataset.rtab; for (const x of $$('[data-rtab]')) x.classList.toggle('active', x === b); renderTab(); });
    $('#btnResLobby').addEventListener('click', () => C().toLobby());
    $('#btnResLeave').addEventListener('click', async () => { if (await ui.confirmBox('Leave the room?', C().isHost ? 'You are the host: leaving closes the room for everyone.' : 'You can rejoin with the code while the room is open.', 'Leave')) DTA.app.leave(); });
  }

  DTA.ui.results = { init, show, stopReplay };
  void fmtCompactMoney; void fmtPrice;
})();
