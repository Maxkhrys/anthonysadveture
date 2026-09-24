import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { makeBlot, makeBeetle, makePuffer, makeWisp, makeKnight, mesh, B, MAT_GLOW } from '../models.js';
import { sfx } from '../engine/audio.js';
import { angDiff, angleLerp, clamp } from '../engine/util.js';
import { flashObj, dropLoot } from './common.js';
import { T, isLiquid } from '../world/tiles.js';

const INK = [0x2a1a3a, 0x3e2856, 0x8b5cf6, 0x1b1024];

export class Enemy extends Entity {
  constructor(g, x, z, kind) {
    super(g, x, z);
    this.kind = kind; this.isEnemy = true;
    this.state = 'idle'; this.st = Math.random();
    this.kx = 0; this.kz = 0;
    this.home = { x, z };
    this.wanderT = 0; this.wx = x; this.wz = z;
    this.stagger = 0; this.poise = false;
    this.token = false;
    this.aggro = 7; this.speed = 2;
    this.loot = { pips: 1, chance: 0.7, heart: 0.15 };
    this.surgeGain = 4;
    this.spawnT = 0.35;
    this.obj.scale.setScalar(0.01);
    this.walkT = Math.random() * 10;
  }
  get p() { return this.g.player; }
  setState(s) { this.state = s; this.st = 0; }
  takeToken() {
    if (this.token) return true;
    if (this.g.tokens >= (this.g.bossActive ? 2 : 3)) return false;
    this.g.tokens++; this.token = true; return true;
  }
  dropToken() { if (this.token) { this.token = false; this.g.tokens = Math.max(0, this.g.tokens - 1); } }
  playerVisible() { const p = this.p; return p.state !== 'dead' && this.dist(p) < this.aggro && !this.g.cutscene; }

  // ----- damage
  onHit(h) {
    if (this.dead || this.spawnT > 0) return null;
    const g = this.g;
    let dmg = h.dmg;
    const r = this.modifyHit ? this.modifyHit(h) : 'hit';
    if (r === 'clang') {
      sfx('clang'); g.fx.sparks(this.x, 0.35, this.z, h.dir + Math.PI, 10);
      if (h.src && h.src.knock) h.src.knock(h.dir + Math.PI, 5);
      g.hitstop(0.05);
      return 'clang';
    }
    if (typeof r === 'number') dmg *= r;
    this.hp -= dmg;
    g.addSurge(this.surgeGain);
    flashObj(this.obj, 0.08);
    g.fx.burst(this.x, 0.35, this.z, 6, INK, 3, { life: 0.4 });
    g.fx.sparks(this.x, 0.35, this.z, h.dir, 5);
    const heavy = h.kind === 'spin' || h.kind === 'surge' || h.kind === 'spin3';
    sfx(heavy ? 'heavyhit' : 'hit');
    g.hitstop(heavy ? 0.07 : 0.045);
    g.pr.addShake(heavy ? 0.35 : 0.15);
    const kb = (h.kb ?? 4) * (this.poise && !heavy ? 0.15 : 1) * (this.kbMul ?? 1);
    this.kx = Math.sin(h.dir) * kb; this.kz = Math.cos(h.dir) * kb;
    if (!this.poise || heavy) { this.stagger = heavy ? 0.5 : 0.28; this.onStagger && this.onStagger(); this.dropToken(); if (this.state === 'windup' || this.state === 'attack') this.setState('recover'); }
    if (this.hp <= 0) this.die(h);
    return 'hit';
  }
  onGust(dirAng, power) {
    const kb = (power === 2 ? 9 : 6) * (this.gustMul ?? 1);
    this.kx = Math.sin(dirAng) * kb; this.kz = Math.cos(dirAng) * kb;
    this.stagger = Math.max(this.stagger, power === 2 ? 0.7 : 0.4);
    this.dropToken();
    if (this.state === 'windup' || this.state === 'attack') this.setState('recover');
  }
  die(h, how) {
    if (this.dead) return;
    const g = this.g;
    this.dropToken();
    sfx(how === 'splash' ? 'splash' : how === 'fall' ? 'fall' : 'enemydie');
    g.fx.burst(this.x, 0.4, this.z, 18, INK, 4.5, { life: 0.6 });
    g.fx.burst(this.x, 0.4, this.z, 6, 0xfff3b0, 3, { life: 0.4, size: 0.06 });
    g.fx.ring(this.x, this.z, 0.2, 1.2, 0x8b5cf6, 0.35);
    if (!how) dropLoot(g, this.x, this.z, this.loot);
    g.stats.kills = (g.stats.kills || 0) + 1;
    this.remove();
    g.onEnemyDeath(this);
  }
  onParried() { this.stagger = 1.2; this.dropToken(); this.setState('recover'); this.parried = 1.4; flashObj(this.obj, 0.15, 0xfff3b0); }

