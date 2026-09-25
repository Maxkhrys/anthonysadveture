import {fresh,toSquare,sim} from './lib.mjs';import {mkdirSync} from 'node:fs';
export default async function(page,R){
 await fresh(page,'gunslinger',{level:8});await toSquare(page);mkdirSync('docs/screens/enemy-hud',{recursive:true});
 const checks=await page.evaluate(async()=>{
 const g=__game,p=g.player,D=await import('/src/enemy_depth.js'),H=await import('/src/rpg/combat_readability.js'),S=await import('/src/settings.js');g.flags.onboarding=null;g.flags.guideDone=true;g.noRender=true;
 const out={};const enemy=(kind,dx,dz)=>{const e=g.spawnEnemy(kind,p.x+dx,p.z+dz,{noRoom:true,eliteChance:0});e.spawnT=0;e.hp=e.maxHp=400;e.setState('chase');return e;};
 const e=enemy('blot',2,1);e.elite='Stormtouched';e.think=()=>[0,0];g.tokens=0;
 D.depthTick(e,.31);let w=g.entities.find(x=>x.isEliteWarning&&!x.dead);out.warning=!!w&&g.tokens===1;const pos=[w.x,w.z];p.x+=3;out.locked=pos[0]===w.x&&pos[1]===w.z;
 const hp=g.inv.hp;w.update(1.2);out.dodge=g.inv.hp===hp&&w.dead&&g.tokens===0;p.x-=3;
 g.tokens=3;out.tokenCap=!D.spawnWarning(e);g.tokens=0;
 D.spawnWarning(e);w=g.entities.filter(x=>x.isEliteWarning&&!x.dead).at(-1);e.stagger=2;w.update(1.2);out.interrupt=g.inv.hp===hp;e.stagger=0;
 D.spawnWarning(e,'Frostbound');w=g.entities.filter(x=>x.isEliteWarning&&!x.dead).at(-1);p.x=w.x;p.z=w.z;w.update(1.2);out.slow=p.depthSlowUntil>g.time&&p.depthSlowUntil<=g.time+1.3;
 e.elite='Armoured';e.setState('chase');e.depthClock=0;D.depthTick(e,.3);e.facing=0;out.guard=D.eliteHit(e,{dir:Math.PI})===.55&&D.eliteHit(e,{dir:0})===1;D.eliteHit(e,{dir:Math.PI,heavy:true});out.break=!e.bulwarkGuard&&e.stagger>0;
 const shield=enemy('brigand',0,4),ranged=enemy('wisp',0,7);shield.depthClock=1;shield.formationAlly=ranged;shield.formationAt=2;out.frontline=!!D.tacticalMove(shield,[0,0]).some(x=>x!==0);
 const flank=enemy('mantis',3,3);const v=D.tacticalMove(flank,[0,0]);out.flank=v.some(x=>x!==0);
 enemy('blot',.5,.5);e.elite='Vampiric';e.hp=200;e.stagger=0;e.depthNext=0;D.depthTick(e,.3);out.tether=!!e.bloodLink&&e.hp>200;
 const hp1=e.hp;for(const x of g.entities)if(x.isEnemy&&x!==e)x.remove();e.depthNext=0;D.depthTick(e,.3);out.breakTether=!e.bloodLink&&e.hp===hp1;
 for(let i=0;i<20;i++){const x=enemy('blot',(i%5)-2,3+Math.floor(i/5)*.35);x.hpShow=5;x.think=()=>[0,0];x.applyStatus('wet',3);x.applyStatus('burn',3,1);}
 S.applySettings({...g.settings,enemyBars:'balanced'},g);g.ui.updateFloats(.11);out.barCap=g.ui.bars.size<=12&&g.ui.bars.size>0;
 S.applySettings({...g.settings,enemyBars:'focused'},g);g.ui.updateFloats(.11);out.focused=g.ui.bars.size<=4;
 S.applySettings({...g.settings,enemyBars:'off'},g);g.ui.updateFloats(.11);out.off=g.ui.bars.size===0;
 S.applySettings({...g.settings,hudMode:'compact',enemyBars:'balanced',panelMode:'exploration',miniScale:.75,hitFlash:.5,damageIntensity:'reduced'},g);S.saveSettings(g.settings);out.saved=S.loadSettings().hudMode==='compact'&&S.loadSettings().miniScale===.75;
 out.panels=document.documentElement.dataset.panelMode==='exploration';
 for(const x of g.entities)if(x.isEnemy)x.remove();g.ui.updateFloats(.11);out.cleanup=g.ui.bars.size===0&&!document.documentElement.classList.contains('combat-active');
 g.noRender=false;return out;});
 for(const [k,v]of Object.entries(checks))R.ok(v,k);
 await page.evaluate(()=>{const g=__game;g.noRender=false;g.ui.navigate('settings');g.ui.show('toast',false);g.ui.toastT=0;});await page.locator('#tab-settings [data-category=HUD]').click();
 await page.locator('#setting-hudMode').selectOption('2');R.ok(await page.evaluate(()=>__game.settings.hudMode==='immersive'),'HUD mode changes through real Settings control');
 await page.screenshot({path:'docs/screens/enemy-hud/settings.png'});
 await page.reload();await page.waitForFunction(()=>window.__game&&!document.getElementById('loading'));R.ok(await page.evaluate(()=>__game.settings.hudMode==='immersive'&&__game.settings.miniScale===.75),'HUD preferences survive a page reload');
 await fresh(page,'gunslinger',{level:8});await toSquare(page);
 await page.evaluate(()=>{const g=__game,p=g.player;g.flags.onboarding=null;g.flags.guideDone=true;for(const e of g.entities)if(e.isEnemy)e.remove();const kinds=['brigand','wisp','moth','knight'];kinds.forEach((kind,i)=>{const e=g.spawnEnemy(kind,p.x-2+i*1.5,p.z+2,{noRoom:true,eliteChance:0});e.spawnT=0;e.hp=e.maxHp=250;e.hpShow=99;e.think=()=>[0,0];e.setState('chase');if(i===1){g.makeElite(e);e.elite='Stormtouched';e.displayName='Storm-touched Hushwisp';e.eliteNext=g.time+100;}e.applyStatus('wet',99);e.applyStatus('shock',99);});g.ui.show('toast',false);g.ui.toastT=0;g.render(.2);});
 for(const mode of ['classic','compact','immersive']){await page.evaluate(async mode=>{const g=__game,S=await import('/src/settings.js');S.applySettings({...g.settings,hudMode:mode,miniScale:1,panelMode:'always',enemyBars:'balanced',hudScale:1},g);g.ui.updateFloats(.2);g.render(.2);},mode);await page.screenshot({path:`docs/screens/enemy-hud/${mode}.png`});}
 const leveled=await page.evaluate(()=>{const g=__game,before=g.inv.sp;g.gainXp(1000);g.render(.2);return g.inv.sp>before&&document.getElementById('banner').textContent.includes('SKILL POINT');});R.ok(leveled,'level-up grants points and shows a clear celebration');await page.screenshot({path:'docs/screens/enemy-hud/level-up.png'});
 await page.evaluate(async()=>{const g=__game,C=await import('/src/rpg/combat.js'),I=await import('/src/rpg/items.js');g.spawn(new C.GearDrop(g,g.player.x+3,g.player.z,I.genItem({cls:'gunslinger',level:8,rarity:4,slot:'weapon'})));g.render(.2);});R.ok(await page.evaluate(()=>__game.entities.some(e=>e.constructor.name==='GearDrop'&&e.item.r>=4)),'legendary reward remains a real collectible');await page.screenshot({path:'docs/screens/enemy-hud/rare-drop.png'});
 const boss=await page.evaluate(async()=>{const g=__game,p=g.player,{Boss}=await import('/src/entities/boss.js'),{Seamkeeper}=await import('/src/entities/bosses5.js');
 for(const e of g.entities)if(e.isEnemy)e.remove();g.ui.show('banner',false);g.ui.show('toast',false);g.ui.bannerT=0;g.ui.toastT=0;
 const b=new Boss(g,p.x,p.z-3);g.spawn(b);b.setState('inhale');b.st=.5;const h={dmg:10,dir:0,kind:'sword',src:p};const hp=b.hp;const guarded=b.onHit(h)==='clang'&&b.hp===hp;b.choke('gust');b.onHit(h);const opened=b.hp<hp;b.update=()=>{};g.ui.bossBar(b.name,b.hp/b.maxHp);g.ui.updateFloats(.2);g.render(.2);
 const c=new Seamkeeper(g,p.x+10,p.z,{id:'test',x0:p.x-10,z0:p.z-10,x1:p.x+15,z1:p.z+15});c.applyStatus('freeze',3);const resists=!c.status.freeze&&c.status.chill===3;c.remove();g.ui.show('toast',false);g.ui.toastT=0;return{guarded,opened,resists};});
 for(const [k,v]of Object.entries(boss))R.ok(v,'boss '+k);
 await page.waitForTimeout(180);await page.evaluate(()=>__game.render(.2));await page.screenshot({path:'docs/screens/enemy-hud/boss.png'});
 await page.evaluate(async()=>{const g=__game,p=g.player,D=await import('/src/enemy_depth.js');for(const e of g.entities)if(e.isEnemy)e.remove();g.ui.bossBar(null);g.tokens=0;const e=g.spawnEnemy('blot',p.x+3,p.z,{noRoom:true,eliteChance:0});e.spawnT=0;e.elite='Stormtouched';e.displayName='Storm-touched Blotling';e.setState('chase');e.eliteNext=g.time+100;e.think=()=>[0,0];D.spawnWarning(e);g.ui.updateFloats(.2);g.render(.2);});
 await page.screenshot({path:'docs/screens/enemy-hud/lightning-warning.png'});
 await page.setViewportSize({width:960,height:640});await page.evaluate(async()=>{const g=__game,S=await import('/src/settings.js');S.applySettings({...g.settings,hudMode:'compact',hudScale:1},g);g.render(.2);});
 const bounds=await page.locator('#hero-plaque').boundingBox();R.ok(bounds.x>=0&&bounds.x+bounds.width<=960,'compact HUD stays inside smaller desktop viewport');
 await page.screenshot({path:'docs/screens/enemy-hud/compact-960.png'});

}

