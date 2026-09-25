// Pass 5 creatures: Needle Mantis, Candle Slug, Lantern Moth, Porcelain Guard, Bell Leech.
// Every attack has a readable telegraph drawn on the ground (or on the creature) before it lands.
import * as THREE from 'three';
import { Entity } from './entity.js';
import { Enemy, EXTRA_ENEMIES } from './enemies.js';
import { MONSTER_NAMES } from './monsters2.js';
import { mesh, B, MAT_GLOW } from '../models.js';
import { sfx } from '../engine/audio.js';
import { angDiff, angleLerp } from '../engine/util.js';

const EYE = 0xfff3b0;
const flatMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
function ring(g, x, z, r, color = 0xff5a4a, inner = 0.2) { const m = new THREE.Mesh(new THREE.RingGeometry(r * inner, r, 28), flatMat(color, 0.5)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); g.world.add(m); return m; }
const drop = m => m && m.parent && m.parent.remove(m);

// ---------------------------------------------------------------- Needle Mantis: precise, lane-telegraphed lunges
class Mantis extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'mantis');
    this.hp = 4; this.speed = 2.7; this.r = 0.3; this.aggro = 8.5;
    this.loot = { pips: 4, chance: 0.9, heart: 0.12 }; this.surgeGain = 5;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const G = 0x7ab84a, G2 = 0x5a9a3a, G3 = 0xa8d86a;
    body.add(mesh([B(0.18, 0.34, 0.2, 0, 0.18, -0.05, G2, 0.35), B(0.16, 0.14, 0.34, 0, 0.14, -0.28, G, -0.3), B(0.12, 0.22, 0.12, 0, 0.44, 0.08, G), // abdomen, thorax, neck
      ...[-1, 1].flatMap(s => [B(0.03, 0.26, 0.03, s * 0.12, 0, -0.1, 0x4a7a2a, 0, 0, s * 0.35), B(0.03, 0.24, 0.03, s * 0.12, 0, 0.06, 0x4a7a2a, 0, 0, s * 0.3)]), // legs
      B(0.22, 0.14, 0.16, 0, 0.62, 0.1, G3), B(0.26, 0.06, 0.1, 0, 0.66, 0.14, G), // triangular head
      B(0.03, 0.2, 0.03, -0.06, 0.74, 0.1, G2, -0.6, 0, 0.3), B(0.03, 0.2, 0.03, 0.06, 0.74, 0.1, G2, -0.6, 0, -0.3)])); // antennae
    const arms = new THREE.Group(); arms.position.set(0, 0.46, 0.12);
    arms.add(mesh([...[-1, 1].flatMap(s => [B(0.05, 0.22, 0.05, s * 0.09, -0.02, 0.06, G, -0.9), B(0.04, 0.3, 0.035, s * 0.09, 0.02, 0.2, 0xd8f0a8, -2.2)])])); // folded scythes
    body.add(arms);
    const eyes = mesh([B(0.08, 0.07, 0.04, -0.1, 0.64, 0.17, EYE), B(0.08, 0.07, 0.04, 0.1, 0.64, 0.17, EYE)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, arms, eyes }; this.obj.add(root);
  }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase': {
        if (!this.playerVisible() && d > this.aggro + 3) { this.dropToken(); this.setState('idle'); return [0, 0]; }
        if (d < 4.6 && d > 1.2 && this.st > 0.9 && this.takeToken()) {
          this.setState('windup'); sfx('windup');
          this.ldir = this.angleTo(p); this.facing = this.ldir;
          this.len = Math.min(4.6, g.shotLen(this.x, this.z, this.ldir, 4.6));
          // the lane: a narrow strip exactly as long as the lunge
          this.lane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, this.len), flatMat(0xff4a4a, 0.25));
          this.lane.rotation.x = -Math.PI / 2; this.lane.rotation.z = -this.ldir;
          this.lane.position.set(this.x + Math.sin(this.ldir) * this.len / 2, 0.05, this.z + Math.cos(this.ldir) * this.len / 2);
          g.world.add(this.lane);
          return [0, 0];
        }
        if (d < 2.4 && !this.token) return this.circle(dt, 3.2);
        return this.chase(dt, 2.2);
      }
      case 'windup': {
        // the lane aims once, then locks: sidestep it
        const k = Math.min(1, this.st / 0.6);
        this.lane.material.opacity = 0.2 + k * 0.45; this.lane.scale.x = 0.5 + k * 0.5;
        this.telegraph(this.st);
        if (this.st > 0.6) { drop(this.lane); this.lane = null; this.setState('attack'); this.m.eyes.visible = true; this.hitDone = false; this.sx = this.x; this.sz = this.z; sfx('lunge'); }
        return [0, 0];
      }
      case 'attack': {
        const k = this.st / 0.2;
        if (!this.hitDone && this.attackHit(0.45, 2.4, undefined, undefined, { kb: 7 })) this.hitDone = true;
        if (Math.random() < 0.8) g.fx.add({ x: this.x, y: 0.4, z: this.z, g: 0, color: 0xd8f0a8, life: 0.2, size: 0.05 });
        if (k >= 1 || Math.hypot(this.x - this.sx, this.z - this.sz) >= this.len) { this.setState('recover'); this.dropToken(); return [0, 0]; }
        return [Math.sin(this.ldir) * 22, Math.cos(this.ldir) * 22];
      }
      case 'recover':
        if (this.st > 0.85) this.setState('chase');
        return [0, 0];
    }
    return [0, 0];
  }
  remove() { drop(this.lane); this.lane = null; super.remove(); }
  onStagger() { drop(this.lane); this.lane = null; }
  animate(dt, sp) {
    const b = this.m.body, t = this.g.time;
    this.obj.rotation.y = this.facing;
    this.walkT += dt * (4 + sp * 3);
    b.position.y = Math.abs(Math.sin(this.walkT)) * 0.04 * Math.min(1, sp);
    b.rotation.z = Math.sin(t * 2 + this.home.x) * 0.06; // the mantis sway
    const s = this.state;
    this.m.arms.rotation.x = s === 'windup' ? -1.1 - Math.min(1, this.st / 0.6) * 0.5 : s === 'attack' ? 1.1 : s === 'recover' ? 0.6 - Math.min(0.6, this.st) : Math.sin(t * 3) * 0.08;
    b.rotation.x = s === 'windup' ? -0.25 : s === 'attack' ? 0.45 : 0;
    if (this.stagger > 0) b.rotation.x = -0.4;
  }
}

