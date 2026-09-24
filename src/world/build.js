// Turns an area's tile grid into renderable geometry: a single vertex-coloured terrain
// mesh with soft colour blending, animated water/lava surfaces, and instanced scenery.
import * as THREE from 'three';
import { T, TILE_INFO } from './tiles.js';
import { hash2, vnoise } from '../engine/util.js';
import { geo, MAT, PROPS, decoModel, B } from '../models.js';

export const windUniform = { value: 0 };
// Geometry south of the current dungeon room is cut down to a stump so walls never hide the player.
export const clipUniform = { value: 1e9 };

export function tileHeight(area, x, y) {
  if (x < 0 || y < 0 || x >= area.w || y >= area.h) return 3;
  const i = y * area.w + x;
  const hv = area.hv[i];
  if (!Number.isNaN(hv)) return hv;
  return TILE_INFO[area.tiles[i]]?.h ?? 0;
}

function tileColor(area, x, y, t, out) {
  const info = TILE_INFO[t] || TILE_INFO[T.GRASS];
  const pal = info.top;
  out.set(pal[Math.floor(hash2(x, y, 1) * pal.length)]);
  const n = vnoise(x * 0.35, y * 0.35, 3) - 0.5;
  out.offsetHSL(n * 0.02, 0, n * 0.06);
  if (area.id === 'overworld' && (t === T.GRASS || t === T.FLOWERS || t === T.FOREST)) {
    // hue shift across the land: bluer north, golden south
    out.offsetHSL(-(y / area.h - 0.5) * 0.03, 0, 0);
  }
  if (t === T.CLIFF && area.id === 'overworld' && y < 12) out.lerp(new THREE.Color(0xe8eef8), Math.max(0, (8 - y) / 8) * 0.8);
  return out;
}

export function buildTerrain(area) {
  const { w, h, tiles } = area;
  const pos = [], nor = [], col = [];
  const c = new THREE.Color(), c2 = new THREE.Color();
  const cornerCol = (x, y, height) => {
    // average colours of up to 4 tiles sharing this corner at the same height
    let r = 0, g = 0, b = 0, n = 0;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      if (Math.abs(tileHeight(area, tx, ty) - height) > 0.2) continue;
      const t = tiles[ty * w + tx];
      tileColor(area, tx, ty, t, c2);
      r += c2.r; g += c2.g; b += c2.b; n++;
    }
    return n ? [r / n, g / n, b / n] : [c.r, c.g, c.b];
  };
  const quad = (a, b, cc, d, n, ca, cb, ccc, cd) => {
    // two triangles a b c, a c d
    for (const [p, cl] of [[a, ca], [b, cb], [cc, ccc], [a, ca], [cc, ccc], [d, cd]]) { pos.push(...p); nor.push(...n); col.push(...cl); }
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = tiles[y * w + x];
    const hh = tileHeight(area, x, y);
    tileColor(area, x, y, t, c);
    const flat = t === T.WALL || t === T.PILLAR || t === T.PIT || t === T.ROCK || t === T.CLIFF || t === T.SANDSTONE;
    const cc = [c.r, c.g, c.b];
    const k = [cornerCol(x, y, hh), cornerCol(x + 1, y, hh), cornerCol(x + 1, y + 1, hh), cornerCol(x, y + 1, hh)];
    const cs = flat ? [cc, cc, cc, cc] : k;
    quad([x, hh, y], [x, hh, y + 1], [x + 1, hh, y + 1], [x + 1, hh, y], [0, 1, 0], cs[0], cs[3], cs[2], cs[1]);
    // sides
    const info = TILE_INFO[t] || {};
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
        const ao0 = t === T.PIT ? 0.15 : Math.min(1, 0.55 + (yb - bottom) / 2.5);
        const ao1 = t === T.PIT ? 0.15 : Math.min(1, 0.55 + (yt - bottom) / 2.5);
        const s = 0.92 + hash2(x + i, y, 4) * 0.12;
        const cb = [src.r * ao0 * s, src.g * ao0 * s, src.b * ao0 * s], ct = [src.r * ao1 * s, src.g * ao1 * s, src.b * ao1 * s];
        quad([p0[0], yb, p0[1]], [p1[0], yb, p1[1]], [p1[0], yt, p1[1]], [p0[0], yt, p0[1]], n, cb, cb, ct, ct);
        yb = yt; i++;
      }
    }
  }
  // Pit walls: pits are *lower* so their neighbours draw sides down into them (handled above: neighbour h=-4)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const tm = MAT.clone(); tm.side = THREE.DoubleSide;
  tm.onBeforeCompile = sh => {
    sh.uniforms.clipZ = clipUniform;
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float clipZ; varying vec3 vWP;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vWP.z > clipZ && vWP.y > 0.32) discard;');
  };
  const m = new THREE.Mesh(g, tm);
  m.receiveShadow = true; m.castShadow = true;
  return m;
}

