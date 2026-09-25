import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalSaveProvider, SAVE_KEY, BACKUP_KEY, LEGACY_KEY, RECOVERY_KEY } from '../src/persistence/provider.js';
import { defaultInventory, EQUIPMENT_SLOTS, respecInventory, reinforceWeapon, worldPhase } from '../src/persistence/model.js';
import { snapshotCharacter, restoreCharacter, CharacterSession } from '../src/persistence/session.js';
import { starterWeapon, genItem } from '../src/rpg/items.js';
import { CLASSES, xpNeed, computeStats } from '../src/rpg/classes.js';
import { craft } from '../src/rpg/crafting.js';

class Storage {
  data = new Map();
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i]; }
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { if (this.failKey === k) throw new Error('Quota exceeded'); this.data.set(k, String(v)); }
}
function setup() { const storage = new Storage(); return { storage, provider: new LocalSaveProvider(storage) }; }
function fresh(provider, classId = 'samurai') {
  const inventory = defaultInventory(classId); inventory.equip.weapon = starterWeapon(classId);
  return provider.createCharacter({ name: 'Tester', classId, inventory });
}
function legacy() {
  const inv = defaultInventory();
  inv.level = 9; inv.xp = 147; inv.coins = 543; inv.sp = 3; inv.skills = [3, 2, 1];
  inv.equip = { weapon: starterWeapon('samurai'), helm: genItem({ slot: 'helm' }), armor: genItem({ slot: 'armor' }), charm: genItem({ slot: 'charm' }) };
  inv.bag = [starterWeapon('archer')];
  for (const it of [...Object.values(inv.equip), ...inv.bag]) { delete it.itemInstanceId; delete it.upgradeLevel; }
  inv.equip.weapon.craft = 'thornrebuke'; inv.mats.shard = 11; inv.recipes = ['thornrebuke']; inv.sigilsOwned = ['returningcut']; inv.sigils[0] = 'returningcut';
  return { inv, flags: { q_mill: 2, stage: 4, bossKilled: true, riftBest: 7, 'rested:pre': true }, checkpoint: { area: 'dungeon', spawn: 'pre' }, playTime: 999, stats: { deaths: 2 }, future: { keeps: true } };
}

test('production storage key stays stable across builds and pre-crafting saves receive additive defaults', () => {
  assert.equal(SAVE_KEY, 'mossling-save-v2');
  const { storage, provider } = setup(); const old = legacy();
  delete old.inv.mats; delete old.inv.sigils; delete old.inv.recipes; delete old.inv.sigilsOwned;
  storage.setItem(SAVE_KEY, JSON.stringify(old));
  const p = provider.loadCharacters()[0];
  assert.equal(p.inventory.level, 9); assert.equal(p.inventory.mats.shard, 0);
  assert.deepEqual(p.inventory.sigils, {}); assert.equal(p.inventory.equip.weapon.craft, 'thornrebuke');
});

test('missing primary restores backup instead of silently treating the player as new', () => {
  const { storage, provider } = setup(); const p = fresh(provider);
  storage.data.delete(SAVE_KEY);
  assert.equal(new LocalSaveProvider(storage).loadCharacters()[0].id, p.id);
});

test('legacy migration preserves level, XP, inventory, crafting, quests, dungeon and playtime; stable IDs on repeated updates', () => {
  const { storage, provider } = setup(), original = JSON.stringify(legacy()); storage.setItem(SAVE_KEY, original);
  let p = provider.loadCharacters()[0];
  assert.equal(storage.getItem(LEGACY_KEY), original);
  assert.equal(p.inventory.level, 9); assert.equal(p.inventory.xp, 147); assert.equal(p.inventory.coins, 543);
  assert.equal(p.inventory.equip.head.base, JSON.parse(original).inv.equip.helm.base);
  assert.equal(p.inventory.equip.weapon.craft, 'thornrebuke'); assert.equal(p.inventory.mats.shard, 11);
  assert.equal(p.inventory.sigils[0], 'returningcut'); assert.equal(p.world.flags.q_mill, 2);
  assert.equal(p.world.flags.riftBest, 7); assert.equal(p.world.stats.deaths, 2); assert.equal(p.playTime, 999);
  assert.deepEqual(p.discoveredBellstones, ['dungeon:pre']);
  const ids = [p.id, p.inventory.equip.weapon.itemInstanceId, p.inventory.bag[0].itemInstanceId];
  for (let update = 0; update < 20; update++) {
    const nextBuild = new LocalSaveProvider(storage); p = nextBuild.loadCharacters()[0]; p = nextBuild.saveCharacter(p);
    assert.deepEqual([p.id, p.inventory.equip.weapon.itemInstanceId, p.inventory.bag[0].itemInstanceId], ids);
    assert.equal(p.inventory.bag.length, 1);
  }
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).legacy.future.keeps, true);
});

