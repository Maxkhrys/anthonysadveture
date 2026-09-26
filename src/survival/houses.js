// Survival houses: the building grid, elevation (support heights), placement and removal rules,
// and the interior cutaway. Pure logic (no rendering): the same code validates a player's
// placement, a generated template and a removal, and gives walkers their floor height.
//
// Elevation model. The survival wilds are flat, so a walker's height is `fy`, its support height
// above the ground. Every frame a walker takes the highest surface under it that is at most one
// step above its feet: the ground, a floor or foundation on any level, or the ramp of a stair it
// stands in. Stepping down less than a step snaps; more than that is a fall (no damage). Walls,
// rails and door leaves collide only with walkers whose height overlaps them, so storeys are
// separate spaces at the same x/z. Entity.sync adds fy to the model and camera height.
import { KIT, M, STOREY, FLOOR_T, MAX_LEVEL, WALK_H, ROOF_RISE, DIRS, levelY, kitBoxes, rot, edgeRot, edgeOf, edgeCells, cellEdges } from './kit.js';

export const STEP = 0.55;       // the highest ledge a walker steps up (matches the entity STEP)
export const STUB = 0.12;       // wall height kept, as a fraction, when a wall is cut away
export const FURNITURE = new Set(['campfire', 'workbench', 'chest', 'torch']);
const LEGACY = new Set(['floor', 'wall', 'stonewall', 'door', 'roof']);
const nameOf = s => (KIT[s.type] || {}).name || s.type;

// ------------------------------------------------------------------ where a piece sits
export function locate(s) {
  const K = KIT[s.type], lv = s.lv | 0, r = s.r | 0;
  if (!K) return { kind: 'tile', lv, r, tx: Math.floor(s.x), tz: Math.floor(s.z) };
  if (K.kind === 'cell') return { kind: 'cell', lv, r, cx: Math.floor(s.x / M), cz: Math.floor(s.z / M) };
  if (K.kind === 'edge') return { kind: 'edge', lv, r, ...edgeOf(s.x, s.z, r) };
  return { kind: 'vertex', lv, r, vx: Math.round(s.x / M), vz: Math.round(s.z / M) };
}
export function slotKey(s) {
  const K = KIT[s.type], L = locate(s);
  if (!K) return (s.type === 'roof' ? 'lr:' : 't:') + L.lv + ':' + L.tx + ',' + L.tz;
  switch (K.layer) {
    case 'floor': return 'f:' + L.lv + ':' + L.cx + ',' + L.cz;
    case 'stairs': return 's:' + L.lv + ':' + L.cx + ',' + L.cz;
    case 'roof': return 'r:' + L.lv + ':' + L.cx + ',' + L.cz;
    case 'wall': return 'w:' + L.lv + ':' + L.a + ':' + L.ex + ',' + L.ez;
    case 'gable': return 'w:' + (L.lv + 1) + ':' + L.a + ':' + L.ex + ',' + L.ez; // a gable fills the wall band above its roof's storey
    default: return 'p:' + L.lv + ':' + L.vx + ',' + L.vz;
  }
}
// a piece's footprint on the ground, in tiles [x0, z0, x1, z1]
export function footprint(s) {
  const K = KIT[s.type], L = locate(s);
  if (!K) return [L.tx, L.tz, L.tx + 1, L.tz + 1];
  if (L.kind === 'cell') return [L.cx * M, L.cz * M, L.cx * M + M, L.cz * M + M];
  if (L.kind === 'edge') return L.a === 'h' ? [L.ex * M, L.ez * M - 0.15, L.ex * M + M, L.ez * M + 0.15] : [L.ex * M - 0.15, L.ez * M, L.ex * M + 0.15, L.ez * M + M];
  return [L.vx * M - 0.15, L.vz * M - 0.15, L.vx * M + 0.15, L.vz * M + 0.15];
}
// the canonical record for a piece of `type` placed at a point, on level lv, turned r
export function snapPiece(type, x, z, lv, r = 0) {
  const K = KIT[type]; r = ((r | 0) % 4 + 4) % 4;
  if (!K) return { type, x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5, lv, r };
  if (K.kind === 'cell') return { type, x: Math.floor(x / M) * M + M / 2, z: Math.floor(z / M) * M + M / 2, lv, r: K.rotates ? r : 0 };
  if (K.kind === 'vertex') return { type, x: Math.round(x / M) * M, z: Math.round(z / M) * M, lv, r: 0 };
  // edges snap to the side of the module nearest the point; r only flips a door's swing
  const cx = Math.floor(x / M), cz = Math.floor(z / M), fx = x / M - cx, fz = z / M - cz;
  const side = [[fz, 'h', 0], [1 - fz, 'h', 1], [fx, 'v', 0], [1 - fx, 'v', 1]].sort((a, b) => a[0] - b[0])[0];
  const flip = r >= 2 ? 2 : 0;
  if (side[1] === 'h') return { type, x: cx * M + M / 2, z: (cz + side[2]) * M, lv, r: flip };
  return { type, x: (cx + side[2]) * M, z: cz * M + M / 2, lv, r: 1 + flip };
}

