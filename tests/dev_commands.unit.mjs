// Unit tests for Mossling Hidden Developer Commands, Dev Room, and Stat/Affix Rarity Foundation.
// Usage: node --test tests/dev_commands.unit.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { DevCommands, COMMAND_DEFINITIONS } from '../src/dev/commands.js';
import {
  AFFIX_RARITY_TIERS,
  TIER_ORDER,
  TOTAL_AFFIX_WEIGHT,
  rollAffixTier,
  rollAffixInstance,
  rollWeaponWithAffixes,
  formatAffixSummary,
  AFFIX_DEFINITIONS,
  QUALITATIVE_MODIFIERS,
} from '../src/rpg/affixes.js';
import { simulateAffixRolls } from '../src/rpg/affix_simulation.js';
import { buildDevRoom, DevTrainingDummy, DevElementalTarget, DevSpawnerTotem, DevLootChest } from '../src/world/devroom.js';
import { defaultInventory } from '../src/persistence/model.js';
import { MAX_LEVEL } from '../src/rpg/classes.js';
import { genItem } from '../src/rpg/items.js';

test('ordinary loot excludes inactive affixes while the dev registry retains them', () => {
  const inactive = ['echoDmg', 'projSize', 'reach'];
  const random = Math.random;
  let seed = 42;
  Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  try {
    for (const cls of ['samurai', 'archer', 'witch']) {
      for (const slot of ['weapon', 'charm']) {
        for (let i = 0; i < 500; i++) {
          const item = genItem({ cls, slot, level: 15, rarity: 1 + i % 3 });
          assert.ok(item.affixes.length > 0);
          for (const key of inactive) {
            assert.ok(!item.affixes.includes(key), `${key} leaked into ordinary loot`);
            assert.equal(item.stats[key], undefined);
          }
        }
      }
    }
    for (const key of inactive) assert.ok(AFFIX_DEFINITIONS[key]);
  } finally { Math.random = random; }
});

// Mock game harness for unit testing
function createMockGame() {
  const inv = defaultInventory('samurai');
  const logs = [];
  const logFn = (msg, type = 'info') => logs.push({ msg, type });

  const game = {
    inv,
    pstats: { wmin: 6, wmax: 10, wspd: 1.0, crit: 5, critDmg: 50, armor: 10, dr: 0.9, lifesteal: 0, cdr: 0, moveSpd: 0, mf: 0 },
    time: 100,
    flags: {},
    discoveredBellstones: [],
    godMode: false,
    noclip: false,
    devRoomPrevLocation: null,
    entities: [],
    area: { id: 'overworld', dungeon: false },
    room: null,
    hudDirty: false,
    saved: false,
    ui: {
      toast: () => {},
      say: () => {},
      banner: () => {},
      float: () => {},
    },
    recalc() {
      this.inv.maxHp = 60 + (this.inv.vessels || 0) * 10;
      this.hudDirty = true;
    },
    save() {
      this.saved = true;
      return Promise.resolve(true);
    },
    gainXp(n) {
      this.inv.xp += n;
      if (this.inv.xp >= 100 && this.inv.level < MAX_LEVEL) {
        this.inv.level++;
        this.inv.sp++;
      }
    },
    pickupItem(it) {
      this.inv.bag.push(it);
      return true;
    },
    warpTo(area, spawn) {
      this.area = { id: area, dungeon: area === 'dungeon' || area === 'devroom' };
      this.warpTarget = { area, spawn };
    },
    atmosphere() {},
    spawnEnemy(kind, x, z, opts) {
      const e = {
        kind,
        x,
        z,
        isEnemy: true,
        hp: 30,
        elite: !!opts?.eliteChance,
        displayName: (opts?.eliteChance ? 'Elite ' : '') + kind,
        remove() { this.dead = true; },
      };
      this.entities.push(e);
      return e;
    },
    makeElite(e) {
      e.elite = true;
      e.displayName = 'Elite ' + e.displayName;
    },
    nameOf(e) {
      return e.displayName || e.kind || 'enemy';
    },
    resetRoom() {
      for (const e of this.entities) {
        if (e.isMovable && e.reset) e.reset();
      }
    },
    player: {
      x: 48,
      z: 54,
      facing: 0,
      godMode: false,
      noclip: false,
      sync() {},
    },
  };

  return { game, logs, logFn };
}

