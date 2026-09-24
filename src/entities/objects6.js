// Pass 6 world objects: viewpoints, root tangles, clues, the moon-lily path, night-only doors,
// the ferry, and the seeded optional content (camps, rare elites, caches, cave mouths, the
// pedlar). Anything that must survive a reload keeps its state in g.world6.events or g.flags.
import * as THREE from 'three';
import { Entity } from './entity.js';
import { mesh, B, MAT_GLOW, MAT_GLOW_T, PROPS, makeFolk } from '../models.js';
import { sfx, playTone } from '../engine/audio.js';
import { T } from '../world/tiles.js';
import { dropPips } from './common.js';
import { angleLerp } from '../engine/util.js';
import { gainMat } from '../rpg/crafting.js';

const dayOf = g => g.worldDay ? g.worldDay() : 0;
const ev = g => (g.world6 && g.world6.events) || {};

// ------------------------------------------------ viewpoints
// Stand here and the camera pulls back over the land; the first time, what you can see gets
// written onto your map.
export class Vista extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.rad = d.r || 2.2; this.t = 0;
    this.obj.add(mesh([B(0.5, 0.35, 0.5, 0, 0, 0, 0x8a8a92), B(0.08, 0.5, 0.08, 0, 0.35, 0, 0x5a4a3a), B(0.1, 0.1, 0.46, 0, 0.85, 0.05, 0xc89a3a, -0.3), B(0.14, 0.14, 0.06, 0, 0.92, 0.28, 0x3a3a3a, -0.3)]));
  }
  update(dt) {
    const g = this.g, p = g.player;
    const inside = Math.hypot(p.x - this.x, p.z - this.z) < this.rad && !(p.combatT > 0) && !g.bossActive;
    if (inside) { g.vistaWant = this.d.zoom || 2; g.vistaT = 0.3; }
    if (inside && !g.flags['vista:' + this.d.id]) {
      g.flags['vista:' + this.d.id] = true;
      sfx('secret'); g.ui.toast('Vista: ' + this.d.name, 'Your map fills in with everything you can see from here.', 3);
      if (g.revealAround) g.revealAround(this.x, this.z, 34, true);
      g.stats.vistas = (g.stats.vistas || 0) + 1;
    }
    this.sync();
  }
}

// ------------------------------------------------ root tangles (secret paths)
// A knot of roots across a gap. Light blows bounce off; a heavy blow, fire or a strong gale
// tears it open for good.
export class Tangle extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z);
    this.key = 'tangle:' + d.x + ',' + d.z; this.solid = true; this.hw = 0.5; this.hd = 0.5;
    const R = 0x5a3e28, R2 = 0x6a4a30;
    this.obj.add(mesh([B(0.2, 1.3, 0.2, -0.35, 0, 0, R, 0, 0, 0.3), B(0.2, 1.3, 0.2, 0.35, 0, 0, R2, 0, 0, -0.3), B(1.0, 0.18, 0.2, 0, 0.5, 0, R, 0, 0, 0.4), B(1.0, 0.18, 0.2, 0, 0.9, 0, R2, 0, 0, -0.4), B(0.4, 0.3, 0.3, 0, 1.1, 0, 0x3f8a3a), B(0.3, 0.2, 0.25, 0.3, 0.2, 0.05, 0x4f9a3a)]));
    if (g.flags[this.key]) { this.solid = false; this.obj.visible = false; this.cleared = true; }
  }
  tear() {
    if (this.cleared) return;
    const g = this.g; this.cleared = true; this.solid = false; this.obj.visible = false; g.flags[this.key] = true;
    sfx('snap'); g.fx.burst(this.x, 0.6, this.z, 22, [0x5a3e28, 0x3f8a3a, 0xc8a870], 3);
    g.ui.toast('The roots give way.', 'A path you never noticed.', 2.2);
  }
  onHit(h) {
    const heavy = h.heavy || h.kind === 'spin' || h.kind === 'spin3' || h.kind === 'surge' || h.kind === 'quake' || h.element === 'fire' || h.kind === 'fireball' || h.kind === 'blast';
    if (heavy) this.tear();
    else { sfx('clang'); if (!this.hinted) { this.hinted = true; this.g.ui.toast('Tough old roots.', 'A heavier blow — or fire — might tear them.', 2); } }
    return 'hit';
  }
  onGust(power) { if (power > 0.8) this.tear(); }
  update() {}
}