test('fresh characters, independent classes, locked class, deletion and no recreation from stale tabs', () => {
  const { provider } = setup(); let a = fresh(provider), b = fresh(provider, 'witch');
  assert.notEqual(a.id, b.id); assert.equal(a.inventory.level, 1); assert.equal(a.inventory.xp, 0);
  a.inventory.coins = 234; a = provider.saveCharacter(a);
  assert.equal(provider.loadCharacters()[1].inventory.coins, 0);
  assert.throws(() => provider.saveCharacter({ ...a, classId: 'witch' }), /locked/);
  assert.throws(() => provider.saveCharacter({ ...a, inventory: { ...a.inventory, cls: 'archer' } }), /locked/);
  provider.deleteCharacter(b.id, b.revision);
  assert.throws(() => provider.saveCharacter(b), /deleted/);
  assert.equal(provider.loadCharacters().length, 1);
});

test('all equipment slots, named and random weapons, reinforcement and crafted mutations survive', () => {
  const { provider } = setup(); let p = fresh(provider);
  for (const slot of EQUIPMENT_SLOTS) { const it = genItem({ slot: slot === 'weapon' ? 'weapon' : 'armor', rarity: slot === 'weapon' ? 4 : 1, level: 9 }); it.slot = slot; p.inventory.equip[slot] = it; }
  const w = p.inventory.equip.weapon; assert.equal(reinforceWeapon(w), true); assert.equal(reinforceWeapon(w), true);
  w.craft = 'thornrebuke'; p = provider.saveCharacter(p);
  assert.equal(Object.keys(p.inventory.equip).length, 9); assert.equal(p.inventory.equip.weapon.upgradeLevel, 2);
  assert.equal(p.inventory.equip.weapon.craftedMutations[0], 'engraving:thornrebuke');
  const g = { settings: {} }; restoreCharacter(g, p);
  assert.equal(g.inv.equip.helm, g.inv.equip.head); assert.equal(Object.values(g.inv.equip).length, 9);
  const before = computeStats(g.inv).wmin; g.inv.equip.weapon.upgradeLevel = 0;
  assert.ok(Math.abs(before / computeStats(g.inv).wmin - 1.1) < 0.00001);
});

test('real crafting transaction and transfer preserve identities and recipe effects', () => {
  const { provider } = setup(); let p = fresh(provider); const g = { settings: {}, recalc() {}, save() {} }; restoreCharacter(g, p);
  g.inv.coins = 500; g.inv.mats = { shard: 40, thornheart: 2 }; g.inv.recipes = ['thornrebuke'];
  const first = g.inv.equip.weapon, second = starterWeapon('samurai'); g.inv.bag.push(second);
  assert.equal(craft(g, 'thornrebuke', first).ok, true);
  assert.equal(craft(g, 'thornrebuke', second).ok, true);
  p = provider.saveCharacter(snapshotCharacter(g));
  assert.equal(p.inventory.equip.weapon.craft, undefined); assert.deepEqual(p.inventory.equip.weapon.craftedMutations, []);
  assert.equal(p.inventory.bag[0].craft, 'thornrebuke'); assert.equal(p.inventory.bag[0].itemInstanceId, second.itemInstanceId);
});

test('world clock, Bellstones, death state, character settings and unknown fields round trip independently of inventory', () => {
  const { provider } = setup(); let p = fresh(provider); p.extension = { future: 1 };
  const g = { settings: { difficulty: 'hard', guide: false } }; restoreCharacter(g, p);
  g.inv.hp = 0; g.stats.deaths = 1; g.flags.q_mill = 2; g.flags['door:root'] = true;
  g.time = 250; g.playTime = 480; g.discoveredBellstones = ['overworld:village', 'dungeon:pre']; g.riftFloor = 8;
  p = provider.saveCharacter(snapshotCharacter(g));
  const restored = { settings: {} }; restoreCharacter(restored, provider.loadCharacters()[0]);
  assert.equal(restored.inv.hp, 0); assert.equal(restored.stats.deaths, 1); assert.equal(restored.flags.q_mill, 2);
  assert.equal(restored.riftFloor, 8); assert.equal(restored.time, 250); assert.equal(worldPhase(restored.time).isNight, true);
  assert.equal(restored.settings.difficulty, 'hard'); assert.equal(p.extension.future, 1);
  assert.deepEqual(restored.discoveredBellstones, g.discoveredBellstones);
});

