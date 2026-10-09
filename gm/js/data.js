// Creature lookup: the built-in list from npc-data.js plus the GM's custom creatures.
(function () {
  const builtIn = window.PRIMORDIUM_NPCS || [];

  const all = () => builtIn.concat(Store.state.customNpcs);
  const find = name => all().find(n => n.name === name) || null;

  const ROLES = ['Minion', 'Standard', 'Elite', 'Boss'];
  const SIZES = ['Tiny', 'Small', 'Average', 'Large', 'Huge', 'Massive'];
  const TACTICS = ['Basic', 'Fair', 'Good', 'Great', 'Excellent', 'Mythic'];
  const STATS = ['STR', 'AGI', 'KNO', 'SPD', 'PER', 'SPE'];
  const STAT_NAMES = { STR: 'Strength', AGI: 'Agility', KNO: 'Knowledge', SPD: 'Speed', PER: 'Perception', SPE: 'Speech' };

  function families() {
    return [...new Set(all().map(n => n.family))].sort();
  }

  window.GameData = { all, find, families, ROLES, SIZES, TACTICS, STATS, STAT_NAMES };
})();
