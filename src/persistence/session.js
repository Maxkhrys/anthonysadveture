import { copy, identifyItem, normalizeCharacter, runtimeEquipment } from './model.js';

export function snapshotCharacter(g) {
  // Stamp runtime objects too: subsequent saves cannot manufacture new item IDs.
  for (const it of [...g.inv.bag, ...Object.values(g.inv.equip).filter(Boolean)]) identifyItem(it, g.profile.id);
  return normalizeCharacter({ ...g.profile, inventory: copy(g.inv), playTime: g.playTime,
    settings: { ...g.profile.settings, difficulty: g.settings.difficulty, guide: g.settings.guide },
    discoveredBellstones: copy(g.discoveredBellstones),
    world: { ...g.profile.world, flags: copy(g.flags), stats: copy(g.stats), checkpoint: copy(g.checkpoint),
      time: { ...g.profile.world.time, elapsedSeconds: g.time },
      dungeon: { ...g.profile.world.dungeon, riftFloor: g.riftFloor || 0, riftLevel: g.riftLevel || 0 },
      // Pass 6: what's been discovered and which world events left their mark
      ...(g.world6 ? { discovery: copy(g.world6.discovery), events: copy(g.world6.events) } : {}) },
  });
}

export function restoreCharacter(g, profile) {
  const p = normalizeCharacter(profile);
  g.profile = p; g.inv = copy(p.inventory); g.inv.equip = runtimeEquipment(g.inv.equip);
  g.flags = copy(p.world.flags); g.stats = copy(p.world.stats); g.checkpoint = copy(p.world.checkpoint);
  g.time = p.world.time.elapsedSeconds; g.playTime = p.playTime;
  g.riftFloor = p.world.dungeon.riftFloor; g.riftLevel = p.world.dungeon.riftLevel;
  g.discoveredBellstones = copy(p.discoveredBellstones);
  // Pass 6: the character's world (seed and generated optional content are read-only)
  g.world6 = { seed: p.world.seed, generationVersion: p.world.generationVersion, generated: copy(p.world.generated), discovery: copy(p.world.discovery), events: copy(p.world.events) };
  Object.assign(g.settings, p.settings);
}

// Serialize provider writes, including slow future cloud providers. A conflict
// stops subsequent writes until reload; failed writes never report success.
export class CharacterSession {
  constructor(provider, profile) { this.provider = provider; this.profile = copy(profile); this.pending = null; this.error = null; }
  save(snapshot) {
    const commit = () => {
      if (this.error) throw this.error;
      const result = this.provider.saveCharacter({ ...snapshot, revision: this.profile.revision });
      if (result?.then) return result.then(p => { this.profile = p; return p; });
      this.profile = result;
      return result;
    };
    // Local writes occur synchronously, including pagehide; cloud writes queue.
    try {
      const result = this.pending ? this.pending.then(commit) : commit();
      if (!result?.then) return Promise.resolve(result);
      const pending = result.catch(e => { this.error = e; throw e; });
      this.pending = pending;
      pending.then(() => { if (this.pending === pending) this.pending = null; }, () => {});
      return pending;
    } catch (e) { this.error = e; return Promise.reject(e); }
  }
}
