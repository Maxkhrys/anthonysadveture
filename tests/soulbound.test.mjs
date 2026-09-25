// The Soulbound: class select, a new character, the four-lash SoulChain combo and Soul
// Echoes, every ability (Soul Hook both ways, Veilshift, the spenders, spirits and wards),
// the charged whirl, the skill tree, saves, and the other three classes still intact.
import { sim, fresh, HX, HZ } from './lib.mjs';

const ring = (page, n, kind = 'blot', o = {}) => page.evaluate(([n, kind, o]) => {
  const g = window.__game, p = g.player;
  for (const e of g.entities) if (e.isEnemy) e.remove();
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (o.spread ?? 1.2) * (i - (n - 1) / 2), d = o.d ?? 1.8;
    const e = g.spawnEnemy(kind, p.x + Math.sin(p.facing + a) * d, p.z + Math.cos(p.facing + a) * d, { noRoom: true });
    e.spawnT = 0; e.hp = e.maxHp = o.hp ?? 1e6; e.think = () => [0, 0]; e.obj.scale.setScalar(1); if (o.elite) g.makeElite(e);
    out.push(e.x.toFixed(2) + ',' + e.z.toFixed(2));
  }
  return out;
}, [n, kind, o]);
const state = page => page.evaluate(() => { const g = window.__game, p = g.player; return { st: p.state, combo: p.combo, res: g.res, x: p.x, z: p.z, fam: p.family, hp: g.entities.filter(e => e.isEnemy && !e.dead).map(e => Math.round(e.maxHp - e.hp)) }; });
const at = (page, x, z) => page.evaluate(([x, z]) => { const g = window.__game, p = g.player; p.x = x; p.z = z; p.facing = 0; p.setState('move'); g.snapCamera(); }, [x, z]);

