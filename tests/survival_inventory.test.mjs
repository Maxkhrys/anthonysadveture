// Integration seam: live inventory and MOSSDEV must retain Survival's save ownership.
import { fresh } from './lib.mjs';
import { mkdirSync } from 'node:fs';
export default async function(page,R){
 await fresh(page,'samurai');
 const before=await page.evaluate(async()=>{
  const g=__game;await g.save();const story=localStorage.getItem('mossling-save-v2');
  const record=g.survivalMode.store.create({name:'Inventory integration',cls:'gunslinger',seed:1234});
  g.survivalMode.start(record);g.inv.bag.push(__items.makeNamed('candelabra',14,null,'witch'));await g.save();
  g.ui.openInventory();g.noRender=true;return {story,world:localStorage.getItem('mossling-survival-v1'),bag:JSON.stringify(g.inv.bag)};
 });
 await page.getByRole('button',{name:'Rotate character right',exact:true}).click();
 R.ok(await page.evaluate(()=>__game.ui.doll.rotY>.3),'live portrait rotates through the accessible control');
 mkdirSync('docs/screens/survival-inventory',{recursive:true});
 await page.screenshot({path:'docs/screens/survival-inventory/compact-1280.jpg',type:'jpeg',quality:82});
 R.ok(await page.evaluate(()=>getComputedStyle(document.querySelector('.inventory-mode input')).backgroundColor==='rgb(9, 15, 14)'), 'live search field retains the dark contrast surface');
 await page.locator('#tooltip [data-act="ii-details"]').click();
 R.ok(await page.locator('#tooltip .ii-details').count()>0,'live Details opens in Survival');
 R.ok(await page.evaluate(b=>JSON.stringify(__game.inv.bag)===b,before.bag),'inspection preserves exact Survival item rolls');
 mkdirSync('docs/screens/survival-inventory',{recursive:true});
 for(const [w,h]of [[1280,720],[1920,1080],[390,844]]){
  await page.setViewportSize({width:w,height:h});
  await page.screenshot({path:`docs/screens/survival-inventory/inventory-${w}.jpg`,type:'jpeg',quality:82});
  R.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no page horizontal overflow at ${w}`);
  R.ok(await page.locator('#tooltip').evaluate(el=>el.clientHeight>=150),`item details retain a readable scroll area at ${w}`);
  if(w===390){await page.locator('#tooltip [data-act="ii-details"]').scrollIntoViewIfNeeded();await page.locator('#tooltip [data-act="ii-details"]').click();await page.screenshot({path:'docs/screens/survival-inventory/details-390.jpg',type:'jpeg',quality:82});}
 }
 await page.setViewportSize({width:1280,height:720});
 const round=await page.evaluate(async()=>{
  const g=__game;g.ui.closeInventory();await g.devlab.enter();const frozen=localStorage.getItem('mossling-survival-v1');
  const suspended=!g.survival&&!g.survivalMode.active;g.devlab.setClass('witch');await g.save();
  const isolated=localStorage.getItem('mossling-survival-v1')===frozen;
  await g.devlab.exit();return {suspended,isolated,cls:g.inv.cls,active:g.survivalMode.active,story:localStorage.getItem('mossling-save-v2'),bag:JSON.stringify(g.inv.bag)};
 });
 R.ok(round.suspended&&round.isolated,'lab suspends Survival and cannot write its world save');
 R.ok(round.active&&round.cls==='gunslinger'&&round.bag===before.bag,'Return to Survival restores class and exact items');
 R.ok(round.story===before.story,'Survival and lab round trip leaves story save byte-for-byte unchanged');
 await page.evaluate(async()=>{const g=__game;g.settings.devMode=true;localStorage.setItem('mossling-settings',JSON.stringify(g.settings));await g.devlab.enter();});
 await page.reload();await page.waitForFunction(()=>window.__game?.devlab?.active&&!document.getElementById('loading'));
 const refreshed=await page.evaluate(async()=>{const g=__game;await g.devlab.exit();return {active:!!g.survival,ui:!!g.survivalUI,cls:g.inv.cls,story:localStorage.getItem('mossling-save-v2')};});
 R.ok(refreshed.active&&refreshed.ui&&refreshed.cls==='gunslinger'&&refreshed.story===before.story,'refreshing inside the lab still returns to Survival with its HUD and isolated saves');
}
