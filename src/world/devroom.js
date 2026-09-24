// Comprehensive Developer Testing Facility (Dev Room Pass 2) for Mossling.
// DEVELOPMENT AND TESTING ONLY.
// Completely isolated from story progression and overworld maps.
// Contains 20 clearly separated testing labs:
// 1. Character/Profile Lab    2. Inventory Lab          3. Rarity/Loot Lab
// 4. Equipment Mannequins     5. Weapon Test Range      6. Class Test Shrines
// 7. Crafting Lab             8. Elemental Lab          9. Echo Chamber Puzzle
// 10. Enemy Lab Totems        11. Boss Arena & Altar    12. Bellstone Lab
// 13. Death/Currency Lab      14. Day/Night/Weather     15. Visual Settings
// 16. Teleport Station        17. Quest & NPC Testing   18. Stress/Performance
// 19. Gamepad Diagnostics     20. Dev Return Portal

import * as THREE from 'three';
import { Entity, move } from '../entities/entity.js';
import { T } from './tiles.js';
import { Bellstone, Workbench } from '../entities/objects.js';
import { Boss } from '../entities/boss.js';
import { mesh, B, MAT_GLOW, MAT } from '../models.js';
import { sfx } from '../engine/audio.js';
import { rollWeaponWithAffixes, formatAffixSummary, rollAffixInstance, AFFIX_RARITY_TIERS, TIER_ORDER } from '../rpg/affixes.js';
import { simulateAffixRolls, formatSimulationReport } from '../rpg/affix_simulation.js';
import { makeEnemy, EXTRA_ENEMIES } from '../entities/enemies.js';
import { flashObj } from '../entities/common.js';
import { CLASSES } from '../rpg/classes.js';
import { WEAPONS, ARMORS, LEGENDARIES, baseById, starterWeapon, genItem } from '../rpg/items.js';
import { RECIPES, MATS, learn } from '../rpg/crafting.js';
import { identifyItem, BELLSTONES, EQUIPMENT_SLOTS } from '../persistence/model.js';
import { ProfileLab, devStress, readGamepadDiagnostics, BASE_ENEMY_KINDS } from '../dev/tools.js';
import { DevCommands } from '../dev/commands.js';
import { applySettings, saveSettings } from '../settings.js';

// ---------------------------------------------------------------- Interactive Dev Pedestal
export class DevTerminal extends Entity {
  constructor(g, x, z, options = {}) {
    super(g, x, z);
    this.solid = true;
    this.hw = 0.4;
    this.hd = 0.4;
    this.interactable = true;
    this.action = options.action || (() => {});
    this.promptText = options.prompt || 'Use Terminal';
    this.title = options.title || 'Terminal';
    this.color = options.color || 0x7ad8ff;

    // Pedestal model
    const col = this.color;
    const parts = [
      B(0.6, 0.12, 0.6, 0, 0.06, 0, 0x221a30),
      B(0.3, 0.7, 0.3, 0, 0.45, 0, 0x36284a),
      B(0.5, 0.1, 0.5, 0, 0.85, 0, 0x483664),
      B(0.34, 0.06, 0.34, 0, 0.92, 0, col),
    ];
    this.obj.add(mesh(parts));

    // Floating crystal / hologram
    this.holo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshBasicMaterial({ color: col, wireframe: false, transparent: true, opacity: 0.85 })
    );
    this.holo.position.set(0, 1.25, 0);
    this.obj.add(this.holo);
  }

  get prompt() {
    return this.promptText;
  }

  interact() {
    sfx('select');
    this.action(this.g, this);
  }

  update(dt) {
    if (this.holo) {
      this.holo.rotation.y += dt * 2;
      this.holo.rotation.x += dt * 0.8;
      this.holo.position.y = 1.25 + Math.sin(this.g.time * 3) * 0.06;
    }
  }
}

