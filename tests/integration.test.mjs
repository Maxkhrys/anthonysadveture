import { fresh, sim } from './lib.mjs';

export default async function (page, R) {
  await fresh(page, 'samurai');
  await page.keyboard.press('Backquote');
  R.ok(await page.locator('#dev-console-input').evaluate(e => e === document.activeElement), 'console opens with keyboard focus');
  const before = await page.evaluate(() => [window.__game.player.x, window.__game.player.z]);
  await page.locator('#dev-console-input').fill('wasd');
  await page.keyboard.down('w'); await sim(page, 10); await page.keyboard.up('w');
  const after = await page.evaluate(() => [window.__game.player.x, window.__game.player.z]);
  R.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < 0.01, 'typing in console does not move hero');
  await page.keyboard.press('Escape');
  R.ok(await page.evaluate(() => !window.__game.input.paused), 'closing console restores gameplay input');
  const phase = await page.evaluate(async () => {
    const g = window.__game;
    window.__dev.execute('/time night');
    const night = g.isNight;
    window.__dev.execute('/time day');
    const day = !g.isNight;
    window.__dev.execute('/time night');
    await g.save();
    return { night, day };
  });
  R.ok(phase.night && phase.day, 'developer day/night commands drive persisted clock and visual atmosphere');
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'));
  await page.evaluate(() => window.__start(false));
  R.ok(await page.evaluate(() => window.__game.isNight), 'night survives save and reload');
  await page.evaluate(() => window.__dev.execute('/devroom'));
  await page.waitForFunction(() => window.__game.area.id === 'devroom' && !window.__game.transitioning);
  R.ok(await page.evaluate(() => window.__game.entities.some(e => e.constructor.name === 'DevTrainingDummy')), 'dev room loads with training dummy');
  const gear = await page.evaluate(async () => {
    const g = window.__game;
    window.__dev.execute('/rollweapon prismatic');
    const it = g.inv.bag.at(-1);
    g.ui.openInventory();
    g.ui.invSel = g.inv.bag.length - 1; g.ui.renderInventory();
    const tooltip = document.getElementById('tooltip').textContent;
    g.equipItem(g.inv.bag.length - 1);
    await g.save();
    const result = { tier: tooltip.includes('Prismatic'), id: it.itemInstanceId, slots: g.ui.dollSlots().length, canvas: !!document.querySelector('#paperdoll canvas') };
    g.ui.closeInventory();
    return result;
  });
  R.ok(gear.tier && gear.canvas && gear.slots === 9 && gear.id, 'affix tooltip, nine slots and paper doll coexist with stable item identity');
  await page.evaluate(() => window.__game.entities.find(e => e.constructor.name === 'DevReturnPortal').interact());
  await page.waitForFunction(() => window.__game.area.id === 'overworld' && !window.__game.transitioning);
  R.ok(await page.evaluate(() => { const g = window.__game, p = g.devRoomPrevLocation.spawn; return Math.hypot(g.player.x - p.x, g.player.z - p.z) < 0.1; }), 'dev return portal restores previous coordinates');
}
