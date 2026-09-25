import {fresh,sim,toSquare} from './lib.mjs';
import {mkdirSync} from 'node:fs';
export default async function(page,R){
 await fresh(page,'gunslinger',{level:16});await toSquare(page);
 const born=await page.evaluate(()=>{const g=__game;g.flags.onboarding=null;g.flags.guideDone=true;g.recalc();g.ui.updateHud();return {cls:g.inv.cls,kind:g.player.family,load:g.inv.loadout,hat:g.player.m.helm.children.length};});
 R.ok(born.cls==='gunslinger'&&born.kind==='revolver'&&born.hat>0,'new Gunslinger has firearm, class model and free ability slots',JSON.stringify(born));
 await page.evaluate(()=>{const g=__game,p=g.player;g.testTarget=g.spawnEnemy('blot',p.x,p.z+4,{noRoom:true});const e=g.testTarget;e.spawnT=0;e.hp=e.maxHp=1e6;e.think=()=>[0,0];g.res=0;});
 await sim(page,50,['KeyC']);
 let shot=await page.evaluate(()=>{const g=__game;return {rounds:g.inv.equip.weapon.magazine.rounds,damage:g.testTarget.maxHp-g.testTarget.hp,res:g.res,state:g.player.state};});
 R.ok(shot.rounds<6&&shot.damage>0&&shot.res>3,'held revolver fires without charge and successful hits generate Grit',JSON.stringify(shot));
 await sim(page,2,['KeyZ']);await sim(page,12);const before=await page.evaluate(()=>__game.inv.equip.weapon.magazine.rounds);await sim(page,1,['Space']);await sim(page,35);
 R.ok(await page.evaluate(()=>!__game.player.reload&&__game.inv.equip.weapon.magazine.rounds)===before,'dodge cancels reload without granting ammunition');
 await sim(page,1,['KeyZ']);await sim(page,130);R.ok(await page.evaluate(()=>__game.inv.equip.weapon.magazine.rounds)===6,'completed reload restores the magazine');
 const ability=await page.evaluate(async()=>{const g=__game,p=g.player,K=await import('/src/rpg/skills.js');g.inv.tree=Object.fromEntries(K.TREES.gunslinger.filter(n=>n.type==='active').map(n=>[n.id,1]));g.recalc();p.cdMap={};g.res=100;p.gunPrimed=false;p.reload=null;const w=g.inv.equip.weapon;w.magazine.rounds=0;let r=g.res,ok=p.castAbility('quickdraw');const rejected=!ok&&g.res===r&&!p.gunPrimed;w.magazine.rounds=6;p.castAbility('overclock');const primed=p.gunPrimed;p.castAbility('quickdraw');return {rejected,primed,after:p.gunPrimed,rounds:w.magazine.rounds};});
 R.ok(ability.rejected&&ability.primed&&ability.after&&ability.rounds===5,'empty casts spend nothing; successful spending primes after consuming the previous priming',JSON.stringify(ability));
 await sim(page,20);
 const gadgets=await page.evaluate(()=>{const g=__game,p=g.player;p.cdMap={};g.res=100;p.reload=null;p.setState('move');const at={x:p.x+1,z:p.z+2,ok:true};const grenade=p.castAbility('powdergrenade',at);p.cdMap={};g.res=100;const sentry=p.castAbility('sentryturret',at);g.res=100;const satchel=p.castAbility('satchelcharge',at),res=g.res;const detonated=p.castAbility('satchelcharge',at);return {grenade,sentry,satchel,detonated,free:g.res===res,turrets:g.entities.filter(e=>e.isSentry&&!e.dead).length};});
 R.ok(Object.values(gadgets).every(Boolean),'grenade, sentry, satchel placement and free detonation execute',JSON.stringify(gadgets));
 await sim(page,100);
 const turret=await page.evaluate(()=>{const g=__game,t=g.entities.find(e=>e.isSentry&&!e.dead);return {alive:!!t,hp:t?.hp,damage:g.testTarget.maxHp-g.testTarget.hp};});
 R.ok(turret.alive&&turret.damage>0,'sentry survives deployment and engages a visible enemy',JSON.stringify(turret));
 const rifle=await page.evaluate(async()=>{const g=__game,I=await import('/src/rpg/items.js');g.inv.bag.push(g.inv.equip.weapon);g.inv.equip.weapon=I.makeNamed('woodrifle',4);g.recalc();g.player.reload=null;g.player.gunCd=0;g.player.setState('move');return g.player.family;});
 R.ok(rifle==='rifle','equipping a rifle switches firearm family');await sim(page,90,['KeyC']);
 R.ok(await page.evaluate(()=>__game.inv.equip.weapon.magazine.rounds)<18,'held rifle produces automatic fire');
 const save=await page.evaluate(async()=>{const g=__game;g.player.reload=null;const n=g.inv.equip.weapon.magazine.rounds;await g.save();await __start(false);return {n,loaded:g.inv.equip.weapon.magazine.rounds,cls:g.inv.cls};});
 R.ok(save.n===save.loaded&&save.cls==='gunslinger','real save/load preserves class and ammunition',JSON.stringify(save));
 // Surface verification and review captures.
 await page.evaluate(()=>{const g=__game;g.flags.guideDone=true;g.cutscene=false;g.ui.show('title',false);g.ui.navigate('skills');});
 await page.waitForTimeout(300);mkdirSync('docs/screens/gunslinger',{recursive:true});await page.screenshot({path:'docs/screens/gunslinger/skills.png'});
 R.ok(await page.locator('#inv-skills').innerText().then(t=>t.includes('Outlaw')&&t.includes('Demolitionist')&&t.includes('Machinist')),'all three skill paths render');
 await page.evaluate(()=>__game.ui.navigate('bag'));await page.waitForTimeout(250);await page.screenshot({path:'docs/screens/gunslinger/inventory.png'});
 await page.evaluate(()=>{const g=__game;g.ui.closeInventory();g.player.setState('move');g.render(0);});await page.waitForTimeout(250);await page.screenshot({path:'docs/screens/gunslinger/combat.png'});
 for(const cls of ['samurai','archer','witch','soulbound']){await fresh(page,cls);await toSquare(page);await sim(page,1,['KeyC']);const state=await page.evaluate(()=>__game.player.state);R.ok(cls==='samurai'?state==='attack':cls==='soulbound'?state==='lash':['shoot','aim','cast'].includes(state),cls+' retains its own basic attack',state);}
}
