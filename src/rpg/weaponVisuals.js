// Weapon visual registry: how every weapon LOOKS, keyed by base item id.
// Source of truth: the approved weapon sheet (94b5d0f9-...png at the repo root). This file is
// data only (no Three.js, no gameplay): it never owns stats, affixes, drops or combat. The model
// builder (src/weaponModels.js), the icon atlas (assets/weapons/atlas.png, cut from the sheet by
// scripts/build_weapon_atlas.py), world drops and the element overlays all read it through
// getWeaponVisual(item), so a future item schema only needs the small adapters at the bottom.
//
// Entry fields
//   family   katana | bow | staff | wand | chain        model   builder profile in weaponModels.js
//   pal      palette (named colours the profile uses)    len     main length (blade, limb, shaft)
//   scale    in-hand scale (big weapons read big)        hold    'one' | 'two' (two-handed pose)
//   icon     atlas cell (ICON_INDEX) or null → rendered from the 3D model
//   tip      (legacy models only) where element sparks come from; built models compute their own
//            anchors (tip, rarity gem, element edge) in weaponModels.js
//   via      reuse another entry's profile with `pal` overrides (heirlooms, SoulChain variants)
//   sheet    the name it has on the approved sheet, when it differs from the item's name

export const ICON_ATLAS = { url: 'assets/weapons/atlas.png', cell: 96, cols: 8 };
export const ICON_INDEX = { shinai: 0, rustkatana: 1, wakizashi: 2, tachi: 3, uchigatana: 4, nodachi: 5, moonkatana: 6, onicleaver: 7, dragontachi: 8, stormedge: 9,
  twigbow: 10, huntbow: 11, recurve: 12, longbow: 13, composite: 14, reedbow: 15, elmwarbow: 16, galebow: 17, sunbow: 18,
  twigwand: 19, acornstaff: 20, crookstaff: 21, shroomwand: 22, candlestaff: 23, owlstaff: 24, hexwand: 25, frostrod: 26, starstaff: 27,
  tetherchain: 28, shrinecord: 29, lanternlinks: 30, ferrymanchain: 31, mothsilk: 32, gravechain: 33, wispwoven: 34, veilchain: 35,
  wayfarerlinks: 36, tidewhisper: 37, duskcoil: 38, lanternchain: 39, threshold: 40 };

