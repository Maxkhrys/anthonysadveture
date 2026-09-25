# Weapon visuals pass

Source of truth: the approved weapon sheet (`94b5d0f9-bc5e-4686-a826-b88129be17b8.png`).
Captures: `docs/screens/weapons/` (`OUT=docs/screens/weapons node tests/run.mjs zshots_weapons`).

## Files
| File | Role |
|---|---|
| `src/rpg/weaponVisuals.js` (new) | Data-only registry keyed by **base id**: family, silhouette profile, palette, scale, hold, icon cell; rarity, element and unique-accent tables; adapters `getWeaponVisual`, `rarityTier`, `weaponElements`. No stats. |
| `src/weaponModels.js` (new) | Builds each silhouette (katana, shinai, cleaver, bone, storm, bow, staff heads, chain) from the registry; rarity gem, unique accents, crafted mark; `chainStyle()` for the SoulChain lash. |
| `src/weaponFx.js` (new) | Shared Prismatic material, `applyWeaponElementVisual(model, elements)`, pooled element particles (`tickWeaponFx`), world-drop presentation (`weaponDrop`). |
| `assets/weapons/atlas.png` + `atlas.json` (new) | 41 icons cut from the sheet (96px cells). Rebuild: `python3 scripts/build_weapon_atlas.py`. |
| `src/hero.js` | `weaponModel` uses the registry first; named curios keep their hand-built models. |
| `src/preview.js` | Weapon icons come from the atlas (+ unique/crafted/Prismatic sparkles); `itemIconHTML` for text contexts. |
| `src/rpg/combat.js` | GearDrop: weapons use `weaponDrop` (a 3-line hook). |
| `src/entities/player.js` | One line: `tickWeaponFx` on the held weapon. |
| `src/rpg/soulbound.js` | Chain rig reads `chainStyle` (link colours, heavy/spiked/ornate links). |
| `src/ui_rpg.js`, `src/story.js`, `src/story6.js`, `src/ui_craft.js`, `style.css` | Emoji weapon icons replaced by sprites; `.prism` frame. |

## Rules
- Rarity never recolours a weapon: Common plain; Uncommon+ adds a small gem, drop halo; Rare+ a beam; Legendary/Prismatic motes; Prismatic a colour-drifting gem and frame.
- Elements are overlays: a thin edge line (blades/bows) or a mote halo (staffs/chains) plus a few pooled particles. Rolled elements emit at full rate, a base's own identity (Stormedge, Moonlit) at 40%.
- SoulChain bases not drawn on the sheet reuse one of the five approved chains with their own palette (`via`).

## Integration points for the ARPG itemization branch
1. `weaponElements(item)` — read `item.element` / `item.elements` (already supported) or map new affix ids in `AFFIX_ELEMENT`.
2. `rarityTier(item)` — already accepts `item.prismatic`, `item.rarity === 'prismatic'`, `item.tier === 'prismatic'`.
3. New bases: add a registry entry (or `via` an existing profile) and, if drawn on a sheet, an atlas cell.
4. `UNIQUE_ACCENTS` — add new named uniques by id.
