import {buildMini} from './minidungeons.js';
const room=(cell,name,extra={})=>({cell,name:'Emberwell — '+name,map:[
 '...............','.t...........t.','...............','..O.........O..','...............',
 '...............','...............','..O.........O..','...............','.t...........t.','...............'],...extra});
export const EMBERWELL={name:'The Emberwell',level:12,exit:'emberwell',music:'dungeon',palette:'forge',dark:true,foes:{a:'imp',b:'porcelain'},
 rooms:{
  entry:room([0,3],'Ash Vestibule'),
  workshop:room([0,2],'The Last Apprentice',{waves:[[['imp',-3,0],['imp',3,0]],[['porcelain',0,-2,'elite']]],title:'THE LAST APPRENTICE'}),
  kiln:room([1,2],'The Cold Kiln'),
  relay:room([1,1],'Three Furnace Voices'),
  cooling:room([0,1],'The Cooling Hall',{torches:'ew.cool',map:[
 '...............','...............','.....T...T.....','..O.........O..','......T.T......','...............','...............','..O.........O..','...............','...............','...............']}),
  antechamber:room([0,0],'Bellwright’s Anvil'),
  heart:room([1,0],'The Kiln Regent'),
  vault:room([2,0],'The Ember Voice'),
 },
 links:[['entry','workshop','open'],['workshop','kiln','shutter',{signal:'emberwell.workshop.clear'}],['kiln','relay','shutter',{signal:'ew.kiln'}],['relay','cooling','shutter',{signal:'ew.relay'}],['cooling','antechamber','shutter',{signal:'ew.cool'}],['antechamber','heart','open'],['heart','vault','shutter',{signal:'ew.boss'}]],
};
export function buildEmberwell(){
 const a=buildMini('emberwell',EMBERWELL);a.mini=false;
 const def=d=>a.defs.push(d);
 def({type:'bellstone',x:4.5,z:48.5,spawn:'entrance',name:'Ash Vestibule'});
 def({type:'sign',x:10.5,z:48.5,text:'THE EMBERWELL · LEVEL 12\nFire wakes the kiln. Wind cools the metal. The Regent opens its furnace mouth before striking.\nRest here before descending.'});
 def({type:'chest',id:'ew-cinder-rod',x:8.5,z:31.5,room:'workshop',big:true,hidden:'emberwell.workshop.clear',contents:{kind:'item',item:'fireRod'}});
 def({type:'emberbrazier',id:'kiln',x:25.5,z:29.5,room:'kiln'});
 def({type:'sign',x:23.5,z:34.5,text:'The kiln is cold. Equip the Cinder Rod with Y; aim at the unlit furnace and press L. Flames cannot pass through stone.'});
 for(let i=0;i<3;i++)def({type:'emberbrazier',id:'relay'+i,x:21.5+i*4,z:16.5,room:'relay',order:i});
 def({type:'sign',x:25.5,z:22.5,text:'THREE FURNACE VOICES\nWake them in order: LEFT, MIDDLE, RIGHT. A wrong voice cools all three. Solved voices stay lit.'});
 def({type:'sign',x:8.5,z:23.5,text:'The metal is too hot. Press Y for Gustbellows. Stand just north of this sign, face north and snuff four fires together with a charged gale.'});
 def({type:'bellstone',x:4.5,z:8.5,spawn:'anvil',name:'Bellwright’s Anvil'});
 def({type:'sign',x:10.5,z:8.5,text:'THE KILN REGENT\nIts shell turns every blow. Aim the Cinder Rod into its open mouth while it vents. The core cracks, then cools again. Dodge marked ground.'});
 def({type:'emberboss',x:25.5,z:6.5,room:'heart'});
 def({type:'emberchime',x:42.5,z:5.5,room:'vault'});
 def({type:'lootchest',id:'ew-vault-loot',x:46.5,z:7.5,tier:2,level:13,room:'vault'});
 def({type:'warp',x:42.5,z:10.5,r:.55,to:'overworld',spawn:'emberwell',label:'Cinderpeak'});
 a.spawns.anvil={x:8.5,z:9.5};return a;
}
