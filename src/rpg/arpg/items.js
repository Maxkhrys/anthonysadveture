import { ITEMIZATION_VERSION, AFFIX_DEFS, ELEMENT_DEFS, PROC_DEFS, SKILL_MOD_DEFS, LEGENDARY_DEFS, PRISMATIC_DEFS } from './definitions.js';
import { modifierEligible } from '../eligibility.js';
const pick = (a,rng) => a[Math.min(a.length-1,Math.floor(rng()*a.length))];
const sample = (a,n,rng) => { const pool=[...a],out=[]; while(out.length<n&&pool.length) { const x=pick(pool,rng); out.push(x); pool.splice(pool.indexOf(x),1); } return out; };
export function rollGameplay(it, rng=Math.random, recipient=it.cls) {
  if(it.itemizationVersion) return it;
  it.itemizationVersion=ITEMIZATION_VERSION;
  if(it.r===5)it.prismatic=true;
  it.rarity=['common','uncommon','rare','epic','legendary','prismatic'][it.r];
  it.element=it.r ? pick(Object.keys(ELEMENT_DEFS),rng) : 'physical';
  it.effects=[];it.skillMods=[];it.modifiers=[];it.prefixes=[];it.suffixes=[];
  if(!it.r) return it;
  const ranged=['bow','staff','wand','revolver','rifle'].includes(it.kind);
  const statPool=Object.values(AFFIX_DEFS).filter(d => modifierEligible(d.id,recipient) && (!d.element||d.element===it.element) && (ranged||!['projectileSpeed','projectileCount','pierce','bounce','spellDamage'].includes(d.id)));
  for(const d of sample(statPool,[0,1,2,3,3,4][it.r],rng)) {
    const value=d.range[0]+rng()*(d.range[1]-d.range[0]);
    it.modifiers.push({id:d.id,value:d.integer?Math.round(value):Math.round(value*10)/10,min:d.range[0],max:d.range[1]});
  }
  const pool=Object.values(PROC_DEFS).filter(d=>(d.element===it.element||['heal','resource','barrier','cooldown'].includes(d.kind))&&(ranged||d.event!=='projectileImpact'));
  for(const d of sample(pool,[0,1,2,3,2,3][it.r],rng)) it.effects.push({id:d.id,chance:Math.min(1,Math.round(d.chance*(.85+rng()*.3)*100)/100)});
  if(it.r>=2) it.skillMods=sample(Object.keys(SKILL_MOD_DEFS).filter(k=>ranged||k==='echo_cast'),it.r>=3?2:1,rng);
  if(it.r>=4&&!it.unique) {
    const defs=it.r===5?PRISMATIC_DEFS:LEGENDARY_DEFS;
    const id=pick(Object.keys(defs),rng),d=defs[id];
    it.unique='arpg:'+id;it.name=d.name;it.element=d.element;
    it.effects=d.effects.map(id=>({id,chance:PROC_DEFS[id].chance}));
    it.skillMods=d.skillMods.filter(k=>ranged||k==='echo_cast');
    // Unique element is authoritative: redirect rolled elemental bonuses to match it.
    it.modifiers=it.modifiers.map(m=>AFFIX_DEFS[m.id].element?{...m,id:d.element+'Damage'}:m);
    it.prismatic=it.r===5;
  }
  it.prefixes=it.modifiers.slice(0,Math.ceil(it.modifiers.length/2)).map(m=>m.id);
  it.suffixes=it.effects.map(e=>e.id);
  return it;
}
export function aggregateGameplay(equip) {
  const out={stats:{},effects:[],mods:{},element:equip?.weapon?.element||'physical'};
  const seen=new Set();
  for(const it of Object.values(equip||{})) {
    if(!it||seen.has(it))continue;seen.add(it);
    for(const m of it.modifiers||[]) if(AFFIX_DEFS[m.id]&&Number.isFinite(m.value)) out.stats[m.id]=(out.stats[m.id]||0)+m.value;
    for(const e of it.effects||[]) if(PROC_DEFS[e.id]) out.effects.push({...e,source:it.itemInstanceId||it.uid});
    for(const id of it.skillMods||[]) {
      const d=SKILL_MOD_DEFS[id];if(!d)continue;
      if(d.proc)out.effects.push({id:d.proc,chance:1,source:it.itemInstanceId||it.uid});
      for(const [k,v] of Object.entries(d)) if(!['name','text','proc'].includes(k)) out.mods[k]=typeof v==='boolean'?v:k==='shotPower'?Math.min(out.mods[k]??1,v):Math.max(out.mods[k]||0,v);
    }
  }
  return out;
}
export function describeProc(d) {
  const status = d.status ? ` Applies ${d.status}.` : '';
  const power = Math.round(d.power * 100) + '% weapon damage';
  switch (d.kind) {
    case 'status': return `Apply ${d.stacks || 1} stack(s) of ${d.status}.`;
    case 'nova': return `${power} in a ${d.radius} unit burst.${status}`;
    case 'chain': return `${d.jumps || 3} jumps within ${d.range || 4} units; ${Math.round((d.falloff || .75)*100)}% damage retained per jump. Never revisits a target.`;
    case 'projectile': return `Launch ${d.count || 1} projectile(s) for ${power} each.${status}`;
    case 'zone': return `${d.delay ? d.delay+'s warning, then ' : ''}${d.duration}s damage zone (${d.radius} unit radius).${status}`;
    case 'trap': return `Arms after ${d.arming || .45}s, lasts ${d.duration}s; triggers a ${power} burst.${status}`;
    case 'source': return `${d.convert ? 'A defeated normal foe returns as an ally. ' : ''}${d.mobile ? 'Mobile ally' : d.healing ? 'Healing totem' : d.decoy ? 'Pulling decoy' : 'Autonomous source'} for ${d.duration}s; maximum 3.${status}`;
    case 'spread': return `Spread ${d.status} to nearby enemies${d.burst ? ' with a damage burst' : ''}.`;
    case 'consume': return `Consume ${d.status} stacks for ${power} per stack.`;
    case 'execute': return `Bonus strike below ${Math.round(d.threshold*100)}% health; reduced against bosses.`;
    case 'heal': return `Restore ${Math.round(d.power*100)}% maximum health.`;
    case 'resource': return `Restore ${d.power}% of class resource meter.`;
    case 'cooldown': return `Reduce active cooldowns by ${d.power}s.`;
    case 'haste': return `Gain ${Math.round(d.power*100)}% attack speed for ${d.duration}s.`;
    case 'pull': return 'Pull nearby normal enemies inward.';
    case 'barrier': return `Absorb ${Math.round(d.power*100)}% maximum health for ${d.duration}s. Total barrier capped at 30%.`;
    case 'orb': return `Drop a collectible ${d.heal ? 'health' : 'resource'} mote.`;
    default: return '';
  }
}
export function gameplayLines(it) {
  const lines=[];
  if(!it?.itemizationVersion)return lines;
  if(it.r)lines.push(ELEMENT_DEFS[it.element]?.name+' attunement');
  for(const e of it.effects||[]) {
    const d=PROC_DEFS[e.id];if(!d)continue;
    lines.push(`${d.name}: ${Math.round((e.chance??d.chance)*100)}% on ${d.event.replace(/([A-Z])/g,' $1').toLowerCase()}${d.every?`, every ${d.every} hits`:''}${d.requires?`, requires ${d.requires}${d.minStacks?' ×'+d.minStacks:''}`:''}${d.cooldown?` (${d.cooldown}s cooldown)`:''}. ${describeProc(d)}`);
  }
  for(const id of it.skillMods||[]) {const d=SKILL_MOD_DEFS[id];if(d)lines.push(d.name+': '+d.text);}
  for(const m of it.modifiers||[]) {const d=AFFIX_DEFS[m.id];if(d)lines.push(`+${m.value}${d.unit} ${d.name} [${m.min}–${m.max}${d.unit}]`);}
  return lines;
}
