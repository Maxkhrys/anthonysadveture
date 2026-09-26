// SURVIVAL mode controller. Owns one survival world while it is played and connects it to the
// normal game: the same player, classes, weapons, enemies, HUD and effects, with the survival
// save (store.js) in place of the story save. Story state is never read or written here.
import * as THREE from 'three';
import { SurvivalStore, RESOURCES } from './store.js';
import { buildWilds, CH } from './world.js';
import { buildCave } from './cave.js';
import { ResourceNode, NodeBatch, Structure, CaveMouth, Landmark, LootCache, PIECES, pieceParts } from './entities.js';
import { KIT, isKit, levelY, STOREY } from './kit.js';
import { HouseGrid, Cutaway, applySupport, supportHeight, sameLevel, levelOf, placeWhy, removeWhy, snapPiece, slotKey, pieceBase, footprint, locate, spans, FURNITURE, STEP } from './houses.js';
import { KitPiece, pieceLook } from './pieces.js';
import { instantiate, TEMPLATES } from './templates.js';
import { RECIPES } from './craft.js';
import { WORLD, GEN_VERSION, BIOMES } from './biome.js';
import { regionPoi } from './gen.js';
import { T, isSolid, isLiquid } from '../world/tiles.js';
import { defaultInventory, createProfile, runtimeEquipment, copy } from '../persistence/model.js';
import { restoreCharacter } from '../persistence/session.js';
import { starterWeapon } from '../rpg/items.js';
import { makeEnemy } from '../entities/enemies.js';
import { Entity } from '../entities/entity.js';
import { geo, B, MAT } from '../models.js';

// spawn order inside a chunk: what a piece rests on comes first (stairs read the floor under
// them, gables the roof beside them)
const LAYER_ORDER = { floor: 0, post: 1, wall: 2, stairs: 3, roof: 4, gable: 5 };
const byLayer = (a, b) => (LAYER_ORDER[KIT[a.type]?.layer] ?? 6) - (LAYER_ORDER[KIT[b.type]?.layer] ?? 6) || (a.lv | 0) - (b.lv | 0);
const LEVEL_NAME = lv => lv === 0 ? 'ground floor' : lv === 1 ? 'upper floor' : 'level ' + lv;
const FACING = ['south', 'east', 'north', 'west'];
import { sfx } from '../engine/audio.js';

export const HINTS = [
  ['wood', 'Hit a tree with your weapon to gather wood (5 wood).'],
  ['stone', 'Now strike a rock for stone (3 stone).'],
  ['campfire', 'Open crafting with G and make a Campfire, then place it near camp.'],
  ['workbench', 'Craft a Workbench: it unlocks walls, doors, roofs and a storage chest.'],
  ['explore', 'Follow a path out of the clearing. A cave lies east of camp.'],
  ['cave', 'Enter the cave, clear it, and bring its reward home.'],
];

class SurvivalSession { // the character session: writes only the survival world record
  constructor(mode) { this.mode = mode; this.profile = { revision: 0 }; }
  save() { this.mode.capture(); this.mode.store.save(this.mode.record); this.profile.revision++; return Promise.resolve(this.profile); }
}
// the exit out of a cave
class CaveExit extends Entity {
  constructor(g, x, z, mode) { super(g, x, z); this.mode = mode; this.interactable = true; this.cool = 1; this.obj.add(new THREE.Mesh(geo([B(1.6, 0.05, 0.9, 0, 0, 0, 0xfff3b0)]), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.5 }))); }
  get prompt() { return 'Leave the cave'; }
  interact() { this.mode.leaveCave(); }
  update(dt) { this.cool -= dt; const p = this.g.player; if (this.cool < 0 && Math.hypot(p.x - this.x, p.z - this.z) < 0.6 && !this.g.transitioning) this.mode.leaveCave(); }
}

