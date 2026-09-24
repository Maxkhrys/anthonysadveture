// Skill trees and active abilities: one data registry for gameplay, the tree screen, the
// hotbar and developer tools. Everything here is plain data plus small pure helpers; the
// abilities themselves are cast in entities/player.js and rpg/abilities.js.
//
// Save shape (additive, inside the character inventory):
//   inv.tree    { nodeId: rank }   ranks bought in the tree (the three original abilities are
//                                  granted free at their unlock level, exactly as before)
//   inv.loadout [id|null x 6]      the six abilities on the hotbar
//   inv.skills  [r, r, r]          legacy mirror of the three original abilities (kept in sync)
//   inv.sp                         unspent points (one per level, unchanged)

export const LOADOUT_SIZE = 6;
export const MAX_ACTIVE_RANK = 5;

export const PATHS = {
  samurai: [
    { id: 'duelist', name: 'Duelist', color: '#ff6a5a', blurb: 'Precision, parries, crits and counters.' },
    { id: 'galeronin', name: 'Gale Ronin', color: '#9ad8ff', blurb: 'Mobility, wind blades and repeating Echo cuts.' },
    { id: 'bellbreaker', name: 'Bellbreaker', color: '#ffd25e', blurb: 'Heavy blows, stagger and huge resonance strikes.' },
  ],
  archer: [
    { id: 'hunter', name: 'Hunter', color: '#ffd25e', blurb: 'Weak points, crits and long charged shots.' },
    { id: 'trickshot', name: 'Trickshot', color: '#7fd36a', blurb: 'Ricochets, traps, tethers and trick arrows.' },
    { id: 'stormwood', name: 'Stormwood', color: '#9ad8ff', blurb: 'Lightning, wind and vast area volleys.' },
  ],
  witch: [
    { id: 'ember', name: 'Ember', color: '#ff8a2a', blurb: 'Fire, explosions, seeds and chain detonations.' },
    { id: 'rimestorm', name: 'Rime & Storm', color: '#9ad8ff', blurb: 'Frost, lightning, control and shatter.' },
    { id: 'hexweaver', name: 'Hexweaver', color: '#b88aff', blurb: 'Curses, familiars, moths and delayed Echo magic.' },
  ],
};

