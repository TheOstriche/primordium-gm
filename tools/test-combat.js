// Checks js/combat-engine.js against docs/rules.md using scripted dice.
// Run:  node tools/test-combat.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const S = JSON.parse(fs.readFileSync(path.join(root, 'data', 'scaling.json'), 'utf8'));
const Rules = require(path.join(root, 'js', 'rules.js'))(S);
const window = {};
eval(fs.readFileSync(path.join(root, 'data', 'npc-data.js'), 'utf8'));
const NPCS = window.PRIMORDIUM_NPCS;
const find = name => NPCS.find(n => n.name === name);

// Scripted dice: dice(sides, ...faces) queues face values for dice of that size.
// When the queue is empty, dice roll their highest face.
let queue = [];
let sidesNow = 4;
const random = () => ((queue.length ? queue.shift() : sidesNow) - 1) / sidesNow + 1e-9;
const C = require(path.join(root, 'js', 'combat-engine.js'))(Rules, find, random);
function dice(sides, ...faces) { sidesNow = sides; queue = faces; }

let failed = 0;
function eq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log((ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ': got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)));
}

const players = [
  { id: 'p1', name: 'Kaela', level: 5, hp: 60, armor: 3, stats: { STR: 3, AGI: 0, KNO: 0, SPD: 1, PER: 2, SPE: 0 } },
  { id: 'p2', name: 'Bram', level: 5, hp: 60, armor: 3, stats: { STR: 1, AGI: 2, KNO: 1, SPD: -4, PER: 3, SPE: 0 } }
];
const enc = { id: 'e1', name: 'Test', partyIds: ['p1', 'p2'], enemies: [{ npcName: 'Wolf', count: 2 }, { npcName: 'Clockwork Titan', count: 1 }] };

// --- Building and initiative ---
const combat = C.fromEncounter(enc, players);
eq('combatants built', combat.combatants.map(c => c.name), ['Kaela', 'Bram', 'Wolf 1', 'Wolf 2', 'Clockwork Titan']);
const wolfInit = 5 + find('Wolf').stats.PER;           // 8
const [kaela, bram, wolf1, wolf2, titan] = combat.combatants;
kaela.init = wolfInit;                                  // tie with the wolves
bram.init = wolfInit;                                   // tie, but higher Perception
C.begin(combat, null);
const names = combat.order.map(e => C.get(combat, e.cid).name + (e.second ? ' (2nd)' : ''));
eq('wolf initiative is 5 + PER', wolf1.init, wolfInit);
const tieBlock = names.filter(n => ['Kaela', 'Bram', 'Wolf 1', 'Wolf 2'].includes(n));
eq('ties: players first, higher PER first', tieBlock, ['Bram', 'Kaela', 'Wolf 1', 'Wolf 2']);
eq('boss second turn at the end', names[names.length - 1], 'Clockwork Titan (2nd)');
eq('phase 1, first turn active', [combat.phase, combat.turn], [1, 0]);

// --- Movement ---
eq('movement 5 + Speed', C.movement(kaela), 6);
eq('movement minimum 2', C.movement(bram), 2);
eq('diagonals cost 1M', C.distance(0, 0, 3, 2), 3);

// --- Damage ---
eq('armor per strike, AP', C.computeDamage({ armor: 3 }, { strikes: [5, 2], ap: 1 }).total, 3 + 0);
eq('ignore armor', C.computeDamage({ armor: 3 }, { strikes: [5, 2], ignoreArmor: true }).total, 7);
eq('failed dodge x1.5 rounds down', C.computeDamage({ armor: 0 }, { strikes: [7], failedDodge: true }).total, 10);
eq('resist capped at 75%', C.computeDamage({ armor: 0 }, { strikes: [20], resist: 90 }).total, 5);
eq('block subtracts', C.computeDamage({ armor: 0 }, { strikes: [9], block: 4 }).total, 5);

// --- Downed and death clock ---
C.hurt(combat, kaela, 60, true);
eq('player downed at 0 HP starts a 3-phase clock', [kaela.hp, kaela.deathClock], [0, 3]);
C.hurt(combat, kaela, 5, true);
eq('hit while downed removes a phase', kaela.deathClock, 2);
C.heal(combat, kaela, 10);
eq('healing above 0 clears the clock', [kaela.hp, kaela.deathClock], [5, null]);
C.hurt(combat, wolf1, 999, true);
eq('enemy at 0 HP is defeated', wolf1.dead, true);

// --- Stacks and recovery ---
C.addStacks(bram, 'Bleed', 5);
dice(4, 4);
let r = C.recover(bram, 'Bleed');
eq('recovery on a 4 vs target 4: damaging loses max(3, half up)', [r.success, r.lost, r.left], [true, 3, 2]);
C.addStacks(bram, 'Fear', 5);
dice(4, 1);
r = C.recover(bram, 'Fear');
eq('a 1 never recovers', r.success, false);
C.addStacks(bram, 'Fear', 0);
bram.stacks.Fear.target = 2;
dice(4, 2);
r = C.recover(bram, 'Fear');
eq('other stacks lose half, rounded up (5 -> 2)', [r.success, r.lost, r.left], [true, 3, 2]);

// --- End of phase ---
bram.stacks = {};
C.addStacks(bram, 'Poison', 2);
bram.effects = [{ text: 'Shield wall', phases: 1 }];
const hpBefore = bram.hp;
dice(4, 3, 2, 4, 4, 4, 4, 4, 4, 4, 4);
combat.turn = combat.order.length;
const lines = C.endPhase(combat);
eq('stack damage 2D4 ignores armor', hpBefore - bram.hp, 5);
eq('recovery target drops by 1 (min 2)', bram.stacks.Poison.target, 3);
eq('effect with 1 phase left expires', bram.effects.length, 0);
eq('phase advances', combat.phase, 2);
eq('end-of-phase report has lines', lines.length >= 2, true);

// --- Cooldowns and ability choice ---
const tnpc = find('Clockwork Titan');
const rare = tnpc.abilities.find(a => a.rarity === 'Rare' || a.cooldown);
if (rare) {
  // Used in phase P with cooldown N: unavailable for the next N phases, ready in phase P + N + 1.
  const usedIn = combat.phase;
  const cd = C.cooldownOf(rare);
  C.markUsed(combat, titan, rare);
  combat.phase = usedIn + cd;
  eq('cooldown ' + cd + ': still waiting in phase P + ' + cd, C.isReady(combat, titan, rare), false);
  combat.phase = usedIn + cd + 1;
  eq('cooldown ' + cd + ': ready in phase P + ' + (cd + 1), C.isReady(combat, titan, rare), true);
  combat.phase = usedIn;
}
eq('Mythic is once per combat', C.cooldownOf({ rarity: 'Mythic' }), 'combat');
// Basic-tactics wolf always picks Basic.
const w = C.chooseAbility(combat, wolf2, find('Wolf'), 17);
eq('basic tactics picks a Basic ability', w.ability && w.ability.rarity, 'Basic');
wolf2.conditions.push('Disoriented');
eq('disoriented Basic-tactics enemy can not use abilities', C.chooseAbility(combat, wolf2, find('Wolf'), 5).ability, null);
// Drop a rarity when the rolled one is unavailable.
const goodNpc = NPCS.find(n => n.tactics === 'Good' && !n.humanoid && !(n.abilities || []).some(a => a.rarity === 'Rare'));
if (goodNpc) {
  const gc = C.fromEncounter({ id: 'x', name: 'x', partyIds: [], enemies: [{ npcName: goodNpc.name, count: 1 }] }, []).combatants[0];
  const pick = C.chooseAbility(combat, gc, goodNpc, 20);
  eq('no Rare ability: drops below Rare (' + goodNpc.name + ')', pick.ability && pick.ability.rarity !== 'Rare', true);
}

// --- Attack rolls ---
dice(6, 1, 1);
eq('strike fails only when every die is 1', C.rollAttack({ strikes: 1, dice: 2, sides: 6, flat: 2 }).strikes[0].value, 0);
dice(6, 1, 3);
eq('strike with one 1 still hits', C.rollAttack({ strikes: 1, dice: 2, sides: 6, flat: 2 }).strikes[0].value, 6);

// --- Surprise phase ---
const c2 = C.fromEncounter(enc, players);
c2.combatants[0].init = 3; c2.combatants[1].init = 2;
C.begin(c2, 'enemy');
eq('surprise: first actor is an enemy', C.get(c2, C.activeEntry(c2).cid).kind, 'enemy');
while (C.nextTurn(c2) !== 'phase-end') eq('surprise: only enemies act', C.get(c2, C.activeEntry(c2).cid).kind, 'enemy');
C.endPhase(c2);
eq('after surprise, phase 1 begins with everyone', [c2.phase, c2.surprise], [1, null]);

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nAll checks passed');
process.exit(failed ? 1 : 0);
