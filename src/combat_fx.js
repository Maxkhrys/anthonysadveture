// Combat presentation: elemental effects, material hit responses and one terminal death effect.
//
// Everything here LISTENS to real gameplay: the combat event bus (windup, release, impact,
// spell cast), the enemy's own hit / status / death methods, and the chain-lightning bolt that
// is only drawn between targets the gameplay actually hit. Nothing here changes timings,
// damage, loot, kills or XP; each wrapper calls the original first and only adds visuals and
// sound afterwards.
//
// Settings (settings.js): Combat effects Minimal / Normal / High scales how much is drawn;
// Blood Off / Reduced / Full gates blood only (other material feedback and every gameplay
// warning stays). Screen shake and hit flash keep their existing settings.
//
// Budgets: particles go through the shared pool (fx.js, fixed size); bolts, decals and lights
// use small fixed pools here; sounds go through the audio voice limit.
import * as THREE from 'three';
import { sfx } from './engine/audio.js';
import { combatEvents } from './rpg/combat_events.js';
import { elementOf } from './rpg/elements.js';
import { Enemy } from './entities/enemies.js';

// ------------------------------------------------------------------ enemy materials
export const MATERIAL = {
  brigand: 'flesh', thief: 'flesh', scorpion: 'insect', beetle: 'insect', mantis: 'insect', moth: 'insect', slug: 'insect', leech: 'insect',
  seedling: 'plant', sporeling: 'plant', treant: 'plant', puffer: 'plant',
  golem: 'construct', porcelain: 'construct', knight: 'construct',
  wisp: 'spectral', wraith: 'spectral', imp: 'spectral', blot: 'ink',
};
export const materialOf = e => (e && (e.material || MATERIAL[e.kind])) || 'flesh';
const MAT_FX = {
  flesh: { c: [0xb8323a, 0x8a1e2a], blood: true, sound: 'hitflesh' },
  insect: { c: [0x4a5a2a, 0x2a3a1a, 0xd8c890], blood: true, shell: [0x8a3a2a, 0xe8d0a0], sound: 'hitshell' }, // darker fluid + shell bits
  plant: { c: [0x7fd36a, 0x4a8a3a, 0xc8e08a], sap: [0xd8e060, 0xa8c040], sound: 'hitplant' },
  construct: { c: [0xb0b0c0, 0x7a7a8a, 0xfff3b0], sparks: true, sound: 'hitstone' },
  spectral: { c: [0x9ad8ff, 0xc8b0ff, 0xe8fffb], soft: true, sound: 'hitspirit' },
  ink: { c: [0x2a1a3a, 0x3e2856, 0x6a48a0], soft: true, sound: 'hitflesh' },
};
// element colours used by casts, trails and impacts
export const EL = {
  fire: { c: [0xff8a2a, 0xffd25e, 0xff5a2a], cast: 'castfire', hit: 'hitfire' },
  frost: { c: [0xbfe8ff, 0xe8f8ff, 0x7ab8ff], cast: 'castfrost', hit: 'hitfrost' },
  glass: { c: [0xbfe8ff, 0xffffff], cast: 'castfrost', hit: 'hitfrost' },
  lightning: { c: [0xfff3b0, 0xdff4ff, 0x9ad8ff], cast: 'castlightning', hit: 'hitlightning' },
  poison: { c: [0x8ad84a, 0x5aa83a, 0xc8f07a], cast: null, hit: 'hitplant' },
  thorn: { c: [0x7fd36a, 0x3a6a2a], cast: null, hit: 'hitplant' },
  hex: { c: [0xb88aff, 0x8b5cf6, 0xe0c8ff], cast: 'casthex', hit: 'hithex' },
  arcane: { c: [0xc8b0ff, 0xfff3b0], cast: 'casthex', hit: 'hithex' },
  spirit: { c: [0x8fe3dc, 0xc8b0ff, 0xe8fffb], cast: null, hit: 'hitspirit' },
  wind: { c: [0xeaf6ff, 0xb8e0ff], cast: null, hit: null },
  water: { c: [0x6ab8ff, 0xe8f8ff], cast: null, hit: null },
};
const LEVEL = { minimal: 0.35, normal: 1, high: 1.6 };

