# Pass 7: the brass-bound field journal

Base commit: `91474c95f19979af2947aba97f9f88d75bab387c`.

Branch: `astra/pass7-ui-direction`. PR: https://github.com/Maxkhrys/anthonysadveture/pull/8

The implementation commit also has `c982fe522016715a5b88f7b915b019f3f031be3f` as a parent, preserving the latest developer console slash shortcut. No world-expansion branch existed at inspection or the final remote check. This is stacked on Pass 5, including its integration with developer tools, rather than the older default branch. No production deployment or upstream merge.

## Interface

Shared parchment, aged brass, dark insets, engraved ability marks and serif headings. `journal.css` owns the presentation system; `src/ui_journal.js` connects existing systems rather than creating alternate inventories or progression. Item models and rotating paper doll remain actual game renders. All nine equipment slots are retained.

Inventory has a ten-column desktop grid and six-column narrow layout, search, category filtering, sorting, selected/equipped comparison, prominent deltas, direct equip and favourite/protect actions, salvage, and armour/accessory unequip. Weapons remain equipped, because the current combat architecture requires a weapon. Ring 1/2 selector governs both comparison and equipment target. Protected and engraved items cannot be salvaged. Removing equipment with a full bag is refused. Damage values are rounded for display only.

Six-slot bar retains actual cooldowns, resources, rank, duration, target and disrupted states. Upper-left vitals and quest card, upper-right map, bottom action dock. Hover/focus labels explain abilities; click opens loadout. Skill trees retain all classes, branches, prerequisite paths, active/passive/keystone shapes, costs, ranks, learn and assignment rules. Marks no longer depend on emoji fonts.

Shared journal navigation connects inventory, skills, quests, codex, map and settings. Quest entries can be selected and tracked. Codex shows real equipped items, recovered relics/tools and discovered Bellstones. Map retains authored labels/discovery logic and adds discovered Bellstone markers. It does not invent undiscovered lore or enemy records.

Workbench, reinforcement, Bellstone dialogues, NPC topics, shop, title/profile selection, death and developer console share the material system. Shop has direct Buy buttons calling the existing purchase transaction. Developer sandbox status is visible; console implementation remains upstream's.

## Defaults

| Action | Keyboard / mouse |
|---|---|
| Move | WASD / arrows |
| Aim / attack | Mouse / left click |
| Keyboard-facing attack | C |
| Guard / parry | Right click / Q |
| Dodge | Space / Shift |
| Interact / confirm | F / Enter |
| Heal / tonic | H |
| Inventory | E; I/B aliases retained |
| Skills | K |
| Journal | J |
| Map | M |
| Six abilities | 1–6 |
| Dungeon tool | L |
| Bell Surge | R |
| Pause / back | Esc |
| Favourite / protect | V in inventory |
| Salvage | X / Delete in inventory |
| Sort / filter | T / G in inventory |
| Music toggle | F8 |

`src/engine/actions.js` supplies the registry used by keyboard input, controls, interaction prompt, item actions and journal shortcuts. Form input does not trigger game actions. Tab stays inside open menus. Native controls have labels and visible focus. Menus intercept movement/combat. Existing gamepad mapping is retained; no controller redesign.

## Settings

Graphics: presets, pixel scale, shadows, bloom, effects and camera distance.
Audio: master/music/effects sliders.
Gameplay: difficulty and screen shake.
Controls: current defaults and gamepad legend.
Interface: HUD scale, damage numbers, combat text, tutorial, ability names; new quest tracker visibility and reduced UI motion. OS reduced-motion preference is also honoured. Options apply immediately and persist locally. Custom rebinding is clearly marked unavailable.

## Validation

37 unit checks: persistence 14, developer commands/tools 23.

155 existing browser checks: aim 29, balance 19, crafting 26, integration 9, loop 18, persistence 13, skills 20, village 21. Only physical key constants were updated in existing tests. The initial aiming run still pressed old J; changing that test to C produced 29/29. The initial new tonic test raced menu closure; waiting for the closed state fixed it, and H passed both the UI check and existing balance suite.

32 interface checks: inventory, nine slots, combat/movement isolation, search, favourite protection, equip, navigation, quest tracking, settings wiring, H/E/K/M defaults, reinforcement, real Bellstone dialogue, shop purchase, and viewport containment. Nine additional checks: spending a skill point via UI, sixth-slot assignment, Tab focus, unequip, Ring 2 target, J journal, slash console, sandbox and no runtime errors. Latest test source also includes the separate learn/assignment checks in the main UI suite.

Layouts checked at 1280×720, 1600×900, 1920×1080, 2560×1080 and 390×844. Narrow screens use vertically scrolling pages and a reduced HUD. All desktop menus stay within viewport. Dense item detail cards scroll independently. Visual audit corrected stretched icons, dark-on-dark skill marks, long decimal stat overflow and narrow-screen containment.

Tests used local Chromium with SwiftShader. No hardware GPU, touch combat or physical controller testing. Full-chapter bot remains the upstream WIP and is not claimed to pass. This is a UI pass, not a combat feel assessment. Saves remain browser/origin-local; another preview URL has separate storage.

## Screenshots

Actual game captures, with generated test equipment and progression for review. Developer captures use sandbox mode.

| Screen | Capture |
|---|---|
| HUD | [HUD](screens/pass7/hud.jpg) |
| Inventory | [Inventory](screens/pass7/inventory.jpg) |
| Skills | [Skill tree](screens/pass7/skills.jpg) |
| Map | [Map](screens/pass7/map.jpg) |
| Journal | [Journal](screens/pass7/journal.jpg) |
| Codex | [Codex](screens/pass7/codex.jpg) |
| Settings | [Settings](screens/pass7/settings.jpg) |
| Bellstone | [Bellstone](screens/pass7/bellstone.jpg) |
| Crafting | [Crafting](screens/pass7/crafting.jpg) |
| Reinforcement | [Reinforcement](screens/pass7/reinforcement.jpg) |
| Dialogue | [Dialogue](screens/pass7/dialogue.jpg) |
| Shop | [Shop](screens/pass7/shop.jpg) |
| Developer console | [Console](screens/pass7/developer.jpg) |
| Developer room | [Dev room](screens/pass7/devroom.jpg) |
| 720p | [1280×720](screens/pass7/inventory-1280.jpg) |
| 900p | [1600×900](screens/pass7/inventory-1600.jpg) |
| 1080p | [1920×1080](screens/pass7/inventory-1920.jpg) |
| Ultrawide | [2560×1080](screens/pass7/inventory-2560.jpg) |
| Phone menu | [390×844](screens/pass7/inventory-390.jpg) |

## Boundaries

Full remapping, new controller flows, dropping items into the world, separate sell mechanics and enemy/lore content beyond current data are not implemented. They are not shown as working controls. No new dungeons, world generation, combat tuning, item IDs or save schema changes. Latest world pass can be integrated after it is pushed and verified.
