import test from 'node:test';import assert from 'node:assert/strict';
import {LocalSaveProvider,SAVE_KEY} from '../src/persistence/provider.js';
import {parseTransfer,importCopies} from '../src/persistence/transfer.js';
import {starterWeapon} from '../src/rpg/items.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('import preserves originals, world seed, item ownership and protected item references',()=>{
 const p=new LocalSaveProvider(storage()),original=p.createCharacter({name:'Moss',classId:'samurai'});original.inventory.equip.weapon=starterWeapon('samurai');original.inventory.lockedItems=[original.inventory.equip.weapon.itemInstanceId];p.saveCharacter(original);
 const before=p.read(),added=importCopies(p,parseTransfer(JSON.stringify(before))),after=p.read();
 assert.deepEqual(after.characters[0],before.characters[0]);assert.equal(after.characters.length,2);assert.notEqual(added[0].id,original.id);
 assert.equal(added[0].world.seed,original.world.seed);assert.notEqual(added[0].inventory.equip.weapon.itemInstanceId,original.inventory.equip.weapon.itemInstanceId);
 assert.equal(added[0].inventory.equip.weapon.ownerCharacterId,added[0].id);assert.equal(added[0].inventory.lockedItems[0],added[0].inventory.equip.weapon.itemInstanceId);
});
test('recovery export is accepted and bad/future saves never change current storage',()=>{
 const p=new LocalSaveProvider(storage());p.createCharacter({name:'A',classId:'witch'});const before=JSON.stringify(p.read());
 assert.equal(parseTransfer(JSON.stringify({[SAVE_KEY]:before})).characters.length,1);
 for(const data of ['oops',JSON.stringify({schemaVersion:99,characters:[]}),JSON.stringify({schemaVersion:3,characters:[]})])assert.throws(()=>parseTransfer(data));assert.equal(JSON.stringify(p.read()),before);
});
