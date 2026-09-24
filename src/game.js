import * as THREE from 'three';
import { buildOverworld, buildDungeon, buildGrotto } from './world/maps.js';
import { buildTerrain, buildLiquids, buildScenery, windUniform, clipUniform } from './world/build.js';
import { T, blocksObject } from './world/tiles.js';
import { FX } from './fx.js';
import { PITCH } from './engine/pixel.js';
import { UI } from './ui.js';
import { Story } from './story.js';
import { sfx, playMusic } from './engine/audio.js';
import { angDiff, clamp } from './engine/util.js';
import { Player } from './entities/player.js';
import { makeEnemy } from './entities/enemies.js';
import { Boss } from './entities/boss.js';
import { Pickup } from './entities/common.js';
import * as O from './entities/objects.js';
import { Entity } from './entities/entity.js';
import { MONSTER_NAMES } from './entities/monsters2.js';
import { CLASSES, computeStats, xpNeed, MAX_LEVEL } from './rpg/classes.js';
import { genItem, starterWeapon, RARITY, itemPower } from './rpg/items.js';
import { GearDrop, LootChest, thornBurst, blast, chainLightning } from './rpg/combat.js';
import { flashObj } from './entities/common.js';
import { loadSettings, applySettings } from './settings.js';
import { Guide } from './guide.js';

const SAVE_KEY = 'mossling-save-v2';
export const BAG_SIZE = 30;
const BUILDERS = { overworld: buildOverworld, dungeon: buildDungeon, grotto: buildGrotto };

export function defaultInv() {
  return { cls: 'samurai', level: 1, xp: 0, sp: 0, skills: [1, 0, 0], equip: { weapon: null, helm: null, armor: null, charm: null }, bag: [], vessels: 0,
    hp: 60, maxHp: 60, coins: 0, keys: 0, bigkey: false, bellows: false, galeValve: false, potions: 2, maxPotions: 3, chimes: [] };
}

export class Game {
  constructor(pr, input) {
    this.pr = pr; this.input = input;
    this.scene = new THREE.Scene();
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.fx = new FX(this.scene);
    this.ui = new UI(this);
    this.story = new Story(this);
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
    this.res = 100;
    this.guide = new Guide(this);
    applySettings(loadSettings(), this);
    this.recalc();
  }

