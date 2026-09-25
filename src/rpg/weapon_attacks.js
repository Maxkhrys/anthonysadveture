// Weapon attack architecture.
//
//   Weapons change WHAT you do. Skill trees change HOW you do it. Affixes change WHAT HAPPENS.
//
// Every equipped weapon resolves to a KIT: a primary (left click) and a secondary (right click)
// attack, an element, an animation profile and effect hook ids. Kits are data: a weapon base or a
// named weapon maps to an ARCHETYPE (fire staff, longbow, heavy chain ...); named / legendary /
// prismatic weapons can patch any part of their kit through WEAPON_OVERRIDES without replacing
// the class. Executors (the `release` / `tick` functions below) are shared by every weapon that
// uses the same secondary, so the player code never switches on individual weapons.
//
// Secondary attacks run through one state machine (Player state 'weapon2'):
//
//   windup  -> [charge] -> release -> [active] -> recover -> move
//
//   * validity, resource and cooldown are checked before the windup starts (a refused attack
//     costs nothing) and again at release;
//   * the cost is paid, the cooldown started and the damage spawned in the same call (release),
//     so nothing can cancel between damage and payment;
//   * a dodge cancels a windup / charge for free; after release only a channel ('active' with
//     cancel.active) or a recovery past cancel.recover can be dodged out of;
//   * inputs are edge-triggered and a running secondary ignores new presses, so buffering can
//     never duplicate an attack.
//
// Each phase emits combat events (combat_events.js) for presentation to hook into.
import { Projectile, blast, bolt, segT } from './combat.js';
import { Entity, move } from '../entities/entity.js';
import { sfx } from '../engine/audio.js';
import { CLASSES, ECHO, echoCount } from './classes.js';
import { isFirearm, magazine, fireGun } from './gunslinger.js';
import { gainEcho, onEchoSpent, spiritMote, isLarge, SPIRIT, SPIRIT_L, SPIRIT_W } from './soulbound.js';
import { resonanceRing, cometShards } from './abilities.js';
import { soak } from './elements.js';
import { itemCombat } from './arpg/runtime.js';
import { combatEvents } from './combat_events.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const foesNear = (g, x, z, r) => g.entities.filter(e => e.isEnemy && !e.dead && !(e.spawnT > 0) && Math.hypot(e.x - x, e.z - z) < r + (e.r || 0.3));
const ev = g => combatEvents(g);

// ------------------------------------------------------------------ archetypes
// Which archetype each weapon base / named weapon belongs to. Anything not listed falls back on
// its kind, so new drops always have a kit.
const ARCHETYPE_LIST = {
  katana: ['rustkatana', 'tachi', 'uchigatana', 'dragontachi', 'seamripper', 'wanderblade', 'azureedge', 'voidcutter', 'dawnbringer', 'heavensdivide'],
  fastblade: ['shinai', 'wakizashi', 'hatpin'],
  greatblade: ['nodachi', 'onicleaver', 'bellclapper', 'teaspoon', 'parasol'],
  elemblade: ['moonkatana', 'stormedge', 'wickblade'],
  longbow: ['longbow', 'elmwarbow', 'lilypad', 'moonfeather'],
  recurve: ['recurve', 'twigbow', 'huntbow', 'reedbow', 'hickorybow', 'spoolstring', 'thornwood'],
  crossbow: ['composite', 'starfallcrossbow'],
  elembow: ['galebow', 'sunbow', 'glasswing', 'verdanteclipse'],
  firestaff: ['acornstaff', 'candlestaff', 'candelabra'],
  froststaff: ['frostrod', 'sagesrod'],
  stormstaff: ['owlstaff', 'porcelainrod', 'fateweaver'],
  arcanestaff: ['crookstaff', 'starstaff', 'mothlight'],
  hexwand: ['twigwand', 'hexwand', 'umbraltome', 'apprenticewand'],
  emberwand: ['shroomwand', 'orbitinggrimoire'],
  heavychain: ['gravechain', 'ferrymanchain', 'eternalbond', 'grievingcoil', 'duskcoil'],
  longchain: ['tetherchain', 'wandererschain', 'veilchain', 'veilrender', 'wayfarerlinks', 'tidewhisper', 'threshold'],
  spiritchain: ['shrinecord', 'lanternlinks', 'mothsilk', 'wispwoven', 'whisperingchain', 'lanternchain'],
  revolver: ['trailrevolver', 'copperrevolver', 'marshalrevolver', 'sundownsix', 'seventhchime'],
  rifle: ['woodrifle', 'brassrifle', 'ironrifle', 'kilnrunner', 'bellfoundryrepeater'],
};
export const ARCHETYPE_OF = Object.fromEntries(Object.entries(ARCHETYPE_LIST).flatMap(([a, ids]) => ids.map(id => [id, a])));
const KIND_FALLBACK = { katana: 'katana', bow: 'recurve', staff: 'arcanestaff', wand: 'hexwand', chain: 'spiritchain', oversized: 'greatblade', revolver: 'revolver', rifle: 'rifle' };
const CLASS_FALLBACK = { samurai: 'katana', archer: 'recurve', witch: 'firestaff', soulbound: 'spiritchain', gunslinger: 'revolver' };
// the element a weapon carries into its secondary (elemental blades and bows)
export const WEAPON_ELEMENT = { moonkatana: 'frost', stormedge: 'lightning', wickblade: 'fire', onicleaver: 'fire', galebow: 'wind', sunbow: 'fire', glasswing: 'glass', verdanteclipse: 'thorn', lilypad: 'water' };

// ------------------------------------------------------------------ primary spells (Witch)
// status packs: burn {chance, t, k (share of hit as dps)}, frost n (freeze build-up), shock /
// hex / mark / root / wet / chill {chance, t} or plain seconds. procCoeff scales item procs for
// rapid attacks.
export const SPELLS = {
  ember: { name: 'Ember Bolt', fx: 'spell.ember', kind: 'ember', element: 'fire', mult: 0.85, speed: 15, range: 9, interval: 0.32, color: 0xff8a2a, status: { burn: { chance: 0.3, t: 2, k: 0.12 } }, procCoeff: 0.8 },
  shard: { name: 'Ice Shard', fx: 'spell.shard', kind: 'shard', element: 'frost', mult: 0.8, speed: 17, range: 9, interval: 0.3, color: 0xbfe8ff, status: { frost: 1 }, procCoeff: 0.8 },
  arc: { name: 'Arc Bolt', fx: 'spell.arc', kind: 'bolt', element: 'lightning', mult: 0.75, speed: 20, range: 9, interval: 0.3, color: 0xfff3b0, status: { shock: { chance: 0.25, t: 1 } }, arc: { n: 1, range: 3, mult: 0.4 }, procCoeff: 0.7 },
  missile: { name: 'Magic Missile', fx: 'spell.missile', kind: 'bolt', element: 'arcane', mult: 0.95, speed: 13, range: 9, interval: 0.34, seek: true, procCoeff: 1 },
  curse: { name: 'Curse Bolt', fx: 'spell.curse', kind: 'hex', element: 'hex', mult: 0.55, speed: 18, range: 8.5, interval: 0.2, color: 0x8b5cf6, status: { hex: { chance: 0.5, t: 2.5 } }, procCoeff: 0.55 },
  darts: { name: 'Fire Darts', fx: 'spell.darts', kind: 'ember', element: 'fire', mult: 0.42, speed: 19, range: 8, interval: 0.24, color: 0xffb347, darts: 2, status: { burn: { chance: 0.15, t: 1.5, k: 0.08 } }, procCoeff: 0.45 },
};

