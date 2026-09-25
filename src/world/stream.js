// Pass 6: the world is built and dropped in square chunks around the camera, so a large
// overworld never lives in memory (or on the GPU) all at once. Each chunk holds its own
// terrain, water and instanced scenery with real bounds, so off-screen chunks are culled too.
import * as THREE from 'three';
import { buildTerrain, buildLiquids, buildScenery, areaLights } from './build.js';

export const CHUNK = 24;

export class WorldStreamer {
  constructor() { this.chunks = new Map(); this.group = null; this.area = null; this.stats = { built: 0, dropped: 0, ms: 0 }; }
  reset(area, group, time) {
    for (const k of [...this.chunks.keys()]) this.drop(k);
    this.area = area; this.group = group; this.time = time;
    this.cw = Math.ceil(area.w / CHUNK); this.ch = Math.ceil(area.h / CHUNK);
    areaLights(area);
  }
  build(cx, cz) {
    const key = cx + ',' + cz;
    if (this.chunks.has(key)) return;
    const t0 = performance.now();
    const rect = { x0: cx * CHUNK, y0: cz * CHUNK, x1: (cx + 1) * CHUNK, y1: (cz + 1) * CHUNK };
    const grp = new THREE.Group();
    const terrain = buildTerrain(this.area, rect); if (terrain) grp.add(terrain);
    grp.add(buildLiquids(this.area, this.time, rect));
    grp.add(buildScenery(this.area, rect));
    grp.userData.chunk = key;
    this.group.add(grp);
    this.chunks.set(key, grp);
    this.stats.built++; this.stats.ms += performance.now() - t0;
  }
  drop(key) {
    const grp = this.chunks.get(key);
    if (!grp) return;
    if (grp.parent) grp.parent.remove(grp);
    grp.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material && o.material.isShaderMaterial && !o.material.userData.shared) o.material.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    this.chunks.delete(key);
    this.stats.dropped++;
  }
  // chunks needed to cover a view of half-size (hw, hd) around (x, z), plus a margin
  range(x, z, hw, hd) {
    const m = 6; // tall landmarks just off the bottom edge still poke into view
    return {
      x0: Math.max(0, Math.floor((x - hw - m) / CHUNK)), x1: Math.min(this.cw - 1, Math.floor((x + hw + m) / CHUNK)),
      z0: Math.max(0, Math.floor((z - hd - m) / CHUNK)), z1: Math.min(this.ch - 1, Math.floor((z + hd + m + 8) / CHUNK)),
    };
  }
  // build what the view needs (up to `budget` chunks now, nearest first; Infinity at load),
  // and drop chunks that are well out of view
  update(x, z, hw, hd, budget = 2) {
    if (!this.area) return 0;
    const r = this.range(x, z, hw, hd);
    const need = [];
    for (let cz = r.z0; cz <= r.z1; cz++) for (let cx = r.x0; cx <= r.x1; cx++) if (!this.chunks.has(cx + ',' + cz)) need.push([cx, cz]);
    need.sort((a, b) => Math.hypot((a[0] + 0.5) * CHUNK - x, (a[1] + 0.5) * CHUNK - z) - Math.hypot((b[0] + 0.5) * CHUNK - x, (b[1] + 0.5) * CHUNK - z));
    let n = 0;
    for (const [cx, cz] of need) { if (n >= budget) break; this.build(cx, cz); n++; }
    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx < r.x0 - 1 || cx > r.x1 + 1 || cz < r.z0 - 1 || cz > r.z1 + 1) this.drop(key);
    }
    return need.length - n; // chunks still waiting
  }
  // rebuild the chunks touching a tile rectangle (after the map itself changes)
  refresh(x0, z0, x1, z1) {
    for (let cz = Math.floor(z0 / CHUNK); cz <= Math.floor(z1 / CHUNK); cz++) for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
      const key = cx + ',' + cz;
      if (this.chunks.has(key)) { this.drop(key); this.build(cx, cz); }
    }
  }
}
