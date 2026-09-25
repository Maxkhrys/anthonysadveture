// The hero's body in the concept style (docs/concepts/character_concepts.png): a chibi voxel
// figure with a big cube head (~40% of its height), a short square body, crisp blocky hair,
// big two-tone eyes, and a class silhouette you can read at a glance:
//   Samurai   red chest plate, layered navy pauldrons, hakama with red trim
//   Archer    green cap, bandolier and quiver, jagged tunic hem, leather bracers
//   Witch     wide buckled hat, caped dress with a brooch, flared skirt
//   Soulbound dark hood and long coat with teal trim and buttons
// Rig spaces (set up by hero.makeHero): head pivot at y .5 (the head sits on it), torso group at
// y .08, arm pivots at the shoulders (hand at y -.27), leg pivots at the hip (y .28, feet at -.28).
// Parts are [w, h, d, x, y(bottom), z, colour, rx, ry, rz] via models.B. Nothing here reads stats.
import * as THREE from 'three';
import { B } from './models.js';
import { normalizeAppearance } from './appearance.js';

const hex = s => Number(String(s).replace('#', '0x'));
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
const INK = 0x1b1426, GOLD = 0xe0b040, GOLD_D = 0x9a6a1e, WHITE = 0xf6f2e8;

// class palettes (the concept sheet); armour recolours main/second/trim but keeps the silhouette
export const OUTFIT = {
  samurai: { main: 0x2e4a86, second: 0x223a6e, trim: 0xd83a34, plate: 0xd23a32, belt: 0x241a20, boot: 0x241c22, strap: 0xc8302c, pants: 0x2a3a6c },
  archer: { main: 0x4f9a3a, second: 0x3c7c2e, trim: 0x7ac25a, plate: 0x6ab24c, belt: 0x6a4222, boot: 0x5a3820, strap: 0x7a4a26, pants: 0x5a4028, cap: 0x5aa83e, cap2: 0x4a8c32 },
  witch: { main: 0x6a3aa6, second: 0x542c8a, trim: 0x8a5ac8, plate: 0x7a4ab8, belt: 0x2a1e3a, boot: 0x2e2240, strap: 0x3a2a54, pants: 0x3a2a5a, hat: 0x6a3aa6, hat2: 0x5a2e92, band: 0x2a1e44 },
  soulbound: { main: 0x262b34, second: 0x1d2129, trim: 0x3ab8b0, plate: 0x2e3440, belt: 0x5a5e66, boot: 0x1e2128, strap: 0x3ab8b0, pants: 0x22262e, hood: 0x1c2027, glow: 0x7af0e8 },
};
const look = raw => normalizeAppearance(raw);

// ------------------------------------------------------------------ head
export const HEAD = { soft: [.4, .36], angular: [.38, .36], round: [.42, .35], long: [.37, .39] };
// what each class wears on its head when no helm is equipped
export const CLASS_HAT = { samurai: null, archer: 'cap', witch: 'witchhat', soulbound: 'hood' };