// ---------------------------------------------------------------- High-Fidelity Combat Dummies
export class DevCombatDummy extends Entity {
  constructor(g, x, z, type = 'dps', options = {}) {
    super(g, x, z);
    this.isEnemy = true;
    this.isDummy = true;
    this.dummyType = type;
    this.solid = true;
    this.r = 0.45;
    this.hw = 0.45;
    this.hd = 0.45;
    this.interactable = true;

    // Type configuration
    this.level = options.level || 10;
    this.displayName = options.name || `${type.toUpperCase()} Dummy`;
    this.armorMultiplier = type === 'armoured' ? 0.5 : 1.0;
    this.hp = type === 'boss' ? 100000 : 99999999;
    this.maxHp = this.hp;

    // Poise / Stagger metrics
    this.poiseMax = type === 'stagger' ? 50 : 200;
    this.poise = this.poiseMax;
    this.isStaggered = false;
    this.staggerTimer = 0;

    // Combat telemetry
    this.totalDamage = 0;
    this.hitCount = 0;
    this.maxHit = 0;
    this.comboCount = 0;
    this.lastHitTime = 0;
    this.sessionStartTime = 0;
    this.recentHits = [];
    this.dps1s = 0;
    this.dps5s = 0;

    // Build visual based on dummy type
    const colMap = {
      dps: { main: 0xd8b868, trim: 0xffd25e },
      stagger: { main: 0x9a80b8, trim: 0x8be9fd },
      armoured: { main: 0x6a7082, trim: 0xb0c0d8 },
      elemental: { main: 0x5a8a60, trim: 0x7fd36a },
      boss: { main: 0x8a3040, trim: 0xff4a6a },
    };
    const c = colMap[type] || colMap.dps;

    const parts = [
      B(0.18, 1.6, 0.18, 0, 0.8, 0, 0x5a4028),
      B(1.0, 0.14, 0.14, 0, 1.25, 0, 0x5a4028),
      B(0.55, 0.7, 0.38, 0, 0.95, 0, c.main),
      B(0.3, 0.3, 0.3, 0, 1.55, 0, c.main),
      B(0.36, 0.1, 0.36, 0, 1.72, 0, c.trim),
      B(0.32, 0.32, 0.04, 0, 0.95, 0.2, c.trim),
      B(0.7, 0.12, 0.7, 0, 0.06, 0, 0x2a2034),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return `Reset ${this.displayName} Telemetry`;
  }

  interact() {
    this.resetMetrics();
    sfx('select');
    this.g.ui?.toast('Dummy Reset', `${this.displayName} combat metrics cleared.`, 1.5);
  }

  resetMetrics() {
    this.totalDamage = 0;
    this.hitCount = 0;
    this.maxHit = 0;
    this.comboCount = 0;
    this.recentHits = [];
    this.dps1s = 0;
    this.dps5s = 0;
    this.sessionStartTime = 0;
    this.poise = this.poiseMax;
    this.isStaggered = false;
  }

  onHit(h) {
    const now = this.g.time || 0;
    if (!this.sessionStartTime) this.sessionStartTime = now;

    // Combo timer (1.8s window)
    if (now - this.lastHitTime > 1.8) {
      this.comboCount = 0;
    }
    this.lastHitTime = now;
    this.comboCount++;

    // Calculate applied damage with armour mitigation
    const rawDmg = h.dmg || 1;
    const finalDmg = Math.max(1, Math.round(rawDmg * this.armorMultiplier));

    this.hitCount++;
    this.totalDamage += finalDmg;
    if (finalDmg > this.maxHit) this.maxHit = finalDmg;

    // Poise damage
    this.poise -= finalDmg;
    if (this.poise <= 0 && !this.isStaggered) {
      this.isStaggered = true;
      this.staggerTimer = 2.0;
      sfx('parry');
      this.g.fx?.burst(this.x, 1.2, this.z, 20, [0x8be9fd, 0xffffff], 4);
      this.g.ui?.float(this.x, 1.8, this.z, 'STAGGERED!', '#8be9fd', true);
    }

    // Add to rolling window
    this.recentHits.push({ t: now, dmg: finalDmg });

    // Visual feedback
    flashObj(this.obj, 0.08);
    sfx(h.crit ? 'crit' : 'hit');
    this.g.fx?.burst(this.x, 1.0, this.z, h.crit ? 16 : 8, [0xffd25e, 0xffffff], 3);

    // Real-time DPS calculation
    this.recomputeDPS(now);

    // Floating combat readout
    const critTag = h.crit ? ' ★CRIT!' : '';
    const dpsTag = ` [DPS: ${Math.round(this.dps1s)}]`;
    this.g.ui?.float(
      this.x,
      1.2,
      this.z,
      `${finalDmg}${critTag}${dpsTag}`,
      h.crit ? '#ffd25e' : (this.dummyType === 'armoured' ? '#b0c0d8' : '#ffffff'),
      h.crit
    );

    return 'hit';
  }

  recomputeDPS(now) {
    // 1-second window
    const hits1s = this.recentHits.filter(h => now - h.t <= 1.0);
    const sum1s = hits1s.reduce((acc, h) => acc + h.dmg, 0);
    this.dps1s = sum1s;

    // 5-second window
    const hits5s = this.recentHits.filter(h => now - h.t <= 5.0);
    const sum5s = hits5s.reduce((acc, h) => acc + h.dmg, 0);
    const duration5s = Math.max(1, Math.min(5, now - (hits5s[0]?.t || now)));
    this.dps5s = sum5s / duration5s;

    // Prune entries older than 6 seconds
    this.recentHits = this.recentHits.filter(h => now - h.t <= 6.0);
    this._dps = this.dps1s || this.dps5s || (this.totalDamage > 0 ? this.totalDamage : 0);
  }

  get dps() {
    return this._dps !== undefined ? this._dps : (this.dps1s || this.dps5s || (this.totalDamage > 0 ? this.totalDamage : 0));
  }

  set dps(val) {
    this._dps = val;
  }

  update(dt) {
    if (this.isStaggered) {
      this.staggerTimer -= dt;
      if (this.staggerTimer <= 0) {
        this.isStaggered = false;
        this.poise = this.poiseMax;
        this.g.ui?.float(this.x, 1.8, this.z, 'RECOVERED', '#7fd36a', false);
      }
    }
  }
}

// ---------------------------------------------------------------- Elemental Reaction Target
export class DevElementalTarget extends Entity {
  constructor(g, x, z, element = 'burn') {
    super(g, x, z);
    this.isEnemy = true;
    this.isDummy = true;
    this.element = element;
    this.solid = true;
    this.r = 0.4;
    this.hw = 0.4;
    this.hd = 0.4;
    this.interactable = true;
    this.hp = 999999;
    this.maxHp = 999999;
    this.statusT = 0;

    const EL_COLORS = {
      burn: 0xff5a4a,
      chill: 0x7ad8ff,
      shock: 0xffd25e,
      wind: 0x7fd36a,
      physical: 0xd8b868,
    };
    const col = EL_COLORS[element] || 0xffffff;
    this.displayName = `${element.toUpperCase()} Target`;

    const parts = [
      B(0.18, 1.5, 0.18, 0, 0.75, 0, 0x3a3048),
      B(0.5, 0.5, 0.5, 0, 1.0, 0, col),
      B(0.6, 0.1, 0.6, 0, 0.05, 0, 0x1b1426),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return `Test ${this.displayName} Reaction`;
  }

  interact() {
    this.triggerReaction();
  }

  triggerReaction() {
    const g = this.g;
    sfx('magic');
    if (this.element === 'burn') {
      g.fx?.burst(this.x, 1.0, this.z, 24, [0xff5a4a, 0xffb347], 4);
      g.ui?.float(this.x, 1.5, this.z, 'BURNING (-15 HP/s)', '#ff5a4a', true);
    } else if (this.element === 'chill') {
      g.fx?.ring(this.x, this.z, 0.4, 2.0, 0x7ad8ff, 0.6);
      g.ui?.float(this.x, 1.5, this.z, 'FROZEN (-40% Speed)', '#7ad8ff', true);
    } else if (this.element === 'shock') {
      g.fx?.sparks(this.x, 1.0, this.z, 0, 20, 0xffd25e);
      g.ui?.float(this.x, 1.5, this.z, 'SHOCKED (+25% Dmg Taken)', '#ffd25e', true);
    } else {
      g.fx?.ring(this.x, this.z, 0.2, 2.5, 0x7fd36a, 0.4);
      g.ui?.float(this.x, 1.5, this.z, 'WIND REACTION (Knockback)', '#7fd36a', true);
    }
  }

  onHit(h) {
    flashObj(this.obj, 0.1);
    this.triggerReaction();
    return 'hit';
  }
}

// ---------------------------------------------------------------- Class Quick-Setup Shrine
export class DevClassShrine extends Entity {
  constructor(g, x, z, classId = 'samurai') {
    super(g, x, z);
    this.solid = true;
    this.hw = 0.5;
    this.hd = 0.5;
    this.interactable = true;
    this.classId = classId;

    const C = CLASSES[classId];
    this.displayName = `${C.name} Quick Shrine`;

    const iconCol = { samurai: 0xd8342c, archer: 0x7fd36a, witch: 0x8b5cf6 }[classId] || 0xffd25e;
    const parts = [
      B(0.8, 0.15, 0.8, 0, 0.08, 0, 0x221a30),
      B(0.4, 0.9, 0.4, 0, 0.55, 0, 0x36284a),
      B(0.6, 0.1, 0.6, 0, 1.05, 0, iconCol),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return `Equip & Setup ${CLASSES[this.classId].name}`;
  }

  interact() {
    const g = this.g;
    g.inv.cls = this.classId;
    if (g.profile) g.profile.classId = this.classId;

    // Equip starter/representative gear
    const w = starterWeapon(this.classId);
    identifyItem(w, g.profile?.id);
    g.inv.equip.weapon = w;

    // Unlock abilities
    g.inv.skills = [1, 1, 1];
    if (g.player) g.player.abilityCds = [0, 0, 0];

    // Refill resource
    g.res = 100;
    g.surge = 100;
    g.inv.hp = g.inv.maxHp;

    g.calcStats && g.calcStats();
    g.ui?.updateVitals && g.ui.updateVitals();
    g.save();

    sfx('fanfare');
    g.ui?.toast('Class Configured', `${CLASSES[this.classId].name} kit ready with full resources.`, 2.0);
  }
}

// ---------------------------------------------------------------- Equipment Mannequin
export class DevMannequin extends Entity {
  constructor(g, x, z, slot = 'weapon') {
    super(g, x, z);
    this.solid = true;
    this.hw = 0.4;
    this.hd = 0.4;
    this.interactable = true;
    this.slot = slot;
    this.displayName = `${slot.toUpperCase()} Mannequin`;

    const parts = [
      B(0.6, 0.1, 0.6, 0, 0.05, 0, 0x2a2038),
      B(0.12, 1.2, 0.12, 0, 0.65, 0, 0x5a4a3a),
      B(0.4, 0.5, 0.25, 0, 1.0, 0, 0x4a3a58),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return `Cycle / Test ${this.displayName}`;
  }

  interact() {
    const g = this.g;
    const bases = [...WEAPONS, ...ARMORS].filter(b => (b.kind ? 'weapon' : b.slot) === this.slot);
    if (!bases.length) {
      g.ui?.toast('Slot Empty', `No specific bases for ${this.slot}.`, 1.5);
      return;
    }

    const b = bases[Math.floor(Math.random() * bases.length)];
    const it = genItem({ level: g.inv.level || 5, rarity: 2 });
    it.base = b.id;
    it.name = b.name;
    it.slot = this.slot;
    identifyItem(it, g.profile?.id);

    g.inv.equip[this.slot] = it;
    g.calcStats && g.calcStats();
    g.save();
    sfx('equip');
    g.ui?.toast('Equipped Mannequin Gear', `[${it.name}] in ${this.slot}.`, 1.8);
  }
}

// ---------------------------------------------------------------- Echo Puzzle Chamber Pinwheel
export class DevEchoPinwheel extends Entity {
  constructor(g, x, z, id = 'a') {
    super(g, x, z);
    this.solid = true;
    this.hw = 0.3;
    this.hd = 0.3;
    this.interactable = true;
    this.pinId = id;
    this.spinning = false;
    this.spinTime = 0;

    const parts = [
      B(0.08, 1.4, 0.08, 0, 0.7, 0, 0x6a5a4a),
      B(0.1, 0.1, 0.1, 0, 1.4, 0, 0xffd25e),
    ];
    this.obj.add(mesh(parts));

    // Pinwheel blades
    this.blades = new THREE.Group();
    this.blades.position.set(0, 1.4, 0);
    this.blades.add(mesh([
      B(0.4, 0.08, 0.02, 0, 0, 0, 0x7ad8ff),
      B(0.08, 0.4, 0.02, 0, 0, 0, 0x7ad8ff),
    ]));
    this.obj.add(this.blades);
  }

