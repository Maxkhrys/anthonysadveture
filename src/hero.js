import { normalizeAppearance, FRAMES } from './appearance.js';
import { voxelHead, voxelEyes, voxelTorso, voxelArm, voxelLeg, classHat, CLASS_HAT } from './hero_voxel.js';
import { HEIRLOOM_BY_ID } from './rpg/heirlooms.js';
// Moss, the hero: a layered voxel figure whose equipment is drawn on the body.
// Visual slots: head, neck, chest, arms, legs, boots, weapon. Each slot reads the equipped
// item for that slot if one exists (inv.equip.head/helm, .neck/charm, .chest/armor, .arms,
// .legs, .boots, .weapon); arms/legs/boots fall back to the chest piece's matching set, so
// the figure always reads as one outfit. Nothing here touches item stats or rules.
import * as THREE from 'three';
import { geo, B, MAT, MAT_GLOW } from './models.js';
import { buildWeapon, chainStyle } from './weaponModels.js';
import { PRISM_MAT, applyWeaponElementVisual } from './weaponFx.js';
import { weaponElements } from './rpg/weaponVisuals.js';

const RAR = [0xd8d0c0, 0x6fdc5a, 0x4aa8ff, 0xc46bff, 0xff9a2a];
const SKIN = 0xf6cda6, SKIN_D = 0xe0a882, INKC = 0x1b1426;

// ------------------------------------------------------------------ class identity
export const CLASS_LOOK = {
  samurai: { shirt: 0x3e5d8e, shirtD: 0x2d4674, pants: 0x3a4062, boots: 0x4c3628, scarf: 0xe2483c, hair: 0x1a1420, sleeve: 0x3e5d8e, trim: 0xe0b860 },
  archer: { shirt: 0x5c8e46, shirtD: 0x46723a, pants: 0x6e5638, boots: 0x6e4629, scarf: 0xeac452, hair: 0x7a4a24, sleeve: 0x5c8e46, trim: 0xd8c08a },
  witch: { shirt: 0x6c4aa4, shirtD: 0x563a8a, pants: 0x46366e, boots: 0x3a2c52, scarf: 0x8ad870, hair: 0x8a5ac0, sleeve: 0x6c4aa4, trim: 0xe8c860 },
  // travelling cloth, aged leather, pale spectral teal
  soulbound: { shirt: 0x4a5566, shirtD: 0x39414f, pants: 0x464954, boots: 0x6a5038, scarf: 0x66b8b0, hair: 0x2c2834, sleeve: 0x566070, trim: 0xa8e8e0 },
};
const SPIRIT = 0x8fe3dc, SPIRIT_L = 0xc8b0ff, IRON = 0x5c5a5e, IRON_L = 0x8a8890, PAPER = 0xe8dcc0, LEATHER = 0x6a4a30;

// ------------------------------------------------------------------ armour looks by base
// main/second/trim colours plus a shape keyword the builders understand
const ARMOR_LOOK = {
  mosstunic: { main: 0x4f8a3a, second: 0x3a6a2a, trim: 0x8ac05a, shape: 'leafy', legs: 0x4a5a2a, boots: 0x5a4028, arms: 0x3a6a2a },
  gi: { main: 0xe8e2d4, second: 0x2f3f6a, trim: 0x2f3f6a, shape: 'wrap', legs: 0x2f3f6a, boots: 0x2a2020, arms: 0xe8e2d4 },
  jerkin: { main: 0x8a5a32, second: 0x5a3a20, trim: 0xc89a5a, shape: 'straps', legs: 0x4a3a2a, boots: 0x5a3a22, arms: 0x6a4428 },
  robe: { main: 0x2a2a6a, second: 0x1a1a4a, trim: 0xffd25e, shape: 'robe', legs: 0x1a1a4a, boots: 0x1a1430, arms: 0x2a2a6a },
  scalemail: { main: 0x9a3a2a, second: 0x6a2a20, trim: 0xe8c080, shape: 'scales', legs: 0x5a3a30, boots: 0x3a2a24, arms: 0x7a3024 },
  oyoroi: { main: 0xb02a2a, second: 0x2a1a1a, trim: 0xffd25e, shape: 'plate', legs: 0x2a1a1a, boots: 0x1a1414, arms: 0x8a2020 },
};
const HELM_LOOK = {
  acorncap: 'acorn', leafhood: 'leafhood', kabuto: 'kabuto', witchbrim: 'witchhat', rangercowl: 'cowl', bellhelm: 'bell',
};
const CHARM_LOOK = { bellcharm: 'bell', rabbitfoot: 'clover', emberlocket: 'locket', tidepearl: 'pearl' };

const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
// a box that renders unlit (ember stitching, porcelain cracks, lantern glass)
const G = (...a) => Object.assign(B(...a), { glow: true });
const BELL = 0xb88a3a, BELL_D = 0x7a5a26, BELL_L = 0xe0b860, TEAL = 0x2a5a5a;
const SHELL = 0x2a4a2a, SHELL_L = 0x5aa86a, THORN = 0x6a4a2a, LEAF = 0x5a9a3a;
const SOOT = 0x2a1a24, SOOT2 = 0x3a2432, EMBER = 0xff8a2a, CERAMIC = 0xe8e0d0;
// set pieces carry their set's look; arm/leg/boot pieces have their own
Object.assign(ARMOR_LOOK, {
  bw_chest: { main: BELL, second: TEAL, trim: BELL_L, shape: 'bellwarden', legs: TEAL, boots: BELL_D, arms: TEAL },
  ts_chest: { main: SHELL, second: LEAF, trim: SHELL_L, shape: 'thornstalker', legs: LEAF, boots: SHELL, arms: 0x3a5a2a },
  cw_chest: { main: SOOT, second: SOOT2, trim: EMBER, shape: 'cinderwoven', legs: SOOT2, boots: SOOT, arms: SOOT },
  leafwraps: { main: 0x5a9a3a, second: 0x3a6a2a }, beetlebracers: { main: 0x8a3a2a, second: 0xe8d0a0 },
  mossleggings: { main: 0x4a6a3a, second: 0x3a5a2a }, hakama: { main: 0x2f3f6a, second: 0x1f2f4a },
  barkboots: { main: 0x6a4a2a, second: 0x4a3018 }, wickboots: { main: 0xe8dcc0, second: 0x8a6a4a },
  bw_arms: { main: BELL, second: TEAL, set: 'bellwarden' }, bw_legs: { main: BELL, second: TEAL, set: 'bellwarden' }, bw_boots: { main: BELL_D, second: BELL_L, set: 'bellwarden' },
  ts_arms: { main: 0x3a5a2a, second: THORN, set: 'thornstalker' }, ts_legs: { main: LEAF, second: SHELL, set: 'thornstalker' }, ts_boots: { main: SHELL, second: SHELL_L, set: 'thornstalker' },
  cw_arms: { main: SOOT, second: EMBER, set: 'cinderwoven' }, cw_legs: { main: SOOT2, second: EMBER, set: 'cinderwoven' }, cw_boots: { main: SOOT, second: CERAMIC, set: 'cinderwoven' },
});
Object.assign(HELM_LOOK, { bw_helm: 'bellwarden', ts_helm: 'mantis', cw_helm: 'porcelain' });
Object.assign(CHARM_LOOK, { porcelainpendant: 'porcelain', clapperchain: 'clapper' });
const setOf = it => it && (it.set || (ARMOR_LOOK[it.base] && ARMOR_LOOK[it.base].set));

// which item fills each visual slot
export function gearVisual(equip = {}) {
  const e = equip || {};
  return {
    head: e.head || e.helm || null,
    neck: e.neck || e.necklace || e.charm || null,
    chest: e.chest || e.armor || null,
    arms: e.arms || e.gloves || null,
    legs: e.legs || e.pants || null,
    boots: e.boots || e.feet || null,
    weapon: e.weapon || null,
  };
}
function armorLook(it) {
  if (!it) return null;
  const L = ARMOR_LOOK[it.base] || { main: 0x8a7a6a, second: 0x5a4a3a, trim: 0xc0b090, shape: 'straps', legs: 0x4a3a2a, boots: 0x3a2a20, arms: 0x6a5a4a };
  return { ...L, rar: RAR[it.r || 0], r: it.r || 0, unique: it.unique };
}

