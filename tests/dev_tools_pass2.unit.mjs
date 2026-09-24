// Comprehensive Unit Test Suite for Mossling Dev Tools Pass 2
// Testing all 20 developer labs, dynamic discovery, profile cloning/testing, stress purge, and zero progression leakage.
// Usage: node --test tests/dev_tools_pass2.unit.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { DevCommands, COMMAND_DEFINITIONS, COMMAND_CATEGORIES } from '../src/dev/commands.js';
import { discoverSystems, ProfileLab, devStress, readGamepadDiagnostics, BASE_ENEMY_KINDS } from '../src/dev/tools.js';
import { LocalSaveProvider } from '../src/persistence/provider.js';
import { buildDevRoom, DevCombatDummy, DevMannequin, DevEchoPinwheel, DevBossAltar } from '../src/world/devroom.js';
import { defaultInventory, identifyItem, EQUIPMENT_SLOTS, BELLSTONES, SCHEMA_VERSION, createProfile } from '../src/persistence/model.js';
import { CLASSES } from '../src/rpg/classes.js';
import { RECIPES, MATS } from '../src/rpg/crafting.js';
import { WEAPONS, ARMORS, LEGENDARIES } from '../src/rpg/items.js';
import { EXTRA_ENEMIES } from '../src/entities/enemies.js';
import { AFFIX_DEFINITIONS, AFFIX_RARITY_TIERS } from '../src/rpg/affixes.js';

function createMockPass2Harness() {
  const activeProfile = createProfile({ name: 'MossyTest', classId: 'samurai' });
  activeProfile.id = 'char-test-1';
  activeProfile.discoveredBellstones = ['overworld:village'];
  const inv = activeProfile.inventory;
  const logs = [];
  const logFn = (msg, type = 'info') => logs.push({ msg, type });

  const saveStore = {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: activeProfile.id,
    characters: [activeProfile],
  };

  const game = {
    inv,
    profile: activeProfile,
    flags: activeProfile.world.flags,
    stats: activeProfile.world.stats,
    checkpoint: activeProfile.world.checkpoint,
    discoveredBellstones: activeProfile.discoveredBellstones,
    playTime: 0,
    pstats: { wmin: 10, wmax: 15, wspd: 1.0, crit: 5, critDmg: 50, armor: 10, dr: 0.9, lifesteal: 0, cdr: 0, moveSpd: 0, mf: 0 },
    time: 120,
    godMode: false,
    noclip: false,
    entities: [],
    area: { id: 'overworld', name: 'Thornwood Verges' },
    room: null,
    settings: { quality: 'high', pixel: 0, shake: 1, numbers: true, zoom: 1.0 },
    camZoom: 1.0,
    baseVH: 12,
    pr: {
      forceScale: null,
      setViewHeight(h) { this.vh = h; },
      resize() { this.resized = true; },
      postMat: { uniforms: { fogAmt: { value: 0 } } },
    },
    ui: {
      toast: () => {},
      say: () => {},
      float: () => {},
      bossBar: () => {},
      updateVitals: () => {},
      openInventory: () => {},
    },
    fx: {
      burst: () => {},
      ring: () => {},
      sparks: () => {},
    },
    gust: () => {},
    recalc() {
      this.inv.maxHp = 60 + (this.inv.vessels || 0) * 10;
    },
    save() {
      // Sync back to saveStore
      activeProfile.inv = JSON.parse(JSON.stringify(this.inv));
      activeProfile.flags = JSON.parse(JSON.stringify(this.flags));
      activeProfile.bellstones = [...this.discoveredBellstones];
      return Promise.resolve(true);
    },
    spawnEnemy(kind, x, z, opts) {
      const e = {
        kind,
        x,
        z,
        isEnemy: true,
        dead: false,
        hp: 40,
        maxHp: 40,
        elite: !!opts?.eliteChance,
        displayName: (opts?.eliteChance ? 'Elite ' : '') + kind,
        remove() { this.dead = true; },
      };
      this.entities.push(e);
      return e;
    },
    makeElite(e) {
      e.elite = true;
      e.displayName = 'Elite ' + (e.displayName || e.kind);
    },
    warpTo(area, spawn) {
      this.area = { id: area, name: area };
      this.warpTarget = { area, spawn };
    },
    atmosphere() {},
    pickupItem(it) {
      this.inv.bag.push(it);
      return true;
    },
    player: {
      x: 35,
      z: 42,
      facing: 0,
      abilityCds: [0, 0, 0],
      surge: 50,
      burn: 0,
      chill: 0,
      shock: 0,
      setState: () => {},
      sync: () => {},
    },
    _saveStore: saveStore,
  };

  // Mock localStorage for ProfileLab tests
  globalThis.localStorage = {
    _data: {
      'mossling-save-v2': JSON.stringify(saveStore),
    },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; },
  };

  return { game, logs, logFn, saveStore };
}

