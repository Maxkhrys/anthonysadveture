// Chapter I end to end, once per class, at normal health with level-4 Magic gear (what the
// intro, the forest and a chest or two give a real player). The bot aims with the real mouse,
// drinks tonics when low and rolls away from wind-ups. Deaths are NOT hidden: they are counted
// and the bot is put back where it fell (reported as "assisted"), so the log is an honest
// measure of how hard each fight was for a simple bot. Set CLASSES=archer to run one.
import { sim, walkTo, pressE, talkThrough, mouseAt } from './lib.mjs';

const face = (page, dir) => page.evaluate(a => { window.__game.player.facing = a; }, { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[dir]);
const puff = async (page, dir) => { await face(page, dir); await sim(page, 1, ['KeyL']); await sim(page, 12); };
const restAt = async page => {
  const b = await page.evaluate(() => { const g = window.__game, p = g.player; const bs = g.entities.filter(e => e.constructor.name === 'Bellstone').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; return bs && [bs.x, bs.z]; });
  await walkTo(page, b[0], b[1] + 0.8); await face(page, 'n'); await pressE(page, 1); await sim(page, 5);
};
const flag = (page, f) => page.evaluate(f => window.__game.signal(f), f);

function bot(page, log) {
  const B = { deaths: 0, tonics: 0, hits: 0, dmg: 0, where: [], rollT: 0 };
  let lastPos = null;
  B.watch = async () => {
    const s = await page.evaluate(() => { const g = window.__game, p = g.player; return { dead: g.dead || p.state === 'dead', hp: g.inv.hp, max: g.inv.maxHp, pots: g.inv.potions, x: p.x, z: p.z, room: g.room && g.room.id, area: g.area.id }; });
    if (s.dead) {
      B.deaths++; B.where.push(s.room || s.area);
      const why = await page.evaluate(() => { const h = window.__game.player.lastHit; return h ? `${h.by} (Lv ${h.lvl || '?'}) for ${h.n}` : '?'; });
      log(`   ✖ death #${B.deaths} in ${s.room || s.area} — felled by ${why}`);
      // wait for the death screen, press E, and make sure we are really back on our feet
      for (let k = 0; k < 20 && !(await page.evaluate(() => window.__game.dead)); k++) await page.waitForTimeout(200);
      await sim(page, 1); await sim(page, 1, ['KeyE']); await sim(page, 1);
      for (let k = 0; k < 30; k++) {
        const ok = await page.evaluate(() => { const g = window.__game; return !g.dead && !g.transitioning && g.player.state !== 'dead'; });
        if (ok) break;
        await page.waitForTimeout(200);
        if (k === 15) await page.evaluate(() => { const g = window.__game; g.transitioning = false; if (g.dead || g.player.state === 'dead') g.revive(); });
      }
      await sim(page, 3);
      // assisted: put the bot back where it fell (a player would walk back from the Bellstone)
      if (lastPos) await page.evaluate(p => { const g = window.__game; if (g.area.id === p.area) { g.player.x = p.x; g.player.z = p.z; g.snapCamera(); g.updateRoom(true); } }, lastPos);
      return true;
    }
    lastPos = s;
    if (s.hp < s.max * 0.35 && s.pots > 0) { B.tonics++; await sim(page, 1, ['KeyQ']); await sim(page, 20); }
    return false;
  };
  // fight everything in the current room (or nearby, outdoors) the way a player would
  B.fight = async (label, max = 500, arenaOnly = false) => {
    const cls = await page.evaluate(a => { window.__arenaOnly = a; return window.__game.inv.cls; }, arenaOnly);
    for (let i = 0; i < max; i++) {
      if (await B.watch()) continue;
      const t = await page.evaluate(() => {
        const g = window.__game, p = g.player; let best = null, bd = 99, threat = null;
        for (const e of g.entities) {
          if (!e.isEnemy || e.dead || e.isBoss || (g.room && g.roomAt(e.x, e.z) !== g.room)) continue;
          if (window.__arenaOnly && !e.arena) continue;
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d < bd) { bd = d; best = e; }
          // fodder can be hit out of its wind-up; poised/elite blows must be avoided
          if (d < 2.6 && e.state === 'windup' && (e.poise || e.elite) && e.st > 0.35) threat = e;
        }
        if (!best || bd > 15) return null;
        return { x: best.x, z: best.z, d: bd, alt: best.alt || 0, threat: threat && { x: threat.x, z: threat.z }, px: p.x, pz: p.z, state: p.state };
      });
      if (!t) return i;
      if (process.env.TRACE && i % 5 === 0) log('    · ' + label + ' ' + JSON.stringify(await page.evaluate(() => { const g = window.__game, p = g.player; return { p: [+p.x.toFixed(1), +p.z.toFixed(1), p.state, p.aimSrc, +p.aimDir.toFixed(2)], hp: Math.round(g.inv.hp), lock: g.locked(), en: g.entities.filter(e => e.isEnemy && !e.dead && g.roomAt(e.x, e.z) === g.room).map(e => `${e.kind}@${e.x.toFixed(1)},${e.z.toFixed(1)}:${e.state}:${Math.round(e.hp)}`) }; })) + ' d=' + t.d.toFixed(2));
      const toward = [Math.abs(t.x - t.px) > 0.3 ? (t.x > t.px ? 'KeyD' : 'KeyA') : null, Math.abs(t.z - t.pz) > 0.3 ? (t.z > t.pz ? 'KeyS' : 'KeyW') : null].filter(Boolean);
      const away = toward.map(k => ({ KeyD: 'KeyA', KeyA: 'KeyD', KeyS: 'KeyW', KeyW: 'KeyS' }[k]));
      if (t.threat && B.rollT < Date.now()) { B.rollT = Date.now() + 600; await sim(page, 1, [...away, 'Space']); await sim(page, 8); continue; }
      const melee = cls === 'samurai';
      if (melee ? t.d > 1.2 : t.d > 6) { await sim(page, 3, toward); continue; }
      if (!melee && t.d < 2.2) { await sim(page, 3, away); }
      await mouseAt(page, t.x, t.z, 0.45 + t.alt);
      await page.mouse.down(); await page.mouse.up();
      await sim(page, 2, melee ? [] : away.slice(0, 1)); await sim(page, melee ? 6 : 5);
    }
    log(`   (fight ${label} hit the iteration cap)`);
    return -1;
  };
  B.clear = async label => {
    await B.fight(label);
    const left = await page.evaluate(() => { const g = window.__game; return g.entities.filter(e => e.isEnemy && !e.dead && !e.isBoss && (!g.room || g.roomAt(e.x, e.z) === g.room)).length; });
    if (left) log(`   ${label}: ${left} enemies left after the bot gave up`);
  };
  return B;
}

