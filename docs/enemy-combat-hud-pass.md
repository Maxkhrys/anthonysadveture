# Enemy depth, combat feel and HUD pass

Base: `origin/feat/gunslinger-class-loot` at `856f1e7bffa8f46a702f1f9a04dc14496146a993`.
Feature branch: `feat/enemy-combat-hud-pass`.

## Play
Open Settings > HUD. Classic keeps the full parchment layout; Compact reduces card and action-bar size; Immersive moves vitals to the lower left. Scale, secondary panels, quest/tutorial combat behaviour, minimap size, enemy-bar density/style, damage numbers, shake and hit flash are independent controls. Preferences use the existing settings key, acquire safe defaults on older installations and survive reloads. Existing character saves are unchanged.

## Encounters and counterplay
- Brigands and Porcelain Guards position between nearby ranged/support allies and the player. Their normal attack windups remain; Brigand aim commits before its spear thrust.
- Flankers and Swift elites approach obliquely. Ranged enemies retreat when crowded. Lantern Moths show their existing ally buff through gold links.
- Heavy enemies retain telegraphed attacks and visible recovery openings. Brutal elites recover longer. Elite health and Swift/Brutal stat multipliers are reduced to keep this a tactics pass rather than a difficulty spike.
- Storm-touched enemies mark a stationary lightning circle. Frostbound enemies telegraph a short slow pulse, never a hard freeze. Move out, break sight or interrupt the caster. Warnings share the existing attack-token budget, cap at three, dispose their geometry/materials and cancel on area changes.
- Bulwark/Armoured elites cycle frontal protection with an open period. Heavy attacks break the guard; flanking avoids it.
- Vampiric/Bloodbound healing requires a visible red tether to a nearby ally. Separate the pack or kill the ally to break it.
- Blazing/Volatile death bursts now warn for 1.15 seconds instead of dealing immediate damage. Existing Resonant echoes and Oathbound links remain, with bounded echoes and off-screen/cover checks.

## Readability and feel
Parchment-framed normal/elite bars show statuses, real guard/open states and modifier names, with a smooth damage trail. Overlapping labels move apart with fine anchor lines; crowded overflow hides. Boss bars include numeric health and applicable states. Enemy hover details show roles, modifiers and statuses.

Bar selection/content updates at 10 Hz, with at most 12 regular cards (four in Focused mode); only positions update each frame. Floaters remain capped at 60, reaction labels are rate-limited and minimal numbers preserve important reaction labels. Tutorial text uses dark ink with clear hierarchy. HUD modes keep the existing map, creator, inventory, portraits and graphics.

Primary, heavy and critical hits have distinct hitstop/shake, while secondary effects avoid repeated impact pauses. Audio repetition is throttled, regular impacts are softer, heavy impacts have a low bell layer, and rare drops gain a restrained bell/ring/label cue. Level-up always announces the gained skill point. Hit-flash control covers player, enemy, boss and screen flashes.

Soulbound fix: the generic crowd-separation step previously pushed enemies ahead during Veilshift. It now allows the Veilshift state to pass through enemies while retaining world collision. The four-lash combo and all nine abilities are regression-tested.

## Verification
82 unit checks pass. Browser checks cover HUD/elite mechanics and live settings, all-class aiming and skills, Gunslinger combat/creator, Soulbound's complete sequence, shield/burn interactions, onboarding and character persistence. Exact final counts are recorded in the PR handoff.

Soulbound tests now isolate their controlled enemies from world streaming, use clear terrain, disable random elite assignment, and expect the fifth class. The behind-target assertion is retained; it exposed the crowd-separation bug rather than being relaxed.

Screenshots in `screens/enemy-hud`: Classic, Compact, Immersive, smaller desktop layout, settings, normal/elite status bars, real Bramblemaw opening, lightning warning, level-up and legendary reward. These are controlled in-game browser scenarios, not a completed campaign playthrough.

## Tuning limits
The checks establish functionality and bounded UI/effect counts. They do not establish frame rates on representative player hardware or final encounter balance. Very dense fights deliberately suppress some overlapping labels; hover provides fuller information. Longer playtesting should focus on mixed ranged/support packs and high-proc builds. No campaign/world expansion and no production promotion.