export class CombatFx {
  constructor(g) {
    this.g = g; this.bolts = []; this.decals = []; this.lights = []; this.hexMarks = new Map(); this.deaths = 0; this.stats = { bolts: 0, deaths: {}, blood: 0 };
    const ev = combatEvents(g);
    ev.on('attack.windup', d => this.windup(d));
    ev.on('spell.cast', d => this.cast(d));
    ev.on('attack.release', d => { if (!d.attack?.spell) this.release(d); });
    ev.on('attack.impact', d => this.impact(d));
    ev.on('spell.impact', d => this.impact(d));
    // a pool of three short-lived local lights (never one per projectile)
    for (let i = 0; i < 3; i++) { const L = new THREE.PointLight(0xffffff, 0, 5, 2); L.visible = false; g.scene.add(L); this.lights.push({ L, t: 0 }); }
  }
  get k() { return LEVEL[this.g.settings?.combatFx] ?? 1; }
  get blood() { return this.g.settings?.blood || 'full'; }
  n(base) { return Math.max(1, Math.round(base * this.k)); }
  flash(x, z, color, t = 0.12, i = 2.2) {
    if (this.k < 0.5) return;
    const s = this.lights.reduce((a, b) => (a.t < b.t ? a : b));
    s.L.color.setHex(color); s.L.position.set(x, 1, z); s.L.intensity = i; s.L.visible = true; s.t = t; s.max = t; s.i = i;
  }