export function voxelHead(cls, appearance, opts = {}) {
  const a = look(appearance), skin = hex(a.skin), hair = hex(a.hairColor);
  const [W, H] = HEAD[a.face], D = .38, fz = D / 2; // face plane
  const hairD = shade(hair, .72), hairL = mix(hair, 0xffffff, .1);
  const P = [B(W, H, D, 0, .02, 0, skin), B(W - .06, .03, D - .06, 0, 0, 0, shade(skin, .8))];
  // ears (pointed for the archer and the witch, as on the sheet)
  for (const s of [-1, 1]) {
    P.push(B(.04, .09, .08, s * (W / 2 + .018), .1, -.01, skin), B(.012, .05, .04, s * (W / 2 + .036), .12, 0, shade(skin, .82)));
    if (cls === 'archer' || cls === 'witch') P.push(B(.035, .06, .05, s * (W / 2 + .045), .17, -.02, skin, 0, 0, s * -.5));
  }
  P.push(B(.04, .035, .025, 0, .1, fz, shade(skin, .9)), B(.07, .016, .01, 0, .062, fz + .002, shade(skin, .55)));
  if (a.face === 'round' || a.face === 'soft') for (const s of [-1, 1]) P.push(B(.05, .025, .008, s * .12, .085, fz + .001, mix(skin, 0xf07878, .4)));
  // hair: crown, back and sides unless a hat or helm covers them; the fringe always shows
  const hat = opts.hat, style = a.hair;
  if (style !== 'shaved') {
    if (!hat) {
      P.push(B(W + .04, .1, D + .04, 0, H - .04, -.005, hair), B(W * .3, .02, .08, -.08, H + .06, .1, hairL));
      if (style !== 'undercut') for (const s of [-1, 1]) P.push(B(.05, .2, D - .04, s * (W / 2 + .012), .14, -.02, hair));
      P.push(B(W + .04, .26, .06, 0, .1, -fz - .02, hair), B(W + .04, .05, .07, 0, .1, -fz - .02, hairD));
    } else if (hat !== 'helm') for (const s of [-1, 1]) P.push(B(.045, .14, .2, s * (W / 2 + .01), .16, .02, hair)); // strands under the brim
    // the fringe: blocky locks over the forehead
    const fy = H - .1;
    if (style === 'tousled' || style === 'curly') for (let i = 0; i < 4; i++) P.push(B(.1, .07 + (i % 2) * .03, .05, -W / 2 + .05 + i * (W - .1) / 3, fy - (i % 2) * .03, fz, i % 2 ? hairD : hair));
    if (style === 'swept' || style === 'undercut') for (let i = 0; i < 4; i++) P.push(B(.11, .05 + i * .025, .05, -W / 2 + .06 + i * (W - .12) / 3, fy - i * .02, fz, i % 2 ? hair : hairL));
    if (style === 'cropped' || style === 'topknot' || style === 'ponytail' || style === 'braided') P.push(B(W + .02, .06, .05, 0, fy + .02, fz, hair), B(W * .3, .04, .052, -W * .25, fy - .01, fz, hairD));
    if (style === 'long') P.push(B(W + .02, .07, .05, 0, fy, fz, hair), B(.1, .1, .05, -W / 2 + .06, fy - .06, fz, hairD), B(.1, .1, .05, W / 2 - .06, fy - .06, fz, hairD));
    if (!hat) {
      if (style === 'topknot') P.push(B(.13, .12, .13, 0, H + .06, -.06, hair), B(.14, .025, .14, 0, H + .06, -.06, GOLD));
      if (style === 'ponytail' || style === 'braided') { P.push(B(.12, .11, .09, 0, .22, -fz - .07, hair)); for (let i = 0; i < 4; i++) P.push(B(style === 'braided' ? .07 : .09, .07, .07, 0, .15 - i * .07, -fz - .1 - i * .01, i % 2 && style === 'braided' ? hairD : hair)); }
      if (style === 'curly') for (let i = 0; i < 8; i++) { const ang = i / 8 * Math.PI * 2; P.push(B(.1, .08, .1, Math.cos(ang) * W * .35, H + .02 + (i % 2) * .03, Math.sin(ang) * .14, i % 2 ? hair : hairL)); }
    }
    if (style === 'long') for (const s of [-1, 1]) P.push(B(.07, .38, .2, s * (W / 2 + .025), -.2, -.06, hair), B(.07, .06, .2, s * (W / 2 + .025), -.22, -.06, hairD));
    if (style === 'long' && !hat) P.push(B(W, .36, .07, 0, -.18, -fz - .04, hair));
  }
  // facial hair and markings
  if (a.beard !== 'none') {
    const bh = { stubble: .03, short: .07, full: .12, moustache: .025, forked: .13 }[a.beard];
    if (a.beard === 'moustache') P.push(B(.14, bh, .02, 0, .075, fz + .004, hair));
    else if (a.beard === 'stubble') P.push(B(W - .08, .06, .01, 0, .02, fz + .002, mix(skin, hair, .35)));
    else { P.push(B(W - .06, bh, .05, 0, .045 - bh + .03, fz - .01, hair), B(.12, .025, .02, 0, .075, fz + .004, hair)); if (a.beard === 'forked') for (const s of [-1, 1]) P.push(B(.05, .06, .04, s * .05, -.1, fz - .02, hairD)); }
  }
  if (a.detail === 'scar') P.push(B(.016, .09, .01, .11, .11, fz + .002, shade(skin, .62), 0, 0, -.35));
  if (a.detail === 'freckles') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P.push(B(.012, .012, .01, s * (.08 + i * .025), .095 + (i % 2) * .014, fz + .002, shade(skin, .6)));
  if (a.detail === 'warpaint') for (const s of [-1, 1]) P.push(B(.1, .025, .01, s * .1, .1, fz + .002, 0x3a6a8a));
  if (a.detail === 'runes') for (let i = 0; i < 3; i++) P.push(B(.016, .03, .01, -.03 + i * .03, H - .12, fz + .002, 0x4aa89a));
  return P;
}

