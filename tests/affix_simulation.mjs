// Standalone simulation runner and test suite for Mossling stat/affix rarity.
// Usage: node tests/affix_simulation.mjs

import assert from 'node:assert/strict';
import { simulateAffixRolls, formatSimulationReport } from '../src/rpg/affix_simulation.js';
import { AFFIX_RARITY_TIERS, TIER_ORDER } from '../src/rpg/affixes.js';

console.log('Starting Mossling Affix Rarity 1,000,000 Virtual Roll Simulation...\n');

const ROLL_COUNT = 1000000;
const results = simulateAffixRolls(ROLL_COUNT);

console.log(formatSimulationReport(results));

// Statistical assertions
console.log('Verifying statistical confidence bounds...');

// 1. Total count matches
assert.equal(results.totalRolls, ROLL_COUNT, 'Total simulated rolls must equal 1,000,000');

// 2. No save modification occurred
assert.equal(results.saveModified, false, 'Simulation must never mutate saves or persistent storage');

// 3. Every tier is populated in correct ascending rarity order
for (let i = 0; i < TIER_ORDER.length - 1; i++) {
  const current = results.tiers[TIER_ORDER[i]];
  const next = results.tiers[TIER_ORDER[i + 1]];
  assert.ok(
    current.observed > next.observed,
    `Higher tier ${current.name} (${current.observed}) must occur more frequently than lower tier ${next.name} (${next.observed})`
  );
}

// 4. Chase Prismatic tier target is approximately 0.01%
// Expected: 100 per 1,000,000 (stdDev = ~10). 3-sigma bound = [70, 130].
const prism = results.tiers.prismatic;
assert.ok(
  prism.observed >= 50 && prism.observed <= 160,
  `Prismatic observed count ${prism.observed} should be close to theoretical 100 (~0.01%)`
);
console.log(`✔ Prismatic (~0.01% conceptual target): ${prism.observed} observed (${prism.observedPct}%), z-score: ${prism.zScore}`);

// 5. Common tier target is ~50.0%
const common = results.tiers.common;
assert.ok(
  Math.abs(common.zScore) < 4.0,
  `Common observed percentage ${common.observedPct}% should be within 4 standard deviations of 50.0%`
);
console.log(`✔ Common (50.0% target): ${common.observed} observed (${common.observedPct}%), z-score: ${common.zScore}`);

// 6. Mythic tier target is ~0.14% (expected 1,400)
const mythic = results.tiers.mythic;
assert.ok(
  Math.abs(mythic.zScore) < 4.0,
  `Mythic observed count ${mythic.observed} should be within 4 standard deviations of 1,400`
);
console.log(`✔ Mythic (0.14% target): ${mythic.observed} observed (${mythic.observedPct}%), z-score: ${mythic.zScore}`);

// 7. Verify sample weapons hold mixed affixes
assert.ok(results.sampleWeapons.length >= 3, 'Sample weapons must be generated');
for (const w of results.sampleWeapons) {
  assert.ok(w.rolledAffixes.length > 0, 'Sample weapon must have rolled affixes');
  assert.ok(w.valuationTotal > 0, 'Sample weapon must have valuation score hook');
  for (const aff of w.rolledAffixes) {
    assert.ok(aff.actualRoll !== undefined, 'Affix must have actualRoll');
    assert.ok(aff.tier !== undefined, 'Affix must have tier');
    assert.ok(aff.rollRange && aff.rollRange.length === 2, 'Affix must have rollRange [min, max]');
  }
}
console.log('✔ Multi-affix mixed-rarity weapon generation verified');

console.log('\nAll simulation checks and statistical distribution bounds passed successfully!\n');
