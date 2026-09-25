// Pass 6 world boss: THE TOLLCROW, which nests in the Great Bell of the Belfry Cradle.
//
// It circles high over the Cradle and comes down to fight: marked swoops along the ground,
// fans of iron feathers, wing-beats that throw you back. Now and then it returns to the
// bell's beam to call the moths. Ring the Great Bell while it's perched there (strike the
// bell's mouth from below) and the toll knocks it out of the air: that's your opening.
import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { mesh, B, MAT_GLOW } from '../models.js';
import { sfx, playTone } from '../engine/audio.js';
import { angDiff } from '../engine/util.js';
import { flashObj } from './common.js';

const flatMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
const drop = m => m && m.parent && m.parent.remove(m);
function lane(g, x0, z0, x1, z1, w, color) {
  const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, L), flatMat(color, 0.25));
  m.rotation.x = -Math.PI / 2; m.rotation.z = -a; m.position.set((x0 + x1) / 2, 0.05 + g.groundAt((x0 + x1) / 2, (z0 + z1) / 2), (z0 + z1) / 2); g.world.add(m); return m;
}
const segD = (ax, az, bx, bz, px, pz) => { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz; const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0; return Math.hypot(ax + vx * t - px, az + vz * t - pz); };

class Feather extends Entity {
  constructor(g, src, x, z, a) { super(g, x, z); this.src = src; this.a = a; this.t = 0; this.alwaysUpdate = true; this.y = 0.5; this.obj.add(mesh([B(0.08, 0.03, 0.6, 0, 0, 0, 0x2a2a34), B(0.12, 0.02, 0.3, 0, 0.01, 0.1, 0x4a4a5a), B(0.03, 0.03, 0.2, 0, 0, -0.35, 0xb88a3a)])); this.obj.rotation.y = a; this.moveMode = 'fly'; this.r = 0.12; }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    const hit = move(g, this, Math.sin(this.a) * 13 * dt, Math.cos(this.a) * 13 * dt);
    if (Math.hypot(p.x - this.x, p.z - this.z) < 0.4) { p.hurt({ dmg: 1.5, x: this.x, z: this.z, src: this.src, kb: 3 }); return this.remove(); }
    if (hit || this.t > 1.4) { g.fx.burst(this.x, 0.45, this.z, 4, 0x3a3a44, 1.5); return this.remove(); }
    this.sync();
  }
}

// A target on the Great Bell's mouth: strike it and the bell tolls.
export class BellMouth extends Entity {
  constructor(g, x, z, boss) { super(g, x, z); this.boss = boss; this.r = 1.4; this.cool = 0; this.alwaysUpdate = true; }
  onHit() {
    const g = this.g;
    if (this.cool > 0) return null;
    this.cool = 1.2;
    playTone(45); setTimeout(() => playTone(52), 180); sfx('bellfail'); g.pr.addShake(0.8);
    g.fx.ring(this.x, this.z, 0.4, 5, 0xffd25e, 0.9, 2.4); g.fx.ring(this.x, this.z, 0.2, 8, 0xb88a3a, 1.2, 0.3);
    if (this.boss && !this.boss.dead) this.boss.tolled();
    return 'hit';
  }
  update(dt) { this.cool = Math.max(0, this.cool - dt); }
}

