// Survival HUD and panels: a resource strip, the build-mode bar, the crafting / building panel
// (G, or the workbench) and chest storage. One delegated click handler per panel; the game is
// paused while a panel is open.
import { RECIPES } from './craft.js';
import {itemIconURL,structureIconURL} from '../preview.js';
import {reconcileBelt,selectBelt,availableItems} from './fieldkit.js';
import { PIECES, modelParts } from './entities.js';
import { RESOURCES } from './store.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVG={wood:'<path fill="#b98854" d="M3 8 20 3 28 9 28 22 11 28 3 22Z"/><path fill="#704a2e" d="m3 8 8 6 17-5v4l-17 6-8-6Z"/><path fill="#dfbf82" d="M5 17h4v6H5Z"/>',stone:'<path fill="#939e98" d="m3 19 6-12 13-3 8 15-10 10-13-3Z"/><path fill="#c2c5ae" d="m9 7 13-3 4 9-14 5Z"/>',fibre:'<path fill="#7bac66" d="M15 29V15L5 9l-3-7 13 6 3 8 4-12 8-3-2 12-10 8v8Z"/>',ore:'<path fill="#828e87" d="m2 20 7-14 14-2 7 17-12 8Z"/><path fill="#dc9355" d="M9 9h7v8H9Zm12 7h6v8h-6Z"/>',crystal:'<path fill="#b9b1e9" d="m16 1 10 9-4 17-8 4-7-12Z"/><path fill="#e1dbff" d="m16 1 3 12-5 18-7-12Z"/>'};
const ICON=Object.fromEntries(Object.entries(SVG).map(([k,v])=>[k,`<svg class="resource-icon" viewBox="0 0 32 32" aria-hidden="true">${v}</svg>`]));
const NAME = { wood: 'Wood', stone: 'Stone', fibre: 'Fibre', ore: 'Ore', crystal: 'Crystal' };
const cost = (c, have) => Object.entries(c).map(([k, v]) => `<span class="${(have[k] || 0) >= v ? 'ok' : 'no'}">${ICON[k]} ${v} ${NAME[k]}</span>`).join(' ');