// ------------------------------------------------------------------ the grid
export class HouseGrid {
  constructor() { this.slots = new Map(); this.ents = new Map(); this.deco = new Map(); this.version = 0; this.skip = null; }
  add(s, ent) { this.slots.set(slotKey(s), s); if (ent) this.ents.set(s.id, ent); this.version++; }
  remove(s) { const k = slotKey(s); if (this.slots.get(k) === s) { this.slots.delete(k); this.version++; } this.ents.delete(s.id); }
  get(k) { const s = this.slots.get(k); return !s || (this.skip && this.skip.has(s)) ? null : s; }
  floor(lv, cx, cz) { return this.get('f:' + lv + ':' + cx + ',' + cz); }
  stairs(lv, cx, cz) { return this.get('s:' + lv + ':' + cx + ',' + cz); }
  roof(lv, cx, cz) { return this.get('r:' + lv + ':' + cx + ',' + cz); }
  wall(lv, a, ex, ez) { const w = this.get('w:' + lv + ':' + a + ':' + ex + ',' + ez); return w && KIT[w.type].layer === 'wall' ? w : null; }
  band(lv, a, ex, ez) { return this.get('w:' + lv + ':' + a + ':' + ex + ',' + ez); } // a wall or the gable above a lower roof
  post(lv, vx, vz) { return this.get('p:' + lv + ':' + vx + ',' + vz); }
  tile(lv, tx, tz) { return this.get('t:' + lv + ':' + tx + ',' + tz); }
  pieces() { return [...this.slots.values()].filter(s => !this.skip || !this.skip.has(s)); }
  clear() { this.slots.clear(); this.ents.clear(); this.deco.clear(); this.version++; }
}

// ------------------------------------------------------------------ surfaces and support
export const floorTop = s => levelY(s.lv | 0) + KIT[s.type].surface;
export function stairSpan(grid, s) { const L = locate(s), f = grid.floor(L.lv, L.cx, L.cz); return { h0: f ? floorTop(f) : levelY(L.lv), h1: levelY(L.lv + 1) + FLOOR_T }; }
export function rampAt(grid, s, x, z) {
  const S = stairSpan(grid, s), [, lz] = rot(x - s.x, z - s.z, (4 - (s.r | 0)) % 4), t = Math.max(0, Math.min(1, (lz + 1) / 2));
  return { h: S.h0 + (S.h1 - S.h0) * t, ...S };
}
// the surface a walker at height y stands on at (x, z)
export function supportHeight(grid, x, z, y) {
  const cx = Math.floor(x / M), cz = Math.floor(z / M); let best = 0;
  for (let L = 0; L <= MAX_LEVEL; L++) {
    const f = grid.floor(L, cx, cz); if (f) { const h = floorTop(f); if (h <= y + STEP && h > best) best = h; }
    const s = grid.stairs(L, cx, cz); if (s) { const R = rampAt(grid, s, x, z); if (y >= R.h0 - 0.3 && y <= R.h1 + 0.6 && R.h > best) best = R.h; }
  }
  return best;
}
export function applySupport(grid, e, dt) {
  const y = e.fy || 0, target = supportHeight(grid, e.x, e.z, y);
  if (target >= y - STEP) { e.fy = target; e.fvy = 0; e.falling = false; return; }
  e.fvy = (e.fvy || 0) - 24 * Math.min(dt || 0.016, 0.05); e.fy = Math.max(target, y + e.fvy * Math.min(dt || 0.016, 0.05));
  e.falling = e.fy > target; if (!e.falling) e.fvy = 0;
}
export const levelOf = y => Math.max(0, Math.floor(((y || 0) + 0.5) / STOREY));
export const sameLevel = (a, b) => Math.abs((a?.fy || 0) - (b?.fy || 0)) < 1.25;
// does a collider spanning [lo, hi] (absolute) block a walker at height y?
export const spans = (lo, hi, y) => (y || 0) < hi - 0.05 && (y || 0) + WALK_H > lo + 0.05;

