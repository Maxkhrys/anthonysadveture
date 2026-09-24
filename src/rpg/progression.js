// XP remains a separate, non-spendable progression value. This table retains the
// original curve exactly; existing levels and partial XP are never recomputed.
export const XP_PROGRESSION = Object.freeze({
  maxLevel: 30,
  thresholds: Object.freeze(Array.from({ length: 30 }, (_, i) => Math.round(30 * Math.pow(i + 1, 1.55) + 20))),
});