// ------------------------------------------------------------------ builders
export function torsoParts(cls, chest) {
  const C = CLASS_LOOK[cls] || CLASS_LOOK.samurai;
  const A = armorLook(chest);
  const main = A ? A.main : C.shirt, second = A ? A.second : C.shirtD, trim = A ? A.trim : 0x6a4a2a;
  const P = [
    B(0.3, 0.22, 0.22, 0, 0.18, 0, main),            // chest
    B(0.26, 0.06, 0.2, 0, 0.14, 0, second),          // waist
    B(0.32, 0.045, 0.24, 0, 0.2, 0, A ? trim : 0x5a3a24), // belt
    B(0.06, 0.05, 0.02, 0, 0.2, 0.125, A ? RAR[A.r] : 0xffd25e), // buckle shows rarity
  ];
  if (!A) { // tailoring: a lit shoulder yoke, a crossed collar, a hem below the belt, a pouch
    const t = C.trim || 0xd8b060;
    P.push(B(0.31, 0.06, 0.23, 0, 0.34, 0, shade(main, 1.14)), B(0.33, 0.07, 0.235, 0, 0.1, 0, shade(main, 0.88)), B(0.12, 0.09, 0.02, 0.03, 0.1, 0.121, second));
    P.push(B(0.075, 0.05, 0.02, -0.035, 0.35, 0.117, t, 0, 0, 0.62), B(0.075, 0.05, 0.02, 0.035, 0.35, 0.117, shade(t, 0.85), 0, 0, -0.62));
    P.push(B(0.33, 0.012, 0.236, 0, 0.1, 0, t), B(0.07, 0.07, 0.06, 0.135, 0.15, 0.09, LEATHER), B(0.075, 0.025, 0.065, 0.135, 0.205, 0.09, shade(LEATHER, 1.3)), B(0.02, 0.02, 0.02, 0.135, 0.19, 0.125, t));
  }
  const shape = A ? A.shape : { samurai: 'wrap', archer: 'straps', witch: 'robe' }[cls];
  if (shape === 'wrap') P.push(B(0.07, 0.2, 0.02, -0.05, 0.2, 0.115, second, 0, 0, 0.5), B(0.07, 0.2, 0.02, 0.05, 0.2, 0.115, trim, 0, 0, -0.5));
  if (shape === 'straps') P.push(B(0.05, 0.26, 0.02, -0.06, 0.16, 0.115, second, 0, 0, 0.45), B(0.05, 0.26, 0.02, 0.06, 0.16, -0.115, second, 0, 0, -0.45));
  if (shape === 'leafy') P.push(B(0.16, 0.05, 0.2, -0.16, 0.38, 0, trim, 0, 0, 0.35), B(0.16, 0.05, 0.2, 0.16, 0.38, 0, trim, 0, 0, -0.35), B(0.1, 0.12, 0.02, 0, 0.26, 0.115, trim));
  if (shape === 'scales') for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c++) P.push(B(0.085, 0.05, 0.02, c * 0.09 + (r % 2) * 0.03, 0.24 + r * 0.055, 0.115, r % 2 ? main : shade(main, 1.2)));
  if (shape === 'bellwarden') {
    P.push(B(0.26, 0.26, 0.03, 0, 0.1, 0.12, TEAL), B(0.04, 0.26, 0.031, 0, 0.1, 0.122, BELL_L)); // teal tabard with a bronze seam
    for (const x of [-0.1, 0.1]) P.push(B(0.12, 0.13, 0.03, x, 0.24, 0.125, shade(BELL, 1.1)), B(0.02, 0.02, 0.02, x - 0.04, 0.33, 0.14, BELL_L), B(0.02, 0.02, 0.02, x + 0.04, 0.33, 0.14, BELL_L));
    for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) P.push(B(0.2 - i * 0.05, 0.05, 0.26 - i * 0.05, sgn * 0.21, 0.28 + i * 0.05, 0, i ? BELL : BELL_D)); // bell-shaped pauldrons
    P.push(B(0.06, 0.08, 0.06, 0, 0.38, 0.14, BELL_L)); // little clapper at the throat
  }
  if (shape === 'thornstalker') {
    P.push(B(0.28, 0.2, 0.03, 0, 0.18, 0.12, SHELL), B(0.2, 0.14, 0.031, 0.02, 0.22, 0.123, shade(SHELL, 1.35)), B(0.08, 0.05, 0.032, 0.05, 0.3, 0.125, SHELL_L)); // glossy shell plate + highlight
    for (const sgn of [-1, 1]) { P.push(B(0.16, 0.06, 0.24, sgn * 0.2, 0.34, 0, SHELL, 0, 0, sgn * -0.4)); for (let i = 0; i < 3; i++) P.push(B(0.025, 0.1, 0.025, sgn * (0.16 + i * 0.05), 0.4 + (i % 2) * 0.02, -0.02 + i * 0.03, THORN, 0, 0, sgn * -0.6)); }
    for (let i = 0; i < 5; i++) P.push(B(0.07, 0.12, 0.02, -0.14 + i * 0.07, 0.02, 0.12, i % 2 ? LEAF : shade(LEAF, 0.8), 0.2)); // leaf skirt strips
  }
  if (shape === 'cinderwoven') {
    P.push(B(0.34, 0.12, 0.26, 0, 0.04, 0, SOOT2), B(0.4, 0.1, 0.3, 0, -0.04, 0, SOOT), B(0.1, 0.12, 0.03, 0.08, 0.22, 0.125, CERAMIC), B(0.1, 0.1, 0.03, -0.08, 0.14, 0.125, CERAMIC)); // kiln-fired porcelain plates
    P.push(G(0.012, 0.28, 0.012, -0.03, 0.02, 0.124, EMBER), G(0.012, 0.012, 0.012, -0.03, 0.12, 0.13, 0xffd25e), G(0.1, 0.012, 0.012, 0.0, 0.24, 0.126, EMBER), G(0.06, 0.012, 0.012, -0.07, 0.07, 0.155, EMBER), G(0.012, 0.06, 0.012, 0.11, 0.2, 0.142, 0x3a1a1a)); // ember stitching + a crack
    for (const sgn of [-1, 1]) P.push(B(0.14, 0.07, 0.22, sgn * 0.2, 0.33, 0, CERAMIC, 0, 0, sgn * -0.3), G(0.1, 0.012, 0.012, sgn * 0.2, 0.37, 0.1, EMBER));
  }
  if (shape === 'plate') P.push(B(0.34, 0.1, 0.25, 0, 0.3, 0, shade(main, 1.15)), B(0.3, 0.04, 0.02, 0, 0.26, 0.125, trim), B(0.3, 0.04, 0.02, 0, 0.32, 0.125, trim));
  // class silhouettes that stay on over any armour
  if (cls === 'samurai') {
    P.push(B(0.18, 0.08, 0.24, -0.2, 0.34, 0, A && A.shape === 'plate' ? main : 0x3a3a52, 0, 0, 0.45), B(0.18, 0.08, 0.24, 0.2, 0.34, 0, A && A.shape === 'plate' ? main : 0x3a3a52, 0, 0, -0.45)); // sode shoulder guards
    P.push(B(0.06, 0.34, 0.06, -0.19, 0.08, -0.06, 0x1a1a2a, 0.9, 0, 0.25), B(0.07, 0.05, 0.07, -0.19, 0.22, 0.08, 0xd8342c, 0.9, 0, 0.25)); // saya (scabbard) on the hip
  }
  if (cls === 'archer') {
    P.push(B(0.12, 0.36, 0.1, 0.08, 0.2, -0.16, 0x7a4a2a, 0, 0, -0.35), B(0.02, 0.14, 0.02, 0.0, 0.52, -0.16, 0xf0f0f0, 0, 0, -0.35), B(0.03, 0.06, 0.03, -0.01, 0.62, -0.16, 0xe8424f, 0, 0, -0.35), B(0.02, 0.14, 0.02, 0.06, 0.54, -0.16, 0xf0f0f0, 0, 0, -0.35), B(0.03, 0.06, 0.03, 0.05, 0.64, -0.16, 0x7fd36a, 0, 0, -0.35)); // quiver + fletchings
    P.push(B(0.34, 0.28, 0.03, 0, 0.1, -0.13, 0x3a6a2e), B(0.3, 0.06, 0.03, 0, 0.06, -0.14, 0x2e5a24)); // short cape
  }
  if (cls === 'witch') {
    for (const x of [-.11,.09]) P.push(B(.018,.14,.018,x,.11,.14,0xb59a64),B(.05,.06,.035,x,.07,.145,0x92b5a0));
    P.push(B(.13,.17,.06,-.16,.12,-.08,0x6c4f38),B(.1,.13,.012,-.16,.14,-.045,0xd8c59d));
  }
  if (cls === 'soulbound') {
    P.push(B(.3,.05,.02,0,.26,.116,shade(second,1.25),0,0,-.55),B(.3,.04,.02,0,.12,.116,LEATHER,0,0,.5));
    P.push(B(.2,.3,.05,-.12,.14,-.1,0x2a2e36,.12,0,.1),B(.16,.06,.26,-.19,.38,-.01,0x2a2e36,0,0,.35),B(.14,.06,.05,-.16,-.02,-.11,0x22262c,.2));
    P.push(B(.3,.1,.12,0,.36,-.13,0x30353e),B(.22,.06,.06,0,.44,-.18,0x30353e));
    P.push(B(.05,.09,.01,.09,.07,.125,PAPER),B(.04,.07,.01,.15,.05,.11,PAPER,0,-.5));
    P.push(G(.02,.02,.012,.09,.12,.132,SPIRIT),G(.018,.018,.012,.15,.09,.118,SPIRIT_L));
    P.push(B(.09,.08,.07,-.15,.1,.08,LEATHER),B(.1,.02,.075,-.15,.18,.08,shade(LEATHER,1.3)),G(.025,.025,.02,-.15,.14,.12,SPIRIT));
  }
  if (cls === 'witch' || (A && (A.shape === 'robe' || A.shape === 'cinderwoven'))) {
    P.push(B(0.34, 0.12, 0.26, 0, 0.04, 0, second), B(0.4, 0.1, 0.3, 0, -0.04, 0, shade(second, 0.8)), B(0.44, 0.04, 0.32, 0, -0.06, 0, A ? trim : 0x2e1a4a)); // robe skirt to the ankles
    if (A && A.shape === 'robe') P.push(B(0.03, 0.03, 0.02, -0.08, 0.28, 0.115, 0xfff3b0), B(0.03, 0.03, 0.02, 0.07, 0.2, 0.115, 0xfff3b0), B(0.03, 0.03, 0.02, -0.12, 0.06, 0.155, 0xfff3b0));
  }
  return P;
}
export function legParts(cls, legsItem, bootsItem, chest, side) {
  const C = CLASS_LOOK[cls] || CLASS_LOOK.samurai, A = armorLook(chest);
  const L = legsItem ? armorLook(legsItem) : null, Bo = bootsItem ? armorLook(bootsItem) : null;
  const pants = L ? L.main : A ? A.legs : C.pants;
  const boot = Bo ? Bo.main : A ? A.boots : C.boots;
  const P = [B(0.11, 0.1, 0.12, 0, -0.12, 0, pants), B(0.13, 0.1, 0.16, 0, -0.21, 0.015, boot), B(0.135, 0.03, 0.165, 0, -0.14, 0.015, shade(boot, 1.25)), B(0.136, 0.022, 0.17, 0, -0.222, 0.017, shade(boot, 0.55)), B(0.1, 0.04, 0.03, 0, -0.2, 0.09, shade(boot, 1.15))];
  if ((Bo && Bo.r >= 2) || (A && A.r >= 3)) P.push(B(0.04, 0.04, 0.02, 0, -0.17, 0.1, (Bo || A).rar));
  if (cls === 'samurai' && !L) P.push(B(0.12, 0.08, 0.13, 0, -0.08, 0, shade(pants, 1.2))); // hakama flare
  const ls = setOf(legsItem), bs = setOf(bootsItem);
  if (ls === 'bellwarden') P.push(B(0.13, 0.08, 0.05, 0, -0.1, 0.05, BELL), B(0.13, 0.015, 0.052, 0, -0.06, 0.05, BELL_L));
  if (ls === 'thornstalker') P.push(B(0.12, 0.1, 0.02, 0, -0.12, 0.07, LEAF, 0.15), B(0.02, 0.06, 0.02, side * 0.06, -0.12, 0.02, THORN, 0, 0, side * 0.7));
  if (ls === 'cinderwoven') P.push(G(0.012, 0.08, 0.012, 0.03, -0.14, 0.062, EMBER));
  if (bs === 'bellwarden') P.push(B(0.12, 0.05, 0.08, 0, -0.23, 0.1, BELL_D), B(0.04, 0.04, 0.04, 0, -0.18, 0.1, BELL_L));
  if (bs === 'thornstalker') P.push(B(0.14, 0.05, 0.12, 0, -0.26, -0.04, SHELL_L), B(0.03, 0.08, 0.03, 0, -0.16, -0.09, THORN, -0.6)); // cricket-leg spur
  if (bs === 'cinderwoven') P.push(B(0.135, 0.02, 0.17, 0, -0.26, 0.015, CERAMIC), G(0.04, 0.012, 0.012, 0, -0.18, 0.1, EMBER));
  return P;
}
export function armParts(cls, armsItem, chest, side = 1) {
  const C = CLASS_LOOK[cls] || CLASS_LOOK.samurai, A = armorLook(chest), R = armsItem ? armorLook(armsItem) : null;
  const sleeve = A ? A.arms : C.sleeve;
  const bracer = R ? R.main : A && A.r >= 1 ? A.second : shade(sleeve, 0.8);
  const cap = B(0.115, 0.1, 0.115, 0, -0.07, 0, shade(sleeve, 1.12)); cap.round = true;
  const P = [cap, B(0.09, 0.12, 0.09, 0, -0.14, 0, sleeve), B(0.1, 0.06, 0.1, 0, -0.2, 0, bracer), B(0.104, 0.014, 0.104, 0, -0.15, 0, C.trim || 0xd8b060), B(0.085, 0.06, 0.085, 0, -0.26, 0, SKIN)];
  if (R && R.r >= 2) P.push(B(0.03, 0.03, 0.02, 0, -0.18, 0.055, R.rar));
  if (cls === 'witch') P.push(B(0.12, 0.05, 0.12, 0, -0.18, 0, shade(sleeve, 0.85))); // bell sleeves
  if (cls === 'soulbound' && side > 0) { for (let i=0;i<3;i++) P.push(B(.112,.022,.112,0,-.1-i*.045,0,i%2?IRON_L:IRON,0,i*.4)); P.push(G(.114,.014,.114,0,-.235,0,SPIRIT)); }
  if (cls === 'soulbound' && side < 0) P.push(B(.104,.03,.104,0,-.12,0,PAPER),B(.104,.02,.104,0,-.17,0,shade(PAPER,.85)));
  const as = setOf(armsItem);
  if (as === 'bellwarden') P.push(B(0.13, 0.08, 0.13, 0, -0.22, 0, BELL), B(0.14, 0.02, 0.14, 0, -0.17, 0, BELL_L));
  if (as === 'thornstalker') for (let i = 0; i < 3; i++) P.push(B(0.025, 0.07, 0.025, 0.05, -0.12 - i * 0.05, 0, THORN, 0, 0, -0.9));
  if (as === 'cinderwoven') P.push(B(0.105, 0.08, 0.105, 0, -0.26, 0, SOOT), G(0.106, 0.012, 0.106, 0, -0.21, 0, EMBER));
  // hands: a gripping fist with a thumb
  P.push(B(0.03, 0.035, 0.035, 0.035, -0.25, 0.035, SKIN_D), B(0.07, 0.016, 0.02, 0, -0.245, 0.044, SKIN_D));
  return P;
}
export function headParts(cls, appearance, opts = {}) {
  const a = normalizeAppearance(appearance), skin = Number(a.skin.replace('#','0x')), hair = Number(a.hairColor.replace('#','0x'));
  const width = {soft:.29,angular:.28,round:.32,long:.26}[a.face];
  const P = [B(width,.29,.275,0,.01,0,skin), B(.1,.065,.12,0,-.04,0,skin),
    B(.035,a.face==='long'?.065:.044,.038,0,.09,.138,shade(skin,.88)),
    B(.045,.012,.012,0,.05,.143,shade(skin,.58))];
  for(const side of [-1,1]) P.push(B(.045,.075,.064,side*width*.49,.1,0,skin));
  P[0].round = true;
  // a touch of warmth on the cheeks and the corners of a small smile
  const blush = new THREE.Color(skin).lerp(new THREE.Color(0xf07a7a), .45).getHex();
  for(const side of [-1,1]) P.push(B(.045,.02,.012,side*.095,.1,.128,blush), B(.012,.012,.012,side*.027,.058,.141,shade(skin,.58)));
  const add = (w,h,d,x,y,z,rz=0) => { const part=B(w,h,d,x,y,z,hair,0,0,rz); part.round=true; P.push(part); };
  if(a.hair !== 'shaved') {
    if (!opts.hat) add(width+.025,.07,.285,0,.267,-.01);
    const sheen = B(width*.55,.022,.12,-.03,.322,.03,shade(hair,1.55),0,0,-.12); sheen.round = true; if (!opts.hat) P.push(sheen); // light catching the crown
    add(width+.018,.14,.065,0,.16,-.13);
    if(['tousled','swept','undercut'].includes(a.hair) && !opts.hat) for(let i=0;i<4;i++) add(.085,.065,.15,-.105+i*.066,.27+(i%2)*.025,.063,a.hair==='swept'?-.3:(i%2?-.18:.2));
    if(a.hair==='cropped') add(width,.035,.07,0,.24,.115);
    if(['topknot','ponytail','braided'].includes(a.hair)) {
      if (!(opts.hat && a.hair==='topknot')) add(.095,.09,.095,0,a.hair==='topknot'?.32:.2,-.115);
      if(a.hair!=='topknot') for(let i=0;i<5;i++) add(a.hair==='braided'?.055:.075,.06,.07,(i%2)*.015,.17-i*.052,-.17-i*.009);
      P.push(B(.1,.018,.1,0,a.hair==='topknot'?.33:.21,-.116,0xb89c5c));
    }
    if(a.hair==='long') for(const side of [-1,1]) { add(.065,.29,.135,side*.146,-.005,-.035,side*.07); add(.09,.26,.05,side*.06,.015,-.15); }
    if(a.hair==='curly') for(let i=0;i<9;i++) { const angle=i/9*Math.PI*2; add(.09,.09,.09,Math.cos(angle)*.12,(opts.hat?.2:.25)+(i%2)*.035,Math.sin(angle)*.11); }
  }
  if(a.beard!=='none') {
    const h={stubble:.025,short:.06,full:.11,moustache:.024,forked:.13}[a.beard];
    if(a.beard==='moustache') {add(.07,h,.025,-.036,.069,.15,-.15);add(.07,h,.025,.036,.069,.15,.15);}
    else { add(.19,h,.045,0,.045-h,.125); if(a.beard==='forked') {add(.055,.04,.04,-.047,-.105,.124,.13);add(.055,.04,.04,.047,-.105,.124,-.13);} }
  }
  if(a.detail==='scar') P.push(B(.013,.083,.012,.075,.135,.147,shade(skin,.67),0,0,-.3));
  if(a.detail==='freckles') for(const side of [-1,1]) for(let i=0;i<3;i++) P.push(B(.009,.009,.012,side*(.066+i*.022),.103+(i%2)*.012,.143,shade(skin,.53)));
  if(a.detail==='warpaint') for(const side of [-1,1]) P.push(B(.078,.021,.013,side*.083,.112,.145,0x425e59,0,0,side*.16));
  if(a.detail==='runes') for(let i=0;i<3;i++) P.push(B(.013,.025,.014,-.023+i*.023,.235-(i%2)*.01,.144,0x567974));
  if(cls==='soulbound' && a.hair!=='shaved') { add(.24,.08,.05,.06,.24,.16,-.35); add(.06,.1,.05,-.15,.2,.16,.25); add(.07,.18,.08,-.2,.08,.02); }
  return P;
}
// hats / helms: the class hat when no helm is worn, so the silhouette always reads
export function helmParts(cls, helm) {
  const kind = helm ? (HELM_LOOK[helm.base] || 'cap') : { samurai: 'none', archer: 'hood', witch: 'witchhat', soulbound: 'none' }[cls];
  // (a porcelain mask covers the face: the eyes show through as dark slits)
  const rar = helm ? RAR[helm.r || 0] : 0xffd25e;
  const P = [];
  switch (kind) {
    case 'acorn': P.push(B(0.44, 0.1, 0.4, 0, 0.24, 0, 0x9a5f2c), B(0.38, 0.08, 0.34, 0, 0.33, 0, 0x7a4a1e), B(0.24, 0.05, 0.22, 0, 0.4, 0, 0x9a5f2c), B(0.04, 0.09, 0.04, 0, 0.44, 0, 0x5a3a1a), B(0.46, 0.03, 0.42, 0, 0.26, 0, 0xb87a3a)); break;
    case 'leafhood': P.push(B(0.44, 0.22, 0.4, 0, 0.18, -0.02, 0x4f9a3a), B(0.3, 0.06, 0.3, 0, 0.4, -0.04, 0x5aaa44), B(0.06, 0.2, 0.02, 0, 0.42, 0.02, 0x3a7a2a, -0.5), B(0.46, 0.04, 0.04, 0, 0.2, 0.18, 0x3a7a2a)); break;
    case 'kabuto': P.push(B(0.44, 0.16, 0.4, 0, 0.22, 0, 0x2a2a3a), B(0.5, 0.05, 0.46, 0, 0.2, 0, 0x3a3a4a), B(0.12, 0.14, 0.4, -0.26, 0.1, -0.02, 0x2a2a3a, 0, 0, 0.3), B(0.12, 0.14, 0.4, 0.26, 0.1, -0.02, 0x2a2a3a, 0, 0, -0.3), B(0.3, 0.16, 0.03, 0, 0.36, 0.18, 0xffd25e, 0, 0, 0), B(0.05, 0.05, 0.03, 0, 0.36, 0.2, rar)); break; // horned crest (kuwagata)
    case 'witchhat': P.push(B(0.6, 0.04, 0.56, 0, 0.22, 0, helm ? 0x3a2a6a : 0x2e1a4a), B(0.38, 0.14, 0.36, 0, 0.26, 0, helm ? 0x4a3a8a : 0x44296e), B(0.28, 0.14, 0.26, 0.02, 0.4, -0.02, helm ? 0x4a3a8a : 0x44296e, -0.1), B(0.18, 0.14, 0.16, 0.05, 0.52, -0.07, helm ? 0x4a3a8a : 0x44296e, -0.28), B(0.09, 0.13, 0.09, 0.08, 0.63, -0.14, helm ? 0x4a3a8a : 0x44296e, -0.55), B(0.4, 0.04, 0.38, 0, 0.27, 0, helm ? rar : 0xffd25e), B(0.06, 0.06, 0.02, 0.1, 0.31, 0.19, 0x7fd36a)); break;
    case 'hood': case 'cowl': {
      const c = kind === 'cowl' ? 0x5a4a3a : 0x3a6a2e, c2 = kind === 'cowl' ? 0x6a5a48 : 0x4a7a3a;
      P.push(B(0.44, 0.22, 0.2, 0, 0.16, -0.1, c), B(0.44, 0.08, 0.4, 0, 0.3, -0.01, c2), B(0.06, 0.26, 0.32, -0.21, 0.04, -0.02, c), B(0.06, 0.26, 0.32, 0.21, 0.04, -0.02, c), B(0.16, 0.14, 0.12, 0, 0.26, -0.22, c, -0.7), B(0.08, 0.1, 0.08, 0, 0.3, -0.32, c, -1.0));
      if (kind === 'hood') P.push(B(0.1, 0.03, 0.06, 0.13, 0.37, 0.05, 0xe8424f, 0, 0.4, 0.3)); // feather
      else P.push(B(0.44, 0.03, 0.03, 0, 0.26, 0.19, rar));
      break;
    }
    case 'bell': P.push(B(0.46, 0.2, 0.42, 0, 0.18, 0, 0xc89a3a), B(0.36, 0.1, 0.32, 0, 0.38, 0, 0xd8aa4a), B(0.2, 0.06, 0.2, 0, 0.47, 0, 0xc89a3a), B(0.5, 0.04, 0.46, 0, 0.18, 0, 0xe8c060), B(0.06, 0.06, 0.02, 0, 0.3, 0.22, rar)); break;
    case 'bellwarden': P.push(B(0.46, 0.2, 0.42, 0, 0.16, 0, BELL), B(0.38, 0.1, 0.34, 0, 0.36, 0, shade(BELL, 1.1)), B(0.22, 0.06, 0.2, 0, 0.46, 0, BELL), B(0.5, 0.05, 0.46, 0, 0.16, 0, BELL_L), B(0.04, 0.16, 0.04, 0, 0.52, 0, BELL_D), B(0.1, 0.08, 0.1, 0, 0.62, 0, BELL_L)); break; // bell helm with a clapper crest
    case 'mantis': P.push(B(0.42, 0.18, 0.38, 0, 0.2, -0.02, SHELL), B(0.3, 0.06, 0.32, 0, 0.38, -0.02, shade(SHELL, 1.3)), G(0.1, 0.1, 0.06, -0.16, 0.26, 0.16, 0x9aff6a), G(0.1, 0.1, 0.06, 0.16, 0.26, 0.16, 0x9aff6a), B(0.02, 0.26, 0.02, -0.08, 0.42, 0.06, THORN, -0.5, 0, 0.3), B(0.02, 0.26, 0.02, 0.08, 0.42, 0.06, THORN, -0.5, 0, -0.3), B(0.44, 0.06, 0.06, 0, 0.14, 0.18, SHELL_L)); break;
    case 'porcelain': P.push(B(0.44, 0.24, 0.4, 0, 0.16, -0.03, SOOT), B(0.3, 0.1, 0.3, 0, 0.38, -0.05, SOOT2, -0.2), B(0.34, 0.26, 0.04, 0, -0.06, 0.19, CERAMIC), G(0.01, 0.14, 0.012, 0.06, -0.02, 0.213, EMBER), G(0.05, 0.01, 0.012, 0.08, 0.05, 0.213, EMBER), B(0.06, 0.03, 0.01, -0.08, 0.05, 0.212, 0x1a1020), B(0.06, 0.03, 0.01, 0.08, 0.05, 0.212, 0x1a1020)); break; // hood + cracked porcelain mask
    case 'cap': P.push(B(0.42, 0.12, 0.38, 0, 0.24, 0, 0x7a6a5a), B(0.06, 0.06, 0.02, 0, 0.28, 0.2, rar)); break;
  }
  return P;
}
export function neckParts(charm) {
  if (!charm) return [];
  const kind = CHARM_LOOK[charm.base] || 'bell', rar = RAR[charm.r || 0];
  const P = [B(0.22, 0.02, 0.02, 0, 0.36, 0.12, 0xc0a060)];
  if (kind === 'bell') P.push(B(0.06, 0.06, 0.04, 0, 0.29, 0.13, 0xe8c060), B(0.08, 0.02, 0.05, 0, 0.29, 0.13, 0xffd25e));
  if (kind === 'clover') P.push(B(0.04, 0.04, 0.02, -0.02, 0.3, 0.13, 0x6fdc5a), B(0.04, 0.04, 0.02, 0.02, 0.3, 0.13, 0x6fdc5a), B(0.04, 0.04, 0.02, 0, 0.33, 0.13, 0x6fdc5a));
  if (kind === 'locket') P.push(B(0.06, 0.07, 0.03, 0, 0.29, 0.13, 0xff8a2a));
  if (kind === 'pearl') P.push(B(0.05, 0.05, 0.05, 0, 0.29, 0.13, 0xe8f4ff));
  if (kind === 'porcelain') P.push(B(0.07, 0.08, 0.03, 0, 0.28, 0.13, CERAMIC), G(0.01, 0.06, 0.012, 0.01, 0.29, 0.147, EMBER));
  if (kind === 'clapper') P.push(B(0.03, 0.06, 0.03, 0, 0.3, 0.13, BELL_D), B(0.06, 0.05, 0.04, 0, 0.26, 0.13, BELL_L));
  P.push(B(0.02, 0.02, 0.02, 0.03, 0.31, 0.15, rar));
  return P;
}

