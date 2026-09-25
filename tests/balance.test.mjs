// Combat numbers: how many clean hits each class survives, how fast fodder dies, healing
// limits, rest points, i-frame chaining, the one-shot cap, off-screen attacks and the death recap.
import { sim, fresh, walkTo, pressE } from './lib.mjs';

const ATTACKS = { blot: 1, sporeling: 1, wisp: 1, beetle: 2, brigand: 2, wraith: 2, imp: 2, knight: 2.5, treant: 3, golem: 3 };
const FODDER = ['blot', 'sporeling', 'wisp'], HEAVY = ['knight', 'treant', 'golem'];

export default async function (page, R) {
  await page.evaluate(() => { const s = window.__sim; window.__sim = (f, k) => { window.__game.noRender = true; s(f, k); window.__game.noRender = false; }; });
  const table = [];
  for (const cls of ['samurai', 'archer', 'witch', 'soulbound']) {
    for (const lvl of [1, 5, 10]) {
      await fresh(page, cls, { level: lvl });
      const row = await page.evaluate(([ATTACKS, lvl]) => {
        const g = window.__game, p = g.player, inv = g.inv;
        // equal footing: a Magic weapon, helm, armour and charm of the player's level
        for (const slot of ['weapon', 'helm', 'armor', 'charm']) inv.equip[slot] = window.__items.genItem({ level: lvl, cls: inv.cls, slot, rarity: 1 });
        g.recalc(); inv.hp = inv.maxHp;
        const od = g.onPlayerDeath; g.onPlayerDeath = () => {};
        const out = { hp: inv.maxHp };
        for (const k in ATTACKS) {
          let n = 0; inv.hp = inv.maxHp;
          while (inv.hp > 0 && n < 99) { p.takeDamage(ATTACKS[k], lvl); n++; }
          p.setState('move'); g.dead = false;
          out[k] = n;
        }
        inv.hp = inv.maxHp; g.onPlayerDeath = od;
        // how many average basic hits to kill a same-level blotling and brigand
        const unit = 6 * (1 + 0.3 * (lvl - 1)), ps = g.pstats;
        const avg = (ps.wmin + ps.wmax) / 2 * (1 + ps.dmgPct / 100);
        out.killBlot = Math.ceil(2 * unit / avg);
        out.killBrigand = Math.ceil(6 * unit / avg);
        return out;
      }, [ATTACKS, lvl]);
      table.push({ cls, lvl, ...row });
    }
  }
  await page.evaluate(() => { window.__game.dead = false; window.__game.ui.show('gameover', false); });
  for (const r of table) R.note(`${r.cls.padEnd(7)} L${String(r.lvl).padEnd(2)} hp ${String(r.hp).padStart(3)} | hits to fall: ` + Object.keys(ATTACKS).map(k => `${k} ${r[k]}`).join(', ') + ` | blotling dies in ${r.killBlot}, brigand in ${r.killBrigand}`);
  const minOf = ks => Math.min(...table.flatMap(r => ks.map(k => r[k])));
  const maxOf = ks => Math.max(...table.flatMap(r => ks.map(k => r[k])));
  R.ok(minOf(FODDER) >= 6, 'fodder needs 6+ clean hits to down any class', 'min ' + minOf(FODDER));
  R.ok(minOf(['beetle', 'brigand', 'wraith', 'imp']) >= 3 && maxOf(['beetle', 'brigand', 'wraith', 'imp']) <= 11, 'ordinary enemies threaten over several hits (3-11; gear rolls vary)', `${minOf(['beetle', 'brigand', 'wraith', 'imp'])}-${maxOf(['beetle', 'brigand', 'wraith', 'imp'])}`);
  R.ok(minOf(HEAVY) >= 3, 'no heavy blow is close to a one-shot (cap = 40% life)', 'min ' + minOf(HEAVY));
  R.ok(maxOf(['killBlot']) <= 4, 'fodder still dies in a few basic hits', 'max ' + maxOf(['killBlot']));

  // difficulty choices are preserved and ordered
  const diff = await page.evaluate(() => { const g = window.__game, s = g.settings.difficulty, o = {}; for (const d of ['story', 'normal', 'hard']) { g.settings.difficulty = d; o[d] = [g.diffMult(), g.hitCap()]; } g.settings.difficulty = s; return o; });
  R.ok(diff.story[0] < diff.normal[0] && diff.normal[0] < diff.hard[0] && diff.story[1] < diff.hard[1], 'story < normal < hard', JSON.stringify(diff));

  // healing: passive recovery stops at 40%; tonics are a committed action
  await fresh(page, 'witch', { level: 3 });
  const regen = await page.evaluate(() => { const g = window.__game, inv = g.inv; inv.hp = inv.maxHp * 0.1; g.player.combatT = 0; window.__sim(30 * 60); return inv.hp / inv.maxHp; });
  R.ok(regen > 0.38 && regen < 0.42, 'out-of-combat recovery tops out near 40%', regen.toFixed(3));
  const inCombat = await page.evaluate(() => { const g = window.__game, inv = g.inv; inv.hp = inv.maxHp * 0.2; const h0 = inv.hp; for (let i = 0; i < 90; i++) { g.player.combatT = 4; window.__sim(1); } return inv.hp - h0; });
  R.ok(inCombat === 0, 'no passive recovery mid-fight without gear regen', String(inCombat));
  const drink = await page.evaluate(() => { const g = window.__game, inv = g.inv; inv.hp = inv.maxHp * 0.2; inv.potions = 2; window.__sim(1, ['KeyH']); const s = g.player.state, h1 = inv.hp; window.__sim(20); return { s, h1: h1 / inv.maxHp, h2: inv.hp / inv.maxHp, pots: inv.potions }; });
  R.ok(drink.s === 'drink' && drink.h1 < 0.21 && drink.h2 > 0.6 && drink.pots === 1, 'tonic is drunk over a short committed animation', JSON.stringify(drink));

  // lifesteal is pooled: a huge crowd hit cannot fully heal you
  const ls = await page.evaluate(() => {
    const g = window.__game, inv = g.inv, p = g.player;
    g.pstats.lifesteal = 50; inv.hp = inv.maxHp * 0.2; g.lsPool = inv.maxHp * 0.05;
    const foes = []; for (let i = 0; i < 12; i++) { const e = g.spawnEnemy('blot', p.x + 2 + (i % 4) * 0.5, p.z + Math.floor(i / 4) * 0.5, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e5; foes.push(e); }
    const h0 = inv.hp;
    for (const e of foes) g.playerHit(e, { mult: 20, kind: 'blast', dir: 0 });
    const gained = (inv.hp - h0) / inv.maxHp;
    for (const e of foes) e.remove(); g.recalc();
    return gained;
  });
  R.ok(ls <= 0.051, 'life steal per burst is capped (5% of life)', (ls * 100).toFixed(1) + '%');

  // roll i-frames shrink when chained
  const rolls = await page.evaluate(() => { const p = window.__game.player, out = []; window.__sim(30); for (let i = 0; i < 3; i++) { window.__sim(1, ['Space']); out.push(p.rollIframes); window.__sim(15); } return out; });
  R.ok(rolls[0] > 0.25 && rolls[2] < 0.15, 'third back-to-back roll has short i-frames', JSON.stringify(rolls));

  // off-screen enemies never take an attack token
  const off = await page.evaluate(() => { const g = window.__game, p = g.player; const e = g.spawnEnemy('blot', p.x + 16, p.z, { noRoom: true }); e.spawnT = 0; const a = e.takeToken(); e.x = p.x + 2; const b = e.takeToken(); e.remove(); return [a, b]; });
  R.ok(off[0] === false && off[1] === true, 'attack tokens are only granted on-screen', JSON.stringify(off));

  // elites keep their attack when hit (poise); a parry opens them for a guaranteed crit
  const el = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    const e = g.spawnEnemy('brigand', p.x + 1.5, p.z, { noRoom: true }); e.spawnT = 0; if (!e.elite) g.makeElite(e);
    e.setState('windup');
    g.playerHit(e, { mult: 1, kind: 'bolt', dir: 0 });
    const kept = e.state;
    e.onParried();
    let crit = false; const oh = e.onHit.bind(e); e.onHit = h => { crit = h.crit; return oh(h); };
    g.playerHit(e, { mult: 1, kind: 'bolt', dir: 0 });
    e.remove();
    return { kept, crit };
  });
  R.ok(el.kept === 'windup', 'an elite is not interrupted by a light hit', el.kept);
  R.ok(el.crit, 'first hit after a parry is a guaranteed critical');

  // heavy blows break a plain guard, but a parry still works
  const gb = await page.evaluate(() => {
    const g = window.__game, p = g.player, inv = g.inv; inv.hp = inv.maxHp;
    const k = g.spawnEnemy('knight', p.x, p.z + 1.2, { noRoom: true }); k.spawnT = 0;
    p.facing = 0; p.setState('block'); p.blockT = 1;
    const r1 = p.hurt({ dmg: 2.5, x: k.x, z: k.z, src: k, heavy: true });
    p.setState('block'); p.blockT = 0.05; p.invuln = 0;
    const r2 = p.hurt({ dmg: 2.5, x: k.x, z: k.z, src: k, heavy: true });
    k.remove(); p.setState('move'); p.invuln = 0;
    return [r1, r2];
  });
  R.ok(gb[0] === 'guardbreak' && gb[1] === 'parry', 'heavy blow breaks a held guard; a timed parry beats it', JSON.stringify(gb));

  // Bellstone: rest refills life and tonics and sets the checkpoint; death recap names the killer
  await fresh(page, 'archer', { level: 2 });
  const stone = await page.evaluate(() => { const g = window.__game; const b = g.entities.find(e => e.constructor.name === 'Bellstone'); g.inv.hp = 5; g.inv.potions = 0; return b && [b.x, b.z]; });
  R.ok(!!stone, 'village has a Bellstone');
  await walkTo(page, stone[0], stone[1] + 0.9);
  await page.evaluate(() => { window.__game.player.facing = Math.PI; });
  await pressE(page, 1);
  const rest = await page.evaluate(() => { const g = window.__game; return { hp: g.inv.hp === g.inv.maxHp, pots: g.inv.potions === g.inv.maxPotions, cp: g.checkpoint }; });
  R.ok(rest.hp && rest.pots && rest.cp.spawn === 'village', 'resting restores life, tonics and sets the checkpoint', JSON.stringify(rest));
  const recap = await page.evaluate(() => { const g = window.__game, p = g.player; const e = g.spawnEnemy('brigand', p.x + 1, p.z, { noRoom: true }); e.spawnT = 0; g.inv.hp = 1; p.invuln = 0; p.hurt({ dmg: 2, x: e.x, z: e.z, src: e }); e.remove(); return document.querySelector('#gameover .recap').textContent; });
  R.ok(/Felled by .*Brigand/.test(recap), 'death recap names the attacker', recap.slice(0, 90));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__game.inv.potions = 0; });
  await sim(page, 1, ['KeyF']);
  await page.waitForTimeout(1200); await sim(page, 2);
  const rev = await page.evaluate(() => { const g = window.__game; return { dead: g.dead, hp: g.inv.hp === g.inv.maxHp, pots: g.inv.potions }; });
  R.ok(!rev.dead && rev.hp && rev.pots > 0, 'waking up refills life and tonics', JSON.stringify(rev));
}
