// Pass 6: the original map now sits at (90, 70) inside the larger world; tests written against
// its coordinates add this offset.
export const HX = 90, HZ = 70;
// Shared helpers for the browser regression checks. They drive the real game through the
// deterministic hook window.__sim(frames, heldKeys) exposed by src/main.js.
export const sim = (page, frames, keys = []) => page.evaluate(([f, k]) => { window.__game.noRender = true; window.__sim(f, k); window.__game.noRender = false; }, [frames, keys]);
export const frame = (page, frames = 1, keys = []) => page.evaluate(([f, k]) => window.__sim(f, k), [frames, keys]);
export async function walkTo(page, x, z, max = 300, tol = 0.15) {
  let last = null, stuck = 0, mode = 0;
  for (let i = 0; i < max; i++) {
    const p = await page.evaluate(() => { const p = window.__game.player; return [p.x, p.z]; });
    const dx = x - p[0], dz = z - p[1];
    if (Math.abs(dx) < tol && Math.abs(dz) < tol) return true;
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.02) stuck++; else stuck = Math.max(0, stuck - 1);
    last = p;
    if (stuck > 3) { mode = (mode + 1) % 3; stuck = 0; }
    const kx = Math.abs(dx) >= tol ? (dx > 0 ? 'KeyD' : 'KeyA') : null, kz = Math.abs(dz) >= tol ? (dz > 0 ? 'KeyS' : 'KeyW') : null;
    let keys = [kx, kz].filter(Boolean);
    if (mode === 1 && kx) keys = [kx, dz > 0 ? 'KeyW' : 'KeyS'];
    if (mode === 2 && kz) keys = [kz, dx > 0 ? 'KeyA' : 'KeyD'];
    const fr = Math.max(1, Math.min(6, Math.floor(Math.max(Math.abs(dx), Math.abs(dz)) / 0.17)));
    await sim(page, mode ? 6 : fr, keys);
  }
  return false;
}
export async function pressE(page, n = 1) { for (let i = 0; i < n; i++) { await sim(page, 1, ['KeyE']); await sim(page, 3); await page.waitForTimeout(40); } }
export async function talkThrough(page, n = 40) {
  for (let i = 0; i < n; i++) {
    const busy = await page.evaluate(() => window.__game.ui.talking);
    if (!busy) return;
    await sim(page, 4); await sim(page, 1, ['KeyE']); await page.waitForTimeout(60);
  }
}
// Put the real OS mouse over a world point (projected through the game's own camera).
export async function mouseAt(page, x, z, y = 0.45) {
  const s = await page.evaluate(([x, y, z]) => { const g = window.__game; g.render(0); const v = { x, y, z }; return g.pr.project(v); }, [x, y, z]);
  await page.mouse.move(s.x, s.y);
  return s;
}
// Start a fresh game as a class with no intro, standing in the village.
export async function fresh(page, cls = 'samurai', opts = {}) {
  await page.evaluate(async ([cls, opts]) => {
    const g = window.__game; g.story.opening = () => {};
    try { localStorage.clear(); } catch (e) {}
    await window.__start(true, cls);
    g.cutscene = false; g.camFocus = null; g.dead = false; g.ui.show('gameover', false); g.flags.introFought = true; g.flags.stage = opts.stage ?? 1;
    g.entities.filter(e => e.arena).forEach(e => e.remove());
    for (const e of g.entities) if (e.isEnemy) e.remove();
    if (opts.level) { g.inv.level = opts.level; g.inv.skills = [1, opts.level >= 3 ? 1 : 0, opts.level >= 6 ? 1 : 0]; g.recalc(); g.inv.hp = g.inv.maxHp; }
    g.res = 100;
  }, [cls, opts]);
  await sim(page, 2);
}
export class Report {
  constructor(name) { this.name = name; this.fails = 0; this.passes = 0; }
  ok(cond, label, extra = '') { if (cond) this.passes++; else this.fails++; console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`); return cond; }
  note(s) { console.log('  ·  ' + s); }
}
