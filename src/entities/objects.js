import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { mesh, B, MAT_GLOW, MAT_GLOW_T, PROPS, makeFolk, geo, MAT } from '../models.js';
import { sfx } from '../engine/audio.js';
import { T, blocksObject, isLiquid } from '../world/tiles.js';
import { dropLoot, dropPips, Pickup, flashObj } from './common.js';
import { angleLerp } from '../engine/util.js';

// ------------------------------------------------ Chest
export const ITEM_INFO = {
  key: { name: 'Small Key', desc: 'Opens one locked door in this dungeon.', color: 0xc0c0d0 },
  bigkey: { name: 'Thornwood Key', desc: 'A great key of living wood. It opens the Root Gate.', color: 0xffd25e },
  bellows: { name: 'Gustbellows', desc: 'Squeeze with L. Hold to build a gale!\nWind pushes crates, snuffs flames, spins pinwheels, clears dust — and flips beetles on their backs.', color: 0x7ad8ff },
  heart: { name: 'Heart Vessel', desc: 'Your maximum hearts increased by one!', color: 0xff4a5a },
  pips: { name: 'Pips', desc: '', color: 0xffd25e },
  potion: { name: 'Red Tonic', desc: 'Drink with Q to restore three hearts.', color: 0xe8424f },
  echo: { name: 'Hollow Echo', desc: 'A sound that forgot to stop. Posy could work it into something.', color: 0x9ad8ff },
};
function itemModel(c) {
  switch (c.kind) {
    case 'key': return mesh([B(0.06, 0.3, 0.04, 0, 0, 0, 0xc0c0d0), B(0.16, 0.14, 0.04, 0, 0.3, 0, 0xc0c0d0), B(0.1, 0.05, 0.04, 0.06, 0.04, 0, 0xc0c0d0)], MAT_GLOW);
    case 'bigkey': return mesh([B(0.08, 0.4, 0.06, 0, 0, 0, 0x8a5a2a), B(0.26, 0.22, 0.06, 0, 0.4, 0, 0xffd25e), B(0.14, 0.06, 0.06, 0.08, 0.04, 0, 0xffd25e), B(0.1, 0.1, 0.07, 0, 0.48, 0, 0x7fd36a)], MAT_GLOW);
    case 'item': return mesh([B(0.32, 0.22, 0.2, 0, 0, 0, 0x9a6a3a), B(0.36, 0.05, 0.24, 0, 0.1, 0, 0xc08a4a), B(0.08, 0.08, 0.2, 0, 0.1, 0.2, 0xc0c0d0), B(0.3, 0.06, 0.06, 0, 0.26, -0.08, 0x7ad8ff), B(0.06, 0.06, 0.06, 0, 0.1, 0.32, 0xdff4ff)], MAT_GLOW);
    case 'echo': return mesh([B(0.26, 0.26, 0.06, 0, 0.1, 0, 0x9ad8ff), B(0.14, 0.14, 0.07, 0, 0.1, 0, 0xffffff), B(0.36, 0.04, 0.04, 0, 0.1, 0, 0x9ad8ff)], MAT_GLOW);
    case 'heart': return mesh([B(0.18, 0.18, 0.1, -0.09, 0.14, 0, 0xff4a5a), B(0.18, 0.18, 0.1, 0.09, 0.14, 0, 0xff4a5a), B(0.26, 0.14, 0.1, 0, 0.04, 0, 0xff4a5a), B(0.1, 0.08, 0.1, 0, -0.04, 0, 0xff4a5a)], MAT_GLOW);
    default: return mesh([B(0.2, 0.2, 0.06, 0, 0, 0, 0xffd25e), B(0.12, 0.08, 0.06, 0, 0.2, 0, 0xffd25e)], MAT_GLOW);
  }
}
export class Chest extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.id = d.id; this.contents = d.contents; this.hiddenSig = d.hidden; this.big = !!d.big;
    this.solid = true; this.hw = this.big ? 0.42 : 0.34; this.hd = 0.3;
    this.opened = !!g.flags['chest:' + this.id];
    this.interactable = true;
    const s = this.big ? 1.25 : 1;
    const wood = this.big ? 0x7a3a8a : 0x9a6a3a, trim = this.big ? 0xffd25e : 0xd0a040;
    this.base = mesh([B(0.66 * s, 0.34 * s, 0.5 * s, 0, 0, 0, wood), B(0.7 * s, 0.06, 0.54 * s, 0, 0.1, 0, trim), B(0.1, 0.12, 0.04, 0, 0.18 * s, 0.26 * s, trim)]);
    this.lid = new THREE.Group(); this.lid.position.set(0, 0.34 * s, -0.25 * s);
    this.lid.add(mesh([B(0.66 * s, 0.16 * s, 0.5 * s, 0, 0, 0.25 * s, wood), B(0.7 * s, 0.05, 0.54 * s, 0, 0.14 * s, 0.25 * s, trim)]));
    this.obj.add(this.base, this.lid);
    if (this.opened) this.lid.rotation.x = -1.9;
    this.visible = !this.hiddenSig || g.signal(this.hiddenSig) || this.opened;
    this.obj.visible = this.visible; this.solid = this.visible;
  }
  get prompt() { return this.visible && !this.opened ? 'Open' : null; }
  update(dt) {
    if (!this.visible && this.g.signal(this.hiddenSig)) {
      this.visible = true; this.obj.visible = true; this.solid = true;
      this.appearT = 0; sfx('secret');
      this.g.fx.burst(this.x, 0.4, this.z, 20, [0xffffff, 0xfff3b0], 3);
      this.g.ui.toast('A chest appeared!', '', 1.4);
      // nudge player out
      const p = this.g.player; if (Math.abs(p.x - this.x) < 0.7 && Math.abs(p.z - this.z) < 0.7) { p.z = this.z + 0.8; }
    }
    if (this.appearT !== undefined && this.appearT < 1) { this.appearT += dt * 3; this.obj.scale.setScalar(Math.min(1, this.appearT)); }
    if (this.openT !== undefined && this.openT < 1) { this.openT += dt * 3; this.lid.rotation.x = -1.9 * Math.min(1, this.openT); }
  }
  interact() {
    if (!this.visible || this.opened) return;
    this.opened = true; this.openT = 0;
    this.g.flags['chest:' + this.id] = true;
    sfx('chest');
    this.g.receiveItem(this.contents, itemModel(this.contents), this);
  }
}