async function run(page, R, cls) {
  const lines = [];
  const log = s => { lines.push(s); console.log(s); };
  const t0 = Date.now();
  const B = bot(page, log);
  // ---- opening, intro fight, Tamsin
  await page.evaluate(() => { try { localStorage.removeItem('mossling-save-v2'); } catch (e) {} });
  await page.evaluate(cls => window.__start(true, cls), cls);
  // the opening is dialogue with timed pauses: keep reading until control returns
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    const busy = await page.evaluate(() => window.__game.cutscene || window.__game.ui.talking);
    if (!busy) break;
    await talkThrough(page, 10);
  }
  await sim(page, 20);
  // only the Hushlings of the intro ambush: a player wouldn't wander off mid-fight
  for (let w = 0; w < 3; w++) { await B.fight('intro', 400, true); await sim(page, 45); }
  await page.evaluate(() => { window.__arenaOnly = false; });
  R.ok(await page.evaluate(() => !!window.__game.flags.introFought), `${cls}: intro fight won`);
  await page.evaluate(() => { const g = window.__game, n = g.entities.find(e => e.id === 'tamsin'), p = g.player; n.wanderR = 0; p.x = n.x; p.z = n.z + 0.8; p.facing = Math.PI; g.snapCamera(); });
  await sim(page, 2); await pressE(page, 1); await talkThrough(page, 30); await sim(page, 10);
  R.ok(await page.evaluate(() => window.__game.flags.stage === 1), `${cls}: Tamsin sends Moss west`);
  // ---- equal footing for the dungeon: level 4, Magic gear, normal health (no bonus hearts)
  await page.evaluate(() => {
    const g = window.__game, inv = g.inv;
    inv.level = Math.max(inv.level, 4); inv.skills = [1, 1, 0]; inv.sp = 0;
    for (const slot of ['weapon', 'helm', 'armor']) inv.equip[slot] = window.__items.genItem({ level: 4, cls: inv.cls, slot, rarity: 1 });
    g.recalc(); inv.hp = inv.maxHp; inv.potions = inv.maxPotions;
    g.warpTo('dungeon', 'entrance');
  });
  await page.waitForTimeout(1500); await sim(page, 5);
  const hp = await page.evaluate(() => window.__game.inv.maxHp);
  log(`   ${cls}: entering Rootwell Hollow at level 4, ${hp} max health, 3 tonics`);
  // rest at the entrance Bellstone like a player would
  await B.clear('entrance');
  await restAt(page);
  R.ok(await page.evaluate(() => window.__game.checkpoint.spawn === 'entrance'), `${cls}: rested at the Hollow Bellstone`);
  await walkTo(page, 25.5, 45); await walkTo(page, 25.5, 36); await walkTo(page, 22, 36);
  // WEST block puzzle
  await walkTo(page, 22, 32.5); await walkTo(page, 14, 32.5);
  await B.clear('west');
  const blockPos = () => page.evaluate(() => window.__game.entities.filter(e => e.constructor.name === 'Block').map(b => [b.x, b.z]));
  const pushUntil = async (i, key, cond) => { for (let k = 0; k < 60; k++) { const b = (await blockPos())[i]; if (cond(b)) return true; await sim(page, 4, [key]); } return false; };
  await walkTo(page, 14, 29.5); await walkTo(page, 3.5, 29.5); await walkTo(page, 3.5, 30.5);
  await pushUntil(0, 'KeyD', b => b[0] >= 11.5);
  await walkTo(page, 10.5, 29.5); await walkTo(page, 11.5, 29.5); await walkTo(page, 11.5, 29.6);
  await pushUntil(0, 'KeyS', b => b[1] >= 31.5);
  await walkTo(page, 13.5, 29.5); await walkTo(page, 13.5, 35.5); await walkTo(page, 3.5, 35.5); await walkTo(page, 3.5, 34.5);
  await pushUntil(1, 'KeyD', b => b[0] >= 11.5);
  R.ok(await flag(page, 'west.solved'), `${cls}: block garden solved`);
  await walkTo(page, 13.5, 35.5); await walkTo(page, 13.5, 29.4); await walkTo(page, 7.5, 29.4); await face(page, 'n'); await pressE(page, 1); await page.waitForTimeout(900); await pressE(page, 3);
  // EAST arena -> Gustbellows
  await walkTo(page, 14, 29.4); await walkTo(page, 14, 32.5); await walkTo(page, 22, 32.5); await walkTo(page, 22, 29.5); await walkTo(page, 29, 29.5); await walkTo(page, 29, 32.5); await walkTo(page, 32.2, 32.5); await face(page, 'e'); await pressE(page, 1);
  await sim(page, 10); await walkTo(page, 37, 32.5); await sim(page, 30);
  for (let w = 0; w < 5; w++) { await B.fight('arena wave ' + (w + 1), 500, true); await sim(page, 40); }
  await page.evaluate(() => { window.__arenaOnly = false; });
  R.ok(await flag(page, 'east.clear'), `${cls}: Thornhall arena cleared`);
  await walkTo(page, 42.5, 34.5); await walkTo(page, 42.5, 33.4); await face(page, 'n'); await pressE(page, 1); await page.waitForTimeout(1200); await pressE(page, 3);
  R.ok(await page.evaluate(() => window.__game.inv.bellows), `${cls}: got the Gustbellows`);
  await walkTo(page, 45.5, 31); await puff(page, 'n');
  await walkTo(page, 42.5, 28); await walkTo(page, 42.5, 24.5);
  await walkTo(page, 39.5, 24.5); await puff(page, 'n'); await sim(page, 30);
  await walkTo(page, 44, 23.8); await walkTo(page, 46.6, 23.8); await walkTo(page, 46.6, 22.5); await puff(page, 'w'); await sim(page, 30);
  await walkTo(page, 46.6, 23.8); await walkTo(page, 39.5, 23.8); await walkTo(page, 39.5, 23.6); await puff(page, 'n'); await sim(page, 30);
  await walkTo(page, 39.5, 16.5);
  await walkTo(page, 45.5, 17); await puff(page, 'n'); await walkTo(page, 45.5, 15.5); await sim(page, 5);
  R.ok(await flag(page, 'crate.solved'), `${cls}: crate bridge + dust switch solved`);
  await walkTo(page, 39.5, 16.3); await face(page, 'n'); await pressE(page, 1); await page.waitForTimeout(500); await pressE(page, 3);
  // TORCH room
  await walkTo(page, 42.5, 15.5); await walkTo(page, 42.5, 11);
  await B.clear('torch room');
  await walkTo(page, 37.5, 5.5); await puff(page, 'n'); await puff(page, 's');
  await walkTo(page, 47.5, 5.5); await puff(page, 'n'); await puff(page, 's');
  R.ok(await flag(page, 'torch.solved'), `${cls}: torch room solved`);
  await walkTo(page, 42.5, 7.4); await face(page, 'n'); await pressE(page, 1); await page.waitForTimeout(900); await pressE(page, 3);
  R.ok(await page.evaluate(() => window.__game.inv.bigkey), `${cls}: Thornwood Key`);
  await walkTo(page, 42.5, 11); await walkTo(page, 42.5, 16.5); await walkTo(page, 39.5, 16.5); await walkTo(page, 39.5, 23.5); await walkTo(page, 42.5, 23.5);
  await walkTo(page, 42.5, 28); await walkTo(page, 42.5, 32.5); await walkTo(page, 29, 32.5); await walkTo(page, 29, 29.5);
  await walkTo(page, 25.5, 28.2); await puff(page, 'n'); await sim(page, 10);
  await walkTo(page, 25.5, 24);
  await B.clear('Root Gate hall');
  // rest before the boss
  await restAt(page);
  R.ok(await page.evaluate(() => window.__game.checkpoint.spawn === 'pre' && window.__game.inv.potions === window.__game.inv.maxPotions), `${cls}: rested at the Root Gate Bellstone`);
  await walkTo(page, 25.5, 21.5); await walkTo(page, 25.5, 14.4); await face(page, 'n'); await pressE(page, 1); await sim(page, 15);
  await walkTo(page, 25.5, 9.5);
  await sim(page, 5); await page.waitForTimeout(3000); await sim(page, 10);
  // ---- Bramblemaw: gust into its mouth while it inhales, then hit the exposed core
  const bossStart = await page.evaluate(() => ({ hp: window.__game.inv.hp, deaths: 0 }));
  const deaths0 = B.deaths;
  let t = 0;
  for (let i = 0; i < 700; i++) {
    if (await B.watch()) { await page.waitForTimeout(3000); await sim(page, 10); continue; }
    const s = await page.evaluate(() => { const g = window.__game, b = g.bossActive; if (!b) return g.flags.bossKilled ? null : { st: 'gone' }; return { st: b.state, hp: b.hp, x: b.x, z: b.z }; });
    if (!s) break;
    if (s.st === 'gone') {
      // after a death the boss room reset: walk back in
      await walkTo(page, 25.5, 14.4); await face(page, 'n'); await pressE(page, 1); await sim(page, 15); await walkTo(page, 25.5, 9.5); await page.waitForTimeout(3000); await sim(page, 10);
      continue;
    }
    if (s.st === 'inhale') { await walkTo(page, 25.5, 8.2, 20, 0.4); await puff(page, 'n'); }
    else if (s.st === 'stunned') {
      if (cls === 'samurai') { await walkTo(page, 25.5, 6.3, 20, 0.3); await mouseAt(page, s.x, s.z + 0.9); await page.mouse.down(); await page.mouse.up(); await sim(page, 8); }
      else { await walkTo(page, 25.5, 8.6, 20, 0.4); await mouseAt(page, s.x, s.z + 0.9); await page.mouse.down(); await page.mouse.up(); await sim(page, 7); }
    }
    else { await walkTo(page, 25.5 + Math.sin(t++ * 0.7) * 2.5, 10, 10, 0.5); await sim(page, 4); }
  }
  await sim(page, 120);
  const bossKilled = await page.evaluate(() => !!window.__game.flags.bossKilled);
  R.ok(bossKilled, `${cls}: Bramblemaw defeated`, `deaths in the boss fight: ${B.deaths - deaths0}`);
  const mats = await page.evaluate(() => ({ ...window.__game.inv.mats, recipes: window.__game.inv.recipes }));
  R.ok(mats.thornheart >= 1 && mats.recipes.length >= 1, `${cls}: boss gives its heart, a class essence and a recipe`, JSON.stringify(mats));
  await walkTo(page, 25.5, 6.0); await walkTo(page, 23.5, 7.0); await walkTo(page, 25.5, 5.8); await face(page, 'n');
  await pressE(page, 1); await page.waitForTimeout(2500);
  await pressE(page, 12); await page.waitForTimeout(2500); await sim(page, 5);
  R.ok(await page.evaluate(() => window.__game.area.id === 'overworld' && window.__game.inv.chimes.includes('verdant')), `${cls}: Verdant Chime taken, back in Lanternreach`);
  // ---- home: ring the bell
  await page.evaluate(() => { const g = window.__game, n = g.entities.find(e => e.id === 'tamsin'), p = g.player; n.wanderR = 0; p.x = n.x; p.z = n.z + 0.8; p.facing = Math.PI; g.snapCamera(); });
  await sim(page, 2); await pressE(page, 1);
  for (let i = 0; i < 12; i++) { await talkThrough(page, 20); await page.waitForTimeout(700); }
  const end = await page.evaluate(() => ({ stage: window.__game.flags.stage, lifted: !!window.__game.flags.hushLifted }));
  R.ok(end.stage === 3 && end.lifted, `${cls}: Chapter I complete, the Hush lifts`);
  const summary = `${cls}: ${B.deaths} death(s)${B.where.length ? ' [' + B.where.join(', ') + ']' : ''}, ${B.tonics} tonic(s) drunk, ${(Date.now() - t0) / 1000 | 0}s wall-clock`;
  R.note(summary);
  return summary;
}

export default async function (page, R) {
  const list = (process.env.CLASSES || 'samurai,archer,witch').split(',');
  const out = [];
  for (const cls of list) out.push(await run(page, R, cls));
  for (const s of out) R.note(s);
}
