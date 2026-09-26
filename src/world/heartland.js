// Pass 6: the old overworld, unchanged, as the heart of the new world.
import { T } from './tiles.js';
import { fbm, hash2, vnoise } from '../engine/util.js';
import { Grid } from './grid.js';

// ---------------------------------------------------------------- THE HEARTLAND
// The original 150x110 Lanternreach map, painted exactly as it always was into its own grid.
// Pass 6 places it at HEART inside the much larger world (see overworld.js), so every tile,
// puzzle and quest in it keeps its shape.
export function paintHeartland() {
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

  // The Cracked Conservatory: a clearing north-west of the village, the glass dome visible
  // over the treeline from the west road
  g.ellipse(45, 41, 8, 6, T.GRASS, t => t !== T.WATER && t !== T.DEEP);
  g.ellipse(45, 43.5, 3, 1.6, T.STONE);
  // Mirewhistle Fen: ankle-deep water in the south-west wood, home of something with a crown
  g.ellipse(22, 85, 12, 7.5, T.FOREST, t => t !== T.WATER && t !== T.DEEP && t !== T.SAND);
  g.ellipse(22, 85, 9, 5.2, T.SHALLOW, t => t !== T.WATER && t !== T.DEEP && t !== T.SAND);
  for (const [x, y] of [[16, 80], [28, 81], [14, 89], [30, 89]]) g.ellipse(x, y, 1.6, 1.2, T.MOSS);

  // Village Thimblewick. World pass: a larger, cohesive town grown around the same centre (the
  // bell, Bellstone, Tamsin, Posy, the bench and Brisk's yard keep their places), so services
  // stay close together and every old reference to the square stays valid.
  g.ellipse(58, 63, 21.5, 20.5, T.GRASS, t => t !== T.WATER && t !== T.DEEP);
  g.ellipse(58, 58.5, 7.5, 6, T.STONE); // the Bell Tree plaza

  // Roads
  g.road([[58, 62], [58, 70], [59, 82], [60, 94]], 1, T.PATH);                      // south to pier
  g.road([[58, 54], [60, 44], [66, 30], [72, 20], [74, 16]], 1, T.PATH);              // north to gate
  g.road([[53, 58], [44, 56], [34, 48], [26, 40], [19, 34]], 1, T.PATH);              // west into forest
  g.road([[63, 58], [76, 57], [92, 55], [114, 53], [124, 56], [132, 60]], 1, T.PATH); // east to desert
  g.road([[64, 36], [78, 31], [92, 30], [96, 33]], 1, T.PATH);                        // to camp
  g.road([[26, 40], [29, 26], [29, 19]], 1, T.FOREST);                               // forest trail to grotto
  g.road([[114, 53], [113, 44]], 1, T.ASH);                              // volcano pass
  g.road([[76, 57], [80, 66], [88, 75], [92, 76]], 1, T.PATH);                        // lakeside path
  g.road([[34, 48], [32, 62], [28, 72], [24, 78]], 1, T.FOREST);                      // woodland trail to the fen

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

  // The Cracked Conservatory
  g.deco('glasshouse', 41, 36, 8, 6);
  g.def({ type: 'warp', x: 45.5, z: 42.3, r: 0.6, to: 'conservatory', spawn: 'entrance', label: 'The Cracked Conservatory' });
  g.def({ type: 'sign', x: 42.5, z: 44.5, text: 'THE CONSERVATORY OF VOICES\nThe glass is cracked and something inside keeps mending it.\n(A place for the brave — and for those who carry the Gustbellows.)' });
  g.def({ type: 'sign', x: 26.5, z: 78.5, text: 'MIREWHISTLE FEN\nCarved on a lily-shaped stone:\n"Ring the three lilies, and the Crown will answer."' });
  for (const [i, [x, z]] of [[15.5, 85.5], [28.5, 85.5], [22.5, 80.5]].entries()) g.def({ type: 'hangbell', x, z, group: 'fen', pitch: i, lily: true });
  g.def({ type: 'bellseq', group: 'fen', order: null, signal: 'fen.rung', transient: true });
  g.def({ type: 'crowntoad', x: 22.5, z: 86.5 });

  // Village buildings
  g.deco('belltreegrand', 57, 55, 2, 2);
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
  g.deco('riftstone', 65, 55, 1, 1);
  g.def({ type: 'riftstone', x: 65.5, z: 56.4 });
  g.def({ type: 'board', x: 62.5, z: 64.3 });
  g.def({ type: 'bellstone', x: 56.5, z: 60.5, spawn: 'village', name: 'Thimblewick' });
  g.def({ type: 'workbench', x: 55.3, z: 64.8 });
  g.def({ type: 'tollrack', x: 53.5, z: 56.5 }); // appears once the Silent Toll is finished
  g.def({ type: 'millyard', x: 50.5, z: 51.2 });

  // Thimblewick arrival: open sightline from the bell tree into the square.
  g.ellipse(59, 68.5, 3.6, 3.2, T.PATH, t => t !== T.PROP);
  g.road([[58,71],[58,65],[58,60]], 1, T.STONE);
  // East practice yard. Keep house footprints intact and leave both entrances open.
  g.ellipse(71,66,4.6,4.4,T.PATH,t=>t!==T.PROP);
  g.road([[59,65],[63,65],[67,66],[71,66]],1,T.PATH);
  g.deco('belltree',61,68,1,1);
  g.deco('villagebench',59,70,2,1);
  g.deco('handcart',64,69,2,1);
  g.deco('herbbed',52,58,2,1);
  g.deco('herbbed',54,58,1,1);
  g.deco('practiceRack',73,62,1,1);
  for(const [x,z] of [[75,63],[75,65],[75,67],[70,70],[72,70]])g.deco('fence',x,z,1,1);
  for(const [x,z] of [[57,70],[60,66],[67,67],[73,68]])if(g.get(x,z)!==T.PROP)g.deco('lamppost',x,z,1,1);
  g.def({type:'villageTarget',x:71,z:64.5});
  g.def({type:'villageTarget',x:73,z:65.5});
  g.def({type:'welcomeChest',x:69,z:68.5});
  g.def({type:'sign',x:67.5,z:68.5,text:'BRISK’S PRACTICE YARD\nStraw targets, patient teaching. No fee.\nSpeak to Brisk to learn, skip or replay the basics.'});
  g.def({type:'sign',x:60.5,z:64.5,text:'THIMBLEWICK — THE BELL TREE SQUARE\nWest: Market Row, Posy’s shop and bench\nNorth: the terraces, the root arch, the Chime Gate road\nEast: Brisk’s practice yard, the bridge to the Reach\nSouth: the lantern lane and the brook · M: map · J: journal'});

  // ---- World pass: the new Thimblewick districts
  thimblewick7(g);

  // The Echo Glade, east of Rootwell Hollow: two short-lived pinwheels with a hedge between.
  // Walking around the hedge takes longer than one pinwheel spins, so only a gust that
  // repeats itself (the Verdant Chime's echo) keeps the first one turning.
  for (let z = 27; z <= 33; z++) for (let x = 27; x <= 37; x++) g.set(x, z, T.GRASS);
  for (let x = 26; x <= 38; x++) g.set(x, 26, T.ROCK);
  for (let z = 27; z <= 32; z++) g.set(32, z, T.TREE);
  for (let z = 23; z <= 25; z++) { g.set(34, z, T.ROCK); g.set(38, z, T.ROCK); }
  for (let x = 34; x <= 38; x++) g.set(x, 23, T.ROCK);
  for (let z = 24; z <= 25; z++) for (let x = 35; x <= 37; x++) g.set(x, z, T.STONE);
  g.set(36, 26, T.STONE);
  g.def({ type: 'pinwheel', x: 29.5, z: 28.5, signal: 'echo.a', latch: false, time: 1.0 });
  g.def({ type: 'pinwheel', x: 35.5, z: 28.5, signal: 'echo.b', latch: false, time: 1.0 });
  g.def({ type: 'pingroup', a: 'echo.a', b: 'echo.b', signal: 'ow.echo' });
  g.def({ type: 'door', id: 'echo-door', x: 36.5, z: 26.5, orient: 'h', kind: 'stone', signal: 'ow.echo', single: true });
  g.def({ type: 'chest', id: 'echo-chest', x: 36.5, z: 24.5, contents: { kind: 'echo' } });
  g.def({ type: 'sign', x: 27.5, z: 31.5, text: 'THE ECHO DOOR\nTwo pinwheels, a hedge between them. Carved in the stone:\n"What the wind says once, the Hollow says twice."' });
  g.def({ type: 'sign', x: 35.5, z: 24.5, text: 'A Bellwright tablet:\n"We taught the Voices to repeat, so that no sound in Lanternreach would ever be lost.\nWe did not ask where the lost ones went. Now we know. They went to the Hush."' });
  g.deco('house', 55, 90, 3, 2, { roof: 0x5a8ab0, small: true });
  for (const [x, y] of [[47, 55], [48, 55], [47, 60], [48, 60], [67, 55], [68, 55], [67, 61], [68, 61]]) g.deco('fence', x, y, 1, 1);
  g.def({ type: 'sign', x: 70.5, z: 59.5, text: 'THIMBLEWICK\n"Small folk, loud bell."' });
  g.def({ type: 'sign', x: 56.2, z: 71.5, text: 'South: Ada\'s pier  ·  West: Whisperwood  ·  North: the Chime Gate  ·  East: bridge to the Reach' });

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
  g.def({ type: 'npc', id: 'brisk', name: 'Captain Brisk', x: 68.5, z: 65.5, look: 'guard' });
  g.def({ type: 'npc', id: 'ada', name: 'Fisher Ada', x: 58.5, z: 89.5, look: 'fisher' });
  g.def({ type: 'npc', id: 'fennel', name: 'Fennel', x: 55.5, z: 59.5, look: 'kid', wander: 3 });
  g.def({ type: 'npc', id: 'hermit', name: 'Root Hermit', x: 22.5, z: 34.5, look: 'hermit' });

  // Lantern posts along Thimblewick's lanes: grass tiles beside the plaza/paths, spaced out,
  // clear of everything else. Each becomes a one-tile deco like the other village props.
  {
    const placed = [];
    const busy = (x, y) => g.defs.some(d => d.x !== undefined && Math.abs(d.x - (x + 0.5)) < 1.6 && Math.abs(d.z - (y + 0.5)) < 1.6);
    for (let y = 44; y < 87; y++) for (let x = 38; x < 78; x++) {
      if (g.get(x, y) !== T.GRASS) continue;
      let byPath = false, clear = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = g.get(x + dx, y + dy); if (t === T.PATH || t === T.STONE) byPath = true; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.get(x + dx, y + dy) === T.PROP || g.get(x + dx, y + dy) === T.WATER) clear = false;
      if (!byPath || !clear || busy(x, y) || placed.some(([px, py]) => Math.hypot(px - x, py - y) < 6.5)) continue;
      placed.push([x, y]); g.deco('lamppost', x, y, 1, 1);
      if (placed.length >= 22) break;
    }
  }

  // painted after the lanterns so the village's lamp posts stay exactly where they were
  g.road([[44, 56], [45, 50], [45, 44]], 1, T.PATH);                                  // to the Conservatory

  // ---- Pass 5 composed landmarks. Each checks its footprint so it never blocks a road.
  {
    const open = t => t === T.GRASS || t === T.FLOWERS || t === T.FOREST || t === T.TREE;
    const fits = (x, y, w, d) => { for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) if (!open(g.get(x + i, y + j))) return false; return !g.defs.some(q => q.x !== undefined && q.x > x - 1 && q.x < x + w + 1 && q.z > y - 1 && q.z < y + d + 1); };
    const place = (model, x, y, w, d, extra = {}) => { if (fits(x, y, w, d)) { g.deco(model, x, y, w, d, extra); return true; } return false; };
    // the village sits under a root the size of a street; only its feet are solid
    g.def({ type: 'landmark', model: 'rootarch', x: 58, z: 46.6, w: 22, d: 2 });
    for (const [x, y] of [[46, 46], [47, 46], [69, 46], [70, 46]]) if (open(g.get(x, y))) g.set(x, y, T.PROP);
    // a lost garden trowel bridges the Mirrowrun north of the east road
    const ry = 44, rx = Math.round(84 + 5 * Math.sin(ry * 0.07) + 2 * Math.sin(ry * 0.19));
    for (let x = rx - 3; x <= rx + 3; x++) { if (g.get(x, ry) === T.WATER || g.get(x, ry) === T.DEEP) g.set(x, ry, T.BRIDGE); }
    g.def({ type: 'landmark', model: 'trowelbridge', x: rx + 0.5, z: ry + 0.5, w: 9, d: 1.4, y: 0.02 });
    // a spool that rolled into Whisperwood, still trailing its thread
    for (const [x, y] of [[20, 58], [18, 60], [22, 56], [16, 62], [26, 56], [12, 50], [28, 52]]) if (place('bigspool', x, y, 2, 2)) { g.def({ type: 'landmark', model: 'threadline', x: x + 4, z: y + 1.4, w: 6, d: 0.2, ry: 0.3 }); break; }
    // porcelain ruins before the glasshouse
    [[38, 38, 0.2], [52, 41, -0.3], [39, 45, 0.5], [51, 36, 0.1]].forEach(([x, y, tilt]) => place('shard', x, y, 2, 1, { tilt }));
    // a teacup the size of a house beside the stream, south of the east road
    for (const [x, y] of [[78, 62], [77, 64], [79, 66], [74, 66], [72, 70], [88, 64], [90, 58]]) if (place('bigteacup', x, y, 3, 3)) break;
  }

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
  E('beetle', 76, 42); E('beetle', 72, 38); E('blot', 40, 89); E('blot', 42, 90); E('blot', 39, 91);
  E('puffer', 78, 86); E('blot', 88, 60); E('blot', 90, 62);
  E('beetle', 126, 58); E('beetle', 136, 80); E('puffer', 130, 52); E('puffer', 140, 70); E('blot', 125, 86); E('blot', 127, 88);
  E('wisp', 96, 82); E('wisp', 116, 84); E('knight', 52, 33);
  // Pass 2 zone monsters
  [[128, 48], [134, 54], [140, 62], [124, 70], [138, 78], [130, 86], [143, 90], [122, 60]].forEach(p => E('scorpion', ...p));
  [[118, 44], [122, 43], [126, 45], [108, 46], [114, 47]].forEach(p => E('imp', ...p));
  [[92, 64], [96, 80], [110, 83], [118, 70], [100, 60], [114, 60]].forEach(p => E('wraith', ...p));
  [[84, 54], [96, 53], [104, 51], [70, 30], [80, 29], [88, 72]].forEach(p => E('brigand', ...p));
  [[16, 48], [17, 49], [15, 50], [8, 30], [9, 31], [30, 60], [31, 61], [29, 62], [36, 76], [12, 70]].forEach(p => E('sporeling', ...p));
  E('treant', 10, 56); E('treant', 34, 12); E('treant', 22, 70);
  E('golem', 68, 12); E('golem', 80, 13);
  E('brigand', 77, 94); E('brigand', 81, 95);
  // Pass 5 creatures in the wild
  E('porcelain', 42, 46); E('moth', 49, 44); E('moth', 39, 42); E('mantis', 36, 40);
  E('mantis', 14, 64); E('mantis', 30, 70); E('slug', 98, 38); E('slug', 110, 45); E('moth', 100, 70); E('moth', 112, 66);
  E('leech', 70, 18); E('leech', 78, 20); E('mantis', 26, 88); E('slug', 17, 90);

  // Loot chests: [x, y, tier, level]. Each snaps to the nearest open tile.
  const CHESTS = [
    [8, 38, 0, 3], [14, 58, 1, 3], [34, 20, 1, 4], [5, 75, 2, 4], [38, 64, 0, 3], [24, 44, 0, 3], [11, 14, 2, 4], [33, 88, 2, 8], [50, 38, 1, 5],
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
    start: { x: 58.5, z: 85.2 }, village: { x: 58.5, z: 62.5 }, rootlift: { x: 45.5, z: 71.4 }, arrival: { x: 58.5, z: 85.2 }, dungeon: { x: 17.5, z: 31.2 }, grotto: { x: 29.5, z: 14.8 },
    conservatory: { x: 45.5, z: 43.6 }, fen: { x: 22.5, z: 93 },
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
  thimbleHeights(g);
  return {
    grid: g,
    id: 'overworld', name: 'Lanternreach', w: W, h: H, tiles: g.t, hv: g.hv, defs: g.defs, spawns, dungeon: false,
    music: 'field', sky: 0x8fc8e8, fog: 0xb8d8e8, sun: 0xfff0d0, amb: 0x9ab0d0, ground: 0x6a8a4a,
    regions: [
      { name: 'Thimblewick', x0: 36, y0: 43, x1: 80, y1: 88, music: 'village', level: 1 },
      { name: 'Conservatory Grounds', x0: 35, y0: 33, x1: 54, y1: 47, level: 5 },
      { name: 'Mirewhistle Fen', x0: 8, y0: 76, x1: 36, y1: 94, level: 8 },
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

// ---------------------------------------------------------------- the new Thimblewick
// Heartland-local coordinates. Districts: the Bell Tree plaza (centre, unchanged services),
// Market Row (west), the Terraces (north-east, raised), the Lantern Lane and Thimble Brook
// (south), Brisk's yard (east, unchanged), the Hedge Garden at the wood's edge (south-west,
// with the hidden Herb Nook and the Root Lift) and the arrival hill beyond the footbridge.
function thimblewick7(g) {
  const WALK = new Set([T.GRASS, T.FLOWERS, T.FOREST, T.PATH, T.STONE, T.TREE]);
  // lanes (stone) radiating from the plaza
  g.road([[58, 52], [58, 47]], 1, T.STONE);                 // North Lane, under the root arch
  g.road([[51, 59.5], [43, 60]], 1, T.STONE);               // Market Row
  g.road([[58, 71], [58, 80], [58.5, 87]], 1, T.STONE);     // the Lantern Lane down to the arrival hill
  g.road([[62, 55], [64, 52], [68, 50], [73, 50]], 0, T.PATH); // up onto the Terraces
  g.road([[48, 64], [44, 65]], 0, T.PATH);                   // into the Hedge Garden
  // the Hedge Garden clearing at the wood's edge, and the hidden Herb Nook behind its hedge
  for (let y = 60; y <= 73; y++) for (let x = 36; x <= 47; x++) if (WALK.has(g.get(x, y))) g.set(x, y, (x + y) % 5 ? T.GRASS : T.FLOWERS);
  for (let y = 61; y <= 67; y++) for (let x = 32; x <= 35; x++) g.set(x, y, T.TREE);
  for (let y = 62; y <= 65; y++) for (let x = 33; x <= 35; x++) g.set(x, y, T.GRASS);
  g.ellipse(39.5, 67.2, 2.2, 1.5, T.WATER); // the spring pool
  g.deco('hedge', 37, 61, 9, 1); g.deco('hedge', 37, 62, 1, 2); g.deco('hedge', 37, 65, 1, 5);
  g.set(37, 64, T.GRASS); g.def({ type: 'bush', x: 37.5, z: 64.5, big: true }); // the gap, grown over
  g.def({ type: 'chest', id: 'tw-herbnook', x: 34.5, z: 63.5, contents: { kind: 'pips', n: 150 } });
  g.def({ type: 'sign', x: 34.5, z: 65.5, text: 'Scratched on a flowerpot:\n"Fennel\'s hiding place. KEEP OUT (this means you, Brisk)."' });
  g.deco('gazebo', 42, 62, 3, 3, { roof: 0x5a8a9a });
  g.deco('villagebench', 39, 62, 2, 1);
  g.deco('herbbed', 45, 66, 2, 1); g.deco('herbbed', 45, 68, 2, 1);
  g.deco('rootlift', 43, 69, 2, 2);
  g.def({ type: 'rootlift', x: 44, z: 71.2, id: 'w7-rootlift' });
  g.def({ type: 'sign', x: 40.5, z: 71.5, text: 'THE HEDGE GARDEN\nPlanted by the first Thimblewick folk, under the old root.\nA rusted lift cage is wound into the roots. Its lever is on the far side — somewhere below.' });
  // Thimble Brook: from the spring pool, south and east under the Lantern Lane to the Mirrowrun
  const brook = [[40, 69], [41, 73], [47, 74.5], [52, 75], [58, 75.5], [64, 76], [70, 76.8], [75, 77.3], [81, 77.8]];
  for (let i = 0; i < brook.length - 1; i++) {
    const [ax, ay] = brook[i], [bx, by] = brook[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (Math.hypot(ox, oy) > 1.05) continue;
        const tx = Math.round(x + ox), ty = Math.round(y + oy), cur = g.get(tx, ty);
        if (cur === T.PROP || cur === T.WATER || cur === T.DEEP) continue;
        g.set(tx, ty, cur === T.STONE || cur === T.PATH || cur === T.BRIDGE ? T.BRIDGE : T.SHALLOW);
      }
    }
  }
  g.def({ type: 'landmark', model: 'footbridge', x: 58.5, z: 75.6, w: 3.6, d: 3, ry: Math.PI / 2 });
  // stepping stones where the garden path meets the brook
  for (const [x, y] of [[41, 72], [42, 73]]) g.set(x, y, T.STONE);
  // Market Row: stalls either side of the lane, the shop and bench at its east end
  g.deco('marketstall', 43, 57, 2, 1, { awning: 0xc0503a, goods: 'veg' });
  g.deco('marketstall', 46, 57, 2, 1, { awning: 0xd0903a, goods: 'pots' });
  g.deco('marketstall', 44, 62, 2, 1, { awning: 0x3a7ac0, goods: 'cloth' });
  g.deco('marketstall', 47, 62, 2, 1, { awning: 0x5a9a5a, goods: 'fish' });
  g.deco('barrels', 49, 57, 1, 1);
  g.def({ type: 'sign', x: 42.5, z: 59.5, text: 'MARKET ROW\nFresh roots · pots mended · cloth by the thimble.\n(The stall-keepers are out on the fields; Posy\'s shop is open all hours.)' });
  // the Terraces: homes stepped up the slope under the root arch
  g.deco('house', 64, 44, 3, 2, { roof: 0x5a8ab0, small: true });
  g.deco('house', 66, 48, 3, 2, { roof: 0x8ab04a, small: true });
  g.deco('house', 70, 48, 3, 3, { roof: 0xc05a6a });
  g.deco('planter', 68, 52, 2, 1); g.deco('planter', 61, 47, 2, 1);
  g.def({ type: 'sign', x: 72.5, z: 51.5, text: 'THE TERRACES\nMind the steps. Mind the washing. Mind Mrs. Pomm\'s cat.' });
  // the Lantern Lane: cottages, window boxes and a welcome arch on the arrival hill
  g.deco('house', 52, 69, 3, 2, { roof: 0xd06a4a, small: true });
  g.deco('house', 62, 71, 3, 2, { roof: 0x6a9ac0, small: true });
  g.deco('planter', 55, 72, 2, 1); g.deco('planter', 60, 73, 1, 1);
  g.def({ type: 'landmark', model: 'welcomearch', x: 58.5, z: 80.4, w: 3.4, d: 0.4, y: 0.2 });
  g.def({ type: 'sign', x: 60.8, z: 82.5, text: 'THIMBLEWICK\n"Small folk, loud bell."\nUp the Lantern Lane and over the brook: the Bell Tree square.' });
  // signposts at the square's four exits (words on the boards, read with F)
  g.def({ type: 'sign', x: 56.3, z: 51.8, text: 'NORTH ↑ the Terraces · the root arch · the Chime Gate road · Glassmere beyond' });
  g.def({ type: 'sign', x: 51.2, z: 57.2, text: 'WEST ← Market Row · the Hedge Garden · Whisperwood · the Cracked Conservatory' });
  g.def({ type: 'sign', x: 66.4, z: 58.6, text: 'EAST → Brisk\'s yard · the Mirrowrun bridge · Sunscald Reach · the Clockwork Gate (south of the east road)' });
  // a few trees back around the garden so the wood's edge still reads as a wood
  for (const [x, y] of [[36, 58], [35, 70], [36, 73], [38, 75], [34, 60], [46, 77]]) if (WALK.has(g.get(x, y))) g.set(x, y, T.TREE);
}
function thimbleHeights(g) {
  const W = g.w, lift = (x0, y0, x1, y1, h, test) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const t = g.get(x, y); if ((t === T.GRASS || t === T.FLOWERS || t === T.PATH || t === T.STONE || t === T.PROP || t === T.STAIRS) && (!test || test(x, y))) g.hv[y * W + x] = h; } };
  // the Terraces: two steps up towards the root arch (each step is walkable; no stairs needed)
  lift(61, 47, 74, 53, 0.4, (x, y) => Math.hypot((x + 0.5 - 58) / 7.5, (y + 0.5 - 58.5) / 6) > 1.05);
  lift(63, 44, 69, 46, 0.8);
  // the arrival hill south of the brook, rising gently so the town opens up below
  lift(52, 79, 65, 82, 0.2); lift(53, 83, 64, 88, 0.4);
}
