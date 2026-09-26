// Read-only dependencies: factories and portable data, never Game/session/store/bootstrap.
import { CLASSES, computeStats } from '../../src/rpg/classes.js';
import { WEAPONS, ARMORS, LEGENDARIES, makeNamed, genItem, starterWeapon } from '../../src/rpg/items.js';
import { defaultInventory, SLOT_ALIASES } from '../../src/persistence/model.js';
import { bagCapacity } from '../../src/rpg/relics.js';
import { eligible, ITEM_CLASSES } from '../../src/rpg/eligibility.js';
import { itemInfo, rarityOf } from '../../src/item_info.js';
export { CLASSES, bagCapacity };
export const CATEGORIES = [['all','All gear'],['weapon','Weapons'],['armour','Armour'],['jewel','Jewellery'],['protected','Protected']];
export const SLOT_LABELS = {head:'Head',chest:'Chest',arms:'Arms',legs:'Legs',boots:'Boots',necklace:'Necklace',ring1:'Ring I',ring2:'Ring II',weapon:'Weapon'};
export function sampleCharacter(cls) {
  const inv=defaultInventory(cls); inv.level=18;
  inv.equip.weapon=starterWeapon(cls);
  for(const [slot,canonical] of [['armor','chest'],['helm','head'],['arms','arms'],['legs','legs'],['boots','boots'],['charm','necklace'],['ring','ring1']]) {
    const pool=ARMORS.filter(b=>b.slot===slot&&eligible(b,cls)&&b.lvl<=18&&!b.set);
    const preferred={samurai:{armor:'oyoroi',legs:'hakama'},archer:{armor:'jerkin',helm:'rangercowl'},witch:{armor:'robe',helm:'witchbrim'},soulbound:{armor:'scalemail'},gunslinger:{armor:'jerkin'}}[cls];
    const base=pool.find(b=>b.id===preferred?.[slot])||pool.find(b=>ITEM_CLASSES[b.id]?.includes(cls))||pool[0];
    if(base) inv.equip[canonical]=makeNamed(base.id,18,1,cls);
  }
  if(cls==='samurai'||cls==='soulbound'||cls==='gunslinger'){inv.bag.push(inv.equip.head);inv.equip.head=null;}
  const own=WEAPONS.filter(b=>b.cls===cls&&b.lvl<=18&&!b.named);
  if(own.length) inv.equip.weapon=makeNamed(own[Math.min(1,own.length-1)].id,18,2,cls);
  const unique=LEGENDARIES.find(l=>{const b=WEAPONS.find(w=>w.id===l.base);return b&&eligible(b,cls,l)&&(l.r??4)===4;});
  if(unique) inv.bag.push(makeNamed(unique.id,18,null,cls));
  for(let r=0;r<=5;r++) inv.bag.push(genItem({level:18,cls,slot:'weapon',rarity:r}));
  for(const b of own.slice(0,5)) inv.bag.push(makeNamed(b.id,18,2,cls));
  for(const slot of ['helm','armor','arms','legs','boots','charm','ring'])inv.bag.push(genItem({level:18,cls,slot,rarity:2}));
  inv.bag=inv.bag.filter(Boolean); computeStats(inv); // initializes only this in-memory character
  return inv;
}
export class PreviewState {
  constructor(){this.characters=new Map();this.query='';this.category='all';this.rarity='all';this.sort='rarity';this.expanded=false;this.switchClass('samurai');}
  switchClass(cls){if(!CLASSES[cls])throw Error('Unknown class');if(!this.characters.has(cls))this.characters.set(cls,sampleCharacter(cls));this.inv=this.characters.get(cls);this.selected=this.inv.bag.find(it=>it.slot==='weapon'&&it.r===4)||this.inv.bag[0]||this.inv.equip.weapon;this.expanded=false;}
  get stats(){return computeStats(this.inv);}
  get context(){return {inv:this.inv,pstats:this.stats};}
  all(){return [...this.inv.bag,...Object.values(this.inv.equip).filter(Boolean)];}
  equippedSlot(item){return Object.keys(SLOT_LABELS).find(slot=>this.inv.equip[slot]===item);}
  targetSlot(item){return item.slot==='ring'?(!this.inv.equip.ring1?'ring1':!this.inv.equip.ring2?'ring2':'ring1'):(SLOT_ALIASES[item.slot]||item.slot);}
  current(item){return this.inv.equip[this.targetSlot(item)];}
  isProtected(item){return this.inv.lockedItems.includes(item.itemInstanceId);}
  select(id){const item=this.all().find(it=>it.itemInstanceId===id);if(item)this.selected=item;}
  toggleProtection(){const id=this.selected?.itemInstanceId;if(!id)return;const i=this.inv.lockedItems.indexOf(id);if(i<0)this.inv.lockedItems.push(id);else this.inv.lockedItems.splice(i,1);}
  equip(){const it=this.selected;if(!it)return 'Select an item first.';const worn=this.equippedSlot(it);
    if(worn){const after={...this.inv,equip:{...this.inv.equip,[worn]:null}};if(this.inv.bag.length+1>bagCapacity(after))return 'Satchel full. Make room before unequipping.';this.inv.equip[worn]=null;this.inv.bag.push(it);return 'Unequipped in this preview.';}
    const i=this.inv.bag.indexOf(it),slot=this.targetSlot(it);if(i<0||!Object.hasOwn(SLOT_LABELS,slot))return 'Cannot equip this item.';
    const old=this.inv.equip[slot],after={...this.inv,equip:{...this.inv.equip,[slot]:it}};if(this.inv.bag.length-(old?0:1)>bagCapacity(after))return 'Make room before replacing the satchel.';
    this.inv.bag.splice(i,1,...(old?[old]:[]));this.inv.equip[slot]=it;return 'Equipped in this preview.';
  }
  visible(){const q=this.query.toLowerCase().trim(),g=this.context;return this.inv.bag.filter(it=>{
    const inf=itemInfo(it,g),category=it.slot==='weapon'?'weapon':['ring','charm'].includes(it.slot)?'jewel':'armour';
    return (this.category==='all'||this.category===category||this.category==='protected'&&this.isProtected(it))&&(this.rarity==='all'||rarityOf(it).index===Number(this.rarity))&&(!q||[it.name,inf.type,inf.clsName,inf.weapon?.primary,inf.weapon?.secondary,...inf.unique,...inf.properties.map(p=>p.text)].join(' ').toLowerCase().includes(q));
  }).sort((a,b)=>this.sort==='name'?a.name.localeCompare(b.name):this.sort==='slot'?a.slot.localeCompare(b.slot)||a.name.localeCompare(b.name):rarityOf(b).index-rarityOf(a).index||a.name.localeCompare(b.name));}
  resetFilters(){this.query='';this.category='all';this.rarity='all';this.sort='rarity';}
}
