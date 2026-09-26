import {fresh} from './lib.mjs';import {mkdirSync} from 'node:fs';
export default async function(page,R){
 await fresh(page,'samurai');
 await page.evaluate(()=>{const g=__game;g.noRender=true;const r=g.survivalMode.store.create({name:'Field kit',cls:'samurai',seed:524});g.survivalMode.start(r);g.noRender=true;g.cutscene=false;g.player.combatT=0;g.inv.bag.push(__items.makeNamed('candelabra',12,null,'witch'));});
 const checks=await page.evaluate(async()=>{
  const g=__game,m=g.survival;const {identifyItem}=await import('/src/persistence/model.js');identifyItem(g.inv.bag.at(-1),g.profile.id);await g.save();g.survivalUI.refresh();
  const {selectBelt,reconcileBelt}=await import('/src/survival/fieldkit.js'),belt=reconcileBelt(m.record,g),id=g.inv.bag.at(-1).itemInstanceId,idx=belt.slots.indexOf(id),exact=JSON.stringify(g.inv.bag.at(-1));
  const swapped=selectBelt(g,idx),same=JSON.stringify(g.inv.equip.weapon)===exact;
  g.player.reload={t:2};const blocked=!selectBelt(g,0);g.player.reload=null;
  m.record.resources.wood=20;m.record.resources.fibre=20;const crafted=m.craft('torch',3),cost=m.record.resources.wood===17&&m.record.resources.fibre===17&&m.record.kits.torch===6;
  const before=JSON.stringify(m.record.resources),bad=!m.craft('torch',-1).ok&&before===JSON.stringify(m.record.resources);
  g.inv.potions=g.inv.maxPotions;const full=!m.canCraft('tonic').ok;
  g.survivalUI.openCraft();const t=g.time;g.update(1);const paused=t===g.time;
  await g.save();const saved=m.store.get(m.record.id);return {swapped,same,blocked,cost:crafted.ok&&cost,bad,full,paused,persist:saved.fieldKit.slots[idx]===id};
 });for(const [k,v]of Object.entries(checks))R.ok(v,k);
 await page.getByRole('button',{name:'Track materials',exact:true}).click();
 R.ok(await page.evaluate(()=>__game.survival.record.trackedRecipe==='campfire'),'recipe tracked in world save');
 mkdirSync('docs/screens/fieldcraft',{recursive:true});
 for(const [w,h]of [[1280,720],[1920,1080],[390,844]]){await page.setViewportSize({width:w,height:h});await page.screenshot({path:`docs/screens/fieldcraft/crafting-${w}.jpg`,type:'jpeg',quality:85});R.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal page overflow ${w}`);}
 await page.setViewportSize({width:1280,height:720});
 await page.getByRole('button',{name:'Materials',exact:true}).click();R.ok(await page.locator('.material-grid article').count()===5,'material guidance shares inventory');await page.screenshot({path:'docs/screens/fieldcraft/materials.jpg',type:'jpeg',quality:85});
 await page.getByRole('button',{name:'Building',exact:true}).click();
 await page.screenshot({path:'docs/screens/fieldcraft/building.jpg',type:'jpeg',quality:85});
 await page.evaluate(()=>{__game.ui.closeInventory();__game.noRender=false;__game.render(0);__game.noRender=true;});await page.screenshot({path:'docs/screens/fieldcraft/belt.jpg',type:'jpeg',quality:85});
 // Inject the browser's actual Gamepad API boundary; route the same input and UI used by RAF.
 const pad=await page.evaluate(()=>{
  const g=__game;window.testPad={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});
  const press=n=>{testPad.buttons.forEach((b,i)=>b.pressed=i===n);g.input.update();__routeController(.05);};
  g.ui.openInventory();press(-1);const search=document.querySelector('.bag-search input');search.focus();press(0);const keyboard=!!g.controllerUI.keyboard;press(-1);press(0);press(-1);press(1);const typed=search.value==='a';press(-1);press(5);const focused=document.activeElement!==document.body;press(-1);press(1);const closed=!g.ui.invOpen;g.input.update();__routeController(.05);const leak=!g.input.down('roll');
  press(-1);testPad.axes=[.7,0,0,1];g.input.update();const aim=g.input.mx>0&&g.input.padAim?.z===1;
  testPad=null;g.input.update();__routeController(.05);const disconnected=!g.input.padConnected&&g.input.mx===0&&g.input.padAim===null;
  return {keyboard,typed,focused,closed,leak,aim,disconnected};
 });for(const [k,v]of Object.entries(pad))R.ok(v,'controller '+k);
 const saved=await page.evaluate(async()=>{const g=__game;await g.save();return {id:g.survival.record.id,slots:JSON.stringify(g.survival.record.fieldKit.slots),recipe:g.survival.record.trackedRecipe};});
 await page.reload();await page.waitForFunction(()=>window.__game&&!document.getElementById('loading'));
 await page.evaluate(async id=>{await __startSurvival(id);__game.noRender=true;},saved.id);
 R.ok(await page.evaluate(s=>JSON.stringify(__game.survival.record.fieldKit.slots)===s.slots&&__game.survival.record.trackedRecipe===s.recipe,saved),'refresh restores belt references and tracked recipe');
 await page.evaluate(()=>{const g=__game,node=g.entities.find(e=>e.isNode&&e.type==='tree');if(node){g.player.x=node.x-1;g.player.z=node.z;g.snapCamera();node.work(1,1.57);g.fx.update(.04,g.cam);g.noRender=false;g.render(0);g.noRender=true;}});
 await page.screenshot({path:'docs/screens/fieldcraft/gathering.jpg',type:'jpeg',quality:85});

}
