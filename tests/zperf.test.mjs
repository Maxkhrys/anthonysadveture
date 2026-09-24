// Frame cost split into game update (CPU) and render (software GL here, so only compare
// relatively), median of 3 runs, plus scene draw calls / triangles per frame.
import { sim, fresh } from './lib.mjs';
const measure = page => page.evaluate(() => {
  const g = window.__game, r = g.pr.renderer, med = a => a.sort((x, y) => x - y)[1];
  const up = [], rd = [];
  for (let k = 0; k < 3; k++) {
    g.noRender = true; let t0 = performance.now(); for (let i = 0; i < 20; i++) g.update(1 / 60); up.push((performance.now() - t0) / 20); g.noRender = false;
    t0 = performance.now(); for (let i = 0; i < 6; i++) g.render(1 / 60); rd.push((performance.now() - t0) / 6);
  }
  r.info.autoReset = false; r.info.reset(); g.pr.renderer.setRenderTarget(g.pr.rt); r.render(g.scene, g.pr.camera); r.setRenderTarget(null);
  const calls = r.info.render.calls, tris = r.info.render.triangles; r.info.autoReset = true;
  return { update: +med(up).toFixed(2), render: +med(rd).toFixed(1), calls, tris };
});
export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 1, level: 5 });
  const at = (x, z) => page.evaluate(([x, z]) => { const g = window.__game, p = g.player; p.x = x; p.z = z; g.snapCamera(); }, [x, z]);
  const out = {};
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.raining = false; g.rainK = 0; g.weatherT = 999; });
  await at(58.5, 62.5); await sim(page, 20); out.village_day = await measure(page);
  await page.evaluate(() => { window.__game.flags.dayOffset = 420 * 0.45; }); await sim(page, 30); out.village_night = await measure(page);
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.raining = true; g.rainK = 1; }); await at(96, 76); await sim(page, 20); out.lake_rain = await measure(page);
  await page.evaluate(() => { const g = window.__game; g.raining = false; g.rainK = 0; }); await at(20, 44); await sim(page, 20); out.forest = await measure(page);
  await at(58.5, 64.5);
  await page.evaluate(() => { const g = window.__game, p = g.player; for (let i = 0; i < 24; i++) { const e = g.spawnEnemy(['blot', 'brigand', 'sporeling', 'beetle'][i % 4], p.x + Math.cos(i) * 3.5, p.z + Math.sin(i) * 3.5, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(1); } for (let i = 0; i < 8; i++) g.entities.filter(e => e.isEnemy)[i].die({ dir: 0 }); });
  out.combat_crowd = await measure(page);
  out.particles_live = await page.evaluate(() => window.__game.fx.p.length);
  for (const k in out) if (typeof out[k] === 'object') R.note(`${k.padEnd(14)} update ${String(out[k].update).padStart(6)} ms · render ${String(out[k].render).padStart(6)} ms · ${out[k].calls} draw calls · ${out[k].tris} tris`);
  R.note('particles live after crowd deaths: ' + out.particles_live);
}
