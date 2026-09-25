import {bagCapacity,BOONS} from './rpg/relics.js';
import {buildEmberwell} from './world/emberwell.js';
import {installEmberwell} from './emberwell.js';
import * as THREE from 'three';
import { buildOverworld, buildDungeon, buildGrotto, buildRift } from './world/maps.js';
import { windUniform, clipUniform, waterU, windowMat, lampMat, bendUniform, groundY } from './world/build.js';
import { WorldStreamer } from './world/stream.js';
import { HEART, hx, hz, REGIONS } from './world/layout.js';
import { T, blocksObject } from './world/tiles.js';
import { FX } from './fx.js';
import { PITCH } from './engine/pixel.js';
import { UI } from './ui.js';
import { Story } from './story.js';
import { sfx, playMusic, playTone, setAmbience } from './engine/audio.js';
import { angDiff, clamp } from './engine/util.js';
import { Player } from './entities/player.js';
import { makeEnemy } from './entities/enemies.js';
import { Boss } from './entities/boss.js';
import { Pickup } from './entities/common.js';
import * as O from './entities/objects.js';
import { Entity } from './entities/entity.js';
import { MONSTER_NAMES } from './entities/monsters2.js';
import { ENEMY_MATS } from './entities/monsters3.js';
import { CLASSES, computeStats, xpNeed, MAX_LEVEL } from './rpg/classes.js';
import { genItem, starterWeapon, RARITY, itemPower, makeNamed, LEGENDARIES } from './rpg/items.js';
import { Meteor, GearDrop, LootChest, thornBurst, blast, chainLightning, bolt, Projectile } from './rpg/combat.js';
import { ensureTree, respecTree, rankOf, SKILLS, nodeById, treeOf } from './rpg/skills.js';
import { react, isHeavy, elementOf, soak, fanFlames } from './rpg/elements.js';
import { resonanceRing, Tether } from './rpg/abilities.js';
import { hasEngraving } from './rpg/crafting.js';
import { flashObj } from './entities/common.js';
import { loadSettings, applySettings } from './settings.js';
import { Guide } from './guide.js';
import { AimView } from './aim.js';
import { ensureCraftState, gainMat, learn } from './rpg/crafting.js';
import { tileBlocks } from './entities/entity.js';
import { buildDevRoom } from './world/devroom.js';
import { buildConservatory } from './world/conservatory.js';
import { buildMini, MINI_IDS } from './world/minidungeons.js';
import { HangingBell, BellSequence, CrackedGlass, BossTrigger, TollRack } from './entities/objects5.js';
import { Seamkeeper, CrownedToad } from './entities/bosses5.js';
import { MATS, recipeById } from './rpg/crafting.js';
import { DevConsole } from './dev/console.js';
import './dev/pass5.js'; // Pass 5 dev commands plug into the console's tables
import { installWorld6 } from './world6.js';
import { installStory6 } from './story6.js';
import './dev/pass6.js'; // Pass 6 world dev commands (same plug-in approach)

import { defaultInventory, identifyItem, BELLSTONES, BELLSTONE_NAMES, worldPhase, respecInventory } from './persistence/model.js';
import { snapshotCharacter, restoreCharacter, CharacterSession } from './persistence/session.js';
export const BAG_SIZE = 30;
// Pass 6: the air of each region (fog colour and amount, light, colour grade)
const REGION_MOOD = {
  heartland: { fog: 0xe8e0c8, amt: 0.16 }, whisperwood: { fog: 0x9ac8a0, amt: 0.3 },
  deepwood: { fog: 0x6a9a7a, amt: 0.42, dim: 0.72, grade: [0.94, 1.02, 0.96] },
  glassmere: { fog: 0xd8f0e8, amt: 0.2, grade: [1.0, 1.04, 1.03] },
  lake: { fog: 0xb8d8f0, amt: 0.3, grade: [0.97, 1.0, 1.05] },
  sunscald: { fog: 0xf8d8a0, amt: 0.28, grade: [1.08, 1.02, 0.9] },
  cinderpeak: { fog: 0xa85a40, amt: 0.4, dim: 0.85, grade: [1.1, 0.94, 0.86], gradeK: 0.7 },
  moonfen: { fog: 0x4a6a6a, amt: 0.48, dim: 0.7, grade: [0.9, 1.0, 1.08], gradeK: 0.7 },
  highlands: { fog: 0xe0e8f8, amt: 0.3, grade: [0.96, 1.0, 1.06] },
};
// what the overworld streams in and out around the player (everything else lives all the time)
const STREAMED = new Set(['tuft', 'bush', 'enemy', 'lootchest', 'sign', 'leafpile', 'drift', 'clue', 'vista', 'boulder', 'camp6', 'rare6', 'pocket6', 'pedlar6', 'cavemouth', 'tangle']);
const BUILDERS = { emberwell: buildEmberwell, overworld: buildOverworld, dungeon: buildDungeon, grotto: buildGrotto, devroom: buildDevRoom, conservatory: buildConservatory, ...Object.fromEntries(MINI_IDS.map(id => [id, () => buildMini(id)])) };

export const defaultInv = defaultInventory;