// ------------------------------------------------------------------ weapons
// Every weapon returns { parts, glow, scale } with the grip at the origin and the business
// end pointing along +y. `scale` lets rare oversized weapons grow cleanly (item.visualScale).
function blade({ L = 0.56, w = 0.055, col = 0xdfe8f0, edge = 0xffffff, curve = 0.06, y0 = 0.14, segs = 5, spine = null, tip = true }) {
  const P = [];
  for (let i = 0; i < segs; i++) {
    const k = i / segs, h = L / segs, zc = -curve * k * k, a = -curve * 2 * k * 0.9;
    P.push(B(w, h + 0.01, 0.022, 0, y0 + i * h, zc, col, a), B(w * 0.38, h + 0.01, 0.026, w * 0.28, y0 + i * h, zc, edge, a));
    if (spine) P.push(B(0.012, h * 0.6, 0.03, -w * 0.5, y0 + i * h + h * 0.2, zc, spine, a));
  }
  if (tip) P.push(B(w * 0.8, 0.09, 0.022, -w * 0.12, y0 + L - 0.01, -curve * 1.05, col, -curve * 1.8, 0, 0.35));
  return P;
}
const hilt = (col = 0x2a1a2a, wrap = 0xe8e0d0, len = 0.15) => [B(0.05, len, 0.05, 0, -len + 0.08, 0, col), B(0.052, 0.02, 0.052, 0, -0.03, 0, wrap), B(0.052, 0.02, 0.052, 0, 0.02, 0, wrap), B(0.06, 0.03, 0.06, 0, -len + 0.06, 0, 0xc0a060)];
const tsuba = (col = 0xc0a060, w = 0.13) => [B(w, 0.03, w * 0.8, 0, 0.1, 0, col)];

