// Zone monsters added in Pass 2. Each has a readable, distinct behaviour.
import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { Enemy, EXTRA_ENEMIES } from './enemies.js';
import { mesh, B, MAT_GLOW } from '../models.js';
import { sfx } from '../engine/audio.js';
import { angDiff, angleLerp } from '../engine/util.js';
import { dropPips } from './common.js';

const EYE = 0xfff3b0;
function marker(g, x, z, r, color = 0xff5a4a) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.2, r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); g.world.add(m); return m;
}
const unmark = m => m && m.parent && m.parent.remove(m);

// ---------------------------------------------------------------- lobbed enemy projectile (imp fireball, golem boulder)
class Lob extends Entity {
  constructor(g, src, x, z, tx, tz, o = {}) {
    super(g, x, z);
    this.src = src; this.sx = x; this.sz = z; this.tx = tx; this.tz = tz; this.t = 0; this.flight = o.flight || 0.9; this.r = o.radius || 1.0; this.dmg = o.dmg || 2; this.color = o.color || 0xff8a2a;
    this.m = mesh(o.rock ? [B(0.5, 0.45, 0.5, 0, -0.22, 0, 0x7a7a8a), B(0.3, 0.2, 0.3, 0.05, 0.1, 0, 0x9a9aa8)] : [B(0.3, 0.3, 0.3, 0, -0.15, 0, this.color), B(0.18, 0.18, 0.18, 0, -0.09, 0, 0xffe08a)], o.rock ? undefined : MAT_GLOW, false);
    this.obj.add(this.m);
    this.mk = marker(g, tx, tz, this.r, this.color);
  }
  update(dt) {
    const g = this.g; this.t += dt;
    const k = Math.min(1, this.t / this.flight);
    this.x = this.sx + (this.tx - this.sx) * k; this.z = this.sz + (this.tz - this.sz) * k; this.y = Math.sin(k * Math.PI) * 2.6 + 0.3;
    this.mk.scale.setScalar(0.4 + k * 0.6); this.m.rotation.x += dt * 8;
    if (Math.random() < 0.5) g.fx.add({ x: this.x, y: this.y, z: this.z, color: this.color, life: 0.3, size: 0.06, g: 0 });
    if (k >= 1) {
      unmark(this.mk);
      g.fx.burst(this.x, 0.3, this.z, 14, [this.color, 0xffe08a, 0x3a2a2a], 3.5, { life: 0.4 });
      g.fx.ring(this.x, this.z, 0.2, this.r, this.color, 0.3); sfx('thud'); g.pr.addShake(0.2);
      const p = g.player;
      if (Math.hypot(p.x - this.x, p.z - this.z) < this.r + p.r) p.hurt({ dmg: this.dmg, x: this.x, z: this.z, src: this.src, kb: 6 });
      return this.remove();
    }
    this.sync(); this.obj.position.y = this.y;
  }
  remove() { unmark(this.mk); super.remove(); }
}

