// Survival world objects: gatherable nodes, resource pickups, placed structures, cave mouths,
// loot caches and the generated landmarks. All built from the shared voxel box helpers.
import * as THREE from 'three';
import { Entity } from '../entities/entity.js';
import { geo, B, MAT, MAT_GLOW } from '../models.js';
import {gatherFeedback} from './gathering.js';
import { sfx } from '../engine/audio.js';
import { hash2 } from '../engine/util.js';

// ------------------------------------------------------------------ gatherable nodes
// Every class gathers with its normal weapon: one strike is one unit of work (two for heavy
// blows), with a short per-node cooldown so rapid-fire weapons cannot strip a forest.
export const NODES = {
  tree: { name: 'Tree', hp: 5, drop: [['wood', 3]], bonus: ['fibre', 1, 0.35], hw: 0.34, chips: [0x8a5a34, 0x5aa83a], sound: 'cut' },
  rock: { name: 'Rock', hp: 5, drop: [['stone', 3]], hw: 0.4, chips: [0xb8b0a0, 0x8a8478], sound: 'clang' },
  ore: { name: 'Ore vein', hp: 7, drop: [['ore', 2], ['stone', 1]], hw: 0.4, chips: [0xc07a3a, 0x9a9488], sound: 'clang' },
  shrub: { name: 'Fibre shrub', hp: 2, drop: [['fibre', 2]], hw: 0.3, chips: [0x7fd36a, 0x4a8a3a], sound: 'cut' },
  crystal: { name: 'Glow crystal', hp: 6, drop: [['crystal', 2]], hw: 0.38, chips: [0xc8a8ff, 0x9af0ff], sound: 'glass' },
};
export const HIT_COOLDOWN = 0.24;
const GEO = new Map();
function nodeGeo(type, v) {
  const key = type + v; if (GEO.has(key)) return GEO.get(key);
  const P = [];
  if (type === 'tree') {
    const h = [1.1, 1.4, 0.9][v], c = [[0x3f8a3c, 0x4f9a44, 0x5aa84a], [0x356e32, 0x3f8a3c, 0x4a9442], [0x4a8a3a, 0x6aa84a, 0x7fbf52]][v];
    P.push(B(0.26, h, 0.26, 0, 0, 0, 0x7a5232), B(0.34, 0.12, 0.34, 0, 0, 0, 0x5e3e24));
    P.push(B(1.1, 0.5, 1.1, 0, h - 0.1, 0, c[0]), B(0.84, 0.45, 0.84, 0, h + 0.35, 0, c[1]), B(0.5, 0.35, 0.5, 0, h + 0.7, 0, c[2]));
  } else if (type === 'rock' || type === 'ore') {
    const s = [1, 0.85, 1.15][v];
    P.push(B(0.8 * s, 0.5 * s, 0.7 * s, 0, 0, 0, 0x9a9488), B(0.5 * s, 0.3 * s, 0.5 * s, 0.1, 0.45 * s, -0.05, 0xb0aa9c), B(0.3 * s, 0.2 * s, 0.3 * s, -0.25, 0.1, 0.25, 0x847e72));
    if (type === 'ore') P.push(B(0.16, 0.14, 0.1, 0.2, 0.3 * s, 0.33 * s, 0xd8894a), B(0.14, 0.12, 0.1, -0.2, 0.42 * s, 0.25 * s, 0xe0a060), B(0.12, 0.1, 0.1, 0.05, 0.62 * s, 0.1, 0xd8894a));
  } else if (type === 'shrub') {
    P.push(B(0.6, 0.35, 0.6, 0, 0, 0, 0x4f9a44), B(0.4, 0.25, 0.4, 0.05, 0.3, 0, 0x6ab84e), B(0.08, 0.08, 0.08, 0.2, 0.35, 0.2, 0xe8e0c0), B(0.08, 0.08, 0.08, -0.18, 0.3, 0.15, 0xe8e0c0));
  } else if (type === 'crystal') {
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; P.push(B(0.16, 0.6 + i * 0.12, 0.16, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18, i % 2 ? 0xc8a8ff : 0x9af0ff, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3)); }
  }
  const g = geo(P); g.userData.shared = true; GEO.set(key, g); return g;
}
export class ResourceNode extends Entity {
  constructor(g, n, owner, batch = null) {
    super(g, n.x, n.z); this.n = n; this.id = n.id; this.type = n.type; this.D = NODES[n.type]; this.owner = owner;
    this.solid = true; this.hw = this.hd = this.D.hw; this.r = this.D.hw; this.isNode = true; this.passShots = false;
    this.hp = this.D.hp - (owner.damage[n.id] || 0); this.cool = 0; this.shake = 0;
    this.rot = hash2(Math.floor(n.x), Math.floor(n.z), 3) * 6.28; this.k = 1; this.tilt = 0;
    if (batch) { this.batch = batch; this.slot = batch.add(this); } // wilds: drawn by the chunk's instanced batch
    else { this.m = new THREE.Mesh(nodeGeo(n.type, n.v || 0), MAT); this.m.castShadow = true; this.m.rotation.y = this.rot; this.obj.add(this.m); }
    this.applyDamageLook();
  }
  get hoverName() { return this.D.name; }
  onHit(h) { this.work(h && (h.heavy || h.kind === 'slam' || h.kind === 'spin') ? 2 : 1, h?.dir ?? 0); return 'hit'; }
  onShot(pr) { this.work(pr.charged || pr.kind === 'fireball' ? 2 : 1, pr.dir ?? 0); }
  work(n, dir) {
    const g = this.g; if (this.dead || this.cool > 0) return;
    this.cool = HIT_COOLDOWN; this.hp -= n; this.shake = 1; this.dir = dir;
    this.owner.damage[this.id] = this.D.hp - Math.max(0, this.hp);
    gatherFeedback(this);
    g.stats.gatherHits = (g.stats.gatherHits || 0) + 1;
    this.applyDamageLook();
    if (this.hp <= 0) this.fell();
  }
  applyDamageLook() { this.k = Math.max(0, this.hp) / this.D.hp; this.look(); } // chopped and cracked down as it takes work
  look() { const k = this.k; if (this.m) { this.m.scale.set(0.8 + 0.2 * k, 0.75 + 0.25 * k, 0.8 + 0.2 * k); this.m.rotation.z = this.tilt; } else if (this.batch) this.batch.set(this.slot, this, 0.8 + 0.2 * k, 0.75 + 0.25 * k); }
  fell() {
    if(this.dead)return;
    const g = this.g;
    gatherFeedback(this,true);
    const drops = [...this.D.drop]; if (this.D.bonus && Math.random() < this.D.bonus[2]) drops.push([this.D.bonus[0], this.D.bonus[1]]);
    for (const [res, n] of drops) g.spawn(new Pickup(g, this.x, this.z, res, n));
    this.owner.removeNode(this);
    this.remove();
  }
  remove() { if (this.batch) this.batch.hide(this.slot); super.remove(); }
  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 5); this.tilt = Math.sin(this.shake * 30) * 0.08 * this.shake; this.look(); }
  }
}