export class Game {
  constructor(pr, input, saveProvider = null) {
    this.saveProvider = saveProvider;
    this.discoveredBellstones = [];
    this.godMode = false;
    this.noclip = false;
    this.devRoomPrevLocation = null;
    this.pr = pr; this.input = input;
    this.scene = new THREE.Scene();
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.fx = new FX(this.scene);
    this.fx.groundAt = (x, z) => this.groundAt(x, z);
    this.ui = new UI(this);
    this.story = new Story(this);
    if (typeof document !== 'undefined') {
      this.devConsole = new DevConsole(this);
    }
    this.time = 0; this.playTime = 0;
    this.inv = defaultInv(); this.flags = {}; this.sigs = {}; this.stats = {};
    this.entities = []; this.solids = [];
    this.surge = 0; this.tokens = 0; this.stopT = 0;
    this.cam = new THREE.Vector3();
    this.camFocus = null; this.cutscene = false; this.transitioning = false;
    this.checkpoint = { area: 'overworld', spawn: 'start' };
    this.timeScale = 1;
    // lights
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0015; this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6a5a3a, 1.2);
    this.scene.add(this.hemi);
    this.lamps = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffa24a, 0, 6, 1.6); this.scene.add(l); this.lamps.push(l); }
    this.playerLamp = new THREE.PointLight(0xffe0b0, 0, 5, 1.5); this.scene.add(this.playerLamp);
    this.liquidTime = { value: 0 };
    this.streamer = new WorldStreamer();
    this.res = 100;
    this.guide = new Guide(this);
    this.aimView = new AimView(this);
    applySettings(loadSettings(), this);
    this.recalc();
  }

  // ------------------------------------------------ RPG layer
  setClass(cls) {
    if (this.profile && this.profile.classId !== cls) throw new Error('Create another character to change class.');
    const inv = this.inv;
    inv.cls = cls;
    inv.equip.weapon = starterWeapon(cls);
    this.recalc(); inv.hp = inv.maxHp;
  }
  // skill-tree rank of a node for the current character (0 when not taken)
  talent(id) { return rankOf(this.inv, id); }
  fxBolt(x0, z0, x1, z1) { bolt(this, x0, z0, x1, z1); }
  recalc() {
    const inv = this.inv;
    ensureTree(inv);
    this.pstats = computeStats(inv);
    inv.maxHp = this.pstats.maxHp;
    inv.hp = Math.min(inv.hp, inv.maxHp);
    if (this.player && this.player.m.setGear) this.player.m.setGear(inv.equip);
    this.hudDirty = true;
  }
  // incoming damage multiplier and the largest share of max life one blow may take
  diffMult() { return { story: 0.7, normal: 1.3, hard: 1.8 }[this.settings.difficulty] || 1.3; }
  hitCap() { return { story: 0.3, normal: 0.4, hard: 0.55 }[this.settings.difficulty] || 0.4; }
  nameOf(e) {
    if (e.displayName) return e.displayName;
    if (e.isBoss) return 'Bramblemaw';
    if (e.boss) return 'Bramblemaw\'s spore pod';
    if (e.constructor && e.constructor.name === 'RootSpike') return 'Bramblemaw\'s root spike';
    const k = e.kind || (e.src && e.src.kind);
    return { blot: 'a Blotling', seedling: 'a Seedling', beetle: 'a Thornback', puffer: 'a Spore Puffer', wisp: 'a Hushwisp', knight: 'a Hush Knight', ...Object.fromEntries(Object.entries(MONSTER_NAMES).map(([a, b]) => [a, 'a ' + b])) }[k] || (e.from ? this.nameOf(e.from) : e.src ? this.nameOf(e.src) : 'the Hush');
  }
  zoneLevel(x, z) {
    const a = this.area;
    if (!a) return 1;
    if (a.id === 'dungeon') { const r = this.roomAt(x, z); return r && (r.id === 'pre' || r.id === 'boss' || r.id === 'heart') ? 5 : 4; }
    if (a.id === 'grotto') return 5;
    if (a.id === 'conservatory') { const r = this.roomAt(x, z); return r && (r.id === 'loom' || r.id === 'canopy' || r.id === 'reliquary') ? 8 : 7; }
    if (a.rift) return a.level;
    if (a.level) return a.level; // mini-dungeons carry their own
    if (a.placeAt) return a.placeAt(x, z).level || 2;
    const r = a.regions && a.regions.find(r => x >= r.x0 && x < r.x1 && z >= r.y0 && z < r.y1);
    return (r && r.level) || 2;
  }
  scaleEnemy(e, opts = {}) {
    const zl = this.zoneLevel(e.x, e.z);
    const pl = this.inv.level;
    e.level = Math.max(zl, Math.min(pl - 1, zl + 4));
    const mult = 6 * (1 + 0.3 * (e.level - 1));
    e.hp = e.hp * mult; e.maxHp = e.hp;
    e.xpValue = ({ blot: 6, seedling: 2, beetle: 14, puffer: 10, wisp: 8, knight: 40, scorpion: 14, imp: 12, wraith: 16, brigand: 20, sporeling: 4, treant: 60, golem: 80, thief: 50, mantis: 16, slug: 18, moth: 10, porcelain: 30, leech: 20 }[e.kind] || 6) * (1 + 0.15 * (e.level - 1));
    if (!opts.noElite && e.kind !== 'thief' && Math.random() < (opts.eliteChance ?? 0.07)) this.makeElite(e);
    return e;
  }
  makeElite(e) {
    const mods = ['Swift', 'Brutal', 'Vampiric', 'Armoured', 'Volatile', 'Resonant', 'Oathbound'];
    e.elite = mods[Math.floor(Math.random() * mods.length)];
    e.hp *= 3; e.maxHp = e.hp; e.xpValue *= 4;
    e.obj.scale.setScalar(1.35); e.eliteScale = 1.35;
    if (e.elite === 'Swift') e.speed *= 1.5;
    if (e.elite === 'Brutal') e.dmgMul = 1.6;
    if (e.elite === 'Armoured') e.dmgTaken = 0.6;
    const col = { Swift: 0x7ad8ff, Brutal: 0xff5a4a, Vampiric: 0xc4386a, Armoured: 0xc0c0d0, Volatile: 0xffb347, Resonant: 0xc46bff, Oathbound: 0xffd25e }[e.elite];
    e.auraColor = col;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; e.obj.add(ring); e.aura = ring;
    e.displayName = e.elite + ' ' + ({ blot: 'Blotling', beetle: 'Thornback', puffer: 'Puffer', wisp: 'Hushwisp', knight: 'Hush Knight', seedling: 'Seedling', ...MONSTER_NAMES }[e.kind] || 'Hushling');
  }
  // day/night, weather and biome mood for the overworld
  atmosphere(dt) {
    const a = this.area;
    const u = this.pr.postMat.uniforms;
    const phase = worldPhase(this.time, this.flags.dayOffset || 0);
    this.isNight = phase.isNight;
    if (a && a.glasshouse) {
      // the Conservatory: sun through cracked glass, pollen hanging in green-gold air
      waterU.light.value = 1; waterU.night.value = 0; waterU.rain.value = 0;
      u.fogAmt.value = 0.16; u.fogColor.value.set(0xd8e8c0); u.contrast.value = 1.06; u.bloom.value = 0.45; u.vignette.value = 0.45;
      u.grade.value.set(1.04, 1.04, 0.96); u.desat.value = 0;
      if (Math.random() < 0.5) this.fx.add({ x: this.cam.x + (Math.random() - 0.5) * 18, y: 0.5 + Math.random() * 2.5, z: this.cam.z + (Math.random() - 0.5) * 12, vx: 0.15, vy: -0.05, g: 0, drag: 0, color: Math.random() < 0.7 ? 0xfff3c8 : 0xc8f0a8, life: 3, size: 0.04, wob: 0.6, shrink: false });
      if (Math.random() < 0.06) { const x = this.cam.x + (Math.random() - 0.5) * 16, z = this.cam.z + (Math.random() - 0.5) * 10; for (let i = 0; i < 6; i++) this.fx.add({ x: x + i * 0.2, y: 3 - i * 0.4, z: z + i * 0.1, vy: -0.1, g: 0, drag: 0, color: 0xfff8e0, life: 1.6, size: 0.35, soft: true, grow: 1.2, shrink: false }); }
      this.lampTick(dt, 0);
      return;
    }
    if (!a || a.id !== 'overworld') {
      waterU.light.value = a && a.dark ? 0.75 : 1; waterU.night.value = 0; waterU.rain.value = 0;
      u.fogAmt.value = a && a.dark ? 0.2 : 0; u.fogColor.value.set(a && a.rift ? 0x3a2a5a : 0x1a1426); u.contrast.value = 1.04;
      this.lampTick(dt, 0.8);
      return;
    }
    const day = phase.fraction;
    this.dayT = day;
    const L = Math.max(0, Math.min(1, Math.sin((day - 0.2) * Math.PI * 2) * 1.4 + 0.45)); // 0 night .. 1 day
    const N = 1 - L;
    const warm = Math.max(0, 1 - Math.abs(L - 0.45) * 3); // dawn/dusk glow
    const dawn = day < 0.5 ? 1 : 0; // mornings run pink-gold, evenings amber-violet
    this.weatherT = (this.weatherT ?? 120) - dt;
    if (this.weatherT <= 0) { this.raining = !this.raining && Math.random() < 0.55; this.weatherT = this.raining ? 50 + Math.random() * 60 : 120 + Math.random() * 180; if (this.raining && !this.cutscene) this.ui.toast('Rain rolls in over Lanternreach…', '', 1.6); }
    this.rainK = (this.rainK || 0) + ((this.raining ? 1 : 0) - (this.rainK || 0)) * Math.min(1, dt * 0.5);
    const r = this.rainK;
    // biome mood from the region you stand in
    const reg = this.region ? this.region.name : '';
    const rid = this.region ? this.region.id : 'heartland';
    // Pass 6: every region has its own air (named places first, then the region)
    const MOOD = {
      'Thimblewick': { fog: 0xf6e2b8, amt: 0.12 }, 'Whisperwood': { fog: 0x9ac8a0, amt: 0.3 }, 'Sunscald Reach': { fog: 0xf8d8a0, amt: 0.26 },
      'Cinderpeak Foothills': { fog: 0xc86a4a, amt: 0.34 }, 'Hush Encampment': { fog: 0x8a7aa8, amt: 0.3 }, 'Lake Mirrow': { fog: 0xb8d8f0, amt: 0.3 },
      'Chime Gate': { fog: 0xe0e8f8, amt: 0.32 }, 'Saltwhistle Shore': { fog: 0xd8ecf4, amt: 0.22 },
    }[reg] || REGION_MOOD[rid] || { fog: 0xd0e0f0, amt: 0.18 };
    this.moodFog = this.moodFog || new THREE.Color(MOOD.fog);
    const nightFog = new THREE.Color(0x1a2448), rainFog = new THREE.Color(0x8a96a8);
    const tgt = new THREE.Color(MOOD.fog).lerp(nightFog, N * 0.85).lerp(rainFog, r * 0.5);
    if (warm > 0) tgt.lerp(new THREE.Color(dawn ? 0xffb0a0 : 0xffa060), warm * 0.35);
    this.moodFog.lerp(tgt, Math.min(1, dt * 1.5));
    u.fogColor.value.copy(this.moodFog);
    u.fogAmt.value += ((MOOD.amt + r * 0.2 + N * 0.12) - u.fogAmt.value) * Math.min(1, dt * 1.5);
    const lit = 0.22 + 0.78 * L;
    this.sun.intensity = 2.5 * lit * (1 - r * 0.45);
    this.sun.color.setRGB(1, 0.94 - warm * 0.22 - N * 0.2, 0.84 - warm * 0.4 + N * 0.25);
    this.hemi.intensity = (0.55 + 0.7 * L) * (1 - r * 0.2);
    this.hemi.color.setRGB(0.45 + 0.3 * L, 0.55 + 0.3 * L, 1.0);
    this.hemi.groundColor.setRGB(0.3 + 0.12 * L, 0.26 + 0.1 * L, 0.24 + 0.05 * N);
    this.scene.background.setRGB(0.06 + 0.5 * L - r * 0.1, 0.08 + 0.7 * L - r * 0.1, 0.2 + 0.7 * L - r * 0.05);
    const hush = this.flags.hushLifted ? 1 : 0;
    if (MOOD.dim) { this.sun.intensity *= MOOD.dim; this.hemi.intensity *= 0.5 + MOOD.dim * 0.5; }
    u.grade.value.set((hush ? 1.06 : 0.98) + warm * 0.1 - N * 0.3, (hush ? 1.03 : 0.96) - warm * 0.01 - N * 0.18, (hush ? 0.96 : 1.03) - warm * 0.1 + N * 0.12);
    u.desat.value = (hush ? 0 : 0.1) + r * 0.2 + N * 0.12;
    u.vignette.value = 0.4 + N * 0.5;
    u.bloom.value = 0.25 + N * 0.45;
    u.contrast.value = 1.06 + N * 0.04;
    if (MOOD.grade) { const k = MOOD.gradeK ?? 0.5; u.grade.value.x *= 1 + (MOOD.grade[0] - 1) * k; u.grade.value.y *= 1 + (MOOD.grade[1] - 1) * k; u.grade.value.z *= 1 + (MOOD.grade[2] - 1) * k; }
    this.playerLamp.intensity = N > 0.45 ? (N - 0.45) * 7 : 0;
    this.playerLamp.color.setHex(0xffd8a0);
    this.playerLamp.position.set(this.player.x, 1.4, this.player.z);
    // windows and lamps warm up as the light goes
    const glow = Math.max(0, Math.min(1, (N - 0.25) * 2 + r * 0.3));
    windowMat.color.setRGB(0.48 + 0.52 * glow, 0.72 + 0.1 * glow, 0.91 - 0.5 * glow).multiplyScalar(1 + glow * 0.4);
    lampMat.color.setRGB(0.54 + 0.46 * glow, 0.48 + 0.4 * glow, 0.35 + 0.2 * glow).multiplyScalar(1 + glow * 0.6);
    this.lampTick(dt, glow);
    waterU.light.value = 0.45 + 0.55 * L - r * 0.1; waterU.night.value = N > 0.55 ? 1 : 0; waterU.rain.value = r; waterU.sky.value.copy(this.scene.background).lerp(new THREE.Color(0xffffff), 0.25);
    // rain streaks and puddle splashes
    if (r > 0.05) for (let i = 0; i < 14 * r; i++) this.fx.add({ x: this.cam.x + (Math.random() - 0.5) * 26, y: 4 + Math.random() * 2, z: this.cam.z + (Math.random() - 0.5) * 20, vx: -1.5, vy: -18, g: 0, drag: 0, color: 0xb8d0f0, life: 0.28, size: 0.035, stretch: 5, shrink: false });
    if (r > 0.05 && Math.random() < r * 1.5) this.fx.add({ x: this.cam.x + (Math.random() - 0.5) * 22, y: 0.03, z: this.cam.z + (Math.random() - 0.5) * 16, vy: 0.8, g: 5, color: 0xdfe8ff, life: 0.22, size: 0.05 });
    // fireflies at night, butterflies and drifting seeds by day
    if (N > 0.55 && Math.random() < 0.35) this.fx.add({ x: this.cam.x + (Math.random() - 0.5) * 24, y: 0.4 + Math.random(), z: this.cam.z + (Math.random() - 0.5) * 18, vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4, g: 0, drag: 0, color: 0xd8ff8a, life: 2.5, size: 0.05, wob: 0.8 });
    if (L > 0.6 && r < 0.3 && Math.random() < 0.06) { const c = [0xffd25e, 0xf06a8a, 0x9ad8ff, 0xffffff][Math.floor(Math.random() * 4)]; this.fx.add({ x: this.cam.x + (Math.random() - 0.5) * 22, y: 0.4 + Math.random() * 0.6, z: this.cam.z + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 0.8, vz: (Math.random() - 0.5) * 0.6, vy: 0.05, g: 0, drag: 0, color: c, life: 4, size: 0.07, wob: 3, shrink: false }); }
    this.regionAir(rid, N, L, r);
    // Whisperwood sheds leaves
    if (reg === 'Whisperwood' && Math.random() < 0.25) this.fx.add({ x: this.cam.x + (Math.random() - 0.5) * 24, y: 2.5 + Math.random(), z: this.cam.z + (Math.random() - 0.5) * 18, vx: 0.4, vy: -0.35, g: 0, drag: 0, color: Math.random() < 0.5 ? 0xc8742a : 0x8aa83a, life: 6, size: 0.06, wob: 1.5, shrink: false });
    // once the Silent Toll is hung, Thimblewick rings the old toll at every dusk and dawn
    if (this.flags.tollHung && reg === 'Thimblewick') {
      this.tollT = (this.tollT ?? 6) - dt;
      if (this.tollT <= 0) { this.tollT = warm > 0.3 ? 9 : 26; playTone(57); setTimeout(() => playTone(64), 500); setTimeout(() => playTone(69), 1000); this.fx.ring(hx(53.5), hz(56.5), 0.3, 3, 0xffd25e, 1.2, 1.3); }
    }
    // chimney smoke (only near the camera)
    this.smokeT = (this.smokeT || 0) - dt;
    if (this.smokeT <= 0 && a.chimneys) {
      this.smokeT = 0.18;
      for (const c of a.chimneys) if (Math.abs(c.x - this.cam.x) < 14 && Math.abs(c.z - this.cam.z) < 11) this.fx.add({ x: c.x + (Math.random() - 0.5) * 0.1, y: c.y, z: c.z, vx: 0.25 + Math.random() * 0.1, vy: 0.45, vz: -0.05, g: 0, drag: 0.2, color: N > 0.6 ? 0x6a6a7a : 0xe8e4dc, life: 2.6, size: 0.09, grow: 2.4, shrink: false, soft: true });
    }
  }
  // Pass 6: what hangs in the air of each region
  regionAir(rid, N, L, rain) {
    const c = this.cam, R = Math.random, add = o => this.fx.add(o);
    const X = () => c.x + (R() - 0.5) * 24, Z = () => c.z + (R() - 0.5) * 18;
    switch (rid) {
      case 'cinderpeak': // embers rising from the cracks, ash coming down
        if (R() < 0.5) add({ x: X(), y: 0.2, z: Z(), vx: (R() - 0.5) * 0.3, vy: 0.9 + R(), g: 0, drag: 0, color: R() < 0.6 ? 0xff8a2a : 0xffc04a, life: 2.2, size: 0.04, wob: 0.8 });
        if (R() < 0.35) add({ x: X(), y: 4, z: Z(), vx: 0.3, vy: -0.4, g: 0, drag: 0, color: 0x8a8088, life: 7, size: 0.05, wob: 1.2, shrink: false });
        break;
      case 'highlands': // wind streaks, and a fleck of snow near the peaks
        if (R() < 0.3) add({ x: c.x - 13, y: 0.6 + R() * 2.5, z: Z(), vx: 9 + R() * 4, vy: 0, g: 0, drag: 0, color: 0xeef4ff, life: 2.4, size: 0.03, stretch: 6, shrink: false });
        if (R() < 0.25 && c.z < 45) add({ x: X(), y: 5, z: Z(), vx: 1.2, vy: -0.8, g: 0, drag: 0, color: 0xffffff, life: 6, size: 0.05, wob: 1.5, shrink: false });
        break;
      case 'sunscald': // drifting dust and the air shimmering off the flats
        if (R() < 0.25 && !rain) add({ x: X(), y: 0.2 + R() * 0.8, z: Z(), vx: 1.5 + R(), vy: 0.05, g: 0, drag: 0, color: 0xe8c890, life: 3, size: 0.04, wob: 0.6 });
        if (R() < 0.12 && L > 0.6) add({ x: X(), y: 0.1, z: Z(), vy: 0.6, g: 0, drag: 0, color: 0xfff0d0, life: 1.4, size: 0.25, soft: true, grow: 1.5, shrink: false });
        break;
      case 'moonfen': // low mist, and pale motes that only show after dark
        if (R() < 0.35) add({ x: X(), y: 0.15 + R() * 0.3, z: Z(), vx: 0.2, vy: 0.02, g: 0, drag: 0, color: 0xa8c0c0, life: 5, size: 0.45, soft: true, grow: 1.4, shrink: false });
        if (N > 0.5 && R() < 0.4) add({ x: X(), y: 0.3 + R(), z: Z(), vx: (R() - 0.5) * 0.3, vz: (R() - 0.5) * 0.3, g: 0, drag: 0, color: 0x7ad8ff, life: 3, size: 0.05, wob: 1 });
        break;
      case 'glassmere': // light glinting off broken panes
        if (R() < 0.3 && L > 0.4) add({ x: X(), y: 0.05, z: Z(), vy: 0, g: 0, drag: 0, color: 0xffffff, life: 0.25, size: 0.07 });
        if (R() < 0.06) add({ x: X(), y: 0.5 + R() * 2, z: Z(), vx: 0.15, vy: -0.05, g: 0, drag: 0, color: 0xc8f0a8, life: 3, size: 0.04, wob: 0.6, shrink: false });
        break;
      case 'lake': { // morning mist over the water
        const day = this.dayT || 0.5;
        if (R() < (day < 0.35 ? 0.4 : 0.08)) { const x = X(), z = Z(), t = this.tileAt(Math.floor(x), Math.floor(z)); if (t === T.WATER || t === T.DEEP) add({ x, y: 0.1, z, vx: 0.3, vy: 0.03, g: 0, drag: 0, color: 0xdfe8f0, life: 5, size: 0.5, soft: true, grow: 1.3, shrink: false }); }
        break;
      }
      case 'deepwood': // dust in the few shafts of light, leaves coming down
        if (R() < 0.2) add({ x: X(), y: 2.5 + R(), z: Z(), vx: 0.3, vy: -0.3, g: 0, drag: 0, color: R() < 0.5 ? 0x9a6a2a : 0x6a8a3a, life: 7, size: 0.06, wob: 1.4, shrink: false });
        if (L > 0.5 && R() < 0.15) add({ x: X(), y: 0.5 + R() * 2, z: Z(), vy: 0.05, g: 0, drag: 0, color: 0xfff3c8, life: 3, size: 0.03, wob: 0.4, shrink: false });
        break;
    }
  }
  // pool the scene's point lights onto the lamps and lit windows nearest the camera
  lampTick(dt, glow) {
    const a = this.area;
    if (a.dark || !a.lights || !a.lights.length || glow <= 0.02) { if (!a.dark) this.lamps.forEach(l => l.intensity = 0); return; }
    this.lampSort = (this.lampSort || 0) - dt;
    if (this.lampSort <= 0) { this.lampSort = 0.5; this.nearLights = a.lights.filter(l => Math.abs(l.x - this.cam.x) < 14 && Math.abs(l.z - this.cam.z) < 11).sort((p, q) => Math.hypot(p.x - this.cam.x, p.z - this.cam.z) - Math.hypot(q.x - this.cam.x, q.z - this.cam.z)); }
    const src = this.nearLights || [];
    this.lamps.forEach((l, i) => {
      const s = src[i];
      if (!s) { l.intensity = 0; return; }
      l.position.set(s.x, s.y || 0.9, s.z); l.color.setHex(0xffb060);
      l.intensity = glow * (s.kind === 'lamp' ? 5 : 2.6) * (1 + Math.sin(this.time * 9 + i * 2) * 0.06);
    });
  }
  worldTick(dt) {
    if (!this.area || this.area.id !== 'overworld' || this.locked()) return;
    this.wtT = (this.wtT || 0) - dt;
    if (this.wtT > 0) return;
    this.wtT = 2;
    const p = this.player;
    // respawn cleared overworld monsters once you're far away
    if (this.respawnQ) this.respawnQ = this.respawnQ.filter(r => {
      if (this.time < r.t || Math.hypot(r.def.x - p.x, r.def.z - p.z) < 22) return true;
      r.def._killed = false; if (!this.streamDefs || this.defActive(r.def)) this.spawnDef(r.def); return false;
    });
    // the fen: three rung lilies wake the Crowned Toad
    if (this.fenToad && this.fenToad.state === 'sleep' && this.signal('fen.rung') && Math.hypot(this.fenToad.x - p.x, this.fenToad.z - p.z) < 14) { this.setSignal('fen.rung', false, false); this.wakeToad(this.fenToad); }
    // chests only appear on the map once you've been near them (no spoilers)
    for (const e of this.entities) if (e instanceof LootChest && !this.flags['seenchest:' + e.id] && Math.hypot(e.x - p.x, e.z - p.z) < 9) this.flags['seenchest:' + e.id] = true;
    // roaming Pip Thief
    this.thiefT = (this.thiefT ?? 60) - 2;
    if (this.thiefT <= 0 && this.inv.level >= 2) {
      this.thiefT = 90 + Math.random() * 90;
      if (Math.random() < 0.55 && !this.entities.some(e => e.kind === 'thief' && !e.dead)) {
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * 6.28, x = p.x + Math.cos(a) * 9, z = p.z + Math.sin(a) * 9;
          const t = this.tileAt(Math.floor(x), Math.floor(z));
          if (t === T.GRASS || t === T.FLOWERS || t === T.PATH || t === T.SAND || t === T.FOREST) { this.spawnEnemy('thief', x, z, { noRoom: true }); this.ui.toast('A Pip Thief appeared!', 'Catch it before it escapes!', 2.5); sfx('secret'); break; }
        }
      }
    }
    this.world6Tick();
  }
  makeChampion(e) {
    if (!e.elite) this.makeElite(e);
    e.hp *= 2.5; e.maxHp = e.hp; e.xpValue *= 3; e.champion = true;
    e.obj.scale.setScalar(1.6); e.eliteScale = 1.6;
    e.displayName = 'Rift Champion · ' + e.displayName;
  }
  enterRift(floor) {
    this.riftFloor = floor;
    this.riftLevel = Math.max(2, this.inv.level) + Math.floor((floor - 1) * 0.8);
    this.flags.riftBest = Math.max(this.flags.riftBest || 0, floor - 1);
    this.warpTo('rift', 'entrance', () => { this.ui.banner('HUSH RIFT', 'Floor ' + floor + ' · Level ' + this.riftLevel, 2.4); });
  }
  riftCleared(d) {
    const f = this.riftFloor;
    this.flags.riftBest = Math.max(this.flags.riftBest || 0, f);
    this.gainXp(60 * f + 40 * this.riftLevel);
    this.spawn(new LootChest(this, { id: 'riftreward-' + Math.random(), x: d.x, z: d.z - 2, tier: 2, level: this.riftLevel + 1 }));
    if (f % 5 === 0) this.dropGear(d.x, d.z - 1, { level: this.riftLevel + 2, floor: 3, bonus: 1.5 });
    this.spawn(new RiftPortal(this, { x: d.x - 2.5, z: d.z + 1.5, next: true }));
    this.spawn(new RiftPortal(this, { x: d.x + 2.5, z: d.z + 1.5, next: false }));
    this.stats.riftFloors = (this.stats.riftFloors || 0) + 1;
    this.story.bountyEvent(['rift']);
    this.save();
  }
  // one player hit on one target: rolls damage, crits, procs, numbers
  playerHit(e, o) {
    const ps = this.pstats, p = this.player, inv = this.inv, U = ps.uniques;
    if (!e.isEnemy) { e.onHit && e.onHit({ dmg: 1, kind: o.kind, kb: o.kb, dir: o.dir, src: p }); return; }
    let dmg = (ps.wmin + Math.random() * (ps.wmax - ps.wmin)) * (o.mult ?? 1) * (1 + ps.dmgPct / 100);
    if (o.ability) dmg *= 1 + ps.abilityDmg / 100;
    const heavy = isHeavy(o), el = elementOf(o), S = e.status || {};
    if (U.has('onigrin') && inv.hp < inv.maxHp / 2) dmg *= 1.4;
    if (S.mark > 0) dmg *= 1.25;
    // Rime Bloom: a frozen foe shatters under the next blow
    if (S.freeze > 0 && inv.sigils && inv.sigils[0] === 'rimebloom' && inv.cls === 'witch') {
      dmg *= 1.6; S.freeze = 0; this.fx.burst(e.x, 0.5, e.z, 14, [0xdff4ff, 0xffffff], 3.5); sfx('parry');
    }
    // Echo attacks: the Echo Damage affix, Hollow Echo and the Echo Clapper
    if (o.echo) { dmg *= 1 + (ps.echoDmg || 0) / 100; if (U.has('echoclapper')) { dmg *= 1.2; e.stagger = Math.max(e.stagger || 0, 0.45); } }
    // skill tree, sets and accessories
    if (heavy) {
      const tough = e.elite || e.isBoss || e.poise || e.shell > 0;
      if (tough) dmg *= 1 + 0.15 * this.talent('sundering');
      if (ps.setBonus.bellwarden >= 2) { dmg *= 1.15; e.stagger = Math.max(e.stagger || 0, 0.35); }
      if (ps.setBonus.bellwarden >= 5 && !o.bellshock) { this.bellCount = (this.bellCount || 0) + 1; if (this.bellCount % 4 === 0) resonanceRing(this, e.x, e.z, 2.2, 1.5); }
      if (this.talent('resonantfury') && inv.cls === 'samurai') this.res = Math.min(100, this.res + 8);
    }
    if (el === 'fire' && this.talent('cinderheart')) dmg *= 1.35;
    if ((S.freeze > 0 || S.chill > 0) && this.talent('brittle')) dmg *= 1 + 0.1 * this.talent('brittle');
    if (S.root > 0 && U.has('briarbond')) dmg *= 1.15;
    if (S.wet > 0 && U.has('toadsignet')) dmg *= 1.15;
    // Pass 6 accessories
    if (S.wet > 0 && U.has('tidebell')) dmg *= 1.1;
    if (S.burn > 0 && U.has('wickring')) dmg *= 1.2;
    if (U.has('moonwellcenser') && this.isNight) dmg *= 1.15;
    if (U.has('kilnheart') && elementOf(o) === 'fire') dmg *= 1.25;
    // elemental reactions (wet+lightning, frozen+heavy, fire+wind ...)
    dmg = react(this, e, o, dmg);
    // Wax Seal engraving: a sealed foe cracks open under fire
    if (S.wax > 0 && el === 'fire' && hasEngraving(this, 'waxseal')) { dmg *= 1.5; S.wax = 0; this.fx.burst(e.x, 0.5, e.z, 12, [0xf0e0b0, 0xff8a2a], 3); sfx('wax'); this.ui.float(e.x, 1.35, e.z, 'SEAL BROKEN', '#f0e0b0', false, true); }
    // riposte: a parried foe is wide open — the first blow is a guaranteed crit, and all hits land harder
    let riposte = false;
    if (e.parried > 0) { dmg *= 1.5; if (!e.riposted) { e.riposted = true; riposte = true; } }
    if (U.has('candlewick') && S.burn > 0) dmg *= 1.2;
    const seam = U.has('seamripper') && (S.root > 0 || e.tether) && !o.ability;
    const thornstep = ps.setBonus.thornstalker >= 5 && this.thornstepT > this.time && !this.thornUsed;
    const crit = riposte || o.forceCrit || seam || thornstep || Math.random() * 100 < ps.crit + (o.critBonus || 0);
    if (thornstep && crit) this.thornUsed = true;
    let critDmg = ps.critDmg + (o.kind === 'lunge' ? 50 : 0);
    if (crit && this.talent('singlestroke')) critDmg += 60;
    if (crit) dmg *= 1 + critDmg / 100;
    dmg *= e.dmgTaken || 1;
    dmg = Math.max(1, Math.round(dmg));
    if (o.kind === 'surge' && e.isBoss) dmg = Math.max(1, Math.round(dmg)); // (surge unchanged vs bosses)
    const r = e.onHit({ dmg, kind: o.kind, kb: o.kb, dir: o.dir, src: o.src || p, crit, heavy });
    if (r !== 'hit') return r;
    if (heavy && !(this.impactT > this.time)) { this.impactT = this.time + 0.15; this.impact(e.x, e.z, 1.4, 0.8); }
    if (!o.noProc && !o.echo && !(this.procDepth > 0)) {
      const ready = key => !((this.lootProc || {})[key] > this.time);
      const lock = (key, seconds) => { (this.lootProc ||= {})[key] = this.time + seconds; };
      if (!o.ability && U.has('dawnbringer') && ready('dawn')) { lock('dawn',3); this.spawn(new Projectile(this,{x:p.x,z:p.z,dir:p.facing,speed:12,range:7,mult:.8,kind:'crescent',pierce:8,color:0xffd45a,noCraft:true,echo:true})); }
      if (!o.ability && U.has('heavensdivide') && ready('heaven')) { lock('heaven',4); for(let i=0;i<6;i++)this.spawn(new Projectile(this,{x:p.x,z:p.z,dir:i*Math.PI/3,speed:11,range:5,mult:.5,kind:'crescent',pierce:3,color:0x83dfff,noCraft:true,echo:true})); }
      if (!o.ability && U.has('starfallcrossbow') && ready('star') && Math.random()<.2) { lock('star',1); this.spawn(new Meteor(this,e.x,e.z,.65)); }
      if (crit && U.has('verdanteclipse') && ready('vine')) { lock('vine',4); for(let i=-1;i<=1;i++)this.spawn(new Projectile(this,{x:p.x,z:p.z,dir:p.facing+i*.4,speed:9,range:7,mult:.5,kind:'thorn',homing:3,root:1.5,color:0x66eeb6,noCraft:true,echo:true})); }
      if(o.ability && U.has('fateweaver') && Math.random()<.2 && !e.dead) { this.procDepth=(this.procDepth||0)+1; try { this.playerHit(e,{...o,mult:(o.mult??1)*.5,noProc:true,echo:true}); } finally { this.procDepth--; } }
    }
    this.guide.event('attack');
    e.hpShow = 3;
    if (!o.quiet || crit) this.ui.float(e.x, 1.0 + (e.eliteScale ? 0.3 : 0), e.z, (crit ? '' : '') + dmg + (crit ? '!' : ''), crit ? '#ffd25e' : '#ffffff', crit);
    if (crit) { sfx('crit'); if (e.elite || e.isBoss) { sfx('weakpoint'); this.fx.ring(e.x, e.z, 0.05, 0.6, 0xffd25e, 0.18, 0.6); } }
    if (U.has('teaspoon') && !o.ability) sfx('bonk');
    // Wither Hex stores what the cursed foe suffers
    if (e.hexed) e.hexStore = (e.hexStore || 0) + dmg;
    // Briar Tether: the stitched foes share the pain
    if (e.tether && !o.shared) {
      const T = e.tether;
      for (const m of T.members) if (m !== e && !m.dead) { const n = Math.max(1, Math.round(dmg * T.share)); m.onHit({ dmg: n, kind: 'thorn', kb: 0, dir: o.dir, src: p, shared: true }); this.ui.float(m.x, 1.0, m.z, '' + n, '#7fd36a', false, true); }
    }
    // life steal draws from a small pool that refills over time: strong, but it can't make a
    // crowd-clearing build immortal
    if (!o.noProc && (ps.lifesteal || (U.has('onigrin') && inv.hp < inv.maxHp / 2))) {
      const want = dmg * ((ps.lifesteal || 0) + (U.has('onigrin') && inv.hp < inv.maxHp / 2 ? 6 : 0)) / 100;
      const got = Math.min(want, this.lsPool || 0);
      if (got > 0) { this.lsPool -= got; this.heal(got, true); }
    }
    // Ki: a samurai's own blades build it with every hit (the specialist perk)
    if (inv.cls === 'samurai' && !o.ability && ps.specialist && (ps.family === 'blade' || ps.family === 'heavy')) {
      if (this.talent('singlestroke')) { if (crit) this.res = Math.min(100, this.res + 10); }
      else this.res = Math.min(100, this.res + 7);
    }
    p.combatT = 4;
    if (crit) {
      if (U.has('quickthread')) { this.quickStacks = Math.min(5, (this.quickT > this.time ? this.quickStacks || 0 : 0) + 1); this.quickT = this.time + 3; }
      if (ps.setBonus.thornstalker >= 5 && !(this.thornstepT > this.time)) { this.thornstepT = this.time + 2; this.thornUsed = false; this.fx.burst(p.x, 0.3, p.z, 8, [0x7fd36a, 0x3a6a2a], 2); }
    }
    if (!o.noProc && !e.dead) {
      if (o.forceBurn || Math.random() * 100 < ps.burn || (U.has('candlewick') && o.kind === 'bolt') || (U.has('wickblade') && !o.ability)) e.applyStatus && e.applyStatus('burn', 3, dmg * 0.15 * (this.talent('cinderheart') ? 2 : 1));
      if (Math.random() * 100 < ps.chill) e.applyStatus && e.applyStatus('chill', 2.5);
      if (!o.noShock && Math.random() * 100 < ps.shock) { chainLightning(this, e.x, e.z, 0.5, 2, 4); if (this.talent('staticfocus')) this.res = Math.min(100, this.res + 3); }
      if (U.has('rootcleaver') && Math.random() < 0.25) thornBurst(this, e.x, e.z, 0.7);
      if (crit && U.has('huntermoon')) e.applyStatus && e.applyStatus('mark', 4);
      if (crit && U.has('silentdawn') && p.cdMap.iaido) p.cdMap.iaido *= 0.6;
      if (U.has('toadsignet') && (el === 'lightning' || heavy)) soak(this, e.x, e.z, 1.8, 3);
      // engravings from the new content
      if (!o.ability && hasEngraving(this, 'seamstitch') && !e.tether && Math.random() < 0.2) { const n = this.entities.filter(x => x.isEnemy && !x.dead && x !== e && !x.tether && !x.isBoss && Math.hypot(x.x - e.x, x.z - e.z) < 3.5).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0]; if (n) this.spawn(new Tether(this, [e, n], 0.8, 0.3, 3)); }
      if (!o.ability && S.burn > 0 && hasEngraving(this, 'waxseal') && !(S.wax > 0)) { e.applyStatus('wax', 3); e.applyStatus('chill', 3); }
      if (!o.ability && !o.bellshock && hasEngraving(this, 'tollring')) { this.tollN = (this.tollN || 0) + 1; if (this.tollN % 5 === 0) { const x = e.x, z = e.z; this.fx.ring(x, z, 0.2, 1.6, 0xe0b860, 0.35); sfx('resonate'); for (const m of this.entities) if (m.isEnemy && !m.dead && Math.hypot(m.x - x, m.z - z) < 1.6 + (m.r || 0.3)) { m.stagger = Math.max(m.stagger || 0, 0.5); this.playerHit(m, { mult: 1.0, kind: 'resonance', bellshock: true, kb: 4, dir: Math.atan2(m.x - x, m.z - z), noProc: true, quiet: true }); } } }
      // Cinderwoven: abilities set foes alight; burning foes pulse fire (once per second)
      if (o.ability && ps.setBonus.cinderwoven >= 5) {
        if (S.burn > 0 && !(e.cinderT > this.time)) { e.cinderT = this.time + 1; blast(this, e.x, e.z, 1.3, 0.6, 0xff8a2a, { ability: false, burn: false, element: 'fire' }); }
        e.applyStatus && e.applyStatus('burn', 2.5, dmg * 0.1);
      }
      // qualitative affixes (Relic, Mythic and Prismatic stat rolls)
      if (ps.qual.has('resonance_echo') && !o.ability && !o.echo && !(e.echoT > this.time)) { e.echoT = this.time + 0.8; const tgt = e, m = o.mult ?? 1; setTimeout(() => { if (!tgt.dead && this.area) { this.fx.ring(tgt.x, tgt.z, 0.1, 0.7, 0xe040fb, 0.25); this.playerHit(tgt, { mult: m * 0.4, kind: 'echo', echo: true, kb: 1, dir: 0, noProc: true }); } }, 800); }
      if (crit && ps.qual.has('prismatic_splinters') && !o.splinter) { for (let i = 0; i < 3; i++) this.spawn(new Projectile(this, { x: e.x, z: e.z, dir: Math.random() * 6.28, speed: 12, range: 5, mult: 0.35, kind: 'thorn', seek: { cone: 1.2, rate: 6, range: 5 }, color: [0xff5a8a, 0xffd700, 0x7ad8ff][i], noSplit: true, noCraft: true })); }
      if (ps.qual.has('executioners_toll') && e.hp > 0 && e.hp < e.maxHp * 0.2 && !(e.tollT > this.time)) { e.tollT = this.time + 1; const n = Math.round(e.maxHp * (e.isBoss ? 0.03 : 0.15)); sfx('resonate'); this.fx.ring(e.x, e.z, 0.2, 1.2, 0xffd700, 0.4); e.onHit({ dmg: n, kind: 'toll', kb: 0, dir: 0, src: p }); this.ui.float(e.x, 1.4, e.z, 'TOLL ' + n, '#ffd700', true); }
    }
    return r;
  }
  gainXp(n) {
    const inv = this.inv;
    if (inv.level >= MAX_LEVEL) return;
    n = Math.max(1, Math.round(n * (1 + this.pstats.xpPct / 100)));
    inv.xp += n;
    this.hudDirty = true;
    while (inv.level < MAX_LEVEL && inv.xp >= xpNeed(inv.level)) {
      inv.xp -= xpNeed(inv.level); inv.level++; inv.sp++;
      const before = new Set(Object.keys(inv.tree || {}));
      this.recalc(); inv.hp = inv.maxHp; this.res = 100;
      const freeNew = treeOf(inv.cls).find(n => n.skill && n.free && !before.has(n.id) && inv.tree[n.id]);
      const unlocked = freeNew ? { name: SKILLS[freeNew.skill].name, key: (inv.loadout.indexOf(freeNew.skill) + 1) || '—', desc: SKILLS[freeNew.skill].desc } : null;
      const p = this.player;
      this.fx.ring(p.x, p.z, 0.3, 3, 0xffd25e, 0.7); this.fx.burst(p.x, 0.5, p.z, 30, [0xffd25e, 0xffffff], 3, { g: -1 });
      sfx('fanfare'); this.pr.addFlash(0.25, 0xffd25e);
      this.ui.banner('LEVEL UP', 'Level ' + inv.level, 2.2);
      this.ui.toast(unlocked ? 'New ability: ' + unlocked.name + ' [' + unlocked.key + ']' : '+1 Skill Point', unlocked ? unlocked.desc : 'Press K to spend it in your skill tree.', 3);
      this.save();
    }
  }
  bagCapacity() {return bagCapacity(this.inv);}
  pickupItem(it) {
    const inv = this.inv;
    if (inv.bag.length >= this.bagCapacity()) return false;
    identifyItem(it, this.profile?.id);
    if ([...inv.bag, ...Object.values(inv.equip).filter(Boolean)].some(held => held.itemInstanceId === it.itemInstanceId)) return false;
    inv.bag.push(it);
    const R = RARITY[it.r];
    sfx(it.r >= 2 ? 'pipbig' : 'pip');
    const up = it.cls && it.cls !== inv.cls ? '' : (itemPower(it) > itemPower(inv.equip[it.slot]) ? ' ▲' : '');
    this.ui.lootToast(it, up);
    this.guide.event('loot');
    this.stats.items = (this.stats.items || 0) + 1;
    if (!this.flags.tutLoot && this.area.id !== 'devroom') { this.flags.tutLoot = true; setTimeout(() => this.ui.toast('You found gear!', 'Press E to open your bag and equip it.', 3.5), 600); }
    this.hudDirty = true;
    this.save();
    return true;
  }
  // Every class can wield every weapon; off-class weapons scale at 80% (see gear.js).
  canEquip(it) { return !!it; }
  isOffClass(it) { return !!(it && it.cls && it.cls !== this.inv.cls); }
  // rings go to the first free ring finger (or replace ring 1)
  equipSlotFor(it) { if (it.slot !== 'ring') return it.slot; const e = this.inv.equip; return !e.ring1 ? 'ring1' : !e.ring2 ? 'ring2' : (this.ringSwap = !this.ringSwap) ? 'ring1' : 'ring2'; }
  equipItem(i, slotOverride) {
    const inv = this.inv, it = inv.bag[i];
    if (!it) return;
    if (!this.canEquip(it)) { sfx('error'); return; }
    const slot = slotOverride || this.equipSlotFor(it);
    const old = inv.equip[slot];
    if(old?.unique==='wayfarersatchel'&&it.unique!=='wayfarersatchel'&&inv.bag.length>30){this.ui.toast('Make room first','Satchel needs two free spaces before replacing it.');return;}
    inv.equip[slot] = it;
    this.lastEquip = { slot, t: performance.now() };
    inv.bag.splice(i, 1);
    if (old) inv.bag.splice(i, 0, old);
    sfx('unlock');
    this.guide.event('equip');
    this.recalc();
    this.save();
  }
  isLocked(it) { return !!(it && (this.inv.lockedItems || []).includes(it.itemInstanceId)); }
  toggleLock(it) {
    if (!it) return;
    const L = this.inv.lockedItems || (this.inv.lockedItems = []), i = L.indexOf(it.itemInstanceId);
    if (i >= 0) L.splice(i, 1); else L.push(it.itemInstanceId);
    sfx('select'); this.save();
  }
  salvageItem(i) {
    const inv = this.inv, it = inv.bag[i];
    if (!it) return;
    if (this.isLocked(it)) { sfx('error'); this.ui.toast('That item is locked.', 'Press V (or click Favourite) to unlock it first.', 1.6); return; }
    if (it.craft) { sfx('error'); this.ui.toast('That weapon carries an engraving.', 'Move the engraving at the workbench first, or equip and salvage it later.', 2); return; }
    inv.bag.splice(i, 1);
    const v = Math.max(1, Math.round(it.value * 0.35));
    const sh = [0, 1, 2, 4, 8][it.r] || 0;
    this.addCoins(v); sfx('pip');
    if (sh) { ensureCraftState(inv); inv.mats.shard += sh; }
    this.ui.toast('Salvaged ' + it.name, '+' + v + ' pips' + (sh ? ` · +${sh} Hush Shard${sh > 1 ? 's' : ''}` : ''), 1.2);
  }
  dropGear(x, z, o = {}) {
    const it = genItem({ level: o.level || this.inv.level, cls: Math.random() < 0.75 ? this.inv.cls : null, mf: this.pstats.mf, floor: o.floor || 0, bonus: o.bonus || 0 });
    this.spawn(new GearDrop(this, x, z, it));
  }

  // ------------------------------------------------ state
  signal(name) { if (!name) return false; return this.sigs[name] ?? !!this.flags['sig:' + name]; }
  setSignal(name, v, persist) { if (persist) this.flags['sig:' + name] = v; else this.sigs[name] = v; }
  tileAt(x, y) { const a = this.area; if (x < 0 || y < 0 || x >= a.w || y >= a.h) return T.CLIFF; return a.tiles[y * a.w + x]; }
  setTile(x, y, t) { this.area.tiles[y * this.area.w + x] = t; this.tilesDirty = true; }
  locked() { return this.cutscene || this.ui.talking || this.transitioning; }
  hitstop(t) { this.stopT = Math.max(this.stopT, t); }
  addSurge(n) { if (this.pstats && this.pstats.uniques.has('firstchime')) n *= 2; if (this.pstats && this.pstats.surgeGain) n *= this.pstats.surgeGain; const was = this.surge; this.surge = Math.min(100, this.surge + n); if (was < 100 && this.surge >= 100) { sfx('charged'); this.ui.toast('BELL SURGE ready!', 'Press R', 1.4); } this.hudDirty = true; }
  addCoins(n) { this.inv.coins = Math.min(9999, this.inv.coins + n); this.hudDirty = true; }
  heal(n, quiet) { if (n <= 0) return; const before = this.inv.hp; const over = before + n - this.inv.maxHp;
    // Vital Dewdrop (qualitative affix): meaningful overheal condenses into a dewdrop nearby
    if (over > this.inv.maxHp * 0.08 && this.pstats.qual.has('vital_dewdrop') && this.player && !(this.dewT > this.time)) { this.dewT = this.time + 5; const a = Math.random() * 6.28; this.spawn(new Pickup(this, this.player.x + Math.cos(a) * 1.4, this.player.z + Math.sin(a) * 1.4, 'heart')); }
    this.inv.hp = Math.min(this.inv.maxHp, this.inv.hp + n); if (!quiet && this.player && this.inv.hp - before >= 1) this.ui.float(this.player.x, 1.1, this.player.z, '+' + Math.round(this.inv.hp - before), '#7fd36a'); this.ui.hearts(!quiet); }
  gainHeartContainer(silent) {
    this.inv.vessels = (this.inv.vessels || 0) + 1; this.recalc(); this.inv.hp = this.inv.maxHp; this.ui.hearts(true);
    if (!silent) { sfx('fanfare'); this.ui.toast('Heart Vessel!', 'Your life grows by one heart.', 2.4); }
    this.save();
  }
  canDrink() {
    const inv = this.inv;
    if (inv.potions <= 0) { sfx('error'); this.ui.toast('No tonics left.', 'Rest at a Bellstone to refill them.', 1.4); return false; }
    if (inv.hp >= inv.maxHp) { sfx('error'); this.ui.toast('Already at full health.', '', 1); return false; }
    return true;
  }
  drinkPotion() {
    const inv = this.inv;
    if (inv.potions <= 0) return;
    inv.potions--; this.heal(inv.maxHp * 0.45); sfx('potion');
    this.fx.burst(this.player.x, 0.6, this.player.z, 16, [0xff6a7a, 0xffffff], 2, { g: -1 });
    this.hudDirty = true;
  }

  async save() {
    if (!this.profile || !this.characterSession) return false;
    try {
      await this.characterSession.save(snapshotCharacter(this));
      this.profile.revision = this.characterSession.profile.revision;
      return true;
    } catch (error) {
      this.ui.toast('Progress could not be saved', error.message, 6);
      return false;
    }
  }
  async load(id) {
    const profiles = await this.saveProvider.loadCharacters();
    const profile = profiles.find(p => p.id === id) || (!id && profiles[0]);
    if (!profile) throw new Error('Character not found.');
    if (!BUILDERS[profile.world.checkpoint.area]) throw new Error('This character needs an unavailable area. Original save retained.');
    restoreCharacter(this, profile);
    this.characterSession = new CharacterSession(this.saveProvider, profile);
    this.isNight = worldPhase(this.time, this.flags.dayOffset || 0).isNight; // valid before the first frame
    ensureCraftState(this.inv);
    this.recalc(); this.inv.hp = this.inv.maxHp;
    return true;
  }
  async createCharacter(name, cls) {
    const inv = defaultInv(cls);
    inv.equip.weapon = starterWeapon(cls);
    const profile = await this.saveProvider.createCharacter({ name, classId: cls, inventory: inv });
    await this.load(profile.id);
  }
  async respec() {
    respecTree(this.inv); // refunds every bought tree rank exactly once
    respecInventory(this.inv, CLASSES[this.inv.cls].abilities); // stat points (skills already at base)
    this.recalc();
    return this.save();
  }
  // A future Bellstone menu can use this list and guarded hook without world-art edits.
  unlockedBellstones() { return BELLSTONES.filter(b => this.discoveredBellstones.includes(b.id)); }
  bellstoneName(id) { return BELLSTONE_NAMES[id] || id; }
  travelToBellstone(id) {
    const target = this.unlockedBellstones().find(b => b.id === id);
    const atStone = this.entities.some(e => e instanceof O.Bellstone && Math.hypot(e.x - this.player.x, e.z - this.player.z) < 2);
    if (!target || !atStone || this.dead || this.player.state === 'dead' || this.player.combatT > 0 || this.locked()) return false;
    this.warpTo(target.area, target.spawn); return true;
  }

  // ------------------------------------------------ areas
  loadArea(id, spawn) {
    // clear
    for (const e of this.entities) if (e.obj.parent) e.obj.parent.remove(e.obj);
    this.scene.remove(this.world);
    this.world.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.fx.clear();
    this.ui.clearFloats && this.ui.clearFloats();
    this.entities = []; this.solids = []; this.sigs = {}; this.tokens = 0; this.fenToad = null;
    this.bossActive = null; this.ui.bossBar(null);
    const area = id === 'rift' ? buildRift(this.riftFloor || 1, this.riftLevel || 3, Math.floor(Math.random() * 1e9)) : BUILDERS[id]();
    this.area = area;
    this.world6Prepare(area); // the character's seeded optional content
    // the ground is streamed in chunks around the camera (see world/stream.js)
    this.streamer.reset(area, this.world, this.liquidTime);
    // lights & mood
    this.scene.background = new THREE.Color(area.sky);
    this.sun.color.set(area.sun); this.sun.intensity = area.dark ? 1.0 : 2.3;
    this.hemi.color.set(area.dark ? 0xa89ad0 : 0xbfd8ff); this.hemi.groundColor.set(area.dark ? 0x3a3040 : 0x6a5a3a);
    this.hemi.intensity = area.dark ? 1.5 : 1.25;
    this.playerLamp.intensity = area.dark ? 3 : 0;
    if (area.rift) { this.hemi.intensity = 2.3; this.hemi.color.set(0xc8b0ff); this.sun.intensity = 1.4; this.playerLamp.intensity = 5; }
    this.fx.setAmbient(id === 'overworld' ? 'pollen' : 'motes');
    this.baseVH = area.dungeon ? 13.2 : 12; this.camZoom = 1;
    this.pr.setViewHeight(this.baseVH * ((this.settings && this.settings.zoom) || 1));
    this.updateGrade();
    // player
    const sp = typeof spawn === 'object' ? spawn : area.spawns[spawn] || Object.values(area.spawns)[0];
    this.player = new Player(this, sp.x, sp.z);
    this.inv.areaBoon=this.flags['boon:'+id]||null; this.recalc();
    this.player.facing = area.dungeon ? Math.PI : 0;
    this.spawn(this.player);
    // entities: small areas spawn everything; the overworld streams its scenery-level defs
    this.streamDefs = null;
    if (area.w * area.h > 20000) {
      const C = 16, cells = new Map();
      for (const d of area.defs) {
        if (d.x === undefined || !STREAMED.has(d.type)) { this.spawnDef(d); continue; }
        d._ent = null;
        const k = Math.floor(d.x / C) + ',' + Math.floor(d.z / C);
        (cells.get(k) || cells.set(k, []).get(k)).push(d);
      }
      this.streamDefs = { C, cells, active: new Set(), t: 0 };
      this.streamTick(0, true);
    } else for (const d of area.defs) this.spawnDef(d);
    for (const e of this.entities) if (e instanceof O.Torch && e.puzzle && !this._tg?.[e.group]) { (this._tg = this._tg || {})[e.group] = true; const tg = new O.TorchGroup(this, e.group); tg.alwaysUpdate = true; this.spawn(tg); }
    this._tg = null;
    this.room = null;
    this.updateRoom(true);
    clipUniform.value = this.room ? this.room.z1 - 1 : 1e9;
    this.snapCamera();
    this.cam.y = this.player.gy || 0;
    { const v = this.viewExtent(); this.streamer.update(this.cam.x, this.cam.z, v.hw, v.hd, Infinity); }
    this.warmShaders(area);
    this.music = null; this.musicOvr = null;
    this.region = null;
    this.updateRegion(true);
    this.ui.updateHud();
    this.guide.render();
    this.bell = this.entities.find(e => e instanceof O.Bell);
    if (this.flags.deathDrop && this.flags.deathDrop.area === id) this.spawn(new DeathCache(this, this.flags.deathDrop));
    if (area.id === 'dungeon' && this.flags.bossKilled && !this.inv.chimes.includes('verdant')) this.spawnChime();
  }
  spawnDef(d) {
    const f = this.flags;
    let e;
    switch (d.type) {
      case 'chest': e = new O.Chest(this, d); break;
      case 'door': e = new O.Door(this, d); break;
      case 'crate': e = new O.Crate(this, d); break;
      case 'block': e = new O.Block(this, d); break;
      case 'switch': e = new O.Switch(this, d); if (this.area.defs.some(x => x.type === 'leafpile' && x.x === d.x && x.z === d.z) && !f['pile:' + this.area.id + ':' + d.x + ',' + d.z]) e.covered = true; break;
      case 'switchgroup': e = new O.SwitchGroup(this, d); e.alwaysUpdate = true; break;
      case 'pinwheel': e = new O.Pinwheel(this, d); break;
      case 'pingroup': e = new O.PinGroup(this, d); e.alwaysUpdate = true; break;
      case 'torch': e = new O.Torch(this, d); break;
      case 'leafpile': e = new O.LeafPile(this, d); if (e.dead) return; break;
      case 'bush': e = new O.Bush(this, d); break;
      case 'tuft': e = new O.Tuft(this, d); break;
      case 'drift': e = new O.Drift(this, d); if (e.dead) return; break;
      case 'boulder': e = new O.Boulder(this, d); break;
      case 'sign': e = new O.Sign(this, d); break;
      case 'lootchest': e = new LootChest(this, d); break;
      case 'riftarena': e = new O.Arena(this, { id: d.id, room: d.room }, d.waves, { title: d.last ? 'RIFT CHAMPION' : 'HUSH RIFT', victory: d.last ? 'The floor is cleansed.' : 'Room cleared.', noPersist: true, eliteChance: 0.1 + this.riftFloor * 0.02, onClear: d.last ? () => this.riftCleared(d) : null }); e.alwaysUpdate = true; break;
      case 'riftportal': e = new RiftPortal(this, d); break;
      case 'riftstone': e = new O.Sign(this, { ...d, text: '' }); e.obj.visible = false; e.solid = false; e.interact = () => this.story.riftStone(); Object.defineProperty(e, 'prompt', { get: () => 'Touch the Rift Stone' }); break;
      case 'board': e = new O.Sign(this, { ...d, text: '' }); e.interact = () => this.story.board(); Object.defineProperty(e, 'prompt', { get: () => 'Bounties' }); e.obj.visible = false; e.solid = false; break;
      case 'npc': if (d.requires && !f[d.requires]) return; e = new O.NPC(this, d.id === 'oswin' && f.tollHung ? { ...d, x: hx(54.5), z: hz(58.4) } : d); break;
      case 'bellstone': e = new O.Bellstone(this, d); break;
      case 'workbench': e = new O.Workbench(this, d); break;
      case 'millyard': if (f.q_mill !== 2) return; e = new O.MillYard(this, d); break;
      case 'bell': e = new O.Bell(this, d); break;
      case 'gate': e = new O.Gate(this, d); break;
      case 'windmill': e = new O.Windmill(this, d); break;
      case 'roots': e = new O.Roots(this, d); break;
      case 'exitglow': e = new O.ExitGlow(this, d); break;
      case 'warp': e = new O.Warp(this, d); e.alwaysUpdate = true; break;
      case 'enemy': {
        if (this.area.id === 'overworld' && f.hushLifted && d.x < hx(44) && d.x > HEART.x && Math.random() < 0.5) return;
        if (d._killed) return;
        e = makeEnemy(this, d.kind, d.x, d.z); e.spawnT = 0; e.obj.scale.setScalar(1); e.room = d.room; e.def = d; this.scaleEnemy(e); if (e.eliteScale) e.obj.scale.setScalar(e.eliteScale); break;
      }
      case 'arena': e = new O.Arena(this, d, [
        [['blot', -3, -2], ['blot', 3, -2], ['blot', 0, -3], ['blot', -3, 2], ['blot', 3, 2]],
        [['blot', -4, 0], ['blot', 4, 0], ['blot', 0, 3], ['puffer', -5, -3], ['puffer', 5, -3]],
        [['beetle', 0, -3], ['blot', -4, 2], ['blot', 4, 2], ['blot', 0, 3]],
      ], { title: 'THORNHALL', victory: 'Something stirs on the pedestal…' }); e.alwaysUpdate = true; break;
      case 'camp': e = new O.Arena(this, { id: 'camp', x: d.x, z: d.z, radius: 5.5 }, [
        [['blot', -3, -2], ['blot', 3, -2], ['blot', 0, -4], ['blot', -4, 1], ['blot', 4, 1], ['blot', 0, 3]],
        [['blot', -4, -2], ['blot', 4, -2], ['blot', -2, 3], ['blot', 2, 3], ['puffer', -5, -4], ['puffer', 5, -4]],
        [['beetle', -3, -3], ['beetle', 3, -3], ['blot', -4, 2], ['blot', 4, 2], ['blot', 0, 4], ['wisp', 0, -4]],
        [['knight', 0, -4], ['blot', -4, 0], ['blot', 4, 0], ['blot', -2, 3], ['blot', 2, 3], ['puffer', 0, 4]],
      ], { title: 'HUSH CAMP', victory: 'The camp is broken! Report to Captain Brisk.', music: 'camp' }); e.alwaysUpdate = true; break;
      case 'bossroom': e = new Entity(this, d.x, d.z); e.bossRoom = d; e.alwaysUpdate = true; e.update = () => this.checkBossRoom(d); break;
      case 'custom_entity': if (d.factory) e = d.factory(this); break;
      // ---- Pass 5
      case 'hangbell': e = new HangingBell(this, d); break;
      case 'tollrack': if (!f.tollHung) return; e = new TollRack(this, d); break;
      case 'bellseq': e = new BellSequence(this, d); break;
      case 'crackedglass': e = new CrackedGlass(this, d); break;
      case 'conservatoryarena': e = new O.Arena(this, { id: d.id, room: d.room }, [
        [['mantis', -3, -2], ['moth', 3, -2], ['slug', 0, 3]],
        [['porcelain', 0, -3], ['mantis', -4, 1], ['mantis', 4, 1]],
        [['leech', 0, 0], ['moth', -3, -3], ['moth', 3, -3], ['porcelain', 0, 3]],
      ], { title: 'ORCHID GALLERY', victory: 'The orchids go quiet.', eliteChance: 0.12 }); e.alwaysUpdate = true; break;
      case 'seamroom': if (f.seamDead) return; e = new BossTrigger(this, { ...d, flag: 'seamDead', start: (g, dd) => g.startSeamkeeper(dd) }); break;
      case 'crowntoad': {
        // rare, not random: it sleeps here until the lilies ring, and comes back two days after a defeat
        if (f.toadAt !== undefined && this.time - f.toadAt < 840) return;
        e = new CrownedToad(this, d.x, d.z); e.alwaysUpdate = true; this.fenToad = e;
        break;
      }
      default: e = this.spawnDef6(d); if (!e) return; break;
    }
    if (e) { if (d.room) e.room = d.room; e.sdef = d; d._ent = e; this.spawn(e); }
    return e;
  }
  spawn(e) {
    if (!e.obj.parent) e.attach();
    this.entities.push(e);
    return e;
  }
  spawnEnemy(kind, x, z, opts = {}) {
    // find a free tile near (x,z)
    let px = x, pz = z;
    for (let r = 0; r < 4; r++) {
      const t = this.tileAt(Math.floor(px), Math.floor(pz));
      if (t !== T.PIT && !blocksObject(t) && t !== T.WATER && t !== T.DEEP) break;
      px = x + (Math.random() - 0.5) * r * 2; pz = z + (Math.random() - 0.5) * r * 2;
    }
    const e = makeEnemy(this, kind, px, pz, opts);
    this.scaleEnemy(e, { noElite: kind === 'seedling', eliteChance: opts.eliteChance });
    if (opts.aggro) { e.aggro = opts.aggro; e.state = e.kind === 'puffer' ? 'aim' : e.kind === 'wisp' ? 'hover' : 'chase'; }
    if (this.room && !opts.noRoom) e.room = this.room.id;
    this.spawn(e);
    this.fx.burst(px, 0.3, pz, 12, [0x2a1a3a, 0x8b5cf6], 2.5, { g: -1, life: 0.6 });
    sfx('spawn');
    return e;
  }
  warpTo(id, spawn, cb) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.ui.fade(true);
    setTimeout(() => {
      this.loadArea(id, spawn);
      if (id !== 'rift') this.checkpoint = { area: id, spawn: typeof spawn === 'string' ? spawn : this.checkpoint.spawn };
      if (id === 'overworld' && spawn === 'start') this.checkpoint.spawn = 'village';
      this.save();
      this.ui.fade(false);
      this.ui.areaName(this.area.name);
      setTimeout(() => { this.transitioning = false; cb && cb(); }, 350);
    }, 380);
  }
  respawnPoint() {
    if (this.area.dungeon && this.roomEntry) return this.roomEntry;
    return this.player.lastSafe;
  }
  onPlayerDeath() {
    if(this.pstats.uniques.has('phoenixfeather')&&!this.flags.phoenixSpent){this.flags.phoenixSpent=true;this.inv.hp=Math.ceil(this.inv.maxHp*.4);this.player.setState('move');this.player.invuln=2;this.ui.toast('The feather burns','40% health restored. Recharges after a normal death.');this.save();return;}
    sfx('hurt');
    this.ui.bossBar(null);
    this.stats.deaths = (this.stats.deaths || 0) + 1;
    // Souls-lite: half the pips you carry fall where you fell. Get back there to pick them up;
    // fall again first and that older pile is gone. Gear, materials and progress are never lost.
    const old = this.flags.deathDrop;
    const lostOld = old ? old.coins : 0;
    const drop = Math.floor(this.inv.coins * 0.5);
    const at = this.player.lastSafe || this.player;
    this.flags.deathDrop = drop > 0 ? { area: this.area.id, x: at.x, z: at.z, coins: drop } : null;
    this.inv.coins -= drop;
    this.lastDeathDrop = { drop, lostOld };
    this.save();
    const h = this.player.lastHit;
    const rest = { village: 'the Thimblewick Bellstone', entrance: 'the Hollow\'s entrance Bellstone', pre: 'the Bellstone before the Root Gate', dungeon: 'the Hollow\'s mouth', atrium: 'the Glass Atrium Bellstone', canopy: 'the Bellfruit Canopy Bellstone' }[this.checkpoint.spawn] || (BELLSTONE_NAMES[this.checkpoint.area + ':' + this.checkpoint.spawn] ? 'the ' + BELLSTONE_NAMES[this.checkpoint.area + ':' + this.checkpoint.spawn] + ' Bellstone' : 'your last rest');
    const el = document.querySelector('#gameover .recap');
    if (el) el.innerHTML = (h ? `Felled by <b>${h.by}</b>${h.lvl ? ' (Lv ' + h.lvl + ')' : ''} — the last blow took <b>${h.n}</b> health.<br>` : '') + `You will wake at ${rest} with full health and tonics. Gear, crafting and story progress are kept.` + (this.lastDeathDrop.drop ? `<br><span style="color:#ffd25e">◆ ${this.lastDeathDrop.drop} pips fell where you did — go back for them.</span>` : '') + (this.lastDeathDrop.lostOld ? `<br><span style="color:#f99">The ${this.lastDeathDrop.lostOld} pips from your last fall are gone.</span>` : '');
    setTimeout(() => { this.dead = true; this.ui.show('gameover', true); }, 1300);
  }
  revive() {
    this.flags.phoenixSpent=false; this.dead = false; this.ui.show('gameover', false);
    this.inv.hp = this.inv.maxHp;
    this.inv.potions = this.inv.maxPotions;
    this.surge = 0;
    this.warpTo(this.checkpoint.area, this.checkpoint.spawn);
  }
  // Bellstones: rest points that refill life and tonics and become the checkpoint
  rest(stone) {
    const inv = this.inv;
    inv.hp = inv.maxHp; inv.potions = inv.maxPotions; this.res = 100;
    this.checkpoint = { area: this.area.id, spawn: stone.spawn };
    this.flags['rested:' + stone.spawn] = true;
    // resting wakes the world: every standard foe you cleared outside comes back now (bosses never do)
    if (this.area.id === 'overworld' && this.respawnQ && this.respawnQ.length) { for (const r of this.respawnQ) { r.def._killed = false; if (!this.streamDefs || this.defActive(r.def)) this.spawnDef(r.def); } this.respawnQ = []; }
    const id = this.area.id + ':' + stone.spawn;
    if (!this.discoveredBellstones.includes(id)) this.discoveredBellstones.push(id);
    this.guide.event('rest');
    this.ui.hearts(true); this.hudDirty = true;
    this.save();
  }

  // ------------------------------------------------ rooms
  roomAt(x, z) {
    if (!this.area.rooms) return null;
    return this.area.rooms.find(r => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) || null;
  }
  updateRoom(force) {
    if (!this.area.rooms) return;
    const p = this.player;
    const r = this.roomAt(p.x, p.z);
    if (!r || (r === this.room && !force)) return;
    const prev = this.room;
    this.room = r;
    // enemies left behind in other rooms fall asleep: release any attack tokens they held
    for (const e of this.entities) if (e.isEnemy) e.token = false;
    this.tokens = 0;
    this.roomEntry = { x: p.x, z: p.z };
    // step the entry point a bit into the room so a pit respawn is safe
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const dx = cx - p.x, dz = cz - p.z;
    if (Math.abs(dx) > Math.abs(dz)) this.roomEntry.x += Math.sign(dx) * 0.9; else this.roomEntry.z += Math.sign(dz) * 0.9;
    const key = 'visited:' + this.area.id + ':' + r.id;
    if (!this.flags[key] && prev) this.ui.areaName(r.name);
    this.flags[key] = true;
    if (r.reset && !this.signal(r.reset) && prev) {
      for (const e of this.entities) if (e.isMovable && e.room === r.id && (e.filled || e.x !== e.home.x || e.z !== e.home.z || e.sunk)) e.reset();
    }
    if (r.id === 'pre') this.checkpoint = { area: 'dungeon', spawn: 'pre' };
  }
  sealRoom(id, on) {
    for (const e of this.entities) if (e instanceof O.Door && e.rooms.includes(id)) e.sealed = on;
  }
  resetRoom() {
    const r = this.room;
    for (const e of this.entities) {
      if (e.isMovable && (r ? e.room === r.id : true)) {
        if (e.reset) e.reset();
      }
    }
  }
  checkBossRoom(d) {
    if (this.flags.bossKilled || this.bossActive || !this.room || this.room.id !== d.room) return;
    const p = this.player;
    if (p.z > this.room.z1 - 2.5) return;
    this.sealRoom(d.room, true);
    const b = new Boss(this, d.x, d.z);
    this.bossActive = b;
    this.spawn(b);
    this.cutscene = true;
    // reveal: letterbox, a slow push-in on the bulb, then the name card with a sting
    this.camFocus = { x: d.x, z: d.z + 1.5 }; this.camZoom = 0.72;
    sfx('roar'); this.pr.addShake(1);
    playMusic(null);
    this.ui.show('letterbox', true);
    setTimeout(() => {
      sfx('bossSting'); this.pr.addFlash(0.25, 0xff7ab0); this.pr.addShake(0.6);
      const nc = document.getElementById('namecard'); nc.querySelector('.nc-sub').textContent = 'THE CHOKING ROOT'; nc.querySelector('.nc-name').textContent = 'BRAMBLEMAW'; this.ui.show('namecard', true);
      for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28; this.fx.add({ x: d.x + Math.cos(a) * 2, y: 0.2, z: d.z + Math.sin(a) * 2, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 2, color: i % 2 ? 0x7fd36a : 0xc04a7a, life: 1.2, size: 0.1 }); }
    }, 900);
    setTimeout(() => { this.camZoom = 1; this.ui.show('namecard', false); this.ui.show('letterbox', false); }, 3100);
    setTimeout(() => { this.cutscene = false; this.camFocus = null; this.musicOverride('boss'); this.ui.bossBar(b.name, 1); }, 3400);
  }
  // ---- Pass 5 bosses: a shared reveal (letterbox, push-in, name card, sting)
  bossIntro(boss, sub, focus, onDone) {
    this.bossActive = boss; this.cutscene = true;
    this.camFocus = focus; this.camZoom = 0.72;
    sfx('roar'); this.pr.addShake(1); playMusic(null);
    this.ui.show('letterbox', true);
    setTimeout(() => {
      sfx('bossSting'); this.pr.addFlash(0.25, 0xfff3b0); this.pr.addShake(0.6);
      const nc = document.getElementById('namecard'); nc.querySelector('.nc-sub').textContent = sub; nc.querySelector('.nc-name').textContent = boss.name; this.ui.show('namecard', true);
    }, 900);
    setTimeout(() => { this.camZoom = 1; this.ui.show('namecard', false); this.ui.show('letterbox', false); }, 3100);
    setTimeout(() => { this.cutscene = false; this.camFocus = null; this.musicOverride('boss'); this.ui.bossBar(boss.name, 1); onDone && onDone(); }, 3400);
  }
  startSeamkeeper(d) {
    const room = this.room;
    this.sealRoom(room.id, true);
    const b = new Seamkeeper(this, d.x, d.z - 2, room);
    this.spawn(b);
    this.bossIntro(b, 'WHO MENDS WHAT SHOULD STAY BROKEN', { x: d.x, z: d.z - 1 }, () => b.setState('idle'));
  }
  onSeamkeeperDead(b) {
    const first = !this.flags.seamDead;
    this.flags.seamDead = true; this.bossActive = null;
    this.setSignal('c.seamdead', true, true);
    this.sealRoom(b.room, false); this.musicOverride(null); playMusic(null);
    setTimeout(() => {
      this.cutscene = false; this.camFocus = null; this.camZoom = 1;
      this.ui.banner('VICTORY', 'The Seamkeeper comes undone', 2.5); sfx('fanfare');
      this.gainXp(500);
      gainMat(this, 'seamthread', 2, b.x, b.z);
      if (first) { this.spawn(new GearDrop(this, b.x, b.z + 1.5, makeNamed('seamripper', Math.max(8, this.inv.level)))); learn(this, 'seamstitch'); }
      this.dropGear(b.x - 1, b.z + 1, { level: 8, floor: 3, bonus: 1 }); this.dropGear(b.x + 1, b.z + 1, { level: 8, floor: 2, bonus: 0.6 });
      this.ui.toast('The reliquary door has opened.', 'East of the Bellfruit Canopy.', 3);
      this.save();
    }, 1200);
  }
  wakeToad(t) {
    this.bossIntro(t, 'KING OF THE DROWNED LILIES', { x: t.x, z: t.z + 1 }, () => t.setState('idle'));
    t.wake();
  }
  onToadDead(t) {
    const first = !this.flags.toadKills;
    this.flags.toadKills = (this.flags.toadKills || 0) + 1; this.flags.toadAt = this.time; this.bossActive = null; this.fenToad = null;
    this.musicOverride(null); playMusic(null);
    setTimeout(() => {
      this.cutscene = false; this.camFocus = null; this.camZoom = 1;
      this.ui.banner('VICTORY', 'The Crowned Toad is dethroned', 2.5); sfx('fanfare');
      this.gainXp(800);
      gainMat(this, 'crownpearl', 1, t.x, t.z);
      if (first) { this.spawn(new GearDrop(this, t.x - 1, t.z + 1.5, makeNamed('toadsignet', Math.max(9, this.inv.level)))); this.spawn(new GearDrop(this, t.x + 1, t.z + 1.5, makeNamed('lilypad', Math.max(9, this.inv.level)))); learn(this, 'crowntongue'); }
      // the one thing it truly hoards: rarely, a very large spoon
      if (Math.random() < 0.06) { this.spawn(new GearDrop(this, t.x, t.z + 2, makeNamed('teaspoon', Math.max(9, this.inv.level)))); this.ui.toast('…is that a spoon?', 'The Royal Teaspoon!', 3); }
      this.dropGear(t.x, t.z + 1, { level: 10, floor: 3, bonus: 1.5 });
      this.save();
    }, 1200);
  }
  onBossDying(b) {
    for (const e of this.entities) if (e.isEnemy && e !== b && !e.dead) e.die(null, 'fall');
    this.ui.bossBar(null);
    this.cutscene = true;
    this.camFocus = { x: b.x, z: b.z + 2 }; this.camZoom = 0.8;
    setTimeout(() => { this.camZoom = 1; }, 3800);
  }
  onBossDead(b) {
    this.flags.bossKilled = true;
    this.bossActive = null;
    this.sealRoom('boss', false);
    this.musicOverride(null); playMusic(null);
    setTimeout(() => {
      this.cutscene = false; this.camFocus = null;
      this.ui.banner('VICTORY', 'Bramblemaw is felled', 2.5);
      sfx('fanfare');
      this.spawnChime();
      if (!this.flags.bossHeart) { this.flags.bossHeart = true; const h = new Pickup(this, b.x - 2, b.z + 2.5, 'heartfull'); this.spawn(h); }
      this.gainXp(350);
      // the guardian's heart, plus an essence suited to your class (first kill only, saved at once)
      if (!this.flags.bossMats) {
        this.flags.bossMats = true;
        gainMat(this, 'thornheart', 1, b.x, b.z + 2);
        gainMat(this, { samurai: 'thornheart', archer: 'echo', witch: 'ember' }[this.inv.cls], 1, b.x, b.z + 2);
        gainMat(this, 'shard', 6);
        learn(this, { samurai: 'thornrebuke', archer: 'echofletch', witch: 'emberseeds' }[this.inv.cls]);
      }
      this.dropGear(b.x - 1, b.z + 2, { level: 6, floor: 3, bonus: 1 }); this.dropGear(b.x + 1, b.z + 2, { level: 6, floor: 2, bonus: 0.6 }); this.dropGear(b.x, b.z + 2.5, { level: 5, floor: 2 });
      this.save();
    }, 1200);
  }
  spawnChime() {
    const r = this.area.rooms.find(r => r.id === 'boss');
    this.spawn(new O.ChimePedestal(this, r.x0 + 8.5, r.z0 + 4.5));
  }
  onEnemyDeath(e) {
    const ps = this.pstats;
    if (e.def && this.area.id === 'overworld') { e.def._killed = true; (this.respawnQ || (this.respawnQ = [])).push({ def: e.def, t: this.time + 70 + Math.random() * 40 }); }
    this.story.bountyEvent(e.elite ? ['kill', e.kind, 'elite'] : ['kill', e.kind]);
    this.gainXp(e.xpValue || 5);
    // death-triggered effects can chain, but only two links deep (no runaway proc loops)
    this.procDepth = this.procDepth || 0;
    if (e.status && e.status.burn > 0 && this.talent('wildfire') && this.procDepth < 2) { this.procDepth++; try { fanFlames(this, e, e.status); } finally { this.procDepth--; } }
    if (e.status && e.status.hex > 0 && this.talent('soulsiphon')) { this.res = Math.min(100, this.res + 8); this.fx.burst(e.x, 0.6, e.z, 8, 0xb88aff, 2, { g: -2 }); }
    if (ps.uniques.has('hexbloom') && this.procDepth < 2) { this.procDepth++; try { blast(this, e.x, e.z, 1.8, 0.9, 0x8b5cf6, { ability: true }); } finally { this.procDepth--; } }
    if (e.elite === 'Volatile') { this.fx.ring(e.x, e.z, 0.2, 2, 0xffb347, 0.4); const p = this.player; if (Math.hypot(p.x - e.x, p.z - e.z) < 2) p.hurt({ dmg: 2, x: e.x, z: e.z, src: e, kb: 6 }); }
    // crafting materials come from the fights you already have, not a separate gathering game
    if (e.elite) gainMat(this, 'shard', 1 + (Math.random() < 0.5 ? 1 : 0));
    if (e.champion && Math.random() < 0.5) gainMat(this, 'echo', 1, e.x, e.z);
    if (e.kind === 'treant' && Math.random() < 0.3) gainMat(this, 'thornheart', 1, e.x, e.z);
    if ((e.kind === 'imp' && Math.random() < 0.1) || (e.elite === 'Volatile' && Math.random() < 0.4)) gainMat(this, 'ember', 1, e.x, e.z);
    if (e.kind === 'wraith' && e.elite && Math.random() < 0.3) gainMat(this, 'echo', 1, e.x, e.z);
    // Pass 5 creatures leave their own materials (elites always do); the first one teaches its engraving
    const EM = ENEMY_MATS[e.kind];
    if (EM && (e.elite || Math.random() < EM[1])) { gainMat(this, EM[0], 1, e.x, e.z); const teach = { wax: 'waxseal', moth: 'mothwing' }[EM[0]]; if (teach) learn(this, teach); }
    if (e.elite && e.kind === 'moth' && Math.random() < 0.08) this.spawn(new GearDrop(this, e.x, e.z, makeNamed('mothlight', e.level || this.inv.level)));
    if (e.elite && e.kind === 'slug' && Math.random() < 0.08) this.spawn(new GearDrop(this, e.x, e.z, makeNamed('candelabra', e.level || this.inv.level)));
    const lvl = e.level || this.inv.level;
    if (e.elite) { this.dropGear(e.x, e.z, { level: lvl, floor: 2, bonus: 0.6 }); if (Math.random() < 0.4) this.dropGear(e.x, e.z, { level: lvl, floor: 1 }); }
    else if (Math.random() < ({ knight: 0.6, beetle: 0.14, puffer: 0.12 }[e.kind] ?? 0.08) * (1 + ps.mf / 200)) this.dropGear(e.x, e.z, { level: lvl, floor: e.kind === 'knight' ? 1 : 0 });
  }

  startIntroFight() {
    const a = new O.Arena(this, { id: 'intro', x: hx(58.5), z: hz(70), radius: 99 }, [
      [['blot', -2, 1], ['blot', 2, 1], ['blot', 0, 3]],
      [['blot', -3, 0], ['blot', 3, 0], ['blot', -1, 3], ['blot', 1, 3]],
      // the lesson at the end: a shell that shrugs off taps. Charge, or strike after a parry.
      [['porcelain', 0, 3], ['blot', -3, 2], ['blot', 3, 2]],
    ], { title: 'HUSHLINGS!', victory: 'Thimblewick is safe… for now.', onWave: w => { if (w === 2) setTimeout(() => this.ui.toast('A Porcelain Guard!', { samurai: 'Its glaze turns light cuts. Hold C / left click for a spin — or parry (Q) and strike.', archer: 'Its glaze turns light arrows. Hold C / left click for a charged shot to crack it.', witch: 'Its glaze turns bolts. Hold C / left click for a fireball to crack it.' }[this.inv.cls], 4.5), 400); }, onClear: () => { this.story.introWon(); this.revealWorld(); const p = this.player; this.spawn(new GearDrop(this, p.x, p.z + 1.2, genItem({ level: 2, cls: this.inv.cls, slot: 'weapon', rarity: 1 }))); this.spawn(new GearDrop(this, p.x + 1, p.z + 1, genItem({ level: 2, slot: 'armor', rarity: 1 }))); } });
    a.alwaysUpdate = true;
    this.spawn(a);
  }

  // After the first fight: the first look at how big the world is, then back to Moss.
  // Pass 6: a wide shot over Lanternreach, then the places the roads lead to. Skippable
  // (attack or interact), and each place shown is marked on the map.
  revealWorld() {
    if (this.flags.revealed) return;
    this.flags.revealed = true;
    const shots = [
      [{ x: hx(62), z: hz(50), zoom: 3.1 }, 'LANTERNREACH', 'The world is far bigger than the village', 3200],
      [{ x: hx(45.5), z: hz(42), zoom: 1.5 }, 'THE CRACKED CONSERVATORY', 'Something inside keeps mending the glass', 2300],
      [{ x: hx(22), z: hz(34), zoom: 1.35 }, 'WHISPERWOOD', 'Rootwell Hollow breathes beneath the roots', 2300],
      [{ x: 136, z: 72, zoom: 2.2 }, 'THE WINDSTAIR', 'Up there: the Chime Highlands', 2300],
      [{ x: 172, z: 184, zoom: 2.4 }, 'LAKE MIRROW', 'Ferries, islands, and something under the water', 2300],
      [{ x: hx(74.5), z: hz(15), zoom: 1.35 }, 'THE CHIME GATE', 'Three Voices sealed it', 2300],
    ];
    this.markLandmarks && this.markLandmarks(['dome', 'windstair', 'heron', 'landing', 'statue']);
    setTimeout(() => {
      this.cutscene = true; this.revealing = true; this.ui.show('letterbox', true);
      let t = 0;
      this.revealTimers = shots.map(([f, big, small, dur]) => { const at = t; t += dur; return setTimeout(() => { if (!this.revealing) return; this.camFocus = { x: f.x, z: f.z }; this.camZoom = f.zoom; this.ui.banner(small, big, dur / 1000 - 0.3); sfx('chime'); }, at); });
      this.revealTimers.push(setTimeout(() => this.endReveal(), t + 300));
    }, 2200);
  }
  endReveal() {
    if (!this.revealing) return;
    this.revealing = false; (this.revealTimers || []).forEach(clearTimeout);
    this.camFocus = null; this.camZoom = 1; this.cutscene = false; this.ui.show('letterbox', false);
    this.ui.toast('Esc opens your map', 'Roads out of Thimblewick are signposted.', 2.6);
  }
  // a heavy impact: grass flattens outward, leaves and dust jump
  impact(x, z, r = 2, k = 1) {
    const B = bendUniform.value;
    let slot = 1; for (let i = 2; i < 4; i++) if (B[i].w < B[slot].w) slot = i;
    B[slot].set(x, z, r, 0.9 * k);
    const t = this.tileAt(Math.floor(x), Math.floor(z));
    const leafy = t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.MOSS;
    for (let i = 0; i < 8 * k; i++) { const a = Math.random() * 6.28, rr = Math.random() * r; this.fx.add({ x: x + Math.cos(a) * rr, y: 0.05, z: z + Math.sin(a) * rr, vx: Math.cos(a) * 2.5, vz: Math.sin(a) * 2.5, vy: 2 + Math.random() * 2, color: leafy ? (i % 3 ? 0x7ccb52 : 0xc8742a) : 0xb8a888, life: 0.8, size: leafy ? 0.05 : 0.07, g: leafy ? 3 : 8, wob: leafy ? 2 : 0 }); }
  }
  // ------------------------------------------------ combat helpers
  hitArc(src, x, z, facing, range, halfAng, opts) {
    for (const e of this.entities) {
      if (e === src || e.dead || !e.onHit) continue;
      if (src.hitSet.has(e)) continue;
      const dx = e.x - x, dz = e.z - z;
      const d = Math.hypot(dx, dz) - (e.r ?? 0.3);
      if (d > range) continue;
      const a = Math.atan2(dx, dz);
      if (halfAng < Math.PI && Math.hypot(dx, dz) > 0.3 && Math.abs(angDiff(facing, a)) > halfAng) continue;
      if (e.isEnemy && !e.isBoss && e.moveMode === 'fly' && e.alt > 1.4) continue;
      src.hitSet.add(e);
      if (src.isPlayer && opts.mult !== undefined) this.playerHit(e, { ...opts, dir: a });
      else e.onHit({ ...opts, dir: a, src });
    }
  }
  nearestEnemy(x, z, range, facing, halfAng) {
    let best = null, bd = range;
    for (const e of this.entities) {
      if (!e.isEnemy || e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd && Math.abs(angDiff(facing, Math.atan2(e.x - x, e.z - z))) < halfAng) { bd = d; best = e; }
    }
    return best;
  }
  // how far a shot travels from (x,z) along dir before a wall or solid object stops it
  shotLen(x, z, dir, max) {
    const sx = Math.sin(dir), sz = Math.cos(dir), probe = { moveMode: 'fly' };
    for (let k = 0.1; k < max; k += 0.1) {
      const px = x + sx * k, pz = z + sz * k;
      if (tileBlocks(this, Math.floor(px), Math.floor(pz), probe)) return Math.max(0, k - 0.1);
      if (this.solidAt(px, pz, 0.05)) return Math.max(0, k - 0.1);
    }
    return max;
  }
  solidAt(x, z, r) {
    for (const s of this.solids) {
      if (s.dead || !s.solid || s.isEnemy || s.isPlayer || s.passShots) continue;
      if (Math.abs(s.x - x) < s.hw + r && Math.abs(s.z - z) < s.hd + r) return s;
    }
    return null;
  }
  shotClear(x0, z0, x1, z1) { const d = Math.hypot(x1 - x0, z1 - z0); return this.shotLen(x0, z0, Math.atan2(x1 - x0, z1 - z0), d) >= d - 0.12; }
  // is a world point inside the visible view (with a margin in world units)?
  onScreen(x, z, margin = 0) {
    const pr = this.pr, T = pr.target, u = pr.unitsPerPx;
    const a = x - T.x, b = -(z - T.z) * Math.sin(PITCH);
    return Math.abs(a) < pr.rw * u / 2 - margin && Math.abs(b) < pr.rh * u / 2 - margin;
  }
  lineClear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.25);
    const ex = Math.floor(x1), ez = Math.floor(z1);
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
      const tx = Math.floor(x), tz = Math.floor(z);
      if (tx === ex && tz === ez) continue;
      const t = this.tileAt(tx, tz);
      if (t === T.WALL || t === T.CLIFF || t === T.ROCK || t === T.PILLAR || t === T.SANDSTONE || t === T.PROP) return false;
    }
    return true;
  }
  gust(p, power, fromWeapon, isEcho) {
    // The Verdant Chime echoes the Gustbellows: 1.5 s later the same gust blows again from the
    // same spot, in the same direction. One echo waits at a time and echoes never echo.
    if (!fromWeapon && !isEcho && this.inv.chimes.includes('verdant') && !this.entities.some(e => e instanceof O.GustEcho && !e.dead)) {
      this.spawn(new O.GustEcho(this, p.x, p.z, p.facing, power));
      if (!this.flags.echoTip) { this.flags.echoTip = true; this.ui.toast('Your gust will echo…', 'The Verdant Chime repeats it from where you stood, 1.5 s later.', 3); }
    }
    const valve = (this.inv.galeValve ? 1.4 : 1) * (this.pstats.uniques.has('crowmantle') ? 1.4 : 1);
    const range = (power === 2 ? 7 : 4.5) * valve;
    const half = power === 2 ? 0.5 : 0.36;
    sfx(power === 2 ? 'gale' : 'gust');
    this.fx.wind(p.x, p.z, p.facing, range, half, power === 2 ? 60 : 28, power === 2);
    if (power === 2) this.pr.addShake(0.2);
    const hits = [];
    for (const e of this.entities) {
      if (e.dead || !e.onGust || e === p) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      const reach = range + (e.r && e.r > 0.6 ? e.r : 0.3);
      if (d > reach || d < 0.05) continue;
      const a = Math.atan2(dx, dz);
      const tol = half + Math.atan2(e.hw ?? e.r ?? 0.3, d);
      if (Math.abs(angDiff(p.facing, a)) > tol) continue;
      if (!this.lineClear(p.x, p.z, e.x, e.z)) continue;
      hits.push([d, e]);
    }
    hits.sort((a, b) => b[0] - a[0]);
    for (const [, e] of hits) e.onGust(p.facing, power);
  }
  doSurge(p) {
    this.surge = 0; this.hudDirty = true;
    sfx('surge'); this.pr.addShake(1.2); this.pr.addFlash(0.5, 0xfff3b0); this.hitstop(0.1); this.impact(p.x, p.z, 5, 1.4);
    this.fx.ring(p.x, p.z, 0.5, 6, 0xfff3b0, 0.6); this.fx.ring(p.x, p.z, 0.3, 4, 0xffd25e, 0.45, 0.4);
    this.fx.burst(p.x, 0.3, p.z, 40, [0xfff3b0, 0xffd25e, 0xffffff], 6);
    p.attackId++; p.hitSet.clear();
    this.hitArc(p, p.x, p.z, 0, 5.5, Math.PI, { mult: 4, kind: 'surge', kb: 13, id: p.attackId, ability: true });
    if (this.pstats.uniques.has('tuningfork')) { p.reduceCooldowns(999); this.ui.toast('Every ability is ready', 'The Tuning Fork hums.', 1.2); }
    for (const e of this.entities) if (e instanceof O.Crate || e instanceof O.Torch || e instanceof O.LeafPile || e instanceof O.Pinwheel) { /* the toll is sound, not wind */ }
  }
  blockAhead(p, dir) {
    const px = p.x + dir[0] * (p.r + 0.15), pz = p.z + dir[1] * (p.r + 0.15);
    for (const s of this.solids) if (s instanceof O.Block && Math.abs(s.x - px) < 0.5 && Math.abs(s.z - pz) < 0.5) {
      // must be roughly aligned
      if (dir[0] && Math.abs(s.z - p.z) > 0.4) return null;
      if (dir[1] && Math.abs(s.x - p.x) > 0.4) return null;
      return s;
    }
    return null;
  }
  interactTarget() {
    const p = this.player;
    let best = null, bd = 1.5;
    for (const e of this.entities) {
      if (!e.interactable || e.dead || !e.prompt) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(Math.max(0, Math.abs(dx) - (e.hw ?? 0.3)), Math.max(0, Math.abs(dz) - (e.hd ?? 0.3)));
      if (d > 0.95) continue;
      const a = Math.abs(angDiff(p.facing, Math.atan2(dx, dz)));
      const score = d + a * 0.5;
      if (a < 1.4 && score < bd) { bd = score; best = e; }
    }
    // the Dawnbell itself, once a Chime is carried home
    if (!best && this.story.stage === 2 && this.bell && Math.hypot(this.bell.x - p.x, this.bell.z + 0.8 - p.z) < 2.2) return { prompt: 'Place the Chime', interact: () => this.story.ringBell() };
    return best;
  }
  interact() { const t = this.interactTarget(); if (t) t.interact(); }

  receiveItem(c, model, chest) {
    const p = this.player, inv = this.inv;
    this.cutscene = true;
    this.holdUp(model, c.kind);
    const info = O.ITEM_INFO[c.kind === 'item' ? c.item : c.kind];
    const big = c.kind === 'item' || c.kind === 'bigkey' || c.kind === 'heart';
    sfx(big ? 'fanfare' : 'pip');
    const n = c.n;
    let text = c.kind === 'pips' ? `You found *${n} pips*!` : `You got the *${info.name}*!\n${info.desc}`;
    if (c.kind === 'named') { const L = LEGENDARIES.find(l => l.id === c.id); text = `You found *${L ? L.name : 'a treasure'}*!\n${L ? L.text : ''}`; }
    if (c.kind === 'recipe') { const r = recipeById(c.id); text = `You learned the *${r.name}* engraving!\n${r.effect}\nCraft it at Posy's workbench.`; }
    if (c.kind === 'mat') text = `You found *${c.n || 1} ${MATS[c.mat].name}*!\n${MATS[c.mat].desc}`;
    if (c.kind === 'quest') text = `You found *${c.name}*!\n${c.desc}`;
    if (c.kind === 'mapfrag') text = `You found a *map fragment*!\nSomeone sketched ${({ deepwood: 'the Deepwood', moonfen: 'Moonfen', highlands: 'the Chime Highlands', cinderpeak: 'Cinderpeak', sunscald: 'Sunscald Reach', lake: 'Lake Mirrow', glassmere: 'Glassmere', whisperwood: 'Whisperwood', heartland: 'the Heartland' })[c.region] || 'a far place'} on it. It goes on your map.`;
    setTimeout(() => {
      this.ui.say(null, text, () => {
        this.endHold();
        switch (c.kind) {
          case 'key': inv.keys++; break;
          case 'bigkey': inv.bigkey = true; break;
          case 'item': inv[c.item] = true; if(c.item==='fireRod') inv.activeTool='fireRod'; if (c.item === 'bellows') this.ui.toast('Gustbellows: L (hold for a gale)', 'Try it on the pinwheel!', 4); break;
          case 'heart': this.gainHeartContainer(true); break;
          case 'pips': this.addCoins(n); break;
          case 'potion': inv.potions = Math.min(inv.maxPotions, inv.potions + 1); break;
          case 'echo': gainMat(this, 'echo', 1); learn(this, { samurai: 'returningcut', archer: 'echosnare', witch: 'rimebloom' }[inv.cls]); break;
          case 'named': { const it = makeNamed(c.id, Math.max(c.level || 7, inv.level)); if (!this.pickupItem(it)) this.spawn(new GearDrop(this, this.player.x, this.player.z + 0.8, it)); break; }
          case 'recipe': learn(this, c.id); break;
          case 'mat': gainMat(this, c.mat, c.n || 1); break;
          case 'quest': this.flags[c.flag] = true; this.ui.toast(c.name, 'A quest item.', 2.4); break;
          case 'mapfrag': this.revealRegion(c.region); this.stats.mapfrags = (this.stats.mapfrags || 0) + 1; break;
          case 'score': this.flags.bellscore = true; this.ui.toast("Bellwright's Score", 'Bring it to Elder Tamsin in Thimblewick.', 3); break;
        }
        this.ui.updateHud(); this.save();
      });
    }, big ? 700 : 250);
  }
  holdUp(model, kind) {
    const p = this.player;
    p.setState('hold'); p.facing = 0;
    this.held = model; model.position.set(p.x, 1.35, p.z); model.scale.setScalar(1.3);
    this.world.add(model);
    this.fx.burst(p.x, 1.3, p.z, 20, [0xffffff, 0xfff3b0], 2.5, { g: 0, life: 0.8 });
  }
  endHold() {
    if (this.held && this.held.parent) this.held.parent.remove(this.held);
    this.held = null; this.player.setState('move'); this.cutscene = false;
  }
  hushLift() { this.flags.hushLifted = true; this.updateGrade(); }
  updateGrade() {
    const u = this.pr.postMat.uniforms;
    if (this.area && this.area.dark) { u.grade.value.set(1.05, 1.0, 1.08); u.desat.value = 0; u.vignette.value = 0.8; u.bloom.value = 0.4; return; }
    u.vignette.value = 0.35;
    if (this.flags.hushLifted) { u.grade.value.set(1.06, 1.03, 0.96); u.desat.value = 0; }
    else { u.grade.value.set(0.97, 0.95, 1.04); u.desat.value = 0.14; }
  }
  musicOverride(name) { this.musicOvr = name; this.applyMusic(); }
  applyMusic() {
    let m = this.musicOvr || (this.region && this.region.music) || this.area.music;
    if (this.bossActive) m = 'boss';
    playMusic(m);
    // Pass 6: each region has its own sound bed (see REGIONS[...].ambience)
    const rid = this.region && this.region.id;
    setAmbience(this.area && this.area.dungeon ? 'cave' : rid && REGIONS[rid] ? REGIONS[rid].ambience : null, !!this.isNight);
  }
  updateRegion(force) {
    if (!this.area.regions) { if (force) this.applyMusic(); return; }
    const p = this.player;
    const r = this.area.placeAt ? this.area.placeAt(p.x, p.z) : this.area.regions.find(r => p.x >= r.x0 && p.x < r.x1 && p.z >= r.y0 && p.z < r.y1);
    if (r !== this.region || force) {
      const prev = this.region;
      this.region = r;
      if (prev && r && prev.name !== r.name) this.ui.areaName(r.name);
      this.applyMusic();
    }
  }

  // ------------------------------------------------ Pass 6: ground height & streaming
  // Height of walkable ground at a point (0 everywhere the map is flat). Smooth across stairs,
  // sharp at terrace edges, so feet follow steps and never slide down a cliff face.
  groundAt(x, z) {
    const a = this.area;
    if (!a || !a.elevated) return 0;
    const fx = x - 0.5, fz = z - 0.5, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const own = groundY(a, Math.floor(x), Math.floor(z));
    const h = (xx, zz) => { const v = groundY(a, xx, zz); return Math.abs(v - own) > 0.55 ? own : v; };
    const a0 = h(x0, z0), a1 = h(x0 + 1, z0), b0 = h(x0, z0 + 1), b1 = h(x0 + 1, z0 + 1);
    return (a0 * (1 - tx) + a1 * tx) * (1 - tz) + (b0 * (1 - tx) + b1 * tx) * tz;
  }
  // Compile every material variant the regions use once, at load (behind the fade), so the
  // first step into a new region doesn't stall on shader compilation.
  warmShaders(area) {
    if (area.id !== 'overworld' || this._warmed || !this.pr.renderer.compile) return;
    this._warmed = true;
    // build a chunk from each region, slide it under the camera, draw it once (shadows too), drop it
    for (const [x, z] of [[60, 200], [262, 50], [118, 44], [288, 201], [44, 110], [268, 150], [150, 96], [236, 80]]) {
      const cx = Math.floor(x / 24), cz = Math.floor(z / 24), k = cx + ',' + cz;
      if (this.streamer.chunks.has(k)) continue;
      this.streamer.build(cx, cz);
      const grp = this.streamer.chunks.get(k);
      grp.position.set(this.cam.x - (cx + 0.5) * 24, 0, this.cam.z - (cz + 0.5) * 24);
      grp.updateMatrixWorld(true);
      try { this.pr.render(this.scene, 0); } catch (e) { /* keep loading even if a warm-up draw fails */ }
      this.streamer.drop(k);
    }
  }
  tileGround(tx, tz) { return this.area && this.area.elevated ? groundY(this.area, tx, tz) : 0; }
  viewExtent() {
    const vh = this.pr.viewHeight || 12;
    return { hw: this.pr.rw * this.pr.unitsPerPx / 2, hd: vh / Math.sin(PITCH) / 2 };
  }
  defActive(d) {
    const S = this.streamDefs; if (!S) return true;
    return S.active.has(Math.floor(d.x / S.C) + ',' + Math.floor(d.z / S.C));
  }
  // Streams scenery-level things (grass, bushes, monsters, chests, signs...) in and out by
  // 16-tile cell around the player, a few per frame, so a big world keeps a small entity list.
  streamTick(dt, all) {
    const S = this.streamDefs; if (!S) return;
    S.t -= dt; if (S.t > 0 && !all) return; S.t = 0.25;
    const p = this.player, C = S.C, pcx = Math.floor(p.x / C), pcz = Math.floor(p.z / C), R = 3;
    const want = new Set();
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) want.add((pcx + dx) + ',' + (pcz + dz));
    let budget = all ? Infinity : 24;
    for (const k of want) {
      const list = S.cells.get(k); if (!list) { S.active.add(k); continue; }
      let done = true;
      for (const d of list) {
        if (d._ent && !d._ent.dead) continue;
        if (d._ent && d._ent.dead && d.type !== 'enemy') continue; // cut grass stays cut while you're near
        if (d._killed || (d._ent && d._ent.dead)) continue;
        if (budget-- <= 0) { done = false; break; }
        this.spawnDef(d);
      }
      if (done) S.active.add(k);
    }
    // far cells go back to sleep: their things are dropped (state that matters lives in flags)
    for (const k of [...S.active]) {
      if (want.has(k)) continue;
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= R + 1) continue;
      S.active.delete(k);
      for (const d of S.cells.get(k) || []) {
        const e = d._ent;
        if (!e) continue;
        if (e.dead) { if (d.type !== 'enemy') d._ent = null; continue; }
        if (e.arena || e.aggro || this.bossActive === e) continue;
        e.remove(); d._ent = null;
      }
    }
  }

  // ------------------------------------------------ camera
  camTarget() {
    const p = this.player;
    if (this.camFocus) return this.camFocus;
    let x = p.x + Math.sin(p.facing) * 0.6, z = p.z + Math.cos(p.facing) * 0.4;
    if (this.room) {
      const r = this.room;
      const halfW = this.pr.rw * this.pr.unitsPerPx / 2, halfD = this.pr.viewHeight / Math.sin(PITCH) / 2;
      const rw = (r.x1 - r.x0) / 2, rd = (r.z1 - r.z0) / 2;
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2 + 0.6;
      x = rw <= halfW ? cx : clamp(x, r.x0 + halfW, r.x1 - halfW);
      z = rd <= halfD - 0.5 ? cz : clamp(z, r.z0 + halfD - 1, r.z1 - halfD + 1.5);
    } else {
      const a = this.area;
      const halfW = this.pr.rw * this.pr.unitsPerPx / 2;
      x = clamp(x, halfW, a.w - halfW); z = clamp(z, 7, a.h - 5);
    }
    return { x, z };
  }
  snapCamera() { const t = this.camTarget(); this.cam.set(t.x, 0, t.z); this.pr.target.copy(this.cam); }

  // ------------------------------------------------ main update
  update(dt) {
    dt *= this.timeScale ?? 1; // dev capture: freeze / slow motion
    this.time += dt;
    this.autosaveT = (this.autosaveT || 0) + dt;
    if (this.autosaveT >= 15) { this.autosaveT = 0; this.save(); }
    windUniform.value = this.time;
    // foliage bends around the player and flattens under recent impacts
    const B = bendUniform.value;
    if (this.player) B[0].set(this.player.x, this.player.z, 0.8, this.player.state === 'roll' ? 0.5 : 0.3);
    for (let i = 1; i < 4; i++) B[i].w = Math.max(0, B[i].w - dt * 0.9);
    this.liquidTime.value = this.time;
    if(this.pstats?.uniques.has('worldseed')&&!this.dead&&this.player.state!=='dead'&&!this.locked()&&!this.ui.invOpen&&this.area.id!=='devroom'){const key='boon:'+this.area.id;if(this.flags[key]){if(this.inv.areaBoon!==this.flags[key]){this.inv.areaBoon=this.flags[key];this.recalc();}}else{this.ui.ask('Worldseed','Choose a boon for '+this.area.name+'. This choice stays with this adventure.',Object.entries(BOONS).map(([id,b])=>({label:b.name+' · '+b.text,cb:()=>{this.flags[key]=id;this.inv.areaBoon=id;this.recalc();this.save();}})));}}
    const input = this.input;
    if (this.revealing && (input.pressed('interact') || input.pressed('attack'))) this.endReveal();
    this.ui.update(dt);
    if (this.dead) { this.aimView.hide(); if (input.pressed('interact')) this.revive(); this.render(dt); return; }
    if (this.ui.updateShop(input)) { this.render(dt); return; }
    if (this.ui.updateCraft(input)) { this.render(dt); return; }
    if (this.ui.updateInventory(input)) { this.render(dt); return; }
    if (input.pressed('inventory') && !this.locked() && !this.dead) { this.ui.invTab = 'bag'; this.ui.openInventory(); this.render(dt); return; }
    const talking = this.ui.updateDialog(dt, input);
    if (!talking) this.playTime += dt;
    if (this.stopT > 0) { this.stopT -= dt; this.fx.update(dt * 0.2, this.cam); this.render(dt); return; }
    // entities
    const p = this.player;
    const near = 30;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.dead) continue;
      if (!e.alwaysUpdate && e !== p && (Math.abs(e.x - p.x) > near || Math.abs(e.z - p.z) > near * 0.8)) continue;
      if (e.isEnemy && this.room && e.room && e.room !== this.room.id && !e.arena) continue; // dungeon: only current room is awake
      e.update(dt);
    }
    // soft separation between walking enemies and from the player
    const act = this.entities.filter(e => e.isEnemy && !e.dead && !e.isBoss && Math.abs(e.x - p.x) < 20 && Math.abs(e.z - p.z) < 16);
    for (let i = 0; i < act.length; i++) {
      const a = act[i];
      for (let j = i + 1; j < act.length; j++) {
        const b = act[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r;
        if (d < m && d > 1e-4) { const k = (m - d) * 0.5; a.x -= dx / d * k; a.z -= dz / d * k; b.x += dx / d * k; b.z += dz / d * k; }
      }
      const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), m = a.r + p.r;
      if (d < m && d > 1e-4 && a.moveMode !== 'fly') { const k = (m - d); a.x -= dx / d * k; a.z -= dz / d * k; }
    }
    this.entities = this.entities.filter(e => !e.dead);
    this.streamTick(dt);
    // solids cache for next frame
    this.solids = this.entities.filter(e => e.solid && Math.abs(e.x - p.x) < 24 && Math.abs(e.z - p.z) < 20);
    const lsCap = this.inv.maxHp * 0.05;
    this.lsPool = Math.min(lsCap, (this.lsPool || 0) + lsCap * dt);
    this.updateRoom();
    clipUniform.value = this.room ? this.room.z1 - 1 : 1e9;
    this.regionT = (this.regionT || 0) - dt;
    if (this.regionT <= 0) { this.regionT = 0.4; this.updateRegion(); }
    // prompt
    const it = !this.locked() && p.state === 'move' ? this.interactTarget() : null;
    this.ui.prompt(it ? it.prompt : null);
    if (this.hudDirty) { this.hudDirty = false; this.ui.updateHud(); }
    this.fx.update(dt, this.cam);
    this.ui.updateVitals();
    this.ui.updateFloats(dt);
    this.guide.tick(dt);
    this.worldTick(dt);
    this.world6Fast(dt);
    this.aimView.update();
    if (this.held) { this.held.rotation.y += dt * 2; this.held.position.y = 1.35 + Math.sin(this.time * 3) * 0.05; }
    this.render(dt);
  }
  render(dt) {
    // camera distance: the player's setting, times any dramatic zoom (boss intros)
    const vh = (this.baseVH || 12) * ((this.settings && this.settings.zoom) || 1) * (this.camZoom || 1) * (this.vistaK || 1);
    if (Math.abs(vh - this.pr.viewHeight) > 0.01) this.pr.setViewHeight(this.pr.viewHeight + (vh - this.pr.viewHeight) * Math.min(1, dt * 4 + (dt === 0 ? 1 : 0)));
    const t = this.camTarget();
    const k = 1 - Math.exp(-dt * (this.room ? 7 : 6));
    this.cam.x += (t.x - this.cam.x) * k; this.cam.z += (t.z - this.cam.z) * k;
    // on raised ground the camera rises with you (smoothly, so stairs don't bob the view)
    const ty = this.camFocus ? (this.camFocus.y ?? this.groundAt(this.camFocus.x, this.camFocus.z)) : (this.player ? this.player.gy || 0 : 0);
    this.cam.y += (ty - this.cam.y) * (1 - Math.exp(-dt * 4));
    this.pr.target.copy(this.cam);
    { const v = this.viewExtent(); this.streamer.update(this.cam.x, this.cam.z, v.hw, v.hd, dt === 0 ? Infinity : this.cutscene ? 4 : 1); }
    // sun & shadows follow the camera
    this.sun.position.set(this.cam.x - 7, 16, this.cam.z + 5);
    this.sun.target.position.set(this.cam.x, 0, this.cam.z);
    // torch lamps: nearest lit torches / fire doors
    if (this.area.dark) {
      const src = this.entities.filter(e => (e instanceof O.Torch && e.lit) || (e instanceof O.Door && e.lit)).sort((a, b) => Math.hypot(a.x - this.cam.x, a.z - this.cam.z) - Math.hypot(b.x - this.cam.x, b.z - this.cam.z));
      this.lamps.forEach((l, i) => { const s = src[i]; if (s) { l.position.set(s.x, 1.2, s.z); l.intensity = 6 + Math.sin(this.time * 15 + i) * 0.8; } else l.intensity = 0; });
      this.playerLamp.position.set(this.player.x, 1.4, this.player.z);
    }
    this.atmosphere(dt);
    if (this.noRender) return;
    this.ui.drawMini();
    this.pr.render(this.scene, dt);
  }
}