// ------------------------------------------------------------------ colliders (world boxes)
export function pieceBase(grid, s) {
  const K = KIT[s.type], L = locate(s);
  if (K && K.layer === 'stairs') return stairSpan(grid, s).h0;
  if (K && (K.layer === 'roof' || K.layer === 'gable')) return levelY(L.lv + 1);
  if (!K) { if (!L.lv && !grid.floor(0, Math.floor(L.tx / M), Math.floor(L.tz / M))) return 0; const f = grid.floor(L.lv, Math.floor(L.tx / M), Math.floor(L.tz / M)); return f ? floorTop(f) : levelY(L.lv); }
  return levelY(L.lv);
}
export function worldBoxes(grid, s) {
  const K = KIT[s.type]; if (!K) return [];
  const base = pieceBase(grid, s), rise = K.layer === 'stairs' ? stairSpan(grid, s).h1 - base : undefined, out = [];
  for (const b of kitBoxes(s.type, rise)) {
    const [bx0, bx1, bz0, bz1] = b.b, R = K.kind === 'edge' ? edgeRot : rot, r = s.r | 0;
    const p = [R(bx0, bz0, r), R(bx1, bz1, r)];
    out.push({ x0: s.x + Math.min(p[0][0], p[1][0]), x1: s.x + Math.max(p[0][0], p[1][0]), z0: s.z + Math.min(p[0][1], p[1][1]), z1: s.z + Math.max(p[0][1], p[1][1]), lo: base + b.lo, hi: base + b.hi, leaf: !!b.leaf });
  }
  return out;
}

// ------------------------------------------------------------------ rules
function directSupport(grid, lv, cx, cz) { // a floor on lv >= 1 rests on walls or posts of the storey below
  for (const [a, ex, ez] of cellEdges(cx, cz)) if (grid.wall(lv - 1, a, ex, ez)) return true;
  for (const [vx, vz] of [[cx, cz], [cx + 1, cz], [cx, cz + 1], [cx + 1, cz + 1]]) if (grid.post(lv - 1, vx, vz)) return true;
  return false;
}
const isOpening = w => w && (w.type === 'timber_doorway' || w.type === 'timber_door');
const edgeToward = (cx, cz, d) => d[0] === 1 ? ['v', cx + 1, cz] : d[0] === -1 ? ['v', cx, cz] : d[1] === 1 ? ['h', cx, cz + 1] : ['h', cx, cz];
export function stairEdges(s) { const L = locate(s), d = DIRS[L.r]; return { entry: edgeToward(L.cx, L.cz, [-d[0], -d[1]]), exit: edgeToward(L.cx, L.cz, d), exitCell: [L.cx + d[0], L.cz + d[1]], entryCell: [L.cx - d[0], L.cz - d[1]], lv: L.lv }; }
// the tiles right beside an edge's midpoint, on both sides (kept clear in front of doors and stairs)
function edgeClearTiles(a, ex, ez) { return a === 'h' ? [[ex * M, ez * M - 1], [ex * M + 1, ez * M - 1], [ex * M, ez * M], [ex * M + 1, ez * M]] : [[ex * M - 1, ez * M], [ex * M - 1, ez * M + 1], [ex * M, ez * M], [ex * M, ez * M + 1]]; }
function cellTiles(cx, cz) { return [[cx * M, cz * M], [cx * M + 1, cz * M], [cx * M, cz * M + 1], [cx * M + 1, cz * M + 1]]; }
function inCell(t, cx, cz) { return Math.floor(t[0] / M) === cx && Math.floor(t[1] / M) === cz; }