// One instanced mesh per model variant for a chunk's nodes: ~10 draw calls a chunk instead of
// one per tree. Felled nodes are hidden (scale 0); the batch is dropped with its chunk.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class NodeBatch {
  constructor(g, nodes) {
    this.g = g; this.meshes = new Map(); this.group = new THREE.Group();
    const counts = new Map(); for (const n of nodes) { const k = n.type + (n.v || 0); counts.set(k, (counts.get(k) || 0) + 1); }
    for (const [k, c] of counts) { const im = new THREE.InstancedMesh(nodeGeo(k.slice(0, -1), +k.slice(-1)), MAT, c); im.castShadow = true; im.count = 0; im.userData.next = 0; this.meshes.set(k, im); this.group.add(im); }
    g.world.add(this.group);
  }
  add(node) { const im = this.meshes.get(node.type + (node.n.v || 0)); const i = im.userData.next++; im.count = im.userData.next; return { im, i }; }
  set({ im, i }, node, sxz, sy) {
    _p.set(node.x, node.g.groundAt ? node.g.groundAt(node.x, node.z) : 0, node.z); _q.setFromEuler(_e.set(0, node.rot, node.tilt)); _s.set(sxz, sy, sxz);
    im.setMatrixAt(i, _m.compose(_p, _q, _s)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  }
  hide({ im, i }) { im.setMatrixAt(i, _m.makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; }
  dispose() { if (this.group.parent) this.group.parent.remove(this.group); for (const im of this.meshes.values()) im.dispose(); }
}

// ------------------------------------------------------------------ pickups
const RES_COL = { wood: 0x9a6a3a, stone: 0xb8b0a0, fibre: 0x8ac85a, ore: 0xd8894a, crystal: 0xc8a8ff };
export class Pickup extends Entity {
  constructor(g, x, z, res, n) {
    super(g, x, z); this.res = res; this.n = n; this.t = 0; this.solid = false;
    const a = Math.random() * 6.28; this.vx = Math.cos(a) * 1.6; this.vz = Math.sin(a) * 1.6; this.vy = 3.2; this.y = 0.4;
    this.obj.add(new THREE.Mesh(geo([B(0.22, 0.16, 0.22, 0, 0, 0, RES_COL[res] || 0xffffff), B(0.14, 0.1, 0.14, 0.04, 0.14, 0, 0xffffff)]), MAT));
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    if (this.y > 0.05 || this.vy > 0) { this.vy -= 12 * dt; this.y = Math.max(0.05, this.y + this.vy * dt); this.x += this.vx * dt; this.z += this.vz * dt; if (this.y <= 0.05) this.vy = 0; }
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (this.t > 0.35 && (d < 2.4 || this.t > 5)) { const k = Math.min(1, dt * 10); this.x += (p.x - this.x) * k; this.z += (p.z - this.z) * k; }
    if (this.t > 0.35 && d < 0.5 || this.t > 6) { g.survival?.addResource(this.res, this.n, this.x, this.z); sfx('gatherpickup'); this.remove(); }
    this.obj.rotation.y += dt * 3; this.sync();
  }
}

// ------------------------------------------------------------------ placed structures
export const PIECES = {
  floor: { name: 'Wooden floor', solid: false, desc: 'A plank floor tile. Walkable.' },
  wall: { name: 'Wooden wall', solid: true, desc: 'A solid wall tile.' },
  stonewall: { name: 'Stone wall', solid: true, desc: 'A sturdier-looking wall tile.' },
  door: { name: 'Doorway', solid: false, desc: 'A framed opening you can walk through.' },
  roof: { name: 'Thatch roof', solid: false, desc: 'A roof tile. It fades when you stand under it.' },
  campfire: { name: 'Campfire', solid: true, station: true, desc: 'Rest here to heal and set your home.' },
  workbench: { name: 'Workbench', solid: true, station: true, desc: 'Unlocks building recipes within a few steps.' },
  chest: { name: 'Storage chest', solid: true, desc: 'Keeps resources safe at camp.' },
  torch: { name: 'Torch', solid: false, desc: 'A little light at night.' },
  bed: { name: 'Bedroll', solid: false, desc: 'A cosy straw pallet. Sleep at dusk or night to wake at dawn.' },
  brazier: { name: 'Warding brazier', solid: true, desc: 'A glowing brazier that suppresses hostile creature spawns in camp.' },
};
export function pieceParts(type, roofColor=0xc8a050) {
  switch (type) {
    case 'roof': return [B(1.1,.14,1.1,0,0,0,roofColor),B(.8,.14,.8,0,.14,0,roofColor)];
    case 'floor': return [B(1, 0.08, 1, 0, 0, 0, 0xa8784a), B(0.96, 0.02, 0.05, 0, 0.08, -0.25, 0x8a5e36), B(0.96, 0.02, 0.05, 0, 0.08, 0.25, 0x8a5e36)];
    case 'wall': return [B(1, 1.3, 0.9, 0, 0, 0, 0x9a6a3a), B(1.02, 0.12, 0.94, 0, 1.3, 0, 0x7a5230), B(0.12, 1.3, 0.94, -0.44, 0, 0, 0x7a5230), B(0.12, 1.3, 0.94, 0.44, 0, 0, 0x7a5230)];
    case 'stonewall': return [B(1, 1.3, 0.9, 0, 0, 0, 0xa8a294), B(0.5, 0.28, 0.92, -0.24, 0.3, 0, 0x948e82), B(0.5, 0.28, 0.92, 0.24, 0.75, 0, 0x948e82)];
    case 'door': return [B(0.16, 1.4, 0.3, -0.42, 0, 0, 0x7a5230), B(0.16, 1.4, 0.3, 0.42, 0, 0, 0x7a5230), B(1, 0.18, 0.3, 0, 1.4, 0, 0x7a5230)];
    case 'campfire': return [...Array.from({ length: 6 }, (_, i) => { const a = i / 6 * 6.28; return B(0.2, 0.14, 0.2, Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36, 0x8a8478); }), B(0.5, 0.1, 0.12, 0, 0.05, 0, 0x6a4424, 0, 0.5, 0), B(0.5, 0.1, 0.12, 0, 0.1, 0, 0x6a4424, 0, -0.5, 0)];
    case 'workbench': return [B(1, 0.12, 0.7, 0, 0.55, 0, 0xb8844e), B(0.1, 0.55, 0.1, -0.42, 0, -0.28, 0x7a5230), B(0.1, 0.55, 0.1, 0.42, 0, -0.28, 0x7a5230), B(0.1, 0.55, 0.1, -0.42, 0, 0.28, 0x7a5230), B(0.1, 0.55, 0.1, 0.42, 0, 0.28, 0x7a5230), B(0.3, 0.12, 0.14, -0.2, 0.67, 0.1, 0x8a8a90), B(0.14, 0.2, 0.14, 0.25, 0.67, -0.1, 0xa8784a)];
    case 'chest': return [B(0.8, 0.5, 0.56, 0, 0, 0, 0x9a6a3a), B(0.84, 0.18, 0.6, 0, 0.5, 0, 0x7a5230), B(0.14, 0.16, 0.06, 0, 0.42, 0.3, 0xd8b050)];
    case 'torch': return [B(0.1, 0.9, 0.1, 0, 0, 0, 0x7a5230), B(0.18, 0.14, 0.18, 0, 0.9, 0, 0x5a3a20)];
    case 'bed': return [B(1, 0.12, 1.4, 0, 0.06, 0, 0x8a5e36), B(0.96, 0.08, 0.9, 0, 0.14, 0.22, 0x3a5a78), B(0.76, 0.14, 0.36, 0, 0.16, -0.42, 0xe8e0c0), B(0.98, 0.03, 0.06, 0, 0.16, -0.22, 0xd8b050)];
    case 'brazier': return [B(0.5, 0.5, 0.5, 0, 0.25, 0, 0x7a7468), B(0.64, 0.14, 0.64, 0, 0.55, 0, 0x5a5448), B(0.32, 0.18, 0.32, 0, 0.68, 0, 0x8ae8ff)];
    default: return [B(0.5, 0.5, 0.5, 0, 0, 0, 0xff00ff)];
  }
}
export class Structure extends Entity {
  constructor(g, s, owner) {
    super(g, s.x, s.z); this.s = s; this.id = s.id; this.type = s.type; this.owner = owner; this.P = PIECES[s.type];
    this.solid = this.P.solid; this.hw = this.hd = s.type === 'campfire' || s.type === 'chest' || s.type === 'brazier' ? 0.42 : 0.5; this.isStructure = true;
    this.interactable = ['campfire', 'workbench', 'chest', 'bed'].includes(s.type);
    if (s.type === 'roof') { this.mat = new THREE.MeshLambertMaterial({ color: 0xc8a050, transparent: true, opacity: 1 }); const m = new THREE.Mesh(geo(pieceParts('roof',0xffffff)), this.mat); m.position.y = 1.45; this.obj.add(m); }
    else { const m = new THREE.Mesh(geo(pieceParts(s.type)), MAT); m.castShadow = true; this.obj.add(m); }
    if (s.type === 'campfire' || s.type === 'torch' || s.type === 'brazier') {
      const isBrazier = s.type === 'brazier';
      const col = isBrazier ? 0x8ae8ff : 0xffb347;
      const lightCol = isBrazier ? 0x8ae8ff : 0xffa050;
      this.flame = new THREE.Mesh(geo([B(0.22, 0.3, 0.22, 0, 0, 0, col), B(0.12, 0.2, 0.12, 0, 0.24, 0, isBrazier ? 0xdaf8ff : 0xfff0a0)]), MAT_GLOW, false);
      this.flame.position.y = s.type === 'torch' ? 1.0 : (isBrazier ? 0.72 : 0.12);
      this.obj.add(this.flame);
      if (owner.lightsInUse < 6) {
        owner.lightsInUse++;
        this.light = new THREE.PointLight(lightCol, s.type === 'torch' ? 1.4 : (isBrazier ? 2.8 : 2.4), s.type === 'torch' ? 4 : (isBrazier ? 7 : 6), 1.6);
        this.light.position.y = isBrazier ? 1.4 : 1.2;
        this.obj.add(this.light);
      }
    }
  }
  get prompt() { return { campfire: 'Rest · set home here', workbench: 'Craft at the workbench', chest: 'Open storage', bed: 'Rest · sleep until dawn' }[this.type] || null; }
  interact() { this.owner.useStructure(this); }
  remove() { if (this.light) this.owner.lightsInUse--; super.remove(); }
  update(dt) {
    if (this.flame) {
      this.flame.scale.y = 0.85 + Math.sin(this.g.time * 12 + this.x) * 0.15;
      const isBrazier = this.s.type === 'brazier';
      if (Math.random() < 0.15) this.g.fx.add({ x: this.x, y: this.flame.position.y + 0.3, z: this.z, vy: 1, g: -1, color: isBrazier ? 0x8ae8ff : 0xffb347, life: 0.5, size: 0.04 });
    }
    if (this.mat) { const p = this.g.player, near = Math.abs(p.x - this.x) < 1.6 && Math.abs(p.z - this.z) < 1.6; this.mat.opacity += ((near ? 0.25 : 1) - this.mat.opacity) * Math.min(1, dt * 8); this.mat.depthWrite = this.mat.opacity > 0.9; }
  }
}

// ------------------------------------------------------------------ generated landmarks
export class CaveMouth extends Entity {
  constructor(g, d, owner) {
    super(g, d.x, d.z); this.d = d; this.id = d.id; this.owner = owner; this.solid = false; this.interactable = true;
    this.obj.add(new THREE.Mesh(geo([B(0.7, 1.6, 0.8, -1.1, 0, 0, 0x6a6470), B(0.7, 1.6, 0.8, 1.1, 0, 0, 0x6a6470), B(2.9, 0.6, 0.9, 0, 1.5, 0, 0x5a5460), B(1.6, 1.4, 0.2, 0, 0, -0.35, 0x0c0812), B(0.5, 0.3, 0.5, -1.3, 1.9, 0.1, 0x4f8a3c), B(0.4, 0.25, 0.4, 1.2, 2.0, 0, 0x4f8a3c)]), MAT));
  }
  get prompt() { return this.owner.caveState(this.id).cleared ? 'Enter the cave (cleared)' : 'Enter the cave'; }
  interact() { this.owner.enterCave(this.id, this.x, this.z + 1.4); }
  update() { const p = this.g.player; if (!this.seen && Math.hypot(p.x - this.x, p.z - this.z) < 7) { this.seen = true; this.owner.discover({ id: this.id, type: 'cave', x: this.x, z: this.z, name: 'Cave mouth' }); } }
}
export class Landmark extends Entity { // ruins, standing stones, the start shelter
  constructor(g, d, owner) {
    super(g, d.x, d.z); this.d = d; this.owner = owner; this.solid = false;
    const P = [];
    if (d.type === 'ruin7s') { for (const [x, z, h] of [[-2, -2, 1.6], [2, -2, 0.9], [-2, 2, 0.6], [2, 2, 1.3], [0, -2.3, 0.4]]) P.push(B(0.6, h, 0.6, x, 0, z, 0xb0a894), B(0.66, 0.12, 0.66, x, h, z, 0x9a927e)); P.push(B(1.2, 0.5, 0.3, 0, 0, -1.6, 0xa09884)); }
    if (d.type === 'stones7s') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; P.push(B(0.5, 1.2 + (i % 3) * 0.3, 0.4, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6, 0x9a9aa8, 0, -a, 0)); }
    if (d.type === 'shelter7s') { P.push(B(0.12, 1.3, 0.12, -1.6, 0, -2, 0x7a5230), B(0.12, 1.3, 0.12, 1.6, 0, -2, 0x7a5230), B(3.4, 0.1, 1.4, 0, 1.3, -1.7, 0xc8a050, -0.35, 0, 0), B(0.9, 0.3, 0.6, -2.6, 0, 1.5, 0x7a5230), B(0.12, 1.0, 0.12, 2.6, 0, 1.6, 0x7a5230), B(0.8, 0.4, 0.1, 2.6, 0.8, 1.6, 0xc8a878)); }
    const m = new THREE.Mesh(geo(P), MAT); m.castShadow = true; this.obj.add(m);
  }
  update() { const p = this.g.player; if (!this.seen && Math.hypot(p.x - this.x, p.z - this.z) < 8) { this.seen = true; const name = { ruin7s: 'Old ruin', stones7s: 'Standing stones', shelter7s: 'Your camp' }[this.d.type]; this.owner.discover({ id: this.d.id, type: this.d.type, x: this.x, z: this.z, name }); } }
}
export class LootCache extends Entity {
  constructor(g, d, owner) {
    super(g, d.x, d.z); this.d = d; this.id = d.id; this.owner = owner; this.solid = true; this.hw = 0.4; this.hd = 0.3; this.interactable = true;
    this.lid = new THREE.Mesh(geo([B(0.74, 0.2, 0.52, 0, 0, 0, 0xc09040)]), MAT); this.lid.position.y = 0.42;
    this.obj.add(new THREE.Mesh(geo([B(0.7, 0.42, 0.48, 0, 0, 0, 0x8a6a3a), B(0.12, 0.14, 0.05, 0, 0.3, 0.26, 0xe8c860)]), MAT), this.lid);
    if (owner.isOpened(this.id)) this.lid.rotation.x = -1.4;
  }
  get prompt() { return this.owner.isOpened(this.id) ? null : 'Open'; }
  interact() { if (this.owner.isOpened(this.id)) return; this.lid.rotation.x = -1.4; this.owner.openCache(this); }
}
