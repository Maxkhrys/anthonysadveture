import { LIMITS, COMBAT_EVENTS, ELEMENT_DEFS, STATUS_DEFS, PROC_DEFS } from './definitions.js';
import { elementOf } from '../elements.js';
import { Projectile } from '../combat.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class ItemCombat {
  constructor(g,random=Math.random) { this.g=g;this.random=random;this.reset(); }
  reset() { this.queue=[];this.cooldowns=new Map();this.counters=new Map();this.statuses=new Map();this.entities=[];this.deaths=new WeakSet();this.clock=0;this.context=null;this.budget=LIMITS.events;this.barrier=0;this.barrierUntil=0;this.hasteUntil=0;this.combatUntil=0;this.wasMax=false;this.wasLow=false;this.lastPosition=null;this.moving=false;this.volley=0; }
  get build(){return this.g.pstats?.arpg||{stats:{},effects:[],mods:{},element:'physical'};}
  nearby(at,r=6) {const g=this.g;return (g.entities||[]).filter(e=>e.isEnemy&&!e.dead&&(!g.room||!e.room||e.room===g.room.id||e.arena)&&distance(at,e)<r+(e.r||.3)&&(!g.shotClear||g.shotClear(at.x,at.z,e.x,e.z))).sort((a,b)=>distance(at,a)-distance(at,b)).slice(0,LIMITS.targets);}
  emit(type,ctx={}) {
    if(!COMBAT_EVENTS.includes(type))return;
    const c={depth:this.context?.depth||0,...ctx};
    if(c.depth>LIMITS.depth||this.queue.length>=LIMITS.queue)return;
    this.queue.push({type,...c});
  }
  kill(target) {
    if(this.deaths.has(target))return;this.deaths.add(target);
    const statuses=Object.fromEntries([...(this.statuses.get(target)||new Map())].map(([k,s])=>[k,{...s}]));
    const ctx={target,statuses,...this.context};this.emit('kill',ctx);if(target.elite)this.emit('eliteKill',ctx);
  }
  elementFor(o) {
    const w=this.g.inv.equip.weapon;
    return o.element || ((o.basic || ['sword','arrow','bolt','lash'].includes(o.kind)) && w?.itemizationVersion && w.r > 0 ? this.build.element : elementOf(o));
  }
  hit(target,o,dmg,crit) {
    const depth=o.arpgDepth||0,el=o.element||this.build.element;
    if(this.clock>=this.combatUntil)this.emit('enterCombat',{target,depth});this.combatUntil=this.clock+5;
    const ctx={target,damage:dmg,crit,element:el,depth};
    // Proc damage may cause bounded death chains, never full on-hit/crit feedback loops.
    if(!o.arpgProc&&!o.noProc) { this.emit('hit',ctx);if(crit)this.emit('crit',ctx);if(target.isBoss)this.emit('bossHit',ctx); }
    if(!o.arpgProc && !o.noProc && this.g.inv.equip.weapon?.itemizationVersion && this.g.inv.equip.weapon.r > 0 && this.random() < .2 + (this.build.stats.statusChance||0)/100) this.applyStatus(target,ELEMENT_DEFS[el]?.status,1,depth);
    if(o.arpgStatus)this.applyStatus(target,o.arpgStatus,1,depth);
    if(o.arpgProjectile)o.arpgProjectile.lastCrit=crit;
  }
  scale(target,o) {
    const b=this.build,s=b.stats,raw=o.element||b.element,el=({steel:'physical',heavy:'physical',resonance:'physical',echo:'spirit',hex:'spirit',arcane:'spirit',thorn:'poison',glass:'frost'}[raw]||raw);
    let n=1+(s[el+'Damage']||0)/100;
    if(el!=='physical')n*=1+(s.elementalDamage||0)/100;
    if(['bolt','fireball','comet','shard'].includes(o.kind))n*=1+(s.spellDamage||0)/100;
    const statuses=this.statuses.get(target);
    if(statuses)for(const [id,v] of statuses)n*=1+(STATUS_DEFS[id].vulnerable||0)*v.stacks;
    if(o.arpgProjectile){const p=o.arpgProjectile;if(p.dist<3)n*=1+(b.mods.close||0);if(p.dist>6)n*=1+(b.mods.distant||0);}
    return Math.min(5,n);
  }
  applyStatus(target,id,stacks=1,depth=0) {
    const d=STATUS_DEFS[id];if(!d||!target||target.dead)return;
    if(!this.statuses.has(target)&&this.statuses.size>=LIMITS.statuses)return;
    let states=this.statuses.get(target);if(!states)this.statuses.set(target,states=new Map());
    const old=states.get(id),s={stacks:Math.min(d.stacks,(old?.stacks||0)+stacks),time:d.duration*(1+(this.build.stats.statusDuration||0)/100),tick:old?.tick||0,depth};
    states.set(id,s);
    if(d.control) {
      const boss=target.isBoss||target.elite;
      if(id==='freeze'&&boss){target.arpgFrost=(target.arpgFrost||0)+1;const threshold=target.isBoss?5:3;
        target.applyStatus?.('chill',s.time);if(target.arpgFrost>=threshold){target.arpgFrost=0;target.stagger=Math.max(target.stagger||0,target.isBoss?.35:.6);target.arpgStaggerUntil=this.clock+(target.isBoss?.35:.6);}
      }else target.applyStatus?.(d.control,s.time*(boss?.35:1));
    }
    if(id==='chill'&&s.stacks===d.stacks) {states.delete('chill');this.applyStatus(target,'freeze',1,depth);}
    this.emit('statusApply',{target,status:id,element:d.element,depth});
  }
  strike(target,power,element,depth=1,extra={}) {
    if(!target||target.dead||depth>LIMITS.depth||this.budget<=0)return;
    this.budget--;
    return this.g.playerHit(target,{mult:power,kind:'arpg',element,kb:0,dir:0,noProc:true,noShock:true,arpgProc:true,arpgDepth:depth,quiet:true,...extra});
  }
  ring(at,r,el) {this.g.fx?.ring(at.x,at.z,.1,r,ELEMENT_DEFS[el]?.color||0xffffff,.35);}
  resource(n) {this.g.res=clamp(this.g.res+n*(1+(this.build.stats.resourceGeneration||0)/100),0,100);this.g.hudDirty=true;}
  dispatch(e) {
    for(const instance of this.build.effects) {
      const d=PROC_DEFS[instance.id];if(!d||d.event!==e.type)continue;
      if(d.kind==='resource'&&this.g.inv.cls==='gunslinger'&&e.depth>0)continue;
      if(d.onlyStatus&&d.onlyStatus!==e.status)continue;
      if(d.requiresElement&&d.requiresElement!==e.element)continue;
      const status=e.statuses?.[d.requires||d.status]||this.statuses.get(e.target)?.get(d.requires||d.status);
      if(d.requires&&!status)continue;
      if(d.minStacks&&(!status||status.stacks<d.minStacks))continue;
      // All copies share an effect cooldown; equipment swapping cannot reset it.
      const key=d.id;
      if((this.cooldowns.get(key)||0)>this.clock)continue;
      if(d.every){const n=(this.counters.get(key)||0)+1;this.counters.set(key,n);if(n%d.every)continue;}
      const chance=clamp((instance.chance??d.chance)+(d.kind==='status'?(this.build.stats.statusChance||0)/100:0),0,1);
      if(this.random()>chance)continue;
      this.cooldowns.set(key,this.clock+d.cooldown);
      if(this.budget--<=0)break;
      this.execute(d,{...e,depth:(e.depth||0)+1});
    }
  }
  execute(d,e) {
    if(e.depth>LIMITS.depth)return;
    const g=this.g,at=e.target||g.player,target=e.target,el=d.element,r=d.radius*(1+(this.build.stats.areaSize||0)/100);
    switch(d.kind) {
      case 'status':this.applyStatus(target,d.status,d.stacks||1,e.depth);break;
      case 'nova':this.ring(at,r,el);for(const t of this.nearby(at,r)){this.strike(t,d.power,el,e.depth);if(d.status)this.applyStatus(t,d.status,1,e.depth);}break;
      case 'chain': {let from=at,power=d.power;const seen=new Set([at]);for(let i=0;i<(d.jumps||3);i++){const t=this.nearby(from,d.range||4).find(t=>!seen.has(t));if(!t)break;seen.add(t);this.ring(t,.5,el);this.strike(t,power,el,e.depth);this.applyStatus(t,'shock',1,e.depth);from=t;power*=d.falloff||.75;}break;}
      case 'projectile': {const from=d.origin==='target'?at:g.player;const next=target&&!target.dead?target:this.nearby(from,8).find(t=>t!==target);const dir=next?Math.atan2(next.x-from.x,next.z-from.z):g.player.facing;for(let i=0;i<(d.count||1);i++)this.projectile({x:from.x,z:from.z,dir:dir+(i-((d.count||1)-1)/2)*.22,mult:d.power,element:el,arpgStatus:d.status,pierce:d.pierce||0,homing:d.homing||0,arpgDepth:e.depth,arpgProc:true,arpgChild:true,exclude:target===from?target:null});break;}
      case 'zone':case 'trap':case 'source':case 'orb': this.spawn(d,{...e,x:at.x,z:at.z,radius:r});break;
      case 'spread':for(const t of this.nearby(at,r+1)){if(t===target)continue;this.applyStatus(t,d.status,1,e.depth);if(d.burst)this.strike(t,.55,el,e.depth);}this.ring(at,r,el);break;
      case 'consume': {const map=this.statuses.get(target),s=map?.get(d.status);if(s){map.delete(d.status);this.strike(target,d.power*s.stacks,el,e.depth);this.ring(at,1,el);}break;}
      case 'execute':if(target&&!target.dead&&target.hp<target.maxHp*d.threshold)this.strike(target,d.power*(target.isBoss?1:3),el,e.depth);break;
      case 'heal':g.heal(g.inv.maxHp*d.power,true);break;
      case 'resource':this.resource(d.power);break;
      case 'cooldown':for(const id in g.player.cdMap)g.player.cdMap[id]=Math.max(0,g.player.cdMap[id]-d.power);break;
      case 'haste':this.hasteUntil=this.clock+d.duration;break;
      case 'pull':this.pull(at,r,d.power);break;
      case 'barrier':this.barrier=Math.min(g.inv.maxHp*.3,this.barrier+g.inv.maxHp*d.power);this.barrierUntil=this.clock+d.duration;this.ring(g.player,.8,el);break;
    }
  }
  pull(at,r,power){for(const t of this.nearby(at,r)){if(t.isBoss)continue;const d=distance(at,t);if(d>.2){t.kx=(t.kx||0)+(at.x-t.x)/d*power;t.kz=(t.kz||0)+(at.z-t.z)/d*power;}}}
  spawn(d,e) {
    if(this.entities.length>=LIMITS.effects)return;
    if(d.convert&&(e.target?.isBoss||e.target?.elite))return;
    const key=d.id;if(this.entities.filter(x=>x.id===key).length>=3)return;
    const owner=this.g.profile?.id||'player';
    this.entities.push({...d,x:e.x,z:e.z,radius:e.radius||d.radius,id:key,owner,time:(d.delay||0)+d.duration*(d.kind==='source'?1+(this.build.stats.summonDuration||0)/100:1),age:0,tick:0,tickRate:d.tick||d.tickRate,depth:e.depth||1,arming:d.arming??.45,dir:this.g.player.facing,phase:this.random()*6.28});
    this.ring(e,d.radius,d.element);
  }
  projectile(o) {
    if((o.arpgDepth||0)>LIMITS.depth||(this.g.entities||[]).filter(e=>e instanceof Projectile&&!e.dead).length>=LIMITS.projectiles)return;
    const p=new Projectile(this.g,{kind:'shard',speed:12,range:8,color:ELEMENT_DEFS[o.element]?.color||0xffffff,noCraft:true,noSplit:true,...o});if(o.exclude)p.hit.add(o.exclude);this.g.spawn(p);return p;
  }
  prepareProjectile(p,o) {
    p.arpgDepth=o.arpgDepth||0;p.arpgProc=!!o.arpgProc;p.arpgChild=!!o.arpgChild;p.arpgStatus=o.arpgStatus;p.arpgModified=true;
    p.element = this.elementFor(o);
    if(p.arpgChild)return;
    const b=this.build,s=b.stats,m=b.mods;
    p.pierce+=Math.min(6,(s.pierce||0)+(m.pierce||0));p.bounce+=Math.min(4,(s.bounce||0)+(m.bounce||0));p.homing=Math.max(p.homing,m.homing||0);
    p.speed*=1+(s.projectileSpeed||0)/100;p.acceleration=m.acceleration||0;p.returning=!!m.returning;
    if(o.basic&&!o.arpgExtra){this.volley++;if(m.third&&this.volley%3===0)p.mult*=m.third;
      const count=Math.min(LIMITS.children,(s.projectileCount||0)+(m.projectileCount||0));
      if(count){p.mult*=m.shotPower||.75;for(let i=0;i<count;i++)this.projectile({...o,mult:p.mult,dir:o.dir+(i%2?1:-1)*(.18+Math.floor(i/2)*.16),arpgExtra:true,arpgDepth:0,element:p.element});}
    }
  }
  impact(p,target) {
    this.emit('projectileImpact',{target,element:p.element,depth:p.arpgDepth,crit:p.lastCrit});
    if(p.arpgChild||p.arpgDepth>=LIMITS.depth)return;
    const m=this.build.mods;
    const n=Math.min(LIMITS.children,(m.fork||0)||(p.lastCrit&&m.criticalFork)|| (target.dead&&m.splitDeath)||0);
    for(let i=0;i<n;i++)this.projectile({x:target.x,z:target.z,dir:p.dir+(i-(n-1)/2)*.5,mult:p.mult*.5,element:p.element,arpgDepth:p.arpgDepth+1,arpgChild:true,arpgProc:true,exclude:target,pierce:Math.max(0,p.pierce),arpgStatus:p.arpgStatus});
    if(m.explosive)this.execute({kind:'nova',element:p.element,radius:1.5,power:p.mult*m.explosive},{target,depth:p.arpgDepth+1});
    if(m.ground&&!(this.cooldowns.get('ground')>this.clock)){this.cooldowns.set('ground',this.clock+1);this.spawn({id:'ground',kind:'zone',element:p.element,status:ELEMENT_DEFS[p.element]?.status,duration:3,radius:1.4,power:.2},{x:target.x,z:target.z,depth:p.arpgDepth+1});}
    if(m.living&&target.dead&&!p.lived){const next=this.nearby(target,6).find(t=>!p.hit.has(t));if(next){p.lived=true;p.pierce++;p.homing=5;p.dir=Math.atan2(next.x-p.x,next.z-p.z);p.dist=0;}}
  }
  controlScale(target) {
    if (!target.isBoss || target.state === 'dying') return 1;
    if (target.arpgStaggerUntil > this.clock) return .45;
    const states=this.statuses.get(target);
    return states?.has('freeze') ? .65 : states?.has('chill') ? .8 : 1;
  }
  incoming(n,src) {
    const s=this.build.stats;
    if(this.random()<Math.min(.3,(s.dodgeChance||0)/100)){this.emit('dodge',{target:src});return 0;}
    let reduction=(this.moving?s.movingGuard||0:0)+(this.g.res>=99?s.fullGuard||0:0)+(this.nearby(this.g.player,3).length>=3?s.surroundedGuard||0:0);
    n*=1-Math.min(.5,reduction/100);
    if(this.clock<this.barrierUntil){const absorbed=Math.min(this.barrier,n);this.barrier-=absorbed;n-=absorbed;}
    if(n>0)this.emit('takingDamage',{target:src,damage:n});return Math.round(n);
  }
  update(dt) {
    const g=this.g;if(!g.player||g.player.state==='dead'||g.dead){this.reset();return;}
    this.clock+=dt;this.budget=LIMITS.events;
    if(this.lastPosition)this.moving=distance(this.lastPosition,g.player)>.002;this.lastPosition={x:g.player.x,z:g.player.z};
    const max=g.res>=99,low=g.inv.hp<=g.inv.maxHp*.25;if(max&&!this.wasMax)this.emit('maxResource');if(low&&!this.wasLow)this.emit('lowHealth');this.wasMax=max;this.wasLow=low;
    for(const [target,states] of this.statuses) {
      if(target.dead){this.statuses.delete(target);continue;}
      for(const [id,s] of states) {
        const d=STATUS_DEFS[id];s.time-=dt;s.tick-=dt;
        if(d.dot&&s.tick<=0){s.tick=.5;this.strike(target,d.dot*s.stacks*.5,d.element,s.depth,{arpgProc:true});}
        if(s.time<=0){states.delete(id);this.emit('statusExpire',{target,status:id,element:d.element,depth:s.depth});if(d.expire)this.strike(target,d.expire,d.element,s.depth);}
      }
      if(!states.size)this.statuses.delete(target);
    }
    // Snapshot prevents newly spawned effects updating recursively within the same tick.
    for(const a of [...this.entities]) {
      a.age+=dt;a.time-=dt;a.tick-=dt;
      if(a.time<=0)continue;
      if(a.kind==='orb'){if(distance(a,g.player)<1.4){a.time=0;if(a.heal)g.heal(g.inv.maxHp*a.power,true);else this.resource(a.power);} }
      if(a.delay&&a.age<a.delay)continue;
      if(a.kind==='trap'&&(a.age<a.arming||!this.nearby(a,a.radius).length))continue;
      if(a.mobile){const t=this.nearby(a,7)[0],to=t||g.player,d=distance(a,to);if(d>1){a.x+=(to.x-a.x)/d*dt*3;a.z+=(to.z-a.z)/d*dt*3;}}
      if(a.tick<=0){a.tick=a.tickRate||a.rate||.65;
        this.ring(a,a.kind==='source'?.5:a.radius,a.element);
        if(a.kind==='source') {
          if(a.healing){if(distance(a,g.player)<5)g.heal(g.inv.maxHp*.025,true);}
          else{const t=this.nearby(a,a.range||7)[0];if(t){const stat=a.mobile?'summonDamage':'turretDamage';this.strike(t,a.power*(1+(this.build.stats[stat]||0)/100),a.element,a.depth);if(a.status)this.applyStatus(t,a.status,1,a.depth);if(a.decoy&&!t.isBoss){t.kx=(a.x-t.x)*2;t.kz=(a.z-t.z)*2;}if(a.bomb){this.execute({kind:'nova',element:a.element,power:1.6,radius:2},{target:t,depth:a.depth});a.time=0;}}}
        }else if(a.kind!=='orb') {
          if(a.pull)this.pull(a,a.radius,3);
          for(const t of this.nearby(a,a.radius)) {
            if(a.shape==='line'&&Math.abs((t.x-a.x)*Math.cos(a.dir)-(t.z-a.z)*Math.sin(a.dir))>.7)continue;
            this.strike(t,a.power*(a.kind==='trap'?1+(this.build.stats.trapDamage||0)/100:1),a.element,a.depth);if(a.status)this.applyStatus(t,a.status,1,a.depth);
          }
          if(a.kind==='trap')a.time=0;
        }
      }
    }
    this.entities=this.entities.filter(a=>a.time>0);
    while(this.queue.length&&this.budget>0){const e=this.queue.shift();this.budget--;this.dispatch(e);}
    // Discard overload instead of accumulating work and replaying stale attacks later.
    if(this.budget<=0)this.queue=[];
  }
}
export function itemCombat(g){return g.itemCombat||(g.itemCombat=new ItemCombat(g));}
