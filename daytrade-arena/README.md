# Day Trade Arena

A multiplayer day-trading game that runs in the browser. Everyone in a room trades the same simulated market at the same time, on a live order book they can move, and the best trader wins.

Play it on GitHub Pages at `https://<your-username>.github.io/trading-journal/daytrade-arena/`, or serve the repository with any static web server. There is no build step, no account and no game server.

## Quick play

The home screen has one-click practice matches for each market: index futures, oil and gold, a futures mix, small-cap runners, large caps and a mixed bag. You're in the countdown straight away, against three bots.

To change market mid-game, open the **☰** menu at the top left and choose **Switch market or mode…**: the match ends and you're back in the lobby, where the market cards (and the symbols under them) pick what you trade. Inside a match, the watchlist or the `1`–`6` keys switch between that market's symbols.

## Playing with friends

1. **Host a game**. You get a 5-letter room code and an invite link.
2. Friends open the link, or type the code and press **Join**, from their own phones or computers.
3. The host picks the market (and which symbols in it), the mode and the settings, adds bots if wanted, and presses **Start match**.

The host's browser runs the market and the rules. Players connect straight to it over WebRTC ([PeerJS](https://peerjs.com), bundled in `vendor/`). The free public PeerJS server only introduces the browsers to each other. Other tabs or windows on the same computer join over `BroadcastChannel`, with no internet needed. **Practice vs bots** works fully offline.

If someone can't connect from a strict network (some offices and mobile carriers block direct connections), add a TURN server under **Settings → Connection**. You can also run your own PeerJS server (`npx peer --port 9000`) and point the game at it there, or with `?peer=host:port/path&peersecure=0` in the URL.

## Modes

- **🏁 P&L Race**: the highest account at the closing bell wins. Choose the market and symbols, the session (full day, data and the open 8:00–10:30, opening drive, morning, afternoon, power hour, or the London open for futures), 3 to 20 minutes, starting cash, leverage, commissions, news intensity and volatility.
- **🥊 Knockout**: every bell closes all positions and knocks out the lowest account. Anyone who didn't trade that round goes first, and blowing up the account (below the bust line) is instant elimination. The last trader standing wins.
- **🎬 Scenario**: scripted days, including Flash Crash, Short Squeeze, Earnings Gap, FOMC Whipsaw, Small-cap Runner, FDA Binary, Trend Day, Chop City and OPEC Shock. Parts of each script are random per seed, and a debrief afterwards explains what happened.
- **⚔️ Quick Duels**
  - **🔮 Call It**: the chart freezes, and everyone calls higher or lower for the next few candles with 1 to 3 chips. Streaks score extra.
  - **🎯 Target Rush**: first to +X% wins, and −X% knocks you out.
  - **⏱️ Scalp Duel**: best-of rounds on a fresh chart each time, with a position limit.

Up to 8 traders (people plus bots). Anyone past that, or who arrives mid-match, watches and gets a seat in the next game.

## Markets

| Market | Symbols | What it's like |
| --- | --- | --- |
| Index futures | ES, NQ, RTY | $50, $20 and $50 a point. Deep ES book, thin NQ. Prior-day and overnight levels to the tick, 8:30 and 10:00 data, the cash open at 9:30 |
| Oil and gold | CL, GC | $1,000 and $100 a point. Crude spikes on inventories (10:30 Wednesdays) and headlines and runs stops through levels; gold trends on rates |
| Small-cap runners | 3 generated per match, plus MEME, QBIT, BIOT | A fictional company gapping 20–140% on premarket news, with a playbook for the day: gap and go, dip and rip, gap and fade, pop and drop, halt squeeze or chop |
| Large caps | SPYR, NOVA, CHIP, FINX, OILX | Liquid stocks that follow the market, tech, rates or oil |

**Micro contracts** (MES, MNQ, M2K, MCL, MGC) are a lobby option: a tenth of the size, the same price.

Futures trade in contracts with a day-trade margin per contract (ES $2,500 at the standard 4× setting; lower leverage asks for more, higher for less), $2.25 a contract per side in commissions and fees ($0.62 for micros), and P&L at the contract multiplier. Stocks use equity × leverage of buying power and IBKR-style per-share commissions.

## How prices move

