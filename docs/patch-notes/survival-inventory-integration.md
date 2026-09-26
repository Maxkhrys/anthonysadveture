# Survival + inventory integration

Base: `feat/survival-procgen-foundation` at `004add0c2a65efe7dc85a5b25177e09c6f278026`.
Merged inventory design preview: `feat/inventory-design-preview` at `ccfc2d934a9e240af2ef5a5a59738d757fc3b481`.

## Player-facing changes
- The live bag now uses the charcoal, olive and brass design from the approved preview, with framed bag, equipment and inspection columns.
- Real rarity borders and labels remain visible. Compact and expanded details, search, filters, comparison, protection, equip and salvage continue to use the existing game handlers and exact item rolls.
- Accessible rotation buttons supplement dragging the actual character portrait.
- Claude's Survival foundation remains included: separate worlds, seeded wilderness, gathering, crafting, building, storage and caves. Story, class combat, world discovery and MOSSDEV changes remain in the ancestry.

## Developer/testing improvements
- MOSSDEV now suspends the Survival controller before constructing its sandbox. Test saves cannot update Survival's world record.
- Return to Survival restores through the Survival provider instead of trying to find a Survival character in Story storage.
- Added an integration regression for the live inventory, portrait rotation, item immutability, narrow layouts and the Survival/lab round trip.

## Known limitations
- Returning from a cave test resumes at the cave entrance, matching Survival's ordinary save/reload behaviour.
- Survival foundation limitations still apply; see `survival-procgen-foundation.md`.
- Headless WebGL uses software rendering; timings do not establish hardware frame rates.
- Production promotion is not part of this integration.

## Verification performed
- `CHROMIUM_PATH=/tmp/chromium node tests/run.mjs inventory_clarity survival devlab weapon_kits combat_fx persistence` — 170 checks passed, zero failures or page errors.
- `CHROMIUM_PATH=/tmp/chromium node tests/run.mjs survival_inventory` — 15 checks passed, zero failures or page errors. Uses real button clicks for portrait rotation and Details, plus deterministic game setup and save comparisons.
- `node --test tests/persistence.unit.mjs tests/transfer.unit.mjs` — 16 tests passed.
- `git diff --check` — clean.
- Runtime inventory screenshots inspected at 1280×720, 1920×1080 and 390×844. Narrow item inspection is reachable by scrolling; this is not full mobile gameplay certification.
- Captures: `docs/screens/survival-inventory/`.
- This integration did not rerun every historical suite; the known baseline chapter-suite issue reported in the Survival notes remains outside this patch.
