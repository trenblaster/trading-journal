// Day Trade Arena: game content. Tickers, scenarios, news, bots, modes and defaults.
// All companies are fictional. Volatility numbers are daily log-return standard deviations of each
// stock's own (non-market) moves; the market, oil and rates factors add on top through each beta.
(function () {
  'use strict';
  const DTA = (typeof window !== 'undefined' ? window : globalThis).DTA;

  const RTH_OPEN = 9 * 3600 + 30 * 60;   // 9:30
  const RTH_CLOSE = 16 * 3600;           // 16:00
  const BAR_SEC = 5;                     // base candle: 5 market seconds

  // depth: shares resting at the touch before noise. printRate: prints per market second at an
  // average moment. printSize: median print in shares. borrowFee: locate cost per share shorted.
  const SYMBOLS = {
    SPYR: { sym: 'SPYR', name: 'Spyre 500 ETF', sector: 'Index', p: 521.30, beta: 1.0, vol: 0.0022, depth: 3600, spread: 1, printRate: 2.1, printSize: 180, cap: 'ETF', float: 0, halts: false, htb: false, desc: 'The index. Deep, liquid, slow.' },
    NOVA: { sym: 'NOVA', name: 'Nova Robotics', sector: 'Tech', p: 182.40, beta: 1.3, vol: 0.017, depth: 650, spread: 1, printRate: 1.6, printSize: 110, cap: '312B', float: 1.7e9, halts: false, htb: false, desc: 'Mega-cap tech. Clean trends, moves with the market.' },
    CHIP: { sym: 'CHIP', name: 'Chiplet Semiconductor', sector: 'Semis', p: 96.20, beta: 1.55, vol: 0.023, depth: 900, spread: 1, printRate: 1.5, printSize: 140, cap: '118B', float: 1.2e9, halts: false, htb: false, desc: 'High-beta semis. Amplifies every market move.' },
    FINX: { sym: 'FINX', name: 'Finex Bancorp', sector: 'Banks', p: 44.90, beta: 1.05, rates: 1.4, vol: 0.012, depth: 2400, spread: 1, printRate: 1.0, printSize: 230, cap: '71B', float: 1.6e9, halts: false, htb: false, desc: 'Big bank. Jumps on anything about interest rates.' },
    OILX: { sym: 'OILX', name: 'Oilex Energy', sector: 'Energy', p: 63.75, beta: 0.45, oil: 1.0, vol: 0.010, depth: 1700, spread: 1, printRate: 1.0, printSize: 200, cap: '88B', float: 1.4e9, halts: false, htb: false, desc: 'Oil major. Follows crude more than stocks.' },
    MEME: { sym: 'MEME', name: 'MemeCo Holdings', sector: 'Retail', p: 4.18, beta: 0.8, vol: 0.075, depth: 7500, spread: 1, printRate: 1.9, printSize: 1400, cap: '310M', float: 18e6, halts: true, htb: true, borrowFee: 0.04, maxShort: 40000, shortInterest: 0.31, desc: 'Heavily shorted meme stock. Squeezes, halts, chaos.' },
    BIOT: { sym: 'BIOT', name: 'Biotiq Therapeutics', sector: 'Biotech', p: 11.62, beta: 0.6, vol: 0.045, depth: 3200, spread: 1, printRate: 1.2, printSize: 550, cap: '640M', float: 42e6, halts: true, htb: true, borrowFee: 0.03, maxShort: 30000, shortInterest: 0.18, desc: 'One-drug biotech. News makes or breaks it.' },
    ES: { sym: 'ES', name: 'S&P 500 futures', sector: 'Index', p: 5812.25, tick: 0.25, beta: 1.0, vol: 0.0015, depth: 900, spread: 1, printRate: 3.2, printSize: 6, cap: 'Futures', float: 0, halts: false, htb: false, desc: 'E-mini S&P. Deep book, grinds between levels, respects VWAP and round numbers.' },
    NQ: { sym: 'NQ', name: 'Nasdaq 100 futures', sector: 'Index', p: 20415.5, tick: 0.25, beta: 1.3, vol: 0.0018, depth: 180, spread: 1, printRate: 3.0, printSize: 3, cap: 'Futures', float: 0, halts: false, htb: false, desc: 'E-mini Nasdaq. Faster and wider swings than ES, sweeps highs and lows.' },
    CL: { sym: 'CL', name: 'Crude oil futures', sector: 'Commodity', p: 71.84, tick: 0.01, beta: 0.2, oil: 0.9, vol: 0.007, depth: 60, spread: 1, printRate: 2.6, printSize: 4, cap: 'Futures', float: 0, halts: false, htb: false, desc: 'WTI crude. Spiky, headline driven, stop runs through levels.' },
    GC: { sym: 'GC', name: 'Gold futures', sector: 'Commodity', p: 2648.3, tick: 0.1, beta: -0.2, rates: -1.2, vol: 0.007, depth: 40, spread: 1, printRate: 2.0, printSize: 3, cap: 'Futures', float: 0, halts: false, htb: false, desc: 'Gold. Trends on rates and the dollar, clean moves between levels.' },
    QBIT: { sym: 'QBIT', name: 'QuBit Quantum', sector: 'Tech', p: 2.37, beta: 1.1, vol: 0.10, depth: 12000, spread: 1, printRate: 2.0, printSize: 2800, cap: '82M', float: 3.4e6, halts: true, htb: true, borrowFee: 0.02, maxShort: 25000, shortInterest: 0.22, desc: 'Low-float small cap. Rips and dumps on nothing.' }
  };

  const SYMBOL_SETS = [
    { id: 'mixed', name: 'Mixed bag', syms: ['NOVA', 'MEME', 'OILX'] },
    { id: 'mega', name: 'Mega caps', syms: ['SPYR', 'NOVA', 'CHIP', 'FINX'] },
    { id: 'small', name: 'Small-cap runners', syms: ['MEME', 'QBIT', 'BIOT'] },
    { id: 'all', name: 'Whole market', syms: ['SPYR', 'NOVA', 'CHIP', 'FINX', 'OILX', 'MEME'] },
    { id: 'index', name: 'Index futures (ES, NQ)', syms: ['ES', 'NQ'] },
    { id: 'commod', name: 'Oil & gold (CL, GC)', syms: ['CL', 'GC'] },
    { id: 'futures', name: 'Futures (ES, NQ, CL, GC)', syms: ['ES', 'NQ', 'CL', 'GC'] },
    { id: 'NOVA', name: 'Just NOVA', syms: ['NOVA'] },
    { id: 'MEME', name: 'Just MEME', syms: ['MEME'] },
    { id: 'QBIT', name: 'Just QBIT', syms: ['QBIT'] },
    { id: 'SPYR', name: 'Just SPYR', syms: ['SPYR'] }
  ];

  const SESSIONS = [
    { id: 'full', name: 'Full day 9:30–16:00', start: RTH_OPEN, end: RTH_CLOSE },
    { id: 'morning', name: 'Morning 9:30–12:00', start: RTH_OPEN, end: 12 * 3600 },
    { id: 'open', name: 'Opening drive 9:30–11:00', start: RTH_OPEN, end: 11 * 3600 },
    { id: 'power', name: 'Power hour 15:00–16:00', start: 15 * 3600, end: RTH_CLOSE }
  ];

  const TIMEFRAMES = [
    { sec: 5, label: '5s' }, { sec: 15, label: '15s' }, { sec: 30, label: '30s' },
    { sec: 60, label: '1m' }, { sec: 120, label: '2m' }, { sec: 300, label: '5m' },
    { sec: 900, label: '15m' }, { sec: 1800, label: '30m' }
  ];

  // ---------- scenarios ----------
  // Event fields (all optional): at (clock or 'open'), target ('MKT', 'OIL', 'RATES', a symbol, or '*'),
  // jump (log move, or [min,max]), drift {move, dur}, vol {mult, dur}, depth {mult, dur}, flow {bias, dur},
  // halt (seconds), regime {type, dur, kappa}, noLocate (true/false), headline {text, tone}, branch {p, yes, no}.
  // Numbers given as [a,b] are drawn from the match seed, so a scenario plays differently every seed.
  const SCENARIOS = [
    {
      id: 'flash', name: 'Flash Crash', icon: '⚡', session: ['10:00', '12:30'], minutes: 8,
      symbols: ['SPYR', 'NOVA', 'CHIP'], volScale: 0.8, calm: true,
      brief: 'A sleepy, grinding-higher tape ahead of tomorrow\'s jobs report. Liquidity is thinner than it looks.',
      events: [
        { at: '10:18', target: 'MKT', headline: { text: 'Volumes running 30% below average ahead of payrolls', tone: 0 } },
        { at: '10:40', target: 'MKT', drift: { move: 0.004, dur: 1200 } },
        { at: '11:03', target: '*', depth: { mult: 0.3, dur: 1500 }, vol: { mult: 2.4, dur: 1500 } },
        { at: '11:05', target: 'MKT', jump: [-0.012, -0.008], drift: { move: [-0.05, -0.038], dur: 260 }, headline: { text: 'Sell programs slam index futures, bids vanish across the board', tone: -1, big: true } },
        { at: '11:10', target: 'MKT', drift: { move: [0.026, 0.034], dur: 1100 }, headline: { text: 'Exchange says "no technical issues"; dip buyers step in', tone: 1 } },
        { at: '11:45', target: 'MKT', drift: { move: [0.004, 0.012], dur: 2400 }, headline: { text: 'Regulators to review the morning\'s sell-off', tone: 0 } }
      ],
      debrief: 'At 11:05 automated sell programs hit a market with almost no resting bids. The index fell about 5% in four minutes, then retraced most of it within the half hour. Buying the flush with a tight stop, or shorting the first bounce failure, both paid. Holding a large long through the air pocket did not.'
    },
    {
      id: 'squeeze', name: 'Short Squeeze', icon: '🧨', session: ['9:30', '12:00'], minutes: 8,
      symbols: ['MEME', 'SPYR'], volScale: 1.0,
      brief: 'MEME has 38% of its float sold short and the internet has noticed. Borrow is getting expensive.',
      events: [
        { at: 'open', target: 'MEME', jump: [0.06, 0.1], headline: { text: '{sym} up premarket as short interest hits a record 38% of float', tone: 1 } },
        { at: '9:47', target: 'MEME', flow: { bias: 0.25, dur: 900 }, drift: { move: [0.18, 0.28], dur: 1300 }, vol: { mult: 1.8, dur: 1800 }, headline: { text: 'Reddit: "{sym} shorts haven\'t covered" thread hits the front page', tone: 1, big: true } },
        { at: '10:14', target: 'MEME', jump: [0.04, 0.08], drift: { move: [0.25, 0.4], dur: 900 }, noLocate: true, headline: { text: '{sym} cost to borrow spikes to 180%, no shares left to short', tone: 1, big: true } },
        { at: '10:41', target: 'MEME', jump: [-0.14, -0.09], drift: { move: [-0.34, -0.24], dur: 1800 }, flow: { bias: -0.25, dur: 1200 }, noLocate: false, headline: { text: '{name} files to sell up to 20M shares "at the market"', tone: -1, big: true } },
        { at: '11:25', target: 'MEME', regime: { type: 'chop', dur: 2400, kappa: 0.004 }, headline: { text: 'Retail flows into {sym} fade as options expire worthless', tone: -1 } }
      ],
      debrief: 'MEME squeezed in two legs, 9:47 and 10:14, with limit-up halts along the way. Shorts couldn\'t find borrow after 10:14. The 10:41 dilution filing ended it, and the stock gave back most of the move by lunch. Riding the legs and then flipping short on the offering was the winning path.'
    },
    {
      id: 'earnings', name: 'Earnings Gap', icon: '📊', session: ['9:30', '11:30'], minutes: 8,
      symbols: ['NOVA', 'CHIP', 'SPYR'], volScale: 1.0,
      brief: 'NOVA reported after yesterday\'s close. Does the gap hold, or does it fill?',
      events: [
        {
          at: 'open', target: 'NOVA', branch: {
            p: 0.5,
            yes: { jump: [0.065, 0.1], headline: { text: '{sym} beats: revenue +38% y/y, guides well above the Street', tone: 1, big: true }, vol: { mult: 1.8, dur: 1800 } },
            no: { jump: [-0.1, -0.065], headline: { text: '{sym} misses on margins; guidance "cautious"', tone: -1, big: true }, vol: { mult: 1.8, dur: 1800 } }
          }, tag: 'gapDir'
        },
        { at: 'open', target: 'CHIP', follow: 'gapDir', jump: [0.025, 0.04], headline: { text: '{sym} moves in sympathy with NOVA', tone: 0 } },
        { at: '9:52', target: 'NOVA', branch: { p: 0.55, yes: { follow: 'gapDir', drift: { move: [0.03, 0.05], dur: 3600 }, headline: { text: 'Funds pile into NOVA\'s post-earnings move', tone: 0 } }, no: { follow: 'gapDir', followSign: -1, drift: { move: [0.045, 0.06], dur: 4200 }, headline: { text: 'NOVA\'s earnings gap starts to fill as early traders cash out', tone: 0 } } } }
      ],
      debrief: 'NOVA gapped on earnings. From about 9:52 it either extended with the gap (gap and go) or ground back toward yesterday\'s close (gap fill), and the seed decided which. The first 20 minutes were noise. The trade was choosing a side once it held above or broke below the opening range.'
    },
    {
      id: 'fomc', name: 'FOMC Whipsaw', icon: '🏛️', session: ['13:30', '15:30'], minutes: 8,
      symbols: ['SPYR', 'FINX', 'NOVA'], volScale: 0.6, calm: true,
      brief: 'The Fed decides at 2:00 pm. Everyone is waiting. Then everyone moves at once.',
      events: [
        { at: '13:31', target: '*', depth: { mult: 0.6, dur: 1700 } },
        { at: '14:00', target: 'MKT', jump: [0.004, 0.008], vol: { mult: 3.2, dur: 1500 }, headline: { text: 'FOMC holds rates; statement drops "additional firming" language', tone: 1, big: true } },
        { at: '14:00', target: 'RATES', jump: [0.01, 0.018] },
        { at: '14:03', target: 'MKT', drift: { move: [-0.018, -0.012], dur: 420 }, headline: { text: 'Chair: "not thinking about thinking about cuts"', tone: -1, big: true } },
        { at: '14:03', target: 'RATES', drift: { move: [-0.03, -0.02], dur: 420 } },
        { at: '14:12', target: 'MKT', branch: { p: 0.5, yes: { drift: { move: [0.016, 0.024], dur: 2400 }, headline: { text: 'Bond market shrugs off the Chair, yields fall', tone: 1 } }, no: { drift: { move: [-0.02, -0.014], dur: 2400 }, headline: { text: 'Yields spike as traders price out cuts', tone: -1 } } } }
      ],
      debrief: 'The 2:00 statement ripped the market up, the press conference reversed it by 2:03, and the real move only started at 2:12. Anyone who chased either of the first two moves got chopped. Waiting for the third move was the edge.'
    },
    {
      id: 'runner', name: 'Small-cap Runner', icon: '🏃', session: ['9:30', '11:30'], minutes: 8,
      symbols: ['QBIT', 'MEME', 'SPYR'], volScale: 1.1,
      brief: 'QBIT is gapping up big on a press release. 3.4M share float. You know how this goes... or do you?',
      events: [
        { at: 'open', target: 'QBIT', jump: [0.34, 0.46], vol: { mult: 1.6, dur: 3600 }, headline: { text: '{name} signs quantum-cloud deal with MegaSoft', tone: 1, big: true } },
        { at: '9:31', target: 'QBIT', drift: { move: [0.16, 0.26], dur: 700 }, flow: { bias: 0.2, dur: 700 } },
        { at: '9:44', target: 'QBIT', drift: { move: [-0.16, -0.1], dur: 900 }, headline: { text: 'Early {sym} holders take profits into the halt', tone: 0 } },
        { at: '10:02', target: 'QBIT', branch: { p: 0.6, yes: { drift: { move: [0.18, 0.3], dur: 1100 }, flow: { bias: 0.2, dur: 900 }, headline: { text: '{sym} breaks the morning high, second leg underway', tone: 1, big: true } }, no: { drift: { move: [-0.14, -0.08], dur: 1500 }, headline: { text: '{sym} fails at VWAP, first-hour buyers trapped', tone: -1 } } } },
        { at: '10:34', target: 'QBIT', jump: [-0.2, -0.13], drift: { move: [-0.2, -0.12], dur: 2400 }, flow: { bias: -0.2, dur: 1500 }, headline: { text: '{name} prices $15M registered direct offering at a discount', tone: -1, big: true } }
      ],
      debrief: 'QBIT gapped up on a press release, pushed again in the first 15 minutes, pulled back, and at 10:02 either made a second leg or failed. The 10:34 offering at a discount crushed it. Low-float runners give you your entry and your exit in the same hour.'
    },
    {
      id: 'fda', name: 'FDA Binary', icon: '🧪', session: ['10:00', '13:00'], minutes: 8,
      symbols: ['BIOT', 'SPYR', 'NOVA'], volScale: 0.9,
      brief: 'BIOT\'s only drug gets its FDA decision today. Nobody knows when the news hits.',
      events: [
        { at: '10:05', target: 'BIOT', drift: { move: [0.05, 0.09], dur: 3000 }, vol: { mult: 1.4, dur: 4000 }, headline: { text: 'Options traders pile into {sym} calls ahead of FDA decision', tone: 1 } },
        { at: [ '11:05', '11:40' ], target: 'BIOT', halt: 420, headline: { text: '{sym} halted: news pending', tone: 0, big: true } },
        { at: '+1', afterPrev: true, target: 'BIOT', branch: { p: 0.5, yes: { reopenJump: [0.45, 0.7], drift: { move: [-0.12, -0.04], dur: 3000 }, headline: { text: 'FDA APPROVES {sym}\'s lead drug', tone: 1, big: true } }, no: { reopenJump: [-0.62, -0.48], drift: { move: [-0.06, 0.02], dur: 3000 }, headline: { text: 'FDA rejects {sym}\'s lead drug with a Complete Response Letter', tone: -1, big: true } } } }
      ],
      debrief: 'BIOT drifted up on hope, halted for news, and reopened with a gap of 50% or more one way or the other. Holding through a binary event is a coin flip. The skilled trades were the run-up and the reaction after the reopen.'
    },
    {
      id: 'trend', name: 'Trend Day', icon: '📈', session: ['9:30', '16:00'], minutes: 10,
      symbols: ['SPYR', 'NOVA', 'CHIP', 'OILX'], volScale: 0.9,
      brief: 'Some days the market just goes one way. Don\'t fight it, and don\'t take profits too early.',
      events: [
        { at: 'open', target: 'MKT', branch: { p: 0.6, yes: { jump: [0.002, 0.005], drift: { move: [0.022, 0.03], dur: 23000 }, headline: { text: 'Futures bid after soft inflation print', tone: 1 } }, no: { jump: [-0.005, -0.002], drift: { move: [-0.03, -0.022], dur: 23000 }, headline: { text: 'Futures heavy after hot inflation print', tone: -1 } } }, tag: 'trendDir' },
        { at: 'open', target: '*', regime: { type: 'trendDay', dur: 23400 } }
      ],
      debrief: 'A trend day: small pullbacks, one direction all day. Buying (or shorting) VWAP and holding was the winning play, while fading the move was the losing one.'
    },
    {
      id: 'chop', name: 'Chop City', icon: '🌀', session: ['9:30', '13:00'], minutes: 8,
      symbols: ['SPYR', 'FINX', 'OILX'], volScale: 1.1,
      brief: 'Headlines everywhere, direction nowhere. Breakouts might not be what they seem.',
      events: [
        { at: 'open', target: '*', regime: { type: 'chopDay', dur: 13000, kappa: 0.004 } },
        { at: '10:05', target: 'MKT', jump: 0.004, drift: { move: -0.006, dur: 900 }, headline: { text: 'Report: trade deal "close", say officials', tone: 1 } },
        { at: '10:48', target: 'MKT', jump: -0.004, drift: { move: 0.006, dur: 900 }, headline: { text: 'Commerce Dept: "no deal is imminent"', tone: -1 } },
        { at: '11:35', target: 'FINX', jump: 0.012, drift: { move: -0.016, dur: 1200 }, headline: { text: '{sym} breaks out on buyback rumor', tone: 1 } },
        { at: '12:10', target: 'OIL', jump: -0.01, drift: { move: 0.012, dur: 1200 }, headline: { text: 'Crude slides on inventory build, then reverses', tone: -1 } }
      ],
      debrief: 'Every headline breakout reversed. Fading the extremes back to VWAP worked all morning, and chasing moves bled money in commissions and slippage.'
    },
    {
      id: 'opec', name: 'OPEC Shock', icon: '🛢️', session: ['9:30', '12:30'], minutes: 8,
      symbols: ['OILX', 'SPYR', 'FINX'], volScale: 0.9,
      brief: 'Oil ministers are meeting in Vienna. Nobody expects anything.',
      events: [
        { at: '10:38', target: 'OIL', jump: [0.04, 0.06], drift: { move: [0.03, 0.05], dur: 1800 }, vol: { mult: 2.4, dur: 2400 }, headline: { text: 'OPEC+ announces surprise 2M barrel-per-day production cut', tone: 1, big: true } },
        { at: '10:38', target: 'MKT', drift: { move: [-0.012, -0.006], dur: 1800 }, headline: { text: 'Stocks slip as oil spike revives inflation fears', tone: -1 } },
        { at: '11:32', target: 'OIL', drift: { move: [-0.045, -0.025], dur: 2400 }, headline: { text: 'Saudi official: cut "may be phased in over months"', tone: -1, big: true } }
      ],
      debrief: 'The surprise cut sent crude and OILX sharply higher and pulled the index lower. At 11:32 the "phased in" comment took back about half of it. First-move momentum paid, and so did fading it once the story softened.'
    }
  ];

  // ---------- random news for non-scenario games ----------
  // kind filters which symbols a template may hit. Moves are in units of the stock's own daily volatility
  // (sig), so a "big" headline moves a small cap much further than a mega cap.
  const NEWS = [
    // single stock, positive
    { kind: 'any', tone: 1, w: 3, text: '{name} wins $2.4B multi-year government contract', sig: [0.8, 1.6], drift: [0.4, 1.0] },
    { kind: 'any', tone: 1, w: 3, text: 'Analyst at Goldberg upgrades {sym} to Buy', sig: [0.4, 0.9], drift: [0.2, 0.6] },
    { kind: 'any', tone: 1, w: 2, text: '{name} announces $5B share buyback', sig: [0.5, 1.0], drift: [0.2, 0.5] },
    { kind: 'large', tone: 1, w: 2, text: '{sym} to join the Spyre 500 index', sig: [0.6, 1.2], drift: [0.3, 0.8] },
    { kind: 'small', tone: 1, w: 3, text: 'Reddit mentions of {sym} up 900% in the past hour', sig: [0.5, 1.2], drift: [0.8, 2.0], flow: 0.2 },
    { kind: 'small', tone: 1, w: 2, text: '{name} announces partnership with MegaSoft', sig: [1.0, 2.2], drift: [0.5, 1.5], halt: true },
    { kind: 'bio', tone: 1, w: 2, text: '{name} Phase 2 trial meets primary endpoint', sig: [1.2, 2.5], drift: [0.3, 1.0], halt: true },
    { kind: 'oil', tone: 1, w: 2, text: 'Crude jumps after surprise 8M barrel inventory draw', target: 'OIL', abs: [0.01, 0.02], drift: [0.005, 0.015] },
    { kind: 'fin', tone: 1, w: 2, text: '{name} passes stress test with room to spare', sig: [0.4, 0.9], drift: [0.2, 0.5] },
    { kind: 'any', tone: 1, w: 1, text: 'Unconfirmed: {name} in takeover talks', sig: [1.0, 2.0], drift: [-0.6, 0.6], rumor: true },
    // single stock, negative
    { kind: 'any', tone: -1, w: 3, text: 'Short seller publishes report on {name}, alleges "channel stuffing"', sig: [-1.6, -0.8], drift: [-1.0, -0.3] },
    { kind: 'any', tone: -1, w: 3, text: 'Analyst at Morgan Stacks downgrades {sym} to Sell', sig: [-0.9, -0.4], drift: [-0.6, -0.2] },
    { kind: 'any', tone: -1, w: 2, text: '{name} CFO resigns "to pursue other opportunities"', sig: [-1.2, -0.5], drift: [-0.6, -0.1] },
    { kind: 'small', tone: -1, w: 3, text: '{name} files to sell shares in an at-the-market offering', sig: [-1.8, -0.8], drift: [-1.5, -0.5], flow: -0.2 },
    { kind: 'small', tone: -1, w: 1, text: '{name} receives Nasdaq deficiency notice', sig: [-1.0, -0.4], drift: [-0.8, -0.2] },
    { kind: 'bio', tone: -1, w: 2, text: 'FDA places clinical hold on {name} trial', sig: [-2.8, -1.4], drift: [-0.8, -0.2], halt: true },
    { kind: 'large', tone: -1, w: 2, text: 'EU opens antitrust probe into {name}', sig: [-0.9, -0.4], drift: [-0.6, -0.1] },
    { kind: 'oil', tone: -1, w: 2, text: 'Crude slides as inventories build for a third week', target: 'OIL', abs: [-0.02, -0.01], drift: [-0.015, -0.004] },
    { kind: 'fin', tone: -1, w: 2, text: 'Regional bank stress rumors weigh on {name}', sig: [-1.2, -0.5], drift: [-0.8, -0.2] },
    // market-wide
    { kind: 'mkt', tone: 1, w: 2, text: 'Fed minutes: officials "patient" on further hikes', target: 'MKT', abs: [0.003, 0.007], drift: [0.002, 0.008] },
    { kind: 'mkt', tone: 1, w: 2, text: 'Jobless claims fall to 8-month low', target: 'MKT', abs: [0.002, 0.005], drift: [0.001, 0.006] },
    { kind: 'mkt', tone: -1, w: 2, text: 'CPI comes in hot at 0.5% month over month', target: 'MKT', abs: [-0.008, -0.004], drift: [-0.008, -0.002], rates: 0.02 },
    { kind: 'mkt', tone: -1, w: 2, text: '10-year Treasury yield spikes to 5%', target: 'MKT', abs: [-0.006, -0.003], drift: [-0.006, -0.001], rates: 0.015 },
    { kind: 'mkt', tone: -1, w: 1, text: 'Geopolitical tensions escalate; oil bid, stocks slip', target: 'MKT', abs: [-0.007, -0.003], drift: [-0.005, 0], oilAlso: 0.015 },
    { kind: 'mkt', tone: 0, w: 1, text: 'Large block of SPYR puts crosses the tape', target: 'MKT', abs: [-0.002, 0.002], drift: [-0.003, 0.003] }
  ];

  // ---------- bots ----------
  const BOTS = [
    { key: 'momo', name: 'Momo Mike', avatar: '🚀', style: 'momentum', blurb: 'Buys breakouts on volume, trails a stop.' },
    { key: 'rita', name: 'Reversion Rita', avatar: '🪃', style: 'meanrev', blurb: 'Fades stretched moves back to the mean.' },
    { key: 'sam', name: 'Scalper Sam', avatar: '⚡', style: 'scalper', blurb: 'Joins the bid, takes a few ticks, repeats.' },
    { key: 'val', name: 'VWAP Val', avatar: '📐', style: 'vwap', blurb: 'Buys pullbacks to VWAP in an uptrend and shorts rips into it in a downtrend.' },
    { key: 'yuki', name: 'YOLO Yuki', avatar: '🎰', style: 'yolo', blurb: 'Max size, no stops, pure vibes.' },
    { key: 'ned', name: 'Newsy Ned', avatar: '📰', style: 'news', blurb: 'Trades headlines in milliseconds.' },
    { key: 'dan', name: 'Diamond Dan', avatar: '💎', style: 'diamond', blurb: 'Buys the strongest stock early and never sells.' },
    { key: 'tom', name: 'Turtle Tom', avatar: '🐢', style: 'turtle', blurb: 'Donchian breakouts, pyramids winners.' }
  ];

  const BOT_QUIPS = {
    win: ['easy money', 'too easy 😎', 'paid', 'green is my color', 'thank you market', 'printer go brrr'],
    loss: ['ouch', 'that hurt', 'market is rigged', 'just a flesh wound', 'stopped out again 🙃', 'why do I do this'],
    margin: ['MARGIN CALL?? 💀', 'broker took my shares', 'I was about to add more…'],
    start: ['gl hf', 'let\'s get this bread', 'no mercy today', 'watch and learn', 'coffee ✅ charts ✅'],
    news: ['did you see that headline', 'news trade!!', 'called it'],
    elim: ['gg', 'I\'ll be back', 'rigged', 'good game all']
  };

  const AVATARS = ['🦊', '🐺', '🦁', '🐯', '🐻', '🐂', '🦈', '🐙', '🦉', '🐸', '🐼', '🦄', '🐲', '🤖', '👽', '🥷', '🤠', '🧙', '🐵', '🦅'];
  const EMOTES = ['🚀', '💎', '🧻', '🐻', '🐂', '🔥', '😭', '🤡', '🫡', '💀'];

  // Player identity: the validated eight-slot categorical palette (dark steps), in fixed order.
  // Slot order is join order and never changes for a player during a match.
  const PLAYER_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
  const MAX_PLAYERS = 8;

  const MODES = {
    race: { id: 'race', name: 'P&L Race', icon: '🏁', desc: 'Everyone trades the same market. The highest account value at the closing bell wins.' },
    elim: { id: 'elim', name: 'Knockout', icon: '🥊', desc: 'Each round, the lowest account gets knocked out. Blow up your account and you\'re out on the spot. Last trader standing wins.' },
    scenario: { id: 'scenario', name: 'Scenario', icon: '🎬', desc: 'Scripted market days: flash crashes, squeezes, earnings gaps and FOMC whipsaws. Read the tape and make money.' },
    duel: { id: 'duel', name: 'Quick Duels', icon: '⚔️', desc: 'Fast formats: call the next candles, race to a profit target, or play best-of-five scalping rounds.' }
  };
  const DUEL_TYPES = {
    predict: { id: 'predict', name: 'Call It', icon: '🔮', desc: 'The chart freezes. Call up or down for the next few candles and bet 1 to 3 chips. Streaks score bonus points.' },
    target: { id: 'target', name: 'Target Rush', icon: '🎯', desc: 'First trader to reach the profit target wins instantly. Hit the loss limit and you\'re out.' },
    scalp: { id: 'scalp', name: 'Scalp Duel', icon: '⏱️', desc: 'Best of five 60-second rounds, each on a fresh chart, with a capped position size. Most round wins takes it.' }
  };

  const DEFAULT_SETTINGS = {
    mode: 'race',
    duel: 'predict',
    scenario: 'random',
    minutes: 8,
    session: 'full',
    symbolSet: 'mixed',
    startCash: 100000,
    leverage: 4,
    commissions: true,
    events: 'normal',        // off | calm | normal | chaos
    volatility: 'normal',    // calm | normal | wild
    rivals: 'live',          // live | delayed | hidden
    bots: 3,
    botLevel: 'normal',      // easy | normal | hard
    seed: '',
    elimRoundSec: 90,
    bustPct: 0.5,
    targetPct: 0.03,
    predictRounds: 8,
    predictCandles: 5,
    scalpRounds: 5,
    scalpSec: 60,
    scalpMaxShares: 5000
  };

  // Commission model: IBKR-style tiered, simplified.
  const COMMISSION = { perShare: 0.005, min: 1.0, maxPct: 0.01 };
  const MAINT_MARGIN = 0.25;
  const MAINT_MARGIN_HTB = 0.35;

  const TIPS = [
    'Small caps move when players pile in, because your own market orders eat the order book.',
    'Resting limit orders wait in a queue. Join the bid early to get filled first.',
    'Stops trigger on the last trade and fill at market, so in a fast tape expect slippage.',
    'Halted? Market orders are refused, but limit orders queue for the reopening auction.',
    'Hard-to-borrow stocks cost a locate fee per share when you open a short.',
    'Brackets attach a take-profit and a stop that cancel each other when one fills.',
    'Drag your order lines on the chart to move them. Click the × on the label to cancel.',
    'Press ? in a match for the hotkeys. B / S buy and sell, F flattens, R reverses.',
    'Knockout: the lowest account at every bell goes home. Sometimes the right move is to sit tight.',
    'VWAP is the market\'s average price today. Many bots buy dips to it in an uptrend.',
    'Export your fills after a match and import them into the Tradalytics journal.'
  ];

  const HOTKEYS = [
    ['B', 'Buy market (ticket size)'], ['S', 'Sell / short market'],
    ['Shift+B', 'Buy limit at bid'], ['Shift+S', 'Sell limit at ask'],
    ['F', 'Flatten this symbol'], ['Shift+F', 'Flatten everything'],
    ['R', 'Reverse position'], ['C', 'Cancel orders on this symbol'],
    ['1–6', 'Switch symbol'], ['[ / ]', 'Timeframe down / up'],
    ['+ / −', 'Change ticket size'], ['Space', 'Recenter chart and ladder'],
    ['G', 'Grid of every chart'], ['H', 'Horizontal line tool'], ['T', 'Trend line tool'], ['Esc', 'Cancel drawing / close dialogs'],
    ['Enter', 'Chat'], ['?', 'This help']
  ];

  Object.assign(DTA, {
    RTH_OPEN, RTH_CLOSE, BAR_SEC, SYMBOLS, SYMBOL_SETS, SESSIONS, TIMEFRAMES, SCENARIOS, NEWS,
    BOTS, BOT_QUIPS, AVATARS, EMOTES, PLAYER_COLORS, MAX_PLAYERS, MODES, DUEL_TYPES, DEFAULT_SETTINGS,
    COMMISSION, MAINT_MARGIN, MAINT_MARGIN_HTB, TIPS, HOTKEYS
  });
})();
