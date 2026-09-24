// Pass 5 developer commands: registry discovery, sandbox isolation, content access.
import { sim, fresh } from './lib.mjs';
export default async function (page, R) {
  await fresh(page, 'archer', { stage: 1, level: 6 });
  const r = await page.evaluate(async () => {
    const g = window.__game, D = window.__dev, out = {};
    await g.save();
    const before = localStorage.getItem('mossling-save-v2');
    const bag0 = g.inv.bag.length;
    D.execute('/named teaspoon');                 // refused outside the sandbox
    out.refused = g.inv.bag.length === bag0;
    D.execute('/sandbox on');
    D.execute('/named teaspoon'); D.execute('/set thornstalker'); D.execute('/affix prismatic'); D.execute('/skill all'); D.execute('/mat all 5'); D.execute('/reinforce 12');
    D.execute('/elite oathbound knight'); D.execute('/capture perf');
    out.spoon = g.inv.bag.some(i => i.unique === 'teaspoon');
    out.set = g.pstats.setBonus.thornstalker === 5;
    out.prism = g.inv.bag.some(i => i.rolledAffixes && i.rolledAffixes[0].tier === 'prismatic');
    out.tree = window.__skills.treeOf('archer').every(n => window.__skills.rankOf(g.inv, n.id) > 0);
    out.elite = g.entities.some(e => e.elite === 'Oathbound');
    out.reinforced = g.inv.equip.weapon.upgradeLevel === 12;
    await g.save(); g.autosaveT = 99; g.update(1 / 60);
    out.untouched = localStorage.getItem('mossling-save-v2') === before;
    out.help = ['skill', 'named', 'set', 'affix', 'fight', 'react', 'capture', 'sandbox', 'registry'].every(k => window.__devDefs[k]);
    return out;
  });
  R.ok(r.refused, 'content-spawning commands refuse to touch the real character outside the sandbox');
  R.ok(r.spoon && r.set && r.prism && r.tree && r.elite && r.reinforced, 'sandbox: named weapons, sets, forced Prismatic rolls, the whole tree, elites and reinforcement are one command away', JSON.stringify(r));
  R.ok(r.untouched, 'nothing spawned in the sandbox reaches the saved profile');
  R.ok(r.help, 'Pass 5 commands are registered in the existing console tables');

  // Gemini's Dev Tools Pass 2 facility sees Pass 5 content
  const f = await page.evaluate(async () => {
    const g = window.__game, D = window.__dev;
    D.execute('/devroom');
    for (let i = 0; i < 100 && (g.transitioning || g.area.id !== 'devroom'); i++) await new Promise(r => setTimeout(r, 100));
    const totems = g.entities.filter(e => e.constructor.name === 'DevSpawnerTotem').map(e => e.enemyKind);
    const tools = await import('/src/dev/tools.js');
    const d = tools.discoverSystems().discoveredSystems;
    return { area: g.area.id, totems, elites: d.eliteModifiers, p5: !!d.pass5 && d.pass5.skills.length, cats: ['skill', 'named', 'fight'].map(k => window.__devDefs[k].category) };
  });
  R.ok(f.area === 'devroom' && ['mantis', 'slug', 'moth', 'porcelain', 'leech'].every(k => f.totems.includes(k)), 'the dev facility has spawn totems for every Pass 5 creature', JSON.stringify(f.totems));
  R.ok(f.elites.includes('Resonant') && f.elites.includes('Oathbound') && f.p5 === 24 && f.cats.every(Boolean), 'discoverSystems lists Pass 5 content and Pass 5 commands sit in console categories', JSON.stringify(f));
}
