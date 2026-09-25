// Aim presentation: the cursor reticle, the projectile path preview and ground-target
// previews for placed abilities. Everything here reads the player's aim state; nothing
// here decides where attacks go, so what you see is what the attack code uses.
import * as THREE from 'three';

export const AIM_H = 0.45; // projectiles fly at this height; the reticle sits on this plane

function flat(g, geo, color, opacity) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 990; m.visible = false; m.frustumCulled = false;
  g.scene.add(m);
  return m;
}

export class AimView {
  constructor(g) {
    this.g = g;
    this.ret = flat(g, new THREE.RingGeometry(0.15, 0.22, 16), 0xffffff, 0.9);
    this.retIn = flat(g, new THREE.CircleGeometry(0.045, 8), 0xffffff, 0.95);
    this.lock = flat(g, new THREE.RingGeometry(0.34, 0.4, 4), 0xff6a5a, 0.9);
    this.dots = [];
    for (let i = 0; i < 40; i++) this.dots.push(flat(g, new THREE.PlaneGeometry(0.07, 0.07), 0xffffff, 0.55));
    this.area = flat(g, new THREE.RingGeometry(0.92, 1, 40), 0x7fd36a, 0.85);
    this.areaFill = flat(g, new THREE.CircleGeometry(1, 40), 0x7fd36a, 0.16);
    this.range = flat(g, new THREE.RingGeometry(0.975, 1, 72), 0xffffff, 0.3);
    this.all = [this.ret, this.retIn, this.lock, ...this.dots, this.area, this.areaFill, this.range];
  }
  hide() { for (const m of this.all) m.visible = false; }
  update() {
    const g = this.g, p = g.player;
    this.hide();
    if (!p || g.locked() || g.dead || p.state === 'dead' || g.ui.invOpen) { document.body.classList.remove('aiming'); return; }
    const mouse = p.aimSrc === 'mouse';
    document.body.classList.toggle('aiming', mouse);
    const t = g.time;
    // ground-target preview (Snare, Rain of Arrows)
    const tg = p.targeting;
    if (tg) {
      const q = p.groundTarget(tg);
      const col = q.ok ? 0x7fd36a : 0xff5a4a;
      this.area.material.color.setHex(col); this.areaFill.material.color.setHex(col);
      this.area.position.set(q.x, 0.04, q.z); this.area.scale.setScalar(tg.radius); this.area.visible = true;
      this.areaFill.position.set(q.x, 0.035, q.z); this.areaFill.scale.setScalar(tg.radius); this.areaFill.visible = true;
      this.areaFill.material.opacity = 0.12 + Math.sin(t * 8) * 0.05;
      this.range.position.set(p.x, 0.03, p.z); this.range.scale.setScalar(tg.range); this.range.visible = true;
      if(tg.id==='powdergrenade')for(let i=0;i<20;i++){const k=i/19,d=this.dots[i];d.position.set(p.x+(q.x-p.x)*k,(g.groundAt?.(p.x,p.z)||0)+.15+Math.sin(k*Math.PI)*1.4,p.z+(q.z-p.z)*k);d.material.color.setHex(col);d.visible=true;}

    }
    if (!mouse && p.aimSrc !== 'pad') return;
    // reticle (mouse only: a pad has no cursor, it gets the path preview)
    if (mouse) {
      const a = p.aimPt;
      this.ret.position.set(a.x, AIM_H, a.z); this.ret.visible = !tg;
      this.retIn.position.set(a.x, AIM_H, a.z); this.retIn.visible = !tg;
      this.ret.rotation.z = t * 1.5;
      const charged = (p.state === 'aim' && p.aimT >= p.chargeTime) || (p.state === 'charge' && p.chargeT >= 0.7);
      this.ret.material.color.setHex(charged ? 0xffd25e : p.aimLock ? 0xff8a7a : 0xffffff);
      if (p.aimLock && !p.aimLock.dead) {
        const e = p.aimLock;
        this.lock.position.set(e.x, 0.05, e.z); this.lock.scale.setScalar((e.r || 0.3) * 2.2 + 0.3 * Math.sin(t * 10) * 0.1);
        this.lock.rotation.z = t * 2; this.lock.visible = true;
      }
    }
    // projectile path: what the next shot will actually do (stops at walls)
    const path = p.shotPreview();
    if (path) {
      const n = Math.min(this.dots.length, Math.floor(path.len / 0.35));
      for (let i = 0; i < n; i++) {
        const d = this.dots[i], k = (i + 1) * 0.35;
        d.position.set(p.x + Math.sin(path.dir) * k, AIM_H, p.z + Math.cos(path.dir) * k);
        d.rotation.z = -path.dir;
        d.material.color.setHex(path.charged ? 0xffd25e : 0xffffff);
        d.material.opacity = path.charged ? 0.8 : 0.45;
        d.visible = true;
      }
    }
  }
}