const GOLD = 0xd8a840, GOLD_D = 0x9a6a1e, INK = 0x1e1620;
export const WEAPON_VISUALS = {
  wandererschain: { via: 'wayfarerlinks', icon: 36 },
  whisperingchain: { via: 'tidewhisper', icon: 37 },
  grievingcoil: { via: 'duskcoil', icon: 38 },
  veilrender: { via: 'lanternchain', icon: 39 },
  eternalbond: { via: 'threshold', icon: 40 },
  // ------------------------------------------------------------------ Samurai
  shinai: { family: 'katana', model: 'shinai', len: 0.6, pal: { blade: 0xd9a441, hi: 0xf2c860, node: 0x9a6420, guard: 0x7a4a1e, grip: 0x6a3a18, wrap: 0x3a2210, pommel: 0x2a1a10 } },
  rustkatana: { family: 'katana', model: 'katana', len: 0.56, curve: 0.04, w: 0.062, pal: { blade: 0x8e8074, hi: 0xb8ac9c, rust: 0x8a4a24, rust2: 0x6a3418, guard: 0xc8963a, grip: 0x7a261c, wrap: 0x3a1612, pommel: 0x3a2a20 }, chip: true },
  wakizashi: { family: 'katana', model: 'katana', len: 0.38, curve: 0.05, w: 0.055, grip: 0.12, pal: { blade: 0xd6dee8, hi: 0xffffff, guard: GOLD, grip: 0x8a4a22, wrap: 0x4a2410, pommel: 0x3a2418 } },
  tachi: { family: 'katana', model: 'katana', len: 0.68, curve: 0.16, w: 0.05, pal: { blade: 0xdce4ee, hi: 0xffffff, guard: GOLD, grip: 0x241c2a, wrap: 0xe8dcc8, pommel: GOLD_D }, gripCurve: 0.04 },
  uchigatana: { family: 'katana', model: 'katana', len: 0.62, curve: 0.09, w: 0.056, pal: { blade: 0xe6edf6, hi: 0xffffff, guard: GOLD, grip: 0x22182a, wrap: 0xb83a34, pommel: GOLD_D } },
  nodachi: { family: 'katana', model: 'katana', len: 0.98, curve: 0.08, w: 0.066, grip: 0.26, pal: { blade: 0xd4dce8, hi: 0xffffff, guard: GOLD, grip: 0x22182a, wrap: 0xe8e0d0, pommel: GOLD_D }, guardW: 0.15, scale: 1.05, hold: 'two' },
  moonkatana: { family: 'katana', model: 'katana', len: 0.64, curve: 0.1, w: 0.064, glowBlade: true, pal: { blade: 0x5aa0ff, hi: 0xdff0ff, guard: GOLD, grip: 0x1a2458, wrap: 0x6a9aff, pommel: GOLD_D, moon: 0xfff3c8 }, moonGuard: true, element: 'frost' },
  onicleaver: { family: 'katana', model: 'cleaver', len: 0.7, w: 0.2, pal: { blade: 0x2c1a20, body: 0x46242a, hi: 0xc8303a, crack: 0xff4a32, guard: 0x1a1216, stud: GOLD, grip: 0x5a1616, wrap: 0x2a0c0c, pommel: 0x1a1216 }, grip: 0.22, scale: 1.14, hold: 'two', element: 'fire' },
  dragontachi: { family: 'katana', model: 'bone', len: 0.66, curve: 0.13, w: 0.066, pal: { blade: 0xeadcbc, hi: 0xfff8e4, ridge: 0xb8a47c, guard: 0xe0d0ac, grip: 0x5a3a20, wrap: 0xe8dcc0, pommel: 0xc8b890 } },
  stormedge: { family: 'katana', model: 'storm', len: 0.62, curve: 0.05, w: 0.074, pal: { blade: 0x2f6cf0, hi: 0x9ad0ff, core: 0xdff4ff, guard: 0x2a4ab0, grip: 0x14245a, wrap: 0x3a7aff, pommel: 0x9ad0ff }, element: 'lightning' },

  // ------------------------------------------------------------------ Archer (profile drawn in the sheet's plane: the belly bows out to +x, the string sits at -x)
  twigbow: { family: 'bow', model: 'bow', len: 0.34, depth: 0.1, thick: 0.034, jitter: 0.02, pal: { wood: 0x7a4a24, dark: 0x4e2e14, grip: 0x5a3818, string: 0xe8e0c8, leaf: 0x5aa83a }, leafTip: true },
  huntbow: { family: 'bow', model: 'bow', len: 0.36, depth: 0.12, thick: 0.044, pal: { wood: 0xc8883a, dark: 0x8a5a22, grip: 0x5a3a1c, band: 0xe8b850, string: 0xf0ead8 }, bands: 2 },
  recurve: { family: 'bow', model: 'bow', len: 0.36, depth: 0.12, thick: 0.046, recurve: 0.09, pal: { wood: 0xa82a26, dark: 0x3a1a14, grip: 0xe8dcc8, band: 0x3a1a14, string: 0xf0ead8 }, core: true },
  longbow: { family: 'bow', model: 'bow', len: 0.52, depth: 0.12, thick: 0.04, pal: { wood: 0xd8902a, dark: 0x8a5418, grip: 0x6a3a18, band: 0xf0c050, string: 0xf0ead8, jewel: 0xd83a2a }, jewel: true, scale: 1.04 },
  composite: { family: 'bow', model: 'bow', len: 0.37, depth: 0.12, thick: 0.058, recurve: 0.05, pal: { wood: 0x243868, dark: 0x16204a, lam: 0xc89a5a, grip: 0x3a2a1c, band: GOLD, string: 0xf0ead8, jewel: 0x4a8aff }, laminate: true, jewel: true, bands: 2 },
  reedbow: { family: 'bow', model: 'bow', len: 0.38, depth: 0.12, thick: 0.042, pal: { wood: 0x6a6a24, dark: 0x3e4a18, grip: 0x3a8a2a, vine: 0x4aa02a, leaf: 0x7ad04a, string: 0xe8f0d0 }, vines: true, element: 'poison' },
  elmwarbow: { family: 'bow', model: 'bow', len: 0.52, depth: 0.15, thick: 0.068, pal: { wood: 0x7a4a24, dark: 0x4e2e14, grip: 0x3a2416, band: 0x2a1a10, string: 0xe8e0c8 }, bands: 2, scale: 1.1, hold: 'two' },
  galebow: { family: 'bow', model: 'bow', len: 0.4, depth: 0.12, thick: 0.046, recurve: 0.08, pal: { wood: 0x2a5ab8, dark: 0x1a2e6a, grip: 0x1a2e6a, band: GOLD, string: 0xdff8ff, jewel: 0x7ad8ff, wind: 0xdff8ff }, jewel: true, bands: 2, wind: true, element: 'lightning' },
  sunbow: { family: 'bow', model: 'bow', len: 0.4, depth: 0.13, thick: 0.05, recurve: 0.09, pal: { wood: 0xe8a830, dark: 0x9a5a14, grip: 0x7a3a10, band: 0xfff0a0, string: 0xfff3c8, jewel: 0xffd040, sun: 0xfff3b0 }, sunRing: true, sparkle: 0xffe070, element: 'fire' },

  // ------------------------------------------------------------------ Witch (shaft along +y; the hand holds it a third of the way up)
  twigwand: { family: 'wand', model: 'staff', head: 'leaves', len: 0.46, thick: 0.036, jitter: 0.015, pal: { wood: 0x7a4a24, dark: 0x4e2e14, leaf: 0x5aa83a, leaf2: 0x8ad04a } },
  acornstaff: { family: 'staff', model: 'staff', head: 'acorn', len: 0.84, thick: 0.046, pal: { wood: 0x5a3218, dark: 0x3a1e0c, nut: 0xc8883a, nut2: 0xe8a850, cap: 0x7a4a1e, cap2: 0x5a3212, leaf: 0x5aa83a } },
  crookstaff: { family: 'staff', model: 'staff', head: 'crook', len: 0.86, thick: 0.046, pal: { wood: 0x7a4a24, dark: 0x4e2e14 } },
  shroomwand: { family: 'wand', model: 'staff', head: 'toadstool', len: 0.48, thick: 0.034, pal: { wood: 0x7a4a24, dark: 0x4e2e14, cap: 0xd8302a, cap2: 0xf04a3a, spot: 0xffffff, gill: 0xf0e6d0 } },
  candlestaff: { family: 'staff', model: 'staff', head: 'candle', len: 0.86, thick: 0.046, pal: { wood: 0x6a3e1e, dark: 0x3e2410, cup: GOLD, wax: 0xf4ead0, wax2: 0xe0d0b0, flame: 0xffa030, core: 0xfff0a0 }, element: 'fire' },
  owlstaff: { family: 'staff', model: 'staff', head: 'owl', len: 0.9, thick: 0.05, pal: { wood: 0x6a4222, dark: 0x3e2410, frame: 0x8a5a2a, rim: GOLD, orb: 0x3a8aff, orb2: 0xbfe0ff }, bands: 3 },
  hexwand: { family: 'wand', model: 'staff', head: 'skull', len: 0.5, thick: 0.038, pal: { wood: 0x3a2450, dark: 0x22143a, bone: 0xe8e0d0, bone2: 0xc8bca8, socket: 0x2a1438, hex: 0xa060ff }, twist: true, element: 'shadow' },
  frostrod: { family: 'staff', model: 'staff', head: 'crystal', len: 0.84, thick: 0.042, pal: { wood: 0x1a2a5a, dark: 0x101a3a, band: 0xc8d8f0, ice: 0x7ac8ff, ice2: 0xdff4ff, ice3: 0x3a8ae0 }, bands: 2, element: 'frost' },
  starstaff: { family: 'staff', model: 'staff', head: 'star', len: 0.9, thick: 0.046, pal: { wood: 0xd8a030, dark: 0x9a6418, rim: 0xe8b040, orb: 0xffb830, core: 0xfff3b0 }, bands: 2, sparkle: 0xfff0a0, element: 'arcane' },

  // ------------------------------------------------------------------ SoulBound (a grip and a gathered coil in the hand; the lash is drawn live by the chain rig)
  tetherchain: { family: 'chain', model: 'chain', link: 'round', end: 'weight', sheet: "Wanderer's Chain", pal: { a: 0x8a5a34, b: 0x6a4224, grip: 0x7a4a24, wrap: 0x3a2414, end: 0x4a4a52, spirit: 0x8fe3dc } },
  ferrymanchain: { family: 'chain', model: 'chain', link: 'round', end: 'charm', sheet: 'Whispering Chain', pal: { a: 0xc8d0dc, b: 0x8a96aa, grip: 0x3a3e4a, wrap: 0x9ad8ff, end: 0x9ad8ff, spirit: 0x9ad8ff } },
  gravechain: { family: 'chain', model: 'chain', link: 'heavy', end: 'weight', sheet: 'Grieving Coil', pal: { a: 0x8a3ac8, b: 0x5a2090, grip: 0x2a1a3a, wrap: 0x5a2090, end: 0x3a2050, spirit: 0xd84a9a }, scale: 1.08 },
  veilchain: { family: 'chain', model: 'chain', link: 'spiked', end: 'blade', sheet: 'Veilrender', pal: { a: 0x3ad8e8, b: 0x2a8aa8, grip: 0x1a2e3a, wrap: 0x3ad8e8, end: 0xbffcff, spirit: 0x7af0ff } },
  shrinecord: { via: 'tetherchain', end: 'bell', pal: { a: 0xd0a860, b: 0x9a7a44, end: GOLD, spirit: 0xfff0c0 } },
  lanternlinks: { via: 'ferrymanchain', end: 'lantern', pal: { a: 0x7a7a84, b: 0x4a4a54, wrap: 0xffd88a, end: 0xffd88a, spirit: 0xffd88a } },
  mothsilk: { via: 'ferrymanchain', end: 'moth', pal: { a: 0xece4d8, b: 0xb8b0c8, wrap: 0xe0d0ff, end: 0xe0d0ff, spirit: 0xe0d0ff } },
  wispwoven: { via: 'veilchain', pal: { a: 0x4ad8a8, b: 0x2a8a78, wrap: 0x4ad8a8, end: 0xc8fff0, spirit: 0xb8fff0 } },
  // heirloom SoulChains, drawn from the same five approved chains
  wayfarerlinks: { via: 'tetherchain', pal: { a: 0xb0aaa0, b: 0x7a766e, spirit: 0x8fe3dc } },
  tidewhisper: { via: 'veilchain', pal: { a: 0x4a9aff, b: 0x2a5ab8, wrap: 0x4a9aff, end: 0xbfe0ff, spirit: 0x55bfff } },
  duskcoil: { via: 'gravechain', pal: { a: 0xa83a78, b: 0x6a2050, end: 0x4a1a3a, spirit: 0xe07ab8 } },
  lanternchain: { via: 'threshold', end: 'lantern', pal: { a: 0xe8a040, b: 0xa86a1e, gemA: 0xffe0a0, gemB: 0xff9a40, end: 0xffc860, spirit: 0xffc860 } },
  threshold: { family: 'chain', model: 'chain', link: 'ornate', end: 'gem', sheet: 'Eternal Bond', pal: { a: 0xe8b840, b: 0xb8862a, grip: 0x3a2a1a, wrap: 0xfff0c0, end: 0x9a4aff, gemA: 0x3a6aff, gemB: 0x9a4aff, spirit: 0xc8b0ff } },

  // ------------------------------------------------------------------ heirlooms: their own palette over an approved silhouette
  wanderblade: { via: 'uchigatana', pal: { blade: 0xdde1df, wrap: 0x6a7a8a, grip: 0x2a2e36 } },
  azureedge: { via: 'tachi', pal: { blade: 0x55bfff, hi: 0xdff4ff, wrap: 0x2a5ab8 } },
  voidcutter: { via: 'uchigatana', glowBlade: true, pal: { blade: 0x9a4ae0, hi: 0xe0b8ff, wrap: 0x5a2a8a, grip: 0x1a1024 }, element: 'shadow' },
  dawnbringer: { via: 'tachi', glowBlade: true, pal: { blade: 0xffad3b, hi: 0xfff3c8, guard: 0xfff0a0, wrap: 0xffd070 }, element: 'holy' },
  heavensdivide: { via: 'nodachi', glowBlade: true, pal: { blade: 0x83dfff, hi: 0xffffff, wrap: 0x83dfff, grip: 0x1a2a4a } },
  hickorybow: { via: 'huntbow', pal: { wood: 0xa57844, dark: 0x6a4a22 } },
  moonfeather: { via: 'galebow', pal: { wood: 0xb8d0e8, dark: 0x5a7aa0, band: 0xe8f0ff, jewel: 0x55bfff } },
  thornwood: { via: 'reedbow', pal: { wood: 0x5a3a1a, vine: 0x72bc44, leaf: 0x9adc5a } },
  verdanteclipse: { via: 'sunbow', pal: { wood: 0x3ab88a, dark: 0x1a6a4a, band: 0xd8fff0, jewel: 0x50efbc, sun: 0xd8fff0 }, sparkle: 0x9affd8, element: 'poison' },
  apprenticewand: { via: 'twigwand', pal: { wood: 0xa77d44 } },
  sagesrod: { via: 'frostrod', pal: { wood: 0x2a3a6a, ice: 0x55bfff, ice2: 0xdff4ff, ice3: 0x2a6ae0 }, element: null },
  fateweaver: { via: 'starstaff', pal: { wood: 0x3a5a8a, dark: 0x1a2e5a, rim: 0x83dfff, orb: 0x83dfff, core: 0xffffff }, sparkle: 0xbff4ff },
  // named weapons and oversized curios keep their own hand-built models (hero.js named/oversized)
  // and get their icon rendered from that model
  seamripper: { family: 'katana', model: 'legacy', tip: [0, 0.86, 0], edge: [0.12, 0.84] },
  wickblade: { family: 'katana', model: 'legacy', tip: [0, 0.76, -0.05], edge: [0.14, 0.7], element: 'fire' },
  bellclapper: { family: 'katana', model: 'legacy', hold: 'two', tip: [0, 0.92, 0], edge: [0.5, 0.92] },
  hatpin: { family: 'katana', model: 'legacy', tip: [0, 0.94, 0], edge: [0.1, 0.9] },
  lilypad: { family: 'bow', model: 'legacy', tip: [0, 0.5, 0.06], edge: [-0.46, 0.46] },
  spoolstring: { family: 'bow', model: 'legacy', tip: [0, 0.34, 0.12], edge: [-0.34, 0.34] },
  glasswing: { family: 'bow', model: 'legacy', tip: [0, 0.36, 0.05], edge: [-0.36, 0.36] },
  mothlight: { family: 'staff', model: 'legacy', tip: [0.12, 0.3, 0] },
  porcelainrod: { family: 'wand', model: 'legacy', tip: [0, 0.42, 0], element: 'lightning' },
  candelabra: { family: 'staff', model: 'legacy', tip: [0, 0.76, 0], element: 'fire' },
  parasol: { family: 'oversized', model: 'legacy', hold: 'two', tip: [0.27, 0.42, 0] },
  teaspoon: { family: 'oversized', model: 'legacy', hold: 'two', tip: [0, 0.7, 0.02] },
  starfallcrossbow: { family: 'bow', model: 'legacy', tip: [0, 0.3, 0.13] },
  umbraltome: { family: 'wand', model: 'legacy', tip: [0, 0.42, 0], element: 'shadow' },
  orbitinggrimoire: { family: 'wand', model: 'legacy', tip: [0, 0.42, 0] },
};

