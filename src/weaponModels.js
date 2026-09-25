// Weapon models built from the visual registry (rpg/weaponVisuals.js), one profile per
// silhouette on the approved sheet. Everything is authored in the sheet's own plane (x across,
// y along the weapon, grip at the origin, z = thickness), as a few dozen chunky coloured boxes
// merged into one geometry per material, so the pixel renderer turns them into crisp sprites.
// A builder returns { parts, glow, prism, scale, pre, anchors }:
//   glow   unlit parts (luminous blades, orbs, flames)   prism  parts that shift colour (Prismatic)
//   pre    rotation applied to the whole model (bows are drawn flat and turned to face the arm)
//   anchors { tip, gem, edge: [[x, y], ...] } for rarity gems, element edges and particles
import { getWeaponVisual, RARITY_VISUAL, UNIQUE_ACCENTS, rarityTier } from './rpg/weaponVisuals.js';

const C = (w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0) => [w, h, d, x, y, z, c, rx, ry, rz];
// a box from (x0, y0) to (x1, y1) in the sheet plane
function seg(P, x0, y0, x1, y1, w, d, c, z = 0, over = 0.012) {
  const dx = x1 - x0, dy = y1 - y0;
  P.push(C(w, Math.hypot(dx, dy) + over, d, (x0 + x1) / 2, (y0 + y1) / 2, z, c, 0, 0, Math.atan2(-dx, dy)));
}
const shade = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k); return (r << 16) | (g << 8) | b; };
// deterministic wobble for twigs (never Math.random: every copy of a weapon must match)
const wob = (i, s = 1) => Math.sin(i * 12.9898 * s + 78.233) * 0.5;

