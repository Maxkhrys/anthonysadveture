import * as THREE from 'three';
import { Entity, move } from './entity.js';
import { makeHero } from '../models.js';
import { sfx } from '../engine/audio.js';
import { angDiff, angleLerp, clamp } from '../engine/util.js';
import { T } from '../world/tiles.js';
import { flashObj } from './common.js';
import { CLASSES, abilityRankMult } from '../rpg/classes.js';
import { unitAt, baseById } from '../rpg/items.js';
import { Projectile, Trap, RainZone, Familiar, frostNova, chainLightning, thornBurst, EchoShot, IaidoEcho, RimeField, blast, bolt } from '../rpg/combat.js';
import { SKILLS, rankOf, rankCd, rankMult, LOADOUT_SIZE } from '../rpg/skills.js';
import { GhostBlade, SeverLine, WindTrail, Rupture, resonanceRing, Tether, StormPins, NeedleRain, GardenSeed, cometShards, HexCurse, MothSwarm, threadTick, foes } from '../rpg/abilities.js';
import { soak } from '../rpg/elements.js';
import { hasEngraving, hasSigil } from '../rpg/crafting.js';
import { AIM_H } from '../aim.js';
import { blocksObject, isLiquid } from '../world/tiles.js';

const _v = new THREE.Vector3();
// how far each basic shot flies (used by both the shot and its on-screen path preview)
const SHOT_RANGE = { arrow: 10, power: 13, bolt: 9, fireball: 9 };
// ground-placed abilities: max cast range, effect radius, keyboard default distance
const SELF_CAST = { tempest: 1, nova: 1, familiar: 1 };
const RANGED = { bow: 1, staff: 1, wand: 1 };

const SPEED = 5.0;

