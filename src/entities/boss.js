// Bramblemaw, the Choking Root — guardian of the Verdant Chime.
// Its bulb is armoured. It can only be hurt after it is made to choke:
//   * gust into its mouth while it inhales, or
//   * send one of its own spore pods back into it (sword or gust), or let an inhale swallow a pod.
import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { makeBoss, mesh, B, MAT_GLOW, MAT } from '../models.js';
import { sfx, playMusic } from '../engine/audio.js';
import { angDiff, clamp } from '../engine/util.js';
import { flashObj } from './common.js';
import { makeEnemy } from './enemies.js';

class Pod extends Entity {
  constructor(g, boss, x, z, tx, tz) {
    super(g, x, z);
    this.boss = boss; this.r = 0.25; this.moveMode = 'fly';
    this.sx = x; this.sz = z; this.tx = tx; this.tz = tz;
    this.state = 'fly'; this.t = 0; this.flight = 0.9;
    this.m = mesh([B(0.4, 0.36, 0.4, 0, -0.18, 0, 0x8a4ab0), B(0.3, 0.1, 0.3, 0, 0.18, 0, 0xb87ae0), B(0.1, 0.1, 0.1, 0, 0.26, 0, 0x4a8a3a)]);
    this.obj.add(this.m);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.9, 20), new THREE.MeshBasicMaterial({ color: 0xff5a8a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.set(tx, 0.04, tz);
    g.world.add(this.marker);
    this.attach();
  }
  onHit(h) { if (this.state === 'fly') return null; this.launch(h.dir); return 'hit'; }
  onGust(dir) { if (this.state !== 'fly') this.launch(dir, 11); }
  launch(dir, sp = 9) { this.state = 'launched'; this.dir = dir; this.sp = sp; this.t = 0; sfx('parry'); this.g.fx.sparks(this.x, 0.3, this.z, dir, 8, 0xe8d0ff); }
  explode(hurtPlayer = true) {
    const g = this.g;
    if (this.dead) return;
    g.fx.burst(this.x, 0.3, this.z, 20, [0x8a4ab0, 0xc89aff, 0x2a1a3a], 4, { life: 0.5 });
    g.fx.ring(this.x, this.z, 0.2, 1.3, 0xc89aff, 0.3);
    sfx('poof'); g.pr.addShake(0.25);
    if (hurtPlayer) { const p = g.player; if (Math.hypot(p.x - this.x, p.z - this.z) < 1.1 + p.r) p.hurt({ dmg: 2, x: this.x, z: this.z, src: this, kb: 7 }); }
    this.marker.parent && this.marker.parent.remove(this.marker);
    this.remove();
  }
  update(dt) {
    const g = this.g;
    this.t += dt;
    if (this.state === 'fly') {
      const k = Math.min(1, this.t / this.flight);
      this.x = this.sx + (this.tx - this.sx) * k; this.z = this.sz + (this.tz - this.sz) * k;
      this.y = Math.sin(k * Math.PI) * 3.2 + 0.2;
      this.marker.scale.setScalar(0.4 + k * 0.6);
      if (k >= 1) { this.state = 'ground'; this.t = 0; this.y = 0.2; sfx('thud'); g.fx.dust(this.x, this.z, 6); const p = g.player; if (Math.hypot(p.x - this.x, p.z - this.z) < 0.7) p.hurt({ dmg: 1, x: this.x, z: this.z, src: this }); }
    } else if (this.state === 'ground') {
      this.marker.material.opacity = 0.25 + Math.sin(this.t * 20) * 0.2 * (this.t > 1.1 ? 1 : 0.3);
      this.m.scale.setScalar(1 + (this.t > 1.1 ? Math.sin(this.t * 40) * 0.1 : 0));
      // inhale drags pods in
      if (this.boss.state === 'inhale') {
        const a = Math.atan2(this.boss.x - this.x, this.boss.mz - this.z);
        move(g, this, Math.sin(a) * 2.5 * dt, Math.cos(a) * 2.5 * dt);
        if (Math.hypot(this.boss.x - this.x, this.boss.mz - this.z) < 0.9) { this.boss.choke('pod'); return this.explode(false); }
      }
      if (this.t > 1.8) return this.explode();
    } else if (this.state === 'launched') {
      const hit = move(g, this, Math.sin(this.dir) * this.sp * dt, Math.cos(this.dir) * this.sp * dt);
      this.y = 0.3;
      this.marker.visible = false;
      const b = this.boss;
      if (Math.hypot(b.x - this.x, b.z - this.z) < 1.5) { b.choke('pod'); return this.explode(false); }
      for (const e of g.entities) if (e.isEnemy && !e.dead && e !== b && Math.hypot(e.x - this.x, e.z - this.z) < 0.5) { g.playerHit(e, { mult: 2.5, dir: this.dir, kind: 'pod', kb: 6, noProc: true }); return this.explode(false); }
      if (hit || this.t > 1.5) return this.explode(false);
    }
    this.m.rotation.y += dt * 3;
    this.sync();
  }
  remove() { super.remove(); if (this.marker.parent) this.marker.parent.remove(this.marker); }
}

class RootSpike extends Entity {
  constructor(g, x, z, delay) {
    super(g, x, z);
    this.t = -delay;
    this.m = mesh([B(0.3, 1.0, 0.3, 0, 0, 0, 0x3a6a2a), B(0.18, 0.4, 0.18, 0, 1.0, 0, 0x5a8a3a), B(0.12, 0.2, 0.12, 0.1, 1.2, 0, 0xe8d8a0), B(0.5, 0.2, 0.5, 0, 0, 0, 0x2a4a1a)]);
    this.m.position.y = -1.3;
    this.obj.add(this.m);
    this.crack = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0x1a0a10, transparent: true, opacity: 0, depthWrite: false }));
    this.crack.rotation.x = -Math.PI / 2; this.crack.position.y = 0.03;
    this.obj.add(this.crack);
    this.attach();
  }
  update(dt) {
    const g = this.g;
    this.t += dt;
    if (this.t < 0) return;
    if (this.t < 0.6) { this.crack.material.opacity = this.t / 0.6 * 0.7; if (Math.random() < 0.4) g.fx.dust(this.x, this.z, 1, 0x6a5a4a); }
    else if (this.t < 0.75) {
      if (!this.burst) { this.burst = true; sfx('thud'); g.fx.dust(this.x, this.z, 8, 0x6a5a4a); g.pr.addShake(0.15); const p = g.player; if (Math.hypot(p.x - this.x, p.z - this.z) < 0.6 + p.r) p.hurt({ dmg: 2, x: this.x, z: this.z, src: this, kb: 7, unblockable: false }); }
      this.m.position.y = -1.3 + (this.t - 0.6) / 0.15 * 1.3;
    } else if (this.t < 1.5) this.m.position.y = 0;
    else { this.m.position.y -= dt * 4; this.crack.material.opacity *= 0.9; if (this.t > 2) this.remove(); }
  }
}

