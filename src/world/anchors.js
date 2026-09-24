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
    { id: 'c-deepsouth', x: 64.5, z: 142.5, region: 'deepwood' },
    { id: 'c-glass', x: 158.5, z: 104.5, region: 'glassmere' },
    { id: 'c-sunshore', x: 262.5, z: 170.5, region: 'sunscald' },
    { id: 'c-sunroad', x: 284.5, z: 154.5, region: 'sunscald' },
    { id: 'c-kiln', x: 306.5, z: 138.5, region: 'sunscald' },
    { id: 'c-landingsouth', x: 290.5, z: 226.5, region: 'lake' },
    { id: 'c-cinderwest', x: 236.5, z: 56.5, region: 'cinderpeak' },
    { id: 'c-cindereast', x: 302.5, z: 58.5, region: 'cinderpeak' },
    { id: 'c-fenwest', x: 28.5, z: 202.5, region: 'moonfen' },
    { id: 'c-fensouth', x: 98.5, z: 226.5, region: 'moonfen' },
    { id: 'c-highwest', x: 90.5, z: 50.5, region: 'highlands' },
    { id: 'c-highnorth', x: 142.5, z: 24.5, region: 'highlands' },
  ],
  // rare named elites (some only walk at night)
  rare: [
    { id: 'r-meadow', x: 184.5, z: 150.5, region: 'heartland' }, { id: 'r-mill', x: 128.5, z: 140.5, region: 'heartland' },
    { id: 'r-oak', x: 46.5, z: 126.5, region: 'deepwood' }, { id: 'r-nestpath', x: 30.5, z: 98.5, region: 'deepwood' }, { id: 'r-deepeast', x: 78.5, z: 138.5, region: 'deepwood' },
    { id: 'r-dome', x: 150.5, z: 98.5, region: 'glassmere' }, { id: 'r-mirror', x: 170.5, z: 92.5, region: 'glassmere' },
    { id: 'r-heron', x: 164.5, z: 204.5, region: 'lake' }, { id: 'r-shore', x: 296.5, z: 232.5, region: 'lake' },
    { id: 'r-mesa', x: 254.5, z: 116.5, region: 'sunscald' }, { id: 'r-awning', x: 256.5, z: 156.5, region: 'sunscald' }, { id: 'r-flats', x: 292.5, z: 150.5, region: 'sunscald' },
    { id: 'r-anvil', x: 252.5, z: 34.5, region: 'cinderpeak' }, { id: 'r-foundry', x: 292.5, z: 40.5, region: 'cinderpeak' }, { id: 'r-lavaroad', x: 274.5, z: 90.5, region: 'cinderpeak' },
    { id: 'r-willow', x: 64.5, z: 206.5, region: 'moonfen' }, { id: 'r-mere', x: 40.5, z: 220.5, region: 'moonfen' }, { id: 'r-fenboards', x: 86.5, z: 182.5, region: 'moonfen' },
    { id: 'r-cairns', x: 54.5, z: 42.5, region: 'highlands' }, { id: 'r-split', x: 170.5, z: 52.5, region: 'highlands' },
  ],
  // where a travelling pedlar might pitch a stall for the day
  merchants: [
    { id: 'm-crossroads', x: 172.5, z: 132.5, region: 'heartland' }, { id: 'm-shrine', x: 60.5, z: 131.5, region: 'deepwood' },
    { id: 'm-steps', x: 146.5, z: 116.5, region: 'glassmere' }, { id: 'm-wells', x: 263.5, z: 154.5, region: 'sunscald' },
    { id: 'm-landing', x: 296.5, z: 194.5, region: 'lake' }, { id: 'm-rest', x: 262.5, z: 64.5, region: 'cinderpeak' },
    { id: 'm-lantern', x: 70.5, z: 192.5, region: 'moonfen' }, { id: 'm-windtop', x: 136.5, z: 58.5, region: 'highlands' },
  ],
  // event sites: where a star can fall, where the Hush can tear through, which way the dead walk
  events: {
    star: [
      { id: 's-knollfield', x: 176.5, z: 118.5 }, { id: 's-meadow', x: 190.5, z: 146.5 }, { id: 's-deep', x: 46.5, z: 134.5 },
      { id: 's-flats', x: 280.5, z: 146.5 }, { id: 's-ash', x: 262.5, z: 40.5 }, { id: 's-cairn', x: 66.5, z: 42.5 },
      { id: 's-heron', x: 158.5, z: 208.5 }, { id: 's-glass', x: 158.5, z: 90.5 }, { id: 's-fen', x: 64.5, z: 196.5 }, { id: 's-high', x: 110.5, z: 56.5 },
    ],
    incursion: [
      { id: 'i-eastroad', x: 190.5, z: 127.5 }, { id: 'i-westroad', x: 104.5, z: 116.5 }, { id: 'i-sunroad', x: 256.5, z: 141.5 },
      { id: 'i-landingroad', x: 286.5, z: 166.5 }, { id: 'i-kiln', x: 275.5, z: 96.5 }, { id: 'i-glass', x: 150.5, z: 110.5 },
      { id: 'i-deep', x: 68.5, z: 124.5 }, { id: 'i-belfry', x: 126.5, z: 50.5 },
    ],
    procession: [
      { id: 'p-mere', pts: [[34, 184], [40, 196], [46, 206], [52, 214], [58, 214]] },
      { id: 'p-boards', pts: [[86, 180], [76, 196], [70, 210], [62, 216]] },
      { id: 'p-shrines', pts: [[22, 196], [30, 206], [42, 212], [56, 216]] },
    ],
    moths: [
      { id: 'mo-glass', x: 160.5, z: 96.5 }, { id: 'mo-fen', x: 58.5, z: 200.5 }, { id: 'mo-shore', x: 132.5, z: 176.5 },
    ],
  },
  // optional mini-dungeon mouths whose place differs from world to world
  caves: {
    sunkenburrow: [{ id: 'b-west', x: 20.5, z: 216.5 }, { id: 'b-south', x: 70.5, z: 240.5 }, { id: 'b-east', x: 104.5, z: 200.5 }],
    teapot: [{ id: 't-flats', x: 284.5, z: 164.5 }, { id: 't-north', x: 264.5, z: 118.5 }],
  },
  // small hidden caches of crafting materials
  pockets: [
    { id: 'k-log', x: 62.5, z: 96.5, region: 'deepwood' }, { id: 'k-shroom', x: 24.5, z: 158.5, region: 'deepwood' },
    { id: 'k-dome', x: 136.5, z: 92.5, region: 'glassmere' }, { id: 'k-mirror', x: 172.5, z: 88.5, region: 'glassmere' },
    { id: 'k-heron', x: 154.5, z: 210.5, region: 'lake' }, { id: 'k-landing', x: 300.5, z: 212.5, region: 'lake' },
    { id: 'k-pots', x: 270.5, z: 136.5, region: 'sunscald' }, { id: 'k-mesa2', x: 244.5, z: 156.5, region: 'sunscald' },
    { id: 'k-anvil', x: 258.5, z: 24.5, region: 'cinderpeak' }, { id: 'k-rest', x: 282.5, z: 48.5, region: 'cinderpeak' },
    { id: 'k-willow', x: 54.5, z: 216.5, region: 'moonfen' }, { id: 'k-belfry', x: 80.5, z: 230.5, region: 'moonfen' },
    { id: 'k-ruins', x: 162.5, z: 22.5, region: 'highlands' }, { id: 'k-crown', x: 102.5, z: 14.5, region: 'highlands' },
  ],
};
