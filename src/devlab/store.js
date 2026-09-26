// MOSSDEV lab storage. A separate, independently versioned developer profile in its own
// localStorage key: it never shares a key, a provider or a character record with adventures.
//
// What is stored is the test SETUP (class, level, exact item rolls, skill ranks, arena, cheats,
// presets), never live scene objects. Enemies, projectiles and effects are rebuilt from it.
import { CLASSES, MAX_LEVEL } from '../rpg/classes.js';
import { nodeById } from '../rpg/skills.js';
import { baseById } from '../rpg/items.js';
import { EQUIPMENT_SLOTS, copy, identifyItem } from '../persistence/model.js';

export const DEVLAB_KEY = 'mossling-devlab-v1';
export const DEVLAB_VERSION = 1;
export const ARENAS = ['dummy', 'crowd', 'elite', 'boss', 'element', 'loot', 'vfx'];
const TRAY_LIMIT = 120, PRESET_LIMIT = 40;

export const CHEAT_DEFAULTS = Object.freeze({ god: false, infRes: false, infAmmo: false, speed: 1, ignoreRestrictions: false });
export function defaultProfile(cls = 'samurai') {
  return { cls, level: 12, equip: {}, tree: null, loadout: null, cheats: { ...CHEAT_DEFAULTS }, arena: 'dummy',
    arenaOpts: { dummyMove: false, dummyArmour: false, crowdSize: 10, crowdKinds: ['blot', 'beetle', 'brigand'], eliteKind: 'knight', eliteMod: 'Brutal', element: 'all' },
    seed: 1234, tray: [], note: '' };
}
export function defaultStore() { return { version: DEVLAB_VERSION, active: false, returnTo: null, profile: defaultProfile(), presets: [], lastTest: null, updatedAt: null }; }

// ------------------------------------------------------------------ validation
// the game's own item validation (identifyItem) on a copy, plus a known base
const isItem = it => { try { return !!(it && typeof it === 'object' && baseById(it.base) && identifyItem(copy(it))); } catch (e) { return false; } };
export function validateProfile(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return { ok: false, errors: ['Profile is not an object.'] };
  if (!CLASSES[p.cls]) errors.push('Unknown class: ' + p.cls);
  if (!Number.isInteger(p.level) || p.level < 1 || p.level > MAX_LEVEL) errors.push('Level must be 1–' + MAX_LEVEL + '.');
  if (p.equip && typeof p.equip === 'object') for (const [slot, it] of Object.entries(p.equip)) {
    if (!EQUIPMENT_SLOTS.includes(slot)) errors.push('Unknown equipment slot: ' + slot);
    else if (it && !isItem(it)) errors.push('Equipment in ' + slot + ' is not a valid item.');
  } else errors.push('Equipment must be an object.');
  if (p.tree != null) { if (typeof p.tree !== 'object') errors.push('Skill ranks must be an object.'); else for (const id of Object.keys(p.tree)) if (!nodeById(id)) errors.push('Unknown skill node: ' + id); }
  if (!ARENAS.includes(p.arena)) errors.push('Unknown arena: ' + p.arena);
  if (p.tray && (!Array.isArray(p.tray) || p.tray.some(it => !isItem(it)))) errors.push('Lab tray holds an invalid item.');
  return { ok: !errors.length, errors };
}
// Fill defaults for missing optional fields; never invent items.
export function normalizeProfile(p) {
  const d = defaultProfile(p.cls);
  return { ...d, ...copy(p), cheats: { ...CHEAT_DEFAULTS, ...(p.cheats || {}) }, arenaOpts: { ...d.arenaOpts, ...(p.arenaOpts || {}) }, tray: (p.tray || []).slice(0, TRAY_LIMIT), equip: copy(p.equip || {}) };
}

// ------------------------------------------------------------------ store
export class DevLabStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; this.data = this.read(); }
  read() {
    let raw = null;
    try { raw = this.storage.getItem(DEVLAB_KEY); } catch (e) { return defaultStore(); }
    if (!raw) return defaultStore();
    try {
      const d = JSON.parse(raw);
      if (d.version !== DEVLAB_VERSION) throw new Error('version');
      const v = validateProfile(d.profile);
      if (!v.ok) throw new Error(v.errors.join(' '));
      d.profile = normalizeProfile(d.profile);
      d.presets = (d.presets || []).filter(x => x && validateProfile(x.profile).ok).map(x => ({ ...x, profile: normalizeProfile(x.profile) }));
      return { ...defaultStore(), ...d };
    } catch (e) {
      // a damaged developer profile is kept aside, never silently discarded, and never touches adventures
      try { this.storage.setItem(DEVLAB_KEY + ':damaged', raw); } catch (e2) {}
      const fresh = defaultStore(); fresh.recovered = 'The saved lab setup could not be read; a fresh lab was started. The old copy is kept under ' + DEVLAB_KEY + ':damaged.';
      return fresh;
    }
  }
  write() { this.data.updatedAt = new Date().toISOString(); try { this.storage.setItem(DEVLAB_KEY, JSON.stringify(this.data)); return true; } catch (e) { return false; } }
  get profile() { return this.data.profile; }
  setProfile(p) { const v = validateProfile(p); if (!v.ok) return v; this.data.profile = normalizeProfile(p); this.write(); return v; }
  // ---- presets (saved tests)
  savePreset(name, profile = this.data.profile) {
    const v = validateProfile(profile); if (!v.ok) return { ok: false, errors: v.errors };
    const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    this.data.presets.unshift({ id, name: String(name || 'Saved test').slice(0, 60), createdAt: new Date().toISOString(), profile: normalizeProfile(profile) });
    this.data.presets = this.data.presets.slice(0, PRESET_LIMIT); this.write(); return { ok: true, id };
  }
  deletePreset(id) { this.data.presets = this.data.presets.filter(p => p.id !== id); this.write(); }
  exportPreset(id) { const p = this.data.presets.find(p => p.id === id); return p ? JSON.stringify({ mossdevPreset: DEVLAB_VERSION, name: p.name, profile: p.profile }, null, 1) : null; }
  importPreset(text) {
    let d; try { d = JSON.parse(text); } catch (e) { return { ok: false, errors: ['Not valid JSON.'] }; }
    if (!d || d.mossdevPreset !== DEVLAB_VERSION) return { ok: false, errors: ['Not a MOSSDEV preset (version ' + DEVLAB_VERSION + ').'] };
    return this.savePreset(d.name || 'Imported test', d.profile);
  }
  // ---- tray: overflow and loot samples live here, never in the adventure bag
  addToTray(items) { const t = this.data.profile.tray; for (const it of [].concat(items)) t.unshift(copy(it)); t.length = Math.min(t.length, TRAY_LIMIT); this.write(); }
}
