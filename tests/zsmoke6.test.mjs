// Pass 6 smoke capture (dev tool): start, walk a little, report world numbers, screenshot.
import { sim, fresh } from './lib.mjs';
export default async function (page, R) {
  const t0 = Date.now();
  await fresh(page, 'samurai', { stage: 1, level: 4 });
  const info = await page.evaluate(() => { const g = window.__game; return { t: performance.now(), p: [g.player.x, g.player.z], ents: g.entities.length, chunks: g.streamer.chunks.size, stats: g.streamer.stats, place: g.region && g.region.name }; });
  R.note('load ms ' + (Date.now() - t0) + ' ' + JSON.stringify(info));
  await page.evaluate(() => { const g = window.__game; g.render(0.016); });
  await page.screenshot({ path: process.env.SHOT || '/tmp/p6smoke.png' });
  const r = await page.evaluate(() => { const g = window.__game; const out = []; for (const [n, x, z] of [['deep', 57.5, 133], ['high', 131.5, 62], ['sun', 268.5, 153], ['landing', 288.5, 201], ['fen', 75.5, 188], ['cinder', 272.5, 62]]) { g.player.x = x; g.player.z = z; g.noRender = true; window.__sim(8); g.noRender = false; g.render(0.016); out.push([n, g.region && g.region.name, g.entities.length, g.streamer.chunks.size, +g.player.gy.toFixed(2)]); } return out; });
  R.note(JSON.stringify(r));
  R.ok(true, 'smoke');
}
