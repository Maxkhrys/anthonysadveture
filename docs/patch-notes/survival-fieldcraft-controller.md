# Survival fieldcraft, controller and command access

Base: `feat/devlab-inventory-vfx` at `9ea8601af821c39993157304d48b08a129d48e0b`.
Work branch: `feat/survival-ui-gathering`. Preview only; no production promotion.

## Player-facing changes

- Survival inventory now has Equipment, Materials, Crafting and Building tabs. G opens the same inventory workshop. Actual building geometry supplies recipe thumbnails; materials have distinct pixel icons, counts and gathering tips.
- Select a recipe to inspect its output, held/needed materials, workstation requirement and exact batch cost. Craft 1–99 batches atomically. Full tonic pouches refuse crafting without consuming materials.
- Track one recipe's material needs on the world HUD. Crafting and inventory pause simulation, including Survival, reloads, effects and cooldowns.
- Eight-slot weapon belt at the top of the screen. Acquired weapons fill empty slots; select using [ / ], click, controller RB or D-pad left/right. Assign a particular weapon/slot from item inspection. References point to exact owned instances, not copies. No mid-attack or mid-reload switching.
- Separate woody chops, stone impacts, metallic ore, crystalline hits, break sounds and quieter pickup cues. Directional chips, restrained stone dust and brief remaining-work feedback use existing bounded particle/audio systems. Gathering strength, cadence, yields and class differences are unchanged.
- Standard-mapping controllers now cover reloads, inventory, crafting, item switching, combat, menu focus and on-screen text entry. Disconnecting pauses active play. Confirm/back cannot also trigger a combat action. Keyboard and mouse remain available.
- `/devlab` opens MOSSDEV directly and deliberately enables developer mode. `/lab` and `/mossdev` are aliases. The slash console includes a visible MOSSDEV Lab shortcut. F10 remains optional. Existing test profiles and Return to Adventure / Survival are preserved.

## Controller controls

| Input | Action |
|---|---|
| Left stick / right stick | Move / aim |
| X / RT / LB | Primary / secondary / guard |
| B / A / Y | Dodge / interact / reload |
| D-pad up / down | Tonic / crafting |
| D-pad left/right or RB | Switch belt weapon |
| View / Start | Inventory / pause |
| L3 / R3 | Dungeon tool / Bell Surge |
| Hold LT + X/Y/B/A/LB/RB | Abilities 1–6 |
| Hold LT + View | Swap dungeon tool |
| In menus: A / B | Select / back |
| In menus: D-pad or stick / LB or RB | Spatial focus / previous or next control |
| On text field: A | Open controller keyboard |
| On select/number/range: left/right | Adjust value |

Labels use the standard Xbox-style Gamepad API names. Other standard-mapped pads use equivalent physical positions.

## Developer/testing improvements

- Separate controller mapping and focus router; pure deadzone/action tests plus browser Gamepad API injection tests.
- Validated `record.fieldKit = {slots: itemInstanceId[8], selected}` and optional `record.trackedRecipe` are additive Survival-only preferences. No save schema migration or story-storage changes.
- Native Enter/Space button activation no longer leaks into Equip/attack handling.
- Slash commands now surface asynchronous failures instead of leaving rejected promises unhandled.
- Runtime captures: `docs/screens/fieldcraft/`.
- Integration contract for Opus: `docs/handoffs/modular-houses-fieldcraft.md`.

## Verification

Final suite results: 234 browser assertions and 36 Node unit assertions passed (270 total).

- `CHROMIUM_PATH=/tmp/chromium node tests/run.mjs survival survival_inventory` — 21 + 15 passed.
- `CHROMIUM_PATH=/tmp/chromium node tests/run.mjs fieldcraft devlab_command` — 22 + 6 passed.
- `CHROMIUM_PATH=/tmp/chromium node tests/run.mjs inventory_clarity` — 13 passed on corrective rerun (run together with devlab_command).
- `CHROMIUM_PATH=/tmp/chromium node tests/run.mjs weapon_kits` — 88 passed on corrective rerun.
- `combat_fx`, `devlab`, `gunslinger_combat`, `persistence` in the broader browser run — 12 + 23 + 21 + 13 passed.
- `node --test tests/controller.unit.mjs tests/persistence.unit.mjs tests/transfer.unit.mjs` — 21 passed.
- `node --test tests/dev_commands.unit.mjs` — 15 passed after making the repository's vendored Three module available to Node resolution locally.
- `git diff --check` and syntax checks passed.

The initial broad run had two failures: keyboard Enter leaked into Equip (fixed in Input), and the pre-existing 30 Hz SoulChain sampling limitation described below. Both affected suites passed their corrective reruns. The initial developer-command Node run could not resolve the declared Three dependency; its subsequent run used the same vendored module as the browser. Tests cover actual crafting costs/outputs, invalid batches, pause, exact equipment, belt persistence across refresh, controller menu focus/text entry/disconnect/action suppression, slash access and return, inventory inspection, Survival/save isolation, weapon families, Gunslinger and presentation budgets.

## Known limitations

- Physical controller hardware and subjective speaker/headphone audio were not tested. Browser tests inject standard Gamepad API snapshots. Non-standard mappings are not auto-guessed; no rumble or remapping screen is added.
- The top belt is for weapons. Materials stay in the Materials tab; crafted structures stay in Building. Existing tonic/tool controls remain separate.
- Existing SoulChain collision uses discrete swing samples. A diagnostic reproduced a missed primary at 30 Hz with a +9% attack-speed roll; 60 Hz samples landed in that diagnostic. This pass does not change combat timing or collision. The weapon-routing test samples its lash assertion at 60 Hz and separately checks the actual lash state.
- Gathering remains slower for some classes, as in the baseline. No balance change is hidden in the feedback work.
- Desktop views at 1280×720 and 1920×1080 plus narrow inventory at 390×844 were captured. This is not mobile gameplay or hardware-FPS certification.
- Opus's modular houses, stairs and elevation work is separate and was not yet published when this branch was prepared. No underground mining implementation is included.
