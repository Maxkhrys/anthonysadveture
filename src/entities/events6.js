// Pass 6 world events: rare, seeded moments that leave something behind in the world.
//  - FallenStar: a star comes down at night; a glowing crater, stardust and a guardian
//  - RiftTear: the Hush tears through by a road; hold it closed through three waves
//  - GildedBeetle: a treasure creature that runs, shedding pips when struck, then burrows
//  - MothDrift: at dusk, lantern moths migrate across a meadow, leaving glowing dust
//  - Procession: at midnight in Moonfen the dead walk a line; follow them to the end
import * as THREE from 'three';
import { Entity } from './entity.js';
import { Enemy, EXTRA_ENEMIES } from './enemies.js';
import { mesh, B, MAT_GLOW, MAT_GLOW_T } from '../models.js';
import { sfx } from '../engine/audio.js';
import { angleLerp, angDiff } from '../engine/util.js';
import { dropPips } from './common.js';
import { gainMat } from '../rpg/crafting.js';
import { LootChest } from '../rpg/combat.js';

const ev = g => g.world6.events;

// ------------------------------------------------ a fallen star
export class FallenStar extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.key = d.key; this.alwaysUpdate = true; this.t = 0;
    this.crater = mesh([B(2.6, 0.06, 2.6, 0, 0, 0, 0x2a2430), B(1.8, 0.1, 1.8, 0, 0, 0, 0x3a3040)], undefined, false); this.obj.add(this.crater);
    this.stone = mesh([B(0.5, 0.4, 0.5, 0, 0.02, 0, 0xc8e8ff), B(0.3, 0.3, 0.3, 0.1, 0.35, 0.05, 0xffffff)], MAT_GLOW, false); this.obj.add(this.stone);
    this.state = ev(g)[this.key]?.state || 'fallen';
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    const S = ev(g)[this.key] || (ev(g)[this.key] = { state: 'fallen' });
    this.stone.visible = S.state !== 'taken';
    this.stone.position.y = Math.sin(this.t * 2) * 0.05;
    if (S.state !== 'taken' && Math.random() < 0.3) g.fx.add({ x: this.x + (Math.random() - 0.5), y: 0.3, z: this.z + (Math.random() - 0.5), vy: 0.8, g: 0, color: Math.random() < 0.5 ? 0xc8e8ff : 0xfff3c0, life: 1, size: 0.05 });
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (S.state === 'fallen' && d < 12) {
      S.state = 'guarded';
      const e = g.spawnEnemy('wisp', this.x + 1.5, this.z, { noRoom: true, eliteChance: 0 });
      if (e) { g.makeElite(e); e.displayName = 'Starborn ' + e.displayName; e.hp *= 1.5; e.maxHp = e.hp; this.guard = e; }
      g.ui.toast('A fallen star!', 'Something woke up in the crater with it.', 2.4);
    }
    if (S.state === 'guarded' && (!this.guard || this.guard.dead) && d < 1.4) {
      S.state = 'taken'; sfx('fanfare'); g.pr.addFlash(0.2, 0xc8e8ff);
      gainMat(g, 'stardust', 1 + (Math.random() < 0.5 ? 1 : 0), this.x, this.z);
      g.stats.stars = (g.stats.stars || 0) + 1; g.save();
    }
    this.sync();
  }
}