// ---------------------------------------------------------------- Candle Slug: wax trails and lobbed wax
class WaxPool extends Entity {
  constructor(g, x, z, lit) {
    super(g, x, z); this.t = 0; this.lit = lit; this.tick = 0;
    this.m = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), flatMat(lit ? 0xffb347 : 0xf0e0b0, 0.8)); this.m.rotation.x = -Math.PI / 2; this.m.position.y = 0.03; this.obj.add(this.m); this.sync();
    this.isHazard = true;
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt; this.tick -= dt;
    this.m.material.opacity = Math.max(0, 0.8 * Math.min(1, (4.5 - this.t) / 1.2));
    if (this.lit && Math.random() < 0.12) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.5, y: 0.08, z: this.z + (Math.random() - 0.5) * 0.5, vy: 0.8, g: -0.5, color: Math.random() < 0.5 ? 0xff8a2a : 0xffd25e, life: 0.4, size: 0.04 });
    if (this.lit && this.tick <= 0 && Math.hypot(p.x - this.x, p.z - this.z) < 0.5 && p.state !== 'roll') { this.tick = 0.6; p.hurt({ dmg: 0.6, x: this.x, z: this.z, src: this, kb: 1 }); }
    // enemies standing in lit wax catch fire too
    if (this.t > 4.5) this.remove();
  }
}
class Slug extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'slug');
    this.hp = 7; this.speed = 0.95; this.r = 0.36; this.aggro = 8;
    this.loot = { pips: 5, chance: 0.9, heart: 0.2 }; this.surgeGain = 6;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const W = 0xf0e0b8, W2 = 0xe0cca0;
    body.add(mesh([B(0.5, 0.2, 0.8, 0, 0, 0, W2), B(0.44, 0.16, 0.66, 0, 0.16, -0.02, W), B(0.3, 0.2, 0.24, 0, 0.12, 0.36, W), // body
      B(0.03, 0.14, 0.03, -0.07, 0.3, 0.42, W2, -0.4), B(0.03, 0.14, 0.03, 0.07, 0.3, 0.42, W2, -0.4), // eye stalks
      B(0.08, 0.1, 0.03, 0.22, 0.06, 0.1, W), B(0.08, 0.14, 0.03, -0.22, 0.04, -0.12, W), // drips
      B(0.18, 0.32, 0.18, 0, 0.3, -0.08, 0xf8f0dc), B(0.2, 0.04, 0.2, 0, 0.3, -0.08, 0xc0a060)])); // the candle on its back
    const flame = mesh([B(0.1, 0.16, 0.1, 0, 0, 0, 0xffb347), B(0.06, 0.1, 0.06, 0, 0.08, 0, 0xfff3b0)], MAT_GLOW, false);
    flame.position.set(0, 0.66, -0.08); body.add(flame);
    const eyes = mesh([B(0.05, 0.05, 0.05, -0.07, 0.44, 0.47, 0x1a1020), B(0.05, 0.05, 0.05, 0.07, 0.44, 0.47, 0x1a1020)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, flame, eyes }; this.obj.add(root);
    this.trailT = 0; this.lit = true;
  }
  // a gust blows the candle out: no fire trail, and the slug is vulnerable for a while
  onGust(d, p) { super.onGust(d, p); this.snuff(); }
  snuff() { if (!this.lit) return; this.lit = false; this.outT = 6; this.m.flame.visible = false; sfx('extinguish'); this.g.fx.burst(this.x, 0.7, this.z, 10, [0x6a6a7a, 0xe8e4dc], 1.5, { soft: true, g: -1 }); this.g.ui.float(this.x, 1.2, this.z, 'SNUFFED', '#e8e4dc', false, true); }
  modifyHit(h) { return this.lit ? 1 : 1.5; }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    if (!this.lit) { this.outT -= dt; if (this.outT <= 0) { this.lit = true; this.m.flame.visible = true; sfx('ignite'); } }
    // leave wax as it crawls
    this.trailT -= dt;
    if (this.trailT <= 0 && this.state !== 'idle') { this.trailT = 0.55; g.spawn(new WaxPool(g, this.x - Math.sin(this.facing) * 0.3, this.z - Math.cos(this.facing) * 0.3, this.lit)); }
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase':
        if (!this.playerVisible() && d > this.aggro + 3) { this.setState('idle'); return [0, 0]; }
        if (d < 6 && this.st > 2.2 && this.takeToken()) { this.setState('windup'); this.tx = p.x; this.tz = p.z; this.mk = ring(g, p.x, p.z, 1.0, 0xffb347); sfx('windup'); return [0, 0]; }
        return this.chase(dt, 1.6);
      case 'windup':
        this.facing = angleLerp(this.facing, Math.atan2(this.tx - this.x, this.tz - this.z), Math.min(1, dt * 6));
        if (this.mk) this.mk.material.opacity = 0.3 + Math.min(1, this.st / 0.8) * 0.4;
        if (this.st > 0.8) { this.setState('attack'); this.glob = { t: 0, x0: this.x, z0: this.z }; sfx('wax'); }
        return [0, 0];
      case 'attack': {
        const k = Math.min(1, this.st / 0.55);
        const x = this.glob.x0 + (this.tx - this.glob.x0) * k, z = this.glob.z0 + (this.tz - this.glob.z0) * k;
        g.fx.add({ x, y: 0.3 + Math.sin(k * Math.PI) * 1.8, z, g: 0, color: 0xf0e0b0, life: 0.15, size: 0.12 });
        if (k >= 1) {
          drop(this.mk); this.mk = null; this.dropToken();
          g.fx.burst(this.tx, 0.2, this.tz, 14, [0xf0e0b0, 0xffb347], 3); sfx('thud');
          g.spawn(new WaxPool(g, this.tx, this.tz, this.lit));
          if (Math.hypot(p.x - this.tx, p.z - this.tz) < 1.0 + p.r) p.hurt({ dmg: 1.6, x: this.tx, z: this.tz, src: this, kb: 4 });
          this.setState('recover');
        }
        return [0, 0];
      }
      case 'recover': if (this.st > 0.6) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  remove() { drop(this.mk); this.mk = null; super.remove(); }
  animate(dt, sp) {
    const b = this.m.body, t = this.g.time;
    this.obj.rotation.y = this.facing;
    this.walkT += dt * (2 + sp * 4);
    const s = Math.sin(this.walkT);
    b.scale.set(1 - s * 0.05, 1 + s * 0.04, 1 + s * 0.1);
    if (this.state === 'windup') b.scale.set(1.1, 0.8, 1.05);
    this.m.flame.scale.set(1 + Math.sin(t * 17) * 0.15, 1 + Math.sin(t * 23) * 0.25, 1);
    if (this.lit && Math.random() < 0.1) this.g.fx.add({ x: this.x, y: 0.9, z: this.z, vy: 0.6, g: 0, color: 0x6a6a7a, life: 0.8, size: 0.05, soft: true, grow: 1.4 });
  }
}

