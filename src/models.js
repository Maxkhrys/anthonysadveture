// Chunky voxel-part models. Every model is assembled from coloured boxes merged into
// single geometries (vertex colours), so the low-res renderer turns them into crisp pixel sprites.
import * as THREE from 'three';

export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
export const MAT_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
export const MAT_GLOW_T = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false });

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
// parts: [w,h,d, x,y,z, color, rx?, ry?, rz?]  (x,y,z = box centre; y measured from bottom when using B())
export function geo(parts) {
  const pos = [], nor = [], col = [];
  for (const p of parts) {
    const [w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0] = p;
    const b = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    b.applyMatrix4(_m);
    const P = b.attributes.position.array, Nn = b.attributes.normal.array;
    _c.set(color);
    for (let i = 0; i < P.length; i += 3) {
      pos.push(P[i], P[i + 1], P[i + 2]); nor.push(Nn[i], Nn[i + 1], Nn[i + 2]);
      // bake a touch of top-light / bottom-shade into the vertex colour
      const shade = Nn[i + 1] > 0.5 ? 1.08 : Nn[i + 1] < -0.5 ? 0.7 : 1;
      col.push(_c.r * shade, _c.g * shade, _c.b * shade);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
// box resting on y (bottom), for readability
export const B = (w, h, d, x, y, z, c, rx, ry, rz) => [w, h, d, x, y + h / 2, z, c, rx, ry, rz];

export function mesh(parts, mat = MAT, shadow = true) {
  const m = new THREE.Mesh(geo(parts), mat);
  m.castShadow = shadow; m.receiveShadow = false;
  return m;
}
function pivot(parts, px, py, pz, mat) {
  const g = new THREE.Group(); g.position.set(px, py, pz);
  if (parts) g.add(mesh(parts, mat));
  return g;
}

// ------------------------------------------------------------- HERO: Moss
export function makeHero() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = 0xf4c9a0, tunic = 0x3d9a4c, tunicD = 0x2e7a3a, boot = 0x5a3a24, cap = 0x9a5f2c, capD = 0x7a4a1e, scarf = 0xe0463c;
  const legL = pivot([B(0.11, 0.17, 0.12, 0, -0.17, 0, boot)], -0.07, 0.17, 0);
  const legR = pivot([B(0.11, 0.17, 0.12, 0, -0.17, 0, boot)], 0.07, 0.17, 0);
  body.add(legL, legR);
  const torso = mesh([B(0.3, 0.2, 0.22, 0, 0.16, 0, tunic), B(0.32, 0.06, 0.24, 0, 0.3, 0, tunicD), B(0.31, 0.04, 0.23, 0, 0.2, 0, 0x6a4a2a), B(0.05, 0.05, 0.02, 0.06, 0.2, 0.12, 0xffd25e)]);
  body.add(torso);
  const head = pivot([
    B(0.36, 0.3, 0.32, 0, 0, 0, skin),
    B(0.05, 0.08, 0.02, -0.08, 0.1, 0.16, 0x1b1426), B(0.05, 0.08, 0.02, 0.08, 0.1, 0.16, 0x1b1426),
    B(0.02, 0.03, 0.02, -0.07, 0.15, 0.17, 0xffffff), B(0.02, 0.03, 0.02, 0.09, 0.15, 0.17, 0xffffff),
    B(0.06, 0.03, 0.01, -0.13, 0.05, 0.165, 0xf08a8a), B(0.06, 0.03, 0.01, 0.13, 0.05, 0.165, 0xf08a8a),
    // acorn cap
    B(0.42, 0.1, 0.4, 0, 0.24, 0, cap), B(0.36, 0.08, 0.34, 0, 0.33, 0, capD), B(0.22, 0.05, 0.2, 0, 0.4, 0, cap),
    B(0.04, 0.09, 0.04, 0, 0.44, 0, 0x5a3a1a), B(0.44, 0.03, 0.42, 0, 0.26, 0, 0xb87a3a),
    // leaf sprout
    B(0.03, 0.1, 0.03, 0.06, 0.44, -0.04, 0x4caa3a, 0, 0, -0.5), B(0.12, 0.03, 0.08, 0.13, 0.52, -0.04, 0x7fd36a, 0, 0, -0.3),
    // hair tufts
    B(0.38, 0.06, 0.1, 0, 0.19, -0.13, 0x6a3a1a),
  ], 0, 0.36, 0);
  body.add(head);
  const scarfBase = mesh([B(0.34, 0.07, 0.26, 0, 0.3, 0, scarf)]);
  body.add(scarfBase);
  const tail1 = pivot([B(0.1, 0.05, 0.16, 0, -0.03, -0.08, scarf)], 0.06, 0.34, -0.12);
  const tail2 = pivot([B(0.09, 0.04, 0.15, 0, -0.02, -0.07, 0xc8342c)], 0, 0, -0.16);
  tail1.add(tail2); body.add(tail1);
  // arms
  const armR = pivot([B(0.09, 0.18, 0.09, 0, -0.18, 0, tunic), B(0.09, 0.05, 0.09, 0, -0.23, 0, skin)], 0.2, 0.34, 0);
  const armL = pivot([B(0.09, 0.18, 0.09, 0, -0.18, 0, tunic), B(0.09, 0.05, 0.09, 0, -0.23, 0, skin)], -0.2, 0.34, 0);
  body.add(armR, armL);
  // sword: held pointing forward-ish from right hand
  const sword = pivot([
    B(0.05, 0.1, 0.05, 0, 0, 0, 0x5a3a1a), B(0.2, 0.04, 0.06, 0, 0.1, 0, 0xffc94a), B(0.07, 0.5, 0.025, 0, 0.14, 0, 0xdfe8f0),
    B(0.03, 0.46, 0.028, 0.02, 0.16, 0, 0xffffff), B(0.05, 0.05, 0.03, 0, 0.64, 0, 0xdfe8f0),
  ], 0, -0.22, 0.02);
  armR.add(sword);
  sword.rotation.x = Math.PI / 2 * 0.9;
  const shield = pivot([
    B(0.05, 0.3, 0.28, 0, -0.15, 0, 0x9a6a3a), B(0.06, 0.26, 0.24, 0, -0.13, 0, 0xc08a4a), B(0.07, 0.1, 0.08, 0, -0.08, 0, 0xffd25e), B(0.07, 0.04, 0.12, 0, -0.14, 0, 0xffd25e),
  ], -0.06, -0.08, 0.02);
  armL.add(shield);
  root.traverse(o => { if (o.isMesh) o.layers.enable(1); });
  return { root, body, head, legL, legR, armL, armR, sword, shield, torso, tail1, tail2 };
}

// ------------------------------------------------------------- folk (NPCs)
export function makeFolk(look) {
  const L = {
    elder: { robe: 0x6a4a9a, robe2: 0x4a3070, skin: 0xe8c0a0, hat: 0x3a2a60, beard: 0xf0f0f0, h: 1.0, staff: true },
    shop: { robe: 0xd07a3a, robe2: 0xf0e0c0, skin: 0xf4c9a0, hat: 0x3a7ac0, h: 0.95, apron: true },
    miller: { robe: 0xe0d8c8, robe2: 0xb0a890, skin: 0xe8b890, hat: 0xf8f8f0, h: 1.1 },
    guard: { robe: 0x3a5a9a, robe2: 0x8a9ab0, skin: 0xd8a880, hat: 0x9aa8b8, h: 1.1, spear: true },
    fisher: { robe: 0xe0b83a, robe2: 0xb08a2a, skin: 0xc89070, hat: 0xe0b83a, h: 1.0, rod: true },
    kid: { robe: 0xe05a8a, robe2: 0xc04a70, skin: 0xf8d0b0, hat: 0x3ac0a0, h: 0.8 },
    hermit: { robe: 0x4a6a3a, robe2: 0x3a5a2a, skin: 0xb8a080, hat: 0x5a7a3a, h: 1.0, beard: 0x9a9a8a, staff: true },
    shopkeep: {},
  }[look] || { robe: 0x888888, robe2: 0x666666, skin: 0xf0c8a0, hat: 0x444444, h: 1 };
  const s = L.h;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); body.scale.setScalar(s);
  body.add(mesh([B(0.34, 0.34, 0.26, 0, 0, 0, L.robe), B(0.36, 0.06, 0.28, 0, 0, 0, L.robe2), ...(L.apron ? [B(0.22, 0.24, 0.02, 0, 0.04, 0.14, 0xf8f0e0)] : [])]));
  const head = pivot([
    B(0.34, 0.28, 0.3, 0, 0, 0, L.skin),
    B(0.05, 0.07, 0.02, -0.08, 0.1, 0.15, 0x1b1426), B(0.05, 0.07, 0.02, 0.08, 0.1, 0.15, 0x1b1426),
    B(0.38, 0.1, 0.34, 0, 0.26, 0, L.hat), B(0.26, 0.08, 0.24, 0, 0.34, 0, L.hat),
    ...(L.beard ? [B(0.3, 0.16, 0.06, 0, -0.08, 0.16, L.beard)] : []),
    ...(look === 'fisher' ? [B(0.5, 0.03, 0.46, 0, 0.26, 0, 0xd0a82a)] : []),
    ...(look === 'guard' ? [B(0.04, 0.14, 0.04, 0, 0.42, 0, 0xe04a3a)] : []),
    ...(look === 'miller' ? [B(0.2, 0.14, 0.2, 0, 0.4, 0, 0xffffff)] : []),
  ], 0, 0.34, 0);
  body.add(head);
  const armL = pivot([B(0.09, 0.2, 0.09, 0, -0.2, 0, L.robe2)], -0.21, 0.32, 0);
  const armR = pivot([B(0.09, 0.2, 0.09, 0, -0.2, 0, L.robe2)], 0.21, 0.32, 0);
  body.add(armL, armR);
  if (L.staff) armR.add(mesh([B(0.05, 0.8, 0.05, 0, -0.5, 0.05, 0x7a5a3a), B(0.1, 0.1, 0.1, 0, 0.3, 0.05, look === 'hermit' ? 0x7fd36a : 0xffd25e)]));
  if (L.spear) armR.add(mesh([B(0.04, 1.0, 0.04, 0, -0.5, 0.05, 0x7a5a3a), B(0.08, 0.16, 0.03, 0, 0.5, 0.05, 0xdfe8f0)]));
  if (L.rod) armR.add(mesh([B(0.03, 0.03, 0.8, 0, -0.2, 0.35, 0x7a5a3a, -0.5)]));
  return { root, body, head, armL, armR };
}

// ------------------------------------------------------------- ENEMIES
const INK = 0x2a1a3a, INK2 = 0x3e2856, EYE = 0xfff3b0;
export function makeBlot() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.add(mesh([B(0.5, 0.34, 0.46, 0, 0, 0, INK), B(0.4, 0.1, 0.36, 0, 0.34, 0, INK2), B(0.08, 0.1, 0.08, -0.13, 0.42, 0, INK2), B(0.08, 0.12, 0.08, 0.13, 0.42, 0.02, INK2),
    B(0.54, 0.05, 0.5, 0, 0, 0, 0x1b1024)]));
  const eyes = mesh([B(0.09, 0.07, 0.03, -0.1, 0.18, 0.23, EYE), B(0.09, 0.07, 0.03, 0.1, 0.18, 0.23, EYE)], MAT_GLOW, false);
  body.add(eyes);
  return { root, body, eyes };
}
export function makeBeetle() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const shell = 0x8a3a2a, shell2 = 0xb24a30;
  body.add(mesh([
    B(0.62, 0.26, 0.7, 0, 0.08, -0.04, 0x3a2a2a), // underside
    B(0.66, 0.2, 0.62, 0, 0.26, -0.06, shell), B(0.5, 0.1, 0.5, 0, 0.46, -0.06, shell2),
    B(0.06, 0.12, 0.06, -0.18, 0.5, -0.1, 0xe8d0a0), B(0.06, 0.14, 0.06, 0.1, 0.52, 0.02, 0xe8d0a0), B(0.06, 0.1, 0.06, 0.02, 0.5, -0.26, 0xe8d0a0),
    // front plate (shell face) - the part that deflects swords
    B(0.7, 0.36, 0.08, 0, 0.06, 0.32, 0x5a2a2a), B(0.5, 0.06, 0.1, 0, 0.36, 0.32, 0xe8d0a0),
    // horn
    B(0.08, 0.08, 0.2, 0, 0.3, 0.44, 0xe8d0a0, -0.4),
    ...[-1, 1].flatMap(s => [B(0.06, 0.06, 0.2, s * 0.34, 0.02, 0.12, 0x2a1a1a), B(0.06, 0.06, 0.2, s * 0.34, 0.02, -0.16, 0x2a1a1a)]),
  ]));
  const eyes = mesh([B(0.07, 0.05, 0.03, -0.14, 0.2, 0.37, 0xd08aff), B(0.07, 0.05, 0.03, 0.14, 0.2, 0.37, 0xd08aff)], MAT_GLOW, false);
  body.add(eyes);
  return { root, body, eyes };
}
export function makePuffer() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  body.add(mesh([B(0.2, 0.2, 0.2, 0, 0, 0, 0xd8c8b0), B(0.14, 0.04, 0.14, 0, 0.2, 0, 0xb8a890)]));
  const sac = pivot([
    B(0.56, 0.42, 0.56, 0, 0, 0, 0x9a6ac0), B(0.46, 0.1, 0.46, 0, 0.42, 0, 0xb88ae0),
    B(0.1, 0.1, 0.02, -0.15, 0.2, 0.28, 0xe0c8ff), B(0.1, 0.1, 0.02, 0.18, 0.1, 0.28, 0xe0c8ff), B(0.12, 0.12, 0.02, 0, 0.26, -0.28, 0xe0c8ff),
    B(0.12, 0.1, 0.1, 0, 0.14, 0.3, 0x3a1a4a), // mouth
  ], 0, 0.22, 0);
  body.add(sac);
  const eyes = mesh([B(0.07, 0.05, 0.03, -0.1, 0.3, 0.29, EYE), B(0.07, 0.05, 0.03, 0.1, 0.3, 0.29, EYE)], MAT_GLOW, false);
  sac.add(eyes);
  return { root, body, sac, eyes };
}
export function makeWisp() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  body.add(mesh([B(0.26, 0.24, 0.3, 0, 0, 0, INK), B(0.18, 0.08, 0.1, 0, 0.1, -0.2, INK2), B(0.06, 0.1, 0.06, -0.07, 0.24, 0.05, INK2), B(0.06, 0.1, 0.06, 0.07, 0.24, 0.05, INK2)]));
  const wingL = pivot([B(0.34, 0.03, 0.22, -0.17, 0, 0, 0x4a3068), B(0.2, 0.02, 0.12, -0.3, 0.02, -0.06, 0x6a48a0)], -0.12, 0.14, 0);
  const wingR = pivot([B(0.34, 0.03, 0.22, 0.17, 0, 0, 0x4a3068), B(0.2, 0.02, 0.12, 0.3, 0.02, -0.06, 0x6a48a0)], 0.12, 0.14, 0);
  body.add(wingL, wingR);
  const eyes = mesh([B(0.2, 0.06, 0.03, 0, 0.12, 0.16, 0xfff3b0)], MAT_GLOW, false);
  body.add(eyes);
  return { root, body, wingL, wingR, eyes };
}
export function makeKnight() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const plate = 0x3a3450, plate2 = 0x544a70, cloth = 0x5a1a3a;
  const legL = pivot([B(0.16, 0.3, 0.18, 0, -0.3, 0, plate)], -0.12, 0.3, 0);
  const legR = pivot([B(0.16, 0.3, 0.18, 0, -0.3, 0, plate)], 0.12, 0.3, 0);
  body.add(legL, legR);
  body.add(mesh([B(0.52, 0.42, 0.34, 0, 0.3, 0, plate2), B(0.56, 0.12, 0.38, 0, 0.62, 0, plate), B(0.4, 0.34, 0.06, 0, 0.18, -0.2, cloth),
    B(0.2, 0.1, 0.4, -0.34, 0.66, 0, plate2), B(0.2, 0.1, 0.4, 0.34, 0.66, 0, plate2)]));
  const head = pivot([B(0.3, 0.3, 0.3, 0, 0, 0, plate), B(0.34, 0.06, 0.34, 0, 0.3, 0, plate2), B(0.06, 0.18, 0.06, 0, 0.34, 0, cloth)], 0, 0.74, 0);
  const visor = mesh([B(0.22, 0.05, 0.03, 0, 0.13, 0.16, 0xff5a8a)], MAT_GLOW, false);
  head.add(visor);
  body.add(head);
  const armR = pivot([B(0.14, 0.34, 0.14, 0, -0.32, 0, plate)], 0.36, 0.64, 0);
  const armL = pivot([B(0.14, 0.34, 0.14, 0, -0.32, 0, plate)], -0.36, 0.64, 0);
  const blade = pivot([B(0.06, 0.14, 0.06, 0, 0, 0, 0x2a1a1a), B(0.24, 0.05, 0.08, 0, 0.12, 0, 0x6a5a7a), B(0.18, 0.8, 0.04, 0, 0.16, 0, 0x8a8aa0), B(0.08, 0.76, 0.045, 0.05, 0.18, 0, 0xc8c8e0)], 0, -0.36, 0.04);
  blade.rotation.x = 1.3;
  armR.add(blade);
  body.add(armR, armL);
  return { root, body, head, armR, armL, legL, legR, blade, eyes: visor };
}
export function makeBoss() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const vine = 0x2e6a2a, vine2 = 0x4a8a3a, thorn = 0xe8d8a0, lip = 0x8a2a5a;
  const bulb = pivot([
    B(1.8, 1.3, 1.7, 0, 0, 0, vine), B(1.5, 0.3, 1.4, 0, 1.3, 0, vine2), B(1.0, 0.2, 1.0, 0, 1.6, 0, vine),
    B(1.95, 0.25, 1.85, 0, 0.5, 0, 0x255a22),
    ...[[-0.9, 0.9, 0.3], [0.9, 0.7, -0.2], [0.3, 1.2, 0.8], [-0.4, 1.4, -0.6], [0.7, 0.3, 0.8], [-0.7, 0.4, -0.8], [0.1, 1.7, 0.1]].map(([x, y, z]) => B(0.12, 0.28, 0.12, x, y, z, thorn, x * 0.5, 0, -x * 0.5)),
  ], 0, 0.2, 0);
  body.add(bulb);
  // mouth: petal ring on the front
  const mouth = pivot([
    B(1.0, 0.18, 0.2, 0, 0.35, 0, lip), B(1.0, 0.18, 0.2, 0, -0.35, 0, lip), B(0.18, 0.8, 0.2, -0.45, -0.3, 0, lip), B(0.18, 0.8, 0.2, 0.45, -0.3, 0, lip),
    B(0.72, 0.52, 0.1, 0, -0.26, -0.05, 0x1a0a14),
  ], 0, 0.75, 0.86);
  bulb.add(mouth);
  const core = mesh([B(0.4, 0.4, 0.2, 0, 0.55, 0.8, 0xff7ab0)], MAT_GLOW, false);
  bulb.add(core);
  const eyes = mesh([B(0.16, 0.12, 0.04, -0.45, 1.05, 0.87, 0xfff3b0), B(0.16, 0.12, 0.04, 0.45, 1.05, 0.87, 0xfff3b0)], MAT_GLOW, false);
  bulb.add(eyes);
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const p = pivot([B(0.5, 0.08, 0.9, 0, 0, 0.45, i % 2 ? 0xc04a7a : 0xe06a9a)], Math.cos(a) * 0.5, 1.75, Math.sin(a) * 0.5);
    p.rotation.y = -a + Math.PI / 2; p.rotation.x = -0.6;
    bulb.add(p); petals.push(p);
  }
  const roots = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3;
    const r = pivot([B(0.24, 0.24, 1.3, 0, 0, 0.6, vine), B(0.18, 0.18, 0.6, 0, 0.05, 1.4, vine2), B(0.08, 0.2, 0.08, 0, 0.2, 0.9, thorn)], Math.cos(a) * 0.8, 0.05, Math.sin(a) * 0.8);
    r.rotation.y = -a + Math.PI / 2;
    body.add(r); roots.push(r);
  }
  return { root, body, bulb, mouth, core, eyes, petals, roots };
}

