// Turns an area's tile grid into renderable geometry: a single vertex-coloured terrain
// mesh with soft colour blending, animated water/lava surfaces, and instanced scenery.
import * as THREE from 'three';
import { T, TILE_INFO } from './tiles.js';
import { hash2, vnoise } from '../engine/util.js';
import { geo, MAT, MAT_GLOW, PROPS, decoModel, decoGlow, B } from '../models.js';
import { BIOME } from './layout.js';

export const windUniform = { value: 0 };
// local foliage reaction: the player (slot 0) and up to three recent impacts push grass aside
// (x, z, radius, strength)
export const bendUniform = { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) };
// Geometry south of the current dungeon room is cut down to a stump so walls never hide the player.
export const clipUniform = { value: 1e9 };
// Shared, animated by Game.atmosphere(): water light level, rain amount, sky tint.
export const waterU = { light: { value: 1 }, rain: { value: 0 }, sky: { value: new THREE.Color(0x9ad8ff) }, night: { value: 0 } };
// Window panes and lamp glass warm up at night.
export const windowMat = new THREE.MeshBasicMaterial({ color: 0x7ab8e8 });
export const lampMat = new THREE.MeshBasicMaterial({ color: 0x8a7a5a });

// The height the ground's surface sits at on a tile (walkable terraces and stairs included).
// Plain ground is 0; only Pass 6's raised land stores a height for walkable tiles.
const ROCKISH = new Set([T.CLIFF, T.ROCK, T.SANDSTONE, T.WALL, T.PILLAR]);
export function groundY(area, x, y) {
  if (x < 0 || y < 0 || x >= area.w || y >= area.h) return 0;
  const i = y * area.w + x, v = area.hv[i];
  if (Number.isNaN(v) || ROCKISH.has(area.tiles[i])) return 0;
  return v;
}
export function tileHeight(area, x, y) {
  if (x < 0 || y < 0 || x >= area.w || y >= area.h) return 3;
  const i = y * area.w + x;
  const hv = area.hv[i];
  if (!Number.isNaN(hv)) return hv;
  return TILE_INFO[area.tiles[i]]?.h ?? 0;
}

// how each biome shifts the ground's colour (hue, saturation, lightness; mul darkens)
const BIOME_TINT = {
  [BIOME.deepwood]: { h: 0.02, s: -0.05, l: -0.06, mul: 0.86 },
  [BIOME.glassmere]: { h: 0.035, s: 0.02, l: 0.03 },
  [BIOME.sunscald]: { h: -0.07, s: -0.22, l: 0.02 },
  [BIOME.cinderpeak]: { h: -0.04, s: -0.4, l: -0.1 },
  [BIOME.moonfen]: { h: 0.08, s: -0.2, l: -0.12, mul: 0.8 },
  [BIOME.highlands]: { h: 0.02, s: -0.28, l: 0.05 },
};
function tileColor(area, x, y, t, out) {
  const info = (area.tileInfo && area.tileInfo[t]) || TILE_INFO[t] || TILE_INFO[T.GRASS];
  const pal = info.top;
  out.set(pal[Math.floor(hash2(x, y, 1) * pal.length)]);
  const n = vnoise(x * 0.35, y * 0.35, 3) - 0.5;
  out.offsetHSL(n * 0.02, 0, n * 0.06);
  const hz = area.heart ? (y - area.heart.z) / area.heart.h : y / area.h;
  if (area.id === 'overworld' && (t === T.GRASS || t === T.FLOWERS || t === T.FOREST)) {
    // hue shift across the land: bluer north, golden south
    out.offsetHSL(-(Math.max(-0.2, Math.min(1.2, hz)) - 0.5) * 0.03, 0, 0);
  }
  if (area.biome) {
    const b = area.biome[y * area.w + x];
    const leafy = t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.MOSS || t === T.TREE || t === T.PROP;
    const tint = BIOME_TINT[b];
    if (tint && (leafy || tint.all)) out.offsetHSL(tint.h, tint.s, tint.l);
    if (tint && tint.mul && leafy) out.multiplyScalar(tint.mul);
  }
  if (t === T.CLIFF && area.id === 'overworld' && (y < 12 || (hz >= 0 && hz * (area.heart ? area.heart.h : area.h) < 12 && x >= (area.heart?.x ?? 0) && x < (area.heart ? area.heart.x + area.heart.w : area.w)))) {
    const yy = area.heart && y >= area.heart.z ? y - area.heart.z : y;
    out.lerp(new THREE.Color(0xe8eef8), Math.max(0, (8 - yy) / 8) * 0.8);
  }
  return out;
}