// Is the piece held up? (also re-run on neighbours before a removal)
export function supportWhy(grid, s) {
  const K = KIT[s.type], L = locate(s), lv = L.lv;
  if (!K) {
    if (LEGACY.has(s.type)) return '';
    const cx = Math.floor(L.tx / M), cz = Math.floor(L.tz / M), f = grid.floor(lv, cx, cz);
    if (s.type === 'campfire') { if (lv > 0) return 'A campfire belongs on the ground floor.'; return f && f.type === 'timber_floor' ? 'A campfire needs bare ground or stone, not planks.' : ''; }
    if (lv > 0 && !f) return 'Needs a floor under it on this level.';
    return '';
  }
  switch (K.layer) {
    case 'floor': {
      if (lv === 0) return '';
      if (directSupport(grid, lv, L.cx, L.cz)) return '';
      for (const [dx, dz] of DIRS) if (grid.floor(lv, L.cx + dx, L.cz + dz) && directSupport(grid, lv, L.cx + dx, L.cz + dz)) return '';
      return 'An upper floor needs a wall or post below it, or a supported floor beside it.';
    }
    case 'wall': {
      if (lv === 0) return '';
      if (grid.wall(lv - 1, L.a, L.ex, L.ez)) return '';
      for (const [cx, cz] of edgeCells(L.a, L.ex, L.ez)) if (grid.floor(lv, cx, cz)) return '';
      return 'An upper wall needs a floor beside it or a wall below it.';
    }
    case 'post': {
      if (lv === 0 || grid.post(lv - 1, L.vx, L.vz)) return '';
      for (const [cx, cz] of [[L.vx - 1, L.vz - 1], [L.vx, L.vz - 1], [L.vx - 1, L.vz], [L.vx, L.vz]]) if (grid.floor(lv, cx, cz)) return '';
      return 'An upper post needs a floor or a post below it.';
    }
    case 'stairs': return lv > 0 && !grid.floor(lv, L.cx, L.cz) ? 'Stairs upstairs need a floor under them.' : '';
    case 'roof': {
      if (grid.floor(lv, L.cx, L.cz)) return '';
      for (const [dx, dz] of DIRS) if (grid.roof(lv, L.cx + dx, L.cz + dz) && grid.floor(lv, L.cx + dx, L.cz + dz)) return '';
      return 'A roof covers a floor on its level, or overhangs one module beside another roof.';
    }
    case 'gable': return gableShape(grid, s) ? '' : 'Gables close the sloped end of a roof: place one beside a roof module.';
  }
  return '';
}
// gables shape themselves to the roof beside them: 'up' rises along the edge's +x ('flip' turns it)
export function gableShape(grid, s) {
  const L = locate(s), ax = L.a === 'h' ? [1, 0] : [0, 1];
  for (const [cx, cz] of edgeCells(L.a, L.ex, L.ez)) {
    const rf = grid.roof(L.lv, cx, cz); if (!rf) continue;
    if (rf.type === 'thatch_roof') { const d = DIRS[rf.r | 0]; if (d[0] === ax[0] && d[1] === ax[1]) return { v: 'up', flip: false }; if (d[0] === -ax[0] && d[1] === -ax[1]) return { v: 'up', flip: true }; }
    if (rf.type === 'thatch_ridge') { const along = (rf.r | 0) % 2 === 0 ? [1, 0] : [0, 1]; if (along[0] !== ax[0]) return { v: 'peak', flip: false }; }
  }
  return null;
}
// Everything that decides whether a piece can go here. env supplies the world:
//   env.groundWhy(x0, z0, x1, z1)  terrain, scenery and old tile pieces in a ground rect ('' if clear)
//   env.bodies()                    walkers [{x, z, r, fy, isPlayer}]
export function placeWhy(grid, env, s) {
  const K = KIT[s.type], L = locate(s), lv = L.lv;
  if (!K) return furnitureWhy(grid, env, s);
  if (lv < K.levels[0] || lv > K.levels[1]) return K.levels[1] === 0 ? `${K.name} only goes on the ground.` : `${K.name}: no higher than level ${K.levels[1]}.`;
  const held = grid.get(slotKey(s)); if (held) return K.layer === 'gable' || KIT[held.type]?.layer === 'gable' ? 'That wall space is already taken.' : 'Something is already built here.';
  if (lv === 0 && K.layer !== 'roof' && K.layer !== 'gable') { const [x0, z0, x1, z1] = footprint(s); const w = env.groundWhy(x0, z0, x1, z1, s); if (w) return w; }
  // storey conflicts
  if (K.layer === 'floor') {
    if (lv > 0 && grid.stairs(lv - 1, L.cx, L.cz)) return 'Leave the stairwell open.';
    if (lv > 0 && grid.roof(lv - 1, L.cx, L.cz)) return 'There is a roof below; take it down first.';
  }
  if (K.layer === 'stairs') {
    if (lv + 1 > MAX_LEVEL) return 'Nothing to climb to from the top floor.';
    if (grid.floor(lv + 1, L.cx, L.cz)) return 'Stairs need open space above: take up the floor overhead.';
    if (grid.roof(lv, L.cx, L.cz)) return 'A roof is in the way of the stairs.';
    const E = stairEdges(s), en = grid.band(lv, ...E.entry), ex = grid.band(lv + 1, ...E.exit);
    if (en && !isOpening(en)) return 'The low end of the stairs faces a wall.';
    if (ex && !isOpening(ex)) return 'The top of the stairs opens onto a wall.';
    for (const [tx, tz] of cellTiles(L.cx, L.cz)) if (grid.tile(lv, tx, tz)) return 'Clear the furniture off first.';
    for (const [tx, tz] of edgeClearTiles(...E.entry)) if (inCell([tx, tz], ...E.entryCell) && grid.tile(lv, tx, tz)) return 'Keep the foot of the stairs clear.';
    for (const [tx, tz] of edgeClearTiles(...E.exit)) if (inCell([tx, tz], ...E.exitCell) && grid.tile(lv + 1, tx, tz)) return 'Keep the top of the stairs clear.';
  }
  if (K.layer === 'roof') {
    if (grid.floor(lv + 1, L.cx, L.cz)) return 'There is a floor above; roofs go on top.';
    if (grid.stairs(lv, L.cx, L.cz)) return 'Stairs climb through here; leave it open.';
  }
  if (K.layer === 'wall') {
    for (const [cx, cz] of edgeCells(L.a, L.ex, L.ez)) {
      for (const [sl, which] of [[lv, 'entry'], [lv - 1, 'exit']]) {
        const st = sl >= 0 && grid.stairs(sl, cx, cz); if (!st) continue;
        const E = stairEdges(st)[which]; if (E[0] === L.a && E[1] === L.ex && E[2] === L.ez && !isOpening(s)) return which === 'entry' ? 'That would block the foot of the stairs.' : 'That would block the top of the stairs.';
      }
    }
    if (isOpening(s)) for (const [tx, tz] of edgeClearTiles(L.a, L.ex, L.ez)) if (grid.tile(lv, tx, tz)) return 'Clear the doorway first: furniture stands there.';
  }
  const sw = supportWhy(grid, s); if (sw) return sw;
  // bodies in the way (never build on top of the player or a creature)
  const boxes = worldBoxes(grid, s);
  if (K.layer === 'stairs') { const [x0, z0, x1, z1] = footprint(s); boxes.push({ x0, z0, x1, z1, lo: levelY(lv) - 0.2, hi: levelY(lv + 1) }); }
  for (const b of env.bodies()) for (const q of boxes) {
    if (q.leaf && s.open) continue;
    if (b.x + b.r > q.x0 && b.x - b.r < q.x1 && b.z + b.r > q.z0 && b.z - b.r < q.z1 && spans(q.lo, q.hi, b.fy)) return b.isPlayer ? 'You are standing there.' : 'Something is in the way.';
  }
  if (K.solid === 'full' && env.player && wouldTrap(grid, s, env.player)) return 'That would wall you in. Leave a doorway.';
  return '';
}
function furnitureWhy(grid, env, s) {
  const L = locate(s), lv = L.lv, cx = Math.floor(L.tx / M), cz = Math.floor(L.tz / M);
  if (LEGACY.has(s.type) && lv > 0) return 'Old-style pieces only go on the ground.';
  if (lv > MAX_LEVEL) return 'Too high.';
  if (grid.get(slotKey(s))) return 'Something is already built here.';
  if (grid.stairs(lv, cx, cz)) return 'Not on the stairs.';
  if (lv > 0 && grid.stairs(lv - 1, cx, cz)) return 'That is the stairwell.';
  for (const [a, ex, ez] of cellEdges(cx, cz)) if (isOpening(grid.wall(lv, a, ex, ez)) && edgeClearTiles(a, ex, ez).some(t => t[0] === L.tx && t[1] === L.tz)) return 'Keep the doorway clear.';
  for (const [dx, dz] of [[0, 0], ...DIRS]) for (const [sl, which, cellKey] of [[lv, 'entry', 'entryCell'], [lv - 1, 'exit', 'exitCell']]) {
    const st = sl >= 0 && grid.stairs(sl, cx + dx, cz + dz); if (!st) continue; const E = stairEdges(st);
    if (inCell([L.tx, L.tz], ...E[cellKey]) && edgeClearTiles(...E[which]).some(t => t[0] === L.tx && t[1] === L.tz)) return which === 'entry' ? 'Keep the foot of the stairs clear.' : 'Keep the top of the stairs clear.';
  }
  const sw = supportWhy(grid, s); if (sw) return sw;
  return env.furnitureWhy ? env.furnitureWhy(s) : '';
}
// Would this wall close the player into a space with no way out? (doors count as ways out; on
// an upper floor an open edge or the stairwell does too, since you can step down)
export function wouldTrap(grid, s, body) {
  const L = locate(s); if (levelOf(body.fy) !== L.lv) return false;
  const key = slotKey(s), had = grid.slots.get(key); grid.slots.set(key, s);
  try {
    const lv = L.lv, sx = Math.floor(body.x / M), sz = Math.floor(body.z / M), seen = new Set([sx + ',' + sz]), q = [[sx, sz]];
    while (q.length) {
      const [cx, cz] = q.shift();
      if (Math.max(Math.abs(cx - sx), Math.abs(cz - sz)) >= 6) return false;
      if (lv > 0 && (grid.stairs(lv, cx, cz) || !grid.floor(lv, cx, cz))) return false;
      if (lv === 0 && grid.stairs(0, cx, cz)) return false;
      for (const d of DIRS) {
        const n = [cx + d[0], cz + d[1]], k = n[0] + ',' + n[1]; if (seen.has(k)) continue;
        const w = grid.band(lv, ...edgeToward(cx, cz, d)); if (w && !isOpening(w)) continue;
        seen.add(k); q.push(n); if (seen.size > 200) return false;
      }
    }
    return true;
  } finally { if (had) grid.slots.set(key, had); else grid.slots.delete(key); }
}
// Can this piece come down without dropping anything? Refuses (never deletes dependants).
export function removeWhy(grid, s) {
  const K = KIT[s.type], L = locate(s);
  if (K && K.layer === 'floor') {
    for (const [tx, tz] of cellTiles(L.cx, L.cz)) if (grid.tile(L.lv, tx, tz)) return 'Take the furniture off this floor first.';
    if (grid.stairs(L.lv, L.cx, L.cz)) return 'The stairs stand on this floor. Take them down first.';
  }
  grid.skip = new Set([s]);
  try {
    for (const p of grid.slots.values()) {
      if (p === s || Math.abs(p.x - s.x) > 4.5 || Math.abs(p.z - s.z) > 4.5 || Math.abs((p.lv | 0) - L.lv) > 2) continue;
      if (supportWhy(grid, p)) return `It holds up the ${nameOf(p).toLowerCase()} ${(p.lv | 0) > L.lv ? 'above' : 'beside it'}. Take that down first.`;
    }
  } finally { grid.skip = null; }
  return '';
}

