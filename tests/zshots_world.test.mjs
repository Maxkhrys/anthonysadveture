// World look capture (not a regression check): the same frozen frame with world effects off /
// full / exaggerated.   OUT=docs/screens/world node tests/run.mjs zshots_world
import { sim, fresh, toSquare } from './lib.mjs';
const OUT = process.env.OUT || '/tmp';
export default async function (page, R) {
  const spots = [['village', 148.5, 132.5, 1], ['wide', 148.5, 138.5, 1.5]];
  await fresh(page, 'archer', { stage: 3, level: 6 });
  for (const [name, x, z, zoom] of spots) {
    await page.evaluate(([x, z, zoom]) => { const g = window.__game, p = g.player; p.x = x; p.z = z; g.flags.dayOffset = 0; g.time = 60; g.raining = false; g.rainK = 0; g.weatherT = 999; g.camZoom = zoom; g.snapCamera(); document.getElementById('hud').style.display = 'none'; }, [x, z, zoom]);
    await sim(page, 30);
    for (const [lvl, U] of [['off', { aoAmt: 0, cloudAmt: 0, splitAmt: 0, tilt: 0 }], ['full', null], ['debug', { aoAmt: 1.6, cloudAmt: 0.6, splitAmt: 0.75, tilt: 0 }]]) {
      await page.evaluate(([lvl, U]) => {
        const g = window.__game, u = g.pr.postMat.uniforms;
        g._upd = g._upd || g.update; g.update = () => {};
        if (U) { for (const k in U) u[k].value = U[k]; g.pr.worldFx = { cloud: U.cloudAmt, ao: U.aoAmt }; u.detailAmt.value = U.aoAmt ? 0.13 : 0; }
        else { const W = g.pr.worldFx = { ao: 0.8, cloud: 0.2, split: 0.75, tilt: 0.55, detail: 0.13 }; u.aoAmt.value = W.ao; u.splitAmt.value = W.split; u.tilt.value = W.tilt; u.detailAmt.value = W.detail; }
        g.render(0.016);
      }, [lvl, U]);
      await page.screenshot({ path: `${OUT}/${name}_${lvl}.jpg`, type: 'jpeg', quality: 90 });
    }
    await page.evaluate(() => { const g = window.__game; g.update = g._upd; });
  }
  R.ok(true, 'captured');
}
