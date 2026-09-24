# Pass 5 — developer-room integration guide

At the time of delivery no newer Gemini dev-room branch existed on the remote (checked
`git fetch --prune` before every milestone commit; the only dev tooling is the one merged into
`integration/mossling-pass4-review` at `a8efca8`). Pass 5 therefore **does not modify**
`src/dev/commands.js`, `src/dev/console.js` or `src/world/devroom.js`. Everything new is
discoverable through data registries, and a set of Pass 5 commands plugs into the existing
console tables from a separate file.

## Registries (single source of truth)

| What | Where | Notes |
|---|---|---|
| Everything below, in one object | `src/rpg/registry.js` → `REGISTRY` | live references, no copies |
| Active abilities (24) | `src/rpg/skills.js` → `SKILLS` | cost, cooldown, targeting, power, element, tooltip text |
| Skill-tree nodes (65) and paths (9) | `skills.js` → `TREES`, `PATHS` | `lockReason`, `spendNode`, `respecTree`, `setLoadout`, `ensureTree` |
| Weapon families, off-class rule | `src/rpg/gear.js` → `FAMILY`, `weaponFamily`, `OFFCLASS_SCALING` | |
| Named weapons (12) | `gear.js` → `NAMED_WEAPONS` | `makeNamed(id, level)` in `items.js` builds any of them |
| Build accessories (8), armour sets (3) | `gear.js` → `ACCESSORIES`, `SETS`, `SET_PIECES(set)` | set pieces are ordinary bases in `ARMORS` |
| Stat-roll rarity | `src/rpg/affixes.js` (unchanged) + `items.js` → `rollAffixValue(k, ilvl, { targetTier })` | ordinary loot now uses it |
| Implemented qualitative affixes | `items.js` → `IMPLEMENTED_QUALITATIVE` | `astral_step` is intentionally excluded (no gameplay) |
| Element reactions and statuses | `src/rpg/elements.js` → `REACTIONS`, `STATUS_INFO`, `react()`, `soak()` | add a reaction by pushing `{ id, test, apply }` |
| Recipes (13) and materials (12) | `src/rpg/crafting.js` → `RECIPES`, `MATS` (data only; transaction logic untouched) | |
| Reinforcement | `src/rpg/reinforce.js` → `reinforceCost`, `checkReinforce`, `reinforce` | |
| Creatures | `src/entities/monsters3.js` → `PASS5_ENEMIES`, `ENEMY_MATS`; all kinds in `EXTRA_ENEMIES` | `/spawn <kind>` already works for new kinds |
| Elite modifiers | `REGISTRY.eliteModifiers` (`Resonant`, `Oathbound` added) | `game.makeElite(e)` then set `e.elite` to force one |
| Bosses | `REGISTRY.bosses`; `src/entities/bosses5.js` | `game.startSeamkeeper(def)`, `game.wakeToad(toad)`; flags `seamDead`, `toadAt` |
| Areas | `src/world/conservatory.js` (`buildConservatory`, `CONSERVATORY_ROOMS`) | spawns `entrance`, `atrium`, `canopy`; overworld spawns `conservatory`, `fen` |
| Bellstones | `persistence/model.js` → `BELLSTONES`, `BELLSTONE_NAMES` | `game.travelToBellstone(id)` |
| Settings | `src/settings.js` → `OPTS` (internal), `PRESETS`, `DEFAULTS`, `applySettings` | |

## Pass 5 commands (plug-in, `src/dev/pass5.js`)

`/sandbox on|off`, `/skill list|all|reset|points N|<node>`, `/loadout <slot> <skill>`,
`/named list|<id>`, `/set <bellwarden|thornstalker|cinderwoven>`, `/affix <tier> [slot]`,
`/reinforce <n>`, `/mat <id|all> [n]`, `/elite <modifier> [kind]`, `/fight seamkeeper|toad`,
`/react conduct|shatter|firestorm`, `/registry [section]`,
`/capture freeze|slow k|normal|cam x z [zoom]|free|hud|perf`, `/deathdrop`.

They are added with `Object.assign(COMMAND_DEFINITIONS, …)` and
`Object.assign(DevCommands.handlers, …)`. If the dev framework is rebuilt, keep either the two
tables or an equivalent registration hook and this file keeps working unchanged.

## Isolation

Commands that create loot or change progression **refuse** unless `/sandbox on` is active
(while on, `game.save` is a no-op, so nothing reaches the profile; `/sandbox off` reloads the
saved character) or the command is given `keep` to write deliberately. Items created by these
commands carry `provenance.source = 'dev' | 'dev-sandbox'`. `tests/devp5.test.mjs` proves a
sandbox session leaves `localStorage` byte-identical.

## When the new dev room lands

1. Merge it into this branch; keep its console and profile isolation over anything older.
2. Re-point `src/dev/pass5.js` at its registration API (or keep the two tables).
3. Add dev-room stations that read `REGISTRY` (a totem per `pass5Enemies`, a rack per
   `namedWeapons`, a lectern for `tree`), instead of hardcoding lists.
4. Run `node tests/run.mjs devp5 integration content skills loop`.
