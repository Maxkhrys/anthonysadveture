// HUD capture set (not a regression check):  OUT=docs/screens/hud node tests/run.mjs zshots_hud
import { sim, fresh, toSquare } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
export default async function (page, R) {
  for (const c of ['soulbound', 'samurai']) {
    await fresh(page, c, { stage: 3, level: 3 }); await toSquare(page);
    await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.inv.coins = 34; g.player.facing = 0.4; g.camZoom = 1; g.snapCamera(); });
    await sim(page, 20); await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/hud_${c}.jpg`, type: 'jpeg', quality: 90 });
  }
  // an interaction prompt next to the Bellstone
  await page.evaluate(() => { const g = window.__game, p = g.player, b = g.entities.filter(e => e.constructor.name === 'Bellstone').sort((a, c) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(c.x - p.x, c.z - p.z))[0]; if (b) { p.x = b.x; p.z = b.z + 1; p.facing = Math.PI; g.snapCamera(); } window.__bs = !!b; });
  await sim(page, 10); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/hud_prompt.jpg`, type: 'jpeg', quality: 90 });
  R.ok(true, 'captured');
}
