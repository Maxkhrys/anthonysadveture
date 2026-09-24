# Mossling: The Silent Bell

*A tiny adventure in a very big world.*

You are **Moss**, a thimble-sized Mossling from the village of Thimblewick, with an acorn-cap helmet, your
grandfather's too-big sword, and a pot-lid shield. One morning the **Dawnbell** — which has woken the world for a
thousand years — only goes *thunk*. Its three Voices, the **Chimes**, have left it, and the Hush creeps in.

It's an original 3D action-adventure for the browser. It takes the exploration, secrets, item puzzles and dungeons of
classic top-down adventures and adds crowd-clearing swordplay.

## Run it

No build step and no dependencies. Three.js is vendored in `vendor/`.

```bash
node serve.mjs            # or: npm start
# open http://localhost:8080
```

Any static file server works too, for example `python3 -m http.server 8080`. Opening `index.html` directly from
disk won't work, because ES modules need to be served over HTTP.

Progress autosaves to `localStorage` when you change area, open a chest, complete a quest or shop. You can also save
from the pause menu. **Continue** on the title screen resumes from your last checkpoint.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD / arrow keys | Left stick / D-pad |
| Sword: tap for a 3-hit combo, **hold then release** for a spin attack | J / left click | X |
| Shield: hold to block; raise it *just* before a hit to **parry** | K / right click | LB / LT |
| Roll (invulnerable) | Space / Shift | A |
| Gustbellows: tap for a puff, **hold** for a gale | L | Y |
| Talk / read / open / advance text | E / Enter | B |
| Bell Surge, once the bar is full | R | RB / RT |
| Drink a Red Tonic | Q | Back |
| Map, journal, gear, controls | Esc / Tab | Start |
| Music on/off | M | |

Walk into a stone block and keep walking to push it.

## What's in this build

**Chapter I: The Verdant Voice.** It is complete and can be played from start to finish.

- **Opening:** the bell fails, and within about 30 seconds you're fighting Hushlings at the village gate while
  context prompts teach the controls.
- **Overworld (Lanternreach):** Thimblewick village, the Whisperwood forest, the Mirrowrun river with its bridges,
  Lake Mirrow and its island shrine, Saltwhistle Shore with Ada's pier, the Sunscald Reach desert, the Cinderpeak
  volcanic foothills, and the Chime Gate plateau in the northern mountains. Each region has its own music and
  ambience. There is a minimap, plus a full map in the pause menu.
- **Thimblewick:** Elder Tamsin, Posy's shop (tonics, a Heart Vessel, two sword upgrades, a shield upgrade and a
  Gustbellows upgrade), Miller Oswin, Captain Brisk, Fisher Ada, Fennel (a kid who gives rotating hints) and the Root
  Hermit.
- **Side quests:**
  - *The Still Mill:* restart the windmill with a charged gale.
  - *Bounty: Hush Camp:* a four-wave battle against a large mixed crowd.
  - *Ada's Pier:* shove a boulder off her pier path and into the sea. The reward is an extra tonic bottle.
- **Secrets that need the Gustbellows:**
  - The **Hollow Grotto**, behind a stone door that "only the wind may knock". Inside is a timed puzzle with two
    pinwheels.
  - The **Sunken Courtyard** in the desert, choked by sand drifts. It holds a Heart Vessel and a lore tablet.
  - Leaf piles scattered across the world that hide pips and hearts.
- **Places you can see but not reach yet:**
  - The Cinderpeak pass is blocked by cracked boulders ("something explosive…").
  - The lake shrine has no way across.
  - The Chime Gate has three sockets.

  These are honest dead ends in this build. They are signposted as future content.
- **Dungeon: Rootwell Hollow.** It has eight rooms inside a giant hollow tree:
  - A block-pushing garden.
  - A sealed arena that awards the **Gustbellows**.
  - A pinwheel-driven shutter.
  - A pit room where you blow crates into a gap two deep to build a bridge, with a pillar as a stopper.
  - A dust-covered switch.
  - A torch room where all four flames must be out at the same time.
  - A fire-choked doorway.
  - An optional moat room where you blow a crate across a pit onto a switch you can't reach on foot, for a Heart
    Vessel.
  - Small keys, the Thornwood (boss) Key, a pre-boss checkpoint, a room-by-room map that fills in as you explore,
    and a cutaway camera so walls never hide you.
- **Boss: Bramblemaw, the Choking Root.** Its bulb is armoured, so swords bounce off. It lobs spore pods, sends root
  spikes through the ground, and *inhales*, pulling you towards its mouth. You make it choke in one of three ways:
  gust into its mouth while it inhales, bat or blow one of its own pods back into it, or let it swallow a pod. Choking
  exposes its core. In the second phase it spawns seedlings and attacks faster.
