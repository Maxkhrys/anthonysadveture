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
| Aim | Mouse (pressing J switches to aiming where you face) | Right stick |
| Basic attack (tap); charged attack (hold, then release) | Left click / J | X |
| Abilities; hold Snare or Rain to see where it lands, release to cast | 1, 2, 3 | |
| Guard: hold to block; tap *just* before a hit to **parry** | K / right click | LB / LT |
| Roll (invulnerable; standing still with a mouse = backstep) | Space / Shift | A |
| Gustbellows: tap for a puff, **hold** for a gale | L | Y |
| Talk / read / open / advance text | E / Enter | B |
| Bag, equipment and skills | I | |
| Salvage the selected item (in the bag) | X | |
| Bell Surge, once the bar is full | R | RB / RT |
| Drink a Red Tonic | Q | Back |
| Map, journal, gear, controls, settings | Esc / Tab | Start |
| Music on/off | M | |

## Pass 3: aim, fights, crafting, and a village that answers back

**Aiming.** Movement and aim are separate.
- The mouse is projected through the rendered camera onto the plane that shots fly on, so the reticle, the
  weapon, the projectile path preview and the hit all agree. A cursor resting on an enemy locks onto it.
- The right stick aims on a gamepad. Pressing J switches to a deliberate keyboard mode that aims where you face,
  with a soft assist.
- The Archer and Witch can walk one way and shoot another. A quick shot fires the moment you release. Holding
  charges, and the aim keeps tracking the cursor while you charge.
- The Witch's bolt "seeks" only as a stated, limited property: it bends at most about 20° toward a foe already
  near the line you aimed.
- Snare Trap and Rain of Arrows are placed at the cursor. Holding the key shows a range ring and the area; the
  spot is clamped to range and checked for line of sight. Nothing is spent if the cast fails.
- Chain Lightning starts on the enemy you point at.
- Dodging follows your movement keys. Standing still with the mouse gives a backstep.
- Guarding faces the aim. Attacking out of a guard uses your class's own attack.
- Projectiles use a swept hit test, so fast arrows can't skip small targets, and walls and solid objects stop
  them.

**Fights.**
- Normal difficulty hits about 30% harder than before. Story and Hard are still either side of it.
- A single blow can never take more than 40% of your life on Normal (30% on Story, 55% on Hard), so there are no
  unexplained one-shots.
- A flashing **!** appears over anything winding up an attack. It is amber for heavy hitters: their blows break a
  held guard, so parry them or roll.
- Only enemies on screen may commit to attacks or fire shots.
- Elites have *poise*: light hits no longer cancel their attacks.
- A perfect parry opens any enemy. Your first blow after it is a guaranteed critical, and all your hits deal +50%
  for a moment.
