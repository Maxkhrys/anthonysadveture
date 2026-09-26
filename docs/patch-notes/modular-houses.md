# Survival: enterable modular houses and building freedom

This is the `feat/modular-houses` branch.
- It is based on `feat/devlab-inventory-vfx` @ `9ea8601`, which already includes Survival, the dark inventory and the MOSSDEV isolation fixes.
- Nothing here is merged to main, and production is untouched.

## Player-facing

- **A building kit.** One module is 2×2 tiles, and one storey is 2 units high. The kit contains:
  - stone foundations and timber floors;
  - timber walls, window walls and stone walls;
  - open doorways and working doors;
  - timber posts and stairs;
  - thatch roof slopes, roof ridges and gable ends.
  - All pieces share dimensions, snapping and a timber-framed, stone and thatch look.
  - Gables shape themselves to the roof beside them, and stairs fit the floor they stand on.
- **Crafting.**
  - Foundations and floors are made by hand. Everything else needs a workbench.
  - Costs use wood, stone and fibre only.
  - The old 1-tile floor, wall, door and roof pieces still load and can still be placed from old kits, but they are no longer listed.
- **Building.**
  - The ghost shows the real piece on the chosen level, rotated the way it will be placed, in green or red.
  - The bar shows the level, the facing and the reason when a piece can't go there.
  - **Controls:**
    - **T or the mouse wheel:** rotate. Stairs, roofs, chests and the workbench turn; walls flip which way a door swings.
    - **`[` / `]` (or Page Down / Page Up):** change level.
    - **Click / C:** place. Hold and sweep to lay a row.
    - **Right click / X:** stop.
  - Walls snap to the nearest side of a module.
  - Nothing is spent until a piece is placed. Each placement spends exactly one kit, and taking a piece down (the Take down option in the Build list) gives exactly one back.
  - A chest that is taken down empties into your resources.
- **Rules, each with a plain reason when refused:**
  - One piece per slot per storey. Different storeys can share the same x/z.
  - Upper floors need a wall or post below, or a supported floor beside them (one module of overhang).
  - Upper walls need a floor beside them or a wall below.
  - Roofs cover a floor on their level or overhang one module.
  - Stairs need open space above and an opening at both ends. The stairwell stays open.
  - Doorways and the foot and top of stairs must be kept clear of furniture.
  - Campfires only go on the ground floor, on ground or stone.
  - You can't build on yourself or on a creature, and you can't wall yourself in.
  - A piece that holds something up (a floor, walls, a roof, furniture) cannot be taken down until that thing comes down first. Nothing is ever dropped or deleted silently.
- **Real interiors.**
  - **Doors:** F opens and closes them. A closed door blocks you and creatures, and it won't close on someone standing in the doorway.
  - **Stairs:** they raise and lower you smoothly. You enter at the low end or the top; the rails and the underside close them off from the sides and from behind.
  - **Upper floors:** they carry you and your furniture. Walls block you on their own storey only.
  - **Open edges:** walking off one drops you to the floor below, without damage.
- **Combat respects floors.**
  - Melee, shots, statuses (burn, chill and so on) and enemy attacks only connect on the same storey.
  - A foe upstairs can't be hit from below, and it can't hit you through the floor.
  - Walls stop shots on their own storey.
- **Cutaway.**
  - Inside a building, or just behind one, its roof and the storeys above you fade away, and the walls between you and the camera drop to low stubs.
  - They come back when you leave. Collision never changes.
- **Generated houses (new worlds only).** New worlds (generator v2) have at most one house per 48×48 region. There are three kinds:
  - a woodland cabin;
  - a two-storey cottage (stone ground floor, stairs, timber upper floor);
  - a partly ruined stone house with stairs up to a lone upper room.
  - They are built from exactly the same kit pieces, so they can be entered, climbed and furnished.
  - They have a chest, a workbench or torches, and a one-time loot cache.
  - They are marked on the map when you walk up to one.
- **Saves.**
  - You wake upstairs if that is where you saved (when that floor still stands).
  - Unstuck keeps you on the floor you are on when it can.
  - Death, Go Home and caves behave as before.

## Developer and integration notes

- **Elevation.**
  - Walkers (the player and creatures) carry `fy`, a support height above the ground.
  - `houses.applySupport` picks the highest surface within one step (0.55) of their feet: the ground, a floor or foundation on any level, or the ramp of the stair cell they stand in (entered from its base height).
  - Bigger drops fall under gravity, with no damage.
  - `Entity.sync` adds `fy` into `gy`, so models, the camera, mouse aim, drops and projectiles follow the storey.
  - Storey-aware solids implement `solidFor(e)`. `collide()` already honoured this; `Game.solidAt` now takes the asking entity as well.
- **Hooks exist only while Survival runs.** Survival sets these in `start()` and clears them in `stop()`, so Story and MOSSDEV run exactly as before:
  - `g.support`;
  - `g.sameLevel`;
  - `g.onSpawn`: new entities take the storey of the player, or of the creature they appear next to.
- **Compatibility policy.**
  - `GEN_VERSION` is now 2. Worlds keep the version they were made with; old records normalise to v1, never the current version.
  - v1 worlds generate byte-identically to before (the fingerprint is checked in tests) and get no generated houses. They do get the whole building kit.
  - Generated houses are never placed over the player's own pieces (checked when the house first spawns, then remembered).
- **Generated-piece policy.**
  - Generated pieces can be taken down with the normal rules, and they refund their kit once.
  - The removal is saved in `world.houses[id].removed`, so a piece never regrows and can't be farmed by reloading.
  - Door states are saved in `world.houses[id].open`.
- **Performance.**
  - Pieces use shared cached geometry and the shared vertex-colour material.
  - The cutaway only scales models, and it recomputes targets only when your building, storey or row changes. No material is ever cloned.
  - Pieces and colliders stream with their chunk (3×3 around the player).
  - 30 place/remove cycles and 10 ghosts leave entity, material, geometry and slot counts unchanged (tested).
  - Headless software rendering gives no meaningful frame-rate figures, so none are claimed.
- **Where the details are:** `docs/handoffs/modular-houses.md` has the full list of ids, the API contracts, the save format and the shared-file changes.

## Known limitations

- Creatures do not path through doors or up stairs on purpose; they chase in a straight line. A creature below you stays below, and neither of you can hurt the other through the floor.
- Flying creatures ignore walls, as before.
- Ability teleports that already existed (for example the Soulbound rift return) can still cross walls on the same storey. Landing where there is no floor at your height drops you to the surface below.
- Placing, rotating and choosing a level work in the existing, minimally updated build bar. Recipe quantities, tracking and a richer build UI are for the Survival UI pass.
- Floors go up to level 2; stairs reach at most level 2.
- Roofs are slopes and ridges on the module grid (no hip roofs). A roof deeper than three modules needs a flat top.
- The legacy 1-tile pieces cannot share a module with kit pieces on the ground floor.
- In the tests, the Soulbound's sweeping lash can skip a target at 30 simulated fps (the same as on the base commit). The tests use 60 fps for attacks.
