// Every class in and around a generated two-storey cottage: through the door, up and down the
// stairs, dodge rolls and the first ability against walls and on the stairs, and attacks that
// must not cross a floor (with a same-floor control so the attack is known to work).
export default async function (page, R) {
  await page.evaluate(() => localStorage.removeItem('mossling-survival-v1'));
  for (const cls of ['samurai', 'archer', 'witch', 'soulbound', 'gunslinger']) {
    const id = await page.evaluate(c => window.__game.survivalMode.store.create({ name: 'Classes ' + c, cls: c, seed: 4242 }).id, cls);
    if (cls !== 'samurai') { await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('loading') && document.querySelector('#title-menu div'), null, { timeout: 30000 }); }
    await page.evaluate(id => window.__startSurvival(id), id);
    await page.waitForFunction(() => window.__game.area?.id === 'wilds');
    const r = await page.evaluate(async () => {
      const g = window.__game, S = g.survival, p = g.player, G = await import('/src/survival/gen.js'), { makeEnemy } = await import('/src/entities/enemies.js');
      g.godMode = true; g.noRender = true; p.aimSrc = 'keys'; g.input.aimSrc = 'keys';
      const st = () => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), fy: +(p.fy || 0).toFixed(2) });
      const tp = (x, z, fy = 0) => { p.x = x; p.z = z; p.fy = fy; p.fvy = 0; p.state = 'move'; S.stream(true); p.sync(); };
      let h = null; for (let rz = 3; rz <= 7 && !h; rz++) for (let rx = 3; rx <= 7 && !h; rx++) { const c = G.regionHouse(S.record.seed, rx, rz); if (c && c.t === 'cottage') h = c; }
      tp(h.x0 + 3, h.z0 + (h.k ? -2 : 6)); window.__sim(3);
      const pcs = [...S.grid.ents.values()].filter(e => e.gen === h.id), door = pcs.find(e => e.type === 'timber_door'), sp = pcs.find(e => e.type === 'timber_stairs');
      const x0 = h.x0, x1 = h.x0 + 6, z0 = h.z0, z1 = h.z0 + 4, inside = s => s.x > x0 + 0.2 && s.x < x1 - 0.2 && s.z > z0 + 0.2 && s.z < z1 - 0.2;
      // the door: open it from outside and walk in
      const out = h.k ? -1 : 1; tp(door.x, door.z + out * 0.9); p.facing = out > 0 ? Math.PI : 0; window.__sim(2);
      const it = g.interactTarget(); if (it && it.prompt && /open/i.test(it.prompt)) it.interact(); window.__sim(15);
      window.__sim(25, [out > 0 ? 'KeyW' : 'KeyS']); const inDoor = inside(st());
      // up the stairs with the movement keys
      const D = [[0, 1], [1, 0], [0, -1], [-1, 0]][sp.s.r], up = D[0] === 1 ? 'KeyD' : D[0] === -1 ? 'KeyA' : D[1] === 1 ? 'KeyS' : 'KeyW', down = { KeyD: 'KeyA', KeyA: 'KeyD', KeyW: 'KeyS', KeyS: 'KeyW' }[up];
      tp(sp.x - D[0] * 1.7, sp.z - D[1] * 1.7, 0.3); window.__sim(45, [up]); const top = st();
      // dodge rolls into every upstairs wall: never through one, always still upstairs
      let rollsOk = true; for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { for (let i = 0; i < 4; i++) { window.__sim(2, [k, 'Space']); window.__sim(12, [k]); } const s = st(); if (!inside(s) || s.fy < 2) rollsOk = false; }
      // the class's first ability (a dash for the samurai) toward the outer wall
      g.res = 100; for (const k of Object.keys(p.cdMap || {})) p.cdMap[k] = 0; p.facing = Math.atan2(-D[0], -D[1]);
      window.__sim(2, ['Digit1']); window.__sim(40); const afterAb = st(); const abOk = inside(afterAb) && afterAb.fy > 2 || afterAb.fy < 0.4 && inside(afterAb);
      // down the stairs again (roll down them too)
      tp(sp.x + D[0] * 1.2, sp.z + D[1] * 1.2, 2.1); window.__sim(4); window.__sim(2, [down, 'Space']); window.__sim(60, [down]); const bottom = st();
      // attacks never cross a floor: a foe upstairs right above you
      // a live foe (its own update runs: some weapons resolve hits there) pinned to its spot
      const foe = (x, z, fy) => { const e = makeEnemy(g, 'blot', x, z); e.fy = fy; e.spawnT = 0; const u = e.update.bind(e); e.update = dt => { u(dt); e.x = x; e.z = z; e.fy = fy; e.sync(); }; g.spawn(e); e.sync(); return e; };
      const bx = sp.x - D[0] * 1.6 + D[1] * 1.0, bz = sp.z - D[1] * 1.6 + D[0] * 1.0; // beside the foot of the stairs, under the upper floor
      tp(bx, bz, 0.3); window.__sim(3); const hereY = p.fy; p.facing = Math.atan2((x0 + x1) / 2 - p.x, (z0 + z1) / 2 - p.z); // toward the open middle of the room
      const above = foe(p.x + Math.sin(p.facing) * 0.9, p.z + Math.cos(p.facing) * 0.9, 2.1), hp0 = above.hp;
      for (let i = 0; i < 6; i++) { window.__sim(6, ['KeyC'], 1 / 60); window.__sim(16, [], 1 / 60); } // 60 fps: sweeping lashes are sampled finely enough
      const noThrough = above.hp === hp0; above.remove();
      const level = foe(p.x + Math.sin(p.facing) * 0.9, p.z + Math.cos(p.facing) * 0.9, hereY), lp = level.hp;
      for (let i = 0; i < 6; i++) { window.__sim(6, ['KeyC'], 1 / 60); window.__sim(16, [], 1 / 60); } // 60 fps: sweeping lashes are sampled finely enough
      const sameFloor = level.hp < lp || level.dead; level.remove();
      return { inDoor, top, rollsOk, afterAb, abOk, bottom, noThrough, sameFloor, cls: g.inv.cls };
    });
    R.ok(r.cls === cls && r.inDoor, `${cls}: opens the cottage door and walks in`, JSON.stringify(r));
    R.ok(r.top.fy > 2, `${cls}: climbs the stairs with the movement keys`, JSON.stringify(r.top));
    R.ok(r.rollsOk && r.abOk, `${cls}: dodge rolls and the first ability never pass through walls or floors`, JSON.stringify([r.rollsOk, r.afterAb]));
    R.ok(r.bottom.fy < 0.4, `${cls}: rolls and walks back down the stairs`, JSON.stringify(r.bottom));
    R.ok(r.noThrough && r.sameFloor, `${cls}: attacks do not reach a foe upstairs, but hit one on the same floor`, JSON.stringify([r.noThrough, r.sameFloor]));
  }
}
