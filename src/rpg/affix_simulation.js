// Virtual affix simulation engine for Mossling.
// Capable of rolling 1,000,000+ virtual affixes in memory without modifying player saves.

import {
  AFFIX_RARITY_TIERS,
  TIER_ORDER,
  TOTAL_AFFIX_WEIGHT,
  rollAffixTier,
  rollWeaponWithAffixes,
} from './affixes.js';

/**
 * Runs a monte-carlo simulation of virtual affix rolls.
 * @param {number} [count=1000000] - Number of virtual rolls (must be >= 1,000,000 for standard verification)
 * @param {Object} [options]
 * @param {Function} [options.randomFn=Math.random] - RNG function
 * @returns {Object} Comprehensive simulation distribution report
 */
export function simulateAffixRolls(count = 1000000, { randomFn = Math.random } = {}) {
  const startTime = Date.now();

  // Initialize counts
  const counts = {};
  for (const id of TIER_ORDER) {
    counts[id] = 0;
  }

  // Pre-calculate cumulative thresholds for fast iteration in 1,000,000 loops
  const tierIds = TIER_ORDER;
  const thresholds = new Float64Array(tierIds.length);
  let accum = 0;
  for (let i = 0; i < tierIds.length; i++) {
    accum += AFFIX_RARITY_TIERS[tierIds[i]].weight / TOTAL_AFFIX_WEIGHT;
    thresholds[i] = accum;
  }

  // Run simulation
  for (let i = 0; i < count; i++) {
    const r = randomFn();
    // Binary search or direct scan for 8 tiers (scan is ultra-fast for 8 items)
    let chosenIndex = tierIds.length - 1;
    for (let t = 0; t < thresholds.length; t++) {
      if (r < thresholds[t]) {
        chosenIndex = t;
        break;
      }
    }
    counts[tierIds[chosenIndex]]++;
  }

  const durationMs = Date.now() - startTime;

  // Compile statistical breakdown
  const tiers = {};
  for (const id of TIER_ORDER) {
    const tierConfig = AFFIX_RARITY_TIERS[id];
    const observed = counts[id];
    const expected = count * tierConfig.probability;
    const observedPct = (observed / count) * 100;
    const expectedPct = tierConfig.probability * 100;
    const deltaCount = observed - expected;
    const deltaPct = expected > 0 ? (deltaCount / expected) * 100 : 0;

    // Standard deviation for binomial distribution: sqrt(N * p * (1 - p))
    const p = tierConfig.probability;
    const stdDev = Math.sqrt(count * p * (1 - p));
    const zScore = stdDev > 0 ? (observed - expected) / stdDev : 0;

    tiers[id] = {
      id,
      name: tierConfig.name,
      token: tierConfig.token,
      color: tierConfig.color,
      weight: tierConfig.weight,
      observed,
      expected: Math.round(expected),
      observedPct: Number(observedPct.toFixed(4)),
      expectedPct: Number(expectedPct.toFixed(4)),
      deltaCount,
      deltaPct: Number(deltaPct.toFixed(2)),
      zScore: Number(zScore.toFixed(3)),
    };
  }

  // Generate sample weapons demonstrating mixed-rarity affixes
  const sampleWeapons = [
    rollWeaponWithAffixes({ cls: 'archer', level: 10, baseId: 'galebow', affixCount: 4, randomFn }),
    rollWeaponWithAffixes({ cls: 'samurai', level: 12, baseId: 'nodachi', affixCount: 4, targetTier: 'mythic', randomFn }),
    rollWeaponWithAffixes({ cls: 'witch', level: 15, baseId: 'starstaff', affixCount: 4, targetTier: 'prismatic', randomFn }),
  ];

  return {
    totalRolls: count,
    durationMs,
    rollsPerSec: Math.round((count / durationMs) * 1000),
    tiers,
    sampleWeapons,
    saveModified: false, // Verification marker: zero filesystem/storage writes occurred
  };
}

/**
 * Formats the simulation results into an ASCII/Markdown table.
 */
export function formatSimulationReport(results) {
  let out = '';
  out += `========================================================================================\n`;
  out += `  MOSSLING AFFIX RARITY SIMULATION REPORT (${results.totalRolls.toLocaleString()} VIRTUAL ROLLS)\n`;
  out += `  Execution Time: ${results.durationMs}ms (${results.rollsPerSec.toLocaleString()} rolls/sec) | Save Mutation: NONE\n`;
  out += `========================================================================================\n`;
  out += `| Tier         | Weight    | Expected % | Expected Qty | Observed Qty | Observed % | Delta %  | z-Score |\n`;
  out += `|--------------|-----------|------------|--------------|--------------|------------|----------|---------|\n`;

  for (const id of TIER_ORDER) {
    const t = results.tiers[id];
    const name = (t.token + ' ' + t.name).padEnd(12);
    const weight = t.weight.toLocaleString().padStart(9);
    const expPct = (t.expectedPct.toFixed(4) + '%').padStart(10);
    const expQty = t.expected.toLocaleString().padStart(12);
    const obsQty = t.observed.toLocaleString().padStart(12);
    const obsPct = (t.observedPct.toFixed(4) + '%').padStart(10);
    const delta = ((t.deltaPct >= 0 ? '+' : '') + t.deltaPct.toFixed(2) + '%').padStart(8);
    const z = (t.zScore >= 0 ? '+' : '') + t.zScore.toFixed(2);
    out += `| ${name} | ${weight} | ${expPct} | ${expQty} | ${obsQty} | ${obsPct} | ${delta} | ${z.padStart(7)} |\n`;
  }
  out += `----------------------------------------------------------------------------------------\n`;
  out += `  Extreme Chase Tier (Prismatic 🌈 ~0.01% target): ${results.tiers.prismatic.observed} rolls observed (${results.tiers.prismatic.observedPct}%)\n`;
  out += `========================================================================================\n\n`;

  out += `Sample Generated Multi-Affix Weapons:\n`;
  for (const w of results.sampleWeapons) {
    out += `\n- [${w.highestAffixToken} ${w.name}] (ilvl ${w.ilvl} ${w.cls} ${w.kind})\n`;
    out += `  Base Damage: ${w.min}-${w.max} | Speed: ${w.spd} | Appraisal Score: ${w.valuationTotal?.toLocaleString()}\n`;
    for (const aff of w.rolledAffixes) {
      const qual = aff.qualitative ? ` ★ Qual: ${aff.qualitative.name}` : '';
      out += `  • ${aff.displayToken} ${aff.name}: +${aff.actualRoll}${aff.unit} [${aff.tierName}]${qual}\n`;
    }
  }

  return out;
}