// ------------------------------------------------ clues: things that are slightly wrong
export class Clue extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.kind = d.kind; this.t = Math.random() * 5;
    if (d.kind === 'toadstools') for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, m = mesh(PROPS.toadstools()); m.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55); m.scale.setScalar(0.8); m.traverse(o => { if (o.material) o.material = MAT_GLOW; }); this.obj.add(m); }
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    if (this.kind === 'hum') {
      // a low note from under the ground, and a ring of dust that only shows up close
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d < 9 && (this.nx = (this.nx ?? 0) - dt) <= 0) { this.nx = 3.2; if (d < 6) playTone(45); g.fx.ring(this.x, this.z, 0.2, 1.1, 0xbfe6e0, 0.9, 0.05); }
    }
    this.sync();
  }
}

// ------------------------------------------------ the moon-lily path (a night secret)
// At night glowing lilies open across the Black Mere and hold your weight; by day they close.
export class MoonPath extends Entity {
  constructor(g, d) {
    super(g, (d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2); this.d = d; this.alwaysUpdate = true; this.open = false;
    this.cells = [];
    const n = Math.ceil(Math.hypot(d.x1 - d.x0, d.z1 - d.z0) * 1.5);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(d.x0 + (d.x1 - d.x0) * i / n), z = Math.round(d.z0 + (d.z1 - d.z0) * i / n);
      for (const [ox, oz] of [[0, 0], [1, 0]]) { const tx = x + ox, tz = z + oz; if (!this.cells.some(c => c[0] === tx && c[1] === tz)) this.cells.push([tx, tz, g.tileAt(tx, tz)]); }
    }
    this.pads = new THREE.Group(); this.obj.add(this.pads); this.obj.position.set(0, 0, 0);
    for (const [x, z] of this.cells) { const m = mesh(PROPS.moonlily(), MAT_GLOW, false); m.position.set(x + 0.5, 0.07, z + 0.5); m.scale.setScalar(2.2); m.rotation.y = (x * 7 + z) % 6; this.pads.add(m); }
    this.pads.visible = false;
  }
  sync() { this.obj.position.set(0, 0, 0); }
  set(open) {
    const g = this.g;
    this.open = open; this.pads.visible = open;
    for (const [x, z, t] of this.cells) if (t === T.WATER || t === T.DEEP) g.setTile(x, z, open ? T.SHALLOW : t);
    if (open) { const first = !g.flags.moonpathSeen; g.flags.moonpathSeen = true; if (first && Math.hypot(g.player.x - this.x, g.player.z - this.z) < 26) g.ui.toast('Lilies open on the Black Mere…', 'They glow like little moons. They look strong enough to stand on.', 3); }
  }
  update(dt) {
    const g = this.g, p = g.player;
    const want = !!g.isNight;
    if (want === this.open) return;
    // never pull the lilies out from under your feet
    if (!want && this.cells.some(([x, z]) => Math.floor(p.x) === x && Math.floor(p.z) === z)) return;
    this.set(want);
  }
}

// ------------------------------------------------ doors that only open by moonlight
export class NightDoor extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.cool = 0.6; this.interactable = true;
    this.door = mesh([B(1.0, 1.3, 0.2, 0, 0, 0, 0x5a6a7a), B(0.2, 0.2, 0.22, 0, 1.0, 0, 0x9ad8ff)]); this.obj.add(this.door);
    this.glow = mesh([B(0.9, 1.2, 0.05, 0, 0.02, 0.12, 0x5ac8ff)], MAT_GLOW_T, false); this.obj.add(this.glow);
  }
  get prompt() { return this.g.isNight ? null : 'Try the door'; }
  interact() { sfx('clang'); this.g.ui.toast('The door is sealed while the sun can see it.', 'Come back at night.', 2.4); }
  update(dt) {
    const g = this.g, p = g.player, night = !!g.isNight;
    this.door.visible = !night; this.glow.visible = night; this.interactable = !night;
    this.cool -= dt;
    if (night && this.cool <= 0 && !g.transitioning && Math.hypot(p.x - this.x, p.z - this.z) < 0.6) g.warpTo(this.d.to, this.d.spawn);
    this.sync();
  }
}