// ------------------------------------------------------------------ active abilities
// power: base damage multiplier per hit (x weapon damage) shown in tooltips; the cast code
// multiplies it by the rank multiplier. target: self | dir | ground | unit.
export const SKILLS = {
  // ---------------- Samurai
  iaido: { cls: 'samurai', path: 0, name: 'Iaido Dash', icon: '💨', cost: 25, cd: 4, target: 'dir', power: 2.2, element: 'steel', desc: 'Dash through enemies, cutting everything in your path.', hits: 'one cut per foe on the path' },
  ghostdraw: { cls: 'samurai', path: 0, name: 'Ghostdraw', icon: '👻', cost: 30, cd: 7, target: 'dir', power: 1.6, element: 'echo', desc: 'A lightning draw-cut. An Echo swordsman steps out of you and repeats the cut 0.7 s later. Drawn within 0.5 s of a perfect parry, both cuts are guaranteed crits.', hits: 'draw-cut + Echo repeat (×0.9)' },
  threadsever: { cls: 'samurai', path: 0, name: 'Thread Sever', icon: '✂️', cost: 35, cd: 9, target: 'dir', power: 0.9, element: 'resonance', desc: 'Two crossing cuts leave a humming thread in the air. It detonates a moment later along its whole length.', hits: '2 cuts + line detonation (×2.2)' },
  tempest: { cls: 'samurai', path: 1, name: 'Blade Tempest', icon: '🌀', cost: 40, cd: 8, target: 'self', power: 0.7, element: 'wind', desc: 'Become a whirlwind of steel for a moment.', hits: 'a cut every 0.18 s for 1.3 s' },
  galestep: { cls: 'samurai', path: 1, name: 'Gale Step', icon: '🍃', cost: 20, cd: 3.5, target: 'dir', power: 0.5, element: 'wind', desc: 'Step through the air in the direction you move, leaving a trail of cutting wind behind you.', hits: 'wind trail cuts 4× over 1.2 s' },
  kaze: { cls: 'samurai', path: 1, name: 'Kaze Crescent', icon: '🌙', cost: 30, cd: 5, target: 'dir', power: 1.6, element: 'wind', desc: 'Loose a crescent of wind that passes through everything. Wind fans flames: burning foes it touches spread their fire.', hits: 'piercing wind blade' },
  oni: { cls: 'samurai', path: 2, name: 'Oni Cleave', icon: '👹', cost: 60, cd: 12, target: 'dir', power: 5, element: 'heavy', desc: 'A colossal overhead cleave in a wide arc. Shatters frozen foes.', hits: 'one huge heavy blow' },
  bellquake: { cls: 'samurai', path: 2, name: 'Bellquake', icon: '🔔', cost: 45, cd: 10, target: 'dir', power: 2.4, element: 'heavy', desc: 'Drive your blade into the ground like a bell clapper. A resonance ring bursts out, and the ground ruptures along your aim a moment later.', hits: 'ring + 3 delayed ruptures (×0.7 each)' },
  // ---------------- Archer
  multishot: { cls: 'archer', path: 0, name: 'Multishot', icon: '🎯', cost: 20, cd: 2.5, target: 'dir', power: 0.9, element: 'steel', desc: 'Loose a fan of five arrows.', hits: '5 arrows' },
  ghostflight: { cls: 'archer', path: 0, name: 'Ghostflight', icon: '🪶', cost: 30, cd: 6, target: 'dir', power: 1.8, element: 'echo', desc: 'A piercing shot whose Echo flies the same path again 0.8 s later.', hits: 'piercing arrow + Echo (×0.7)' },
  snare: { cls: 'archer', path: 1, name: 'Snare Trap', icon: '🪤', cost: 30, cd: 7, target: 'ground', range: 5.5, radius: 1.9, def: 1.4, power: 3, element: 'thorn', desc: 'Drop a trap that roots and blasts the first enemies to touch it.', hits: 'root + blast' },
  tether: { cls: 'archer', path: 1, name: 'Briar Tether', icon: '🪢', cost: 25, cd: 8, target: 'unit', range: 7, power: 1.2, element: 'thorn', desc: 'Stitch up to three foes together with briar. Damage to one is shared with the others; if they are dragged apart the tether snaps, roots and cuts them all.', hits: '30% shared damage · snap (×1.2)' },
  ricochet: { cls: 'archer', path: 1, name: 'Skipping Shot', icon: '↯', cost: 20, cd: 4, target: 'dir', power: 1.1, element: 'steel', desc: 'An arrow that skips from foe to foe, 3 times plus once per rank.', hits: 'bounces between foes' },
  rain: { cls: 'archer', path: 2, name: 'Rain of Arrows', icon: '🌧️', cost: 50, cd: 11, target: 'ground', range: 8.5, radius: 2.5, def: 4, power: 0.55, element: 'steel', desc: 'Arrows pour down on the area. Leaves the ground wet.', hits: 'a volley every 0.25 s for 2.2 s' },
  stormpin: { cls: 'archer', path: 2, name: 'Stormpin Volley', icon: '⚡', cost: 40, cd: 10, target: 'ground', range: 7.5, radius: 1.8, def: 3.5, power: 0.5, element: 'lightning', desc: 'Plant four copper-tipped arrows in a ring. Lightning arcs between them for 4 s; wet foes conduct it further.', hits: 'arcs every 0.4 s' },
  needlerain: { cls: 'archer', path: 2, name: 'Needle Rain', icon: '📍', cost: 35, cd: 9, target: 'ground', range: 9, radius: 1.3, def: 4.5, power: 0.5, element: 'steel', desc: 'Mark a tight spot; a heartbeat later twelve needle-arrows strike it with pinpoint accuracy (+20% crit chance).', hits: '12 needles' },
  // ---------------- Witch
  embergarden: { cls: 'witch', path: 0, name: 'Ember Garden', icon: '🌱', cost: 30, cd: 7, target: 'ground', range: 7, radius: 1.6, def: 3, power: 1.3, element: 'fire', desc: 'Plant three dormant ember seeds. Fire sets them off, and each blast lights the next: chain detonations. Unlit seeds bloom on their own after 6 s.', hits: '3 blasts' },
  glasscomet: { cls: 'witch', path: 0, name: 'Glass Comet', icon: '☄️', cost: 45, cd: 9, target: 'dir', power: 2.6, element: 'fire', desc: 'Gather a comet of molten glass and hurl it. It bursts into six glowing shards that fly on through the crowd.', hits: 'comet blast + 6 shards (×0.5)' },
  nova: { cls: 'witch', path: 1, name: 'Frost Nova', icon: '❄️', cost: 30, cd: 6, target: 'self', power: 1.2, element: 'frost', desc: 'Freeze everything around you solid. Heavy blows shatter frozen foes.', hits: 'freeze burst' },
  chain: { cls: 'witch', path: 1, name: 'Chain Lightning', icon: '⚡', cost: 35, cd: 4, target: 'unit', range: 7, power: 1.7, element: 'lightning', desc: 'Lightning leaps between foes, further through wet ones.', hits: 'jumps 4 + rank times' },
  stormthread: { cls: 'witch', path: 1, name: 'Storm Thread', icon: '🧵', cost: 15, cd: 6, target: 'unit', range: 7.5, power: 0.3, element: 'lightning', desc: 'Hold to keep a thread of lightning on one foe. It grows stronger the longer you hold it (up to 3 s).', hits: 'ticks 0.3 → 0.9 every 0.2 s' },
  familiar: { cls: 'witch', path: 2, name: 'Hex Familiar', icon: '🐈‍⬛', cost: 50, cd: 18, target: 'self', power: 0.6, element: 'hex', desc: 'Summon a spectral cat that hexes your enemies.', hits: 'homing hex bolts' },
  witherhex: { cls: 'witch', path: 2, name: 'Wither Hex', icon: '🕯️', cost: 25, cd: 6, target: 'unit', range: 8, power: 2.2, element: 'hex', desc: 'Curse a foe. After 3 s the curse bursts, adding 30% of everything it suffered meanwhile.', hits: 'delayed burst + stored damage' },
  mothstorm: { cls: 'witch', path: 2, name: 'Mothstorm', icon: '🦋', cost: 40, cd: 12, target: 'ground', range: 8, radius: 2, def: 3.5, power: 0.3, element: 'hex', desc: 'Release a storm of pale moths that drifts toward your aim and devours what it touches.', hits: 'every 0.3 s for 4 s' },
};
for (const [id, s] of Object.entries(SKILLS)) s.id = id;