// Animated liquid surface
export function buildLiquids(area, time) {
  const group = new THREE.Group();
  const mk = (types, y, shallowCol, deepCol, foamCol, lava) => {
    const pos = [], shore = [];
    const { w, h, tiles } = area;
    const isL = (x, yy) => x >= 0 && yy >= 0 && x < w && yy < h && types.includes(tiles[yy * w + x]);
    for (let yy = 0; yy < h; yy++) for (let x = 0; x < w; x++) {
      if (!isL(x, yy)) continue;
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
    const mat = new THREE.ShaderMaterial({
      uniforms: { time, a: { value: new THREE.Color(shallowCol) }, b: { value: new THREE.Color(deepCol) }, f: { value: new THREE.Color(foamCol) }, lava: { value: lava ? 1 : 0 } },
      vertexShader: `attribute float shore; varying float vS; varying vec3 vW; void main(){ vS = shore; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float time; uniform vec3 a; uniform vec3 b; uniform vec3 f; uniform float lava; varying float vS; varying vec3 vW;
        void main(){
          vec2 p = vW.xz;
          float wv = sin(p.x*1.3 + time*1.1 + sin(p.y*0.9+time*0.7)*1.5) + sin(p.y*1.7 - time*0.9 + p.x*0.4);
          float t = clamp(wv*0.25+0.5,0.,1.);
          vec3 c = mix(b, a, t*0.6 + vS*0.4);
          float band = step(0.93, fract((p.x*0.35 + p.y*0.5) + sin(p.y*0.8+time*0.6)*0.25 + time*0.08));
          c = mix(c, f, band*0.35*(1.0-lava));
          float foam = smoothstep(0.75, 1.0, vS + sin(time*2.0 + p.x*3.0 + p.y*2.0)*0.12);
          c = mix(c, f, foam*0.6);
          if (lava > 0.5) c += vec3(0.35,0.12,0.0) * (0.5+0.5*sin(time*2.0+p.x+p.y));
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = false;
    group.add(m);
  };
  mk([T.WATER, T.DEEP], -0.14, 0x4aa8c8, 0x1f5a8a, 0xe8f8ff, false);
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
        sh.uniforms.wind = windUniform;
        sh.vertexShader = 'uniform float wind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0., instanceMatrix[3][2]);
          float sw = sin(wind*1.8 + ip.x*0.7 + ip.z*0.5) * 0.35 + sin(wind*3.1 + ip.x*1.3)*0.1;
          transformed.x += sw * position.y * 0.6; transformed.z += sw * position.y * 0.3;
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

export function buildScenery(area) {
  const group = new THREE.Group();
  const { w, h, tiles } = area;
  const inst = {};
  const I = (name, max, sway) => inst[name] || (inst[name] = new Instancer(PROPS[name](), max, sway));
  // deco footprint map
  const decoMask = new Uint8Array(w * h);
  for (const d of area.defs) if (d.type === 'deco') {
    const x0 = Math.round(d.x - d.w / 2), y0 = Math.round(d.z - d.d / 2);
    for (let j = 0; j < d.d; j++) for (let i = 0; i < d.w; i++) decoMask[(y0 + j) * w + x0 + i] = 1;
    const m = new THREE.Mesh(geo(decoModel(d)), MAT);
    m.position.set(d.x, 0, d.z); m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = tiles[y * w + x];
    const r = hash2(x, y, 17), r2 = hash2(x, y, 23);
    const cx = x + 0.5 + (r - 0.5) * 0.25, cz = y + 0.5 + (r2 - 0.5) * 0.25;
    if (t === T.TREE) {
      const near = (tt) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2]]) if (tiles[(y + dy) * w + x + dx] === tt) return true; return false; };
      let kind;
      if (near(T.SAND) || near(T.SANDSTONE)) kind = area.id === 'overworld' && x > 110 ? 'cactus' : 'palm';
      else if (near(T.ASH)) kind = 'deadtree';
      else if (tiles[y * w + x - 1] === T.FOREST || tiles[y * w + x + 1] === T.FOREST || near(T.FOREST)) kind = r < 0.5 ? 'pine' : r < 0.95 ? 'oak' : 'shroom';
      else kind = r < 0.6 ? 'oak' : 'birch';
      const s = 0.95 + r2 * 0.5;
      I(kind, 3000).add(cx, 0, cz, r * 6.28, s, s * (0.9 + r * 0.4));
    } else if (t === T.PROP && !decoMask[y * w + x]) {
      I('stake', 300).add(x + 0.5, 0, y + 0.5, r * 0.5, 1);
    } else if (t === T.FLOWERS) {
      const n = 1 + Math.floor(r * 3);
      for (let k = 0; k < n; k++) {
        const kk = hash2(x * 3 + k, y, 31);
        I(kk < 0.4 ? 'flower' : kk < 0.75 ? 'flowerR' : 'flowerB', 6000, true).add(x + hash2(x, y + k, 5), 0, y + hash2(x + k, y, 6), kk * 6, 1 + kk * 0.4);
      }
    } else if (t === T.GRASS || t === T.FOREST) {
      if (r > 0.55) I('tuft', 12000, true).add(cx, 0, cz, r2 * 6.28, 0.7 + r2 * 0.6);
      if (t === T.FOREST && r2 > 0.97) I('shroom', 3000).add(cx, 0, cz, r * 6, 0.35);
      if (r2 < 0.012) I('pebble', 500).add(cx, 0, cz, r * 6, 0.8 + r);
    } else if (t === T.SAND) {
      if (r > 0.985 && area.id === 'overworld' && x > 118) I('cactus', 400).add(cx, 0, cz, r2 * 6, 0.8);
      else if (r > 0.97) I(y > 90 ? 'bone' : 'pebble', 500).add(cx, 0, cz, r2 * 6, 0.6);
    } else if (t === T.ASH) {
      if (r > 0.95) I('lavaRock', 500).add(cx, 0, cz, r2 * 6, 0.8 + r2);
    } else if (t === T.CAVE || (t === T.FLOOR && area.dungeon)) {
      if (r > 0.96) I(area.id === 'grotto' ? 'crystal' : 'pebble', 400).add(cx, 0, cz, r2 * 6, 0.5 + r2 * 0.5);
    }
    // bridge & dock railings along water edges
    if (t === T.BRIDGE || t === T.DOCK) {
      for (const [dx, dy, ry] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) {
        const nt = tiles[(y + dy) * w + x + dx];
        if (nt === T.WATER || nt === T.DEEP) I('fence', 2000).add(x + 0.5 + dx * 0.44, 0.05, y + 0.5 + dy * 0.44, ry, 1, 0.8);
      }
    }
    // reeds by the water
    if ((t === T.GRASS || t === T.SAND || t === T.FLOWERS) && r2 > 0.6) {
      let wet = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nt = tiles[(y + dy) * w + x + dx]; if (nt === T.WATER || nt === T.DEEP) wet = true; }
      if (wet) I('reed', 3000, true).add(cx, 0, cz, r * 6, 1 + r);
    }
  }
  for (const k in inst) { inst[k].mesh.instanceMatrix.needsUpdate = true; group.add(inst[k].mesh); }
  return group;
}
