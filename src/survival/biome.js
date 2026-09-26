// Survival biome data. The generator reads only these numbers, so a biome is tuned (or a new one
// added) without touching generation code.
export const GEN_VERSION = 1; // bump when generation changes; saves keep the version they were made with

export const BIOMES = {
  forest: {
    id: 'forest', name: 'Mosswood Wilds',
    // terrain
    waterLevel: 0.3,        // elevation below this is water (ponds and pockets)
    shallowBand: 0.012,      // wadeable rim around ponds
    rockPatch: 0.63,          // rocky-ground noise above this
    outcrop: 0.8,           // impassable rock outcrops inside rocky patches
    flowers: 0.12,           // share of meadow tiles in flowers
    // scenery nodes (per 2x2 block chance, scaled by the local noise)
    treeDensity: 0.85, treeCanopy: 0.52,   // forest noise above treeCanopy grows tree clusters
    meadowTrees: 0.05,                      // lone trees in open glades
    rockDensity: 0.5, oreShare: 0.14, meadowRocks: 0.025,      // rocks in rocky patches; share of them that are ore
    shrubDensity: 0.1,                      // fibre shrubs in meadows
    // points of interest on a coarse grid (one candidate per region cell)
    region: 48, caveChance: 0.34, ruinChance: 0.24, stonesChance: 0.16,
    clearing: 5,             // radius kept open around every point of interest
    // creatures (per region cell, away from the start)
    packs: [['blot', 3], ['beetle', 2], ['seedling', 3], ['puffer', 1], ['brigand', 2], ['mantis', 1]], packChance: 0.55,
    // colours
    sky: 0xa8d8f0, fog: 0xcfe4d8, sun: 0xfff0d0, amb: 0xb0c8a8, ground: 0x5f9a44,
  },
};

// World size for this pass: bounded, generated lazily chunk by chunk. Raising W/H is safe:
// every tile and node depends only on (seed, x, z, version), never on the world size.
export const WORLD = { w: 480, h: 480, start: { x: 240, z: 240 }, startClearing: 9, border: 3 };