// ---------------------------------------------------------------- Lantern Moth: flies, dives, and lights up its allies
class LanternMoth extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'moth');
    this.hp = 2.5; this.speed = 3.2; this.r = 0.28; this.aggro = 9; this.moveMode = 'fly'; this.alt = 1.2;
    this.loot = { pips: 3, chance: 0.8, heart: 0.1 }; this.surgeGain = 4;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.12, 0.12, 0.3, 0, 0, 0, 0xd8d0b8), B(0.14, 0.12, 0.12, 0, 0.02, 0.18, 0xe8e0c8), B(0.03, 0.12, 0.03, -0.05, 0.1, 0.24, 0xc8b898, -0.8, 0, 0.4), B(0.03, 0.12, 0.03, 0.05, 0.1, 0.24, 0xc8b898, -0.8, 0, -0.4)]));
    const wl = new THREE.Group(), wr = new THREE.Group();
    wl.add(mesh([B(0.42, 0.02, 0.32, -0.24, 0, 0, 0xf0ecd8), B(0.14, 0.021, 0.14, -0.28, 0, 0.02, 0x8a7a9a)])); wr.add(mesh([B(0.42, 0.02, 0.32, 0.24, 0, 0, 0xf0ecd8), B(0.14, 0.021, 0.14, 0.28, 0, 0.02, 0x8a7a9a)]));
    body.add(wl, wr);
    const lamp = mesh([B(0.12, 0.14, 0.12, 0, -0.22, -0.1, 0xfff3b0)], MAT_GLOW, false); body.add(lamp);
    body.add(mesh([B(0.02, 0.1, 0.02, 0, -0.1, -0.1, 0x3a2a1a)]));
    const eyes = mesh([B(0.04, 0.04, 0.02, -0.04, 0.06, 0.25, 0x1a1020), B(0.04, 0.04, 0.02, 0.04, 0.06, 0.25, 0x1a1020)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, wl, wr, lamp, eyes }; this.obj.add(root);
    this.orb = Math.random() * 6.28;
  }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    // support: allies near the lantern fight harder while it lives
    this.buffT = (this.buffT || 0) - dt;
    if (this.buffT <= 0) { this.buffT = 0.3; for (const e of g.entities) if (e.isEnemy && e !== this && !e.dead && !e.isBoss && Math.hypot(e.x - this.x, e.z - this.z) < 3) { e.litT = 0.5; e.litBy = this;if(g.onScreen(this.x,this.z,.4)&&g.onScreen(e.x,e.z,.4))g.fxBolt(this.x,this.z,e.x,e.z,0xffe6a0); } }
    switch (this.state) {
      case 'idle': this.alt += (1.2 - this.alt) * dt * 2; if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase': {
        this.alt += (1.35 + Math.sin(g.time * 3 + this.orb) * 0.15 - this.alt) * dt * 3;
        if (!this.playerVisible() && d > this.aggro + 3) { this.setState('idle'); return [0, 0]; }
        this.orb += dt * 1.1;
        const tx = p.x + Math.cos(this.orb) * 3.4, tz = p.z + Math.sin(this.orb) * 2.6, dx = tx - this.x, dz = tz - this.z, l = Math.hypot(dx, dz) || 1;
        this.facing = angleLerp(this.facing, Math.atan2(dx, dz), Math.min(1, dt * 6));
        if (this.st > 2.4 && d < 5 && this.takeToken()) { this.setState('windup'); sfx('moth'); return [0, 0]; }
        return [dx / l * this.speed, dz / l * this.speed];
      }
      case 'windup': // the lantern flares, then it dives
        this.facing = angleLerp(this.facing, this.angleTo(p), Math.min(1, dt * 8));
        this.m.lamp.scale.setScalar(1 + Math.min(1, this.st / 0.6) * 0.8);
        if (this.st > 0.6) { this.setState('attack'); this.ldir = this.angleTo(p); this.hitDone = false; this.m.lamp.scale.setScalar(1); }
        return [0, 0];
      case 'attack': {
        const k = this.st / 0.55;
        this.alt = 1.35 - Math.sin(Math.min(1, k) * Math.PI) * 1.0;
        if (!this.hitDone && this.alt < 0.7 && this.attackHit(0.45, 1.2)) this.hitDone = true;
        if (k >= 1) { this.setState('chase'); this.dropToken(); }
        return [Math.sin(this.ldir) * 7, Math.cos(this.ldir) * 7];
      }
      case 'recover': if (this.st > 0.5) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  animate(dt) {
    const t = this.g.time, f = Math.sin(t * 26 + this.orb) * 0.7;
    this.obj.rotation.y = this.facing;
    this.m.wl.rotation.z = f; this.m.wr.rotation.z = -f;
    this.m.body.position.y = this.alt;
    this.m.body.rotation.x = this.state === 'attack' ? 0.5 : 0;
    if (Math.random() < 0.15) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.4, y: this.alt, z: this.z + (Math.random() - 0.5) * 0.4, vy: -0.3, g: 0, color: 0xf0ecd8, life: 0.8, size: 0.03 });
  }
}

