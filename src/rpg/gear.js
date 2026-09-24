// Pass 5 gear registry: new armour slots, three armour sets, build accessories and named
// weapons. Pure data (no imports) so items.js, the hero models, the UI and dev tools can all
// discover it. Stats here are BASE values; items.js scales them by item level and rarity.

// ------------------------------------------------------------------ weapon families
// How a weapon behaves in your hands is decided by what it is, never by your class.
export const FAMILY = {
  blade: { name: 'Fast blade', melee: true },
  heavy: { name: 'Heavy blade', melee: true },
  bow: { name: 'Bow', melee: false },
  staff: { name: 'Staff', melee: false },
  wand: { name: 'Wand', melee: false },
  oversized: { name: 'Oversized', melee: true },
};
export function weaponFamily(w) {
  if (!w) return null;
  if (w.kind === 'oversized') return 'oversized';
  if (w.kind === 'katana') return w.big || HEAVY_BASES.has(w.base) ? 'heavy' : 'blade';
  return w.kind; // bow | staff | wand
}
export const HEAVY_BASES = new Set(['nodachi', 'onicleaver', 'bellclapper']);
export const CLASS_FAMILIES = { samurai: ['blade', 'heavy'], archer: ['bow'], witch: ['staff', 'wand'] };
// Off-class weapons work fully, at reduced scaling and without the class specialist perks.
export const OFFCLASS_SCALING = 0.8;

// ------------------------------------------------------------------ new armour bases
// slot: helm | armor | arms | legs | boots | charm (necklace) | ring
export const NEW_ARMORS = [
  { id: 'leafwraps', name: 'Leaf Wraps', slot: 'arms', lvl: 1, armor: 2, hp: 3 },
  { id: 'beetlebracers', name: 'Beetle Bracers', slot: 'arms', lvl: 5, armor: 5, hp: 4 },
  { id: 'mossleggings', name: 'Moss Leggings', slot: 'legs', lvl: 1, armor: 3, hp: 4 },
  { id: 'hakama', name: 'Travelling Hakama', slot: 'legs', lvl: 4, armor: 5, hp: 6 },
  { id: 'barkboots', name: 'Bark Boots', slot: 'boots', lvl: 1, armor: 2, hp: 3 },
  { id: 'wickboots', name: 'Wick-soled Boots', slot: 'boots', lvl: 6, armor: 4, hp: 5 },
  { id: 'copperring', name: 'Copper Wire Ring', slot: 'ring', lvl: 1, armor: 0, hp: 3 },
  { id: 'silverring', name: 'Thimble-silver Ring', slot: 'ring', lvl: 6, armor: 0, hp: 5 },
  // --- Bellwarden: tarnished bell-metal over teal cloth. Heavy / resonance.
  { id: 'bw_helm', name: 'Bellwarden Clapper-Helm', slot: 'helm', lvl: 7, armor: 10, hp: 10, set: 'bellwarden' },
  { id: 'bw_chest', name: 'Bellwarden Cuirass', slot: 'armor', lvl: 7, armor: 20, hp: 16, set: 'bellwarden' },
  { id: 'bw_arms', name: 'Bellwarden Gauntlets', slot: 'arms', lvl: 7, armor: 7, hp: 6, set: 'bellwarden' },
  { id: 'bw_legs', name: 'Bellwarden Tassets', slot: 'legs', lvl: 7, armor: 8, hp: 8, set: 'bellwarden' },
  { id: 'bw_boots', name: 'Bellwarden Sabatons', slot: 'boots', lvl: 7, armor: 6, hp: 5, set: 'bellwarden' },
  // --- Thornstalker: leaf, thorn and beetle shell. Mobility / crit.
  { id: 'ts_helm', name: 'Thornstalker Mantis Hood', slot: 'helm', lvl: 7, armor: 5, hp: 8, set: 'thornstalker', fixed: { crit: 2 } },
  { id: 'ts_chest', name: 'Thornstalker Shell Vest', slot: 'armor', lvl: 7, armor: 10, hp: 12, set: 'thornstalker', fixed: { crit: 3 } },
  { id: 'ts_arms', name: 'Thornstalker Barbed Wraps', slot: 'arms', lvl: 7, armor: 3, hp: 4, set: 'thornstalker', fixed: { atkSpd: 4 } },
  { id: 'ts_legs', name: 'Thornstalker Leafskirt', slot: 'legs', lvl: 7, armor: 4, hp: 6, set: 'thornstalker', fixed: { moveSpd: 4 } },
  { id: 'ts_boots', name: 'Thornstalker Cricket Boots', slot: 'boots', lvl: 7, armor: 3, hp: 4, set: 'thornstalker', fixed: { moveSpd: 5 } },
  // --- Cinderwoven: dark fabric, ember stitching and ceramic plates. Elemental / spell.
  { id: 'cw_helm', name: 'Cinderwoven Porcelain Mask', slot: 'helm', lvl: 7, armor: 4, hp: 10, set: 'cinderwoven', fixed: { abilityDmg: 4 } },
  { id: 'cw_chest', name: 'Cinderwoven Robe', slot: 'armor', lvl: 7, armor: 7, hp: 16, set: 'cinderwoven', res: 10 },
  { id: 'cw_arms', name: 'Cinderwoven Kiln Gloves', slot: 'arms', lvl: 7, armor: 3, hp: 6, set: 'cinderwoven', fixed: { abilityDmg: 5 } },
  { id: 'cw_legs', name: 'Cinderwoven Stitched Skirts', slot: 'legs', lvl: 7, armor: 4, hp: 8, set: 'cinderwoven', fixed: { cdr: 3 } },
  { id: 'cw_boots', name: 'Cinderwoven Ash Slippers', slot: 'boots', lvl: 7, armor: 2, hp: 6, set: 'cinderwoven', fixed: { burn: 5 } },
  // --- accessory bases (build accessories below use these)
  { id: 'threadring', name: 'Thread Ring', slot: 'ring', lvl: 3, armor: 0, hp: 4 },
  { id: 'shellring', name: 'Shell Ring', slot: 'ring', lvl: 5, armor: 1, hp: 4 },
  { id: 'porcelainpendant', name: 'Porcelain Pendant', slot: 'charm', lvl: 4, armor: 1, hp: 6 },
  { id: 'clapperchain', name: 'Clapper on a Chain', slot: 'charm', lvl: 4, armor: 0, hp: 6 },
];

