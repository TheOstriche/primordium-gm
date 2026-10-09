// Copies data/scaling.json into data/scaling-data.js so the app can load it
// when opened straight from a file (browsers block reading .json that way).
// Run after editing scaling.json:  node tools/build-scaling.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const json = JSON.parse(fs.readFileSync(path.join(root, 'data', 'scaling.json'), 'utf8'));
const out = '// Generated from data/scaling.json by tools/build-scaling.js. Edit the JSON, not this file.\n' +
  'window.PRIMORDIUM_SCALING = ' + JSON.stringify(json) + ';\n';
fs.writeFileSync(path.join(root, 'data', 'scaling-data.js'), out);
console.log('Wrote data/scaling-data.js');
