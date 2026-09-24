# Stat & Affix Rarity Foundation

A data-driven rarity architecture for individual stat rolls in Mossling.

---

## 1. Architectural Philosophy

### Separation of Item Rarity vs. Stat-Roll Rarity

In baseline RPG systems, an item typically possesses a single global rarity (e.g. Rare, Legendary) which dictates all stats uniformly. In Mossling's Stat/Affix Rarity Foundation:
- **Item Rarity** represents the overall chassis and socket capacity of the gear (`r`: 0 to 4 in current save contracts).
- **Stat-Roll Rarity** operates independently on **each individual affix socket**.

A weapon can hold multiple affixes across differing rarity tiers. For example:
```
Windwhisper Bow (Item Level 10)
  • ◈ Crit Chance: +8.5% [Rare]
  • ✪ Attack Speed: +22.0% [Legendary]
  • 🗲 Echo Damage: +48.5% [Mythic] ★ [Resonance Echo]
  • ◇ Projectile Size: +7.2% [Common]
```

This decoupled foundation fulfills the player desire for exhilarating "chase rolls" where discovering an ultra-rare affix on an everyday or mid-tier weapon creates unexpected, exciting gameplay variance.

---

## 2. Rarity Tier Hierarchy & Weighting Structure

The foundation specifies eight distinct rarity tiers. To ensure precision when configuring ultra-rare tiers, probabilities are configured across an integer weight budget of **1,000,000 weights**.

### Configured Probabilities & Roll Multipliers

| Tier Index | Tier ID | Tier Name | Token | Color | Weight | Probability | Roll Multiplier | Trade Weight | Role / Purpose |
|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| 0 | `common` | Common | `◇` | `#d0c8b8` | 500,000 | 50.0000% | 0.70× – 0.90× | 1 | Foundational rolls providing baseline utility. |
| 1 | `uncommon` | Uncommon | `◆` | `#6fdc5a` | 280,000 | 28.0000% | 0.90× – 1.15× | 3 | Polished rolls with solid numerical performance. |
| 2 | `rare` | Rare | `◈` | `#4aa8ff` | 135,000 | 13.5000% | 1.15× – 1.45× | 10 | High-grade rolls noticeably elevating gear efficiency. |
| 3 | `epic` | Epic | `★` | `#c46bff` | 60,000 | 6.0000% | 1.45× – 1.85× | 35 | Exceptional rolls bordering masterwork craftsmanship. |
| 4 | `legendary` | Legendary | `✪` | `#ff9a2a` | 18,000 | 1.8000% | 1.85× – 2.30× | 120 | Elite rolls that shape entire character builds. |
| 5 | `relic` | Relic | `✦` | `#ff4a6a` | 5,500 | 0.5500% (~1:182) | 2.30× – 2.80× | 500 | Ancient resonant rolls offering profound enhancements. |
| 6 | `mythic` | Mythic | `🗲` | `#e040fb` | 1,400 | 0.1400% (~1:714) | 2.80× – 3.40× | 2,500 | Mythological rolls introducing potent qualitative triggers. |
| 7 | `prismatic` | Prismatic | `🌈` | `#ffd700` | 100 | 0.0100% (~1:10,000) | 3.40× – 4.20× | 30,000 | Extraordinarily rare chase roll with transformative qualitative anomalies. |

### Modeling Assumptions & Economy Safeguards
1. **The ~0.01% Extreme Chase Target**:
   Prismatic rarity is allocated exactly 100 out of 1,000,000 weights (0.0100%, or 1 in 10,000 individual rolls). A player generating 4-affix weapons will see a Prismatic roll approximately once every 2,500 weapons inspected.
2. **Power Scaling Ceiling**:
   A Prismatic roll grants at most 3.40× to 4.20× the base affix potency. It does **not** grant 50× or 100× multipliers, preventing single affixes from trivializing boss health pools or completely breaking combat balance.
3. **No Save Schema Alterations**:
   Rolled affixes and metadata reside as standard properties (`rolledAffixes`, `affixes: string[]`) that round-trip safely through existing `identifyItem()` and persistence snapshot serialization.

---

## 3. Qualitative Modifiers for Ultra-Rare Tiers

To prevent extreme rolls from becoming boring raw numerical inflation, Relic, Mythic, and Prismatic affixes can manifest **Qualitative Modifiers**. These introduce unique mechanical combat behaviors rather than simply larger damage figures:

| Modifier ID | Display Name | Minimum Tier | Trigger Hook | Mechanical Behavior |
|:---|:---|:---:|:---:|:---|
| `resonance_echo` | **Resonance Echo** | Mythic | `on_attack` | Attacks evoke a ghostly duplicate 0.8s later dealing 40% echo damage. |
| `prismatic_splinters` | **Prismatic Splinters** | Prismatic | `on_crit` | Critical hits shatter into 3 spectrum needles seeking nearby foes. |
| `singularity_wake` | **Singularity Wake** | Mythic | `on_projectile` | Projectiles create a vortex trail gently pulling nearby foes toward their path. |
| `temporal_stride` | **Temporal Stride** | Relic | `on_dodge` | Dodging through an attack triggers a brief 0.6s stasis field around the attacker. |
| `vital_dewdrop` | **Vital Dewdrop** | Relic | `on_overheal` | Overhealing condenses into a healing dewdrop on the ground for allies or self. |
| `elemental_convergence` | **Elemental Convergence** | Mythic | `on_status_cross` | Chilled foes struck by burning attacks trigger a concussive steam rupture. |
| `astral_step` | **Astral Step** | Prismatic | `on_roll` | Rolling phases completely through solid geometry and leaves a stellar nebula. |
| `executioners_toll` | **Toll of the Dawnbell** | Prismatic | `on_low_health_hit` | Strikes against foes below 20% life resonate a bell toll dealing instant true damage. |