// ---------------------------------------------------------------- Sand Scorpion — burrows and erupts beneath you
class Scorpion extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'scorpion');
    this.hp = 4; this.speed = 2.4; this.r = 0.32; this.aggro = 8;
    this.loot = { pips: 4, chance: 0.9, heart: 0.15 }; this.surgeGain = 5;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.5, 0.18, 0.6, 0, 0.06, 0, 0xc8904a), B(0.36, 0.08, 0.4, 0, 0.24, -0.02, 0xdca060),
      ...[-1, 1].flatMap(s => [B(0.3, 0.05, 0.05, s * 0.34, 0.06, 0.12, 0x9a6a3a, 0, 0, s * 0.3), B(0.3, 0.05, 0.05, s * 0.34, 0.06, -0.08, 0x9a6a3a, 0, 0, s * 0.3), B(0.14, 0.1, 0.18, s * 0.26, 0.1, 0.38, 0xb87a3a)])]));
    const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.28);
    tail.add(mesh([B(0.12, 0.12, 0.26, 0, 0, -0.1, 0xc8904a, 0.6), B(0.1, 0.24, 0.1, 0, 0.16, -0.22, 0xc8904a), B(0.1, 0.1, 0.18, 0, 0.38, -0.12, 0xdca060, -0.6), B(0.06, 0.1, 0.06, 0, 0.36, 0.0, 0x8a2a8a)]));
    body.add(tail);
    const eyes = mesh([B(0.05, 0.04, 0.02, -0.08, 0.17, 0.3, EYE), B(0.05, 0.04, 0.02, 0.08, 0.17, 0.3, EYE)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, tail, eyes }; this.obj.add(root);
  }
  onHit(h) { if (this.state === 'burrow') return null; return super.onHit(h); }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase':
        if (!this.playerVisible() && d > this.aggro + 3) { this.setState('idle'); return [0, 0]; }
        if (d < 6 && d > 1.5 && this.st > 1.2 && this.takeToken()) { this.setState('burrow'); sfx('thud'); g.fx.dust(this.x, this.z, 10, 0xe8c880); return [0, 0]; }
        if (d < 1.4 && this.st > 0.8 && this.takeToken()) { this.setState('windup'); this.tx = p.x; this.tz = p.z; this.mk = marker(g, p.x, p.z, 0.9); return [0, 0]; }
        return this.chase(dt, 1.1);
      case 'burrow': {
        const a = this.angleTo(p);
        if (Math.random() < 0.6) g.fx.dust(this.x, this.z, 1, 0xe8c880);
        if (d < 0.6 || this.st > 1.4) { this.setState('windup'); this.tx = this.x; this.tz = this.z; this.mk = marker(g, this.x, this.z, 0.9); return [0, 0]; }
        return [Math.sin(a) * 5.5, Math.cos(a) * 5.5];
      }
      case 'windup':
        this.telegraph(this.st);
        if (this.st > 0.55) {
          unmark(this.mk); this.setState('attack'); this.m.eyes.visible = true;
          g.fx.burst(this.x, 0.2, this.z, 16, [0xe8c880, 0xc8904a], 4); sfx('heavyhit');
          if (Math.hypot(p.x - this.tx, p.z - this.tz) < 0.9 + p.r) p.hurt({ dmg: 2, x: this.x, z: this.z, src: this, kb: 7 });
        }
        return [0, 0];
      case 'attack': if (this.st > 0.3) { this.setState('recover'); this.dropToken(); } return [0, 0];
      case 'recover': if (this.st > 0.9) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  die(h, how) { unmark(this.mk); super.die(h, how); }
  animate(dt, sp) {
    const m = this.m; this.obj.rotation.y = this.facing;
    const under = this.state === 'burrow';
    m.body.position.y = under ? -0.5 : (this.state === 'windup' ? -0.3 + Math.min(0.3, this.st * 0.6) : 0);
    m.tail.rotation.x = this.state === 'attack' ? 0.9 : Math.sin(this.g.time * 3) * 0.1;
    m.body.visible = !under;
  }
}

