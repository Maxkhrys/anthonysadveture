# Hidden Developer Commands & Testing Grounds (Dev Room)

Developer-only command console and testing map guide for Mossling.

---

> [!CAUTION]
> **DEVELOPMENT AND TESTING TOOLING ONLY**
>
> The hidden activation methods and command console are designed for internal testing and rapid validation during development.
>
> **Security Notice**: This design relies on **obscurity, not real security**. Client-side JavaScript cannot truly conceal execution pathways or data.
> **NEVER put production secrets, credentials, private API keys, or administrative authentication tokens into client-side code.**

---

## 1. Obscure Activation Methods

To ensure playtesters are not confused or distracted by developer tooling, there is **no visible "Dev Menu" button** in the standard game UI or menus.

Developers can invoke the command console via any of the following deliberately obscure methods:

1. **Backquote / Tilde Key**:
   Press the backquote key (`` ` `` or `~`, standard developer console key in gaming) at any time during gameplay or title screens.
2. **Key Chord**:
   Press `Ctrl + Shift + D` simultaneously.
3. **Hidden Mouse Gesture**:
   Click five (5) times rapidly within 600ms on the bottom-right corner of the browser viewport (the version footer region).
4. **Programmatic Hook**:
   Execute `window.__dev.toggle()` or `window.__dev.open()` in the browser developer tools console.

### Console UX Features
- **Prompt**: Floating monospace overlay with `/` slash prefix.
- **Input Isolation**: While the console is open, game controls (WASD movement, combat clicks, hotkeys 1-3, tonic Q, surge R) are temporarily suppressed so typing commands does not trigger gameplay actions.
- **Command History**: Press `↑` (Up Arrow) and `↓` (Down Arrow) to cycle through previously executed commands.
- **Auto-Complete**: As you type, matching command suggestions appear below the prompt. Press `Tab` to auto-complete.
- **Closing**: Press `Esc` or `` ` `` to close the console and immediately restore gameplay controls.

---

## 2. Complete Command Reference

All commands accept slash-prefixed syntax (e.g. `/god`) or bare syntax (`god`).

### Core Cheats & Character State

| Command | Arguments | Description & Example |
|:---|:---|:---|
| `/help` | `[command]` | Lists all available commands, or displays detailed syntax for a specific command.<br>`/help give` |
| `/god` | *(none)* | Toggles **God Mode**. Renders player immune to all damage, prevents death, and keeps resource pools replenished.<br>`/god` |
| `/noclip` | *(none)* | Toggles **NoClip Mode**. Allows player to walk freely through solid walls, cliffs, props, water, and obstacles.<br>`/noclip` |
| `/heal` | *(none)* | Instantly restores maximum life, class energy, Bell Surge meter (100%), and refills all tonic bottles to capacity.<br>`/heal` |
| `/level` | `<number>` | Directly sets player level (1 to 20). Recomputes all vitals and class attributes, resets partial XP, grants unspent skill points, and unlocks abilities.<br>`/level 10` |
| `/xp` | `<number>` | Grants the specified amount of experience points to the player, triggering level-ups if threshold is crossed.<br>`/xp 500` |
| `/coins` | `<number>` | Adds (or deducts if negative) pips/coins from the player's purse.<br>`/coins 1000` |
| `/classinfo` | *(none)* | Dumps a comprehensive telemetry report to the console: Class, Level, Health, Weapon Min-Max, Attack Speed, Crit %, Crit Damage, Armour, Damage Reduction %, Life Steal %, Active Affixes, and Equipped Gear.<br>`/classinfo` |

---

### Inventory, Crafting & Materials

| Command | Arguments | Description & Example |
|:---|:---|:---|
| `/give` | `<id> [count]` | Grants an item, consumable, crafting material, or base gear.<br>• Materials: `/give shard 100`, `/give thornheart 5`, `/give echo 5`<br>• Consumables: `/give potion 3`, `/give vessel 2`<br>• Keys: `/give key 3`, `/give bigkey`, `/give bellows`<br>• Bases: `/give nodachi`, `/give galebow`, `/give starstaff` |
| `/giveall` | *(none)* | Grants a developer package: 999 Hush Shards, 99 of all essences (Thornheart, Echo, Ember, Sailcloth), 9 Small Keys, Thornwood Key, Gustbellows, Gale Valve, max tonics, unlocks **all** recipes, and gives a sample set of top gear for each class.<br>`/giveall` |
| `/materials` | *(none)* | Adds a starter crafting bundle: +500 Hush Shards and +10 of each rare essence (Thornheart, Echo, Ember, Sailcloth). *(Alias: `/mats`)*<br>`/materials` |
| `/recipe` | `<id\|all>` | Learns the specified crafting recipe or unlocks all recipes.<br>`/recipe all`<br>`/recipe thornrebuke` |

---

### World, Environment & Navigation

| Command | Arguments | Description & Example |
|:---|:---|:---|
| `/teleport` | `<location\|x z>` | Teleports to a named world location or explicit coordinates. *(Alias: `/tp`)*<br>• Named: `village`, `forest`, `shore`, `desert`, `cinderpeak`, `mountains`, `mill`, `camp`, `gate`, `grotto`, `dungeon`, `boss`, `devroom`<br>• Coords: `/tp 48 54`<br>`/tp devroom` |
| `/bellstone` | `<id>` | Unlocks, discovers, and rests at a Bellstone by identifier, restoring all vitals and tonics.<br>`/bellstone village`<br>`/bellstone hollow` |
| `/boss` | `[id]` | Resets Bramblemaw's boss encounter flags (allowing repeatable boss testing) and teleports directly to the pre-boss checkpoint.<br>`/boss bramblemaw` |
| `/resetroom` | *(none)* | Restores all movable crates, switches, and puzzle objects in the current dungeon room to their initial state without needing to exit the dungeon.<br>`/resetroom` |
| `/time` | `<day\|night\|val>` | Adjusts overworld solar cycle and atmospheric lighting.<br>`/time day`<br>`/time night`<br>`/time 0.25` |
| `/weather` | `<rain\|clear>` | Instantly toggles or sets atmospheric weather.<br>`/weather rain`<br>`/weather clear` |

---

### Combat & Spawning

| Command | Arguments | Description & Example |
|:---|:---|:---|
| `/spawn` | `<enemy> [count] [elite]` | Spawns specified monster type near player aim.<br>• Kinds: `blot`, `beetle`, `puffer`, `wisp`, `knight`, `scorpion`, `imp`, `wraith`, `brigand`, `sporeling`, `treant`, `golem`, `thief`<br>`/spawn knight 1 elite`<br>`/spawn beetle 3` |
| `/clear` | *(none)* | Dispels all spawned non-boss enemies and hostile projectiles in the current zone.<br>`/clear` |

---

### Loot Debugging & Affix Foundation

| Command | Arguments | Description & Example |
|:---|:---|:---|
| `/rollweapon` | `[tier]` | Generates a weapon using the data-driven stat/affix rarity foundation. If `[tier]` is specified (e.g. `mythic`, `prismatic`), guarantees at least one affix of that rarity tier and prints full metadata and appraisal score to console.<br>`/rollweapon`<br>`/rollweapon mythic`<br>`/rollweapon prismatic` |
| `/affixes` | *(none)* | Displays the complete 8-tier hierarchy, weight distribution, roll multiplier ranges, and all registered qualitative modifiers.<br>`/affixes` |
| `/droptest` | `<count>` | Executes an in-memory virtual affix drop simulation for `<count>` rolls (e.g. 1000, 100000, 1000000) and displays observed distribution vs theoretical probability without touching player saves.<br>`/droptest 100000` |

---

## 3. Dedicated Dev Test Room (`/devroom`)

The Dev Room is an isolated testing ground designed specifically for balance validation, DPS benchmarking, and mechanic verification.

### Isolation Rules
- **No Map Presence**: Does not appear on the overworld map, minimap, or journal.
- **Progression Isolation**: Dummies, spawned test monsters, and dev chests are marked `devOnly: true`. They do not grant normal achievement counters, quest completions, or persistent campaign milestones.
- **Clean Exit**: Interacting with the Return Portal at the bottom of the room returns the player directly to their previous location.

### Dev Room Layout & Facilities

```
┌────────────────────────────────────────────────────────┐
│               DEVELOPER TESTING GROUND                 │
├─────────────────┬───────────────────┬──────────────────┤
│ ELEMENTAL TARGETS│ COMBAT TEST DUMMY │ SPAWNER TOTEMS   │
│                 │                   │                  │
│ [Pyre] [Frost]  │    [ TRAINING ]   │ [Blot]   [Knight]│
│ [Storm][Bramble]│    [  DUMMY   ]   │ [Beetle] [Elite] │
│                 │                   │ [Puffer] [Clear] │
├─────────────────┴───────────────────┴──────────────────┤
│                     UTILITY HUB                        │
│                                                        │
│  [Posy Workbench]   [Bellstone Rest]   [Loot Chest]    │
│                                                        │
│                  [ RETURN PORTAL ]                     │
└────────────────────────────────────────────────────────┘
```

1. **Combat Testing Dummy (`DevTrainingDummy`)**:
   - Indestructible target with infinite health.
   - Calculates **Real-Time DPS** over a sliding 3.0-second active window.
   - Records hit counts, combo hits, highest single damage roll, and critical strikes.
   - Floating visual readouts show damage and current DPS on strike.
   - Interacting (`E`) prints the complete combat telemetry session to dialogue and resets the DPS meter.
2. **Elemental Test Targets (`DevElementalTarget`)**:
   - Four dedicated targets positioned in the elemental testing wing:
     - **Pyre Target**: Reacts to fire/burn effects with ignition bursts and flame particles.
     - **Frost Target**: Reacts to chill and freeze effects with ice crystal shatters.
     - **Storm Target**: Reacts to shock effects and acts as an electrical conductor.
     - **Bramble Target**: Tests thorn bursts, projectile piercing, and physical knockback.
3. **Enemy Spawner Totems (`DevSpawnerTotem`)**:
   - Six interactive runes that spawn specific enemy archetypes on command:
     - Fodder (`blot`), Beetle (`beetle`), Ranged (`puffer`), Heavy (`knight`), Elite (`elite`), and Dispel (`clear`).
4. **Crafting Workbench**:
   - Full instance of Posy's Workbench. Allows testing weapon engravings and ability sigils directly in the test arena without trekking across Lanternreach.
5. **Testing Bellstone**:
   - Functional rest point for testing checkpoint assignment, recovery, and audio chime loops.
6. **Respawning Dev Loot Chest (`DevLootChest`)**:
   - Generates weapons rolled through the new stat/affix rarity foundation.
   - Once opened, interacting with it again restocks the chest so developers can test drops repeatedly.
7. **Return Portal (`DevReturnPortal`)**:
   - Luminous gateway positioned at the base of the arena. Interacting warps the player back to their exact previous area and coordinates.

---

## 4. Merge-Risk & Architectural Boundaries

To ensure clean merges with upstream and parallel branches:

1. **No Save Schema Alterations**:
   - Primary storage key remains `mossling-save-v2`.
   - Item records retain standard schema compatibility (`r: 0..4`, `affixes: string[]`). Extra fields like `rolledAffixes` and `qualitative` pass through existing serialization validators safely.
2. **No Gameplay Architecture Overhauls**:
   - Dev console and dev room are strictly modular files (`src/dev/*`, `src/world/devroom.js`).
   - Standard enemy AI, player state machine, and combat loops remain intact.
3. **Zero UI Redesign**:
   - Standard HUD, inventory bag grid, and paperdoll layouts remain untouched.
   - Tooltip renderer gracefully enriches affix lines when `rolledAffixes` is present, falling back to legacy strings when absent.
