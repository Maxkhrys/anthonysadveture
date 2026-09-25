import {fresh,sim,talkThrough} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'samurai',{level:12,stage:3});
 R.ok(await page.evaluate(()=>{const g=window.__game;const gate=g.entities.find(e=>e.constructor.name==='EmberEntry');return !!gate&&!g.inv.fireRod;}),'world contains Emberwell gate without granting tool');
 await page.evaluate(()=>{const g=window.__game;g.inv.chimes=['verdant'];g.inv.bellows=true;g.loadArea('emberwell','entrance');});await sim(page,4);
 R.ok(await page.evaluate(()=>window.__game.area.rooms.length===8),'eight authored Emberwell rooms load');
 R.ok(await page.evaluate(()=>{const g=window.__game;return !g.entities.find(e=>e.id==='ew-cinder-rod').visible;}),'Cinder Rod chest gated behind apprentice fight');
 // Trigger actual wave arena and defeat each wave using the combat damage surface.
 await page.evaluate(()=>{const g=window.__game;g.player.x=8.5;g.player.z=32.5;g.updateRoom();});
 for(let i=0;i<8;i++){await sim(page,40);await page.evaluate(()=>{const g=window.__game;for(const e of [...g.entities])if(e.isEnemy&&!e.isBoss&&!e.dead)e.onHit({dmg:99999,kind:'test',kb:0,dir:0,src:g.player});});}
 await sim(page,12);
 R.ok(await page.evaluate(()=>window.__game.signal('emberwell.workshop.clear')),'apprentice encounter unlocks real chest');
 await page.evaluate(()=>window.__game.entities.find(e=>e.id==='ew-cinder-rod').interact());await page.waitForFunction(()=>window.__game.ui.talking);await talkThrough(page,8);
 R.ok(await page.evaluate(()=>window.__game.inv.fireRod&&window.__game.inv.activeTool==='fireRod'),'chest grants and selects Cinder Rod');
 await page.evaluate(()=>{const g=window.__game;g.cutscene=false;const b=g.entities.find(e=>e.d?.id==='kiln');g.player.x=b.x;g.player.z=b.z+3;g.player.facing=Math.PI;g.player.aiming=false;g.player.faceAim=()=>{};g.updateRoom();g.castCinderRod();});await sim(page,2);
 R.ok(await page.evaluate(()=>window.__game.signal('ew.kiln')),'aimed Cinder Rod opens kiln gate');
 const relay=await page.evaluate(()=>{const g=window.__game,b=g.entities.filter(e=>e.constructor.name==='EmberBrazier'&&e.d.order!==undefined).sort((a,b)=>a.d.order-b.d.order);b[1].ignite();const reset=g.flags.ewRelay===0;b.forEach(e=>e.ignite());return reset&&g.signal('ew.relay');});R.ok(relay,'wrong furnace resets; left-middle-right opens relay gate');
 await page.evaluate(()=>{const g=window.__game;g.player.x=8.5;g.player.z=22.5;g.player.facing=Math.PI;g.updateRoom();g.gust(g.player,2);});await sim(page,3);
 R.ok(await page.evaluate(()=>window.__game.signal('ew.cool')),'one aimed charged gust solves reachable cooling puzzle');
 await page.evaluate(()=>{const g=window.__game;g.player.x=25.5;g.player.z=10;g.updateRoom();});await sim(page,4);
 const fight=await page.evaluate(()=>{const g=window.__game,b=g.entities.find(e=>e.constructor.name==='KilnRegent');const blocked=b.onHit({dmg:100,dir:0})==='guard';b.venting=true;g.player.facing=Math.PI;g.player.toolReady=0;g.castCinderRod();const exposed=b.exposed>0;b.onHit({dmg:100,dir:0});return {blocked,exposed,hp:b.hp};});R.ok(fight.blocked&&fight.exposed&&fight.hp<1800,'Regent armour blocks hits until Cinder Rod exposes core');
 await page.evaluate(()=>{const g=window.__game;g.snapCamera();g.render(0);});
 await page.screenshot({path:'/tmp/mossling-ember8.jpg'});
 await page.evaluate(()=>{const g=window.__game,b=g.entities.find(e=>e.constructor.name==='KilnRegent');b.exposed=4;b.onHit({dmg:99999,dir:0});g.entities.find(e=>e.constructor.name==='EmberChime').interact();});
 R.ok(await page.evaluate(()=>{const g=window.__game;return g.flags.emberBoss&&g.signal('ew.boss')&&g.inv.chimes.includes('ember')&&g.entities.some(e=>e.item?.unique==='dawnbringer');}),'boss victory opens vault and grants class legendary plus recoverable Ember Chime');
 await talkThrough(page,8);
 await page.evaluate(async()=>{const g=window.__game;const stone=g.entities.find(e=>e.spawn==='anvil');g.rest(stone);await g.save();});
 await page.reload();await page.waitForFunction(()=>window.__game&&!document.getElementById('loading'));await page.evaluate(()=>window.__start(false));await sim(page,4);
 R.ok(await page.evaluate(()=>{const g=window.__game;return g.area.id==='emberwell'&&g.inv.fireRod&&g.inv.chimes.includes('ember')&&!g.entities.some(e=>e.constructor.name==='KilnRegent');}),'checkpoint, tool and Chime survive reload without boss reward duplication');
}
