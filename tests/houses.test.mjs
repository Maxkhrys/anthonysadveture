// Survival modular houses through the real game: the kit registry, placement rules (rotation,
// levels, support, clearance, entrapment), exact kit spending and refunds, doors, stairs both
// ways, upper floors, falls, furniture on two floors, storey-separated combat, generated houses
// (determinism, entering, persistence of changes), save and reload upstairs, old saves, chunk
// streaming, death / unstuck / go home, caves, and Story / MOSSDEV isolation.
import { sim } from './lib.mjs';

const OUT = process.env.SHOTS; // optional: capture screenshots while the suite runs
const shot = async (page, name) => { if (OUT) { await page.evaluate(() => { window.__game.noRender = false; }); await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 84 }); } };
const boot = async page => { await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading') && document.querySelector('#title-menu div'), null, { timeout: 30000 }); };
const helpers = page => page.evaluate(() => {
  const g = () => window.__game, S = () => window.__game.survival;
  window.__H = {
    give(k) { const R = S().record; R.kits = R.kits || {}; for (const [t, n] of Object.entries(k)) R.kits[t] = (R.kits[t] || 0) + n; },
    put(type, x, z, lv = 0, r = 0) { return S().placePiece({ type, x, z, lv, r }); },
    cell(cx, cz) { return { x: cx * 2 + 1, z: cz * 2 + 1 }; },
    tp(x, z, fy = 0) { const p = g().player; p.x = x; p.z = z; p.fy = fy; p.fvy = 0; p.state = 'move'; S().stream(true); p.sync(); g().snapCamera(); },
    // a clear w x d block of modules near the player (every cell takes a foundation)
    plot(w, d) {
      const p = g().player, c0 = Math.floor(p.x / 2), r0 = Math.floor(p.z / 2);
      for (let rad = 2; rad < 14; rad++) for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const cx = c0 + dx, cz = r0 + dz; let ok = true;
        for (let j = -1; j <= d && ok; j++) for (let i = -1; i <= w && ok; i++) if (S().checkPiece({ type: 'stone_foundation', x: (cx + i) * 2 + 1, z: (cz + j) * 2 + 1, lv: 0 })) ok = false;
        if (ok) return { cx, cz };
      }
      return null;
    },
    state() { const p = g().player; return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), fy: +(p.fy || 0).toFixed(2), hp: g().inv.hp }; },
  };
});

