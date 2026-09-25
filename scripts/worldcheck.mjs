// Dev tool: flood-fill the overworld from Thimblewick with the player's walking rules (solid
// tiles, the height step limit) and report every spawn, Bellstone, warp and NPC it can't reach.
import { buildOverworld } from '../src/world/overworld.js';
import { T, isSolid } from '../src/world/tiles.js';
const a = buildOverworld(), W = a.w, H = a.h;
const STEP = 0.55;
const gh = i => { const t = a.tiles[i], v = a.hv[i]; return Number.isNaN(v) ? 0 : v; };
const walk = i => { const t = a.tiles[i]; return !isSolid(t) && t !== T.PIT; };
const seen = new Uint8Array(W * H);
const start = Math.floor(a.spawns.village.z) * W + Math.floor(a.spawns.village.x);
const q = [start]; seen[start] = 1;
while (q.length) {
  const i = q.pop(), x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx; if (seen[j] || !walk(j)) continue;
    if (Math.abs(gh(j) - gh(i)) > STEP) continue;
    seen[j] = 1; q.push(j);
  }
}
const ok = (x, z) => { const i = Math.floor(z) * W + Math.floor(x); if (seen[i]) return true; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (seen[i + dy * W + dx]) return true; return false; };
let bad = 0;
for (const [k, s] of Object.entries(a.spawns)) if (!ok(s.x, s.z)) { bad++; console.log('spawn unreachable', k, s); }
for (const d of a.defs) if (['bellstone', 'warp', 'npc', 'ferry', 'nightdoor', 'vista', 'lootchest', 'chest', 'tangle'].includes(d.type) && !ok(d.x, d.z)) { bad++; console.log('unreachable', d.type, d.id || d.spawn || d.to || d.name || '', d.x, d.z); }
const n = seen.reduce((s, v) => s + v, 0);
console.log(`reachable tiles: ${n} (${(n / (W * H) * 100).toFixed(1)}% of the map; old map was 16500 tiles total) · problems: ${bad}`);
