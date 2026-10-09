# Primordium 2.0 — Player Damage & Encounter Scaling

Source of truth: the Enemy Budget workbook. Machine-readable copy: `data/scaling.json`. Use these numbers for the GM tool's encounter difficulty estimate and enemy budget checks.

## 1. Levels to power steps

`step = min(12, ceil(level / 2))`. Step 0 = Tier 0, 1–4 = Base Tiers, 5–8 = Path Tiers, 9–12 = beyond the paths.

## 2. Reference player (focused fighter)

- Damage stat = 2 + floor(step / 2)
- Item tier = floor(step / 2)
- Reference armor (what a Medium-armored enemy wears) = 3 + floor(step / 2)
- Player armor = 2 + item tier
- Player HP = 35 + 25 × floor(level / 5), with level = step × 2
- Player damage per turn = basic attack damage × **1.3** (card mix multiplier)

## 3. Player benchmark table

Basic = median basic attack across all ten weapons. "Armored" is against a target wearing the reference armor; "Horde" is the per-target average used against groups.

| Step | Stage | Stat | Item tier | Ref armor | Basic unarm. | Basic armored | Basic horde | **Player dmg/turn** | Dmg/turn vs armored | Player HP | Player armor |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Tier 0 | 2 | 0 | 3 | 8.32 | 4.03 | 6.72 | **10.82** | 5.24 | 35 | 2 |
| 1 | Base Tier 1 | 2 | 0 | 3 | 8.3 | 4.27 | 7 | **10.79** | 5.55 | 35 | 2 |
| 2 | Base Tier 2 | 3 | 1 | 4 | 9.55 | 5.05 | 8.31 | **12.42** | 6.57 | 35 | 3 |
| 3 | Base Tier 3 | 3 | 1 | 4 | 13.79 | 8.02 | 11.11 | **17.93** | 10.43 | 60 | 3 |
| 4 | Base Tier 4 | 4 | 2 | 5 | 16.63 | 9.65 | 13.4 | **21.62** | 12.55 | 60 | 4 |
| 5 | Path Tier 1 | 4 | 2 | 5 | 20.4 | 12.92 | 15.38 | **26.52** | 16.8 | 85 | 4 |
| 6 | Path Tier 2 | 5 | 3 | 6 | 22.77 | 14.14 | 16.61 | **29.6** | 18.38 | 85 | 5 |
| 7 | Path Tier 3 | 5 | 3 | 6 | 22.72 | 14.12 | 16.6 | **29.54** | 18.36 | 85 | 5 |
| 8 | Path Tier 4 | 6 | 4 | 7 | 25.76 | 15.28 | 17.59 | **33.49** | 19.86 | 110 | 6 |
| 9 | Beyond paths (+1) | 6 | 4 | 7 | 25.76 | 15.19 | 17.51 | **33.49** | 19.75 | 110 | 6 |
| 10 | Beyond paths (+2) | 7 | 5 | 8 | 28.57 | 16.44 | 18.26 | **37.14** | 21.37 | 135 | 7 |
| 11 | Beyond paths (+3) | 7 | 5 | 8 | 28.57 | 16.47 | 18.23 | **37.14** | 21.41 | 135 | 7 |
| 12 | Beyond paths (+4) | 8 | 6 | 9 | 31.42 | 17.84 | 19.11 | **40.85** | 23.19 | 135 | 8 |

### Damage against a specific armor value

```
dpt(A) = unarmoredDPT - (unarmoredDPT - armoredDPT) * A / referenceArmor   // floor at 1
```
Linear between armor 0 and the reference armor; extrapolate past it. Check: step 10 vs armor 5 → 37.14 − (37.14 − 21.37) × 5/8 = 27.29.

## 4. Enemy roles

| Role | Player turns to kill | Its turns to drop a player | XP × | Turns per phase |
|---|---|---|---|---|
| Minion | 1 | 10 | 0.25 | 1 |
| Standard | 2.5 | 5 | 1 | 1 |
| Elite | 6 | 3 | 3 | 1 (min Fair tactics) |
| Boss | 20 | 2 | 10 | 2 (min Fair tactics) |

### Budget formulas

