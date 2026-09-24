// Pass 5 bosses: THE SEAMKEEPER (Cracked Conservatory miniboss) and THE CROWNED TOAD (rare
// world boss in Mirewhistle Fen). Both are self-contained: intro, phases, loot and death.
import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { mesh, B, MAT_GLOW } from '../models.js';
import { sfx, playMusic } from '../engine/audio.js';
import { angDiff, clamp } from '../engine/util.js';
import { flashObj } from './common.js';
import { ThreadBarrier } from './objects5.js';

const flatMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
const drop = m => m && m.parent && m.parent.remove(m);
function lane(g, x0, z0, x1, z1, w, color) {
  const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, L), flatMat(color, 0.25));
  m.rotation.x = -Math.PI / 2; m.rotation.z = -a; m.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2); g.world.add(m); return m;
}
function ring(g, x, z, r, color, inner = 0.15) { const m = new THREE.Mesh(new THREE.RingGeometry(r * inner, r, 32), flatMat(color, 0.35)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); g.world.add(m); return m; }
const segD = (ax, az, bx, bz, px, pz) => { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz; const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0; return Math.hypot(ax + vx * t - px, az + vz * t - pz); };

class BossBase extends Entity {
  get p() { return this.g.player; }
  setState(s) { this.state = s; this.st = 0; }
  // hits land hard only on the exposed weak point; elsewhere armour turns them
  hitResponse(h, exposed, weakMul, armourMul) {
    const g = this.g;
    if (exposed) { sfx('weakpoint'); g.fx.ring(this.x, this.z, 0.2, 1.1, 0xffd25e, 0.2); return weakMul; }
    sfx('clang'); g.fx.sparks(this.x - Math.sin(h.dir) * this.r, 0.6, this.z - Math.cos(h.dir) * this.r, h.dir + Math.PI, 6);
    return armourMul;
  }
  takeHit(h, mult) {
    const g = this.g;
    const dmg = Math.max(1, Math.round(h.dmg * mult));
    this.hp -= dmg; this.hpShow = 3;
    flashObj(this.obj, 0.06); g.addSurge(2);
    g.ui.bossBar(this.name, Math.max(0, this.hp / this.maxHp));
    if (h.heavy || h.crit) g.hitstop(0.06);
    if (this.hp <= 0 && this.state !== 'dying') { this.setState('dying'); this.onDying(); }
  }
  applyStatus(k, t, v) { const S = this.status || (this.status = {}); if (k === 'freeze') k = 'chill'; S[k] = Math.max(S[k] || 0, t); if (k === 'burn') S.burnDps = Math.max(S.burnDps || 0, v || 1); }
  tickStatus(dt) {
    const S = this.status; if (!S) return;
    for (const k in S) if (typeof S[k] === 'number' && k !== 'burnDps') S[k] = Math.max(0, S[k] - dt);
    if (S.burn > 0) { S.burnTick = (S.burnTick || 0) - dt; if (S.burnTick <= 0) { S.burnTick = 0.5; this.hp -= Math.max(1, Math.round(S.burnDps * 0.5)); this.g.ui.bossBar(this.name, Math.max(0, this.hp / this.maxHp)); } }
  }
}

