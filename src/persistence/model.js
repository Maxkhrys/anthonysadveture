import { normalizeAppearance } from '../appearance.js';
// Portable character data. No renderer, browser storage, or world-instance ownership.
import { HEART, LAYOUT_VERSION, FOG_W, FOG_H, REGION_IDS } from '../world/layout.js';
import { GENERATION_VERSION, generateManifest, seedForId, randomSeed, validSeed } from '../world/worldseed.js';
export const SCHEMA_VERSION = 4;
export const EQUIPMENT_SLOTS = ['head', 'chest', 'arms', 'legs', 'boots', 'necklace', 'ring1', 'ring2', 'weapon'];
export const SLOT_ALIASES = { helm: 'head', armor: 'chest', charm: 'necklace' };
export const newId = () => globalThis.crypto.randomUUID();
export const copy = value => structuredClone(value);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function requireRecord(x, label) { if (!record(x)) throw new Error(`Malformed ${label}; original save retained.`); }
function nonnegative(x, label) { if (!Number.isFinite(x) || x < 0) throw new Error(`Invalid ${label}; original save retained.`); }

export function equipment(equip = {}) {
  requireRecord(equip, 'equipment');
  const out = { ...Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, null])), ...equip };
  for (const [old, slot] of Object.entries(SLOT_ALIASES)) {
    if (equip[old] && equip[slot] && JSON.stringify(equip[old]) !== JSON.stringify(equip[slot])) throw new Error('Conflicting equipment slots');
    if (!out[slot]) out[slot] = equip[old] || null;
    delete out[old];
  }
  return out;
}

// Non-enumerable aliases keep the existing inventory UI compatible without storing
// an item twice or counting its stats twice. Disk always uses the nine canonical slots.
export function runtimeEquipment(equip) {
  const out = equipment(equip);
  for (const [old, slot] of Object.entries(SLOT_ALIASES)) Object.defineProperty(out, old, {
    configurable: true, get() { return this[slot]; }, set(value) { this[slot] = value; },
  });
  return out;
}

export function defaultInventory(cls = 'samurai') {
  return { cls, level: 1, xp: 0, sp: 0, skills: [1, 0, 0], equip: runtimeEquipment({}), bag: [], vessels: 0,
    hp: 60, maxHp: 60, coins: 0, keys: 0, bigkey: false, bellows: false, galeValve: false,
    potions: 2, maxPotions: 3, chimes: [], mats: { shard: 0, thornheart: 0, echo: 0, ember: 0, sailcloth: 0 },
    sigils: {}, sigilsOwned: [], recipes: [], allocatedStats: {}, statPoints: 0,
    // Pass 5 (additive): skill-tree ranks, six-slot hotbar, carried-currency recovery, item locks
    tree: {}, loadout: null, lockedItems: [] };
}

export function identifyItem(it, ownerCharacterId = null, source = 'loot') {
  requireRecord(it, 'item');
  it.itemInstanceId ??= newId();
  if (typeof it.itemInstanceId !== 'string' || !it.itemInstanceId) throw new Error('Invalid item identity');
  it.definitionId ??= it.base;
  if (typeof it.definitionId !== 'string') throw new Error('Missing item definition');
  requireRecord(it.stats, 'item stats');
  if (!Array.isArray(it.affixes)) throw new Error('Malformed item affixes');
  if (it.craftedMutations !== undefined && !Array.isArray(it.craftedMutations)) throw new Error('Malformed crafted mutations');
  if (typeof it.base !== 'string' || typeof it.name !== 'string' || typeof it.slot !== 'string') throw new Error('Malformed item definition');
  if (!Number.isInteger(it.r) || it.r < 0 || it.r > 5) throw new Error('Unsupported item rarity');
  if (it.slot === 'weapon') { nonnegative(it.min, 'weapon damage'); nonnegative(it.max, 'weapon damage'); }
  if (it.itemizationVersion !== undefined) {
    if (it.itemizationVersion !== 1) throw new Error('Unsupported itemization version');
    if (!Array.isArray(it.modifiers) || !Array.isArray(it.effects) || !Array.isArray(it.skillMods)) throw new Error('Malformed item gameplay rolls');
    for (const m of it.modifiers) if (!m || typeof m.id !== 'string' || !Number.isFinite(m.value) || m.value < 0 || m.value > 1000) throw new Error('Invalid modifier roll');
    for (const e of it.effects) if (!e || typeof e.id !== 'string' || !Number.isFinite(e.chance) || e.chance < 0 || e.chance > 1) throw new Error('Invalid effect roll');
  }
  it.upgradeLevel ??= 0;
  nonnegative(it.upgradeLevel, 'upgrade level');
  if (!Number.isInteger(it.upgradeLevel)) throw new Error('Invalid upgrade level');
  it.rolledStats ??= { stats: copy(it.stats || {}), min: it.min ?? null, max: it.max ?? null, affixes: copy(it.affixes || []) };
  it.craftedMutations = [...new Set([...(it.craftedMutations || []).filter(x => !String(x).startsWith('engraving:')), ...(it.craft ? ['engraving:' + it.craft] : [])])];
  it.ownerCharacterId = ownerCharacterId;
  it.provenance ??= { source };
  return it;
}

