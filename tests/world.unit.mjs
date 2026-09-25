// Pass 6 unit checks: world seeds and manifests, save migration into the larger world,
// anchors on reachable ground, Bellstones and mini-dungeon exits that lead somewhere real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCharacter, createProfile, defaultInventory, migrateSave, BELLSTONES, migrateWorldLayout } from '../src/persistence/model.js';
import { generateManifest, seedForId, GENERATION_VERSION } from '../src/world/worldseed.js';
import { ANCHORS } from '../src/world/anchors.js';
import { HEART, LAYOUT_VERSION, REGION_IDS } from '../src/world/layout.js';
import { buildOverworld } from '../src/world/overworld.js';
import { buildMini, MINI_IDS, MINI } from '../src/world/minidungeons.js';
import { T, isSolid } from '../src/world/tiles.js';
import { starterWeapon } from '../src/rpg/items.js';

const make = (seed) => { const inventory = defaultInventory('archer'); inventory.equip.weapon = starterWeapon('archer'); return createProfile({ name: 'Tester', classId: 'archer', inventory, seed }); };

test('a new character gets a world seed and a manifest, and keeps them through saves', () => {
  const p = make();
  assert.ok(Number.isInteger(p.world.seed) && p.world.seed > 0);
  assert.equal(p.world.generationVersion, GENERATION_VERSION);
  assert.equal(p.world.layout, LAYOUT_VERSION);
  const again = normalizeCharacter(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(again.world.generated, p.world.generated, 'reloading never regenerates optional content');
  assert.equal(again.world.seed, p.world.seed);
});

test('two characters get different optional placements; one seed always gives the same world', () => {
  const a = make(1234567), b = make(7654321);
  assert.notDeepEqual(a.world.generated, b.world.generated);
  assert.deepEqual(generateManifest(1234567), a.world.generated);
  assert.deepEqual(generateManifest(1234567), generateManifest(1234567));
});

test('a saved manifest is kept as saved, even if the generator would now choose differently', () => {
  const p = make(42);
  p.world.generated.camps[0] = { ...p.world.generated.camps[0], x: 99.5, z: 99.5 };
  const q = normalizeCharacter(p);
  assert.equal(q.world.generated.camps[0].x, 99.5);
});

test('old characters get a deterministic seed from their identity', () => {
  const p = make(); delete p.world.seed; delete p.world.generated; delete p.world.generationVersion;
  const q = normalizeCharacter(p), r = normalizeCharacter(p);
  assert.equal(q.world.seed, seedForId(p.id));
  assert.equal(r.world.seed, q.world.seed);
  assert.deepEqual(q.world.generated, r.world.generated);
});

test('positions remembered by an old save move into the new world exactly once', () => {
  const p = make();
  p.world.layout = undefined;
  p.world.flags = { 'pile:overworld:12.5,45.5': true, 'pile:dungeon:3.5,4.5': true, 'drift:133.5,63.5': true, 'moved:pier-block': [61.5, 92.5], deathDrop: { area: 'overworld', x: 58.5, z: 66.5, coins: 40 }, q_mill: 2 };
  const q = normalizeCharacter(p);
  const f = q.world.flags;
  assert.ok(f[`pile:overworld:${12.5 + HEART.x},${45.5 + HEART.z}`]);
  assert.ok(f['pile:dungeon:3.5,4.5'], 'dungeon positions are untouched');
  assert.ok(f[`drift:${133.5 + HEART.x},${63.5 + HEART.z}`]);
  assert.deepEqual(f['moved:pier-block'], [61.5 + HEART.x, 92.5 + HEART.z]);
  assert.deepEqual([f.deathDrop.x, f.deathDrop.z, f.deathDrop.coins], [58.5 + HEART.x, 66.5 + HEART.z, 40]);
  assert.equal(f.q_mill, 2);
  const twice = normalizeCharacter(q);
  assert.deepEqual(twice.world.flags, q.world.flags, 'the migration is idempotent');
  assert.equal(migrateWorldLayout({ layout: LAYOUT_VERSION, flags: { 'drift:1,2': 1 } }).flags['drift:1,2'], 1);
});

test('the real Pass 4 save migrates: identity, items, progress and a stable world', () => {
  const raw = readFileSync(new URL('./fixtures/pass4-save.json', import.meta.url), 'utf8');
  const s = migrateSave(JSON.parse(raw)), c = s.characters[0], orig = JSON.parse(raw).characters[0];
  assert.equal(c.id, orig.id); assert.equal(c.inventory.level, orig.inventory.level);
  assert.equal(c.world.seed, seedForId(orig.id));
  assert.equal(c.world.layout, LAYOUT_VERSION);
  assert.deepEqual(c.world.checkpoint, orig.world.checkpoint);
  assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(s))).characters[0].world.generated, c.world.generated);
});

