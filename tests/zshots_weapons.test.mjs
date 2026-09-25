// Weapon visuals capture set (not a regression check):
//   OUT=docs/screens/weapons node tests/run.mjs zshots_weapons
import { sim, fresh } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
const SHEET = ['shinai', 'rustkatana', 'wakizashi', 'tachi', 'uchigatana', 'nodachi', 'moonkatana', 'onicleaver', 'dragontachi', 'stormedge',
  'twigbow', 'huntbow', 'recurve', 'longbow', 'composite', 'reedbow', 'elmwarbow', 'galebow', 'sunbow',
  'twigwand', 'acornstaff', 'crookstaff', 'shroomwand', 'candlestaff', 'owlstaff', 'hexwand', 'frostrod', 'starstaff',
  'tetherchain', 'ferrymanchain', 'gravechain', 'veilchain', 'threshold'];

// every model rendered on its own, in the sheet's diagonal, at in-game pixel density (x3)
async function gallery(page, ids, name, { px = 72, cols = 10, extra = {} } = {}) {
  await page.evaluate(async ([ids, px, cols, extra]) => {
    const THREE = await import('three');
    const { weaponMesh } = await import('/src/hero.js');
    const I = window.__items;
    const rows = Math.ceil(ids.length / cols), W = cols * px, H = rows * px;
    const r = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.setScissorTest(true);
    r.setClearColor(0xeadbb8, 1); r.clear();
    for (let n = 0; n < ids.length; n++) {
      const [id, rr] = Array.isArray(ids[n]) ? ids[n] : [ids[n], 0];
      const it = I.makeNamed(id, 12) || I.makeNamed(id, 12, 0); it.r = rr; if (extra.prismatic) it.prismatic = true;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a6a3a, 1.35));
      const d = new THREE.DirectionalLight(0xffe8c8, 2.4); d.position.set(2, 4, 3); scene.add(d);
      const obj = weaponMesh(it, it.cls);
      if (obj.userData.inner && obj.userData.inner !== obj) obj.userData.inner.rotation.set(0, 0, 0);
      obj.rotation.set(0, 0, -Math.PI / 4); if (it.kind === 'chain') obj.rotation.set(0.3, 0.5, -0.5);
      scene.add(obj);
      const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      obj.position.sub(c); const s = Math.max(sz.x, sz.y) * 0.56 + 0.02;
      const cam = new THREE.OrthographicCamera(-s, s, s, -s, 0.1, 20); cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0);
      const x = (n % cols) * px, y = H - (Math.floor(n / cols) + 1) * px;
      r.setViewport(x, y, px, px); r.setScissor(x + 1, y + 1, px - 2, px - 2); r.render(scene, cam);
    }
    const cv = r.domElement; cv.id = 'wgal';
    cv.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${W * 3}px;height:${H * 3}px;image-rendering:pixelated;background:#eadbb8`;
    document.body.appendChild(cv);
  }, [ids, px, cols, extra]);
  const el = await page.$('#wgal'); await el.screenshot({ path: `${OUT}/${name}.png` });
  await page.evaluate(() => document.getElementById('wgal').remove());
}

