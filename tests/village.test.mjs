// Villagers, the mill -> recipe -> village chain, and the Echo (combat and puzzle use).
import { sim, fresh, walkTo, pressE } from './lib.mjs';

const dialog = page => page.evaluate(() => { const d = document.getElementById('dialog'); return d.classList.contains('hidden') ? null : { who: d.querySelector('.who').textContent, text: d.querySelector('.text').textContent, choices: [...d.querySelectorAll('.choices span')].map(s => s.textContent) }; });
// advance text until a choice menu (or nothing) is showing
async function toChoices(page, max = 30) {
  for (let i = 0; i < max; i++) {
    await sim(page, 30);
    const d = await dialog(page);
    if (!d || d.choices.length) return d;
    await sim(page, 1, ['KeyE']); await sim(page, 1);
  }
  return dialog(page);
}
async function choose(page, label) {
  const i = await page.evaluate(label => { const ui = window.__game.ui; return ui.choice ? ui.choice.opts.findIndex(o => o.label.includes(label)) : -1; }, label);
  if (i < 0) return false;
  await page.evaluate(i => window.__game.ui.pick(i), i);
  await sim(page, 1);
  return true;
}
async function talkTo(page, id) {
  // The decorated village has nearby workbenches and props. Approach the NPC
  // from a side where the real interaction selector actually targets them.
  for (let side = 0; side < 8; side++) {
    await page.evaluate(([id, side]) => {
      const g = window.__game, p = g.player, n = g.entities.find(e => e.id === id);
      n.wanderR = 0; n.tx = n.x; n.tz = n.z;
      const angle = side * Math.PI / 4;
      p.x = n.x + Math.sin(angle) * 0.8; p.z = n.z + Math.cos(angle) * 0.8;
      p.facing = Math.atan2(n.x - p.x, n.z - p.z); g.snapCamera();
    }, [id, side]);
    await sim(page, 1);
    if (await page.evaluate(id => window.__game.interactTarget()?.id === id, id)) {
      await pressE(page, 1); return;
    }
  }
  throw new Error(`No accessible interaction approach to ${id}`);
}
async function finish(page) { for (let i = 0; i < 30; i++) { const d = await toChoices(page); if (!d) return; if (d.choices.length) { await choose(page, 'Goodbye'); await sim(page, 2); } } }

