// Authored world data. The overworld is painted procedurally from hand-placed regions,
// roads and landmarks; dungeon rooms are authored as ASCII.
import { T } from './tiles.js';
import { fbm, hash2, vnoise } from '../engine/util.js';

class Grid {
  constructor(w, h, fill) { this.w = w; this.h = h; this.t = new Uint8Array(w * h).fill(fill); this.hv = new Float32Array(w * h); this.defs = []; }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.t[y * this.w + x] : T.CLIFF; }
  set(x, y, v) { if (this.in(x, y)) this.t[y * this.w + x] = v; }
  rect(x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, v); }
  ellipse(cx, cy, rx, ry, v, test) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1 && (!test || test(this.get(x, y), x, y, d))) this.set(x, y, v);
    }
  }
  road(pts, width, v, onWater = T.BRIDGE) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
        for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) {
          if (ox * ox + oy * oy > width * width + 0.5) continue;
          const tx = Math.round(x + ox), ty = Math.round(y + oy);
          const cur = this.get(tx, ty);
          if (cur === T.WATER || cur === T.DEEP) this.set(tx, ty, onWater);
          else if (cur !== T.BRIDGE && cur !== T.STONE && cur !== T.PROP) this.set(tx, ty, v);
        }
      }
    }
  }
  def(d) { this.defs.push(d); return d; }
  deco(model, x, y, w, d, extra = {}) { // solid footprint prop
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, T.PROP);
    return this.def({ type: 'deco', model, x: x + w / 2, z: y + d / 2, w, d, ...extra });
  }
}