export const SETS = {
  bellwarden: {
    name: 'Bellwarden', color: '#e0b860', blurb: 'Bell-metal armour of the old toll-keepers.',
    bonus2: { text: 'Heavy blows deal +15% damage and stagger longer.', stats: {} },
    bonus5: { text: 'Every fourth heavy blow rings a resonance shockwave (×1.5 damage). Take 10% less damage.', stats: {} },
  },
  thornstalker: {
    name: 'Thornstalker', color: '#7fd36a', blurb: 'Leaf, thorn and beetle shell: made to never stand still.',
    bonus2: { text: '+8% critical chance and +6% move speed.', stats: { crit: 8, moveSpd: 6 } },
    bonus5: { text: 'Critical hits give Thornstep for 2 s: +25% move speed, and your next hit is a guaranteed crit (once per 2 s).', stats: {} },
  },
  cinderwoven: {
    name: 'Cinderwoven', color: '#ff8a2a', blurb: 'Kiln-fired porcelain sewn into ember-stitched cloth.',
    bonus2: { text: '+12% ability damage.', stats: { abilityDmg: 12 } },
    bonus5: { text: 'Abilities set foes alight; burning foes hit by an ability pulse fire around them (once per second each).', stats: {} },
  },
};
export const SET_PIECES = s => NEW_ARMORS.filter(a => a.set === s).map(a => a.id);

// ------------------------------------------------------------------ build accessories
// Named items with a mechanical effect ('unique' ids read by gameplay code).
export const ACCESSORIES = [
  { id: 'stillwater', base: 'copperring', name: 'Stillwater Ring', lvl: 3, r: 3, text: 'After a perfect dodge, your next charged attack within 3 s charges instantly and deals +40% damage.' },
  { id: 'shellbreaker', base: 'porcelainpendant', name: 'Cracked Porcelain Pendant', lvl: 4, r: 3, text: 'Breaking armour (shells, beetles, guards) restores 30 of your class resource.' },
  { id: 'briarbond', base: 'threadring', name: 'Briarbond Loop', lvl: 4, r: 3, text: 'Tethered foes share 20% more damage. Rooted foes take 15% more damage.' },
  { id: 'rimeshard', base: 'shellring', name: 'Rimeshard Band', lvl: 5, r: 3, text: 'Shattering a frozen foe takes 1.5 s off all ability cooldowns.' },
  { id: 'echoclapper', base: 'clapperchain', name: 'Echo Clapper', lvl: 5, r: 3, text: 'Echo attacks deal +20% damage and stagger even armoured foes.' },
  { id: 'quickthread', base: 'threadring', name: 'Quickthread Ring', lvl: 6, r: 3, text: 'Each critical hit grants +5% move speed for 3 s, stacking five times.' },
  { id: 'toadsignet', base: 'silverring', name: 'Crowned Signet', lvl: 8, r: 4, text: '+15% damage to wet foes. Lightning and heavy blows splash water, soaking foes nearby.' },
  { id: 'tuningfork', base: 'clapperchain', name: "Bellmaker's Tuning Fork", lvl: 6, r: 4, text: 'Bell Surge also resets every ability cooldown. Bell Surge fills 25% slower.' },
];

