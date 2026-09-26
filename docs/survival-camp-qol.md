# Survival Pass 1: Camp Quality of Life & Homestead Progression

Base commit: `33d80e9b77ee7cf94ef83b7a37bd97ca0968093d` (`feat/survival-ui-gathering`)
Branch: `feat/survival-camp-qol`

This pass completes Phase 1 of the Survival Mode Gameplay Loop roadmap, focusing on camp quality of life, storage convenience, hostile spawn control, and time-of-day progression.

---

## Systems & Enhancements

### 1. Bedroll & Dawn Fast-Forward
- **Recipe**: `bed` (Wood ×6, Fibre ×4 at Workbench).
- **Functionality**:
  - Interacting with the placed Bedroll at dusk or during the night (`worldPhase.fraction >= 0.62` or `isNight`) fast-forwards the 420-second world cycle directly to dawn (`worldPhase.fraction = 0.25`).
  - Restores the player to full HP and refills tonic charges.
  - Automatically updates the home respawn point.
  - Sleeping is strictly disabled during active combat or during broad daylight.

### 2. Container Crafting (Proximity Storage)
- **Radius**: 10 meters around the player.
- **Workflow**:
  - The crafting panel scans all placed storage chests within 10 meters and aggregates their held resources.
  - The UI displays exact inventory breakdown: `Carried (+Chest) / Required`.
  - Crafting deducts from carried materials first, drawing any remaining balance from chests without requiring manual inventory shuffling.

### 3. Quick Stack to Chests
- **Access**: "Quick stack to chests" button in the Field Materials tab and "Quick stack" in the Storage Chest header.
- **Behavior**:
  - Inspects all placed chests within 10 meters.
  - Automatically transfers any carried resources into chests that already contain a non-zero quantity of that resource.

### 4. Warding Brazier
- **Recipe**: `brazier` (Stone ×6, Wood ×4, Crystal ×1 at Workbench).
- **Visuals**: Cyan brazier voxel geometry with active flame particles and point lighting.
- **Spawn Suppression**: Suppresses hostile creature pack spawns within 20 meters of any placed brazier.

### 5. Fibre Pouch (Tonic Belt Expansion)
- **Recipe**: `pouch` (Fibre ×8, Wood ×4 at Workbench).
- **Progression**: Permanently increases maximum tonic belt capacity by +1, up to a maximum cap of 5 tonics.

---

## Test Verification

- **Automated Regression Suite**:
  - `tests/camp_qol.test.mjs`: 8 passed, 0 failed.
  - `tests/devlab_command.test.mjs`: 6 passed, 0 failed.
  - `tests/fieldcraft.test.mjs`: 22 passed, 0 failed.
  - `tests/survival.test.mjs`: 21 passed, 0 failed.
  - `tests/survival_inventory.test.mjs`: 15 passed, 0 failed.
  - **Browser assertions**: 72 passed, 0 failed.
  - **Unit tests** (`controller`, `persistence`, `transfer`): 21 passed, 0 failed.
  - **Total verified checks**: 93 passed, 0 failed.
