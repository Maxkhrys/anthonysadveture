# Dev Lab, inventory clarity, elemental effects, deaths and audio

Branch `feat/devlab-inventory-vfx`, based on `feat/world-discovery-expansion` @ `7beb9de`, which itself sits on the class combat rework (`09189fc`). Nothing is merged to main, and production is untouched.

## Player-facing

- **Inventory clarity**
  - **Bag tiles:** each tile has a rarity-coloured border and a rarity label in words and shape (● Common, ◆ Uncommon, ◆◆ Rare, ✦ Epic, ★ Legendary, ✧ Prismatic), over deeper olive slots.
  - **Compact card:** name, rarity, type and class, damage, attack speed and both attack names.
    - Attack speed is shown as a multiplier of the weapon family's base rate. It is never labelled as attacks per second.
    - Unique powers are always shown in full; other properties are capped at three, with a "+N more" indicator.
  - **Details button:** it works with the mouse, the keyboard and touch. It lists every effect with its chance and cooldown, roll ranges, set bonuses, scaling, item level and salvage.
  - **Rarity and roll quality:** an item's rarity and the quality of each rolled stat are labelled separately ("roll quality").
  - **Comparison:**
    - labelled like-for-like rows;
    - shows when the left or right-click attack would change;
    - never declares a winner.
  - **Where it appears:** the same card is used in the bag, on drop hover labels, in the codex and in the Dev Lab.
  - **Action buttons:** Equip, Favourite and Salvage stay visible while the details scroll.
- **Elemental effects,** tied to real combat events (cast, release, impact, status, death):
  - **Lightning:** bolts drawn from source to each enemy the chain actually hit, with brief branches and a short local flash; sparks on shocked foes.
  - **Fire:** ember bursts, smoke and a small shockwave.
  - **Frost:** cold mist and icy bursts; the existing ice shell while frozen.
  - **Hex:** a floating sigil while the target is Hexed. It flickers just before it ends and disappears the moment it does.
  - **Soul:** afterimages and spirit wisps.
  - **Poison and thorn:** droplets.
- **Hits and deaths by material:**
  - **Flesh:** directional blood and short-lived stains.
  - **Plant:** sap and leaves.
  - **Construct:** stone and metal pieces plus sparks.
  - **Insect:** shell pieces and dark fluid.
  - **Spectral and ink:** wisps that dissolve.
  - **One death effect per kill,** chosen from the fatal hit and statuses: frozen foes shatter; burning foes char and smoke; lightning kills flash; explosions scatter pieces; soul kills release a spirit.
  - Small damage ticks stay quiet.
- **New settings (Settings):**
  - **Combat effects:** Minimal, Normal or High.
  - **Blood:** Off, Reduced or Full. Off removes blood only; sap, sparks and every gameplay warning remain.
  - Screen shake and hit flash keep their existing settings.
- **Sound:**
  - distinct cast and impact sounds for fire, frost, lightning and hex;
  - a soul release, a chain snap and an explosion;
  - material hit and death sounds;
  - a short bell run for level-up, then a skill-point chime;
  - separate Rare, Legendary and Prismatic drop cues;
  - a voice budget so a crowd of procs cannot bury your own hit.

## Developer and testing (MOSSDEV)

- **Opening it:** turn on Settings → Developer mode. Then press F10, click the small "MOSSDEV · F10" button, or choose it from the title menu. With Developer mode off there is no lab access. (A key or setting is a convenience, not authentication.)
- **Isolation:**
  - The lab uses its own storage key (`mossling-devlab-v1`). Entering from an adventure saves the adventure first and then runs a sandbox copy.
  - Test items, god mode, stats, loot and boss flags never reach adventure saves. The test `devlab` checks this byte-for-byte.
  - Return to Adventure reloads the saved adventure and puts the character back where it stood.
- **Persistence:**
  - The lab keeps its own character (class, level, exact item rolls, skill ranks, arena, cheats, presets). On refresh the test is rebuilt from that setup.
  - Opening and closing the panel does not reset the test. The full panel pauses the simulation; a small live telemetry panel shows during tests.
- **Sections:**
  - **Recently added:** one-click tests from a data manifest (`src/devlab/manifest.js`).
  - **Character:**
    - class, level, XP, health and resource, refill, cooldown reset;
    - god mode, infinite resource (per class: five Echoes for Soulbound, Grit for Gunslinger), infinite ammunition and movement speed;
    - a clearly labelled, off-by-default equipment rule bypass.
  - **Items:**
    - a searchable catalogue from the real registries, filterable by class, family, slot, rarity, element, named/legendary/prismatic, effect or attack name, and recent;
    - exact-roll preview; Spawn, Spawn + Equip, "Switch class and test", Copy ID and Save to preset;
    - developer-forced items, clearly labelled.
  - **Skills and builds:** legal "max this path" builds and twelve build presets.
  - **Enemies and bosses:**
    - crowds of 5, 10, 20 or 30;
    - validated elite modifiers (the game's own rules);
    - Bramblemaw in its own room, started by its real trigger. Phase select is disabled with an explanation.
  - **Arenas:** dummy with resolved-damage telemetry, crowd, elite, boss, element lab (Wet, Burning, Chilled, Frozen, Shocked, Hexed, Marked), loot lab and VFX lab.
  - **Loot:** 10-item samples per rarity and a 100-drop class sample, kept in a lab tray rather than the bag or the world.
  - **VFX:** previews that use the same functions as combat.
  - **Presets:** save, load, delete, export, and import with validation.
- **Telemetry:**
  - DPS over the last 5 seconds, test-average DPS, damage per hit, crit rate on direct hits, releases per second, status uptime and procs;
  - damage split into direct, damage-over-time, summon and proc.
  - All of it is measured from the health the target actually lost.
- **Reset Test:** restores the saved setup and clears projectiles, statuses, summons, effects and telemetry. Repeated resets do not leak entities or listeners (tested).

## Tests

- **New browser suites:**
  - `devlab`: 23 checks;
  - `inventory_clarity`: 13 checks;
  - `combat_fx`: 12 checks.
- **Capture tool:** `zshots_devlab` (captures only).
- **Unit tests:** 82 of 82 pass.
- **Screenshots:** in `docs/screens/devlab/`.

## Known limitations

- **Boss phases:** phase select is not available; only Bramblemaw is wired to the lab.
- **Stacked elites:** stacked elite modifiers are not offered (the enemy data holds one).
- **Forced items:** they cannot choose an element (it comes from the base or the unique). Effects can only be added to items with gameplay rolls.
- **Basic melee:** basic melee swings do not emit combat events, so their presentation comes from the material hit layer, not the event bus.
- **Performance:** it was measured only in headless tests (budgets held with 30 enemies). There are no hardware FPS figures.
- **Chapter suite:** it fails on this branch and also on its baselines (`09189fc` and `686a64b`, the commit before the combat rework), so the failure predates this work.
- **Deferred:** progression changes (item-level requirements, star ranks, new rarity odds) are not part of this pass.
