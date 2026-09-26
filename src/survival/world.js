// The survival wilderness as a normal game area. Tiles start blank and each 24x24 chunk is
// generated the first time the renderer or the player needs it (ensureChunk), so only the
// explored part of the world is ever generated. Player changes are applied on top afterwards.
import { T } from '../world/tiles.js';
import { generateChunk, CH } from './gen.js';
import { BIOMES, WORLD } from './biome.js';

export function buildWilds(record, survival) {
  const B = BIOMES.forest, W = WORLD.w, H = WORLD.h;
  const tiles = new Uint8Array(W * H).fill(T.FOREST), hv = new Float32Array(W * H).fill(NaN);
  const chunks = new Map(); // key -> generated chunk data (nodes, defs, pois, packs)
  const area = {
    id: 'wilds', name: B.name, w: W, h: H, tiles, hv, defs: [], dungeon: false, outdoor: true, survival: true,
    spawns: { start: { x: WORLD.start.x + 0.5, z: WORLD.start.z + 3.5 } },
    music: 'forest', sky: B.sky, fog: B.fog, sun: B.sun, amb: B.amb, ground: B.ground, level: 0,
    regions: [{ id: 'wilds', name: B.name, x0: 0, y0: 0, x1: W, y1: H, level: 1 }],
    chunks,
    ensureChunk(cx, cz) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, z = cz + dz, key = x + ',' + z;
        if (x < 0 || z < 0 || x * CH >= W || z * CH >= H || chunks.has(key)) continue;
        const c = generateChunk(record.seed, x, z, B, record.genVersion || 1);
        for (let j = 0; j < CH; j++) { const row = (z * CH + j) * W + x * CH; if (z * CH + j >= H) break; for (let i = 0; i < CH && x * CH + i < W; i++) tiles[row + i] = c.tiles[j * CH + i]; }
        chunks.set(key, c);
        survival && survival.onChunkGenerated(c);
      }
    },
    // difficulty grows with distance from camp
    placeAt(x, z) { const d = Math.hypot(x - WORLD.start.x, z - WORLD.start.z); return { id: 'wilds', name: B.name, level: 1 + Math.floor(d / 38) }; },
  };
  if (record.home) area.spawns.home = { x: record.home.x, z: record.home.z };
  return area;
}
export { CH };