// ------------------------------------------------------------------ Samurai
function hilt(P, V, gl, x0 = 0) {
  const p = V.pal, y0 = -gl + 0.07, y1 = 0.085, n = Math.max(2, Math.round((y1 - y0) / 0.05));
  P.push(C(0.05, y1 - y0, 0.05, x0, (y0 + y1) / 2, 0, p.grip));
  for (let i = 0; i < n; i++) { const y = y0 + (i + 0.5) * (y1 - y0) / n; P.push(C(0.032, 0.032, 0.056, x0, y, 0, p.wrap, 0, 0, Math.PI / 4), C(0.056, 0.032, 0.032, x0, y, 0, p.wrap, Math.PI / 4)); }
  P.push(C(0.058, 0.032, 0.058, x0, y0 - 0.014, 0, p.pommel));
}
function guard(P, V, w = V.guardW || 0.12) {
  const p = V.pal;
  if (V.moonGuard) { // a crescent moon tsuba
    P.push(C(w, 0.03, w * 0.7, 0, 0.1, 0, p.guard));
    return [C(0.05, 0.04, 0.03, -w * 0.45, 0.105, 0, p.moon, 0, 0, 0.6), C(0.05, 0.04, 0.03, w * 0.45, 0.105, 0, p.moon, 0, 0, -0.6)];
  }
  P.push(C(w, 0.03, w * 0.75, 0, 0.1, 0, p.guard), C(w * 0.7, 0.036, w * 0.55, 0, 0.1, 0, shade(p.guard, 1.18)), C(0.05, 0.034, 0.04, 0, 0.13, 0, shade(p.guard, 1.1)));
  return [];
}
// a curved blade as a polyline: body + a bright edge on the convex side (+x) + a kissaki
function bladeLine(P, V, { y0 = 0.14, len = V.len, w = V.w || 0.055, curve = V.curve || 0, col = V.pal.blade, hi = V.pal.hi, d = 0.024, taper = 0.3, segs } = {}) {
  const n = segs || Math.max(5, Math.round(len / 0.085)), pts = [];
  for (let i = 0; i <= n; i++) { const k = i / n; pts.push([-curve * k * k, y0 + k * len]); }
  const edge = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0_] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0_, L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L, k = i / n, ww = w * (1 - taper * k);
    seg(P, x0 - nx * ww * 0.12, y0_ - ny * ww * 0.12, x1 - nx * ww * 0.12, y1 - ny * ww * 0.12, ww * 0.76, d, col);
    seg(P, x0 + nx * ww * 0.36, y0_ + ny * ww * 0.36, x1 + nx * ww * 0.36, y1 + ny * ww * 0.36, ww * 0.3, d + 0.004, hi);
    edge.push([x0 + nx * ww * 0.5, y0_ + ny * ww * 0.5]);
  }
  // the point: a short angled facet swept back toward the spine
  const [xa, ya] = pts[n - 1], [xb, yb] = pts[n], a = Math.atan2(-(xb - xa), yb - ya), ww = w * (1 - taper);
  P.push(C(ww * 0.85, 0.07, d, xb - 0.006, yb + 0.022, 0, col, 0, 0, a + 0.55), C(ww * 0.3, 0.06, d + 0.004, xb + ww * 0.12, yb + 0.018, 0, hi, 0, 0, a + 0.55));
  edge.push([xb, yb + 0.04]);
  return { pts, edge, tip: [xb, yb + 0.05, 0] };
}
function katana(V) {
  const P = [], G = [], p = V.pal, gl = V.grip || 0.16;
  hilt(P, V, gl);
  G.push(...guard(P, V));
  const T = V.glowBlade ? G : P;
  const L = bladeLine(T, V);
  if (V.glowBlade) P.push(C(0.02, V.len * 0.9, 0.028, -0.004 - (V.curve || 0) * 0.35, 0.14 + V.len * 0.45, 0, shade(p.blade, 0.55), 0, 0, (V.curve || 0) * 0.9)); // a dark spine so the glow reads as steel
  if (p.rust) for (const [k, s, c] of [[0.22, 0.05, p.rust], [0.45, 0.04, p.rust2], [0.62, 0.06, p.rust], [0.8, 0.035, p.rust2]]) { const [x, y] = L.pts[Math.round(k * (L.pts.length - 1))]; P.push(C(s, s * 0.8, 0.03, x - 0.008, y, 0, c)); }
  if (V.chip) { const [x, y] = L.pts[Math.round(0.55 * (L.pts.length - 1))]; P.push(C(0.02, 0.03, 0.031, x - (V.w || 0.055) * 0.42, y, 0, 0x2a2420)); }
  return { parts: P, glow: G, anchors: { tip: L.tip, gem: [0, 0.1, 0.05], edge: L.edge } };
}
function shinai(V) {
  const P = [], p = V.pal, y0 = 0.13, len = V.len;
  hilt(P, { pal: { grip: p.grip, wrap: p.wrap, pommel: p.pommel } }, 0.17);
  P.push(C(0.1, 0.028, 0.1, 0, 0.1, 0, p.guard), C(0.07, 0.03, 0.07, 0, 0.1, 0, shade(p.guard, 1.25)));
  // four bamboo staves bound as one rod: round-ish (a square and a turned square), with nodes
  P.push(C(0.056, len, 0.056, 0, y0 + len / 2, 0, p.blade), C(0.046, len - 0.02, 0.046, 0, y0 + len / 2, 0, p.hi, 0, Math.PI / 4));
  for (let i = 1; i <= 4; i++) P.push(C(0.064, 0.024, 0.064, 0, y0 + i * len / 4.6, 0, p.node));
  P.push(C(0.044, 0.04, 0.044, 0, y0 + len + 0.01, 0, p.hi), C(0.02, 0.2, 0.06, 0, y0 + len * 0.55, 0, p.node)); // the tip cap and the binding cord
  return { parts: P, glow: [], anchors: { tip: [0, y0 + len + 0.03, 0], gem: [0, 0.1, 0.055], edge: [[0.03, y0], [0.03, y0 + len]] } };
}
function cleaver(V) { // Oni Cleaver: a broad red-black slab with a toothed spine and ember cracks
  const P = [], G = [], p = V.pal, y0 = 0.15, len = V.len, rows = 7, d = 0.04;
  hilt(P, V, V.grip);
  P.push(C(0.24, 0.06, 0.15, 0, 0.1, 0, p.guard), C(0.04, 0.04, 0.03, -0.08, 0.1, 0.075, p.stud), C(0.04, 0.04, 0.03, 0.08, 0.1, 0.075, p.stud), C(0.04, 0.04, 0.03, -0.08, 0.1, -0.075, p.stud), C(0.04, 0.04, 0.03, 0.08, 0.1, -0.075, p.stud));
  const edge = [];
  for (let i = 0; i < rows; i++) {
    const k = i / (rows - 1), w = V.w * (0.8 + 0.28 * k), y = y0 + (i + 0.5) * len / rows, xc = 0.02 + 0.02 * k;
    P.push(C(w, len / rows + 0.01, d, xc, y, 0, i % 2 ? p.blade : p.body));
    P.push(C(0.04, len / rows + 0.01, d + 0.006, xc + w / 2 - 0.018, y, 0, p.hi)); // the red cutting edge
    if (i < rows - 1) P.push(C(0.05, 0.05, d - 0.006, xc - w / 2 - 0.004, y + 0.03, 0, p.guard, 0, 0, Math.PI / 4)); // spine teeth
    edge.push([xc + w / 2, y]);
  }
  // a clipped, forward-leaning point
  const wt = V.w * 1.08;
  P.push(C(wt, 0.1, d, 0.05, y0 + len + 0.02, 0, p.blade, 0, 0, -0.45), C(0.04, 0.12, d + 0.006, 0.05 + wt / 2 - 0.03, y0 + len + 0.01, 0, p.hi, 0, 0, -0.45));
  // glowing cracks on both faces
  for (const z of [d / 2 + 0.003, -d / 2 - 0.003]) for (const [x, y, a, l] of [[-0.01, 0.34, 0.7, 0.12], [0.04, 0.48, -0.5, 0.1], [0.0, 0.62, 0.9, 0.14], [0.06, 0.76, -0.3, 0.08]]) G.push(C(0.016, l, 0.006, x, y, z, p.crack, 0, 0, a));
  return { parts: P, glow: G, anchors: { tip: [0.06, y0 + len + 0.08, 0], gem: [0, 0.1, 0.085], edge } };
}
function bone(V) { // Dragonbone Tachi: a curved ivory blade built from vertebrae, a knuckled bone guard
  const P = [], p = V.pal;
  hilt(P, V, 0.17);
  P.push(C(0.1, 0.05, 0.08, 0, 0.1, 0, p.guard), C(0.05, 0.05, 0.05, -0.065, 0.11, 0, p.ridge), C(0.05, 0.05, 0.05, 0.065, 0.11, 0, p.ridge), C(0.04, 0.04, 0.09, 0, 0.13, 0, p.guard));
  const L = bladeLine(P, V, { d: 0.03 });
  for (let i = 1; i < L.pts.length - 1; i += 1) { const [x, y] = L.pts[i]; P.push(C(0.024, 0.03, 0.036, x - (V.w || 0.06) * 0.46, y, 0, p.ridge)); if (i % 2) P.push(C((V.w || 0.06) * 0.9, 0.014, 0.034, x, y, 0, p.ridge)); }
  return { parts: P, glow: [], anchors: { tip: L.tip, gem: [0, 0.11, 0.05], edge: L.edge } };
}
function storm(V) { // Stormedge: a broad blue blade with a white-hot core and lightning forking off the edge
  const P = [], G = [], p = V.pal;
  hilt(P, V, 0.16);
  P.push(C(0.14, 0.035, 0.09, 0, 0.1, 0, p.guard, 0, 0, 0.25), C(0.06, 0.05, 0.05, 0, 0.12, 0, p.hi));
  const L = bladeLine(P, V, { d: 0.028, taper: 0.2 });
  for (let i = 0; i < L.pts.length - 2; i++) { const [x0, y0] = L.pts[i], [x1, y1] = L.pts[i + 1]; seg(G, x0, y0, x1, y1, 0.018, 0.034, p.core); }
  for (const [k, s] of [[0.3, 1], [0.55, -1], [0.78, 1]]) { const [x, y] = L.pts[Math.round(k * (L.pts.length - 1))], e = (V.w || 0.07) * 0.5; seg(G, x + e, y, x + e + 0.05, y + 0.04 * s, 0.018, 0.018, p.core); seg(G, x + e + 0.05, y + 0.04 * s, x + e + 0.08, y - 0.01 * s, 0.016, 0.016, p.hi); }
  return { parts: P, glow: G, anchors: { tip: L.tip, gem: [0, 0.1, 0.05], edge: L.edge } };
}

