// Developer testing ground (Dev Room) for Mossling.
// Completely isolated from the main story progression and overworld map.
// Contains combat dummies, elemental test targets, spawner totems,
// crafting workbench, Bellstone, respawning test chests, and return portal.

import * as THREE from 'three';
import { Entity } from '../entities/entity.js';
import { T } from './tiles.js';
import { Bellstone, Workbench } from '../entities/objects.js';
import { mesh, B, MAT_GLOW, MAT } from '../models.js';
import { sfx } from '../engine/audio.js';
import { rollWeaponWithAffixes, formatAffixSummary } from '../rpg/affixes.js';
import { makeEnemy } from '../entities/enemies.js';
import { flashObj } from '../entities/common.js';

// ---------------------------------------------------------------- Dev Training Dummy
export class DevTrainingDummy extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.isEnemy = true;
    this.isDummy = true;
    this.displayName = 'Combat Testing Dummy';
    this.r = 0.45;
    this.hw = 0.45;
    this.hd = 0.45;
    this.solid = true;
    this.interactable = true;

    // Immortality: dummy never perishes
    this.hp = 99999999;
    this.maxHp = 99999999;
    this.level = 10;
    this.dead = false;

    // Combat telemetry
    this.totalDamage = 0;
    this.hitCount = 0;
    this.maxHit = 0;
    this.comboCount = 0;
    this.lastHitTime = 0;
    this.sessionStartTime = 0;
    this.recentHits = []; // { t, dmg, crit }
    this.dps = 0;
    this.peakDps = 0;

    // Visual model: Straw & oak training automaton
    const wood = 0x6e4e2e;
    const straw = 0xd8b868;
    const iron = 0x9a9aa8;
    const targetRed = 0xff4a5a;
    const targetGold = 0xffd25e;

    this.bodyGroup = new THREE.Group();
    const parts = [
      // Post and crossbar
      B(0.18, 1.6, 0.18, 0, 0.8, 0, wood),
      B(1.0, 0.14, 0.14, 0, 1.25, 0, wood),
      // Straw body
      B(0.55, 0.7, 0.38, 0, 0.95, 0, straw),
      // Head with helmet
      B(0.3, 0.3, 0.3, 0, 1.55, 0, straw),
      B(0.36, 0.1, 0.36, 0, 1.72, 0, iron),
      // Target bullseye on chest
      B(0.32, 0.32, 0.04, 0, 0.95, 0.2, targetGold),
      B(0.16, 0.16, 0.06, 0, 0.95, 0.21, targetRed),
      // Base pedestal
      B(0.7, 0.12, 0.7, 0, 0.06, 0, iron),
    ];
    this.bodyGroup.add(mesh(parts));
    this.obj.add(this.bodyGroup);

    // DPS readout floating plate
    this.readoutT = 0;
  }

  get prompt() {
    return 'Inspect / Reset DPS Meter';
  }

  interact() {
    const summary = `DPS Session: Peak DPS: ${Math.round(this.peakDps)} · Current DPS: ${Math.round(this.dps)} · Total Dmg: ${Math.round(this.totalDamage).toLocaleString()} · Hits: ${this.hitCount} · Max Hit: ${this.maxHit}`;
    this.g.ui.say('Training Dummy Telemetry', summary);
    this.resetTelemetry();
  }

  resetTelemetry() {
    this.totalDamage = 0;
    this.hitCount = 0;
    this.maxHit = 0;
    this.comboCount = 0;
    this.recentHits = [];
    this.dps = 0;
    this.peakDps = 0;
    this.sessionStartTime = 0;
    sfx('select');
    this.g.ui.toast('DPS Meter Reset', 'Ready for new weapon benchmark.', 2.0);
  }

  onHit(hit) {
    const now = this.g.time;
    const dmg = hit.dmg || 1;
    const crit = !!hit.crit;

    if (!this.sessionStartTime || now - this.lastHitTime > 4.0) {
      this.sessionStartTime = now;
      this.comboCount = 0;
    }

    this.lastHitTime = now;
    this.hitCount++;
    this.comboCount++;
    this.totalDamage += dmg;
    if (dmg > this.maxHit) this.maxHit = dmg;

    this.recentHits.push({ t: now, dmg, crit });

    // Update DPS over sliding 3.0s window
    this.calculateDps(now);

    // Visual feedback: wiggle and hit sparks without moving off root
    this.wobble = 0.25;
    flashObj(this.obj, 0.08, crit ? 0xffd25e : 0xffffff);
    if (this.g.fx?.burst) this.g.fx.burst(this.x, 1.0, this.z, crit ? 14 : 6, [crit ? 0xffd25e : 0xffffff, 0xd8b868], 2.2);

    // Dynamic DPS floater
    if (this.comboCount % 3 === 0 || crit) {
      const dpsText = `DPS: ${Math.round(this.dps)}`;
      if (this.g.ui?.float) this.g.ui.float(this.x, 1.8, this.z, dpsText, '#8be9fd', false);
    }

    return 'hit';
  }

  calculateDps(now) {
    const windowStart = now - 3.0;
    this.recentHits = this.recentHits.filter(h => h.t >= windowStart);

    const windowDmg = this.recentHits.reduce((acc, h) => acc + h.dmg, 0);
    const activeDuration = Math.max(0.5, Math.min(3.0, now - this.sessionStartTime));
    this.dps = windowDmg / activeDuration;
    if (this.dps > this.peakDps) this.peakDps = this.dps;
  }

  update(dt) {
    const now = this.g.time;
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt * 2.5);
      this.bodyGroup.rotation.z = Math.sin(now * 30) * this.wobble * 0.4;
    } else {
      this.bodyGroup.rotation.z = 0;
    }

    // Decay DPS when inactive
    if (this.recentHits.length && now - this.lastHitTime > 3.0) {
      this.calculateDps(now);
    }
    this.sync();
  }
}