// ---------------------------------------------------------------- Porcelain Guard: a shell to break first
class PorcelainGuard extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'porcelain');
    this.hp = 7; this.speed = 1.5; this.r = 0.36; this.aggro = 7.5; this.poise = true;
    this.loot = { pips: 6, chance: 1, heart: 0.2 }; this.surgeGain = 6;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const P = 0xf4f0ea, P2 = 0xdcd6cc, BL = 0x4a6ab0;
    this.shellMesh = mesh([B(0.5, 0.46, 0.4, 0, 0.22, 0, P), B(0.44, 0.06, 0.36, 0, 0.3, 0.02, BL), B(0.14, 0.14, 0.02, 0, 0.44, 0.205, BL), B(0.1, 0.1, 0.021, 0, 0.46, 0.206, P), // glazed torso with a blue willow pattern
      B(0.36, 0.34, 0.34, 0, 0.68, 0, P), B(0.3, 0.06, 0.02, 0, 0.8, 0.175, BL), B(0.12, 0.08, 0.02, -0.08, 0.72, 0.176, 0x1a1a2a), B(0.12, 0.08, 0.02, 0.08, 0.72, 0.176, 0x1a1a2a), B(0.08, 0.12, 0.08, 0, 1.02, 0, BL), // head, eye slits, knob
      B(0.1, 0.18, 0.02, 0.12, 0.3, 0.205, 0x8a8a90, 0, 0, 0.5)]); // a crack
    body.add(this.shellMesh);
    body.add(mesh([B(0.16, 0.22, 0.16, -0.14, 0, 0, P2), B(0.16, 0.22, 0.16, 0.14, 0, 0, P2)]));
    const shield = new THREE.Group(); shield.position.set(-0.32, 0.36, 0.18);
    shield.add(mesh([B(0.08, 0.5, 0.42, 0, -0.25, 0, P2), B(0.085, 0.3, 0.22, 0, -0.15, 0, BL)])); body.add(shield);
    const eyes = mesh([B(0.06, 0.04, 0.02, -0.08, 0.72, 0.18, 0x9ad8ff), B(0.06, 0.04, 0.02, 0.08, 0.72, 0.18, 0x9ad8ff)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, shield, eyes }; this.obj.add(root);
    this.shell = null; // set after scaling (a share of max health)
  }
  modifyHit(h) {
    if (this.shell === null) { this.shell = this.maxHp * 0.6; this.shellMax = this.shell; }
    if (this.shell <= 0) return 1.3; // cracked open
    // the glaze soaks most of each blow; heavy blows and shatters crack it much faster
    const heavy = h.heavy || h.kind === 'spin' || h.kind === 'surge' || h.kind === 'spin3';
    this.shell -= h.dmg * (heavy ? 3 : 1);
    this.g.fx.burst(this.x, 0.5, this.z, 4, [0xf4f0ea, 0x4a6ab0], 2, { life: 0.3, size: 0.04 });
    if (this.shell <= 0) this.breakShell();
    return 0.25;
  }
  breakShell() {
    const g = this.g;
    sfx('armorbreak'); g.hitstop(0.08); g.pr.addShake(0.35);
    for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 3; g.fx.add({ x: this.x, y: 0.5, z: this.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + Math.random() * 3, color: i % 3 ? 0xf4f0ea : 0x4a6ab0, life: 1.1, size: 0.08, g: 12 }); }
    this.shellMesh.scale.set(0.9, 0.9, 0.9); this.m.shield.visible = false;
    this.poise = false; this.speed = 2.3; this.stagger = 1.5; this.dropToken(); this.setState('recover');
    g.ui.float(this.x, 1.4, this.z, 'SHELL BROKEN', '#e8e0d0', true);
    g.stats.shellsBroken = (g.stats.shellsBroken || 0) + 1;
    if (g.pstats.uniques.has('shellbreaker')) { g.res = Math.min(100, g.res + 30); g.ui.float(g.player.x, 1.3, g.player.z, '+30', '#9ad8ff', false, true); }
  }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase': {
        if (!this.playerVisible() && d > this.aggro + 3) { this.setState('idle'); return [0, 0]; }
        const behind = Math.abs(angDiff(this.facing, this.angleTo(p))) > 1.8;
        if (d < 1.7 && this.st > 0.7 && this.takeToken()) { this.setState('windup'); this.move = behind ? 'sweep' : 'bash'; this.mk = ring(this.g, this.x, this.z, this.move === 'sweep' ? 1.7 : 1.3, 0xff5a4a, this.move === 'sweep' ? 0.75 : 0.2); sfx('windup'); return [0, 0]; }
        return this.chase(dt, 1.1);
      }
      case 'windup':
        if (this.move === 'bash') { this.facing = angleLerp(this.facing, this.angleTo(p), Math.min(1, dt * 5)); if (this.mk) this.mk.position.set(this.x + Math.sin(this.facing) * 0.8, 0.05, this.z + Math.cos(this.facing) * 0.8); }
        else if (this.mk) this.mk.position.set(this.x, 0.05, this.z);
        this.telegraph(this.st);
        if (this.st > 0.7) { drop(this.mk); this.mk = null; this.setState('attack'); this.m.eyes.visible = true; this.hitDone = false; sfx('clang'); }
        return [0, 0];
      case 'attack':
        if (!this.hitDone) {
          if (this.move === 'bash') { if (this.attackHit(0.7, 2, this.x + Math.sin(this.facing) * 0.8, this.z + Math.cos(this.facing) * 0.8, { kb: 9, heavy: true })) this.hitDone = true; }
          else if (this.attackHit(1.7, 1.6, this.x, this.z, { kb: 7 })) this.hitDone = true;
        }
        if (this.st > 0.35) { this.setState('recover'); this.dropToken(); }
        return this.move === 'bash' && this.st < 0.15 ? [Math.sin(this.facing) * 5, Math.cos(this.facing) * 5] : [0, 0];
      case 'recover': if (this.st > 0.8) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  remove() { drop(this.mk); this.mk = null; super.remove(); }
  animate(dt, sp) {
    const b = this.m.body;
    this.obj.rotation.y = this.facing;
    this.walkT += dt * (3 + sp * 3);
    b.position.y = Math.abs(Math.sin(this.walkT)) * 0.03 * Math.min(1, sp);
    b.rotation.z = Math.sin(this.walkT) * 0.05 * Math.min(1, sp);
    if (this.state === 'windup') { b.rotation.y = this.move === 'sweep' ? -0.6 : 0.3; this.m.shield.rotation.y = -0.5; }
    else if (this.state === 'attack') { b.rotation.y = this.move === 'sweep' ? this.st * 18 : -0.2; this.m.shield.rotation.y = 0.6; }
    else { b.rotation.y = 0; this.m.shield.rotation.y = 0; }
  }
}

