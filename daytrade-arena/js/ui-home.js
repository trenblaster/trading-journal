// Day Trade Arena: home screen and lobby.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { $, el, store, AVATARS, MODES, DUEL_TYPES, SCENARIOS, MARKETS, SESSIONS, SYMBOLS, MAX_PLAYERS, fmtCompactMoney } = DTA;
  const ui = DTA.ui;

  // ---------- home ----------
  function profile() {
    const p = store.get('profile', null) || {};
    if (!p.name) p.name = '';
    if (!AVATARS.includes(p.avatar)) p.avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    return p;
  }
  function saveProfile(p) { store.set('profile', p); }

  function initHome() {
    const p = profile();
    const name = $('#nameInput');
    name.value = p.name;
    name.addEventListener('input', () => { const q = profile(); q.name = name.value.slice(0, 16); saveProfile(q); });
    const grid = $('#avatarGrid');
    grid.innerHTML = '';
    for (const a of AVATARS) {
      const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(a === p.avatar), 'aria-label': 'Avatar ' + a }, a);
      b.addEventListener('click', () => {
        const q = profile(); q.avatar = a; saveProfile(q);
        for (const x of grid.children) x.setAttribute('aria-checked', String(x === b));
        DTA.sfx.play('click');
      });
      grid.appendChild(b);
    }
    const tiles = $('#modeTiles');
    tiles.innerHTML = '';
    for (const m of Object.values(MODES)) {
      const subs = m.id === 'duel' ? el('div.subs', Object.values(DUEL_TYPES).map((d) => el('span.pill', d.icon + ' ' + d.name))) : m.id === 'scenario' ? el('div.subs', SCENARIOS.slice(0, 6).map((s) => el('span.pill', s.icon + ' ' + s.name))) : null;
      tiles.appendChild(el('div.mode-tile', [el('div.mt-icon', m.icon), el('h3', m.name), el('p', m.desc), subs]));
    }
    // Quick play: one click into a practice match in a market.
    const qp = $('#quickPlay');
    if (qp) {
      qp.innerHTML = '';
      for (const m of MARKETS) {
        const b = el('button.qp-tile', { type: 'button', title: m.desc }, [el('span.qp-i', m.icon), el('b', m.name), el('small', symLabel(m.pick))]);
        // Quick play uses each market's natural window (oil & gold start before their 8:20 and 9:00 opens).
        b.addEventListener('click', () => DTA.app.hostGame(true, { market: m.id, syms: m.pick.slice(), mode: 'race', minutes: 8, bots: 3, session: m.session || 'full' }, true));
        qp.appendChild(b);
      }
    }
    ui.renderCareer();
    const code = $('#joinCode');
    code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnJoin').click(); });
    try {
      const q = new URLSearchParams(location.search);
      const j = (q.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (j) { code.value = j; homeStatus('Invite for room ' + j + '. Pick a name and avatar, then press Join.'); }
    } catch (e) { /* ignore */ }
    $('#btnHost').onclick = () => DTA.app.hostGame(false);
    $('#btnSolo').onclick = () => DTA.app.hostGame(true);
    $('#btnJoin').onclick = () => DTA.app.joinGame(code.value);
  }
  function symLabel(list) { return list.map((k) => (k[0] === '@' ? 'Runner ' + k.slice(1) : k)).join(' · '); }
  function homeStatus(text, bad) {
    const s = $('#homeStatus');
    s.textContent = text || '';
    s.classList.toggle('bad', !!bad);
  }
  function currentProfile() {
    const p = profile();
    const name = ($('#nameInput').value || '').trim().slice(0, 16) || p.name || 'Trader';
    return { name, avatar: p.avatar };
  }

  // ---------- lobby ----------
  let lastSettingsKey = '';
  function renderLobby() {
    const c = DTA.app.client;
    if (!c) return;
    $('#roomCode').textContent = c.code || '—';
    const isHost = c.isHost;
    const players = [...c.players.values()];
    const seated = players.filter((p) => p.slot >= 0).sort((a, b) => a.slot - b.slot);
    const watchers = players.filter((p) => p.slot < 0);
    $('#playerCount').textContent = seated.length + ' / ' + MAX_PLAYERS;
    const list = $('#playerList');
    list.innerHTML = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = seated.find((x) => x.slot === i);
      if (!p) { list.appendChild(el('li.player-row.empty', isHost ? 'Open seat. Share the code or add a bot' : 'Open seat')); continue; }
      const sub = p.isBot ? p.blurb : p.isHost ? 'Host' + (p.id === c.me ? ' (you)' : '') : !p.connected ? 'Disconnected' : p.ready ? 'Ready' : 'Not ready';
      const badges = [];
      if (p.id === c.me) badges.push(el('span.pill.acc', 'You'));
      if (p.isBot) badges.push(el('span.pill', 'Bot'));
      else if (p.ready || p.isHost) badges.push(el('span.pill.good', '✓'));
      const kick = isHost && !p.isHost ? el('button.kick', { title: p.isBot ? 'Remove bot' : 'Remove from room', 'aria-label': 'Remove ' + p.name, onclick: () => c.kick(p.id) }, '✕') : null;
      list.appendChild(el('li.player-row', [
        el('div.av', { style: { '--c': p.color } }, p.avatar),
        el('div.nm', [p.name, el('small', sub)]),
        ...badges, kick
      ]));
    }
    for (const p of watchers) list.appendChild(el('li.player-row', [el('div.av', { style: { '--c': 'var(--line)' } }, p.avatar), el('div.nm', [p.name, el('small', 'Watching (all seats taken)')])]));
    // Bots.
    const bc = $('#botControls');
    bc.innerHTML = '';
    const st = c.settings || DTA.DEFAULT_SETTINGS;
    if (isHost) {
      const bots = seated.filter((p) => p.isBot).length;
      bc.appendChild(el('span.muted.small', 'Bots'));
      bc.appendChild(el('div.stepper', [
        el('button', { 'aria-label': 'Fewer bots', onclick: () => c.updateSettings({ bots: Math.max(0, bots - 1) }) }, '−'),
        el('span', String(bots)),
        el('button', { 'aria-label': 'More bots', onclick: () => c.updateSettings({ bots: bots + 1 }) }, '+')
      ]));
      bc.appendChild(seg('botLevel', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], st, true));
    } else bc.appendChild(el('span.muted.small', 'Bots: ' + seated.filter((p) => p.isBot).length + ' · ' + st.botLevel));
    // Settings.
    const key = JSON.stringify(st) + isHost;
    if (key !== lastSettingsKey) { lastSettingsKey = key; renderSettings(st, isHost); }
    $('#settingsNote').textContent = isHost ? 'You are the host' : 'The host picks the game';
    const tipBox = $('#lobbyTip');
    if (tipBox && !tipBox.textContent) tipBox.textContent = '💡 ' + DTA.TIPS[Math.floor(Math.random() * DTA.TIPS.length)];
    // Footer.
    const humans = seated.filter((p) => !p.isBot);
    const ready = humans.filter((p) => p.ready || p.isHost).length;
    $('#readyNote').textContent = ready + ' of ' + humans.length + ' people ready' + (watchers.length ? ' · ' + watchers.length + ' watching' : '');
    $('#btnStart').hidden = !isHost;
    $('#btnReady').hidden = isHost || !seated.some((p) => p.id === c.me);
    const me = c.players.get(c.me);
    $('#btnReady').textContent = me && me.ready ? 'Not ready' : "I'm ready";
    $('#btnReady').classList.toggle('primary', !(me && me.ready));
    $('#btnStart').disabled = !seated.length;
    renderNetStatus();
  }

  function renderNetStatus() {
    const box = $('#netStatus');
    const app = DTA.app;
    let dot = 'warn', text = '';
    if (app.hostNet) {
      const s = app.hostNet.status;
      if (app.solo) { dot = 'warn'; text = 'Private practice room (offline). Other tabs in this browser can still join.'; }
      else if (s === 'online') { dot = 'on'; text = 'Online. Friends can join with the code.'; }
      else if (s === 'starting') { dot = 'warn'; text = 'Connecting to the matchmaking server…'; }
      else if (s === 'reconnecting') { dot = 'warn'; text = 'Reconnecting to the matchmaking server…'; }
      else { dot = 'off'; text = 'Offline: ' + (app.hostNet.statusDetail || 'no connection') + '. Only tabs in this browser can join.'; }
    } else if (app.client && app.client.net) {
      const k = app.client.net.kind;
      dot = app.client.connected ? 'on' : 'off';
      text = app.client.connected ? (k === 'bc' ? 'Connected (same browser)' : 'Connected to the host · ' + (app.client.rtt ? app.client.rtt + ' ms' : 'measuring…')) : 'Disconnected';
    }
    box.innerHTML = '';
    box.appendChild(el('span.dot.' + dot));
    box.appendChild(el('span', text));
  }

  // Settings controls. The host edits; everyone else sees the same controls, disabled.
  function seg(key, options, st, enabled, fmt) {
    const c = DTA.app.client;
    const box = el('div.seg', { role: 'group' });
    for (const [v, label] of options) {
      const b = el('button', { type: 'button', disabled: !enabled, 'aria-pressed': String(st[key] === v) }, label);
      if (st[key] === v) b.classList.add('active');
      b.addEventListener('click', () => { if (enabled) c.updateSettings({ [key]: v }); });
      box.appendChild(b);
    }
    void fmt;
    return box;
  }
  // Quick-duel blurbs that follow the room's settings.
  function duelDesc(st) {
    const n = { 3: 'three', 5: 'five', 7: 'seven' };
    const secs = (v) => (v >= 60 && v % 60 === 0 ? v / 60 + '-minute' : v + '-second');
    if (st.duel === 'scalp') return 'Best of ' + (n[st.scalpRounds] || st.scalpRounds) + ' ' + secs(st.scalpSec) + ' rounds, each on a fresh chart, with a capped position size. Most round wins takes it.';
    if (st.duel === 'target') { const p = Math.round(st.targetPct * 1000) / 10; return 'First trader to make +' + p + '% wins instantly. Lose ' + p + '% and you\'re out.'; }
    if (st.duel === 'predict') return st.predictRounds + ' rounds. The chart freezes: call up or down for the next ' + st.predictCandles + ' candles and bet 1 to 3 chips. Streaks score bonus points.';
    return DUEL_TYPES[st.duel].desc;
  }
  function field(label, control, full) { return el('div.field' + (full ? '.full' : ''), [el('span', label), control]); }
  function select(key, options, st, enabled) {
    const c = DTA.app.client;
    const s = el('select', { disabled: !enabled });
    for (const [v, label] of options) { const o = el('option', { value: String(v) }, label); if (String(st[key]) === String(v)) o.selected = true; s.appendChild(o); }
    s.addEventListener('change', () => { const raw = s.value; c.updateSettings({ [key]: isFinite(+raw) && raw !== '' && typeof st[key] === 'number' ? +raw : raw }); });
    return s;
  }
  function toggle(key, label, st, enabled) {
    const c = DTA.app.client;
    const i = el('input', { type: 'checkbox', checked: !!st[key], disabled: !enabled });
    i.addEventListener('change', () => c.updateSettings({ [key]: i.checked }));
    return el('label.toggle', [i, label]);
  }

  // Market picker: a card per market; the chosen one shows its symbols as toggles.
  function marketStep(st, E) {
    const c = DTA.app.client;
    const box = el('div.mkt-grid');
    const cur = MARKETS.find((m) => m.id === st.market) || MARKETS[0];
    const chosen = Array.isArray(st.syms) && st.syms.length ? st.syms : cur.pick;
    for (const m of MARKETS) {
      const on = m.id === cur.id;
      const card = el('div.mkt-card' + (on ? '.active' : ''), { role: 'button', tabindex: E ? 0 : -1, 'aria-pressed': String(on), 'aria-disabled': String(!E), title: m.desc }, [
        el('div.mkt-head', [el('span.mkt-i', m.icon), el('b', m.name)]),
        el('p', m.desc)
      ]);
      if (on) {
        const pick = el('div.mkt-pick');
        pick.appendChild(el('span.muted.small', 'Symbols'));
        const chips = el('div.mkt-syms');
        for (const k of m.syms) {
          const d = SYMBOLS[k];
          const sel = chosen.includes(k);
          const label = k[0] === '@' ? 'Runner ' + k.slice(1) : (st.micro && d && d.micro ? d.micro.sym : k);
          const title = k[0] === '@' ? 'A small cap gapping up on news, generated for this match' : d ? d.name + ': ' + d.desc : k;
          const chip = el('button.sym-chip' + (sel ? '.on' : ''), { type: 'button', disabled: !E, title, 'aria-pressed': String(sel) }, label);
          chip.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!E) return;
            const next = sel ? chosen.filter((x) => x !== k) : m.syms.filter((x) => chosen.includes(x) || x === k);
            if (next.length) c.updateSettings({ syms: next });
          });
          chips.appendChild(chip);
        }
        pick.appendChild(chips);
        if (m.syms.some((k) => SYMBOLS[k] && SYMBOLS[k].kind === 'future')) {
          const i = el('input', { type: 'checkbox', checked: !!st.micro, disabled: !E });
          i.addEventListener('change', () => c.updateSettings({ micro: i.checked }));
          pick.appendChild(el('label.toggle.micro', [i, 'Micro contracts (a tenth of the size)']));
        }
        box.pickRow = pick;
      }
      const pickIt = () => { if (E && !on) c.updateSettings({ market: m.id }); };
      card.addEventListener('click', pickIt);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickIt(); } });
      box.appendChild(card);
    }
    const wrap = el('div.mkt-step', [box]);
    if (box.pickRow) wrap.appendChild(box.pickRow);
    return wrap;
  }
  function marketHasStocks(st) {
    const m = MARKETS.find((x) => x.id === st.market) || MARKETS[0];
    const list = Array.isArray(st.syms) && st.syms.length ? st.syms : m.pick;
    return list.some((k) => k[0] === '@' || (SYMBOLS[k] && SYMBOLS[k].kind !== 'future'));
  }

  function renderSettings(st, isHost) {
    const c = DTA.app.client;
    const body = $('#settingsBody');
    body.innerHTML = '';
    const tabs = el('div.mode-tabs', { role: 'tablist' });
    for (const m of Object.values(MODES)) {
      const b = el('button.mode-tab' + (st.mode === m.id ? '.active' : ''), { type: 'button', role: 'tab', 'aria-selected': String(st.mode === m.id), disabled: !isHost && st.mode !== m.id }, [el('span.i', m.icon), m.name]);
      b.addEventListener('click', () => { if (isHost) c.updateSettings({ mode: m.id }); });
      tabs.appendChild(b);
    }
    body.appendChild(tabs);
    const mode = MODES[st.mode];
    body.appendChild(el('p.mode-desc', mode.desc));
    const g = el('div.set-grid');
    const E = isHost;
    const cash = [[10000, '$10K'], [25000, '$25K'], [50000, '$50K'], [100000, '$100K'], [250000, '$250K'], [1000000, '$1M']];
    const lev = [[1, '1×'], [2, '2×'], [4, '4×'], [6, '6×'], [10, '10×']];
    const common = (opts) => {
      if (opts.session) {
        const stocks = marketHasStocks(st);
        const sessions = SESSIONS.filter((x) => !x.futuresOnly || !stocks);
        g.appendChild(field('Market session', select('session', sessions.map((x) => [x.id, x.name]), st, E)));
        const sess = SESSIONS.find((x) => x.id === st.session);
        if (sess && sess.note) g.appendChild(el('p.hint', sess.note));
      }
      g.appendChild(field('Starting cash', select('startCash', cash, st, E)));
      // Everything else sits behind "More settings" so the lobby stays readable.
      const more = el('details.more-settings');
      more.appendChild(el('summary', 'More settings: leverage, commissions, news, volatility, rivals, seed'));
      const mg = el('div.set-grid');
      mg.appendChild(field('Leverage (stocks) · futures margin', seg('leverage', lev, st, E)));
      mg.appendChild(el('p.hint', '4× is the standard day-trade margin for futures (ES $2,500 a contract). Lower leverage asks for more margin, higher for less.'));
      if (opts.events) mg.appendChild(field('News and data', seg('events', [['off', 'Off'], ['calm', 'Calm'], ['normal', 'Normal'], ['chaos', 'Chaos']], st, E)));
      if (opts.events) mg.appendChild(field('Volatility', seg('volatility', [['calm', 'Calm'], ['normal', 'Normal'], ['wild', 'Wild']], st, E)));
      mg.appendChild(field("Rivals' trades", seg('rivals', [['live', 'Live'], ['delayed', '20s delay'], ['hidden', 'Hidden']], st, E)));
      mg.appendChild(field('Commissions', toggle('commissions', 'Charge commissions (stocks $0.005 a share, futures $2.25 a contract)', st, E)));
      const seed = el('input', { value: st.seed || '', placeholder: 'Random', disabled: !E, maxlength: 24 });
      seed.addEventListener('change', () => c.updateSettings({ seed: seed.value }));
      mg.appendChild(field('Seed (same seed = same market)', seed));
      more.appendChild(mg);
      if (DTA.ui.lobbyMoreOpen) more.open = true;
      more.addEventListener('toggle', () => { DTA.ui.lobbyMoreOpen = more.open; });
      g.appendChild(el('div.full', more));
    };
    const needsMarket = st.mode !== 'scenario';
    if (needsMarket) {
      body.insertBefore(el('div.step-head', [el('span.step-n', '1'), el('b', 'Market'), el('span.muted.small', st.mode === 'duel' && st.duel !== 'target' ? 'Each round picks one of these' : 'What you trade')]), tabs);
      body.insertBefore(marketStep(st, E), tabs);
      body.insertBefore(el('div.step-head', [el('span.step-n', '2'), el('b', 'Mode')]), tabs);
    }
    if (st.mode === 'race') {
      g.appendChild(field('Match length', seg('minutes', [[3, '3 min'], [5, '5'], [8, '8'], [10, '10'], [15, '15'], [20, '20']], st, E), true));
      common({ session: true, events: true });
    } else if (st.mode === 'elim') {
      g.appendChild(field('Round length', seg('elimRoundSec', [[30, '30s'], [45, '45s'], [60, '60s'], [90, '90s'], [120, '2m'], [180, '3m']], st, E)));
      g.appendChild(field('Blown up below', seg('bustPct', [[0.3, '30%'], [0.5, '50%'], [0.7, '70%']], st, E)));
      g.appendChild(el('p.hint.full', 'Rounds: one fewer than the number of traders (at most 7). At each bell every position closes. Anyone who made no trades that round is out first, otherwise the lowest account goes.'));
      common({ session: true, events: true });
    } else if (st.mode === 'scenario') {
      const grid = el('div.scen-grid');
      const opts = [{ id: 'random', icon: '🎲', name: 'Mystery', brief: 'A random scenario. You find out what it was afterwards.' }].concat(SCENARIOS);
      for (const s of opts) {
        const b = el('button.scen' + (st.scenario === s.id ? '.active' : ''), { type: 'button', disabled: !E && st.scenario !== s.id }, [el('span.i', s.icon), el('b', s.name), el('small', s.id === 'random' ? s.brief : s.symbols.join(' · '))]);
        b.addEventListener('click', () => { if (E) c.updateSettings({ scenario: s.id }); });
        grid.appendChild(b);
      }
      g.appendChild(field('Scenario', grid, true));
      const sc = SCENARIOS.find((x) => x.id === st.scenario);
      if (sc) g.appendChild(el('p.hint.full', sc.icon + ' ' + sc.brief));
      g.appendChild(field('Match length', seg('minutes', [[5, '5 min'], [8, '8'], [10, '10'], [15, '15']], st, E), true));
      common({});
    } else if (st.mode === 'duel') {
      const dt = el('div.mode-tabs');
      for (const d of Object.values(DUEL_TYPES)) {
        const b = el('button.mode-tab' + (st.duel === d.id ? '.active' : ''), { type: 'button', disabled: !E && st.duel !== d.id }, [el('span.i', d.icon), d.name]);
        b.addEventListener('click', () => { if (E) c.updateSettings({ duel: d.id }); });
        dt.appendChild(b);
      }
      dt.style.gridTemplateColumns = 'repeat(3, 1fr)';
      g.appendChild(el('div.full', [dt, el('p.mode-desc', duelDesc(st))]));
      if (st.duel === 'predict') {
        g.appendChild(field('Rounds', seg('predictRounds', [[5, '5'], [8, '8'], [10, '10'], [15, '15']], st, E)));
        g.appendChild(field('Candles to call', seg('predictCandles', [[3, '3'], [5, '5'], [8, '8']], st, E)));
        g.appendChild(el('p.hint.full', 'Scoring: correct = 100 × chips, plus 25 per streak step. Wrong = −50 × chips. A flat result scores nothing.'));
        const seed = el('input', { value: st.seed || '', placeholder: 'Random', disabled: !E, maxlength: 24 });
        seed.addEventListener('change', () => c.updateSettings({ seed: seed.value }));
        g.appendChild(field('Seed', seed));
      } else if (st.duel === 'target') {
        g.appendChild(field('Profit target (and loss limit)', seg('targetPct', [[0.01, '±1%'], [0.02, '±2%'], [0.03, '±3%'], [0.05, '±5%'], [0.1, '±10%']], st, E)));
        g.appendChild(field('Time limit', seg('minutes', [[3, '3 min'], [5, '5'], [8, '8'], [10, '10']], st, E)));
        common({ session: true, events: true });
      } else {
        g.appendChild(field('Rounds (best of)', seg('scalpRounds', [[3, '3'], [5, '5'], [7, '7']], st, E)));
        g.appendChild(field('Round length', seg('scalpSec', [[30, '30s'], [45, '45s'], [60, '60s'], [90, '90s'], [120, '2m']], st, E)));
        g.appendChild(field('Position limit (shares; futures: one contract per 500)', seg('scalpMaxShares', [[1000, '1K'], [2500, '2.5K'], [5000, '5K'], [10000, '10K'], [25000, '25K']], st, E)));
        g.appendChild(el('p.hint.full', 'Every round is a fresh chart, and every account resets to ' + fmtCompactMoney(st.startCash) + '. Highest round P&L takes the round.'));
        common({ events: true });
      }
    }
    body.appendChild(g);
  }

  function lobbyChat(m) { ui.appendChat($('#lobbyChat'), m); }

  function initLobby() {
    $('#btnLeaveLobby').onclick = async () => { if (await ui.confirmBox('Leave the room?', DTA.app.client && DTA.app.client.isHost ? 'You are the host: leaving closes the room for everyone.' : 'You can rejoin with the same code while the room is open.', 'Leave')) DTA.app.leave(); };
    $('#btnCopyCode').onclick = async () => { if (await ui.copyText(DTA.app.client.code)) ui.toast('Room code copied', 'good'); };
    $('#btnCopyLink').onclick = async () => {
      const url = location.origin + location.pathname + '?join=' + DTA.app.client.code;
      if (await ui.copyText(url)) ui.toast('Invite link copied. Send it to your friends.', 'good');
    };
    $('#btnReady').onclick = () => { const c = DTA.app.client; const me = c.players.get(c.me); c.ready(!(me && me.ready)); };
    $('#btnStart').onclick = () => { DTA.sfx.unlock(); DTA.app.client.start(); };
  }

  DTA.ui.home = { initHome, homeStatus, currentProfile, profile };
  DTA.ui.lobby = { initLobby, renderLobby, lobbyChat, renderNetStatus, resetKey: () => { lastSettingsKey = ''; } };
})();
