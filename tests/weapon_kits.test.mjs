// Class combat rework: every weapon family has its own primary / secondary. Drives the real game
// deterministically through window.__sim; right-click is exercised through the real mouse too.
import { sim, fresh, toSquare } from './lib.mjs';

const HARNESS = () => {
  const g = window.__game;
  window.__wk = {
    kinds: [],
    setup(id) {
      const p = g.player, I = window.__items;
      for (const e of g.entities) if (e.isEnemy || e.isProjectile || e.isCurse) e.remove();
      g.inv.equip.weapon = I.makeNamed(id, 8); g.recalc(); p.m.setGear && p.m.setGear(g.inv.equip);
      g.pstats.resRegenRate = 0; g.res = 100; p.secCd = 0; p.reload = null; p.barrage = null; p.gunCd = 0; p.cdMap = {};
      p.x = 148.5; p.z = 132.5; p.facing = 0; p.aimSrc = 'keys'; p.invuln = 0; p.setState('move'); p.w2 = null; g.snapCamera();
      window.__sim(1, []); const w = g.inv.equip.weapon; if (w.magazine) w.magazine.rounds = 6; p.gunCd = 0; p.reload = null;
      g.stats = {}; this.kinds = []; this.rel = [];
      if (!g.__wkSpawn) { g.__wkSpawn = true; const sp = g.spawn.bind(g); g.spawn = e => { if (e.constructor && /Projectile|Orb/.test(e.constructor.name)) window.__wk.kinds.push(e.kind + ':' + (e.element || '')); return sp(e); }; }
      if (!g.__wkEv) { g.__wkEv = true; window.__wkEvents = g.combatEvents || null; }
      return g.player.wkit.id + '/' + (g.player.wkit.secondary && g.player.wkit.secondary.id);
    },
    foe(dx, dz, kind = 'blot', o = {}) {
      const p = g.player, e = g.spawnEnemy(kind, p.x + dx, p.z + dz, { noRoom: true, eliteChance: 0 });
      e.spawnT = 0; e.elite = null; e.x = p.x + dx; e.z = p.z + dz; e.sync && e.sync(); e.think = () => [0, 0]; e.hp = e.maxHp = o.hp || 900; e.facing = o.facing ?? Math.PI; e.state = 'chase';
      this.watch = e; return e;
    },
    run(hold, after, keys = ['KeyX']) { g.noRender = true; this.maxStag = 0; const w = () => { if (this.watch) this.maxStag = Math.max(this.maxStag, this.watch.stagger || 0); }; for (let i = 0; i < hold; i++) { window.__sim(1, keys); w(); } for (let i = 0; i < after; i++) { window.__sim(1, []); w(); } g.noRender = false; },
  };
};