export class SurvivalMode {
  constructor(g, storage) { this.g = g; this.store = new SurvivalStore(storage); this.active = false; this.grid = new HouseGrid(); this.cut = new Cutaway(this.grid); this.dt = 1 / 60; }
  // ---------------------------------------------------------------- start / stop
  start(record) {
    const g = this.g, R = this.record = record;
    this.active = true; g.mode = 'survival'; g.survival = this; document.documentElement.classList.add('mode-survival');
    this.damage = {}; this.killed = new Set(); this.live = new Map(); this.byChunk = new Map(); this.lightsInUse = 0; this.build = null; this.saveT = 0;
    if (record.genVersion !== GEN_VERSION) this.versionNote = `This world was made with generator v${record.genVersion}; it keeps that layout.`;
    // the character: a normal inventory built through the same path as story characters
    let inv = R.character.inv ? copy(R.character.inv) : null;
    if (!inv) { inv = defaultInventory(R.character.cls); inv.equip.weapon = starterWeapon(R.character.cls); inv.potions = 2; }
    const profile = createProfile({ name: R.name, classId: R.character.cls, inventory: inv, seed: R.seed });
    profile.id = 'survival:' + R.id;
    profile.world.checkpoint = { area: 'wilds', spawn: R.home ? 'home' : 'start' };
    restoreCharacter(g, profile);
    g.inv.equip = runtimeEquipment(g.inv.equip);
    g.characterSession = new SurvivalSession(this);
    g.flags.introFought = true; g.flags.stage = 3; g.flags.tutLoot = true; // story tutorials never run here
    g.flags.onboarding = { version: 1, phase: 'complete', done: {} }; // the story tutorial is not part of survival
    g.recalc(); g.inv.hp = g.inv.maxHp; g.res = 100;
    const pos = R.pos && R.pos.x != null ? { x: R.pos.x, z: R.pos.z } : 'start';
    this.pendingFy = pos === 'start' ? 0 : +R.pos.fy || 0; // standing upstairs when saved
    // Survival houses: storey heights, storey-separated combat and floor-aware spawning
    g.support = e => applySupport(this.grid, e, this.dt);
    g.sameLevel = sameLevel;
    g.onSpawn = e => this.onSpawn(e);
    g.checkpoint = { area: 'wilds', spawn: R.home ? 'home' : 'start' };
    g.loadArea('wilds', pos);
    g.ui.areaName && g.ui.areaName(R.name);
    this.ui && this.ui.show();
  }
  quit() { this.endBuild(); this.g.save().then(() => this.onQuit && this.onQuit()); }
  stop() {
    this.active = false; this.g.mode = 'story'; this.g.survival = null; document.documentElement.classList.remove('mode-survival'); this.ui && this.ui.hide();
    this.g.support = this.g.sameLevel = this.g.onSpawn = null; this.grid.clear(); this.cut.reset();
  }
  // new entities start on the floor they appear on (shots and drops from upstairs stay upstairs)
  onSpawn(e) {
    // statuses (burn, chill, root...) from the player's effects never cross a floor either
    if (e.isEnemy && e.applyStatus && !e._lvStatus) { const a = e.applyStatus.bind(e); e._lvStatus = true; e.applyStatus = (...args) => { const p = this.g.player; if (this.g.sameLevel && p && !sameLevel(p, e)) return; return a(...args); }; }
    if (e.fy !== undefined || e.isCollider) return;
    // the shooter is whoever it appears next to: the player first (your shots and drops start
    // within a step of you), otherwise the nearest creature
    const g = this.g, p = g.player; let ref = 0, bd = 2.2;
    const dp = p && !p.dead ? Math.hypot(e.x - p.x, e.z - p.z) : 1e9;
    if (dp < 1.3) ref = p.fy || 0;
    else {
      if (dp < bd) { bd = dp; ref = p.fy || 0; }
      if (this.grid.slots.size) for (const o of g.entities) if (o.isEnemy && !o.dead && o !== e) { const d = Math.hypot(e.x - o.x, e.z - o.z); if (d < bd) { bd = d; ref = o.fy || 0; } }
    }
    e.fy = ref ? supportHeight(this.grid, e.x, e.z, ref) : 0;
    if (e.fy && e.gy0 !== undefined) e.gy0 += e.fy; // projectiles fly level from where they were loosed
  }
  // Game.loadArea asks for survival areas here
  buildArea(id) {
    if (!this.active) return null;
    if (id === 'wilds') { this.cave = null; return (this.wilds = buildWilds(this.record, this)); }
    if (id === 'cave' && this.caveId) { const lvl = this.wilds ? this.wilds.placeAt(this.caveAt.x, this.caveAt.z).level + 1 : 2; return (this.cave = buildCave(this.record.seed, this.caveId, lvl)); }
    return null;
  }
  // called after the area's entities are cleared and the player exists
  onAreaLoaded(area) {
    this.live = new Map(); this.byChunk = new Map(); this.batches = new Map(); this.lightsInUse = 0; this.caveFoes = null; this.streamT = 0;
    this.grid.clear(); this.cut.reset(); this.houses = new Map();
    const g = this.g;
    if (area.id === 'wilds') {
      const p = g.player; area.ensureChunk(Math.floor(p.x / CH), Math.floor(p.z / CH));
      this.stream(true);
      // back upstairs where the save left you, if that floor still stands; otherwise the ground
      const want = this.pendingFy || 0; this.pendingFy = 0;
      if (want > 0) { const h = supportHeight(this.grid, p.x, p.z, want); p.fy = Math.abs(h - want) < 0.3 ? h : 0; }
      if (!this.freeTile(p.x, p.z, p.fy || 0)) this.unstick(true);
      p.sync(); g.snapCamera && g.snapCamera();
    }
    if (area.id === 'cave') {
      const C = this.caveState(this.caveId);
      for (const n of area.nodes) if (!C.removed[n.id]) g.spawn(new ResourceNode(g, n, this));
      g.spawn(new CaveExit(g, area.exit.x, area.exit.z, this));
      g.spawn(new LootCache(g, { id: 'cavechest:' + this.caveId, x: area.reward.x, z: area.reward.z, loot: 'cave' }, this));
      this.caveFoes = [];
      if (!C.cleared) for (const m of area.packs) { const e = this.enemy(m.kind, m.x, m.z); if (e) this.caveFoes.push(e); }
      g.ui.toast && g.ui.toast(C.cleared ? 'A cleared cave' : 'A wild cave', C.cleared ? 'Quiet now. Crystals and ore still grow here.' : 'Something lives down here. Clear it for good.', 2.6);
    }
  }
  enemy(kind, x, z) {
    const g = this.g, e = makeEnemy(g, kind, x, z); if (!e) return null;
    g.scaleEnemy(e, { eliteChance: 0.04 }); g.spawn(e); return e;
  }