// ------------------------------------------------ Door
export class Door extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.kind = d.kind; this.id = d.id; this.signal = d.signal; this.orient = d.orient; this.rooms = d.rooms || [];
    this.single = d.single;
    const depth = d.single ? 0.5 : 1.0;
    if (this.orient === 'h') { this.hw = 0.5; this.hd = depth; } else { this.hw = depth; this.hd = 0.5; }
    this.solid = true;
    this.sealed = false;
    this.unlocked = !!g.flags['door:' + this.id];
    this.openK = 0;
    this.mesh = new THREE.Group();
    this.obj.add(this.mesh);
    const rot = this.orient === 'h' ? 0 : Math.PI / 2;
    this.mesh.rotation.y = rot;
    this.build();
    this.interactable = this.kind === 'locked' || this.kind === 'boss';
    this.flames = [];
  }
  build() {
    const k = this.kind;
    const P = [];
    if (k === 'shutter' || k === 'stone' || k === 'open') {
      if (k === 'stone') P.push(B(1.0, 1.5, 0.4, 0, 0, 0, 0x7a7090), B(0.6, 0.6, 0.42, 0, 0.5, 0, 0x9a90b0), B(0.2, 0.2, 0.44, 0, 0.7, 0, 0x7ad8ff));
      else for (let i = -1; i <= 1; i++) P.push(B(0.1, 1.5, 0.1, i * 0.3, 0, 0, 0x3a3040)); P.push(B(1.0, 0.12, 0.14, 0, 1.2, 0, 0x4a3a50), B(1.0, 0.12, 0.14, 0, 0.5, 0, 0x4a3a50));
    } else if (k === 'locked') {
      P.push(B(1.0, 1.5, 0.3, 0, 0, 0, 0x7a4a2a), B(0.9, 0.1, 0.34, 0, 0.3, 0, 0x5a3a1a), B(0.9, 0.1, 0.34, 0, 1.1, 0, 0x5a3a1a), B(0.3, 0.34, 0.4, 0, 0.55, 0, 0xc0c0d0), B(0.08, 0.14, 0.42, 0, 0.6, 0, 0x1a1a1a));
    } else if (k === 'boss') {
      P.push(B(1.0, 1.5, 0.3, 0, 0, 0, 0x3a5a2a), B(1.0, 0.16, 0.34, 0, 1.2, 0, 0x7fd36a), B(0.5, 0.5, 0.4, 0, 0.45, 0, 0xffd25e), B(0.14, 0.24, 0.42, 0, 0.55, 0, 0x2a1a1a));
      for (const x of [-0.35, 0.35]) P.push(B(0.1, 1.3, 0.36, x, 0, 0, 0x2a4a1a));
    }
    if (P.length) { this.panel = mesh(P); this.mesh.add(this.panel); }
    if (k === 'fire') {
      this.fireObj = new THREE.Group();
      this.fireObj.add(mesh([B(0.9, 0.12, 0.9, 0, 0, 0, 0x2a1a1a)]));
      this.fireMeshes = [];
      for (let i = 0; i < 3; i++) {
        const f = mesh([B(0.26, 0.4, 0.26, 0, 0, 0, 0xff7a2a), B(0.16, 0.3, 0.16, 0, 0.3, 0, 0xffd25e), B(0.08, 0.14, 0.08, 0, 0.55, 0, 0xffffff)], MAT_GLOW, false);
        f.position.set(-0.3 + i * 0.3, 0.1, (i % 2) * 0.2 - 0.1); this.fireObj.add(f); this.fireMeshes.push(f);
      }
      this.mesh.add(this.fireObj);
      this.light = true;
    }
  }
  isOpen() {
    const g = this.g;
    if (this.sealed) return false;
    switch (this.kind) {
      case 'open': return true;
      case 'shutter': case 'stone': return g.signal(this.signal);
      case 'locked': case 'boss': case 'fire': return this.unlocked;
    }
    return true;
  }
  get lit() { return this.kind === 'fire' && !this.unlocked; }
  get prompt() {
    if ((this.kind === 'locked' || this.kind === 'boss') && !this.unlocked) return 'Unlock';
    return null;
  }
  interact() {
    const g = this.g;
    if (this.unlocked) return;
    if (this.kind === 'locked') {
      if (g.inv.keys > 0) { g.inv.keys--; this.unlock(); } else { sfx('error'); g.ui.toast('Locked.', 'You need a small key.', 1.6); }
    } else if (this.kind === 'boss') {
      if (g.inv.bigkey) { this.unlock(); g.ui.toast('The Root Gate groans open…', '', 1.8); } else { sfx('error'); g.ui.toast('A great root-bound gate.', 'It needs a special key.', 1.8); }
    }
  }
  unlock() { this.unlocked = true; this.g.flags['door:' + this.id] = true; sfx('unlock'); setTimeout(() => sfx('door'), 200); this.g.ui.updateHud(); }
  onGust(dir, power) {
    if (this.kind === 'fire' && !this.unlocked) {
      this.unlocked = true; this.g.flags['door:' + this.id] = true;
      sfx('extinguish');
      this.g.fx.burst(this.x, 0.5, this.z, 24, [0x6a6a6a, 0x9a9a9a, 0xff7a2a], 3, { g: -1, life: 0.9 });
      this.g.ui.toast('The flames blew out!', '', 1.2);
    }
  }
  update(dt) {
    const g = this.g;
    const open = this.isOpen();
    const target = open ? 1 : 0;
    if (target !== this.lastTarget && this.lastTarget !== undefined && this.kind !== 'open' && this.kind !== 'fire') sfx('door');
    this.lastTarget = target;
    this.openK += (target - this.openK) * Math.min(1, dt * 8);
    this.solid = this.openK < 0.6;
    if (this.panel) { this.panel.position.y = -this.openK * 1.6; this.panel.visible = this.openK < 0.98; }
    if (this.fireObj) {
      this.fireObj.visible = !this.unlocked;
      const t = g.time;
      this.fireMeshes.forEach((f, i) => { f.scale.set(1, 0.8 + Math.sin(t * 14 + i * 2) * 0.25, 1); });
      if (!this.unlocked && Math.random() < 0.4) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.8, y: 0.6, z: this.z + (Math.random() - 0.5) * 0.8, vy: 1.5, g: -1, color: Math.random() < 0.5 ? 0xff7a2a : 0xffd25e, life: 0.5, size: 0.06 });
      if (!this.unlocked) {
        const p = g.player;
        if (Math.abs(p.x - this.x) < this.hw + p.r + 0.08 && Math.abs(p.z - this.z) < this.hd + p.r + 0.08) {
          if (p.hurt({ dmg: 1, x: this.x, z: this.z, src: this, kb: 5 }) === 'hit' && !this.hinted) { this.hinted = true; g.ui.toast('Too hot to pass!', g.inv.bellows ? 'Could you blow it out?' : 'Something to snuff it out…', 2); }
        }
      }
    }
  }
}

