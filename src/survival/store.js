// Survival saves: their own storage key and schema, separate from story characters
// (mossling-save-v2) and the MOSSDEV lab. A survival world never reads or writes story data.
//
// A world record keeps the seed and generator version it was created with, plus everything the
// player changed: removed nodes, placed structures and chest contents, resources, discovered
// places and explored chunks, cave state, the character and where they stand. Loading never
// regenerates player changes from the seed.
import { GEN_VERSION } from './biome.js';
import { CLASSES } from '../rpg/classes.js';

export const SURVIVAL_KEY = 'mossling-survival-v1';
export const SURVIVAL_SCHEMA = 1;
export const RESOURCES = ['wood', 'stone', 'fibre', 'ore', 'crystal'];
export const WORLD_LIMIT = 8;

export const newSeed = () => (Math.floor(Math.random() * 2147483646) + 1);
export function seedFromText(text) {
  const t = String(text || '').trim(); if (!t) return newSeed();
  if (/^\d{1,10}$/.test(t)) return (Number(t) % 2147483646) + 1;
  let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 2147483646) + 1;
}
export function newWorld({ name, cls, seed }) {
  const now = new Date().toISOString();
  return {
    id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    schema: SURVIVAL_SCHEMA, genVersion: GEN_VERSION, seed, name: String(name || 'Wild World').trim().slice(0, 28) || 'Wild World',
    createdAt: now, updatedAt: now, playTime: 0,
    character: { cls, inv: null },      // inv: the full inventory snapshot once play starts
    pos: { area: 'wilds', x: null, z: null }, home: null,
    resources: Object.fromEntries(RESOURCES.map(r => [r, 0])),
    removed: {},                        // node id -> true (felled trees, mined rocks)
    structures: [],                     // {id, type, x, z, lv?, r?, open?}  (lv: storey, r: quarter turns)
    houses: {},                         // generated house id -> {removed:{pieceId:true}, open:{pieceId:bool}, suppressed?}
    storage: {},                        // structure id -> {resource: n}
    opened: {},                         // loot chests already opened
    discovered: {},                     // poi id -> {type, x, z, name}
    explored: [],                       // chunk keys seen
    caves: {},                          // cave id -> {cleared, removed:{}, chest}
    hints: { step: 0, done: false },
  };
}
// Accepts older/partial records: fills fields, keeps unknown ones, never discards player changes.
export function normalizeWorld(w) {
  if (!w || typeof w !== 'object' || !Number.isInteger(w.seed) || !w.id) throw new Error('Malformed survival world');
  const base = newWorld({ name: w.name, cls: w.character?.cls || 'samurai', seed: w.seed });
  const out = { ...base, ...w, character: { ...base.character, ...(w.character || {}) }, resources: { ...base.resources, ...(w.resources || {}) }, hints: { ...base.hints, ...(w.hints || {}) } };
  if (!CLASSES[out.character.cls]) out.character.cls = 'samurai';
  for (const r of RESOURCES) out.resources[r] = Math.max(0, Math.floor(+out.resources[r] || 0));
  if (!Array.isArray(out.structures)) out.structures = [];
  // pieces from before modular houses have no level or rotation: they are ground-floor, unturned.
  // A record that cannot be rebuilt (no type or position) is set aside, never deleted.
  const keep = [], broken = [];
  out.structures.forEach((s, i) => {
    if (!s || typeof s !== 'object' || typeof s.type !== 'string' || !Number.isFinite(+s.x) || !Number.isFinite(+s.z)) { broken.push(s); return; }
    const o = { ...s, x: +s.x, z: +s.z, id: s.id ? String(s.id) : 'old' + i };
    const lv = Math.max(0, Math.min(2, Math.floor(+o.lv || 0))), r = ((Math.floor(+o.r || 0) % 4) + 4) % 4;
    if (lv) o.lv = lv; else delete o.lv; if (r) o.r = r; else delete o.r;
    if (o.open !== undefined) o.open = !!o.open;
    keep.push(o);
  });
  out.structures = keep; if (broken.length) out.brokenStructures = [...(Array.isArray(w.brokenStructures) ? w.brokenStructures : []), ...broken];
  if (!out.houses || typeof out.houses !== 'object' || Array.isArray(out.houses)) out.houses = {};
  if (out.kits && typeof out.kits === 'object') for (const k of Object.keys(out.kits)) out.kits[k] = Math.max(0, Math.floor(+out.kits[k] || 0));
  if (out.pos && out.pos.fy !== undefined) out.pos = { ...out.pos, fy: Math.max(0, Math.min(8, +out.pos.fy || 0)) };
  if (!Array.isArray(out.explored)) out.explored = [];
  out.genVersion ??= 1; // older than versioning: the first generator
  return out;
}

export class SurvivalStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; this.notice = ''; }
  read() {
    let raw = null; try { raw = this.storage.getItem(SURVIVAL_KEY); } catch (e) { return { schema: SURVIVAL_SCHEMA, worlds: [] }; }
    if (!raw) return { schema: SURVIVAL_SCHEMA, worlds: [] };
    try {
      const d = JSON.parse(raw); const worlds = [];
      for (const w of d.worlds || []) { try { worlds.push(normalizeWorld(w)); } catch (e) { this.notice = 'One survival world could not be read and was kept aside.'; this.quarantine(w); } }
      return { schema: SURVIVAL_SCHEMA, worlds };
    } catch (e) { this.quarantine(raw); this.notice = 'Survival saves could not be read; the original data was kept aside.'; return { schema: SURVIVAL_SCHEMA, worlds: [] }; }
  }
  quarantine(x) { try { this.storage.setItem(SURVIVAL_KEY + ':damaged:' + Date.now(), typeof x === 'string' ? x : JSON.stringify(x)); } catch (e) {} }
  write(d) { this.storage.setItem(SURVIVAL_KEY, JSON.stringify({ schema: SURVIVAL_SCHEMA, worlds: d.worlds })); }
  list() { return this.read().worlds; }
  get(id) { return this.read().worlds.find(w => w.id === id) || null; }
  create(opts) { const d = this.read(); if (d.worlds.length >= WORLD_LIMIT) throw new Error('You can keep up to ' + WORLD_LIMIT + ' survival worlds. Delete one first.'); const w = newWorld(opts); d.worlds.unshift(w); this.write(d); return w; }
  save(w) { const d = this.read(), i = d.worlds.findIndex(x => x.id === w.id); w.updatedAt = new Date().toISOString(); if (i < 0) d.worlds.unshift(w); else d.worlds[i] = w; this.write(d); return w; }
  delete(id) { const d = this.read(); d.worlds = d.worlds.filter(w => w.id !== id); this.write(d); }
  export() { return JSON.stringify({ mosslingSurvival: SURVIVAL_SCHEMA, worlds: this.read().worlds }, null, 1); }
}
