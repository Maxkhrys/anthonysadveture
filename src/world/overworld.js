// Pass 6: Lanternreach, the whole overworld.
//
// Authored first, variable second. Everything painted here is the same for every character:
// geography, roads, towns, story dungeons, puzzles and landmarks. Optional variation (camps,
// rare spawns, merchants, events, a few cave mouths) is chosen per character from the anchor
// lists in anchors.js and added at load time (worldgen.js), never here.
//
// The original 150x110 map (the Heartland) is painted by heartland.js exactly as before and
// placed at HEART first; the regions around it are painted in world coordinates after.
import { T } from './tiles.js';
import { fbm, hash2, vnoise } from '../engine/util.js';
import { Grid } from './grid.js';
import { paintHeartland } from './heartland.js';
import { WORLD_W, WORLD_H, HEART, BIOME, REGIONS } from './layout.js';

const WALKABLE = new Set([T.GRASS, T.PATH, T.SAND, T.ASH, T.FLOWERS, T.FOREST, T.STONE, T.MOSS, T.BRIDGE, T.DOCK, T.SHALLOW, T.MUD, T.CLAY, T.FIELD, T.EMBER, T.STAIRS, T.FLOOR, T.CAVE]);
export const isWalkTile = t => WALKABLE.has(t);

// Named places. Each tile belongs to one; its region id picks biome, music and mood.
const PLACES = [
  ['meadows', 'Lanternreach Meadows', 'heartland', 2], ['thimble', 'Thimblewick', 'heartland', 1, { music: 'village' }], ['farm', 'Hobb\'s Farm', 'heartland', 3],
  ['knoll', 'Bellwatch Knoll', 'heartland', 3], ['camp', 'Hush Encampment', 'heartland', 6, { music: 'camp' }], ['gate', 'Chime Gate', 'glassmere', 6],
  ['whisper', 'Whisperwood', 'whisperwood', 3], ['deep', 'The Deepwood', 'deepwood', 7], ['fern', 'Fernhollow', 'deepwood', 8],
  ['glass', 'Glassmere', 'glassmere', 6], ['cons', 'Conservatory Grounds', 'glassmere', 5], ['windstair', 'The Windstair', 'glassmere', 10],
  ['shore', 'Saltwhistle Shore', 'lake', 3], ['lake', 'Lake Mirrow', 'lake', 8], ['heron', 'Heron Isle', 'lake', 8], ['landing', 'Mirrow Landing', 'lake', 8],
  ['tide', 'Lake Mirrow', 'lake', 5], ['chapelisle', 'Chapel Isle', 'lake', 9],
  ['sun', 'Sunscald Reach', 'sunscald', 9], ['sunold', 'Sunscald Reach', 'sunscald', 7], ['dustbowl', 'The Dustbowl', 'sunscald', 10], ['wells', 'Sunscald Wells', 'sunscald', 9],
  ['cinder', 'Cinderpeak', 'cinderpeak', 12], ['foothills', 'Cinderpeak Foothills', 'cinderpeak', 9], ['rest', 'Cinder Rest', 'cinderpeak', 11], ['kilnroad', 'The Kiln Road', 'cinderpeak', 10],
  ['moon', 'Moonfen', 'moonfen', 11], ['mire', 'Mirewhistle Fen', 'moonfen', 8],
  ['high', 'Chime Highlands', 'highlands', 14], ['cradle', 'The Belfry Cradle', 'highlands', 15], ['cairn', 'The Cairn Fields', 'highlands', 13], ['ruins', 'Bellwright Ruins', 'highlands', 14],
];