// ------------------------------------------------ Crates (gust) and stone blocks (push)
class Movable extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.home = { x: d.x, z: d.z };
    this.solid = true; this.hw = 0.49; this.hd = 0.49; this.room = d.room;
    this.moving = null; this.filled = null;
    this.id = d.id; this.sinks = d.sinks;
    this.isMovable = true;
  }
  tileFree(tx, tz) {
    const g = this.g;
    const t = g.tileAt(tx, tz);
    if (blocksObject(t)) return false;
    if (t === T.WATER || t === T.DEEP) return this.sinks ? true : false;
    for (const s of g.solids) {
      if (s === this || s.dead || !s.solid) continue;
      if (Math.abs(s.x - (tx + 0.5)) < s.hw + 0.45 && Math.abs(s.z - (tz + 0.5)) < s.hd + 0.45) return false;
    }
    const p = g.player;
    if (Math.abs(p.x - (tx + 0.5)) < 0.5 + p.r - 0.05 && Math.abs(p.z - (tz + 0.5)) < 0.5 + p.r - 0.05) return false;
    for (const e of g.entities) if (e.isEnemy && !e.dead && e.moveMode !== 'fly' && Math.abs(e.x - (tx + 0.5)) < 0.7 && Math.abs(e.z - (tz + 0.5)) < 0.7) return false;
    return true;
  }
  startMove(dir, slide) {
    const tx = Math.floor(this.x) + dir[0], tz = Math.floor(this.z) + dir[1];
    if (!this.tileFree(tx, tz)) return false;
    this.moving = { dir, tx, tz, slide, sx: this.x, sz: this.z, k: 0 };
    return true;
  }
  update(dt) {
    const g = this.g;
    if (this.filled) return;
    if (this.moving) {
      const mv = this.moving;
      const speed = mv.slide ? 9 : 3.2;
      mv.k += dt * speed;
      const k = Math.min(1, mv.k);
      this.x = mv.sx + mv.dir[0] * k; this.z = mv.sz + mv.dir[1] * k;
      if (mv.slide && Math.random() < 0.4) g.fx.dust(this.x - mv.dir[0] * 0.4, this.z - mv.dir[1] * 0.4, 1);
      if (k >= 1) {
        this.x = mv.tx + 0.5; this.z = mv.tz + 0.5;
        this.moving = null;
        const t = g.tileAt(mv.tx, mv.tz);
        if (t === T.PIT) return this.fillPit(mv.tx, mv.tz);
        if (isLiquid(t)) return this.sink();
        if (mv.slide) this.startMove(mv.dir, true) || (sfx('thud'), g.fx.dust(this.x, this.z, 5));
      }
    }
    this.sync();
  }
  fillPit(tx, tz) {
    const g = this.g;
    g.setTile(tx, tz, T.FILLED);
    this.filled = { tx, tz };
    this.solid = false;
    this.obj.position.y = -0.34 * (this.kind === 'crate' ? 1 : 1);
    this.obj.position.y = -0.82;
    sfx('thud'); g.fx.dust(this.x, this.z, 10);
    g.ui.toast('It filled the gap!', '', 1.0);
    this.onFill && this.onFill();
  }
  sink() {
    const g = this.g; sfx('splash');
    g.fx.burst(this.x, 0.1, this.z, 16, [0xe8f8ff, 0x7ad8ff], 3);
    this.sunk = true; this.solid = false; this.obj.visible = false;
    if (this.id) g.flags['sunk:' + this.id] = true;
  }
  reset() {
    const g = this.g;
    if (this.filled) { g.setTile(this.filled.tx, this.filled.tz, T.PIT); this.filled = null; }
    this.moving = null; this.x = this.home.x; this.z = this.home.z; this.solid = true; this.obj.visible = true; this.sunk = false; this.obj.position.y = 0;
    this.sync();
  }
  sync() { if (!this.filled) this.obj.position.set(this.x, 0, this.z); else this.obj.position.x = this.x, this.obj.position.z = this.z; }
}
export class Crate extends Movable {
  constructor(g, d) {
    super(g, d);
    this.kind = 'crate';
    this.m = mesh([B(0.96, 0.82, 0.96, 0, 0, 0, 0xb07a40), B(1.0, 0.1, 1.0, 0, 0.72, 0, 0x8a5a2a), B(1.0, 0.1, 1.0, 0, 0, 0, 0x8a5a2a), B(0.98, 0.1, 0.1, 0, 0.36, 0, 0x8a5a2a, 0, 0, 0.7), B(0.1, 0.1, 0.98, 0, 0.36, 0, 0x8a5a2a, 0.7, 0, 0)]);
    this.obj.add(this.m);
  }
  onGust(dirAng) {
    if (this.moving || this.filled || this.sunk) return;
    const dx = Math.sin(dirAng), dz = Math.cos(dirAng);
    const dir = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
    if (this.startMove(dir, true)) sfx('slide');
    else { sfx('thud'); this.m.position.x = dir[0] * 0.05; setTimeout(() => this.m.position.x = 0, 80); }
  }
}
export class Block extends Movable {
  constructor(g, d) {
    super(g, d);
    this.kind = 'block';
    this.m = mesh([B(0.98, 0.9, 0.98, 0, 0, 0, 0x8a8aa0), B(0.8, 0.06, 0.8, 0, 0.9, 0, 0xa0a0b8), B(0.3, 0.3, 0.02, 0, 0.35, 0.5, 0x6a6a80), B(0.1, 0.1, 0.03, 0, 0.45, 0.5, 0x7ad8ff)]);
    this.obj.add(this.m);
    if (d.sinks && g.flags['sunk:' + d.id]) { this.sunk = true; this.solid = false; this.obj.visible = false; }
    if (d.id && g.flags['moved:' + d.id]) { const [x, z] = g.flags['moved:' + d.id]; this.x = x; this.z = z; }
  }
  tryPush(dir) {
    if (this.moving || this.filled) return;
    if (this.startMove(dir, false)) { sfx('push'); if (this.id) this.g.flags['moved:' + this.id] = [this.moving.tx + 0.5, this.moving.tz + 0.5]; }
  }
  onGust() { if (!this.moving) { sfx('thud'); this.g.fx.dust(this.x, this.z, 3); if (!this.g.flags.hintHeavy) { this.g.flags.hintHeavy = true; this.g.ui.toast('Too heavy for wind.', 'Try pushing it by hand.', 1.8); } } }
}