// ---------------------------------------------------------------- Ember Imp — lobs fire and blinks away
class Imp extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'imp');
    this.hp = 3; this.speed = 2.6; this.r = 0.26; this.aggro = 9; this.cool = 1 + Math.random();
    this.loot = { pips: 4, chance: 0.9, heart: 0.2 };
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.3, 0.3, 0.26, 0, 0.12, 0, 0xc0381a), B(0.34, 0.28, 0.3, 0, 0.42, 0, 0xd8482a), B(0.06, 0.14, 0.06, -0.12, 0.66, 0, 0x3a1a1a, 0, 0, 0.4), B(0.06, 0.14, 0.06, 0.12, 0.66, 0, 0x3a1a1a, 0, 0, -0.4),
      B(0.2, 0.04, 0.18, -0.24, 0.36, -0.06, 0x8a2a1a, 0, 0, 0.5), B(0.2, 0.04, 0.18, 0.24, 0.36, -0.06, 0x8a2a1a, 0, 0, -0.5), B(0.04, 0.2, 0.04, 0, 0.12, -0.16, 0x3a1a1a, 0.8)]));
    const eyes = mesh([B(0.06, 0.05, 0.02, -0.07, 0.48, 0.15, 0xffe08a), B(0.06, 0.05, 0.02, 0.07, 0.48, 0.15, 0xffe08a)], MAT_GLOW, false); body.add(eyes);
    const flame = mesh([B(0.12, 0.16, 0.12, 0, 0.8, 0, 0xffb347)], MAT_GLOW, false); body.add(flame);
    this.m = { root, body, eyes, flame }; this.obj.add(root);
  }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    this.cool -= dt;
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('aim'); return this.wander(dt);
      case 'aim': {
        if (!this.playerVisible()) { this.setState('idle'); return [0, 0]; }
        this.facing = angleLerp(this.facing, this.angleTo(p), dt * 6);
        if (this.cool <= 0 && d < 8) { this.setState('windup'); sfx('windup'); return [0, 0]; }
        const a = this.angleTo(p) + (d < 4 ? Math.PI : Math.PI / 2);
        return [Math.sin(a) * this.speed * 0.7, Math.cos(a) * this.speed * 0.7];
      }
      case 'windup':
        this.telegraph(this.st);
        if (this.st > 0.55) {
          this.m.eyes.visible = true;
          g.spawn(new Lob(g, this, this.x, this.z, p.x + p.vx * 0.3, p.z + p.vz * 0.3, { dmg: 2, radius: 1.0 }));
          sfx('shoot'); this.cool = 2 + Math.random() * 1.2;
          if (Math.random() < 0.4) this.blink(); else this.setState('aim');
        }
        return [0, 0];
      case 'recover': if (this.st > 0.4) this.setState('aim'); return [0, 0];
    }
    return [0, 0];
  }
  blink() {
    const g = this.g;
    g.fx.burst(this.x, 0.5, this.z, 12, [0xff8a2a, 0x3a1a1a], 2.5);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * 6.28, r = 2.5 + Math.random() * 2, nx = this.x + Math.cos(a) * r, nz = this.z + Math.sin(a) * r;
      const t = g.tileAt(Math.floor(nx), Math.floor(nz));
      if (t !== undefined && !(t === 6 || t === 7 || t === 8 || t === 13 || t === 4 || t === 5 || t === 10 || t === 12 || t === 20 || t === 22 || t === 23)) { this.x = nx; this.z = nz; break; }
    }
    g.fx.burst(this.x, 0.5, this.z, 12, [0xff8a2a, 0x3a1a1a], 2.5); sfx('poof');
    this.setState('aim');
  }
  animate(dt) {
    const m = this.m, t = this.g.time; this.obj.rotation.y = this.facing;
    m.body.position.y = 0.15 + Math.sin(t * 6 + this.home.x) * 0.06;
    m.flame.scale.y = 0.8 + Math.sin(t * 20) * 0.3;
    if (this.state === 'windup') m.body.scale.setScalar(1 + this.st * 0.3); else m.body.scale.setScalar(1);
  }
}

// ---------------------------------------------------------------- Mirewraith — fades out and strikes from behind
class Wraith extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'wraith');
    this.hp = 4; this.speed = 2.2; this.r = 0.28; this.aggro = 8; this.moveMode = 'fly'; this.alt = 0.3;
    this.loot = { pips: 5, chance: 0.9, heart: 0.2 }; this.surgeGain = 5;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
    const m = mesh([B(0.4, 0.5, 0.34, 0, 0.1, 0, 0x6a8aa8), B(0.46, 0.14, 0.4, 0, 0.0, 0, 0x4a6a88), B(0.3, 0.3, 0.3, 0, 0.6, 0, 0x8aaac8), B(0.12, 0.3, 0.1, -0.26, 0.3, 0.06, 0x6a8aa8, 0.6), B(0.12, 0.3, 0.1, 0.26, 0.3, 0.06, 0x6a8aa8, 0.6)]);
    m.material = this.mat; body.add(m);
    const eyes = mesh([B(0.06, 0.08, 0.02, -0.07, 0.66, 0.16, 0xaee8ff), B(0.06, 0.08, 0.02, 0.07, 0.66, 0.16, 0xaee8ff)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, eyes }; this.obj.add(root);
    this.fadeT = 0;
  }
  get grounded() { return false; }
  onHit(h) { if (this.state === 'faded') return null; return super.onHit(h); }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase':
        if (this.st > 2.5 && d < 7) { this.setState('faded'); sfx('inhale'); return [0, 0]; }
        if (d < 1.4 && this.takeToken()) { this.setState('windup'); sfx('windup'); return [0, 0]; }
        return this.chase(dt, 1.0, 0.8);
      case 'faded': {
        if (this.st > 1.2) {
          const a = p.facing + Math.PI;
          this.x = p.x + Math.sin(a) * 1.2; this.z = p.z + Math.cos(a) * 1.2; this.facing = this.angleTo(p);
          g.fx.burst(this.x, 0.6, this.z, 10, [0xaee8ff, 0x4a6a88], 2);
          if (this.takeToken()) this.setState('windup'); else this.setState('chase');
        }
        return [0, 0];
      }
      case 'windup':
        this.facing = angleLerp(this.facing, this.angleTo(p), dt * 8); this.telegraph(this.st);
        if (this.st > 0.45) { this.setState('attack'); this.m.eyes.visible = true; this.hitDone = false; g.fx.arc(this.x, 0.5, this.z, this.facing, 1.3, 2, 0xaee8ff, 0.15, 0.3); }
        return [0, 0];
      case 'attack':
        if (!this.hitDone && d < 1.4 + p.r && Math.abs(angDiff(this.facing, this.angleTo(p))) < 1.1) { p.hurt({ dmg: 2, x: this.x, z: this.z, src: this, kb: 6 }); this.hitDone = true; }
        if (this.st > 0.3) { this.setState('recover'); this.dropToken(); }
        return [0, 0];
      case 'recover': if (this.st > 0.8) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  animate(dt) {
    const t = this.g.time; this.obj.rotation.y = this.facing;
    this.m.body.position.y = 0.2 + Math.sin(t * 2.5 + this.home.z) * 0.08;
    const target = this.state === 'faded' ? 0.05 : 0.8;
    this.mat.opacity += (target - this.mat.opacity) * Math.min(1, dt * 8);
    this.m.eyes.visible = this.state !== 'faded' && (this.state !== 'windup' || Math.floor(this.st * 16) % 2 === 0);
  }
}