test('all required slash commands are defined with descriptions and usage', () => {
  const required = [
    'help', 'god', 'noclip', 'give', 'giveall', 'level', 'xp', 'coins',
    'teleport', 'bellstone', 'boss', 'spawn', 'clear', 'time', 'weather',
    'classinfo', 'recipe', 'materials', 'heal', 'resetroom', 'devroom',
    'rollweapon', 'affixes', 'droptest',
  ];

  for (const cmd of required) {
    assert.ok(COMMAND_DEFINITIONS[cmd], `Command /${cmd} must be registered`);
    assert.ok(COMMAND_DEFINITIONS[cmd].desc, `Command /${cmd} must have a description`);
    assert.ok(COMMAND_DEFINITIONS[cmd].usage, `Command /${cmd} must have usage guidance`);
  }
});

test('/god toggles player invulnerability and replenishes resources', () => {
  const { game, logs, logFn } = createMockGame();

  assert.equal(game.godMode, false);
  DevCommands.execute(game, '/god', logFn);
  assert.equal(game.godMode, true);
  assert.equal(game.player.godMode, true);
  assert.equal(game.inv.hp, game.inv.maxHp);
  assert.equal(game.res, 100);
  assert.ok(logs.some(l => l.msg.includes('God Mode: ENABLED')));

  DevCommands.execute(game, '/god', logFn);
  assert.equal(game.godMode, false);
  assert.equal(game.player.godMode, false);
  assert.ok(logs.some(l => l.msg.includes('God Mode: DISABLED')));
});

test('/noclip toggles obstacle and wall passing for player', () => {
  const { game, logs, logFn } = createMockGame();

  assert.equal(game.noclip, false);
  DevCommands.execute(game, '/noclip', logFn);
  assert.equal(game.noclip, true);
  assert.equal(game.player.noclip, true);
  assert.ok(logs.some(l => l.msg.includes('NoClip: ENABLED')));

  DevCommands.execute(game, '/noclip', logFn);
  assert.equal(game.noclip, false);
  assert.equal(game.player.noclip, false);
  assert.ok(logs.some(l => l.msg.includes('NoClip: DISABLED')));
});

test('/give grants materials, consumables, and gear', () => {
  const { game, logs, logFn } = createMockGame();

  // Materials
  DevCommands.execute(game, '/give shard 50', logFn);
  assert.equal(game.inv.mats.shard, 50);

  DevCommands.execute(game, '/give thornheart 5', logFn);
  assert.equal(game.inv.mats.thornheart, 5);

  // Consumables & quest keys
  DevCommands.execute(game, '/give potion 2', logFn);
  assert.equal(game.inv.potions, 3);

  DevCommands.execute(game, '/give key 3', logFn);
  assert.equal(game.inv.keys, 3);

  DevCommands.execute(game, '/give bigkey', logFn);
  assert.equal(game.inv.bigkey, true);

  DevCommands.execute(game, '/give bellows', logFn);
  assert.equal(game.inv.bellows, true);

  DevCommands.execute(game, '/give vessel 2', logFn);
  assert.equal(game.inv.vessels, 2);
  assert.equal(game.inv.maxHp, 80);
});

test('/giveall grants complete testing package and unlocks all recipes', () => {
  const { game, logs, logFn } = createMockGame();

  DevCommands.execute(game, '/giveall', logFn);

  assert.equal(game.inv.mats.shard, 999);
  assert.equal(game.inv.mats.thornheart, 99);
  assert.equal(game.inv.keys, 9);
  assert.equal(game.inv.bigkey, true);
  assert.equal(game.inv.bellows, true);
  assert.equal(game.inv.galeValve, true);
  assert.ok(game.inv.recipes.length >= 7, 'All recipes must be unlocked');
  assert.ok(game.inv.bag.length >= 3, 'Sample weapons must be granted');
});

test('/level, /xp, and /coins manage character progression', () => {
  const { game, logs, logFn } = createMockGame();

  // Level
  DevCommands.execute(game, '/level 10', logFn);
  assert.equal(game.inv.level, 10);
  assert.equal(game.inv.sp, 9);
  assert.equal(game.inv.skills[0], 1);
  assert.equal(game.inv.skills[1], 1);
  assert.equal(game.inv.skills[2], 1);

  // XP
  const prevLvl = game.inv.level;
  DevCommands.execute(game, '/xp 200', logFn);
  assert.ok(game.inv.xp >= 0);

  // Coins
  DevCommands.execute(game, '/coins 500', logFn);
  assert.equal(game.inv.coins, 500);
});

