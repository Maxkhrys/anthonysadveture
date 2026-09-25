// Crafting: a weapon (or an ability) + a rare essence + Hush Shards -> one behaviour-changing
// modifier. All checks happen before anything is taken, so a failed craft costs nothing.
import { CLASSES } from './classes.js';

export const MATS = {
  shard: { name: 'Hush Shard', icon: '◇', color: '#c9a8ff', desc: 'Salvaged from gear and shaken loose from elites. The Hush, crystallised.' },
  thornheart: { name: 'Thornheart', icon: '❦', color: '#7fd36a', desc: 'A still-beating knot of briar. Bramblemaw carried one; Barkhulks sometimes do.' },
  echo: { name: 'Hollow Echo', icon: '◎', color: '#9ad8ff', desc: 'A sound that forgot to stop. Found where the old Bellwrights left their marks, and in Rift Champions.' },
  ember: { name: 'Ember Mote', icon: '✹', color: '#ffb347', desc: 'A spark that refuses to go out. Ember Imps and Volatile elites shed them.' },
  sailcloth: { name: 'Mill Sailcloth', icon: '⚑', color: '#f2e2c0', desc: 'Oswin\'s spare sail, stiff with flour and wind.' },
  // Pass 5 materials (new creatures, the Conservatory, the Seamkeeper, the Crowned Toad)
  mantis: { name: 'Needle Scythe', icon: '⟋', color: '#b8e070', desc: 'The honed foreleg of a Needle Mantis. Holds an edge forever.' },
  wax: { name: 'Candle Wax', icon: '▮', color: '#f0e0b0', desc: 'Warm wax from a Candle Slug. Still smells of old chapels.' },
  moth: { name: 'Moth Dust', icon: '✧', color: '#f0ecd8', desc: 'Pale dust from a Lantern Moth\'s wings. It glows when you breathe on it.' },
  porcelain: { name: 'Porcelain Shard', icon: '◆', color: '#e8e0d0', desc: 'A curved sliver of glazed shell from a Porcelain Guard.' },
  filament: { name: 'Resonant Filament', icon: '〰', color: '#e0b860', desc: 'A hair-thin bell-metal thread that hums when plucked. Bell Leeches grow them.' },
  seamthread: { name: "Seamkeeper's Thread", icon: '⌇', color: '#d84a6a', desc: 'A red thread strong enough to stitch the air shut.' },
  crownpearl: { name: 'Crown Pearl', icon: '●', color: '#bfe8d0', desc: 'A green-gold pearl from the Crowned Toad\'s crown.' },
  // Pass 6 materials (world events and the Tollcrow)
  stardust: { name: 'Stardust', icon: '✦', color: '#c8e8ff', desc: 'Cold, bright grit from a fallen star\'s crater. It hums a note nobody taught it.' },
  crowfeather: { name: 'Tollcrow Feather', icon: '⸙', color: '#6a6a7a', desc: 'An iron-dark feather from the bird that nests in the Great Bell. It rings when it falls.' },
};
const ALL_BASES = ['katana', 'bow', 'staff', 'wand', 'oversized', 'chain'];

