// Both character screens use the game rig, camera, pixel density and idle pose.
import * as THREE from 'three';
import { PixelRenderer } from './engine/pixel.js';
import { makeHero, poseHeroIdle } from './hero.js';
import { weaponFamily } from './rpg/gear.js';
import { tickPrism } from './weaponFx.js';
export class HeroPortrait {
 constructor(game){this.game=game;this.scene=new THREE.Scene();this.hemi=new THREE.HemisphereLight(0xbfd8ff,0x6a5a3a,1.2);this.sun=new THREE.DirectionalLight(0xfff0d0,2.2);this.sun.position.set(-7,16,5);this.scene.add(this.hemi,this.sun);this.rotY=.3;this.spin=0;this.zoom=1;this.t=2;this.cls=null;}
 mount(host){
  this.host=host;
  if(!this.pixel){const cv=document.createElement('canvas');cv.className='doll-canvas';cv.setAttribute('aria-label','Your character, using the in-game camera and appearance');cv.dataset.renderer='gameplay';this.pixel=new PixelRenderer(cv,{transparent:true,viewport:()=>this.host.getBoundingClientRect()});this.pixel.postMat.uniforms.vignette.value=0;this.pixel.target.set(0,.43,0);let drag=null;
   cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=e.clientX;cv.setPointerCapture(e.pointerId);});cv.addEventListener('pointermove',e=>{if(drag!==null){this.rotY+=(e.clientX-drag)*.012;drag=e.clientX;}});const end=()=>{drag=null;};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);cv.addEventListener('lostpointercapture',end);cv.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom+e.deltaY*.0005);},{passive:false});cv.addEventListener('dblclick',()=>{this.rotY=.3;this.setZoom(1);});
   this.observer=new ResizeObserver(()=>this.resize());
  }
  this.observer.disconnect();this.observer.observe(host);host.append(this.pixel.renderer.domElement);this.resize();
 }
 setZoom(z){this.zoom=Math.max(.7,Math.min(1.4,z));this.resize();}
 resize(){if(!this.pixel||!this.host)return;const r=this.host.getBoundingClientRect();if(r.width<1||r.height<1)return;const texel=this.game?.pr.unitsPerPx||12/330;
  // Fit the same physical framing in either panel. Magnification adds no fake detail.
  const height=Math.max(1.65,1.4*r.height/r.width)*this.zoom;this.pixel.forceScale=Math.max(1,r.height*texel/height);this.pixel.resize();this.pixel.setViewHeight((this.pixel.rh-2)*texel);this.pixel.renderer.domElement.dataset.texelDensity=String(texel);
 }
 setGear(cls,equip,appearance){if(this.cls!==cls){if(this.hero){this.scene.remove(this.hero.root);this.hero.dispose();}this.hero=makeHero(cls,appearance);this.scene.add(this.hero.root);this.cls=cls;}this.hero.setAppearance(appearance);this.hero.setGear(equip);this.equip=equip;this.family=weaponFamily(equip?.weapon)||({archer:'bow',witch:'staff'}[cls]||'blade');}
 frame(dt){dt=Math.max(0,Math.min(.05,dt||0));if(!this.hero||!this.pixel)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||this.game?.settings?.reducedMotion;this.t+=reduced?0:dt;this.rotY+=this.spin*dt;this.hero.root.rotation.y=this.rotY;poseHeroIdle(this.hero,this.family,this.t,!reduced&&this.t%4.2<.1);
  const g=this.game;if(g?.hemi){this.hemi.color.copy(g.hemi.color);this.hemi.groundColor.copy(g.hemi.groundColor);this.hemi.intensity=g.hemi.intensity;this.sun.color.copy(g.sun.color);this.sun.intensity=g.sun.intensity;}
  if(g?.pr){for(const key of ['bloom','bloomScale','contrast','desat'])this.pixel.postMat.uniforms[key].value=g.pr.postMat.uniforms[key].value;this.pixel.postMat.uniforms.grade.value.copy(g.pr.postMat.uniforms.grade.value);}
  tickPrism(this.t);
  this.pixel.render(this.scene,dt);
 }
 dispose(){this.observer?.disconnect();this.hero?.dispose();this.pixel?.dispose();}
}