// eyes and brows: separate (unlit) so they can blink; big and two-tone like the sheet
export function voxelEyes(cls, appearance) {
  const a = look(appearance), iris = hex(a.eyes), hair = hex(a.hairColor), fz = .38 / 2 + .004;
  const P = [];
  for (const s of [-1, 1]) {
    const x = s * .085, xi = x - s * .012;
    P.push(B(.09, .095, .01, x, .125, fz, WHITE));                     // the white
    P.push(B(.055, .095, .012, xi, .125, fz + .001, iris));           // the iris (toward the nose)
    P.push(B(.055, .035, .013, xi, .185, fz + .002, shade(iris, .45))); // shaded top of the iris
    P.push(B(.02, .02, .014, xi - s * .012, .19, fz + .003, 0xffffff)); // highlight
    P.push(B(.1, .022, .013, x, .218, fz + .002, INK));               // upper lash line
    const tilt = a.face === 'angular' ? s * .22 : cls === 'samurai' ? s * .12 : 0;
    P.push(B(.1, .03, .015, x, .255, fz + .002, shade(hair, .6), 0, 0, tilt)); // brows, a touch stern
  }
  return P;
}

// ------------------------------------------------------------------ class hats (no helm worn)
export function classHat(cls, appearance) {
  const kind = CLASS_HAT[cls]; if (!kind) return [];
  const a = look(appearance), [W, H] = HEAD[a.face], O = OUTFIT[cls], D = .38;
  const P = [];
  if (kind === 'witchhat') {
    P.push(B(W + .18, .035, D + .16, 0, H - .03, 0, O.hat2), B(W + .2, .012, D + .18, 0, H - .035, 0, shade(O.hat2, 1.3)));
    P.push(B(W + .04, .12, D + .02, 0, H, 0, O.hat), B(W + .05, .05, D + .03, 0, H + .01, 0, O.band), B(.08, .06, .02, 0, H + .005, D / 2 + .026, GOLD), B(.04, .03, .021, 0, H + .02, D / 2 + .027, O.band));
    P.push(B(W - .06, .12, D - .08, .01, H + .12, -.02, O.hat), B(W - .16, .11, D - .18, .03, H + .23, -.05, shade(O.hat, 1.1)), B(.1, .1, .1, .08, H + .33, -.09, O.hat, -.35, 0, -.3), B(.07, .07, .07, .14, H + .4, -.14, shade(O.hat, 1.1), -.6, 0, -.5));
  }
  if (kind === 'cap') { // the archer's green cap, peaked at the back
    P.push(B(W + .05, .09, D + .05, 0, H - .03, -.005, O.cap), B(W + .06, .025, D + .06, 0, H - .03, -.005, O.cap2));
    P.push(B(W - .04, .07, D - .06, 0, H + .06, -.03, O.cap), B(.18, .08, .16, 0, H + .1, -.16, O.cap2, -.35), B(.1, .06, .1, 0, H + .14, -.24, O.cap, -.7));
    P.push(B(.03, .14, .02, .12, H + .04, .14, 0xe8e0c8, -.4, 0, -.5)); // a pale feather quill
  }
  if (kind === 'hood') { // the Soulbound's hood with a teal edge framing the face
    P.push(B(W + .08, .1, D + .06, 0, H - .02, -.01, O.hood), B(W - .02, .06, D - .04, 0, H + .08, -.04, shade(O.hood, 1.15)));
    for (const s of [-1, 1]) P.push(B(.05, H + .02, D + .04, s * (W / 2 + .035), .0, -.01, O.hood), B(.03, H - .02, .03, s * (W / 2 + .045), .04, D / 2 + .02, O.trim));
    P.push(B(W + .08, H + .1, .06, 0, -.02, -D / 2 - .03, O.hood), B(W + .12, .03, .03, 0, H + .02, D / 2 + .02, O.trim), B(.18, .12, .1, 0, H - .06, -D / 2 - .06, O.hood, -.4));
  }
  return P;
}