// Legendary uniques (items.js LEGENDARIES) reuse their base weapon and add a signature accent:
// trim/material/attachment are drawn by hero.js legendary(); this adds the colour language that
// icons, drops and particles share.
export const UNIQUE_ACCENTS = {
  rootcleaver: { col: 0x7fd36a, element: 'poison', mark: 'thorn' },
  crescent: { col: 0xff4a5a, element: 'bleed', mark: 'crescent' },
  silentdawn: { col: 0xfff3b0, element: 'holy', mark: 'ray' },
  onigrin: { col: 0xff3a3a, element: 'bleed', mark: 'grin' },
  windwhisper: { col: 0xdff8ff, element: 'lightning', mark: 'wind' },
  sunshot: { col: 0xff9a2a, element: 'fire', mark: 'sun' },
  thornquill: { col: 0x5a8a3a, element: 'poison', mark: 'thorn' },
  huntermoon: { col: 0xdff4ff, element: 'frost', mark: 'moon' },
  hexbloom: { col: 0xc46bff, element: 'shadow', mark: 'bloom' },
  candlewick: { col: 0xffb347, element: 'fire', mark: 'flame' },
  owlhollow: { col: 0x7fd36a, element: 'arcane', mark: 'eyes' },
  starfall: { col: 0xfff3b0, element: 'arcane', mark: 'star' },
};