// Each tile's colour is worked out once per area and kept (the chunks around it reuse it).
function cachedColor(area, x, y, out) {
  const tc = area._tc || (area._tc = new Float32Array(area.w * area.h * 3).fill(-1));
  const i = (y * area.w + x) * 3;
  if (tc[i] < 0) { tileColor(area, x, y, area.tiles[y * area.w + x], out); tc[i] = out.r; tc[i + 1] = out.g; tc[i + 2] = out.b; }
  else out.setRGB(tc[i], tc[i + 1], tc[i + 2]);
  return out;
}
export function buildTerrain(area, rect) {
  const { w, h, tiles } = area;
  const X0 = rect ? rect.x0 : 0, Y0 = rect ? rect.y0 : 0, X1 = rect ? Math.min(w, rect.x1) : w, Y1 = rect ? Math.min(h, rect.y1) : h;
  const pos = [], nor = [], col = [];
  const c = new THREE.Color(), c2 = new THREE.Color();
  const cornerCol = (x, y, height) => {
    // average colours of up to 4 tiles sharing this corner at the same height
    let r = 0, g = 0, b = 0, n = 0;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      if (Math.abs(tileHeight(area, tx, ty) - height) > 0.2) continue;
      cachedColor(area, tx, ty, c2);
      r += c2.r; g += c2.g; b += c2.b; n++;
    }
    return n ? [r / n, g / n, b / n] : [c.r, c.g, c.b];
  };
  const V = (p, n, cl) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(cl[0], cl[1], cl[2]); };
  const quad = (a, b, cc, d, n, ca, cb, ccc, cd) => {
    // two triangles a b c, a c d
    V(a, n, ca); V(b, n, cb); V(cc, n, ccc); V(a, n, ca); V(cc, n, ccc); V(d, n, cd);
  };
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const t = tiles[y * w + x];
    const hh = tileHeight(area, x, y);
    cachedColor(area, x, y, c);
    const flat = t === T.WALL || t === T.PILLAR || t === T.PIT || t === T.ROCK || t === T.CLIFF || t === T.SANDSTONE;
    const cc = [c.r, c.g, c.b];
    const k = [cornerCol(x, y, hh), cornerCol(x + 1, y, hh), cornerCol(x + 1, y + 1, hh), cornerCol(x, y + 1, hh)];
    const cs = flat ? [cc, cc, cc, cc] : k;
    quad([x, hh, y], [x, hh, y + 1], [x + 1, hh, y + 1], [x + 1, hh, y], [0, 1, 0], cs[0], cs[3], cs[2], cs[1]);
    // sides
    const info = (area.tileInfo && area.tileInfo[t]) || TILE_INFO[t] || {};
    const sideA = new THREE.Color(info.side ?? 0x7a6a58), sideB = new THREE.Color(info.side2 ?? info.side ?? 0x6a5a48);
    const nbs = [[0, -1, [0, 0, -1]], [0, 1, [0, 0, 1]], [-1, 0, [-1, 0, 0]], [1, 0, [1, 0, 0]]];
    for (const [dx, dy, n] of nbs) {
      const nh = tileHeight(area, x + dx, y + dy);
      if (nh >= hh - 0.12) continue; // skip sub-pixel steps (they rasterize as dotted lines)
      // wall edge endpoints
      let p0, p1;
      if (dy === -1) { p0 = [x + 1, y]; p1 = [x, y]; }
      else if (dy === 1) { p0 = [x, y + 1]; p1 = [x + 1, y + 1]; }
      else if (dx === -1) { p0 = [x, y]; p1 = [x, y + 1]; }
      else { p0 = [x + 1, y + 1]; p1 = [x + 1, y]; }
      if (tiles[(y + dy) * w + x + dx] === T.PIT && x + dx >= 0 && x + dx < w) {
        const tp = [c.r * 0.55, c.g * 0.5, c.b * 0.55], bt = [0.02, 0.01, 0.03];
        quad([p0[0], hh, p0[1]], [p1[0], hh, p1[1]], [p1[0], nh, p1[1]], [p0[0], nh, p0[1]], n, tp, tp, bt, bt);
        continue;
      }
      const bottom = Math.max(nh, hh - 6);
      // strata bands
      const band = t === T.WALL ? 0.5 : t === T.PIT ? 99 : 0.45;
      let yb = bottom;
      let i = 0;
      while (yb < hh - 0.001) {
        const yt = Math.min(hh, yb + band);
        const src = (Math.floor(yb / band + hash2(x, y, 9) * 2) + (t === T.WALL ? (x + y) : 0)) % 2 ? sideA : sideB;
        const ao0 = t === T.PIT ? 0.15 : Math.min(1, 0.7 + (yb - bottom) / 2.5);
        const ao1 = t === T.PIT ? 0.15 : Math.min(1, 0.7 + (yt - bottom) / 2.5);
        const s = 0.92 + hash2(x + i, y, 4) * 0.12;
        const cb = [src.r * ao0 * s, src.g * ao0 * s, src.b * ao0 * s], ct = [src.r * ao1 * s, src.g * ao1 * s, src.b * ao1 * s];
        quad([p0[0], yb, p0[1]], [p1[0], yb, p1[1]], [p1[0], yt, p1[1]], [p0[0], yt, p0[1]], n, cb, cb, ct, ct);
        yb = yt; i++;
      }
    }
  }
  // Pit walls: pits are *lower* so their neighbours draw sides down into them (handled above: neighbour h=-4)
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const tm = terrainMat();
  const m = new THREE.Mesh(g, tm);
  m.receiveShadow = true; m.castShadow = true;
  return m;
}
// one shared terrain material for every chunk (a clone per chunk would recompile the shader)
let _terrainMat = null;
function terrainMat() {
  if (_terrainMat) return _terrainMat;
  const tm = _terrainMat = MAT.clone(); tm.side = THREE.DoubleSide;
  tm.onBeforeCompile = sh => {
    sh.uniforms.clipZ = clipUniform;
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = 'uniform float clipZ; varying vec3 vWP; varying vec3 vWN;\n float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }\n' + sh.fragmentShader
      .replace('void main() {', 'void main() {\n if (vWP.z > clipZ && vWP.y > 0.32) discard;')
      // painted ground detail: pixel speckle + soft patches, so tiles stop reading as a grid
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vWN.y > 0.5) {
          float h1 = h21(floor(vWP.xz * 6.0));
          float h2 = h21(floor(vWP.xz * 1.35 + 17.0));
          float h3 = h21(floor(vWP.xz * 0.45 + 3.0));
          float green = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
          diffuseColor.rgb *= 0.95 + (h1 - 0.5) * (0.07 + 0.09 * green) + (h2 - 0.5) * 0.07 + (h3 - 0.5) * 0.05;
          diffuseColor.rgb += vec3(0.02, 0.035, -0.01) * green * step(0.93, h1);
        } else {
          float hs = h21(floor(vec2(vWP.x + vWP.z, vWP.y) * vec2(5.0, 8.0)));
          diffuseColor.rgb *= 0.94 + hs * 0.1;
        }`);
  };
  return tm;
}

// Animated liquid surface
const LIQ_MATS = new WeakMap();
export function buildLiquids(area, time, rect) {
  const group = new THREE.Group();
  const X0 = rect ? rect.x0 : 0, Y0 = rect ? rect.y0 : 0, X1 = rect ? Math.min(area.w, rect.x1) : area.w, Y1 = rect ? Math.min(area.h, rect.y1) : area.h;
  const mk = (types, y, shallowCol, deepCol, foamCol, lava, only) => {
    const pos = [], shore = [];
    const { w, h, tiles } = area;
    const isL = (x, yy) => x >= 0 && yy >= 0 && x < w && yy < h && types.includes(tiles[yy * w + x]);
    for (let yy = Y0; yy < Y1; yy++) for (let x = X0; x < X1; x++) {
      if (!isL(x, yy) || (only && !only(x, yy))) continue;
      const corner = (cx, cy) => {
        let land = 0;
        for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if (!isL(cx + dx, cy + dy)) land++;
        return land > 0 ? 1 : 0;
      };
      const P = [[x, yy], [x, yy + 1], [x + 1, yy + 1], [x, yy], [x + 1, yy + 1], [x + 1, yy]];
      for (const [px, py] of P) { pos.push(px, y, py); shore.push(corner(px, py)); }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('shore', new THREE.Float32BufferAttribute(shore, 1));
    // one material per liquid kind (and clock): chunks come and go, and a disposed last user
    // would make three.js throw the compiled program away and rebuild it on the next chunk
    let byKey = LIQ_MATS.get(time); if (!byKey) LIQ_MATS.set(time, byKey = new Map());
    const key = [shallowCol, deepCol, foamCol, lava ? 1 : 0].join(':');
    let mat = byKey.get(key);
    if (!mat) byKey.set(key, mat = new THREE.ShaderMaterial({
      uniforms: { time, a: { value: new THREE.Color(shallowCol) }, b: { value: new THREE.Color(deepCol) }, f: { value: new THREE.Color(foamCol) }, lava: { value: lava ? 1 : 0 }, ...waterU },
      vertexShader: `attribute float shore; varying float vS; varying vec3 vW; void main(){ vS = shore; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float time; uniform vec3 a; uniform vec3 b; uniform vec3 f; uniform float lava; uniform float light; uniform float rain; uniform vec3 sky; uniform float night; varying float vS; varying vec3 vW;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec2 p = vW.xz;
          float wv = sin(p.x*1.3 + time*1.1 + sin(p.y*0.9+time*0.7)*1.5) + sin(p.y*1.7 - time*0.9 + p.x*0.4);
          float t = clamp(wv*0.25+0.5,0.,1.);
          // deeper toward the middle: distance to shore approximated by a soft noise over vS
          vec3 c = mix(b, a, t*0.45 + vS*0.55);
          // faked sky reflection on wave faces
          c = mix(c, sky, 0.18 * smoothstep(0.55, 0.95, t) * (1.0 - lava));
          // crest lines (quantised) drifting with the wind
          float crest = step(0.9, fract((p.x*0.35 + p.y*0.5) + sin(p.y*0.8+time*0.6)*0.25 + time*0.08));
          c = mix(c, f, crest*0.3*(1.0-lava));
          // animated shoreline foam that laps in and out
          float lap = 0.5 + 0.5*sin(time*1.6 + p.x*0.9 + p.y*0.7);
          float foam = smoothstep(0.62 - lap*0.18, 1.0, vS + (h21(floor(p*5.0))-0.5)*0.25);
          c = mix(c, f, foam*0.75*(1.0-lava));
          // sun/moon glints
          float gl = step(0.985, h21(floor(p*6.0) + floor(time*3.0 + h21(floor(p*6.0))*7.0)));
          c += gl * (night > 0.5 ? vec3(0.35,0.4,0.55) : vec3(0.6,0.6,0.5)) * (1.0-lava) * (1.0 - vS);
          // rain rings
          if (rain > 0.01 && lava < 0.5) {
            vec2 cell = floor(p*1.4); vec2 fr = fract(p*1.4) - 0.5;
            float ph = h21(cell); float rr = fract(time*1.3 + ph*7.0) * 0.45;
            float ring = 1.0 - smoothstep(0.0, 0.05, abs(length(fr - (vec2(h21(cell+3.1), h21(cell+7.7))-0.5)*0.4) - rr));
            c = mix(c, f, ring * rain * 0.55 * (1.0 - rr*2.0));
          }
          if (lava > 0.5) c += vec3(0.35,0.12,0.0) * (0.5+0.5*sin(time*2.0+p.x+p.y));
          c *= lava > 0.5 ? 1.0 : light;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide,
    }));
    mat.userData.shared = true;
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = false;
    group.add(m);
  };
  const bio = (x, y) => area.biome ? area.biome[y * area.w + x] : -1;
  mk([T.WATER, T.DEEP], -0.14, 0x4aa8c8, 0x1f5a8a, 0xe8f8ff, false);
  if (area.biome) {
    // Glassmere's puddles mirror the sky; Moonfen's pools are black and still
    mk([T.SHALLOW], 0.05, 0xa8e0f0, 0x78b8d8, 0xffffff, false, (x, y) => bio(x, y) === BIOME.glassmere);
    mk([T.SHALLOW], 0.05, 0x1e3a3a, 0x142828, 0x4a7a7a, false, (x, y) => bio(x, y) === BIOME.moonfen);
    mk([T.SHALLOW], 0.05, 0x3a7a6a, 0x2a5a52, 0x7ab8a8, false, (x, y) => bio(x, y) !== BIOME.glassmere && bio(x, y) !== BIOME.moonfen);
  } else mk([T.SHALLOW], 0.05, 0x3a7a6a, 0x2a5a52, 0x7ab8a8, false); // wading depth: ankles under the surface
  mk([T.LAVA], -0.12, 0xff9a2a, 0xc0300a, 0xffe08a, true);
  return group;
}

