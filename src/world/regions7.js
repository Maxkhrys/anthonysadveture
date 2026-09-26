// World pass: two connected regional areas, authored like the overworld (tile painting plus
// hand-placed landmarks) and loaded through the normal area system.
//
//   THE CLOCKWORK GARDEN (L5-7)  a clipped hedge garden grown around a giant abandoned clock.
//     Enter by the Clockwork Gate (Heartland, east of the Mirrowrun). Three winding levers wind
//     the Great Clock; a gear-house outpost, a topiary maze and a bronze belfry frame.
//   THE ROOTLIGHT CAVERNS (L8-10)  a descent beneath the Deepwood's roots, lit by fungus and
//     crystal. Enter by the Rootlight Mouth (Deepwood). Wake three lumen blooms to relight the
//     old route; the Root Lift carries you up into Thimblewick's Hedge Garden.
//
// Both return the same interface as the overworld (biome, regionIdx, places, placeAt, landmarks,
// vistas) so discovery, the atlas, scenery and encounter levels work unchanged. `outdoor` asks
// the runtime for sky, weather and day/night; `underground` for cave light.
import { T } from './tiles.js';
import { hash2, vnoise } from '../engine/util.js';
import { Grid } from './grid.js';
import { BIOME } from './layout.js';

// ---------------------------------------------------------------- shared toolkit
function kit(W, H, fill) {
  const g = new Grid(W, H, fill);
  g.hv.fill(NaN);
  const elev = new Float32Array(W * H);
  const ridx = new Uint8Array(W * H);
  const landmarks = [], vistas = [];
  const K = {
    g, elev, ridx, landmarks, vistas,
    set: (x, y, t) => g.set(x, y, t),
    rect(x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.set(x, y, t); },
    fill(x0, y0, x1, y1, fn) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g.in(x, y)) fn(x, y); },
    ellipse(cx, cy, rx, ry, t, test) { g.ellipse(cx, cy, rx, ry, t, test); },
    blob(cx, cy, rx, ry, fn, amp = 0.3, seed = 3) {
      for (let y = Math.floor(cy - ry * 1.4); y <= cy + ry * 1.4; y++) for (let x = Math.floor(cx - rx * 1.4); x <= cx + rx * 1.4; x++) {
        if (!g.in(x, y)) continue;
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d <= 1 + (vnoise(x * 0.2, y * 0.2, seed) - 0.5) * amp * 2) fn(x, y, d);
      }
    },
    E(x, y, h) { if (g.in(x, y)) elev[y * W + x] = h; },
    lift(x0, y0, x1, y1, h) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g.in(x, y)) elev[y * W + x] = h; },
    place(x0, y0, x1, y1, pi) { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) ridx[y * W + x] = pi; },
    path(pts, t = T.PATH, w = 0) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
        for (let k = 0; k <= n; k++) {
          const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
          for (let oy = -w; oy <= w; oy++) for (let ox = -w; ox <= w; ox++) {
            if (ox * ox + oy * oy > w * w + 0.5) continue;
            const tx = Math.round(x + ox), ty = Math.round(y + oy), cur = g.get(tx, ty);
            if (cur === T.WATER || cur === T.DEEP) g.set(tx, ty, T.BRIDGE);
            else if (cur === T.PIT) g.set(tx, ty, T.BRIDGE);
            else if (cur !== T.PROP && cur !== T.BRIDGE && cur !== T.STAIRS) g.set(tx, ty, t);
          }
        }
      }
    },
    // steps from (x,y) along (dx,dy), `len` tiles, from h0 to h1 (width across)
    stairs(x, y, dx, dy, len, h0, h1, width = 2) {
      for (let i = 0; i < len; i++) for (let k = 0; k < width; k++) {
        const tx = x + dx * i + (dy ? k : 0), ty = y + dy * i + (dx ? k : 0);
        g.set(tx, ty, T.STAIRS); if (g.in(tx, ty)) elev[ty * W + tx] = h0 + (h1 - h0) * (i + 1) / (len + 1);
      }
    },
    deco: (model, x, y, w, d, extra) => g.deco(model, x, y, w, d, extra),
    def: d => g.def(d),
    sign: (x, z, text) => g.def({ type: 'sign', x, z, text }),
    landmark(id, name, model, x, z, w, d, extra = {}) {
      landmarks.push({ id, name, x, z, region: extra.region, hidden: !!extra.hidden, major: !!extra.major });
      if (model) g.def({ type: 'landmark', model, x, z, w, d, lid: id, ...extra });
    },
    vista(id, x, z, zoom, name) { vistas.push({ id, x, z, zoom, name }); g.def({ type: 'vista', id, x, z, r: 2.2, zoom, name }); },
    enemy: (kind, x, z, extra = {}) => g.def({ type: 'enemy', kind, x: x + 0.5, z: z + 0.5, ...extra }),
  };
  return K;
}
// heights: walls/pillars/rock rise from their base; raised walkable tiles take their elevation
function heights(K, W, H, tall) {
  const { g, elev } = K;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = g.t[i], e = elev[i];
    let h = null;
    if (t in tall) h = e + tall[t] + (tall.jitter && tall.jitter.has(t) ? Math.floor(vnoise(x * 0.3, y * 0.3, 9) * 3) * 0.35 : 0);
    else if (t === T.PIT || t === T.WATER || t === T.DEEP || t === T.LAVA) h = null;
    else if (e > 0) h = e;
    g.hv[i] = h === null ? NaN : h;
  }
}
function finish(K, W, H, meta, placesDef) {
  const places = placesDef.map(([key, name, id, level, extra]) => ({ key, name, id, level, music: meta.music, ...(extra || {}) }));
  const biome = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) biome[i] = BIOME[places[K.ridx[i]].id];
  const area = { ...meta, w: W, h: H, tiles: K.g.t, hv: K.g.hv, defs: K.g.defs, dungeon: false, biome, regionIdx: K.ridx, places, landmarks: K.landmarks, vistas: K.vistas, elevated: true,
    regions: places.map(p => ({ ...p, x0: 0, y0: 0, x1: 0, y1: 0 })) };
  area.placeAt = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z); if (xi < 0 || zi < 0 || xi >= W || zi >= H) return places[0]; return places[K.ridx[zi * W + xi]]; };
  area.biomeAt = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z); if (xi < 0 || zi < 0 || xi >= W || zi >= H) return 0; return biome[zi * W + xi]; };
  return area;
}

