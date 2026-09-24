// Pass 6 world layout: pure data shared by the world builder, the save model and the dev
// tools. No rendering, no browser APIs.
//
// Lanternreach is one seamless overworld. The original 150x110 map (the "Heartland") is placed
// at HEART inside it, unchanged; eight regions are authored around it.

export const WORLD_W = 320, WORLD_H = 260;
// where the original map's (0,0) now sits. Saves written before Pass 6 are shifted by this
// once (see persistence/model.js: migrateWorld).
export const HEART = { x: 90, z: 70, w: 150, h: 110 };
export const LAYOUT_VERSION = 2;

// Biomes paint ground colour, scenery, mood, music and encounter pools. The index is stored
// per tile in area.biome.
export const BIOMES = ['heartland', 'whisperwood', 'deepwood', 'glassmere', 'lake', 'sunscald', 'cinderpeak', 'moonfen', 'highlands'];
export const BIOME = Object.fromEntries(BIOMES.map((b, i) => [b, i]));

// The eight regions a player discovers (Deepwood is Whisperwood's older, darker heart).
// level: typical monster level; music: a track in engine/audio.js; ambience: a sound-bed id.
export const REGIONS = {
  heartland: { name: 'Thimblewick Heartland', level: 2, music: 'field', ambience: 'meadow', color: '#e8d6a8' },
  whisperwood: { name: 'Whisperwood', level: 4, music: 'forest', ambience: 'forest', color: '#9fb07a' },
  deepwood: { name: 'The Deepwood', level: 7, music: 'forest', ambience: 'deepforest', color: '#6f8a5a' },
  glassmere: { name: 'Glassmere', level: 6, music: 'glass', ambience: 'glass', color: '#bfe6d8' },
  lake: { name: 'Lake Mirrow', level: 8, music: 'lake', ambience: 'water', color: '#8fb8c8' },
  sunscald: { name: 'Sunscald Reach', level: 9, music: 'desert', ambience: 'dry', color: '#f0d09a' },
  cinderpeak: { name: 'Cinderpeak', level: 12, music: 'volcano', ambience: 'volcanic', color: '#a8908a' },
  moonfen: { name: 'Moonfen', level: 11, music: 'marsh', ambience: 'marsh', color: '#6a8a8a' },
  highlands: { name: 'Chime Highlands', level: 14, music: 'highlands', ambience: 'wind', color: '#d8d8c8' },
};
export const REGION_IDS = Object.keys(REGIONS);

// Discovery grid for the map's fog: one bit per FOG x FOG tiles.
export const FOG = 8;
export const FOG_W = Math.ceil(WORLD_W / FOG), FOG_H = Math.ceil(WORLD_H / FOG);

// heart-local -> world coordinates
export const hx = x => x + HEART.x;
export const hz = z => z + HEART.z;
