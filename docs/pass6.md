# Pass 6: the world expansion

**Base:** `claude/pass5-identity-skilltree-content` at `91474c9` (the Pass 5 head, PR #7).
Nothing newer had been merged into `integration/mossling-pass4-review` (still `a8efca8`), so
this is the newest approved line that contains Pass 5. Gemini's later Dev Tools commit
`c982fe5` (the slash key opens the console) was merged in as `1720622` before any Pass 6 work.

**Branch:** `claude/pass6-world-expansion`.

**Screenshots:** `docs/screens/pass6/` (`OUT=docs/screens/pass6 node tests/run.mjs zshots6`).
**Maps:** `docs/screens/pass6/worldmap_tiles.png` and `worldmap_regions.png`
(`node scripts/worldmap.mjs out.png 3 tiles|places`).

## The world at a glance

Lanternreach is now one seamless 320 × 260 tile overworld. The old overworld (Thimblewick,
Whisperwood, Glassmere Chime Gate, the shore, the Hush camp) sits unchanged near the middle,
offset by `HEART` = (+90, +70). Seven new regions surround it.

About **49,900 tiles** can be reached on foot, against **9,781** before: about **5.1×** the old
explorable ground. `tests/world.unit.mjs` checks this with a flood fill under the player's
walking rules.

```
            Chime Highlands (L14)                    Cinderpeak (L12)
   Cairn Fields · Great Bell · Bellwright Ruins    Cinder Rest · Great Anvil · Kiln Road
                 │ Windstair                            │ Kiln Road canyon
 The Deepwood ── Heartland / Whisperwood / Glassmere ── Sunscald Reach (L9)
 (L7)            (the old world, L2–6)                  Wells · Dustbowl · Mesa
     │                     │ pier / ferry                     │
   Moonfen (L11) ───────── Lake Mirrow (L8) ─────────── Mirrow Landing
   Lantern · Moonwillow · Drowned Belfry     Heron Isle · Chapel Isle
```

The layout is fixed and authored. The world seed only changes **optional** content (see
*Seeds*). Main dungeons, Thimblewick and the story geography are the same for everyone.

## Regions

| Region | Level | Music / ambience | Landmarks (★ = hidden) |
|---|---|---|---|
| Thimblewick Heartland | 2 | field / meadow | Thimblewick, Hobb's Farm, Bellwatch Knoll (raised), the Pier Bellstone |
| Whisperwood (old) | 4 | forest / forest | unchanged from Chapter I |
| The Deepwood | 7 | forest / deepforest | The Rootway (a raised root walk), Great Hollow Log, Bell-in-the-Oak, Mushroom Colony (glows at night), Thornback Nest, ★Fernhollow |
| Glassmere | 6 | glass / glass | Great Dome terrace, mirror meadow, Iron Arches, the Windstair (a stair up to the Highlands) |
| Lake Mirrow | 8 | lake / water | Mirrow Landing, Heron Isle, Chapel Isle (the Drowned Chapel), the Sunken Bellwright statue, the Pike Bones |
| Sunscald Reach | 9 | desert / dry | Sunscald Wells, the Dry Awning, the Dustbowl, Sunward Mesa, Bowed Sunflower, Potsherd Flats, Kiln Crypt |
| Cinderpeak | 12 | volcano / volcanic | Cinder Rest, the Forge, the Kiln Road canyon, lava river bridges, Great Anvil, Foundry, Emberwell Gate |
| Moonfen | 11 | marsh / marsh | The Moonfen Lantern, the Moonwillow, the Black Mere, the Drowned Belfry, the Moonwell (night door) |
| Chime Highlands | 14 | highlands / wind | The Belfry Cradle and Great Bell, Cairn Fields, the Fallen Bell, Bellwatch Crown (the highest point), Bellwright Ruins, the Split (rope bridges), the Chime Spire door |

There are 41 named landmarks in total, and every region has at least three.

**Scale and height.** The world keeps the miniature scale: tea-cup ruins, thimble-sized huts
and giant everyday objects (the Hollow Log, the Great Anvil, the Buried Teapot, a bowed
sunflower). There is now **walkable height**:
- the Highlands plateau is at 1.2 and Bellwatch Crown at 2.4;
- the Rootway and Bellwatch Knoll are raised;
- the Dome terrace and Windstair have stairs.

Ledges taller than 0.55 block movement unless there are stairs. The camera, shadows, effects,
aim, projectiles, health bars and damage numbers all follow ground height.

**Links between regions.**
- Roads leave the old world in all directions.
- The Windstair climbs from Glassmere to the Highlands.
- The Kiln Road canyon links Sunscald to Cinderpeak.
- Boardwalks carry you into Moonfen.
- A ferry runs between the Pier and Mirrow Landing.
- Rope bridges cross the Split and the lava river.
- A rockfall on the east road clears with blast powder, a short-cut that is also reachable
  the long way round.

## Settlements

- **Mirrow Landing** (lake, east shore): stilt houses and a dock.
  - Harbourmaster Quill gives the Old Snapjaw bounty.
  - Tobi runs a bait-and-tackle shop; Loma is a storyteller.
  - There is a notice board, the ferry to the Pier, and a Bellstone.
- **Cinder Rest** (Cinderpeak): forge huts on a ledge above the lava.
  - Smith Brakka gives Brakka's Tongs and runs a smithing shop, and there is a workbench.
  - Pell is a runner and Ysolde a pilgrim.
  - There is a Bellstone.
- **Small camps** with people: the Deepwood Shrine (Tallow the lamplighter, and Wick once
  found), Hobb's Farm (Hobb), the Belfry Cradle (Old Ferrule) and the Moonwell (the
  Well-keeper, only at night).

