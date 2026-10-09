// Checks js/rules.js against the worked examples in docs/scaling.md.
// Run:  node tools/test-rules.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const S = JSON.parse(fs.readFileSync(path.join(root, 'data', 'scaling.json'), 'utf8'));
const R = require(path.join(root, 'js', 'rules.js'))(S);

const window = {};
eval(fs.readFileSync(path.join(root, 'data', 'npc-data.js'), 'utf8'));
const NPCS = window.PRIMORDIUM_NPCS;

let failed = 0;
function check(label, actual, expected, tolerance = 0.01) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failed++;
  console.log((ok ? 'ok   ' : 'FAIL ') + label + ': ' + (+actual.toFixed(3)) + (ok ? '' : ' (expected ' + expected + ')'));
}

// Section 3: step 10 vs armor 5.
check('dpt step 10 vs armor 5', R.playerDptVsArmor(10, 5), 27.29);

// Section 8 worked check.
const d = R.encounterDifficulty(3, 4, [
  { hp: 45, armor: 0, dmg: 15, count: 3 },
  { hp: 130, armor: 0, dmg: 24, count: 1 }
]);
check('standard kill turns', d.groups[0].killTurns, 2.51);
check('elite kill turns', d.groups[1].killTurns, 7.25);
check('standard drop turns', d.groups[0].dropTurns, 5);
check('elite drop turns', d.groups[1].dropTurns, 2.86);
check('standard lost', d.groups[0].lost, 0.753, 0.002);
check('elite lost', d.groups[1].lost, 1.293, 0.002);
check('rounds to clear', d.roundsToClear, 3.70);
check('share lost', d.shareLost, 0.51, 0.005);
if (d.band !== 'Hard') { failed++; console.log('FAIL band: ' + d.band); } else console.log('ok   band: Hard');

// XP matches what npc-data.js already lists.
const xpOff = NPCS.filter(n => Math.abs(R.xpFor(n.role, n.level) - n.xp) > 0.5);
if (xpOff.length) { failed++; console.log('FAIL xp differs for: ' + xpOff.map(n => n.name).join(', ')); }
else console.log('ok   xp matches all ' + NPCS.length + ' creatures');

// Wolf: one Basic bite, 1 strike D10 = 5.5.
check('wolf damage per turn', R.estimateDamagePerTurn(NPCS.find(n => n.name === 'Wolf')), 5.5);

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nAll checks passed');
process.exit(failed ? 1 : 0);
