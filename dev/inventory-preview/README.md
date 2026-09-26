# Mossling inventory design preview

Standalone visual study. Route: `/dev/inventory-preview/index.html`.

## Baseline and ownership

Based on `feat/devlab-inventory-vfx` at `d3f040e11516bea243feccf2ec52d61e3365f424`.
This contains class combat `09189fc`, world discovery `7beb9de`, Gunslinger,
character models and the shared `item_info.js` inspection system. All remote heads
visible at inspection were ancestors. Claude's uncommitted Survival work is not
available here and is not modified. Feature branch: `feat/inventory-design-preview`.

Every changed file lives in this directory. No game, save, shared stylesheet,
bootstrap, test-runner or deployment configuration changes.

## Design

A dark, brass-framed Mossling armoury: real item silhouettes in a satchel, the
actual voxel character as the central object, and concise equipment inspection.
The supplied image guides material, composition and hierarchy only. Its branding,
80 slots, weight, durability, attribute panel and online features are not copied.

Supported interactions: selection, search (including effects and attacks), actual
rarity filters, weapons/armour/jewellery/protected categories, name/rarity/slot
sorting, keyboard-accessible Details, effect comparison, equip/unequip, protection,
five class samples, drag rotation, rotation buttons, wheel/range zoom.

## Data and isolation

`state.js` owns session-only sample inventories, one per class. It calls actual
item factories once per sample, retains exact rolls through all interactions,
and uses `computeStats` and `bagCapacity`. There is no storage provider or save
access. Reload intentionally generates a fresh design-preview sample. This is
not the persistent Dev Lab.

Read-only reuse:

* `src/item_info.js`: compact/expanded descriptions, comparison, rarity.
* `src/preview.js`: cached real model/atlas icons.
* `src/hero_portrait.js`: character rig, pose, pixel renderer and rotation.
* `src/rpg/items.js`: real factories, rarities and catalogue.
* `src/rpg/classes.js`: classes and stat calculations.
* `src/persistence/model.js`: portable inventory/slot data only; no provider.
* `src/rpg/eligibility.js`, `relics.js`, `appearance.js`: pure helpers.

The inspection helper transitively imports combat definitions. Module evaluation
constructs no game, installs no game controls and accesses no saves. Browser tests
instrument all Storage reads/writes: zero calls through the full preview flow.
Icon loading creates the shared icon renderer and atlas-ready event. Character
preview creates one renderer and reuses it through item/class changes. pagehide
cleans up its observer/renderer. No audio engine starts.

Speed is a multiplier relative to family base rate, never attacks/second. Damage
uses existing item and character calculations. Existing protection means item
lock; it is separate preview metadata, not a reroll. Equipment restrictions mirror
the baseline (off-class weapons are allowed at 80% scaling). No new restrictions,
progression, powers, stacks or fabricated requirements are introduced.

## Run and verify

From repository root:

```sh
node serve.mjs
# http://localhost:8080/dev/inventory-preview/index.html
node dev/inventory-preview/verify.mjs
```

The verifier starts its own server unless `PREVIEW_URL` is set. Requires Playwright
and Chromium. Optional `CHROMIUM_PATH` selects a local Chromium executable;
`CODEX_PRIMARY_RUNTIME_NODE_MODULES` is an optional environment-specific fallback
for Playwright. Existing shared test configuration is untouched.

Verification covers desktop 1280×720, desktop 1920×1080 and narrow 390×844;
selection, filters, all rarities, effect/attack search, Details via keyboard,
no mutation from inspection/sorting, exact-roll equipping, protection, unequipping,
five rig switches, renderer reuse, drag/keyboard zoom, footer accessibility,
no-results/empty states, long sample names, full-bag protection, storage isolation
and original game title startup. Captures live under `screens/`.

## Later integration

1. Approve visual direction before connecting to the live inventory.
2. Reuse scoped `style.css`, three-column HTML composition and description
   rendering. Keep shared icons and portrait rather than creating competing assets.
3. Replace `PreviewState` with an adapter to the current game's `inv`,
   `equipItem`, `equipSlotFor`, `toggleLock`, `canEquip`, `recalc` and save lifecycle.
   Do not transplant the sample factory or its session cache into gameplay.
4. Connect selection/filters to live UI lifecycle, preserve input ownership and
   pause rules, and mount/dispose one portrait when the real inventory opens/closes.
5. Recheck newly finished Claude item slots, building/crafting categories and
   character APIs. None are anticipated or invented in this preview.
6. Roll-range rendering and the family-speed comparison note are preview-only
   additions. Consider moving these into `item_info.js` in a separately reviewed
   integration change, with regression tests for all consumers.
7. Live drop/salvage, skill navigation, hotbars and inventory persistence remain
   outside this study. Reconnect real actions only in the later integration pass.

## Known limitations

* Sample rolls vary on page reload; browser tests seed the RNG for reproducible
  captures. Switching back to an already viewed class retains its sample rolls.
* Narrow view stacks the three panels and scrolls the document. This is inventory
  responsiveness, not full mobile-game certification.
* No live combat, XP, salvage transaction, campaign state or save import/export.
* Character appearance is the actual current game model, not the reference's art.
* Headless software-rendered Chromium checks do not establish hardware FPS.

## Files

`index.html`, `style.css`, `grain.svg`, `state.js`, `app.js`, `verify.mjs`,
`README.md`, `screens/compact-1280.png`, `screens/details-1280.png`,
`screens/compact-1920.png`, `screens/narrow-390.png`.
