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
import { BIOMES, WORLD, GEN_VERSION } from './biome.js';
import { TEMPLATES, doorFront } from './templates.js';
import { M } from './kit.js';

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

// ------------------------------------------------------------------ generated houses (v2)
// One candidate per region cell on dry, open, off-path ground, clear of every point of
// interest and the start camp. Pure and cached: any chunk can ask in any order.
const HOUSES = new Map();
export function regionHouse(seed, rx, rz, B = BIOMES.forest, ver = GEN_VERSION) {
  if (ver < 2) return null;
  const key = seed + ':' + rx + ':' + rz + ':' + ver; if (HOUSES.has(key)) return HOUSES.get(key);
  const W = WORLD, R = B.region, srx = Math.floor(W.start.x / R), srz = Math.floor(W.start.z / R);
  let out = null;
  if (rx >= 0 && rz >= 0 && rx * R < W.w && rz * R < W.h && !(rx === srx && rz === srz) && hash2(rx, rz, sub(seed, 70)) < B.houseChance) {
    const h = hash2(rx, rz, sub(seed, 71)); let acc = 0, t = B.houseMix[B.houseMix.length - 1][0];
    for (const [id, w] of B.houseMix) { acc += w; if (h < acc) { t = id; break; } }
    const T = TEMPLATES[t], w = T.w * M, d = T.d * M, mg = B.houseMargin;
    const pois = []; for (let z = rz - 1; z <= rz + 1; z++) for (let x = rx - 1; x <= rx + 1; x++) { const p = regionPoi(seed, x, z, B); if (p) pois.push(p); }
    const segs = routeSegments(seed, rx - 2, rz - 2, rx + 1, rz + 1, B);
    for (let k = 0; k < 6 && !out; k++) {
      const x0 = Math.floor((rx * R + 6 + hash2(rx, rz, sub(seed, 72 + k)) * (R - 12 - w)) / M) * M, z0 = Math.floor((rz * R + 6 + hash2(rx, rz, sub(seed, 80 + k)) * (R - 12 - d)) / M) * M;
      if (siteOk(seed, B, x0, z0, w, d, mg, pois, segs)) out = { id: `house:${rx},${rz}`, t, x0, z0, k: hash2(rx, rz, sub(seed, 90)) < 0.5 ? 0 : 2, rx, rz };
    }
  }
  if (out) { out.rect = [out.x0 - B.houseMargin, out.z0 - B.houseMargin, out.x0 + TEMPLATES[out.t].w * M + B.houseMargin, out.z0 + TEMPLATES[out.t].d * M + B.houseMargin]; out.front = doorFront(out); }
  HOUSES.set(key, out); return out;
}
function siteOk(seed, B, x0, z0, w, d, mg, pois, segs) {
  const W = WORLD, clearR = p => p.type === 'shelter' ? W.startClearing : B.clearing;
  if (x0 - mg < W.border + 2 || z0 - mg < W.border + 2 || x0 + w + mg >= W.w - W.border - 2 || z0 + d + mg >= W.h - W.border - 2) return false;
  const cx = Math.max(x0 - mg, Math.min(W.start.x, x0 + w + mg)), cz = Math.max(z0 - mg, Math.min(W.start.z, z0 + d + mg));
  if (Math.hypot(W.start.x - cx, W.start.z - cz) < W.startClearing + 12) return false;
  for (const p of pois) { const nx = Math.max(x0 - mg, Math.min(p.x, x0 + w + mg)), nz = Math.max(z0 - mg, Math.min(p.z, z0 + d + mg)); if (Math.hypot(p.x - nx, p.z - nz) < clearR(p) + 3) return false; }
  for (let z = z0 - mg; z < z0 + d + mg; z++) for (let x = x0 - mg; x < x0 + w + mg; x++) {
    const F = fields(seed, x, z); if (F.e < B.waterLevel + B.shallowBand + 0.02 || F.rock > B.rockPatch - 0.01) return false;
    for (const s of segs) if (segDist(x + 0.5, z + 0.5, s) < 2) return false;
  }
  return true;
}
const inRect = (x, z, r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];

// ------------------------------------------------------------------ one tile
export function fields(seed, x, z) {
  return { e: fbm(x * 0.018, z * 0.018, sub(seed, 10)), rock: fbm(x * 0.06, z * 0.06, sub(seed, 20)), canopy: fbm(x * 0.045, z * 0.045, sub(seed, 30)) };
}

// ------------------------------------------------------------------ one chunk
// Returns the chunk's tiles plus everything placed in it: resource nodes, points of interest,
// structure defs (cave mouths, ruins, stones) and creature packs. Ids are positional and stable.
export function generateChunk(seed, cx, cz, B = BIOMES.forest, ver = GEN_VERSION) {
  const W = WORLD, R = B.region, x0 = cx * CH, z0 = cz * CH;
  const tiles = new Uint8Array(CH * CH), nodes = [], defs = [], pois = [], packs = [];
  // nearby points of interest and routes (the neighbourhood this chunk can see)
  const rx0 = Math.floor(x0 / R) - 1, rz0 = Math.floor(z0 / R) - 1, rx1 = Math.floor((x0 + CH) / R) + 1, rz1 = Math.floor((z0 + CH) / R) + 1;
  const near = []; for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) { const p = regionPoi(seed, rx, rz, B); if (p) near.push(p); }
  const segs = routeSegments(seed, rx0 - 1, rz0 - 1, rx1, rz1, B);
  const clearR = p => p.type === 'shelter' ? W.startClearing : B.clearing;
  const houses = []; for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) { const h = regionHouse(seed, rx, rz, B, ver); if (h) houses.push(h); }
  const tile = (x, z) => {
    if (x < W.border || z < W.border || x >= W.w - W.border || z >= W.h - W.border) return T.TREE; // the old wood closes the world
    for (const h of houses) if (inRect(x, z, h.rect)) return h.front.some(f => f[0] === x && f[1] === z) ? T.PATH : T.GRASS; // a house plot
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
    if (houses.some(h => inRect(x, z, h.rect))) continue;
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
  // generated houses whose corner lies in this chunk (spawned with it; see templates.js)
  const own = houses.filter(h => h.x0 >= x0 && h.x0 < x0 + CH && h.z0 >= z0 && h.z0 < z0 + CH);
  return { cx, cz, tiles, nodes, defs, pois, packs, houses: own };
}

// A cheap fingerprint of a region of the world, for determinism tests.
export function fingerprint(seed, cx0, cz0, cx1, cz1, ver = GEN_VERSION) {
  let h = 2166136261;
  for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = generateChunk(seed, cx, cz, BIOMES.forest, ver);
    for (const t of c.tiles) h = Math.imul(h ^ t, 16777619);
    for (const n of c.nodes) for (const ch of n.id + n.type) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    for (const o of c.houses) for (const ch of o.id + o.t + o.x0 + ',' + o.z0 + o.k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return (h >>> 0).toString(16);
}