export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 3, level: 8 }); await toSquare(page);
  await page.evaluate(HARNESS);

  // ------------------------------------------------------------ every family, both buttons
  const CASES = [
    ['samurai', 'rustkatana', 'katana/drawcut', 1, 40, [0, 1.8]],
    ['samurai', 'wakizashi', 'fastblade/flurry', 1, 50, [0, 1.3]],
    ['samurai', 'nodachi', 'greatblade/cleave', 1, 70, [0, 1.8]],
    ['samurai', 'moonkatana', 'elemblade/elemslash', 1, 50, [0, 2.5]],
    ['archer', 'longbow', 'longbow/deadeye', 75, 40, [0, 4]],
    ['archer', 'recurve', 'recurve/triple', 1, 50, [0, 4]],
    ['archer', 'composite', 'crossbow/heavybolt', 1, 60, [0, 4]],
    ['archer', 'sunbow', 'elembow/elemarrow', 1, 50, [0, 4]],
    ['witch', 'acornstaff', 'firestaff/fireball', 60, 60, [0, 4]],
    ['witch', 'frostrod', 'froststaff/icelance', 1, 50, [0, 4]],
    ['witch', 'owlstaff', 'stormstaff/chainbolt', 1, 40, [0, 4]],
    ['witch', 'crookstaff', 'arcanestaff/arcaneorb', 1, 120, [0, 3]],
    ['witch', 'hexwand', 'hexwand/hexburst', 1, 110, [0, 4]],
    ['witch', 'shroomwand', 'emberwand/flamecone', 1, 60, [0, 2]],
    ['soulbound', 'gravechain', 'heavychain/yank', 1, 50, [0, 3.6]],
    ['soulbound', 'tetherchain', 'longchain/reach', 1, 40, [0, 4.3]],
    ['soulbound', 'lanternlinks', 'spiritchain/spiritfollow', 1, 60, [0, 2]],
    ['gunslinger', 'trailrevolver', 'revolver/fan', 1, 40, [0, 4]],
    ['gunslinger', 'woodrifle', 'rifle/burst', 1, 50, [0, 4]],
  ];
  const seen = {};
  for (const [cls, id, want, hold, after, [dx, dz]] of CASES) {
    if (seen.cls !== cls) { await fresh(page, cls, { stage: 3, level: 8 }); await toSquare(page); await page.evaluate(HARNESS); seen.cls = cls; }
    const r = await page.evaluate(([id, hold, after, dx, dz]) => {
      const g = window.__game, W = window.__wk, p = g.player, kit = W.setup(id);
      const e = W.foe(dx, dz), hp0 = e.hp, res0 = g.res, rounds0 = g.inv.equip.weapon.magazine?.rounds;
      let resAtRelease = null; const off = g.combatEvents ? g.combatEvents.on('attack.release', () => { resAtRelease = g.res; }) : null;
      W.run(hold, after);
      off && off();
      const S = e.status || {};
      const d0 = p.wkit.secondary, want = (d0.cost || 0) * (1 - Math.min(0.5, (g.pstats.arpg?.stats.resourceCostReduction || 0) / 100));
      return { kit, want, dmg: hp0 - e.hp, dz: Math.hypot(e.x - p.x, e.z - p.z), res: res0 - g.res, resAtRelease, res0, rounds: rounds0 != null ? rounds0 - g.inv.equip.weapon.magazine.rounds : null,
        fired: Object.keys(g.stats).filter(k => k.startsWith('secondary:')), state: p.state, kinds: W.kinds.slice(0, 8),
        status: Object.entries(S).filter(([k, v]) => typeof v === 'number' && v > 0 && k !== 'burnDps').map(([k]) => k), stag: W.maxStag > 0.5, secCd: p.secCd };
    }, [id, hold, after, dx, dz]);
    const label = `${cls} ${id}: right click = ${want.split('/')[1]}`;
    R.ok(r.kit === want, `${id} resolves to the ${want} kit`, r.kit);
    R.ok(r.fired.length === 1 && r.dmg > 0, label + ' fires once and deals damage', JSON.stringify(r));
    const cost = { deadeye: 18, triple: 10, heavybolt: 16, elemarrow: 14, fireball: 16, icelance: 15, chainbolt: 18, arcaneorb: 20, hexburst: 14, flamecone: 14 }[want.split('/')[1]] || 0;
    if (cost) R.ok(r.resAtRelease != null && Math.abs(r.res0 - r.resAtRelease - r.want) < 0.01 && r.want > cost * 0.49, `${want.split('/')[1]} costs ${cost} ${cls === 'witch' ? 'Mana' : 'Focus'}, paid at the moment it fires`, `spent ${r.res.toFixed(1)}`);
    // family-specific identity checks
    const sec = want.split('/')[1];
    if (sec === 'fireball') R.ok(r.status.includes('burn'), 'charged fireball burns', r.status.join());
    if (sec === 'icelance' || sec === 'elemslash') R.ok(r.status.some(s => s === 'chill' || s === 'freeze' || s === 'frostBuild'), sec + ' builds frost', r.status.join());
    if (sec === 'hexburst') R.ok(r.status.includes('hex') && r.dmg > 0, 'hex burst hexes, then bursts', r.status.join());
    if (sec === 'flamecone' || sec === 'elemarrow') R.ok(r.status.includes('burn'), sec + ' sets foes alight', r.status.join());
    if (sec === 'heavybolt') R.ok(r.status.includes('mark'), 'armour-breaker marks (armour broken)', r.status.join());
    if (sec === 'cleave') R.ok(r.stag, 'overhead cleave staggers');
    if (sec === 'yank') R.ok(r.dz < 2.2, 'anchor yank drags the foe in', r.dz.toFixed(2));
    if (sec === 'fan') R.ok(r.rounds === 3, 'fan the hammer spends three real rounds', String(r.rounds));
    if (sec === 'burst') R.ok(r.rounds === 4, 'controlled burst spends four rounds', String(r.rounds));
    if (sec === 'triple') R.ok(r.kinds.filter(k => k.startsWith('arrow')).length === 3, 'triple shot looses three arrows', r.kinds.join());
    if (sec === 'reach') R.ok(r.dmg > 0, "reaper's reach hits past the normal lash range (4.3)");
  }

  // ------------------------------------------------------------ witch primaries differ by weapon
  await fresh(page, 'witch', { stage: 3, level: 8 }); await toSquare(page); await page.evaluate(HARNESS);
  const prim = await page.evaluate(() => {
    const out = {};
    for (const id of ['acornstaff', 'frostrod', 'owlstaff', 'crookstaff', 'hexwand', 'shroomwand']) {
      const W = window.__wk; W.setup(id); const e = W.foe(0, 4); W.run(1, 30, ['KeyC']);
      out[id] = { kinds: W.kinds.slice(), dmg: e.maxHp - e.hp, st: Object.keys(e.status || {}).filter(k => e.status[k] > 0) };
    }
    return out;
  });
  const sig = Object.fromEntries(Object.entries(prim).map(([k, v]) => [k, v.kinds.join('+')]));
  R.ok(new Set(Object.values(sig)).size === 6, 'every Witch weapon casts a different primary spell', JSON.stringify(sig));
  R.ok(Object.values(prim).every(v => v.dmg > 0), 'every primary spell lands', JSON.stringify(Object.fromEntries(Object.entries(prim).map(([k, v]) => [k, v.dmg]))));
  R.ok(prim.shroomwand.kinds.length === 2, 'the ember wand throws a pair of darts per cast', sig.shroomwand);
  const hold = await page.evaluate(() => { const W = window.__wk; W.setup('hexwand'); W.foe(0, 4); W.run(60, 10, ['KeyC']); return W.kinds.length; });
  R.ok(hold >= 4, 'holding left click keeps casting (auto-repeat at the spell rate)', String(hold));

  // ------------------------------------------------------------ charge, cooldown, invalid, cancels
  const rules = await page.evaluate(() => {
    const g = window.__game, W = window.__wk, p = g.player, out = {};
    const charges = []; const off = g.combatEvents.on('attack.release', d => charges.push(+d.charge.toFixed(2)));
    W.setup('acornstaff'); W.foe(0, 5); W.run(1, 60); W.setup('acornstaff'); W.foe(0, 5); W.run(70, 40);
    out.charges = charges.slice(); off();
    // cooldown: a second press straight away is refused and costs nothing
    W.setup('frostrod'); W.foe(0, 4); W.run(1, 20); const r1 = g.res; W.run(1, 2);
    out.cd = { fired: g.stats['secondary:icelance'], refused: g.stats.secondaryRefused || 0, spent: r1 - g.res };
    // not enough mana
    W.setup('frostrod'); W.foe(0, 4); g.res = 5; W.run(1, 20); out.poor = { fired: g.stats['secondary:icelance'] || 0, res: g.res };
    // chain lightning with nothing in sight
    W.setup('owlstaff'); W.run(1, 20); out.noTarget = { fired: g.stats['secondary:chainbolt'] || 0, res: g.res };
    // chain lightning chains only along clear lines of sight, and to several foes
    W.setup('owlstaff'); const a = W.foe(0, 3), b = W.foe(2, 4), c = W.foe(-2, 5); W.run(1, 30); out.chain = [a, b, c].filter(e => e.hp < e.maxHp).length; out.chainDbg = { hp: [a, b, c].map(e => [e.hp, e.x.toFixed(1), e.z.toFixed(1), e.dead]), fired: g.stats['secondary:chainbolt'] || 0, p: [p.x.toFixed(1), p.z.toFixed(1)] };
    // dodge out of a windup: no cost, no cooldown lock-out
    W.setup('nodachi'); W.foe(0, 1.8); W.run(1, 6); const st = p.state; window.__sim(1, ['Space']); window.__sim(20, []);
    out.dodge = { st, fired: g.stats['secondary:cleave'] || 0, secCd: p.secCd, state: p.state };
    // holding the button never repeats a non-charge secondary (no buffered duplicates)
    W.setup('frostrod'); W.foe(0, 4); W.run(150, 10); out.held = g.stats['secondary:icelance'];
    return out;
  });
  R.ok(rules.charges.length === 2 && rules.charges[0] < 0.1 && rules.charges[1] === 1, 'a tapped fireball casts at minimum charge; a held one at full', JSON.stringify(rules.charges));
  R.ok(rules.cd.fired === 1 && rules.cd.refused >= 1 && Math.abs(rules.cd.spent) < 0.01, 'secondaries have a cooldown and a refused cast costs nothing', JSON.stringify(rules.cd));
  R.ok(rules.poor.fired === 0 && rules.poor.res === 5, 'without enough Mana the secondary is refused (no free casts)', JSON.stringify(rules.poor));
  R.ok(rules.noTarget.fired === 0 && rules.noTarget.res === 100, 'chain lightning with nothing in sight is refused and free', JSON.stringify(rules.noTarget));
  R.ok(rules.chain >= 2, 'chain lightning leaps between foes', JSON.stringify(rules.chainDbg));
  R.ok(rules.dodge.st === 'weapon2' && rules.dodge.fired === 0 && rules.dodge.secCd < 0.2, 'dodging out of a windup cancels it for free', JSON.stringify(rules.dodge));
  R.ok(rules.held === 1, 'holding right click fires a secondary exactly once', String(rules.held));

  // ------------------------------------------------------------ shields and statuses
  const shield = await page.evaluate(() => {
    const g = window.__game, W = window.__wk, out = {};
    for (const [id, hold, after] of [['recurve', 1, 50], ['composite', 1, 60], ['frostrod', 1, 40], ['nodachi', 1, 70], ['acornstaff', 60, 60]]) {
      W.setup(id); const e = W.foe(0, id === 'nodachi' ? 1.8 : 4, 'brigand', { facing: Math.PI }); const h = e.hp; W.run(hold, after); out[id] = h - e.hp;
    }
    return out;
  });
  R.ok(shield.recurve === 0, 'light arrows (triple shot) clang off a raised shield', JSON.stringify(shield));
  R.ok(shield.composite > 0 && shield.frostrod > 0 && shield.nodachi > 0 && shield.acornstaff > 0, 'heavy secondaries (armour-breaker, ice lance, cleave, fireball) break through the shield', JSON.stringify(shield));
  const frost = await page.evaluate(() => { const W = window.__wk; W.setup('frostrod'); const e = W.foe(0, 4); W.run(1, 30); window.__sim(20, []); for (let i = 0; i < 8; i++) { W.run(1, 17, ['KeyC']); } return { freeze: e.status.freeze > 0, chill: e.status.chill > 0 }; });
  R.ok(frost.freeze || frost.chill, 'ice shards + ice lance build to chill and freeze', JSON.stringify(frost));

  // ------------------------------------------------------------ samurai parry and counter
  await fresh(page, 'samurai', { stage: 3, level: 8 }); await toSquare(page); await page.evaluate(HARNESS);
  const parry = await page.evaluate(() => {
    const g = window.__game, W = window.__wk, p = g.player;
    W.setup('rustkatana'); const e = W.foe(0, 1.4);
    window.__sim(1, ['KeyQ']); const guard = p.hurt({ dmg: 1, x: e.x, z: e.z, src: e });
    window.__sim(30, []);
    p.invuln = 0; p.secCd = 0; e.hp = e.maxHp; const hp = e.hp;
    window.__sim(1, ['KeyX']); window.__sim(3, []); const counter = p.hurt({ dmg: 1, x: e.x, z: e.z, src: e });
    window.__sim(30, []);
    return { guard, counter, counters: g.stats.counters || 0, dmg: hp - e.hp, fired: g.stats['secondary:drawcut'] };
  });
  R.ok(parry.guard === 'parry', 'Q guard still gives a timed parry', parry.guard);
  R.ok(parry.counter === 'parry' && parry.counters === 1 && parry.dmg > 0, 'Draw Cut stance parries a frontal blow and answers with the cut', JSON.stringify(parry));

  // ------------------------------------------------------------ soulbound echoes
  await fresh(page, 'soulbound', { stage: 3, level: 8 }); await toSquare(page); await page.evaluate(HARNESS);
  const echo = await page.evaluate(() => {
    const g = window.__game, W = window.__wk, out = {};
    W.setup('gravechain'); W.foe(0, 3); g.res = 0; W.run(1, 40); out.gain = g.res;
    W.setup('lanternlinks'); W.foe(0, 2); g.res = 40; W.run(1, 60); out.after = g.res; out.spent = g.stats.echoesSpent || 0;
    W.setup('wandererschain'); const e = W.foe(0, 2); W.run(1, 30, ['KeyC']); out.lash = e.maxHp - e.hp;
    return out;
  });
  R.ok(echo.gain >= 10, 'a landed Anchor Yank gathers half a Soul Echo', String(echo.gain));
  R.ok(echo.spent === 1 && echo.after < 40 + 10.5, 'Spectral Follow-up spends one Echo for spirits when you have one', JSON.stringify(echo));
  R.ok(echo.lash > 0, 'left click is still the SoulChain lash (not a sword)', String(echo.lash));

  // ------------------------------------------------------------ named overrides, events, reload, save/load
  await fresh(page, 'gunslinger', { stage: 3, level: 8 }); await toSquare(page); await page.evaluate(HARNESS);
  const gun = await page.evaluate(() => {
    const g = window.__game, W = window.__wk, p = g.player, out = {};
    W.setup('sundownsix'); W.foe(0, 4); out.kit = p.wkit.secondary.id; W.run(1, 16); out.fanned = 6 - g.inv.equip.weapon.magazine.rounds;
    W.setup('trailrevolver'); g.inv.equip.weapon.magazine.rounds = 0; W.run(1, 20); out.empty = g.stats['secondary:fan'] || 0;
    const n = g.combatEvents.counts['weapon.reload'] || 0; window.__sim(1, ['KeyZ']); out.reloadEvent = (g.combatEvents.counts['weapon.reload'] || 0) - n;
    return out;
  });
  R.ok(gun.kit === 'fan:sundownsix' && gun.fanned === 6, 'Sundown Six (named) overrides the fan to empty the cylinder', JSON.stringify(gun));
  R.ok(gun.empty === 0, 'an empty cylinder refuses the fan', String(gun.empty));
  R.ok(gun.reloadEvent === 1, 'reloading announces weapon.reload for presentation hooks');

  await fresh(page, 'witch', { stage: 3, level: 8 }); await toSquare(page); await page.evaluate(HARNESS);
  const named = await page.evaluate(() => { const g = window.__game, W = window.__wk; W.setup('candelabra'); W.foe(0, 4); W.run(60, 60); return { id: g.player.wkit.secondary.id, fireballs: W.kinds.filter(k => k.startsWith('fireball')).length, ev: { ...g.combatEvents.counts } }; });
  R.ok(named.id === 'fireball:candelabra' && named.fireballs >= 4, "Chandler's Candelabra overrides the fireball to split in three", JSON.stringify(named));
  R.ok(['attack.windup', 'attack.release', 'spell.cast', 'spell.impact', 'weapon.secondary'].every(k => named.ev[k] > 0), 'combat events fire for windup, release, cast and impact', JSON.stringify(named.ev));
  const save = await page.evaluate(async () => { const g = window.__game; await g.save(); await window.__start(false); return { base: g.inv.equip.weapon.base, id: g.player.wkit.secondary.id, cls: g.inv.cls }; });
  R.ok(save.cls === 'witch' && save.id === 'fireball:candelabra', 'save/load keeps the weapon and its kit override', JSON.stringify(save));

  // ------------------------------------------------------------ the real right mouse button
  await fresh(page, 'archer', { stage: 3, level: 8 }); await toSquare(page); await page.evaluate(HARNESS);
  await page.evaluate(() => { const W = window.__wk; W.setup('recurve'); W.foe(0, 4); });
  const box = await page.locator('canvas#game').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60);
  await page.mouse.down({ button: 'right' }); await sim(page, 2); await page.mouse.up({ button: 'right' }); await sim(page, 40);
  const rmb = await page.evaluate(() => ({ fired: window.__game.stats['secondary:triple'] || 0, state: window.__game.player.state }));
  R.ok(rmb.fired === 1 && rmb.state !== 'block', 'right mouse button fires the weapon secondary (not a guard)', JSON.stringify(rmb));
}