// ======================================================================= THE SEAMKEEPER
export class Seamkeeper extends BossBase {
  constructor(g, x, z, room) {
    super(g, x, z);
    this.isEnemy = true; this.isBoss = true; this.kind = 'seamkeeper'; this.displayName = 'the Seamkeeper';
    this.room = room.id; this.R = room;
    this.r = 0.95; this.solid = false; this.level = 7;
    this.hp = this.maxHp = Math.round(12 * 6 * (1 + 0.3 * 6) * 0.9);
    this.name = 'THE SEAMKEEPER';
    this.state = 'intro'; this.st = 0; this.facing = 0; this.threads = [];
    this.buildModel();
    this.attach();
  }
  buildModel() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const P = 0xf0ece4, P2 = 0xd8d0c4, IRON = 0x2a2a34, RED = 0xd84a6a;
    body.add(mesh([B(1.0, 0.5, 0.9, 0, 0.55, 0.1, P), B(0.9, 0.08, 0.8, 0, 1.05, 0.1, P2), B(0.3, 0.12, 0.04, 0.2, 0.8, 0.56, 0x8a8a90, 0, 0, 0.6), // porcelain thorax with a crack
      B(0.8, 0.7, 0.8, 0, 0.45, -0.75, P2), B(0.6, 0.1, 0.6, 0, 0.85, -0.75, 0xa89a80), // abdomen
      B(0.5, 0.36, 0.5, 0, 0.62, -0.75, RED), B(0.54, 0.05, 0.54, 0, 0.7, -0.75, 0xe86a8a), B(0.54, 0.05, 0.54, 0, 0.86, -0.75, 0xa04050), // a spool of red thread
      B(0.56, 0.36, 0.4, 0, 0.55, 0.7, P), B(0.14, 0.26, 0.06, -0.14, 0.35, 0.92, IRON, 0.3), B(0.14, 0.26, 0.06, 0.14, 0.35, 0.92, IRON, 0.3)])); // head + needle mandibles
    this.eyes = mesh([...[[-0.16, 0.74], [0.16, 0.74], [-0.08, 0.82], [0.08, 0.82], [-0.22, 0.64], [0.22, 0.64]].map(([x, y]) => B(0.06, 0.06, 0.02, x, y, 0.91, 0xff5a6a))], MAT_GLOW, false);
    body.add(this.eyes);
    this.legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1, k = i % 4, lz = 0.45 - k * 0.32;
      const hip = new THREE.Group(); hip.position.set(side * 0.45, 0.6, lz); body.add(hip);
      hip.add(mesh([B(0.08, 0.08, 0.7, 0, 0, 0.35 * side * 0 + 0, IRON, 0, side * (Math.PI / 2 - 0.3 + k * 0.2), 0)]));
      const knee = new THREE.Group(); knee.position.set(side * 0.65, 0.2, (k - 1.5) * -0.12); hip.add(knee);
      knee.add(mesh([B(0.05, 1.0, 0.05, 0, -1.0, 0, IRON, 0, 0, side * 0.35)]));
      const joint = mesh([B(0.14, 0.14, 0.14, 0, -0.07, 0, 0x8a2a3a)], MAT_GLOW, false); knee.add(joint);
      this.legs.push({ hip, knee, joint, side, k });
    }
    this.m = { root, body }; this.obj.add(root);
    root.scale.setScalar(1.75);
  }
  get exposed() { return this.state === 'tangled' || (this.state === 'stitch' && this.st > 0.3) || this.state === 'dying'; }
  onHit(h) {
    if (this.state === 'intro' || this.state === 'dying' || this.state === 'dead') return null;
    const mult = this.hitResponse(h, this.exposed, 1.7, 0.3);
    this.takeHit(h, mult);
    return 'hit';
  }
  onGust() { if (this.state === 'charge') { this.g.ui.float(this.x, 2, this.z, 'UNMOVED', '#fff3b0', false, true); } }
  // arena lanes (interior coordinates of the loom room)
  get bx() { return [this.R.x0 + 1.5, this.R.x1 - 1.5]; }
  get bz() { return [this.R.z0 + 1.5, this.R.z1 - 1.5]; }
  stitch(n) {
    const g = this.g, p = this.p;
    const [xa, xb] = this.bx, [za, zb] = this.bz;
    const gold = this.hp < this.maxHp * 0.6;
    const made = [];
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 8; tries++) {
        const horiz = Math.random() < 0.5;
        const len = (horiz ? xb - xa : zb - za) * (0.45 + Math.random() * 0.2);
        let x0, z0, x1, z1;
        if (horiz) { const z = Math.round(za + 1 + Math.random() * (zb - za - 2)) + 0.5; const s = xa + Math.random() * (xb - xa - len); x0 = s; x1 = s + len; z0 = z1 = z; }
        else { const x = Math.round(xa + 1 + Math.random() * (xb - xa - 2)) + 0.5; const s = za + Math.random() * (zb - za - len); z0 = s; z1 = s + len; x0 = x1 = x; }
        // never stitch through the player
        if (segD(x0, z0, x1, z1, p.x, p.z) < 1.1 || segD(x0, z0, x1, z1, this.x, this.z) < 1.2) continue;
        const t = new ThreadBarrier(g, x0, z0, x1, z1, gold && Math.random() < 0.5, this);
        g.spawn(t); made.push(t);
        break;
      }
    }
    this.threads = [...this.threads.filter(t => !t.dead), ...made].slice(-6);
    // too many threads: the oldest unravel so the loom is never sealed shut
    for (const t of this.threads.filter(t => !t.dead).slice(0, -5)) t.cut();
  }
  update(dt) {
    const g = this.g, p = this.p, t = g.time;
    this.st += dt; this.tickStatus(dt);
    const phase = this.hp > this.maxHp * 0.6 ? 1 : this.hp > this.maxHp * 0.25 ? 2 : 3;
    if (phase !== this.phase && this.phase && this.state !== 'dying') {
      sfx('roar'); g.pr.addShake(0.8); g.pr.addFlash(0.3, 0xd84a6a);
      g.ui.banner('THE SEAMKEEPER', phase === 2 ? 'It rethreads the loom in gold!' : 'It tears at its own seams!', 1.8);
      this.stitch(phase === 2 ? 3 : 2);
    }
    this.phase = phase;
    const speed = phase === 3 ? 1.35 : 1;
    let vx = 0, vz = 0;
    switch (this.state) {
      case 'intro': break;
      case 'idle': {
        const a = Math.atan2(p.x - this.x, p.z - this.z);
        this.facing = a;
        const d = Math.hypot(p.x - this.x, p.z - this.z);
        if (d > 3) { vx = Math.sin(a) * 1.6; vz = Math.cos(a) * 1.6; }
        if (this.st > 1.1 / speed) {
          const live = this.threads.filter(t => !t.dead).length;
          const r = Math.random();
          if (live < 2 + phase || r < 0.25) this.setState('stitch');
          else if (phase >= 2 && r < 0.55) this.beginVolley();
          else this.beginLane();
        }
        break;
      }
      case 'stitch': // anchors its legs (joints exposed for a moment) and draws threads across the loom
        if (this.st > 0.5 && !this.stitched) { this.stitched = true; this.stitch(phase === 1 ? 2 : phase === 2 ? 3 : 2); }
        if (this.st > 1.3) { this.stitched = false; this.beginLane(); }
        break;
      case 'lane': // the charge lane is marked along the player's row or column
        if (this.lane) this.lane.material.opacity = 0.2 + Math.min(1, this.st / 0.9) * 0.4;
        if (this.st > 0.9 / speed) { drop(this.lane); this.lane = null; this.setState('charge'); sfx('lunge'); this.hitDone = false; }
        break;
      case 'charge': {
        const sp = 13 * speed;
        vx = Math.sin(this.cdir) * sp; vz = Math.cos(this.cdir) * sp;
        if (!this.hitDone && Math.hypot(p.x - this.x, p.z - this.z) < this.r + 0.5) { if (p.hurt({ dmg: 2.4, x: this.x, z: this.z, src: this, kb: 9 })) this.hitDone = true; }
        // it runs into one of its own threads: tangled, joints bare
        for (const th of this.threads) if (!th.dead && Math.abs(th.x - this.x) < th.hw + 0.6 && Math.abs(th.z - this.z) < th.hd + 0.6) { th.cut(); this.tangle(); return this.sync(); }
        if (Math.random() < 0.8) g.fx.dust(this.x, this.z, 1, 0xc8b8a8);
        break;
      }
      case 'volley': // three needles down marked lines
        this.facing = Math.atan2(p.x - this.x, p.z - this.z);
        if (this.st > 0.7 && !this.fired) {
          this.fired = true; for (const l of this.vlines || []) drop(l.m);
          sfx('lunge');
          for (const l of this.vlines || []) g.spawn(new Needle(g, this, this.x, this.z, l.a));
        }
        if (this.st > 1.1) { this.fired = false; this.setState('idle'); }
        break;
      case 'tangled':
        if (Math.random() < 0.4) g.fx.add({ x: this.x + (Math.random() - 0.5) * 1.4, y: 0.4 + Math.random(), z: this.z + (Math.random() - 0.5) * 1.4, g: 0, color: 0xd84a6a, life: 0.4, size: 0.05 });
        if (this.st > 2.6) { this.setState('idle'); sfx('stitch'); }
        break;
      case 'recover': if (this.st > 0.7) this.setState('idle'); break;
      case 'dying': this.dieUpdate(dt); break;
    }
    if (this.state !== 'dying' && this.state !== 'dead' && this.state !== 'intro') {
      const hit = move(g, this, vx * dt, vz * dt);
      if (hit && this.state === 'charge') { this.setState('recover'); sfx('thud'); g.pr.addShake(0.4); g.fx.dust(this.x, this.z, 10); }
    }
    this.animate(dt, Math.hypot(vx, vz));
    this.sync();
  }
  beginLane() {
    const g = this.g, p = this.p;
    // charge straight along whichever axis lines up with the player
    const dx = p.x - this.x, dz = p.z - this.z;
    this.cdir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
    if (Math.abs(dx) > Math.abs(dz)) this.z += clamp(dz, -1.5, 1.5); else this.x += clamp(dx, -1.5, 1.5);
    this.facing = this.cdir;
    const L = g.shotLen(this.x, this.z, this.cdir, 14);
    this.lane = lane(g, this.x, this.z, this.x + Math.sin(this.cdir) * L, this.z + Math.cos(this.cdir) * L, 1.3, 0xff4a4a);
    sfx('windup'); this.setState('lane');
  }
  beginVolley() {
    const g = this.g, p = this.p, a0 = Math.atan2(p.x - this.x, p.z - this.z);
    this.vlines = [-0.35, 0, 0.35].map(da => { const a = a0 + da, L = g.shotLen(this.x, this.z, a, 12); return { a, m: lane(g, this.x, this.z, this.x + Math.sin(a) * L, this.z + Math.cos(a) * L, 0.28, 0xff8a5a) }; });
    sfx('windup'); this.setState('volley');
  }
  tangle() {
    const g = this.g;
    sfx('snap'); sfx('armorbreak'); g.pr.addShake(0.5); g.hitstop(0.1);
    g.ui.float(this.x, 2.2, this.z, 'TANGLED — JOINTS EXPOSED', '#ffd25e', true);
    this.setState('tangled');
  }
  animate(dt, sp) {
    const t = this.g.time, m = this.m;
    this.obj.rotation.y = this.facing;
    this.walk = (this.walk || 0) + dt * (4 + sp * 1.5);
    const ex = this.exposed;
    this.legs.forEach((L, i) => {
      const ph = this.walk + i * 1.3;
      L.hip.rotation.y = Math.sin(ph) * 0.25 * Math.min(1, sp / 3);
      L.knee.rotation.x = this.state === 'stitch' ? -0.3 : this.state === 'tangled' ? Math.sin(t * 20 + i) * 0.3 : Math.sin(ph) * 0.2;
      L.joint.scale.setScalar(ex ? 1.4 + Math.sin(t * 12) * 0.2 : 0.8);
      L.joint.material = ex ? MAT_GLOW : L.joint.material;
    });
    m.body.position.y = this.state === 'stitch' ? -0.1 : Math.sin(t * 3) * 0.03;
    m.body.rotation.x = this.state === 'lane' ? -0.15 : this.state === 'charge' ? 0.2 : 0;
    this.eyes.visible = this.state !== 'lane' || Math.floor(this.st * 14) % 2 === 0;
  }
  onDying() {
    const g = this.g;
    for (const th of this.threads) th.cut();
    for (const e of g.entities) if (e instanceof Needle) e.remove();
    drop(this.lane); for (const l of this.vlines || []) drop(l.m);
    g.ui.bossBar(null); g.cutscene = true; g.camFocus = { x: this.x, z: this.z + 1 }; g.camZoom = 0.8;
    sfx('roar'); g.hitstop(0.25); g.pr.addFlash(0.4, 0xd84a6a);
  }
  dieUpdate(dt) {
    const g = this.g;
    // it unravels: red thread spills out, the legs fold, the porcelain gives
    this.m.body.position.y = -Math.min(0.4, this.st * 0.2); this.m.body.rotation.z = Math.sin(this.st * 25) * 0.05;
    for (const L of this.legs) L.knee.rotation.x = Math.min(1.2, this.st * 0.6) * (L.side);
    if (Math.random() < 0.6) g.fx.add({ x: this.x + (Math.random() - 0.5), y: 0.8, z: this.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, color: Math.random() < 0.7 ? 0xd84a6a : 0xf0ece4, life: 1.2, size: 0.05, g: 3, wob: 2 });
    g.pr.addShake(0.15);
    if (this.st > 2.4) {
      g.fx.burst(this.x, 0.8, this.z, 60, [0xf0ece4, 0xd84a6a, 0x2a2a34, 0xffffff], 7, { life: 1.1 });
      g.fx.ring(this.x, this.z, 0.4, 6, 0xd84a6a, 0.8); sfx('bossdie'); sfx('shatter'); g.pr.addFlash(0.8, 0xffffff);
      this.setState('dead'); this.remove();
      g.onSeamkeeperDead(this);
    }
  }
}
class Needle extends Entity {
  constructor(g, src, x, z, a) { super(g, x, z); this.src = src; this.a = a; this.t = 0; this.alwaysUpdate = true; this.obj.add(mesh([B(0.05, 0.05, 0.8, 0, 0.45, 0, 0xe8e8f0), B(0.07, 0.07, 0.1, 0, 0.45, -0.4, 0xd84a6a)], MAT_GLOW, false)); this.obj.rotation.y = a; this.moveMode = 'fly'; this.r = 0.1; }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    const hit = move(g, this, Math.sin(this.a) * 17 * dt, Math.cos(this.a) * 17 * dt);
    if (Math.hypot(p.x - this.x, p.z - this.z) < 0.35) { p.hurt({ dmg: 1.4, x: this.x, z: this.z, src: this.src, kb: 4 }); return this.remove(); }
    if (hit || this.t > 1.2) { this.g.fx.burst(this.x, 0.45, this.z, 5, 0xe8e8f0, 1.5); return this.remove(); }
    this.sync();
  }
}

