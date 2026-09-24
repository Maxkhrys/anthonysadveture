// Pass 5 active abilities. Each cast function receives the player, the rank multiplier and the
// resolved target, and spawns small, self-contained effect entities. Damage always goes through
// Game.playerHit (crits, procs, element reactions, numbers).
import * as THREE from 'three';
import { Entity } from '../entities/entity.js';
import { mesh, B, MAT_GLOW } from '../models.js';
import { sfx } from '../engine/audio.js';
import { Projectile, EchoShot, blast, segT, bolt } from './combat.js';
import { soak } from './elements.js';

const foes = (g, x, z, r) => g.entities.filter(e => e.isEnemy && !e.dead && !(e.spawnT > 0) && Math.hypot(e.x - x, e.z - z) < r + (e.r || 0.3));
const along = (g, x0, z0, x1, z1, w) => g.entities.filter(e => e.isEnemy && !e.dead && !(e.spawnT > 0) && segT(x0, z0, x1, z1, e.x, e.z).d < w + (e.r || 0.3));
// how far along a direction the player can reach before a wall
const reach = (g, x, z, dir, max) => g.shotLen(x, z, dir, max);

// ---------------------------------------------------------------- Samurai
// Ghostdraw: an Echo swordsman that repeats your draw-cut along the aim.
export class GhostBlade extends Entity {
  constructor(g, x, z, dir, mult, crit) {
    super(g, x, z); this.dir = dir; this.mult = mult; this.crit = crit; this.t = 0; this.alwaysUpdate = true; this.hitSet = new Set();
    this.len = reach(g, x, z, dir, 3.2); this.x0 = x; this.z0 = z;
    this.ghost = mesh([B(0.26, 0.36, 0.18, 0, 0.1, 0, 0x9ad8ff), B(0.3, 0.26, 0.28, 0, 0.46, 0, 0xbfe8ff), B(0.04, 0.04, 0.7, 0.2, 0.3, 0.3, 0xffffff)], MAT_GLOW, false);
    this.ghost.rotation.y = dir; this.obj.add(this.ghost);
  }
  update(dt) {
    const g = this.g; this.t += dt;
    this.ghost.visible = this.t < 0.7 ? Math.floor(this.t * 18) % 3 !== 0 : true;
    if (Math.random() < 0.5) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.3, y: 0.3 + Math.random() * 0.4, z: this.z + (Math.random() - 0.5) * 0.3, vy: 0.4, g: 0, color: 0x9ad8ff, life: 0.4, size: 0.05 });
    if (this.t >= 0.7) {
      const k = Math.min(1, (this.t - 0.7) / 0.14);
      this.x = this.x0 + Math.sin(this.dir) * this.len * k; this.z = this.z0 + Math.cos(this.dir) * this.len * k;
      for (const e of along(g, this.x0, this.z0, this.x, this.z, 0.7)) if (!this.hitSet.has(e)) { this.hitSet.add(e); g.playerHit(e, { mult: this.mult, kind: 'dash', element: 'echo', echo: true, kb: 4, dir: this.dir, ability: true, forceCrit: this.crit }); }
      if (k >= 1) { g.fx.arc(this.x, 0.35, this.z, this.dir, 1.3, 2.4, 0x9ad8ff, 0.2, 0.45); sfx('swing2'); this.remove(); return; }
    }
    this.sync();
  }
}
// Thread Sever: a humming line that detonates along its whole length.
export class SeverLine extends Entity {
  constructor(g, x, z, dir, mult) {
    super(g, x, z); this.dir = dir; this.mult = mult; this.t = 0; this.alwaysUpdate = true;
    const L = reach(g, x, z, dir, 3.6); this.x1 = x + Math.sin(dir) * L; this.z1 = z + Math.cos(dir) * L; this.L = L;
    this.line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, Math.max(0.2, L)), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.8, depthWrite: false }));
    this.line.position.set(Math.sin(dir) * L / 2, 0.45, Math.cos(dir) * L / 2); this.line.rotation.y = dir; this.obj.add(this.line);
    this.sync(); sfx('thread');
  }
  update(dt) {
    const g = this.g; this.t += dt;
    const k = this.t / 0.9;
    this.line.scale.set(1 + k * 2, 1 + k * 2, 1); this.line.material.opacity = 0.5 + Math.sin(this.t * 40) * 0.3;
    if (Math.random() < 0.7) { const u = Math.random(); g.fx.add({ x: this.x + (this.x1 - this.x) * u, y: 0.45, z: this.z + (this.z1 - this.z) * u, vy: 0.3, g: 0, color: k > 0.6 ? 0xffd25e : 0xfff3b0, life: 0.3, size: 0.04 }); }
    if (this.t >= 0.9) {
      sfx('resonate'); g.pr.addShake(0.3); g.hitstop(0.05);
      for (let i = 0; i <= 8; i++) { const u = i / 8; g.fx.ring(this.x + (this.x1 - this.x) * u, this.z + (this.z1 - this.z) * u, 0.1, 0.8, 0xffd25e, 0.3); }
      for (const e of along(g, this.x, this.z, this.x1, this.z1, 0.6)) g.playerHit(e, { mult: this.mult * 2.2, kind: 'resonance', kb: 5, dir: this.dir + Math.PI / 2, ability: true, echo: true });
      this.remove();
    }
  }
}
// Gale Step: a trail of cutting wind (and optionally an Echo that re-walks it)
export class WindTrail extends Entity {
  constructor(g, x0, z0, x1, z1, mult, echo = false) {
    super(g, x0, z0); Object.assign(this, { x0, z0, x1, z1, mult, echo }); this.t = 0; this.tick = 0; this.alwaysUpdate = true; this.cuts = 0;
  }
  update(dt) {
    const g = this.g; this.t += dt; this.tick -= dt;
    for (let i = 0; i < 2; i++) { const u = Math.random(); g.fx.add({ x: this.x0 + (this.x1 - this.x0) * u, y: 0.1 + Math.random() * 0.4, z: this.z0 + (this.z1 - this.z0) * u, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, vy: 0.6, g: 0, color: i ? 0xdff8ff : 0x8ac05a, life: 0.4, size: 0.04, wob: 2 }); }
    if (this.tick <= 0 && this.cuts < 4) {
      this.tick = 0.3; this.cuts++;
      const dir = Math.atan2(this.x1 - this.x0, this.z1 - this.z0);
      for (const e of along(g, this.x0, this.z0, this.x1, this.z1, 0.6)) g.playerHit(e, { mult: this.mult, kind: 'wind', element: 'wind', echo: this.echo, kb: 2, dir: dir + Math.PI / 2, ability: true, quiet: true });
      sfx('cut');
    }
    if (this.t > 1.2) this.remove();
  }
}
// Bellquake: delayed ground ruptures along the aim
export class Rupture extends Entity {
  constructor(g, x, z, delay, r, mult) {
    super(g, x, z); Object.assign(this, { delay, r, mult }); this.t = 0; this.alwaysUpdate = true;
    this.mk = new THREE.Mesh(new THREE.RingGeometry(r * 0.2, r, 20), new THREE.MeshBasicMaterial({ color: 0xffd25e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    this.mk.rotation.x = -Math.PI / 2; this.mk.position.y = 0.05; this.obj.add(this.mk); this.sync();
  }
  update(dt) {
    const g = this.g; this.t += dt;
    this.mk.scale.setScalar(0.3 + Math.min(1, this.t / this.delay) * 0.7);
    if (Math.random() < 0.4) g.fx.dust(this.x, this.z, 1, 0xc8a878);
    if (this.t >= this.delay) {
      sfx('quake'); g.pr.addShake(0.4);
      g.fx.ring(this.x, this.z, 0.2, this.r, 0xffd25e, 0.35);
      for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; g.fx.add({ x: this.x + Math.cos(a) * this.r * 0.5, y: 0.05, z: this.z + Math.sin(a) * this.r * 0.5, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, vy: 4 + Math.random() * 3, color: i % 2 ? 0x8a6a4a : 0x6a5040, life: 0.8, size: 0.1, g: 14 }); }
      for (const e of foes(g, this.x, this.z, this.r)) g.playerHit(e, { mult: this.mult, kind: 'quake', kb: 6, dir: Math.atan2(e.x - this.x, e.z - this.z), ability: true });
      this.remove();
    }
  }
}
export function resonanceRing(g, x, z, r, mult, color = 0xffd25e) {
  g.fx.ring(x, z, 0.3, r, color, 0.45); g.fx.ring(x, z, 0.2, r * 0.7, 0xffffff, 0.3, 0.15);
  for (let i = 0; i < 3; i++) g.fx.ring(x, z, 0.1, r * (0.4 + i * 0.3), color, 0.5, 0.05 + i * 0.12);
  sfx('resonate');
  for (const e of foes(g, x, z, r)) g.playerHit(e, { mult, kind: 'quake', element: 'resonance', heavy: true, kb: 8, dir: Math.atan2(e.x - x, e.z - z), ability: true });
}

// ---------------------------------------------------------------- Archer
// Briar Tether: foes stitched together share damage and snap apart
export class Tether extends Entity {
  constructor(g, members, mult, share) {
    super(g, members[0].x, members[0].z); this.members = members; this.mult = mult; this.share = share; this.t = 0; this.alwaysUpdate = true;
    for (const m of members) m.tether = this;
    sfx('tether');
  }
  update(dt) {
    const g = this.g; this.t += dt;
    this.members = this.members.filter(m => !m.dead);
    if (this.members.length < 2 || this.t > 5) return this.end(false);
    for (let i = 0; i < this.members.length - 1; i++) {
      const a = this.members[i], b = this.members[i + 1], d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 4.8) return this.end(true);
      const n = Math.ceil(d * 3);
      for (let k = 0; k <= n; k++) if (Math.random() < 0.35) { const u = k / n; g.fx.add({ x: a.x + (b.x - a.x) * u, y: 0.4 + Math.sin(u * Math.PI) * -0.1, z: a.z + (b.z - a.z) * u, g: 0, color: d > 3.8 ? 0xff8a5a : k % 2 ? 0x5a8a3a : 0x7fd36a, life: 0.06, size: 0.05 }); }
    }
  }
  end(snap) {
    const g = this.g;
    if (snap) {
      sfx('snap'); g.pr.addShake(0.25);
      for (const m of this.members) { g.fx.burst(m.x, 0.4, m.z, 10, [0x7fd36a, 0x5a8a3a], 3); g.playerHit(m, { mult: this.mult, kind: 'thorn', kb: 2, dir: 0, ability: true }); m.applyStatus && m.applyStatus('root', 1.2); }
    }
    for (const m of this.members) if (m.tether === this) m.tether = null;
    this.remove();
  }
}
// Stormpin Volley: four pins with lightning arcing between them
export class StormPins extends Entity {
  constructor(g, x, z, mult, r = 1.8) {
    super(g, x, z); this.mult = mult; this.t = 0; this.tick = 0.2; this.alwaysUpdate = true;
    this.pins = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + Math.PI / 4; let px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!g.shotClear(x, z, px, pz)) { px = x + Math.cos(a) * r * 0.4; pz = z + Math.sin(a) * r * 0.4; } return { x: px, z: pz }; });
    for (const p of this.pins) { const m = mesh([B(0.04, 0.5, 0.04, 0, 0, 0, 0x8a6a3a), B(0.08, 0.1, 0.08, 0, 0.5, 0, 0xd88a4a)], MAT_GLOW, false); m.position.set(p.x - x, 0, p.z - z); m.rotation.z = 0.15; this.obj.add(m); g.fx.burst(p.x, 0.3, p.z, 6, 0xd88a4a, 2); }
    this.sync(); sfx('thud');
  }
  update(dt) {
    const g = this.g; this.t += dt; this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.4; let n = 0;
      const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
      for (const [i, j] of pairs) {
        const a = this.pins[i], b = this.pins[j];
        bolt(g, a.x, a.z, b.x, b.z);
        for (const e of along(g, a.x, a.z, b.x, b.z, 0.35)) { g.playerHit(e, { mult: this.mult, kind: 'shock', kb: 0.5, dir: 0, ability: true, quiet: true }); n++; }
      }
      if (g.talent('staticfocus') && n) g.res = Math.min(100, g.res + 3 * n);
      sfx('zap');
    }
    if (this.t > 4) { for (const p of this.pins) g.fx.burst(p.x, 0.3, p.z, 5, 0xfff3b0, 1.5); this.remove(); }
  }
}
// Needle Rain: pinpoint barrage
export class NeedleRain extends Entity {
  constructor(g, x, z, mult, r) {
    super(g, x, z); this.mult = mult; this.r = r; this.t = 0; this.n = 0; this.alwaysUpdate = true;
    g.fx.ring(x, z, r - 0.08, r, 0xffd25e, 0.55, 0.03); g.fx.ring(x, z, 0.05, 0.25, 0xff5a4a, 0.55, 0.03); sfx('select');
  }
  update(dt) {
    const g = this.g; this.t += dt;
    while (this.t > 0.45 + this.n * 0.05 && this.n < 12) {
      this.n++;
      const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * this.r, x = this.x + Math.cos(a) * rr, z = this.z + Math.sin(a) * rr;
      g.fx.add({ x, y: 2.4, z, vy: -26, g: 0, drag: 0, color: 0xf0e0c0, life: 0.09, size: 0.05, stretch: 5 });
      g.fx.add({ x, y: 0.05, z, vy: 1, g: 6, color: 0xc8a878, life: 0.25, size: 0.04 });
      for (const e of foes(g, x, z, 0.55)) g.playerHit(e, { mult: this.mult, kind: 'needle', kb: 0.5, dir: 0, ability: true, quiet: this.n % 3 !== 0, critBonus: 20 });
      if (this.n % 3 === 0) sfx('cut');
    }
    if (this.n >= 12) this.remove();
  }
}

