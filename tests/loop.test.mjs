import { readFileSync } from 'node:fs';
// Pass 5: the Bellstone loop (fast travel, rest respawn, dropped pips), the Silent Toll village
// consequence, the opening fight's mini-boss and reveal, settings, and old-save migration.
import { sim, fresh } from './lib.mjs';

export default async function (page, R) {
  // ---------------------------------------------------------------- death drop and recovery
  await fresh(page, 'samurai', { stage: 1, level: 4 });
  const death = await page.evaluate(() => {
    const g = window.__game, p = g.player, inv = g.inv;
    inv.coins = 200; const gear = inv.equip.weapon.itemInstanceId, mats = JSON.stringify(inv.mats);
    p.x = 58.5 + 90; p.z = 66.5 + 70; p.lastSafe = { x: 58.5 + 90, z: 66.5 + 70 };
    g.onPlayerDeath();
    return { coins: inv.coins, drop: g.flags.deathDrop, gear: inv.equip.weapon.itemInstanceId === gear, mats: JSON.stringify(inv.mats) === mats, recap: document.querySelector('#gameover .recap').innerHTML };
  });
  R.ok(death.coins === 100 && death.drop && death.drop.coins === 100 && death.gear && death.mats, 'dying drops half your carried pips where you fell; gear and materials stay', JSON.stringify(death));
  R.ok(/fell where you did/.test(death.recap), 'the death screen says where the pips went');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.revive());
  await page.waitForFunction(() => !window.__game.transitioning && window.__game.player, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const rec = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    const cache = g.entities.find(e => e.constructor.name === 'DeathCache');
    if (!cache) return { cache: false };
    p.x = cache.x; p.z = cache.z; g.noRender = true; window.__sim(3); g.noRender = false;
    return { cache: true, coins: g.inv.coins, flag: g.flags.deathDrop };
  });
  R.ok(rec.cache && rec.coins === 200 && !rec.flag, 'walking back to the gold beam recovers every pip', JSON.stringify(rec));
  const twice = await page.evaluate(() => {
    const g = window.__game, p = g.player; g.inv.coins = 100;
    g.onPlayerDeath(); const first = g.flags.deathDrop.coins;
    g.inv.coins += 40; g.onPlayerDeath();
    return { first, second: g.flags.deathDrop.coins, lost: g.lastDeathDrop.lostOld };
  });
  R.ok(twice.first === 50 && twice.lost === 50 && twice.second === 45, 'dying again before recovery loses the older pile only', JSON.stringify(twice));
  await page.waitForTimeout(1400);
  await page.evaluate(() => { const g = window.__game; g.dead = false; g.ui.show('gameover', false); g.inv.hp = g.inv.maxHp; g.player.setState('move'); });

  // ---------------------------------------------------------------- fast travel and rest respawn
  const travel = await page.evaluate(async () => {
    const g = window.__game, p = g.player;
    if (!g.discoveredBellstones.includes('dungeon:entrance')) g.discoveredBellstones.push('dungeon:entrance');
    const stone = g.entities.find(e => e.constructor.name === 'Bellstone');
    p.x = stone.x; p.z = stone.z + 0.7; p.combatT = 0;
    // a cleared foe waiting to respawn comes back when you rest
    const def = g.area.defs.find(d => d.type === 'enemy' && d.kind === 'blot');
    g.respawnQ = [{ def, t: g.time + 999 }];
    const before = g.entities.filter(e => e.def === def).length;
    stone.interact();
    for (let i = 0; i < 60 && !g.ui.choice; i++) { if (g.ui.typing) g.ui.typing.i = g.ui.typing.t = 1e3; await new Promise(r => setTimeout(r, 100)); }
    const opts = g.ui.choice ? g.ui.choice.opts.map(o => o.label) : [];
    const after = g.entities.filter(e => e.def === def).length;
    const i = opts.findIndex(l => /Hollow Mouth/.test(l));
    if (i >= 0) g.ui.pick(i);
    return { opts, respawned: after > before, queue: g.respawnQ.length };
  });
  R.ok(travel.opts.some(l => /Travel to Hollow Mouth/.test(l)), 'resting at a Bellstone offers travel to every discovered Bellstone', JSON.stringify(travel.opts));
  R.ok(travel.respawned && travel.queue === 0, 'resting brings back the cleared standard foes', JSON.stringify(travel));
  await page.waitForFunction(() => window.__game.area.id === 'dungeon' && !window.__game.transitioning, null, { timeout: 10000 });
  R.ok(true, 'fast travel arrives at the chosen Bellstone (Rootwell Hollow)');

  // ---------------------------------------------------------------- The Silent Toll
  await fresh(page, 'witch', { stage: 1, level: 8 });
  const toll = await page.evaluate(async () => {
    const g = window.__game, f = g.flags;
    const before = g.entities.some(e => e.constructor.name === 'TollRack');
    f.bellscore = true;
    const tamsin = g.entities.find(e => e.id === 'tamsin');
    g.story.tollScore(tamsin);
    for (let i = 0; i < 40 && g.ui.talking; i++) { g.ui.next(); g.ui.typing = null; await new Promise(r => setTimeout(r, 10)); }
    const oswin = g.entities.find(e => e.id === 'oswin');
    return { before, rack: g.entities.some(e => e.constructor.name === 'TollRack'), hung: f.tollHung, recipe: g.inv.recipes.includes('tollring'), oswin: [oswin.x, oswin.z] };
  });
  R.ok(!toll.before && toll.rack && toll.hung && toll.recipe && Math.abs(toll.oswin[0] - 54.5 - 90) < 0.5, 'bringing the Score home hangs a toll rack, moves Oswin to tend it and teaches Tolling Edge', JSON.stringify(toll));
  await page.evaluate(() => window.__game.save());
  await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 30000 });
  await page.evaluate(() => window.__start(false)); await sim(page, 3);
  R.ok(await page.evaluate(() => window.__game.entities.some(e => e.constructor.name === 'TollRack')), 'the changed village survives a reload');

  // ---------------------------------------------------------------- opening fight: a mini-boss, then the reveal
  const intro = await page.evaluate(async () => {
    const g = window.__game;
    for (const e of g.entities) if (e.isEnemy || e.arena) e.remove();
    g.flags.introFought = false; g.flags.revealed = false;
    g.startIntroFight();
    const A = g.entities.find(e => e.waves && e.id === 'intro');
    return { waves: A.waves.length, last: A.waves[A.waves.length - 1].map(w => w[0]) };
  });
  R.ok(intro.waves === 3 && intro.last.includes('porcelain'), 'the opening fight ends with a Porcelain Guard that teaches charged/heavy blows', JSON.stringify(intro));

  // ---------------------------------------------------------------- settings do something
  const set = await page.evaluate(() => {
    const g = window.__game, s = g.settings;
    const A = { bloom: g.pr.postMat.uniforms.bloomScale.value, fx: g.fx.density, shadow: g.sun.shadow.mapSize.x };
    Object.assign(s, { bloom: 0, fx: 0.35, quality: 'low', hudScale: 1.3 });
    window.__settings.applySettings(s, g);
    const B = { bloom: g.pr.postMat.uniforms.bloomScale.value, fx: g.fx.density, shadow: g.sun.shadow.mapSize.x, hud: getComputedStyle(document.documentElement).getPropertyValue('--hud').trim() };
    Object.assign(s, window.__settings.DEFAULTS); window.__settings.applySettings(s, g);
    return { A, B };
  });
  R.ok(set.B.bloom === 0 && set.B.fx === 0.35 && set.B.shadow === 1024 && set.B.hud === '1.3' && set.A.shadow === 2048, 'bloom, particle density, shadow size and HUD scale settings take effect', JSON.stringify(set));
  await migration(page, R);
}