// ------------------------------------------------------------- PROPS (static, merged)
export const PROPS = {
  oak: () => [B(0.22, 0.6, 0.22, 0, 0, 0, 0x6a4a2a), B(0.9, 0.5, 0.9, 0, 0.55, 0, 0x3f8f3a), B(0.7, 0.35, 0.7, 0, 1.0, 0, 0x4fa546), B(0.4, 0.2, 0.4, 0.05, 1.3, 0.05, 0x63b852), B(0.3, 0.2, 0.3, -0.35, 0.8, 0.3, 0x3a8034)],
  pine: () => [B(0.18, 0.4, 0.18, 0, 0, 0, 0x5a3a22), B(0.9, 0.35, 0.9, 0, 0.35, 0, 0x2f6e3a), B(0.66, 0.35, 0.66, 0, 0.7, 0, 0x377d42), B(0.42, 0.35, 0.42, 0, 1.05, 0, 0x3f8a4a), B(0.18, 0.25, 0.18, 0, 1.4, 0, 0x4a9a52)],
  shroom: () => [B(0.24, 0.7, 0.24, 0, 0, 0, 0xf0e6d0), B(1.0, 0.3, 1.0, 0, 0.7, 0, 0xd04a3a), B(0.7, 0.18, 0.7, 0, 1.0, 0, 0xe05a48), B(0.14, 0.05, 0.14, 0.25, 1.01, 0.2, 0xffffff), B(0.12, 0.05, 0.12, -0.3, 0.95, -0.1, 0xffffff), B(0.1, 0.05, 0.1, 0.05, 1.19, -0.2, 0xffffff)],
  birch: () => [B(0.16, 0.9, 0.16, 0, 0, 0, 0xe8e4d8), B(0.17, 0.05, 0.17, 0, 0.3, 0, 0x3a3a3a), B(0.17, 0.05, 0.17, 0, 0.6, 0, 0x3a3a3a), B(0.8, 0.45, 0.8, 0, 0.8, 0, 0x8ac04a), B(0.5, 0.3, 0.5, 0, 1.2, 0, 0x9ad05a)],
  palm: () => [B(0.16, 0.5, 0.16, 0, 0, 0, 0x9a7a4a), B(0.16, 0.5, 0.16, 0.05, 0.5, 0, 0xa8884a), B(1.0, 0.06, 0.2, 0.05, 1.0, 0, 0x4a9a3a), B(0.2, 0.06, 1.0, 0.05, 1.0, 0, 0x4a9a3a), B(0.3, 0.2, 0.3, 0.05, 0.9, 0, 0x6a4a2a)],
  cactus: () => [B(0.24, 0.8, 0.24, 0, 0, 0, 0x4a9a4a), B(0.14, 0.3, 0.14, 0.2, 0.3, 0, 0x4a9a4a), B(0.14, 0.2, 0.14, 0.28, 0.5, 0, 0x5aaa5a), B(0.14, 0.3, 0.14, -0.2, 0.4, 0, 0x4a9a4a), B(0.1, 0.1, 0.1, 0, 0.82, 0, 0xf08ab0)],
  deadtree: () => [B(0.2, 0.9, 0.2, 0, 0, 0, 0x3a2a2a), B(0.4, 0.08, 0.08, 0.15, 0.6, 0, 0x3a2a2a, 0, 0, 0.5), B(0.08, 0.3, 0.08, -0.12, 0.7, 0, 0x3a2a2a, 0, 0, 0.5)],
  bush: () => [B(0.6, 0.36, 0.6, 0, 0, 0, 0x3f9a3a), B(0.44, 0.14, 0.44, 0, 0.36, 0, 0x55b24a), B(0.08, 0.06, 0.08, 0.15, 0.36, 0.2, 0xf05a6a), B(0.08, 0.06, 0.08, -0.18, 0.3, -0.1, 0xf05a6a)],
  tuft: () => [B(0.06, 0.2, 0.04, -0.1, 0, 0, 0x7ccb52, 0, 0, 0.3), B(0.06, 0.26, 0.04, 0, 0, 0.05, 0x8ad85a), B(0.06, 0.2, 0.04, 0.1, 0, -0.03, 0x6fbf4a, 0, 0, -0.3)],
  flower: () => [B(0.03, 0.14, 0.03, 0, 0, 0, 0x4a9a3a), B(0.1, 0.05, 0.1, 0, 0.14, 0, 0xffffff), B(0.04, 0.05, 0.04, 0, 0.16, 0, 0xffd25e)],
  flowerR: () => [B(0.03, 0.16, 0.03, 0, 0, 0, 0x4a9a3a), B(0.1, 0.06, 0.1, 0, 0.16, 0, 0xf06a8a)],
  flowerB: () => [B(0.03, 0.12, 0.03, 0, 0, 0, 0x4a9a3a), B(0.09, 0.05, 0.09, 0, 0.12, 0, 0x7aa8ff)],
  pebble: () => [B(0.3, 0.14, 0.24, 0, 0, 0, 0x9a948a), B(0.18, 0.08, 0.16, 0.05, 0.14, 0, 0xaaa49a)],
  stake: () => [B(0.22, 0.9, 0.22, 0, 0, 0, 0x5a3a2a), B(0.14, 0.2, 0.14, 0, 0.9, 0, 0x7a5a3a), B(0.26, 0.08, 0.26, 0, 0.5, 0, 0x2a1a3a)],
  fence: () => [B(0.12, 0.5, 0.12, -0.35, 0, 0, 0x8a6a4a), B(0.12, 0.5, 0.12, 0.35, 0, 0, 0x8a6a4a), B(0.9, 0.08, 0.06, 0, 0.3, 0, 0xa8845a), B(0.9, 0.08, 0.06, 0, 0.12, 0, 0xa8845a)],
  lavaRock: () => [B(0.5, 0.3, 0.5, 0, 0, 0, 0x3a2a2a), B(0.2, 0.1, 0.2, 0.1, 0.3, 0, 0xff6a2a)],
  reed: () => [B(0.04, 0.4, 0.04, 0, 0, 0, 0x5a8a3a), B(0.04, 0.3, 0.04, 0.08, 0, 0.05, 0x6a9a4a), B(0.05, 0.1, 0.05, 0, 0.4, 0, 0x6a4a2a)],
  bone: () => [B(0.5, 0.1, 0.1, 0, 0, 0, 0xe8e0d0), B(0.12, 0.12, 0.2, 0.25, 0, 0, 0xe8e0d0), B(0.12, 0.12, 0.2, -0.25, 0, 0, 0xe8e0d0)],
  roots: () => [B(0.7, 0.14, 0.18, 0, 0, 0, 0x5a4030, 0, 0.4), B(0.18, 0.12, 0.6, 0.2, 0, 0.1, 0x6a4a36, 0, 0.3), B(0.1, 0.1, 0.1, -0.3, 0.12, 0.1, 0x7fd36a)],
  crystal: () => [B(0.14, 0.4, 0.14, 0, 0, 0, 0x9a7aff, 0, 0, 0.2), B(0.1, 0.26, 0.1, 0.12, 0, 0.05, 0xb89aff, 0, 0, -0.3)],
};