// ------------------------------------------------------------------ tree nodes
// type: active | passive | mod | res | util | key.  x,y: layout (x 0..2 within a path, y 0..4 depth)
// stats: stat bonus per rank (merged into computeStats). free: granted at `lvl` for nothing.
// pathMin: points that must already be spent in this path.
const N = (o) => ({ max: 1, req: [], lvl: 1, pathMin: 0, stats: null, ...o });
export const TREES = {
  samurai: [
    N({ id: 'iaido', type: 'active', path: 0, x: 1, y: 0, skill: 'iaido', free: true, lvl: 1, max: 5 }),
    N({ id: 'keeneye', type: 'passive', path: 0, x: 0, y: 1, name: 'Keen Eye', max: 3, stats: { crit: 3 }, req: ['iaido'], desc: r => `+${3 * r}% critical chance.` }),
    N({ id: 'perfectguard', type: 'mod', path: 0, x: 2, y: 1, name: 'Perfect Guard', max: 2, req: ['iaido'], desc: r => `Parry window +${60 * r} ms. Perfect parries restore ${15 * r} Ki.` }),
    N({ id: 'ghostdraw', type: 'active', path: 0, x: 1, y: 2, skill: 'ghostdraw', lvl: 4, max: 5, req: ['keeneye'] }),
    N({ id: 'counterdraw', type: 'mod', path: 0, x: 2, y: 2, name: 'Counterdraw', req: ['perfectguard'], desc: () => 'After a perfect parry your next Iaido Dash or Ghostdraw costs no Ki and is a guaranteed crit.' }),
    N({ id: 'finishingcut', type: 'passive', path: 0, x: 0, y: 3, name: 'Finishing Cut', max: 3, stats: { critDmg: 10 }, req: ['ghostdraw'], desc: r => `+${10 * r}% critical damage.` }),
    N({ id: 'threadsever', type: 'active', path: 0, x: 1, y: 3, skill: 'threadsever', lvl: 8, max: 5, req: ['ghostdraw'] }),
    N({ id: 'singlestroke', type: 'key', path: 0, x: 1, y: 4, name: 'Way of the Single Stroke', pathMin: 7, lvl: 12, req: ['threadsever'], desc: () => 'Keystone. Critical hits deal +60% damage and restore 10 Ki. Normal hits no longer build Ki.' }),
    N({ id: 'tempest', type: 'active', path: 1, x: 1, y: 0, skill: 'tempest', free: true, lvl: 3, max: 5 }),
    N({ id: 'fleetfoot', type: 'passive', path: 1, x: 0, y: 1, name: 'Fleet Foot', max: 3, stats: { moveSpd: 4 }, req: ['tempest'], desc: r => `+${4 * r}% movement speed.` }),
    N({ id: 'cuttingwind', type: 'mod', path: 1, x: 2, y: 1, name: 'Cutting Wind', max: 2, req: ['tempest'], desc: r => `Blade Tempest drags foes inward and lasts ${0.3 * r}s longer.` }),
    N({ id: 'galestep', type: 'active', path: 1, x: 1, y: 2, skill: 'galestep', lvl: 4, max: 5, req: ['fleetfoot'] }),
    N({ id: 'secondwind', type: 'res', path: 1, x: 0, y: 2, name: 'Second Wind', max: 2, req: ['fleetfoot'], desc: r => `Each dodge roll restores ${6 * r} Ki.` }),
    N({ id: 'echosteps', type: 'mod', path: 1, x: 2, y: 3, name: 'Echo Steps', req: ['galestep'], desc: () => 'Gale Step leaves an Echo of you that repeats the step 0.6 s later.' }),
    N({ id: 'kaze', type: 'active', path: 1, x: 1, y: 3, skill: 'kaze', lvl: 7, max: 5, req: ['galestep'] }),
    N({ id: 'endlessgale', type: 'key', path: 1, x: 1, y: 4, name: 'Endless Gale', pathMin: 7, lvl: 12, req: ['kaze'], desc: () => 'Keystone. Rolling through a foe cuts it, and rolls recover twice as fast. Max health −15%.' }),
    N({ id: 'oni', type: 'active', path: 2, x: 1, y: 0, skill: 'oni', free: true, lvl: 6, max: 5 }),
    N({ id: 'ironroot', type: 'passive', path: 2, x: 0, y: 0, name: 'Iron Root', max: 3, stats: { armor: 6 }, desc: r => `+${6 * r} armour.` }),
    N({ id: 'bellquake', type: 'active', path: 2, x: 0, y: 1, skill: 'bellquake', lvl: 5, max: 5, req: ['ironroot'] }),
    N({ id: 'sundering', type: 'mod', path: 2, x: 2, y: 1, name: 'Sundering Blows', max: 2, req: ['ironroot'], desc: r => `Heavy blows deal +${15 * r}% damage to elites, bosses and armoured shells.` }),
    N({ id: 'tollingweight', type: 'passive', path: 2, x: 1, y: 2, name: 'Tolling Weight', max: 2, req: ['bellquake'], desc: r => `Charged spin slash: +${20 * r}% damage and reach.` }),
    N({ id: 'resonantfury', type: 'res', path: 2, x: 2, y: 2, name: 'Resonant Fury', req: ['sundering'], desc: () => 'Heavy blows restore 8 Ki.' }),
    N({ id: 'bellofruin', type: 'key', path: 2, x: 1, y: 3, name: 'Bell of Ruin', pathMin: 7, lvl: 12, req: ['tollingweight'], desc: () => 'Keystone. Oni Cleave and Bellquake ring a second shockwave and always shatter frozen foes. Attack speed −15%.' }),
  ],
  archer: [
    N({ id: 'multishot', type: 'active', path: 0, x: 1, y: 0, skill: 'multishot', free: true, lvl: 1, max: 5 }),
    N({ id: 'hawkeye', type: 'passive', path: 0, x: 0, y: 1, name: 'Hawk Eye', max: 3, stats: { crit: 3 }, req: ['multishot'], desc: r => `+${3 * r}% critical chance.` }),
    N({ id: 'deadeye', type: 'mod', path: 0, x: 2, y: 1, name: 'Deadeye Draw', max: 2, req: ['multishot'], desc: r => `Charged shots charge ${15 * r}% faster.` }),
    N({ id: 'splitvolley', type: 'mod', path: 0, x: 2, y: 2, name: 'Split Volley', max: 2, req: ['deadeye'], desc: r => `Multishot looses ${2 * r} more arrows.` }),
    N({ id: 'ghostflight', type: 'active', path: 0, x: 1, y: 2, skill: 'ghostflight', lvl: 4, max: 5, req: ['hawkeye'] }),
    N({ id: 'weakpoint', type: 'passive', path: 0, x: 0, y: 3, name: 'Weak Point', max: 3, stats: { critDmg: 10 }, req: ['ghostflight'], desc: r => `+${10 * r}% critical damage. Crits on elites and bosses flash their weak point.` }),
    N({ id: 'stillness', type: 'key', path: 0, x: 1, y: 4, name: 'Stillness', pathMin: 7, lvl: 12, req: ['ghostflight'], desc: () => 'Keystone. Charged shots loosed after standing still for 0.5 s deal +40% damage. You move 20% slower while drawing.' }),
    N({ id: 'snare', type: 'active', path: 1, x: 1, y: 0, skill: 'snare', free: true, lvl: 3, max: 5 }),
    N({ id: 'quickhands', type: 'util', path: 1, x: 0, y: 0, name: 'Quick Hands', max: 3, stats: { cdr: 4 }, desc: r => `−${4 * r}% cooldowns.` }),
    N({ id: 'tether', type: 'active', path: 1, x: 0, y: 1, skill: 'tether', lvl: 4, max: 5, req: ['quickhands'] }),
    N({ id: 'thornweb', type: 'mod', path: 1, x: 2, y: 1, name: 'Thorn Web', max: 2, req: ['snare'], desc: r => `Snares root ${0.5 * r}s longer.` }),
    N({ id: 'sharedpain', type: 'mod', path: 1, x: 0, y: 2, name: 'Shared Pain', max: 2, req: ['tether'], desc: r => `Tethered foes share ${30 + 15 * r}% of damage instead of 30%.` }),
    N({ id: 'ricochet', type: 'active', path: 1, x: 1, y: 2, skill: 'ricochet', lvl: 6, max: 5, req: ['snare'] }),
    N({ id: 'endlessquiver', type: 'key', path: 1, x: 1, y: 3, name: 'Endless Quiver', pathMin: 7, lvl: 12, req: ['ricochet'], desc: () => 'Keystone. Basic arrows skip once to a second foe. Basic arrow damage −20%.' }),
    N({ id: 'rain', type: 'active', path: 2, x: 1, y: 0, skill: 'rain', free: true, lvl: 6, max: 5 }),
    N({ id: 'chargedfletch', type: 'passive', path: 2, x: 0, y: 0, name: 'Charged Fletching', max: 2, stats: { shock: 8 }, desc: r => `+${8 * r}% chance to shock.` }),
    N({ id: 'stormpin', type: 'active', path: 2, x: 0, y: 1, skill: 'stormpin', lvl: 5, max: 5, req: ['chargedfletch'] }),
    N({ id: 'downpour', type: 'mod', path: 2, x: 2, y: 1, name: 'Downpour', max: 2, req: ['rain'], desc: r => `Rain of Arrows lasts ${0.6 * r}s longer.` }),
    N({ id: 'staticfocus', type: 'res', path: 2, x: 0, y: 2, name: 'Static Focus', req: ['stormpin'], desc: () => 'Your lightning restores 3 Focus per foe it strikes.' }),
    N({ id: 'needlerain', type: 'active', path: 2, x: 1, y: 2, skill: 'needlerain', lvl: 8, max: 5, req: ['rain'] }),
    N({ id: 'tempestquiver', type: 'key', path: 2, x: 1, y: 3, name: 'Tempest Quiver', pathMin: 7, lvl: 12, req: ['needlerain'], desc: () => 'Keystone. Every fourth basic arrow is a lightning arrow that chains to 3 foes. Focus regeneration −25%.' }),
  ],
  witch: [
    N({ id: 'kindling', type: 'passive', path: 0, x: 1, y: 0, name: 'Kindling', max: 2, stats: { burn: 8 }, desc: r => `+${8 * r}% chance to burn.` }),
    N({ id: 'embergarden', type: 'active', path: 0, x: 0, y: 1, skill: 'embergarden', lvl: 2, max: 5, req: ['kindling'] }),
    N({ id: 'searing', type: 'passive', path: 0, x: 2, y: 1, name: 'Searing Focus', max: 3, stats: { abilityDmg: 6 }, req: ['kindling'], desc: r => `+${6 * r}% ability damage.` }),
    N({ id: 'wildfire', type: 'mod', path: 0, x: 0, y: 2, name: 'Wildfire', req: ['embergarden'], desc: () => 'Burning foes spread their fire to neighbours when they die.' }),
    N({ id: 'glasscomet', type: 'active', path: 0, x: 1, y: 2, skill: 'glasscomet', lvl: 5, max: 5, req: ['searing'] }),
    N({ id: 'shatterglass', type: 'mod', path: 0, x: 2, y: 3, name: 'Shatterglass', max: 2, req: ['glasscomet'], desc: r => `Glass Comet bursts into ${2 * r} more shards.` }),
    N({ id: 'cinderheart', type: 'key', path: 0, x: 1, y: 4, name: 'Cinderheart', pathMin: 7, lvl: 12, req: ['glasscomet'], desc: () => 'Keystone. Fire damage +35% and burns tick twice as hot. You take 15% more damage.' }),
    N({ id: 'nova', type: 'active', path: 1, x: 0, y: 0, skill: 'nova', free: true, lvl: 1, max: 5 }),
    N({ id: 'chain', type: 'active', path: 1, x: 2, y: 0, skill: 'chain', free: true, lvl: 3, max: 5 }),
    N({ id: 'deepfreeze', type: 'mod', path: 1, x: 0, y: 1, name: 'Deep Freeze', max: 2, req: ['nova'], desc: r => `Frost Nova freezes ${0.4 * r}s longer.` }),
    N({ id: 'forkedbolt', type: 'mod', path: 1, x: 2, y: 1, name: 'Forked Bolt', max: 2, req: ['chain'], desc: r => `Chain Lightning jumps ${r} more time${r > 1 ? 's' : ''}.` }),
    N({ id: 'brittle', type: 'passive', path: 1, x: 0, y: 2, name: 'Brittle', max: 2, req: ['deepfreeze'], desc: r => `Frozen and chilled foes take +${10 * r}% damage.` }),
    N({ id: 'stormthread', type: 'active', path: 1, x: 1, y: 2, skill: 'stormthread', lvl: 7, max: 5, req: ['chain'] }),
    N({ id: 'conductor', type: 'key', path: 1, x: 1, y: 3, name: 'Conductor', pathMin: 7, lvl: 12, req: ['stormthread'], desc: () => 'Keystone. Your lightning always seeks wet and frozen foes first and shatters the frozen. Frost Nova cooldown +30%.' }),
    N({ id: 'familiar', type: 'active', path: 2, x: 1, y: 0, skill: 'familiar', free: true, lvl: 6, max: 5 }),
    N({ id: 'witherhex', type: 'active', path: 2, x: 0, y: 1, skill: 'witherhex', lvl: 4, max: 5, req: [] }),
    N({ id: 'grimalkin', type: 'mod', path: 2, x: 2, y: 1, name: 'Grimalkin', max: 2, req: ['familiar'], desc: r => `Your Hex Familiar attacks ${25 * r}% faster.` }),
    N({ id: 'soulsiphon', type: 'res', path: 2, x: 0, y: 2, name: 'Soul Siphon', req: ['witherhex'], desc: () => 'Cursed foes restore 8 Mana when they die.' }),
    N({ id: 'hollowecho', type: 'passive', path: 2, x: 2, y: 2, name: 'Hollow Echo', max: 2, stats: { echoDmg: 15 }, req: ['grimalkin'], desc: r => `Echoes, curses and other delayed effects deal +${15 * r}% damage.` }),
    N({ id: 'mothstorm', type: 'active', path: 2, x: 1, y: 2, skill: 'mothstorm', lvl: 6, max: 5, req: ['witherhex'] }),
    N({ id: 'mothcovenant', type: 'key', path: 2, x: 1, y: 3, name: 'Moth Covenant', pathMin: 7, lvl: 12, req: ['mothstorm'], desc: () => 'Keystone. Mothstorm follows your aim twice as fast and lasts twice as long. Mana regeneration −20%.' }),
  ],
};
const NODE_INDEX = {};
for (const [cls, nodes] of Object.entries(TREES)) for (const n of nodes) {
  n.cls = cls;
  if (n.skill) { const S = SKILLS[n.skill]; n.name = S.name; n.icon = S.icon; n.desc = r => `${S.desc}${r > 1 ? ` Rank ${r}: +${25 * (r - 1)}% damage, −${6 * (r - 1)}% cooldown.` : ''}`; }
  NODE_INDEX[n.id] = n;
}
export const nodeById = id => NODE_INDEX[id];
export const treeOf = cls => TREES[cls] || [];
// the original three abilities keep their slot order for the legacy `skills` mirror
const LEGACY = { samurai: ['iaido', 'tempest', 'oni'], archer: ['multishot', 'snare', 'rain'], witch: ['nova', 'chain', 'familiar'] };
export const legacyAbilities = cls => LEGACY[cls] || [];

