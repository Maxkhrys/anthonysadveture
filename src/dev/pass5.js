// DEVELOPMENT AND TESTING ONLY. Pass 5 commands plugged into the existing developer console
// (src/dev/commands.js) without changing it: they are added to its definition and handler
// tables. Everything they touch is discovered from src/rpg/registry.js.
//
// ISOLATION: commands that create loot or change progression refuse to run unless the dev
// sandbox is on (/sandbox on) — while it is on, nothing is written to the save — or unless you
// pass "keep" to deliberately write to the real profile.
import { COMMAND_DEFINITIONS, DevCommands } from './commands.js';
import { REGISTRY } from '../rpg/registry.js';
import { spendNode, respecTree, treeOf, setLoadout, rankOf, lockReason } from '../rpg/skills.js';
import { makeNamed, genItem, rollAffixValue, AFFIXES } from '../rpg/items.js';
import { gainMat, learn } from '../rpg/crafting.js';

const guard = (game, args, log) => {
  if (game.devSandbox || args.includes('keep')) return true;
  log('Refused: this would change your real character. Run /sandbox on first (nothing is saved while it is on), or add "keep" to write to your profile on purpose.', 'yellow');
  return false;
};
const give = (game, it, log) => { it.provenance = { source: game.devSandbox ? 'dev-sandbox' : 'dev' }; game.inv.bag.push(it); game.recalc(); log(`+ ${it.name}`, 'green'); };

