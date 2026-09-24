# Combined Pass 4 preview

This integration preserves the complete histories of Pass 3 (`1d39257`),
persistence plus visuals (`9b11a83`, including visual head `20dc610`), and
developer commands/affix foundation (`b856443`). Production is unchanged.

The CSS merge retains both the workbench/boss presentation and developer console.
Follow-up fixes:

- Pin the Node test dependency to Three.js 0.169.0, matching the vendored renderer.
- Keep experimental echo damage, projectile size and strike reach out of normal
  loot until gameplay applies them. Their display metadata and dev simulations remain.
- Translate developer day/night commands into the persisted 420-second world clock.
- Make the village test approach the intended NPC rather than a nearby workbench.
- Exclude local environment files, tests and documentation from preview uploads.

Validation commands:

```sh
npm ci --ignore-scripts
npm run test:persistence
npm run test:dev
npm run test:simulation
node tests/run.mjs aim balance crafting village persistence integration
git diff --check
```

The integration browser suite covers console focus/input isolation, day/night and
reload, dev-room entry/return, affix tooltips, nine slots, paper-doll rendering and
item identity. The loot regression generates 3,000 ordinary items and verifies
that inactive affixes never appear while the development registry retains them.

Before production approval, play through the chapter and assess feel, controller
input and hardware performance. The inherited long chapter bot remains WIP and
is not included in the passing regression set. Preview browser storage is
separate from production: an empty character list on the new URL is expected.