// ---------------------------------------------------------------- Elemental Target
export class DevElementalTarget extends Entity {
  constructor(g, x, z, element) {
    super(g, x, z);
    this.isEnemy = true;
    this.isDummy = true;
    this.element = element; // 'burn', 'chill', 'shock', 'physical'
    this.r = 0.4;
    this.hw = 0.4;
    this.hd = 0.4;
    this.solid = true;
    this.hp = 999999;
    this.maxHp = 999999;
    this.level = 5;

    const colors = {
      burn: { name: 'Pyre Target (Burn Test)', main: 0xe05a2b, glow: 0xffa040 },
      chill: { name: 'Frost Target (Chill/Freeze)', main: 0x5ab8e0, glow: 0xc8f0ff },
      shock: { name: 'Storm Target (Shock Test)', main: 0x8a4fe0, glow: 0xfff050 },
      physical: { name: 'Bramble Target (Pierce/Thorn)', main: 0x4e8a3a, glow: 0xa8f080 },
    }[element] || { name: 'Elemental Target', main: 0x888888, glow: 0xffffff };

    this.displayName = colors.name;

    const parts = [
      B(0.16, 1.4, 0.16, 0, 0.7, 0, 0x3a3040),
      B(0.48, 0.48, 0.48, 0, 0.9, 0, colors.main),
      B(0.24, 0.24, 0.52, 0, 0.9, 0, colors.glow),
    ];
    this.obj.add(mesh(parts));
    this.elementColor = colors.glow;
  }

  onHit(hit) {
    flashObj(this.obj, 0.1, this.elementColor);
    if (this.g.fx?.burst) this.g.fx.burst(this.x, 0.9, this.z, 12, [this.elementColor, 0xffffff], 2.8);

    if (this.element === 'burn' && hit.kind === 'fireball') {
      sfx('fire');
      if (this.g.ui?.float) this.g.ui.float(this.x, 1.5, this.z, '🔥 IGNITED', '#ffa040', true);
    } else if (this.element === 'chill' && (hit.kind === 'bolt' || hit.freeze)) {
      sfx('parry');
      if (this.g.ui?.float) this.g.ui.float(this.x, 1.5, this.z, '❄ FROZEN', '#a8f0ff', true);
    } else if (this.element === 'shock') {
      sfx('laser');
      if (this.g.ui?.float) this.g.ui.float(this.x, 1.5, this.z, '⚡ CONDUCTING', '#ffd25e', true);
    }
    return 'hit';
  }
}