// ------------------------------------------------ Switches & pinwheels & torches
export class Switch extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.latch = d.latch; this.group = d.group; this.room = d.room;
    this.pressed = false; this.covered = false;
    this.base = mesh([B(0.8, 0.06, 0.8, 0, 0, 0, 0x5a4a60)]);
    this.plate = mesh([B(0.6, 0.1, 0.6, 0, 0, 0, 0xd0a040), B(0.2, 0.04, 0.2, 0, 0.1, 0, 0x7ad8ff)]);
    this.plate.position.y = 0.04;
    this.obj.add(this.base, this.plate);
    this.key = 'sw:' + g.area.id + ':' + d.x + ',' + d.z;
    if (this.latch && g.flags[this.key]) this.pressed = true;
  }
  update(dt) {
    const g = this.g;
    if (this.covered) return this.sync();
    let on = false;
    const p = g.player;
    if (Math.hypot(p.x - this.x, p.z - this.z) < 0.4 && p.state !== 'fall') on = true;
    for (const s of g.solids) if (s.isMovable && !s.moving && !s.filled && !s.sunk && Math.abs(s.x - this.x) < 0.3 && Math.abs(s.z - this.z) < 0.3) on = true;
    const was = this.pressed;
    if (this.latch) { if (on) this.pressed = true; } else this.pressed = on;
    if (this.pressed && !was) { sfx('switch'); if (this.latch) g.flags[this.key] = true; g.fx.burst(this.x, 0.1, this.z, 6, 0x7ad8ff, 1.5); }
    this.plate.position.y = this.pressed ? -0.04 : 0.04;
    this.sync();
  }
}
export class SwitchGroup extends Entity {
  constructor(g, d) { super(g, 0, 0); this.group = d.group; this.needs = d.needs; this.sig = d.signal; }
  update() {
    const g = this.g;
    if (g.signal(this.sig)) return;
    let n = 0;
    for (const e of g.entities) if (e instanceof Switch && e.group === this.group && e.pressed) n++;
    if (n >= this.needs) { g.setSignal(this.sig, true, true); sfx('secret'); }
  }
}
export class Pinwheel extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.signal = d.signal; this.latch = d.latch; this.time = d.time || 0;
    this.solid = true; this.hw = 0.2; this.hd = 0.2;
    this.spinV = 0; this.timer = 0;
    this.obj.add(mesh([B(0.1, 0.9, 0.1, 0, 0, 0, 0x8a6a4a), B(0.4, 0.1, 0.4, 0, 0, 0, 0x6a4a3a)]));
    this.wheel = new THREE.Group(); this.wheel.position.set(0, 0.9, 0.08);
    const cols = [0xe8424f, 0xffd25e, 0x7ad8ff, 0x7fd36a];
    for (let i = 0; i < 4; i++) {
      const b = mesh([B(0.12, 0.34, 0.03, 0.06, 0, 0, cols[i])], MAT, false);
      const piv = new THREE.Group(); piv.rotation.z = i * Math.PI / 2; piv.add(b); this.wheel.add(piv);
    }
    this.wheel.add(mesh([B(0.08, 0.08, 0.06, 0, -0.04, 0, 0xffffff)]));
    this.obj.add(this.wheel);
    if (this.latch && g.signal(this.signal)) this.spinV = 6;
  }
  onGust(dir, power) {
    this.spinV = 25; sfx('switch');
    if (this.latch) { if (!this.g.signal(this.signal)) { this.g.setSignal(this.signal, true, true); sfx('secret'); } }
    else { this.timer = this.time; this.g.setSignal(this.signal, true, false); }
  }
  update(dt) {
    const g = this.g;
    this.wheel.rotation.z -= this.spinV * dt;
    const rest = this.latch && g.signal(this.signal) ? 5 : (this.timer > 0 ? 12 : 0);
    this.spinV += (rest - this.spinV) * Math.min(1, dt * 1.2);
    if (!this.latch && this.timer > 0) { this.timer -= dt; if (this.timer <= 0) g.setSignal(this.signal, false, false); }
    this.sync();
  }
}
export class PinGroup extends Entity {
  constructor(g, d) { super(g, 0, 0); this.a = d.a; this.b = d.b; this.sig = d.signal; }
  update() { const g = this.g; if (!g.signal(this.sig) && g.signal(this.a) && g.signal(this.b)) { g.setSignal(this.sig, true, true); sfx('secret'); } }
}
export class Torch extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.puzzle = d.puzzle; this.group = d.group; this.room = d.room;
    this.solid = true; this.hw = 0.22; this.hd = 0.22;
    this.lit = true; this.outT = 0;
    this.obj.add(mesh([B(0.3, 0.1, 0.3, 0, 0, 0, 0x3a3040), B(0.14, 0.6, 0.14, 0, 0.1, 0, 0x5a4a60), B(0.34, 0.14, 0.34, 0, 0.7, 0, this.puzzle ? 0xd0a040 : 0x5a4a60)]));
    this.flame = mesh([B(0.2, 0.3, 0.2, 0, 0, 0, 0xff7a2a), B(0.12, 0.22, 0.12, 0, 0.2, 0, 0xffd25e), B(0.06, 0.1, 0.06, 0, 0.36, 0, 0xffffff)], MAT_GLOW, false);
    this.flame.position.y = 0.84;
    this.obj.add(this.flame);
    if (this.puzzle && g.signal(this.group)) this.lit = false;
  }
  onGust() {
    if (!this.lit || !this.puzzle) { if (!this.puzzle) this.flame.scale.set(1.4, 0.5, 1.4); return; }
    this.lit = false; this.outT = 0; sfx('extinguish');
    this.g.fx.burst(this.x, 1.0, this.z, 10, [0x6a6a6a, 0x9a9a9a], 1.5, { g: -1.5, life: 0.8 });
  }
  update(dt) {
    const g = this.g, t = g.time;
    if (!this.lit && this.puzzle && !g.signal(this.group)) {
      this.outT += dt;
      if (this.outT > 5.5) { this.lit = true; sfx('ignite'); g.fx.burst(this.x, 1, this.z, 8, [0xff7a2a, 0xffd25e], 1.5); }
      else if (this.outT > 4.3 && Math.random() < 0.3) g.fx.add({ x: this.x, y: 0.9, z: this.z, vy: 0.5, g: -1, color: 0xff7a2a, life: 0.3, size: 0.05 });
    }
    this.flame.visible = this.lit;
    this.flame.scale.set(1, 0.85 + Math.sin(t * 17 + this.x) * 0.15, 1);
    this.flame.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    if (this.lit && Math.random() < 0.1) g.fx.add({ x: this.x, y: 1.1, z: this.z, vy: 1, g: -0.5, color: 0xffd25e, life: 0.4, size: 0.04 });
    this.sync();
  }
}
export class TorchGroup extends Entity {
  constructor(g, sig) { super(g, 0, 0); this.sig = sig; }
  update() {
    const g = this.g;
    if (g.signal(this.sig)) return;
    const ts = g.entities.filter(e => e instanceof Torch && e.puzzle && e.group === this.sig);
    if (ts.length && ts.every(t => !t.lit)) { g.setSignal(this.sig, true, true); sfx('secret'); }
  }
}

