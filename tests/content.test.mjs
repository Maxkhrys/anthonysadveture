// Pass 5 content: new creatures, elite modifiers, materials, the Conservatory, the Seamkeeper
// and the Crowned Toad. Scripted checks prove the systems run; they are not a verdict on feel.
import { sim, fresh } from './lib.mjs';

export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 1, level: 8 });
  // ---------------------------------------------------------------- five families fight and die cleanly
  const fam = await page.evaluate(() => {
    const g = window.__game, p = g.player, out = {};
    g.godMode = true;
    for (const kind of ['mantis', 'slug', 'moth', 'porcelain', 'leech']) {
      for (const e of g.entities) if (e.isEnemy) e.remove();
      p.x = 58.5; p.z = 64.5; p.setState('move'); g.snapCamera();
      const e = g.spawnEnemy(kind, p.x + 2.5, p.z, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; e.obj.scale.setScalar(1);
      const states = new Set();
      g.noRender = true;
      for (let i = 0; i < 240; i++) { window.__sim(1); states.add(e.state); }
      const hp0 = e.hp;
      g.playerHit(e, { mult: 1, kind: 'sword', kb: 0, dir: 0 });
      const took = hp0 - e.hp;
      e.hp = 1; g.playerHit(e, { mult: 3, kind: 'spin', kb: 0, dir: 0 });
      window.__sim(5); g.noRender = false;
      out[kind] = { name: g.nameOf(e), states: [...states].join(','), took: Math.round(took), dead: e.dead };
    }
    g.godMode = false;
    return out;
  });
  for (const k of Object.keys(fam)) R.ok(fam[k].dead && /windup/.test(fam[k].states) && /attack|recover/.test(fam[k].states), `${fam[k].name}: approaches, telegraphs (windup), attacks and dies`, JSON.stringify(fam[k]));
  R.ok(fam.porcelain.took < fam.mantis.took * 0.6 + 1, 'the Porcelain Guard shell soaks ordinary blows', JSON.stringify([fam.porcelain.took, fam.mantis.took]));

  // porcelain shell breaks under heavy blows
  const shell = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    const s0 = g.stats.shellsBroken || 0; const e = g.spawnEnemy('porcelain', p.x + 2, p.z, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; e.hp = e.maxHp = 400; e.think = () => [0, 0];
    let n = 0; while (!(e.shell !== null && e.shell <= 0) && n < 50) { g.playerHit(e, { mult: 2, kind: 'spin', kb: 0, dir: 0 }); n++; }
    const h0 = e.hp; g.playerHit(e, { mult: 1, kind: 'sword', kb: 0, dir: 0 }); const after = h0 - e.hp;
    return { broke: e.shell <= 0, n, poise: e.poise, stat: g.stats.shellsBroken - s0, after };
  });
  R.ok(shell.broke && !shell.poise && shell.stat === 1, 'heavy blows break the porcelain shell; it staggers and loses its poise', JSON.stringify(shell));

  // bell leech zone disrupts cooldowns
  const zone = await page.evaluate(() => {
    const g = window.__game, p = g.player, Z = window.__m3.ResonanceZone;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    g.godMode = true; p.cdMap.tempest = 5; g.res = 80;
    g.spawn(new Z(g, p.x, p.z, null));
    g.noRender = true; window.__sim(30); g.noRender = false;
    const cd = p.cdMap.tempest, res = g.res;
    g.godMode = false;
    return { cd, res };
  });
  R.ok(zone.cd > 4.9 && zone.res < 80, 'standing in a Bell Leech resonance zone freezes cooldowns and drains resource', JSON.stringify(zone));

  // elites: Resonant repeats, Oathbound strengthens and breaks
  const el = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    const r = g.spawnEnemy('blot', p.x + 1.5, p.z, { noRoom: true, eliteChance: 0 }); r.spawnT = 0; g.makeElite(r); r.elite = 'Resonant';
    r.setState('attack');
    const echo = g.entities.some(e => e.constructor.name === 'ResonantEcho');
    const o = g.spawnEnemy('knight', p.x - 3, p.z, { noRoom: true, eliteChance: 0 }); o.spawnT = 0; g.makeElite(o); o.elite = 'Oathbound'; o.think = () => [0, 0];
    const ally = g.spawnEnemy('blot', p.x - 3.5, p.z + 1, { noRoom: true, eliteChance: 0 }); ally.spawnT = 0; ally.hp = ally.maxHp = 1000; ally.think = () => [0, 0];
    g.noRender = true; window.__sim(3); g.noRender = false;
    const bound = ally.oathT > 0;
    const h0 = ally.hp; g.playerHit(ally, { mult: 1, kind: 'sword', kb: 0, dir: 0, forceCrit: false }); const buffed = h0 - ally.hp;
    o.hp = o.maxHp = 1000; g.playerHit(o, { mult: 1, kind: 'spin', kb: 0, dir: 0 });
    g.noRender = true; window.__sim(3); g.noRender = false;
    return { echo, bound, broken: o.oathBroken > 0, freed: !(ally.oathT > 0) };
  });
  R.ok(el.echo, 'Resonant elites leave a marked echo of each attack');
  R.ok(el.bound && el.broken && el.freed, 'Oathbound elites bind nearby allies until a heavy blow breaks the oath', JSON.stringify(el));

  // materials
  const mats = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    const before = { ...g.inv.mats };
    for (const kind of ['mantis', 'slug', 'moth', 'porcelain', 'leech']) { const e = g.spawnEnemy(kind, p.x + 2, p.z, { noRoom: true, eliteChance: 0 }); e.spawnT = 0; g.makeElite(e); e.die({ dir: 0 }); }
    return { gained: ['mantis', 'wax', 'moth', 'porcelain', 'filament'].every(k => (g.inv.mats[k] || 0) > (before[k] || 0)), learned: g.inv.recipes.includes('waxseal') && g.inv.recipes.includes('mothwing') };
  });
  R.ok(mats.gained && mats.learned, 'each family drops its crafting material (elites always); wax and moth dust teach their engravings', JSON.stringify(mats));
  await conservatory(page, R);
}

