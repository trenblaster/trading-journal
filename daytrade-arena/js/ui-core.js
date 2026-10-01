// Day Trade Arena: shared interface pieces. Settings, screens, toasts, modals, context menus, chat
// rendering and the career record.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { $, $$, el, store, fmtSignedMoney, fmtPct, fmtInt, HOTKEYS, MODES, DUEL_TYPES } = DTA;

  // ---------- settings ----------
  const DEFAULTS = { muted: false, volume: 0.5, colorblind: false, reduceMotion: false, qty: 100, hotkeys: true, tf: null, chartType: 'candles', ind: null, minPrint: 0 };
  DTA.settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  function saveSettings() { store.set('settings', DTA.settings); applySettings(); }
  function applySettings() {
    document.body.classList.toggle('cb', !!DTA.settings.colorblind);
    document.body.classList.toggle('reduce-motion', !!DTA.settings.reduceMotion);
    const mb = $('#btnMute');
    if (mb) mb.textContent = DTA.settings.muted ? '🔇' : '🔊';
    DTA.emitTheme && DTA.emitTheme();
  }

  // ---------- screens ----------
  function show(name) {
    for (const s of $$('.screen')) s.classList.toggle('active', s.id === name);
    DTA.app.screen = name;
    document.title = name === 'game' && DTA.app.client && DTA.app.client.game ? 'Day Trade Arena · live' : 'Day Trade Arena';
  }

  // ---------- toasts ----------
  const ICONS = { info: 'ℹ️', good: '✅', bad: '⛔', warn: '⚠️', news: '📰', fill: '💱', alert: '🔔' };
  function toast(text, kind, opts) {
    kind = kind || 'info';
    opts = opts || {};
    const box = $('#toasts');
    while (box.children.length > 4) box.firstChild.remove();
    const t = el('div.toast.' + (kind === 'news' || kind === 'fill' || kind === 'alert' ? 'info' : kind) + (opts.big ? '.big' : ''), { role: 'status' }, [
      el('span.ti', opts.icon || ICONS[kind] || ICONS.info), el('span', text)
    ]);
    box.appendChild(t);
    setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 260); }, opts.ms || (kind === 'bad' ? 4200 : 3000));
  }

  // ---------- modals ----------
  let modalClose = null;
  function modal(title, body, opts) {
    closeModal();
    opts = opts || {};
    const root = $('#modalRoot');
    root.innerHTML = '';
    const box = el('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('div.modal-head', [el('h2', title), el('button.icon-btn', { 'aria-label': 'Close', onclick: () => closeModal() }, '✕')]),
      el('div.modal-body', typeof body === 'string' ? { html: body } : null, typeof body === 'string' ? null : body)
    ]);
    if (opts.footer) box.appendChild(el('div.modal-head', { style: { borderTop: '1px solid var(--line)', borderBottom: 'none', justifyContent: 'flex-end', gap: '8px' } }, opts.footer));
    root.appendChild(box);
    root.hidden = false;
    root.onclick = (e) => { if (e.target === root) closeModal(); };
    const focusable = box.querySelector('input, button:not(.icon-btn), select');
    if (focusable) setTimeout(() => focusable.focus(), 30);
    modalClose = opts.onClose || null;
    return closeModal;
  }
  function closeModal() {
    const root = $('#modalRoot');
    if (root.hidden) return false;
    root.hidden = true;
    root.innerHTML = '';
    const f = modalClose; modalClose = null;
    if (f) f();
    return true;
  }
  function confirmBox(title, text, okLabel) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; closeModal(); resolve(v); } };
      modal(title, el('p', text), {
        footer: [el('button.btn', { onclick: () => finish(false) }, 'Cancel'), el('button.btn.primary', { onclick: () => finish(true) }, okLabel || 'OK')],
        onClose: () => { if (!done) { done = true; resolve(false); } }
      });
    });
  }

  function helpModal() {
    const modes = Object.values(MODES).map((m) => '<li><b>' + m.icon + ' ' + DTA.esc(m.name) + '.</b> ' + DTA.esc(m.desc) + '</li>').join('');
    const duels = Object.values(DUEL_TYPES).map((m) => '<li><b>' + m.icon + ' ' + DTA.esc(m.name) + '.</b> ' + DTA.esc(m.desc) + '</li>').join('');
    modal('How to play', `
      <h3>The idea</h3>
      <p>Everyone in the room trades the same simulated market at the same time. Prices, the order book and the tape are shared, and your orders really move them: buy a thin small cap hard and you push it up for everyone. The host's browser runs the market, so play fair and have fun.</p>
      <h3>Markets</h3>
      <ul>
        <li><b>Index futures (ES, NQ, RTY).</b> Contracts, not shares: ES is $50 a point ($12.50 a tick), NQ $20 a point, RTY $50. Deep books; price respects the prior day's high and low, the overnight range, VWAP and round numbers, and data at 8:30 and 10:00 moves everything.</li>
        <li><b>Crude and gold (CL, GC).</b> CL is $1,000 a point ($10 a tick) and runs stops through obvious levels; EIA inventories hit at 10:30 on Wednesdays. GC is $100 a point and trends on rates.</li>
        <li><b>Small-cap runners.</b> A fresh gapper every match with premarket news. The premarket high and VWAP decide everything, halts come fast, and once a stock is down 10% on the day the short sale restriction only lets you short with a limit above the bid.</li>
        <li><b>Large caps.</b> Liquid stocks that follow the market, with clean trends and VWAP pullbacks.</li>
        <li>Turn on <b>micro contracts</b> in the lobby for futures a tenth of the size.</li>
      </ul>
      <h3>Reading the chart</h3>
      <ul>
        <li>The chart starts with yesterday's session and the overnight (futures) or premarket (stocks), so you can see where price has been. Shaded areas are outside the regular session. Drag the window in the strip under the time axis to look back, press <b>D</b> for today, <b>A</b> for everything, <b>End</b> for live.</li>
        <li>Coloured lines are <b>key levels</b>: prior day high, low and close (PDH, PDL, PDC), the prior day's value area (pPOC, pVAH, pVAL), overnight or premarket high and low (ONH, ONL, PMH, PML), the opening range (ORH, ORL), the first hour (IBH, IBL), high and low of day, VWAP and round numbers. A ◆ marks a <b>confluence</b>: several levels close together, where reactions are stronger.</li>
        <li>At a level, price tends to do one of three things: reject it (often after poking through to run the stops), break it and retest it from the other side, or break it and fail back through, trapping the breakout.</li>
        <li>The Levels tab next to Time &amp; sales lists them with their distance from price, and the Calendar tab shows today's data releases.</li>
      </ul>
      <h3>Modes</h3><ul>${modes}</ul>
      <h3>Quick duels</h3><ul>${duels}</ul>
      <h3>Trading</h3>
      <ul>
        <li>Pick a symbol in the watchlist (or press 1–6). The ticket sends market, limit, stop, stop-limit and trailing-stop orders, with an optional bracket (take-profit plus stop-loss that cancel each other).</li>
        <li>Click a price in the ladder: a bid-side row places a buy limit, an ask-side row a sell limit, and right-click places a stop. Click your own order chip to cancel it.</li>
        <li>Your working orders appear as lines on the chart. Drag them to move, click × to cancel. Right-click the chart for orders and alerts at that price.</li>
        <li>You can short. Hard-to-borrow stocks (MEME, BIOT, QBIT) charge a locate fee per share, have a per-player cap, and sometimes have no shares to borrow at all.</li>
        <li>For stocks, buying power is your account times the leverage the host chose. Futures use a day-trade margin per contract (ES $2,500 at the standard 4× setting). If your account drops below maintenance margin, you get margin called and your positions are sold at market.</li>
        <li>Small caps halt when they move too far too fast (limit up / limit down). Market orders are refused during a halt, but limit orders wait for the reopening auction.</li>
        <li>Positions close automatically at the closing bell (and at every round bell in Knockout and Scalp Duel).</li>
      </ul>
      <h3>After the match</h3>
      <p>See the podium, awards and the equity race. Replay the whole session with every trader's fills on the chart, and export your fills (for the Tradalytics journal) and the candles (for the Tradalytics backtester) as CSV.</p>
      <h3>Playing with friends</h3>
      <p>Host a game and share the 5-letter code or the invite link. Everyone connects straight to the host over WebRTC, and a free public PeerJS server only introduces the browsers. If a friend can't connect (some strict office or phone networks block direct connections), add a TURN server in Settings → Connection. Other tabs on the same computer join instantly without the internet.</p>
    `);
  }

  function keysModal() {
    const rows = HOTKEYS.map(([k, d]) => '<tr><td>' + k.split(' / ').map((x) => '<kbd>' + DTA.esc(x) + '</kbd>').join(' / ') + '</td><td>' + DTA.esc(d) + '</td></tr>').join('');
    modal('Hotkeys', '<table class="keys-table">' + rows + '</table><p class="muted" style="margin-top:12px">Hotkeys are off while you type in a text box. You can turn them off in Settings.</p>');
  }

  function settingsModal() {
    const s = DTA.settings;
    const peer = store.get('peerCfg', {}) || {};
    const chk = (key, label) => el('label.toggle', [el('input', { type: 'checkbox', checked: !!s[key], onchange: (e) => { s[key] = e.target.checked; saveSettings(); } }), label]);
    const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, oninput: (e) => { s.volume = +e.target.value; saveSettings(); }, onchange: () => DTA.sfx.play('fill') });
    const server = el('input', { value: peer.server || '', placeholder: 'e.g. peer.example.com:443/myapp (blank = public server)' });
    const secure = el('input', { type: 'checkbox', checked: peer.secure !== false });
    const turn = el('input', { value: peer.turn || '', placeholder: 'turn:turn.example.com:3478' });
    const tu = el('input', { value: peer.turnUser || '', placeholder: 'username' });
    const tp = el('input', { value: peer.turnPass || '', placeholder: 'credential', type: 'password' });
    const saveConn = () => { store.set('peerCfg', { server: server.value.trim(), secure: secure.checked, turn: turn.value.trim(), turnUser: tu.value.trim(), turnPass: tp.value }); toast('Connection settings saved. They apply to the next room you host or join.', 'good'); };
    modal('Settings', el('div', [
      el('h3', 'Sound & display'),
      el('div', { style: { display: 'grid', gap: '10px' } }, [
        chk('muted', 'Mute all sounds'),
        el('label.field', [el('span', 'Volume'), vol]),
        chk('colorblind', 'Colour-blind friendly candles (blue up, orange down)'),
        chk('reduceMotion', 'Reduce motion (no confetti, no animations)'),
        chk('hotkeys', 'Keyboard hotkeys in matches')
      ]),
      el('h3', 'Connection'),
      el('p', 'By default rooms use the free public PeerJS server to introduce players, then connect directly. If you run your own PeerJS server, or friends can\'t connect from strict networks, set it up here.'),
      el('label.field', [el('span', 'PeerJS server (host:port/path)'), server]),
      el('label.toggle', [secure, 'Use HTTPS/WSS for that server']),
      el('label.field', { style: { marginTop: '10px' } }, [el('span', 'TURN server (optional)'), turn]),
      el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, [tu, tp]),
      el('div', { style: { marginTop: '12px' } }, el('button.btn.primary', { onclick: saveConn }, 'Save connection settings')),
      el('h3', 'Data'),
      el('p', 'Your name, avatar, settings, drawings and career record are stored only in this browser.'),
      el('button.btn.danger', { onclick: async () => { if (await confirmBox('Reset career?', 'This clears your match history and career stats in this browser.', 'Reset')) { store.del('career'); DTA.ui.renderCareer && DTA.ui.renderCareer(); toast('Career reset', 'good'); } } }, 'Reset career stats')
    ]));
  }

  // ---------- context menu ----------
  function ctxMenu(items, x, y) {
    const m = $('#ctxMenu');
    m.innerHTML = '';
    for (const it of items) {
      if (it === '-') { m.appendChild(el('hr')); continue; }
      m.appendChild(el('button', { role: 'menuitem', onclick: () => { hideCtx(); it.run(); } }, [el('span', it.label), it.hint ? el('span.muted', it.hint) : null]));
    }
    m.hidden = false;
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  }
  function hideCtx() { const m = $('#ctxMenu'); if (!m.hidden) { m.hidden = true; return true; } return false; }
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#ctxMenu')) hideCtx(); });

  // ---------- chat ----------
  function chatLine(m) {
    if (m.sys) return el('div.chat-msg.sys' + (m.kind ? '.' + m.kind : ''), m.text);
    const who = el('span.who', { style: { '--c': m.color || 'var(--text-3)' } }, (m.avatar ? m.avatar + ' ' : '') + m.name + ':');
    return el('div.chat-msg', [who, ' ', el('span', m.text)]);
  }
  function appendChat(log, m) {
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.appendChild(chatLine(m));
    while (log.children.length > 150) log.firstChild.remove();
    if (atBottom) log.scrollTop = log.scrollHeight;
  }
  function bindChatForms() {
    for (const form of $$('form[data-chat]')) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        if (!text || !DTA.app.client) return;
        DTA.app.client.say(text);
        input.value = '';
      });
    }
    for (const row of $$('[data-emotes]')) {
      row.innerHTML = '';
      for (const e of DTA.EMOTES) row.appendChild(el('button', { type: 'button', title: 'Send ' + e, onclick: () => DTA.app.client && DTA.app.client.emote(e) }, e));
    }
  }

  // ---------- career ----------
  function career() {
    return Object.assign({ matches: 0, wins: 0, podiums: 0, pnl: 0, best: 0, worst: 0, trades: 0, awards: {}, modes: {}, hist: [], seen: [] }, store.get('career', {}));
  }
  function recordMatch(r, me) {
    const c = career();
    const key = r.seed + ':' + r.mode + ':' + (r.duel || '') + ':' + r.rows.map((x) => x.eq).join(',');
    if (c.seen.includes(key)) return c;
    c.seen.push(key);
    if (c.seen.length > 50) c.seen.shift();
    const idx = r.rows.findIndex((x) => x.id === me);
    if (idx < 0) return c;
    const row = r.rows[idx];
    c.matches++;
    if (idx === 0) c.wins++;
    if (idx < 3) c.podiums++;
    c.pnl += row.pnl;
    c.best = Math.max(c.best, row.pnl);
    c.worst = Math.min(c.worst, row.pnl);
    c.trades += row.trades;
    const mk = r.duel || r.mode;
    c.modes[mk] = c.modes[mk] || { m: 0, w: 0 };
    c.modes[mk].m++;
    if (idx === 0) c.modes[mk].w++;
    for (const a of r.awards) if (a.pid === me) c.awards[a.icon + ' ' + a.title] = (c.awards[a.icon + ' ' + a.title] || 0) + 1;
    c.hist.push({ d: Date.now(), m: mk, rank: idx + 1, of: r.rows.length, pnl: Math.round(row.pnl) });
    if (c.hist.length > 30) c.hist.shift();
    store.set('career', c);
    return c;
  }
  function renderCareer() {
    const box = $('#careerBody');
    if (!box) return;
    const c = career();
    box.innerHTML = '';
    if (!c.matches) { box.appendChild(el('p.muted', 'No matches yet. Your wins, P&L and awards will show up here.')); return; }
    const tile = (k, v, cls) => el('div.stat-tile', [el('div.v' + (cls ? '.' + cls : ''), v), el('div.k', k)]);
    box.appendChild(el('div.career-grid', [
      tile('Matches', fmtInt(c.matches)),
      tile('Wins', fmtInt(c.wins) + ' · ' + Math.round((c.wins / c.matches) * 100) + '%'),
      tile('Total P&L', fmtSignedMoney(c.pnl, 0), c.pnl >= 0 ? 'pos' : 'neg'),
      tile('Best match', fmtSignedMoney(c.best, 0), c.best > 0 ? 'pos' : '')
    ]));
    const maxAbs = Math.max(1, ...c.hist.map((h) => Math.abs(h.pnl)));
    const bars = el('div.career-hist', { title: 'Last ' + c.hist.length + ' matches (P&L)' });
    for (const h of c.hist) bars.appendChild(el('span', { title: new Date(h.d).toLocaleDateString() + ' · ' + h.m + ' · #' + h.rank + ' of ' + h.of + ' · ' + fmtSignedMoney(h.pnl, 0), style: { height: Math.max(8, (Math.abs(h.pnl) / maxAbs) * 100) + '%', background: h.pnl >= 0 ? 'var(--up)' : 'var(--down)', opacity: h.rank === 1 ? 1 : 0.6 } }));
    box.appendChild(bars);
    const aw = Object.entries(c.awards).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (aw.length) box.appendChild(el('p.muted.small', { style: { marginTop: '10px' } }, 'Awards: ' + aw.map(([k, n]) => k + (n > 1 ? ' ×' + n : '')).join(' · ')));
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = el('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  DTA.ui = Object.assign(DTA.ui || {}, { show, toast, modal, closeModal, confirmBox, helpModal, keysModal, settingsModal, ctxMenu, hideCtx, appendChat, chatLine, bindChatForms, career, recordMatch, renderCareer, copyText, saveSettings, applySettings });
  void fmtPct;
})();
