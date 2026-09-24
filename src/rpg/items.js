import { identifyItem, reinforcementMultiplier } from '../persistence/model.js';
// Item database and random loot generation.
// Damage is expressed in "power": a level-1 common weapon averages ~6 per hit.

export const RARITY = [
  { id: 'common', name: 'Common', color: '#e8e2d0', hex: 0xe8e2d0, affixes: 0, mult: 1.0, weight: 60 },
  { id: 'uncommon', name: 'Uncommon', color: '#6fdc5a', hex: 0x6fdc5a, affixes: 1, mult: 1.1, weight: 26 },
  { id: 'rare', name: 'Rare', color: '#4aa8ff', hex: 0x4aa8ff, affixes: 2, mult: 1.25, weight: 10 },
  { id: 'epic', name: 'Epic', color: '#c46bff', hex: 0xc46bff, affixes: 3, mult: 1.4, weight: 3.4 },
  { id: 'legendary', name: 'Legendary', color: '#ff9a2a', hex: 0xff9a2a, affixes: 3, mult: 1.6, weight: 0.6 },
];

export const unitAt = lvl => 6 * (1 + 0.3 * (Math.max(1, lvl) - 1));

// ---------------------------------------------------------------- weapon bases
// kind: katana | bow | staff | wand.  spd: attacks-per-second multiplier. dmg: relative damage.
export const WEAPONS = [
  // Samurai
  { id: 'shinai', name: 'Bamboo Shinai', cls: 'samurai', kind: 'katana', lvl: 1, dmg: 0.85, spd: 1.15, reach: 1.2, col: 0xd8c070 },
  { id: 'rustkatana', name: 'Rusted Katana', cls: 'samurai', kind: 'katana', lvl: 1, dmg: 1.0, spd: 1.0, reach: 1.25, col: 0xb89a80 },
  { id: 'wakizashi', name: 'Wakizashi', cls: 'samurai', kind: 'katana', lvl: 2, dmg: 0.8, spd: 1.35, reach: 1.1, col: 0xdfe8f0 },
  { id: 'tachi', name: 'Tachi', cls: 'samurai', kind: 'katana', lvl: 3, dmg: 1.05, spd: 1.0, reach: 1.3, col: 0xe6eef6 },
  { id: 'uchigatana', name: 'Uchigatana', cls: 'samurai', kind: 'katana', lvl: 5, dmg: 1.1, spd: 1.05, reach: 1.3, col: 0xf0f6ff },
  { id: 'nodachi', name: 'Nodachi', cls: 'samurai', kind: 'katana', lvl: 6, dmg: 1.45, spd: 0.75, reach: 1.6, col: 0xcfd8e8, big: true },
  { id: 'moonkatana', name: 'Moonlit Katana', cls: 'samurai', kind: 'katana', lvl: 8, dmg: 1.15, spd: 1.1, reach: 1.3, col: 0xb8d8ff },
  { id: 'onicleaver', name: 'Oni Cleaver', cls: 'samurai', kind: 'katana', lvl: 10, dmg: 1.6, spd: 0.7, reach: 1.55, col: 0xc84a4a, big: true },
  { id: 'dragontachi', name: 'Dragonbone Tachi', cls: 'samurai', kind: 'katana', lvl: 13, dmg: 1.25, spd: 1.05, reach: 1.35, col: 0xf0e0b0 },
  { id: 'stormedge', name: 'Stormedge', cls: 'samurai', kind: 'katana', lvl: 16, dmg: 1.2, spd: 1.2, reach: 1.3, col: 0x9ad8ff },
  // Archer
  { id: 'twigbow', name: 'Twig Bow', cls: 'archer', kind: 'bow', lvl: 1, dmg: 0.85, spd: 1.15, col: 0x9a7a4a },
  { id: 'huntbow', name: 'Hunting Bow', cls: 'archer', kind: 'bow', lvl: 1, dmg: 1.0, spd: 1.0, col: 0x7a5a3a },
  { id: 'recurve', name: 'Recurve Bow', cls: 'archer', kind: 'bow', lvl: 3, dmg: 1.05, spd: 1.1, col: 0x8a4a2a },
  { id: 'longbow', name: 'Longbow', cls: 'archer', kind: 'bow', lvl: 5, dmg: 1.4, spd: 0.75, col: 0x6a4a2a, big: true },
  { id: 'composite', name: 'Composite Bow', cls: 'archer', kind: 'bow', lvl: 6, dmg: 1.15, spd: 1.05, col: 0xa06a3a },
  { id: 'reedbow', name: 'Reedwhistle Bow', cls: 'archer', kind: 'bow', lvl: 8, dmg: 0.95, spd: 1.4, col: 0x8ab04a },
  { id: 'elmwarbow', name: 'Elmwood Warbow', cls: 'archer', kind: 'bow', lvl: 10, dmg: 1.55, spd: 0.75, col: 0x5a3a1a, big: true },
  { id: 'galebow', name: 'Galestring', cls: 'archer', kind: 'bow', lvl: 13, dmg: 1.15, spd: 1.25, col: 0x7ad8ff },
  { id: 'sunbow', name: 'Sunshot Recurve', cls: 'archer', kind: 'bow', lvl: 16, dmg: 1.3, spd: 1.1, col: 0xffd25e },
  // Witch / Wizard
  { id: 'twigwand', name: 'Twig Wand', cls: 'witch', kind: 'wand', lvl: 1, dmg: 0.85, spd: 1.2, col: 0x9a7a4a, orb: 0xc89aff },
  { id: 'acornstaff', name: 'Acorn Staff', cls: 'witch', kind: 'staff', lvl: 1, dmg: 1.0, spd: 1.0, col: 0x7a5a3a, orb: 0x9a6f3a },
  { id: 'crookstaff', name: 'Crooked Staff', cls: 'witch', kind: 'staff', lvl: 3, dmg: 1.1, spd: 0.95, col: 0x5a4a3a, orb: 0x7fd36a },
  { id: 'shroomwand', name: 'Toadstool Wand', cls: 'witch', kind: 'wand', lvl: 4, dmg: 0.9, spd: 1.35, col: 0xf0e6d0, orb: 0xe05a48 },
  { id: 'candlestaff', name: 'Candle Staff', cls: 'witch', kind: 'staff', lvl: 6, dmg: 1.2, spd: 0.95, col: 0x6a4a3a, orb: 0xffb347 },
  { id: 'owlstaff', name: 'Owlwood Staff', cls: 'witch', kind: 'staff', lvl: 8, dmg: 1.25, spd: 1.0, col: 0x8a6a4a, orb: 0xfff3b0 },
  { id: 'hexwand', name: 'Hexbone Wand', cls: 'witch', kind: 'wand', lvl: 10, dmg: 1.05, spd: 1.35, col: 0xe8e0d0, orb: 0x8b5cf6 },
  { id: 'frostrod', name: 'Rimefrost Rod', cls: 'witch', kind: 'staff', lvl: 13, dmg: 1.3, spd: 1.0, col: 0xaad8ff, orb: 0xdff4ff },
  { id: 'starstaff', name: 'Starfall Staff', cls: 'witch', kind: 'staff', lvl: 16, dmg: 1.4, spd: 0.95, col: 0x3a3a6a, orb: 0xfff3b0 },
];
// ---------------------------------------------------------------- armour bases
export const ARMORS = [
  { id: 'acorncap', name: 'Acorn Cap', slot: 'helm', lvl: 1, armor: 3, hp: 4 },
  { id: 'leafhood', name: 'Leaf Hood', slot: 'helm', lvl: 2, armor: 2, hp: 8 },
  { id: 'kabuto', name: 'Lacquered Kabuto', slot: 'helm', lvl: 5, armor: 7, hp: 6 },
  { id: 'witchbrim', name: 'Witch\'s Brim', slot: 'helm', lvl: 5, armor: 3, hp: 10, res: 10 },
  { id: 'rangercowl', name: 'Ranger\'s Cowl', slot: 'helm', lvl: 8, armor: 5, hp: 12 },
  { id: 'bellhelm', name: 'Bellbronze Helm', slot: 'helm', lvl: 12, armor: 12, hp: 14 },
  { id: 'mosstunic', name: 'Moss Tunic', slot: 'armor', lvl: 1, armor: 5, hp: 8 },
  { id: 'gi', name: 'Travelling Gi', slot: 'armor', lvl: 2, armor: 6, hp: 10 },
  { id: 'jerkin', name: 'Leather Jerkin', slot: 'armor', lvl: 4, armor: 9, hp: 12 },
  { id: 'robe', name: 'Starlit Robe', slot: 'armor', lvl: 5, armor: 5, hp: 16, res: 12 },
  { id: 'scalemail', name: 'Beetle-Scale Mail', slot: 'armor', lvl: 8, armor: 16, hp: 14 },
  { id: 'oyoroi', name: 'O-yoroi Plate', slot: 'armor', lvl: 12, armor: 24, hp: 20 },
  { id: 'bellcharm', name: 'Little Bell Charm', slot: 'charm', lvl: 1, armor: 0, hp: 5 },
  { id: 'rabbitfoot', name: 'Clover Token', slot: 'charm', lvl: 3, armor: 0, hp: 5, mf: 10 },
  { id: 'emberlocket', name: 'Ember Locket', slot: 'charm', lvl: 6, armor: 2, hp: 10 },
  { id: 'tidepearl', name: 'Tide Pearl', slot: 'charm', lvl: 9, armor: 3, hp: 15 },
];

