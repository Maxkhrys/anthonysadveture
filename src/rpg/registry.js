// One place a developer tool (or anything else) can discover every piece of Pass 5 content
// without hardcoding lists twice. Everything here is a live reference to the real data.
import { SKILLS, TREES, PATHS, LOADOUT_SIZE } from './skills.js';
import { NAMED_WEAPONS, ACCESSORIES, SETS, SET_PIECES, NEW_ARMORS, FAMILY } from './gear.js';
import { REACTIONS, STATUS_INFO } from './elements.js';
import { RECIPES, MATS } from './crafting.js';
import { AFFIX_RARITY_TIERS, TIER_ORDER, QUALITATIVE_MODIFIERS } from './affixes.js';
import { IMPLEMENTED_QUALITATIVE } from './items.js';
import { EXTRA_ENEMIES } from '../entities/enemies.js';
import { PASS5_ENEMIES } from '../entities/monsters3.js';
import { BELLSTONES } from '../persistence/model.js';
import { CONSERVATORY_ROOMS } from '../world/conservatory.js';
import { REGIONS, WORLD_W, WORLD_H, HEART } from '../world/layout.js';
import { MINI } from '../world/minidungeons.js';
import { ANCHORS } from '../world/anchors.js';
import { POOLS } from '../world/encounters.js';
import { GENERATION_VERSION } from '../world/worldseed.js';

export const REGISTRY = {
  skills: SKILLS,                 // id -> active ability definition
  tree: TREES,                    // cls -> nodes
  paths: PATHS,                   // cls -> three identity paths
  loadoutSize: LOADOUT_SIZE,
  weaponFamilies: FAMILY,
  namedWeapons: NAMED_WEAPONS,    // incl. the Royal Teaspoon
  accessories: ACCESSORIES,
  sets: SETS, setPieces: Object.fromEntries(Object.keys(SETS).map(s => [s, SET_PIECES(s)])),
  armourBases: NEW_ARMORS,
  recipes: RECIPES, materials: MATS,
  affixTiers: TIER_ORDER.map(t => AFFIX_RARITY_TIERS[t]),
  qualitative: Object.values(QUALITATIVE_MODIFIERS).map(q => ({ ...q, implemented: IMPLEMENTED_QUALITATIVE.has(q.id) })),
  reactions: REACTIONS.map(r => ({ id: r.id, name: r.name, desc: r.desc })), statuses: STATUS_INFO,
  enemies: ['blot', 'seedling', 'beetle', 'puffer', 'wisp', 'knight', ...Object.keys(EXTRA_ENEMIES)],
  pass5Enemies: PASS5_ENEMIES,
  eliteModifiers: ['Swift', 'Brutal', 'Vampiric', 'Armoured', 'Volatile', 'Resonant', 'Oathbound', 'Stormtouched', 'Frostbound'],
  bosses: [
    { id: 'bramblemaw', name: 'Bramblemaw', area: 'dungeon', spawn: 'pre' },
    { id: 'seamkeeper', name: 'The Seamkeeper', area: 'conservatory', room: 'loom', flag: 'seamDead' },
    { id: 'toad', name: 'The Crowned Toad', area: 'overworld', spawn: 'fen', flag: 'toadAt', wake: 'ring the three fen lilies' },
  ],
  areas: {
    conservatory: { spawns: ['entrance', 'atrium', 'canopy'], rooms: CONSERVATORY_ROOMS },
    overworld: { spawns: ['village', 'conservatory', 'fen', 'dungeon', 'grotto'] },
  },
  bellstones: BELLSTONES,
  // Pass 6: the world (landmarks and places come from the built map: buildOverworld().landmarks)
  world: {
    size: [WORLD_W, WORLD_H], heart: HEART, generationVersion: GENERATION_VERSION,
    regions: REGIONS, pools: POOLS,
    settlements: [{ id: 'thimblewick', name: 'Thimblewick', spawn: 'village' }, { id: 'landing', name: 'Mirrow Landing', spawn: 'landing' }, { id: 'cinderrest', name: 'Cinder Rest', spawn: 'cinderrest' }],
    storyDungeons: [{ id: 'dungeon', name: 'Rootwell Hollow', status: 'open' }, { id: 'conservatory', name: 'The Cracked Conservatory', status: 'open' }, { id: 'emberwell', name: 'The Emberwell (Ember Chime)', status: 'sealed: later chapter' }, { id: 'tide', name: 'The Tide Shrine (Tide Chime)', status: 'sealed: later chapter' }, { id: 'spire', name: 'The Chime Spire', status: 'sealed: later chapter' }],
    miniDungeons: Object.entries(MINI).map(([id, m]) => ({ id, name: m.name, level: m.level, rooms: Object.keys(m.rooms).length, seeded: m.exit.startsWith('cave:') })),
    worldBosses: [{ id: 'toad', name: 'The Crowned Toad', where: 'Mirewhistle Fen', respawn: '2 days' }, { id: 'tollcrow', name: 'The Tollcrow', where: 'Belfry Cradle, Chime Highlands', respawn: '3 days' }],
    eventTypes: ['fallen star (night)', 'Hush tear (day)', 'moth migration (dusk)', 'midnight procession (Moonfen)', 'Gilded Beetle', 'night patrols', 'seeded camps', 'rare elites', 'the travelling pedlar'],
    anchors: ANCHORS,
  },
};
