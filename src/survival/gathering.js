// Cosmetic feedback only; node work, drops and removal remain owned by ResourceNode.
import {sfx} from '../engine/audio.js';
export function gatherFeedback(node,terminal=false){
 const g=node.g,type=node.type,low=g.settings.combatFx==='minimal',n=low?3:terminal?18:7;
 sfx(terminal?'gatherbreak'+(type==='tree'?'wood':type==='crystal'?'crystal':'stone'):'gather'+type);
 for(let i=0;i<n;i++){const a=node.dir+(i/n-.5)*1.7,s=terminal?2.7:1.5;g.fx.add({x:node.x,y:type==='tree'?.65:.35,z:node.z,vx:Math.sin(a)*s,vz:Math.cos(a)*s,vy:1.5+(i%4)*.4,color:node.D.chips[i%node.D.chips.length],size:terminal?.09:.045,life:terminal?.65:.35,g:8});}
 if(!low&&(type==='rock'||type==='ore'))for(let i=0;i<3;i++)g.fx.add({x:node.x,y:.3,z:node.z,vx:(i-1)*.35,vz:.2,vy:.4,life:.45,size:.18,color:0xaca58e,soft:true,g:0,grow:.1});
 g.survivalUI?.gather(node,terminal);
}
