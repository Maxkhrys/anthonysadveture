# Character persistence: schema 3

Based on Pass 3 commit `1d39257` (crafting, villagers, Echo). This is a stacked infrastructure change. No models, inventory styling, crafting animations, VFX, encounters or world art are changed.

## Player behavior

The title save menu lists each character's name, locked class and level. New Character uses the existing class selector, then asks for a name. It adds a profile instead of deleting an adventure. Save & Title finishes saving before returning to character selection. Deletion requires a confirmation; export a recovery copy before deleting anything you want to keep.

Local autosaves run at existing story/crafting/checkpoint events, gear pickup/equip, death, every 15 seconds of gameplay, page hide and tab hide. Manual Save only says Saved after success. A crash can still lose changes since the most recent completed write. Continuing retains the existing full-health load behavior; death does not delete gear, XP, crafting or quest progress.

## Durable storage contract

The primary key remains **`mossling-save-v2`**. The historical suffix is not the current schema version. Never derive the key from package version, commit SHA, deployment ID, environment name or schema version. `tests/persistence.unit.mjs` asserts this exact contract. Normal production releases at the same origin read the same key.

```js
{
  schemaVersion: 3,
  characters: [{
    id: 'UUID', name: 'Rowan', classId: 'archer', revision: 4,
    createdAt: 'ISO timestamp', updatedAt: 'ISO timestamp',
    inventory: {
      cls: 'archer', level: 6, xp: 73, sp: 2, skills: [2, 1, 1],
      bag: [/* item instances */],
      equip: { head: null, chest: null, arms: null, legs: null,
        boots: null, necklace: null, ring1: null, ring2: null, weapon: {/* item */} },
      coins: 321, keys: 0, potions: 3, /* existing currencies/resources */
      mats: {/* crafting materials */}, recipes: [], sigils: {}, sigilsOwned: [],
      allocatedStats: {}, statPoints: 0,
      /* existing health, tools, chimes and future fields retained */
    },
    settings: { difficulty: 'normal', guide: true },
    playTime: 720, // seconds
    discoveredBellstones: ['overworld:village'],
    world: {
      checkpoint: { area: 'overworld', spawn: 'village' },
      flags: {/* existing quests, bounties, opened chests, switches, world progression */},
      stats: {/* existing deaths, kills, crafting counters */},
      time: { elapsedSeconds: 250 },
      dungeon: { riftFloor: 8, riftLevel: 11 }
    }
  }],
  legacy: {/* original legacy object, only present after migration */}
}
```

`inventory` is the portable, character-owned gameplay state, not a world container. `world` is the character's **solo campaign resume record**, separated from inventory ownership. Existing quest and progression flags remain intact there to avoid changing story semantics. A future shared world must select its own world/session state instead of importing another player's solo `world.flags` (for example, opened chests). No item uses a world instance as its owner. That future feature must explicitly decide which solo quest accomplishments carry over; this pass does not define shared quest synchronization.

Ephemeral entities, active enemies/projectiles, combat cooldowns, weather particles and generated Rift layout are not saved. Rift best progress and counters are retained, but continuing resumes at the last non-Rift checkpoint; it does not restore the exact procedural room or enemies. This retains the game's existing resume rules.

Audio/video settings remain device-local under the existing settings key. Difficulty and guide visibility are also captured per character and restored when selected. Legacy profiles initially inherit device settings because older saves did not contain character settings.

## Item identity and equipment

Every generated gear instance receives a UUID at creation. Migration assigns one to each old gear instance, independently of the old collision-prone `uid`. Inventory transfer between bag/equipment and crafting keep the UUID. The serializer stamps runtime objects as well as snapshots, so repeated saving cannot mint new identities. Duplicate UUIDs within or across profiles reject the write instead of cloning or silently discarding items. Two distinct legacy items with the same old `uid` are preserved as distinct instances.

Items preserve all existing fields (`base`, `stats`, `min/max`, affixes, `unique`, `craft`, etc.) and add:

| Field | Meaning |
| --- | --- |
| `itemInstanceId` | Stable UUID for this individual item |
| `definitionId` | Base definition identifier; `base` remains compatible with existing gameplay |
| `rolledStats` | Snapshot of rolled stats, damage and affixes when created/migrated |
| `upgradeLevel` | Integer reinforcement level, initially zero |
| `craftedMutations` | Current engraving recorded as `engraving:<recipe>` plus future mutations |
| `ownerCharacterId` | Character UUID once acquired; null for uncollected loot |
| `provenance` | Minimal source metadata (`loot` or `legacy`); not a verified audit trail |

Fungible pips, crafting materials and tonics remain quantity balances. They are not individual gear instances. Client UUIDs and owner fields are **not proof of ownership**, anti-cheat or a secure trading ledger.

Disk equipment uses all nine canonical slots. Legacy `helm → head`, `armor → chest`, `charm → necklace` are non-enumerable runtime aliases so existing inventory presentation works unchanged and stats are counted only once. Additional slots persist and contribute stats, but this pass does not add their visual controls/models or drop tables.

`reinforceWeapon` prepares +0 through +20 with a data-configured 5% damage multiplier per level. Base rolls and crafting effects remain unchanged; bonuses are derived rather than compounded into saved damage. No upgrade vendor, cost economy or reinforcement UI is enabled. Both named and random weapons use the same field.

