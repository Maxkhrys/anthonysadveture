export const RELICS=[
 {id:'travelantern',base:'bellcharm',name:'Traveler’s Lantern',lvl:2,r:0,text:'Equipment drifts toward you from 2.6 tiles instead of 1.8.'},
 {id:'explorercompass',base:'rabbitfoot',name:'Explorer’s Compass',lvl:5,r:2,text:'Nearby hidden caches appear as pale-blue pins on your map.'},
 {id:'wayfarersatchel',base:'porcelainpendant',name:'Wayfarer’s Satchel',lvl:7,r:3,text:'+2 inventory slots while equipped. Make room before removing it.'},
 {id:'phoenixfeather',base:'emberlocket',name:'Phoenix Feather',lvl:12,r:4,text:'Survive one lethal hit at 40% health per life. Recharges after a normal death.'},
 {id:'worldseed',base:'clapperchain',name:'Worldseed',lvl:16,r:4,prismatic:true,text:'Choose one of three boons in each area. Choice persists; only the current area’s boon applies.'},
];
export const bagCapacity=inv=>30+(Object.values(inv.equip||{}).some(i=>i?.unique==='wayfarersatchel')?2:0);
export const BOONS={might:{name:'Might',text:'+10% damage',stats:{dmgPct:10}},shelter:{name:'Shelter',text:'+15 armour',stats:{armor:15}},haste:{name:'Haste',text:'+8% move speed',stats:{moveSpd:8}}};
