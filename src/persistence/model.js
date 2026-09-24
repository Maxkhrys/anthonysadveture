// Portable character data. No renderer, browser storage, or world-instance ownership.
export const SCHEMA_VERSION = 3;
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
    sigils: {}, sigilsOwned: [], recipes: [], allocatedStats: {}, statPoints: 0 };
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
  if (!Number.isInteger(it.r) || it.r < 0 || it.r > 4) throw new Error('Unsupported item rarity');
  if (it.slot === 'weapon') { nonnegative(it.min, 'weapon damage'); nonnegative(it.max, 'weapon damage'); }
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
  { id: 'overworld:village', area: 'overworld', spawn: 'village' },
  { id: 'dungeon:entrance', area: 'dungeon', spawn: 'entrance' },
  { id: 'dungeon:pre', area: 'dungeon', spawn: 'pre' },
];

export function normalizeCharacter(input) {
  requireRecord(input, 'character');
  const p = copy(input);
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name.trim()) throw new Error('Invalid character identity');
  if (!['samurai', 'archer', 'witch'].includes(p.classId)) throw new Error('Unsupported character class; save retained.');
  requireRecord(p.inventory, 'inventory');
  const inv = { ...defaultInventory(p.classId), ...p.inventory };
  if (inv.cls !== p.classId) throw new Error('Character class is locked.');
  for (const key of ['level', 'xp', 'sp', 'coins', 'hp', 'maxHp', 'potions', 'maxPotions', 'statPoints', 'keys', 'vessels']) nonnegative(inv[key], key);
  if (!Number.isInteger(inv.level) || inv.level < 1) throw new Error('Invalid level');
  for (const key of ['bag', 'skills', 'chimes', 'recipes', 'sigilsOwned']) if (!Array.isArray(inv[key])) throw new Error(`Malformed ${key}`);
  inv.skills.forEach(x => nonnegative(x, 'skill rank'));
  for (const key of ['mats', 'sigils', 'allocatedStats']) requireRecord(inv[key], key);
  Object.values(inv.allocatedStats).forEach(x => nonnegative(x, 'allocated stat'));
  inv.equip = equipment(inv.equip);
  const seen = new Set();
  const accept = it => {
    identifyItem(it, p.id, 'legacy');
    if (seen.has(it.itemInstanceId)) throw new Error('Duplicate item identity; save retained for recovery.');
    seen.add(it.itemInstanceId);
  };
  Object.values(inv.equip).filter(Boolean).forEach(accept);
  inv.bag.forEach(accept);
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
  nonnegative(p.world.time.elapsedSeconds, 'world time');
  if (typeof p.world.checkpoint.area !== 'string' || typeof p.world.checkpoint.spawn !== 'string') throw new Error('Invalid checkpoint');
  return p;
}

export function createProfile({ name, classId, inventory = defaultInventory(classId) }) {
  return normalizeCharacter({ id: newId(), name: name.trim(), classId, inventory, world: {}, createdAt: new Date().toISOString() });
}

export function migrateSave(raw) {
  requireRecord(raw, 'save');
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 2 && raw.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported save schema. Use a compatible game version; this save will not be overwritten.');
  if (raw.schemaVersion === SCHEMA_VERSION) {
    if (!Array.isArray(raw.characters)) throw new Error('Malformed character list');
    const out = { ...copy(raw), characters: raw.characters.map(normalizeCharacter) };
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
