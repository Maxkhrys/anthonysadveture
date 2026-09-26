import * as THREE from 'three';
import { T, isSolid, isLiquid } from '../world/tiles.js';
import { clamp } from '../engine/util.js';

export class Entity {
  constructor(g, x, z) {
    this.g = g; this.x = x; this.z = z; this.y = 0;
    this.r = 0.3; this.vx = 0; this.vz = 0;
    this.dead = false; this.solid = false; this.hw = 0.5; this.hd = 0.5;
    this.moveMode = 'walk';
    this.obj = new THREE.Group();
    this.facing = 0;
    this.gustable = false;
    this.room = null;
  }
  attach() { this.g.world.add(this.obj); this.sync(); }
  // gy: the ground's height under the entity (Pass 6 terraces and stairs; 0 on flat land)
  // fy: support height above the ground (Survival houses: floors, stairs); walkers update it here
  sync() {
    if (this.g.support && (this.isPlayer || this.isEnemy)) this.g.support(this);
    this.gy = (this.g.groundAt ? this.g.groundAt(this.x, this.z) : 0) + (this.fy || 0); this.obj.position.set(this.x, this.y + this.gy, this.z);
  }
  remove() { this.dead = true; if (this.obj.parent) this.obj.parent.remove(this.obj); }
  update() {}
  dist(o) { return Math.hypot(o.x - this.x, o.z - this.z); }
  angleTo(o) { return Math.atan2(o.x - this.x, o.z - this.z); }
}

// ---------------- movement & collision
export const STEP = 0.55; // the highest ledge a walker steps up or down; stairs climb 0.3 a tile
// raised ground: walking onto a tile whose surface differs by more than a step is a wall
function ledge(g, tx, ty, e) {
  if (!g.area || !g.area.elevated) return false;
  const here = g.tileGround(Math.floor(e.x), Math.floor(e.z));
  return Math.abs(g.tileGround(tx, ty) - here) > STEP;
}
export function tileBlocks(g, tx, ty, e) {
  const t = g.tileAt(tx, ty);
  const mode = e.moveMode;
  if (mode === 'fly') return t === T.WALL || t === T.CLIFF || t === T.ROCK || t === T.PILLAR || t === T.PROP || t === T.TREE || t === T.SANDSTONE;
  if (mode === 'knock') return (isSolid(t) && !isLiquid(t)) || ledge(g, tx, ty, e);
  if (mode === 'player') return isSolid(t) || ledge(g, tx, ty, e);
  // walk (enemies): avoid pits and liquids
  return isSolid(t) || t === T.PIT || ledge(g, tx, ty, e);
}

function resolveBox(e, x0, z0, x1, z1) {
  const r = e.r;
  const px = clamp(e.x, x0, x1), pz = clamp(e.z, z0, z1);
  let dx = e.x - px, dz = e.z - pz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    e.x += dx / d * (r - d); e.z += dz / d * (r - d);
  } else {
    const l = e.x - x0, rr = x1 - e.x, t = e.z - z0, b = z1 - e.z;
    const m = Math.min(l, rr, t, b);
    if (m === l) e.x = x0 - r; else if (m === rr) e.x = x1 + r; else if (m === t) e.z = z0 - r; else e.z = z1 + r;
  }
  return true;
}

export function collide(g, e) {
  if (e.isPlayer && (g.noclip || e.noclip)) return false;
  let hit = false;
  for (let it = 0; it < 2; it++) {
    const r = e.r;
    const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r), z0 = Math.floor(e.z - r), z1 = Math.floor(e.z + r);
    for (let ty = z0; ty <= z1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tileBlocks(g, tx, ty, e)) hit = resolveBox(e, tx, ty, tx + 1, ty + 1) || hit;
    }
    if (e.moveMode !== 'fly' || e.isPlayer) {
      for (const s of g.solids) {
        if (s === e || s.dead || !s.solid) continue;
        if (Math.abs(s.x - e.x) > s.hw + r + 0.1 || Math.abs(s.z - e.z) > s.hd + r + 0.1) continue;
        if (s.solidFor && !s.solidFor(e)) continue;
        hit = resolveBox(e, s.x - s.hw, s.z - s.hd, s.x + s.hw, s.z + s.hd) || hit;
      }
    }
  }
  return hit;
}

export function move(g, e, dx, dz) {
  if (e.isPlayer && (g.noclip || e.noclip)) {
    e.x += dx;
    e.z += dz;
    return false;
  }
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / (e.r * 0.7)));
  let hit = false;
  for (let i = 0; i < steps; i++) {
    e.x += dx / steps; e.z += dz / steps;
    hit = collide(g, e) || hit;
  }
  return hit;
}