  update(dt) {
    const g = this.g;
    this.st += dt;
    if (this.spawnT > 0) { this.spawnT -= dt; this.obj.scale.setScalar(Math.max(0.01, 1 - this.spawnT / 0.35)); if (this.spawnT <= 0) this.obj.scale.setScalar(1); }
    this.stagger = Math.max(0, this.stagger - dt);
    this.parried = Math.max(0, (this.parried || 0) - dt);
    let vx = 0, vz = 0;
    if (this.stagger <= 0 && !g.cutscene) { const v = this.think(dt) || [0, 0]; vx = v[0]; vz = v[1]; }
    const knocked = Math.abs(this.kx) + Math.abs(this.kz) > 0.3;
    if (this.moveMode !== 'fly') this.moveMode = knocked ? 'knock' : 'walk';
    vx += this.kx; vz += this.kz;
    const d = Math.exp(-dt * 7); this.kx *= d; this.kz *= d;
    const hit = move(g, this, vx * dt, vz * dt);
    if (hit && this.onWall && knocked) this.onWall();
    if (this.moveMode !== 'fly' || this.grounded) {
      const t = g.tileAt(Math.floor(this.x), Math.floor(this.z));
      if (t === T.PIT) { const fx = this.x % 1, fz = this.z % 1; if (fx > 0.15 && fx < 0.85 && fz > 0.15 && fz < 0.85) return this.die(null, 'fall'); }
      if (isLiquid(t)) return this.die(null, 'splash');
    }
    this.animate(dt, Math.hypot(vx, vz));
    this.sync();
  }
  // wander around home, chase when player visible
  chase(dt, stopDist, speedMul = 1) {
    const p = this.p;
    const a = this.angleTo(p);
    this.facing = angleLerp(this.facing, a, Math.min(1, dt * 8));
    const dd = this.dist(p);
    if (dd > stopDist) return [Math.sin(a) * this.speed * speedMul, Math.cos(a) * this.speed * speedMul];
    return [0, 0];
  }
  circle(dt, radius) {
    const p = this.p;
    const a = this.angleTo(p);
    const dd = this.dist(p);
    this.orbit = this.orbit ?? (Math.random() < 0.5 ? 1 : -1);
    const tang = a + Math.PI / 2 * this.orbit;
    const radial = clamp((dd - radius) * 1.5, -1, 1);
    this.facing = angleLerp(this.facing, a, Math.min(1, dt * 8));
    return [(Math.sin(tang) * 0.8 + Math.sin(a) * radial) * this.speed * 0.6, (Math.cos(tang) * 0.8 + Math.cos(a) * radial) * this.speed * 0.6];
  }
  wander(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 1.5 + Math.random() * 2.5;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 2.5;
      this.wx = this.home.x + Math.cos(a) * r; this.wz = this.home.z + Math.sin(a) * r;
    }
    const dx = this.wx - this.x, dz = this.wz - this.z, l = Math.hypot(dx, dz);
    if (l < 0.2) return [0, 0];
    const a = Math.atan2(dx, dz);
    this.facing = angleLerp(this.facing, a, Math.min(1, dt * 5));
    return [dx / l * this.speed * 0.4, dz / l * this.speed * 0.4];
  }
  attackHit(radius, dmg, fx, fz, opts = {}) {
    const p = this.p;
    const hx = fx ?? this.x, hz = fz ?? this.z;
    if (Math.hypot(p.x - hx, p.z - hz) < radius + p.r) {
      return p.hurt({ dmg, x: this.x, z: this.z, src: this, ...opts });
    }
    return false;
  }
  telegraph(t) {
    // eyes flash red during windup
    if (this.m.eyes) this.m.eyes.visible = Math.floor(t * 16) % 2 === 0;
  }
  animate() {}
}

