// Pure presentation/encounter rules, shared by the live HUD and regression tests.
export const ELITES = {
 Swift: ['↗','Swift','#80d8cf','Circles your flank; interrupt its windup.'],
 Brutal: ['◆','Brutal','#ff9477','Heavy attacks; punish its extended recovery.'],
 Vampiric: ['⌁','Bloodbound','#e78da5','Break the red tether by separating the pack.'],
 Armoured: ['▰','Bulwark','#b7ced8','Frontal guard cycles: flank, hit heavy, or wait for OPEN.'],
 Volatile: ['✦','Blazing','#ffc076','Death leaves a marked burst. Leave the circle.'],
 Resonant: ['◎','Resonant','#cfadff','Attacks leave a delayed echo. Move away from the mark.'],
 Oathbound: ['◇','Oathbound','#f0d591','Heavy hits or a parry break the gold links.'],
 Stormtouched: ['ϟ','Storm-touched','#9bddff','Lightning locks onto a spot. Step out before it strikes.'],
 Frostbound: ['❄','Frostbound','#c9f2ff','A slow pulse expands from the foe. Leave the ring.']
};
export const STATUS = {burn:['♨','Burning','#ffc076'],wet:['◈','Wet','#91caff'],chill:['❄','Chilled','#b6eaff'],freeze:['❖','Frozen','#e3f8ff'],shock:['ϟ','Shocked','#ffeb99'],mark:['⌖','Marked','#ff9cad'],hex:['✧','Hexed','#d5b3ff'],root:['♧','Rooted','#b0dd8e']};
export function roleOf(e) { return ({brigand:'Frontline',porcelain:'Frontline',knight:'Heavy',treant:'Heavy',golem:'Heavy',wisp:'Ranged',imp:'Ranged',puffer:'Ranged',moth:'Support',leech:'Control',mantis:'Flanker',scorpion:'Flanker',wraith:'Flanker',blot:'Rushdown'})[e.kind] || 'Skirmisher'; }
export function guardActive(e) { return (e.elite==='Armoured'&&e.bulwarkGuard) || (e.kind==='brigand'&&!['attack','recover'].includes(e.state)&&!(e.stagger>0)) || e.shell>0; }
export function enemyBadges(e) {
 const out=Object.entries(STATUS).filter(([k])=>e.status?.[k]>0).map(([k,[icon,name,color]])=>({key:k,icon,name,color}));
 if(guardActive(e))out.push({key:'guard',icon:'▰',name:'Guard',color:'#bddeed'});
 if(e.stagger>0||e.parried>0||(['recover','stunned','stuck'].includes(e.state)&&(roleOf(e)==='Heavy'||e.isBoss))||(e.elite==='Armoured'&&!e.bulwarkGuard))out.push({key:'open',icon:'◇',name:'Open',color:'#ffe298'});
 if(e.oathT>0||e.litT>0||e.bloodLink?.dead===false)out.push({key:'link',icon:'⌁',name:'Linked',color:'#e8b8cf'});
 return out;
}
export function canThreaten(e,g) {return !e.dead&&!g.cutscene&&!g.dead&&e.spawnT<=0&&e.state!=='idle'&&!(e.stagger>0)&&!(e.status?.freeze>0)&&!(e.status?.root>0)&&g.onScreen(e.x,e.z,.4)&&g.shotClear(e.x,e.z,g.player.x,g.player.z);}
export function barLimit(density) {return density==='off'?0:density==='focused'?4:12;}
export function textAllowed(mode,text,big,small,now,last=0) {if(!/^[+−\-]?\d/.test(text))return true;if(mode==='minimal')return !!big;return mode!=='reduced'||big||(!small&&now-last>=.12);}