const DEFS = {
  sandbox: { name: 'sandbox', desc: 'Dev sandbox: while on, the game never saves, so spawned loot and progress stay out of your profile. Off reloads your saved character.', usage: '/sandbox <on|off>' },
  skill: { name: 'skill', desc: 'Skill tree: list nodes, unlock one, unlock all, grant points or reset.', usage: '/skill <list|all|reset|points N|node_id>' },
  loadout: { name: 'loadout', desc: 'Put an unlocked active ability in hotbar slot 1-6.', usage: '/loadout <slot> <skill_id>' },
  named: { name: 'named', desc: 'Give a named weapon, accessory or set piece (list shows all).', usage: '/named <list|id> [keep]' },
  set: { name: 'set', desc: 'Equip a full armour set.', usage: '/set <bellwarden|thornstalker|cinderwoven> [keep]' },
  affix: { name: 'affix', desc: 'Roll a natural item with its first affix forced to a stat-roll tier.', usage: '/affix <common..prismatic> [slot] [keep]' },
  reinforce: { name: 'reinforce', desc: 'Set the equipped weapon reinforcement level (0-20).', usage: '/reinforce <n> [keep]' },
  mat: { name: 'mat', desc: 'Give crafting materials (Pass 5 ones included).', usage: '/mat <id|all> [n] [keep]' },
  elite: { name: 'elite', desc: 'Spawn an elite with a chosen modifier (Resonant, Oathbound…).', usage: '/elite <modifier> [kind]' },
  fight: { name: 'fight', desc: 'Go to a Pass 5 boss and wake it (seamkeeper | toad).', usage: '/fight <seamkeeper|toad>' },
  react: { name: 'react', desc: 'Stage an element combination on dummies (conduct | shatter | firestorm).', usage: '/react <conduct|shatter|firestorm>' },
  registry: { name: 'registry', desc: 'Print what the Pass 5 registry contains (discoverable content).', usage: '/registry [section]' },
  capture: { name: 'capture', desc: 'Capture helpers: freeze, slow motion, a fixed camera, hide the HUD, performance numbers.', usage: '/capture <freeze|slow 0.25|normal|cam x z [zoom]|free|hud|perf>' },
  deathdrop: { name: 'deathdrop', desc: 'Test the death drop: drop half your pips here as if you had fallen.', usage: '/deathdrop' },
};
const HANDLERS = {
  sandbox(game, args, log) {
    const on = (args[0] || 'on') === 'on';
    if (on) { game.devSandbox = true; game._realSave = game._realSave || game.save.bind(game); game.save = async () => false; log('Dev sandbox ON — the game will not save until /sandbox off.', 'gold'); }
    else { game.devSandbox = false; if (game._realSave) game.save = game._realSave; log('Dev sandbox OFF — reloading your saved character.', 'gold'); setTimeout(() => location.reload(), 300); }
  },
  skill(game, args, log) {
    const inv = game.inv, a = args[0];
    if (!a || a === 'list') { for (const n of treeOf(inv.cls)) log(`${n.id.padEnd(16)} ${n.type.padEnd(7)} ${rankOf(inv, n.id)}/${n.max}  ${lockReason(inv, n) || 'can learn'}`, 'info'); return; }
    if (!guard(game, args, log)) return;
    if (a === 'reset') { log(`Refunded ${respecTree(inv)} points.`, 'green'); game.recalc(); return; }
    if (a === 'points') { inv.sp += parseInt(args[1], 10) || 10; log(`Skill points: ${inv.sp}`, 'green'); return; }
    if (a === 'all') { inv.level = Math.max(inv.level, 20); inv.sp += 200; for (let k = 0; k < 8; k++) for (const n of treeOf(inv.cls)) while (spendNode(inv, n.id)); game.recalc(); log('Every node unlocked.', 'green'); return; }
    inv.sp += 1; inv.level = Math.max(inv.level, 12);
    if (spendNode(inv, a)) { game.recalc(); log(`${a} → rank ${rankOf(inv, a)}`, 'green'); } else { inv.sp -= 1; log(`Cannot learn ${a}.`, 'error'); }
  },
  loadout(game, args, log) { const ok = setLoadout(game.inv, (parseInt(args[0], 10) || 1) - 1, args[1]); log(ok ? `Slot ${args[0]}: ${args[1]}` : 'Not unlocked / bad slot.', ok ? 'green' : 'error'); },
  named(game, args, log) {
    if (!args[0] || args[0] === 'list') { for (const w of REGISTRY.namedWeapons) log(`${w.id.padEnd(14)} ${w.name} — ${w.src}`, 'info'); for (const a of REGISTRY.accessories) log(`${a.id.padEnd(14)} ${a.name} (accessory)`, 'info'); for (const [s, ids] of Object.entries(REGISTRY.setPieces)) log(`${s}: ${ids.join(', ')}`, 'info'); return; }
    if (!guard(game, args, log)) return;
    const it = makeNamed(args[0], Math.max(8, game.inv.level)); if (!it) return log('Unknown id.', 'error'); give(game, it, log);
  },
  set(game, args, log) {
    if (!guard(game, args, log)) return;
    const ids = REGISTRY.setPieces[args[0]]; if (!ids) return log('Sets: ' + Object.keys(REGISTRY.setPieces).join(', '), 'error');
    for (const id of ids) { const it = makeNamed(id, Math.max(8, game.inv.level)); it.provenance = { source: 'dev' }; game.inv.bag.push(it); game.equipItem(game.inv.bag.length - 1); }
    log(`${args[0]} equipped (5/5).`, 'green');
  },
  affix(game, args, log) {
    if (!guard(game, args, log)) return;
    const tier = args[0] || 'prismatic', slot = ['weapon', 'helm', 'armor', 'charm', 'ring', 'arms', 'legs', 'boots'].includes(args[1]) ? args[1] : 'weapon';
    const it = genItem({ level: game.inv.level, slot, cls: game.inv.cls, rarity: 3 });
    const k = it.affixes[0], inst = rollAffixValue(k, it.ilvl, { targetTier: tier });
    it.stats[k] = it.stats[k] - it.rolledAffixes[0].actualRoll + inst.actualRoll; it.rolledAffixes[0] = inst;
    it.highestAffixTier = inst.tier; it.highestAffixColor = inst.displayColor;
    give(game, it, log); log(`${AFFIXES[k].name}: ${inst.actualRoll} [${inst.tierName}]${inst.qualitative ? ' ★ ' + inst.qualitative.name : ''}`, 'gold');
  },
  reinforce(game, args, log) { if (!guard(game, args, log)) return; const w = game.inv.equip.weapon; w.upgradeLevel = Math.max(0, Math.min(20, parseInt(args[0], 10) || 0)); game.recalc(); log(`${w.name} +${w.upgradeLevel}`, 'green'); },
  mat(game, args, log) {
    if (!guard(game, args, log)) return;
    const n = parseInt(args[1], 10) || 10, ids = args[0] === 'all' ? Object.keys(REGISTRY.materials) : [args[0]];
    for (const id of ids) if (REGISTRY.materials[id]) gainMat(game, id, n);
    for (const r of REGISTRY.recipes) if (args[0] === 'all') learn(game, r.id, true);
    log(`Materials: ${ids.join(', ')} ×${n}`, 'green');
  },
  elite(game, args, log) {
    const mod = (args[0] || 'Resonant').replace(/^./, c => c.toUpperCase()), kind = args[1] || 'blot', p = game.player;
    if (!REGISTRY.eliteModifiers.includes(mod)) return log('Modifiers: ' + REGISTRY.eliteModifiers.join(', '), 'error');
    const e = game.spawnEnemy(kind, p.x + Math.sin(p.facing) * 3, p.z + Math.cos(p.facing) * 3, { noRoom: true, eliteChance: 0 });
    game.makeElite(e); e.elite = mod; e.displayName = mod + ' ' + (game.nameOf({ kind }).replace(/^a /, '')); e.devOnly = true;
    log(`Spawned ${e.displayName}.`, 'green');
  },
  fight(game, args, log) {
    if (args[0] === 'toad') { game.flags.toadAt = undefined; game.warpTo('overworld', 'fen', () => { const t = game.fenToad; if (t) game.wakeToad(t); }); log('To Mirewhistle Fen — the toad wakes.', 'green'); return; }
    game.flags.seamDead = false; game.setSignal('c.torches', true, false);
    game.warpTo('conservatory', 'canopy', () => { const r = game.area.rooms.find(r => r.id === 'loom'); game.player.x = r.x0 + 8.5; game.player.z = r.z0 + 8.5; game.snapCamera(); });
    log('To the Seamkeeper\'s loom.', 'green');
  },
  react(game, args, log) {
    const p = game.player, kind = args[0] || 'conduct';
    const mk = (dx, dz) => { const e = game.spawnEnemy('blot', p.x + dx, p.z + dz, { noRoom: true, eliteChance: 0 }); e.hp = e.maxHp = 1e4; e.think = () => [0, 0]; e.devOnly = true; return e; };
    const a = mk(2, 0), b = mk(3, 1), c = mk(3, -1);
    setTimeout(() => {
      if (kind === 'conduct') { for (const e of [a, b, c]) e.applyStatus('wet', 10); game.playerHit(a, { mult: 1, kind: 'shock', kb: 0, dir: 0 }); }
      if (kind === 'shatter') { a.applyStatus('freeze', 5); game.playerHit(a, { mult: 1, kind: 'spin', kb: 0, dir: 0 }); }
      if (kind === 'firestorm') { a.applyStatus('burn', 5, 3); game.playerHit(a, { mult: 1, kind: 'wind', element: 'wind', kb: 0, dir: 0 }); }
    }, 500);
    log('Staged: ' + kind, 'green');
  },
  registry(game, args, log) {
    const sec = args[0];
    if (!sec) { for (const [k, v] of Object.entries(REGISTRY)) log(`${k.padEnd(16)} ${Array.isArray(v) ? v.length + ' entries' : typeof v === 'object' ? Object.keys(v).length + ' keys' : v}`, 'info'); return; }
    const v = REGISTRY[sec]; log(JSON.stringify(Array.isArray(v) ? v.map(x => x.id || x) : Object.keys(v || {})), 'info');
  },
  capture(game, args, log) {
    const a = args[0];
    if (a === 'freeze') { game.timeScale = 0; log('Time frozen.', 'gold'); }
    else if (a === 'slow') { game.timeScale = parseFloat(args[1]) || 0.25; log('Slow motion ×' + game.timeScale, 'gold'); }
    else if (a === 'normal') { game.timeScale = 1; log('Time normal.', 'gold'); }
    else if (a === 'cam') { game.camFocus = { x: parseFloat(args[1]) || game.player.x, z: parseFloat(args[2]) || game.player.z }; game.camZoom = parseFloat(args[3]) || 1; log('Camera fixed.', 'gold'); }
    else if (a === 'free') { game.camFocus = null; game.camZoom = 1; log('Camera follows the hero.', 'gold'); }
    else if (a === 'hud') { document.getElementById('hud').classList.toggle('hidden'); }
    else if (a === 'perf') { const r = game.pr.renderer.info.render; log(`draw calls ${r.calls} · triangles ${r.triangles} · entities ${game.entities.length} · particles ${game.fx.p.length}`, 'info'); }
    else log(DEFS.capture.usage, 'yellow');
  },
  deathdrop(game, args, log) { if (!guard(game, args, log)) return; const c = game.inv.coins; game.player.lastSafe = { x: game.player.x, z: game.player.z }; const d = Math.floor(c * 0.5); game.flags.deathDrop = { area: game.area.id, x: game.player.x, z: game.player.z, coins: d }; game.inv.coins -= d; game.loadArea(game.area.id, { x: game.player.x, z: game.player.z + 1.5 }); log(`${d} pips dropped here.`, 'green'); },
};
Object.assign(COMMAND_DEFINITIONS, DEFS);
Object.assign(DevCommands.handlers, HANDLERS);
export const PASS5_COMMANDS = Object.keys(DEFS);
