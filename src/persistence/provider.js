import { SCHEMA_VERSION, copy, createProfile, migrateSave, normalizeCharacter } from './model.js';

// This key is a permanent compatibility contract, NOT a build/schema version.
export const SAVE_KEY = 'mossling-save-v2';
export const BACKUP_KEY = SAVE_KEY + ':backup';
export const LEGACY_KEY = SAVE_KEY + ':legacy';
export const RECOVERY_KEY = SAVE_KEY + ':recovery';

/** SaveProvider contract: implementations may return values or Promises.
 * loadCharacters(): Character[]
 * createCharacter({name, classId, inventory}): Character
 * saveCharacter(character): Character (revision checked, class immutable)
 * deleteCharacter(id, expectedRevision): void
 * Gameplay always awaits these operations. Cloud implementations must enforce
 * authenticated ownership, revisions and item uniqueness on the server.
 */
export class SaveProvider {
  loadCharacters() { throw new Error('Not implemented'); }
  createCharacter() { throw new Error('Not implemented'); }
  saveCharacter() { throw new Error('Not implemented'); }
  deleteCharacter() { throw new Error('Not implemented'); }
}

export class LocalSaveProvider extends SaveProvider {
  constructor(storage) { super(); this.storage = storage; this.notice = ''; this.blocked = false; }
  read() {
    if (this.blocked) throw new Error('Save recovery required. Export the stored data before continuing.');
    const raw = this.storage.getItem(SAVE_KEY);
    if (raw === null) {
      if (this.storage.getItem(BACKUP_KEY) !== null) return this.recover('');
      return { schemaVersion: SCHEMA_VERSION, characters: [] };
    }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return this.recover(raw); }
    // A newer/unsupported schema is NEVER replaced by an older backup.
    if (parsed?.schemaVersion !== undefined && ![2, 3, SCHEMA_VERSION].includes(parsed.schemaVersion)) {
      this.blocked = true; throw new Error('This save needs a different game version. Original data retained.');
    }
    let data;
    try { data = migrateSave(parsed); }
    catch { return this.recover(raw); }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      if (!this.storage.getItem(LEGACY_KEY)) this.storage.setItem(LEGACY_KEY, raw);
      this.write(data, raw);
      this.notice = 'Existing adventure migrated. Original save backed up.';
    }
    return data;
  }
  recover(raw) {
    let data;
    try { data = migrateSave(JSON.parse(this.storage.getItem(BACKUP_KEY))); }
    catch {
      this.blocked = true;
      throw new Error('Save is damaged and no valid backup is available. Original data retained; export it for recovery.');
    }
    // Quarantine the exact damaged bytes before replacing anything. If storage is
    // full, fail closed instead of destroying the only copy.
    this.storage.setItem(RECOVERY_KEY + ':' + globalThis.crypto.randomUUID(), raw);
    this.storage.setItem(SAVE_KEY, JSON.stringify(data));
    this.notice = 'Recovered the previous save from backup. The damaged copy is retained.';
    return data;
  }
  write(data, previous = this.storage.getItem(SAVE_KEY)) {
    const valid = migrateSave(data);
    this.storage.setItem(BACKUP_KEY, previous ?? JSON.stringify(valid));
    this.storage.setItem(SAVE_KEY, JSON.stringify(valid));
  }
  loadCharacters() { return copy(this.read().characters); }
  createCharacter(options) {
    const data = this.read(), p = createProfile(options);
    p.revision = 1;
    data.characters.push(p); this.write(data); return copy(p);
  }
  saveCharacter(character) {
    const data = this.read(), index = data.characters.findIndex(p => p.id === character.id);
    if (index < 0) throw new Error('Character was deleted; reload before saving.');
    const previous = data.characters[index];
    if (previous.revision !== character.revision) throw new Error('Character changed in another tab. Reload before saving.');
    if (previous.classId !== character.classId) throw new Error('Character class is locked.');
    const p = normalizeCharacter(character);
    p.revision++; p.updatedAt = new Date().toISOString();
    data.characters[index] = p; this.write(data); return copy(p);
  }
  deleteCharacter(id, expectedRevision) {
    const data = this.read(), p = data.characters.find(p => p.id === id);
    if (!p) throw new Error('Character not found');
    if (p.revision !== expectedRevision) throw new Error('Character changed; reload before deleting.');
    data.characters = data.characters.filter(p => p.id !== id); this.write(data);
  }
  exportRecovery() {
    const out = {};
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key === SAVE_KEY || key.startsWith(SAVE_KEY + ':')) out[key] = this.storage.getItem(key);
    }
    return out;
  }
}