export class Tollcrow extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.isEnemy = true; this.isBoss = true; this.kind = 'tollcrow'; this.displayName = 'the Tollcrow'; this.name = 'THE TOLLCROW';
    this.r = 1.0; this.level = 15; this.moveMode = 'fly';
    this.hp = this.maxHp = Math.round(12 * 6 * (1 + 0.3 * 14) * 1.1);
    this.home = { x, z }; this.perch = { x, z }; this.alt = 6.4;
    this.state = 'roost'; this.st = 0; this.facing = Math.PI; this.orbitA = 0;
    this.build(); this.attach();
  }
  build() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const K = 0x1e1e26, K2 = 0x2e2e3a, BK = 0xc89a3a;
    body.add(mesh([B(0.9, 0.7, 1.5, 0, 0, 0, K), B(0.8, 0.2, 1.2, 0, 0.7, -0.1, K2), B(0.6, 0.55, 0.6, 0, 0.55, 0.8, K), B(0.24, 0.16, 0.5, 0, 0.62, 1.25, BK), B(0.5, 0.1, 0.9, 0, 0.15, -1.1, K2, -0.3), B(0.14, 0.4, 0.1, -0.2, -0.4, 0.2, BK), B(0.14, 0.4, 0.1, 0.2, -0.4, 0.2, BK)]));
    body.add(mesh([B(0.1, 0.1, 0.05, -0.22, 0.7, 1.08, 0xffd25e), B(0.1, 0.1, 0.05, 0.22, 0.7, 1.08, 0xffd25e)], MAT_GLOW, false));
    this.wings = [-1, 1].map(s => { const w = new THREE.Group(); w.position.set(s * 0.45, 0.5, 0); w.add(mesh([B(1.6, 0.1, 1.0, s * 0.8, 0, 0, K2), B(1.2, 0.08, 0.6, s * 1.8, 0, -0.1, K), B(0.5, 0.06, 0.3, s * 2.4, 0, -0.2, 0x4a4a5a)])); body.add(w); return w; });
    this.m = { root, body }; this.obj.add(root);
    root.scale.setScalar(1.3);
  }
  get p() { return this.g.player; }
  setState(s) { this.state = s; this.st = 0; }
  get exposed() { return this.state === 'stunned' || this.state === 'landed'; }
  onHit(h) {
    if (this.state === 'roost' || this.state === 'dying' || this.state === 'dead') return null;
    if (this.alt > 1.6) return null; // out of reach up there
    const g = this.g;
    const mult = this.state === 'stunned' ? 2.2 : this.state === 'landed' ? 1.3 : 0.7;
    if (mult > 1) { sfx('weakpoint'); g.fx.ring(this.x, this.z, 0.2, 1.1, 0xffd25e, 0.2); } else g.fx.burst(this.x, 0.8, this.z, 5, [0x2a2a34, 0x4a4a5a], 2);
    const dmg = Math.max(1, Math.round(h.dmg * mult));
    this.hp -= dmg; flashObj(this.obj, 0.06*(g.settings?.hitFlash??1)); g.addSurge(2);
    g.ui.bossBar(this.name, Math.max(0, this.hp / this.maxHp));
    if (this.hp <= 0 && this.state !== 'dying') { this.setState('dying'); this.onDying(); }
    return 'hit';
  }
  applyStatus(k, t, v) { const S = this.status || (this.status = {}); if (k === 'freeze') k = 'chill'; S[k] = Math.max(S[k] || 0, t); if (k === 'burn') S.burnDps = Math.max(S.burnDps || 0, v || 1); }
  // struck bell: if it's on its perch, the toll knocks it down
  tolled() {
    const g = this.g;
    if (this.state === 'perched') { this.setState('falling'); g.ui.float(this.x, 3, this.z, 'TOLLED!', '#ffd25e', true); sfx('weakpoint'); }
    else if (this.state !== 'stunned' && this.state !== 'dying' && this.state !== 'roost') { g.ui.float(this.x, 2.4, this.z, 'The bell hums', '#e0d0a0', false, true); }
  }
  wake() {
    const g = this.g;
    if (!this.mouth) { this.mouth = new BellMouth(g, this.home.x, this.home.z, this); g.spawn(this.mouth); }
    this.setState('rise');
  }
  update(dt) {
    const g = this.g, p = this.p, t = g.time;
    this.st += dt;
    const S = this.status; if (S) { for (const k in S) if (typeof S[k] === 'number' && k !== 'burnDps') S[k] = Math.max(0, S[k] - dt); if (S.burn > 0 && (S.bt = (S.bt || 0) - dt) <= 0) { S.bt = 0.5; this.hp -= Math.max(1, Math.round(S.burnDps * 0.5)); } }
    const phase = this.hp > this.maxHp * 0.5 ? 1 : 2;
    if (phase === 2 && this.phase === 1) { g.ui.banner('THE TOLLCROW', 'It screams — the Cradle fills with wind!', 1.8); sfx('roar'); }
    this.phase = phase;
    const flap = s => { this.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * s) * 0.7; }); };
    const home = this.home;
    switch (this.state) {
      case 'roost': { // asleep on the beam until someone steps into the Cradle
        this.x = home.x; this.z = home.z - 0.2; this.alt = 6.4; flap(0.5);
        if (Math.hypot(p.x - home.x, p.z - home.z) < 8 && !g.bossActive && !g.cutscene) g.startTollcrow(this);
        break;
      }
      case 'rise': this.alt = 6.4 - Math.min(1, this.st / 1.2) * 2.6; flap(10); if (this.st > 1.2) this.setState('circle'); break;
      case 'circle': { // wheel over the Cradle, then pick something nasty
        flap(9);
        this.orbitA += dt * 0.9;
        const tx = home.x + Math.cos(this.orbitA) * 5, tz = home.z + 1 + Math.sin(this.orbitA) * 4;
        this.x += (tx - this.x) * Math.min(1, dt * 2); this.z += (tz - this.z) * Math.min(1, dt * 2); this.alt += (3.2 - this.alt) * Math.min(1, dt * 2);
        this.facing = Math.atan2(p.x - this.x, p.z - this.z);
        if (this.st > (phase === 2 ? 1.2 : 1.8)) {
          this.moves = (this.moves || 0) + 1;
          const r = Math.random();
          if (this.moves % (phase === 2 ? 3 : 4) === 0) this.begin('perch');
          else if (r < 0.45) this.begin('swoop');
          else if (r < 0.8) this.begin('feathers');
          else this.begin('gale');
        }
        break;
      }
      case 'swoop': { // a marked lane, then the dive along it
        flap(this.st < 0.9 ? 4 : 16);
        if (this.st < 0.9) { this.alt += (3.4 - this.alt) * Math.min(1, dt * 3); break; }
        const u = Math.min(1, (this.st - 0.9) / 0.55);
        this.x = this.sx + (this.tx - this.sx) * u; this.z = this.sz + (this.tz - this.sz) * u; this.alt = 0.5 + (1 - u) * 1.2;
        if (!this.hitDone && segD(this.sx, this.sz, this.x, this.z, p.x, p.z) < 0.7 + p.r && u > 0.2) { this.hitDone = true; p.hurt({ dmg: 2.4, x: this.x, z: this.z, src: this, kb: 9, heavy: true }); }
        if (u >= 1) { drop(this.mk); this.mk = null; this.hitDone = false; g.fx.dust(this.x, this.z, 10); sfx('thud'); if (phase === 2 && !this.chained) { this.chained = true; this.begin('swoop'); } else { this.chained = false; this.setState('landed'); } }
        break;
      }
      case 'landed': this.alt = 0.4; flap(2); this.facing = Math.atan2(p.x - this.x, p.z - this.z); if (this.st > 1.4) this.setState('rise2'); break;
      case 'rise2': this.alt += (3.2 - this.alt) * Math.min(1, dt * 3); flap(12); if (this.st > 0.8) this.setState('circle'); break;
      case 'feathers': { // hover, then a fan of iron feathers
        flap(7); this.facing = Math.atan2(p.x - this.x, p.z - this.z);
        if (this.st > 0.7 && !this.fired) {
          this.fired = true; sfx('snap');
          const n = phase === 2 ? 7 : 5;
          for (let i = 0; i < n; i++) { const a = this.facing + (i - (n - 1) / 2) * 0.22; g.spawn(new Feather(g, this, this.x + Math.sin(a) * 0.6, this.z + Math.cos(a) * 0.6, a)); }
        }
        if (this.st > 1.3) { this.fired = false; this.setState('circle'); }
        break;
      }
      case 'gale': { // wing-beats that throw you back
        flap(18);
        if (this.st > 0.8 && !this.fired) {
          this.fired = true; sfx('gust'); g.pr.addShake(0.4);
          g.fx.wind(this.x, this.z, Math.atan2(p.x - this.x, p.z - this.z), 8, 0.9, 30, true);
          const d = Math.hypot(p.x - this.x, p.z - this.z);
          if (d < 7) { p.knock(Math.atan2(p.x - this.x, p.z - this.z), 11); if (d < 3) p.hurt({ dmg: 1.2, x: this.x, z: this.z, src: this, kb: 4 }); }
        }
        if (this.st > 1.4) { this.fired = false; this.setState('circle'); }
        break;
      }
      case 'perch': { // back up to the beam; the moths come when it calls
        flap(8);
        this.x += (home.x - this.x) * Math.min(1, dt * 2.5); this.z += (home.z - 0.2 - this.z) * Math.min(1, dt * 2.5); this.alt += (6.4 - this.alt) * Math.min(1, dt * 2.5);
        if (this.st > 1.2) { this.setState('perched'); sfx('roar'); g.ui.float(this.x, 3, this.z, 'The Tollcrow perches on the bell…', '#e0d0a0', false, true); const n = phase === 2 ? 3 : 2; for (let i = 0; i < n; i++) g.spawnEnemy('moth', home.x + (i - 1) * 3, home.z + 4, { noRoom: true, aggro: 20, eliteChance: phase === 2 ? 0.5 : 0 }); }
        break;
      }
      case 'perched': flap(1); this.alt = 6.4; if (this.st > (phase === 2 ? 4 : 6)) this.setState('rise'); break;
      case 'falling': this.alt = Math.max(0.3, this.alt - dt * 9); flap(20); if (this.alt <= 0.31) { g.pr.addShake(0.8); sfx('thud'); g.fx.dust(this.x, this.z, 16); this.setState('stunned'); } break;
      case 'stunned': this.alt = 0.3; this.wings.forEach(w => { w.rotation.z *= 0.9; }); if (Math.random() < 0.2) g.fx.add({ x: this.x + (Math.random() - 0.5), y: 1.4, z: this.z, vy: 0.5, g: 0, color: 0xffd25e, life: 0.6, size: 0.06 }); if (this.st > 3.6) this.setState('rise'); break;
      case 'dying': this.dieUpdate(dt); break;
    }
    this.obj.rotation.y = this.facing;
    this.m.body.position.y = this.alt;
    this.sync();
  }
  begin(s) {
    const g = this.g, p = this.p;
    this.setState(s);
    if (s === 'swoop') {
      this.sx = this.x; this.sz = this.z;
      const a = Math.atan2(p.x - this.x, p.z - this.z), L = Math.hypot(p.x - this.x, p.z - this.z) + 3;
      this.tx = this.x + Math.sin(a) * L; this.tz = this.z + Math.cos(a) * L; this.facing = a;
      this.mk = lane(g, this.sx, this.sz, this.tx, this.tz, 1.4, 0xff5a4a); sfx('windup');
    }
    if (s === 'gale' || s === 'feathers') sfx('windup');
  }
  onDying() {
    const g = this.g;
    drop(this.mk); this.mk = null;
    g.ui.bossBar(null); g.cutscene = true; g.camFocus = { x: this.x, z: this.z + 1 }; g.camZoom = 0.8;
    sfx('roar'); g.hitstop(0.25); g.pr.addFlash(0.4, 0xffd25e);
  }
  dieUpdate(dt) {
    const g = this.g;
    this.alt = Math.max(0, this.alt - dt * 3);
    this.m.body.rotation.z = Math.min(1.4, this.st * 0.6);
    if (Math.random() < 0.6) g.fx.add({ x: this.x + (Math.random() - 0.5) * 2, y: 1 + Math.random(), z: this.z + (Math.random() - 0.5) * 2, vy: -0.5, g: 1, color: Math.random() < 0.5 ? 0x2a2a34 : 0x4a4a5a, life: 1.4, size: 0.1, wob: 2 });
    if (this.st > 2.4) {
      g.fx.burst(this.x, 1, this.z, 50, [0x2a2a34, 0xffd25e, 0x4a4a5a], 7, { life: 1.1 });
      sfx('bossdie'); g.pr.addFlash(0.8, 0xffffff);
      this.setState('dead'); if (this.mouth) this.mouth.remove(); this.remove();
      g.onTollcrowDead(this);
    }
  }
}
