// Modular houses captures (not a regression check).   OUT=docs/screens/houses node tests/run.mjs zshots_houses
const OUT = process.env.OUT || '/tmp';
const snap = async (page, n) => { for (const [w, h] of [[1280, 720], [1920, 1080]]) { await page.setViewportSize({ width: w, height: h }); await page.evaluate(() => { const g = window.__game; g.noRender = false; window.__sim(4); }); await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${n}_${w}.jpg`, type: 'jpeg', quality: 84 }); } await page.setViewportSize({ width: 1280, height: 720 }); };
export default async function (page, R) {
  await page.evaluate(() => localStorage.removeItem('mossling-survival-v1'));
  const id = await page.evaluate(() => window.__game.survivalMode.store.create({ name: 'Hearthwood', cls: 'witch', seed: 4242 }).id);
  await page.evaluate(id => window.__startSurvival(id), id); await page.waitForFunction(() => window.__game.area?.id === 'wilds');
  const H = await page.evaluate(async () => {
    const G = await import('/src/survival/gen.js'), S = window.__game.survival, out = {};
    for (let rz = 2; rz <= 8; rz++) for (let rx = 2; rx <= 8; rx++) { const h = G.regionHouse(S.record.seed, rx, rz); if (h && !out[h.t]) out[h.t] = { id: h.id, x0: h.x0, z0: h.z0, k: h.k }; }
    window.__tp = (x, z, fy = 0, facing = Math.PI) => { const g = window.__game, p = g.player; p.x = x; p.z = z; p.fy = fy; p.fvy = 0; p.facing = facing; g.godMode = true; S.stream(true); p.sync(); g.snapCamera(); window.__sim(20); };
    return out;
  });
  const c = H.cabin, t = H.cottage;
  // 1. generated cabin exterior, from the door side
  await page.evaluate(c => window.__tp(c.x0 + 5.2, c.k ? c.z0 - 1.6 : c.z0 + 5.6, 0, c.k ? 0 : Math.PI), c); await snap(page, '01_cabin_exterior');
  // 2. its interior, visible from inside (roof cut away)
  await page.evaluate(c => { window.__tp(c.x0 + 2.2, c.z0 + 2, 0.1); const S = window.__game.survival; const d = [...S.grid.ents.values()].find(e => e.gen === c.id && e.type === 'timber_door'); if (d && !d.s.open) S.toggleDoor(d); window.__sim(20); }, c); await snap(page, '02_cabin_interior');
  // 3. the two-storey cottage exterior (gable front)
  await page.evaluate(t => window.__tp(t.x0 + 7.4, t.k ? t.z0 - 1.6 : t.z0 + 5.4, 0, t.k ? 0 : Math.PI), t); await snap(page, '03_cottage_exterior');
  // 4. the character upstairs in the cottage
  await page.evaluate(t => window.__tp(t.x0 + 1.4, t.z0 + (t.k ? 2.8 : 1.2), 2.1, Math.PI / 2), t); await snap(page, '04_character_upstairs');
  // 5. a player-built house: placement preview with rotation and elevation, then the finished house
  const P = await page.evaluate(() => {
    window.__tp(244, 250); // the open ground by camp
    const S = window.__game.survival, R = S.record; R.kits = {}; const give = (k, n) => R.kits[k] = (R.kits[k] || 0) + n;
    for (const [k, n] of Object.entries({ stone_foundation: 6, timber_floor: 8, timber_wall: 12, timber_window: 12, timber_door: 2, timber_stairs: 2, thatch_roof: 6, thatch_ridge: 2, timber_gable: 8, chest: 2, workbench: 1, torch: 2, timber_post: 2 })) give(k, n);
    const p = window.__game.player, c0 = Math.floor(p.x / 2), r0 = Math.floor(p.z / 2); let cx, cz;
    outer: for (let rad = 2; rad < 16; rad++) for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { let ok = true; for (let j = -1; j <= 3 && ok; j++) for (let i = -1; i <= 3 && ok; i++) if (S.checkPiece({ type: 'stone_foundation', x: (c0 + dx + i) * 2 + 1, z: (r0 + dz + j) * 2 + 1, lv: 0 })) ok = false; if (ok) { cx = c0 + dx; cz = r0 + dz; break outer; } }
    const put = (t, x, z, lv = 0, r = 0) => S.placePiece({ type: t, x, z, lv, r }), C = (i, j) => [(cx + i) * 2 + 1, (cz + j) * 2 + 1];
    const E = (i, j, s, t, lv) => { const x0 = (cx + i) * 2, z0 = (cz + j) * 2, q = { n: [x0 + 1, z0], s: [x0 + 1, z0 + 2], w: [x0, z0 + 1], e: [x0 + 2, z0 + 1] }[s]; return put(t, q[0], q[1], lv, s === 'w' || s === 'e' ? 1 : 0); };
    for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) put('stone_foundation', ...C(i, j));
    E(0, 0, 'n', 'timber_wall', 0); E(1, 0, 'n', 'timber_window', 0); E(2, 0, 'n', 'timber_wall', 0); E(0, 1, 's', 'timber_door', 0); E(1, 1, 's', 'timber_window', 0); E(2, 1, 's', 'timber_window', 0);
    E(0, 0, 'w', 'timber_wall', 0); E(0, 1, 'w', 'timber_window', 0); E(2, 0, 'e', 'timber_window', 0); E(2, 1, 'e', 'timber_wall', 0);
    put('timber_stairs', ...C(1, 1), 0, 1);
    for (const [i, j] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]) put('timber_floor', ...C(i, j), 1);
    return { cx, cz };
  });
  await page.evaluate(P => { const S = window.__game.survival, p = window.__game.player; window.__tp(P.cx * 2 + 3, P.cz * 2 + 6.5, 0, Math.PI); p.aimSrc = 'keys'; window.__game.input.aimSrc = 'keys'; S.startBuild('timber_window'); S.build.lv = 1; S.build.r = 0; window.__sim(1); p.facing = Math.PI; p.x = P.cx * 2 + 3; p.z = P.cz * 2 + 5.4; window.__sim(3); }, P);
  await snap(page, '05_placement_preview_level1');
  await page.evaluate(P => {
    const S = window.__game.survival, put = (t, x, z, lv = 0, r = 0) => S.placePiece({ type: t, x, z, lv, r }); S.endBuild(); const cx = P.cx, cz = P.cz, C = (i, j) => [(cx + i) * 2 + 1, (cz + j) * 2 + 1];
    const E = (i, j, s, t, lv) => { const x0 = (cx + i) * 2, z0 = (cz + j) * 2, q = { n: [x0 + 1, z0], s: [x0 + 1, z0 + 2], w: [x0, z0 + 1], e: [x0 + 2, z0 + 1] }[s]; return put(t, q[0], q[1], lv, s === 'w' || s === 'e' ? 1 : 0); };
    E(0, 0, 'n', 'timber_window', 1); E(1, 0, 'n', 'timber_wall', 1); E(2, 0, 'n', 'timber_window', 1); E(0, 1, 's', 'timber_window', 1); E(1, 1, 's', 'timber_wall', 1); E(2, 1, 's', 'timber_window', 1);
    E(0, 0, 'w', 'timber_wall', 1); E(0, 1, 'w', 'timber_window', 1); E(2, 0, 'e', 'timber_wall', 1); E(2, 1, 'e', 'timber_window', 1);
    for (const j of [0, 1]) { put('thatch_roof', ...C(0, j), 1, 1); put('thatch_ridge', ...C(1, j), 1, 1); put('thatch_roof', ...C(2, j), 1, 3); }
    for (const i of [0, 1, 2]) { E(i, 0, 'n', 'timber_gable', 1); E(i, 1, 's', 'timber_gable', 1); }
    const x0 = cx * 2, z0 = cz * 2; put('chest', x0 + 4.5, z0 + 0.5, 0, 2); put('workbench', x0 + 0.5, z0 + 0.5, 0, 0); put('chest', x0 + 4.5, z0 + 0.5, 1, 2); put('torch', x0 + 0.5, z0 + 0.5, 1, 0);
    window.__tp(x0 + 8, z0 + 6.2, 0, Math.PI);
  }, P);
  await snap(page, '06_player_built_house');
  await page.evaluate(P => window.__tp(P.cx * 2 + 1.3, P.cz * 2 + 1.2, 2.1, Math.PI / 2), P); await snap(page, '07_player_house_upstairs');
  await page.evaluate(async () => window.__game.save());
  await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading') && document.querySelector('#title-menu div'));
  await page.evaluate(id => window.__startSurvival(id), id); await page.waitForFunction(() => window.__game.area?.id === 'wilds');
  await page.evaluate(P => { const S = window.__game.survival; window.__tp = (x, z, fy = 0, f = Math.PI) => { const g = window.__game, p = g.player; p.x = x; p.z = z; p.fy = fy; p.facing = f; g.godMode = true; S.stream(true); p.sync(); g.snapCamera(); window.__sim(20); }; window.__tp(P.cx * 2 + 8, P.cz * 2 + 6.2, 0, Math.PI); }, P);
  await snap(page, '08_house_restored_after_reload');
  // the ruin
  await page.evaluate(t => window.__tp(t.x0 + 7.4, t.k ? t.z0 - 1.6 : t.z0 + 5.4, 0, t.k ? 0 : Math.PI), H.ruin); await snap(page, '09_ruined_house');
  R.ok(true, 'captured');
}
