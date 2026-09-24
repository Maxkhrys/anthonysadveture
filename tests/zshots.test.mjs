// Visual capture set (not a regression check). OUT=<dir> node tests/run.mjs zshots
import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const shot = async (page, name) => { await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 3; i++) g.render(0.05); }); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const at = (page, x, z, face = 0) => page.evaluate(([x, z, f]) => { const g = window.__game, p = g.player; p.x = x; p.z = z; p.facing = f; g.snapCamera(); }, [x, z, face]);
export default async function (page, R) {
  await page.screenshot({ path: `${OUT}/00_title.png` });
  await fresh(page, 'samurai', { stage: 1, level: 5 });
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; });
  await at(page, 58.5, 62.5); await sim(page, 10); await shot(page, '01_village_day');
  // render timing: average ms per full frame over 40 frames at 1280x720 (swiftshader: relative only)
  const ms = await page.evaluate(() => { const g = window.__game; const t0 = performance.now(); for (let i = 0; i < 40; i++) { g.update(1 / 60); } return (performance.now() - t0) / 40; });
  R.note('village frame ms (update+render, swiftshader) = ' + ms.toFixed(1));
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 420 * 0.45; });
  await sim(page, 2); await shot(page, '02_village_night');
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 420 * 0.18; });
  await at(page, 20, 44); await sim(page, 4); await shot(page, '03_forest_dusk');
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.raining = true; g.rainK = 1; });
  await at(page, 60, 88); await sim(page, 6); await shot(page, '04_shore_rain');
  await page.evaluate(() => { const g = window.__game; g.raining = false; g.rainK = 0; });
  // combat crowd
  await at(page, 58.5, 64.5);
  await page.evaluate(() => { const g = window.__game, p = g.player; for (let i = 0; i < 12; i++) { const e = g.spawnEnemy(['blot', 'brigand', 'sporeling', 'beetle'][i % 4], p.x + Math.cos(i) * 3, p.z + Math.sin(i) * 3, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(e.eliteScale || 1); } });
  await sim(page, 20);
  const ms2 = await page.evaluate(() => { const g = window.__game; const t0 = performance.now(); for (let i = 0; i < 40; i++) { g.update(1 / 60); } return (performance.now() - t0) / 40; });
  R.note('combat(12 foes) frame ms = ' + ms2.toFixed(1));
  await sim(page, 1, ['KeyJ']); await sim(page, 3); await shot(page, '05_combat');
  await page.evaluate(() => { const g = window.__game; const e = g.entities.filter(e => e.isEnemy).slice(0, 4); e.forEach(x => x.die({ dir: 0 })); });
  await sim(page, 4); await shot(page, '05b_deaths');
  await page.evaluate(() => { for (const e of window.__game.entities) if (e.isEnemy) e.remove(); });
  // inventory
  await page.evaluate(() => { const g = window.__game, inv = g.inv; for (const s of ['weapon', 'helm', 'armor', 'charm']) inv.equip[s] = window.__items.genItem({ level: 5, cls: 'samurai', slot: s, rarity: 3 }); for (let i = 0; i < 8; i++) inv.bag.push(window.__items.genItem({ level: 5, rarity: i % 5 })); g.recalc(); g.ui.openInventory(); });
  await sim(page, 2); await shot(page, '06_inventory');
  await page.evaluate(() => window.__game.ui.closeInventory());
  await page.evaluate(() => { const g = window.__game; Object.assign(g.inv.mats, { thornheart: 1, shard: 9 }); g.inv.recipes.push('thornrebuke'); g.inv.coins = 200; g.ui.openCraft(); });
  await sim(page, 2); await shot(page, '07_crafting');
  await page.evaluate(() => window.__game.ui.closeCraft());
  // dungeon + boss
  await page.evaluate(() => window.__game.warpTo('dungeon', 'entrance')); await page.waitForTimeout(1500); await sim(page, 10); await shot(page, '08_dungeon');
  await page.evaluate(() => { const g = window.__game, r = g.area.rooms.find(r => r.id === 'boss'); g.player.x = r.x0 + 8.5; g.player.z = r.z1 - 3; g.snapCamera(); });
  await sim(page, 30); await page.waitForTimeout(2600); await sim(page, 20); await shot(page, '09_boss');
  await page.evaluate(() => window.__game.warpTo('overworld', 'village')); await page.waitForTimeout(1500); await sim(page, 5);
  await page.evaluate(() => window.__game.ui.openPause && window.__game.ui.openPause()); await sim(page, 1); await shot(page, '10_map');
  await page.evaluate(() => window.__game.ui.show('pause', false));
  // hero close-up in the village at golden hour
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = (0.665 - 0.32) * 420 - g.time; g.settings.zoom = 0.75; const p = g.player; p.x = 58.5; p.z = 63.5; p.facing = 0.4; g.snapCamera(); });
  await sim(page, 40); await shot(page, '11_hero_goldenhour');
  await page.evaluate(() => { window.__game.settings.zoom = 1; });
}
