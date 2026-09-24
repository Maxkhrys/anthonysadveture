// Pass 5 world objects: hanging bells (sequence puzzles), cracked glass (breakable secrets),
// thread barriers (the Seamkeeper's arena), and a room trigger that wakes a miniboss.
import * as THREE from 'three';
import { Entity } from './entity.js';
import { mesh, B, MAT_GLOW } from '../models.js';
import { sfx, playTone } from '../engine/audio.js';

// A bell hanging from the glasshouse frame. Strike it (any attack or gust) and it rings its
// own pitch. A BellSequence listens for the right order.
export class HangingBell extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.group = d.group; this.pitch = d.pitch; this.solid = true; this.hw = 0.3; this.hd = 0.3; this.passShots = false;
    const s = 0.8 + d.pitch * 0.25, col = [0xb88a3a, 0xc89a4a, 0xe0b860][d.pitch] || 0xc89a4a;
    this.lily = !!d.lily;
    if (this.lily) this.obj.add(mesh([B(0.08, 1.2, 0.08, 0, 0, 0, 0x4a8a3a), B(0.5, 0.04, 0.2, 0.2, 0.5, 0, 0x5a9a44, 0, 0, -0.4), B(0.5, 0.04, 0.2, -0.2, 0.8, 0, 0x5a9a44, 0, 0, 0.4)]));
    else this.obj.add(mesh([B(0.06, 1.6, 0.06, 0, 0, 0, 0x3a4a44), B(0.6, 0.06, 0.06, 0, 1.6, 0, 0x3a4a44)]));
    this.bell = new THREE.Group(); this.bell.position.y = this.lily ? 1.3 : 1.5; this.obj.add(this.bell);
    this.bell.add(mesh([B(0.02, 0.2, 0.02, 0, -0.2, 0, 0x2a2a2a), B(0.34 * s, 0.1, 0.34 * s, 0, -0.32, 0, col), B(0.44 * s, 0.22 * s, 0.44 * s, 0, -0.32 - 0.22 * s, 0, col), B(0.5 * s, 0.05, 0.5 * s, 0, -0.34 - 0.24 * s, 0, 0xe8c878), B(0.06, 0.08, 0.06, 0, -0.4 - 0.28 * s, 0, 0x5a4020)]));
    this.swing = 0; this.t = 0;
  }
  ring() {
    const g = this.g;
    if (this.cool > 0) return;
    this.cool = 0.35; this.swing = 1;
    playTone([57, 64, 69][this.pitch] || 62);
    g.fx.ring(this.x, this.z, 0.2, 1.2 + this.pitch * 0.3, [0xb88a3a, 0xc89a4a, 0xfff3b0][this.pitch], 0.4, 1.1);
    g.ui.float(this.x, 2.2, this.z, ['♪ low', '♪ middle', '♪ high'][this.pitch], '#fff3b0', false, true);
    for (const e of g.entities) if (e instanceof BellSequence && e.group === this.group) e.heard(this.pitch);
  }
  onHit() { this.ring(); return 'hit'; }
  onGust() { this.ring(); }
  update(dt) {
    this.t += dt; this.cool = Math.max(0, (this.cool || 0) - dt);
    this.swing *= Math.exp(-dt * 2.5);
    this.bell.rotation.z = Math.sin(this.t * 9) * 0.5 * this.swing;
    this.sync();
  }
}
export class BellSequence extends Entity {
  constructor(g, d) { super(g, 0, 0); this.group = d.group; this.order = d.order; this.sig = d.signal; this.transient = !!d.transient; this.got = []; this.alwaysUpdate = true; }
  heard(p) {
    const g = this.g;
    if (g.signal(this.sig)) return;
    if (!this.order) { // any order: every bell of the group, once each
      if (!this.got.includes(p)) this.got.push(p);
      const n = g.entities.filter(e => e instanceof HangingBell && e.group === this.group).length;
      if (this.got.length >= n) { g.setSignal(this.sig, true, !this.transient); this.got = []; }
      return;
    }
    this.got.push(p);
    const n = this.got.length;
    if (this.got[n - 1] !== this.order[n - 1]) {
      this.got = p === this.order[0] ? [p] : [];
      setTimeout(() => { sfx('bellfail'); }, 250);
      return;
    }
    if (n === this.order.length) { setTimeout(() => { g.setSignal(this.sig, true, true); sfx('secret'); g.ui.toast('The bells answer each other…', 'Something unlatched.', 2.2); }, 600); }
  }
  update() {}
}

// Cracked glass: a pane (or cabinet front) that heavy blows, Bell Surge or blasts shatter.
export class CrackedGlass extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.id = d.id; this.solid = true; this.hw = 0.5; this.hd = 0.5;
    this.broken = !!g.flags['glass:' + this.id];
    this.obj.add(mesh([B(0.1, 1.5, 1.0, -0.45, 0, 0, 0x3a5a50), B(0.1, 1.5, 1.0, 0.45, 0, 0, 0x3a5a50), B(1.0, 0.1, 1.0, 0, 1.45, 0, 0x3a5a50)]));
    this.pane = mesh([B(0.8, 1.35, 0.06, 0, 0.1, 0, 0xbfe8e0), B(0.02, 0.9, 0.065, -0.1, 0.3, 0, 0x6a8a84, 0, 0, 0.5), B(0.02, 0.6, 0.065, 0.15, 0.6, 0, 0x6a8a84, 0, 0, -0.7), B(0.3, 0.02, 0.065, 0.05, 0.9, 0, 0x6a8a84, 0, 0, 0.3)], MAT_GLOW, false);
    this.obj.add(this.pane);
    if (this.broken) { this.pane.visible = false; this.solid = false; }
  }
  shatter() {
    if (this.broken) return;
    const g = this.g;
    this.broken = true; this.solid = false; this.pane.visible = false; g.flags['glass:' + this.id] = true;
    sfx('shatter'); g.pr.addShake(0.25); g.hitstop(0.05);
    for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 3; g.fx.add({ x: this.x, y: 0.4 + Math.random() * 1.0, z: this.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 1 + Math.random() * 2, color: i % 3 ? 0xdff8f0 : 0x9ad8c8, life: 1.0, size: 0.06, g: 12 }); }
    g.ui.toast('The glass gives way!', '', 1.4);
  }
  onHit(h) {
    const heavy = h.heavy || h.kind === 'spin' || h.kind === 'spin3' || h.kind === 'surge' || h.kind === 'quake' || h.kind === 'blast' || h.kind === 'slam';
    if (heavy) this.shatter();
    else { sfx('clang'); if (!this.hinted) { this.hinted = true; this.g.ui.toast('The glass is cracked, but thick.', 'A heavier blow might break it.', 2); } }
    return 'hit';
  }
  update() { this.sync(); }
}