// -------------------------------------------------- Blotling
export class Blot extends Enemy {
  constructor(g, x, z, opts = {}) {
    super(g, x, z, 'blot');
    this.m = makeBlot(); this.obj.add(this.m.root);
    this.hp = opts.hp ?? 2; this.speed = 2.3; this.r = 0.26;
    if (opts.seedling) { this.m.root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.material = o.material.clone(); o.material.color = new THREE.Color(0x7fd36a); } }); this.loot = { pips: 1, chance: 0.5, heart: 0.3 }; }
    this.aggro = opts.aggro ?? 7.5;
  }
  think(dt) {
    const p = this.p;
    switch (this.state) {
      case 'idle':
        if (this.playerVisible()) this.setState('chase');
        return this.wander(dt);
      case 'chase': {
        if (!this.playerVisible() && this.dist(p) > this.aggro + 3) { this.dropToken(); this.setState('idle'); return [0, 0]; }
        const d = this.dist(p);
        if (d < 2.0 && this.takeToken()) { this.setState('windup'); sfx('windup'); return [0, 0]; }
        if (d < 3.2 && !this.token) return this.circle(dt, 2.8);
        return this.chase(dt, 1.2);
      }
      case 'windup':
        this.facing = angleLerp(this.facing, this.angleTo(p), Math.min(1, dt * 10));
        this.telegraph(this.st);
        if (this.st > 0.5) { this.setState('attack'); this.ldir = this.facing; this.m.eyes.visible = true; }
        return [0, 0];
      case 'attack': {
        if (this.st > 0.08 && this.st < 0.3 && !this.hitDone) { if (this.attackHit(0.45, 1)) this.hitDone = true; }
        if (this.st > 0.32) { this.setState('recover'); this.hitDone = false; this.dropToken(); }
        const s = 7.5 * (1 - this.st / 0.35);
        return [Math.sin(this.ldir) * s, Math.cos(this.ldir) * s];
      }
      case 'recover':
        if (this.m.eyes) this.m.eyes.visible = true;
        if (this.st > 0.7) this.setState('chase');
        return [0, 0];
    }
    return [0, 0];
  }
  animate(dt, sp) {
    const b = this.m.body, t = this.g.time;
    this.obj.rotation.y = this.facing;
    this.walkT += dt * (3 + sp * 3);
    let sx = 1, sy = 1;
    if (this.state === 'windup') { const k = Math.min(1, this.st / 0.5); sy = 1 - k * 0.35; sx = 1 + k * 0.25; b.position.x = Math.sin(t * 50) * 0.02; }
    else if (this.state === 'attack') { sy = 1.3; sx = 0.8; b.position.y = Math.sin(Math.min(1, this.st / 0.32) * Math.PI) * 0.35; }
    else { const h = Math.abs(Math.sin(this.walkT)); sy = 1 + h * 0.12 - 0.06; sx = 1 - h * 0.06; b.position.y = h * 0.08 * Math.min(1, sp); b.position.x = 0; }
    if (this.stagger > 0) { sy = 0.8; sx = 1.2; }
    b.scale.set(sx, sy, sx);
  }
}

