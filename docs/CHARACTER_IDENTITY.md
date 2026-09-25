# Character identity

Based on `origin/astra/pass8-alpha-polish` at `045b6a0`. This branch retains the inventory overhaul. No combat, ability, progression, loot, or world rules change.

New Character opens a parchment folio with a separate live WebGL preview, drag rotation, zoom buttons/wheel, idle breathing, class preview, and inline naming. Continuing an existing character skips it. Creation still uses the existing save provider and separate character profiles. Cancel creates no profile. Failed creation retains the draft and reports failure.

Five frame presets, four faces, eight skin tones, ten hairstyles, eight hair colours, six facial-hair choices, six eye colours and five face-detail options are shared by the world hero and inventory preview. Randomise changes only appearance. Name is plain text, capped at 32 characters. Keyboard focus is contained; Escape cancels, or returns from Name to Class. Mobile uses a vertically scrolling folio. Reduced motion keeps the character still with eyes open.

## Model and save boundaries

`src/appearance.js` defines stable option IDs and normalization. `inventory.appearance` is an additive cosmetic field under the existing schema and storage key. Legacy characters get curated defaults. Invalid cosmetic values fall back individually without rejecting the character's gameplay state.

`makeHero(classId, appearance)` retains the existing animation pivots and weapon sockets. Its new `frame` parent holds proportions independently of animation squash on `body`. `setAppearance`, `setGear` and `dispose` expose the visual lifecycle. Garment parts use merged bevelled geometry; heads and hair use faceted curved geometry. Legs are longer, head smaller, weapon grips unchanged. Blinks compensate around eye height. Equipped helmets suppress hair geometry, never saved hair selections. Armour and class equipment remain separate from cosmetics.

Creator enumerates `CLASSES`; additional registered playable classes appear automatically. SoulBound gameplay was not present on this base. Its palette and travelling-cloak/charm silhouette are prepared in `CLASS_LOOK`/`torsoParts`, but no playable class or SoulChain gameplay is invented here. The SoulBound implementation must still supply its own normal class, save-validation and weapon registrations. Existing fallback weapon behavior is unchanged.

## Verification

14 persistence unit tests; browser suites `character_creator` (14 checks), `inventory9` (18), `persistence` (13), `zcharacter_identity` (5), and `zhero` (1) passed with Chromium. Desktop 1440×900, compact desktop 1280×720 and mobile 390×844 screenshots reviewed. Creation, all hair/face/detail choices, class switches, randomisation, name validation, actual reload, inventory cosmetics, helm swaps, cancellation, keyboard focus and movement/roll/attack weapon anchors exercised. Final visual audit corrected mobile control overlap, selected-class hover contrast and reduced-motion blinking.

Screenshots: `docs/screens/character-identity/`.

No production deployment or merge performed. Procedural rig remains stylised; this is not a skinned external asset or a full animation-system replacement.

## Gameplay preview correction

Creator now uses the same `PixelRenderer` as the world: orthographic 42-degree camera, nearest pixel sampling, depth edges and palette banding. It captures the game's current world-units-per-texel density; preview zoom changes magnification rather than inventing extra facial detail. Lighting uses the base gameplay sun/hemisphere setup; local weather and time still affect colours in the world. Preview equips the actual starter weapon for each class. Decorative preview particles removed because their enlarged pixels distract from the character.

The renderer accepts an optional embedded viewport, transparent canvas and pixel scale. Defaults for the game remain unchanged. Transparent mode uses straight-alpha canvas compositing to prevent bright fringes. Embedded instances are resized by their host and fully disposed on exit.
