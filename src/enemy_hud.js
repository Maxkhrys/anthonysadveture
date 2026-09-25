import {ELITES,enemyBadges,barLimit,roleOf} from './rpg/combat_readability.js';
export function badgeHTML(e){return enemyBadges(e).slice(0,6).map(b=>`<span title="${b.name}" style="--status:${b.color}">${b.icon}<em>${b.name}</em></span>`).join('');}
export function updateEnemyHud(ui,dt){const g=ui.g;if(!g.player)return;
 ui.bars ||=new Map();ui.barClock=(ui.barClock||0)+dt;
 for(const e of g.entities)if(e.hpShow>0)e.hpShow=Math.max(0,e.hpShow-dt);
 // Content and selection at 10 Hz. Position only is updated each render.
 if(ui.barClock>=.1){ui.barClock=0;
 const live=g.entities.filter(e=>e.isEnemy&&!e.dead&&!(e.spawnT>0)&&!e.hidden&&g.onScreen(e.x,e.z,.2)&&(!g.room||g.roomAt(e.x,e.z)===g.room));
 const active=live.some(e=>e.state!=='idle'&&Math.hypot(e.x-g.player.x,e.z-g.player.z)<9);
 document.documentElement.classList.toggle('combat-active',active);
 const candidates=live.filter(e=>!e.isBoss&&(e.hpShow>0||e.elite||g.hover?.target===e||e.state==='windup'));
 candidates.sort((a,b)=>(g.hover?.target===b?100:0)+(b.elite?10:0)-(g.hover?.target===a?100:0)-(a.elite?10:0)+Math.hypot(a.x-g.player.x,a.z-g.player.z)-Math.hypot(b.x-g.player.x,b.z-g.player.z));
 const shown=new Set(candidates.slice(0,barLimit(g.settings.enemyBars)));
 for(const [e,b]of ui.bars)if(!shown.has(e)){b.remove();ui.bars.delete(e);}
 for(const e of shown){let b=ui.bars.get(e);if(!b){b=document.createElement('div');b.className='enemy-card'+(e.elite?' elite':'');b.innerHTML='<header></header><div class="enemy-track"><i class="enemy-trail"></i><i class="enemy-fill"></i></div><footer></footer>';document.getElementById('floaters').append(b);ui.bars.set(e,b);}
 const mod=ELITES[e.elite],name=g.nameOf(e).replace(/^(the|a|an) /i,'');
 const title=`${mod?mod[0]+' ':''}${name} · ${e.level||1}`;
 if(b.firstChild.textContent!==title)b.firstChild.textContent=title;
 b.title=roleOf(e)+(mod?' · '+mod[3]:'');
 const badges=badgeHTML(e);if(b.lastChild.innerHTML!==badges)b.lastChild.innerHTML=badges;
 const width=Math.max(0,Math.min(100,e.hp/e.maxHp*100))+'%';b.querySelector('.enemy-fill').style.width=width;b.querySelector('.enemy-trail').style.width=width;
 }
 const boss=live.find(e=>e.isBoss);const bar=document.getElementById('boss-bar');let info=bar.querySelector('.boss-detail');if(!info){info=document.createElement('div');info.className='boss-detail';bar.append(info);}
 const text=boss?badgeHTML(boss)+`<b>${Math.ceil(Math.max(0,boss.hp))} / ${Math.ceil(boss.maxHp)}</b>`:'';if(info.innerHTML!==text)info.innerHTML=text;
 }
 const placed=[];
 for(const [e,b]of ui.bars){const s=g.pr.project({x:e.x,y:(e.gy||0)+(e.alt||0)+1.2*(e.eliteScale||1),z:e.z}),width=g.settings.barStyle==='slim'?(e.elite?100:72):(e.elite?168:124),height=g.settings.barStyle==='slim'?28:58;
 let y=s.y,tries=0;const x=Math.max(width/2+8,Math.min(innerWidth-width/2-8,s.x));
 while(placed.some(r=>Math.abs(x-r.x)<(width+r.w)/2+4&&Math.abs(y-r.y)<height+4)&&tries++<4)y-=height+5;
 const visible=tries<=4&&y>130;b.style.visibility=visible?'visible':'hidden';if(visible)placed.push({x,y,w:width});
 b.style.left=x+'px';b.style.top=y+'px';b.style.setProperty('--stem',Math.max(0,s.y-y)+'px');}

}
