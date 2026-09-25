// Pass 6: a stable world seed per character, and the manifest of optional content it picks.
//
// The seed never changes. The manifest is generated once (at character creation, or when an
// older save is first loaded) and stored with the character, so the same character always
// meets the same camps, rare elites, merchants, events and cave mouths, and a later change to
// the generator can never move something already found. A new GENERATION_VERSION only
// applies to characters created after it (or through an explicit future migration).
import { ANCHORS } from './anchors.js';
import { POOLS, REGION_MATS, RARE_FIRST, RARE_LAST } from './encounters.js';

export const GENERATION_VERSION = 1;

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// mulberry32: small, fast, good enough for placement choices
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// older characters get a seed derived from their identity, so migration is deterministic
export const seedForId = id => (hashString('lanternreach:' + id) || 1) >>> 0;
export function randomSeed() {
  const c = globalThis.crypto;
  const v = c && c.getRandomValues ? c.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967295);
  return (v >>> 0) || 1;
}
export const validSeed = s => Number.isInteger(s) && s > 0 && s <= 4294967295;

export function generateManifest(seed, version = GENERATION_VERSION) {
  const R = seededRandom((seed ^ 0x9e3779b9) >>> 0);
  const pick = a => a[Math.floor(R() * a.length)];
  const pickN = (a, k) => { const c = a.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c.slice(0, k); };
  const at = a => (a.region ? { id: a.id, x: a.x, z: a.z, region: a.region } : { id: a.id, x: a.x, z: a.z }); // plain JSON (no undefined keys)
  const camps = pickN(ANCHORS.camps, 7).map(a => ({ ...at(a), kinds: Array.from({ length: 3 + Math.floor(R() * 3) }, () => pick(POOLS[a.region].camp)), elite: R() < 0.35 }));
  const rare = pickN(ANCHORS.rare, 10).map(a => { const kind = pick(POOLS[a.region].rare); return { ...at(a), kind, night: R() < 0.4, name: `${pick(RARE_FIRST)} ${RARE_LAST[kind] || 'Hushling'}` }; });
  const merchants = [{ id: 'pedlar', stops: pickN(ANCHORS.merchants, 4).map(at), offset: Math.floor(R() * 4) }];
  const E = ANCHORS.events;
  const events = { stars: pickN(E.star, 5).map(a => ({ id: a.id, x: a.x, z: a.z })), incursions: pickN(E.incursion, 4).map(a => ({ id: a.id, x: a.x, z: a.z })), procession: pick(E.procession), moths: pick(E.moths) };
  const caves = Object.fromEntries(Object.entries(ANCHORS.caves).map(([k, list]) => [k, at(pick(list))]));
  const pockets = pickN(ANCHORS.pockets, 8).map(a => ({ ...at(a), mat: pick(REGION_MATS[a.region]), n: 1 + Math.floor(R() * 2) }));
  return { version, seed, camps, rare, merchants, events, caves, pockets };
}

// The day number drives rotating optional content (which stop the pedlar is at, whether a
// star falls tonight). Same seed + same day = same answer.
export function dayRoll(seed, day, salt) { return seededRandom((seed ^ hashString(salt + ':' + day)) >>> 0)(); }
