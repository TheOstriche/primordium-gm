# Primordium GM

The GM's combat companion for Primordium 2.0.

## Opening the app

Double-click `index.html`. It opens in your browser and works offline. Chrome or Edge is recommended, because only they can save to a file in a folder (see the Save tab).

Use the same browser each time: your players and encounters are saved inside that browser. Make a backup from the Save tab at the end of each session.

## For later edits

- After changing `data/scaling.json`, run `node tools/build-scaling.js` so the app picks up the new numbers.
- `node tools/test-rules.js` checks the game math against the worked examples in `docs/scaling.md`.
- `node tools/serve.js` serves the app at http://localhost:8080 (optional; used for testing).
