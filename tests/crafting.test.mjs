// Crafting: discovery, requirements, failed transactions, class rules, transfers, saving,
// every recipe's behaviour, recursion guards and a strong build against a crowd and a boss.
import { sim, fresh, walkTo, pressE } from './lib.mjs';

const give = (page, mats, recipes = []) => page.evaluate(([mats, recipes]) => { const g = window.__game; Object.assign(g.inv.mats, mats); for (const r of recipes) if (!g.inv.recipes.includes(r)) g.inv.recipes.push(r); }, [mats, recipes]);
const crowd = (page, n, dx = 4, kind = 'blot') => page.evaluate(([n, dx, kind]) => {
  const g = window.__game, p = g.player, out = [];
  for (let i = 0; i < n; i++) { const e = g.spawnEnemy(kind, p.x + dx + (i % 4) * 0.7, p.z - 1 + Math.floor(i / 4) * 0.7, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(1); e.think = () => [0, 0]; e.elite = null; e.dmgTaken = 1; (window.__d = window.__d || []).push(e); out.push(window.__d.length - 1); }
  return out;
}, [n, dx, kind]);
const clear = page => page.evaluate(() => { for (const e of window.__game.entities) if (e.isEnemy) e.remove(); });

export default async function (page, R) {
  // ---------------------------------------------------------------- the workbench, as a player uses it
  await fresh(page, 'samurai', { level: 3 });
  const wb = await page.evaluate(() => { const b = window.__game.entities.find(e => e.constructor.name === 'Workbench'); return b && [b.x, b.z]; });
  R.ok(!!wb, 'Posy\'s workbench stands in the village');
  await walkTo(page, wb[0], wb[1] + 0.75);
  await page.evaluate(() => { window.__game.player.facing = Math.PI; });
  await pressE(page, 1);
  R.ok(await page.evaluate(() => window.__game.ui.craftOpen), 'E at the workbench opens the crafting screen');
  const locked = await page.evaluate(() => document.getElementById('craft-detail').textContent);
  R.ok(/Undiscovered|Hint/.test(locked), 'undiscovered recipes show a hint instead of the recipe', locked.slice(0, 70));

  // known recipe, missing materials: nothing is taken
  await give(page, { shard: 2 }, ['thornrebuke']);
  const before = await page.evaluate(() => { const g = window.__game; g.inv.coins = 100; g.ui.crI = g.ui.craftRecipes().findIndex(r => r.id === 'thornrebuke'); g.ui.crW = 0; g.ui.renderCraft(); return { mats: { ...g.inv.mats }, coins: g.inv.coins, w: g.inv.equip.weapon.craft }; });
  const shown = await page.evaluate(() => document.getElementById('craft-detail').textContent);
  R.ok(/Thorn Rebuke/.test(shown) && /parry/.test(shown) && /Samurai only/.test(shown) && /Thornheart 0\/1/.test(shown), 'recipe shows effect, class, requirements and what you have', shown.slice(0, 120));
  await sim(page, 1, ['KeyF']);
  const fail = await page.evaluate(() => { const g = window.__game; return { mats: { ...g.inv.mats }, coins: g.inv.coins, w: g.inv.equip.weapon.craft }; });
  R.ok(JSON.stringify(fail) === JSON.stringify(before), 'a failed craft consumes nothing', JSON.stringify(fail));

  // now with materials: craft on the equipped katana
  await give(page, { thornheart: 1, shard: 6 });
  await page.evaluate(() => window.__game.ui.renderCraft());
  await sim(page, 1); await sim(page, 1, ['KeyF']); await sim(page, 2);
  const made = await page.evaluate(() => { const g = window.__game; return { craft: g.inv.equip.weapon.craft, name: g.inv.equip.weapon.name, mats: { ...g.inv.mats }, coins: g.inv.coins, chimes: g.inv.chimes.length }; });
  R.ok(made.craft === 'thornrebuke' && made.mats.thornheart === 0 && made.mats.shard === 0 && made.coins === 60, 'craft takes exactly the listed cost and engraves the weapon', JSON.stringify(made));
  // pressing again cannot duplicate or double-charge
  await sim(page, 1, ['KeyF']); await sim(page, 1); await sim(page, 1, ['KeyF']); await sim(page, 1);
  const again = await page.evaluate(() => { const g = window.__game; return { mats: { ...g.inv.mats }, coins: g.inv.coins }; });
  R.ok(again.mats.shard === 0 && again.coins === 60, 'repeating the craft does nothing (already engraved)');
  await page.evaluate(() => window.__game.ui.closeCraft());

  // saved at once: a reload keeps the engraving and the spent materials
  const saved = await page.evaluate(() => { const inv = JSON.parse(localStorage.getItem('mossling-save-v2')).characters[0].inventory; return { craft: inv.equip.weapon.craft, mats: inv.mats, recipes: inv.recipes }; });
  R.ok(saved.craft === 'thornrebuke' && saved.mats.thornheart === 0 && saved.recipes.includes('thornrebuke'), 'crafting saves immediately', JSON.stringify(saved));
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 30000 });
  await page.evaluate(() => window.__start(false));
  await sim(page, 3);
  const loaded = await page.evaluate(() => { const g = window.__game; return { craft: g.inv.equip.weapon.craft, mats: g.inv.mats, cls: g.inv.cls }; });
  R.ok(loaded.craft === 'thornrebuke' && loaded.mats.shard === 0 && loaded.cls === 'samurai', 'engraving and pouch survive a reload', JSON.stringify(loaded));

  // Thorn Rebuke in combat: parry -> thorns, next swing -> rooting crescent
  await clear(page);
  const tr = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    const e = g.spawnEnemy('brigand', p.x, p.z + 1.2, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e5;
    p.facing = 0; p.setState('block'); p.blockT = 0.05; p.invuln = 0;
    const r = p.hurt({ dmg: 2, x: e.x, z: e.z, src: e });
    const rebuke = p.rebukeT;
    p.setState('move'); p.startAttack();
    const c = g.entities.find(x => x.kind === 'crescent');
    e.remove();
    return { r, rebuke, crescent: !!c, root: c && c.root };
  });
  R.ok(tr.r === 'parry' && tr.rebuke > 1.9 && tr.crescent && tr.root > 0, 'Thorn Rebuke: parry arms a rooting thorn crescent', JSON.stringify(tr));

  // class rule and transfer
  const cls = await page.evaluate(() => { const g = window.__game, c = window.__craft; g.inv.recipes.push('echofletch'); g.inv.mats.echo = 1; g.inv.mats.shard = 10; return c.check(g, c.recipeById('echofletch'), g.inv.equip.weapon); });
  R.ok(!cls.ok && /Archer/.test(cls.reason), 'another class\'s recipe is refused', cls.reason);
  const tf = await page.evaluate(() => {
    const g = window.__game, c = window.__craft, inv = g.inv;
    const k2 = window.__items.genItem({ level: 3, cls: 'samurai', slot: 'weapon', rarity: 2 }); inv.bag.push(k2);
    inv.coins = 100; inv.mats.shard = 10;
    const chk = c.check(g, c.recipeById('thornrebuke'), k2);
    const res = c.craft(g, 'thornrebuke', k2);
    return { cost: chk.cost, ok: res.ok, old: inv.equip.weapon.craft || null, neu: k2.craft, shard: inv.mats.shard, coins: inv.coins, th: inv.mats.thornheart };
  });
  R.ok(tf.ok && tf.old === null && tf.neu === 'thornrebuke' && tf.shard === 7 && tf.coins === 75 && tf.th === 0, 'an engraving moves to a better weapon for shards and pips, no essence', JSON.stringify(tf));
  const salv = await page.evaluate(() => { const g = window.__game, i = g.inv.bag.findIndex(x => x.craft); const n = g.inv.bag.length; g.salvageItem(i); return n === g.inv.bag.length; });
  R.ok(salv, 'an engraved weapon in the bag cannot be salvaged by accident');

  // Returning Cut sigil: the dash is repeated by an afterimage
  await page.evaluate(() => { const g = window.__game; g.inv.level = 6; g.inv.skills = [1, 1, 1]; g.inv.recipes.push('returningcut'); g.inv.mats.echo = 1; g.inv.mats.shard = 10; g.inv.coins = 100; window.__craft.craft(g, 'returningcut'); g.res = 100; });
  await clear(page);
  const line = await crowd(page, 1, 2.5);
  await page.evaluate(() => { const p = window.__game.player; p.facing = Math.PI / 2; p.cds = [0, 0, 0]; });
  await sim(page, 1, ['Digit1']); await sim(page, 30);
  const rc = await page.evaluate(i => { const g = window.__game, e = window.__d[i]; return { sig: g.inv.sigils[0], hits: e.maxHp - e.hp }; }, line[0]);
  R.ok(rc.sig === 'returningcut', 'sigil is installed on Iaido Dash');
  R.ok(await page.evaluate(() => window.__game.stats.crafted >= 3), 'crafting counts in stats');

  // ---------------------------------------------------------------- Archer: Echo Fletching
  await fresh(page, 'archer', { level: 6 });
  await give(page, { echo: 2, shard: 20 }, ['echofletch', 'echosnare']);
  await page.evaluate(() => { const g = window.__game; g.inv.coins = 200; const c = window.__craft; c.craft(g, 'echofletch', g.inv.equip.weapon); c.craft(g, 'echosnare'); });
  const ef = await page.evaluate(() => {
    const g = window.__game, p = g.player; p.facing = Math.PI / 2; p.fireBasic(true);
    const ec = g.entities.filter(e => e.constructor.name === 'EchoShot').length;
    g.noRender = true; window.__sim(25); g.noRender = false;
    const echoes = g.stats.echo || 0;
    return { ec, echoProj: g.entities.filter(e => e.echo).length + (g.__echoSeen || 0) };
  });
  R.ok(ef.ec === 1, 'charged shot leaves exactly one echo', JSON.stringify(ef));
  const ef2 = await page.evaluate(() => {
    const g = window.__game, p = g.player; let spawned = 0; const sp = g.spawn.bind(g);
    g.spawn = e => { if (e.echo) spawned++; if (e.constructor.name === 'EchoShot') spawned += 100; return sp(e); };
    p.facing = Math.PI / 2; p.fireBasic(true); g.noRender = true; window.__sim(30); g.noRender = false; g.spawn = sp;
    return spawned;
  });
  R.ok(ef2 === 101, 'the echo fires once and never echoes itself', String(ef2));
  // Echo Snare re-arms once
  await clear(page);
  const sn = await page.evaluate(() => {
    const g = window.__game, p = g.player; const T = g.entities; let blasts = 0;
    const e = g.spawnEnemy('blot', p.x + 2, p.z, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e5; e.think = () => [0, 0];
    const Trap = window.__combat.Trap; const t = new Trap(g, p.x + 2, p.z, 1, 1, true); g.spawn(t);
    const hp0 = e.hp; g.noRender = true; window.__sim(12); const hp1 = e.hp; window.__sim(40); const hp2 = e.hp; g.noRender = false;
    e.remove();
    return { first: hp0 > hp1, second: hp1 > hp2, gone: t.dead };
  });
  R.ok(sn.first && sn.second && sn.gone, 'Echo Snare springs twice, then is spent', JSON.stringify(sn));

  // a strong build: pierce-all + explosive arrows + echoes against a crowd, vs. the same bow plain
  const volley = async (build) => {
    await clear(page);
    const ids = await crowd(page, 16, 3);
    return page.evaluate(([ids, build]) => {
      const g = window.__game, inv = g.inv, p = g.player;
      const bow = window.__items.genItem({ level: 6, cls: 'archer', slot: 'weapon', rarity: 2 });
      bow.min = 20; bow.max = 30; bow.spd = 1; bow.stats = {}; // fixed, level-6-ish rare bow
      if (build) bow.craft = 'echofletch';
      inv.equip.weapon = bow; g.recalc();
      if (build) { g.pstats.uniques.add('windwhisper'); g.pstats.uniques.add('sunshot'); }
      const unit = 6 * (1 + 0.3 * 5);
      for (const i of ids) { const e = window.__d[i]; e.hp = e.maxHp = 2 * unit; } // same-level Blotlings
      g.noRender = true; for (let k = 0; k < 3; k++) { p.facing = Math.PI / 2; p.fireBasic(true); window.__sim(30); } g.noRender = false;
      return ids.filter(i => window.__d[i].dead).length;
    }, [ids, build]);
  };
  const plain = await volley(false), built = await volley(true);
  R.ok(built >= 13 && (16 - built) * 3 <= 16 - plain, 'an earned build (Windwhisper + Sunshot + Echo Fletching) shreds a crowd', `3 charged shots: ${built}/16 down with the build, ${plain}/16 with the same bow plain`);
  // ...but a boss is still a boss: armoured until choked
  const boss = await page.evaluate(() => {
    const g = window.__game, p = g.player; const B = window.__Boss; const b = new B(g, p.x + 4, p.z); b.state = 'idle'; b.update = () => {}; g.spawn(b);
    const hp0 = b.hp; g.noRender = true; for (let k = 0; k < 3; k++) { p.facing = Math.PI / 2; p.fireBasic(true); window.__sim(30); } g.noRender = false;
    const r = { hp0, hp1: b.hp }; b.remove(); g.bossActive = null; return r;
  });
  R.ok(boss.hp1 === boss.hp0, 'Bramblemaw still shrugs off shots until it is choked', JSON.stringify(boss));

  // ---------------------------------------------------------------- Witch: Ember Seeds + Rime Bloom + proc guard
  await fresh(page, 'witch', { level: 6 });
  await give(page, { ember: 1, thornheart: 1, shard: 20 }, ['emberseeds', 'rimebloom']);
  const wc = await page.evaluate(() => { const g = window.__game, c = window.__craft; g.inv.coins = 200; return [c.craft(g, 'emberseeds', g.inv.equip.weapon).ok, c.craft(g, 'rimebloom').ok]; });
  R.ok(wc[0] && wc[1], 'witch crafts Ember Seeds and Rime Bloom');
  await clear(page);
  const seeds = await page.evaluate(() => {
    const g = window.__game, p = g.player; p.facing = Math.PI / 2; p.fireBasic(true);
    g.noRender = true; let n = 0, maxSeeds = 0;
    for (let i = 0; i < 60; i++) { window.__sim(1); n = g.entities.filter(e => e.constructor.name === 'EmberSeed').length; maxSeeds = Math.max(maxSeeds, n); }
    g.noRender = false;
    return { maxSeeds, left: n };
  });
  R.ok(seeds.maxSeeds === 3 && seeds.left === 0, 'a charged fireball plants three seeds that detonate (and plant nothing more)', JSON.stringify(seeds));
  const rime = await page.evaluate(() => {
    const g = window.__game, p = g.player; g.res = 100; p.cds = [0, 0, 0];
    const e = g.spawnEnemy('brigand', p.x + 1.5, p.z, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e5; e.think = () => [0, 0];
    g.noRender = true; window.__sim(1, ['Digit1']); window.__sim(2); g.noRender = false;
    const field = g.entities.some(x => x.constructor.name === 'RimeField'), frozen = e.status && e.status.freeze > 0;
    const h0 = e.hp; g.playerHit(e, { mult: 1, kind: 'bolt', dir: 0 }); const shatter = !(e.status.freeze > 0);
    e.remove();
    return { field, frozen, shatter };
  });
  R.ok(rime.field && rime.frozen && rime.shatter, 'Rime Bloom leaves a frost field and frozen foes shatter', JSON.stringify(rime));
  // a death-chain (Hexbloom) through a packed crowd stays bounded
  await clear(page);
  const packed = await crowd(page, 30, 2.5);
  const chain = await page.evaluate(ids => {
    const g = window.__game; for (const i of ids) { const e = window.__d[i]; e.hp = e.maxHp = 3; }
    g.pstats.uniques.add('hexbloom'); let calls = 0, maxDepth = 0; const ob = g.onEnemyDeath.bind(g);
    g.onEnemyDeath = e => { calls++; maxDepth = Math.max(maxDepth, g.procDepth || 0); return ob(e); };
    const first = window.__d[ids[0]]; g.playerHit(first, { mult: 99, kind: 'bolt', dir: 0 });
    g.onEnemyDeath = ob;
    return { calls, maxDepth };
  }, packed);
  R.ok(chain.maxDepth <= 2, 'death-triggered procs chain at most two links deep', JSON.stringify(chain));
  R.ok(await page.evaluate(() => window.__game.inv.chimes.length === 0 && !JSON.stringify(window.__craft.RECIPES).includes('chime')), 'no recipe ever uses a Chime');
}
