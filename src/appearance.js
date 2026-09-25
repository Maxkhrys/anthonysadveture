// Character-owned cosmetics. Stable IDs, additive to the existing inventory schema.
export const OPTIONS = {
  frame: ['balanced', 'slender', 'broad', 'compact', 'tall'],
  face: ['soft', 'angular', 'round', 'long'],
  skin: ['#f3cda9', '#e5b18b', '#c88d64', '#a66c49', '#784a35', '#4d3028', '#d9b39b', '#b78061'],
  hair: ['tousled', 'cropped', 'swept', 'topknot', 'ponytail', 'braided', 'shaved', 'undercut', 'curly', 'long'],
  hairColor: ['#28201e', '#513222', '#875335', '#ba8446', '#d8bb80', '#d5cec0', '#783c32', '#596557'],
  beard: ['none', 'stubble', 'short', 'full', 'moustache', 'forked'],
  eyes: ['#5d814e', '#6394a3', '#986b36', '#4a3430', '#a59c78', '#77618a'],
  detail: ['none', 'scar', 'freckles', 'warpaint', 'runes'],
};
export const FRAMES = { balanced: [1,1,1], slender: [.9,1.04,.92], broad: [1.13,1,1.07], compact: [1.04,.91,1.02], tall: [.96,1.12,.96] };
export function normalizeAppearance(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(Object.entries(OPTIONS).map(([key, values]) => [key, values.includes(a[key]) ? a[key] : values[0]]));
}
export function randomAppearance(random = Math.random) {
  return Object.fromEntries(Object.entries(OPTIONS).map(([key, values]) => [key, values[Math.min(values.length - 1, Math.floor(random() * values.length))]]));
}