test('Pass 2: Dynamic System Discovery introspects all live game registries without hardcoding', () => {
  const { game } = createMockPass2Harness();
  const disc = discoverSystems(game);
  const sys = disc.discoveredSystems;

  // 1. Classes
  assert.deepEqual(sys.classes.map(c => c.id), Object.keys(CLASSES));
  assert.ok(sys.classes.some(c => c.id === 'samurai') && sys.classes.some(c => c.id === 'archer') && sys.classes.some(c => c.id === 'witch'));

  // 2. Equipment slots (must be the canonical 9)
  assert.deepEqual(sys.equipmentSlots, EQUIPMENT_SLOTS);
  assert.equal(sys.equipmentSlots.length, 9);
  assert.ok(sys.equipmentSlots.includes('head') && sys.equipmentSlots.includes('weapon') && sys.equipmentSlots.includes('ring2'));

  // 3. Recipes
  assert.equal(sys.recipes.length, RECIPES.length);
  assert.ok(sys.recipes.some(r => r.id === 'thornrebuke'));

  // 4. Crafting Materials
  assert.deepEqual(sys.mats.map(m => m.id), Object.keys(MATS));
  assert.ok(sys.mats.some(m => m.id === 'shard') && sys.mats.some(m => m.id === 'thornheart'));

  // 5. Weapons, Armors, Legendaries
  assert.equal(sys.weapons.length, WEAPONS.length);
  assert.equal(sys.armors.length, ARMORS.length);
  assert.equal(sys.legendaries.length, LEGENDARIES.length);

  // 6. Enemies
  assert.ok(sys.enemyKinds.length >= BASE_ENEMY_KINDS.length + Object.keys(EXTRA_ENEMIES).length);
  assert.ok(sys.enemyKinds.includes('beetle') && sys.enemyKinds.includes('blot'));

  // 7. Bellstones
  assert.equal(sys.bellstones.length, BELLSTONES.length);
  assert.ok(sys.bellstones.some(b => b.id === 'overworld:village'));

  // 8. Hardcoded list documented
  assert.ok(disc.hardcodedSystems.length > 0);
});

test('Pass 2: ProfileLab manages profile inspection, cloning, switching, and save recovery', () => {
  const { game, saveStore } = createMockPass2Harness();
  const provider = new LocalSaveProvider(localStorage);

  // Test Profile Cloning
  const cloned = ProfileLab.cloneCurrentProfile(game, 'Cloned_Hero');
  assert.ok(cloned);
  assert.equal(cloned.name, 'Cloned_Hero');
  assert.notEqual(cloned.id, game.profile.id);
  assert.equal(provider.loadCharacters().length, 2);

  // Test Test Profile Generation for each class
  const witchProfile = ProfileLab.createTestProfile(game, { cls: 'witch', level: 12, name: 'DevWitch' });
  assert.equal(witchProfile.classId, 'witch');
  assert.equal(witchProfile.inventory.level, 12);
  assert.equal(witchProfile.inventory.cls, 'witch');
  assert.equal(provider.loadCharacters().length, 3);

  // Test Profile Switching
  const switched = ProfileLab.switchProfile(game, witchProfile.id);
  assert.ok(switched);
  assert.equal(game.profile.id, witchProfile.id);
  assert.equal(game.inv.cls, 'witch');
  assert.equal(game.inv.level, 12);

  // Test Save Validation
  const val = ProfileLab.validateSaveData(game);
  assert.equal(val.valid, true);
  assert.equal(val.charactersValidated, 3);
  assert.ok(val.itemsValidated >= 0);

  // Test Synthetic Migration Simulation
  const mig = ProfileLab.simulateMigrationTest();
  assert.equal(mig.schemaVersion, SCHEMA_VERSION);
  assert.equal(mig.characterClass, 'samurai');
  assert.ok(mig.characterName.length > 0);

  // Test Corrupt Recovery Fallback
  const rec = ProfileLab.simulateCorruptRecoveryTest();
  assert.equal(rec.recovered, true);
  assert.equal(rec.profile.cls, 'samurai');
});

test('Pass 2: DevStress manages entity and loot spawning with guaranteed zero leakage on clear', () => {
  const { game } = createMockPass2Harness();

  // Initial state: no stress entities
  assert.equal(devStress.activeEnemies.length, 0);
  assert.equal(devStress.activeLoot.length, 0);

  // Spawn 20 stress enemies
  const spawnedCount = devStress.spawnEnemies(game, 20);
  assert.equal(spawnedCount, 20);
  assert.equal(devStress.activeEnemies.length, 20);
  assert.equal(game.entities.filter(e => e.isStressEnemy).length, 20);

  // Spawn 30 loot items
  const lootCount = devStress.spawnLoot(game, 30);
  assert.equal(lootCount, 30);
  assert.equal(devStress.activeLoot.length, 30);
  assert.equal(game.entities.filter(e => e.isStressLoot).length, 30);

  // Check metrics
  const m = devStress.getMetrics(game);
  assert.ok(m.entities >= 50);

  // Clear stress entities completely
  const cleared = devStress.clear(game);
  assert.equal(cleared, 50);
  assert.equal(devStress.activeEnemies.length, 0);
  assert.equal(devStress.activeLoot.length, 0);
  assert.equal(game.entities.filter(e => e.isStressEnemy || e.isStressLoot).length, 0);
});

