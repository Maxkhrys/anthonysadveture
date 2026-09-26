# Opus integration: modular houses ↔ fieldcraft

Shared base: 9ea8601af821c39993157304d48b08a129d48e0b.
Our branch: feat/survival-ui-gathering. Do not overwrite the existing feature branch or production.

Our ownership: inventory workshop presentation, material tips, gathering sound/particles, controller input/menu navigation, eight-slot weapon belt, /devlab access.
Your ownership: structures, placement, rotation, support/elevation, interiors, stairs, cutaway, generated houses and their saved fields.

Preserve these shared seams when merging:

- `SurvivalUI` still provides show/hide/refresh/openCraft/closeAll/buildStatus/openChest. Its crafting panel now lives inside `.inv-panel`; Building is data-driven from PIECES and Crafting from RECIPES.
- `canCraft(id, count=1)` and `craft(id, count=1)` validate and apply atomic batch costs. Keep station compatibility logic when adding new station/elevation conditions. Full tonic output cannot consume resources.
- `pieceParts(type, roofColor=0xc8a050)` is now exported from survival/entities.js for real model thumbnails. Roof runtime geometry calls the same helper with white because its existing material supplies the colour. If your registry moves models elsewhere, update the UI import to that authoritative model factory. Do not restore magenta fallback thumbnails for supported pieces.
- ResourceNode only calls gatherFeedback on resolved work and terminal removal; work HP/cooldown/drop allocation are unchanged. A dead guard prevents duplicate terminal feedback. Keep these calls when editing the same entities file.
- New plain-data world fields `fieldKit` and `trackedRecipe` use the existing namespace and unknown-field-preserving normalization. Do not store scene objects in them.
- `Game.update` stops before simulation timers when inventory, Survival configuration, MOSSDEV or the command console is open.
- Controller: left stick move, right stick aim, X attack/place, RT secondary/cancel, B dodge, A interact, Y reload. LT is the six-ability layer. RB and D-pad left/right switch weapons; D-pad down crafting; View inventory. Reserve other building rotation controls deliberately—do not silently reuse these during combat.
- `game.openDevLab()` is the command entry point. It enables developer mode, closes console/inventory, enters through the same main-mode transition as F10 and reopens the existing lab profile.

Tests: controller.unit, fieldcraft, devlab_command, survival, survival_inventory, inventory_clarity, weapon_kits, gunslinger_combat, persistence, combat_fx. The old 30 Hz SoulChain sampling limitation is documented in patch notes, not altered by this pass.