test('corrupt save recovers previous validated backup and quarantines damaged bytes', () => {
  const { storage, provider } = setup(); let p = fresh(provider); p.inventory.coins = 3; p = provider.saveCharacter(p);
  storage.setItem(SAVE_KEY, '{broken');
  const restarted = new LocalSaveProvider(storage), recovered = restarted.loadCharacters()[0];
  assert.equal(recovered.id, p.id); assert.match(restarted.notice, /Recovered/);
  assert.ok(Object.entries(restarted.exportRecovery()).some(([k, v]) => k.startsWith(RECOVERY_KEY) && v === '{broken'));
});

test('no backup fails closed; future schemas remain untouched even with a valid backup', () => {
  const { storage, provider } = setup(); storage.setItem(SAVE_KEY, '{broken');
  assert.throws(() => provider.loadCharacters(), /damaged/); assert.throws(() => fresh(provider), /recovery/);
  assert.equal(storage.getItem(SAVE_KEY), '{broken');
  const second = setup(); fresh(second.provider); second.storage.setItem(BACKUP_KEY, second.storage.getItem(SAVE_KEY));
  const future = JSON.stringify({ schemaVersion: 999, characters: [] }); second.storage.setItem(SAVE_KEY, future);
  assert.throws(() => new LocalSaveProvider(second.storage).loadCharacters(), /different game version/);
  assert.equal(second.storage.getItem(SAVE_KEY), future);
});

test('quota failure never reports success or destroys current save', () => {
  const { storage, provider } = setup(); const p = fresh(provider), bytes = storage.getItem(SAVE_KEY);
  storage.failKey = SAVE_KEY; p.inventory.coins++;
  assert.throws(() => provider.saveCharacter(p), /Quota/); assert.equal(storage.getItem(SAVE_KEY), bytes);
});

test('duplicate IDs and malformed fields cannot replace a valid save', () => {
  const { storage, provider } = setup(); const p = fresh(provider), original = storage.getItem(SAVE_KEY);
  p.inventory.bag.push(structuredClone(p.inventory.equip.weapon));
  assert.throws(() => provider.saveCharacter(p), /Duplicate/); assert.equal(storage.getItem(SAVE_KEY), original);
  p.inventory.bag = []; p.inventory.skills = 'bad'; assert.throws(() => provider.saveCharacter(p), /skills/);
});

test('revision conflicts protect stale tabs and different characters preserve each other', () => {
  const { storage, provider } = setup(); const p = fresh(provider), other = fresh(provider, 'archer');
  const tab = new LocalSaveProvider(storage); const stale = tab.loadCharacters()[0];
  provider.saveCharacter(p); assert.throws(() => tab.saveCharacter(stale), /another tab/);
  tab.saveCharacter(other); assert.equal(provider.loadCharacters().length, 2);
});

test('traditional XP curve unchanged and respec is idempotent without resetting class, crafting or level', () => {
  for (let l = 1; l <= 30; l++) assert.equal(xpNeed(l), Math.round(30 * Math.pow(l, 1.55) + 20));
  const inv = defaultInventory(); inv.level = 8; inv.xp = 147; inv.skills = [3, 2, 1]; inv.sp = 4;
  inv.allocatedStats = { strength: 3 }; inv.statPoints = 1; inv.sigils[0] = 'returningcut';
  respecInventory(inv, CLASSES.samurai.abilities); respecInventory(inv, CLASSES.samurai.abilities);
  assert.equal(inv.sp, 7); assert.equal(inv.statPoints, 4); assert.equal(inv.level, 8); assert.equal(inv.xp, 147);
  assert.equal(inv.cls, 'samurai'); assert.equal(inv.sigils[0], 'returningcut');
});

test('asynchronous provider writes serialize and failures block subsequent snapshots', async () => {
  const { provider } = setup(); const p = fresh(provider), revisions = [];
  const cloud = { async saveCharacter(snapshot) { await new Promise(r => setTimeout(r, 5)); revisions.push(snapshot.revision); return provider.saveCharacter(snapshot); } };
  const session = new CharacterSession(cloud, p);
  await Promise.all([session.save(p), session.save(p), session.save(p)]);
  assert.deepEqual(revisions, [1, 2, 3]);
  const broken = new CharacterSession({ saveCharacter() { throw new Error('offline'); } }, p);
  await assert.rejects(broken.save(p), /offline/); await assert.rejects(broken.save(p), /offline/);
});