class Instancer {
  constructor(parts, max, sway = false) {
    const g = geo(parts);
    let mat = MAT;
    if (sway) {
      mat = MAT.clone();
      mat.onBeforeCompile = sh => {
        sh.uniforms.wind = windUniform; sh.uniforms.bend = bendUniform;
        sh.vertexShader = 'uniform float wind; uniform vec4 bend[4];\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0., instanceMatrix[3][2]);
          float sw = sin(wind*1.8 + ip.x*0.7 + ip.z*0.5) * 0.35 + sin(wind*3.1 + ip.x*1.3)*0.1;
          transformed.x += sw * position.y * 0.6; transformed.z += sw * position.y * 0.3;
          for (int i = 0; i < 4; i++) {
            vec2 dv = ip.xz - bend[i].xy; float dd = length(dv) + 1e-3;
            float k = bend[i].w * (1.0 - smoothstep(0.0, bend[i].z, dd));
            transformed.xz += (dv / dd) * k * position.y * 1.6; transformed.y -= k * position.y * 0.35;
          }
          #endif`);
      };
    }
    this.mesh = new THREE.InstancedMesh(g, mat, max);
    this.mesh.count = 0; this.mesh.castShadow = !sway; this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.max = max;
  }
  add(x, y, z, ry = 0, s = 1, sy = s) {
    if (this.mesh.count >= this.max) return -1;
    const i = this.mesh.count++;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
    this.mesh.setMatrixAt(i, m);
    return i;
  }
  hide(i) { const m = new THREE.Matrix4().makeScale(0, 0, 0); this.mesh.setMatrixAt(i, m); this.mesh.instanceMatrix.needsUpdate = true; }
  set(i, x, y, z, ry = 0, s = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
    this.mesh.setMatrixAt(i, m); this.mesh.instanceMatrix.needsUpdate = true;
  }
}
export { Instancer };

