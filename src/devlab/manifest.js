// "Recently added" content manifest for MOSSDEV. Data only: the lab UI lists these and a
// one-click test prepares the sandbox character, item, legal skills, arena and targets from it.
// Future passes append entries; nothing in the interface needs rewriting.
//
//   id        stable content id (never renamed)
//   pass      the feature pass that added it
//   title     short name; desc: what it is; try: what to do once the test starts
//   registry  where the real implementation lives (checked at runtime: missing = not listed as ready)
//   cls, level, item {named|base, rarity?}, build (skill path to max legally, optional)
//   arena + opts: which arena and which controlled targets; seed: reproducible setup
import { SECONDARIES, SPELLS, WEAPON_OVERRIDES } from '../rpg/weapon_attacks.js';
import { makeNamed } from '../rpg/items.js';
import { REGISTRY } from '../rpg/registry.js';

export const RECENT = [
  // ---------------------------------------------------------------- class combat rework (Opus)
  { id: 'combat.fireball', pass: 'Class combat rework', title: 'Fire staff · Fireball', registry: ['secondary', 'fireball'], cls: 'witch', level: 12, item: { named: 'candlestaff' }, arena: 'dummy', seed: 11,
    desc: 'Right-click secondary on fire staffs: a chargeable fireball that bursts and sets foes burning.', try: 'Hold right click to charge, release at the dummy. Watch Burning uptime and DoT in the telemetry.' },
  { id: 'combat.candelabra', pass: 'Class combat rework', title: "Chandler's Blaze (Candelabra)", registry: ['override', 'candelabra'], cls: 'witch', level: 14, item: { named: 'candelabra' }, arena: 'crowd', opts: { crowdSize: 5, crowdKinds: ['blot', 'beetle'] }, seed: 12,
    desc: 'Legendary fire staff: the charged fireball splits into three when it bursts.', try: 'Charge a fireball into the pack and look for the three split bursts.' },
  { id: 'combat.chainbolt', pass: 'Class combat rework', title: 'Storm staff · Chain Bolt', registry: ['secondary', 'chainbolt'], cls: 'witch', level: 12, item: { named: 'owlstaff' }, arena: 'crowd', opts: { crowdSize: 5, crowdKinds: ['blot', 'beetle', 'wisp'] }, seed: 13,
    desc: 'Lightning secondary that arcs between enemies it actually hits.', try: 'Right-click into the pack. Each bolt segment should connect only foes that took damage.' },
  { id: 'combat.icelance', pass: 'Class combat rework', title: 'Frost staff · Ice Lance', registry: ['secondary', 'icelance'], cls: 'witch', level: 12, item: { named: 'frostrod' }, arena: 'element', seed: 14,
    desc: 'Piercing frost lance that builds freeze.', try: 'Lance the Chilled and Wet targets; a full freeze shows the ice shell, the next heavy hit shatters it.' },
  { id: 'combat.hexburst', pass: 'Class combat rework', title: 'Hex wand · Hex Burst', registry: ['secondary', 'hexburst'], cls: 'witch', level: 12, item: { named: 'hexwand' }, arena: 'dummy', seed: 15,
    desc: 'Curse bolts, then a burst that detonates stored hex.', try: 'Curse the dummy with left click, then right-click to detonate.' },
  { id: 'combat.yank', pass: 'Class combat rework', title: 'Heavy SoulChain · Yank', registry: ['secondary', 'yank'], cls: 'soulbound', level: 12, item: { named: 'gravechain' }, arena: 'crowd', opts: { crowdSize: 5, crowdKinds: ['beetle', 'brigand'] }, seed: 16,
    desc: 'The heavy chain hooks a foe and drags it to you.', try: 'Right-click a distant enemy; it is pulled in along the real chain rig.' },
  { id: 'combat.lantern', pass: 'Class combat rework', title: 'Lantern Follow-up (Lanternbearer)', registry: ['override', 'lanternchain'], cls: 'soulbound', level: 14, item: { named: 'lanternchain' }, arena: 'dummy', seed: 17,
    desc: 'Spirit chain legendary: its echo frees a lantern spirit that seeks a foe.', try: 'Right-click the dummy; the spirit release counts as a summon hit in telemetry.' },
  { id: 'combat.sundown', pass: 'Class combat rework', title: 'Sundown Fan (Gunslinger named)', registry: ['override', 'sundownsix'], cls: 'gunslinger', level: 14, item: { named: 'sundownsix' }, arena: 'dummy', seed: 18,
    desc: 'Fan the hammer through every round left in the cylinder.', try: 'Right-click with a full cylinder, then watch the reload complete.' },
  { id: 'combat.rifleburst', pass: 'Class combat rework', title: 'Automatic rifle · Burst', registry: ['secondary', 'burst'], cls: 'gunslinger', level: 12, item: { named: 'brassrifle' }, arena: 'dummy', seed: 19,
    desc: 'Rifle secondary: a controlled chilling burst.', try: 'Right-click; compare hits per second against the revolver.' },
  { id: 'combat.toll', pass: 'Class combat rework', title: 'Toll the Clapper (Samurai heavy)', registry: ['override', 'bellclapper'], cls: 'samurai', level: 14, item: { named: 'bellclapper' }, arena: 'crowd', opts: { crowdSize: 5, crowdKinds: ['blot', 'beetle'] }, seed: 20,
    desc: 'Overhead cleave that rings a resonance shockwave.', try: 'Right-click in the middle of the pack to stagger everything nearby.' },
  { id: 'combat.lily', pass: 'Class combat rework', title: 'Lily Splash (Archer)', registry: ['override', 'lilypad'], cls: 'archer', level: 14, item: { named: 'lilypad' }, arena: 'element', seed: 21,
    desc: 'Charged piercing shot that soaks everything it passes.', try: 'Soak a row of targets, then hit a Wet target with lightning for a reaction.' },
  // ---------------------------------------------------------------- enemies
  { id: 'elite.stormtouched', pass: 'Enemy combat pass', title: 'Storm-touched elite', registry: ['elite', 'Stormtouched'], cls: 'samurai', level: 12, item: { named: 'stormedge' }, arena: 'elite', opts: { eliteKind: 'knight', eliteMod: 'Stormtouched' }, seed: 22,
    desc: 'Elite modifier: lightning locks onto a spot, then strikes.', try: 'Step out of the marked circle before it lands.' },
  { id: 'elite.frostbound', pass: 'Enemy combat pass', title: 'Frostbound elite', registry: ['elite', 'Frostbound'], cls: 'archer', level: 12, item: { named: 'galebow' }, arena: 'elite', opts: { eliteKind: 'brigand', eliteMod: 'Frostbound' }, seed: 23,
    desc: 'Elite modifier: a slow pulse expands from the foe.', try: 'Leave the ring as it grows.' },
  // ---------------------------------------------------------------- this pass
  { id: 'fx.lightning', pass: 'Dev Lab + VFX pass', title: 'Lightning chains and sparks', registry: ['fx', 'lightning'], cls: 'witch', level: 12, item: { named: 'owlstaff' }, arena: 'crowd', opts: { crowdSize: 10, crowdKinds: ['blot', 'beetle'] }, seed: 24,
    desc: 'Bolts drawn from source to each target actually hit, with brief branches and sparks on shocked foes.', try: 'Cast Arc Bolt and Chain Bolt into the pack.' },
  { id: 'fx.deaths', pass: 'Dev Lab + VFX pass', title: 'Material hits and deaths', registry: ['fx', 'deaths'], cls: 'samurai', level: 14, item: { named: 'moonkatana' }, arena: 'crowd', opts: { crowdSize: 10, crowdKinds: ['brigand', 'sporeling', 'porcelain', 'mantis', 'wraith'] }, seed: 25,
    desc: 'Each enemy material (flesh, plant, construct, insect, spectral) hits and dies differently; frozen foes shatter.', try: 'Try Blood Off/Reduced/Full in Settings while fighting the mixed pack.' },
];

// Only entries whose implementation exists are offered as ready.
export function manifestStatus(e) {
  const [kind, id] = e.registry || [];
  let ok = true, why = '';
  if (kind === 'secondary') ok = !!SECONDARIES[id];
  if (kind === 'spell') ok = !!SPELLS[id];
  if (kind === 'override') ok = !!WEAPON_OVERRIDES[id];
  if (kind === 'elite') ok = REGISTRY.eliteModifiers.includes(id);
  if (!ok) why = 'Implementation not found: ' + kind + ' ' + id;
  if (ok && e.item) { try { ok = !!makeNamed(e.item.named, e.level, null, e.cls); if (!ok) why = 'Item cannot be built: ' + e.item.named; } catch (err) { ok = false; why = err.message; } }
  return { ok, why };
}
