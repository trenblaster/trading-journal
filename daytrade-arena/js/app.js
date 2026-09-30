// Day Trade Arena: start-up and flow. Hosting, joining, leaving, reconnecting, hotkeys.
(function () {
  'use strict';
  const DTA = window.DTA;
  const { $, $$, store } = DTA;
  const ui = DTA.ui;

  const app = DTA.app = {
    client: null, host: null, hostNet: null, solo: false, screen: 'home', overlay: null, backdrop: null, leaving: false, code: null, busy: false
  };

  function boot() {
    ui.applySettings();
    ui.bindChatForms();
    ui.home.initHome();
    ui.lobby.initLobby();
    ui.game.init();
    ui.results.init();
    app.overlay = new DTA.fx.Overlay($('#fxCanvas'));
    app.backdrop = new DTA.fx.CandleBackdrop($('#homeBg'));
    app.backdrop.start();
    for (const b of $$('[data-open]')) b.addEventListener('click', () => ({ help: ui.helpModal, keys: ui.keysModal, settings: ui.settingsModal })[b.dataset.open]());
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', () => DTA.sfx.unlock(), { once: false, passive: true });
    window.addEventListener('beforeunload', (e) => {
      const c = app.client;
      if (c && c.game && c.phase !== 'results' && !app.leaving) { e.preventDefault(); e.returnValue = ''; }
    });
    window.addEventListener('pagehide', () => { if (app.hostNet) app.hostNet.destroy(); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------- hosting ----------
  // preset: settings to use for this room (quick play). autostart: start the match straight away.
  async function hostGame(solo, preset, autostart) {
    if (app.busy) return;
    app.busy = true;
    DTA.sfx.unlock();
    const profile = ui.home.currentProfile();
    store.set('profile', Object.assign(ui.home.profile(), { name: profile.name }));
    ui.home.homeStatus(solo ? 'Setting up your practice room…' : 'Creating a room…');
    try {
      let hn = null, st = 'offline', code = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        code = DTA.roomCode(5);
        hn = new DTA.net.HostNet(code);
        st = solo ? await hn.openLocal() : await hn.open();
        if (st !== 'taken') break;
        hn.destroy();
      }
      const saved = store.get('lastSettings', null);
      const settings = Object.assign({}, saved || {}, { seed: '' }, preset || {});
      if (solo && (!saved || saved.bots === 0)) settings.bots = Math.max(3, settings.bots || 0);
      const host = new DTA.GameHost(hn, { code, settings });
      const client = new DTA.GameClient();
      bindClient(client);
      const local = new DTA.net.LocalClientNet(hn);
      client.attach(local, profile);
      Object.assign(app, { client, host, hostNet: hn, solo, code, leaving: false });
      hn.on('status', () => { if (app.screen === 'lobby') ui.lobby.renderNetStatus(); });
      await local.connect();
      ui.home.homeStatus('');
      ui.lobby.resetKey();
      ui.show('lobby');
      app.backdrop.stop();
      if (autostart) setTimeout(() => { if (app.client === client && client.phase === 'lobby') client.start(); }, 250);
      if (!solo && st !== 'online') ui.toast('Could not reach the matchmaking server (' + (hn.statusDetail || 'offline') + '). You can still play against bots, and other tabs in this browser can join.', 'warn', { ms: 7000 });
    } catch (err) {
      console.error(err);
      ui.home.homeStatus('Could not create a room: ' + (err.message || err), true);
    } finally {
      app.busy = false;
    }
  }

  // ---------- joining ----------
  async function joinGame(code, silent) {
    if (app.busy) return;
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { ui.home.homeStatus('Room codes are 5 letters and numbers.', true); return; }
    app.busy = true;
    DTA.sfx.unlock();
    const profile = ui.home.currentProfile();
    store.set('profile', Object.assign(ui.home.profile(), { name: profile.name }));
    if (!silent) ui.home.homeStatus('Connecting to room ' + code + '…');
    const net = new DTA.net.ClientNet();
    const client = app.client && app.client.code === code && app.reconnecting ? app.client : new DTA.GameClient();
    if (client !== app.client) bindClient(client);
    client.attach(net, profile);
    Object.assign(app, { client, host: null, hostNet: null, solo: false, code, leaving: false });
    try {
      await net.connect(code);
      const ok = await new Promise((resolve) => {
        const t = setTimeout(() => resolve(false), 9000);
        const offW = client.on('welcome', () => { clearTimeout(t); offW(); offR(); resolve(true); });
        const offR = client.on('rejected', () => { clearTimeout(t); offW(); offR(); resolve(false); });
      });
      if (!ok) { net.close(); if (!app.leaving) ui.home.homeStatus('The host did not let us in. The room may be full or the game version may differ.', true); return; }
      ui.home.homeStatus('');
      app.backdrop.stop();
      if (app.screen === 'home') { ui.lobby.resetKey(); ui.show(client.phase === 'lobby' || client.phase === 'none' ? 'lobby' : app.screen); }
      if (app.screen === 'home') ui.show('lobby');
      dropJoinParam();
    } catch (err) {
      ui.home.homeStatus(err.message || String(err), true);
      if (app.reconnecting) throw err;
    } finally {
      app.busy = false;
    }
  }

  function bindClient(client) {
    client.on('rejected', (reason) => { ui.toast(reason, 'bad', { ms: 6000 }); ui.home.homeStatus(reason, true); });
    client.on('lobby', () => {
      if (app.host && client.isHost) {
        const s = Object.assign({}, client.settings);
        delete s.seed;
        store.set('lastSettings', s);
      }
      if (app.screen === 'lobby') ui.lobby.renderLobby();
      else if (app.screen === 'home' && client.phase === 'lobby') { ui.show('lobby'); ui.lobby.renderLobby(); }
    });
    client.on('chat', (m) => { ui.lobby.lobbyChat(m); });
    client.on('phase', (m) => {
      if (m.ph === 'lobby') { ui.results.stopReplay(); ui.lobby.resetKey(); ui.show('lobby'); ui.lobby.renderLobby(); }
    });
    client.on('results', (r) => { ui.results.show(r); });
    client.on('disconnected', (reason) => onDisconnected(reason));
    client.on('hostClosed', (reason) => hostGone(reason));
    ui.game.bind(client);
    setInterval(() => { if (app.screen === 'lobby' && app.client === client) ui.lobby.renderNetStatus(); }, 2000);
  }

  // The host left on purpose: no point trying to reconnect.
  function hostGone(reason) {
    if (app.leaving || app.host || app.hostGoneShown) return;
    app.hostGoneShown = true;
    try { if (app.client && app.client.net) app.client.net.close(); } catch (e) { /* ignore */ }
    ui.modal('Room closed', DTA.el('div', [
      DTA.el('p', (reason || 'The host closed the room') + '. Thanks for playing!'),
      DTA.el('div', { style: { marginTop: '12px' } }, DTA.el('button.btn.primary', { onclick: () => { ui.closeModal(); leave(); } }, 'Back to home'))
    ]), { onClose: () => { if (!app.leaving) leave(); } });
  }

  async function onDisconnected(reason) {
    if (app.leaving || app.host) return;
    if ((app.client && app.client.hostClosed) || /closed the room/i.test(reason || '')) { hostGone(reason); return; }
    const code = app.code;
    ui.toast('Connection lost: ' + reason + '. Reconnecting…', 'warn', { ms: 5000 });
    app.reconnecting = true;
    for (let i = 0; i < 4 && !app.leaving; i++) {
      await new Promise((r) => setTimeout(r, 1500 + i * 1500));
      if (app.leaving) return;
      try { await joinGame(code, true); if (app.client && app.client.connected) { app.reconnecting = false; ui.toast('Reconnected', 'good'); return; } } catch (e) { /* try again */ }
    }
    app.reconnecting = false;
    if (app.leaving) return;
    ui.modal('Disconnected', DTA.el('div', [
      DTA.el('p', 'We lost the connection to the room (' + reason + '). If the host closed the game, the room is gone.'),
      DTA.el('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } }, [
        DTA.el('button.btn.primary', { onclick: () => { ui.closeModal(); app.reconnecting = true; joinGame(code, true).catch(() => {}).finally(() => { app.reconnecting = false; }); } }, 'Try again'),
        DTA.el('button.btn', { onclick: () => { ui.closeModal(); leave(); } }, 'Back to home')
      ])
    ]));
  }

  function leave() {
    app.leaving = true;
    app.hostGoneShown = false;
    ui.results.stopReplay();
    try { if (app.client && app.client.net) app.client.net.close(); } catch (e) { /* ignore */ }
    if (app.host) {
      // Tell everyone before the connections drop, then close them a moment later.
      const host = app.host, hn = app.hostNet;
      try { host.broadcast({ t: 'closed', reason: 'The host closed the room' }); } catch (e) { /* ignore */ }
      host.destroy();
      setTimeout(() => { try { hn.destroy(); } catch (e) { /* ignore */ } }, 300);
      app.hostNet = null;
    }
    if (app.hostNet) { app.hostNet.destroy(); }
    Object.assign(app, { client: null, host: null, hostNet: null, solo: false, code: null });
    ui.show('home');
    ui.renderCareer();
    app.backdrop.start();
    dropJoinParam();
  }

  // Remove ?join= once used, keeping any other parameters (such as a custom PeerJS server).
  function dropJoinParam() {
    try {
      const q = new URLSearchParams(location.search);
      if (!q.has('join')) return;
      q.delete('join');
      const rest = q.toString();
      history.replaceState(null, '', location.pathname + (rest ? '?' + rest : ''));
    } catch (e) { /* ignore */ }
  }

  // ---------- hotkeys ----------
  function onKey(e) {
    if (e.key === 'Escape') {
      if (ui.hideCtx() || ui.closeModal()) { e.preventDefault(); return; }
      if (app.screen === 'game') { const ch = ui.game.chart(); if (ch.tool) { ch.setTool(null); e.preventDefault(); } }
      return;
    }
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!$('#modalRoot').hidden) return;
    if (app.screen !== 'game' || !app.client || !app.client.game) return;
    if (e.key === '?') { ui.keysModal(); e.preventDefault(); return; }
    if (e.key === 'Enter') { const i = window.innerWidth < 1000 ? null : $('#gameChatInput'); if (i) { i.focus(); e.preventDefault(); } return; }
    if (!DTA.settings.hotkeys) return;
    const G = ui.game;
    const g = app.client.game;
    if (g.predict) {
      if (e.key === 'ArrowUp') { G.pick(1); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { G.pick(-1); e.preventDefault(); }
      return;
    }
    const k = e.key;
    let handled = true;
    if (k === 'b') G.buy();
    else if (k === 'B') G.limitAt(1);
    else if (k === 's') G.sell();
    else if (k === 'S') G.limitAt(-1);
    else if (k === 'f') G.flatten(false);
    else if (k === 'F') G.flatten(true);
    else if (k === 'r' || k === 'R') G.reverse();
    else if (k === 'c' || k === 'C') G.cancelAll();
    else if (/^[1-9]$/.test(k)) G.focusIndex(+k - 1);
    else if (k === '[') G.stepTf(-1);
    else if (k === ']') G.stepTf(1);
    else if (k === '+' || k === '=') G.qtyStep(1);
    else if (k === '-' || k === '_') G.qtyStep(-1);
    else if (k === ' ') { G.chart().resetView(); G.ladder().recenter(); }
    else if (k === 'g' || k === 'G') G.toggleGrid();
    else if (k === 'l' || k === 'L') G.toggleLevels();
    else if (k === 'w' || k === 'W') G.toggleWide();
    else if (k === 'd' || k === 'D') G.chart().viewToday();
    else if (k === 'a' || k === 'A') G.chart().viewAll();
    else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'Home' || k === 'End') handled = G.chart().key(k);
    else if (k === 'h' || k === 'H') G.chart().setTool('hline');
    else if (k === 't' || k === 'T') G.chart().setTool('trend');
    else if (k === 'Delete' || k === 'Backspace') handled = G.chart().deleteSelected();
    else handled = false;
    if (handled) e.preventDefault();
  }

  Object.assign(app, { hostGame, joinGame, leave });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
