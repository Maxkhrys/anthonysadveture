// Combat rework capture set (not a regression check): each weapon family's right-click attack,
// caught mid-release.   OUT=dir node tests/run.mjs zshots_combat
import { fresh, toSquare } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const CASES = [
  ['witch', 'acornstaff', 40, 3, 'witch_fire'], ['witch', 'frostrod', 1, 9, 'witch_frost'], ['witch', 'owlstaff', 1, 8, 'witch_lightning'],
  ['witch', 'hexwand', 1, 12, 'witch_hex'], ['witch', 'shroomwand', 1, 12, 'witch_ember'], ['witch', 'crookstaff', 1, 26, 'witch_arcane'],
  ['samurai', 'wakizashi', 1, 8, 'samurai_fast'], ['samurai', 'nodachi', 1, 14, 'samurai_heavy_windup'], ['samurai', 'nodachi', 1, 22, 'samurai_heavy_fall'],
  ['archer', 'longbow', 40, 0, 'archer_longbow_draw'], ['archer', 'recurve', 1, 7, 'archer_recurve'],
  ['soulbound', 'gravechain', 1, 9, 'soul_heavy'], ['soulbound', 'tetherchain', 1, 6, 'soul_long'], ['soulbound', 'lanternlinks', 1, 12, 'soul_spirit'],
  ['gunslinger', 'trailrevolver', 1, 6, 'gun_revolver'], ['gunslinger', 'woodrifle', 1, 8, 'gun_rifle'],
];
export default async function (page, R) {
  let cur = null;
  for (const [cls, id, hold, after, name] of CASES) {
    if (cur !== cls) { await fresh(page, cls, { stage: 3, level: 8 }); await toSquare(page); cur = cls; }
    const s = await page.evaluate(([id, hold, after]) => {
      const g = window.__game, p = g.player, I = window.__items;
      for (const e of g.entities) if (e.isEnemy) e.remove();
      g.inv.equip.weapon = I.makeNamed(id, 8); g.recalc(); p.m.setGear && p.m.setGear(g.inv.equip); window.__sim(1, []);
      const w = g.inv.equip.weapon; if (w.magazine) w.magazine.rounds = 6;
      g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.res = 100; p.secCd = 0; p.reload = null; p.gunCd = 0;
      p.x = 148.5; p.z = 132.5; p.facing = 0.5; p.aimSrc = 'keys'; p.setState('move'); g.camZoom = 0.62; g.snapCamera();
      for (const [dx, dz] of [[1.2, 3], [-0.6, 3.8], [2.2, 4.4]]) { const e = g.spawnEnemy('blot', p.x + dx, p.z + dz, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; e.think = () => [0, 0]; e.hp = e.maxHp = 900; e.x = p.x + dx; e.z = p.z + dz; }
      g.noRender = true; for (let i = 0; i < hold; i++) window.__sim(1, ['KeyX']); for (let i = 0; i < after; i++) window.__sim(1, hold > 1 && after === 0 ? ['KeyX'] : []); g.noRender = false;
      g._upd = g.update; g.update = () => {}; g.render(0.016);
      const c = g.pr.project({ x: p.x + 0.8, y: 0.5, z: p.z + 1.6 }); return { x: c.x, y: c.y, st: p.state, ph: p.w2 && p.w2.phase };
    }, [id, hold, after]);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88, clip: { x: Math.max(0, Math.min(1280 - 480, s.x - 240)), y: Math.max(0, Math.min(720 - 340, s.y - 190)), width: 480, height: 340 } });
    await page.evaluate(() => { const g = window.__game; g.update = g._upd; });
    R.ok(true, name + ' ' + s.st + '/' + s.ph);
  }
}
