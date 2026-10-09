# Primordium GM Tool

A laptop web app for running combat in **Primordium 2.0**, an original tabletop RPG designed and run by the owner of this project. It is the GM's companion to the existing player phone app (a separate GitHub Pages project).

## Decisions already made
- **Platform:** a static web app (HTML, CSS, JavaScript, no build step required) that runs locally by opening it, and is published with **GitHub Pages** like the player app.
- **Laptop first:** designed for a laptop screen with mouse and keyboard; it does not need to work on phones.
- **Players are entered manually** in the GM tool (name, HP, armor, the six stats, Speed for movement). No import from the player app.
- **Grid:** a plain grid, with an **optional map image** the GM can upload underneath it. 1 square = 1M.
- **Saving:** everything is saved locally in the browser (encounters, players, map images). IndexedDB suits map images; include export and import of a backup file.
- **Rules** follow `docs/rules.md` exactly. When something is unclear, ask the owner rather than inventing a rule.

## Features (build in this order)
1. **Encounter setup:** a party roster (players entered manually and reused between sessions) and an enemy picker using all creatures in `data/npc-data.js`, searchable and filterable by family, level, and role, with quantity. Show the encounter's total XP and a difficulty estimate.
2. **Grid map:** adjustable size; optional uploaded map image under the grid; drag tokens for players and enemies; size-correct footprints (Large 2 squares, Huge 2x2, Massive 3x3); distance measuring in meters; show a selected token's movement range (5 + Speed).
3. **Initiative and phases:** enemies get 5 + Perception, players' rolls are typed in, ties per the rules, a turn order list with the active combatant highlighted, a phase counter, and Bosses taking two turns per phase.
4. **Enemy turns:** a button rolls the D20 tactics table, chooses an ability respecting cooldowns and the drop-a-rarity rule, rolls its damage dice from the parsed `attack` data (strikes, dice, sides, flat, AP), and lets the GM pick a target. Damage applies per strike after the target's armor and AP. Humanoids show their combat skill text, and the GM types in damage instead.
5. **HP and effects on every token:** HP with quick damage and heal, armor, stacks (with end-of-phase stack damage and recovery rolls), conditions, temporary effects, and death clocks for downed players.
6. **Ending combat:** totals XP per player and clears combat-only effects.
7. **Data browser:** a quick lookup for skills (every tier's abilities and perks from `primordium-data.js`) and enemies (full stat blocks from `npc-data.js`, plus custom creatures), searchable and filterable.
8. **Custom creature builder:** create, edit, and delete new NPC types (including Bosses) saved locally and included in the backup file. Same shape as `npc-data.js` entries. Use `data/scaling.json` to suggest HP, armor, and damage for the chosen role, level, and armor class, and flag stats far off budget. Custom creatures appear in the enemy picker and data browser.

## Open questions and working assumptions
- **Quick and Defensive enemy abilities:** the NPC data does not mark ability type yet. Until it does, treat every enemy ability as a Standard ability (rolled on the tactics table). Support an optional `type` field on abilities so it can be added later.

## Data files
- `data/npc-data.js` sets `window.PRIMORDIUM_NPCS`: 97 creatures with role, level, tactics, HP, armor, size, stats, XP, attributes, description, and abilities. Each ability has a name, rarity, optional cooldown (phases, or "combat" for once per combat), its text, and where it is a damaging strike an `attack` object (`strikes`, `dice`, `sides`, `flat`, optional `ap`, `area`, `ignoreArmor`). Humanoids have `humanoid: true` and a `combatSkill` text instead of abilities. Bosses have `turnsPerPhase: 2`. Slimes and bonded mimics have no HP (`specialHp` explains their rule).
- `data/scaling.json` and `docs/scaling.md`: player benchmarks per power step, role and armor-class budgets, and the encounter difficulty formula (section 8 of `scaling.md`, which supersedes the short difficulty note in `rules.md`). Because the app opens without a server, load this data as a `.js` file that sets a global (like the other data files), kept in sync with the JSON.
- `data/primordium-data.js` sets `window.PRIMORDIUM_DATA`: every skill (with each tier's abilities and perks), races, and background traits. Shared with the player app; useful for reference or later features.

## Style
- The owner's guides use Times New Roman with a classic printed-rulebook feel. A dark, readable theme with a serif for headings suits the game; keep it clean and uncluttered for use mid-session.
- Write all text in plain language. Name things the way the guides do (Phase, Tactics, Standard, Elite, stacks, and so on).

## Working with the owner
- They are the game's designer and GM, not a programmer. Explain choices simply, and give clear steps for running the app locally and publishing it to GitHub Pages.
- Build in small, working steps, showing each feature before moving to the next.
