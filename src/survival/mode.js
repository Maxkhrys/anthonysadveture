// SURVIVAL mode controller. Owns one survival world while it is played and connects it to the
// normal game: the same player, classes, weapons, enemies, HUD and effects, with the survival
// save (store.js) in place of the story save. Story state is never read or written here.
import * as THREE from 'three';
import { SurvivalStore, RESOURCES } from './store.js';
import { buildWilds, CH } from './world.js';
import { buildCave } from './cave.js';
import { ResourceNode, NodeBatch, Structure, CaveMouth, Landmark, LootCache, PIECES } from './entities.js';
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
  constructor(g, storage) { this.g = g; this.store = new SurvivalStore(storage); this.active = false; }
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
    g.checkpoint = { area: 'wilds', spawn: R.home ? 'home' : 'start' };
    g.loadArea('wilds', pos);
    g.ui.areaName && g.ui.areaName(R.name);
    this.ui && this.ui.show();
  }
  quit() { this.endBuild(); this.g.save().then(() => this.onQuit && this.onQuit()); }
  stop() { this.active = false; this.g.mode = 'story'; this.g.survival = null; document.documentElement.classList.remove('mode-survival'); this.ui && this.ui.hide(); }
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
    const g = this.g;
    if (area.id === 'wilds') {
      const p = g.player; area.ensureChunk(Math.floor(p.x / CH), Math.floor(p.z / CH));
      if (!this.freeTile(p.x, p.z)) this.unstick(true);
      this.stream(true);
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
    for (const s of R.structures) if (this.chunkOf(s.x, s.z) === key) list.push(g.spawn(new Structure(g, s, this)));
    this.byChunk.set(key, list);
  }
  removeNode(node) {
    const R = this.record;
    if (node.id.startsWith('c:')) { this.caveState(this.caveId).removed[node.id] = true; }
    else R.removed[node.id] = true;
    delete this.damage[node.id];
    R.stats = R.stats || {}; R.stats.gathered = (R.stats.gathered || 0) + 1;
  }
  freeTile(x, z) { const t = this.g.tileAt(Math.floor(x), Math.floor(z)); return !isSolid(t) && !isLiquid(t) && !this.g.entities.some(e => e.solid && !e.dead && !e.isPlayer && !e.isEnemy && Math.abs(e.x - x) < e.hw + 0.25 && Math.abs(e.z - z) < e.hd + 0.25); }
  // Unstuck: the nearest free spot, spiralling outward; falls back to home
  unstick(silent) {
    const g = this.g, p = g.player;
    for (let r = 0; r < 12; r++) for (let a = 0; a < 16; a++) { const x = Math.floor(p.x) + 0.5 + Math.round(Math.cos(a / 16 * 6.28) * r), z = Math.floor(p.z) + 0.5 + Math.round(Math.sin(a / 16 * 6.28) * r); if (this.freeTile(x, z)) { p.x = x; p.z = z; g.snapCamera && g.snapCamera(); if (!silent) g.ui.toast('Unstuck', 'Moved to the nearest open ground.', 1.6); return true; } }
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
  canCraft(id) {
    const r = RECIPES.find(x => x.id === id); if (!r) return { ok: false, why: 'Unknown recipe.' };
    if (r.station && !this.nearStation(r.station)) return { ok: false, why: 'Needs a ' + PIECES[r.station].name.toLowerCase() + ' nearby.' };
    if (!this.has(r.cost)) return { ok: false, why: 'Not enough: ' + Object.entries(r.cost).filter(([k, v]) => this.record.resources[k] < v).map(([k, v]) => (v - this.record.resources[k]) + ' more ' + k).join(', ') + '.' };
    return { ok: true, why: '' };
  }
  craft(id) {
    const c = this.canCraft(id); if (!c.ok) { sfx('error'); return c; }
    const r = RECIPES.find(x => x.id === id), R = this.record;
    for (const [k, v] of Object.entries(r.cost)) R.resources[k] -= v;
    if (r.gives === 'tonic') { this.g.inv.potions = Math.min(this.g.inv.maxPotions, this.g.inv.potions + 1); this.g.hudDirty = true; }
    else { R.kits = R.kits || {}; R.kits[r.gives] = (R.kits[r.gives] || 0) + (r.qty || 1); }
    sfx('forge'); this.g.ui.toast('Crafted: ' + r.name, r.gives === 'tonic' ? 'A tonic, ready to drink (H).' : 'Place it from the Build list.', 2);
    this.ui && this.ui.refresh(); this.hintCheck(); this.g.save();
    return { ok: true };
  }
  startBuild(type) {
    if (type !== 'demolish' && !((this.record.kits || {})[type] > 0)) { sfx('error'); return false; }
    this.endBuild();
    const g = this.g, ghost = new THREE.Mesh(new THREE.BoxGeometry(1, type === 'floor' || type === 'roof' ? 0.12 : 1.2, 1), new THREE.MeshBasicMaterial({ color: 0x7fd36a, transparent: true, opacity: 0.4, depthWrite: false }));
    g.scene.add(ghost); this.build = { type, ghost, ok: false, tx: 0, tz: 0 }; this.ui && this.ui.refresh();
    return true;
  }
  endBuild() { if (this.build) { this.g.scene.remove(this.build.ghost); this.build.ghost.geometry.dispose(); this.build.ghost.material.dispose(); this.build = null; this.ui && this.ui.refresh(); } }
  target() {
    const g = this.g, p = g.player, inp = g.input;
    let x = p.x + Math.sin(p.facing) * 1.4, z = p.z + Math.cos(p.facing) * 1.4;
    if (p.aimSrc === 'mouse' && inp.onCanvas) { const q = g.pr.screenToWorld(inp.mouseX, inp.mouseY, 0); if (Math.hypot(q.x - p.x, q.z - p.z) < 6) { x = q.x; z = q.z; } }
    return { tx: Math.floor(x), tz: Math.floor(z) };
  }
  structureAt(tx, tz, type) { return this.g.entities.find(e => e.isStructure && !e.dead && Math.floor(e.x) === tx && Math.floor(e.z) === tz && (!type || (type === 'roof') === (e.type === 'roof'))); }
  // what may go where: open ground, nothing solid in the way, never on top of the player
  placeCheck(type, tx, tz) {
    const g = this.g, t = g.tileAt(tx, tz), P = PIECES[type], p = g.player, x = tx + 0.5, z = tz + 0.5;
    if (g.area.id !== 'wilds') return 'Build in the wilds, not in caves.';
    if (isSolid(t) || isLiquid(t) || t === T.SHALLOW || t === T.PIT) return 'Needs open ground.';
    if (type === 'roof') return this.structureAt(tx, tz, 'roof') ? 'There is already a roof here.' : (this.structureAt(tx, tz) ? '' : 'Roofs go over a floor, wall or doorway.');
    if (this.structureAt(tx, tz)) return 'Something is already built here.';
    if (g.entities.some(e => !e.dead && e !== p && (e.isNode || e instanceof CaveMouth || e instanceof LootCache || e instanceof Landmark && Math.hypot(e.x - x, e.z - z) < 2) && Math.abs(e.x - x) < 0.9 && Math.abs(e.z - z) < 0.9)) return 'Clear the space first.';
    if (P.solid && Math.abs(p.x - x) < 0.5 + p.r && Math.abs(p.z - z) < 0.5 + p.r) return 'You are standing there.';
    if (P.solid && g.entities.some(e => e.isEnemy && !e.dead && Math.abs(e.x - x) < 0.8 && Math.abs(e.z - z) < 0.8)) return 'Something is in the way.';
    return '';
  }
  place() {
    const b = this.build; if (!b) return false; const R = this.record, g = this.g;
    if (b.type === 'demolish') return this.demolish(b.tx, b.tz);
    const why = this.placeCheck(b.type, b.tx, b.tz); if (why) { sfx('error'); g.ui.toast('Cannot build here', why, 1.4); return false; }
    const s = { id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), type: b.type, x: b.tx + 0.5, z: b.tz + 0.5 };
    R.structures.push(s); R.kits[b.type]--;
    const e = g.spawn(new Structure(g, s, this)); const k = this.chunkOf(s.x, s.z); (this.byChunk.get(k) || this.byChunk.set(k, []).get(k)).push(e);
    sfx('push'); g.fx.dust(s.x, s.z, 8);
    if (b.type === 'campfire' && !R.home) this.setHome(s.x, s.z + 1.2, true);
    this.hintCheck(); g.save();
    if (!(R.kits[b.type] > 0)) this.endBuild(); else this.ui && this.ui.refresh();
    return true;
  }
  demolish(tx, tz) {
    const g = this.g, R = this.record, e = this.structureAt(tx, tz, 'roof') || this.structureAt(tx, tz); if (!e) { sfx('error'); return false; }
    if (e.type === 'chest') { const S = R.storage[e.id] || {}; for (const [k, v] of Object.entries(S)) R.resources[k] += v; delete R.storage[e.id]; }
    R.structures = R.structures.filter(s => s.id !== e.id); R.kits = R.kits || {}; R.kits[e.type] = (R.kits[e.type] || 0) + 1; // the kit comes back whole
    e.remove(); sfx('thud'); g.save(); this.ui && this.ui.refresh(); return true;
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
    const g = this.g, inp = g.input;
    this.streamT -= dt; if (this.streamT <= 0) { this.streamT = 0.3; this.stream(); }
    this.record.playTime = (this.record.playTime || 0) + dt;
    // a cave whose creatures are all down stays cleared
    if (g.area?.id === 'cave' && this.caveFoes && this.caveFoes.length && this.caveFoes.every(e => e.dead)) { const C = this.caveState(this.caveId); if (!C.cleared) { C.cleared = true; sfx('fanfare'); g.ui.banner && g.ui.banner('CAVE CLEARED', 'It stays quiet now', 2); g.save(); } this.caveFoes = []; }
    // building: the ghost follows the aim; click / C places, right click / X leaves build mode
    const b = this.build;
    if (b) {
      const t = this.target(); b.tx = t.tx; b.tz = t.tz;
      const why = b.type === 'demolish' ? (this.structureAt(t.tx, t.tz) ? '' : 'Nothing built here.') : this.placeCheck(b.type, t.tx, t.tz);
      b.ok = !why; b.why = why;
      b.ghost.position.set(t.tx + 0.5, (b.type === 'roof' ? 1.5 : b.type === 'floor' ? 0.06 : 0.6) + (g.tileGround ? g.tileGround(t.tx, t.tz) : 0), t.tz + 0.5);
      b.ghost.material.color.setHex(b.type === 'demolish' ? (b.ok ? 0xff8a5a : 0x777777) : b.ok ? 0x7fd36a : 0xe8424f);
      if (inp.pressed('attack')) this.place();
      if (inp.pressed('secondary')) this.endBuild();
      inp.state.attack = false; inp.state.secondary = false; // no swinging while building
      this.ui && this.ui.buildStatus(b);
    }
    if (inp.pressed('craft') && !g.locked()) this.ui && this.ui.toggleCraft();
  }
  // the save: the character and everything the world remembers (never story data)
  capture() {
    const g = this.g, R = this.record; if (!this.active || !g.inv) return;
    R.character = { cls: g.inv.cls, inv: copy({ ...g.inv, equip: { ...g.inv.equip } }) };
    if (g.area?.id === 'wilds' && g.player) R.pos = { area: 'wilds', x: g.player.x, z: g.player.z };
    else if (g.area?.id === 'cave' && this.caveAt) R.pos = { area: 'wilds', x: this.caveAt.x, z: this.caveAt.z }; // resume at the cave mouth
  }
}