  // ---------------------------------------------------------------- attack phases
  windup(d) {
    const p = d.p, el = d.attack?.element || d.weapon && null; if (!p || !d.attack?.spell && !d.attack?.charge) return;
    const E = EL[el] || EL[p.g.pstats?.arpg?.element] || null; if (!E) return;
    for (let i = 0; i < this.n(4); i++) this.g.fx.add({ x: p.x + Math.sin(p.facing) * 0.35, y: 0.9, z: p.z + Math.cos(p.facing) * 0.35, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, vy: 0.6, g: 0, color: E.c[i % E.c.length], life: 0.35, size: 0.05 });
  }
  cast(d) {
    const p = d.p, E = EL[d.element]; if (!p || !E) return;
    if (E.cast) sfx(E.cast);
    const x = p.x + Math.sin(p.facing) * 0.5, z = p.z + Math.cos(p.facing) * 0.5;
    this.g.fx.burst(x, 0.8, z, this.n(6), E.c, 1.6, { life: 0.3, size: 0.05, g: 0, up: 0.2, upv: 0.6 });
  }
  release(d) {
    const p = d.p; if (!p) return; const el = d.attack?.element; const E = EL[el]; if (!E) return;
    const x = p.x + Math.sin(p.facing) * 0.6, z = p.z + Math.cos(p.facing) * 0.6;
    this.g.fx.burst(x, 0.6, z, this.n(5), E.c, 2, { life: 0.3, size: 0.05 });
  }
  // the resolved element of the hit is authoritative (never the weapon's name)
  impact(d) {
    const e = d.target; if (!e) return; const E = EL[d.element];
    if (!E) return;
    const g = this.g, x = d.x ?? e.x, z = d.z ?? e.z;
    if (E.hit) sfx(E.hit);
    if (d.element === 'fire') { g.fx.burst(x, 0.5, z, this.n(10), E.c, 3, { life: 0.4, size: 0.07 }); this.smoke(x, z, this.n(3)); if (this.k >= 1) g.fx.ring(x, z, 0.1, 0.9, 0xffb347, 0.3); this.flash(x, z, 0xff8a2a, 0.1, 1.6); }
    else if (d.element === 'frost' || d.element === 'glass') { g.fx.burst(x, 0.5, z, this.n(8), E.c, 2.2, { life: 0.45, size: 0.06, g: 4 }); this.mist(x, z, this.n(3)); }
    else if (d.element === 'lightning') { g.fx.burst(x, 0.5, z, this.n(6), E.c, 4, { life: 0.2, size: 0.05, g: 8 }); this.flash(x, z, 0xdff4ff, 0.08, 2.4); }
    else if (d.element === 'hex' || d.element === 'arcane') { g.fx.burst(x, 0.8, z, this.n(6), E.c, 1.4, { life: 0.5, size: 0.06, g: -1 }); }
    else if (d.element === 'spirit') { this.afterimage(e, 0x8fe3dc); g.fx.burst(x, 0.6, z, this.n(5), E.c, 1.8, { life: 0.4, size: 0.05, g: -1 }); }
    else if (d.element === 'poison' || d.element === 'thorn') { for (let i = 0; i < this.n(6); i++) g.fx.add({ x, y: 0.5, z, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 1.5, color: E.c[i % E.c.length], life: 0.5, size: 0.05, g: 8 }); }
  }
  smoke(x, z, n) { for (let i = 0; i < n; i++) this.g.fx.add({ x: x + (Math.random() - 0.5) * 0.4, y: 0.4, z: z + (Math.random() - 0.5) * 0.4, vy: 0.8, vx: (Math.random() - 0.5) * 0.4, g: 0, drag: 0.8, color: 0x4a4048, life: 0.9, size: 0.14, grow: 1.4, shrink: false, soft: true }); }
  mist(x, z, n) { for (let i = 0; i < n; i++) this.g.fx.add({ x: x + (Math.random() - 0.5) * 0.5, y: 0.3, z: z + (Math.random() - 0.5) * 0.5, vy: 0.2, g: 0, drag: 1, color: 0xdff4ff, life: 0.8, size: 0.16, grow: 1.2, shrink: false, soft: true }); }
  afterimage(e, color) { if (this.k < 0.5 || !e.obj) return; for (let i = 0; i < 4; i++) this.g.fx.add({ x: e.x + (Math.random() - 0.5) * 0.3, y: 0.4 + Math.random() * 0.4, z: e.z + (Math.random() - 0.5) * 0.3, vy: 0.3, g: 0, color, life: 0.4, size: 0.12, soft: true, shrink: true }); }