// ------------------------------------------------ piles, bushes, tufts, drifts, boulders
export class LeafPile extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.reveal = d.reveal; this.dust = d.dust; this.sand = d.sand;
    this.key = 'pile:' + g.area.id + ':' + d.x + ',' + d.z;
    const cols = this.dust ? [0x8a7a8a, 0x9a8a9a, 0x7a6a7a] : this.sand ? [0xe8c880, 0xd8b870, 0xf0d890] : [0xc8702a, 0xe0a03a, 0xa85a2a];
    const P = [];
    for (let i = 0; i < 9; i++) P.push(B(0.28, 0.1 + (i % 3) * 0.05, 0.28, Math.cos(i * 2.4) * 0.25 * (i / 9 + 0.3), (i % 4) * 0.04, Math.sin(i * 2.4) * 0.25 * (i / 9 + 0.3), cols[i % 3], 0, i));
    this.m = mesh(P); this.obj.add(this.m);
    this.cols = cols;
    if (g.flags[this.key]) { this.clear(true); }
  }
  onGust() { if (!this.gone) this.clear(false); }
  clear(silent) {
    const g = this.g;
    this.gone = true; this.obj.visible = false;
    if (silent) { this.remove(); this.uncover(); return; }
    g.flags[this.key] = true;
    g.fx.burst(this.x, 0.2, this.z, 18, this.cols, 3, { life: 0.8, g: 3 });
    sfx('cut');
    if (this.reveal) {
      if (this.reveal === 'heart') g.spawn(new Pickup(g, this.x, this.z, 'heart'));
      else dropPips(g, this.x, this.z, parseInt(this.reveal.slice(4)));
      sfx('secret');
    }
    this.uncover();
    this.remove();
  }
  uncover() { for (const e of this.g.entities) if (e instanceof Switch && Math.abs(e.x - this.x) < 0.1 && Math.abs(e.z - this.z) < 0.1) e.covered = false; }
}
export class Bush extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.solid = true; this.hw = 0.3; this.hd = 0.3; this.r = 0.3;
    this.m = mesh(PROPS.bush()); this.obj.add(this.m);
    this.m.rotation.y = Math.random() * 6;
    this.wob = 0;
  }
  onHit(h) {
    const g = this.g;
    sfx('cut');
    g.fx.burst(this.x, 0.3, this.z, 14, [0x3f9a3a, 0x55b24a, 0x2f7a2a], 3, { life: 0.6 });
    dropLoot(g, this.x, this.z, { pips: 1, chance: 0.4, heart: 0.12 });
    this.remove();
    return 'hit';
  }
  onGust() { this.wob = 1; }
  update(dt) { if (this.wob > 0) { this.wob -= dt * 2; this.m.rotation.z = Math.sin(this.wob * 20) * this.wob * 0.2; } }
}
export class Tuft extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.m = mesh(PROPS.tuft().map(p => { p = p.slice(); p[1] *= 1.5; return p; }), MAT, false);
    this.m.scale.setScalar(1.3); this.obj.add(this.m);
  }
  onHit() {
    const g = this.g;
    g.fx.burst(this.x, 0.2, this.z, 8, [0x7ccb52, 0x8ad85a], 2.5, { life: 0.5 });
    if (Math.random() < 0.18) dropLoot(g, this.x, this.z, { pips: 1, chance: 1, heart: 0.1 });
    sfx('cut'); this.remove();
    return null; // doesn't count as a "hit" for combat effects
  }
}
export class Drift extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.solid = true; this.hw = 0.5; this.hd = 0.5;
    this.key = 'drift:' + d.x + ',' + d.z;
    this.hp = 2;
    this.m = mesh([B(1.0, 0.5, 1.0, 0, 0, 0, 0xf1d38e), B(0.8, 0.3, 0.7, 0.05, 0.5, 0, 0xf6da99), B(0.4, 0.2, 0.4, -0.1, 0.8, 0, 0xfae4aa)]);
    this.obj.add(this.m);
    if (g.flags[this.key]) this.remove();
  }
  onGust(dir, power) {
    const g = this.g;
    this.hp -= power;
    g.fx.burst(this.x, 0.4, this.z, 20, [0xf1d38e, 0xf6da99], 3.5, { life: 0.8 });
    sfx('cut');
    if (this.hp <= 0) { g.flags[this.key] = true; this.remove(); }
    else this.m.scale.y = 0.55;
  }
  get prompt() { return null; }
}
export class Boulder extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.solid = true; this.hw = 0.5; this.hd = 0.5; this.interactable = true;
    this.obj.add(mesh([B(1.0, 0.9, 0.95, 0, 0, 0, 0x6a5a5a), B(0.7, 0.3, 0.7, 0.05, 0.9, 0, 0x7a6a6a), B(0.04, 0.6, 0.3, 0.2, 0.2, 0.48, 0x2a1a1a, 0, 0, 0.4)]));
  }
  get prompt() { return 'Examine'; }
  interact() { this.g.ui.toast('A cracked boulder.', 'Wind won\'t move this. It would take something explosive.', 2.4); }
  onGust() { sfx('thud'); }
}