export const BELLSTONES = [
  {id:'emberwell:entrance',area:'emberwell',spawn:'entrance'},
  {id:'emberwell:anvil',area:'emberwell',spawn:'anvil'},
  { id: 'overworld:village', area: 'overworld', spawn: 'village' },
  { id: 'dungeon:entrance', area: 'dungeon', spawn: 'entrance' },
  { id: 'dungeon:pre', area: 'dungeon', spawn: 'pre' },
  // Pass 5 (additive)
  { id: 'conservatory:atrium', area: 'conservatory', spawn: 'atrium' },
  { id: 'conservatory:canopy', area: 'conservatory', spawn: 'canopy' },
  // Pass 6: the wider world (additive)
  { id: 'overworld:glassmere', area: 'overworld', spawn: 'glassmere' },
  { id: 'overworld:pier', area: 'overworld', spawn: 'pier' },
  { id: 'overworld:deepwood', area: 'overworld', spawn: 'deepwood' },
  { id: 'overworld:fernhollow', area: 'overworld', spawn: 'fernhollow' },
  { id: 'overworld:moonfen', area: 'overworld', spawn: 'moonfen' },
  { id: 'overworld:heronisle', area: 'overworld', spawn: 'heronisle' },
  { id: 'overworld:landing', area: 'overworld', spawn: 'landing' },
  { id: 'overworld:wells', area: 'overworld', spawn: 'wells' },
  { id: 'overworld:cinderrest', area: 'overworld', spawn: 'cinderrest' },
  { id: 'overworld:windstair', area: 'overworld', spawn: 'windstair' },
  { id: 'overworld:belfry', area: 'overworld', spawn: 'belfry' },
];
export const BELLSTONE_NAMES = { 'emberwell:entrance':'Ash Vestibule', 'emberwell:anvil':'Bellwright’s Anvil', 'overworld:village': 'Thimblewick', 'dungeon:entrance': 'Hollow Mouth', 'dungeon:pre': 'Root Gate', 'conservatory:atrium': 'Glass Atrium', 'conservatory:canopy': 'Bellfruit Canopy',
  'overworld:glassmere': 'Conservatory Steps', 'overworld:pier': 'Saltwhistle Pier', 'overworld:deepwood': 'Deepwood Shrine', 'overworld:fernhollow': 'Fernhollow', 'overworld:moonfen': 'Moonfen Lantern',
  'overworld:heronisle': 'Heron Isle', 'overworld:landing': 'Mirrow Landing', 'overworld:wells': 'Sunscald Wells', 'overworld:cinderrest': 'Cinder Rest', 'overworld:windstair': 'Windstair Top', 'overworld:belfry': 'Belfry Cradle' };