function katana(base, it) {
  const r = it ? it.r : 0;
  switch (base) {
    case 'shinai': { const P = [...hilt(0x8a6a3a, 0x5a3a20, 0.14), ...tsuba(0x6a4a2a, 0.1)]; for (let i = 0; i < 4; i++) P.push(B(0.05, 0.13, 0.05, 0, 0.13 + i * 0.13, 0, 0xd8c070), B(0.056, 0.02, 0.056, 0, 0.13 + i * 0.13, 0, 0x9a8040)); return { parts: P }; }
    case 'rustkatana': return { parts: [...hilt(), ...tsuba(0x7a5a3a), ...blade({ col: 0xa8886a, edge: 0xc8b8a0, curve: 0.05 }), B(0.03, 0.03, 0.03, 0.02, 0.4, 0, 0x6a3a1a)] };
    case 'wakizashi': return { parts: [...hilt(0x1a1a2a, 0xd8342c, 0.12), B(0.11, 0.03, 0.11, 0, 0.1, 0, 0xffd25e), ...blade({ L: 0.4, col: 0xdfe8f0, curve: 0.04 })] };
    case 'tachi': return { parts: [...hilt(0x2a1a1a, 0xc0a060), ...tsuba(0xc0a060, 0.12), ...blade({ L: 0.62, col: 0xe6eef6, curve: 0.12 })] };
    case 'uchigatana': return { parts: [...hilt(0x1a2a4a, 0x4a7ac0), B(0.12, 0.03, 0.12, 0, 0.1, 0, 0x3a3a4a), ...blade({ L: 0.6, col: 0xf0f6ff, curve: 0.07 })] };
    case 'nodachi': return { parts: [...hilt(0x2a1a2a, 0xe8e0d0, 0.24), ...tsuba(0xc0a060, 0.14), ...blade({ L: 0.95, w: 0.06, col: 0xcfd8e8, curve: 0.1, segs: 7 })], scale: 1.1 };
    case 'moonkatana': return { parts: [...hilt(0x1a1a3a, 0xb8d8ff), B(0.14, 0.03, 0.08, 0, 0.1, 0, 0xb8d8ff, 0, 0, 0.3)], glow: blade({ L: 0.62, col: 0xb8d8ff, edge: 0xffffff, curve: 0.09 }) };
    case 'onicleaver': return { parts: [...hilt(0x2a0a0a, 0x6a2020, 0.2), B(0.2, 0.06, 0.14, 0, 0.1, 0, 0x3a1a1a), B(0.06, 0.05, 0.03, -0.05, 0.12, 0.07, 0xffd25e), B(0.06, 0.05, 0.03, 0.05, 0.12, 0.07, 0xffd25e),
      B(0.16, 0.74, 0.04, 0.02, 0.14, 0, 0xc84a4a), B(0.06, 0.72, 0.045, 0.08, 0.15, 0, 0xe8a0a0), ...[0.3, 0.5, 0.7].map(y => B(0.05, 0.06, 0.04, -0.09, y, 0, 0xe8d8c0, 0, 0, 0.6))], scale: 1.15 };
    case 'dragontachi': return { parts: [...hilt(0x3a2a1a, 0xf0e0b0), B(0.16, 0.05, 0.12, 0, 0.1, 0, 0xf0e0b0), B(0.05, 0.06, 0.05, 0.06, 0.12, 0.05, 0x7fd36a), ...blade({ L: 0.64, col: 0xf0e0b0, edge: 0xffffff, curve: 0.1, spine: 0xc8b890 })] };
    case 'stormedge': { const P = [...hilt(0x1a2a3a, 0x9ad8ff), ...tsuba(0x5a7aa0)]; const G = blade({ L: 0.6, col: 0x9ad8ff, edge: 0xffffff, curve: 0.06 }); for (let i = 0; i < 4; i++) G.push(B(0.02, 0.08, 0.03, (i % 2 ? 0.02 : -0.02), 0.2 + i * 0.12, 0.012, 0xffffff, 0, 0, i % 2 ? 0.6 : -0.6)); return { parts: P, glow: G }; }
  }
  return { parts: [...hilt(), ...tsuba(), ...blade({ col: it && it.col || 0xdfe8f0 })] };
}
function bow(base, it) {
  const col = ({ twigbow: 0x9a7a4a, huntbow: 0x7a5a3a, recurve: 0x8a3a2a, longbow: 0x6a4a2a, composite: 0xa06a3a, reedbow: 0x8ab04a, elmwarbow: 0x5a3a1a, galebow: 0x7ad8ff, sunbow: 0xffd25e })[base] || 0x7a5a3a;
  const big = base === 'longbow' || base === 'elmwarbow';
  const h = big ? 0.46 : 0.34, thick = base === 'elmwarbow' ? 0.06 : 0.04;
  const recurve = base === 'recurve' || base === 'composite' || base === 'sunbow';
  const P = [B(0.055, 0.12, 0.055, 0, -0.06, 0, 0x3a2a1a)];
  // limbs, drawn as 3 segments each so they curve
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
    const k = (i + 0.5) / 3, y = s * (0.05 + k * h), z = 0.1 * Math.sin(k * Math.PI * 0.8) - (recurve && i === 2 ? 0.05 : 0);
    P.push(B(thick, h / 3 + 0.02, thick, 0, y - h / 6, z, i === 2 && recurve ? shade(col, 0.7) : col, s * (0.35 - i * 0.25)));
  }
  P.push(B(0.012, h * 2.1, 0.012, 0, -h * 1.05, -0.03, 0xf0f0e8));
  const G = [];
  if (base === 'reedbow') P.push(B(0.03, 0.12, 0.03, 0, h + 0.02, 0.05, 0xe0b83a), B(0.03, 0.12, 0.03, 0, -h - 0.14, 0.05, 0xe0b83a));
  if (base === 'twigbow') P.push(B(0.08, 0.04, 0.02, 0.04, 0.2, 0.08, 0x6aa84a, 0, 0, 0.5), B(0.08, 0.04, 0.02, -0.04, -0.22, 0.08, 0x6aa84a, 0, 0, -0.5));
  if (base === 'galebow') G.push(B(0.12, 0.04, 0.02, 0.06, h - 0.02, 0.06, 0xdff8ff, 0, 0, 0.5), B(0.12, 0.04, 0.02, 0.06, -h + 0.02, 0.06, 0xdff8ff, 0, 0, -0.5));
  if (base === 'sunbow') G.push(B(0.12, 0.12, 0.03, 0, 0, 0.05, 0xfff3b0), B(0.18, 0.03, 0.02, 0, 0, 0.05, 0xffd25e), B(0.03, 0.18, 0.02, 0, 0, 0.05, 0xffd25e));
  P.push(B(0.06, 0.06, 0.06, 0, -0.02, 0.04, RAR[it ? it.r : 0]));
  return { parts: P, glow: G, scale: big ? 1.1 : 1 };
}
function staff(base, it) {
  const W = { twigwand: [0x9a7a4a, 0xc89aff, 0.42], acornstaff: [0x7a5a3a, 0x9a6f3a, 0.82], crookstaff: [0x5a4a3a, 0x7fd36a, 0.84], shroomwand: [0xf0e6d0, 0xe05a48, 0.44], candlestaff: [0x6a4a3a, 0xffb347, 0.86],
    owlstaff: [0x8a6a4a, 0xfff3b0, 0.88], hexwand: [0xe8e0d0, 0x8b5cf6, 0.46], frostrod: [0xaad8ff, 0xdff4ff, 0.84], starstaff: [0x3a3a6a, 0xfff3b0, 0.9] }[base] || [0x6a4a2a, 0xc89aff, 0.8];
  const [wood, orb, len] = W;
  const P = [B(0.045, len, 0.045, 0, -len * 0.42, 0, wood), B(0.055, 0.03, 0.055, 0, len * 0.2, 0, shade(wood, 0.7)), B(0.055, 0.03, 0.055, 0, -len * 0.3, 0, shade(wood, 0.7))];
  const G = [];
  const top = len * 0.58;
  switch (base) {
    case 'acornstaff': P.push(B(0.14, 0.12, 0.14, 0, top, 0, 0x9a6f3a), B(0.16, 0.05, 0.16, 0, top + 0.1, 0, 0x6a4a1e), B(0.03, 0.05, 0.03, 0, top + 0.15, 0, 0x5a3a1a)); break;
    case 'crookstaff': P.push(B(0.045, 0.14, 0.045, 0.04, top, 0, wood, 0, 0, -0.6), B(0.045, 0.1, 0.045, 0.1, top + 0.1, 0, wood, 0, 0, -1.6)); G.push(B(0.09, 0.09, 0.09, 0.1, top - 0.02, 0, orb)); break;
    case 'shroomwand': P.push(B(0.2, 0.08, 0.2, 0, top, 0, 0xe05a48), B(0.12, 0.05, 0.12, 0, top + 0.08, 0, 0xe86a58), B(0.04, 0.02, 0.04, 0.06, top + 0.1, 0.03, 0xffffff), B(0.04, 0.02, 0.04, -0.05, top + 0.07, -0.05, 0xffffff)); break;
    case 'candlestaff': P.push(B(0.16, 0.04, 0.16, 0, top, 0, 0xc0a060), B(0.08, 0.14, 0.08, 0, top + 0.04, 0, 0xf8f0e0)); G.push(B(0.05, 0.08, 0.05, 0, top + 0.2, 0, orb), B(0.03, 0.05, 0.03, 0, top + 0.26, 0, 0xfff3b0)); break;
    case 'owlstaff': P.push(B(0.16, 0.16, 0.14, 0, top, 0, 0x8a6a4a), B(0.05, 0.06, 0.04, -0.05, top + 0.16, 0, 0x6a4a2a), B(0.05, 0.06, 0.04, 0.05, top + 0.16, 0, 0x6a4a2a), B(0.04, 0.04, 0.03, 0, top + 0.05, 0.08, 0xe0a030)); G.push(B(0.04, 0.04, 0.02, -0.04, top + 0.1, 0.075, orb), B(0.04, 0.04, 0.02, 0.04, top + 0.1, 0.075, orb)); break;
    case 'hexwand': P.push(B(0.1, 0.06, 0.06, 0, top, 0, 0xe8e0d0), B(0.04, 0.12, 0.04, -0.04, top + 0.04, 0, 0xe8e0d0, 0, 0, 0.4)); G.push(B(0.08, 0.08, 0.08, 0.03, top + 0.12, 0, orb)); break;
    case 'frostrod': G.push(B(0.08, 0.24, 0.08, 0, top, 0, orb, 0, 0.78), B(0.05, 0.14, 0.05, 0.06, top - 0.02, 0, 0xaad8ff, 0, 0, -0.5), B(0.05, 0.14, 0.05, -0.06, top - 0.02, 0, 0xaad8ff, 0, 0, 0.5)); break;
    case 'starstaff': P.push(B(0.2, 0.03, 0.03, 0, top, 0, 0xc0a060)); G.push(B(0.16, 0.05, 0.03, 0, top + 0.1, 0, orb), B(0.05, 0.16, 0.03, 0, top + 0.1, 0, orb), B(0.1, 0.1, 0.03, 0, top + 0.1, 0, orb, 0, 0, 0.78)); break;
    default: G.push(B(0.12, 0.12, 0.12, 0, top, 0, orb));
  }
  P.push(B(0.06, 0.04, 0.06, 0, top - 0.04, 0, RAR[it ? it.r : 0]));
  return { parts: P, glow: G };
}
// Hand-made Legendaries get their own silhouette on top of the base weapon
function legendary(u, W) {
  const P = W.parts, G = W.glow || (W.glow = []);
  switch (u) {
    case 'rootcleaver': P.push(...[0.2, 0.4, 0.6].map(y => B(0.2, 0.04, 0.05, 0, y, 0.03, 0x5a4030, 0, 0, 0.5)), B(0.05, 0.08, 0.05, 0.1, 0.5, 0.05, 0x7fd36a)); G.push(B(0.04, 0.04, 0.04, -0.08, 0.35, 0.05, 0x7fd36a)); break;
    case 'crescent': W.glow = blade({ L: 0.62, col: 0xff4a5a, edge: 0xffb0b0, curve: 0.16 }); break;
    case 'silentdawn': G.push(B(0.02, 0.56, 0.03, 0.03, 0.16, 0.012, 0xfff3b0)); break;
    case 'onigrin': P.push(B(0.15, 0.08, 0.1, 0, 0.1, 0, 0x1a0a0a)); G.push(B(0.1, 0.02, 0.02, 0, 0.1, 0.06, 0xff3a3a), B(0.02, 0.02, 0.02, -0.04, 0.12, 0.06, 0xff3a3a), B(0.02, 0.02, 0.02, 0.04, 0.12, 0.06, 0xff3a3a)); break;
    case 'windwhisper': G.push(B(0.2, 0.06, 0.02, 0.1, 0.3, 0.08, 0xffffff, 0, 0, 0.6), B(0.2, 0.06, 0.02, 0.1, -0.3, 0.08, 0xffffff, 0, 0, -0.6), B(0.14, 0.05, 0.02, 0.1, 0.22, 0.08, 0xdff8ff, 0, 0, 0.4)); break;
    case 'sunshot': G.push(B(0.2, 0.2, 0.03, 0, 0, 0.06, 0xff9a2a, 0, 0, 0.78), B(0.14, 0.14, 0.035, 0, 0, 0.06, 0xfff3b0)); break;
    case 'thornquill': P.push(...[-0.2, -0.1, 0.1, 0.2].map(y => B(0.06, 0.03, 0.02, 0.03, y, 0.1, 0x5a8a3a, 0, 0, y > 0 ? 0.6 : -0.6))); break;
    case 'huntermoon': G.push(B(0.16, 0.16, 0.02, 0, 0.02, 0.07, 0xdff4ff), B(0.12, 0.12, 0.025, 0.04, 0.04, 0.07, 0x1a1a3a)); break;
    case 'hexbloom': G.push(...[0, 1, 2, 3, 4].map(i => B(0.08, 0.03, 0.03, Math.cos(i * 1.26) * 0.07, 0.34 + Math.sin(i * 1.26) * 0.07, 0.02, 0xc46bff, 0, 0, i * 1.26))); break;
    case 'candlewick': G.push(B(0.03, 0.06, 0.03, -0.08, 0.56, 0, 0xffb347), B(0.03, 0.06, 0.03, 0.08, 0.56, 0, 0xffb347)); P.push(B(0.05, 0.1, 0.05, -0.08, 0.44, 0, 0xf8f0e0), B(0.05, 0.1, 0.05, 0.08, 0.44, 0, 0xf8f0e0)); break;
    case 'owlhollow': P.push(B(0.3, 0.06, 0.04, 0, 0.52, -0.02, 0x6a4a2a)); G.push(B(0.05, 0.05, 0.02, -0.04, 0.58, 0.08, 0x7fd36a), B(0.05, 0.05, 0.02, 0.04, 0.58, 0.08, 0x7fd36a)); break;
    case 'starfall': G.push(B(0.26, 0.06, 0.03, 0, 0.62, 0, 0xfff3b0), B(0.06, 0.26, 0.03, 0, 0.62, 0, 0xfff3b0), B(0.12, 0.12, 0.04, 0, 0.62, 0, 0xffd25e, 0, 0, 0.78)); W.scale = (W.scale || 1) * 1.08; break;
  }
  return W;
}
// Named weapons: each its own silhouette (never a recolour of a base weapon)
function named(base, it) {
  const r = it ? it.r : 4;
  switch (base) {
    case 'seamripper': { // a needle-thin blade with a thread eye and a stitched grip
      const P = [...hilt(0x3a2a3a, 0xd84a6a, 0.16), B(0.12, 0.02, 0.1, 0, 0.1, 0, 0xc0c0c8)];
      for (let i = 0; i < 6; i++) P.push(B(0.03 - i * 0.003, 0.12, 0.018, 0, 0.12 + i * 0.12, 0, i % 2 ? 0xe8eef4 : 0xd0d8e0));
      P.push(B(0.05, 0.05, 0.02, 0, 0.84, 0, 0xc0c0c8), B(0.02, 0.025, 0.022, 0, 0.855, 0, 0x1a1a2a)); // the eye
      return { parts: P, glow: [B(0.012, 0.3, 0.012, 0.03, 0.55, 0.02, 0xd84a6a, 0, 0, 0.3), B(0.012, 0.012, 0.3, 0.06, 0.4, 0.1, 0xd84a6a)] };
    }
    case 'wickblade': { // wax blade: drips down the edge, a live flame on the tip
      const P = [...hilt(0x5a3a2a, 0xc89a5a, 0.15), B(0.14, 0.04, 0.1, 0, 0.1, 0, 0xc0a060)];
      for (let i = 0; i < 5; i++) P.push(B(0.06, 0.12, 0.03, 0, 0.14 + i * 0.11, -0.01 * i, i % 2 ? 0xf0e4c8 : 0xe8dcc0), B(0.025, 0.04 + (i % 3) * 0.02, 0.032, 0.035, 0.18 + i * 0.11, -0.01 * i, 0xf8f0dc));
      return { parts: P, glow: [B(0.012, 0.06, 0.012, 0, 0.7, -0.05, 0x3a2a1a), B(0.05, 0.08, 0.05, 0, 0.74, -0.05, 0xffb347), B(0.03, 0.05, 0.03, 0, 0.8, -0.05, 0xfff3b0)] };
    }
    case 'bellclapper': { // a bronze bell-clapper swung like a greatsword
      const P = [B(0.05, 0.3, 0.05, 0, -0.2, 0, 0x3a2a1a), B(0.06, 0.03, 0.06, 0, -0.2, 0, BELL_L), B(0.07, 0.04, 0.07, 0, 0.1, 0, BELL_D), B(0.045, 0.5, 0.045, 0, 0.1, 0, BELL_D)];
      for (let i = 0; i < 4; i++) P.push(B(0.1 + i * 0.03, 0.07, 0.1 + i * 0.03, 0, 0.58 + i * 0.06, 0, i % 2 ? BELL : shade(BELL, 1.12)));
      P.push(B(0.2, 0.1, 0.2, 0, 0.82, 0, BELL), B(0.14, 0.06, 0.14, 0, 0.92, 0, BELL_L), B(0.06, 0.03, 0.21, 0, 0.7, 0, 0x5a8a7a)); // verdigris band
      return { parts: P, glow: [B(0.04, 0.04, 0.04, 0, 0.98, 0, 0xfff3b0)], scale: 1.1 };
    }
    case 'hatpin': { // a long hatpin: pearl head, rose ribbon, needle point
      const P = [B(0.022, 0.9, 0.022, 0, -0.05, 0, 0xe0e4ec), B(0.012, 0.12, 0.012, 0, 0.85, 0, 0xffffff)];
      P.push(B(0.1, 0.1, 0.1, 0, -0.14, 0, 0xf4eee4), B(0.06, 0.06, 0.06, 0.03, -0.1, 0.03, 0xffffff), B(0.14, 0.03, 0.03, 0, -0.03, 0, 0xd86a8a, 0, 0, 0.4), B(0.03, 0.08, 0.02, 0.06, -0.08, 0, 0xd86a8a, 0, 0, 0.6));
      return { parts: P, glow: [] };
    }
    case 'lilypad': { // a reed longbow with lily pads at the tips and a frog-green grip
      const W = bow('longbow', it); W.parts = W.parts.map(p => (p[6] === 0x6a4a2a ? [...p.slice(0, 6), 0x5a8a3a, ...p.slice(7)] : p));
      W.parts.push(B(0.18, 0.02, 0.18, 0, 0.5, 0.06, 0x4a9a3a), B(0.06, 0.021, 0.06, 0.05, 0.5, 0.1, 0x2a6a2a), B(0.18, 0.02, 0.18, 0, -0.52, 0.06, 0x4a9a3a), B(0.06, 0.06, 0.06, 0, 0.53, 0.1, 0xf0a0c0));
      return W;
    }
    case 'spoolstring': { // two wooden spool ends for limbs, strung with red thread
      const P = [B(0.055, 0.14, 0.055, 0, -0.07, 0, 0x6a4a2a)];
      for (const sg of [1, -1]) { P.push(B(0.04, 0.24, 0.04, 0, sg * 0.18 - 0.12, 0.06, 0xb07a4a, sg * 0.4), B(0.14, 0.05, 0.14, 0, sg * 0.34, 0.12, 0xc89060), B(0.1, 0.06, 0.1, 0, sg * 0.34 - 0.04, 0.12, 0xd84a6a)); }
      P.push(B(0.012, 0.66, 0.012, 0, -0.34, 0.1, 0xd84a6a));
      return { parts: P, glow: [B(0.03, 0.03, 0.03, 0, 0.34, 0.2, 0xd84a6a)] };
    }
    case 'glasswing': { // pale limbs with translucent dragonfly wings
      const W = bow('recurve', it); W.parts = W.parts.map(p => (p[6] === 0x8a3a2a || p[6] === shade(0x8a3a2a, 0.7) ? [...p.slice(0, 6), 0xd8e8f0, ...p.slice(7)] : p));
      W.glow = [B(0.26, 0.05, 0.015, 0.14, 0.24, 0.05, 0xbfe8f0, 0, 0, 0.35), B(0.22, 0.05, 0.015, 0.12, 0.18, 0.05, 0xdff8ff, 0, 0, 0.2), B(0.26, 0.05, 0.015, 0.14, -0.24, 0.05, 0xbfe8f0, 0, 0, -0.35), B(0.22, 0.05, 0.015, 0.12, -0.18, 0.05, 0xdff8ff, 0, 0, -0.2)];
      return W;
    }
    case 'mothlight': { // a crook with a hanging lantern and a moth circling it
      const W = staff('crookstaff', it);
      W.parts.push(B(0.012, 0.1, 0.012, 0.12, 0.44, 0, 0x2a2a2a), B(0.1, 0.02, 0.1, 0.12, 0.34, 0, 0x3a2a1a), B(0.1, 0.02, 0.1, 0.12, 0.24, 0, 0x3a2a1a));
      W.glow = [B(0.08, 0.1, 0.08, 0.12, 0.26, 0, 0xfff3b0), B(0.08, 0.03, 0.01, 0.2, 0.4, 0.06, 0xf0ecd8, 0, 0, 0.5), B(0.08, 0.03, 0.01, 0.2, 0.4, 0.04, 0xf0ecd8, 0, 0, -0.5)];
      return W;
    }
    case 'porcelainrod': { // a cracked porcelain wand; lightning shows through the cracks
      const P = [B(0.045, 0.46, 0.045, 0, -0.2, 0, CERAMIC), B(0.06, 0.04, 0.06, 0, 0.04, 0, 0x4a6ab0), B(0.06, 0.04, 0.06, 0, -0.18, 0, 0x4a6ab0), B(0.1, 0.12, 0.1, 0, 0.26, 0, CERAMIC), B(0.06, 0.06, 0.06, 0, 0.36, 0, 0xf4f0ea)];
      return { parts: P, glow: [B(0.012, 0.2, 0.048, 0.01, -0.1, 0, 0x9ad8ff), B(0.012, 0.1, 0.104, -0.02, 0.26, 0, 0x9ad8ff), B(0.05, 0.05, 0.05, 0, 0.42, 0, 0xdff4ff)] };
    }
    case 'candelabra': { // a chandler's three-armed candelabra on a staff
      const W = staff('acornstaff', it); W.parts = W.parts.filter(p => p[6] !== 0x9a6f3a && p[6] !== 0x6a4a1e);
      W.parts.push(B(0.3, 0.03, 0.04, 0, 0.5, 0, 0xc0a060), B(0.03, 0.12, 0.03, -0.14, 0.52, 0, 0xc0a060), B(0.03, 0.12, 0.03, 0.14, 0.52, 0, 0xc0a060));
      for (const x of [-0.14, 0, 0.14]) W.parts.push(B(0.05, 0.1, 0.05, x, 0.62 + (x ? 0 : 0.06), 0, 0xf8f0e0));
      W.glow = [-0.14, 0, 0.14].map(x => B(0.035, 0.06, 0.035, x, 0.73 + (x ? 0 : 0.06), 0, 0xffb347));
      return W;
    }
  }
  return null;
}
// Oversized universal weapons (held two-handed; item.visualScale grows them cleanly)
function oversized(base, it) {
  if (base === 'teaspoon') { // a huge tarnished teaspoon with a royal crest
    const S = 0xb8b0a0, S2 = 0xd8d0c0, TAR = 0x7a7060;
    const P = [B(0.05, 0.5, 0.025, 0, -0.18, 0, S), B(0.07, 0.12, 0.03, 0, -0.3, 0, S2), B(0.04, 0.04, 0.032, 0, -0.26, 0.004, 0xd8a840), B(0.035, 0.2, 0.02, 0, 0.32, 0, S)];
    P.push(B(0.2, 0.26, 0.04, 0, 0.44, 0.02, S), B(0.16, 0.2, 0.03, 0, 0.47, 0.045, S2), B(0.12, 0.06, 0.04, 0, 0.7, 0.02, S), B(0.05, 0.04, 0.02, 0.05, 0.52, 0.06, TAR), B(0.04, 0.05, 0.02, -0.06, 0.6, 0.06, TAR));
    return { parts: P, glow: [B(0.03, 0.03, 0.02, -0.03, 0.62, 0.07, 0xffffff)] };
  }
  if (base === 'parasol') { // a rainmaker's parasol: carved handle, ribbed canopy
    const C1 = 0x3a6a9a, C2 = 0x2a4a7a;
    const P = [B(0.03, 0.8, 0.03, 0, -0.2, 0, 0x6a4a2a), B(0.06, 0.1, 0.06, 0.03, -0.26, 0, 0x5a3a1a, 0, 0, 0.8), B(0.04, 0.08, 0.04, 0, 0.62, 0, 0x6a4a2a)];
    for (let i = 0; i < 4; i++) P.push(B(0.52 - i * 0.12, 0.05, 0.52 - i * 0.12, 0, 0.44 + i * 0.05, 0, i % 2 ? C1 : C2));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; P.push(B(0.02, 0.02, 0.28, Math.cos(a) * 0.13, 0.46, Math.sin(a) * 0.13, 0xd8d0c0, 0, a, 0)); }
    return { parts: P, glow: [B(0.03, 0.05, 0.03, 0.27, 0.42, 0, 0x9ad8ff), B(0.03, 0.05, 0.03, -0.27, 0.42, 0, 0x9ad8ff)] };
  }
  return { parts: [B(0.06, 0.9, 0.06, 0, -0.1, 0, 0x8a7a6a)], glow: [] };
}
export function weaponModel(item, cls = 'samurai') {
  const kind = item ? item.kind : { archer: 'bow', witch: 'staff', soulbound: 'chain' }[cls] || 'katana';
  const base = item ? item.base : { archer: 'huntbow', witch: 'acornstaff', soulbound: 'tetherchain' }[cls] || 'rustkatana';
  // every base on the approved weapon sheet (and its heirloom/variant palettes) is built from
  // the visual registry; named curios and anything unknown keep the hand-built models below
  const built = buildWeapon(item, base);
  if (built) { built.scale *= item && item.visualScale ? item.visualScale : 1; built.kind = kind; return built; }
  const H = HEIRLOOM_BY_ID[base];
  let W = kind === 'chain' ? chainWeapon(base, item, H) : (H ? heirloomModel(H) : null) || named(base, item) || (kind === 'oversized' ? oversized(base, item) : kind === 'katana' ? katana(base, item) : kind === 'bow' ? bow(base, item) : staff(base, item));
  if (item && item.unique) W = legendary(item.unique, W);
  if (item && item.craft) (W.glow || (W.glow = [])).push(B(0.03, 0.03, 0.03, 0.05, kind === 'bow' ? 0 : 0.12, 0.05, 0x9ad8ff));
  W.scale = (W.scale || 1) * (item && item.visualScale ? item.visualScale : 1);
  W.kind = kind;
  return W;
}

