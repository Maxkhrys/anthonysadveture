// Pass 6: eleven small optional dungeons, each 5-15 minutes: a fight, one puzzle idea, a
// secret, loot, a material, and a mini-elite. Rooms are authored as ASCII in the same 15x11
// cell grid as Rootwell Hollow, and joined by open doorways or shutters that a puzzle opens.
//
// Legend (inside a room):
//   . floor   g moss   ~ shallow water   = lava   P pit   O pillar   # rubble wall
//   C crate   B pushable block   L latched plate (group = room.plates)
//   T puzzle torch (gust them all out; group = room.torches)   t plain torch
//   w pinwheel that latches (signal = room.wind)   v short-lived pinwheel (pair = room.pair)
//   h hanging bell (pitch by order of appearance: 0 low, 1 middle, 2 high; group = room.bells)
//   x root tangle / cracked wall hiding a secret   * chest (from room.chests)   K loot chest
//   m mural   a/b/c/d/e enemies (dungeon's `foes` map)   A arena room (room.waves)
import { T } from './tiles.js';
import { hash2 } from '../engine/util.js';
import { Grid } from './grid.js';

const RW = 17, RH = 13;

export const MINI = {
  // ---- world pass: the regions' own side challenges (they exit back into their region)
  undercroft: {
    name: 'The Clockwork Undercroft', level: 7, exit: 'undercroft', exitArea: 'clockwork', exitLabel: 'The Clockwork Garden', music: 'dungeon', palette: 'bronze',
    foes: { a: 'porcelain', b: 'beetle', c: 'mantis' },
    rooms: {
      stair: { cell: [0, 1], name: 'Undercroft — The Escapement Stair', map: [
        '...............', '.t...........t.', '...O.......O...', '....a.....b....', '...............',
        '.......m.......', '...............', '...O.......O...', '..b.........c..', '.t...........t.', '...............'] },
      plates: { cell: [0, 0], name: 'Undercroft — The Weight Room', map: [
        '...............', '.#.#.#.#.#.#.#.', '...............', '...B.......B...', '...............',
        '.......*.......', '...............', '...L.......L...', '...............', '.x.....c.......', '...............'],
        plates: 'uc.plates', needs: 2, chests: [{ id: 'md-uc-weights', contents: { kind: 'mat', mat: 'porcelain', n: 2 } }], secret: { contents: { kind: 'pips', n: 90 } } },
      spring: { cell: [1, 0], name: 'Undercroft — The Mainspring', map: [
        '...............', '.t...........t.', '...............', '.......A.......', '...............',
        '...O.......O...', '...............', '.......K.......', '...............', '.t...........t.', '...............'],
        waves: [[['porcelain', -3, 0], ['porcelain', 3, 0], ['beetle', 0, -2]], [['porcelain', 0, -2, 'champion'], ['mantis', -3, 2], ['mantis', 3, 2]]], title: 'THE STOPPED WARDEN', goal: true },
    },
    links: [['stair', 'plates', 'open'], ['plates', 'spring', 'shutter', { signal: 'uc.plates' }]],
    mural: 'Stamped in the brass: "A WEIGHT ON EACH SIDE, AND THE SPRING WILL LISTEN."',
  },
  lumenburrow: {
    name: 'The Lumen Burrow', level: 9, exit: 'lumenburrow', exitArea: 'rootlight', exitLabel: 'The Rootlight Caverns', music: 'cave', palette: 'moon',
    foes: { a: 'sporeling', b: 'wisp', c: 'wraith' },
    rooms: {
      drip: { cell: [0, 1], name: 'Lumen Burrow — The Drip Gallery', map: [
        '...............', '.g.g.......g.g.', '...............', '...a.......a...', '..~~~.....~~~..',
        '.......m.......', '..~~~.....~~~..', '...b.......b...', '...............', '.g...........g.', '...............'] },
      chimes: { cell: [0, 0], name: 'Lumen Burrow — The Crystal Chimes', map: [
        '...............', '...h...h...h...', '...............', '...............', '....c.....c....',
        '.......*.......', '...............', '...............', '..g.........g..', '.............x.', '...............'],
        bells: 'lb.chimes', order: [1, 2, 0], chests: [{ id: 'md-lb-chimes', contents: { kind: 'mat', mat: 'moth', n: 2 } }], secret: { contents: { kind: 'mat', mat: 'echo', n: 1 }, glass: true } },
      dark: { cell: [1, 0], name: 'Lumen Burrow — What Drinks the Light', map: [
        '...............', '.g...........g.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......K.......', '...............', '.g...........g.', '...............'],
        waves: [[['wisp', -3, 0], ['wisp', 3, 0], ['wraith', 0, -2]], [['wraith', 0, -2, 'elite'], ['sporeling', -3, 2], ['sporeling', 3, 2]]], title: 'THE LIGHTDRINKER', goal: true },
    },
    links: [['drip', 'chimes', 'open'], ['chimes', 'dark', 'shutter', { signal: 'lb.chimes' }]],
    mural: 'Scratched by a lamp-keeper: "The middle crystal first. Then the bright. Then the deep one, last."',
  },

  rootcellar: {
    name: "Hobb's Root Cellar", level: 3, exit: 'rootcellar', music: 'cave', palette: 'earth',
    foes: { a: 'blot', b: 'puffer' },
    rooms: {
      stair: { cell: [0, 1], name: 'Root Cellar — The Stair', map: [
        '...............', '.t...........t.', '...............', '....a.....a....', '...............',
        '....C.....C....', '...............', 'PPPPPP...PPPPPP', 'PPPPPP...PPPPPP', '...............', '.t.....m.....t.'] },
      store: { cell: [0, 0], name: 'Root Cellar — Potato Store', map: [
        '...............', '.#.#.#.#.#.#.#.', '...............', '.....C...C.....', 'PPPPPPPPPPPPPPP',
        '...............', '..b.........b..', '.......*.......', '...............', '..........x....', '...............'],
        chests: [{ id: 'md-cellar-store', contents: { kind: 'mapfrag', region: 'whisperwood' } }], secret: { contents: { kind: 'pips', n: 60 } } },
      king: { cell: [1, 0], name: 'Root Cellar — The Rat King\'s Larder', map: [
        '...............', '.t...........t.', '...............', '...............', '...............',
        '.......A.......', '...............', '...............', '...............', '.t.....K.....t.', '...............'],
        waves: [[['blot', -3, -1], ['blot', 3, -1], ['blot', 0, 2]], [['blot', 0, -2, 'elite'], ['blot', -3, 2], ['blot', 3, 2]]], title: 'THE CELLAR KING', goal: true },
    },
    links: [['stair', 'store', 'open'], ['store', 'king', 'open']],
    mural: 'Scratched into a beam: "HOBB WAS HERE. SO WERE THE RATS."',
  },
  logburrow: {
    name: 'Hollow Log Burrow', level: 6, exit: 'logburrow', music: 'cave', palette: 'wood', dark: true,
    foes: { a: 'sporeling', b: 'mantis', c: 'moth' },
    rooms: {
      mouth: { cell: [0, 1], name: 'Log Burrow — Knot Hole', map: [
        '...............', '.t....a.a....t.', '...............', '..O.........O..', '.......c.......',
        '...............', '..O.........O..', '...............', '...a.......a...', '.t.....m.....t.', '...............'] },
      heart: { cell: [0, 0], name: 'Log Burrow — Heartwood Dark', map: [
        '...............', '..T.........T..', '...............', '....b.....b....', '...............',
        '.......*.......', '...............', '...............', '..T.........T..', '....x..........', '...............'],
        torches: 'lb.torches', chests: [{ id: 'md-log-heart', contents: { kind: 'mat', mat: 'thornheart', n: 1 }, hidden: 'lb.torches' }], secret: { contents: { kind: 'mat', mat: 'moth', n: 2 } } },
      wick: { cell: [1, 0], name: 'Log Burrow — Where the Lamplighter Hid', map: [
        '...............', '.t...........t.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......K.......', '...............', '.t...........t.', '...............'],
        waves: [[['mantis', -3, 0], ['mantis', 3, 0], ['moth', 0, -2]], [['treant', 0, -2, 'elite'], ['sporeling', -3, 2], ['sporeling', 3, 2]]], title: 'WHAT GUARDS THE WICK', goal: true },
    },
    links: [['mouth', 'heart', 'open'], ['heart', 'wick', 'shutter', { signal: 'lb.torches' }]],
    mural: 'Soot letters: "Lamps go out when the wind says so. Say it to all of them at once."',
  },
  beetlenest: {
    name: 'Thornback Nest', level: 7, exit: 'beetlenest', music: 'cave', palette: 'nest',
    foes: { a: 'beetle', b: 'mantis' },
    rooms: {
      tunnel: { cell: [0, 1], name: 'Thornback Nest — Egg Tunnels', map: [
        '...............', '.#..a.....a..#.', '...............', '..#.........#..', '.......m.......',
        '...............', '..#.........#..', '...a.....a.....', '...............', '.#...........#.', '...............'] },
      chamber: { cell: [0, 0], name: 'Thornback Nest — The Brood Chamber', map: [
        '...............', '...w.......b...', '...............', '..###.....###..', '...............',
        '.......*.......', '...............', '..###.....###..', '...............', '.x.............', '...............'],
        wind: 'bn.wind', chests: [{ id: 'md-nest-brood', contents: { kind: 'mat', mat: 'mantis', n: 2 } }], secret: { contents: { kind: 'pips', n: 80 } } },
      queen: { cell: [1, 0], name: 'Thornback Nest — The Queen', map: [
        '...............', '.#...........#.', '...............', '...............', '.......A.......',
        '...............', '...............', '.......U.......', '...............', '.#...........#.', '...............'],
        waves: [[['beetle', -3, 0], ['beetle', 3, 0], ['beetle', 0, 3]], [['beetle', 0, -2, 'champion'], ['beetle', -4, 2], ['beetle', 4, 2]]], title: 'THE NEST QUEEN', unique: 'nestcarapace', goal: true },
    },
    links: [['tunnel', 'chamber', 'open'], ['chamber', 'queen', 'shutter', { signal: 'bn.wind' }]],
    mural: 'A beetle drawn on its back, legs in the air, and a little pinwheel beside it.',
  },
  mirrorcellar: {
    name: 'The Mirror Cellar', level: 7, exit: 'mirrorcellar', music: 'dungeon', palette: 'glass',
    foes: { a: 'moth', b: 'mantis', c: 'porcelain' },
    rooms: {
      stair: { cell: [0, 1], name: 'Mirror Cellar — The Humming Stair', map: [
        '...............', '.t...........t.', '...............', '...h...h...h...', '...............',
        '.......m.......', '...............', '...a.......a...', '...............', '.t...........t.', '...............'],
        bells: 'mc.bells', order: [0, 2, 1] },
      gallery: { cell: [0, 0], name: 'Mirror Cellar — Gallery of Glass', map: [
        '...............', '..O.........O..', '...............', '....b.....b....', '...............',
        '.......*.......', '...............', '...............', '..O.........O..', '.............x.', '...............'],
        chests: [{ id: 'md-mirror-gallery', contents: { kind: 'mat', mat: 'porcelain', n: 2 } }], secret: { contents: { kind: 'mat', mat: 'moth', n: 2 }, glass: true } },
      vault: { cell: [1, 0], name: 'Mirror Cellar — The Reflecting Vault', map: [
        '...............', '.t...........t.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......U.......', '...............', '.t...........t.', '...............'],
        waves: [[['moth', -3, 0], ['moth', 3, 0], ['mantis', 0, -2]], [['porcelain', 0, -2, 'elite'], ['moth', -3, 2], ['moth', 3, 2]]], title: 'THE GLAZED WARDEN', unique: 'mirrorshard', goal: true },
    },
    links: [['stair', 'gallery', 'shutter', { signal: 'mc.bells' }], ['gallery', 'vault', 'open']],
    mural: 'Three bells painted in a row: the low one first, then the high, then the middle.\n"Ring them as the glass remembers."',
  },
  chapel: {
    name: 'The Drowned Chapel', level: 9, exit: 'chapel', music: 'dungeon', palette: 'chapel',
    foes: { a: 'leech', b: 'slug', c: 'wraith' },
    rooms: {
      nave: { cell: [0, 1], name: 'Drowned Chapel — The Nave', map: [
        '...............', '.~~~.......~~~.', '.~~~..a.a..~~~.', '...............', '.......m.......',
        '..B.........L..', '...............', '.~~~.......~~~.', '.~~~..b....~~~.', '...............', '...............'],
        plates: 'dc.plates', needs: 1 },
      crypt: { cell: [0, 0], name: 'Drowned Chapel — Font Crypt', map: [
        '...............', '..~~~~~~~~~~~..', '..~.........~..', '..~..c...c..~..', '..~.........~..',
        '..~....*....~..', '..~.........~..', '..~~~~~.~~~~~..', '...............', '.x.............', '...............'],
        chests: [{ id: 'md-chapel-font', contents: { kind: 'mat', mat: 'wax', n: 2 } }], secret: { contents: { kind: 'mat', mat: 'echo', n: 1 } } },
      altar: { cell: [1, 0], name: 'Drowned Chapel — The Sunken Altar', map: [
        '...............', '.~~~~.....~~~~.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......U.......', '...............', '.~~~~.....~~~~.', '...............'],
        waves: [[['leech', -3, 0], ['leech', 3, 0], ['slug', 0, -2]], [['leech', 0, -2, 'elite'], ['wraith', -3, 2], ['wraith', 3, 2]]], title: 'THE CHAPEL WARDEN', unique: 'tidebell', goal: true },
    },
    links: [['nave', 'crypt', 'shutter', { signal: 'dc.plates' }], ['crypt', 'altar', 'open']],
    mural: 'Carved over the font: "What sinks here is kept. Weigh the plate and the water lets you pass."',
  },
  kilncrypt: {
    name: 'The Kiln Crypt', level: 10, exit: 'kilncrypt', music: 'dungeon', palette: 'kiln',
    foes: { a: 'scorpion', b: 'porcelain', c: 'imp' },
    rooms: {
      stair: { cell: [0, 1], name: 'Kiln Crypt — Ash Stair', map: [
        '...............', '.t...........t.', '...............', '...C.......C...', '...............',
        '..L.........L..', '.......m.......', '...a.......a...', '...............', '.t...........t.', '...............'],
        plates: 'kc.plates', needs: 2 },
      urns: { cell: [0, 0], name: 'Kiln Crypt — The Urn Hall', map: [
        '...............', '.O.O.O.O.O.O.O.', '...............', '...b.......b...', '...............',
        '.......*.......', '...............', '...c.......c...', '...............', '.O.O.O.O.O.O.x.', '...............'],
        chests: [{ id: 'md-kiln-urns', contents: { kind: 'mat', mat: 'ember', n: 2 } }], secret: { contents: { kind: 'pips', n: 120 } } },
      kiln: { cell: [1, 0], name: 'Kiln Crypt — The Firing Chamber', map: [
        '...............', '.=...........=.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......U.......', '...............', '.=...........=.', '...............'],
        waves: [[['imp', -3, 0], ['imp', 3, 0], ['porcelain', 0, -2]], [['golem', 0, -2, 'elite'], ['scorpion', -3, 2], ['scorpion', 3, 2]]], title: 'THE KILNKEEPER', unique: 'kilnheart', goal: true },
    },
    links: [['stair', 'urns', 'shutter', { signal: 'kc.plates' }], ['urns', 'kiln', 'open']],
    mural: 'A Bellwright epitaph: "She fired the first bell here. Put two urns on the plates to let her sleep."',
  },
  teapot: {
    name: 'The Buried Teapot', level: 9, exit: 'cave:teapot', music: 'dungeon', palette: 'porcelain',
    foes: {},
    rooms: {
      pot: { cell: [0, 0], name: 'The Buried Teapot', map: [
        '...............', '..O.........O..', '...............', '...............', '.......A.......',
        '...............', '...............', '.......K.......', '...............', '..O.........O..', '...............'],
        waves: [[['porcelain', -3, 0], ['porcelain', 3, 0]], [['scorpion', -4, -2], ['scorpion', 4, -2], ['brigand', 0, 3]], [['porcelain', 0, -2, 'elite'], ['brigand', -3, 2], ['brigand', 3, 2]]], title: 'TEA FOR NOBODY', goal: true },
    },
    links: [],
  },
  forgedeep: {
    name: 'The Old Forge Deep', level: 12, exit: 'forgedeep', music: 'dungeon', palette: 'forge', dark: true,
    foes: { a: 'imp', b: 'slug', c: 'golem' },
    rooms: {
      gate: { cell: [0, 1], name: 'Forge Deep — The Bellows Gate', map: [
        '...............', '.t...........t.', '...a.......a...', '...............', '.==...m...==...',
        '.==.......==...', '...............', '...b.......b...', '...............', '.t...........t.', '...............'] },
      bellows: { cell: [0, 0], name: 'Forge Deep — The Dead Bellows', map: [
        '...............', '..T.........T..', '...............', '...==.....==...', '...............',
        '.......*.......', '...............', '...==.....==...', '..T.........T..', '.............x.', '...............'],
        torches: 'fd.torches', chests: [{ id: 'md-forge-bellows', contents: { kind: 'mat', mat: 'ember', n: 2 }, hidden: 'fd.torches' }], secret: { contents: { kind: 'mat', mat: 'filament', n: 1 } } },
      anvil: { cell: [1, 0], name: 'Forge Deep — The Cold Anvil', map: [
        '...............', '.=...........=.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......*.......', '...............', '.=...........=.', '...............'],
        waves: [[['imp', -3, 0], ['imp', 3, 0], ['slug', 0, -2]], [['imp', 0, -2, 'elite'], ['golem', -3, 2], ['imp', 3, 2]]], title: 'THE FORGELING', goal: true,
        chests: [{ id: 'md-forge-tongs', contents: { kind: 'quest', flag: 'tongs', name: "Brakka's Tongs", desc: 'Heavy iron tongs with a B burned into the grip. Brakka will want these.' } }] },
    },
    links: [['gate', 'bellows', 'open'], ['bellows', 'anvil', 'shutter', { signal: 'fd.torches' }]],
    mural: 'A smith\'s rule, stamped in iron: "Four fires. Blow them out together and the forge will breathe."',
  },
  moonwell: {
    name: 'The Moonwell Shrine', level: 11, exit: 'moonwell', music: 'cave', palette: 'moon', dark: true,
    foes: { a: 'wisp', b: 'wraith', c: 'leech' },
    rooms: {
      cloister: { cell: [0, 1], name: 'Moonwell — Cloister of Lamps', map: [
        '...............', '.t...........t.', '...............', '..v.........v..', '...............',
        '.......m.......', '...a.......a...', '...............', '...............', '.t...........t.', '...............'],
        pair: 'mw' },
      well: { cell: [0, 0], name: 'Moonwell — The Dry Well', map: [
        '...............', '...~~~~~~~~~...', '...~.......~...', '...~...A...~...', '...~.......~...',
        '...~~~~.~~~~...', '...............', '...............', '.......*.......', '.x.............', '...............'],
        waves: [[['wisp', -3, 0], ['wisp', 3, 0], ['leech', 0, 3]], [['wraith', 0, -2, 'elite'], ['wisp', -3, 2], ['wisp', 3, 2]]], title: 'THE WELL\'S WARDEN', goal: true,
        chests: [{ id: 'md-moonwell', contents: { kind: 'mapfrag', region: 'moonfen' } }], secret: { contents: { kind: 'mat', mat: 'echo', n: 1 } } },
    },
    links: [['cloister', 'well', 'shutter', { signal: 'mw.both' }]],
    mural: 'Two lamps, and between them a wind that says everything twice.',
  },
  sunkenburrow: {
    name: 'The Sunken Burrow', level: 10, exit: 'cave:sunkenburrow', music: 'cave', palette: 'fen', dark: true,
    foes: { a: 'leech', b: 'slug' },
    rooms: {
      drip: { cell: [0, 1], name: 'Sunken Burrow — The Drip', map: [
        '...............', '.~~~.......~~~.', '....a.....a....', '...............', '...C.......C...',
        'PPPPPPP.PPPPPPP', '...............', '...b.......b...', '...............', '.~~~...m...~~~.', '...............'] },
      nest: { cell: [0, 0], name: 'Sunken Burrow — Leech Nest', map: [
        '...............', '.~~~~.....~~~~.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......K.......', '.x.............', '.~~~~.....~~~~.', '...............'],
        waves: [[['leech', -3, 0], ['leech', 3, 0]], [['slug', 0, -2, 'elite'], ['leech', -3, 2], ['leech', 3, 2]]], title: 'THE BURROW MOTHER', goal: true, secret: { contents: { kind: 'mat', mat: 'wax', n: 2 } } },
    },
    links: [['drip', 'nest', 'open']],
    mural: 'Toothmarks. Lots of toothmarks.',
  },
  bellhollow: {
    name: 'Bell Hollow', level: 14, exit: 'bellhollow', music: 'dungeon', palette: 'bronze',
    foes: { a: 'leech', b: 'knight', c: 'porcelain' },
    rooms: {
      lip: { cell: [0, 1], name: 'Bell Hollow — The Lip', map: [
        '...............', '.t...........t.', '...............', '..h....h....h..', '...............',
        '.......m.......', '...............', '...a.......a...', '...............', '.t...........t.', '...............'],
        bells: 'bh.bells', order: [2, 1, 0] },
      clapper: { cell: [0, 0], name: 'Bell Hollow — Under the Clapper', map: [
        '...............', '...w.......O...', '...............', '...b.......b...', '...............',
        '.......*.......', '...............', '...c.......c...', '...............', '.x.............', '...............'],
        wind: 'bh.wind', chests: [{ id: 'md-bell-clapper', contents: { kind: 'mapfrag', region: 'highlands' } }], secret: { contents: { kind: 'mat', mat: 'filament', n: 2 } } },
      crown: { cell: [1, 0], name: 'Bell Hollow — The Crown', map: [
        '...............', '.t...........t.', '...............', '.......A.......', '...............',
        '...............', '...............', '.......K.......', '...............', '.t...........t.', '...............'],
        waves: [[['knight', -3, 0], ['knight', 3, 0]], [['knight', 0, -2, 'elite'], ['leech', -3, 2], ['porcelain', 3, 2]]], title: 'THE BRONZE WARDEN', goal: true },
    },
    links: [['lip', 'clapper', 'shutter', { signal: 'bh.bells' }], ['clapper', 'crown', 'shutter', { signal: 'bh.wind' }]],
    mural: 'Inside the bronze, someone scratched the note names high to low. Then: "and the wind for the crown."',
  },
};
export const MINI_IDS = Object.keys(MINI);

