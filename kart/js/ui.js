// Revision Rally: menus, questions, HUD, progression and the main loop.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SUBJECTS = ['econ', 'acc', 'eng'];
  const KEY = 'revision-rally-save-v1';
  const COLORS = ['#d9546b', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#e84393', '#2d3436'];
  const UPGRADES = {
    engine: { name: 'Engine', desc: '+3.5% top speed per level' },
    accel: { name: 'Turbo', desc: 'Faster acceleration' },
    handling: { name: 'Tyres', desc: 'Grip in corners and sharper steering' },
    boost: { name: 'Nitro', desc: 'Boost items last longer' }
  };
  const UP_COST = [150, 300, 500, 800, 1200];
  const PLACE_COINS = [120, 80, 55, 35, 20, 10];
  const CC = [50, 100, 150];

  // ---------------------------------------------------------------- save
  function fresh() {
    return { coins: 0, upgrades: { engine: 0, accel: 0, handling: 0, boost: 0 }, color: COLORS[0], trophies: {},
      stats: {}, topicStats: {}, total: { c: 0, w: 0 }, combo: 0, recent: [], races: 0, wins: 0,
      study: { subject: 'econ', paper: { econ: 1, acc: 1, eng: 1 }, topics: {} }, autoGas: matchMedia('(pointer: coarse)').matches, seenHelp: false };
  }
  let S = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* play without saving */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  // Questions written in Study Town's editor are shared when both games are on the same site.
  let shared = [];
  try { const st = JSON.parse(localStorage.getItem('study-town-save-v1') || 'null'); if (st && Array.isArray(st.custom)) shared = st.custom; } catch (e) { /* none */ }

  // ---------------------------------------------------------------- questions
  const paperOf = (s) => S.study.paper[s] || 1;
  const selected = (s) => S.study.topics[s + '|' + paperOf(s)] || [];
  function pool(subject) {
    const paper = paperOf(subject), sel = selected(subject);
    const topics = Bank.topics[subject].filter((t) => t.papers.includes(paper) && (!sel.length || sel.includes(t.id))).map((t) => t.id);
    let items = Bank.items.concat(shared).filter((q) => q.subject === subject && q.papers.includes(paper) && topics.includes(q.topic));
    if (!items.length) items = Bank.items.filter((q) => q.subject === subject && q.papers.includes(paper));
    return items;
  }
  function pick() {
    let subject = S.study.subject;
    if (subject === 'mix') subject = SUBJECTS[Math.floor(Math.random() * 3)];
    const items = pool(subject);
    const w = items.map((q) => { const st = S.stats[q.id] || { c: 0, w: 0 }; let v = Math.max(0.25, 1 + 2 * st.w - 0.5 * st.c); if (S.recent.includes(q.id)) v *= 0.03; if (q.gen) v *= 1.5; return v; });
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < items.length - 1 && (r -= w[i]) > 0) i++;
    const base = items[i];
    S.recent = [base.id].concat(S.recent.filter((x) => x !== base.id)).slice(0, 12);
    return base.gen ? Object.assign(base.make(), { id: base.id, subject: base.subject, topic: base.topic, papers: base.papers }) : base;
  }
  function record(q, ok) {
    const st = S.stats[q.id] || (S.stats[q.id] = { c: 0, w: 0 });
    const tk = q.subject + '|' + q.topic, ts = S.topicStats[tk] || (S.topicStats[tk] = { c: 0, w: 0 });
    if (ok) { st.c++; ts.c++; S.total.c++; S.combo++; } else { st.w++; ts.w++; S.total.w++; S.combo = 0; }
  }

  const qm = $('#qmodal');
  let Q = null;
  function ask(reason) {
    return new Promise((resolve) => {
      const q = pick();
      const subj = Bank.subjects[q.subject];
      Q = { q, resolve, answered: false, sel: 0, order: null };
      $('#q-meta').innerHTML = `<span class="chip chip-${q.subject}">${subj.name}</span><span class="chip">Paper ${q.papers.length === 1 ? q.papers[0] : paperOf(q.subject)}</span><span class="chip chip-soft">${esc(Bank.topicName(q.subject, q.topic))}</span>`;
      $('#q-reason').textContent = reason;
      $('#q-graph').innerHTML = q.graph ? Graphs.render(q.graph) : ''; $('#q-graph').hidden = !q.graph;
      $('#q-stem').innerHTML = q.q || q.prompt || '';
      $('#q-feedback').hidden = true;
      const body = $('#q-body'); body.innerHTML = '';
      if (q.type === 'mcq') {
        Q.order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
        Q.order.forEach((oi, k) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.innerHTML = `<span class="opt-key">${'ABCD'[k]}</span><span>${q.options[oi]}</span>`; b.addEventListener('click', () => answerMcq(k)); body.appendChild(b); });
        hl(0); $('#q-foot').innerHTML = '<span class="hint">Arrows + Enter, or A–D · Esc or ✕ to skip</span>';
      } else if (q.type === 'num') {
        body.innerHTML = '<div class="num-row"><input id="num-in" inputmode="decimal" autocomplete="off" aria-label="Your answer" placeholder="Your answer"><button class="btn" id="num-go" type="button">Check</button></div>';
        $('#num-go').addEventListener('click', answerNum);
        $('#num-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); answerNum(); } });
        setTimeout(() => $('#num-in') && $('#num-in').focus(), 30);
        $('#q-foot').innerHTML = '<span class="hint">Type a number, then Enter · Esc or ✕ to skip</span>';
      } else {
        body.innerHTML = '<textarea id="draft" rows="5" aria-label="Your answer or plan" placeholder="Plan your answer (optional)"></textarea><button class="btn" id="reveal" type="button">Show the mark scheme</button>';
        $('#reveal').addEventListener('click', reveal);
        $('#q-foot').innerHTML = '<span class="hint">Self-marked · Esc or ✕ to skip</span>';
      }
      qm.hidden = false;
    });
  }
  function hl(k) { if (!Q || !Q.order) return; Q.sel = (k + Q.order.length) % Q.order.length; $$('.opt', qm).forEach((b, i) => b.classList.toggle('focus', i === Q.sel)); }
  function answerMcq(k) { if (Q.answered) return; Q.answered = true; const ok = Q.order[k] === Q.q.answer; $$('.opt', qm).forEach((b, i) => { b.disabled = true; if (Q.order[i] === Q.q.answer) b.classList.add('right'); else if (i === k) b.classList.add('wrong'); }); feedback(ok, Q.q.explain); }
  function answerNum() {
    if (Q.answered) return;
    const raw = $('#num-in').value.replace(/[,$\s%]/g, '');
    if (raw === '' || isNaN(Number(raw))) return;
    Q.answered = true; const ok = Math.abs(Number(raw) - Q.q.answer) <= (Q.q.tol != null ? Q.q.tol : 0.01);
    feedback(ok, `<b>Answer: ${Number(Q.q.answer).toLocaleString('en-US', { maximumFractionDigits: 2 })}</b><br>${Q.q.explain || ''}`);
  }
  function reveal() {
    $('#reveal').remove();
    const list = document.createElement('div'); list.className = 'points';
    list.innerHTML = '<p><b>Tick the points your answer covered</b></p>' + Q.q.points.map((p, i) => `<label class="point"><input type="checkbox" id="pt-${i}"><span>${esc(p)}</span></label>`).join('') + '<button class="btn" id="self-go" type="button">Submit</button>';
    $('#q-body').appendChild(list);
    $('#self-go').addEventListener('click', () => { if (Q.answered) return; Q.answered = true; const n = $$('.point input', list).filter((c) => c.checked).length; $('#self-go').remove(); feedback(n / Q.q.points.length >= 0.6, `You covered ${n} of ${Q.q.points.length} points.`); });
  }
  function feedback(ok, html) {
    record(Q.q, ok); save();
    const fb = $('#q-feedback'); fb.hidden = false; fb.className = 'q-feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `<p class="fb-t">${ok ? 'Correct! Item earned' : 'Not quite: spin-out'}</p><div>${html || ''}</div>`;
    $('#q-foot').innerHTML = '<button class="btn btn-go" id="q-next" type="button">Back to the race <kbd>Enter</kbd></button>';
    $('#q-next').addEventListener('click', () => close(ok, false));
    setTimeout(() => $('#q-next') && $('#q-next').focus(), 30);
    Q.ok = ok;
  }
  function close(ok, cancelled) { if (!Q) return; const r = Q.resolve; Q = null; qm.hidden = true; r({ ok, cancelled }); }
  $('#q-close').addEventListener('click', () => { if (!Q) return; if (Q.answered) close(Q.ok, false); else close(false, true); });

  // ---------------------------------------------------------------- screens
  const screens = ['title', 'select', 'garage', 'topics', 'stats', 'help', 'results', 'pause'];
  function show(name) { screens.forEach((s) => ($('#scr-' + s).hidden = s !== name)); $('#hud').hidden = name !== null; if (name) $('#menus').hidden = false; else $('#menus').hidden = true; updateWallet(); }
  function updateWallet() { $$('.wallet').forEach((w) => (w.textContent = `${S.coins} coins`)); $('#study-line').textContent = studyLabel(); }
  function studyLabel() { const s = S.study.subject; if (s === 'mix') return 'Questions: all three subjects, mixed'; const n = selected(s).length; return `Questions: ${Bank.subjects[s].name} · Paper ${paperOf(s)} · ${n ? n + ' topic' + (n > 1 ? 's' : '') : 'all topics'}`; }

  const trophyKey = (t, cc) => `${t}|${cc}`;
  const trackOpen = (i, cc) => i === 0 || (S.trophies[trophyKey(Track.TRACKS[i - 1].id, cc)] || 9) <= 3;
  const ccOpen = (cc) => cc === 50 || Track.TRACKS.every((t) => (S.trophies[trophyKey(t.id, cc === 100 ? 50 : 100)] || 9) <= 3);
  let selCC = 50;
  function openSelect() {
    if (!ccOpen(selCC)) selCC = 50;
    $('#cc-row').innerHTML = CC.map((c) => `<button type="button" class="seg ${c === selCC ? 'on' : ''}" data-cc="${c}" ${ccOpen(c) ? '' : 'disabled'}>${c}cc${ccOpen(c) ? '' : ' 🔒'}</button>`).join('');
    $('#track-grid').innerHTML = Track.TRACKS.map((t, i) => {
      const open = trackOpen(i, selCC), best = S.trophies[trophyKey(t.id, selCC)];
      const th = Track.THEMES[t.id];
      return `<button type="button" class="track-card" data-track="${t.id}" ${open ? '' : 'disabled'} style="--a:${th.sky[0]};--b:${th.grass[0]};--c:${th.road[0]}">
        <span class="track-art" aria-hidden="true"></span><b>${t.name}</b><small>${open ? t.blurb : `Finish top 3 on ${Track.TRACKS[i - 1].name} to unlock`}</small>
        <span class="medal">${best ? ['🥇 1st', '🥈 2nd', '🥉 3rd'][best - 1] || `Best: ${best}th` : open ? 'Not raced yet' : '🔒 Locked'}</span></button>`;
    }).join('');
    $$('#cc-row [data-cc]').forEach((b) => b.addEventListener('click', () => { selCC = Number(b.dataset.cc); openSelect(); }));
    $$('#track-grid [data-track]').forEach((b) => b.addEventListener('click', () => startRace(b.dataset.track, selCC)));
    show('select');
    const f = $('#track-grid [data-track]:not([disabled])'); if (f) f.focus();
  }
  function openGarage() {
    $('#up-grid').innerHTML = Object.keys(UPGRADES).map((k) => {
      const lv = S.upgrades[k], cost = UP_COST[lv];
      return `<div class="up"><div><b>${UPGRADES[k].name}</b> <span class="pips">${'■'.repeat(lv)}${'□'.repeat(5 - lv)}</span><br><small>${UPGRADES[k].desc}</small></div>
        ${lv >= 5 ? '<span class="tag">Max</span>' : `<button type="button" class="btn" data-up="${k}" ${S.coins >= cost ? '' : 'disabled'}>${cost} c</button>`}</div>`;
    }).join('');
    $('#color-row').innerHTML = COLORS.map((c) => `<button type="button" class="swatch ${S.color === c ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="Kart colour ${c}"></button>`).join('');
    const prev = $('#kart-preview'); prev.innerHTML = ''; const img = Sprites.kart(S.color, '#ffffff', 0); img.className = 'kart-img'; prev.appendChild(img);
    $$('#up-grid [data-up]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.up; S.coins -= UP_COST[S.upgrades[k]]; S.upgrades[k]++; save(); openGarage(); }));
    $$('#color-row [data-color]').forEach((b) => b.addEventListener('click', () => { S.color = b.dataset.color; save(); openGarage(); }));
    show('garage');
  }
  function openTopics(subject) {
    subject = subject || (S.study.subject === 'mix' ? 'econ' : S.study.subject);
    const paper = paperOf(subject), sel = selected(subject), key = subject + '|' + paper;
    const topics = Bank.topics[subject].filter((t) => t.papers.includes(paper));
    const groups = {}; topics.forEach((t) => (groups[t.group] = groups[t.group] || []).push(t));
    let html = `<div class="row">${SUBJECTS.map((k) => `<button type="button" class="seg ${k === subject ? 'on' : ''}" data-subj="${k}">${Bank.subjects[k].name}</button>`).join('')}</div>
      <div class="row">${[1, 2].map((p) => `<button type="button" class="seg ${p === paper ? 'on' : ''}" data-paper="${p}">Paper ${p}</button>`).join('')}<span class="muted">${sel.length ? sel.length + ' selected' : 'All topics'}</span></div>
      <p class="note">${Bank.subjects[subject].papers[paper]}</p><div class="topics">`;
    for (const g in groups) html += `<fieldset><legend>${esc(g)}</legend>${groups[g].map((t) => `<label class="topic"><input type="checkbox" data-topic="${t.id}" ${sel.includes(t.id) ? 'checked' : ''}><span>${esc(t.name)}</span></label>`).join('')}</fieldset>`;
    html += `</div><div class="row"><span class="muted">Race questions come from:</span>${SUBJECTS.concat('mix').map((k) => `<button type="button" class="seg ${S.study.subject === k ? 'on' : ''}" data-use="${k}">${k === 'mix' ? 'All three' : Bank.subjects[k].name}</button>`).join('')}</div>`;
    $('#topics-body').innerHTML = html;
    $$('#topics-body [data-subj]').forEach((b) => b.addEventListener('click', () => openTopics(b.dataset.subj)));
    $$('#topics-body [data-paper]').forEach((b) => b.addEventListener('click', () => { S.study.paper[subject] = Number(b.dataset.paper); save(); openTopics(subject); }));
    $$('#topics-body [data-use]').forEach((b) => b.addEventListener('click', () => { S.study.subject = b.dataset.use; save(); openTopics(b.dataset.use === 'mix' ? subject : b.dataset.use); }));
    $$('#topics-body [data-topic]').forEach((c) => c.addEventListener('change', () => { S.study.topics[key] = $$('#topics-body [data-topic]').filter((x) => x.checked).map((x) => x.dataset.topic); save(); updateWallet(); }));
    show('topics');
  }
  function openStats() {
    const acc = (s) => (s.c + s.w ? Math.round((s.c / (s.c + s.w)) * 100) : 0);
    let html = `<div class="stat-row"><div><b>${S.total.c + S.total.w}</b><small>answered</small></div><div><b>${acc(S.total)}%</b><small>accuracy</small></div><div><b>${S.races}</b><small>races</small></div><div><b>${S.wins}</b><small>wins</small></div></div>`;
    for (const subj of SUBJECTS) {
      const rows = Bank.topics[subj].map((t) => ({ t, s: S.topicStats[subj + '|' + t.id] })).filter((r) => r.s);
      if (!rows.length) continue;
      rows.sort((a, b) => acc(a.s) - acc(b.s));
      html += `<h3>${Bank.subjects[subj].name}</h3>` + rows.map(({ t, s }) => `<div class="ts"><span>${esc(t.name)}</span><div class="bar ${acc(s) < 50 ? 'bad' : acc(s) < 75 ? 'mid' : ''}"><span style="width:${acc(s)}%"></span></div><small>${acc(s)}% · ${s.c + s.w}</small></div>`).join('');
    }
    if (!S.total.c && !S.total.w) html += '<p class="muted">Race to start collecting stats. Weakest topics are listed first.</p>';
    $('#stats-body').innerHTML = html;
    show('stats');
  }

  // ---------------------------------------------------------------- race flow
  let raceStats = null, eventTimer = null;
  function startRace(trackId, cc) {
    Race.start({ track: trackId, cc, upgrades: S.upgrades, color: S.color });
    raceStats = { right: 0, asked: 0, track: trackId, cc };
    show(null);
    $('#hud').hidden = false;
  }
  const isDemo = () => Race.state && Race.state.demo;
  Race.hooks.box = async () => {
    if (isDemo()) { Race.resume(); return; }
    const r = await ask('Question box!');
    if (!r.cancelled) { raceStats.asked++; if (r.ok) { raceStats.right++; const c = 5 + Math.min(10, Math.max(0, S.combo - 1)); S.coins += c; } }
    Race.answered(r.ok, r.cancelled); Race.resume(); save();
  };
  Race.hooks.event = (msg) => { if (isDemo()) return; const e = $('#event'); e.textContent = msg; e.hidden = false; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); clearTimeout(eventTimer); eventTimer = setTimeout(() => (e.hidden = true), 1800); };
  Race.hooks.finish = (res) => {
    if (isDemo()) { Race.stop(); return; }
    setTimeout(() => {
      const mult = { 50: 1, 100: 1.5, 150: 2 }[raceStats.cc];
      const earned = Math.round((PLACE_COINS[res.place - 1] || 0) * mult);
      S.coins += earned; S.races++; if (res.place === 1) S.wins++;
      const k = trophyKey(raceStats.track, raceStats.cc), prev = S.trophies[k];
      if (!prev || res.place < prev) S.trophies[k] = res.place;
      save();
      const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
      $('#results-body').innerHTML = `<p class="big-place">${['🥇', '🥈', '🥉'][res.place - 1] || ''} ${res.place}${['st', 'nd', 'rd'][res.place - 1] || 'th'} place</p>
        <ol class="standings">${res.standings.map((s) => `<li class="${s.you ? 'you' : ''}">${esc(s.name)}</li>`).join('')}</ol>
        <p>Time ${fmt(res.time)} · Best lap ${fmt(Math.min(...res.lapTimes))}</p>
        <p>Questions: <b>${raceStats.right} of ${raceStats.asked}</b> correct${raceStats.asked ? ` (${Math.round((raceStats.right / raceStats.asked) * 100)}%)` : ''}</p>
        <p>You earned <b>${earned}</b> coins for your finish${!prev || res.place < prev ? '. New best on this track!' : '.'}</p>
        ${res.place <= 3 ? '' : '<p class="muted">Tip: every correct answer gives an item. Rockets are more likely when you are behind.</p>'}`;
      Race.stop(); show('results');
      $('#res-again').onclick = () => startRace(raceStats.track, raceStats.cc);
    }, 1400);
  };
  Race.hooks.hud = (h) => {
    if (isDemo()) return;
    $('#h-place').innerHTML = `${h.place}<small>/${h.of}</small>`;
    $('#h-lap').textContent = `Lap ${h.lap}/${h.laps}`;
    $('#h-time').textContent = `${Math.floor(h.time / 60)}:${(h.time % 60).toFixed(1).padStart(4, '0')}`;
    $('#h-speed').textContent = `${h.speed} km/h`;
    $('#h-item').className = 'item-slot ' + (h.item || 'empty');
    $('#h-item').textContent = { boost: '🔥', shield: '🛡️', rocket: '🚀' }[h.item] || '';
    $('#h-item-name').textContent = h.item ? `${h.item} · Space` : 'Hit a ? box';
    const bar = $('#h-track'); bar.innerHTML = h.rivals.map((r) => `<i style="left:${r.frac * 100}%;background:${r.color}"></i>`).join('') + `<i class="me" style="left:${h.lapFrac * 100}%"></i>`;
  };

  function pauseRace() { const st = Race.state; if (!st || st.done) return; st.paused = true; show('pause'); $('#auto-gas').checked = S.autoGas; }
  function resumeRace() { show(null); $('#hud').hidden = false; if (Race.state && qm.hidden) Race.resume(); }

  // ---------------------------------------------------------------- input
  const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  window.addEventListener('keydown', (e) => {
    if (!qm.hidden && Q) {
      if (e.key === 'Escape') { e.preventDefault(); $('#q-close').click(); return; }
      if (Q.answered) { if ((e.key === 'Enter' || e.key === ' ') && document.activeElement.id !== 'draft') { e.preventDefault(); close(Q.ok, false); } return; }
      if (Q.order) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); hl(Q.sel + 1); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); hl(Q.sel - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answerMcq(Q.sel); }
        else { const k = 'abcd'.indexOf(e.key.toLowerCase()); const j = '1234'.indexOf(e.key); const i = k >= 0 ? k : j; if (i >= 0 && i < Q.order.length) { e.preventDefault(); answerMcq(i); } }
      }
      return;
    }
    const racing = Race.state && $('#menus').hidden;
    if (racing) {
      if (KEYS[e.key]) { e.preventDefault(); Race.input[KEYS[e.key]] = true; }
      if (e.key === ' ') { e.preventDefault(); Race.useItem(); }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); pauseRace(); }
    } else if (e.key === 'Escape' && !$('#scr-pause').hidden) { e.preventDefault(); resumeRace(); }
    else if (e.key === 'Escape' && $('#scr-title').hidden && $('#scr-results').hidden) { e.preventDefault(); show('title'); }
  });
  window.addEventListener('keyup', (e) => { if (KEYS[e.key]) Race.input[KEYS[e.key]] = false; });
  window.addEventListener('blur', () => { Object.keys(Race.input).forEach((k) => (Race.input[k] = false)); });
  $$('[data-pad]').forEach((b) => {
    const k = b.dataset.pad;
    const on = (e) => { e.preventDefault(); if (k === 'item') Race.useItem(); else Race.input[k] = true; };
    const off = (e) => { e.preventDefault(); if (k !== 'item') Race.input[k] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });

  // buttons
  $('#b-race').addEventListener('click', openSelect);
  $('#b-garage').addEventListener('click', openGarage);
  $('#b-topics').addEventListener('click', () => openTopics());
  $('#b-stats').addEventListener('click', openStats);
  $('#b-help').addEventListener('click', () => show('help'));
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => show('title')));
  $('#res-menu').addEventListener('click', () => show('title'));
  $('#p-resume').addEventListener('click', resumeRace);
  $('#p-quit').addEventListener('click', () => { Race.stop(); show('title'); });
  $('#p-pause').addEventListener('click', pauseRace);
  $('#auto-gas').addEventListener('change', (e) => { S.autoGas = e.target.checked; save(); });

  // ---------------------------------------------------------------- loop
  const cv = $('#road'), ctx = cv.getContext('2d');
  function fit() {
    const box = $('#stage'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = Math.min(box.clientWidth / Race.W, box.clientHeight / Race.H);
    cv.style.width = Math.floor(Race.W * s) + 'px'; cv.style.height = Math.floor(Race.H * s) + 'px';
    cv.width = Math.round(Race.W * s * dpr); cv.height = Math.round(Race.H * s * dpr);
    ctx.setTransform(cv.width / Race.W, 0, 0, cv.height / Race.H, 0, 0);
  }
  window.addEventListener('resize', fit);
  // Attract mode: a demo race drives itself behind the title menu.
  function demo() { Race.start({ track: Track.TRACKS[Math.floor(Math.random() * 4)].id, cc: 50, upgrades: {}, color: S.color }); Race.state.countdown = 0; Race.state.demo = true; }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const st = Race.state;
    if (st) {
      if (st.demo) { Race.input.up = true; const seg = st.segs[Math.floor((st.pos + 1300) / Track.SEG) % st.segs.length]; Race.input.left = st.x > 0.2 || seg.curve < -1 && st.x > -0.4; Race.input.right = st.x < -0.2 || seg.curve > 1 && st.x < 0.4; st.paused = false; }
      else if (S.autoGas && !Race.input.down) Race.input.up = true;
      Race.update(dt);
      Race.render(ctx);
      if (!st.demo && st.countdown > 0) { const c = Math.ceil(st.countdown - 0.5); $('#count').hidden = false; $('#count').textContent = c > 0 ? c : 'GO!'; }
      else $('#count').hidden = true;
    }
    if (!Race.state) demo();
    requestAnimationFrame(loop);
  }
  const _show = show;
  show = function (name) { if (name && Race.state && Race.state.demo === undefined && name !== 'pause' && name !== 'results') Race.stop(); _show(name); };
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => { if (Race.state && !Race.state.demo) Race.stop(); }));
  function startGame() { fit(); show(S.seenHelp ? 'title' : 'help'); S.seenHelp = true; save(); requestAnimationFrame(loop); }
  // When hosted as a website, keep an offline copy and ask the browser to keep saves.
  try {
    if (/^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.hostname)) {
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }
  } catch (e) { /* not available */ }
  window.addEventListener('pagehide', save);
  startGame();
})();