// ------------------------------------------------------------------ state helpers (pure)
export const rankOf = (inv, id) => (inv.tree && inv.tree[id]) || 0;
export function pathPoints(inv, cls, path) {
  let n = 0;
  for (const node of treeOf(cls)) if (node.path === path) n += Math.max(0, rankOf(inv, node.id) - (node.free ? 1 : 0));
  return n;
}
export function spentPoints(inv) {
  let n = 0;
  for (const node of treeOf(inv.cls)) n += Math.max(0, rankOf(inv, node.id) - (node.free ? 1 : 0));
  return n;
}
// Why a node can or cannot take another rank ('' = it can)
export function lockReason(inv, node) {
  const r = rankOf(inv, node.id);
  if (r >= node.max) return 'Maxed';
  if (node.free && !r) return `Unlocks free at level ${node.lvl}`;
  if (inv.level < node.lvl) return `Requires level ${node.lvl}`;
  for (const q of node.req) if (!rankOf(inv, q)) return `Requires ${nodeById(q).name}`;
  if (node.pathMin && pathPoints(inv, node.cls, node.path) < node.pathMin) return `Requires ${node.pathMin} points in ${PATHS[node.cls][node.path].name}`;
  if ((inv.sp || 0) <= 0) return 'No skill points';
  return '';
}
export function spendNode(inv, id) {
  const node = nodeById(id);
  if (!node || node.cls !== inv.cls || lockReason(inv, node)) return false;
  inv.tree[id] = rankOf(inv, id) + 1; inv.sp--;
  if (node.skill && inv.tree[id] === 1) autoSlot(inv, node.skill);
  syncLegacy(inv);
  return true;
}
export function freeRanks(cls, level) { const out = {}; for (const n of treeOf(cls)) if (n.free && level >= n.lvl) out[n.id] = 1; return out; }
// Full refund of every bought rank. Idempotent; never touches class, items or level.
export function respecTree(inv) {
  const refund = spentPoints(inv);
  inv.sp = (inv.sp || 0) + refund;
  inv.tree = freeRanks(inv.cls, inv.level);
  inv.loadout = null;
  ensureTree(inv);
  return refund;
}
export function unlockedSkills(inv) { return treeOf(inv.cls).filter(n => n.skill && rankOf(inv, n.id) > 0).map(n => n.skill); }
export function skillRank(inv, skillId) { return rankOf(inv, skillId); }
export function autoSlot(inv, skill) {
  if (!Array.isArray(inv.loadout)) return;
  if (inv.loadout.includes(skill)) return;
  const i = inv.loadout.indexOf(null);
  if (i >= 0) inv.loadout[i] = skill;
}
export function setLoadout(inv, slot, skill) {
  if (slot < 0 || slot >= LOADOUT_SIZE) return false;
  if (skill && !unlockedSkills(inv).includes(skill)) return false;
  const was = inv.loadout.indexOf(skill);
  if (skill && was >= 0) inv.loadout[was] = inv.loadout[slot]; // swap
  inv.loadout[slot] = skill || null;
  return true;
}
function syncLegacy(inv) { inv.skills = legacyAbilities(inv.cls).map(id => rankOf(inv, id)); }

