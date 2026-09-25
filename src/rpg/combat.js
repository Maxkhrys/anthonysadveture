import { itemCombat } from './arpg/runtime.js';
// Friendly projectiles, ability effects, loot drops and loot chests.
import * as THREE from 'three';
import { Entity, move, tileBlocks } from '../entities/entity.js';
import { mesh, B, MAT_GLOW, MAT } from '../models.js';
import { sfx } from '../engine/audio.js';
import { RARITY, genItem } from './items.js';
import { weaponMesh } from '../hero.js';
import { weaponDrop } from '../weaponFx.js';
import { hasEngraving } from './crafting.js';

import { angDiff } from '../engine/util.js';
// closest approach of point (px,pz) to segment a->b: {t in [0,1], d}
export function segT(ax, az, bx, bz, px, pz) {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  return { t, d: Math.hypot(ax + vx * t - px, az + vz * t - pz) };
}
const enemiesNear = (g, x, z, r) => g.entities.filter(e => e.isEnemy && !e.dead && Math.hypot(e.x - x, e.z - z) < r + (e.r || 0.3));

// ---------------------------------------------------------------- projectiles
export class Projectile extends Entity {
  constructor(g, o) {
    super(g, o.x, o.z);
    Object.assign(this, { dir: o.dir, speed: o.speed ?? 14, range: o.range ?? 9, mult: o.mult ?? 1, kind: o.kind, pierce: o.pierce ?? 0, homing: o.homing ?? 0, seek: o.seek || null, dir0: o.dir, aoe: o.aoe ?? 0, ability: !!o.ability, kb: o.kb ?? 3, color: o.color ?? 0xffffff, noSplit: o.noSplit, noCraft: !!o.noCraft, root: o.root || 0, echo: !!o.echo, element: o.element || null, bounce: o.bounce || 0, onExplode: o.onExplode || null, onHitFx: o.onHitFx || null, basic: !!o.basic, charged: !!o.charged, critBonus: o.critBonus || 0 });
    this.arpgExtra=!!o.arpgExtra;
    // weapon-attack extras: heavy shots break guards, procCoeff scales item procs for rapid
    // attacks, onBeforeHit returns a damage factor for the target about to be hit
    this.heavy = !!o.heavy; this.procCoeff = o.procCoeff ?? 1; this.onBeforeHit = o.onBeforeHit || null;
    this.speed *= 1 + (g.pstats.projSpeed || 0) / 100;
    // Projectile Size affix: bigger hitbox and model (basic shots and abilities alike)
    const ps = 1 + (g.pstats.projSize || 0) / 100;
    this.r = (o.r ?? 0.18) * ps; this.moveMode = 'fly'; this.y = 0.45; this.hit = new Set(); this.dist = 0;
    this.gy0 = g.groundAt ? g.groundAt(o.x, o.z) : 0; // flies level from the height it was loosed at
    const u = g.pstats.uniques;
    if (this.kind === 'arrow' || this.kind === 'power') {
      if (u.has('windwhisper')) { this.pierce = 99; this.kb = 7; }
      const ec = this.echo ? 0x9ad8ff : null;
      this.m = mesh([B(0.04, 0.04, 0.6, 0, -0.02, 0, ec || 0x8a6a3a), B(0.08, 0.06, 0.1, 0, -0.03, 0.3, ec || 0xdfe8f0), B(0.1, 0.02, 0.12, 0, -0.01, -0.28, ec || (this.kind === 'power' ? 0xffd25e : 0xf0f0f0))], this.kind === 'power' || this.echo ? MAT_GLOW : MAT, false);
      if (this.kind === 'power') this.m.scale.setScalar(1.5);
    } else if (this.kind === 'crescent') {
      const c2 = this.element === 'wind' ? 0x9ad8ff : this.color === 0x7fd36a ? 0x7fd36a : 0xff6a6a;
      this.m = mesh([B(1.4, 0.06, 0.18, 0, 0, 0, 0xffffff), B(0.9, 0.05, 0.14, 0, 0, 0.12, c2), B(0.5, 0.04, 0.1, 0, 0, 0.22, c2)], MAT_GLOW, false);
    } else if (this.kind === 'shard') {
      this.m = mesh([B(0.06, 0.06, 0.26, 0, -0.03, 0, this.color), B(0.03, 0.03, 0.12, 0, -0.015, 0.1, 0xffffff)], MAT_GLOW, false);
    } else if (this.kind === 'comet') {
      this.m = mesh([B(0.5, 0.5, 0.5, 0, -0.25, 0, 0xff9a5a), B(0.36, 0.36, 0.36, 0, -0.18, 0, 0xfff3b0), B(0.2, 0.2, 0.6, 0, -0.1, -0.3, 0xbfe8f0)], MAT_GLOW, false);
    } else {
      const s = this.kind === 'fireball' ? 0.32 : this.kind === 'thorn' ? 0.1 : 0.18;
      this.m = mesh([B(s, s, s, 0, -s / 2, 0, this.color), B(s * 0.6, s * 0.6, s * 1.4, 0, -s * 0.3, 0, 0xffffff)], MAT_GLOW, false);
    }
    if (ps !== 1) this.m.scale.multiplyScalar(ps);
    this.obj.add(this.m);
    itemCombat(g).prepareProjectile(this, o);
  }
  update(dt) {
    if(this.kind==='bullet'&&dt>1/120){let left=dt;while(left>0&&!this.dead){const step=Math.min(left,1/120);this.update(step);left-=step;}return;}
    const g = this.g;
    // Singularity Wake (qualitative affix): basic shots tug nearby foes toward their path
    if (this.basic && g.pstats.qual.has('singularity_wake')) for (const e of g.entities) { if (!e.isEnemy || e.dead || e.isBoss) continue; const dx = this.x - e.x, dz = this.z - e.z, d = Math.hypot(dx, dz); if (d < 1.6 && d > 0.2) { e.kx += dx / d * 6 * dt * 4; e.kz += dz / d * 6 * dt * 4; } }
    // 'seek': an explicit, bounded bend toward a foe near the aimed line. It can never turn
    // the shot more than seek.cone away from where the player aimed.
    if (this.seek) {
      const S = this.seek;
      let best = null, bd = S.range;
      for (const e of g.entities) {
        if (!e.isEnemy || e.dead || this.hit.has(e)) continue;
        const d = Math.hypot(e.x - this.x, e.z - this.z);
        if (d >= bd) continue;
        if (Math.abs(angDiff(this.dir0, Math.atan2(e.x - this.x, e.z - this.z))) > S.cone) continue;
        bd = d; best = e;
      }
      if (best) {
        const d = angDiff(this.dir, Math.atan2(best.x - this.x, best.z - this.z));
        this.dir += Math.max(-S.rate * dt, Math.min(S.rate * dt, d));
        const off = angDiff(this.dir0, this.dir);
        if (Math.abs(off) > S.cone) this.dir = this.dir0 + Math.sign(off) * S.cone;
      }
    }
    if (this.homing) {
      let best = null, bd = 6;
      for (const e of g.entities) if (e.isEnemy && !e.dead && !this.hit.has(e)) { const d = Math.hypot(e.x - this.x, e.z - this.z); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const want = Math.atan2(best.x - this.x, best.z - this.z);
        let d = ((want - this.dir + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        this.dir += Math.max(-1, Math.min(1, d)) * this.homing * dt;
      }
    }
    this.speed = Math.min(40, this.speed + (this.acceleration || 0) * dt);
    const step = this.speed * dt;
    const x0 = this.x, z0 = this.z;
    let wall = move(g, this, Math.sin(this.dir) * step, Math.cos(this.dir) * step);
    // solid objects (doors, crates, pillars, villagers) stop shots too
    if (!wall) { const so = g.solidAt(this.x, this.z, this.r * 0.5); if (so) { wall = true; if (so.onShot) so.onShot(this); } }
    this.dist += step;
    this.obj.rotation.y = this.dir;
    if (this.kind !== 'arrow' && this.kind !== 'power' && this.kind !== 'crescent') this.m.rotation.x += dt * 12;
    if (Math.random() < 0.6) g.fx.add({ x: this.x, y: this.y, z: this.z, color: this.color, life: 0.25, size: this.kind === 'fireball' ? 0.1 : 0.05, g: 0 });
    // skimming water leaves a wake
    if (Math.random() < 0.35) { const tt = g.tileAt(Math.floor(this.x), Math.floor(this.z)); if (tt === 4 || tt === 5) g.fx.add({ x: this.x, y: -0.1, z: this.z, vy: 0.8, g: 6, color: 0xe8f8ff, life: 0.35, size: 0.05, floor: -0.14 }); }
    // swept test along this frame's whole path, so fast shots never skip small targets
    const hits = [];
    for (const e of g.entities) {
      if (!e.isEnemy || e.dead || this.hit.has(e)) continue;
      if (e.moveMode === 'fly' && e.alt > 1.6) continue;
      const t = segT(x0, z0, this.x, this.z, e.x, e.z);
      if (t.d > (e.r || 0.3) + this.r) continue;
      hits.push([t.t, e]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    for (const [, e] of hits) {
      this.hit.add(e);
      if (this.aoe) { this.x = e.x; this.z = e.z; return this.explode(); }
      this.hitResult = g.playerHit(e, { mult: this.mult * (this.onBeforeHit ? this.onBeforeHit(this, e) : 1), heavy: this.heavy || undefined, procCoeff: this.procCoeff, kind: this.kind, element: this.element, kb: this.kb, dir: this.dir, ability: this.ability, echo: this.echo, basic: this.basic, critBonus: this.critBonus + (this.manualGun&&this.gunOwner?.marked===e&&this.gunOwner.markUntil>g.time?20:0), arpgDepth: this.arpgDepth, arpgProc: this.arpgProc, noProc: this.arpgProc, arpgStatus: this.arpgStatus, arpgProjectile: this });
      this.onImpact(e);
      if (this.onHitFx) this.onHitFx(this, e);
      // Skipping Shot / Endless Quiver: turn toward the next foe instead of stopping
      if (this.bounce > 0) {
        const nxt = g.entities.filter(o => o.isEnemy && !o.dead && !this.hit.has(o) && Math.hypot(o.x - e.x, o.z - e.z) < 5 && g.shotClear(e.x, e.z, o.x, o.z)).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
        if (nxt) { this.bounce--; this.x = e.x; this.z = e.z; this.dir = this.dir0 = Math.atan2(nxt.x - e.x, nxt.z - e.z); this.dist = 0; this.range = 6; g.fx.ring(e.x, e.z, 0.05, 0.5, 0xffd25e, 0.15); this.sync(); return; }
      }
      if (this.pierce-- <= 0) { this.x = e.x; this.z = e.z; if (this.returning && !this.returned) { this.returned = true; this.dir += Math.PI; this.dist = 0; this.hit.clear(); this.hit.add(e); this.pierce = 1; } else return this.pop(); }
    }
    // spores and pods can be shot back
    for (const e of g.entities) if ((e.isProjectile && !e.friendly && e.reflect) && segT(x0, z0, this.x, this.z, e.x, e.z).d < 0.35) { e.reflect(this.dir); return this.pop(); }
    if (!wall && this.dist > this.range && this.returning && !this.returned) { this.returned = true; this.dir += Math.PI; this.dist = 0; this.hit.clear(); this.pierce = Math.max(this.pierce, 1); }
    if (wall || this.dist > this.range) { if (this.aoe) return this.explode(); return this.pop(); }
    this.sync();
    this.obj.position.y = this.y + this.gy0;
  }
  onImpact(e) {
    itemCombat(this.g).impact(this, e);
    const g = this.g, u = g.pstats.uniques;
    if (this.root && e.applyStatus) e.applyStatus('root', this.root);
    if ((this.kind === 'arrow' || this.kind === 'power') && u.has('sunshot')) { blast(g, e.x, e.z, 1.3, this.mult * 0.6, 0xff8a2a, { burn: true }); }
    if ((this.kind === 'arrow' || this.kind === 'power') && u.has('thornquill') && !this.noSplit) {
      for (const da of [-0.5, 0.5]) { const p = new Projectile(g, { x: this.x, z: this.z, dir: this.dir + da, speed: 12, range: 4, mult: this.mult * 0.4, kind: 'thorn', color: 0x7fd36a, noSplit: true }); p.hit = new Set([e]); g.spawn(p); }
    }
  }
  explode() {
    const g = this.g;
    const arpg = itemCombat(g);
    // An explosion is a heavy 'blast' (it breaks shield walls and guards, as it always did) and a
    // fireball's sets things alight; the ARPG item fields ride along so procs still trigger.
    const burn = this.kind === 'fireball' || this.kind === 'comet';
    const hit = blast(g, this.x, this.z, this.aoe, this.mult, this.color, { burn, element: this.element, ability: this.ability,
      extra: { arpgDepth: this.arpgDepth, arpgProc: this.arpgProc, noProc: this.arpgProc, arpgStatus: this.arpgStatus, arpgProjectile: this } });
    for (const target of hit) this.onImpact(target);
    arpg.ring(this, this.aoe, this.element);
    if (this.onExplode) this.onExplode(this);
    if (this.kind === 'fireball' && g.pstats.uniques.has('starfall')) g.spawn(new Meteor(g, this.x, this.z, this.mult * 1.2));
    if (this.kind === 'fireball' && !this.noCraft && hasEngraving(g, 'emberseeds')) {
      const a0 = Math.random() * 6.28;
      for (let i = 0; i < 3; i++) { const a = a0 + i * 2.094, x = this.x + Math.cos(a) * 1.1, z = this.z + Math.sin(a) * 1.1; g.spawn(new EmberSeed(g, g.shotClear(this.x, this.z, x, z) ? x : this.x, g.shotClear(this.x, this.z, x, z) ? z : this.z, this.mult * 0.7)); }
    }
    this.remove();
  }
  pop() { this.g.fx.burst(this.x, this.y, this.z, 5, this.color, 1.5, { life: 0.25, size: 0.05 }); this.remove(); }
}

// ---------------------------------------------------------------- crafted effects
// Echo Fletching: a spectral copy of a charged shot, re-fired along the original path.
export class EchoShot extends Entity {
  constructor(g, o) {
    super(g, o.x, o.z); this.o = o; this.t = 0; this.delay = o.delay ?? 0.6;
    this.obj.add(mesh([B(0.06, 0.06, 0.7, 0, 0, 0, 0x9ad8ff)], MAT_GLOW, false)); this.obj.rotation.y = o.dir; this.obj.position.y = 0.45 + (g.groundAt ? g.groundAt(o.x, o.z) : 0);
    this.alwaysUpdate = true;
  }
  update(dt) {
    if(this.kind==='bullet'&&dt>1/120){let left=dt;while(left>0&&!this.dead){const step=Math.min(left,1/120);this.update(step);left-=step;}return;}
    const g = this.g; this.t += dt;
    if (Math.random() < 0.5) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.3, y: 0.45, z: this.z + (Math.random() - 0.5) * 0.3, g: 0, color: 0x9ad8ff, life: 0.3, size: 0.05 });
    this.obj.scale.setScalar(1 + Math.sin(this.t * 30) * 0.1);
    if (this.t >= this.delay) {
      g.spawn(new Projectile(g, { ...this.o, mult: this.o.mult * 0.6, echo: true, noCraft: true, color: 0x9ad8ff }));
      g.fx.ring(this.x, this.z, 0.1, 0.8, 0x9ad8ff, 0.25); sfx('swing');
      this.remove();
    }
  }
}
// Ember Seeds: visible, swelling seeds that go off after a fixed delay.
export class EmberSeed extends Entity {
  constructor(g, x, z, mult) {
    super(g, x, z); this.mult = mult; this.t = 0; this.fuse = 1.2;
    this.seed = mesh([B(0.16, 0.12, 0.16, 0, 0.06, 0, 0xff8a2a), B(0.06, 0.1, 0.06, 0, 0.16, 0, 0x7fd36a)], MAT_GLOW, false); this.obj.add(this.seed);
    this.alwaysUpdate = true;
  }
  update(dt) {
    if(this.kind==='bullet'&&dt>1/120){let left=dt;while(left>0&&!this.dead){const step=Math.min(left,1/120);this.update(step);left-=step;}return;}
    const g = this.g; this.t += dt;
    const k = this.t / this.fuse;
    this.seed.scale.setScalar(1 + k * 1.2 + Math.sin(this.t * (10 + k * 30)) * 0.12 * k);
    if (Math.random() < 0.2 + k * 0.5) g.fx.add({ x: this.x, y: 0.2, z: this.z, vy: 1 + k, g: 0, color: k > 0.7 ? 0xffd25e : 0xff8a2a, life: 0.3, size: 0.05 });
    if (this.t >= this.fuse) { blast(g, this.x, this.z, 1.4, this.mult, 0xff8a2a, { burn: true, ability: true }); this.remove(); }
    this.sync();
  }
}
// Returning Cut: the Iaido path is cut again by an afterimage.
export class IaidoEcho extends Entity {
  constructor(g, x0, z0, x1, z1, mult) {
    super(g, x0, z0); Object.assign(this, { x0, z0, x1, z1, mult }); this.t = 0; this.hitSet = new Set(); this.alwaysUpdate = true;
    this.ghost = mesh([B(0.3, 0.5, 0.2, 0, 0.3, 0, 0x9ad8ff)], MAT_GLOW, false); this.obj.add(this.ghost);
  }
  update(dt) {
    if(this.kind==='bullet'&&dt>1/120){let left=dt;while(left>0&&!this.dead){const step=Math.min(left,1/120);this.update(step);left-=step;}return;}
    const g = this.g; this.t += dt;
    const k = Math.max(0, (this.t - 0.5) / 0.2);
    this.ghost.visible = this.t < 0.5 ? Math.floor(this.t * 20) % 2 === 0 : true;
    if (k > 0) {
      const kk = Math.min(1, k), x = this.x0 + (this.x1 - this.x0) * kk, z = this.z0 + (this.z1 - this.z0) * kk;
      this.x = x; this.z = z;
      if (Math.random() < 0.9) g.fx.add({ x, y: 0.4, z, color: 0x9ad8ff, life: 0.3, size: 0.08, g: 0 });
      for (const e of g.entities) {
        if (!e.isEnemy || e.dead || this.hitSet.has(e)) continue;
        if (segT(this.x0, this.z0, x, z, e.x, e.z).d > 1.0 + (e.r || 0.3)) continue;
        this.hitSet.add(e);
        g.playerHit(e, { mult: this.mult, kind: 'dash', kb: 4, dir: Math.atan2(this.x1 - this.x0, this.z1 - this.z0), ability: true });
      }
      if (k >= 1) { g.fx.arc(x, 0.35, z, Math.atan2(this.x1 - this.x0, this.z1 - this.z0), 1.2, 2.4, 0x9ad8ff, 0.18, 0.4); sfx('swing2'); this.remove(); return; }
    }
    this.sync();
  }
}
// Rime Bloom: a lingering ring of frost around a Frost Nova.
export class RimeField extends Entity {
  constructor(g, x, z, r = 3.2, dur = 3) {
    super(g, x, z); this.r = r; this.dur = dur; this.t = 0; this.tick = 0; this.alwaysUpdate = true;
    g.fx.ring(x, z, r - 0.1, r, 0xdff4ff, dur, 0.02);
  }
  update(dt) {
    if(this.kind==='bullet'&&dt>1/120){let left=dt;while(left>0&&!this.dead){const step=Math.min(left,1/120);this.update(step);left-=step;}return;}
    const g = this.g; this.t += dt; this.tick -= dt;
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * this.r; g.fx.add({ x: this.x + Math.cos(a) * rr, y: 0.05, z: this.z + Math.sin(a) * rr, vy: 0.3, g: 0, color: 0xdff4ff, life: 0.6, size: 0.05 }); }
    if (this.tick <= 0) { this.tick = 0.25; for (const e of enemiesNear(g, this.x, this.z, this.r)) e.applyStatus && e.applyStatus('chill', 0.6); }
    if (this.t > this.dur) this.remove();
  }
}

export function blast(g, x, z, r, mult, color, o = {}) {
  g.fx.ring(x, z, 0.2, r, color, 0.35);
  g.fx.burst(x, 0.4, z, 16, [color, 0xffffff], 3.5, { life: 0.45 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.fx.add({ x: x + Math.cos(a) * r * 0.4, y: 0.2, z: z + Math.sin(a) * r * 0.4, vx: Math.cos(a) * 1.2, vz: Math.sin(a) * 1.2, vy: 0.5, g: 0, drag: 1.5, color: o.burn ? 0x5a3a2a : 0xd8d0e0, life: 0.8, size: 0.16, grow: 1.4, shrink: false, soft: true }); }
  sfx('poof'); g.pr.addShake(0.2);
  // fire blasts are remembered for a moment so seeds and fuses nearby can catch
  if (o.burn) { (g.fireEvents || (g.fireEvents = [])).push({ x, z, r, t: g.time }); if (g.fireEvents.length > 24) g.fireEvents.shift(); }
  const hit = enemiesNear(g, x, z, r);
  for (const e of hit) {
    g.playerHit(e, { ...(o.extra || {}), mult, kind: 'blast', element: o.burn ? 'fire' : o.element || 'arcane', kb: 5, dir: Math.atan2(e.x - x, e.z - z), ability: o.ability, forceBurn: o.burn, echo: o.echo });
    if (o.root) e.applyStatus && e.applyStatus('root', o.root);
  }
  return hit;
}

// ---------------------------------------------------------------- ability effects
export class Trap extends Entity {
  constructor(g, x, z, mult, rootT, rearm = false) {
    super(g, x, z); this.mult = mult; this.rootT = rootT; this.t = 0; this.rearm = rearm;
    this.obj.add(mesh([B(0.6, 0.06, 0.6, 0, 0, 0, 0x6a4a2a), B(0.5, 0.1, 0.08, 0, 0.05, 0.22, 0xc0c0d0), B(0.5, 0.1, 0.08, 0, 0.05, -0.22, 0xc0c0d0), B(0.12, 0.12, 0.12, 0, 0.06, 0, 0xffd25e)]));
    this.alwaysUpdate = false;
  }
  update(dt) {
    this.t += dt;
    if (this.t > 20) return this.remove();
    if (this.t < 0.35) return this.sync();
    if (this.pending !== undefined) {
      // Echo Snare: the same spot springs again a moment later
      this.pending -= dt;
      if (Math.random() < 0.4) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.8, y: 0.1, z: this.z + (Math.random() - 0.5) * 0.8, vy: 1, g: 0, color: 0x9ad8ff, life: 0.4, size: 0.05 });
      if (this.pending <= 0) { sfx('thud'); blast(this.g, this.x, this.z, 1.9, this.mult, 0x9ad8ff, { root: this.rootT, ability: true }); this.remove(); }
      return;
    }
    if (enemiesNear(this.g, this.x, this.z, 0.7).length) {
      sfx('thud');
      blast(this.g, this.x, this.z, 1.9, this.mult, 0xffd25e, { root: this.rootT, ability: true });
      if (this.rearm) { this.pending = 1.0; this.g.fx.ring(this.x, this.z, 0.2, 1.9, 0x9ad8ff, 1.0, 0.05); }
      else this.remove();
    }
  }
}
export class RainZone extends Entity {
  constructor(g, x, z, mult, dur = 2.2) { super(g, x, z); this.mult = mult; this.t = 0; this.tick = 0; this.dur = dur; g.fx.ring(x, z, 2.5, 2.6, 0x7fd36a, dur, 0.05); }
  update(dt) {
    if(this.kind==='bullet'&&dt>1/120){let left=dt;while(left>0&&!this.dead){const step=Math.min(left,1/120);this.update(step);left-=step;}return;}
    const g = this.g; this.t += dt; this.tick -= dt;
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = Math.random() * 2.5; g.fx.add({ x: this.x + Math.cos(a) * r, y: 3, z: this.z + Math.sin(a) * r, vy: -14, g: 0, drag: 0, color: 0xe8e0d0, life: 0.2, size: 0.05, stretch: 4 }); }
    if (this.tick <= 0) { this.tick = 0.25; for (const e of enemiesNear(g, this.x, this.z, 2.5)) { g.playerHit(e, { mult: this.mult, kind: 'rain', kb: 0.5, dir: 0, ability: true, quiet: true }); if (this.wet) e.applyStatus && e.applyStatus('wet', 4); } sfx('cut'); }
    if (this.t > this.dur) this.remove();
  }
}
export class Meteor extends Entity {
  constructor(g, x, z, mult) {
    super(g, x, z); this.mult = mult; this.t = 0;
    this.star = mesh([B(0.5, 0.5, 0.5, 0, 0, 0, 0xfff3b0), B(0.3, 0.3, 0.7, 0, 0.1, 0, 0xffb347)], MAT_GLOW, false); this.obj.add(this.star);
  }
  update(dt) {
    this.t += dt; const k = this.t / 0.55;
    this.star.position.set(-3 * (1 - k), 7 * (1 - k), -2 * (1 - k)); this.star.rotation.x += dt * 8;
    if (k >= 1) { blast(this.g, this.x, this.z, 2.3, this.mult, 0xffb347, { burn: true, ability: true }); this.g.pr.addShake(0.6); this.remove(); }
  }
}
export class Familiar extends Entity {
  constructor(g, mult, dur, fast) {
    super(g, g.player.x, g.player.z); this.mult = mult; this.t = 0; this.dur = dur; this.cool = 0; this.rate = (fast ? 0.3 : 0.6) / (1 + 0.25 * (g.talent ? g.talent('grimalkin') : 0));
    this.obj.add(mesh([B(0.3, 0.26, 0.36, 0, 0, 0, 0x2a1a3a), B(0.08, 0.12, 0.06, -0.08, 0.26, 0.1, 0x2a1a3a), B(0.08, 0.12, 0.06, 0.08, 0.26, 0.1, 0x2a1a3a), B(0.06, 0.2, 0.06, 0, 0.1, -0.24, 0x2a1a3a)]));
    this.obj.add(mesh([B(0.06, 0.05, 0.02, -0.07, 0.16, 0.19, 0x7fd36a), B(0.06, 0.05, 0.02, 0.07, 0.16, 0.19, 0x7fd36a)], MAT_GLOW, false));
    this.alwaysUpdate = true; this.isFamiliar = true;
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    if (this.t > this.dur || p.state === 'dead') { g.fx.burst(this.x, 0.8, this.z, 12, 0x8b5cf6, 2); return this.remove(); }
    const a = this.t * 2;
    this.x += (p.x + Math.cos(a) * 1.1 - this.x) * Math.min(1, dt * 6); this.z += (p.z + Math.sin(a) * 1.1 - this.z) * Math.min(1, dt * 6);
    this.cool -= dt;
    if (this.cool <= 0) {
      const t = enemiesNear(g, this.x, this.z, 7).sort((a, b) => Math.hypot(a.x - this.x, a.z - this.z) - Math.hypot(b.x - this.x, b.z - this.z))[0];
      if (t) { this.cool = this.rate; g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: Math.atan2(t.x - this.x, t.z - this.z), speed: 11, mult: this.mult, kind: 'bolt', homing: 4, color: 0x9a6aff, ability: true })); sfx('shoot'); }
    }
    if (Math.random() < 0.2) g.fx.add({ x: this.x, y: 0.7, z: this.z, color: 0x8b5cf6, life: 0.4, size: 0.05, g: -0.5 });
    this.facing = Math.atan2(p.x - this.x, p.z - this.z);
    this.obj.rotation.y = this.facing;
    this.sync(); this.obj.position.y = (this.gy || 0) + 0.7 + Math.sin(this.t * 5) * 0.08;
  }
}
export function frostNova(g, x, z, mult, freezeT) {
  g.fx.ring(x, z, 0.3, 3.2, 0xaee8ff, 0.4); g.fx.ring(x, z, 0.2, 2.4, 0xffffff, 0.3, 0.3);
  g.fx.burst(x, 0.3, z, 30, [0xaee8ff, 0xffffff], 5, { life: 0.5 });
  sfx('extinguish'); sfx('parry');
  for (const e of enemiesNear(g, x, z, 3.2)) { g.playerHit(e, { mult, kind: 'frost', kb: 2, dir: Math.atan2(e.x - x, e.z - z), ability: true }); e.applyStatus && e.applyStatus('freeze', freezeT); }
}
export function chainLightning(g, x, z, mult, n, range = 7, first = null) {
  let from = { x, z }, hit = new Set();
  for (let i = 0; i < n; i++) {
    const seekWet = g.talent && g.talent('conductor');
    const score = e => Math.hypot(e.x - from.x, e.z - from.z) - (seekWet && e.status && (e.status.wet > 0 || e.status.freeze > 0) ? 3 : 0);
    const t = i === 0 && first && !first.dead ? first : g.entities.filter(e => e.isEnemy && !e.dead && !hit.has(e) && Math.hypot(e.x - from.x, e.z - from.z) < (i ? (e.status && e.status.wet > 0 ? 6.5 : 4.5) : range)).sort((a, b) => score(a) - score(b))[0];
    if (!t) break;
    hit.add(t);
    bolt(g, from.x, from.z, t.x, t.z);
    g.playerHit(t, { mult: mult * Math.pow(0.85, i), kind: 'shock', kb: 1, dir: Math.atan2(t.x - from.x, t.z - from.z), ability: true, noShock: true });
    from = t;
  }
  if (hit.size) sfx('clang');
  return hit.size;
}
export function bolt(g, x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 5);
  for (let i = 0; i <= n; i++) { const k = i / n; g.fx.add({ x: x0 + (x1 - x0) * k + (Math.random() - 0.5) * 0.25, y: 0.5 + (Math.random() - 0.5) * 0.3, z: z0 + (z1 - z0) * k + (Math.random() - 0.5) * 0.25, color: i % 3 ? 0xdff4ff : 0x9ad8ff, life: 0.18, size: 0.07, g: 0 }); }
}
export function thornBurst(g, x, z, mult) {
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.fx.add({ x: x + Math.cos(a) * 0.8, y: 0.05, z: z + Math.sin(a) * 0.8, vy: 4, g: 10, color: 0x5a8a3a, life: 0.4, size: 0.14 }); }
  for (const e of enemiesNear(g, x, z, 1.4)) g.playerHit(e, { mult, kind: 'thorn', kb: 1, dir: 0, quiet: true, noProc: true });
}

