# Pass 8 — loot, Emberwell and alpha polish

Preview: https://mossling-6vgvchcmq-maxs-projects-f319fcff.vercel.app

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