// ---------------------------------------------------------------- Dev Spawner Totem
export class DevSpawnerTotem extends Entity {
  constructor(g, x, z, enemyKind, label) {
    super(g, x, z);
    this.enemyKind = enemyKind;
    this.label = label;
    this.interactable = true;
    this.solid = true;
    this.hw = 0.35;
    this.hd = 0.35;

    const isDispel = enemyKind === 'clear';
    const isElite = enemyKind === 'elite';
    const col = isDispel ? 0xff4a5a : isElite ? 0xffd25e : 0x7ad8ff;

    const parts = [
      B(0.5, 0.2, 0.5, 0, 0.1, 0, 0x4a4055),
      B(0.3, 0.6, 0.3, 0, 0.5, 0, 0x6a6078),
      B(0.2, 0.2, 0.2, 0, 0.95, 0, col),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return this.label;
  }

  interact() {
    const g = this.g;
    sfx('secret');

    if (this.enemyKind === 'clear') {
      let cleared = 0;
      for (const e of [...g.entities]) {
        if (e.isEnemy && !e.isDummy) {
          e.remove();
          cleared++;
        }
      }
      g.ui.toast('Arena Cleared', `Removed ${cleared} spawned test enemies.`, 1.5);
      return;
    }

    const spawnX = this.x + (Math.random() - 0.5) * 2;
    const spawnZ = this.z - 3.5;

    if (this.enemyKind === 'elite') {
      const e = g.spawnEnemy('knight', spawnX, spawnZ, { noElite: false, eliteChance: 1.0 });
      g.makeElite(e);
      g.ui.toast('Spawned Elite Foe', `${e.displayName} ready for testing.`, 2.0);
    } else {
      const e = g.spawnEnemy(this.enemyKind, spawnX, spawnZ, { eliteChance: 0 });
      g.ui.toast('Spawned Test Foe', `${g.nameOf(e)} spawned in arena.`, 1.5);
    }
  }
}

// ---------------------------------------------------------------- Dev Loot Chest
export class DevLootChest extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.interactable = true;
    this.solid = true;
    this.hw = 0.4;
    this.hd = 0.35;
    this.opened = false;

    const wood = 0x3a4a6e;
    const trim = 0x5ad8ff;
    this.base = mesh([
      B(0.7, 0.35, 0.5, 0, 0, 0, wood),
      B(0.74, 0.06, 0.54, 0, 0.1, 0, trim),
      B(0.12, 0.14, 0.05, 0, 0.2, 0.26, trim),
    ]);
    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.35, -0.25);
    this.lid.add(mesh([
      B(0.7, 0.18, 0.5, 0, 0, 0.25, wood),
      B(0.74, 0.05, 0.54, 0, 0.15, 0.25, trim),
    ]));
    this.obj.add(this.base, this.lid);
  }

  get prompt() {
    return this.opened ? 'Restock Dev Chest' : 'Open Dev Weapon Chest';
  }

  interact() {
    const g = this.g;
    if (this.opened) {
      // Restock
      this.opened = false;
      this.lid.rotation.x = 0;
      sfx('select');
      g.ui.toast('Dev Chest Restocked', 'Ready to generate another weapon roll.', 1.5);
      return;
    }

    this.opened = true;
    this.lid.rotation.x = -1.9;
    sfx('chest');

    // Roll high-tier test weapon using affix foundation
    const weapon = rollWeaponWithAffixes({
      cls: g.inv.cls || 'samurai',
      level: Math.max(1, g.inv.level || 5),
      affixCount: 4,
    });

    g.pickupItem(weapon);
    g.ui.toast(`Rolled: ${weapon.name}`, `Affixes: ${weapon.rolledAffixes.map(a => `${a.displayToken} ${a.name} (${a.tierName})`).join(', ')}`, 4.0);

    // Auto-restock reminder
    setTimeout(() => {
      if (this.opened) {
        g.ui.toast('Chest Ready', 'Interact to close and roll another weapon.', 2.0);
      }
    }, 2500);
  }
}

// ---------------------------------------------------------------- Dev Return Portal
export class DevReturnPortal extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.interactable = true;
    this.solid = false;

    // Luminous gate pillar
    const gateParts = [
      B(0.2, 1.8, 0.2, -0.7, 0.9, 0, 0x8a70ba),
      B(0.2, 1.8, 0.2, 0.7, 0.9, 0, 0x8a70ba),
      B(1.6, 0.2, 0.24, 0, 1.8, 0, 0xffd25e),
      B(0.25, 0.1, 0.25, -0.7, 0.05, 0, 0x4a3a60),
      B(0.25, 0.1, 0.25, 0.7, 0.05, 0, 0x4a3a60),
    ];
    this.obj.add(mesh(gateParts));

    // Shimmering portal vortex
    this.vortex = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    this.vortex.position.set(0, 0.9, 0);
    this.obj.add(this.vortex);
  }

  get prompt() {
    return 'Return to Previous Location';
  }

  interact() {
    const g = this.g;
    const dest = g.devRoomPrevLocation || { area: 'overworld', spawn: 'village' };
    sfx('warp');
    g.warpTo(dest.area, dest.spawn || 'start');
    g.ui.toast('Exiting Dev Room', `Returning to ${dest.area}.`, 2.0);
  }

  update(dt) {
    if (this.vortex) {
      this.vortex.material.opacity = 0.5 + Math.sin(this.g.time * 4) * 0.2;
    }
  }
}