// ------------------------------------------------------------------ kits
export const WEAPON_KITS = {
  katana: { cls: 'samurai', name: 'Katana', anim: 'blade', primary: { type: 'combo', name: 'Three-cut combo' }, secondary: 'drawcut' },
  fastblade: { cls: 'samurai', name: 'Quick blade', anim: 'blade', primary: { type: 'combo', name: 'Three-cut combo' }, secondary: 'flurry' },
  greatblade: { cls: 'samurai', name: 'Greatblade', anim: 'greatblade', primary: { type: 'combo', name: 'Heavy combo' }, secondary: 'cleave' },
  elemblade: { cls: 'samurai', name: 'Elemental blade', anim: 'blade', primary: { type: 'combo', name: 'Three-cut combo' }, secondary: 'elemslash' },
  longbow: { cls: 'archer', name: 'Longbow', anim: 'bow', primary: { type: 'bow', name: 'Arrow · hold to charge' }, secondary: 'deadeye' },
  recurve: { cls: 'archer', name: 'Recurve', anim: 'bow', primary: { type: 'bow', name: 'Arrow · hold to charge' }, secondary: 'triple' },
  crossbow: { cls: 'archer', name: 'Heavy bow', anim: 'crossbow', primary: { type: 'bow', name: 'Arrow · hold to charge' }, secondary: 'heavybolt' },
  elembow: { cls: 'archer', name: 'Elemental bow', anim: 'bow', primary: { type: 'bow', name: 'Arrow · hold to charge' }, secondary: 'elemarrow' },
  firestaff: { cls: 'witch', name: 'Fire staff', anim: 'staff', primary: { type: 'spell', spell: 'ember' }, secondary: 'fireball' },
  froststaff: { cls: 'witch', name: 'Frost staff', anim: 'staff', primary: { type: 'spell', spell: 'shard' }, secondary: 'icelance' },
  stormstaff: { cls: 'witch', name: 'Storm staff', anim: 'staff', primary: { type: 'spell', spell: 'arc' }, secondary: 'chainbolt' },
  arcanestaff: { cls: 'witch', name: 'Arcane staff', anim: 'staff', primary: { type: 'spell', spell: 'missile' }, secondary: 'arcaneorb' },
  hexwand: { cls: 'witch', name: 'Hex wand', anim: 'wand', primary: { type: 'spell', spell: 'curse' }, secondary: 'hexburst' },
  emberwand: { cls: 'witch', name: 'Ember wand', anim: 'wand', primary: { type: 'spell', spell: 'darts' }, secondary: 'flamecone' },
  heavychain: { cls: 'soulbound', name: 'Heavy chain', anim: 'chain', primary: { type: 'lash', name: 'Four-lash combo' }, secondary: 'yank' },
  longchain: { cls: 'soulbound', name: 'Long chain', anim: 'chain', primary: { type: 'lash', name: 'Four-lash combo' }, secondary: 'reach' },
  spiritchain: { cls: 'soulbound', name: 'Spirit chain', anim: 'chain', primary: { type: 'lash', name: 'Four-lash combo' }, secondary: 'spiritfollow' },
  revolver: { cls: 'gunslinger', name: 'Revolver', anim: 'gun', primary: { type: 'gun', name: 'Hold to fire' }, secondary: 'fan' },
  rifle: { cls: 'gunslinger', name: 'Automatic rifle', anim: 'gun', primary: { type: 'gun', name: 'Hold to fire' }, secondary: 'burst' },
};
for (const k of Object.values(WEAPON_KITS)) if (k.primary.spell) k.primary.name = SPELLS[k.primary.spell].name;

// Named / legendary / prismatic weapons patch their kit here. `secondary.extends` names the
// executor to reuse; the other keys are flags that executor reads.
export const WEAPON_OVERRIDES = {
  candelabra: { secondary: { extends: 'fireball', name: "Chandler's Blaze", desc: 'Hold to charge a fireball that splits into three smaller fireballs when it bursts.', split3: true, fx: 'witch.fireball.candelabra' } },
  mothlight: { primary: { color: 0xfff3b0 }, secondary: { extends: 'arcaneorb', name: 'Moth Lantern', desc: 'A slow lantern of light that grinds through foes, then bursts into four pale moths that hunt the nearest enemies.', moths: true, fx: 'witch.arcaneorb.moths' } },
  hatpin: { secondary: { extends: 'flurry', name: 'Needlework', desc: 'Three quick jabs, then a long piercing lunge that finds weak points (+50% critical damage).', lungeFinish: true, fx: 'samurai.flurry.hatpin' } },
  bellclapper: { secondary: { extends: 'cleave', name: 'Toll the Clapper', desc: 'The overhead cleave rings the bell: a resonance shockwave staggers everything nearby.', toll: true, fx: 'samurai.cleave.toll' } },
  lilypad: { secondary: { extends: 'deadeye', name: 'Lily Splash', desc: 'Hold to draw a piercing shot that soaks everything it passes and splashes where it stops.', soak: true, fx: 'archer.deadeye.lily' } },
  lanternchain: { secondary: { extends: 'spiritfollow', name: 'Lantern Follow-up', desc: 'A sweeping lash; its spirit echo always frees a lantern spirit that seeks a foe.', lantern: true, fx: 'soul.follow.lantern' } },
  sundownsix: { secondary: { extends: 'fan', name: 'Sundown Fan', desc: 'Fan the hammer through every round left in the cylinder.', allRounds: true, fx: 'gun.fan.sundown' } },
};

// ------------------------------------------------------------------ status packs
function avgHit(g, mult) { const ps = g.pstats; return (ps.wmin + ps.wmax) / 2 * (1 + ps.dmgPct / 100) * mult; }
export function frostBuild(g, e, n) {
  if (!e.applyStatus || e.dead) return;
  const S = e.status || (e.status = {});
  if (S.freeze > 0) return;
  S.frostBuild = Math.min(9, (S.frostBuild || 0) + n);
  if (S.frostBuild >= 6) { S.frostBuild = 0; e.applyStatus('freeze', 1.3); g.ui.float(e.x, 1.35, e.z, e.isBoss ? 'CHILLED' : 'FROZEN', '#dff4ff', false, true); sfx('shatter'); }
  else if (S.frostBuild >= 3) e.applyStatus('chill', 2.5);
}
const roll = (spec, coeff) => typeof spec === 'number' ? spec : Math.random() < (spec.chance ?? 1) * coeff ? spec.t : 0;
export function applyPack(g, e, pack, mult = 1, coeff = 1) {
  if (!pack || !e || e.dead || !e.applyStatus) return;
  for (const [k, spec] of Object.entries(pack)) {
    if (k === 'frost') { frostBuild(g, e, spec * Math.max(0.5, coeff)); continue; }
    if (k === 'burn') { if (Math.random() < (spec.chance ?? 1) * coeff) e.applyStatus('burn', spec.t, Math.max(1, avgHit(g, mult) * (spec.k ?? 0.15))); continue; }
    const t = roll(spec, coeff);
    if (t > 0) e.applyStatus(k, t);
  }
}
// lightning that hops between foes, only along clear lines of sight
export function arcChain(g, x, z, first, o) {
  let from = { x, z }; const hit = new Set(), skip = o.exclude || null;
  for (let i = 0; i < o.n; i++) {
    const t = i === 0 && first && !first.dead ? first : g.entities.filter(e => e.isEnemy && !e.dead && e !== skip && !(e.spawnT > 0) && !hit.has(e) && Math.hypot(e.x - from.x, e.z - from.z) < (e.status && e.status.wet > 0 ? o.range * 1.4 : o.range) && g.shotClear(from.x, from.z, e.x, e.z)).sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0];
    if (!t || !g.shotClear(from.x, from.z, t.x, t.z)) break;
    hit.add(t);
    bolt(g, from.x, from.z, t.x, t.z);
    const mult = o.mult * Math.pow(o.falloff ?? 0.82, i);
    g.playerHit(t, { mult, kind: 'shock', element: 'lightning', kb: 1, dir: Math.atan2(t.x - from.x, t.z - from.z), noShock: true, procCoeff: o.procCoeff ?? 0.6, ability: !!o.ability });
    applyPack(g, t, o.status, mult, 1);
    if (o.onHit) o.onHit(t);
    from = t;
  }
  if (hit.size) sfx('zap');
  return [...hit];
}
// a melee sweep that reports what it hit
function sweep(p, range, half, o) {
  const g = p.g, before = new Set(p.hitSet);
  g.hitArc(p, p.x, p.z, p.facing, range, half, { id: p.attackId, ...o });
  return [...p.hitSet].filter(e => !before.has(e) && e.isEnemy);
}
// everything along a straight line from the player
function lineFoes(p, dir, len, w = 0.3) {
  const g = p.g, x1 = p.x + Math.sin(dir) * len, z1 = p.z + Math.cos(dir) * len;
  return g.entities.filter(e => e.isEnemy && !e.dead && !(e.spawnT > 0) && segT(p.x, p.z, x1, z1, e.x, e.z).d < (e.r || 0.3) + w)
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
}
function origin(p, d = 0.4) {
  let x = p.x + Math.sin(p.facing) * d, z = p.z + Math.cos(p.facing) * d;
  if (!p.g.shotClear(p.x, p.z, x, z)) { x = p.x; z = p.z; }
  return { x, z };
}
// spawn a weapon projectile: status pack, events and proc coefficient wired in
function shoot(p, a, o) {
  const g = p.g, spell = !!a.spell, pack = o.status, coeff = o.procCoeff ?? 1, extra = o.onHitFx, at = origin(p, o.from ?? 0.4);
  const pr = new Projectile(g, { x: at.x, z: at.z, dir: p.facing, ...o, onHitFx: (pr, e) => {
    applyPack(g, e, pack, pr.mult, coeff);
    if (extra) extra(pr, e);
    ev(g).emit(spell ? 'spell.impact' : 'attack.impact', { attack: a.def || a, target: e, x: e.x, z: e.z, element: pr.element });
  } });
  pr.procCoeff = coeff;
  g.spawn(pr);
  return pr;
}