export class Player extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.isPlayer = true;
    this.moveMode = 'player';
    this.r = 0.28;
    this.cls = g.inv.cls || 'samurai';
    this.m = makeHero(this.cls);
    this.m.setGear(g.inv.equip || {});
    this.cdMap = {}; this.aimT = 0;
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
    // three separate directions: where we move (input), where we aim, where we dodge
    this.aimDir = 0; this.aimPt = { x, z }; this.aimSrc = 'keys'; this.aimLock = null; this.dodgeDir = 0;
    this.targeting = null; this.chargeTime = 0.6; this.rollIframes = 0.28;
  }
  // cooldowns belong to abilities; `cds` is the hotbar view of them (slot order)
  get cds() { const L = this.inv.loadout || []; return Array.from({ length: LOADOUT_SIZE }, (_, i) => (L[i] && this.cdMap[L[i]]) || 0); }
  set cds(arr) { const L = this.inv.loadout || []; arr.forEach((v, i) => { if (L[i]) this.cdMap[L[i]] = v; }); }
  cdOf(id) { return this.cdMap[id] || 0; }
  reduceCooldowns(sec) { for (const k in this.cdMap) this.cdMap[k] = Math.max(0, this.cdMap[k] - sec); }
  // how the equipped weapon is used: blade | heavy | bow | staff | wand | oversized
  get family() { return (this.g.pstats && this.g.pstats.family) || ({ archer: 'bow', witch: 'staff' }[this.cls] || 'blade'); }
  get ranged() { return !!RANGED[this.family]; }
  get specialist() { return !this.g.pstats || this.g.pstats.specialist; }
  get aiming() { return this.aimSrc === 'mouse' || this.aimSrc === 'pad'; }
  // Resolve the aim for this frame from the mouse (through the rendered camera), the right
  // stick, or — as a deliberate keyboard fallback — the direction we are facing.
  updateAim() {
    const g = this.g, inp = g.input;
    const src = inp.aimSrc === 'pad' ? (inp.padAim ? 'pad' : 'keys') : inp.mouseAim ? 'mouse' : 'keys';
    this.aimSrc = src; this.aimLock = null;
    if (src === 'mouse') {
      const pr = g.pr;
      let pt = pr.screenToWorld(inp.mouseX, inp.mouseY, AIM_H);
      // a cursor resting on an enemy aims at that enemy's centre (and shows a lock marker)
      const r = pr.renderer.domElement.getBoundingClientRect();
      const ppu = r.width / (pr.rw * pr.unitsPerPx);
      let best = null, bd = 1e9;
      for (const e of g.entities) {
        if (!e.isEnemy || e.dead || e.spawnT > 0) continue;
        if (Math.abs(e.x - pt.x) > 3 || Math.abs(e.z - pt.z) > 3.5) continue;
        const sp = pr.project(_v.set(e.x, 0.35 * (e.eliteScale || 1) + (e.alt || 0), e.z));
        const d = Math.hypot(sp.x - inp.mouseX, sp.y - inp.mouseY) - (e.r || 0.3) * ppu;
        if (d < 8 && d < bd) { bd = d; best = e; }
      }
      if (best) { pt = { x: best.x, z: best.z }; this.aimLock = best; }
      this.aimPt = pt;
      if (Math.hypot(pt.x - this.x, pt.z - this.z) > 0.25) this.aimDir = Math.atan2(pt.x - this.x, pt.z - this.z);
    } else {
      this.aimDir = src === 'pad' ? Math.atan2(inp.padAim.x, inp.padAim.z) : this.facing;
      this.aimPt = { x: this.x + Math.sin(this.aimDir) * 4, z: this.z + Math.cos(this.aimDir) * 4 };
    }
  }
  faceAim() { if (this.aiming) this.facing = this.aimDir; }
  shotKind(power) { return this.family === 'bow' ? (power ? 'power' : 'arrow') : (power ? (this.family === 'wand' ? 'bolt' : 'fireball') : 'bolt'); }
  // the path the next basic shot will take, for the on-screen preview
  shotPreview() {
    if (!this.ranged || !this.aiming) return null;
    const s = this.state;
    const drawing = s === 'shoot' || s === 'aim';
    if (!drawing && !(this.aimSrc === 'pad' && s === 'move')) return null;
    const charged = s === 'aim' && this.aimT >= this.chargeTimeNow;
    const max = SHOT_RANGE[this.shotKind(charged)];
    return { dir: this.aimDir, len: this.g.shotLen(this.x, this.z, this.aimDir, max), charged };
  }
  // where a ground ability would land right now, clamped to range; ok=false if obstructed
  groundTarget(tg) {
    const g = this.g;
    let x, z;
    if (this.aimSrc === 'mouse') { const q = g.pr.screenToWorld(g.input.mouseX, g.input.mouseY, 0); x = q.x; z = q.z; }
    else {
      const f = this.aimSrc === 'pad' ? this.aimDir : this.facing;
      let d = tg.def;
      if (this.aimSrc === 'keys' && tg.id === 'rain') { const t = g.nearestEnemy(this.x, this.z, tg.range, f, 0.6); if (t) d = Math.hypot(t.x - this.x, t.z - this.z); }
      x = this.x + Math.sin(f) * d; z = this.z + Math.cos(f) * d;
    }
    const dx = x - this.x, dz = z - this.z, d = Math.hypot(dx, dz);
    if (d > tg.range) { x = this.x + dx / d * tg.range; z = this.z + dz / d * tg.range; }
    const valid = (x, z) => { const t = g.tileAt(Math.floor(x), Math.floor(z)); return !blocksObject(t) && t !== T.PIT && (tg.id !== 'snare' || !isLiquid(t)) && g.shotClear(this.x, this.z, x, z); };
    let ok = valid(x, z);
    // without a cursor, pull the spot back toward us until it is reachable
    if (!ok && this.aimSrc !== 'mouse') {
      for (let k = 0.9; k > 0.05 && !ok; k -= 0.1) { const nx = this.x + (x - this.x) * k, nz = this.z + (z - this.z) * k; if (valid(nx, nz)) { x = nx; z = nz; ok = true; } }
    }
    return { x, z, ok };
  }
  // first Chain Lightning target: the enemy you point at (not merely the closest one)
  chainTarget(range = 7) {
    const g = this.g;
    const c = g.entities.filter(e => e.isEnemy && !e.dead && !(e.spawnT > 0) && Math.hypot(e.x - this.x, e.z - this.z) < range && g.shotClear(this.x, this.z, e.x, e.z));
    if (!c.length) return null;
    if (this.aimSrc === 'mouse') {
      if (this.aimLock && c.includes(this.aimLock)) return this.aimLock;
      let best = null, bd = 2.5;
      for (const e of c) { const d = Math.hypot(e.x - this.aimPt.x, e.z - this.aimPt.z); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    let best = null, bd = 1e9;
    for (const e of c) { const a = Math.abs(angDiff(this.aimDir, Math.atan2(e.x - this.x, e.z - this.z))); if (a > 0.7) continue; const d = Math.hypot(e.x - this.x, e.z - this.z) + a * 3; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  startRoll(mx, mz, mlen) {
    // back-to-back rolls get shorter invulnerability, so rolling is a timing tool, not a shield
    this.rollChain = this.g.time - (this.lastRollEnd ?? -9) < 0.35 ? (this.rollChain || 0) + 1 : 0;
    this.rollIframes = this.rollChain >= 2 ? 0.12 : 0.28;
    // dodge follows the stick/keys; with no movement, a mouse/pad player backsteps away from the aim
    this.dodgeDir = mlen > 0.1 ? Math.atan2(mx, mz) : this.aiming ? this.aimDir + Math.PI : this.facing;
    this.rollDir = this.dodgeDir; this.facing = this.rollDir; this.targeting = null;
    this.setState('roll'); sfx('roll'); this.g.guide.event('roll');
  }
  get inv() { return this.g.inv; }
  // Deadeye Draw shortens the charge; off-class bows draw slower; Stillwater makes it instant
  get chargeTimeNow() { let t = this.chargeTime * (1 - 0.15 * this.g.talent('deadeye')); if (this.family === 'bow' && !this.specialist) t *= 1.3; if (this.stillT > 0) t = 0.05; return t; }

  setState(s) { this.state = s; this.st = 0; }

  hurt(h) {
    const g = this.g;
    if (this.invuln > 0 || this.state === 'dead' || this.state === 'fall' || g.cutscene) return false;
    if (this.state === 'roll' && this.st < this.rollIframes) { this.perfectDodge(h); return false; }
    const fromAng = Math.atan2(h.x - this.x, h.z - this.z);
    if (this.state === 'block' && !h.unblockable && Math.abs(angDiff(this.facing, fromAng)) < 1.4) {
      const window = 0.2 + 0.06 * g.talent('perfectguard') + (this.family === 'oversized' && this.inv.equip.weapon && this.inv.equip.weapon.unique === 'parasol' ? 0.05 : 0);
      if (this.blockT < window) {
        sfx('parry'); g.hitstop(0.12); g.pr.addFlash(0.25, 0xfff3b0);
        g.fx.sparks(this.x + Math.sin(fromAng) * 0.4, 0.4, this.z + Math.cos(fromAng) * 0.4, fromAng, 16, 0xfff3b0);
        g.fx.ring(this.x, this.z, 0.3, 1.8, 0xfff3b0, 0.3, 0.4);
        if (h.src && h.src.onParried) h.src.onParried();
        if (hasEngraving(g, 'thornrebuke')) { thornBurst(g, this.x, this.z, 0.8); this.rebukeT = 2; g.fx.ring(this.x, this.z, 0.2, 1.4, 0x7fd36a, 0.35); }
        g.addSurge(12);
        if (g.talent('perfectguard')) g.res = Math.min(100, g.res + 15 * g.talent('perfectguard'));
        if (g.talent('counterdraw')) this.counterT = 3;
        this.parryT = g.time;
        g.stats.parries = (g.stats.parries || 0) + 1;
        return 'parry';
      }
      g.fx.sparks(this.x + Math.sin(fromAng) * 0.35, 0.35, this.z + Math.cos(fromAng) * 0.35, fromAng, 6);
      if (h.heavy && !(this.inv.equip.weapon && this.inv.equip.weapon.unique === 'parasol')) {
        // heavy blows break a plain guard: parry them, or get out of the way
        sfx('clang'); g.pr.addShake(0.5); g.hitstop(0.06);
        this.knock(fromAng + Math.PI, 7);
        this.takeDamage(h.dmg * 0.55, h.src && h.src.level, h.src);
        g.fx.ring(this.x, this.z, 0.2, 1.1, 0xff8a5a, 0.3);
        g.ui.float(this.x, 1.5, this.z, 'GUARD BROKEN', '#ffb38a', false);
        if (this.state !== 'dead') { this.setState('hurt'); this.st = -0.25; this.invuln = 0.4; }
        return 'guardbreak';
      }
      sfx('block');
      this.knock(fromAng + Math.PI, 3.5);
      this.takeDamage(h.dmg * 0.25, h.src && h.src.level, h.src);
      return 'block';
    }
    if (this.godMode || this.g.godMode) return 'miss';
    this.takeDamage(h.dmg * ((h.src && h.src.dmgMul) || 1), h.src && h.src.level, h.src);
    this.knock(fromAng + Math.PI, h.kb ?? 6);
    if (this.state === 'dead') return 'hit';
    this.setState('hurt');
    this.targeting = null;
    this.invuln = 0.65;
    sfx('hurt'); g.pr.addShake(0.6); g.hitstop(0.06);
    flashObj(this.obj, 0.12, 0xff5a5a);
    g.fx.burst(this.x, 0.5, this.z, 8, [0xff5a5a, 0xffffff], 2.5);
    return 'hit';
  }
  // raw = damage in legacy "half-heart" units; scaled by the attacker's level and our armour
  takeDamage(raw, lvl, src) {
    if (this.godMode || this.g.godMode) return;
    const inv = this.inv, g = this.g;
    const L = lvl || g.zoneLevel(this.x, this.z);
    // enemies hit a little harder per level than the base unit, to keep pace with the armour
    // and life that gear adds along the way
    let n = Math.max(1, Math.round(raw * unitAt(L) * (1 + 0.05 * (L - 1)) * 1.05 * g.pstats.dr * g.diffMult()));
    // no unexplained one-shots: a single blow can take at most a set share of your life
    n = Math.min(n, Math.ceil(inv.maxHp * g.hitCap()));
    inv.hp = Math.max(0, inv.hp - n);
    this.lastHit = { by: src ? g.nameOf(src) : 'a fall', lvl: src && src.level, n, raw };
    this.combatT = 4;
    g.ui.float(this.x, 1.1, this.z, '-' + n, '#ff6a6a', false);
    g.ui.hearts(true);
    if (inv.hp <= 0) { this.setState('dead'); g.onPlayerDeath(); }
    else if (inv.hp <= inv.maxHp * 0.25) sfx('low');
  }
  knock(ang, s) { this.kx = Math.sin(ang) * s; this.kz = Math.cos(ang) * s; }
  // rolled through an attack inside the invulnerable window
  perfectDodge(h) {
    const g = this.g;
    if (this.pdT > g.time) return;
    this.pdT = g.time + 0.4;
    g.stats.perfectDodges = (g.stats.perfectDodges || 0) + 1;
    g.fx.ring(this.x, this.z, 0.1, 0.9, 0xdff4ff, 0.25);
    if (g.pstats.uniques.has('stillwater')) { this.stillT = 3; g.ui.float(this.x, 1.3, this.z, 'STILLWATER', '#9ad8ff', false, true); }
    const src = h.src && h.src.isEnemy ? h.src : null;
    if (src && g.pstats.qual.has('temporal_stride')) {
      src.applyStatus && src.applyStatus('root', 0.6); src.stagger = Math.max(src.stagger || 0, 0.6);
      g.fx.ring(src.x, src.z, 0.2, 1.4, 0xc8b0ff, 0.6, 0.05); g.ui.float(src.x, 1.2, src.z, 'STASIS', '#c8b0ff', false, true);
    }
  }

  startAttack() {
    const g = this.g;
    this.combo = this.state === 'attack' && this.combo < 3 ? this.combo + 1 : 1;
    this.setState('attack');
    this.attackId++;
    this.hitSet.clear();
    this.buffer = 0;
    if (this.aiming) this.facing = this.aimDir;
    else { // keyboard fallback: soft aim toward the nearest enemy in front
      const t = g.nearestEnemy(this.x, this.z, 2.4, this.facing, 1.1);
      if (t) this.facing = Math.atan2(t.x - this.x, t.z - this.z);
    }
    sfx(this.combo === 3 ? 'spin' : this.combo === 2 ? 'swing2' : 'swing');
    if (this.family === 'heavy' || this.family === 'oversized') sfx('heavyhit');
    // Thorn Rebuke: the swing after a perfect parry looses a rooting thorn crescent
    if (this.rebukeT > 0 && hasEngraving(g, 'thornrebuke')) {
      this.rebukeT = 0;
      g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: this.facing, speed: 13, range: 7, mult: 2.2, kind: 'crescent', pierce: 99, kb: 5, root: 1, noCraft: true, color: 0x7fd36a }));
      sfx('spin');
    }
    this.lunge = this.combo === 3 ? 4 : 2.5;
  }

  doHits(range, halfAng, mult, kind, kb, ability) {
    this.g.hitArc(this, this.x, this.z, this.facing, range, halfAng, { mult, kind, kb, id: this.attackId, ability });
  }
  // slash-trail tint: rarity of the blade, or its legendary/engraving identity
  trailColor() {
    const w = this.inv.equip.weapon;
    if (!w) return 0xdfe8f0;
    if (w.craft === 'thornrebuke' || w.unique === 'rootcleaver') return 0x7fd36a;
    if (w.unique === 'crescent' || w.unique === 'onigrin') return 0xff4a5a;
    if (w.base === 'moonkatana' || w.base === 'stormedge') return 0x9ad8ff;
    return [0xdfe8f0, 0x9fe88a, 0x7ac0ff, 0xd08aff, 0xffb347][w.r] || 0xdfe8f0;
  }
  // extra melee reach: the weapon's own length plus the Strike Reach affix
  get reach() {
    const w = this.inv.equip.weapon;
    if (!w || RANGED[this.family]) return 0;
    const b = baseById(w.base);
    const len = { nodachi: 0.35, onicleaver: 0.3 }[w.base] ?? (b && b.reach ? Math.max(0, b.reach - 1.25) : 0);
    return len + 1.25 * ((this.g.pstats.reach || 0) / 100);
  }
  basicAttack() {
    if (!this.ranged) return this.startAttack();
    const g = this.g;
    if (this.aiming) this.facing = this.aimDir;
    else { const t = g.nearestEnemy(this.x, this.z, 9, this.facing, 0.5); if (t) this.facing = Math.atan2(t.x - this.x, t.z - this.z); }
    this.setState('shoot'); this.aimT = 0; this.buffer = 0; this.stillSince = this.stillSince ?? this.g.time;
  }
  fireBasic(power) {
    const g = this.g, f = this.facing, w = this.inv.equip.weapon, U = w && w.unique, fam = this.family;
    if (power && hasEngraving(g, 'millwind')) g.gust(this, 1, true);
    let ox = this.x + Math.sin(f) * 0.4, oz = this.z + Math.cos(f) * 0.4;
    if (!g.shotClear(this.x, this.z, ox, oz)) { ox = this.x; oz = this.z; } // hugging a wall: never spawn inside it
    // Stillness keystone: standing still before a charged shot
    const still = power && g.talent('stillness') && g.time - (this.stillSince ?? g.time) > 0.5 ? 1.4 : 1;
    const stillwater = power && this.stillT > 0 ? 1.4 : 1; if (power) this.stillT = 0;
    if (fam === 'bow') {
      this.arrows = (this.arrows || 0) + 1;
      const quiver = !power && g.talent('tempestquiver') && this.arrows % 4 === 0;
      const onHit = (pr, e) => {
        if (U === 'lilypad') e.applyStatus && e.applyStatus('wet', 5);
        if (U === 'spoolstring' && pr.charged) { (pr.tethered || (pr.tethered = [])).push(e); if (pr.tethered.length === 2) g.spawn(new Tether(g, pr.tethered, 0.8, 0.3)); }
        if (U === 'glasswing' && pr.charged) cometShards(g, e.x, e.z, pr.mult * 0.8, 3);
        if (quiver) chainLightning(g, e.x, e.z, 0.8, 3, 5, null);
      };
      if (power) {
        const o = { x: ox, z: oz, dir: f, speed: 24, range: SHOT_RANGE.power, mult: 2.4 * still * stillwater, kind: 'power', pierce: 4, kb: 6, color: 0xffd25e, basic: true, charged: true, onHitFx: onHit };
        if (U === 'lilypad') o.onExplode = null;
        g.spawn(new Projectile(g, o)); sfx('spin'); g.pr.addShake(0.15);
        if (U === 'lilypad') { const tx = ox + Math.sin(f) * 6, tz = oz + Math.cos(f) * 6; setTimeout(() => { if (!g.dead) { soak(g, tx, tz, 2.2); g.fx.ring(tx, tz, 0.2, 2.2, 0x6ab8ff, 0.4); } }, 280); }
        if (hasEngraving(g, 'echofletch')) g.spawn(new EchoShot(g, o));
      }
      else { g.spawn(new Projectile(g, { x: ox, z: oz, dir: f, speed: 19, range: SHOT_RANGE.arrow, mult: g.talent('endlessquiver') ? 0.8 : 1, kind: 'arrow', color: quiver ? 0xfff3b0 : 0xf0e0c0, bounce: g.talent('endlessquiver') ? 1 : 0, element: quiver ? 'lightning' : null, basic: true, onHitFx: onHit })); sfx(quiver ? 'zap' : 'swing'); }
    } else {
      const orb = (w && ({ crookstaff: 0x7fd36a, candlestaff: 0xffb347, hexwand: 0x8b5cf6, frostrod: 0xdff4ff, shroomwand: 0xe05a48, mothlight: 0xfff3b0, porcelainrod: 0x9ad8ff, candelabra: 0xffb347 }[w.base])) || 0xc89aff;
      const boltHit = (pr, e) => {
        if (U === 'mothlight') { const t = g.nearestEnemy(e.x, e.z, 6, 0, Math.PI); if (t && t !== e) { const m = new Projectile(g, { x: e.x, z: e.z, dir: Math.atan2(t.x - e.x, t.z - e.z), speed: 8, range: 6, mult: pr.mult * 0.5, kind: 'bolt', element: 'hex', homing: 3, color: 0xf0ecd8, ability: false }); m.hit.add(e); g.spawn(m); } }
        if (U === 'porcelainrod') { const wet = e.status && e.status.wet > 0; const targets = foes(g, e.x, e.z, wet ? 3.5 : 3).filter(o => o !== e && (!wet || (o.status && o.status.wet > 0) || true)).slice(0, wet ? 5 : 1); for (const o of targets) { bolt(g, e.x, e.z, o.x, o.z); g.playerHit(o, { mult: pr.mult * 0.6, kind: 'shock', kb: 0.5, dir: 0, noShock: true, quiet: true }); } }
      };
      if (power && fam === 'wand') { // wands flick a fan of three bolts instead of a fireball
        for (const da of [-0.22, 0, 0.22]) g.spawn(new Projectile(g, { x: ox, z: oz, dir: f + da, speed: 15, range: SHOT_RANGE.bolt, mult: 0.95 * stillwater, kind: 'bolt', color: orb, basic: true, charged: true, onHitFx: boltHit }));
        sfx('shoot'); sfx('charged');
      } else if (power) {
        const split = U === 'candelabra' ? pr => { for (let i = 0; i < 3; i++) { const a = f + (i - 1) * 0.9; g.spawn(new Projectile(g, { x: pr.x, z: pr.z, dir: a, speed: 9, range: 2.6, mult: pr.mult * 0.4, kind: 'fireball', aoe: 1.1, color: 0xffb347, noCraft: true })); } } : null;
        g.spawn(new Projectile(g, { x: ox, z: oz, dir: f, speed: 11, range: SHOT_RANGE.fireball, mult: 2.2 * stillwater, kind: 'fireball', aoe: 1.7, color: 0xff8a2a, basic: true, charged: true, onExplode: split })); sfx('gale');
      }
      // the bolt 'seeks' only as an explicit, limited property: it bends at most ~20 degrees
      // toward a foe that is already close to the line you aimed (a witch's own staff/wand only)
      else { g.spawn(new Projectile(g, { x: ox, z: oz, dir: f, speed: fam === 'wand' ? 15 : 13, range: SHOT_RANGE.bolt, mult: fam === 'wand' ? 0.8 : 0.95, kind: 'bolt', seek: this.specialist ? { cone: 0.35, rate: 3, range: 6 } : null, color: orb, basic: true, onHitFx: boltHit })); sfx('shoot'); }
    }
  }
  tryAbility() {
    const g = this.g, inp = g.input, inv = this.inv;
    for (let i = 0; i < LOADOUT_SIZE; i++) {
      if (!inp.pressed('ab' + (i + 1))) continue;
      const id = inv.loadout && inv.loadout[i];
      if (!id) { sfx('error'); g.ui.toast('Empty ability slot', 'Assign abilities in the Skills tab (I).', 1.4); return false; }
      const S = SKILLS[id], rank = rankOf(inv, id);
      if (!rank) { sfx('error'); g.ui.toast(S.name + ' is locked', 'Unlock it in the skill tree.', 1.4); return false; }
      if (this.cdOf(id) > 0) { sfx('error'); g.ui.flashSlot && g.ui.flashSlot(i, 'cd'); return false; }
      if (g.res < this.costOf(id)) { sfx('error'); g.ui.flashSlot && g.ui.flashSlot(i, 'res'); g.ui.toast('Not enough ' + CLASSES[this.cls].res, '', 0.8); return false; }
      // with a cursor or right stick, placed abilities show a preview while the key is held
      if (S.target === 'ground' && this.aiming) { this.targeting = { i, id, key: 'ab' + (i + 1), range: S.range, radius: S.radius, def: S.def }; sfx('select'); return true; }
      if (id === 'stormthread') { this.threadKey = 'ab' + (i + 1); }
      return this.castAbility(id, S.target === 'ground' ? this.groundTarget({ id, range: S.range, radius: S.radius, def: S.def }) : null);
    }
    return false;
  }
  costOf(id) { return (id === 'iaido' || id === 'ghostdraw') && this.counterT > 0 ? 0 : SKILLS[id].cost; }
  // costs are only paid once the ability actually goes off
  castAbility(id, at) {
    if (typeof id === 'number') id = this.inv.loadout[id]; // legacy callers pass a slot index
    const g = this.g, S = SKILLS[id], rank = rankOf(this.inv, id);
    if (!S || !rank || this.cdOf(id) > 0 || g.res < this.costOf(id)) { sfx('error'); return false; }
    if (at && !at.ok) { sfx('error'); g.ui.toast('No clear line to that spot', '', 0.9); return false; }
    let first = null;
    if (S.target === 'unit') { first = this.chainTarget(S.range || 7); if (!first) { sfx('error'); g.ui.toast('No target in sight', 'Point at an enemy within range.', 0.9); return false; } }
    g.res -= this.costOf(id);
    const crit = (id === 'iaido' || id === 'ghostdraw') && this.counterT > 0;
    if (id === 'iaido' || id === 'ghostdraw') this.counterT = 0;
    this.cdMap[id] = rankCd(S, rank) * (1 - g.pstats.cdr / 100) * (id === 'nova' && g.talent('conductor') ? 1.3 : 1);
    this.useAbility(id, rankMult(rank), rank, at, first, crit);
    g.guide.event('ability');
    g.stats.abilities = (g.stats.abilities || 0) + 1;
    g.stats['cast:' + id] = (g.stats['cast:' + id] || 0) + 1;
    return true;
  }
  useAbility(id, rm, rank, at, first, crit) {
    const g = this.g, f = this.facing, T = k => g.talent(k);
    if (at) this.facing = Math.atan2(at.x - this.x, at.z - this.z);
    else if (first) this.facing = Math.atan2(first.x - this.x, first.z - this.z);
    else if (this.aiming) { if (!SELF_CAST[id]) this.facing = this.aimDir; }
    else if (id !== 'iaido' && id !== 'galestep' && !SELF_CAST[id]) { const t = g.nearestEnemy(this.x, this.z, 8, f, 0.9); if (t) this.facing = Math.atan2(t.x - this.x, t.z - this.z); }
    const F = this.facing;
    this.castCrit = !!crit;
    switch (id) {
      case 'iaido': this.setState('dash'); this.attackId++; this.hitSet.clear(); this.invuln = 0.35; this.abMult = 2.2 * rm; this.dashFrom = { x: this.x, z: this.z }; sfx('spin'); break;
      case 'tempest': this.setState('tempest'); this.abMult = 0.7 * rm; this.tick = 0; this.tempestDur = 1.3 + 0.3 * T('cuttingwind'); sfx('spin'); break;
      case 'oni': this.setState('oni'); this.abMult = 5 * rm; sfx('windup'); break;
      case 'ghostdraw': this.setState('draw'); this.abMult = 1.6 * rm; sfx('draw'); break;
      case 'threadsever': this.setState('sever'); this.abMult = 0.9 * rm; this.attackId++; this.hitSet.clear(); sfx('swing2'); break;
      case 'galestep': {
        const mv = Math.hypot(g.input.mx, g.input.mz) > 0.1 ? Math.atan2(g.input.mx, g.input.mz) : F;
        this.facing = mv; this.stepFrom = { x: this.x, z: this.z }; this.abMult = 0.5 * rm;
        this.setState('galestep'); this.invuln = Math.max(this.invuln, 0.22); sfx('gust'); break;
      }
      case 'kaze': g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: F, speed: 15, range: 8, mult: 1.6 * rm, kind: 'crescent', element: 'wind', pierce: 99, kb: 5, ability: true, color: 0x9ad8ff })); sfx('gale'); this.setState('cast'); this.castDur = 0.2; g.fx.arc(this.x, 0.35, this.z, F, 1.3, 2.2, 0x9ad8ff, 0.18, 0.4); break;
      case 'bellquake': this.setState('quake'); this.abMult = 2.4 * rm; sfx('windup'); break;
      case 'multishot': { const n = 2 + T('splitvolley'); for (let k = -n; k <= n; k++) g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: F + k * 0.34 / (1 + n * 0.25), speed: 17, range: 9, mult: 0.9 * rm, kind: 'arrow', ability: true, color: 0xf0e0c0 })); sfx('swing2'); this.setState('cast'); break; }
      case 'snare': g.spawn(new Trap(g, at.x, at.z, 3 * rm, 2.2 + 0.3 * rank + 0.5 * T('thornweb'), hasSigil(g, 1, 'echosnare'))); sfx('push'); this.setState('cast'); break;
      case 'rain': { const z = new RainZone(g, at.x, at.z, 0.55 * rm, 2.2 + 0.6 * T('downpour')); z.wet = true; g.spawn(z); sfx('gale'); this.setState('cast'); break; }
      case 'ghostflight': { const o = { x: this.x, z: this.z, dir: F, speed: 22, range: 11, mult: 1.8 * rm, kind: 'power', pierce: 99, kb: 4, ability: true, color: 0xdff4ff, delay: 0.8 }; g.spawn(new Projectile(g, o)); g.spawn(new EchoShot(g, { ...o, mult: o.mult * 1.15 })); sfx('spin'); this.setState('cast'); this.castDur = 0.25; break; }
      case 'tether': {
        const members = [first, ...foes(g, first.x, first.z, 4).filter(e => e !== first && !e.isBoss).sort((a, b) => Math.hypot(a.x - first.x, a.z - first.z) - Math.hypot(b.x - first.x, b.z - first.z)).slice(0, 2)];
        const share = 0.3 + 0.15 * T('sharedpain') + (g.pstats.uniques.has('briarbond') ? 0.2 : 0);
        if (members.length >= 2) g.spawn(new Tether(g, members, 1.2 * rm, share)); else first.applyStatus && first.applyStatus('root', 1.5);
        bolt(g, this.x, this.z, first.x, first.z); this.setState('cast'); break;
      }
      case 'ricochet': g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: F, speed: 20, range: 9, mult: 1.1 * rm, kind: 'arrow', bounce: 3 + rank, kb: 3, ability: true, color: 0xffd25e })); sfx('swing2'); this.setState('cast'); break;
      case 'stormpin': g.spawn(new StormPins(g, at.x, at.z, 0.5 * rm)); this.setState('cast'); break;
      case 'needlerain': g.spawn(new NeedleRain(g, at.x, at.z, 0.5 * rm, 1.3)); this.setState('cast'); break;
      case 'nova': frostNova(g, this.x, this.z, 1.2 * rm, 1.8 + 0.3 * rank + 0.4 * T('deepfreeze')); if (hasSigil(g, 0, 'rimebloom')) g.spawn(new RimeField(g, this.x, this.z)); this.setState('cast'); break;
      case 'chain': chainLightning(g, this.x, this.z, 1.7 * rm, 4 + rank + T('forkedbolt'), 7, first); this.setState('cast'); break;
      case 'familiar': { for (const e of g.entities) if (e.isFamiliar) e.remove(); const u = g.pstats.uniques.has('owlhollow'); g.spawn(new Familiar(g, 0.6 * rm, u ? 1e9 : 12 + 2 * rank, u)); sfx('spawn'); this.setState('cast'); break; }
      case 'embergarden': { const a0 = F; for (let k = 0; k < 3; k++) { const a = a0 + k * 2.094, x = at.x + Math.sin(a) * 1.1, z = at.z + Math.cos(a) * 1.1; const ok = g.shotClear(at.x, at.z, x, z); g.spawn(new GardenSeed(g, ok ? x : at.x, ok ? z : at.z, 1.3 * rm)); } sfx('push'); this.setState('cast'); break; }
      case 'glasscomet': this.setState('comet'); this.abMult = 2.6 * rm; sfx('charge'); break;
      case 'stormthread': this.setState('thread'); this.threadTarget = first; this.abMult = 0.3 * rm; this.tick = 0; this.threadT = 0; break;
      case 'witherhex': g.spawn(new HexCurse(g, first, 2.2 * rm)); this.setState('cast'); break;
      case 'mothstorm': { const K = T('mothcovenant'); g.spawn(new MothSwarm(g, at.x, at.z, 0.3 * rm, 2, K ? 8 : 4, K ? 3.6 : 1.8)); this.setState('cast'); break; }
    }
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
    const ps = g.pstats;
    for (const k in this.cdMap) if (this.cdMap[k] > 0) this.cdMap[k] = Math.max(0, this.cdMap[k] - dt);
    this.counterT = Math.max(0, (this.counterT || 0) - dt); this.stillT = Math.max(0, (this.stillT || 0) - dt);
    if (mlen > 0.1 && this.state !== 'aim') this.stillSince = g.time;
    this.rebukeT = Math.max(0, (this.rebukeT || 0) - dt);
    this.combatT = Math.max(0, (this.combatT || 0) - dt);
    // resource & regen
    g.res = Math.min(100, g.res + ps.resRegenRate * dt);
    // Passive recovery never replaces tonics: out of combat you catch your breath back up to
    // 40% of your life; gear regen and the Mossheart still work, at a reduced rate in a fight.
    const breath = this.combatT > 0 || inv.hp >= inv.maxHp * 0.4 ? 0 : inv.maxHp * 0.01;
    const regen = ps.regen * (this.combatT > 0 ? 0.5 : 1) + (ps.uniques.has('mossheart') ? inv.maxHp * (this.combatT > 0 ? 0.004 : 0.012) : 0) + breath;
    if (inv.hp > 0 && inv.hp < inv.maxHp && regen > 0) { inv.hp = Math.min(inv.maxHp, inv.hp + regen * dt); this.regenAcc = (this.regenAcc || 0) + dt; if (this.regenAcc > 0.5) { this.regenAcc = 0; g.ui.hearts(); } }
    const aspd = ps.wspd;
    this.updateAim();
    // held ground-target preview: release (or click) to place it, roll/guard to cancel
    if (this.targeting) {
      const tg = this.targeting;
      if (locked || s === 'dead' || s === 'hurt' || s === 'fall' || inp.pressed('roll') || inp.pressed('shield')) this.targeting = null;
      else if (!inp.down(tg.key) || inp.pressed('attack')) {
        if (inp.pressed('attack')) inp.consume('attack');
        this.targeting = null;
        if (s === 'move' || s === 'cast' || s === 'shoot') this.castAbility(tg.id, this.groundTarget(tg));
      }
    }

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
      if (inp.pressed('potion') && (s === 'move' || s === 'cast' || s === 'block') && g.canDrink()) { this.setState('drink'); this.drank = false; }
      if (inp.pressed('surge') && g.surge >= 100 && s !== 'surge') { this.setState('surge'); this.invuln = 0.9; sfx('roll'); }
    }

    switch (s) {
      case 'move': {
        speed = ps.speed * (1 + (g.quickT > g.time ? 0.05 * (g.quickStacks || 0) : 0) + (g.thornstepT > g.time ? 0.25 : 0));
        if (mlen > 0.1) this.facing = angleLerp(this.facing, Math.atan2(mx, mz), Math.min(1, dt * 18));
        if (!locked) {
          if (inp.pressed('attack') && !this.targeting) { this.basicAttack(); break; }
          if (this.tryAbility()) break;
          if (inp.pressed('roll') && this.rollCd <= 0) { this.startRoll(mx, mz, mlen); break; }
          if (inp.down('shield')) { this.setState('block'); this.blockT = 0; g.guide.event('guard'); break; }
          if (inp.pressed('item') && inv.bellows) { this.setState('item'); this.itemT = 0; break; }
          if (inp.pressed('interact')) g.interact();
        }
        break;
      }
      case 'attack': {
        this.st += dt * (aspd - 1);
        const dur = this.combo === 3 ? 0.42 : 0.3;
        const W = this.inv.equip.weapon, WU = W && W.unique;
        speed = 0;
        const lungeT = this.combo === 3 ? 0.18 : 0.1;
        if (this.st < lungeT) { vx = Math.sin(this.facing) * this.lunge; vz = Math.cos(this.facing) * this.lunge; }
        if (this.combo < 3 && this.st > 0.04 && this.st < 0.16) this.doHits(1.25 + this.reach, 1.15, 1, this.family === 'heavy' || this.family === 'oversized' ? 'slam' : 'sword', 4);
        if (this.combo === 3 && WU === 'hatpin') { if (this.st > 0.08 && this.st < 0.22) this.doHits(2.2 + this.reach, 0.35, 1.5, 'lunge', 5); }
        else if (this.combo === 3 && this.st > 0.08 && this.st < 0.3) this.doHits(1.45 + this.reach, Math.PI, 1.5, 'spin3', 7);
        if (this.combo === 3 && this.st > 0.1 && !this.sig3) {
          this.sig3 = true;
          if (WU === 'wickblade') g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: this.facing, speed: 11, range: 5, mult: 1.2, kind: 'crescent', pierce: 99, kb: 3, color: 0xff8a2a, element: 'fire', noCraft: true, onHitFx: (pr, e) => e.applyStatus && e.applyStatus('burn', 3, 2) }));
          if (WU === 'teaspoon') { sfx('bonk'); for (const e of foes(g, this.x, this.z, 2.8)) { if (e.isBoss) continue; const a = Math.atan2(this.x - e.x, this.z - e.z); e.kx += Math.sin(a + 1.2) * 7; e.kz += Math.cos(a + 1.2) * 7; } g.fx.ring(this.x, this.z, 0.4, 2.8, 0xe8e0c8, 0.5, 0.05); g.ui.float(this.x, 1.5, this.z, 'ROYAL STIR', '#fff3b0', false, true); }
        }
        if (this.combo === 3 && this.st > 0.1 && !this.cres && g.pstats.uniques.has('crescent')) { this.cres = true; g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: this.facing, speed: 12, range: 7, mult: 1.6, kind: 'crescent', pierce: 99, kb: 5, color: 0xff6a6a })); }
        if (this.st > 0.03 && this.st < 0.05 && !this.arcDone) {
          this.arcDone = true;
          const tc = this.trailColor();
          if (this.combo === 3) { g.fx.arc(this.x, 0.35, this.z, this.facing, 1.45, Math.PI * 2, 0xffffff, 0.22, 0.4, true); g.fx.arc(this.x, 0.38, this.z, this.facing, 1.6, Math.PI * 2, tc, 0.3, 0.14, true); }
          else { g.fx.arc(this.x, 0.35, this.z, this.facing + (this.combo === 1 ? 0.2 : -0.2), 1.2, 2.2, 0xffffff, 0.14, 0.35); g.fx.arc(this.x, 0.37, this.z, this.facing + (this.combo === 1 ? 0.2 : -0.2), 1.34, 2.0, tc, 0.2, 0.12); }
          // grass clippings fly from a swing through the meadow
          const tt = g.tileAt(Math.floor(this.x + Math.sin(this.facing)), Math.floor(this.z + Math.cos(this.facing)));
          if (tt === T.GRASS || tt === T.FLOWERS || tt === T.FOREST) for (let i = 0; i < 6; i++) { const a = this.facing + (Math.random() - 0.5) * 2; g.fx.add({ x: this.x + Math.sin(a) * 0.9, y: 0.08, z: this.z + Math.cos(a) * 0.9, vx: Math.sin(a) * 2, vz: Math.cos(a) * 2, vy: 1.5 + Math.random() * 1.5, color: tt === T.FLOWERS && i % 3 === 0 ? 0xf06a8a : i % 2 ? 0x7ccb52 : 0x5aa83a, life: 0.6, size: 0.05, g: 7 }); }
        }
        if (!locked && inp.pressed('attack')) this.buffer = 0.25;
        this.buffer -= dt;
        if (this.st > 0.14 && this.buffer > 0 && this.combo < 3) { this.arcDone = false; this.sig3 = false; if (mlen > 0.1 && !this.aiming) this.facing = Math.atan2(mx, mz); this.startAttack(); break; }
        if (this.st > 0.12 && !locked && this.tryAbility()) { this.arcDone = false; break; }
        if (this.st > 0.12 && !locked && inp.pressed('roll')) { this.arcDone = false; this.startRoll(mx, mz, mlen); break; }
        if (this.st >= dur) {
          this.arcDone = false; this.cres = false; this.sig3 = false;
          if (inp.down('attack') && this.combo === 1 && !locked) { this.setState('charge'); this.chargeT = 0; }
          else this.setState('move');
        }
        break;
      }
      case 'shoot': {
        // bow drawn / staff raised. Let go early for a quick shot the moment you release;
        // keep holding to start charging. Movement stays free in every direction.
        speed = 2.6;
        this.faceAim();
        if (!inp.down('attack') || locked) { this.fireBasic(false); this.setState('cast'); this.castDur = 0.2 / aspd; break; }
        if (this.st * aspd >= 0.16) { this.setState('aim'); this.aimT = 0; }
        break;
      }
      case 'aim': {
        speed = 2.0;
        this.aimT += dt;
        const ct = this.chargeTimeNow;
        if (g.talent('stillness')) speed = 1.6;
        if (this.aiming) this.facing = this.aimDir; // aim keeps tracking the cursor/stick while charging
        else {
          const t = g.nearestEnemy(this.x, this.z, 10, this.facing, 0.6);
          if (mlen > 0.1) this.facing = angleLerp(this.facing, Math.atan2(mx, mz), Math.min(1, dt * 8)); else if (t) this.facing = angleLerp(this.facing, Math.atan2(t.x - this.x, t.z - this.z), Math.min(1, dt * 8));
        }
        const bowish = this.family === 'bow';
        if (this.aimT >= ct && this.aimT - dt < ct) { sfx('charged'); g.fx.ring(this.x, this.z, 0.2, 0.8, bowish ? 0xffd25e : 0xff8a2a, 0.25); }
        // gathering power: motes spiral into the staff tip / bow string while charging
        if (Math.random() < 0.6) { const k = Math.min(1, this.aimT / ct), a = this.aimT * 9 + Math.random(), R = 0.6 * (1 - k) + 0.12; const hx = this.x + Math.sin(this.facing) * 0.35, hz = this.z + Math.cos(this.facing) * 0.35; g.fx.add({ x: hx + Math.cos(a) * R, y: 0.55 + Math.sin(a * 1.3) * 0.15, z: hz + Math.sin(a) * R, vx: -Math.cos(a) * R * 2, vz: -Math.sin(a) * R * 2, g: 0, drag: 0, color: bowish ? (k >= 1 ? 0xffd25e : 0xfff3b0) : (k >= 1 ? 0xff8a2a : 0xc89aff), life: 0.25, size: 0.045 }); }
        if (this.aimT >= ct && Math.random() < 0.4) g.fx.add({ x: this.x + Math.sin(this.facing) * 0.5, y: 0.5, z: this.z + Math.cos(this.facing) * 0.5, vy: 0.5, g: 0, color: bowish ? 0xffd25e : 0xff8a2a, life: 0.3, size: 0.05 });
        if (inp.pressed('roll')) { this.startRoll(mx, mz, mlen); break; } // roll out of a charge: the shot is simply not fired
        if (!inp.down('attack') || locked) { const full = this.aimT >= ct; if (full) g.guide.event('charge'); this.fireBasic(full); this.setState('cast'); this.castDur = full ? 0.3 : 0.2 / aspd; }
        break;
      }
      case 'cast': {
        speed = 2.2;
        if (!locked && inp.pressed('attack')) this.buffer = 0.3;
        this.buffer -= dt;
        if (!locked && this.st > 0.08) {
          if (inp.pressed('roll')) { this.startRoll(mx, mz, mlen); break; }
          if (this.tryAbility()) break;
        }
        if (this.st > (this.castDur || 0.2)) {
          this.castDur = 0;
          if (this.buffer > 0 && this.ranged && !locked) { this.basicAttack(); break; }
          this.setState('move');
        }
        break;
      }
      case 'dash': {
        const k = this.st / 0.26;
        vx = Math.sin(this.facing) * 19; vz = Math.cos(this.facing) * 19;
        this.doHits(1.1, Math.PI, this.abMult, 'dash', 6, true);
        if (Math.random() < 0.8) g.fx.add({ x: this.x, y: 0.4, z: this.z, color: 0xffffff, life: 0.25, size: 0.08, g: 0 });
        if (k >= 1) {
          this.setState('move'); g.fx.arc(this.x, 0.35, this.z, this.facing, 1.3, 2.4, 0xffffff, 0.18, 0.4);
          if (hasSigil(g, 0, 'returningcut') && this.dashFrom) g.spawn(new IaidoEcho(g, this.dashFrom.x, this.dashFrom.z, this.x, this.z, this.abMult * 0.7));
        }
        break;
      }
      case 'tempest': {
        speed = 2.6;
        this.tick -= dt;
        if (this.tick <= 0) { this.tick = 0.18; this.attackId++; this.hitSet.clear(); g.hitArc(this, this.x, this.z, this.facing, 2.2, Math.PI, { mult: this.abMult, kind: 'spin', element: 'wind', kb: 3, id: this.attackId, ability: true }); g.fx.arc(this.x, 0.3, this.z, 0, 2.2, 0, 0xdff4ff, 0.15, 0.5, true); sfx('swing'); }
        if (g.talent('cuttingwind')) for (const e of foes(g, this.x, this.z, 3.2)) { if (e.isBoss) continue; const a = Math.atan2(this.x - e.x, this.z - e.z); e.kx += Math.sin(a) * 14 * dt; e.kz += Math.cos(a) * 14 * dt; }
        if (this.st > (this.tempestDur || 1.3)) this.setState('move');
        break;
      }
      case 'oni': {
        speed = 0;
        if (this.st > 0.35 && !this.oniDone) {
          this.oniDone = true; this.attackId++; this.hitSet.clear();
          this.doHits(3.4 + this.reach, 1.1, this.abMult, 'spin', 12, true);
          g.fx.arc(this.x, 0.4, this.z, this.facing, 3.4, 2.2, 0xff6a5a, 0.3, 1.4);
          g.fx.ring(this.x + Math.sin(this.facing) * 2, this.z + Math.cos(this.facing) * 2, 0.3, 2.5, 0xff6a5a, 0.4);
          g.pr.addShake(0.9); sfx('heavyhit'); sfx('thud'); g.hitstop(0.08);
          if (g.talent('bellofruin')) { const cx = this.x + Math.sin(this.facing) * 2, cz = this.z + Math.cos(this.facing) * 2; setTimeout(() => { if (this.g.area) resonanceRing(g, cx, cz, 2.6, this.abMult * 0.35); }, 380); }
        }
        if (this.st > 0.65) { this.oniDone = false; this.setState('move'); }
        break;
      }
      case 'draw': { // Ghostdraw: a still instant, then the cut, then the Echo steps out
        speed = 0;
        if (this.st > 0.12 && !this.drawn) {
          this.drawn = true; this.attackId++; this.hitSet.clear();
          const crit = this.castCrit || (this.parryT && g.time - this.parryT < 0.5);
          g.hitArc(this, this.x, this.z, this.facing, 1.7 + this.reach, 1.0, { mult: this.abMult, kind: 'sword', kb: 5, id: this.attackId, ability: true, forceCrit: crit });
          g.fx.arc(this.x, 0.38, this.z, this.facing, 1.7, 2.2, 0xffffff, 0.12, 0.3); g.fx.arc(this.x, 0.4, this.z, this.facing, 1.9, 1.8, 0x9ad8ff, 0.2, 0.12);
          g.spawn(new GhostBlade(g, this.x, this.z, this.facing, this.abMult * 0.9, crit)); sfx('swing2'); g.hitstop(0.04);
        }
        if (this.st > 0.3) { this.drawn = false; this.setState('move'); }
        break;
      }
      case 'sever': {
        speed = 0.8;
        if (this.st > 0.05 && this.sevN !== 1 && this.st < 0.15) { this.sevN = 1; this.doHits(1.6 + this.reach, 0.9, this.abMult, 'sword', 3, true); g.fx.arc(this.x, 0.4, this.z, this.facing + 0.5, 1.6, 1.8, 0xfff3b0, 0.15, 0.25); sfx('swing'); }
        if (this.st > 0.18 && this.sevN === 1) { this.sevN = 2; this.attackId++; this.hitSet.clear(); this.doHits(1.6 + this.reach, 0.9, this.abMult, 'sword', 3, true); g.fx.arc(this.x, 0.4, this.z, this.facing - 0.5, 1.6, 1.8, 0xfff3b0, 0.15, 0.25); sfx('swing2'); g.spawn(new SeverLine(g, this.x, this.z, this.facing, this.abMult)); }
        if (this.st > 0.35) { this.sevN = 0; this.setState('move'); }
        break;
      }
      case 'galestep': {
        const k = this.st / 0.2;
        vx = Math.sin(this.facing) * 16; vz = Math.cos(this.facing) * 16;
        if (Math.random() < 0.8) g.fx.add({ x: this.x, y: 0.35, z: this.z, color: 0xdff8ff, life: 0.3, size: 0.07, g: 0, soft: true, grow: 1.5 });
        if (k >= 1) {
          const from = this.stepFrom; this.setState('move');
          g.spawn(new WindTrail(g, from.x, from.z, this.x, this.z, this.abMult));
          if (g.talent('echosteps')) { const x1 = this.x, z1 = this.z, m = this.abMult; setTimeout(() => { if (g.area) { g.spawn(new WindTrail(g, from.x, from.z, x1, z1, m * 1.2, true)); g.spawn(new GhostBlade(g, from.x, from.z, Math.atan2(x1 - from.x, z1 - from.z), m, false)); } }, 600); }
        }
        break;
      }
      case 'quake': {
        speed = 0;
        if (this.st > 0.35 && !this.quaked) {
          this.quaked = true;
          const cx = this.x + Math.sin(this.facing) * 1.0, cz = this.z + Math.cos(this.facing) * 1.0;
          resonanceRing(g, cx, cz, 2.2, this.abMult);
          g.pr.addShake(0.8); sfx('quake'); g.hitstop(0.07);
          for (let i = 0; i < 3; i++) { const d = 1.9 + i * 1.2; const x = this.x + Math.sin(this.facing) * d, z = this.z + Math.cos(this.facing) * d; if (!g.shotClear(this.x, this.z, x, z)) break; g.spawn(new Rupture(g, x, z, 0.35 + i * 0.15, 1.1, this.abMult * 0.7)); }
          if (g.talent('bellofruin')) setTimeout(() => { if (g.area) resonanceRing(g, cx, cz, 3.0, this.abMult * 0.5); }, 420);
        }
        if (this.st > 0.6) { this.quaked = false; this.setState('move'); }
        break;
      }
      case 'comet': { // gathering molten glass above the staff, then the throw
        speed = 1.2; this.faceAim();
        if (Math.random() < 0.8) { const a = Math.random() * 6.28; g.fx.add({ x: this.x + Math.cos(a) * 0.9, y: 1.2, z: this.z + Math.sin(a) * 0.9, vx: -Math.cos(a) * 2, vz: -Math.sin(a) * 2, g: 0, color: Math.random() < 0.5 ? 0xff9a5a : 0xbfe8f0, life: 0.3, size: 0.06 }); }
        if (this.st > 0.45) {
          const n = 6 + 2 * g.talent('shatterglass'), m = this.abMult;
          g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: this.facing, speed: 9, range: 8, mult: m, kind: 'comet', aoe: 1.6, color: 0xff9a5a, ability: true, onExplode: pr => cometShards(g, pr.x, pr.z, m, n) }));
          sfx('gale'); g.pr.addShake(0.2); this.setState('cast'); this.castDur = 0.25;
        }
        break;
      }
      case 'thread': { // Storm Thread: held; grows stronger, drains Mana
        speed = 1.4;
        const e = this.threadTarget;
        this.threadT += dt; this.tick -= dt;
        const held = this.threadKey ? inp.down(this.threadKey) : true;
        if (!e || e.dead || !held || locked || this.threadT > 3 || Math.hypot(e.x - this.x, e.z - this.z) > 8 || !g.shotClear(this.x, this.z, e.x, e.z) || g.res <= 0) { this.threadTarget = null; this.setState('move'); break; }
        this.facing = Math.atan2(e.x - this.x, e.z - this.z);
        g.res = Math.max(0, g.res - 10 * dt);
        if (Math.random() < 0.5) bolt(g, this.x + Math.sin(this.facing) * 0.4, this.z + Math.cos(this.facing) * 0.4, e.x, e.z);
        if (this.tick <= 0) { this.tick = 0.2; threadTick(g, this, e, this.threadT, this.abMult); }
        if (inp.pressed('roll')) this.startRoll(mx, mz, mlen);
        break;
      }
      case 'charge': {
        speed = 2.2;
        this.chargeT += dt;
        if (Math.floor((this.chargeT - dt) * 8) !== Math.floor(this.chargeT * 8) && this.chargeT < 0.7) sfx('charge');
        if (this.chargeT >= 0.7 && this.chargeT - dt < 0.7) { sfx('charged'); g.fx.burst(this.x, 0.6, this.z, 10, 0xfff3b0, 1.5, { g: 0 }); }
        if (this.chargeT >= 0.7 && Math.random() < 0.4) g.fx.add({ x: this.x + Math.sin(this.facing + 0.8) * 0.4, y: 0.5 + Math.random() * 0.3, z: this.z + Math.cos(this.facing + 0.8) * 0.4, vy: 1, g: 0, color: 0xfff3b0, life: 0.3, size: 0.05 });
        if (!inp.down('attack') || locked) {
          if (this.chargeT >= 0.7 || this.stillT > 0) { g.guide.event('charge'); this.faceAim(); if (hasEngraving(g, 'millwind')) g.gust(this, 1, true); this.spinMult = (1 + 0.2 * g.talent('tollingweight')) * (this.stillT > 0 ? 1.4 : 1); this.stillT = 0; const WU = this.inv.equip.weapon && this.inv.equip.weapon.unique; if (WU === 'bellclapper') resonanceRing(g, this.x, this.z, 3, 1.5); if (WU === 'parasol') { soak(g, this.x, this.z, 2.6); g.fx.ring(this.x, this.z, 0.2, 2.6, 0x6ab8ff, 0.4); } this.setState('spin'); this.attackId++; this.hitSet.clear(); sfx('spin'); g.fx.arc(this.x, 0.3, this.z, 0, 1.9, 0, 0xfff3b0, 0.3, 0.6, true); g.fx.ring(this.x, this.z, 0.5, 2.2, 0xfff3b0, 0.3, 0.2); }
          else this.setState('move');
        }
        break;
      }
      case 'spin': {
        speed = 1.5;
        if (this.st < 0.35) this.doHits((1.95 + this.reach) * (1 + 0.1 * g.talent('tollingweight')), Math.PI, 2.5 * (this.spinMult || 1), 'spin', 9);
        if (this.st >= 0.45) this.setState('move');
        break;
      }
      case 'roll': {
        const k = this.st / 0.34;
        const sp = 10.5 * (1 - k * 0.6);
        vx = Math.sin(this.rollDir) * sp; vz = Math.cos(this.rollDir) * sp;
        if (Math.random() < 0.5) g.fx.dust(this.x, this.z, 1);
        if (g.talent('endlessgale')) { if (this.st < 0.02) { this.attackId++; this.hitSet.clear(); } this.doHits(0.7, Math.PI, 0.8, 'wind', 2, true); }
        if (this.st >= 0.34) { this.setState('move'); this.rollCd = g.talent('endlessgale') ? 0.06 : 0.12; this.lastRollEnd = g.time; if (g.talent('secondwind')) g.res = Math.min(100, g.res + 6 * g.talent('secondwind')); }
        break;
      }
      case 'block': {
        speed = 2.2;
        this.blockT += dt;
        if (this.aiming) this.facing = this.aimDir; // guard toward the cursor/stick
        if (!inp.down('shield') || locked) this.setState('move');
        else if (inp.pressed('roll')) this.startRoll(mx, mz, mlen);
        else if (inp.pressed('attack')) this.basicAttack(); // each class attacks its own way out of a guard
        break;
      }
      case 'item': {
        speed = 1.8;
        this.itemT += dt;
        if (this.aiming) this.facing = this.aimDir;
        else if (mlen > 0.1) this.facing = angleLerp(this.facing, Math.atan2(mx, mz), Math.min(1, dt * 10));
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
      case 'drink': { // a committed sip: slow, can't attack or roll until it's down
        speed = 1.4;
        if (!this.drank && this.st > 0.35) { this.drank = true; g.drinkPotion(); }
        if (this.st > 0.6) this.setState('move');
        break;
      }
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
    const w = inv.equip.weapon;
    if (w && w.r >= 3 && Math.random() < (w.r === 4 ? 0.5 : 0.25)) {
      const hand = new THREE.Vector3(); (this.m.offhand.children.length ? this.m.offhand : this.m.sword).getWorldPosition(hand);
      g.fx.add({ x: hand.x + (Math.random() - 0.5) * 0.3, y: hand.y + Math.random() * 0.4, z: hand.z + (Math.random() - 0.5) * 0.3, vy: 0.6, g: 0, color: w.r === 4 ? 0xff9a2a : 0xc46bff, life: 0.5, size: 0.04 });
    }
    this.sync();
  }

  animate(dt, speed) {
    const m = this.m, s = this.state, t = this.g.time, fam = this.family;
    const twoHand = fam === 'heavy' || fam === 'oversized';
    this.obj.rotation.y = this.facing;
    // reset
    m.body.rotation.set(0, 0, 0); m.body.position.set(0, 0, 0); m.body.scale.set(1, 1, 1);
    m.armR.rotation.set(0, 0, 0); m.armL.rotation.set(0, 0, 0); m.legL.rotation.set(0, 0, 0); m.legR.rotation.set(0, 0, 0);
    m.head.rotation.set(0, 0, 0);
    m.sword.rotation.set(fam === 'staff' || fam === 'wand' ? 0.25 : Math.PI / 2 * 0.9, 0, 0);
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
        if (twoHand && this.combo < 3) {
          // two-handed: a real wind-up over the shoulder, contact at the hit window, follow-through low
          const wind = Math.min(1, k * 6), swing = Math.max(0, Math.min(1, (k - 0.12) * 2.6));
          if (this.combo === 1) { m.armR.rotation.x = -2.8 * wind + swing * 3.4; m.armL.rotation.x = m.armR.rotation.x; m.armL.rotation.z = -0.5; m.armR.rotation.z = 0.3; m.sword.rotation.x = 1.3; m.body.rotation.x = -0.25 * wind + swing * 0.5; }
          else { m.body.rotation.y = -1.1 + swing * 2.2; m.armR.rotation.x = -1.5; m.armL.rotation.x = -1.4; m.armL.rotation.z = -0.6; m.armR.rotation.z = -0.2; m.sword.rotation.x = 1.5; }
          m.legL.rotation.x = 0.5; m.legR.rotation.x = -0.5;
          if (swing > 0.5 && swing < 0.7) m.body.position.y = -0.03;
          break;
        }
        if (this.combo === 3 && this.inv.equip.weapon && this.inv.equip.weapon.unique === 'hatpin') { m.armR.rotation.x = -1.6; m.armR.rotation.z = 0; m.sword.rotation.x = 1.57; m.body.rotation.x = 0.35; m.legL.rotation.x = 0.8; m.legR.rotation.x = -0.7; m.body.position.z = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.12; break; }
        if (this.combo === 1) { m.body.rotation.y = 0.9 - Math.min(1, k * 3) * 1.8; m.armR.rotation.x = -1.4; m.armR.rotation.z = 0.4; m.sword.rotation.x = 1.5; }
        else if (this.combo === 2) { m.body.rotation.y = -0.9 + Math.min(1, k * 3) * 1.8; m.armR.rotation.x = -1.4; m.armR.rotation.z = -0.3; m.sword.rotation.x = 1.5; }
        else { m.body.rotation.y = -Math.min(1, k * 1.6) * Math.PI * 2; m.armR.rotation.x = -1.5; m.armR.rotation.z = 1.2; m.sword.rotation.x = 1.5; m.body.position.y = Math.sin(Math.min(1, k * 1.5) * Math.PI) * 0.15; }
        m.legL.rotation.x = 0.5; m.legR.rotation.x = -0.4;
        m.body.rotation.x = 0.15;
        break;
      }
      case 'charge': {
        m.armR.rotation.x = -2.6; m.armR.rotation.z = 0.3; m.sword.rotation.x = 0.4;
        if (twoHand) { m.armL.rotation.x = -2.5; m.armL.rotation.z = -0.4; m.body.rotation.x = -0.15; }
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
        m.armL.rotation.x = -1.4; m.armL.rotation.y = 0.5;
        if (fam === 'blade' || twoHand) { m.armR.rotation.x = -1.4; m.armR.rotation.z = 0.9; m.sword.rotation.x = 1.4; m.sword.rotation.z = 1.2; if (twoHand) { m.armL.rotation.x = -1.3; m.armL.rotation.z = -0.3; } } else { m.armR.rotation.x = -1.3; m.armR.rotation.z = 0.5; }
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
      case 'shoot': case 'aim': case 'cast': {
        if (fam === 'bow') { m.armL.rotation.x = -1.55; m.armR.rotation.x = -1.4; m.armR.rotation.z = -0.5 - (s === 'aim' ? Math.min(0.5, this.aimT) : 0); m.body.rotation.y = 0.35; }
        else if (fam === 'wand') { const flick = s === 'cast' ? Math.max(0, 1 - this.st * 8) : 0; m.armR.rotation.x = s === 'aim' ? -2.0 : -1.5 - flick * 0.8; m.armR.rotation.z = s === 'aim' ? 0.3 + Math.sin(t * 20) * 0.05 : 0.15; m.armL.rotation.x = -0.3; m.armL.rotation.z = 0.4; m.body.rotation.y = -0.2; }
        else if (fam === 'staff') { m.armR.rotation.x = s === 'aim' ? -2.6 : -1.7; m.armL.rotation.x = s === 'aim' ? -1.2 : -0.6; m.armL.rotation.z = s === 'aim' ? 0.5 : 0; m.body.rotation.x = s === 'cast' ? 0.12 : s === 'aim' ? -0.08 : 0; }
        else { m.armR.rotation.x = -1.6; m.armL.rotation.x = -1.2; m.body.rotation.x = 0.1; } // melee weapon: a thrown casting gesture
        if (s === 'aim' && this.aimT > 0.6) m.body.position.x = Math.sin(t * 60) * 0.008;
        break;
      }
      case 'draw': { const k = Math.min(1, this.st / 0.12); if (this.st < 0.12) { m.armR.rotation.x = -0.5 * k; m.armR.rotation.z = 0.8 * k; m.sword.rotation.x = 1.5; m.body.rotation.y = 0.6 * k; m.body.position.y = -0.04 * k; } else { m.armR.rotation.x = -1.5; m.armR.rotation.z = -0.9; m.sword.rotation.x = 1.5; m.body.rotation.y = -0.7; m.legL.rotation.x = 0.6; m.legR.rotation.x = -0.5; } break; }
      case 'sever': { const k = this.st / 0.35; m.body.rotation.y = k < 0.5 ? 0.8 - k * 3.2 : -0.8 + (k - 0.5) * 3.2; m.armR.rotation.x = -1.5; m.armR.rotation.z = k < 0.5 ? 0.6 : -0.6; m.sword.rotation.x = 1.5; break; }
      case 'galestep': m.body.rotation.x = 0.5; m.armR.rotation.x = 0.6; m.armL.rotation.x = 0.6; m.legL.rotation.x = -0.6; m.legR.rotation.x = 0.8; m.body.position.y = 0.08; break;
      case 'quake': { const k = Math.min(1, this.st / 0.35); if (this.st < 0.35) { m.armR.rotation.x = -3.0 * k; m.armL.rotation.x = -3.0 * k; m.body.position.y = k * 0.3; m.body.rotation.x = -0.3 * k; } else { m.armR.rotation.x = -0.3; m.armL.rotation.x = -0.3; m.body.rotation.x = 0.6; m.body.position.y = -0.05; m.legL.rotation.x = 0.7; m.legR.rotation.x = -0.6; } m.sword.rotation.x = 1.5; break; }
      case 'comet': m.armR.rotation.x = -3.0; m.armL.rotation.x = -2.8; m.armR.rotation.z = -0.3; m.armL.rotation.z = 0.3; m.body.rotation.x = -0.12; m.head.rotation.x = -0.3; if (this.st > 0.3) m.body.position.x = Math.sin(t * 60) * 0.01; break;
      case 'thread': m.armR.rotation.x = -1.6; m.armR.rotation.z = Math.sin(t * 40) * 0.05; m.armL.rotation.x = -1.2; m.armL.rotation.z = 0.5; m.body.rotation.x = 0.1; break;
      case 'dash': m.body.rotation.x = 0.6; m.armR.rotation.x = -1.5; m.armR.rotation.z = 1.2; m.body.position.y = 0.05; break;
      case 'tempest': m.body.rotation.y = -this.st * 30; m.armR.rotation.x = -1.5; m.armR.rotation.z = 1.4; m.armL.rotation.z = -1.2; break;
      case 'oni': { const k = Math.min(1, this.st / 0.35); if (this.st < 0.35) { m.armR.rotation.x = -3.0 * k; m.armL.rotation.x = -3.0 * k; m.body.rotation.x = -0.25 * k; m.body.position.y = k * 0.25; } else { m.armR.rotation.x = -0.6; m.armL.rotation.x = -0.6; m.body.rotation.x = 0.5; } break; }
      case 'hurt': { const k = Math.max(0, 1 - this.st / 0.28); m.body.rotation.x = -0.45 * k; m.head.rotation.x = -0.35 * k; m.armL.rotation.x = -0.9 * k; m.armR.rotation.x = -0.6 * k; m.armL.rotation.z = 0.5 * k; m.body.position.y = -0.03 * k; break; }
      case 'drink': { const k = Math.min(1, this.st / 0.3); m.armR.rotation.x = -2.2 * k; m.head.rotation.x = -0.35 * k; break; }
      case 'dead': m.body.rotation.z = Math.min(1.5, this.st * 4); m.body.position.y = 0.1; break;
      case 'hold': m.armR.rotation.x = -3.0; m.armL.rotation.x = -3.0; m.armR.rotation.z = -0.2; m.armL.rotation.z = 0.2; m.head.rotation.x = -0.2; break;
      case 'surge': {
        const k = this.st / 0.7;
        m.body.position.y = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.8;
        m.armR.rotation.x = -3 + k * 2; m.body.rotation.x = k < 0.5 ? -0.3 : 0.4;
        break;
      }
    }
    // life: blinking, breathing when idle, glancing at the aim, squinting when hurt
    this.blinkT = (this.blinkT ?? 2) - dt;
    if (this.blinkT < 0) this.blinkT = 2.2 + Math.random() * 3;
    if (m.eyes) { m.eyes.scale.y = s === 'hurt' || s === 'dead' ? 0.3 : this.blinkT < 0.1 ? 0.15 : 1; m.eyes.position.y = m.eyes.scale.y < 1 ? 0.06 * (1 - m.eyes.scale.y) : 0; }
    if (s === 'move' && speed < 0.3) {
      const br = Math.sin(t * 2.4);
      m.body.scale.set(1 + br * 0.012, 1 - br * 0.015 + 0.015, 1);
      m.armL.rotation.z = -0.1 - br * 0.04; m.armR.rotation.z = 0.1 + br * 0.04;
      m.head.rotation.x = Math.sin(t * 0.7) * 0.04;
    }
    if (this.aiming && (s === 'move' || s === 'block')) m.head.rotation.y = clamp(angDiff(this.facing, this.aimDir), -0.7, 0.7) * 0.7;
    if (s === 'roll') { const k = this.st / 0.34; m.body.scale.set(1 + Math.sin(k * Math.PI) * 0.1, 0.8, 1); }
    if (s === 'attack' && this.st < 0.05) m.body.scale.set(1.08, 0.92, 1.08); // anticipation squash
    if (this.pushing) { m.armL.rotation.x = -1.4; m.armR.rotation.x = -1.4; m.body.rotation.x = 0.25; }
    // hurt flicker
    this.m.root.visible = !(this.invuln > 0 && this.state !== 'surge' && Math.floor(this.invuln * 20) % 2 === 0);
  }
}