// ------------------------------------------------ the ferry between Ada's pier and the Landing
export class Ferry extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.interactable = true; this.solid = true; this.hw = 0.5; this.hd = 0.4; this.t = Math.random() * 6;
    this.boat = mesh([B(1.6, 0.25, 0.8, 0, -0.05, 0, 0x7a5a3a), B(1.4, 0.3, 0.12, 0, 0.1, 0.36, 0x8a6a4a), B(1.4, 0.3, 0.12, 0, 0.1, -0.36, 0x8a6a4a), B(0.06, 1.2, 0.06, 0.2, 0.2, 0, 0x6a4a2a), B(0.6, 0.6, 0.03, 0.4, 0.6, 0, 0xe8dcc0), B(0.3, 0.2, 0.3, -0.5, 0.2, 0, 0xc0503a)]);
    this.obj.add(this.boat);
  }
  get prompt() { return 'Ferry to ' + this.d.label; }
  interact() {
    const g = this.g;
    g.ui.ask('The ferry', `A flat little boat, a rope, and a pulley someone greases every morning. Cross to ${this.d.label}?`, [
      { label: 'Cross (free)', cb: () => { sfx('select'); g.flags['ferried'] = true; g.warpTo('overworld', this.d.to === 'landing' ? 'landingdock' : 'pierdock', () => g.ui.toast('The ferry bumps against the jetty.', this.d.label, 2)); } },
      { label: 'Stay', cb: () => {} },
    ]);
  }
  update(dt) { this.t += dt; this.boat.position.y = Math.sin(this.t * 1.6) * 0.04; this.boat.rotation.z = Math.sin(this.t * 1.1) * 0.04; this.sync(); }
}

