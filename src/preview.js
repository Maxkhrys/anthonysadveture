import { HeroPortrait } from './hero_portrait.js';
// Off-screen renderer for UI: the inventory paper doll (a live, rotatable Moss wearing the
// current gear) and small pixel icons of real weapon/armour models. It has its own WebGL
// context so the game's render pipeline is untouched.
import * as THREE from 'three';
import { weaponMesh, helmParts, torsoParts, neckParts, legParts, armParts, makeHero } from './hero.js';
import { geo, B, MAT } from './models.js';
import { getWeaponVisual, ICON_ATLAS, UNIQUE_ACCENTS, rarityTier, PRISM } from './rpg/weaponVisuals.js';
import { tickPrism } from './weaponFx.js';

// The weapon icon atlas, cut from the approved weapon sheet (scripts/build_weapon_atlas.py).
let ATLAS = null;
function atlas() {
  if (!ATLAS && typeof Image !== 'undefined') {
    ATLAS = new Image();
    ATLAS.onload = () => { for (const k of [...cache.keys()]) if (k.startsWith('w3d|')) cache.delete(k); if (typeof dispatchEvent === 'function') dispatchEvent(new Event('weapon-icons-ready')); };
    ATLAS.src = ICON_ATLAS.url;
  }
  return ATLAS && ATLAS.complete && ATLAS.naturalWidth ? ATLAS : null;
}
atlas();
const hex = c => '#' + c.toString(16).padStart(6, '0');
// a small pixel sparkle (plus shape with an ink outline) for accents drawn over an icon
function sparkle(ctx, x, y, col, s = 3) {
  ctx.fillStyle = '#1a1020'; ctx.fillRect(x - s * 2 - 1, y - 2, s * 4 + 3, 5); ctx.fillRect(x - 2, y - s * 2 - 1, 5, s * 4 + 3);
  ctx.fillStyle = col; ctx.fillRect(x - s * 2, y - 1, s * 4 + 1, 3); ctx.fillRect(x - 1, y - s * 2, 3, s * 4 + 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 3, 3);
}
// Icon from the approved art: the base weapon's own sprite, plus accents that never recolour it
// (a unique's signature spark, a crafted mark, the Prismatic shimmer).
function atlasIcon(item, V, img) {
  const S = ICON_ATLAS.cell, n = V.icon, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (n % ICON_ATLAS.cols) * S, Math.floor(n / ICON_ATLAS.cols) * S, S, S, 0, 0, S, S);
  const A = item.unique && UNIQUE_ACCENTS[item.unique];
  if (A) sparkle(ctx, 14, 14, hex(A.col), 4);
  if (rarityTier(item) === 5) { sparkle(ctx, S - 14, 14, hex(PRISM[1]), 3); sparkle(ctx, S - 26, 28, hex(PRISM[0]), 2); sparkle(ctx, 22, S - 16, hex(PRISM[2]), 2); }
  if (item.craft) sparkle(ctx, S - 14, S - 14, '#9ad8ff', 3);
  return cv.toDataURL();
}
// An inline icon for text contexts (loot toasts, shop lists, crafting pickers)
export function itemIconHTML(item, cls = 'samurai') {
  let u = '';
  try { u = itemIconURL(item, cls); } catch (e) { u = ''; }
  return u ? `<img class="ico-inl${getWeaponVisual(item) && getWeaponVisual(item).icon != null ? ' wv' : ''}" src="${u}" alt="">` : '';
}

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

export class DollPreview extends HeroPortrait {}

// A pixel icon of an item's real model (weapon, helm, chest, charm...), cached.
export function itemIconURL(item, cls = 'samurai') {
  if (!item) return '';
  const V = item.slot === 'weapon' ? getWeaponVisual(item) : null;
  const key = [item.base, item.r, item.unique || '', item.craft || '', item.slot, rarityTier(item) === 5 ? 'p' : ''].join('|');
  if (cache.has(key)) return cache.get(key);
  if (V && V.icon != null) {
    const img = atlas();
    if (img) { const url = atlasIcon(item, V, img); cache.set(key, url); return url; }
    if (cache.has('w3d|' + key)) return cache.get('w3d|' + key);
  }
  const r = renderer();
  const scene = new THREE.Scene(); lights(scene);
  let obj, size = 0.55, cy = 0.3;
  if (item.slot === 'weapon') {
    obj = weaponMesh(item, item.cls || cls);
    // the sheet's diagonal: grip bottom-left, business end top-right; flat-authored models
    // (bows) are shown in their own plane
    if (obj.userData.inner && obj.userData.inner !== obj) obj.userData.inner.rotation.set(0, 0, 0);
    obj.rotation.set(0, 0, -Math.PI / 4);
    if (item.kind === 'chain') obj.rotation.set(0.3, 0.5, -0.5); // a grip and its coil, turned to show the links
    tickPrism();
    const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    obj.position.sub(c); size = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.02; cy = 0;
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
  cache.set(V && V.icon != null ? 'w3d|' + key : key, url); // a stand-in until the atlas has loaded
  obj.traverse(o => o.geometry && o.geometry.dispose());
  return url;
}

// A head-and-shoulders portrait of the player's own character for the HUD profile card:
// the real model (appearance, class hat or helm, chest piece), three-quarter view, cached.
let portraitRT = null;
const portraitCache = new Map();
export function heroPortraitURL(cls, appearance, equip = {}) {
  const key = [cls, JSON.stringify(appearance || {}), equip.head ? equip.head.base : '', equip.chest ? equip.chest.base : ''].join('|');
  if (portraitCache.has(key)) return portraitCache.get(key);
  const r = renderer(), S = 96;
  if (!portraitRT) { portraitRT = new THREE.WebGLRenderTarget(S, S); portraitRT.texture.colorSpace = THREE.SRGBColorSpace; }
  const scene = new THREE.Scene(); lights(scene);
  const h = makeHero(cls, appearance); h.setGear({ head: equip.head, chest: equip.chest });
  h.root.rotation.y = 0.38; scene.add(h.root);
  const cam = new THREE.OrthographicCamera(-0.34, 0.34, 0.34, -0.34, 0.1, 20);
  cam.position.set(0, 0.9, 3); cam.lookAt(0, 0.8, 0);
  r.setRenderTarget(portraitRT); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
  const px = new Uint8Array(S * S * 4); r.readRenderTargetPixels(portraitRT, 0, 0, S, S, px); r.setRenderTarget(null);
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), row = S * 4;
  for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * row, (S - y) * row), y * row);
  const d = img.data, out = new Uint8ClampedArray(d); // 1px ink outline, like the item icons
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) { const i = (y * S + x) * 4; if (d[i + 3] > 0) continue; if (d[i + 7] || d[i - 1] || d[i + 3 + row] || d[i + 3 - row]) { out[i] = 30; out[i + 1] = 20; out[i + 2] = 16; out[i + 3] = 255; } }
  img.data.set(out); ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  h.dispose();
  portraitCache.set(key, url);
  return url;
}