// Rarity language: never recolours the weapon. Tier 0-4 match items.js RARITY; 5 = Prismatic
// (item.prismatic, or item.rarity === 'prismatic' on the future itemization schema).
export const RARITY_VISUAL = [
  { id: 'common', gem: null, glow: 0xe8e2d0, disc: 0, beam: 0, motes: 0 },
  { id: 'uncommon', gem: 0x6fdc5a, glow: 0x6fdc5a, disc: 0.35, beam: 0, motes: 0 },
  { id: 'rare', gem: 0x4aa8ff, glow: 0x4aa8ff, disc: 0.45, beam: 1.1, motes: 0.06 },
  { id: 'epic', gem: 0xc46bff, glow: 0xc46bff, disc: 0.55, beam: 2.2, motes: 0.12 },
  { id: 'legendary', gem: 0xff9a2a, glow: 0xff9a2a, disc: 0.7, beam: 3.6, motes: 0.2 },
  { id: 'prismatic', gem: 'prism', glow: 0x93dfff, disc: 0.8, beam: 5.5, motes: 0.3 },
];
export const PRISM = [0x75e9ff, 0xb992ff, 0xff79d9, 0xffd763, 0x66eeb6];

// Element overlays (restrained: edge tint + a few particles). Names follow the upcoming ARPG
// element list; 'bleed' covers bleed/physical and 'shadow' covers shadow/spirit.
export const ELEMENT_VISUAL = {
  fire: { edge: 0xff7a2a, glow: 0xffb347, spark: [0xffb347, 0xff6a2a, 0xfff0a0], rate: 7, rise: 1.2, size: 0.05 },
  frost: { edge: 0xbfeaff, glow: 0xdff4ff, spark: [0xdff4ff, 0x9ad8ff, 0xffffff], rate: 5, rise: -0.3, size: 0.045 },
  lightning: { edge: 0xdff4ff, glow: 0x9ad8ff, spark: [0xffffff, 0x9ad8ff, 0xdff4ff], rate: 6, rise: 0, size: 0.04, arc: true },
  poison: { edge: 0x7ad04a, glow: 0x9aff6a, spark: [0x7ad04a, 0xb8ff7a], rate: 4, rise: -0.6, size: 0.05 },
  bleed: { edge: 0x9a1a24, glow: 0xd8303a, spark: [0xb8202a, 0x6a0c14], rate: 3, rise: -1, size: 0.04 },
  shadow: { edge: 0xa87aff, glow: 0xc8b0ff, spark: [0xb8a8ff, 0x8fe3dc, 0x7a6ab8], rate: 4, rise: 0.8, size: 0.05 },
  holy: { edge: 0xfff3b0, glow: 0xfff8d8, spark: [0xfff3b0, 0xffffff], rate: 4, rise: 1, size: 0.045 },
  arcane: { edge: 0xc89aff, glow: 0xe0c8ff, spark: [0xc89aff, 0x9ad8ff, 0xffffff], rate: 4, rise: 0.6, size: 0.045 },
};
// today's affixes → element (the ARPG branch can add item.element / item.elements directly)
const AFFIX_ELEMENT = { burn: 'fire', chill: 'frost', shock: 'lightning' };

