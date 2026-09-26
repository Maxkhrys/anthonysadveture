// References owned items by instance ID. Never copies equipment or creates a second bag.
export const BELT_SIZE=8;
export function availableItems(g){return [...Object.values(g.inv.equip),...g.inv.bag].filter(x=>x?.slot==='weapon'&&typeof x.itemInstanceId==='string');}
export function reconcileBelt(record,g){
 const owned=availableItems(g),valid=new Set(owned.map(x=>x.itemInstanceId));
 const old=record.fieldKit||{},seen=new Set();
 const slots=Array.from({length:BELT_SIZE},(_,i)=>{const id=old.slots?.[i];if(typeof id!=='string'||!valid.has(id)||seen.has(id))return null;seen.add(id);return id;});
 for(const item of owned){if(seen.has(item.itemInstanceId))continue;const empty=slots.indexOf(null);if(empty<0)break;slots[empty]=item.itemInstanceId;seen.add(item.itemInstanceId);}
 record.fieldKit={slots,selected:Number.isInteger(old.selected)?Math.max(0,Math.min(7,old.selected)):0};return record.fieldKit;
}
export function selectBelt(g,index){
 const m=g.survival;if(!m?.active||g.dead||g.locked()||g.ui.invOpen||m.ui?.open||g.devlab?.overlayOpen)return false;
 const p=g.player;if(p.state!=='move'||p.reload||p.barrage||p.targeting||p.gunCd>0){g.ui.toast('Finish your action','Switch weapons once the attack or reload ends.',1);return false;}
 const belt=reconcileBelt(m.record,g),id=belt.slots[index];if(!id)return false;
 if(g.inv.equip.weapon?.itemInstanceId!==id){const i=g.inv.bag.findIndex(x=>x.itemInstanceId===id);if(i<0)return false;g.equipItem(i);if(g.inv.equip.weapon?.itemInstanceId!==id)return false;}
 m.endBuild();m.record.fieldKit.selected=index;g.save();m.ui?.refresh();return true;
}