---

## 4. Affix Instance Metadata Schema

Every generated affix possesses structured metadata adhering to this contract:

```typescript
interface RolledAffixInstance {
  id: string;                          // Unique stat key (e.g. 'crit', 'atkSpd', 'echoDmg')
  name: string;                        // Human-readable title (e.g. 'Crit Chance')
  unit: string;                        // Display suffix ('%' or empty for flat values)
  tier: string;                        // Tier identifier ('common' .. 'prismatic')
  tierName: string;                    // Capitalized name ('Rare', 'Mythic')
  tierIndex: number;                   // Ordinal tier position (0 to 7)
  displayToken: string;                // Icon symbol ('◇', '◆', '◈', '★', '✪', '✦', '🗲', '🌈')
  displayColor: string;                // Hex color string ('#4aa8ff', '#e040fb', etc.)
  rollRange: [number, number];         // Theoretical roll bounds for this level and tier
  actualRoll: number;                  // Rolled numerical value
  effectiveMultiplier: number;         // Multiplier applied to base roll
  weight: number;                      // Affix selection weight within pool
  compatibleItemTypes: string[];       // Item types eligible for this roll ('katana', 'bow', 'staff')
  classAffinity: string | null;        // Class restriction if applicable ('samurai', 'archer', 'witch')
  levelRequirement: number;            // Minimum character/item level required
  scalingFormula: string;              // Mathematical formula string
  sources: string[];                   // Origin flags ('natural', 'crafted', 'boss')
  qualitative: QualitativeMod | null;  // Qualitative effect descriptor (if triggered)
  valuation: TradeValuationHook;       // Pre-computed trade appraisal metrics
}
```

---

## 5. Future Trading & Economy Valuation Hooks

While player trading, auction houses, and marketplaces are strictly excluded from this implementation, the system pre-computes an appraisal valuation hook for every rolled affix and composite item:

```typescript
interface TradeValuationHook {
  score: number;                       // Cumulative appraisal score
  tierWeight: number;                  // Base multiplier from tier rarity (1 to 30,000)
  rollPerfection: number;              // Percentage within the tier's roll range (0% to 100%)
  marketTier: string;                  // Economy bracket ('Standard', 'High Value', 'Chase')
  chaseBonus: boolean;                 // Whether rare qualitative modifier is present
}
```

### Valuation Rules
- Base value scales with item level and tier weight: `(10 + level * 5) * tier.tradeWeight`.
- A roll at 98% of its theoretical max roll gains up to +35% appraisal bonus.
- Qualitative modifiers award an additional +50% appraisal prestige bonus.
- No client-side wallet, player-to-player transaction, or persistent market state is minted.

---

## 6. Simulation & Statistical Verification

To verify that the probability distribution functions as designed under volume without risking player saves, a dedicated simulation engine (`src/rpg/affix_simulation.js`) and runner (`tests/affix_simulation.mjs`) were constructed.

### 1,000,000 Virtual Roll Simulation Results

```
========================================================================================
  MOSSLING AFFIX RARITY SIMULATION REPORT (1,000,000 VIRTUAL ROLLS)
  Execution Time: 28ms (35,714,286 rolls/sec) | Save Mutation: NONE
========================================================================================
| Tier         | Weight    | Expected % | Expected Qty | Observed Qty | Observed % | Delta %  | z-Score |
|--------------|-----------|------------|--------------|--------------|------------|----------|---------|
| ◇ Common     |   500,000 |   50.0000% |      500,000 |      500,073 |   50.0073% |   +0.01% |   +0.15 |
| ◆ Uncommon   |   280,000 |   28.0000% |      280,000 |      279,744 |   27.9744% |   -0.09% |   -0.57 |
| ◈ Rare       |   135,000 |   13.5000% |      135,000 |      135,054 |   13.5054% |   +0.04% |   +0.16 |
| ★ Epic       |    60,000 |    6.0000% |       60,000 |       59,909 |    5.9909% |   -0.15% |   -0.38 |
| ✪ Legendary  |    18,000 |    1.8000% |       18,000 |       18,209 |    1.8209% |   +1.16% |   +1.57 |
| ✦ Relic      |     5,500 |    0.5500% |        5,500 |        5,535 |    0.5535% |   +0.64% |   +0.47 |
| 🗲 Mythic    |     1,400 |    0.1400% |        1,400 |        1,373 |    0.1373% |   -1.93% |   -0.72 |
| 🌈 Prismatic |       100 |    0.0100% |          100 |          103 |    0.0103% |   +3.00% |   +0.30 |
----------------------------------------------------------------------------------------
  Extreme Chase Tier (Prismatic 🌈 ~0.01% target): 103 rolls observed (0.0103%)
========================================================================================
```

### Statistical Observations
- **Prismatic Chase Accuracy**: 103 observed occurrences out of 1,000,000 rolls (0.0103% vs theoretical 0.0100%), yielding a $z$-score of $+0.30$.
- **All Tiers Within Bounds**: All 8 tiers fall within $|z| < 2.0$, proving that the discrete weight partition accurately matches expected binomial distributions across massive sample sizes.
- **Safety Guarantee**: The simulation operates strictly in volatile memory. No browser storage, indexed files, or profile records are mutated during simulation runs.