// ------------------------------------------------------------------ adapters (the only item-shape knowledge)
export const baseOf = item => (typeof item === 'string' ? item : item && (item.base || item.baseId || item.id)) || null;
const merged = new Map();
export function getWeaponVisual(itemOrBase) {
  const id = baseOf(itemOrBase);
  if (!id || !WEAPON_VISUALS[id]) return null;
  if (merged.has(id)) return merged.get(id);
  const e = WEAPON_VISUALS[id];
  let v = e;
  if (e.via) { const b = getWeaponVisual(e.via); v = { ...b, ...e, pal: { ...b.pal, ...e.pal }, via: e.via, sheet: e.sheet || null }; }
  v = { id, scale: 1, hold: 'one', icon: ICON_INDEX[id] ?? null, tip: [0, 0.6, 0], ...v };
  merged.set(id, v);
  return v;
}
// 0-4 as today, 5 = prismatic
export function rarityTier(item) {
  if (!item) return 0;
  if (item.prismatic || item.rarity === 'prismatic' || item.tier === 'prismatic') return 5;
  return Math.max(0, Math.min(5, item.r | 0));
}
// every element this weapon should show (base identity first, then the rolled ones)
export function weaponElements(item) {
  if (!item) return [];
  const out = [];
  const add = e => { e = ({spirit:'shadow',physical:'bleed'}[e] || e); if (e && ELEMENT_VISUAL[e] && !out.includes(e)) out.push(e); };
  if (item.element) add(item.element);
  if (Array.isArray(item.elements)) item.elements.forEach(e => add(typeof e === 'string' ? e : e && e.id));
  if (item.unique && UNIQUE_ACCENTS[item.unique]) add(UNIQUE_ACCENTS[item.unique].element);
  const s = item.stats || {};
  for (const k in AFFIX_ELEMENT) if (s[k] > 0) add(AFFIX_ELEMENT[k]);
  const v = getWeaponVisual(item);
  if (v && v.element) add(v.element);
  return out;
}
