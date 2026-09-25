// Authored world data. The overworld is painted procedurally from hand-placed regions,
// roads and landmarks; dungeon rooms are authored as ASCII.
import { T } from './tiles.js';
import { fbm, hash2, vnoise } from '../engine/util.js';

export { Grid } from './grid.js';
import { Grid } from './grid.js';
export { buildOverworld } from './overworld.js';

// ---------------------------------------------------------------- DUNGEON: Rootwell Hollow
const RW = 17, RH = 13;
const ROOMS = {
  ent: { cell: [1, 3], name: 'Rootwell Hollow — Mouth', map: [
    '...............',
    '.t...........t.',
    '...............',
    '....O.....O....',
    '..1.........1..',
    '...............',
    '...m.......S...',
    '....O.....O....',
    '........1......',
    '.t...........t.',
    '...............'] },
  hub: { cell: [1, 2], name: 'Rootwell Hollow — Heartwood', map: [
    'g.............g',
    '..t.........t..',
    '...............',
    '......rgr......',
    '....g.OOO.g....',
    '......OOO......',
    '....g.OOO.g....',
    '......rgr......',
    '...............',
    '..t.m.......t..',
    'g.............g'] },
  west: { cell: [0, 2], name: 'Rootwell Hollow — Stone Garden', map: [
    '...............',
    '.O....*......O.',
    '...............',
    '...B...........',
    '..........L....',
    '......PPP......',
    '......PPP.2....',
    '..2B......L....',
    '...............',
    '.O...........O.',
    '...............'], chests: [{ id: 'd-key1', contents: { kind: 'key' }, hidden: 'west.solved' }],
    switches: 'west', needs: 2, solved: 'west.solved', reset: true },
  east: { cell: [2, 2], name: 'Rootwell Hollow — Thornhall', map: [
    '...............',
    '..........w....',
    '..t.........t..',
    '...............',
    '...O.......O...',
    '.......*.......',
    '...O.......O...',
    '...............',
    '..t.........t..',
    'd.............d',
    '...............'], chests: [{ id: 'd-bellows', contents: { kind: 'item', item: 'bellows' }, hidden: 'east.clear', big: true }],
    pinwheel: 'east.wind', arena: 'east' },
  crate: { cell: [2, 1], name: 'Rootwell Hollow — Sinkwell', map: [
    '...............',
    '....*.....D....',
    '...............',
    '...............',
    'PPPPPPPPPPPPPPP',
    'PPPPPPPPPPPPPPP',
    '...............',
    '...............',
    '...O......C....',
    '....C..........',
    '...............'], chests: [{ id: 'd-key2', contents: { kind: 'key' } }], switches: 'crate', needs: 1, solved: 'crate.solved', reset: true },
  torch: { cell: [2, 0], name: 'Rootwell Hollow — Candle Roots', map: [
    '...............',
    '...............',
    '..T.........T..',
    '...............',
    '......4...4....',
    '.......*.......',
    '...............',
    '..T.........T..',
    '...............',
    '...............',
    '...............'], chests: [{ id: 'd-bigkey', contents: { kind: 'bigkey' }, hidden: 'torch.solved', big: true }], torches: 'torch.solved' },
  pre: { cell: [1, 1], name: 'Rootwell Hollow — Root Gate', map: [
    '...............',
    '..t.........t..',
    '...............',
    '....2.....2....',
    '...............',
    '...O...5...O...',
    '...............',
    '...............',
    '..t.m.....S.t..',
    '...............',
    '...............'] },
  heart: { cell: [0, 1], name: 'Rootwell Hollow — Moat of Whispers', map: [
    '...............',
    '...............',
    '..PPPPPPPPPPP..',
    '..P.........P..',
    '..P..C...LO.P..',
    '..P.........P..',
    '..PPPPPPPPPPP..',
    '...............',
    '.......*.......',
    '...4.......4...',
    '...............'], chests: [{ id: 'd-heart', contents: { kind: 'heart' }, hidden: 'heart.solved' }], switches: 'heart', needs: 1, solved: 'heart.solved', reset: true },
  boss: { cell: [1, 0], name: 'Rootwell Hollow — The Choking Root', map: [
    '...............',
    '...............',
    '..r.........r..',
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    '..r.........r..',
    '...............',
    '...............'], boss: true },
};
// connections: [roomA, roomB, doorType, extra]
const LINKS = [
  ['ent', 'hub', 'open'],
  ['hub', 'west', 'open'],
  ['hub', 'east', 'locked', { id: 'd-lock-east' }],
  ['hub', 'pre', 'fire', { id: 'd-fire-hub' }],
  ['east', 'crate', 'shutter', { signal: 'east.wind' }],
  ['crate', 'torch', 'shutter', { signal: 'crate.solved' }],
  ['pre', 'heart', 'locked', { id: 'd-lock-heart' }],
  ['pre', 'boss', 'boss', { id: 'd-boss-door' }],
];
const MURALS = {
  ent: 'A mural of tiny folk hauling a great bell up a mountain.\nBeneath it: "THE DAWNBELL WAKES THE WORLD. ITS THREE VOICES KEEP THE HUSH ASLEEP."',
  hub: 'A mural: three glowing chimes carried away in three directions — into roots, into fire, into water.\nOne figure stays behind, hands over its ears.',
  pre: 'A carved warning:\n"The Root that Chokes guards the Verdant Voice. It swallows every breath. Give it one it cannot keep."',
};

