// Pass 5: skill trees, six-slot hotbar, every active ability, respec, migration,
// off-class weapons, element reactions and armour sets.
import { sim, fresh } from './lib.mjs';

// unlock every active of the class (dev-style), keep a dummy crowd in front, cast each one
async function castAll(page, cls) {
  await fresh(page, cls, { stage: 1, level: 20 });
  return page.evaluate(async () => {
    const g = window.__game, inv = g.inv, S = window.__skills, p = g.player;
    inv.sp = 60;
    // buy every active (and whatever it needs) until nothing more can be bought
    for (let pass = 0; pass < 6; pass++) for (const n of S.treeOf(inv.cls)) if (n.skill && !S.rankOf(inv, n.id)) { for (const q of n.req) if (!S.rankOf(inv, q)) S.spendNode(inv, q); S.spendNode(inv, n.id); }
    g.recalc();
    const actives = S.treeOf(inv.cls).filter(n => n.skill).map(n => n.skill);
    const out = {};
    for (const id of actives) {
      for (const e of g.entities) if (e.isEnemy) e.remove();
      p.x = 58.5 + 90; p.z = 62.5 + 70; p.facing = 0; p.setState('move'); g.snapCamera();
      const foes = [];
      for (let i = 0; i < 6; i++) { const e = g.spawnEnemy('blot', p.x + (i % 3 - 1) * 0.7, p.z + (i < 3 ? 1.4 : 2.6), { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e6; e.think = () => [0, 0]; e.obj.scale.setScalar(1); foes.push(e); }
      g.res = 100; p.cdMap = {};
      // put it in slot 1 and cast through the real input path
      inv.loadout[0] = null; S.setLoadout(inv, 0, id);
      p.aimSrc = 'keys';
      const hp0 = foes.reduce((a, e) => a + e.hp, 0);
      g.noRender = true;
      const held = ['snare', 'rain', 'stormpin', 'needlerain', 'embergarden', 'mothstorm'].includes(id);
      window.__sim(1, ['Digit1']);
      window.__sim(id === 'stormthread' ? 60 : 1, id === 'stormthread' ? ['Digit1'] : []);
      // set off ember seeds with fire so the chain is exercised too
      if (id === 'embergarden') window.__combat.blast(g, p.x, p.z + 2.8, 2.5, 0.5, 0xff8a2a, { burn: true });
      window.__sim(40);
      // Briar Tether deals its damage through the link: hit one stitched foe and watch the others
      let shared = 0;
      if (id === 'tether') { const m = foes.find(e => e.tether); const others = foes.filter(e => e.tether && e !== m); const h0 = others.map(e => e.hp); if (m) g.playerHit(m, { mult: 1, kind: 'arrow', kb: 0, dir: 0, noProc: true }); shared = others.filter((e, i) => e.hp < h0[i]).length; }
      window.__sim(220);
      g.noRender = false;
      const hp1 = foes.reduce((a, e) => a + (e.dead ? 0 : e.hp), 0);
      out[id] = { cast: (g.stats['cast:' + id] || 0) > 0, dmg: id === 'tether' ? shared : Math.round(hp0 - hp1) };
    }
    return out;
  });
}

export default async function (page, R) {
  // ---------------------------------------------------------------- every ability, every class
  for (const cls of ['samurai', 'archer', 'witch']) {
    const res = await castAll(page, cls);
    const ids = Object.keys(res);
    R.ok(ids.length >= 8, `${cls}: at least 8 active abilities in the tree`, ids.join(','));
    const bad = ids.filter(id => !res[id].cast || !(res[id].dmg > 0) && id !== 'familiar');
    R.ok(!bad.length, `${cls}: every active casts through the hotbar and damages foes`, JSON.stringify(Object.fromEntries(bad.map(b => [b, res[b]]))));
  }

  // ---------------------------------------------------------------- tree rules, loadout, respec
  await fresh(page, 'samurai', { stage: 1, level: 6 });
  const rules = await page.evaluate(() => {
    const g = window.__game, inv = g.inv, S = window.__skills;
    const out = {};
    out.freeGrants = ['iaido', 'tempest', 'oni'].every(id => S.rankOf(inv, id) === 1);
    out.loadout = inv.loadout.slice(0, 3).join(',');
    inv.sp = 0; out.noPoints = S.lockReason(inv, S.nodeById('keeneye'));
    inv.sp = 5;
    out.prereq = S.lockReason(inv, S.nodeById('finishingcut'));
    out.level = S.lockReason(inv, S.nodeById('threadsever'));
    out.keystone = S.lockReason(inv, S.nodeById('singlestroke'));
    S.spendNode(inv, 'keeneye'); S.spendNode(inv, 'keeneye'); S.spendNode(inv, 'ghostdraw'); S.spendNode(inv, 'iaido');
    g.recalc();
    out.critFromTree = g.pstats.crit;
    out.spAfter = inv.sp;
    out.autoSlot = inv.loadout.includes('ghostdraw');
    const items = inv.bag.length, cls = inv.cls, lvl = inv.level, weapon = inv.equip.weapon.itemInstanceId;
    return g.respec().then(() => {
      out.spRespec = inv.sp; out.tree = JSON.stringify(inv.tree);
      out.same = inv.bag.length === items && inv.cls === cls && inv.level === lvl && inv.equip.weapon.itemInstanceId === weapon;
      return g.respec().then(() => { out.spTwice = inv.sp; return out; });
    });
  });
  R.ok(rules.freeGrants && rules.loadout === 'iaido,tempest,oni', 'the original three abilities are granted free and sit in slots 1-3', JSON.stringify(rules));
  R.ok(/No skill points/.test(rules.noPoints) && /Requires/.test(rules.prereq) && /level/.test(rules.level) && /points in Duelist|Requires/.test(rules.keystone), 'nodes explain why they are locked (points, prerequisites, level, path points)');
  R.ok(rules.spAfter === 1 && rules.autoSlot && rules.critFromTree >= 12, 'spending ranks costs points, passives apply stats, new actives auto-slot', JSON.stringify(rules));
  R.ok(rules.spRespec === 5 && rules.spTwice === 5 && rules.same && rules.tree === JSON.stringify({ iaido: 1, tempest: 1, oni: 1 }), 'respec refunds every bought rank exactly once and keeps class, level and items', JSON.stringify(rules));

  // hotbar slots 4-6 respond to keys 4-6
  const slot6 = await page.evaluate(() => {
    const g = window.__game, inv = g.inv, S = window.__skills, p = g.player;
    inv.sp = 5; S.spendNode(inv, 'ironroot'); S.spendNode(inv, 'bellquake'); g.recalc();
    S.setLoadout(inv, 5, 'bellquake');
    g.res = 100; p.cdMap = {}; p.setState('move');
    g.noRender = true; window.__sim(1, ['Digit6']); window.__sim(40); g.noRender = false;
    return { cast: g.stats['cast:bellquake'] || 0, slot: inv.loadout[5] };
  });
  R.ok(slot6.cast === 1 && slot6.slot === 'bellquake', 'key 6 fires the ability in hotbar slot 6', JSON.stringify(slot6));

  // ---------------------------------------------------------------- migration of an old three-ability save
  const mig = await page.evaluate(() => {
    const S = window.__skills;
    const inv = { cls: 'archer', level: 9, sp: 2, skills: [4, 2, 1] };
    S.ensureTree(inv);
    const before = JSON.stringify(inv.tree), lo = inv.loadout.slice();
    S.ensureTree(inv);
    return { tree: inv.tree, loadout: lo, stable: before === JSON.stringify(inv.tree), sp: inv.sp, skills: inv.skills };
  });
  R.ok(mig.tree.multishot === 4 && mig.tree.snare === 2 && mig.tree.rain === 1 && mig.sp === 2 && mig.stable && mig.loadout.join(',') === 'multishot,snare,rain,,,', 'legacy ranks [4,2,1] migrate exactly, points unchanged, idempotent', JSON.stringify(mig));

  // ---------------------------------------------------------------- off-class weapons behave like the weapon
  await fresh(page, 'witch', { stage: 1, level: 5 });
  const off = await page.evaluate(() => {
    const g = window.__game, inv = g.inv, p = g.player, I = window.__items;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    const kat = I.genItem({ level: 5, cls: 'samurai', slot: 'weapon', rarity: 1 });
    inv.bag.push(kat); g.equipItem(inv.bag.length - 1);
    const out = { equipped: inv.equip.weapon === kat, fam: p.family, aff: g.pstats.affinity, model: p.m.sword.children[0] && p.m.sword.children[0].userData.kind };
    const nProj = () => g.entities.filter(e => e.constructor.name === 'Projectile').length;
    const n0 = nProj(); p.setState('move');
    g.noRender = true; window.__sim(1, ['KeyJ']); window.__sim(3); g.noRender = false;
    out.melee = p.state === 'attack' || p.combo > 0; out.shots = nProj() - n0;
    const bow = I.genItem({ level: 5, cls: 'archer', slot: 'weapon', rarity: 1 });
    inv.bag.push(bow); g.equipItem(inv.bag.length - 1); p.setState('move');
    const a0 = g.entities.filter(e => e.kind === 'arrow').length;
    g.noRender = true; window.__sim(1, ['KeyJ']); window.__sim(4); g.noRender = false;
    out.arrows = g.entities.filter(e => e.kind === 'arrow').length - a0; out.bowModel = p.m.offhand.children[0] && p.m.offhand.children[0].userData.kind;
    return out;
  });
  R.ok(off.equipped && ['blade', 'heavy'].includes(off.fam) && off.aff === 0.8 && off.model === 'katana', 'a witch can equip a katana; it is drawn as a katana at off-class scaling', JSON.stringify(off));
  R.ok(off.melee && off.shots === 0, 'the witch swings the katana (no hidden staff bolts)', JSON.stringify(off));
  R.ok(off.arrows === 1 && off.bowModel === 'bow', 'with a bow the witch shoots arrows', JSON.stringify(off));

  // ---------------------------------------------------------------- element reactions
  await fresh(page, 'witch', { stage: 1, level: 8 });
  const el = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    for (const e of g.entities) if (e.isEnemy) e.remove();
    const mk = (dx, dz) => { const e = g.spawnEnemy('blot', p.x + dx, p.z + dz, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e6; e.think = () => [0, 0]; return e; };
    const hit = (e, o) => { const h0 = e.hp; g.playerHit(e, { mult: 1, kb: 0, dir: 0, noProc: true, ...o }); return h0 - e.hp; };
    const avg = (f) => { let s = 0; for (let i = 0; i < 40; i++) s += f(); return s / 40; };
    g.pstats.crit = 0;
    const a = mk(2, 0), b = mk(2, 1.5), c = mk(-3, 0);
    const dry = avg(() => hit(a, { kind: 'shock', noShock: true }));
    a.applyStatus('wet', 30); b.applyStatus('wet', 30);
    const bHp = b.hp;
    const wet = avg(() => hit(a, { kind: 'shock', noShock: true }));
    const arced = b.hp < bHp;
    // shatter
    const plain = avg(() => hit(c, { kind: 'spin' }));
    let shat = 0; for (let i = 0; i < 20; i++) { c.applyStatus('freeze', 5); shat += hit(c, { kind: 'spin' }); }
    shat /= 20;
    // fire + wind
    const d = mk(0, -3), f = mk(0.8, -3.6);
    d.applyStatus('burn', 3, 5); f.status = {}; hit(d, { kind: 'wind', element: 'wind' });
    return { dry, wet, arced, plain, shat, spread: f.status.burn > 0, stats: Object.keys(g.stats).filter(k => k.startsWith('react:')) };
  });
  R.ok(el.wet > el.dry * 1.35 && el.arced, 'wet + lightning: more damage and it arcs through other wet foes', JSON.stringify(el));
  R.ok(el.shat > el.plain * 1.8, 'frozen + heavy blow: shatter', JSON.stringify(el));
  R.ok(el.spread, 'fire + wind: a gusty hit spreads the flames to a neighbour', JSON.stringify(el));

  // ---------------------------------------------------------------- armour sets
  const sets = await page.evaluate(() => {
    const g = window.__game, inv = g.inv, I = window.__items;
    const base = g.pstats.abilityDmg;
    const pieces = ['cw_helm', 'cw_chest', 'cw_arms', 'cw_legs', 'cw_boots'].map(id => I.makeNamed(id, 8));
    const slots = [];
    for (const it of pieces.slice(0, 2)) { inv.bag.push(it); g.equipItem(inv.bag.length - 1); slots.push(it.slot); }
    const two = { tier: g.pstats.setBonus.cinderwoven, abil: g.pstats.abilityDmg - base };
    for (const it of pieces.slice(2)) { inv.bag.push(it); g.equipItem(inv.bag.length - 1); slots.push(it.slot); }
    return { two, full: g.pstats.setBonus.cinderwoven, slots, filled: ['head', 'chest', 'arms', 'legs', 'boots'].every(k => inv.equip[k]) };
  });
  R.ok(sets.two.tier === 2 && sets.two.abil >= 12 && sets.full === 5 && sets.filled, 'Cinderwoven: 2-piece and full-set bonuses; every armour slot fills', JSON.stringify(sets));
}
