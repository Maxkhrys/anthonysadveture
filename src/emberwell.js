import * as THREE from 'three';
import {Entity} from './entities/entity.js';
import {mesh,B,MAT_GLOW} from './models.js';
import {Projectile,GearDrop} from './rpg/combat.js';
import {makeNamed} from './rpg/items.js';
import {makeChimeModel} from './entities/objects.js';
import {angDiff} from './engine/util.js';
import {sfx} from './engine/audio.js';
export class EmberEntry extends Entity {
 constructor(g,d){super(g,d.x,d.z);this.interactable=true;this.obj.add(mesh([B(1.3,.2,.7,0,0,0,0x9a603b),B(.18,1.7,.4,-.75,0,0,0x59434a),B(.18,1.7,.4,.75,0,0,0x59434a),B(1.7,.18,.4,0,1.7,0,0xad8552)]));}
 get prompt(){return 'Enter Emberwell · level 12';}
 interact(){const g=this.g;if(!g.inv.chimes.includes('verdant')||!g.inv.bellows){g.ui.say('Emberwell Gate','A green socket waits for the Verdant Chime. Recover it and the Gustbellows from Rootwell Hollow first.');return;}g.flags.q_ember=1;g.warpTo('emberwell','entrance');}
}
export class EmberBrazier extends Entity {
 constructor(g,d){super(g,d.x,d.z);this.d=d;this.interactable=true;this.obj.add(mesh([B(.65,.55,.65,0,0,0,0x674b46),B(.78,.12,.78,0,.55,0,0xc49a54)]));this.flame=mesh([B(.23,.5,.23,0,.66,0,0xff9f35),B(.1,.3,.1,0,1.1,0,0xffe28f)],MAT_GLOW,false);this.obj.add(this.flame);}
 get prompt(){return 'Furnace '+(this.d.order===undefined?'kiln':this.d.order+1)+' · aim Cinder Rod [L]';}
 interact(){this.g.ui.toast('Equip Cinder Rod with Y','Aim with mouse, then press L.');}
 ignite(){const g=this.g;if(this.d.id==='kiln'){g.setSignal('ew.kiln',true,true);g.ui.toast('The cold kiln wakes','A stair opens to the three furnace voices.');}
 else if(!g.signal('ew.relay')){const n=g.flags.ewRelay||0;if(this.d.order===n){g.flags.ewRelay=n+1;sfx('chime');if(n===2){g.setSignal('ew.relay',true,true);g.ui.toast('Three voices in harmony','Now cool the metal with wind.');}}else{g.flags.ewRelay=0;g.ui.toast('The voices fell silent','Start again: left, middle, right.');}}
 g.save();}
 update(){this.flame.visible=this.d.id==='kiln'?this.g.signal('ew.kiln'):this.g.signal('ew.relay')||(this.g.flags.ewRelay||0)>this.d.order;}
}
export class KilnRegent extends Entity {
 constructor(g,d){super(g,d.x,d.z);this.room=d.room;this.name=this.displayName='The Kiln Regent';this.isEnemy=this.isBoss=true;this.r=1;this.level=12;this.hp=this.maxHp=1800;this.active=false;this.clock=0;this.status={};this.exposed=0;this.venting=false;
 this.body=mesh([B(1.5,1.5,1.1,0,.3,0,0x65484a),B(1.7,.16,1.2,0,.6,0,0xb1864a),B(.35,.65,.4,-.9,.5,0,0x44383e),B(.35,.65,.4,.9,.5,0,0x44383e),B(.38,.38,.4,-.45,0,0,0x332b32),B(.38,.38,.4,.45,0,0,0x332b32)]);this.obj.add(this.body);
 this.core=mesh([B(.7,.5,.07,0,.94,.58,0xffad39),B(.1,.12,.08,-.34,1.58,.57,0xffe397),B(.1,.12,.08,.34,1.58,.57,0xffe397)],MAT_GLOW,false);this.obj.add(this.core);
 }
 onHit(h){if(!this.active||this.dead)return 'miss';if(!this.exposed){sfx('clang');return 'guard';}this.hp-=h.dmg;this.hpShow=3;this.g.ui.bossBar(this.name,Math.max(0,this.hp/this.maxHp));if(this.hp<=0)this.defeat();return 'hit';}
 applyStatus(){} // furnace shell cannot be bypassed with damage-over-time
 heat(){if(!this.active||!this.venting)return false;this.exposed=4;this.venting=false;this.g.ui.toast('CORE EXPOSED','Strike now. Four seconds before the shell cools.',2);this.g.fx.ring(this.x,this.z,.3,2,0xffd45e,.4);return true;}
 defeat(){const g=this.g;g.flags.emberBoss=true;g.setSignal('ew.boss',true,true);g.sealRoom('heart',false);g.bossActive=null;g.ui.bossBar(null);this.clearMarks();g.gainXp(600);const id={samurai:'dawnbringer',archer:'starfallcrossbow',witch:'orbitinggrimoire',soulbound:'lanternchain',gunslinger:'kilnrunner'}[g.inv.cls];g.spawn(new GearDrop(g,this.x,this.z+1.5,makeNamed(id,12)));g.ui.banner('THE FURNACE FALLS QUIET','The Ember Voice',3);g.save();this.remove();}
 clearMarks(){for(const m of this.marks||[]){m.obj.removeFromParent();m.obj.geometry.dispose();m.obj.material.dispose();}this.marks=[];}
 warn(){const g=this.g,p=g.player;this.clearMarks();const pts=[[p.x,p.z,2.1]];if(this.hp<this.maxHp*.5)pts.push([p.x+2.8,p.z,1.5],[p.x-2.8,p.z,1.5]);this.marks=pts.map(([x,z,r])=>{const obj=new THREE.Mesh(new THREE.RingGeometry(r*.82,r,32),new THREE.MeshBasicMaterial({color:0xff7935,transparent:true,opacity:.6,side:THREE.DoubleSide}));obj.rotation.x=-Math.PI/2;obj.position.set(x,.04,z);g.world.add(obj);return{x,z,r,obj};});this.strikeAt=this.clock+1.25;g.ui.toast('The floor is heating','Move out of the orange rings.',1);}
 update(dt){const g=this.g;if(g.room?.id!=='heart')return;if(!this.active){this.active=true;g.bossActive=this;g.sealRoom('heart',true);g.ui.bossBar(this.name,1);g.ui.banner('HEAT ITS OPEN MOUTH','The Kiln Regent',2);}
 this.clock+=dt;this.exposed=Math.max(0,this.exposed-dt);this.venting=!this.exposed&&(this.clock%7)<3;this.core.visible=this.venting||this.exposed>0;
 this.body.rotation.z=Math.sin(this.clock*2)*.025;
 if(!this.exposed&&this.clock>=(this.nextWarn||3.2)){this.warn();this.nextWarn=this.clock+(this.hp<this.maxHp*.5?3.8:5);}
 if(this.strikeAt&&this.clock>=this.strikeAt){for(const m of this.marks){g.fx.ring(m.x,m.z,.1,m.r,0xff7935,.4);if(Math.hypot(g.player.x-m.x,g.player.z-m.z)<m.r)g.player.hurt({x:m.x,z:m.z,dmg:2.2,heavy:true,unblockable:true,kb:3,src:this});}this.strikeAt=0;this.clearMarks();}
 }
}
export class EmberChime extends Entity {
 constructor(g,d){super(g,d.x,d.z);this.interactable=true;this.solid=true;this.hw=this.hd=.35;this.obj.add(mesh([B(.8,.4,.8,0,0,0,0x664a44)]));this.chime=makeChimeModel(0xff973b,0xffedbc);this.chime.position.y=.9;this.obj.add(this.chime);}
 get prompt(){return this.g.flags.emberBoss&&!this.g.inv.chimes.includes('ember')?'Take Ember Chime':null;}
 interact(){const g=this.g;if(!this.prompt)return;g.inv.chimes.push('ember');g.flags.q_ember=2;g.gainXp(300);g.ui.lines([['The Ember Voice','A warm note rises from the stone. The forge remembers its song.'],[null,'Return to Elder Tamsin in Thimblewick. The Tide Voice remains beyond reach in this alpha.']]);g.save();}
 update(dt){this.chime.visible=!this.g.inv.chimes.includes('ember');this.chime.rotation.y+=dt;}
}
export function installEmberwell(Game,Story){
 const P=Game.prototype,spawn=P.spawnDef6;
 P.spawnDef6=function(d){switch(d.type){case 'emberentry':return new EmberEntry(this,d);case 'emberbrazier':return new EmberBrazier(this,d);case 'emberboss':return this.flags.emberBoss?null:new KilnRegent(this,d);case 'emberchime':return new EmberChime(this,d);}return spawn.call(this,d);};
 P.castCinderRod=function(){const p=this.player;if(!this.inv.fireRod||p.toolReady>this.time)return false;p.toolReady=this.time+.65;p.faceAim();const dir=p.facing;
 this.spawn(new Projectile(this,{x:p.x,z:p.z,dir,speed:12,range:6,mult:.5,kind:'bolt',color:0xff9f35,element:'fire',ability:true}));
 const targets=this.entities.filter(e=>(e instanceof EmberBrazier||e instanceof KilnRegent)&&!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<6&&Math.abs(angDiff(dir,Math.atan2(e.x-p.x,e.z-p.z)))<.28&&this.shotClear(p.x,p.z,e.x,e.z)).sort((a,b)=>p.dist(a)-p.dist(b));
 const e=targets[0];if(e instanceof EmberBrazier)e.ignite();if(e instanceof KilnRegent)e.heat();sfx('shoot');return true;};
 const S=Story.prototype,objective=S.objective,journal=S.journal,talk=S.talk,markers=S.markers;
 S.objective=function(){const g=this.g;if(g.area?.id==='emberwell'){if(g.inv.chimes.includes('ember'))return 'Return Ember Chime to Elder Tamsin in Thimblewick.';if(g.flags.emberBoss)return 'Recover Ember Chime in the eastern vault.';if(!g.inv.fireRod)return 'Defeat the apprentice guard. Recover Cinder Rod from its chest.';return 'Wake the kiln, light three voices left to right, cool the hall, then expose the Regent with Cinder Rod.';}if(g.inv.chimes.includes('ember')&&!g.flags.emberReturned)return 'Return Ember Chime to Elder Tamsin.';if(g.flags.emberReturned)return 'Two Voices recovered. Explore Lanternreach; Tide Shrine and Chime Spire await later chapters.';if(this.stage===3)return 'Follow Cinderpeak roads to Brakka and the Emberwell (level 12).';return objective.call(this);};
 S.journal=function(){const g=this.g,f=g.flags;return journal.call(this)+(f.q_ember||g.inv.chimes.includes('verdant')?`<div class="quest ${f.emberReturned?'done':''}"><b>${f.emberReturned?'✔ ':''}The Ember Voice</b><br>${f.emberReturned?'Ember Chime returned. Two of three Voices recovered.':g.inv.chimes.includes('ember')?'Return to Elder Tamsin in Thimblewick.':'Cinderpeak · level 12. Recover Cinder Rod, wake the furnaces and defeat the Kiln Regent.'}</div>`:'');};
 S.markers=function(){const m=markers.call(this);if(this.g.pstats?.uniques.has('explorercompass')&&this.g.area.id==='overworld'){for(const e of this.g.entities)if(['LeafPile','CrackedWall','Pocket'].includes(e.constructor.name)&&!e.dead&&Math.hypot(e.x-this.g.player.x,e.z-this.g.player.z)<12)m.push({x:e.x,z:e.z,color:'#83dfff'});}if(this.g.inv.chimes.includes('verdant')&&!this.g.flags.emberReturned)m.push(this.g.inv.chimes.includes('ember')?{x:148,z:126,color:'#ffad3b',pulse:true}:{x:222.5,z:63.5,color:'#ffad3b',pulse:true});return m;};
 S.talk=function(npc){const g=this.g;if(npc.id==='tamsin'&&g.inv.chimes.includes('ember')&&!g.flags.emberReturned)return g.ui.lines([['Elder Tamsin','The bell is warm again. First the wood, now the forge. You brought back more than a sound, Moss.'],['Elder Tamsin','Rest. Explore. The Tide Voice and Chime Spire belong to the next chapter.']],()=>{g.flags.emberReturned=true;g.gainHeartContainer(true);g.gainXp(250);g.save();});return talk.call(this,npc);};
}