export function buildDungeon() {
  const W = RW * 3, H = RH * 4;
  const g = new Grid(W, H, T.WALL);
  const rooms = [];
  for (const [id, r] of Object.entries(ROOMS)) {
    const ox = r.cell[0] * RW, oy = r.cell[1] * RH;
    const room = { id, name: r.name, x0: ox, z0: oy, x1: ox + RW, z1: oy + RH, def: r };
    rooms.push(room);
    let chestI = 0;
    const L = [];
    for (let j = 0; j < 11; j++) for (let i = 0; i < 15; i++) {
      const c = r.map[j][i];
      const x = ox + 1 + i, y = oy + 1 + j, cx = x + 0.5, cz = y + 0.5;
      let t = T.FLOOR;
      if ((vnoise(x * 0.3, y * 0.3, 77) > 0.62)) t = T.MOSS;
      switch (c) {
        case 'g': t = T.MOSS; break;
        case 'O': t = T.PILLAR; break;
        case 'P': t = T.PIT; break;
        case 'B': g.def({ type: 'block', x: cx, z: cz, room: id }); break;
        case 'C': g.def({ type: 'crate', x: cx, z: cz, room: id }); break;
        case 'L': case 'o': L.push(g.def({ type: 'switch', x: cx, z: cz, room: id, latch: c === 'L', group: r.switches })); break;
        case 'D': L.push(g.def({ type: 'switch', x: cx, z: cz, room: id, latch: true, group: r.switches })); g.def({ type: 'leafpile', x: cx, z: cz, dust: true }); break;
        case 'd': g.def({ type: 'leafpile', x: cx, z: cz, dust: true, reveal: 'pips5' }); break;
        case 'T': g.def({ type: 'torch', x: cx, z: cz, room: id, puzzle: true, group: r.torches }); break;
        case 't': g.def({ type: 'torch', x: cx, z: cz, room: id }); break;
        case 'w': g.def({ type: 'pinwheel', x: cx, z: cz, signal: r.pinwheel, latch: true }); break;
        case 'm': g.def({ type: 'sign', x: cx, z: cz, text: MURALS[id], mural: true }); break;
        case 'S': g.def({ type: 'bellstone', x: cx, z: cz, room: id, spawn: id === 'ent' ? 'entrance' : 'pre', name: id === 'ent' ? 'Hollow Mouth' : 'Root Gate' }); break;
        case 'r': g.def({ type: 'roots', x: cx, z: cz }); t = T.MOSS; break;
        case '*': { const ch = r.chests[chestI++]; g.def({ type: 'chest', x: cx, z: cz, room: id, ...ch }); break; }
        case '1': g.def({ type: 'enemy', kind: 'blot', x: cx, z: cz, room: id }); break;
        case '2': g.def({ type: 'enemy', kind: 'beetle', x: cx, z: cz, room: id }); break;
        case '3': g.def({ type: 'enemy', kind: 'puffer', x: cx, z: cz, room: id }); break;
        case '4': g.def({ type: 'enemy', kind: 'wisp', x: cx, z: cz, room: id }); break;
        case '5': g.def({ type: 'enemy', kind: 'knight', x: cx, z: cz, room: id }); break;
      }
      g.set(x, y, t);
    }
    if (r.switches) g.def({ type: 'switchgroup', group: r.switches, needs: r.needs, signal: r.solved, room: id });
    if (r.arena) g.def({ type: 'arena', room: id, id: r.arena });
    if (r.boss) g.def({ type: 'bossroom', room: id, x: ox + 8.5, z: oy + 4.5 });
    if (r.reset) room.reset = r.solved;
  }
  const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
  for (const [a, b, kind, extra = {}] of LINKS) {
    const A = byId[a], B = byId[b];
    const [ax, ay] = ROOMS[a].cell, [bx, by] = ROOMS[b].cell;
    let x, z, orient;
    if (ax === bx) { // vertical neighbours: door in horizontal wall
      const top = Math.min(ay, by);
      x = ax * RW + 8; z = (top + 1) * RH - 1; orient = 'h';
      g.set(x, z, T.FLOOR); g.set(x, z + 1, T.FLOOR);
      g.def({ type: 'door', x: x + 0.5, z: z + 1, orient, kind, rooms: [a, b], ...extra });
    } else {
      const left = Math.min(ax, bx);
      x = (left + 1) * RW - 1; z = ay * RH + 6; orient = 'v';
      g.set(x, z, T.FLOOR); g.set(x + 1, z, T.FLOOR);
      g.def({ type: 'door', x: x + 1, z: z + 0.5, orient, kind, rooms: [a, b], ...extra });
    }
  }
  // exit to overworld
  const ex = byId.ent.x0 + 8, ez = byId.ent.z1 - 1;
  g.set(ex, ez, T.FLOOR);
  g.def({ type: 'warp', x: ex + 0.5, z: ez + 0.7, r: 0.6, to: 'overworld', spawn: 'dungeon', label: 'Whisperwood' });
  g.def({ type: 'exitglow', x: ex + 0.5, z: ez + 0.5 });
  g.def({ type: 'lootchest', id: 'dg-lc1', x: byId.ent.x0 + 14.5, z: byId.ent.z0 + 1.5, tier: 0, level: 4 });
  g.def({ type: 'lootchest', id: 'dg-lc2', x: byId.west.x0 + 1.5, z: byId.west.z0 + 11.5, tier: 1, level: 4 });
  g.def({ type: 'lootchest', id: 'dg-lc3', x: byId.torch.x0 + 14.5, z: byId.torch.z0 + 10.5, tier: 1, level: 5 });
  g.def({ type: 'lootchest', id: 'dg-lc4', x: byId.heart.x0 + 1.5, z: byId.heart.z0 + 11.5, tier: 2, level: 5 });
  g.def({ type: 'sign', x: byId.hub.x0 + 11.5, z: byId.hub.z0 + 11.5, text: 'Scratched into the floor:\n"Stuck? Step out of a room and back in. The Hollow remembers its shape."' });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = g.get(x, y);
    g.hv[y * W + x] = t === T.WALL ? 1.5 + (hash2(x, y, 3) > 0.8 ? 0.25 : 0) : NaN;
  }
  return {
    id: 'dungeon', name: 'Rootwell Hollow', w: W, h: H, tiles: g.t, hv: g.hv, defs: g.defs, rooms, dungeon: true,
    spawns: { entrance: { x: byId.ent.x0 + 8.5, z: byId.ent.z1 - 2.2 }, pre: { x: byId.pre.x0 + 8.5, z: byId.pre.z1 - 2.5 } },
    music: 'dungeon', sky: 0x0c0a10, fog: 0x1a1224, sun: 0xffe8c8, amb: 0x5a4a7a, dark: true,
  };
}

