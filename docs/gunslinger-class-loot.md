# Gunslinger and class-correct loot

Based on `claude/keen-wright-6w90br`, including graphics update 639e71d. Preview branch: `feat/gunslinger-class-loot`.

## Playing
Choose Gunslinger in New Character. Hold attack to fire; Z reloads (Settings > Controls offers N or U). Revolvers have six rounds and stronger individual shots; automatic rifles have eighteen rounds and faster fire. Dodging cancels reload. Ammunition belongs to each weapon and survives saves and swaps.

Eight abilities cover Quickdraw, Barrage, Deadeye, Powder Grenade, Smoke, Satchel, Sentry and Overclock. Three eight-node paths support shooting, explosives and engineering; only one capstone can be selected. Grit comes from successful direct gun hits. Sentries draw nearby ordinary enemies' attacks and have finite health and lifetime. Bosses keep targeting the player.

Weapons and the square-headed Gunslinger model use the game's wood, brass, iron and warm-cloth palette. Four named firearms have individual mechanisms: Sundown Six, Kilnrunner, Bellfoundry Repeater and Seventh Chime.

## Loot
All player-facing random loot requires a recipient class. Eligible item bases, named items and useful modifiers are filtered before selection. Fixed rewards adapt to the recipient while retaining source identity, slot and rarity. Developer-only generation can explicitly use the unrestricted catalogue. Existing stored equipment is preserved.

## Validation
- 77 unit checks pass, including 7,200 class/slot/rarity loot rolls and magazine persistence.
- Browser suites: aiming (29), Gunslinger (16), Gunslinger combat (21), creator/continue/rebinding (5), class onboarding (8), skills (22), loot (7), persistence (13), shield burn (4), character creator (18).
- Reviewed creator, inventory, combat and skills screenshots in `screens/gunslinger`.
- The older standalone Soulbound browser suite has existing Veilshift, spirit-release and ward-fixture failures reproduced on the original base; the shared skill suite passes. This is not a claim that every repository suite is green.

Revolver and rifle unmodified sustained weapon-power rates are approximately 1.92 and 2.04 per second including reloads. Longer playtesting is still needed for encounter balance and hardware performance.