## Bellstones (fast travel)

There are 11 new overworld Bellstones, 16 in all:
- Thimblewick;
- Pier, Glassmere, Deepwood Shrine and ★Fernhollow (hidden in a tangle);
- Moonfen Lantern and Heron Isle;
- Mirrow Landing and Sunscald Wells;
- Cinder Rest, the Windstair and the Belfry;
- plus the dungeon and Conservatory stones.

They are added to `BELLSTONES` in `src/persistence/model.js`. Old saves simply haven't lit
them yet.

## Mini-dungeons (11)

Each is a compact hand-drawn layout (`src/world/minidungeons.js`) with a mini-elite arena as
its goal (`flags['md:<id>']`).

| Mini-dungeon | Level | Entrance | Reward |
|---|---|---|---|
| Hobb's Root Cellar | 3 | Hobb's Farm (the tutorial dungeon) | Hobb's quest |
| Hollow Log Burrow | 6 | the Great Hollow Log | Wick, and Tallow's quest (Wickring) |
| Thornback Nest | 7 | the nest mound | **Nest Carapace** (unique) |
| The Mirror Cellar | 7 | beneath the Glassmere mirrors | **Mirrorshard** (unique) |
| The Drowned Chapel | 9 | Chapel Isle | **Tidebell** (unique) |
| The Buried Teapot | 9 | seeded: 1 of 2 mouths in Sunscald | chests and mats |
| The Kiln Crypt | 10 | Sunward Mesa foot | **Kilnheart** (unique) |
| The Sunken Burrow | 10 | seeded: 1 of 3 mouths in Moonfen | chests and mats |
| The Moonwell Shrine | 11 | the Moonwell (**door opens only at night**) | the Well-keeper's quest |
| The Old Forge Deep | 12 | west of Cinder Rest | Brakka's Tongs (quest) |
| Bell Hollow | 14 | under the Fallen Bell | high-level chests |

## World bosses

- **The Crowned Toad** (Pass 5, Moonfen): unchanged, now in the larger fen.
- **The Tollcrow** (new, Chime Highlands): it roosts in the Great Bell of the Belfry Cradle and
  wakes when you enter the Cradle.
  - **On the wing** it is out of reach. It circles, swoops, sheds feather volleys and whips up
    gales, then perches on the ruin pillars.
  - **Tolling the bell** (hit it) knocks the Tollcrow down. It is **stunned** and takes
    **×2.2 damage**; on the ground it takes ×1.3, and ×0.7 when it isn't stunned.
  - **First kill:** the **Tollcrow Mantle** (a unique accessory with a speed bonus and a
    longer gust). Every kill drops crowfeathers.
  - **It returns** after three world days. Kills are stored in `world.events.tollcrow`.