- Back-to-back rolls get shorter invulnerability.
- Healing is limited:
  - **Bellstones** (in the village, at the Hollow's mouth, and before the Root Gate) refill your life and tonics
    and become your checkpoint.
  - Tonics take a short, committed sip.
  - Passive recovery only brings you back up to 40% out of combat.
  - Hearts drop less often.
  - Life steal draws from a small pool that refills over time.
- Dying shows who felled you and how hard the last blow hit. You wake at the last Bellstone with full health and
  tonics. Gear, crafting and story progress are all kept.

**Crafting at Posy's workbench.** A weapon (or an ability), plus one rare essence, plus a few Hush Shards, gives
one modifier that changes *how you fight*.

| Recipe | For | Effect |
|---|---|---|
| Thorn Rebuke | Samurai katana | A perfect parry bursts thorns, and your next swing looses a rooting thorn crescent |
| Echo Fletching | Archer bow | A charged shot re-fires as a spectral echo along the same path 0.6 s later |
| Ember Seeds | Witch staff/wand | A charged fireball plants three visibly swelling seeds that burst 1.2 s later |
| Millwind Edge | any class | A charged attack also throws a gust (it knocks foes back, reflects spores and works wind puzzles) |
| Returning Cut (sigil) | Samurai: Iaido Dash | An afterimage repeats the dash's cut 0.5 s later |
| Echo Snare (sigil) | Archer: Snare Trap | The trap springs a second time |
| Rime Bloom (sigil) | Witch: Frost Nova | Leaves a ring of rime; frozen foes shatter for +60% damage |

- **Materials** come from normal play:
  - Salvaging gear gives Hush Shards, and elites shed them too.
  - Bramblemaw's first defeat gives a Thornheart plus an essence suited to your class.
  - Barkhulks, Ember Imps, Volatile and Mirewraith elites, and Rift Champions drop essences.
  - Oswin gives you Mill Sailcloth.
- **Recipes are discovered** through the boss, Oswin, the Echo Door and the Root Hermit. Undiscovered ones show a
  hint.
- **Before you craft**, the workbench shows the requirements, what you have, the cost, class compatibility and
  the resulting effect.
- **Crafting is safe:**
  - Every check runs before anything is taken, so a failed craft costs nothing, and crafting saves at once.
  - An engraving can be moved to a better weapon for 3 shards and 25 pips.
  - An engraved weapon can't be salvaged by accident.
  - No recipe touches a Chime.
- **Chain limits:** echoes never echo, seeds never plant seeds, and death-triggered effects chain at most two
  links deep.
- **Bosses:** Bramblemaw still ignores everything until you make it choke.

**People and places.**
- Tamsin, Posy and Oswin talk through short topic menus. Unread topics are marked. Once you've read a topic you
  get its short version instead of the full exposition again. Greetings react to your quests, your crafting and
  the chapter's progress, and the wording fits your class. You can click the choices or use the keyboard; Esc
  says goodbye.
- **The Still Mill pays off.** Oswin gives you his sailcloth and teaches Millwind Edge. A whetwheel yard with
  flour sacks and bunting then appears by the mill, and its hum is drawn as rings you can see. Tamsin, Posy and
  Fennel all notice.
- **The Echo.** Once you carry the Verdant Chime, every Gustbellows gust repeats once, 1.5 s later, from where you
  stood (a ghost marks the spot).
  - In combat, foes are hit twice.
  - As a puzzle: the **Echo Door** east of Rootwell Hollow has two short-lived pinwheels with a hedge between
    them. The walk around the hedge takes longer than one pinwheel spins, so only an echoed gust keeps the first
    one turning.
  - The Echo Door is optional and any class can solve it. It holds a Hollow Echo, a Bellwright tablet and your
    class's sigil recipe.
- **Visible sound.** The Bellstone chime, the mill's hum, the echo, and every enemy's wind-up have something to
  see as well as hear.

## Pass 2: RPG loot overhaul

- **Three classes**, chosen when you start a new game. Each has its own basic attack, charged attack and resource,
  three abilities (unlocked at levels 1, 3 and 6, each with five ranks), and its own outfit.
  - **Samurai** (Ki): katana combo, spin slash, Iaido Dash, Blade Tempest, Oni Cleave.
  - **Archer** (Focus): arrows, piercing power shot, Multishot, Snare Trap, Rain of Arrows.
  - **Witch** (Mana): homing bolts, fireball, Frost Nova, Chain Lightning, Hex Familiar.
- **Experience and levels** up to 30. Each level raises your stats, refills your health and gives a skill point.
- **Loot:**
  - 28 weapon bases: 10 katanas, 9 bows, 9 staves and wands.
  - 16 armour and charm bases.
  - 17 random bonus stats (affixes), including damage, crit, attack speed, life steal, cooldowns, magic find, and
    chances to burn, chill or shock.
  - 5 rarities, from Common to Legendary, with light beams on the ground for rarer drops.
  - 15 hand-made Legendaries with unique powers, such as Rootcleaver, Windwhisper, Hexbloom, Starfall and The
    First Chime.
  - The weapon you equip is shown on your character.
- **Inventory:** a 30-slot bag, four equipment slots, a stats sheet, tooltips that compare against what you're
  wearing, upgrade arrows, and salvage.
- **Chests:** 34 tiered chests (wooden, iron, gilded) placed across the world, marked on the map.
- **Monsters:**
  - Every enemy has a level set by its zone.
  - Elites (Swift, Brutal, Vampiric, Armoured, Volatile) glow with an aura and always drop gear.
  - Status effects: burn, chill, freeze, root, mark.
  - Floating damage numbers and enemy health bars.
- **Eight new monster types:**
  - Sand Scorpions burrow and erupt beneath you.
  - Ember Imps lob fire and blink away.
  - Mirewraiths fade out and strike from behind.
  - Hushbound Brigands carry a shield wall and lunge with spears.
  - Sporelings burst into a lingering cloud.
  - Barkhulk treants stomp and sweep.
  - Stone Sentinels throw boulders.
  - The **Pip Thief**, a treasure goblin, runs away with a sack of loot.
- **Replayable content:**
  - The **Hush Rift**: an endless, procedurally generated dungeon entered from the Rift Stone in Thimblewick. It has
    sealed battle rooms, a Champion on every floor, and rewards that grow with depth.
  - A repeatable **Bounty Board**.
  - Overworld monsters respawn once you're far away.
  - A rotating gear stock in the shop.
- **Presentation:**
  - A loading screen with tips, and a title menu with Continue, New, Settings and How to Play.
  - A class select screen.
  - A **tutorial guide** checklist that reacts to what you do.
  - A settings screen: difficulty, volumes, screen shake, damage numbers, guide, pixel size and shadow quality.
  - Bloom glow, a day and night cycle, rain, fireflies, and particle auras on Epic and Legendary weapons.

## Chapter I (story)

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
- Key remapping and multiple save slots.

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

`npm test` runs the browser regression checks in `tests/`. It needs Playwright and Chromium; `npm i -D playwright`
works, and the runner also finds a global install. You can run one suite at a time: `node tests/run.mjs aim`.

| Suite | What it checks |
|---|---|
| `aim` | Moving left while shooting right with the real mouse; retargeting mid-charge; the keyboard fallback; the Witch's limited seeking; ground-target range, preview, obstruction and no cost on failure; walls; swept hits on a tiny target; Chain Lightning targeting; guard→attack; dodge directions |
| `balance` | A table of how many clean hits each class survives, per enemy, at levels 1, 5 and 10 with level-matched gear; fodder time-to-kill; difficulty ordering; recovery capped at 40%; the tonic sip; the life-steal cap; roll chaining; the off-screen rule; elite poise; the parry crit; guard breaks; Bellstone rest; the death recap; waking up |
| `crafting` | The workbench flow; failed crafts taking nothing; no double crafts; persistence across a reload; class rules; moving an engraving; every recipe's effect; recursion guards; a strong build against a crowd compared with the same bow unmodified; Bramblemaw's armour still holding |
| `village` | Topic menus, read state and class wording; the mill → recipe → village change chain; persistence; the Echo Door with and without the echo; the echo in combat |
| `chapter` | **Work in progress, not passing yet.** The whole of Chapter I for each class, at normal health with level-4 gear, with a bot that aims with the mouse and counts its deaths. The bot currently leaves a dialogue box open after talking to Tamsin, which blocks the rest of its run. That is a harness bug, not a game bug. Until it's fixed, the Pass 1 route script (with extra health) remains the evidence for completing the chapter. |

The Pass 1 notes below still apply. The whole Chapter I path was checked with scripted runs in headless Chromium, using real simulated key input. The
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