  // ------------------------------------------------ RPG layer
  setClass(cls) {
    const inv = this.inv;
    inv.cls = cls;
    inv.equip.weapon = starterWeapon(cls);
    this.recalc(); inv.hp = inv.maxHp;
  }
  recalc() {
    const inv = this.inv;
    this.pstats = computeStats(inv);
    inv.maxHp = this.pstats.maxHp;
    inv.hp = Math.min(inv.hp, inv.maxHp);
    if (this.player && this.player.m.setWeapon) this.player.m.setWeapon(inv.equip.weapon);
    this.hudDirty = true;
  }
  diffMult() { return { story: 0.6, normal: 1, hard: 1.45 }[this.settings.difficulty] || 1; }
  zoneLevel(x, z) {
    const a = this.area;
    if (!a) return 1;
    if (a.id === 'dungeon') { const r = this.roomAt(x, z); return r && (r.id === 'pre' || r.id === 'boss' || r.id === 'heart') ? 5 : 4; }
    if (a.id === 'grotto') return 5;
    const r = a.regions && a.regions.find(r => x >= r.x0 && x < r.x1 && z >= r.y0 && z < r.y1);
    return (r && r.level) || 2;
  }
  scaleEnemy(e, opts = {}) {
    const zl = this.zoneLevel(e.x, e.z);
    const pl = this.inv.level;
    e.level = Math.max(zl, Math.min(pl - 1, zl + 4));
    const mult = 6 * (1 + 0.3 * (e.level - 1));
    e.hp = e.hp * mult; e.maxHp = e.hp;
    e.xpValue = ({ blot: 6, seedling: 2, beetle: 14, puffer: 10, wisp: 8, knight: 40, scorpion: 14, imp: 12, wraith: 16, brigand: 20, sporeling: 4, treant: 60, golem: 80, thief: 50 }[e.kind] || 6) * (1 + 0.15 * (e.level - 1));
    if (!opts.noElite && e.kind !== 'thief' && Math.random() < (opts.eliteChance ?? 0.07)) this.makeElite(e);
    return e;
  }
  makeElite(e) {
    const mods = ['Swift', 'Brutal', 'Vampiric', 'Armoured', 'Volatile'];
    e.elite = mods[Math.floor(Math.random() * mods.length)];
    e.hp *= 3; e.maxHp = e.hp; e.xpValue *= 4;
    e.obj.scale.setScalar(1.35); e.eliteScale = 1.35;
    if (e.elite === 'Swift') e.speed *= 1.5;
    if (e.elite === 'Brutal') e.dmgMul = 1.6;
    if (e.elite === 'Armoured') e.dmgTaken = 0.6;
    const col = { Swift: 0x7ad8ff, Brutal: 0xff5a4a, Vampiric: 0xc4386a, Armoured: 0xc0c0d0, Volatile: 0xffb347 }[e.elite];
    e.auraColor = col;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; e.obj.add(ring); e.aura = ring;
    e.displayName = e.elite + ' ' + ({ blot: 'Blotling', beetle: 'Thornback', puffer: 'Puffer', wisp: 'Hushwisp', knight: 'Hush Knight', seedling: 'Seedling', ...MONSTER_NAMES }[e.kind] || 'Hushling');
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
      this.spawnDef(r.def); return false;
    });
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
  }
  // one player hit on one target: rolls damage, crits, procs, numbers
  playerHit(e, o) {
    const ps = this.pstats, p = this.player, inv = this.inv;
    if (!e.isEnemy) { e.onHit && e.onHit({ dmg: 1, kind: o.kind, kb: o.kb, dir: o.dir, src: p }); return; }
    let dmg = (ps.wmin + Math.random() * (ps.wmax - ps.wmin)) * (o.mult ?? 1) * (1 + ps.dmgPct / 100);
    if (o.ability) dmg *= 1 + ps.abilityDmg / 100;
    if (ps.uniques.has('onigrin') && inv.hp < inv.maxHp / 2) dmg *= 1.4;
    if (e.status && e.status.mark > 0) dmg *= 1.25;
    if (ps.uniques.has('candlewick') && e.status && e.status.burn > 0) dmg *= 1.2;
    const crit = Math.random() * 100 < ps.crit;
    if (crit) dmg *= 1 + ps.critDmg / 100;
    dmg *= e.dmgTaken || 1;
    dmg = Math.max(1, Math.round(dmg));
    const r = e.onHit({ dmg, kind: o.kind, kb: o.kb, dir: o.dir, src: o.src || p, crit });
    if (r !== 'hit') return r;
    this.guide.event('attack');
    e.hpShow = 3;
    if (!o.quiet || crit) this.ui.float(e.x, 1.0 + (e.eliteScale ? 0.3 : 0), e.z, (crit ? '' : '') + dmg + (crit ? '!' : ''), crit ? '#ffd25e' : '#ffffff', crit);
    if (ps.lifesteal || (ps.uniques.has('onigrin') && inv.hp < inv.maxHp / 2)) this.heal(dmg * ((ps.lifesteal || 0) + (ps.uniques.has('onigrin') && inv.hp < inv.maxHp / 2 ? 6 : 0)) / 100, true);
    if (inv.cls === 'samurai' && !o.ability) this.res = Math.min(100, this.res + 7);
    p.combatT = 4;
    if (!o.noProc && !e.dead) {
      if (o.forceBurn || Math.random() * 100 < ps.burn || (ps.uniques.has('candlewick') && o.kind === 'bolt')) e.applyStatus && e.applyStatus('burn', 3, dmg * 0.15);
      if (Math.random() * 100 < ps.chill) e.applyStatus && e.applyStatus('chill', 2.5);
      if (!o.noShock && Math.random() * 100 < ps.shock) chainLightning(this, e.x, e.z, 0.5, 2, 4);
      if (ps.uniques.has('rootcleaver') && Math.random() < 0.25) thornBurst(this, e.x, e.z, 0.7);
      if (crit && ps.uniques.has('huntermoon')) e.applyStatus && e.applyStatus('mark', 4);
      if (crit && ps.uniques.has('silentdawn')) p.cds[0] *= 0.6;
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
      const C = CLASSES[inv.cls];
      const unlocked = C.abilities.find(a => a.lvl === inv.level);
      C.abilities.forEach((a, i) => { if (inv.level >= a.lvl && !inv.skills[i]) inv.skills[i] = 1; });
      this.recalc(); inv.hp = inv.maxHp; this.res = 100;
      const p = this.player;
      this.fx.ring(p.x, p.z, 0.3, 3, 0xffd25e, 0.7); this.fx.burst(p.x, 0.5, p.z, 30, [0xffd25e, 0xffffff], 3, { g: -1 });
      sfx('fanfare'); this.pr.addFlash(0.25, 0xffd25e);
      this.ui.banner('LEVEL UP', 'Level ' + inv.level, 2.2);
      this.ui.toast(unlocked ? 'New ability: ' + unlocked.name + ' [' + unlocked.key + ']' : '+1 Skill Point', unlocked ? unlocked.desc : 'Press I → Skills to spend it.', 3);
      this.save();
    }
  }
  pickupItem(it) {
    const inv = this.inv;
    if (inv.bag.length >= BAG_SIZE) return false;
    inv.bag.push(it);
    const R = RARITY[it.r];
    sfx(it.r >= 2 ? 'pipbig' : 'pip');
    const up = it.cls && it.cls !== inv.cls ? '' : (itemPower(it) > itemPower(inv.equip[it.slot]) ? ' ▲' : '');
    this.ui.lootToast(it, up);
    this.guide.event('loot');
    this.stats.items = (this.stats.items || 0) + 1;
    if (!this.flags.tutLoot) { this.flags.tutLoot = true; setTimeout(() => this.ui.toast('You found gear!', 'Press I to open your bag and equip it.', 3.5), 600); }
    this.hudDirty = true;
    return true;
  }
  canEquip(it) { return !it.cls || it.cls === this.inv.cls; }
  equipItem(i) {
    const inv = this.inv, it = inv.bag[i];
    if (!it) return;
    if (!this.canEquip(it)) { sfx('error'); this.ui.toast('Only a ' + CLASSES[it.cls].name + ' can use that.', 'Salvage it for pips.', 1.6); return; }
    const old = inv.equip[it.slot];
    inv.equip[it.slot] = it;
    inv.bag.splice(i, 1);
    if (old) inv.bag.splice(i, 0, old);
    sfx('unlock');
    this.guide.event('equip');
    this.recalc();
  }
  salvageItem(i) {
    const inv = this.inv, it = inv.bag[i];
    if (!it) return;
    inv.bag.splice(i, 1);
    const v = Math.max(1, Math.round(it.value * 0.35));
    this.addCoins(v); sfx('pip');
    this.ui.toast('Salvaged ' + it.name, '+' + v + ' pips', 1.2);
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
  addSurge(n) { if (this.pstats && this.pstats.uniques.has('firstchime')) n *= 2; const was = this.surge; this.surge = Math.min(100, this.surge + n); if (was < 100 && this.surge >= 100) { sfx('charged'); this.ui.toast('BELL SURGE ready!', 'Press R', 1.4); } this.hudDirty = true; }
  addCoins(n) { this.inv.coins = Math.min(9999, this.inv.coins + n); this.hudDirty = true; }
  heal(n, quiet) { if (n <= 0) return; const before = this.inv.hp; this.inv.hp = Math.min(this.inv.maxHp, this.inv.hp + n); if (!quiet && this.player && this.inv.hp - before >= 1) this.ui.float(this.player.x, 1.1, this.player.z, '+' + Math.round(this.inv.hp - before), '#7fd36a'); this.ui.hearts(!quiet); }
  gainHeartContainer(silent) {
    this.inv.vessels = (this.inv.vessels || 0) + 1; this.recalc(); this.inv.hp = this.inv.maxHp; this.ui.hearts(true);
    if (!silent) { sfx('fanfare'); this.ui.toast('Heart Vessel!', 'Your life grows by one heart.', 2.4); }
    this.save();
  }
  drinkPotion() {
    const inv = this.inv;
    if (inv.potions <= 0) { sfx('error'); this.ui.toast('No tonics left.', 'Posy sells them in Thimblewick.', 1.4); return; }
    if (inv.hp >= inv.maxHp) { sfx('error'); this.ui.toast('Already at full health.', '', 1); return; }
    inv.potions--; this.heal(inv.maxHp * 0.45); sfx('potion');
    this.fx.burst(this.player.x, 0.6, this.player.z, 16, [0xff6a7a, 0xffffff], 2, { g: -1 });
    this.hudDirty = true;
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ inv: this.inv, flags: this.flags, checkpoint: this.checkpoint, playTime: this.playTime, stats: this.stats })); } catch (e) {}
  }
  static hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      this.inv = Object.assign(defaultInv(), s.inv); this.flags = s.flags || {}; this.checkpoint = s.checkpoint || this.checkpoint;
      this.playTime = s.playTime || 0; this.stats = s.stats || {};
      this.recalc(); this.inv.hp = this.inv.maxHp;
      return true;
    } catch (e) { return false; }
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
    this.entities = []; this.solids = []; this.sigs = {}; this.tokens = 0;
    this.bossActive = null; this.ui.bossBar(null);
    const area = BUILDERS[id]();
    this.area = area;
    this.world.add(buildTerrain(area));
    this.world.add(buildLiquids(area, this.liquidTime));
    this.world.add(buildScenery(area));
    // lights & mood
    this.scene.background = new THREE.Color(area.sky);
    this.sun.color.set(area.sun); this.sun.intensity = area.dark ? 1.0 : 2.3;
    this.hemi.color.set(area.dark ? 0xa89ad0 : 0xbfd8ff); this.hemi.groundColor.set(area.dark ? 0x3a3040 : 0x6a5a3a);
    this.hemi.intensity = area.dark ? 1.5 : 1.25;
    this.playerLamp.intensity = area.dark ? 3 : 0;
    this.fx.setAmbient(id === 'overworld' ? 'pollen' : 'motes');
    this.pr.setViewHeight(area.dungeon ? 13.2 : 12);
    this.updateGrade();
    // player
    const sp = typeof spawn === 'object' ? spawn : area.spawns[spawn] || Object.values(area.spawns)[0];
    this.player = new Player(this, sp.x, sp.z);
    this.player.facing = area.dungeon ? Math.PI : 0;
    this.spawn(this.player);
    // entities
    for (const d of area.defs) this.spawnDef(d);
    for (const e of this.entities) if (e instanceof O.Torch && e.puzzle && !this._tg?.[e.group]) { (this._tg = this._tg || {})[e.group] = true; const tg = new O.TorchGroup(this, e.group); tg.alwaysUpdate = true; this.spawn(tg); }
    this._tg = null;
    this.room = null;
    this.updateRoom(true);
    clipUniform.value = this.room ? this.room.z1 - 1 : 1e9;
    this.snapCamera();
    this.music = null; this.musicOvr = null;
    this.region = null;
    this.updateRegion(true);
    this.ui.updateHud();
    this.guide.render();
    this.bell = this.entities.find(e => e instanceof O.Bell);
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
      case 'board': e = new O.Sign(this, { ...d, text: '' }); e.interact = () => this.story.board(); Object.defineProperty(e, 'prompt', { get: () => 'Bounties' }); e.obj.visible = false; e.solid = false; break;
      case 'npc': e = new O.NPC(this, d); break;
      case 'bell': e = new O.Bell(this, d); break;
      case 'gate': e = new O.Gate(this, d); break;
      case 'windmill': e = new O.Windmill(this, d); break;
      case 'roots': e = new O.Roots(this, d); break;
      case 'exitglow': e = new O.ExitGlow(this, d); break;
      case 'warp': e = new O.Warp(this, d); e.alwaysUpdate = true; break;
      case 'enemy': {
        if (this.area.id === 'overworld' && f.hushLifted && d.x < 44 && Math.random() < 0.5) return;
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
      default: return;
    }
    if (e) { if (d.room) e.room = d.room; this.spawn(e); }
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
      this.checkpoint = { area: id, spawn: typeof spawn === 'string' ? spawn : this.checkpoint.spawn };
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
    sfx('hurt');
    this.ui.bossBar(null);
    setTimeout(() => { this.dead = true; this.ui.show('gameover', true); }, 1300);
  }
  revive() {
    this.dead = false; this.ui.show('gameover', false);
    this.inv.hp = this.inv.maxHp;
    this.surge = 0;
    this.warpTo(this.checkpoint.area, this.checkpoint.spawn);
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
  checkBossRoom(d) {
    if (this.flags.bossKilled || this.bossActive || !this.room || this.room.id !== d.room) return;
    const p = this.player;
    if (p.z > this.room.z1 - 2.5) return;
    this.sealRoom(d.room, true);
    const b = new Boss(this, d.x, d.z);
    this.bossActive = b;
    this.spawn(b);
    this.cutscene = true;
    this.camFocus = { x: d.x, z: d.z + 3 };
    sfx('roar'); this.pr.addShake(1);
    playMusic(null);
    this.ui.banner('THE CHOKING ROOT', 'BRAMBLEMAW', 2.6);
    setTimeout(() => { this.cutscene = false; this.camFocus = null; this.musicOverride('boss'); this.ui.bossBar(b.name, 1); }, 2400);
  }
  onBossDying(b) {
    for (const e of this.entities) if (e.isEnemy && e !== b && !e.dead) e.die(null, 'fall');
    this.ui.bossBar(null);
    this.cutscene = true;
    this.camFocus = { x: b.x, z: b.z + 2 };
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
    if (e.def && this.area.id === 'overworld') (this.respawnQ || (this.respawnQ = [])).push({ def: e.def, t: this.time + 70 + Math.random() * 40 });
    this.story.bountyEvent(e.elite ? ['kill', e.kind, 'elite'] : ['kill', e.kind]);
    this.gainXp(e.xpValue || 5);
    if (ps.uniques.has('hexbloom')) blast(this, e.x, e.z, 1.8, 0.9, 0x8b5cf6, { ability: true });
    if (e.elite === 'Volatile') { this.fx.ring(e.x, e.z, 0.2, 2, 0xffb347, 0.4); const p = this.player; if (Math.hypot(p.x - e.x, p.z - e.z) < 2) p.hurt({ dmg: 2, x: e.x, z: e.z, src: e, kb: 6 }); }
    const lvl = e.level || this.inv.level;
    if (e.elite) { this.dropGear(e.x, e.z, { level: lvl, floor: 2, bonus: 0.6 }); if (Math.random() < 0.4) this.dropGear(e.x, e.z, { level: lvl, floor: 1 }); }
    else if (Math.random() < ({ knight: 0.6, beetle: 0.14, puffer: 0.12 }[e.kind] ?? 0.08) * (1 + ps.mf / 200)) this.dropGear(e.x, e.z, { level: lvl, floor: e.kind === 'knight' ? 1 : 0 });
  }

  startIntroFight() {
    const a = new O.Arena(this, { id: 'intro', x: 58.5, z: 70, radius: 99 }, [
      [['blot', -2, 1], ['blot', 2, 1], ['blot', 0, 3]],
      [['blot', -3, 0], ['blot', 3, 0], ['blot', -1, 3], ['blot', 1, 3]],
    ], { title: 'HUSHLINGS!', victory: 'Thimblewick is safe… for now.', onClear: () => { this.story.introWon(); const p = this.player; this.spawn(new GearDrop(this, p.x, p.z + 1.2, genItem({ level: 2, cls: this.inv.cls, slot: 'weapon', rarity: 1 }))); this.spawn(new GearDrop(this, p.x + 1, p.z + 1, genItem({ level: 2, slot: 'armor', rarity: 1 }))); } });
    a.alwaysUpdate = true;
    this.spawn(a);
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
  gust(p, power) {
    const valve = this.inv.galeValve ? 1.4 : 1;
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
    sfx('surge'); this.pr.addShake(1.2); this.pr.addFlash(0.5, 0xfff3b0); this.hitstop(0.1);
    this.fx.ring(p.x, p.z, 0.5, 6, 0xfff3b0, 0.6); this.fx.ring(p.x, p.z, 0.3, 4, 0xffd25e, 0.45, 0.4);
    this.fx.burst(p.x, 0.3, p.z, 40, [0xfff3b0, 0xffd25e, 0xffffff], 6);
    p.attackId++; p.hitSet.clear();
    this.hitArc(p, p.x, p.z, 0, 5.5, Math.PI, { mult: 4, kind: 'surge', kb: 13, id: p.attackId, ability: true });
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
    const text = c.kind === 'pips' ? `You found *${n} pips*!` : `You got the *${info.name}*!\n${info.desc}`;
    setTimeout(() => {
      this.ui.say(null, text, () => {
        this.endHold();
        switch (c.kind) {
          case 'key': inv.keys++; break;
          case 'bigkey': inv.bigkey = true; break;
          case 'item': inv[c.item] = true; if (c.item === 'bellows') this.ui.toast('Gustbellows: L (hold for a gale)', 'Try it on the pinwheel!', 4); break;
          case 'heart': this.gainHeartContainer(true); break;
          case 'pips': this.addCoins(n); break;
          case 'potion': inv.potions = Math.min(inv.maxPotions, inv.potions + 1); break;
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
    if (this.area && this.area.dark) { u.grade.value.set(1.05, 1.0, 1.08); u.desat.value = 0; u.vignette.value = 0.8; return; }
    u.vignette.value = 0.35;
    if (this.flags.hushLifted) { u.grade.value.set(1.06, 1.03, 0.96); u.desat.value = 0; }
    else { u.grade.value.set(0.97, 0.95, 1.04); u.desat.value = 0.14; }
  }
  musicOverride(name) { this.musicOvr = name; this.applyMusic(); }
  applyMusic() {
    let m = this.musicOvr || (this.region && this.region.music) || this.area.music;
    if (this.bossActive) m = 'boss';
    playMusic(m);
  }
  updateRegion(force) {
    if (!this.area.regions) { if (force) this.applyMusic(); return; }
    const p = this.player;
    const r = this.area.regions.find(r => p.x >= r.x0 && p.x < r.x1 && p.z >= r.y0 && p.z < r.y1);
    if (r !== this.region || force) {
      const prev = this.region;
      this.region = r;
      if (prev && r && prev.name !== r.name) this.ui.areaName(r.name);
      this.applyMusic();
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
    this.time += dt;
    windUniform.value = this.time;
    this.liquidTime.value = this.time;
    const input = this.input;
    this.ui.update(dt);
    if (this.dead) { if (input.pressed('interact')) this.revive(); this.render(dt); return; }
    if (this.ui.updateShop(input)) { this.render(dt); return; }
    if (this.ui.updateInventory(input)) { this.render(dt); return; }
    if (input.pressed('inventory') && !this.locked() && !this.dead) { this.ui.openInventory(); this.render(dt); return; }
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
    // solids cache for next frame
    this.solids = this.entities.filter(e => e.solid && Math.abs(e.x - p.x) < 24 && Math.abs(e.z - p.z) < 20);
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
    if (this.held) { this.held.rotation.y += dt * 2; this.held.position.y = 1.35 + Math.sin(this.time * 3) * 0.05; }
    this.render(dt);
  }
  render(dt) {
    const t = this.camTarget();
    const k = 1 - Math.exp(-dt * (this.room ? 7 : 6));
    this.cam.x += (t.x - this.cam.x) * k; this.cam.z += (t.z - this.cam.z) * k;
    this.pr.target.copy(this.cam);
    // sun & shadows follow the camera
    this.sun.position.set(this.cam.x - 7, 16, this.cam.z + 5);
    this.sun.target.position.set(this.cam.x, 0, this.cam.z);
    // torch lamps: nearest lit torches / fire doors
    if (this.area.dark) {
      const src = this.entities.filter(e => (e instanceof O.Torch && e.lit) || (e instanceof O.Door && e.lit)).sort((a, b) => Math.hypot(a.x - this.cam.x, a.z - this.cam.z) - Math.hypot(b.x - this.cam.x, b.z - this.cam.z));
      this.lamps.forEach((l, i) => { const s = src[i]; if (s) { l.position.set(s.x, 1.2, s.z); l.intensity = 6 + Math.sin(this.time * 15 + i) * 0.8; } else l.intensity = 0; });
      this.playerLamp.position.set(this.player.x, 1.4, this.player.z);
    } else this.lamps.forEach(l => l.intensity = 0);
    if (this.noRender) return;
    this.ui.drawMini();
    this.pr.render(this.scene, dt);
  }
}
