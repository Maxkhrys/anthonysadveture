// Survival modular building kit: the shared registry for player-built and generated houses.
//
// Every piece has a stable id (the keys of KIT), a kind that decides how it snaps, and a model
// built from the same voxel boxes as the rest of Mossling. Generated houses (templates.js) use
// exactly these ids and the same placement data, so anything you see can be entered, walked,
// furnished and taken down like a piece you placed yourself.
//
// Grid
//   module   2 x 2 tiles (M). Cell pieces fill one module; edge pieces sit on a module's side;
//            vertex pieces (posts) sit on a module corner; furniture keeps the 1-tile grid.
//   level    0 is the ground storey. A storey is STOREY high; floors exist on levels 0..MAX_LEVEL.
//   r        rotation in quarter turns. Cells and furniture face r; an edge's axis is r % 2
//            (0 runs along x, 1 along z); r 2 / 3 flip a door's swing.
//
// A piece record (saved in world.structures, or generated) is { id, type, x, z, lv, r, open? }
// with x, z the piece's anchor in tiles: module centre (cell), side midpoint (edge), corner
// (vertex) or tile centre (furniture).
import { geo, B } from '../models.js';

export const M = 2;             // tiles per building module
export const STOREY = 2.0;      // one storey: wall height and the rise between floors
export const FLOOR_T = 0.1;     // timber floor thickness (walkable top)
export const FOUND_T = 0.3;     // stone foundation height (walkable top)
export const MAX_LEVEL = 2;     // floors on levels 0..2
export const ROOF_RISE = 1.5;   // a roof slope climbs this much over one module (steep enough to read from the camera)
export const WALK_H = 1.3;      // a walker's height, for storey-aware collision

const TIMBER = 0x6b4a2e, TIMBER_D = 0x553a22, PLASTER = 0xeadfc4, PLASTER_S = 0xd9cba8, STONE = 0xa9a396, STONE_D = 0x8f897c, STONE_L = 0xbdb7a8;
const PLANK = 0xb07f4e, PLANK_D = 0x946638, THATCH = 0xc9a24f, THATCH_D = 0xab8a3c, THATCH_L = 0xdcbc6a, GLASS = 0x6f8fa8, SHUTTER = 0x5f845a, DOOR = 0x8a5a34;

// The registry. layer: which slot the piece takes (one piece per slot per level).
// levels: allowed levels. solid: collision shape. station: workbench-style crafting station.
export const KIT = {
  stone_foundation: { name: 'Stone foundation', kind: 'cell', layer: 'floor', levels: [0, 0], surface: FOUND_T, desc: 'A raised stone base for one module (2×2). Takes campfires, walls, stairs and furniture.' },
  timber_floor: { name: 'Timber floor', kind: 'cell', layer: 'floor', levels: [0, MAX_LEVEL], surface: FLOOR_T, desc: 'A plank floor for one module. Upstairs it needs a wall, post or supported floor beside it.' },
  timber_wall: { name: 'Timber wall', kind: 'edge', layer: 'wall', levels: [0, MAX_LEVEL], solid: 'full', desc: 'A timber-framed wall along one side of a module.' },
  timber_window: { name: 'Window wall', kind: 'edge', layer: 'wall', levels: [0, MAX_LEVEL], solid: 'full', desc: 'A wall with a shuttered window. Lets light in, not people.' },
  stone_wall: { name: 'Stone wall', kind: 'edge', layer: 'wall', levels: [0, MAX_LEVEL], solid: 'full', desc: 'A heavy stone wall along one side of a module.' },
  timber_doorway: { name: 'Doorway', kind: 'edge', layer: 'wall', levels: [0, MAX_LEVEL], solid: 'jambs', desc: 'An open timber doorway. Always passable.' },
  timber_door: { name: 'Door', kind: 'edge', layer: 'wall', levels: [0, MAX_LEVEL], solid: 'jambs', door: true, desc: 'A doorway with a door. F opens and closes it; closed, it blocks creatures too.' },
  timber_post: { name: 'Timber post', kind: 'vertex', layer: 'post', levels: [0, MAX_LEVEL], solid: 'post', desc: 'A corner post. Holds up the floor above it (porches, balconies).' },
  timber_stairs: { name: 'Stairs', kind: 'cell', layer: 'stairs', levels: [0, MAX_LEVEL - 1], rotates: true, desc: 'Climbs one storey across a module. Enter at the low end; the top needs an open floor.' },
  thatch_roof: { name: 'Thatch roof', kind: 'cell', layer: 'roof', levels: [0, MAX_LEVEL], rotates: true, desc: 'A sloped roof over one module. Pairs face each other to make a ridge.' },
  thatch_ridge: { name: 'Roof ridge', kind: 'cell', layer: 'roof', levels: [0, MAX_LEVEL], rotates: true, desc: 'The peak module between two roof slopes (for roofs three modules deep).' },
  timber_gable: { name: 'Gable end', kind: 'edge', layer: 'gable', levels: [0, MAX_LEVEL], desc: 'Closes the sloped end of a roof. Shapes itself to the roof above.' },
};
export const isKit = type => !!KIT[type];