// ---------------------------------------------------------------- loot on the ground
export class GearDrop extends Entity {
  constructor(g, x, z, item) {
    super(g, x, z);
    this.item = item; this.t = 0; this.r = 0.25;
    this.moveMode='walk';
    const clear=(x,z)=>{const probe={x,z,r:.25,moveMode:'walk'};return !tileBlocks(g,Math.floor(x),Math.floor(z),probe)&&!g.solids.some(s=>s.solid&&!s.dead&&Math.abs(s.x-x)<s.hw+.3&&Math.abs(s.z-z)<s.hd+.3);};
    if(!clear(this.x,this.z)){
      let spot=null;for(let r=1;r<=5&&!spot;r++)for(let a=0;a<16;a++){const xx=x+Math.cos(a*Math.PI/8)*r*.5,zz=z+Math.sin(a*Math.PI/8)*r*.5;if(clear(xx,zz)){spot=[xx,zz];break;}}
      if(spot)[this.x,this.z]=spot; else if(g.player&&clear(g.player.x,g.player.z))[this.x,this.z]=[g.player.x,g.player.z];
    }
    const R = item.prismatic ? {...RARITY[item.r],hex:0x93dfff} : RARITY[item.r];
    const col = item.slot === 'weapon' ? 0xdfe8f0 : item.slot === 'charm' ? 0xffd25e : 0xa08a6a;
    this.icon = mesh(item.slot === 'weapon' ? [B(0.06, 0.5, 0.06, 0, 0, 0, col), B(0.2, 0.05, 0.08, 0, 0.12, 0, R.hex)] : [B(0.3, 0.26, 0.2, 0, 0, 0, col), B(0.32, 0.06, 0.22, 0, 0.2, 0, R.hex)], MAT_GLOW, false);
    // weapons: the real model over a rarity glow (weaponFx.js); other gear keeps its token
    if (item.slot === 'weapon') { this.icon.geometry?.dispose(); this.drop = weaponDrop(item, weaponMesh); this.icon = this.drop.icon; this.obj.add(this.drop.group); }
    else { this.icon.rotation.z = 0.6; this.obj.add(this.icon); }
    if (item.r >= 1 && !this.drop) {
      const h = [0, 1.2, 2.2, 3.5, 6, 6][item.r]||6;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16 + item.r * 0.04, h, 0.16 + item.r * 0.04), new THREE.MeshBasicMaterial({ color: R.hex, transparent: true, opacity: 0.45, depthWrite: false }));
      beam.position.y = h / 2; this.obj.add(beam); this.beam = beam;
    }
    this.vy = 4; this.y = 0.3; const a = Math.random() * 6.28; this.vx = Math.cos(a) * 1.2; this.vz = Math.sin(a) * 1.2;
    if (item.r >= 2 && g.onScreen(x,z,.2)) { sfx('lootbell');g.fx.ring(x,z,.15,item.r>=4?1.4:.85,R.hex,.65);g.ui.float(x,1,z,item.prismatic?'PRISMATIC':item.r>=4?'LEGENDARY':item.r===3?'EPIC':'RARE',R.color,true); }
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    this.vy -= 14 * dt; this.y = Math.max(0.2, this.y + this.vy * dt);
    if (this.y <= 0.2) { this.vx *= 0.8; this.vz *= 0.8; this.vy = 0; }
    // loot lands only where the player can stand (not inside props, over ledges or in water),
    // then drifts to you once you're close, so a drop can never end up out of reach
    this.moveMode = 'walk'; move(g, this, this.vx * dt, this.vz * dt);
    const pickupRange=g.pstats.uniques.has('travelantern')?2.6:1.8;
    const dp = Math.hypot(p.x - this.x, p.z - this.z);
    if (this.t > 0.5 && dp < pickupRange && dp > 0.05 && p.state !== 'dead' && !this.warned) { const k = Math.min(1, dt * (4 + (pickupRange - dp) * 6)) / dp; move(g, this, (p.x - this.x) * k * dp * 0.5, (p.z - this.z) * k * dp * 0.5); }
    if (this.drop) this.drop.update(dt, this, g);
    else { this.icon.rotation.y += dt * 2; this.icon.position.y = this.y + Math.sin(this.t * 3) * 0.05; }
    if (this.beam) this.beam.material.opacity = 0.35 + Math.sin(this.t * 4) * 0.12;
    if (!this.drop && this.item.r >= 2 && Math.random() < 0.15) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.4, y: 0.2, z: this.z + (Math.random() - 0.5) * 0.4, vy: 1.4, g: 0, color: RARITY[this.item.r].hex, life: 0.8, size: 0.05 });
    if (this.t > 0.5 && Math.hypot(p.x - this.x, p.z - this.z) < 0.8 && p.state !== 'dead') {
      if (g.pickupItem(this.item)) this.remove();
      else if (!this.warned) { this.warned = true; g.ui.toast('Your bag is full!', 'Press E and salvage something.', 2); }
    } else if (Math.hypot(p.x - this.x, p.z - this.z) > 2.2) this.warned = false;
    this.obj.position.set(this.x, g.groundAt ? g.groundAt(this.x, this.z) : 0, this.z);
  }
}

