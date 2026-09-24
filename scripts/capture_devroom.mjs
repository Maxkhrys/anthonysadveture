// Capture visual screenshots of Dev Room Pass 2 facilities
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 8888;
const server = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url))], {
  env: { ...process.env, PORT: port },
  stdio: 'ignore',
});

await new Promise(r => setTimeout(r, 1000));

if (!existsSync('docs/screenshots')) {
  mkdirSync('docs/screenshots', { recursive: true });
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${port}/index.html`);

// Wait for title screen
await page.waitForFunction(() => window.__game && document.getElementById('title') && !document.getElementById('loading'), null, { timeout: 30000 });

// Start game cleanly
await page.evaluate(async () => {
  const g = window.__game;
  g.story.opening = () => {};
  try { localStorage.clear(); } catch (e) {}
  await window.__start(true, 'samurai');
  g.cutscene = false;
  g.camFocus = null;
  g.flags.introFought = true;
  g.flags.stage = 1;
  g.res = 100;
  for (const e of g.entities) if (e.isEnemy) e.remove();
  // Warp to devroom directly
  window.__dev?.execute('/devroom');
  for (let i = 0; i < 20; i++) g.render(0.05);
});
await page.waitForTimeout(1000);

// 1. Central Hub & Portal
await page.evaluate(() => {
  const g = window.__game;
  g.player.x = 30.0;
  g.player.z = 26.0;
  g.snapCamera();
  for (let i = 0; i < 5; i++) g.render(0.05);
});
await page.screenshot({ path: 'docs/screenshots/devroom_01_hub.png' });
console.log('Captured: docs/screenshots/devroom_01_hub.png');

// 2. Weapon & Combat Dummy Test Range (South-West)
await page.evaluate(() => {
  const g = window.__game;
  g.player.x = 10.0;
  g.player.z = 38.0;
  g.snapCamera();
  for (let i = 0; i < 5; i++) g.render(0.05);
});
await page.screenshot({ path: 'docs/screenshots/devroom_02_combat_range.png' });
console.log('Captured: docs/screenshots/devroom_02_combat_range.png');

// 3. Loot, Rarity & Crafting Lab (North-East)
await page.evaluate(() => {
  const g = window.__game;
  g.player.x = 44.0;
  g.player.z = 10.0;
  g.snapCamera();
  for (let i = 0; i < 5; i++) g.render(0.05);
});
await page.screenshot({ path: 'docs/screenshots/devroom_03_loot_lab.png' });
console.log('Captured: docs/screenshots/devroom_03_loot_lab.png');

// 4. Developer Console with Category Pills and Quick-Actions
await page.evaluate(() => {
  const g = window.__game;
  window.__dev?.open();
  window.__dev?.execute('/help');
  for (let i = 0; i < 5; i++) g.render(0.05);
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'docs/screenshots/devroom_04_console.png' });
console.log('Captured: docs/screenshots/devroom_04_console.png');

await browser.close();
server.kill();
console.log('All devroom screenshots captured successfully.');
process.exit(0);