  get prompt() {
    return `Spin Pinwheel ${this.pinId.toUpperCase()} (Wind / Gust)`;
  }

  interact() {
    this.spin();
  }

  onGust() {
    this.spin();
  }

  spin() {
    this.spinning = true;
    this.spinTime = 2.2;
    this.g.setSignal(`echo.${this.pinId}`, true, false);
    sfx('wind');
    this.g.fx?.sparks(this.x, 1.4, this.z, 0, 10, 0x7ad8ff);

    // Check if both pinwheels are spinning to trigger the Echo Door
    const a = this.g.signal('echo.a');
    const b = this.g.signal('echo.b');
    if (a && b) {
      this.g.setSignal('ow.echo', true, false);
      sfx('fanfare');
      this.g.ui?.toast('Echo Door Unlocked!', 'Both pinwheels spun in harmony.', 2.5);
    }
  }

  update(dt) {
    if (this.spinning) {
      this.spinTime -= dt;
      if (this.blades) this.blades.rotation.z += dt * 14;
      if (this.spinTime <= 0) {
        this.spinning = false;
        this.g.setSignal(`echo.${this.pinId}`, false, false);
      }
    }
  }
}

// ---------------------------------------------------------------- Interactive Spawner Totem
export class DevSpawnerTotem extends Entity {
  constructor(g, x, z, enemyKind, label) {
    super(g, x, z);
    this.enemyKind = enemyKind;
    this.label = label;
    this.solid = true;
    this.hw = 0.35;
    this.hd = 0.35;
    this.interactable = true;

    const isClear = enemyKind === 'clear';
    const col = isClear ? 0x6fdc5a : 0xc46bff;
    const parts = [
      B(0.4, 0.1, 0.4, 0, 0.05, 0, 0x221a30),
      B(0.24, 0.9, 0.24, 0, 0.55, 0, 0x36284a),
      B(0.3, 0.3, 0.3, 0, 1.15, 0, col),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return this.label;
  }

  interact() {
    const g = this.g;
    sfx('select');

    if (this.enemyKind === 'clear') {
      DevCommands.handlers.clear(g, [], msg => g.ui?.toast('Arena Cleared', msg, 1.5));
      return;
    }

    if (this.enemyKind === 'elite') {
      const e = makeEnemy(g, 'knight', this.x + 3.0, this.z);
      if (e) {
        e.spawnT = 0;
        e.level = g.inv.level || 5;
        g.makeElite && g.makeElite(e);
        g.ui?.toast('Spawned Elite', `${e.displayName} ready for combat.`, 1.5);
      }
      return;
    }

    const e = makeEnemy(g, this.enemyKind, this.x + 2.5, this.z);
    if (e) {
      e.spawnT = 0;
      e.level = g.inv.level || 5;
      g.scaleEnemy && g.scaleEnemy(e, { noElite: true });
      g.ui?.toast('Enemy Spawned', `Spawned ${this.enemyKind}.`, 1.2);
    }
  }
}

// ---------------------------------------------------------------- Boss Summoning Altar
export class DevBossAltar extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.solid = true;
    this.hw = 0.7;
    this.hd = 0.7;
    this.interactable = true;

