// Day Trade Arena: how prices move over a day. Runs only on the host.
//
// A price is an "anchor" plus noise. The anchor comes from the day's plan: a trend day, a balance day,
// a normal-variation day, a double distribution or a reversal for index, commodity and stock drivers, and
// a playbook (gap and go, dip and rip, gap and fade, pop and drop, halt squeeze, chop) for small-cap
// runners. Noise is mean-reverting toward the anchor, with the volatility of the time of day for that
// market (futures overnight vs the cash open, crude around the pit open and inventories, small caps
// front-loaded into the first half hour). On top of that, price reacts to key levels: it rejects them,
// sweeps the stops just beyond and snaps back, or breaks them with a stop run, often retesting the
// broken level from the other side, and sometimes failing and trapping the breakout traders.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const { clamp } = DTA;
  const LV = DTA.levels;

  const DAY = 23400;                      // seconds in a 9:30–16:00 session: the unit for daily volatility
  const H = (h, m) => h * 3600 + (m || 0) * 60;
  const LN2 = Math.log(2);

  // ---------- intraday activity ----------
  // Relative intensity of trading (volume and volatility) by time of day, per kind of market.
  function actRaw(prof, s) {
    const h = s / 3600;
    const ex = (x, tau) => (x >= 0 ? Math.exp(-x / tau) : 0);
    const bump = (x, w) => Math.exp(-((x / w) ** 2));
    switch (prof) {
      case 'index':
        if (h >= 17 && h < 18) return 0;
        if (h >= 9.5 && h < 16) return 0.6 + 1.9 * ex(h - 9.5, 0.45) + 0.55 * Math.exp(-(16 - h) / 0.5) - 0.1 * bump(h - 12.5, 1) + 0.16 * bump(h - 10, 0.08) + 0.1 * bump(h - 14, 0.1);
        if (h >= 16) return 0.14 + 0.45 * ex(h - 16, 0.12);
        if (h >= 18 || h < 2) { const x = h >= 18 ? h - 18 : h + 6; return 0.13 + 0.24 * ex(x, 0.3) + 0.05 * bump(x - 2, 0.3) + 0.04 * bump(x - 3.5, 0.3); }
        if (h < 8) return 0.15 + 0.28 * ex(h - 3, 0.6) + 0.03 * (h - 2);
        return 0.34 + 0.14 * (h - 8) + 0.3 * ex(h - 8.5, 0.15);
      case 'stock':
        if (h >= 9.5 && h < 16) return 0.58 + 2.1 * ex(h - 9.5, 0.4) + 0.62 * Math.exp(-(16 - h) / 0.45) - 0.1 * bump(h - 12.5, 1);
        if (h >= 4 && h < 9.5) return 0.03 + 0.2 * Math.exp(-(9.5 - h) / 0.8) + 0.07 * ex(h - 8, 0.4);
        return 0;
      case 'small':
        if (h >= 9.5 && h < 16) return 0.3 + 3.6 * ex(h - 9.5, 0.38) + 0.35 * ex(h - 9.5, 1.6) + 0.22 * Math.exp(-(16 - h) / 0.4);
        if (h >= 4 && h < 9.5) return 0.05 + 0.5 * Math.exp(-(9.5 - h) / 1.1) + 0.15 * ex(h - 7, 0.5) + 0.12 * ex(h - 8, 0.5);
        return 0;
      case 'energy':
        if (h >= 17 && h < 18) return 0;
        if (h >= 9 && h < 14.5) return 0.62 + 1.5 * ex(h - 9, 0.5) + 0.3 * bump(h - 10.5, 0.12) + 0.5 * Math.exp(-(14.5 - h) / 0.15) - 0.1 * bump(h - 12, 0.7);
        if (h >= 14.5) return 0.25 + 0.35 * ex(h - 14.5, 0.2);
        if (h >= 18 || h < 2) { const x = h >= 18 ? h - 18 : h + 6; return 0.17 + 0.2 * ex(x, 0.3) + 0.04 * bump(x - 2.5, 0.4); }
        if (h < 8) return 0.19 + 0.25 * ex(h - 3, 0.7);
        return 0.32 + 0.1 * (h - 8) + 0.3 * ex(h - 8.5, 0.15);
      case 'metal':
        if (h >= 17 && h < 18) return 0;
        if (h >= 8 + 1 / 3 && h < 13.5) return 0.55 + 1.2 * ex(h - 8.3333, 0.45) + 0.28 * bump(h - 9.5, 0.12) + 0.18 * bump(h - 10, 0.1) + 0.45 * Math.exp(-(13.5 - h) / 0.15);
        if (h >= 13.5) return 0.24 + 0.3 * ex(h - 13.5, 0.2);
        if (h >= 18 || h < 2) { const x = h >= 18 ? h - 18 : h + 6; return 0.21 + 0.16 * ex(x, 0.3) + 0.12 * bump(x - 2.5, 1.2) + 0.06 * bump(x - 3.5, 0.4); }
        if (h < 8) return 0.23 + 0.35 * ex(h - 3, 0.7);
        return 0.37 + 0.3 * ex(h - 8.5, 0.12);
      default: return 1;
    }
  }
  // Normalise so the average over 9:30–16:00 is 1.
  const NORM = {};
  for (const p of ['index', 'stock', 'small', 'energy', 'metal']) {
    let s = 0, n = 0;
    for (let t = H(9, 30); t < H(16); t += 30) { s += actRaw(p, t); n++; }
    NORM[p] = s / n;
  }
  function activity(prof, t) { return actRaw(prof, LV.tod(t)) / NORM[prof]; }
  function profileOf(def) {
    if (def.cls === 'small') return 'small';
    if (def.kind === 'future') return def.cls === 'energy' ? 'energy' : def.cls === 'metal' ? 'metal' : 'index';
    return 'stock';
  }

  // ---------- plans ----------
  // Waypoints {t, a, k}: at time t the anchor is a (log units above the plan's base price), approached
  // with mean-reversion rate k (per second) during the segment that ends there.
  class Plan {
    constructor(t0, wps, name, info) {
      this.t0 = t0; this.wps = wps; this.name = name; this.info = info || null; this.base = 0;
    }
    seg(t) {
      const w = this.wps;
      let i = 0;
      while (i < w.length - 1 && w[i + 1].t <= t) i++;
      return i;
    }
    at(t) {
      const w = this.wps;
      if (t <= w[0].t) return w[0].a;
      const i = this.seg(t);
      if (i >= w.length - 1) return w[w.length - 1].a;
      const u = (t - w[i].t) / Math.max(1, w[i + 1].t - w[i].t);
      const s = u * u * (3 - 2 * u);
      return w[i].a + (w[i + 1].a - w[i].a) * s;
    }
    kappa(t) {
      const w = this.wps;
      const i = this.seg(t);
      return i >= w.length - 1 ? w[w.length - 1].k : w[i + 1].k;
    }
  }
  const hl = (min) => LN2 / (min * 60);

  // A plan builder: minutes from t0, amplitude in units of sd. Session lengths other than 390 minutes scale.
  function builder(t0, t1, sd) {
    const f = (t1 - t0) / DAY;
    const wps = [{ t: t0, a: 0, k: hl(20) }];
    let m = 0, last = 0;
    return {
      get m() { return m; }, get a() { return last; },
      go(dm, a, halfLife) {
        m = Math.min(390, m + dm);
        last = a;
        const t = t0 + m * 60 * f;
        if (t > wps[wps.length - 1].t + 1) wps.push({ t, a: a * sd, k: hl(halfLife * f) });
        else wps[wps.length - 1] = { t: wps[wps.length - 1].t, a: a * sd, k: hl(halfLife * f) };
        return this;
      },
      end(a, halfLife) { if (m < 390) this.go(390 - m, a, halfLife); return wps; },
      wps
    };
  }

  const DAY_TYPES = {
    trend: { name: 'Trend day', w: 0.18 },
    balance: { name: 'Balance day', w: 0.3 },
    normvar: { name: 'Normal variation', w: 0.24 },
    double: { name: 'Double distribution', w: 0.12 },
    reversal: { name: 'Reversal day', w: 0.16 }
  };
  function pickDayType(r) {
    const keys = Object.keys(DAY_TYPES);
    return r.weighted(keys, keys.map((k) => DAY_TYPES[k].w));
  }

  // The regular session of a driver or a stock: the day type decides the shape.
  function rthPlan(r, type, t0, t1, sd, dir) {
    dir = dir || r.sign();
    const b = builder(t0, t1, sd);
    switch (type) {
      case 'trend': {
        b.go(r.range(5, 14), -dir * r.range(0.05, 0.2), 6);
        b.go(r.range(45, 75), dir * r.range(0.65, 0.95), 22);
        b.go(r.range(30, 55), dir * (b.a * dir - r.range(0.12, 0.25)), 16);
        b.go(r.range(50, 80), dir * r.range(1.25, 1.65), 24);
        b.go(r.range(30, 50), dir * (b.a * dir - r.range(0.15, 0.3)), 18);
        b.go(r.range(55, 80), dir * r.range(1.8, 2.3), 28);
        return new Plan(t0, b.end(dir * r.range(1.95, 2.5), 30), 'trend', { dir });
      }
      case 'balance': {
        const s1 = r.sign();
        b.go(r.range(8, 25), s1 * r.range(0.25, 0.45), 7);
        b.go(r.range(25, 45), -s1 * r.range(0.2, 0.4), 12);
        let s = s1;
        while (b.m < 360) { b.go(r.range(35, 80), s * r.range(0.08, 0.34), r.range(12, 20)); s = -s; }
        return new Plan(t0, b.end(r.normal() * 0.1, 18), 'balance', { dir: 0 });
      }
      case 'normvar': {
        const s1 = r.sign();
        const ib = r.range(0.3, 0.5);
        b.go(r.range(8, 25), s1 * ib, 7);
        b.go(r.range(25, 40), -s1 * r.range(0.15, 0.35), 12);
        b.go(r.range(20, 60), dir * r.range(0.05, 0.2), 16);
        b.go(r.range(45, 90), dir * (ib + r.range(0.4, 0.8)), 16);
        const lvl = b.a;
        while (b.m < 360) b.go(r.range(35, 70), lvl + r.normal() * 0.15, r.range(14, 22));
        return new Plan(t0, b.end(lvl + r.normal() * 0.12, 20), 'normvar', { dir });
      }
      case 'double': {
        const s1 = r.sign();
        b.go(r.range(10, 25), s1 * r.range(0.15, 0.3), 8);
        let s = -s1;
        const breakAt = r.range(140, 210);
        while (b.m < breakAt) { b.go(r.range(30, 55), s * r.range(0.08, 0.25), 12); s = -s; }
        b.go(r.range(30, 60), dir * r.range(1.1, 1.6), 9);
        const lvl = b.a;
        while (b.m < 360) b.go(r.range(30, 60), lvl + r.normal() * 0.14, 14);
        return new Plan(t0, b.end(lvl + r.normal() * 0.1, 16), 'double', { dir });
      }
      case 'reversal': {
        b.go(r.range(50, 90), dir * r.range(0.7, 1.1), 18);
        b.go(r.range(30, 60), dir * r.range(0.6, 1.0), 12);
        b.go(r.range(90, 150), -dir * r.range(0.3, 0.8), 22);
        return new Plan(t0, b.end(-dir * r.range(0.3, 0.9), 22), 'reversal', { dir });
      }
      default:
        return flatPlan(t0, t1, 90);
    }
  }

  // Quiet anchor: price wanders with weak pull back to where it started.
  function flatPlan(t0, t1, halfLifeMin, name) {
    return new Plan(t0, [{ t: t0, a: 0, k: hl(halfLifeMin) }, { t: t1, a: 0, k: hl(halfLifeMin) }], name || 'flat');
  }
  // Overnight: Asia drifts, Europe opens with a leg, premarket settles.
  function onPlan(r, t0, t1, sd) {
    const a1 = r.normal() * 0.22, a2 = a1 + r.normal() * 0.32, a3 = a2 + r.normal() * 0.16;
    const t2 = Math.max(t0 + 600, H(3)), t3 = Math.max(t2 + 600, H(7));
    return new Plan(t0, [
      { t: t0, a: 0, k: hl(90) }, { t: Math.min(t2 - 300, t0 + (t2 - t0) * 0.7), a: a1 * sd, k: hl(90) },
      { t: t3, a: a2 * sd, k: hl(60) }, { t: t1, a: a3 * sd, k: hl(45) }
    ], 'overnight');
  }

  // Small-cap runner. Premarket: news, a gap up, a premarket high. Regular session: the playbook.
  // Amplitudes are log moves (the runner's day range R is 25–70%).
  function runnerPlans(r, info, rth0, rth1) {
    const g = info.gap;
    const tn = info.newsAt;
    const pmhAt = r.range(Math.max(tn + 900, H(7, 45)), H(9, 15));
    const pm = new Plan(tn, [
      { t: tn, a: 0, k: hl(1) },
      { t: tn + 90, a: g * r.range(0.45, 0.7), k: LN2 / 25 },
      { t: tn + 900, a: g * r.range(0.72, 0.95), k: hl(3) },
      { t: pmhAt, a: g * r.range(1.08, 1.25), k: hl(6) },
      { t: H(9, 15), a: g * r.range(0.9, 1.02), k: hl(6) },
      { t: rth0, a: g * r.range(0.95, 1.05), k: hl(4) }
    ], 'premarket', { newsAt: tn });
    const R = clamp(r.lognormal(0.4, 0.35), 0.22, 0.75) * (info.lowFloat ? 1.25 : 1);
    const b = { wps: [{ t: rth0, a: 0, k: hl(1) }] };
    const go = (min, a, hlMin) => { b.wps.push({ t: rth0 + min * 60, a: a * R, k: hl(hlMin) }); };
    const tail = (a) => { const last = b.wps[b.wps.length - 1]; if (last.t < rth1) b.wps.push({ t: rth1, a: a * R, k: hl(25) }); };
    switch (info.play) {
      case 'gapgo':
        go(1, -r.range(0.02, 0.06), 0.4); go(r.range(4, 7), r.range(0.3, 0.42), 1.2); go(r.range(9, 13), r.range(0.2, 0.3), 1.5);
        go(r.range(18, 24), r.range(0.62, 0.8), 2); go(r.range(28, 34), r.range(0.48, 0.6), 2.5); go(r.range(40, 55), r.range(0.85, 1.05), 3);
        go(r.range(70, 90), r.range(0.55, 0.7), 6); go(r.range(130, 170), r.range(0.4, 0.55), 12); go(r.range(250, 300), r.range(0.3, 0.5), 18); tail(r.range(0.25, 0.5));
        break;
      case 'firstpb':
        go(r.range(1.5, 3), r.range(0.04, 0.1), 0.6); go(r.range(6, 9), -r.range(0.3, 0.42), 1.2); go(r.range(11, 15), -r.range(0.34, 0.44), 1.5);
        go(r.range(20, 26), r.range(0.05, 0.15), 2); go(r.range(32, 40), r.range(0.45, 0.6), 2.5); go(r.range(45, 58), r.range(0.62, 0.8), 3);
        go(r.range(75, 95), r.range(0.4, 0.55), 6); go(r.range(150, 190), r.range(0.3, 0.45), 12); tail(r.range(0.12, 0.35));
        break;
      case 'fade':
        go(r.range(1.5, 3), r.range(0.04, 0.12), 0.6); go(r.range(8, 12), -r.range(0.15, 0.25), 1.5); go(r.range(20, 28), -r.range(0.05, 0.12), 2.5);
        go(r.range(40, 55), -r.range(0.38, 0.5), 4); go(r.range(65, 85), -r.range(0.28, 0.36), 6); go(r.range(120, 160), -r.range(0.52, 0.65), 12);
        go(r.range(240, 280), -r.range(0.5, 0.6), 18); tail(-r.range(0.62, 0.8));
        break;
      case 'popdrop':
        go(1, r.range(0.12, 0.2), 0.3); go(r.range(2.5, 4), r.range(0.34, 0.46), 0.6); go(r.range(5.5, 7.5), r.range(0.02, 0.1), 0.8);
        go(r.range(9, 13), -r.range(0.25, 0.36), 1); go(r.range(28, 38), -r.range(0.48, 0.6), 4); go(r.range(80, 100), -r.range(0.6, 0.7), 10); tail(-r.range(0.55, 0.72));
        break;
      case 'squeeze':
        go(r.range(2, 3), r.range(0.14, 0.24), 0.6); go(r.range(7, 9), r.range(0.52, 0.66), 1); go(r.range(13, 17), r.range(0.42, 0.52), 1.5);
        go(r.range(23, 28), r.range(0.95, 1.15), 1.5); go(r.range(32, 38), r.range(1.3, 1.55), 1.5); go(r.range(42, 48), r.range(0.85, 1.0), 1.5);
        go(r.range(55, 68), r.range(0.55, 0.7), 3); go(r.range(130, 160), r.range(0.6, 0.78), 10); tail(r.range(0.35, 0.55));
        break;
      default: {
        let m = 0, s = 1;
        while (m < 330) { m += r.range(9, 22); go(m, s * r.range(0.08, 0.2), 2.5); s = -s; }
        tail(r.normal() * 0.08);
      }
    }
    b.wps.sort((x, y) => x.t - y.t);
    const rp = new Plan(rth0, b.wps, info.play, { R });
    return { pm, rth: rp, R };
  }

  // ---------- a random path ----------
  // lf: log price relative to where the path started. sd: daily volatility over a 9:30–16:00 window.
  class Path {
    constructor(o) {
      this.name = o.name || '';
      this.sd = o.sd; this.prof = o.prof; this.rng = o.rng; this.volScale = o.volScale || 1;
      this.lf = 0; this.lv = this.rng.normal() * 0.15; this.aOff = 0;
      this.plan = null; this.plans = [];
      this.effects = []; this.pendingJump = 0;
      this.tails = o.tails === undefined ? 1 : o.tails;
      this.act = 1; this.volMult = 1; this.actMult = 1; this.extVol = 1;
      this.lastDl = 0;
    }
    schedule(plan) { this.plans.push(plan); this.plans.sort((a, b) => a.t0 - b.t0); }
    replacePlan(plan, t) {
      this.plans = this.plans.filter((p) => p.t0 > t);
      plan.base = this.lf; this.aOff = 0; this.plan = plan;
    }
    anchor(t) { return this.plan ? this.plan.base + this.plan.at(t) + this.aOff : this.lf; }
    anchorSlope(t) { return this.plan ? (this.plan.at(t + 60) - this.plan.at(t - 60)) / 120 : 0; }
    shift(d, perm) { this.lf += d; this.aOff += d * (perm === undefined ? 1 : perm); }
    jump(j) { this.pendingJump += j; }
    step(t, dt) {
      while (this.plans.length && this.plans[0].t0 <= t) {
        const p = this.plans.shift();
        p.base = this.lf; this.aOff = 0; this.plan = p;
      }
      let volMult = 1, actMult = 1;
      if (this.effects.length) {
        this.effects = this.effects.filter((e) => e.until > t);
        for (const e of this.effects) {
          const left = clamp((e.until - t) / e.dur, 0, 1);
          if (e.kind === 'drift') { this.lf += e.rate * dt; this.aOff += e.rate * dt; }
          else if (e.kind === 'vol') volMult *= 1 + (e.mult - 1) * left;
          else if (e.kind === 'act') actMult *= e.mult;
          else if (e.kind === 'volc') volMult *= e.mult;
        }
      }
      volMult *= this.extVol;
      this.volMult = volMult; this.actMult = actMult;
      const act = activity(this.prof, t) * actMult;
      this.act = act;
      this.lv += (-this.lv * dt) / 1500 + 0.28 * Math.sqrt(dt / 1500) * this.rng.normal();
      this.lv = clamp(this.lv, -0.7, 1.1);
      const sig = this.sd * this.volScale * Math.sqrt(dt / DAY) * Math.sqrt(act) * Math.exp(this.lv) * volMult;
      let dl = sig * this.rng.normal();
      if (this.plan) {
        const k = Math.min(0.5, this.plan.kappa(t) * dt);
        dl += k * (this.anchor(t) - this.lf);
      }
      // Occasional air pockets and squeezes: fat tails.
      if (this.tails && act > 0 && this.rng.chance((dt / 5400) * act)) dl += this.rng.normal() * this.sd * this.volScale * 0.09 * this.tails;
      if (this.pendingJump) { dl += this.pendingJump; this.aOff += this.pendingJump; this.pendingJump = 0; }
      this.lf += dl;
      this.lastDl = dl;
      return dl;
    }
  }

  // ---------- reactions at key levels ----------
  // o: {rng, strength, sd (instrument daily vol), prof, tick, price() → log price, target (Path to push), zones(t) → [{L, s, key, label}]}
  class Reactor {
    constructor(o) {
      Object.assign(this, o);
      this.ep = null; this.touch = new Map(); this.cool = new Map(); this.prev = null; this.quiet = -Infinity;
      this.flow = 0; this.volBoost = 1; this.log = [];
    }
    u(t) { return this.sd * Math.sqrt(300 / DAY) * Math.sqrt(Math.max(0.15, activity(this.prof, t))); }
    tickLog(p) { return this.tick / Math.exp(p); }
    interrupt(t, dur) {
      if (this.ep) this.end(t, 60);
      this.quiet = Math.max(this.quiet, t + dur);
    }
    step(t, dt) {
      const p = this.price();
      const prev = this.prev === null ? p : this.prev;
      this.prev = p;
      this.flow *= Math.exp(-dt / 40);
      this.volBoost = 1 + (this.volBoost - 1) * Math.exp(-dt / 90);
      if (activity(this.prof, t) <= 0) return;
      const u = this.u(t);
      const tl = this.tickLog(p);
      const near = Math.max(1.5 * tl, 0.28 * u);
      if (this.ep) { this.run(t, dt, p, u, tl, near); return; }
      if (t < this.quiet) return;
      let best = null;
      for (const z of this.zones(t)) {
        const d = z.L - p;
        if (Math.abs(d) > near) continue;
        const dir = Math.sign(z.L - prev) || Math.sign(d) || 1;
        if ((p - prev) * dir <= 0 && Math.abs(d) > near * 0.4) continue;
        const c = this.cool.get(z.key);
        if (c !== undefined && t < c) continue;
        if (!best || Math.abs(d) < Math.abs(best.d)) best = { z, d, dir };
      }
      if (best) this.start(t, best.z, best.dir, u, tl, null);
    }
    start(t, z, dir, u, tl, forced) {
      const r = this.rng;
      const touches = this.touch.get(z.key) || 0;
      this.touch.set(z.key, touches + 1);
      const s = Math.min(0.97, z.s) * this.strength * Math.pow(0.76, touches);
      const slope = this.target.anchorSlope(t);
      const align = clamp((slope * dir * 300) / Math.max(1e-9, u) * 1.6, -1.5, 1.5);
      let pRej = forced !== null ? forced : 0.16 + 0.66 * s - 0.24 * Math.max(0, align) + 0.08 * Math.max(0, -align);
      pRej = clamp(pRej, 0.08, 0.9);
      if (r.chance(pRej)) {
        const style = r.weighted(['sweep', 'touch', 'front'], [0.22, 0.38, 0.4]);
        const over = style === 'sweep' ? r.range(0.18, 0.55) * u + 2 * tl : style === 'touch' ? r.int(0, 1) * tl : -(r.range(1, 3) * tl + r.range(0, 0.06) * u);
        this.ep = {
          type: 'reject', z, dir, style, C: z.L + dir * over, t0: t, until: t + r.range(150, 480) * (0.6 + s), touched: false,
          B: r.range(0.6, 1.5) * u * (0.7 + s), bounceDur: r.range(120, 420), perm: r.range(0.3, 0.7), s, flip: forced !== null
        };
      } else {
        this.ep = {
          type: 'break', z, dir, t0: t, until: t + 900, crossed: false, s,
          R: r.range(0.55, 1.6) * u * (0.6 + 0.7 * s), runDur: r.range(60, 240),
          follow: r.weighted(['retest', 'fail', 'run'], [0.5, 0.18, 0.32]), pulled: r.chance(0.35)
        };
      }
    }
    end(t, cdMin) {
      const ep = this.ep;
      if (!ep) return;
      this.log.push({ t, type: ep.type, style: ep.style || ep.follow, label: ep.z.label, dir: ep.dir, flip: !!ep.flip });
      if (this.log.length > 200) this.log.shift();
      this.cool.set(ep.z.key, t + (cdMin !== undefined ? cdMin : this.rng.range(300, 1200)));
      this.quiet = t + this.rng.range(20, 90);
      this.ep = null;
    }
    run(t, dt, p, u, tl, near) {
      const ep = this.ep, r = this.rng;
      if (ep.type === 'reject') {
        const beyond = (p - ep.C) * ep.dir;
        if (!ep.touched) {
          if (beyond >= -0.6 * tl) { ep.touched = true; ep.tTouch = t; }
          else if ((ep.z.L - p) * ep.dir > 2.4 * near || t > ep.until) { this.end(t); return; }
          else this.flow = ep.dir * 0.1;
        }
        if (beyond > 0) this.target.shift(-(beyond + r.float() * 0.8 * tl) * ep.dir, 0);
        if (ep.touched) {
          const el = t - ep.tTouch;
          if (el < ep.bounceDur) {
            this.target.shift((-ep.dir * ep.B * dt) / ep.bounceDur, ep.perm);
            this.flow = -ep.dir * 0.22 * (1 - el / ep.bounceDur) - ep.dir * 0.05;
          } else this.end(t);
        }
        return;
      }
      // break
      const past = (p - ep.z.L) * ep.dir;
      if (!ep.crossed) {
        if (past > 0.5 * tl) { ep.crossed = true; ep.tc = t; ep.phase = 'run'; this.volBoost = 1.7; }
        else if ((ep.z.L - p) * ep.dir > 2.4 * near || t > ep.until) { this.end(t); return; }
        else { this.flow = ep.dir * 0.14; return; }
      }
      if (ep.phase === 'run') {
        const el = t - ep.tc;
        if (el < ep.runDur) { this.target.shift((ep.dir * ep.R * dt) / ep.runDur, 0.6); this.flow = ep.dir * 0.3; return; }
        if (ep.follow === 'retest') { ep.phase = 'pull'; ep.tp = t; ep.pullDur = r.range(150, 600); return; }
        if (ep.follow === 'fail') { ep.phase = 'fail'; ep.tf = t; ep.failDur = r.range(90, 300); ep.F = ep.R + r.range(0.6, 1.4) * u; return; }
        this.end(t);
        return;
      }
      if (ep.phase === 'pull') {
        const el = t - ep.tp;
        if (past <= near * 0.6) {
          // Broken resistance becomes support (and the other way round): a strong reaction from the other side.
          const z = ep.z, dir = -ep.dir;
          this.ep = null;
          this.start(t, z, dir, u, tl, 0.72);
          return;
        }
        if (el > ep.pullDur * 2) { this.end(t); return; }
        this.target.shift((-ep.dir * u * 0.9 * dt) / ep.pullDur, 0.3);
        return;
      }
      if (ep.phase === 'fail') {
        const el = t - ep.tf;
        if (el < ep.failDur) { this.target.shift((-ep.dir * ep.F * dt) / ep.failDur, 0.7); this.flow = -ep.dir * 0.3; this.volBoost = 1.5; }
        else this.end(t);
      }
    }
    // Book wall the market simulator should show while an episode is on: {idx, side, mult} in the instrument's ticks.
    wall(toIdx) {
      const ep = this.ep;
      if (!ep) return null;
      if (ep.type === 'reject') return { idx: toIdx(ep.C), side: ep.dir, mult: 3 + ep.s * 6, iceberg: true };
      if (ep.type === 'break' && !ep.crossed) return { idx: toIdx(ep.z.L), side: ep.dir, mult: ep.pulled ? 0.3 : 2 + ep.s * 3, pulled: ep.pulled };
      return null;
    }
  }

  // ---------- 1-minute bars from path samples ----------
  class BarBuilder {
    constructor(tick, v1, sd, prof, rng, noWicks) {
      this.tick = tick; this.v1 = v1; this.sd = sd; this.prof = prof; this.rng = rng; this.noWicks = !!noWicks;
      this.bars = []; this.cur = null; this.lastC = null;
    }
    sample(t, logp, volMult) {
      const m = Math.floor(t / 60) * 60;
      const px = Math.exp(logp);
      if (!this.cur || this.cur.t !== m) {
        this.close();
        const o = this.lastC === null ? px : this.lastC;
        this.cur = { t: m, o, h: Math.max(o, px), l: Math.min(o, px), c: px, vm: volMult || 1 };
      } else {
        const c = this.cur;
        if (px > c.h) c.h = px;
        if (px < c.l) c.l = px;
        c.c = px;
        if (volMult) c.vm = Math.max(c.vm, volMult);
      }
    }
    close() {
      const c = this.cur;
      if (!c) return null;
      this.cur = null;
      const act = Math.max(0.02, activity(this.prof, c.t + 30));
      const s1 = this.sd * Math.sqrt(60 / DAY) * Math.sqrt(act);
      const r = this.rng;
      let h = c.h, l = c.l;
      if (!this.noWicks) { h *= Math.exp(Math.abs(r.normal()) * s1 * 0.35); l *= Math.exp(-Math.abs(r.normal()) * s1 * 0.35); }
      const tk = this.tick;
      const oi = Math.round(c.o / tk), ci = Math.round(c.c / tk);
      const hi = Math.max(oi, ci, Math.round(h / tk)), li = Math.min(oi, ci, Math.round(l / tk));
      const ret = Math.log(c.c / c.o);
      const z = ret / Math.max(1e-9, s1);
      let v = this.v1 * act * (0.6 + 0.35 * Math.min(4, Math.abs(z))) * r.lognormal(1, 0.3) * c.vm;
      v = this.v1 >= 5000 ? Math.round(v / 100) * 100 : Math.round(v);
      v = Math.max(1, v);
      const bf = clamp(0.5 + 0.36 * Math.tanh(z * 0.8) + r.normal() * 0.05, 0.05, 0.95);
      const bar = [c.t, oi, hi, li, ci, v, Math.round(v * bf)];
      this.bars.push(bar);
      this.lastC = c.c;
      return bar;
    }
  }

  DTA.paths = { DAY, activity, actRaw, profileOf, Plan, rthPlan, flatPlan, onPlan, runnerPlans, pickDayType, DAY_TYPES, Path, Reactor, BarBuilder, hl };
  DTA.activity = (t) => activity('stock', t);
})();