// ------------------------------------------------ seeded roadside camps
// Tents, a fire and a banner. Walk close and the camp's fighters come out; break them and the
// camp burns down to a black ring until the next day, when someone else moves in.
export class Camp extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.t = 0; this.alwaysUpdate = false;
    const col = { brigand: 0x8a4a3a, imp: 0x5a2a2a, knight: 0x3a3a5a, wraith: 0x3a4a5a, porcelain: 0xd8d4cc }[d.kinds[0]] || 0x6a3a60;
    this.tents = new THREE.Group(); this.obj.add(this.tents);
    for (const [ox, oz, r] of [[-1.6, -1.2, 0.4], [1.7, -1.0, -0.3], [0.2, 1.8, 3.2]]) { const m = mesh([B(1.2, 0.5, 1.2, 0, 0, 0, col), B(0.9, 0.35, 1.0, 0, 0.5, 0, col), B(0.4, 0.3, 0.9, 0, 0.85, 0, 0x4a3a3a), B(0.3, 0.4, 0.05, 0, 0, 0.62, 0x1a0a0a)]); m.position.set(ox, 0, oz); m.rotation.y = r; this.tents.add(m); }
    this.obj.add(mesh([B(0.6, 0.12, 0.6, 0, 0, 0, 0x3a3a3a), B(0.12, 1.6, 0.12, 1.2, 0, 1.0, 0x5a3a2a), B(0.5, 0.4, 0.04, 1.45, 1.15, 1.0, col)]));
    this.fire = mesh([B(0.3, 0.3, 0.3, 0, 0.12, 0, 0xff8a2a), B(0.16, 0.2, 0.16, 0, 0.35, 0, 0xffd25e)], MAT_GLOW, false); this.obj.add(this.fire);
    this.burnt = mesh([B(3.6, 0.02, 3.2, 0, 0.01, 0, 0x2a2224)], undefined, false); this.obj.add(this.burnt);
    this.spawned = [];
  }
  get cleared() { return ev(this.g)['camp:' + this.d.id] === dayOf(this.g); }
  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    const cleared = this.cleared;
    this.tents.visible = !cleared; this.fire.visible = !cleared; this.burnt.visible = cleared;
    if (!cleared) { this.fire.scale.y = 0.8 + Math.sin(this.t * 12) * 0.2; if (Math.random() < 0.2) g.fx.add({ x: this.x, y: 0.5, z: this.z, vy: 0.9, g: 0, color: 0xffa04a, life: 0.6, size: 0.05 }); }
    if (cleared) return this.sync();
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (!this.spawned.length && d < 11) {
      this.d.kinds.forEach((k, i) => { const a = i / this.d.kinds.length * 6.28; const e = g.spawnEnemy(k, this.x + Math.cos(a) * 2.2, this.z + Math.sin(a) * 2.2, { noRoom: true, eliteChance: i === 0 && this.d.elite ? 1 : 0.04 }); if (e) { e.campOf = this; this.spawned.push(e); } });
      g.ui.toast(this.d.title || 'A camp!', 'They\'ve seen you.', 1.6);
    }
    if (this.spawned.length && this.spawned.every(e => e.dead)) {
      ev(g)['camp:' + this.d.id] = dayOf(g); this.spawned = [];
      sfx('secret'); g.ui.banner('CAMP BROKEN', 'The fire gutters out.', 1.6);
      dropPips(g, this.x, this.z, 20 + Math.floor(Math.random() * 30));
      g.dropGear(this.x, this.z + 0.6, { level: g.zoneLevel(this.x, this.z) + 1, floor: 1, bonus: 0.4 });
      g.stats.campsBroken = (g.stats.campsBroken || 0) + 1;
      g.save();
    }
    // if you run off, the camp calls its people home
    if (this.spawned.length && d > 40) { for (const e of this.spawned) if (!e.dead) e.remove(); this.spawned = []; }
    this.sync();
  }
}

// ------------------------------------------------ seeded rare elites (local legends)
export class RareSpawn extends Entity {
  constructor(g, d) { super(g, d.x, d.z); this.d = d; this.e = null; }
  get down() { const k = ev(this.g)['rare:' + this.d.id]; return k !== undefined && dayOf(this.g) - k < 3; }
  update() {
    const g = this.g, p = g.player;
    if (this.e) { if (this.e.dead) { ev(g)['rare:' + this.d.id] = dayOf(g); this.e = null; g.stats.rares = (g.stats.rares || 0) + 1; g.save(); } return; }
    if (this.down || (this.d.night && !g.isNight)) return;
    if (Math.hypot(p.x - this.x, p.z - this.z) > 22) return;
    const e = g.spawnEnemy(this.d.kind, this.x, this.z, { noRoom: true, eliteChance: 0 });
    if (!e) return;
    g.makeElite(e); e.hp *= 1.6; e.maxHp = e.hp; e.xpValue *= 2; e.rare = this.d;
    e.displayName = this.d.name + (e.elite ? ' (' + e.elite + ')' : '');
    e.obj.scale.setScalar(1.5); e.eliteScale = 1.5;
    this.e = e;
    if (!g.flags['rareseen:' + this.d.id]) { g.flags['rareseen:' + this.d.id] = true; g.ui.toast(this.d.name, this.d.night ? 'It only walks by night.' : 'A local legend. It hits like one.', 2.6); }
  }
}

