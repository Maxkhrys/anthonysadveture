// Survival modular pieces in the world: one KitPiece entity per placed piece (walls, floors,
// stairs, roofs...) plus invisible PieceColliders for its solid boxes. Models are shared cached
// geometry with the shared vertex-colour material; the cutaway only scales them, so no piece
// ever clones a material.
import * as THREE from 'three';
import { Entity } from '../entities/entity.js';
import { MAT } from '../models.js';
import { KIT, kitGeo, doorLeafGeo, edgeYaw } from './kit.js';
import { worldBoxes, pieceBase, gableShape, stairSpan, spans } from './houses.js';

export class PieceCollider extends Entity {
  constructor(g, b, piece) {
    super(g, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    this.hw = (b.x1 - b.x0) / 2; this.hd = (b.z1 - b.z0) / 2; this.lo = b.lo; this.hi = b.hi; this.leaf = b.leaf; this.piece = piece;
    this.solid = true; this.isCollider = true; this.fy = b.lo;
  }
  attach() {} // nothing to draw
  // storey-aware: blocks only walkers (and shots) whose height overlaps this box
  solidFor(e) { if (this.leaf && this.piece.s.open) return false; return spans(this.lo, this.hi, e && e.fy); }
}

// the model a piece shows right now: gables follow the roof beside them, stairs the floor under them
export function pieceLook(grid, s) {
  const K = KIT[s.type]; let yaw = K.kind === 'edge' ? edgeYaw(s.r | 0) : K.kind === 'cell' ? (s.r | 0) * Math.PI / 2 : 0, geometry, key = s.type + ':' + (s.r | 0);
  if (s.type === 'timber_gable') { const sh = gableShape(grid, s) || { v: 'up', flip: false }; geometry = kitGeo(s.type, sh.v); yaw = edgeYaw((s.r | 0) % 2) + (sh.flip ? Math.PI : 0); key += ':' + sh.v + sh.flip; }
  else if (s.type === 'timber_stairs') { const S = stairSpan(grid, s); geometry = kitGeo(s.type, S.h1 - S.h0); key += ':' + (S.h1 - S.h0).toFixed(2); }
  else geometry = kitGeo(s.type);
  return { geometry, yaw, key };
}

export class KitPiece extends Entity {
  constructor(g, s, owner, gen = null) {
    super(g, s.x, s.z);
    this.s = s; this.id = s.id; this.type = s.type; this.owner = owner; this.K = KIT[s.type]; this.gen = gen; this.lv = s.lv | 0;
    this.isStructure = true; this.isKit = true; this.solid = false;
    owner.grid.add(s, this);
    this.fy = pieceBase(owner.grid, s);
    this.model = new THREE.Group(); this.obj.add(this.model);
    this.build();
    this.colliders = worldBoxes(owner.grid, s).map(b => g.spawn(new PieceCollider(g, b, this)));
    if (this.K.door) { this.interactable = true; const v = (s.r | 0) % 2; this.hw = v ? 0.15 : 0.5; this.hd = v ? 0.5 : 0.15; }
  }
  get hoverName() { return this.K.name; }
  shapeKey() { return pieceLook(this.owner.grid, this.s).key; }
  build() {
    const s = this.s, K = this.K; this.model.clear(); this.pivot = null;
    const { geometry, yaw, key } = pieceLook(this.owner.grid, s); this.shape = key;
    const frame = new THREE.Group(); frame.rotation.y = yaw; this.model.add(frame);
    const m = new THREE.Mesh(geometry, MAT); m.castShadow = true; frame.add(m);
    if (K.door) { this.pivot = new THREE.Group(); this.pivot.position.x = -0.48; const leaf = new THREE.Mesh(doorLeafGeo(), MAT); leaf.castShadow = true; this.pivot.add(leaf); frame.add(this.pivot); this.swing = s.open ? -1.45 : 0; this.pivot.rotation.y = this.swing; }
  }
  get prompt() { return this.K.door ? (this.s.open ? 'Close the door' : 'Open the door') : null; }
  interact() { this.owner.toggleDoor(this); }
  setVis(v) { this.model.scale.y = Math.max(0.001, v); this.model.visible = v > 0.02; }
  update(dt) {
    if (this.pivot) { const t = this.s.open ? -1.45 : 0; if (this.swing !== t) { this.swing += Math.max(-dt * 6, Math.min(dt * 6, t - this.swing)); this.pivot.rotation.y = this.swing; } }
  }
  remove() { this.owner.grid.remove(this.s); for (const c of this.colliders) c.remove(); super.remove(); }
}
