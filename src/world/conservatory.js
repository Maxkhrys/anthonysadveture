// THE CRACKED CONSERVATORY — an optional glasshouse dungeon north-west of Thimblewick.
// Nine authored rooms (combat and puzzle roughly half each), a shortcut back to the entrance,
// a breakable secret, and the Seamkeeper's loom. Room size and door wiring match Rootwell
// Hollow so the room camera, room sleeping and resets all work unchanged.
import { T } from './tiles.js';
import { Grid } from './maps.js';
import { hash2, vnoise } from '../engine/util.js';

const RW = 17, RH = 13;
// legend: . floor  # glass wall  O white iron column  P broken floor (pit)  W pond water
// B stone block  C crate  b hanging bell (pitch by order)  G cracked glass  L latch switch
// T puzzle torch  t torch  S bellstone  m mural  * chest  f giant flower (solid)  k loot chest
// n mantis  s candle slug  M lantern moth  p porcelain guard  l bell leech
const ROOMS = {
  atrium: { cell: [1, 2], name: 'The Cracked Conservatory — Glass Atrium', map: [
    '...............',
    '.f...........f.',
    '...O.......O...',
    '.......m.......',
    '..M.........M..',
    '...............',
    '...O...S...O...',
    '.....s.........',
    '.f...........f.',
    '...............',
    '..k............'] },
  fern: { cell: [0, 2], name: 'The Cracked Conservatory — Fern Hall', map: [
    '...............',
    '.f...........f.',
    '...............',
    '...b...b...b...',
    '...............',
    '.......m.......',
    '...............',
    '..f.........f..',
    '...............',
    '.n.............',
    '...............'], bells: { group: 'fern', order: [0, 2, 1], signal: 'c.bells' }, pitches: [1, 0, 2] },
  orchid: { cell: [2, 2], name: 'The Cracked Conservatory — Orchid Gallery', map: [
    '...............',
    '.f....f.f....f.',
    '...............',
    '...O.......O...',
    '...............',
    '.......*.......',
    '...............',
    '...O.......O...',
    '...............',
    '.f...........f.',
    '...............'], chests: [{ id: 'c-orchid', contents: { kind: 'mat', mat: 'porcelain', n: 2 }, hidden: 'c.orchid.clear' }], arena: 'c.orchid' },
  glasswalk: { cell: [2, 1], name: 'The Cracked Conservatory — Shattered Walk', map: [
    '...............',
    '.P.P.......P.P.',
    '...............',
    '..p.........k..',
    '...PPP...PPP...',
    '.......*.......',
    '...PPP...PPP...',
    '..l.........M..',
    '...............',
    '.P.P.......P.P.',
    '...............'], chests: [{ id: 'c-glasswing', contents: { kind: 'named', id: 'glasswing' }, big: true }] },
  potting: { cell: [0, 1], name: 'The Cracked Conservatory — Potting Shed', map: [
    '.........#.....',
    '..C......#..*..',
    '.........G.....',
    '......C..#.....',
    '.........######',
    '...............',
    '..f.........f..',
    '.......m.......',
    '...............',
    '.C.............',
    '...............'], chests: [{ id: 'c-cabinet', contents: { kind: 'recipe', id: 'porcelainguard' }, big: true }] },
  pond: { cell: [1, 1], name: 'The Cracked Conservatory — Lily Pond Court', map: [
    '..WWWW...WWWW..',
    '..WWWW...WWWW..',
    '...............',
    '...............',
    '.......B.......',
    '...............',
    '...............',
    '..W..PPPPP..W..',
    '..W..P.*.P..W..',
    '.s...PPPPP...s.',
    '............L..'], chests: [{ id: 'c-pondkey', contents: { kind: 'key' }, sets: 'c.pondkey' }], switches: 'c.pond', needs: 1, solved: 'c.shortcut', reset: 'c.pondkey' },
  canopy: { cell: [1, 0], name: 'The Cracked Conservatory — Bellfruit Canopy', map: [
    '...............',
    '..T.........T..',
    '...............',
    '.....f...f.....',
    '...............',
    '.......m.......',
    '...............',
    '..T.........T..',
    '...............',
    '...S...........',
    '...............'], torches: 'c.torches' },
  loom: { cell: [0, 0], name: "The Cracked Conservatory — The Seamkeeper's Loom", map: [
    '...............',
    '...............',
    '..O.........O..',
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    '..O.........O..',
    '...............',
    '...............'], boss: 'seamkeeper' },
  reliquary: { cell: [2, 0], name: 'The Cracked Conservatory — Bellwright Reliquary', map: [
    '...............',
    '...............',
    '...O.......O...',
    '...............',
    '....*.....*....',
    '...............',
    '.......m.......',
    '...............',
    '...O.......O...',
    '...............',
    '.......k.......'], chests: [{ id: 'c-relic', contents: { kind: 'named', id: 'porcelainrod' }, big: true }, { id: 'c-score', contents: { kind: 'score' }, big: true }] },
};
const LINKS = [
  ['atrium', 'fern', 'open'],
  ['atrium', 'orchid', 'open'],
  ['atrium', 'pond', 'shutter', { signal: 'c.shortcut' }],
  ['fern', 'potting', 'shutter', { signal: 'c.bells' }],
  ['potting', 'pond', 'open'],
  ['orchid', 'glasswalk', 'open'],
  ['pond', 'canopy', 'locked', { id: 'c-lock-canopy' }],
  ['canopy', 'loom', 'shutter', { signal: 'c.torches' }],
  ['canopy', 'reliquary', 'shutter', { signal: 'c.seamdead' }],
];
const MURALS = {
  atrium: 'A brass plate, green with age:\n"THE CONSERVATORY OF VOICES — where the Bellwrights grew what they could not bear to lose."\nBelow it, scratched by a smaller hand: "The glass cracked when the Hush came in. The Keeper never left."',
  fern: 'Three bells hang in a row. A verse is carved under them:\n"First the deepest, then the brightest — and the middle one last, for the middle always waits."',
  potting: 'A botanist\'s ledger, pinned under glass:\n"Day 40. The Seamkeeper stitched the broken panes again. It will not let anything leave — not the heat, not the sound, not us."',
  canopy: 'Bellfruit hangs from the old frame. A warning is painted on the loom door:\n"Snuff every wick at once and the Keeper wakes. It mends what should stay broken."',
  reliquary: 'A Bellwright\'s score lies open on a lectern: the notes of a toll nobody in Thimblewick has heard in a hundred years.\nElder Tamsin would know what it means.',
};