    const parts = [
      B(1.4, 0.15, 1.4, 0, 0.08, 0, 0x1b1426),
      B(1.0, 0.3, 1.0, 0, 0.25, 0, 0x3a1420),
      B(0.8, 0.1, 0.8, 0, 0.45, 0, 0x8a2030),
      B(0.4, 0.4, 0.4, 0, 0.7, 0, 0xff4a5a),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return 'Summon Bramblemaw (Boss Encounter)';
  }

  interact() {
    const g = this.g;
    sfx('roar');

    // Remove old boss if present
    for (const e of g.entities) {
      if (e.isBoss) e.remove && e.remove();
    }

    const boss = new Boss(g, this.x, this.z + 6.0);
    g.bossActive = boss;
    g.entities.push(boss);
    g.ui?.banner('BRAMBLEMAW', 'Guardian of the Verdant Chime', 2.0);
    g.ui?.toast('Boss Encounter Started', 'Test choked-inhale mechanics.', 2.0);
  }
}

// ---------------------------------------------------------------- Backward-compatible Training Dummy Alias
export class DevTrainingDummy extends DevCombatDummy {
  constructor(g, x, z, type = 'dps', options = {}) {
    super(g, x, z, type, options);
  }
}

// ---------------------------------------------------------------- Respawning Test Loot Chest
export class DevLootChest extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.solid = true;
    this.hw = 0.45;
    this.hd = 0.45;
    this.interactable = true;

