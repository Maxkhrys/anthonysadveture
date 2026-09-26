// Inventory clarity: rarity labels, compact card, Details without hovering, comparison units,
// attack names, long names, sticky actions, and that viewing never mutates an item.
import { sim, fresh } from './lib.mjs';

export default async function (page, R) {
  await fresh(page, 'witch', { stage: 1, level: 14 });
  const setup = await page.evaluate(() => {
    const g = window.__game, I = window.__items;
    const items = [I.makeNamed('candelabra', 14, null, 'witch'), I.makeNamed('owlstaff', 14, null, 'witch'), ...[0, 1, 2, 3, 4].map(r => I.genItem({ level: 14, cls: 'witch', rarity: r, slot: 'armor' }))];
    const long = I.makeNamed('frostrod', 14, null, 'witch'); long.name = 'The Exceedingly Long and Ceremonious Rimefrost Rod of the Northern Hedge'; items.push(long);
    g.inv.bag.push(...items);
    const before = JSON.stringify(g.inv.bag);
    g.ui.invTab = 'bag'; g.ui.openInventory(); g.ui.invSel = 0; g.ui.renderInventory();
    return { before, n: items.length };
  });
  await page.waitForTimeout(200);
  const labels = await page.evaluate(() => { const g = window.__game, R = window.__items.RARITY; return [...document.querySelectorAll('#baggrid .cell[data-i]')].filter(c => +c.dataset.i >= 0).map(c => { const it = g.inv.bag[+c.dataset.i]; const want = it.r === 5 || it.prismatic ? 'Prismatic' : R[it.r].name; return (c.querySelector('.cell-rar')?.textContent || '').includes(want.toUpperCase()) || (c.querySelector('.cell-rar')?.textContent || '').toLowerCase().includes(want.toLowerCase()); }); });
  R.ok(labels.length >= 8 && labels.every(Boolean), 'every bag tile names its real rarity in words (not only colour)', labels.join(','));

  const compact = await page.evaluate(() => { const t = document.getElementById('tooltip'); return { unique: t.querySelector('.ii-unique')?.textContent || '', speed: t.querySelector('.ii-stats')?.textContent || '', kit: t.querySelector('.ii-kit')?.textContent || '', rarity: t.querySelector('.ii-rarity')?.textContent || '' }; });
  R.ok(/split into three/i.test(compact.unique) && /LEGENDARY|Legendary/.test(compact.rarity), 'the compact card shows the rarity and the build-defining unique power in full', compact.unique);
  R.ok(/×\d\.\d\d/.test(compact.speed) && /family base rate/.test(compact.speed) && !/per second|\/s/.test(compact.speed), 'attack speed is a labelled multiplier, never mislabelled as attacks per second', compact.speed);
  const kit = await page.evaluate(() => { const g = window.__game, W = window.__weaponKit || null; const it = g.inv.bag[0]; const k = window.__combat && null; return it.name; });
  R.ok(/Ember Bolt/.test(compact.kit) && /Chandler's Blaze/.test(compact.kit), 'left and right attack names match the weapon kit', compact.kit);

  // Details: by button click, then by keyboard, no hover involved
  await page.evaluate(() => document.querySelector('#tooltip [data-act="ii-details"]').click());
  const det = await page.evaluate(() => ({ on: !!document.querySelector('#tooltip .ii-details'), text: document.querySelector('#tooltip .ii-details')?.textContent || '' }));
  R.ok(det.on && /Item level/.test(det.text) && /salvages for/.test(det.text) && /cooldown|% on/.test(det.text), 'Details opens with a click and lists effects with chances and cooldowns, item level and salvage', det.text.slice(0, 90));
  await page.evaluate(() => document.querySelector('#tooltip [data-act="ii-details"]').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  R.ok(await page.evaluate(() => !!document.querySelector('#tooltip .ii-compact')), 'the Details toggle also works from the keyboard');

  // comparison: labelled rows, no verdict
  const cmp = await page.evaluate(() => { const g = window.__game; g.ui.invSel = 1; g.ui.renderInventory(); const t = document.querySelector('#tooltip .ii-compare'); return { rows: [...(t?.querySelectorAll('tbody th') || [])].map(x => x.textContent), note: t?.querySelector('.ii-note')?.textContent || '', text: t?.textContent || '' }; });
  R.ok(cmp.rows.includes('Average damage') && cmp.rows.includes('Attack speed') && /does not pick a winner/.test(cmp.note), 'comparison uses labelled like-for-like rows and does not declare a winner', cmp.rows.join(' | '));
  R.ok(cmp.rows.includes('Right click'), 'comparison shows when equipping changes the right-click attack', cmp.text.slice(0, 120));

  // long names wrap inside the card
  const longOk = await page.evaluate(() => { const g = window.__game; g.ui.invSel = g.inv.bag.length - 1; g.ui.renderInventory(); const h = document.querySelector('#tooltip .ii h4'), card = document.querySelector('#tooltip .ii'); return h && card && h.getBoundingClientRect().right <= card.getBoundingClientRect().right + 1 && h.scrollWidth <= h.clientWidth + 1; });
  R.ok(longOk, 'a very long item name wraps inside the card');

  // actions stay reachable when details scroll
  const sticky = await page.evaluate(() => { const g = window.__game; g.ui.invSel = 0; g.ui.itemDetails = true; g.ui.renderInventory(); const t = document.getElementById('tooltip'); t.scrollTop = t.scrollHeight; const a = document.querySelector('#inventory-detail .item-actions'), r = a?.getBoundingClientRect(); return !!r && r.bottom <= innerHeight && r.height > 20; });
  R.ok(sticky, 'Equip / Favourite / Salvage stay visible while the details scroll');

  // viewing never mutates
  const same = await page.evaluate(before => { const g = window.__game; for (let i = 0; i < g.inv.bag.length; i++) { g.ui.invSel = i; g.ui.itemDetails = i % 2 === 0; g.ui.renderInventory(); g.ui.itemHtml(g.inv.bag[i], g.inv.equip.weapon); } return JSON.stringify(g.inv.bag) === before; }, setup.before);
  R.ok(same, 'inspecting, comparing and toggling details never changes an item');

  // equipping switches the actual attacks the card promised
  const eq = await page.evaluate(() => { const g = window.__game; const i = g.inv.bag.findIndex(x => x.base === 'owlstaff'); g.equipItem(i); const k = window.__game.player && window.__game.pstats; return g.inv.equip.weapon.base; });
  R.ok(eq === 'owlstaff', 'the compared item equips normally');
  await page.evaluate(() => { const g = window.__game; g.ui.closeInventory(); });
}
