// World pass models: the new Thimblewick, the Clockwork Garden and the Rootlight Caverns.
// Same voxel-box language as models.js (B = box resting on y). Kept in its own module so the
// shared model file only gains one additive hook (decoModel / decoGlow fall back to these).
import { B } from '../models.js';

const BARK = 0x6a4a30, BARK2 = 0x5a3e28, LEAF = [0x3f8a3a, 0x4f9a42, 0x5fae4c, 0x74c05a];
const BRONZE = 0xb88a3a, BRONZE2 = 0x8a6428, VERD = 0x5fa894, BRASS = 0xd8aa4a, IRON = 0x4a4a52, RUST = 0x9a5a34;

// deterministic jitter from the def's own position (no Math.random: geometry must be stable)
const jit = (d, k) => { const s = Math.sin((d.x || 0) * 12.9898 + (d.z || 0) * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };

function canopy(P, cx, cy, cz, r, d, k0 = 0) {
  // a stacked, layered crown of leaves: wide low skirt, rounded middle, small crown
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + jit(d, k0 + i) * 0.6, rr = r * (0.45 + jit(d, k0 + i + 9) * 0.25);
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, s = r * (0.55 + jit(d, k0 + i + 20) * 0.2);
    P.push(B(s * 1.3, 0.9, s * 1.2, x, cy + jit(d, k0 + i + 30) * 0.5, z, LEAF[i % 3]));
  }
  P.push(B(r * 1.5, 1.2, r * 1.4, cx, cy + 0.5, cz, LEAF[1]), B(r * 1.1, 1.0, r, cx, cy + 1.5, cz, LEAF[2]), B(r * 0.6, 0.7, r * 0.55, cx, cy + 2.4, cz, LEAF[3]));
}

