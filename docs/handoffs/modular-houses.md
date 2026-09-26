# Handoff: modular houses (feat/modular-houses)

- **Base:** `feat/devlab-inventory-vfx` @ `9ea8601af821c39993157304d48b08a129d48e0b`.
  - This is the shared starting commit with `feat/survival-ui-gathering`.
  - It already includes Survival (`004add0`), the dark inventory (`33ab525`) and the MOSSDEV isolation fixes (`9ea8601`).
- **Final SHA:** the head of `feat/modular-houses` when it is pushed (the last commit is this documentation). The code milestones are listed below.
- **Scope:** this branch owns modular structures, placement, collision and support, doors, interiors, stairs and upper floors, roof and wall visibility, structure persistence and generated house templates.
- **Not touched:** inventory or crafting screen design, gathering effects and audio.

## Commits

1. `c6363d0`: modular kit registry and placement.
2. `e953530`: storey heights, stairs and floor-separated combat.
3. `fcc30e9`: generated houses from the same kit (generator v2).
4. `2b43015`: storey-aware shots and statuses, the stair guard and save-version fixes, and the tests.
5. (this commit) screenshots, patch notes and this handoff.

## Files

- **New:**
  - `src/survival/kit.js`: the registry, grid constants, models and collision boxes.
  - `src/survival/houses.js`: the grid, support heights, placement, removal and trap rules, and the cutaway. Pure logic.
  - `src/survival/pieces.js`: the `KitPiece` and `PieceCollider` entities.
  - `src/survival/templates.js`: the generated house templates.
  - Tests: `tests/houses.test.mjs`, `tests/houses_classes.test.mjs`.
  - The capture script: `tests/zshots_houses.test.mjs`.
  - Docs: `docs/screens/houses/*`, `docs/patch-notes/modular-houses.md` and this file.
- **Survival files changed:**
  - `mode.js`: the build flow, the API below, the hooks, chunk streaming of pieces and houses, doors, unstuck, and saving your height.
  - `entities.js`: `PIECES` is now the combined registry. Furniture has levels and rotation. `pieceParts` is exported.
  - `craft.js`: kit recipes; legacy recipes flagged.
  - `store.js`: the save fields and defaults below.
  - `gen.js`, `biome.js`, `world.js`: generator v2 and house sites.
  - `ui.js`: see the shared-file changes below.
- **Shared engine files changed:** see the section below. Each change is small.

## Registry and stable ids

Kit pieces (in `KIT` in `kit.js`, and also in `PIECES` with `kit: true`):

| id | kind | layer | levels | recipe cost |
|---|---|---|---|---|
| `stone_foundation` | cell | floor | 0 | stone 6 (by hand) |
| `timber_floor` | cell | floor | 0–2 | wood 4 (by hand) |
| `timber_wall` | edge | wall | 0–2 | wood 4 · workbench |
| `timber_window` | edge | wall | 0–2 | wood 5 · workbench |
| `stone_wall` | edge | wall | 0–2 | stone 6 · workbench |
| `timber_doorway` | edge | wall | 0–2 | wood 3 · workbench |
| `timber_door` | edge | wall | 0–2 | wood 6 · workbench |
| `timber_post` | vertex | post | 0–2 | wood 2 · workbench |
| `timber_stairs` | cell | stairs | 0–1 | wood 8 · workbench |
| `thatch_roof` | cell | roof | 0–2 | wood 2, fibre 3 · workbench |
| `thatch_ridge` | cell | roof | 0–2 | wood 2, fibre 3 · workbench |
| `timber_gable` | edge | gable | 0–2 | wood 3 · workbench |

- **Furniture (1 tile):**
  - `campfire`: level 0 only.
  - `workbench`, `chest`: levels 0–2, and they rotate.
  - `torch`: levels 0–2.
- **Legacy (still loads, `legacy: true`, not listed):** `floor`, `wall`, `stonewall`, `door`, `roof`.
- **Recipe ids:** each equals the piece id. `RECIPES[].legacy` marks the old ones.
- **Generated piece ids:** `house:<rx>,<rz>:<index>`. Templates are append-only per generator version, and the ids don't depend on how the house is turned.

## Placement and elevation API (for the crafting UI)

All on `game.survival` (a `SurvivalMode`):

- `pieceInfo(type)` returns `{ id, name, desc, kind, levels, rotates, legacy, layer, cost, qty, station, recipe }`.
- `recFor(type, x, z, lv, r)` returns the snapped record `{ type, x, z, lv, r }` for a world point.
- `checkPiece(rec)` returns `''` when placeable, otherwise a player-facing reason.
- `placePiece({ type, x, z, lv, r })` returns `{ ok, why, id, piece }`.
  - It validates first and spends exactly one kit only on success.
- `pickTarget(x, z, lv)` returns the piece entity under a point on a level: furniture, then walls and gables, posts, stairs, roof, floor.
- `canRemove(id)` returns `''` or a reason. It refuses when something depends on the piece and never removes dependants.
- `removePiece(id)` returns `{ ok, why }`.
  - It refunds exactly one kit, once.
  - A chest's contents go back to resources.
  - A generated piece is recorded as removed.
- `toggleDoor(pieceEntity)` returns true or false. It refuses to close on a body.
- **Build mode (existing, extended):**
  - `startBuild(type | 'demolish')`, `endBuild()`.
  - `build = { type, lv, r, rec, ok, why, info, ghost }`.
  - `build.info` is a short text: the level, facing, and key hints.