// ------------------------------------------------------------------ Archer
// Grip at the origin, limbs bow back to -x, the string sits behind at x = -depth.
function bowPts(V, s) {
  const len = V.len, depth = V.depth || 0.12, a = Math.abs(s);
  let x = -depth * s * s;
  if (V.recurve && a > 0.72) x += V.recurve * ((a - 0.72) / 0.28) ** 2;
  if (V.jitter) x += wob(Math.round(s * 20), 1.7) * V.jitter * a;
  return [x, s * len];
}
function bow(V) {
  const P = [], G = [], p = V.pal, n = 9, th = V.thick || 0.045, edge = [];
  for (const side of [1, -1]) for (let i = 0; i < n; i++) {
    const s0 = side * (0.09 + i / n * 0.91), s1 = side * (0.09 + (i + 1) / n * 0.91), [x0, y0] = bowPts(V, s0), [x1, y1] = bowPts(V, s1), k = i / n, w = th * (1 - 0.35 * k);
    seg(P, x0, y0, x1, y1, w, w, i % 3 === 2 && !V.laminate ? shade(p.wood, 0.88) : p.wood);
    if (V.core) seg(P, x0 - w * 0.4, y0, x1 - w * 0.4, y1, w * 0.4, w * 1.08, p.dark); // a dark core on the string side
    if (V.laminate) seg(P, x0 + w * 0.4, y0, x1 + w * 0.4, y1, w * 0.35, w * 1.1, p.lam);
    edge.push([x0 + w * 0.5, y0]);
  }
  // tips (nocks), string, grip
  const [tx, ty] = bowPts(V, 1);
  for (const sg of [1, -1]) P.push(C(th * 0.9, 0.04, th * 0.9, tx, sg * (ty + 0.01), 0, p.dark));
  seg(P, tx - 0.006, ty, tx - 0.006, -ty, 0.012, 0.012, p.string);
  P.push(C(th * 1.2, 0.12, th * 1.2, 0, 0, 0, p.grip));
  if (V.bands) for (const y of [0.075, -0.075]) P.push(C(th * 1.5, 0.028, th * 1.5, bowPts(V, y / V.len)[0], y, 0, p.band));
  if (V.jewel) G.push(C(0.05, 0.05, 0.05, th * 0.62, 0, 0, p.jewel, 0, 0, Math.PI / 4));
  if (V.leafTip) { const [x, y] = bowPts(V, 0.98); P.push(C(0.07, 0.035, 0.012, x + 0.04, y - 0.02, 0, p.leaf, 0, 0, -0.6), C(0.05, 0.03, 0.012, x + 0.035, y - 0.07, 0, shade(p.leaf, 1.2), 0, 0, -0.9)); }
  if (V.jitter) for (const s of [0.4, -0.55]) { const [x, y] = bowPts(V, s); P.push(C(th * 1.3, 0.03, th * 1.3, x, y, 0, p.dark)); } // knots
  if (V.vines) for (let i = 0; i < 10; i++) {
    const s = (i < 5 ? 1 : -1) * (0.2 + (i % 5) * 0.17), [x, y] = bowPts(V, s);
    P.push(C(th * 1.4, 0.02, th * 1.4, x, y, 0, p.vine, 0, 0, 0.5 * Math.sign(s)));
    if (i % 2) P.push(C(0.07, 0.035, 0.012, x + 0.04, y, 0, i % 4 === 1 ? p.leaf : p.vine, 0, 0, -0.5 * Math.sign(s)));
  }
  if (V.wind) for (const sg of [1, -1]) { const [x, y] = bowPts(V, sg * 0.82); G.push(C(0.12, 0.02, 0.012, x + 0.07, y - sg * 0.04, 0, p.wind, 0, 0, sg * 0.5), C(0.08, 0.018, 0.012, x + 0.06, y - sg * 0.1, 0, p.wind, 0, 0, sg * 0.35)); }
  if (V.sunRing) { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push(C(0.034, 0.034, 0.03, Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0, p.band, 0, 0, a)); } G.push(C(0.06, 0.06, 0.02, 0.02, 0, 0.03, p.sun, 0, 0, Math.PI / 4)); }
  if (V.sparkle) for (const s of [0.55, -0.7, 0.85]) { const [x, y] = bowPts(V, s); G.push(C(0.05, 0.012, 0.012, x + 0.07, y, 0, V.sparkle), C(0.012, 0.05, 0.012, x + 0.07, y, 0, V.sparkle)); }
  return { parts: P, glow: G, pre: [0, -Math.PI / 2, 0], anchors: { tip: [tx, ty, 0], gem: [th * 0.7, V.jewel ? -0.075 : 0, 0], edge } };
}