- **Drivers.** Every price is built from shared drivers (the stock market, tech, small caps, rates, crude and gold) times the instrument's exposure to each, plus its own path. ES is the market driver itself, so NQ, RTY and the stocks move with it, and buying a lot of ES lifts them too.
- **Day types.** Each driver and stock gets a plan for the day: a trend day, a balance day, normal variation (the first hour's range breaks one way), a double distribution (balance, a leg, a new balance) or a reversal. The overnight session drifts, then Europe opens with a leg. Price follows the plan with mean-reverting noise, so the shape is there but never on rails.
- **Time of day.** Volatility and volume follow each market's clock: futures are quiet overnight, pick up in Europe, spike on data and at the cash open, go quiet at lunch and pick up into the close. Crude wakes up at the 9:00 pit open, the 10:30 inventory report and the 14:30 settlement. Small caps are front-loaded into the first half hour.
- **History.** Before the match, the simulator plays yesterday's session, the overnight (futures) or premarket (stocks), and any of today already gone, as 1-minute bars, so everyone starts with a chart and real levels.
- **Key levels.** Prior day high, low and close, the prior day's volume profile (POC and value area), the overnight or premarket high and low, the opening range, the initial balance, high and low of day, session VWAP and round numbers. Levels within a few ticks of each other form a confluence zone, which is stronger. When price reaches a level it either rejects it (at the level, a tick or two short, or after sweeping the stops just beyond), or breaks it with a stop run that often retests the level from the other side, and sometimes fails back through and traps the breakout. Levels weaken each time they're tested. While a level is being defended the book shows a wall there (sometimes an iceberg that keeps refilling, sometimes a wall that gets pulled), and the tape shows absorption: aggressive buying into resistance that goes nowhere.
- **Economic calendar.** Each day has its own releases (CPI, payrolls, PPI, retail sales, jobless claims, ISM, JOLTS, consumer sentiment, EIA crude, a 10-year auction, a Fed speaker, and on some days FOMC and the press conference) with a forecast and an actual. The book thins before a release; the release moves the drivers it matters to, sometimes with a whipsaw (a first move, a reversal, then the real move).
- **Small caps.** Premarket news, a gap, a premarket high, and a playbook. LULD halts (10% bands, 20% under $3, doubled at the open and close), reopening auctions, hard-to-borrow locates and the short sale restriction once a stock is down 10% on the day.

## The market's microstructure

- A synthetic **order book** sits around fair value, with persistent walls and round-number size. Your market orders eat through it, the levels refill over time, and the quote and fair value move (market impact). Small caps move when players pile in, large caps barely notice.
- Your **limit orders** join a queue at their price and fill as background prints trade through. Players can trade directly against each other's resting orders.
- **Small caps halt** limit up or down (LULD bands) and reopen through an auction. Market orders are refused during a halt, while limit orders wait for the reopen.
- **Orders**: market, limit, stop, stop-limit, trailing stop, and brackets (take-profit plus stop-loss, one cancels the other). **Shorting**: hard-to-borrow names charge a locate fee, cap each player's short size, and sometimes run out of borrow.
- **Risk**: below maintenance margin (25% of a stock position, 35% for hard-to-borrow names, 75% of a futures contract's day margin) you're margin called and liquidated largest-position-first.
- **Bots** (10 personalities, 3 difficulty levels) trade through the same engine and size futures in contracts: Momo Mike (breakouts), Reversion Rita (mean reversion), Scalper Sam (book imbalance), Level Lou (fades the first tests of key levels, joins break-and-retests), VWAP Val (VWAP pullbacks), ORB Olivia (opening range breakouts), YOLO Yuki (max size, no stops), Newsy Ned (headlines), Diamond Dan (buy and hold), Turtle Tom (Donchian breakouts).

## The screen

- **Chart**: yesterday, the overnight or premarket and today on one timeline, with sessions shaded and labelled and the match start marked. A **navigator strip** under the time axis shows the whole timeline; drag its window to move around, or use **Today**, **All** and the arrow keys. **Key levels** and ◆ **confluence zones** are drawn with labels (and tags at the top and bottom for strong levels off screen), and the economic calendar shows as flags. A strip under the toolbar shows the session, VWAP, the nearest level above and below, and the next data release. Candles, Heikin-Ashi, OHLC, line or area. Timeframes from 5 seconds to 30 minutes. Volume, VWAP with ±σ bands, EMA 9/20/50, Bollinger bands, a session volume profile with POC and value area, RSI and MACD panes, and order flow: a Bookmap-style **liquidity heatmap** of resting size behind the candles, **big-print bubbles**, and **volume delta** and **cumulative delta (CVD)** panes. It also shows your working orders (drag to move, × to cancel), your position with open P&L, your fills, other traders' fills with their avatars, news flags, halts, drawings (horizontal line, trend line, rectangle, Fibonacci, measure) and price alerts. Zoom with the wheel or a pinch, drag to pan, drag the price axis to rescale, double-click to return to live. **Grid** (`G`) shows every symbol's chart at once.
- **Levels** tab: every key level and zone with its distance from price and strength; click one to set a limit price, or set an alert. **Calendar** tab: today's releases with countdowns, forecasts, actuals and which of the match's symbols each one moves (crude inventories move CL, not a small-cap runner).
- **Order ticket** shows what you're trading: for futures, the tick value, point value and margin per contract, how many more contracts you can add, and risk and reward in dollars for a bracket.
- **Price ladder** with click-to-trade (a bid row places a buy limit, an ask row a sell limit, right-click places a stop), your order chips, and volume at price. There's also **time & sales** with big prints highlighted, a **depth chart**, a watchlist with sparklines and heat, a live **leaderboard** (click a trader to follow their position) and an **equity race** chart, news ticker, chat and emotes, with play-by-play in chat for lead changes, halts, margin calls and bells.
- **After the match**: a recap of what the market did (each symbol's day type or small-cap playbook, which levels held and which broke, and the data releases), a podium, standings with stats (win rate, profit factor, drawdown, fees), awards, the equity race, an animated **ranking race**, your P&L by symbol and the spread of your trade results, a **full replay** with every trader's fills, and your round trips. Click any trade to replay it, framed on the chart with the holding period, entry and exit marked.
- **Exports**: your fills as an IBKR-style CSV for the Tradalytics journal's import, and the session's candles as OHLCV CSV for the Tradalytics backtester.
- On phones the terminal becomes tabs (Chart, Book, Trade, Board, Chat) with a quick Buy / Sell / Flat bar.

Hotkeys: `B`/`S` buy/sell at market, `Shift+B`/`Shift+S` limit at the bid/ask, `F` flatten, `Shift+F` flatten all, `R` reverse, `C` cancel, `1`–`6` symbols, `[` `]` timeframe, `+` `−` size, `Space` recenter, `G` chart grid, `W` wide chart, `L` levels on or off, `D` today, `A` all history, `←` `→` scroll, `↑` `↓` zoom, `End` live, `H`/`T` drawing tools, `?` for the full list.

## Files

- `js/instruments.js`: futures specs, stock exposures, the small-cap runner generator, market presets, sessions and the economic calendar
- `js/paths.js`: how prices move (activity by time of day, day-type plans, small-cap playbooks, reactions at key levels, 1-minute history bars)
- `js/levels.js`: key levels and confluence zones, shared by the host and every player's chart
- `js/market.js`: market simulator (drivers, history, order book, prints, halts, news, data releases, scenarios)
- `js/engine.js`: accounts, orders, brackets, borrow, the short sale restriction, stock and futures margin, contract multipliers, commissions, round trips
- `js/bots.js`: AI traders
- `js/host.js`: rooms, modes, rounds, scoring, awards, what each player may see
- `js/net.js`, `js/client.js`: connections (local, BroadcastChannel, PeerJS/WebRTC) and each player's mirror of the game
- `js/chart.js`, `js/widgets.js`, `js/indicators.js`: the chart, ladder, tape, depth, sparklines, equity race and indicators, all drawn on canvas
- `js/ui-*.js`, `js/app.js`, `css/arena.css`, `index.html`: screens and flow
- `js/config.js`: stock tickers, scenarios, headlines, bots, modes and defaults (all companies are fictional; futures use the public contract specifications)
- `sw.js`, `manifest.webmanifest`, `icons/`: offline play and installing as an app
- `vendor/peerjs.min.js`: PeerJS 1.5.5 (MIT, see `vendor/PEERJS-LICENSE`)