// ---------------------------------------------------------------- affixes
// v: value per item level (scaled) ; fmt: display
export const AFFIXES = {
  dmgPct: { name: 'Damage', pre: ['Keen', 'Brutal', 'Savage'], base: 6, per: 0.6, pct: true, slots: ['weapon', 'charm'] },
  crit: { name: 'Crit Chance', pre: ['Sharp', 'Precise', 'Deadly'], base: 3, per: 0.2, pct: true },
  critDmg: { name: 'Crit Damage', pre: ['Cruel', 'Vicious', 'Merciless'], base: 12, per: 1.2, pct: true, slots: ['weapon', 'helm', 'charm'] },
  atkSpd: { name: 'Attack Speed', pre: ['Swift', 'Quick', 'Frenzied'], base: 5, per: 0.4, pct: true, slots: ['weapon', 'charm'] },
  hp: { name: 'Max Health', pre: ['Hale', 'Stout', 'Mighty'], base: 8, per: 3, slots: ['helm', 'armor', 'charm'] },
  armor: { name: 'Armour', pre: ['Sturdy', 'Warded', 'Bastion'], base: 4, per: 1.2, slots: ['helm', 'armor'] },
  lifesteal: { name: 'Life Steal', pre: ['Vampiric', 'Leeching'], base: 1.5, per: 0.1, pct: true, slots: ['weapon', 'charm'] },
  regen: { name: 'Health / sec', pre: ['Mending', 'Verdant'], base: 0.6, per: 0.15, slots: ['helm', 'armor', 'charm'] },
  resRegen: { name: 'Energy Regen', pre: ['Focused', 'Serene'], base: 8, per: 0.6, pct: true },
  moveSpd: { name: 'Move Speed', pre: ['Fleet', 'Windborne'], base: 4, per: 0.2, pct: true, slots: ['armor', 'charm', 'helm'] },
  cdr: { name: 'Cooldown Reduction', pre: ['Timeless', 'Ringing'], base: 4, per: 0.25, pct: true, slots: ['helm', 'charm', 'weapon'] },
  abilityDmg: { name: 'Ability Damage', pre: ['Arcane', 'Empowered'], base: 8, per: 0.8, pct: true },
  mf: { name: 'Magic Find', pre: ['Lucky', 'Fortunate'], base: 8, per: 0.8, pct: true },
  xpPct: { name: 'Experience', pre: ['Studious', 'Wise'], base: 5, per: 0.4, pct: true, slots: ['helm', 'charm'] },
  burn: { name: 'Chance to Burn', pre: ['Blazing', 'Smouldering'], base: 8, per: 0.4, pct: true, slots: ['weapon'] },
  chill: { name: 'Chance to Chill', pre: ['Frosted', 'Rimed'], base: 8, per: 0.4, pct: true, slots: ['weapon'] },
  shock: { name: 'Chance to Shock', pre: ['Thundering', 'Crackling'], base: 7, per: 0.35, pct: true, slots: ['weapon'] },
};
const SUFFIX = ['of the Hush', 'of Embers', 'of the Hollow', 'of Tides', 'of the Bellwrights', 'of Thorns', 'of Dawn', 'of Whispers', 'of the Owl', 'of Mirrow', 'of Cinders', 'of the Gale'];

