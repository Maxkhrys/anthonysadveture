// Dev Lab pass captures (not a regression check).   OUT=docs/screens/devlab node tests/run.mjs zshots_devlab
import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.jpg`, type: 'jpeg', quality: 85 });
export default async function (page, R) {
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mossling-settings') || '{}'); s.devMode = true; localStorage.setItem('mossling-settings', JSON.stringify(s)); localStorage.removeItem('mossling-devlab-v1'); });
  await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 30000 });
  await fresh(page, 'witch', { stage: 1, level: 14 });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mossling-settings') || '{}'); s.devMode = true; localStorage.setItem('mossling-settings', JSON.stringify(s)); window.__game.settings.devMode = true; });
  await page.evaluate(async () => { await window.__enterLab(); });
  await page.waitForTimeout(300); await shot(page, '01_mossdev_recently_added');
  await page.evaluate(() => { const u = window.__game.devlabUI; u.open('items'); u.f.q = 'candelabra'; u.render(); document.querySelector('#mossdev .md-item[data-id="candelabra"]').click(); });
  await page.waitForTimeout(300); await shot(page, '02_item_selection');
  await page.evaluate(() => { document.querySelector('#mossdev [data-act="details"]').click(); }); await page.waitForTimeout(200); await shot(page, '03_item_details');
  await page.evaluate(() => { const g = window.__game, u = g.devlabUI; g.devlab.store.savePreset('Fire staff dummy test'); g.devlab.store.savePreset('Chain bolt crowd'); u.open('presets'); });
  await page.waitForTimeout(200); await shot(page, '04_saved_presets');
  await page.evaluate(() => window.__game.devlabUI.open('character')); await page.waitForTimeout(200); await shot(page, '05_character');
  // lightning in a crowd
  await page.evaluate(() => { const g = window.__game; g.devlab.runManifest('fx.lightning'); g.godMode = true; });
  await sim(page, 10);
  await page.evaluate(() => { const g = window.__game, p = g.player; for (let i = 0; i < 3; i++) window.__combat.chainLightning(g, p.x, p.z, 0.3, 6, 9); g.render(0.016); });
  await shot(page, '06_lightning_crowd');
  // fire and frost
  await page.evaluate(() => { const g = window.__game, F = g.combatFx; const es = g.entities.filter(e => e.isEnemy && !e.dead).slice(0, 4); es.forEach((e, i) => F.impact({ target: e, x: e.x, z: e.z, element: i % 2 ? 'frost' : 'fire' })); es[1] && es[1].applyStatus('freeze', 4); es[0] && es[0].applyStatus('burn', 4, 1); window.__sim(4); g.render(0.016); });
  await shot(page, '07_fire_and_frost');
  // material deaths
  await page.evaluate(() => { const g = window.__game, L = g.devlab; L.profile.arenaOpts.crowdKinds = ['brigand', 'sporeling', 'porcelain', 'mantis', 'wraith']; L.profile.arenaOpts.crowdSize = 10; L.loadArena('crowd'); });
  await sim(page, 5);
  await page.evaluate(() => { const g = window.__game; const es = g.entities.filter(e => e.isEnemy && !e.dead); es.slice(0, 6).forEach((e, i) => { if (i === 2) e.applyStatus('freeze', 3); g.playerHit(e, { mult: 999, kind: 'sword', dir: 0 }); }); window.__sim(3); g.render(0.016); });
  await shot(page, '08_material_deaths');
  // telemetry panel during a dummy test
  await page.evaluate(() => { const g = window.__game, L = g.devlab; L.runManifest('combat.fireball'); const d = L.targets[0]; for (let i = 0; i < 6; i++) g.playerHit(d, { mult: 1, kind: 'bolt', element: 'fire', dir: 0 }); d.applyStatus('burn', 3, 4); });
  for (let i = 0; i < 20; i++) { await sim(page, 3); await page.waitForTimeout(30); }
  await shot(page, '09_dummy_telemetry');
  // inventory
  await page.evaluate(async () => { await window.__game.devlab.exit(); });
  await sim(page, 3);
  await page.evaluate(() => { const g = window.__game, I = window.__items; for (const id of ['candelabra', 'owlstaff', 'mothlight']) g.inv.bag.push(I.makeNamed(id, 14, null, 'witch')); for (let r = 0; r < 5; r++) g.inv.bag.push(I.genItem({ level: 14, cls: 'witch', rarity: r })); g.ui.invTab = 'bag'; g.ui.openInventory(); g.ui.invSel = 0; g.ui.itemDetails = false; g.ui.renderInventory(); });
  await page.waitForTimeout(300); await shot(page, '10_inventory_compact');
  await page.evaluate(() => { const g = window.__game; g.ui.itemDetails = true; g.ui.renderInventory(); }); await page.waitForTimeout(200); await shot(page, '11_inventory_details');
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.evaluate(() => { const g = window.__game; g.ui.itemDetails = false; g.ui.renderInventory(); }); await page.waitForTimeout(300); await shot(page, '12_inventory_1080p');
  await page.setViewportSize({ width: 760, height: 900 }); await page.waitForTimeout(300); await shot(page, '13_inventory_narrow');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mossling-settings') || '{}'); s.devMode = false; localStorage.setItem('mossling-settings', JSON.stringify(s)); localStorage.removeItem('mossling-devlab-v1'); });
  R.ok(true, 'captured');
}
