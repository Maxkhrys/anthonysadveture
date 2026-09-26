// Generated houses: authored templates made only of the modular kit (kit.js), placed by the
// world generator (gen.js) and spawned like player pieces. Every piece has a stable id
// `<house id>:<index>`; templates are append-only per generator version so ids never shift.
//
// Template entries, in module (i, j) / tile (tx, tz) coordinates inside the footprint:
//   ['cell', type, i, j, lv, r]            floors, foundations, stairs, roofs
//   ['edge', type, i, j, side, lv, flip]   walls, windows, doors, gables; side n / s / w / e
//   ['post', type, vi, vj, lv]             posts on module corners
//   ['tile', type, tx, tz, lv, r]          furniture (chest, workbench, torch)
//   ['cache', tx, tz, lv]                  a one-time loot cache (the survival LootCache)
import { M } from './kit.js';

const walls = (lv, list) => list.map(([type, i, j, side, flip]) => ['edge', type, i, j, side, lv, flip ? 1 : 0]);
const cells = (type, lv, list, r = 0) => list.map(([i, j, rr]) => ['cell', type, i, j, lv, rr ?? r]);

export const TEMPLATES = {
  // a one-room woodland cabin: plank floor, a door, windows, a gable roof
  cabin: {
    name: 'Woodland cabin', w: 2, d: 2,
    pieces: [
      ...cells('timber_floor', 0, [[0, 0], [1, 0], [0, 1], [1, 1]]),
      ...walls(0, [['timber_window', 0, 0, 'n'], ['timber_wall', 1, 0, 'n'], ['timber_door', 0, 1, 's', 1], ['timber_window', 1, 1, 's'], ['timber_wall', 0, 0, 'w'], ['timber_window', 0, 1, 'w'], ['timber_window', 1, 0, 'e'], ['timber_wall', 1, 1, 'e']]),
      ...cells('thatch_roof', 0, [[0, 0, 1], [0, 1, 1], [1, 0, 3], [1, 1, 3]]),
      ...walls(0, [['timber_gable', 0, 0, 'n'], ['timber_gable', 1, 0, 'n'], ['timber_gable', 0, 1, 's'], ['timber_gable', 1, 1, 's']]),
      ['tile', 'chest', 3, 0, 0, 2], ['tile', 'torch', 0, 0, 0, 0], ['cache', 3, 3, 0],
    ],
  },
  // a two-storey cottage: stone ground floor, stairs, a timber upper floor under the roof
  cottage: {
    name: 'Two-storey cottage', w: 3, d: 2,
    pieces: [
      ...cells('stone_foundation', 0, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]),
      ...walls(0, [['stone_wall', 0, 0, 'n'], ['timber_window', 1, 0, 'n'], ['stone_wall', 2, 0, 'n'], ['timber_door', 0, 1, 's', 1], ['stone_wall', 1, 1, 's'], ['timber_window', 2, 1, 's'], ['stone_wall', 0, 0, 'w'], ['timber_window', 0, 1, 'w'], ['timber_window', 2, 0, 'e'], ['stone_wall', 2, 1, 'e']]),
      ['cell', 'timber_stairs', 1, 1, 0, 1],
      ...cells('timber_floor', 1, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]),
      ...walls(1, [['timber_window', 0, 0, 'n'], ['timber_wall', 1, 0, 'n'], ['timber_window', 2, 0, 'n'], ['timber_window', 0, 1, 's'], ['timber_wall', 1, 1, 's'], ['timber_window', 2, 1, 's'], ['timber_wall', 0, 0, 'w'], ['timber_window', 0, 1, 'w'], ['timber_wall', 2, 0, 'e'], ['timber_window', 2, 1, 'e']]),
      ...cells('thatch_roof', 1, [[0, 0, 1], [0, 1, 1], [2, 0, 3], [2, 1, 3]]), ...cells('thatch_ridge', 1, [[1, 0, 1], [1, 1, 1]]),
      ...walls(1, [['timber_gable', 0, 0, 'n'], ['timber_gable', 1, 0, 'n'], ['timber_gable', 2, 0, 'n'], ['timber_gable', 0, 1, 's'], ['timber_gable', 1, 1, 's'], ['timber_gable', 2, 1, 's']]),
      ['tile', 'workbench', 4, 0, 0, 2], ['tile', 'torch', 5, 3, 0, 0], ['tile', 'chest', 0, 0, 1, 0], ['tile', 'torch', 2, 0, 1, 0], ['cache', 5, 3, 1],
    ],
  },
  // a partly ruined stone house: gaps in the walls, a lone upper room reached by stairs, half a roof
  ruin: {
    name: 'Ruined house', w: 3, d: 2,
    pieces: [
      ...cells('stone_foundation', 0, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]),
      ...walls(0, [['stone_wall', 0, 0, 'n'], ['stone_wall', 2, 0, 'n'], ['timber_doorway', 0, 1, 's'], ['stone_wall', 1, 1, 's'], ['stone_wall', 0, 0, 'w'], ['stone_wall', 2, 0, 'e'], ['stone_wall', 2, 1, 'e']]),
      ['cell', 'timber_stairs', 1, 0, 0, 1],
      ['cell', 'timber_floor', 2, 0, 1, 0],
      ...walls(1, [['stone_wall', 2, 0, 'n'], ['stone_wall', 2, 0, 'e']]),
      ['cell', 'thatch_roof', 2, 0, 1, 1],
      ['edge', 'timber_gable', 2, 0, 'n', 1, 0],
      ['cache', 5, 1, 1],
    ],
  },
};
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

