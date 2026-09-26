# World discovery expansion: route and region plan

**Base:** `feat/class-combat-rework` @ `09189fc`, pinned before any edit. It carries the combat rework, five classes, weapon secondaries, the enemy/HUD pass, class-correct loot and the latest graphics.
**Branch:** `feat/world-discovery-expansion`.

## Audit (what already exists; not claimed as new)

- **Overworld:** Lanternreach is one authored 320×260 overworld, and the map is full. It holds:
  - nine regions and 41 landmarks;
  - 16 Bellstones and 11 mini-dungeons;
  - per-character seeded optional content (camps, rares, caches, cave mouths);
  - fog-of-war discovery (`world6.discovery`: fog bits, regions, landmarks, marked);
  - a zoomable atlas and a minimap.
- **Areas:** extra areas (dungeons, the Conservatory, mini-dungeons) load through `BUILDERS` and are joined by `warp` defs and named spawns. Saves store checkpoints as area + spawn name.
- **Thimblewick (Heartland-local coordinates, placed at HEART +90,+70):** a compact stone square.
  - Around it: the bell tower (the Silent Bell), Elder Tamsin, Posy's shop and bench, the mill, and Brisk's practice yard to the east.
  - The Mirrowrun river runs east of town, and Hobb's Farm lies to the south-east.

## Decisions

- **Regions as connected areas:** growing the full overworld would mean a costly fog-grid migration for every save, and it would shift regions. So both new regions are **connected regional areas** loaded through the existing area system. Each has a real overworld entrance, a return route and a persistent shortcut. Region areas share the overworld's discovery data, atlas, day/night and biome scenery through small additive hooks (`area.outdoor`, `area.biome`, and the `placeAt` / `regionIdx` interface).
- **Thimblewick is rebuilt around a stable centre.** The bell, Bellstone, Tamsin, Posy, the workbench, Brisk's yard and the `village` spawn keep their coordinates, so services stay close together and old references stay valid. Everything around them is redesigned and roughly doubled in footprint.

## Route and progression

```
          Chime Gate (N)                       Hush camp
               │                                    │
  Whisperwood ─┤   ┌──── NEW THIMBLEWICK ────┐      │
  Conservatory │   │ root arch · terraces    │── east road ── bridge ──┐
  (W)          └───│ BELL-TREE PLAZA · market│                         │
                   │ garden · brook          │           CLOCKWORK GATE (hedge arch + gear)
   Deepwood (W)    └──── footbridge ─────────┘                 │  L5–7
      │                  arrival hill (S)             ═ THE CLOCKWORK GARDEN ═
   ROOTLIGHT MOUTH (sinkhole)          ▲ root lift (shortcut, opens from below)
      │  L8–10                          │ into Thimblewick's garden corner
   ═ ROOTLIGHT CAVERNS ═────────────────┘
```

| Place | Band | Entrance | Return / shortcut |
|---|---|---|---|
| Thimblewick | L1–2 | new arrival hill south of town | — |
| Clockwork Garden | L5–7 | Clockwork Gate, east of the Mirrowrun bridge (Heartland meadows) | Gate walk-out; Gearhouse Bellstone; the **Mainspring Gate** shortcut back to the entrance once powered |
| Rootlight Caverns | L8–10 | Rootlight Mouth, a root sinkhole in the Deepwood | Mouth climb-out; Glowroot Refuge Bellstone; the **Root Lift** up into Thimblewick's garden (opens from below, persistent) |

## Regions

**The Clockwork Garden:** a clipped hedge garden grown around a giant abandoned clockwork.
- **Landmarks:** the Great Clock Face (the signature reveal down the narrow Hedge Gallery), the Rusted Wheelworks, the Bronze Belfry Frame, and the Topiary Maze.
- **Outpost:** the Gearhouse, with a Bellstone and the tinker Cogsworth Pim.
- **Quest "Wind the Old Clock":** throw three winding levers; each is guarded or puzzle-locked. The clock chimes and the Mainspring Gate shortcut opens.
- **Mini-dungeon:** *The Clockwork Undercroft* (authored rooms, plate puzzle, arena, unique-free rewards).
- **Secrets:**
  - a hedge gap into a lost pocket garden;
  - a cuckoo alcove behind the clock face, opened by ringing the bronze bells in order.
- **Encounters:** porcelain guards, mantises, beetles, moths and brigands among the gears, with authored elite spots.

**The Rootlight Caverns:** a descent beneath the Deepwood's roots, lit by fungus and crystal.
- **Landmarks:** the Glowroot Hall (a huge luminous cavern: the signature reveal from the tight root passage), the Crystal Seam, the Underlake, and the Hanging Roots.
- **Refuge:** Glowroot Refuge, with a Bellstone and Mira the lampkeeper.
- **Quest "Wake the Glowcaps":** light three dormant lumen blooms (hit them; universal) to relight the old route. Lit blooms stay lit, and the Root Lift is revealed.
- **Mini-dungeon:** *The Lumen Burrow*.
- **Secrets:**
  - a crystal-seam crack (breakable);
  - a flooded alcove reached by pushing a block across the underlake shallows.
- **Encounters:** sporelings, wisps, leeches, slugs, wraiths and treant elites.

## Discovery and QoL

- **Major region first entry:** a parchment title card, a bell cue, an atlas update and a journal entry. It is queued during combat and dialogue, happens once per character, persists, and respects reduced motion and a new setting.
- **Small landmarks** get a small toast.
- **Atlas:** region areas get their own illustrated page, and entrances are marked on the overworld once discovered.
- **Waypoint:** one user waypoint, set or cleared from discovered atlas places, with honest distance and bearing guidance on the minimap. It shows no fake paths.

## Migration

- `LAYOUT_VERSION` 2 → 3, idempotent:
  - moves `deathDrop` and `moved:*` positions that fall inside the rebuilt town to the nearest safe anchor;
  - the fog grid size is unchanged;
  - new world fields are namespaced (`world.discovery.*` additions and `flags['w7:*']`).
