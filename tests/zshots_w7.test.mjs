// World pass capture (not a regression check): Thimblewick before/after and the two new regions.
//   OUT=docs/screens/world7 TAG=after node tests/run.mjs zshots_w7
// Run the same file on the base commit with TAG=before; spots in areas that do not exist there are skipped.
import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp', TAG = process.env.TAG || 'after';
const SPOTS = [
  ['01_arrival', 'overworld', 148.5, 153.5, 1.2],
  ['02_plaza', 'overworld', 148.5, 133.5, 1.2],
  ['03_hedge_garden', 'overworld', 133.5, 138.5, 1.2],
  ['04_brook', 'overworld', 148.5, 145, 1.5],
  ['05_cg_lawn', 'clockwork', 44.5, 65.8, 1],
  ['06_cg_clock', 'clockwork', 44.5, 33.5, 1.4],
  ['07_cg_maze', 'clockwork', 17.5, 58.5, 1.3],
  ['08_cg_gearhouse', 'clockwork', 68.5, 56.5, 1.2],
  ['09_rl_hall', 'rootlight', 55.5, 33.5, 1.4],
  ['10_rl_refuge', 'rootlight', 13.5, 42.5, 1.1],
  ['11_rl_lake', 'rootlight', 42.5, 60.5, 1.4],
];
export default async function (page, R) {
  await fresh(page, 'archer', { stage: 3, level: 9 });
  let n = 0;
  for (const [name, area, x, z, zoom] of SPOTS) {
    const ok = await page.evaluate(async ([area, x, z, zoom]) => {
      const g = window.__game;
      if (g.area.id !== area) { try { g.loadArea(area, { x, z }); } catch (e) { return false; } }
      const p = g.player; p.x = x; p.z = z; p.facing = 0; g.godMode = true;
      for (const e of g.entities) if (e.isEnemy) e.remove();
      g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.camZoom = zoom;
      document.getElementById('hud').style.display = 'none';
      const r = document.getElementById('region-reveal'); if (r) r.className = 'hide';
      g.revealQ = []; g.snapCamera(); return true;
    }, [area, x, z, zoom]);
    if (!ok) { R.note(`${name}: no ${area} on this build, skipped`); continue; }
    await sim(page, 40);
    await page.evaluate(() => { const g = window.__game; g.revealQ = []; const r = document.getElementById('region-reveal'); if (r) r.className = 'hide'; g.render(0.016); });
    await page.screenshot({ path: `${OUT}/${name}_${TAG}.jpg`, type: 'jpeg', quality: 85 });
    n++;
  }
  // the discovery card and the atlas waypoint (after only)
  const card = await page.evaluate(() => { const g = window.__game; if (!g.ui.showReveal) return false; document.getElementById('hud').style.display = ''; document.documentElement.classList.add('reduce-motion'); g.ui.showReveal({ name: 'The Clockwork Garden', level: 6, major: true }); return true; });
  if (card) { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/12_reveal_card_${TAG}.jpg`, type: 'jpeg', quality: 85 }); n++; }
  await page.evaluate(() => document.documentElement.classList.remove('reduce-motion'));
  R.ok(n > 0, `captured ${n} frames`);
}
