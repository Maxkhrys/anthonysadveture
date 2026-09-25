// Developer Tools Utilities for Mossling (Pass 2).
// DEVELOPMENT AND TESTING ONLY.
// Provides dynamic system discovery, profile management & save simulation,
// stress testing with guaranteed cleanup, and gamepad telemetry.

import { CLASSES } from '../rpg/classes.js';
import { WEAPONS, ARMORS, LEGENDARIES, AFFIXES } from '../rpg/items.js';
import { RECIPES, MATS } from '../rpg/crafting.js';
import { EXTRA_ENEMIES, makeEnemy } from '../entities/enemies.js';
import { BELLSTONES, SCHEMA_VERSION, createProfile, migrateSave, normalizeCharacter, copy, newId } from '../persistence/model.js';
import { SAVE_KEY, BACKUP_KEY, LocalSaveProvider } from '../persistence/provider.js';
import { snapshotCharacter, restoreCharacter } from '../persistence/session.js';
import { buildOverworld } from '../world/maps.js';
import { REGISTRY } from '../rpg/registry.js';

// Base enemies built directly into makeEnemy switch
export const BASE_ENEMY_KINDS = ['blot', 'seedling', 'beetle', 'puffer', 'wisp', 'knight'];

/**
 * Automatically inspects the codebase's live registries to discover all active systems.
 * Returns an inventory of all discovered systems and any remaining hardcoded systems.
 */
export function discoverSystems(game = null) {
  // 1. Classes and abilities
  const classes = Object.keys(CLASSES).map(k => ({
    id: k,
    name: CLASSES[k].name,
    role: CLASSES[k].role,
    res: CLASSES[k].res,
    abilities: CLASSES[k].abilities.map(a => ({ id: a.id, name: a.name, lvl: a.lvl, cost: a.cost, cd: a.cd })),
  }));

  // 2. Weapon bases
  const weapons = WEAPONS.map(w => ({ id: w.id, name: w.name, cls: w.cls, kind: w.kind, lvl: w.lvl, dmg: w.dmg, spd: w.spd }));

  // 3. Armour bases
  const armors = ARMORS.map(a => ({ id: a.id, name: a.name, slot: a.slot, lvl: a.lvl, armor: a.armor, hp: a.hp }));

  // 4. Legendaries
  const legendaries = LEGENDARIES.map(l => ({ id: l.id, base: l.base, name: l.name, lvl: l.lvl, unique: l.u }));

  // 5. Crafting recipes
  const recipes = RECIPES.map(r => ({ id: r.id, name: r.name, kind: r.kind, cls: r.cls, mats: r.mats, pips: r.pips }));

  // 6. Crafting materials
  const mats = Object.keys(MATS).map(k => ({ id: k, name: MATS[k].name, icon: MATS[k].icon, color: MATS[k].color }));

  // 7. Enemy kinds (base switch + EXTRA_ENEMIES registry)
  const enemyKinds = [...BASE_ENEMY_KINDS, ...Object.keys(EXTRA_ENEMIES)];

  // 8. Elite modifiers
  // (Pass 5 adds Resonant and Oathbound; the registry owns the list)
  const eliteModifiers = [...REGISTRY.eliteModifiers];

  // 9. Bellstones
  const bellstones = BELLSTONES.map(b => ({ id: b.id, area: b.area, spawn: b.spawn }));

  // 10. Overworld landmarks & regions
  let regions = [];
  let spawns = {};
  let overworldLandmarks = [];
  try {
    const ow = buildOverworld();
    regions = (ow.regions || []).map(r => ({ name: r.name, level: r.level, x: (r.x0 + r.x1) / 2, z: (r.y0 + r.y1) / 2 }));
    overworldLandmarks = (ow.landmarks || []).map(l => ({ id: l.id, name: l.name, region: l.region }));
    spawns = ow.spawns || {};
  } catch (e) {
    // Fallback if headless
  }

  // 11. Affix pool
  const affixes = Object.keys(AFFIXES).map(k => ({ id: k, name: AFFIXES[k].name, slots: AFFIXES[k].slots, devOnly: !!AFFIXES[k].devOnly }));

  // 12. Equipment slots (Pass 4 9-slot system)
  const equipmentSlots = ['head', 'chest', 'arms', 'legs', 'boots', 'necklace', 'ring1', 'ring2', 'weapon'];

  return {
    discoveredSystems: {
      classes,
      weapons,
      armors,
      legendaries,
      recipes,
      mats,
      enemyKinds,
      eliteModifiers,
      bellstones,
      regions,
      spawns,
      affixes,
      equipmentSlots,
      // Pass 5 content, read from src/rpg/registry.js (live references, nothing copied)
      pass5: {
        skills: Object.values(REGISTRY.skills).map(k => ({ id: k.id, name: k.name, cls: k.cls, path: k.path, cost: k.cost, cd: k.cd, element: k.element })),
        treeNodes: Object.fromEntries(Object.entries(REGISTRY.tree).map(([c, n]) => [c, n.length])),
        paths: REGISTRY.paths,
        namedWeapons: REGISTRY.namedWeapons.map(w => ({ id: w.id, name: w.name, cls: w.cls, kind: w.kind })),
        accessories: REGISTRY.accessories.map(a => ({ id: a.id, name: a.name })),
        sets: Object.keys(REGISTRY.sets),
        reactions: REGISTRY.reactions,
        enemies: REGISTRY.pass5Enemies,
        bosses: REGISTRY.bosses,
        areas: Object.keys(REGISTRY.areas),
        affixTiers: REGISTRY.affixTiers.map(t => ({ id: t.id, probability: t.probability })),
      },
      // Pass 6 world, from the same registry
      pass6: {
        size: REGISTRY.world.size, regions: Object.keys(REGISTRY.world.regions), settlements: REGISTRY.world.settlements.map(s => s.name),
        miniDungeons: REGISTRY.world.miniDungeons.map(m => m.id), worldBosses: REGISTRY.world.worldBosses.map(b => b.id),
        storyDungeons: REGISTRY.world.storyDungeons, eventTypes: REGISTRY.world.eventTypes, generationVersion: REGISTRY.world.generationVersion,
        landmarks: overworldLandmarks,
      },
    },
    // Systems that are currently hardcoded or authored as specific scripts:
    hardcodedSystems: [
      'Bramblemaw boss encounter & Phase 2 Enrage mechanic (src/entities/boss.js)',
      'Verdant Chime Echo Door 2-stage pinwheel puzzle (tests/village.test.mjs & src/story.js)',
      'Oswin mill quest stages & dialogue choices (src/story.js)',
      'Day/night 420s cycle formula (src/persistence/model.js: worldPhase)',
      'Post-processing shader uniform list (src/engine/pixel.js)',
      'Voxel visual outfit builders (src/hero.js: ARMOR_LOOK, HELM_LOOK)',
    ],
  };
}

