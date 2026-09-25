// Aiming: independent movement and aim, charged aim tracking, explicit seek, ground
// targeting (range, obstruction, preview, no cost on failure), swept hits and walls.
import { sim, fresh, mouseAt } from './lib.mjs';

// A training dummy: a normal enemy that never moves or attacks.
const DUMMY = `(x, z, kind = 'blot') => { const g = window.__game; const e = g.spawnEnemy(kind, x, z, { noRoom: true }); e.spawnT = 0; e.obj.scale.setScalar(1); e.think = () => [0, 0]; e.hp = e.maxHp = 1e6; e.elite = null; e.dmgTaken = 1; e.poise = true; e.kbMul = 0; (window.__d = window.__d || []).push(e); return window.__d.length - 1; }`;
const hpOf = (page, i) => page.evaluate(i => { const e = window.__d[i]; return e ? e.maxHp - e.hp : -1; }, i);

// find an open patch of ground near the village big enough for a shooting range
async function range(page) {
  return page.evaluate(() => {
    const g = window.__game, p = g.player;
    const open = (x, z) => { const t = g.tileAt(Math.floor(x), Math.floor(z)); return [0, 1, 2, 15, 16, 17, 18].includes(t) && !g.solidAt(x, z, 0.4); };
    for (let r = 0; r < 30; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.floor(p.x) + dx + 0.5, z = Math.floor(p.z) + dz + 0.5;
      let ok = true;
      for (let a = -6; a <= 6 && ok; a++) for (let b = -2; b <= 2 && ok; b++) if (!open(x + a, z + b)) ok = false;
      if (ok) { p.x = x; p.z = z; p.lastSafe = { x, z }; g.snapCamera(); return { x, z }; }
    }
    return null;
  });
}

