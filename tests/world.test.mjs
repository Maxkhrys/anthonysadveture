// Pass 6 playtest routes, driven through the real game: a new character's first route, every
// region, fast travel, world seeds, an old save, night, a mini-dungeon and the Tollcrow.
// Scripted checks prove the systems run and keep state; they are not a verdict on feel.
import { readFileSync } from 'node:fs';
import { sim, fresh, walkTo } from './lib.mjs';

const reload = async page => { await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 30000 }); await page.evaluate(() => window.__start(false)); await sim(page, 3); };

export default async function (page, R) {
  // ---------------------------------------------------------------- NEW CHARACTER: village -> Whisperwood -> Rootwell
  await fresh(page, 'archer', { stage: 1, level: 2 });
  const start = await page.evaluate(() => { const g = window.__game; return { place: g.region && g.region.name, marker: g.story.markers().find(m => m.pulse), seed: g.world6.seed }; });
  R.ok(start.place === 'Thimblewick' && start.marker && Math.hypot(start.marker.x - 107.5, start.marker.z - 99.5) < 1, 'a new character starts in Thimblewick and the map points at Rootwell Hollow', JSON.stringify(start));
  let ok = true;
  await page.evaluate(() => { window.__game.godMode = true; }); // the route, not the fights
  for (const [x, z] of [[143, 128.5], [134, 126.5], [124.5, 118.5], [116.5, 110.5], [109.5, 104.5], [107.6, 100.6]]) ok = await walkTo(page, x, z, 400, 0.6) && ok;
  await walkTo(page, 107.5, 99.7, 200, 0.25);
  await page.waitForFunction(() => window.__game.area.id === 'dungeon' && !window.__game.transitioning, null, { timeout: 8000 }).catch(() => {});
  await sim(page, 10);
  const route = await page.evaluate(() => { const g = window.__game; g.godMode = false; return { area: g.area.id, room: g.room && g.room.name }; });
  R.ok(ok && route.area === 'dungeon', 'walking the west road through Whisperwood reaches Rootwell Hollow', JSON.stringify(route));

  // ---------------------------------------------------------------- EXPLORATION: every region, no progression drift
  await fresh(page, 'samurai', { stage: 1, level: 12 });
  const tour = await page.evaluate(async () => {
    const g = window.__game, p = g.player, out = [];
    const before = JSON.stringify({ stage: g.flags.stage, lvl: g.inv.level, bag: g.inv.bag.length, coins: g.inv.coins });
    g.godMode = true;
    for (const [id, sp] of Object.entries({ heartland: 'village', whisperwood: 'dungeon', deepwood: 'deepwood', glassmere: 'mirrorcellar', lake: 'heronisle', sunscald: 'wells', cinderpeak: 'cinderrest', moonfen: 'moonfen', highlands: 'belfry' })) {
      const s = g.area.spawns[sp]; p.x = s.x; p.z = s.z; p.lastSafe = { x: s.x, z: s.z };
      g.noRender = true; window.__sim(40); g.noRender = false; g.render(0.016);
      out.push({ id, place: g.area.placeAt(p.x, p.z).id, found: g.world6.discovery.regions.includes(id), ents: g.entities.length, chunks: g.streamer.chunks.size });
    }
    for (const e of g.entities) if (e.isEnemy) e.remove();
    g.godMode = false;
    const after = JSON.stringify({ stage: g.flags.stage, lvl: g.inv.level, bag: g.inv.bag.length, coins: g.inv.coins });
    return { out, same: before === after, maxEnts: Math.max(...out.map(o => o.ents)), maxChunks: Math.max(...out.map(o => o.chunks)) };
  });
  R.ok(tour.out.every(o => o.place === o.id && o.found), 'every region can be visited and is discovered on arrival', JSON.stringify(tour.out.map(o => o.id + ':' + o.place)));
  R.ok(tour.same, 'touring the world does not touch story progress, level, bag or pips');
  R.ok(tour.maxEnts < 700 && tour.maxChunks <= 30, 'streaming keeps the live world small (entities, chunks)', JSON.stringify({ ents: tour.maxEnts, chunks: tour.maxChunks }));

  // ---------------------------------------------------------------- FAST TRAVEL: discover Bellstones, travel between them
  const travel = await page.evaluate(async () => {
    const g = window.__game, p = g.player;
    const rest = async sp => { const s = g.area.spawns[sp]; p.x = s.x; p.z = s.z; p.combatT = 0; g.noRender = true; window.__sim(10); g.noRender = false; const b = g.entities.filter(e => e.constructor.name === 'Bellstone').sort((a, c) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(c.x - p.x, c.z - p.z))[0]; if (g.ui.choice) g.ui.pick(g.ui.choice.opts.length - 1); b.interact(); for (let i = 0; i < 100 && !g.ui.choice; i++) { if (g.ui.typing) g.ui.typing.i = g.ui.typing.t = 1e3; await new Promise(r => setTimeout(r, 60)); } return g.ui.choice ? g.ui.choice.opts.map(o => o.label) : []; };
    await rest('wells'); if (g.ui.choice) g.ui.pick(g.ui.choice.opts.length - 1);
    await rest('cinderrest'); if (g.ui.choice) g.ui.pick(g.ui.choice.opts.length - 1);
    const opts = await rest('landing');
    const i = opts.findIndex(l => /Cinder Rest/.test(l));
    g.ui.pick(i);
    for (let k = 0; k < 80 && (g.transitioning || Math.hypot(p.x - g.area.spawns.cinderrest.x, p.z - g.area.spawns.cinderrest.z) > 1) ; k++) await new Promise(r => setTimeout(r, 100));
    const q = g.player;
    return { opts, stones: g.discoveredBellstones, at: [q.x, q.z], place: g.area.placeAt(q.x, q.z).name, talking: g.ui.talking, dead: g.dead, lock: g.locked(), cut: g.cutscene, hp: g.inv.hp };
  });
  R.ok(travel.stones.includes('overworld:wells') && travel.stones.includes('overworld:cinderrest') && travel.stones.includes('overworld:landing'), 'resting wakes the new Bellstones', JSON.stringify(travel.stones));
  R.ok(travel.opts.some(l => /Sunscald Wells/.test(l)) && travel.place === 'Cinder Rest', 'fast travel crosses the world (Mirrow Landing -> Cinder Rest)', JSON.stringify(travel));

  // ---------------------------------------------------------------- SEED: two characters differ; one character never changes
  const seeds = await page.evaluate(async () => {
    const g = window.__game;
    const snap = () => ({ seed: g.world6.seed, gen: JSON.stringify(g.world6.generated), camps: g.area.defs.filter(d => d.type === 'camp6').map(d => d.id + '@' + d.x + ',' + d.z).sort().join('|') });
    const a = snap(); await g.save();
    return a;
  });
  await fresh(page, 'witch', { stage: 1, level: 3 });
  const other = await page.evaluate(() => { const g = window.__game; return { seed: g.world6.seed, gen: JSON.stringify(g.world6.generated) }; });
  R.ok(other.seed !== seeds.seed && other.gen !== seeds.gen, 'two new characters get different optional placements', JSON.stringify([seeds.seed, other.seed]));
  await page.evaluate(() => window.__game.save());
  await reload(page);
  const again = await page.evaluate(() => { const g = window.__game; return { seed: g.world6.seed, gen: JSON.stringify(g.world6.generated), camps: g.area.defs.filter(d => d.type === 'camp6').map(d => d.id + '@' + d.x + ',' + d.z).sort().join('|') }; });
  R.ok(again.seed === other.seed && again.gen === other.gen && again.camps.length > 0, 'reloading the same character gives exactly the same placements', JSON.stringify({ camps: again.camps.slice(0, 80) }));

  // ---------------------------------------------------------------- OLD SAVE: a Pass 4 character arrives safely
  const raw = readFileSync(new URL('./fixtures/pass4-save.json', import.meta.url), 'utf8');
  await page.evaluate(r => { localStorage.clear(); localStorage.setItem('mossling-save-v2', r); }, raw);
  await reload(page);
  const old = await page.evaluate(() => {
    const g = window.__game, p = g.player, t = g.tileAt(Math.floor(p.x), Math.floor(p.z));
    return { area: g.area.id, at: [p.x, p.z], place: g.area.placeAt ? g.area.placeAt(p.x, p.z).name : g.area.name, solid: g.solidAt(p.x, p.z, 0.3), tile: t, seed: g.world6.seed, lvl: g.inv.level, q: g.flags.q_mill, items: g.inv.bag.length };
  });
  R.ok(!old.solid && old.seed > 0 && old.q === 2 && old.lvl > 1, 'an old save wakes on open ground at its checkpoint with its quests, level and a world seed', JSON.stringify(old));

  // ---------------------------------------------------------------- NIGHT: Moonfen wakes; night secrets open; nothing blocks the story
  await fresh(page, 'samurai', { stage: 1, level: 12 });
  const night = await page.evaluate(async () => {
    const g = window.__game, p = g.player;
    g.godMode = true;
    const go = sp => { const s = g.area.spawns[sp]; p.x = s.x; p.z = s.z; p.lastSafe = { x: s.x, z: s.z }; };
    const count = () => g.entities.filter(e => e.patrol && !e.dead).length;
    const setTime = f => { g.flags.dayOffset = (f - 0.32) * 420 - g.time; };
    setTime(0.5); go('moonfen'); g.noRender = true; for (let i = 0; i < 60; i++) { g.wtT = 0; g.patrolT = 0; window.__sim(10); } const day = count();
    setTime(0.9); for (let i = 0; i < 60; i++) { g.wtT = 0; g.patrolT = 0; window.__sim(10); } const nightN = count();
    const door = g.entities.find(e => e.constructor.name === 'NightDoor');
    const path = g.entities.find(e => e.constructor.name === 'MoonPath');
    const nightState = { door: door ? door.glow.visible : null, lilies: path ? path.open : null };
    setTime(0.5); window.__sim(20);
    const dayState = { door: door ? door.glow.visible : null, lilies: path ? path.open : null };
    g.noRender = false; g.godMode = false;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    return { day, nightN, nightState, dayState, stage: g.flags.stage };
  });
  R.ok(night.nightN > night.day, 'Moonfen fields more creatures at night than by day', JSON.stringify(night));
  R.ok(night.nightState.door === true && night.dayState.door === false && night.nightState.lilies === true && night.dayState.lilies === false, 'the Moonwell door and the moon-lily path open only at night', JSON.stringify(night));
  R.ok(night.stage === 1, 'night changes nothing about story progress');

  // ---------------------------------------------------------------- MINI-DUNGEON: enter, clear, save, reload
  const md = await page.evaluate(async () => {
    const g = window.__game;
    g.warpTo('rootcellar', 'entrance');
    for (let i = 0; i < 60 && (g.transitioning || g.area.id !== 'rootcellar'); i++) await new Promise(r => setTimeout(r, 100));
    const room = g.area.rooms.find(r => r.id === 'king');
    g.godMode = true;
    const p = g.player; p.x = (room.x0 + room.x1) / 2; p.z = (room.z0 + room.z1) / 2 + 2;
    g.noRender = true;
    for (let k = 0; k < 40 && !g.flags['md:rootcellar']; k++) { window.__sim(20); for (const e of g.entities) if (e.isEnemy && !e.dead && e.spawnT <= 0) e.die({ dir: 0 }); }
    window.__sim(30); g.noRender = false; g.godMode = false;
    await g.save();
    return { area: g.area.id, done: !!g.flags['md:rootcellar'], name: g.area.name };
  });
  R.ok(md.area === 'rootcellar' && md.done, 'a mini-dungeon can be entered and its mini-elite fight cleared', JSON.stringify(md));
  await reload(page);
  const mdAfter = await page.evaluate(() => ({ done: !!window.__game.flags['md:rootcellar'], area: window.__game.area.id }));
  R.ok(mdAfter.done, 'clearing it survives a reload', JSON.stringify(mdAfter));

  // ---------------------------------------------------------------- WORLD BOSS: the Tollcrow, once for the unique
  await fresh(page, 'samurai', { stage: 1, level: 15 });
  const boss = await page.evaluate(async () => {
    const g = window.__game, p = g.player, out = {};
    g.godMode = true;
    if (!g.entities.some(e => e.kind === 'tollcrow' && !e.dead)) g.spawnDef(g.area.defs.find(d => d.type === 'tollcrow')); // fresh() clears every foe
    p.x = 118.5; p.z = 36.5; p.lastSafe = { x: p.x, z: p.z };
    g.noRender = true;
    for (let i = 0; i < 40 && !g.bossActive; i++) window.__sim(5);
    const b = g.bossActive; out.started = !!b && b.kind === 'tollcrow';
    for (let i = 0; i < 60 && b.state !== 'circle'; i++) window.__sim(5);
    out.untouchableHigh = b.onHit({ dmg: 50, dir: 0 }) === null;
    b.begin('perch'); for (let i = 0; i < 60 && b.state !== 'perched'; i++) window.__sim(3);
    b.mouth.onHit({ dmg: 1, dir: 0 });
    for (let i = 0; i < 80 && b.state !== 'stunned'; i++) window.__sim(2);
    out.stunned = b.state === 'stunned';
    const h0 = b.hp; b.onHit({ dmg: 20, dir: 0 }); out.stunMult = (h0 - b.hp) / 20;
    b.hp = 1; b.onHit({ dmg: 20, dir: 0 });
    for (let i = 0; i < 120 && !b.dead; i++) window.__sim(5);
    await new Promise(r => setTimeout(r, 1600)); window.__sim(5);
    out.drops = g.entities.filter(e => e.constructor.name === 'GearDrop').map(e => e.item && e.item.unique).filter(Boolean);
    out.feathers = g.inv.mats.crowfeather || 0; out.kills = g.world6.events.tollcrow.kills;
    g.noRender = false; g.godMode = false;
    await g.save();
    return out;
  });
  R.ok(boss.started && boss.untouchableHigh, 'the Tollcrow wakes when you step into the Cradle, and is out of reach on the wing', JSON.stringify(boss));
  R.ok(boss.stunned && boss.stunMult > 1.5, 'ringing the Great Bell while it perches knocks it down and exposes it', JSON.stringify(boss));
  R.ok(boss.drops.includes('crowmantle') && boss.feathers >= 2 && boss.kills === 1, 'first kill: Tollcrow Mantle and feathers', JSON.stringify(boss));
  await reload(page);
  const later = await page.evaluate(async () => {
    const g = window.__game; const present = !!g.entities.find(e => e.kind === 'tollcrow');
    // three days later it's back on its bell; kill it again: feathers, no second mantle
    g.flags.dayOffset = (g.flags.dayOffset || 0) + 420 * 4; g.warpTo('overworld', { x: 118.5, z: 44 });
    for (let i = 0; i < 60 && g.transitioning; i++) await new Promise(r => setTimeout(r, 100));
    const b = g.entities.find(e => e.kind === 'tollcrow');
    if (!b) return { present, back: false };
    for (const e of g.entities) if (e.constructor.name === 'GearDrop') e.remove();
    g.godMode = true; g.noRender = true;
    g.startTollcrow(b); for (let i = 0; i < 80 && g.cutscene; i++) window.__sim(5);
    b.setState('stunned'); b.alt = 0.3; b.hp = 1; b.onHit({ dmg: 20, dir: 0 });
    for (let i = 0; i < 120 && !b.dead; i++) window.__sim(5);
    await new Promise(r => setTimeout(r, 1600)); window.__sim(5);
    g.noRender = false; g.godMode = false;
    return { present, back: true, kills: g.world6.events.tollcrow.kills, mantles: g.entities.filter(e => e.constructor.name === 'GearDrop' && e.item && e.item.unique === 'crowmantle').length };
  });
  R.ok(!later.present, 'after a kill the Great Bell stays quiet on reload (no instant respawn)', JSON.stringify(later));
  R.ok(later.back && later.kills === 2 && later.mantles === 0, 'it returns days later; a second kill never duplicates the unique', JSON.stringify(later));
}