// ---------------------------------------------------------------- Witch
// Ember Garden: dormant seeds that fire sets off, chaining into each other
export class GardenSeed extends Entity {
  constructor(g, x, z, mult) {
    super(g, x, z); this.mult = mult; this.t = 0; this.fuse = -1; this.alwaysUpdate = true; this.isSeed = true;
    this.seed = mesh([B(0.18, 0.14, 0.18, 0, 0.02, 0, 0x8a3a1a), B(0.12, 0.08, 0.12, 0, 0.14, 0, 0xff8a2a), B(0.05, 0.12, 0.05, 0.04, 0.2, 0, 0x7fd36a, 0, 0, 0.4)], MAT_GLOW, false);
    this.obj.add(this.seed); this.sync();
  }
  ignite(delay = 0.12) { if (this.fuse < 0) { this.fuse = delay; this.g.fx.burst(this.x, 0.3, this.z, 6, 0xffd25e, 2); } }
  update(dt) {
    const g = this.g; this.t += dt;
    this.seed.scale.setScalar(1 + Math.sin(this.t * (this.fuse >= 0 ? 40 : 3)) * (this.fuse >= 0 ? 0.25 : 0.06));
    if (Math.random() < 0.08) g.fx.add({ x: this.x, y: 0.25, z: this.z, vy: 0.6, g: 0, color: 0xff8a2a, life: 0.5, size: 0.04 });
    if (this.fuse < 0) {
      // fire sets it off: burning foes brushing past, or any recent fire blast nearby
      if (this.t > 0.3 && foes(g, this.x, this.z, 0.7).some(e => e.status && e.status.burn > 0)) this.ignite();
      for (const f of g.fireEvents || []) if (g.time - f.t < 0.2 && Math.hypot(f.x - this.x, f.z - this.z) < f.r + 0.5) this.ignite();
      if (this.t > 6) this.ignite(0);
    } else {
      this.fuse -= dt;
      if (this.fuse <= 0) { blast(g, this.x, this.z, 1.5, this.mult, 0xff8a2a, { burn: true, ability: true }); this.remove(); }
    }
  }
}
// Glass Comet shards
export function cometShards(g, x, z, mult, n) {
  sfx('glass');
  const a0 = Math.random() * 6.28;
  for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; g.spawn(new Projectile(g, { x, z, dir: a, speed: 12, range: 4.5, mult: mult * 0.5, kind: 'shard', element: 'glass', pierce: 1, kb: 2, color: i % 2 ? 0xbfe8f0 : 0xff9a5a, ability: true, noCraft: true })); }
}
// Wither Hex: a delayed curse that stores damage and bursts
export class HexCurse extends Entity {
  constructor(g, target, mult) {
    super(g, target.x, target.z); this.target = target; this.mult = mult; this.t = 0; this.alwaysUpdate = true;
    target.hexStore = 0; target.hexed = this; target.applyStatus('hex', 3.2);
    sfx('hex');
  }
  update(dt) {
    const g = this.g, e = this.target; this.t += dt;
    if (!e.dead) { this.x = e.x; this.z = e.z; }
    if (Math.random() < 0.6) { const a = this.t * 6 + Math.random(); g.fx.add({ x: this.x + Math.cos(a) * 0.45, y: 0.3 + Math.random() * 0.6, z: this.z + Math.sin(a) * 0.45, vy: 0.6, g: 0, color: Math.random() < 0.5 ? 0xb88aff : 0x7fd36a, life: 0.5, size: 0.05 }); }
    if (this.t >= 3 || e.dead) this.burst();
  }
  burst() {
    const g = this.g, e = this.target;
    const stored = e.hexStore || 0; e.hexed = null;
    g.fx.ring(this.x, this.z, 0.2, 1.6, 0xb88aff, 0.4); g.fx.burst(this.x, 0.5, this.z, 18, [0xb88aff, 0x7fd36a, 0x2a1a3a], 4);
    sfx('hex'); g.pr.addShake(0.25);
    for (const o of foes(g, this.x, this.z, 1.6)) g.playerHit(o, { mult: this.mult, kind: 'hex', echo: true, kb: 4, dir: Math.atan2(o.x - this.x, o.z - this.z), ability: true });
    if (!e.dead && stored > 0) e.onHit({ dmg: Math.round(stored * 0.3), kind: 'hex', kb: 0, dir: 0, src: g.player });
    this.remove();
  }
}
// Mothstorm: a drifting swarm that follows the aim
export class MothSwarm extends Entity {
  constructor(g, x, z, mult, r, dur, speed) {
    super(g, x, z); Object.assign(this, { mult, r, dur, speed }); this.t = 0; this.tick = 0; this.alwaysUpdate = true;
    sfx('moth');
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt; this.tick -= dt;
    const tx = p.aimPt ? p.aimPt.x : p.x, tz = p.aimPt ? p.aimPt.z : p.z, d = Math.hypot(tx - this.x, tz - this.z);
    if (d > 0.3) { const k = Math.min(d, this.speed * dt) / d; const nx = this.x + (tx - this.x) * k, nz = this.z + (tz - this.z) * k; if (g.shotClear(this.x, this.z, nx, nz)) { this.x = nx; this.z = nz; } }
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * this.r; g.fx.add({ x: this.x + Math.cos(a) * rr, y: 0.3 + Math.random() * 0.8, z: this.z + Math.sin(a) * rr, vx: -Math.sin(a) * 1.5, vz: Math.cos(a) * 1.5, g: 0, drag: 0, color: i ? 0xf0ecd8 : 0xb88aff, life: 0.35, size: 0.06, wob: 4 }); }
    if (this.tick <= 0) {
      this.tick = 0.3;
      for (const e of foes(g, this.x, this.z, this.r)) g.playerHit(e, { mult: this.mult, kind: 'moth', kb: 0.3, dir: 0, ability: true, quiet: true });
      if (Math.random() < 0.3) sfx('moth');
    }
    if (this.t > this.dur) this.remove();
    this.sync();
  }
}
// Storm Thread: a held lightning link (lives on the player as state 'thread')
export function threadTick(g, p, e, t, mult) {
  const hx = p.x + Math.sin(p.facing) * 0.4, hz = p.z + Math.cos(p.facing) * 0.4;
  bolt(g, hx, hz, e.x, e.z);
  const k = 1 + Math.min(2, t / 1.5);
  g.playerHit(e, { mult: mult * k, kind: 'thread', element: 'lightning', kb: 0.3, dir: Math.atan2(e.x - p.x, e.z - p.z), ability: true, quiet: t < 2.5 });
  if (k > 2.5) g.fx.ring(e.x, e.z, 0.1, 0.7, 0xfff3b0, 0.15);
  sfx('thread');
}
export { soak, foes };