export async function conservatory(page, R) {
  await fresh(page, 'archer', { stage: 1, level: 9 });
  await page.evaluate(() => { const g = window.__game; g.inv.bellows = true; g.warpTo('conservatory', 'entrance'); });
  await page.waitForFunction(() => window.__game.area.id === 'conservatory' && !window.__game.transitioning, null, { timeout: 15000 });
  await sim(page, 3);
  const info = await page.evaluate(() => { const g = window.__game; return { rooms: g.area.rooms.length, room: g.room && g.room.id, bells: g.entities.filter(e => e.constructor.name === 'HangingBell').length, lvl: g.zoneLevel(g.player.x, g.player.z) }; });
  R.ok(info.rooms === 9 && info.room === 'atrium' && info.bells === 3, 'the Conservatory loads: nine rooms, you arrive in the Glass Atrium', JSON.stringify(info));
  // bell puzzle: wrong order fails, right order opens the potting shed
  const bells = await page.evaluate(async () => {
    const g = window.__game, B = g.entities.filter(e => e.constructor.name === 'HangingBell');
    const byPitch = p => B.find(b => b.pitch === p);
    const ring = async p => { byPitch(p).cool = 0; byPitch(p).ring(); await new Promise(r => setTimeout(r, 30)); };
    await ring(0); await ring(1); await ring(2);
    await new Promise(r => setTimeout(r, 700));
    const wrong = g.signal('c.bells');
    await ring(0); await ring(2); await ring(1);
    await new Promise(r => setTimeout(r, 800));
    return { wrong, right: g.signal('c.bells') };
  });
  R.ok(!bells.wrong && bells.right, 'Fern Hall bells: the wrong order does nothing; low, high, middle opens the way', JSON.stringify(bells));
  // cracked glass secret: light blows bounce, heavy blows shatter
  const glass = await page.evaluate(() => {
    const g = window.__game, G = g.entities.find(e => e.constructor.name === 'CrackedGlass');
    G.onHit({ kind: 'arrow', dmg: 5 }); const light = G.broken;
    G.onHit({ kind: 'spin', dmg: 5 }); return { light, heavy: G.broken, flag: !!g.flags['glass:' + G.id] };
  });
  R.ok(!glass.light && glass.heavy && glass.flag, 'the potting-shed cabinet only breaks under a heavy blow, and stays broken', JSON.stringify(glass));
  // pond: push the block into the broken floor, reach the key, hit the shortcut switch
  const pond = await page.evaluate(() => {
    const g = window.__game, room = g.area.rooms.find(r => r.id === 'pond');
    const blk = g.entities.find(e => e.constructor.name === 'Block' && e.room === 'pond');
    const p = g.player; p.x = blk.x; p.z = blk.z - 1; g.updateRoom(true);
    g.noRender = true;
    for (let i = 0; i < 3; i++) { blk.tryPush([0, 1]); for (let k = 0; k < 20; k++) blk.update(1 / 30); }
    const filled = g.tileAt(room.x0 + 8, room.z0 + 8) === 14;
    const sw = g.entities.find(e => e.constructor.name === 'Switch' && e.room === 'pond'); p.x = sw.x; p.z = sw.z;
    window.__sim(5); g.noRender = false;
    return { filled, shortcut: g.signal('c.shortcut') };
  });
  R.ok(pond.filled && pond.shortcut, 'Lily Pond Court: a block fills the broken floor to the key; the latch opens the shortcut to the atrium', JSON.stringify(pond));
  // Seamkeeper
  const seam = await page.evaluate(async () => {
    const g = window.__game, room = g.area.rooms.find(r => r.id === 'loom'), p = g.player;
    g.setSignal('c.torches', true, true);
    p.x = room.x0 + 8.5; p.z = room.z0 + 8.5; g.updateRoom(true); g.snapCamera();
    g.noRender = true; window.__sim(3); g.noRender = false;
    await new Promise(r => setTimeout(r, 3600));
    const b = g.entities.find(e => e.constructor.name === 'Seamkeeper');
    if (!b) return { spawned: false };
    const out = { spawned: true, sealed: g.entities.some(e => e.constructor.name === 'Door' && e.rooms.includes('loom') && e.sealed) };
    g.godMode = true;
    g.noRender = true; for (let i = 0; i < 200; i++) window.__sim(1); g.noRender = false;
    out.threads = g.stats.threadsCut !== undefined || g.entities.some(e => e.isThread);
    const h0 = b.hp; b.setState('idle'); g.playerHit(b, { mult: 1, kind: 'arrow', kb: 0, dir: 0 }); const armour = h0 - b.hp;
    b.tangle(); const h1 = b.hp; g.playerHit(b, { mult: 1, kind: 'arrow', kb: 0, dir: 0 }); const bare = h1 - b.hp;
    out.armour = armour; out.bare = bare;
    b.hp = 1; g.playerHit(b, { mult: 1, kind: 'spin', kb: 0, dir: 0 });
    g.noRender = true; window.__sim(90); g.noRender = false;
    await new Promise(r => setTimeout(r, 1500));
    out.dead = !!g.flags.seamDead; out.reliquary = g.signal('c.seamdead'); out.recipe = g.inv.recipes.includes('seamstitch'); out.thread = g.inv.mats.seamthread;
    g.godMode = false;
    return out;
  });
  R.ok(seam.spawned && seam.sealed && seam.threads, 'the Seamkeeper wakes in its loom, seals the room and stitches threads', JSON.stringify(seam));
  R.ok(seam.bare > seam.armour * 3, 'its armour turns blows until it is tangled and its joints are exposed', JSON.stringify(seam));
  R.ok(seam.dead && seam.reliquary && seam.recipe && seam.thread >= 2, 'defeating it opens the reliquary and gives thread and the Seamstitch recipe', JSON.stringify(seam));
  // Crowned Toad
  await page.evaluate(() => window.__game.warpTo('overworld', 'fen'));
  await page.waitForFunction(() => window.__game.area.id === 'overworld' && !window.__game.transitioning, null, { timeout: 15000 });
  const toad = await page.evaluate(async () => {
    const g = window.__game, t = g.fenToad;
    if (!t) return { present: false };
    const out = { present: true, sleeping: t.state === 'sleep', wade: g.tileAt(22, 86) === 24 };
    for (const b of g.entities.filter(e => e.constructor.name === 'HangingBell' && e.group === 'fen')) { b.cool = 0; b.ring(); }
    g.wtT = 0; g.worldTick(0.1);
    await new Promise(r => setTimeout(r, 3600));
    g.noRender = true; window.__sim(30); g.noRender = false;
    out.awake = t.state !== 'sleep' && t.state !== 'rise';
    g.godMode = true;
    const states = new Set(); g.noRender = true; for (let i = 0; i < 360; i++) { window.__sim(1); states.add(t.state); } g.noRender = false;
    out.states = [...states].join(',');
    t.hp = 1; t.alt = 0; t.setState('stuck'); g.playerHit(t, { mult: 1, kind: 'arrow', kb: 0, dir: 0 });
    g.noRender = true; window.__sim(100); g.noRender = false;
    await new Promise(r => setTimeout(r, 1500));
    out.dead = (g.flags.toadKills || 0) >= 1; out.pearl = g.inv.mats.crownpearl; out.recipe = g.inv.recipes.includes('crowntongue');
    g.godMode = false;
    return out;
  });
  R.ok(toad.present && toad.sleeping && toad.wade, 'the Crowned Toad sleeps under the wadeable fen', JSON.stringify(toad));
  R.ok(toad.awake && /tongue|leap|pound/.test(toad.states), 'ringing the three lilies wakes it; it tongue-lashes, leaps and pounds', JSON.stringify(toad));
  R.ok(toad.dead && toad.pearl >= 1 && toad.recipe, 'its defeat drops a Crown Pearl and teaches Crowned Tongue', JSON.stringify(toad));
}
