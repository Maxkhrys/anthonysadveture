// Standard Gamepad API layout; gameplay mapping and UI routing share one snapshot.
export const PAD_HELP = 'LS move · RS aim · X attack · RT secondary · LB guard · B dodge · A interact · Y reload · ↑ tonic · ↓ craft · ←/→ or RB belt · View inventory · Start pause · R3 surge · L3 tool · hold LT + X/Y/B/A/LB/RB: abilities 1–6';
export const deadzone = (x=0,z=0,d=.22) => {const n=Math.hypot(x,z);if(n<=d)return [0,0];const k=Math.min(1,(n-d)/(1-d))/n;return [x*k,z*k];};
export function readPad(p){
 const b=i=>!!(p?.buttons?.[i]?.pressed||p?.buttons?.[i]?.value>.5);
 const axes=p?.axes||[],move=deadzone(axes[0],axes[1]),aim=deadzone(axes[2],axes[3],.28);
 return {buttons:Array.from({length:17},(_,i)=>b(i)),move,aim,active:move.some(Boolean)||aim.some(Boolean)||Array.from({length:17},(_,i)=>b(i)).some(Boolean)};
}
export function padActions(raw){
 const b=i=>raw.buttons[i],s={};
 if(b(6)){[2,3,1,0,4,5].forEach((n,i)=>s['ab'+(i+1)]=b(n));s.toolCycle=b(8);}
 else Object.assign(s,{attack:b(2),secondary:b(7),shield:b(4),roll:b(1),interact:b(0),reload:b(3),inventory:b(8),beltNext:b(5)||b(15),beltPrev:b(14),craft:b(13),potion:b(12),item:b(10),surge:b(11)});
 s.pause=b(9);return s;
}
const visible=e=>e.getClientRects().length&&!e.closest('.hidden,[hidden]')&&getComputedStyle(e).visibility!=='hidden';
export class ControllerUI{
 constructor(g){this.g=g;this.last=[];this.dir='';this.repeat=0;this.root=null;this.keyboard=null;this.status=document.createElement('div');this.status.id='controller-status';this.status.setAttribute('role','status');document.getElementById('ui').append(this.status);}
 update(dt,root,back){
  const I=this.g.input,raw=I.padRaw,b=raw?.buttons||[],edge=n=>b[n]&&!this.last[n];
  if(I.padDisconnected)this.notice=4;this.notice=Math.max(0,(this.notice||0)-dt);
  const status=this.notice>0?'Controller disconnected. Keyboard and mouse still work.':I.usingPad?(I.padLayer?'LT abilities: X 1 · Y 2 · B 3 · A 4 · LB 5 · RB 6':root?'A select · B back · D-pad move · LB/RB previous/next':'A interact · X attack · B dodge · View inventory · LT abilities'):'';
  if(this.status.textContent!==status)this.status.textContent=status;
  this.status.hidden=!status;
  document.documentElement.classList.toggle('using-controller',I.usingPad);
  if(this.wasPad!==I.usingPad){this.wasPad=I.usingPad;this.g.hudDirty=true;this.g.ui.buildHotbar?.();}
  if(!raw||!I.usingPad){this.last=[...b];return false;}
  const scope=this.keyboard||root;
  if(!scope){if(this.root){I.suppressPadUntilRelease=true;I.state={};}this.last=[...b];this.root=null;return false;}
  this.root=scope;
  const nodes=[...scope.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"],a,#title-menu>div,.choices span,.tabs span,.cell[data-i],.slotbox[data-eq]')].filter(visible);
  nodes.forEach(e=>{if(e.tabIndex<0)e.tabIndex=0;});
  let active=document.activeElement;
  if(!nodes.includes(active)){active=nodes[Math.min(this.focusIndex||0,nodes.length-1)];active?.focus({preventScroll:true});}
  const x=raw.move[0],z=raw.move[1],dir=b[12]||z<-.5?'up':b[13]||z>.5?'down':b[14]||x<-.5?'left':b[15]||x>.5?'right':'';
  this.repeat-=dt;const step=dir&&(dir!==this.dir||this.repeat<=0);
  if(step){this.repeat=dir === this.dir ? .14 : .38;
   if(active?.matches('select,input[type=range],input[type=number]')&&(dir==='left'||dir==='right')){
    const d=dir==='left'?-1:1;
    if(active.tagName==='SELECT')active.selectedIndex=Math.max(0,Math.min(active.options.length-1,active.selectedIndex+d));
    else active.value=Math.max(Number(active.min)||0,Math.min(Number(active.max)||100,(Number(active.value)||0)+d*(Number(active.step)||1)));
    active.dispatchEvent(new Event('change',{bubbles:true}));
   }else if(active){const r=active.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;
    const scores=nodes.filter(e=>e!==active).map(e=>{const q=e.getBoundingClientRect(),dx=q.x+q.width/2-cx,dy=q.y+q.height/2-cy,along=dir==='left'?-dx:dir==='right'?dx:dir==='up'?-dy:dy,cross=dir==='left'||dir==='right'?Math.abs(dy):Math.abs(dx);return {e,score:along>4?along+cross*3:Infinity};}).sort((a,b)=>a.score-b.score);
    if(scores[0]?.score<Infinity)scores[0].e.focus();
   }
  }
  this.dir=dir;
  if(edge(4)||edge(5)){const i=nodes.indexOf(document.activeElement);nodes[(i+(edge(4)?-1:1)+nodes.length)%nodes.length]?.focus();}
  this.focusIndex=Math.max(0,nodes.indexOf(document.activeElement));
  if(edge(0)){const e=document.activeElement;if(e?.matches('input[type=text],input[type=search],input:not([type])'))this.openKeyboard(e);else if(e?.matches('select')){e.selectedIndex=(e.selectedIndex+1)%e.options.length;e.dispatchEvent(new Event('change',{bubbles:true}));}else e?.click();}
  if(edge(2)&&this.g.ui.invOpen&&!this.g.survivalUI?.open)scope.querySelector('[data-act="ii-details"]')?.click();
  if(edge(3)&&this.g.ui.invOpen&&!this.g.survivalUI?.open)scope.querySelector('[data-act="favourite"]')?.click();
  if(edge(1)||edge(9)||edge(8)){if(this.keyboard)this.closeKeyboard();else back();}
  this.last=[...b];I.state={};I.mx=I.mz=0;I.mouse.clear();I.mtaps.clear();return true;
 }
 openKeyboard(input){
  if(this.keyboard)return;const d=document.createElement('section');d.id='pad-keyboard';d.setAttribute('role','dialog');d.setAttribute('aria-label','Controller text entry');
  const output=document.createElement('output');output.textContent=input.value;d.append(output);
  const keys=document.createElement('div');d.append(keys);
  for(const key of 'abcdefghijklmnopqrstuvwxyz0123456789'.split('').concat(['Space','Backspace','Done'])){const b=document.createElement('button');b.textContent=key;b.onclick=()=>{if(key==='Done')return this.closeKeyboard();input.value=key==='Backspace'?input.value.slice(0,-1):(input.value+(key==='Space'?' ':key)).slice(0,input.maxLength>0?input.maxLength:60);output.textContent=input.value;input.dispatchEvent(new Event('input',{bubbles:true}));};keys.append(b);}
  this.textTarget=input;this.keyboard=d;document.body.append(d);keys.firstChild.focus();
 }
 closeKeyboard(){this.keyboard?.remove();this.keyboard=null;this.textTarget?.focus();}
}