// ------------------------------------------------------------------ grid helpers
export const cellOf = (x, z) => ({ cx: Math.floor(x / M), cz: Math.floor(z / M) });
export const cellCentre = (cx, cz) => ({ x: cx * M + M / 2, z: cz * M + M / 2 });
// an edge is named by its axis and the module it bounds on the low side: 'h' runs along x at
// z = cz*M (the north side of module cx,cz); 'v' runs along z at x = cx*M (its west side)
export function edgeOf(x, z, r) { return r % 2 === 0 ? { a: 'h', ex: Math.floor(x / M), ez: Math.round(z / M) } : { a: 'v', ex: Math.round(x / M), ez: Math.floor(z / M) }; }
export const edgeAnchor = (a, ex, ez) => a === 'h' ? { x: ex * M + M / 2, z: ez * M } : { x: ex * M, z: ez * M + M / 2 };
// the two modules either side of an edge
export const edgeCells = (a, ex, ez) => a === 'h' ? [[ex, ez - 1], [ex, ez]] : [[ex - 1, ez], [ex, ez]];
// the four sides of a module as edges
export const cellEdges = (cx, cz) => [['h', cx, cz], ['h', cx, cz + 1], ['v', cx, cz], ['v', cx + 1, cz]];
// world direction a cell piece faces (stairs climb, roofs rise): r 0 +z, 1 +x, 2 -z, 3 -x
export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
// base height of a level (top of the storey below's walls)
export const levelY = lv => lv * STOREY;