// ---------------------------------------------------------------- Area Builder
export function buildDevRoom() {
  const W = 26;
  const H = 22;
  const total = W * H;

  const tiles = new Uint8Array(total).fill(T.FLOOR);
  const hv = new Float32Array(total).fill(NaN);
  const defs = [];

  const setTile = (x, y, t) => {
    if (x >= 0 && x < W && y >= 0 && y < H) {
      tiles[y * W + x] = t;
    }
  };

  // Outer border walls
  for (let x = 0; x < W; x++) {
    setTile(x, 0, T.ROCK);
    setTile(x, 1, T.WALL);
    setTile(x, H - 1, T.ROCK);
    setTile(x, H - 2, T.WALL);
  }
  for (let y = 0; y < H; y++) {
    setTile(0, y, T.ROCK);
    setTile(1, y, T.WALL);
    setTile(W - 1, y, T.ROCK);
    setTile(W - 2, y, T.WALL);
  }

  // Zone floor styling
  // Central combat testing floor (Stone)
  for (let y = 5; y <= 15; y++) {
    for (let x = 8; x <= 18; x++) {
      setTile(x, y, T.STONE);
    }
  }

  // Elemental alcove (Sandstone)
  for (let y = 5; y <= 9; y++) {
    for (let x = 4; x <= 7; x++) setTile(x, y, T.SANDSTONE);
    for (let x = 19; x <= 22; x++) setTile(x, y, T.SANDSTONE);
  }

  // Spawner arena border (Cave rock)
  for (let y = 11; y <= 17; y++) {
    for (let x = 19; x <= 23; x++) setTile(x, y, T.CAVE);
  }

  // Utility hub (Moss)
  for (let y = 14; y <= 18; y++) {
    for (let x = 5; x <= 9; x++) setTile(x, y, T.MOSS);
  }

  // 1. Entities: Training Dummy in center
  defs.push({ type: 'custom_entity', factory: g => new DevTrainingDummy(g, 13.0, 10.0) });

  // 2. Elemental Test Targets
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 5.5, 7.0, 'burn') });
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 7.0, 7.0, 'chill') });
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 19.5, 7.0, 'shock') });
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 21.0, 7.0, 'physical') });

  // 3. Spawner Totems
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 22.0, 12.0, 'blot', 'Spawn Blotling') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 22.0, 13.5, 'beetle', 'Spawn Thornback') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 22.0, 15.0, 'puffer', 'Spawn Spore Puffer') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 20.0, 12.0, 'knight', 'Spawn Hush Knight') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 20.0, 13.5, 'elite', 'Spawn Elite Champion') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 20.0, 15.0, 'clear', 'Clear Arena Foes') });

  // 4. Utility Hub: Posy Workbench + Bellstone
  defs.push({ type: 'workbench', x: 6.5, z: 16.0 });
  defs.push({ type: 'bellstone', id: 'dev_testing_bellstone', spawn: 'spawn', name: 'Developer Rest', x: 8.5, z: 16.0 });

  // 5. Loot Chest Testing
  defs.push({ type: 'custom_entity', factory: g => new DevLootChest(g, 6.5, 12.0) });

  // 6. Return Portal (Exit to previous location)
  defs.push({ type: 'custom_entity', factory: g => new DevReturnPortal(g, 13.0, 18.2) });

  // Wall elevation
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tiles[y * W + x];
      if (t === T.WALL || t === T.ROCK) {
        hv[y * W + x] = 1.8;
      }
    }
  }

  return {
    id: 'devroom',
    name: 'Developer Testing Ground',
    w: W,
    h: H,
    tiles,
    hv,
    defs,
    dungeon: true,
    devOnly: true,
    spawns: {
      spawn: { x: 13.0, z: 16.5 },
      entrance: { x: 13.0, z: 16.5 },
    },
    music: 'title',
    sky: 0x121020,
    fog: 0x1c162e,
    sun: 0xfff0d8,
    amb: 0x8a7ea0,
    dark: false,
    rooms: [
      { id: 'devroom_main', name: 'Dev Testing Ground', x0: 0, z0: 0, x1: W, z1: H },
    ],
  };
}
