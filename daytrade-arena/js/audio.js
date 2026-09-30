// Day Trade Arena: sound effects, synthesised with WebAudio (no files to download).
(function () {
  'use strict';
  const DTA = window.DTA;
  let ac = null, master = null;

  function ensure() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    return ac;
  }

  function tone(freq, dur, opts) {
    const a = ensure();
    if (!a) return;
    opts = opts || {};
    const t = a.currentTime + (opts.at || 0);
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const peak = (opts.gain || 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.015, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    buy: () => { tone(660, 0.09, { type: 'triangle', to: 990, gain: 0.18 }); },
    sell: () => { tone(620, 0.09, { type: 'triangle', to: 410, gain: 0.18 }); },
    fill: () => { tone(880, 0.06, { type: 'sine', gain: 0.14 }); tone(1320, 0.08, { type: 'sine', gain: 0.1, at: 0.05 }); },
    reject: () => { tone(160, 0.16, { type: 'sawtooth', gain: 0.08 }); },
    news: () => { tone(1046, 0.12, { gain: 0.1 }); tone(1568, 0.18, { gain: 0.08, at: 0.1 }); },
    tick: () => { tone(1200, 0.04, { type: 'square', gain: 0.04 }); },
    go: () => { tone(880, 0.25, { type: 'square', gain: 0.07 }); },
    bell: () => { for (const [f, gn] of [[880, 0.16], [2429, 0.06], [4752, 0.03], [1320, 0.05]]) tone(f, 1.6, { gain: gn }); },
    margin: () => { for (let i = 0; i < 3; i++) { tone(740, 0.14, { type: 'square', gain: 0.07, at: i * 0.3 }); tone(554, 0.14, { type: 'square', gain: 0.07, at: i * 0.3 + 0.15 }); } },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.14, at: i * 0.1 })); },
    lose: () => { [392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.12, at: i * 0.16 })); },
    elim: () => { tone(300, 0.5, { type: 'sawtooth', to: 80, gain: 0.08 }); },
    chat: () => { tone(1400, 0.05, { gain: 0.05 }); },
    alert: () => { tone(988, 0.12, { gain: 0.12 }); tone(988, 0.12, { gain: 0.12, at: 0.18 }); tone(1318, 0.2, { gain: 0.12, at: 0.36 }); },
    click: () => { tone(900, 0.03, { type: 'square', gain: 0.03 }); }
  };

  DTA.sfx = {
    unlock() { const a = ensure(); if (a && a.state === 'suspended') a.resume(); },
    play(name) {
      const s = DTA.settings || {};
      if (s.muted) return;
      const a = ensure();
      if (!a || a.state !== 'running') return;
      master.gain.value = s.volume === undefined ? 0.5 : s.volume;
      const f = SOUNDS[name];
      if (f) { try { f(); } catch (e) { /* audio can fail on some devices */ } }
    }
  };
})();
