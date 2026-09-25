// Weapon effects that sit on top of a weapon's own model, never replacing it:
//  * Prismatic: one shared material whose colour drifts through the prism palette
//  * element overlays: a thin luminous edge + a few particles (fire, frost, lightning, poison,
//    bleed, shadow/spirit, holy, arcane), built once per equip and ticked cheaply
//  * world drops: the real model hovering over a small rarity glow, with a beam from Rare up
// Materials are shared and cached; particles go through the game's pooled fx system.
import * as THREE from 'three';
import { geo, MAT_GLOW } from './models.js';
import { ELEMENT_VISUAL, RARITY_VISUAL, PRISM, rarityTier, getWeaponVisual } from './rpg/weaponVisuals.js';

export const PRISM_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
let prismStamp = -1;
const _c = new THREE.Color(), _c2 = new THREE.Color();
export function prismColor(t, out = _c) {
  const n = PRISM.length, k = (t * 0.35) % n, i = Math.floor(k);
  return out.set(PRISM[i]).lerp(_c2.set(PRISM[(i + 1) % n]), k - i);
}
// once per frame is enough (any caller may tick it)
export function tickPrism(t = performance.now() / 1000) {
  const s = Math.floor(t * 60);
  if (s === prismStamp) return;
  prismStamp = s;
  prismColor(t, PRISM_MAT.color);
  for (const m of beamMats.values()) if (m.userData.prism) prismColor(t + 0.6, m.color);
}

// ------------------------------------------------------------------ element overlays
const C = (w, h, d, x, y, z, c, rz = 0) => [w, h, d, x, y, z, c, 0, 0, rz];
// Adds (or clears) the element look on a weapon built by hero.weaponMesh. `W` is the model
// description it was built from (anchors: tip + edge polyline). Safe to call again on re-equip.
export function applyWeaponElementVisual(model, elements, W = null) {
  const ud = model.userData, inner = ud.inner || model;
  if (ud.elemMesh) { ud.elemMesh.parent && ud.elemMesh.parent.remove(ud.elemMesh); ud.elemMesh.geometry.dispose(); ud.elemMesh = null; }
  if (ud.arcMesh) { ud.arcMesh.parent && ud.arcMesh.parent.remove(ud.arcMesh); ud.arcMesh.geometry.dispose(); ud.arcMesh = null; }
  const els = (elements || []).filter(e => ELEMENT_VISUAL[e]);
  if (!els.length) { ud.fx = null; return model; }
  const E = ELEMENT_VISUAL[els[0]], A = (W && W.anchors) || ud.anchors || {}, V = W && W.visual;
  const tip = A.tip || (V && V.tip) || [0, 0.6, 0], P = [];
  const fam = V ? V.family : ud.kind;
  if ((fam === 'katana' || fam === 'bow') && A.edge && A.edge.length > 1) {
    // a thin heated / frosted / charged line along the cutting edge (or the bow's belly)
    const e = A.edge, step = Math.max(1, Math.floor(e.length / 8));
    for (let i = 0; i + step < e.length; i += step) {
      const [x0, y0] = e[i], [x1, y1] = e[i + step], dx = x1 - x0, dy = y1 - y0;
      P.push(C(0.014, Math.hypot(dx, dy) + 0.01, fam === 'bow' ? 0.05 : 0.032, (x0 + x1) / 2, (y0 + y1) / 2, 0, E.edge, Math.atan2(-dx, dy)));
    }
  } else {
    // staffs, wands and chains: a small halo of motes around the head
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.push(C(0.022, 0.022, 0.022, tip[0] + Math.cos(a) * 0.07, tip[1] + Math.sin(a) * 0.07, 0, i % 2 ? E.edge : E.glow)); }
  }
  ud.elemMesh = new THREE.Mesh(geo(P), MAT_GLOW); ud.elemMesh.layers.enable(1); inner.add(ud.elemMesh);
  if (els.includes('lightning')) { // a tiny forked arc that flickers near the tip
    const L = ELEMENT_VISUAL.lightning, [tx, ty] = tip;
    ud.arcMesh = new THREE.Mesh(geo([C(0.012, 0.06, 0.012, tx + 0.03, ty - 0.08, 0, L.spark[0], 0.7), C(0.012, 0.05, 0.012, tx + 0.05, ty - 0.13, 0, L.spark[1], -0.6), C(0.01, 0.04, 0.01, tx - 0.02, ty - 0.2, 0, L.spark[0], 0.9)]), MAT_GLOW);
    ud.arcMesh.visible = false; inner.add(ud.arcMesh);
  }
  // base-identity elements (a Stormedge is always a little stormy) run at a gentler rate than rolled ones
  const rolled = els.filter(e => !(V && V.element === e));
  ud.fx = { els, tip: new THREE.Vector3(...tip), rate: rolled.length ? 1 : 0.4, acc: 0, i: 0 };
  return model;
}

