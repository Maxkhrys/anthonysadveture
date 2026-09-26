// Survival world generation. Pure functions of (seed, position, biome, GEN_VERSION): a chunk is
// generated on its own, in any order, and always comes out the same. Nothing here reads the
// save; the player's changes (felled trees, buildings) are layered on top by world.js.
//
//   terrain   noise fields: elevation (ponds), rockiness (stone patches, outcrops), canopy
//             (tree clusters vs open glades)
//   routes    one point of interest per coarse region cell; natural paths join neighbours
//   nodes     at most one node (tree, rock, ore, shrub) per 2x2 block, from the same fields
//   fixed     the start clearing, a guiding ruin to the north and a first cave to the east
import { T } from '../world/tiles.js';
import { hash2, fbm, vnoise } from '../engine/util.js';
import { BIOMES, WORLD } from './biome.js';

export const CH = 24; // same as the renderer's chunk (stream.js)
const sub = (seed, k) => ((seed | 0) * 7919 + k * 104729) | 0;
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ points of interest
export function regionPoi(seed, rx, rz, B = BIOMES.forest) {
  const W = WORLD, R = B.region;
  if (rx < 0 || rz < 0 || rx * R >= W.w || rz * R >= W.h) return null;
  const srx = Math.floor(W.start.x / R), srz = Math.floor(W.start.z / R);
  if (rx === srx && rz === srz) return { id: 'poi:start', type: 'shelter', x: W.start.x + 0.5, z: W.start.z + 0.5, rx, rz };
  const m = W.border + 8;
  const x = clampv(Math.floor(rx * R + 8 + hash2(rx, rz, sub(seed, 1)) * (R - 16)), m, W.w - m), z = clampv(Math.floor(rz * R + 8 + hash2(rx, rz, sub(seed, 2)) * (R - 16)), m, W.h - m);
  let type;
  if (rx === srx + 1 && rz === srz) type = 'cave';          // the first cave, reliably east of camp
  else if (rx === srx && rz === srz - 1) type = 'ruin';     // a guiding ruin to the north
  else { const h = hash2(rx, rz, sub(seed, 3)); type = h < B.caveChance ? 'cave' : h < B.caveChance + B.ruinChance ? 'ruin' : h < B.caveChance + B.ruinChance + B.stonesChance ? 'stones' : 'glade'; }
  return { id: `poi:${rx},${rz}`, type, x: x + 0.5, z: z + 0.5, rx, rz };
}
// natural routes between neighbouring points of interest (some links are skipped; start links never)
function routeSegments(seed, rx0, rz0, rx1, rz1, B) {
  const out = [], W = WORLD, R = B.region, srx = Math.floor(W.start.x / R), srz = Math.floor(W.start.z / R);
  for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
    const a = regionPoi(seed, rx, rz, B); if (!a) continue;
    for (const [dx, dz, k] of [[1, 0, 5], [0, 1, 6]]) {
      const b = regionPoi(seed, rx + dx, rz + dz, B); if (!b) continue;
      const touchesStart = (rx === srx && rz === srz) || (rx + dx === srx && rz + dz === srz);
      if (!touchesStart && hash2(rx, rz, sub(seed, k)) < 0.35) continue;
      out.push([a.x, a.z, b.x, b.z]);
    }
  }
  return out;
}
const segDist = (px, pz, [ax, az, bx, bz]) => { const vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz, t = l ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l)) : 0; return Math.hypot(px - ax - vx * t, pz - az - vz * t); };

// ------------------------------------------------------------------ one tile
export function fields(seed, x, z) {
  return { e: fbm(x * 0.018, z * 0.018, sub(seed, 10)), rock: fbm(x * 0.06, z * 0.06, sub(seed, 20)), canopy: fbm(x * 0.045, z * 0.045, sub(seed, 30)) };
}

