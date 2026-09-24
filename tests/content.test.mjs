// Pass 5 content: new creatures, elite modifiers, materials, the Conservatory, the Seamkeeper
// and the Crowned Toad. Scripted checks prove the systems run; they are not a verdict on feel.
import { sim, fresh } from './lib.mjs';

export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 1, level: 8 });
  // ---------------------------------------------------------------- five families fight and die cleanly
  const fam = await page.evaluate(() => {
    const g = window.__game, p = g.player, out = {};
    g.godMode = true;
    for (const kind of ['mantis', 'slug', 'moth', 'porcelain', 'leech']) {
      for (const e of g.entities) if (e.isEnemy) e.remove();
      p.x = 58.5; p.z = 64.5; p.setState('move'); g.snapCamera();
      const e = g.spawnEnemy(kind, p.x + 2.5, p.z, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; e.obj.scale.setScalar(1);
      const states = new Set();
      g.noRender = true;
      for (let i = 0; i < 240; i++) { window.__sim(1); states.add(e.state); }
      const hp0 = e.hp;
      g.playerHit(e, { mult: 1, kind: 'sword', kb: 0, dir: 0 });
      const took = hp0 - e.hp;
      e.hp = 1; g.playerHit(e, { mult: 3, kind: 'spin', kb: 0, dir: 0 });
      window.__sim(5); g.noRender = false;
      out[kind] = { name: g.nameOf(e), states: [...states].join(','), took: Math.round(took), dead: e.dead };
    }
    g.godMode = false;
    return out;
  });
  for (const k of Object.keys(fam)) R.ok(fam[k].dead && /windup/.test(fam[k].states) && /attack|recover/.test(fam[k].states), `${fam[k].name}: approaches, telegraphs (windup), attacks and dies`, JSON.stringify(fam[k]));
  R.ok(fam.porcelain.took < fam.mantis.took * 0.6 + 1, 'the Porcelain Guard shell soaks ordinary blows', JSON.stringify([fam.porcelain.took, fam.mantis.took]));

  // porcelain shell breaks under heavy blows
  const shell = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    const s0 = g.stats.shellsBroken || 0; const e = g.spawnEnemy('porcelain', p.x + 2, p.z, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; e.hp = e.maxHp = 400; e.think = () => [0, 0];
    let n = 0; while (!(e.shell !== null && e.shell <= 0) && n < 50) { g.playerHit(e, { mult: 2, kind: 'spin', kb: 0, dir: 0 }); n++; }
    const h0 = e.hp; g.playerHit(e, { mult: 1, kind: 'sword', kb: 0, dir: 0 }); const after = h0 - e.hp;
    return { broke: e.shell <= 0, n, poise: e.poise, stat: g.stats.shellsBroken - s0, after };
  });
  R.ok(shell.broke && !shell.poise && shell.stat === 1, 'heavy blows break the porcelain shell; it staggers and loses its poise', JSON.stringify(shell));

  // bell leech zone disrupts cooldowns
  const zone = await page.evaluate(() => {
    const g = window.__game, p = g.player, Z = window.__m3.ResonanceZone;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    g.godMode = true; p.cdMap.tempest = 5; g.res = 80;
    g.spawn(new Z(g, p.x, p.z, null));
    g.noRender = true; window.__sim(30); g.noRender = false;
    const cd = p.cdMap.tempest, res = g.res;
    g.godMode = false;
    return { cd, res };
  });
  R.ok(zone.cd > 4.9 && zone.res < 80, 'standing in a Bell Leech resonance zone freezes cooldowns and drains resource', JSON.stringify(zone));

  // elites: Resonant repeats, Oathbound strengthens and breaks
  const el = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    const r = g.spawnEnemy('blot', p.x + 1.5, p.z, { noRoom: true, eliteChance: 0 }); r.spawnT = 0; g.makeElite(r); r.elite = 'Resonant';
    r.setState('attack');
    const echo = g.entities.some(e => e.constructor.name === 'ResonantEcho');
    const o = g.spawnEnemy('knight', p.x - 3, p.z, { noRoom: true, eliteChance: 0 }); o.spawnT = 0; g.makeElite(o); o.elite = 'Oathbound'; o.think = () => [0, 0];
    const ally = g.spawnEnemy('blot', p.x - 3.5, p.z + 1, { noRoom: true, eliteChance: 0 }); ally.spawnT = 0; ally.hp = ally.maxHp = 1000; ally.think = () => [0, 0];
    g.noRender = true; window.__sim(3); g.noRender = false;
    const bound = ally.oathT > 0;
    const h0 = ally.hp; g.playerHit(ally, { mult: 1, kind: 'sword', kb: 0, dir: 0, forceCrit: false }); const buffed = h0 - ally.hp;
    o.hp = o.maxHp = 1000; g.playerHit(o, { mult: 1, kind: 'spin', kb: 0, dir: 0 });
    g.noRender = true; window.__sim(3); g.noRender = false;
    return { echo, bound, broken: o.oathBroken > 0, freed: !(ally.oathT > 0) };
  });
  R.ok(el.echo, 'Resonant elites leave a marked echo of each attack');
  R.ok(el.bound && el.broken && el.freed, 'Oathbound elites bind nearby allies until a heavy blow breaks the oath', JSON.stringify(el));

  // materials
  const mats = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    const before = { ...g.inv.mats };
    for (const kind of ['mantis', 'slug', 'moth', 'porcelain', 'leech']) { const e = g.spawnEnemy(kind, p.x + 2, p.z, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; g.makeElite(e); e.die({ dir: 0 }); }
    return { gained: ['mantis', 'wax', 'moth', 'porcelain', 'filament'].every(k => (g.inv.mats[k] || 0) > (before[k] || 0)), learned: g.inv.recipes.includes('waxseal') && g.inv.recipes.includes('mothwing') };
  });
  R.ok(mats.gained && mats.learned, 'each family drops its crafting material (elites always); wax and moth dust teach their engravings', JSON.stringify(mats));
}
