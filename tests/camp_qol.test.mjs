import { fresh } from './lib.mjs';

export default async function(page, R) {
  await fresh(page, 'samurai');
  await page.evaluate(() => {
    const g = __game;
    g.noRender = true;
    const r = g.survivalMode.store.create({ name: 'Camp QoL', cls: 'samurai', seed: 777 });
    g.survivalMode.start(r);
    g.noRender = true;
    g.cutscene = false;
    g.player.combatT = 0;
  });

  const checks = await page.evaluate(async () => {
    const g = __game;
    const m = g.survival;
    const R_rec = m.record;
    const p = g.player;

    // 1. Give ample resources
    R_rec.resources.wood = 50;
    R_rec.resources.fibre = 50;
    R_rec.resources.stone = 50;
    R_rec.resources.crystal = 10;

    // Place a workbench first (needed for bed, brazier, pouch, chest)
    m.craft('workbench', 1);
    m.startBuild('workbench');
    m.build.tx = Math.floor(p.x) + 1; m.build.tz = Math.floor(p.z);
    m.place();

    // Craft and place bedroll
    const craftBed = m.craft('bed', 1);
    const hasBedKit = (R_rec.kits.bed || 0) === 1;
    m.startBuild('bed');
    m.build.tx = Math.floor(p.x) + 1; m.build.tz = Math.floor(p.z) + 1;
    m.place();
    const bedPlaced = g.entities.find(e => e.isStructure && e.type === 'bed');

    // Test sleep during daytime -> rejected
    g.time = 0;
    g.flags.dayOffset = 0;
    g.inv.hp = 10;
    m.sleepInBed(bedPlaced);
    const cantSleepDay = g.inv.hp === 10; // wasn't healed because sleep rejected

    // Test sleep at night -> advances to dawn and heals to maxHp
    g.flags.dayOffset = (0.7 - 0.32) * 420; // fraction 0.7 (night)
    m.sleepInBed(bedPlaced);
    const healedAfterSleep = g.inv.hp === g.inv.maxHp;
    const { worldPhase } = await import('/src/persistence/model.js');
    const phaseAfterSleep = worldPhase(g.time, g.flags.dayOffset);
    const isDawnAfterSleep = Math.abs(phaseAfterSleep.fraction - 0.25) < 0.02;

    // 2. Fibre pouch expands maxPotions up to 5
    const initialMax = g.inv.maxPotions || 3;
    const craftPouch = m.craft('pouch', 1);
    const expandedMax = g.inv.maxPotions === initialMax + 1;
    m.craft('pouch', 1);
    const cappedAtFive = g.inv.maxPotions === 5;
    const overCapBlocked = !m.canCraft('pouch', 1).ok;

    // 3. Storage Chest & Quick Stack
    m.craft('chest', 1);
    m.startBuild('chest');
    m.build.tx = Math.floor(p.x); m.build.tz = Math.floor(p.z) + 1;
    m.place();
    const chestPlaced = g.entities.find(e => e.isStructure && e.type === 'chest');
    R_rec.storage[chestPlaced.id] = { wood: 10, stone: 5 };
    R_rec.resources.wood = 25;
    R_rec.resources.stone = 12;
    R_rec.resources.fibre = 8; // fibre is not in chest

    const qsResult = m.quickStack(10);
    const qsWoodStored = R_rec.resources.wood === 0 && R_rec.storage[chestPlaced.id].wood === 35;
    const qsStoneStored = R_rec.resources.stone === 0 && R_rec.storage[chestPlaced.id].stone === 17;
    const qsFibreKept = R_rec.resources.fibre === 8;

    // 4. Container crafting from nearby chest
    // Carried has 0 wood. Chest has 35 wood. Wall recipe needs 3 wood.
    const canCraftFromChest = m.canCraft('wall', 1).ok;
    m.craft('wall', 1);
    const deductedFromChest = R_rec.storage[chestPlaced.id].wood === 32 && (R_rec.kits.wall || 0) === 1;

    // 5. Warding Brazier suppresses mob spawns
    const craftBrazier = m.craft('brazier', 1);
    m.startBuild('brazier');
    m.build.tx = Math.floor(p.x) - 1; m.build.tz = Math.floor(p.z);
    m.place();
    const brazierPlaced = g.entities.find(e => e.isStructure && e.type === 'brazier');
    const testChunk = {
      nodes: [],
      defs: [],
      packs: [{ id: 'mob_warded', kind: 'wolf', x: p.x - 1, z: p.z + 1 }]
    };
    m.spawnChunk(testChunk, '99,99');
    const mobsSpawned = g.entities.filter(e => e.packId === 'mob_warded').length;
    const brazierSuppressed = mobsSpawned === 0;

    return {
      bedCraftAndPlace: craftBed.ok && hasBedKit && !!bedPlaced,
      sleepDaytimeRejected: cantSleepDay,
      sleepNightAdvancesToDawn: healedAfterSleep && isDawnAfterSleep,
      pouchExpandsMaxPotions: craftPouch.ok && expandedMax && cappedAtFive && overCapBlocked,
      quickStackMatchingResources: qsResult.ok && qsWoodStored && qsStoneStored && qsFibreKept,
      craftPullsFromNearbyChest: canCraftFromChest && deductedFromChest,
      brazierSuppressesHostiles: craftBrazier.ok && !!brazierPlaced && brazierSuppressed,
    };
  });

  for (const [k, v] of Object.entries(checks)) {
    R.ok(v, k);
  }

  // 6. Verify hotbar / survival HUD is hidden when Pause menu or Inventory is open
  const hudCheck = await page.evaluate(() => {
    const g = __game;
    const hud = document.getElementById('sv-hud');
    const wasVisibleBefore = !hud.classList.contains('hidden') && getComputedStyle(hud).display !== 'none';

    // Open Pause (Esc / Journal / Settings / Map)
    g.ui.openPause();
    g.ui.tab('settings');
    const hiddenInPause = hud.classList.contains('hidden') && getComputedStyle(hud).display === 'none';
    const settingsTabActive = document.querySelector('#tab-settings:not(.hidden)') !== null;

    // Navigate to Inventory
    g.ui.navigate('bag');
    const hiddenInInventory = hud.classList.contains('hidden') && getComputedStyle(hud).display === 'none';
    const inventoryOpen = !document.getElementById('inventory').classList.contains('hidden');

    // Resume gameplay
    g.ui.navigate('resume');
    const visibleAfterResume = !hud.classList.contains('hidden') && getComputedStyle(hud).display !== 'none';

    return { wasVisibleBefore, hiddenInPause, settingsTabActive, hiddenInInventory, inventoryOpen, visibleAfterResume };
  });

  R.ok(hudCheck.wasVisibleBefore, 'hotbar visible during active survival gameplay');
  R.ok(hudCheck.hiddenInPause && hudCheck.settingsTabActive, 'hotbar hidden when pause / settings menu is open');
  R.ok(hudCheck.hiddenInInventory && hudCheck.inventoryOpen, 'hotbar hidden when inventory is open');
  R.ok(hudCheck.visibleAfterResume, 'hotbar restored when resuming gameplay');
}