export default async function (page, R) {
  await fresh(page, 'samurai', { stage: 3, level: 16 });
  await page.evaluate(() => { const g = window.__game; g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.godMode = true; });
  // 1. every approved design as a 3D model, and the sheet atlas it is judged against
  await page.setViewportSize({ width: 2200, height: 900 });
  await gallery(page, SHEET.slice(0, 10), '01_models_samurai', { cols: 10 });
  await gallery(page, SHEET.slice(10, 19), '02_models_archer', { cols: 9 });
  await gallery(page, SHEET.slice(19, 28), '03_models_witch', { cols: 9 });
  await gallery(page, ['tetherchain', 'shrinecord', 'lanternlinks', 'ferrymanchain', 'mothsilk', 'gravechain', 'wispwoven', 'veilchain', 'threshold', 'lanternchain'], '04_models_soulbound', { cols: 10 });
  await gallery(page, [['uchigatana', 0], ['uchigatana', 1], ['uchigatana', 2], ['uchigatana', 3], ['uchigatana', 4], ['crescent', 4], ['rootcleaver', 4], ['silentdawn', 4], ['onigrin', 4], ['sunshot', 4], ['huntermoon', 4], ['starfall', 4], ['hexbloom', 4]], '05_rarity_and_uniques', { cols: 13 });
  await gallery(page, ['wanderblade', 'azureedge', 'voidcutter', 'dawnbringer', 'heavensdivide', 'hickorybow', 'moonfeather', 'thornwood', 'verdanteclipse', 'apprenticewand', 'sagesrod', 'fateweaver', 'seamripper', 'wickblade', 'bellclapper'], '06_heirlooms_named', { cols: 15 });
  // element overlays on one blade
  await page.evaluate(() => { window.__elemPreview = true; });
  await page.setViewportSize({ width: 1280, height: 720 });

  // 2. the bag: every sheet weapon as its icon, plus tooltip + comparison
  await page.evaluate(ids => {
    const g = window.__game, I = window.__items;
    g.inv.bag.length = 0;
    ids.forEach((id, n) => { const it = I.makeNamed(id, 14); it.r = [0, 1, 2, 3, 4][n % 5]; g.inv.bag.push(it); });
    const p = I.makeNamed('threshold', 16); g.inv.bag.push(p);
    g.ui.openInventory ? g.ui.openInventory() : g.ui.navigate('bag');
  }, SHEET.slice(0, 32));
  await sim(page, 3); await page.waitForTimeout(400);
  await page.evaluate(() => { const g = window.__game; g.ui.renderInventory && g.ui.renderInventory(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/07_inventory_icons.jpg`, type: 'jpeg', quality: 88 });
  const cell = await page.$('.cell[data-i="6"]'); if (cell) { await cell.hover(); await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/08_tooltip_compare.jpg`, type: 'jpeg', quality: 88 }); }
  await page.evaluate(() => { const g = window.__game; g.ui.closeInventory ? g.ui.closeInventory() : 0; });
  await sim(page, 2);

  // 3. drops on the ground: common → prismatic
  await page.evaluate(() => {
    const g = window.__game, p = g.player, I = window.__items, C = window.__combat;
    p.x = 151.5; p.z = 136.5; p.facing = 0; g.camZoom = 0.6; g.snapCamera();
    const L = [['shinai', 0], ['huntbow', 1], ['moonkatana', 2], ['owlstaff', 3], ['onicleaver', 4], ['sunbow', 4], ['starstaff', 4], ['threshold', 4]];
    L.forEach(([id, r], n) => { const it = I.makeNamed(id, 12); it.r = r; const a = n / L.length * Math.PI * 2; const d = new C.GearDrop(g, p.x + Math.cos(a) * 1.8, p.z + 0.6 + Math.sin(a) * 1.4, it); d.t = -99; d.vx = d.vz = 0; g.spawn(d); });
    g.player.x += 30; // stay out of pickup range
  });
  await sim(page, 30);
  await page.evaluate(() => { const g = window.__game; g.player.x -= 30; g.player.obj.visible = false; g.camFocus = { x: 151.5, z: 137 }; g.snapCamera(); g._upd = g.update; g.update = () => {}; g.render(0.016); });
  await page.screenshot({ path: `${OUT}/09_drops.jpg`, type: 'jpeg', quality: 88 });
  await page.evaluate(() => { const g = window.__game; g.update = g._upd; g.player.obj.visible = true; g.camFocus = null; for (const e of g.entities) if (e.constructor.name === 'GearDrop') e.remove(); });

  // 4. in the hand: the success list plus the big ones, idle and mid-attack
  const HAND = [['samurai', 'moonkatana'], ['samurai', 'onicleaver'], ['samurai', 'nodachi'], ['samurai', 'wakizashi'], ['archer', 'sunbow'], ['archer', 'elmwarbow'], ['witch', 'frostrod'], ['witch', 'starstaff'], ['witch', 'shroomwand'], ['soulbound', 'veilchain']];
  for (const [cls, id] of HAND) {
    await fresh(page, cls, { stage: 3, level: 16 });
    await page.evaluate(id => { const g = window.__game, p = g.player, I = window.__items; g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.godMode = true; const it = I.makeNamed(id, 16); it.r = 4; g.inv.equip.weapon = it; g.recalc && g.recalc(); p.x = 151.5; p.z = 136.5; p.facing = 0.5; p.aimSrc = 'keys'; g.camZoom = 0.42; g.snapCamera(); }, id);
    await sim(page, 12);
    await page.evaluate(() => { const g = window.__game, p = g.player; g._upd = g.update; g.update = () => {}; g.render(0.016); });
    const c = await page.evaluate(() => { const g = window.__game, p = g.player; return g.pr.project({ x: p.x, y: 0.5, z: p.z }); });
    await page.screenshot({ path: `${OUT}/10_hand_${id}.jpg`, type: 'jpeg', quality: 88, clip: { x: Math.max(0, Math.min(1280 - 360, c.x - 180)), y: Math.max(0, Math.min(720 - 280, c.y - 160)), width: 360, height: 280 } });
    await page.evaluate(() => { const g = window.__game; g.update = g._upd; });
  }
  R.ok(true, 'captured');
}
