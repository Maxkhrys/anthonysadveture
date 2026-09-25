// The Soulbound: a wandering Mossling who walks with the spirits. Everything specific to the
// class lives here: the live SoulChain rig, the orbiting Soul Echoes, the Veil silhouette,
// the lash combo and ability states the Player delegates to, and the spirit entities.
//
// Soul Echoes are the usual 0-100 class resource counted in Echoes of 20 (five at most), so
// saves, HUD code and costs keep working unchanged.
import * as THREE from 'three';
import { Entity, move } from '../entities/entity.js';
import { geo, mesh, B, MAT, MAT_GLOW, MAT_GLOW_T } from '../models.js';
import { sfx } from '../engine/audio.js';
import { angDiff } from '../engine/util.js';
import { T, isSolid } from '../world/tiles.js';
import { Projectile, segT } from './combat.js';
import { ECHO, MAX_ECHOES, echoCount } from './classes.js';
import { chainStyle } from '../weaponModels.js';
import { hasEngraving, hasSigil } from './crafting.js';

export const SPIRIT = 0x8fe3dc, SPIRIT_L = 0xc8b0ff, SPIRIT_W = 0xe8fffb, VEIL = 0x7a6ab8, VEIL_D = 0x4e7e8a;
const foes = (g, x, z, r) => g.entities.filter(e => e.isEnemy && !e.dead && !(e.spawnT > 0) && Math.hypot(e.x - x, e.z - z) < r + (e.r || 0.3));
const along = (g, x0, z0, x1, z1, w) => g.entities.filter(e => e.isEnemy && !e.dead && !(e.spawnT > 0) && segT(x0, z0, x1, z1, e.x, e.z).d < w + (e.r || 0.3));
// "large" foes pull you to them instead of being pulled
export const isLarge = e => !!(e.isBoss || e.elite || e.poise || e.shell > 0 || (e.eliteScale || 1) > 1.25 || (e.r || 0.3) > 0.55 || e.heavy);
const ease = k => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const walkable = (g, x, z) => { const t = g.tileAt(Math.floor(x), Math.floor(z)); return !isSolid(t) && t !== T.PIT; };

// ------------------------------------------------------------------ Echo bookkeeping
export function gainEcho(g, n = 1, x, z) {
  if (!n) return;
  const before = echoCount(g.res);
  g.res = Math.min(100, g.res + n * ECHO * (1 + (g.pstats.arpg?.stats.resourceGeneration || 0) / 100));
  const after = echoCount(g.res);
  if (after > before) {
    sfx('echo');
    const p = g.player;
    g.fx.burst(x ?? p.x, 0.7, z ?? p.z, 4, [SPIRIT, SPIRIT_W], 1.2, { g: -1, life: 0.5, size: 0.05 });
    g.stats.echoes = (g.stats.echoes || 0) + (after - before);
  }
  g.hudDirty = true;
}
// every spent Echo can wake something: the Kindred Lantern howls, Chorus of Many frees motes
export function onEchoSpent(g, n) {
  if (!n) return;
  const p = g.player;
  sfx('echospend');
  g.stats.echoesSpent = (g.stats.echoesSpent || 0) + n;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; g.fx.add({ x: p.x + Math.cos(a) * 0.5, y: 0.8, z: p.z + Math.sin(a) * 0.5, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, vy: 1.5, g: 0, color: SPIRIT_W, life: 0.45, size: 0.07 }); }
  for (const e of g.entities) if (e.isKindred && !e.dead) e.howl();
  if (g.talent('chorusofmany')) for (let i = 0; i < n; i++) spiritMote(g, p.x, p.z, p.facing + (i - (n - 1) / 2) * 0.5, 0.6);
  g.hudDirty = true;
}
export function spendAllEchoes(g) { const n = echoCount(g.res); g.res -= n * ECHO; return n; }
// a seeking spirit mote (Echo Release, Chorus of Many, the Lanternbearer's Chain)
export function spiritMote(g, x, z, dir, mult, onHitFx) {
  g.spawn(new Projectile(g, { x, z, dir, speed: 9, range: 9, mult, kind: 'bolt', homing: 5, seek: { cone: 1.4, rate: 6, range: 7 }, color: SPIRIT_W, ability: true, echo: true, noCraft: true, element: 'spirit', onHitFx }));
}