// ------------------------------------------------------------------ primary spells
// the old per-weapon bolt signatures survive as named primary behaviour
function legacyBoltHit(g, U, pr, e) {
  if (U === 'mothlight') { const t = g.nearestEnemy(e.x, e.z, 6, 0, Math.PI); if (t && t !== e) { const m = new Projectile(g, { x: e.x, z: e.z, dir: Math.atan2(t.x - e.x, t.z - e.z), speed: 8, range: 6, mult: pr.mult * 0.5, kind: 'bolt', element: 'hex', homing: 3, color: 0xf0ecd8 }); m.hit.add(e); g.spawn(m); } }
  if (U === 'porcelainrod') { const wet = e.status && e.status.wet > 0; for (const o of foesNear(g, e.x, e.z, wet ? 3.5 : 3).filter(o => o !== e && g.shotClear(e.x, e.z, o.x, o.z)).slice(0, wet ? 5 : 1)) { bolt(g, e.x, e.z, o.x, o.z); g.playerHit(o, { mult: pr.mult * 0.6, kind: 'shock', element: 'lightning', kb: 0.5, dir: 0, noShock: true, quiet: true }); } }
}
export function castPrimarySpell(p) {
  const g = p.g, kit = weaponKit(p), S = kit.spell;
  if (!S) return false;
  const w = p.inv.equip.weapon, U = w && w.unique, color = kit.primary.color || S.color || (w && w.orb) || 0xc89aff;
  const a = { id: 'primary:' + kit.primary.spell, fx: S.fx, spell: true, def: { id: 'primary:' + kit.primary.spell, fx: S.fx } };
  const n = S.darts || 1;
  p.dartSide = -(p.dartSide || 1);
  for (let i = 0; i < n; i++) {
    const off = n > 1 ? (i - (n - 1) / 2) * 0.1 + p.dartSide * 0.03 : 0;
    const base = { dir: p.facing + off, speed: S.speed, range: S.range, mult: S.mult, kind: S.kind, element: S.element, color, basic: true, procCoeff: S.procCoeff, status: S.status,
      seek: S.seek && p.specialist ? { cone: 0.35, rate: 3, range: 6 } : null,
      onHitFx: (pr, e) => {
        if (S.arc) arcChain(g, e.x, e.z, null, { n: S.arc.n, range: S.arc.range, mult: pr.mult * S.arc.mult, falloff: 1, procCoeff: 0.3, exclude: e });
        legacyBoltHit(g, U, pr, e);
      } };
    shoot(p, a, base);
  }
  ev(g).emit('spell.cast', { attack: a.def, weapon: w, p, element: S.element });
  sfx(S.element === 'fire' ? 'ember' : S.element === 'lightning' ? 'zap' : 'shoot');
  return true;
}

