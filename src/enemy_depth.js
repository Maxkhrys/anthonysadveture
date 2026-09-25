import * as THREE from 'three';
import {Entity} from './entities/entity.js';
import {roleOf,canThreaten} from './rpg/combat_readability.js';
import {sfx} from './engine/audio.js';

// A stationary, bounded warning; it never chases the player after creation.
export class EliteWarning extends Entity {
 constructor(g,src,kind,x,z){super(g,x,z);this.src=src;this.kind=kind;this.isEliteWarning=true;this.alwaysUpdate=true;this.t=0;this.r=kind==='Frostbound'?2.5:kind==='Volatile'?2:1.25;this.delay=kind==='Volatile'?1.15:1.1;this.area=g.area;this.reserved=true;g.tokens++;
 const c=kind==='Frostbound'?0xb6eaff:kind==='Volatile'?0xffa854:0x80d8ff;
 this.color=c;this.mat=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false});
 this.geo=new THREE.RingGeometry(this.r*.9,this.r,40);this.ring=new THREE.Mesh(this.geo,this.mat);this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.06;this.obj.add(this.ring);
 this.inner=new THREE.Mesh(this.geo,this.mat);this.inner.rotation.x=-Math.PI/2;this.inner.position.y=.065;this.obj.add(this.inner);sfx('elitewarn');}
 update(dt){const g=this.g,p=g.player;if(g.area!==this.area||g.cutscene||g.dead||(this.kind!=='Volatile'&&this.src.dead)){this.remove();return;}this.t+=dt;this.inner.scale.setScalar(Math.min(1,this.t/this.delay));
 if(this.t<this.delay)return;
 // Leaving the screen, breaking line of sight or interrupting the caster prevents the hit.
 if(g.onScreen(this.x,this.z,.1)&&g.shotClear(this.x,this.z,p.x,p.z)&&(this.kind==='Volatile'||canThreaten(this.src,g))){
 g.fx.ring(this.x,this.z,.1,this.r,this.color,.35);g.fx.burst(this.x,.3,this.z,12,this.color,2);sfx(this.kind==='Frostbound'?'shatter':'zap');
 if(this.dist(p)<this.r+p.r){if(this.kind==='Frostbound'){p.depthSlowUntil=g.time+1.25;}else p.hurt({dmg:1.25,x:this.x,z:this.z,src:this.src,kb:3});}}
 this.remove();}
 remove(){if(this.dead)return;if(this.reserved){this.g.tokens=Math.max(0,this.g.tokens-1);this.reserved=false;}this.geo.dispose();this.mat.dispose();super.remove();}
}
export function spawnWarning(e,kind=e.elite){const g=e.g;if(g.tokens>=(g.bossActive?2:3)||g.entities.filter(x=>x.isEliteWarning&&!x.dead).length>=3)return false;const p=g.player;g.spawn(new EliteWarning(g,e,kind,kind==='Stormtouched'?p.x:e.x,kind==='Stormtouched'?p.z:e.z));return true;}
export function depthTick(e,dt){if(e.isBoss||e.dead)return;const g=e.g;
 e.depthClock=(e.depthClock||0)+dt;
 if(e.elite==='Armoured')e.bulwarkGuard=e.depthClock%6<3.5&&e.stagger<=0&&e.state!=='recover';
 if(e.depthClock<(e.depthNext||0))return;e.depthNext=e.depthClock+.3;
 e.bloodLink=null;
 if(!canThreaten(e,g))return;
 if(['Stormtouched','Frostbound'].includes(e.elite)&&g.time>(e.eliteNext??g.time-1)&&!e.token){
 if(spawnWarning(e)){e.eliteNext=g.time+6;e.setState('recover');e.hpShow=2;}
 }
 if(e.elite==='Vampiric'){
 const ally=g.entities.find(a=>a!==e&&a.isEnemy&&!a.dead&&!a.isBoss&&e.dist(a)<3&&g.shotClear(e.x,e.z,a.x,a.z));
 if(ally){e.bloodLink=ally;e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.003);g.fxBolt?.(e.x,e.z,ally.x,ally.z,0xd96f91);}
 }
}
export function tacticalMove(e,v){const g=e.g;if(e.isBoss||!['chase','hover','aim'].includes(e.state)||e.stagger>0||!e.playerVisible())return v;
 const p=e.p,role=roleOf(e),d=e.dist(p);
 if(e.depthClock>=(e.formationAt||0)){e.formationAt=e.depthClock+.5;e.formationAlly=g.entities.find(a=>a!==e&&!a.dead&&a.isEnemy&&['Ranged','Support'].includes(roleOf(a))&&e.dist(a)<5&&g.shotClear(e.x,e.z,a.x,a.z));}
 if(role==='Frontline'&&e.formationAlly&&d>2.7){const a=e.formationAlly,dx=p.x-a.x,dz=p.z-a.z,l=Math.hypot(dx,dz)||1,tx=a.x+dx/l*1.8,tz=a.z+dz/l*1.8,x=tx-e.x,z=tz-e.z,n=Math.hypot(x,z);e.facing=e.angleTo(p);return n>.25?[x/n*e.speed,z/n*e.speed]:[0,0];}
 if((role==='Flanker'||e.elite==='Swift')&&d>2&&d<7){const a=e.angleTo(p)+(e.home.x%2<1?1:-1)*.65;return[Math.sin(a)*e.speed,Math.cos(a)*e.speed];}
 if(role==='Ranged'&&d<2.5)return[-Math.sin(e.angleTo(p))*e.speed*.7,-Math.cos(e.angleTo(p))*e.speed*.7];
 return v;
}
export function eliteHit(e,h){if(e.elite!=='Armoured'||!e.bulwarkGuard)return 1;
 const front=Math.cos(e.facing-h.dir-Math.PI)>.5;
 if(h.heavy){e.bulwarkGuard=false;e.depthClock=3.6;e.stagger=Math.max(e.stagger,.6);e.g.ui.float(e.x,1.4,e.z,'GUARD BROKEN','#ffe298',true);sfx('guardbreak');return 1;}
 return front?.55:1;
}