// -------------------------------------------------- Thornback beetle
export class Beetle extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'beetle');
    this.m = makeBeetle(); this.obj.add(this.m.root);
    this.hp = 5; this.speed = 1.5; this.r = 0.34; this.aggro = 7;
    this.flipped = 0;
    this.loot = { pips: 5, chance: 0.9, heart: 0.2 };
    this.surgeGain = 6;
  }
  modifyHit(h) {
    if (this.flipped > 0) return 2;
    const heavy = h.kind === 'spin' || h.kind === 'surge' || h.kind === 'pod';
    const front = Math.abs(angDiff(this.facing, h.dir + Math.PI)) < 1.2;
    if (front && !heavy) return 'clang';
    return 1;
  }
  flip(t = 3.2) {
    this.flipped = t; this.dropToken(); this.setState('flipped');
    sfx('thud'); this.g.fx.dust(this.x, this.z, 8);
  }
  onGust(dir, power) { super.onGust(dir, power); this.flip(power === 2 ? 4 : 3.2); }
  think(dt) {
    const p = this.p;
    if (this.flipped > 0) { this.flipped -= dt; if (this.flipped <= 0) { this.setState('chase'); this.g.fx.dust(this.x, this.z, 6); } return [0, 0]; }
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase': {
        const d = this.dist(p);
        if (!this.playerVisible() && d > this.aggro + 3) { this.setState('idle'); return [0, 0]; }
        if (d < 5 && this.st > 1 && Math.abs(angDiff(this.facing, this.angleTo(p))) < 0.3 && this.takeToken()) { this.setState('windup'); sfx('windup'); return [0, 0]; }
        return this.chase(dt, 1.0);
      }
      case 'windup':
        this.facing = angleLerp(this.facing, this.angleTo(p), Math.min(1, dt * 4));
        this.telegraph(this.st);
        if (Math.random() < 0.3) this.g.fx.dust(this.x - Math.sin(this.facing) * 0.3, this.z - Math.cos(this.facing) * 0.3, 1);
        if (this.st > 0.75) { this.setState('attack'); this.ldir = this.facing; this.m.eyes.visible = true; this.hitDone = false; }
        return [0, 0];
      case 'attack': {
        if (!this.hitDone && this.attackHit(0.4, 2, undefined, undefined, { kb: 8 })) this.hitDone = true;
        if (this.st > 1.3) { this.setState('recover'); this.dropToken(); }
        if (Math.random() < 0.5) this.g.fx.dust(this.x, this.z, 1);
        return [Math.sin(this.ldir) * 7, Math.cos(this.ldir) * 7];
      }
      case 'recover': if (this.st > 0.9) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  onWall() {}
  update(dt) {
    const ox = this.x, oz = this.z;
    super.update(dt);
    if (this.state === 'attack' && this.st > 0.1 && Math.hypot(this.x - ox, this.z - oz) < dt * 2) { this.dropToken(); this.flip(2.6); this.g.pr.addShake(0.3); sfx('clang'); }
  }
  animate(dt, sp) {
    const b = this.m.body;
    this.obj.rotation.y = this.facing;
    this.walkT += dt * (4 + sp * 5);
    b.rotation.set(0, 0, 0); b.position.set(0, 0, 0);
    if (this.flipped > 0) { b.rotation.z = Math.PI; b.position.y = 0.62; b.rotation.x = Math.sin(this.g.time * 20) * 0.08; }
    else { b.position.y = Math.abs(Math.sin(this.walkT)) * 0.03; if (this.state === 'windup') b.rotation.x = -0.15; }
  }
}

