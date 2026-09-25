import { HeroPortrait } from './hero_portrait.js';
import { starterWeapon } from './rpg/items.js';
import { CLASSES } from './rpg/classes.js';
import { OPTIONS, normalizeAppearance, randomAppearance } from './appearance.js';

const label = s => s.charAt(0).toUpperCase()+s.slice(1);
const CATEGORIES = { Body: ['frame','skin'], Face: ['face','eyes'], Hair: ['hair','hairColor'], Details: ['beard','detail'], Class: [], Name: [] };
const TITLES = {frame:'Build',skin:'Skin tone',face:'Face shape',eyes:'Eye colour',hair:'Hairstyle',hairColor:'Hair colour',beard:'Facial hair',detail:'Face markings'};
export class CharacterCreator {
  constructor({ onBack, onConfirm, game }) {
    this.game = game;
    this.onBack=onBack; this.onConfirm=onConfirm; this.look=normalizeAppearance(); this.cls=Object.keys(CLASSES)[0]; this.category='Body'; this.name=''; this.angle=.3; this.zoom=1; this.time=0;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('reduce-motion');
    this.el=document.createElement('section'); this.el.id='character-creator'; this.el.className='screen'; this.el.setAttribute('role','dialog'); this.el.setAttribute('aria-modal','true'); this.el.setAttribute('aria-labelledby','creator-heading');
    this.el.innerHTML=`<div class="creator-folio"><header class="creator-header"><div><span>MOSSLING · THE SILENT BELL</span><h1 id="creator-heading">Every legend begins with you.</h1></div><p>A new page in Thimblewick.</p></header><div class="creator-layout"><nav class="creator-tabs" aria-label="Character sections">${Object.keys(CATEGORIES).map((c,i)=>`<button type="button" data-category="${c}"><small>0${i+1}</small>${c}<span aria-hidden="true">›</span></button>`).join('')}</nav><div class="creator-stage"><div class="creator-portrait"></div><div class="creator-caption"><span class="creator-class-label"></span><p>Your character · in-game view</p><p class="creator-preview-hint">Drag to turn · Scroll to zoom</p><div class="creator-camera"><button type="button" data-camera="left" aria-label="Rotate left">↶</button><button type="button" data-camera="out" aria-label="Zoom out">−</button><button type="button" data-camera="in" aria-label="Zoom in">+</button><button type="button" data-camera="right" aria-label="Rotate right">↷</button></div></div></div><section class="creator-options" aria-label="Appearance options"></section></div><footer class="creator-footer"><button type="button" data-action="back">Back</button><button type="button" data-action="random">Randomise appearance</button><span class="creator-progress"></span><button type="button" class="creator-next" data-action="next">Choose class</button></footer><p class="creator-error" role="alert"></p></div>`;
    document.body.append(this.el);
    this.el.addEventListener('click',e=>this.click(e));
    this.el.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!this.busy){e.preventDefault();this.back();}
      if(e.key==='Tab') { const nodes=[...this.el.querySelectorAll('button:not(:disabled),input')]; const i=nodes.indexOf(document.activeElement); if((e.shiftKey&&i===0)||(!e.shiftKey&&i===nodes.length-1)){e.preventDefault();nodes[e.shiftKey?nodes.length-1:0].focus();} }
    });
    this.initScene(); this.renderOptions(); this.el.querySelector('[data-category]').focus();
  }
  initScene() {
    this.portrait=new HeroPortrait(this.game);this.portrait.mount(this.el.querySelector('.creator-portrait'));
    this.pixel=this.portrait.pixel;this.renderer=this.pixel.renderer;this.scene=this.portrait.scene;this.updateHero();
  }
  resize(){this.portrait.setZoom(this.zoom);}
  updateHero(){this.portrait.setGear(this.cls,{weapon:starterWeapon(this.cls)},this.look);this.hero=this.portrait.hero;this.el.querySelector('.creator-class-label').textContent=CLASSES[this.cls].name;}
  renderOptions(){
    this.el.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-current',b.dataset.category===this.category?'step':'false'));
    const box=this.el.querySelector('.creator-options');box.innerHTML='';
    const h=document.createElement('h2');h.textContent=this.category==='Name'?'Sign your story':this.category==='Class'?'Choose your calling':this.category;box.append(h);
    const intro=document.createElement('p');intro.className='creator-note';intro.textContent={Body:'Small adventurer. A world waiting.',Face:'A face for the fireside stories.',Hair:'Windswept, battle-worn, or freshly shorn.',Details:'The little things that make you, you.',Class:'Your appearance stays yours. Your calling is locked when the adventure begins.',Name:'This character gets a separate save. Your existing adventures stay safe.'}[this.category];box.append(intro);
    for(const key of CATEGORIES[this.category]){
      const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=TITLES[key];field.append(legend);
      const choices=document.createElement('div');choices.className='creator-choices';
      for(const [i,value] of OPTIONS[key].entries()) {const b=document.createElement('button');b.type='button';b.dataset.key=key;b.dataset.value=value;b.setAttribute('aria-pressed',String(this.look[key]===value));
        if(value.startsWith('#')) {b.className='creator-swatch';b.style.setProperty('--swatch',value);b.setAttribute('aria-label',TITLES[key]+' '+(i+1));b.title=TITLES[key]+' '+(i+1);b.innerHTML='<span aria-hidden="true">✓</span>';}
        else b.textContent=label(value);choices.append(b);
      }field.append(choices);box.append(field);
    }
    if(this.category==='Class') {
      for(const [id,c] of Object.entries(CLASSES)){const b=document.createElement('button');b.type='button';b.className='creator-class';b.dataset.class=id;b.setAttribute('aria-pressed',String(id===this.cls));const title=document.createElement('strong');title.textContent=c.name;const desc=document.createElement('span');desc.textContent=c.role;b.append(title,desc);box.append(b);}
      const c=CLASSES[this.cls],desc=document.createElement('p');desc.textContent=c.blurb;box.append(desc);
      const stats=document.createElement('dl');stats.className='creator-stats';for(const [k,v] of Object.entries(c.stats||{})){const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');const meter=document.createElement('meter');meter.min=0;meter.max=5;meter.value=v;meter.setAttribute('aria-label',k);dd.append(meter);stats.append(dt,dd);}box.append(stats);
    }
    if(this.category==='Name') {
      const l=document.createElement('label');l.htmlFor='creator-name';l.textContent='Character name';const input=document.createElement('input');input.id='creator-name';input.maxLength=32;input.placeholder='Your adventurer’s name';input.value=this.name;input.autocomplete='off';input.addEventListener('input',()=>{this.name=input.value;this.updateNext();});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.confirm();}});box.append(l,input);
      const summary=document.createElement('p');summary.className='creator-summary';summary.textContent=`${CLASSES[this.cls].name} · ${label(this.look.frame)} frame · ${label(this.look.hair)} hair`;box.append(summary);
    }
    this.el.querySelector('.creator-progress').textContent=this.category==='Name'?'Ready for the first chapter?':`${Object.keys(CATEGORIES).indexOf(this.category)+1} / 6`;
    this.updateNext();
  }
  updateNext(){const b=this.el.querySelector('[data-action="next"]');b.textContent=this.busy?'Opening your story…':this.category==='Name'?'Begin adventure':this.category==='Class'?'Name your character':'Choose class';b.disabled=this.busy||(this.category==='Name'&&!this.name.trim());}
  click(e){const b=e.target.closest('button');if(!b||this.busy)return;
    if(b.dataset.category){this.category=b.dataset.category;this.renderOptions();}
    if(b.dataset.key){this.look[b.dataset.key]=b.dataset.value;this.updateHero();this.el.querySelectorAll(`[data-key="${b.dataset.key}"]`).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}
    if(b.dataset.class){this.cls=b.dataset.class;this.updateHero();this.renderOptions();this.el.querySelector(`[data-class="${this.cls}"]`).focus();}
    if(b.dataset.camera){const v=b.dataset.camera;if(v==='left'||v==='right')this.portrait.rotY+=(v==='left'?-.35:.35);else this.portrait.setZoom(this.portrait.zoom+(v==='out'?.1:-.1));}
    if(b.dataset.action==='random'){this.look=randomAppearance();this.updateHero();this.renderOptions();}
    if(b.dataset.action==='back')this.back();
    if(b.dataset.action==='next'){if(this.category==='Name')this.confirm();else{this.category=this.category==='Class'?'Name':'Class';this.renderOptions();if(this.category==='Name')this.el.querySelector('input').focus();}}
  }
  back(){if(this.category==='Name'){this.category='Class';this.renderOptions();}else this.onBack();}
  async confirm(){if(this.busy||!this.name.trim())return;this.busy=true;this.updateNext();try{await this.onConfirm({name:this.name.trim(),cls:this.cls,appearance:{...this.look}});}catch(e){this.el.querySelector('.creator-error').textContent=e.message;this.busy=false;this.updateNext();}}
  frame(dt){this.portrait.frame(dt);}
  dispose(){this.portrait.dispose();this.el.remove();}
}