// ---------------------------------------------------------------- GROTTO
export function buildGrotto() {
  const map = [
    '#####..........#####',
    '########....########',
    '######....*...######',
    '####............####',
    '###w....####....w###',
    '###.....####.....###',
    '###..........4...###',
    '###..4...........###',
    '####............####',
    '#####..........#####',
    '#########..#########',
    '#########..#########',
  ];
  const W = 20, H = map.length;
  const g = new Grid(W, H, T.ROCK);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = map[y][x], cx = x + 0.5, cz = y + 0.5;
    let t = c === '#' ? T.ROCK : T.CAVE;
    if (c === 'w') g.def({ type: 'pinwheel', x: cx, z: cz, signal: c + x, latch: false, time: 5 });
    if (c === '*') g.def({ type: 'chest', id: 'grotto-chest', x: cx, z: cz, contents: { kind: 'pips', n: 100 }, hidden: 'grotto.both', big: true });
    if (c === '4') g.def({ type: 'enemy', kind: 'wisp', x: cx, z: cz });
    g.set(x, y, t);
  }
  g.def({ type: 'pingroup', a: 'w3', b: 'w16', signal: 'grotto.both' });
  g.def({ type: 'lootchest', id: 'gr-lc1', x: 4.5, z: 7.5, tier: 1, level: 5 });
  g.def({ type: 'lootchest', id: 'gr-lc2', x: 15.5, z: 7.5, tier: 1, level: 5 });
  g.def({ type: 'sign', x: 9.5, z: 8.2, text: 'Two pinwheels, far apart. Faint letters: "Together, the winds remember."' });
  g.def({ type: 'warp', x: 9.9, z: 11.7, r: 0.7, to: 'overworld', spawn: 'grotto', label: 'Whisperwood' });
  g.def({ type: 'exitglow', x: 9.9, z: 11.5 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.hv[y * W + x] = g.get(x, y) === T.ROCK ? 1.6 + hash2(x, y, 5) * 0.8 : NaN;
  return { id: 'grotto', name: 'Hollow Grotto', w: W, h: H, tiles: g.t, hv: g.hv, defs: g.defs, dungeon: true,
    spawns: { entrance: { x: 9.9, z: 10.4 } }, music: 'cave', sky: 0x0c0a14, fog: 0x141020, sun: 0x9090d0, amb: 0x4a4a6a, dark: true,
    rooms: [{ id: 'grotto', name: 'Hollow Grotto', x0: 0, z0: 0, x1: W, z1: H }] };
}

// ---------------------------------------------------------------- HUSH RIFT (procedural, replayable)
const RIFT_POOL = [
  ['blot', 1], ['sporeling', 1], ['beetle', 1], ['puffer', 1], ['wisp', 2], ['brigand', 2], ['imp', 3], ['wraith', 3], ['scorpion', 3], ['knight', 4], ['treant', 6], ['golem', 7],
];
export function buildRift(floor = 1, level = 3, seed = Date.now()) {
  let s = seed >>> 0 || 7;
  const R = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  const pick = a => a[Math.floor(R() * a.length)];
  const GW = 5, GH = 5;
  // random walk of rooms from bottom-middle
  const nRooms = Math.min(8, 4 + Math.floor(floor / 2) + Math.floor(R() * 2));
  const cells = [[2, 4]];
  const used = new Set(['2,4']);
  while (cells.length < nRooms) {
    const [cx, cy] = cells[cells.length - 1];
    const opts = [[0, -1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < GW && y < GH && !used.has(x + ',' + y));
    if (!opts.length) break;
    const n = pick(opts); cells.push(n); used.add(n[0] + ',' + n[1]);
  }
  const W = RW * GW, H = RH * GH;
  const g = new Grid(W, H, T.ROCK);
  const rooms = [];
  const pool = RIFT_POOL.filter(([, f]) => f <= floor + 1).map(([k]) => k);
  cells.forEach(([cx, cy], idx) => {
    const ox = cx * RW, oy = cy * RH, id = 'r' + idx;
    const last = idx === cells.length - 1, first = idx === 0;
    rooms.push({ id, name: last ? `Hush Rift — Floor ${floor} · Champion` : `Hush Rift — Floor ${floor}`, x0: ox, z0: oy, x1: ox + RW, z1: oy + RH, def: {} });
    for (let j = 0; j < 11; j++) for (let i = 0; i < 15; i++) g.set(ox + 1 + i, oy + 1 + j, T.CAVE);
    // obstacles (keep the cross through the middle clear so doors connect)
    if (!first) {
      const style = Math.floor(R() * 4);
      const put = (i, j, t) => { if (i === 7 || j === 5 || i < 0 || j < 0 || i > 14 || j > 10) return; g.set(ox + 1 + i, oy + 1 + j, t); };
      if (style === 0) for (const [i, j] of [[3, 2], [11, 2], [3, 8], [11, 8]]) { put(i, j, T.PILLAR); put(i + 1, j, T.PILLAR); }
      if (style === 1) for (let i = 2; i < 13; i++) if (i < 6 || i > 8) { put(i, 3, T.PIT); put(i, 7, T.PIT); }
      if (style === 2) for (let k = 0; k < 7; k++) put(1 + Math.floor(R() * 13), 1 + Math.floor(R() * 9), T.PILLAR);
      if (style === 3) { for (let i = 4; i < 11; i++) { put(i, 2, T.PIT); put(i, 8, T.PIT); } put(2, 5, T.PILLAR); put(12, 5, T.PILLAR); }
    }
    for (let k = 0; k < 4; k++) g.def({ type: 'torch', x: ox + [2.5, 14.5, 2.5, 14.5][k], z: oy + [2.5, 2.5, 10.5, 10.5][k] });
    if (first) {
      g.def({ type: 'sign', x: ox + 5.5, z: oy + 9.5, text: `HUSH RIFT — FLOOR ${floor}\nMonsters here are level ${level}. Each floor ends with a Champion and a way deeper… or home.` });
      return;
    }
    // waves
    const nw = last ? 1 : 1 + (R() < 0.35 + floor * 0.05 ? 1 : 0);
    const waves = [];
    for (let w = 0; w < nw; w++) {
      const n = 4 + Math.floor(R() * 3) + Math.floor(floor / 3);
      const wave = [];
      for (let k = 0; k < n; k++) wave.push([pick(pool), (R() - 0.5) * 10, (R() - 0.5) * 6]);
      waves.push(wave);
    }
    if (last) waves.push([[pick(['knight', 'treant', 'golem', 'brigand']), 0, -2, 'champion'], [pick(pool), -3, 1], [pick(pool), 3, 1]]);
    g.def({ type: 'riftarena', room: id, id: 'rift' + seed + '-' + idx, waves, last, x: ox + 8.5, z: oy + 6.5 });
    if (!last && R() < 0.35) g.def({ type: 'lootchest', id: 'rift-' + seed + '-' + idx, x: ox + (R() < 0.5 ? 2.5 : 14.5), z: oy + 6.5, tier: R() < 0.2 + floor * 0.04 ? 2 : 1, level, rift: true });
  });
  // connect consecutive rooms with open doorways
  for (let i = 0; i < cells.length - 1; i++) {
    const [ax, ay] = cells[i], [bx, by] = cells[i + 1];
    if (ax === bx) { const top = Math.min(ay, by), x = ax * RW + 8, z = (top + 1) * RH - 1; g.set(x, z, T.CAVE); g.set(x, z + 1, T.CAVE); g.def({ type: 'door', x: x + 0.5, z: z + 1, orient: 'h', kind: 'open', rooms: ['r' + i, 'r' + (i + 1)] }); }
    else { const left = Math.min(ax, bx), x = (left + 1) * RW - 1, z = ay * RH + 6; g.set(x, z, T.CAVE); g.set(x + 1, z, T.CAVE); g.def({ type: 'door', x: x + 1, z: z + 0.5, orient: 'v', kind: 'open', rooms: ['r' + i, 'r' + (i + 1)] }); }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.hv[y * W + x] = g.get(x, y) === T.ROCK ? 1.5 + (hash2(x, y, 5) > 0.8 ? 0.3 : 0) : NaN;
  const [sx, sy] = cells[0];
  return { id: 'rift', name: `Hush Rift · Floor ${floor}`, w: W, h: H, tiles: g.t, hv: g.hv, defs: g.defs, rooms, dungeon: true, rift: true, floor, level,
    spawns: { entrance: { x: sx * RW + 8.5, z: sy * RH + 7.5 } }, music: floor % 2 ? 'dungeon' : 'cave', sky: 0x0a0612, fog: 0x1a1030, sun: 0xc8a8ff, amb: 0x5a3a8a, dark: true };
}
