// MOSSDEV lab: isolation from adventure saves, persistence across refresh, exact items,
// presets, arenas and repeatable resets, driven through the real game.
import { sim, fresh } from './lib.mjs';

const SAVE_KEY = 'mossling-save-v2';
const devMode = page => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mossling-settings') || '{}'); s.devMode = true; localStorage.setItem('mossling-settings', JSON.stringify(s)); });
const boot = async page => { await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading') && document.getElementById('title'), null, { timeout: 30000 }); await sim(page, 2); };
const adventure = page => page.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); const c = d.characters[0]; return JSON.stringify({ inv: c.inventory, flags: c.world.flags, cp: c.world.checkpoint, disc: c.world.discovery?.regions }); }, SAVE_KEY);

export default async function (page, R) {
  // ---------------------------------------------------------------- normal play has no lab
  await fresh(page, 'archer', { stage: 1, level: 6 });
  await page.keyboard.press('F10'); await sim(page, 2);
  R.ok(await page.evaluate(() => !window.__game.devlab.active && document.getElementById('mossdev').classList.contains('hidden')), 'with Developer mode off, F10 does nothing');
  await page.evaluate(() => localStorage.removeItem('mossling-devlab-v1'));

  // ---------------------------------------------------------------- enter from an adventure
  await devMode(page); await boot(page);
  await fresh(page, 'archer', { stage: 1, level: 6 });
  await page.evaluate(() => { const g = window.__game; g.player.x += 1.5; g.save(); });
  const advPos = await page.evaluate(() => ({ area: window.__game.area.id, x: window.__game.player.x, z: window.__game.player.z, id: window.__game.profile.id }));
  await page.keyboard.press('F10'); await page.waitForFunction(() => window.__game.devlab.active, null, { timeout: 10000 }); await sim(page, 2);
  const before = await adventure(page);
  const inLab = await page.evaluate(() => { const g = window.__game; return { area: g.area.id, cls: g.inv.cls, lvl: g.inv.level, open: g.devlab.overlayOpen, sandbox: g.sandbox, targets: g.devlab.targets.length }; });
  R.ok(inLab.area === 'mosslab' && inLab.cls === 'archer' && inLab.lvl === 6 && inLab.open && inLab.sandbox, 'F10 opens MOSSDEV on a sandbox copy of the adventure character', JSON.stringify(inLab));

  // ---------------------------------------------------------------- do everything that must NOT leak
  const leak = await page.evaluate(async () => {
    const g = window.__game, L = g.devlab, I = window.__items;
    L.setCheat('god', true); L.setCheat('infRes', true);
    const it = I.makeNamed('moonfeather', 12, null, 'archer') || I.makeNamed('galebow', 12, null, 'archer');
    L.spawnItem(it, true); L.lootSample('class100'); g.flags.bossKilled = true; g.flags.q_mill = 2; g.inv.coins = 9999; g.addCoins(50);
    await g.save(); window.__sim(40);
    return { equipped: g.inv.equip.weapon.name };
  });
  const after = await adventure(page);
  R.ok(before === after, 'god mode, test items, loot samples, boss flags and pips in the lab never reach the adventure save', leak.equipped);

  // ---------------------------------------------------------------- open / close does not reset the test
  const snap = () => page.evaluate(() => { const g = window.__game; return JSON.stringify({ w: g.inv.equip.weapon, t: g.devlab.targets.map(e => [e.kind, Math.round(e.x * 10), Math.round(e.z * 10)]), cls: g.inv.cls }); });
  await page.evaluate(() => { window.__game.devlab.loadArena('dummy'); window.__game.devlabUI.close(); }); await sim(page, 5);
  const s0 = await snap();
  await page.keyboard.press('F10'); await sim(page, 1); const opened = await page.evaluate(() => window.__game.devlab.overlayOpen);
  await page.evaluate(() => { const b = document.querySelector('#mossdev [data-tab="presets"]'); b.click(); document.querySelector('#mossdev [data-tab="items"]').click(); });
  await page.keyboard.press('F10'); await sim(page, 1);
  R.ok(opened && (await snap()) === s0 && !(await page.evaluate(() => window.__game.devlab.overlayOpen)), 'opening and closing the lab keeps the running test exactly as it was');
  const paused = await page.evaluate(() => { const g = window.__game; g.devlabUI.open(); const t = g.time; return new Promise(r => setTimeout(() => { r(g.time === t); g.devlabUI.close(); }, 400)); });
  R.ok(paused, 'the full configuration panel pauses the simulation');

  // ---------------------------------------------------------------- Spawn + Equip applies the exact item
  const exact = await page.evaluate(() => {
    const g = window.__game, ui = g.devlabUI;
    ui.open('items'); ui.f.q = 'candelabra'; ui.render();
    document.querySelector('#mossdev .md-item[data-id="candelabra"]').click();
    const shown = JSON.stringify(ui.sel.item);
    const sw = document.querySelector('#mossdev [data-act="switchequip"]'); sw && sw.click();
    const eq = g.inv.equip.weapon; ui.close();
    const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.magazine; return JSON.stringify(c); };
    return { same: strip(JSON.parse(shown)) === strip(eq), cls: g.inv.cls, name: eq.name, model: !!g.player.m, kit: window.__game.player && g.pstats.family };
  });
  R.ok(exact.same && exact.cls === 'witch' && exact.name === "Chandler's Candelabra", 'Switch class and test equips the exact roll that was shown (no reroll)', JSON.stringify(exact));

  // ---------------------------------------------------------------- class switching rebuilds rig and resources
  const gs = await page.evaluate(() => { const g = window.__game, L = g.devlab; L.setClass('gunslinger'); const w = g.inv.equip.weapon; return { cls: g.inv.cls, pcls: g.player.cls, kind: w.kind, rounds: w.magazine?.rounds, res: g.res, hp: g.inv.hp === g.inv.maxHp, sp: g.inv.sp }; });
  R.ok(gs.cls === 'gunslinger' && gs.pcls === 'gunslinger' && gs.kind === 'revolver' && gs.rounds === 6 && gs.res === 100 && gs.hp, 'switching class rebuilds the player rig, weapon, magazine and resources', JSON.stringify(gs));
  const soul = await page.evaluate(() => { const g = window.__game, L = g.devlab; L.setClass('soulbound'); L.setCheat('infRes', true); g.res = 0; window.__sim(2); return { cls: g.player.cls, echoes: Math.floor(g.res / 20) }; });
  R.ok(soul.cls === 'soulbound' && soul.echoes === 5, 'infinite resource fills a Soulbound\'s five Echoes (the class\'s own meter)', JSON.stringify(soul));

  // ---------------------------------------------------------------- legal builds
  const build = await page.evaluate(() => { const g = window.__game, L = g.devlab, S = window.__skills; L.setClass('witch'); L.setLevel(20); const spent = L.maxPath(0); const inv = g.inv; const bad = S.treeOf('witch').filter(n => S.rankOf(inv, n.id) > n.max); return { spent, sp: inv.sp, bad: bad.length, level: inv.level }; });
  R.ok(build.spent === 19 && build.sp === 0 && build.bad === 0, 'Max this path spends exactly the level\'s points through the real tree rules', JSON.stringify(build));

  // ---------------------------------------------------------------- presets keep exact rolls
  const pre = await page.evaluate(() => {
    const g = window.__game, L = g.devlab, S = L.store;
    const w = JSON.stringify(g.inv.equip.weapon), r = S.savePreset('Fire test'); const id = r.id;
    L.setClass('samurai'); L.loadPreset(id);
    const bad = S.importPreset('{"mossdevPreset":1,"profile":{"cls":"wizard","level":999,"equip":{},"arena":"moon"}}'), junk = S.importPreset('not json');
    return { same: JSON.stringify(g.inv.equip.weapon) === w, cls: g.inv.cls, n: S.data.presets.length, bad: bad.ok, badMsg: bad.errors?.join(' '), junk: junk.ok };
  });
  R.ok(pre.same && pre.cls === 'witch', 'a saved preset restores the exact item roll and class', JSON.stringify(pre));
  R.ok(!pre.bad && !pre.junk && pre.n === 1 && /Unknown class/.test(pre.badMsg), 'invalid preset imports are refused with a reason and change nothing', pre.badMsg);

  // ---------------------------------------------------------------- telemetry measures resolved damage
  const tel = await page.evaluate(() => {
    const g = window.__game, L = g.devlab; L.loadArena('dummy'); const d = L.targets[0]; const hp0 = d.hp;
    for (let i = 0; i < 5; i++) g.playerHit(d, { mult: 1, kind: 'bolt', element: 'fire', dir: 0 });
    d.applyStatus('burn', 2, 5); window.__sim(60);
    const s = L.telemetry.summary(); return { total: s.total, hits: s.hits, direct: s.count.direct, dot: s.count.dot, uptime: s.uptime, alive: !d.dead && d.hp > 0 };
  });
  R.ok(tel.direct === 5 && tel.dot > 0 && tel.total > 0 && tel.alive && tel.uptime > 0, 'dummy telemetry counts direct hits and damage-over-time from real resolved damage; the dummy never dies', JSON.stringify(tel));

  // ---------------------------------------------------------------- arenas: crowd, elite rules, element lab, loot
  const ar = await page.evaluate(() => {
    const g = window.__game, L = g.devlab, P = L.profile;
    P.arenaOpts.crowdSize = 20; P.arenaOpts.crowdKinds = ['blot', 'beetle']; L.loadArena('crowd'); const crowd = g.entities.filter(e => e.isEnemy && !e.dead).length;
    P.arenaOpts.eliteKind = 'knight'; P.arenaOpts.eliteMod = 'Frostbound'; L.loadArena('elite'); const el = g.entities.find(e => e.isEnemy && e.elite);
    const refuse = L.spawnElite('thief', 'Brutal');
    L.loadArena('element'); const st = L.targets.map(e => e.labStatus + ':' + (e.status && e.status[e.labStatus] > 0));
    const loot = L.lootSample('class100');
    return { crowd, elite: el && el.elite, refuse, st, loot };
  });
  R.ok(ar.crowd === 20, 'the crowd arena spawns the chosen pack size', ar.crowd);
  R.ok(ar.elite === 'Frostbound' && ar.refuse === null, 'the elite arena uses the chosen modifier and refuses combinations the game never makes', JSON.stringify(ar.elite));
  R.ok(ar.st.length === 7 && ar.st.every(s => s.endsWith('true')), 'the element lab holds Wet, Burning, Chilled, Frozen, Shocked, Hexed and Marked through the enemies\' own status code', ar.st.join(' '));
  R.ok(ar.loot.n === 100 && ar.loot.wrongClass === 0, 'the 100-drop class sample is class-correct and goes to the tray, not the bag', JSON.stringify(ar.loot));

  // ---------------------------------------------------------------- Reset Test is repeatable and leak-free
  const rs = await page.evaluate(() => {
    const g = window.__game, L = g.devlab; L.loadArena('dummy');
    const count = () => ({ ents: g.entities.length, enemies: g.entities.filter(e => e.isEnemy).length, bag: g.inv.bag.length, handlers: [...(g.combatEvents.handlers.values())].reduce((a, s) => a + s.size, 0), w: g.inv.equip.weapon.itemInstanceId });
    L.resetTest(); window.__sim(5); const a = count();
    for (let i = 0; i < 5; i++) { L.resetTest(); window.__sim(5); }
    const b = count(); return { a, b };
  });
  R.ok(JSON.stringify(rs.a) === JSON.stringify(rs.b), 'repeated Reset Test leaves the same entities, enemies, bag, listeners and item', JSON.stringify(rs));

  // ---------------------------------------------------------------- one-click test from the manifest
  const man = await page.evaluate(() => { const g = window.__game, L = g.devlab; const ok = L.runManifest('combat.chainbolt'); return { ok, cls: g.inv.cls, w: g.inv.equip.weapon.base, arena: L.profile.arena, enemies: g.entities.filter(e => e.isEnemy && !e.dead).length, hp: g.inv.hp === g.inv.maxHp, res: g.res }; });
  R.ok(man.ok && man.cls === 'witch' && man.w === 'owlstaff' && man.arena === 'crowd' && man.enemies === 5 && man.hp && man.res === 100, 'one click prepares class, exact item, arena, targets and full resources', JSON.stringify(man));

  // ---------------------------------------------------------------- boss test uses the real encounter
  const boss = await page.evaluate(async () => { const g = window.__game, L = g.devlab; L.loadArena('boss'); await new Promise(r => setTimeout(r, 200)); return { area: g.area.id, room: g.room && g.room.id }; });
  await page.evaluate(() => { const g = window.__game; g.player.z -= 3; }); await sim(page, 20);
  const bossOn = await page.evaluate(() => { const g = window.__game; const on = !!g.bossActive; return { on, name: g.bossActive?.name }; });
  R.ok(boss.area === 'dungeon' && bossOn.on, 'the boss test loads Bramblemaw\'s own room and starts it through its real trigger', JSON.stringify({ ...boss, ...bossOn }));
  await page.waitForTimeout(3600); await sim(page, 5);

  // ---------------------------------------------------------------- refresh restores the lab setup
  await page.evaluate(() => { const g = window.__game, L = g.devlab; g.cutscene = false; L.runManifest('combat.sundown'); g.save(); });
  const lab0 = await page.evaluate(() => JSON.stringify({ w: window.__game.inv.equip.weapon, cls: window.__game.inv.cls, arena: window.__game.devlab.profile.arena }));
  await devMode(page); // the test helper fresh() clears storage, settings included
  await boot(page);
  await page.waitForFunction(() => window.__game.devlab.active, null, { timeout: 15000 }); await sim(page, 2);
  const lab1 = await page.evaluate(() => JSON.stringify({ w: window.__game.inv.equip.weapon, cls: window.__game.inv.cls, arena: window.__game.devlab.profile.arena }));
  const strip = s => { const o = JSON.parse(s); delete o.w.magazine; return JSON.stringify(o); };
  R.ok(strip(lab0) === strip(lab1), 'a page refresh brings the lab back with the same class, exact item and arena', lab1.slice(0, 80));

  // ---------------------------------------------------------------- Return to Adventure
  await page.evaluate(async () => { await window.__game.devlab.exit(); }); await sim(page, 3);
  const back = await page.evaluate(() => { const g = window.__game; return { area: g.area.id, x: g.player.x, z: g.player.z, cls: g.inv.cls, sandbox: !!g.sandbox, god: g.godMode, id: g.profile.id, weapon: g.inv.equip.weapon.name }; });
  R.ok(back.area === advPos.area && Math.abs(back.x - advPos.x) < 0.01 && Math.abs(back.z - advPos.z) < 0.01 && back.cls === 'archer' && !back.sandbox && !back.god && back.id === advPos.id, 'Return to Adventure puts the same character back where it stood, with nothing from the lab', JSON.stringify(back));
  const final = await adventure(page);
  const same = JSON.parse(final).inv.equip.weapon.name === JSON.parse(before).inv.equip.weapon.name && JSON.parse(final).flags.bossKilled === JSON.parse(before).flags.bossKilled && JSON.parse(final).inv.bag.length === JSON.parse(before).inv.bag.length;
  R.ok(same, 'after returning, the adventure save still has its own weapon, bag and flags');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mossling-settings') || '{}'); s.devMode = false; localStorage.setItem('mossling-settings', JSON.stringify(s)); localStorage.removeItem('mossling-devlab-v1'); });
}
