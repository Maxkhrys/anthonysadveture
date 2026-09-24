// Data-driven stat and affix rarity system foundation for Mossling.
// Item rarity and stat-roll rarity are separate concepts.
// A weapon can carry multiple individual affixes of differing rarities
// (e.g. Common, Rare, Legendary, Mythic, Prismatic).

export const AFFIX_RARITY_TIERS = {
  common: {
    id: 'common',
    name: 'Common',
    tierIndex: 0,
    token: '◇',
    color: '#d0c8b8',
    hex: 0xd0c8b8,
    weight: 500000,           // 50.000%
    probability: 0.500000,
    multRange: [0.70, 0.90],
    tradeWeight: 1,
    description: 'Foundational rolls providing baseline utility.'
  },
  uncommon: {
    id: 'uncommon',
    name: 'Uncommon',
    tierIndex: 1,
    token: '◆',
    color: '#6fdc5a',
    hex: 0x6fdc5a,
    weight: 280000,           // 28.000%
    probability: 0.280000,
    multRange: [0.90, 1.15],
    tradeWeight: 3,
    description: 'Polished rolls with solid numerical performance.'
  },
  rare: {
    id: 'rare',
    name: 'Rare',
    tierIndex: 2,
    token: '◈',
    color: '#4aa8ff',
    hex: 0x4aa8ff,
    weight: 135000,           // 13.500%
    probability: 0.135000,
    multRange: [1.15, 1.45],
    tradeWeight: 10,
    description: 'High-grade rolls noticeably elevating gear efficiency.'
  },
  epic: {
    id: 'epic',
    name: 'Epic',
    tierIndex: 3,
    token: '★',
    color: '#c46bff',
    hex: 0xc46bff,
    weight: 60000,            // 6.000%
    probability: 0.060000,
    multRange: [1.45, 1.85],
    tradeWeight: 35,
    description: 'Exceptional rolls bordering masterwork craftsmanship.'
  },
  legendary: {
    id: 'legendary',
    name: 'Legendary',
    tierIndex: 4,
    token: '✪',
    color: '#ff9a2a',
    hex: 0xff9a2a,
    weight: 18000,            // 1.800%
    probability: 0.018000,
    multRange: [1.85, 2.30],
    tradeWeight: 120,
    description: 'Elite rolls that shape entire character builds.'
  },
  relic: {
    id: 'relic',
    name: 'Relic',
    tierIndex: 5,
    token: '✦',
    color: '#ff4a6a',
    hex: 0xff4a6a,
    weight: 5500,             // 0.550% (~1 in 182)
    probability: 0.005500,
    multRange: [2.30, 2.80],
    tradeWeight: 500,
    description: 'Ancient resonant rolls offering profound enhancements.'
  },
  mythic: {
    id: 'mythic',
    name: 'Mythic',
    tierIndex: 6,
    token: '🗲',
    color: '#e040fb',
    hex: 0xe040fb,
    weight: 1400,             // 0.140% (~1 in 714)
    probability: 0.001400,
    multRange: [2.80, 3.40],
    tradeWeight: 2500,
    description: 'Mythological rolls introducing potent qualitative triggers.'
  },
  prismatic: {
    id: 'prismatic',
    name: 'Prismatic',
    tierIndex: 7,
    token: '🌈',
    color: '#ffd700',
    hex: 0xffd700,
    weight: 100,              // 0.010% (~1 in 10,000; conceptual chase target ~0.01%)
    probability: 0.000100,
    multRange: [3.40, 4.20],
    tradeWeight: 30000,
    description: 'Extraordinarily rare chase roll with transformative qualitative anomalies.'
  },
};

export const TIER_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'relic', 'mythic', 'prismatic'];
export const TOTAL_AFFIX_WEIGHT = TIER_ORDER.reduce((sum, id) => sum + AFFIX_RARITY_TIERS[id].weight, 0);

