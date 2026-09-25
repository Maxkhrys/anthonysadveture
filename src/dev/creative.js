// Catalogue follows the game registries so new gear and recipes appear automatically.
import {WEAPONS,ARMORS,LEGENDARIES,ACCESSORIES,makeNamed,RARITY,baseById} from '../rpg/items.js';
import {HEIRLOOMS} from '../rpg/heirlooms.js';
import {MATS,RECIPES,gainMat,learn} from '../rpg/crafting.js';
import {itemIconURL} from '../preview.js';
import {catalogueIcon} from './creative-icons.js';
import {REGIONS} from '../world/layout.js';

const gear = [...new Map([...WEAPONS,...ARMORS,...LEGENDARIES,...ACCESSORIES,...HEIRLOOMS].map(x=>[x.id,x])).values()];
export const CREATIVE_ITEMS = [
 ...gear.map(x=>{const base=baseById(x.base||x.id),r=x.r??(LEGENDARIES.some(l=>l.id===x.id)?4:base.set?3:1);return {id:'gear:'+x.id,name:x.name,category:'Equipment',rarity:x.prismatic?'Prismatic':RARITY[r].name,color:x.prismatic?'#9edfff':RARITY[r].color,cls:base.cls||'Universal',type:base.kind||base.slot,preview:{...base,base:base.id,r,unique:x.u||((x.base||x.collection)?x.id:null),prismatic:x.prismatic,slot:base.slot||'weapon'},hint:x.text||'Roll this equipment at your current character level.',give(g){return g.pickupItem(makeNamed(x.id,g.inv.level));}};}),
 ...Object.entries(MATS).map(([id,x])=>({id:'mat:'+id,name:x.name,category:'Materials',hint:x.desc,stack:true,give(g,n){gainMat(g,id,n);}})),
 ...RECIPES.map(x=>({id:'recipe:'+x.id,name:x.name+' recipe',category:'Recipes',hint:x.effect,give(g){learn(g,x.id,true);}})),
 ...Object.entries(REGIONS).map(([id,x])=>({id:'map:'+id,name:x.name+' map fragment',category:'Quest items',hint:'Reveal this region on your map.',give(g){g.revealRegion(id);}})),
 ...[['bellows','Gustbellows'],['fireRod','Cinder Rod']].map(([id,name])=>({id,name,category:'Tools',hint:'L to use · Y to swap tools',give(g){g.inv[id]=true;g.inv.activeTool=id;}})),
 {id:'key',name:'Small Key',category:'Supplies',hint:'Dungeon door key',stack:true,give(g,n){g.inv.keys+=n;}},
 {id:'bigkey',name:'Thornwood Key',category:'Quest items',hint:'Opens the Root Gate',give(g){g.inv.bigkey=true;}},
 {id:'pips',name:'Pips',category:'Supplies',hint:'Currency',stack:true,give(g,n){g.addCoins(n);}},
 {id:'potion',name:'Red Tonic',category:'Supplies',hint:'Refill your tonic supply',give(g){g.inv.potions=g.inv.maxPotions;}},
 {id:'heart',name:'Heart Vessel',category:'Supplies',hint:'Increase maximum health',give(g){g.gainHeartContainer(true);}},
 {id:'score',name:"Bellwright's Score",category:'Quest items',hint:'For Elder Tamsin',give(g){g.flags.bellscore=true;}},
 {id:'tongs',name:"Brakka's Tongs",category:'Quest items',hint:'For Brakka in Cinderpeak',give(g){g.flags.tongs=true;}},
 ...['verdant','ember'].map(id=>({id:'chime:'+id,name:id[0].toUpperCase()+id.slice(1)+' Chime',category:'Quest items',hint:'Adventure quest reward',give(g){if(!g.inv.chimes.includes(id))g.inv.chimes.push(id);}})),
];
export function grantCreative(g,id,quantity=1){
 if(g.area?.id!=='devroom')return false;
 const item=CREATIVE_ITEMS.find(x=>x.id===id);if(!item)return false;
 const n=item.stack&&[1,10,64].includes(quantity)?quantity:1;
 if(item.give(g,n)===false)return false;
 g.recalc();g.ui.updateHud();g.save();return true;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconCache=new Map();
export function creativeIcon(item){
 if(!iconCache.has(item.id))iconCache.set(item.id,item.preview?itemIconURL(item.preview,item.preview.cls||'samurai'):catalogueIcon(item));
 return iconCache.get(item.id);
}
export function renderCreative(ui){
 const grid=document.getElementById('baggrid'),panel=document.querySelector('.inv-panel');
 let host=document.getElementById('creative-inventory');
 const available=ui.g.area?.id==='devroom'&&ui.invTab==='bag';
 if(!available){host?.remove();panel.classList.remove('creative-mode');grid.style.removeProperty('display');document.querySelector('.bag-search')?.style.removeProperty('display');ui.creativeActive=false;return;}
 if(!host){
  host=document.createElement('section');host.id='creative-inventory';
  host.innerHTML=`<header class="creative-header"><div><h2>Creative armoury</h2><p>Every discovery in Lanternreach. Inspect an item, then add it to your adventure.</p></div><button type="button" id="creative-toggle">My bag</button></header>
  <div class="creative-body"><div class="creative-tools"><label class="creative-search">Search catalogue<div><input type="search" aria-label="Search every item" placeholder="Item name, class, rarity or effect…"><button type="button" aria-label="Clear search">×</button></div></label>
  <label>Category<select aria-label="Item category"><option>All items</option>${[...new Set(CREATIVE_ITEMS.map(x=>x.category))].map(x=>'<option>'+x+'</option>').join('')}</select></label>
  <label>Rarity<select aria-label="Item rarity"><option>All rarities</option>${[...RARITY.map(x=>x.name),'Prismatic','Unranked'].map(x=>'<option>'+x+'</option>').join('')}</select></label>
  <label>Order<select aria-label="Item order"><option value="name">Name A–Z</option><option value="rarity">Rarest first</option></select></label><button type="button" class="creative-reset">Reset filters</button></div>
  <div class="creative-summary"><span class="creative-count"></span><span class="creative-capacity"></span></div>
  <div class="creative-workspace"><div class="creative-results" aria-label="Catalogue items"></div><aside class="creative-inspector" aria-label="Item preview"></aside></div>
  <div class="creative-status" role="status" aria-live="polite"></div></div>`;
  grid.before(host);ui.creativeActive=true;
 }
 const input=host.querySelector('input'),category=host.querySelector('[aria-label="Item category"]'),rarity=host.querySelector('[aria-label="Item rarity"]'),order=host.querySelector('[aria-label="Item order"]');
 input.value=ui.creativeSearch||'';category.value=ui.creativeCategory||'All items';rarity.value=ui.creativeRarity||'All rarities';order.value=ui.creativeOrder||'name';
 input.oninput=()=>{ui.creativeSearch=input.value;draw();};
 category.onchange=()=>{ui.creativeCategory=category.value;draw();};
 rarity.onchange=()=>{ui.creativeRarity=rarity.value;draw();};
 order.onchange=()=>{ui.creativeOrder=order.value;draw();};
 host.querySelector('[aria-label="Clear search"]').onclick=()=>{ui.creativeSearch='';input.value='';draw();input.focus();};
 host.querySelector('.creative-reset').onclick=()=>{ui.creativeSearch='';ui.creativeCategory='All items';ui.creativeRarity='All rarities';ui.creativeOrder='name';ui.renderInventory();input.focus();};
 host.querySelector('#creative-toggle').onclick=()=>{ui.creativeActive=!ui.creativeActive;display();};
 function display(){
  panel.classList.toggle('creative-mode',ui.creativeActive);host.querySelector('.creative-body').hidden=!ui.creativeActive;
  host.querySelector('#creative-toggle').textContent=ui.creativeActive?'My bag':'Creative catalogue';grid.style.display=ui.creativeActive?'none':'';
  document.querySelector('.bag-search').style.display=ui.creativeActive?'none':'';
 }
 function inspect(item){
  ui.creativeSelected=item?.id;
  host.querySelectorAll('.creative-item').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.item===item?.id)));
  const detail=host.querySelector('.creative-inspector');
  if(!item){detail.innerHTML='<h3>No matching items</h3><p>Clear your search or choose another rarity.</p>';return;}
  const rank=item.rarity||'Unranked',full=item.category==='Equipment'&&ui.g.inv.bag.length>=ui.g.bagCapacity();
  detail.style.setProperty('--item-color',item.color||'#d5bd87');
  detail.innerHTML=`<div class="creative-info"><div class="creative-portrait"><img src="${creativeIcon(item)}" alt="${esc(item.name)}"></div><div class="creative-rarity">${rank}</div><h3>${esc(item.name)}</h3><p class="creative-kind">${esc(item.type||item.category)}${item.cls?' · '+esc(item.cls):''}</p><p class="creative-description">${esc(item.hint)}</p>
  <p class="creative-level">${item.category==='Equipment'?'Equipment rolls at level '+ui.g.inv.level+'. Stats vary per copy.':'Added to the matching supplies or adventure record.'}</p>
  </div><div class="creative-controls"><label class="creative-quantity">Quantity<select aria-label="Spawn quantity" ${item.stack?'':'disabled'}><option value="1">×1</option>${item.stack?'<option value="10">×10</option><option value="64">×64</option>':''}</select></label>
  <button type="button" class="creative-add" aria-label="Add ${esc(item.name)}" ${full?'disabled':''}>${full?'Bag full':item.category==='Equipment'?'Add to bag':'Add to adventure'}</button>${full?'<p class="creative-full">Open My bag and make space. No items are replaced.</p>':''}</div>`;
  const qty=detail.querySelector('select');qty.value=String(item.stack?(ui.creativeQuantity||1):1);qty.onchange=()=>ui.creativeQuantity=+qty.value;
  detail.querySelector('.creative-add').onclick=()=>{const n=+qty.value,ok=grantCreative(ui.g,item.id,n);ui.creativeNotice=ok?'Added '+item.name+(item.stack?' ×'+n:'')+'.':'Could not add item. Make room in your bag.';if(ok&&item.category==='Equipment')ui.invSel=ui.g.inv.bag.length-1;ui.renderInventory();};
 }
 function draw(){
  const q=input.value.trim().toLowerCase(),rank=x=>x.rarity==='Prismatic'?5:RARITY.findIndex(r=>r.name===x.rarity);
  const found=CREATIVE_ITEMS.filter(x=>(category.value==='All items'||x.category===category.value)&&(rarity.value==='All rarities'||(x.rarity||'Unranked')===rarity.value)&&q.split(/\s+/).every(word=>(x.name+' '+x.id+' '+x.hint+' '+x.category+' '+(x.cls||'')+' '+(x.type||'')+' '+(x.rarity||'Unranked')).toLowerCase().includes(word))).sort((a,b)=>(order.value==='rarity'?rank(b)-rank(a):0)||a.name.localeCompare(b.name));
  const list=host.querySelector('.creative-results'),scroll=list.scrollTop;list.replaceChildren();
  for(const item of found){
   const b=document.createElement('button');b.type='button';b.className='creative-item';b.dataset.item=item.id;b.style.setProperty('--item-color',item.color||'#d5bd87');b.setAttribute('aria-label','Inspect '+item.name);
   b.innerHTML=`<img src="${creativeIcon(item)}" alt="" width="64" height="64" loading="lazy"><span><small class="creative-rarity">${item.rarity||'Unranked'}</small><b>${esc(item.name)}</b><small class="creative-kind">${esc(item.type||item.category)}${item.cls?' · '+esc(item.cls):''}</small></span>`;
   b.onclick=()=>{inspect(item);if(matchMedia('(max-width:760px)').matches)host.querySelector('.creative-inspector').scrollIntoView({block:'nearest'});};list.append(b);
  }
  if(!found.length)list.innerHTML='<div class="creative-empty"><h3>No items found</h3><p>Try another name, class or rarity.</p></div>';
  list.scrollTop=scroll;
  host.querySelector('.creative-count').textContent=found.length+' of '+CREATIVE_ITEMS.length+' items';
  host.querySelector('.creative-capacity').textContent='Bag '+ui.g.inv.bag.length+' / '+ui.g.bagCapacity()+' · Level '+ui.g.inv.level;
  host.querySelector('.creative-status').textContent=ui.creativeNotice||'Devroom only. Select an item to see its details.';
  inspect(found.find(x=>x.id===ui.creativeSelected)||found[0]);
 }
 display();draw();
}
