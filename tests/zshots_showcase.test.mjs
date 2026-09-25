// Graphics showcase (not a regression check): the day cycle and a lakeside, world effects Full.
//   OUT=docs/screens/showcase node tests/run.mjs zshots_showcase
import { sim, fresh, toSquare } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const setTime = (page, frac) => page.evaluate(frac => { const g = window.__game; g.flags.dayOffset = ((frac - 0.32) * 420 - g.time) % 420 + 420; g.raining = false; g.rainK = 0; g.weatherT = 999; }, frac);
export default async function (page, R) {
  await fresh(page, 'witch', { stage: 3, level: 8 }); await toSquare(page);
  await page.evaluate(() => { const g = window.__game, S = g.settings; S.world = 'full'; S.preset = 'high'; import('/src/settings.js').then(m => m.applySettings(S, g)); document.getElementById('hud').style.display = 'none'; g.camZoom = 1.25; g.snapCamera(); });
  await sim(page, 5);
  for (const [name, f] of [['1_dawn', 0.245], ['2_noon', 0.45], ['3_dusk', 0.655], ['4_night', 0.86]]) {
    await setTime(page, f);
    await sim(page, 120);
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__game.render(0.016));
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 });
  }
  // the nearest open water to the village, viewed from its southern bank
  const w = await page.evaluate(() => { const g = window.__game, p = g.player; let best = null;
    for (let r = 2; r < 60 && !best; r++) for (let a = 0; a < 48 && !best; a++) { const x = Math.floor(p.x + Math.cos(a / 48 * 6.283) * r), z = Math.floor(p.z + Math.sin(a / 48 * 6.283) * r); const t = g.tileAt(x, z); if (t === 4 || t === 5) { let n = 0; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const u = g.tileAt(x + i, z + j); if (u === 4 || u === 5) n++; } if (n > 18) best = [x + 0.5, z + 0.5]; } }
    return best; });
  if (w) {
    await setTime(page, 0.42);
    await page.evaluate(([x, z]) => { const g = window.__game, p = g.player; p.x = x; p.z = z + 4; g.camFocus = { x, z: z + 1 }; g.camZoom = 1.05; g.snapCamera(); }, w);
    await sim(page, 120); await page.waitForTimeout(150);
    await page.evaluate(() => window.__game.render(0.016));
    await page.screenshot({ path: `${OUT}/5_lake.jpg`, type: 'jpeg', quality: 90 });
    await page.evaluate(() => { const g = window.__game, u = g.pr.postMat.uniforms; const r = u.reflAmt.value; u.reflAmt.value = 0; g.render(0.016); u.reflAmt.value = r; });
    await page.screenshot({ path: `${OUT}/5_lake_noreflect.jpg`, type: 'jpeg', quality: 90 });
  }
  R.ok(!!w, 'found water near the village: ' + JSON.stringify(w));
}
