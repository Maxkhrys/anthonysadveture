# World expansion (work in progress)

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

## Known limitations (to finish)

- The Dev Lab handoff file (`docs/world-expansion-devlab.json`), a before/after capture set and dedicated region tests are still to come.
- Full playthroughs of both quests have not yet been automated. So far only the builders, loading, discovery and the migration have been verified.
- In region areas the camera can show empty space past the map edge near the entrance lawn.
- The old "west road reaches Rootwell Hollow" check fails on the baseline too.
