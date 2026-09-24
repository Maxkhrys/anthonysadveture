// Element combinations: the first systemic layer. Statuses live on enemies (enemy.status:
// burn, chill, freeze, shock, wet, root, mark, hex). A hit carries an element; REACTIONS decide
// what happens when a hit's element meets a status. Everything is data-first so the later
// elemental physics pass can add rules (spreading water, burning grass...) without touching
// combat code: push an entry into REACTIONS with `test` and `apply`.
import { sfx } from '../engine/audio.js';

// damage kind -> element (projectiles and abilities may override with an explicit element)
export const ELEMENT_OF = {
  sword: 'steel', spin: 'heavy', spin3: 'heavy', dash: 'steel', arrow: 'steel', power: 'steel', needle: 'steel', rain: 'steel',
  bolt: 'arcane', fireball: 'fire', comet: 'fire', blast: 'fire', ember: 'fire', frost: 'frost', shock: 'lightning', thread: 'lightning',
  thorn: 'thorn', crescent: 'steel', wind: 'wind', surge: 'resonance', resonance: 'resonance', heavy: 'heavy', quake: 'heavy', slam: 'heavy',
  echo: 'echo', hex: 'hex', moth: 'hex', shard: 'glass', splash: 'water',
};
export const HEAVY_KINDS = new Set(['spin', 'spin3', 'surge', 'heavy', 'quake', 'slam']);
export const isHeavy = h => HEAVY_KINDS.has(h.kind) || h.element === 'heavy' || !!h.heavy;
export const elementOf = h => h.element || ELEMENT_OF[h.kind] || 'steel';

export const STATUS_INFO = {
  burn: { name: 'Burning', color: '#ff8a2a' }, chill: { name: 'Chilled', color: '#aee8ff' }, freeze: { name: 'Frozen', color: '#dff4ff' },
  wet: { name: 'Wet', color: '#6ab8ff' }, shock: { name: 'Shocked', color: '#fff3b0' }, root: { name: 'Rooted', color: '#7fd36a' },
  mark: { name: 'Marked', color: '#ff5a8a' }, hex: { name: 'Hexed', color: '#b88aff' },
};

const near = (g, x, z, r, not) => g.entities.filter(e => e.isEnemy && !e.dead && e !== not && Math.hypot(e.x - x, e.z - z) < r + (e.r || 0.3));
function label(g, e, text, color) { g.ui.float(e.x, 1.35, e.z, text, color, false, true); }

