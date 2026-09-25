import test from 'node:test';
import assert from 'node:assert/strict';
import {genItem,makeReward,makeNamed,baseById,starterWeapon} from '../src/rpg/items.js';
import {eligible,modifierEligible,CLASS_CAPABILITIES} from '../src/rpg/eligibility.js';
import {magazine,spendRounds,completeReload,FIREARMS} from '../src/rpg/firearms.js';
import {TREES,SKILLS,ensureTree,spendNode,respecTree} from '../src/rpg/skills.js';
import {createProfile,normalizeCharacter,defaultInventory} from '../src/persistence/model.js';
test('every generated slot, rarity and class is eligible without downgrades',()=>{
 for(const cls of Object.keys(CLASS_CAPABILITIES))for(const slot of ['weapon','helm','armor','arms','legs','boots','charm','ring'])for(let rarity=0;rarity<6;rarity++)for(let i=0;i<30;i++){
  const it=genItem({cls,slot,rarity,level:i%20+1});assert.ok(eligible(baseById(it.base),cls,{id:it.unique}));assert.equal(it.slot,slot);assert.ok(it.r>=rarity);for(const m of it.modifiers)assert.ok(modifierEligible(m.id,cls),cls+' '+m.id);
 }
 assert.throws(()=>genItem(),/recipient/);
});
test('fixed rewards adapt to all recipients, preserve source and existing items',()=>{
 const old=makeNamed('mothlight',10),snapshot=JSON.stringify(old);
 for(const cls of Object.keys(CLASS_CAPABILITIES))for(const id of ['seamripper','lilypad','mothlight','candelabra','stillwater','wickring']){
  const it=makeReward(id,cls,10);assert.ok(eligible(baseById(it.base),cls,{id:it.unique}));if(it.unique!==id)assert.equal(it.rewardSource,id);
 }
 assert.equal(JSON.stringify(old),snapshot);
});
test('magazines persist per weapon and only completion grants a refill',()=>{
 const inv=defaultInventory('gunslinger'),w=starterWeapon('gunslinger');inv.equip.weapon=w;magazine(w);spendRounds(w,5);
 const profile=normalizeCharacter(createProfile({name:'Gunsmith',classId:'gunslinger',inventory:inv}));assert.equal(profile.inventory.equip.weapon.magazine.rounds,1);
 const rifle=makeNamed('woodrifle',1);assert.equal(magazine(rifle).rounds,18);assert.equal(w.magazine.rounds,1);assert.equal(spendRounds(w,2),false);completeReload(w);assert.equal(w.magazine.rounds,6);
});
test('Seventh Chime requires a complete cylinder and real reload',()=>{
 const w=makeNamed('seventhchime',16);assert.equal(w.r,5);spendRounds(w,5);completeReload(w);assert.equal(w.magazine.spectral,false);spendRounds(w,6);completeReload(w);assert.equal(w.magazine.spectral,true);
});
test('24 nodes, eight actives, free unlocks, one capstone and exact refund',()=>{
 assert.equal(TREES.gunslinger.length,24);assert.equal(Object.values(SKILLS).filter(s=>s.cls==='gunslinger').length,8);
 const inv=defaultInventory('gunslinger');inv.level=20;inv.sp=100;ensureTree(inv);assert.deepEqual(inv.loadout.slice(0,3),['quickdraw','powdergrenade','sentryturret']);
 for(const n of TREES.gunslinger.filter(n=>n.path===0&&n.type!=='key'))while(spendNode(inv,n.id)){}
 assert.ok(spendNode(inv,'highnoon'));assert.equal(spendNode(inv,'twinsentries'),false);const before=inv.sp;const refund=respecTree(inv);assert.equal(inv.sp,before+refund);assert.equal(respecTree(inv),0);
 inv.tree.highnoon=1;inv.tree.twinsentries=1;assert.throws(()=>createProfile({name:'Bad',classId:'gunslinger',inventory:inv}),/capstone/);
});
