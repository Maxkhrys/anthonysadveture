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
}
