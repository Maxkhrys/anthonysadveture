import { reinforcementMultiplier } from '../persistence/model.js';
import { XP_PROGRESSION } from './progression.js';
// Classes, derived stats, experience.
import { unitAt } from './items.js';
import { treeStats, rankOf, ensureTree } from './skills.js';
import { SETS, weaponFamily, CLASS_FAMILIES, OFFCLASS_SCALING } from './gear.js';

export const CLASSES = {
  samurai: {
    id: 'samurai', name: 'Samurai', role: 'Blade master · melee',
    blurb: 'A wandering Mossling duelist. Fast katana combos, a charged spin, and devastating dashes. Builds Ki by landing hits.',
    res: 'Ki', resColor: '#ff6a5a', resRegen: 3, hp: 62, hpLv: 12, armor: 6, armorLv: 1, crit: 6, speed: 5.0,
    colors: { tunic: 0x2f3f5a, tunicD: 0x223048, scarf: 0xd8342c, trim: 0xe8e0d0 },
    stats: { Power: 4, Toughness: 4, Range: 1, Mobility: 3 },
    basic: 'Katana combo (tap) · Spin slash (hold)',
    abilities: [
      { id: 'iaido', name: 'Iaido Dash', key: '1', lvl: 1, cost: 25, cd: 4, desc: 'Dash through enemies, cutting everything in your path.' },
      { id: 'tempest', name: 'Blade Tempest', key: '2', lvl: 3, cost: 40, cd: 8, desc: 'Become a whirlwind of steel for a moment.' },
      { id: 'oni', name: 'Oni Cleave', key: '3', lvl: 6, cost: 60, cd: 12, desc: 'A colossal overhead cleave in a wide arc.' },
    ],
  },
  archer: {
    id: 'archer', name: 'Archer', role: 'Sharpshooter · ranged',
    blurb: 'A keen-eyed Mossling ranger. Kites crowds with arrows, sets snares and calls down volleys. Focus regenerates quickly.',
    res: 'Focus', resColor: '#7fd36a', resRegen: 14, hp: 52, hpLv: 9, armor: 3, armorLv: 0.6, crit: 9, speed: 5.4,
    colors: { tunic: 0x4a7a3a, tunicD: 0x3a6a2e, scarf: 0xe0b83a, trim: 0x8a6a3a },
    stats: { Power: 3, Toughness: 2, Range: 5, Mobility: 5 },
    basic: 'Arrow (tap) · Piercing power shot (hold)',
    abilities: [
      { id: 'multishot', name: 'Multishot', key: '1', lvl: 1, cost: 20, cd: 2.5, desc: 'Loose a fan of five arrows.' },
      { id: 'snare', name: 'Snare Trap', key: '2', lvl: 3, cost: 30, cd: 7, desc: 'Drop a trap that roots and blasts the first enemies to touch it.' },
      { id: 'rain', name: 'Rain of Arrows', key: '3', lvl: 6, cost: 50, cd: 11, desc: 'Arrows pour down on the area ahead of you.' },
    ],
  },
  witch: {
    id: 'witch', name: 'Witch', role: 'Hexcaster · magic',
    blurb: 'A Mossling of the old wood-craft. Homing bolts, charged fireballs, ice, lightning and a hex familiar. Fragile but ferocious.',
    res: 'Mana', resColor: '#6a9aff', resRegen: 11, hp: 46, hpLv: 8, armor: 2, armorLv: 0.4, crit: 6, speed: 5.0,
    colors: { tunic: 0x5a3a8a, tunicD: 0x44296e, scarf: 0x7fd36a, trim: 0xffd25e },
    stats: { Power: 5, Toughness: 1, Range: 4, Mobility: 3 },
    basic: 'Homing bolt (tap) · Fireball (hold)',
    abilities: [
      { id: 'nova', name: 'Frost Nova', key: '1', lvl: 1, cost: 30, cd: 6, desc: 'Freeze everything around you solid.' },
      { id: 'chain', name: 'Chain Lightning', key: '2', lvl: 3, cost: 35, cd: 4, desc: 'Lightning leaps between up to five foes.' },
      { id: 'familiar', name: 'Hex Familiar', key: '3', lvl: 6, cost: 50, cd: 18, desc: 'Summon a spectral cat that hexes your enemies.' },
    ],
  },
};