// ------------------------------------------------ Signs, NPCs, landmarks
export class Sign extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.text = d.text; this.solid = true; this.hw = 0.3; this.hd = 0.2; this.interactable = true;
    if (d.mural) this.obj.add(mesh([B(0.9, 1.1, 0.2, 0, 0, 0, 0x6e5e76), B(0.7, 0.8, 0.22, 0, 0.15, 0, 0x8a7aa0), B(0.2, 0.2, 0.24, 0, 0.5, 0, 0x7fd36a)]));
    else this.obj.add(mesh([B(0.1, 0.5, 0.1, 0, 0, 0, 0x7a5a3a), B(0.6, 0.4, 0.08, 0, 0.35, 0, 0xc09a6a), B(0.5, 0.04, 0.09, 0, 0.62, 0, 0x8a6a4a)]));
  }
  get prompt() { return 'Read'; }
  interact() { this.g.ui.say(null, this.text); }
}
// A Bellstone: a small bronze bell on a mossy plinth. Resting refills life and tonics and
// makes it your checkpoint. Its chime is shown as rings, so the sound is visible too.
export class Bellstone extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.spawn = d.spawn; this.name = d.name; this.solid = true; this.hw = 0.3; this.hd = 0.3; this.interactable = true;
    this.obj.add(mesh([B(0.6, 0.3, 0.6, 0, 0, 0, 0x6e6a7a), B(0.66, 0.08, 0.66, 0, 0.3, 0, 0x5a8a3a), B(0.08, 0.5, 0.08, -0.2, 0.35, 0, 0x7a5a3a), B(0.08, 0.5, 0.08, 0.2, 0.35, 0, 0x7a5a3a), B(0.5, 0.08, 0.1, 0, 0.84, 0, 0x7a5a3a)]));
    this.bell = new THREE.Group(); this.bell.position.set(0, 0.8, 0);
    this.bell.add(mesh([B(0.2, 0.18, 0.2, 0, -0.14, 0, 0xc89a3a), B(0.26, 0.06, 0.26, 0, -0.24, 0, 0xd8aa4a), B(0.05, 0.05, 0.05, 0, -0.3, 0, 0x8a6a2a)]));
    this.obj.add(this.bell);
    this.glow = mesh([B(0.12, 0.12, 0.12, 0, 0.55, 0, 0xfff3b0)], MAT_GLOW, false); this.obj.add(this.glow);
    this.t = Math.random() * 5;
  }
  get prompt() { return 'Rest at the ' + this.name + ' Bellstone'; }
  interact() {
    const g = this.g;
    g.rest(this);
    this.swing = 1;
    sfx('chime'); g.fx.ring(this.x, this.z, 0.3, 2.2, 0xfff3b0, 0.6); g.fx.ring(this.x, this.z, 0.2, 3.4, 0xffd25e, 0.9, 0.3);
    g.fx.burst(this.x, 0.9, this.z, 16, [0xfff3b0, 0xffd25e], 2, { g: -1 });
    g.ui.toast('Rested at the ' + this.name + ' Bellstone', 'Life and tonics restored · You will wake here if you fall.', 2.4);
  }
  update(dt) {
    this.t += dt;
    this.swing = Math.max(0, (this.swing || 0) - dt * 0.5);
    this.bell.rotation.z = Math.sin(this.t * 9) * 0.5 * this.swing;
    const here = this.g.checkpoint.spawn === this.spawn && this.g.checkpoint.area === this.g.area.id;
    this.glow.visible = here || Math.sin(this.t * 2) > 0;
    if (Math.random() < (here ? 0.12 : 0.04)) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.5, y: 0.6, z: this.z + (Math.random() - 0.5) * 0.5, vy: 0.7, g: 0, color: 0xfff3b0, life: 0.8, size: 0.04 });
  }
}
// Posy's workbench: where essences are worked into weapons and sigils.
export class Workbench extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.solid = true; this.hw = 0.45; this.hd = 0.3; this.interactable = true;
    this.obj.add(mesh([B(0.9, 0.08, 0.55, 0, 0.42, 0, 0x9a6a3a), B(0.08, 0.42, 0.08, -0.38, 0.2, -0.2, 0x6a4a2a), B(0.08, 0.42, 0.08, 0.38, 0.2, -0.2, 0x6a4a2a), B(0.08, 0.42, 0.08, -0.38, 0.2, 0.2, 0x6a4a2a), B(0.08, 0.42, 0.08, 0.38, 0.2, 0.2, 0x6a4a2a),
      B(0.3, 0.12, 0.16, -0.15, 0.52, 0, 0x5a5a6a), B(0.16, 0.06, 0.1, -0.3, 0.6, 0, 0x6a6a7a), B(0.04, 0.2, 0.04, 0.2, 0.56, 0.08, 0x8a6a3a), B(0.14, 0.06, 0.06, 0.2, 0.66, 0.08, 0x9a9aa8), B(0.12, 0.1, 0.12, 0.3, 0.51, -0.12, 0xc9a8ff)]));
    this.t = 0;
  }
  get prompt() { return 'Use the workbench'; }
  interact() { this.g.guide.event && this.g.guide.event('craft'); this.g.ui.openCraft(); }
  update(dt) { this.t += dt; if (Math.random() < 0.03) this.g.fx.add({ x: this.x + 0.3, y: 0.6, z: this.z - 0.12, vy: 0.6, g: 0, color: 0xc9a8ff, life: 0.6, size: 0.04 }); }
}
// The Verdant Chime's echo: a ghost of Moss that repeats a gust from where it was made.
export class GustEcho extends Entity {
  constructor(g, x, z, facing, power, delay = 1.5) {
    super(g, x, z); this.facing = facing; this.power = power; this.t = 0; this.delay = delay; this.alwaysUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.4, depthWrite: false });
    const ghost = new THREE.Group();
    for (const [w, h, d, x0, y0] of [[0.34, 0.36, 0.3, 0, 0.3], [0.4, 0.34, 0.36, 0, 0.62], [0.12, 0.14, 0.3, 0.12, 0.42]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x0, y0, 0); ghost.add(b); }
    ghost.rotation.y = facing; this.obj.add(ghost); this.ghost = ghost; this.mat = mat;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 24), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; this.obj.add(this.ring);
  }
  update(dt) {
    const g = this.g; this.t += dt;
    const k = Math.min(1, this.t / this.delay);
    this.ring.scale.setScalar(1.6 - k * 1.2); // closes in as the echo arrives
    this.mat.opacity = 0.25 + 0.2 * Math.sin(this.t * 14);
    if (this.t >= this.delay) {
      g.fx.ring(this.x, this.z, 0.2, 1.4, 0x9ad8ff, 0.35); g.fx.ring(this.x, this.z, 0.1, 2.2, 0xdff4ff, 0.5, 0.2);
      g.gust(this, this.power, false, true);
      g.stats.echoes = (g.stats.echoes || 0) + 1;
      this.remove();
      return;
    }
    this.sync();
  }
}
// Once the mill turns again: a whetwheel driven by the sails, flour sacks, bunting — and the
// mill's hum, drawn as rings so it can be seen as well as heard.
export class MillYard extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.solid = true; this.hw = 0.45; this.hd = 0.3; this.interactable = true; this.t = 0;
    this.obj.add(mesh([B(0.1, 0.7, 0.1, -0.35, 0.35, 0, 0x7a5a3a), B(0.1, 0.7, 0.1, 0.35, 0.35, 0, 0x7a5a3a), B(0.8, 0.08, 0.1, 0, 0.7, 0, 0x7a5a3a), B(0.5, 0.1, 0.3, 0, 0.05, 0, 0x6a4a2a)]));
    this.wheel = new THREE.Group(); this.wheel.position.set(0, 0.45, 0);
    this.wheel.add(mesh([B(0.1, 0.5, 0.5, 0, 0, 0, 0x9a9aa8), B(0.12, 0.3, 0.3, 0, 0, 0, 0xb8b8c8), B(0.6, 0.06, 0.06, 0, 0, 0, 0x5a4a3a)]));
    this.obj.add(this.wheel);
    const sacks = mesh([B(0.3, 0.32, 0.26, -1.2, 0.16, 0.9, 0xf2e2c0), B(0.3, 0.28, 0.26, -0.9, 0.14, 1.1, 0xe8d8b0), B(0.28, 0.26, 0.24, -1.05, 0.44, 1.0, 0xf2e2c0), B(0.1, 0.06, 0.1, -1.2, 0.34, 0.9, 0xc0a070)]);
    this.obj.add(sacks);
    const cols = [0xe8424f, 0xffd25e, 0x7ad8ff, 0x7fd36a];
    const bunt = [B(0.06, 1.5, 0.06, -2, 0.75, -1.6, 0x7a5a3a), B(0.06, 1.5, 0.06, 2.4, 0.75, -1.6, 0x7a5a3a), B(4.4, 0.03, 0.03, 0.2, 1.45, -1.6, 0x5a4a3a)];
    for (let i = 0; i < 9; i++) bunt.push(B(0.2, 0.22, 0.02, -1.8 + i * 0.5, 1.3, -1.6, cols[i % 4]));
    this.obj.add(mesh(bunt));
  }
  get prompt() { return 'Look at the whetwheel'; }
  interact() { this.g.ui.say(null, 'The mill\'s sails turn a whetwheel now. It sings a thin, bright note as it spins — half of a song the Dawnbell used to finish.'); }
  update(dt) {
    const g = this.g; this.t += dt;
    this.wheel.rotation.x -= dt * 6;
    if (Math.random() < 0.06) g.fx.add({ x: this.x + 0.25, y: 0.45, z: this.z + (Math.random() - 0.5) * 0.3, vx: 1.5, vy: 1.2, g: 6, color: 0xffd25e, life: 0.3, size: 0.03 });
    this.humT = (this.humT || 0) - dt;
    if (this.humT <= 0) { this.humT = 3.2; g.fx.ring(47, 51, 0.8, 2.6, 0xfff3cf, 1.2, 0.15); }
  }
}
export class NPC extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.id = d.id; this.name = d.name; this.solid = true; this.hw = 0.3; this.hd = 0.3; this.interactable = true;
    this.m = makeFolk(d.look); this.obj.add(this.m.root);
    this.home = { x: d.x, z: d.z }; this.wanderR = d.wander || 0; this.wt = Math.random() * 3;
    this.facing = 0; this.shop = d.shop;
    this.moveMode = 'walk'; this.r = 0.25;
    this.bubble = mesh([B(0.1, 0.24, 0.06, 0, 0.1, 0, 0xffd25e), B(0.1, 0.08, 0.06, 0, -0.06, 0, 0xffd25e)], MAT_GLOW, false);
    this.bubble.position.y = 1.35; this.bubble.visible = false; this.obj.add(this.bubble);
  }
  get prompt() { return 'Talk'; }
  interact() { this.talkT = 2; this.g.story.talk(this); }
  update(dt) {
    const g = this.g, t = g.time, p = g.player;
    const d = this.dist(p);
    let sp = 0;
    if (this.wanderR && d > 2) {
      this.wt -= dt;
      if (this.wt <= 0) { this.wt = 2 + Math.random() * 3; this.tx = this.home.x + (Math.random() - 0.5) * this.wanderR * 2; this.tz = this.home.z + (Math.random() - 0.5) * this.wanderR * 2; }
      if (this.tx !== undefined) {
        const dx = this.tx - this.x, dz = this.tz - this.z, l = Math.hypot(dx, dz);
        if (l > 0.2) { sp = 1.4; this.facing = angleLerp(this.facing, Math.atan2(dx, dz), dt * 6); move(g, this, dx / l * sp * dt, dz / l * sp * dt); }
      }
    }
    if (d < 3) this.facing = angleLerp(this.facing, this.angleTo(p), dt * 5);
    this.obj.rotation.y = this.facing;
    this.m.body.position.y = Math.abs(Math.sin(t * 8)) * 0.04 * (sp > 0 ? 1 : 0) + Math.sin(t * 2 + this.home.x) * 0.01;
    this.m.armL.rotation.x = sp ? Math.sin(t * 8) * 0.5 : 0; this.m.armR.rotation.x = sp ? -Math.sin(t * 8) * 0.5 : 0;
    this.m.armL.rotation.z = 0; this.m.armR.rotation.z = 0; this.m.body.rotation.x = 0; this.m.body.rotation.y = 0; this.m.head.rotation.z = 0;
    // little working routines when nobody is talking to them (presentation only)
    if (!sp && d > 2.2 && !(this.talkT > 0)) {
      const W = { posy: 'wipe', oswin: 'haul', tamsin: 'ponder', fisher: 'cast', ada: 'cast', brisk: 'guard', fennel: 'play', hermit: 'ponder' }[this.id];
      if (W === 'wipe') { this.m.armR.rotation.x = -1.1; this.m.armR.rotation.z = Math.sin(t * 5) * 0.5; this.m.body.rotation.x = 0.12; }
      if (W === 'haul') { const k = (Math.sin(t * 1.4) + 1) / 2; this.m.armL.rotation.x = this.m.armR.rotation.x = -0.9 - k * 0.6; this.m.body.rotation.x = 0.2 * k; if (g.flags.q_mill === 2 && Math.random() < 0.03) g.fx.add({ x: this.x, y: 0.7, z: this.z, vy: 0.4, g: 0, color: 0xf2e2c0, life: 0.8, size: 0.04 }); }
      if (W === 'ponder') { this.m.armR.rotation.x = -1.6; this.m.armR.rotation.z = 0.6; this.m.head.rotation.z = Math.sin(t * 0.8) * 0.08; }
      if (W === 'cast') { this.m.armR.rotation.x = -0.6 + Math.sin(t * 0.9) * 0.15; }
      if (W === 'guard') { this.m.body.rotation.y = Math.sin(t * 0.5) * 0.4; }
      if (W === 'play') { this.m.body.position.y += Math.abs(Math.sin(t * 6)) * 0.08; this.m.armL.rotation.z = -1.2; this.m.armR.rotation.z = 1.2; }
    }
    if (this.talkT > 0) { this.talkT -= dt; this.m.head.rotation.x = Math.sin(t * 18) * 0.08; } else this.m.head.rotation.x = 0;
    this.bubble.visible = g.story.hasNews(this.id);
    this.bubble.position.y = 1.35 + Math.sin(t * 4) * 0.05;
    this.sync();
  }
}
export class Bell extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.interactable = true; this.solid = false;
    this.bell = mesh([B(0.8, 0.7, 0.8, 0, -0.7, 0, 0xd0a040), B(1.0, 0.14, 1.0, 0, -0.75, 0, 0xb08a30), B(0.5, 0.2, 0.5, 0, 0, 0, 0xd0a040), B(0.12, 0.2, 0.12, 0, -0.95, 0, 0x6a5a3a)]);
    this.bell.position.y = 2.95; this.obj.add(this.bell);
    this.swing = 0;
  }
  get prompt() { return null; }
  ring(ok) { this.swing = 1; }
  update(dt) { this.swing = Math.max(0, this.swing - dt * 0.4); this.bell.rotation.z = Math.sin(this.g.time * 5) * 0.4 * this.swing; }
}
export class Gate extends Entity {
  constructor(g, d) { super(g, d.x, d.z); this.interactable = true; this.gems = []; const cols = [0x7fd36a, 0xff7a2a, 0x7ad8ff];
    for (let i = 0; i < 3; i++) { const m = mesh([B(0.34, 0.5, 0.1, 0, 0, 0, 0x2a2438)], MAT_GLOW, false); m.position.set(-0.8 + i * 0.8, 3.0, -0.8); this.obj.add(m); this.gems.push({ m, c: cols[i] }); }
  }
  get prompt() { return 'Examine'; }
  interact() { this.g.story.gate(); }
  update() {
    const ch = this.g.inv.chimes;
    const keys = ['verdant', 'ember', 'tide'];
    this.gems.forEach((gm, i) => { if (ch.includes(keys[i]) && !gm.lit) { gm.lit = true; gm.m.geometry.dispose(); gm.m.geometry = geo([B(0.34, 0.5, 0.1, 0, 0, 0, gm.c)]); } });
  }
}
export class Windmill extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.blades = new THREE.Group(); this.blades.position.set(0, 2.1, 0.62);
    for (let i = 0; i < 4; i++) { const p = new THREE.Group(); p.rotation.z = i * Math.PI / 2; p.add(mesh([B(0.14, 1.4, 0.04, 0, 0.1, 0, 0x8a6a4a), B(0.34, 1.1, 0.03, 0.2, 0.35, 0.01, 0xf2e2c0)])); this.blades.add(p); }
    this.obj.add(this.blades);
    this.spinV = g.flags.windmill ? 1.2 : 0;
    this.r = 1.5;
  }
  onGust(dir, power) {
    const g = this.g;
    if (g.flags.windmill) { this.spinV = 6; return; }
    if (power === 2) { this.spinV = 8; g.flags.windmill = true; sfx('windmill'); setTimeout(() => sfx('secret'), 600); g.ui.toast('The windmill creaks back to life!', 'Tell Miller Oswin.', 2.4); }
    else { this.spinV = 1.5; setTimeout(() => this.spinV = 0, 800); g.ui.toast('The blades budge… then stop.', 'It needs a stronger wind. Hold L to build a gale.', 2.4); }
  }
  update(dt) { this.blades.rotation.z -= this.spinV * dt; if (this.g.flags.windmill) this.spinV += (1.2 - this.spinV) * dt * 0.5; }
}
export class Roots extends Entity {
  constructor(g, d) { super(g, d.x, d.z); this.obj.add(mesh(PROPS.roots())); this.obj.rotation.y = Math.random() * 6; }
}
export class ExitGlow extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.9), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.18, depthWrite: false }));
    m.position.y = 0.8; this.obj.add(m); this.m = m;
  }
  update() { this.m.material.opacity = 0.14 + Math.sin(this.g.time * 3) * 0.05; if (Math.random() < 0.1) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.8, y: 0.1, z: this.z + (Math.random() - 0.5) * 0.4, vy: 1, g: 0, color: 0xfff3b0, life: 1, size: 0.04 }); }
}

