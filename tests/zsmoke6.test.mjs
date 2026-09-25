// Pass 6 smoke capture (dev tool): start, visit places, report world numbers, screenshot.
import { sim, fresh } from './lib.mjs';
export default async function (page, R) {
  const t0 = Date.now();
  await fresh(page, 'samurai', { stage: 1, level: 4 });
  const info = await page.evaluate(() => { const g = window.__game; return { p: [g.player.x, g.player.z], ents: g.entities.length, chunks: g.streamer.chunks.size, stats: g.streamer.stats, place: g.region && g.region.name, seed: g.world6.seed }; });
  R.note('load ms ' + (Date.now() - t0) + ' ' + JSON.stringify(info));
  const r = await page.evaluate(() => { const g = window.__game; const out = []; for (const [n, x, z] of [['deep', 57.5, 133], ['high', 131.5, 62], ['sun', 268.5, 153], ['landing', 288.5, 201], ['fen', 75.5, 188], ['cinder', 272.5, 62], ['cradle', 118.5, 44]]) { g.player.x = x; g.player.z = z; g.noRender = true; window.__sim(40); g.noRender = false; g.render(0.016); out.push([n, g.region && g.region.name, g.entities.length, g.streamer.chunks.size, +(g.player.gy || 0).toFixed(2)]); } return { out, D: g.world6.discovery.regions, L: g.world6.discovery.landmarks.length, boss: !!g.bossActive }; });
  R.note(JSON.stringify(r));
  for (const id of ['rootcellar', 'bellhollow', 'teapot']) {
    await page.evaluate(id => window.__game.warpTo(id, 'entrance'), id);
    await page.waitForFunction(() => !window.__game.transitioning, null, { timeout: 15000 });
    await sim(page, 20);
    R.note(id + ' ' + JSON.stringify(await page.evaluate(() => { const g = window.__game; return [g.area.name, g.entities.length, g.room && g.room.name]; })));
  }
  R.ok(true, 'smoke');
}