export const CHAIN_LOOK = {
  tetherchain:[0x6a6258,0x8fe3dc], shrinecord:[0xb89a6a,0xfff0c0], lanternlinks:[0x5a5a64,0xffd88a],
  ferrymanchain:[0x4a4e58,0x9ad8ff], mothsilk:[0xd8d0c0,0xe0d0ff], gravechain:[0x3a3a42,0xb8a8ff],
  wispwoven:[0x6a8a88,0xb8fff0], veilchain:[0x2e3440,0xc8b0ff], wayfarerlinks:[0xa8a298,0x8fe3dc],
  tidewhisper:[0x5a7a8a,0x55bfff], duskcoil:[0x4a3a5a,0xb765ef], lanternchain:[0x6a5a48,0xffc860], threshold:[0x2a2e3a,0xc8b0ff],
};
export const chainColors = item => { const s = chainStyle(item || null); return [s.a, s.spirit]; };
function chainWeapon(base, item, heirloom) {
  const [iron, orb] = chainColors(item || { base });
  const parts=[B(.055,.15,.055,0,-.02,0,LEATHER),B(.065,.025,.065,0,.12,0,shade(iron,1.3)),B(.07,.03,.07,0,-.04,0,shade(LEATHER,.7))], glow=[];
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;parts.push(B(.05,.035,.028,Math.cos(a)*.1,.16+Math.sin(a)*.1,.02,i%2?iron:shade(iron,1.35),0,i%2?1.57:0,a));}
  glow.push(B(.03,.03,.03,0,.26,.02,orb));
  parts.push(B(.05,.08,.01,.05,-.1,.03,PAPER));glow.push(B(.018,.018,.012,.05,-.07,.037,orb));
  if(item&&item.r>=2)glow.push(B(.02,.02,.02,-.07,.2,.05,RAR[item.r]));
  if(heirloom?.prismatic)for(let i=0;i<4;i++)glow.push(B(.025,.025,.025,Math.cos(i*1.57)*.14,.16+Math.sin(i*1.57)*.14,.03,[0x75e9ff,0xb992ff,0xff79d9,0xffd763][i]));
  return {parts,glow};
}
// legacy: flat part list (glow parts included) for callers that just want geometry
export function weaponParts(item) { const W = weaponModel(item, item && item.cls); return [...W.parts, ...(W.glow || [])]; }
export function weaponMesh(item, cls) {
  const W = weaponModel(item, cls);
  const g = new THREE.Group();
  // `pre` turns a model authored flat (bows) to face the way the arm holds it
  const inner = W.pre ? new THREE.Group() : g; if (W.pre) { inner.rotation.set(...W.pre); g.add(inner); }
  const m = new THREE.Mesh(geo(W.parts), MAT); m.castShadow = true; inner.add(m);
  if (W.glow && W.glow.length) { const gm = new THREE.Mesh(geo(W.glow), MAT_GLOW); inner.add(gm); }
  if (W.prism && W.prism.length) inner.add(new THREE.Mesh(geo(W.prism), PRISM_MAT));
  g.scale.setScalar(W.scale || 1);
  g.userData.kind = W.kind;
  g.userData.anchors = W.anchors || null; g.userData.inner = inner;
  if (W.visual) g.userData.visual = W.visual.id;
  applyWeaponElementVisual(g, weaponElements(item), W);
  g.traverse(o => { if (o.isMesh) o.layers.enable(1); });
  return g;
}

