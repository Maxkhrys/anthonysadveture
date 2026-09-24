// Weapon reinforcement at Posy's workbench: +1 .. +20, 5% damage per level (persistence/model.js
// REINFORCEMENT). A reinforcement only raises upgradeLevel: the item keeps its identity, affixes,
// engraving, crafted mutations and look. Nothing is re-rolled, so it cannot be used to re-roll.
import { REINFORCEMENT, reinforcementMultiplier, reinforceWeapon } from '../persistence/model.js';

// cost of the NEXT level for a weapon at level L
export function reinforceCost(it) {
  const L = it.upgradeLevel || 0;
  const mats = { shard: 2 + L };
  if (L >= 4 && L < 9) mats.mantis = 1;
  else if (L >= 9 && L < 14) mats.porcelain = 1;
  else if (L >= 14) { mats.filament = 1; mats.echo = 1; }
  return { mats, pips: Math.round(25 * Math.pow(L + 1, 1.45)) };
}
export function reinforcePreview(it) {
  const m0 = reinforcementMultiplier(it), m1 = 1 + ((it.upgradeLevel || 0) + 1) * REINFORCEMENT.damagePerLevel;
  return { level: it.upgradeLevel || 0, next: (it.upgradeLevel || 0) + 1, max: REINFORCEMENT.maxLevel,
    before: [Math.round(it.min * m0), Math.round(it.max * m0)], after: [Math.round(it.min * m1), Math.round(it.max * m1)] };
}
export function checkReinforce(g, it) {
  const inv = g.inv;
  if (!it || it.slot !== 'weapon') return { ok: false, reason: 'Choose a weapon.' };
  const held = inv.equip.weapon === it || inv.bag.includes(it);
  if (!held) return { ok: false, reason: 'That weapon is no longer in your pack.' };
  if ((it.upgradeLevel || 0) >= REINFORCEMENT.maxLevel) return { ok: false, reason: `Already +${REINFORCEMENT.maxLevel}: the steel can take no more.` };
  const cost = reinforceCost(it);
  for (const k in cost.mats) if ((inv.mats[k] || 0) < cost.mats[k]) return { ok: false, reason: `Needs ${cost.mats[k]} × ${k}.`, cost, lack: k };
  if (inv.coins < cost.pips) return { ok: false, reason: `Needs ${cost.pips} pips (you have ${inv.coins}).`, cost };
  return { ok: true, cost };
}
// all-or-nothing: validate, then take the cost and raise the level
export function reinforce(g, it) {
  const c = checkReinforce(g, it);
  if (!c.ok) return c;
  const snapshot = JSON.stringify({ id: it.itemInstanceId, affixes: it.affixes, stats: it.stats, craft: it.craft, name: it.name });
  if (!reinforceWeapon(it)) return { ok: false, reason: 'This weapon cannot be reinforced.' };
  for (const k in c.cost.mats) g.inv.mats[k] -= c.cost.mats[k];
  g.inv.coins -= c.cost.pips;
  g.stats.reinforced = (g.stats.reinforced || 0) + 1;
  g.recalc(); g.save();
  return { ok: true, cost: c.cost, level: it.upgradeLevel, unchanged: snapshot === JSON.stringify({ id: it.itemInstanceId, affixes: it.affixes, stats: it.stats, craft: it.craft, name: it.name }) };
}
