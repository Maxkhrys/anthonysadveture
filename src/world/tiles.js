export const T = {
  GRASS: 0, PATH: 1, SAND: 2, ASH: 3, WATER: 4, DEEP: 5, CLIFF: 6, TREE: 7, WALL: 8, FLOOR: 9, PIT: 10,
  BRIDGE: 11, LAVA: 12, PROP: 13, FILLED: 14, MOSS: 15, FLOWERS: 16, FOREST: 17, STONE: 18, CAVE: 19,
  ROCK: 20, DOCK: 21, SANDSTONE: 22, PILLAR: 23,
};
// solid for normal walking
const SOLID = new Set([T.CLIFF, T.TREE, T.WALL, T.PROP, T.ROCK, T.SANDSTONE, T.PILLAR, T.WATER, T.DEEP, T.LAVA]);
export const isSolid = t => SOLID.has(t);
export const isLiquid = t => t === T.WATER || t === T.DEEP || t === T.LAVA;
export const isPit = t => t === T.PIT;
// blocks thrown/pushed objects & wind-slid crates
export const blocksObject = t => t === T.CLIFF || t === T.TREE || t === T.WALL || t === T.PROP || t === T.ROCK || t === T.SANDSTONE || t === T.PILLAR || t === T.LAVA;

export const TILE_INFO = {
  [T.GRASS]: { h: 0, top: [0x6fbf4a, 0x62b043, 0x7ccb52] },
  [T.FLOWERS]: { h: 0, top: [0x6fbf4a, 0x75c24e, 0x66b646] },
  [T.FOREST]: { h: 0, top: [0x3f8a3c, 0x377e37, 0x468f40] },
  [T.PATH]: { h: 0, top: [0xd8b37a, 0xceaa70, 0xe0bc84] },
  [T.SAND]: { h: 0, top: [0xf1d38e, 0xe9c981, 0xf6da99] },
  [T.ASH]: { h: 0, top: [0x5b4a4a, 0x534343, 0x625050] },
  [T.WATER]: { h: -0.45, top: [0x3a7a8c] , side: 0x2f6070 },
  [T.DEEP]: { h: -0.6, top: [0x245a78], side: 0x1f4b63 },
  [T.LAVA]: { h: -0.35, top: [0x7a2a10], side: 0x3a1a14 },
  [T.CLIFF]: { h: 2, top: [0x7fae58, 0x76a352], side: 0x8a7a68, side2: 0x6c5e52 },
  [T.ROCK]: { h: 2.2, top: [0x5a5066, 0x544a60], side: 0x463c52, side2: 0x3a3246 },
  [T.SANDSTONE]: { h: 1.6, top: [0xe8b77a, 0xdcab6e], side: 0xc98a58, side2: 0xa86e46 },
  [T.TREE]: { h: 0, top: [0x3f8a3c, 0x377e37] },
  [T.PROP]: { h: 0, top: [0x6fbf4a, 0x62b043] },
  [T.WALL]: { h: 1.5, top: [0x4f6a44, 0x48613f, 0x587449], side: 0x8a6a4e, side2: 0x6e5440 },
  [T.PILLAR]: { h: 1.2, top: [0x6a8a52], side: 0x7a5e44, side2: 0x5e4632 },
  [T.FLOOR]: { h: 0, top: [0xa08a6a, 0x98825f, 0xa68f70] },
  [T.MOSS]: { h: 0, top: [0x7a9a58, 0x70904f, 0x84a262] },
  [T.PIT]: { h: -4, top: [0x0c0812], side: 0x2a2030, side2: 0x0c0812 },
  [T.FILLED]: { h: -0.08, top: [0xa0703e, 0x946636] },
  [T.BRIDGE]: { h: 0.05, top: [0xa87a48, 0x9a6c3e] , side: 0x6a4a2a},
  [T.DOCK]: { h: 0.05, top: [0xa87a48, 0x9a6c3e], side: 0x6a4a2a },
  [T.STONE]: { h: 0, top: [0xbfb3a0, 0xb3a792, 0xc9bda8] },
  [T.CAVE]: { h: 0, top: [0x5e5566, 0x564d5e, 0x665d6e] },
};