// ------------------------------------------------------------------ torso (torso space: y .12 .. .42)
export function voxelTorso(cls, A) {
  const O = OUTFIT[cls] || OUTFIT.samurai;
  const main = A ? A.main : O.main, second = A ? A.second : O.second, trim = A ? A.trim : O.trim, plate = A ? A.main : O.plate;
  const P = [B(.34, .3, .22, 0, .12, 0, main), B(.36, .05, .24, 0, .37, 0, shade(main, 1.12))]; // body + lit shoulders
  const belt = (col = O.belt, buckle = GOLD) => P.push(B(.37, .05, .25, 0, .15, 0, col), B(.075, .055, .02, 0, .147, .126, buckle), B(.035, .025, .022, 0, .162, .127, col));
  if (cls === 'samurai') {
    P.push(B(.3, .19, .02, 0, .2, .112, plate), B(.3, .02, .022, 0, .37, .112, shade(plate, .75)), B(.1, .19, .021, 0, .2, .113, shade(plate, .88)));
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { // layered sode, trimmed in red
      const y = .31 - i * .075, w = .13 - i * .01;
      P.push(B(w, .075, .26, s * (.215 + i * .01), y, 0, i ? second : main), B(w + .005, .02, .265, s * (.215 + i * .01), y, 0, trim));
    }
    P.push(B(.38, .1, .26, 0, .05, 0, O.pants), B(.385, .02, .265, 0, .05, 0, trim), B(.02, .1, .262, 0, .05, 0, shade(O.pants, .8))); // hakama
    belt();
  } else if (cls === 'archer') {
    P.push(B(.2, .15, .02, 0, .21, .112, A ? second : O.plate), B(.05, .42, .02, 0, .16, .114, O.strap, 0, 0, .72), B(.055, .04, .022, .05, .3, .116, GOLD, 0, 0, .72));
    for (let i = 0; i < 4; i++) P.push(B(.09, .07 + (i % 2) * .03, .24, -.135 + i * .09, .05 - (i % 2) * .03, 0, i % 2 ? second : main)); // jagged hem
    P.push(B(.13, .32, .11, .09, .16, -.17, 0x7a4a26, 0, 0, -.28), B(.14, .03, .12, .09, .44, -.17, 0x5a3218, 0, 0, -.28)); // quiver
    for (const [x, c] of [[.02, 0xe84a3a], [.07, WHITE], [.12, 0x7ad04a]]) P.push(B(.018, .12, .018, x + .06, .46, -.17, 0x9a7a4a, 0, 0, -.28), B(.04, .05, .015, x + .03, .56, -.17, c, 0, 0, -.28));
    belt(O.belt);
  } else if (cls === 'witch') {
    P.push(B(.42, .07, .3, 0, .33, 0, second), B(.38, .04, .28, 0, .29, 0, shade(second, .85)), B(.06, .06, .02, 0, .35, .152, GOLD), B(.035, .035, .02, 0, .362, .162, 0x9ad8ff));
    P.push(B(.38, .12, .26, 0, .02, 0, main), B(.43, .1, .3, 0, -.07, 0, second), B(.13, .2, .02, 0, -.06, .152, O.trim), B(.44, .02, .31, 0, -.07, 0, shade(second, .7)));
    belt(O.belt);
  } else { // soulbound: long coat, teal placket, buttons and edges
    P.push(B(.3, .09, .27, 0, .4, 0, second), B(.31, .02, .275, 0, .47, 0, trim));
    P.push(B(.04, .3, .02, 0, .12, .112, trim), B(.045, .04, .02, 0, .32, .118, mix(trim, 0xffffff, .3)), B(.045, .04, .02, 0, .24, .118, mix(trim, 0xffffff, .3)));
    P.push(B(.38, .15, .26, 0, -.03, 0, main), B(.02, .15, .265, -.19, -.03, 0, trim), B(.02, .15, .265, .19, -.03, 0, trim), B(.04, .15, .01, 0, -.03, .131, trim));
    belt(O.belt, 0xa8aeb8);
  }
  return P;
}

