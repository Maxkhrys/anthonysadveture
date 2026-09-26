// Parchment UI capture set (not a regression check):
//   OUT=/tmp/x node tests/run.mjs zshots_parch
import { sim, fresh, toSquare } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
export default async function (page, R) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/p_title.jpg`, type: 'jpeg', quality: 85 });
  await page.getByText('Play Story', { exact: true }).click(); await page.getByText('New Character', { exact: true }).click(); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/p_creator.jpg`, type: 'jpeg', quality: 85 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('Escape');
  await fresh(page, 'witch', { stage: 3, level: 6 }); await toSquare(page);
  await page.evaluate(() => { const g = window.__game; Object.assign(g.inv.mats, { shard: 100, thornheart: 5, echo: 5, ember: 5 }); g.inv.recipes.push('emberseeds'); g.ui.openCraft(); });
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/p_craft.jpg`, type: 'jpeg', quality: 85 });
  await page.locator('#craft .service-close').click();
  await page.evaluate(() => { const g = window.__game; g.ui.classSelect && g.ui.classSelect(g.input, () => {}); });
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/p_class.jpg`, type: 'jpeg', quality: 85 });
  await page.evaluate(() => { const g = window.__game; g.ui.show('classsel', false); g.ui.csActive = false; g.ui.show('gameover', true); });
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/p_over.jpg`, type: 'jpeg', quality: 85 });
  await page.evaluate(() => { const g = window.__game; g.ui.show('gameover', false); g.ui.toast && g.ui.toast('A toast', 'Parchment test', 3); });
  await sim(page, 5); await page.screenshot({ path: `${OUT}/p_hud.jpg`, type: 'jpeg', quality: 85 });
  R.ok(true, 'captured');
}
