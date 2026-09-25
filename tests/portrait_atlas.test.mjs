import {fresh,sim} from './lib.mjs';
import {mkdirSync} from 'node:fs';
export default async function(page,R){
 mkdirSync('docs/screens/atlas',{recursive:true});
 await fresh(page,'samurai');
 await page.evaluate(async()=>{const g=window.__game;g.inv.appearance={...g.inv.appearance,hair:'braided',hairColor:'#d8bb80',frame:'tall',skin:'#a66c49'};g.player.m.setAppearance(g.inv.appearance);g.player.facing=.3;g.snapCamera();g.ui.openInventory();g.ui.doll.rotY=.3;g.ui.doll.frame(0);});
 await page.waitForTimeout(500);R.ok(await page.evaluate(()=>window.__game.ui.doll.pixel.flash===0),'portrait animation never introduces a negative-time flash');
 await page.screenshot({path:'docs/screens/atlas/inventory-character.png'});
 R.ok(await page.locator('.doll-canvas').getAttribute('data-renderer')==='gameplay','inventory uses gameplay pixel renderer');
 R.ok(await page.evaluate(()=>{const g=window.__game;return Math.abs(g.ui.doll.pixel.unitsPerPx*2-g.pr.unitsPerPx)<1e-9&&g.ui.doll.hero.root.scale.x===g.player.m.root.scale.x&&g.ui.doll.hero.frame.scale.y===g.player.m.frame.scale.y;}),'inventory portrait is exactly twice the live pixel density, same rig proportions');
 const transforms=await page.evaluate(()=>{const g=window.__game,d=g.ui.doll;g.time=2;g.player.aimSrc='keys';g.player.blinkT=1;g.player.state='move';g.player.animate(0,0);d.t=2;d.frame(0);return ['body','head','armL','armR','sword','tail1','tail2'].every(k=>g.player.m[k].rotation.toArray().join()===d.hero[k].rotation.toArray().join());});
 R.ok(transforms,'live character and portrait use identical idle joint rotations');
 await page.evaluate(()=>{const g=window.__game;g.ui.closeInventory();});await sim(page,2);await page.screenshot({path:'docs/screens/atlas/game-character.png'});
 await sim(page,8,['KeyW']);await sim(page,2,['KeyC']);await sim(page,20);await sim(page,1,['Space']);await sim(page,20);
 R.ok(await page.evaluate(()=>Number.isFinite(window.__game.player.m.sword.matrixWorld.elements[12])),'movement and combat remain valid');
 await page.keyboard.press('m');await page.waitForSelector('#atlas-tools');
 await page.evaluate(()=>{const g=window.__game;g.world6.discovery.regions=g.ui.atlasRegions.map(r=>r.id);g.world6.discovery.landmarks=g.area.landmarks.map(l=>l.id);g.world6.discovery.fog='f'.repeat(g.world6.discovery.fog.length);g.ui.atlasOptions=null;g.ui.drawBigMap();});
 await page.locator('[data-map="world"]').click();await page.screenshot({path:'docs/screens/atlas/explored-world.png'});
 R.ok(await page.evaluate(()=>{const b=window.__game.ui.atlasLabelBoxes;return b.every((a,i)=>b.every((c,j)=>i===j||a.x+a.w<=c.x||c.x+c.w<=a.x||a.y+a.h<=c.y||c.y+c.h<=a.y));}),'fully explored world has no colliding labels');
 await page.keyboard.press('Escape');await page.evaluate(()=>{const g=window.__game;g.loadArea('dungeon','start');});await sim(page,3);await page.evaluate(()=>{const g=window.__game;g.ui.typing=null;g.ui.choice=null;g.ui.dialogQ=[];g.ui.show('dialog',false);g.ui.navigate('map');});await page.waitForFunction(()=>window.__game.ui.atlasArea===window.__game.area);
 R.ok(await page.evaluate(()=>window.__game.ui.atlasRegions.length===0&&document.getElementById('atlas-region').options.length===2),'dungeon map clears overworld regions');
 await page.locator('[data-map="in"]').click();await page.locator('[data-map="local"]').click();await page.screenshot({path:'docs/screens/atlas/dungeon.png'});
 R.ok(await page.evaluate(()=>Number.isFinite(window.__game.ui.atlasTransform.sc)),'dungeon map supports local zoom');
}
