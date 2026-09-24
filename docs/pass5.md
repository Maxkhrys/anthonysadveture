# Pass 5 — identity, skill trees, combat and content

Base: `integration/mossling-pass4-review` @ `a8efca8` (the newest integration head; no newer
approved branch existed). Branch: `claude/pass5-identity-skilltree-content`. Screenshots are in
`docs/screens/pass5/`. The Pass 4 frames in `docs/screens/*_after.jpg` are the "before" shots.

## Skill trees and abilities
- **Three classes, three paths each:** 65 nodes in total (Samurai 23, Archer 21, Witch 21).
  Node types are actives, passives, ability modifiers, resource nodes, utility nodes and three
  keystones per class. Keystones have real trade-offs and need 7 points in their path.
- **Tree screen:** connected paths light up as you learn them. It shows prerequisites and the
  reason a node is locked, current and next rank, a damage preview, cost, cooldown, targeting
  and element. It works with mouse, keyboard or pad. **Reset tree** asks you to confirm.
- **Levelling:** the XP curve is unchanged, and you still get one point per level. The original
  three abilities are still granted free at levels 1, 3 and 6.
- **Hotbar:** six slots on keys 1–6. On a pad, hold LT and press X/Y/B/A/LB/RB (untested on
  real hardware). You can unlock more actives than fit and choose which six to equip.
- **Abilities:** 8 per class, 24 in total.
  - **Samurai:** Iaido Dash, Ghostdraw, Thread Sever, Blade Tempest, Gale Step, Kaze Crescent,
    Oni Cleave, Bellquake.
  - **Archer:** Multishot, Ghostflight, Snare Trap, Briar Tether, Skipping Shot, Rain of
    Arrows, Stormpin Volley, Needle Rain.
  - **Witch:** Ember Garden, Glass Comet, Frost Nova, Chain Lightning, Storm Thread, Hex
    Familiar, Wither Hex, Mothstorm.

## HUD
The combat HUD is now bottom-centred:
- a health globe on the left and a class-resource globe on the right;
- six slots showing a radial cooldown, seconds left, rank pips, cost, not-enough-resource and
  targeting states, a duration strip for running abilities, and a flash when an ability
  comes off cooldown;
- Bell Surge as its own bell gauge above the slots;
- a buff row, and the whole HUD dims when you're out of combat.

## Gear
- **Off-class weapons:** any class can equip any weapon. Basic attacks follow the weapon's
  family: blade, heavy blade, bow, staff, wand or oversized.
  - Off-class weapons deal 80% damage and lose the class perk: Ki on hit, full-speed bow draw,
    or bolts that bend toward foes.
  - The hero visibly holds the actual weapon.
- **New armour slots:** arms, legs, boots and rings now drop in normal loot.
- **Three armour sets:** Bellwarden, Thornstalker and Cinderwoven. Each has its own models for
  all five pieces, a 2-piece bonus and a 5-piece bonus. Mixing sets is always allowed.
- **Eight build accessories:** Stillwater Ring, Cracked Porcelain Pendant, Briarbond Loop,
  Rimeshard Band, Echo Clapper, Quickthread Ring, Crowned Signet and Bellmaker's Tuning Fork.
- **Twelve named weapons:** Seam Ripper, Wickblade, The Clapper, Aunt Marrow's Hatpin,
  Lilypad Longbow, Spoolstring, Glasswing, Mothlight Lantern, Porcelain Conductor, Chandler's
  Candelabra, and two universal oversized weapons: the Rainmaker Parasol and **the Royal
  Teaspoon** (1.9× visual scale). Each has its own model and a signature behaviour.
- **Reinforcement:** a Reinforce tab at Posy's workbench goes from +1 to +20. It shows current
  and next level, damage before and after, and material and pip cost. It is all-or-nothing and
  never re-rolls anything.
- **Inventory:**
  - filters, sorting and item locks;
  - a set-bonus panel, the reinforcement level, weapon family and affinity, and how much an
    ability hit is worth;
  - a zoomable paper doll with better lighting and two-handed poses.

## Affix rarity in real drops
Every affix on normal loot now rolls through the eight-tier stat-roll rarity table, from
Common to Prismatic. Prismatic stays at 100/1,000,000 per eligible roll (≈0.01%).
- The item's own rarity (0–4) still sets how many affixes it gets; the tier decides how good
  each one is.
- Special effects rolled on Relic, Mythic and Prismatic tiers now work in combat: Resonance
  Echo, Prismatic Splinters, Singularity Wake, Temporal Stride, Vital Dewdrop, Elemental
  Convergence and Toll of the Dawnbell.
- **Astral Step** (phasing through walls) is **not** implemented, so it is removed from any
  roll and never shown.
- The three affixes that were dev-only (Echo Damage, Projectile Size, Strike Reach) now affect
  gameplay, so they roll naturally.

## Element combinations
Reactions live in a registry in `rpg/elements.js`:
- wet + lightning: conducts and arcs through other wet foes;
- frozen + heavy blow: shatters;
- fire + wind: fans the flames to neighbours;
- wet + frost: flash freeze;
- chilled + fire: a steam burst, only with the Elemental Convergence affix.

Rain, Rain of Arrows, the fen and the Crowned Toad all make foes wet.

## Creatures and elites
- **Needle Mantis:** its lunge lane is drawn on the ground first.
- **Candle Slug:** leaves wax trails and lobs wax. A gust snuffs its flame.
- **Lantern Moth:** flies, dives, and makes nearby allies hit harder.
- **Porcelain Guard:** a shell soaks blows until heavy hits crack it.
- **Bell Leech:** anchors a resonance zone that freezes your cooldowns and drains your
  resource.