// wall and floor colours per dungeon
const PAL = {
  earth: { floor: [0x8a7258, 0x826a50, 0x927a60], wall: [0x5a4a38, 0x524232], side: 0x6a5440, side2: 0x5a4636, sky: 0x100c08, fog: 0x1e1610, sun: 0xffe0c0, amb: 0x6a5a4a },
  wood: { floor: [0x7a5a3a, 0x725234, 0x826240], wall: [0x5a3e28, 0x523822], side: 0x6a4a30, side2: 0x5a3e28, sky: 0x0c0a06, fog: 0x1a140c, sun: 0xffd8a0, amb: 0x5a4a3a },
  nest: { floor: [0x7a6a48, 0x726240, 0x827250], wall: [0x5a4a30, 0x524428], side: 0x6a5238, side2: 0x5a4430, sky: 0x100c06, fog: 0x1e180c, sun: 0xffe0a0, amb: 0x6a5a3a },
  glass: { floor: [0xb0c8c0, 0xa8c0b8, 0xb8d0c8], wall: [0x3a5a50, 0x345248], side: 0x4a6a60, side2: 0x3a5a50, sky: 0x0c1412, fog: 0x1a2a26, sun: 0xe8fff8, amb: 0x6a8a84 },
  chapel: { floor: [0x9a9a92, 0x92928a, 0xa2a29a], wall: [0x5a6a72, 0x52626a], side: 0x6a7a82, side2: 0x5a6a72, sky: 0x0a1014, fog: 0x1a2630, sun: 0xd8e8ff, amb: 0x5a6a7a },
  kiln: { floor: [0xc89a6a, 0xc09262, 0xd0a272], wall: [0x8a5a3a, 0x825234], side: 0xa86e46, side2: 0x8a5a3a, sky: 0x140c08, fog: 0x2a1a10, sun: 0xffd0a0, amb: 0x7a5a4a },
  porcelain: { floor: [0xe8e4dc, 0xe0dcd4, 0xf0ece4], wall: [0x4a6ab0, 0x4462a8], side: 0xd8d4cc, side2: 0xc8c4bc, sky: 0x0c1018, fog: 0x1a2030, sun: 0xffffff, amb: 0x7a8aa8 },
  forge: { floor: [0x4a4048, 0x443a42, 0x504650], wall: [0x2a2226, 0x241e22], side: 0x3a3036, side2: 0x2a2226, sky: 0x0a0606, fog: 0x2a1410, sun: 0xffb080, amb: 0x5a3a3a },
  moon: { floor: [0x4a5a6a, 0x445464, 0x506070], wall: [0x2a3a4a, 0x243444], side: 0x3a4a5a, side2: 0x2a3a4a, sky: 0x060a10, fog: 0x101a28, sun: 0xa8d0ff, amb: 0x4a6a8a },
  fen: { floor: [0x3a4a40, 0x34443a, 0x405046], wall: [0x2a3228, 0x242c22], side: 0x3a4232, side2: 0x2a3228, sky: 0x060a08, fog: 0x101a14, sun: 0xc0e0c0, amb: 0x4a5a4a },
  bronze: { floor: [0x9a7a4a, 0x927244, 0xa28252], wall: [0x6a4a2a, 0x624426], side: 0xb88a3a, side2: 0x9a6e2a, sky: 0x0e0a06, fog: 0x2a1e10, sun: 0xffe0a0, amb: 0x7a6a4a },
};