// ------------------------------------------------------------------ models (shared, cached)
const GEO = new Map();
function cached(key, build) { let g = GEO.get(key); if (!g) { g = geo(build()); g.userData.shared = true; GEO.set(key, g); } return g; }
function frame(P, h = STOREY, sill = true) {
  if (sill) P.push(B(2.0, 0.16, 0.26, 0, 0, 0, TIMBER_D));
  P.push(B(2.0, 0.16, 0.26, 0, h - 0.16, 0, TIMBER_D), B(0.22, h, 0.3, -0.9, 0, 0, TIMBER), B(0.22, h, 0.3, 0.9, 0, 0, TIMBER));
}
const PARTS = {
  timber_wall() { const P = [], h = STOREY; frame(P, h); P.push(B(1.58, h - 0.32, 0.18, 0, 0.16, 0, PLASTER), B(0.12, h - 0.32, 0.22, 0, 0.16, 0, TIMBER), B(0.1, 1.0, 0.21, -0.45, 0.62, 0, TIMBER, 0, 0, 0.72), B(0.1, 1.0, 0.21, 0.45, 0.62, 0, TIMBER, 0, 0, -0.72), B(1.58, 0.06, 0.2, 0, 0.9, 0, PLASTER_S)); return P; },
  timber_window() {
    const P = [], h = STOREY; frame(P, h);
    P.push(B(1.58, 0.62, 0.18, 0, 0.16, 0, PLASTER), B(1.58, 0.36, 0.18, 0, h - 0.52, 0, PLASTER), B(0.34, 0.7, 0.18, -0.62, 0.78, 0, PLASTER), B(0.34, 0.7, 0.18, 0.62, 0.78, 0, PLASTER));
    P.push(B(0.9, 0.7, 0.06, 0, 0.78, 0, GLASS), B(0.08, 0.7, 0.1, 0, 0.78, 0, TIMBER), B(0.9, 0.06, 0.1, 0, 1.1, 0, TIMBER), B(1.02, 0.08, 0.36, 0, 0.72, 0, TIMBER_D));
    for (const s of [-1, 1]) for (const f of [-1, 1]) P.push(B(0.3, 0.72, 0.05, s * 0.66, 0.77, f * 0.14, SHUTTER));
    return P;
  },
  stone_wall() {
    const P = [B(2.0, STOREY, 0.28, 0, 0, 0, STONE)];
    for (let row = 0; row < 5; row++) for (let i = 0; i < 3; i++) { const w = 0.62, x = -0.66 + i * 0.66 + (row % 2 ? 0.16 : -0.16); if (Math.abs(x) > 0.75) continue; P.push(B(w, 0.34, 0.32, x, 0.04 + row * 0.39, 0, (row + i) % 3 === 0 ? STONE_D : (row + i) % 3 === 1 ? STONE_L : STONE)); }
    P.push(B(2.02, 0.12, 0.34, 0, STOREY - 0.12, 0, STONE_D));
    return P;
  },
  timber_doorway() {
    const P = [], h = STOREY; frame(P, h, false);
    P.push(B(0.4, 0.16, 0.26, -0.8, 0, 0, TIMBER_D), B(0.4, 0.16, 0.26, 0.8, 0, 0, TIMBER_D));
    for (const s of [-1, 1]) P.push(B(0.14, 1.62, 0.3, s * 0.55, 0, 0, TIMBER), B(0.17, h - 0.32, 0.18, s * 0.705, 0.16, 0, PLASTER));
    P.push(B(1.26, 0.16, 0.3, 0, 1.62, 0, TIMBER_D), B(1.1, h - 1.94, 0.18, 0, 1.78, 0, PLASTER), B(0.96, 0.04, 0.34, 0, 0, 0, STONE));
    return P;
  },
  timber_post() { return [B(0.34, 0.14, 0.34, 0, 0, 0, STONE), B(0.24, STOREY, 0.24, 0, 0, 0, TIMBER), B(0.34, 0.12, 0.34, 0, STOREY - 0.12, 0, TIMBER_D)]; },
  timber_floor() { const P = [B(2.0, FLOOR_T, 2.0, 0, 0, 0, PLANK)]; for (const x of [-0.5, 0, 0.5]) P.push(B(0.03, 0.012, 1.98, x, FLOOR_T, 0, PLANK_D)); P.push(B(2.0, 0.16, 0.16, 0, -0.16, -0.92, TIMBER_D), B(2.0, 0.16, 0.16, 0, -0.16, 0.92, TIMBER_D)); return P; },
  stone_foundation() { const P = [B(2.0, FOUND_T, 2.0, 0, 0, 0, STONE)]; for (const s of [-1, 1]) P.push(B(2.02, 0.1, 0.24, 0, 0.08, s * 0.9, STONE_D), B(0.24, 0.1, 2.02, s * 0.9, 0.08, 0, STONE_D)); P.push(B(1.5, 0.02, 1.5, 0, FOUND_T, 0, STONE_L)); return P; },
  thatch_roof() {
    // a thick thatch slab with darker courses, an eave board and a light ridge roll on the high edge
    const th = Math.atan2(ROOF_RISE, M), c = Math.cos(th), L = Math.hypot(M, ROOF_RISE) + 0.36, zc = -0.18 * c, slope = z => ROOF_RISE / 2 + ROOF_RISE / M * z;
    const P = [B(2.04, 0.24, L, 0, slope(zc) - 0.12, zc, THATCH, -th)];
    for (const f of [0.18, 0.44, 0.7]) { const z = -1 + f * 2; P.push(B(2.06, 0.06, 0.2, 0, slope(z) + 0.09, z, f === 0.44 ? THATCH_D : 0xb8943f, -th)); }
    P.push(B(2.1, 0.14, 0.14, 0, -0.22, -1.16, TIMBER_D), B(2.08, 0.16, 0.2, 0, ROOF_RISE - 0.02, 0.96, THATCH_L));
    return P;
  },
  thatch_ridge() {
    // the peak module between two slopes: edges at ROOF_RISE, peak half a slope higher
    const R0 = ROOF_RISE, R1 = ROOF_RISE * 1.25, th = Math.atan2(R1 - R0, 1), L = Math.hypot(1, R1 - R0) + 0.06, P = [];
    P.push(B(2.04, 0.24, L, 0, (R0 + R1) / 2 - 0.12, -0.5, THATCH, -th), B(2.04, 0.24, L, 0, (R0 + R1) / 2 - 0.12, 0.5, THATCH, th), B(2.08, 0.18, 0.3, 0, R1 - 0.02, 0, THATCH_L), B(2.06, 0.06, 0.18, 0, (R0 + R1) / 2 + 0.08, -0.55, THATCH_D, -th), B(2.06, 0.06, 0.18, 0, (R0 + R1) / 2 + 0.08, 0.55, THATCH_D, th));
    return P;
  },
};
// gables are shaped to the roof they close: 'up' rises along local +x (0 -> ROOF_RISE),
// 'peak' fills a ridge module's end (1 -> 1.5 -> 1)
function gableParts(v) {
  const P = [], n = 5, w = M / n;
  const R0 = ROOF_RISE, R1 = ROOF_RISE * 1.25;
  for (let i = 0; i < n; i++) { const xc = -1 + (i + 0.5) * w, h = v === 'peak' ? R0 + (R1 - R0) * (1 - Math.abs(xc)) : (xc + 1) / 2 * ROOF_RISE; P.push(B(w, h, 0.2, xc, 0, 0, i % 2 ? PLASTER : PLASTER_S)); }
  if (v === 'peak') { const th = Math.atan2(R1 - R0, 1), L = Math.hypot(1, R1 - R0) + 0.1; P.push(B(L, 0.1, 0.26, -0.5, (R0 + R1) / 2 - 0.05, 0, TIMBER_D, 0, 0, th), B(L, 0.1, 0.26, 0.5, (R0 + R1) / 2 - 0.05, 0, TIMBER_D, 0, 0, -th), B(2.0, 0.12, 0.26, 0, 0, 0, TIMBER_D)); }
  else { const th = Math.atan2(ROOF_RISE, M), L = Math.hypot(M, ROOF_RISE) + 0.1; P.push(B(L, 0.1, 0.26, 0, ROOF_RISE / 2 - 0.02, 0, TIMBER_D, 0, 0, th), B(2.0, 0.12, 0.26, 0, 0, 0, TIMBER_D), B(0.14, ROOF_RISE, 0.26, 0.93, 0, 0, TIMBER)); }
  return P;
}
// stairs climb local +z from z = -1 (low end) to +1, rising `rise`; rails on both sides and a
// guard across the low end at the top storey (for people standing upstairs)
function stairParts(rise) {
  const P = [], n = 7, run = M / n;
  for (let i = 0; i < n; i++) P.push(B(1.64, (i + 1) * rise / n, run, 0, 0, -1 + (i + 0.5) * run, i % 2 ? PLANK : PLANK_D));
  const th = Math.atan2(rise, M), L = Math.hypot(M, rise);
  for (const s of [-1, 1]) {
    P.push(B(0.14, 0.32, L, s * 0.89, rise / 2 - 0.16, 0, TIMBER_D, -th));
    P.push(B(0.08, 0.08, L, s * 0.89, rise / 2 + 0.86, 0, TIMBER, -th));
    P.push(B(0.1, 0.96, 0.1, s * 0.89, 0, -0.94, TIMBER), B(0.1, 0.96, 0.1, s * 0.89, rise, 0.94, TIMBER), B(0.1, 0.96, 0.1, s * 0.89, rise, -0.94, TIMBER));
  }
  P.push(B(1.8, 0.08, 0.08, 0, rise + 0.9, -0.94, TIMBER), B(1.8, 0.06, 0.06, 0, rise + 0.45, -0.94, TIMBER_D));
  return P;
}
export function doorLeafGeo() { return cached('doorleaf', () => [B(0.94, 1.58, 0.08, 0.47, 0.02, 0, DOOR), B(0.04, 1.5, 0.1, 0.25, 0.06, 0, TIMBER_D), B(0.04, 1.5, 0.1, 0.7, 0.06, 0, TIMBER_D), B(0.9, 0.08, 0.1, 0.47, 0.4, 0, TIMBER_D), B(0.9, 0.08, 0.1, 0.47, 1.3, 0, TIMBER_D), B(0.06, 0.06, 0.14, 0.82, 0.8, 0, 0xd8b050)]); }
export function kitGeo(type, variant) {
  if (type === 'timber_gable') return cached('gable:' + (variant || 'up'), () => gableParts(variant || 'up'));
  if (type === 'timber_stairs') { const rise = Math.round((variant ?? (STOREY + FLOOR_T)) * 100) / 100; return cached('stairs:' + rise, () => stairParts(rise)); }
  if (type === 'timber_door') return cached('timber_doorway', PARTS.timber_doorway);
  return cached(type, PARTS[type]);
}