- `canCraft` and `craft` are unchanged. Quantities and recipe tracking are left to the UI pass.
- **Rules and geometry helpers:**
  - Pure rules live in `houses.js`: `placeWhy`, `removeWhy`, `supportWhy`, `snapPiece`, `locate`, `slotKey`, `footprint`, `supportHeight`, `applySupport`, `sameLevel`, `levelOf`.
  - Grid constants live in `kit.js`: `M = 2`, `STOREY = 2`, `FLOOR_T`, `FOUND_T`, `MAX_LEVEL = 2`, `ROOF_RISE`.
- **Rotation (`r`):**
  - Cells and furniture face `r` (0 +z, 1 +x, 2 −z, 3 −x).
  - An edge's axis is `r % 2` (0 runs along x); `r ≥ 2` flips a door's swing.

## Save-format additions and defaults (`mossling-survival-v1`, schema 1)

- `structures[]`: `{ id, type, x, z, lv?, r?, open? }`.
  - A missing `lv` or `r` means 0 (ground floor, unturned). Values are clamped and made whole numbers.
  - A record without a type or position is kept aside in `brokenStructures`, never deleted.
- `houses`: `{ [houseId]: { removed: { pieceId: true }, open: { pieceId: bool }, suppressed?: true } }`. It defaults to `{}`.
- `pos.fy`: the height you were standing at. On load it is used only if a surface is still there.
- `genVersion`: new worlds get 2. A record without one is treated as 1 (this was fixed: it used to take the current version).
- `kits`: made whole numbers and at least 0.
- Nothing is written to the Story save or the MOSSDEV save. The tests check the Story save byte for byte, and check that MOSSDEV cannot write the Survival save.

## Controls introduced (`src/engine/actions.js`)

- `buildRotate`: T or the mouse wheel.
- `buildUp`: `]` or Page Up.
- `buildDown`: `[` or Page Down.
- They are flagged `build: true` and act only in Survival build mode.
- T is otherwise only the inventory's context sort key, and the inventory is closed while building.
- The wheel is read from the window (the HUD covers the canvas), except over open panels and screens.
- Build mode already suppressed attack and secondary; it now also suppresses the Bell Surge (R).

## Shared-file changes for Codex to review

- `src/entities/entity.js`, `sync()`:
  - calls `g.support(e)` for the player and enemies when it is set;
  - adds `fy` into `gy`.
- `src/game.js`:
  - `spawn()` calls `g.onSpawn(e)` before attach.
  - `hitArc` skips targets that fail `g.sameLevel(src, e)`.
  - `playerHit` returns early when the target is on another storey (compared with `o.arpgProjectile` or the player).
  - `solidAt(x, z, r, who)` honours `solidFor(who)` (a heuristic probe when `who` is missing).
  - `interactTarget` only offers same-storey targets.
- `src/rpg/combat.js`:
  - The projectile sweep skips foes on another storey.
  - `solidAt` is passed the projectile.
- `src/entities/player.js`: `hurt()` ignores hits whose `src` is on another storey.
- `src/engine/actions.js`: three build actions, plus the "While building" label in the controls list.
- `src/engine/input.js`: the `wheel` accumulator.
- `src/survival/ui.js` (3 lines, UI owned by Codex):
  - legacy recipes are hidden;
  - legacy pieces are shown only when you still hold kits;
  - `build.info` appears in the build bar.
- `src/survival/entities.js` (`PIECES`): now generated from `KIT` plus furniture plus legacy, each with `kind`, `levels`, `rotates`, `legacy`. The Build list reads this.
- All the storey hooks are null outside Survival, so Story and MOSSDEV behave exactly as before.

## Tests run and results (on this branch)

- `houses`: 62/62.
  - Covers the registry, crafting spend, a full two-storey build, 11 placement refusals, no spend on refusal, and the ghost's rotation and level.
  - Real keys (T, `]`, X) and a DOM wheel event.
  - The real Build panel with a mouse click at the cursor.
  - Churn counts stay stable; exact refunds; dependency refusals; chest contents returned.
  - Entrapment; doors; stairs both ways and from the side and behind.
  - Upper walls, falls without damage, chests on both floors, and interaction on your own floor only.
  - Storey-separated melee, strikes and arrows, and walls stopping arrows.
  - The cutaway; save and reload upstairs; Unstuck, death and Go Home.
  - Generated determinism; v1 byte-identical; stable ids.
  - Entering a generated cottage and climbing it; generated changes persisting with no regrowth.
  - Streaming three times; caves; old-save defaults; MOSSDEV round trip and refresh; the Story save unchanged.
- `houses_classes`: 26/26. For every class: the door, the stairs up, rolls and the first ability against walls and floors, the stairs down, and attacks through a floor (plus a same-floor control).
- **Regressions:**
  - `survival`: 21/21. Updated for generator v2 and to count only the player's own pieces after a reload.
  - `survival_inventory`: 15/15.
  - `persistence`: 13/13.
  - `weapon_kits`: 88/88.
  - `devlab`: 23/23.
  - All unit suites: 82/82.
  - The full browser run is in the PR/report notes.
- **Counts** (the test world, near the player house): about 330 entities, 49–53 house slots, 122 scene materials, 200–208 geometries. They are unchanged after 30 place/remove cycles and 10 ghosts.
- **Screenshots:** `docs/screens/houses/*_1280.jpg` and `*_1920.jpg`:
  - the cabin exterior and its interior;
  - the cottage exterior and the character upstairs;
  - the placement preview on level 1;
  - the player-built house and it upstairs;
  - the house restored after a reload;
  - the ruin.

## Known limitations

See the patch notes. In short:
- Creatures don't navigate doors or stairs.
- Flying creatures ignore walls.
- Existing same-storey teleports can cross walls, and a teleport can drop you a storey (you fall to the surface below).
- Floors go up to level 2.
- The build UI is minimal (for the Survival UI pass).
- There are no hip roofs.
- Legacy tile pieces can't share a module with the kit.
- No hardware frame-rate figures.
