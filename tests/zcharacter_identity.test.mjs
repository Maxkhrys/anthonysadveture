import {fresh,sim} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'samurai');
 await page.evaluate(()=>{const g=window.__game;g.camFocus={x:g.player.x,z:g.player.z};g.pr.setViewHeight(3.2);});
 await sim(page,3);await page.screenshot({path:'/tmp/character-gameplay.png'});
 await sim(page,8,['KeyW']);await sim(page,4,['Space']);await sim(page,12);await sim(page,3,['KeyC']);await sim(page,14);
 R.ok(await page.evaluate(()=>{const p=window.__game.player;return Number.isFinite(p.m.armR.matrixWorld.elements[12])&&p.m.sword.parent===p.m.armR&&p.m.offhand.parent===p.m.armL;}),'movement, roll and attack keep weapon anchors on rig');
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__game&&!document.getElementById('loading'));await page.getByText('New Character',{exact:true}).click();
 for(const cls of ['samurai','archer','witch']){await page.locator('[data-category="Class"]').click();await page.locator(`[data-class="${cls}"]`).click();await page.screenshot({path:`/tmp/creator-${cls}.png`});}
 await page.locator('[data-category="Name"]').click();await page.locator('#creator-name').fill('Long name <script> safe');await page.keyboard.press('Tab');
 R.ok(await page.evaluate(()=>document.activeElement.closest('#character-creator')!==null),'keyboard focus stays inside creator');
 await page.locator('[data-action="back"]').click();R.ok(await page.locator('[data-class="witch"]').count()===1,'Back from name returns to class');
 await page.keyboard.press('Escape');R.ok(await page.locator('#character-creator').count()===0,'Escape leaves creator');
}
