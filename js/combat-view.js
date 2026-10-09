// Combat tab: set up from the current encounter, initiative, turn order, the grid,
// a detail panel for the selected token (HP, stacks, conditions, effects, enemy turns),
// and ending combat with XP.
(function () {
  const { h, fill, toast, fmt } = UI;
  const S = () => Store.state;
  const DEFAULT_MAP = { cols: 24, rows: 16, cell: 40, lineOpacity: 0.35, imageKey: null };

  let root = null;
  let els = {};
  let grid = null;
  let selectedId = null;
  let ruler = false;
  let mapOpen = false;
  let addOpen = false;
  let ambush = '';
  let plan = null;        // enemy turn in progress: { cid, choice, attack, targets: { id: { on, dodge, block } } }
  let report = null;      // lines from the last end of phase
  let ending = false;     // showing the end-combat screen
  let xpAll = false;      // award XP for enemies that were not defeated too

  const combat = () => S().combat;
  const encounterOf = cb => S().encounters.find(e => e.id === cb.encounterId);

  function mapOf(cb) {
    const holder = encounterOf(cb) || cb;
    if (!holder.map) holder.map = Object.assign({}, DEFAULT_MAP);
    for (const k of Object.keys(DEFAULT_MAP)) if (holder.map[k] === undefined) holder.map[k] = DEFAULT_MAP[k];
    return holder.map;
  }

  function activeCombatant(cb) {
    const e = Combat.activeEntry(cb);
    return e ? Combat.get(cb, e.cid) : null;
  }

  // Run a change, save, and redraw.
  function act(fn) {
    fn();
    Store.changed();
    refresh();
  }

  // ---------- Top level ----------

  function render(r) {
    root = r;
    const cb = combat();
    if (!cb) return renderPrepare();
    els = { bar: h('div.combat-bar'), left: h('div.combat-left'), center: h('div.combat-center'), right: h('div.combat-right') };
    fill(root, els.bar, h('div.combat-layout', els.left, els.center, els.right));
    grid = Grid.create(els.center, {
      onSelect: id => { selectedId = id; refresh(); },
      onMove: (id, x, y) => act(() => {
        const c = Combat.get(combat(), id);
        c.x = x; c.y = y;
        selectedId = id;
      })
    });
    refresh();
  }

  function refresh() {
    const cb = combat();
    if (!cb || !els.bar || !root.contains(els.bar)) return render(root);
    if (!selectedId || !Combat.get(cb, selectedId)) {
      const a = activeCombatant(cb);
      selectedId = a ? a.id : (cb.combatants[0] || {}).id;
    }
    drawBar(cb);
    drawLeft(cb);
    drawRight(cb);
    grid.update({
      map: mapOf(cb), combatants: cb.combatants, selectedId,
      activeId: (activeCombatant(cb) || {}).id, ruler
    });
  }

  // ---------- Setting up ----------

  function renderPrepare() {
    const s = S();
    const enc = s.encounters.find(e => e.id === s.settings.currentEncounterId) || s.encounters[0];
    let body;
    if (!enc) {
      body = h('p.muted', 'Create an encounter on the Encounter tab first.');
    } else {
      const players = s.players.filter(p => enc.partyIds.includes(p.id)).length;
      const enemies = enc.enemies.reduce((t, e) => t + e.count, 0);
      body = [
        h('p', 'Set up combat for ', h('strong', enc.name), '.'),
        h('p.muted', players + ' players and ' + enemies + ' enemies. Change these on the Encounter tab.'),
        h('button.primary', { disabled: !players && !enemies, onclick: () => start(enc) }, 'Set up combat')
      ];
    }
    fill(root, h('div.page-narrow', h('h1', 'Combat'), body));
  }

  function start(enc) {
    const cb = Combat.fromEncounter(enc, S().players);
    autoPlace(cb, mapOf(cb));
    S().combat = cb;
    selectedId = null; plan = null; report = null; ending = false; ambush = '';
    Store.changed();
    render(root);
    fitToScreen();
  }

  // Zoom so the whole grid fits in the middle area.
  function fitToScreen() {
    const cb = combat();
    const wrap = els.center && els.center.querySelector('.board-wrap');
    if (!cb || !wrap) return;
    const map = mapOf(cb);
    const pad = 26;
    const fit = Math.floor(Math.min((wrap.clientWidth - pad) / map.cols, (wrap.clientHeight - pad) / map.rows));
    act(() => { map.cell = Math.max(16, Math.min(90, fit)); });
  }

  // Players along the left edge, enemies along the right, in columns.
  function autoPlace(cb, map) {
    const place = (list, fromRight) => {
      let col = fromRight ? map.cols - 2 : 1, row = 1, colWidth = 1;
      for (const c of list) {
        if (c.x != null) continue;
        const [fw, fh] = Combat.footprint(c);
        if (row + fh > map.rows - 1) {
          col += (fromRight ? -1 : 1) * (colWidth + 1);
          row = 1;
          colWidth = 1;
        }
        c.x = Math.max(0, Math.min(map.cols - fw, fromRight ? col - fw + 1 : col));
        c.y = Math.max(0, Math.min(map.rows - fh, row));
        row += fh + 1;
        colWidth = Math.max(colWidth, fw);
      }
    };
    place(cb.combatants.filter(c => c.kind === 'player'), false);
    place(cb.combatants.filter(c => c.kind === 'enemy'), true);
  }

  // ---------- Top bar ----------

  function drawBar(cb) {
    const active = activeCombatant(cb);
    const phaseLabel = cb.phase === 0 ? 'Setting up' : Combat.inSurprise(cb) ? 'Surprise phase' : 'Phase ' + cb.phase;
    const atEnd = cb.phase > 0 && !active;
    fill(els.bar,
      h('div.phase',
        h('span.phase-label', phaseLabel),
        active ? h('span.muted', ' · ' + active.name + "'s turn") : null,
        atEnd ? h('span.muted', ' · everyone has acted') : null),
      cb.phase > 0 && !atEnd ? h('button.primary', { onclick: nextTurn }, 'Next turn') : null,
      cb.phase > 0 ? h(atEnd ? 'button.primary' : 'button.ghost', { onclick: endPhase }, 'End phase') : null,
      h('span.spacer'),
      h('button' + (ruler ? '.on' : ''), { onclick: () => { ruler = !ruler; refresh(); }, title: 'Press and drag on the grid to measure' }, 'Ruler'),
      mapSettings(cb),
      addEnemyControl(cb),
      h('button.ghost.danger', { onclick: () => { ending = true; refresh(); } }, 'End combat'));
  }

  function nextTurn() {
    const cb = combat();
    plan = null;
    act(() => {
      Combat.nextTurn(cb);
      const a = activeCombatant(cb);
      if (a) selectedId = a.id;
    });
  }

  function endPhase() {
    const cb = combat();
    const a = activeCombatant(cb);
    if (a && !confirm('Not everyone has acted yet. End the phase anyway?')) return;
    plan = null;
    act(() => {
      report = { phase: Combat.inSurprise(cb) ? 'Surprise phase' : 'Phase ' + cb.phase, lines: Combat.endPhase(cb) };
      const next = activeCombatant(cb);
      if (next) selectedId = next.id;
    });
  }

  function mapSettings(cb) {
    const map = mapOf(cb);
    const num = (label, key, min, max) => h('label.field', label,
      h('input', { type: 'number', min, max, value: map[key], onchange: e => act(() => {
        map[key] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || map[key]));
      }) }));
    const upload = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: e => uploadImage(cb, e.target.files[0]) });
    const d = h('details.menu', { open: mapOpen, ontoggle: e => { mapOpen = e.target.open; } },
      h('summary', 'Map'),
      h('div.menu-body',
        h('div.menu-grid',
          num('Columns', 'cols', 4, 120),
          num('Rows', 'rows', 4, 120)),
        h('label.field', 'Zoom',
          h('input', { type: 'range', min: 16, max: 90, value: map.cell, oninput: e => { map.cell = +e.target.value; refreshGridOnly(); }, onchange: () => act(() => {}) })),
        h('button.ghost', { onclick: fitToScreen }, 'Fit to screen'),
        h('label.field', 'Grid lines',
          h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: map.lineOpacity, oninput: e => { map.lineOpacity = +e.target.value; refreshGridOnly(); }, onchange: () => act(() => {}) })),
        h('div.row',
          h('button', { onclick: () => upload.click() }, map.imageKey ? 'Replace map image' : 'Upload map image'),
          map.imageKey ? h('button.ghost', { onclick: () => removeImage(cb) }, 'Remove image') : null,
          upload),
        map.imageKey ? h('button.ghost', { onclick: () => fitRowsToImage(cb) }, 'Match rows to the image shape') : null,
        h('button.ghost', { onclick: () => act(() => { cb.combatants.forEach(c => { c.x = null; c.y = null; }); autoPlace(cb, map); }) }, 'Line tokens up again')));
    return d;
  }

  function refreshGridOnly() {
    const cb = combat();
    grid.update({ map: mapOf(cb), combatants: cb.combatants, selectedId, activeId: (activeCombatant(cb) || {}).id, ruler });
  }

  async function uploadImage(cb, file) {
    if (!file) return;
    const holder = encounterOf(cb) || cb;
    const key = 'map-' + holder.id;
    await Store.images.put(key, file);
    Grid.forgetImage(key);
    const map = mapOf(cb);
    map.imageKey = key;
    await fitRowsToImage(cb);
    toast('Map image added. Set Columns to the number of squares across the map.', 'good');
  }

  async function fitRowsToImage(cb) {
    const map = mapOf(cb);
    const url = await Grid.imageUrl(map.imageKey);
    if (!url) return;
    const img = new Image();
    img.src = url;
    await img.decode();
    act(() => { map.rows = Math.max(4, Math.round(map.cols * img.naturalHeight / img.naturalWidth)); });
  }

  async function removeImage(cb) {
    const map = mapOf(cb);
    if (!confirm('Remove the map image?')) return;
    await Store.images.remove(map.imageKey);
    Grid.forgetImage(map.imageKey);
    act(() => { map.imageKey = null; });
  }

  function addEnemyControl(cb) {
    const select = h('select', { 'aria-label': 'Creature' },
      GameData.all().slice().sort((a, b) => a.name.localeCompare(b.name))
        .map(n => h('option', { value: n.name }, n.name + ' (' + n.role + ', Lv ' + n.level + ')')));
    return h('details.menu', { open: addOpen, ontoggle: e => { addOpen = e.target.open; } },
      h('summary', 'Add enemy'),
      h('div.menu-body',
        h('p.muted.small', 'Reinforcements join the turn order at their initiative.'),
        select,
        h('div.row', h('button.primary', {
          onclick: () => act(() => {
            const c = Combat.addEnemy(cb, GameData.find(select.value));
            autoPlace(cb, mapOf(cb));
            selectedId = c.id;
            Combat.log(cb, c.name + ' joins the fight.');
          })
        }, 'Add'))));
  }

  // ---------- Left column ----------

  function drawLeft(cb) {
    if (cb.phase === 0) return fill(els.left, initiativeSetup(cb));
    fill(els.left,
      report ? h('div.card.report',
        h('div.card-head', h('h3', report.phase + ' resolved'), h('button.icon.ghost', { title: 'Dismiss', onclick: () => { report = null; refresh(); } }, '×')),
        report.lines.length ? h('ul.small', report.lines.map(l => h('li', l))) : h('p.muted.small', 'Nothing happened at the end of the phase.')) : null,
      h('div.card.turns',
        h('h3', 'Turn order'),
        cb.order.map((e, i) => turnRow(cb, e, i))),
      h('details.card.log',
        h('summary', 'Combat log'),
        h('ol.small', cb.log.slice(-60).reverse().map(l => h('li', h('span.muted', 'P' + l.phase + ' '), l.text)))));
  }

  function turnRow(cb, e, i) {
    const c = Combat.get(cb, e.cid);
    if (!c) return null;
    const isActive = i === cb.turn;
    const out = !Combat.canAct(cb, e);
    const stackCount = Object.values(c.stacks).reduce((t, s) => t + s.n, 0);
    return h('div.turn-row', {
      class: [c.kind, isActive && 'active', c.id === selectedId && 'selected', out && 'out'].filter(Boolean).join(' '),
      onclick: () => { selectedId = c.id; refresh(); }
    },
      h('span.init', e.second ? '2nd' : String(Combat.initiativeOf(c))),
      h('span.turn-name', c.name,
        c.dead ? h('span.badge.bad', c.kind === 'player' ? 'dead' : 'defeated') : null,
        Combat.isDowned(c) && !c.dead ? h('span.badge.bad', c.stabilized ? 'stable' : 'downed ' + c.deathClock) : null,
        stackCount ? h('span.badge', stackCount + ' st') : null,
        c.conditions.length ? h('span.badge', c.conditions.length + ' cond') : null),
      hpMini(c),
      h('span.order-btns',
        h('button.icon.ghost.tiny', { title: 'Move up', onclick: ev => { ev.stopPropagation(); act(() => Combat.moveEntry(cb, i, -1)); } }, '▲'),
        h('button.icon.ghost.tiny', { title: 'Move down', onclick: ev => { ev.stopPropagation(); act(() => Combat.moveEntry(cb, i, 1)); } }, '▼')));
  }

  function hpMini(c) {
    if (c.hp == null) return h('span.hp-mini.muted', '—');
    const pct = c.maxHp ? Math.max(0, Math.min(1, c.hp / c.maxHp)) : 1;
    return h('span.hp-mini', { title: c.hp + ' / ' + c.maxHp + ' HP' },
      h('span.hp-mini-text', String(c.hp)),
      h('span.hp-mini-bar', h('span', { style: 'width:' + pct * 100 + '%', class: pct <= 0.25 ? 'low' : '' })));
  }

  function initiativeSetup(cb) {
    const players = cb.combatants.filter(c => c.kind === 'player');
    const enemies = cb.combatants.filter(c => c.kind === 'enemy');
    return h('div.card',
      h('h3', 'Initiative'),
      h('p.muted.small', 'Players roll D10 + Perception; type in each result. Enemies have 5 + Perception.'),
      players.map(c => h('div.init-row',
        h('span', c.name),
        h('input', { type: 'number', value: c.init ?? '', placeholder: '—', 'aria-label': c.name + ' initiative',
          onchange: e => { c.init = e.target.value === '' ? null : parseInt(e.target.value, 10); Store.changed(); } }),
        h('button.ghost.small', { title: 'Roll D10 + Perception for this player', onclick: () => act(() => { c.init = Combat.die(10) + (c.stats.PER || 0); }) }, 'Roll'))),
      enemies.map(c => h('div.init-row', h('span', c.name), h('strong', String(Combat.initiativeOf(c))))),
      h('label.field', 'Ambush',
        h('select', { onchange: e => { ambush = e.target.value; } },
          h('option', { value: '', selected: ambush === '' }, 'No ambush'),
          h('option', { value: 'player', selected: ambush === 'player' }, 'Players ambush (surprise phase first)'),
          h('option', { value: 'enemy', selected: ambush === 'enemy' }, 'Enemies ambush (surprise phase first)'))),
      ambush ? h('p.muted.small', 'Ambushed characters can not use Defensive or Quick abilities in the surprise phase.') : null,
      h('p.muted.small', 'Drag tokens into position on the grid before you begin.'),
      h('button.primary', {
        onclick: () => {
          const missing = players.filter(c => c.init == null);
          if (missing.length && !confirm(missing.map(c => c.name).join(', ') + ' has no initiative yet. Count it as 0?')) return;
          act(() => {
            Combat.begin(cb, ambush || null);
            const a = activeCombatant(cb);
            if (a) selectedId = a.id;
          });
        }
      }, 'Begin combat'));
  }

  // ---------- Right column: the selected token ----------

  function drawRight(cb) {
    if (ending) return fill(els.right, endScreen(cb));
    const c = Combat.get(cb, selectedId);
    if (!c) return fill(els.right, h('p.muted', 'Select a token.'));
    const npc = c.kind === 'enemy' ? GameData.find(c.refId) : null;
    const isActive = activeCombatant(cb) === c;
    fill(els.right,
      h('div.detail-head',
        h('div', h('h2', c.name),
          h('div.muted.small', c.kind === 'player'
            ? 'Player · Level ' + c.level
            : c.role + ' · Level ' + c.level + ' · ' + c.size + ' · ' + c.tactics + ' tactics' + (c.turnsPerPhase > 1 ? ' · 2 turns per phase' : ''))),
        isActive ? h('span.tag.big', 'Their turn') : null),
      hpBlock(cb, c, npc),
      isActive && Object.keys(c.stacks).length ? h('p.reminder', 'Start of turn: roll recovery for each stack type below.') : null,
      npc ? enemyTurnBox(cb, c, npc, isActive) : null,
      attackBox(cb, c),
      statsBlock(cb, c, npc),
      stacksBlock(cb, c),
      conditionsBlock(cb, c),
      effectsBlock(cb, c),
      npc && !npc.humanoid ? abilitiesBlock(cb, c, npc) : null,
      notesBlock(c),
      h('div.row',
        Combat.FOOTPRINT[c.size] && Combat.FOOTPRINT[c.size][0] !== Combat.FOOTPRINT[c.size][1]
          ? h('button.ghost', { onclick: () => act(() => { c.rotated = !c.rotated; }) }, 'Turn token sideways') : null,
        h('button.ghost.danger', {
          onclick: () => {
            if (!confirm('Remove ' + c.name + ' from this combat?')) return;
            act(() => {
              const active = Combat.activeEntry(cb);
              cb.combatants = cb.combatants.filter(x => x !== c);
              cb.order = cb.order.filter(e => e.cid !== c.id);
              cb.turn = active && active.cid !== c.id ? cb.order.indexOf(active) : Math.min(cb.turn, cb.order.length);
              selectedId = null;
            });
          }
        }, 'Remove from combat')));
  }

  function hpBlock(cb, c, npc) {
    if (c.hp == null) {
      return h('div.section.hp-block',
        h('div.hp-big', 'No HP'),
        npc && npc.specialHp ? h('p.small', npc.specialHp) : null,
        h('label.check', h('input', { type: 'checkbox', checked: c.dead, onchange: e => act(() => {
          c.dead = e.target.checked;
          Combat.log(cb, c.name + (c.dead ? ' is defeated.' : ' is back in the fight.'));
        }) }), 'Defeated'));
    }
    const pct = c.maxHp ? Math.max(0, Math.min(1, c.hp / c.maxHp)) : 1;
    const amount = h('input.amount', { type: 'number', min: 0, placeholder: 'Amount', 'aria-label': 'Amount' });
    const val = () => Math.max(0, parseInt(amount.value, 10) || 0);
    let status = null;
    if (c.dead) {
      status = h('div.status.bad', c.kind === 'player' ? 'Dead.' : 'Defeated.',
        h('button.ghost.small', { onclick: () => act(() => {
          c.dead = false;
          if (c.kind === 'player' && c.hp <= 0) { c.deathClock = Combat.DEATH_CLOCK; }
          if (c.kind === 'enemy' && c.hp <= 0) c.hp = 1;
          Combat.log(cb, c.name + ' is back (GM).');
        }) }, 'Undo'));
    } else if (Combat.isDowned(c)) {
      status = h('div.status.bad',
        c.stabilized ? 'Downed and stabilized.' : 'Downed. Death clock: ' + c.deathClock + ' phase' + (c.deathClock === 1 ? '' : 's') + '.',
        h('p.small.muted', 'No actions. Each hit removes a phase. An adjacent ally can stabilize with a Standard action and a Knowledge check of 6+.'),
        h('div.row',
          !c.stabilized ? h('button', { onclick: () => act(() => Combat.stabilize(cb, c)) }, 'Stabilized') : null,
          !c.stabilized ? h('button.ghost', { onclick: () => act(() => {
            c.deathClock--;
            if (c.deathClock <= 0) { c.dead = true; Combat.log(cb, c.name + ' dies.'); }
          }) }, 'Remove a phase') : null));
    }
    return h('div.section.hp-block',
      h('div.hp-big', String(c.hp), h('span.muted', ' / ' + c.maxHp + ' HP')),
      h('div.hp-bar', h('span', { style: 'width:' + pct * 100 + '%', class: pct <= 0.25 ? 'low' : '' })),
      h('div.row',
        amount,
        h('button', { title: 'Take this much damage (no armor)', onclick: () => val() && act(() => { Combat.hurt(cb, c, val(), true); Combat.log(cb, c.name + ' takes ' + val() + ' damage.'); }) }, 'Damage'),
        h('button', { title: 'Heal this much', onclick: () => val() && act(() => { Combat.heal(cb, c, val()); Combat.log(cb, c.name + ' heals ' + val() + '.'); }) }, 'Heal'),
        h('button.ghost', { title: 'Set HP to this number', onclick: () => amount.value !== '' && act(() => {
          const before = c.hp;
          c.hp = parseInt(amount.value, 10);
          if (c.hp > 0 && before <= 0) Combat.heal(cb, c, 0);
          else if (c.hp <= 0 && before > 0) { c.hp = before; Combat.hurt(cb, c, before - parseInt(amount.value, 10), false); }
        }) }, 'Set')),
      status);
  }

  // ---- Damage from an attack (players' attacks, humanoids, anything typed in) ----

  function attackBox(cb, c) {
    if (c.hp == null) return null;
    const strikes = h('input', { placeholder: 'e.g. 7, 5', 'aria-label': 'Strike damage' });
    const ap = h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'AP' });
    const ignore = h('input', { type: 'checkbox' });
    const dodge = h('input', { type: 'checkbox' });
    const block = h('input', { type: 'number', min: 0, value: 0, 'aria-label': 'Block' });
    const resist = h('input', { type: 'number', min: 0, max: 75, value: c.resist || 0, 'aria-label': 'Resistance %' });
    const preview = h('span.preview');
    const opts = () => ({
      strikes: strikes.value.split(/[^0-9]+/).filter(Boolean).map(Number),
      ap: +ap.value || 0, ignoreArmor: ignore.checked, failedDodge: dodge.checked,
      block: +block.value || 0, resist: +resist.value || 0
    });
    const update = () => {
      const o = opts();
      if (!o.strikes.length) { preview.textContent = ''; return; }
      const r = Combat.computeDamage(c, o);
      preview.textContent = 'Takes ' + r.total + (o.strikes.length > 1 ? ' (' + r.perStrike.join(' + ') + ' after armor)' : '');
    };
    [strikes, ap, ignore, dodge, block, resist].forEach(el => el.addEventListener('input', update));
    return h('details.section', { open: c.kind === 'enemy' && (!activeCombatant(cb) || activeCombatant(cb).kind === 'player') },
      h('summary', h('h3', 'Hit with an attack')),
      h('p.muted.small', 'Type each strike\'s damage. Armor (' + (c.armor || 0) + ') comes off each strike, less any AP.'),
      h('div.attack-grid',
        h('label.field.wide', 'Strikes', strikes),
        h('label.field', 'AP', ap),
        h('label.field', 'Block', block),
        h('label.field', 'Resist %', resist),
        h('label.check.small', ignore, 'Ignores armor'),
        h('label.check.small', dodge, 'Failed dodge (×1.5)')),
      h('div.row',
        h('button.primary', {
          onclick: () => {
            const o = opts();
            if (!o.strikes.length) return toast('Type the damage of each strike first.', 'bad');
            act(() => {
              const r = Combat.applyAttack(cb, c, o);
              toast(c.name + ' takes ' + r.total + '.');
            });
          }
        }, 'Apply'),
        preview));
  }

  // ---- Enemy turn: tactics roll, ability, damage, targets ----

  function enemyTurnBox(cb, c, npc, isActive) {
    if (npc.humanoid) {
      return h('div.section.turn-box' + (isActive ? '.live' : ''),
        h('h3', 'Combat skill'),
        h('p.small', npc.combatSkill),
        h('p.muted.small', 'Resolve its attack from the Skill Guide, then use "Hit with an attack" on the target to apply the damage.'));
    }
    if (c.dead || cb.phase === 0) return null;
    const mine = plan && plan.cid === c.id ? plan : null;
    if (!mine) {
      return h('div.section.turn-box' + (isActive ? '.live' : ''),
        h('h3', 'Enemy turn'),
        h('div.row',
          h('button' + (isActive ? '.primary' : ''), { onclick: () => rollTactics(cb, c, npc) }, 'Roll tactics (D20)'),
          h('span.muted.small', 'or choose an ability below')));
    }
    const ch = mine.choice;
    const a = ch.ability;
    const parts = [h('h3', 'Enemy turn')];
    if (ch.d20) parts.push(h('p', 'D20: ', h('strong', String(ch.d20)), ' → ', h('span.rarity.rarity-' + ch.rolled.toLowerCase(), ch.rolled)));
    ch.notes.forEach(n => parts.push(h('p.small.muted', n)));
    if (!a) {
      parts.push(h('div.row', h('button', { onclick: () => { plan = null; refresh(); } }, 'OK')));
      return h('div.section.turn-box.live', parts);
    }
    parts.push(h('div.ability-pick',
      h('span.rarity.rarity-' + a.rarity.toLowerCase(), a.rarity), ' ', h('strong', a.name),
      a.attack && a.attack.area ? h('span.tag', 'area') : null,
      h('p.small', a.text)));
    if (!a.attack) {
      parts.push(h('div.row',
        h('button.primary', { onclick: () => finishAbility(cb, c, a, c.name + ' uses ' + a.name + '.') }, 'Done'),
        h('button.ghost', { onclick: () => rollTactics(cb, c, npc) }, 'Reroll'),
        h('button.ghost', { onclick: () => { plan = null; refresh(); } }, 'Cancel')));
      return h('div.section.turn-box.live', parts);
    }
    if (!mine.attack) {
      parts.push(h('div.row',
        h('button.primary', { onclick: () => { mine.attack = Combat.rollAttack(a.attack); refresh(); } }, 'Roll damage'),
        h('button.ghost', { onclick: () => rollTactics(cb, c, npc) }, 'Reroll'),
        h('button.ghost', { onclick: () => { plan = null; refresh(); } }, 'Cancel')));
      return h('div.section.turn-box.live', parts);
    }
    const atk = mine.attack;
    parts.push(h('ul.strikes', atk.strikes.map((s, i) => h('li',
      'Strike ' + (i + 1) + ': ', h('strong', String(s.value)),
      h('span.muted', ' (' + s.dice.join(' + ') + (s.flat ? ' + ' + s.flat : '') + ')' + (s.failed ? ' all 1s, misses' : ''))))));
    if (atk.ap || atk.ignoreArmor) parts.push(h('p.small.muted', atk.ignoreArmor ? 'Ignores armor.' : 'AP ' + atk.ap + '.'));
    // Targets: the other side, nearest first.
    const foes = cb.combatants.filter(t => t.kind !== c.kind && !t.dead && t.hp != null);
    const dist = t => (c.x != null && t.x != null) ? Combat.distance(c.x, c.y, t.x, t.y) : null;
    foes.sort((x, y) => (dist(x) ?? 999) - (dist(y) ?? 999));
    parts.push(h('p.small', 'Targets', atk.area ? ' (area: tick everyone it hits)' : '', ':'));
    parts.push(h('div.targets', foes.map(t => {
      const st = mine.targets[t.id] || (mine.targets[t.id] = { on: false, dodge: false, block: 0 });
      const r = Combat.computeDamage(t, { strikes: atk.strikes.map(s => s.value), ap: atk.ap, ignoreArmor: atk.ignoreArmor, failedDodge: st.dodge, block: st.block, resist: t.resist });
      return h('div.target-row' + (st.on ? '.on' : ''),
        h('label.check', h('input', { type: 'checkbox', checked: st.on, onchange: e => { st.on = e.target.checked; refresh(); } }),
          h('strong', t.name), dist(t) != null ? h('span.muted.small', ' ' + dist(t) + 'M') : null),
        h('label.check.small', h('input', { type: 'checkbox', checked: st.dodge, onchange: e => { st.dodge = e.target.checked; refresh(); } }), 'failed dodge'),
        h('label.small.inline', 'block', h('input.tiny-num', { type: 'number', min: 0, value: st.block, onchange: e => { st.block = +e.target.value || 0; refresh(); } })),
        h('span.preview', '→ ' + r.total));
    })));
    parts.push(h('div.row',
      h('button.primary', {
        onclick: () => {
          const chosen = foes.filter(t => mine.targets[t.id] && mine.targets[t.id].on);
          if (!chosen.length) return toast('Tick a target, or press "Missed" if the attack was dodged.', 'bad');
          act(() => {
            for (const t of chosen) {
              const st = mine.targets[t.id];
              Combat.applyAttack(cb, t, { strikes: atk.strikes.map(s => s.value), ap: atk.ap, ignoreArmor: atk.ignoreArmor, failedDodge: st.dodge, block: st.block, resist: t.resist }, c.name + "'s " + a.name);
            }
            Combat.markUsed(cb, c, a);
            plan = null;
          });
        }
      }, 'Apply damage'),
      h('button.ghost', { onclick: () => finishAbility(cb, c, a, c.name + "'s " + a.name + ' misses.') }, 'Missed'),
      h('button.ghost', { onclick: () => { mine.attack = Combat.rollAttack(a.attack); refresh(); } }, 'Reroll damage')));
    return h('div.section.turn-box.live', parts);
  }

  function rollTactics(cb, c, npc) {
    plan = { cid: c.id, choice: Combat.chooseAbility(cb, c, npc), attack: null, targets: {} };
    selectedId = c.id;
    refresh();
  }

  function finishAbility(cb, c, a, text) {
    act(() => {
      Combat.markUsed(cb, c, a);
      Combat.log(cb, text);
      plan = null;
    });
  }

  function abilitiesBlock(cb, c, npc) {
    return h('details.section', { open: false },
      h('summary', h('h3', 'Abilities')),
      h('ul.abilities', (npc.abilities || []).map(a => {
        const ready = Combat.isReady(cb, c, a);
        const r = c.cooldowns[a.name];
        return h('li' + (ready ? '' : '.cooling'),
          h('span.rarity.rarity-' + a.rarity.toLowerCase(), a.rarity), ' ', h('strong', a.name),
          !ready ? h('span.muted', r === 'combat' ? ' (used this combat)' : ' (ready in phase ' + r + ')') : null,
          ' – ', a.text, ' ',
          h('button.ghost.small', {
            onclick: () => { plan = { cid: c.id, choice: { ability: a, notes: ['Chosen by the GM.'] }, attack: null, targets: {} }; refresh(); }
          }, 'Use'),
          !ready ? h('button.ghost.small', { onclick: () => act(() => { delete c.cooldowns[a.name]; }) }, 'Reset') : null);
      })));
  }

  // ---- Stats, stacks, conditions, effects, notes ----

  function statsBlock(cb, c, npc) {
    const para = c.stacks.Paralysis ? c.stacks.Paralysis.n : 0;
    return h('div.section.stats',
      h('div.stat-chips',
        h('span.chip', 'Armor ', h('strong', String(c.armor || 0))),
        h('span.chip', 'Move ', h('strong', Combat.movement(c) + 'M')),
        cb.phase > 0 || c.kind === 'enemy' ? h('span.chip', 'Init ', h('strong', String(Combat.initiativeOf(c)))) : null,
        GameData.STATS.map(k => {
          const v = (c.stats[k] || 0) - ((k === 'STR' || k === 'AGI') ? para : 0);
          return h('span.chip', { title: GameData.STAT_NAMES[k] }, k + ' ', h('strong' + (v !== (c.stats[k] || 0) ? '.bad' : ''), String(v)));
        })),
      npc && npc.attributes && npc.attributes !== 'None' ? h('p.small', h('strong', 'Attributes: '), npc.attributes) : null);
  }

  function stacksBlock(cb, c) {
    const effects = Combat.stackEffects(c);
    return h('div.section',
      h('h3', 'Stacks'),
      h('div.stack-grid', Combat.STACK_TYPES.map(type => {
        const s = c.stacks[type];
        return h('div.stack' + (s ? '.has' : ''),
          h('span.stack-name' + (Combat.DAMAGING_STACKS.includes(type) ? '.dmg' : ''), type),
          h('button.icon.tiny', { onclick: () => act(() => Combat.addStacks(c, type, -1)) }, '−'),
          h('span.stack-n', s ? String(s.n) : '0'),
          h('button.icon.tiny', { onclick: () => act(() => Combat.addStacks(c, type, 1)) }, '+'),
          s ? h('button.ghost.small', {
            title: 'Roll a D4; needs ' + s.target + '+ (a 1 never recovers)',
            onclick: () => act(() => {
              const r = Combat.recover(c, type);
              const text = c.name + ' ' + type + ' recovery: rolled ' + r.roll + ' (needs ' + r.target + '+), ' +
                (r.success ? 'loses ' + r.lost + (r.left ? ', ' + r.left + ' left' : ', cleared') : 'no recovery') + '.';
              Combat.log(cb, text);
              toast(text, r.success ? 'good' : '');
            })
          }, 'Recover ' + s.target + '+') : null);
      })),
      effects.length ? h('ul.stack-effects', effects.map(e => h('li' + (e.severe ? '.bad' : ''), e.text,
        e.check ? h('button.ghost.small', {
          onclick: () => {
            const n = c.stacks[e.check].n;
            const d = Combat.die(10);
            toast(c.name + ': Knowledge check needs ' + (d + n) + '+ (1D10 = ' + d + ', + ' + n + ' stacks).');
          }
        }, 'Roll target') : null))) : null,
      h('p.muted.small', 'Bleed, Flame, Poison, and Acid deal 1D4 per stack at the end of the phase, ignoring armor.'));
  }

  function conditionsBlock(cb, c) {
    const custom = c.conditions.filter(x => !Combat.CONDITIONS.includes(x));
    const input = h('input', { placeholder: 'Other condition', 'aria-label': 'Other condition' });
    return h('div.section',
      h('h3', 'Conditions'),
      h('div.chips',
        Combat.CONDITIONS.concat(custom).map(name => {
          const on = c.conditions.includes(name);
          return h('button.toggle' + (on ? '.on' : ''), {
            onclick: () => act(() => {
              c.conditions = on ? c.conditions.filter(x => x !== name) : c.conditions.concat(name);
            })
          }, name);
        })),
      h('div.row', input, h('button.ghost', {
        onclick: () => input.value.trim() && act(() => { c.conditions.push(input.value.trim()); })
      }, 'Add')),
      c.conditions.includes('Disoriented') ? h('p.small.muted', 'Disoriented: drops one rarity on the tactics roll; with Basic tactics it can not use abilities.') : null);
  }

  function effectsBlock(cb, c) {
    const text = h('input', { placeholder: 'Effect (e.g. +2 armor from Shield Wall)', 'aria-label': 'Effect' });
    const phases = h('input', { type: 'number', min: 1, placeholder: 'Phases', 'aria-label': 'Phases' });
    return h('div.section',
      h('h3', 'Temporary effects'),
      c.effects.length ? h('ul.effects', c.effects.map((e, i) => h('li',
        e.text, h('span.muted', e.phases == null ? ' (until removed)' : ' (' + e.phases + ' phase' + (e.phases === 1 ? '' : 's') + ' left)'),
        h('button.icon.ghost.tiny', { title: 'Remove', onclick: () => act(() => { c.effects.splice(i, 1); }) }, '×')))) : null,
      h('div.row', text, phases, h('button.ghost', {
        onclick: () => text.value.trim() && act(() => {
          c.effects.push({ text: text.value.trim(), phases: phases.value ? Math.max(1, parseInt(phases.value, 10)) : null });
        })
      }, 'Add')),
      h('p.muted.small', 'Effects with a number of phases count down at the end of each phase.'));
  }

  function notesBlock(c) {
    return h('div.section',
      h('h3', 'Notes'),
      h('textarea', { rows: 2, value: c.notes || '', onchange: e => { c.notes = e.target.value; Store.changed(); } }));
  }

  // ---------- Ending combat ----------

  function endScreen(cb) {
    const s = Combat.xpSummary(cb);
    const xp = xpAll ? s.total : s.earned;
    const share = s.players.length ? xp / s.players.length : 0;
    return h('div.section',
      h('h2', 'End combat'),
      h('p', 'Defeated enemies are worth ', h('strong', fmt(s.earned, 2) + ' XP'), ' of ', fmt(s.total, 2), ' in this fight.'),
      h('label.check', h('input', { type: 'checkbox', checked: xpAll, onchange: e => { xpAll = e.target.checked; refresh(); } }),
        'Award XP for every enemy (for example, if the rest fled or surrendered)'),
      s.players.length ? h('ul', s.players.map(p => h('li', p.name + ': ', h('strong', '+' + fmt(share, 2) + ' XP')))) : h('p.muted', 'No players in this combat.'),
      h('p.muted.small', 'Ending combat clears all stacks, conditions, effects, cooldowns, and token positions.'),
      h('div.row',
        h('button.primary', {
          onclick: () => {
            for (const pc of s.players) {
              const p = S().players.find(x => x.id === pc.refId);
              if (p) p.xp = Math.round(((p.xp || 0) + share) * 100) / 100;
            }
            finishCombat(s.players.length ? 'Combat ended. Each player gains ' + fmt(share, 2) + ' XP.' : 'Combat ended.');
          }
        }, 'Award XP and end'),
        h('button.ghost', { onclick: () => confirm('End combat without giving any XP?') && finishCombat('Combat ended without XP.') }, 'End without XP'),
        h('button.ghost', { onclick: () => { ending = false; refresh(); } }, 'Back to the fight')));
  }

  function finishCombat(message) {
    S().combat = null;
    ending = false; plan = null; report = null; selectedId = null;
    Store.changed();
    toast(message, 'good');
    render(root);
  }

  App.register('combat', render);
})();
