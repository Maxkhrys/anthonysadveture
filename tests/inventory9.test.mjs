import {fresh,sim} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'archer',{level:16});
 await page.evaluate(()=>{const g=window.__game,I=window.__items;g.inv.bag=['heavensdivide','azureedge','moonfeather','verdanteclipse','fateweaver','phoenixfeather','worldseed','thornwood','umbraltome','dawnbringer','travelantern','wayfarersatchel'].map(id=>I.makeNamed(id,16));g.inv.bag.push(...Array.from({length:12},(_,i)=>I.genItem({level:16,slot:i%2?'armor':'ring',rarity:i%4})));for(const slot of ['helm','armor','arms','legs','boots','charm'])g.inv.equip[slot]=I.genItem({level:16,slot,rarity:3});g.inv.equip.weapon=I.makeNamed('verdanteclipse',16);g.recalc();g.inv.hp=g.inv.maxHp;g.inv.coins=1250;g.ui.navigate('bag');});
 R.ok(await page.evaluate(()=>{const b=document.querySelector('.inv-right').getBoundingClientRect(),h=document.querySelector('.inv-left').getBoundingClientRect(),d=document.getElementById('inventory-detail').getBoundingClientRect();return b.x<h.x&&h.x<d.x;}),'bag left, equipped character centre-right, inspection right');
 R.ok(await page.locator('#baggrid .cell-name').count()===24,'every owned item has a readable tile name');
 await page.getByLabel('Bag rarity',{exact:true}).selectOption('prismatic');
 R.ok(await page.locator('#baggrid .cell:not([data-i="-99"])').count()===4,'Prismatic bag filter finds four actual items');
 await page.getByLabel('Your class only',{exact:true}).check();
 R.ok(await page.locator('#baggrid .cell:not([data-i="-99"])').count()===2,'class filter includes archer plus universal gear');
 await page.getByRole('button',{name:'Reset',exact:true}).click();
 await page.getByLabel('Search inventory',{exact:true}).fill('azure');
 await page.locator('#baggrid .cell:not([data-i="-99"])').first().click();await page.locator('[data-act="favourite"]').click();
 R.ok(await page.locator('[data-act="salvage"]').isDisabled(),'protected item cannot be salvaged');
 await page.getByRole('button',{name:'Clear bag search',exact:true}).click();await page.getByLabel('Protected items only',{exact:true}).check();
 R.ok(await page.locator('#baggrid .cell:not([data-i="-99"])').count()===1,'protected filter retains actual protected item');
 await page.getByRole('button',{name:'Reset',exact:true}).click();
 await page.getByLabel('Bag category',{exact:true}).selectOption('weapon');await page.getByLabel('Bag sort',{exact:true}).selectOption('name');
 R.ok(await page.evaluate(()=>{const u=window.__game.ui,b=window.__game.inv.bag,v=u.bagView().map(i=>b[i]);return v.every(x=>x.slot==='weapon')&&v.map(x=>x.name).join()===v.map(x=>x.name).sort((a,b)=>a.localeCompare(b)).join();}),'category and name sorting combine without changing bag order');
 await page.getByRole('button',{name:'Reset',exact:true}).click();await page.getByLabel('Search inventory',{exact:true}).fill('dawnbringer');
 await page.locator('[data-act="equip"]').click();
 R.ok(await page.evaluate(()=>window.__game.inv.equip.weapon.unique==='dawnbringer'),'Equip action changes the real weapon');
 await page.getByRole('button',{name:'Reset',exact:true}).click();
 await page.locator('#baggrid .cell:not([data-i="-99"])').first().click();
 for(const [w,h]of [[1280,720],[1600,900],[390,844]]){
  await page.setViewportSize({width:w,height:h});
  R.ok(await page.evaluate(()=>{const p=document.querySelector('.inv-panel'),r=p.getBoundingClientRect();return p.scrollWidth<=p.clientWidth+1&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),'inventory fits '+w+'px');
  if(w>=1280)R.ok(await page.locator('.item-actions').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>0&&r.bottom<=innerHeight;}),'actions stay visible '+w+'px');
  if(w>=1280)R.ok(await page.locator('#baggrid').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'all 30 standard slots visible '+w+'px');
  await page.evaluate(()=>window.__game.ui.update(5));
  await page.screenshot({path:'/tmp/inventory9-'+w+'.jpg'});
 }
 await page.setViewportSize({width:1280,height:720});
 await page.getByLabel('Search inventory',{exact:true}).fill('no-such-item');
 R.ok(await page.locator('#bag-empty').isVisible(),'empty filter results explain reset');
 await page.getByRole('button',{name:'Reset',exact:true}).click();
 await page.evaluate(()=>{const g=window.__game;g.inv.bag=[];g.ui.renderInventory();});
 R.ok(await page.locator('#bag-empty').innerText().then(t=>t.includes('empty')),'empty bag has clear next step');
}