export default async function (page, R) {
  // ---------------------------------------------------------------- class select
  const cards = await page.evaluate(() => { const g = window.__game; let picked = null; g.ui.classSelect(g.input, c => { picked = c; }); const t = [...document.querySelectorAll('#classcards .ccard h3')].map(h => h.textContent); const tag = document.querySelector('#classcards .tagline')?.textContent; document.querySelectorAll('#classcards .ccard')[3].click(); document.querySelectorAll('#classcards .ccard')[3].click(); return { t, tag, picked }; });
  R.ok(cards.t.length === 4 && cards.t[3] === 'Soulbound' && cards.picked === 'soulbound', 'the class select offers the Soulbound as a fourth card and picks it', JSON.stringify(cards));
  R.ok(/Between life and death/.test(cards.tag || ''), 'the card carries the tagline');

  // ---------------------------------------------------------------- a new character
  await fresh(page, 'soulbound', { stage: 1, level: 1 });
  const born = await page.evaluate(() => { const g = window.__game, inv = g.inv, p = g.player; return { cls: inv.cls, w: inv.equip.weapon && inv.equip.weapon.base, kind: inv.equip.weapon && inv.equip.weapon.kind, fam: p.family, tree: inv.tree, load: inv.loadout, res: window.__game.ui && document.getElementById('resbar').classList.contains('echo'), kit: !!p.kit, pips: document.querySelectorAll('#resbar .pips i').length, name: document.querySelector('#hero-plaque b')?.textContent }; });
  R.ok(born.cls === 'soulbound' && born.w === 'tetherchain' && born.kind === 'chain' && born.fam === 'chain', 'a new Soulbound starts with a Tether Chain (SoulChain family)', JSON.stringify(born));
  R.ok(born.tree.soulhook === 1 && born.load[0] === 'soulhook', 'Soul Hook is granted free at level 1 and slotted', JSON.stringify(born.load));
  R.ok(born.kit && born.res && born.pips === 5, 'the class kit is built and the resource globe shows five Echo pips');

  // ---------------------------------------------------------------- the four-lash combo and Echoes
  await page.evaluate(() => { window.__game.res = 0; });
  await at(page, 148.5, 134.5);
  await ring(page, 3, 'blot', { d: 1.9, spread: 0.7 });
  const combo = await page.evaluate(() => {
    const g = window.__game, p = g.player, seen = new Set(), maxLen = [0, 0, 0, 0, 0];
    p.aimSrc = 'keys'; g.noRender = true;
    for (let f = 0; f < 90; f++) { window.__sim(1, f % 5 === 0 ? ['KeyC'] : []); if (p.state === 'lash') { seen.add(p.combo); if (p.lashVis) maxLen[p.combo] = Math.max(maxLen[p.combo], p.lashVis.len); } }
    g.noRender = false;
    const vis = p.kit.rig.visible;
    return { seen: [...seen], res: g.res, maxLen: maxLen.map(v => +v.toFixed(2)), dmg: g.entities.filter(e => e.isEnemy).map(e => Math.round(e.maxHp - e.hp)), vis, echoes: g.stats.echoes || 0 };
  });
  R.ok(combo.seen.join() === '1,2,3,4', 'tapping attack runs the full four-lash combo (lash, reverse lash, piercing strike, spectral sweep)', JSON.stringify(combo));
  R.ok(combo.maxLen[1] > 2.2 && combo.maxLen[3] > combo.maxLen[1], 'the chain visibly extends to its reach, furthest on the piercing strike', JSON.stringify(combo.maxLen));
  R.ok(combo.dmg.every(d => d > 0), 'the lashes land on the foes in front', JSON.stringify(combo.dmg));
  R.ok(combo.res >= 40 && combo.echoes >= 2, 'landed lashes gather Soul Echoes (the finisher a whole one)', 'res ' + combo.res);
  R.ok(combo.vis, 'the live chain rig is drawn');

  // Echoes cap at five and the motes show them
  const cap = await page.evaluate(() => { const g = window.__game, p = g.player; const S = window.__sb; for (let i = 0; i < 9; i++) S.gainEcho(g, 1); g.render(0.05); window.__sim(20); return { res: g.res, motes: p.kit.motes.filter(m => m.s > 0.8).length }; });
  R.ok(cap.res === 100 && cap.motes === 5, 'Soul Echoes cap at five, and five spirit motes orbit the Soulbound', JSON.stringify(cap));
  // ...and drift away once the fight is over
  const fade = await page.evaluate(() => { const g = window.__game, p = g.player; for (const e of g.entities) if (e.isEnemy) e.remove(); p.combatT = 0; g.noRender = true; window.__sim(60 * 6); g.noRender = false; return g.res; });
  R.ok(fade < 100, 'out of combat, gathered Echoes slowly drift away', 'res ' + fade.toFixed(1));

  // the charged whirl: hold attack after the first lash
  await page.evaluate(() => { window.__game.inv.level = 20; window.__game.inv.sp = 60; window.__game.recalc(); });
  await at(page, 148.5, 134.5);
  await ring(page, 4, 'blot', { d: 2.1, spread: 1.4 });
  const whirl = await page.evaluate(() => {
    const g = window.__game, p = g.player, seen = new Set(); g.noRender = true;
    const d0 = g.entities.filter(e => e.isEnemy).map(e => Math.hypot(e.x - p.x, e.z - p.z));
    for (let f = 0; f < 110; f++) { window.__sim(1, f < 70 ? ['KeyC'] : []); seen.add(p.state); }
    window.__sim(30); g.noRender = false;
    const d1 = g.entities.filter(e => e.isEnemy).map(e => Math.hypot(e.x - p.x, e.z - p.z));
    return { seen: [...seen], hit: g.entities.filter(e => e.isEnemy && e.hp < e.maxHp).length, pulled: d1.reduce((a, b) => a + b, 0) < d0.reduce((a, b) => a + b, 0) - 0.3 };
  });
  R.ok(whirl.seen.includes('charge') && whirl.seen.includes('spin') && whirl.hit === 4 && whirl.pulled, 'holding attack winds the chain; the release whirls it round, striking and drawing in every foe', JSON.stringify(whirl));

  // ---------------------------------------------------------------- abilities
  // unlock every active (dev-style) and cast each through the real input path
  await page.evaluate(() => { const g = window.__game, inv = g.inv, S = window.__skills; for (let pass = 0; pass < 6; pass++) for (const n of S.treeOf(inv.cls)) if (n.skill && !S.rankOf(inv, n.id)) { for (const q of n.req) if (!S.rankOf(inv, q)) S.spendNode(inv, q); S.spendNode(inv, n.id); } g.recalc(); });
  const cast = async (id, setup, frames = 90) => {
    await at(page, 148.5, 134.5);
    await page.evaluate(([id]) => { const g = window.__game, inv = g.inv, S = window.__skills; inv.loadout[0] = null; S.setLoadout(inv, 0, id); g.player.cdMap = {}; g.player.aimSrc = 'keys'; }, [id]);
    if (setup) await setup();
    return page.evaluate(([id, frames]) => {
      const g = window.__game, p = g.player, st = new Set();
      const foes0 = g.entities.filter(e => e.isEnemy && !e.dead).map(e => ({ e, x: e.x, z: e.z, hp: e.hp }));
      const x0 = p.x, z0 = p.z, res0 = g.res; g.noRender = true;
      const shots = () => g.entities.filter(e => e.constructor.name === 'Projectile' && !e.dead).length;
      window.__sim(1, ['Digit1']);
      let inv = false, maxEnt = 0;
      for (let f = 0; f < frames; f++) { window.__sim(1); st.add(p.state); if (p.invuln > 0) inv = true; maxEnt = Math.max(maxEnt, shots()); }
      g.noRender = false;
      return { cast: (g.stats['cast:' + id] || 0) > 0, states: [...st], moved: +Math.hypot(p.x - x0, p.z - z0).toFixed(2), res0, res: g.res, inv, spawned: maxEnt,
        foes: foes0.map(f => ({ moved: +Math.hypot(f.e.x - f.x, f.e.z - f.z).toFixed(2), dmg: Math.round(f.hp - (f.e.dead ? 0 : f.e.hp)), rooted: !!(f.e.status && f.e.status.root > 0), marked: !!(f.e.status && f.e.status.mark > 0), toP: +Math.hypot(f.e.x - p.x, f.e.z - p.z).toFixed(2) })) };
    }, [id, frames]);
  };

  const hookSmall = await cast('soulhook', () => ring(page, 1, 'blot', { d: 5 }), 60);
  R.ok(hookSmall.cast && hookSmall.foes[0].moved > 2.5 && hookSmall.foes[0].toP < 1.8 && hookSmall.moved < 0.6 && hookSmall.foes[0].dmg > 0, 'Soul Hook yanks a small foe to your feet', JSON.stringify(hookSmall));
  R.ok(hookSmall.res > hookSmall.res0 || hookSmall.res >= 100, 'a catch gathers a Soul Echo', `${hookSmall.res0} → ${hookSmall.res}`);
  const hookBig = await cast('soulhook', () => ring(page, 1, 'blot', { d: 5, elite: true }), 60);
  R.ok(hookBig.cast && hookBig.moved > 2.5 && hookBig.foes[0].moved < 1.0 && hookBig.foes[0].dmg > 0, 'Soul Hook on a large foe pulls YOU to it, landing with a cut', JSON.stringify(hookBig));

  await page.evaluate(() => { window.__game.res = 20; });
  const veil = await cast('veilshift', () => ring(page, 1, 'blot', { d: 2.5 }), 40);
  const behind = await page.evaluate(() => { const g = window.__game, p = g.player, e = g.entities.find(e => e.isEnemy && !e.dead); return e ? p.z > e.z : false; });
  R.ok(veil.cast && veil.states.includes('veil') && veil.inv && behind, 'Veilshift passes through the Veil and reappears behind the foe', JSON.stringify(veil));
  R.ok(veil.res === 0 && veil.foes[0].dmg > 0, 'holding an Echo, Veilshift spends it on a guaranteed-crit emergence cut', JSON.stringify(veil.foes));

  await page.evaluate(() => { window.__game.res = 100; });
  const rend = await cast('echorend', () => ring(page, 3, 'blot', { d: 2.2, spread: 0.12 }), 80);
  R.ok(rend.cast && rend.res === 0 && rend.foes.every(f => f.dmg > 0), 'Echo Rend spends every Echo, and echo lashes follow the real one', JSON.stringify(rend));

  await page.evaluate(() => { window.__game.res = 60; });
  const volley = await cast('spiritvolley', () => ring(page, 3, 'blot', { d: 4, spread: 0.5 }), 120);
  R.ok(volley.cast && volley.res === 0 && volley.spawned >= 3 && volley.foes.some(f => f.dmg > 0), 'Echo Release frees one seeking spirit per Echo', JSON.stringify(volley));

  await page.evaluate(() => { window.__game.res = 100; });
  const coil = await cast('reapingcoil', () => ring(page, 4, 'blot', { d: 3.2, spread: 1.0 }), 60);
  R.ok(coil.cast && coil.foes.every(f => f.dmg > 0) && coil.foes.every(f => f.moved > 0.5), 'Reaping Coil drags the ring of foes in and cuts them', JSON.stringify(coil));

  await page.evaluate(() => { window.__game.res = 100; });
  const seal = await cast('bindingseal', () => ring(page, 3, 'blot', { d: 3, spread: 0.3 }), 20);
  R.ok(seal.cast && seal.foes.every(f => f.rooted && f.marked && f.dmg > 0), 'Binding Seal chains a foe and its neighbours: bound, marked and cut', JSON.stringify(seal));

  await page.evaluate(() => { window.__game.res = 100; });
  const rift = await cast('veilrift', async () => { await ring(page, 3, 'blot', { d: 4.5, spread: 0.25 }); await page.evaluate(() => { const g = window.__game; g.input.mouseAim = false; }); }, 50);
  R.ok(rift.cast && rift.states.includes('rift') && rift.moved > 2 && rift.foes.some(f => f.dmg > 0), 'Veil Rift: vanish, and step out where you aimed in a spectral sweep', JSON.stringify(rift));

  await page.evaluate(() => { window.__game.res = 100; });
  const fox = await cast('kindred', () => ring(page, 2, 'blot', { d: 3.5 }), 200);
  const foxAlive = await page.evaluate(() => window.__game.entities.some(e => e.isKindred && !e.dead));
  R.ok(fox.cast && foxAlive && fox.foes.some(f => f.dmg > 0), 'Kindred Lantern: a lantern-fox spirit answers and bites', JSON.stringify(fox));

  await page.evaluate(() => { window.__game.res = 100; });
  const ward = await cast('ancestorward', null, 10);
  const blocked = await page.evaluate(() => {
    const g = window.__game, p = g.player, e = g.spawnEnemy('blot', p.x, p.z + 1.2, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e6;
    const hp0 = g.inv.hp, n0 = p.wards.length; const r = p.hurt({ dmg: 5, x: e.x, z: e.z, src: e });
    return { r, n0, n1: p.wards.length, hp0, hp1: g.inv.hp, hit: e.hp < e.maxHp };
  });
  R.ok(ward.cast && blocked.n0 === 3 && blocked.r === 'block' && blocked.n1 === 2 && blocked.hp1 === blocked.hp0 && blocked.hit, 'Warden Spirits: one catches the blow and answers the attacker', JSON.stringify(blocked));

  // ---------------------------------------------------------------- tree, save, and the others
  const tree = await page.evaluate(() => { const S = window.__skills; const t = S.treeOf('soulbound'); return { nodes: t.length, actives: t.filter(n => n.skill).length, keys: t.filter(n => n.type === 'key').map(n => n.id), paths: S.PATHS.soulbound.map(p => p.name) }; });
  R.ok(tree.nodes >= 20 && tree.actives === 9 && tree.keys.length === 3, 'three paths, nine abilities and three keystones', JSON.stringify(tree));
  const saved = await page.evaluate(async () => { const g = window.__game; await g.save(); const raw = JSON.parse(localStorage.getItem('mossling-save-v2')); const c = raw.characters.find(c => c.classId === 'soulbound'); return { found: !!c, w: c && c.inventory.equip.weapon && c.inventory.equip.weapon.base }; });
  R.ok(saved.found && saved.w, 'a Soulbound saves like any other character', JSON.stringify(saved));

  for (const cls of ['samurai', 'archer', 'witch']) {
    await fresh(page, cls, { stage: 1, level: 3 });
    const o = await page.evaluate(() => { const g = window.__game, p = g.player; for (const e of g.entities) if (e.isEnemy) e.remove(); const e = g.spawnEnemy('blot', p.x, p.z + 1.3, { noRoom: true }); e.spawnT = 0; e.hp = e.maxHp = 1e6; e.think = () => [0, 0]; p.facing = 0; p.aimSrc = 'keys'; g.noRender = true; for (let f = 0; f < 40; f++) window.__sim(1, f % 8 === 0 ? ['KeyC'] : []); g.noRender = false; return { fam: p.family, kit: !!p.kit, hit: e.hp < e.maxHp }; });
    R.ok(o.hit && !o.kit && o.fam !== 'chain', `${cls} still fights as before (no Soulbound kit)`, JSON.stringify(o));
  }
}
