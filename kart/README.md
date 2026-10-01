# Revision Rally

A kart racing revision game for Cambridge International AS Level Economics (9708), Accounting (9706) and English Language (9093). It uses the same question banks as Study Town (`../study-town/js`).

Play it on the website at `https://<your-username>.github.io/trading-journal/kart/`, or download the repo and open `kart/index.html`. It installs as an app and works offline after the first visit. Progress saves in the browser automatically.

## How it plays

- ▲/W accelerate, ◀ ▶ or A/D steer, ▼/S brake, Space uses your item, Esc pauses. Phones get on-screen buttons and auto-accelerate.
- Drive through a **? box** and the race pauses for a question. A right answer gives an item: boost, shield or rocket (rockets are likelier when you are behind). A wrong answer spins you out. ✕ or Esc skips with no penalty.
- Four tracks (Market Meadows, Ledger Canyon, Poet's Coast, Exam City Nights) and three classes (50cc, 100cc, 150cc). A top-3 finish unlocks the next track, and a podium on every track unlocks the next class.
- Coins from correct answers and good finishes buy engine, turbo, tyre and nitro upgrades in the Garage.
- Topics: choose the subject, Paper 1 or 2 and exact topics. Questions you get wrong come back more often. Questions you add in Study Town's editor also appear here when both games are on the same site.

## Files

- `js/track.js` – track geometry, themes, scenery and box placement
- `js/race.js` – pseudo-3D renderer, physics, AI rivals and items
- `js/sprites.js` – procedurally drawn karts and scenery
- `js/ui.js` – menus, questions, HUD, saving and the game loop
