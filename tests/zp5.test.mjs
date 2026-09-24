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
  for (const cls of ['samurai', 'archer']) if (on('tree_' + cls)) {
    await fresh(page, cls, { stage: 1, level: 16 });
    await page.evaluate(() => { const g = window.__game, inv = g.inv; inv.sp = 15; const S = window.__skills; for (const n of S.treeOf(inv.cls)) { if (inv.sp > 4 && !S.lockReason(inv, n)) S.spendNode(inv, n.id); } g.recalc(); g.ui.openInventory(); g.ui.invTab = 'skills'; g.ui.renderInventory(); });
    await sim(page, 2); await shot(page, 'p5_tree_' + cls);
    await page.evaluate(() => window.__game.ui.closeInventory());
  }
}