// ------------------------------------------------------------------ one chunk
// Returns the chunk's tiles plus everything placed in it: resource nodes, points of interest,
// structure defs (cave mouths, ruins, stones) and creature packs. Ids are positional and stable.
export function generateChunk(seed, cx, cz, B = BIOMES.forest) {
  const W = WORLD, R = B.region, x0 = cx * CH, z0 = cz * CH;
  const tiles = new Uint8Array(CH * CH), nodes = [], defs = [], pois = [], packs = [];
  // nearby points of interest and routes (the neighbourhood this chunk can see)
  const rx0 = Math.floor(x0 / R) - 1, rz0 = Math.floor(z0 / R) - 1, rx1 = Math.floor((x0 + CH) / R) + 1, rz1 = Math.floor((z0 + CH) / R) + 1;
  const near = []; for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) { const p = regionPoi(seed, rx, rz, B); if (p) near.push(p); }
  const segs = routeSegments(seed, rx0 - 1, rz0 - 1, rx1, rz1, B);
  const clearR = p => p.type === 'shelter' ? W.startClearing : B.clearing;
  const tile = (x, z) => {
    if (x < W.border || z < W.border || x >= W.w - W.border || z >= W.h - W.border) return T.TREE; // the old wood closes the world
    const px = x + 0.5, pz = z + 0.5;
    for (const p of near) { const d = Math.hypot(px - p.x, pz - p.z); if (d < clearR(p)) return p.type === 'ruin' && d < 3.6 ? T.STONE : p.type === 'shelter' && d < 2.2 ? T.PATH : T.GRASS; }
    const F = fields(seed, x, z), wob = (vnoise(x * 0.15, z * 0.15, sub(seed, 40)) - 0.5) * 1.1;
    let onPath = false; for (const s of segs) if (segDist(px, pz, s) + wob < 1.05) { onPath = true; break; }
    if (F.e < B.waterLevel) return onPath ? T.SHALLOW : F.e < B.waterLevel - 0.05 ? T.DEEP : T.WATER;
    if (F.e < B.waterLevel + B.shallowBand) return T.SHALLOW;
    if (onPath) return T.PATH;
    if (F.rock > B.outcrop && hash2(x, z, sub(seed, 21)) > 0.25) return T.ROCK;
    if (F.rock > B.rockPatch) return T.STONE;
    if (F.canopy > B.treeCanopy) return hash2(x, z, sub(seed, 31)) < 0.3 ? T.MOSS : T.FOREST;
    return hash2(x, z, sub(seed, 32)) < B.flowers ? T.FLOWERS : T.GRASS;
  };
  for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) tiles[j * CH + i] = tile(x0 + i, z0 + j);
  const at = (x, z) => tiles[(z - z0) * CH + (x - x0)];
  const open = t => t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.MOSS || t === T.STONE;
  // nodes: one candidate per 2x2 block
  for (let bz = z0; bz < z0 + CH; bz += 2) for (let bx = x0; bx < x0 + CH; bx += 2) {
    const h = hash2(bx, bz, sub(seed, 50)), x = bx + (hash2(bx, bz, sub(seed, 51)) < 0.5 ? 0 : 1), z = bz + (hash2(bx, bz, sub(seed, 52)) < 0.5 ? 0 : 1);
    const t = at(x, z); if (!open(t)) continue;
    if (near.some(p => Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z) < clearR(p) + 0.5)) continue;
    if (x > x0 && at(x - 1, z) === T.PATH || x < x0 + CH - 1 && at(x + 1, z) === T.PATH) continue; // keep routes walkable
    const F = fields(seed, x, z);
    let type = null;
    if (F.rock > B.rockPatch) { if (h < B.rockDensity) type = hash2(x, z, sub(seed, 53)) < B.oreShare ? 'ore' : 'rock'; }
    else if (F.canopy > B.treeCanopy) { if (h < B.treeDensity * Math.min(1, (F.canopy - B.treeCanopy) / 0.08)) type = 'tree'; }
    else if (h < B.meadowTrees) type = 'tree'; else if (h < B.meadowTrees + B.shrubDensity) type = 'shrub'; else if (h < B.meadowTrees + B.shrubDensity + B.meadowRocks) type = 'rock';
    if (type) nodes.push({ id: `n:${x},${z}`, type, x: x + 0.5, z: z + 0.5, v: Math.floor(hash2(x, z, sub(seed, 54)) * 3) });
  }
  // points of interest whose centre is in this chunk
  for (const p of near) {
    if (p.x < x0 || p.x >= x0 + CH || p.z < z0 || p.z >= z0 + CH) continue;
    pois.push(p);
    if (p.type === 'cave') defs.push({ type: 'cavemouth', id: 'cave:' + p.rx + ',' + p.rz, x: p.x, z: p.z - 0.6 });
    if (p.type === 'ruin') { defs.push({ type: 'ruin7s', id: p.id, x: p.x, z: p.z }); defs.push({ type: 'svchest', id: 'chest:' + p.id, x: p.x, z: p.z + 1.2, loot: 'ruin' }); }
    if (p.type === 'stones') defs.push({ type: 'stones7s', id: p.id, x: p.x, z: p.z });
    if (p.type === 'shelter') defs.push({ type: 'shelter7s', id: p.id, x: p.x, z: p.z });
    // a creature pack guards most places away from camp
    if (p.type !== 'shelter' && Math.hypot(p.x - W.start.x, p.z - W.start.z) > 34 && hash2(p.rx, p.rz, sub(seed, 60)) < B.packChance) {
      const [kind, n] = B.packs[Math.floor(hash2(p.rx, p.rz, sub(seed, 61)) * B.packs.length)];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + hash2(p.rx, p.rz, sub(seed, 62)) * 3; packs.push({ id: p.id + ':m' + i, kind, x: p.x + Math.cos(a) * 3.2, z: p.z + Math.sin(a) * 3.2 }); }
    }
  }
  return { cx, cz, tiles, nodes, defs, pois, packs };
}

// A cheap fingerprint of a region of the world, for determinism tests.
export function fingerprint(seed, cx0, cz0, cx1, cz1) {
  let h = 2166136261;
  for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = generateChunk(seed, cx, cz);
    for (const t of c.tiles) h = Math.imul(h ^ t, 16777619);
    for (const n of c.nodes) for (const ch of n.id + n.type) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return (h >>> 0).toString(16);
}