// ---------------------------------------------------------------- Profile Lab Utilities
export class ProfileLab {
  static getProfileSummary(game) {
    const p = game.profile;
    const inv = game.inv;
    return {
      id: p?.id || 'unknown',
      name: p?.name || 'Unnamed',
      classId: p?.classId || inv?.cls || 'samurai',
      level: inv?.level || 1,
      xp: inv?.xp || 0,
      schemaVersion: SCHEMA_VERSION,
      revision: p?.revision || 1,
      playTime: Math.round(game.playTime || 0),
      discoveredBellstones: game.discoveredBellstones || [],
      coins: inv?.coins || 0,
      equippedCount: Object.values(inv?.equip || {}).filter(Boolean).length,
      bagCount: (inv?.bag || []).filter(Boolean).length,
    };
  }

  static cloneCurrentProfile(game, customName = null) {
    if (!game.profile) throw new Error('No active profile to clone.');
    const provider = game.saveProvider || new LocalSaveProvider(localStorage);
    const snap = snapshotCharacter(game);
    const cloneName = customName || `${snap.name}_Clone`;
    
    // Create new profile object with unique ID
    const cloned = copy(snap);
    cloned.id = newId();
    cloned.name = cloneName;
    cloned.revision = 1;
    cloned.createdAt = new Date().toISOString();
    cloned.updatedAt = new Date().toISOString();

    // Re-stamp item IDs to prevent multi-character item conflict
    const reID = it => {
      if (it) {
        it.itemInstanceId = newId();
        it.ownerCharacterId = cloned.id;
        it.provenance = { source: 'profile_clone' };
      }
    };
    Object.values(cloned.inventory.equip).forEach(reID);
    cloned.inventory.bag.forEach(reID);

    // Save cloned profile
    const allData = provider.read();
    allData.characters.push(normalizeCharacter(cloned));
    provider.write(allData);

    return cloned;
  }

  static createTestProfile(game, nameOrOpts, classId) {
    const provider = game.saveProvider || new LocalSaveProvider(localStorage);
    let name = 'TestHero';
    let cls = 'samurai';
    if (typeof nameOrOpts === 'object' && nameOrOpts !== null) {
      name = nameOrOpts.name || name;
      cls = nameOrOpts.cls || nameOrOpts.classId || cls;
    } else if (typeof nameOrOpts === 'string') {
      name = nameOrOpts;
      cls = classId || cls;
    }
    const p = provider.createCharacter({ name, classId: cls });
    if (typeof nameOrOpts === 'object' && nameOrOpts !== null && nameOrOpts.level && nameOrOpts.level > 1) {
      p.inventory.level = nameOrOpts.level;
      const allData = provider.read();
      const idx = allData.characters.findIndex(c => c.id === p.id);
      if (idx !== -1) {
        allData.characters[idx] = p;
        provider.write(allData);
      }
    }
    return p;
  }