// ---------------------------------------------------------------- Hushbound Brigand — shield wall and spear lunge
class Brigand extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'brigand');
    this.hp = 6; this.speed = 2.0; this.r = 0.3; this.aggro = 8;
    this.loot = { pips: 8, chance: 1, heart: 0.25 }; this.surgeGain = 6;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.12, 0.2, 0.12, -0.08, 0, 0, 0x3a2a2a), B(0.12, 0.2, 0.12, 0.08, 0, 0, 0x3a2a2a), B(0.34, 0.3, 0.26, 0, 0.2, 0, 0x5a3a4a), B(0.36, 0.08, 0.28, 0, 0.3, 0, 0x2a1a2a),
      B(0.32, 0.28, 0.3, 0, 0.62, 0, 0xd8b090), B(0.4, 0.14, 0.36, 0, 0.8, 0, 0x2a1a2a), B(0.34, 0.06, 0.06, 0, 0.66, 0.16, 0x2a1a2a)]));
    const shield = mesh([B(0.08, 0.44, 0.36, -0.26, 0.2, 0.14, 0x6a5a4a), B(0.09, 0.14, 0.14, -0.27, 0.3, 0.14, 0x8b5cf6)]);
    const spear = mesh([B(0.04, 0.04, 1.1, 0.24, 0.34, 0.2, 0x6a4a2a), B(0.08, 0.06, 0.16, 0.24, 0.34, 0.8, 0xc0c0d0)]);
    body.add(shield, spear);
    const eyes = mesh([B(0.05, 0.04, 0.02, -0.07, 0.68, 0.16, 0xff5a8a), B(0.05, 0.04, 0.02, 0.07, 0.68, 0.16, 0xff5a8a)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, eyes, spear, shield }; this.obj.add(root);
  }
  modifyHit(h) {
    const heavy = h.kind === 'spin' || h.kind === 'surge' || h.kind === 'blast' || h.kind === 'power' || h.kind === 'dash';
    if (!heavy && this.state !== 'attack' && this.state !== 'recover' && Math.abs(angDiff(this.facing, h.dir + Math.PI)) < 1.0) return 'clang';
    return 1;
  }
  think(dt) {
    const p = this.p, d = this.dist(p);
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase':
        if (!this.playerVisible() && d > this.aggro + 3) { this.setState('idle'); return [0, 0]; }
        if (d < 2.6 && this.st > 0.9 && this.takeToken()) { this.setState('windup'); sfx('windup'); return [0, 0]; }
        if (d < 3) return this.circle(dt, 2.6);
        return this.chase(dt, 2.2);
      case 'windup':
        this.facing = angleLerp(this.facing, this.angleTo(p), dt * 6); this.telegraph(this.st);
        if (this.st > 0.6) { this.setState('attack'); this.m.eyes.visible = true; this.ldir = this.facing; this.hitDone = false; sfx('swing2'); }
        return [0, 0];
      case 'attack': {
        const hx = this.x + Math.sin(this.ldir) * 0.8, hz = this.z + Math.cos(this.ldir) * 0.8;
        if (!this.hitDone && Math.hypot(p.x - hx, p.z - hz) < 0.6 + p.r) { p.hurt({ dmg: 2, x: this.x, z: this.z, src: this, kb: 7 }); this.hitDone = true; }
        if (this.st > 0.28) { this.setState('recover'); this.dropToken(); }
        const s = 9 * (1 - this.st / 0.3);
        return [Math.sin(this.ldir) * s, Math.cos(this.ldir) * s];
      }
      case 'recover': if (this.st > 1.0) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  animate(dt, sp) {
    const m = this.m; this.obj.rotation.y = this.facing;
    this.walkT += dt * (3 + sp * 3);
    m.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.04 * Math.min(1, sp);
    m.spear.position.z = this.state === 'windup' ? -0.25 * Math.min(1, this.st / 0.6) : this.state === 'attack' ? 0.3 : 0;
    m.shield.rotation.y = this.state === 'recover' ? 0.8 : 0;
  }
}