export function decoModel(d) {
  const P = [];
  const w = d.w, dd = d.d;
  switch (d.model) {
    case 'house': {
      const r = d.roof || 0xc0503a, wall = 0xf2e2c0, wood = 0x7a5a3a;
      const W = w - 0.2, D = dd - 0.3, H = d.big ? 1.3 : d.small ? 0.9 : 1.1;
      P.push(B(W, 0.12, D, 0, 0, 0, 0x8a7a6a), B(W - 0.1, H, D - 0.1, 0, 0.1, 0, wall));
      for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) P.push(B(0.1, H, 0.1, x, 0.1, D / 2 - 0.05, wood), B(0.1, H, 0.1, x, 0.1, -D / 2 + 0.05, wood));
      P.push(B(W, 0.1, D, 0, H * 0.55, 0, wood));
      // roof stack
      for (let i = 0; i < 4; i++) P.push(B(W + 0.3 - i * (W * 0.24), 0.22, D + 0.3, 0, H + 0.1 + i * 0.22, 0, i % 2 ? r : new THREE.Color(r).multiplyScalar(0.85).getHex()));
      P.push(B(0.3, 0.6, 0.3, W * 0.25, H + 0.4, -0.2, 0x8a6a5a));
      P.push(B(0.34, 0.6, 0.06, 0, 0.1, D / 2, 0x6a4a2a), B(0.06, 0.06, 0.04, 0.1, 0.4, D / 2 + 0.03, 0xffd25e));
      P.push(B(0.3, 0.26, 0.06, -W / 2 + 0.45, 0.45, D / 2, 0x7ab8e8), B(0.3, 0.26, 0.06, W / 2 - 0.45, 0.45, D / 2, 0x7ab8e8));
      P.push(B(0.36, 0.06, 0.1, -W / 2 + 0.45, 0.36, D / 2 + 0.05, 0xf06a8a), B(0.36, 0.06, 0.1, W / 2 - 0.45, 0.36, D / 2 + 0.05, 0xffd25e));
      break;
    }
    case 'shop': {
      const r = d.roof;
      P.push(B(w - 0.2, 0.12, dd - 0.3, 0, 0, 0, 0x8a7a6a), B(w - 0.4, 1.1, dd - 0.6, 0, 0.1, -0.1, 0xf2e2c0));
      P.push(B(w - 0.1, 0.4, 0.6, 0, 0.1, dd / 2 - 0.3, 0x9a6a3a), B(w - 0.1, 0.06, 0.66, 0, 0.5, dd / 2 - 0.3, 0xc08a4a));
      for (let i = 0; i < 6; i++) P.push(B((w) / 6, 0.08, 0.9, -w / 2 + (i + 0.5) * w / 6, 1.05, dd / 2 - 0.25, i % 2 ? 0xffffff : r, 0.35));
      P.push(B(w, 0.25, dd, 0, 1.2, -0.2, r), B(w - 0.8, 0.25, dd - 0.6, 0, 1.45, -0.2, 0xffffff));
      P.push(B(0.2, 0.2, 0.2, -0.8, 0.52, dd / 2 - 0.3, 0xe8424f), B(0.16, 0.22, 0.16, -0.4, 0.52, dd / 2 - 0.3, 0xffd25e), B(0.2, 0.14, 0.2, 0.5, 0.52, dd / 2 - 0.3, 0x7fd36a), B(0.22, 0.3, 0.06, 1.0, 0.5, dd / 2 - 0.3, 0xc0c0d0));
      P.push(B(0.5, 0.3, 0.05, 0, 1.3, dd / 2 + 0.05, 0x3a2a1a), B(0.12, 0.12, 0.06, 0, 1.33, dd / 2 + 0.07, 0xffd25e));
      break;
    }
    case 'belltower': {
      const s = 0xc8bca8, s2 = 0xa89c88;
      P.push(B(1.9, 0.3, 1.9, 0, 0, 0, s2), B(1.6, 1.4, 1.6, 0, 0.3, 0, s));
      for (const [x, z] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) P.push(B(0.3, 1.3, 0.3, x, 1.7, z, s));
      P.push(B(1.9, 0.3, 1.9, 0, 3.0, 0, s2), B(1.4, 0.3, 1.4, 0, 3.3, 0, 0x5a7ac0), B(0.9, 0.3, 0.9, 0, 3.6, 0, 0x4a6ab0), B(0.4, 0.4, 0.4, 0, 3.9, 0, 0x3a5aa0), B(0.1, 0.3, 0.1, 0, 4.3, 0, 0xffd25e));
      P.push(B(0.5, 0.7, 0.08, 0, 0.3, 0.8, 0x5a3a2a));
      // three sockets on the plinth
      [-0.5, 0, 0.5].forEach(x => P.push(B(0.26, 0.26, 0.06, x, 1.0, 0.82, 0x3a3050)));
      break;
    }
    case 'windmill': {
      P.push(B(1.6, 0.2, 1.6, 0, 0, 0, 0x8a7a6a), B(1.4, 1.4, 1.4, 0, 0.2, 0, 0xe8d8b8), B(1.1, 1.0, 1.1, 0, 1.6, 0, 0xdccca8), B(1.3, 0.3, 1.3, 0, 2.6, 0, 0xa04a3a), B(0.8, 0.3, 0.8, 0, 2.9, 0, 0xb85a48), B(0.3, 0.3, 0.3, 0, 3.2, 0, 0xa04a3a));
      P.push(B(0.4, 0.6, 0.06, 0, 0.2, 0.72, 0x6a4a2a));
      break;
    }
    case 'well': P.push(B(0.9, 0.4, 0.9, 0, 0, 0, 0xa8a090), B(0.7, 0.05, 0.7, 0, 0.36, 0, 0x2a5a7a), B(0.08, 0.7, 0.08, -0.4, 0.4, 0, 0x6a4a2a), B(0.08, 0.7, 0.08, 0.4, 0.4, 0, 0x6a4a2a), B(1.0, 0.18, 0.7, 0, 1.1, 0, 0xc0503a), B(0.1, 0.16, 0.1, 0, 0.7, 0, 0x8a6a4a)); break;
    case 'fence': P.push(...PROPS.fence()); break;
    case 'tent': P.push(B(1.6, 0.6, 1.6, 0, 0, 0, 0x4a2a4a), B(1.2, 0.4, 1.4, 0, 0.6, 0, 0x5a3050), B(0.6, 0.3, 1.2, 0, 1.0, 0, 0x6a3a60), B(0.4, 0.5, 0.06, 0, 0, 0.8, 0x1a0a1a), B(0.06, 0.6, 0.06, 0, 1.2, 0, 0x2a1a1a), B(0.3, 0.2, 0.03, 0.15, 1.6, 0, 0x8b5cf6)); break;
    case 'hollowtree': {
      const bark = 0x6a4a30, bark2 = 0x5a3e28;
      P.push(B(4.4, 2.4, 3.4, 0, 0, 0, bark), B(4.0, 1.2, 3.0, 0, 2.4, 0, bark2), B(3.2, 1.0, 2.6, 0.2, 3.6, 0, bark));
      P.push(B(1.1, 1.3, 0.3, 0, 0, 1.6, 0x0c0812), B(1.4, 0.2, 0.34, 0, 1.3, 1.6, bark2));
      for (const [x, z, s] of [[-1.5, 0.5, 1], [1.4, -0.4, 1], [0, 0, 1.3]]) P.push(B(2.6 * s, 1.0, 2.4 * s, x, 4.4, z, 0x2f7a34), B(1.8 * s, 0.8, 1.6 * s, x, 5.3, z, 0x3f8f3a), B(1.0 * s, 0.5, 0.9 * s, x, 6.0, z, 0x4fa546));
      for (const [x, z, r] of [[-2.2, 1.4, 0.6], [2.2, 1.3, -0.6], [-1.2, 1.9, 0.2], [1.3, 1.9, -0.2]]) P.push(B(0.4, 0.4, 1.2, x, 0, z, bark2, 0, r));
      P.push(B(0.6, 0.12, 0.1, -0.7, 1.7, 1.72, 0x7fd36a), B(0.3, 0.1, 0.1, 0.8, 0.9, 1.72, 0x7fd36a));
      break;
    }
    case 'chimegate': {
      const s = 0x9a9ab0, s2 = 0x7a7a90;
      P.push(B(7, 3.4, 1.6, 0, 0, -0.2, s2), B(7.4, 0.5, 2.0, 0, 3.4, -0.2, s), B(5, 0.6, 1.6, 0, 3.9, -0.2, s2), B(2.4, 1.2, 1.4, 0, 4.5, -0.2, s));
      P.push(B(2.2, 2.8, 0.2, 0, 0, 0.62, 0x2a2438), B(2.4, 0.2, 0.3, 0, 2.8, 0.62, 0xffd25e));
      for (const x of [-3.2, 3.2]) P.push(B(0.8, 4.2, 0.8, x, 0, 0.5, s), B(1.0, 0.3, 1.0, x, 4.2, 0.5, s2));
      break;
    }
    case 'shrine': P.push(B(1.6, 0.3, 1.6, 0, 0, 0, 0xc8d8e8), B(0.3, 1.4, 0.3, -0.6, 0.3, -0.6, 0xb8c8d8), B(0.3, 1.4, 0.3, 0.6, 0.3, -0.6, 0xb8c8d8), B(0.3, 1.4, 0.3, -0.6, 0.3, 0.6, 0xb8c8d8), B(0.3, 1.4, 0.3, 0.6, 0.3, 0.6, 0xb8c8d8), B(1.8, 0.3, 1.8, 0, 1.7, 0, 0x5a9ae0), B(0.6, 0.6, 0.6, 0, 0.5, 0, 0x7ad8ff)); break;
  }
  return P;
}