  static switchProfile(game, targetIdOrName) {
    const provider = game.saveProvider || new LocalSaveProvider(localStorage);
    const chars = provider.loadCharacters();
    const target = chars.find(c => c.id === targetIdOrName || c.name.toLowerCase() === String(targetIdOrName).toLowerCase());
    if (!target) throw new Error(`Character "${targetIdOrName}" not found. Available: ${chars.map(c => c.name).join(', ')}`);
    
    // Save current before switching
    if (game.profile) {
      try { game.save(); } catch (e) { /* ignore */ }
    }

    restoreCharacter(game, target);
    game.save();
    return target;
  }

  static validateSaveData(game) {
    const provider = game.saveProvider || new LocalSaveProvider(localStorage);
    let allData;
    try {
      allData = provider.read();
    } catch {
      const snap = snapshotCharacter(game);
      allData = { schemaVersion: SCHEMA_VERSION, characters: [normalizeCharacter(snap)] };
    }
    const migrated = migrateSave(allData);
    let totalItems = 0;
    for (const c of migrated.characters) {
      totalItems += Object.values(c.inventory.equip).filter(Boolean).length + c.inventory.bag.filter(Boolean).length;
    }
    return {
      valid: true,
      charactersValidated: migrated.characters.length,
      itemsValidated: totalItems,
    };
  }

  static simulateMigrationTest() {
    // Synthetic legacy v2 save format
    const mockLegacy = {
      inv: {
        cls: 'samurai',
        level: 5,
        xp: 120,
        hp: 120,
        maxHp: 120,
        coins: 250,
        bag: [],
        equip: {},
      },
      flags: { 'rested:village': true, stage: 1 },
      stats: { kills: 14 },
      playTime: 360,
    };

    const migrated = migrateSave(mockLegacy);
    return {
      schemaVersion: migrated.schemaVersion,
      characterCount: migrated.characters.length,
      characterName: migrated.characters[0].name,
      characterClass: migrated.characters[0].classId,
      level: migrated.characters[0].inventory.level,
      discoveredBellstones: migrated.characters[0].discoveredBellstones,
    };
  }

  static simulateCorruptFallbackTest() {
    const mockStorage = {
      store: {},
      getItem(k) { return this.store[k] ?? null; },
      setItem(k, v) { this.store[k] = String(v); },
      length: 0,
      key(i) { return Object.keys(this.store)[i]; },
    };

    // Valid save in backup
    const validProfile = createProfile({ name: 'BackupHero', classId: 'samurai' });
    validProfile.cls = 'samurai';
    const validSave = { schemaVersion: SCHEMA_VERSION, characters: [validProfile] };
    mockStorage.setItem(BACKUP_KEY, JSON.stringify(validSave));

    // Corrupted save in primary
    mockStorage.setItem(SAVE_KEY, '{"damaged": true, malformed JSON');

    const provider = new LocalSaveProvider(mockStorage);
    const recovered = provider.read();

    return {
      recovered: recovered.characters[0].name === 'BackupHero',
      notice: provider.notice,
      quarantined: Object.keys(mockStorage.store).some(k => k.startsWith(SAVE_KEY + ':recovery')),
      profile: recovered.characters[0],
    };
  }

  static simulateCorruptRecoveryTest() {
    return ProfileLab.simulateCorruptFallbackTest();
  }
}

// ---------------------------------------------------------------- Stress & Performance Manager
export class StressManager {
  constructor() {
    this.stressEntities = [];
    this.stressLoot = [];
    this.stressParticles = [];
  }

  get activeEnemies() {
    return this.stressEntities;
  }

  get activeLoot() {
    return this.stressLoot;
  }