// ------------------------------------------------ hidden caches of materials
export class Pocket extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.solid = true; this.hw = 0.3; this.hd = 0.3;
    this.obj.add(mesh([B(0.5, 0.35, 0.45, 0, 0, 0, 0x8a7a68), B(0.3, 0.2, 0.3, 0.05, 0.35, 0, 0x9a8a78), B(0.06, 0.3, 0.03, 0.08, 0.05, 0.23, 0x3a2a1a, 0, 0, 0.5), B(0.12, 0.08, 0.1, -0.12, 0.35, 0.12, 0x5a9a3a)]));
    if (ev(g)['pocket:' + d.id]) this.remove();
  }
  onHit() {
    const g = this.g; if (this.dead) return 'hit';
    ev(g)['pocket:' + this.d.id] = true;
    sfx('crate'); g.fx.burst(this.x, 0.4, this.z, 14, [0x8a7a68, 0xc8b898], 2.5);
    gainMat(g, this.d.mat, this.d.n, this.x, this.z);
    g.ui.toast('A hidden cache!', 'Someone hid this here and never came back.', 2);
    g.stats.caches = (g.stats.caches || 0) + 1;
    this.remove(); g.save();
    return 'hit';
  }
  update() {}
}

// ------------------------------------------------ cave mouths (mini-dungeons whose place varies)
export class CaveMouth extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.solid = true; this.hw = 0.9; this.hd = 0.4;
    const c = d.look === 'teapot' ? [0xf2eee6, 0x4a6ab0] : [0x5a5048, 0x3a3230];
    if (d.look === 'teapot') this.obj.add(mesh([B(2.4, 1.4, 2.0, 0, -0.2, -0.6, c[0]), B(2.0, 0.3, 1.6, 0, 1.2, -0.6, 0xe0dcd4), B(0.5, 0.4, 0.5, 0, 1.5, -0.6, c[0]), B(0.8, 0.9, 0.1, 0, 0, 0.42, 0x1a1208), B(1.8, 0.2, 0.05, 0, 0.6, 0.41, c[1])]));
    else this.obj.add(mesh([B(2.2, 1.2, 1.4, 0, 0, -0.4, c[0]), B(1.6, 0.6, 1.0, 0.1, 1.2, -0.5, c[1]), B(0.9, 0.9, 0.1, 0, 0, 0.32, 0x0c0808), B(0.4, 0.3, 0.4, 0.8, 1.1, 0, 0x4f7a3a)]));
    this.cool = 0.8;
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.cool -= dt;
    if (this.cool <= 0 && !g.transitioning && Math.hypot(p.x - this.x, p.z - (this.z + 0.55)) < 0.5) g.warpTo(this.d.to, 'entrance');
    this.sync();
  }
}

// ------------------------------------------------ the travelling pedlar
export class Pedlar extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.interactable = true; this.solid = true; this.hw = 0.3; this.hd = 0.3; this.id = 'pedlar'; this.name = 'Pip the Pedlar';
    this.m = makeFolk('shop'); this.obj.add(this.m.root);
    this.cart = mesh([B(1.4, 0.3, 0.9, 1.2, 0.3, 0, 0x8a6a4a), B(1.3, 0.6, 0.8, 1.2, 0.6, 0, 0xc0503a), B(0.5, 0.5, 0.1, 0.8, 0, 0.46, 0x5a4a3a), B(0.5, 0.5, 0.1, 1.6, 0, 0.46, 0x5a4a3a), B(0.3, 0.2, 0.3, -0.8, 0, 0.6, 0x3a3a3a)]);
    this.obj.add(this.cart);
    this.fire = mesh([B(0.2, 0.2, 0.2, -0.8, 0.12, 0.6, 0xff8a2a)], MAT_GLOW, false); this.obj.add(this.fire); this.t = 0;
  }
  get prompt() { return 'Talk to the pedlar'; }
  interact() { this.g.story.pedlar ? this.g.story.pedlar(this) : null; }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    if (Math.hypot(p.x - this.x, p.z - this.z) < 3) this.facing = angleLerp(this.facing, this.angleTo(p), dt * 5);
    this.m.root.rotation.y = this.facing; this.fire.scale.y = 0.8 + Math.sin(this.t * 11) * 0.25;
    this.m.body.position.y = Math.sin(this.t * 2) * 0.01;
    this.sync();
  }
}