// ------------------------------------------------ Chime pedestal (artifact)
export class ChimePedestal extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.interactable = true; this.solid = true; this.hw = 0.4; this.hd = 0.4;
    this.obj.add(mesh([B(0.9, 0.4, 0.9, 0, 0, 0, 0x6e5e76), B(0.7, 0.2, 0.7, 0, 0.4, 0, 0x8a7aa0)]));
    this.chime = makeChimeModel(0x7fd36a, 0xd8ffc0);
    this.chime.position.y = 1.2; this.obj.add(this.chime);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.46, 24), new THREE.MeshBasicMaterial({ color: 0xb8ff9a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.halo.position.y = 1.35; this.obj.add(this.halo);
    this.attach();
  }
  get prompt() { return 'Take'; }
  interact() { this.g.story.takeChime(this); }
  update(dt) {
    const t = this.g.time;
    this.chime.rotation.y += dt * 1.2; this.chime.position.y = 1.2 + Math.sin(t * 2) * 0.08;
    this.halo.rotation.x = Math.PI / 2 + Math.sin(t) * 0.3; this.halo.rotation.y = t;
    if (Math.random() < 0.3) this.g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.6, y: 1.2, z: this.z + (Math.random() - 0.5) * 0.6, vy: 0.6, g: 0, color: 0xb8ff9a, life: 0.8, size: 0.04 });
  }
}
export function makeChimeModel(c1, c2) {
  // a tuning-fork-shaped crystal chime: the visual language of the Dawnbell's Voices
  const g = new THREE.Group();
  g.add(mesh([
    B(0.08, 0.26, 0.08, 0, -0.36, 0, 0xffd25e), B(0.2, 0.06, 0.1, 0, -0.12, 0, 0xffd25e),
    B(0.07, 0.4, 0.07, -0.1, -0.08, 0, c1), B(0.07, 0.4, 0.07, 0.1, -0.08, 0, c1),
    B(0.05, 0.3, 0.05, -0.1, 0.0, 0.02, c2), B(0.05, 0.3, 0.05, 0.1, 0.0, 0.02, c2),
    B(0.12, 0.12, 0.12, 0, 0.36, 0, c2, 0.78, 0.78, 0),
  ], MAT_GLOW, false));
  return g;
}

