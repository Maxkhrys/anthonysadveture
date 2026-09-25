// Serializable gameplay definitions. No models, renderer or class-specific attack code.
export const ITEMIZATION_VERSION = 1;
export const LIMITS = Object.freeze({ depth: 3, events: 96, queue: 192, effects: 48, targets: 16, projectiles: 64, children: 3, statuses: 128 });
export const ELEMENT_DEFS = {
  physical: { name: 'Physical', color: 0xe4d5b8, status: 'bleed' },
  fire: { name: 'Fire', color: 0xff893e, status: 'burn' },
  frost: { name: 'Frost', color: 0xa8e7ff, status: 'chill' },
  lightning: { name: 'Lightning', color: 0xffe978, status: 'shock' },
  poison: { name: 'Poison', color: 0x8dda64, status: 'poison' },
  spirit: { name: 'Spirit', color: 0xb6a1ef, status: 'curse' },
};
export const STATUS_DEFS = {
  burn: { duration: 4, stacks: 3, dot: .10, element: 'fire' },
  poison: { duration: 6, stacks: 8, dot: .045, element: 'poison' },
  bleed: { duration: 5, stacks: 5, dot: .075, element: 'physical' },
  chill: { duration: 3, stacks: 4, element: 'frost', control: 'chill' },
  freeze: { duration: 1.4, stacks: 1, element: 'frost', control: 'freeze' },
  shock: { duration: 4, stacks: 3, vulnerable: .06, element: 'lightning' },
  curse: { duration: 5, stacks: 1, vulnerable: .15, element: 'spirit' },
  doom: { duration: 4, stacks: 1, expire: 1.6, element: 'spirit' },
  root: { duration: 2, stacks: 1, control: 'root', element: 'physical' },
  stun: { duration: .6, stacks: 1, control: 'freeze', element: 'lightning' },
};
export const COMBAT_EVENTS = Object.freeze(['hit','crit','kill','eliteKill','bossHit','dodge','dash','cast','abilityUse','projectileImpact','statusApply','statusExpire','takingDamage','lowHealth','heal','resourceSpend','maxResource','enterCombat']);
export const AFFIX_DEFS = {};
function stat(id, name, lo, hi, opts = {}) { AFFIX_DEFS[id] = { id, name, range: [lo,hi], unit: '%', ...opts }; }
for (const el of Object.keys(ELEMENT_DEFS)) stat(el+'Damage', ELEMENT_DEFS[el].name+' Damage',18,32,{element:el});
for (const [id,name,lo,hi] of [
  ['weaponDamage','Weapon Damage',10,22],['spellDamage','Spell Damage',15,30],['elementalDamage','Elemental Damage',10,22],
  ['attackSpeed','Attack Speed',8,18],['castSpeed','Cast Speed',10,20],['criticalChance','Critical Chance',6,14],['criticalDamage','Critical Damage',20,45],
  ['projectileSpeed','Projectile Speed',15,35],['areaSize','Area Size',15,30],['statusChance','Status Chance',10,22],['statusDuration','Status Duration',20,45],
  ['cooldownReduction','Cooldown Reduction',5,12],['movementSpeed','Movement Speed',5,12],['lifeSteal','Life Steal',1,3],
  ['resourceGeneration','Resource Generation',15,30],['resourceCostReduction','Resource Cost Reduction',8,18],
  ['summonDamage','Summon Damage',20,40],['summonDuration','Summon Duration',20,40],['trapDamage','Trap Damage',20,40],['turretDamage','Turret Damage',20,40],['abilityDamage','Ability Damage',15,30],
  ['movingGuard','Damage Reduction While Moving',8,16],['fullGuard','Damage Reduction at Maximum Resource',10,20],['surroundedGuard','Damage Reduction While Surrounded',8,18],['dodgeChance','Dodge Chance',4,9],
]) stat(id,name,lo,hi);
for (const [id,name,lo,hi] of [['projectileCount','Additional Projectiles',1,2],['pierce','Projectile Pierce',1,2],['bounce','Projectile Ricochets',1,2],['lifeOnKill','Life on Kill',2,6]]) stat(id,name,lo,hi,{unit:'',integer:true});
const P = {};
function effect(id, name, event, kind, element, more={}) { P[id] = { id,name,event,kind,element,chance:.22,cooldown:.65,power:.7,radius:2,duration:4,...more }; }
// Every entry below is executable by a shared handler; no cosmetic-only powers.
for (const el of Object.keys(ELEMENT_DEFS)) {
  effect(el+'_touch', ELEMENT_DEFS[el].name+' Touch','hit','status',el,{status:ELEMENT_DEFS[el].status,chance:.35,cooldown:0});
  effect(el+'_nova', ELEMENT_DEFS[el].name+' Nova','crit','nova',el,{chance:.4,cooldown:2,power:.8});
  effect(el+'_death', ELEMENT_DEFS[el].name+' Death Burst','kill','nova',el,{chance:1,cooldown:0,power:.6,requires:ELEMENT_DEFS[el].status});
}
effect('fireball','Ember Cast','hit','projectile','fire',{count:1,status:'burn'});
effect('multi_fireball','Three Embers','crit','projectile','fire',{count:3,cooldown:2,power:.45,status:'burn'});
effect('firewall','Firewall','cast','zone','fire',{shape:'line',radius:3,status:'burn',chance:1,cooldown:4});
effect('fire_pool','Fire Pool','projectileImpact','zone','fire',{status:'burn',cooldown:3});
effect('meteor','Meteor','crit','zone','fire',{delay:1.1,duration:.6,tick:.6,power:2.5,radius:2.6,chance:.35,cooldown:4});
effect('flame_trail','Flame Trail','dash','zone','fire',{chance:1,status:'burn',cooldown:1});
effect('burn_spread','Spreading Flame','kill','spread','fire',{requires:'burn',status:'burn',chance:1,cooldown:0});
effect('living_flame','Living Flame','kill','projectile','fire',{requires:'burn',homing:5,chance:1,status:'burn',cooldown:.3});
effect('chain_lightning','Chain Lightning','hit','chain','lightning',{jumps:3,range:4,falloff:.72});
effect('crit_chain','Critical Conductor','crit','chain','lightning',{jumps:4,range:4,falloff:.8,chance:.6});
effect('thunderstrike','Thunderstrike','hit','nova','lightning',{every:5,chance:1,power:1.5,radius:1.5,cooldown:0});
effect('static_field','Static Dash','dash','zone','lightning',{chance:1,status:'shock'});
effect('lightning_orb','Lightning Orb','cast','source','lightning',{mobile:true,chance:1,cooldown:6});
effect('overcharge','Overcharge','hit','nova','lightning',{requiresElement:'lightning',every:6,chance:1,power:1.8,cooldown:0});
effect('lightning_totem','Lightning Totem','cast','source','lightning',{chance:1,cooldown:8,duration:7});
effect('forked_bolt','Forked Bolt','projectileImpact','projectile','lightning',{count:2,origin:'target',chance:1,power:.4});
effect('ice_spears','Ice Spears','crit','projectile','frost',{count:3,pierce:2,status:'chill',chance:.6});
effect('freeze_touch','Freezing Touch','hit','status','frost',{status:'freeze',chance:.16,cooldown:2});
effect('frozen_ground','Frozen Footsteps','dash','zone','frost',{chance:1,status:'chill'});
effect('blizzard','Blizzard','cast','zone','frost',{chance:1,status:'chill',radius:3,cooldown:6,duration:5,power:.4});
effect('ice_clone','Ice Clone','dodge','source','frost',{chance:1,decoy:true,duration:5,cooldown:6,status:'chill'});
effect('shatter','Shatter','kill','nova','frost',{requires:'freeze',chance:1,cooldown:0,power:1.5,radius:2.8});
effect('piercing_icicle','Piercing Icicle','hit','projectile','frost',{pierce:4,status:'chill'});
effect('poison_cloud','Poison Cloud','kill','zone','poison',{chance:1,status:'poison',power:.25,cooldown:1});
effect('venom_burst','Venom Burst','crit','consume','poison',{status:'poison',chance:1,power:.35});
effect('toxic_spread','Toxic Spread','statusExpire','spread','poison',{onlyStatus:'poison',status:'poison',chance:1});
effect('poison_projectile','Venom Dart','hit','projectile','poison',{status:'poison'});
effect('acid_pool','Acid Pool','projectileImpact','zone','poison',{status:'poison',cooldown:3});
effect('contagion','Contagion','kill','spread','poison',{requires:'poison',status:'poison',chance:1,cooldown:0,burst:true});
effect('plague_conversion','Plague Conversion','kill','source','poison',{requires:'poison',minStacks:5,convert:true,mobile:true,chance:1,duration:8,cooldown:2});
effect('poison_plant','Poison Plant','cast','source','poison',{chance:1,status:'poison',duration:8,cooldown:8});
effect('hemorrhage','Hemorrhage','crit','consume','physical',{status:'bleed',chance:1,power:.55});
effect('cleave','Cleave','hit','nova','physical',{radius:1.5,power:.4,cooldown:1});
effect('shockwave','Shockwave','cast','projectile','physical',{chance:1,pierce:5,count:3,cooldown:2});
effect('execute','Executioner','hit','execute','physical',{chance:1,threshold:.18,power:1.4,cooldown:2});
effect('impale','Impale','crit','status','physical',{status:'bleed',stacks:3,chance:1});
effect('brutality','Brutality','hit','consume','physical',{status:'bleed',minStacks:5,chance:1,power:.8,cooldown:2});
effect('splinter','Splinter','kill','projectile','physical',{chance:1,count:3,origin:'target',pierce:1});
effect('shadow_bolt','Shadow Bolt','hit','projectile','spirit',{status:'curse'});
effect('soul_drain','Soul Drain','hit','heal','spirit',{chance:.25,power:.025});
effect('shadow_clone','Mirror Ally','crit','source','spirit',{mobile:true,cooldown:8,duration:6});
effect('doom_mark','Doom Mark','crit','status','spirit',{status:'doom',chance:.5});
effect('dark_rift','Spirit Rift','cast','zone','spirit',{chance:1,pull:true,status:'curse',radius:3,cooldown:6});
effect('shadow_execution','Shadow Execution','hit','execute','spirit',{requires:'curse',chance:1,threshold:.22,cooldown:2,power:1.6});
effect('soul_harvest','Soul Harvest','kill','resource','spirit',{chance:1,power:8,cooldown:.5});
effect('stun_touch','Stunning Impact','hit','status','lightning',{status:'stun',chance:.15,cooldown:3});
effect('cooldown_crit','Second Wind','crit','cooldown','spirit',{chance:.4,power:.4,cooldown:1});
effect('resource_crit','Critical Focus','crit','resource','spirit',{chance:1,power:4,cooldown:.5});
effect('frenzy_crit','Critical Frenzy','crit','haste','physical',{chance:1,power:.2,duration:3,cooldown:2});
effect('pull_touch','Gravitic Pull','hit','pull','spirit',{chance:.25,radius:3,power:5});
effect('spirit_ally','Companion Echo','hit','source','spirit',{mobile:true,duration:6,cooldown:8});
effect('corpse_explosion','Corpse Burst','kill','nova','physical',{chance:1,cooldown:0,power:.8});
effect('chain_death','Last Spark','kill','chain','lightning',{chance:1,jumps:3,falloff:.75,cooldown:.2});
effect('health_orb','Mending Mote','kill','orb','spirit',{chance:.5,heal:true,power:.06,cooldown:1});
effect('resource_orb','Focus Mote','kill','orb','spirit',{chance:.5,power:12,cooldown:1});
effect('parasite','Little Symbiote','kill','source','poison',{mobile:true,chance:.4,cooldown:4,duration:5});
effect('kill_turret','Afterlife Sentry','kill','source','spirit',{chance:.4,duration:5,cooldown:4});
effect('kill_trap','Last Thorn','kill','trap','physical',{chance:1,status:'bleed',cooldown:1});
effect('barrier_kill','Victory Barrier','kill','barrier','spirit',{chance:1,power:.08,duration:4,cooldown:2});
effect('shield_dodge','Dodge Ward','dodge','barrier','spirit',{chance:1,power:.15,duration:3,cooldown:2});
effect('emergency_ward','Emergency Ward','lowHealth','barrier','spirit',{chance:1,power:.25,duration:4,cooldown:15});
export const TRAP_DEFS = {};
for (const [id,el,status,pull] of [['spike','physical','bleed'],['fire','fire','burn'],['frost','frost','freeze'],['poison','poison','poison'],['lightning','lightning','shock'],['shadow','spirit','curse'],['root','physical','root'],['gravity','spirit','chill',true],['spirit','spirit','curse'],['chain','spirit','root']]) {
  TRAP_DEFS[id] = {element:el,status,pull,arming:.45,duration:8,radius:2,power:1.1};
  effect(id+'_mine',id[0].toUpperCase()+id.slice(1)+' Trap','dash','trap',el,{...TRAP_DEFS[id],chance:1,cooldown:2});
}
export const SOURCE_DEFS = {};
for(const [id,el,opts] of [['arrow_turret','physical',{}],['fire_turret','fire',{status:'burn'}],['frost_totem','frost',{status:'chill'}],['spirit_guardian','spirit',{mobile:true}],['floating_orb','lightning',{mobile:true}],['mirror_clone','spirit',{mobile:true}],['bomb_familiar','fire',{mobile:true,bomb:true}],['healing_totem','spirit',{healing:true}],['decoy','frost',{decoy:true}],['spectral_warrior','spirit',{mobile:true}]]) {
  SOURCE_DEFS[id]={element:el,duration:7,range:7,rate:1,power:.5,...opts};
  effect(id,id.replaceAll('_',' '),'cast','source',el,{...SOURCE_DEFS[id],chance:1,cooldown:8});
}
export const ZONE_DEFS = {};
for(const [id,el,opts] of [['gravity_well','spirit',{pull:true}],['tornado','physical',{pull:true}],['blade_storm','physical',{status:'bleed'}],['lightning_storm','lightning',{status:'shock'}],['curse_zone','spirit',{status:'curse'}],['slow_field','frost',{status:'chill'}]]) {
  ZONE_DEFS[id]={element:el,duration:4,radius:3,power:.35,...opts};
  effect(id,id.replaceAll('_',' '),'cast','zone',el,{...ZONE_DEFS[id],chance:1,cooldown:6});
}
export const PROC_DEFS = Object.freeze(P);
export const SKILL_MOD_DEFS = {
  fan: {name:'Scattercast',text:'Basic projectiles fire two extra shots; all three deal 60% damage.',projectileCount:2,shotPower:.6},
  piercer: {name:'Lancing',text:'Projectiles pierce two additional enemies.',pierce:2},
  ricochet: {name:'Ricochet',text:'Projectiles ricochet twice to nearby unseen targets.',bounce:2},
  homing: {name:'Seeking',text:'Projectiles bend toward nearby enemies.',homing:2.5},
  fork: {name:'Forking',text:'Projectile impacts fork into two half-power shots once.',fork:2},
  split_death: {name:'Death Scatter',text:'Killing projectiles split into three half-power shots once.',splitDeath:3},
  returning: {name:'Returning',text:'Projectiles return once, allowing a second hit.',returning:true},
  acceleration: {name:'Accelerating',text:'Projectiles accelerate by 8 units/s².',acceleration:8},
  blast: {name:'Explosive',text:'Projectile impacts deal a 40% damage burst nearby.',explosive:.4},
  ground: {name:'Lingering',text:'Projectile impacts leave damaging elemental ground (1s cooldown).',ground:true},
  third: {name:'Third Chime',text:'Every third basic projectile volley deals 75% more damage.',third:1.75},
  critical_fork: {name:'Critical Fork',text:'Critical projectile impacts fork once.',criticalFork:2},
  close: {name:'Point Blank',text:'Projectile damage increases 30% within 3 units.',close:.3},
  distant: {name:'Far Sight',text:'Projectile damage increases 40% beyond 6 units.',distant:.4},
  living: {name:'Relentless',text:'Killing projectiles seek another target once.',living:true},
  echo_cast: {name:'Echo Cast',text:'Casting releases a spectral ally for 5 seconds (8s cooldown).',proc:'spirit_guardian'},
};
export const LEGENDARY_DEFS = {
  cinder_heart:{name:'Cinderheart Covenant',element:'fire',effects:['fire_touch','fire_death','flame_trail'],skillMods:['ground']},
  storm_choir:{name:'Storm Choir',element:'lightning',effects:['lightning_touch','chain_lightning','thunderstrike'],skillMods:['ricochet']},
  winter_oath:{name:'Winter Oath',element:'frost',effects:['frost_touch','freeze_touch','shatter'],skillMods:['piercer']},
  plague_garden:{name:'Plague Garden',element:'poison',effects:['poison_touch','contagion','plague_conversion'],skillMods:['homing']},
  red_requiem:{name:'Red Requiem',element:'physical',effects:['physical_touch','impale','hemorrhage'],skillMods:['echo_cast']},
  kindred_lantern:{name:'Kindred Lantern',element:'spirit',effects:['spirit_touch','spirit_ally','soul_harvest'],skillMods:['echo_cast']},
};
export const PRISMATIC_DEFS = {
  ember_orbit:{name:'The Walking Inferno',element:'fire',effects:['fire_touch','fire_death','living_flame','flame_trail'],skillMods:['fan','ground']},
  endless_storm:{name:'The Endless Storm',element:'lightning',effects:['lightning_touch','overcharge','chain_death','lightning_totem'],skillMods:['fork','third']},
  mirror_winter:{name:'Winter in Every Mirror',element:'frost',effects:['frost_touch','freeze_touch','shatter','ice_clone'],skillMods:['returning','piercer']},
  world_garden:{name:'A Garden of Second Lives',element:'poison',effects:['poison_touch','contagion','plague_conversion','poison_plant'],skillMods:['split_death','homing']},
  blood_moon:{name:'The Unbroken Refrain',element:'physical',effects:['physical_touch','impale','hemorrhage','barrier_kill'],skillMods:['echo_cast','third']},
  shared_dawn:{name:'We Meet Again at Dawn',element:'spirit',effects:['spirit_touch','spirit_ally','soul_harvest','shield_dodge'],skillMods:['echo_cast','returning']},
};
