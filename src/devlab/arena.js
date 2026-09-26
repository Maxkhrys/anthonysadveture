// The MOSSDEV test floor: one clean, well-lit room with nothing in it but what a test spawns.
// Built like every other area (a tile grid), so movement, projectiles, rooms and the camera
// behave exactly as in the adventure.
import { T } from '../world/tiles.js';
import { Grid } from '../world/grid.js';

export const LAB_W = 40, LAB_H = 30;
export function buildMossLab() {
  const W = LAB_W, H = LAB_H, g = new Grid(W, H, T.WALL);
  g.rect(2, 2, W - 3, H - 3, T.FLOOR);
  // a faint grid of stone every 4 tiles so distances and knockback are easy to read
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (x % 4 === 0 || y % 4 === 0) g.set(x, y, T.STONE);
  const tiles = g.t, hv = new Float32Array(W * H).fill(NaN);
  for (let i = 0; i < W * H; i++) if (tiles[i] === T.WALL) hv[i] = 1.2;
  const room = { id: 'lab', name: 'MOSSDEV Test Floor', x0: 2, z0: 2, x1: W - 2, z1: H - 2 };
  return {
    id: 'mosslab', name: 'MOSSDEV Test Floor', w: W, h: H, tiles, hv, defs: [], dungeon: true, devOnly: true, sandbox: true,
    spawns: { center: { x: 20, z: 21 }, spawn: { x: 20, z: 21 } },
    music: 'title', sky: 0x1c2420, fog: 0x2a3430, sun: 0xfff4dc, amb: 0xb8c8b0, ground: 0x3a4438, level: 0,
    tileInfo: {
      [T.FLOOR]: { h: 0, top: [0x6a7560, 0x66715c, 0x6e7964] },
      [T.STONE]: { h: 0, top: [0x7b8670, 0x77826c] },
      [T.WALL]: { h: 1.2, top: [0x3c4a3a], side: 0x2e3a2c, side2: 0x283426 },
    },
    regions: [{ id: 'lab', name: 'MOSSDEV Test Floor', x0: 0, z0: 0, x1: W, z1: H, y0: 0, y1: H }],
    rooms: [room],
  };
}