// ---------------------------------------------------------------- Sporeling — swarm that bursts into a lingering cloud
class SporeCloud extends Entity {
  constructor(g, x, z) { super(g, x, z); this.t = 0; this.tick = 0; }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt; this.tick -= dt;
    for (let i = 0; i < 2; i++) g.fx.add({ x: this.x + (Math.random() - 0.5) * 2, y: 0.2 + Math.random() * 0.5, z: this.z + (Math.random() - 0.5) * 2, vy: 0.2, g: 0, color: Math.random() < 0.5 ? 0xb8e070 : 0x8aa04a, life: 0.6, size: 0.08 });
    if (this.tick <= 0 && Math.hypot(p.x - this.x, p.z - this.z) < 1.2) { this.tick = 0.7; p.takeDamage(0.4); p.speedMul = 0.6; setTimeout(() => p.speedMul = 1, 700); }
    if (this.t > 2.4) this.remove();
  }
}
class Sporeling extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'sporeling');
    this.hp = 1.5; this.speed = 2.8; this.r = 0.2; this.aggro = 8;
    this.loot = { pips: 1, chance: 0.5, heart: 0.1 }; this.surgeGain = 2;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.16, 0.18, 0.16, 0, 0, 0, 0xf0e6d0), B(0.36, 0.14, 0.36, 0, 0.18, 0, 0xa0c050), B(0.24, 0.08, 0.24, 0, 0.32, 0, 0xb8d860), B(0.06, 0.04, 0.06, 0.1, 0.33, 0.06, 0xffffff)]));
    const eyes = mesh([B(0.04, 0.04, 0.02, -0.04, 0.08, 0.09, 0x1b1426), B(0.04, 0.04, 0.02, 0.04, 0.08, 0.09, 0x1b1426)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, eyes }; this.obj.add(root);
  }
  think(dt) {
    const p = this.p, d = this.dist(p);
    if (this.state === 'idle') { if (this.playerVisible()) this.setState('chase'); return this.wander(dt); }
    if (this.state === 'windup') { this.telegraph(this.st); if (this.st > 0.35) { this.setState('attack'); this.m.eyes.visible = true; this.ldir = this.angleTo(p); this.hitDone = false; } return [0, 0]; }
    if (this.state === 'attack') { if (!this.hitDone && this.attackHit(0.35, 1)) this.hitDone = true; if (this.st > 0.25) { this.setState('recover'); this.dropToken(); } return [Math.sin(this.ldir) * 7, Math.cos(this.ldir) * 7]; }
    if (this.state === 'recover') { if (this.st > 0.5) this.setState('chase'); return [0, 0]; }
    if (d < 1.4 && this.takeToken()) { this.setState('windup'); return [0, 0]; }
    return this.chase(dt, 1.0);
  }
  die(h, how) { if (!how && !this.dead) { this.g.spawn(new SporeCloud(this.g, this.x, this.z)); sfx('poof'); } super.die(h, how); }
  animate(dt, sp) { this.obj.rotation.y = this.facing; this.walkT += dt * (6 + sp * 3); this.m.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.1; }
}