// Unusual qualitative modifiers attached to ultra-rare rolls (Relic, Mythic, Prismatic).
// Rather than mere damage inflation, these provide distinctive combat mechanics.
export const QUALITATIVE_MODIFIERS = {
  resonance_echo: {
    id: 'resonance_echo',
    name: 'Resonance Echo',
    minTier: 'mythic',
    description: 'Attacks evoke a ghostly duplicate 0.8s later dealing 40% echo damage.',
    trigger: 'on_attack',
    hook: 'echo_duplicate',
  },
  prismatic_splinters: {
    id: 'prismatic_splinters',
    name: 'Prismatic Splinters',
    minTier: 'prismatic',
    description: 'Critical hits shatter into 3 spectrum needles seeking nearby foes.',
    trigger: 'on_crit',
    hook: 'spectrum_needles',
  },
  singularity_wake: {
    id: 'singularity_wake',
    name: 'Singularity Wake',
    minTier: 'mythic',
    description: 'Projectiles create a vortex trail gently pulling nearby foes toward their path.',
    trigger: 'on_projectile',
    hook: 'vacuum_trail',
  },
  temporal_stride: {
    id: 'temporal_stride',
    name: 'Temporal Stride',
    minTier: 'relic',
    description: 'Dodging through an attack triggers a brief 0.6s stasis field around the attacker.',
    trigger: 'on_dodge',
    hook: 'stasis_pocket',
  },
  vital_dewdrop: {
    id: 'vital_dewdrop',
    name: 'Vital Dewdrop',
    minTier: 'relic',
    description: 'Overhealing condenses into a healing dewdrop on the ground for allies or self.',
    trigger: 'on_overheal',
    hook: 'dewdrop_spawn',
  },
  elemental_convergence: {
    id: 'elemental_convergence',
    name: 'Elemental Convergence',
    minTier: 'mythic',
    description: 'Chilled foes struck by burning attacks trigger an concussive steam rupture.',
    trigger: 'on_status_cross',
    hook: 'steam_rupture',
  },
  astral_step: {
    id: 'astral_step',
    name: 'Astral Step',
    minTier: 'prismatic',
    description: 'Rolling phases completely through solid geometry and leaves a stellar nebula.',
    trigger: 'on_roll',
    hook: 'stellar_nebula',
  },
  executioners_toll: {
    id: 'executioners_toll',
    name: 'Toll of the Dawnbell',
    minTier: 'prismatic',
    description: 'Strikes against foes below 20% life resonate a bell toll dealing instant true damage.',
    trigger: 'on_low_health_hit',
    hook: 'dawnbell_toll',
  },
};