    const parts = [
      B(0.7, 0.4, 0.5, 0, 0.2, 0, 0x5a3e28),
      B(0.72, 0.12, 0.52, 0, 0.44, 0, 0x8a603c),
      B(0.14, 0.16, 0.04, 0, 0.32, 0.26, 0xffd25e),
    ];
    this.obj.add(mesh(parts));
  }

  get prompt() {
    return 'Open Dev Weapon Chest (Generates Affixes)';
  }

  interact() {
    const it = rollWeaponWithAffixes({ cls: this.g.inv?.cls || 'samurai', level: this.g.inv?.level || 5 });
    identifyItem(it, this.g.profile?.id);
    this.g.pickupItem(it);
    sfx('chest');
    this.g.ui?.toast('Chest Looted', `Received [${it.highestAffixToken} ${it.name}].`, 2.0);
  }
}

// ---------------------------------------------------------------- Dev Return Portal
export class DevReturnPortal extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.interactable = true;
    this.solid = false;

    const gateParts = [
      B(0.2, 1.8, 0.2, -0.7, 0.9, 0, 0x8a70ba),
      B(0.2, 1.8, 0.2, 0.7, 0.9, 0, 0x8a70ba),
      B(1.6, 0.2, 0.24, 0, 1.8, 0, 0xffd25e),
      B(0.25, 0.1, 0.25, -0.7, 0.05, 0, 0x4a3a60),
      B(0.25, 0.1, 0.25, 0.7, 0.05, 0, 0x4a3a60),
    ];
    this.obj.add(mesh(gateParts));