// ---------------------------------------------------------------- Barkhulk — a walking tree; stomps and sweeps
class Treant extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'treant');
    this.hp = 16; this.speed = 1.1; this.r = 0.55; this.aggro = 8; this.poise = true; this.gustMul = 0.2;
    this.loot = { pips: 20, chance: 1, heart: 0.5 }; this.surgeGain = 5; this.cool = 1;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.24, 0.5, 0.26, -0.2, 0, 0, 0x5a3e28), B(0.24, 0.5, 0.26, 0.2, 0, 0, 0x5a3e28), B(0.8, 0.8, 0.6, 0, 0.5, 0, 0x6a4a30), B(0.7, 0.2, 0.55, 0, 1.25, 0, 0x5a3e28),
      B(1.3, 0.6, 1.1, 0, 1.4, 0, 0x3f8f3a), B(0.9, 0.4, 0.8, 0.1, 1.95, -0.05, 0x4fa546), B(0.3, 0.2, 0.3, -0.4, 1.9, 0.3, 0xe05a48)]));
    const armL = new THREE.Group(); armL.position.set(-0.52, 1.0, 0); armL.add(mesh([B(0.22, 0.7, 0.22, 0, -0.6, 0, 0x6a4a30), B(0.3, 0.2, 0.3, 0, -0.7, 0, 0x4fa546)]));
    const armR = new THREE.Group(); armR.position.set(0.52, 1.0, 0); armR.add(mesh([B(0.22, 0.7, 0.22, 0, -0.6, 0, 0x6a4a30), B(0.3, 0.2, 0.3, 0, -0.7, 0, 0x4fa546)]));
    body.add(armL, armR);
    const eyes = mesh([B(0.1, 0.06, 0.02, -0.16, 0.9, 0.31, 0xffe08a), B(0.1, 0.06, 0.02, 0.16, 0.9, 0.31, 0xffe08a)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, eyes, armL, armR }; this.obj.add(root);
  }
  modifyHit() { return this.parried > 0 ? 2 : 1; }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    this.cool -= dt;
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase':
        if (!this.playerVisible() && d > this.aggro + 4) { this.setState('idle'); return [0, 0]; }
        if (d < 2.4 && this.cool <= 0 && this.takeToken()) { this.atk = Math.random() < 0.5 ? 'stomp' : 'sweep'; this.setState('windup'); sfx('windup'); if (this.atk === 'stomp') this.mk = marker(g, this.x, this.z, 2.6, 0x7fd36a); return [0, 0]; }
        return this.chase(dt, 1.6);
      case 'windup': {
        const wt = this.atk === 'stomp' ? 1.0 : 0.75;
        if (this.atk === 'sweep') this.facing = angleLerp(this.facing, this.angleTo(p), dt * 4);
        else if (this.mk) this.mk.position.set(this.x, 0.04, this.z);
        this.telegraph(this.st);
        if (this.st > wt) {
          this.setState('attack'); this.m.eyes.visible = true; unmark(this.mk);
          if (this.atk === 'stomp') { g.fx.ring(this.x, this.z, 0.4, 2.6, 0x7fd36a, 0.4); g.fx.dust(this.x, this.z, 14, 0x6a5a4a); g.pr.addShake(0.6); sfx('thud'); if (d < 2.6 + p.r) p.hurt({ dmg: 3, x: this.x, z: this.z, src: this, kb: 9 }); }
          else { g.fx.arc(this.x, 0.6, this.z, this.facing, 2.3, 2.6, 0x7fd36a, 0.2, 0.5); sfx('swing2'); if (d < 2.3 + p.r && Math.abs(angDiff(this.facing, this.angleTo(p))) < 1.3) p.hurt({ dmg: 2, x: this.x, z: this.z, src: this, kb: 8 }); }
        }
        return [0, 0];
      }
      case 'attack': if (this.st > 0.5) { this.setState('recover'); this.dropToken(); this.cool = 1.4 + Math.random(); } return [0, 0];
      case 'recover': if (this.st > 0.8) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  die(h, how) { unmark(this.mk); super.die(h, how); }
  animate(dt, sp) {
    const m = this.m; this.obj.rotation.y = this.facing;
    this.walkT += dt * (2 + sp * 2);
    m.body.rotation.z = Math.sin(this.walkT) * 0.05 * Math.min(1, sp);
    m.armL.rotation.x = 0; m.armR.rotation.x = 0; m.armR.rotation.z = 0;
    if (this.state === 'windup') { const k = Math.min(1, this.st / 0.8); if (this.atk === 'stomp') { m.body.position.y = k * 0.3; m.armL.rotation.x = -2 * k; m.armR.rotation.x = -2 * k; } else { m.armR.rotation.z = 1.5 * k; m.body.rotation.y = 0.6 * k; } }
    else { m.body.position.y = 0; m.body.rotation.y = this.state === 'attack' && this.atk === 'sweep' ? -0.8 : 0; }
  }
}