export class SurvivalUI {
  constructor(mode, host = document.getElementById('ui') || document.body) {
    this.m = mode; this.g = mode.g; mode.ui = this; this.tab = 'craft';
    const el = (id, cls = '') => { const d = document.createElement('div'); d.id = id; d.className = 'hidden ' + cls; host.appendChild(d); return d; };
    this.hud = el('sv-hud'); this.bar = el('sv-build'); this.panel = el('sv-panel', 'sv-sheet'); this.chest = el('sv-chest', 'sv-sheet');
    this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-label', 'Crafting and building');
    this.chest.setAttribute('role', 'dialog'); this.chest.setAttribute('aria-label', 'Storage chest');
    this.panel.addEventListener('click', e => this.onPanel(e)); this.chest.addEventListener('click', e => this.onChest(e));
    this.hud.addEventListener('click',e=>{const b=e.target.closest('[data-belt]');if(b)selectBelt(this.g,+b.dataset.belt);if(e.target.closest('[data-act="craft"]'))this.openCraft();});
    this.panel.addEventListener('change',e=>{if(e.target.matches('[data-quantity]')){this.quantity=Math.max(1,Math.min(99,Math.floor(+e.target.value)||1));this.renderPanel();}});
  }
  get open() { return !this.panel.classList.contains('hidden') || !this.chest.classList.contains('hidden'); }
  show() { this.hud.classList.remove('hidden'); this.refresh(); }
  hide() { if(this.gatherEl)this.gatherEl.hidden=true;for (const e of [this.hud, this.bar, this.panel, this.chest]) e.classList.add('hidden'); }
  refresh() {
    const R = this.m.record; if (!R) return;
    const belt=reconcileBelt(R,this.g),items=availableItems(this.g),tracked=RECIPES.find(r=>r.id===R.trackedRecipe);
    const html=`<div class="field-belt" role="toolbar" aria-label="Quick weapon belt">${belt.slots.map((id,i)=>{const it=items.find(x=>x.itemInstanceId===id);return `<button type="button" data-belt="${i}" ${it?'':'disabled'} class="${it===this.g.inv.equip.weapon?'selected':''}" aria-label="${esc(it?it.name:'Empty belt slot '+(i+1))}" aria-pressed="${it===this.g.inv.equip.weapon}" title="${esc(it?.name||'New weapons fill empty slots')}"><small>${i+1}</small>${it?`<img src="${itemIconURL(it)}" alt="">`:'<span>·</span>'}</button>`;}).join('')}<button type="button" data-act="craft">Craft<br><kbd>${this.g.input.usingPad?'↓':'G'}</kbd></button></div><div class="belt-caption">${esc(this.g.inv.equip.weapon?.name||'Field belt')} · ${this.g.input.usingPad?'← / → or RB':'[ / ]'} switch</div>${tracked?`<div class="tracked-recipe"><b>${esc(tracked.name)}</b> ${Object.entries(tracked.cost).map(([k,v])=>`${NAME[k]} ${Math.min(R.resources[k],v)}/${v}`).join(' · ')}${tracked.station&&!this.m.nearStation(tracked.station)?' · Needs '+esc(PIECES[tracked.station]?.name||tracked.station):''}</div>`:''}`;
    if(this.hud.innerHTML!==html)this.hud.innerHTML=html;
    if (!this.panel.classList.contains('hidden')) this.renderPanel();
    if (!this.m.build) this.bar.classList.add('hidden');
  }
  buildStatus(b) {
    this.bar.classList.remove('hidden');
    const name = b.type === 'demolish' ? 'Take down' : PIECES[b.type].name, left = b.type === 'demolish' ? '' : ` · ${(this.m.record.kits || {})[b.type] || 0} left`;
    const html = `<b>${esc(name)}</b>${left}${b.info ? ' · ' + esc(b.info) : ''} — ${b.ok ? '<span class="ok">click or C to ' + (b.type === 'demolish' ? 'take it down (you keep the piece)' : 'place') + '</span>' : '<span class="no">' + esc(b.why) + '</span>'} · right click or X to stop`;
    if (this.bar.innerHTML !== html) this.bar.innerHTML = html;
  }
  pinControl(){
    const actions=document.querySelector('.item-actions');if(!actions)return;let row=document.getElementById('belt-assignment');
    if(!this.m.active||this.g.ui.invTab!=='bag'){row?.remove();return;}
    if(!row){row=document.createElement('div');row.id='belt-assignment';row.innerHTML='<label>Belt slot <select aria-label="Belt slot">'+Array.from({length:8},(_,i)=>`<option value="${i}">${i+1}</option>`).join('')+'</select></label><button type="button">Assign weapon</button>';actions.append(row);}
    const ui=this.g.ui,it=ui.invSel>=0?this.g.inv.bag[ui.invSel]:this.g.inv.equip[ui.dollSlots()[-1-ui.invSel]?.key];row.hidden=it?.slot!=='weapon';
    row.querySelector('button').onclick=()=>{if(it?.slot!=='weapon')return;const belt=reconcileBelt(this.m.record,this.g),slot=+row.querySelector('select').value,old=belt.slots.indexOf(it.itemInstanceId),displaced=belt.slots[slot];if(old>=0)belt.slots[old]=displaced;belt.slots[slot]=it.itemInstanceId;this.g.save();this.refresh();this.g.ui.toast('Assigned to belt '+(slot+1),it.name,1.2);};
  }
  gather(node,done){if(!this.gatherEl){this.gatherEl=document.createElement('div');this.gatherEl.id='gather-progress';document.getElementById('ui').append(this.gatherEl);}this.gatherEl.hidden=false;this.gatherEl.textContent=node.D.name+' · '+(done?'Gathered':Math.max(0,node.hp)+' / '+node.D.hp+' remaining');this.gatherT=1.6;}
  tick(dt){if(!this.m.active)return;if(this.gatherEl){this.gatherT-=dt;this.gatherEl.hidden=this.gatherT<=0;}this.poll=(this.poll||0)-dt;if(this.poll<=0){this.poll=.25;this.refresh();}const I=this.g.input;if(I.pressed('beltNext')||I.pressed('beltPrev')){const b=reconcileBelt(this.m.record,this.g),current=b.slots.indexOf(this.g.inv.equip.weapon?.itemInstanceId),d=I.pressed('beltNext')?1:-1;for(let n=1;n<=8;n++){const i=(Math.max(0,current)+d*n+80)%8;if(b.slots[i]){selectBelt(this.g,i);break;}}}}
  decorate(){
    const ui=this.g.ui,host=document.querySelector('.inv-panel');if(!host)return;
    let nav=document.getElementById('field-tabs');if(!nav){nav=document.createElement('nav');nav.id='field-tabs';nav.setAttribute('aria-label','Survival inventory');host.querySelector('#inv-bag').before(nav);nav.innerHTML=['equipment','materials','craft','build'].map(t=>`<button type="button" data-field="${t}">${{equipment:'Equipment',materials:'Materials',craft:'Crafting',build:'Building'}[t]}</button>`).join('');nav.onclick=e=>{const b=e.target.closest('[data-field]');if(!b)return;if(b.dataset.field==='equipment'){this.closeAll();ui.renderInventory();}else this.openCraft(null,b.dataset.field);};}
    nav.hidden=!this.m.active||ui.invTab!=='bag';
    if(this.panel.parentNode!==host)host.append(this.panel);
    if(!this.m.active||ui.invTab!=='bag')this.closeAll();
    const open=!this.panel.classList.contains('hidden');document.getElementById('inv-bag').classList.toggle('hidden',open||ui.invTab!=='bag');
    for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.field===(open?this.tab:'equipment')));
  }
  toggleCraft(){this.panel.classList.contains('hidden')?this.openCraft():this.g.ui.closeInventory();}
  openCraft(station,tab='craft') {this.closeAll();this.tab=tab;this.quantity=this.quantity||1;this.g.ui.invTab='bag';this.g.ui.openInventory();this.panel.classList.remove('hidden');this.decorate();this.renderPanel();this.g.input.keys.clear();}
  closeAll(){this.panel.classList.add('hidden');this.chest.classList.add('hidden');this.chestFor=null;document.getElementById('inv-bag')?.classList.toggle('hidden',this.g.ui.invTab!=='bag');const nav=document.getElementById('field-tabs');if(nav)for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.field==='equipment'));}
  icon(id){return PIECES[id]?`<img class="craft-model" src="${structureIconURL(id,modelParts(id))}" alt="">`:'<span class="craft-tonic" aria-hidden="true">✦</span>';}
  renderPanel(){
    const m=this.m,R=m.record,kits=R.kits||{},q=this.quantity||1;
    if(this.tab==='materials'){
      const tips={wood:'Chop trees. Used for furniture and wooden structures.',stone:'Break rocks. Used for campfires and stonework.',fibre:'Cut shrubs; some trees also drop fibre. Used for torches and roofs.',ore:'Mine ore veins. Keep it in a chest for later recipes.',crystal:'Mine cave crystals. Used for crystal tonics.'};
      this.panel.innerHTML=`<header><div><small>FIELD INVENTORY</small><h2>Materials</h2><p>Shared by all recipes. These do not occupy equipment slots.</p></div><button data-act="close">Close</button></header><div class="material-grid">${RESOURCES.map(k=>`<article><span>${ICON[k]}</span><h3>${NAME[k]} <b>${R.resources[k]}</b></h3><p>${tips[k]}</p></article>`).join('')}</div><footer><button data-act="home">Go home</button><button data-act="unstuck">Unstuck</button><button data-act="quit">Save & quit</button></footer>`;return;
    }
    if(this.tab==='build'){
      this.panel.innerHTML=`<header><div><small>BUILD POUCH</small><h2>Ready to place</h2><p>Crafted pieces stay here until placed. Taking down a piece returns it.</p></div><button data-act="close">Close</button></header><div class="build-grid">${Object.entries(PIECES).filter(([k,p])=>!p.legacy||kits[k]>0).map(([k,p])=>`<article>${this.icon(k)}<h3>${esc(p.name)} <b>×${kits[k]||0}</b></h3><p>${esc(p.desc)}</p><button data-act="place" data-id="${k}" ${kits[k]>0?'':'disabled'}>Place</button></article>`).join('')}</div><footer><button data-act="place" data-id="demolish">Take down a piece</button><span>Point with mouse or right stick. Attack places; secondary cancels.</span></footer>`;return;
    }
    const selected=RECIPES.find(r=>r.id===this.selectedRecipe&&!r.legacy)||RECIPES[0];this.selectedRecipe=selected.id;const c=m.canCraft(selected.id,q);
    this.panel.innerHTML=`<header><div><small>CAMP WORKSHOP</small><h2>Craft something useful</h2><p>${m.nearStation('workbench')?'Workbench nearby · station recipes available':'Hand crafting · place a workbench for more recipes'}</p></div><button data-act="close">Close</button></header><div class="craft-layout"><div class="recipe-list" aria-label="Recipes">${RECIPES.filter(r=>!r.legacy).map(r=>`<button data-act="recipe" data-id="${r.id}" aria-pressed="${r.id===selected.id}">${this.icon(r.gives)}<span><b>${esc(r.name)}</b><small>${m.canCraft(r.id).ok?'Ready to craft':r.station&&!m.nearStation(r.station)?'Needs '+esc(PIECES[r.station]?.name||r.station):'Gather materials'}</small></span></button>`).join('')}</div><section class="recipe-detail">${this.icon(selected.gives)}<small>${selected.station?esc(PIECES[selected.station]?.name||selected.station):'BY HAND'} · ${selected.qty||1} PER CRAFT</small><h3>${esc(selected.name)}</h3><p>${esc(selected.desc)}</p><dl>${Object.entries(selected.cost).map(([k,v])=>`<div class="${R.resources[k]>=v*q?'ok':'no'}"><dt>${ICON[k]} ${NAME[k]}</dt><dd>${R.resources[k]} / ${v*q} <small>held / needed</small></dd></div>`).join('')}</dl><label>Number of crafts <input type="number" data-quantity min="1" max="99" value="${q}" aria-label="Number of crafts"></label><p class="craft-result">Makes ${q*(selected.qty||1)} · ${selected.gives==='tonic'?'Tonic pouch':`${kits[selected.gives]||0} already in build pouch`}</p><p class="craft-reason" role="status">${esc(c.ok?'Materials ready.':c.why)}</p><div class="craft-actions"><button data-act="craftit" data-id="${selected.id}" ${c.ok?'':'disabled'}>Craft ${q*(selected.qty||1)}</button><button data-act="track" data-id="${selected.id}">${R.trackedRecipe===selected.id?'Untrack':'Track materials'}</button></div></section></div>`;
  }
  onPanel(e){const b=e.target.closest('[data-act]');if(!b||b.disabled)return;const m=this.m;switch(b.dataset.act){
    case 'close':this.g.ui.closeInventory();break;
    case 'recipe':this.selectedRecipe=b.dataset.id;this.quantity=1;this.renderPanel();break;
    case 'track':m.record.trackedRecipe=m.record.trackedRecipe===b.dataset.id?null:b.dataset.id;this.g.save();this.refresh();break;
    case 'craftit':m.craft(b.dataset.id,this.quantity||1);this.renderPanel();break;
    case 'place':if(m.startBuild(b.dataset.id))this.g.ui.closeInventory();break;
    case 'home':this.g.ui.closeInventory();m.goHome();break;
    case 'unstuck':this.g.ui.closeInventory();m.unstick();break;
    case 'quit':this.g.ui.closeInventory();m.quit();break;
  }}
  // ---------------------------------------------------------------- storage
  openChest(s) { this.g.ui.closeInventory(); this.closeAll(); this.chestFor = s; this.chest.classList.remove('hidden'); this.renderChest(); this.g.input.keys.clear(); }
  renderChest() {
    const R = this.m.record, S = R.storage[this.chestFor.id] || {};
    this.chest.innerHTML = `<header><h2>Storage chest</h2><button type="button" data-act="close" aria-label="Close">✕</button></header>
      <table><thead><tr><th></th><th>Carried</th><th></th><th>In chest</th></tr></thead><tbody>${RESOURCES.map(r => `<tr><th>${ICON[r]} ${NAME[r]}</th><td>${R.resources[r]}</td><td class="sv-moves"><button type="button" data-act="in" data-r="${r}" data-n="10">Store 10</button><button type="button" data-act="in" data-r="${r}" data-n="9999">Store all</button><button type="button" data-act="out" data-r="${r}" data-n="10">Take 10</button><button type="button" data-act="out" data-r="${r}" data-n="9999">Take all</button></td><td>${S[r] || 0}</td></tr>`).join('')}</tbody></table>`;
  }
  onChest(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'close') return this.closeAll();
    const n = +b.dataset.n, r = b.dataset.r;
    if (b.dataset.act === 'in') this.m.deposit(this.chestFor, r, n); else this.m.withdraw(this.chestFor, r, n);
    this.renderChest(); this.refresh();
  }
}