- **Artifact:** the **Verdant Chime**, the first of the Dawnbell's three Voices. Taking it shows a vision of the
  Bellwrights hiding the Voices on purpose. Bringing it back to the bell lifts the Hush visibly: the colour grade
  shifts and the forest thins of enemies. Then Chapter I ends.

### Combat

- **Sword:** a 3-hit combo whose finisher is a sweeping spin. Hold the button to charge a big spin attack. The game
  gives a soft aim assist, hit-stop, screen shake and knockback on hits.
- **Shield:** blocks attacks from the front. A well-timed block is a **perfect parry**: it staggers heavy enemies and
  reflects spores.
- **Roll:** gives you invulnerability frames.
- **Bell Surge:** a meter that fills as you land hits and parries. When full, it releases a shockwave toll.
- **Enemy attack tokens:** at most three enemies wind up an attack at once, so crowds circle and then commit, and
  every attack has a visible wind-up.

Enemies have distinct roles:

| Enemy | Role | How to beat it |
|---|---|---|
| Blotling | Swarmer that lunges | Easy crowd fodder |
| Thornback beetle | Sword clangs off its front shell; charges in a straight line | Flank it, bait it into a wall, or gust it onto its back |
| Spore puffer | Ranged, keeps its distance | Reflect its spores with the sword, shield or gust |
| Hushwisp | Flier with erratic swoops | Gust it out of the air |
| Hush Knight | Heavy armour with a slow sweep or slam | Parry or charged spin to stagger it |

### Gustbellows rules

The wind works the same way everywhere, so you can experiment.

- Crates slide until they hit something. If one falls into a pit, it becomes floor.
- Stone blocks are too heavy for wind. You push those by hand.
- Wind blows out flames, spins pinwheels, and clears dust, leaves and sand.
- Wind reflects projectiles, flips beetles and grounds wisps. It can blow enemies into pits and water.
- Walls block the wind.
- A charged gale reaches further and hits harder. The Gale Valve upgrade extends it more.

If you mess up a puzzle room, step out and back in and it resets. A sign in the dungeon says so.

## What isn't built yet

- The Ember Chime dungeon (Cinderpeak, with an explosive item) and the Tide Chime dungeon (Lake Mirrow).
- The final dungeon behind the Chime Gate, and the story's resolution: why the Voices left, and what the Last Toll
  is.
- There are no house interiors. You talk to villagers outdoors, and the shop is a market stall.
- No difficulty options or key remapping.

## Technical notes

- **Rendering:** Three.js WebGL. The scene is drawn at about 1/3 resolution through an **orthographic camera snapped
  to the texel grid**, with sub-pixel offset correction so it scrolls smoothly without pixel shimmer. A post pass
  upscales it with nearest filtering and adds depth-based outlines, rim highlights, soft palette banding with ordered
  dither, a vignette and a colour grade. Directional shadows follow the camera. In dungeons, a few torch lights are
  pooled among the nearest flames. A silhouette pass shows Moss through anything that covers him.
- **World:** everything is tile grids. The overworld is painted from hand-placed regions, roads and landmarks
  (`src/world/maps.js`). Dungeon rooms are ASCII layouts. Terrain is one vertex-coloured mesh with colours blended
  across tiles. Scenery is instanced and sways with the wind in a shader. Water and lava use animated shaders.
- **Characters and props:** every character and prop is built in code from coloured voxel boxes (`src/models.js`),
  with fully procedural animation. There are no external art assets.
- **Audio:** all sound effects and all seven music loops are synthesized at runtime with WebAudio
  (`src/engine/audio.js`).
- **Code map:**
  - `src/game.js`: areas, rooms, combat queries and saving.
  - `src/entities/`: the player, enemies, boss, and puzzle and world objects.
  - `src/story.js`: dialogue, quests and the shop.
  - `src/ui.js`: HUD, menus and maps.

### Testing

The whole Chapter I path was checked with scripted runs in headless Chromium, using real simulated key input. The
scripts use a deterministic fixed-step hook, `window.__sim(frames, heldKeys)`, which is exposed in `src/main.js` for
this purpose. The runs covered:

- The intro fight.
- Every Rootwell Hollow puzzle, both keys, the Gustbellows and the Thornwood Key.
- Beating Bramblemaw with the gust-into-mouth method.
- Taking the Chime and returning to the overworld.
- Ringing the bell to end the chapter.
- All three side quests, the shop, the Hollow Grotto, and the desert courtyard.

The runs also confirmed that puzzle rooms reset when you step out and back in.

Two limits apply. The test player was given extra hearts, so the runs prove the route can be completed, not how hard
it is. They were also too slow to judge feel at 60 fps.
