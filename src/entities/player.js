import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { makeHero } from '../models.js';
import { sfx } from '../engine/audio.js';
import { angDiff, angleLerp, clamp } from '../engine/util.js';
import { T } from '../world/tiles.js';
import { flashObj } from './common.js';

const SPEED = 5.0;

export class Player extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.isPlayer = true;
    this.moveMode = 'player';
    this.r = 0.28;
    this.m = makeHero();
    this.obj.add(this.m.root);
    this.shadow = null;
    this.state = 'move'; this.st = 0;
    this.combo = 0; this.buffer = 0; this.attackId = 0;
    this.chargeT = 0; this.invuln = 0; this.blockT = 0; this.itemT = 0;
    this.walkT = 0; this.pushT = 0; this.pushDir = null;
    this.hitSet = new Set();
    this.lastSafe = { x, z };
    this.speedMul = 1;
    this.anim = { bob: 0 };
    this.stepT = 0;
    this.fallT = 0;
    this.holdItem = null;
    this.rollCd = 0;
  }
  get inv() { return this.g.inv; }

  setState(s) { this.state = s; this.st = 0; }

  hurt(h) {
    const g = this.g;
    if (this.invuln > 0 || this.state === 'dead' || this.state === 'fall' || g.cutscene) return false;
    if (this.state === 'roll' && this.st < 0.3) return false;
    const fromAng = Math.atan2(h.x - this.x, h.z - this.z);
    if (this.state === 'block' && !h.unblockable && Math.abs(angDiff(this.facing, fromAng)) < 1.4) {
      const window = this.inv.shieldLv > 0 ? 0.28 : 0.2;
      if (this.blockT < window) {
        sfx('parry'); g.hitstop(0.12); g.pr.addFlash(0.25, 0xfff3b0);
        g.fx.sparks(this.x + Math.sin(fromAng) * 0.4, 0.4, this.z + Math.cos(fromAng) * 0.4, fromAng, 16, 0xfff3b0);
        g.fx.ring(this.x, this.z, 0.3, 1.8, 0xfff3b0, 0.3, 0.4);
        if (h.src && h.src.onParried) h.src.onParried();
        g.addSurge(12);
        g.stats.parries = (g.stats.parries || 0) + 1;
        return 'parry';
      }
      sfx('block');
      g.fx.sparks(this.x + Math.sin(fromAng) * 0.35, 0.35, this.z + Math.cos(fromAng) * 0.35, fromAng, 6);
      const chip = this.inv.shieldLv > 0 ? 0 : (h.dmg >= 2 ? 1 : 0);
      this.knock(fromAng + Math.PI, 3.5);
      if (chip) this.takeDamage(chip);
      return 'block';
    }
    this.takeDamage(h.dmg);
    this.knock(fromAng + Math.PI, h.kb ?? 6);
    this.setState('hurt');
    this.invuln = 1.0;
    sfx('hurt'); g.pr.addShake(0.6); g.hitstop(0.06);
    flashObj(this.obj, 0.12, 0xff5a5a);
    g.fx.burst(this.x, 0.5, this.z, 8, [0xff5a5a, 0xffffff], 2.5);
    return 'hit';
  }
  takeDamage(n) {
    const inv = this.inv;
    inv.hp = Math.max(0, inv.hp - n);
    this.g.ui.hearts(true);
    if (inv.hp <= 0) { this.setState('dead'); this.g.onPlayerDeath(); }
    else if (inv.hp <= 2) sfx('low');
  }
  knock(ang, s) { this.kx = Math.sin(ang) * s; this.kz = Math.cos(ang) * s; }

  startAttack() {
    const g = this.g;
    this.combo = this.state === 'attack' && this.combo < 3 ? this.combo + 1 : 1;
    this.setState('attack');
    this.attackId++;
    this.hitSet.clear();
    this.buffer = 0;
    // soft aim toward nearest enemy in front
    const t = g.nearestEnemy(this.x, this.z, 2.4, this.facing, 1.1);
    if (t) this.facing = Math.atan2(t.x - this.x, t.z - this.z);
    sfx(this.combo === 3 ? 'spin' : this.combo === 2 ? 'swing2' : 'swing');
    this.lunge = this.combo === 3 ? 4 : 2.5;
  }

  doHits(range, halfAng, dmg, kind, kb) {
    this.g.hitArc(this, this.x, this.z, this.facing, range, halfAng, { dmg, kind, kb, id: this.attackId });
  }

  update(dt) {
    const g = this.g, inp = g.input, inv = this.inv;
    this.st += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    const locked = g.locked();
    let mx = locked ? 0 : inp.mx, mz = locked ? 0 : inp.mz;
    const mlen = Math.hypot(mx, mz);
    let speed = 0;
    let vx = 0, vz = 0;
    const s = this.state;
    const swordMul = [1, 1.5, 2][inv.swordLv] || 1;

    if (s === 'dead') { this.animate(dt, 0); return; }
    if (s === 'fall') {
      this.fallT += dt;
      this.m.root.scale.setScalar(Math.max(0.01, 1 - this.fallT * 1.8));
      this.m.root.position.y = -this.fallT * 2;
      if (this.fallT > 0.6) {
        this.m.root.scale.setScalar(1); this.m.root.position.y = 0;
        const p = g.respawnPoint();
        this.x = p.x; this.z = p.z; this.setState('move'); this.invuln = 1.2;
        this.takeDamage(1); sfx('hurt');
      }
      this.sync(); return;
    }
    if (s === 'hold') { // item hold-up pose during cutscene
      this.animate(dt, 0); this.sync(); return;
    }

    if (!locked) {
      if (inp.pressed('potion')) g.drinkPotion();
      if (inp.pressed('surge') && g.surge >= 100 && s !== 'surge') { this.setState('surge'); this.invuln = 0.9; sfx('roll'); }
    }

    switch (s) {
      case 'move': {
        speed = SPEED;
        if (mlen > 0.1) this.facing = angleLerp(this.facing, Math.atan2(mx, mz), Math.min(1, dt * 18));
        if (!locked) {
          if (inp.pressed('attack')) { this.startAttack(); break; }
          if (inp.pressed('roll') && this.rollCd <= 0) { this.rollDir = mlen > 0.1 ? Math.atan2(mx, mz) : this.facing; this.facing = this.rollDir; this.setState('roll'); sfx('roll'); break; }
          if (inp.down('shield')) { this.setState('block'); this.blockT = 0; break; }
          if (inp.pressed('item') && inv.bellows) { this.setState('item'); this.itemT = 0; break; }
          if (inp.pressed('interact')) g.interact();
        }
        break;
      }
      case 'attack': {
        const dur = this.combo === 3 ? 0.42 : 0.3;
        speed = 0;
        const lungeT = this.combo === 3 ? 0.18 : 0.1;
        if (this.st < lungeT) { vx = Math.sin(this.facing) * this.lunge; vz = Math.cos(this.facing) * this.lunge; }
        if (this.combo < 3 && this.st > 0.04 && this.st < 0.16) this.doHits(1.25, 1.15, 1 * swordMul, 'sword', 4);
        if (this.combo === 3 && this.st > 0.08 && this.st < 0.3) this.doHits(1.45, Math.PI, 1.5 * swordMul, 'spin3', 7);
        if (this.st > 0.03 && this.st < 0.05 && !this.arcDone) {
          this.arcDone = true;
          if (this.combo === 3) g.fx.arc(this.x, 0.35, this.z, this.facing, 1.45, Math.PI * 2, 0xffffff, 0.22, 0.4, true);
          else g.fx.arc(this.x, 0.35, this.z, this.facing + (this.combo === 1 ? 0.2 : -0.2), 1.2, 2.2, 0xffffff, 0.14, 0.35);
        }
        if (!locked && inp.pressed('attack')) this.buffer = 0.25;
        this.buffer -= dt;
        if (this.st > 0.14 && this.buffer > 0 && this.combo < 3) { this.arcDone = false; if (mlen > 0.1) this.facing = Math.atan2(mx, mz); this.startAttack(); break; }
        if (this.st > 0.12 && !locked && inp.pressed('roll')) { this.arcDone = false; this.rollDir = mlen > 0.1 ? Math.atan2(mx, mz) : this.facing; this.facing = this.rollDir; this.setState('roll'); sfx('roll'); break; }
        if (this.st >= dur) {
          this.arcDone = false;
          if (inp.down('attack') && this.combo === 1 && !locked) { this.setState('charge'); this.chargeT = 0; }
          else this.setState('move');
        }
        break;
      }
      case 'charge': {
        speed = 2.2;
        this.chargeT += dt;
        if (Math.floor((this.chargeT - dt) * 8) !== Math.floor(this.chargeT * 8) && this.chargeT < 0.7) sfx('charge');
        if (this.chargeT >= 0.7 && this.chargeT - dt < 0.7) { sfx('charged'); g.fx.burst(this.x, 0.6, this.z, 10, 0xfff3b0, 1.5, { g: 0 }); }
        if (this.chargeT >= 0.7 && Math.random() < 0.4) g.fx.add({ x: this.x + Math.sin(this.facing + 0.8) * 0.4, y: 0.5 + Math.random() * 0.3, z: this.z + Math.cos(this.facing + 0.8) * 0.4, vy: 1, g: 0, color: 0xfff3b0, life: 0.3, size: 0.05 });
        if (!inp.down('attack') || locked) {
          if (this.chargeT >= 0.7) { this.setState('spin'); this.attackId++; this.hitSet.clear(); sfx('spin'); g.fx.arc(this.x, 0.3, this.z, 0, 1.9, 0, 0xfff3b0, 0.3, 0.6, true); g.fx.ring(this.x, this.z, 0.5, 2.2, 0xfff3b0, 0.3, 0.2); }
          else this.setState('move');
        }
        break;
      }
      case 'spin': {
        speed = 1.5;
        if (this.st < 0.35) this.doHits(1.95, Math.PI, 2.5 * swordMul, 'spin', 9);
        if (this.st >= 0.45) this.setState('move');
        break;
      }
      case 'roll': {
        const k = this.st / 0.34;
        const sp = 10.5 * (1 - k * 0.6);
        vx = Math.sin(this.rollDir) * sp; vz = Math.cos(this.rollDir) * sp;
        if (Math.random() < 0.5) g.fx.dust(this.x, this.z, 1);
        if (this.st >= 0.34) { this.setState('move'); this.rollCd = 0.12; }
        break;
      }
      case 'block': {
        speed = 2.2;
        this.blockT += dt;
        if (!inp.down('shield') || locked) this.setState('move');
        else if (inp.pressed('roll') && mlen > 0.1) { this.rollDir = Math.atan2(mx, mz); this.facing = this.rollDir; this.setState('roll'); sfx('roll'); }
        else if (inp.pressed('attack')) this.startAttack();
        break;
      }
      case 'item': {
        speed = 1.8;
        this.itemT += dt;
        if (mlen > 0.1) this.facing = angleLerp(this.facing, Math.atan2(mx, mz), Math.min(1, dt * 10));
        const full = 0.75;
        if (this.itemT > 0.18 && Math.random() < 0.5) g.fx.add({ x: this.x + Math.sin(this.facing) * 0.5 + (Math.random() - 0.5) * 1.5, y: 0.3 + Math.random() * 0.4, z: this.z + Math.cos(this.facing) * 0.5 + (Math.random() - 0.5) * 1.5, vx: -Math.sin(this.facing) * 2, vz: -Math.cos(this.facing) * 2, g: 0, color: 0xdff4ff, life: 0.35, size: 0.04 });
        if (this.itemT >= full && this.itemT - dt < full) { sfx('charged'); }
        if (!inp.down('item') || locked) {
          const power = this.itemT >= full ? 2 : 1;
          g.gust(this, power);
          this.setState('itemrecover');
        }
        break;
      }
      case 'itemrecover': speed = 1; if (this.st > 0.22) this.setState('move'); break;
      case 'hurt': {
        speed = 0;
        if (this.st > 0.28) this.setState('move');
        break;
      }
      case 'surge': {
        speed = 0;
        if (this.st > 0.35 && !this.surged) {
          this.surged = true;
          g.doSurge(this);
        }
        if (this.st > 0.7) { this.surged = false; this.setState('move'); }
        break;
      }
    }
    if (speed > 0 && mlen > 0.1 && this.state !== 'roll') {
      vx += mx * speed * this.speedMul; vz += mz * speed * this.speedMul;
    }
    // knockback
    if (this.kx) {
      vx += this.kx; vz += this.kz;
      const d = Math.exp(-dt * 9); this.kx *= d; this.kz *= d;
      if (Math.abs(this.kx) + Math.abs(this.kz) < 0.1) this.kx = this.kz = 0;
    }
    // external pull (boss inhale)
    if (this.pullX) { vx += this.pullX; vz += this.pullZ; this.pullX = this.pullZ = 0; }

    const ox = this.x, oz = this.z;
    const hitWall = move(g, this, vx * dt, vz * dt);
    const moved = Math.hypot(this.x - ox, this.z - oz) / dt;

    // pushing stone blocks
    if (this.state === 'move' && mlen > 0.5 && hitWall) {
      const dir = Math.abs(mx) > Math.abs(mz) ? [Math.sign(mx), 0] : [0, Math.sign(mz)];
      const blk = g.blockAhead(this, dir);
      if (blk) {
        if (this.pushDir && this.pushDir[0] === dir[0] && this.pushDir[1] === dir[1]) this.pushT += dt; else { this.pushT = 0; this.pushDir = dir; }
        this.pushing = true;
        if (this.pushT > 0.35) { blk.tryPush(dir); this.pushT = 0; }
      } else { this.pushT = 0; this.pushing = false; }
    } else { this.pushT = 0; this.pushing = false; }

    // hazards
    const tx = Math.floor(this.x), tz = Math.floor(this.z);
    const t = g.tileAt(tx, tz);
    if (t === T.PIT && this.state !== 'roll') {
      // only fall if centre is well inside the pit
      const fx = this.x - tx, fz = this.z - tz;
      if (fx > 0.12 && fx < 0.88 && fz > 0.12 && fz < 0.88) { this.setState('fall'); this.fallT = 0; sfx('fall'); }
    } else if (t !== T.PIT) {
      let safe = true;
      for (const [dx, dz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) if (g.tileAt(Math.floor(this.x + dx), Math.floor(this.z + dz)) === T.PIT) safe = false;
      if (safe) { this.lastSafe.x = this.x; this.lastSafe.z = this.z; }
    }
    if (moved > 0.5 && this.state === 'move') {
      this.stepT += dt * moved;
      if (this.stepT > 1.3) { this.stepT = 0; sfx('step'); if (g.area.id === 'overworld') g.fx.dust(this.x, this.z, 1, t === T.SAND ? 0xf1d38e : 0xc8d8a8); }
    }
    this.animate(dt, moved);
    this.sync();
  }

  animate(dt, speed) {
    const m = this.m, s = this.state, t = this.g.time;
    this.obj.rotation.y = this.facing;
    // reset
    m.body.rotation.set(0, 0, 0); m.body.position.set(0, 0, 0); m.body.scale.set(1, 1, 1);
    m.armR.rotation.set(0, 0, 0); m.armL.rotation.set(0, 0, 0); m.legL.rotation.set(0, 0, 0); m.legR.rotation.set(0, 0, 0);
    m.head.rotation.set(0, 0, 0);
    m.sword.rotation.set(Math.PI / 2 * 0.9, 0, 0);
    m.shield.rotation.set(0, 0, 0); m.shield.position.set(-0.06, -0.08, 0.02);
    const walk = clamp(speed / 5, 0, 1.2);
    this.walkT += dt * (4 + speed * 2.2);
    const sw = Math.sin(this.walkT) * walk;
    m.legL.rotation.x = sw * 0.9; m.legR.rotation.x = -sw * 0.9;
    m.armL.rotation.x = -sw * 0.6; m.armR.rotation.x = sw * 0.6;
    m.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.05 * walk + Math.sin(t * 2.5) * 0.008;
    m.head.rotation.z = Math.sin(this.walkT) * 0.06 * walk;
    // scarf
    const lag = clamp(speed / 5, 0, 1.4);
    m.tail1.rotation.x = -0.4 - lag * 0.7 + Math.sin(t * 13) * 0.12 * (0.3 + lag);
    m.tail2.rotation.x = -0.2 - lag * 0.4 + Math.sin(t * 13 + 1) * 0.18 * (0.3 + lag);
    m.tail1.rotation.y = Math.sin(t * 7) * 0.2 * lag;
    switch (s) {
      case 'attack': {
        const k = this.combo === 3 ? this.st / 0.42 : this.st / 0.3;
        if (this.combo === 1) { m.body.rotation.y = 0.9 - Math.min(1, k * 3) * 1.8; m.armR.rotation.x = -1.4; m.armR.rotation.z = 0.4; m.sword.rotation.x = 1.5; }
        else if (this.combo === 2) { m.body.rotation.y = -0.9 + Math.min(1, k * 3) * 1.8; m.armR.rotation.x = -1.4; m.armR.rotation.z = -0.3; m.sword.rotation.x = 1.5; }
        else { m.body.rotation.y = -Math.min(1, k * 1.6) * Math.PI * 2; m.armR.rotation.x = -1.5; m.armR.rotation.z = 1.2; m.sword.rotation.x = 1.5; m.body.position.y = Math.sin(Math.min(1, k * 1.5) * Math.PI) * 0.15; }
        m.legL.rotation.x = 0.5; m.legR.rotation.x = -0.4;
        m.body.rotation.x = 0.15;
        break;
      }
      case 'charge': {
        m.armR.rotation.x = -2.6; m.armR.rotation.z = 0.3; m.sword.rotation.x = 0.4;
        m.body.rotation.y = 0.5;
        if (this.chargeT > 0.7) m.body.position.x = Math.sin(t * 60) * 0.01;
        break;
      }
      case 'spin': {
        m.body.rotation.y = -(this.st / 0.45) * Math.PI * 4;
        m.armR.rotation.x = -1.5; m.armR.rotation.z = 1.4; m.sword.rotation.x = 1.5;
        m.body.position.y = 0.05;
        break;
      }
      case 'roll': {
        const k = this.st / 0.34;
        m.body.rotation.x = k * Math.PI * 2;
        m.body.position.y = 0.2 + Math.sin(k * Math.PI) * 0.1;
        m.body.scale.set(1, 0.8, 1);
        break;
      }
      case 'block': {
        m.armL.rotation.x = -1.4; m.armL.rotation.y = 0.5; m.shield.rotation.y = -1.2; m.shield.position.set(0.0, -0.08, 0.12);
        m.armR.rotation.x = 0.3;
        m.body.rotation.x = 0.1;
        break;
      }
      case 'item': case 'itemrecover': {
        m.armR.rotation.x = -1.3; m.armL.rotation.x = -1.3;
        const pump = s === 'item' ? Math.sin(this.itemT * 20) * 0.2 : 0;
        m.armL.rotation.z = 0.3 + pump; m.armR.rotation.z = -0.3 - pump;
        m.body.scale.set(1, s === 'itemrecover' ? 0.9 : 1 + Math.sin(this.itemT * 10) * 0.03, 1);
        if (s === 'itemrecover') m.body.position.z = -0.08;
        break;
      }
      case 'hurt': m.body.rotation.x = -0.4; m.head.rotation.x = -0.3; break;
      case 'dead': m.body.rotation.z = Math.min(1.5, this.st * 4); m.body.position.y = 0.1; break;
      case 'hold': m.armR.rotation.x = -3.0; m.armL.rotation.x = -3.0; m.armR.rotation.z = -0.2; m.armL.rotation.z = 0.2; m.head.rotation.x = -0.2; break;
      case 'surge': {
        const k = this.st / 0.7;
        m.body.position.y = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.8;
        m.armR.rotation.x = -3 + k * 2; m.body.rotation.x = k < 0.5 ? -0.3 : 0.4;
        break;
      }
    }
    if (this.pushing) { m.armL.rotation.x = -1.4; m.armR.rotation.x = -1.4; m.body.rotation.x = 0.25; }
    // hurt flicker
    this.m.root.visible = !(this.invuln > 0 && this.state !== 'surge' && Math.floor(this.invuln * 20) % 2 === 0);
  }
}
