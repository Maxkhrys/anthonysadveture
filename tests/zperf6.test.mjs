// Pass 6 profiler (dev tool): one frame's cost split into game update (CPU) and render
// (software GL here: compare relatively, not as real FPS), draw calls, triangles, live
// entities and chunks, JS heap, for each of the brief's scenarios. PERF_OUT=file saves JSON.
import { sim, fresh } from './lib.mjs';
const measure = page => page.evaluate(() => {
  const g = window.__game, r = g.pr.renderer, med = a => a.sort((x, y) => x - y)[1];
  const up = [], rd = [];
  for (let k = 0; k < 3; k++) {
    g.noRender = true; let t0 = performance.now(); for (let i = 0; i < 20; i++) g.update(1 / 60); up.push((performance.now() - t0) / 20); g.noRender = false;
    t0 = performance.now(); for (let i = 0; i < 6; i++) g.render(1 / 60); rd.push((performance.now() - t0) / 6);
  }
  r.info.autoReset = false; r.info.reset(); r.setRenderTarget(g.pr.rt); r.render(g.scene, g.pr.camera); r.setRenderTarget(null);
  const calls = r.info.render.calls, tris = r.info.render.triangles; r.info.autoReset = true;
  const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  return { update: +med(up).toFixed(2), render: +med(rd).toFixed(1), calls, tris, entities: g.entities.length, enemies: g.entities.filter(e => e.isEnemy && !e.dead).length, chunks: g.streamer.chunks.size, geometries: r.info.memory.geometries, heapMB: mem };
});
export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 3, level: 14 });
  const out = {};
  const go = (x, z, opts = {}) => page.evaluate(([x, z, o]) => { const g = window.__game, p = g.player; g.godMode = true; for (const e of g.entities) if (e.isEnemy && !e.isBoss) e.remove(); p.x = x; p.z = z; p.lastSafe = { x, z }; g.flags.dayOffset = (o.frac ?? 0.5 - 0.32) * 420 - g.time; if (o.frac !== undefined) g.flags.dayOffset = (o.frac - 0.32) * 420 - g.time; g.raining = !!o.rain; g.rainK = o.rain ? 1 : 0; g.weatherT = 999; g.snapCamera(); g.render(0); }, [x, z, opts]);
  const scen = [
    ['thimblewick', 148.5, 132.5], ['deepwood_dense', 44.5, 110.5], ['glassmere', 150.5, 96.5], ['lake_mirrow', 160.5, 209.5],
    ['cinderpeak', 262.5, 50.5], ['moonfen_night', 58.5, 200.5, { frac: 0.9 }], ['sunscald', 268.5, 153.5], ['highlands', 118.5, 44.5], ['heartland_rain', 176.5, 140.5, { rain: true }],
  ];
  for (const [k, x, z, o] of scen) { await go(x, z, o || {}); await sim(page, 40); out[k] = await measure(page); }
  // Highlands vista: the camera pulled back to 2.4x
  await go(98.5, 15.5); await sim(page, 120); out.highlands_vista = await measure(page); out.highlands_vista.zoom = await page.evaluate(() => +(window.__game.vistaK || 1).toFixed(2));
  // a large fight: 24 foes in the Dustbowl, then the warband's first wave on top
  await go(248.5, 136.5); await sim(page, 10);
  await page.evaluate(() => { const g = window.__game, p = g.player; for (let i = 0; i < 24; i++) { const e = g.spawnEnemy(['blot', 'brigand', 'scorpion', 'imp'][i % 4], p.x + Math.cos(i) * 3.5, p.z + Math.sin(i) * 3.5, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(1); } });
  await sim(page, 10); out.fight_24 = await measure(page);
  // rapid travel: five far-apart teleports in a row, timed with the game's own animation
  // frames (a tight synchronous loop would only measure the software-GL command queue)
  out.rapid_travel = await page.evaluate(async () => {
    const g = window.__game, p = g.player, worst = [], med = [], b0 = g.streamer.stats.built, ms0 = g.streamer.stats.ms, t0 = performance.now();
    const raf = () => new Promise(r => requestAnimationFrame(r));
    const idle = []; { let l = await raf(); for (let i = 0; i < 30; i++) { const t = await raf(); idle.push(t - l); l = t; } } idle.sort((a, b) => a - b);
    for (const [x, z] of [[57.5, 133], [288.5, 201], [131.5, 60], [75.5, 188], [272.5, 62]]) {
      p.x = x; p.z = z; p.lastSafe = { x, z }; g.snapCamera();
      const d = []; let last = await raf(); for (let i = 0; i < 45; i++) { const t = await raf(); d.push(t - last); last = t; }
      worst.push(+Math.max(...d).toFixed(1)); d.sort((a, b) => a - b); med.push(+d[d.length >> 1].toFixed(1));
    }
    const built = g.streamer.stats.built - b0;
    return { idleMedianMs: +idle[15].toFixed(1), worstFrameMs: worst, medianFrameMs: med, chunksBuilt: built, avgChunkMs: +((g.streamer.stats.ms - ms0) / Math.max(1, built)).toFixed(1), totalMs: Math.round(performance.now() - t0) };
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  // the map: first open builds it, later opens reuse it
  out.map_open = await page.evaluate(() => { const g = window.__game; g.ui.illusArea = null; let t = performance.now(); g.ui.openPause(); g.ui.tab('map'); const first = performance.now() - t; t = performance.now(); g.ui.drawBigMap(); const again = performance.now() - t; g.ui.show('pause', false); return { firstMs: +first.toFixed(1), redrawMs: +again.toFixed(1) }; });
  for (const k in out) R.note(`${k.padEnd(16)} ${JSON.stringify(out[k])}`);
  if (process.env.PERF_OUT) (await import('node:fs')).writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
  R.ok(out.fight_24.update < 40, 'a 24-foe fight updates in reasonable CPU time', String(out.fight_24.update));
}