// Each reaction: test(g, enemy, hit, S) -> bool; apply(...) -> damage multiplier for this hit.
export const REACTIONS = [
  {
    id: 'conduct', name: 'Conducted', desc: 'Lightning on a wet foe: +50% damage, and it arcs through every wet foe nearby.',
    test: (g, e, h, S) => elementOf(h) === 'lightning' && S.wet > 0,
    apply(g, e, h) {
      if (!h.conducted) {
        const others = near(g, e.x, e.z, 3.5, e).filter(o => o.status && o.status.wet > 0).slice(0, 6);
        if (others.length) { sfx('zap'); for (const o of others) { g.fxBolt(e.x, e.z, o.x, o.z, 0x6ab8ff); g.playerHit(o, { mult: (h.mult || 1) * 0.5, kind: 'shock', kb: 1, dir: Math.atan2(o.x - e.x, o.z - e.z), ability: true, noShock: true, conducted: true, quiet: true }); } }
        label(g, e, 'CONDUCTED', '#6ab8ff');
      }
      g.fx.ring(e.x, e.z, 0.1, 1.2, 0x6ab8ff, 0.25);
      return 1.5;
    },
  },
  {
    id: 'shatter', name: 'Shatter', desc: 'A heavy blow on a frozen foe: ×2.2 damage and a long stagger.',
    test: (g, e, h, S) => S.freeze > 0 && (isHeavy(h) || (elementOf(h) === 'lightning' && g.talent('conductor'))),
    apply(g, e, h, S) {
      S.freeze = 0; e.stagger = Math.max(e.stagger || 0, 0.8);
      sfx('shatter'); g.hitstop(0.08); g.pr.addShake(0.35);
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 4; g.fx.add({ x: e.x, y: 0.45, z: e.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + Math.random() * 3, color: i % 3 ? 0xdff4ff : 0x9ad8ff, life: 0.7, size: 0.07, g: 12 }); }
      g.fx.ring(e.x, e.z, 0.2, 1.6, 0xdff4ff, 0.3);
      label(g, e, 'SHATTER', '#dff4ff');
      if (g.pstats.uniques.has('rimeshard')) g.player.reduceCooldowns(1.5);
      g.stats.shatters = (g.stats.shatters || 0) + 1;
      return 2.2;
    },
  },
  {
    id: 'firestorm', name: 'Fanned Flames', desc: 'Wind on a burning foe spreads its fire to everything within 2.2.',
    test: (g, e, h, S) => elementOf(h) === 'wind' && S.burn > 0 && !(e.fanT > g.time),
    apply(g, e, h, S) {
      e.fanT = g.time + 1;
      fanFlames(g, e, S);
      return 1.2;
    },
  },
  {
    id: 'flashfreeze', name: 'Flash Freeze', desc: 'Frost on a wet foe freezes it solid.',
    test: (g, e, h, S) => elementOf(h) === 'frost' && S.wet > 0 && !(S.freeze > 0),
    apply(g, e, h, S) { e.applyStatus('freeze', 1.2); S.wet = 0; label(g, e, 'FLASH FREEZE', '#dff4ff'); return 1; },
  },
  {
    id: 'steam', name: 'Steam Rupture', desc: 'Elemental Convergence (qualitative affix): fire on a chilled foe bursts in steam.',
    test: (g, e, h, S) => g.pstats.qual.has('elemental_convergence') && elementOf(h) === 'fire' && (S.chill > 0 || S.freeze > 0) && !h.steam,
    apply(g, e, h, S) {
      S.chill = 0;
      g.fx.burst(e.x, 0.4, e.z, 20, [0xffffff, 0xdfe8f0], 3.5, { life: 0.8, soft: true, g: -2 });
      for (const o of near(g, e.x, e.z, 1.6, e)) g.playerHit(o, { mult: 1.0, kind: 'blast', element: 'water', kb: 4, dir: Math.atan2(o.x - e.x, o.z - e.z), ability: true, steam: true, noProc: true });
      label(g, e, 'STEAM', '#ffffff'); sfx('extinguish');
      return 1.4;
    },
  },
];

export function fanFlames(g, e, S) {
  const dps = Math.max(1, (S && S.burnDps) || 2);
  sfx('ignite');
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = Math.random() * 2; g.fx.add({ x: e.x + Math.cos(a) * r, y: 0.2, z: e.z + Math.sin(a) * r, vx: -Math.sin(a) * 2, vz: Math.cos(a) * 2, vy: 1.5, g: -1, color: i % 3 ? 0xff8a2a : 0xffd25e, life: 0.6, size: 0.08 }); }
  g.fx.ring(e.x, e.z, 0.2, 2.2, 0xff8a2a, 0.35);
  for (const o of near(g, e.x, e.z, 2.2, e)) { o.applyStatus && o.applyStatus('burn', 3, dps); }
  if (S) S.burn = Math.max(S.burn, 3);
  label(g, e, 'FANNED', '#ffb347');
}

// Called from Game.playerHit with the rolled damage; returns the adjusted damage.
export function react(g, e, h, dmg) {
  const S = e.status;
  if (!S) return dmg;
  for (const R of REACTIONS) if (R.test(g, e, h, S)) { dmg *= R.apply(g, e, h, S); g.stats['react:' + R.id] = (g.stats['react:' + R.id] || 0) + 1; }
  return dmg;
}

// Soak an area (rain of arrows, splashes, the toad's pond)
export function soak(g, x, z, r, t = 4) {
  for (const e of near(g, x, z, r)) e.applyStatus && e.applyStatus('wet', t);
}
