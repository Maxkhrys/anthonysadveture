// MOSSDEV: the persistent developer test lab.
//
// Isolation. Entering from an adventure first saves that adventure, then swaps the game's
// character session for a sandbox session that can only write the developer profile
// (store.js, its own storage key). Nothing the lab does can reach an adventure save: test items,
// god mode, stats, boss flags and loot stay in the sandbox. Return to Adventure reloads the
// adventure character from its save provider and puts you back where you were.
//
// Persistence. The developer profile holds the test SETUP (class, level, exact item rolls, skill
// ranks, cheats, arena, presets). On refresh the lab is rebuilt from it; live enemies,
// projectiles and effects are never serialised.
import { DevLabStore, defaultProfile, validateProfile, normalizeProfile, ARENAS } from './store.js';
import { RECENT, manifestStatus } from './manifest.js';
import { buildMossLab } from './arena.js';
import { CLASSES, MAX_LEVEL, resLabel } from '../rpg/classes.js';
import { defaultInventory, createProfile, runtimeEquipment, copy, EQUIPMENT_SLOTS } from '../persistence/model.js';
import { restoreCharacter } from '../persistence/session.js';
import { starterWeapon, makeNamed, genItem, RARITY, baseById } from '../rpg/items.js';
import { treeOf, spentPoints, spendNode, respecTree, lockReason, PATHS, ensureTree, freeRanks } from '../rpg/skills.js';
import { eligible } from '../rpg/eligibility.js';
import { makeEnemy } from '../entities/enemies.js';
import { Boss } from '../entities/boss.js';
import { REGISTRY } from '../rpg/registry.js';
import { FIREARMS, isFirearm, completeReload } from '../rpg/firearms.js';
import { combatEvents } from '../rpg/combat_events.js';
import { Telemetry } from './telemetry.js';

export const ENEMY_KINDS = ['blot', 'beetle', 'puffer', 'wisp', 'knight', 'scorpion', 'imp', 'wraith', 'brigand', 'sporeling', 'treant', 'golem', 'mantis', 'slug', 'moth', 'porcelain', 'leech'];
export const ELEMENT_TARGETS = ['wet', 'burn', 'chill', 'freeze', 'shock', 'hex', 'mark'];
// Game rules mirrored from Game.scaleEnemy/makeElite: one modifier per enemy; bosses and the
// thief never become elite. Anything else is refused rather than faked.
export function eliteCompatible(kind, mod) {
  if (!REGISTRY.eliteModifiers.includes(mod)) return 'Unknown elite modifier.';
  if (!ENEMY_KINDS.includes(kind)) return 'Unknown enemy kind.';
  if (kind === 'thief') return 'The thief never spawns as an elite.';
  return '';
}
// A tiny seeded PRNG, used only while a test is being set up so it can be reproduced.
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function withSeed(seed, fn) { const r = Math.random; Math.random = mulberry(seed >>> 0); try { return fn(); } finally { Math.random = r; } }

// The lab's character session: saves only the developer profile, never an adventure.
class SandboxSession {
  constructor(lab) { this.lab = lab; this.profile = { revision: 0 }; }
  save() { this.lab.captureProfile(); this.profile.revision++; return Promise.resolve(this.profile); }
}

export class DevLab {
  constructor(g, storage) {
    this.g = g; this.store = new DevLabStore(storage); this.active = false; this.overlayOpen = false;
    this.telemetry = new Telemetry(g); this.targets = []; this.notice = this.store.data.recovered || '';
    this.hooked = false;
  }
  get profile() { return this.store.profile; }
  static enabled(g) { return !!(g.settings && g.settings.devMode); }