// ======================================================================= THE CROWNED TOAD
export class CrownedToad extends BossBase {
  constructor(g, x, z) {
    super(g, x, z);
    this.isEnemy = true; this.isBoss = true; this.kind = 'toad'; this.displayName = 'the Crowned Toad';
    this.r = 1.3; this.solid = true; this.hw = 1.0; this.hd = 1.0; this.level = 9;
    this.hp = this.maxHp = Math.round(12 * 6 * (1 + 0.3 * 8) * 1.05);
    this.name = 'THE CROWNED TOAD';
    this.home = { x, z }; this.alt = 0;
    this.state = 'sleep'; this.st = 0; this.facing = 0;
    this.buildModel();
    this.attach();
  }
  buildModel() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const G = 0x5a8a3a, G2 = 0x4a7a2e, BEL = 0xd8d8a0, GOLD = 0xe0b040;
    body.add(mesh([B(2.2, 0.9, 2.0, 0, 0.1, 0, G), B(1.9, 0.5, 1.7, 0, 0.9, -0.05, G2), B(2.0, 0.34, 1.0, 0, 0.1, 0.55, BEL), // body, back, pale belly
      B(1.8, 0.12, 0.2, 0, 0.72, 1.0, 0x2a3a1a), // the long mouth line
      ...[[-0.6, 0.4], [0.5, -0.3], [0.1, 0.1], [-0.3, -0.6], [0.7, 0.5]].map(([x, z]) => B(0.18, 0.1, 0.18, x, 1.38, z, 0x6a9a44)), // warts
      B(0.5, 0.4, 0.5, -0.65, 1.2, 0.6, G), B(0.5, 0.4, 0.5, 0.65, 1.2, 0.6, G), // eye bulges
      ...[-1, 1].flatMap(s => [B(0.5, 0.36, 0.9, s * 1.1, 0, -0.3, G2), B(0.4, 0.1, 0.5, s * 1.2, 0, 0.3, G2)])])); // folded legs
    this.eyes = mesh([B(0.34, 0.24, 0.1, -0.65, 1.28, 0.86, 0xffd25e), B(0.34, 0.24, 0.1, 0.65, 1.28, 0.86, 0xffd25e), B(0.2, 0.1, 0.11, -0.65, 1.34, 0.87, 0x1a1a10), B(0.2, 0.1, 0.11, 0.65, 1.34, 0.87, 0x1a1a10)], MAT_GLOW, false);
    body.add(this.eyes);
    const crown = new THREE.Group(); crown.position.set(0, 1.4, -0.1);
    crown.add(mesh([B(0.9, 0.2, 0.9, 0, 0, 0, GOLD), ...[[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35], [0, 0.4]].map(([x, z]) => B(0.14, 0.3, 0.14, x, 0.18, z, GOLD))]));
    this.gems = mesh([B(0.12, 0.12, 0.05, 0, 0.1, 0.46, 0xbfe8d0), B(0.08, 0.08, 0.05, -0.3, 0.08, 0.46, 0xe84a6a), B(0.08, 0.08, 0.05, 0.3, 0.08, 0.46, 0x4aa8ff)], MAT_GLOW, false);
    crown.add(this.gems); body.add(crown);
    this.throat = mesh([B(1.0, 0.5, 0.5, 0, 0.2, 0.9, 0xe8e0b0)]); this.throat.scale.setScalar(0.2); body.add(this.throat);
    this.tongue = new THREE.Group(); this.tongue.position.set(0, 0.6, 1.05); body.add(this.tongue);
    this.tongueM = mesh([B(0.3, 0.14, 1, 0, 0, 0.5, 0xe86a8a)]); this.tongueM.scale.z = 0.01; this.tongue.add(this.tongueM);
    this.m = { root, body, crown }; this.obj.add(root);
    // asleep: only a mossy mound and a glint of gold show above the water
    body.position.y = -1.1;
  }
  get exposed() { return this.state === 'stuck' || this.state === 'dying'; }
  onHit(h) {
    if (this.state === 'sleep' || this.state === 'rise' || this.state === 'dying' || this.state === 'dead') return null;
    if (this.alt > 0.8) return null; // mid-leap
    const mult = this.exposed ? (sfx('weakpoint'), this.g.fx.ring(this.tx ?? this.x, this.tz ?? this.z, 0.2, 0.9, 0xffd25e, 0.2), 2.0) : 1;
    if (!this.exposed) { this.g.fx.burst(this.x, 0.6, this.z, 6, [0x5a8a3a, 0xe8f8ff], 2.5); }
    this.takeHit(h, mult);
    return 'hit';
  }
  wake() { this.setState('rise'); }
  update(dt) {
    const g = this.g, p = this.p, t = g.time;
    this.st += dt; this.tickStatus(dt);
    if (this.status) this.status.wet = 99; // it lives in the fen: always wet (lightning loves it)
    const phase = this.hp > this.maxHp * 0.5 ? 1 : 2;
    if (phase === 2 && this.phase === 1 && this.state !== 'dying') {
      sfx('croak'); g.pr.addShake(0.9); g.ui.banner('THE CROWNED TOAD', 'Its crown blazes — the sky opens!', 1.8);
      g.raining = true; g.rainK = Math.max(g.rainK || 0, 0.6); g.weatherT = 120;
    }
    this.phase = phase;
    let vx = 0, vz = 0;
    const face = () => { this.facing = Math.atan2(p.x - this.x, p.z - this.z); };
    switch (this.state) {
      case 'sleep':
        if (Math.random() < 0.02) g.fx.add({ x: this.x + (Math.random() - 0.5), y: 0.1, z: this.z + (Math.random() - 0.5), vy: 0.6, g: 0, color: 0xe8f8ff, life: 0.8, size: 0.06 });
        break;
      case 'rise':
        this.m.body.position.y = -1.1 + Math.min(1, this.st / 1.8) * 1.1;
        if (this.st > 1.8) { this.m.body.position.y = 0; this.setState('idle'); }
        break;
      case 'idle': {
        face();
        const d = Math.hypot(p.x - this.x, p.z - this.z);
        if (this.st > (phase === 2 ? 0.8 : 1.3)) {
          const r = Math.random();
          if (d < 3.4 && r < 0.4) this.begin('pound');
          else if (d < 8 && r < 0.7) this.begin('tongue');
          else if (phase === 2 && r < 0.85) this.begin('croak');
          else this.begin('leap');
        }
        break;
      }
      case 'tongue': // marked lane, then the lash
        if (this.st > 0.8 && !this.lashed) {
          this.lashed = true; drop(this.mk); this.mk = null; sfx('tongue');
          const hit = segD(this.x, this.z, this.tx, this.tz, p.x, p.z) < 0.55 + p.r;
          if (hit && p.hurt({ dmg: 1.6, x: this.x, z: this.z, src: this, kb: 0 }) === 'hit') {
            const a = Math.atan2(this.x - p.x, this.z - p.z); p.knock(a, 9); // yanked toward the mouth
          } else { this.setState('stuck'); this.stuckMiss = true; g.ui.float(this.tx, 1.2, this.tz, 'TONGUE STUCK!', '#ffd25e', true); }
        }
        this.tongueM.scale.z = this.lashed ? Math.min(1, (this.st - 0.8) * 8) * this.tlen : 0.01;
        if (this.st > 1.3 && this.state === 'tongue') { this.lashed = false; this.tongueM.scale.z = 0.01; this.setState('idle'); }
        break;
      case 'stuck': // the weak point: its tongue lies across the water
        this.tongueM.scale.z = this.tlen;
        if (this.st > 1.4) { this.tongueM.scale.z = 0.01; this.lashed = false; this.setState('idle'); sfx('tongue'); }
        break;
      case 'leap': {
        const k = Math.min(1, this.st / 1.0);
        if (this.st < 0.35) { this.m.body.scale.set(1.1, 0.8, 1.1); break; } // crouch
        this.m.body.scale.set(0.95, 1.1, 0.95);
        const u = Math.min(1, (this.st - 0.35) / 0.8);
        this.x = this.sx + (this.tx - this.sx) * u; this.z = this.sz + (this.tz - this.sz) * u;
        this.alt = Math.sin(u * Math.PI) * 3.2;
        if (u >= 1 && !this.landed) { this.landed = true; this.land(2.4); }
        if (this.st > 1.5) { this.alt = 0; this.m.body.scale.set(1, 1, 1); this.landed = false; if (phase === 2 && !this.chained) { this.chained = true; this.begin('leap'); } else { this.chained = false; this.setState('idle'); } }
        break;
      }
      case 'pound':
        this.m.body.scale.set(1 + Math.min(1, this.st / 0.8) * 0.15, 1 - Math.min(1, this.st / 0.8) * 0.2, 1 + Math.min(1, this.st / 0.8) * 0.15);
        if (this.st > 0.8 && !this.landed) { this.landed = true; this.m.body.scale.set(1, 1, 1); this.land(3.2); }
        if (this.st > 1.3) { this.landed = false; this.setState('idle'); }
        break;
      case 'croak': // a cone of sound: soaks and staggers, then keeps the rain coming
        face();
        this.throat.scale.setScalar(0.2 + Math.min(1, this.st / 0.7) * 1.0);
        if (this.st > 0.7 && !this.croaked) {
          this.croaked = true; drop(this.mk); this.mk = null; sfx('croak'); g.pr.addShake(0.6);
          for (let i = 0; i < 3; i++) g.fx.ring(this.x + Math.sin(this.cdir) * (1 + i), this.z + Math.cos(this.cdir) * (1 + i), 0.3, 1 + i * 0.6, 0xbfe8d0, 0.4, 0.3);
          const a = Math.atan2(p.x - this.x, p.z - this.z), d = Math.hypot(p.x - this.x, p.z - this.z);
          if (d < 6 && Math.abs(angDiff(a, this.cdir)) < 0.75) p.hurt({ dmg: 1.0, x: this.x, z: this.z, src: this, kb: 10 });
          for (const e of g.entities) if (e.isEnemy && !e.isBoss && e.applyStatus) e.applyStatus('wet', 6);
        }
        if (this.st > 1.2) { this.croaked = false; this.throat.scale.setScalar(0.2); this.setState('idle'); }
        break;
      case 'dying': this.dieUpdate(dt); break;
    }
    this.m.body.position.y = this.state === 'sleep' || this.state === 'rise' ? this.m.body.position.y : this.alt;
    this.gems.scale.setScalar(phase === 2 ? 1.2 + Math.sin(t * 8) * 0.2 : 1);
    if (this.state !== 'sleep' && this.state !== 'rise' && this.state !== 'leap' && this.state !== 'dying') this.obj.rotation.y = this.facing;
    if (this.state === 'idle') this.throat.scale.setScalar(0.2 + Math.abs(Math.sin(t * 2.2)) * 0.25);
    this.sync();
  }
  begin(s) {
    const g = this.g, p = this.p;
    this.setState(s);
    if (s === 'tongue') { this.facing = Math.atan2(p.x - this.x, p.z - this.z); this.tlen = Math.min(7, Math.max(2, Math.hypot(p.x - this.x, p.z - this.z) + 1)); this.tx = this.x + Math.sin(this.facing) * this.tlen; this.tz = this.z + Math.cos(this.facing) * this.tlen; this.mk = lane(g, this.x, this.z, this.tx, this.tz, 0.9, 0xe86a8a); this.obj.rotation.y = this.facing; sfx('windup'); }
    if (s === 'leap') { this.sx = this.x; this.sz = this.z; const a = Math.random() * 6.28; this.tx = p.x + Math.cos(a) * 0.6; this.tz = p.z + Math.sin(a) * 0.6; this.mk = ring(g, this.tx, this.tz, 2.4, 0xff5a4a); sfx('croak'); }
    if (s === 'pound') { this.mk = ring(g, this.x, this.z, 3.2, 0xff5a4a, 0.4); sfx('windup'); }
    if (s === 'croak') { this.cdir = Math.atan2(p.x - this.x, p.z - this.z); this.mk = lane(g, this.x, this.z, this.x + Math.sin(this.cdir) * 6, this.z + Math.cos(this.cdir) * 6, 4, 0xbfe8d0); }
  }
  land(r) {
    const g = this.g, p = this.p;
    drop(this.mk); this.mk = null;
    sfx('thud'); sfx('splash'); g.pr.addShake(1.0); g.hitstop(0.05); g.impact(this.x, this.z, r + 2, 1.3);
    g.fx.ring(this.x, this.z, 0.4, r, 0xe8f8ff, 0.45); g.fx.ring(this.x, this.z, 0.2, r + 2.5, 0x9ad8ff, 0.9, 0.05);
    for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 4; g.fx.add({ x: this.x + Math.cos(a) * r * 0.6, y: 0.1, z: this.z + Math.sin(a) * r * 0.6, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 3 + Math.random() * 4, color: i % 2 ? 0xe8f8ff : 0x9ad8ff, life: 0.8, size: 0.08, g: 12 }); }
    if (Math.hypot(p.x - this.x, p.z - this.z) < r + p.r) p.hurt({ dmg: 2.6, x: this.x, z: this.z, src: this, kb: 10, heavy: true });
    // the splash wave soaks everything around the landing
    for (const e of g.entities) if (e.isEnemy && !e.isBoss && e.applyStatus && Math.hypot(e.x - this.x, e.z - this.z) < r + 3) e.applyStatus('wet', 6);
    g.spawn(new SplashWave(g, this.x, this.z, r, this));
  }
  onDying() {
    const g = this.g;
    drop(this.mk); this.mk = null; this.tongueM.scale.z = 0.01;
    g.ui.bossBar(null); g.cutscene = true; g.camFocus = { x: this.x, z: this.z + 1 }; g.camZoom = 0.8;
    sfx('croak'); g.hitstop(0.25); g.pr.addFlash(0.4, 0xe0b040);
  }
  dieUpdate(dt) {
    const g = this.g;
    this.alt = 0;
    this.m.body.position.y = -Math.min(0.9, this.st * 0.35);
    this.m.body.rotation.z = Math.min(0.5, this.st * 0.3);
    this.m.crown.position.y = 1.4 + Math.min(1, this.st * 0.8) * 0.6; this.m.crown.rotation.z = this.st * 2;
    if (Math.random() < 0.5) g.fx.add({ x: this.x + (Math.random() - 0.5) * 2, y: 0.1, z: this.z + (Math.random() - 0.5) * 2, vy: 1.5, g: 4, color: 0xe8f8ff, life: 0.7, size: 0.06 });
    if (this.st > 2.6) {
      g.fx.burst(this.x, 1, this.z, 50, [0x5a8a3a, 0xe0b040, 0xe8f8ff, 0xffffff], 7, { life: 1.1 });
      g.fx.ring(this.x, this.z, 0.4, 7, 0xe0b040, 0.9); sfx('bossdie'); g.pr.addFlash(0.8, 0xffffff);
      this.setState('dead'); this.remove();
      g.onToadDead(this);
    }
  }
}
// an expanding ring of water: roll through it, or be knocked flat
class SplashWave extends Entity {
  constructor(g, x, z, r0, src) { super(g, x, z); this.r0 = r0; this.src = src; this.t = 0; this.hit = false; this.alwaysUpdate = true; }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    const R = this.r0 + this.t * 5.5;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (!this.hit && Math.abs(d - R) < 0.35 && p.state !== 'roll') { this.hit = true; p.hurt({ dmg: 0.8, x: this.x, z: this.z, src: this.src, kb: 6 }); }
    if (this.t > 0.6) this.remove();
  }
}