- **Resonant elites** repeat each attack as a marked echo.
- **Oathbound elites** bind nearby allies until a heavy blow, a parry, or a quarter of the
  elite's health breaks the oath.

## Places and bosses
- **The Cracked Conservatory:** nine rooms reached by a new road north-west of Thimblewick.
  - Rooms: a bell-sequence puzzle, an arena, a breakable glass secret holding a recipe, a
    block puzzle and a one-way shortcut, a torch puzzle, the Seamkeeper's loom and a reliquary.
  - It has its own palette, scenery and atmosphere.
- **The Seamkeeper:**
  - Stitches solid thread barriers and charges down marked lanes.
  - It is armoured until tangled in its own thread, which exposes its joints.
  - Any class can cut threads: melee, arrows, fire or gusts. Gold threads need fire, heavy
    blows or the Seam Ripper.
  - Three phases, a full intro and a death sequence.
- **The Crowned Toad:** sleeps under Mirewhistle Fen, a new area of wadeable shallow water.
  - Ring the three lily bells to wake it; Fisher Ada tells you about them.
  - It attacks with a tongue lash (a missed tongue is its weak point), leaps with splash
    waves, belly flops and croaks.
  - It returns two in-game days after it is defeated.

## Six recipes
Each recipe changes how a weapon behaves:
- **Seamstitch:** from the Seamkeeper.
- **Wax Seal:** from Candle Slug wax.
- **Mothwing Draw:** from moth dust.
- **Porcelain Guard:** the Conservatory secret.
- **Tolling Edge:** the village quest reward.
- **Crowned Tongue:** from the Crowned Toad.

## Village, tutorial, Bellstones
- **The Silent Toll:** Posy and Oswin point you to the Conservatory. Bring the Bellwright's
  Score home and Thimblewick changes: a toll rack appears, Oswin moves to tend it, and a toll
  rings at dawn and dusk.
- **Class-aware tutorial:** each step is worded for your class. The opening fight ends with a
  Porcelain Guard, followed by a short camera reveal of the world.
- **Bellstones:** travel between discovered Bellstones. Resting brings back cleared standard
  foes. Dying drops half your carried pips under a gold beam where you fell. Die again first
  and that older pile is gone. Gear, materials and progress are never lost.

## World and presentation
- Landmarks:
  - a root arching over Thimblewick;
  - a trowel lying across the river as a bridge;
  - a spool trailing thread through Whisperwood;
  - porcelain ruins before the glasshouse;
  - a giant teacup;
  - the glasshouse dome, visible from the west road.
- Foliage bends around the hero and flattens under heavy impacts, which also throw leaves and
  dust.
- The blown-out shop roof is fixed.
- New settings: presets (Low, Default, High, Max), bloom, particle density, HUD scale, combat
  text, hotbar labels and 4096 shadows. Every setting changes something real (tested).

## Save migration
- The save format stays on schema 3 under the same key, `mossling-save-v2`.
- New fields are added alongside the old ones and are validated: `inventory.tree`,
  `inventory.loadout` and `inventory.lockedItems`.
- The old `skills` array is kept up to date as a mirror.
- Old ability ranks map exactly onto the tree, and unspent points are unchanged.
- Respec refunds every bought rank exactly once. It never touches class, level or items.
- `tests/fixtures/pass4-save.json` was written by the **unmodified base game**. The `loop`
  suite loads it, saves, reloads, spends a point and reloads again. It checks character and
  item IDs, level, XP, pips, reinforcement, materials, quests and Bellstones at each step.

## Performance (SwiftShader software rendering, 1280×720)
Numbers are in `docs/perf/`. Draw calls and triangles are exact. Software render times vary
too much to compare, so they are not quoted.

| Scene | Base (Pass 4) | Pass 5 |
|---|---|---|
| Village, day | 306 calls · 224k tris · 0.51 ms update | 300 calls · 211k tris · 0.35 ms update |
| Crowd (24 foes, 8 dying) | 398 · 224k · 2.15 ms | 385 · 217k · 1.88 ms |
| 24 new creatures | — | 495 · 221k · 1.32 ms |
| Six abilities + blasts at once | — | 508 · 222k · **7.35 ms** · 329 particles |
| 20 loot drops | — | 380 · 216k · 2.56 ms |
| Night + rain | — | 372 · 219k · 0.67 ms |
| Conservatory | — | 167 · 44k · 0.41 ms |
| Seamkeeper / Crowned Toad | — | 128 · 35k · 0.28 ms / 202 · 187k · 1.24 ms |
| Paper doll (separate context) | — | 9.8 ms per frame in software GL |

The six-ability burst is the heaviest CPU case, at about 7 ms of game update. No real GPU,
phone or gamepad has been tested.

## Tests
```
npm run test:persistence   # 14 pass
npm run test:dev           # 15 pass (loot test updated: new affixes are live, Astral Step never rolls)
node tests/run.mjs aim balance content crafting devp5 integration loop persistence skills village
```
New suites:
- `skills`: every one of the 24 abilities casts through the hotbar; tree rules; respec;
  migration; off-class weapons; element reactions; sets.
- `content`: creatures, elites, materials, all Conservatory puzzles, both bosses.
- `loop`: death drop, fast travel, rest respawn, the village story, the tutorial mini-boss,
  settings, and migration of a real old save.
- `devp5`: the new dev commands and sandbox isolation.

These scripted checks prove the systems run. They say nothing about how combat feels.