export function buildOverworld() {
  const W = WORLD_W, H = WORLD_H;
  const g = new Grid(W, H, T.GRASS);
  g.hv.fill(NaN);
  const elev = new Float32Array(W * H);          // base ground height of each tile
  const ridx = new Uint8Array(W * H);            // PLACES index per tile
  const places = PLACES.map(([key, name, id, level, extra]) => ({ key, name, id, level, music: REGIONS[id].music, ...(extra || {}) }));
  const P = Object.fromEntries(places.map((p, i) => [p.key, i]));
  const n = (x, y, s = 0.08, seed = 1) => fbm(x * s, y * s, seed);
  const inHeart = (x, y) => x >= HEART.x && x < HEART.x + HEART.w && y >= HEART.z && y < HEART.z + HEART.h;
  const heartRim = (x, y) => inHeart(x, y) && (x < HEART.x + 2 || x >= HEART.x + HEART.w - 2);
  const E = (x, y, h) => { if (g.in(x, y)) elev[y * W + x] = h; };
  const getE = (x, y) => g.in(x, y) ? elev[y * W + x] : 0;
  const mark = (x, y, pi) => { if (g.in(x, y)) ridx[y * W + x] = pi; };
  const landmarks = [], vistas = [];
  const blob = (cx, cy, rx, ry, fn, amp = 0.35, seed = 7) => {
    for (let y = Math.floor(cy - ry * 1.5); y <= cy + ry * 1.5; y++) for (let x = Math.floor(cx - rx * 1.5); x <= cx + rx * 1.5; x++) {
      if (!g.in(x, y)) continue;
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1 + (vnoise(x * 0.18, y * 0.18, seed) - 0.5) * amp * 2) fn(x, y, d);
    }
  };
  const terrace = (cx, cy, rx, ry, h, amp = 0.2, seed = 3) => blob(cx, cy, rx, ry, (x, y) => E(x, y, h), amp, seed);
  const terraceRect = (x0, y0, x1, y1, h, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { E(x, y, h); if (t !== undefined) g.set(x, y, t); } };
  // cut steps: a strip of STAIRS from (x,y) running (dx,dy) for len tiles, climbing h0 -> h1
  const stairs = (x, y, dx, dy, len, h0, h1, width = 2) => {
    for (let i = 0; i < len; i++) for (let k = 0; k < width; k++) {
      const tx = x + dx * i + (dy ? k : 0), ty = y + dy * i + (dx ? k : 0);
      g.set(tx, ty, T.STAIRS); E(tx, ty, h0 + (h1 - h0) * (i + 1) / (len + 1));
    }
  };
  // roads: carve through anything; water becomes a bridge, a chasm a rope bridge, lava a causeway
  const road = (pts, t = T.PATH, w = 1, onWater = T.BRIDGE) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const st = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= st; k++) {
        const x = ax + (bx - ax) * k / st, y = ay + (by - ay) * k / st;
        for (let oy = -w; oy <= w; oy++) for (let ox = -w; ox <= w; ox++) {
          if (ox * ox + oy * oy > w * w + 0.5) continue;
          const tx = Math.round(x + ox), ty = Math.round(y + oy);
          if (!g.in(tx, ty)) continue;
          const cur = g.get(tx, ty);
          if (cur === T.WATER || cur === T.DEEP) g.set(tx, ty, onWater);
          else if (cur === T.PIT) { g.set(tx, ty, T.BRIDGE); E(tx, ty, ty < 70 ? 1.2 : 0); }
          else if (cur === T.LAVA) g.set(tx, ty, T.STONE);
          else if (cur !== T.BRIDGE && cur !== T.STONE && cur !== T.PROP && cur !== T.STAIRS && cur !== T.DOCK) g.set(tx, ty, t);
        }
      }
    }
  };
  const river = (pts, hw, fill = null) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const st = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= st; k++) {
        const x = ax + (bx - ax) * k / st, y = ay + (by - ay) * k / st;
        for (let oy = -hw - 1; oy <= hw + 1; oy++) for (let ox = -hw - 1; ox <= hw + 1; ox++) {
          const tx = Math.round(x + ox), ty = Math.round(y + oy), dd = Math.hypot(ox, oy);
          if (!g.in(tx, ty) || dd > hw + 0.5) continue;
          const cur = g.get(tx, ty);
          if (cur === T.PATH || cur === T.BRIDGE || cur === T.STAIRS) { g.set(tx, ty, fill === T.LAVA ? T.STONE : T.BRIDGE); continue; }
          g.set(tx, ty, fill ?? (dd < hw - 0.8 ? T.DEEP : T.WATER)); E(tx, ty, 0);
        }
      }
    }
  };
  const landmark = (id, name, model, x, z, w, d, extra = {}) => {
    landmarks.push({ id, name, x, z, region: extra.region, hidden: !!extra.hidden });
    if (model) g.def({ type: 'landmark', model, x, z, w, d, lid: id, ...extra });
  };
  const deco = (model, x, y, w, d, extra) => g.deco(model, x, y, w, d, extra);
  const sign = (x, z, text) => g.def({ type: 'sign', x, z, text });
  const vista = (id, x, z, zoom, name) => { vistas.push({ id, x, z, zoom, name }); g.def({ type: 'vista', id, x, z, r: 2.2, zoom, name }); };
  const clear = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.set(x, y, t); };
  const markRect = (x0, y0, x1, y1, pi, test) => { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) if (!test || test(x, y)) mark(x, y, pi); };

  // =============================================================== BASE + THE HEART
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (n(x, y, 0.15, 5) > 0.64) g.set(x, y, T.FLOWERS);
  const heart = paintHeartland();
  const hg = heart.grid;
  const heartOrig = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < HEART.h; y++) for (let x = 0; x < HEART.w; x++) {
    const i = (y + HEART.z) * W + x + HEART.x;
    g.t[i] = heartOrig[i] = hg.t[y * HEART.w + x]; g.hv[i] = hg.hv[y * HEART.w + x];
  }
  const oldDefs = heart.defs.map(d => ({ ...d, x: d.x !== undefined ? d.x + HEART.x : undefined, z: d.z !== undefined ? d.z + HEART.z : undefined }));
  // the Heart's own named places (last listed = lowest priority, so paint in reverse)
  const heartPlace = { 'Thimblewick': P.thimble, 'Conservatory Grounds': P.cons, 'Mirewhistle Fen': P.mire, 'Whisperwood': P.whisper, 'Sunscald Reach': P.sunold, 'Cinderpeak Foothills': P.foothills, 'Hush Encampment': P.camp, 'Lake Mirrow': P.tide, 'Chime Gate': P.gate, 'Saltwhistle Shore': P.shore, 'Lanternreach Meadows': P.meadows };
  for (const r of heart.regions.slice().reverse()) markRect(r.x0 + HEART.x, r.y0 + HEART.z, r.x1 + HEART.x - 1, r.y1 + HEART.z - 1, heartPlace[r.name]);

  // =============================================================== CHIME HIGHLANDS (north)
  // A cold upland shelf above the old mountain wall: turf and bare stone, a split crossed on
  // rope, Bellwright ruins, and the Great Bell the Tollcrow nests in.
  const hlSouth = x => x < HEART.x ? 56 + Math.floor(n(x, 0, 0.1, 61) * 5) : 69;
  for (let x = 14; x < 200; x++) for (let y = 4; y <= hlSouth(x); y++) {
    E(x, y, 1.2); mark(x, y, P.high);
    g.set(x, y, n(x, y, 0.09, 62) > 0.58 ? T.STONE : T.GRASS);
    if (n(x, y, 0.2, 63) > 0.72) g.set(x, y, T.ROCK);
    else if (hash2(x, y, 64) > 0.985) g.set(x, y, T.TREE);
    else if (hash2(x, y, 65) > 0.93 && g.get(x, y) === T.GRASS) g.set(x, y, T.FLOWERS);
  }
  // the escarpment down to the Deepwood
  for (let x = 4; x < HEART.x; x++) { const s = hlSouth(x); for (let y = s + 1; y <= s + 3; y++) { g.set(x, y, T.CLIFF); E(x, y, 0.4); mark(x, y, P.high); } }
  // the world's rim
  for (let y = 0; y < H; y++) for (let x = 0; x < 4; x++) g.set(x, y, T.CLIFF);
  for (let y = 0; y < 4; y++) for (let x = 0; x < W; x++) g.set(x, y, T.CLIFF);
  for (let y = 0; y < H; y++) for (let x = W - 4; x < W; x++) g.set(x, y, T.CLIFF);
  for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, T.CLIFF);
  for (let y = 4; y < 60; y++) for (let x = 4; x < 14; x++) g.set(x, y, T.CLIFF);
  // The Split: a chasm across the east of the Highlands
  const splitZ = x => 45 + Math.sin(x * 0.09) * 2.5;
  for (let x = 140; x < 200; x++) { const c = splitZ(x); for (let y = Math.floor(c - 1.5); y <= c + 1.5; y++) { g.set(x, y, T.PIT); E(x, y, 0); } }
  for (const bx of [151, 187]) { const c = Math.round(splitZ(bx)); for (let y = c - 3; y <= c + 3; y++) for (const x of [bx, bx + 1]) { g.set(x, y, T.BRIDGE); E(x, y, 1.2); } }
  // the east gorge between the Highlands and Cinderpeak, one rope bridge across
  for (let y = 4; y < 70; y++) for (let x = 200; x <= 205; x++) { g.set(x, y, y < 62 ? T.PIT : T.CLIFF); E(x, y, 0); }
  for (let x = 199; x <= 206; x++) for (const y of [30, 31]) { g.set(x, y, T.BRIDGE); E(x, y, 1.2); }
  // Belfry Cradle: the Tollcrow's arena under the Great Bell
  blob(118, 30, 9, 7, (x, y) => { g.set(x, y, T.STONE); E(x, y, 1.2); }, 0.1, 71);
  for (const [px, pz] of [[106, 29], [129, 29]]) for (let y = pz; y <= pz + 2; y++) for (let x = px; x <= px + 1; x++) g.set(x, y, T.ROCK);
  landmark('greatbell', 'The Great Bell', 'greatbell', 118.5, 30.5, 22, 3, { y: 1.2, region: 'highlands' });
  g.def({ type: 'tollcrow', x: 118.5, z: 30.5 });
  sign(118.5, 40.5, 'THE BELFRY CRADLE\nThe Bellwrights hung their Great Bell here to be heard in every valley.\nNow something black and patient nests in its crown.\n(Strike the Great Bell while the thing is perched on it…)');
  // Bellwright ruins: broken walls, columns and a fallen library
  for (let y = 21; y < 32; y++) for (let x = 157; x < 176; x++) g.set(x, y, T.STONE);
  for (const [x0, y0, x1, y1] of [[156, 20, 176, 20], [156, 20, 156, 32], [176, 20, 176, 27], [160, 32, 170, 32], [164, 24, 164, 28]]) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (hash2(x, y, 81) > 0.22) g.set(x, y, T.WALL);
  }
  for (const [x, y] of [[159, 24], [168, 24], [159, 29], [172, 29]]) g.set(x, y, T.PILLAR);
  landmark('ruins', 'Bellwright Ruins', 'bigbook', 170.5, 26.5, 3, 2, { y: 1.2, region: 'highlands' });
  for (let y = 26; y <= 27; y++) for (let x = 169; x <= 171; x++) g.set(x, y, T.PROP);
  // the Cairn Fields: standing stones and bells half-buried in turf
  for (const [x, y] of [[40, 30], [46, 26], [52, 32], [44, 38], [58, 24], [62, 40], [36, 44], [70, 20]]) g.set(x, y, T.PILLAR);
  deco('buriedbell', 49, 33, 3, 3, { y: 1.2 }); deco('buriedbell', 38, 36, 2, 2, { y: 1.2, small: true }); deco('buriedbell', 60, 30, 2, 2, { y: 1.2, small: true });
  landmark('cairns', 'The Cairn Fields', null, 50.5, 34.5, 3, 3, { region: 'highlands' });
  // Bell Hollow: a giant bell fallen on its side; its mouth is a way in
  clear(65, 27, 75, 37, T.GRASS);
  deco('fallenbell', 67, 29, 6, 4, { y: 1.2 });
  landmark('fallenbell', 'The Fallen Bell', null, 70, 31, 6, 4, { region: 'highlands' });
  g.def({ type: 'warp', x: 70, z: 33.6, r: 0.6, to: 'bellhollow', spawn: 'entrance', label: 'Bell Hollow' });
  // Bellwatch Crown: the high peak, the whole north laid out below it
  terrace(98, 16, 7, 5, 2.4, 0.15, 72);
  blob(98, 16, 6, 4, (x, y) => { if (g.get(x, y) === T.ROCK || g.get(x, y) === T.TREE) g.set(x, y, T.STONE); }, 0.1, 72);
  stairs(97, 22, 0, -1, 3, 1.2, 2.4, 2);
  vista('crown', 98.5, 15.5, 2.4, 'Bellwatch Crown');
  landmark('crown', 'Bellwatch Crown', null, 98, 16, 12, 8, { region: 'highlands' });
  // the Belfry Road: Windstair top -> Cradle -> ruins -> the Chime Spire door
  road([[131, 60], [128, 52], [122, 42], [118, 38]]);
  road([[128, 52], [140, 48], [150, 44], [156, 40], [164, 33]]);
  road([[168, 33], [176, 40], [186, 44], [190, 52], [178, 60], [164, 62]]);
  road([[118, 38], [100, 36], [82, 34], [72, 36]]);
  road([[176, 26], [188, 30], [198, 30]]);
  road([[82, 34], [66, 46], [52, 50], [38, 52]]);
  terraceRect(162, 62, 166, 69, 1.2, T.STONE);
  landmark('spire', 'The Chime Spire Door', 'spiredoor', 164.5, 69.4, 5, 1, { y: 1.2, region: 'highlands' });
  sign(161.5, 64.5, 'THE CHIME SPIRE\nThe back door of the Chime Gate, cut into the mountain.\nIt answers only to the Dawnbell\'s three Voices.\n(The end of this road is not open yet.)');
  vista('southedge', 140.5, 66.5, 2.2, 'The Highland Edge');
  vista('westedge', 64.5, 54.5, 2.2, 'Deepwood Overlook');
  vista('eastgorge', 194.5, 20.5, 2.2, 'Cinder Gorge');
  sign(186.5, 26.5, 'CINDER GORGE\nA rope bridge the Bellwrights never finished paying for.\nEast: the smoke of Cinderpeak.');
  g.def({ type: 'bellstone', x: 121.5, z: 41.5, spawn: 'belfry', name: 'Belfry Cradle' });
  g.def({ type: 'npc', id: 'ferrule', name: 'Old Ferrule', x: 162.5, z: 35.5, look: 'hermit' });
  markRect(104, 18, 134, 43, P.cradle, (x, y) => ridx[y * W + x] === P.high);
  markRect(28, 16, 78, 52, P.cairn, (x, y) => ridx[y * W + x] === P.high);
  markRect(154, 18, 180, 36, P.ruins, (x, y) => ridx[y * W + x] === P.high);

  // =============================================================== WINDSTAIR PASS
  // A gardener's stepladder, taller than a house, leans in a notch of the mountain wall.
  const WS = 129;
  for (let y = 58; y <= 87; y++) for (let x = WS - 2; x <= WS + 4; x++) {
    if (x === WS - 2 || x === WS + 4) { if (y > 69) g.set(x, y, T.CLIFF); continue; }
    g.set(x, y, T.PATH); E(x, y, 1.2);
  }
  stairs(WS, 88, 0, -1, 4, 0, 1.2, 3);
  for (let y = 88; y <= 91; y++) for (let x = WS - 1; x <= WS + 3; x++) if (g.get(x, y) !== T.STAIRS) g.set(x, y, T.PATH);
  landmark('windstair', 'The Windstair', 'stepladder', WS + 1.5, 79, 3, 17, { y: 1.2, region: 'glassmere' });
  sign(WS - 0.5, 92.5, 'THE WINDSTAIR\nUp: the Chime Highlands. Cold, high, and full of old bells.\n(Travellers under level 12, turn back.)');
  g.def({ type: 'bellstone', x: 131.5, z: 60.5, spawn: 'windstair', name: 'Windstair Top' });
  markRect(WS - 3, 58, WS + 5, 92, P.windstair);

  // =============================================================== DEEPWOOD (west)
  for (let y = 57; y < 172; y++) for (let x = 4; x < HEART.x + 2; x++) {
    if (y <= hlSouth(x) + 3) continue;
    if (inHeart(x, y) && !heartRim(x, y)) continue;
    g.set(x, y, T.FOREST); mark(x, y, P.deep);
    if (n(x, y, 0.2, 91) > 0.4 && hash2(x, y, 92) > 0.25) g.set(x, y, T.TREE);
  }
  const glade = (cx, cy, rx, ry, t = T.FOREST, seed = 93) => blob(cx, cy, rx, ry, (x, y) => g.set(x, y, t), 0.3, seed);
  glade(55, 128, 7, 6); glade(40, 118, 8, 7, T.FOREST, 94); glade(30, 150, 9, 7, T.MOSS, 95); glade(24, 88, 7, 6, T.MOSS, 96);
  glade(70, 100, 13, 5, T.FOREST, 97); glade(78, 140, 7, 6, T.FOREST, 99); glade(66, 76, 8, 6, T.FOREST, 100);
  // trails, joined to the Heart's roads
  road([[HEART.x + 26, HEART.z + 40], [100, 116], [88, 121], [74, 123], [62, 126], [55, 128]], T.FOREST);
  road([[55, 128], [46, 122], [40, 118]], T.FOREST);
  road([[40, 118], [32, 106], [26, 94], [24, 90]], T.FOREST);
  road([[55, 128], [52, 140], [44, 152], [36, 160], [32, 170]], T.FOREST);
  road([[62, 126], [72, 112], [70, 102], [66, 90], [66, 78]], T.FOREST);
  road([[70, 102], [84, 104], [HEART.x + 10, HEART.z + 34]], T.FOREST);
  road([[55, 128], [70, 138], [78, 140], [92, 147], [HEART.x + 24, HEART.z + 78]], T.FOREST);
  // the Rootway: a raised root you can walk along, above the forest floor
  const rootPts = [[57, 109], [52, 104], [44, 100], [36, 99], [33, 98]];
  for (let i = 0; i < rootPts.length - 1; i++) {
    const [ax, ay] = rootPts[i], [bx, by] = rootPts[i + 1], st = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let k = 0; k <= st; k++) { const x = ax + (bx - ax) * k / st, y = ay + (by - ay) * k / st; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const tx = Math.round(x + ox), ty = Math.round(y + oy); g.set(tx, ty, T.MOSS); E(tx, ty, 1.2); } }
  }
  stairs(59, 108, 1, 0, 3, 1.2, 0, 3); stairs(31, 97, -1, 0, 3, 1.2, 0, 3);
  vista('rootway', 44.5, 100.5, 1.9, 'The Rootway');
  landmark('rootway', 'The Rootway', null, 44, 100, 3, 3, { region: 'deepwood' });
  // the Great Hollow Log, lying across the trail: walk through it; a knot hole leads inside
  clear(57, 99, 83, 101, T.FOREST);
  landmark('hollowlog', 'The Great Hollow Log', 'hollowlog', 70, 100, 22, 4, { region: 'deepwood' });
  for (const x of [58, 59, 81, 82]) for (const y of [98, 102]) g.set(x, y, T.PROP);
  g.def({ type: 'warp', x: 74.5, z: 97.6, r: 0.55, to: 'logburrow', spawn: 'entrance', label: 'Hollow Log Burrow' });
  // the Bell-in-the-Oak
  deco('belloak', 38, 112, 5, 4);
  landmark('belloak', 'The Bell-in-the-Oak', null, 40.5, 114, 5, 4, { region: 'deepwood' });
  g.def({ type: 'hangbell', x: 43.5, z: 117.5, group: 'oak', pitch: 1 });
  g.def({ type: 'bellseq', group: 'oak', order: null, signal: 'oak.rung' });
  g.def({ type: 'chest', id: 'oak-cache', x: 36.5, z: 118.5, contents: { kind: 'mapfrag', region: 'deepwood' }, hidden: 'oak.rung' });
  sign(45.5, 120.5, 'THE BELL-IN-THE-OAK\nA bell that fell from a Bellwright cart three hundred years ago.\nThe oak grew up and caught it. Nobody has rung it since.');
  // the Giant Mushroom Colony on the Moonfen border
  for (const [x, y, s] of [[26, 146, 3], [33, 150, 2], [28, 155, 2], [36, 144, 2]]) deco('bigshroom', x, y, s, s, { big: s === 3 });
  road([[44, 152], [36, 151], [30, 152]], T.FOREST);
  landmark('shrooms', 'The Mushroom Colony', null, 30, 150, 8, 8, { region: 'deepwood' });
  // the Thornback Nest
  deco('nestmound', 21, 84, 5, 4);
  landmark('nest', 'The Thornback Nest', null, 23.5, 86, 5, 4, { region: 'deepwood' });
  g.def({ type: 'warp', x: 23.5, z: 88.6, r: 0.55, to: 'beetlenest', spawn: 'entrance', label: 'Thornback Nest' });
  // Deepwood Shrine + Bellstone
  deco('shrine', 53, 124, 2, 2);
  g.def({ type: 'bellstone', x: 57.5, z: 131.5, spawn: 'deepwood', name: 'Deepwood Shrine' });
  sign(52.5, 131.5, 'DEEPWOOD SHRINE\nThe lamplighters kept a flame here for travellers.\nIt went out three nights ago.');
  g.def({ type: 'npc', id: 'tallow', name: 'Tallow', x: 55.5, z: 126.8, look: 'shop' });
  // Fernhollow: a hidden glade behind a root tangle, with a Bellstone nobody remembers
  for (let y = 124; y <= 136; y++) for (let x = 10; x <= 25; x++) g.set(x, y, x >= 14 && x <= 22 && y >= 126 && y <= 134 ? T.GRASS : T.TREE);
  for (const x of [23, 24, 25]) g.set(x, 130, T.FOREST);
  road([[26, 130], [34, 127], [40, 122]], T.FOREST);
  g.def({ type: 'tangle', x: 24.5, z: 130.5 });
  g.def({ type: 'bellstone', x: 18.5, z: 130.5, spawn: 'fernhollow', name: 'Fernhollow', hidden: true });
  g.def({ type: 'lootchest', id: 'fern-lc', x: 16.5, z: 127.5, tier: 2, level: 8 });
  g.def({ type: 'clue', x: 26.5, z: 131.5, kind: 'toadstools' });
  landmark('fernhollow', 'Fernhollow', null, 18, 130, 8, 8, { region: 'deepwood', hidden: true });
  markRect(10, 124, 25, 136, P.fern);

  // =============================================================== MOONFEN (south-west)
  const moonEdge = x => 166 + n(x, 0, 0.08, 111) * 8;
  for (let y = 160; y < H - 4; y++) for (let x = 4; x < 118; x++) {
    if (y < moonEdge(x) || (x > 96 && y < 176)) continue;
    if (inHeart(x, y) && !heartRim(x, y)) continue;
    const t = n(x, y, 0.11, 112);
    g.set(x, y, t > 0.6 ? T.SHALLOW : t > 0.52 ? T.MOSS : T.MUD); mark(x, y, P.moon);
    if (t < 0.42 && hash2(x, y, 113) > 0.8) g.set(x, y, T.TREE);
    if (t < 0.34 && n(x, y, 0.2, 114) > 0.6) g.set(x, y, T.FOREST);
  }
  blob(48, 232, 11, 7, (x, y, d) => g.set(x, y, d < 0.5 ? T.DEEP : T.WATER), 0.2, 115);
  blob(86, 236, 7, 5, (x, y, d) => g.set(x, y, d < 0.45 ? T.DEEP : T.WATER), 0.2, 116);
  landmark('belfry', 'The Drowned Belfry', 'drownedbelfry', 86.5, 236, 3, 3, { region: 'moonfen' });
  // the moon-lily islet in the Black Mere, reached only at night over the lilies
  blob(48, 233, 2.2, 1.6, (x, y) => g.set(x, y, T.MOSS), 0.05, 117);
  g.def({ type: 'moonpath', x0: 49, z0: 224, x1: 48, z1: 231 });
  g.def({ type: 'chest', id: 'moon-cache', x: 48.5, z: 233.5, contents: { kind: 'named', id: 'moonwellcenser', level: 11 } });
  landmark('blackmere', 'The Black Mere', null, 48, 232, 11, 7, { region: 'moonfen' });
  // the Moonwillow on its mound
  terrace(60, 212, 5, 4, 0.6, 0.1, 118);
  blob(60, 212, 5, 4, (x, y) => g.set(x, y, T.MOSS), 0.1, 118);
  stairs(60, 217, 0, -1, 1, 0, 0.6, 2);
  deco('moonwillow', 58, 210, 4, 3);
  landmark('moonwillow', 'The Moonwillow', null, 60, 211.5, 4, 3, { region: 'moonfen' });
  // the Moonwell Shrine (its door opens only at night)
  clear(42, 201, 50, 207, T.MOSS);
  deco('shrine', 45, 202, 2, 2);
  g.def({ type: 'nightdoor', x: 46, z: 204.6, to: 'moonwell', spawn: 'entrance', label: 'Moonwell Shrine' });
  sign(43.5, 206.5, 'THE MOONWELL\nA well that only fills by moonlight.\nThe door will not open while the sun can see it.');
  g.def({ type: 'npc', id: 'wisp-keeper', name: 'The Well-keeper', x: 48.5, z: 205.5, look: 'hermit', nightOnly: true });
  // boardwalks over the shallows
  road([[32, 170], [34, 182], [46, 192], [58, 198], [72, 190], [86, 180], [100, 172], [HEART.x + 16, HEART.z + 92]], T.DOCK, 1, T.DOCK);
  road([[58, 198], [60, 206]], T.DOCK, 1, T.DOCK); road([[46, 192], [46, 200]], T.DOCK, 1, T.DOCK);
  road([[72, 190], [80, 210], [86, 228]], T.DOCK, 1, T.DOCK);
  road([[34, 182], [22, 196], [18, 214], [24, 226], [36, 226]], T.DOCK, 1, T.DOCK);
  clear(72, 184, 78, 189, T.MOSS);
  g.def({ type: 'bellstone', x: 75.5, z: 186.5, spawn: 'moonfen', name: 'Moonfen Lantern' });
  deco('biglantern', 76, 182, 2, 2);
  landmark('lantern', 'The Moonfen Lantern', null, 77, 183, 2, 2, { region: 'moonfen' });
  sign(72.5, 188.5, 'MOONFEN\nStay on the boards after dark.\nWhat walks the fen at night walks it in a line.');
  for (const [x, y] of [[22, 196], [100, 210], [16, 236]]) { clear(x - 2, y - 2, x + 2, y + 2, T.MOSS); deco('shrine', x - 1, y - 1, 2, 2, { ruin: true }); }

  // =============================================================== LAKE MIRROW (south)
  const LAKES = [[190, 208, 92, 44], [246, 178, 26, 10], [118, 184, 26, 9]];
  const lakeD = (x, y) => Math.min(...LAKES.map(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)) + (n(x, y, 0.06, 121) - 0.5) * 0.35;
  for (let y = 150; y < H - 4; y++) for (let x = 90; x < W - 4; x++) {
    if (inHeart(x, y)) continue;
    const d = lakeD(x, y);
    if (d < 0.78) g.set(x, y, T.DEEP); else if (d < 0.95) g.set(x, y, T.WATER); else if (d < 1.08) g.set(x, y, T.SAND);
    else if (y > 240 || x > 296) g.set(x, y, hash2(x, y, 122) > 0.9 ? T.TREE : T.GRASS);
    else continue;
    mark(x, y, P.lake);
  }
  // a channel from the Tide Shrine's lake down to the great water
  river([[HEART.x + 106, HEART.z + 80], [HEART.x + 107, HEART.z + 88], [HEART.x + 105, HEART.z + 100]], 2);
  // Heron Isle and Chapel Isle
  blob(160, 206, 9, 6, (x, y, d) => { g.set(x, y, d > 0.7 ? T.SAND : hash2(x, y, 123) > 0.9 ? T.TREE : T.GRASS); mark(x, y, P.heron); }, 0.2, 124);
  blob(216, 222, 8, 6, (x, y, d) => { g.set(x, y, d > 0.75 ? T.SAND : T.STONE); mark(x, y, P.chapelisle); }, 0.15, 125);
  for (const [x0, y0, x1, y1] of [[211, 217, 221, 217], [211, 217, 211, 224], [221, 217, 221, 224]]) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (hash2(x, y, 126) > 0.25 && !(x === 216)) g.set(x, y, T.WALL);
  for (let y = 219; y < 225; y++) for (let x = 212; x < 221; x++) if (g.get(x, y) === T.STONE && hash2(x, y, 127) > 0.55) g.set(x, y, T.SHALLOW);
  landmark('chapel', 'The Drowned Chapel', 'chapelruin', 216, 220.5, 10, 7, { region: 'lake' });
  g.def({ type: 'warp', x: 216.5, z: 218.6, r: 0.55, to: 'chapel', spawn: 'entrance', label: 'Drowned Chapel' });
  // the boardwalk from Ada's pier to Heron Isle, then stepping stones to Chapel Isle
  for (let y = 175; y <= 200; y++) for (const x of [150, 151]) { g.set(x, y, y > 186 && y < 194 ? T.STONE : T.DOCK); g.hv[y * W + x] = NaN; }
  for (let x = 150; x <= 158; x++) for (const y of [199, 200]) if (g.get(x, y) === T.WATER || g.get(x, y) === T.DEEP || x < 152) g.set(x, y, T.DOCK);
  const stepping = pts => { for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], st = Math.ceil(Math.hypot(bx - ax, by - ay) * 2); for (let k = 0; k <= st; k++) { const x = Math.round(ax + (bx - ax) * k / st), y = Math.round(ay + (by - ay) * k / st); for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) { const t = g.get(x + ox, y + oy); if (t === T.WATER || t === T.DEEP) g.set(x + ox, y + oy, T.STONE); } } } };
  stepping([[168, 207], [180, 211], [192, 214], [204, 218], [209, 221]]);
  landmark('statue', 'The Sunken Bellwright', 'statuehead', 184.5, 196.5, 5, 4, { region: 'lake' });
  landmark('fishbones', 'The Pike Bones', 'fishbones', 128, 188, 10, 3, { region: 'lake' });
  deco('fishshack', 156, 202, 3, 2);
  g.def({ type: 'bellstone', x: 161.5, z: 207.5, spawn: 'heronisle', name: 'Heron Isle' });
  sign(154.5, 204.5, 'HERON ISLE\nThe herons left when the bell went quiet.\nThe pike did not.');
  landmark('heron', 'Heron Isle', null, 160, 206, 9, 6, { region: 'lake' });
  // =============================================================== MIRROW LANDING (east shore)
  // Stilt houses on the water, nets on racks, and a boat that crosses to Ada's pier.
  for (let y = 182; y <= 216; y++) for (let x = 276; x <= 302; x++) { const t = g.get(x, y); if (t === T.DEEP || t === T.WATER) continue; g.set(x, y, x < 282 ? T.SAND : T.GRASS); }
  for (let y = 190; y <= 206; y++) for (let x = 270; x <= 283; x++) g.set(x, y, T.DOCK);
  deco('stilthouse', 272, 190, 3, 3, { roof: 0x4a6a8a }); deco('stilthouse', 276, 201, 3, 3, { roof: 0x6a5a7a }); deco('stilthouse', 292, 186, 3, 3, { roof: 0x5a7a6a });
  deco('stilthouse', 293, 205, 4, 3, { roof: 0x8a5a4a, big: true }); deco('netrack', 286, 192, 2, 1); deco('netrack', 286, 211, 2, 1); deco('boat', 266, 196, 3, 2);
  landmark('landing', 'Mirrow Landing', null, 284, 198, 20, 20, { region: 'lake' });
  g.def({ type: 'bellstone', x: 288.5, z: 199.5, spawn: 'landing', name: 'Mirrow Landing' });
  g.def({ type: 'ferry', x: 270.5, z: 197, to: 'pier', label: 'Saltwhistle Pier' });
  g.def({ type: 'board', x: 291.5, z: 196.3, id: 'landing-board' }); deco('board', 291, 195, 1, 1);
  sign(297.5, 199.5, 'MIRROW LANDING\n"We fish what the lake lets us keep."');
  g.def({ type: 'npc', id: 'quill', name: 'Harbourmaster Quill', x: 285.5, z: 197.5, look: 'guard' });
  g.def({ type: 'npc', id: 'tobi', name: 'Net-mender Tobi', x: 281.5, z: 204.5, look: 'fisher', shop: true });
  g.def({ type: 'npc', id: 'loma', name: 'Old Loma', x: 295.5, z: 210.5, look: 'elder', wander: 2, night: { x: 293.5, z: 203.5 } });
  markRect(264, 180, 304, 216, P.landing);
  // Ada's end of the ferry, on the old pier's end
  g.def({ type: 'ferry', x: 148.5, z: 174.3, to: 'landing', label: 'Mirrow Landing' });

  // =============================================================== SUNSCALD REACH (east)
  for (let y = 100; y < 178; y++) for (let x = HEART.x + HEART.w - 2; x < W - 4; x++) {
    if (inHeart(x, y) && !heartRim(x, y)) continue;
    const t = g.get(x, y); if (t === T.WATER || t === T.DEEP || (y > 170 && t === T.SAND)) continue;
    if (inHeart(x, y) && y < HEART.z + 42) continue; // the Cinderpeak corner keeps its ash
    g.set(x, y, T.SAND); mark(x, y, P.sun);
    if (n(x, y, 0.07, 131) > 0.56 && x > 258) g.set(x, y, T.CLAY);
    if (n(x, y, 0.2, 132) > 0.72) g.set(x, y, T.SANDSTONE);
    else if (hash2(x, y, 133) > 0.993) g.set(x, y, T.TREE);
  }
  const mesa = (cx, cy, rx, ry, h, seed) => { terrace(cx, cy, rx, ry, h, 0.15, seed); blob(cx, cy, rx, ry, (x, y) => { const t = g.get(x, y); if (t === T.SANDSTONE || t === T.TREE || t === T.CLAY) g.set(x, y, T.SAND); }, 0.15, seed); };
  mesa(254, 116, 6, 4, 1.2, 141); stairs(254, 121, 0, -1, 3, 0, 1.2, 2);
  mesa(300, 116, 7, 5, 1.2, 142); stairs(296, 122, 0, -1, 3, 0, 1.2, 2);
  terrace(300, 115, 3, 2, 2.4, 0.05, 143); stairs(300, 118, 0, -1, 2, 1.2, 2.4, 2);
  mesa(244, 158, 5, 4, 1.2, 144); stairs(244, 163, 0, -1, 3, 0, 1.2, 2);
  vista('mesa', 300.5, 114.5, 2.2, 'Sunward Mesa');
  landmark('mesa', 'Sunward Mesa', null, 300, 116, 14, 10, { region: 'sunscald' });
  // Sunscald Wells: an oasis with the region's Bellstone
  blob(268, 146, 5, 3.5, (x, y, d) => g.set(x, y, d < 0.55 ? T.WATER : T.GRASS), 0.2, 145);
  for (const [x, y] of [[262, 143], [274, 144], [263, 150], [273, 149], [268, 141]]) g.set(x, y, T.TREE);
  g.def({ type: 'bellstone', x: 268.5, z: 151.5, spawn: 'wells', name: 'Sunscald Wells' });
  landmark('wells', 'Sunscald Wells', null, 268, 146, 10, 7, { region: 'sunscald' });
  markRect(260, 140, 277, 154, P.wells);
  // the Dry Awning: a caravan town the sand is burying
  clear(246, 144, 258, 154, T.SAND);
  deco('wagon', 247, 146, 3, 2); deco('wagon', 253, 151, 3, 2, { broken: true }); deco('awning', 250, 147, 3, 3); deco('tent', 255, 145, 2, 2);
  landmark('awning', 'The Dry Awning', null, 252, 149, 12, 10, { region: 'sunscald' });
  sign(249.5, 154.5, 'THE DRY AWNING\nA caravan stop. Then a caravan town. Then the wells moved.');
  // the Dustbowl: an open basin where a Hush warband has dug in
  blob(248, 130, 8, 6, (x, y) => { g.set(x, y, T.CLAY); mark(x, y, P.dustbowl); }, 0.15, 146);
  g.def({ type: 'warband', id: 'dustbowl', x: 248.5, z: 130.5, radius: 7 });
  landmark('dustbowl', 'The Dustbowl', null, 248, 130, 16, 12, { region: 'sunscald' });
  // a giant dried sunflower, bowed over the flats; broken garden pots big as barns
  clear(282, 121, 289, 128, T.CLAY);
  landmark('sunflower', 'The Bowed Sunflower', 'drysunflower', 285.5, 124.5, 3, 3, { region: 'sunscald' });
  for (let y = 124; y <= 125; y++) for (let x = 285; x <= 286; x++) g.set(x, y, T.PROP);
  [[276, 136, 0.3], [280, 140, -0.4], [272, 132, 0.8]].forEach(([x, y, tilt]) => { clear(x, y, x + 2, y + 1, T.CLAY); deco('potshard', x, y, 3, 2, { tilt }); });
  landmark('pots', 'The Potsherd Flats', null, 276, 137, 8, 6, { region: 'sunscald' });
  // the Kiln Crypt: a Bellwright tomb under a kiln
  clear(295, 125, 305, 133, T.SAND);
  deco('kilncrypt', 298, 126, 5, 3);
  landmark('kiln', 'The Kiln Crypt', null, 300.5, 127.5, 5, 3, { region: 'sunscald' });
  g.def({ type: 'warp', x: 300.5, z: 129.6, r: 0.55, to: 'kilncrypt', spawn: 'entrance', label: 'Kiln Crypt' });
  // roads: the Heartland's east road carries on to the wells, the Landing and the Kiln Road
  road([[HEART.x + 132, HEART.z + 60], [240, 131], [248, 138], [262, 146], [268, 154], [282, 160], [290, 172], [288, 184]]);
  road([[248, 138], [256, 128], [266, 118], [274, 110], [276, 100]]);
  road([[268, 154], [286, 142], [300, 134], [300, 131]]);
  road([[288, 184], [288, 196]]);

  // =============================================================== CINDERPEAK (north-east)
  for (let y = 4; y < 106; y++) for (let x = 206; x < W - 4; x++) {
    if (inHeart(x, y) && !(heartRim(x, y) && y >= HEART.z + 42)) continue;
    if (x < 240 && y >= 70) continue;
    g.set(x, y, T.ASH); mark(x, y, P.cinder);
    if (n(x, y, 0.16, 151) > 0.63) g.set(x, y, T.ROCK);
    else if (n(x, y, 0.12, 152) > 0.62) g.set(x, y, T.EMBER);
    else if (hash2(x, y, 153) > 0.992) g.set(x, y, T.TREE);
  }
  // the Kiln Road canyon between Sunscald and Cinderpeak
  for (let y = 94; y < 112; y++) for (let x = 262; x < 292; x++) { g.set(x, y, Math.abs(x - 276) > 3 ? T.ROCK : T.PATH); mark(x, y, P.kilnroad); }
  // a slow lava river from the old crater east to the edge of the world
  river([[240, 80], [256, 76], [270, 84], [290, 78], [W - 5, 82]], 1, T.LAVA);
  for (const bx of [258, 300]) for (let y = 70; y < 92; y++) if (g.get(bx, y) === T.LAVA || g.get(bx + 1, y) === T.LAVA) { g.set(bx, y, T.STONE); g.set(bx + 1, y, T.STONE); }
  // Cinder Rest: a forge camp tucked in a hollow of black rock
  blob(272, 58, 13, 10, (x, y, d) => { g.set(x, y, d > 0.8 ? T.ROCK : T.ASH); mark(x, y, P.rest); }, 0.1, 154);
  for (const [x0, x1, y0, y1] of [[257, 263, 56, 60], [270, 274, 65, 71], [270, 274, 45, 50], [282, 288, 54, 58]]) clear(x0, y0, x1, y1, T.PATH);
  deco('forgehut', 263, 51, 4, 3, { roof: 0x4a3a3a }); deco('forgehut', 276, 51, 3, 3, { roof: 0x5a3a2a }); deco('forgehut', 278, 60, 4, 3, { roof: 0x3a3a4a, big: true });
  deco('bigforge', 264, 60, 4, 4);
  landmark('forge', 'The Cinder Rest Forge', null, 266, 62, 4, 4, { region: 'cinderpeak' });
  g.def({ type: 'bellstone', x: 272.5, z: 59.5, spawn: 'cinderrest', name: 'Cinder Rest' });
  g.def({ type: 'workbench', x: 269.3, z: 64.8 });
  sign(261.5, 61.5, 'CINDER REST\n"Miners, smiths, and the occasional lost Mossling."');
  g.def({ type: 'npc', id: 'brakka', name: 'Smith Brakka', x: 267.5, z: 65.3, look: 'miller', shop: true });
  g.def({ type: 'npc', id: 'pell', name: 'Miner Pell', x: 276.5, z: 56.5, look: 'guard', wander: 2, night: { x: 279.5, z: 64.3 } });
  g.def({ type: 'npc', id: 'ysolde', name: 'Ysolde', x: 266.5, z: 55.5, look: 'shop' });
  landmark('cinderrest', 'Cinder Rest', null, 272, 58, 26, 20, { region: 'cinderpeak' });
  // roads through Cinderpeak
  road([[276, 100], [274, 86], [272, 70]]);
  road([[272, 46], [262, 36], [250, 32], [236, 36], [224, 42], [216, 36], [214, 31]]);
  road([[258, 58], [246, 55], [232, 54], [222, 55]]);
  road([[286, 56], [296, 44], [292, 34]]);
  // the Cinderpeak landing of the rope bridge
  terraceRect(206, 24, 213, 37, 1.2, T.STONE);
  stairs(214, 29, 1, 0, 3, 1.2, 0, 3);
  // the Emberwell Gate: the Ember Chime's dungeon, sealed (a later chapter)
  terraceRect(214, 60, 230, 68, 1.2, T.STONE);
  stairs(221, 59, 0, -1, 3, 1.2, 0, 3);
  landmark('emberwell', 'The Emberwell Gate', 'emberwellgate', 222.5, 69.4, 7, 1, { y: 1.2, region: 'cinderpeak' });
  sign(218.5, 63.5, 'THE EMBERWELL GATE\nBehind it the Ember Chime burns. The gate is bound with the same three-voiced lock as the Chime Gate.\n(This dungeon opens in a later chapter.)');
  // the Great Anvil on its rise
  terrace(252, 26, 6, 4, 0.6, 0.1, 155);
  blob(252, 26, 6, 4, (x, y) => { const t = g.get(x, y); if (t === T.ROCK || t === T.EMBER || t === T.TREE) g.set(x, y, T.ASH); }, 0.1, 155);
  stairs(252, 31, 0, -1, 1, 0, 0.6, 2);
  landmark('anvil', 'The Great Anvil', 'greatanvil', 252.5, 25.5, 6, 3, { y: 0.6, region: 'cinderpeak' });
  for (let y = 25; y <= 26; y++) for (let x = 250; x <= 255; x++) g.set(x, y, T.PROP);
  vista('anvil', 252.5, 29.5, 2.1, 'The Great Anvil');
  // the Bell-metal Foundry: bronze arches of a Bellwright bell-works
  clear(284, 25, 300, 37, T.ASH);
  for (const [x, y] of [[288, 28], [292, 28], [296, 28], [288, 34], [296, 34]]) g.set(x, y, T.PILLAR);
  landmark('foundry', 'The Bell-metal Foundry', 'bronzearch', 292, 31, 10, 2, { region: 'cinderpeak' });
  // the Old Forge Deep: forge terraces over lava channels
  terraceRect(234, 38, 246, 46, 1.2, T.ASH);
  stairs(236, 49, 0, -1, 3, 0, 1.2, 2);
  for (let y = 47; y <= 53; y++) for (const x of [234, 239]) { g.set(x, y, T.LAVA); E(x, y, 0); }
  deco('forgemouth', 238, 38, 4, 2, { y: 1.2 });
  landmark('forgedeep', 'The Old Forge Deep', null, 240, 39, 4, 2, { region: 'cinderpeak' });
  g.def({ type: 'warp', x: 240, z: 40.6, r: 0.55, to: 'forgedeep', spawn: 'entrance', label: 'Old Forge Deep' });

  // =============================================================== GLASSMERE (in the Heart's north)
  // the Great Dome: the skeleton of the Bellwrights' first glasshouse, on a low terrace
  terrace(143, 93, 7, 5, 0.6, 0.1, 171);
  blob(143, 93, 7, 5, (x, y) => g.set(x, y, T.STONE), 0.1, 171);
  stairs(142, 99, 0, -1, 2, 0, 0.6, 3);
  road([[138, 104], [143, 101], [143, 100]]);
  landmark('dome', 'The Great Dome', 'domeframe', 143, 92.5, 14, 10, { y: 0.6, region: 'glassmere' });
  vista('dome', 143.5, 93.5, 1.9, 'The Great Dome');
  // mirror puddles and shattered panes east of the gate road
  blob(162, 94, 9, 6, (x, y) => { const t = g.get(x, y); if (t === T.GRASS || t === T.FLOWERS || t === T.TREE) g.set(x, y, n(x, y, 0.3, 172) > 0.55 ? T.SHALLOW : T.GRASS); }, 0.3, 173);
  [[152, 88, 0.3], [168, 88, -0.2], [148, 104, -0.5]].forEach(([x, y, tilt]) => { if (g.get(x, y) !== T.PATH && g.get(x + 1, y) !== T.PATH) deco('shard', x, y, 2, 1, { tilt }); });
  [[150, 96], [170, 101]].forEach(([x, y]) => { if (g.get(x, y) !== T.PATH && g.get(x + 1, y) !== T.PATH && g.get(x, y + 1) !== T.PATH) deco('bigpot', x, y, 2, 2); });
  [[161, 86, 0.6], [170, 96, 0.35], [153, 99, 0.1]].forEach(([x, y, hue]) => { if (g.get(x, y) !== T.PATH) deco('giantflower', x, y, 1, 1, { hue }); });
  landmark('arches', 'The Iron Arches', 'ironarch', HEART.x + 62.6, HEART.z + 38, 5, 1, { region: 'glassmere' });
  landmark('mirrors', 'The Mirror Meadow', null, 162, 94, 16, 12, { region: 'glassmere' });
  // the Mirror Cellar: a cellar door in the meadow that hums
  clear(164, 95, 168, 98, T.GRASS);
  deco('cellardoor', 165, 95, 2, 2);
  g.def({ type: 'warp', x: 166, z: 97.4, r: 0.5, to: 'mirrorcellar', spawn: 'entrance', label: 'Mirror Cellar' });
  g.def({ type: 'clue', x: 166.5, z: 98.6, kind: 'hum' });
  g.def({ type: 'bellstone', x: 141.5, z: 117.5, spawn: 'glassmere', name: 'Conservatory Steps' });
  road([[HEART.x + 45, HEART.z + 36], [138, 104], [134, 96], [WS + 1, 91]]);
  sign(136.5, 101.5, 'GLASSMERE\nNorth: the Windstair and the Chime Highlands.\nSouth: the Cracked Conservatory.');
  markRect(128, 84, 172, 106, P.glass, (x, y) => ridx[y * W + x] === P.meadows || (ridx[y * W + x] === P.whisper && x > 127) || ridx[y * W + x] === P.gate && y > 86);

  // =============================================================== HEARTLAND additions
  // a knoll to look back at the village from
  terrace(164, 118, 4, 3, 1.2, 0.1, 181);
  blob(164, 118, 4, 3, (x, y) => { const t = g.get(x, y); if (t === T.TREE || t === T.PROP) g.set(x, y, T.GRASS); }, 0.1, 181);
  stairs(163, 122, 0, -1, 3, 0, 1.2, 2);
  vista('knoll', 164.5, 117.5, 1.8, 'Bellwatch Knoll');
  landmark('knoll', 'Bellwatch Knoll', null, 164, 118, 8, 6, { region: 'heartland' });
  markRect(159, 114, 169, 123, P.knoll);
  // Hobb's farm, with a cellar under it
  for (let y = 151; y <= 157; y++) for (let x = 156; x <= 167; x++) { const t = g.get(x, y); if (t === T.GRASS || t === T.FLOWERS || t === T.TREE) g.set(x, y, (x - 156) % 3 === 2 ? T.GRASS : T.FIELD); }
  deco('farmhouse', 168, 150, 3, 3, { roof: 0xb0703a });
  landmark('wateringcan', 'Hobb\'s Watering Can', 'wateringcan', 171.5, 157, 3, 2, { region: 'heartland' });
  for (let y = 156; y <= 157; y++) for (let x = 170; x <= 172; x++) g.set(x, y, T.PROP);
  g.def({ type: 'warp', x: 169.5, z: 153.7, r: 0.5, to: 'rootcellar', spawn: 'entrance', label: 'Hobb\'s Root Cellar' });
  g.def({ type: 'npc', id: 'hobb', name: 'Farmer Hobb', x: 165.5, z: 159.5, look: 'miller', night: { x: 167.5, z: 154.4 } });
  landmark('farm', 'Hobb\'s Farm', null, 162, 154, 14, 8, { region: 'heartland' });
  markRect(154, 146, 176, 161, P.farm);
  g.def({ type: 'bellstone', x: 146.5, z: 163.5, spawn: 'pier', name: 'Saltwhistle Pier' });
  // signposts at the forks leaving Thimblewick
  sign(HEART.x + 44.5, HEART.z + 59.5, 'WEST: Whisperwood · Rootwell Hollow · the Deepwood\nNORTH-WEST: the Conservatory · Glassmere · the Windstair');
  sign(HEART.x + 77.5, HEART.z + 59.5, 'EAST: the trowel bridge · Sunscald Reach · Sunscald Wells\nFar east: Mirrow Landing (or take Ada\'s ferry)');
  sign(HEART.x + 57.5, HEART.z + 83.5, 'SOUTH: Saltwhistle Pier · the ferry · Heron Isle\nSOUTH-WEST: Mirewhistle Fen · Moonfen');
  sign(HEART.x + 31.5, HEART.z + 64.5, 'MIREWHISTLE FEN, then MOONFEN\n(Wet boots. Worse at night.)');
  sign(236.5, 128.5, 'SUNSCALD REACH\nWells: east. The Landing: south-east. The Kiln Road: north, to Cinderpeak.');

  // two old Whisperwood chests the trees had always walled in: a deer track to each
  road([[HEART.x + 17, HEART.z + 34], [HEART.x + 12, HEART.z + 37], [HEART.x + 11, HEART.z + 38]], T.FOREST, 1);
  road([[92, 147], [HEART.x + 4, HEART.z + 71], [HEART.x + 3, HEART.z + 70]], T.FOREST, 1);

  // =============================================================== ENCOUNTERS
  // Authored from each region's pool (encounters.js), grouped into places that fight
  // differently: ambushes, bridges, ledges, open ground.
  const EN = (kind, x, y, extra = {}) => g.def({ type: 'enemy', kind, x: x + 0.5, z: y + 0.5, ...extra });
  const pack = (kind, pts, extra) => pts.forEach(([x, y]) => EN(kind, x, y, extra));
  // Highlands
  pack('golem', [[112, 50], [148, 30], [178, 40]]); pack('knight', [[162, 26], [168, 30], [124, 22]]);
  pack('leech', [[90, 30], [136, 16], [182, 16]]); pack('porcelain', [[166, 22], [172, 22]]); pack('wraith', [[60, 44], [80, 50], [120, 58]]);
  pack('imp', [[149, 40], [150, 51], [185, 40], [186, 51]]); // bridge guards
  // Deepwood
  pack('beetle', [[30, 80], [18, 92], [28, 96], [36, 90]]); pack('moth', [[40, 126], [60, 140], [80, 130], [30, 112]]);
  pack('treant', [[48, 108], [20, 146], [74, 150]]); pack('sporeling', [[64, 132], [66, 134], [62, 136], [82, 112], [84, 114]]);
  pack('mantis', [[36, 136], [70, 84], [52, 160]]);
  pack('puffer', [[44, 100], [52, 104]], { ledge: true }); // they hold the Rootway
  // Moonfen
  pack('wisp', [[30, 186], [40, 210], [70, 226], [96, 196]]); pack('wraith', [[54, 198], [66, 220], [26, 222]]);
  pack('leech', [[80, 200], [90, 218], [40, 240]]); pack('slug', [[20, 180], [104, 186], [60, 244]]); pack('sporeling', [[34, 174], [36, 176], [38, 174]]);
  // Lake shores and isles
  pack('leech', [[158, 212], [166, 202], [220, 226]]); pack('moth', [[296, 190], [278, 214]]); pack('brigand', [[288, 172], [284, 164]]);
  pack('slug', [[124, 186], [140, 190]]);
  // Sunscald
  pack('scorpion', [[258, 138], [270, 128], [290, 146], [306, 150], [262, 160], [300, 164]]); pack('brigand', [[244, 136], [252, 140], [266, 158]]);
  pack('imp', [[253, 114], [256, 117], [301, 113]], { ledge: true }); // mesa-top ledges
  pack('golem', [[298, 136]]); pack('porcelain', [[276, 140], [280, 133]]);
  // Cinderpeak
  pack('imp', [[226, 40], [246, 62], [262, 30], [296, 42], [310, 20], [230, 92], [244, 96]]); pack('golem', [[250, 44], [286, 70]]);
  pack('knight', [[222, 57], [226, 57]]); pack('slug', [[258, 86], [292, 88], [236, 20]]); pack('scorpion', [[276, 92], [280, 96]]);
  // Glassmere
  pack('mantis', [[150, 90], [166, 92]]); pack('moth', [[160, 90], [138, 88]]);

  const chests = [
    [98, 12, 2, 14], [174, 22, 1, 13], [60, 22, 1, 13], [120, 64, 1, 12], [190, 12, 2, 14],
    [64, 72, 1, 7], [30, 90, 2, 8], [80, 118, 0, 6], [36, 162, 1, 8], [48, 150, 1, 7], [22, 150, 2, 9],
    [16, 190, 1, 10], [96, 244, 2, 11], [64, 196, 0, 10], [30, 246, 1, 11],
    [164, 210, 1, 9], [220, 226, 2, 10], [298, 222, 1, 9], [250, 246, 0, 8],
    [254, 116, 2, 10], [300, 116, 2, 11], [308, 170, 1, 9], [244, 158, 1, 9], [286, 150, 0, 8],
    [296, 12, 2, 13], [308, 60, 1, 12], [222, 30, 1, 12], [244, 42, 2, 13], [262, 90, 1, 11],
    [170, 88, 1, 7], [134, 88, 0, 6],
  ];
  const open = t => t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.SAND || t === T.PATH || t === T.ASH || t === T.STONE || t === T.MOSS || t === T.MUD || t === T.CLAY || t === T.EMBER;
  chests.forEach(([cx, cy, tier, level], i) => {
    for (let r = 0; r < 7; r++) {
      let found = null;
      for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
        const x = cx + dx, y = cy + dy, h0 = getE(x, y);
        if (open(g.get(x, y)) && open(g.get(x, y + 1)) && open(g.get(x + 1, y)) && open(g.get(x - 1, y)) && getE(x, y + 1) === h0 && getE(x + 1, y) === h0 && getE(x - 1, y) === h0) found = [x, y];
      }
      if (found) { g.def({ type: 'lootchest', id: 'w6-lc' + i, x: found[0] + 0.5, z: found[1] + 0.5, tier, level }); return; }
    }
  });
  // bushes, grass tufts and leaf piles in the new lands (the Heart keeps its own)
  for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
    if (inHeart(x, y)) continue;
    const t = g.get(x, y);
    if ((t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.MOSS) && hash2(x, y, 191) > 0.978) g.def({ type: 'bush', x: x + 0.5, z: y + 0.5 });
    else if ((t === T.GRASS || t === T.FLOWERS) && hash2(x, y, 192) > 0.95) g.def({ type: 'tuft', x: x + 0.5, z: y + 0.5 });
  }
  for (const [x, y, r] of [[34, 96, 'pips20'], [10, 118, 'heart'], [60, 150, 'pips20'], [26, 200, 'pips50'], [110, 60, 'pips20'], [182, 60, 'pips50'], [266, 40, 'pips20'], [306, 142, 'pips50'], [298, 214, 'pips20']]) {
    if (open(g.get(x, y))) g.def({ type: 'leafpile', x: x + 0.5, z: y + 0.5, reveal: r, sand: g.get(x, y) === T.SAND });
  }

  // =============================================================== HEIGHTS
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (inHeart(x, y) && g.t[i] === heartOrig[i] && elev[i] === 0) continue; // the Heart's own cliffs, untouched
    const t = g.t[i], e = elev[i];
    let h = null;
    if (t === T.CLIFF) h = Math.max(e, 0) + 1.4 + Math.floor(vnoise(x * 0.25, y * 0.25, 8) * 3) * 0.6 + (y < 5 ? (5 - y) * 0.5 : 0);
    else if (t === T.ROCK) h = e + 1.2 + Math.floor(vnoise(x * 0.3, y * 0.3, 9) * 3) * 0.5;
    else if (t === T.SANDSTONE) h = e + 1.0 + Math.floor(vnoise(x * 0.3, y * 0.3, 10) * 2) * 0.6;
    else if (t === T.WALL) h = e + 1.3 + (hash2(x, y, 3) > 0.7 ? 0.4 : 0);
    else if (t === T.PILLAR) h = e + 1.6;
    else if (t === T.PIT || t === T.WATER || t === T.DEEP || t === T.LAVA) h = null;
    else if (e > 0) h = e;
    g.hv[i] = h === null ? NaN : h;
  }

  // =============================================================== SPAWNS
  const hs = Object.fromEntries(Object.entries(heart.spawns).map(([k, s]) => [k, { x: s.x + HEART.x, z: s.z + HEART.z }]));
  const spawns = {
    ...hs,
    deepwood: { x: 57.5, z: 133 }, fernhollow: { x: 18.5, z: 132 }, moonfen: { x: 75.5, z: 188.2 }, heronisle: { x: 161.5, z: 209.2 },
    landing: { x: 288.5, z: 201.2 }, wells: { x: 268.5, z: 153.2 }, cinderrest: { x: 272.5, z: 61.3 }, windstair: { x: 131.5, z: 62 },
    belfry: { x: 121.5, z: 43.2 }, glassmere: { x: 141.5, z: 119.2 }, pier: { x: 148.5, z: 163.8 },
    logburrow: { x: 74.5, z: 96.2 }, beetlenest: { x: 23.5, z: 90 }, mirrorcellar: { x: 166, z: 99.4 }, chapel: { x: 216.5, z: 221.4 },
    kilncrypt: { x: 300.5, z: 131.2 }, forgedeep: { x: 240, z: 42.4 }, moonwell: { x: 46, z: 206.4 }, bellhollow: { x: 70, z: 35.4 },
    rootcellar: { x: 169.5, z: 155.2 }, landingdock: { x: 272.5, z: 197.2 }, pierdock: { x: 149.5, z: 172.6 },
  };
  const biome = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) biome[i] = BIOME[places[ridx[i]].id];
  const area = {
    id: 'overworld', name: 'Lanternreach', w: W, h: H, tiles: g.t, hv: g.hv, defs: [...oldDefs, ...g.defs], spawns, dungeon: false,
    music: 'field', sky: 0x8fc8e8, fog: 0xb8d8e8, sun: 0xfff0d0, amb: 0x9ab0d0, ground: 0x6a8a4a,
    biome, regionIdx: ridx, places, landmarks, vistas, heart: HEART, elevated: true,
    // the old flat list of named rectangles, for callers that only read names and levels
    regions: places.map(p => ({ ...p, x0: 0, y0: 0, x1: 0, y1: 0 })),
  };
  area.placeAt = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z); if (xi < 0 || zi < 0 || xi >= W || zi >= H) return places[P.meadows]; return places[ridx[zi * W + xi]]; };
  area.biomeAt = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z); if (xi < 0 || zi < 0 || xi >= W || zi >= H) return 0; return biome[zi * W + xi]; };
  return area;
}
