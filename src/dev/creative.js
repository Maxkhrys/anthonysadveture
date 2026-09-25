// Catalogue follows the game registries so new gear and recipes appear automatically.
import {WEAPONS,ARMORS,LEGENDARIES,ACCESSORIES,makeNamed,RARITY} from '../rpg/items.js';
import {HEIRLOOMS} from '../rpg/heirlooms.js';
import {MATS,RECIPES,gainMat,learn} from '../rpg/crafting.js';
import {REGIONS} from '../world/layout.js';

const gear = [...new Map([...WEAPONS,...ARMORS,...LEGENDARIES,...ACCESSORIES,...HEIRLOOMS].map(x=>[x.id,x])).values()];
export const CREATIVE_ITEMS = [
 ...gear.map(x=>({id:'gear:'+x.id,name:x.name,category:'Equipment',hint:[x.cls,x.kind,x.slot,x.prismatic?'Prismatic':RARITY[x.r ?? (x.u?4:1)]?.name,x.text].filter(Boolean).join(' · '),give(g){return g.pickupItem(makeNamed(x.id,g.inv.level));}})),
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
export function renderCreative(ui){
 const grid=document.getElementById('baggrid');
 let host=document.getElementById('creative-inventory');
 const available=ui.g.area?.id==='devroom'&&ui.invTab==='bag';
 if(!available){host?.remove();grid.style.removeProperty('display');document.querySelector('.bag-search')?.style.removeProperty('display');ui.creativeActive=false;return;}
 if(!host){
  host=document.createElement('section');host.id='creative-inventory';
  host.innerHTML='<div class="creative-header"><button type="button" id="creative-toggle">My bag</button><div><b>Creative catalogue</b><small>Devroom only · click an item to add it</small></div></div><div class="creative-body"><div class="creative-tools"><input type="search" aria-label="Search every item" placeholder="Search every item…"><select aria-label="Item category"><option>All items</option>'+[...new Set(CREATIVE_ITEMS.map(x=>x.category))].map(x=>'<option>'+x+'</option>').join('')+'</select><select aria-label="Spawn quantity"><option value="1">×1</option><option value="10">×10 materials</option><option value="64">×64 materials</option></select></div><div class="creative-results" role="list"></div><div class="creative-status" role="status" aria-live="polite"></div></div>';
  grid.before(host);ui.creativeActive=true;
  host.querySelector('input').value=ui.creativeSearch||'';
  host.querySelector('input').oninput=e=>{ui.creativeSearch=e.target.value;draw();};
  host.querySelector('select').onchange=draw;
  host.querySelector('#creative-toggle').onclick=()=>{ui.creativeActive=!ui.creativeActive;display();};
 }
 function display(){host.querySelector('.creative-body').hidden=!ui.creativeActive;host.querySelector('#creative-toggle').textContent=ui.creativeActive?'My bag':'Creative catalogue';grid.style.display=ui.creativeActive?'none':'';document.querySelector('.bag-search').style.display=ui.creativeActive?'none':'';}
 function draw(){
  const q=(ui.creativeSearch||'').trim().toLowerCase(),category=host.querySelector('select').value;
  const found=CREATIVE_ITEMS.filter(x=>(category==='All items'||x.category===category)&&q.split(/\s+/).every(word=>(x.name+' '+x.id+' '+x.hint+' '+x.category).toLowerCase().includes(word)));
  const list=host.querySelector('.creative-results');list.replaceChildren();
  for(const item of found){const b=document.createElement('button');b.type='button';b.className='creative-item';b.title=item.hint;b.setAttribute('aria-label','Add '+item.name);const title=document.createElement('b'),detail=document.createElement('small');title.textContent=item.name;detail.textContent=item.category+' · '+item.hint;b.append(title,detail);b.onclick=()=>{const qty=+host.querySelector('[aria-label="Spawn quantity"]').value;const ok=grantCreative(ui.g,item.id,qty);ui.creativeNotice=ok?'Added '+item.name+(item.stack?' ×'+qty:'')+'.':'Could not add item. Make room in your bag.';host.querySelector('.creative-status').textContent=ui.creativeNotice;if(ok){ui.invSel=ui.g.inv.bag.length-1;ui.renderInventory();}};list.append(b);}
  if(!found.length)list.textContent='No items match. Try another name or category.';
  host.querySelector('.creative-status').textContent=(ui.creativeNotice?ui.creativeNotice+' · ':'')+found.length+' / '+CREATIVE_ITEMS.length+' catalogue entries · equipment uses your current level';
 }
 display();draw();
}