// ------------------------------------------------------------------ the figure
function pivotG(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }
function setMesh(group, parts, mat = MAT) {
  while (group.children.length) { const c = group.children[0]; group.remove(c); if (c.geometry) c.geometry.dispose(); }
  if (!parts.length) return;
  const lit = parts.filter(p => !p.glow), glow = parts.filter(p => p.glow);
  if (lit.length) { const m = new THREE.Mesh(geo(lit), mat); m.castShadow = true; m.layers.enable(1); group.add(m); }
  if (glow.length) { const m = new THREE.Mesh(geo(glow), MAT_GLOW); m.layers.enable(1); group.add(m); }
}

// the witch's own hat: a wide brim, a crooked cone with a green band and a brass buckle
function witchHat() {
  const H = 0x5a3c94, H2 = 0x6a4aae, D = 0x40286e;
  return [B(.44,.026,.41,0,.25,0,D), B(.46,.01,.43,0,.246,0,shade(D,1.35)), B(.3,.1,.28,0,.27,0,H), B(.31,.034,.29,0,.27,0,0x8ad870), B(.05,.04,.02,.05,.275,.146,0xe8c860),
    B(.21,.1,.2,.012,.36,-.02,H2,-.12), B(.13,.09,.12,.035,.44,-.05,H,-.3), B(.075,.08,.075,.07,.5,-.09,H2,-.6,0,-.2), B(.04,.045,.04,.1,.535,-.13,H,-.9,0,-.4)];
}
export function makeHero(cls = 'samurai', appearance) {
  let look = normalizeAppearance(appearance);
  const C = CLASS_LOOK[cls] || CLASS_LOOK.samurai;
  const root = new THREE.Group();
  const frame = new THREE.Group(); root.add(frame);
  const body = new THREE.Group(); frame.add(body);
  const legL = pivotG(-0.075, 0.28, 0), legR = pivotG(0.075, 0.28, 0);
  const legLm = new THREE.Group(), legRm = new THREE.Group(); legL.add(legLm); legR.add(legRm);
  body.add(legL, legR);
  const torso = new THREE.Group(); torso.position.y = 0.08; body.add(torso);
  const head = pivotG(0, 0.50, 0);
  const headM = new THREE.Group(), helm = new THREE.Group();
  head.add(headM, helm);
  // eyes: separate so they can blink and glance
  const eyes = new THREE.Group(); head.add(eyes);

  body.add(head);
  const neck = new THREE.Group(); neck.position.y=.06; body.add(neck);
  const scarfBase = new THREE.Mesh(geo([B(0.34, 0.07, 0.26, 0, 0.34, 0, C.scarf), B(0.1, 0.1, 0.03, 0.07, 0.26, 0.13, C.scarf, 0, 0, 0.3)]), MAT); scarfBase.castShadow = true; scarfBase.position.y=.08; body.add(scarfBase);
  const tail1 = pivotG(0.06, 0.46, -0.12); tail1.add(new THREE.Mesh(geo([B(0.1, 0.05, 0.18, 0, -0.03, -0.09, C.scarf)]), MAT));
  const tail2 = pivotG(0, 0, -0.18); tail2.add(new THREE.Mesh(geo([B(0.09, 0.04, 0.16, 0, -0.02, -0.08, shade(C.scarf, 0.85))]), MAT));
  tail1.add(tail2); body.add(tail1);
  // the concept sheet has no scarves; the Soulbound keeps its streaming one
  scarfBase.visible = tail1.visible = cls === 'soulbound';
  const armR = pivotG(0.205, 0.46, 0), armL = pivotG(-0.205, 0.46, 0);
  const armRm = new THREE.Group(), armLm = new THREE.Group(); armR.add(armRm); armL.add(armLm);
  body.add(armR, armL);
  const sword = pivotG(0, -0.27, 0.02); armR.add(sword);
  const offhand = pivotG(0, -0.27, 0.04); armL.add(offhand);
  const shield = new THREE.Group(); shield.visible = false; armL.add(shield);

  root.scale.setScalar(1.12); // a touch larger on screen so faces and gear read

  let lastKey = '', currentEquip = {};
  const skinParts = parts => parts.map(p => { const q=[...p]; if(q[6]===SKIN) q[6]=Number(look.skin.replace('#','0x')); if(q[6]===SKIN_D) q[6]=shade(Number(look.skin.replace('#','0x')),.82); q.glow=p.glow; return q; });
  const setGear = equip => {
    currentEquip = equip || {};
    const V = gearVisual(equip);
    const key = ['head', 'neck', 'chest', 'arms', 'legs', 'boots', 'weapon'].map(k => V[k] ? V[k].uid || V[k].base + V[k].r : '-').join('|');
    if (key === lastKey) return;
    lastKey = key;
    // the concept-style voxel body (hero_voxel.js); set armour keeps its signature pieces on top
    const A = armorLook(V.chest), skin = Number(look.skin.replace('#','0x'));
    const setPieces = A && ['bellwarden','thornstalker','cinderwoven','plate','scales','leafy','robe'].includes(A.shape) ? torsoParts('none', V.chest).slice(4) : [];
    setMesh(torso, [...voxelTorso(cls, A), ...setPieces]);
    setMesh(legLm, voxelLeg(cls, armorLook(V.legs), armorLook(V.boots), A));
    setMesh(legRm, voxelLeg(cls, armorLook(V.legs), armorLook(V.boots), A));
    setMesh(armLm, voxelArm(cls, A, armorLook(V.arms), -1, skin));
    setMesh(armRm, voxelArm(cls, A, armorLook(V.arms), 1, skin));
    // an equipped helm sits on the big head; otherwise the class hat (witch hat, archer cap, hood)
    setMesh(helm, V.head ? helmParts(cls, V.head) : classHat(cls, look));
    if (V.head) { helm.scale.set(1.02, 1.05, 1.02); helm.position.y = .14; } else { helm.scale.set(1, 1, 1); helm.position.y = 0; }
    setMesh(headM, voxelHead(cls, V.head ? {...look,hair:'shaved'} : look, { hat: V.head ? 'helm' : CLASS_HAT[cls] }));
    setMesh(neck, neckParts(V.neck));
    setWeapon(V.weapon);
  };
  const setWeapon = item => {
    for (const g of [sword, offhand]) while (g.children.length) { const child=g.children[0]; child.traverse(o=>o.geometry?.dispose()); g.remove(child); }
    const w = weaponMesh(item, cls);
    if (w.userData.kind === 'bow') { offhand.add(w); w.rotation.x = Math.PI / 2 * 0.2; }
    else sword.add(w);
  };
  root.traverse(o => { if (o.isMesh) o.layers.enable(1); });
  const setAppearance = raw => {
    look = normalizeAppearance(raw);
    frame.scale.set(...FRAMES[look.frame]);
    const P=voxelEyes(cls, look);
    setMesh(eyes,P,MAT); // lit, so the whites never bloom into glare lastKey=''; setGear(currentEquip);
  };
  const dispose = () => root.traverse(o=>o.geometry?.dispose());
  const hero = { root, frame, body, head, eyes, helm, neck, legL, legR, armL, armR, sword, shield, torso, tail1, tail2, offhand, setWeapon, setGear, setAppearance, dispose, cls };
  setAppearance(look);
  return hero;
}