// ---------------------------------------------------------------- Bell Leech: anchors and rings a disruption zone
class ResonanceZone extends Entity {
  constructor(g, x, z, src) {
    super(g, x, z); this.src = src; this.t = 0; this.tick = 0.3; this.r = 2.4; this.alwaysUpdate = true;
    this.rings = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), flatMat(0xe0b860, 0.6)); m.rotation.x = -Math.PI / 2; m.position.y = 0.05; this.obj.add(m); return m; });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.r, 32), flatMat(0xe0b860, 0.12)); this.disc.rotation.x = -Math.PI / 2; this.disc.position.y = 0.04; this.obj.add(this.disc);
    this.sync(); sfx('resonate');
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt; this.tick -= dt;
    this.rings.forEach((m, i) => { const k = ((this.t * 0.8 + i / 3) % 1); m.scale.setScalar(0.2 + k * this.r); m.material.opacity = 0.6 * (1 - k); });
    const inside = Math.hypot(p.x - this.x, p.z - this.z) < this.r;
    if (inside) {
      // disruption: your cooldowns stop ticking and your resource and Surge drain while you stand in it
      p.disruptT = 0.15;
      g.res = Math.max(0, g.res - 12 * dt); g.surge = Math.max(0, g.surge - 8 * dt); g.hudDirty = true;
      if (this.tick <= 0) { this.tick = 0.9; p.hurt({ dmg: 0.5, x: this.x, z: this.z, src: this.src || this, kb: 0.5, unblockable: true }); }
    }
    if (this.t > 3.2) this.remove();
  }
}
class BellLeech extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'leech');
    this.hp = 5; this.speed = 1.7; this.r = 0.32; this.aggro = 8;
    this.loot = { pips: 5, chance: 0.9, heart: 0.15 }; this.surgeGain = 5;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const segs = [];
    for (let i = 0; i < 4; i++) { const s = mesh([B(0.3 - i * 0.04, 0.2 - i * 0.02, 0.18, 0, 0, 0, i % 2 ? 0x8a6a3a : 0x6a5030), B(0.31 - i * 0.04, 0.03, 0.03, 0, 0.1, 0.06, 0xe0b860)]); s.position.z = -i * 0.17; body.add(s); segs.push(s); }
    const mouth = mesh([B(0.34, 0.26, 0.2, 0, 0, 0.18, 0xb88a3a), B(0.26, 0.2, 0.06, 0, 0.03, 0.28, 0x2a1a10), B(0.4, 0.05, 0.22, 0, -0.02, 0.18, 0xe0b860)]); body.add(mouth);
    body.add(mesh([B(0.02, 0.2, 0.02, -0.12, 0.2, 0.2, 0xe0b860, -0.4, 0, 0.3), B(0.02, 0.2, 0.02, 0.12, 0.2, 0.2, 0xe0b860, -0.4, 0, -0.3)], MAT_GLOW, false));
    const eyes = mesh([B(0.04, 0.04, 0.02, -0.08, 0.12, 0.29, EYE), B(0.04, 0.04, 0.02, 0.08, 0.12, 0.29, EYE)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, segs, mouth, eyes }; this.obj.add(root);
  }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase':
        if (!this.playerVisible() && d > this.aggro + 3) { this.setState('idle'); return [0, 0]; }
        if (d < 3.4 && this.st > 1.6 && this.takeToken()) { this.setState('windup'); this.mk = ring(g, this.x, this.z, 2.4, 0xe0b860, 0.93); this.mk2 = ring(g, this.x, this.z, 0.6, 0xe0b860, 0.5); sfx('windup'); return [0, 0]; }
        return this.chase(dt, 1.4);
      case 'windup': { // anchoring: a gold ring shows exactly where the zone will ring
        const k = Math.min(1, this.st / 1.0);
        if (this.mk2) this.mk2.scale.setScalar(1 + k * 3); if (this.mk) this.mk.material.opacity = 0.3 + 0.4 * Math.abs(Math.sin(this.st * 12));
        this.telegraph(this.st);
        if (this.st > 1.0) { drop(this.mk); drop(this.mk2); this.mk = this.mk2 = null; g.spawn(new ResonanceZone(g, this.x, this.z, this)); this.setState('recover'); this.dropToken(); g.pr.addShake(0.2); }
        return [0, 0];
      }
      case 'recover': if (this.st > 1.8) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  remove() { drop(this.mk); drop(this.mk2); this.mk = this.mk2 = null; super.remove(); }
  animate(dt, sp) {
    this.obj.rotation.y = this.facing;
    this.walkT += dt * (4 + sp * 4);
    this.m.segs.forEach((s, i) => { s.position.x = Math.sin(this.walkT - i * 0.9) * 0.05; s.position.y = Math.max(0, Math.sin(this.walkT * 0.5 - i * 0.6)) * 0.04; });
    this.m.mouth.rotation.x = this.state === 'windup' ? -0.5 : 0;
    if (this.state === 'windup') this.m.mouth.scale.setScalar(1 + Math.sin(this.st * 30) * 0.08); else this.m.mouth.scale.setScalar(1);
  }
}