## Migration and recovery

1. Load the permanent key and parse JSON. Unversioned `{ inv, flags, checkpoint, playTime, stats }` and that same shape with `schemaVersion: 2` migrate to schema 3.
2. Copy the original **exact bytes** to `mossling-save-v2:legacy` before the first migration. Preserve unknown legacy top-level fields in `legacy`; preserve additive profile, inventory, item and world fields during round trips.
3. Assign character/item IDs, map equipment slots, add missing defaults (including pre-crafting saves), retain current level and partial XP without recalculating them, and infer only Bellstones with existing `rested:<spawn>` flags. Older saves without those flags cannot reveal unrecorded discoveries; resting again discovers them.
4. Validate before writing. Each commit keeps the preceding bytes in `mossling-save-v2:backup`; the first write also seeds a valid backup. Writes fail visibly on unavailable storage/quota errors. An older release cannot overwrite an unsupported schema through this provider.
5. Malformed primary data (or a missing primary with a backup) recovers the last validated backup. Damaged bytes are first quarantined under `mossling-save-v2:recovery:<UUID>`. The UI reports recovery; the backup can be one save behind. If quarantine cannot be written, recovery aborts without replacing the damaged source.
6. Without a valid backup, loading and creation fail closed; the original bytes remain available for export. A future/unsupported schema never automatically falls back to an older backup. Unknown classes, invalid field types and ambiguous duplicate identities similarly do not silently become a new adventure.

Use **Export Save / Recovery Copy** on the title screen to download every primary/backup/legacy/quarantine value as JSON. Keep that file outside browser storage. Recovery export is a support/backup artifact; there is no general import UI in this pass. To recover manually, with game tabs closed, inspect the exported values, choose a compatible validated save, and restore its exact string to the primary key on the intended origin. Never overwrite the only original copy while diagnosing damage. Do not ship the old single-save writer after migration: old game code cannot understand schema 3; rollback releases must retain the new provider or migrate explicitly.

## SaveProvider boundary and future cloud implementation

`src/persistence/provider.js` defines `loadCharacters`, `createCharacter`, `saveCharacter`, and `deleteCharacter`. `Game` receives a provider and awaits its results; methods may return values or Promises. `CharacterSession` serializes asynchronous saves and applies per-character revisions. A failed/conflicting session stops further writes until reload instead of overwriting with stale snapshots. Local operations read the latest envelope and preserve other characters.

No supported authenticated backend exists in this static repository, so this pass uses only `LocalSaveProvider`. A future cloud provider can implement the same operations without rewriting combat, inventory or crafting. It must authenticate users using a supported service, enforce character ownership and immutable class server-side, use transactions/CAS for revisions, enforce unique item ownership, and implement an offline/retry policy. Cloud saves cannot rely on pagehide completing network requests. The local revision check catches ordinary stale tabs but localStorage read/modify/write is not an atomic cross-tab transaction; this is not yet a concurrent multiplayer datastore.

**Local persistence:** same browser profile, same device, same origin (scheme + hostname + port). Ordinary code updates on that origin keep saves. Clearing browser site data, browser eviction/private-session expiry or changing device can remove/miss them. Backups in localStorage share those limitations.

**Vercel previews:** each distinct preview hostname has its own browser storage. A new preview URL, a production alias and a custom domain do not automatically share characters, even for the same repository. Use a stable production URL for ongoing testing. Changing origins can look like a reset while the original data remains on the old origin.

**Future account/cloud persistence:** a server stores authenticated account-owned characters so they can be loaded on other devices/origins after sign-in. That requires a real backend and authorization. Neither this provider nor localStorage provides account, cross-device, multiplayer or trading persistence.

## Other foundations

- XP remains traditional non-spendable XP. `src/rpg/progression.js` owns the thresholds/max level; its table matches the previous curve exactly. Migration preserves even a level above today's cap rather than reducing progress.
- Bellstones have area-qualified stable IDs. `unlockedBellstones()` and the guarded `travelToBellstone(id)` hook expose future menu integration; travel requires discovery, proximity to a Bellstone, no active combat/death/transition. No Bellstone visuals or travel menu redesign is included.
- World elapsed seconds persist independently of playtime. `worldPhase()` supplies the existing day fraction plus `isNight` for future encounters, without changing lighting or adding enemies/events. Existing `dayOffset` flags remain respected.
- `respecInventory` / `Game.respec()` reset purchased ability ranks to level-unlocked baselines and refund their points, plus explicitly allocated stat points. Repeated respecs do not duplicate refunds. Class, level, XP, gear and crafted sigils remain intact. No NPC/item or skill tree is added.

## Verification

```sh
npm ci
npx playwright install chromium
npm run test:persistence
npm run test:browser -- persistence crafting village
```

Unit tests cover the permanent key, legacy/pre-crafting migration, multiple classes, identity and revision checks, all nine slots, reinforcement, real crafting transfer, quests/world state, death data, Bellstones/night time, quota/malformed/future-schema recovery, missing primary, twenty reload/update cycles, idempotent respec and an asynchronous mock provider. Browser tests exercise the actual title/class/name flow, legacy migration, pickup/equip, death, continued quests/crafting, Bellstones, two classes and repeated reloads. Existing crafting/village suites are also used as regressions; see the PR validation results for the actual run outcomes.
