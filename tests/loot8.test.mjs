import {fresh,sim} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'archer',{level:18});
 const result=await page.evaluate(async()=>{
 const g=window.__game,I=window.__items,C=await import('/src/rpg/combat.js'),H=await import('/src/rpg/heirlooms.js'),V=await import('/src/hero.js');
 const all=H.HEIRLOOMS.map(h=>I.makeNamed(h.id,18));
 const valid=all.every(i=>i&&Number.isFinite(i.min)&&i.max>i.min&&i.itemInstanceId&&V.weaponModel(i).parts.length>0);
 g.inv.equip.weapon=I.makeNamed('thornwood',8);g.recalc();g.player.fireBasic(false);
 const arrows=g.entities.filter(e=>e instanceof C.Projectile).length;
 for(const e of g.entities)if(e instanceof C.Projectile)e.remove();
 g.inv.equip.weapon=I.makeNamed('hickorybow',1);g.recalc();const fast=new C.Projectile(g,{x:g.player.x,z:g.player.z,dir:0,speed:10,kind:'arrow'});
 g.inv.equip.weapon=I.makeNamed('starfallcrossbow',12);g.recalc();g.player.fireBasic(false);
 const pierce=g.entities.filter(e=>e instanceof C.Projectile&&!e.dead).some(e=>e.pierce===2);
 g.inv.bag=all;g.ui.navigate('bag');g.ui.invSel=4;g.ui.renderInventory();
 return {valid,arrows,speed:fast.speed,pierce,count:all.length};
 });
 R.ok(result.valid&&result.count===15,'15 named reference weapons have valid stats, models and identities');
 R.ok(result.arrows===3,'Thornwood fires three actual projectiles');R.ok(result.speed===11,'Hickory projectile speed applies');R.ok(result.pierce,'Crossbow pierces');
 R.ok(await page.locator('#tooltip').innerText().then(t=>t.includes('Prismatic signature')),'prismatic signature is shown without changing save rarity');
 await page.screenshot({path:'/tmp/mossling-loot8.jpg'});
 await page.evaluate(()=>{const g=window.__game;g.ui.navigate('resume');g.inv.equip.weapon=window.__items.makeNamed('orbitinggrimoire',12);g.recalc();});await sim(page,3);
 R.ok(await page.evaluate(()=>window.__game.player.orbitBooks?.length===2),'grimoire has two visible orbiting tomes');
}