const _v = new THREE.Vector3();
// Emit a few element particles from a weapon (the player's, a drop's). k scales the rate.
export function tickWeaponFx(g, model, dt, k = 1) {
  tickPrism(g && g.time !== undefined ? g.time : undefined);
  const F = model && model.userData.fx;
  if (!F || !g || !g.fx || !model.visible) return;
  if (model.userData.arcMesh) model.userData.arcMesh.visible = Math.random() < 0.18;
  F.acc += dt * k * F.rate * ELEMENT_VISUAL[F.els[F.i % F.els.length]].rate;
  if (F.acc < 1) return;
  F.acc = Math.min(F.acc - 1, 2);
  const E = ELEMENT_VISUAL[F.els[F.i++ % F.els.length]];
  (model.userData.inner || model).localToWorld(_v.copy(F.tip));
  g.fx.add({ x: _v.x + (Math.random() - 0.5) * 0.06, y: _v.y, z: _v.z + (Math.random() - 0.5) * 0.06, vx: (Math.random() - 0.5) * 0.3, vy: E.rise + (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, g: 0, drag: 0.5, color: E.spark[Math.floor(Math.random() * E.spark.length)], life: 0.45, size: E.size });
}

// ------------------------------------------------------------------ world drops
const discGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
const discMats = new Map(), beamMats = new Map();
function discMat(t) {
  if (!discMats.has(t)) { const R = RARITY_VISUAL[t]; discMats.set(t, new THREE.MeshBasicMaterial({ color: R.glow, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); }
  return discMats.get(t);
}
function beamMat(t) {
  if (!beamMats.has(t)) { const R = RARITY_VISUAL[t], m = new THREE.MeshBasicMaterial({ color: R.glow, transparent: true, opacity: 0.4, depthWrite: false }); m.userData.prism = t === 5; beamMats.set(t, m); }
  return beamMats.get(t);
}
// The weapon lying in the world: its real model (the same as the icon and the hand), turned to
// show its profile, hovering over a rarity glow. Common drops stay plain; Legendary and
// Prismatic get a tall beam and rising motes. `make` builds the model (hero.weaponMesh).
export function weaponDrop(item, make) {
  const t = rarityTier(item), R = RARITY_VISUAL[t], V = getWeaponVisual(item);
  const group = new THREE.Group();
  const icon = make(item, item.cls);
  // show the weapon's face: blades and staffs lean like the sheet's diagonal, bows stand
  // side-on, chains lie as a loose coil
  const fam = V ? V.family : item.kind;
  icon.userData.lean = fam === 'chain' ? 1.2 : fam === 'bow' ? 0.35 : 0.85;
  icon.rotation.z = icon.userData.lean;
  icon.scale.multiplyScalar(fam === 'chain' ? 0.95 : 0.78);
  group.add(icon);
  let disc = null, beam = null;
  if (R.disc) { disc = new THREE.Mesh(discGeo, discMat(t)); disc.scale.setScalar(R.disc * 0.45); disc.position.y = 0.03; group.add(disc); }
  if (R.beam) {
    beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03 + t * 0.008, 0.05 + t * 0.012, R.beam, 6, 1, true), beamMat(t));
    beam.position.y = R.beam / 2; group.add(beam);
  }
  return {
    group, icon, tier: t,
    update(dt, e, g) {
      const time = g.time || 0;
      icon.rotation.y += dt * 1.6;
      icon.position.y = e.y + 0.08 + Math.sin(e.t * 3) * 0.05;
      if (disc) disc.material.opacity = 0.14 + Math.sin(time * 3) * 0.04 + t * 0.02;
      if (beam) beam.material.opacity = 0.22 + Math.sin(time * 4) * 0.08;
      tickWeaponFx(g, icon, dt, 0.6);
      if (R.motes && Math.random() < R.motes) {
        const col = t === 5 ? PRISM[Math.floor(Math.random() * PRISM.length)] : R.glow;
        g.fx.add({ x: e.x + (Math.random() - 0.5) * 0.5, y: 0.1, z: e.z + (Math.random() - 0.5) * 0.5, vy: 0.9 + t * 0.2, g: 0, color: col, life: 0.9, size: 0.045 });
      }
    },
    dispose() { if (beam) beam.geometry.dispose(); icon.traverse(o => o.geometry && o.geometry.dispose()); },
  };
}