// ------------------------------------------------------------------ Witch
function shaft(P, V) {
  const p = V.pal, len = V.len, th = V.thick || 0.045, yb = -len * 0.42, yt = len * 0.58, n = 6;
  for (let i = 0; i < n; i++) {
    const a = yb + i / n * (yt - yb), b = yb + (i + 1) / n * (yt - yb), xa = V.jitter ? wob(i) * V.jitter : 0, xb = V.jitter ? wob(i + 1) * V.jitter : 0;
    seg(P, xa, a, xb, b, th * (i === 0 ? 0.85 : 1), th, V.twist && i % 2 ? p.dark : p.wood, 0, 0.004);
  }
  if (V.twist) for (let i = 0; i < 5; i++) P.push(C(th * 1.25, 0.02, th * 1.25, 0, yb + 0.06 + i * (yt - yb) / 5.5, 0, p.dark, 0, 0, 0.4));
  P.push(C(th * 1.2, 0.03, th * 1.2, 0, yb + 0.01, 0, p.dark)); // the heel
  if (V.bands) for (let i = 0; i < V.bands; i++) P.push(C(th * 1.3, 0.026, th * 1.3, 0, yt - 0.08 - i * 0.18, 0, p.band || p.dark));
  return yt;
}
const HEADS = {
  leaves(P, G, V, y) { const p = V.pal; seg(P, 0, y, 0.04, y + 0.06, 0.026, 0.026, p.wood); P.push(C(0.075, 0.035, 0.012, 0.075, y + 0.08, 0, p.leaf, 0, 0, -0.55), C(0.07, 0.034, 0.012, 0.02, y + 0.1, 0, p.leaf2, 0, 0, 0.7), C(0.05, 0.03, 0.012, 0.06, y + 0.12, 0, p.leaf2, 0, 0, -0.2)); return [0.06, y + 0.12, 0]; },
  acorn(P, G, V, y) {
    const p = V.pal;
    P.push(C(0.12, 0.11, 0.12, 0, y + 0.07, 0, p.nut), C(0.1, 0.04, 0.1, 0, y + 0.01, 0, shade(p.nut, 0.85)), C(0.03, 0.03, 0.03, 0, y - 0.01, 0, p.cap2), C(0.05, 0.06, 0.02, 0.02, y + 0.07, 0.061, p.nut2));
    P.push(C(0.15, 0.05, 0.15, 0, y + 0.14, 0, p.cap), C(0.12, 0.035, 0.12, 0, y + 0.175, 0, p.cap2), C(0.025, 0.05, 0.025, 0, y + 0.21, 0, p.cap2));
    for (let i = 0; i < 4; i++) P.push(C(0.03, 0.02, 0.03, Math.cos(i * 1.57) * 0.06, y + 0.155, Math.sin(i * 1.57) * 0.06, p.cap2));
    P.push(C(0.08, 0.035, 0.012, 0.05, y + 0.22, 0, p.leaf, 0, 0, -0.5));
    return [0, y + 0.2, 0];
  },
  crook(P, G, V, y) { // a curl over the top that winds inward: the shepherd's crook on the sheet
    const p = V.pal, n = 16, r0 = 0.1, cx = r0, cy = y;
    let prev = [0, y];
    for (let i = 1; i <= n; i++) { const t = i / n, th = Math.PI - t * Math.PI * 1.75, r = r0 * (1 - 0.62 * t), q = [cx + Math.cos(th) * r, cy + Math.sin(th) * r]; seg(P, prev[0], prev[1], q[0], q[1], V.thick * (1 - 0.35 * t), V.thick, i % 4 === 0 ? p.dark : p.wood); prev = q; }
    return [cx, cy + r0, 0];
  },
  toadstool(P, G, V, y) {
    const p = V.pal;
    P.push(C(0.05, 0.06, 0.05, 0, y + 0.02, 0, p.gill), C(0.19, 0.016, 0.19, 0, y + 0.055, 0, p.gill));
    P.push(C(0.21, 0.05, 0.21, 0, y + 0.085, 0, p.cap), C(0.16, 0.04, 0.16, 0, y + 0.125, 0, p.cap2), C(0.09, 0.03, 0.09, 0, y + 0.155, 0, p.cap2));
    for (const [x, yy, z, s] of [[0.05, 0.14, 0.05, 0.035], [-0.06, 0.12, 0.03, 0.03], [0.01, 0.17, -0.02, 0.03], [-0.02, 0.1, 0.1, 0.03], [0.09, 0.09, -0.04, 0.028], [-0.08, 0.1, -0.06, 0.03]]) P.push(C(s, 0.02, s, x, y + yy + 0.01, z, p.spot));
    return [0, y + 0.18, 0];
  },
  candle(P, G, V, y) {
    const p = V.pal;
    P.push(C(0.13, 0.035, 0.13, 0, y + 0.01, 0, p.cup), C(0.08, 0.03, 0.08, 0, y - 0.02, 0, shade(p.cup, 0.8)), C(0.03, 0.04, 0.03, 0.07, y + 0.03, 0, p.cup));
    P.push(C(0.075, 0.13, 0.075, 0, y + 0.09, 0, p.wax), C(0.028, 0.06, 0.02, 0.028, y + 0.1, 0.04, p.wax2), C(0.02, 0.04, 0.02, -0.03, y + 0.12, 0.04, p.wax2), C(0.012, 0.03, 0.012, 0, y + 0.17, 0, 0x2a1a10));
    G.push(C(0.05, 0.08, 0.05, 0, y + 0.21, 0, p.flame), C(0.028, 0.05, 0.028, 0, y + 0.205, 0.004, p.core), C(0.024, 0.04, 0.024, 0, y + 0.26, 0, p.flame));
    return [0, y + 0.26, 0];
  },
  owl(P, G, V, y) { // an owl-eared frame around a blue orb
    const p = V.pal, cy = y + 0.1, r = 0.085;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.push(C(0.04, 0.045, 0.05, Math.cos(a) * r, cy + Math.sin(a) * r, 0, i % 2 ? p.frame : shade(p.frame, 0.85), 0, 0, a)); }
    P.push(C(0.04, 0.08, 0.04, -0.06, cy + 0.1, 0, p.frame, 0, 0, 0.45), C(0.04, 0.08, 0.04, 0.06, cy + 0.1, 0, p.frame, 0, 0, -0.45), C(0.03, 0.04, 0.03, 0, cy - r - 0.02, 0.03, p.rim));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; P.push(C(0.022, 0.022, 0.056, Math.cos(a) * 0.06, cy + Math.sin(a) * 0.06, 0, p.rim)); }
    G.push(C(0.08, 0.08, 0.07, 0, cy, 0, p.orb, 0, 0, Math.PI / 4), C(0.03, 0.03, 0.02, -0.015, cy + 0.015, 0.04, p.orb2));
    return [0, cy, 0];
  },
  skull(P, G, V, y) {
    const p = V.pal, cy = y + 0.09;
    P.push(C(0.13, 0.11, 0.12, 0, cy, 0, p.bone), C(0.11, 0.04, 0.1, 0, cy + 0.06, 0, p.bone), C(0.09, 0.045, 0.09, 0, cy - 0.065, 0.012, p.bone2));
    P.push(C(0.035, 0.035, 0.012, -0.032, cy - 0.005, 0.062, p.socket), C(0.035, 0.035, 0.012, 0.032, cy - 0.005, 0.062, p.socket), C(0.018, 0.022, 0.012, 0, cy - 0.04, 0.062, p.socket));
    for (const x of [-0.03, -0.01, 0.01, 0.03]) P.push(C(0.012, 0.014, 0.01, x, cy - 0.075, 0.058, p.socket));
    G.push(C(0.016, 0.016, 0.01, -0.032, cy - 0.005, 0.07, p.hex), C(0.016, 0.016, 0.01, 0.032, cy - 0.005, 0.07, p.hex), C(0.03, 0.06, 0.02, 0.08, cy + 0.02, 0, p.hex, 0, 0, -0.4), C(0.025, 0.05, 0.02, -0.085, cy - 0.03, 0, p.hex, 0, 0, 0.5));
    return [0, cy + 0.06, 0];
  },
  crystal(P, G, V, y) {
    const p = V.pal;
    P.push(C(0.07, 0.04, 0.07, 0, y + 0.01, 0, p.band));
    G.push(C(0.075, 0.2, 0.075, 0, y + 0.13, 0, p.ice, 0, Math.PI / 4), C(0.05, 0.08, 0.05, 0, y + 0.26, 0, p.ice2, 0, Math.PI / 4), C(0.028, 0.05, 0.028, 0, y + 0.31, 0, 0xffffff, 0, Math.PI / 4));
    P.push(C(0.045, 0.13, 0.045, 0.055, y + 0.08, 0, p.ice3, 0, 0, -0.5), C(0.045, 0.12, 0.045, -0.055, y + 0.075, 0, p.ice3, 0, 0, 0.5), C(0.035, 0.08, 0.035, 0.03, y + 0.05, 0.04, p.ice, 0, 0, -0.2));
    return [0, y + 0.32, 0];
  },
  star(P, G, V, y) { // a gold ring holding a small sun, star points outside it
    const p = V.pal, cy = y + 0.1, r = 0.085;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.push(C(0.04, 0.04, 0.045, Math.cos(a) * r, cy + Math.sin(a) * r, 0, p.rim, 0, 0, a)); }
    G.push(C(0.09, 0.09, 0.06, 0, cy, 0, p.orb, 0, 0, Math.PI / 4), C(0.05, 0.05, 0.065, 0, cy, 0, p.core));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; G.push(C(0.03, 0.06, 0.03, Math.cos(a) * 0.125, cy + Math.sin(a) * 0.125, 0, p.core, 0, 0, a - Math.PI / 2)); }
    return [0, cy, 0];
  },
};
function staff(V) {
  const P = [], G = [], yt = shaft(P, V);
  const tip = HEADS[V.head](P, G, V, yt);
  if (V.sparkle) for (const [x, y] of [[0.14, yt + 0.2], [-0.12, yt + 0.06], [0.1, yt - 0.06]]) G.push(C(0.045, 0.012, 0.012, x, y, 0, V.sparkle), C(0.012, 0.045, 0.012, x, y, 0, V.sparkle));
  return { parts: P, glow: G, anchors: { tip, gem: [0, yt - 0.04, (V.thick || 0.045) * 0.75], edge: [[0, yt - 0.3], [0, yt]] } };
}