// ------------------------------------------------------------------ named weapons
// Each is its own base with its own model (hero.js) and a signature behaviour ('unique').
// src: where it comes from. weight: relative chance when a Legendary weapon is rolled.
export const NAMED_WEAPONS = [
  { id: 'seamripper', name: 'Seam Ripper', cls: 'samurai', kind: 'katana', lvl: 6, dmg: 1.25, spd: 1.2, reach: 1.3, col: 0xd8e0e8, src: 'The Seamkeeper', weight: 0, text: 'Cuts thread barriers. Attacks against rooted or tethered foes are guaranteed crits.' },
  { id: 'wickblade', name: 'Wickblade', cls: 'samurai', kind: 'katana', lvl: 4, dmg: 1.1, spd: 1.1, reach: 1.25, col: 0xf0e0c0, src: 'Legendary drop', weight: 1, text: 'Every hit burns. The third combo strike looses a flame arc.' },
  { id: 'bellclapper', name: 'The Clapper', cls: 'samurai', kind: 'katana', lvl: 7, dmg: 1.7, spd: 0.7, reach: 1.6, col: 0xc89a3a, big: true, src: 'Legendary drop', weight: 1, text: 'Charged spin slashes toll a bell: a shockwave that staggers everything nearby.' },
  { id: 'hatpin', name: "Aunt Marrow's Hatpin", cls: 'samurai', kind: 'katana', lvl: 3, dmg: 0.9, spd: 1.45, reach: 1.45, col: 0xe8e8f0, src: 'Legendary drop', weight: 1, text: 'The third combo strike is a long piercing lunge that hits weak points (+50% crit damage).' },
  { id: 'lilypad', name: 'Lilypad Longbow', cls: 'archer', kind: 'bow', lvl: 8, dmg: 1.35, spd: 0.9, col: 0x5aa84a, big: true, src: 'The Crowned Toad', weight: 0, text: 'Arrows soak what they hit. Charged shots burst in a splash that soaks everything around.' },
  { id: 'spoolstring', name: 'Spoolstring', cls: 'archer', kind: 'bow', lvl: 5, dmg: 1.05, spd: 1.1, col: 0xd84a6a, src: 'Legendary drop', weight: 1, text: 'Charged shots stitch the first two foes they pierce together with a briar tether.' },
  { id: 'glasswing', name: 'Glasswing', cls: 'archer', kind: 'bow', lvl: 6, dmg: 1.15, spd: 1.05, col: 0xbfe8f0, src: 'Cracked Conservatory', weight: 0.5, text: 'Charged arrows shatter into three glass shards on impact.' },
  { id: 'mothlight', name: 'Mothlight Lantern', cls: 'witch', kind: 'staff', lvl: 5, dmg: 1.15, spd: 1.0, col: 0x4a3a2a, orb: 0xfff3b0, src: 'Lantern Moth elites', weight: 0.6, text: 'Bolts that hit release a pale moth that seeks another foe.' },
  { id: 'porcelainrod', name: 'Porcelain Conductor', cls: 'witch', kind: 'wand', lvl: 6, dmg: 1.0, spd: 1.35, col: 0xf0ece4, orb: 0x9ad8ff, src: 'Cracked Conservatory', weight: 0.5, text: 'Bolts arc lightning to a second foe — to every wet foe nearby if the target is wet.' },
  { id: 'candelabra', name: "Chandler's Candelabra", cls: 'witch', kind: 'staff', lvl: 7, dmg: 1.3, spd: 0.95, col: 0xc0a060, orb: 0xffb347, src: 'Candle Slug elites', weight: 0.6, text: 'Charged fireballs split into three when they burst.' },
  { id: 'parasol', name: 'Rainmaker Parasol', cls: null, kind: 'oversized', lvl: 5, dmg: 1.3, spd: 0.95, reach: 1.5, col: 0x3a6a9a, src: 'Legendary drop (any class)', weight: 0.8, text: 'Universal. Guarding with the canopy blocks everything in front, heavy blows too. Charged spins soak foes around you.' },
  { id: 'teaspoon', name: 'The Royal Teaspoon', cls: null, kind: 'oversized', lvl: 1, dmg: 1.75, spd: 0.8, reach: 1.7, col: 0xb8b0a0, visualScale: 1.9, src: 'Exceptionally rare (the Crowned Toad hoards one)', weight: 0.02, text: 'Universal. Every third swing is a Royal Stir that drags foes into a whirl. Every hit goes BONK.' },
];