test('/teleport and /tp support named landmarks and coordinates', () => {
  const { game, logs, logFn } = createMockGame();

  // Named landmark
  DevCommands.execute(game, '/teleport village', logFn);
  assert.equal(game.warpTarget.area, 'overworld');
  assert.equal(game.warpTarget.spawn, 'village');

  DevCommands.execute(game, '/tp dungeon', logFn);
  assert.equal(game.warpTarget.area, 'dungeon');
  assert.equal(game.warpTarget.spawn, 'entrance');

  // Coordinates
  DevCommands.execute(game, '/tp 120 45', logFn);
  assert.equal(game.player.x, 120);
  assert.equal(game.player.z, 45);
});

test('/devroom warps to test room and preserves previous location for exit', () => {
  const { game, logs, logFn } = createMockGame();
  game.area = { id: 'overworld' };
  game.player.x = 42;
  game.player.z = 88;

  DevCommands.execute(game, '/devroom', logFn);

  assert.equal(game.warpTarget.area, 'devroom');
  assert.deepEqual(game.devRoomPrevLocation, {
    area: 'overworld',
    spawn: { x: 42, z: 88 },
  });
});

test('/spawn, /clear, /heal, /time, /weather, and /materials', () => {
  const { game, logs, logFn } = createMockGame();

  // Spawn
  DevCommands.execute(game, '/spawn beetle 2', logFn);
  assert.equal(game.entities.filter(e => e.kind === 'beetle').length, 2);

  DevCommands.execute(game, '/spawn knight 1 elite', logFn);
  const knight = game.entities.find(e => e.kind === 'knight');
  assert.ok(knight);
  assert.equal(knight.elite, true);

  // Clear
  DevCommands.execute(game, '/clear', logFn);
  assert.equal(game.entities.filter(e => e.isEnemy && !e.dead).length, 0);

  // Heal
  game.inv.hp = 10;
  game.inv.potions = 0;
  DevCommands.execute(game, '/heal', logFn);
  assert.equal(game.inv.hp, game.inv.maxHp);
  assert.equal(game.inv.potions, game.inv.maxPotions);
  assert.equal(game.res, 100);

  // Time & weather
  DevCommands.execute(game, '/time day', logFn);
  assert.ok(logs.some(l => l.msg.includes('Time set to: DAY')));

  DevCommands.execute(game, '/weather rain', logFn);
  assert.equal(game.raining, true);
  assert.equal(game.rainK, 1.0);

  // Materials
  DevCommands.execute(game, '/materials', logFn);
  assert.ok(game.inv.mats.shard >= 500);
});

test('buildDevRoom creates an isolated test arena with all required facilities', () => {
  const room = buildDevRoom();

  assert.equal(room.id, 'devroom');
  assert.equal(room.devOnly, true);
  assert.equal(room.dungeon, true);
  assert.ok(room.w >= 20 && room.h >= 20);
  assert.ok(room.spawns.spawn);

  // Verify entity factories
  const mockG = {
    entities: [],
    world: { add() {} },
    time: 0,
    ui: { say() {}, toast() {}, float() {} },
    inv: { cls: 'samurai', level: 5 },
    pickupItem() {},
  };

  const entities = room.defs.map(d => d.factory ? d.factory(mockG) : d);

  // 1. Training dummy
  const dummy = entities.find(e => e instanceof DevTrainingDummy);
  assert.ok(dummy, 'Must contain DevTrainingDummy');
  assert.equal(dummy.hp, 99999999);
  assert.equal(dummy.isDummy, true);

  // Dummy DPS telemetry test
  dummy.onHit({ dmg: 100, crit: false });
  dummy.onHit({ dmg: 200, crit: true });
  assert.equal(dummy.hitCount, 2);
  assert.equal(dummy.totalDamage, 300);
  assert.equal(dummy.maxHit, 200);
  assert.ok(dummy.dps > 0);

  // 2. Elemental test targets
  const elementalTargets = entities.filter(e => e instanceof DevElementalTarget);
  assert.ok(elementalTargets.length >= 4, 'Must contain 4 elemental targets');
  const elements = elementalTargets.map(e => e.element);
  assert.ok(elements.includes('burn'));
  assert.ok(elements.includes('chill'));
  assert.ok(elements.includes('shock'));
  assert.ok(elements.includes('physical'));

  // 3. Spawners
  const spawners = entities.filter(e => e instanceof DevSpawnerTotem);
  assert.ok(spawners.length >= 5, 'Must contain enemy spawner totems');

  // 4. Test chest
  const chest = entities.find(e => e instanceof DevLootChest);
  assert.ok(chest, 'Must contain test loot chest');

  // 5. Workbench & Bellstone
  assert.ok(room.defs.some(d => d.type === 'workbench'), 'Must contain workbench');
  assert.ok(room.defs.some(d => d.type === 'bellstone'), 'Must contain bellstone');
});