// ---------------------------------------------------------------- loot chests
const TIERS = [
  { name: 'Wooden Chest', wood: 0x9a6a3a, trim: 0xd0a040, items: [1, 2], floor: 0, bonus: 0, pips: [5, 20] },
  { name: 'Iron Chest', wood: 0x5a5a6a, trim: 0xc0c0d0, items: [2, 3], floor: 1, bonus: 0.3, pips: [20, 50] },
  { name: 'Gilded Chest', wood: 0x7a3a8a, trim: 0xffd25e, items: [3, 4], floor: 2, bonus: 0.8, pips: [50, 120] },
];
export class LootChest extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.id = d.id; this.tier = d.tier ?? 0; this.level = d.level ?? 1;
    const T = TIERS[this.tier];
    this.solid = true; this.hw = 0.4; this.hd = 0.3; this.interactable = true;
    this.opened = !!g.flags['chest:' + this.id];
    const s = 1 + this.tier * 0.12;
    this.obj.add(mesh([B(0.7 * s, 0.34 * s, 0.5 * s, 0, 0, 0, T.wood), B(0.74 * s, 0.06, 0.54 * s, 0, 0.1, 0, T.trim), B(0.1, 0.12, 0.04, 0, 0.18 * s, 0.26 * s, T.trim)]));
    this.lid = new THREE.Group(); this.lid.position.set(0, 0.34 * s, -0.25 * s);
    this.lid.add(mesh([B(0.7 * s, 0.16 * s, 0.5 * s, 0, 0, 0.25 * s, T.wood), B(0.74 * s, 0.05, 0.54 * s, 0, 0.14 * s, 0.25 * s, T.trim)]));
    this.obj.add(this.lid);
    if (this.opened) this.lid.rotation.x = -1.9;
    this.t = Math.random() * 6;
  }
  get prompt() { return this.opened ? null : 'Open ' + TIERS[this.tier].name; }
  interact() {
    if (this.opened) return;
    const g = this.g, T = TIERS[this.tier];
    this.opened = true; this.openT = 0; g.flags['chest:' + this.id] = true;
    sfx('chest'); g.fx.burst(this.x, 0.6, this.z, 20, [0xffffff, T.trim], 3);
    const n = T.items[0] + Math.floor(Math.random() * (T.items[1] - T.items[0] + 1));
    const lvl = Math.max(this.level, g.inv.level - 1);
    setTimeout(() => {
      for (let i = 0; i < n; i++) g.spawn(new GearDrop(g, this.x, this.z + 0.5, genItem({ level: lvl, cls: g.inv.cls, mf: g.pstats.mf, floor: T.floor, bonus: T.bonus })));
      import('../entities/common.js').then(m => m.dropPips(g, this.x, this.z + 0.5, T.pips[0] + Math.floor(Math.random() * (T.pips[1] - T.pips[0]))));
      g.gainXp(10 + this.tier * 15);
    }, 250);
    g.stats.chests = (g.stats.chests || 0) + 1;
    g.guide.event('chest');
    g.story.bountyEvent(['chest']);
  }
  update(dt) {
    this.t += dt;
    if (this.openT !== undefined && this.openT < 1) { this.openT += dt * 3; this.lid.rotation.x = -1.9 * Math.min(1, this.openT); }
    if (!this.opened && this.tier >= 1 && Math.random() < 0.05) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.6, y: 0.5, z: this.z, vy: 0.8, g: 0, color: TIERS[this.tier].trim, life: 0.7, size: 0.04 });
    this.sync();
  }
}