export default async function (page, R) {
  await page.evaluate(() => { localStorage.removeItem('mossling-survival-v1'); localStorage.removeItem('mossling-devlab-v1'); });
  await page.evaluate(async () => { await window.__start(true, 'samurai'); await window.__game.save(); });
  await boot(page);
  const storyBefore = await page.evaluate(() => localStorage.getItem('mossling-save-v2'));

  // ---------------------------------------------------------------- the registry
  const reg = await page.evaluate(async () => {
    const K = await import('/src/survival/kit.js'), C = await import('/src/survival/craft.js'), E = await import('/src/survival/entities.js');
    const ids = Object.keys(K.KIT), S = window.__game.survivalMode;
    return { ids, recipes: ids.every(id => C.RECIPES.some(r => r.gives === id && !r.legacy)), described: ids.every(id => K.KIT[id].name && K.KIT[id].desc && Array.isArray(K.KIT[id].levels)), inPieces: ids.every(id => E.PIECES[id] && E.PIECES[id].kit), info: S.pieceInfo('timber_stairs'), legacyHidden: C.RECIPES.filter(r => r.legacy).map(r => r.id) };
  });
  R.ok(reg.ids.length >= 12 && ['stone_foundation', 'timber_floor', 'timber_wall', 'timber_window', 'stone_wall', 'timber_doorway', 'timber_door', 'timber_post', 'timber_stairs', 'thatch_roof', 'thatch_ridge', 'timber_gable'].every(i => reg.ids.includes(i)), 'the kit registry has foundations, floors, walls, windows, doorways, doors, posts, stairs, roofs, ridges and gables', reg.ids.join(','));
  R.ok(reg.recipes && reg.described && reg.inPieces, 'every kit piece has a recipe, a name, a description and allowed levels, and is in the build registry');
  R.ok(reg.info && reg.info.id === 'timber_stairs' && reg.info.cost.wood === 8 && reg.info.rotates && reg.info.station === 'workbench', 'pieceInfo exposes id, cost, rotation, levels and station for the crafting UI', JSON.stringify(reg.info));
  R.ok(reg.legacyHidden.join() === 'floor,wall,stonewall,door,roof', 'first-pass tile recipes are kept for old worlds but no longer listed', reg.legacyHidden.join());

  // ---------------------------------------------------------------- a new world: generator v2
  const wid = await page.evaluate(() => window.__game.survivalMode.store.create({ name: 'House Test', cls: 'samurai', seed: 4242 }).id);
  await page.evaluate(id => window.__startSurvival(id), wid);
  await page.waitForFunction(() => window.__game.area?.id === 'wilds');
  await helpers(page);
  const gen = await page.evaluate(() => ({ v: window.__game.survival.record.genVersion }));
  R.ok(gen.v === 2, 'new worlds use generator v2 (generated houses)', JSON.stringify(gen));

  // ---------------------------------------------------------------- crafting spends exactly once
  const craft = await page.evaluate(() => {
    const S = window.__game.survival, R = S.record; Object.assign(R.resources, { wood: 40, stone: 20, fibre: 10 });
    const w0 = R.resources.wood, k0 = (R.kits || {}).timber_floor || 0;
    const ok = S.craft('timber_floor').ok, w1 = R.resources.wood, k1 = R.kits.timber_floor;
    const bench = S.craft('timber_wall'); // needs a workbench nearby
    R.resources.wood = 3; const poor = S.craft('timber_floor'); const w2 = R.resources.wood, k2 = R.kits.timber_floor;
    return { ok, spent: w0 - w1, got: k1 - k0, bench: bench.ok, benchWhy: bench.why, poor: poor.ok, keep: w2 === 3 && k2 === k1 };
  });
  R.ok(craft.ok && craft.spent === 4 && craft.got === 1, 'crafting a timber floor spends 4 wood once and adds one kit', JSON.stringify(craft));
  R.ok(!craft.bench && /workbench/i.test(craft.benchWhy) && !craft.poor && craft.keep, 'walls need a workbench; failed crafts spend nothing', JSON.stringify(craft));

  // ---------------------------------------------------------------- build a two-storey house
  const house = await page.evaluate(() => {
    const H = window.__H, S = window.__game.survival, R = S.record;
    H.give({ stone_foundation: 6, timber_floor: 8, timber_wall: 12, timber_window: 12, timber_door: 2, timber_stairs: 1, thatch_roof: 6, thatch_ridge: 2, timber_gable: 6, timber_post: 2, chest: 3, workbench: 1, torch: 2, campfire: 1 });
    const P = H.plot(3, 2); if (!P) return { err: 'no plot' };
    const { cx, cz } = P, c = (i, j) => H.cell(cx + i, cz + j), log = [];
    const put = (t, x, z, lv = 0, r = 0) => { const res = H.put(t, x, z, lv, r); log.push(t + '@' + lv + ':' + (res.ok ? 'ok' : res.why)); return res; };
    const edge = (i, j, side, t, lv) => { const x0 = (cx + i) * 2, z0 = (cz + j) * 2; const p = { n: [x0 + 1, z0], s: [x0 + 1, z0 + 2], w: [x0, z0 + 1], e: [x0 + 2, z0 + 1] }[side]; return put(t, p[0], p[1], lv, side === 'w' || side === 'e' ? 1 : 0); };
    for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) put('stone_foundation', c(i, j).x, c(i, j).z);
    const k0 = R.kits.timber_wall;
    // the ground storey
    edge(0, 0, 'n', 'timber_wall', 0); edge(1, 0, 'n', 'timber_window', 0); edge(2, 0, 'n', 'timber_wall', 0);
    edge(0, 1, 's', 'timber_door', 0); edge(1, 1, 's', 'timber_wall', 0); edge(2, 1, 's', 'timber_window', 0);
    edge(0, 0, 'w', 'timber_wall', 0); edge(0, 1, 'w', 'timber_window', 0); edge(2, 0, 'e', 'timber_window', 0); edge(2, 1, 'e', 'timber_wall', 0);
    const stairs = put('timber_stairs', c(1, 1).x, c(1, 1).z, 0, 1);
    // upstairs: floors everywhere but the stairwell, walls, a gable roof facing the camera
    for (const [i, j] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]) put('timber_floor', c(i, j).x, c(i, j).z, 1);
    edge(0, 0, 'n', 'timber_window', 1); edge(1, 0, 'n', 'timber_wall', 1); edge(2, 0, 'n', 'timber_window', 1);
    edge(0, 1, 's', 'timber_window', 1); edge(1, 1, 's', 'timber_wall', 1); edge(2, 1, 's', 'timber_window', 1);
    edge(0, 0, 'w', 'timber_wall', 1); edge(0, 1, 'w', 'timber_window', 1); edge(2, 0, 'e', 'timber_wall', 1); edge(2, 1, 'e', 'timber_window', 1);
    for (const j of [0, 1]) { put('thatch_roof', c(0, j).x, c(0, j).z, 1, 1); put('thatch_ridge', c(1, j).x, c(1, j).z, 1, 1); put('thatch_roof', c(2, j).x, c(2, j).z, 1, 3); }
    for (const i of [0, 1, 2]) { edge(i, 0, 'n', 'timber_gable', 1); edge(i, 1, 's', 'timber_gable', 1); }
    // furniture on both floors (the same tile, one above the other), a workbench and a light
    const x0 = cx * 2, z0 = cz * 2;
    const chestDown = put('chest', x0 + 4.5, z0 + 0.5, 0, 2), chestUp = put('chest', x0 + 4.5, z0 + 0.5, 1, 2);
    const bench = put('workbench', x0 + 0.5, z0 + 0.5, 0, 0), torch = put('torch', x0 + 0.5, z0 + 0.5, 1, 0);
    return { cx, cz, x0, z0, stairs: stairs.ok, fails: log.filter(l => !/:ok$/.test(l)), placed: log.length, spentWalls: k0 - R.kits.timber_wall, chestDown: chestDown.id, chestUp: chestUp.id, bench: bench.ok, torch: torch.ok, n: R.structures.length };
  });
  R.ok(house.stairs && house.fails.length === 0, 'a two-storey house goes up from the kit: foundations, walls, windows, a door, stairs, an upper floor, walls, roof, ridge and gables', JSON.stringify(house.fails));
  R.ok(house.chestDown && house.chestUp && house.bench && house.torch, 'furniture stands on both floors, including two chests on the same tile one storey apart', JSON.stringify(house));
  const H0 = house;

  // ---------------------------------------------------------------- placement rules
  const rules = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, R = S.record, c = (i, j) => H.cell(h.cx + i, h.cz + j), x0 = h.x0, z0 = h.z0;
    const why = rec => S.checkPiece(rec);
    const kits0 = JSON.stringify(R.kits);
    const out = {
      taken: why({ type: 'stone_foundation', x: c(0, 0).x, z: c(0, 0).z, lv: 0 }),
      stairwell: why({ type: 'timber_floor', x: c(1, 1).x, z: c(1, 1).z, lv: 1 }),
      unsupported: why({ type: 'timber_floor', x: c(4, 0).x, z: c(4, 0).z, lv: 1 }),
      tooHigh: why({ type: 'stone_foundation', x: c(5, 0).x, z: c(5, 0).z, lv: 1 }),
      doorway: why({ type: 'chest', x: x0 + 0.5, z: z0 + 3.5, lv: 0 }),
      stairFoot: why({ type: 'chest', x: x0 + 1.5, z: z0 + 2.5, lv: 0 }),
      onStairs: why({ type: 'chest', x: x0 + 2.5, z: z0 + 2.5, lv: 0 }),
      campUp: why({ type: 'campfire', x: x0 + 1.5, z: z0 + 1.5, lv: 1 }),
      wallBlocksStairs: why({ type: 'timber_wall', x: x0 + 2, z: z0 + 3, lv: 0, r: 1 }),
      gableAlone: why({ type: 'timber_gable', x: c(6, 0).x, z: c(6, 0).z - 1, lv: 0 }),
      roofOverFloor: why({ type: 'thatch_roof', x: c(0, 0).x, z: c(0, 0).z, lv: 0 }),
    };
    // a failed placement never spends: try every refused one through the real placement call
    for (const rec of [{ type: 'timber_floor', x: c(1, 1).x, z: c(1, 1).z, lv: 1 }, { type: 'chest', x: x0 + 0.5, z: z0 + 3.5, lv: 0 }]) S.placePiece(rec);
    out.unchanged = JSON.stringify(R.kits) === kits0;
    return out;
  }, H0);
  R.ok(/already built/i.test(rules.taken) && /stairwell/i.test(rules.stairwell) && /wall or post below/i.test(rules.unsupported), 'placement refuses taken slots, floors over a stairwell and unsupported upper floors, with reasons', JSON.stringify(rules));
  R.ok(/ground/i.test(rules.tooHigh) && /doorway/i.test(rules.doorway) && /foot of the stairs/i.test(rules.stairFoot) && /stairs/i.test(rules.onStairs) && /ground floor/i.test(rules.campUp), 'levels, door clearance, stair clearance and campfire rules each give a clear reason', JSON.stringify(rules));
  R.ok(/foot of the stairs/i.test(rules.wallBlocksStairs) && /roof/i.test(rules.gableAlone) && /floor above/i.test(rules.roofOverFloor), 'walls cannot block stairs, gables need a roof, roofs cannot go under a floor', JSON.stringify(rules));
  R.ok(rules.unchanged, 'refused placements spend nothing');

  // ---------------------------------------------------------------- rotation, levels and the ghost
  const ghost = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, g = window.__game, p = g.player;
    H.tp(h.x0 + 1.5, h.z0 + 5.5, 0); p.aimSrc = 'keys'; g.input.aimSrc = 'keys'; p.facing = Math.PI;
    H.give({ timber_stairs: 1, timber_floor: 1 }); S.startBuild('timber_stairs'); const b = S.build; b.lv = 0; b.r = 3; window.__sim(1);
    const a = { r: b.rec.r, lv: b.rec.lv, yaw: +b.ghost.children[0].rotation.y.toFixed(3), info: b.info, y: +b.ghost.position.y.toFixed(2) };
    S.endBuild(); S.startBuild('timber_floor'); S.build.lv = 1; window.__sim(1);
    const f = { lv: S.build.rec.lv, y: +S.build.ghost.position.y.toFixed(2), ok: S.build.ok, why: S.build.why };
    S.endBuild();
    return { a, f, scene: g.scene.children.filter(o => o.type === 'Group' && o.children[0]?.material?.transparent && o.children[0].material.opacity === 0.45).length };
  }, H0);
  R.ok(ghost.a.r === 3 && Math.abs(ghost.a.yaw - 3 * Math.PI / 2) < 0.01 && /ground floor/.test(ghost.a.info) && /facing west/.test(ghost.a.info), 'the ghost shows the real rotation and level of the stairs', JSON.stringify(ghost.a));
  R.ok(ghost.f.lv === 1 && ghost.f.y > 1.9, 'on level 1 the ghost floats at the upper floor height', JSON.stringify(ghost.f));
  R.ok(ghost.scene === 0, 'ending build mode removes the ghost from the scene');

  // real keys: T rotates, ] raises the level, the wheel turns, and X leaves build mode without spending
  await page.evaluate(() => { const S = window.__game.survival; S.record.kits.timber_stairs = (S.record.kits.timber_stairs || 0) + 1; S.startBuild('timber_stairs'); S.build.r = 0; S.build.lv = 0; window.__game.noRender = true; });
  const keys0 = await page.evaluate(() => JSON.stringify(window.__game.survival.record.kits));
  await page.keyboard.press('KeyT'); await sim(page, 1); await page.keyboard.press('BracketRight'); await sim(page, 1);
  // (headless wheel delivery is unreliable, so a DOM wheel event goes to the canvas the same way a mouse's would)
  await page.evaluate(() => document.getElementById('game').dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }))); await sim(page, 1);
  const keyed = await page.evaluate(() => { const b = window.__game.survival.build; return { r: b.r, lv: b.lv }; });
  await page.keyboard.press('KeyX'); await sim(page, 1);
  const left = await page.evaluate(k => ({ off: !window.__game.survival.build, same: JSON.stringify(window.__game.survival.record.kits) === k }), keys0);
  R.ok(keyed.r === 2 && keyed.lv === 1, 'T and the mouse wheel rotate, ] raises the build level', JSON.stringify(keyed));
  R.ok(left.off && left.same, 'X / right click cancels build mode without spending anything', JSON.stringify(left));

  // ---------------------------------------------------------------- the real UI: G, Build tab, Place, a mouse click
  await page.evaluate(h => { const H = window.__H, g = window.__game; H.give({ timber_floor: 2 }); H.tp(h.x0 + 3, h.z0 + 8.5, 0); g.noRender = false; g.render(0.016); }, H0);
  await page.keyboard.press('KeyG'); await page.waitForTimeout(150);
  await page.locator('#sv-panel [data-tab="build"]').click();
  await page.locator('#sv-panel [data-act="place"][data-id="timber_floor"]').click(); await page.waitForTimeout(100);
  const aim = await page.evaluate(h => { const g = window.__game, x = h.x0 + 5, z = h.z0 + 7; window.__sim(1); g.render(0.016); const s = g.pr.project({ x, y: 0.1, z }); return { sx: s.x, sy: s.y, cell: [Math.floor(x / 2), Math.floor(z / 2)] }; }, H0);
  await page.mouse.move(aim.sx, aim.sy); await sim(page, 2);
  const bar = await page.evaluate(() => document.getElementById('sv-build').textContent);
  await page.mouse.click(aim.sx, aim.sy); await sim(page, 2);
  const uiPlaced = await page.evaluate(c => { const S = window.__game.survival; return S.record.structures.some(s => s.type === 'timber_floor' && Math.floor(s.x / 2) === c[0] && Math.floor(s.z / 2) === c[1] && !s.lv); }, aim.cell);
  await page.keyboard.press('BracketRight'); await sim(page, 2);
  const upBar = await page.evaluate(() => document.getElementById('sv-build').textContent);
  const kitsUp = await page.evaluate(() => ({ k: window.__game.survival.record.kits.timber_floor, n: window.__game.survival.record.structures.length }));
  await page.mouse.click(aim.sx, aim.sy); await sim(page, 2);
  const upRefused = await page.evaluate(k => { const R = window.__game.survival.record; return R.kits.timber_floor === k.k && R.structures.length === k.n; }, kitsUp);
  await page.keyboard.press('KeyX'); await sim(page, 1);
  R.ok(/Timber floor/.test(bar) && /ground floor/.test(bar), 'the build bar names the piece and the level', bar);
  R.ok(uiPlaced, 'Craft & build → Build → Place, then a mouse click, lays a floor exactly under the cursor', JSON.stringify(aim));
  R.ok(/upper floor/.test(upBar) && /wall or post below/.test(upBar) && upRefused, '] switches to the upper floor; an unsupported upper floor shows why and is not placed or paid for', upBar);

  // ---------------------------------------------------------------- repeated placement and removal stays bounded
  const churn = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, g = window.__game, c = H.cell(h.cx, h.cz + 5);
    const count = () => { const m = new Set(), geo = new Set(); g.scene.traverse(o => { if (o.material) m.add(o.material.uuid); if (o.geometry) geo.add(o.geometry.uuid); }); return { ents: g.entities.length, mats: m.size, geos: geo.size, slots: S.grid.slots.size }; };
    window.__sim(2); const a = count();
    for (let i = 0; i < 30; i++) { H.give({ timber_wall: 1, timber_floor: 1 }); const f = H.put('timber_floor', c.x, c.z, 0), w = H.put('timber_wall', c.x, c.z - 1, 0, 0); S.removePiece(w.id); S.removePiece(f.id); window.__sim(1); }
    for (let i = 0; i < 10; i++) { S.startBuild('timber_floor'); window.__sim(1); S.endBuild(); }
    window.__sim(2); const b = count();
    return { a, b };
  }, H0);
  R.ok(churn.b.ents === churn.a.ents && churn.b.mats === churn.a.mats && churn.b.geos === churn.a.geos && churn.b.slots === churn.a.slots, '30 place/remove cycles and 10 ghosts leave entity, material, geometry and slot counts unchanged', JSON.stringify(churn));
  console.log('   counts after churn:', JSON.stringify(churn.b));

  // ---------------------------------------------------------------- exact refunds and dependants
  const refund = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, R = S.record, G = S.grid, c = (i, j) => H.cell(h.cx + i, h.cz + j);
    // a lone deck held up by one post: the post cannot come down from under it
    const d = c(0, 8); H.give({ timber_post: 1, timber_floor: 1 }); const post = H.put('timber_post', d.x - 1, d.z - 1, 0), deck = H.put('timber_floor', d.x, d.z, 1);
    const a = post.ok && deck.ok ? S.canRemove(post.id) : 'setup failed', chestUp = G.ents.get(h.chestUp), floorUp = [...G.ents.values()].find(e => e.type === 'timber_floor' && e.lv === 1 && Math.floor(e.x / 2) === h.cx + 2 && Math.floor(e.z / 2) === h.cz);
    const b = S.canRemove(floorUp.s.id);
    const roof = [...G.ents.values()].find(e => e.type === 'thatch_roof');
    const c1 = S.canRemove(roof.s.id);
    // a free-standing wall comes down with exactly one kit back, once
    H.give({ timber_wall: 1 }); const lone = H.put('timber_wall', c(0, 4).x, c(0, 4).z - 1, 0, 0);
    const k0 = R.kits.timber_wall, first = S.removePiece(lone.id), k1 = R.kits.timber_wall, second = S.removePiece(lone.id), k2 = R.kits.timber_wall;
    // chest contents go back to resources when a chest comes down
    const wood0 = R.resources.wood; H.give({ chest: 1 }); const ch = H.put('chest', c(0, 4).x + 0.5, c(0, 4).z + 0.5, 0, 0); R.resources.wood += 5; S.deposit(G.ents.get(ch.id), 'wood', 5);
    const took = S.removePiece(ch.id), wood1 = R.resources.wood;
    return { a, b, c1, first: first.ok, second: second.ok, once: k1 - k0 === 1 && k2 === k1, gone: !R.structures.some(s => s.id === lone.id), chestBack: took.ok && wood1 === wood0 + 5 && !R.storage[ch.id] };
  }, H0);
  R.ok(/holds up/i.test(refund.a) && /furniture/i.test(refund.b) && /holds up/i.test(refund.c1), 'taking down a support, a furnished floor or a roof under its gable is refused with a reason (nothing is dropped)', JSON.stringify(refund));
  R.ok(refund.first && !refund.second && refund.once && refund.gone, 'a removal refunds exactly one kit, once', JSON.stringify(refund));
  R.ok(refund.chestBack, 'a chest taken down returns its contents to your resources', JSON.stringify(refund));

  // ---------------------------------------------------------------- entrapment and bodies
  const trap = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, g = window.__game, p = g.player, c = (i, j) => H.cell(h.cx + i, h.cz + j);
    // stand in the house's ground-floor west room; the only way out is the door: a wall there would trap you
    H.tp(h.x0 + 1, h.z0 + 3, 0.3);
    const onDoor = S.checkPiece({ type: 'timber_wall', x: h.x0 + 1, z: h.z0 + 4, lv: 0, r: 0 });
    const onMe = S.checkPiece({ type: 'timber_post', x: h.x0 + 2, z: h.z0 + 2, lv: 0 });
    H.tp(c(0, 6).x, c(0, 6).z, 0);
    const standing = S.checkPiece({ type: 'timber_wall', x: c(0, 6).x, z: c(0, 6).z - 1 + 0.9, lv: 0, r: 0 });
    return { onDoor, onMe, standing };
  }, H0);
  R.ok(/taken|already/i.test(trap.onDoor) || /wall you in/i.test(trap.onDoor), 'you cannot wall yourself in (the door slot is taken or refused)', JSON.stringify(trap));
  R.ok(/standing there|in the way/i.test(trap.standing), 'walls cannot be placed on top of you', JSON.stringify(trap));

  // ---------------------------------------------------------------- doors
  const door = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, g = window.__game, p = g.player, G = S.grid;
    const d = [...G.ents.values()].find(e => e.type === 'timber_door' && !e.gen);
    H.tp(d.x, d.z + 1.3, 0); p.facing = Math.PI; g.godMode = true;
    window.__sim(30, ['KeyW']); const shut = H.state();
    const it = g.interactTarget(), prompt = it && it.prompt; it && it.interact(); window.__sim(20);
    window.__sim(30, ['KeyW']); const open = H.state();
    // cannot close while standing in the doorway
    H.tp(d.x, d.z, 0.3); const block = S.toggleDoor(d);
    H.tp(d.x, d.z - 1.3, 0.3); const close = S.toggleDoor(d); window.__sim(20);
    window.__sim(30, ['KeyS']); const back = H.state();
    return { dz: d.z, shut, prompt, open, block, close, back, saved: S.record.structures.find(s => s.id === d.id).open };
  }, H0);
  R.ok(door.shut.z > door.dz + 0.1 && /open the door/i.test(door.prompt), 'a closed door blocks the way and offers "Open the door"', JSON.stringify(door));
  R.ok(door.open.z < door.dz - 0.5, 'an open door lets you walk through', JSON.stringify(door.open));
  R.ok(door.block === false && door.close === true && door.back.z < door.dz - 0.1 && door.saved === false, 'a door cannot shut on you; closed again it blocks from the inside too, and its state is saved', JSON.stringify(door));

  // ---------------------------------------------------------------- stairs, both ways and from the sides
  const stairs = await page.evaluate(h => {
    const H = window.__H, g = window.__game, p = g.player, trace = [];
    // the stairs climb +x in module (cx+1, cz+1); enter at the low (west) end
    H.tp(h.x0 + 1.2, h.z0 + 3, 0.3); p.facing = Math.PI / 2;
    for (let i = 0; i < 14; i++) { window.__sim(4, ['KeyD']); trace.push(H.state().fy); }
    const top = H.state();
    window.__sim(20, ['KeyW']); const upstairs = H.state(); // step off the top onto the upper floor
    window.__sim(20, ['KeyS']); window.__sim(4);
    const down = []; for (let i = 0; i < 16; i++) { window.__sim(4, ['KeyA']); down.push(H.state().fy); }
    const bottom = H.state();
    // from the side (a rail) and from behind (the underside) the stairs are closed
    H.tp(h.x0 + 3, h.z0 + 1, 0.3); window.__sim(30, ['KeyS']); const side = H.state();
    H.tp(h.x0 + 5, h.z0 + 3, 0.3); window.__sim(30, ['KeyA']); const behind = H.state();
    return { trace, top, upstairs, down, bottom, side, behind, monotone: trace.every((v, i) => i === 0 || v >= trace[i - 1] - 0.01) };
  }, H0);
  R.ok(stairs.top.fy > 2 && stairs.monotone && stairs.trace.filter(v => v > 0.4 && v < 2).length >= 2, 'walking up the stairs raises you smoothly to the upper floor', stairs.trace.join(','));
  R.ok(stairs.upstairs.fy > 2 && stairs.upstairs.z < stairs.top.z - 0.3, 'you walk off the top onto the upper floor and stay up there', JSON.stringify(stairs.upstairs));
  R.ok(stairs.bottom.fy < 0.4 && stairs.down.some(v => v > 0.5 && v < 1.9), 'walking back down lowers you step by step to the ground floor', stairs.down.join(','));
  R.ok(stairs.side.fy < 0.4 && stairs.side.z < H0.z0 + 2.2 && stairs.behind.fy < 0.4 && stairs.behind.x > H0.x0 + 3.9, 'the rails and underside keep you off the stairs from the side and from behind', JSON.stringify([stairs.side, stairs.behind]));

  // ---------------------------------------------------------------- upstairs: support, walls, edges, falls
  const up = await page.evaluate(h => {
    const H = window.__H, g = window.__game, p = g.player, S = g.survival;
    H.tp(h.x0 + 1, h.z0 + 1, 2.1); window.__sim(5); const stand = H.state();
    window.__sim(40, ['KeyA']); const wall = H.state(); // the upper west wall holds
    // the same x/z on the ground floor below is a separate room
    const below = S.pickTarget(h.x0 + 1, h.z0 + 1, 0), above = S.pickTarget(h.x0 + 1, h.z0 + 1, 1);
    // an open edge: stand on a lone upper floor held by one post and walk off it
    const c = H.cell(h.cx + 5, h.cz); H.give({ timber_post: 1, timber_floor: 1 });
    const post = H.put('timber_post', c.x - 1, c.z - 1, 0), fl = H.put('timber_floor', c.x, c.z, 1);
    H.tp(c.x, c.z, 2.1); window.__sim(4); const onDeck = H.state();
    const hp0 = g.inv.hp; window.__sim(40, ['KeyD']); const fell = H.state();
    return { stand, wall, below: below && below.type, above: above && above.type, post: post.ok, fl: fl.ok, onDeck, fell, hurt: g.inv.hp < hp0 };
  }, H0);
  R.ok(up.stand.fy > 2 && up.wall.x > H0.x0 + 0.2, 'upstairs you stand on the floor and upper walls block you', JSON.stringify(up));
  R.ok(up.below === 'timber_floor' || up.below === 'stone_foundation', 'the ground floor and the upper floor share x/z as separate storeys', JSON.stringify([up.below, up.above]));
  R.ok(up.post && up.fl && up.onDeck.fy > 2 && up.fell.fy < 0.05 && !up.hurt, 'a post holds a deck; walking off its open edge drops you to the ground without damage', JSON.stringify(up));

  // ---------------------------------------------------------------- chests on both floors
  const chests = await page.evaluate(h => {
    const S = window.__game.survival, G = S.grid, R = S.record, g = window.__game, H = window.__H;
    R.resources.stone = 10; R.resources.fibre = 10;
    S.deposit(G.ents.get(h.chestDown), 'stone', 4); S.deposit(G.ents.get(h.chestUp), 'fibre', 6);
    H.tp(h.x0 + 4.5, h.z0 + 1.5, 0.3); g.player.facing = Math.PI; window.__sim(2); const t0 = g.interactTarget();
    H.tp(h.x0 + 4.5, h.z0 + 1.5, 2.1); g.player.facing = Math.PI; window.__sim(2); const t1 = g.interactTarget();
    return { down: R.storage[h.chestDown], up: R.storage[h.chestUp], t0: t0 && t0.id, t1: t1 && t1.id };
  }, H0);
  R.ok(chests.down.stone === 4 && !chests.down.fibre && chests.up.fibre === 6 && !chests.up.stone, 'two chests one storey apart keep separate contents', JSON.stringify(chests));
  R.ok(chests.t0 === H0.chestDown && chests.t1 === H0.chestUp, 'you open the chest on your own floor only', JSON.stringify(chests));

  // ---------------------------------------------------------------- storey-separated combat
  const combat = await page.evaluate(async h => {
    const g = window.__game, p = g.player, H = window.__H, { makeEnemy } = await import('/src/entities/enemies.js');
    const foe = (x, z, fy) => { const e = makeEnemy(g, 'blot', x, z); e.fy = fy; e.spawnT = 0; e.update = function () { this.sync(); }; g.spawn(e); e.sync(); return e; };
    H.tp(h.x0 + 1, h.z0 + 1.2, 0.3); p.facing = 0;
    const upFoe = foe(h.x0 + 1, h.z0 + 2, 2.1), hp0 = upFoe.hp;
    g.hitArc(p, p.x, p.z, 0, 2, Math.PI, { mult: 3, kind: 'sword', kb: 1, id: 991 }); p.hitSet.clear();
    const melee = upFoe.hp === hp0;
    const hurt = p.hurt({ dmg: 5, x: upFoe.x, z: upFoe.z, src: upFoe, kb: 1 });
    // an arrow shot straight at it from below passes under
    const { Projectile } = await import('/src/rpg/combat.js');
    g.spawn(new Projectile(g, { x: p.x, z: p.z + 0.3, dir: 0, speed: 20, range: 4, mult: 1, kind: 'arrow' }));
    window.__sim(20); const shot = upFoe.hp === hp0;
    // the same foe on your own floor is hit (the test is real)
    const low = foe(h.x0 + 1, h.z0 + 2, 0.3), lhp = low.hp; p.fy = 0.3; p.hitSet.clear();
    g.hitArc(p, p.x, p.z, 0, 2, Math.PI, { mult: 3, kind: 'sword', kb: 1, id: 992 });
    const sameHit = low.hp < lhp;
    // walls stop shots on their own storey: shoot at a foe outside through the north wall
    low.remove(); upFoe.remove();
    const out = foe(h.x0 + 1, h.z0 - 2, 0), ohp = out.hp; H.tp(h.x0 + 1, h.z0 + 1, 0.3);
    g.spawn(new Projectile(g, { x: p.x, z: p.z - 0.3, dir: Math.PI, speed: 20, range: 6, mult: 1, kind: 'arrow' })); window.__sim(20);
    const walled = out.hp === ohp; out.remove();
    return { melee, hurt, shot, sameHit, walled };
  }, H0);
  R.ok(combat.melee && combat.hurt === false && combat.shot, 'nothing reaches through a floor: melee, a foe upstairs striking down, and an arrow fired from below all miss', JSON.stringify(combat));
  R.ok(combat.sameHit && combat.walled, 'the same foe on your floor is hit, and a wall stops an arrow on its own storey', JSON.stringify(combat));

  // ---------------------------------------------------------------- cutaway and a screenshot of the house
  const cut = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, g = window.__game, G = S.grid;
    const roof = [...G.ents.values()].find(e => e.type === 'thatch_roof' && !e.gen), upWall = [...G.ents.values()].find(e => e.type === 'timber_window' && e.lv === 1 && !e.gen);
    H.tp(h.x0 + 3, h.z0 + 9, 0); window.__sim(20); const outside = { roof: roof.model.visible, wall: upWall.model.visible };
    H.tp(h.x0 + 1, h.z0 + 3, 0.3); window.__sim(20); const inside = { roof: roof.model.visible, wall: upWall.model.visible, active: !!S.cut.active };
    H.tp(h.x0 + 1, h.z0 + 1, 2.1); window.__sim(20); const upstairs = { roof: roof.model.visible, active: !!S.cut.active };
    const mats = new Set(); g.scene.traverse(o => { if (o.material) mats.add(o.material.uuid); });
    return { outside, inside, upstairs, mats: mats.size };
  }, H0);
  R.ok(cut.outside.roof && cut.outside.wall && !cut.inside.roof && !cut.inside.wall && cut.inside.active && !cut.upstairs.roof, 'inside, the roof and the storey above fade away; outside they come back', JSON.stringify(cut));
  await page.evaluate(h => window.__H.tp(h.x0 + 1, h.z0 + 1, 2.1), H0); await sim(page, 20); await shot(page, 'char_upstairs_player_house');
  await page.evaluate(h => { window.__H.tp(h.x0 + 7.5, h.z0 + 6.5, 0); window.__game.player.facing = Math.PI; }, H0); await sim(page, 30); await shot(page, 'player_built_house');

  // ---------------------------------------------------------------- save and reload upstairs
  await page.evaluate(async h => { const g = window.__game; window.__H.tp(h.x0 + 1, h.z0 + 1, 2.1); window.__sim(5); await g.save(); }, H0);
  const snap = await page.evaluate(() => { const R = window.__game.survival.record; return { n: R.structures.length, storage: JSON.stringify(R.storage), pos: R.pos }; });
  await boot(page);
  await page.evaluate(id => window.__startSurvival(id), wid); await page.waitForFunction(() => window.__game.area?.id === 'wilds');
  await helpers(page); await sim(page, 5);
  const back = await page.evaluate(() => { const g = window.__game, S = g.survival, R = S.record; return { n: R.structures.length, live: [...S.grid.ents.values()].filter(e => !e.gen).length, storage: JSON.stringify(R.storage), ...window.__H.state(), roofs: [...S.grid.ents.values()].filter(e => e.type === 'thatch_roof' && !e.gen).length }; });
  R.ok(back.n === snap.n && back.storage === snap.storage && back.roofs === 4, 'after a reload every piece, both chests and their contents are back', JSON.stringify(back));
  R.ok(back.fy > 2 && Math.abs(back.x - snap.pos.x) < 0.01 && Math.abs(back.z - snap.pos.z) < 0.01, 'you wake upstairs where you saved', JSON.stringify([back, snap.pos]));
  await page.evaluate(h => { window.__H.tp(h.x0 + 7.5, h.z0 + 6.5, 0); window.__game.player.facing = Math.PI; }, H0); await sim(page, 30); await shot(page, 'house_restored_after_reload');

  // ---------------------------------------------------------------- unstuck, go home, death upstairs
  const life = await page.evaluate(async h => {
    const H = window.__H, g = window.__game, S = g.survival, p = g.player;
    H.tp(h.x0 + 1, h.z0 + 1, 2.1); window.__sim(3); S.unstick(true); const un = H.state();
    H.tp(h.x0 + 1, h.z0 + 1, 2.1); g.godMode = false; g.inv.hp = 1; p.invuln = 0; p.hurt({ dmg: 99, x: p.x, z: p.z + 1, src: null, kb: 1 }); window.__sim(60);
    await new Promise(r => setTimeout(r, 1500)); const dead = g.dead; g.revive(); await new Promise(r => setTimeout(r, 1200)); window.__sim(5);
    const rev = { ...H.state(), area: g.area.id }; g.godMode = true;
    H.tp(h.x0 + 1, h.z0 + 1, 2.1); p.combatT = 0; S.goHome(); await new Promise(r => setTimeout(r, 1200)); window.__sim(5);
    return { un, dead, rev, home: { ...H.state(), area: g.area.id } };
  }, H0);
  R.ok(life.un.fy > 2, 'Unstuck upstairs keeps you on the upper floor when it is open', JSON.stringify(life.un));
  R.ok(life.dead && life.rev.area === 'wilds' && life.rev.hp > 1 && life.rev.fy < 0.4 && life.home.area === 'wilds' && life.home.fy < 0.4, 'dying upstairs and Go Home both bring you back to open ground safely', JSON.stringify(life));

  // ---------------------------------------------------------------- generated houses
  const genH = await page.evaluate(async () => {
    const G = await import('/src/survival/gen.js'), T = await import('/src/survival/templates.js');
    const all = s => { const o = []; for (let rz = 0; rz < 10; rz++) for (let rx = 0; rx < 10; rx++) { const h = G.regionHouse(s, rx, rz); if (h) o.push(h.id + h.t + h.x0 + ',' + h.z0 + h.k); } return o; };
    const a = all(4243), b = all(4243), c = all(99);
    const kinds = new Set(); for (let rz = 0; rz < 10; rz++) for (let rx = 0; rx < 10; rx++) { const h = G.regionHouse(4243, rx, rz); if (h) kinds.add(h.t); }
    return { same: a.join() === b.join(), n: a.length, differ: a.join() !== c.join(), kinds: [...kinds], v1: G.fingerprint(4243, 8, 8, 11, 11, 1), v1none: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every(r => !G.regionHouse(4243, r, r, undefined, 1)), stable: T.instantiate({ id: 'house:1,1', t: 'cottage', x0: 100, z0: 100, k: 0 }).pieces.map(p => p.id).join() === T.instantiate({ id: 'house:1,1', t: 'cottage', x0: 100, z0: 100, k: 2 }).pieces.map(p => p.id).join() };
  });
  R.ok(genH.same && genH.differ && genH.n > 5 && genH.n < 60 && genH.kinds.length === 3, 'generated houses: the same seed gives the same bounded set, other seeds differ, all three templates appear', JSON.stringify(genH));
  R.ok(genH.v1 === 'f637d3a3' && genH.v1none, 'generator v1 worlds get no houses and exactly the same land as before this pass', genH.v1);
  R.ok(genH.stable, 'generated pieces have stable ids independent of how the house is turned');

  // walk into the nearest generated cottage and upstairs, change it, reload, and find it changed
  const cot = await page.evaluate(async () => {
    const G = await import('/src/survival/gen.js'), S = window.__game.survival, H = window.__H, g = window.__game;
    let h = null; for (let rz = 3; rz <= 7 && !h; rz++) for (let rx = 3; rx <= 7 && !h; rx++) { const c = G.regionHouse(S.record.seed, rx, rz); if (c && c.t === 'cottage') h = c; }
    H.tp(h.x0 + 3, h.z0 + (h.k ? -2 : 6), 0); window.__sim(5);
    const pcs = [...S.grid.ents.values()].filter(e => e.gen === h.id), door = pcs.find(e => e.type === 'timber_door'), st = pcs.find(e => e.type === 'timber_stairs');
    // open its door by walking up to it and interacting, then walk in
    const out = h.k ? -1 : 1; H.tp(door.x, door.z + out * 0.9, 0); g.player.facing = out > 0 ? Math.PI : 0; window.__sim(2);
    const it = g.interactTarget(); const prompt = it && it.prompt; it && it.interact(); window.__sim(15);
    window.__sim(25, [out > 0 ? 'KeyW' : 'KeyS']); const inside = H.state();
    // climb its stairs
    const D = [[0, 1], [1, 0], [0, -1], [-1, 0]][st.s.r], key = D[0] === 1 ? 'KeyD' : D[0] === -1 ? 'KeyA' : D[1] === 1 ? 'KeyS' : 'KeyW';
    H.tp(st.x - D[0] * 1.7, st.z - D[1] * 1.7, 0.3); window.__sim(40, [key]); const upst = H.state();
    // take down a gable (its kit comes back once) and leave the door open
    const gable = pcs.find(e => e.type === 'timber_gable'), k0 = S.record.kits.timber_gable || 0, rm = S.removePiece(gable.id);
    await g.save();
    return { id: h.id, t: h.t, pieces: pcs.length, prompt, inside, doorZ: door.z, out, upst, gable: gable.id, rm: rm.ok, kit: (S.record.kits.timber_gable || 0) - k0, mods: S.record.houses[h.id] };
  });
  R.ok(cot.pieces > 40 && /open the door/i.test(cot.prompt) && (cot.out > 0 ? cot.inside.z < cot.doorZ - 0.4 : cot.inside.z > cot.doorZ + 0.4), 'a generated cottage is made of real pieces and you walk in through its door', JSON.stringify(cot));
  R.ok(cot.upst.fy > 2, 'its stairs take you to its upper floor', JSON.stringify(cot.upst));
  R.ok(cot.rm && cot.kit === 1 && cot.mods.removed[cot.gable] && Object.values(cot.mods.open).includes(true), 'taking down a generated piece refunds one kit and is recorded, with the opened door', JSON.stringify(cot.mods));
  await page.evaluate(async () => { await window.__game.save(); });
  await boot(page); await page.evaluate(id => window.__startSurvival(id), wid); await page.waitForFunction(() => window.__game.area?.id === 'wilds'); await helpers(page);
  const cot2 = await page.evaluate(c => {
    const S = window.__game.survival, H = window.__H, g = window.__game; H.tp(c.upst.x, c.upst.z, 0); window.__sim(3);
    const pcs = [...S.grid.ents.values()].filter(e => e.gen === c.id), door = pcs.find(e => e.type === 'timber_door');
    const k0 = S.record.kits.timber_gable, again = S.removePiece(c.gable);
    return { pieces: pcs.length, gableBack: pcs.some(e => e.id === c.gable), doorOpen: !!door.s.open, again: again.ok, kit: S.record.kits.timber_gable - k0 };
  }, cot);
  R.ok(cot2.pieces === cot.pieces - 1 && !cot2.gableBack && cot2.doorOpen, 'after a reload the generated house keeps your changes: the gable stays down, the door stays open', JSON.stringify(cot2));
  R.ok(!cot2.again && cot2.kit === 0, 'a taken-down generated piece never regrows, so it cannot be farmed by reloading', JSON.stringify(cot2));

  // ---------------------------------------------------------------- streaming: leave and come back, three times
  const stream = await page.evaluate(h => {
    const H = window.__H, S = window.__game.survival, g = window.__game, out = [];
    H.tp(h.x0 + 1 + 150, h.z0 + 9, 0); window.__sim(3); // settle: only the 3x3 chunks around you stay
    for (let i = 0; i < 3; i++) {
      H.tp(h.x0 + 1, h.z0 + 9, 0); window.__sim(3);
      const at = { ents: g.entities.length, grid: S.grid.slots.size, ids: S.grid.ents.size };
      H.tp(h.x0 + 1 + 150, h.z0 + 9, 0); window.__sim(3); const away = { grid: S.grid.slots.size };
      out.push({ ...at, away: away.grid });
    }
    H.tp(h.x0 + 1, h.z0 + 9, 0); window.__sim(3);
    const mats = new Set(), geos = new Set(); g.scene.traverse(o => { if (o.material) mats.add(o.material.uuid); if (o.geometry) geos.add(o.geometry.uuid); });
    return { out, mats: mats.size, geos: geos.size };
  }, H0);
  const same = stream.out.every(o => o.ents === stream.out[0].ents && o.grid === stream.out[0].grid);
  R.ok(same && stream.out.every(o => o.away < o.grid), 'leaving and returning three times rebuilds exactly the same pieces (no leaks, nothing lost)', JSON.stringify(stream));
  console.log('   counts: entities', stream.out[0].ents, 'house slots', stream.out[0].grid, 'materials', stream.mats, 'geometries', stream.geos);

  // ---------------------------------------------------------------- caves
  const cave = await page.evaluate(async h => {
    const S = window.__game.survival, g = window.__game, H = window.__H, c = S.firstCave();
    H.tp(c.x, c.z + 2.4, 0); window.__sim(3);
    g.entities.find(e => e.id === 'cave:' + c.rx + ',' + c.rz).interact(); await new Promise(r => setTimeout(r, 1500));
    const inCave = { area: g.area.id, slots: S.grid.slots.size, fy: g.player.fy || 0 };
    S.leaveCave(); await new Promise(r => setTimeout(r, 1500)); window.__sim(3);
    H.tp(h.x0 + 1, h.z0 + 9, 0); window.__sim(3);
    return { inCave, back: g.area.id, slots: S.grid.slots.size };
  }, H0);
  R.ok(cave.inCave.area === 'cave' && cave.inCave.slots === 0 && cave.back === 'wilds' && cave.slots > 40, 'caves have no house pieces; coming back out restores your house', JSON.stringify(cave));

  // ---------------------------------------------------------------- old saves
  const old = await page.evaluate(async () => {
    const St = await import('/src/survival/store.js');
    const raw = { id: 'wold', seed: 5, name: 'Old', character: { cls: 'archer' }, resources: { wood: 3 }, structures: [{ id: 's1', type: 'wall', x: 240.5, z: 238.5 }, { id: 's2', type: 'campfire', x: 242.5, z: 238.5 }, { type: 'chest' }, { id: 's4', type: 'chest', x: '243.5', z: 238.5, lv: 'x', r: 7 }], kits: { floor: 2 } };
    const w = St.normalizeWorld(raw);
    return { gen: w.genVersion, n: w.structures.length, lv: w.structures.map(s => s.lv ?? 0).join(), r: w.structures.map(s => s.r ?? 0).join(), broken: (w.brokenStructures || []).length, houses: JSON.stringify(w.houses), x: w.structures[2].x };
  });
  R.ok(old.gen === 1 && old.n === 3 && old.lv === '0,0,0' && old.r === '0,0,3' && old.broken === 1 && old.houses === '{}' && old.x === 243.5, 'old saves load with ground-floor, unturned defaults; a broken record is kept aside, never deleted', JSON.stringify(old));

  // ---------------------------------------------------------------- isolation: Story and MOSSDEV
  const iso = await page.evaluate(async () => {
    const g = window.__game; await g.save();
    const world = localStorage.getItem('mossling-survival-v1');
    await g.devlab.enter(); const frozen = localStorage.getItem('mossling-survival-v1'); const hooks = !g.support && !g.sameLevel && !g.onSpawn;
    g.devlab.setClass('witch'); await g.save(); const isolated = localStorage.getItem('mossling-survival-v1') === frozen;
    await g.devlab.exit(); window.__sim(3);
    const R = g.survival.record;
    return { isolated, hooks, back: !!g.survival && !!g.support, cls: g.inv.cls, n: R.structures.length, sandbox: /sandbox|devlab|lab:/i.test(JSON.stringify(R.structures)), same: world.length > 0 };
  });
  R.ok(iso.isolated && iso.hooks, 'MOSSDEV suspends Survival and its house hooks, and cannot write the Survival save', JSON.stringify(iso));
  R.ok(iso.back && iso.cls === 'samurai' && iso.n === snap.n - 0 && !iso.sandbox, 'returning from MOSSDEV restores the Survival world and its houses with nothing from the lab', JSON.stringify(iso));
  // refreshing inside MOSSDEV, then returning, brings the houses back too
  await page.evaluate(async () => { const g = window.__game; g.settings.devMode = true; localStorage.setItem('mossling-settings', JSON.stringify(g.settings)); await g.devlab.enter(); });
  await page.reload(); await page.waitForFunction(() => window.__game?.devlab?.active && !document.getElementById('loading'), null, { timeout: 30000 });
  const refreshed = await page.evaluate(async h => { const g = window.__game; await g.devlab.exit(); window.__sim(3); return { on: !!g.survival, hooks: !!g.support, n: g.survival.record.structures.length, live: [...g.survival.grid.ents.values()].filter(e => !e.gen).length }; }, H0);
  R.ok(refreshed.on && refreshed.hooks && refreshed.n === iso.n, 'refreshing inside MOSSDEV and returning restores Survival with its houses and house rules', JSON.stringify(refreshed));
  const storyAfter = await page.evaluate(() => localStorage.getItem('mossling-save-v2'));
  R.ok(storyAfter === storyBefore, 'the story save is byte-for-byte unchanged by all of this');
}
