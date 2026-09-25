// Thimblewick's optional first journey. Additive save flags; no class mechanics owned here.
import { Entity } from './entities/entity.js';
import { mesh, B } from './models.js';
import { hx, hz } from './world/layout.js';
import { genItem } from './rpg/items.js';
import { CLASSES } from './rpg/classes.js';
import { prompt } from './engine/actions.js';
import { sfx } from './engine/audio.js';

const STAGES=['move','welcome','attack','roll','heal','loot','equip','ability','rest','ready'];
export class Onboarding {
  constructor(g){this.g=g;this.lastStep=null;this.distance=0;}
  get data(){return this.g.flags.onboarding;}
  get active(){return this.data?.phase==='learning';}
  get peaceful(){return this.active&&!this.g.flags.introFought;}
  get step(){return this.active?(STAGES.find(id=>!this.data.done[id])||'ready'):null;}
  get inHub(){const p=this.g.player;return this.g.area?.id==='overworld'&&p&&p.x>=hx(46)&&p.x<=hx(77)&&p.z>=hz(48)&&p.z<=hz(74);}
  begin(replay=false){
    const g=this.g;
    g.flags.onboarding={version:1,phase:'learning',replay,done:replay?{move:true,welcome:true,loot:true,equip:true}: {}};
    this.lastStep=null;this.distance=0;this.lastPosition=null;this.warning=null;this.sweepT=0;
    g.cutscene=false;g.camFocus=null;
    g.guide.render();g.ui.updateHud();g.save();
    if(!replay)g.ui.toast('Welcome to Thimblewick','Take your time. Follow the lantern path to Captain Brisk’s practice yard.',5);
  }
  event(id){
    if(!this.active||!this.inHub)return;
    if(id==='roll'){if(this.warning)this.warning.rolled=true;return;}
    if(!STAGES.includes(id)||id==='ready'||this.data.done[id])return;
    this.data.done[id]=true;sfx('switch');this.lastStep=null;this.g.guide.render();this.g.ui.updateHud();this.g.save();
  }
  target(){
    if(['move','welcome','ready'].includes(this.step))return{x:hx(68.5),z:hz(65.5),name:'Captain Brisk'};
    if(['attack','roll','ability'].includes(this.step))return{x:hx(71),z:hz(65),name:'Practice yard'};
    if(['loot','equip'].includes(this.step))return{x:hx(69),z:hz(68.5),name:'Supply chest'};
    if(this.step==='rest')return{x:hx(56.5),z:hz(60.5),name:'Village Bellstone'};
    return null;
  }
  lesson(){
    const c=CLASSES[this.g.inv.cls], ability=c?.abilities?.[0];
    return {
      move:['A quiet arrival','Follow the lantern path', 'Move with <kbd>WASD</kbd> or arrow keys. The practice yard is east of the square.'],
      welcome:['Meet your guide','Talk to Captain Brisk', `Walk close and press ${prompt('interact')}. He will show you the ropes.`],
      attack:['Find your rhythm','Hit a straw target', `Aim at either target and use ${prompt('attack')}. Training targets cannot die or drop loot.`],
      roll:['Read the warning','Dodge the practice sweep', `An amber circle shows where the padded strike will land. Use ${prompt('roll')} to escape it.`],
      heal:['Catch your breath','Drink a practice tonic', `Press ${prompt('potion')} after the small practice tap. Brisk replaces this tonic.`],
      loot:['A gift for the road','Open the supply chest', `Press ${prompt('interact')} at the small chest beside the yard. Your first armour goes straight into your bag.`],
      equip:['Make it yours','Equip your new armour', `Open inventory ${prompt('inventory')}, select the highlighted item, then Equip. The world pauses while your bag is open.`],
      ability:['Your first technique',`Try ${ability?.name||'your first ability'}`, `Stand beside the targets. Press <kbd>1</kbd> to use your first equipped ability. Practice refills your ${c?.res||'resource'}.`],
      rest:['A place to return to','Rest at the Bellstone', `Head west to the small bronze bell. Press ${prompt('interact')} to refill health and tonics and set your checkpoint.`],
      ready:['Ready when you are','Return to Captain Brisk', this.data?.replay?'Finish your practice whenever you are ready.':'You know the basics. Speak to Brisk when you are ready to defend the south path.'],
    }[this.step];
  }
  render(el){
    const info=this.lesson();if(!info)return;
    const n=STAGES.indexOf(this.step),target=this.target();
    el.classList.add('guided-arrival');el.classList.remove('hidden');
    el.querySelector('.gd-h').innerHTML=`<span>FIRST STEPS</span><span>${n+1} / ${STAGES.length}</span>`;
    el.querySelector('.gd-list').innerHTML=`<div class="arrival-chapter">${info[0]}</div><h3>${info[1]}</h3><p>${info[2]}</p><div class="arrival-wayfinding">${target?target.name:'Practice at your own pace'}</div><div class="arrival-actions"><button type="button" data-guide="hide">Hide hints</button><button type="button" data-guide="skip">Skip training</button></div>`;
    el.querySelector('[data-guide="hide"]').onclick=()=>{this.g.settings.guide=false;this.g.guide.render();this.g.ui.toast('Hints hidden','Talk to Captain Brisk to show them again.',3);};
    el.querySelector('[data-guide="skip"]').onclick=()=>this.g.ui.ask('Captain Brisk','Skip the lessons? The village stays peaceful until you tell me you are ready.',[{label:'Skip lessons',cb:()=>this.skip()},{label:'Keep practising',cb:()=>{}}]);
  }
  skip(){if(!this.active)return;for(const id of STAGES)if(id!=='ready')this.data.done[id]=true;this.warning=null;this.lastStep=null;this.g.guide.render();this.g.ui.updateHud();this.g.save();}
  talk(){
    const g=this.g;
    if(!this.active){g.ui.ask('Captain Brisk','The straw targets are always here. Want to practise the basics again?',[
      {label:'Replay training',cb:()=>{g.settings.guide=true;this.begin(true);}},{label:'Village directions',cb:()=>this.directions()},{label:'Ask about the Hush camp',cb:()=>{this.bypassTalk=true;const npc=g.entities.find(e=>e.id==='brisk');if(npc)g.story.talk(npc);this.bypassTalk=false;}},{label:'Back',cb:()=>{}},]);return;}
    this.event('welcome');
    const ready=this.step==='ready';
    g.ui.ask('Captain Brisk',ready?'Good feet, steady hands. Ready for what lies beyond the yard?':'Welcome, traveller. No hurry here. Try the straw targets; I will take you through one thing at a time.',[
      {label:ready?(this.data.replay?'Finish practice':'I’m ready. Defend the village.'):'Show my next lesson',cb:()=>{g.settings.guide=true;if(ready)this.finish();else g.guide.render();}},
      {label:'Village directions',cb:()=>this.directions()},
      ...(!ready?[{label:'Skip the lessons',cb:()=>this.skip()}]:[]),{label:'I’ll explore a little',cb:()=>{}},
    ]);
  }
  directions(){this.g.ui.lines([['Captain Brisk','The small bronze *Bellstone* west of here mends you and remembers your return.'],['Captain Brisk','Posy’s blue-roofed shop and workbench sit south-west of the square. The noticeboard has jobs when you are ready.'],['Captain Brisk','Elder Tamsin waits by the tall Dawnbell. The west road leads through Whisperwood to Rootwell Hollow. Press *M* for your map.']]);}
  finish(){
    if(!this.active)return;const g=this.g,replay=this.data.replay;this.data.phase='complete';this.warning=null;
    g.guide.render();g.ui.updateHud();g.save();
    if(replay||g.flags.introFought){g.ui.toast('Practice complete','Come back whenever you want to try a new weapon.',3);return;}
    g.ui.say('Captain Brisk','There they are, on the south path. Stay calm: read the warning, roll clear, then strike. I’ll keep the villagers back.',()=>g.startIntroFight());
  }
  tick(dt){
    const g=this.g,p=g.player;
    if(!this.active||!p||g.locked()||!this.inHub)return;
    if(this.lastPosition){this.distance+=Math.min(.5,Math.hypot(p.x-this.lastPosition.x,p.z-this.lastPosition.z));if(this.distance>2)this.event('move');}
    this.lastPosition={x:p.x,z:p.z};
    const step=this.step;
    if(step!==this.lastStep){this.lastStep=step;g.guide.render();g.ui.updateHud();
      if(step==='heal'&&!this.data.tapped){this.data.tapped=true;g.inv.hp=Math.max(1,g.inv.hp-Math.min(8,g.inv.maxHp*.2));g.inv.potions=Math.max(1,g.inv.potions);g.ui.hearts(true);g.ui.toast('A small practice tap', 'Press H to drink a tonic. Brisk will replace it.',3);g.save();}
    }
    if(['attack','roll','ability'].includes(step)&&Math.hypot(p.x-hx(71),p.z-hz(66))<7)g.res=100;
    if(step==='roll'&&Math.hypot(p.x-hx(71),p.z-hz(66))<5){
      this.sweepT=(this.sweepT||0)+dt;
      if(!this.warning&&this.sweepT>1){this.warning={x:p.x,z:p.z,t:1.6,rolled:false};g.fx.ring(p.x,p.z,.1,1.35,0xe5b35c,1.6,.04);g.ui.toast('Watch the amber circle','Roll clear before the padded sweep lands.',2);}
      if(this.warning){this.warning.t-=dt;if(this.warning.t<=0){const w=this.warning;this.warning=null;this.sweepT=0;const escaped=Math.hypot(p.x-w.x,p.z-w.z)>1.2||p.invuln>0;if(w.rolled&&escaped){this.data.done.roll=true;this.lastStep=null;g.guide.render();g.save();}else{g.fx.ring(w.x,w.z,.1,1.35,0xd0936c,.3,.06);g.ui.toast('Try again','Space + a direction rolls out of the marked circle. Practice cannot kill you.',2);}}}
    }else{this.warning=null;this.sweepT=0;}
    if(this.target()&&g.time>(this.pinAt||0)){this.pinAt=g.time+2;const t=this.target();g.fx.ring(t.x,t.z,.35,.6,0xdac681,1.5,.05);}
  }
}

