import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { mesh, B, MAT_GLOW } from '../models.js';
import { sfx } from '../engine/audio.js';

const flashMats = {};
export function flashObj(obj, dur = 0.08, color = 0xffffff) {
  const mat = flashMats[color] || (flashMats[color] = new THREE.MeshBasicMaterial({ color }));
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.orig) o.userData.orig = o.material;
    o.material = mat;
    clearTimeout(o.userData.ft);
    o.userData.ft = setTimeout(() => { o.material = o.userData.orig; }, dur * 1000);
  });
}

const PIP = { 1: 0xd89a4a, 5: 0x9ad0ff, 20: 0xffd25e, 50: 0xff7ab0 };
export class Pickup extends Entity {
  constructor(g, x, z, kind, value = 1) {
    super(g, x, z);
    this.kind = kind; this.value = value;
    this.r = 0.2;
    this.vy = 4 + Math.random() * 2; this.y = 0.3;
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 1.5;
    this.vx = Math.cos(a) * s; this.vz = Math.sin(a) * s;
    this.life = 14; this.t = 0;
    let m;
    if (kind === 'pip') {
      const c = PIP[value] || PIP[1];
      const sc = value >= 20 ? 1.35 : value >= 5 ? 1.15 : 1;
      m = mesh([B(0.16 * sc, 0.14 * sc, 0.06, 0, 0, 0, c), B(0.1 * sc, 0.06 * sc, 0.06, 0, 0.14 * sc, 0, c), B(0.2 * sc, 0.04, 0.07, 0, 0, 0, 0xffffff), B(0.04, 0.04, 0.04, 0, -0.03, 0, 0x7a4b12)], MAT_GLOW, true);
    } else if (kind === 'heart') {
      m = mesh([B(0.1, 0.1, 0.06, -0.05, 0.08, 0, 0xff4a5a), B(0.1, 0.1, 0.06, 0.05, 0.08, 0, 0xff4a5a), B(0.14, 0.08, 0.06, 0, 0.02, 0, 0xff4a5a), B(0.06, 0.05, 0.06, 0, -0.03, 0, 0xff4a5a), B(0.03, 0.03, 0.065, -0.06, 0.13, 0, 0xffffff)], MAT_GLOW, true);
      this.value = 2;
    } else if (kind === 'heartfull') {
      m = mesh([B(0.2, 0.2, 0.1, -0.1, 0.16, 0, 0xff4a5a), B(0.2, 0.2, 0.1, 0.1, 0.16, 0, 0xff4a5a), B(0.28, 0.16, 0.1, 0, 0.04, 0, 0xff4a5a), B(0.12, 0.1, 0.1, 0, -0.06, 0, 0xff4a5a), B(0.34, 0.34, 0.08, 0, 0.1, -0.02, 0xffd25e)], MAT_GLOW, true);
      this.life = 1e9; this.vx = this.vz = 0; this.vy = 3;
    }
    this.spin = m; this.obj.add(m);
    this.attach();
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt; this.life -= dt;
    if (this.life < 3) this.obj.visible = Math.floor(this.life * 10) % 2 === 0;
    if (this.life <= 0) return this.remove();
    this.vy -= 14 * dt; this.y += this.vy * dt;
    if (this.y < 0.15) { this.y = 0.15; this.vy = Math.abs(this.vy) > 1.5 ? -this.vy * 0.45 : 0; this.vx *= 0.6; this.vz *= 0.6; }
    const d = this.dist(p);
    if (d < 1.6 && this.t > 0.35 && this.kind !== 'heartfull') { // magnet
      const k = (1.6 - d) * 10 * dt;
      this.x += (p.x - this.x) * k; this.z += (p.z - this.z) * k;
    }
    this.moveMode = 'fly';
    move(g, this, this.vx * dt, this.vz * dt);
    this.spin.rotation.y += dt * 4;
    if (d < 0.45 && this.t > 0.25 && p.state !== 'dead') this.collect();
    this.sync();
    this.obj.position.y = this.y + Math.sin(this.t * 4) * 0.03;
  }
  collect() {
    const g = this.g;
    if (this.kind === 'pip') { g.addCoins(this.value); sfx(this.value >= 20 ? 'pipbig' : 'pip'); g.fx.burst(this.x, 0.3, this.z, 4, 0xfff3b0, 1.5, { life: 0.3, size: 0.05 }); }
    else if (this.kind === 'heart') { g.heal(g.inv.maxHp * 0.12); sfx('heart'); }
    else if (this.kind === 'heartfull') { g.gainHeartContainer(); }
    this.remove();
  }
}

export function dropLoot(g, x, z, table) {
  // table: {pip: chance, heart: chance, value}
  const r = Math.random();
  const inv = g.inv;
  const hurt = inv.hp < inv.maxHp;
  // hearts are a small top-up, not a second tonic belt; slightly likelier when you're low
  if (hurt && r < (table.heart ?? 0.15) * 0.5 * (inv.hp <= inv.maxHp * 0.3 ? 2 : 1)) { g.spawn(new Pickup(g, x, z, 'heart')); return; }
  let n = table.pips ?? 1;
  if (Math.random() < (table.chance ?? 0.7)) {
    while (n > 0) {
      const v = n >= 20 ? 20 : n >= 5 ? 5 : 1;
      g.spawn(new Pickup(g, x, z, 'pip', v));
      n -= v;
    }
  }
}
export function dropPips(g, x, z, total) {
  while (total > 0) { const v = total >= 50 ? 50 : total >= 20 ? 20 : total >= 5 ? 5 : 1; g.spawn(new Pickup(g, x, z, 'pip', v)); total -= v; }
}