// ------------------------------------------------ a tear in the world where the Hush comes through
export class RiftTear extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.key = d.key; this.alwaysUpdate = true; this.t = 0; this.wave = -1; this.spawned = [];
    this.tear = mesh([B(0.2, 2.2, 0.1, 0, 0.3, 0, 0x2a0a3a, 0, 0, 0.1), B(0.5, 1.4, 0.08, 0, 0.7, 0.01, 0x8b5cf6, 0, 0, 0.1)], MAT_GLOW, false); this.obj.add(this.tear);
    this.scorch = mesh([B(3.4, 0.02, 3.4, 0, 0.01, 0, 0x1a1024)], undefined, false); this.obj.add(this.scorch);
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    const S = ev(g)[this.key] || (ev(g)[this.key] = { state: 'open' });
    this.tear.visible = S.state !== 'closed'; this.scorch.visible = true;
    this.tear.scale.x = 1 + Math.sin(this.t * 6) * 0.2;
    if (S.state === 'closed') return this.sync();
    if (Math.random() < 0.4) g.fx.add({ x: this.x + (Math.random() - 0.5) * 0.6, y: 0.4 + Math.random() * 1.4, z: this.z, vx: (Math.random() - 0.5), vy: 0.3, g: 0, color: Math.random() < 0.5 ? 0x8b5cf6 : 0x2a1a3a, life: 0.8, size: 0.07 });
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    const alive = this.spawned.filter(e => !e.dead);
    if (this.wave < 0 && d < 9) { this.wave = 0; this.spawnWave(); g.ui.banner('HUSH TEAR', 'Hold it closed!', 1.6); g.musicOverride('camp'); }
    else if (this.wave >= 0 && !alive.length) {
      this.wave++;
      if (this.wave >= 3) {
        S.state = 'closed'; sfx('secret'); g.ui.banner('TEAR CLOSED', 'The Hush pulls back.', 1.8); g.musicOverride(null);
        g.spawn(new LootChest(g, { id: 'tear-' + this.key, x: this.x, z: this.z + 1.5, tier: 1, level: g.zoneLevel(this.x, this.z) + 1 }));
        gainMat(g, 'echo', 1, this.x, this.z); g.stats.tears = (g.stats.tears || 0) + 1; g.save();
      } else this.spawnWave();
    }
    if (this.wave >= 0 && d > 30 && S.state !== 'closed') { for (const e of alive) e.remove(); this.spawned = []; this.wave = -1; g.musicOverride(null); }
    this.sync();
  }
  spawnWave() {
    const g = this.g, lvl = g.zoneLevel(this.x, this.z);
    const W = [['blot', 'blot', 'blot', 'wisp'], ['blot', 'wraith', 'blot', 'puffer', 'blot'], [lvl > 8 ? 'knight' : 'beetle', 'wraith', 'blot', 'blot']][this.wave];
    this.spawned = W.map((k, i) => { const a = i / W.length * 6.28; const e = g.spawnEnemy(k, this.x + Math.cos(a) * 2.5, this.z + Math.sin(a) * 2.5, { noRoom: true, aggro: 30, eliteChance: this.wave === 2 && i === 0 ? 1 : 0.05 }); return e; }).filter(Boolean);
  }
}

// ------------------------------------------------ the gilded beetle (a treasure creature)
class GildedBeetle extends Enemy {
  constructor(g, x, z) {
    super(g, x, z, 'gilded');
    const G = 0xe8c060, G2 = 0xc89a3a;
    this.m = { root: new THREE.Group(), body: new THREE.Group(), eyes: null };
    this.m.body.add(mesh([B(0.6, 0.3, 0.7, 0, 0.1, 0, G2), B(0.5, 0.18, 0.6, 0, 0.4, 0, G), B(0.08, 0.1, 0.1, 0.1, 0.3, 0.36, 0x2a1a0a), B(0.08, 0.1, 0.1, -0.1, 0.3, 0.36, 0x2a1a0a), B(0.04, 0.2, 0.04, 0.12, 0.35, 0.4, G2, 0.6), B(0.04, 0.2, 0.04, -0.12, 0.35, 0.4, G2, 0.6)]));
    this.m.body.add(mesh([B(0.2, 0.06, 0.2, 0.1, 0.58, 0, 0xfff3c0)], MAT_GLOW, false));
    this.m.root.add(this.m.body); this.obj.add(this.m.root);
    this.hp = 7; this.speed = 3.6; this.r = 0.3; this.aggro = 9; this.life = 28; this.poise = true;
    this.loot = { pips: 40, chance: 1, heart: 0 }; this.displayName = 'Gilded Beetle';
  }
  onHit(h) { const r = super.onHit(h); if (r === 'hit' && !this.dead) { dropPips(this.g, this.x, this.z, 3 + Math.floor(Math.random() * 4)); sfx('pip'); } return r; }
  think(dt) {
    const g = this.g, p = this.p;
    this.life -= dt;
    if (this.life <= 0) { g.fx.dust(this.x, this.z, 16); sfx('thud'); g.ui.toast('The Gilded Beetle burrowed away.', 'Faster next time.', 2); this.remove(); return [0, 0]; }
    if (Math.random() < 0.08) g.fx.add({ x: this.x, y: 0.1, z: this.z, vy: 0.4, g: 0, color: 0xffd25e, life: 0.8, size: 0.05 });
    const d = this.dist(p);
    if (d < 7) { const a = this.angleTo(p) + Math.PI + Math.sin(g.time * 2) * 0.6; this.facing = angleLerp(this.facing, a, Math.min(1, dt * 6)); return [Math.sin(this.facing) * this.speed, Math.cos(this.facing) * this.speed]; }
    return this.wander(dt);
  }
  animate(dt, sp) { this.obj.rotation.y = this.facing; this.walkT += dt * (6 + sp * 6); this.m.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.04; }
}
EXTRA_ENEMIES.gilded = GildedBeetle;