// kind: 'weapon' (engraving on one weapon) or 'sigil' (modifies one class ability)
export const RECIPES = [
  { id: 'thornrebuke', kind: 'weapon', name: 'Thorn Rebuke', cls: 'samurai', bases: ['katana'], mats: { thornheart: 1, shard: 6 }, pips: 40,
    effect: 'A perfect parry bursts thorns around you, and your next swing within 2 s looses a thorn crescent that pierces and roots.',
    hint: 'Defeat what guards the Verdant Chime.' },
  { id: 'echofletch', kind: 'weapon', name: 'Echo Fletching', cls: 'archer', bases: ['bow'], mats: { echo: 1, shard: 6 }, pips: 40,
    effect: 'Fully charged shots leave an echo: 0.6 s later a spectral arrow re-fires along the same path from where you loosed it (60% damage). Echoes never echo.',
    hint: 'Defeat what guards the Verdant Chime, or find a Hollow Echo.' },
  { id: 'emberseeds', kind: 'weapon', name: 'Ember Seeds', cls: 'witch', bases: ['staff', 'wand'], mats: { ember: 1, shard: 6 }, pips: 40,
    effect: 'Charged fireballs plant three ember seeds where they burst. Each swells visibly and detonates 1.2 s later (70% damage, burns). Seeds never plant seeds.',
    hint: 'Defeat what guards the Verdant Chime, or find an Ember Mote.' },
  { id: 'lanternknot', kind: 'weapon', name: 'Lantern Knot', cls: 'soulbound', bases: ['chain'], mats: { echo: 1, shard: 6 }, pips: 40,
    effect: 'SoulChain combo finishers leave a ring of spirit light where they land. 0.6 s later it rings again for 60% damage. Rings never ring twice.',
    hint: 'Defeat what guards the Verdant Chime, or find a Hollow Echo.' },
  { id: 'millwind', kind: 'weapon', name: 'Millwind Edge', cls: null, bases: ALL_BASES, mats: { sailcloth: 1, shard: 8 }, pips: 60,
    effect: 'Your charged attack (spin, power shot or fireball) also throws a gust along your aim: it knocks foes back, reflects spores, spins pinwheels and blows out flames.',
    hint: 'Help Miller Oswin get his mill turning again.' },
  { id: 'returningcut', kind: 'sigil', name: 'Returning Cut', cls: 'samurai', ability: 0, mats: { echo: 1, shard: 5 }, pips: 30,
    effect: 'Iaido Dash leaves an afterimage that repeats the cut along the same path 0.5 s later (70% damage).',
    hint: 'Read what the Bellwrights left behind the Echo Door.' },
  { id: 'echosnare', kind: 'sigil', name: 'Echo Snare', cls: 'archer', ability: 1, mats: { echo: 1, shard: 5 }, pips: 30,
    effect: 'Snare Trap re-arms once after it springs: the same spot blasts and roots again 1 s later.',
    hint: 'Read what the Bellwrights left behind the Echo Door.' },
  { id: 'rimebloom', kind: 'sigil', name: 'Rime Bloom', cls: 'witch', ability: 0, mats: { thornheart: 1, shard: 5 }, pips: 30,
    effect: 'Frost Nova leaves a ring of rime for 3 s that chills foes inside. Your next hit on a frozen foe shatters the ice for +60% damage.',
    hint: 'Ask the Root Hermit about the Hollow, once its guardian has fallen.' },
  { id: 'hollowhook', kind: 'sigil', name: 'Hollow Hook', cls: 'soulbound', ability: 0, mats: { thornheart: 1, shard: 5 }, pips: 30,
    effect: 'Soul Hook drags every small foe along its line toward you, not only the first one it catches.',
    hint: 'Read what the Bellwrights left behind the Echo Door.' },
  // ---- Pass 5: six engravings tied to the new content. Every one changes behaviour.
  { id: 'seamstitch', kind: 'weapon', name: 'Seamstitch', cls: null, bases: ALL_BASES, mats: { seamthread: 1, shard: 8 }, pips: 80,
    effect: 'One hit in five stitches the foe to its nearest neighbour for 3 s: they share 30% of the damage either takes, and snap apart if dragged too far.',
    hint: 'Cut down the Seamkeeper in the Cracked Conservatory.' },
  { id: 'waxseal', kind: 'weapon', name: 'Wax Seal', cls: null, bases: ALL_BASES, mats: { wax: 2, shard: 6 }, pips: 50,
    effect: 'Striking a burning foe seals it in wax: it slows by 40% for 3 s. Your next fire hit on a sealed foe cracks the seal for +50% damage.',
    hint: 'Candle Slugs leave the wax you need.' },
  { id: 'mothwing', kind: 'weapon', name: 'Mothwing Draw', cls: null, bases: ALL_BASES, mats: { moth: 2, shard: 6 }, pips: 50,
    effect: 'Every charged attack releases three pale moths that seek the nearest foes (40% damage each).',
    hint: 'Catch the dust of a Lantern Moth.' },
  { id: 'porcelainguard', kind: 'weapon', name: 'Porcelain Guard', cls: null, bases: ALL_BASES, mats: { porcelain: 3, shard: 8 }, pips: 60,
    effect: 'A perfect parry or perfect dodge glazes you in porcelain: the next blow within 4 s is reduced by 60%, and the shell shatters into shards around you.',
    hint: 'Something in the Conservatory keeps a glazed cabinet of secrets.' },
  { id: 'tollring', kind: 'weapon', name: 'Tolling Edge', cls: null, bases: ALL_BASES, mats: { filament: 1, echo: 1, shard: 8 }, pips: 70,
    effect: 'Every fifth basic hit rings a resonance toll around the target: a small shockwave that staggers foes nearby.',
    hint: 'Elder Tamsin knows the old Bellwright\'s trick — once the Conservatory speaks again.' },
  { id: 'crowntongue', kind: 'weapon', name: 'Crowned Tongue', cls: null, bases: ALL_BASES, mats: { crownpearl: 1, shard: 10 }, pips: 120,
    effect: 'Every charged attack first lashes out a sticky tongue that yanks the foe you aim at to your feet and soaks it.',
    hint: 'Only the Crowned Toad knows this trick.' },
];
export const recipeById = id => RECIPES.find(r => r.id === id);
// moving an engraving you already own onto a better weapon: no essence needed
export const TRANSFER = { shard: 3, pips: 25 };

