// Character model capture set (not a regression check):
//   OUT=docs/screens/hero node tests/run.mjs zshots_hero
import { sim, fresh, toSquare } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const CLS = ['samurai', 'archer', 'witch', 'soulbound'];
const LOOKS = [
  { frame: 'balanced', face: 'soft', skin: '#f3cda9', hair: 'tousled', hairColor: '#28201e', beard: 'none', eyes: '#5d814e', detail: 'none' },
  { frame: 'slender', face: 'angular', skin: '#c88d64', hair: 'ponytail', hairColor: '#875335', beard: 'none', eyes: '#6394a3', detail: 'freckles' },
  { frame: 'broad', face: 'round', skin: '#784a35', hair: 'braided', hairColor: '#d5cec0', beard: 'full', eyes: '#986b36', detail: 'scar' },
  { frame: 'tall', face: 'long', skin: '#d9b39b', hair: 'long', hairColor: '#783c32', beard: 'none', eyes: '#77618a', detail: 'runes' },
];

export default async function (page, R) {
  // 1. the character creator, one class each
  await page.getByText('Play Story', { exact: true }).click(); await page.getByText('New Character', { exact: true }).click();
  await page.waitForTimeout(400);
  const root = page.locator('#character-creator');
  for (const [i, c] of CLS.entries()) {
    await root.locator('[data-category="Class"]').click();
    await root.locator(`[data-class="${c}"]`).click();
    await page.evaluate(look => { const cc = window.__creator || null; if (cc) { cc.look = { ...look }; cc.updateHero(); } }, LOOKS[i]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/creator_${c}.jpg`, type: 'jpeg', quality: 88 });
    const cv = root.locator('canvas');
    await cv.screenshot({ path: `${OUT}/creator_${c}_model.png` });
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('Escape');

  // 2. in game: inventory portrait and gameplay distance, per class
  for (const [i, c] of CLS.entries()) {
    await fresh(page, c, { stage: 3, level: 12 }); await toSquare(page);
    await page.evaluate(look => { const g = window.__game; g.inv.appearance = look; g.player.m.setAppearance && g.player.m.setAppearance(look); g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; }, LOOKS[i]);
    await page.evaluate(() => { const g = window.__game; g.ui.openInventory ? g.ui.openInventory() : g.ui.navigate('bag'); });
    await sim(page, 3); await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/inventory_${c}.jpg`, type: 'jpeg', quality: 88 });
    await page.evaluate(() => { const g = window.__game; g.ui.closeInventory ? g.ui.closeInventory() : 0; });
    await page.evaluate(() => { const g = window.__game, p = g.player; p.facing = 0.35; g.camZoom = 0.42; g.snapCamera(); });
    await sim(page, 10);
    await page.evaluate(() => { const g = window.__game; g._upd = g.update; g.update = () => {}; g.render(0.016); });
    const s = await page.evaluate(() => { const g = window.__game, p = g.player; return g.pr.project({ x: p.x, y: 0.5, z: p.z }); });
    await page.screenshot({ path: `${OUT}/game_${c}.jpg`, type: 'jpeg', quality: 90, clip: { x: Math.max(0, Math.min(1280 - 320, s.x - 160)), y: Math.max(0, Math.min(720 - 260, s.y - 150)), width: 320, height: 260 } });
    await page.evaluate(() => { const g = window.__game; g.update = g._upd; g.camZoom = 1; g.snapCamera(); });
  }
  R.ok(true, 'captured');
}