// ================================================================ THE CLOCKWORK GARDEN
// 88 x 70. Hedges are T.WALL (painted green here), bronze is T.PILLAR, rusty paving is T.FLOOR.
// North: the Great Clock Court and the Clock Face. West: the Rusted Wheelworks. East: the Bronze
// Belfry Frame. South-west: the Topiary Maze. South: the Gatehouse Lawn (entrance) and the
// narrow Hedge Gallery up to the court. South-east: the Gearhouse outpost.
const MAZE = [ // 29 x 16, x0=3 y0=51. '#' hedge, '.' lawn, 'L' lever, 's' latched plate under
  '#############################',   // leaves, 'D' alcove door, '*' alcove chest, 'e' entrance gap
  '#.......#.........#.........#',
  '#.#####.#.#######.#.#######.#',
  '#.#...#...#.....#...#.....#.#',
  '#.#.#.#####.###.#####.###.#.#',
  '#...#.......#L#.......#.#...#',
  '###.#########.#########.#.###',
  '#...#.......#...#.......#...e',
  '#.###.#####.#####.#####.###.#',
  '#.#...#...#.......#...#...#.#',
  '#.#.###.#.#########.#.###.#.#',
  '#.#.....#...........#.....#.#',
  '#.#######.#########.#######.#',
  '#s#.....D*#.......#.........#',
  '#...#####.#.#####...#######.#',
  '#############################',
];
export function buildClockwork() {
  const W = 88, H = 70, K = kit(W, H, T.GRASS), g = K.g;
  const P = { garden: 0, court: 1, wheel: 2, belfry: 3, maze: 4, gearhouse: 5, lawn: 6 };
  // lawn speckled with clover and flowers
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hash2(x, y, 7) > 0.8) g.set(x, y, T.FLOWERS);
  // the outer hedge (two thick), and the dividing hedges
  const hedge = (x0, y0, x1, y1) => K.rect(x0, y0, x1, y1, T.WALL);
  hedge(0, 0, W - 1, 1); hedge(0, H - 2, W - 1, H - 1); hedge(0, 0, 1, H - 1); hedge(W - 2, 0, W - 1, H - 1);
  hedge(15, 2, 16, 40); hedge(71, 2, 72, 44);              // court | wheelworks, court | belfry
  hedge(2, 49, 32, 50);                                     // wheelworks | maze
  hedge(15, 40, 72, 40);                                    // court | south
  hedge(17, 41, 41, 50);                                    // the solid hedge mass south-west of the gallery
  hedge(33, 51, 33, 67); hedge(55, 45, 56, 67);             // lawn walls
  hedge(33, 56, 42, 56); hedge(46, 56, 55, 56);             // lawn north wall (gallery gap 43-45)
  hedge(42, 41, 42, 55); hedge(46, 41, 46, 55);             // the Hedge Gallery walls
  hedge(47, 41, 47, 55); hedge(51, 41, 51, 55);             // the Mainspring route walls (48-50)
  hedge(52, 41, 64, 44); hedge(68, 41, 72, 44);             // behind the court, the wicket lane 65-67
  hedge(57, 45, 64, 47); hedge(68, 45, 78, 47);
  // openings
  K.rect(16, 20, 16, 24, T.PATH); K.rect(15, 20, 15, 24, T.PATH);   // court -> wheelworks
  K.rect(71, 18, 72, 22, T.PATH);                                    // court -> belfry
  K.rect(6, 49, 8, 50, T.PATH);                                      // wheelworks -> maze
  K.rect(43, 40, 45, 40, T.PATH); K.rect(43, 56, 45, 56, T.PATH);    // the gallery's two mouths
  K.rect(48, 41, 50, 55, T.PATH); K.set(48, 41, T.WALL); K.set(50, 41, T.WALL); K.set(49, 40, T.PATH); K.rect(48, 56, 50, 56, T.PATH);
  K.rect(65, 40, 67, 47, T.PATH); K.set(65, 40, T.WALL); K.set(67, 40, T.WALL);
  K.rect(79, 44, 82, 48, T.PATH);                                     // belfry -> gearhouse (a loop)
  K.rect(55, 60, 56, 62, T.PATH);                                    // lawn -> gearhouse
  K.rect(33, 58, 33, 59, T.PATH);                                    // lawn -> maze (the 'e' gap row)
  // --- places
  K.place(0, 0, W - 1, H - 1, P.garden);
  K.place(17, 2, 70, 39, P.court); K.place(2, 2, 14, 48, P.wheel); K.place(73, 2, 85, 43, P.belfry);
  K.place(2, 51, 32, 67, P.maze); K.place(57, 48, 85, 67, P.gearhouse); K.place(34, 57, 54, 67, P.lawn); K.place(42, 41, 51, 56, P.lawn);

  // ---------------- the Gatehouse Lawn (entrance)
  K.fill(34, 57, 54, 67, (x, y) => { if (g.get(x, y) !== T.WALL) g.set(x, y, hash2(x, y, 3) > 0.85 ? T.FLOWERS : T.GRASS); });
  K.path([[44, 67], [44, 57]], T.PATH, 1);
  K.path([[46, 60], [55, 61]], T.PATH, 0);
  K.path([[40, 60], [34, 58.5]], T.PATH, 0);
  K.def({ type: 'warp', x: 44.5, z: 67.6, r: 0.8, to: 'overworld', spawn: 'clockgate', label: 'Lanternreach' });
  K.def({ type: 'exitglow', x: 44.5, z: 67.3 });
  K.sign(41.5, 64.5, 'THE CLOCKWORK GARDEN\nThe big folk planted it, and wound it, and walked away.\nThe hedges kept growing. The clock stopped.');
  K.deco('hedge', 37, 60, 3, 1); K.deco('hedge', 49, 60, 3, 1);
  K.deco('planter', 36, 64, 2, 1); K.deco('planter', 51, 64, 2, 1);
  K.landmark('cg-lawn', 'The Gatehouse Lawn', null, 44.5, 62);
  // the Mainspring Gate: seen from the lawn, closed until the clock is wound
  K.def({ type: 'door', id: 'cg-mainspring', x: 49.5, z: 40.5, orient: 'h', kind: 'stone', signal: 'w7:cg.wound', single: true });
  K.sign(52.2, 54.5, 'THE MAINSPRING GATE\nA short way up to the clock court.\nSealed by the clock itself: it opens when the Great Clock strikes again.');

  // ---------------- the Hedge Gallery: a narrow approach that opens onto the clock
  K.path([[44, 56], [44, 40]], T.PATH, 1);
  for (let y = 43; y <= 53; y += 5) { K.def({ type: 'landmark', model: 'topiary', x: 42.5, z: y + 0.5, w: 1, d: 1, y: 1.3, shape: (y / 5) % 3 }); K.def({ type: 'landmark', model: 'topiary', x: 46.5, z: y + 2.5, w: 1, d: 1, y: 1.3, shape: (y / 5 + 1) % 3 }); }
  K.vista('cg-vista', 44.5, 37.5, 1.7, 'The Great Clock');

  // ---------------- the Great Clock Court
  K.fill(17, 2, 70, 39, (x, y) => { if (g.get(x, y) === T.GRASS && vnoise(x * 0.2, y * 0.2, 12) > 0.7) g.set(x, y, T.FLOWERS); });
  K.path([[44, 39], [44, 29]], T.STONE, 1);
  K.ellipse(44, 20, 24, 15, T.PATH, (t, x, y, d) => d > 0.8 && d < 1 && t !== T.WALL);
  K.path([[27, 22], [16, 22]], T.PATH, 1); K.path([[61, 20], [72, 20]], T.PATH, 1); K.path([[61, 25], [66, 30], [66, 39]], T.PATH, 0);
  // the Clock Face stands against the north hedge, taller than anything in the garden
  K.rect(35, 23, 53, 27, T.PROP); K.rect(34, 23, 34, 28, T.PILLAR); K.rect(54, 23, 54, 28, T.PILLAR);
  K.landmark('cg-clockface', 'The Great Clock Face', 'clockface', 44, 25.5, 18, 5, { major: true });
  K.def({ type: 'clockhands', x: 44, z: 25.7, y: 6.2 });
  // the fallen minute hand lies across the lawn: cover in a fight, a landmark from the gallery
  for (let i = 0; i <= 11; i++) { const x = Math.round(26 + i * 0.95), y = Math.round(13 - i * 0.45); g.set(x, y, T.PROP); }
  K.landmark('cg-fallenhand', 'The Fallen Hand', 'fallenhand', 31.5, 10.6, 12, 1.2, { ry: 0.44 });
  // flowerbeds and topiary around the court
  for (const [x, y] of [[24, 12], [60, 12], [24, 33], [62, 33]]) { K.deco('herbbed', x, y, 2, 1); }
  for (const [x, y, s] of [[20, 6, 0], [67, 6, 1], [20, 37, 2], [68, 37, 0], [36, 18, 1], [52, 18, 2]]) { K.deco('hedge', x, y, 1, 1); K.def({ type: 'landmark', model: 'topiary', x: x + 0.5, z: y + 0.5, w: 1, d: 1, y: 0.9, shape: s }); }
  // the wicket: a gate from the court down to the Gearhouse, unlatched from this side only
  K.def({ type: 'door', id: 'cg-wicket', x: 66.5, z: 40.5, orient: 'h', kind: 'stone', signal: 'w7:cg.wicket', single: true });
  K.def({ type: 'wicket7', x: 66.5, z: 38.6, signal: 'w7:cg.wicket', label: 'Lift the wicket latch' });
  // the pocket garden: a lost corner inside the hedge mass, behind a grown-over gap
  K.rect(21, 43, 27, 48, T.GRASS); K.rect(24, 41, 24, 42, T.GRASS); K.set(24, 40, T.GRASS);
  K.def({ type: 'tangle', x: 24.5, z: 40.5 });
  K.def({ type: 'chest', id: 'cg-pocket', x: 24.5, z: 46.5, contents: { kind: 'mat', mat: 'moth', n: 3 } });
  K.deco('gazebo', 21, 43, 3, 3, { roof: 0xc07a9a });
  K.landmark('cg-pocket', 'The Lost Pocket Garden', null, 24.5, 45, 0, 0, { hidden: true });
  // encounters in the court: porcelain sentries by the clock, moths over the beds
  K.enemy('porcelain', 38, 31); K.enemy('porcelain', 50, 31); K.enemy('moth', 26, 16); K.enemy('moth', 62, 12); K.enemy('mantis', 30, 34); K.enemy('beetle', 58, 32);
  K.def({ type: 'lootchest', id: 'cg-lc-court', x: 20.5, z: 29.5, tier: 1, level: 6 });

  // ---------------- the Rusted Wheelworks (west)
  K.fill(2, 2, 14, 48, (x, y) => { if (g.get(x, y) !== T.WALL) g.set(x, y, vnoise(x * 0.25, y * 0.25, 4) > 0.55 ? T.FLOOR : T.CLAY); });
  K.path([[8, 47], [8, 30], [10, 22], [8, 10]], T.STONE, 0);
  for (const [x, y, w, s] of [[3, 14, 4, 0.2], [10, 28, 4, -0.3], [3, 36, 3, 0.5], [11, 40, 3, 0]]) { K.rect(x, y, x + w - 1, y + w - 1, T.PROP); K.def({ type: 'landmark', model: 'biggear', x: x + w / 2, z: y + w / 2, w, d: w, tilt: s }); }
  K.landmark('cg-wheelworks', 'The Rusted Wheelworks', 'biggear', 7.5, 21, 6, 6, { tilt: 0.9, major: false });
  K.rect(5, 18, 10, 24, T.PROP);
  for (const [x, y] of [[4, 8], [12, 8], [4, 44], [12, 34]]) K.set(x, y, T.PILLAR);
  K.def({ type: 'gearlever', x: 8.5, z: 5.5, id: 'A', name: 'the Wheelworks lever' });
  K.sign(10.5, 7.5, 'WINDING LEVER I — THE WHEELWORKS\n"Throw all three, and the old clock strikes."');
  K.def({ type: 'arena7', id: 'cg-wheel', x: 8.5, z: 10.5, radius: 4.8, title: 'THE WHEELWORKS GANG', waves: [[['brigand', -2, 1], ['brigand', 2, 1], ['beetle', 0, -2]], [['beetle', 0, -2, 'elite'], ['brigand', -3, 2], ['porcelain', 3, 2]]] });
  K.enemy('beetle', 8, 30); K.enemy('brigand', 6, 38);
  K.def({ type: 'lootchest', id: 'cg-lc-wheel', x: 12.5, z: 45.5, tier: 1, level: 6 });

  // ---------------- the Bronze Belfry Frame (east)
  K.fill(73, 2, 85, 43, (x, y) => { if (g.get(x, y) !== T.WALL) g.set(x, y, hash2(x, y, 5) > 0.3 ? T.STONE : T.GRASS); });
  // the lever alcove: bronze uprights with a gate that the bells unlock
  K.rect(75, 3, 82, 3, T.PILLAR); K.rect(75, 3, 75, 9, T.PILLAR); K.rect(82, 3, 82, 9, T.PILLAR); K.rect(75, 9, 82, 9, T.PILLAR); K.set(78, 9, T.STONE);
  K.def({ type: 'door', id: 'cg-bellcage', x: 78.5, z: 9.5, orient: 'h', kind: 'stone', signal: 'w7:cg.bells', single: true });
  K.def({ type: 'gearlever', x: 78.5, z: 5.5, id: 'B', name: 'the Belfry lever' });
  K.landmark('cg-belfry', 'The Bronze Belfry Frame', 'bronzeframe', 78.5, 15, 9, 3, { major: false });
  for (let i = 0; i < 3; i++) K.def({ type: 'hangbell', x: 75.5 + i * 3, z: 15.5, group: 'cg.bells', pitch: i });
  K.def({ type: 'bellseq', group: 'cg.bells', order: [2, 0, 1], signal: 'w7:cg.bells' });
  K.sign(84.2, 19.5, 'A verdigris plaque:\n"The quarter rings bright, the hour rings deep, the half keeps the middle.\nStrike them as the clock would: quarter, hour, half."');
  K.enemy('moth', 76, 26); K.enemy('moth', 82, 30); K.enemy('mantis', 78, 36); K.enemy('porcelain', 80, 24);
  K.def({ type: 'lootchest', id: 'cg-lc-belfry', x: 84.5, z: 40.5, tier: 2, level: 7 });

  // ---------------- the Topiary Maze (south-west)
  for (let j = 0; j < MAZE.length; j++) for (let i = 0; i < MAZE[j].length; i++) {
    const c = MAZE[j][i], x = 3 + i, y = 51 + j;
    g.set(x, y, c === '#' ? T.WALL : T.GRASS);
    if (c === 'L') K.def({ type: 'gearlever', x: x + 0.5, z: y + 0.5, id: 'C', name: 'the Maze lever' });
    if (c === 'e') g.set(x, y, T.PATH);
    if (c === 's') { K.def({ type: 'switch', x: x + 0.5, z: y + 0.5, latch: true, group: 'cg.alcove' }); K.def({ type: 'leafpile', x: x + 0.5, z: y + 0.5 }); }
    if (c === 'D') K.def({ type: 'door', id: 'cg-alcove', x: x + 0.5, z: y + 0.5, orient: 'v', kind: 'stone', signal: 'w7:cg.alcove', single: true });
    if (c === '*') K.def({ type: 'chest', id: 'cg-alcove-chest', x: x + 0.5, z: y + 0.5, contents: { kind: 'pips', n: 180 } });
  }
  K.def({ type: 'switchgroup', group: 'cg.alcove', needs: 1, signal: 'w7:cg.alcove' });
  K.landmark('cg-maze', 'The Topiary Maze', null, 17.5, 58.5);
  K.landmark('cg-alcove', 'The Gardener\'s Alcove', null, 11.5, 64.5, 0, 0, { hidden: true });
  K.enemy('mantis', 10, 52); K.enemy('mantis', 25, 62); K.enemy('moth', 18, 62);
  K.sign(31.5, 56.5, 'THE TOPIARY MAZE\nWINDING LEVER III lies at its heart.\n(Gardeners hide their keys under the leaves.)');

  // ---------------- the Gearhouse (outpost, south-east)
  K.fill(57, 48, 85, 67, (x, y) => { if (g.get(x, y) !== T.WALL) g.set(x, y, hash2(x, y, 9) > 0.7 ? T.STONE : T.PATH); });
  K.fill(57, 60, 62, 66, (x, y) => { if (g.get(x, y) !== T.WALL) g.set(x, y, T.GRASS); });
  K.deco('gearhouse', 68, 49, 7, 4);
  K.landmark('cg-gearhouse', 'The Gearhouse', null, 71.5, 51);
  K.def({ type: 'bellstone', x: 64.5, z: 56.5, spawn: 'gearhouse', name: 'The Gearhouse' });
  K.def({ type: 'npc', id: 'pim', name: 'Cogsworth Pim', x: 70.5, z: 55.6, look: 'miller' });
  K.deco('cellardoor', 78, 60, 2, 2);
  K.def({ type: 'warp', x: 79, z: 62.4, r: 0.7, to: 'undercroft', spawn: 'entrance', label: 'The Clockwork Undercroft' });
  K.sign(81.5, 62.5, 'THE CLOCKWORK UNDERCROFT\nWhere the garden\'s gears go down into the dark. Ticking, still.');
  K.deco('barrels', 60, 51, 1, 1); K.deco('barrels', 83, 52, 1, 1); K.deco('marketstall', 75, 55, 2, 1, { awning: 0xb88a3a, goods: 'pots' });
  K.landmark('cg-undercroft', 'The Clockwork Undercroft', null, 79, 61);

  // --- ambience: gear-glints and lamps along the lawns
  for (const [x, y] of [[40, 58], [48, 58], [44, 66], [60, 58], [66, 62], [74, 58], [20, 20], [68, 20], [44, 33], [8, 46], [78, 42]]) if (g.get(x, y) !== T.WALL && g.get(x, y) !== T.PROP) K.deco('lamppost', x, y, 1, 1);

  heights(K, W, H, { [T.WALL]: 1.3, [T.PILLAR]: 1.9 });
  const spawns = {
    gate: { x: 44.5, z: 65.8 }, entrance: { x: 44.5, z: 65.8 }, gearhouse: { x: 64.5, z: 57.8 }, undercroft: { x: 79, z: 63.8 }, court: { x: 44.5, z: 35.5 },
  };
  return finish(K, W, H, {
    id: 'clockwork', name: 'The Clockwork Garden', spawns, outdoor: true, region7: 'clockwork', music: 'glass', sky: 0x9ad0e8, fog: 0xc8e0d8, sun: 0xfff0d0, amb: 0xa8c8b0, ground: 0x6a8a4a, level: 0,
    tileInfo: {
      [T.WALL]: { h: 1.3, top: [0x4f9444, 0x468a3e, 0x57a04a], side: 0x3f7f3a, side2: 0x356e32 },
      [T.PILLAR]: { h: 1.9, top: [0xc89a4a], side: 0xb88a3a, side2: 0x8a6428 },
      [T.FLOOR]: { h: 0, top: [0x9a6a44, 0x8e603c, 0xa8744a] },
    },
  }, [['garden', 'The Clockwork Garden', 'clockwork', 6], ['court', 'The Great Clock Court', 'clockwork', 6], ['wheel', 'The Rusted Wheelworks', 'clockwork', 7], ['belfry', 'The Bronze Belfry Frame', 'clockwork', 7], ['maze', 'The Topiary Maze', 'clockwork', 6], ['gearhouse', 'The Gearhouse', 'clockwork', 5, { safe: true }], ['lawn', 'The Gatehouse Lawn', 'clockwork', 5, { safe: true }]]);
}