// World records for one generated house: { id, t, x0, z0, k } with k 0 or 2 (a half turn).
export function instantiate(h) {
  const T = TEMPLATES[h.t], W = T.w * M, D = T.d * M, flip = h.k === 2, pieces = [], caches = [];
  const at = (x, z) => flip ? [h.x0 + W - x, h.z0 + D - z] : [h.x0 + x, h.z0 + z];
  const turn = r => flip ? (r + 2) % 4 : r;
  T.pieces.forEach((p, i) => {
    const id = h.id + ':' + i;
    if (p[0] === 'cell') { const [x, z] = at(p[2] * M + M / 2, p[3] * M + M / 2); pieces.push({ id, type: p[1], x, z, lv: p[4], r: turn(p[5] | 0) }); }
    else if (p[0] === 'edge') {
      const [, type, i2, j, side, lv, fl] = p, lx = side === 'w' ? i2 * M : side === 'e' ? i2 * M + M : i2 * M + M / 2, lz = side === 'n' ? j * M : side === 's' ? j * M + M : j * M + M / 2;
      const [x, z] = at(lx, lz), axis = side === 'n' || side === 's' ? 0 : 1; pieces.push({ id, type, x, z, lv, r: axis + ((fl ? 2 : 0) ^ (flip ? 2 : 0)) });
    }
    else if (p[0] === 'post') { const [x, z] = at(p[2] * M, p[3] * M); pieces.push({ id, type: p[1], x, z, lv: p[4], r: 0 }); }
    else if (p[0] === 'tile') { const [x, z] = at(p[2] + 0.5, p[3] + 0.5); pieces.push({ id, type: p[1], x, z, lv: p[4], r: turn(p[5] | 0) }); }
    else if (p[0] === 'cache') { const [x, z] = at(p[1] + 0.5, p[2] + 0.5); caches.push({ id, x, z, lv: p[3] }); }
  });
  return { pieces, caches, rect: [h.x0, h.z0, h.x0 + W, h.z0 + D] };
}
// the tiles in front of the house's ground-floor door(s), kept as an open path
export function doorFront(h) {
  const T = TEMPLATES[h.t], out = [];
  for (const p of T.pieces) if (p[0] === 'edge' && p[5] === 0 && (p[1] === 'timber_door' || p[1] === 'timber_doorway')) {
    const [, , i, j, side] = p, dir = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side];
    const mx = side === 'w' ? i * M : side === 'e' ? i * M + M : i * M + M / 2, mz = side === 'n' ? j * M : side === 's' ? j * M + M : j * M + M / 2;
    for (let k = 0; k < 3; k++) for (const o of [-0.5, 0.5]) {
      let x = mx + dir[0] * (k + 0.5) + (dir[0] ? 0 : o), z = mz + dir[1] * (k + 0.5) + (dir[1] ? 0 : o);
      if (h.k === 2) { x = T.w * M - x; z = T.d * M - z; }
      out.push([h.x0 + Math.floor(x), h.z0 + Math.floor(z)]);
    }
  }
  return out;
}
