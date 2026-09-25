// Soulbound capture set (not a regression check):
//   OUT=docs/screens/soulbound node tests/run.mjs zshots_soul
import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const shot = async (page, name, close = true) => {
  // hold the frame: the real game loop would otherwise finish a 0.3 s lash before the capture
  const c = await page.evaluate(() => { const g = window.__game, p = g.player; g._upd = g.update; g.update = () => {}; for (let i = 0; i < 2; i++) g.render(0.016); const s = g.pr.project({ x: p.x, y: (p.gy || 0) + 0.5, z: p.z + 0.8 }); return s; });
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 78 });
  // and a close-up around the Soulbound
  if (close && c) await page.screenshot({ path: `${OUT}/${name}_close.jpg`, type: 'jpeg', quality: 85, clip: { x: Math.max(0, Math.min(1280 - 400, c.x - 200)), y: Math.max(0, Math.min(720 - 300, c.y - 150)), width: 400, height: 300 } });
  await page.evaluate(() => { const g = window.__game; g.update = g._upd; });
};
const zoom = (page, k) => page.evaluate(k => { const g = window.__game; g.camZoom = k; g.snapCamera(); }, k);
const foes = (page, pts, o = {}) => page.evaluate(([pts, o]) => {
  const g = window.__game, p = g.player;
  for (const e of g.entities) if (e.isEnemy) e.remove();
  for (const [dx, dz, kind] of pts) { const e = g.spawnEnemy(kind || 'blot', p.x + dx, p.z + dz, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e6; e.think = () => [0, 0]; e.obj.scale.setScalar(1); if (o.elite) g.makeElite(e); }
}, [pts, o]);
// run the game until a condition on the player holds (or a frame limit)
const until = (page, cond, keys = [], max = 120) => page.evaluate(([cond, keys, max]) => { const g = window.__game, p = g.player; const f = new Function('g', 'p', 'return ' + cond); for (let i = 0; i < max; i++) { window.__sim(1, i === 0 ? keys : []); if (f(g, p)) return i; } return -1; }, [cond, keys, max]);

export default async function (page, R) {
  // class select
  await page.evaluate(() => { const g = window.__game; g.ui.classSelect(g.input, () => {}); g.ui.csSel = 3; g.ui.csActive.render(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/01_class_select.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => { const g = window.__game; g.ui.show('classsel', false); g.ui.csActive = false; });

  await fresh(page, 'soulbound', { stage: 3, level: 14 });
  await page.evaluate(() => { const g = window.__game, inv = g.inv, S = window.__skills; inv.sp = 60; for (let pass = 0; pass < 6; pass++) for (const n of S.treeOf(inv.cls)) if (n.skill && !S.rankOf(inv, n.id)) { for (const q of n.req) if (!S.rankOf(inv, q)) S.spendNode(inv, q); S.spendNode(inv, n.id); } g.recalc(); g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.godMode = true; });
  const place = (x, z, f = 0) => page.evaluate(([x, z, f]) => { const g = window.__game, p = g.player; p.x = x; p.z = z; p.facing = f; p.aimSrc = 'keys'; p.setState('move'); g.snapCamera(); }, [x, z, f]);
  // idle with five Echoes, close up
  await place(151.5, 136.5, 2.6);
  await page.evaluate(() => { window.__game.res = 100; for (const e of window.__game.entities) if (e.isEnemy) e.remove(); });
  await zoom(page, 0.55); await sim(page, 30); await page.evaluate(() => { window.__game.player.combatT = 3; window.__game.res = 100; });
  await shot(page, '02_idle_five_echoes');
  await place(151.5, 136.5, 0.4); await page.evaluate(() => { window.__game.res = 100; window.__game.player.combatT = 3; }); await sim(page, 4);
  await shot(page, '03_idle_front');
  // the lash combo
  await zoom(page, 0.8);
  await place(151.5, 134.5, 0);
  await foes(page, [[-1.2, 2.2], [0, 2.5], [1.2, 2.2]]);
  await page.evaluate(() => { window.__game.res = 40; });
  await until(page, "p.state === 'lash' && p.st > 0.12", ['KeyC'], 20); await shot(page, '04_lash_1');
  await until(page, "p.state === 'move'", [], 60);
  await until(page, "p.state === 'lash' && p.combo === 2 && p.st > 0.12", ['KeyC'], 30);
  await until(page, "p.state === 'lash' && p.combo === 2 && p.st > 0.12", ['KeyC'], 30);
  await shot(page, '05_lash_2');
  // straight to the thrust and the sweep through the real input path
  await page.evaluate(() => { const g = window.__game, p = g.player; p.setState('move'); });
  for (const c of [3, 4]) {
    await page.evaluate(c => { const g = window.__game, p = g.player; p.combo = c - 1; p.state = 'lash'; window.__sb.startLash(p); }, c);
    await until(page, `p.state === 'lash' && p.st > ${c === 3 ? 0.15 : 0.22}`, [], 30);
    await shot(page, c === 3 ? '06_lash_3_pierce' : '07_lash_4_sweep');
  }
  // charged whirl
  await place(151.5, 134.5, 0);
  await foes(page, [[-2, 1], [2, 1], [0, 2.2], [0, -2]]);
  await page.evaluate(() => { const g = window.__game, p = g.player; p.setState('charge'); p.chargeT = 0.8; });
  await sim(page, 10, ['KeyC']); await shot(page, '08_winding');
  await page.evaluate(() => { const g = window.__game, p = g.player; p.setState('spin'); p.attackId++; p.hitSet.clear(); });
  await until(page, "p.st > 0.2", [], 30); await shot(page, '09_whirl');
  // Soul Hook: pulling a small foe
  const cast = async (id, name, cond, setup, max = 60) => {
    await place(151.5, 134.5, 0);
    await page.evaluate(id => { const g = window.__game, inv = g.inv, S = window.__skills; inv.loadout[0] = null; S.setLoadout(inv, 0, id); g.player.cdMap = {}; g.res = 100; g.input.mouseAim = false; }, id);
    if (setup) await setup();
    await until(page, cond, ['Digit1'], max);
    await shot(page, name);
  };
  await cast('soulhook', '10_soul_hook_pull', "p.state === 'hook' && p.hook && p.hook.phase === 'pull'", () => foes(page, [[0, 5]]));
  await cast('soulhook', '11_soul_hook_zip', "p.state === 'hookzip'", () => foes(page, [[0, 5.5, 'golem']], { elite: true }));
  await cast('veilshift', '12_veilshift', "p.state === 'veil' && p.st > 0.12", () => foes(page, [[0, 2.4]]));
  await cast('veilrift', '13_veil_rift', "p.state === 'rift' && p.riftOut", () => foes(page, [[-0.8, 4.2], [0.8, 4.2], [0, 5]]));
  await cast('bindingseal', '14_binding_seal', "p.state === 'cast' && p.st > 0.1", () => foes(page, [[0, 3], [0.9, 3.4], [-0.9, 3.4]]));
  await cast('echorend', '15_echo_rend', "g.entities.some(e => e.constructor.name === 'EchoLash' && e.t > e.delay + 0.08)", () => foes(page, [[0, 2.4], [0.2, 3.4]]));
  await cast('spiritvolley', '16_echo_release', "g.entities.filter(e => e.constructor.name === 'Projectile').length >= 4 && p.st > 0.12", () => foes(page, [[-1, 4], [1, 4.2], [0, 5]]));
  await cast('reapingcoil', '17_reaping_coil', "p.state === 'coil' && p.st > 0.2", () => foes(page, [[-2.6, 1], [2.6, 1], [0, 2.8]]));
  await cast('kindred', '18_kindred_lantern', "false", () => foes(page, [[1.5, 3]]), 70);
  await cast('ancestorward', '19_warden_spirits', "false", null, 40);
  // the skill tree and the inventory paper doll
  await page.evaluate(() => { for (const e of window.__game.entities) if (e.isEnemy) e.remove(); window.__game.ui.navigate ? window.__game.ui.navigate('skills') : window.__game.ui.openInventory(); });
  await sim(page, 3); await page.screenshot({ path: `${OUT}/20_skill_tree.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => { const g = window.__game; g.ui.navigate ? g.ui.navigate('bag') : 0; g.inv.bag.push(window.__items.makeNamed('duskcoil', 12), window.__items.makeNamed('lanternchain', 14)); g.ui.renderInventory && g.ui.renderInventory(); });
  await sim(page, 3); await page.screenshot({ path: `${OUT}/21_inventory.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => { const g = window.__game; g.ui.closeInventory ? g.ui.closeInventory() : 0; g.ui.show && g.ui.show('pause', false); });
  // gameplay distance, a fight at night
  await zoom(page, 1);
  await place(172.5, 150.5, 0.3);
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 420 * 0.55; g.res = 60; });
  await foes(page, [[-1.5, 2.5], [1.5, 2.2], [0, 3.4, 'brigand']]);
  await until(page, "p.state === 'lash' && p.st > 0.13", ['KeyC'], 20);
  await shot(page, '22_gameplay_distance_night');
  R.ok(true, 'captured');
}