// ------------------------------------------------------------------ SoulBound
// In the hand: a wrapped grip, the gathered coil and a short hanging tail with the chain's end
// piece. The lash itself is the chain rig (rpg/soulbound.js), which reads chainStyle().
function link(P, G, V, x, y, z, i, rz = 0) {
  const p = V.pal, s = V.link === 'heavy' ? 1.25 : 1, c = i % 2 ? p.a : p.b;
  P.push(C(0.05 * s, 0.036 * s, 0.03 * s, x, y, z, c, 0, i % 2 ? Math.PI / 2 : 0, rz));
  if (V.link === 'spiked' && i % 2) G.push(C(0.018, 0.04, 0.018, x + Math.cos(rz) * 0.03, y + Math.sin(rz) * 0.03, z, shade(p.a, 1.35), 0, 0, rz - 0.8));
  if (V.link === 'ornate' && i % 3 === 0) G.push(C(0.026, 0.026, 0.036, x, y, z, i % 2 ? p.gemA : p.gemB, 0, 0, Math.PI / 4));
}
const ENDS = {
  weight: (P, G, p, x, y) => P.push(C(0.07, 0.07, 0.07, x, y, 0, p.end), C(0.05, 0.08, 0.05, x, y, 0, shade(p.end, 1.25), 0, Math.PI / 4)),
  charm: (P, G, p, x, y) => { P.push(C(0.05, 0.05, 0.02, x, y, 0, 0xc8d0dc, 0, 0, Math.PI / 4)); G.push(C(0.025, 0.025, 0.026, x, y, 0, p.end, 0, 0, Math.PI / 4)); },
  bell: (P, G, p, x, y) => P.push(C(0.07, 0.05, 0.07, x, y, 0, p.end), C(0.05, 0.03, 0.05, x, y + 0.035, 0, shade(p.end, 1.2)), C(0.02, 0.02, 0.02, x, y - 0.035, 0, 0x5a3a1a)),
  lantern: (P, G, p, x, y) => { P.push(C(0.07, 0.015, 0.07, x, y + 0.045, 0, 0x2a2a30), C(0.07, 0.015, 0.07, x, y - 0.045, 0, 0x2a2a30)); G.push(C(0.055, 0.075, 0.055, x, y, 0, p.end)); },
  moth: (P, G, p, x, y) => { P.push(C(0.02, 0.05, 0.02, x, y, 0, 0x5a4a3a)); G.push(C(0.06, 0.035, 0.008, x - 0.03, y + 0.01, 0, p.end, 0, 0, 0.4), C(0.06, 0.035, 0.008, x + 0.03, y + 0.01, 0, p.end, 0, 0, -0.4)); },
  blade: (P, G, p, x, y) => { G.push(C(0.04, 0.12, 0.018, x, y - 0.04, 0, p.end, 0, 0, 0.15), C(0.02, 0.06, 0.02, x + 0.008, y - 0.11, 0, 0xffffff, 0, 0, 0.3)); },
  gem: (P, G, p, x, y) => { P.push(C(0.07, 0.07, 0.03, x, y, 0, p.a, 0, 0, Math.PI / 4)); G.push(C(0.045, 0.045, 0.036, x, y, 0, p.end, 0, 0, Math.PI / 4)); },
};
function chain(V) {
  const P = [], G = [], p = V.pal;
  P.push(C(0.055, 0.16, 0.055, 0, 0, 0, p.grip), C(0.062, 0.022, 0.062, 0, 0.05, 0, p.wrap), C(0.062, 0.022, 0.062, 0, -0.03, 0, p.wrap), C(0.07, 0.035, 0.07, 0, -0.09, 0, shade(p.grip, 0.7)), C(0.066, 0.03, 0.066, 0, 0.095, 0, shade(p.a, 1.1)));
  // the gathered coil around the grip's head
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; link(P, G, V, Math.cos(a) * 0.1, 0.19 + Math.sin(a) * 0.1, 0.02, i, a + Math.PI / 2); }
  // the tail: a few links hanging from the coil to the end piece
  let x = 0.1, y = 0.13;
  for (let i = 0; i < 4; i++) { x += 0.018; y -= 0.05; link(P, G, V, x, y, 0.03, i + 1, Math.PI / 2 + 0.2); }
  (ENDS[V.end] || ENDS.weight)(P, G, p, x + 0.01, y - 0.06);
  G.push(C(0.028, 0.028, 0.028, 0, 0.3, 0.02, p.spirit)); // the first spectral link
  return { parts: P, glow: G, anchors: { tip: [x + 0.01, y - 0.08, 0], gem: [0, 0.02, 0.04], edge: [[0.1, 0.1], [0.12, y]] } };
}
// the lash's look for the chain rig: link colours, spirit colour, link style, end piece
export function chainStyle(item) {
  const V = getWeaponVisual(item) || getWeaponVisual('tetherchain');
  return { a: V.pal.a, b: V.pal.b, spirit: V.pal.spirit, link: V.link || 'round', end: V.end || 'weight', endCol: V.pal.end, gemA: V.pal.gemA, gemB: V.pal.gemB };
}

