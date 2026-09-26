// Survival caves: a chain of authored room shapes stitched together from the world seed and the
// cave's id, so each cave is always the same cave. Contents: creatures, glow crystals and ore,
// and a reward cache in the deepest room. Rules, saved per world: felled nodes stay gone, the
// reward is opened once, and a cave whose creatures were all defeated stays cleared.
import { T } from '../world/tiles.js';
import { Grid } from '../world/grid.js';
import { hash2 } from '../engine/util.js';

const ROOMS = [ // '#' rock, '.' floor, 'o' ore, 'c' crystal, 'e' creature, 'P' pillar
  ['###########', '#....o....#', '#.e.....e.#', '#...P.P...#', '#.........#', '#..c...c..#', '###########'],
  ['#########', '#...c...#', '#.e...e.#', '#.......#', '#..PPP..#', '#o.....o#', '#########'],
  ['#############', '#....e......#', '#.c.......c.#', '#...##.##...#', '#.e.......e.#', '#....o.o....#', '#############'],
  ['###########', '#..c...c..#', '#.........#', '#.e.P.P.e.#', '#.........#', '#o...e...o#', '###########'],
];
const rnd = (seed, i) => hash2(i, i * 7 + 3, seed);

export function caveSeed(worldSeed, caveId) { let h = worldSeed | 0; for (const c of caveId) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function buildCave(worldSeed, caveId, level = 2) {
  const seed = caveSeed(worldSeed, caveId), W = 64, H = 44, g = new Grid(W, H, T.ROCK);
  const nodes = [], packs = [], n = 3 + Math.floor(rnd(seed, 1) * 3); // 3-5 rooms
  const rooms = [];
  // rooms march north from the entrance, stepping left or right; corridors join them
  let x = 26, y = H - 12;
  for (let i = 0; i < n; i++) {
    const R = ROOMS[Math.floor(rnd(seed, 10 + i) * ROOMS.length)], w = R[0].length, h = R.length;
    const x0 = Math.max(2, Math.min(W - w - 2, Math.round(x - w / 2))), y0 = Math.max(2, y - h);
    for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) {
      const c = R[j][k], tx = x0 + k, ty = y0 + j;
      if (c === '#') continue;
      g.set(tx, ty, c === 'P' ? T.PILLAR : T.CAVE);
      if (c === 'o' || c === 'c') nodes.push({ id: `c:${caveId}:${tx},${ty}`, type: c === 'o' ? 'ore' : 'crystal', x: tx + 0.5, z: ty + 0.5, v: 0 });
      if (c === 'e') packs.push({ id: `${caveId}:m${packs.length}`, kind: ['blot', 'wisp', 'beetle', 'imp', 'wraith'][Math.floor(rnd(seed, 40 + packs.length) * (level > 3 ? 5 : 3))], x: tx + 0.5, z: ty + 0.5 });
    }
    rooms.push({ x0, y0, x1: x0 + w, y1: y0 + h, cx: x0 + Math.floor(w / 2), cy: y0 + Math.floor(h / 2) });
    x = Math.max(12, Math.min(W - 12, x + (rnd(seed, 20 + i) < 0.5 ? -1 : 1) * (6 + Math.floor(rnd(seed, 30 + i) * 8))));
    y = y0 - 3;
    if (y < 10) break;
  }
  // corridors (two wide) between consecutive rooms, and a mossy floor mottle
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i]; let cx = a.cx, cy = a.cy;
    while (cy !== b.cy) { for (const d of [0, 1]) if (g.get(cx + d, cy) === T.ROCK) g.set(cx + d, cy, T.CAVE); cy += cy > b.cy ? -1 : 1; }
    while (cx !== b.cx) { for (const d of [0, 1]) if (g.get(cx, cy + d) === T.ROCK) g.set(cx, cy + d, T.CAVE); cx += cx > b.cx ? -1 : 1; }
  }
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (g.get(tx, ty) === T.CAVE && hash2(tx, ty, seed) < 0.12) g.set(tx, ty, T.MOSS);
  // the entrance room: a passage down to the exit
  const first = rooms[0], ex = first.cx, ey = first.y1;
  for (let ty = ey - 1; ty < Math.min(H - 2, ey + 4); ty++) { g.set(ex, ty, T.CAVE); g.set(ex + 1, ty, T.CAVE); }
  const last = rooms[rooms.length - 1];
  const exit = { x: ex + 1, z: Math.min(H - 2, ey + 3) + 0.3 };
  const hv = new Float32Array(W * H).fill(NaN);
  for (let i = 0; i < W * H; i++) if (g.t[i] === T.ROCK) hv[i] = 2.2; else if (g.t[i] === T.PILLAR) hv[i] = 1.8;
  return {
    id: 'cave', caveId, name: 'Wild cave', w: W, h: H, tiles: g.t, hv, defs: [], dungeon: false, underground: true, dark: true, survival: true,
    spawns: { entrance: { x: exit.x, z: exit.z - 1.6 } }, exit, reward: { x: last.cx + 0.5, z: last.cy + 0.5 },
    nodes, packs, music: 'cave', sky: 0x0c1418, fog: 0x1a2a30, sun: 0x9ad8e8, amb: 0x4a6a78, ground: 0x2a3036, level,
    regions: [{ id: 'cave', name: 'Wild cave', x0: 0, y0: 0, x1: W, y1: H, level }],
    tileInfo: { [T.ROCK]: { h: 2.2, top: [0x2a2c36, 0x30323c], side: 0x3a3c4a, side2: 0x2c2e3a }, [T.CAVE]: { h: 0, top: [0x4a4a56, 0x44444f, 0x50505c] }, [T.MOSS]: { h: 0, top: [0x3a7a6a, 0x357062] } },
  };
}