// ---------------------------------------------------------------- Stone Sentinel (golem) — slow, armoured, throws boulders
class Golem extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'golem');
    this.hp = 20; this.speed = 0.9; this.r = 0.6; this.aggro = 9; this.poise = true; this.gustMul = 0.1; this.dmgTaken = 0.8;
    this.loot = { pips: 30, chance: 1, heart: 0.6 }; this.surgeGain = 6; this.cool = 1.5;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.34, 0.4, 0.34, -0.26, 0, 0, 0x7a7a8a), B(0.34, 0.4, 0.34, 0.26, 0, 0, 0x7a7a8a), B(1.0, 0.8, 0.7, 0, 0.4, 0, 0x8a8a9a), B(0.6, 0.4, 0.5, 0, 1.2, 0.05, 0x9a9aa8),
      B(0.3, 0.2, 0.3, -0.3, 1.2, -0.1, 0x5aa04a), B(0.4, 0.1, 0.02, 0, 1.3, 0.31, 0x7ad8ff)]));
    const armL = new THREE.Group(); armL.position.set(-0.64, 1.0, 0); armL.add(mesh([B(0.34, 0.8, 0.34, 0, -0.5, 0, 0x7a7a8a)]));
    const armR = new THREE.Group(); armR.position.set(0.64, 1.0, 0); armR.add(mesh([B(0.34, 0.8, 0.34, 0, -0.5, 0, 0x7a7a8a)]));
    body.add(armL, armR);
    const eyes = mesh([B(0.4, 0.08, 0.03, 0, 1.3, 0.31, 0x7ad8ff)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, eyes, armL, armR }; this.obj.add(root);
  }
  think(dt) {
    const p = this.p, g = this.g, d = this.dist(p);
    this.cool -= dt;
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase':
        if (this.cool <= 0 && this.takeToken()) { this.atk = d < 2.6 ? 'smash' : 'throw'; this.setState('windup'); sfx('windup'); if (this.atk === 'smash') this.mk = marker(g, this.x + Math.sin(this.angleTo(p)) * 1.4, this.z + Math.cos(this.angleTo(p)) * 1.4, 1.8, 0x7ad8ff); return [0, 0]; }
        return this.chase(dt, 1.8);
      case 'windup':
        this.telegraph(this.st);
        if (this.st > 1.1) {
          this.setState('attack'); this.m.eyes.visible = true;
          if (this.atk === 'smash') { const mx = this.mk.position.x, mz = this.mk.position.z; unmark(this.mk); g.fx.ring(mx, mz, 0.3, 1.8, 0x7ad8ff, 0.4); g.pr.addShake(0.8); sfx('thud'); g.fx.dust(mx, mz, 16, 0x8a8a9a); if (Math.hypot(p.x - mx, p.z - mz) < 1.8 + p.r) p.hurt({ dmg: 3, x: mx, z: mz, src: this, kb: 10 }); }
          else { g.spawn(new Lob(g, this, this.x, this.z, p.x, p.z, { dmg: 3, radius: 1.3, rock: true, color: 0x9a9aa8, flight: 1.1 })); sfx('roar'); }
        }
        return [0, 0];
      case 'attack': if (this.st > 0.6) { this.setState('recover'); this.dropToken(); this.cool = 2 + Math.random(); } return [0, 0];
      case 'recover': if (this.st > 0.8) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  die(h, how) { unmark(this.mk); super.die(h, how); }
  animate(dt, sp) {
    const m = this.m; this.obj.rotation.y = this.facing;
    this.walkT += dt * (1.5 + sp * 2);
    m.body.rotation.z = Math.sin(this.walkT) * 0.06 * Math.min(1, sp);
    const k = this.state === 'windup' ? Math.min(1, this.st / 1.1) : 0;
    m.armL.rotation.x = -2.8 * k; m.armR.rotation.x = -2.8 * k;
    if (this.state === 'attack') { m.armL.rotation.x = -0.4; m.armR.rotation.x = -0.4; }
  }
}

