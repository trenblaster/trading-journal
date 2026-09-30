# Day Trade Arena

A multiplayer day-trading game that runs in the browser. Everyone in a room trades the same simulated market at the same time, on a live order book they can move, and the best trader wins.

Play it on GitHub Pages at `https://<your-username>.github.io/trading-journal/daytrade-arena/`, or serve the repository with any static web server. There is no build step, no account and no game server.

## Playing with friends

1. **Host a game**. You get a 5-letter room code and an invite link.
2. Friends open the link, or type the code and press **Join**, from their own phones or computers.
3. The host picks the mode and settings, adds bots if wanted, and presses **Start match**.

The host's browser runs the market and the rules. Players connect straight to it over WebRTC ([PeerJS](https://peerjs.com), bundled in `vendor/`). The free public PeerJS server only introduces the browsers to each other. Other tabs or windows on the same computer join over `BroadcastChannel`, with no internet needed. **Practice vs bots** works fully offline.

If someone can't connect from a strict network (some offices and mobile carriers block direct connections), add a TURN server under **Settings → Connection**. You can also run your own PeerJS server (`npx peer --port 9000`) and point the game at it there, or with `?peer=host:port/path&peersecure=0` in the URL.

## Modes

- **🏁 P&L Race**: the highest account at the closing bell wins. Choose the symbols, the session (full day, morning, opening drive, power hour), 3 to 20 minutes, starting cash, leverage, commissions, news intensity and volatility.
- **🥊 Knockout**: every bell closes all positions and knocks out the lowest account. Anyone who didn't trade that round goes first, and blowing up the account (below the bust line) is instant elimination. The last trader standing wins.
- **🎬 Scenario**: scripted days, including Flash Crash, Short Squeeze, Earnings Gap, FOMC Whipsaw, Small-cap Runner, FDA Binary, Trend Day, Chop City and OPEC Shock. Parts of each script are random per seed, and a debrief afterwards explains what happened.
- **⚔️ Quick Duels**
  - **🔮 Call It**: the chart freezes, and everyone calls higher or lower for the next few candles with 1 to 3 chips. Streaks score extra.
  - **🎯 Target Rush**: first to +X% wins, and −X% knocks you out.
  - **⏱️ Scalp Duel**: best-of rounds on a fresh chart each time, with a position limit.

Up to 8 traders (people plus bots). Anyone past that, or who arrives mid-match, watches and gets a seat in the next game.

## The market

- Each stock's hidden fair value moves with market, oil and rates factors (through its betas), plus its own noise. Volatility is stochastic, busiest at the open and close, quiet at lunch. Trend, chop and pause regimes shape the day, and news drives jumps.
- A synthetic **order book** sits around fair value, with persistent walls and round-number size. Your market orders eat through it, the levels refill over time, and the quote and fair value move (market impact). Small caps move when players pile in, large caps barely notice.
- Your **limit orders** join a queue at their price and fill as background prints trade through. Players can trade directly against each other's resting orders.
- **Small caps halt** limit up or down (LULD bands) and reopen through an auction. Market orders are refused during a halt, while limit orders wait for the reopen.
- **Orders**: market, limit, stop, stop-limit, trailing stop, and brackets (take-profit plus stop-loss, one cancels the other). **Shorting**: hard-to-borrow names charge a locate fee, cap each player's short size, and sometimes run out of borrow.
- **Risk**: buying power is account × leverage. Below maintenance margin (25%, or 35% for hard-to-borrow names) you're margin called and liquidated largest-position-first. Commissions are IBKR-style, $0.005 per share with a $1 minimum.
- **Bots** (8 personalities, 3 difficulty levels) trade through the same engine: Momo Mike (breakouts), Reversion Rita (mean reversion), Scalper Sam (book imbalance), VWAP Val (VWAP pullbacks), YOLO Yuki (max size, no stops), Newsy Ned (headlines), Diamond Dan (buy and hold), Turtle Tom (Donchian breakouts).

## The screen

- **Chart**: candles, Heikin-Ashi, OHLC, line or area. Timeframes from 5 seconds to 30 minutes. Volume, VWAP with ±σ bands, EMA 9/20/50, Bollinger bands, a session volume profile with POC and value area, and RSI and MACD panes. It also shows your working orders (drag to move, × to cancel), your position with open P&L, your fills, other traders' fills with their avatars, news flags, halts, drawings (horizontal line, trend line, rectangle, Fibonacci, measure) and price alerts. Zoom with the wheel or a pinch, drag to pan, drag the price axis to rescale, double-click to return to live.
- **Price ladder** with click-to-trade (a bid row places a buy limit, an ask row a sell limit, right-click places a stop), your order chips, and volume at price. There's also **time & sales** with big prints highlighted, a **depth chart**, a watchlist with sparklines and heat, a live **leaderboard** (click a trader to follow their position) and an **equity race** chart, news ticker, chat and emotes.
- **After the match**: a podium, standings with stats (win rate, profit factor, drawdown, fees), awards, the equity race, a **full replay** with every trader's fills, and your round trips.
- **Exports**: your fills as an IBKR-style CSV for the Tradalytics journal's import, and the session's candles as OHLCV CSV for the Tradalytics backtester.
- On phones the terminal becomes tabs (Chart, Book, Trade, Board, Chat) with a quick Buy / Sell / Flat bar.

Hotkeys: `B`/`S` buy/sell at market, `Shift+B`/`Shift+S` limit at the bid/ask, `F` flatten, `Shift+F` flatten all, `R` reverse, `C` cancel, `1`–`6` symbols, `[` `]` timeframe, `+` `−` size, `Space` recenter, `H`/`T` drawing tools, `?` for the full list.

## Files

- `js/market.js`: market simulator (fair value, regimes, order book, prints, halts, news, scenarios)
- `js/engine.js`: accounts, orders, brackets, borrow, margin, commissions, round trips
- `js/bots.js`: AI traders
- `js/host.js`: rooms, modes, rounds, scoring, awards, what each player may see
- `js/net.js`, `js/client.js`: connections (local, BroadcastChannel, PeerJS/WebRTC) and each player's mirror of the game
- `js/chart.js`, `js/widgets.js`, `js/indicators.js`: the chart, ladder, tape, depth, sparklines, equity race and indicators, all drawn on canvas
- `js/ui-*.js`, `js/app.js`, `css/arena.css`, `index.html`: screens and flow
- `js/config.js`: tickers, scenarios, headlines, bots, modes and defaults (all companies are fictional)
- `sw.js`, `manifest.webmanifest`, `icons/`: offline play and installing as an app
- `vendor/peerjs.min.js`: PeerJS 1.5.5 (MIT, see `vendor/PEERJS-LICENSE`)