// ------------------------------------------------------------------ secondary attacks
// Timings are seconds at 1.0 attack speed. move: speed multiplier per phase.
export const SECONDARIES = {
  // ---- Samurai
  drawcut: {
    name: 'Draw Cut', desc: 'Settle into a still stance: a frontal blow in that moment is parried and answered with a guaranteed critical draw-cut. Otherwise the blade leaves the sheath in a dashing cut.',
    fx: 'samurai.drawcut', anim: 'drawCut', windup: 0.34, active: 0.14, recover: 0.3, cd: 2.4, cost: 0, counter: true,
    move: { windup: 0, active: 0, recover: 0.35 }, cancel: { recover: 0.15 },
    release(p, a) { p.attackId++; p.hitSet.clear(); p.invuln = Math.max(p.invuln, 0.2); sfx('draw'); sfx('swing2'); a.mult = a.countered ? 2.6 : 1.9; },
    tick(p, dt, a) {
      const g = p.g, v = a.countered ? 22 : 18;
      const hit = sweep(p, 1.15 + p.reach, 1.25, { mult: a.mult, kind: 'sword', kb: 5, forceCrit: a.countered, weapon2: true });
      for (const e of hit) ev(g).emit('attack.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'steel' });
      if (Math.random() < 0.8) g.fx.add({ x: p.x, y: 0.4, z: p.z, color: a.countered ? 0xfff3b0 : 0xffffff, life: 0.25, size: 0.08, g: 0 });
      if (a.t < dt * 1.5) { g.fx.arc(p.x, 0.38, p.z, p.facing, 1.7, 2.2, 0xffffff, 0.14, 0.32); g.fx.arc(p.x, 0.4, p.z, p.facing, 1.9, 1.8, a.countered ? 0xffd25e : 0x9ad8ff, 0.2, 0.12); }
      return [Math.sin(p.facing) * v, Math.cos(p.facing) * v];
    },
  },
  flurry: {
    name: 'Flurry', desc: 'Four rapid cuts in a heartbeat. Light and fast: weave it between enemy blows.',
    fx: 'samurai.flurry', anim: 'flurry', windup: 0.08, active: 0.46, recover: 0.18, cd: 1.6, cost: 0,
    move: { windup: 0.4, active: 0.35, recover: 0.6 }, cancel: { recover: 0.05 },
    release(p, a) { a.n = 0; a.tk = 0; },
    tick(p, dt, a) {
      const g = p.g, d = a.def;
      a.tk -= dt;
      const last = d.lungeFinish && a.n === 3;
      if (a.tk <= 0 && a.n < 4) {
        a.tk += 0.11; a.n++; p.attackId++; p.hitSet.clear();
        const hit = last ? sweep(p, 2.2 + p.reach, 0.35, { mult: 1.3, kind: 'lunge', kb: 5, weapon2: true }) : sweep(p, 1.2 + p.reach, 0.95, { mult: 0.5, kind: 'sword', kb: 1.5, weapon2: true, procCoeff: 0.5 });
        for (const e of hit) ev(g).emit('attack.impact', { attack: d, target: e, x: e.x, z: e.z, element: 'steel' });
        const side = a.n % 2 ? 0.35 : -0.35;
        g.fx.arc(p.x, 0.36, p.z, p.facing + side, last ? 2.2 : 1.25, last ? 0.5 : 1.9, 0xffffff, 0.1, 0.26);
        sfx(a.n % 2 ? 'swing' : 'swing2');
        a.lunge = 0.04;
      }
      if (a.lunge > 0) { a.lunge -= dt; const v = last ? 7 : 3; return [Math.sin(p.facing) * v, Math.cos(p.facing) * v]; }
      return null;
    },
  },
  cleave: {
    name: 'Overhead Cleave', desc: 'A committed two-handed overhead blow. Slow to start and it cannot be stopped once it falls: it breaks guards and shields, shatters the frozen and staggers everything it lands on.',
    fx: 'samurai.cleave', anim: 'overhead', windup: 0.52, recover: 0.45, cd: 2.2, cost: 0,
    move: { windup: 0.15, recover: 0 }, cancel: { recover: 0.3 },
    release(p, a) {
      const g = p.g, d = a.def, el = a.kit.element;
      p.attackId++; p.hitSet.clear();
      const hit = sweep(p, 2.3 + p.reach, 0.62, { mult: 3.0, kind: 'slam', heavy: true, kb: 9, element: el || undefined, weapon2: true });
      for (const e of hit) { e.stagger = Math.max(e.stagger || 0, e.isBoss ? 0.25 : 0.7); if (el === 'fire') applyPack(g, e, { burn: { chance: 1, t: 3, k: 0.12 } }, 3); ev(g).emit('attack.impact', { attack: d, target: e, x: e.x, z: e.z, element: el || 'heavy' }); }
      const cx = p.x + Math.sin(p.facing) * 1.5, cz = p.z + Math.cos(p.facing) * 1.5;
      g.fx.arc(p.x, 0.4, p.z, p.facing, 2.5, 1.3, 0xffffff, 0.2, 0.5); g.fx.ring(cx, cz, 0.3, 1.8, el === 'fire' ? 0xff8a2a : 0xfff3b0, 0.35); g.fx.dust(cx, cz, 10);
      g.pr.addShake(0.7); g.hitstop(0.08); sfx('heavyhit'); sfx('thud');
      if (d.toll) resonanceRing(g, cx, cz, 2.8, 1.2);
    },
  },
  elemslash: {
    name: 'Elemental Slash', desc: "A wide cut that looses the blade's element as a travelling crescent: frost builds a freeze, lightning arcs between foes, fire sets them alight.",
    fx: 'samurai.elemslash', anim: 'slash', windup: 0.16, recover: 0.26, cd: 1.8, cost: 0,
    move: { windup: 0.4, recover: 0.5 }, cancel: { recover: 0.1 },
    release(p, a) {
      const g = p.g, el = a.kit.element || 'wind';
      const col = { frost: 0xbfe8ff, lightning: 0xfff3b0, fire: 0xff8a2a }[el] || 0x9ad8ff;
      const pack = el === 'frost' ? { frost: 3 } : el === 'fire' ? { burn: { chance: 1, t: 3, k: 0.12 } } : el === 'lightning' ? { shock: { chance: 0.6, t: 1.5 } } : null;
      shoot(p, a, { speed: 13, range: 6.5, mult: 1.5, kind: 'crescent', element: el, pierce: 99, kb: 4, color: col, status: pack, procCoeff: 0.7,
        onHitFx: el === 'lightning' ? (pr, e) => arcChain(g, e.x, e.z, null, { n: 2, range: 3.5, mult: 0.5, procCoeff: 0.3 }) : null });
      g.fx.arc(p.x, 0.36, p.z, p.facing, 1.5, 2.4, col, 0.2, 0.4); sfx('gale');
    },
  },
  // ---- Archer
  deadeye: {
    name: 'Deadeye Shot', desc: 'Hold to draw the longbow to its full length, then loose an arrow that pierces everything in a long line. Slower to draw and costs Focus, but hits far harder than a charged arrow.',
    fx: 'archer.deadeye', anim: 'bowDraw', windup: 0.12, charge: { min: 0.45, full: 1.15 }, recover: 0.24, cd: 0.5, cost: 18,
    move: { windup: 0.5, charge: 0.35, recover: 0.7 }, cancel: { recover: 0.08 },
    release(p, a) {
      const g = p.g, d = a.def, k = a.frac;
      if (k >= 1) p.onCharged();
      const pr = shoot(p, a, { speed: 30, range: 15, mult: 1.7 + 1.7 * k, kind: 'power', pierce: 99, kb: 7, color: 0xffd25e, charged: k >= 1, procCoeff: 1,
        onHitFx: d.soak ? (pr, e) => e.applyStatus && e.applyStatus('wet', 5) : null });
      pr.m.scale.multiplyScalar(1.2);
      if (d.soak) { const tx = p.x + Math.sin(p.facing) * 8, tz = p.z + Math.cos(p.facing) * 8; setTimeout(() => { if (!g.dead && g.area) { soak(g, tx, tz, 2.4); g.fx.ring(tx, tz, 0.2, 2.4, 0x6ab8ff, 0.4); } }, 300); }
      sfx('spin'); g.pr.addShake(0.2 + 0.2 * k); g.guide.event('charge');
    },
  },
  triple: {
    name: 'Triple Shot', desc: 'Three arrows loosed in a rapid string down the same line: burst a single target or thread a doorway.',
    fx: 'archer.triple', anim: 'bowQuick', windup: 0.06, active: 0.2, recover: 0.16, cd: 0.75, cost: 10,
    move: { windup: 0.8, active: 0.7, recover: 0.9 }, cancel: { recover: 0.02 },
    release(p, a) { a.n = 0; a.tk = 0; },
    tick(p, dt, a) {
      a.tk -= dt;
      while (a.tk <= 0 && a.n < 3) { a.tk += 0.07; const off = [0, 0.04, -0.04][a.n++]; const f = p.facing; p.facing += off; shoot(p, a, { speed: 22, range: 10, mult: 0.7, kind: 'arrow', color: 0xf0e0c0, procCoeff: 0.7 }); p.facing = f; sfx('swing'); }
      return null;
    },
  },
  heavybolt: {
    name: 'Armour-breaker', desc: 'Crank back a heavy bolt. It punches through shields and guards, breaks armour (marked foes take +25% damage) and hurls what it hits.',
    fx: 'archer.heavybolt', anim: 'crossbow', windup: 0.4, recover: 0.3, cd: 1.3, cost: 16,
    move: { windup: 0.5, recover: 0.6 }, cancel: { recover: 0.15 },
    release(p, a) {
      const g = p.g;
      const pr = shoot(p, a, { speed: 27, range: 12, mult: 2.5, kind: 'power', heavy: true, pierce: 1, kb: 8, color: 0xc8c8d8, procCoeff: 1, status: { mark: 4 },
        onHitFx: (pr, e) => { if (e.elite || e.shell > 0 || e.modifyHit) g.ui.float(e.x, 1.4, e.z, 'ARMOUR BROKEN', '#ffe298', false, true); if (e.elite === 'Armoured') e.bulwarkGuard = false; } });
      pr.m.scale.set(1.8, 1.8, 1.3);
      g.pr.addShake(0.25); sfx('clang'); sfx('swing2');
    },
  },
  elemarrow: {
    name: 'Elemental Arrow', desc: "An arrow that carries the bow's element: wind hurls and staggers, fire bursts and burns, glass shatters into shards, thorn roots, water soaks.",
    fx: 'archer.elemarrow', anim: 'bowQuick', windup: 0.14, recover: 0.2, cd: 1.1, cost: 14,
    move: { windup: 0.6, recover: 0.8 }, cancel: { recover: 0.08 },
    release(p, a) {
      const g = p.g, el = a.kit.element || 'wind', m = 1.8;
      const col = { wind: 0x9ad8ff, fire: 0xff8a2a, glass: 0xbfe8f0, thorn: 0x7fd36a, water: 0x6ab8ff, frost: 0xdff4ff, lightning: 0xfff3b0 }[el] || 0xffffff;
      shoot(p, a, { speed: 24, range: 11, mult: m, kind: 'arrow', element: el === 'glass' || el === 'water' ? null : el, color: col, kb: el === 'wind' ? 7 : 4, procCoeff: 0.9,
        onHitFx: (pr, e) => {
          if (el === 'wind') e.onGust && e.onGust(pr.dir, 2);
          else if (el === 'fire') blast(g, e.x, e.z, 1.4, pr.mult * 0.5, 0xff8a2a, { burn: true, element: 'fire', extra: { procCoeff: 0.4 } });
          else if (el === 'glass') cometShards(g, e.x, e.z, pr.mult * 0.5, 4);
          else if (el === 'thorn') e.applyStatus && e.applyStatus('root', 1.8);
          else if (el === 'water') soak(g, e.x, e.z, 2.2);
          else if (el === 'frost') frostBuild(g, e, 4);
          else if (el === 'lightning') arcChain(g, e.x, e.z, null, { n: 3, range: 4, mult: pr.mult * 0.5, procCoeff: 0.3 });
        } });
      sfx('swing2');
    },
  },
  // ---- Witch
  fireball: {
    name: 'Charged Fireball', desc: 'Hold to gather fire, release to hurl a fireball. It explodes, burns everything caught in it and breaks shields and guards; the longer the charge, the bigger the blast.',
    fx: 'witch.fireball', anim: 'staffRaise', spell: true, windup: 0.1, charge: { min: 0.28, full: 0.9 }, recover: 0.28, cd: 0.35, cost: 16,
    move: { windup: 0.5, charge: 0.45, recover: 0.7 }, cancel: { recover: 0.1 },
    release(p, a) {
      const g = p.g, d = a.def, k = a.frac, f = p.facing;
      if (k >= 1) p.onCharged();
      const split = d.split3 ? pr => { for (let i = 0; i < 3; i++) g.spawn(new Projectile(g, { x: pr.x, z: pr.z, dir: f + (i - 1) * 0.9, speed: 9, range: 2.6, mult: pr.mult * 0.4, kind: 'fireball', aoe: 1.1, color: 0xffb347, noCraft: true })); } : null;
      shoot(p, a, { speed: 11, range: 9, mult: 1.4 + 1.3 * k, kind: 'fireball', aoe: 1.3 + 0.6 * k, color: 0xff8a2a, charged: k >= 1, onExplode: split });
      sfx('gale'); g.guide.event('charge');
    },
  },
  icelance: {
    name: 'Ice Lance', desc: 'A heavy spear of ice for a single target: it pierces, builds a fast freeze, deals +50% to chilled foes and shatters the frozen.',
    fx: 'witch.icelance', anim: 'staffThrust', spell: true, windup: 0.26, recover: 0.25, cd: 1.0, cost: 15,
    move: { windup: 0.35, recover: 0.7 }, cancel: { recover: 0.1 },
    release(p, a) {
      const pr = shoot(p, a, { speed: 26, range: 11, mult: 2.1, kind: 'shard', element: 'frost', heavy: true, pierce: 2, kb: 3, color: 0xdff4ff, r: 0.15, status: { frost: 4 }, procCoeff: 1,
        onBeforeHit: (pr, e) => (e.status && (e.status.chill > 0 || e.status.freeze > 0) ? 1.5 : 1) });
      pr.m.scale.set(1.3, 1.3, 2.6);
      sfx('shatter');
    },
  },
  chainbolt: {
    name: 'Chain Lightning', desc: 'Lightning leaps from your staff to the foe under your cursor, then on to up to four more it can see. Wet foes conduct it further.',
    fx: 'witch.chainlightning', anim: 'staffPoint', spell: true, windup: 0.2, recover: 0.22, cd: 0.9, cost: 18,
    move: { windup: 0.5, recover: 0.7 }, cancel: { recover: 0.1 },
    valid(p, a) { const t = a.target && !a.target.dead && p.g.shotClear(p.x, p.z, a.target.x, a.target.z) && Math.hypot(a.target.x - p.x, a.target.z - p.z) < 9 ? a.target : p.chainTarget(8); if (!t) return 'No target in sight'; a.target = t; return null; },
    release(p, a) {
      const g = p.g, t = a.target;
      p.facing = Math.atan2(t.x - p.x, t.z - p.z);
      const o = origin(p, 0.35);
      a.hits = arcChain(g, o.x, o.z, t, { n: 5, range: 4.5, mult: 1.3, falloff: 0.82, procCoeff: 0.6, status: { shock: { chance: 0.6, t: 1.5 } },
        onHit: e => ev(g).emit('spell.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'lightning' }) });
    },
  },
  arcaneorb: {
    name: 'Arcane Orb', desc: 'A large, slow orb that grinds through every foe in its path, then bursts at the end of its flight.',
    fx: 'witch.arcaneorb', anim: 'staffRaise', spell: true, windup: 0.3, recover: 0.3, cd: 1.4, cost: 20,
    move: { windup: 0.4, recover: 0.7 }, cancel: { recover: 0.12 },
    release(p, a) {
      const g = p.g, at = origin(p, 0.5);
      const orb = new ArcaneOrb(g, { x: at.x, z: at.z, dir: p.facing, speed: 6, range: 8.5, mult: 0.45, kind: 'bolt', element: 'arcane', pierce: 99, kb: 1, r: 0.35, color: a.def.moths ? 0xfff3b0 : 0xc89aff, procCoeff: 0.4 }, a);
      g.spawn(orb);
      sfx('gale');
    },
  },
  hexburst: {
    name: 'Hex Burst', desc: 'A curse that clings to its target, then bursts a moment later, damaging and hexing everything around it. Hexed foes take more from the burst.',
    fx: 'witch.hexburst', anim: 'wandFlick', spell: true, windup: 0.14, recover: 0.22, cd: 1.0, cost: 14,
    move: { windup: 0.6, recover: 0.8 }, cancel: { recover: 0.08 },
    release(p, a) {
      const g = p.g;
      shoot(p, a, { speed: 20, range: 9, mult: 0.8, kind: 'hex', element: 'hex', color: 0xb88aff, status: { hex: 3 }, procCoeff: 0.8,
        onHitFx: (pr, e) => g.spawn(new DelayedCurse(g, e, 1.6, 1.1, a.def)) });
      sfx('shoot');
    },
  },
  flamecone: {
    name: 'Flame Cone', desc: 'A short roaring cone of fire from the wand tip for half a second. Everything in it burns; you can dodge out of it at any time.',
    fx: 'witch.flamecone', anim: 'channel', spell: true, windup: 0.08, active: 0.55, recover: 0.15, cd: 1.3, cost: 14, track: true,
    move: { windup: 0.5, active: 0.5, recover: 0.8 }, cancel: { active: true, recover: 0 },
    release(p, a) { a.tk = 0; sfx('ember'); },
    tick(p, dt, a) {
      const g = p.g;
      a.tk -= dt;
      for (let i = 0; i < 3; i++) { const s = (Math.random() - 0.5) * 0.9, sp = 5 + Math.random() * 3; g.fx.add({ x: p.x + Math.sin(p.facing) * 0.45, y: 0.45, z: p.z + Math.cos(p.facing) * 0.45, vx: Math.sin(p.facing + s) * sp, vz: Math.cos(p.facing + s) * sp, vy: 0.4, g: -1, drag: 1.5, color: i ? 0xff8a2a : 0xffd25e, life: 0.35, size: 0.08 }); }
      if (a.tk <= 0) {
        a.tk += 0.09; p.attackId++; p.hitSet.clear();
        const hit = sweep(p, 2.7, 0.5, { mult: 0.3, kind: 'ember', element: 'fire', kb: 0.8, procCoeff: 0.35, weapon2: true });
        for (const e of hit) { applyPack(g, e, { burn: { chance: 0.5, t: 2.5, k: 0.4 } }, 0.3); ev(g).emit('spell.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'fire' }); }
      }
      return null;
    },
  },
  // ---- Soulbound
  yank: {
    name: 'Anchor Yank', desc: 'Hurl the heavy chain straight out: the first foe it catches is staggered and dragged to your feet. Large foes are anchored in place and marked instead.',
    fx: 'soul.yank', anim: 'chainThrow', windup: 0.22, active: 0.22, recover: 0.3, cd: 2.0, cost: 0,
    move: { windup: 0.2, active: 0, recover: 0.5 }, cancel: { recover: 0.12 },
    release(p, a) {
      const g = p.g, dir = p.facing, len = g.shotLen(p.x, p.z, dir, p.chainRange() * 1.7);
      const e = lineFoes(p, dir, len, 0.35)[0];
      a.len = e ? Math.hypot(e.x - p.x, e.z - p.z) : len;
      p.lashVis = { ang: 0, len: a.len, bend: 0.05, sf: 0.35, y: 0.42 };
      sfx('chainpull');
      if (!e) return;
      g.playerHit(e, { mult: 1.5, kind: 'lash', element: 'spirit', heavy: true, kb: 0, dir });
      e.stagger = Math.max(e.stagger || 0, e.isBoss ? 0.35 : 0.9);
      if (e.isBoss || isLarge(e)) { e.applyStatus && e.applyStatus('mark', 3); g.ui.float(e.x, 1.4, e.z, 'ANCHORED', '#8fe3dc', false, true); }
      else a.pull = e;
      if (g.inv.cls === 'soulbound') gainEcho(g, 0.5, e.x, e.z);
      g.hitstop(0.05);
      ev(g).emit('attack.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'spirit' });
    },
    tick(p, dt, a) {
      const g = p.g, e = a.pull;
      if (e && !e.dead) {
        const tx = p.x + Math.sin(p.facing) * 1.1, tz = p.z + Math.cos(p.facing) * 1.1, dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const s = Math.min(d, 16 * dt); move(g, e, dx / d * s, dz / d * s); }
        a.len = Math.hypot(e.x - p.x, e.z - p.z);
      }
      p.lashVis = { ang: 0, len: Math.max(0.4, a.len), bend: Math.sin(a.t * 30) * 0.05, sf: 0.35, y: 0.42 };
      return null;
    },
  },
  reach: {
    name: "Reaper's Reach", desc: 'Snap the long chain out to nearly twice its length in a straight line, cutting every foe along it.',
    fx: 'soul.reach', anim: 'chainThrust', windup: 0.14, recover: 0.3, cd: 1.2, cost: 0,
    move: { windup: 0.3, recover: 0.5 }, cancel: { recover: 0.1 },
    release(p, a) {
      const g = p.g, dir = p.facing, len = g.shotLen(p.x, p.z, dir, p.chainRange() * 1.9);
      const hit = lineFoes(p, dir, len, 0.3);
      for (const e of hit) { g.playerHit(e, { mult: 1.45, kind: 'lash', element: 'spirit', kb: 4, dir, procCoeff: 0.8 }); ev(g).emit('attack.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'spirit' }); }
      if (hit.length && g.inv.cls === 'soulbound') gainEcho(g, 0.5, hit[0].x, hit[0].z);
      for (let i = 1; i <= 10; i++) { const d = len * i / 10; g.fx.add({ x: p.x + Math.sin(dir) * d, y: 0.42, z: p.z + Math.cos(dir) * d, g: 0, color: i === 10 ? SPIRIT_W : SPIRIT, life: 0.25, size: i === 10 ? 0.12 : 0.06 }); }
      a.len = len; p.lashVis = { ang: 0, len, bend: 0.1, sf: 0.42, y: 0.42 };
      sfx('lash2');
    },
  },
  spiritfollow: {
    name: 'Spectral Follow-up', desc: 'A wide lash, and a moment later its spirit echo sweeps back the other way. With a Soul Echo to spare, the echo also frees two seeking spirits.',
    fx: 'soul.follow', anim: 'chainSweep', windup: 0.1, active: 0.38, recover: 0.22, cd: 1.3, cost: 0,
    move: { windup: 0.4, active: 0.5, recover: 0.6 }, cancel: { recover: 0.08 },
    release(p, a) {
      const g = p.g, R = p.chainRange() * 1.05;
      p.attackId++; p.hitSet.clear();
      const hit = sweep(p, R, 1.0, { mult: 1.05, kind: 'lash', element: 'spirit', kb: 3, weapon2: true });
      for (const e of hit) ev(g).emit('attack.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'spirit' });
      if (hit.length && g.inv.cls === 'soulbound') gainEcho(g, 0.5, hit[0].x, hit[0].z);
      g.fx.arc(p.x, 0.4, p.z, p.facing, R, 2.0, SPIRIT, 0.18, 0.22);
      p.lashVis = { ang: -1.0, len: R, bend: 0.5, sf: 0.5, y: 0.42 };
      a.echoed = false; sfx('lash');
    },
    tick(p, dt, a) {
      const g = p.g, d = a.def, R = p.chainRange() * 1.05;
      p.lashVis = { ang: a.echoed ? 1.0 : -1.0 + a.t * 4, len: R, bend: 0.4, sf: 0.5, y: 0.42 };
      if (!a.echoed && a.t >= 0.3) {
        a.echoed = true; p.attackId++; p.hitSet.clear();
        const hit = sweep(p, R, 1.0, { mult: 0.8, kind: 'lash', element: 'spirit', kb: 3, echo: true, weapon2: true });
        for (const e of hit) ev(g).emit('attack.impact', { attack: d, target: e, x: e.x, z: e.z, element: 'spirit' });
        g.fx.arc(p.x, 0.42, p.z, p.facing, R, 2.0, SPIRIT_L, 0.22, 0.2);
        const spend = g.inv.cls === 'soulbound' && echoCount(g.res) >= 1;
        if (spend) { g.res -= ECHO; onEchoSpent(g, 1); for (const s of [-0.4, 0.4]) spiritMote(g, p.x, p.z, p.facing + s, 0.9); }
        if (d.lantern) spiritMote(g, p.x, p.z, p.facing, 0.8);
        sfx('lash2');
      }
      return null;
    },
  },
  // ---- Gunslinger
  fan: {
    name: 'Fan the Hammer', desc: 'Slap the hammer back three times: three quick, wild rounds in a spread. Uses real rounds from the cylinder.',
    fx: 'gun.fan', anim: 'fan', windup: 0.06, active: 0.18, recover: 0.28, cd: 1.5, cost: 0,
    move: { windup: 0.7, active: 0.6, recover: 0.8 }, cancel: { recover: 0.1 },
    valid(p) { const w = p.inv.equip.weapon, m = magazine(w); if (!isFirearm(w)) return 'No firearm'; if (p.reload || p.barrage) return 'Reloading'; if (!m || m.rounds <= 0) return 'Reload first'; return null; },
    release(p, a) { const m = magazine(p.inv.equip.weapon); a.n = a.def.allRounds ? m.rounds : Math.min(3, m.rounds); a.k = 0; a.tk = 0; a.activeDur = Math.max(a.def.active, a.n * 0.05 + 0.12); },
    tick(p, dt, a) {
      a.tk -= dt;
      while (a.tk <= 0 && a.k < a.n) {
        a.tk += 0.05; const i = a.k++;
        const ok = fireGun(p, { bypass: true, mult: 0.8, consumePrime: i === 0, dirOffset: a.n > 1 ? (i - (a.n - 1) / 2) * (0.36 / Math.max(2, a.n - 1)) + (Math.random() - 0.5) * 0.05 : 0 });
        if (!ok) a.k = a.n;
      }
      return null;
    },
  },
  burst: {
    name: 'Controlled Burst', desc: 'Brace and put four accurate rounds on target. Suppressed foes are slowed; the spread resets for every round.',
    fx: 'gun.burst', anim: 'burst', windup: 0.1, active: 0.32, recover: 0.25, cd: 1.3, cost: 0,
    move: { windup: 0.6, active: 0.4, recover: 0.8 }, cancel: { recover: 0.1 },
    valid(p) { const w = p.inv.equip.weapon, m = magazine(w); if (!isFirearm(w)) return 'No firearm'; if (p.reload || p.barrage) return 'Reloading'; if (!m || m.rounds <= 0) return 'Reload first'; return null; },
    release(p, a) { a.k = 0; a.tk = 0; },
    tick(p, dt, a) {
      a.tk -= dt;
      while (a.tk <= 0 && a.k < 4) {
        a.tk += 0.075; const i = a.k++; p.gunSpread = 0;
        const ok = fireGun(p, { bypass: true, mult: 1.05, consumePrime: i === 0, onHit: (pr, e) => { e.applyStatus && e.applyStatus('chill', 0.8); ev(p.g).emit('attack.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'physical' }); } });
        if (!ok) a.k = 4;
      }
      return null;
    },
  },
};
for (const [id, d] of Object.entries(SECONDARIES)) d.id = id;

// ------------------------------------------------------------------ special entities
class ArcaneOrb extends Projectile {
  constructor(g, o, a) {
    super(g, o);
    this.attack = a; this.m.scale.multiplyScalar(2.2);
    this.onHitFx = (pr, e) => ev(g).emit('spell.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'arcane' });
  }
  burst() {
    if (this.burst_) return; this.burst_ = true;
    const g = this.g, a = this.attack;
    const hit = blast(g, this.x, this.z, 1.8, 1.7, this.color, { burn: false, element: 'arcane', extra: { procCoeff: 0.8 } });
    g.fx.ring(this.x, this.z, 0.2, 1.8, 0xe8d0ff, 0.35); sfx('gale');
    for (const e of hit) ev(g).emit('spell.impact', { attack: a.def, target: e, x: e.x, z: e.z, element: 'arcane' });
    if (a.def.moths) for (let i = 0; i < 4; i++) g.spawn(new Projectile(g, { x: this.x, z: this.z, dir: i * Math.PI / 2, speed: 8, range: 7, mult: 0.5, kind: 'bolt', element: 'hex', homing: 3, color: 0xf0ecd8, noCraft: true }));
  }
  pop() { this.burst(); super.pop(); }
  explode() { this.burst(); this.remove(); }
}
class DelayedCurse extends Entity {
  constructor(g, target, mult, delay, def) { super(g, target.x, target.z); this.target = target; this.mult = mult; this.delay = delay; this.t = 0; this.def = def; this.alwaysUpdate = true; this.isCurse = true; }
  update(dt) {
    const g = this.g, e = this.target;
    if (e && !e.dead) { this.x = e.x; this.z = e.z; }
    this.t += dt;
    if (Math.random() < 0.5) { const a = Math.random() * 6.28; g.fx.add({ x: this.x + Math.cos(a) * 0.5, y: 0.5, z: this.z + Math.sin(a) * 0.5, vx: -Math.cos(a), vz: -Math.sin(a), g: 0, color: 0xb88aff, life: 0.3, size: 0.05 }); }
    if (this.t < this.delay) return;
    g.fx.ring(this.x, this.z, 0.2, 1.9, 0xb88aff, 0.35); g.fx.burst(this.x, 0.5, this.z, 14, [0xb88aff, 0x8b5cf6, 0xffffff], 3); sfx('hex');
    for (const o of foesNear(g, this.x, this.z, 1.9)) {
      if (!g.shotClear(this.x, this.z, o.x, o.z)) continue;
      const hexed = o.status && o.status.hex > 0;
      g.playerHit(o, { mult: this.mult * (hexed ? 1.3 : 1), kind: 'hex', element: 'hex', kb: 3, dir: Math.atan2(o.x - this.x, o.z - this.z), procCoeff: 0.6 });
      o.applyStatus && o.applyStatus('hex', 3);
      ev(g).emit('spell.impact', { attack: this.def, target: o, x: o.x, z: o.z, element: 'hex' });
    }
    this.remove();
  }
}

// ------------------------------------------------------------------ resolution
const cache = new Map();
function resolve(item, cls) {
  const key = (item ? (item.uid || '') + '|' + (item.unique || '') + '|' + item.base : 'none') + '|' + cls;
  if (cache.has(key)) return cache.get(key);
  const id = item ? (ARCHETYPE_OF[item.unique] || ARCHETYPE_OF[item.base] || KIND_FALLBACK[item.kind] || CLASS_FALLBACK[cls]) : CLASS_FALLBACK[cls] || 'katana';
  const base = WEAPON_KITS[id];
  const ov = item ? WEAPON_OVERRIDES[item.unique] || WEAPON_OVERRIDES[item.base] || {} : {};
  let secondary = SECONDARIES[base.secondary];
  if (ov.secondary) { const s = ov.secondary, ext = SECONDARIES[s.extends || base.secondary]; secondary = { ...ext, ...s, id: (s.extends || base.secondary) + ':' + (item.unique || item.base), base: ext.id }; }
  const primary = { ...base.primary, ...(ov.primary || {}) };
  const kit = { id, name: base.name, cls: base.cls, anim: ov.anim || base.anim, primary, secondary, spell: primary.spell ? SPELLS[primary.spell] : null,
    element: (item && (WEAPON_ELEMENT[item.unique] || WEAPON_ELEMENT[item.base])) || ov.element || null, override: !!(ov.primary || ov.secondary) };
  cache.set(key, kit);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return kit;
}
export const kitFor = (item, cls) => resolve(item || null, cls || (item && item.cls) || 'samurai');
export const weaponKit = p => resolve(p.inv.equip.weapon || null, p.cls);
// tooltip text, from data only
export function describeKit(item, cls) {
  const k = kitFor(item, cls);
  return { archetype: k.id, name: k.name, primary: k.primary.name, secondary: k.secondary && k.secondary.name, secondaryDesc: k.secondary && k.secondary.desc, element: k.element };
}

// ------------------------------------------------------------------ the state machine
const DEFAULT_MOVE = { windup: 0.4, charge: 0.4, active: 0.4, recover: 0.7 };
export function secondaryCost(p, d) { return (d.cost || 0) * (1 - Math.min(0.5, (p.g.pstats.arpg?.stats.resourceCostReduction || 0) / 100)); }
// null when the secondary can start, otherwise the reason it cannot
export function secondaryBlocked(p, a) {
  const g = p.g, d = a.def;
  if ((p.secCd || 0) > 0) return 'cooldown';
  if (g.res + 1e-6 < secondaryCost(p, d)) return 'resource';
  if (d.valid) return d.valid(p, a);
  return null;
}
export function startSecondary(p) {
  const g = p.g, kit = weaponKit(p), d = kit.secondary;
  if (!d) return false;
  const a = { def: d, kit, phase: 'windup', t: 0, charge: 0, frac: 0, fired: false, released: false, spell: !!d.spell };
  const why = secondaryBlocked(p, a);
  if (why) {
    sfx('error');
    if (why === 'resource') g.ui.toast('Not enough ' + CLASSES[p.cls].res, d.name + ' needs ' + Math.ceil(secondaryCost(p, d)), 0.8);
    else if (why !== 'cooldown') g.ui.toast(why, d.name, 0.9);
    g.stats.secondaryRefused = (g.stats.secondaryRefused || 0) + 1;
    return false;
  }
  p.faceAim();
  if (!p.aiming && !d.valid) { const t = g.nearestEnemy(p.x, p.z, 8, p.facing, 0.7); if (t) p.facing = Math.atan2(t.x - p.x, t.z - p.z); }
  p.targeting = null;
  p.w2 = a;
  p.setState('weapon2');
  p.attackId++; p.hitSet.clear();
  sfx(d.spell ? 'charge' : 'windup');
  ev(g).emit('weapon.secondary', { attack: d, weapon: p.inv.equip.weapon, p });
  ev(g).emit('attack.windup', { attack: d, weapon: p.inv.equip.weapon, p });
  return true;
}
function endSecondary(p) { p.w2 = null; p.lashVis = null; p.setState('move'); }
function cancelSecondary(p, reason) {
  const a = p.w2, g = p.g;
  if (a && !a.fired) { ev(g).emit('attack.cancel', { attack: a.def, reason }); p.secCd = Math.max(p.secCd || 0, 0.15); }
  if (reason && !['dodge', 'short', 'interrupted', 'locked'].includes(reason)) { sfx('error'); g.ui.toast(reason === 'resource' ? 'Not enough ' + CLASSES[p.cls].res : reason, a ? a.def.name : '', 0.9); }
  endSecondary(p);
}
function releaseSecondary(p, a) {
  const g = p.g, d = a.def;
  const why = d.valid ? d.valid(p, a) : null;
  if (why) return cancelSecondary(p, why);
  const cost = secondaryCost(p, d);
  if (g.res + 1e-6 < cost) return cancelSecondary(p, 'resource');
  // atomic: pay, start the cooldown, fire
  if (cost) { g.res = Math.max(0, g.res - cost); itemCombat(g).emit('resourceSpend', { amount: cost, skill: 'secondary:' + d.id }); g.hudDirty = true; }
  p.secCd = d.cd * (1 - Math.min(40, g.pstats.cdr || 0) / 200);
  a.fired = true; a.paid = cost;
  a.frac = d.charge ? clamp01((a.charge - d.charge.min) / Math.max(0.01, d.charge.full - d.charge.min)) : 1;
  a.phase = d.active ? 'active' : 'recover'; a.t = 0;
  ev(g).emit('attack.release', { attack: d, weapon: p.inv.equip.weapon, p, charge: a.frac });
  if (d.spell) ev(g).emit('spell.cast', { attack: d, weapon: p.inv.equip.weapon, p, element: a.kit.element || d.element || null });
  d.release(p, a);
  g.stats['secondary:' + (d.base || d.id)] = (g.stats['secondary:' + (d.base || d.id)] || 0) + 1;
  g.stats.secondaries = (g.stats.secondaries || 0) + 1;
  p.combatT = Math.max(p.combatT || 0, 3);
}
// a frontal hit during a counter stance: parry it and answer at once
export function counterHit(p, h, fromAng) {
  const a = p.w2;
  if (!a || !a.def.counter || a.fired || a.phase !== 'windup' || h.unblockable) return false;
  if (Math.abs(((p.facing - fromAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 1.3) return false;
  const g = p.g;
  sfx('parry'); g.hitstop(0.12); g.pr.addFlash(0.25, 0xfff3b0);
  g.fx.ring(p.x, p.z, 0.3, 1.8, 0xfff3b0, 0.3, 0.4);
  if (h.src && h.src.onParried) h.src.onParried();
  g.addSurge(12); p.parryT = g.time;
  g.stats.parries = (g.stats.parries || 0) + 1; g.stats.counters = (g.stats.counters || 0) + 1;
  a.countered = true;
  if (h.src && h.src.isEnemy) p.facing = Math.atan2(h.src.x - p.x, h.src.z - p.z);
  releaseSecondary(p, a);
  p.secCd = Math.min(p.secCd, 0.8); // a clean counter is rewarded with a quick reset
  return true;
}
// one frame of the secondary; returns [vx, vz, speed]
export function secondaryFrame(p, dt, ctx) {
  const g = p.g, a = p.w2, { inp, locked, mx, mz, mlen, aspd } = ctx;
  if (!a) { p.setState('move'); return [0, 0, 0]; }
  const d = a.def, held = inp.down('secondary');
  if (locked) { cancelSecondary(p, 'locked'); return [0, 0, 0]; }
  const scale = a.phase === 'charge' ? 1 : aspd;
  a.t += dt * scale;
  if (a.phase === 'windup' || a.phase === 'charge' || (a.phase === 'active' && d.track)) p.faceAim();
  // dodging: free before release, allowed after it only in a channel or late in the recovery
  if (inp.pressed('roll')) {
    const ok = a.phase === 'windup' || a.phase === 'charge' || (a.phase === 'active' && d.cancel?.active) || (a.phase === 'recover' && a.t >= (d.cancel?.recover ?? 0.1));
    if (ok) { const wasFired = a.fired; cancelSecondary(p, 'dodge'); if (!wasFired) p.secCd = 0.15; p.startRoll(mx, mz, mlen); return [0, 0, 0]; }
  }
  let v = null;
  switch (a.phase) {
    case 'windup':
      if (!held) a.released = true;
      if (a.t >= d.windup) { a.t = 0; if (d.charge) { a.phase = 'charge'; if (a.released && d.charge) a.quick = true; } else releaseSecondary(p, a); }
      break;
    case 'charge': {
      if (!held) a.released = true;
      const before = a.charge; a.charge += dt;
      if (before < d.charge.full && a.charge >= d.charge.full) { sfx('charged'); g.fx.ring(p.x, p.z, 0.2, 0.8, d.spell ? 0xff8a2a : 0xffd25e, 0.25); }
      if (Math.random() < 0.5) { const k = Math.min(1, a.charge / d.charge.full), ang = a.charge * 9, R = 0.6 * (1 - k) + 0.12; g.fx.add({ x: p.x + Math.sin(p.facing) * 0.35 + Math.cos(ang) * R, y: 0.6, z: p.z + Math.cos(p.facing) * 0.35 + Math.sin(ang) * R, g: 0, drag: 0, color: d.spell ? (k >= 1 ? 0xff8a2a : 0xffc080) : (k >= 1 ? 0xffd25e : 0xfff3b0), life: 0.25, size: 0.045 }); }
      // a tap still casts: the charge simply runs to its minimum first
      if ((a.released && a.charge >= d.charge.min) || a.charge >= (d.charge.max ?? 3)) releaseSecondary(p, a);
      break;
    }
    case 'active':
      v = d.tick ? d.tick(p, dt * scale, a) : null;
      if (p.w2 === a && a.t >= (a.activeDur ?? d.active)) { a.phase = 'recover'; a.t = 0; }
      break;
    case 'recover':
      if (d.tick && d.anim && d.anim.startsWith('chain')) d.tick(p, dt, a);
      if (a.t >= (d.cancel?.recover ?? 0.1) && !locked) {
        if (p.tryAbility()) { p.w2 = null; return [0, 0, 0]; }
        if (inp.pressed('attack')) { endSecondary(p); p.basicAttack(); return [0, 0, 0]; }
      }
      if (a.t >= d.recover) endSecondary(p);
      break;
  }
  const mv = (d.move && d.move[a.phase]) ?? DEFAULT_MOVE[a.phase] ?? 0.5;
  return [v ? v[0] : 0, v ? v[1] : 0, g.pstats.speed * mv];
}