// ------------------------------------------------------------------ collision boxes
// Local boxes [x0, x1, z0, z1] (before rotation) and their vertical span above the piece base.
// Walls block walkers whose height overlaps the storey; a door leaf only while closed.
export function kitBoxes(type, rise = STOREY + FLOOR_T) {
  const K = KIT[type]; if (!K) return [];
  if (K.solid === 'full') return [{ b: [-1, 1, -0.14, 0.14], lo: 0, hi: STOREY }];
  if (K.solid === 'jambs') { const out = [{ b: [-1, -0.48, -0.14, 0.14], lo: 0, hi: STOREY }, { b: [0.48, 1, -0.14, 0.14], lo: 0, hi: STOREY }, { b: [-0.48, 0.48, -0.14, 0.14], lo: 1.62, hi: STOREY }]; if (K.door) out.push({ b: [-0.48, 0.48, -0.06, 0.06], lo: 0, hi: 1.62, leaf: true }); return out; }
  if (K.solid === 'post') return [{ b: [-0.14, 0.14, -0.14, 0.14], lo: 0, hi: STOREY }];
  if (type === 'timber_stairs') return [ // side rails the whole way up, the underside at the top, a guard at the top storey
    { b: [-1, -0.82, -1, 1], lo: 0, hi: rise + 1 }, { b: [0.82, 1, -1, 1], lo: 0, hi: rise + 1 },
    { b: [-0.82, 0.82, 0.86, 1.02], lo: -0.1, hi: rise - 0.9 }, { b: [-0.82, 0.82, -1.02, -0.88], lo: rise + 0.95, hi: rise + 2 }, // only walkers standing at the top storey
  ];
  return [];
}
// rotate a local point/box by quarter turns (the mesh's rotation.y = r * PI/2 convention)
export function rot(x, z, r) { switch (((r % 4) + 4) % 4) { case 1: return [z, -x]; case 2: return [-x, -z]; case 3: return [-z, x]; default: return [x, z]; } }
// edges use rotation.y = -PI/2 for the 'v' axis so local +x runs along world +z
export function edgeYaw(r) { return (r % 2 ? -Math.PI / 2 : 0) + (r >= 2 ? Math.PI : 0); }
export function edgeRot(x, z, r) { const a = (r % 2 ? 3 : 0) + (r >= 2 ? 2 : 0); return rot(x, z, a); }