// Bring any inventory (new, legacy three-ability, or dev-edited) to a consistent tree state.
// Legacy ranks are preserved exactly; points are never granted or removed here.
export function ensureTree(inv) {
  if (!inv.tree || typeof inv.tree !== 'object' || Array.isArray(inv.tree)) inv.tree = {};
  const legacy = legacyAbilities(inv.cls);
  (inv.skills || []).forEach((r, i) => { const id = legacy[i]; if (id && Number.isFinite(r) && r > rankOf(inv, id)) inv.tree[id] = Math.min(MAX_ACTIVE_RANK, Math.floor(r)); });
  for (const [id, r] of Object.entries(freeRanks(inv.cls, inv.level))) if (!inv.tree[id]) inv.tree[id] = r;
  for (const id of Object.keys(inv.tree)) { const n = nodeById(id); if (!n || n.cls !== inv.cls) delete inv.tree[id]; else inv.tree[id] = Math.max(0, Math.min(n.max, Math.floor(inv.tree[id]) || 0)); }
  const have = unlockedSkills(inv);
  if (!Array.isArray(inv.loadout)) {
    const order = [...legacy, ...have.filter(s => !legacy.includes(s))].filter(s => have.includes(s));
    inv.loadout = Array.from({ length: LOADOUT_SIZE }, (_, i) => order[i] || null);
  } else {
    const seen = new Set();
    inv.loadout = Array.from({ length: LOADOUT_SIZE }, (_, i) => { const s = inv.loadout[i]; if (!s || !have.includes(s) || seen.has(s)) return null; seen.add(s); return s; });
    for (const s of have) autoSlot(inv, s);
  }
  syncLegacy(inv);
  return inv;
}
// passive stat bonuses from the tree, merged into computeStats
export function treeStats(inv) {
  const out = {};
  for (const n of treeOf(inv.cls)) { const r = rankOf(inv, n.id); if (!r || !n.stats) continue; for (const k in n.stats) out[k] = (out[k] || 0) + n.stats[k] * r; }
  return out;
}
export const rankMult = r => 1 + 0.25 * (Math.max(1, r) - 1);
export const rankCd = (S, r) => S.cd * (1 - 0.06 * (Math.max(1, r) - 1));
