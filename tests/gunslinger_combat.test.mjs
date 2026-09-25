import {fresh,sim,toSquare} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'gunslinger',{level:16});await toSquare(page);
 const checks=await page.evaluate(async()=>{
  const g=__game,p=g.player,I=await import('/src/rpg/items.js'),F=await import('/src/rpg/firearms.js'),G=await import('/src/rpg/gunslinger.js'),K=await import('/src/rpg/skills.js');g.flags.onboarding=null;g.flags.guideDone=true;g.noRender=true;
  p.x=140.5;p.z=146.5;p.facing=Math.PI/2;p.aimSrc='keys';g.input.aimSrc='keys';
  const result={};
  const reset=(id='trailrevolver')=>{for(const e of [...g.entities])if(e!==p&&(e.isEnemy||e.isSentry||e.constructor.name==='Projectile'||e instanceof G.Powder))e.remove();g.inv.equip.weapon=id==='trailrevolver'?I.starterWeapon('gunslinger'):I.makeNamed(id,10);g.inv.tree=Object.fromEntries(K.TREES.gunslinger.filter(n=>n.type==='active').map(n=>[n.id,1]));g.recalc();p.reload=null;p.barrage=null;p.gunCd=0;p.gunPrimed=false;p.cdMap={};p.setState('move');p.invuln=0;g.res=100;F.magazine(g.inv.equip.weapon);};
  const dummy=(dx=3,dz=0,kind='blot')=>{const e=g.spawnEnemy(kind,p.x+dx,p.z+dz,{noRoom:true,eliteChance:0});e.spawnT=0;e.hp=e.maxHp=10000;e.think=()=>[0,0];e.poise=true;e.kbMul=0;e.elite=null;return e;};
  const tick=n=>__sim(n,[]);
  reset();let e=dummy(3,0,'brigand');e.facing=-Math.PI/2;G.fireGun(p);tick(24);result.shield=e.hp===e.maxHp;
  p.reload=null;p.cdMap={};g.res=100;p.castAbility('powdergrenade',{x:e.x,z:e.z,ok:true});tick(100);result.explosion=e.hp<e.maxHp;
  reset();e=dummy();g.inv.equip.weapon.magazine.rounds=3;p.gunPrimed=true;p.castAbility('barrage');tick(40);result.barrage=g.inv.equip.weapon.magazine.rounds===0&&!!p.reload&&p.gunPrimed;
  reset();e=dummy();p.castAbility('deadeyemark');result.mark=p.marked===e&&p.markUntil>g.time;
  p.cdMap={};g.res=100;const at={x:p.x+1,z:p.z,ok:true};p.castAbility('sentryturret',at);let t=g.entities.find(e=>e.isSentry&&!e.dead);result.priority=e.p===t;
  const before=t.hp;t.hurt({dmg:2,src:e});result.turretDamage=t.hp<before;t.hurt({dmg:20,src:e});result.destroy=t.dead;
  reset();g.inv.tree.twinsentries=1;g.recalc();for(let i=0;i<3;i++){g.res=100;p.cdMap={};p.castAbility('sentryturret',{x:p.x+1,z:p.z+i*.4,ok:true});}result.cap=g.entities.filter(e=>e.isSentry&&!e.dead).length===2;
  for(const t of g.entities.filter(e=>e.isSentry&&!e.dead))t.update(13);result.lifetime=g.entities.filter(e=>e.isSentry&&!e.dead).length===0;
  reset();e=dummy();p.castAbility('smokebomb');tick(2);result.smoke=!e.playerVisible();e.isBoss=true;result.bossSees=e.playerVisible();e.isBoss=false;
  reset('sundownsix');e=dummy();let w=g.inv.equip.weapon;w.magazine.rounds=1;G.fireGun(p);tick(24);result.sundownHit=w.magazine.finalHit;F.completeReload(w);result.sundownBonus=w.magazine.opening===.75;
  reset('kilnrunner');e=dummy(2);let grenade=new G.Powder(g,p,{x:e.x,z:e.z,ok:true},3);g.spawn(grenade);for(let i=0;i<30;i++)grenade.update(.016);result.sticky=grenade.attached===e;G.fireGun(p);tick(12);result.kiln=grenade.boost>0&&grenade.boost<=.5;
  reset('bellfoundryrepeater');e=dummy(3);t=new G.Sentry(g,p,{x:p.x,z:p.z+1},1);g.spawn(t);p.gunPrimed=true;G.fireGun(p);tick(18);result.synchronised=p.syncAt>g.time;
  reset('seventhchime');w=g.inv.equip.weapon;F.spendRounds(w,6);F.completeReload(w);G.fireGun(p);let bullet=g.entities.find(e=>e.manualGun&&!e.dead);const boosted=bullet;p.gunCd=0;G.fireGun(p);const normal=g.entities.filter(e=>e.manualGun&&!e.dead).at(-1);result.spectral=boosted?.pierce>0&&boosted.mult>normal.mult&&!w.magazine.spectral;
  reset();const clear=g.shotClear.bind(g);e=dummy();t=new G.Sentry(g,p,{x:p.x+1,z:p.z},1);g.spawn(t);g.shotClear=()=>false;let count=g.entities.filter(e=>e.constructor.name==='Projectile'&&!e.dead).length;t.fire(e);result.cover=g.entities.filter(e=>e.constructor.name==='Projectile'&&!e.dead).length===count;g.shotClear=clear;
  reset();g.inv.tree.elementalpayload=1;g.inv.gunPayload='frost';g.recalc();e=dummy();grenade=new G.Powder(g,p,{x:e.x,z:e.z,ok:true},3);grenade.x=e.x;grenade.z=e.z;grenade.explode();result.frost=e.status.chill>0;
  const res=g.res;p.castAbility('satchelcharge',{x:p.x+3,z:p.z,ok:false});result.invalid=g.res===res&&!p.satchel;
  g.noRender=false;return result;
 });
 for(const [k,v]of Object.entries(checks))R.ok(!!v,k);
}
