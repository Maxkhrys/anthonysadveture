// Friendly projectiles, ability effects, loot drops and loot chests.
import * as THREE from 'three';
import { Entity, move } from '../entities/entity.js';
import { mesh, B, MAT_GLOW, MAT } from '../models.js';
import { sfx } from '../engine/audio.js';
import { RARITY, genItem } from './items.js';

const enemiesNear = (g, x, z, r) => g.entities.filter(e => e.isEnemy && !e.dead && Math.hypot(e.x - x, e.z - z) < r + (e.r || 0.3));

// ---------------------------------------------------------------- projectiles
export class Projectile extends Entity {
  constructor(g, o) {
    super(g, o.x, o.z);
    Object.assign(this, { dir: o.dir, speed: o.speed ?? 14, range: o.range ?? 9, mult: o.mult ?? 1, kind: o.kind, pierce: o.pierce ?? 0, homing: o.homing ?? 0, aoe: o.aoe ?? 0, ability: !!o.ability, kb: o.kb ?? 3, color: o.color ?? 0xffffff, noSplit: o.noSplit });
    this.r = o.r ?? 0.18; this.moveMode = 'fly'; this.y = 0.45; this.hit = new Set(); this.dist = 0;
    const u = g.pstats.uniques;
    if (this.kind === 'arrow' || this.kind === 'power') {
      if (u.has('windwhisper')) { this.pierce = 99; this.kb = 7; }
      this.m = mesh([B(0.04, 0.04, 0.6, 0, -0.02, 0, 0x8a6a3a), B(0.08, 0.06, 0.1, 0, -0.03, 0.3, 0xdfe8f0), B(0.1, 0.02, 0.12, 0, -0.01, -0.28, this.kind === 'power' ? 0xffd25e : 0xf0f0f0)], this.kind === 'power' ? MAT_GLOW : MAT, false);
      if (this.kind === 'power') this.m.scale.setScalar(1.5);
    } else if (this.kind === 'crescent') {
      this.m = mesh([B(1.4, 0.06, 0.18, 0, 0, 0, 0xffffff), B(0.9, 0.05, 0.14, 0, 0, 0.12, 0xff6a6a)], MAT_GLOW, false);
    } else {
      const s = this.kind === 'fireball' ? 0.32 : this.kind === 'thorn' ? 0.1 : 0.18;
      this.m = mesh([B(s, s, s, 0, -s / 2, 0, this.color), B(s * 0.6, s * 0.6, s * 1.4, 0, -s * 0.3, 0, 0xffffff)], MAT_GLOW, false);
    }
    this.obj.add(this.m);
  }
  update(dt) {
    const g = this.g;
    if (this.homing) {
      let best = null, bd = 6;
      for (const e of g.entities) if (e.isEnemy && !e.dead && !this.hit.has(e)) { const d = Math.hypot(e.x - this.x, e.z - this.z); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const want = Math.atan2(best.x - this.x, best.z - this.z);
        let d = ((want - this.dir + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        this.dir += Math.max(-1, Math.min(1, d)) * this.homing * dt;
      }
    }
    const step = this.speed * dt;
    const wall = move(g, this, Math.sin(this.dir) * step, Math.cos(this.dir) * step);
    this.dist += step;
    this.obj.rotation.y = this.dir;
    if (this.kind !== 'arrow' && this.kind !== 'power' && this.kind !== 'crescent') this.m.rotation.x += dt * 12;
    if (Math.random() < 0.6) g.fx.add({ x: this.x, y: this.y, z: this.z, color: this.color, life: 0.25, size: this.kind === 'fireball' ? 0.1 : 0.05, g: 0 });
    for (const e of g.entities) {
      if (!e.isEnemy || e.dead || this.hit.has(e)) continue;
      if (e.moveMode === 'fly' && e.alt > 1.6) continue;
      if (Math.hypot(e.x - this.x, e.z - this.z) > (e.r || 0.3) + this.r) continue;
      this.hit.add(e);
      if (this.aoe) return this.explode();
      g.playerHit(e, { mult: this.mult, kind: this.kind, kb: this.kb, dir: this.dir, ability: this.ability });
      this.onImpact(e);
      if (this.pierce-- <= 0) return this.pop();
    }
    // spores and pods can be shot back
    for (const e of g.entities) if ((e.isProjectile && !e.friendly && e.reflect) && Math.hypot(e.x - this.x, e.z - this.z) < 0.35) { e.reflect(this.dir); return this.pop(); }
    if (wall || this.dist > this.range) { if (this.aoe) return this.explode(); return this.pop(); }
    this.sync();
    this.obj.position.y = this.y;
  }
  onImpact(e) {
    const g = this.g, u = g.pstats.uniques;
    if ((this.kind === 'arrow' || this.kind === 'power') && u.has('sunshot')) { blast(g, e.x, e.z, 1.3, this.mult * 0.6, 0xff8a2a, { burn: true }); }
    if ((this.kind === 'arrow' || this.kind === 'power') && u.has('thornquill') && !this.noSplit) {
      for (const da of [-0.5, 0.5]) { const p = new Projectile(g, { x: this.x, z: this.z, dir: this.dir + da, speed: 12, range: 4, mult: this.mult * 0.4, kind: 'thorn', color: 0x7fd36a, noSplit: true }); p.hit = new Set([e]); g.spawn(p); }
    }
  }
  explode() {
    const g = this.g;
    blast(g, this.x, this.z, this.aoe, this.mult, this.color, { burn: this.kind === 'fireball', ability: this.ability });
    if (this.kind === 'fireball' && g.pstats.uniques.has('starfall')) g.spawn(new Meteor(g, this.x, this.z, this.mult * 1.2));
    this.remove();
  }
  pop() { this.g.fx.burst(this.x, this.y, this.z, 5, this.color, 1.5, { life: 0.25, size: 0.05 }); this.remove(); }
}

export function blast(g, x, z, r, mult, color, o = {}) {
  g.fx.ring(x, z, 0.2, r, color, 0.35);
  g.fx.burst(x, 0.4, z, 16, [color, 0xffffff], 3.5, { life: 0.45 });
  sfx('poof'); g.pr.addShake(0.2);
  for (const e of enemiesNear(g, x, z, r)) {
    g.playerHit(e, { mult, kind: 'blast', kb: 5, dir: Math.atan2(e.x - x, e.z - z), ability: o.ability, forceBurn: o.burn });
    if (o.root) e.applyStatus && e.applyStatus('root', o.root);
  }
}

// ---------------------------------------------------------------- ability effects
export class Trap extends Entity {
  constructor(g, x, z, mult, rootT) {
    super(g, x, z); this.mult = mult; this.rootT = rootT; this.t = 0;
    this.obj.add(mesh([B(0.6, 0.06, 0.6, 0, 0, 0, 0x6a4a2a), B(0.5, 0.1, 0.08, 0, 0.05, 0.22, 0xc0c0d0), B(0.5, 0.1, 0.08, 0, 0.05, -0.22, 0xc0c0d0), B(0.12, 0.12, 0.12, 0, 0.06, 0, 0xffd25e)]));
    this.alwaysUpdate = false;
  }
  update(dt) {
    this.t += dt;
    if (this.t > 20) return this.remove();
    if (this.t < 0.35) return this.sync();
    if (enemiesNear(this.g, this.x, this.z, 0.7).length) {
      sfx('thud');
      blast(this.g, this.x, this.z, 1.9, this.mult, 0xffd25e, { root: this.rootT, ability: true });
      this.remove();
    }
  }
}
export class RainZone extends Entity {
  constructor(g, x, z, mult, dur = 2.2) { super(g, x, z); this.mult = mult; this.t = 0; this.tick = 0; this.dur = dur; g.fx.ring(x, z, 2.5, 2.6, 0x7fd36a, dur, 0.05); }
  update(dt) {
    const g = this.g; this.t += dt; this.tick -= dt;
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = Math.random() * 2.5; g.fx.add({ x: this.x + Math.cos(a) * r, y: 3, z: this.z + Math.sin(a) * r, vy: -14, g: 0, drag: 0, color: 0xe8e0d0, life: 0.2, size: 0.05, stretch: 4 }); }
    if (this.tick <= 0) { this.tick = 0.25; for (const e of enemiesNear(g, this.x, this.z, 2.5)) g.playerHit(e, { mult: this.mult, kind: 'rain', kb: 0.5, dir: 0, ability: true, quiet: true }); sfx('cut'); }
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
    super(g, g.player.x, g.player.z); this.mult = mult; this.t = 0; this.dur = dur; this.cool = 0; this.rate = fast ? 0.3 : 0.6;
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
    this.sync(); this.obj.position.y = 0.7 + Math.sin(this.t * 5) * 0.08;
  }
}
export function frostNova(g, x, z, mult, freezeT) {
  g.fx.ring(x, z, 0.3, 3.2, 0xaee8ff, 0.4); g.fx.ring(x, z, 0.2, 2.4, 0xffffff, 0.3, 0.3);
  g.fx.burst(x, 0.3, z, 30, [0xaee8ff, 0xffffff], 5, { life: 0.5 });
  sfx('extinguish'); sfx('parry');
  for (const e of enemiesNear(g, x, z, 3.2)) { g.playerHit(e, { mult, kind: 'frost', kb: 2, dir: Math.atan2(e.x - x, e.z - z), ability: true }); e.applyStatus && e.applyStatus('freeze', freezeT); }
}
export function chainLightning(g, x, z, mult, n, range = 7) {
  let from = { x, z }, hit = new Set();
  for (let i = 0; i < n; i++) {
    const t = g.entities.filter(e => e.isEnemy && !e.dead && !hit.has(e) && Math.hypot(e.x - from.x, e.z - from.z) < (i ? 4.5 : range)).sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0];
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
    const R = RARITY[item.r];
    const col = item.slot === 'weapon' ? 0xdfe8f0 : item.slot === 'charm' ? 0xffd25e : 0xa08a6a;
    this.icon = mesh(item.slot === 'weapon' ? [B(0.06, 0.5, 0.06, 0, 0, 0, col), B(0.2, 0.05, 0.08, 0, 0.12, 0, R.hex)] : [B(0.3, 0.26, 0.2, 0, 0, 0, col), B(0.32, 0.06, 0.22, 0, 0.2, 0, R.hex)], MAT_GLOW, false);
    this.icon.rotation.z = 0.6; this.obj.add(this.icon);
    if (item.r >= 1) {
      const h = [0, 1.2, 2.2, 3.5, 6][item.r];
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16 + item.r * 0.04, h, 0.16 + item.r * 0.04), new THREE.MeshBasicMaterial({ color: R.hex, transparent: true, opacity: 0.45, depthWrite: false }));
      beam.position.y = h / 2; this.obj.add(beam); this.beam = beam;
    }
    this.vy = 4; this.y = 0.3; const a = Math.random() * 6.28; this.vx = Math.cos(a) * 1.2; this.vz = Math.sin(a) * 1.2;
    if (item.r >= 3) { sfx(item.r === 4 ? 'fanfare' : 'secret'); g.pr.addFlash(0.2, R.hex); }
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    this.vy -= 14 * dt; this.y = Math.max(0.2, this.y + this.vy * dt);
    if (this.y <= 0.2) { this.vx *= 0.8; this.vz *= 0.8; this.vy = 0; }
    this.moveMode = 'fly'; move(g, this, this.vx * dt, this.vz * dt);
    this.icon.rotation.y += dt * 2; this.icon.position.y = this.y + Math.sin(this.t * 3) * 0.05;
    if (this.beam) this.beam.material.opacity = 0.35 + Math.sin(this.t * 4) * 0.12;
    if (this.item.r >= 2 && Math.random() < 0.15) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.4, y: 0.2, z: this.z + (Math.random() - 0.5) * 0.4, vy: 1.4, g: 0, color: RARITY[this.item.r].hex, life: 0.8, size: 0.05 });
    if (this.t > 0.5 && Math.hypot(p.x - this.x, p.z - this.z) < 0.55 && p.state !== 'dead') {
      if (g.pickupItem(this.item)) this.remove();
      else if (!this.warned) { this.warned = true; g.ui.toast('Your bag is full!', 'Press I and salvage something.', 2); }
    } else if (Math.hypot(p.x - this.x, p.z - this.z) > 1.2) this.warned = false;
    this.obj.position.set(this.x, 0, this.z);
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
      for (let i = 0; i < n; i++) g.spawn(new GearDrop(g, this.x, this.z + 0.5, genItem({ level: lvl, cls: Math.random() < 0.75 ? g.inv.cls : null, mf: g.pstats.mf, floor: T.floor, bonus: T.bonus })));
      import('../entities/common.js').then(m => m.dropPips(g, this.x, this.z + 0.5, T.pips[0] + Math.floor(Math.random() * (T.pips[1] - T.pips[0]))));
      g.gainXp(10 + this.tier * 15);
    }, 250);
    g.stats.chests = (g.stats.chests || 0) + 1;
    g.guide.event('chest');
  }
  update(dt) {
    this.t += dt;
    if (this.openT !== undefined && this.openT < 1) { this.openT += dt * 3; this.lid.rotation.x = -1.9 * Math.min(1, this.openT); }
    if (!this.opened && this.tier >= 1 && Math.random() < 0.05) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.6, y: 0.5, z: this.z, vy: 0.8, g: 0, color: TIERS[this.tier].trim, life: 0.7, size: 0.04 });
    this.sync();
  }
}