// ================================================================ THE ROOTLIGHT CAVERNS
// 92 x 80, underground. Floor is T.CAVE, walls T.ROCK, glowing moss T.MOSS, the underlake
// WATER/DEEP with SHALLOW fords. Heights descend from the entrance shaft (1.6) through the root
// passage (0.8) to the great hall (0).
export function buildRootlight() {
  const W = 92, H = 80, K = kit(W, H, T.ROCK), g = K.g;
  const P = { caverns: 0, shaft: 1, passage: 2, hall: 3, seam: 4, lake: 5, refuge: 6, roots: 7 };
  const floor = (fn) => (x, y, d) => { g.set(x, y, T.CAVE); if (fn) fn(x, y, d); };
  K.place(0, 0, W - 1, H - 1, P.caverns);
  // --- the entrance shaft (north-west), high up
  K.blob(10, 7, 6, 4.5, floor((x, y) => K.E(x, y, 1.6)), 0.25, 5); K.place(3, 2, 17, 13, P.shaft);
  K.stairs(15, 8, 1, 0, 4, 1.6, 0.8, 2);
  // --- the tight root passage, winding east at 0.8
  const passage = [[19, 8.5], [24, 10], [29, 9], [33, 11], [37, 12.5]];
  for (let i = 0; i < passage.length - 1; i++) {
    const [ax, ay] = passage[i], [bx, by] = passage[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n; for (const [ox, oy] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const tx = Math.round(x + ox - 0.5), ty = Math.round(y + oy - 0.5); if (g.get(tx, ty) === T.ROCK) g.set(tx, ty, T.CAVE); K.E(tx, ty, 0.8); } }
  }
  K.place(18, 6, 38, 14, P.passage);
  for (const x of [22, 27, 32]) K.def({ type: 'landmark', model: 'hangingroots', x: x + 0.5, z: 9.5, w: 2, d: 2, y: 0.8 });
  K.stairs(38, 12, 1, 0, 3, 0.8, 0, 2);
  // --- the Glowroot Hall: huge, luminous, with a root bridge across a glowing chasm
  K.blob(56, 29, 17, 16, floor(), 0.22, 7); K.place(40, 12, 73, 47, P.hall);
  K.blob(56, 30, 9, 3.2, (x, y) => g.set(x, y, T.PIT), 0.2, 8);               // the chasm
  K.path([[41, 13], [48, 22], [56, 30], [63, 38], [66, 46]], T.CAVE, 1);    // the visible route across
  for (let x = 44; x <= 68; x++) for (let y = 20; y <= 42; y++) if (g.get(x, y) === T.BRIDGE) K.E(x, y, 0.05);
  K.landmark('rl-hall', 'The Glowroot Hall', 'bigshroom', 48, 34, 3, 3, { big: true, major: true });
  for (const [x, y, s] of [[64, 20, 1], [62, 44, 0], [47, 42, 1], [69, 30, 0]]) { K.rect(x - 1, y - 1, x, y, T.PROP); K.def({ type: 'deco', model: 'bigshroom', x, z: y, w: 2, d: 2, big: !!s }); }
  K.fill(41, 13, 72, 46, (x, y) => { if (g.get(x, y) === T.CAVE && vnoise(x * 0.3, y * 0.3, 21) > 0.68) g.set(x, y, T.MOSS); });
  K.vista('rl-vista', 41.5, 14.5, 1.8, 'The Glowroot Hall');
  K.def({ type: 'glowbloom', id: 'hall', x: 53.5, z: 24.5 });
  K.def({ type: 'arena7', id: 'rl-warden', x: 58.5, z: 38.5, radius: 5, title: 'THE ROOTWARDEN', waves: [[['sporeling', -3, 0], ['sporeling', 3, 0], ['wisp', 0, -3]], [['treant', 0, -2, 'elite'], ['sporeling', -3, 2], ['sporeling', 3, 2]]] });
  K.enemy('sporeling', 50, 18); K.enemy('sporeling', 52, 19); K.enemy('wisp', 66, 26); K.enemy('wisp', 44, 36);
  K.def({ type: 'lootchest', id: 'rl-lc-hall', x: 70.5, z: 40.5, tier: 1, level: 9 });
  // --- the Crystal Seam (east)
  K.blob(80, 22, 8, 12, floor(), 0.3, 11); K.place(72, 8, 90, 36, P.seam);
  K.path([[70, 26], [74, 24]], T.CAVE, 1);
  for (const [x, y, s] of [[78, 12, 1.2], [85, 18, 1], [76, 30, 0.9], [86, 30, 1.3], [81, 24, 1.6]]) { K.set(x, y, T.PROP); K.def({ type: 'landmark', model: 'crystalcluster', x: x + 0.5, z: y + 0.5, w: 1, d: 1, s }); }
  K.landmark('rl-seam', 'The Crystal Seam', null, 81, 22);
  K.def({ type: 'glowbloom', id: 'seam', x: 83.5, z: 14.5 });
  K.enemy('slug', 78, 18); K.enemy('slug', 84, 26); K.enemy('wraith', 80, 32);
  // a hollow in the seam behind a cracked crystal wall
  K.rect(87, 8, 89, 11, T.CAVE); K.set(86, 10, T.CAVE);
  K.def({ type: 'mdsecret', id: 'rl-geode', x: 86.5, z: 10.5, glass: true, contents: { kind: 'mat', mat: 'porcelain', n: 2 } });
  K.def({ type: 'chest', id: 'rl-geode-chest', x: 88.5, z: 9.5, contents: { kind: 'pips', n: 220 } });
  K.landmark('rl-geode', 'The Geode Hollow', null, 88.5, 9.5, 0, 0, { hidden: true });
  // the Lumen Burrow (mini-dungeon) below the seam
  K.blob(81, 42, 5, 4, floor(), 0.2, 13); K.path([[80, 34], [81, 40]], T.CAVE, 1);
  K.deco('cellardoor', 80, 44, 2, 2);
  K.def({ type: 'warp', x: 81, z: 43.6, r: 0.7, to: 'lumenburrow', spawn: 'entrance', label: 'The Lumen Burrow' });
  K.landmark('rl-burrow', 'The Lumen Burrow', null, 81, 44);
  K.sign(84.5, 41.5, 'THE LUMEN BURROW\nSomething down here drinks the light.');
  // --- the Underlake (south)
  K.blob(46, 63, 22, 12, floor(), 0.25, 17); K.place(22, 50, 70, 78, P.lake);
  K.blob(46, 64, 17, 8, (x, y, d) => g.set(x, y, d < 0.55 ? T.DEEP : T.WATER), 0.2, 18);
  K.path([[63, 45], [60, 52], [54, 58], [46, 60], [38, 63], [28, 62]], T.SHALLOW, 0);   // the ford
  K.blob(48, 69, 3.2, 2.2, (x, y) => g.set(x, y, T.CAVE), 0.1, 19);                      // the far islet
  K.set(48, 66, T.DEEP); K.set(48, 67, T.CAVE); K.set(48, 65, T.CAVE); K.set(48, 64, T.SHALLOW);
  K.def({ type: 'block', id: 'rl-lakeblock', x: 48.5, z: 62.5, sinks: true });          // push it south into the gap
  K.def({ type: 'chest', id: 'rl-islet', x: 48.5, z: 70.5, contents: { kind: 'mat', mat: 'echo', n: 1 } });
  K.def({ type: 'glowbloom', id: 'lake', x: 36.5, z: 63.5 });
  K.landmark('rl-underlake', 'The Underlake', null, 46, 63);
  K.landmark('rl-islet', 'The Drowned Islet', null, 48.5, 69.5, 0, 0, { hidden: true });
  K.enemy('leech', 44, 58); K.enemy('leech', 56, 60); K.enemy('slug', 30, 60);
  K.def({ type: 'lootchest', id: 'rl-lc-lake', x: 27.5, z: 58.5, tier: 2, level: 10 });
  // --- Glowroot Refuge (west): a lamp-lit camp with a Bellstone
  K.blob(13, 40, 9, 8, floor(), 0.2, 23); K.place(3, 30, 23, 49, P.refuge);
  K.path([[18, 14], [14, 26], [13, 34]], T.CAVE, 1);                                      // from the shaft, down the side
  K.path([[21, 42], [30, 46], [40, 44], [44, 40]], T.CAVE, 1);                           // to the hall
  K.path([[20, 46], [26, 55], [29, 60]], T.CAVE, 1);                                      // to the lake shore
  K.fill(9, 36, 17, 44, (x, y) => { if (g.get(x, y) === T.CAVE) g.set(x, y, T.MOSS); });
  K.def({ type: 'bellstone', x: 12.5, z: 39.5, spawn: 'refuge', name: 'Glowroot Refuge' });
  K.def({ type: 'npc', id: 'mira', name: 'Mira the Lampkeeper', x: 15.5, z: 41.6, look: 'hermit' });
  K.deco('tent', 8, 42, 2, 2); K.deco('barrels', 17, 36, 1, 1);
  for (const [x, y] of [[10, 36], [18, 44], [7, 39]]) K.deco('lamppost', x, y, 1, 1);
  K.landmark('rl-refuge', 'Glowroot Refuge', null, 13, 40);
  // --- the Hanging Roots and the Root Lift (south-west), behind a root curtain the blooms part
  K.blob(12, 64, 8, 10, floor(), 0.25, 29); K.place(3, 52, 22, 78, P.roots);
  K.path([[13, 47], [13, 54]], T.CAVE, 1);
  K.rect(11, 51, 15, 51, T.ROCK); K.set(13, 51, T.CAVE);
  K.def({ type: 'door', id: 'rl-curtain', x: 13.5, z: 51.5, orient: 'h', kind: 'stone', signal: 'w7:rl.lit', single: true, look: 'roots' });
  for (const [x, y] of [[9, 58], [16, 60], [11, 66], [15, 70]]) K.def({ type: 'landmark', model: 'hangingroots', x: x + 0.5, z: y + 0.5, w: 2, d: 2 });
  K.landmark('rl-roots', 'The Hanging Roots', null, 12, 64);
  K.deco('rootlift', 11, 72, 2, 2);
  K.def({ type: 'rootlift', x: 12, z: 71.3, id: 'w7-rootlift-below', below: true });
  K.sign(15.5, 72.5, 'THE ROOT LIFT\nA cage wound into the roots, and a lever. The roots go up and up — to daylight.');
  K.enemy('wraith', 12, 60); K.enemy('sporeling', 16, 64);

  // light: fungus, crystals and the refuge lamps glow; the rest is the player's own lamp
  heights(K, W, H, { [T.ROCK]: 2.2, jitter: new Set([T.ROCK]) });
  const spawns = {
    mouth: { x: 10.5, z: 8.5 }, entrance: { x: 10.5, z: 8.5 }, refuge: { x: 12.5, z: 41.2 }, lift: { x: 12, z: 69.8 }, lumenburrow: { x: 81, z: 46.2 }, hall: { x: 42.5, z: 15.5 },
  };
  return finish(K, W, H, {
    id: 'rootlight', name: 'The Rootlight Caverns', spawns, underground: true, dark: true, region7: 'rootlight', music: 'cave', sky: 0x0c1418, fog: 0x1a2a30, sun: 0x9ad8e8, amb: 0x4a6a78, ground: 0x2a3036, level: 0,
    tileInfo: {
      [T.ROCK]: { h: 2.2, top: [0x2a2c36, 0x262832, 0x30323c], side: 0x383a48, side2: 0x2c2e3a },
      [T.CAVE]: { h: 0, top: [0x3e4450, 0x3a404c, 0x444a56] },
      [T.MOSS]: { h: 0, top: [0x3a7a6a, 0x357062, 0x40846f] },
      [T.PIT]: { h: -4, top: [0x0a2a30], side: 0x1a5a60, side2: 0x0a2a30 },
    },
  }, [['caverns', 'The Rootlight Caverns', 'rootlight', 9], ['shaft', 'The Rootlight Shaft', 'rootlight', 8], ['passage', 'The Root Passage', 'rootlight', 8], ['hall', 'The Glowroot Hall', 'rootlight', 9], ['seam', 'The Crystal Seam', 'rootlight', 10], ['lake', 'The Underlake', 'rootlight', 10], ['refuge', 'Glowroot Refuge', 'rootlight', 8, { safe: true }], ['roots', 'The Hanging Roots', 'rootlight', 9]]);
}