Object.assign(EXTRA_ENEMIES, { mantis: Mantis, slug: Slug, moth: LanternMoth, porcelain: PorcelainGuard, leech: BellLeech });
Object.assign(MONSTER_NAMES, { mantis: 'Needle Mantis', slug: 'Candle Slug', moth: 'Lantern Moth', porcelain: 'Porcelain Guard', leech: 'Bell Leech' });
export const PASS5_ENEMIES = ['mantis', 'slug', 'moth', 'porcelain', 'leech'];
// materials each family can leave behind (read by Game.onEnemyDeath)
export const ENEMY_MATS = { mantis: ['mantis', 0.3], slug: ['wax', 0.35], moth: ['moth', 0.35], porcelain: ['porcelain', 0.45], leech: ['filament', 0.3] };
export { ResonanceZone, WaxPool };

// ---------------------------------------------------------------- elite modifiers: Resonant and Oathbound
// RESONANT: every attack it makes is repeated by a marked echo 0.9 s later, at the same spot.
class ResonantEcho extends Entity {
  constructor(g, src) {
    const r = src.kind === 'porcelain' || src.kind === 'leech' ? 1.6 : src.kind === 'knight' || src.kind === 'treant' || src.kind === 'golem' ? 1.8 : 1.1;
    const f = src.facing, reachAhead = src.kind === 'mantis' ? 2.2 : 0.8;
    super(g, src.x + Math.sin(f) * reachAhead, src.z + Math.cos(f) * reachAhead);
    this.src = src; this.r = r; this.t = 0; this.alwaysUpdate = true; this.dmg = 1.4 * (src.eliteScale ? 1 : 1);
    this.mk = ring(g, this.x, this.z, r, 0xc46bff, 0.15); this.mk2 = ring(g, this.x, this.z, r, 0xffffff, 0.93);
    sfx('resonate');
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    const k = Math.min(1, this.t / 0.9);
    this.mk.scale.setScalar(0.2 + k * 0.8); this.mk.material.opacity = 0.25 + k * 0.4;
    if (Math.random() < 0.4) g.fx.add({ x: this.x + (Math.random() - 0.5) * this.r, y: 0.2, z: this.z + (Math.random() - 0.5) * this.r, vy: 0.8, g: 0, color: 0xc46bff, life: 0.4, size: 0.05 });
    if (this.t >= 0.9) {
      g.fx.ring(this.x, this.z, 0.2, this.r, 0xc46bff, 0.35); g.fx.burst(this.x, 0.4, this.z, 12, [0xc46bff, 0xffffff], 3); sfx('heavyhit');
      if (g.onScreen(this.x,this.z,.2)&&g.shotClear(this.x,this.z,p.x,p.z)&&Math.hypot(p.x - this.x, p.z - this.z) < this.r + p.r) p.hurt({ dmg: this.dmg, x: this.x, z: this.z, src: this.src, kb: 5 });
      this.remove();
    }
  }
  remove() { drop(this.mk); drop(this.mk2); super.remove(); }
}
const _setState = Enemy.prototype.setState, _update = Enemy.prototype.update, _onHit = Enemy.prototype.onHit;
Enemy.prototype.setState = function (s) {
  if (s === 'attack' && this.elite === 'Resonant' && !this.dead && this.g && this.g.entities && this.g.onScreen(this.x,this.z,.4) && this.g.entities.filter(e=>e instanceof ResonantEcho&&!e.dead).length<2) this.g.spawn(new ResonantEcho(this.g, this));
  return _setState.call(this, s);
};
Enemy.prototype.update = function (dt) {
  this.litT = Math.max(0, (this.litT || 0) - dt); this.oathT = Math.max(0, (this.oathT || 0) - dt);
  if (this.elite === 'Oathbound' && !this.dead) {
    const g = this.g;
    this.oathBroken = Math.max(0, (this.oathBroken || 0) - dt);
    if (this.oathBroken <= 0) {
      if (this.oathReform) { this.oathReform = false; this.oathTaken = 0; sfx('oath'); g.fx.ring(this.x, this.z, 0.2, 4, 0xffd25e, 0.5, 0.05); }
      // golden threads bind every ally within 4 to it: they hit harder and shrug off blows
      for (const e of g.entities) if (e.isEnemy && e !== this && !e.dead && !e.isBoss && Math.hypot(e.x - this.x, e.z - this.z) < 4) {
        e.oathT = 0.4; e.oathBy = this;
        if (Math.random() < 0.25) { const u = Math.random(); g.fx.add({ x: this.x + (e.x - this.x) * u, y: 0.5, z: this.z + (e.z - this.z) * u, g: 0, color: 0xffd25e, life: 0.12, size: 0.04 }); }
      }
    }
  }
  if (this.litT > 0 && Math.random() < 0.08) this.g.fx.add({ x: this.x, y: 0.9 * (this.eliteScale || 1), z: this.z, vy: 0.4, g: 0, color: 0xfff3b0, life: 0.4, size: 0.04 });
  return _update.call(this, dt);
};
Enemy.prototype.onHit = function (h) {
  if (this.oathT > 0 && h) h = { ...h, dmg: h.dmg * 0.7 };
  const r = _onHit.call(this, h);
  // Oathbound: break its formation with heavy blows, a parry, or a quarter of its life
  if (r === 'hit' && this.elite === 'Oathbound' && !(this.oathBroken > 0)) {
    this.oathTaken = (this.oathTaken || 0) + h.dmg;
    if (h.heavy || h.kind === 'spin' || h.kind === 'surge' || this.oathTaken > this.maxHp * 0.25) this.breakOath();
  }
  return r;
};
Enemy.prototype.breakOath = function () {
  if (this.elite !== 'Oathbound' || this.oathBroken > 0) return;
  const g = this.g;
  this.oathBroken = 6; this.oathReform = true; this.stagger = Math.max(this.stagger, 0.8);
  for (const e of g.entities) if (e.oathBy === this) e.oathT = 0;
  sfx('snap'); g.fx.burst(this.x, 0.6, this.z, 16, [0xffd25e, 0xffffff], 3.5);
  g.ui.float(this.x, 1.5, this.z, 'OATH BROKEN', '#ffd25e', true);
};
const _parried = Enemy.prototype.onParried;
Enemy.prototype.onParried = function () { _parried.call(this); if (this.elite === 'Oathbound') this.breakOath(); };
export { ResonantEcho };