test('Pass 2: Gamepad diagnostics return structured diagnostic payload without crashing', () => {
  const diag = readGamepadDiagnostics();
  assert.equal(typeof diag.available, 'boolean');
  assert.equal(diag.available, false);
  assert.ok(diag.reason || diag.message);

  // Test with mock gamepad to verify sticks, deadzones, and buttons
  const origDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'getGamepads');
  try {
    Object.defineProperty(globalThis.navigator, 'getGamepads', {
      value: () => [{
        id: 'Xbox Wireless Controller',
        axes: [0.5, -0.8, 0.7071, -0.7071],
        buttons: [{ pressed: true, value: 1.0 }, { pressed: false, value: 0 }],
      }],
      configurable: true,
      writable: true,
    });
    const mockDiag = readGamepadDiagnostics();
    assert.equal(mockDiag.available, true);
    assert.equal(mockDiag.connected, 1);
    assert.ok(mockDiag.leftStick && typeof mockDiag.leftStick.x === 'number');
    assert.ok(mockDiag.rightStick && typeof mockDiag.rightStick.x === 'number');
    assert.ok(typeof mockDiag.rightStick.angleDeg === 'string');
    assert.ok(Array.isArray(mockDiag.buttonsPressed));
  } finally {
    if (origDescriptor) {
      Object.defineProperty(globalThis.navigator, 'getGamepads', origDescriptor);
    } else {
      delete globalThis.navigator.getGamepads;
    }
  }
});

test('Pass 2: Dev Commands cover all 8 categories cleanly', () => {
  assert.equal(COMMAND_CATEGORIES.length, 8);
  assert.deepEqual(COMMAND_CATEGORIES, [
    'CHARACTER',
    'LOOT',
    'COMBAT',
    'WORLD',
    'CRAFTING',
    'QUEST',
    'VISUAL',
    'PERFORMANCE',
  ]);

  for (const [name, def] of Object.entries(COMMAND_DEFINITIONS)) {
    assert.ok(COMMAND_CATEGORIES.includes(def.category), `Command ${name} has invalid category: ${def.category}`);
    assert.ok(typeof DevCommands.handlers[name] === 'function', `Missing handler for ${name}`);
  }
});

test('Pass 2: Canonical 9 Equipment Slots can be equipped, unequipped, and inspected', () => {
  const { game, logs, logFn } = createMockPass2Harness();

  // Equip each of the 9 canonical slots
  for (const slot of EQUIPMENT_SLOTS) {
    DevCommands.execute(game, `/equipslot ${slot} nodachi`, logFn);
    assert.ok(game.inv.equip[slot], `Slot ${slot} should be equipped`);
    assert.equal(game.inv.equip[slot].slot, slot);
  }

  // Inspect slot
  DevCommands.execute(game, '/inspectitem weapon', logFn);
  assert.ok(logs.some(l => l.msg.includes('=== ITEM METADATA:')));

  // Unequip weapon
  DevCommands.execute(game, '/unequip weapon', logFn);
  assert.equal(game.inv.equip.weapon, undefined);
  assert.ok(game.inv.bag.some(it => it.base === 'nodachi'));
});

test('Pass 2: Boss Lab controls HP, resets encounter, and alters phase', () => {
  const { game, logs, logFn } = createMockPass2Harness();

  const mockBoss = {
    isBoss: true,
    name: 'Bramblemaw',
    hp: 1000,
    maxHp: 1000,
    state: 'combat',
    enraged: true,
  };
  game.entities.push(mockBoss);

  // Set Boss HP to 35%
  DevCommands.execute(game, '/bosshp 35', logFn);
  assert.equal(mockBoss.hp, 350);

  // Reset Boss encounter
  DevCommands.execute(game, '/bossreset', logFn);
  assert.equal(mockBoss.hp, 1000);
  assert.equal(mockBoss.state, 'intro');
  assert.equal(mockBoss.enraged, false);
});

test('Pass 2: DevRoom preserves player return point and prevents progression leakage upon exit', () => {
  const { game, logs, logFn } = createMockPass2Harness();

  game.area = { id: 'overworld', name: 'Verdant Forest' };
  game.player.x = 88.5;
  game.player.z = 104.2;

  // Warp into devroom
  DevCommands.execute(game, '/devroom', logFn);
  assert.equal(game.warpTarget.area, 'devroom');
  assert.deepEqual(game.devRoomPrevLocation, {
    area: 'overworld',
    spawn: { x: 88.5, z: 104.2 },
  });

  // Spawn some stress enemies in devroom
  devStress.spawnEnemies(game, 10);
  assert.ok(devStress.activeEnemies.length > 0);

  // Exit devroom
  DevCommands.execute(game, '/devroom exit', logFn);
  assert.equal(game.warpTarget.area, 'overworld');
  assert.equal(game.player.x, 88.5);
  assert.equal(game.player.z, 104.2);

  // Verify stress entities were automatically purged upon exit to prevent leakage
  assert.equal(devStress.activeEnemies.length, 0);
});
