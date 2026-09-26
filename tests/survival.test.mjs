// Survival mode through the real game: the menu split, world creation, deterministic chunked
// generation and streaming, gathering with weapons, crafting and building, a cave, save and
// reload, deleting worlds without touching story saves, and story mode still loading.
import { sim } from './lib.mjs';

const boot = async page => { await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading') && document.querySelector('#title-menu div'), null, { timeout: 30000 }); };
const nearest = (type) => `(() => { const g = window.__game, p = g.player; return g.entities.filter(e => e.isNode && !e.dead && e.type === '${type}').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; })()`;
const chop = (page, type) => page.evaluate(async (src) => {
  const g = window.__game, p = g.player, t = eval(src);
  p.x = t.x; p.z = t.z - 1.3; p.facing = 0; p.aimSrc = 'keys'; g.input.aimSrc = 'keys'; g.godMode = true; g.noRender = true;
  let f = 0; while (!t.dead && f < 900) { (window.__game.noRender = true, window.__sim)(4, ['KeyC']); (window.__game.noRender = true, window.__sim)(6); f += 10; }
  (window.__game.noRender = true, window.__sim)(60); g.noRender = false; return { id: t.id, dead: t.dead, secs: f / 30 };
}, nearest(type));

export default async function (page, R) {
  await page.evaluate(() => { localStorage.removeItem('mossling-survival-v1'); });
  // ---------------------------------------------------------------- a story character exists first
  await page.evaluate(async () => { await window.__start(true, 'samurai'); await window.__game.save(); });
  await boot(page);
  const storyBefore = await page.evaluate(() => localStorage.getItem('mossling-save-v2'));

  // ---------------------------------------------------------------- the menu separates the modes
  const main = await page.evaluate(() => [...document.querySelectorAll('#title-menu div')].map(d => d.textContent));
  R.ok(main[0] === 'Play Story' && main[1] === 'Play Survival' && main.includes('Settings') && main.includes('How to Play') && !main.some(t => / · Lv /.test(t)), 'the main menu offers Play Story / Play Survival / Settings / How to Play, without mixing save lists', main.join(' | '));
  await page.getByText('Play Story', { exact: true }).click(); await page.waitForTimeout(150);
  const story = await page.evaluate(() => ({ items: [...document.querySelectorAll('#title-menu div')].map(d => d.textContent), card: document.getElementById('title-card').textContent }));
  R.ok(story.items.some(t => / · samurai · Lv /.test(t)) && story.items.includes('New Character') && !story.items.some(t => /seed/.test(t)), 'Play Story lists story characters only', story.items.join(' | '));
  await page.getByText('Back', { exact: true }).click(); await page.waitForTimeout(100);
  await page.getByText('Play Survival', { exact: true }).click(); await page.waitForTimeout(150);
  await page.getByText('New Survival World', { exact: true }).click(); await page.waitForTimeout(150);
  await page.fill('#nw-name', 'Test Wilds'); await page.fill('#nw-seed', '4242'); await page.click('#title-card [data-cls="witch"]');
  await page.getByText('Create & play', { exact: true }).click();
  await page.waitForFunction(() => window.__game.survival && window.__game.area?.id === 'wilds', null, { timeout: 20000 });
  await sim(page, 20);
  const made = await page.evaluate(() => { const g = window.__game, w = g.survival.record; return { name: w.name, seed: w.seed, cls: g.inv.cls, gen: w.genVersion, area: g.area.id, hint: document.getElementById('objective')?.textContent || '' }; });
  R.ok(made.name === 'Test Wilds' && made.seed === 4243 && made.gen === 2, 'the world is created from the menu with its name and seed (new worlds: generator v2)', JSON.stringify(made));
  R.ok(made.cls === 'witch' && made.area === 'wilds' && /gather wood/i.test(made.hint), 'you spawn as the chosen class in the generated wilderness, with a first hint', JSON.stringify(made));

  // ---------------------------------------------------------------- determinism and streaming
  const det = await page.evaluate(async () => { const G = await import('./src/survival/gen.js'); return { same: G.fingerprint(4242, 8, 8, 11, 11) === G.fingerprint(4242, 8, 8, 11, 11), differ: G.fingerprint(4242, 8, 8, 11, 11) !== G.fingerprint(4243, 8, 8, 11, 11) }; });
  R.ok(det.same && det.differ, 'the same seed and version always generate the same chunks; another seed differs');
  const inGame = await page.evaluate(async () => { const g = window.__game, G = await import('./src/survival/gen.js'), c = G.generateChunk(g.survival.record.seed, 10, 10); const A = g.area.chunks.get('10,10'); return !!A && A.tiles.join() === c.tiles.join() && A.nodes.length === c.nodes.length; });
  R.ok(inGame, 'chunks in the running world match a fresh generation of the same chunk');
  const stream = await page.evaluate(() => {
    const g = window.__game, S = g.survival, p = g.player; const k0 = [...S.byChunk.keys()];
    p.x += 110; p.z += 60; S.stream(); (window.__game.noRender = true, window.__sim)(20); S.stream();
    const k1 = [...S.byChunk.keys()], liveNodes = g.entities.filter(e => e.isNode && !e.dead).length;
    return { k0: k0.length, k1: k1.length, dropped: k0.filter(k => !k1.includes(k)).length, gen: g.area.chunks.size, liveNodes, far: g.entities.filter(e => e.isNode && Math.hypot(e.x - p.x, e.z - p.z) > 80).length };
  });
  R.ok(stream.dropped === stream.k0 && stream.k1 <= 9 && stream.far === 0 && stream.liveNodes < 700, 'moving away streams in nearby chunks and drops far ones (no far nodes stay alive)', JSON.stringify(stream));
  await page.evaluate(() => { const g = window.__game; g.survival.goHome(); });
  await page.waitForFunction(() => !window.__game.transitioning && window.__game.area?.id === 'wilds', null, { timeout: 10000 }); await sim(page, 10);

  // ---------------------------------------------------------------- gathering with the weapon
  const tree = await chop(page, 'tree'), rock = await chop(page, 'rock');
  const res1 = await page.evaluate(() => ({ ...window.__game.survival.record.resources }));
  R.ok(tree.dead && rock.dead && res1.wood >= 3 && res1.stone >= 3, 'a Witch fells a tree and breaks a rock with normal attacks; the pieces are picked up', JSON.stringify({ res1, tree, rock }));

  // ---------------------------------------------------------------- crafting and building
  const built = await page.evaluate(() => {
    const g = window.__game, S = g.survival, R = S.record, p = g.player; g.input.aimSrc = 'keys';
    Object.assign(R.resources, { wood: 40, stone: 20, fibre: 10 });
    const noBench = S.canCraft('wall');
    const a = S.craft('campfire'), b = S.craft('workbench');
    const spot = (dx, dz) => { p.facing = Math.atan2(dx, dz); (window.__game.noRender = true, window.__sim)(1); };
    // place campfire and workbench a couple of tiles apart, then a wall next to the bench
    const tryPlace = (type) => { S.startBuild(type); for (let a = 0; a < 16; a++) { p.facing = a / 16 * Math.PI * 2; (window.__game.noRender = true, window.__sim)(1); if (S.build?.ok) { const ok = S.place(); if (ok) return true; } } S.endBuild(); return false; };
    const fire = tryPlace('campfire'); p.x += 3; (window.__game.noRender = true, window.__sim)(2); const bench = tryPlace('workbench');
    const c = S.craft('wall'); const wall = tryPlace('wall');
    const selfBlock = S.placeCheck('wall', Math.floor(p.x), Math.floor(p.z));
    return { noBench: noBench.why, a: a.ok, b: b.ok, fire, bench, c: c.ok, cwhy: c.why, benchD: g.entities.filter(e => e.isStructure).map(e => e.type + ':' + Math.hypot(e.x - p.x, e.z - p.z).toFixed(1)).join(' '), wall, home: !!R.home, n: R.structures.length, selfBlock };
  });
  R.ok(/workbench/i.test(built.noBench), 'walls need a workbench nearby', built.noBench);
  R.ok(built.a && built.b && built.fire && built.bench && built.c && built.wall && built.n === 3, 'craft a campfire and workbench, place them, then craft and place a wall at the bench', JSON.stringify(built));
  R.ok(built.home && /standing/.test(built.selfBlock), 'the first campfire sets home, and a wall cannot be placed where you stand', built.selfBlock);

  // ---------------------------------------------------------------- the cave
  const cave = await page.evaluate(async () => {
    const g = window.__game, S = g.survival, c = S.firstCave();
    const p = g.player; p.x = c.x; p.z = c.z + 3; S.stream(); (window.__game.noRender = true, window.__sim)(10);
    const mouth = g.entities.find(e => e.id === 'cave:' + c.rx + ',' + c.rz);
    mouth.interact(); await new Promise(r => setTimeout(r, 1200)); (window.__game.noRender = true, window.__sim)(5);
    const a = g.area; const foes = g.entities.filter(e => e.isEnemy && !e.dead), nodes = g.entities.filter(e => e.isNode && !e.dead).length;
    return { id: mouth.id, area: a.id, foes: foes.length, nodes, chest: !!g.entities.find(e => e.id === 'cavechest:' + mouth.id) };
  });
  R.ok(cave.area === 'cave' && cave.foes > 0 && cave.nodes > 0 && cave.chest, 'the cave mouth east of camp leads into a cave with creatures, crystals or ore, and a reward', JSON.stringify(cave));
  const clear = await page.evaluate(async () => {
    const g = window.__game, S = g.survival;
    for (const e of g.entities.filter(e => e.isEnemy && !e.dead)) { e.hp = 0; e.die({ dir: 0, kind: 'bolt' }); }
    (window.__game.noRender = true, window.__sim)(10);
    const chest = g.entities.find(e => e.id && String(e.id).startsWith('cavechest:')); const before = S.record.resources.crystal; chest.interact(); (window.__game.noRender = true, window.__sim)(5);
    const out = { cleared: S.caveState(S.caveId).cleared, crystal: S.record.resources.crystal - before, opened: S.isOpened(chest.id) };
    S.leaveCave(); await new Promise(r => setTimeout(r, 1200)); (window.__game.noRender = true, window.__sim)(5); out.back = g.area.id; return out;
  });
  R.ok(clear.cleared && clear.crystal > 0 && clear.opened && clear.back === 'wilds', 'defeating its creatures clears the cave; its reward is taken once; you come back out by the mouth', JSON.stringify(clear));

  // ---------------------------------------------------------------- save, reload, same world
  const before = await page.evaluate(() => { const g = window.__game, S = g.survival; g.save(); return { id: S.record.id, tree: Object.keys(S.record.removed), res: { ...S.record.resources }, n: S.record.structures.length, cave: Object.keys(S.record.caves)[0] }; });
  await boot(page);
  await page.evaluate(id => window.__startSurvival(id), before.id);
  await page.waitForFunction(() => window.__game.survival && window.__game.area?.id === 'wilds', null, { timeout: 20000 }); await sim(page, 10);
  const after = await page.evaluate(ids => {
    const g = window.__game, S = g.survival, R = S.record; S.goHome(); return new Promise(r => setTimeout(() => { (window.__game.noRender = true, window.__sim)(10); S.stream(); r({ removedKept: ids.every(id => R.removed[id]), backAsNode: g.entities.some(e => e.isNode && ids.includes(e.id)), res: { ...R.resources }, placed: g.entities.filter(e => e.isStructure && !e.gen).map(e => e.type).sort().join(','), n: R.structures.length, cleared: Object.values(R.caves).some(c => c.cleared) }); }, 1200));
  }, before.tree);
  R.ok(after.removedKept && !after.backAsNode, 'felled trees and broken rocks stay gone after a reload', JSON.stringify(after));
  R.ok(after.n === before.n && after.placed === 'campfire,wall,workbench' && after.res.wood === before.res.wood, 'placed structures and resources come back exactly after a reload', JSON.stringify(after));
  R.ok(after.cleared, 'the cleared cave is still cleared after a reload');

  // ---------------------------------------------------------------- deleting a world never touches story saves
  await boot(page);
  const del = await page.evaluate(id => { const S = window.__game.survivalMode.store; const n0 = S.list().length; S.delete(id); return { n0, n1: S.list().length }; }, before.id);
  const storyAfter = await page.evaluate(() => localStorage.getItem('mossling-save-v2'));
  R.ok(del.n1 === del.n0 - 1 && storyAfter === storyBefore, 'deleting a survival world leaves the story save byte-for-byte unchanged', JSON.stringify(del));

  // ---------------------------------------------------------------- an old survival record still loads
  const old = await page.evaluate(async () => { const M = await import('./src/survival/store.js'); const w = M.normalizeWorld({ id: 'wold', seed: 99, name: 'Old', character: { cls: 'archer' }, removed: { 'n:1,1': true } }); return { gen: w.genVersion, res: w.resources.wood, removed: w.removed['n:1,1'], hints: w.hints.step }; });
  R.ok(old.gen === 1 && old.res === 0 && old.removed === true && old.hints === 0, 'an older survival record without newer fields loads with safe defaults and keeps its changes', JSON.stringify(old));

  // ---------------------------------------------------------------- every class gathers and fights here
  const classes = await page.evaluate(async () => {
    const g = window.__game, M = g.survivalMode, st = M.store, out = {}; g.noRender = true;
    for (const cls of ['samurai', 'archer', 'witch', 'soulbound', 'gunslinger']) {
      const w = st.create({ name: cls, cls, seed: 777 }); if (M.active) { M.stop(); M.start(w); } else await window.__startSurvival(w.id); g.noRender = true; window.__sim(5);
      const p = g.player, t = g.entities.filter(e => e.isNode && e.type === 'tree').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      p.x = t.x; p.z = t.z - 1.3; p.facing = 0; p.aimSrc = 'keys'; g.input.aimSrc = 'keys'; g.godMode = true;
      let f = 0; while (!t.dead && f < 900) { window.__sim(cls === 'archer' ? 20 : 4, ['KeyC']); window.__sim(6); f += cls === 'archer' ? 26 : 10; }
      window.__sim(60);
      out[cls] = { felled: t.dead, seconds: Math.round(f / 3) / 10, wood: M.record.resources.wood, cls: g.inv.cls };
      st.delete(w.id);
    }
    M.stop(); g.noRender = false; return out;
  });
  R.ok(Object.values(classes).every(c => c.felled && c.wood >= 3) && Object.entries(classes).every(([k, c]) => c.cls === k), 'all five classes start a world and fell a tree with their own weapon', JSON.stringify(classes));
  await boot(page);

  // ---------------------------------------------------------------- story mode still loads and plays
  await page.getByText('Play Story', { exact: true }).click(); await page.waitForTimeout(150);
  await page.locator('#title-menu div').filter({ hasText: / · samurai · Lv / }).first().click();
  await page.waitForFunction(() => window.__game.area?.id === 'overworld' && !window.__game.survival, null, { timeout: 20000 });
  const st = await page.evaluate(() => ({ area: window.__game.area.id, mode: window.__game.mode || 'story', obj: document.getElementById('objective')?.textContent || '' }));
  R.ok(st.area === 'overworld' && !/gather wood/i.test(st.obj), 'story mode still loads its own character in Lanternreach with story guidance', JSON.stringify(st));
}
