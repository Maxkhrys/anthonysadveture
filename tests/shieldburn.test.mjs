// Regression: a witch's charged fireball is a heavy fire blast. It must get through a Hushbound
// Brigand's raised shield (which clangs off light hits from the front) and set it burning.
import { sim, fresh, toSquare } from './lib.mjs';
export default async function (page, R) {
  await fresh(page, 'witch', { stage: 3, level: 3 }); await toSquare(page);
  const r = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    const e = g.spawnEnemy('brigand', p.x, p.z + 3, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; e.elite = null; e.hp = e.maxHp = 400;
    e.think = () => [0, 0]; e.facing = Math.PI; // shield up, facing the witch
    const hp0 = e.hp;
    // the fire staff's secondary: hold right click (X) to charge, release: the fireball
    g.noRender = true;
    for (let i = 0; i < 70; i++) window.__sim(1, i < 30 ? ['KeyX'] : []);
    g.noRender = false;
    const burning = !!(e.status && e.status.burn > 0);
    // a light bolt from the front still clangs off the shield (checked last: a clang staggers the witch)
    const hp1 = e.hp; g.playerHit(e, { mult: 1, kind: 'bolt', element: 'arcane', dir: 0 }); const bolt = hp1 - e.hp;
    return { bolt, hp: e.hp, max: e.maxHp, took: hp0 - hp1, burning, status: JSON.stringify(e.status || e.statuses || {}).slice(0, 120) };
  });
  R.ok(r.bolt === 0, 'a light bolt from the front clangs off the raised shield', JSON.stringify(r));
  R.ok(r.took > 0, 'the charged fireball blasts through the shield and hurts the Brigand', JSON.stringify(r));
  R.ok(r.burning, 'and sets it burning', JSON.stringify(r));
}