// ---------------------------------------------------------------- Pass 6: the world record
// world.seed / generationVersion / generated: the character's world seed and the optional
// content it picked (camps, rare elites, merchants, event sites, cave mouths, caches).
// world.discovery: regions and landmarks found, and the map's fog (one bit per 8x8 tiles).
// world.events: persistent states of world events (a star's crater, a closed tear...).
// world.layout: 2 once overworld coordinates have been moved into the bigger map.
export const emptyFog = () => '0'.repeat(Math.ceil(FOG_W * FOG_H / 4));
function shiftKey(key, prefix) {
  const [xs, zs] = key.slice(prefix.length).split(',');
  const x = Number(xs), z = Number(zs);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return key;
  return prefix + (x + HEART.x) + ',' + (z + HEART.z);
}
// Moves everything a save remembers by overworld position from the old 150x110 map into the
// new world, where that map now sits at HEART. Runs once; the layout marker makes it idempotent.
export function migrateWorldLayout(world) {
  if (world.layout === LAYOUT_VERSION) return world;
  const f = world.flags || {}, out = {};
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith('pile:overworld:')) out[shiftKey(k, 'pile:overworld:')] = v;
    else if (k.startsWith('drift:')) out[shiftKey(k, 'drift:')] = v;
    else if (k === 'moved:pier-block' && Array.isArray(v) && v.length === 2) out[k] = [v[0] + HEART.x, v[1] + HEART.z];
    else out[k] = v;
  }
  if (out.deathDrop && out.deathDrop.area === 'overworld' && Number.isFinite(out.deathDrop.x)) out.deathDrop = { ...out.deathDrop, x: out.deathDrop.x + HEART.x, z: out.deathDrop.z + HEART.z };
  world.flags = out;
  world.layout = LAYOUT_VERSION;
  return world;
}
function validManifest(m) {
  return record(m) && Number.isInteger(m.version) && ['camps', 'rare', 'merchants', 'pockets'].every(k => Array.isArray(m[k])) && record(m.events) && record(m.caves)
    && [...m.camps, ...m.rare, ...m.pockets].every(a => record(a) && typeof a.id === 'string' && Number.isFinite(a.x) && Number.isFinite(a.z));
}
export function normalizeWorld(world, id) {
  migrateWorldLayout(world);
  // a seed is forever; a missing or corrupt one is derived from the character, never random,
  // so reloading an old save twice gives the same world
  if (!validSeed(world.seed)) world.seed = seedForId(id);
  if (!Number.isInteger(world.generationVersion) || world.generationVersion < 1) world.generationVersion = GENERATION_VERSION;
  if (!validManifest(world.generated)) world.generated = generateManifest(world.seed, world.generationVersion);
  const d = record(world.discovery) ? world.discovery : {};
  world.discovery = {
    regions: Array.isArray(d.regions) ? [...new Set(d.regions.filter(r => REGION_IDS.includes(r)))] : [],
    landmarks: Array.isArray(d.landmarks) ? [...new Set(d.landmarks.filter(x => typeof x === 'string'))] : [],
    fog: typeof d.fog === 'string' && /^[0-9a-f]*$/.test(d.fog) && d.fog.length === emptyFog().length ? d.fog : emptyFog(),
    marked: Array.isArray(d.marked) ? [...new Set(d.marked.filter(x => typeof x === 'string'))] : [],
  };
  if (!record(world.events)) world.events = {};
  return world;
}

export function normalizeCharacter(input) {
  requireRecord(input, 'character');
  const p = copy(input);
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name.trim()) throw new Error('Invalid character identity');
  if (!['samurai', 'archer', 'witch', 'soulbound'].includes(p.classId)) throw new Error('Unsupported character class; save retained.');
  requireRecord(p.inventory, 'inventory');
  const inv = { ...defaultInventory(p.classId), ...p.inventory };
  if (inv.cls !== p.classId) throw new Error('Character class is locked.');
  for (const key of ['level', 'xp', 'sp', 'coins', 'hp', 'maxHp', 'potions', 'maxPotions', 'statPoints', 'keys', 'vessels']) nonnegative(inv[key], key);
  if (!Number.isInteger(inv.level) || inv.level < 1) throw new Error('Invalid level');
  for (const key of ['bag', 'skills', 'chimes', 'recipes', 'sigilsOwned']) if (!Array.isArray(inv[key])) throw new Error(`Malformed ${key}`);
  inv.skills.forEach(x => nonnegative(x, 'skill rank'));
  for (const key of ['mats', 'sigils', 'allocatedStats']) requireRecord(inv[key], key);
  Object.values(inv.allocatedStats).forEach(x => nonnegative(x, 'allocated stat'));
  // Pass 5 fields: validated, never required (older saves simply lack them)
  if (inv.tree === null || inv.tree === undefined) inv.tree = {};
  requireRecord(inv.tree, 'skill tree');
  Object.values(inv.tree).forEach(x => nonnegative(x, 'skill tree rank'));
  if (inv.loadout !== null && inv.loadout !== undefined) {
    if (!Array.isArray(inv.loadout) || inv.loadout.length > 6 || inv.loadout.some(x => x !== null && typeof x !== 'string')) throw new Error('Malformed ability loadout');
  }
  if (!Array.isArray(inv.lockedItems)) inv.lockedItems = [];
  inv.equip = equipment(inv.equip);
  const seen = new Set();
  const accept = it => {
    identifyItem(it, p.id, 'legacy');
    if (seen.has(it.itemInstanceId)) throw new Error('Duplicate item identity; save retained for recovery.');
    seen.add(it.itemInstanceId);
  };
  Object.values(inv.equip).filter(Boolean).forEach(accept);
  inv.bag.forEach(accept);
  inv.appearance = normalizeAppearance(inv.appearance);
  p.inventory = inv;
  p.settings ??= {};
  requireRecord(p.settings, 'character settings');
  p.discoveredBellstones ??= [];
  if (!Array.isArray(p.discoveredBellstones)) throw new Error('Malformed Bellstones');
  p.discoveredBellstones = [...new Set(p.discoveredBellstones)];
  p.playTime ??= 0; nonnegative(p.playTime, 'playtime');
  p.revision ??= 0; nonnegative(p.revision, 'revision');
  requireRecord(p.world, 'world');
  p.world = { flags: {}, stats: {}, checkpoint: { area: 'overworld', spawn: 'village' }, time: { elapsedSeconds: 0 }, dungeon: {}, ...p.world };
  for (const k of ['flags', 'stats', 'checkpoint', 'time', 'dungeon']) requireRecord(p.world[k], k);
  normalizeWorld(p.world, p.id);
  nonnegative(p.world.time.elapsedSeconds, 'world time');
  if (typeof p.world.checkpoint.area !== 'string' || typeof p.world.checkpoint.spawn !== 'string') throw new Error('Invalid checkpoint');
  return p;
}