// ---------------------------------------------------------------- Pip Thief — flees with a sack of treasure
class Thief extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'thief');
    this.hp = 7; this.speed = 4.3; this.r = 0.26; this.aggro = 10; this.life = 22;
    this.loot = { pips: 40, chance: 1, heart: 0 }; this.surgeGain = 3;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh([B(0.1, 0.16, 0.1, -0.07, 0, 0, 0x3a2a1a), B(0.1, 0.16, 0.1, 0.07, 0, 0, 0x3a2a1a), B(0.3, 0.26, 0.22, 0, 0.16, 0, 0x5a4a8a), B(0.3, 0.26, 0.26, 0, 0.44, 0, 0x8ab04a), B(0.34, 0.1, 0.3, 0, 0.6, 0, 0x2a1a2a),
      B(0.3, 0.34, 0.3, 0, 0.36, -0.28, 0xc8a060), B(0.12, 0.08, 0.12, 0, 0.56, -0.28, 0xa07a40), B(0.06, 0.06, 0.02, 0.06, 0.5, -0.43, 0xffd25e)]));
    const eyes = mesh([B(0.05, 0.05, 0.02, -0.07, 0.48, 0.14, 0xffd25e), B(0.05, 0.05, 0.02, 0.07, 0.48, 0.14, 0xffd25e)], MAT_GLOW, false); body.add(eyes);
    this.m = { root, body, eyes }; this.obj.add(root);
  }
  onHit(h) {
    const r = super.onHit(h);
    if (r === 'hit' && !this.dead) { dropPips(this.g, this.x, this.z, 3 + Math.floor(Math.random() * 6)); this.stagger = 0.1; }
    return r;
  }
  think(dt) {
    const p = this.p, g = this.g;
    this.life -= dt;
    if (this.life <= 0) { g.fx.burst(this.x, 0.5, this.z, 20, [0xffd25e, 0x8ab04a], 3); sfx('poof'); g.ui.toast('The Pip Thief escaped!', '', 1.5); this.remove(); return [0, 0]; }
    if (Math.random() < 0.15) g.fx.add({ x: this.x, y: 0.4, z: this.z, vy: 1, g: 4, color: 0xffd25e, life: 0.5, size: 0.05 });
    const d = this.dist(p);
    const a = this.angleTo(p) + Math.PI + Math.sin(g.time * 1.5 + this.home.x) * 0.8;
    this.facing = angleLerp(this.facing, a, dt * 6);
    return d < 9 ? [Math.sin(a) * this.speed, Math.cos(a) * this.speed] : [Math.sin(a) * 1.5, Math.cos(a) * 1.5];
  }
  die(h, how) {
    if (!this.dead && !how) { this.g.dropGear(this.x, this.z, { floor: 2, bonus: 0.8 }); this.g.dropGear(this.x, this.z, { floor: 1 }); this.g.ui.toast('You caught the Pip Thief!', 'Treasure spills everywhere!', 2); }
    super.die(h, how);
  }
  animate(dt, sp) { this.obj.rotation.y = this.facing; this.walkT += dt * (6 + sp * 3); this.m.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.08; }
}

Object.assign(EXTRA_ENEMIES, { scorpion: Scorpion, imp: Imp, wraith: Wraith, brigand: Brigand, sporeling: Sporeling, treant: Treant, golem: Golem, thief: Thief });
export const MONSTER_NAMES = { scorpion: 'Sand Scorpion', imp: 'Ember Imp', wraith: 'Mirewraith', brigand: 'Hushbound Brigand', sporeling: 'Sporeling', treant: 'Barkhulk', golem: 'Stone Sentinel', thief: 'Pip Thief' };

// Telegraph rings must never outlive the attack that drew them.
const _rm = Enemy.prototype.remove, _up = Enemy.prototype.update;
Enemy.prototype.remove = function () { unmark(this.mk); this.mk = null; _rm.call(this); };
Enemy.prototype.update = function (dt) { _up.call(this, dt); if (this.mk && this.state !== 'windup') { unmark(this.mk); this.mk = null; } };