const BUILD = { katana, shinai, cleaver, bone, storm, bow, staff, chain };

// ------------------------------------------------------------------ uniques, rarity, crafting
// Hand-made Legendaries: their base weapon plus a signature accent in the unique's colour
function uniqueAccent(u, W, V) {
  const A = UNIQUE_ACCENTS[u]; if (!A) return;
  const P = W.parts, G = W.glow, [tx, ty] = W.anchors.tip, e = W.anchors.edge || [], col = A.col, fam = V.family;
  const along = (k, f) => { const pt = e[Math.min(e.length - 1, Math.round(k * (e.length - 1)))]; if (pt) f(pt[0], pt[1]); };
  switch (A.mark) {
    case 'thorn': for (const k of [0.25, 0.5, 0.75]) along(k, (x, y) => P.push(C(0.05, 0.03, 0.03, x + 0.02, y, 0, 0x5a4030, 0, 0, -0.6))); along(0.6, (x, y) => G.push(C(0.035, 0.035, 0.035, x + 0.035, y + 0.02, 0, col))); break;
    case 'crescent': for (const k of [0.2, 0.4, 0.6, 0.8]) along(k, (x, y) => G.push(C(0.02, 0.07, 0.03, x, y, 0, col))); break;
    case 'ray': for (const k of [0.1, 0.35, 0.6, 0.85]) along(k, (x, y) => G.push(C(0.012, 0.06, 0.03, x - 0.02, y, 0, col))); break;
    case 'grin': P.push(C(0.15, 0.08, 0.1, 0, 0.1, 0, 0x1a0a0a)); G.push(C(0.1, 0.02, 0.02, 0, 0.1, 0.06, col), C(0.02, 0.02, 0.02, -0.04, 0.12, 0.06, col), C(0.02, 0.02, 0.02, 0.04, 0.12, 0.06, col)); break;
    case 'wind': for (const sg of [1, -1]) G.push(C(0.18, 0.03, 0.012, tx + 0.1, sg * (ty - 0.06), 0, col, 0, 0, sg * 0.6), C(0.12, 0.025, 0.012, tx + 0.08, sg * (ty - 0.14), 0, col, 0, 0, sg * 0.4)); break;
    case 'sun': G.push(C(0.14, 0.14, 0.02, 0.03, 0, 0.035, col, 0, 0, Math.PI / 4), C(0.08, 0.08, 0.025, 0.03, 0, 0.04, 0xfff3b0)); break;
    case 'moon': G.push(C(0.12, 0.12, 0.02, 0.03, 0.02, 0.035, col), C(0.09, 0.09, 0.025, 0.05, 0.04, 0.04, 0x1a1a3a)); break;
    case 'bloom': for (let i = 0; i < 5; i++) G.push(C(0.07, 0.025, 0.03, tx + Math.cos(i * 1.26) * 0.08, ty + Math.sin(i * 1.26) * 0.08, 0, col, 0, 0, i * 1.26)); break;
    case 'flame': for (const sx of [-0.09, 0.09]) { P.push(C(0.045, 0.09, 0.045, sx, ty - 0.1, 0, 0xf8f0e0)); G.push(C(0.03, 0.05, 0.03, sx, ty - 0.03, 0, col)); } break;
    case 'eyes': G.push(C(0.03, 0.03, 0.02, -0.03, ty + 0.02, 0.07, col), C(0.03, 0.03, 0.02, 0.03, ty + 0.02, 0.07, col)); break;
    case 'star': G.push(C(0.24, 0.05, 0.03, tx, ty, 0.035, col), C(0.05, 0.24, 0.03, tx, ty, 0.035, col)); W.scale *= 1.05; break;
  }
  if (fam === 'katana' && A.mark !== 'grin') P.push(C(0.07, 0.034, 0.058, 0, 0.13, 0, 0xd8b060)); // a gilded collar marks every unique blade
}

export function buildWeapon(item, base) {
  const V = getWeaponVisual(base || item);
  if (!V || V.model === 'legacy' || !BUILD[V.model]) return null;
  const W = BUILD[V.model](V);
  W.scale = V.scale || 1; W.prism = W.prism || []; W.visual = V;
  if (item && item.unique) uniqueAccent(item.unique, W, V);
  // rarity: a small gem, never a recolour. Common stays plain; Prismatic gets a shifting gem.
  const t = rarityTier(item), R = RARITY_VISUAL[t], [gx, gy, gz] = W.anchors.gem;
  if (R.gem === 'prism') { W.prism.push(C(0.045, 0.045, 0.03, gx, gy, gz, 0xffffff, 0, 0, Math.PI / 4)); if (V.family === 'katana' || V.family === 'bow') W.prism.push(C(0.03, 0.03, 0.03, gx, gy, -gz, 0xffffff, 0, 0, Math.PI / 4)); }
  else if (R.gem) W.parts.push(C(0.04, 0.04, 0.028, gx, gy, gz, R.gem, 0, 0, Math.PI / 4));
  if (item && item.craft) W.glow.push(C(0.026, 0.026, 0.026, gx + 0.04, gy + 0.03, gz, 0x9ad8ff));
  return W;
}
