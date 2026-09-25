# ARPG itemization implementation

Branch: `feat/arpg-itemization`. Integration base: `04f6896` (latest local atlas, character identity and restored Soulbound combat). Weapon artwork/model branch is independent.

## What ships

Six real item rarities (indices 0–5); Prismatic has weight 0.01 versus roughly 100 total. Magic find and existing drop bonuses still apply. Historical `prismatic` signature items retain their original rarity and identity.

New drops carry stable, serialized `itemizationVersion`, `rarity`, `element`, `modifiers` with rolled value/min/max, `effects` with saved chance, `skillMods`, `prefixes`, `suffixes`, and optional `unique`. Common items stay simple. Uncommon and above roll gameplay powers; higher tiers add combinations. Same base is not tied to a single element/build. Existing bases remain; five requested Soulbound chain names are additional bases rather than replacements.

`src/rpg/arpg/definitions.js` contains six elements, ten statuses, 105 proc definitions, trap/source/zone templates, 16 projectile/skill modifiers, six Legendary and six Prismatic build packages. `items.js` rolls and aggregates data; `runtime.js` executes common handlers. Existing class attack/ability implementations remain authoritative.

The runtime supports hit, crit, kill, elite kill, boss hit, dodge, dash, cast, ability use, projectile impact, status apply/expire, taking damage, low health, heal, resource spend, max resource and enter combat events. Actual game hooks emit these events. New status lifecycle events refer to the new runtime's statuses; legacy skill-native status durations continue through existing code.

Fire/poison/bleed have capped stackable damage over time. Frost builds chill ordinary targets into freeze; elites and bosses require extra freeze buildup. Bosses receive bounded simulation slow and a stronger short slow at the buildup threshold, preserving their encounter mechanics. Shock and curse amplify damage. Doom expires into a delayed strike. Hemorrhage and venom burst consume stored stacks. Status/proc damage uses the real player-hit pipeline and respects enemy hit responses.

Temporary traps arm, trigger and expire. Zones tick with a lifetime and radius/line shape. Sources target nearby visible enemies, with movement, healing, decoy pull or bomb variants. Converted poisoned normal enemies are represented by a temporary friendly combat source, not by mutating the defeated enemy's AI. Bosses/elites cannot convert. These sources use lightweight existing effects; distinct summon/turret models remain an artwork follow-up.

Projectiles combine extra volleys, pierce, ricochet, homing, acceleration, fork, death split, critical fork, return, ground effects, impact explosions, range bonuses, every-third-volley empowerment and seeking after a kill. Additional volley shots inherit applicable modifiers. Generated forks cannot split recursively without a generation limit.

Defensive rolls include conditional movement/full-resource/surrounded reductions and dodge chance. Proc barriers have a 30% max-health ceiling and expire. New numeric rolls feed live combat stats, resource costs, resource generation, area radius and source/trap scaling. Tooltip lists powers, conditions, cooldowns and stored ranges. Search includes new power descriptions; Prismatic filter is not duplicated.

## Runtime limits

* Maximum generation depth: 3.
* Shared per-tick event/damage budget: 96; queued event ceiling: 192. Overload is discarded rather than replayed later.
* Maximum runtime effects: 48; maximum three active instances per definition.
* Maximum 16 nearby targets per query; wall/room checks apply.
* Generated projectiles stop spawning at 64 existing projectiles; maximum three children per split/volley. Existing base firing remains class-owned.
* Maximum 128 tracked status targets.
* Proc hits do not re-enter normal hit/crit procs; death chains retain generation metadata. Legacy death-proc recursion is suppressed inside ARPG-generated impacts.
* Death and area changes clear queued events, statuses, cooldowns and temporary sources. Paused menus do not advance gameplay simulation.

## Saves

Save schema is now 4. Schema 3 character collections and legacy schema 2 saves migrate additively. Old items are not rerolled or randomly upgraded. Unknown fields, item identity, ownership, crafting, appearance and world data remain intact. Itemization arrays and values validate before writes. Future versions fail closed. New generated rolls remain on the item across save/load.

An older production build cannot read schema 4; its existing future-schema guard preserves original data. Use a separate preview origin/profile to test before promotion. Do not manually lower schema numbers.

## Artwork merge contract

No weapon icon/model registry was rebuilt. Keep `base`, `definitionId`, `kind`, `cls`, `r`, `prismatic`, `unique` and existing identity fields. New `rarity` string mirrors numeric `r`; visual effects may read `element`, `effects` and `skillMods`. `unique` values prefixed `arpg:` use their base weapon geometry. Do not reroll via rendering, equipping or loading. Do not replace legacy fields with new names.

Files shared with a visual branch: `src/rpg/items.js`, `src/rpg/combat.js`, `src/entities/player.js`, `src/ui_rpg.js`, and the two one-line rarity-filter fixes. Resolve at function level. Preserve Soulbound family routing, restored chain rig and appearance from the integration base.

## Testing and trying builds

```
npm run test:arpg
node --test tests/arpg.unit.mjs tests/persistence.unit.mjs tests/soulbound.unit.mjs tests/transfer.unit.mjs tests/dev_commands.unit.mjs
node tests/run.mjs arpg atlas character_creator inventory9
```

Open developer console and run `/arpgbuild list`, then `/arpgbuild world_garden` (or any listed ID). Weapon matches current class and level and is added to bag. Equip with E. These are optional developer tools, not altered normal loot odds.

Examples: `winter_oath`, `storm_choir`, `red_requiem`, `kindred_lantern`, `ember_orbit`, `endless_storm`, `mirror_winter`, `world_garden`, `blood_moon`, `shared_dawn`.

Validated: 50 unit assertions/tests and 64 browser checks across ARPG, atlas, creator and inventory. Browser exercises all 105 proc definitions for runtime errors, and specifically checks actual damage, stacked projectiles, status ticks, traps, meteor delay, source targeting, storage and cleanup. This is not an exhaustive balance proof for every cross-product of powers.

Older `soulbound.test.mjs` hardcodes town coordinates and spawns randomly elite foes. Its placement/target expectations also fail on unchanged integration base `04f6896`. New ARPG suite locates an open patch and uses controlled targets. Soulbound unit checks and creator/chain-family checks pass; the original full Soulbound browser suite passed on upstream `9908c9a` before the atlas/arrival merge.

Publication: Vercel automatic approval review rejected deployment without an explicit target/publication authorization. No deployment was created. Request approval for an isolated preview after code review; do not promote production before the artwork branch is integrated and validated.
