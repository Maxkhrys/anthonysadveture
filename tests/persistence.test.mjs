// Real browser/game integration: migration, title selection, death, reload, new class.
export default async function (page, R) {
  const reload = async () => {
    await page.reload();
    await page.waitForFunction(() => window.__game && !document.getElementById('loading'));
  };
  await page.evaluate(async () => {
    const { defaultInventory } = await import('/src/persistence/model.js');
    const { starterWeapon } = await import('/src/rpg/items.js');
    const inv = defaultInventory(); inv.equip.weapon = starterWeapon('samurai');
    delete inv.equip.weapon.itemInstanceId;
    inv.level = 6; inv.xp = 73; inv.coins = 321; inv.skills = [3, 1, 1];
    inv.equip.weapon.craft = 'thornrebuke'; inv.equip.weapon.upgradeLevel = 4;
    inv.mats.shard = 12; inv.recipes = ['thornrebuke'];
    localStorage.setItem('mossling-save-v2', JSON.stringify({ inv, flags: { stage: 4, introFought: true, q_mill: 2, riftBest: 8, 'rested:village': true }, checkpoint: { area: 'overworld', spawn: 'village' }, playTime: 720, stats: {} }));
  });
  await reload();
  R.ok(await page.locator('#title-menu').textContent().then(t => t.includes('Mossling · samurai · Lv 6')), 'migrated profile appears in title save menu');
  await page.locator('#title-menu div').filter({ hasText: 'Mossling · samurai · Lv 6' }).click();
  await page.waitForFunction(() => window.__game.profile);
  const first = await page.evaluate(async () => {
    const g = window.__game;
    const { genItem } = await import('/src/rpg/items.js');
    const item = genItem({ developer:true, slot: 'helm', rarity: 2, level: 4 });
    g.pickupItem(item); g.equipItem(g.inv.bag.length - 1);
    g.rest(g.entities.find(e => e.constructor.name === 'Bellstone'));
    g.time = 250; g.inv.hp = 0; g.onPlayerDeath(); await g.save();
    return { id: g.profile.id, weapon: g.inv.equip.weapon.itemInstanceId, head: item.itemInstanceId };
  });
  await reload(); await page.evaluate(() => window.__start(false));
  const loaded = await page.evaluate(() => {
    const g = window.__game;
    return { id: g.profile.id, cls: g.inv.cls, level: g.inv.level, xp: g.inv.xp, head: g.inv.equip.helm.itemInstanceId,
      weapon: g.inv.equip.weapon.itemInstanceId, upgrade: g.inv.equip.weapon.upgradeLevel, craft: g.inv.equip.weapon.craft,
      shard: g.inv.mats.shard, quest: g.flags.q_mill, dungeon: g.flags.riftBest, deaths: g.stats.deaths,
      bellstones: g.unlockedBellstones(), time: g.time, hp: g.inv.hp };
  });
  R.ok(loaded.id === first.id && loaded.weapon === first.weapon && loaded.head === first.head, 'item and character identities persist through real reload');
  R.ok(loaded.cls === 'samurai' && loaded.level === 6 && loaded.xp === 73, 'traditional XP and class preserved');
  R.ok(loaded.upgrade === 4 && loaded.craft === 'thornrebuke' && loaded.shard === 12, 'reinforcement and crafting persist');
  R.ok(loaded.quest === 2 && loaded.dungeon === 8 && loaded.deaths === 1 && loaded.hp > 0, 'death retains quests/dungeon/gear and restores life on continue');
  R.ok(loaded.bellstones.some(b => b.id === 'overworld:village') && loaded.time >= 250, 'Bellstone discovery and world time persist');
  const display = await page.evaluate(async () => {
    const g = window.__game;
    const { gearVisual } = await import('/src/hero.js');
    const visual = gearVisual(g.inv.equip);
    g.ui.openInventory();
    g.ui.doll.frame(1 / 60);
    const result = {
      head: visual.head?.itemInstanceId,
      slots: g.ui.dollSlots().length,
      canvas: !!document.querySelector('#paperdoll canvas'),
      playerGear: typeof g.player.m.setGear === 'function',
    };
    g.ui.closeInventory();
    return result;
  });
  R.ok(display.head === first.head && display.slots === 9, 'Claude equipment display reads migrated gear and all nine profile slots');
  R.ok(display.canvas && display.playerGear, 'Claude paper doll and equipped hero rendering work after reload');
  await reload();
  await page.evaluate(() => { window.__game.story.opening = () => {}; });
  await page.locator('#title-menu div').filter({ hasText: /^New Character$/ }).click();
  await page.locator('[data-category="Class"]').click();
  await page.locator('[data-class="archer"]').click();
  await page.locator('[data-action="next"]').click();
  await page.locator('#creator-name').fill('Rowan');
  await page.locator('[data-action="next"]').click();
  await page.waitForFunction(() => window.__game.profile?.name === 'Rowan');
  R.ok(await page.evaluate(() => window.__game.inv.cls === 'archer'), 'name/class creation flow creates an archer');
  await reload();
  const menu = await page.locator('#title-menu').textContent();
  R.ok(menu.includes('Mossling · samurai · Lv 6') && menu.includes('Rowan · archer · Lv 1'), 'both classes coexist in save menu');
  await page.locator('#title-menu div').filter({ hasText: 'Mossling · samurai · Lv 6' }).click();
  await page.waitForFunction(() => window.__game.profile?.classId === 'samurai');
  R.ok(await page.evaluate(id => window.__game.inv.equip.weapon.itemInstanceId === id, first.weapon), 'selecting the original character retains its inventory');
  for (let i = 0; i < 3; i++) { await reload(); await page.evaluate(() => window.__start(false)); }
  R.ok(await page.evaluate(() => window.__game.saveProvider.loadCharacters().length === 2), 'repeated reload/update simulation preserves both profiles');
}