export class VillageTarget extends Entity {
  constructor(g,d){super(g,d.x,d.z);this.trainingTarget=true;this.isEnemy=true;this.isDummy=true;this.hp=this.maxHp=1e8;this.status={};this.stagger=0;this.level=1;this.r=.38;this.solid=true;this.hw=this.hd=.32;
    this.obj.add(mesh([B(.12,1.1,.12,0,0,0,0x684b30),B(.8,.1,.12,0,.67,0,0x684b30),B(.42,.48,.3,0,.4,0,0xb99853),B(.25,.25,.25,0,.9,0,0xc8ae6b),B(.23,.23,.035,0,.52,.17,0x8c4335),B(.08,.08,.04,0,.59,.19,0xe9d3a0),B(.6,.07,.55,0,0,0,0x6e6150)]));
  }
  die(){} // Practice props never award kills or disappear in arena cleanup.
  onHit(){this.wobble=.2;this.g.guide.event('attack');this.g.ui.float(this.x,1.3,this.z,'Good hit','#ead49a');return 'hit';}
  update(dt){this.wobble=Math.max(0,(this.wobble||0)-dt);this.obj.rotation.z=Math.sin(this.wobble*50)*this.wobble*.45;this.sync();}
}
export class WelcomeChest extends Entity {
  constructor(g,d){super(g,d.x,d.z);this.interactable=true;this.solid=true;this.hw=.4;this.hd=.28;this.obj.add(mesh([B(.72,.35,.48,0,0,0,0x795438),B(.78,.1,.52,0,.35,0,0xa77d47),B(.06,.43,.54,-.25,0,0,0xb9a273),B(.06,.43,.54,.25,0,0,0xb9a273),B(.12,.14,.035,0,.18,.27,0xd5ba75)]));}
  get prompt(){return this.g.flags.welcomeSupplies?'Read supply note':'Open welcome supplies';}
  interact(){const g=this.g;if(g.flags.welcomeSupplies){g.ui.say('A note from Brisk','One kit per traveller. Need more supplies? Posy keeps shop west of the square.');return;}
    if(g.inv.bag.length>=g.bagCapacity()){g.ui.toast('Make room in your bag','One empty slot is needed for your welcome armour.',3);return;}
    const item=genItem({level:1,slot:'armor',rarity:1,cls:g.inv.cls});item.welcomeGift=true;
    g.flags.welcomeSupplies=true;g.pickupItem(item);g.onboarding.event('loot');g.ui.toast('Your travelling kit','Press E, select the marked armour and choose Equip.',4);g.save();
  }
}
