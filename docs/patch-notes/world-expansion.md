# World expansion

Branch `feat/world-discovery-expansion`, based on `feat/class-combat-rework` @ `09189fc`.

## Player-facing

- **A new Thimblewick.** The town is rebuilt around the same Bell Tree square, and the bell, Bellstone, Elder Tamsin, Posy, the workbench and Brisk's yard stay where they were.
  - **The Bell Tree:** the old bell tower is now held in the roots of an enormous tree hung with bells and lanterns.
  - **Market Row:** stalls to the west.
  - **The Terraces:** raised homes under the root arch to the north-east.
  - **The Lantern Lane:** runs south with cottages and window boxes, down to the Thimble Brook and a footbridge.
  - **The arrival hill:** new characters arrive here beneath a welcome arch, looking up into town.
  - **The Hedge Garden:** a garden at the wood's edge with a spring pool and a gazebo. It hides a secret (break the grown-over gap) and the Root Lift.
- **The Clockwork Garden** (about level 5–7). Enter through the Clockwork Gate, north of the east road past the Mirrowrun bridge.
  - A narrow Hedge Gallery opens onto the Great Clock.
  - **Around the Clock Court:** the Rusted Wheelworks (a guarded fight with an elite), the Bronze Belfry Frame (a bell puzzle) and the Topiary Maze (its lever and a hidden alcove).
  - **The Gearhouse outpost:** a Bellstone and Cogsworth Pim, who gives the quest *Wind the Old Clock*.
  - **The Clockwork Undercroft:** a mini-dungeon.
  - **Shortcuts:** the Mainspring Gate and the wicket.
  - **Secrets:** the Lost Pocket Garden and the Gardener's Alcove.
- **The Rootlight Caverns** (about level 8–10). Enter down the Rootlight Mouth in the Deepwood.
  - A tight root passage opens onto the luminous Glowroot Hall, with a root bridge across a glowing chasm and a fight with the Rootwarden (an elite).
  - **Further in:** the Crystal Seam, with the Lumen Burrow mini-dungeon beneath it, and the Underlake with its ford and a sunken-block islet secret.
  - **Glowroot Refuge:** a Bellstone and Mira the Lampkeeper, who gives the quest *Wake the Glowcaps*.
  - **The Root Lift:** a persistent shortcut up into Thimblewick's Hedge Garden.
- **Discovery moments:**
  - The first time you arrive in a new region, a parchment title card and a bell cue appear. They are queued during fights and dialogue, and happen once per character.
  - Places are listed in the journal under "Places discovered".
  - *Settings → Interface → Discovery moments*: Title card / Small note / Off.
- **Map waypoint:** pick a place in the atlas and set it as your waypoint. The minimap shows its bearing and straight-line distance; it never draws a fake path.

## Developer and integration

- **New modules:**
  - `src/world/regions7.js` (region builders);
  - `src/world7.js` (runtime objects, discovery queue);
  - `src/story7.js` (NPCs and quests);
  - `src/ui_world7.js` (discovery card and waypoint);
  - `src/world/models7.js` (models);
  - `world7.css`.
- **Shared-file hooks (additive):**
  - `game.js`: builders, installs, the outdoor/underground atmosphere, the tick;
  - `world6.js`: discovery in region areas;
  - `models.js`: model fallback;
  - `ui.js` and `ui_atlas.js`: region map colours and the pick hook;
  - `settings.js`: the discovery option;
  - `persistence/model.js`: Bellstones and layout 3;
  - `layout.js`: biomes and regions appended;
  - `minidungeons.js`: `exitArea`;
  - `onboarding.js`: hub bounds and text;
  - `index.html`: the stylesheet link.
- **Save migration:** `LAYOUT_VERSION` 3 is idempotent. A death drop that lies inside the rebuilt town moves to the Bell Tree square. The fog grid size is unchanged, and new state lives in `sig:w7:*` flags and `w7:waypoint`.

## Verification

- **Quest playthroughs:** `tests/world7.test.mjs` (23 checks) plays both regions through the real game:
  - the ways in and out, and the discovery card (once per character, and it respects the setting);
  - both side quests start to finish, the bell puzzle, the three shortcuts (Mainspring Gate, wicket, Root Lift) and the Undercroft exit;
  - the waypoint and the journal;
  - everything survives a reload.
- **Unit tests:** `tests/world.unit.mjs` covers the builders, reachability, mini-dungeon exits and the idempotent layout-3 migration.
- **Dev Lab handoff:** `docs/world-expansion-devlab.json` has stable ids and sandbox-only recipes for the arrival tour, each entrance and its landmarks, both quests, the secrets, both mini-dungeons, discovery re-entry and an old-save migration.
- **Captures:** `docs/screens/world7/` holds Thimblewick before and after, the Clockwork Garden, the Rootlight Caverns and the discovery card. Recreate them with `OUT=docs/screens/world7 TAG=after node tests/run.mjs zshots_w7`.

## Fixes after the first preview

- Region camera: in region areas the camera now stops at the map edge, so the entrance lawn no longer shows empty sky.
- The Glowroot chasm has crystals glowing from below.
- Discovery card: its resting state is fully visible, so it can never get stuck invisible if an animation does not run. It also sits a little lower, clear of the "Found:" note.

## Known limitations

- Two older checks fail on this branch, and both fail on the baseline too (so not caused by this work):
  - **World suite, "west road reaches Rootwell Hollow":** also fails on `09189fc`.
  - **Chapter suite (samurai run):** also fails on `09189fc` and on `686a64b`, the commit before the combat rework.