// ---------------------------------------------------------------- OVERWORLD
export function buildOverworld() {
  const W = 150, H = 110;
  const g = new Grid(W, H, T.GRASS);
  const n = (x, y, s = 0.08, seed = 1) => fbm(x * s, y * s, seed);

  // meadow flowers
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (n(x, y, 0.15, 5) > 0.62) g.set(x, y, T.FLOWERS);

  // Whisperwood (west)
  for (let y = 6; y < 86; y++) for (let x = 0; x < 48; x++) {
    const edge = 40 + n(x, y, 0.1, 3) * 10 - (y > 70 ? (y - 70) * 1.2 : 0);
    if (x < edge) {
      g.set(x, y, T.FOREST);
      const dens = n(x, y, 0.22, 9);
      if (dens > 0.44 && hash2(x, y, 2) > 0.28) g.set(x, y, T.TREE);
    }
  }
  // scattered meadow trees
  for (let y = 10; y < 95; y++) for (let x = 44; x < 120; x++) if (hash2(x, y, 11) > 0.985) g.set(x, y, T.TREE);

  // Mountains (north) and map rim
  for (let x = 0; x < W; x++) {
    const top = 8 + Math.floor(n(x, 0, 0.12, 4) * 6);
    for (let y = 0; y < top; y++) g.set(x, y, T.CLIFF);
  }
  for (let y = 0; y < H; y++) { for (let x = 0; x < 2; x++) g.set(x, y, T.CLIFF); for (let x = W - 2; x < W; x++) g.set(x, y, T.CLIFF); }

  // Sunscald Reach (desert, east)
  for (let y = 40; y < 96; y++) for (let x = 116; x < W - 2; x++) {
    const edge = 120 + n(x, y, 0.12, 21) * 6;
    if (x > edge) {
      g.set(x, y, T.SAND);
      if (n(x, y, 0.2, 23) > 0.66 && !(y > 52 && y < 64)) g.set(x, y, T.SANDSTONE);
    }
  }
  // Cinderpeak (volcanic north-east), sealed by a rock wall with one boulder-choked pass
  for (let y = 0; y < 41; y++) for (let x = 104; x < W; x++) {
    g.set(x, y, T.ASH);
    if (n(x, y, 0.18, 31) > 0.64) g.set(x, y, T.ROCK);
  }
  for (let y = 0; y < 41; y++) { const lx = 124 + Math.sin(y * 0.3) * 4; for (let x = Math.floor(lx - 1); x <= lx + 1; x++) g.set(x, y, T.LAVA); }
  g.ellipse(132, 12, 7, 5, T.LAVA);
  g.ellipse(132, 12, 9, 7, T.ROCK, t => t !== T.LAVA);
  g.ellipse(132, 12, 3, 2, T.LAVA);
  for (let x = 104; x < W; x++) { g.set(x, 40, T.ROCK); g.set(x, 41, T.ROCK); }
  for (let y = 8; y < 42; y++) { g.set(104, y, T.ROCK); g.set(105, y, T.ROCK); }
  for (let y = 36; y < 40; y++) for (let x = 111; x <= 114; x++) g.set(x, y, T.ASH);
  g.set(112, 40, T.ASH); g.set(113, 40, T.ASH); g.set(112, 41, T.ASH); g.set(113, 41, T.ASH);

  // Ocean & coast (south)
  for (let x = 0; x < W; x++) {
    const shore = 95 + Math.floor(n(x, 50, 0.07, 41) * 5);
    for (let y = shore; y < H; y++) g.set(x, y, y > shore + 4 ? T.DEEP : y > shore + 3 ? T.WATER : T.SAND);
  }

  // River Mirrowrun
  const riverX = y => 84 + 5 * Math.sin(y * 0.07) + 2 * Math.sin(y * 0.19);
  for (let y = 6; y < H; y++) {
    const cx = riverX(y);
    for (let x = Math.floor(cx - 2); x <= cx + 2; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d < 1.2) g.set(x, y, T.DEEP); else if (d < 2.1) g.set(x, y, T.WATER);
    }
  }
  // Lake Mirrow with the island shrine
  g.ellipse(106, 72, 13, 9, T.WATER, (t, x, y) => t !== T.SAND || true);
  g.ellipse(106, 72, 10.5, 7, T.DEEP);
  g.ellipse(106, 72, 2.6, 2.2, T.GRASS);

  // Whisperwood clearing: Rootwell Hollow
  g.ellipse(17, 29, 7, 6, T.FOREST);
  g.ellipse(17, 31, 4, 3, T.MOSS);
  // Grotto clearing
  g.ellipse(29, 17, 5, 4, T.FOREST);
  g.rect(24, 8, 34, 13, T.CLIFF);
  // Chime Gate plateau
  g.ellipse(74, 14, 8, 6, T.STONE);
  g.rect(70, 4, 78, 9, T.CLIFF);

  // Hush camp (east field across north bridge)
  g.ellipse(96, 28, 7.5, 7, T.PATH);
  for (let a = 0; a < 64; a++) {
    const ang = a / 64 * Math.PI * 2;
    if (Math.abs(ang - Math.PI) < 0.3) continue; // west opening
    const x = Math.round(96 + Math.cos(ang) * 7.5), y = Math.round(28 + Math.sin(ang) * 7);
    g.set(x, y, T.PROP);
  }

  // Village Thimblewick
  g.ellipse(58, 59, 13, 11, T.GRASS, t => t !== T.WATER && t !== T.DEEP);
  g.ellipse(58, 58, 5, 4.5, T.STONE);

  // Roads
  g.road([[58, 62], [58, 70], [59, 82], [60, 94]], 1, T.PATH);                      // south to pier
  g.road([[58, 54], [60, 44], [66, 30], [72, 20], [74, 16]], 1, T.PATH);              // north to gate
  g.road([[53, 58], [44, 56], [34, 48], [26, 40], [19, 34]], 1, T.PATH);              // west into forest
  g.road([[63, 58], [76, 57], [92, 55], [114, 53], [124, 56], [132, 60]], 1, T.PATH); // east to desert
  g.road([[64, 36], [78, 31], [92, 30], [96, 33]], 1, T.PATH);                        // to camp
  g.road([[26, 40], [29, 26], [29, 19]], 1, T.FOREST);                               // forest trail to grotto
  g.road([[114, 53], [113, 44]], 1, T.ASH);                              // volcano pass
  g.road([[76, 57], [80, 66], [88, 75], [92, 76]], 1, T.PATH);                        // lakeside path

  // Pier
  g.rect(59, 94, 61, 94, T.PATH);
  for (let y = 95; y < 104; y++) { g.set(60, y, T.DOCK); g.set(61, y, T.DOCK); }
  g.rect(58, 103, 63, 104, T.DOCK);
  // rocks framing the pier path (so the boulder can block it)
  for (let x = 50; x <= 70; x++) if (x !== 60) g.set(x, 92, T.ROCK);
  g.rect(56, 93, 64, 94, T.SAND); g.rect(59, 93, 61, 94, T.PATH);

  // ---------- Landmarks & props ----------
  g.deco('hollowtree', 15, 25, 5, 4);
  g.def({ type: 'warp', x: 17.5, z: 29.6, r: 0.8, to: 'dungeon', spawn: 'entrance', label: 'Rootwell Hollow' });
  g.def({ type: 'sign', x: 20.5, z: 31.5, text: 'ROOTWELL HOLLOW\nThe old roots breathe here. Mind your step.' });

  // Village buildings
  g.deco('belltower', 57, 55, 2, 2);
  g.def({ type: 'bell', x: 58, z: 56 });
  g.deco('house', 50, 54, 3, 3, { roof: 0xc0503a });
  g.deco('shop', 50, 61, 4, 3, { roof: 0x3a7ac0 });
  g.deco('house', 63, 51, 4, 3, { roof: 0x8a5ac0, big: true });
  g.deco('house', 64, 62, 3, 3, { roof: 0xd0903a });
  g.deco('house', 54, 66, 3, 3, { roof: 0x4aa05a });
  g.deco('windmill', 46, 50, 2, 2);
  g.def({ type: 'windmill', x: 47, z: 51 });
  g.deco('well', 61, 60, 1, 1);
  g.deco('board', 62, 63, 1, 1);
  g.def({ type: 'board', x: 62.5, z: 64.3 });
  g.deco('house', 55, 90, 3, 2, { roof: 0x5a8ab0, small: true });
  for (const [x, y] of [[47, 55], [48, 55], [47, 60], [48, 60], [67, 55], [68, 55], [67, 61], [68, 61]]) g.deco('fence', x, y, 1, 1);
  g.def({ type: 'sign', x: 70.5, z: 59.5, text: 'THIMBLEWICK\n"Small folk, loud bell."' });
  g.def({ type: 'sign', x: 58.5, z: 71.5, text: 'South: Ada\'s pier  ·  West: Whisperwood  ·  North: the Chime Gate  ·  East: bridge to the Reach' });

  // Chime Gate
  g.deco('chimegate', 71, 8, 7, 2);
  g.def({ type: 'gate', x: 74.5, z: 10.5 });
  g.def({ type: 'sign', x: 69.5, z: 13.5, text: 'THE CHIME GATE\nThree voices sealed it. Three voices will open it.' });

  // Grotto door + pinwheel
  g.set(29, 13, T.FOREST);
  g.def({ type: 'door', id: 'grotto-door', x: 29.5, z: 13.5, orient: 'h', kind: 'stone', signal: 'ow.grottowind', single: true });
  g.def({ type: 'pinwheel', x: 32.5, z: 16.5, signal: 'ow.grottowind', latch: true });
  g.def({ type: 'warp', x: 29.5, z: 13.2, r: 0.5, to: 'grotto', spawn: 'entrance', label: 'Hollow Grotto' });
  g.def({ type: 'sign', x: 26.5, z: 16.5, text: 'A stone door. Carved above it: a pinwheel, and the words "Only the wind may knock."' });

  // Volcano pass boulders (future: blast powder)
  g.def({ type: 'boulder', x: 112.5, z: 40.5 });
  g.def({ type: 'boulder', x: 113.5, z: 40.5 });
  g.def({ type: 'sign', x: 110.5, z: 43.5, text: 'CINDERPEAK PASS — CLOSED\nRockfall. The Ember Chime\'s song echoes somewhere beyond.\n(Something explosive might clear this… one day.)' });
  // Lake shrine (future)
  g.deco('shrine', 105, 71, 2, 2);
  g.def({ type: 'sign', x: 93.5, z: 66.5, text: 'LAKE MIRROW\nOn the island, the Tide Shrine hums a note no one on shore can sing.\n(No way across… yet.)' });

  // Desert ruin: walled courtyard choked with sand drifts
  g.rect(128, 64, 138, 74, T.SANDSTONE);
  g.rect(129, 65, 137, 73, T.SAND);
  g.set(133, 64, T.SAND); g.set(133, 63, T.SAND); g.set(132, 64, T.SAND); g.set(134, 64, T.SAND);
  g.def({ type: 'drift', x: 133.5, z: 63.5 }); g.def({ type: 'drift', x: 132.5, z: 64.5 }); g.def({ type: 'drift', x: 133.5, z: 64.5 }); g.def({ type: 'drift', x: 134.5, z: 64.5 });
  g.def({ type: 'chest', id: 'ruin-chest', x: 133.5, z: 70.5, contents: { kind: 'heart' } });
  g.def({ type: 'sign', x: 130.5, z: 68.5, text: 'A worn tablet:\n"We, the Bellwrights, parted the Voices so the Last Toll could never be struck. Forgive us, little ones."' });
  g.def({ type: 'sign', x: 126.5, z: 61.5, text: 'SUNKEN COURTYARD\nThe dunes have swallowed the gate. A strong wind might uncover it.' });

  // Hush camp bounty
  g.def({ type: 'camp', x: 96, z: 28 });
  g.deco('tent', 94, 24, 2, 2); g.deco('tent', 98, 25, 2, 2);

  // Pier quest boulder + fisher
  g.set(60, 92, T.PATH);
  g.def({ type: 'block', id: 'pier-block', x: 60.5, z: 92.5, sinks: true });

  // NPCs
  g.def({ type: 'npc', id: 'tamsin', name: 'Elder Tamsin', x: 60.5, z: 57.5, look: 'elder' });
  g.def({ type: 'npc', id: 'posy', name: 'Posy', x: 52.5, z: 64.6, look: 'shop', shop: true });
  g.def({ type: 'npc', id: 'oswin', name: 'Miller Oswin', x: 49.5, z: 53.5, look: 'miller' });
  g.def({ type: 'npc', id: 'brisk', name: 'Captain Brisk', x: 69.5, z: 58.2, look: 'guard' });
  g.def({ type: 'npc', id: 'ada', name: 'Fisher Ada', x: 58.5, z: 89.5, look: 'fisher' });
  g.def({ type: 'npc', id: 'fennel', name: 'Fennel', x: 55.5, z: 59.5, look: 'kid', wander: 3 });
  g.def({ type: 'npc', id: 'hermit', name: 'Root Hermit', x: 22.5, z: 34.5, look: 'hermit' });

  // Breakables & secrets
  const bushSpots = [];
  for (let y = 10; y < 95; y++) for (let x = 3; x < 146; x++) {
    const t = g.get(x, y);
    if ((t === T.GRASS || t === T.FLOWERS || t === T.FOREST) && hash2(x, y, 51) > 0.972) bushSpots.push([x, y]);
  }
  for (const [x, y] of bushSpots) {
    if (Math.hypot(x - 58, y - 58) < 6) continue;
    g.def({ type: 'bush', x: x + 0.5, z: y + 0.5 });
  }
  for (let y = 10; y < 95; y++) for (let x = 3; x < 146; x++) {
    const t = g.get(x, y);
    if ((t === T.GRASS || t === T.FLOWERS) && hash2(x, y, 57) > 0.93) g.def({ type: 'tuft', x: x + 0.5, z: y + 0.5 });
  }
  const leaves = [[12, 45, 'pips20'], [36, 30, 'pips5'], [8, 62, 'heart'], [40, 70, 'pips20'], [76, 44, 'pips5'], [89, 88, 'pips20'], [140, 88, 'pips50'], [120, 48, 'pips20'], [25, 76, 'pips5'], [70, 86, 'pips5']];
  for (const [x, y, r] of leaves) { g.set(x, y, g.get(x, y) === T.TREE ? T.FOREST : g.get(x, y)); g.def({ type: 'leafpile', x: x + 0.5, z: y + 0.5, reveal: r, sand: x > 118 }); }

  // Enemies (overworld)
  const E = (kind, x, y) => g.def({ type: 'enemy', kind, x: x + 0.5, z: y + 0.5 });
  [[30, 42], [31, 44], [28, 43]].forEach(p => E('blot', ...p));
  [[22, 52], [24, 53], [21, 54], [23, 50]].forEach(p => E('blot', ...p));
  E('puffer', 34, 36); E('puffer', 12, 42);
  E('wisp', 10, 22); E('wisp', 13, 18); E('wisp', 36, 22);
  E('beetle', 76, 42); E('beetle', 72, 38); E('blot', 70, 76); E('blot', 72, 77); E('blot', 69, 78);
  E('puffer', 78, 86); E('blot', 88, 60); E('blot', 90, 62);
  E('beetle', 126, 58); E('beetle', 136, 80); E('puffer', 130, 52); E('puffer', 140, 70); E('blot', 125, 86); E('blot', 127, 88);
  E('wisp', 96, 82); E('wisp', 116, 84); E('knight', 44, 36);
  // Pass 2 zone monsters
  [[128, 48], [134, 54], [140, 62], [124, 70], [138, 78], [130, 86], [143, 90], [122, 60]].forEach(p => E('scorpion', ...p));
  [[118, 44], [122, 43], [126, 45], [108, 46], [114, 47]].forEach(p => E('imp', ...p));
  [[92, 64], [96, 80], [110, 83], [118, 70], [100, 60], [114, 60]].forEach(p => E('wraith', ...p));
  [[84, 54], [96, 53], [104, 51], [70, 30], [80, 29], [88, 72]].forEach(p => E('brigand', ...p));
  [[16, 48], [17, 49], [15, 50], [8, 30], [9, 31], [30, 60], [31, 61], [29, 62], [36, 76], [12, 70]].forEach(p => E('sporeling', ...p));
  E('treant', 10, 56); E('treant', 34, 12); E('treant', 22, 70);
  E('golem', 68, 12); E('golem', 80, 13);
  E('brigand', 60, 84); E('brigand', 64, 86);

  // Loot chests: [x, y, tier, level]. Each snaps to the nearest open tile.
  const CHESTS = [
    [8, 38, 0, 3], [14, 58, 1, 3], [34, 20, 1, 4], [5, 75, 2, 4], [38, 64, 0, 3], [24, 44, 0, 3], [11, 14, 2, 4],
    [66, 78, 0, 2], [48, 82, 0, 2], [74, 48, 0, 2], [52, 40, 1, 2], [70, 22, 1, 5],
    [98, 50, 1, 5], [110, 62, 1, 5], [118, 80, 2, 6], [92, 86, 0, 4],
    [100, 30, 2, 6], [88, 40, 1, 5],
    [124, 50, 1, 7], [142, 58, 2, 7], [138, 84, 1, 7], [128, 92, 0, 6], [144, 76, 2, 8],
    [20, 96, 0, 3], [40, 94, 1, 3], [86, 97, 1, 4], [110, 96, 0, 4], [132, 97, 2, 6],
  ];
  const openTile = t => t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.SAND || t === T.PATH || t === T.ASH || t === T.STONE;
  CHESTS.forEach(([cx, cy, tier, level], i) => {
    for (let r = 0; r < 6; r++) {
      let found = null;
      for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
        const x = cx + dx, y = cy + dy;
        if (openTile(g.get(x, y)) && openTile(g.get(x, y + 1)) && openTile(g.get(x + 1, y)) && openTile(g.get(x - 1, y))) found = [x, y];
      }
      if (found) { g.def({ type: 'lootchest', id: 'ow-lc' + i, x: found[0] + 0.5, z: found[1] + 0.5, tier, level }); return; }
    }
  });

  // spawn points
  const spawns = {
    start: { x: 58.5, z: 62.5 }, village: { x: 58.5, z: 62.5 }, dungeon: { x: 17.5, z: 31.2 }, grotto: { x: 29.5, z: 14.8 },
  };
  // Heights: cliffs and rocks get varied tiers so ridges read as landforms
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = g.get(x, y);
    let h = 0;
    if (t === T.CLIFF) h = 1.4 + Math.floor(vnoise(x * 0.25, y * 0.25, 8) * 3) * 0.6 + (y < 5 ? (5 - y) * 0.5 : 0);
    else if (t === T.ROCK) h = 1.2 + Math.floor(vnoise(x * 0.3, y * 0.3, 9) * 3) * 0.5;
    else if (t === T.SANDSTONE) h = 1.0 + Math.floor(vnoise(x * 0.3, y * 0.3, 10) * 2) * 0.6;
    else h = null;
    g.hv[y * W + x] = h === null ? NaN : h;
  }
  return {
    id: 'overworld', name: 'Lanternreach', w: W, h: H, tiles: g.t, hv: g.hv, defs: g.defs, spawns, dungeon: false,
    music: 'field', sky: 0x8fc8e8, fog: 0xb8d8e8, sun: 0xfff0d0, amb: 0x9ab0d0, ground: 0x6a8a4a,
    regions: [
      { name: 'Thimblewick', x0: 45, y0: 47, x1: 72, y1: 72, music: 'village', level: 1 },
      { name: 'Whisperwood', x0: 0, y0: 6, x1: 42, y1: 86, level: 3 },
      { name: 'Sunscald Reach', x0: 118, y0: 42, x1: 150, y1: 96, level: 7 },
      { name: 'Cinderpeak Foothills', x0: 104, y0: 0, x1: 150, y1: 42, level: 9 },
      { name: 'Hush Encampment', x0: 88, y0: 20, x1: 104, y1: 36, music: 'camp', level: 6 },
      { name: 'Lake Mirrow', x0: 90, y0: 60, x1: 122, y1: 84, level: 5 },
      { name: 'Chime Gate', x0: 64, y0: 6, x1: 84, y1: 20, level: 6 },
      { name: 'Saltwhistle Shore', x0: 0, y0: 88, x1: 150, y1: 110, level: 3 },
      { name: 'Lanternreach Meadows', x0: 0, y0: 0, x1: 150, y1: 110, level: 2 },
    ],
  };
}

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
    '...m...........',
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
    '..t.m.......t..',
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
