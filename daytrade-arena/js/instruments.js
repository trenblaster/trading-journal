// Day Trade Arena: what can be traded, and how each kind of market behaves.
//
// Every instrument's price is built from shared "drivers" (the stock market, tech, small caps, oil, gold
// and rates) times its exposure to each, plus its own idiosyncratic path. Futures carry their real contract
// specs (tick size, dollars per point, day-trade margin, per-contract commission). Small-cap runners are
// generated per match: a fictional company, a premarket catalyst, a gap, and a playbook for the day.
// All companies are fictional. Index, crude and gold futures use their public contract specifications.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;
  const { SYMBOLS, RTH_OPEN, RTH_CLOSE, RNG } = DTA;

  const H = (h, m) => h * 3600 + (m || 0) * 60;

  // ---------- drivers ----------
  // sd: daily log volatility over a 9:30–16:00 window at average activity. prof: intraday activity profile.
  // Drivers with a price (MKT is the S&P futures, OIL is crude, GOLD is gold) react to their own key levels,
  // so every instrument that follows them feels those levels too.
  const DRIVERS = {
    MKT: { name: 'Stock market', sd: 0.0063, prof: 'index', px: 'ES', rth: [RTH_OPEN, RTH_CLOSE] },
    TECH: { name: 'Tech vs market', sd: 0.0042, prof: 'index', rth: [RTH_OPEN, RTH_CLOSE] },
    SMALL: { name: 'Small caps vs market', sd: 0.0058, prof: 'index', rth: [RTH_OPEN, RTH_CLOSE] },
    RATES: { name: 'Interest rates', sd: 0.0060, prof: 'index', rth: [RTH_OPEN, RTH_CLOSE] },
    OIL: { name: 'Crude oil', sd: 0.0118, prof: 'energy', px: 'CL', rth: [H(9), H(14, 30)] },
    GOLD: { name: 'Gold', sd: 0.0066, prof: 'metal', px: 'GC', rth: [H(8, 20), H(13, 30)] }
  };
  // How driver moves spill into each other (per unit move of the source).
  const CROSS = { OIL: { MKT: 0.12 }, GOLD: { RATES: -0.45, MKT: -0.05 }, RATES: { MKT: 0.12 } };

  // ---------- futures ----------
  // mult: dollars per 1.00 of price. margin: day-trade margin per contract at the default 4x setting.
  // comm: commission plus exchange fees per contract per side. round: [minor, major] round-number steps.
  // conf: how close (in ticks) two levels must be to count as one confluence zone.
  const FUTURES = {
    ES: {
      sym: 'ES', root: 'ES', name: 'E-mini S&P 500', cls: 'index', kind: 'future', sector: 'Index futures', p: 6640, tick: 0.25, mult: 50,
      margin: 2500, comm: 2.25, drivers: { MKT: 1 }, lead: 'MKT', idio: 0, reactor: 0, depth: 420, spread: 1, spreadVol: 0.06,
      printRate: 8, printSize: 5, round: [25, 100], conf: 8, rth: [RTH_OPEN, RTH_CLOSE], orMin: 15,
      micro: { sym: 'MES', name: 'Micro E-mini S&P 500', depth: 160, printSize: 3 },
      desc: 'The S&P 500 future. Deep book, respects prior-day and overnight levels to the tick, moves on data at 8:30 and the cash open.'
    },
    NQ: {
      sym: 'NQ', root: 'NQ', name: 'E-mini Nasdaq-100', cls: 'index', kind: 'future', sector: 'Index futures', p: 24480, tick: 0.25, mult: 20,
      margin: 3500, comm: 2.25, drivers: { MKT: 1.18, TECH: 1 }, idio: 0.0010, reactor: 0.5, depth: 9, spread: 1, spreadVol: 0.5,
      printRate: 7, printSize: 2, round: [100, 500], conf: 24, rth: [RTH_OPEN, RTH_CLOSE], orMin: 15,
      micro: { sym: 'MNQ', name: 'Micro E-mini Nasdaq-100', depth: 22, printSize: 2 },
      desc: 'Tech-heavy and fast. Thin book, wider swings than ES, likes to sweep highs and lows before reversing.'
    },
    RTY: {
      sym: 'RTY', root: 'RTY', name: 'E-mini Russell 2000', cls: 'index', kind: 'future', sector: 'Index futures', p: 2465, tick: 0.1, mult: 50,
      margin: 1500, comm: 2.25, drivers: { MKT: 1.08, SMALL: 1 }, idio: 0.0012, reactor: 0.6, depth: 20, spread: 1, spreadVol: 0.4,
      printRate: 2.2, printSize: 2, round: [10, 50], conf: 15, rth: [RTH_OPEN, RTH_CLOSE], orMin: 15,
      micro: { sym: 'M2K', name: 'Micro E-mini Russell 2000', depth: 30, printSize: 2 },
      desc: 'Small-cap index. Choppier than ES, trends hard when rates move.'
    },
    CL: {
      sym: 'CL', root: 'CL', name: 'Crude Oil (WTI)', cls: 'energy', kind: 'future', sector: 'Energy futures', p: 64.8, tick: 0.01, mult: 1000,
      margin: 2000, comm: 2.25, drivers: { OIL: 1 }, lead: 'OIL', idio: 0, reactor: 0, depth: 16, spread: 1, spreadVol: 0.35,
      printRate: 5, printSize: 2, round: [0.5, 1], conf: 8, rth: [H(9), H(14, 30)], orMin: 15,
      micro: { sym: 'MCL', name: 'Micro WTI Crude Oil', depth: 26, printSize: 2 },
      desc: 'Spiky and headline-driven. The pit opens at 9:00, EIA inventories hit at 10:30 on Wednesdays, and it runs stops through obvious levels.'
    },
    GC: {
      sym: 'GC', root: 'GC', name: 'Gold', cls: 'metal', kind: 'future', sector: 'Metals futures', p: 3980, tick: 0.1, mult: 100,
      margin: 2500, comm: 2.25, drivers: { GOLD: 1 }, lead: 'GOLD', idio: 0, reactor: 0, depth: 8, spread: 1, spreadVol: 0.4,
      printRate: 3, printSize: 2, round: [10, 50], conf: 15, rth: [H(8, 20), H(13, 30)], orMin: 15,
      micro: { sym: 'MGC', name: 'Micro Gold', depth: 14, printSize: 2 },
      desc: 'Trends on rates and the dollar, active in Asia and London, clean moves between round numbers.'
    }
  };

  // ---------- stocks ----------
  // Extra fields on the tickers defined in config.js. idio: the stock's own daily volatility.
  const STOCK_EXTRA = {
    SPYR: { p: 662.4, cls: 'etf', drivers: { MKT: 1 }, idio: 0.0005, reactor: 0, round: [1, 5], orMin: 15, printRate: 3.2, printSize: 200 },
    NOVA: { cls: 'large', drivers: { MKT: 1.2, TECH: 0.9 }, idio: 0.011, reactor: 0.6, round: [1, 5], orMin: 15 },
    CHIP: { cls: 'large', drivers: { MKT: 1.4, TECH: 1.2 }, idio: 0.015, reactor: 0.6, round: [0.5, 5], orMin: 15 },
    FINX: { cls: 'large', drivers: { MKT: 1, RATES: 0.8 }, idio: 0.008, reactor: 0.6, round: [0.5, 1], orMin: 15 },
    OILX: { cls: 'large', drivers: { MKT: 0.4, OIL: 0.55 }, idio: 0.008, reactor: 0.6, round: [0.5, 1], orMin: 15 },
    MEME: { cls: 'small', drivers: { MKT: 0.6, SMALL: 0.6 }, idio: 0.07, reactor: 1.05, orMin: 5, spreadVol: 0.6 },
    BIOT: { cls: 'small', drivers: { MKT: 0.5, SMALL: 0.5 }, idio: 0.045, reactor: 1, orMin: 5, spreadVol: 0.6 },
    QBIT: { cls: 'small', drivers: { MKT: 0.7, SMALL: 0.8 }, idio: 0.09, reactor: 1.1, orMin: 5, spreadVol: 0.7 }
  };
  for (const k in STOCK_EXTRA) {
    const d = SYMBOLS[k];
    if (!d) continue;
    Object.assign(d, { kind: 'stock', mult: 1, spreadVol: 0.35, rth: [RTH_OPEN, RTH_CLOSE], conf: 0 }, STOCK_EXTRA[k]);
    d.vol = totalVol(d);
  }
  for (const k in FUTURES) { SYMBOLS[k] = FUTURES[k]; FUTURES[k].vol = totalVol(FUTURES[k]); }

  // Total daily volatility of an instrument from its driver exposures and its own noise.
  function totalVol(def) {
    let v = (def.idio || 0) ** 2;
    for (const k in def.drivers || {}) v += (def.drivers[k] * DRIVERS[k].sd) ** 2;
    return Math.sqrt(v);
  }

  // Round-number steps for small stocks depend on the price: traders watch half and whole dollars.
  function stockRound(p) {
    if (p < 2) return [0.1, 0.5];
    if (p < 5) return [0.25, 1];
    if (p < 20) return [0.5, 1];
    if (p < 100) return [1, 5];
    if (p < 500) return [5, 10];
    return [10, 50];
  }
  for (const k in STOCK_EXTRA) if (SYMBOLS[k] && !STOCK_EXTRA[k].round) SYMBOLS[k].round = stockRound(SYMBOLS[k].p);

  // Micro version of a futures contract: a tenth of the size, same price.
  function microOf(def) {
    if (!def.micro) return def;
    return Object.assign({}, def, {
      sym: def.micro.sym, name: def.micro.name, mult: def.mult / 10, margin: def.margin / 10, comm: 0.62,
      depth: def.micro.depth, printSize: def.micro.printSize, isMicro: true, full: def.sym, micro: null
    });
  }

  // ---------- small-cap runners ----------
  const SMALL_POOL = [
    { sym: 'VOLT', name: 'Voltaic Charging', sector: 'EV charging' },
    { sym: 'NRVX', name: 'Nervex Biosciences', sector: 'Biotech' },
    { sym: 'AIKO', name: 'Aiko Robotics', sector: 'AI robotics' },
    { sym: 'HYDR', name: 'Hydrova Clean Fuels', sector: 'Hydrogen' },
    { sym: 'KRYO', name: 'Kryos Cold Chain', sector: 'Logistics' },
    { sym: 'ORBT', name: 'Orbitra Space Systems', sector: 'Space' },
    { sym: 'BLKV', name: 'Blockvault Digital', sector: 'Crypto' },
    { sym: 'MDXR', name: 'Medixar Diagnostics', sector: 'Medtech' },
    { sym: 'DRNX', name: 'Dronix Defense', sector: 'Defense drones' },
    { sym: 'QNTA', name: 'Quanta Photonics', sector: 'Quantum' },
    { sym: 'LYTE', name: 'Lytehouse Media', sector: 'Social media' },
    { sym: 'GENQ', name: 'GeneQuest Oncology', sector: 'Biotech' },
    { sym: 'SOLR', name: 'Solaria Storage', sector: 'Solar' },
    { sym: 'NUKX', name: 'Nukex Micro-Reactors', sector: 'Nuclear' }
  ];
  // Premarket catalysts. bias shifts the playbook odds toward continuation (+) or fading (−).
  const CATALYSTS = [
    { text: '{name} signs multi-year supply deal with a Fortune 500 customer', bias: 0.1, secs: '*' },
    { text: '{name} announces AI partnership with MegaSoft', bias: 0.15, secs: '*' },
    { text: '{name} wins $48M Department of Defense contract', bias: 0.1, secs: ['Defense drones', 'Space', 'AI robotics'] },
    { text: '{name} reports positive Phase 2 topline data', bias: 0.05, secs: ['Biotech', 'Medtech'] },
    { text: '{name} receives FDA Fast Track designation', bias: 0, secs: ['Biotech', 'Medtech'] },
    { text: '{name} beats estimates, revenue up 212% year over year', bias: 0.15, secs: '*' },
    { text: '{name} adds $20M of bitcoin to its treasury', bias: -0.1, secs: ['Crypto', 'Social media', 'Logistics'] },
    { text: '{name} to be acquired? Unusual options activity and a vague press release', bias: -0.15, secs: '*' },
    { text: '{name} regains Nasdaq compliance, announces strategic review', bias: -0.1, secs: '*' },
    { text: '{name} unveils next-generation product line at trade show', bias: 0, secs: '*' },
    { text: '{name} in talks with the Department of Energy over grid project', bias: 0.05, secs: ['Nuclear', 'Solar', 'Hydrogen', 'EV charging'] }
  ];
  const PLAYBOOKS = {
    gapgo: { name: 'Gap and go', w: 0.26, desc: 'Held the premarket high, broke it early and ran with halts.' },
    firstpb: { name: 'Dip and rip', w: 0.2, desc: 'Flushed to VWAP after the open, then ripped to new highs.' },
    fade: { name: 'Gap and fade', w: 0.24, desc: 'Failed at the premarket high and faded with lower highs all day.' },
    popdrop: { name: 'Pop and drop', w: 0.12, desc: 'Spiked at the open, then an offering hit and it dumped.' },
    squeeze: { name: 'Halt squeeze', w: 0.1, desc: 'Low float and trapped shorts: halt after halt to the upside, then a blow-off top.' },
    chop: { name: 'Chop', w: 0.08, desc: 'Stuck between the premarket high and VWAP, faking out both ways.' }
  };

  // A fresh small-cap runner for this match. r: RNG. exclude: tickers already used.
  function makeRunner(r, exclude) {
    const pool = SMALL_POOL.filter((x) => !exclude.has(x.sym));
    const base = r.pick(pool.length ? pool : SMALL_POOL);
    const prev = Math.round(clampN(r.lognormal(4.2, 0.75), 1.2, 24) * 100) / 100;
    const float = Math.round(clampN(r.lognormal(8e6, 0.8), 0.9e6, 45e6) / 1e5) * 1e5;
    const lowFloat = float < 5e6;
    const cats = CATALYSTS.filter((c) => c.secs === '*' || c.secs.includes(base.sector));
    const cat = r.pick(cats);
    // Gap: 18% to 140%, bigger for lower floats.
    const gapPct = clampN(r.lognormal(lowFloat ? 0.62 : 0.42, 0.5), 0.18, 1.4);
    const w = {};
    for (const k in PLAYBOOKS) w[k] = PLAYBOOKS[k].w;
    w.gapgo += cat.bias; w.firstpb += cat.bias * 0.5; w.fade -= cat.bias; w.popdrop -= cat.bias * 0.5;
    if (lowFloat) { w.squeeze += 0.1; w.gapgo += 0.05; }
    if (gapPct > 0.8) { w.fade += 0.08; w.popdrop += 0.04; }
    const keys = Object.keys(w);
    const play = r.weighted(keys, keys.map((k) => Math.max(0.02, w[k])));
    const gapPrice = prev * (1 + gapPct);
    const liq = clampN(r.lognormal(1, 0.35), 0.5, 2);
    const shortInterest = Math.round(clampN(r.lognormal(0.12, 0.6), 0.03, 0.45) * 100) / 100;
    const def = {
      sym: base.sym, name: base.name, sector: base.sector, cls: 'small', kind: 'stock', mult: 1, runner: true,
      p: prev, tick: 0.01, drivers: { MKT: 0.5, SMALL: 0.8 }, idio: clampN(r.lognormal(0.08, 0.3), 0.05, 0.15), reactor: 1.1,
      depth: Math.round((gapPrice < 5 ? 4200 : gapPrice < 10 ? 2600 : 1400) * liq / 100) * 100,
      spread: gapPrice < 3 ? 1 : gapPrice < 10 ? 2 : 3, spreadVol: 0.7,
      printRate: 2.2 * liq, printSize: Math.round((gapPrice < 5 ? 900 : gapPrice < 10 ? 500 : 300) * liq / 100) * 100,
      cap: fmtCap(prev * float * 1.6), float, halts: true, htb: r.chance(0.7), borrowFee: Math.round(r.range(0.01, 0.06) * 100) / 100,
      maxShort: Math.round(float * 0.004 / 1000) * 1000, shortInterest,
      round: stockRound(gapPrice), conf: 0, rth: [RTH_OPEN, RTH_CLOSE], orMin: 5,
      runnerInfo: { gap: Math.log(1 + gapPct), gapPct, play, catalyst: cat.text.replace(/\{name\}/g, base.name), newsAt: Math.round(r.range(H(6, 30), H(8, 50)) / 60) * 60, lowFloat },
      desc: base.sector + ' small cap. ' + (lowFloat ? 'Low float (' + (float / 1e6).toFixed(1) + 'M shares).' : 'Float ' + (float / 1e6).toFixed(1) + 'M shares.') + ' Gapping up premarket on news.'
    };
    def.vol = totalVol(def);
    return def;
  }
  function fmtCap(v) { return v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : Math.round(v / 1e6) + 'M'; }
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- market presets for the lobby ----------
  // '@1'…'@3' are small-cap runners generated from the match seed.
  const MARKETS = [
    { id: 'index', name: 'Index futures', icon: '📈', syms: ['ES', 'NQ', 'RTY'], pick: ['ES', 'NQ'], futures: true, desc: 'ES, NQ and RTY. Levels to the tick, 8:30 data, the cash open at 9:30, stop runs above and below the overnight range.' },
    { id: 'commod', name: 'Oil & gold', icon: '🛢️', syms: ['CL', 'GC'], pick: ['CL', 'GC'], futures: true, desc: 'Crude and gold futures. Crude spikes on inventories and headlines; gold trends on rates.' },
    { id: 'futures', name: 'Futures mix', icon: '🌐', syms: ['ES', 'NQ', 'RTY', 'CL', 'GC'], pick: ['ES', 'NQ', 'CL', 'GC'], futures: true, desc: 'Stocks, tech, crude and gold, each with its own personality and its own key levels.' },
    { id: 'small', name: 'Small-cap runners', icon: '🚀', syms: ['@1', '@2', '@3', 'MEME', 'QBIT', 'BIOT'], pick: ['@1', '@2', '@3'], desc: 'Fresh gappers every match: premarket news, low floats, halts, VWAP and the premarket high decide everything.' },
    { id: 'stocks', name: 'Large caps', icon: '🏦', syms: ['SPYR', 'NOVA', 'CHIP', 'FINX', 'OILX'], pick: ['SPYR', 'NOVA', 'CHIP'], desc: 'Liquid stocks that move with the market. Clean trends, VWAP pullbacks and prior-day levels.' },
    { id: 'mixed', name: 'Mixed bag', icon: '🎲', syms: ['ES', 'NOVA', '@1', 'CL', 'MEME', 'OILX'], pick: ['ES', 'NOVA', '@1', 'CL'], desc: 'A bit of everything: futures, a large cap, a runner and crude.' }
  ];

  // ---------- sessions ----------
  const SESSIONS = [
    { id: 'full', name: 'Full day 9:30–16:00', start: RTH_OPEN, end: RTH_CLOSE },
    { id: 'premkt', name: 'Data & the open 8:00–10:30', start: H(8), end: H(10, 30), note: 'Premarket, 8:30 data, then the opening bell' },
    { id: 'open', name: 'Opening drive 9:30–11:00', start: RTH_OPEN, end: H(11) },
    { id: 'morning', name: 'Morning 9:30–12:00', start: RTH_OPEN, end: H(12) },
    { id: 'afternoon', name: 'Afternoon 13:00–16:00', start: H(13), end: RTH_CLOSE },
    { id: 'power', name: 'Power hour 15:00–16:00', start: H(15), end: RTH_CLOSE },
    { id: 'london', name: 'London open 2:30–5:00', start: H(2, 30), end: H(5), futuresOnly: true, note: 'Overnight session: thin, then Europe wakes up' }
  ];

  // ---------- economic calendar ----------
  // imp: 1–3. hit: driver response per unit of surprise (in each driver's daily sd). ws: chance of a
  // whipsaw (first move reverses, then the real move). fc: forecast/actual formatting.
  const CAL = {
    cpi: { name: 'CPI', long: 'Consumer prices (CPI) m/m', at: H(8, 30), imp: 3, hit: { MKT: -0.55, RATES: 0.9, GOLD: -0.55, TECH: -0.25, SMALL: -0.3 }, ws: 0.45, fmt: { base: 0.3, step: 0.1, dp: 1, unit: '%', up: 'hotter', down: 'cooler' } },
    nfp: { name: 'Nonfarm payrolls', long: 'Nonfarm payrolls', at: H(8, 30), imp: 3, hit: { MKT: 0.35, RATES: 0.85, GOLD: -0.5, SMALL: 0.2 }, ws: 0.55, fmt: { base: 145, step: 45, dp: 0, unit: 'K', up: 'stronger', down: 'weaker' } },
    ppi: { name: 'PPI', long: 'Producer prices (PPI) m/m', at: H(8, 30), imp: 2, hit: { MKT: -0.3, RATES: 0.5, GOLD: -0.3 }, ws: 0.35, fmt: { base: 0.2, step: 0.1, dp: 1, unit: '%', up: 'hotter', down: 'cooler' } },
    retail: { name: 'Retail sales', long: 'Retail sales m/m', at: H(8, 30), imp: 2, hit: { MKT: 0.25, RATES: 0.45, SMALL: 0.2 }, ws: 0.35, fmt: { base: 0.4, step: 0.3, dp: 1, unit: '%', up: 'stronger', down: 'weaker' } },
    claims: { name: 'Jobless claims', long: 'Initial jobless claims', at: H(8, 30), imp: 1, hit: { MKT: -0.12, RATES: -0.25 }, ws: 0.2, fmt: { base: 224, step: 9, dp: 0, unit: 'K', up: 'more layoffs', down: 'fewer layoffs' } },
    ism: { name: 'ISM manufacturing', long: 'ISM manufacturing PMI', at: H(10), imp: 2, hit: { MKT: 0.3, RATES: 0.35, OIL: 0.25 }, ws: 0.3, fmt: { base: 49.2, step: 0.8, dp: 1, unit: '', up: 'stronger', down: 'weaker' } },
    jolts: { name: 'JOLTS', long: 'JOLTS job openings', at: H(10), imp: 1, hit: { MKT: -0.1, RATES: 0.3 }, ws: 0.2, fmt: { base: 7.4, step: 0.25, dp: 2, unit: 'M', up: 'stronger', down: 'weaker' } },
    umich: { name: 'Consumer sentiment', long: 'UMich consumer sentiment', at: H(10), imp: 1, hit: { MKT: 0.15, RATES: 0.1 }, ws: 0.2, fmt: { base: 61.5, step: 2.2, dp: 1, unit: '', up: 'stronger', down: 'weaker' } },
    eia: { name: 'EIA crude', long: 'EIA crude oil inventories', at: H(10, 30), imp: 3, hit: { OIL: -0.75 }, ws: 0.4, fmt: { base: -1.2, step: 2.6, dp: 1, unit: 'M bbl', up: 'surprise build', down: 'bigger draw' } },
    auction: { name: '10-yr auction', long: '10-year Treasury auction', at: H(13), imp: 1, hit: { RATES: 0.4, MKT: -0.12, GOLD: -0.15 }, ws: 0.2, fmt: null },
    fomc: { name: 'FOMC', long: 'FOMC rate decision', at: H(14), imp: 3, hit: { MKT: 0.55, RATES: -0.9, GOLD: 0.6, TECH: 0.3, SMALL: 0.4 }, ws: 0.65, fmt: null },
    presser: { name: 'Fed presser', long: 'Fed Chair press conference', at: H(14, 30), imp: 2, hit: { MKT: 0.45, RATES: -0.6, GOLD: 0.4 }, ws: 0.4, fmt: null },
    speaker: { name: 'Fed speaker', long: 'Fed governor speaks', at: [H(11), H(15)], imp: 1, hit: { MKT: -0.15, RATES: 0.25 }, ws: 0.2, fmt: null }
  };
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  // What typically lands on each weekday (probabilities).
  const WEEK_CAL = [
    [['ism', 0.5], ['speaker', 0.4]],
    [['jolts', 0.6], ['umich', 0.2], ['speaker', 0.3], ['auction', 0.3]],
    [['eia', 1], ['cpi', 0.25], ['fomc', 0.18], ['auction', 0.4], ['speaker', 0.2]],
    [['claims', 1], ['ppi', 0.35], ['retail', 0.25], ['speaker', 0.3]],
    [['nfp', 0.4], ['umich', 0.5], ['retail', 0.2], ['speaker', 0.3]]
  ];

  // The day's calendar. Returns [{id, name, long, t, imp, hit, ws, fc}].
  function makeCalendar(r, weekday, dayOffset) {
    const out = [];
    for (const [id, p] of WEEK_CAL[weekday]) {
      if (!r.chance(p)) continue;
      if (id === 'cpi' && out.some((e) => e.id === 'nfp')) continue;
      const c = CAL[id];
      const at = Array.isArray(c.at) ? Math.round(r.range(c.at[0], c.at[1]) / 300) * 300 : c.at;
      out.push({ id, name: c.name, long: c.long, t: at + dayOffset, imp: c.imp, hit: c.hit, ws: c.ws, fmt: c.fmt, fc: c.fmt ? fmtVal(c.fmt, c.fmt.base + c.fmt.step * Math.round(r.normal() * 1.2) * 0.5) : null });
      if (id === 'fomc') out.push({ id: 'presser', name: CAL.presser.name, long: CAL.presser.long, t: CAL.presser.at + dayOffset, imp: 2, hit: CAL.presser.hit, ws: CAL.presser.ws, fmt: null, fc: null });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  function fmtVal(f, v) {
    return (+v.toFixed(f.dp)).toFixed(f.dp) + f.unit;
  }

  Object.assign(DTA, {
    DRIVERS, CROSS, FUTURES, SMALL_POOL, CATALYSTS, PLAYBOOKS, MARKETS, SESSIONS, CAL, WEEKDAYS,
    makeRunner, makeCalendar, microOf, totalVol, stockRound, fmtCalVal: fmtVal
  });
  void RNG;
})();
