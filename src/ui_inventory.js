import {RARITY} from './rpg/items.js';
import {rarityOf} from './item_info.js';
const $=id=>document.getElementById(id);
export function polishInventory(ui){
 const panel=document.querySelector('.inv-panel'),normal=ui.invTab==='bag'&&!ui.creativeActive;
 panel.classList.toggle('inventory-mode',normal);
 ui.g.survivalUI?.decorate();
 if(ui.invTab!=='bag')return;
 const bag=document.querySelector('.inv-right'),hero=document.querySelector('.inv-left');
 let detail=$('inventory-detail');
 if(!detail){detail=document.createElement('section');detail.id='inventory-detail';detail.setAttribute('aria-label','Item inspection');$('inv-bag').append(detail);}
 // Stable containers keep filters focused while the bag and comparisons refresh.
 if($('tooltip').parentNode!==detail)detail.append($('tooltip'));
 const actions=document.querySelector('.item-actions');if(actions&&actions.parentNode!==detail)detail.append(actions);
 let title=hero.querySelector('.equipment-heading');
 if(!title){title=document.createElement('div');title.className='equipment-heading';title.innerHTML='<h2>Equipment</h2><span>Drag to rotate · scroll to zoom</span>';hero.prepend(title);}
 let controls=hero.querySelector('.portrait-controls');
 if(!controls){
  controls=document.createElement('div');controls.className='portrait-controls';
  controls.innerHTML='<button type="button" aria-label="Rotate character left">↶</button><span>Rotate character</span><button type="button" aria-label="Rotate character right">↷</button>';
  $('paperdoll').after(controls);
  controls.querySelectorAll('button').forEach((button,i)=>button.onclick=()=>{if(ui.doll)ui.doll.rotY+=(i?1:-1)*Math.PI/6;});
 }
 let filters=$('inventory-filters');
 if(!filters){
  filters=document.createElement('div');filters.id='inventory-filters';
  filters.innerHTML=`<div class="inventory-filter-row"><label>Category<select aria-label="Bag category"><option value="all">All equipment</option><option value="weapon">Weapons</option><option value="armour">Armour</option><option value="jewel">Jewellery</option><option value="set">Sets</option><option value="named">Named items</option></select></label><label>Rarity<select aria-label="Bag rarity"><option value="all">All rarities</option>${RARITY.filter(r=>r.id!=='prismatic').map((r,i)=>`<option value="${i}">${r.name}</option>`).join('')}<option value="prismatic">Prismatic</option></select></label><label>Sort<select aria-label="Bag sort"><option value="new">Newest</option><option value="rarity">Rarest first</option><option value="power">Highest power</option><option value="slot">Equipment slot</option><option value="name">Name A–Z</option></select></label></div><div class="inventory-refine"><label><input type="checkbox" aria-label="Your class only">Your class</label><label><input type="checkbox" aria-label="Protected items only">Protected</label><button type="button" class="inventory-reset">Reset</button></div><div class="inventory-results"><span></span><span class="inventory-capacity"></span></div>`;
  $('baggrid').before(filters);
 }
 const bind=(label,key,def)=>{const el=filters.querySelector(`[aria-label="${label}"]`);el.value=ui[key]??def;el.onchange=()=>{ui[key]=el.value;ui.renderInventory();};};
 bind('Bag category','bagFilter','all');bind('Bag rarity','bagRarity','all');bind('Bag sort','bagSort','new');
 for(const [label,key]of [['Your class only','bagOwnClass'],['Protected items only','bagProtected']]){const el=filters.querySelector(`[aria-label="${label}"]`);el.checked=!!ui[key];el.onchange=()=>{ui[key]=el.checked;ui.renderInventory();};}
 filters.querySelector('.inventory-reset').onclick=()=>{ui.bagFilter='all';ui.bagRarity='all';ui.bagSort='new';ui.bagSearch='';ui.bagOwnClass=ui.bagProtected=false;document.querySelector('.bag-search input').value='';ui.renderInventory();};
 const count=ui.bagView().length,owned=ui.g.inv.bag.length;
 filters.querySelector('.inventory-results>span').textContent=count===owned?count+' items':count+' of '+owned+' items';
 filters.querySelector('.inventory-capacity').textContent=(ui.g.bagCapacity()-owned)+' free slots';
 let clear=document.querySelector('.bag-search-clear');
 if(!clear){clear=document.createElement('button');clear.className='bag-search-clear';clear.type='button';clear.setAttribute('aria-label','Clear bag search');clear.textContent='×';document.querySelector('.bag-search').append(clear);}
 clear.onclick=()=>{ui.bagSearch='';const input=document.querySelector('.bag-search input');input.value='';ui.renderInventory();input.focus();};
 let cheatBtn=$('toggle-allitems-cheat');
 const cheatAllowed=ui.g.flags?.allitems||ui.g.flags?.creativeMode||ui.g.settings?.devMode||ui.g.area?.id==='devroom';
 if(cheatAllowed){
  if(!cheatBtn){
   cheatBtn=document.createElement('button');
   cheatBtn.id='toggle-allitems-cheat';
   cheatBtn.type='button';
   cheatBtn.className='allitems-cheat-btn';
   filters.querySelector('.inventory-refine').append(cheatBtn);
  }
  cheatBtn.textContent=ui.creativeActive?'🎒 My bag':'✨ All items cheat';
  cheatBtn.onclick=()=>{ui.creativeActive=!ui.creativeActive;ui.renderInventory();};
 }else{cheatBtn?.remove();}
 document.querySelector('.bag-heading h2').textContent='Inventory';
 document.querySelector('.bag-search input').placeholder='Name, type, rarity or effect…';
 document.querySelector('.bag-search input').value=ui.bagSearch||'';
 // Rarity is communicated in text as well as colour; tiles show the actual item names.
 $('baggrid').querySelectorAll('.cell[data-i]').forEach(el=>{
  const item=ui.g.inv.bag[+el.dataset.i];if(!item)return;
  const R=rarityOf(item),rarity=R.name,color=R.color;
  el.style.setProperty('--item-color',color);el.dataset.rarity=rarity;el.dataset.r=R.index;
  // rarity in words and shape as well as colour
  const tag=document.createElement('span');tag.className='cell-rar';tag.textContent=R.mark+' '+rarity.replace(' · Set','').replace(' signature','');el.append(tag);
  const name=document.createElement('span');name.className='cell-name';name.textContent=item.name;el.append(name);
  el.classList.toggle('welcome-kit',!!item.welcomeGift&&ui.g.onboarding?.step==='equip');
  el.setAttribute('aria-label',item.name+', '+rarity);el.title=item.name+' · '+rarity+(ui.g.isLocked(item)?' · Protected':'');
 });
 document.querySelectorAll('#paperdoll .slotbox[data-eq]').forEach(el=>{const d=ui.dollSlots()[+el.dataset.eq],it=d&&ui.g.inv.equip[d.key];if(it){const R=rarityOf(it);el.style.setProperty('--item-color',R.color);el.dataset.r=R.index;el.title=it.name+' · '+R.name;}else{el.style.removeProperty('--item-color');delete el.dataset.r;}});
 let empty=$('bag-empty');if(!empty){empty=document.createElement('div');empty.id='bag-empty';$('baggrid').after(empty);}
 empty.hidden=count>0;empty.textContent=owned?'No matching items. Change your filters or reset.':'Your bag is empty. Explore, defeat enemies and open treasure chests.';
 const keys=document.querySelector('.inv-keys');if(keys.parentNode!==bag)bag.append(keys);
 ui.g.survivalUI?.pinControl();
 if(normal){panel.setAttribute('aria-label','Inventory and equipment');detail.hidden=false;}else detail.hidden=true;
}
