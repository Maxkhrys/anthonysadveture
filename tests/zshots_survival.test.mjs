// Survival pass captures (not a regression check).   OUT=docs/screens/survival node tests/run.mjs zshots_survival
const OUT = process.env.OUT || '/tmp';
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.jpg`, type: 'jpeg', quality: 85 });
const sim = (page, n, keys = []) => page.evaluate(([n, k]) => window.__sim(n, k), [n, keys]);
export default async function (page, R) {
  await page.evaluate(() => localStorage.removeItem('mossling-survival-v1'));
  await page.evaluate(() => { const S = window.__game.survivalMode.store; S.create({ name: 'Brambleholm', cls: 'archer', seed: 90210 }); S.create({ name: 'Foxglove Reach', cls: 'soulbound', seed: 31337 }); });
  await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading') && document.querySelector('#title-menu div'));
  await page.waitForTimeout(600); await shot(page, '01_main_menu');
  await page.getByText('Play Survival', { exact: true }).click(); await page.waitForTimeout(300); await shot(page, '02_survival_worlds');
  await page.getByText('New Survival World', { exact: true }).click(); await page.fill('#nw-name', 'Mosswood Test'); await page.fill('#nw-seed', 'lantern'); await page.click('#title-card [data-cls="samurai"]'); await page.waitForTimeout(200); await shot(page, '03_new_world');
  await page.getByText('Create & play', { exact: true }).click();
  await page.waitForFunction(() => window.__game.survival && window.__game.area?.id === 'wilds');
  await page.mouse.move(640, 700); await sim(page, 40); await page.waitForTimeout(400); await shot(page, '04_start_clearing');
  // gathering: walk to a tree and swing
  await page.evaluate(() => { const g = window.__game, p = g.player; const t = g.entities.filter(e => e.isNode && e.type === 'tree').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; p.x = t.x; p.z = t.z - 1.2; p.facing = 0; p.aimSrc = 'keys'; g.input.aimSrc = 'keys'; g.snapCamera(); });
  for (let i = 0; i < 3; i++) { await sim(page, 4, ['KeyC']); await sim(page, 6); }
  await sim(page, 2); await shot(page, '05_gathering_wood');
  await page.evaluate(() => { const g = window.__game, p = g.player; const t = g.entities.filter(e => e.isNode && (e.type === 'rock' || e.type === 'ore')).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; p.x = t.x; p.z = t.z - 1.2; p.facing = 0; g.snapCamera(); });
  for (let i = 0; i < 12; i++) { await sim(page, 4, ['KeyC']); await sim(page, 6); }
  await sim(page, 30); await shot(page, '06_gathering_stone');
  // crafting panel, then a little camp
  await page.evaluate(() => { const g = window.__game, S = g.survival; Object.assign(S.record.resources, { wood: 60, stone: 30, fibre: 20, crystal: 2 }); S.ui.openCraft(); });
  await page.waitForTimeout(250); await shot(page, '07_crafting_panel');
  await page.evaluate(() => {
    const g = window.__game, S = g.survival, p = g.player; S.ui.closeAll();
    p.x = 242.5; p.z = 247.5; g.snapCamera();
    for (const id of ['campfire', 'workbench', 'chest', 'torch']) S.craft(id);
    const put = (type, x, z) => { S.record.kits[type] = (S.record.kits[type] || 0) + 1; S.startBuild(type); S.build.tx = x; S.build.tz = z; const why = S.placeCheck(type, x, z); if (!why) { S.build.ok = true; S.place(); } S.endBuild(); return why; };
    for (let i = 0; i < 20; i++) S.craft(i % 2 ? 'wall' : 'floor');
    const bx = 238, bz = 249;
    for (let x = bx; x <= bx + 4; x++) for (let z = bz; z <= bz + 3; z++) { const edge = x === bx || x === bx + 4 || z === bz; if (x === bx + 2 && z === bz + 3) { put('door', x, z); continue; } put(edge ? (x === bx + 4 && z === bz ? 'stonewall' : 'wall') : 'floor', x, z); }
    for (let x = bx; x <= bx + 4; x++) put('roof', x, bz);
    put('workbench', bx + 6, bz + 2); put('chest', bx + 6, bz + 4); put('campfire', bx + 2, bz + 6); put('torch', bx + 5, bz + 6);
    p.x = bx + 2.5; p.z = bz + 7.5; p.facing = Math.PI; g.snapCamera();
  });
  await sim(page, 20); await shot(page, '08_camp_building');
  await page.evaluate(() => { const S = window.__game.survival; S.record.kits.wall = 3; S.startBuild('wall'); window.__game.player.facing = Math.PI / 2; });
  await sim(page, 3); await shot(page, '09_build_preview'); await page.evaluate(() => window.__game.survival.endBuild());
  // the cave mouth and the cave
  await page.evaluate(() => { const g = window.__game, S = g.survival, c = S.firstCave(), p = g.player; p.x = c.x - 0.5; p.z = c.z + 2.6; p.facing = Math.PI; S.stream(); g.snapCamera(); });
  await sim(page, 30); await shot(page, '10_cave_entrance');
  await page.evaluate(() => { const g = window.__game, S = g.survival, c = S.firstCave(); g.entities.find(e => e.id === 'cave:' + c.rx + ',' + c.rz).interact(); });
  await page.waitForFunction(() => window.__game.area?.id === 'cave' && !window.__game.transitioning, null, { timeout: 15000 });
  await page.evaluate(() => { const g = window.__game, p = g.player; g.godMode = true; const e = g.entities.filter(e => e.isEnemy)[0]; if (e) { p.x = e.x; p.z = e.z + 3; g.snapCamera(); } });
  await sim(page, 20); await shot(page, '11_cave_interior');
  await page.evaluate(() => { const g = window.__game, p = g.player, a = g.area; p.x = a.reward.x; p.z = a.reward.z + 2; g.snapCamera(); });
  await sim(page, 10); await shot(page, '12_cave_reward');
  await page.evaluate(() => { window.__game.survival.leaveCave(); }); await page.waitForTimeout(1300); await sim(page, 10);
  await page.keyboard.press('KeyM'); await page.waitForTimeout(500); await shot(page, '13_map'); await page.keyboard.press('Escape');
  R.ok(true, 'captured');
}