// ------------------------------------------------------------------ interior cutaway
// Buildings are the connected groups of modules with floors, stairs or roofs. Standing inside
// one (or just behind it) hides its roof and the storeys above you and lowers the walls between
// you and the camera to stubs. Collision never changes. Targets are recomputed only when the
// building, your storey or your row changes; pieces ease toward them so thresholds never pop.
export class Cutaway {
  constructor(grid) { this.grid = grid; this.v = -1; this.comps = []; this.active = null; this.key = ''; this.anim = new Set(); }
  rebuild() {
    const G = this.grid, cells = new Map(), parent = new Map();
    const find = k => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
    for (const s of G.slots.values()) { const K = KIT[s.type]; if (!K || K.kind !== 'cell') continue; const L = locate(s), k = L.cx + ',' + L.cz; if (!cells.has(k)) { cells.set(k, [L.cx, L.cz]); parent.set(k, k); } }
    for (const [k, [cx, cz]] of cells) for (const [dx, dz] of DIRS) { const n = (cx + dx) + ',' + (cz + dz); if (cells.has(n)) { const a = find(k), b = find(n); if (a !== b) parent.set(a, b); } }
    const comps = new Map(), compOfCell = (cx, cz) => { const k = cx + ',' + cz; return cells.has(k) ? comps.get(find(k)) : null; };
    for (const [k, [cx, cz]] of cells) { const r = find(k); let c = comps.get(r); if (!c) comps.set(r, c = { id: r, x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9, top: 0, pieces: [] }); c.x0 = Math.min(c.x0, cx * M); c.z0 = Math.min(c.z0, cz * M); c.x1 = Math.max(c.x1, cx * M + M); c.z1 = Math.max(c.z1, cz * M + M); }
    for (const s of G.slots.values()) {
      const L = locate(s); let c = null;
      if (L.kind === 'cell') c = compOfCell(L.cx, L.cz);
      else if (L.kind === 'edge') { for (const [cx, cz] of edgeCells(L.a, L.ex, L.ez)) if ((c = compOfCell(cx, cz))) break; }
      else if (L.kind === 'vertex') { for (const [cx, cz] of [[L.vx - 1, L.vz - 1], [L.vx, L.vz - 1], [L.vx - 1, L.vz], [L.vx, L.vz]]) if ((c = compOfCell(cx, cz))) break; }
      else c = compOfCell(Math.floor(L.tx / M), Math.floor(L.tz / M));
      if (c) { c.pieces.push(s); c.top = Math.max(c.top, levelY(L.lv + 1) + (KIT[s.type]?.layer === 'roof' ? ROOF_RISE * 1.25 : 0)); }
    }
    for (const d of G.deco.values()) { const c = compOfCell(Math.floor(d.x / M), Math.floor(d.z / M)); if (c) c.pieces.push(d); }
    this.comps = [...comps.values()];
  }
  inside(c, p, m) { const behind = c.top / Math.tan(0.733) * 0.8; return p.x >= c.x0 - 0.3 - m && p.x <= c.x1 + 0.3 + m && p.z >= c.z0 - behind - m && p.z <= c.z1 + 0.3 + m; }
  target(s, pl, p) {
    const K = KIT[s.type], lv = s.lv | 0;
    if (K && (K.layer === 'roof' || K.layer === 'gable')) return lv >= pl ? 0 : 1;
    if (lv > pl) return 0;
    if (lv === pl && K && (K.layer === 'wall' || K.layer === 'post') && s.z > p.z + 0.05) return STUB;
    return 1;
  }
  set(s, t) { const e = this.grid.ents.get(s.id) || s.ent; if (!e || !e.setVis) return; if (e.visT !== t) { e.visT = t; this.anim.add(e); } }
  update(p, dt) {
    const G = this.grid; if (G.version !== this.v) { this.v = G.version; this.rebuild(); this.key = ''; if (this.active && !this.comps.some(c => c.id === this.active.id)) this.active = null; else if (this.active) this.active = this.comps.find(c => c.id === this.active.id); }
    const pl = levelOf(p.fy);
    const act = this.active && this.inside(this.active, p, 0.6) ? this.active : this.comps.find(c => this.inside(c, p, 0)) || null;
    const key = (act ? act.id : '-') + ':' + pl + ':' + Math.floor(p.z * 2) + ':' + this.v;
    if (key !== this.key) {
      this.key = key;
      if (this.active && this.active !== act) for (const s of this.active.pieces) this.set(s, 1);
      if (act) for (const s of act.pieces) this.set(s, this.target(s, pl, p));
      this.active = act;
    }
    for (const e of this.anim) {
      if (e.dead) { this.anim.delete(e); continue; }
      const v = e.vis ?? 1, t = e.visT ?? 1, nv = Math.abs(t - v) < 0.02 ? t : v + (t - v) * Math.min(1, dt * 10);
      e.vis = nv; e.setVis(nv); if (nv === t) this.anim.delete(e);
    }
  }
  reset() { for (const e of this.anim) { e.vis = e.visT = 1; e.setVis && e.setVis(1); } this.anim.clear(); this.active = null; this.key = ''; this.v = -1; }
}
