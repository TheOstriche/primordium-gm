// Reference tab: quick lookup for skills, enemies (stat blocks), races and traits, and the rules docs.
(function () {
  const { h, fill, fmt, toast } = UI;
  const DATA = window.PRIMORDIUM_DATA || { skills: [], races: {}, traits: {} };
  const DOCS = window.PRIMORDIUM_DOCS || [];

  const state = {
    section: 'skills',
    skill: DATA.skills.length ? DATA.skills[0].name : null,
    skillSearch: '',
    enemy: null,
    enemyFilter: { text: '', family: '', role: '' },
    traitCategory: '',
    doc: DOCS.length ? DOCS[0].id : null
  };
  let els = {};

  function render(root) {
    els = { nav: h('div.ref-nav'), list: h('div.ref-list'), detail: h('div.ref-detail') };
    fill(root, els.nav, h('div.ref-layout', els.list, els.detail));
    draw();
  }

  function draw() {
    const sections = [['skills', 'Skills'], ['enemies', 'Enemies'], ['races', 'Races and traits'], ['rules', 'Rules']];
    fill(els.nav, sections.map(([id, label]) => h('button.toggle' + (state.section === id ? '.on' : ''), {
      onclick: () => { state.section = id; draw(); }
    }, label)));
    ({ skills: drawSkills, enemies: drawEnemies, races: drawRaces, rules: drawRules })[state.section]();
  }

  // ---------- Skills ----------

  const entries = skill => {
    const out = [];
    for (const [tier, list] of Object.entries(skill.base || {})) list.forEach(e => out.push({ e, where: 'Tier ' + tier }));
    for (const [path, tiers] of Object.entries(skill.paths || {})) {
      for (const [tier, list] of Object.entries(tiers)) list.forEach(e => out.push({ e, where: path + ' ' + tier }));
    }
    return out;
  };

  function drawSkills() {
    const q = state.skillSearch.trim().toLowerCase();
    const search = h('input.search', {
      type: 'search', placeholder: 'Search skills, abilities, perks…', value: state.skillSearch,
      oninput: e => { state.skillSearch = e.target.value; drawSkillList(); }
    });
    const listBody = h('div');
    fill(els.list, search, listBody);
    function drawSkillList() {
      const q2 = state.skillSearch.trim().toLowerCase();
      if (!q2) {
        const groups = [...new Set(DATA.skills.map(s => s.group))];
        fill(listBody, groups.map(g => [
          h('div.list-group', g),
          DATA.skills.filter(s => s.group === g).map(s => h('div.list-item' + (s.name === state.skill ? '.on' : ''), {
            onclick: () => { state.skill = s.name; draw(); }
          }, s.name))
        ]));
        return;
      }
      const hits = [];
      for (const s of DATA.skills) {
        if (s.name.toLowerCase().includes(q2)) hits.push(h('div.list-item' + (s.name === state.skill ? '.on' : ''), { onclick: () => { state.skill = s.name; draw(); } }, s.name, h('span.muted.small', ' skill')));
        for (const { e, where } of entries(s)) {
          if ((e.name + ' ' + e.desc + ' ' + e.usage).toLowerCase().includes(q2)) {
            hits.push(h('div.list-item', { onclick: () => { state.skill = s.name; draw(); scrollToEntry(e.name); } },
              e.name, h('div.muted.small', s.name + ' · ' + where + ' · ' + (e.kind === 'perk' ? 'Perk' : e.rarity + ' ' + e.type))));
          }
        }
      }
      fill(listBody, hits.length ? hits.slice(0, 200) : h('p.muted.small', 'Nothing matches.'));
    }
    drawSkillList();
    if (q) search.focus();

    const skill = DATA.skills.find(s => s.name === state.skill);
    if (!skill) return fill(els.detail, h('p.muted', 'Choose a skill.'));
    const tierBlock = (title, list) => h('div.tier',
      h('h3', title),
      h('div.entry-grid', list.map(entryCard)));
    fill(els.detail,
      h('h1', skill.name), h('p.muted', skill.group + ' skill'), h('p', skill.intro),
      Object.entries(skill.base || {}).map(([tier, list]) => tierBlock(tier === '0' ? 'Tier 0' : 'Base Tier ' + tier, list)),
      Object.entries(skill.paths || {}).map(([path, tiers]) => h('div.path',
        h('h2', path + ' path'),
        Object.entries(tiers).map(([tier, list]) => tierBlock('Path Tier ' + tier, list)))));
  }

  function entryCard(e) {
    return h('div.entry', { 'data-name': e.name },
      h('div.entry-head',
        h('strong', e.name),
        e.kind === 'perk' ? h('span.tag', 'Perk')
          : [h('span.rarity.rarity-' + String(e.rarity).toLowerCase(), e.rarity), h('span.chip', e.type)]),
      e.desc ? h('p.small.muted', e.desc) : null,
      e.usage ? h('p.small', e.usage) : null);
  }

  function scrollToEntry(name) {
    const el = [...els.detail.querySelectorAll('.entry')].find(x => x.dataset.name === name);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1500);
    }
  }

  // ---------- Enemies ----------

  function drawEnemies() {
    const f = state.enemyFilter;
    const listBody = h('div');
    const set = key => e => { f[key] = e.target.value; drawEnemyList(); };
    fill(els.list,
      h('input.search', { type: 'search', placeholder: 'Search enemies…', value: f.text, oninput: set('text') }),
      h('div.row',
        h('select', { onchange: set('family') }, h('option', { value: '' }, 'All families'),
          GameData.families().map(x => h('option', { value: x, selected: f.family === x }, x))),
        h('select', { onchange: set('role') }, h('option', { value: '' }, 'All roles'),
          GameData.ROLES.map(x => h('option', { value: x, selected: f.role === x }, x)))),
      listBody);
    function drawEnemyList() {
      const t = f.text.trim().toLowerCase();
      const list = GameData.all().filter(n =>
        (!f.family || n.family === f.family) && (!f.role || n.role === f.role) &&
        (!t || [n.name, n.family, n.description, n.combatSkill, ...(n.abilities || []).map(a => a.name + ' ' + a.text)].join(' ').toLowerCase().includes(t)))
        .sort((a, b) => a.family.localeCompare(b.family) || a.level - b.level);
      let fam = null;
      fill(listBody, list.map(n => {
        const head = n.family !== fam ? h('div.list-group', (fam = n.family)) : null;
        return [head, h('div.list-item' + (n.name === state.enemy ? '.on' : ''), {
          onclick: () => { state.enemy = n.name; drawEnemyDetail(); drawEnemyList(); }
        }, n.name, n.custom ? h('span.tag', 'custom') : null, h('span.muted.small', ' ' + n.role + ' · Lv ' + n.level))];
      }));
    }
    drawEnemyList();
    drawEnemyDetail();
  }

  function drawEnemyDetail() {
    const n = state.enemy && GameData.find(state.enemy);
    if (!n) return fill(els.detail, h('p.muted', 'Choose an enemy.'));
    fill(els.detail,
      statBlock(n),
      h('div.row',
        h('button', {
          onclick: () => {
            const s = Store.state;
            let enc = s.encounters.find(e => e.id === s.settings.currentEncounterId);
            if (!enc) return toast('Create an encounter on the Encounter tab first.', 'bad');
            const row = enc.enemies.find(e => e.npcName === n.name);
            if (row) row.count++; else enc.enemies.push({ npcName: n.name, count: 1 });
            Store.changed();
            toast(n.name + ' added to ' + enc.name + '.', 'good');
          }
        }, 'Add to current encounter'),
        h('button.ghost', { onclick: () => { Creatures.editCopyOf(n); App.show('creatures'); } },
          n.custom ? 'Edit' : 'Copy as a custom creature')));
  }

  // A full stat block, used here and in the creature builder's preview.
  function statBlock(n) {
    const budget = Rules.budgetFor(n.role, n.level);
    const est = Rules.estimateDamagePerTurn(n);
    return h('div.statblock',
      h('h1', n.name, n.custom ? h('span.tag', 'custom') : null),
      h('p.muted', [n.family, n.role, 'Level ' + n.level, n.size, n.alignment].filter(Boolean).join(' · ')),
      h('div.sb-grid',
        sbStat('HP', n.hp != null ? n.hp : '—'),
        sbStat('Armor', n.armor || 0),
        sbStat('Tactics', n.tactics),
        sbStat('XP', fmt(n.xp != null ? n.xp : Rules.xpFor(n.role, n.level), 2)),
        sbStat('Move', Math.max(2, 5 + (n.stats.SPD || 0)) + 'M'),
        sbStat('Initiative', 5 + (n.stats.PER || 0)),
        n.turnsPerPhase > 1 ? sbStat('Turns', n.turnsPerPhase + ' per phase') : null),
      h('div.sb-stats', GameData.STATS.map(k => h('div', { title: GameData.STAT_NAMES[k] }, h('span.muted.small', k), h('strong', signed(n.stats[k]))))),
      n.specialHp ? h('p', h('strong', 'Special HP: '), n.specialHp) : null,
      n.attributes && n.attributes !== 'None' ? h('p', h('strong', 'Attributes: '), n.attributes) : null,
      n.humanoid
        ? h('div.sb-abilities', h('h3', 'Combat skill'), h('p', n.combatSkill))
        : h('div.sb-abilities', h('h3', 'Abilities'),
          (n.abilities || []).map(a => h('div.entry',
            h('div.entry-head', h('strong', a.name),
              h('span.rarity.rarity-' + a.rarity.toLowerCase(), a.rarity),
              a.type && a.type !== 'Standard' ? h('span.chip', a.type) : null,
              Combat.cooldownOf(a) ? h('span.chip', Combat.cooldownOf(a) === 'combat' ? 'once per combat' : 'cooldown ' + Combat.cooldownOf(a)) : null,
              a.attack ? h('span.muted.small', 'avg ' + fmt(Rules.attackAverage(a.attack), 1)) : null),
            h('p.small', a.text)))),
      n.description && n.description !== 'Standard' ? h('p.muted', n.description) : null,
      budget ? h('p.muted.small', 'Budget for a level ' + n.level + ' ' + n.role + ': ' + budget.hp + ' HP (no armor), ' +
        budget.damagePerTurn + ' damage per turn.' + (est != null ? ' This creature averages about ' + fmt(est, 1) + ' per turn.' : '')) : null);
  }
  const sbStat = (label, value) => h('div.sb-stat', h('span.muted.small', label), h('strong', String(value)));
  const signed = v => (v > 0 ? '+' : '') + (v || 0);

  // ---------- Races and traits ----------

  function drawRaces() {
    const cats = [...new Set(Object.values(DATA.traits).map(t => t.category))];
    fill(els.list,
      h('div.list-group', 'Races'),
      Object.keys(DATA.races).map(name => h('div.list-item', { onclick: () => scrollTo('race-' + name) }, name)),
      h('div.list-group', 'Traits'),
      h('div.list-item' + (!state.traitCategory ? '.on' : ''), { onclick: () => { state.traitCategory = ''; drawRaces(); } }, 'All traits'),
      cats.map(c => h('div.list-item' + (state.traitCategory === c ? '.on' : ''), { onclick: () => { state.traitCategory = c; drawRaces(); scrollTo('traits'); } }, c)));
    const traits = Object.values(DATA.traits).filter(t => !state.traitCategory || t.category === state.traitCategory);
    fill(els.detail,
      h('h1', 'Races'),
      h('p.muted.small', 'Stat order assumed: Strength, Agility, Knowledge, Speed, Perception, Speech.'),
      Object.entries(DATA.races).map(([name, r]) => h('div.entry.race', { id: 'race-' + name },
        h('div.entry-head', h('strong', name), h('span.chip', r.hp + ' HP'), r.armor ? h('span.chip', r.armor + ' armor') : null),
        h('div.sb-stats', (r.stats || []).map((v, i) => h('div', h('span.muted.small', GameData.STATS[i]), h('strong', signed(v))))),
        h('ul.small', (r.traits || []).map(t => h('li', t))),
        r.resist ? h('p.small.muted', 'Resistances: ' + [].concat(r.resist).join(', ')) : null)),
      h('h1', { id: 'traits' }, 'Background traits'),
      h('div.table-wrap', h('table',
        h('thead', h('tr', h('th', 'Trait'), h('th', 'Category'), h('th', 'Cost'), h('th', 'Effect'))),
        h('tbody', traits.map(t => h('tr', h('td', h('strong', t.name)), h('td', t.category), h('td', String(t.cost)), h('td', t.effect)))))));
  }

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'start' });
  }

  // ---------- Rules ----------

  function drawRules() {
    const doc = DOCS.find(d => d.id === state.doc) || DOCS[0];
    if (!doc) {
      fill(els.list, null);
      return fill(els.detail, h('p.muted', 'Rules docs are missing. Run node tools/build-data.js.'));
    }
    fill(els.list,
      DOCS.map(d => [
        h('div.list-item' + (d.id === doc.id ? '.on' : ''), { onclick: () => { state.doc = d.id; drawRules(); } }, h('strong', d.title)),
        d.id === doc.id ? Markdown.headings(d.markdown).map(x => h('div.list-item.sub' + (x.level > 2 ? '.deep' : ''), { onclick: () => scrollTo(x.id) }, x.text)) : null
      ]));
    fill(els.detail, h('div.markdown', Markdown.render(doc.markdown)));
  }

  App.register('reference', render);
  window.Reference = { statBlock };
})();