// ------------------------------------------------------------------ the live SoulChain
// Links are two instanced meshes (iron and spectral) laid along a quadratic curve from the
// hand to the tip. Toward the tip the iron fades out and the spectral links fade in, so the
// chain reads as a real chain that becomes spirit as it reaches.
const N_LINKS = 26;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _ax = new THREE.Vector3(0, 0, 1), _v = new THREE.Vector3();
export class ChainRig {
  constructor() {
    this.group = new THREE.Group();
    this.key = '';
    this.visible = false;
  }
  setColors(item) {
    // link colours, link shape and spirit colour come from the weapon's approved chain design
    const S = chainStyle(item);
    const key = [S.a, S.b, S.spirit, S.link].join(':');
    if (key === this.key) return;
    this.key = key; this.orb = S.spirit;
    for (const m of [this.iron, this.spirit]) if (m) { this.group.remove(m); m.geometry.dispose(); m.dispose(); }
    // links are drawn a little larger than life so the chain still reads at gameplay distance
    const k = S.link === 'heavy' ? 1.2 : 1, L = [B(0.11 * k, 0.05 * k, 0.16 * k, 0, -0.025, 0, S.a), B(0.115 * k, 0.02, 0.05, 0, 0.0, 0, S.b)];
    if (S.link === 'spiked') L.push(B(0.03, 0.03, 0.08, 0.06, -0.03, 0.03, S.b, 0, 0, 0.8));
    if (S.link === 'ornate') L.push(B(0.05, 0.05, 0.05, 0, -0.03, 0, S.gemA));
    this.iron = new THREE.InstancedMesh(geo(L), MAT, N_LINKS);
    this.spirit = new THREE.InstancedMesh(geo([B(0.12, 0.055, 0.17, 0, -0.027, 0, S.spirit), B(0.06, 0.06, 0.06, 0, -0.03, 0, 0xffffff)]), MAT_GLOW, N_LINKS);
    for (const m of [this.iron, this.spirit]) { m.frustumCulled = false; m.layers.enable(1); this.group.add(m); }
    this.iron.castShadow = true;
  }
  hide() { if (this.visible) { this.group.visible = false; this.visible = false; } }
  // a (hand) and b (tip) in the rig's space; bend pushes the middle sideways (whip curl) and
  // lift raises it; sf = where along the chain it turns spectral (0 = all spirit, 1 = all iron)
  draw(a, b, bend = 0, lift = 0.1, sf = 0.6, tipScale = 1.6) {
    if (!this.iron) return;
    if (!this.visible) { this.group.visible = true; this.visible = true; }
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz, b.y - a.y), hl = Math.hypot(dx, dz) || 1;
    const px = dz / hl, pz = -dx / hl; // sideways, for the whip's curl
    const cx = (a.x + b.x) / 2 + px * bend, cy = (a.y + b.y) / 2 + lift, cz = (a.z + b.z) / 2 + pz * bend;
    const n = Math.max(3, Math.min(N_LINKS, Math.round(len / 0.13) + 2));
    for (let i = 0; i < N_LINKS; i++) {
      if (i >= n) { _m.makeScale(0, 0, 0); this.iron.setMatrixAt(i, _m); this.spirit.setMatrixAt(i, _m); continue; }
      const t = i / (n - 1), u = 1 - t;
      _p.set(u * u * a.x + 2 * u * t * cx + t * t * b.x, u * u * a.y + 2 * u * t * cy + t * t * b.y, u * u * a.z + 2 * u * t * cz + t * t * b.z);
      _t.set(2 * u * (cx - a.x) + 2 * t * (b.x - cx), 2 * u * (cy - a.y) + 2 * t * (b.y - cy), 2 * u * (cz - a.z) + 2 * t * (b.z - cz));
      if (_t.lengthSq() < 1e-8) _t.set(0, 0, 1);
      _t.normalize();
      _q.setFromUnitVectors(_ax, _t);
      _q2.setFromAxisAngle(_t, i % 2 ? Math.PI / 2 : 0); _q.premultiply(_q2);
      const w = 1 - smooth(sf - 0.12, sf + 0.18, t); // iron weight
      const tip = i === n - 1 ? tipScale : 1;
      _s.setScalar(w); _m.compose(_p, _q, _s); this.iron.setMatrixAt(i, _m);
      _s.setScalar((1 - w) * tip * (0.85 + 0.15 * Math.sin(i * 1.7 + performance.now() * 0.012))); _m.compose(_p, _q, _s); this.spirit.setMatrixAt(i, _m);
    }
    this.iron.instanceMatrix.needsUpdate = true; this.spirit.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ the class kit on the player
// Owns the chain rig, the Echo motes and the Veil silhouette (all children of player.obj, in
// the player's own rotated space: +z is where the Soulbound faces).
export class SoulKit {
  constructor(p, echo = true) {
    this.p = p; this.echo = echo; // motes only for the Soulbound (another class may simply wield a chain)
    this.rig = new ChainRig(); p.obj.add(this.rig.group);
    // five Echo motes: small spirit lights that orbit at shoulder height
    this.motes = [];
    const mg = geo([B(0.07, 0.07, 0.07, 0, -0.035, 0, SPIRIT_W), B(0.045, 0.045, 0.1, 0, -0.022, 0, SPIRIT)]);
    for (let i = 0; i < MAX_ECHOES; i++) { const m = new THREE.Mesh(mg, MAT_GLOW); m.scale.setScalar(0.001); m.layers.enable(1); m.rotation.set(0.6, 0.6, 0); p.obj.add(m); this.motes.push({ m, s: 0 }); }
    // the Veil silhouette: a pale outline of the Soulbound with a streaming scarf
    // (a runner's outline leaning into the dash, arms swept back, the scarf streaming long behind)
    const V = [B(0.08, 0.18, 0.08, -0.07, 0.02, -0.04, VEIL, 0.5), B(0.08, 0.18, 0.08, 0.07, 0.02, 0.05, VEIL, -0.4),
      B(0.24, 0.22, 0.16, 0, 0.2, 0, VEIL, 0.25), B(0.3, 0.26, 0.26, 0, 0.47, 0.06, 0x9a8ad0, 0.2), B(0.2, 0.05, 0.02, 0, 0.53, 0.2, SPIRIT_W),
      B(0.07, 0.2, 0.07, -0.18, 0.22, -0.08, VEIL, 0.9), B(0.07, 0.2, 0.07, 0.18, 0.22, -0.08, VEIL, 0.9),
      B(0.11, 0.04, 0.34, 0.05, 0.42, -0.3, VEIL_D), B(0.09, 0.03, 0.3, 0.03, 0.4, -0.6, VEIL_D), B(0.06, 0.03, 0.26, 0, 0.38, -0.86, SPIRIT)];
    this.ghost = new THREE.Mesh(geo(V), MAT_GLOW_T); this.ghost.visible = false; this.ghost.scale.setScalar(1.12); p.obj.add(this.ghost);
    this.veilK = 0;
  }
  setWeapon(item) { this.rig.setColors(item); }
  dispose() { for (const o of [this.rig.group, this.ghost, ...this.motes.map(m => m.m)]) if (o.parent) o.parent.remove(o); }
  hand() { const p = this.p; p.m.sword.getWorldPosition(_v); p.obj.worldToLocal(_v); return { x: _v.x, y: _v.y, z: _v.z }; }
  update(dt) {
    const p = this.p, g = p.g, s = p.state, t = g.time;
    // --- the Veil: fade the body out and the spirit silhouette in
    const inVeil = s === 'veil' || (s === 'rift' && !p.riftOut);
    this.veilK += ((inVeil ? 1 : 0) - this.veilK) * Math.min(1, dt * 18);
    p.m.root.visible = p.m.root.visible && this.veilK < 0.5;
    this.ghost.visible = this.veilK > 0.05;
    if (this.ghost.visible) { this.ghost.scale.set(1.12 * (1 + (1 - this.veilK) * 0.3), 1.12 * this.veilK, 1.12 * (1.25 + (1 - this.veilK) * 0.3)); this.ghost.position.y = 0.08 + Math.sin(t * 20) * 0.02; }
    // --- Echo motes
    const n = echoCount(g.res), part = (g.res % ECHO) / ECHO, hideMotes = !this.echo || this.veilK > 0.5 || s === 'dead';
    for (let i = 0; i < MAX_ECHOES; i++) {
      const M = this.motes[i];
      const want = hideMotes ? 0 : i < n ? 1 : i === n && part > 0.45 ? 0.4 + Math.sin(t * 9) * 0.08 : 0;
      M.s += (want - M.s) * Math.min(1, dt * 10);
      const a = t * 1.7 + i * Math.PI * 2 / MAX_ECHOES - p.facing, r = 0.52 + Math.sin(t * 2 + i) * 0.04;
      M.m.position.set(Math.cos(a) * r, 0.78 + Math.sin(t * 3 + i * 1.3) * 0.06, Math.sin(a) * r);
      M.m.rotation.y = t * 3 + i; M.m.scale.setScalar(Math.max(0.001, M.s));
      if (M.s > 0.9 && Math.random() < dt * 3) { _v.copy(M.m.position); p.obj.localToWorld(_v); g.fx.add({ x: _v.x, y: _v.y, z: _v.z, abs: true, g: 0, color: SPIRIT, life: 0.4, size: 0.035, drag: 2 }); }
    }
    // --- the chain
    if (inVeil) return this.rig.hide();
    const h = this.hand(), R = p.chainRange();
    const tipAt = (ang, len, y = 0.42) => ({ x: Math.sin(ang) * len, y, z: Math.cos(ang) * len });
    switch (s) {
      case 'lash': { const L = p.lashVis; if (L) this.rig.draw(h, tipAt(L.ang, L.len, L.y ?? 0.42), L.bend, L.lift ?? 0.08, L.sf, L.finisher ? 2.2 : 1.6); break; }
      case 'hook': case 'hookzip': { const H = p.hook; if (!H) break; const tip = H.catchPt ? { x: 0, y: 0.42, z: 0 } : tipAt(0, H.len); if (H.catchPt) { _v.set(H.catchPt.x, (H.catchPt.gy || 0) + 0.42, H.catchPt.z); p.obj.worldToLocal(_v); tip.x = _v.x; tip.y = _v.y; tip.z = _v.z; } this.rig.draw(h, tip, Math.sin(t * 30) * 0.05, 0.06, 0.5, 2.4); break; }
      case 'coil': case 'spin': { const a = p.st * (s === 'coil' ? 17 : 14) - p.facing; this.rig.draw(h, tipAt(a + p.facing, s === 'coil' ? 2.9 : R * 0.95, 0.38), -0.6, 0.05, 0.3, 2.0); break; }
      case 'charge': { const a = t * 14; this.rig.draw(h, { x: Math.sin(a) * 0.75, y: 1.15, z: Math.cos(a) * 0.75 }, -0.25, 0.2, p.chargeT >= 0.7 ? 0.2 : 0.55, 1.8); break; }
      case 'rend': { const L = p.lashVis; if (L) this.rig.draw(h, tipAt(L.ang, L.len), L.bend, 0.06, 0.35, 2.0); break; }
      default: {
        // idle: the chain hangs from the hand and sways; while moving it trails behind
        const mv = Math.min(1, (p.moveSpeed || 0) / 5), sway = Math.sin(t * 2.1) * 0.05;
        this.rig.draw(h, { x: h.x + 0.04 + sway, y: Math.max(0.06, h.y - 0.42 + mv * 0.12), z: h.z - 0.12 - mv * 0.3 }, 0.06 + sway, -0.05, 0.82, 1.2);
      }
    }
  }
}

// ------------------------------------------------------------------ the lash combo
// a0..a1: the chain tip's sweep relative to the facing; ext: reach multiplier
export const LASH = [null,
  { dur: 0.34, wind: 0.07, win: 0.1, a0: 1.3, a1: -1.2, ext: 1, mult: 0.9, kb: 3, half: 0.5, sf: 0.5, bend: 0.55, sfx: 'lash' },
  { dur: 0.34, wind: 0.07, win: 0.1, a0: -1.3, a1: 1.2, ext: 1, mult: 0.95, kb: 3, half: 0.5, sf: 0.5, bend: -0.55, sfx: 'lash' },
  { dur: 0.4, wind: 0.11, win: 0.09, a0: 0, a1: 0, ext: 1.3, mult: 1.25, kb: 5, half: 0.2, sf: 0.42, bend: 0.12, thrust: true, sfx: 'lash2' },
  { dur: 0.56, wind: 0.14, win: 0.2, a0: -2.8, a1: 3.5, ext: 1.08, mult: 1.7, kb: 7, half: 0.6, sf: 0.2, bend: -0.8, finisher: true, sfx: 'spin' },
];
export function startLash(p) {
  const g = p.g;
  p.combo = p.state === 'lash' && p.combo < 4 ? p.combo + 1 : 1;
  p.setState('lash'); p.attackId++; p.hitSet.clear(); p.buffer = 0; p.lashLanded = false; p.lashFx = false;
  if (p.aiming) p.facing = p.aimDir;
  else { const t = g.nearestEnemy(p.x, p.z, p.chainRange() + 0.5, p.facing, 1.1); if (t) p.facing = Math.atan2(t.x - p.x, t.z - p.z); }
  const L = LASH[p.combo];
  p.lashVis = { ang: L.a0 * 1.2, len: 0.35, bend: 0, sf: 0.8, y: 0.55 };
  p.lunge = L.finisher ? 2.2 : 1.2;
}
// one frame of the lash; returns the velocity to apply this frame
export function lashFrame(p, dt, aspd, ctx) {
  const g = p.g, L = LASH[p.combo], R = p.chainRange() * L.ext;
  p.st += dt * (aspd - 1);
  let vx = 0, vz = 0;
  const st = p.st;
  if (st < L.wind) {
    // anticipation: the chain draws back past the shoulder, the body coils
    const k = st / L.wind;
    p.lashVis = { ang: L.thrust ? Math.PI * 0.85 : L.a0 * (1.15 + 0.25 * k), len: 0.4 + 0.2 * k, bend: L.bend * 0.3, sf: 0.75, y: 0.55 + 0.1 * k };
  } else if (st < L.wind + L.win) {
    const k = (st - L.wind) / L.win, e = ease(k);
    const ang = L.a0 + (L.a1 - L.a0) * e, len = R * Math.min(1, 0.35 + k * 1.7);
    p.lashVis = { ang, len, bend: L.bend * (1 - e * 0.7), sf: L.sf, y: 0.42, finisher: L.finisher };
    if (st - dt * aspd < L.wind) { // the crack
      sfx(L.sfx);
      if (!p.lashFx) {
        p.lashFx = true;
        // the lash's reach, drawn as it cracks: a pale arc where the tip travels (or a line for the thrust)
        if (L.finisher) { g.fx.arc(p.x, 0.36, p.z, p.facing, R, Math.PI * 2, SPIRIT, 0.32, 0.5, true); g.fx.ring(p.x, p.z, 0.4, R, SPIRIT_L, 0.35, 0.3); }
        else if (L.thrust) { for (let i = 1; i <= 8; i++) { const d = R * i / 8; g.fx.add({ x: p.x + Math.sin(p.facing) * d, y: 0.42, z: p.z + Math.cos(p.facing) * d, g: 0, color: i === 8 ? SPIRIT_W : SPIRIT, life: 0.22 + i * 0.01, size: i === 8 ? 0.12 : 0.06 }); } g.fx.ring(p.x + Math.sin(p.facing) * R, p.z + Math.cos(p.facing) * R, 0.05, 0.45, SPIRIT_W, 0.2, 0.42); }
        else { const mid = p.facing + (L.a0 + L.a1) / 2; g.fx.arc(p.x, 0.4, p.z, mid, R, Math.abs(L.a1 - L.a0), SPIRIT, 0.18, 0.22); g.fx.arc(p.x, 0.41, p.z, mid, R * 0.96, Math.abs(L.a1 - L.a0) * 0.9, 0xffffff, 0.1, 0.07); }
      }
    }
    if (st < L.wind + 0.05) { vx = Math.sin(p.facing) * p.lunge; vz = Math.cos(p.facing) * p.lunge; }
    const o = { mult: L.mult, kind: L.finisher ? 'lashsweep' : 'lash', element: 'spirit', kb: L.kb, id: p.attackId, lash: p.combo };
    if (L.thrust) g.hitArc(p, p.x, p.z, p.facing, len, L.half, o);
    else g.hitArc(p, p.x, p.z, p.facing + ang, len, L.half, o);
    // spectral motes shed from the tip as it travels
    if (Math.random() < 0.7) { const tx = p.x + Math.sin(p.facing + ang) * len, tz = p.z + Math.cos(p.facing + ang) * len; g.fx.add({ x: tx, y: 0.42, z: tz, vy: 0.4, g: 0, color: Math.random() < 0.5 ? SPIRIT : SPIRIT_L, life: 0.3, size: 0.05 }); }
  } else {
    // recovery: the chain slackens and comes back to the hand
    const k = Math.min(1, (st - L.wind - L.win) / Math.max(0.05, L.dur - L.wind - L.win));
    const ang = L.a1 * (1 - k * 0.6), len = R * (1 - ease(k)) + 0.4 * ease(k);
    p.lashVis = { ang, len, bend: -L.bend * 0.5 * k, sf: L.sf + (0.8 - L.sf) * k, y: 0.42 - 0.12 * k, lift: -0.08 * k };
  }
  // chaining into the next lash, abilities, rolls
  const { inp, locked, mx, mz, mlen } = ctx;
  if (!locked && inp.pressed('attack')) p.buffer = 0.3;
  p.buffer -= dt;
  if (st > L.wind + L.win * 0.7 && p.buffer > 0 && p.combo < 4) { if (mlen > 0.1 && !p.aiming) p.facing = Math.atan2(mx, mz); startLash(p); return [vx, vz]; }
  if (st > L.wind + L.win * 0.6 && !locked && p.tryAbility()) return [vx, vz];
  if (st > L.wind && !locked && inp.pressed('roll')) { p.startRoll(mx, mz, mlen); return [vx, vz]; }
  if (st >= L.dur) {
    if (inp.down('attack') && p.combo === 1 && !locked) { p.setState('charge'); p.chargeT = 0; }
    else p.setState('move');
  }
  return [vx, vz];
}
// a SoulChain hit landed (called from Game.playerHit for every lash hit)
export function onLashHit(g, p, e, o, crit, dmg) {
  const L = LASH[o.lash] || LASH[1];
  // Echoes: the first foe each lash lands on gathers them
  if (!p.lashLanded) {
    p.lashLanded = true;
    const noGain = g.inv.cls !== 'soulbound' || (g.talent('chorusofmany') && o.lash <= 2);
    if (!noGain) gainEcho(g, L.finisher ? 1 + (g.talent('soulthirst') ? 1 : 0) : 0.5, e.x, e.z);
    g.hitstop(L.finisher ? 0.06 : 0.025);
    if (L.finisher) {
      g.pr.addShake(0.22);
      const U = g.pstats.uniques;
      if (U.has('lanternchain') && !(p.lanternT > g.time)) { p.lanternT = g.time + 3; spiritMote(g, p.x, p.z, Math.atan2(e.x - p.x, e.z - p.z), 0.8); }
      if (hasEngraving(g, 'lanternknot')) g.spawn(new LanternRing(g, e.x, e.z, 0.6));
    }
  }
  // impact response: spectral sparks and a pale flash along the struck side
  const dir = Math.atan2(e.x - p.x, e.z - p.z);
  g.fx.sparks(e.x - Math.sin(dir) * 0.15, 0.45, e.z - Math.cos(dir) * 0.15, dir, crit ? 9 : 5, crit ? SPIRIT_W : SPIRIT);
  if (crit) g.fx.ring(e.x, e.z, 0.05, 0.55, SPIRIT_W, 0.18, 0.5);
  // Warden's Oath: every lash drags what it strikes a little toward you
  if (g.talent('wardenoath') && !e.isBoss && !e.dead) { const d = Math.hypot(p.x - e.x, p.z - e.z); if (d > 1) move(g, e, (p.x - e.x) / d * 0.6, (p.z - e.z) / d * 0.6); }
}
// the charged whirl drags foes in as it turns
export function whirlPull(p, dt) {
  const g = p.g;
  for (const e of foes(g, p.x, p.z, p.chainRange() + 0.8)) { if (e.isBoss) continue; const d = Math.hypot(p.x - e.x, p.z - e.z); if (d > 1.1) move(g, e, (p.x - e.x) / d * 5 * dt, (p.z - e.z) / d * 5 * dt); }
  if (Math.random() < 0.6) { const a = Math.random() * 6.28, r = p.chainRange(); g.fx.add({ x: p.x + Math.sin(a) * r, y: 0.4, z: p.z + Math.cos(a) * r, g: 0, color: SPIRIT, life: 0.3, size: 0.05 }); }
}

// ------------------------------------------------------------------ abilities
// begin: called from Player.useAbility (the cost is already paid). Returns true if handled.
export function beginSoulAbility(p, id, rm, rank, at, first) {
  const g = p.g, F = p.facing, T = k => g.talent(k);
  switch (id) {
    case 'soulhook': {
      const max = g.shotLen(p.x, p.z, F, 6.5 * (1 + (g.pstats.reach || 0) / 100));
      p.hook = { dir: F, len: 0.3, max, phase: 'out', mult: 1.2 * rm, caught: [], t: 0 };
      p.setState('hook'); sfx('lash2'); return true;
    }
    case 'reapingcoil': p.setState('coil'); p.abMult = 0.9 * rm; p.coilN = 0; sfx('spin'); return true;
    case 'bindingseal': {
      const r = T('wardenoath') ? 4 : 3;
      const members = [first, ...foes(g, first.x, first.z, r).filter(e => e !== first).sort((a, b) => Math.hypot(a.x - first.x, a.z - first.z) - Math.hypot(b.x - first.x, b.z - first.z)).slice(0, T('wardenoath') ? 99 : 3)];
      g.spawn(new SealBind(g, p, members, 1.6 * rm));
      sfx('chainpull'); p.setState('cast'); p.castDur = 0.28; return true;
    }
    case 'veilshift': {
      const spend = echoCount(g.res) >= 1;
      if (spend) { g.res -= ECHO; onEchoSpent(g, 1); }
      const dist = g.shotLen(p.x, p.z, F, 4.6 + T('lingeringveil'));
      let to = { x: p.x + Math.sin(F) * dist, z: p.z + Math.cos(F) * dist }, target = null;
      const cand = along(g, p.x, p.z, to.x, to.z, 0.6).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (cand) {
        const bx = cand.x + Math.sin(F) * ((cand.r || 0.3) + 0.75), bz = cand.z + Math.cos(F) * ((cand.r || 0.3) + 0.75);
        if (walkable(g, bx, bz) && g.shotClear(p.x, p.z, bx, bz)) { to = { x: bx, z: bz }; target = cand; }
      }
      p.veil = { from: { x: p.x, z: p.z }, to, target, crit: spend, dur: 0.3 + 0.04 * T('lingeringveil'), mult: 1.3 * rm * (1 + 0.2 * T('lingeringveil')) };
      p.invuln = Math.max(p.invuln, p.veil.dur + 0.12);
      p.setState('veil'); sfx('veilin');
      g.fx.ring(p.x, p.z, 0.2, 1.1, SPIRIT_L, 0.3); g.fx.burst(p.x, 0.5, p.z, 10, [SPIRIT_L, SPIRIT, SPIRIT_W], 2, { g: -1 });
      if (g.pstats.uniques.has('threshold')) g.spawn(new VeilDoor(g, p.x, p.z, F, 0.9 * rm));
      return true;
    }
    case 'echorend': {
      const extra = spendAllEchoes(g); if (extra) onEchoSpent(g, extra);
      const n = 1 + extra;
      p.rend = { n, mult: 1.2 * rm, from: { x: p.x, z: p.z }, dir: F, spawned: false };
      p.setState('rend'); p.attackId++; p.hitSet.clear(); sfx('lash2'); return true;
    }
    case 'veilrift': {
      p.rift = { x: at.x, z: at.z, mult: 2.0 * rm, done: false };
      p.riftOut = false; p.invuln = Math.max(p.invuln, 0.5);
      g.spawn(new RiftMark(g, at.x, at.z, 0.4));
      g.fx.ring(p.x, p.z, 0.2, 1.1, SPIRIT_L, 0.3); sfx('veilin');
      p.setState('rift'); return true;
    }
    case 'kindred': {
      for (const e of g.entities) if (e.isKindred) e.remove();
      g.spawn(new KindredFox(g, 0.55 * rm, 14 + 4 * T('lanternbond'), 0.7 / (1 + 0.2 * T('lanternbond'))));
      sfx('kindred'); p.setState('cast'); p.castDur = 0.3; return true;
    }
    case 'spiritvolley': {
      const extra = spendAllEchoes(g), n = 1 + extra;
      const heal = T('gentlehands') ? () => g.heal(g.inv.maxHp * 0.03, true) : null;
      for (let i = 0; i < n; i++) spiritMote(g, p.x + Math.sin(F) * 0.3, p.z + Math.cos(F) * 0.3, F + (i - (n - 1) / 2) * 0.32, 1.1 * rm, heal ? () => heal() : null);
      if (extra) onEchoSpent(g, extra);
      p.setState('cast'); p.castDur = 0.25; return true;
    }
    case 'ancestorward': {
      for (const e of g.entities) if (e.isWard) e.remove();
      p.wards = [0, 1, 2].map(i => { const w = new WardSpirit(g, i, 1.0 * rm, 8); g.spawn(w); return w; });
      sfx('chime'); g.fx.ring(p.x, p.z, 0.2, 1.2, SPIRIT, 0.4); p.setState('cast'); p.castDur = 0.3; return true;
    }
  }
  return false;
}

// per-frame state machine for the Soulbound's own states; returns [vx, vz, speed] or null
export function soulState(p, s, dt, ctx) {
  const g = p.g;
  switch (s) {
    case 'lash': { const [vx, vz] = lashFrame(p, dt, ctx.aspd, ctx); return [vx, vz, 0]; }
    case 'hook': return hookFrame(p, dt);
    case 'hookzip': return hookFrame(p, dt);
    case 'coil': {
      const hitAt = [0.06, 0.42];
      for (const [i, t0] of hitAt.entries()) if (p.st >= t0 && p.coilN === i) {
        p.coilN++; p.attackId++; p.hitSet.clear();
        g.hitArc(p, p.x, p.z, p.facing, 3.0, Math.PI, { mult: p.abMult, kind: 'lashsweep', element: 'spirit', kb: 0.3, id: p.attackId, ability: true });
        g.fx.arc(p.x, 0.36, p.z, 0, 3.0, 0, SPIRIT, 0.25, 0.45, true); sfx('lash');
      }
      // drag foes inward while the coil turns
      for (const e of foes(g, p.x, p.z, 3.8)) { if (e.isBoss) continue; const d = Math.hypot(p.x - e.x, p.z - e.z); if (d > 1.0) move(g, e, (p.x - e.x) / d * 7 * dt, (p.z - e.z) / d * 7 * dt); }
      if (p.st > 0.78) p.setState('move');
      return [0, 0, 1.6];
    }
    case 'veil': {
      const V = p.veil, k = Math.min(1, p.st / V.dur);
      const tx = V.from.x + (V.to.x - V.from.x) * ease(k), tz = V.from.z + (V.to.z - V.from.z) * ease(k);
      move(g, p, tx - p.x, tz - p.z);
      if (Math.random() < 0.9) g.fx.add({ x: p.x + (Math.random() - 0.5) * 0.4, y: 0.3 + Math.random() * 0.5, z: p.z + (Math.random() - 0.5) * 0.4, g: 0, color: Math.random() < 0.5 ? SPIRIT_L : SPIRIT, life: 0.35, size: 0.06, soft: true, grow: 1.2 });
      if (k >= 1) emerge(p);
      return [0, 0, 0];
    }
    case 'rend': {
      const R = p.chainRange() * 1.35, st = p.st;
      if (st < 0.08) p.lashVis = { ang: Math.PI * 0.85, len: 0.5, bend: 0.1 };
      else if (st < 0.18) { const k = (st - 0.08) / 0.1; p.lashVis = { ang: 0, len: R * Math.min(1, 0.3 + k * 1.6), bend: 0.12 }; g.hitArc(p, p.x, p.z, p.facing, p.lashVis.len, 0.22, { mult: p.rend.mult, kind: 'lash', element: 'spirit', kb: 5, id: p.attackId, ability: true }); }
      else { const k = Math.min(1, (st - 0.18) / 0.2); p.lashVis = { ang: 0, len: R * (1 - k) + 0.4 * k, bend: -0.1 * k }; }
      if (st > 0.1 && !p.rend.spawned) { p.rend.spawned = true; for (let i = 0; i < p.rend.n; i++) g.spawn(new EchoLash(g, p.x, p.z, p.facing, R, 0.9 * p.rend.mult / 1.2, 0.12 * (i + 1))); }
      if (st > 0.38) p.setState('move');
      return [0, 0, 0.6];
    }
    case 'rift': {
      const Rf = p.rift;
      if (!p.riftOut && p.st >= 0.32) {
        p.riftOut = true;
        if (walkable(g, Rf.x, Rf.z)) { p.x = Rf.x; p.z = Rf.z; p.lastSafe = { x: p.x, z: p.z }; }
        for (const e of foes(g, p.x, p.z, 3.4)) { if (e.isBoss) continue; const d = Math.hypot(p.x - e.x, p.z - e.z); if (d > 0.8) move(g, e, (p.x - e.x) / d * Math.min(1.2, d - 0.7), (p.z - e.z) / d * Math.min(1.2, d - 0.7)); }
        p.attackId++; p.hitSet.clear();
        g.hitArc(p, p.x, p.z, p.facing, 2.3, Math.PI, { mult: Rf.mult, kind: 'lashsweep', element: 'spirit', kb: 6, id: p.attackId, ability: true });
        g.fx.arc(p.x, 0.36, p.z, 0, 2.3, 0, SPIRIT_L, 0.2, 0.22, true); g.fx.ring(p.x, p.z, 0.3, 2.4, VEIL_D, 0.35);
        g.fx.burst(p.x, 0.5, p.z, 16, [SPIRIT_L, SPIRIT, SPIRIT_W], 3, { g: -1 });
        sfx('veilout'); g.pr.addShake(0.3); g.hitstop(0.05);
        if (g.talent('betweenworlds')) p.halfVeilT = 1.5;
      }
      if (p.st > 0.55) p.setState('move');
      return [0, 0, 0];
    }
  }
  return null;
}
function emerge(p) {
  const g = p.g, V = p.veil;
  if (V.target && !V.target.dead) p.facing = Math.atan2(V.target.x - p.x, V.target.z - p.z);
  p.attackId++; p.hitSet.clear();
  g.hitArc(p, p.x, p.z, p.facing, 1.9, 1.3, { mult: V.mult, kind: 'lash', element: 'spirit', kb: 5, id: p.attackId, ability: true, forceCrit: V.crit });
  g.fx.arc(p.x, 0.38, p.z, p.facing, 1.9, 2.6, SPIRIT_L, 0.22, 0.45); g.fx.ring(p.x, p.z, 0.2, 1.3, SPIRIT, 0.3);
  g.fx.burst(p.x, 0.5, p.z, 12, [SPIRIT_L, SPIRIT_W], 2.5, { g: -1 });
  sfx('veilout'); sfx('lash');
  if (V.target && g.talent('veilhunger')) gainEcho(g, g.talent('veilhunger'));
  if (g.talent('betweenworlds')) p.halfVeilT = 1.5;
  p.veil = null; p.setState('cast'); p.castDur = 0.18;
}
function hookFrame(p, dt) {
  const g = p.g, H = p.hook;
  if (!H) { p.setState('move'); return [0, 0, 0]; }
  H.t += dt;
  const F = H.dir, sx = Math.sin(F), sz = Math.cos(F);
  if (H.phase === 'out') {
    const prev = H.len; H.len = Math.min(H.max, H.len + 32 * dt);
    const hit = along(g, p.x + sx * prev, p.z + sz * prev, p.x + sx * H.len, p.z + sz * H.len, 0.45).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (hit) {
      sfx('chainpull'); g.fx.sparks(hit.x, 0.45, hit.z, F + Math.PI, 8, SPIRIT); g.hitstop(0.04);
      if (isLarge(hit)) { H.phase = 'zip'; H.caught = [hit]; H.catchPt = hit; p.setState('hookzip'); p.invuln = Math.max(p.invuln, 0.4); }
      else {
        H.phase = 'pull';
        H.caught = hasSigil(g, 0, 'hollowhook') ? along(g, p.x, p.z, p.x + sx * H.max, p.z + sz * H.max, 0.5).filter(e => !isLarge(e)) : [hit];
        if (!H.caught.includes(hit)) H.caught.unshift(hit);
        H.catchPt = hit;
        for (const e of H.caught) { e.stagger = Math.max(e.stagger || 0, 0.6 + 0.4 * g.talent('barbedlinks')); }
      }
    } else if (H.len >= H.max) H.phase = 'back';
  } else if (H.phase === 'pull') {
    let done = true;
    for (const e of H.caught) {
      if (e.dead) continue;
      const tx = p.x + sx * 1.1, tz = p.z + sz * 1.1, d = Math.hypot(tx - e.x, tz - e.z);
      if (d > 0.25) { done = false; const st = Math.min(d, 17 * dt); move(g, e, (tx - e.x) / d * st, (tz - e.z) / d * st); }
    }
    if (done || H.t > 1.1) {
      p.attackId++; p.hitSet.clear();
      for (const e of H.caught) if (!e.dead) { p.hitSet.add(e); g.playerHit(e, { mult: H.mult, kind: 'lash', element: 'spirit', kb: 1, dir: F, ability: true, id: p.attackId }); }
      gainEcho(g, 1, p.x, p.z);
      g.fx.ring(p.x + sx, p.z + sz, 0.1, 0.9, SPIRIT, 0.25);
      p.hook = null; p.setState('cast'); p.castDur = 0.12;
    }
  } else if (H.phase === 'zip') {
    const e = H.caught[0];
    if (!e || e.dead || H.t > 1.2) { p.hook = null; p.setState('move'); return [0, 0, 0]; }
    const d = Math.hypot(e.x - p.x, e.z - p.z), stop = (e.r || 0.3) + 0.6;
    p.facing = Math.atan2(e.x - p.x, e.z - p.z);
    if (Math.random() < 0.8) g.fx.add({ x: p.x, y: 0.4, z: p.z, g: 0, color: SPIRIT_L, life: 0.25, size: 0.07 });
    if (d <= stop + 0.05) {
      p.attackId++; p.hitSet.clear();
      g.hitArc(p, p.x, p.z, p.facing, stop + 0.9, 0.9, { mult: H.mult * 1.15, kind: 'lash', element: 'spirit', kb: 4, id: p.attackId, ability: true });
      g.fx.arc(p.x, 0.36, p.z, p.facing, 1.5, 2.2, SPIRIT, 0.2, 0.4); sfx('lash2'); g.pr.addShake(0.2);
      gainEcho(g, 1 + (g.talent('barbedlinks') ? 1 : 0), p.x, p.z);
      p.hook = null; p.setState('cast'); p.castDur = 0.16;
      return [0, 0, 0];
    }
    const sp = 21;
    return [(e.x - p.x) / d * sp, (e.z - p.z) / d * sp, 0];
  } else if (H.phase === 'back') {
    H.len = Math.max(0, H.len - 36 * dt);
    if (H.len <= 0.35) { p.hook = null; p.setState('move'); }
  }
  return [0, 0, H.phase === 'out' || H.phase === 'back' ? 1.2 : 0];
}

// ------------------------------------------------------------------ animation
// poses for the Soulbound's own states (and its lash), applied after the shared reset
export function soulAnimate(p, m, s, t) {
  switch (s) {
    case 'lash': {
      const L = LASH[p.combo] || LASH[1], st = p.st;
      const w = Math.min(1, st / L.wind), k = ease((st - L.wind) / L.win);
      if (L.thrust) { m.body.rotation.y = st < L.wind ? 0.6 * w : 0.6 - 1.0 * k; m.armR.rotation.x = st < L.wind ? -0.6 - 1.4 * w : -2.0 + 0.4 * k; m.armR.rotation.z = 0.1; m.body.rotation.x = st < L.wind ? -0.1 : 0.25; m.legL.rotation.x = 0.7; m.legR.rotation.x = -0.5; }
      else if (L.finisher) { m.body.rotation.y = st < L.wind ? 0.8 * w : 0.8 - k * Math.PI * 2; m.armR.rotation.x = -1.5; m.armR.rotation.z = 1.25; m.armL.rotation.z = -0.9; m.body.position.y = Math.sin(Math.min(1, k) * Math.PI) * 0.12; m.legL.rotation.x = 0.4; m.legR.rotation.x = -0.4; }
      else {
        const dir = p.combo === 1 ? 1 : -1;
        m.body.rotation.y = st < L.wind ? dir * 0.7 * w : dir * (0.7 - 1.6 * k);
        m.armR.rotation.x = st < L.wind ? -1.1 - 0.9 * w : -2.0 + 0.7 * k; m.armR.rotation.z = dir * (st < L.wind ? 0.6 : 0.6 - 1.1 * k);
        m.armL.rotation.x = -0.4; m.armL.rotation.z = -0.35; m.legL.rotation.x = 0.45; m.legR.rotation.x = -0.35;
      }
      m.sword.rotation.x = 0.4;
      if (st < 0.04) m.body.scale.set(1.07, 0.93, 1.07);
      return true;
    }
    case 'hook': m.armR.rotation.x = p.hook && p.hook.phase === 'pull' ? -1.2 : -1.7; m.armR.rotation.z = 0.05; m.body.rotation.x = p.hook && p.hook.phase === 'pull' ? -0.2 : 0.12; m.legL.rotation.x = 0.5; m.legR.rotation.x = -0.6; m.armL.rotation.x = -0.5; return true;
    case 'hookzip': m.body.rotation.x = 0.55; m.armR.rotation.x = -2.2; m.armL.rotation.x = 0.7; m.legL.rotation.x = -0.7; m.legR.rotation.x = 0.8; m.body.position.y = 0.1; return true;
    case 'coil': m.body.rotation.y = -p.st * 17; m.armR.rotation.x = -1.55; m.armR.rotation.z = 1.3; m.armL.rotation.z = -1.0; m.body.position.y = 0.04; return true;
    case 'rend': { const k = Math.min(1, p.st / 0.1); m.armR.rotation.x = p.st < 0.08 ? -0.6 - 1.4 * k : -1.8; m.body.rotation.x = p.st < 0.08 ? -0.1 : 0.3; m.legL.rotation.x = 0.8; m.legR.rotation.x = -0.6; return true; }
    case 'veil': case 'rift': m.body.rotation.x = 0.5; m.armR.rotation.x = 0.8; m.armL.rotation.x = 0.8; return true;
    case 'charge': m.armR.rotation.x = -2.9; m.armR.rotation.z = 0.2 + Math.sin(t * 14) * 0.15; m.sword.rotation.x = 0.4; m.body.rotation.y = 0.3; m.armL.rotation.z = -0.4; if (p.chargeT > 0.7) m.body.position.x = Math.sin(t * 60) * 0.008; return true;
    case 'spin': m.body.rotation.y = -(p.st / 0.45) * Math.PI * 3; m.armR.rotation.x = -1.55; m.armR.rotation.z = 1.35; m.armL.rotation.z = -1.1; m.body.position.y = 0.05; return true;
  }
  return false;
}

// ------------------------------------------------------------------ spirit entities
// Binding Seal: spectral chains between the bound, drawn as link strips that fade
class SealBind extends Entity {
  constructor(g, p, members, mult) {
    super(g, p.x, p.z); this.t = 0; this.alwaysUpdate = true; this.members = members;
    const pts = [{ x: p.x, z: p.z }, ...members];
    const parts = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.round(d / 0.15)), ang = Math.atan2(b.x - a.x, b.z - a.z);
      for (let k = 0; k < n; k++) { const f = k / n; parts.push(B(0.11, 0.05, 0.16, a.x - p.x + (b.x - a.x) * f, 0.42 + Math.sin(f * Math.PI) * 0.18, a.z - p.z + (b.z - a.z) * f, k % 3 ? SPIRIT : SPIRIT_L, 0, ang, k % 2 ? Math.PI / 2 : 0)); }
    }
    this.m = mesh(parts, MAT_GLOW, false); this.obj.add(this.m);
    for (const e of members) {
      g.playerHit(e, { mult, kind: 'lash', element: 'spirit', kb: 0, dir: Math.atan2(e.x - p.x, e.z - p.z), ability: true });
      if (!e.dead) { e.applyStatus && e.applyStatus('root', 2.5); e.applyStatus && e.applyStatus('mark', 2.5); }
      g.fx.ring(e.x, e.z, 0.1, 0.8, SPIRIT_L, 0.4);
    }
  }
  update(dt) {
    this.t += dt; this.m.scale.y = 1 + Math.sin(this.t * 30) * 0.1;
    this.m.visible = this.t < 0.9 || Math.floor(this.t * 20) % 2 === 0;
    if (this.t > 1.2) { this.m.geometry.dispose(); return this.remove(); }
    this.sync();
  }
}
// Echo Rend: a spectral lash that repeats the real one along the same line
class EchoLash extends Entity {
  constructor(g, x, z, dir, len, mult, delay) {
    super(g, x, z); this.dir = dir; this.len = len; this.mult = mult; this.delay = delay; this.t = 0; this.alwaysUpdate = true; this.hitSet = new Set();
    this.rig = new ChainRig(); this.rig.setColors({ base: 'veilchain' }); this.obj.add(this.rig.group); this.obj.rotation.y = dir;
  }
  update(dt) {
    const g = this.g; this.t += dt;
    const k = (this.t - this.delay) / 0.14;
    if (k < 0) { this.rig.hide(); this.sync(); return; }
    const L = this.len * Math.min(1, 0.3 + k * 1.4), fade = Math.max(0, 1 - (k - 1.2) / 0.8);
    this.rig.draw({ x: 0.15, y: 0.5, z: 0.1 }, { x: 0, y: 0.42, z: L * fade + 0.2 }, Math.sin(k * 8) * 0.12, 0.05, 0, 1.8 * fade);
    if (k <= 1.05) for (const e of along(g, this.x, this.z, this.x + Math.sin(this.dir) * L, this.z + Math.cos(this.dir) * L, 0.45)) if (!this.hitSet.has(e)) {
      this.hitSet.add(e); g.playerHit(e, { mult: this.mult, kind: 'lash', element: 'spirit', echo: true, kb: 3, dir: this.dir, ability: true });
      g.fx.sparks(e.x, 0.45, e.z, this.dir, 5, SPIRIT_L);
    }
    if (k > 0 && k - dt / 0.14 <= 0) sfx('lash');
    if (k > 2) return this.remove();
    this.sync();
  }
}
// Lantern Knot: a ring of spirit light that rings once more where a finisher landed
class LanternRing extends Entity {
  constructor(g, x, z, mult) { super(g, x, z); this.mult = mult; this.t = 0; this.alwaysUpdate = true; g.fx.ring(x, z, 0.1, 1.3, 0xffd88a, 0.6); }
  update(dt) {
    const g = this.g; this.t += dt;
    if (Math.random() < 0.5) { const a = Math.random() * 6.28; g.fx.add({ x: this.x + Math.cos(a) * 1.2, y: 0.2, z: this.z + Math.sin(a) * 1.2, vy: 0.8, g: 0, color: 0xffd88a, life: 0.3, size: 0.05 }); }
    if (this.t >= 0.6) {
      g.fx.ring(this.x, this.z, 0.2, 1.5, 0xfff3b0, 0.35); sfx('resonate');
      for (const e of foes(g, this.x, this.z, 1.4)) g.playerHit(e, { mult: this.mult, kind: 'lash', element: 'spirit', echo: true, kb: 2, dir: Math.atan2(e.x - this.x, e.z - this.z), noProc: true, quiet: false });
      return this.remove();
    }
    this.sync();
  }
}
// The Threshold: a door left in the Veil that the Soulbound steps out of again
class VeilDoor extends Entity {
  constructor(g, x, z, dir, mult) {
    super(g, x, z); this.dir = dir; this.mult = mult; this.t = 0; this.alwaysUpdate = true;
    this.m = mesh([B(0.06, 0.9, 0.06, -0.3, 0, 0, SPIRIT_L), B(0.06, 0.9, 0.06, 0.3, 0, 0, SPIRIT_L), B(0.66, 0.06, 0.06, 0, 0.9, 0, SPIRIT_L), B(0.54, 0.84, 0.02, 0, 0.03, 0, 0x6a5a9a)], MAT_GLOW_T, false);
    this.m.rotation.y = dir; this.obj.add(this.m);
  }
  update(dt) {
    const g = this.g; this.t += dt;
    this.m.scale.y = Math.min(1, this.t * 6);
    if (this.t >= 1 && !this.done) {
      this.done = true; sfx('veilout');
      g.fx.arc(this.x, 0.38, this.z, this.dir, 1.9, 2.6, SPIRIT_L, 0.22, 0.45);
      for (const e of foes(g, this.x, this.z, 1.9)) g.playerHit(e, { mult: this.mult, kind: 'lash', element: 'spirit', echo: true, kb: 4, dir: Math.atan2(e.x - this.x, e.z - this.z), ability: true });
    }
    if (this.t > 1.3) { this.m.geometry.dispose(); return this.remove(); }
    this.sync();
  }
}
// Veil Rift: the tear you step out of
class RiftMark extends Entity {
  constructor(g, x, z, life) {
    super(g, x, z); this.t = 0; this.life = life; this.alwaysUpdate = true;
    this.m = mesh([B(0.9, 0.02, 0.1, 0, 0, 0, SPIRIT_L), B(0.1, 0.02, 0.9, 0, 0, 0, SPIRIT_L), B(0.5, 0.02, 0.5, 0, 0.01, 0, SPIRIT, 0, 0.78)], MAT_GLOW_T, false); this.obj.add(this.m);
  }
  update(dt) {
    const g = this.g; this.t += dt;
    this.m.rotation.y += dt * 9; this.m.scale.setScalar(Math.min(1, this.t * 5) * (1 + Math.sin(this.t * 30) * 0.08));
    if (Math.random() < 0.8) { const a = Math.random() * 6.28; g.fx.add({ x: this.x + Math.cos(a) * 0.9, y: 0.15, z: this.z + Math.sin(a) * 0.9, vx: -Math.cos(a) * 2.5, vz: -Math.sin(a) * 2.5, g: 0, color: SPIRIT_L, life: 0.3, size: 0.05 }); }
    if (this.t > this.life) { this.m.geometry.dispose(); return this.remove(); }
    this.sync(); this.obj.position.y += 0.06;
  }
}
// Kindred Lantern: a lantern-fox spirit that darts at foes and bites
export class KindredFox extends Entity {
  constructor(g, mult, dur, rate) {
    const p = g.player; super(g, p.x - Math.sin(p.facing) * 0.8, p.z - Math.cos(p.facing) * 0.8);
    this.mult = mult; this.dur = dur; this.rate = rate; this.t = 0; this.cool = 0.4; this.alwaysUpdate = true; this.isKindred = true; this.r = 0.2; this.moveMode = 'fly';
    const fur = 0xa8e4dc, furD = 0x6ab0aa;
    this.body = mesh([B(0.18, 0.15, 0.32, 0, 0, 0, fur), B(0.2, 0.17, 0.18, 0, 0.1, 0.2, fur), B(0.08, 0.06, 0.1, 0, 0.12, 0.33, furD), B(0.05, 0.08, 0.04, -0.06, 0.26, 0.2, furD), B(0.05, 0.08, 0.04, 0.06, 0.26, 0.2, furD), B(0.05, 0.1, 0.05, -0.06, -0.08, 0.1, furD), B(0.05, 0.1, 0.05, 0.06, -0.08, 0.1, furD), B(0.05, 0.1, 0.05, -0.06, -0.08, -0.1, furD), B(0.05, 0.1, 0.05, 0.06, -0.08, -0.1, furD)], MAT_GLOW_T, false);
    this.tail = mesh([B(0.1, 0.09, 0.3, 0, 0.05, -0.28, fur), B(0.12, 0.1, 0.1, 0, 0.06, -0.46, 0xffffff)], MAT_GLOW_T, false);
    this.lamp = mesh([B(0.08, 0.1, 0.08, 0, 0.0, -0.5, 0xffd88a), B(0.1, 0.02, 0.1, 0, 0.1, -0.5, 0x6a5a48)], MAT_GLOW, false);
    this.eyes = mesh([B(0.03, 0.02, 0.01, -0.05, 0.14, 0.29, 0x2a3040), B(0.03, 0.02, 0.01, 0.05, 0.14, 0.29, 0x2a3040)], MAT, false);
    for (const m of [this.body, this.tail, this.lamp, this.eyes]) this.obj.add(m);
    this.obj.scale.setScalar(1.35);
    g.fx.burst(this.x, 0.5, this.z, 14, [SPIRIT_W, 0xffd88a], 2.5, { g: -1 });
  }
  howl() { this.howled = true; this.g.fx.ring(this.x, this.z, 0.1, 0.8, 0xffd88a, 0.3); }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt; this.cool -= dt;
    if (this.t > this.dur || p.state === 'dead') { g.fx.burst(this.x, 0.5, this.z, 12, [SPIRIT_W, 0xffd88a], 2, { g: -2 }); sfx('veilout'); return this.remove(); }
    const tgt = foes(g, p.x, p.z, 7).sort((a, b) => Math.hypot(a.x - this.x, a.z - this.z) - Math.hypot(b.x - this.x, b.z - this.z))[0];
    let gx, gz, sp;
    if (tgt) { gx = tgt.x; gz = tgt.z; sp = 8.5; }
    else { const a = this.t * 1.2; gx = p.x + Math.cos(a) * 1.0; gz = p.z + Math.sin(a) * 1.0; sp = 6; }
    const d = Math.hypot(gx - this.x, gz - this.z);
    if (d > (tgt ? (tgt.r || 0.3) + 0.35 : 0.1)) { const st = Math.min(d, sp * dt); this.x += (gx - this.x) / d * st; this.z += (gz - this.z) / d * st; this.facing = Math.atan2(gx - this.x, gz - this.z); }
    else if (tgt && this.cool <= 0) {
      this.cool = this.rate; this.facing = Math.atan2(tgt.x - this.x, tgt.z - this.z);
      if (this.howled) { this.howled = false; for (const e of foes(g, tgt.x, tgt.z, 1.4)) g.playerHit(e, { mult: this.mult * 2.6, kind: 'bite', element: 'spirit', echo: true, kb: 4, dir: this.facing, ability: true }); g.fx.ring(tgt.x, tgt.z, 0.2, 1.5, 0xffd88a, 0.35); sfx('resonate'); }
      else g.playerHit(tgt, { mult: this.mult, kind: 'bite', element: 'spirit', echo: true, kb: 1.5, dir: this.facing, ability: true, quiet: true });
      this.bite = 0.15; sfx('kindred');
    }
    this.bite = Math.max(0, (this.bite || 0) - dt);
    this.obj.rotation.y = this.facing;
    this.body.position.z = this.bite > 0 ? 0.08 : 0;
    this.tail.rotation.y = Math.sin(this.t * 8) * 0.4; this.lamp.rotation.y = this.tail.rotation.y;
    if (Math.random() < 0.25) g.fx.add({ x: this.x - Math.sin(this.facing) * 0.45, y: 0.45, z: this.z - Math.cos(this.facing) * 0.45, vy: 0.3, g: 0, color: 0xffd88a, life: 0.35, size: 0.04 });
    this.sync(); this.obj.position.y += 0.22 + Math.abs(Math.sin(this.t * 9)) * 0.06;
  }
}
// Warden Spirits: each catches one blow meant for you and answers the attacker
export class WardSpirit extends Entity {
  constructor(g, i, mult, dur) {
    super(g, g.player.x, g.player.z); this.i = i; this.mult = mult; this.dur = dur; this.t = 0; this.alwaysUpdate = true; this.isWard = true;
    this.m = mesh([B(0.14, 0.2, 0.14, 0, 0, 0, SPIRIT_W), B(0.18, 0.06, 0.18, 0, 0.18, 0, SPIRIT), B(0.1, 0.12, 0.04, 0, -0.1, -0.1, SPIRIT_L, 0.4)], MAT_GLOW_T, false); this.obj.add(this.m);
  }
  // take the blow; returns true when this spirit answers it
  answer(src) {
    const g = this.g; this.spent = true;
    g.fx.burst(this.x, 0.8, this.z, 10, [SPIRIT_W, SPIRIT], 2.5, { g: -1 }); sfx('parry');
    if (src && src.isEnemy && !src.dead) {
      g.fx.ring(src.x, src.z, 0.1, 1.0, SPIRIT, 0.3);
      g.playerHit(src, { mult: this.mult, kind: 'lash', element: 'spirit', echo: true, kb: 5, dir: Math.atan2(src.x - this.x, src.z - this.z), ability: true });
    }
    this.remove(); return true;
  }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    if (this.t > this.dur || p.state === 'dead') { g.fx.burst(this.x, 0.8, this.z, 6, SPIRIT, 1.5, { g: -1 }); return this.remove(); }
    const a = this.t * 2.4 + this.i * Math.PI * 2 / 3;
    this.x = p.x + Math.cos(a) * 0.75; this.z = p.z + Math.sin(a) * 0.75;
    this.m.rotation.y = -a;
    if (Math.random() < 0.2) g.fx.add({ x: this.x, y: 0.7, z: this.z, g: 0, color: SPIRIT, life: 0.3, size: 0.04 });
    this.sync(); this.obj.position.y += 0.7 + Math.sin(this.t * 4 + this.i) * 0.06;
  }
}