## Rare and rotating events

Events are rolled per world day (7 minutes) from the character's seed, so they are the same
for the same seed on the same day (`dayRoll`).
- **Fallen Star** (night): a star falls at one of 5 seeded sites. It holds stardust and a
  short guard fight.
- **Hush Incursion:** a rift tear opens on a road (1 of 4 seeded sites) and spills waves until
  you close it.
- **Moonfen Procession** (night): a line of lantern ghosts walks one of three seeded routes.
  Following it to the end leaves a gift.
- **Moth Drift** (dusk and night): glowing moths gather at a seeded meadow and drop dust.
- **The Gilded Beetle:** a rare, fast and harmless beetle that flees. Catch it for coin.
- **The Travelling Pedlar:** stops at 1 of 4 seeded places, changing daily. They sell
  stardust, moth dust, gear and map sketches of regions you haven't found.
- **Camps and rare elites (seeded):** 7 roadside camps and 10 named rare elites per world,
  some of which walk only at night.
- **Fixed encounters:** the Dustbowl Warband (a three-wave arena in Sunscald) and Old
  Snapjaw (a bounty elite on Heron Isle).

## Day and night

- **Night enemy pools:** each region has a separate night pool (`POOLS[region].night`, for
  example wraiths and wisps in the Heartland, and imps in Cinderpeak).
- **Night patrols:** extra pressure spawns near the player, but never in towns.
- **Morning cleanup:** night-only spawns are removed at dawn.
- **NPC schedules:** Ada, Fennel and Brisk go indoors at night. The Well-keeper appears only
  at night.
- **Night-only secrets:**
  - the Moonwell door;
  - the moon path over the Black Mere (stones that surface only at night), leading to the
    moon cache (Moonwell Censer);
  - the Mushroom Colony's glow;
  - some rare elites walk only at night (seeded).
- **Music and ambience** take their night variants.

## Secrets

- Fernhollow, a hidden glade with a hidden Bellstone; a clue points to it.
- The moon path and moon cache.
- The Bell-in-the-Oak bell sequence opens a chest holding a map fragment.
- Cracked walls in the mini-dungeons, with secret rooms.
- Hidden pockets of materials (8 per world, seeded from 14 spots).
- Vistas at 9 high points: stand there and the camera pulls back (up to 2.4× at the Crown).
- 31 new chests.

## Quests (distributed)

| Quest | Given at | Summary |
|---|---|---|
| Hobb's Cellar | Hobb's Farm | clear the Root Cellar (first quest on the tutorial route) |
| The Lost Lamplighter | Deepwood Shrine | find Wick in the Hollow Log Burrow (Wickring) |
| Bounty: Old Snapjaw | Mirrow Landing | hunt the elite on Heron Isle |
| Brakka's Tongs | Cinder Rest | fetch them from the Old Forge Deep |
| The Moonwell | Moonfen, by night | clear the Moonwell Shrine |
| What Nests in the Bell | Chime Highlands | defeat the Tollcrow |

The quests appear in the journal, show news markers, and have map markers through
`g.questMarkers`.

## Tutorial route and first reveal

A new character follows the unchanged Chapter I opening in Thimblewick. After the intro fight,
**the first world reveal** plays. It is a slow wide shot over Lanternreach, then a camera tour
of the places the roads lead to:
- the Great Bell,
- Cinder Rest,
- Mirrow Landing,
- the Moonfen Lantern.

Each place shown is marked on the map. You can skip the reveal with attack or interact.

The natural next steps stay close:
1. Hobb's Cellar (level 3), south-east.
2. The Chapter I dungeon, west.
3. The Deepwood Shrine and Glassmere.

## Map discovery and fog

- **Fog:** the map is fogged in 8×8-tile cells, stored as a hex bitstring in
  `world.discovery.fog`. Walking clears a radius around you.
- **Regions and landmarks** are recorded when you first see them. Landmark names appear on the
  map only once discovered.
- **Map fragments** (from chests in the Bell-in-the-Oak, the Root Cellar, the Moonwell and
  Bell Hollow) and the pedlar's map sketches reveal a whole region.
- **Region banners** show when you cross into a region, with music and ambience changes.

