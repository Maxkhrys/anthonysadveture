// Pass 5 capture set (not a regression check). OUT=<dir> SHOTS=a,b node tests/run.mjs zp5
import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const WANT = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const on = n => !WANT || WANT.some(w => n.startsWith(w));
const shot = async (page, name) => { await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 3; i++) g.render(0.05); }); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const at = (page, x, z, face = 0) => page.evaluate(([x, z, f]) => { const g = window.__game, p = g.player; p.x = x; p.z = z; p.facing = f; g.snapCamera(); }, [x, z, face]);
export default async function (page, R) {
  if (on('hud')) {
    await fresh(page, 'witch', { stage: 1, level: 12 });
    await page.evaluate(() => { const g = window.__game, inv = g.inv; inv.sp = 14; for (const id of ['kindling', 'embergarden', 'searing', 'glasscomet', 'witherhex', 'mothstorm']) window.__skills.spendNode(inv, id); g.recalc(); g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.weatherT = 999; g.player.cdMap.nova = 3.2; g.player.cdMap.chain = 1.1; g.res = 62; inv.hp = inv.maxHp * 0.7; g.surge = 70; g.player.combatT = 3; });
    await at(page, 58.5, 62.5); await sim(page, 10);
    await page.evaluate(() => { const g = window.__game, p = g.player; for (let i = 0; i < 6; i++) { const e = g.spawnEnemy(['blot', 'brigand', 'sporeling'][i % 3], p.x + Math.cos(i) * 3.5, p.z - 2 + Math.sin(i) * 2, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(e.eliteScale || 1); } });
    await sim(page, 6); await shot(page, 'p5_hud');
    await page.evaluate(() => { const g = window.__game; g.ui.openInventory(); g.ui.invTab = 'skills'; g.ui.treeSel = 'glasscomet'; g.ui.renderInventory(); });
    await sim(page, 2); await shot(page, 'p5_tree_witch');
    await page.evaluate(() => window.__game.ui.closeInventory());
  }
  if (on('gear')) {
    await fresh(page, 'samurai', { stage: 1, level: 10 });
    await page.evaluate(async () => {
      const g = window.__game, p = g.player; p.x = 61.5; p.z = 72.5; p.facing = 0; g.snapCamera();
      g.flags.dayOffset = 0; g.time = 70; g.raining = false; g.weatherT = 999;
      const { makeHero } = await import('/src/hero.js');
      const I = window.__items, N = id => I.makeNamed(id, 10);
      const mk = (cls, x, z, gear, face = 0) => { const h = makeHero(cls); h.setGear(gear); h.root.position.set(x, 0, z); h.root.rotation.y = face; g.world.add(h.root); return h; };
      const set = s => ({ helm: N(s + '_helm'), armor: N(s + '_chest'), arms: N(s + '_arms'), legs: N(s + '_legs'), boots: N(s + '_boots') });
      mk('samurai', 58.5, 66.4, { ...set('bw'), weapon: N('bellclapper'), charm: N('echoclapper') });
      mk('archer', 59.6, 66.4, { ...set('ts'), weapon: N('glasswing') });
      mk('witch', 60.7, 66.4, { ...set('cw'), weapon: N('candelabra'), charm: N('shellbreaker') });
      mk('samurai', 62.1, 66.4, { weapon: N('teaspoon') }, -0.5);
      mk('witch', 63.2, 66.4, { weapon: N('parasol') }, 0.4);
      const ws = ['seamripper', 'wickblade', 'hatpin', 'lilypad', 'spoolstring', 'mothlight', 'porcelainrod'];
      ws.forEach((w, i) => mk(['samurai', 'samurai', 'samurai', 'archer', 'archer', 'witch', 'witch'][i], 57.9 + i * 0.95, 67.8, { weapon: N(w) }));
      g.camZoom = 0.36; g.camFocus = { x: 60.8, z: 67.3 };
    });
    await sim(page, 30);
    await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 3; i++) g.render(0.1); });
    await page.evaluate(() => document.getElementById('hud').classList.add('hidden'));
    await page.screenshot({ path: `${OUT}/p5_gear_lineup.png` });
    await page.evaluate(() => document.getElementById('hud').classList.remove('hidden'));
  }
  if (on('inv')) {
    await fresh(page, 'archer', { stage: 1, level: 10 });
    await page.evaluate(() => {
      const g = window.__game, inv = g.inv, I = window.__items, N = id => I.makeNamed(id, 10);
      inv.equip.weapon = N('spoolstring'); inv.equip.weapon.upgradeLevel = 6;
      for (const [k, id] of [['helm', 'ts_helm'], ['armor', 'ts_chest'], ['arms', 'ts_arms'], ['legs', 'ts_legs'], ['charm', 'echoclapper'], ['ring1', 'quickthread']]) inv.equip[k] = N(id);
      for (const id of ['ts_boots', 'glasswing', 'lilypad', 'teaspoon', 'bw_chest', 'stillwater', 'cw_helm']) inv.bag.push(N(id));
      for (let i = 0; i < 9; i++) inv.bag.push(I.genItem({ developer:true, level: 10, rarity: i % 5 }));
      const w = I.genItem({ level: 10, slot: 'weapon', cls: 'archer', rarity: 3 }); w.rolledAffixes[0] = { ...w.rolledAffixes[0], ...window.__items.rollAffixValue(w.affixes[0], 10, { targetTier: 'mythic' }) }; w.highestAffixTier = 'mythic'; w.highestAffixColor = '#e040fb'; inv.bag.push(w);
      inv.lockedItems = [inv.bag[1].itemInstanceId];
      g.recalc(); g.ui.openInventory(); g.ui.invTab = 'bag'; g.ui.invSel = 0; g.ui.renderInventory();
    });
    await sim(page, 3); await page.waitForTimeout(200); await shot(page, 'p5_inventory');
    await page.evaluate(() => { const g = window.__game; g.ui.closeInventory(); Object.assign(g.inv.mats, { shard: 30, mantis: 2, porcelain: 1 }); g.inv.coins = 600; g.ui.openCraft(); g.ui.crMode = 'reinforce'; g.ui.renderCraft(); });
    await sim(page, 2); await shot(page, 'p5_reinforce');
    await page.evaluate(() => window.__game.ui.closeCraft());
  }
  if (on('world')) {
    await fresh(page, 'samurai', { stage: 1, level: 8 });
    await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 420 * 0.63; g.time = 0; g.raining = false; g.rainK = 0; g.weatherT = 999; document.getElementById('guide').classList.add('hidden'); });
    for (const [x, z, n] of [[58.5, 52.5, 'village_root'], [86.5, 47.5, 'trowel'], [45.5, 46, 'glasshouse'], [22, 62, 'spool'], [76.5, 71, 'teacup']]) { await at(page, x, z); await sim(page, 12); await shot(page, 'p5_world_' + n); }
  }
  if (on('cons')) {
    await fresh(page, 'witch', { stage: 1, level: 9 });
    await page.evaluate(() => { const g = window.__game; g.inv.bellows = true; g.warpTo('conservatory', 'entrance'); });
    await page.waitForFunction(() => window.__game.area.id === 'conservatory' && !window.__game.transitioning, null, { timeout: 15000 });
    await page.evaluate(() => document.getElementById('guide').classList.add('hidden'));
    const room = async (id, dx = 8.5, dz = 8.5, name) => { await page.evaluate(([id, dx, dz]) => { const g = window.__game, r = g.area.rooms.find(r => r.id === id), p = g.player; p.x = r.x0 + dx; p.z = r.z0 + dz; g.updateRoom(true); g.snapCamera(); }, [id, dx, dz]); await sim(page, 20); await shot(page, name || 'p5_cons_' + id); };
    await room('atrium', 8.5, 9.5); await room('fern'); await room('pond', 3, 6); await room('glasswalk');
    await page.evaluate(() => { const g = window.__game; g.setSignal('c.torches', true, true); });
    await page.evaluate(() => { const g = window.__game, r = g.area.rooms.find(r => r.id === 'loom'), p = g.player; p.x = r.x0 + 8.5; p.z = r.z0 + 9; g.updateRoom(true); g.snapCamera(); g.noRender = true; window.__sim(2); g.noRender = false; });
    await page.waitForTimeout(2200); await shot(page, 'p5_seam_intro');
    await page.waitForTimeout(1600);
    await page.evaluate(() => { const g = window.__game; g.godMode = true; });
    await sim(page, 100); await shot(page, 'p5_seamkeeper');
    await page.evaluate(() => { const g = window.__game; g.godMode = false; });
  }
  if (on('toad')) {
    await fresh(page, 'samurai', { stage: 1, level: 12 });
    await page.evaluate(() => window.__game.warpTo('overworld', 'fen'));
    await page.waitForFunction(() => window.__game.area.id === 'overworld' && !window.__game.transitioning, null, { timeout: 15000 });
    await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 420 * 0.1; g.player.z = 90; g.snapCamera(); document.getElementById('guide').classList.add('hidden'); });
    await sim(page, 10); await shot(page, 'p5_fen');
    await page.evaluate(() => { const g = window.__game; for (const b of g.entities.filter(e => e.constructor.name === 'HangingBell')) { b.cool = 0; b.ring(); } g.wtT = 0; g.worldTick(0.1); });
    await page.waitForTimeout(3700);
    await page.evaluate(() => { window.__game.godMode = true; });
    await sim(page, 60); await shot(page, 'p5_toad');
    await page.evaluate(() => { window.__game.godMode = false; });
  }
  for (const cls of ['samurai', 'archer']) if (on('tree_' + cls)) {
    await fresh(page, cls, { stage: 1, level: 16 });
    await page.evaluate(() => { const g = window.__game, inv = g.inv; inv.sp = 15; const S = window.__skills; for (const n of S.treeOf(inv.cls)) { if (inv.sp > 4 && !S.lockReason(inv, n)) S.spendNode(inv, n.id); } g.recalc(); g.ui.openInventory(); g.ui.invTab = 'skills'; g.ui.renderInventory(); });
    await sim(page, 2); await shot(page, 'p5_tree_' + cls);
    await page.evaluate(() => window.__game.ui.closeInventory());
  }
}