// -------------------------------------------------- Spore puffer + projectile
export class Spore extends Entity {
  constructor(g, x, z, dir, speed = 5, friendly = false, from = null) {
    super(g, x, z);
    this.r = 0.15; this.dir = dir; this.speed = speed; this.friendly = friendly; this.from = from;
    this.life = 3.5; this.y = 0.4; this.moveMode = 'fly'; this.isProjectile = true;
    this.m = mesh([B(0.2, 0.2, 0.2, 0, -0.1, 0, 0xc89aff), B(0.12, 0.12, 0.22, 0, -0.06, 0, 0xe8d0ff)], MAT_GLOW, false);
    this.obj.add(this.m);
    this.attach();
  }
  reflect(dir, speed = 9) { this.dir = dir; this.speed = speed; this.friendly = true; this.life = 2.5; sfx('parry'); this.g.fx.sparks(this.x, 0.4, this.z, dir, 6, 0xe8d0ff); this.m.scale.setScalar(1.3); }
  onHit(h) { if (this.friendly) return null; this.reflect(h.dir); return 'hit'; }
  onGust(dir) { this.reflect(dir, 10); }
  update(dt) {
    const g = this.g;
    this.life -= dt;
    const hit = move(g, this, Math.sin(this.dir) * this.speed * dt, Math.cos(this.dir) * this.speed * dt);
    this.m.rotation.y += dt * 10; this.m.rotation.x += dt * 7;
    if (Math.random() < 0.5) g.fx.add({ x: this.x, y: this.y, z: this.z, color: this.friendly ? 0xfff3b0 : 0xb88ae0, life: 0.3, size: 0.05, g: 0 });
    if (hit || this.life <= 0) return this.pop();
    if (!this.friendly) {
      const p = g.player;
      if (Math.hypot(p.x - this.x, p.z - this.z) < p.r + this.r) {
        const r = p.hurt({ dmg: 1, x: this.x - Math.sin(this.dir), z: this.z - Math.cos(this.dir), src: this, kb: 4 });
        if (r === 'parry') { this.reflect(Math.atan2(this.x - p.x, this.z - p.z)); return; }
        return this.pop();
      }
    } else {
      for (const e of g.entities) {
        if (!e.isEnemy || e.dead || e === this.from && this.life > 2.3) continue;
        if (Math.hypot(e.x - this.x, e.z - this.z) < (e.r ?? 0.3) + this.r + 0.1) {
          e.onHit({ dmg: 3, dir: this.dir, kind: 'pod', kb: 6, src: this });
          return this.pop();
        }
      }
    }
    this.sync();
  }
  pop() { this.g.fx.burst(this.x, this.y, this.z, 8, [0xc89aff, 0xe8d0ff], 2, { life: 0.35 }); sfx('poof'); this.remove(); }
}

export class Puffer extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'puffer');
    this.m = makePuffer(); this.obj.add(this.m.root);
    this.hp = 3; this.speed = 1.6; this.r = 0.3; this.aggro = 8;
    this.cool = 1 + Math.random();
    this.loot = { pips: 3, chance: 0.9, heart: 0.2 };
  }
  think(dt) {
    const p = this.p;
    const d = this.dist(p);
    this.cool -= dt;
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('aim'); return this.wander(dt);
      case 'aim': {
        if (!this.playerVisible()) { this.setState('idle'); return [0, 0]; }
        this.facing = angleLerp(this.facing, this.angleTo(p), Math.min(1, dt * 6));
        if (this.cool <= 0 && d < 8) { this.setState('windup'); return [0, 0]; }
        if (d < 3) { const a = this.angleTo(p) + Math.PI; return [Math.sin(a) * this.speed, Math.cos(a) * this.speed]; }
        return [0, 0];
      }
      case 'windup':
        this.facing = angleLerp(this.facing, this.angleTo(p), Math.min(1, dt * 6));
        this.telegraph(this.st);
        if (this.st > 0.7) {
          this.m.eyes.visible = true;
          sfx('shoot');
          this.g.spawn(new Spore(this.g, this.x + Math.sin(this.facing) * 0.4, this.z + Math.cos(this.facing) * 0.4, this.facing, 5, false, this));
          this.cool = 2.4 + Math.random(); this.setState('aim');
        }
        return [0, 0];
      case 'recover': if (this.st > 0.5) this.setState('aim'); return [0, 0];
    }
    return [0, 0];
  }
  animate(dt) {
    this.obj.rotation.y = this.facing;
    const s = this.state === 'windup' ? 1 + Math.min(1, this.st / 0.7) * 0.35 : 1 + Math.sin(this.g.time * 3 + this.home.x) * 0.04;
    this.m.sac.scale.set(s, s * (this.state === 'windup' ? 1 : 1), s);
  }
}

