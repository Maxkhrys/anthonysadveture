// Combat presentation: bolts only between real hits, status visuals that end with the status,
// blood settings by material, one death effect per kill, budgets in a crowd, and all five
// classes still dealing damage with the presentation layer attached.
import { sim, fresh, toSquare } from './lib.mjs';

export default async function (page, R) {
  await fresh(page, 'witch', { stage: 1, level: 12 });
  await page.evaluate(() => { const g = window.__game; g.godMode = true; });
  // spawn helper inside the page
  await page.evaluate(() => {
    window.__spawnFoes = (list) => { const g = window.__game, p = g.player; for (const e of [...g.entities]) if (e.isEnemy) e.remove(); return list.map(([k, dx, dz]) => { const e = window.__makeEnemy(g, k, p.x + dx, p.z + dz); g.scaleEnemy(e, { noElite: true }); e.spawnT = 0; e.think = () => [0, 0]; g.spawn(e); return e; }); };
  });
  const hasMake = await page.evaluate(() => typeof window.__makeEnemy === 'function');
  R.ok(hasMake, 'test hook for enemies is available');

  // ---------------------------------------------------------------- lightning: bolts == real hits
  const chain = await page.evaluate(() => {
    const g = window.__game, F = g.combatFx, p = g.player;
    const foes = window.__spawnFoes([['blot', 2, 0], ['blot', 3.5, 0.5], ['blot', 4.5, -0.5], ['blot', 14, 0]]);
    const b0 = F.stats.bolts;
    window.__combat.chainLightning(g, p.x, p.z, 0.5, 4, 7);
    const hit = foes.filter(e => e.hp < e.maxHp || e.dead).length;
    return { bolts: F.stats.bolts - b0, hit, farUntouched: foes[3].hp === foes[3].maxHp, live: F.bolts.length };
  });
  R.ok(chain.bolts === chain.hit && chain.hit === 3 && chain.farUntouched, 'lightning bolts are drawn only between targets the chain actually hit', JSON.stringify(chain));

  // ---------------------------------------------------------------- statuses: shown while active, gone after
  const hex = await page.evaluate(() => { const g = window.__game, F = g.combatFx; const [e] = window.__spawnFoes([['knight', 3, 0]]); e.applyStatus('hex', 1.2); window.__sim(3); const on = F.hexMarks.has(e); window.__sim(60); return { on, off: !F.hexMarks.has(e), status: e.status.hex }; });
  R.ok(hex.on && hex.off && hex.status === 0, 'the hex mark appears with Hexed and is removed the moment it expires', JSON.stringify(hex));

  // ---------------------------------------------------------------- blood settings by material
  const blood = await page.evaluate(() => {
    const g = window.__game, F = g.combatFx, out = {};
    for (const mode of ['off', 'reduced', 'full']) {
      g.settings.blood = mode; const [flesh, plant] = window.__spawnFoes([['brigand', 2, 0], ['sporeling', -2, 0]]);
      const b0 = F.stats.blood, p0 = g.fx.p.length;
      F.onEnemyHit(flesh, { dir: 0, heavy: true }); const b1 = F.stats.blood;
      const p1 = g.fx.p.length; F.onEnemyHit(plant, { dir: 0, heavy: true }); const p2 = g.fx.p.length;
      out[mode] = { blood: b1 - b0, plantParticles: p2 - p1 };
    }
    g.settings.blood = 'full'; return out;
  });
  R.ok(blood.off.blood === 0 && blood.reduced.blood > 0 && blood.full.blood > blood.reduced.blood, 'Blood Off draws no blood, Reduced draws less than Full', JSON.stringify(blood));
  R.ok(blood.off.plantParticles > 0, 'with Blood Off, non-blood material feedback (sap and leaves) still plays', JSON.stringify(blood.off));

  // ---------------------------------------------------------------- one death effect, one kill, frozen shatters
  const death = await page.evaluate(() => {
    const g = window.__game, F = g.combatFx; const [e] = window.__spawnFoes([['blot', 2, 0]]);
    e.applyStatus('freeze', 3); e.applyStatus('burn', 3, 1); e.applyStatus('shock', 3);
    const k0 = g.stats.kills || 0, d0 = { ...F.stats.deaths }, n0 = F.deaths;
    g.playerHit(e, { mult: 999, kind: 'bolt', element: 'fire', dir: 0 }); e.die({ dir: 0 }); e.die({ dir: 0 });
    return { kills: (g.stats.kills || 0) - k0, fx: F.deaths - n0, shatter: (F.stats.deaths.shatter || 0) - (d0.shatter || 0) };
  });
  R.ok(death.kills === 1 && death.fx === 1 && death.shatter === 1, 'a frozen, burning, shocked foe gets exactly one death effect (shatter) and counts one kill', JSON.stringify(death));
  const kinds = await page.evaluate(() => {
    const g = window.__game, F = g.combatFx, got = {};
    const cases = [['char', 'burn'], ['electric', null, 'lightning'], ['soul', null, 'spirit'], ['material', null, 'steel']];
    for (const [want, status, el] of cases) { const [e] = window.__spawnFoes([['brigand', 2, 0]]); if (status) e.applyStatus(status, 3, 1); const before = { ...F.stats.deaths }; g.playerHit(e, { mult: 999, kind: el === 'lightning' ? 'shock' : 'sword', element: el || 'steel', dir: 0 }); got[want] = (F.stats.deaths[want] || 0) - (before[want] || 0); }
    return got;
  });
  R.ok(Object.values(kinds).every(v => v === 1), 'burning, electrical, soul and plain deaths each pick their own single presentation', JSON.stringify(kinds));

  // ---------------------------------------------------------------- budgets in a crowd
  const crowd = await page.evaluate(() => {
    const g = window.__game, F = g.combatFx, p = g.player; const list = []; for (let i = 0; i < 30; i++) list.push([['blot', 'beetle', 'brigand', 'wisp'][i % 4], Math.cos(i) * (2 + i % 5), Math.sin(i) * (2 + i % 5)]);
    window.__spawnFoes(list); let maxB = 0, maxP = 0;
    for (let r = 0; r < 20; r++) { window.__combat.chainLightning(g, p.x, p.z, 0.2, 8, 9); for (const e of g.entities) if (e.isEnemy && !e.dead) F.onEnemyHit(e, { dir: 0, heavy: true }); maxB = Math.max(maxB, F.bolts.length); maxP = Math.max(maxP, g.fx.p.length); window.__sim(1); }
    return { maxB, maxP, decals: F.decals.length, lights: F.lights.length, marks: F.hexMarks.size };
  });
  R.ok(crowd.maxB <= 12 && crowd.maxP <= 1400 && crowd.decals <= 24 && crowd.lights === 3, 'a 30-enemy proc storm stays inside the bolt, particle, decal and light budgets', JSON.stringify(crowd));

  // ---------------------------------------------------------------- settings persist
  const persist = await page.evaluate(() => { const S = window.__settings; const s = S.loadSettings(); s.combatFx = 'high'; s.blood = 'reduced'; S.saveSettings(s); const t = S.loadSettings(); const ok = t.combatFx === 'high' && t.blood === 'reduced'; s.combatFx = 'normal'; s.blood = 'full'; S.saveSettings(s); return ok; });
  R.ok(persist, 'Combat effects and Blood settings persist and reload');
  const bad = await page.evaluate(() => { localStorage.setItem('mossling-settings', JSON.stringify({ combatFx: 'insane', blood: 7, devMode: 'yes' })); const t = window.__settings.loadSettings(); localStorage.removeItem('mossling-settings'); return [t.combatFx, t.blood, t.devMode]; });
  R.ok(bad[0] === 'normal' && bad[1] === 'full' && bad[2] === false, 'unknown stored values fall back to safe defaults', bad.join(','));

  // ---------------------------------------------------------------- all five classes still deal damage
  const classes = {};
  for (const cls of ['samurai', 'archer', 'witch', 'soulbound', 'gunslinger']) {
    await fresh(page, cls, { stage: 1, level: 8 }); await toSquare(page);
    await page.evaluate(() => { const g = window.__game, p = g.player; p.facing = 0; p.aimSrc = 'keys'; window.__foe = window.__spawnFoes([['blot', 0, 2]])[0]; window.__foe.hp = window.__foe.maxHp = 900; window.__game.godMode = true; });
    for (let i = 0; i < 12; i++) { await sim(page, cls === 'archer' ? 24 : 4, ['KeyC']); await sim(page, 6); } // bows draw and release; other weapons tap
    classes[cls] = await page.evaluate(() => { const g = window.__game, e = window.__foe; const c = g.combatEvents?.counts || {}; return { dmg: e ? Math.round(e.maxHp - e.hp) : -1, dead: !e || e.dead, impacts: (c['attack.impact'] || 0) + (c['spell.impact'] || 0) }; });
  }
  R.ok(Object.values(classes).every(c => c.dmg > 0 || c.dead), 'all five classes still land real damage with the presentation layer attached', JSON.stringify(classes));
}
