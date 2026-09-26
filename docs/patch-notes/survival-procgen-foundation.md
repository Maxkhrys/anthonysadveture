# Survival mode, procedural world foundation, gathering, crafting and a new main menu

Branch `feat/survival-procgen-foundation`, based on `feat/devlab-inventory-vfx` @ `bc7e2d7`. That base contains the class combat rework, the world pass, the Dev Lab pass and every earlier branch (none of them have commits outside it). Nothing is merged to main, and production is untouched.

## Player-facing

- **Main menu**
  - **Top level:** Play Story, Play Survival, Settings, How to Play, and Saves & recovery (plus MOSSDEV when Developer mode is on).
  - **Description card:** the highlighted item shows a short card explaining it.
  - **Separate lists:**
    - *Story* lists story characters only (new, continue, delete).
    - *Survival* lists survival worlds with their class, seed, generator version, play time and progress.
  - **New survival world:** a small form for name, seed (blank for random; words work too) and class.
  - **Deleting a world:** always asks first and never touches story saves.
- **Survival mode** (new and experimental; Story mode is unchanged)
  - **Start:** you begin in a small, safe clearing with your class's starter weapon.
  - **Hints:** a short hint list takes you from wood to stone, then a campfire, a workbench, exploring, and the cave.
  - **The wilderness** (Mosswood Wilds) is generated from the world's seed: glades, tree clusters, stone patches and outcrops, ponds with wadeable edges, natural paths between places, old ruins with a cache, standing stones, and cave mouths.
    - **Fixed per seed:** a guiding ruin north of camp and a first cave east of it.
    - **Difficulty:** it grows with distance from camp.
  - **Gathering:** hit trees, rocks, ore veins and fibre shrubs with your normal attacks.
    - Every class can gather. One strike is one unit of work, heavy blows count double, and a short per-node cooldown stops rapid-fire weapons stripping a forest.
    - Nodes shake and shrink as you work them, and the pieces pop out and fly to you.
    - Felled nodes stay gone.
  - **Crafting** (G, or the Craft & build button):
    - **By hand:** campfire, workbench, torches and floors.
    - **At a workbench:** wooden and stone walls, doorways, roofs, a storage chest, and a crystal tonic.
    - Costs show what you have and what you are missing.
  - **Building:**
    - Tile-snapped placement with a green or red preview and a reason whenever it can't go there. You can never wall in the tile you stand on.
    - Roofs fade when you walk under them.
    - "Take down" returns the piece whole; a chest's contents go back to your resources.
  - **Camp:**
    - The first campfire becomes home. Resting there heals, refills and sets home.
    - Chests store resources.
    - Torches and campfires light the night (shared light budget).
  - **Caves:** a chain of authored rooms stitched from the seed.
    - They hold creatures, glow crystals, ore and a reward cache (resources plus a class-correct gear roll).
    - Defeating every creature clears the cave for good. The reward is taken once. Felled crystals stay gone.
  - **Exploration:**
    - A discovery toast marks each new cave, ruin or standing stones on the map.
    - Home is marked, and the first cave is pointed to at the right step.
    - Go home, unstuck and Save & quit are in the craft panel.

## Technical

- **Code:** `src/survival/` holds:
  - `biome.js`: data for the biome, generator version and world bounds;
  - `gen.js`: pure, seeded per-chunk generation;
  - `world.js`: the area, with lazy chunk generation hooked into the renderer's streamer;
  - `cave.js`, `entities.js`, `craft.js`, `mode.js` and `ui.js`.
  - Styles are in `survival.css`.
- **Determinism:** the same seed and generator version give the same chunks (`fingerprint()`). Each chunk depends only on the seed, its position and the version, so the 480×480 bound can grow later without changing existing land.
- **Streaming:**
  - Chunks (24×24) are generated the first time the renderer or the player needs them.
  - Nodes, landmarks, creatures and structures spawn for the 3×3 chunks around you and drop beyond 2 chunks away.
  - Nodes are drawn with one instanced mesh per model variant per chunk.
- **Saves:**
  - They use their own key, `mossling-survival-v1`.
  - Each world keeps its seed, generator version, character inventory and position, resources, build pouch, removed nodes, structures, chest storage, opened caches, discoveries, explored chunks, cave state and hint progress.
  - Older or partial records load with safe defaults. A record from a different generator version keeps its version.
- **Story isolation:** story saves (`mossling-save-v2`) are never read or written by survival. The tests check this byte for byte.

## Tests

- **`tests/survival.test.mjs` (21 checks):**
  - the menu split;
  - creating a world from the menu;
  - deterministic generation, and in-game chunks matching a fresh generation;
  - streaming loads and drops;
  - gathering with weapons;
  - craft, place and the self-block rule;
  - the cave: enter, clear, reward, leave;
  - save and reload restoring removed nodes, structures, resources and the cleared cave;
  - deleting a world without touching story saves;
  - an old record loading;
  - all five classes felling a tree;
  - story mode still loading.
- **Updated tests:** character_creator, gunslinger_ui, persistence, alpha8 and two capture scripts now go through Play Story or Saves & recovery on the new menu.
- **Captures:** `docs/screens/survival/` (`OUT=docs/screens/survival node tests/run.mjs zshots_survival`).

## Known limitations and rough edges

- **World size:** the world is bounded at 480×480 tiles for this pass (generated lazily; not infinite).
- **Biomes and terrain:** there is one biome and flat terrain; height variation is deferred.
- **Wild creatures:** they reappear when a world is reloaded (cave clears persist).
- **Node damage:** partial damage on a node is not saved; only fully felled nodes are.
- **Building:** it is tile-based (one piece per tile, plus a roof layer), not freeform.
- **Balance:** it is rough.
  - In scripted tests a tree takes about 2–4 s for every class, and cave creatures scale with distance from camp.
  - Soulbound and Gunslinger gather a little slower than melee.
- **Rendering in the tests:** the headless (software GPU) browser renders newly streamed terrain slowly, so the tests simulate without rendering. There are no hardware FPS figures.
- **Chapter suite:** it still fails here and on its baselines (it predates this work).
