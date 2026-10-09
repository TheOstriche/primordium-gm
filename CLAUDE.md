# Primordium Tools

One repository (`TheOstriche/primordium-tools`, published with GitHub Pages) holding two static web apps for **Primordium 2.0**, the owner's original tabletop RPG.

- `gm/`: the GM combat tool (laptop). Its full brief is `gm/CLAUDE.md`.
- `sheet/`: the player character sheet (phone, installable, offline through `sheet/sw.js`). Notes in `sheet/README.md`.
- `shared/primordium-data.js`: sets `window.PRIMORDIUM_DATA` (skills with every tier's abilities and perks, races, traits). It is the **only** copy; both apps load it with `../shared/primordium-data.js`. Put new data that both apps need in `shared/`, not inside one app.
- `shared/character-rules.js`: sets `window.PrimordiumCharacter` (what skills grant, and a character's stats, maximum HP, and armor). The sheet computes its totals with it, and the GM tool uses it to import sheet backups, so the two always agree.
- `index.html`: landing page linking both apps.
- `tools/serve.js`: local server for the whole repository (port 8080). `tools/old-sheet-redirect/`: files that replace the old `Primordium-Player-Sheets` repository's contents.

## Rules for changes
- No build step. Each app must still work from a relative path, and the GM tool must still open from a double-clicked `gm/index.html`.
- When anything the sheet loads changes (its own files or `shared/`), raise `VERSION` in `sheet/sw.js`, and keep its `FILES` list matching what `sheet/index.html` loads.
- Both apps are on one site, so they share browser storage. Keep storage names distinct: the sheet uses localStorage key `primordium.characters.v1`; the GM tool uses IndexedDB and the `gm-tab` localStorage key.
- The owner commits and pushes with GitHub Desktop. Git for Windows is at `C:\Program Files\Git\cmd\git.exe`.