function heirloomModel(H) {
 const c=H.col, gold=0xc69b48, P=[], G=[];
 if(H.kind==='katana'){
  P.push(B(.065,.23,.07,0,0,0,0x3b2d29),B(.26,.045,.1,0,.23,0,gold));
  for(let i=0;i<7;i++) P.push(B(.07,.085,.035,i*i*.0013,.29+i*.077,0,c));
  if(H.r>=2) for(let i=0;i<6;i++)G.push(B(.022,.065,.045,i*i*.0013-.026,.3+i*.077,0,c));
 } else if(H.kind==='bow'){
  P.push(B(.07,.16,.07,0,-.08,0,gold));
  for(const side of [-1,1])for(let i=0;i<5;i++)P.push(B(.05,.085,.06,0,side*(.09+i*.07),.05+Math.sin(i/4*Math.PI)*.12,c));
  P.push(B(.012,.77,.012,0,-.385,.04,0xe5dbc1));
  if(H.id==='starfallcrossbow')P.push(B(.08,.65,.1,0,-.32,.13,0x705537),B(.36,.065,.08,0,.03,.13,gold));
  if(H.r>=3)for(const y of [-.27,.27])G.push(B(.12,.07,.08,0,y,.13,c));
 } else if(H.id.includes('tome')||H.id==='orbitinggrimoire'){
  P.push(B(.31,.06,.38,0,.27,0,0x3a2155),B(.27,.085,.33,0,.31,0,0xe8d7ae),B(.31,.025,.38,0,.39,0,c));
  G.push(B(.095,.055,.12,0,.415,0,c));
 } else {
  P.push(B(.05,.69,.05,0,0,0,0x795637),B(.15,.045,.15,0,.63,0,gold));
  G.push(B(.18,.18,.18,0,.68,0,c),B(.075,.075,.075,0,.79,0,0xffffff));
 }
 if(H.prismatic)for(let i=0;i<5;i++)G.push(B(.028,.08,.03,.13*Math.cos(i*1.26),.35+i*.055,.1*Math.sin(i*1.26),[0x75e9ff,0xb992ff,0xff79d9,0xffd763,0x66eeb6][i]));
 return {parts:P,glow:G};
}

// Canonical relaxed pose, shared by the live character and both character previews.
export function poseHeroIdle(m, family, time, blink=false) {
 const br=Math.sin(time*2.4);
 m.body.rotation.set(0,0,0);m.body.position.set(0,Math.sin(time*2.5)*.008,0);m.body.scale.set(1+br*.012,1-br*.015+.015,1);
 m.armL.rotation.set(0,0,-.1-br*.04);m.armR.rotation.set(0,0,.1+br*.04);m.legL.rotation.set(0,0,0);m.legR.rotation.set(0,0,0);
 m.head.rotation.set(Math.sin(time*.7)*.04,0,0);m.sword.rotation.set(family==='staff'||family==='wand'?.25:Math.PI/2*.9,0,0);
 m.tail1.rotation.set(-.4+Math.sin(time*13)*.036,0,0);m.tail2.rotation.x=-.2+Math.sin(time*13+1)*.054;
 m.eyes.scale.y=blink?.15:1;m.eyes.position.y=.175*(1-m.eyes.scale.y);
}