// ---------------------------------------------------------------- legendaries
export const LEGENDARIES = [
  { id: 'rootcleaver', base: 'onicleaver', name: 'Rootcleaver', lvl: 4, u: 'rootcleaver', text: 'Hits have a 25% chance to burst thorns from the ground around the target.' },
  { id: 'crescent', base: 'moonkatana', name: 'Crimson Crescent', lvl: 3, u: 'crescent', text: 'Every third combo strike fires a crescent wave.' },
  { id: 'silentdawn', base: 'uchigatana', name: 'Silent Dawn', lvl: 6, u: 'silentdawn', text: 'Critical hits refund 40% of Iaido Dash\'s cooldown.' },
  { id: 'onigrin', base: 'tachi', name: 'Oni\'s Grin', lvl: 2, u: 'onigrin', text: '+40% damage and 6% life steal while below half health.' },
  { id: 'windwhisper', base: 'galebow', name: 'Windwhisper', lvl: 5, u: 'windwhisper', text: 'Arrows pierce everything and shove enemies back.' },
  { id: 'sunshot', base: 'sunbow', name: 'Sunshot', lvl: 4, u: 'sunshot', text: 'Arrows explode in fire on impact.' },
  { id: 'thornquill', base: 'recurve', name: 'Thornquill', lvl: 2, u: 'thornquill', text: 'Arrows split into three thorns on hit.' },
  { id: 'huntermoon', base: 'longbow', name: 'Hunter\'s Moon', lvl: 6, u: 'huntermoon', text: '+25% crit chance. Crits mark targets to take 25% more damage.' },
  { id: 'hexbloom', base: 'hexwand', name: 'Hexbloom', lvl: 4, u: 'hexbloom', text: 'Enemies you kill burst in a hex blast.' },
  { id: 'candlewick', base: 'candlestaff', name: 'Candlewick Scepter', lvl: 3, u: 'candlewick', text: 'Bolts always burn. Burning enemies take 20% more damage.' },
  { id: 'owlhollow', base: 'owlstaff', name: 'Owl of the Hollow', lvl: 6, u: 'owlhollow', text: 'Your Hex Familiar lasts until it is recast and fires twice as fast.' },
  { id: 'starfall', base: 'starstaff', name: 'Starfall', lvl: 7, u: 'starfall', text: 'Charged bolts call down a falling star.' },
  { id: 'firstchime', base: 'bellcharm', name: 'The First Chime', lvl: 5, u: 'firstchime', text: '+20% damage. Bell Surge fills twice as fast.' },
  { id: 'pipmagnet', base: 'rabbitfoot', name: 'Pip Magnet', lvl: 2, u: 'pipmagnet', text: '+80% Magic Find. Pips fly to you from further away.' },
  { id: 'mossheart', base: 'mosstunic', name: 'Mossheart Tunic', lvl: 4, u: 'mossheart', text: 'Regenerate 2% of your health each second out of combat… and 0.5% in it.' },
];