export class Boss extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.isEnemy = true; this.isBoss = true;
    this.m = makeBoss(); this.obj.add(this.m.root);
    this.r = 1.1; this.solid = true; this.hw = 1.0; this.hd = 0.9;
    this.level = 5; this.hp = this.maxHp = Math.round(12 * 6 * (1 + 0.3 * 4) * 0.75);
    this.state = 'intro'; this.st = 0;
    this.facing = 0;
    this.cycle = 0; this.stunHits = 0;
    this.mz = z + 1.0; // mouth position
    this.name = 'BRAMBLEMAW';
    this.attach();
  }
  get p() { return this.g.player; }
  setState(s) { this.state = s; this.st = 0; }
  choke(how) {
    if (this.state === 'stunned' || this.state === 'dying' || this.state === 'dead') return;
    const g = this.g;
    sfx('roar'); g.pr.addShake(0.8); g.hitstop(0.12);
    g.fx.burst(this.x, 1.2, this.z + 0.8, 24, [0x8a4ab0, 0xc89aff, 0x7fd36a], 5);
    this.setState('stunned'); this.stunHits = 0;
    g.ui.toast(how === 'gust' ? 'It choked on the wind!' : 'It swallowed its own spores!', '', 1.6);
  }
  onGust(dir, power) {
    if (this.state === 'inhale' && this.st > 0.3) {
      const p = this.p;
      // gust must come from roughly in front of the mouth
      if (p.z > this.z) return this.choke('gust');
    }
    if (this.state !== 'stunned') { sfx('clang'); this.g.fx.sparks(this.x, 1, this.z + 0.9, dir + Math.PI, 6); }
  }
  onHit(h) {
    if (this.state === 'dying' || this.state === 'dead' || this.state === 'intro') return null;
    const g = this.g;
    if (this.state !== 'stunned' && h.kind !== 'surge') {
      sfx('clang'); g.fx.sparks(this.x - Math.sin(h.dir) * 1, 0.6, this.z - Math.cos(h.dir) * 1, h.dir + Math.PI, 10);
      if (h.src && h.src.knock) h.src.knock(h.dir + Math.PI, 5);
      if (!this.hintShown) { this.hintShown = true; g.ui.toast('Its hide is too thick…', 'Watch its mouth.', 2.2); }
      return 'clang';
    }
    const dmg = h.kind === 'surge' && this.state !== 'stunned' ? 1 : h.dmg;
    this.hp -= dmg; this.stunHits++;
    flashObj(this.obj, 0.08*(g.settings?.hitFlash??1)); sfx('heavyhit'); g.hitstop(0.08); g.pr.addShake(0.4);
    g.fx.burst(this.x, 0.9, this.z + 0.9, 12, [0xff7ab0, 0x7fd36a, 0xffffff], 4);
    g.addSurge(3);
    g.ui.bossBar(this.name, this.hp / this.maxHp);
    if (this.hp <= 0) { this.setState('dying'); g.onBossDying(this); }
    return 'hit';
  }
  update(dt) {
    const g = this.g, p = this.p, m = this.m, t = g.time;
    this.st += dt;
    const phase2 = this.hp <= this.maxHp / 2;
    // presentation only: the arena breathes spores, and phase two visibly enrages the bloom
    if (Math.random() < 0.25 && g.room) g.fx.add({ x: g.room.x0 + 1 + Math.random() * (g.room.x1 - g.room.x0 - 2), y: 0.1, z: g.room.z0 + 1 + Math.random() * (g.room.z1 - g.room.z0 - 2), vy: 0.35, g: 0, drag: 0, color: phase2 ? 0xff6a8a : 0xb8e08a, life: 3, size: 0.06, wob: 1, soft: true, shrink: false });
    if (phase2 && !this.enraged && this.state !== 'dying' && this.state !== 'dead') {
      this.enraged = true;
      sfx('roar'); g.pr.addShake(1.1); g.pr.addFlash(0.35, 0xff4a6a); g.hitstop(0.12);
      g.fx.ring(this.x, this.z, 0.5, 6, 0xff4a6a, 0.8); g.fx.burst(this.x, 1.4, this.z + 0.6, 40, [0xff4a6a, 0xc04a7a, 0x2e6a2a], 6, { life: 0.9 });
      g.ui.banner('BRAMBLEMAW', 'It blooms in fury!', 1.8);
    }
    if (this.enraged) {
      m.eyes.scale.setScalar(1 + Math.sin(t * 14) * 0.15);
      if (Math.random() < 0.4) g.fx.add({ x: this.x + (Math.random() - 0.5) * 1.8, y: 1.6 + Math.random(), z: this.z + (Math.random() - 0.5) * 1.4, vy: 0.8, g: 0, color: Math.random() < 0.5 ? 0xff4a6a : 0xffb347, life: 0.8, size: 0.06 });
    }
    // idle anim
    m.bulb.scale.set(1, 1, 1);
    m.mouth.scale.set(1, 1, 1);
    m.core.visible = false;
    m.bulb.rotation.set(0, 0, 0);
    for (let i = 0; i < m.roots.length; i++) m.roots[i].rotation.x = Math.sin(t * 2 + i) * 0.08;
    for (let i = 0; i < m.petals.length; i++) m.petals[i].rotation.x = -0.6 + Math.sin(t * 3 + i) * 0.1;
    m.bulb.position.y = 0.2 + Math.sin(t * 2) * 0.04;
    switch (this.state) {
      case 'intro':
        m.bulb.scale.y = Math.min(1, this.st / 1.5);
        if (this.st > 2.0) { this.setState('idle'); }
        break;
      case 'idle': {
        const wait = phase2 ? 0.9 : 1.4;
        if (this.st > wait) {
          this.cycle++;
          const opts = this.cycle % 3 === 0 ? 'inhale' : (this.cycle % 3 === 1 ? 'volley' : (Math.random() < 0.5 ? 'roots' : 'volley'));
          this.setState(opts === 'volley' ? 'volleyUp' : opts);
          if (opts === 'inhale') sfx('inhale');
        }
        break;
      }
      case 'volleyUp':
        m.bulb.scale.set(1.08, 0.9, 1.08);
        if (this.st > 0.5) {
          const n = phase2 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 1 + Math.random() * 2.2;
            const tx = clamp(p.x + Math.cos(a) * r, g.room.x0 + 1.6, g.room.x1 - 1.6), tz = clamp(p.z + Math.sin(a) * r, this.z + 2.2, g.room.z1 - 1.6);
            const pod = new Pod(g, this, this.x, this.z + 0.5, tx, tz);
            pod.flight = 0.8 + i * 0.12;
            g.spawn(pod);
          }
          sfx('shoot'); this.setState('recover');
        }
        break;
      case 'inhale': {
        const dur = 2.8;
        m.mouth.scale.set(1.5, 1.6, 1);
        m.bulb.scale.set(1 + this.st * 0.05, 1 + this.st * 0.04, 1 + this.st * 0.05);
        if (this.st > 0.3) {
          const dx = this.x - p.x, dz = this.mz - p.z, d = Math.hypot(dx, dz);
          if (d < 9) { const pull = 2.6 * (1 - d / 12); p.pullX = dx / d * pull * 1; p.pullZ = dz / d * pull; }
          if (Math.random() < 0.8) {
            const a = Math.random() * Math.PI, r = 3 + Math.random() * 3;
            const sx = this.x + Math.cos(a) * r, sz = this.mz + Math.sin(a) * r;
            g.fx.add({ x: sx, y: 0.3 + Math.random() * 0.8, z: sz, vx: (this.x - sx) * 1.6, vz: (this.mz - sz) * 1.6, g: 0, drag: 0, color: 0xdff4ff, life: 0.55, size: 0.05, stretch: 3 });
          }
          if (d < 1.5 && p.state !== 'dead') { p.hurt({ dmg: 3, x: this.x, z: this.z, src: this, kb: 12, unblockable: true }); sfx('heavyhit'); this.setState('recover'); }
        }
        if (this.st > dur) this.setState('recover');
        break;
      }
      case 'roots': {
        if (this.st < 0.05 && !this.rootsDone) {
          this.rootsDone = true;
          const n = phase2 ? 7 : 5;
          const a = Math.atan2(p.x - this.x, p.z - this.z);
          for (let i = 0; i < n; i++) {
            const d = 1.8 + i * 1.0;
            const x = this.x + Math.sin(a) * d, z = this.z + Math.cos(a) * d;
            if (x < g.room.x0 + 1 || x > g.room.x1 - 1 || z > g.room.z1 - 1) break;
            g.spawn(new RootSpike(g, x, z, i * 0.12));
          }
          if (phase2) { const a2 = a + (Math.random() < 0.5 ? 0.6 : -0.6); for (let i = 0; i < 5; i++) { const d = 2 + i; const x = this.x + Math.sin(a2) * d, z = this.z + Math.cos(a2) * d; if (x < g.room.x0 + 1 || x > g.room.x1 - 1 || z > g.room.z1 - 1) break; g.spawn(new RootSpike(g, x, z, 0.3 + i * 0.12)); } }
          sfx('roar');
        }
        m.bulb.rotation.x = 0.1;
        if (this.st > 1.6) { this.rootsDone = false; this.setState('recover'); }
        break;
      }
      case 'recover':
        if (this.st > (phase2 ? 0.5 : 0.8)) this.setState('idle');
        break;
      case 'stunned': {
        m.core.visible = true;
        m.bulb.scale.set(1.15, 0.8, 1.15);
        m.mouth.scale.set(1.4, 1.2, 1);
        m.bulb.rotation.x = 0.25 + Math.sin(t * 12) * 0.03;
        for (const pt of m.petals) pt.rotation.x = 0.4;
        if (Math.random() < 0.2) g.fx.add({ x: this.x + (Math.random() - 0.5), y: 1.8, z: this.z + 0.8, vy: 0.5, g: -0.5, color: 0xfff3b0, life: 0.6, size: 0.06 });
        if (this.st > 4.2 || this.stunHits >= 6) {
          this.setState('recover');
          sfx('roar'); g.fx.ring(this.x, this.z, 1, 5, 0x7fd36a, 0.5);
          if (Math.hypot(p.x - this.x, p.z - this.z) < 4) p.knock(Math.atan2(p.x - this.x, p.z - this.z), 9);
          if (phase2) for (let i = 0; i < 3; i++) { const a = Math.PI * (0.2 + i * 0.3); g.spawnEnemy('seedling', this.x + Math.cos(a) * 2.2, this.z + Math.sin(a) * 2.2 + 0.5, { noRoom: true }); }
        }
        break;
      }
      case 'dying': {
        m.bulb.scale.set(1 + Math.sin(this.st * 30) * 0.05, 1 - this.st * 0.25, 1 + Math.sin(this.st * 30) * 0.05);
        if (Math.random() < 0.3) { g.fx.burst(this.x + (Math.random() - 0.5) * 2, 1, this.z + (Math.random() - 0.5) * 2, 8, [0x7fd36a, 0x2e6a2a, 0xff7ab0], 4); sfx('enemydie'); }
        g.pr.addShake(0.2);
        if (this.st > 2.6) {
          g.fx.burst(this.x, 1, this.z, 60, [0x7fd36a, 0x2e6a2a, 0xff7ab0, 0xffffff], 7, { life: 1 });
          g.fx.ring(this.x, this.z, 0.5, 7, 0xb8ff9a, 0.8);
          g.pr.addFlash(0.9, 0xffffff);
          sfx('bossdie');
          this.setState('dead');
          this.solid = false;
          this.remove();
          g.onBossDead(this);
        }
        break;
      }
    }
  }
}
