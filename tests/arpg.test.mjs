import {fresh,sim} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'witch',{level:16});
 const setup=await page.evaluate(async()=>{
  const g=window.__game;
  g.flags.onboarding={phase:'complete',done:{}};g.cutscene=false;g.onboarding.warning=null;
  const I=await import('/src/rpg/items.js'),C=await import('/src/rpg/combat.js'),D=await import('/src/rpg/arpg/definitions.js');
  window.__arpg={I,C,D};
  // Find a genuinely open range, independent of town edits and procedural props.
  const clear=(x,z)=>[0,1,2,15,16,17,18].includes(g.tileAt(Math.floor(x),Math.floor(z)))&&!g.solidAt(x,z,.5);
  let at=null;outer:for(let z=100;z<150;z++)for(let x=130;x<180;x++){
   let ok=true;for(let a=-4;a<=4&&ok;a++)for(let b=-4;b<=4;b++)if(!clear(x+a+.5,z+b+.5)){ok=false;break;}
   if(ok){at={x:x+.5,z:z+.5};break outer;}
  }
  if(!at)return false;
  g.player.x=at.x;g.player.z=at.z;g.player.facing=0;g.player.sync();g.snapCamera();
  window.__arpg.at=at;
  window.__arpg.clean=()=>{for(const e of g.entities)if(e.isEnemy||e instanceof C.Projectile)e.remove();g.entities=g.entities.filter(e=>!e.dead);g.itemCombat.reset();};
  window.__arpg.dummy=(dx=0,dz=2,hp=100000)=>{const e=g.spawnEnemy('blot',at.x+dx,at.z+dz,{noRoom:true});e.spawnT=0;e.elite=null;e.poise=true;e.kbMul=0;e.think=()=>[0,0];e.hp=e.maxHp=hp;e.dmgTaken=1;return e;};
  window.__arpg.equip=(effects=[],mods=[])=>{const w=I.makeNamed('frostrod',16,3);w.stats={};w.rolledAffixes=[];w.affixes=[];w.modifiers=[];w.element='frost';w.effects=effects.map(id=>({id,chance:1}));w.skillMods=mods;g.inv.equip.weapon=w;g.recalc();g.itemCombat.random=()=>0;return w;};
  window.__arpg.clean();window.__arpg.equip();return true;
 });R.ok(setup,'open combat range independent of village props');if(!setup)return;
 const rolls=await page.evaluate(async()=>{
  const {I}=window.__arpg,g=window.__game;
  const a=I.makeNamed('frostrod',16,3),b=I.makeNamed('frostrod',16,3),prism=I.genItem({level:16,slot:'weapon',cls:'witch',rarity:5});
  g.inv.bag=[a,b,prism];await g.save();const data=JSON.parse(localStorage.getItem('mossling-save-v2'));const saved=data.characters.find(p=>p.id===g.profile.id).inventory.bag;
  g.ui.navigate('bag');g.ui.invSel=2;g.ui.renderInventory();
  return{roundtrip:JSON.stringify(saved.map(i=>[i.effects,i.modifiers,i.skillMods]))===JSON.stringify(g.inv.bag.map(i=>[i.effects,i.modifiers,i.skillMods])),rarity:prism.r,version:data.schemaVersion,tt:document.getElementById('tooltip').textContent};
 });
 R.ok(rolls.roundtrip&&rolls.version===4,'real storage preserves effects, modifier ranges and mutations');R.ok(rolls.rarity===5&&rolls.tt.includes('Prismatic'),'Prismatic item renders through real inventory inspector');R.ok(/on (hit|crit|cast|kill|dash|dodge)/.test(rolls.tt),'inspector explains proc triggers');
 await page.screenshot({path:'/tmp/arpg-inventory.png'});
 await page.evaluate(()=>window.__game.ui.navigate('resume'));
 const hits=await page.evaluate(()=>{
  const {clean,equip,dummy}=window.__arpg,g=window.__game;clean();equip(['poison_touch']);const e=dummy();g.playerHit(e,{mult:1,kind:'bolt',basic:true,kb:0,dir:0});g.itemCombat.update(.016);const stacks=g.itemCombat.statuses.get(e)?.get('poison')?.stacks||0,hp=e.hp;g.itemCombat.update(.6);return{stacks,dot:e.hp<hp};
 });R.ok(hits.stacks>0&&hits.dot,'real player hit triggers status and subsequent damage over time');
 const projectiles=await page.evaluate(()=>{
  const {clean,equip,C,at}=window.__arpg,g=window.__game;clean();equip([],['fan','piercer','fork','returning']);g.player.fireBasic(false);
  const ps=g.entities.filter(e=>e instanceof C.Projectile&&!e.dead);return{count:ps.length,pierce:ps.every(p=>p.pierce>=2),bounded:ps.every(p=>p.arpgDepth<=3)};
 });R.ok(projectiles.count===3&&projectiles.pierce&&projectiles.bounded,'real basic volley combines extra projectiles and pierce safely',JSON.stringify(projectiles));
 const fork=await page.evaluate(()=>{
  const {clean,equip,dummy,C,at}=window.__arpg,g=window.__game;clean();equip([],['fork']);const e=dummy(0,2);const p=new C.Projectile(g,{x:at.x,z:at.z,dir:0,kind:'bolt',basic:true,pierce:1});g.spawn(p);
  p.update(.15);const children=g.entities.filter(e=>e instanceof C.Projectile&&e.arpgChild&&!e.dead);return{damaged:e.hp<e.maxHp,count:children.length,depth:children.every(p=>p.arpgDepth===1)};
 });R.ok(fork.damaged&&fork.count===2&&fork.depth,'projectile collision creates two bounded child shots',JSON.stringify(fork));
 const mechanics=await page.evaluate(()=>{
  const {clean,equip,dummy,D}=window.__arpg,g=window.__game;clean();equip();const e=dummy();
  g.itemCombat.execute(D.PROC_DEFS.meteor,{target:e,depth:1});g.itemCombat.update(.5);const before=e.hp===e.maxHp;g.itemCombat.update(.6);const after=e.hp<e.maxHp;
  g.itemCombat.reset();g.itemCombat.execute(D.PROC_DEFS.poison_mine,{target:e,depth:1});g.itemCombat.update(.1);const armed=g.itemCombat.entities.length===1;g.itemCombat.update(.4);const triggered=g.itemCombat.entities.length===0;
  g.itemCombat.execute(D.PROC_DEFS.spirit_guardian,{target:e,depth:1});const h=e.hp;g.itemCombat.update(.1);return{before,after,armed,triggered,ally:e.hp<h};
 });R.ok(Object.values(mechanics).every(Boolean),'meteor, armed trap and autonomous ally deal actual game damage',JSON.stringify(mechanics));
 const all=await page.evaluate(()=>{
  const {clean,equip,dummy,D}=window.__arpg,g=window.__game;const errors=[];
  for(const def of Object.values(D.PROC_DEFS)){try{clean();equip();const e=dummy(),other=dummy(1,2);g.itemCombat.execute(def,{target:e,depth:1});for(let i=0;i<6;i++)g.itemCombat.update(.3);}catch(e){errors.push(def.id+': '+e.message);}}
  return{count:Object.keys(D.PROC_DEFS).length,errors};
 });R.ok(all.errors.length===0,'all registered proc handlers execute in live game',JSON.stringify(all));
 const cleanup=await page.evaluate(()=>{const g=window.__game,{D,dummy}=window.__arpg;g.itemCombat.execute(D.PROC_DEFS.firewall,{target:dummy(),depth:1});g.loadArea('overworld','village');return g.itemCombat.entities.length===0&&g.itemCombat.statuses.size===0&&g.itemCombat.queue.length===0;});R.ok(cleanup,'scene transition removes statuses, zones and proc queue');
 await sim(page,3);
}
