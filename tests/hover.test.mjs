// Mouse inspection: hover highlights and names things, drops show their tooltip from afar,
// a click within reach picks up / talks instead of swinging, out of reach it only says so.
import { sim, fresh, toSquare } from './lib.mjs';
const OUT = process.env.OUT || '';
const at = (page, x, z, y = 0.3) => page.evaluate(([x, z, y]) => { const g = window.__game; return g.pr.project({ x, y: (g.groundAt ? g.groundAt(x, z) : 0) + y, z }); }, [x, z, y]);
const state = page => page.evaluate(() => { const g = window.__game, h = g.hover, tag = document.getElementById('hover-tag'), tip = document.getElementById('hover-tip');
  return { target: h.target ? (h.target.item ? 'drop:' + h.target.item.name : h.target.name || h.target.constructor.name) : null, tag: tag.classList.contains('hidden') ? '' : tag.textContent, tip: tip.classList.contains('hidden') ? '' : tip.textContent.slice(0, 80), ring: h.ring.visible, pst: g.player.state, bag: g.inv.bag.length, talking: !!g.ui.talking }; });

export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 3, level: 6 }); await toSquare(page);
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.camZoom = 0.8; g.snapCamera(); for (const e of g.entities) if (e.isEnemy) e.remove(); });
  // a Rare drop four tiles away
  const d = await page.evaluate(() => { const g = window.__game, p = g.player, I = window.__items, C = window.__combat; const it = I.makeNamed('moonkatana', 6); it.r = 2; const dr = new C.GearDrop(g, p.x + 3.5, p.z + 0.5, it); dr.t = -99; dr.vx = dr.vz = 0; g.spawn(dr); window.__drop = dr; return { x: dr.x, z: dr.z, name: it.name }; });
  await sim(page, 20);
  const dp = await page.evaluate(() => ({ x: window.__drop.x, z: window.__drop.z }));
  let s = await at(page, dp.x, dp.z); await page.mouse.move(s.x, s.y); await sim(page, 2);
  let h = await state(page);
  R.ok(h.target === 'drop:' + d.name && h.ring, 'hovering a drop highlights it', JSON.stringify(h));
  R.ok(h.tag.includes(d.name) && /Too far/.test(h.tag), 'its name tag shows the item and that it is out of reach', h.tag);
  R.ok(h.tip.includes(d.name), 'the full tooltip is readable from a distance', h.tip);
  if (OUT) await page.screenshot({ path: `${OUT}/hover_drop_far.jpg`, type: 'jpeg', quality: 88 });
  // clicking while out of reach neither picks it up nor swings the sword
  const bag0 = h.bag;
  await page.mouse.down(); await sim(page, 1); await page.mouse.up(); await sim(page, 3);
  h = await state(page);
  R.ok(h.bag === bag0 && h.pst !== 'attack' && !(await page.evaluate(() => window.__drop.dead)), 'out of reach: a click only says "Too far" (no pick-up, no swing)', JSON.stringify(h));
  // walk close, click: it goes into the bag, still no swing
  await page.evaluate(() => { const g = window.__game, p = g.player; p.x = window.__drop.x - 1; p.z = window.__drop.z; g.snapCamera(); });
  await sim(page, 2);
  s = await at(page, dp.x, dp.z); await page.mouse.move(s.x, s.y); await sim(page, 2);
  h = await state(page);
  R.ok(/Click to pick up/.test(h.tag), 'within reach the tag invites a click', h.tag);
  if (OUT) await page.screenshot({ path: `${OUT}/hover_drop_near.jpg`, type: 'jpeg', quality: 88 });
  await page.mouse.down(); await sim(page, 1); await page.mouse.up(); await sim(page, 3);
  h = await state(page);
  R.ok(h.bag === bag0 + 1 && (await page.evaluate(() => window.__drop.dead)) && h.pst !== 'attack', 'within reach a click picks the drop up instead of attacking', JSON.stringify(h));
  // NPCs: name on hover, click to talk
  const npc = await page.evaluate(() => { const g = window.__game, p = g.player; const n = g.entities.filter(e => e.constructor.name === 'NPC').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; p.x = n.x; p.z = n.z + 1.2; p.facing = Math.PI; g.snapCamera(); return { x: n.x, z: n.z, name: n.name }; });
  await sim(page, 3);
  s = await at(page, npc.x, npc.z, 0.4); await page.mouse.move(s.x, s.y); await sim(page, 2);
  h = await state(page);
  R.ok(h.tag.includes(npc.name) && /talk/.test(h.tag), 'hovering an NPC shows their name and "Click to talk"', h.tag);
  if (OUT) await page.screenshot({ path: `${OUT}/hover_npc.jpg`, type: 'jpeg', quality: 88 });
  await page.mouse.down(); await sim(page, 1); await page.mouse.up(); await sim(page, 3);
  h = await state(page);
  R.ok(h.talking, 'clicking a nearby NPC starts the conversation', JSON.stringify(h));
  await page.evaluate(() => { const g = window.__game; g.ui.dialogQ.length = 0; g.ui.typing = null; document.getElementById('dialog').classList.add('hidden'); document.getElementById('shop')?.classList.add('hidden'); });
  await sim(page, 3);
  // enemies: name, level and health on hover; clicking still attacks
  const foe = await page.evaluate(() => { const g = window.__game, p = g.player; p.x = 148.5; p.z = 132.5; p.facing = 0; g.snapCamera(); const e = g.spawnEnemy('blot', p.x, p.z + 1.4, { noRoom: true }); e.spawnT = 0; e.think = () => [0, 0]; e.hp = e.maxHp = 500; return { x: e.x, z: e.z }; });
  await sim(page, 3);
  s = await at(page, foe.x, foe.z, 0.3); await page.mouse.move(s.x, s.y); await sim(page, 2);
  h = await state(page);
  R.ok(/Lv/.test(h.tag) && /Blotling/.test(h.tag), 'hovering an enemy shows its name and level', h.tag);
  if (OUT) await page.screenshot({ path: `${OUT}/hover_enemy.jpg`, type: 'jpeg', quality: 88 });
  await page.mouse.down(); await sim(page, 2); await page.mouse.up(); await sim(page, 1);
  h = await state(page);
  R.ok(h.pst === 'attack', 'clicking an enemy still attacks it', JSON.stringify(h));
  // Alt shows every drop's name on screen
  await page.evaluate(() => { const g = window.__game, p = g.player, I = window.__items, C = window.__combat; for (const e of g.entities) if (e.isEnemy) e.remove(); [['huntbow', 0], ['owlstaff', 3], ['onicleaver', 4]].forEach(([id, r], n) => { const it = I.makeNamed(id, 6); it.r = r; const dr = new C.GearDrop(g, p.x - 2 + n * 2, p.z + 2.2, it); dr.t = -99; dr.vx = dr.vz = 0; g.spawn(dr); }); });
  await sim(page, 15);
  await page.keyboard.down('Alt'); await sim(page, 2);
  const labels = await page.evaluate(() => [...document.querySelectorAll('#drop-labels span')].map(s => s.textContent));
  R.ok(labels.length >= 3, 'holding Alt labels every drop on screen', labels.join(' | '));
  if (OUT) await page.screenshot({ path: `${OUT}/hover_alt_labels.jpg`, type: 'jpeg', quality: 88 });
  await page.keyboard.up('Alt'); await sim(page, 2);
  R.ok(await page.evaluate(() => document.querySelectorAll('#drop-labels span').length === 0), 'releasing Alt hides the labels');
}