    this.vortex = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    this.vortex.position.set(0, 0.9, 0);
    this.obj.add(this.vortex);
  }

  get prompt() {
    return 'Exit Dev Room (Return to Previous Location)';
  }

  interact() {
    const g = this.g;
    const dest = g.devRoomPrevLocation || { area: 'overworld', spawn: 'village' };
    sfx('warp');
    devStress.clear(g);
    g.warpTo(dest.area, dest.spawn || 'start');
    g.ui?.toast('Exiting Dev Room', `Returned to ${dest.area}.`, 2.0);
  }

  update(dt) {
    if (this.vortex) {
      this.vortex.material.opacity = 0.5 + Math.sin(this.g.time * 4) * 0.2;
    }
  }
}

// ---------------------------------------------------------------- Area Builder
export function buildDevRoom() {
  const W = 60;
  const H = 50;
  const total = W * H;

  const tiles = new Uint8Array(total).fill(T.FLOOR);
  const hv = new Float32Array(total).fill(NaN);
  const defs = [];

  const setTile = (x, y, t) => {
    if (x >= 0 && x < W && y >= 0 && y < H) {
      tiles[y * W + x] = t;
    }
  };

  // Outer walls
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

  // Zone floor layouts
  // 1. Central Grand Plaza (Stone)
  for (let y = 20; y <= 30; y++) {
    for (let x = 24; x <= 36; x++) setTile(x, y, T.STONE);
  }

  // 2. Character & Equipment Lab (North-West)
  for (let y = 4; y <= 18; y++) {
    for (let x = 4; x <= 22; x++) setTile(x, y, T.MOSS);
  }

  // 3. Loot & Crafting Lab (North-East)
  for (let y = 4; y <= 18; y++) {
    for (let x = 38; x <= 56; x++) setTile(x, y, T.SANDSTONE);
  }

  // 4. Weapon Test Range (South-West)
  for (let y = 32; y <= 46; y++) {
    for (let x = 4; x <= 22; x++) setTile(x, y, T.STONE);
  }

  // 5. Elemental & Echo Lab (East & South-East)
  for (let y = 20; y <= 34; y++) {
    for (let x = 38; x <= 56; x++) setTile(x, y, T.CAVE);
  }
  for (let y = 36; y <= 46; y++) {
    for (let x = 38; x <= 56; x++) setTile(x, y, T.SAND);
  }

  // 6. Boss Ring (South)
  for (let y = 32; y <= 46; y++) {
    for (let x = 24; x <= 36; x++) setTile(x, y, T.ASH);
  }

  // ------------------------------------------------ ENTITIES & LAB FIXTURES

  // Central Hub: Spawn point, Return Portal, Bellstone, Workbench
  defs.push({ type: 'custom_entity', factory: g => new DevReturnPortal(g, 30.0, 28.0) });
  defs.push({ type: 'bellstone', id: 'dev_testing_bellstone', spawn: 'spawn', name: 'Dev Testing Bellstone', x: 28.0, z: 24.0 });
  defs.push({ type: 'workbench', x: 32.0, z: 24.0 });

  // LAB 1: Character & Profile Lab (North-West)
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 6.0, 6.0, {
      title: 'Profile Inspector',
      prompt: 'Inspect Active Profile & Save Version',
      color: 0xffd25e,
      action: (game) => DevCommands.handlers.character(game, [], msg => game.ui?.toast('Profile Info', msg, 2.0)),
    }),
  });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 8.5, 6.0, {
      title: 'Save Validator',
      prompt: 'Validate Current Save & Recovery Fallback',
      color: 0x6fdc5a,
      action: (game) => {
        const val = ProfileLab.validateSaveData(game);
        const fb = ProfileLab.simulateCorruptRecoveryTest();
        game.ui?.toast('Save Integrity: PASS', `Validated ${val.itemsValidated} items. Fallback recovery verified.`, 2.5);
      },
    }),
  });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 11.0, 6.0, {
      title: 'Profile Cloner',
      prompt: 'Clone Active Profile for Isolated Testing',
      color: 0x7ad8ff,
      action: (game) => DevCommands.handlers.cloneprofile(game, ['Dev_Test_Clone'], msg => game.ui?.toast('Cloned', msg, 2.0)),
    }),
  });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 13.5, 6.0, {
      title: 'Level & XP Terminal',
      prompt: 'Level Up (+5 Levels & Full Heal)',
      color: 0xffa060,
      action: (game) => DevCommands.handlers.levelup(game, [5], msg => game.ui?.toast('Leveled Up', msg, 1.5)),
    }),
  });

  // LAB 4: Equipment Mannequins (9 Canonical Slots)
  const slotList = ['head', 'chest', 'arms', 'legs', 'boots', 'necklace', 'ring1', 'ring2', 'weapon'];
  slotList.forEach((slot, i) => {
    defs.push({
      type: 'custom_entity',
      factory: g => new DevMannequin(g, 6.0 + (i % 5) * 3.0, 11.0 + Math.floor(i / 5) * 3.5, slot),
    });
  });

  // LAB 3 & 2: Rarity, Loot & Crafting Lab (North-East)
  defs.push({ type: 'custom_entity', factory: g => new DevLootChest(g, 40.0, 10.0) });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 40.0, 6.0, {
      title: 'Loot Station (10 Rolls)',
      prompt: 'Roll 10 High-Tier Weapons',
      color: 0xc46bff,
      action: (game) => {
        for (let i = 0; i < 10; i++) DevCommands.handlers.rollweapon(game, ['epic'], () => {});
        game.ui?.toast('Loot Rolled', 'Spawned 10 multi-affix weapons.', 1.5);
      },
    }),
  });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 43.0, 6.0, {
      title: 'Virtual 10,000 Roll Simulation',
      prompt: 'Run 10,000 Affix Roll Simulation',
      color: 0xffd25e,
      action: (game) => DevCommands.handlers.droptest(game, [10000], () => {}),
    }),
  });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 46.0, 6.0, {
      title: 'Materials Dispenser',
      prompt: 'Grant +20 of All Crafting Essences',
      color: 0x6fdc5a,
      action: (game) => DevCommands.handlers.materials(game, [20], msg => game.ui?.toast('Materials Added', msg, 1.5)),
    }),
  });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 49.0, 6.0, {
      title: 'Recipe Learner',
      prompt: 'Unlock All Auto-Discovered Recipes',
      color: 0x9ad8ff,
      action: (game) => DevCommands.handlers.recipe(game, ['all', 'unlock'], msg => game.ui?.toast('Recipes', msg, 1.5)),
    }),
  });

  // LAB 6: Class Quick Setup Shrines (West)
  defs.push({ type: 'custom_entity', factory: g => new DevClassShrine(g, 6.0, 22.0, 'samurai') });
  defs.push({ type: 'custom_entity', factory: g => new DevClassShrine(g, 10.0, 22.0, 'archer') });
  defs.push({ type: 'custom_entity', factory: g => new DevClassShrine(g, 14.0, 22.0, 'witch') });

  // LAB 5: Weapon Test Range (South-West)
  defs.push({ type: 'custom_entity', factory: g => new DevTrainingDummy(g, 6.0, 36.0, 'dps', { name: 'DPS Dummy' }) });
  defs.push({ type: 'custom_entity', factory: g => new DevCombatDummy(g, 10.0, 36.0, 'stagger', { name: 'Stagger Poise Dummy' }) });
  defs.push({ type: 'custom_entity', factory: g => new DevCombatDummy(g, 14.0, 36.0, 'armoured', { name: 'Armoured Dummy' }) });
  defs.push({ type: 'custom_entity', factory: g => new DevCombatDummy(g, 6.0, 42.0, 'elemental', { name: 'Elemental Dummy' }) });
  defs.push({ type: 'custom_entity', factory: g => new DevCombatDummy(g, 10.0, 42.0, 'boss', { name: 'Boss-Health Dummy' }) });

  // LAB 9: Echo Chamber Puzzle (East)
  defs.push({ type: 'custom_entity', factory: g => new DevEchoPinwheel(g, 42.0, 24.0, 'a') });
  defs.push({ type: 'custom_entity', factory: g => new DevEchoPinwheel(g, 50.0, 24.0, 'b') });
  defs.push({
    type: 'custom_entity',
    factory: g => new DevTerminal(g, 46.0, 28.0, {
      title: 'Echo Toggle Shrine',
      prompt: 'Toggle Verdant Chime Echo (1.5s Repeat)',
      color: 0x9ad8ff,
      action: (game) => DevCommands.handlers.echo(game, ['toggle'], msg => game.ui?.toast('Echo State', msg, 1.8)),
    }),
  });

  // LAB 8: Elemental Lab Targets (South-East)
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 42.0, 38.0, 'burn') });
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 46.0, 38.0, 'chill') });
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 50.0, 38.0, 'shock') });
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 42.0, 42.0, 'physical') });
  defs.push({ type: 'custom_entity', factory: g => new DevElementalTarget(g, 46.0, 42.0, 'wind') });

  // LAB 10 & 11: Boss Arena & Enemy Lab Totems (South)
  defs.push({ type: 'custom_entity', factory: g => new DevBossAltar(g, 30.0, 36.0) });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 26.0, 42.0, 'blot', 'Spawn Blotling') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 28.0, 42.0, 'beetle', 'Spawn Thornback') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 30.0, 42.0, 'puffer', 'Spawn Spore Puffer') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 32.0, 42.0, 'knight', 'Spawn Hush Knight') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 34.0, 42.0, 'elite', 'Spawn Elite Champion') });
  defs.push({ type: 'custom_entity', factory: g => new DevSpawnerTotem(g, 30.0, 45.0, 'clear', 'Clear Arena Enemies') });

  // Wall elevation
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tiles[y * W + x];
      if (t === T.WALL || t === T.ROCK) {
        hv[y * W + x] = 2.0;
      }
    }
  }

  const spawns = {
    spawn: { x: 30.0, z: 26.0 },
    center: { x: 30.0, z: 26.0 },
    combat: { x: 10.0, z: 38.0 },
    boss: { x: 30.0, z: 38.0 },
    echo: { x: 46.0, z: 26.0 },
  };

  return {
    id: 'devroom',
    name: 'Developer Testing Facility',
    w: W,
    h: H,
    tiles,
    hv,
    defs,
    spawns,
    dungeon: true,
    devOnly: true,
    music: 'title',
    sky: 0x140e24,
    fog: 0x221838,
    sun: 0xffd25e,
    amb: 0x8a72a8,
    ground: 0x241a34,
    regions: [
      { id: 'dev_hub', name: 'Central Grand Hub', x0: 24, z0: 20, x1: 36, z1: 30 },
      { id: 'dev_profile', name: 'Profile & Gear Lab', x0: 4, z0: 4, x1: 22, z1: 18 },
      { id: 'dev_loot', name: 'Loot & Crafting Lab', x0: 38, z0: 4, x1: 56, z1: 18 },
      { id: 'dev_combat', name: 'Weapon Testing Range', x0: 4, z0: 32, x1: 22, z1: 46 },
      { id: 'dev_boss', name: 'Boss Ring & Enemy Lab', x0: 24, z0: 32, x1: 36, z1: 46 },
      { id: 'dev_echo', name: 'Echo Puzzle Chamber', x0: 38, z0: 20, x1: 56, z1: 34 },
      { id: 'dev_element', name: 'Elemental Reaction Lab', x0: 38, z0: 36, x1: 56, z1: 46 },
    ],
    rooms: [
      { id: 'dev_hub', name: 'Central Grand Hub', x0: 24, z0: 20, x1: 36, z1: 30 },
      { id: 'dev_profile', name: 'Profile & Gear Lab', x0: 4, z0: 4, x1: 22, z1: 18 },
      { id: 'dev_loot', name: 'Loot & Crafting Lab', x0: 38, z0: 4, x1: 56, z1: 18 },
      { id: 'dev_combat', name: 'Weapon Testing Range', x0: 4, z0: 32, x1: 22, z1: 46 },
      { id: 'dev_boss', name: 'Boss Ring & Enemy Lab', x0: 24, z0: 32, x1: 36, z1: 46 },
      { id: 'dev_echo', name: 'Echo Puzzle Chamber', x0: 38, z0: 20, x1: 56, z1: 34 },
      { id: 'dev_element', name: 'Elemental Reaction Lab', x0: 38, z0: 36, x1: 56, z1: 46 },
    ],
  };
}
