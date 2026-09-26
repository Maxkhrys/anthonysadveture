// Lanternreach's field atlas. Camera, labels and pins share one world transform.
import { REGIONS, HEART } from './world/layout.js';
import { drawDevOverlay } from './dev/pass6.js';
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const INK='#463824', PAPER='#ddc99a';

// Greedy label placement with a fixed gutter. Suppressed labels remain in the place index.
export function placeLabels(ctx, labels, W, H, occupied=[]) {
 const boxes=[...occupied],out=[];
 for(const l of labels){
  const w=ctx.measureText(l.text).width+12,h=l.region?24:20;
  for(const [dx,dy] of [[10,-h/2],[-w-10,-h/2],[-w/2,12],[-w/2,-h-12]]){
   const box={x:l.px+dx,y:l.py+dy,w,h};
   if(box.x<10||box.y<10||box.x+w>W-10||box.y+h>H-10||boxes.some(b=>overlaps({...box,x:box.x-4,y:box.y-3,w:w+8,h:h+6},b)))continue;
   boxes.push(box);out.push({...l,...box});break;
  }
 }
 return out;
}
function arrow(ctx,x,y,facing,size=8){
 ctx.save();ctx.translate(x,y);ctx.rotate(-facing+Math.PI);ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.7,size*.7);ctx.lineTo(0,size*.35);ctx.lineTo(-size*.7,size*.7);ctx.closePath();ctx.fillStyle='#ac3d2d';ctx.strokeStyle='#fff5d9';ctx.lineWidth=2.5;ctx.fill();ctx.stroke();ctx.restore();
}
function pin(ctx,p,x,y,size=5){
 ctx.save();ctx.translate(x,y);ctx.fillStyle=p.color||'#705334';ctx.strokeStyle='#fff1cd';ctx.lineWidth=2;
 ctx.beginPath();if(p.kind==='bell'){ctx.moveTo(0,-size-2);ctx.lineTo(size+1,0);ctx.lineTo(0,size+2);ctx.lineTo(-size-1,0);ctx.closePath();}
 else if(p.kind==='service')ctx.rect(-size,-size,size*2,size*2);
 else {ctx.arc(0,0,size,0,Math.PI*2);}
 ctx.fill();ctx.stroke();if(p.priority===0){ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.strokeRect(-size-3,-size-3,size*2+6,size*2+6);}ctx.restore();
}
export function installAtlasUI(UI){
 const P=UI.prototype;
 P.ensureAtlas=function(){
  if($('atlas-tools'))return;
  const cv=$('bigmap');cv.tabIndex=0;cv.setAttribute('role','img');cv.setAttribute('aria-label','Interactive world map. Drag to pan; plus and minus to zoom; Home to find your character.');
  const host=$('tab-map');
  cv.remove();host.innerHTML=`<header id="atlas-heading"><h2>Lanternreach atlas</h2><span id="atlas-location"></span></header><div id="atlas-tools"><label>Region <select id="atlas-region" aria-label="Map region"></select></label><div class="atlas-camera"><button data-map="out" aria-label="Zoom out">−</button><output id="atlas-zoom"></output><button data-map="in" aria-label="Zoom in">+</button><button data-map="local">Find me</button><button data-map="world">World</button></div></div><div id="atlas-layout"><div id="atlas-surface"></div><aside id="atlas-index"><h3>Places on your map</h3><div id="atlas-places"></div></aside></div><footer id="map-legend"><span>▲ You</span><span>◇ Bellstone</span><span>■ Village service</span><span>● Landmark / quest</span><label><input id="atlas-borders" type="checkbox" checked> Region borders</label></footer><p id="atlas-help">Drag to pan · Scroll or + / − to zoom · Select a place to focus · Unexplored land stays covered</p>`;
  $('atlas-surface').append(cv);
  host.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{const v=this.atlasView;switch(b.dataset.map){case'in':this.atlasZoom(1.4);break;case'out':this.atlasZoom(1/1.4);break;case'local':this.atlasFocus(this.g.player.x,this.g.player.z,6);break;case'world':v.scale=this.atlasFit;v.cx=this.g.area.w/2;v.cz=this.g.area.h/2;this.drawBigMap();break;}});
  $('atlas-region').onchange=()=>{const r=this.atlasRegions?.find(r=>r.id===$('atlas-region').value);if(r)this.atlasFocus((r.x0+r.x1)/2,(r.z0+r.z1)/2,Math.min((this.atlasW-50)/(r.x1-r.x0),(this.atlasH-50)/(r.z1-r.z0)));else if($('atlas-region').value==='local')this.atlasFocus(this.g.player.x,this.g.player.z,6);else host.querySelector('[data-map="world"]').click();};
  $('atlas-borders').onchange=()=>this.drawBigMap();
  const point=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const pointers=new Map();let drag=null;
  cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();cv.focus();cv.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));drag=point(e);});
  cv.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const before=[...pointers.values()],now=point(e);pointers.set(e.pointerId,now);const after=[...pointers.values()];
   if(after.length===2){const d=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(d(before)>2)this.atlasZoom(d(after)/d(before),(after[0].x+after[1].x)/2,(after[0].y+after[1].y)/2);}
   else if(drag){this.atlasView.cx-=(now.x-drag.x)/this.atlasView.scale;this.atlasView.cz-=(now.y-drag.y)/this.atlasView.scale;this.drawBigMap();}drag=now;});
  const end=e=>{pointers.delete(e.pointerId);drag=pointers.size?[...pointers.values()][0]:null;};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);this.atlasZoom(Math.exp(-clamp(e.deltaY,-180,180)*.004),p.x,p.y);},{passive:false});
  cv.addEventListener('keydown',e=>{if(!['+','=','-','Home','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(['+','=','-'].includes(e.key))this.atlasZoom(e.key==='-'?1/1.4:1.4);else if(e.key==='Home')this.atlasFocus(this.g.player.x,this.g.player.z,6);else{const v=this.atlasView;v.cx+=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*50/v.scale;v.cz+=(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)*50/v.scale;this.drawBigMap();}});
  // Redraw at the actual display size, including phone rotation and resized windows.
  new ResizeObserver(()=>{if(this.g.area&&!host.classList.contains('hidden'))this.drawBigMap();}).observe($('atlas-surface'));
 };
 P.atlasFocus=function(cx,cz,scale){Object.assign(this.atlasView,{cx,cz,scale});this.drawBigMap();};
 P.atlasZoom=function(factor,x=this.atlasW/2,y=this.atlasH/2){const v=this.atlasView,old=v.scale,next=clamp(old*factor,this.atlasFit,18);v.cx+=(x-this.atlasW/2)*(1/old-1/next);v.cz+=(y-this.atlasH/2)*(1/old-1/next);v.scale=next;this.drawBigMap();};
 P.atlasBuildRegions=function(){
  const a=this.g.area;this.atlasRegionArea=a;this.atlasRegions=[];if(!a.regionIdx)return;
  const groups=new Map(Object.entries(REGIONS).map(([id,r])=>[id,{id,name:r.name,x0:a.w,z0:a.h,x1:0,z1:0,path:new Path2D(),sx:0,sz:0,n:0}]));
  const idAt=(x,z)=>a.places[a.regionIdx[z*a.w+x]]?.id;
  for(let z=0;z<a.h;z++)for(let x=0;x<a.w;x++){
   const id=idAt(x,z),r=groups.get(id);if(!r)continue;r.x0=Math.min(r.x0,x);r.x1=Math.max(r.x1,x+1);r.z0=Math.min(r.z0,z);r.z1=Math.max(r.z1,z+1);r.sx+=x;r.sz+=z;r.n++;
   if(x===0||idAt(x-1,z)!==id){r.path.moveTo(x,z);r.path.lineTo(x,z+1);}if(z===0||idAt(x,z-1)!==id){r.path.moveTo(x,z);r.path.lineTo(x+1,z);}if(x===a.w-1){r.path.moveTo(x+1,z);r.path.lineTo(x+1,z+1);}if(z===a.h-1){r.path.moveTo(x,z+1);r.path.lineTo(x+1,z+1);}
  }this.atlasRegions=[...groups.values()].filter(r=>r.n);
  const heart=groups.get('heartland');if(heart)Object.assign(heart,{x0:HEART.x,z0:HEART.z,x1:HEART.x+HEART.w,z1:HEART.z+HEART.h});
 };
 P.atlasKnown=function(x,z){const a=this.g.area,D=this.g.world6?.discovery;if(a.id!=='overworld'||!D)return true;const k=Math.floor(z/8)*Math.ceil(a.w/8)+Math.floor(x/8);return!!(parseInt(D.fog[k>>2]||'0',16)&(1<<(k&3)));};
 P.atlasPoints=function(){
  const g=this.g,a=g.area,D=g.world6?.discovery,out=[];
  if(a.dungeon){
   for(const r of a.rooms||[])if((g.flags['visited:'+a.id+':'+r.id]||g.room===r)&&r.def?.boss)out.push({x:(r.x0+r.x1)/2,z:(r.z0+r.z1)/2,name:'Boss chamber',kind:'quest',color:'#a94330',priority:0});
   for(const e of g.entities)if(e.constructor.name==='Chest'&&e.visible&&!e.opened&&(g.flags['visited:'+a.id+':'+g.roomAt(e.x,e.z)?.id]||g.room===g.roomAt(e.x,e.z)))out.push({x:e.x,z:e.z,name:'Treasure chest',kind:'service',color:'#b28a2f',priority:1});return out;
  }
  for(const m of g.story.markers()){const near=[...(a.landmarks||[]),...a.defs.filter(d=>d.type==='npc')].filter(d=>Math.hypot(d.x-m.x,d.z-m.z)<6).sort((a,b)=>Math.hypot(a.x-m.x,a.z-m.z)-Math.hypot(b.x-m.x,b.z-m.z))[0];out.push({...m,name:m.name||near?.name||(m.pulse?'Current objective':'Story destination'),kind:'quest',priority:m.pulse?0:3});}
  for(const l of g.story.labels().filter(l=>!l.region))out.push({x:l.x,z:l.z-3,name:l.t,kind:'landmark',color:'#684e33',priority:4});
  for(const d of a.defs){
   if(d.type==='bellstone'&&(this.atlasKnown(d.x,d.z)||g.unlockedBellstones().some(b=>b.area===a.id&&b.spawn===d.spawn)))out.push({...d,name:(d.name||g.bellstoneName(a.id+':'+d.spawn))+' Bellstone',kind:'bell',color:'#c39937',priority:1});
   if(this.atlasKnown(d.x,d.z)&&((d.type==='npc'&&['posy','brisk','tamsin'].includes(d.id))||d.type==='workbench'||d.type==='welcomeChest'))out.push({...d,name:d.name||(d.type==='workbench'?'Crafting bench':'Welcome supplies'),kind:'service',color:'#4b6349',priority:2});
  }
  const seen=new Set();return out.sort((a,b)=>a.priority-b.priority).filter(p=>{const k=p.name;if(seen.has(k))return false;seen.add(k);return true;});
 };
 P.fogCanvas=function(){
  const a=this.g.area,D=this.g.world6?.discovery;if(!D)return null;
  if(this.atlasFogArea===a&&this.fogKey===D.fog&&this.fogC)return this.fogC;
  this.atlasFogArea=a;this.fogKey=D.fog;const c=this.fogC||document.createElement('canvas');c.width=a.w*4;c.height=a.h*4;const x=c.getContext('2d');x.fillStyle='#ddc99ac9';
  for(let z=0;z<a.h;z+=8)for(let xx=0;xx<a.w;xx+=8)if(!this.atlasKnown(xx,z))x.fillRect(xx*4,z*4,32,32);
  this.fogC=c;return c;
 };
 P.drawBigMap=function(){
  const g=this.g,a=g.area;if(!a||!g.player)return;this.ensureAtlas();
  const cv=$('bigmap'),surface=$('atlas-surface'),W=Math.max(200,surface.clientWidth),H=Math.max(200,surface.clientHeight),dpr=Math.min(2,devicePixelRatio||1);
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}this.atlasW=W;this.atlasH=H;
  const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle=PAPER;x.fillRect(0,0,W,H);x.imageSmoothingEnabled=false;
  this.atlasFit=Math.min((W-32)/a.w,(H-32)/a.h);
  if(this.atlasArea!==a||this.atlasProfile!==g.profile?.id){this.atlasArea=a;this.atlasProfile=g.profile?.id;this.atlasView={cx:g.player.x,cz:g.player.z,scale:a.dungeon?this.atlasFit:6};}
  const v=this.atlasView;v.scale=clamp(v.scale,this.atlasFit,18);const sc=v.scale;
  const bound=(c,total,span)=>span>=total?total/2:clamp(c,span/2,total-span/2);
  v.cx=bound(v.cx,a.w,W/sc);v.cz=bound(v.cz,a.h,H/sc);
  const ox=W/2-v.cx*sc,oz=H/2-v.cz*sc;this.atlasTransform={sc,ox,oz};const tr=(xx,z)=>[ox+xx*sc,oz+z*sc];
  if(this.miniArea!==a||g.tilesDirty){this.buildMapCanvas();this.illusArea=null;g.tilesDirty=false;}
  if(!a.dungeon&&this.illusArea!==a)this.buildIllustrated();
  x.save();x.translate(ox,oz);x.scale(sc,sc);
  if(a.dungeon){
   x.fillStyle='#6c6654';x.fillRect(0,0,a.w,a.h);
   for(const r of a.rooms||[])if(g.flags['visited:'+a.id+':'+r.id]||g.room===r)x.drawImage(this.miniCache,r.x0,r.z0,r.x1-r.x0,r.z1-r.z0,r.x0,r.z0,r.x1-r.x0,r.z1-r.z0);
  }else{
   x.drawImage(this.illus,0,0,a.w,a.h);
   if(a.id==='overworld'&&!g.devMapOverlay){const fog=this.fogCanvas();if(fog)x.drawImage(fog,0,0,a.w,a.h);}
   if(this.atlasRegionArea!==a)this.atlasBuildRegions();
   if($('atlas-borders').checked){x.strokeStyle='#786546';x.lineWidth=1/sc;x.setLineDash([4/sc,3/sc]);for(const r of this.atlasRegions)x.stroke(r.path);x.setLineDash([]);}
   if(g.devMapOverlay&&a.id==='overworld')drawDevOverlay(g,x,1);
  }x.restore();
  if(this.atlasRegionArea!==a)this.atlasBuildRegions();
  const points=this.atlasPoints(),labels=[],occupied=[],[px,py]=tr(g.player.x,g.player.z);occupied.push({x:px-12,y:py-12,w:24,h:24});
  for(const p of points){const [xx,z]=tr(p.x,p.z);if(xx<8||xx>W-8||z<8||z>H-8)continue;if(sc<3&&p.priority>1)continue;pin(x,p,xx,z);occupied.push({x:xx-6,y:z-6,w:12,h:12});if(sc>=3)labels.push({text:p.name,px:xx,py:z,region:false});}
  const discovered=g.world6?.discovery?.regions||[];
  if(sc<3)for(const r of this.atlasRegions||[]){const [xx,z]=tr(r.sx/r.n,r.sz/r.n);labels.push({text:discovered.includes(r.id)?r.name:'Uncharted',px:xx,py:z,region:true});}
  x.font=sc<3?'bold 15px Mossling, monospace':'12px Mossling, monospace';
  this.atlasLabelBoxes=placeLabels(x,labels,W,H,occupied);
  for(const l of this.atlasLabelBoxes){x.fillStyle='#f1e2bddf';x.fillRect(l.x,l.y,l.w,l.h);x.fillStyle=INK;x.textBaseline='middle';x.fillText(l.text,l.x+6,l.y+l.h/2);}
  arrow(x,px,py,g.player.facing);
  // Compass and measured scale are fixed to the paper, not the world camera.
  x.fillStyle=INK;x.font='bold 13px Mossling';x.textAlign='center';x.fillText('N',W-22,20);x.beginPath();x.moveTo(W-22,28);x.lineTo(W-26,36);x.lineTo(W-18,36);x.closePath();x.fill();x.textAlign='left';
  const units=sc<2?50:sc<5?20:10,len=units*sc;x.strokeStyle=INK;x.lineWidth=2;x.beginPath();x.moveTo(14,H-20);x.lineTo(14+len,H-20);x.stroke();x.font='10px Tahoma';x.fillText(units+' tiles',14,H-31);
  $('atlas-zoom').textContent=Math.round(sc/this.atlasFit*100)+'%';$('atlas-location').textContent=a.placeAt?.(g.player.x,g.player.z)?.name||a.name;
  $('atlas-heading').querySelector('h2').textContent=a.dungeon?a.name+' map':'Lanternreach atlas';
  const regionKey=a.id+':'+discovered.join(',');if(this.atlasOptions!==regionKey){this.atlasOptions=regionKey;$('atlas-region').innerHTML='<option value="local">Around you</option><option value="world">Whole map</option>'+ (this.atlasRegions||[]).filter(r=>discovered.includes(r.id)).map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');}
  const region=a.placeAt?.(v.cx,v.cz)?.id;$('atlas-region').value=sc<=this.atlasFit*1.01?'world':region&&discovered.includes(region)?region:'local';
  const visible=points.filter(p=>Math.abs(p.x-v.cx)<W/sc/2&&Math.abs(p.z-v.cz)<H/sc/2);
  const key=a.id+':'+visible.map(p=>p.name+p.x+p.z).join('|');if(this.atlasIndexKey!==key){this.atlasIndexKey=key;$('atlas-places').innerHTML=visible.length?visible.map((p,i)=>`<button data-place="${i}"><span>${p.kind==='bell'?'◇':p.kind==='service'?'■':'●'}</span>${esc(p.name)}</button>`).join(''):'<p>No recorded places here. Explore to uncover this part of the map.</p>'; $('atlas-places').querySelectorAll('button').forEach(b=>b.onclick=()=>{const p=visible[+b.dataset.place];this.atlasFocus(p.x,p.z,Math.max(8,this.atlasView.scale));this.onAtlasPick&&this.onAtlasPick(p);});}
  $('atlas-help').textContent=a.dungeon?'Drag to pan · Scroll or + / − to zoom · Only visited rooms are charted':'Drag to pan · Scroll or + / − to zoom · Select a place to focus · Unexplored land stays covered';
 };
 const updatePause=P.updatePause;
 P.updatePause=function(input){if(this.curTab==='map'&&document.activeElement===$('bigmap'))return;updatePause.call(this,input);};
 P.drawMini=function(){
  const g=this.g,a=g.area,p=g.player;if(!a||!p)return;
  const cv=$('minimap');if(!this.miniControls){this.miniControls=true;cv.tabIndex=0;cv.setAttribute('role','button');cv.setAttribute('aria-label','Open detailed map');cv.onclick=()=>this.navigate('map');cv.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();this.navigate('map');}};const b=document.createElement('button');b.id='mini-zoom';b.setAttribute('aria-label','Change minimap zoom');b.textContent='+';b.onclick=()=>{this.miniZoom=((this.miniZoom||0)+1)%3;b.textContent=['+','++','−'][this.miniZoom];this.drawMini();};$('hud').append(b);}
  const W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;const dpr=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle='#d4c298';x.fillRect(0,0,W,H);x.imageSmoothingEnabled=false;
  if(this.miniArea!==a||g.tilesDirty){this.buildMapCanvas();this.illusArea=null;g.tilesDirty=false;}
  const sc=[3,4.5,2][this.miniZoom||0],ox=W/2-p.x*sc,oz=H/2-p.z*sc;
  x.save();x.translate(ox,oz);x.scale(sc,sc);
  if(a.dungeon){for(const r of a.rooms||[])if(g.flags['visited:'+a.id+':'+r.id]||g.room===r)x.drawImage(this.miniCache,r.x0,r.z0,r.x1-r.x0,r.z1-r.z0,r.x0,r.z0,r.x1-r.x0,r.z1-r.z0);}
  else {x.drawImage(this.miniCache,0,0);if(a.id==='overworld'&&!g.devMapOverlay){const fog=this.fogCanvas();if(fog)x.drawImage(fog,0,0,a.w,a.h);}}x.restore();
  if(this._miniPointArea!==a||performance.now()>(this._miniPointTime||0)){this._miniPointArea=a;this._miniPointTime=performance.now()+400;this._miniPoints=this.atlasPoints();}
  for(const pt of this._miniPoints){const xx=ox+pt.x*sc,z=oz+pt.z*sc;if(xx<8||xx>W-8||z<8||z>H-8)continue;pin(x,pt,xx,z,pt.priority===0?4:3);}
  arrow(x,W/2,H/2,p.facing,7);x.font='bold 11px Mossling';x.fillStyle=INK;x.fillText('N',7,13);
  const target=g.story.markers().find(m=>m.pulse);if(target){const dx=(target.x-p.x)*sc,dz=(target.z-p.z)*sc,k=Math.max(Math.abs(dx)/(W/2-12),Math.abs(dz)/(H/2-12));if(k>1){arrow(x,W/2+dx/k,H/2+dz/k,Math.atan2(dx,dz),5);}}
  const caption=$('map-caption');if(caption)caption.textContent=a.placeAt?.(p.x,p.z)?.name||a.name;
 };
}