## Seeds, manifests and saves

- **`world.seed`:** each new character gets a random 32-bit seed. Characters from before
  Pass 6 get a **deterministic** seed from their id (`seedForId`), so migration is repeatable.
- **`world.generationVersion`:** set to 1.
- **`world.generated`:** a JSON manifest from `generateManifest(seed)`. It is generated
  **once** and then saved with the character, so later changes to the generator (or to
  `anchors.js`) never move something a player has already found. It lists:
  - 7 of 15 camp sites with their foe lists;
  - 10 of 20 rare elites (name, kind, night-only or not);
  - the pedlar's 4 stops;
  - stars, incursions, procession and moths;
  - the two seeded cave mouths;
  - 8 of 14 material pockets.
- **`world.discovery`:** regions, landmarks, fog and map marks.
- **`world.events`:** Tollcrow kills and day, and similar counters.
- **Save schema:** unchanged at 3, under the same key, `mossling-save-v2`. Characters are
  never wiped.
- **Layout migration (`world.layout` → 2):** positions stored by an old save move by `HEART`
  exactly once:
  - overworld loot piles, drifts, the pushed pier block, and the death drop;
  - dungeon positions are untouched.

  Unit tests cover the real Pass 4 save fixture, idempotence, and keeping a saved manifest even
  when the generator would now pick differently.
- The same seed always gives the same world, and two characters get different optional
  placements (`tests/world.unit.mjs`).

## Streaming and performance

- **Terrain streaming:** terrain, liquids and scenery are built in **24-tile chunks** around
  the camera (`src/world/stream.js`), at up to 1 chunk per frame (4 during cutscenes).
  - Tile colours are cached per area. Scenery geometries are shared per model, and there is
    one shared terrain material.
  - Liquids share **one material per kind**: when the last chunk using a material was
    disposed, three.js dropped its shader and recompiled it on first visit.
  - Chunks take about 5 ms each to build.
- **Entity streaming:** entities from area defs are streamed in 16-tile cells, 3 cells around
  the player. Killed ones stay killed until the normal respawn rules apply.

Profiled with `PERF_OUT=docs/perf/pass6.json node tests/run.mjs zperf6`. The numbers come from
headless Chromium with **SwiftShader (software GL)** at 1280×720, so read them relatively.
Update and render are milliseconds per frame.

| Scenario | Update | Render | Draw calls | Triangles | Entities | Chunks | JS heap |
|---|---|---|---|---|---|---|---|
| Thimblewick | 0.30 | 4.4 | 302 | 141k | 578 | 6 | 51 MB |
| Deepwood (dense) | 1.26 | 4.0 | 225 | 262k | 311 | 6 | 47 MB |
| Glassmere | 0.47 | 2.4 | 194 | 74k | 346 | 4 | 44 MB |
| Mirrow Landing | 0.19 | 1.7 | 106 | 29k | 200 | 6 | 44 MB |
| Cinderpeak | 0.39 | 1.4 | 107 | 44k | 106 | 6 | 45 MB |
| Moonfen at night | 0.28 | 3.6 | 184 | 100k | 212 | 9 | 35 MB |
| Sunscald | 0.49 | 1.8 | 104 | 39k | 220 | 6 | 57 MB |
| Highlands | 0.41 | 1.8 | 96 | 55k | 292 | 4 | 42 MB |
| Heartland in rain | 0.31 | 1.9 | 115 | 96k | 299 | 6 | 69 MB |
| Crown vista (2.4× zoom) | 0.17 | 2.6 | 181 | 160k | 354 | 12 | 67 MB |
| Fight, 24 foes + warband | 1.11 | 2.5 | 243 | 55k | 240 | 12 | 60 MB |

- **Rapid travel** (5 far teleports, real animation frames):
  - The headless idle frame is ~150 ms (software rasterising a 1280×720 canvas).
  - The worst frame after a teleport is 270–700 ms, i.e. 1–4 idle frames while chunks stream
    in; the median returns to idle.
  - Streaming built 37 chunks at ~5 ms of CPU each.
  - First-visit shader compiles no longer happen (they cost 0.4–1.4 s per region before the
    shared-liquid fix).
