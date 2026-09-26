// World pass: the two new regions played through the real game. Getting in and out, both side
// quests start to finish, the shortcuts they open, the discovery card (once, and respecting the
// setting), the map waypoint, and that all of it survives a reload.
import { sim, fresh, talkThrough } from './lib.mjs';

const arrive = async (page, area, spawn) => {
  await page.evaluate(([a, s]) => window.__game.warpTo(a, s), [area, spawn]);
  await page.waitForFunction(a => window.__game.area.id === a && !window.__game.transitioning, area, { timeout: 20000 });
  await sim(page, 4);
};
const talkTo = async (page, id) => {
  await page.evaluate(i => { const g = window.__game, n = g.entities.find(e => e.id === i); g.player.x = n.x; g.player.z = n.z + 1.2; g.story.talk(n); }, id);
  await talkThrough(page, 30); await sim(page, 4);
};
const clearFoes = page => page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy) e.remove(); g.player.combatT = 0; });

export default async function (page, R) {
  await fresh(page, 'archer', { stage: 3, level: 9 });
  await page.evaluate(() => { window.__game.godMode = true; });

  // ---------------------------------------------------------------- the ways in
  const gates = await page.evaluate(() => {
    const g = window.__game, a = g.area, w = to => a.defs.find(d => d.type === 'warp' && d.to === to);
    return { clock: !!w('clockwork'), root: !!w('rootlight'), spawns: ['clockgate', 'rootmouth', 'rootlift'].filter(s => a.spawns[s]) };
  });
  R.ok(gates.clock && gates.root && gates.spawns.length === 3, 'Lanternreach has the Clockwork Gate, the Rootlight Mouth and the Root Lift landing', JSON.stringify(gates));

  // ---------------------------------------------------------------- THE CLOCKWORK GARDEN
  await arrive(page, 'clockwork', 'gate');
  await page.evaluate(() => { const g = window.__game; g.revealWait = 0; });
  await clearFoes(page); await sim(page, 30);
  const card = await page.evaluate(() => { const el = document.getElementById('region-reveal'); return { shown: !!el && /show/.test(el.className), text: el && el.textContent, found: window.__game.world6.discovery.regions.includes('clockwork') }; });
  R.ok(card.found && card.shown && /Clockwork Garden/.test(card.text), 'entering the Clockwork Garden shows its discovery card and marks it found', JSON.stringify(card));
  const back = await page.evaluate(() => { const a = window.__game.area, w = a.defs.find(d => d.type === 'warp' && d.to === 'overworld'); return w && w.spawn; });
  R.ok(back === 'clockgate', 'the Gatehouse Lawn leads back out to the Clockwork Gate', back);

  await talkTo(page, 'pim');
  R.ok(await page.evaluate(() => window.__game.flags.q_clock === 1), 'Cogsworth Pim gives "Wind the Old Clock"');
  const marks = await page.evaluate(() => window.__game.story.markers().filter(m => m.name === 'Winding lever').length);
  R.ok(marks === 3, 'the map marks all three winding levers', marks);

  // the Belfry lever is caged until the bells ring quarter, hour, half
  const cage = await page.evaluate(() => { const g = window.__game, d = g.entities.find(e => e.id === 'cg-bellcage'); return d && d.isOpen(); });
  R.ok(cage === false, 'the Belfry lever starts behind its bell cage');
  const rung = await page.evaluate(async () => {
    const g = window.__game, bells = g.entities.filter(e => e.group === 'cg.bells' && e.pitch !== undefined).sort((a, b) => a.pitch - b.pitch);
    for (const i of [2, 0, 1]) { bells[i].ring(); window.__sim(30); }
    await new Promise(r => setTimeout(r, 800));
    return { n: bells.length, bells: g.signal('w7:cg.bells') };
  });
  R.ok(rung.n === 3 && rung.bells, 'striking the bells quarter, hour, half opens the cage', JSON.stringify(rung));

  const lev = await page.evaluate(async () => {
    const g = window.__game;
    for (const id of ['A', 'B', 'C']) { const e = g.entities.find(e => e.d && e.d.type === 'gearlever' && e.d.id === id); e.interact(); }
    await new Promise(r => setTimeout(r, 1300)); window.__sim(30);
    const door = g.entities.find(e => e.id === 'cg-mainspring');
    return { wound: g.signal('w7:cg.wound'), open: door && door.isOpen() };
  });
  R.ok(lev.wound && lev.open, 'three levers wind the Great Clock and open the Mainspring Gate shortcut', JSON.stringify(lev));
  const wick = await page.evaluate(() => { const g = window.__game; g.entities.find(e => e.d && e.d.type === 'wicket7').interact(); window.__sim(20); return g.entities.find(e => e.id === 'cg-wicket').isOpen(); });
  R.ok(wick, 'lifting the wicket latch opens the court-to-Gearhouse shortcut');

  await talkTo(page, 'pim');
  const done1 = await page.evaluate(() => { const g = window.__game; return { q: g.flags.q_clock, gear: g.entities.some(e => e.constructor.name === 'GearDrop') }; });
  R.ok(done1.q === 2 && done1.gear, 'Pim finishes the quest and pays out gear', JSON.stringify(done1));
  const cls = await page.evaluate(() => { const g = window.__game, d = g.entities.find(e => e.constructor.name === 'GearDrop' && e.item && e.item.slot === 'weapon'); return d ? { cls: d.item.cls, me: g.inv.cls } : null; });
  R.ok(!cls || !cls.cls || cls.cls === cls.me, 'the quest weapon suits the class that earned it', JSON.stringify(cls));

  // the Undercroft mini-dungeon is reachable and leads back to the garden
  await arrive(page, 'undercroft', 'entrance');
  const uc = await page.evaluate(() => { const a = window.__game.area, w = a.defs.find(d => d.type === 'warp' && d.to === 'clockwork'); return !!w; });
  R.ok(uc, 'the Clockwork Undercroft opens from the Gearhouse and exits to the garden');

  // ---------------------------------------------------------------- THE ROOTLIGHT CAVERNS
  await page.evaluate(() => { window.__game.settings.discovery = 'subtle'; });
  await arrive(page, 'rootlight', 'mouth');
  await page.evaluate(() => { window.__game.revealWait = 0; });
  await clearFoes(page); await sim(page, 30);
  const sub = await page.evaluate(() => { const el = document.getElementById('region-reveal'); return { card: !!el && /show/.test(el.className), found: window.__game.world6.discovery.regions.includes('rootlight') }; });
  R.ok(sub.found && !sub.card, 'with discovery set to subtle there is no big card, and the caverns are still recorded', JSON.stringify(sub));
  await page.evaluate(() => { window.__game.settings.discovery = 'full'; });

  const curtain0 = await page.evaluate(() => window.__game.entities.find(e => e.id === 'rl-curtain').isOpen());
  await talkTo(page, 'mira');
  R.ok(await page.evaluate(() => window.__game.flags.q_bloom === 1) && curtain0 === false, 'Mira gives "Wake the Glowcaps"; the root curtain starts closed');
  const lift0 = await page.evaluate(() => { const g = window.__game; return g.signal('w7:rootlift'); });
  const blooms = await page.evaluate(async () => {
    const g = window.__game, bs = g.entities.filter(e => e.isBloom);
    bs[0].onHit({}); for (const b of bs.slice(1)) b.interact();
    await new Promise(r => setTimeout(r, 1000)); window.__sim(30);
    return { n: bs.length, lit: g.signal('w7:rl.lit'), open: g.entities.find(e => e.id === 'rl-curtain').isOpen() };
  });
  R.ok(blooms.n === 3 && blooms.lit && blooms.open, 'striking or touching the three blooms relights the route and parts the root curtain', JSON.stringify(blooms));
  await talkTo(page, 'mira');
  R.ok(await page.evaluate(() => window.__game.flags.q_bloom === 2), 'Mira finishes "Wake the Glowcaps"');

  // the Root Lift: pulled from below, it lands you in Thimblewick's Hedge Garden
  await page.evaluate(() => { const g = window.__game, l = g.entities.find(e => e.d && e.d.type === 'rootlift'); g.player.x = l.x; g.player.z = l.z; l.interact(); });
  await page.waitForFunction(() => window.__game.area.id === 'overworld' && !window.__game.transitioning, null, { timeout: 20000 });
  await sim(page, 4);
  const up = await page.evaluate(() => { const g = window.__game, p = g.player; return { lift: g.signal('w7:rootlift'), place: g.area.placeAt(p.x, p.z).name }; });
  R.ok(!lift0 && up.lift && up.place === 'Thimblewick', 'the Root Lift carries you up into Thimblewick and stays open as a shortcut', JSON.stringify(up));
  await page.evaluate(() => { const g = window.__game, l = g.entities.find(e => e.d && e.d.type === 'rootlift'); l.interact(); });
  await page.waitForFunction(() => window.__game.area.id === 'rootlight' && !window.__game.transitioning, null, { timeout: 20000 });
  R.ok(true, 'and the lift goes back down from the garden');

  // ---------------------------------------------------------------- waypoint + journal
  await arrive(page, 'overworld', 'village');
  const wp = await page.evaluate(() => {
    const g = window.__game, ui = g.ui, L = g.area.landmarks.find(l => l.id === 'clockgate') || { x: 186.5, z: 117.6, name: 'The Clockwork Gate' };
    ui.onAtlasPick({ x: L.x, z: L.z, name: L.name });
    document.querySelector('#atlas-waypoint [data-wp="set"]')?.click();
    window.__sim(2); ui.drawMini && ui.drawMini();
    return { wp: g.flags['w7:waypoint'], marker: g.story.markers().some(m => m.waypoint), cap: document.getElementById('map-caption')?.textContent || '' };
  });
  R.ok(wp.wp && wp.marker && /waypoint \d+ tiles/.test(wp.cap), 'a place picked in the atlas becomes a waypoint with a marker and a distance', JSON.stringify(wp));
  const jr = await page.evaluate(() => window.__game.story.journal());
  R.ok(/Wind the Old Clock/.test(jr) && /Wake the Glowcaps/.test(jr) && /Places discovered/.test(jr), 'the journal lists both quests and the places discovered');

  // ---------------------------------------------------------------- it all survives a reload, and cards never repeat
  await page.evaluate(() => { window.__game.save(); });
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 30000 });
  await page.evaluate(() => window.__start(false)); await sim(page, 5);
  const kept = await page.evaluate(() => {
    const g = window.__game;
    return { clock: g.flags.q_clock, bloom: g.flags.q_bloom, wound: g.signal('w7:cg.wound'), lit: g.signal('w7:rl.lit'), lift: g.signal('w7:rootlift'), wp: !!g.flags['w7:waypoint'], regions: g.world6.discovery.regions.filter(r => r === 'clockwork' || r === 'rootlight') };
  });
  R.ok(kept.clock === 2 && kept.bloom === 2 && kept.wound && kept.lit && kept.lift && kept.wp && kept.regions.length === 2, 'quests, shortcuts, waypoint and discoveries all survive a reload', JSON.stringify(kept));
  await arrive(page, 'clockwork', 'gate');
  await page.evaluate(() => { window.__game.revealWait = 0; }); await clearFoes(page); await sim(page, 30);
  const again = await page.evaluate(() => (window.__game.revealQ || []).length === 0 && !/show/.test(document.getElementById('region-reveal')?.className || ''));
  R.ok(again, 'going back to a region you already found does not show its card again');
  await page.evaluate(() => { window.__game.godMode = false; });
}
