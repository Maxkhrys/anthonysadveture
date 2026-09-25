// Both character screens use the game rig, camera, pixel density and idle pose.
import * as THREE from 'three';
import { PixelRenderer } from './engine/pixel.js';
import { makeHero, poseHeroIdle } from './hero.js';
import { weaponFamily } from './rpg/gear.js';
import { tickPrism } from './weaponFx.js';
import { geo, B, MAT } from './models.js';
// Character screens draw the same model at twice the gameplay pixel density: the same sprite
// language, with enough pixels for faces, trims and cloth to read like a portrait.
export const PORTRAIT_DETAIL = 2;
// A small mossy stone plinth and a soft contact shadow under the character.
function plinth() {
  const g = new THREE.Group();
  const stone = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; stone.push(B(.26,.06,.3,Math.cos(a)*.2,-.07,Math.sin(a)*.2,i%2?0x6e6676:0x635c6c,0,-a,0)); }
  stone.push(B(.46,.06,.46,0,-.07,0,0x6e6676,0,Math.PI/8), B(.5,.02,.5,0,-.015,0,0x5a9a46,0,Math.PI/8), B(.44,.02,.44,0,-.012,0,0x68a852,0,Math.PI/4+Math.PI/8));
  for (const [x,z,w] of [[.22,.15,.1],[-.24,-.12,.09],[.05,-.26,.08]]) stone.push(B(w,.025,w*.8,x,-.005,z,0x7cba5c));
  for (const [x,z] of [[.26,-.2],[-.28,.1]]) stone.push(B(.025,.04,.025,x,.005,z,0x6aa84a),B(.045,.012,.045,x,.045,z,0xf2d36b));
  const m = new THREE.Mesh(geo(stone), MAT); m.receiveShadow = true; m.layers.enable(1); g.add(m);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(.26, 20).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x1a1420,transparent:true,opacity:.28,depthWrite:false}));
  sh.position.y = .024; g.add(sh);
  return g;
}
export class HeroPortrait {
 constructor(game){this.game=game;this.scene=new THREE.Scene();this.hemi=new THREE.HemisphereLight(0xbfd8ff,0x6a5a3a,1.2);this.sun=new THREE.DirectionalLight(0xfff0d0,2.2);this.sun.position.set(-7,16,5);this.scene.add(this.hemi,this.sun);
  // studio lighting on top of the world's own: a cool rim from behind, a warm low fill
  this.rim=new THREE.DirectionalLight(0x9ad8ff,1.5);this.rim.position.set(6,5,-8);this.fill=new THREE.DirectionalLight(0xffc890,.45);this.fill.position.set(-4,1.5,6);this.scene.add(this.rim,this.fill);
  this.base=plinth();this.scene.add(this.base);this.rotY=.3;this.spin=0;this.zoom=1;this.t=2;this.cls=null;}
 mount(host){
  this.host=host;
  if(!this.pixel){const cv=document.createElement('canvas');cv.className='doll-canvas';cv.setAttribute('aria-label','Your character, using the in-game camera and appearance');cv.dataset.renderer='gameplay';this.pixel=new PixelRenderer(cv,{transparent:true,pitch:THREE.MathUtils.degToRad(20),viewport:()=>this.host.getBoundingClientRect()});this.pixel.postMat.uniforms.vignette.value=0;this.pixel.target.set(0,.4,0);let drag=null;
   cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=e.clientX;cv.setPointerCapture(e.pointerId);});cv.addEventListener('pointermove',e=>{if(drag!==null){this.rotY+=(e.clientX-drag)*.012;drag=e.clientX;}});const end=()=>{drag=null;};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);cv.addEventListener('lostpointercapture',end);cv.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom+e.deltaY*.0005);},{passive:false});cv.addEventListener('dblclick',()=>{this.rotY=.3;this.setZoom(1);});
   this.observer=new ResizeObserver(()=>this.resize());
  }
  this.observer.disconnect();this.observer.observe(host);host.append(this.pixel.renderer.domElement);this.resize();
 }
 setZoom(z){this.zoom=Math.max(.7,Math.min(1.4,z));this.resize();}
 resize(){if(!this.pixel||!this.host)return;const r=this.host.getBoundingClientRect();if(r.width<1||r.height<1)return;const texel=(this.game?.pr.unitsPerPx||12/330)/PORTRAIT_DETAIL;
  // Fit the same physical framing in either panel. Magnification adds no fake detail.
  const height=Math.max(1.38,1.15*r.height/r.width)*this.zoom;this.pixel.forceScale=Math.max(1,r.height*texel/height);this.pixel.resize();this.pixel.setViewHeight((this.pixel.rh-2)*texel);this.pixel.renderer.domElement.dataset.texelDensity=String(texel);
 }
 setGear(cls,equip,appearance){if(this.cls!==cls){if(this.hero){this.scene.remove(this.hero.root);this.hero.dispose();}this.hero=makeHero(cls,appearance);this.scene.add(this.hero.root);this.cls=cls;}this.hero.setAppearance(appearance);this.hero.setGear(equip);this.equip=equip;this.family=weaponFamily(equip?.weapon)||({archer:'bow',witch:'staff'}[cls]||'blade');}
 frame(dt){dt=Math.max(0,Math.min(.05,dt||0));if(!this.hero||!this.pixel)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||this.game?.settings?.reducedMotion;this.t+=reduced?0:dt;this.rotY+=this.spin*dt;this.hero.root.rotation.y=this.rotY;poseHeroIdle(this.hero,this.family,this.t,!reduced&&this.t%4.2<.1);
  const g=this.game;if(g?.hemi){this.hemi.color.copy(g.hemi.color);this.hemi.groundColor.copy(g.hemi.groundColor);this.hemi.intensity=g.hemi.intensity;this.sun.color.copy(g.sun.color);this.sun.intensity=g.sun.intensity;}
  // keep the portrait well lit even at night: the world's tint, never its darkness
  this.hemi.intensity=Math.max(1.15,this.hemi.intensity);this.sun.intensity=Math.max(2,this.sun.intensity);
  if(g?.pr){for(const key of ['bloom','bloomScale','contrast','desat'])this.pixel.postMat.uniforms[key].value=g.pr.postMat.uniforms[key].value;this.pixel.postMat.uniforms.grade.value.copy(g.pr.postMat.uniforms.grade.value);this.pixel.postMat.uniforms.desat.value=Math.min(.12,this.pixel.postMat.uniforms.desat.value);const gr=this.pixel.postMat.uniforms.grade.value;gr.set((gr.x+1)/2,(gr.y+1)/2,(gr.z+1)/2);}
  tickPrism(this.t);
  this.pixel.render(this.scene,dt);
 }
 dispose(){this.observer?.disconnect();this.hero?.dispose();this.pixel?.dispose();}
}