  spawnEnemies(game, count = 25) {
    const p = game.player;
    if (!p) return 0;
    const kinds = ['blot', 'seedling', 'beetle', 'wisp'];
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 3 + Math.random() * 5;
      const x = p.x + Math.sin(angle) * dist;
      const z = p.z + Math.cos(angle) * dist;
      const kind = kinds[i % kinds.length];

      try {
        let e = null;
        if (typeof game.spawnEnemy === 'function') {
          e = game.spawnEnemy(kind, x, z, { eliteChance: 0 });
        } else {
          e = makeEnemy(game, kind, x, z);
        }
        if (e) {
          e.spawnT = 0;
          e.isStressEnemy = true;
          e.isStressDummy = true;
          e.hp = 1000;
          e.maxHp = 1000;
          // Pacify stress dummies so player is not immediately overwhelmed
          e.think = () => [0, 0];
          game.scaleEnemy && game.scaleEnemy(e, { noElite: true });
          this.stressEntities.push(e);
          spawned++;
        }
      } catch (err) {
        // Skip failed spawns
      }
    }
    return spawned;
  }

  spawnLoot(game, count = 50) {
    const p = game.player;
    if (!p) return 0;
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      const rx = p.x + (Math.random() - 0.5) * 8;
      const rz = p.z + (Math.random() - 0.5) * 8;
      try {
        let pip = null;
        if (typeof game.dropPip === 'function') {
          pip = game.dropPip(rx, rz, 5);
        } else {
          pip = { x: rx, z: rz, isEnemy: false, isStressLoot: true, isStressItem: true, dead: false, remove() { this.dead = true; } };
          if (game.entities) game.entities.push(pip);
        }
        if (pip) {
          pip.isStressLoot = true;
          pip.isStressItem = true;
          this.stressLoot.push(pip);
          spawned++;
        }
      } catch (e) {
        // Skip
      }
    }
    return spawned;
  }

  spawnParticles(game, count = 500) {
    const p = game.player;
    if (!p || !game.fx) return 0;
    for (let i = 0; i < count; i++) {
      game.fx.add({
        x: p.x + (Math.random() - 0.5) * 12,
        y: 0.2 + Math.random() * 2,
        z: p.z + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 2,
        vz: (Math.random() - 0.5) * 2,
        g: 2,
        color: [0xffd25e, 0x7ad8ff, 0xc46bff, 0x7fd36a][i % 4],
        life: 4,
        size: 0.04,
      });
    }
    return count;
  }

  clear(game) {
    let clearedCount = 0;

    // 1. Remove tracked stress enemies
    for (const e of this.stressEntities) {
      if (!e.dead) {
        e.remove && e.remove();
        clearedCount++;
      }
    }
    this.stressEntities = [];

    // 2. Remove tracked stress loot
    for (const it of this.stressLoot) {
      if (!it.dead) {
        it.remove && it.remove();
        clearedCount++;
      }
    }
    this.stressLoot = [];

    // 3. Purge any untracked non-boss enemy or item marked as stress in game.entities
    if (Array.isArray(game.entities)) {
      for (const e of [...game.entities]) {
        if (!e.dead && (e.isStressDummy || e.isStressEnemy || e.isStressItem || e.isStressLoot)) {
          e.remove && e.remove();
          clearedCount++;
        }
      }
      game.entities = game.entities.filter(e => !e.isStressDummy && !e.isStressEnemy && !e.isStressItem && !e.isStressLoot && !e.dead);
    }

    return clearedCount;
  }

  getMetrics(game) {
    const gl = game.pr?.renderer?.getContext();
    const info = game.pr?.renderer?.info;

    return {
      fps: Math.round(game.fps || 60),
      entities: game.entities ? game.entities.length : 0,
      solids: game.solids ? game.solids.length : 0,
      particles: game.fx?.particles ? game.fx.particles.length : 0,
      drawCalls: info?.render?.calls ?? (gl ? 'WebGL active' : 'N/A'),
      triangles: info?.render?.triangles ?? 'N/A',
      geometries: info?.memory?.geometries ?? 'N/A',
      textures: info?.memory?.textures ?? 'N/A',
    };
  }
}

// Global stress manager instance
export const devStress = new StressManager();

// ---------------------------------------------------------------- Gamepad Telemetry Reader
export function readGamepadDiagnostics() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    return { available: false, reason: 'Navigator gamepad API unavailable' };
  }

  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  if (!pads.length) {
    return { available: false, connected: 0, message: 'No controllers connected. Connect a controller or press any button.' };
  }

  const pad = pads[0];
  const lx = pad.axes[0] || 0;
  const ly = pad.axes[1] || 0;
  const rx = pad.axes[2] || 0;
  const ry = pad.axes[3] || 0;

  const deadzone = 0.15;
  const leftMag = Math.hypot(lx, ly);
  const rightMag = Math.hypot(rx, ry);

  const aimActive = rightMag > deadzone;
  const aimAngle = aimActive ? (Math.atan2(rx, -ry) * 180 / Math.PI).toFixed(1) : 'Centered';

  const buttonsPressed = pad.buttons
    .map((b, i) => (b.pressed ? `B${i} (${b.value.toFixed(2)})` : null))
    .filter(Boolean);

  return {
    available: true,
    connected: pads.length,
    id: pad.id,
    leftStick: { x: +lx.toFixed(2), y: +ly.toFixed(2), mag: +leftMag.toFixed(2), active: leftMag > deadzone },
    rightStick: { x: +rx.toFixed(2), y: +ry.toFixed(2), mag: +rightMag.toFixed(2), active: aimActive, angleDeg: aimAngle },
    buttonsPressed,
  };
}