let uid = 1;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function rollRarity(mf = 0, floor = 0, bonus = 0) {
  // bonus shifts weight toward higher tiers; mf is magic find %
  const k = 1 + mf / 100;
  const w = RARITY.map((r, i) => i < floor ? 0 : r.weight * (i >= 2 ? k * (1 + bonus * i) : 1));
  let t = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { if ((t -= w[i]) <= 0) return i; }
  return 0;
}

export function genItem({ level = 1, rarity = null, slot = null, cls = null, mf = 0, floor = 0, bonus = 0 } = {}) {
  const r = rarity ?? rollRarity(mf, floor, bonus);
  const ilvl = Math.max(1, Math.round(level + rnd(-1, 1)));
  // Legendary: pick a hand-made unique that fits
  if (r === 4) {
    const slotOf = b => b.kind ? 'weapon' : b.slot;
    const cands = LEGENDARIES.filter(l => { const b = baseById(l.base); return l.lvl <= ilvl + 2 && (!slot || slotOf(b) === slot) && (!cls || !b.cls || b.cls === cls); });
    if (cands.length) { const L = pick(cands); return makeItem(baseById(L.base), 4, ilvl, L); }
  }
  let pool;
  if (slot === 'weapon' || (!slot && Math.random() < 0.55)) pool = WEAPONS.filter(w => (!cls || w.cls === cls) && w.lvl <= ilvl + 1);
  else pool = ARMORS.filter(a => (!slot || a.slot === slot) && a.lvl <= ilvl + 1);
  if (!pool.length) pool = WEAPONS.filter(w => w.lvl <= 1);
  // favour bases near the item level
  pool.sort((a, b) => b.lvl - a.lvl);
  const base = Math.random() < 0.6 ? pool[Math.floor(Math.random() * Math.min(3, pool.length))] : pick(pool);
  return makeItem(base, Math.min(r, 3), ilvl);
}
export function baseById(id) { return WEAPONS.find(w => w.id === id) || ARMORS.find(a => a.id === id); }