export function worldModel(d) {
  const P = [], w = d.w || 1, dd = d.d || 1;
  switch (d.model) {
    // ---------------------------------------------------------------- Thimblewick
    case 'belltreegrand': { // the old bell tower, now held in the roots of an enormous tree
      const s = 0xc8bca8, s2 = 0xa89c88;
      P.push(B(1.9, 0.3, 1.9, 0, 0, 0, s2), B(1.6, 1.4, 1.6, 0, 0.3, 0, s));
      for (const [x, z] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) P.push(B(0.3, 1.3, 0.3, x, 1.7, z, s));
      P.push(B(1.9, 0.3, 1.9, 0, 3.0, 0, s2));
      [-0.5, 0, 0.5].forEach(x => P.push(B(0.26, 0.26, 0.06, x, 1.0, 0.82, 0x3a3050)));
      P.push(B(0.5, 0.7, 0.08, 0, 0.3, 0.8, 0x5a3a2a));
      // the trunk rises behind the tower and swallows its top
      P.push(B(1.4, 3.6, 1.2, 0, 0, -1.3, BARK), B(1.2, 2.4, 1.1, 0.1, 3.3, -1.0, BARK2), B(1.6, 1.0, 1.4, 0, 5.6, -0.8, BARK));
      // roots gripping the plinth and running out across the plaza
      for (const [x, z, ry, l] of [[-1.3, -0.9, 0.5, 1.6], [1.3, -0.9, -0.5, 1.6], [-1.1, 0.2, 1.2, 1.3], [1.1, 0.2, -1.2, 1.3], [0, -2.1, 0, 1.4]]) P.push(B(l, 0.45, 0.45, x, 0, z, BARK2, 0, ry));
      // great branches reaching over the square
      for (const [x, y, z, rz, ry, l] of [[-2.2, 5.6, -0.6, 0.35, 0.2, 3.4], [2.3, 5.5, -0.5, -0.35, -0.2, 3.4], [0, 5.8, 1.4, 0, 1.57, 2.8], [-1.4, 6.3, -2.2, 0.2, -0.6, 2.4], [1.5, 6.2, -2.1, -0.2, 0.6, 2.4]]) P.push(B(l, 0.55, 0.55, x, y, z, BARK, 0, ry, rz));
      canopy(P, 0, 6.3, -0.6, 4.6, d, 1);
      // little bells and lanterns hung from the lowest boughs
      for (const [x, z, bell] of [[-3.1, 0.4, 1], [3.0, 0.6, 1], [-1.8, 2.4, 0], [1.9, 2.3, 0], [0.4, 3.0, 1], [-3.3, -2.0, 0], [3.2, -1.9, 0]]) {
        P.push(B(0.03, 1.1, 0.03, x, 4.5, z, 0x3a2a1a));
        if (bell) P.push(B(0.36, 0.3, 0.36, x, 4.2, z, BRONZE), B(0.46, 0.08, 0.46, x, 4.15, z, BRASS));
        else P.push(B(0.3, 0.36, 0.3, x, 4.15, z, 0xffd28a), B(0.34, 0.06, 0.34, x, 4.5, z, 0x5a3a2a));
      }
      break;
    }
    case 'marketstall': { // a trestle counter under a striped awning
      const c = d.awning || 0xc0503a, c2 = 0xf0e6d0, W = w - 0.2;
      P.push(B(W, 0.55, dd * 0.55, 0, 0, 0.05, 0x9a6e44), B(W + 0.1, 0.08, dd * 0.6, 0, 0.55, 0.05, 0xb88a5a));
      for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) P.push(B(0.08, 1.55, 0.08, x, 0, -dd * 0.3, 0x6a4a2a), B(0.08, 1.35, 0.08, x, 0, dd * 0.3, 0x6a4a2a));
      const n = Math.max(3, Math.round(W / 0.3));
      for (let i = 0; i < n; i++) P.push(B(W / n + 0.01, 0.1, dd * 0.95, -W / 2 + (i + 0.5) * W / n, 1.5, 0, i % 2 ? c : c2, 0.25));
      for (let i = 0; i < n; i++) P.push(B(W / n + 0.01, 0.16, 0.05, -W / 2 + (i + 0.5) * W / n, 1.32, dd * 0.48, i % 2 ? c : c2));
      const goods = d.goods || 'veg', G = { veg: [0xe06a3a, 0x7ab84a, 0xf0c040], cloth: [0x6a8ac0, 0xc06a9a, 0xe8d8a8], pots: [0xc07a52, 0xa86040, 0xd8c8b0], fish: [0x9ab8c8, 0x7a98a8, 0xc8d8e0] }[goods] || [0xe06a3a];
      for (let i = 0; i < 4; i++) P.push(B(0.22, 0.14 + (i % 2) * 0.06, 0.22, -W / 2 + 0.3 + i * (W - 0.6) / 3, 0.63, 0.05, G[i % G.length]));
      break;
    }
    case 'footbridge': { // plank bridge with rope rails, spanning along x (w) or z when d.rz
      const L = w, Wd = 0xa87a4a, Wd2 = 0x8a6038;
      for (let i = 0; i < Math.round(L / 0.36); i++) P.push(B(0.32, 0.09, dd * 0.9, -L / 2 + 0.18 + i * 0.36, 0.02 + Math.sin((i + 0.5) / Math.round(L / 0.36) * Math.PI) * 0.12, 0, i % 3 ? Wd : Wd2));
      for (const z of [-dd * 0.45, dd * 0.45]) { for (const x of [-L / 2 + 0.1, 0, L / 2 - 0.1]) P.push(B(0.1, 0.6, 0.1, x, 0.05, z, 0x6a4a2a)); P.push(B(L, 0.05, 0.05, 0, 0.58, z, 0xc8b088)); }
      break;
    }
    case 'signpost': { // a leaning post with arrow boards
      P.push(B(0.12, 1.5, 0.12, 0, 0, 0, 0x6a4a2a));
      (d.arms || [0, 1.6]).forEach((ry, i) => P.push(B(0.7, 0.18, 0.05, 0.25, 1.2 - i * 0.26, 0, [0xd8b878, 0xc8a868, 0xe0c890][i % 3], 0, ry)));
      P.push(B(0.18, 0.1, 0.18, 0, 1.5, 0, 0x5a3a2a));
      break;
    }
    case 'hedge': { // a clipped hedge section (w x d), with a rounded top
      P.push(B(w, 0.85, dd, 0, 0, 0, 0x3f7f3a), B(w - 0.1, 0.25, dd - 0.1, 0, 0.85, 0, 0x4f9444));
      for (let i = 0; i < Math.round(w * 2); i++) P.push(B(0.12, 0.1, 0.12, -w / 2 + 0.25 + i * 0.5, 0.95 + jit(d, i) * 0.1, (jit(d, i + 5) - 0.5) * dd * 0.6, 0x6ab85a));
      break;
    }
    case 'gazebo': { // a white lattice summerhouse
      const Wh = 0xf0ece0, R = d.roof || 0x5a8a9a;
      P.push(B(w - 0.2, 0.2, dd - 0.2, 0, 0, 0, 0xc8bca8));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(B(0.12, 1.6, 0.12, x * (w / 2 - 0.35), 0.2, z * (dd / 2 - 0.35), Wh));
      P.push(B(w - 0.3, 0.12, dd - 0.3, 0, 1.8, 0, Wh), B(w, 0.3, dd, 0, 1.9, 0, R), B(w * 0.7, 0.3, dd * 0.7, 0, 2.2, 0, R), B(w * 0.35, 0.3, dd * 0.35, 0, 2.5, 0, R), B(0.1, 0.4, 0.1, 0, 2.8, 0, BRASS));
      P.push(B(1.2, 0.1, 0.4, 0, 0.55, -dd / 2 + 0.5, 0x96704b), B(1.2, 0.35, 0.08, 0, 0.62, -dd / 2 + 0.34, 0x96704b));
      break;
    }
    case 'planter': { // a window-box of flowers
      P.push(B(w, 0.3, 0.45, 0, 0, 0, 0x8a5a3a));
      for (let i = 0; i < Math.round(w * 3); i++) P.push(B(0.14, 0.2, 0.14, -w / 2 + 0.17 + i * 0.33, 0.3, 0, [0xe05a8a, 0xf0c040, 0xb08aff, 0xf07a5a][i % 4]));
      break;
    }
    case 'barrels': P.push(B(0.5, 0.6, 0.5, -0.3, 0, 0, 0x9a6a3a), B(0.54, 0.06, 0.54, -0.3, 0.45, 0, 0x5a4a3a), B(0.45, 0.55, 0.45, 0.3, 0, 0.1, 0x8a5a30), B(0.5, 0.35, 0.5, 0.05, 0.6, -0.1, 0xa87a4a)); break;
    case 'welcomearch': { // the arrival arch: two posts and a painted board
      const Wd = 0x8a6038;
      for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) P.push(B(0.3, 2.3, 0.3, x, 0, 0, Wd), B(0.4, 0.2, 0.4, x, 2.3, 0, 0x6a4a2a));
      P.push(B(w, 0.5, 0.12, 0, 1.9, 0, 0xe8d6a8), B(w + 0.2, 0.1, 0.18, 0, 2.4, 0, Wd), B(w + 0.2, 0.1, 0.18, 0, 1.85, 0, Wd));
      P.push(B(0.3, 0.3, 0.14, 0, 2.02, 0.03, BRONZE), B(0.12, 0.3, 0.02, -w * 0.3, 2.0, 0.07, 0x3a2a1a), B(0.12, 0.3, 0.02, w * 0.3, 2.0, 0.07, 0x3a2a1a));
      for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) P.push(B(0.2, 0.5, 0.2, x, 1.3, 0.25, 0x4f9a42), B(0.18, 0.12, 0.18, x, 1.8, 0.25, 0xe05a8a));
      break;
    }
    case 'rootlift': { // a rusted lift cage in a knot of roots
      P.push(B(2.2, 0.35, 2.0, 0, 0, 0, BARK2), B(1.4, 0.08, 1.4, 0, 0.35, 0, 0x2a1e14));
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) P.push(B(0.08, 1.9, 0.08, x, 0.35, z, RUST));
      P.push(B(1.34, 0.08, 1.34, 0, 2.25, 0, RUST), B(0.3, 0.3, 0.3, 0, 2.33, 0, IRON), B(0.05, 1.2, 0.05, 0, 2.6, 0, 0x8a8a90));
      for (const [x, z, ry, rz] of [[-0.9, 0.4, 0.3, 0.9], [0.9, -0.2, -0.4, -0.9], [0.2, 1.0, 1.3, 0.6], [-0.4, -1.0, 1.0, -0.7]]) P.push(B(1.6, 0.35, 0.35, x, 0.8, z, BARK, 0, ry, rz));
      P.push(B(0.6, 0.4, 0.5, 0.9, 1.6, 0.6, 0x4f8a3a));
      break;
    }
    // ---------------------------------------------------------------- the Clockwork Garden
    case 'clockface': { // an enormous clock standing against the hedge: stone case, ivory face, bronze rim
      const S = 0xc8bca8, S2 = 0xa89c88, IV = 0xf2ead6, R = 9;
      P.push(B(w, 1.2, dd, 0, 0, 0, S2), B(w - 1, 0.6, dd - 0.6, 0, 1.2, 0, S));
      P.push(B(w * 0.72, 11.5, 1.6, 0, 1.8, -0.8, S), B(w * 0.8, 0.6, 1.9, 0, 13.3, -0.8, S2), B(w * 0.4, 0.8, 1.6, 0, 13.9, -0.8, S), B(1.2, 1.4, 1.2, 0, 14.7, -0.8, BRONZE));
      // the face: a disc of stacked slabs, then twelve bronze hour marks around it
      const cy = 7.6;
      for (let i = -R; i <= R; i++) { const hw = Math.sqrt(Math.max(0, R * R - i * i)) * 0.62; if (hw < 0.2) continue; P.push(B(hw * 2, 0.62, 0.3, 0, cy + i * 0.6 - 0.31, 0.05, (i + R) % 7 ? IV : 0xe8dcc4)); }
      for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, rr = R * 0.6 + 0.3; P.push(B(0.34, 0.34, 0.22, Math.sin(a) * rr, cy + Math.cos(a) * rr - 0.17, 0.25, k % 2 ? BRONZE : BRONZE2)); }
      for (let hr = 0; hr < 12; hr++) { const a = hr / 12 * Math.PI * 2, rr = R * 0.6 - 0.8; P.push(B(hr % 3 ? 0.2 : 0.36, hr % 3 ? 0.55 : 0.9, 0.12, Math.sin(a) * rr, cy + Math.cos(a) * rr - (hr % 3 ? 0.27 : 0.45), 0.25, 0x2a2438, 0, 0, -a)); }
      P.push(B(0.9, 0.9, 0.3, 0, cy - 0.45, 0.3, BRONZE));
      // ivy climbing the case, a crack across the face
      for (const [x, y] of [[-6, 2.2], [-5.6, 3.4], [-6.2, 4.8], [5.8, 2.6], [6.1, 4.0]]) P.push(B(0.9, 0.9, 0.3, x, y, 0.05, 0x4f8a3a));
      P.push(B(3.2, 0.1, 0.05, 2.2, cy + 2.4, 0.22, 0x8a7e66, 0, 0, 0.6));
      break;
    }
    case 'fallenhand': { // the clock's minute hand, fallen across the lawn (lies along x)
      P.push(B(w, 0.45, 0.6, 0, 0, 0, IRON), B(w * 0.9, 0.1, 0.5, 0, 0.45, 0, 0x5a5a64));
      P.push(B(1.4, 0.45, 1.4, w / 2 - 0.5, 0, 0, IRON, 0, 0.78), B(0.9, 0.5, 0.9, -w / 2 + 0.3, 0, 0, BRONZE));
      for (const x of [-w * 0.2, w * 0.15]) P.push(B(0.5, 0.2, 0.7, x, 0.4, 0, 0x4f8a3a));
      break;
    }
    case 'topiary': { // clipped shapes sitting on hedges: 0 ball, 1 cone, 2 twist
      const G = 0x4f9444, G2 = 0x5fae4c;
      if ((d.shape || 0) === 0) P.push(B(0.8, 0.7, 0.8, 0, 0, 0, G), B(0.6, 0.3, 0.6, 0, 0.7, 0, G2));
      else if (d.shape === 1) P.push(B(0.9, 0.5, 0.9, 0, 0, 0, G), B(0.6, 0.5, 0.6, 0, 0.5, 0, G2), B(0.3, 0.4, 0.3, 0, 1.0, 0, G));
      else for (let i = 0; i < 4; i++) P.push(B(0.7 - i * 0.12, 0.3, 0.7 - i * 0.12, 0, i * 0.32, 0, i % 2 ? G2 : G, 0, i * 0.5));
      break;
    }
    case 'biggear': { // a giant gear half sunk in the ground, tilted, rusting
      const r = w * 0.5, t = d.tilt || 0;
      P.push(B(w * 0.72, 0.5, dd * 0.72, 0, 0, 0, RUST, t * 0.2, 0, t * 0.15));
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.push(B(0.6, 0.5, 0.6, Math.cos(a) * r * 0.86, 0.05 + Math.sin(a) * t * 0.3, Math.sin(a) * r * 0.86, i % 3 ? RUST : BRONZE2, 0, -a)); }
      P.push(B(0.7, 0.9, 0.7, 0, 0, 0, BRONZE), B(0.3, 0.3, 0.3, 0, 0.9, 0, BRASS));
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; P.push(B(r * 0.8, 0.22, 0.3, Math.cos(a) * r * 0.4, 0.4, Math.sin(a) * r * 0.4, RUST, 0, -a)); }
      break;
    }
    case 'bronzeframe': { // a verdigris bronze gantry the three bells hang from
      for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) P.push(B(0.5, 3.4, 0.5, x, 0, 0, BRONZE2), B(0.8, 0.3, 0.8, x, 0, 0, VERD));
      P.push(B(w, 0.4, 0.6, 0, 3.4, 0, BRONZE), B(w - 0.4, 0.14, 0.7, 0, 3.8, 0, VERD));
      for (let i = 0; i < 3; i++) P.push(B(0.05, 0.9, 0.05, -3 + i * 3, 2.6, 0, 0x3a2a1a));
      P.push(B(1.6, 0.9, 0.12, 0, 3.95, 0, BRONZE2), B(1.2, 0.1, 0.14, 0, 4.25, 0.01, BRASS));
      break;
    }
    case 'gearhouse': { // a tinker's workshop: timber and brass, with a gear turning on the roof
      const Wd = 0xb88a5a, wall = 0xe8dcc0, W = w - 0.2, D = dd - 0.3;
      P.push(B(W, 1.5, D, 0, 0, 0, wall), B(W + 0.3, 0.5, D + 0.4, 0, 1.5, 0, 0x7a5a3a), B(W * 0.8, 0.5, D * 0.7, 0, 2.0, 0, 0x8a6a44), B(W * 0.5, 0.4, D * 0.4, 0, 2.5, 0, 0x7a5a3a));
      P.push(B(0.9, 1.1, 0.1, -W * 0.2, 0, D / 2 + 0.03, 0x5a3a2a), B(0.7, 0.5, 0.06, W * 0.2, 0.6, D / 2 + 0.03, 0x9ad8ff), B(0.7, 0.5, 0.06, W * 0.36, 0.6, D / 2 + 0.03, 0x9ad8ff));
      for (const x of [-W / 2, W / 2]) P.push(B(0.2, 1.5, 0.2, x, 0, D / 2, Wd));
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push(B(0.3, 0.3, 0.14, W * 0.3 + Math.cos(a) * 0.8, 3.3 + Math.sin(a) * 0.8, 0, BRONZE)); }
      P.push(B(0.5, 0.5, 0.2, W * 0.3, 3.05, 0, BRASS), B(0.2, 1.0, 0.2, W * 0.3, 2.3, 0, IRON));
      break;
    }
    // ---------------------------------------------------------------- the Rootlight Caverns
    case 'hangingroots': { // roots dangling from the cave roof, ending in pale feelers
      for (let i = 0; i < 6; i++) { const x = (jit(d, i) - 0.5) * w, z = (jit(d, i + 7) - 0.5) * dd, L = 1.6 + jit(d, i + 3) * 2; P.push(B(0.18, L, 0.18, x, 4.4 - L, z, i % 2 ? BARK : BARK2), B(0.1, 0.3, 0.1, x, 4.1 - L, z, 0xd8d0b0)); }
      P.push(B(w, 0.3, dd, 0, 4.4, 0, 0x2a2c36));
      break;
    }
    case 'crystalcluster': { // a spray of glassy crystals growing from the rock
      const s = d.s || 1;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + jit(d, i), r = 0.25 * s; P.push(B(0.22 * s, (0.8 + jit(d, i + 4) * 0.8) * s, 0.22 * s, Math.cos(a) * r, 0, Math.sin(a) * r, 0x5a8aa8, Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4)); }
      P.push(B(0.6 * s, 0.25, 0.6 * s, 0, 0, 0, 0x3a3c48));
      break;
    }
    // ---------------------------------------------------------------- region entrances
    case 'clockgate': { // a hedge arch with a giant gear half-buried beside it and a clock hand
      P.push(B(1.2, 2.4, 1.2, -w / 2 + 0.6, 0, 0, 0x3f7f3a), B(1.2, 2.4, 1.2, w / 2 - 0.6, 0, 0, 0x3f7f3a), B(w, 0.9, 1.3, 0, 2.3, 0, 0x4f9444), B(w - 0.6, 0.35, 1.0, 0, 3.2, 0, 0x5fae4c));
      P.push(B(w - 2.4, 2.3, 0.08, 0, 0, 0.1, 0x1c2a18));
      // the gear: a bronze disc with teeth, tilted into the hedge
      const gx = w / 2 + 0.6;
      P.push(B(0.3, 2.2, 2.2, gx, 0, 0, BRONZE2, 0.3));
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.push(B(0.34, 0.34, 0.34, gx, 1.1 + Math.sin(a) * 1.2 - 0.17, Math.cos(a) * 1.2, BRONZE, 0.3)); }
      P.push(B(0.36, 0.6, 0.6, gx, 0.8, 0, BRASS));
      // a clock hand leaning against the arch
      P.push(B(0.2, 3.4, 0.12, -w / 2 - 0.3, 0, 0.5, IRON, 0, 0, 0.35), B(0.5, 0.5, 0.12, -w / 2 - 0.3 + 1.1, 2.8, 0.5, IRON, 0, 0, 0.35));
      P.push(B(0.9, 0.12, 0.05, 0, 3.45, 0.66, BRONZE));
      break;
    }
    case 'rootmouth': { // a sinkhole among giant roots, faint light breathing up from below
      P.push(B(w, 0.25, dd, 0, 0, 0, 0x4a3a2a), B(w - 1.2, 0.05, dd - 1.2, 0, 0.25, 0, 0x0a0806));
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = Math.min(w, dd) * 0.45; P.push(B(1.8, 0.55, 0.55, Math.cos(a) * r, 0.1 + (i % 3) * 0.2, Math.sin(a) * r, i % 2 ? BARK : BARK2, 0, -a + 0.4, (i % 2 ? 0.25 : -0.2))); }
      P.push(B(0.6, 2.4, 0.6, -w / 2 + 0.4, 0, -dd / 2 + 0.4, BARK2, 0, 0, 0.3), B(2.4, 0.5, 0.5, -w / 2 + 1.4, 2.1, -dd / 2 + 0.4, BARK, 0, 0.3, -0.2));
      for (const [x, z] of [[-0.8, 0.9], [1.0, -0.6], [0.2, 1.3]]) P.push(B(0.12, 0.3, 0.12, x, 0.25, z, 0xe8e0c0), B(0.3, 0.12, 0.3, x, 0.55, z, 0x6ad8c8));
      break;
    }
  }
  return P;
}
// parts drawn with the unlit (glowing) material
export function worldGlow(d) {
  switch (d.model) {
    case 'belltreegrand': return [[-1.8, 2.4], [1.9, 2.3], [-3.3, -2.0], [3.2, -1.9]].map(([x, z]) => B(0.22, 0.24, 0.22, x, 4.2, z, 0xffe0a0));
    case 'rootmouth': return [B(d.w - 1.6, 0.04, d.d - 1.6, 0, 0.27, 0, 0x2a6a60), ...[[-0.8, 0.9], [1.0, -0.6], [0.2, 1.3]].map(([x, z]) => B(0.24, 0.1, 0.24, x, 0.58, z, 0x9af0e0))];
    case 'clockgate': return [B(0.3, 0.3, 0.1, 0, 2.7, 0.66, 0xffd28a)];
    case 'crystalcluster': { const s = d.s || 1, P = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + jit(d, i), r = 0.25 * s; P.push(B(0.12 * s, (0.7 + jit(d, i + 4) * 0.7) * s, 0.12 * s, Math.cos(a) * r, 0.05, Math.sin(a) * r, i % 2 ? 0x9af0ff : 0xc8a8ff, Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4)); } return P; }
    case 'clockface': return [B(0.5, 0.5, 0.1, 0, 7.35, 0.42, 0xffe8a0)];
    case 'hangingroots': return [0, 1, 2].map(i => B(0.12, 0.14, 0.12, (jit(d, i) - 0.5) * d.w, 4.08 - (1.6 + jit(d, i + 3) * 2), (jit(d, i + 7) - 0.5) * d.d, 0x9af0e0));
  }
  return [];
}
export const WORLD_MODELS = new Set(['clockface', 'fallenhand', 'topiary', 'biggear', 'bronzeframe', 'gearhouse', 'hangingroots', 'crystalcluster', 'belltreegrand', 'marketstall', 'footbridge', 'signpost', 'hedge', 'gazebo', 'planter', 'barrels', 'welcomearch', 'rootlift', 'clockgate', 'rootmouth']);