// Base affix definitions
export const AFFIX_DEFINITIONS = {
  crit: {
    id: 'crit',
    name: 'Crit Chance',
    unit: '%',
    base: 3.0,
    per: 0.25,
    slots: ['weapon', 'helm', 'charm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 1,
    weight: 90,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'prismatic_splinters',
  },
  critDmg: {
    id: 'critDmg',
    name: 'Crit Damage',
    unit: '%',
    base: 12.0,
    per: 1.2,
    slots: ['weapon', 'helm', 'charm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 1,
    weight: 85,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'executioners_toll',
  },
  atkSpd: {
    id: 'atkSpd',
    name: 'Attack Speed',
    unit: '%',
    base: 5.0,
    per: 0.45,
    slots: ['weapon', 'charm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 1,
    weight: 95,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'temporal_stride',
  },
  echoDmg: {
    id: 'echoDmg',
    name: 'Echo Damage',
    unit: '%',
    base: 8.0,
    per: 0.8,
    slots: ['weapon', 'charm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 2,
    weight: 50,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'resonance_echo',
  },
  projSize: {
    id: 'projSize',
    name: 'Projectile Size',
    unit: '%',
    base: 6.0,
    per: 0.6,
    slots: ['weapon'],
    kinds: ['bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 1,
    weight: 60,
    sources: ['natural', 'crafted'],
    qualitativeCandidate: 'singularity_wake',
  },
  reach: {
    id: 'reach',
    name: 'Strike Reach',
    unit: '%',
    base: 6.0,
    per: 0.6,
    slots: ['weapon'],
    kinds: ['katana'],
    classAffinity: 'samurai',
    levelReq: 1,
    weight: 60,
    sources: ['natural', 'crafted'],
    qualitativeCandidate: 'singularity_wake',
  },
  dmgPct: {
    id: 'dmgPct',
    name: 'Damage',
    unit: '%',
    base: 6.0,
    per: 0.6,
    slots: ['weapon', 'charm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 1,
    weight: 100,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: null,
  },
  lifesteal: {
    id: 'lifesteal',
    name: 'Life Steal',
    unit: '%',
    base: 1.5,
    per: 0.12,
    slots: ['weapon', 'charm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 3,
    weight: 45,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'vital_dewdrop',
  },
  cdr: {
    id: 'cdr',
    name: 'Cooldown Reduction',
    unit: '%',
    base: 4.0,
    per: 0.3,
    slots: ['weapon', 'helm', 'charm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 2,
    weight: 70,
    sources: ['natural', 'crafted'],
    qualitativeCandidate: 'astral_step',
  },
  moveSpd: {
    id: 'moveSpd',
    name: 'Move Speed',
    unit: '%',
    base: 4.0,
    per: 0.25,
    slots: ['armor', 'charm', 'helm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 1,
    weight: 65,
    sources: ['natural', 'crafted'],
    qualitativeCandidate: 'astral_step',
  },
  abilityDmg: {
    id: 'abilityDmg',
    name: 'Ability Damage',
    unit: '%',
    base: 8.0,
    per: 0.8,
    slots: ['weapon', 'charm', 'helm'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: null,
    levelReq: 2,
    weight: 75,
    sources: ['natural', 'crafted'],
    qualitativeCandidate: 'resonance_echo',
  },
  burn: {
    id: 'burn',
    name: 'Chance to Burn',
    unit: '%',
    base: 8.0,
    per: 0.5,
    slots: ['weapon'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: 'witch',
    levelReq: 1,
    weight: 55,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'elemental_convergence',
  },
  chill: {
    id: 'chill',
    name: 'Chance to Chill',
    unit: '%',
    base: 8.0,
    per: 0.5,
    slots: ['weapon'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: 'witch',
    levelReq: 1,
    weight: 55,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'elemental_convergence',
  },
  shock: {
    id: 'shock',
    name: 'Chance to Shock',
    unit: '%',
    base: 7.0,
    per: 0.45,
    slots: ['weapon'],
    kinds: ['katana', 'bow', 'staff', 'wand'],
    classAffinity: 'witch',
    levelReq: 1,
    weight: 55,
    sources: ['natural', 'crafted', 'boss'],
    qualitativeCandidate: 'elemental_convergence',
  },
  hp: {
    id: 'hp',
    name: 'Max Health',
    unit: '',
    base: 8.0,
    per: 3.2,
    slots: ['helm', 'armor', 'charm'],
    kinds: null,
    classAffinity: null,
    levelReq: 1,
    weight: 90,
    sources: ['natural', 'crafted'],
    qualitativeCandidate: 'vital_dewdrop',
  },
  armor: {
    id: 'armor',
    name: 'Armour',
    unit: '',
    base: 4.0,
    per: 1.4,
    slots: ['helm', 'armor'],
    kinds: null,
    classAffinity: null,
    levelReq: 1,
    weight: 90,
    sources: ['natural', 'crafted'],
    qualitativeCandidate: null,
  },
};

/**
 * Rolls an individual stat tier based on configured weights.
 * @param {Object} [options]
 * @param {string} [options.floorTier] - Minimum tier to roll
 * @param {string} [options.targetTier] - Exact tier if forced (for dev testing)
 * @param {Function} [options.randomFn] - RNG source (defaults to Math.random)
 * @returns {Object} Affix tier config object
 */
export function rollAffixTier({ floorTier = null, targetTier = null, randomFn = Math.random } = {}) {
  if (targetTier && AFFIX_RARITY_TIERS[targetTier]) {
    return AFFIX_RARITY_TIERS[targetTier];
  }

  const floorIdx = floorTier && AFFIX_RARITY_TIERS[floorTier] ? AFFIX_RARITY_TIERS[floorTier].tierIndex : 0;
  const eligible = TIER_ORDER.slice(floorIdx);
  const totalWeight = eligible.reduce((acc, id) => acc + AFFIX_RARITY_TIERS[id].weight, 0);

  let roll = randomFn() * totalWeight;
  for (const id of eligible) {
    const tier = AFFIX_RARITY_TIERS[id];
    if (roll < tier.weight) return tier;
    roll -= tier.weight;
  }
  return AFFIX_RARITY_TIERS[eligible[eligible.length - 1]];
}

/**
 * Rolls a complete affix with metadata and valuation hooks.
 * @param {Object} affixDef - Affix definition
 * @param {Object} tier - Rarity tier definition
 * @param {number} level - Item level
 * @param {Function} [randomFn] - RNG source
 * @returns {Object} Rolled affix instance with full metadata
 */
export function rollAffixInstance(affixDef, tier, level = 1, randomFn = Math.random) {
  const [minMult, maxMult] = tier.multRange;
  const rollFraction = randomFn();
  const effectiveMult = minMult + rollFraction * (maxMult - minMult);

  const baseScaledTest = affixDef.base + affixDef.per * (Math.max(1, level) - 1);
  const minVal = Number((baseScaledTest * minMult).toFixed(1));
  const maxVal = Number((baseScaledTest * maxMult).toFixed(1));
  let actualRoll = Number((baseScaledTest * effectiveMult).toFixed(1));

  // Whole numbers for stats that aren't small percentages
  if (affixDef.unit === '' || affixDef.base >= 10) {
    actualRoll = Math.round(actualRoll);
  }

  // Qualitative modifier chance for Relic, Mythic, Prismatic
  let qualitative = null;
  if (tier.tierIndex >= 5 && affixDef.qualitativeCandidate) {
    const candidate = QUALITATIVE_MODIFIERS[affixDef.qualitativeCandidate];
    if (candidate) {
      const minRequiredIndex = AFFIX_RARITY_TIERS[candidate.minTier]?.tierIndex ?? 5;
      if (tier.tierIndex >= minRequiredIndex) {
        // Higher tiers have higher probability of gaining the qualitative quirk
        const qualChance = tier.tierIndex === 7 ? 0.90 : tier.tierIndex === 6 ? 0.65 : 0.40;
        if (randomFn() < qualChance) {
          qualitative = { ...candidate };
        }
      }
    }
  }

  // Economy / trade hook valuation structure (without implementing player trading)
  const valuation = calculateTradeValuation({
    tier,
    rollFraction,
    actualRoll,
    minVal,
    maxVal,
    hasQualitative: !!qualitative,
    level,
  });

  return {
    id: affixDef.id,
    name: affixDef.name,
    unit: affixDef.unit,
    tier: tier.id,
    tierName: tier.name,
    tierIndex: tier.tierIndex,
    displayToken: tier.token,
    displayColor: tier.color,
    rollRange: [minVal, maxVal],
    actualRoll,
    effectiveMultiplier: Number(effectiveMult.toFixed(2)),
    weight: affixDef.weight,
    compatibleItemTypes: affixDef.kinds ? [...affixDef.kinds] : (affixDef.slots ? [...affixDef.slots] : ['all']),
    classAffinity: affixDef.classAffinity,
    levelRequirement: affixDef.levelReq,
    scalingFormula: `${affixDef.base} + ${affixDef.per} * (lvl - 1)`,
    sources: [...affixDef.sources],
    qualitative,
    valuation,
  };
}

/**
 * Calculates trade and appraisal score hooks for future economy integration.
 */
export function calculateTradeValuation({ tier, rollFraction, actualRoll, minVal, maxVal, hasQualitative, level }) {
  const baseValue = Math.round((10 + level * 5) * tier.tradeWeight);
  const rollBonus = Math.round(baseValue * (rollFraction * 0.35));
  const qualBonus = hasQualitative ? Math.round(baseValue * 0.5) : 0;
  const totalScore = baseValue + rollBonus + qualBonus;

  let marketTier = 'Common Stock';
  if (totalScore >= 100000) marketTier = 'Ascendant Artifact (Chase)';
  else if (totalScore >= 15000) marketTier = 'Mythic Trophy';
  else if (totalScore >= 3000) marketTier = 'Relic Commodity';
  else if (totalScore >= 800) marketTier = 'High Value Tradeable';
  else if (totalScore >= 200) marketTier = 'Standard Tradeable';

  return {
    score: totalScore,
    tierWeight: tier.tradeWeight,
    rollPerfection: Number((rollFraction * 100).toFixed(1)),
    marketTier,
    chaseBonus: qualBonus > 0,
  };
}

/**
 * Rolls a complete weapon populated with individual data-driven affixes.
 * Supports weapons with mixed-rarity affixes (e.g. Rare Crit, Legendary Speed, Mythic Echo).
 *
 * @param {Object} [options]
 * @param {string} [options.cls] - Class affinity ('samurai', 'archer', 'witch')
 * @param {number} [options.level] - Target level
 * @param {string} [options.targetTier] - Force at least one affix of this tier (e.g. 'mythic', 'prismatic')
 * @param {number} [options.affixCount] - Exact number of affixes (1 to 4)
 * @param {string} [options.baseId] - Specific weapon base ID
 * @param {Function} [options.randomFn] - RNG source
 * @returns {Object} Identified weapon object
 */
export function rollWeaponWithAffixes({
  cls = 'samurai',
  level = 1,
  targetTier = null,
  affixCount = null,
  baseId = null,
  randomFn = Math.random,
} = {}) {
  // Weapon bases from existing game definitions
  const baseCatalog = [
    // Samurai
    { id: 'shinai', name: 'Bamboo Shinai', cls: 'samurai', kind: 'katana', lvl: 1, dmg: 0.85, spd: 1.15 },
    { id: 'rustkatana', name: 'Rusted Katana', cls: 'samurai', kind: 'katana', lvl: 1, dmg: 1.0, spd: 1.0 },
    { id: 'wakizashi', name: 'Wakizashi', cls: 'samurai', kind: 'katana', lvl: 2, dmg: 0.8, spd: 1.35 },
    { id: 'tachi', name: 'Tachi', cls: 'samurai', kind: 'katana', lvl: 3, dmg: 1.05, spd: 1.0 },
    { id: 'uchigatana', name: 'Uchigatana', cls: 'samurai', kind: 'katana', lvl: 5, dmg: 1.1, spd: 1.05 },
    { id: 'nodachi', name: 'Nodachi', cls: 'samurai', kind: 'katana', lvl: 6, dmg: 1.45, spd: 0.75 },
    { id: 'moonkatana', name: 'Moonlit Katana', cls: 'samurai', kind: 'katana', lvl: 8, dmg: 1.15, spd: 1.1 },
    { id: 'onicleaver', name: 'Oni Cleaver', cls: 'samurai', kind: 'katana', lvl: 10, dmg: 1.6, spd: 0.7 },
    // Archer
    { id: 'twigbow', name: 'Twig Bow', cls: 'archer', kind: 'bow', lvl: 1, dmg: 0.85, spd: 1.15 },
    { id: 'huntbow', name: 'Hunting Bow', cls: 'archer', kind: 'bow', lvl: 1, dmg: 1.0, spd: 1.0 },
    { id: 'recurve', name: 'Recurve Bow', cls: 'archer', kind: 'bow', lvl: 3, dmg: 1.05, spd: 1.1 },
    { id: 'longbow', name: 'Longbow', cls: 'archer', kind: 'bow', lvl: 5, dmg: 1.4, spd: 0.75 },
    { id: 'composite', name: 'Composite Bow', cls: 'archer', kind: 'bow', lvl: 6, dmg: 1.15, spd: 1.05 },
    { id: 'reedbow', name: 'Reedwhistle Bow', cls: 'archer', kind: 'bow', lvl: 8, dmg: 0.95, spd: 1.4 },
    { id: 'galebow', name: 'Galestring', cls: 'archer', kind: 'bow', lvl: 13, dmg: 1.15, spd: 1.25 },
    // Witch
    { id: 'twigwand', name: 'Twig Wand', cls: 'witch', kind: 'wand', lvl: 1, dmg: 0.85, spd: 1.2 },
    { id: 'acornstaff', name: 'Acorn Staff', cls: 'witch', kind: 'staff', lvl: 1, dmg: 1.0, spd: 1.0 },
    { id: 'crookstaff', name: 'Crooked Staff', cls: 'witch', kind: 'staff', lvl: 3, dmg: 1.1, spd: 0.95 },
    { id: 'shroomwand', name: 'Toadstool Wand', cls: 'witch', kind: 'wand', lvl: 4, dmg: 0.9, spd: 1.35 },
    { id: 'candlestaff', name: 'Candle Staff', cls: 'witch', kind: 'staff', lvl: 6, dmg: 1.2, spd: 0.95 },
    { id: 'starstaff', name: 'Starfall Staff', cls: 'witch', kind: 'staff', lvl: 16, dmg: 1.4, spd: 0.95 },
  ];

  let candidateBases = baseCatalog.filter(b => (!cls || b.cls === cls) && b.lvl <= level + 2);
  if (!candidateBases.length) candidateBases = baseCatalog.filter(b => !cls || b.cls === cls);
  if (!candidateBases.length) candidateBases = baseCatalog;

  const base = (baseId && baseCatalog.find(b => b.id === baseId)) ||
    candidateBases[Math.floor(randomFn() * candidateBases.length)];

  // Affix pool compatible with this weapon kind
  const compatibleKeys = Object.keys(AFFIX_DEFINITIONS).filter(k => {
    const a = AFFIX_DEFINITIONS[k];
    if (a.kinds && !a.kinds.includes(base.kind)) return false;
    if (a.classAffinity && a.classAffinity !== base.cls) return false;
    return true;
  });

  const count = affixCount !== null ? affixCount : Math.min(4, Math.max(1, 1 + Math.floor(randomFn() * 3)));
  const shuffledKeys = [...compatibleKeys].sort(() => randomFn() - 0.5);
  const chosenKeys = shuffledKeys.slice(0, Math.min(count, shuffledKeys.length));

  // Determine tiers for each chosen affix
  // If targetTier was requested, guarantee at least one affix has it
  const rolledAffixes = [];
  const targetApplied = !targetTier;

  for (let i = 0; i < chosenKeys.length; i++) {
    const k = chosenKeys[i];
    const def = AFFIX_DEFINITIONS[k];
    let tier;
    if (!targetApplied && (i === chosenKeys.length - 1 || randomFn() < 0.5)) {
      tier = AFFIX_RARITY_TIERS[targetTier] || rollAffixTier({ randomFn });
    } else {
      tier = rollAffixTier({ randomFn });
    }
    const instance = rollAffixInstance(def, tier, level, randomFn);
    rolledAffixes.push(instance);
  }

  // Base stats computation
  const ilvl = Math.max(1, level);
  const unitPower = 6 * (1 + 0.3 * (ilvl - 1));
  const avgDmg = unitPower * base.dmg * (1 + 0.05 * rolledAffixes.length);
  const minDmg = Math.max(1, Math.round(avgDmg * 0.8));
  const maxDmg = Math.max(minDmg + 1, Math.round(avgDmg * 1.2));

  // Aggregate stats map
  const stats = {};
  for (const aff of rolledAffixes) {
    stats[aff.id] = (stats[aff.id] || 0) + aff.actualRoll;
  }

  // Highest affix tier determines overall showcase aura/glow
  const highestTier = rolledAffixes.reduce((prev, curr) => curr.tierIndex > prev.tierIndex ? curr : prev, rolledAffixes[0]);

  // Overall item rarity tier for save contract compatibility (0..4)
  // Legacy schema: 0 = Common, 1 = Uncommon, 2 = Rare, 3 = Epic, 4 = Legendary
  const itemRarityTier = Math.min(4, Math.max(0, Math.floor(highestTier.tierIndex * 4 / 7)));

  // Build name with prefix based on highest affix
  const prefix = highestTier.tierIndex >= 7 ? 'Prismatic' :
    highestTier.tierIndex >= 6 ? 'Mythic' :
    highestTier.tierIndex >= 5 ? 'Relic' :
    highestTier.name;
  const name = `${prefix} ${base.name}`;

  const weapon = {
    base: base.id,
    name,
    slot: 'weapon',
    kind: base.kind,
    cls: base.cls,
    ilvl,
    r: itemRarityTier,
    min: minDmg,
    max: maxDmg,
    spd: base.spd,
    stats,
    affixes: rolledAffixes.map(a => a.id),
    rolledAffixes,
    highestAffixTier: highestTier.id,
    highestAffixToken: highestTier.displayToken,
    highestAffixColor: highestTier.displayColor,
    valuationTotal: rolledAffixes.reduce((sum, a) => sum + (a.valuation?.score || 0), 0),
  };

  return weapon;
}

/**
 * Formats an affix line for display in UI tooltips or console output.
 */
export function formatAffixSummary(affix) {
  const sign = affix.actualRoll > 0 ? '+' : '';
  const qual = affix.qualitative ? ` ★ [${affix.qualitative.name}]` : '';
  return `${affix.displayToken} ${affix.name}: ${sign}${affix.actualRoll}${affix.unit} (${affix.tierName})${qual}`;
}
