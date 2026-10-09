# Primordium Tools

Two apps for Primordium 2.0 that share one copy of the game data.

| Folder | What it is | Live link |
|---|---|---|
| `sheet/` | Player character sheet (phone app, works offline) | https://theostriche.github.io/primordium-tools/sheet/ |
| `gm/` | GM combat tool (laptop) | https://theostriche.github.io/primordium-tools/gm/ |
| `shared/` | `primordium-data.js`: every skill, race, and trait, used by both apps | |

The site's front page (`index.html`) links to both apps.

## Changing the game data

Edit `shared/primordium-data.js` once and both apps pick it up. Then raise `VERSION` in `sheet/sw.js` (for example `primordium-v6` to `primordium-v7`) so installed phones download the new data.

## Opening the apps on this computer

- **GM tool:** double-click `gm/index.html`.
- **Both apps the way the website serves them:** run `node tools/serve.js` in this folder, then visit http://localhost:8080.

## Publishing

1. Commit and push with GitHub Desktop.
2. One-time setup: on GitHub, open the repository's **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
3. After about a minute the links above are live.

More details for each app are in `gm/README.md` and `sheet/README.md`.

## The old player sheet link

The player sheet used to live in its own repository, `Primordium-Player-Sheets`. The files in `tools/old-sheet-redirect/` replace that repository's contents, so old links and phones that installed the app are sent to the new address. Characters carry over because both addresses are on the same site (`theostriche.github.io`).
