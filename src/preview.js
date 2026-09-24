// Off-screen renderer for UI: the inventory paper doll (a live, rotatable Moss wearing the
// current gear) and small pixel icons of real weapon/armour models. It has its own WebGL
// context so the game's render pipeline is untouched.
import * as THREE from 'three';
import { makeHero, weaponMesh, helmParts, torsoParts, neckParts, legParts, armParts } from './hero.js';
import { geo, B, MAT } from './models.js';

let R = null, iconRT = null;
const cache = new Map();
function renderer() {
  if (R) return R;
  R = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.domElement.className = 'doll-canvas';
  iconRT = new THREE.WebGLRenderTarget(64, 64);
  iconRT.texture.colorSpace = THREE.SRGBColorSpace;
  return R;
}
function lights(scene) {
  // warm key from the front-left, cool rim from behind, a moss-green bounce from below
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a6a3a, 1.35));
  const d = new THREE.DirectionalLight(0xffe8c8, 2.4); d.position.set(2, 4, 3); scene.add(d);
  const rim = new THREE.DirectionalLight(0x9ad8ff, 1.6); rim.position.set(-3, 2.5, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffc890, 0.5); fill.position.set(-2, 0.5, 2); scene.add(fill);
}

export class DollPreview {
  constructor() {
    this.scene = new THREE.Scene(); lights(this.scene);
    this.cam = new THREE.OrthographicCamera(-0.8, 0.8, 1.2, -0.95, 0.1, 20);
    this.cam.position.set(0, 1.1, 4); this.cam.lookAt(0, 0.5, 0);
    const plinth = new THREE.Mesh(geo([B(1.1, 0.1, 1.1, 0, -0.1, 0, 0x5a4a6a), B(1.0, 0.04, 1.0, 0, 0, 0, 0x4f8a3a), B(0.2, 0.05, 0.2, 0.3, 0.03, 0.25, 0x6fb04a), B(0.14, 0.04, 0.14, -0.32, 0.02, -0.2, 0x6fb04a)]), MAT);
    this.scene.add(plinth);
    this.rotY = 0.5; this.spin = 0.35; this.cls = null; this.t = 0; this.zoom = 1;
  }
  setZoom(z) { this.zoom = Math.max(0.55, Math.min(1.25, z)); const k = this.zoom; this.cam.left = -0.8 * k; this.cam.right = 0.8 * k; this.cam.top = 0.5 + 0.7 * k; this.cam.bottom = 0.5 - 1.45 * k; this.cam.updateProjectionMatrix(); }
  mount(el) {
    const r = renderer();
    if (r.domElement.parentNode !== el) el.appendChild(r.domElement);
    r.setSize(168, 236, false);
    if (!this.bound) {
      this.bound = true;
      let drag = null;
      r.domElement.addEventListener('wheel', e => { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
      r.domElement.addEventListener('dblclick', () => { this.setZoom(this.zoom < 0.8 ? 1 : 0.6); });
      r.domElement.addEventListener('pointerdown', e => { drag = e.clientX; this.spin = 0; });
      addEventListener('pointerup', () => { drag = null; });
      addEventListener('pointermove', e => { if (drag !== null) { this.rotY += (e.clientX - drag) * 0.02; drag = e.clientX; } });
    }
  }
  setGear(cls, equip) {
    if (this.cls !== cls) {
      if (this.hero) this.scene.remove(this.hero.root);
      this.hero = makeHero(cls); this.hero.root.scale.setScalar(1); this.cls = cls;
      this.scene.add(this.hero.root);
      // a relaxed ready pose
      this.hero.armR.rotation.x = cls === 'witch' ? -0.5 : -0.9; this.hero.armR.rotation.z = 0.25; this.hero.sword.rotation.x = cls === 'witch' ? 0.15 : -0.5; this.hero.armL.rotation.z = -0.2; if (cls === 'archer') this.hero.armL.rotation.x = -0.4;
    }
    this.hero.setGear(equip);
    // hold the weapon the way it is used: two hands for heavy and oversized weapons
    const w = equip && equip.weapon, big = w && (w.kind === 'oversized' || w.big);
    this.hero.armL.rotation.set(big ? -0.9 : 0, 0, big ? 0.3 : -0.2);
    if (w && w.kind === 'bow') this.hero.armL.rotation.x = -0.4;
    this.hero.armR.rotation.x = w && (w.kind === 'staff' || w.kind === 'wand') ? -0.5 : -0.9;
    this.hero.sword.rotation.x = w && (w.kind === 'staff' || w.kind === 'wand') ? 0.15 : big ? -0.2 : -0.5;
    this.flash = 0.4;
  }
  frame(dt) {
    if (!this.hero) return;
    const r = renderer();
    this.t += dt; this.rotY += this.spin * dt;
    this.hero.root.rotation.y = this.rotY;
    const br = Math.sin(this.t * 2.4);
    this.hero.body.scale.set(1 + br * 0.012, 1 + br * 0.015, 1);
    this.hero.eyes.scale.y = (this.t % 3.4) < 0.1 ? 0.15 : 1;
    this.hero.tail1.rotation.x = -0.5 + Math.sin(this.t * 3) * 0.1;
    this.flash = Math.max(0, (this.flash || 0) - dt);
    this.hero.root.position.y = this.flash > 0 ? Math.sin((0.4 - this.flash) / 0.4 * Math.PI) * 0.08 : 0;
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 0);
    r.render(this.scene, this.cam);
  }
}

// A pixel icon of an item's real model (weapon, helm, chest, charm...), cached.
export function itemIconURL(item, cls = 'samurai') {
  if (!item) return '';
  const key = [item.base, item.r, item.unique || '', item.craft || '', item.slot].join('|');
  if (cache.has(key)) return cache.get(key);
  const r = renderer();
  const scene = new THREE.Scene(); lights(scene);
  let obj, size = 0.55, cy = 0.3;
  if (item.slot === 'weapon') {
    obj = weaponMesh(item, item.cls || cls);
    obj.rotation.set(0, 0, item.kind === 'bow' ? 0 : -0.75);
    if (item.kind === 'bow') obj.rotation.y = Math.PI / 2;
    const k = item.kind === 'bow' ? 0.9 : 1.05; size = 0.5 * k * (obj.scale.x || 1); cy = item.kind === 'bow' ? 0 : 0.28;
  } else {
    const ring = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i / 8 * Math.PI * 2; return B(0.07, 0.07, 0.05, Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0, item.unique ? 0xd8b060 : 0xb8b8c8); });
    if (item.slot === 'ring') ring.push(B(0.1, 0.1, 0.07, 0, 0.16, 0.02, { 0: 0xd8d0c0, 1: 0x6fdc5a, 2: 0x4aa8ff, 3: 0xc46bff, 4: 0xff9a2a }[item.r] || 0xffffff));
    const parts = item.slot === 'ring' ? ring : item.slot === 'helm' ? helmParts(item.cls || cls, item) : item.slot === 'charm' ? neckParts(item).map(p => { const q = [...p]; q[5] -= 0.3; return q; })
      : item.slot === 'armor' || item.slot === 'chest' ? torsoParts('none', item) : item.slot === 'legs' || item.slot === 'boots' ? legParts('none', item.slot === 'legs' ? item : null, item.slot === 'boots' ? item : null, null, 1)
        : item.slot === 'arms' ? armParts('none', item, null) : torsoParts('none', item);
    obj = new THREE.Mesh(geo(parts.length ? parts : [B(0.2, 0.2, 0.2, 0, 0, 0, 0x888888)]), MAT);
    obj.rotation.y = 0.6;
    const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    obj.position.sub(c); size = Math.max(sz.x, sz.y) * 0.62 + 0.02; cy = 0;
  }
  scene.add(obj);
  const cam = new THREE.OrthographicCamera(-size, size, size + cy, -size + cy, 0.1, 20);
  cam.position.set(0, cy + 0.6, 3); cam.lookAt(0, cy, 0);
  r.setRenderTarget(iconRT); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
  const px = new Uint8Array(64 * 64 * 4); r.readRenderTargetPixels(iconRT, 0, 0, 64, 64, px); r.setRenderTarget(null);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) img.data.set(px.subarray((63 - y) * 256, (64 - y) * 256), y * 256);
  // 1px dark outline so icons pop on any slot colour
  const d = img.data, out = new Uint8ClampedArray(d);
  for (let y = 1; y < 63; y++) for (let x = 1; x < 63; x++) { const i = (y * 64 + x) * 4; if (d[i + 3] > 0) continue; if (d[i + 3 + 4] || d[i + 3 - 4] || d[i + 3 + 256] || d[i + 3 - 256]) { out[i] = 18; out[i + 1] = 12; out[i + 2] = 26; out[i + 3] = 255; } }
  img.data.set(out); ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  cache.set(key, url);
  obj.traverse(o => o.geometry && o.geometry.dispose());
  return url;
}