export function buildMini(id, definition = null) {
  const D = definition || MINI[id];
  const cells = Object.values(D.rooms).map(r => r.cell);
  const GW = Math.max(...cells.map(c => c[0])) + 1, GH = Math.max(...cells.map(c => c[1])) + 1;
  const W = RW * GW, H = RH * GH;
  const g = new Grid(W, H, T.WALL);
  const rooms = [];
  for (const [rid, r] of Object.entries(D.rooms)) {
    const ox = r.cell[0] * RW, oy = r.cell[1] * RH;
    rooms.push({ id: rid, name: r.name, x0: ox, z0: oy, x1: ox + RW, z1: oy + RH, def: r });
    let chestI = 0, bellI = 0;
    for (let j = 0; j < 11; j++) for (let i = 0; i < 15; i++) {
      const c = r.map[j][i];
      const x = ox + 1 + i, y = oy + 1 + j, cx = x + 0.5, cz = y + 0.5;
      let t = hash2(x, y, 91) > 0.8 ? T.MOSS : T.FLOOR;
      const foe = D.foes[c];
      switch (c) {
        case 'g': t = T.MOSS; break;
        case '~': t = T.SHALLOW; break;
        case '=': t = T.LAVA; break;
        case 'P': t = T.PIT; break;
        case 'O': t = T.PILLAR; break;
        case '#': t = T.WALL; break;
        case 'C': g.def({ type: 'crate', x: cx, z: cz, room: rid }); break;
        case 'B': g.def({ type: 'block', x: cx, z: cz, room: rid }); break;
        case 'L': g.def({ type: 'switch', x: cx, z: cz, room: rid, latch: true, group: r.plates }); break;
        case 'T': g.def({ type: 'torch', x: cx, z: cz, room: rid, puzzle: true, group: r.torches }); break;
        case 't': g.def({ type: 'torch', x: cx, z: cz, room: rid }); break;
        case 'w': g.def({ type: 'pinwheel', x: cx, z: cz, signal: r.wind, latch: true }); break;
        case 'v': g.def({ type: 'pinwheel', x: cx, z: cz, signal: r.pair + '.' + (x < ox + 8 ? 'a' : 'b'), latch: false, time: 1.0 }); break;
        case 'h': g.def({ type: 'hangbell', x: cx, z: cz, group: r.bells, pitch: bellI++ }); break;
        case 'x': g.def({ type: 'mdsecret', x: cx, z: cz, room: rid, id: id + ':' + rid, contents: (r.secret || {}).contents || { kind: 'pips', n: 40 }, glass: !!(r.secret || {}).glass }); break;
        case '*': { const ch = (r.chests || [])[chestI++]; if (ch) g.def({ type: 'chest', x: cx, z: cz, room: rid, ...ch }); break; }
        case 'K': g.def({ type: 'lootchest', id: 'md-' + id + '-' + rid, x: cx, z: cz, tier: 2, level: D.level + 1 }); break;
        case 'U': g.def({ type: 'chest', id: 'md-' + id + '-unique', x: cx, z: cz, room: rid, contents: { kind: 'named', id: r.unique, level: D.level }, hidden: id + '.' + rid + '.clear', big: true }); break;
        case 'm': g.def({ type: 'sign', x: cx, z: cz, text: D.mural, mural: true }); break;
        case 'A': break;
        default: if (foe) g.def({ type: 'enemy', kind: foe, x: cx, z: cz, room: rid });
      }
      g.set(x, y, t);
    }
    if (r.plates) g.def({ type: 'switchgroup', group: r.plates, needs: r.needs || 1, signal: r.plates, room: rid });
    if (r.pair) g.def({ type: 'pingroup', a: r.pair + '.a', b: r.pair + '.b', signal: r.pair + '.both' });
    if (r.bells) g.def({ type: 'bellseq', group: r.bells, order: r.order, signal: r.bells });
    if (r.waves) g.def({ type: 'mdarena', room: rid, id: id + '.' + rid, waves: r.waves, title: r.title, goal: r.goal ? id : null });
  }
  const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
  for (const [a, b, kind, extra = {}] of D.links) {
    const [ax, ay] = D.rooms[a].cell, [bx, by] = D.rooms[b].cell;
    if (ax === bx) { const top = Math.min(ay, by), x = ax * RW + 8, z = (top + 1) * RH - 1; g.set(x, z, T.FLOOR); g.set(x, z + 1, T.FLOOR); g.def({ type: 'door', x: x + 0.5, z: z + 1, orient: 'h', kind, rooms: [a, b], ...extra }); }
    else { const left = Math.min(ax, bx), x = (left + 1) * RW - 1, z = ay * RH + 6; g.set(x, z, T.FLOOR); g.set(x + 1, z, T.FLOOR); g.def({ type: 'door', x: x + 1, z: z + 0.5, orient: 'v', kind, rooms: [a, b], ...extra }); }
  }
  // the way out: the bottom middle of the first room
  const first = rooms[0], ex = first.x0 + 8, ez = first.z1 - 1;
  g.set(ex, ez, T.FLOOR);
  g.def({ type: 'warp', x: ex + 0.5, z: ez + 0.7, r: 0.6, to: D.exitArea || 'overworld', spawn: D.exit, label: D.exitLabel || 'Lanternreach' });
  g.def({ type: 'exitglow', x: ex + 0.5, z: ez + 0.5 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const tt = g.get(x, y); g.hv[y * W + x] = tt === T.WALL ? 1.5 + (hash2(x, y, 3) > 0.8 ? 0.25 : 0) : NaN; }
  const P = PAL[D.palette];
  return {
    id, name: D.name, w: W, h: H, tiles: g.t, hv: g.hv, defs: g.defs, rooms, dungeon: true, mini: true, level: D.level,
    spawns: { entrance: { x: first.x0 + 8.5, z: first.z1 - 2.2 } },
    music: D.music, sky: P.sky, fog: P.fog, sun: P.sun, amb: P.amb, dark: D.dark !== false,
    tileInfo: { [T.FLOOR]: { h: 0, top: P.floor }, [T.MOSS]: { h: 0, top: P.floor.map(c => c - 0x080808) }, [T.WALL]: { h: 1.5, top: P.wall, side: P.side, side2: P.side2 } },
  };
}