// flood-fill the world with the player's walking rules
const world = buildOverworld();
const reach = (() => {
  const a = world, W = a.w, seen = new Uint8Array(W * a.h);
  const gy = i => Number.isNaN(a.hv[i]) ? 0 : a.hv[i];
  const s = Math.floor(a.spawns.village.z) * W + Math.floor(a.spawns.village.x); const q = [s]; seen[s] = 1;
  while (q.length) { const i = q.pop(), x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= a.h) continue; const j = ny * W + nx; if (seen[j] || isSolid(a.tiles[j]) || a.tiles[j] === T.PIT || Math.abs(gy(j) - gy(i)) > 0.55) continue; seen[j] = 1; q.push(j); } }
  return (x, z) => { const i = Math.floor(z) * W + Math.floor(x); return seen[i] || seen[i + 1] || seen[i - 1] || seen[i + W] || seen[i - W]; };
})();

test('the world is 4-6x the old map in walkable ground, and every region is reachable on foot', () => {
  let n = 0; for (let z = 0; z < world.h; z++) for (let x = 0; x < world.w; x++) if (reach(x + 0.5, z + 0.5)) n++;
  assert.ok(n > 9781 * 4, 'reachable tiles ' + n);
  const seenRegions = new Set();
  for (let z = 0; z < world.h; z += 2) for (let x = 0; x < world.w; x += 2) if (reach(x + 0.5, z + 0.5)) seenRegions.add(world.placeAt(x, z).id);
  assert.deepEqual([...seenRegions].sort(), [...REGION_IDS].sort());
});

test('every optional anchor stands on open ground you can walk to', () => {
  const all = [...ANCHORS.camps, ...ANCHORS.rare, ...ANCHORS.merchants, ...ANCHORS.pockets, ...ANCHORS.events.star, ...ANCHORS.events.incursion, ...ANCHORS.events.moths, ...Object.values(ANCHORS.caves).flat()];
  const bad = all.filter(a => !reach(a.x, a.z));
  assert.deepEqual(bad.map(a => a.id), []);
});

test('every Bellstone, door and spawn in the overworld can be walked to', () => {
  const bad = [];
  for (const [k, s] of Object.entries(world.spawns)) if (!reach(s.x, s.z)) bad.push('spawn ' + k);
  for (const d of world.defs) if (['bellstone', 'warp', 'npc', 'ferry', 'nightdoor'].includes(d.type) && !reach(d.x, d.z)) bad.push(d.type + ' ' + (d.spawn || d.to || d.id));
  assert.deepEqual(bad, []);
  for (const b of BELLSTONES.filter(b => b.area === 'overworld')) assert.ok(world.spawns[b.spawn], 'Bellstone spawn ' + b.spawn);
});

test('eleven mini-dungeons build, each with a way out to a real place', () => {
  assert.ok(MINI_IDS.length >= 8 && MINI_IDS.length <= 12);
  for (const id of MINI_IDS) {
    const a = buildMini(id);
    const exit = a.defs.find(d => d.type === 'warp');
    assert.ok(exit, id + ' has an exit');
    assert.ok(world.spawns[exit.spawn] || exit.spawn.startsWith('cave:'), id + ' exits to ' + exit.spawn);
    assert.ok(a.defs.some(d => d.type === 'mdarena'), id + ' has a fight with a mini-elite');
    assert.ok(world.defs.some(d => (d.type === 'warp' || d.type === 'nightdoor') && d.to === id) || MINI[id].exit.startsWith('cave:'), id + ' has an entrance');
  }
});
