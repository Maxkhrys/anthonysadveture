# Pass 8 — loot, Emberwell and alpha polish

Preview: https://mossling-d3yz12ocd-maxs-projects-f319fcff.vercel.app

## Included

- Fifteen named class weapons inspired by the supplied progression sheet: actual equipment models, projectiles and named effects. Three Prismatic signatures use the existing legendary save rarity; the existing eight affix tiers remain intact.
- Five universal relics: extended equipment pickup, nearby secret pins, two extra bag slots, one Phoenix recovery per life and a persistent choice of area boon.
- Loot placement and attraction respect terrain and collision. Bag capacity, salvage, shop and equipment rules agree; removing the satchel cannot overflow the bag.
- A registry-backed creative catalogue in the devroom inventory: 180 entries covering equipment, materials, recipes, tools, supplies, quest rewards and map fragments. Search names, IDs, classes or descriptions; filter categories and grant material stacks. Both display and grant actions require `area.id === 'devroom'`. Normal bag management remains available. Existing sandbox save rules still apply.
- Hobb's short opening quest now gives a class weapon, tonic capacity and a clearer route into the first dungeon. Controls and story text match the current build.
- Emberwell: eight connected rooms, an apprentice encounter, the Cinder Rod, kiln and ordered furnace puzzles, a reachable charged-gust puzzle, two Bellstones, the Kiln Regent's guarded/exposed phases, a class legendary, Ember Chime and Tamsin's return reward.
- Y swaps the Cinder Rod and Gustbellows; L uses the selected tool. Emberwell requires Verdant Chime and Gustbellows, with a level-12 recommendation.
- Alpha bug-report download, game-canvas screenshot, adventure export, and copy-only import from the title screen. Imports preserve originals and assign fresh character/item ownership IDs.
- Persistent quest tracking, title camera aligned with the expanded world, stable pointer selection in dialogue/title menus, and title dialogue layered above the menu.

## Validation

See the browser and unit commands below. The alpha suite tests real download contents and the title import flow, not just parser helpers. Emberwell tests encounter progression, the actual charged gust, core exposure, rewards and checkpoint reload. Creative tests verify the full equipment registry, actual item grants, material quantities, tool use state and removal outside the devroom.

```sh
node --test tests/persistence.unit.mjs tests/dev_commands.unit.mjs tests/dev_tools_pass2.unit.mjs tests/world.unit.mjs tests/transfer.unit.mjs
CHROMIUM_PATH=/path/to/chromium node tests/run.mjs alpha8 ember8 loot8 creative8
CHROMIUM_PATH=/path/to/chromium node tests/run.mjs aim balance crafting integration loop persistence skills village content world ui7 ui7_interactions
```

Balance checks cover all three classes at multiple levels, ordinary/heavy incoming damage, recovery, parries, proc recursion and existing crafted builds. New weapon proc cooldowns and echo guards limit chains. This is an alpha tuning pass, not a claim that long-term balance or difficulty feel is final.

## Remaining game work

Tide Shrine and Chime Spire remain future campaign chapters. Controller hardware testing is deferred at the user's request. Touch/mobile gameplay and long-session hardware performance have not been certified. Existing UI checks exercise 390–2560px layouts, but this does not establish full mobile gameplay support.

Saves belong to a browser origin. To move an existing adventure onto a new preview URL, export a recovery copy from its old title screen, then choose **Import adventures…** on the new title screen.

## Creative armoury polish

The devroom catalogue now takes the full journal width. Every entry has an image: equipment uses cached renders of the actual models; supplies use illustrated inventory symbols. Select an entry to inspect its effect and category before pressing Add. Rarity filtering and sorting use the same rarity resolution as granted gear; non-equipment entries are explicitly Unranked. Search also matches class, type and rarity. Clear/reset controls preserve normal keyboard focus. The preview keeps its Add button visible on short desktop screens. Mobile uses a single-column catalogue and scrolls the selected preview into view.

Validation: 18 creative browser checks passed, including loaded images, all equipment rarity mappings, filters, sorting, quantities, desktop Add visibility and 390px overflow. Nine existing interaction checks also passed. Screenshots: `docs/screens/pass8/creative-armoury.jpg` and `creative-mobile.jpg`.

## Inventory overhaul

Regular inventory now uses a dark olive and brass layout: bag on the left, character in the centre-right and a dedicated item inspector on the right. All 30 standard slots fit at 1280×720 and 1600×900. The character faces the player, with drag rotation and wheel zoom. Equipment, stats and comparison details remain accessible in their own panels; narrow screens stack the layout.

Every bag tile displays its actual model, name and rarity border. Search matches names, types, rarity and effects; category, rarity, class and protected-item filters combine with newest, rarity, power, slot and name sorting. Clear/reset controls and empty states explain the current result. Equip, favourite and salvage actions remain in the inspector, preserving existing protection and comparison rules. The devroom creative catalogue remains available only in the devroom.

Validation: 18 inventory checks, 18 creative checks, 9 interaction checks and 34 existing UI checks passed (79 total). Includes real equip/protection actions, Prismatic and class filtering, sorting without bag mutation, all standard slots visible on desktop, responsive bounds and no page errors. Screenshots: `docs/screens/pass8/inventory-1280.jpg`, `inventory-1600.jpg`, `inventory-390.jpg`.

```sh
CHROMIUM_PATH=/path/to/chromium node tests/run.mjs inventory9 creative8 ui7_interactions ui7
```