export function ensureCraftState(inv) {
  inv.mats = Object.assign({ shard: 0, thornheart: 0, echo: 0, ember: 0, sailcloth: 0 }, inv.mats || {});
  inv.sigils = inv.sigils || {};           // ability index -> recipe id (installed)
  inv.recipes = inv.recipes || [];         // discovered recipe ids
}
export const knows = (inv, id) => (inv.recipes || []).includes(id);

// every weapon the player holds, equipped first
export function allWeapons(inv) {
  const out = [];
  if (inv.equip.weapon) out.push({ it: inv.equip.weapon, where: 'equipped' });
  inv.bag.forEach((it, i) => { if (it && it.slot === 'weapon') out.push({ it, where: 'bag', i }); });
  return out;
}
export function engravedWith(inv, id) { return allWeapons(inv).find(w => w.it.craft === id); }

// Can this recipe be made with this base right now? Returns { ok, reason, cost }
export function check(g, r, it) {
  const inv = g.inv;
  if (!r) return { ok: false, reason: 'Unknown recipe.' };
  if (!knows(inv, r.id)) return { ok: false, reason: 'Not yet discovered. ' + r.hint };
  if (r.id === 'millwind' && g.flags.q_mill !== 2) return { ok: false, reason: 'Oswin has not shown you how yet.' };
  if (r.cls && r.cls !== inv.cls) return { ok: false, reason: 'Only a ' + CLASSES[r.cls].name + ' can use this.' };
  let cost = { mats: r.mats, pips: r.pips }, transfer = false;
  if (r.kind === 'weapon') {
    if (!it) return { ok: false, reason: 'Choose a weapon to engrave.' };
    if (!allWeapons(inv).some(w => w.it === it)) return { ok: false, reason: 'That weapon is no longer in your pack.' };
    if (!r.bases.includes(it.kind)) return { ok: false, reason: 'Needs a ' + r.bases.join(' or ') + '.' };
    if (r.cls && it.cls && it.cls !== r.cls) return { ok: false, reason: 'That weapon belongs to another class.' };
    if (it.craft === r.id) return { ok: false, reason: 'Already engraved with ' + r.name + '.' };
    const owner = engravedWith(inv, r.id);
    if (owner) { transfer = owner.it; cost = { mats: { shard: TRANSFER.shard }, pips: TRANSFER.pips }; }
  } else if (inv.sigils[r.ability] === r.id) {
    return { ok: false, reason: 'Already set into ' + CLASSES[r.cls].abilities[r.ability].name + '. Press X to remove it.', cost: { mats: {}, pips: 0 } };
  } else if ((inv.sigilsOwned || []).includes(r.id)) {
    cost = { mats: {}, pips: 0 }; // already made: installing it again is free
  }
  for (const k in cost.mats) if ((inv.mats[k] || 0) < cost.mats[k]) return { ok: false, reason: `Needs ${cost.mats[k]} ${MATS[k].name} (you have ${inv.mats[k] || 0}).`, cost, transfer };
  if (inv.coins < cost.pips) return { ok: false, reason: `Needs ${cost.pips} pips (you have ${inv.coins}).`, cost, transfer };
  return { ok: true, cost, transfer };
}