  // ---------------------------------------------------------------- enter / leave
  async enter({ copyAdventure = false } = {}) {
    const g = this.g;
    if (this.active) return true;
    if (g.profile && !g.sandbox) {
      // flush the adventure first; its save is never touched again while the lab is open
      await g.save();
      this.store.data.returnTo = { characterId: g.profile.id, name: g.profile.name, area: g.area && g.area.id, x: g.player && g.player.x, z: g.player && g.player.z };
      // the very first visit starts from a copy of the adventure character; after that the lab keeps its own setup
      if (copyAdventure || !this.store.data.seededFrom) this.copyFromAdventure();
    }
    if (!this.store.data.seededFrom) this.store.data.seededFrom = 'default';
    this.store.data.active = true; this.store.write();
    this.active = true; g.sandbox = true; g.devSandbox = true; g.devlab = this;
    this.hook();
    this.rebuild();
    return true;
  }
  // Start the lab from the title screen or after a refresh (no adventure to save first).
  async resume() { return this.enter(); }
  copyFromAdventure() {
    const g = this.g, inv = g.inv;
    const P = normalizeProfile({ ...this.profile, cls: inv.cls, level: inv.level, equip: Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, inv.equip[s] ? copy(inv.equip[s]) : null])), tree: copy(inv.tree || {}), loadout: copy(inv.loadout || null), bag: [] });
    this.store.data.profile = P; this.store.data.seededFrom = g.profile.id; this.store.write();
  }
  // read-only: the adventure's saved record is copied, never written
  async copyAdventureFromSave() {
    const back = this.store.data.returnTo; if (!back?.characterId || !this.g.saveProvider) return false;
    const all = await this.g.saveProvider.loadCharacters(), p = all.find(x => x.id === back.characterId); if (!p) return false;
    const inv = p.inventory;
    this.store.data.profile = normalizeProfile({ ...this.profile, cls: inv.cls, level: inv.level, equip: Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, inv.equip[s] ? copy(inv.equip[s]) : null])), tree: copy(inv.tree || {}), loadout: copy(inv.loadout || null), bag: [] });
    this.store.write(); this.clearTest(); this.rebuild(); return true;
  }
  async exit() {
    const g = this.g;
    if (!this.active) return false;
    this.clearTest();
    const back = this.store.data.returnTo;
    this.store.data.active = false; this.store.write();
    this.active = false; this.overlayOpen = false; g.sandbox = false; g.devSandbox = false; g.godMode = false;
    if (!back || !back.characterId) { g.characterSession = null; g.profile = null; if (this.onTitle) this.onTitle(); return true; }
    await g.load(back.characterId); // the adventure exactly as saved: nothing from the lab comes along
    g.checkpoint = copy(g.checkpoint);
    const spot = back.area && back.x != null ? { x: back.x, z: back.z } : g.checkpoint.spawn;
    g.loadArea(back.area || g.checkpoint.area, spot);
    g.ui.areaName(g.area.name); g.ui.updateHud();
    this.store.data.returnTo = null; this.store.write();
    return true;
  }

  // ---------------------------------------------------------------- build the test character
  // Rebuilds the sandbox character from the saved profile through the normal construction
  // path (a fresh inventory, normalised profile, restoreCharacter, recalc), then the arena.
  buildCharacter() {
    const g = this.g, P = this.profile;
    const inv = defaultInventory(P.cls);
    inv.level = Math.max(1, Math.min(MAX_LEVEL, P.level));
    inv.equip = copy(P.equip || {});
    if (!inv.equip.weapon) inv.equip.weapon = starterWeapon(P.cls);
    inv.bag = copy(P.bag || []);
    inv.tree = P.tree ? copy(P.tree) : freeRanks(P.cls, inv.level);
    inv.loadout = P.loadout ? copy(P.loadout) : null;
    inv.skills = [];
    // skill points: the legal budget for this level minus what the ranks spend
    inv.sp = 0; ensureTree(inv);
    const budget = inv.level - 1, spent = spentPoints(inv);
    if (spent > budget) { inv.tree = freeRanks(P.cls, inv.level); inv.loadout = null; inv.sp = budget; ensureTree(inv); this.notice = 'The saved skill ranks needed more points than level ' + inv.level + ' has, so they were reset.'; }
    else inv.sp = budget - spent;
    inv.potions = inv.maxPotions = 3; inv.bigkey = true; inv.keys = 3;
    const profile = createProfile({ name: 'MOSSDEV', classId: P.cls, inventory: inv, seed: P.seed || 1 });
    profile.id = 'mossdev-sandbox';
    profile.world.checkpoint = { area: 'mosslab', spawn: 'center' };
    restoreCharacter(g, profile);
    g.characterSession = new SandboxSession(this);
    g.recalc(); g.inv.hp = g.inv.maxHp; g.res = 100;
    const w = g.inv.equip.weapon; if (isFirearm(w)) completeReload(w);
  }
  // copy the live test state back into the profile (never any world or quest state)
  captureProfile() {
    const g = this.g, inv = g.inv; if (!this.active || !inv) return;
    const P = this.profile;
    P.cls = inv.cls; P.level = inv.level;
    P.equip = Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, inv.equip[s] ? copy(inv.equip[s]) : null]));
    P.tree = copy(inv.tree || {}); P.loadout = copy(inv.loadout || null); P.bag = copy(inv.bag || []).slice(0, 60);
    this.store.write();
  }
  rebuild(keepArena = true) {
    this.buildCharacter();
    this.loadArena(keepArena ? this.profile.arena : 'dummy');
  }
  // Reset Test: the saved character, item rolls, resources, enemies, positions and seed come back;
  // projectiles, statuses, summons, temporary effects and telemetry are cleared.
  resetTest() { this.clearTest(); this.rebuild(); this.say('Test reset.'); }
  clearTest() {
    const g = this.g;
    this.telemetry.reset(); this.targets = [];
    g.bossActive = null; g.ui.bossBar && g.ui.bossBar(null);
    g.itemCombat?.reset();
  }

  // ---------------------------------------------------------------- arenas
  loadArena(id) {
    const g = this.g, P = this.profile;
    if (!ARENAS.includes(id)) id = 'dummy';
    P.arena = id; this.store.write();
    this.telemetry.reset(); this.targets = [];
    if (id === 'boss') return this.loadBoss();
    g.loadArea('mosslab', 'center');
    g.area.level = P.level; // enemies scale to the test level
    g.player.x = 20; g.player.z = 23; g.player.facing = Math.PI; g.snapCamera && g.snapCamera();
    withSeed(P.seed || 1, () => {
      if (id === 'dummy') this.spawnDummies();
      if (id === 'crowd') this.spawnCrowd(P.arenaOpts.crowdSize, P.arenaOpts.crowdKinds);
      if (id === 'elite') this.spawnElite(P.arenaOpts.eliteKind, P.arenaOpts.eliteMod);
      if (id === 'element') this.spawnElementTargets();
    });
    g.ui.areaName && g.ui.areaName('MOSSDEV · ' + ARENA_NAMES[id]);
  }
  // a real enemy made into a controlled, immortal target (AI off, damage off, statuses real)
  target(kind, x, z, opts = {}) {
    const g = this.g, e = makeEnemy(g, kind, x, z); if (!e) return null;
    g.scaleEnemy(e, { noElite: true }); e.spawnT = 0;
    e.labTarget = true; e.dmgMul = 0; e.xpValue = 0; e.loot = { pips: 0 };
    const move = !!opts.move;
    e.think = dt => { if (!move) return [0, 0]; const t = g.time + x; return [Math.sin(t * 0.9) * 1.6, 0]; };
    e.die = () => { e.labDowned = true; }; // never dies: no loot, kills or XP from a test target
    const onHit = e.onHit.bind(e), dot = e.dot.bind(e);
    e.onHit = h => { const hp0 = e.hp, r = onHit(h); this.telemetry.hit(e, h, Math.max(0, hp0 - e.hp), r); if (e.hp <= 0) e.hp = e.maxHp; return r; };
    e.dot = (n, color) => { const hp0 = e.hp; dot(n, color); this.telemetry.dot(e, Math.max(0, hp0 - e.hp)); if (e.hp <= 0) e.hp = e.maxHp; };
    if (opts.armour) e.dmgTaken = 0.5; // uses the game's own incoming-damage multiplier
    if (opts.name) e.displayName = opts.name;
    g.spawn(e); this.targets.push(e);
    return e;
  }
  spawnDummies() {
    const o = this.profile.arenaOpts;
    this.target('knight', 20, 15, { move: o.dummyMove, armour: o.dummyArmour, name: 'Test Dummy' + (o.dummyArmour ? ' (armoured)' : '') + (o.dummyMove ? ' (moving)' : '') });
  }
  spawnCrowd(n = 10, kinds = ['blot']) {
    const g = this.g; n = [5, 10, 20, 30].includes(+n) ? +n : 10; kinds = (kinds || []).filter(k => ENEMY_KINDS.includes(k)); if (!kinds.length) kinds = ['blot'];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, r = 5 + (i % 3) * 1.4, e = makeEnemy(g, kinds[i % kinds.length], 20 + Math.cos(a) * r, 13 + Math.sin(a) * r * 0.6);
      if (!e) continue; g.scaleEnemy(e, { noElite: true }); e.xpValue = 0; e.loot = { pips: 0 }; e.labSpawned = true; g.spawn(e); this.targets.push(e);
    }
  }
  spawnElite(kind = 'knight', mod = 'Brutal') {
    const g = this.g, why = eliteCompatible(kind, mod);
    if (why) { this.say(why); return null; }
    const e = makeEnemy(g, kind, 20, 13); g.scaleEnemy(e, { noElite: true }); g.makeElite(e, mod); e.xpValue = 0; e.loot = { pips: 0 }; e.labSpawned = true;
    g.spawn(e); this.targets.push(e); return e;
  }
  spawnElementTargets() {
    const g = this.g;
    ELEMENT_TARGETS.forEach((s, i) => { const e = this.target('knight', 8 + i * 4, 14, { name: STATUS_NAMES[s] + ' target' }); if (e) { e.labStatus = s; this.applyTargetStatus(e); } });
  }
  // the enemy's own status implementation; boss/elite rules (e.g. no freeze on bosses) still apply
  applyTargetStatus(e) {
    const s = e.labStatus; if (!s) return;
    if (s === 'burn') e.applyStatus('burn', 6, 2); else e.applyStatus(s, 6);
  }
  refreshStatuses() { for (const e of this.targets) if (!e.dead) this.applyTargetStatus(e); }
  loadBoss() {
    // Bramblemaw fights in its own room in Rootwell Hollow, with its real encounter trigger.
    const g = this.g;
    g.flags.bossKilled = false; g.bossActive = null;
    g.loadArea('dungeon', 'pre');
    const room = (g.area.rooms || []).find(r => r.id === 'boss');
    if (room) { g.player.x = (room.x0 + room.x1) / 2; g.player.z = room.z1 - 3.2; g.snapCamera && g.snapCamera(); }
    g.ui.areaName && g.ui.areaName('MOSSDEV · Boss: Bramblemaw');
    this.say('Walk forward into the Choking Root: the encounter starts through its normal trigger.');
  }
  clearEnemies() { const g = this.g; for (const e of [...g.entities]) if (e.isEnemy && !e.labTarget && !e.isBoss) e.remove(); this.targets = this.targets.filter(e => e.labTarget && !e.dead); }
  refill() { const g = this.g; g.inv.hp = g.inv.maxHp; g.res = 100; const w = g.inv.equip.weapon; if (isFirearm(w)) completeReload(w); g.hudDirty = true; }
  resetCooldowns() { const p = this.g.player; if (!p) return; p.cdMap = {}; p.secCd = 0; if (p.cd) p.cd = 0; this.g.hudDirty = true; }

  // ---------------------------------------------------------------- character controls
  setClass(cls) {
    if (!CLASSES[cls] || cls === this.profile.cls) return false;
    const P = this.profile;
    // armour and jewellery that the new class can wear stay; the weapon becomes its starter
    const keep = {}; for (const s of EQUIPMENT_SLOTS) { const it = P.equip[s]; if (s !== 'weapon' && it && eligible(baseById(it.base), cls, it.unique)) keep[s] = it; }
    P.cls = cls; P.equip = { ...keep, weapon: starterWeapon(cls) }; P.tree = null; P.loadout = null;
    this.store.write(); this.rebuild(); return true;
  }
  setLevel(n) { const P = this.profile; P.level = Math.max(1, Math.min(MAX_LEVEL, Math.round(n))); this.captureTreeFor(P.level); this.store.write(); this.rebuild(); }
  captureTreeFor(level) { const P = this.profile; if (!P.tree) return; const inv = { cls: P.cls, level, tree: copy(P.tree), sp: 0 }; if (spentPoints(inv) > level - 1) { P.tree = null; P.loadout = null; } }
  resetSkills() { const g = this.g; respecTree(g.inv); g.recalc(); this.captureProfile(); }
  // Spend every point legally, the chosen path first (rules from skills.js; no bypass).
  maxPath(pathIndex) {
    const g = this.g, inv = g.inv; respecTree(inv);
    const nodes = treeOf(inv.cls), order = [...nodes.filter(n => n.path === pathIndex), ...nodes.filter(n => n.path !== pathIndex)];
    let spent = true;
    while (inv.sp > 0 && spent) { spent = false; for (const n of order) if (!lockReason(inv, n)) { spendNode(inv, n.id); spent = true; if (inv.sp <= 0) break; } }
    g.recalc(); this.captureProfile();
    return spentPoints(inv);
  }
  setCheat(k, v) { const c = this.profile.cheats; c[k] = v; this.store.write(); this.applyCheats(); }
  applyCheats() { const g = this.g, c = this.profile.cheats; g.godMode = !!c.god; g.recalc(); }

  // ---------------------------------------------------------------- items
  // exact item: the object is copied once, never rerolled when equipped, inspected or rendered
  spawnItem(item, equip = false) {
    const g = this.g, inv = g.inv, it = copy(item);
    if (!equip) {
      if (inv.bag.length >= g.bagCapacity()) { this.store.addToTray(it); this.say('Bag full: ' + it.name + ' went to the lab tray.'); return 'tray'; }
      inv.bag.push(it); this.captureProfile(); return 'bag';
    }
    const base = baseById(it.base);
    if (!this.profile.cheats.ignoreRestrictions && !g.canEquip(it)) return 'restricted';
    if (it.cls && it.cls !== inv.cls && !this.profile.cheats.ignoreRestrictions) return 'otherclass';
    const slot = g.equipSlotFor(it), old = inv.equip[slot];
    inv.equip[slot] = it; if (old) this.store.addToTray(old);
    g.recalc(); g.lastEquip = { slot, t: performance.now() };
    if (isFirearm(it)) completeReload(it);
    this.captureProfile(); void base;
    return 'equipped';
  }
  switchClassAndEquip(item) { this.setClass(item.cls); return this.spawnItem(item, true); }
  // Normal rules: the real factory. Forced: the same factory with a chosen base / rarity.
  buildItem({ id, rarity = null, forced = false }) {
    const g = this.g, lvl = this.profile.level, cls = this.profile.cls;
    const it = makeNamed(id, lvl, forced && rarity != null ? rarity : null, forced ? null : cls);
    if (!it) return null;
    if (forced) it.devForced = { rarity, by: 'MOSSDEV' }; // labelled: never passes as a normal drop
    return it;
  }
  lootSample(kind) {
    const g = this.g, P = this.profile, out = [];
    withSeed((P.seed || 1) + (kind === 'class100' ? 100 : 7), () => {
      if (kind === 'class100') for (let i = 0; i < 100; i++) out.push(genItem({ level: P.level, cls: P.cls }));
      else { const r = RARITY.findIndex(x => x.id === kind); if (r >= 0) for (let i = 0; i < 10; i++) out.push(genItem({ level: P.level, cls: P.cls, rarity: r })); }
    });
    this.store.addToTray(out);
    const counts = {}; for (const it of out) { const n = it.prismatic || it.r === 5 ? 'Prismatic' : RARITY[it.r].name; counts[n] = (counts[n] || 0) + 1; }
    return { n: out.length, counts, wrongClass: out.filter(it => it.cls && it.cls !== P.cls).length };
  }

  // ---------------------------------------------------------------- one-click tests
  runManifest(id) {
    const e = RECENT.find(x => x.id === id); if (!e) return false;
    const st = manifestStatus(e); if (!st.ok) { this.say(st.why); return false; }
    const P = this.profile;
    P.cls = e.cls; P.level = e.level; P.tree = null; P.loadout = null; P.seed = e.seed || P.seed;
    P.equip = { weapon: makeNamed(e.item.named, e.level, null, e.cls) };
    P.arena = e.arena; P.arenaOpts = { ...P.arenaOpts, ...(e.opts || {}) };
    this.store.data.lastTest = id; this.store.write();
    this.clearTest(); this.buildCharacter();
    if (e.build != null) this.maxPath(e.build);
    this.refill(); this.loadArena(e.arena);
    this.say(e.try);
    return true;
  }
  loadPreset(id) {
    const p = this.store.data.presets.find(x => x.id === id); if (!p) return false;
    const v = validateProfile(p.profile); if (!v.ok) { this.say('Preset is invalid: ' + v.errors.join(' ')); return false; }
    this.store.data.profile = normalizeProfile(p.profile); this.store.write(); this.clearTest(); this.rebuild(); return true;
  }
  // working builds from current content: class, weapon and a legal path
  applyBuildPreset(b) {
    const P = this.profile;
    P.cls = b.cls; P.level = b.level || 20; P.tree = null; P.loadout = null; P.equip = { weapon: makeNamed(b.weapon, P.level, null, b.cls) };
    this.store.write(); this.clearTest(); this.buildCharacter(); this.maxPath(b.path); this.refill(); this.loadArena(P.arena);
  }

  // ---------------------------------------------------------------- frame
  hook() {
    if (this.hooked) return; this.hooked = true;
    const g = this.g, ev = combatEvents(g);
    for (const n of ['attack.release', 'spell.cast']) ev.on(n, () => { if (this.active) this.telemetry.release(); });
  }
  tick(dt) {
    if (!this.active) return;
    const g = this.g, c = this.profile.cheats;
    if (c.infRes) g.res = 100;
    if (c.infAmmo) { const w = g.inv.equip.weapon; if (isFirearm(w) && w.magazine && w.magazine.rounds < FIREARMS[w.kind].capacity && !g.player?.reload) completeReload(w); }
    if (c.god) g.inv.hp = Math.max(g.inv.hp, 1);
    this.telemetry.tick(dt, this.targets);
  }
  say(t) { this.notice = t; this.g.ui.toast && this.g.ui.toast('MOSSDEV', t, 3); this.onChange && this.onChange(); }
  resourceName() { return resLabel ? resLabel(this.profile.cls, 100).replace(/[\d\s/]+$/, '') : CLASSES[this.profile.cls].res; }
}
export const ARENA_NAMES = { dummy: 'Dummy / DPS', crowd: 'Crowd', elite: 'Elite', boss: 'Boss', element: 'Element lab', loot: 'Loot lab', vfx: 'VFX lab' };
export const STATUS_NAMES = { wet: 'Wet', burn: 'Burning', chill: 'Chilled', freeze: 'Frozen', shock: 'Shocked', hex: 'Hexed', mark: 'Marked' };
export const BUILD_PRESETS = [
  { id: 'witch-fire', name: 'Witch · Fire', cls: 'witch', weapon: 'candlestaff', path: 0 },
  { id: 'witch-frost', name: 'Witch · Frost', cls: 'witch', weapon: 'frostrod', path: 1 },
  { id: 'witch-lightning', name: 'Witch · Lightning', cls: 'witch', weapon: 'owlstaff', path: 1 },
  { id: 'samurai-precision', name: 'Samurai · Precision', cls: 'samurai', weapon: 'hatpin', path: 0 },
  { id: 'samurai-heavy', name: 'Samurai · Heavy', cls: 'samurai', weapon: 'bellclapper', path: 2 },
  { id: 'archer-piercing', name: 'Archer · Piercing', cls: 'archer', weapon: 'lilypad', path: 0 },
  { id: 'archer-storm', name: 'Archer · Storm', cls: 'archer', weapon: 'galebow', path: 2 },
  { id: 'soul-pull', name: 'Soulbound · Pull', cls: 'soulbound', weapon: 'gravechain', path: 0 },
  { id: 'soul-spirit', name: 'Soulbound · Spirit', cls: 'soulbound', weapon: 'lanternchain', path: 2 },
  { id: 'gun-revolver', name: 'Gunslinger · Revolver', cls: 'gunslinger', weapon: 'sundownsix', path: 0 },
  { id: 'gun-turret', name: 'Gunslinger · Turret', cls: 'gunslinger', weapon: 'marshalrevolver', path: 2 },
  { id: 'gun-explosives', name: 'Gunslinger · Explosives', cls: 'gunslinger', weapon: 'brassrifle', path: 1 },
];
export { RECENT, manifestStatus, PATHS, ENEMY_KINDS as LAB_ENEMIES };