// A thread stitched across the loom. Axis-aligned, solid to walking and to shots. Red threads
// part under any blow; gold threads only yield to fire, heavy blows or the Seam Ripper.
export class ThreadBarrier extends Entity {
  constructor(g, x0, z0, x1, z1, gold, owner) {
    super(g, (x0 + x1) / 2, (z0 + z1) / 2);
    this.gold = gold; this.owner = owner; this.isThread = true; this.solid = true;
    const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    this.hw = horiz ? Math.abs(x1 - x0) / 2 : 0.12; this.hd = horiz ? 0.12 : Math.abs(z1 - z0) / 2;
    const L = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    const col = gold ? 0xffd25e : 0xd84a6a;
    this.m = mesh([B(horiz ? L : 0.05, 0.05, horiz ? 0.05 : L, 0, 0.35, 0, col), B(horiz ? L : 0.04, 0.04, horiz ? 0.04 : L, 0, 0.7, 0, col)], MAT_GLOW, false);
    this.m.scale.set(horiz ? 0.01 : 1, 1, horiz ? 1 : 0.01); this.horiz = horiz;
    this.obj.add(this.m); this.t = 0; this.sync();
    sfx('stitch');
  }
  cut(how) {
    if (this.dead) return;
    const g = this.g;
    sfx('snap'); g.fx.burst(this.x, 0.5, this.z, 14, [this.gold ? 0xffd25e : 0xd84a6a, 0xffffff], 3);
    g.stats.threadsCut = (g.stats.threadsCut || 0) + 1;
    this.remove();
  }
  canCut(h) {
    if (!this.gold) return true;
    const U = this.g.pstats.uniques;
    return U.has('seamripper') || h.heavy || h.kind === 'spin' || h.kind === 'spin3' || h.kind === 'surge' || h.kind === 'quake' || h.element === 'fire' || h.kind === 'fireball' || h.kind === 'blast';
  }
  onHit(h) { if (this.canCut(h)) this.cut(); else { sfx('clang'); this.g.ui.float(this.x, 1, this.z, 'GOLD THREAD', '#ffd25e', false, true); } return 'hit'; }
  onShot(pr) { if (this.canCut({ kind: pr.kind, element: pr.element })) { this.cut(); return true; } return false; }
  onGust() { if (!this.gold) this.cut(); }
  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / 0.35);
    if (this.horiz) this.m.scale.x = k; else this.m.scale.z = k;
    this.m.position.y = Math.sin(this.t * 7) * 0.02;
  }
}

// Wakes a boss when the player walks into its room (once, until defeated).
export class BossTrigger extends Entity {
  constructor(g, d) { super(g, d.x, d.z); this.d = d; this.alwaysUpdate = true; }
  update() {
    const g = this.g, d = this.d;
    if (g.flags[d.flag] || g.bossActive || !g.room || g.room.id !== d.room) return;
    const p = g.player;
    if (Math.abs(p.x - (g.room.x0 + g.room.x1) / 2) > 5.5 || Math.abs(p.z - (g.room.z0 + g.room.z1) / 2) > 3.8) return;
    d.start(g, d);
  }
}

// The toll rack by the bell tower: hung when the Bellwright's Score comes home.
export class TollRack extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.solid = true; this.hw = 0.9; this.hd = 0.25; this.t = 0;
    this.obj.add(mesh([B(0.1, 1.5, 0.1, -0.9, 0, 0, 0x6a4a2a), B(0.1, 1.5, 0.1, 0.9, 0, 0, 0x6a4a2a), B(1.95, 0.1, 0.12, 0, 1.45, 0, 0x7a5a3a), B(0.5, 0.2, 0.3, -0.9, 1.5, 0, 0xc0503a), B(0.5, 0.2, 0.3, 0.9, 1.5, 0, 0xc0503a)]));
    this.bells = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Group(); b.position.set(-0.64 + i * 0.32, 1.42, 0);
      const s = 0.7 + (4 - i) * 0.08;
      b.add(mesh([B(0.02, 0.14, 0.02, 0, -0.14, 0, 0x2a2a2a), B(0.18 * s, 0.16 * s, 0.18 * s, 0, -0.14 - 0.16 * s, 0, i % 2 ? 0xc89a4a : 0xe0b860), B(0.22 * s, 0.03, 0.22 * s, 0, -0.16 - 0.16 * s, 0, 0xe8c878)]));
      this.obj.add(b); this.bells.push(b);
    }
    this.sync();
  }
  update(dt) {
    this.t += dt;
    this.bells.forEach((b, i) => { b.rotation.z = Math.sin(this.t * 1.7 + i) * 0.08; });
  }
}
