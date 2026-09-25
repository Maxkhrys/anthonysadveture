import test from 'node:test';
import assert from 'node:assert/strict';
import {genItem,makeNamed,RARITY} from '../src/rpg/items.js';
import {identifyItem,createProfile,migrateSave,SCHEMA_VERSION} from '../src/persistence/model.js';
import {aggregateGameplay,rollGameplay,gameplayLines} from '../src/rpg/arpg/items.js';
import {PROC_DEFS,STATUS_DEFS,SKILL_MOD_DEFS,LEGENDARY_DEFS,PRISMATIC_DEFS,LIMITS} from '../src/rpg/arpg/definitions.js';
import {ItemCombat} from '../src/rpg/arpg/runtime.js';
function harness(effects=[]) {
 const g={inv:{hp:50,maxHp:100,equip:{}},res:50,profile:{id:'test'},pstats:{arpg:{stats:{},mods:{},effects:effects.map(id=>({id,chance:1})),element:'poison'}},entities:[],player:{x:0,z:0,facing:0,state:'move',cdMap:{test:3}},fx:{ring(){}},heal(n){this.inv.hp=Math.min(this.inv.maxHp,this.inv.hp+n);},shotClear:()=>true};
 const runtime=new ItemCombat(g,()=>0);g.itemCombat=runtime;
 g.playerHit=(t,o)=>{const prev=runtime.context;runtime.context={depth:o.arpgDepth||0,element:o.element};t.hp-=10*o.mult;if(t.hp<=0){t.dead=true;runtime.kill(t);}runtime.context=prev;runtime.hit(t,o,10*o.mult,false);return 'hit';};
 const enemy=(x=1,hp=100)=>{const e={x,z:0,hp,maxHp:hp,isEnemy:true,status:{},applyStatus(k,t){this.status[k]=t;}};g.entities.push(e);return e;};return {g,runtime,enemy};
}
test('all rarities generate finite items; Prismatic is a genuine saved rarity',()=>{
 assert.equal(RARITY.length,6);
 for(let r=0;r<6;r++)for(const cls of ['samurai','archer','witch','soulbound'])for(let i=0;i<30;i++) {
 const it=genItem({rarity:r,slot:'weapon',level:16,cls});assert.equal(it.r,r);assert.ok(Number.isFinite(it.value));assert.ok(it.cls===cls||it.cls===null);assert.ok(it.effects.length>0||r===0);assert.doesNotThrow(()=>identifyItem(it));
 if(r===5){assert.equal(it.prismatic,true);assert.ok(it.unique.startsWith('arpg:'));}
 }
});
test('same base yields genuinely different saved builds and no load rerolls',()=>{
 const a=makeNamed('frostrod',16,3),b=makeNamed('frostrod',16,3);assert.equal(a.base,b.base);
 const combos=new Set(Array.from({length:30},()=>{const it=makeNamed('frostrod',16,3);return JSON.stringify([it.element,it.effects,it.skillMods]);}));assert.ok(combos.size>20);
 const before=JSON.stringify(a);rollGameplay(a,()=>{throw Error('reroll');});assert.equal(JSON.stringify(a),before);
 const disk=JSON.parse(JSON.stringify(a));identifyItem(disk);assert.deepEqual(disk,a);assert.ok(gameplayLines(a).length>4);
});
test('version 3 characters upgrade once without changing old item rolls',()=>{
 const p=createProfile({name:'old',classId:'soulbound'}),it=makeNamed('tetherchain',2,1);delete it.itemizationVersion;delete it.effects;delete it.skillMods;delete it.modifiers;p.inventory.bag.push(it);
 const out=migrateSave({schemaVersion:3,characters:[p]});assert.equal(out.schemaVersion,SCHEMA_VERSION);assert.equal(out.characters[0].inventory.bag[0].itemizationVersion,undefined);assert.equal(out.characters[0].inventory.bag[0].itemInstanceId,it.itemInstanceId);
});
test('invalid modifier and proc rolls fail closed',()=>{
 for(const change of [it=>it.modifiers[0].value=NaN,it=>it.effects[0].chance=2,it=>it.itemizationVersion=99]){const it=makeNamed('frostrod',16,3);change(it);assert.throws(()=>identifyItem(it));}
});
test('registry references all resolve to executable shared mechanics',()=>{
 const kinds=new Set(['status','nova','chain','projectile','zone','trap','source','orb','spread','consume','execute','heal','resource','cooldown','haste','pull','barrier']);
 for(const d of Object.values(PROC_DEFS)){assert.ok(kinds.has(d.kind),d.id);if(d.status)assert.ok(STATUS_DEFS[d.status]);}
 for(const d of Object.values({...LEGENDARY_DEFS,...PRISMATIC_DEFS})){for(const id of d.effects)assert.ok(PROC_DEFS[id],id);for(const id of d.skillMods)assert.ok(SKILL_MOD_DEFS[id],id);}
});
test('equipment aggregation deduplicates aliased equipment',()=>{
 const it=makeNamed('frostrod',16,3);assert.deepEqual(aggregateGameplay({weapon:it,alias:it}),aggregateGameplay({weapon:it}));
});
test('poison stacks deal damage, expire and never become permanent',()=>{
 const {runtime,enemy}=harness(),e=enemy();for(let i=0;i<20;i++)runtime.applyStatus(e,'poison');assert.equal(runtime.statuses.get(e).get('poison').stacks,8);
 runtime.update(.5);assert.ok(e.hp<100);for(let i=0;i<14;i++)runtime.update(.5);assert.equal(runtime.statuses.size,0);
});
test('boss frost builds retain chill and bounded stagger rather than immunity',()=>{
 const {runtime,enemy}=harness(),e=enemy();e.isBoss=true;
 for(let i=0;i<5;i++)runtime.applyStatus(e,'freeze');assert.ok(e.status.chill>0);assert.ok(e.stagger>0&&e.stagger<=.35);assert.equal(e.status.freeze,undefined);assert.equal(runtime.controlScale(e),.45);runtime.clock=1;assert.equal(runtime.controlScale(e),.65);
});
test('meteor telegraph waits then impacts, trap arms then triggers',()=>{
 const {runtime,enemy}=harness(),e=enemy();
 runtime.execute(PROC_DEFS.meteor,{target:e,depth:1});runtime.update(.5);assert.equal(e.hp,100);runtime.update(.5);assert.equal(e.hp,100);runtime.update(.2);assert.ok(e.hp<100);
 runtime.reset();e.hp=100;runtime.execute(PROC_DEFS.fire_mine,{target:e,depth:1});runtime.update(.2);assert.equal(e.hp,100);runtime.update(.3);assert.ok(e.hp<100);assert.equal(runtime.entities.length,0);
});
test('conversion requires five poison stacks and excludes bosses/elites',()=>{
 const {runtime,enemy}=harness(['plague_conversion']);const e=enemy();for(let i=0;i<5;i++)runtime.applyStatus(e,'poison');e.dead=true;runtime.kill(e);runtime.update(.01);assert.equal(runtime.entities.length,1);assert.equal(runtime.entities[0].mobile,true);
 runtime.reset();const boss=enemy();boss.isBoss=true;for(let i=0;i<5;i++)runtime.applyStatus(boss,'poison');boss.dead=true;runtime.kill(boss);runtime.update(.01);assert.equal(runtime.entities.length,0);
});
test('death chain budget and generation depth stop crowd recursion',()=>{
 const {runtime,enemy}=harness(['corpse_explosion','contagion']);const foes=Array.from({length:90},(_,i)=>enemy(1+i*.015,1));for(const e of foes)runtime.applyStatus(e,'poison');foes[0].dead=true;runtime.kill(foes[0]);runtime.update(.016);
 assert.ok(runtime.budget>=-1);assert.ok(runtime.queue.length<=LIMITS.queue);assert.ok(runtime.entities.length<=LIMITS.effects);
 runtime.emit('kill',{target:foes[0],depth:99});assert.ok(runtime.queue.every(e=>e.depth<=LIMITS.depth));
});
test('barriers absorb only up to cap; movement guard is conditional',()=>{
 const {g,runtime}=harness();runtime.random=()=>1;runtime.execute(PROC_DEFS.shield_dodge,{depth:1});assert.equal(runtime.incoming(20),5);g.pstats.arpg.stats.movingGuard=20;runtime.moving=true;assert.equal(runtime.incoming(20),16);runtime.moving=false;assert.equal(runtime.incoming(20),20);
});
test('summons have caps, lifetime and scene/death cleanup',()=>{
 const {runtime,enemy}=harness();const e=enemy();for(let i=0;i<20;i++)runtime.execute(PROC_DEFS.spirit_guardian,{target:e,depth:1});assert.equal(runtime.entities.length,3);
 runtime.update(.5);assert.ok(e.hp<100);runtime.reset();assert.equal(runtime.entities.length,0);assert.equal(runtime.statuses.size,0);assert.ok(!runtime.queue.some(e=>e.type==='hit'||e.type==='crit'));
});
test('cast events and crit procs respect cooldowns and do not recursively proc',()=>{
 const {runtime,enemy,g}=harness(['resource_crit']);const e=enemy();runtime.emit('crit',{target:e});runtime.emit('crit',{target:e});runtime.update(.01);assert.equal(g.res,54);runtime.hit(e,{arpgProc:true},10,true);assert.ok(!runtime.queue.some(e=>e.type==='hit'||e.type==='crit'));
});