// The transaction. Validates everything first; only then takes materials and applies.
export function craft(g, id, it) {
  const r = recipeById(id), inv = g.inv;
  const c = check(g, r, it);
  if (!c.ok) return c;
  for (const k in c.cost.mats) inv.mats[k] -= c.cost.mats[k];
  inv.coins -= c.cost.pips;
  if (r.kind === 'weapon') {
    const replaced = it.craft ? recipeById(it.craft).name : null;
    if (c.transfer) { delete c.transfer.craft; c.transfer.name = c.transfer.craftBaseName || c.transfer.name; delete c.transfer.craftBaseName; }
    if (!it.craftBaseName) it.craftBaseName = it.name;
    it.craft = r.id;
    it.name = it.craftBaseName + ' ✦';
    c.replaced = replaced;
  } else {
    inv.sigilsOwned = inv.sigilsOwned || [];
    if (!inv.sigilsOwned.includes(r.id)) inv.sigilsOwned.push(r.id);
    inv.sigils[r.ability] = r.id;
  }
  g.stats.crafted = (g.stats.crafted || 0) + 1;
  g.recalc();
  g.save();
  return { ok: true, recipe: r, ...c };
}
export function removeSigil(g, ability) { delete g.inv.sigils[ability]; g.save(); }

// helpers the combat code asks
export const hasEngraving = (g, id) => !!(g.inv.equip.weapon && g.inv.equip.weapon.craft === id);
export const hasSigil = (g, ability, id) => g.inv.sigils && g.inv.sigils[ability] === id;

export function learn(g, id, quiet) {
  const inv = g.inv; ensureCraftState(inv);
  if (knows(inv, id)) return false;
  inv.recipes.push(id);
  const r = recipeById(id);
  if (!quiet) g.ui.toast('Recipe learned: ' + r.name, (r.cls ? CLASSES[r.cls].name + ' · ' : 'Any class · ') + 'Craft it at Posy\'s workbench.', 3.2);
  g.save();
  return true;
}
export function gainMat(g, k, n = 1, x, z) {
  const inv = g.inv; ensureCraftState(inv);
  inv.mats[k] = (inv.mats[k] || 0) + n;
  const M = MATS[k];
  g.ui.lootToast({ r: k === 'shard' ? 1 : 3, name: `${M.icon} ${M.name}${n > 1 ? ' ×' + n : ''}`, slot: 'charm', kind: null }, '');
  if (x !== undefined && k !== 'shard') g.fx.burst(x, 0.6, z, 14, [parseInt(M.color.slice(1), 16), 0xffffff], 2.5, { g: -1 });
  // an essence hints at what it's for, the first time you hold one
  if (k === 'thornheart' && inv.cls === 'samurai') learn(g, 'thornrebuke');
  if (k === 'echo' && inv.cls === 'archer') learn(g, 'echofletch');
  if (k === 'ember' && inv.cls === 'witch') learn(g, 'emberseeds');
  if (k === 'echo' && inv.cls === 'soulbound') learn(g, 'lanternknot');
}