// ------------------------------------------------------------------ arms (shoulder pivot; hand at -.27)
export function voxelArm(cls, A, R, side, skin) {
  const O = OUTFIT[cls] || OUTFIT.samurai;
  const sleeve = A ? A.arms : O.main, cuff = R ? R.main : A ? A.second : cls === 'archer' ? 0x7a4a26 : O.trim;
  const P = [B(.11, .17, .11, 0, -.2, 0, sleeve), B(.12, .045, .12, 0, -.21, 0, cuff), B(.095, .075, .095, 0, -.3, 0, skin), B(.035, .04, .04, .045, -.285, .03, shade(skin, .85))];
  if (cls === 'archer') P.push(B(.115, .07, .115, 0, -.26, 0, 0x6a4222)); // leather bracers
  if (cls === 'witch') P.push(B(.15, .06, .15, 0, -.235, 0, OUTFIT.witch.second)); // bell sleeves
  if (cls === 'soulbound' && side > 0) for (let i = 0; i < 3; i++) P.push(B(.118, .022, .118, 0, -.12 - i * .04, 0, i % 2 ? 0x8a8890 : 0x5c5a5e, 0, i * .4));
  if (cls === 'soulbound' && side < 0) P.push(B(.114, .03, .114, 0, -.14, 0, 0xe8dcc0));
  return P;
}

// ------------------------------------------------------------------ legs (hip pivot; feet at -.28)
export function voxelLeg(cls, L, Bo, A) {
  const O = OUTFIT[cls] || OUTFIT.samurai;
  const pants = L ? L.main : A ? A.legs : O.pants, boot = Bo ? Bo.main : A ? A.boots : O.boot;
  const P = [B(.12, .12, .13, 0, -.19, 0, pants), B(.135, .11, .16, 0, -.28, .015, boot), B(.14, .025, .17, 0, -.28, .017, shade(boot, .55)), B(.14, .03, .165, 0, -.18, .015, shade(boot, 1.3))];
  if (cls === 'samurai' && !Bo) P.push(B(.138, .025, .163, 0, -.23, .015, O.strap));
  if (cls === 'archer' && !Bo) P.push(B(.138, .02, .163, 0, -.215, .015, 0x3a2412));
  return P;
}

// ------------------------------------------------------------------ the portrait plinth: a grass block on stone
export function grassBlock() {
  const P = [], N = 6, S = .1, half = N * S / 2;
  const greens = [0x62b444, 0x58a63c, 0x6ec452, 0x4f9a36], stones = [0x8a8494, 0x7a7486, 0x96909e, 0x6e6878];
  let k = 0; const rnd = () => (k = (k * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -half + S / 2 + i * S, z = -half + S / 2 + j * S;
    P.push(B(S, .06, S, x, -.06, z, greens[Math.floor(rnd() * 4)]));
    for (let r = 0; r < 1; r++) if (i === 0 || j === 0 || i === N - 1 || j === N - 1) P.push(B(S, .08, S, x, -.14 - r * .08, z, r === 0 && rnd() < .5 ? 0x4a8c32 : stones[Math.floor(rnd() * 4)]));
  }
  P.push(B(N * S - .02, .15, N * S - .02, 0, -.2, 0, 0x7a7486)); // the block's core, hidden behind the voxel faces
  for (const [x, z] of [[-.26, -.24], [.24, -.26], [-.27, .1], [.27, .2], [.05, -.28]]) P.push(B(.03, .07, .03, x, 0, z, 0x7ac25a), B(.03, .05, .03, x + .03, 0, z, 0x5aa83e));
  return P;
}
