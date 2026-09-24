// Browser regression checks. Usage: node tests/run.mjs [suite ...]
// Needs Playwright (npm i -D playwright, or a global install) and a Chromium build.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Report } from './lib.mjs';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const dir = fileURLToPath(new URL('.', import.meta.url));
const want = process.argv.slice(2);
const suites = readdirSync(dir).filter(f => f.endsWith('.test.mjs')).map(f => f.replace('.test.mjs', '')).filter(n => want.length ? want.includes(n) : !n.startsWith('z')); // z* = capture/profiling tools, run by name
const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url))], { env: { ...process.env, PORT: port }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0;
for (const name of suites) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__game && document.getElementById('title') && !document.getElementById('loading'), null, { timeout: 30000 });
  console.log(`\n== ${name}`);
  const rep = new Report(name);
  try { await (await import(`./${name}.test.mjs`)).default(page, rep); }
  catch (e) { rep.ok(false, 'suite threw', e.stack); }
  rep.ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  console.log(`   ${rep.passes} passed, ${rep.fails} failed`);
  fails += rep.fails;
  await page.close();
}
await browser.close(); server.kill();
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