  // ---------------------------------------------------------------- streaming (wilds)
  chunkOf(x, z) { return Math.floor(x / CH) + ',' + Math.floor(z / CH); }
  onChunkGenerated(c) { }
  stream(all) {
    const g = this.g, A = g.area, p = g.player; if (!A || A.id !== 'wilds') return;
    const pcx = Math.floor(p.x / CH), pcz = Math.floor(p.z / CH);
    A.ensureChunk(pcx, pcz);
    const want = new Set(); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) want.add((pcx + dx) + ',' + (pcz + dz));
    for (const k of want) if (!this.byChunk.has(k) && A.chunks.has(k)) this.spawnChunk(A.chunks.get(k), k);
    for (const [k, list] of this.byChunk) {
      if (want.has(k)) continue;
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= 2) continue; // hysteresis: drop only well out of range
      for (const e of list) if (!e.dead && !(e.isEnemy && (e.aggro > 0 && e.state !== 'idle' && e.dist(p) < 14))) e.remove();
      this.byChunk.delete(k); const bt = this.batches?.get(k); if (bt) { bt.dispose(); this.batches.delete(k); }
      for (const [id, d] of this.grid.deco) if (d.ent.dead) this.grid.deco.delete(id);
      for (const [id, h] of this.houses) if (h.key === k) this.houses.delete(id);
      this.grid.version++;
    }
    const key = pcx + ',' + pcz; if (!this.record.explored.includes(key)) { this.record.explored.push(key); if (this.record.explored.length > 4000) this.record.explored.shift(); }
  }
  spawnChunk(c, key) {
    const g = this.g, R = this.record, list = [];
    const nodes = c.nodes.filter(n => !R.removed[n.id]), batch = new NodeBatch(g, nodes); (this.batches || (this.batches = new Map())).set(key, batch);
    for (const n of nodes) list.push(g.spawn(new ResourceNode(g, n, this, batch)));
    for (const d of c.defs) {
      if (d.type === 'cavemouth') list.push(g.spawn(new CaveMouth(g, d, this)));
      else if (d.type === 'svchest') list.push(g.spawn(new LootCache(g, d, this)));
      else list.push(g.spawn(new Landmark(g, d, this)));
    }
    for (const m of c.packs) if (!this.killed.has(m.id)) { const e = this.enemy(m.kind, m.x, m.z); if (e) { e.packId = m.id; list.push(e); } }
    for (const s of R.structures.filter(s => this.chunkOf(s.x, s.z) === key).sort(byLayer)) list.push(this.spawnPiece(s));
    for (const h of c.houses || []) this.spawnHouse(h, list, key);
    this.byChunk.set(key, list);
    this.refreshShapes();
  }
  // one placed or generated piece into the world (kit pieces get the modular entity)
  spawnPiece(s, gen = null) { const g = this.g, e = isKit(s.type) ? new KitPiece(g, s, this, gen) : new Structure(g, s, this); e.gen = gen; return g.spawn(e); }
  // gables and stairs take their shape from pieces that may stream in later: rebuild if changed
  refreshShapes() { for (const e of this.grid.ents.values()) if (e.isKit && (e.type === 'timber_gable' || e.type === 'timber_stairs') && !e.dead) { const k = e.shapeKey(); if (k !== e.shape) e.build(); } }
  // A generated house: the same kit pieces, with stable ids and the player's changes applied.
  // Never built over the player's own pieces; pieces taken down stay down.
  spawnHouse(h, list, key) {
    const g = this.g, R = this.record, H = R.houses[h.id];
    if (H && H.suppressed) return;
    const I = instantiate(h);
    if (!H) { const [x0, z0, x1, z1] = I.rect; if (R.structures.some(s => s.x > x0 - 1 && s.x < x1 + 1 && s.z > z0 - 1 && s.z < z1 + 1)) { R.houses[h.id] = { suppressed: true }; return; } }
    const removed = H?.removed || {}, open = H?.open || {};
    for (const s of I.pieces.sort(byLayer)) { if (removed[s.id]) continue; if (open[s.id]) s.open = true; list.push(this.spawnPiece(s, h.id)); }
    for (const c of I.caches) {
      const e = new LootCache(g, { id: c.id, x: c.x, z: c.z, loot: 'house' }, this); e.fy = supportHeight(this.grid, c.x, c.z, levelY(c.lv) + 0.35);
      list.push(g.spawn(e)); this.grid.deco.set(c.id, { id: c.id, x: c.x, z: c.z, lv: c.lv, ent: e });
    }
    const T = TEMPLATES[h.t]; this.houses.set(h.id, { h, key, x: (I.rect[0] + I.rect[2]) / 2, z: (I.rect[1] + I.rect[3]) / 2, name: T.name });
  }
  removeNode(node) {
    const R = this.record;
    if (node.id.startsWith('c:')) { this.caveState(this.caveId).removed[node.id] = true; }
    else R.removed[node.id] = true;
    delete this.damage[node.id];
    R.stats = R.stats || {}; R.stats.gathered = (R.stats.gathered || 0) + 1;
  }
  // free to stand at (x, z) at height y: open tile, a surface at that height, nothing solid there
  freeTile(x, z, y = 0) {
    const t = this.g.tileAt(Math.floor(x), Math.floor(z)); if (isSolid(t) || isLiquid(t)) return false;
    if (y > 0 && Math.abs(supportHeight(this.grid, x, z, y) - y) > 0.3) return false;
    const probe = { fy: y };
    return !this.g.entities.some(e => e.solid && !e.dead && !e.isPlayer && !e.isEnemy && Math.abs(e.x - x) < e.hw + 0.25 && Math.abs(e.z - z) < e.hd + 0.25 && (!e.solidFor || e.solidFor(probe)));
  }
  // Unstuck: the nearest free spot on the floor you are on, spiralling outward; then open
  // ground; then home
  unstick(silent) {
    const g = this.g, p = g.player, y0 = p.fy || 0;
    for (const y of y0 > 0 ? [y0, 0] : [0]) for (let r = 0; r < 12; r++) for (let a = 0; a < 16; a++) {
      const x = Math.floor(p.x) + 0.5 + Math.round(Math.cos(a / 16 * 6.28) * r), z = Math.floor(p.z) + 0.5 + Math.round(Math.sin(a / 16 * 6.28) * r);
      const yy = y ? supportHeight(this.grid, x, z, y) : 0;
      if (this.freeTile(x, z, yy)) { p.x = x; p.z = z; p.fy = yy; p.fvy = 0; p.sync(); g.snapCamera && g.snapCamera(); if (!silent) g.ui.toast('Unstuck', yy ? 'Moved to open floor nearby.' : 'Moved to the nearest open ground.', 1.6); return true; }
    }
    this.goHome(); return false;
  }
  goHome() {
    const g = this.g; if (g.transitioning || g.player.combatT > 0) { g.ui.toast('Not now', 'You cannot travel home in the middle of a fight.', 1.8); return false; }
    this.caveId = null; g.warpTo('wilds', this.record.home ? { x: this.record.home.x, z: this.record.home.z } : 'start'); return true;
  }

  // ---------------------------------------------------------------- resources, crafting, building
  addResource(res, n, x, z) {
    const R = this.record; if (!RESOURCES.includes(res)) return;
    R.resources[res] += n; this.g.ui.float && this.g.ui.float(x ?? this.g.player.x, 1.2, z ?? this.g.player.z, '+' + n + ' ' + res, '#e8d6a8', false, true);
    this.ui && this.ui.refresh(); this.hintCheck();
  }
  has(cost) { return Object.entries(cost).every(([k, v]) => (this.record.resources[k] || 0) >= v); }
  nearStation(type, r = 4.5) { const p = this.g.player; return this.g.entities.some(e => e.isStructure && e.type === type && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < r); }
  canCraft(id, count = 1) {
    if(!Number.isInteger(count)||count<1||count>99)return {ok:false,why:"Choose 1–99 crafts."};
    const r = RECIPES.find(x => x.id === id); if (!r) return { ok: false, why: 'Unknown recipe.' };
    if (r.station && !this.nearStation(r.station)) return { ok: false, why: 'Needs a ' + PIECES[r.station].name.toLowerCase() + ' nearby.' };
    if(r.gives==='tonic'&&this.g.inv.potions+count*(r.qty||1)>this.g.inv.maxPotions)return {ok:false,why:'No room for that many tonics.'};
    const total=Object.fromEntries(Object.entries(r.cost).map(([k,v])=>[k,v*count]));
    if (!this.has(total)) return { ok: false, why: 'Not enough: ' + Object.entries(total).filter(([k, v]) => this.record.resources[k] < v).map(([k, v]) => (v - this.record.resources[k]) + ' more ' + k).join(', ') + '.' };
    return { ok: true, why: '' };
  }
  craft(id, count = 1) {
    const c = this.canCraft(id,count); if (!c.ok) { sfx('error'); return c; }
    const r = RECIPES.find(x => x.id === id), R = this.record;
    for (const [k, v] of Object.entries(r.cost)) R.resources[k] -= v*count;
    if (r.gives === 'tonic') { this.g.inv.potions = Math.min(this.g.inv.maxPotions, this.g.inv.potions + count*(r.qty||1)); this.g.hudDirty = true; }
    else { R.kits = R.kits || {}; R.kits[r.gives] = (R.kits[r.gives] || 0) + count*(r.qty || 1); }
    sfx('forge'); this.g.ui.toast('Crafted: ' + r.name, r.gives === 'tonic' ? 'A tonic, ready to drink (H).' : 'Place it from the Build list.', 2);
    this.ui && this.ui.refresh(); this.hintCheck(); this.g.save();
    return { ok: true };
  }
  // ---------------------------------------------------------------- building (modular kit + furniture)
  // Build mode: a ghost of the real piece follows the aim, on the chosen level and rotation.
  // Click / C places (hold and sweep to lay rows), right click / X stops, T or the wheel rotates,
  // [ and ] change level. Nothing is spent until a placement succeeds.
  startBuild(type) {
    if (type !== 'demolish' && !((this.record.kits || {})[type] > 0)) { sfx('error'); return false; }
    const keep = this.build; this.endBuild();
    const g = this.g, mat = new THREE.MeshBasicMaterial({ color: 0x7fd36a, transparent: true, opacity: 0.45, depthWrite: false });
    const ghost = new THREE.Group(); g.scene.add(ghost);
    const P = PIECES[type], range = P?.levels || [0, 2], lv = Math.max(range[0], Math.min(range[1], keep ? keep.lv : levelOf(g.player.fy)));
    this.build = { type, ghost, mat, ok: false, why: '', tx: 0, tz: 0, lv, r: keep && keep.type === type ? keep.r : 0, look: '', rec: null, info: '' };
    this.ui && this.ui.refresh();
    return true;
  }
  endBuild() {
    const b = this.build; if (!b) return;
    this.g.scene.remove(b.ghost); b.mat.dispose(); for (const gm of this.ghostGeo || []) gm.dispose(); this.ghostGeo = [];
    this.build = null; this.ui && this.ui.refresh();
  }
  target() {
    const g = this.g, p = g.player, inp = g.input, lv = this.build ? this.build.lv : 0;
    let x = p.x + Math.sin(p.facing) * 1.6, z = p.z + Math.cos(p.facing) * 1.6;
    if (p.aimSrc === 'mouse' && inp.onCanvas) { const q = g.pr.screenToWorld(inp.mouseX, inp.mouseY, levelY(lv) + 0.1); if (Math.hypot(q.x - p.x, q.z - p.z) < 7) { x = q.x; z = q.z; } }
    return { x, z, tx: Math.floor(x), tz: Math.floor(z) };
  }
  // the record a build of this type would place at (x, z)
  recFor(type, x, z, lv, r) { return isKit(type) ? snapPiece(type, x, z, lv, r) : { type, x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5, lv, r: PIECES[type]?.rotates ? r : 0 }; }
  structureAt(tx, tz, type) { return this.g.entities.find(e => e.isStructure && !e.isKit && !e.dead && Math.floor(e.x) === tx && Math.floor(e.z) === tz && (!type || (type === 'roof') === (e.type === 'roof'))); }
  // what the placement rules need from the world
  env() {
    const g = this.g, grid = this.grid;
    const scenery = (x0, z0, x1, z1) => {
      for (const e of g.entities) {
        if (e.dead || !(e.isNode || e instanceof CaveMouth || e instanceof LootCache || e instanceof Landmark)) continue;
        const h = e instanceof Landmark ? 2.4 : e instanceof CaveMouth ? 1.6 : Math.max(e.hw || 0.4, 0.4);
        if ((e.fy || 0) < 0.5 && e.x + h > x0 && e.x - h < x1 && e.z + h > z0 && e.z - h < z1) return 'Clear the space first.';
      }
      return '';
    };
    return {
      player: g.player,
      groundWhy(x0, z0, x1, z1, s) {
        for (let tz = Math.floor(z0); tz < Math.ceil(z1); tz++) for (let tx = Math.floor(x0); tx < Math.ceil(x1); tx++) {
          const t = g.tileAt(tx, tz); if (isSolid(t) || isLiquid(t) || t === T.SHALLOW || t === T.PIT) return 'Needs open, dry ground.';
          const o = grid.tile(0, tx, tz) || grid.get('lr:0:' + tx + ',' + tz);
          if (o && (PIECES[o.type]?.legacy || KIT[s.type].kind === 'cell')) return PIECES[o.type]?.legacy ? 'An old tile piece stands here; take it down first.' : 'Move the ' + PIECES[o.type].name.toLowerCase() + ' first.';
        }
        return scenery(x0, z0, x1, z1);
      },
      bodies() { return g.entities.filter(e => !e.dead && (e.isPlayer || (e.isEnemy && e.moveMode !== 'fly'))).map(e => ({ x: e.x, z: e.z, r: e.r || 0.3, fy: e.fy || 0, isPlayer: !!e.isPlayer })); },
      // furniture on bare ground keeps the first pass's rules; on a floor, only bodies matter
      furnitureWhy(s) {
        const tx = Math.floor(s.x), tz = Math.floor(s.z), onFloor = grid.floor(s.lv | 0, Math.floor(tx / 2), Math.floor(tz / 2)), y = pieceBase(grid, s);
        if (!onFloor) { const t = g.tileAt(tx, tz); if (isSolid(t) || isLiquid(t) || t === T.SHALLOW || t === T.PIT) return 'Needs open ground.'; const w = scenery(tx + 0.1, tz + 0.1, tx + 0.9, tz + 0.9); if (w) return w; }
        if (PIECES[s.type].solid) for (const e of g.entities) if (!e.dead && (e.isPlayer || e.isEnemy) && Math.abs(e.x - s.x) < 0.5 + (e.r || 0.3) && Math.abs(e.z - s.z) < 0.5 + (e.r || 0.3) && spans(y, y + 1.1, e.fy)) return e.isPlayer ? 'You are standing there.' : 'Something is in the way.';
        return '';
      },
    };
  }
  // why a record cannot be placed ('' when it can). Old 1-tile pieces keep their old rules.
  checkPiece(rec) {
    const g = this.g; if (g.area?.id !== 'wilds') return 'Build in the wilds, not in caves.';
    if (!PIECES[rec.type]) return 'Unknown piece.';
    if (isKit(rec.type) || FURNITURE.has(rec.type)) return placeWhy(this.grid, this.env(), rec);
    return this.legacyCheck(rec.type, Math.floor(rec.x), Math.floor(rec.z));
  }
  // kept for callers of the first pass: (type, tx, tz) on the ground floor
  placeCheck(type, tx, tz, lv = 0, r = 0) { return this.checkPiece(this.recFor(type, tx + 0.5, tz + 0.5, lv, r)); }
  legacyCheck(type, tx, tz) {
    const g = this.g, t = g.tileAt(tx, tz), P = PIECES[type], p = g.player, x = tx + 0.5, z = tz + 0.5, cx = Math.floor(tx / 2), cz = Math.floor(tz / 2);
    if (isSolid(t) || isLiquid(t) || t === T.SHALLOW || t === T.PIT) return 'Needs open ground.';
    if (this.grid.floor(0, cx, cz) || this.grid.stairs(0, cx, cz)) return 'A house floor is here; use the house kit.';
    if (type === 'roof') return this.structureAt(tx, tz, 'roof') ? 'There is already a roof here.' : (this.structureAt(tx, tz) ? '' : 'Roofs go over a floor, wall or doorway.');
    if (this.structureAt(tx, tz)) return 'Something is already built here.';
    if (g.entities.some(e => !e.dead && e !== p && (e.isNode || e instanceof CaveMouth || e instanceof LootCache || e instanceof Landmark && Math.hypot(e.x - x, e.z - z) < 2) && Math.abs(e.x - x) < 0.9 && Math.abs(e.z - z) < 0.9)) return 'Clear the space first.';
    if (P.solid && Math.abs(p.x - x) < 0.5 + p.r && Math.abs(p.z - z) < 0.5 + p.r) return 'You are standing there.';
    if (P.solid && g.entities.some(e => e.isEnemy && !e.dead && Math.abs(e.x - x) < 0.8 && Math.abs(e.z - z) < 0.8)) return 'Something is in the way.';
    return '';
  }
  newId() { return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  // Stable API (also for the crafting UI): place one piece from the build pouch. Validates first;
  // spends exactly one kit only when the piece is placed.
  placePiece(rec) {
    const g = this.g, R = this.record; R.kits = R.kits || {};
    rec = this.recFor(rec.type, rec.x, rec.z, rec.lv | 0, rec.r | 0);
    if (!(R.kits[rec.type] > 0)) return { ok: false, why: 'No ' + (PIECES[rec.type]?.name || rec.type).toLowerCase() + ' in your build pouch.' };
    const why = this.checkPiece(rec); if (why) return { ok: false, why };
    const s = { id: this.newId(), type: rec.type, x: rec.x, z: rec.z }; if (rec.lv) s.lv = rec.lv; if (rec.r) s.r = rec.r;
    R.structures.push(s); R.kits[rec.type]--;
    const e = this.spawnPiece(s), k = this.chunkOf(s.x, s.z); (this.byChunk.get(k) || this.byChunk.set(k, []).get(k)).push(e);
    if (KIT[s.type]?.layer === 'roof' || KIT[s.type]?.layer === 'floor') this.refreshShapes();
    sfx('push'); g.fx.dust(s.x, s.z, 8);
    if (s.type === 'campfire' && !R.home) this.setHome(s.x, s.z + 1.2, true);
    this.hintCheck(); g.save();
    return { ok: true, why: '', id: s.id, piece: s };
  }
  place() {
    const b = this.build; if (!b) return false; const g = this.g;
    if (b.type === 'demolish') { const t = b.target || this.pickTarget(b.tx + 0.5, b.tz + 0.5, b.lv); return t ? this.removePiece(t.s.id).ok : (sfx('error'), false); }
    const rec = b.rec && b.recAt === b.tx + ',' + b.tz ? b.rec : this.recFor(b.type, b.tx + 0.5, b.tz + 0.5, b.lv, b.r);
    const res = this.placePiece(rec);
    if (!res.ok) { sfx('error'); g.ui.toast('Cannot build here', res.why, 1.4); return false; }
    b.lastKey = slotKey(res.piece);
    if (!(this.record.kits[b.type] > 0)) this.endBuild(); else this.ui && this.ui.refresh();
    return true;
  }
  // the built piece under the aim on a level: furniture, then walls, posts, stairs, roof, floor
  pickTarget(x, z, lv) {
    const G = this.grid, E = G.ents, tx = Math.floor(x), tz = Math.floor(z), cx = Math.floor(x / 2), cz = Math.floor(z / 2);
    const ent = s => s && E.get(s.id);
    let s = G.tile(lv, tx, tz) || (lv === 0 && G.get('lr:0:' + tx + ',' + tz)); if (s && ent(s)) return ent(s);
    const edge = snapPiece('timber_wall', x, z, lv, 0), L = locate(edge), dEdge = L.a === 'h' ? Math.abs(z - edge.z) : Math.abs(x - edge.x);
    if (dEdge < 0.5 && (s = G.band(lv, L.a, L.ex, L.ez)) && ent(s)) return ent(s);
    const vx = Math.round(x / 2), vz = Math.round(z / 2); if (Math.hypot(x - vx * 2, z - vz * 2) < 0.5 && (s = G.post(lv, vx, vz)) && ent(s)) return ent(s);
    for (s of [G.stairs(lv, cx, cz), G.roof(lv, cx, cz), G.floor(lv, cx, cz)]) if (s && ent(s)) return ent(s);
    return null;
  }
  // Stable API: why a piece cannot be taken down ('' if it can). Never removes dependants.
  canRemove(id) {
    const e = this.grid.ents.get(id); if (!e || e.dead) return 'Nothing built here.';
    if (this.g.area?.id !== 'wilds') return 'Not here.';
    if (isKit(e.type)) return removeWhy(this.grid, e.s);
    return '';
  }
  // Stable API: take a piece down. The piece's kit comes back once; a chest's contents go back
  // to your resources; a generated piece is remembered as taken, so it never regrows.
  removePiece(id) {
    const g = this.g, R = this.record, e = this.grid.ents.get(id), why = this.canRemove(id);
    if (why) { sfx('error'); g.ui.toast('Cannot take this down', why, 1.8); return { ok: false, why }; }
    if (e.type === 'chest') { const S = R.storage[e.id] || {}; let n = 0; for (const [k, v] of Object.entries(S)) { R.resources[k] = (R.resources[k] || 0) + v; n += v; } delete R.storage[e.id]; if (n) g.ui.toast('Chest emptied', n + ' resources went back to your pouch.', 1.8); }
    if (e.gen) { const H = R.houses[e.gen] || (R.houses[e.gen] = { removed: {}, open: {} }); (H.removed || (H.removed = {}))[e.id] = true; }
    else R.structures = R.structures.filter(s => s.id !== e.id);
    R.kits = R.kits || {}; R.kits[e.type] = (R.kits[e.type] || 0) + 1; // the kit comes back whole
    e.remove(); sfx('thud'); g.save(); this.ui && this.ui.refresh();
    return { ok: true, why: '' };
  }
  demolish(tx, tz, lv = 0) { const t = this.pickTarget(tx + 0.5, tz + 0.5, lv); if (!t) { sfx('error'); return false; } return this.removePiece(t.s.id).ok; }
  toggleDoor(p) {
    const g = this.g, s = p.s;
    if (s.open) { // closing: never on someone standing in the doorway
      const leaf = p.colliders.find(c => c.leaf);
      if (leaf && g.entities.some(e => !e.dead && (e.isPlayer || e.isEnemy) && Math.abs(e.x - leaf.x) < leaf.hw + (e.r || 0.3) && Math.abs(e.z - leaf.z) < leaf.hd + (e.r || 0.3) && spans(leaf.lo, leaf.hi, e.fy))) { sfx('error'); g.ui.toast('Someone is in the doorway', '', 1.2); return false; }
    }
    s.open = !s.open;
    if (p.gen) { const H = this.record.houses[p.gen] || (this.record.houses[p.gen] = { removed: {}, open: {} }); (H.open || (H.open = {}))[s.id] = s.open; }
    sfx('push'); g.save(); return true;
  }
  // Stable API: what the crafting UI can show for a piece id
  pieceInfo(type) { const P = PIECES[type], K = KIT[type], r = RECIPES.find(x => x.gives === type); return P && { id: type, name: P.name, desc: P.desc, kind: P.kind, levels: P.levels, rotates: !!P.rotates, legacy: !!P.legacy, layer: K?.layer || 'furniture', cost: r ? { ...r.cost } : null, qty: r?.qty || 1, station: r?.station || null, recipe: r?.id || null }; }
  // the ghost: the real model on the chosen level and rotation, green or red
  updateGhost(b) {
    const g = this.g, grid = this.grid;
    if (b.type === 'demolish') {
      const t = b.target, key = t ? 'd:' + t.s.id : '';
      if (key !== b.look) { b.look = key; b.ghost.clear(); if (t) { const [x0, z0, x1, z1] = footprint(t.s), K = KIT[t.type], h = K ? ({ wall: 2, gable: 1.5, roof: 1.2, stairs: 2.1, post: 2, floor: 0.3 })[K.layer] : 1.1; const m = new THREE.Mesh(this.boxGeo || (this.boxGeo = new THREE.BoxGeometry(1, 1, 1)), b.mat); m.scale.set(Math.max(0.3, x1 - x0) + 0.1, h, Math.max(0.3, z1 - z0) + 0.1); m.position.set((x0 + x1) / 2, pieceBase(grid, t.s) + h / 2, (z0 + z1) / 2); b.ghost.add(m); } }
      b.mat.color.setHex(b.ok ? 0xff8a5a : 0x777777); return;
    }
    const rec = b.rec; if (!rec) return;
    let look;
    if (isKit(rec.type)) { grid.skip = null; look = pieceLook(grid, rec); }
    else { const k = 'f:' + rec.type; if (!(this.furnGeo || (this.furnGeo = {}))[k]) this.furnGeo[k] = geo(pieceParts(rec.type)); look = { geometry: this.furnGeo[k], yaw: (rec.r | 0) * Math.PI / 2, key: k + rec.r }; }
    if (look.key !== b.look) { b.look = look.key; b.ghost.clear(); const m = new THREE.Mesh(look.geometry, b.mat); m.rotation.y = look.yaw; b.ghost.add(m); }
    b.ghost.position.set(rec.x, pieceBase(grid, rec) + 0.02, rec.z);
    b.mat.color.setHex(b.ok ? 0x7fd36a : 0xe8424f);
  }
  setHome(x, z, quiet) { const R = this.record; R.home = { x, z }; if (this.wilds) this.wilds.spawns.home = { x, z }; this.g.checkpoint = { area: 'wilds', spawn: 'home' }; if (!quiet) this.g.ui.toast('Home set', 'You will wake here, and the map marks the way back.', 2); }
  useStructure(s) {
    const g = this.g;
    if (s.type === 'campfire') { this.setHome(s.x, s.z + 1.1); g.inv.hp = g.inv.maxHp; g.inv.potions = Math.max(g.inv.potions, 2); g.res = 100; g.hudDirty = true; sfx('heart'); g.save(); }
    if (s.type === 'workbench') this.ui && this.ui.openCraft(true);
    if (s.type === 'chest') this.ui && this.ui.openChest(s);
  }
  deposit(chest, res, n) { const R = this.record, S = R.storage[chest.id] || (R.storage[chest.id] = {}); n = Math.min(n, R.resources[res]); if (n <= 0) return 0; R.resources[res] -= n; S[res] = (S[res] || 0) + n; this.g.save(); return n; }
  withdraw(chest, res, n) { const R = this.record, S = R.storage[chest.id] || {}; n = Math.min(n, S[res] || 0); if (n <= 0) return 0; S[res] -= n; R.resources[res] += n; this.g.save(); return n; }

  // ---------------------------------------------------------------- places, caves, caches
  discover(d) {
    const R = this.record; if (R.discovered[d.id]) return;
    R.discovered[d.id] = { type: d.type, x: d.x, z: d.z, name: d.name };
    if (d.type !== 'shelter7s') { sfx('secret'); this.g.ui.toast('Discovered: ' + d.name, 'Marked on your map.', 2.2); }
    this.hintCheck();
  }
  caveState(id) { return this.record.caves[id] || (this.record.caves[id] = { cleared: false, removed: {}, entered: 0 }); }
  enterCave(id, backX, backZ) {
    const g = this.g; if (g.transitioning) return;
    this.caveId = id; this.caveAt = { x: backX, z: backZ }; this.caveState(id).entered++;
    this.discover({ id, type: 'cave', x: backX, z: backZ - 1.4, name: 'Cave mouth' });
    g.warpTo('cave', 'entrance');
  }
  leaveCave() { const g = this.g; if (g.transitioning || !this.caveAt) return; const at = this.caveAt; this.caveId = null; g.warpTo('wilds', { x: at.x, z: at.z }); }
  isOpened(id) { return !!this.record.opened[id]; }
  openCache(c) {
    const g = this.g, R = this.record; if (R.opened[c.id]) return; R.opened[c.id] = true;
    const cave = c.d.loot === 'cave', lvl = Math.max(1, (g.area.placeAt ? g.area.placeAt(c.x, c.z).level : g.area.level) || 1);
    const give = cave ? { ore: 4, crystal: 3, stone: 4 } : { wood: 4, stone: 3, fibre: 3 };
    for (const [k, v] of Object.entries(give)) this.addResource(k, v, c.x, c.z);
    g.dropGear(c.x, c.z + 1, { level: lvl + (cave ? 2 : 0), floor: cave ? 2 : 1, bonus: cave ? 1 : 0.4 }); // the real, class-correct loot roll
    g.addCoins(cave ? 60 : 25); sfx('chest'); g.stats.caches = (g.stats.caches || 0) + 1;
    if (cave) { R.stats = R.stats || {}; R.stats.caveRewards = (R.stats.caveRewards || 0) + 1; }
    this.hintCheck(); g.save();
  }

  // generated houses you walk up to are marked on the map
  houseCheck() {
    const p = this.g.player; if (!p || !this.houses) return;
    for (const [id, h] of this.houses) if (!this.record.discovered[id] && Math.hypot(p.x - h.x, p.z - h.z) < 9) this.discover({ id, type: 'house', x: h.x, z: h.z, name: h.name });
  }
  // ---------------------------------------------------------------- guidance
  hintCheck() {
    const R = this.record, H = R.hints; if (H.done) return;
    const res = R.resources, st = R.structures, done = [
      () => res.wood >= 5 || (R.stats?.gathered || 0) > 6, () => res.stone >= 3 || (R.stats?.gathered || 0) > 9,
      () => st.some(s => s.type === 'campfire'), () => st.some(s => s.type === 'workbench'),
      () => Object.values(R.discovered).some(d => d.type === 'cave'), () => (R.stats?.caveRewards || 0) > 0];
    while (H.step < HINTS.length && done[H.step]()) H.step++;
    if (H.step >= HINTS.length) { H.done = true; this.g.ui.toast('The wilds are yours', 'Keep exploring: more caves and ruins lie beyond the paths.', 3); }
  }
  hint() { const H = this.record.hints; return H.done ? 'Explore further: every region hides a cave, a ruin or standing stones.' : HINTS[H.step][1]; }
  markers() {
    const g = this.g, R = this.record, m = [];
    if (g.area?.id === 'wilds') {
      const home = R.home || { x: WORLD.start.x + 0.5, z: WORLD.start.z + 0.5 };
      m.push({ x: home.x, z: home.z, color: '#ffd25e', name: 'Home' });
      for (const [id, d] of Object.entries(R.discovered)) if (d.type !== 'shelter7s') m.push({ x: d.x, z: d.z, color: d.type === 'cave' ? (this.caveState(id).cleared ? '#8a8a8a' : '#c9a8ff') : '#e8d6a8', name: d.name });
      if (!R.hints.done && R.hints.step === 4) { const c = this.firstCave(); if (c) m.push({ x: c.x, z: c.z, color: '#c9a8ff', pulse: true, name: 'A cave' }); }
    }
    if (g.area?.id === 'cave' && !this.isOpened('cavechest:' + this.caveId)) m.push({ x: g.area.reward.x, z: g.area.reward.z, color: '#ffd25e', pulse: true, name: 'Reward' });
    return m;
  }
  firstCave() { if (!this._first) { const S = WORLD.start, Rg = BIOMES.forest.region; this._first = regionPoi(this.record.seed, Math.floor(S.x / Rg) + 1, Math.floor(S.z / Rg)); } return this._first; }

  // ---------------------------------------------------------------- frame
  tick(dt) {
    if (!this.active) return;
    const g = this.g, inp = g.input; this.dt = dt;
    this.streamT -= dt; if (this.streamT <= 0) { this.streamT = 0.3; this.stream(); this.houseCheck(); }
    if (g.area?.id === 'wilds' && g.player) this.cut.update(g.player, dt);
    this.record.playTime = (this.record.playTime || 0) + dt;
    // a cave whose creatures are all down stays cleared
    if (g.area?.id === 'cave' && this.caveFoes && this.caveFoes.length && this.caveFoes.every(e => e.dead)) { const C = this.caveState(this.caveId); if (!C.cleared) { C.cleared = true; sfx('fanfare'); g.ui.banner && g.ui.banner('CAVE CLEARED', 'It stays quiet now', 2); g.save(); } this.caveFoes = []; }
    // building: the ghost follows the aim; click / C places, right click / X leaves build mode
    const b = this.build, wheel = inp.wheel || 0; inp.wheel = 0;
    if (b) {
      const P = PIECES[b.type], range = P?.levels || [0, 2];
      // rotation: cells and furniture turn; walls flip which way a door swings
      const turn = (inp.pressed('buildRotate') ? 1 : 0) + wheel;
      if (turn && b.type !== 'demolish' && P.rotates) b.r = P.kind === 'edge' ? (b.r + 2) % 4 : ((b.r + Math.sign(turn)) % 4 + 4) % 4;
      if (inp.pressed('buildUp')) b.lv = Math.min(b.type === 'demolish' ? 3 : range[1], b.lv + 1);
      if (inp.pressed('buildDown')) b.lv = Math.max(b.type === 'demolish' ? 0 : range[0], b.lv - 1);
      const t = this.target(); b.tx = t.tx; b.tz = t.tz;
      let why;
      if (b.type === 'demolish') { b.target = this.pickTarget(t.x, t.z, b.lv); why = b.target ? this.canRemove(b.target.s.id) : 'Nothing built here on the ' + LEVEL_NAME(b.lv) + '.'; }
      else { b.rec = this.recFor(b.type, t.x, t.z, b.lv, b.r); b.recAt = t.tx + ',' + t.tz; why = this.checkPiece(b.rec); }
      b.ok = !why; b.why = why;
      b.info = LEVEL_NAME(b.lv) + (b.type !== 'demolish' && P.rotates ? (P.kind === 'edge' ? (b.r >= 2 ? ' · swings in' : ' · swings out') : ' · facing ' + FACING[b.r]) : '') + ' · [ ] level' + (b.type !== 'demolish' && P.rotates ? ' · T / wheel rotate' : '');
      this.updateGhost(b);
      if (inp.pressed('attack')) this.place();
      // hold and sweep to lay a row of the same piece (each spot is checked and paid for once)
      else if (inp.state.attack && b.type !== 'demolish' && b.ok && b.rec && slotKey(b.rec) !== b.lastKey && (b.dragT = (b.dragT || 0) + dt) > 0.1) { b.dragT = 0; this.place(); }
      if (!inp.state.attack) b.dragT = 0;
      if (this.build && inp.pressed('secondary')) this.endBuild();
      inp.state.attack = false; inp.state.secondary = false; inp.state.surge = false; // no swinging while building
      this.build && this.ui && this.ui.buildStatus(this.build);
    }
    if (inp.pressed('craft') && !g.locked()) this.ui && this.ui.toggleCraft();
  }
  // the save: the character and everything the world remembers (never story data)
  capture() {
    const g = this.g, R = this.record; if (!this.active || !g.inv) return;
    R.character = { cls: g.inv.cls, inv: copy({ ...g.inv, equip: { ...g.inv.equip } }) };
    if (g.area?.id === 'wilds' && g.player) R.pos = { area: 'wilds', x: g.player.x, z: g.player.z, fy: Math.round((g.player.fy || 0) * 100) / 100 };
    else if (g.area?.id === 'cave' && this.caveAt) R.pos = { area: 'wilds', x: this.caveAt.x, z: this.caveAt.z }; // resume at the cave mouth
  }
}