export function buildConservatory() {
  const W = RW * 3, H = RH * 3;
  const g = new Grid(W, H, T.WALL);
  const rooms = [];
  for (const [id, r] of Object.entries(ROOMS)) {
    const ox = r.cell[0] * RW, oy = r.cell[1] * RH;
    rooms.push({ id, name: r.name, x0: ox, z0: oy, x1: ox + RW, z1: oy + RH, def: r, reset: r.reset });
    let chestI = 0, bellI = 0;
    for (let j = 0; j < 11; j++) for (let i = 0; i < 15; i++) {
      const c = r.map[j][i];
      const x = ox + 1 + i, y = oy + 1 + j, cx = x + 0.5, cz = y + 0.5;
      let t = vnoise(x * 0.3, y * 0.3, 91) > 0.6 ? T.MOSS : T.FLOOR;
      switch (c) {
        case '#': t = T.WALL; break;
        case 'O': t = T.PILLAR; break;
        case 'P': t = T.PIT; break;
        case 'W': t = T.WATER; break;
        case 'f': t = T.PROP; g.def({ type: 'deco', model: 'giantflower', x: cx, z: cz, w: 1, d: 1, hue: hash2(x, y, 3) }); break;
        case 'B': g.def({ type: 'block', x: cx, z: cz, room: id, id: 'cb-' + id + i + j }); break;
        case 'C': g.def({ type: 'crate', x: cx, z: cz, room: id }); break;
        case 'b': g.def({ type: 'hangbell', x: cx, z: cz, group: r.bells.group, pitch: r.pitches[bellI++] }); break;
        case 'G': g.def({ type: 'crackedglass', id: 'c-glass-' + id, x: cx, z: cz }); break;
        case 'L': g.def({ type: 'switch', x: cx, z: cz, room: id, latch: true, group: r.switches }); break;
        case 'T': g.def({ type: 'torch', x: cx, z: cz, room: id, puzzle: true, group: r.torches }); break;
        case 't': g.def({ type: 'torch', x: cx, z: cz, room: id }); break;
        case 'S': g.def({ type: 'bellstone', x: cx, z: cz, room: id, spawn: id === 'atrium' ? 'atrium' : 'canopy', name: id === 'atrium' ? 'Glass Atrium' : 'Bellfruit Canopy' }); break;
        case 'm': g.def({ type: 'sign', x: cx, z: cz, text: MURALS[id], mural: true }); break;
        case '*': { const ch = r.chests[chestI++]; g.def({ type: 'chest', x: cx, z: cz, room: id, ...ch }); break; }
        case 'k': g.def({ type: 'lootchest', id: 'c-lc-' + id, x: cx, z: cz, tier: id === 'reliquary' ? 2 : 1, level: 7 }); break;
        case 'n': g.def({ type: 'enemy', kind: 'mantis', x: cx, z: cz, room: id }); break;
        case 's': g.def({ type: 'enemy', kind: 'slug', x: cx, z: cz, room: id }); break;
        case 'M': g.def({ type: 'enemy', kind: 'moth', x: cx, z: cz, room: id }); break;
        case 'p': g.def({ type: 'enemy', kind: 'porcelain', x: cx, z: cz, room: id }); break;
        case 'l': g.def({ type: 'enemy', kind: 'leech', x: cx, z: cz, room: id }); break;
      }
      g.set(x, y, t);
    }
    if (r.bells) g.def({ type: 'bellseq', group: r.bells.group, order: r.bells.order, signal: r.bells.signal });
    if (r.switches) g.def({ type: 'switchgroup', group: r.switches, needs: r.needs, signal: r.solved, room: id });
    if (r.arena) g.def({ type: 'conservatoryarena', room: id, id: r.arena });
    if (r.boss) g.def({ type: 'seamroom', room: id, x: ox + 8.5, z: oy + 6.5 });
  }
  const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
  for (const [a, b, kind, extra = {}] of LINKS) {
    const [ax, ay] = ROOMS[a].cell, [bx, by] = ROOMS[b].cell;
    if (ax === bx) { const top = Math.min(ay, by), x = ax * RW + 8, z = (top + 1) * RH - 1; g.set(x, z, T.FLOOR); g.set(x, z + 1, T.FLOOR); g.def({ type: 'door', x: x + 0.5, z: z + 1, orient: 'h', kind, rooms: [a, b], ...extra }); }
    else { const left = Math.min(ax, bx), x = (left + 1) * RW - 1, z = ay * RH + 6; g.set(x, z, T.FLOOR); g.set(x + 1, z, T.FLOOR); g.def({ type: 'door', x: x + 1, z: z + 0.5, orient: 'v', kind, rooms: [a, b], ...extra }); }
  }
  // the way out, south of the atrium
  const ex = byId.atrium.x0 + 8, ez = byId.atrium.z1 - 1;
  g.set(ex, ez, T.FLOOR);
  g.def({ type: 'warp', x: ex + 0.5, z: ez + 0.7, r: 0.6, to: 'overworld', spawn: 'conservatory', label: 'Lanternreach' });
  g.def({ type: 'exitglow', x: ex + 0.5, z: ez + 0.5 });
  // walls read as tall glass panes on a green iron frame
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.hv[y * W + x] = g.get(x, y) === T.WALL ? 1.9 + (hash2(x, y, 7) > 0.85 ? 0.35 : 0) : g.get(x, y) === T.PILLAR ? 2.1 : NaN;
  return {
    id: 'conservatory', name: 'The Cracked Conservatory', w: W, h: H, tiles: g.t, hv: g.hv, defs: g.defs, rooms, dungeon: true, glasshouse: true,
    spawns: { entrance: { x: byId.atrium.x0 + 8.5, z: byId.atrium.z1 - 2.2 }, atrium: { x: byId.atrium.x0 + 8.5, z: byId.atrium.z0 + 8.5 }, canopy: { x: byId.canopy.x0 + 4.5, z: byId.canopy.z0 + 9.5 } },
    music: 'cave', sky: 0x1e3430, fog: 0xc8e8d0, sun: 0xfff4d8, amb: 0xa8d0b8,
    // a palette of its own: terracotta tiles, glass-and-verdigris walls, white-painted iron
    tileInfo: {
      [T.FLOOR]: { h: 0, top: [0xc07a52, 0xb06a44, 0xc8845a] },
      [T.MOSS]: { h: 0, top: [0x6a9a4a, 0x5f8f42, 0x74a452] },
      [T.WALL]: { h: 1.9, top: [0x2e4a42, 0x345048], side: 0xbfe6e0, side2: 0x8ec4bc },
      [T.PILLAR]: { h: 2.1, top: [0xecead8], side: 0xe0dcc8, side2: 0xc0bca8 },
    },
    level: 7,
  };
}
export const CONSERVATORY_ROOMS = Object.keys(ROOMS);
