import {migrateSave,normalizeCharacter,SCHEMA_VERSION,newId} from './model.js';
import {SAVE_KEY} from './provider.js';
export function parseTransfer(text){
 if(text.length>5_000_000)throw Error('Save exceeds 5 MB.');
 let raw=JSON.parse(text);
 if(typeof raw?.[SAVE_KEY]==='string')raw=JSON.parse(raw[SAVE_KEY]);
 const inspect=v=>{if(typeof v==='string'&&/[<>"&]/.test(v))throw Error('Save contains unsupported markup.');if(v&&typeof v==='object')Object.values(v).forEach(inspect);};
 for(const p of raw.characters||[])inspect(p.inventory);
 if(raw.inv)inspect(raw.inv);
 const data=migrateSave(raw);
 if(!data.characters.length||data.characters.length>30)throw Error('Import needs 1–30 characters.');
 return data;
}
// Imports always create copies. Original characters and stale-tab revisions survive.
export function importCopies(provider,data){
 const incoming=migrateSave(data),current=provider.read();
 const copies=incoming.characters.map(source=>{
  const p=structuredClone(source),id=newId(),map=new Map();p.id=id;p.name=p.name.slice(0,40)+' (imported)';p.revision=1;
  for(const it of [...p.inventory.bag,...Object.values(p.inventory.equip).filter(Boolean)]){
   const fresh=newId();map.set(it.itemInstanceId,fresh);it.itemInstanceId=fresh;it.ownerCharacterId=id;
  }
  p.inventory.lockedItems=p.inventory.lockedItems.map(id=>map.get(id)).filter(Boolean);
  p.createdAt=p.updatedAt=new Date().toISOString();return normalizeCharacter(p);
 });
 provider.write({schemaVersion:SCHEMA_VERSION,characters:[...current.characters,...copies]});
 return copies;
}