// ------------------------------------------------ Warps & encounter triggers
export class Warp extends Entity {
  constructor(g, d) { super(g, d.x, d.z); this.to = d.to; this.spawnName = d.spawn; this.rad = d.r || 0.6; this.label = d.label; this.cool = 0.6; }
  update(dt) {
    const g = this.g, p = g.player;
    this.cool -= dt;
    if (this.cool > 0 || g.transitioning || p.state === 'dead') return;
    if (Math.hypot(p.x - this.x, p.z - this.z) < this.rad) g.warpTo(this.to, this.spawnName);
  }
}
export class Arena extends Entity {
  // sealed wave battle; completion sets `${id}.clear`
  constructor(g, d, waves, opts = {}) {
    super(g, 0, 0);
    this.id = d.id; this.roomId = d.room; this.waves = waves; this.wave = -1; this.active = false;
    this.cx = d.x; this.cz = d.z; this.radius = d.radius; this.opts = opts;
    this.done = g.signal(this.id + '.clear');
  }
  inside() {
    const g = this.g, p = g.player;
    if (this.roomId) return g.room && g.room.id === this.roomId && p.z < g.room.z1 - 1.2 && p.z > g.room.z0 + 1.2 && p.x > g.room.x0 + 1.2 && p.x < g.room.x1 - 1.2;
    return Math.hypot(p.x - this.cx, p.z - this.cz) < this.radius;
  }
  update(dt) {
    const g = this.g;
    if (this.done) return;
    if (!this.active) {
      if (this.opts.requires && !this.opts.requires()) return;
      if (this.inside()) { this.active = true; this.start(); }
      return;
    }
    if (g.player.state === 'dead') return;
    const alive = g.entities.filter(e => e.isEnemy && !e.dead && e.arena === this).length;
    if (alive === 0) {
      this.delay = (this.delay ?? 0.8) - dt;
      if (this.delay > 0) return;
      this.delay = 0.8;
      this.wave++;
      if (this.wave >= this.waves.length) return this.finish();
      g.ui.banner(this.opts.title || 'AMBUSH', `Wave ${this.wave + 1} of ${this.waves.length}`, 1.4);
      for (const [kind, ox, oz, tag] of this.waves[this.wave]) {
        const e = g.spawnEnemy(kind, this.cxr + ox, this.czr + oz, { aggro: 30, eliteChance: this.opts.eliteChance });
        if (e) { e.arena = this; if (tag === 'champion') g.makeChampion(e); }
      }
    }
  }
  start() {
    const g = this.g;
    if (this.roomId) { this.cxr = (g.room.x0 + g.room.x1) / 2; this.czr = (g.room.z0 + g.room.z1) / 2; g.sealRoom(this.roomId, true); }
    else { this.cxr = this.cx; this.czr = this.cz; }
    sfx('roar');
    if (this.opts.music) g.musicOverride(this.opts.music);
    this.wave = -1;
    this.delay = 0.5;
    // hold "alive" at non-zero while spawns are pending
  }
  finish() {
    const g = this.g;
    this.done = true; this.active = false;
    g.setSignal(this.id + '.clear', true, !this.opts.noPersist);
    if (this.roomId) g.sealRoom(this.roomId, false);
    g.ui.banner('VICTORY', this.opts.victory || 'The Hush retreats.', 1.8);
    sfx('secret');
    if (this.opts.music) g.musicOverride(null);
    this.opts.onClear && this.opts.onClear();
  }
}
