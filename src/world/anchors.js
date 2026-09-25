// Pass 6: authored candidate spots for OPTIONAL content. The world seed picks among them
// (worldseed.js); the picks are then saved with the character, so later changes to this file
// can never move something a player has already found.
//
// Every anchor sits on open, reachable ground (scripts/worldcheck.mjs checks them).

export const ANCHORS = {
  // roadside camps: brigands, Hush warbands, imp nests, knights' bivouacs
  camps: [
    { id: 'c-eastroad', x: 196.5, z: 124.5, region: 'heartland' },
    { id: 'c-southmeadow', x: 136.5, z: 152.5, region: 'heartland' },
    { id: 'c-deepwest', x: 80.5, z: 112.5, region: 'deepwood' },
    { id: 'c-deepsouth', x: 65.5, z: 141.5, region: 'deepwood' },
    { id: 'c-glass', x: 159.5, z: 103.5, region: 'glassmere' },
    { id: 'c-sunshore', x: 262.5, z: 169.5, region: 'sunscald' },
    { id: 'c-sunroad', x: 284.5, z: 154.5, region: 'sunscald' },
    { id: 'c-kiln', x: 306.5, z: 138.5, region: 'sunscald' },
    { id: 'c-landingsouth', x: 290.5, z: 226.5, region: 'lake' },
    { id: 'c-cinderwest', x: 236.5, z: 56.5, region: 'cinderpeak' },
    { id: 'c-cindereast', x: 304.5, z: 62.5, region: 'cinderpeak' },
    { id: 'c-fenwest', x: 27.5, z: 203.5, region: 'moonfen' },
    { id: 'c-fensouth', x: 96.5, z: 226.5, region: 'moonfen' },
    { id: 'c-highwest', x: 89.5, z: 51.5, region: 'highlands' },
    { id: 'c-highnorth', x: 143.5, z: 23.5, region: 'highlands' },
  ],
  // rare named elites (some only walk at night)
  rare: [
    { id: 'r-meadow', x: 184.5, z: 150.5, region: 'heartland' }, { id: 'r-mill', x: 130.5, z: 142.5, region: 'heartland' },
    { id: 'r-oak', x: 45.5, z: 125.5, region: 'deepwood' }, { id: 'r-nestpath', x: 27.5, z: 95.5, region: 'deepwood' }, { id: 'r-deepeast', x: 78.5, z: 138.5, region: 'deepwood' },
    { id: 'r-dome', x: 149.5, z: 99.5, region: 'glassmere' }, { id: 'r-mirror', x: 171.5, z: 91.5, region: 'glassmere' },
    { id: 'r-heron', x: 164.5, z: 204.5, region: 'lake' }, { id: 'r-shore', x: 296.5, z: 232.5, region: 'lake' },
    { id: 'r-mesa', x: 254.5, z: 116.5, region: 'sunscald' }, { id: 'r-awning', x: 256.5, z: 156.5, region: 'sunscald' }, { id: 'r-flats', x: 292.5, z: 150.5, region: 'sunscald' },
    { id: 'r-anvil', x: 252.5, z: 34.5, region: 'cinderpeak' }, { id: 'r-foundry', x: 292.5, z: 40.5, region: 'cinderpeak' }, { id: 'r-lavaroad', x: 273.5, z: 89.5, region: 'cinderpeak' },
    { id: 'r-willow', x: 64.5, z: 207.5, region: 'moonfen' }, { id: 'r-mere', x: 40.5, z: 220.5, region: 'moonfen' }, { id: 'r-fenboards', x: 88.5, z: 183.5, region: 'moonfen' },
    { id: 'r-cairns', x: 54.5, z: 42.5, region: 'highlands' }, { id: 'r-split', x: 170.5, z: 52.5, region: 'highlands' },
  ],
  // where a travelling pedlar might pitch a stall for the day
  merchants: [
    { id: 'm-crossroads', x: 172.5, z: 132.5, region: 'heartland' }, { id: 'm-shrine', x: 59.5, z: 130.5, region: 'deepwood' },
    { id: 'm-steps', x: 146.5, z: 116.5, region: 'glassmere' }, { id: 'm-wells', x: 263.5, z: 154.5, region: 'sunscald' },
    { id: 'm-landing', x: 296.5, z: 194.5, region: 'lake' }, { id: 'm-rest', x: 259.5, z: 64.5, region: 'cinderpeak' },
    { id: 'm-lantern', x: 73.5, z: 188.5, region: 'moonfen' }, { id: 'm-windtop', x: 135.5, z: 57.5, region: 'highlands' },
  ],
  // event sites: where a star can fall, where the Hush can tear through, which way the dead walk
  events: {
    star: [
      { id: 's-knollfield', x: 177.5, z: 118.5 }, { id: 's-meadow', x: 186.5, z: 150.5 }, { id: 's-deep', x: 50.5, z: 130.5 },
      { id: 's-flats', x: 280.5, z: 146.5 }, { id: 's-ash', x: 262.5, z: 40.5 }, { id: 's-cairn', x: 66.5, z: 42.5 },
      { id: 's-heron', x: 159.5, z: 206.5 }, { id: 's-glass', x: 156.5, z: 88.5 }, { id: 's-fen', x: 64.5, z: 198.5 }, { id: 's-high', x: 109.5, z: 57.5 },
    ],
    incursion: [
      { id: 'i-eastroad', x: 190.5, z: 127.5 }, { id: 'i-westroad', x: 103.5, z: 115.5 }, { id: 'i-sunroad', x: 256.5, z: 141.5 },
      { id: 'i-landingroad', x: 286.5, z: 166.5 }, { id: 'i-kiln', x: 275.5, z: 96.5 }, { id: 'i-glass', x: 150.5, z: 110.5 },
      { id: 'i-deep', x: 69.5, z: 124.5 }, { id: 'i-belfry', x: 126.5, z: 50.5 },
    ],
    procession: [
      { id: 'p-mere', pts: [[34, 184], [40, 196], [46, 206], [52, 214], [58, 214]] },
      { id: 'p-boards', pts: [[86, 180], [76, 196], [70, 210], [62, 216]] },
      { id: 'p-shrines', pts: [[22, 196], [30, 206], [42, 212], [56, 216]] },
    ],
    moths: [
      { id: 'mo-glass', x: 160.5, z: 96.5 }, { id: 'mo-fen', x: 55.5, z: 203.5 }, { id: 'mo-shore', x: 125.5, z: 169.5 },
    ],
  },
  // optional mini-dungeon mouths whose place differs from world to world
  caves: {
    sunkenburrow: [{ id: 'b-west', x: 22.5, z: 214.5 }, { id: 'b-south', x: 69.5, z: 241.5 }, { id: 'b-east', x: 100.5, z: 196.5 }],
    teapot: [{ id: 't-flats', x: 284.5, z: 164.5 }, { id: 't-north', x: 264.5, z: 118.5 }],
  },
  // small hidden caches of crafting materials
  pockets: [
    { id: 'k-log', x: 62.5, z: 96.5, region: 'deepwood' }, { id: 'k-shroom', x: 23.5, z: 159.5, region: 'deepwood' },
    { id: 'k-dome', x: 137.5, z: 92.5, region: 'glassmere' }, { id: 'k-mirror', x: 172.5, z: 88.5, region: 'glassmere' },
    { id: 'k-heron', x: 155.5, z: 206.5, region: 'lake' }, { id: 'k-landing', x: 300.5, z: 212.5, region: 'lake' },
    { id: 'k-pots', x: 270.5, z: 136.5, region: 'sunscald' }, { id: 'k-mesa2', x: 244.5, z: 156.5, region: 'sunscald' },
    { id: 'k-anvil', x: 258.5, z: 23.5, region: 'cinderpeak' }, { id: 'k-rest', x: 282.5, z: 48.5, region: 'cinderpeak' },
    { id: 'k-willow', x: 54.5, z: 216.5, region: 'moonfen' }, { id: 'k-belfry', x: 78.5, z: 228.5, region: 'moonfen' },
    { id: 'k-ruins', x: 162.5, z: 22.5, region: 'highlands' }, { id: 'k-crown', x: 102.5, z: 14.5, region: 'highlands' },
  ],
};
