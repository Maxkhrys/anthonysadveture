// Combat event bus: gameplay announces what happens, presentation listens.
// Weapon attacks emit these instead of scattering effects through combat code, so VFX, SFX,
// camera and UI layers can attach later without touching the rules:
//
//   attack.windup    an attack starts its anticipation        {attack, weapon, p}
//   attack.release   the damaging part of an attack goes off   {attack, weapon, p, charge}
//   attack.impact    a weapon attack hit something             {attack, target, x, z, element}
//   attack.cancel    an attack was abandoned before release    {attack, reason}
//   spell.cast       a spell leaves the hand                   {attack, weapon, p, element}
//   spell.impact     a spell hit something                     {attack, target, x, z, element}
//   weapon.secondary a right-click (secondary) attack began    {attack, weapon, p}
//   weapon.reload    a firearm reload started                  {weapon, p}
//
// Payloads carry the attack definition's `fx` id (e.g. 'witch.fireball') for lookup tables.
export const COMBAT_EVENTS = ['attack.windup', 'attack.release', 'attack.impact', 'attack.cancel', 'spell.cast', 'spell.impact', 'weapon.secondary', 'weapon.reload'];

export class CombatEvents {
  constructor() { this.handlers = new Map(); this.recent = []; this.counts = {}; }
  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(fn);
    return () => this.handlers.get(name)?.delete(fn);
  }
  emit(name, data = {}) {
    this.counts[name] = (this.counts[name] || 0) + 1;
    this.recent.push({ name, fx: data.attack?.fx || data.fx || null, attack: data.attack?.id || null });
    if (this.recent.length > 64) this.recent.shift();
    const hs = this.handlers.get(name);
    if (hs) for (const fn of hs) { try { fn(data); } catch (err) { console.error('[combat event]', name, err); } }
  }
}
export const combatEvents = g => g.combatEvents || (g.combatEvents = new CombatEvents());