// -------------------------------------------------- Wisp (flying)
export class Wisp extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'wisp');
    this.m = makeWisp(); this.obj.add(this.m.root);
    this.hp = 1; this.speed = 3; this.r = 0.24; this.moveMode = 'fly'; this.aggro = 7;
    this.downed = 0; this.alt = 1.0;
    this.loot = { pips: 2, chance: 0.8, heart: 0.2 };
  }
  get grounded() { return this.downed > 0; }
  onGust(dir, power) {
    super.onGust(dir, power);
    this.downed = power === 2 ? 4 : 3; this.moveMode = 'knock'; this.setState('downed'); sfx('thud');
  }
  think(dt) {
    const p = this.p, t = this.g.time;
    if (this.downed > 0) {
      this.downed -= dt; this.alt = Math.max(0.15, this.alt - dt * 4);
      if (this.downed <= 0) { this.moveMode = 'fly'; this.setState('hover'); }
      return [0, 0];
    }
    this.alt += ((this.state === 'attack' ? 0.35 : 1.0 + Math.sin(t * 3 + this.home.z) * 0.15) - this.alt) * Math.min(1, dt * 6);
    switch (this.state) {
      case 'idle': case 'hover': {
        if (this.playerVisible()) {
          const d = this.dist(p);
          if (d < 3.5 && this.st > 1.2 && this.takeToken()) { this.setState('windup'); sfx('windup'); return [0, 0]; }
          const a = this.angleTo(p) + Math.sin(t * 1.3 + this.home.x) * 1.6;
          this.facing = angleLerp(this.facing, this.angleTo(p), dt * 5);
          const dd = d > 2.6 ? 1 : -0.6;
          return [Math.sin(a) * this.speed * dd, Math.cos(a) * this.speed * dd];
        }
        return this.wander(dt);
      }
      case 'windup':
        this.alt += dt * 1.2; this.telegraph(this.st);
        this.facing = angleLerp(this.facing, this.angleTo(p), dt * 10);
        if (this.st > 0.45) { this.setState('attack'); this.ldir = this.angleTo(p); this.m.eyes.visible = true; this.hitDone = false; }
        return [0, 0];
      case 'attack':
        if (!this.hitDone && this.attackHit(0.35, 1)) this.hitDone = true;
        if (this.st > 0.55) { this.setState('hover'); this.dropToken(); }
        return [Math.sin(this.ldir) * 7, Math.cos(this.ldir) * 7];
      case 'recover': if (this.st > 0.4) this.setState('hover'); return [0, 0];
    }
    return [0, 0];
  }
  animate(dt) {
    const t = this.g.time;
    this.obj.rotation.y = this.facing;
    this.m.body.position.y = this.alt;
    const flap = this.downed > 0 ? Math.sin(t * 8) * 0.2 : Math.sin(t * 28) * 0.8;
    this.m.wingL.rotation.z = flap; this.m.wingR.rotation.z = -flap;
    this.m.body.rotation.z = this.downed > 0 ? 0.6 : 0;
  }
}