// ---------------------------------------------------------------- a real Pass 4 save, carried into Pass 5
// tests/fixtures/pass4-save.json was written by the unmodified pre-Pass-5 game (commit a8efca8).
export async function migration(page, R) {
  const raw = readFileSync(new URL('./fixtures/pass4-save.json', import.meta.url), 'utf8');
  const orig = JSON.parse(raw).characters[0];
  const ids = [...Object.values(orig.inventory.equip).filter(Boolean), ...orig.inventory.bag].map(i => i.itemInstanceId).sort();
  const reload = async () => { await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 30000 }); };
  await page.evaluate(r => { localStorage.clear(); localStorage.setItem('mossling-save-v2', r); }, raw);
  await reload();
  await page.evaluate(() => window.__start(false)); await sim(page, 3);
  const a = await page.evaluate(() => { const g = window.__game, inv = g.inv; return { id: g.profile.id, cls: inv.cls, lvl: inv.level, xp: inv.xp, sp: inv.sp, coins: inv.coins, tree: inv.tree, loadout: inv.loadout, ids: [...Object.values(inv.equip).filter(Boolean), ...inv.bag].map(i => i.itemInstanceId).sort(), up: inv.equip.weapon.upgradeLevel, mats: inv.mats.echo, q: g.flags.q_mill, stones: g.discoveredBellstones }; });
  R.ok(a.id === orig.id && a.cls === 'archer' && a.lvl === orig.inventory.level && a.xp === orig.inventory.xp && a.coins === orig.inventory.coins, 'old save loads: same character, class, level, XP and pips', JSON.stringify({ id: a.id === orig.id, lvl: a.lvl, xp: a.xp }));
  R.ok(JSON.stringify(a.ids) === JSON.stringify(ids), 'every item keeps its identity');
  R.ok(a.tree.multishot === 4 && a.tree.snare === 2 && a.tree.rain === 1 && a.sp === orig.inventory.sp && a.loadout.slice(0, 3).join() === 'multishot,snare,rain', 'the three old ability ranks become the same tree ranks and hotbar; unspent points unchanged', JSON.stringify({ tree: a.tree, sp: a.sp, loadout: a.loadout }));
  R.ok(a.up === 3 && a.mats === 2 && a.q === 2 && a.stones.includes('overworld:village'), 'reinforcement, materials, quests and Bellstones carry over');
  // save → reload → change → reload
  await page.evaluate(() => window.__game.save()); await reload(); await page.evaluate(() => window.__start(false)); await sim(page, 2);
  const b = await page.evaluate(async () => { const g = window.__game, S = window.__skills; const ok = S.spendNode(g.inv, 'hawkeye'); g.recalc(); S.setLoadout(g.inv, 4, 'multishot'); await g.save(); return { ok, tree: JSON.stringify(g.inv.tree), lo: g.inv.loadout.join() }; });
  await reload(); await page.evaluate(() => window.__start(false)); await sim(page, 2);
  const c = await page.evaluate(() => { const g = window.__game; return { tree: JSON.stringify(g.inv.tree), lo: g.inv.loadout.join(), sp: g.inv.sp, ids: [...Object.values(g.inv.equip).filter(Boolean), ...g.inv.bag].map(i => i.itemInstanceId).sort() }; });
  R.ok(b.ok && c.tree === b.tree && c.lo === b.lo && c.sp === orig.inventory.sp - 1 && JSON.stringify(c.ids) === JSON.stringify(ids), 'save, reload, spend a point, reload again: tree, hotbar and items are stable', JSON.stringify({ b, c: { tree: c.tree, lo: c.lo, sp: c.sp } }));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mossling-save-v2')).schemaVersion);
  R.ok(stored === 3, 'the save stays schema 3 under the same key (older builds can still read it)', String(stored));
}