// Where you fell: your dropped pips, marked by a tall gold beam you can see from afar.
class DeathCache extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.t = 0; this.alwaysUpdate = true;
    this.beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5, 0.18), new THREE.MeshBasicMaterial({ color: 0xffd25e, transparent: true, opacity: 0.35, depthWrite: false }));
    this.beam.position.y = 2.5; this.obj.add(this.beam);
    this.pile = new THREE.Group(); this.obj.add(this.pile);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd25e : 0xe0a030 })); m.position.set(Math.cos(i * 1.3) * 0.18, 0.08 + i * 0.03, Math.sin(i * 1.3) * 0.18); m.rotation.y = i; this.pile.add(m); }
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    this.beam.material.opacity = 0.25 + Math.sin(this.t * 3) * 0.1; this.pile.rotation.y += dt;
    if (Math.random() < 0.2) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.4, y: 0.2, z: this.z + (Math.random() - 0.5) * 0.4, vy: 1.4, g: 0, color: 0xffd25e, life: 0.8, size: 0.05 });
    if (Math.hypot(p.x - this.x, p.z - this.z) < 0.7 && p.state !== 'dead') {
      g.addCoins(this.d.coins); sfx('soulpick'); sfx('pipbig'); g.fx.burst(this.x, 0.6, this.z, 24, [0xffd25e, 0xffffff], 3, { g: -1 });
      g.ui.toast('Recovered ' + this.d.coins + ' pips', '', 2); g.flags.deathDrop = null; this.remove(); g.save();
    }
    this.sync();
  }
}

// A shimmering gate out of a cleared Rift floor.
class RiftPortal extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.next = d.next; this.interactable = true; this.solid = true; this.hw = 0.5; this.hd = 0.2;
    const col = this.next ? 0x8b5cf6 : 0x7fd36a;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 6, 20), new THREE.MeshBasicMaterial({ color: col }));
    this.ring.position.y = 0.9; this.obj.add(this.ring);
    this.core = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    this.core.position.y = 0.9; this.obj.add(this.core);
    this.col = col;
  }
  get prompt() { return this.next ? 'Descend to Floor ' + (this.g.riftFloor + 1) : 'Return to Thimblewick'; }
  interact() { const g = this.g; sfx('chime'); if (this.next) g.enterRift(g.riftFloor + 1); else g.warpTo('overworld', 'village'); }
  update(dt) {
    const t = this.g.time;
    this.core.material.opacity = 0.35 + Math.sin(t * 4) * 0.15;
    this.ring.rotation.z = t;
    if (Math.random() < 0.3) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 1.2, y: 0.3 + Math.random() * 1.2, z: this.z, vy: 0.5, g: 0, color: this.col, life: 0.6, size: 0.05 });
  }
}

installWorld6(Game);
installStory6(Story);

installEmberwell(Game,Story);