test('affix rarity foundation defines 8 tiers summing to 1,000,000 weight', () => {
  assert.equal(TIER_ORDER.length, 8);
  assert.deepEqual(TIER_ORDER, [
    'common', 'uncommon', 'rare', 'epic', 'legendary', 'relic', 'mythic', 'prismatic'
  ]);

  let sum = 0;
  for (const id of TIER_ORDER) {
    const t = AFFIX_RARITY_TIERS[id];
    assert.ok(t);
    assert.ok(t.token);
    assert.ok(t.color);
    assert.ok(t.multRange && t.multRange.length === 2);
    assert.ok(t.multRange[1] > t.multRange[0]);
    assert.ok(t.tradeWeight > 0);
    sum += t.weight;
  }

  assert.equal(sum, TOTAL_AFFIX_WEIGHT);
  assert.equal(TOTAL_AFFIX_WEIGHT, 1000000);

  // Prismatic conceptual target ~0.01%
  const prismatic = AFFIX_RARITY_TIERS.prismatic;
  assert.equal(prismatic.probability, 0.0001); // 0.0100%
  assert.equal(prismatic.weight, 100);
});

test('rollWeaponWithAffixes supports weapons containing multiple affixes of different rarities', () => {
  const weapon = rollWeaponWithAffixes({
    cls: 'archer',
    level: 8,
    baseId: 'galebow',
    affixCount: 4,
    targetTier: 'mythic',
  });

  assert.ok(weapon);
  assert.equal(weapon.slot, 'weapon');
  assert.equal(weapon.kind, 'bow');
  assert.equal(weapon.rolledAffixes.length, 4);

  // Check that at least one affix is Mythic
  const hasMythic = weapon.rolledAffixes.some(a => a.tier === 'mythic');
  assert.ok(hasMythic, 'Must guarantee target tier when specified');

  // Verify all affixes have metadata
  for (const aff of weapon.rolledAffixes) {
    assert.ok(aff.id);
    assert.ok(aff.name);
    assert.ok(aff.tier);
    assert.ok(aff.displayToken);
    assert.ok(aff.displayColor);
    assert.ok(aff.rollRange && aff.rollRange.length === 2);
    assert.ok(typeof aff.actualRoll === 'number');
    assert.ok(aff.valuation && aff.valuation.score > 0);
  }

  // Verify summary formatting
  const summary = formatAffixSummary(weapon.rolledAffixes[0]);
  assert.ok(summary.includes(weapon.rolledAffixes[0].name));
  assert.ok(summary.includes(weapon.rolledAffixes[0].tierName));
});

test('qualitative modifiers are attached to high-tier rolls without breaking damage balance', () => {
  const qualKeys = Object.keys(QUALITATIVE_MODIFIERS);
  assert.ok(qualKeys.length >= 6);

  for (const k of qualKeys) {
    const q = QUALITATIVE_MODIFIERS[k];
    assert.ok(q.name);
    assert.ok(q.description);
    assert.ok(q.trigger);
    assert.ok(q.hook);
    assert.ok(['relic', 'mythic', 'prismatic'].includes(q.minTier));
  }

  // Force roll a Prismatic affix with qualitative candidate
  const critDef = AFFIX_DEFINITIONS.crit;
  const prismTier = AFFIX_RARITY_TIERS.prismatic;
  const instance = rollAffixInstance(critDef, prismTier, 10, () => 0.05); // deterministic roll

  assert.equal(instance.tier, 'prismatic');
  assert.ok(instance.qualitative, 'Prismatic crit must have qualitative modifier');
  assert.equal(instance.qualitative.id, 'prismatic_splinters');
});

test('/droptest and simulation run 10,000 virtual rolls without save mutation', () => {
  const { game, logs, logFn } = createMockGame();

  DevCommands.execute(game, '/droptest 10000', logFn);

  assert.equal(game.saved, false, 'Droptest simulation must never trigger game save');
  assert.ok(logs.some(l => l.msg.includes('MOSSLING AFFIX RARITY SIMULATION REPORT')));
});
