// Pass 6 capture set (not a regression check): every region, settlement and landmark of the
// new world, a mini-dungeon, the Tollcrow, night, and the discovered map.
//   OUT=docs/screens/pass6 node tests/run.mjs zshots6
import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const shot = async (page, name) => { await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 3; i++) g.render(0.05); }); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 72 }); };
// stand somewhere, clear the view of the foes a test profile would otherwise be fighting, let chunks stream
const go = (page, x, z, o = {}) => page.evaluate(([x, z, o]) => {
  const g = window.__game, p = g.player; g.godMode = true;
  if (o.area && g.area.id !== o.area) return false;
  p.x = x; p.z = z; p.lastSafe = { x, z }; p.facing = o.face || 0;
  g.flags.dayOffset = ((o.frac ?? 0.5) - 0.32) * 420 - g.time;
  g.raining = !!o.rain; g.rainK = o.rain ? 1 : 0; g.weatherT = 999;
  g.snapCamera(); return true;
}, [x, z, o]);
const calm = page => page.evaluate(() => { const g = window.__game; for (const e of g.entities) if (e.isEnemy && !e.isBoss && Math.hypot(e.x - g.player.x, e.z - g.player.z) < 5) e.remove(); });

export const SHOTS = [
  // [file, x, z, options] — grouped by region
  ['heartland_01_thimblewick', 148.5, 134.5],
  ['heartland_02_hobbs_farm', 170.5, 152.5],
  ['heartland_03_bellwatch_knoll', 164.5, 119.5],
  ['heartland_04_pier_bellstone', 146.5, 165.5],
  ['deepwood_01_rootway', 44.5, 102.5],
  ['deepwood_02_hollow_log', 70.5, 103.5],
  ['deepwood_03_bell_in_the_oak', 40.5, 117.5],
  ['deepwood_04_mushroom_colony', 30.5, 153.5, { frac: 0.9 }],
  ['deepwood_05_thornback_nest', 23.5, 90.5],
  ['deepwood_06_fernhollow', 19.5, 132.5],
  ['glassmere_01_great_dome', 143.5, 96.5],
  ['glassmere_02_mirror_meadow', 158.5, 100.5],
  ['glassmere_03_windstair', 131.5, 82.5],
  ['lake_01_mirrow_landing', 286.5, 201.5],
  ['lake_02_heron_isle', 160.5, 209.5],
  ['lake_03_sunken_bellwright', 184.5, 199.5],
  ['lake_04_chapel_isle', 216.5, 223.5],
  ['lake_05_pike_bones', 128.5, 191.5],
  ['sunscald_01_wells', 268.5, 149.5],
  ['sunscald_02_dustbowl', 248.5, 133.5],
  ['sunscald_03_sunward_mesa', 300.5, 117.5],
  ['sunscald_04_kiln_crypt', 300.5, 131.5],
  ['sunscald_05_potsherd_flats', 276.5, 140.5],
  ['cinderpeak_01_cinder_rest', 272.5, 62.5],
  ['cinderpeak_02_kiln_road', 272.5, 90.5],
  ['cinderpeak_03_great_anvil', 252.5, 32.5],
  ['cinderpeak_04_emberwell_gate', 222.5, 72.5],
  ['moonfen_01_lantern_night', 75.5, 189.5, { frac: 0.9 }],
  ['moonfen_02_moonwillow_night', 60.5, 214.5, { frac: 0.9 }],
  ['moonfen_03_drowned_belfry', 86.5, 239.5, { frac: 0.2 }],
  ['moonfen_04_black_mere', 48.5, 226.5],
  ['highlands_01_belfry_cradle', 118.5, 44.5],
  ['highlands_02_cairn_fields', 50.5, 37.5],
  ['highlands_03_bellwright_ruins', 170.5, 29.5],
  ['highlands_04_crown_vista', 98.5, 15.5, { vista: true }],
  ['highlands_05_chime_spire_door', 164.5, 72.5],
  ['weather_01_heartland_rain', 176.5, 140.5, { rain: true }],
];

export default async function (page, R) {
  await fresh(page, 'archer', { stage: 3, level: 14 });
  let n = 0;
  for (const [name, x, z, o = {}] of SHOTS) {
    await go(page, x, z, o); await sim(page, o.vista ? 120 : 40); await calm(page); await sim(page, 4);
    await shot(page, name); n++;
  }
  // the Tollcrow on the wing over the Great Bell
  await page.evaluate(() => {
    const g = window.__game; g.godMode = true; g.player.x = 118.5; g.player.z = 44; g.snapCamera();
    if (!g.entities.some(e => e.kind === 'tollcrow' && !e.dead)) g.spawnDef(g.area.defs.find(d => d.type === 'tollcrow'));
  });
  await sim(page, 20);
  await page.evaluate(() => { const g = window.__game, b = g.entities.find(e => e.kind === 'tollcrow'); g.player.z = 36; g.snapCamera(); if (b && !g.bossActive) g.startTollcrow(b); for (let i = 0; i < 80 && g.cutscene; i++) window.__sim(5); });
  await sim(page, 90); await shot(page, 'boss_01_tollcrow'); n++;
  // a mini-dungeon interior
  await page.evaluate(() => window.__game.warpTo('mirrorcellar', 'entrance')); await page.waitForTimeout(1500); await sim(page, 20);
  await shot(page, 'mini_01_mirror_cellar'); n++;
  await page.evaluate(() => window.__game.warpTo('forgedeep', 'entrance')); await page.waitForTimeout(1500); await sim(page, 20);
  await shot(page, 'mini_02_old_forge_deep'); n++;
  // the whole map, everything discovered (a dev profile: this never touches a real character)
  await page.evaluate(() => window.__game.warpTo('overworld', 'village')); await page.waitForTimeout(1500); await sim(page, 10);
  await page.evaluate(() => { const g = window.__game, W = g.world6; for (const id of ['heartland', 'deepwood', 'glassmere', 'lake', 'sunscald', 'cinderpeak', 'moonfen', 'highlands']) g.revealRegion(id); for (const L of g.area.landmarks) g.discoverLandmark(L, true); g.ui.illusArea = null; g.ui.openPause(); g.ui.tab('map'); });
  await sim(page, 2); await shot(page, 'map_01_discovered'); n++;
  await page.evaluate(() => window.__game.ui.show('pause', false));
  R.ok(n === SHOTS.length + 4, 'captured ' + n + ' views');
}
