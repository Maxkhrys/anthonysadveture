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
  await at(58.5 + 90, 62.5 + 70); await sim(page, 20); out.village_day = await measure(page);
  await page.evaluate(() => { window.__game.flags.dayOffset = 420 * 0.45; }); await sim(page, 30); out.village_night = await measure(page);
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.raining = true; g.rainK = 1; }); await at(96 + 90, 76 + 70); await sim(page, 20); out.lake_rain = await measure(page);
  await page.evaluate(() => { const g = window.__game; g.raining = false; g.rainK = 0; }); await at(20 + 90, 44 + 70); await sim(page, 20); out.forest = await measure(page);
  await at(58.5 + 90, 64.5 + 70);
  await page.evaluate(() => { const g = window.__game, p = g.player; for (let i = 0; i < 24; i++) { const e = g.spawnEnemy(['blot', 'brigand', 'sporeling', 'beetle'][i % 4], p.x + Math.cos(i) * 3.5, p.z + Math.sin(i) * 3.5, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(1); } for (let i = 0; i < 8; i++) g.entities.filter(e => e.isEnemy)[i].die({ dir: 0 }); });
  out.combat_crowd = await measure(page);
  out.particles_live = await page.evaluate(() => window.__game.fx.p.length);
  // ---- Pass 5 scenarios (skipped automatically on builds without them)
  const p5 = await page.evaluate(() => !!window.__skills);
  if (p5) {
    // six abilities at once in the crowd (witch, every active unlocked)
    await page.evaluate(() => { const g = window.__game, S = window.__skills, inv = g.inv; for (const e of g.entities) if (e.isEnemy) e.remove(); const p = g.player; for (let i = 0; i < 24; i++) { const e = g.spawnEnemy(['mantis', 'slug', 'moth', 'porcelain', 'leech', 'blot'][i % 6], p.x + Math.cos(i) * 3.5, p.z + Math.sin(i) * 3.5, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(1); } });
    out.crowd24_pass5 = await measure(page);
    await page.evaluate(() => { const g = window.__game, p = g.player; const I = ['iaido', 'tempest', 'oni', 'bellquake', 'threadsever', 'kaze']; g.inv.level = 20; g.inv.sp = 99; for (let k = 0; k < 4; k++) for (const n of window.__skills.treeOf('samurai')) window.__skills.spendNode(g.inv, n.id); g.recalc(); I.forEach((id, i) => { window.__skills.setLoadout(g.inv, i, id); }); for (const id of ['bellquake', 'threadsever', 'kaze']) { p.setState('move'); g.res = 100; p.cdMap = {}; p.castAbility(id, null); for (let i = 0; i < 3; i++) g.update(1 / 60); } window.__combat.blast(g, p.x + 2, p.z, 2.5, 1, 0xff8a2a, { burn: true }); window.__combat.chainLightning(g, p.x, p.z, 1, 8, 7); });
    out.six_abilities_vfx = await measure(page);
    out.particles_peak = await page.evaluate(() => window.__game.fx.p.length);
    await page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy) e.remove(); const p = g.player; for (let i = 0; i < 20; i++) g.dropGear(p.x + (i % 5) - 2, p.z + Math.floor(i / 5) - 2, { level: 10, floor: 2 }); });
    out.loot_20_drops = await measure(page);
    await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 420 * 0.45; g.raining = true; g.rainK = 1; });
    await sim(page, 20); out.night_rain = await measure(page);
    await page.evaluate(() => { const g = window.__game; g.raining = false; g.rainK = 0; g.flags.dayOffset = 0; g.inv.bellows = true; g.warpTo('conservatory', 'entrance'); });
    await page.waitForFunction(() => window.__game.area.id === 'conservatory' && !window.__game.transitioning, null, { timeout: 15000 });
    await sim(page, 20); out.conservatory = await measure(page);
    await page.evaluate(() => { const g = window.__game; g.godMode = true; g.setSignal('c.torches', true, true); const r = g.area.rooms.find(r => r.id === 'loom'); g.player.x = r.x0 + 8.5; g.player.z = r.z0 + 8.5; g.updateRoom(true); g.snapCamera(); g.update(1 / 60); });
    await page.waitForTimeout(3800); await sim(page, 60); out.boss_seamkeeper = await measure(page);
    await page.evaluate(() => { const g = window.__game; g.warpTo('overworld', 'fen'); });
    await page.waitForFunction(() => window.__game.area.id === 'overworld' && !window.__game.transitioning, null, { timeout: 15000 });
    await page.evaluate(() => { const g = window.__game; g.wakeToad(g.fenToad); });
    await page.waitForTimeout(3800); await sim(page, 60); out.boss_toad = await measure(page);
    // inventory paper doll: its own renderer, cost of one frame
    out.inventory_doll_ms = await page.evaluate(() => { const g = window.__game; g.ui.openInventory(); const t0 = performance.now(); for (let i = 0; i < 20; i++) g.ui.doll.frame(1 / 60); const ms = (performance.now() - t0) / 20; g.ui.closeInventory(); return +ms.toFixed(2); });
  }
  for (const k in out) if (typeof out[k] === 'object') R.note(`${k.padEnd(14)} update ${String(out[k].update).padStart(6)} ms · render ${String(out[k].render).padStart(6)} ms · ${out[k].calls} draw calls · ${out[k].tris} tris`);
  R.note('particles live after crowd deaths: ' + out.particles_live + (out.particles_peak !== undefined ? ' · peak during six-ability burst: ' + out.particles_peak : ''));
  if (out.inventory_doll_ms !== undefined) R.note('inventory paper-doll frame: ' + out.inventory_doll_ms + ' ms');
  if (process.env.PERF_OUT) (await import('node:fs')).writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
}