```
enemyHP        = role.playerTurnsToKill * playerDamagePerTurn[step] * armorClass.hpMultiplier
enemyDmg/turn  = playerHP[step] / role.turnsToDropPlayer + playerArmor[step]
enemyArmor     = round(referenceArmor[step] * armorClass.armorMultiplier)
basicAbility   = enemyDmg/turn / tacticsMultiplier
```
High HP is rounded to the nearest 5 in published stat blocks.

## 5. Armor classes

| Class | Armor (× reference) | HP multiplier |
|---|---|---|
| None | 0 | 1.0 |
| Light | 0.5 | 0.8 |
| Medium | 1.0 | 0.6 |
| Heavy | 1.5 | 0.5 |

## 6. Tactics and rarity

Tactics multiplier (average turn vs the Basic ability, with cooldowns): Basic 1.00, Fair 1.21, Good 1.37, Great 1.56, Excellent 1.85, Mythic 2.20.

Rarity budgets (× Basic): Common 1.3, Uncommon 1.6, Rare 2.0, Epic 2.6, Legendary 3.3, Mythic 4.5. Area attacks deal 60% per target.

## 7. Budget table (unarmored HP, damage per turn before player armor)

| Step | Minion HP | Minion dmg | Standard HP | Standard dmg | Elite HP | Elite dmg | Boss HP | Boss dmg | Armor L/M/H |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 11 | 5.5 | 27 | 9 | 65 | 13.7 | 216 | 19.5 | 2/3/5 |
| 1 | 11 | 5.5 | 27 | 9 | 65 | 13.7 | 216 | 19.5 | 2/3/5 |
| 2 | 12 | 6.5 | 31 | 10 | 74 | 14.7 | 248 | 20.5 | 2/4/6 |
| 3 | 18 | 9 | 45 | 15 | 108 | 23 | 359 | 33 | 2/4/6 |
| 4 | 22 | 10 | 54 | 16 | 130 | 24 | 432 | 34 | 3/5/8 |
| 5 | 27 | 12.5 | 66 | 21 | 159 | 32.3 | 530 | 46.5 | 3/5/8 |
| 6 | 30 | 13.5 | 74 | 22 | 178 | 33.3 | 592 | 47.5 | 3/6/9 |
| 7 | 30 | 13.5 | 74 | 22 | 177 | 33.3 | 591 | 47.5 | 3/6/9 |
| 8 | 33 | 17 | 84 | 28 | 201 | 42.7 | 670 | 61 | 4/7/11 |
| 9 | 33 | 17 | 84 | 28 | 201 | 42.7 | 670 | 61 | 4/7/11 |
| 10 | 37 | 20.5 | 93 | 34 | 223 | 52 | 743 | 74.5 | 4/8/12 |
| 11 | 37 | 20.5 | 93 | 34 | 223 | 52 | 743 | 74.5 | 4/8/12 |
| 12 | 41 | 21.5 | 102 | 35 | 245 | 53 | 817 | 75.5 | 5/9/14 |

## 8. Encounter difficulty estimate

Inputs: party power step `P`, party size `N` (default 4), and enemy groups listed in kill order (weakest first). Uses the party's benchmarks for player damage, HP and armor; uses each enemy's **actual** HP, armor and damage per turn when known (stat block), else the budget.

```
for each group g (in order):
  dpt        = dpt(g.armor) at step P            // section 3 formula
  killTurns  = g.hp / dpt                         // player turns to kill one
  dropTurns  = playerHP[P] / max(1, g.dmg - playerArmor[P])
  roundsBefore = (sum of count*killTurns of earlier groups) / N
  lost_g     = ( g.count * roundsBefore
               + (killTurns / N) * g.count * (g.count + 1) / 2 ) / dropTurns   // in player-HPs
roundsToClear = sum(count*killTurns) / N
shareLost     = sum(lost_g) / N
```
Bosses: their damage per turn already includes both turns per phase.

Difficulty bands on `shareLost`: **Easy** < 15%, **Standard** 15–35%, **Hard** 35–60%, **Deadly** > 60%.

Worked check (from the workbook): party step 3, N=4, 3 Standards (45 HP, 15 dmg, no armor) then 1 step-4 Elite (130 HP, 24 dmg) → kill turns 2.51 and 7.25, drop turns 5 and 2.86, lost 0.753 + 1.293, rounds to clear 3.70, share lost 51% → **Hard**.

## 9. XP

`XP = role.xpMultiplier × (20 + 6 × enemyLevel)` per enemy, summed and split by the GM.