  // ---------------------------------------------------------------- lightning bolts (real hits only)
  // Called by combat.js bolt(), which gameplay only calls between a source and a target it hit.
  bolt(x0, z0, x1, z1) {
    const g = this.g; this.stats.bolts++;
    if (this.bolts.length >= 12) { const old = this.bolts.shift(); g.scene.remove(old.m); old.m.geometry.dispose(); }
    const pts = [], n = Math.max(3, Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2.2)), y0 = 0.55 + (g.tileGround ? g.tileGround(Math.floor(x0), Math.floor(z0)) : 0);
    for (let i = 0; i <= n; i++) { const k = i / n, j = i === 0 || i === n ? 0 : 0.28; pts.push(new THREE.Vector3(x0 + (x1 - x0) * k + (Math.random() - 0.5) * j, y0 + (Math.random() - 0.5) * j * 0.8, z0 + (z1 - z0) * k + (Math.random() - 0.5) * j)); }
    // one brief branch off the middle
    if (this.k >= 1 && n > 3) { const m = pts[n >> 1], a = Math.random() * 6.28; pts.push(m.clone(), new THREE.Vector3(m.x + Math.cos(a) * 0.5, m.y + 0.1, m.z + Math.sin(a) * 0.5)); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts.slice(0, n + 1));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 1, depthWrite: false }));
    if (pts.length > n + 1) { const bg = new THREE.BufferGeometry().setFromPoints(pts.slice(n + 1)); line.add(new THREE.Line(bg, line.material)); }
    g.scene.add(line); this.bolts.push({ m: line, t: 0.14 });
    this.flash(x1, z1, 0xbfe8ff, 0.08, 2);
    for (let i = 0; i < this.n(3); i++) g.fx.add({ x: x1, y: 0.5, z: z1, vx: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, vy: 2, color: 0xfff3b0, life: 0.18, size: 0.04, g: 10 });
  }

  // ---------------------------------------------------------------- material hits
  onEnemyHit(e, h) {
    if (!h || h.secondary && !h.crit) return; // small proc ticks stay quiet
    const g = this.g, m = materialOf(e), M = MAT_FX[m], big = h.heavy || h.crit, dir = h.dir || 0;
    const n = this.n(big ? 7 : 3), x = e.x, z = e.z;
    if (M.blood) {
      if (this.blood !== 'off') {
        const bn = this.blood === 'reduced' ? Math.ceil(n / 2) : n; this.stats.blood += bn;
        for (let i = 0; i < bn; i++) { const a = dir + (Math.random() - 0.5) * 1.1, s = 2 + Math.random() * (big ? 3.5 : 2); g.fx.add({ x, y: 0.45, z, vx: Math.sin(a) * s, vz: Math.cos(a) * s, vy: 1 + Math.random() * 2, color: M.c[i % M.c.length], life: 0.45, size: 0.05, g: 12, floor: 0.02 }); }
        if (big && this.blood === 'full') this.decal(x + Math.sin(dir) * 0.5, z + Math.cos(dir) * 0.5, M.c[1], 0.32);
      }
      if (M.shell && big) for (let i = 0; i < Math.ceil(n / 2); i++) g.fx.add({ x, y: 0.4, z, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vy: 2.5, color: M.shell[i % 2], life: 0.6, size: 0.06, g: 12 });
    } else if (M.sap) { for (let i = 0; i < n; i++) { const a = dir + (Math.random() - 0.5) * 1.2; g.fx.add({ x, y: 0.45, z, vx: Math.sin(a) * 2.5, vz: Math.cos(a) * 2.5, vy: 1.8, color: i % 3 ? M.c[i % M.c.length] : M.sap[0], life: 0.55, size: 0.06, g: 7, wob: 1 }); } }
    else if (M.sparks) { g.fx.sparks(x, 0.45, z, dir, n, 0xfff3b0); for (let i = 0; i < Math.ceil(n / 2); i++) g.fx.add({ x, y: 0.45, z, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vy: 2, color: M.c[i % 2], life: 0.5, size: 0.06, g: 12 }); }
    else { for (let i = 0; i < n; i++) g.fx.add({ x, y: 0.5, z, vx: (Math.random() - 0.5) * 1.5, vz: (Math.random() - 0.5) * 1.5, vy: 0.6, g: -0.5, color: M.c[i % M.c.length], life: 0.6, size: 0.08, soft: !!M.soft }); }
    if (M.sound && !h.secondary) sfx(M.sound);
  }
  decal(x, z, color, r) {
    if (this.k < 0.5) return;
    const g = this.g, geo = CombatFx.decalGeo || (CombatFx.decalGeo = new THREE.CircleGeometry(1, 10));
    let d = this.decals.length >= 24 ? this.decals.shift() : null;
    if (!d) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })); m.rotation.x = -Math.PI / 2; d = { m }; }
    d.m.material.color.setHex(color); d.m.material.opacity = 0.55; d.m.scale.setScalar(r * (0.8 + Math.random() * 0.5)); d.m.position.set(x, 0.02 + (g.tileGround ? g.tileGround(Math.floor(x), Math.floor(z)) : 0), z); d.t = 6; d.max = 6;
    if (!d.m.parent) g.scene.add(d.m); this.decals.push(d);
  }

  // ---------------------------------------------------------------- one terminal death
  // Chooses a single presentation from the fatal hit and the statuses at the moment of death.
  deathKind(e, h) {
    const S = e.status || {}, el = e._lastEl || (h && elementOf(h)) || '', kind = h?.kind || e._lastKind || '';
    if (S.freeze > 0) return 'shatter';
    if (['blast', 'explode', 'fireball', 'comet', 'surge', 'powder', 'satchel', 'grenade'].includes(kind) || e._lastBlast) return 'explode';
    if (el === 'lightning' || kind === 'shock') return 'electric';
    if (el === 'fire' || S.burn > 0) return 'char';
    if (el === 'spirit' || el === 'echo' || kind === 'lash' || kind === 'echo') return 'soul';
    return 'material';
  }
  onEnemyDeath(e, h, how) {
    if (e._fxDead || how) return; e._fxDead = true; // one presentation per death, and none for falls/splashes (their own effect)
    const g = this.g, x = e.x, z = e.z, m = materialOf(e), M = MAT_FX[m], kind = this.deathKind(e, h);
    this.stats.deaths[kind] = (this.stats.deaths[kind] || 0) + 1; this.deaths++;
    const n = this.n(e.elite || e.isBoss ? 16 : 10);
    switch (kind) {
      case 'shatter': sfx('dieshatter'); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 3; g.fx.add({ x, y: 0.4, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 2 + Math.random() * 3, color: [0xdff4ff, 0xaee8ff, 0xffffff][i % 3], life: 0.8, size: 0.09, g: 12, stretch: 0.5 }); } this.mist(x, z, this.n(4)); break;
      case 'explode': sfx('explode'); for (let i = 0; i < Math.min(n, 12); i++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 3; g.fx.add({ x, y: 0.4, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 3 + Math.random() * 2, color: M.c[i % M.c.length], life: 0.9, size: 0.1, g: 12, drag: 0.6 }); } this.smoke(x, z, this.n(5)); this.flash(x, z, 0xffb347, 0.15, 2.4); if (M.blood && this.blood === 'full') this.decal(x, z, M.c[1], 0.5); break;
      case 'electric': sfx('hitlightning'); this.flash(x, z, 0xdff4ff, 0.12, 3); g.fx.burst(x, 0.5, z, n, [0xfff3b0, 0xdff4ff], 3.5, { life: 0.25, size: 0.05, g: 8 }); this.smoke(x, z, this.n(3)); break;
      case 'char': this.smoke(x, z, this.n(6)); for (let i = 0; i < n; i++) g.fx.add({ x: x + (Math.random() - 0.5) * 0.5, y: 0.3, z: z + (Math.random() - 0.5) * 0.5, vy: 1.4 + Math.random(), g: -0.5, color: i % 2 ? 0x2a2224 : 0xff8a2a, life: 0.8, size: 0.06 }); this.decal(x, z, 0x241c1a, 0.45); break;
      case 'soul': sfx('soulrelease'); for (let i = 0; i < this.n(8); i++) g.fx.add({ x: x + (Math.random() - 0.5) * 0.3, y: 0.5, z: z + (Math.random() - 0.5) * 0.3, vy: 1.6 + Math.random(), vx: (Math.random() - 0.5) * 0.4, g: -0.6, color: [0x8fe3dc, 0xc8b0ff, 0xe8fffb][i % 3], life: 1.1, size: 0.1, soft: true, wob: 2 }); break;
      default:
        if (m === 'construct') { sfx('diestone'); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 3; g.fx.add({ x, y: 0.4, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 2 + Math.random() * 3, color: M.c[i % M.c.length], life: 0.9, size: 0.1, g: 12 }); } g.fx.sparks(x, 0.4, z, 0, this.n(5)); }
        else if (m === 'spectral' || m === 'ink') { sfx('diespirit'); for (let i = 0; i < n; i++) g.fx.add({ x: x + (Math.random() - 0.5) * 0.4, y: 0.4 + Math.random() * 0.4, z: z + (Math.random() - 0.5) * 0.4, vy: 0.8, g: -0.5, color: M.c[i % M.c.length], life: 1, size: 0.1, soft: true, wob: 1.5 }); }
        else if (m === 'plant') { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; g.fx.add({ x, y: 0.5, z, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, vy: 2 + Math.random() * 2, color: [...M.c, ...M.sap][i % 5], life: 1, size: 0.08, g: 5, wob: 1.5 }); } }
        else if (M.blood && this.blood !== 'off') { const bn = this.blood === 'reduced' ? Math.ceil(n / 2) : n; for (let i = 0; i < bn; i++) { const a = (h?.dir || 0) + (Math.random() - 0.5) * 1.6, s = 2 + Math.random() * 3; g.fx.add({ x, y: 0.4, z, vx: Math.sin(a) * s, vz: Math.cos(a) * s, vy: 2, color: M.c[i % M.c.length], life: 0.6, size: 0.06, g: 12 }); } if (this.blood === 'full') this.decal(x, z, M.c[1], 0.4); if (M.shell) for (let i = 0; i < 5; i++) g.fx.add({ x, y: 0.4, z, vx: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, vy: 3, color: M.shell[i % 2], life: 0.8, size: 0.07, g: 12 }); }
    }
  }

  // ---------------------------------------------------------------- persistent status visuals
  // Shown only while the status is active; removed the frame it ends.
  statusTick(e, dt) {
    const S = e.status; if (!S) return;
    if (S.shock > 0 && Math.random() < 0.25 * this.k) this.g.fx.add({ x: e.x + (Math.random() - 0.5) * 0.5, y: 0.3 + Math.random() * 0.6, z: e.z + (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vy: 1.5, color: 0xfff3b0, life: 0.12, size: 0.04, g: 0 });
    let mark = this.hexMarks.get(e);
    if (S.hex > 0 && !e.dead) {
      if (!mark && this.hexMarks.size < 20) { mark = new THREE.Mesh(CombatFx.hexGeo || (CombatFx.hexGeo = new THREE.RingGeometry(0.28, 0.36, 6)), new THREE.MeshBasicMaterial({ color: 0xb88aff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); mark.rotation.x = -Math.PI / 2; this.g.scene.add(mark); this.hexMarks.set(e, mark); }
      if (mark) mark.position.set(e.x, 1.25 + Math.sin(this.g.time * 3) * 0.05, e.z); if (mark) mark.rotation.z += dt * 1.5;
      if (mark) mark.material.opacity = S.hex < 0.6 ? 0.8 + Math.sin(this.g.time * 30) * 0.2 : 0.8; // flickers just before it detonates or fades
    } else if (mark) { this.g.scene.remove(mark); mark.material.dispose(); this.hexMarks.delete(e); }
  }
  update(dt) {
    const g = this.g;
    for (let i = this.bolts.length - 1; i >= 0; i--) { const b = this.bolts[i]; b.t -= dt; b.m.material.opacity = Math.max(0, b.t / 0.14); if (b.t <= 0) { g.scene.remove(b.m); b.m.geometry.dispose(); b.m.children.forEach(c => c.geometry.dispose()); b.m.material.dispose(); this.bolts.splice(i, 1); } }
    for (const d of this.decals) { d.t -= dt; d.m.material.opacity = Math.max(0, Math.min(0.55, d.t / d.max * 0.9)); }
    for (const s of this.lights) { if (s.t > 0) { s.t -= dt; s.L.intensity = s.i * Math.max(0, s.t / s.max); if (s.t <= 0) s.L.visible = false; } }
    for (const [e, mark] of this.hexMarks) if (e.dead || !e.obj.parent) { g.scene.remove(mark); mark.material.dispose(); this.hexMarks.delete(e); }
  }
  // area change: drop everything temporary
  clear() {
    const g = this.g;
    for (const b of this.bolts) g.scene.remove(b.m); this.bolts = [];
    for (const d of this.decals) g.scene.remove(d.m); this.decals = [];
    for (const [, m] of this.hexMarks) g.scene.remove(m); this.hexMarks.clear();
    for (const s of this.lights) { s.t = 0; s.L.visible = false; }
  }
}

// ------------------------------------------------------------------ install: wrap, never replace
export function installCombatFx(Game) {
  const E = Enemy.prototype, onHit = E.onHit, die = E.die, update = E.update;
  E.onHit = function (h) { const r = onHit.call(this, h); if (r === 'hit' && !this.labQuiet) this.g.combatFx?.onEnemyHit(this, h); return r; };
  E.die = function (h, how) { const was = this.dead; if (!was && !this.labTarget) this.g.combatFx?.onEnemyDeath(this, h, how); return die.call(this, h, how); };
  E.update = function (dt) { update.call(this, dt); if (this.status) this.g.combatFx?.statusTick(this, dt); };
  const P = Game.prototype, playerHit = P.playerHit;
  // remember the resolved element and kind of the latest hit, for the death presentation
  P.playerHit = function (e, o) { if (e && o) { e._lastEl = o.element || elementOf(o); e._lastKind = o.kind; } return playerHit.call(this, e, o); };
}

// ------------------------------------------------------------------ VFX lab previews
// The same functions combat uses, on the nearest enemy or a point in front of the player.
export const FX_PREVIEWS = [['fire', 'Fire impact'], ['frost', 'Frost impact'], ['lightning', 'Lightning bolt'], ['hex', 'Hex impact'], ['spirit', 'Soul impact'], ['poison', 'Poison impact'],
  ['hit:flesh', 'Hit · flesh (blood setting)'], ['hit:plant', 'Hit · plant'], ['hit:construct', 'Hit · construct'], ['hit:insect', 'Hit · insect'], ['hit:spectral', 'Hit · spectral'],
  ['death:shatter', 'Death · frozen shatter'], ['death:char', 'Death · burning'], ['death:electric', 'Death · electrical'], ['death:explode', 'Death · explosion'], ['death:soul', 'Death · soul release'], ['death:material', 'Death · material'],
  ['levelup', 'Level-up cue'], ['drop:2', 'Rare drop cue'], ['drop:4', 'Legendary drop cue'], ['drop:5', 'Prismatic drop cue']];
export function previewFx(g, id) {
  const F = g.combatFx; if (!F) return;
  const p = g.player, t = g.entities.filter(e => e.isEnemy && !e.dead).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  const at = t || { x: p.x + Math.sin(p.facing) * 2.5, z: p.z + Math.cos(p.facing) * 2.5, kind: 'brigand', status: {} };
  const [kind, arg] = id.split(':');
  if (EL[kind]) { if (kind === 'lightning') F.bolt(p.x, p.z, at.x, at.z); F.impact({ target: at, x: at.x, z: at.z, element: kind }); return; }
  const fake = { x: at.x, z: at.z, kind: at.kind, status: {}, material: arg, g };
  if (kind === 'hit') return F.onEnemyHit(fake, { dir: Math.atan2(at.x - p.x, at.z - p.z), heavy: true });
  if (kind === 'death') { const k = F.deathKind; F.deathKind = () => arg; try { F.onEnemyDeath({ ...fake, material: at.kind ? undefined : 'flesh' }, { dir: 0 }); } finally { F.deathKind = k; } return; }
  if (kind === 'levelup') { sfx('levelbell'); setTimeout(() => sfx('skillpoint'), 650); g.fx.ring(p.x, p.z, 0.3, 3, 0xffd25e, 0.7); return; } // cue only: no level, no points
  if (kind === 'drop') { const r = +arg; sfx(r >= 5 ? 'dropprism' : r >= 4 ? 'droplegend' : 'droprare'); g.fx.ring(at.x, at.z, 0.15, r >= 4 ? 1.4 : 0.85, [0x4aa8ff, 0x4aa8ff, 0x4aa8ff, 0xc46bff, 0xff9a2a, 0xf3a4ff][r], 0.65); }
}