export const MAX_LEVEL = XP_PROGRESSION.maxLevel;
export const xpNeed = l => XP_PROGRESSION.thresholds[l - 1] ?? Infinity;

export function computeStats(inv) {
  const C = CLASSES[inv.cls] || CLASSES.samurai;
  const L = inv.level;
  if (!inv.tree) ensureTree(inv);
  const s = { dmgPct: 0, crit: C.crit, critDmg: 50, atkSpd: 0, lifesteal: 0, regen: 0, resRegen: 0, moveSpd: 0, cdr: 0, abilityDmg: 0, mf: 0, xpPct: 0, burn: 0, chill: 0, shock: 0, echoDmg: 0, projSize: 0, reach: 0, armor: Math.round(C.armor + C.armorLv * (L - 1)), hp: C.hp + C.hpLv * (L - 1) + 15 * (inv.vessels || 0) };
  s.uniques = new Set(); s.qual = new Set(); s.sets = {};
  for (const it of Object.values(inv.equip)) {
    if (!it) continue;
    for (const k in it.stats) s[k] = (s[k] || 0) + it.stats[k];
    if (it.unique) s.uniques.add(it.unique);
    if (it.set) s.sets[it.set] = (s.sets[it.set] || 0) + 1;
    if (it.rolledAffixes) for (const a of it.rolledAffixes) if (a.qualitative) s.qual.add(a.qualitative.id);
  }
  // skill tree passives
  const T = treeStats(inv);
  for (const k in T) s[k] = (s[k] || 0) + T[k];
  // armour sets: 2-piece and full (5-piece) bonuses
  s.setBonus = {};
  for (const [id, n] of Object.entries(s.sets)) {
    const S = SETS[id]; if (!S) continue;
    const tier = n >= 5 ? 5 : n >= 2 ? 2 : 0;
    s.setBonus[id] = tier;
    if (tier >= 2) for (const k in S.bonus2.stats) s[k] = (s[k] || 0) + S.bonus2.stats[k];
    if (tier >= 5) for (const k in S.bonus5.stats) s[k] = (s[k] || 0) + S.bonus5.stats[k];
  }
  const w = inv.equip.weapon;
  // weapon affinity: any class can wield anything; your own class's weapons scale fully
  s.family = weaponFamily(w) || CLASS_FAMILIES[inv.cls][0];
  s.specialist = !w || !w.cls || w.cls === inv.cls;
  s.affinity = s.specialist ? 1 : OFFCLASS_SCALING;
  const fallback = unitAt(L) * 0.5;
  s.wmin = w ? w.min * reinforcementMultiplier(w) * s.affinity : Math.round(fallback * 0.8); s.wmax = w ? w.max * reinforcementMultiplier(w) * s.affinity : Math.round(fallback * 1.2);
  // keystone trade-offs
  if (rankOf(inv, 'bellofruin')) s.atkSpd -= 15;
  if (rankOf(inv, 'tempestquiver')) s.resRegen -= 25;
  if (rankOf(inv, 'mothcovenant')) s.resRegen -= 20;
  s.wspd = (w ? w.spd : 1) * (1 + s.atkSpd / 100);
  s.maxHp = Math.round(s.hp * (rankOf(inv, 'endlessgale') ? 0.85 : 1));
  s.speed = C.speed * (1 + s.moveSpd / 100);
  s.resRegenRate = C.resRegen * (1 + s.resRegen / 100);
  s.crit = Math.min(75, s.crit);
  s.cdr = Math.min(40, s.cdr);
  s.dr = 100 / (100 + s.armor * 1.8); // damage multiplier after armour
  if (s.setBonus.bellwarden >= 5) s.dr *= 0.9;
  if (rankOf(inv, 'cinderheart')) s.dr *= 1.15;
  if (s.uniques.has('tuningfork')) s.surgeGain = 0.75;
  // Pass 6 accessories
  if (s.uniques.has('crowmantle')) s.speed *= 1.15;
  if (s.uniques.has('nestcarapace')) s.dr = 100 / (100 + s.armor * 1.15 * 1.8) * (s.dr / (100 / (100 + s.armor * 1.8)));
  if (s.uniques.has('mirrorshard')) s.projSize = (s.projSize || 0) + 25;
  return s;
}

export function abilityRankMult(rank) { return 1 + 0.25 * (Math.max(1, rank) - 1); }