export function createProfile({ name, classId, inventory = defaultInventory(classId), seed = randomSeed() }) {
  // a new character gets a world of its own (the seed decides optional content only)
  return normalizeCharacter({ id: newId(), name: name.trim(), classId, inventory, world: { seed, layout: LAYOUT_VERSION }, createdAt: new Date().toISOString() });
}

export function migrateSave(raw) {
  requireRecord(raw, 'save');
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 2 && raw.schemaVersion !== 3 && raw.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported save schema. Use a compatible game version; this save will not be overwritten.');
  if (raw.schemaVersion === 3 || raw.schemaVersion === SCHEMA_VERSION) {
    if (!Array.isArray(raw.characters)) throw new Error('Malformed character list');
    const out = { ...copy(raw), schemaVersion: SCHEMA_VERSION, characters: raw.characters.map(normalizeCharacter) };
    const ids = new Set(), items = new Set();
    for (const p of out.characters) {
      if (ids.has(p.id)) throw new Error('Duplicate character identity');
      ids.add(p.id);
      for (const it of [...p.inventory.bag, ...Object.values(p.inventory.equip).filter(Boolean)]) {
        if (items.has(it.itemInstanceId)) throw new Error('Item belongs to multiple characters');
        items.add(it.itemInstanceId);
      }
    }
    return out;
  }
  requireRecord(raw.inv, 'legacy inventory');
  const p = createProfile({ name: 'Mossling', classId: raw.inv.cls || 'samurai', inventory: { ...defaultInventory(), ...raw.inv } });
  p.world = { ...p.world, flags: copy(raw.flags || {}), stats: copy(raw.stats || {}), checkpoint: copy(raw.checkpoint || p.world.checkpoint) };
  p.playTime = raw.playTime ?? 0;
  p.discoveredBellstones = BELLSTONES.filter(b => raw.flags?.['rested:' + b.spawn]).map(b => b.id);
  // Preserve unknown legacy top-level fields as well as the byte-for-byte backup.
  return { schemaVersion: SCHEMA_VERSION, characters: [normalizeCharacter(p)], legacy: copy(raw) };
}

// Explicitly called by a future NPC/item; repeated calls cannot refund points twice.
export function respecInventory(inv, abilities) {
  const base = abilities.map(a => inv.level >= a.lvl ? 1 : 0);
  inv.sp += inv.skills.reduce((sum, rank, i) => sum + Math.max(0, rank - (base[i] || 0)), 0);
  inv.skills = base;
  inv.statPoints = (inv.statPoints || 0) + Object.values(inv.allocatedStats || {}).reduce((sum, n) => sum + n, 0);
  inv.allocatedStats = {};
}

export const REINFORCEMENT = Object.freeze({ maxLevel: 20, damagePerLevel: 0.05 });
export const reinforcementMultiplier = it => 1 + (it?.upgradeLevel || 0) * REINFORCEMENT.damagePerLevel;
export function reinforceWeapon(it) {
  if (it.slot !== 'weapon' || !Number.isInteger(it.upgradeLevel) || it.upgradeLevel < 0 || it.upgradeLevel >= REINFORCEMENT.maxLevel) return false;
  it.upgradeLevel++; return true;
}

export function worldPhase(elapsedSeconds, dayOffset = 0) {
  const fraction = ((elapsedSeconds + dayOffset) / 420 + 0.32) % 1;
  return { fraction, isNight: fraction < 0.2 || fraction >= 0.7 };
}
