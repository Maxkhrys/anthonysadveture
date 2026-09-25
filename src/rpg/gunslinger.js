import * as THREE from 'three';
import { Entity } from '../entities/entity.js';
import { mesh,B,MAT } from '../models.js';
import { Projectile,segT } from './combat.js';
import { FIREARMS,isFirearm,magazine,spendRounds,completeReload } from './firearms.js';
import { sfx } from '../engine/audio.js';
export { isFirearm,magazine } from './firearms.js';
const foes=g=>g.entities.filter(e=>e.isEnemy&&!e.dead&&!(e.spawnT>0));
const sentries=p=>p.g.entities.filter(e=>e.isSentry&&!e.dead&&e.owner===p);
const visible=(g,a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r && g.shotClear(a.x,a.z,b.x,b.z);
const talent=(p,id)=>p.g.talent(id);
export function gunCost(p,id,cost){return id==='satchelcharge'&&p.satchel&&!p.satchel.dead?0:cost*(talent(p,'efficientgears')&&['powdergrenade','smokebomb','satchelcharge','sentryturret','overclock'].includes(id)?.85:1);}
export function gunReady(p,id) {return !['quickdraw','barrage'].includes(id)||(isFirearm(p.inv.equip.weapon)&&magazine(p.inv.equip.weapon).rounds>0&&!p.reload&&!p.barrage);}
export function startReload(p){
 const w=p.inv.equip.weapon,m=magazine(w);if(!m||m.rounds===FIREARMS[w.kind].capacity||p.reload)return false;
 p.reload={weapon:w,left:FIREARMS[w.kind].reload};p.g.hudDirty=true;sfx('gunreload');return true;
}
export function gunDodge(p){
 p.reload=null;const w=p.inv.equip.weapon,m=magazine(w);
 if(m&&talent(p,'rollingreload')&&!(p.rollAmmoAt>p.g.time)){m.rounds=Math.min(FIREARMS[w.kind].capacity,m.rounds+(w.kind==='rifle'?3:1));p.rollAmmoAt=p.g.time+5;}
}
export function gunTick(p,dt,locked){
 magazine(p.inv.equip.weapon);
 p.gunCd=Math.max(0,(p.gunCd||0)-dt);p.gunSpread=Math.max(0,(p.gunSpread||0)-dt*(talent(p,'steadyhands')?.32:.16));
 p.gunRecoil=Math.max(0,(p.gunRecoil||0)-dt*7);
 if(p.reload){
  if(p.inv.equip.weapon!==p.reload.weapon||['roll','hurt','dead','fall','hold'].includes(p.state))p.reload=null;
  else if(!locked){p.reload.left-=dt*(p.overclockUntil>p.g.time?1.3:1)*(p.smokeUntil>p.g.time&&talent(p,'coveringsmoke')?1.25:1);
   if(p.reload.left<=0){completeReload(p.reload.weapon,!!talent(p,'highnoon'),!!talent(p,'cleanchamber'));p.reload=null;p.g.hudDirty=true;p.g.guide.event('charge');sfx('gunready');}
  }
 }
 if(p.barrage){
  if(locked||p.state==='dead'||p.state==='roll'||p.barrage.weapon!==p.inv.equip.weapon){p.barrage=null;}
  else {p.barrage.tick-=dt;if(p.barrage.tick<=0){const b=p.barrage;b.tick=.065;fireGun(p,{ability:true,mult:b.mult,bonus:b.bonus,bypass:true,consumePrime:false});if(--b.left<=0){p.barrage=null;if(!magazine(b.weapon).rounds)startReload(p);}}}
 }
 if(!locked&&p.state==='move'&&p.g.input.pressed('reload'))startReload(p);
}
// Fixed gun pose and real model socket are shared by the flash and projectile origin.
export function gunPose(p){
 const m=p.m;if(!isFirearm(p.inv.equip.weapon))return;
 const reload=!!p.reload,k=p.gunRecoil||0;
 m.armR.rotation.set(reload?-.5:-1.12-k*.15,0,-.08);m.sword.rotation.set(1.12,0,0);
 if(p.family==='rifle')m.armL.rotation.set(-1.05,0,-.55);
 else m.armL.rotation.set(reload?-.8:0,0,reload?.4:.08);
 m.shield.visible=false;
}
function muzzle(p){
 gunPose(p);p.obj.rotation.y=p.facing;p.obj.updateMatrixWorld(true);
 const w=p.m.sword.children[0],v=new THREE.Vector3(...(w?.userData.anchors?.tip||[0,.1,p.family==='rifle'?.54:.32]));
 if(w)w.localToWorld(v);else v.set(p.x,.45,p.z);
 if(!p.g.shotClear(p.x,p.z,v.x,v.z))v.set(p.x,.45,p.z);
 return v;
}
export function fireGun(p,{ability=false,mult=1,bonus=null,bypass=false,consumePrime=true,pierce=0}={}){
 const g=p.g,w=p.inv.equip.weapon,f=FIREARMS[w?.kind],m=magazine(w);
 if(!f||p.reload||(!bypass&&p.gunCd>0))return false;
 if(!m.rounds){startReload(p);return false;}
 p.faceAim();const origin=muzzle(p),primed=consumePrime&&!!p.gunPrimed;
 const opening=m.opening||0,spectral=!!m.spectral; m.opening=0;m.spectral=false;
 if(primed)p.gunPrimed=false;
 spendRounds(w);const final=m.rounds===0;
 const power=ability?1.35/f.power:1;
 const copies=1+Math.min(3,(g.pstats.arpg?.stats.projectileCount||0)+(g.pstats.arpg?.mods.projectileCount||0));
 const extra=(bonus??(primed?.6*1.35/f.power:0))/copies;
 const openingPower=(opening+(spectral?2:0))*1.35/f.power;
 const dir=p.facing+(w.kind==='rifle'?(Math.random()-.5)*(p.gunSpread||0):0);
 let awarded=false;
 const shot=new Projectile(g,{x:origin.x,z:origin.z,dir,speed:32,range:11,mult:mult*power+extra+openingPower,kind:'bullet',r:.07,pierce:pierce+(spectral||opening>=1?1:0),kb:primed||final&&talent(p,'lastround')?5:1.5,basic:!ability,ability,color:spectral?0xbdf8ff:0xffd38b,
  onHitFx:(pr,e)=>{
   if(pr.hitResult!=='hit'||pr.arpgExtra||pr.arpgProc)return;
   if(final)m.finalHit=true;
   if(!awarded&&p.cls==='gunslinger'){awarded=true;g.res=Math.min(100,g.res+(w.kind==='rifle'?1.3:4));}
   if(primed||final&&talent(p,'lastround'))e.stagger=Math.max(e.stagger||0,.3);
   if(e.attachedGrenade&&!e.attachedGrenade.dead&&w.unique==='kilnrunner')e.attachedGrenade.boost=Math.min(.5,(e.attachedGrenade.boost||0)+.1);
   if(talent(p,'linkedfire')){p.linkedTarget=e;p.linkedUntil=g.time+2;}
   if(talent(p,'fieldservice')&&!(p.repairAt>g.time)){let repaired=false;for(const t of sentries(p))if(visible(g,p,t,4)){t.hp=Math.min(t.maxHp,t.hp+3);repaired=true;}if(repaired)p.repairAt=g.time+2;}
   if(primed&&w.unique==='bellfoundryrepeater'&&!(p.syncAt>g.time)){const t=sentries(p).find(t=>visible(g,t,e,8));if(t){p.syncAt=g.time+3;t.fire(e,1.5);}}
  }});
 shot.y=Math.max(.15,origin.y-shot.gy0);shot.manualGun=true;shot.gunOwner=p;
 g.spawn(shot);p.gunCd=f.interval/Math.max(.5,Math.min(2,g.pstats.wspd)) /(p.overclockUntil>g.time?1.3:1);
 p.gunSpread=Math.min(.2,(p.gunSpread||0)+(w.kind==='rifle'?.028:0));p.gunRecoil=1;p.combatT=3;
 g.fx.burst(origin.x,origin.y,origin.z,4,spectral?0xbdf8ff:0xffd38b,1,{life:.07,size:.035});
 sfx(spectral?'seventhshot':w.kind==='rifle'?'rifleshot':'revolvershot');g.hudDirty=true;
 if(!m.rounds&&!p.barrage)startReload(p);return true;
}
export function detonateSatchel(p){if(!p.satchel||p.satchel.dead)return false;p.satchel.explode();p.satchel=null;return true;}
export function gunAbility(p,id,rm,at,first){
 if(p.cls!=='gunslinger')return false;
 const g=p.g;
 switch(id){
 case 'quickdraw':fireGun(p,{ability:true,mult:2.4*rm,bypass:true,pierce:1});break;
 case 'barrage':{const w=p.inv.equip.weapon,n=Math.min(6,magazine(w).rounds),bonus=p.gunPrimed?.6*1.35/FIREARMS[w.kind].power/n:0;p.gunPrimed=false;p.barrage={weapon:w,left:n,tick:0,mult:rm,bonus};break;}
 case 'deadeyemark':p.marked=first;p.markUntil=g.time+8;g.fx.ring(first.x,first.z,.1,.6,0xffc477,.4);break;
 case 'powdergrenade':g.spawn(new Powder(g,p,at,3*rm));break;
 case 'smokebomb':p.smokeUntil=g.time+4;g.spawn(new Smoke(g,p));break;
 case 'satchelcharge':if(!detonateSatchel(p)){p.satchel=new Powder(g,p,at,5*rm,true);g.spawn(p.satchel);}break;
 case 'sentryturret':{const ts=sentries(p),limit=talent(p,'twinsentries')?2:1;if(ts.length>=limit)ts[0].remove();g.spawn(new Sentry(g,p,at,rm));break;}
 case 'overclock':p.overclockUntil=g.time+6;g.fx.ring(p.x,p.z,.2,1.5,0x78bbb2,.4);break;
 default:return false;
 }
 // Consumption happens before priming. Gadget casts never consume existing priming.
 p.gunPrimed=true;g.hudDirty=true;return true;
}
function explode(g,p,x,z,r,power,element='fire',secondary=false){
 g.fx.ring(x,z,.1,r,element==='frost'?0xace8ff:element==='lightning'?0xffe679:0xff9448,.35);sfx('gunblast');
 const hit=foes(g).filter(e=>visible(g,{x,z},e,r+(e.r||.3)));
 for(const e of hit){g.playerHit(e,{mult:power*1.35/(FIREARMS[p.inv.equip.weapon?.kind]?.power||1.35),kind:'blast',heavy:true,ability:true,element,kb:6,dir:Math.atan2(e.x-x,e.z-z)});e.applyStatus?.(element==='frost'?'chill':element==='lightning'?'shock':'burn',2);}
 if(!secondary&&talent(p,'chainreaction'))for(const e of hit.slice(0,3))explode(g,p,e.x,e.z,1,power*.25,element,true);
}
export class Powder extends Entity{
 constructor(g,p,at,power,satchel=false){super(g,p.x,p.z);this.owner=p;this.power=power;this.satchel=satchel;this.tx=at.x;this.tz=at.z;this.sx=p.x;this.sz=p.z;this.t=0;this.alwaysUpdate=true;this.m=mesh([B(satchel?.25:.14,.16,.14,0,0,0,satchel?0x795138:0x494c4e),B(.04,.06,.04,0,.16,0,0xe9bc60)],MAT,false);this.obj.add(this.m);this.sync();}
 update(dt){this.t+=dt;const g=this.g,p=this.owner;if(p!==g.player||p.state==='dead')return this.remove();const last={x:this.x,z:this.z},k=Math.min(1,this.t/.45);
  if(this.attached&&!this.attached.dead){this.x=this.attached.x;this.z=this.attached.z;}else{this.x=this.sx+(this.tx-this.sx)*k;this.z=this.sz+(this.tz-this.sz)*k;}
  if(!this.satchel&&!this.attached&&(talent(p,'stickyfuses')||p.inv.equip.weapon?.unique==='kilnrunner')){const e=foes(g).find(e=>segT(last.x,last.z,this.x,this.z,e.x,e.z).d<(e.r||.3)+.12&&g.shotClear(last.x,last.z,e.x,e.z));if(e){this.attached=e;e.attachedGrenade=this;}}
  this.sync();this.m.position.y=.1+Math.sin(k*Math.PI)*1.4;
  if(!this.satchel&&this.t>=1.2)this.explode();if(this.satchel&&this.t>30)this.remove();
 }
 explode(){if(this.dead)return;const p=this.owner,shaped=this.satchel&&talent(p,'shapedcharge');const element=talent(p,'elementalpayload')?(['fire','frost','lightning'].includes(p.inv.gunPayload)?p.inv.gunPayload:'fire'):'fire';explode(this.g,p,this.x,this.z,(this.satchel?2.5:2)*(shaped?.75:1),this.power*(shaped?1.4:1)*(1+(this.boost||0)),element);if(this.attached?.attachedGrenade===this)this.attached.attachedGrenade=null;this.remove();}
}
class Smoke extends Entity{
 constructor(g,p){super(g,p.x,p.z);this.owner=p;this.t=0;this.alwaysUpdate=true;this.isGunSmoke=true;this.radius=2.5;this.m=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,.12,24),new THREE.MeshBasicMaterial({color:0xb8b6a5,transparent:true,opacity:.22,depthWrite:false}));this.obj.add(this.m);this.sync();}
 update(dt){this.t+=dt;if(this.t>4||this.owner!==this.g.player)return this.remove();const p=this.owner;if(Math.hypot(p.x-this.x,p.z-this.z)<2.5)p.smokeUntil=this.g.time+.1;else p.smokeUntil=0;for(const e of foes(this.g))if(!e.isBoss&&visible(this.g,this,e,2.5))e.applyStatus?.('chill',.15);this.m.material.opacity=.16+Math.sin(this.t*4)*.04;}
}
export class Sentry extends Entity{
 constructor(g,p,at,rm){super(g,at.x,at.z);this.owner=p;this.isSentry=true;this.state='idle';this.t=0;this.tick=.25;this.rm=rm;this.hp=this.maxHp=talent(p,'reinforcedhousing')?60:30;this.alwaysUpdate=true;this.m=mesh([B(.36,.1,.32,0,0,0,0x5b4433),B(.18,.25,.18,0,.1,0,0xb8904f),B(.1,.1,.5,0,.35,.15,0x343b40),B(.14,.14,.16,.13,.2,0,0x9d6f46)],MAT,true);this.obj.add(this.m);this.sync();}
 onHit(h){return this.hurt(h);}
 hurt(h){if(this.dead||!h.src?.isEnemy)return false;this.hp-=Math.max(1,(h.dmg||1)*6);this.g.fx.ring(this.x,this.z,.1,.4,0xe78663,.15);if(this.hp<=0){this.state='dead';this.remove();}return true;}
 fire(e,bonus=1){if(!visible(this.g,this,e,8))return;const g=this.g,p=this.owner;let mult=.45*this.rm*bonus*1.35/(FIREARMS[p.inv.equip.weapon?.kind]?.power||1.35)*(talent(p,'twinsentries')?.65:1);if(p.marked===e&&p.markUntil>g.time&&talent(p,'prioritytarget'))mult*=1.25;if(p.linkedTarget===e&&p.linkedUntil>g.time&&talent(p,'linkedfire'))mult*=1.2;mult*=1+(g.pstats.arpg?.stats.turretDamage||0)/100;const dir=Math.atan2(e.x-this.x,e.z-this.z);this.m.rotation.y=dir;g.spawn(new Projectile(g,{x:this.x,z:this.z,dir,speed:26,range:8,mult,kind:'bullet',color:0xe4b869,r:.06,ability:true,arpgProc:true,arpgChild:true}));}
 update(dt){const g=this.g,p=this.owner;this.t+=dt;this.tick-=dt;if(this.t>12||this.hp<=0||p!==g.player||p.state==='dead')return this.remove();const all=foes(g).filter(e=>visible(g,this,e,8));const e=p.markUntil>g.time&&all.includes(p.marked)?p.marked:all.sort((a,b)=>Math.hypot(a.x-this.x,a.z-this.z)-Math.hypot(b.x-this.x,b.z-this.z))[0];if(e&&this.tick<=0){this.fire(e);this.tick=.6/(p.overclockUntil>g.time?1.3:1);}}
}