// -------------------------------------------------- Hush Knight (heavy)
export class Knight extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'knight');
    this.m = makeKnight(); this.obj.add(this.m.root);
    this.hp = 12; this.maxHp = 12; this.speed = 1.5; this.r = 0.4; this.aggro = 8;
    this.poise = true; this.gustMul = 0.35;
    this.loot = { pips: 20, chance: 1, heart: 0.6 };
    this.surgeGain = 5;
    this.cool = 1;
  }
  modifyHit() { return this.parried > 0 ? 2 : 1; }
  onGust(dir, power) { super.onGust(dir, power); if (power === 2) { this.stagger = 1.0; } else this.stagger = 0; }
  think(dt) {
    const p = this.p;
    const d = this.dist(p);
    this.cool -= dt;
    switch (this.state) {
      case 'idle': if (this.playerVisible()) this.setState('chase'); return this.wander(dt);
      case 'chase': {
        if (!this.playerVisible() && d > this.aggro + 4) { this.setState('idle'); return [0, 0]; }
        if (d < 2.0 && this.cool <= 0 && this.takeToken()) { this.atk = Math.random() < 0.55 ? 'sweep' : 'slam'; this.setState('windup'); sfx('windup'); return [0, 0]; }
        return this.chase(dt, 1.3);
      }
      case 'windup': {
        const wt = this.atk === 'slam' ? 0.95 : 0.7;
        if (this.st < wt * 0.7) this.facing = angleLerp(this.facing, this.angleTo(p), Math.min(1, dt * 5));
        this.telegraph(this.st);
        if (this.st > wt * 0.6 && Math.random() < 0.6) this.g.fx.add({ x: this.x + Math.sin(this.facing + 0.6) * 0.5, y: 1.2, z: this.z + Math.cos(this.facing + 0.6) * 0.5, color: 0xff5a8a, g: 0, life: 0.2, size: 0.07 });
        if (this.st > wt) { this.setState('attack'); this.m.eyes.visible = true; this.hitDone = false; sfx(this.atk === 'slam' ? 'thud' : 'swing2'); }
        return [0, 0];
      }
      case 'attack': {
        if (this.atk === 'sweep') {
          if (this.st < 0.02) this.g.fx.arc(this.x, 0.5, this.z, this.facing, 1.9, 2.4, 0xff5a8a, 0.18, 0.4);
          if (!this.hitDone && this.st < 0.15) {
            const a = this.angleTo(p);
            if (d < 1.9 + p.r && Math.abs(angDiff(this.facing, a)) < 1.2) { p.hurt({ dmg: 2, x: this.x, z: this.z, src: this, kb: 7 }); this.hitDone = true; }
          }
        } else {
          if (this.st < 0.02) {
            const fx = this.x + Math.sin(this.facing) * 1.1, fz = this.z + Math.cos(this.facing) * 1.1;
            this.g.fx.ring(fx, fz, 0.3, 2.0, 0xff5a8a, 0.35); this.g.pr.addShake(0.5); this.g.fx.dust(fx, fz, 10);
            if (Math.hypot(p.x - fx, p.z - fz) < 1.8 + p.r) p.hurt({ dmg: 2, x: fx, z: fz, src: this, kb: 8 });
          }
        }
        if (this.st > 0.45) { this.setState('recover'); this.dropToken(); this.cool = 1.2 + Math.random(); }
        return [0, 0];
      }
      case 'recover': if (this.st > 0.8) this.setState('chase'); return [0, 0];
    }
    return [0, 0];
  }
  animate(dt, sp) {
    const m = this.m;
    this.obj.rotation.y = this.facing;
    this.walkT += dt * (2 + sp * 2.5);
    const sw = Math.sin(this.walkT) * Math.min(1, sp);
    m.legL.rotation.x = sw * 0.6; m.legR.rotation.x = -sw * 0.6;
    m.armR.rotation.set(0, 0, 0); m.body.rotation.set(0, 0, 0);
    m.blade.rotation.set(1.3, 0, 0);
    if (this.state === 'windup') {
      const k = Math.min(1, this.st / (this.atk === 'slam' ? 0.95 : 0.7));
      if (this.atk === 'slam') { m.armR.rotation.x = -3.0 * k; m.body.rotation.x = -0.2 * k; }
      else { m.armR.rotation.x = -1.5 * k; m.body.rotation.y = 1.0 * k; m.armR.rotation.z = 0.8 * k; }
    } else if (this.state === 'attack') {
      if (this.atk === 'slam') { m.armR.rotation.x = -0.8; m.body.rotation.x = 0.35; }
      else { m.armR.rotation.x = -1.5; m.body.rotation.y = -1.2; m.armR.rotation.z = 0.8; }
    }
    if (this.stagger > 0.3) m.body.rotation.x = -0.3;
    if (this.parried > 0) m.head.rotation.z = Math.sin(this.g.time * 20) * 0.1;
  }
}

export function makeEnemy(g, kind, x, z, opts) {
  switch (kind) {
    case 'blot': return new Blot(g, x, z, opts);
    case 'seedling': return new Blot(g, x, z, { seedling: true, hp: 1, aggro: 20 });
    case 'beetle': return new Beetle(g, x, z);
    case 'puffer': return new Puffer(g, x, z);
    case 'wisp': return new Wisp(g, x, z);
    case 'knight': return new Knight(g, x, z);
  }
}