export default async function (page, R) {
  // ---------------------------------------------------------------- Tamsin: topics, class-aware, read state
  await fresh(page, 'archer', { stage: 1 });
  await talkTo(page, 'tamsin');
  let d = await toChoices(page);
  R.ok(d && d.who === 'Elder Tamsin' && d.choices.some(c => c.includes('• The Dawnbell')), 'Tamsin offers topics, unread ones marked', JSON.stringify(d && d.choices));
  R.ok(d.choices.some(c => /About my bow/.test(c)), 'topics use class-aware wording (archer: bow)');
  await choose(page, 'About my bow');
  d = await dialog(page);
  await sim(page, 40);
  d = await dialog(page);
  R.ok(/mother's hunting bow/.test(d.text), 'the archer hears about their own heirloom', d.text.slice(0, 60));
  d = await toChoices(page);
  R.ok(d && /Anything else/.test(d.text) && d.choices.some(c => c === 'About my bow'), 'after a topic the menu returns, marked as read', JSON.stringify(d && d.choices));
  await choose(page, 'About my bow'); await sim(page, 40);
  d = await dialog(page);
  R.ok(d && /Look after it/.test(d.text), 'a read topic gives its short version, not the full exposition', d && d.text.slice(0, 60));
  await finish(page);
  await fresh(page, 'samurai', { stage: 1 });
  await talkTo(page, 'tamsin');
  d = await toChoices(page);
  R.ok(d.choices.some(c => /About my blade/.test(c)), 'samurai gets blade wording');
  await finish(page);

  // ---------------------------------------------------------------- the mill: quest -> recipe -> visible village change
  await talkTo(page, 'oswin');
  d = await toChoices(page);
  await choose(page, 'Why is the mill still');
  await finish(page);
  R.ok(await page.evaluate(() => window.__game.flags.q_mill === 1), 'Oswin gives the Still Mill quest through a topic');
  R.ok(await page.evaluate(() => !window.__game.entities.some(e => e.constructor.name === 'MillYard')), 'no mill yard before the mill is fixed');
  await page.evaluate(() => { const g = window.__game, p = g.player; g.inv.bellows = true; p.x = 47.5; p.z = 53.6; p.facing = Math.PI; g.snapCamera(); });
  await sim(page, 1); await sim(page, 26, ['KeyL']); await sim(page, 12);
  R.ok(await page.evaluate(() => !!window.__game.flags.windmill), 'a charged gale restarts the windmill');
  await talkTo(page, 'oswin');
  await finish(page);
  const mill = await page.evaluate(() => { const g = window.__game; return { q: g.flags.q_mill, sail: g.inv.mats.sailcloth, recipe: g.inv.recipes.includes('millwind'), yard: g.entities.some(e => e.constructor.name === 'MillYard') }; });
  R.ok(mill.q === 2 && mill.sail === 1 && mill.recipe, 'Oswin rewards sailcloth and teaches Millwind Edge', JSON.stringify(mill));
  R.ok(mill.yard, 'the village visibly changes: a whetwheel yard appears by the mill');
  await talkTo(page, 'tamsin');
  d = await toChoices(page);
  R.ok(d && /mill/.test(d.text), 'Tamsin reacts to the mill', d && d.text.slice(0, 80));
  await finish(page);
  await page.evaluate(() => { window.__game.flags.metPosy = true; }); // past the first-meeting greeting
  await talkTo(page, 'posy');
  d = await toChoices(page);
  R.ok(d && /essence/.test(d.text) && d.choices.some(c => c.includes('Use the workbench')), 'Posy notices the sailcloth and offers the bench', d && d.text.slice(0, 80));
  await choose(page, 'Use the workbench');
  const mw = await page.evaluate(() => { const g = window.__game; g.inv.mats.shard = 8; g.inv.coins = 60; const r = window.__craft.craft(g, 'millwind', g.inv.equip.weapon); g.ui.closeCraft(); return r.ok; });
  R.ok(mw, 'Millwind Edge crafted from the reward');
  // Millwind: a charged spin throws a gust (combat + wind puzzles without the bellows)
  const gusted = await page.evaluate(() => { const g = window.__game, p = g.player; let calls = []; const og = g.gust.bind(g); g.gust = (a, b, c, d) => { calls.push([b, !!c, !!d]); return og(a, b, c, d); }; p.setState('charge'); p.chargeT = 0.8; g.noRender = true; window.__sim(2); g.noRender = false; g.gust = og; return calls; });
  R.ok(gusted.some(c => c[1]), 'a charged attack with Millwind throws a gust', JSON.stringify(gusted));
  // it all persists
  await page.evaluate(() => window.__game.save());
  await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 30000 });
  await page.evaluate(() => window.__start(false)); await sim(page, 3);
  const after = await page.evaluate(() => { const g = window.__game; return { yard: g.entities.some(e => e.constructor.name === 'MillYard'), q: g.flags.q_mill, craft: g.inv.equip.weapon.craft, read: !!g.flags['topic:oswin:mill'] }; });
  R.ok(after.yard && after.q === 2 && after.craft === 'millwind' && after.read, 'mill yard, quest, engraving and dialogue state survive a reload', JSON.stringify(after));

  // ---------------------------------------------------------------- the Echo: puzzle use
  const race = async () => {
    await page.evaluate(() => { const g = window.__game, p = g.player; p.x = 29.5; p.z = 29.8; p.facing = Math.PI; p.setState('move'); g.snapCamera(); g.setSignal('echo.a', false, false); g.setSignal('echo.b', false, false); });
    await sim(page, 2);
    await sim(page, 1, ['KeyL']); await sim(page, 1);
    const t0 = await page.evaluate(() => window.__game.time);
    await walkTo(page, 31.5, 33.3, 200, 0.3); await walkTo(page, 33.4, 33.3, 200, 0.3); await walkTo(page, 35.5, 29.8, 200, 0.25);
    await page.evaluate(() => { window.__game.player.facing = Math.PI; });
    await sim(page, 1, ['KeyL']); await sim(page, 3);
    const t1 = await page.evaluate(() => window.__game.time);
    await sim(page, 20);
    return { open: await page.evaluate(() => !!window.__game.signal('ow.echo')), secs: +(t1 - t0).toFixed(2) };
  };
  await fresh(page, 'witch', { stage: 3 });
  await page.evaluate(() => { const g = window.__game; g.inv.bellows = true; g.inv.chimes = []; });
  const noEcho = await race();
  R.ok(!noEcho.open, 'without the echo the door stays shut (the walk is longer than a spin)', JSON.stringify(noEcho));
  await page.evaluate(() => { window.__game.inv.chimes = ['verdant']; });
  const withEcho = await race();
  R.ok(withEcho.open, 'with the Verdant Chime\'s echo, the Echo Door opens', JSON.stringify(withEcho));
  await walkTo(page, 36.5, 25.4, 200, 0.2);
  await page.evaluate(() => { window.__game.player.facing = Math.PI; });
  await pressE(page, 1); await page.waitForTimeout(900);
  for (let i = 0; i < 6; i++) { await pressE(page, 1); await page.waitForTimeout(200); }
  const loot = await page.evaluate(() => { const g = window.__game; return { echo: g.inv.mats.echo, rime: g.inv.recipes.includes('rimebloom'), opened: !!g.flags['chest:echo-chest'] }; });
  R.ok(loot.opened && loot.echo === 1 && loot.rime, 'the Echo chest gives a Hollow Echo and teaches the class sigil', JSON.stringify(loot));

  // ---------------------------------------------------------------- the Echo: combat use
  const combat = await page.evaluate(() => {
    const g = window.__game, p = g.player; p.x = 30; p.z = 31; p.facing = Math.PI / 2; p.setState('move');
    const e = g.spawnEnemy('beetle', p.x + 1.5, p.z, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e5; e.think = () => [0, 0];
    let gusts = 0; const og = e.onGust.bind(e); e.onGust = (d, pw) => { gusts++; return og(d, pw); };
    g.noRender = true; window.__sim(1, ['KeyL']); window.__sim(1);
    const ghost = g.entities.some(x => x.constructor.name === 'GustEcho');
    e.x = p.x + 1.5; e.z = p.z; e.kx = e.kz = 0;
    window.__sim(50); g.noRender = false;
    e.remove();
    return { ghost, gusts };
  });
  R.ok(combat.ghost && combat.gusts === 2, 'a gust leaves a visible echo that hits the same foe again', JSON.stringify(combat));
}