// Lit windows, chimneys and lamp glass for the atmosphere pass: gathered once per area.
export function areaLights(area) {
  area.chimneys = []; area.lights = [];
  for (const d of area.defs) if (d.type === 'deco') {
    const gy = d.y ?? groundY(area, Math.floor(d.x), Math.floor(d.z));
    if (d.model === 'house' || d.model === 'farmhouse' || d.model === 'stilthouse' || d.model === 'forgehut') {
      const W = d.w - 0.2, D = d.d - 0.3, H = d.big ? 1.3 : d.small ? 0.9 : 1.1;
      area.chimneys.push({ x: d.x + W * 0.25, y: gy + H + (d.model === 'stilthouse' ? 1.45 : 1.05), z: d.z - 0.2 });
      area.lights.push({ x: d.x, z: d.z + D / 2 + 0.6, kind: 'window' });
    }
    if (d.model === 'lamppost') area.lights.push({ x: d.x + 0.3, z: d.z, y: gy + 1.1, kind: 'lamp' });
    if (d.model === 'biglantern') area.lights.push({ x: d.x, z: d.z, y: gy + 1.8, kind: 'lamp' });
    if (d.model === 'bigforge') area.chimneys.push({ x: d.x + 0.8, y: gy + 4.2, z: d.z - 0.6, big: true });
  }
}
// Props shared by every chunk (one geometry each); glow props use the unlit material.
const GEOS = {}, GLOW_PROPS = new Set(['glowcap', 'moonlily', 'embercrack', 'emberplant']);
const FLAT = new Set(['clover', 'leaf', 'leafG', 'twig', 'button', 'coin', 'rootlet', 'stones', 'flower', 'flowerR', 'flowerB', 'pebble', 'toadstools', 'glassshard', 'porcelainbits', 'petal', 'lilypad', 'claycrack', 'embercrack', 'moonlily', 'heather']);
let swayMat = null;
// a deco's geometry is built once and kept on its def, so re-streaming a chunk is cheap
function decoGeo(d) { if (!d._geo) { d._geo = geo(decoModel(d)); d._geo.userData.shared = true; } return d._geo; }
function decoGlowGeo(d) { if (d._glow === undefined) { const p = decoGlow(d); d._glow = p.length ? geo(p) : null; if (d._glow) d._glow.userData.shared = true; } return d._glow; }
function decoMask(area) {
  if (area._decoMask) return area._decoMask;
  const m = area._decoMask = new Uint8Array(area.w * area.h);
  for (const d of area.defs) if (d.type === 'deco') {
    const x0 = Math.round(d.x - d.w / 2), y0 = Math.round(d.z - d.d / 2);
    for (let j = 0; j < d.d; j++) for (let i = 0; i < d.w; i++) { const x = x0 + i, y = y0 + j; if (x >= 0 && y >= 0 && x < area.w && y < area.h) m[y * area.w + x] = 1; }
  }
  return m;
}
// Scenery for a rectangle of tiles (the whole area when rect is omitted). Everything is
// collected per prop type and built into exactly-sized instanced meshes with real bounds.
export function buildScenery(area, rect) {
  const group = new THREE.Group();
  const { w, h, tiles } = area;
  const X0 = rect ? rect.x0 : 0, Y0 = rect ? rect.y0 : 0, X1 = rect ? Math.min(w, rect.x1) : w, Y1 = rect ? Math.min(h, rect.y1) : h;
  const inRect = (x, z) => x >= X0 && x < X1 && z >= Y0 && z < Y1;
  if (!rect) areaLights(area);
  const walk = t => t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.PATH || t === T.SAND || t === T.MOSS || t === T.MUD || t === T.CLAY || t === T.STONE;
  const bins = new Map();
  const I = (name, max, sway) => ({ add(x, y, z, ry = 0, sc = 1, sy = sc) {
    let b = bins.get(name);
    if (!b) { b = { name, sway, list: [] }; bins.set(name, b); }
    b.list.push(x, y, z, ry, sc, sy);
  } });
  const mask = decoMask(area);
  const B6 = area.biome ? (x, y) => area.biome[y * w + x] : () => -1;
  // visual-only landmarks (walkable, or standing on tiles that already block)
  for (const d of area.defs) if (d.type === 'landmark' && inRect(Math.floor(d.x), Math.floor(d.z))) {
    const m = new THREE.Mesh(decoGeo(d), MAT); m.position.set(d.x, d.y || 0, d.z); m.rotation.y = d.ry || 0; m.castShadow = true; m.receiveShadow = true; group.add(m);
    const gg = decoGlowGeo(d); if (gg) { const gm = new THREE.Mesh(gg, MAT_GLOW); gm.position.copy(m.position); gm.rotation.y = m.rotation.y; group.add(gm); }
  }
  for (const d of area.defs) if (d.type === 'deco' && inRect(Math.floor(d.x), Math.floor(d.z))) {
    const gy = d.y ?? groundY(area, Math.floor(d.x), Math.floor(d.z));
    const m = new THREE.Mesh(decoGeo(d), MAT);
    m.position.set(d.x, gy, d.z); m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    const gg = decoGlowGeo(d); if (gg) { const gm = new THREE.Mesh(gg, MAT_GLOW); gm.position.copy(m.position); group.add(gm); }
    // lit windows and lamp glass for the atmosphere pass
    if (d.model === 'house') {
      const W = d.w - 0.2, D = d.d - 0.3;
      const wm = new THREE.Mesh(geo([B(0.26, 0.22, 0.02, -W / 2 + 0.45, 0.47, D / 2 + 0.035, 0xffffff), B(0.26, 0.22, 0.02, W / 2 - 0.45, 0.47, D / 2 + 0.035, 0xffffff)]), windowMat);
      wm.position.copy(m.position); group.add(wm);
    }
    if (d.model === 'lamppost') {
      const gm = new THREE.Mesh(geo([B(0.15, 0.17, 0.15, 0.3, 0.99, 0, 0xffffff)]), lampMat);
      gm.position.copy(m.position); group.add(gm);
    }
  }
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const t = tiles[y * w + x], bio = B6(x, y);
    const gy = groundY(area, x, y);
    const r = hash2(x, y, 17), r2 = hash2(x, y, 23);
    const cx = x + 0.5 + (r - 0.5) * 0.25, cz = y + 0.5 + (r2 - 0.5) * 0.25;
    if (t === T.TREE) {
      const near = (tt) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2]]) if (tiles[(y + dy) * w + x + dx] === tt) return true; return false; };
      let kind, s = 0.95 + r2 * 0.5;
      if (bio === BIOME.moonfen) kind = r < 0.85 ? 'crooktree' : 'deadtree';
      else if (bio === BIOME.highlands) kind = y < 44 || r < 0.5 ? 'snowpine' : 'pine';
      else if (bio === BIOME.cinderpeak) kind = 'deadtree';
      else if (near(T.SAND) || near(T.SANDSTONE) || near(T.CLAY)) kind = (area.id === 'overworld' && bio === BIOME.sunscald) || (area.id === 'overworld' && !area.biome && x > 110) ? 'cactus' : 'palm';
      else if (near(T.ASH)) kind = 'deadtree';
      else if (bio === BIOME.deepwood) { kind = r < 0.22 ? 'bigoak' : r < 0.62 ? 'pine' : r < 0.97 ? 'oak' : 'shroom'; s *= 1.15; }
      else if (tiles[y * w + x - 1] === T.FOREST || tiles[y * w + x + 1] === T.FOREST || near(T.FOREST)) kind = r < 0.5 ? 'pine' : r < 0.95 ? 'oak' : 'shroom';
      else kind = r < 0.6 ? 'oak' : 'birch';
      // Now and then a tree tile at the edge of a clearing is something from the big folk's
      // world instead. The tile still blocks exactly as before, so navigation is unchanged.
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (walk(tiles[(y + dy) * w + x + dx])) edge = true;
      const gk = hash2(x, y, 71);
      const bigFolk = bio < 0 || bio === BIOME.heartland || bio === BIOME.whisperwood || bio === BIOME.deepwood || bio === BIOME.glassmere;
      if (area.id === 'overworld' && bigFolk && edge && gk < 0.055 && (kind === 'oak' || kind === 'pine' || kind === 'birch' || kind === 'bigoak')) {
        const giant = ['giantAcorn', 'thimble', 'teacup', 'spool', 'bucket', 'log', 'matchbox', 'giantAcorn', 'log', 'trowel'][Math.floor(hash2(x, y, 72) * 10)];
        I(giant, 200).add(x + 0.5, gy, y + 0.5, r * 6.28, 1.05 + r2 * 0.25);
      } else I(kind, 3000).add(cx, gy, cz, r * 6.28, s, s * (0.9 + r * 0.4));
    } else if (t === T.PROP && !mask[y * w + x]) {
      I('stake', 300).add(x + 0.5, gy, y + 0.5, r * 0.5, 1);
    } else if (t === T.FLOWERS) {
      const n = 1 + Math.floor(r * 3);
      for (let k = 0; k < n; k++) {
        const kk = hash2(x * 3 + k, y, 31);
        const kind = bio === BIOME.highlands ? (kk < 0.6 ? 'heather' : 'flowerB') : kk < 0.4 ? 'flower' : kk < 0.75 ? 'flowerR' : 'flowerB';
        I(kind, 6000, kind !== 'heather').add(x + hash2(x, y + k, 5), gy, y + hash2(x + k, y, 6), kk * 6, 1 + kk * 0.4);
      }
    } else if (t === T.GRASS || t === T.FOREST) {
      const dry = bio === BIOME.sunscald || bio === BIOME.cinderpeak;
      if (r > 0.55) I(dry ? 'drygrass' : 'tuft', 12000, true).add(cx, gy, cz, r2 * 6.28, 0.7 + r2 * 0.6);
      if (r > 0.3 && r < 0.42) I(dry ? 'drygrass' : 'tuft', 12000, true).add(x + hash2(x, y, 41), gy, y + hash2(x, y, 42), r2 * 3, 0.5 + r2 * 0.4); // second, smaller tuft breaks up the grid
      if (t === T.FOREST && r2 > 0.97) I('shroom', 3000).add(cx, gy, cz, r * 6, 0.35);
      if (r2 < 0.012) I('pebble', 500).add(cx, gy, cz, r * 6, 0.8 + r);
      const d3 = hash2(x, y, 51), px = x + hash2(x, y, 52) * 0.8 + 0.1, pz = y + hash2(x, y, 53) * 0.8 + 0.1;
      let nearTree = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tiles[(y + dy) * w + x + dx] === T.TREE) nearTree = true;
      if (t === T.FOREST) {
        if (d3 < 0.22) I(d3 < 0.12 ? 'leaf' : 'leafG', 9000).add(px, gy + 0.01, pz, d3 * 40, 0.9 + d3);
        else if (d3 < 0.27) I('fern', 3000, true).add(px, gy, pz, d3 * 30, 0.9 + d3 * 2);
        else if (d3 < 0.3) I('twig', 1500).add(px, gy + 0.01, pz, d3 * 50, 1);
        else if (bio === BIOME.deepwood && d3 > 0.96) I('glowcap', 800).add(px, gy, pz, d3 * 20, 0.9);
      } else if (bio === BIOME.highlands) {
        if (d3 < 0.08) I('heather', 3000).add(px, gy, pz, d3 * 60, 1 + d3 * 3);
        else if (d3 < 0.1) I('stones', 2000).add(px, gy, pz, d3 * 60, 0.8 + d3 * 4);
      } else {
        if (d3 < 0.05) I('clover', 5000).add(px, gy + 0.005, pz, d3 * 90, 1);
        else if (d3 < 0.065) I('stones', 2000).add(px, gy, pz, d3 * 60, 0.8 + d3 * 4);
        else if (d3 < 0.07 && area.id === 'overworld') I(hash2(x, y, 54) < 0.6 ? 'button' : 'coin', 300).add(px, gy + 0.005, pz, d3 * 70, 0.8);
        else if (bio === BIOME.glassmere && d3 < 0.1) I('glassshard', 2000).add(px, gy + 0.01, pz, d3 * 60, 0.8 + d3 * 3);
      }
      if (nearTree && d3 > 0.8 && d3 < 0.88) I('toadstools', 3000).add(px, gy, pz, d3 * 20, 0.9 + d3 * 0.4);
      if (nearTree && d3 > 0.92) I('rootlet', 2000).add(px, gy + 0.005, pz, d3 * 30, 0.9);
    } else if (t === T.PATH || t === T.STAIRS) {
      const d3 = hash2(x, y, 55);
      if (d3 < 0.05) I('stones', 2000).add(x + 0.2 + d3 * 10, gy, y + hash2(x, y, 56) * 0.8, d3 * 60, 0.6);
    } else if (t === T.SAND) {
      if (r > 0.985 && area.id === 'overworld' && (bio === BIOME.sunscald || (!area.biome && x > 118))) I('cactus', 400).add(cx, gy, cz, r2 * 6, 0.8);
      else if (r > 0.96 && bio === BIOME.sunscald) I('drygrass', 3000, true).add(cx, gy, cz, r2 * 6, 0.8 + r2 * 0.5);
      else if (r > 0.97) I(bio === BIOME.lake || y > 90 ? 'bone' : 'pebble', 500).add(cx, gy, cz, r2 * 6, 0.6);
    } else if (t === T.CLAY) {
      const d3 = hash2(x, y, 57);
      if (d3 < 0.35) I('claycrack', 6000).add(x + 0.5, gy + 0.005, y + 0.5, d3 * 20, 0.9 + d3);
      else if (d3 > 0.97) I('porcelainbits', 600).add(cx, gy, cz, r2 * 6, 1);
      else if (d3 > 0.93) I('drygrass', 3000, true).add(cx, gy, cz, r2 * 6, 0.8);
    } else if (t === T.EMBER) {
      const d3 = hash2(x, y, 58);
      if (d3 < 0.5) I('embercrack', 6000).add(x + 0.5, gy + 0.005, y + 0.5, d3 * 20, 0.9 + d3);
      if (d3 > 0.94) I('emberplant', 800).add(cx, gy, cz, r2 * 6, 1 + r2);
    } else if (t === T.ASH) {
      if (r > 0.95) I('lavaRock', 500).add(cx, gy, cz, r2 * 6, 0.8 + r2);
      else if (r > 0.935 && bio === BIOME.cinderpeak) I('emberplant', 800).add(cx, gy, cz, r2 * 6, 0.9);
    } else if (t === T.MUD) {
      const d3 = hash2(x, y, 59);
      if (d3 < 0.05) I('glowcap', 3000).add(cx, gy, cz, r2 * 6, 0.8 + d3 * 4);
      else if (d3 < 0.12) I('reed', 3000, true).add(cx, gy, cz, r * 6, 0.9 + r);
      else if (d3 > 0.94) I('rootlet', 2000).add(cx, gy + 0.005, cz, d3 * 30, 1.1);
    } else if (t === T.FIELD) {
      for (let k = 0; k < 3; k++) I('crop', 3000, true).add(x + 0.5, gy, y + 0.17 + k * 0.33, r * 0.3, 0.9 + hash2(x, y + k, 44) * 0.3);
    } else if (t === T.STONE && bio === BIOME.highlands) {
      if (r > 0.9) I('stones', 2000).add(cx, gy, cz, r2 * 6, 1);
    } else if (area.glasshouse && (t === T.FLOOR || t === T.MOSS)) {
      // the Conservatory floor: shattered panes, porcelain chips, fallen petals, creeping roots
      const d3 = hash2(x, y, 81), px = x + hash2(x, y, 82) * 0.8 + 0.1, pz = y + hash2(x, y, 83) * 0.8 + 0.1;
      let byWall = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tiles[(y + dy) * w + x + dx] === T.WALL) byWall = true;
      if (d3 < 0.1) I('glassshard', 2000).add(px, 0.01, pz, d3 * 60, 0.8 + d3 * 3);
      else if (d3 < 0.15) I('porcelainbits', 1200).add(px, 0, pz, d3 * 40, 0.9);
      else if (d3 < 0.22) I(d3 < 0.18 ? 'petal' : 'leafG', 3000).add(px, 0.01, pz, d3 * 50, 1);
      else if (byWall && d3 > 0.8) I('fern', 1500, true).add(px, 0, pz, d3 * 20, 1.1 + d3);
      if (byWall && d3 > 0.6 && d3 < 0.68) I('rootlet', 800).add(px, 0.005, pz, d3 * 30, 1.2);
      if (t === T.MOSS && r > 0.6) I('tuft', 3000, true).add(cx, 0, cz, r2 * 6.28, 0.6 + r2 * 0.4);
    } else if (t === T.MOSS && area.biome) {
      if (r > 0.6) I('tuft', 3000, true).add(cx, gy, cz, r2 * 6.28, 0.6 + r2 * 0.4);
      if (bio === BIOME.moonfen && r2 > 0.93) I('glowcap', 3000).add(cx, gy, cz, r * 6, 0.9);
    } else if (t === T.SHALLOW) {
      if (bio === BIOME.moonfen) { if (r > 0.9) I('moonlily', 1500).add(cx, 0.07, cz, r2 * 6.28, 0.8 + r2 * 0.6); else if (r > 0.84) I('reed', 3000, true).add(cx, 0, cz, r * 6, 1.1 + r); }
      else if (bio === BIOME.glassmere) { if (r > 0.94) I('glassshard', 2000).add(cx, 0.06, cz, r2 * 6, 1); }
      else if (r > 0.95) I('reed', 3000, true).add(cx, 0, cz, r * 6, 1.1 + r);
      else if (r > 0.82) I('lilypad', 1500).add(cx, 0.07, cz, r2 * 6.28, 0.8 + r2 * 0.6);
    } else if (t === T.CAVE || (t === T.FLOOR && area.dungeon)) {
      if (r > 0.96) I(area.id === 'grotto' ? 'crystal' : 'pebble', 400).add(cx, 0, cz, r2 * 6, 0.5 + r2 * 0.5);
    }
    // bridge & dock railings along water and chasm edges; posts under docks
    if (t === T.BRIDGE || t === T.DOCK) {
      for (const [dx, dy, ry] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) {
        const nt = tiles[(y + dy) * w + x + dx];
        if (nt === T.WATER || nt === T.DEEP || nt === T.PIT || nt === T.LAVA) I('fence', 2000).add(x + 0.5 + dx * 0.44, gy + 0.05, y + 0.5 + dy * 0.44, ry, 1, 0.8);
      }
      if (t === T.DOCK && (x + y) % 3 === 0) I('post', 1500).add(x + 0.1, gy, y + 0.1, 0, 1);
    }
    // reeds by the water
    if ((t === T.GRASS || t === T.SAND || t === T.FLOWERS || t === T.MUD) && r2 > 0.6) {
      let wet = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nt = tiles[(y + dy) * w + x + dx]; if (nt === T.WATER || nt === T.DEEP) wet = true; }
      if (wet) I('reed', 3000, true).add(cx, gy, cz, r * 6, 1 + r);
    }
  }
  // village clutter tucked against house walls (inside their footprints, so nothing new blocks)
  for (const d of area.defs) if (d.type === 'deco' && (d.model === 'house' || d.model === 'shop' || d.model === 'farmhouse' || d.model === 'forgehut') && inRect(Math.floor(d.x), Math.floor(d.z))) {
    const W = d.w - 0.2, D = d.d - 0.3, gy = d.y ?? groundY(area, Math.floor(d.x), Math.floor(d.z));
    const spots = [[-W / 2 + 0.22, D / 2 + 0.05], [W / 2 - 0.22, D / 2 + 0.05], [-W / 2 - 0.02, -D / 4], [W / 2 + 0.02, 0]];
    spots.forEach(([ox, oz], i) => {
      const k = hash2(Math.round(d.x * 7) + i, Math.round(d.z * 7), 61);
      if (k < 0.3) return;
      const kind = ['barrel', 'crates', 'pot', 'sacks', 'pot'][Math.floor(k * 5)];
      I(kind, 400).add(d.x + ox, gy, d.z + oz, k * 6, 0.8);
    });
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  for (const b of bins.values()) {
    const g = GEOS[b.name] || (GEOS[b.name] = geo(PROPS[b.name]()));
    g.userData.shared = true;
    let mat = GLOW_PROPS.has(b.name) ? MAT_GLOW : MAT;
    if (b.sway) mat = swayMat || (swayMat = new Instancer(PROPS.tuft(), 1, true).mesh.material);
    const n = b.list.length / 6, mesh = new THREE.InstancedMesh(g, mat, n);
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      _m.compose(_p.set(b.list[o], b.list[o + 1], b.list[o + 2]), _q.setFromAxisAngle(_up, b.list[o + 3]), _s.set(b.list[o + 4], b.list[o + 5], b.list[o + 4]));
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 1.5; // sway + tall props
    mesh.frustumCulled = true; mesh.castShadow = !b.sway && !FLAT.has(b.name) && !GLOW_PROPS.has(b.name); mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}
