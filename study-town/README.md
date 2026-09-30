# Study Town

A cosy town-building revision game for Cambridge International AS Level (AS content only):

- Economics 9708 (syllabus for 2026–2028), topics 1.1–6.5
- Accounting 9706 (syllabus for 2026–2028), financial accounting and cost and management accounting
- English Language 9093 (syllabus for 2024–2026), Paper 1 Reading and Paper 2 Writing

Open `index.html` in a browser. No build step and no server needed.

## How it plays

- Move with the arrow keys (or WASD). Interact with Space, Enter or Z.
- Plant seeds, then water each plot by answering a question. Sleep at home to grow watered crops, harvest them for coins.
- Pull weeds (one question each) and take daily challenges from the three tutors.
- Spend coins on a bigger home, more plots, better seeds, watering cans and town decor.
- The Library (or `T`) chooses the subject, Paper 1 or Paper 2, and the exact topics. You can also mix all three subjects.
- Paper 1 is mostly multiple choice. Paper 2 is structured: calculations with fresh numbers each time, economics diagram questions, data response and essays, and English writing tasks you self-mark against a mark-scheme checklist.
- Questions you get wrong come back more often. `I` shows accuracy by topic and can focus you on weak topics.
- `N` opens an editor for adding your own questions from your notes. You can export and import them as text.

Progress is saved in the browser. Use "Save and transfer" in your home to move it to another device.

## Files

- `js/game.js` – map, rendering, controls, menus, saving
- `js/graphs.js` – labelled economics diagrams drawn as SVG
- `js/bank-*.js` – question banks per subject
