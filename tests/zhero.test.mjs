import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 1, level: 5 });
  await page.evaluate(async () => {
    const g = window.__game, p = g.player; p.x = 60.5; p.z = 66.5; p.facing = 0; g.snapCamera();
    const { makeHero } = await import('/src/hero.js');
    const I = window.__items, mk = (cls, x, z, gear) => { const h = makeHero(cls); h.setGear(gear); h.root.position.set(x, 0, z); g.world.add(h.root); return h; };
    const pick = (base, r = 2, unique) => { for (let i = 0; i < 400; i++) { const it = I.genItem({ level: 16, rarity: r, slot: null }); if (it.base === base) return it; } const it = I.genItem({ level: 16, rarity: r }); it.base = base; return it; };
    mk('samurai', 58.5, 67, {}); mk('archer', 59.5, 67, {}); mk('witch', 60.5, 67, {});
    const L = I.LEGENDARIES;
    const leg = id => { for (let i = 0; i < 3000; i++) { const it = I.genItem({ level: 16, rarity: 4 }); if (it.unique === id) return it; } return null; };
    mk('samurai', 58.5, 68.3, { weapon: leg('rootcleaver'), helm: pick('kabuto', 3), armor: pick('oyoroi', 3), charm: pick('bellcharm', 2) });
    mk('archer', 59.5, 68.3, { weapon: leg('sunshot'), helm: pick('rangercowl', 2), armor: pick('jerkin', 2), charm: pick('tidepearl', 2) });
    mk('witch', 60.5, 68.3, { weapon: leg('starfall'), helm: pick('witchbrim', 3), armor: pick('robe', 3), charm: pick('emberlocket', 3) });
    g.pr.setViewHeight(4.2); g.camFocus = { x: 59.5, z: 67.9 };
  });
  await sim(page, 30);
  await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 3; i++) g.render(0.1); });
  await page.screenshot({ path: `${OUT}/hero_lineup.png` });
}