// ------------------------------------------------ moths migrating at dusk
export class MothDrift extends Entity {
  constructor(g, d) { super(g, d.x, d.z); this.d = d; this.key = d.key; this.alwaysUpdate = true; this.t = 0; this.dust = []; this.done = false; }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    const S = ev(g)[this.key] || (ev(g)[this.key] = { dust: 5 });
    const near = Math.hypot(p.x - this.x, p.z - this.z) < 26;
    if (near && this.t < 40) for (let i = 0; i < 3; i++) g.fx.add({ x: this.x - 14 + (this.t * 0.7 % 28) + (Math.random() - 0.5) * 8, y: 0.8 + Math.random() * 2, z: this.z + (Math.random() - 0.5) * 8, vx: 1.2, vy: Math.random() * 0.2, g: 0, drag: 0, color: Math.random() < 0.6 ? 0xffe08a : 0xc8f0ff, life: 1.8, size: 0.06, wob: 2 });
    if (near && !this.spawned) { this.spawned = true; for (let i = 0; i < 3; i++) g.spawnEnemy('moth', this.x + (Math.random() - 0.5) * 6, this.z + (Math.random() - 0.5) * 4, { noRoom: true, eliteChance: 0 }); g.ui.toast('The moths are migrating…', 'Their dust glows where they pass.', 2.2); }
    // the glowing dust they leave: walk over it to gather Moth Dust
    if (!this.dust.length && S.dust > 0) for (let i = 0; i < S.dust; i++) { const m = mesh([B(0.4, 0.02, 0.4, 0, 0.02, 0, 0xffe08a)], MAT_GLOW_T, false); m.position.set((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 5); this.obj.add(m); this.dust.push(m); }
    for (const m of this.dust) if (m.visible && Math.hypot(p.x - (this.x + m.position.x), p.z - (this.z + m.position.z)) < 0.6) { m.visible = false; S.dust--; gainMat(g, 'moth', 1); }
    this.sync();
  }
}

// ------------------------------------------------ the ghost procession (Moonfen, midnight)
export class Procession extends Entity {
  constructor(g, d) {
    super(g, d.pts[0][0] + 0.5, d.pts[0][1] + 0.5); this.d = d; this.key = d.key; this.alwaysUpdate = true; this.u = 0; this.ghosts = []; this.followed = 0;
    for (let i = 0; i < 5; i++) { const m = mesh([B(0.34, 0.6, 0.3, 0, 0.2, 0, 0xc8e8ff), B(0.26, 0.24, 0.26, 0, 0.8, 0, 0xe8f4ff), B(0.3, 0.06, 0.3, 0, 1.06, 0, 0x7ad8ff)], MAT_GLOW_T, false); this.ghosts.push(m); g.world.add(m); }
  }
  remove() { for (const m of this.ghosts) if (m.parent) m.parent.remove(m); super.remove(); }
  at(u) { const P = this.d.pts, n = P.length - 1, k = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(k), f = k - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * f + 0.5, P[i][1] + (P[i + 1][1] - P[i][1]) * f + 0.5]; }
  update(dt) {
    const g = this.g, p = g.player;
    const S = ev(g)[this.key] || (ev(g)[this.key] = { state: 'walking' });
    if (S.state === 'done') { for (const m of this.ghosts) m.visible = false; return; }
    const lead = this.at(this.u);
    const dp = Math.hypot(p.x - lead[0], p.z - lead[1]);
    // they only walk while someone keeps up
    if (dp < 7) { this.u = Math.min(1, this.u + dt * 0.012); this.followed += dt; if (!this.told) { this.told = true; g.ui.toast('A procession of lights…', 'They walk slowly. Follow them.', 2.6); } }
    this.ghosts.forEach((m, i) => { const [x, z] = this.at(Math.max(0, this.u - i * 0.03)); m.position.set(x, 0.1 + Math.sin(g.time * 3 + i) * 0.05 + g.groundAt(x, z), z); m.visible = true; });
    if (Math.random() < 0.1) { const [x, z] = this.at(this.u); g.fx.add({ x, y: 0.05, z, vy: 0, g: 0, color: 0x7ad8ff, life: 20, size: 0.08, shrink: false }); }
    if (this.u >= 1 && S.state === 'walking') {
      S.state = 'done'; const [x, z] = this.at(1);
      sfx('secret'); g.ui.toast('The lights sink into the fen.', 'Where they stopped, something was left for you.', 3);
      g.spawn(new LootChest(g, { id: 'procession-' + this.key, x, z, tier: 2, level: g.zoneLevel(x, z) + 1 }));
      gainMat(g, 'echo', 1, x, z); g.stats.processions = (g.stats.processions || 0) + 1; g.save();
    }
  }
}