function makeItem(base, r, ilvl, legend = null) {
  const R = RARITY[r];
  const isW = !!base.kind;
  const it = { uid: uid++ + '-' + Math.floor(Math.random() * 1e6), base: base.id, slot: isW ? 'weapon' : base.slot, cls: base.cls || null, kind: base.kind || null, r, ilvl, stats: {}, affixes: [] };
  if (isW) {
    const avg = unitAt(ilvl) * base.dmg * R.mult * rnd(0.95, 1.08);
    it.min = Math.max(1, Math.round(avg * 0.8)); it.max = Math.max(it.min + 1, Math.round(avg * 1.2));
    it.spd = base.spd;
  } else {
    const s = (1 + 0.18 * (ilvl - 1)) * R.mult;
    if (base.armor) it.stats.armor = Math.round(base.armor * s);
    if (base.hp) it.stats.hp = Math.round(base.hp * s);
    if (base.res) it.stats.resRegen = Math.round(base.res * R.mult);
    if (base.mf) it.stats.mf = base.mf;
  }
  const slotKey = it.slot;
  const pool = Object.keys(AFFIXES).filter(k => !AFFIXES[k].slots || AFFIXES[k].slots.includes(slotKey));
  const n = R.affixes + (r >= 3 && Math.random() < 0.3 ? 1 : 0);
  const chosen = [];
  while (chosen.length < n && pool.length) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const A = AFFIXES[k];
    let v = (A.base + A.per * ilvl) * rnd(0.7, 1.15) * (1 + r * 0.08);
    v = A.base < 2 ? Math.round(v * 10) / 10 : Math.round(v);
    it.stats[k] = (it.stats[k] || 0) + v;
    chosen.push(k);
  }
  it.affixes = chosen;
  if (legend) { it.name = legend.name; it.unique = legend.u; it.utext = legend.text; if (legend.u === 'firstchime') it.stats.dmgPct = (it.stats.dmgPct || 0) + 20; if (legend.u === 'pipmagnet') it.stats.mf = (it.stats.mf || 0) + 80; if (legend.u === 'huntermoon') it.stats.crit = (it.stats.crit || 0) + 25; }
  else {
    let name = base.name;
    if (chosen.length) name = AFFIXES[chosen[0]].pre[Math.min(AFFIXES[chosen[0]].pre.length - 1, Math.floor(r / 1.5))] + ' ' + name;
    if (r >= 2) name += ' ' + pick(SUFFIX);
    it.name = name;
  }
  it.value = Math.round((4 + ilvl * 3) * [1, 2, 5, 12, 30][r]);
  return identifyItem(it);
}

export const SLOT_ICON = { katana: '🗡️', bow: '🏹', staff: '🪄', wand: '✨', helm: '⛑️', armor: '🥋', charm: '🔔' };
export function itemIcon(it) { return SLOT_ICON[it.kind || it.slot] || '?'; }

// A single-number score for "is this an upgrade?" arrows
export function itemPower(it) {
  if (!it) return 0;
  const s = it.stats;
  let p = 0;
  if (it.slot === 'weapon') p += (it.min + it.max) / 2 * reinforcementMultiplier(it) * (it.spd || 1) * 4;
  p += (s.armor || 0) * 1.5 + (s.hp || 0) * 0.8 + (s.dmgPct || 0) * 2 + (s.crit || 0) * 2.5 + (s.critDmg || 0) * 0.8 + (s.atkSpd || 0) * 2 + (s.lifesteal || 0) * 4 + (s.regen || 0) * 5 + (s.resRegen || 0) + (s.moveSpd || 0) * 1.5 + (s.cdr || 0) * 2 + (s.abilityDmg || 0) * 1.2 + (s.mf || 0) * 0.5 + (s.xpPct || 0) * 0.5 + ((s.burn || 0) + (s.chill || 0) + (s.shock || 0)) * 0.8;
  if (it.unique) p += 40 + it.ilvl * 3;
  return Math.round(p);
}

export function statLine(k, v) {
  const A = AFFIXES[k];
  if (!A) return '';
  return `+${v}${A.pct ? '%' : ''} ${A.name}`;
}

export function starterWeapon(cls) {
  const b = { samurai: 'rustkatana', archer: 'huntbow', witch: 'acornstaff' }[cls];
  return makeItem(baseById(b), 0, 1);
}
