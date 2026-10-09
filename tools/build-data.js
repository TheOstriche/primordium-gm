// Packages files the browser can not read directly when the app is opened from a file:
//   data/scaling.json      -> data/scaling-data.js  (window.PRIMORDIUM_SCALING)
//   docs/rules.md, scaling -> data/docs-data.js     (window.PRIMORDIUM_DOCS)
// Run after editing any of them:  node tools/build-data.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, name, value, source) => {
  fs.writeFileSync(path.join(root, rel),
    '// Generated from ' + source + ' by tools/build-data.js. Edit the source, not this file.\n' +
    'window.' + name + ' = ' + JSON.stringify(value) + ';\n');
  console.log('Wrote ' + rel);
};

write('data/scaling-data.js', 'PRIMORDIUM_SCALING', JSON.parse(read('data/scaling.json')), 'data/scaling.json');
write('data/docs-data.js', 'PRIMORDIUM_DOCS', [
  { id: 'rules', title: 'Combat rules', markdown: read('docs/rules.md') },
  { id: 'scaling', title: 'Scaling and difficulty', markdown: read('docs/scaling.md') }
], 'docs/rules.md and docs/scaling.md');