export default async function (page, R) {
  // ---------------------------------------------------------------- Archer
  await fresh(page, 'archer');
  const c = await range(page);
  R.ok(!!c, 'found an open test range', JSON.stringify(c));
  const east = await page.evaluate(`(${DUMMY})(${c.x + 5}, ${c.z})`);
  await sim(page, 2);
  // aim right with the real mouse, walk left, tap-fire
  await mouseAt(page, c.x + 5, c.z);
  await sim(page, 1);
  const aim = await page.evaluate(() => { const p = window.__game.player; return { src: p.aimSrc, dir: p.aimDir, lock: !!p.aimLock }; });
  R.ok(aim.src === 'mouse', 'mouse movement switches to mouse aim', aim.src);
  R.ok(Math.abs(aim.dir - Math.PI / 2) < 0.05, 'aim direction points at the cursor target', aim.dir.toFixed(3));
  R.ok(aim.lock, 'cursor over an enemy locks the aim to it');
  await sim(page, 4, ['KeyA']);
  await page.mouse.down(); await page.mouse.up();
  await sim(page, 2, ['KeyA']);
  const st1 = await page.evaluate(() => { const p = window.__game.player; return { state: p.state, facing: p.facing, arrows: window.__game.entities.filter(e => e.kind === 'arrow').length }; });
  R.ok(st1.arrows === 1 && st1.state === 'cast', 'click fires on the first frame after release', JSON.stringify(st1));
  R.ok(Math.abs(st1.facing - Math.PI / 2) < 0.05, 'body faces the aim while moving the other way');
  // re-aim at the dummy as we drift left, fire a few more while still walking left
  let x0 = await page.evaluate(() => window.__game.player.x);
  for (let i = 0; i < 3; i++) { await mouseAt(page, c.x + 5, c.z); await page.mouse.down(); await page.mouse.up(); await sim(page, 9, ['KeyA']); }
  await sim(page, 12, ['KeyA']);
  const x1 = await page.evaluate(() => window.__game.player.x);
  const dmg = await hpOf(page, east);
  R.ok(x1 < x0 - 1, 'player kept moving left while shooting', `${x0.toFixed(2)} -> ${x1.toFixed(2)}`);
  R.ok(dmg > 0, 'arrows fired rightward hit the target on the right', 'damage ' + dmg);

  // charged shot: start aiming at one target, swing to another mid-charge, release
  await page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy) e.remove(); });
  const c2 = await range(page);
  const north = await page.evaluate(`(${DUMMY})(${c2.x}, ${c2.z - 5})`);
  const south = await page.evaluate(`(${DUMMY})(${c2.x + 5}, ${c2.z + 1.5})`);
  await sim(page, 2);
  await mouseAt(page, c2.x, c2.z - 5); await sim(page, 1);
  await page.mouse.down(); await sim(page, 10);
  await mouseAt(page, c2.x + 5, c2.z + 1.5); await sim(page, 14);
  const charging = await page.evaluate(() => { const p = window.__game.player; return { s: p.state, t: p.aimT, dir: p.aimDir, face: p.facing }; });
  R.ok(charging.s === 'aim' && charging.t >= 0.6, 'holding charges the power shot', JSON.stringify(charging));
  R.ok(Math.abs(charging.face - charging.dir) < 1e-6, 'aim keeps tracking the cursor while charging');
  await page.mouse.up(); await sim(page, 20);
  const hn = await hpOf(page, north), hs = await hpOf(page, south);
  R.ok(hs > 0 && hn === 0, 'charged shot went where the cursor was at release', `north ${hn} south ${hs}`);

  // keyboard fallback: J fires in the facing direction without touching the mouse
  await page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy) e.remove(); g.player.facing = Math.PI; });
  await page.keyboard.press('c'); await sim(page, 1); await sim(page, 1);
  const kb = await page.evaluate(() => { const g = window.__game, a = g.entities.find(e => e.kind === 'arrow'); return { src: g.player.aimSrc, dir: a && a.dir }; });
  R.ok(kb.src === 'keys' && kb.dir !== undefined && Math.abs(Math.abs(kb.dir) - Math.PI) < 0.05, 'C switches to keyboard aim and fires where you face', JSON.stringify(kb));

  // Rain of Arrows: cursor placement, range clamp, preview, obstruction, no cost on failure
  await page.evaluate(() => { const g = window.__game; g.inv.level = 6; g.inv.skills = [1, 1, 1]; g.recalc(); g.res = 100; for (const e of g.entities) if (e.isEnemy) e.remove(); });
  const c3 = await range(page);
  await mouseAt(page, c3.x + 10, c3.z, 0); await sim(page, 1);
  await sim(page, 3, ['Digit3']);
  const prev = await page.evaluate(() => { const g = window.__game, p = g.player, tg = p.targeting; const q = tg && p.groundTarget(tg); return { tg: !!tg, q, d: q && Math.hypot(q.x - p.x, q.z - p.z), vis: g.aimView.area.visible, res: g.res }; });
  R.ok(prev.tg && prev.vis, 'holding the ability key shows a ground preview');
  R.ok(prev.q && Math.abs(prev.d - 8.5) < 0.05, 'target is clamped to the ability range', prev.d && prev.d.toFixed(2));
  R.ok(prev.res === 100, 'no cost is paid while previewing');
  await sim(page, 1);
  const cast = await page.evaluate(() => { const g = window.__game, z = g.entities.find(e => e.constructor.name === 'RainZone'); return { res: g.res, z: z && [z.x, z.z], p: [g.player.x, g.player.z] }; });
  R.ok(cast.z && Math.abs(cast.z[0] - (cast.p[0] + 8.5)) < 0.3 && cast.res === 50, 'release places the rain at the clamped cursor spot and pays the cost', JSON.stringify(cast));

  // obstructed target: put a wall between us and the cursor
  const blocked = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    // find a blocking tile with open ground on both sides along x
    for (let z = Math.floor(p.z) - 25; z < p.z + 25; z++) for (let x = Math.floor(p.x) - 25; x < p.x + 25; x++) {
      const t = g.tileAt(x, z), T = (a, b) => g.tileAt(a, b);
      if (![8, 6, 21, 13].includes(t) && t !== 20 && t !== 22) continue;
      const free = a => [0, 1, 2, 15, 16, 17, 18].includes(T(a, z));
      if (free(x - 1) && free(x - 2) && free(x + 1) && free(x + 2) && !g.shotClear(x - 1.5, z + 0.5, x + 1.5, z + 0.5)) { p.x = x - 1.5; p.z = z + 0.5; g.snapCamera(); return { x, z, t }; }
    }
    return null;
  });
  if (blocked) {
    await page.evaluate(() => { const g = window.__game; g.res = 100; g.player.cds = [0, 0, 0]; });
    await sim(page, 1);
    await mouseAt(page, blocked.x + 1.5, blocked.z + 0.5, 0); await sim(page, 1);
    await sim(page, 2, ['Digit3']);
    const bad = await page.evaluate(() => { const p = window.__game.player; return p.groundTarget(p.targeting); });
    await sim(page, 2);
    const after = await page.evaluate(() => ({ res: window.__game.res, cd: window.__game.player.cds[2] }));
    R.ok(bad && !bad.ok, 'a spot behind a wall is shown as invalid', JSON.stringify(bad));
    R.ok(after.res === 100 && after.cd === 0, 'failed cast consumes no resource and no cooldown', JSON.stringify(after));
    // arrows stop at that wall
    const behind = await page.evaluate(`(${DUMMY})(${blocked.x + 1.5}, ${blocked.z + 0.5})`);
    await mouseAt(page, blocked.x + 1.5, blocked.z + 0.5); await sim(page, 1);
    await page.mouse.down(); await page.mouse.up(); await sim(page, 25);
    R.ok(await hpOf(page, behind) === 0, 'arrows do not pass through walls');
  } else R.note('no wall found for obstruction check');

  // fast, small target: a power shot must not skip a Sporeling between frames
  await page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy) e.remove(); });
  const c4 = await range(page);
  const tiny = await page.evaluate(`(${DUMMY})(${c4.x + 4.4}, ${c4.z}, 'sporeling')`);
  await page.evaluate(() => { const e = window.__game.entities.find(e => e.kind === 'sporeling'); e.r = 0.12; });
  await mouseAt(page, c4.x + 6, c4.z + 0.25); await sim(page, 1);
  await page.mouse.down(); await sim(page, 24); await page.mouse.up(); await sim(page, 12);
  R.ok(await hpOf(page, tiny) > 0, 'fast power shot hits a small target (swept test)');

  // ---------------------------------------------------------------- Witch
  await page.mouse.move(5, 5);
  await fresh(page, 'witch');
  // the seeking bolt is the arcane staff's Magic Missile (each staff now has its own primary spell)
  await page.evaluate(() => { const g = window.__game; g.inv.equip.weapon = window.__items.makeNamed('crookstaff', 3); g.recalc(); });
  const w = await range(page);
  // a foe 60 degrees off the aimed line must NOT pull the bolt off course
  const off = await page.evaluate(`(${DUMMY})(${w.x + 2}, ${w.z + 3.4})`);
  await mouseAt(page, w.x + 6, w.z); await sim(page, 1);
  await page.mouse.down(); await page.mouse.up(); await sim(page, 2);
  const b0 = await page.evaluate(() => { const b = window.__game.entities.find(e => e.kind === 'bolt'); return b && { seek: !!b.seek, homing: b.homing }; });
  await sim(page, 25);
  R.ok(b0 && b0.seek && !b0.homing, 'witch bolt seeks as an explicit bounded property, not free homing', JSON.stringify(b0));
  R.ok(await hpOf(page, off) === 0, 'bolt ignores a foe far off the aimed line');
  // a foe slightly off the line is still reached
  await page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy) e.remove(); g.res = 100; });
  const near = await page.evaluate(`(${DUMMY})(${w.x + 5}, ${w.z + 1})`);
  await mouseAt(page, w.x + 6, w.z - 0.3); await sim(page, 1);
  await page.mouse.down(); await page.mouse.up(); await sim(page, 2);
  await sim(page, 30);
  R.ok(await hpOf(page, near) > 0, 'bolt bends gently onto a foe near the aimed line');
  // guard then attack uses the witch's own attack, not a sword swing
  await sim(page, 10);
  await sim(page, 3, ['KeyQ']); // guard is Q (right click is the weapon secondary)
  await page.keyboard.down('q'); await sim(page, 2);
  await page.mouse.down(); await page.mouse.up(); await sim(page, 1);
  const g1 = await page.evaluate(() => window.__game.player.state);
  await page.keyboard.up('q'); await sim(page, 10);
  R.ok(g1 === 'shoot' || g1 === 'cast', 'attacking out of a guard uses the ranged attack', g1);
  // chain lightning picks the enemy under the cursor, not the closest one
  await page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy) e.remove(); g.inv.level = 3; g.inv.skills = [1, 1, 0]; g.recalc(); g.res = 100; });
  const close = await page.evaluate(`(${DUMMY})(${w.x - 1.8}, ${w.z})`);
  const far = await page.evaluate(`(${DUMMY})(${w.x + 5.5}, ${w.z})`);
  await mouseAt(page, w.x + 5.5, w.z); await sim(page, 1);
  await sim(page, 1, ['Digit2']); await sim(page, 4);
  const hc = await hpOf(page, close), hf = await hpOf(page, far);
  R.ok(hf > 0, 'chain lightning starts at the enemy under the cursor', `far ${hf} close ${hc}`);

  // ---------------------------------------------------------------- Samurai
  await page.mouse.move(5, 5);
  await fresh(page, 'samurai');
  const s = await range(page);
  const sw = await page.evaluate(`(${DUMMY})(${s.x - 1}, ${s.z})`);
  await mouseAt(page, s.x - 1, s.z); await sim(page, 1);
  await page.mouse.down(); await page.mouse.up(); await sim(page, 1, ['KeyD']); await sim(page, 8, ['KeyD']);
  R.ok(await hpOf(page, sw) > 0, 'samurai swings toward the cursor even while holding the opposite direction');
  // dodge: moving -> along movement; standing still with mouse -> backstep away from aim
  await sim(page, 20);
  await sim(page, 1, ['Space']);
  const bs = await page.evaluate(() => { const p = window.__game.player; return { s: p.state, d: p.dodgeDir, a: p.aimDir }; });
  R.ok(bs.s === 'roll' && Math.abs(Math.cos(bs.d - bs.a) + 1) < 0.01, 'standing dodge backsteps away from the aim', JSON.stringify(bs));
  await sim(page, 20);
  await sim(page, 1, ['KeyS', 'Space']);
  const mv = await page.evaluate(() => window.__game.player.dodgeDir);
  R.ok(Math.abs(mv) < 0.01, 'moving dodge follows the movement keys, not the aim', mv.toFixed(3));
  await page.mouse.move(5, 5);
}