- **Map:** the first open builds the illustrated map in ~0.8–1.1 s headless (it was 6.7 s);
  later opens take 0.2 ms.
- **Frame rate** can't be measured meaningfully without a GPU. In CPU terms, update is below
  1.3 ms per frame everywhere, and render submission is below 5 ms.

## Developer tools (Gemini's facility)

Gemini's Dev Tools architecture is unchanged. Pass 6 plugs in through
`Object.assign(COMMAND_DEFINITIONS / DevCommands.handlers)` in `src/dev/pass6.js`, the same way
Pass 5 did.

| Command | What it does |
|---|---|
| `/worldseed` | Show this character's seed, generator version and what the seed picked (camps, elites, pedlar stops, events, caves, pockets) |
| `/regions` | List the eight new regions with level, music and discovered state |
| `/landmarks [region]` | List landmarks; discovered ones are marked |
| `/tp <region\|landmark>` | Wraps Gemini's `/teleport` (alias `/tp`); coordinates and spawns work as before |
| `/discover <region\|all>` | Reveal a region (fog, name, landmarks), or everything |
| `/event <star\|tear\|moths\|procession\|gilded> [keep]` | Start a world event where you stand |
| `/worldboss <tollcrow\|toad> [keep]` | Go to a world boss and reset its return timer |
| `/time day\|night` | Gemini's existing command, reused as is |
| `/worldviz` | Toggle the overlay: region borders, landmarks, seeded anchors, Bellstones |

Also added:
- `REGISTRY.world` (`src/rpg/registry.js`) lists regions, settlements, landmarks, Bellstones,
  mini-dungeons, world bosses and event types.
- `discoverSystems()` gains a `pass6` section.

Commands that hand out rewards (`/event`, `/worldboss`) refuse to run unless `/sandbox on`
(Pass 5) is active, when nothing is saved, or `keep` is given on purpose. Dev-spawned loot
therefore never reaches a normal character by accident.

## Tests

- `npm run test:world`: 10 unit tests.
  - Seeds and manifests; saved manifests kept.
  - Deterministic seeds for old characters; one-time layout migration; the real Pass 4 save.
  - 5× walkable area, and all regions reachable.
  - Every anchor, Bellstone, door and spawn reachable.
  - 11 mini-dungeons with entrances and exits.
- `node tests/run.mjs world`: 21 browser checks. These are the brief's playtest routes:
  - a new character with the reveal, and exploration of every region;
  - fast travel, seed stability, an old save;
  - night content, a mini-dungeon, the Tollcrow (first kill and a repeat).
- Existing browser suites were moved into the new coordinates with `HX`/`HZ` (`tests/lib.mjs`).
- `zperf6` (profiling), `zshots6` (captures) and `zsmoke6` (a quick visit to every region).

Regression results are in the PR description.

## Not finished (deliberately or not yet)

- **Three main dungeons are sealed:** the Emberwell Gate (Cinderpeak), the Tide Shrine (the island
  in the old north lake) and the Chime Spire (Highlands). Their doors are in place and clearly say
  "sealed — a later chapter". They are not presented as content.
- **Two world bosses** are fully implemented (the Crowned Toad and the Tollcrow). The Deepwood
  and Sunscald boss arenas are still ideas.
- **Height is a heightmap:** there are no paths passing over or under each other; the rope
  bridges are at ground level.
- **Testing gaps:**
  - No real-GPU, mobile or gamepad testing: frame-rate numbers are SwiftShader only.
  - Headless rapid travel still shows 1–4 slow frames per far teleport while chunks build.
- Some dev teleports reuse the nearest spawn rather than an exact landmark position.
- **Audio hooks:** region music and ambience IDs are wired in, and the synth has new tracks.
  Real recorded assets would replace them later.

## Recommended next work

1. The sealed dungeons: Emberwell first, since the Cinder Rest quests already lead there.
2. A third and fourth world boss, for the Deepwood (a Thornback matriarch?) and Sunscald (a
   sand-swimmer).
3. Real-hardware performance passes: desktop GPU, a mid-range phone and a gamepad route.
4. More authored side quests per settlement, and Pedlar stock that rotates with regions
   discovered.
5. Astra's UI pass for the map and journal (fog art, region labels, quest pins).
