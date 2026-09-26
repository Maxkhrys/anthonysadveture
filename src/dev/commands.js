// Developer Commands Engine for Mossling (Pass 2).
// DEVELOPMENT AND TESTING ONLY.
// Clearly marked as development tooling in code.
// Obscurity note: activation is obscure for dev convenience, not cryptographic security.
// NEVER put secrets/API keys in client code.

import { LEGENDARY_DEFS, PRISMATIC_DEFS } from '../rpg/arpg/definitions.js';
import { CLASSES, MAX_LEVEL, xpNeed } from '../rpg/classes.js';
import {
  AFFIX_RARITY_TIERS,
  TIER_ORDER,
  rollWeaponWithAffixes,
  formatAffixSummary,
  AFFIX_DEFINITIONS,
  QUALITATIVE_MODIFIERS,
  rollAffixInstance,
  calculateTradeValuation,
} from '../rpg/affixes.js';
import { simulateAffixRolls, formatSimulationReport } from '../rpg/affix_simulation.js';
import {
  genItem,
  makeBuildItem,
  baseById,
  WEAPONS,
  ARMORS,
  LEGENDARIES,
  AFFIXES,
  itemPower,
  statLine,
  starterWeapon,
} from '../rpg/items.js';
import { RECIPES, MATS, learn, recipeById, TRANSFER, knows } from '../rpg/crafting.js';
import { EXTRA_ENEMIES, makeEnemy } from '../entities/enemies.js';
import { sfx } from '../engine/audio.js';
import {
  SCHEMA_VERSION,
  BELLSTONES,
  EQUIPMENT_SLOTS,
  identifyItem,
  copy,
  respecInventory,
  reinforceWeapon,
  reinforcementMultiplier,
} from '../persistence/model.js';
import {
  discoverSystems,
  ProfileLab,
  devStress,
  readGamepadDiagnostics,
  BASE_ENEMY_KINDS,
} from './tools.js';
import { applySettings, saveSettings } from '../settings.js';

export const COMMAND_CATEGORIES = [
  'CHARACTER',
  'LOOT',
  'COMBAT',
  'WORLD',
  'CRAFTING',
  'QUEST',
  'VISUAL',
  'PERFORMANCE',
];

export const COMMAND_DEFINITIONS = {
  devlab:{name:'devlab',category:'WORLD',desc:'Open the persistent MOSSDEV sandbox lab. Enables developer mode; adventure saves stay separate.',usage:'/devlab',aliases:['mossdev','lab']},
  allitems: { name: 'allitems', category: 'LOOT', desc: 'Toggle the Minecraft-style All-Items Creative Armoury browser in your inventory to pull any item.', usage: '/allitems [on|off]', aliases: ['creative', 'items', 'itembrowser', 'cheat'] },
  arpgbuild: { name:'arpgbuild',category:'LOOT',desc:'List or create an ARPG build weapon for your current class.',usage:'/arpgbuild [list|unique_id]' },
  // ---------------------------------------------------------------- CHARACTER
  help: {
    name: 'help',
    category: 'CHARACTER',
    desc: 'List commands by category or view help for a specific command.',
    usage: '/help [category|command]',
  },
  character: {
    name: 'character',
    category: 'CHARACTER',
    desc: 'Inspect active character profile identity, class, level, schema, and playtime.',
    usage: '/character',
    aliases: ['profile', 'whoami'],
  },
  switchcharacter: {
    name: 'switchcharacter',
    category: 'CHARACTER',
    desc: 'Switch between existing character profiles.',
    usage: '/switchcharacter <id|name>',
  },
  cloneprofile: {
    name: 'cloneprofile',
    category: 'CHARACTER',
    desc: 'Safely duplicate active character profile without overwriting original.',
    usage: '/cloneprofile [custom_name]',
  },
  createtestprofile: {
    name: 'createtestprofile',
    category: 'CHARACTER',
    desc: 'Create a fresh test character profile for testing.',
    usage: '/createtestprofile <name> <samurai|archer|witch|soulbound|gunslinger>',
  },
  level: {
    name: 'level',
    category: 'CHARACTER',
    desc: 'Set player level directly (1-20), recalculating stats.',
    usage: '/level <number>',
  },
  levelup: {
    name: 'levelup',
    category: 'CHARACTER',
    desc: 'Increment player level by 1 or specified amount.',
    usage: '/levelup [count]',
  },
  leveldown: {
    name: 'leveldown',
    category: 'CHARACTER',
    desc: 'Decrement player level by 1 or specified amount.',
    usage: '/leveldown [count]',
  },
  xp: {
    name: 'xp',
    category: 'CHARACTER',
    desc: 'Add experience points to player.',
    usage: '/xp <number>',
  },
  resetxp: {
    name: 'resetxp',
    category: 'CHARACTER',
    desc: 'Reset experience points to 0 at current level.',
    usage: '/resetxp',
  },
  coins: {
    name: 'coins',
    category: 'CHARACTER',
    desc: 'Add or set pips/coins.',
    usage: '/coins <number>',
  },
  respec: {
    name: 'respec',
    category: 'CHARACTER',
    desc: 'Refund all skill points and allocated stat points cleanly.',
    usage: '/respec',
  },
  forcesave: {
    name: 'forcesave',
    category: 'CHARACTER',
    desc: 'Force immediate save snapshot of current profile.',
    usage: '/forcesave',
  },
  reloadprofile: {
    name: 'reloadprofile',
    category: 'CHARACTER',
    desc: 'Reload character state from disk storage.',
    usage: '/reloadprofile',
  },
  validatesave: {
    name: 'validatesave',
    category: 'CHARACTER',
    desc: 'Validate current save data against persistence schema.',
    usage: '/validatesave',
  },
  testmigration: {
    name: 'testmigration',
    category: 'CHARACTER',
    desc: 'Simulate migration from older save formats in volatile memory.',
    usage: '/testmigration',
  },
  testcorruptfallback: {
    name: 'testcorruptfallback',
    category: 'CHARACTER',
    desc: 'Simulate corrupted save fallback recovery & quarantine.',
    usage: '/testcorruptfallback',
  },

  // ---------------------------------------------------------------- LOOT & INVENTORY
  give: {
    name: 'give',
    category: 'LOOT',
    desc: 'Give an item, base weapon, crafting material, or consumable.',
    usage: '/give <item_id|material|consumable> [count]',
  },
  giveall: {
    name: 'giveall',
    category: 'LOOT',
    desc: 'Grant all crafting materials, keys, tools, recipes, and test gear.',
    usage: '/giveall',
  },
  rollweapon: {
    name: 'rollweapon',
    category: 'LOOT',
    desc: 'Roll a weapon using the data-driven affix rarity foundation.',
    usage: '/rollweapon [rarity] [ilvl] [slot]',
  },
  rollaffix: {
    name: 'rollaffix',
    category: 'LOOT',
    desc: 'Roll an individual affix instance at specified tier (Common..Prismatic).',
    usage: '/rollaffix <tier> [stat_id]',
  },
  perfectroll: {
    name: 'perfectroll',
    category: 'LOOT',
    desc: 'Spawn an item with maximum possible rolls and highest tier affixes.',
    usage: '/perfectroll <item_id>',
  },
  minroll: {
    name: 'minroll',
    category: 'LOOT',
    desc: 'Spawn an item with minimum possible rolls.',
    usage: '/minroll <item_id>',
  },
  duplicate: {
    name: 'duplicate',
    category: 'LOOT',
    desc: 'Duplicate held weapon or selected item with new instance ID.',
    usage: '/duplicate',
  },
  deleteitem: {
    name: 'deleteitem',
    category: 'LOOT',
    desc: 'Delete equipped slot or item at bag index.',
    usage: '/deleteitem <slot|bagIndex>',
  },
  inspectitem: {
    name: 'inspectitem',
    category: 'LOOT',
    desc: 'Inspect itemInstanceId, provenance, rolledStats, mutations, and trade appraisal.',
    usage: '/inspectitem [slot|bagIndex]',
  },
  clearbag: {
    name: 'clearbag',
    category: 'LOOT',
    desc: 'Safely clear all unequipped items from player backpack.',
    usage: '/clearbag',
  },
  upgrade: {
    name: 'upgrade',
    category: 'LOOT',
    desc: 'Set reinforcement level (0-20) on currently equipped weapon.',
    usage: '/upgrade <0-20>',
  },
  droptest: {
    name: 'droptest',
    category: 'LOOT',
    desc: 'Simulate virtual loot roll distributions without save mutation.',
    usage: '/droptest <count> [source: virtual|enemy|chest|boss] [rarityFloor]',
  },
  affixes: {
    name: 'affixes',
    category: 'LOOT',
    desc: 'Display affix rarity tiers, probabilities, roll ranges, and qualitative modifiers.',
    usage: '/affixes',
  },

  // ---------------------------------------------------------------- COMBAT
  god: {
    name: 'god',
    category: 'COMBAT',
    desc: 'Toggle player invulnerability, infinite resource, and damage immunity.',
    usage: '/god',
  },
  noclip: {
    name: 'noclip',
    category: 'COMBAT',
    desc: 'Toggle walking through walls, props, water, and cliffs.',
    usage: '/noclip',
  },
  heal: {
    name: 'heal',
    category: 'COMBAT',
    desc: 'Instantly restore maximum life, energy, Bell Surge, and tonic bottles.',
    usage: '/heal',
  },
  refill: {
    name: 'refill',
    category: 'COMBAT',
    desc: 'Refill class energy (Ki/Focus/Mana), potions, and Surge.',
    usage: '/refill',
  },
  resetcd: {
    name: 'resetcd',
    category: 'COMBAT',
    desc: 'Reset all ability cooldowns instantly.',
    usage: '/resetcd',
  },
  classinfo: {
    name: 'classinfo',
    category: 'COMBAT',
    desc: 'Print detailed telemetry on stats, equipment power, affixes, and class perks.',
    usage: '/classinfo',
  },
  setclass: {
    name: 'setclass',
    category: 'COMBAT',
    desc: 'Switch active class and equip starter/representative class gear.',
    usage: '/setclass <samurai|archer|witch|soulbound|gunslinger>',
  },
  dummylevel: {
    name: 'dummylevel',
    category: 'COMBAT',
    desc: 'Configure level of devroom training dummies.',
    usage: '/dummylevel <1-20>',
  },
  resetdps: {
    name: 'resetdps',
    category: 'COMBAT',
    desc: 'Reset all damage meters and combat training dummies.',
    usage: '/resetdps',
  },
  weapontest: {
    name: 'weapontest',
    category: 'COMBAT',
    desc: 'Print current weapon damage calculations and combat scaling.',
    usage: '/weapontest',
  },

  // ---------------------------------------------------------------- WORLD & TELEPORT
  devroom: {
    name: 'devroom',
    category: 'WORLD',
    desc: 'Enter isolated dev test facility, preserving current character & return point.',
    usage: '/devroom [exit]',
  },
  teleport: {
    name: 'teleport',
    category: 'WORLD',
    desc: 'Teleport to named landmark or coordinates.',
    usage: '/teleport <location> OR /teleport <x> <z>',
    aliases: ['tp'],
  },
  locations: {
    name: 'locations',
    category: 'WORLD',
    desc: 'List all discoverable teleport landmarks, areas, and coordinates.',
    usage: '/locations',
  },
  bellstone: {
    name: 'bellstone',
    category: 'WORLD',
    desc: 'Discover, undiscover, or travel to a Bellstone by ID.',
    usage: '/bellstone <village|entrance|pre|all> [discover|undiscover|warp]',
  },
  bellstones: {
    name: 'bellstones',
    category: 'WORLD',
    desc: 'List all Bellstones and their current discovery states.',
    usage: '/bellstones',
  },
  time: {
    name: 'time',
    category: 'WORLD',
    desc: 'Set overworld time of day using the world clock.',
    usage: '/time <dawn|day|dusk|night|fraction>',
  },
  weather: {
    name: 'weather',
    category: 'WORLD',
    desc: 'Set overworld weather and atmospheric parameters.',
    usage: '/weather <clear|rain|fog|storm>',
  },
  resetroom: {
    name: 'resetroom',
    category: 'WORLD',
    desc: 'Reset current dungeon puzzle room (crates, switches, enemies).',
    usage: '/resetroom',
  },

  // ---------------------------------------------------------------- CRAFTING
  recipe: {
    name: 'recipe',
    category: 'CRAFTING',
    desc: 'Learn or unlearn crafting recipes dynamically discovered from live data.',
    usage: '/recipe <id|all> [unlock|lock]',
  },
  recipes: {
    name: 'recipes',
    category: 'CRAFTING',
    desc: 'List all crafting recipes and their discovery state.',
    usage: '/recipes',
  },
  materials: {
    name: 'materials',
    category: 'CRAFTING',
    desc: 'Grant crafting essences and Hush Shards.',
    usage: '/materials [count]',
    aliases: ['mats'],
  },
  clearmaterials: {
    name: 'clearmaterials',
    category: 'CRAFTING',
    desc: 'Remove all crafting materials from inventory.',
    usage: '/clearmaterials',
  },
  transferengraving: {
    name: 'transferengraving',
    category: 'CRAFTING',
    desc: 'Transfer an engraving from one held weapon to another.',
    usage: '/transferengraving <from_bag_idx> <to_bag_idx>',
  },

  // ---------------------------------------------------------------- QUEST & ECHO
  quest: {
    name: 'quest',
    category: 'QUEST',
    desc: 'Inspect or manipulate main story stages and side quests safely with backup.',
    usage: '/quest <stage|complete|reset|status> [id]',
  },
  flags: {
    name: 'flags',
    category: 'QUEST',
    desc: 'Inspect active world and narrative progression flags.',
    usage: '/flags',
  },
  talk: {
    name: 'talk',
    category: 'QUEST',
    desc: 'Simulate conversation with any major NPC (tamsin, posy, oswin, brisk, ada, hermit).',
    usage: '/talk <npc_id>',
  },
  echo: {
    name: 'echo',
    category: 'QUEST',
    desc: 'Toggle Verdant Chime Echo acquired state or test gust echo.',
    usage: '/echo <on|off|test>',
  },
  element: {
    name: 'element',
    category: 'QUEST',
    desc: 'Trigger environmental element reaction (fire, frost, shock, wind) at player.',
    usage: '/element <fire|frost|shock|wind>',
  },

  // ---------------------------------------------------------------- VISUAL & EQUIPMENT
  preset: {
    name: 'preset',
    category: 'VISUAL',
    desc: 'Apply side-by-side visual settings preset (low, default, high, max).',
    usage: '/preset <low|default|high|max>',
  },
  zoom: {
    name: 'zoom',
    category: 'VISUAL',
    desc: 'Set camera distance zoom slider (0.75 - 1.5).',
    usage: '/zoom <0.75-1.5>',
  },
  pixel: {
    name: 'pixel',
    category: 'VISUAL',
    desc: 'Set pixel resolution scale (0=auto, 2=fine, 3=classic, 4=chunky, 5=huge).',
    usage: '/pixel <0|2|3|4|5>',
  },
  shadows: {
    name: 'shadows',
    category: 'VISUAL',
    desc: 'Set shadow quality resolution (high=2048, low=1024).',
    usage: '/shadows <high|low>',
  },
  equipslot: {
    name: 'equipslot',
    category: 'VISUAL',
    desc: 'Instantly equip an item into any of the 9 equipment slots.',
    usage: '/equipslot <slot> <item_id>',
  },
  unequip: {
    name: 'unequip',
    category: 'VISUAL',
    desc: 'Unequip a canonical equipment slot into backpack.',
    usage: '/unequip <slot>',
  },
  cyclegear: {
    name: 'cyclegear',
    category: 'VISUAL',
    desc: 'Automatically cycle through all equipment models and silhouettes on hero.',
    usage: '/cyclegear [stop|speed]',
  },
  paperdoll: {
    name: 'paperdoll',
    category: 'VISUAL',
    desc: 'Open inventory paper-doll screen directly.',
    usage: '/paperdoll',
  },

  // ---------------------------------------------------------------- PERFORMANCE & ENEMIES
  spawn: {
    name: 'spawn',
    category: 'PERFORMANCE',
    desc: 'Spawn any registered enemy near player with optional level and elite modifier.',
    usage: '/spawn <enemy_kind> [count] [level] [elite_mod]',
  },
  enemies: {
    name: 'enemies',
    category: 'PERFORMANCE',
    desc: 'List all dynamically registered enemy types in the game.',
    usage: '/enemies',
  },
  ai: {
    name: 'ai',
    category: 'PERFORMANCE',
    desc: 'Freeze, resume, or toggle enemy AI processing.',
    usage: '/ai <freeze|resume|toggle>',
  },
  clear: {
    name: 'clear',
    category: 'PERFORMANCE',
    desc: 'Clear spawned non-boss enemies and projectiles in current area.',
    usage: '/clear',
    aliases: ['killall'],
  },
  boss: {
    name: 'boss',
    category: 'PERFORMANCE',
    desc: 'Spawn or teleport to boss arena and select phase.',
    usage: '/boss [bramblemaw] [phase1|phase2|intro]',
  },
  bosshp: {
    name: 'bosshp',
    category: 'PERFORMANCE',
    desc: 'Set active boss HP percentage to test phase transitions.',
    usage: '/bosshp <percentage: 1-100>',
  },
  bossreset: {
    name: 'bossreset',
    category: 'PERFORMANCE',
    desc: 'Reset active boss encounter.',
    usage: '/bossreset',
  },
  killplayer: {
    name: 'killplayer',
    category: 'PERFORMANCE',
    desc: 'Safely kill player to test death screen and death cause readouts.',
    usage: '/killplayer [reason]',
  },
  spawngrave: {
    name: 'spawngrave',
    category: 'PERFORMANCE',
    desc: 'Test player death currency drop (grave) and retrieval.',
    usage: '/spawngrave [amount]',
  },
  stress: {
    name: 'stress',
    category: 'PERFORMANCE',
    desc: 'Run developer stress test (enemies, loot, particles, clear).',
    usage: '/stress <enemies|loot|particles|clear> [count]',
  },
  perf: {
    name: 'perf',
    category: 'PERFORMANCE',
    desc: 'Toggle developer performance telemetry HUD (FPS, draw calls, entities).',
    usage: '/perf',
  },
  gamepad: {
    name: 'gamepad',
    category: 'PERFORMANCE',
    desc: 'Display controller diagnostic telemetry (axes, deadzones, right-stick aim).',
    usage: '/gamepad',
    aliases: ['controller'],
  },
};

export class DevCommands {
  static gearCycleInterval = null;

  static execute(game, rawInput, log = console.log) {
    if (!rawInput || !rawInput.trim()) return;

    let clean = rawInput.trim();
    if (clean.startsWith('/')) clean = clean.substring(1);
    const parts = clean.split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Resolve alias or direct match
    let matchedCmd = null;
    for (const [key, def] of Object.entries(COMMAND_DEFINITIONS)) {
      if (key === cmdName || (def.aliases && def.aliases.includes(cmdName))) {
        matchedCmd = key;
        break;
      }
    }

    if (!matchedCmd) {
      log(`Unknown command: "/${cmdName}". Type "/help" for available commands.`, 'error');
      return;
    }

    try {
      const result=DevCommands.handlers[matchedCmd](game, args, log);
      if(result?.catch)return result.catch(err=>log(`Error running /${cmdName}: ${err.message}`,'error'));
      return result;
    } catch (err) {
      log(`Error running /${cmdName}: ${err.message}`, 'error');
    }
  }

  static handlers = {
    async devlab(game,args,log){
      if(typeof game.openDevLab!=='function'){log('The lab is not ready yet. Finish loading the game first.','error');return;}
      await game.openDevLab();
      log('MOSSDEV opened. Return to Adventure / Survival keeps your original save unchanged.','green');
    },
    arpgbuild(game,args,log) {
      const id=args[0];
      if(!id || id==='list') { for(const [key,d] of Object.entries({...LEGENDARY_DEFS,...PRISMATIC_DEFS})) log(key+' — '+d.name+' ('+d.element+')','green'); return; }
      const it=makeBuildItem(id,game.inv.cls,Math.max(1,game.inv.level));
      if(!it) {log('Unknown build. Use /arpgbuild list.','yellow');return;}
      if(!game.pickupItem(it)) {log('Bag full. Make room first.','yellow');return;}
      game.save();log('Added '+it.name+'. Equip it from Inventory (E).','green');
    },
    allitems(game, args, log) {
      const val = args[0]?.toLowerCase();
      const enable = val === 'on' ? true : val === 'off' ? false : !game.flags.allitems;
      game.flags.allitems = enable;
      game.flags.creativeMode = enable;
      game.settings.devMode = true;
      saveSettings(game.settings);
      game.devConsole?.close();
      game.ui.invTab = 'bag';
      game.ui.openInventory();
      log(`All-Items Creative Browser ${enable ? 'UNLOCKED' : 'LOCKED'}. Pull any weapon, gear, tool, or resource directly from your inventory.`, enable ? 'green' : 'yellow');
      game.ui.toast && game.ui.toast(enable ? 'All-Items Unlocked' : 'All-Items Locked', enable ? 'Browse & pull any item directly from inventory (E).' : 'Creative catalogue closed.', 2.4);
    },
    // ---------------------------------------------------------------- CHARACTER HANDLERS
    help(game, args, log) {
      if (args[0]) {
        const query = args[0].toUpperCase().replace(/^\//, '');
        // 1. Is it a category?
        if (COMMAND_CATEGORIES.includes(query)) {
          log(`=== COMMAND CATEGORY: [${query}] ===`, 'gold');
          for (const [key, def] of Object.entries(COMMAND_DEFINITIONS)) {
            if (def.category === query) {
              log(`/${def.name.padEnd(16)} - ${def.desc}`, 'info');
              log(`   Usage: ${def.usage}`, 'cyan');
            }
          }
          return;
        }

        // 2. Is it a command?
        const target = args[0].toLowerCase().replace(/^\//, '');
        let def = COMMAND_DEFINITIONS[target];
        if (!def) {
          for (const d of Object.values(COMMAND_DEFINITIONS)) {
            if (d.aliases && d.aliases.includes(target)) { def = d; break; }
          }
        }

        if (!def) {
          log(`No help entry for "${args[0]}". Valid categories: ${COMMAND_CATEGORIES.join(', ')}`, 'error');
          return;
        }

        log(`Command: /${def.name} [Category: ${def.category}]`, 'gold');
        log(`Usage: ${def.usage}`, 'cyan');
        log(`Description: ${def.desc}`, 'info');
        if (def.aliases) log(`Aliases: ${def.aliases.map(a => '/' + a).join(', ')}`, 'info');
        return;
      }

      log('=== MOSSLING DEVELOPER TESTING COMMANDS ===', 'gold');
      log('Commands are organized into 8 categories. Type /help <category> to list commands:', 'info');
      for (const cat of COMMAND_CATEGORIES) {
        const count = Object.values(COMMAND_DEFINITIONS).filter(d => d.category === cat).length;
        log(`• ${cat.padEnd(14)} (${count} commands) - e.g. /help ${cat.toLowerCase()}`, 'cyan');
      }
      log('Quick shortcuts: /devroom, /god, /noclip, /giveall, /rollweapon, /tp village', 'yellow');
    },

    character(game, args, log) {
      const summary = ProfileLab.getProfileSummary(game);
      log('=== ACTIVE CHARACTER PROFILE ===', 'gold');
      log(`Name: ${summary.name} | Class: ${summary.classId.toUpperCase()} | Level: ${summary.level} (XP: ${summary.xp})`, 'info');
      log(`Character ID: ${summary.id}`, 'cyan');
      log(`Schema: v${summary.schemaVersion} | Revision: ${summary.revision} | Playtime: ${summary.playTime}s`, 'info');
      log(`Coins: ${summary.coins} | Gear: ${summary.equippedCount}/9 equipped, ${summary.bagCount}/30 in bag`, 'info');
      log(`Discovered Bellstones: ${summary.discoveredBellstones.join(', ') || 'None'}`, 'dim');
    },

    switchcharacter(game, args, log) {
      if (!args[0]) {
        log('Usage: /switchcharacter <id|name>', 'yellow');
        return;
      }
      const switched = ProfileLab.switchProfile(game, args[0]);
      log(`Switched to character: "${switched.name}" (${switched.classId}, Level ${switched.inventory.level}).`, 'green');
      game.ui.toast('Character Switched', `${switched.name} (${switched.classId})`, 2.0);
    },

    cloneprofile(game, args, log) {
      const name = args.join(' ').trim() || null;
      const cloned = ProfileLab.cloneCurrentProfile(game, name);
      log(`Cloned profile successfully: "${cloned.name}" (New ID: ${cloned.id}). Original remains untouched.`, 'green');
      game.ui.toast('Profile Cloned', cloned.name, 2.0);
    },

    createtestprofile(game, args, log) {
      if (!args[0] || !args[1]) {
        log('Usage: /createtestprofile <name> <samurai|archer|witch|soulbound|gunslinger>', 'yellow');
        return;
      }
      const name = args[0];
      const classId = args[1].toLowerCase();
      if (!Object.hasOwn(CLASSES, classId)) {
        log('Class must be one of: samurai, archer, witch, soulbound, gunslinger.', 'error');
        return;
      }
      const p = ProfileLab.createTestProfile(game, name, classId);
      log(`Created test profile "${p.name}" (${p.classId}). Switch with /switchcharacter ${p.name}`, 'green');
    },

    level(game, args, log) {
      if (!args[0]) {
        log('Usage: /level <number>', 'yellow');
        return;
      }
      const target = Math.max(1, Math.min(MAX_LEVEL, parseInt(args[0], 10)));
      game.inv.level = target;
      game.inv.sp = Math.max(0, target - 1);
      game.inv.skills = [1, target >= 3 ? 1 : 0, target >= 6 ? 1 : 0];
      if (target >= 6) game.inv.skills = [1, 1, 1];
      game.inv.maxHp = Math.round(60 + (target - 1) * 8);
      game.inv.hp = game.inv.maxHp;
      game.inv.xp = 0;
      game.calcStats && game.calcStats();
      game.ui?.updateVitals && game.ui.updateVitals();
      game.save();
      log(`Player level set to ${target}. Health: ${game.inv.hp}/${game.inv.maxHp}`, 'green');
    },

    levelup(game, args, log) {
      const count = Math.max(1, parseInt(args[0], 10) || 1);
      DevCommands.handlers.level(game, [Math.min(MAX_LEVEL, (game.inv.level || 1) + count)], log);
    },

    leveldown(game, args, log) {
      const count = Math.max(1, parseInt(args[0], 10) || 1);
      DevCommands.handlers.level(game, [Math.max(1, (game.inv.level || 1) - count)], log);
    },

    xp(game, args, log) {
      const amount = parseInt(args[0], 10) || 100;
      game.gainXp ? game.gainXp(amount) : (game.inv.xp = (game.inv.xp || 0) + amount);
      log(`Added ${amount} XP. Total: ${game.inv.xp}/${xpNeed(game.inv.level)}`, 'green');
    },

    resetxp(game, args, log) {
      game.inv.xp = 0;
      game.ui.updateVitals && game.ui.updateVitals();
      game.save();
      log('Current level experience reset to 0.', 'yellow');
    },

    coins(game, args, log) {
      const amount = parseInt(args[0], 10);
      if (isNaN(amount)) { log('Usage: /coins <number>', 'yellow'); return; }
      game.inv.coins = Math.max(0, amount);
      game.ui.updateVitals && game.ui.updateVitals();
      game.save();
      log(`Pips set to: ${game.inv.coins}`, 'green');
    },

    respec(game, args, log) {
      const abilities = CLASSES[game.inv.cls]?.abilities || [];
      respecInventory(game.inv, abilities);
      game.calcStats && game.calcStats();
      game.ui.updateVitals && game.ui.updateVitals();
      game.save();
      log(`Refunded points cleanly. Available SP: ${game.inv.sp}, Stat Points: ${game.inv.statPoints || 0}`, 'green');
      game.ui.toast('Points Refunded', 'Abilities and stat points reset.', 2.0);
    },

    forcesave(game, args, log) {
      game.save();
      log('Force save snapshot committed successfully.', 'green');
    },

    reloadprofile(game, args, log) {
      if (!game.profile) { log('No profile to reload.', 'error'); return; }
      ProfileLab.switchProfile(game, game.profile.id);
      log('Active profile reloaded from storage.', 'green');
    },

    validatesave(game, args, log) {
      const res = ProfileLab.validateSaveData(game);
      log(`Save Validation: PASS (Characters: ${res.charactersValidated}, Items checked: ${res.itemsValidated}).`, 'green');
    },

    testmigration(game, args, log) {
      const res = ProfileLab.simulateMigrationTest();
      log(`Migration Simulation: PASS (Target schema: v${res.schemaVersion}, Character: "${res.characterName}" ${res.characterClass} Lv${res.level}).`, 'green');
    },

    testcorruptfallback(game, args, log) {
      const res = ProfileLab.simulateCorruptRecoveryTest();
      log(`Corrupt Recovery Simulation: ${res.recovered ? 'PASS' : 'FAIL'} (${res.notice})`, res.recovered ? 'green' : 'error');
    },

    // ---------------------------------------------------------------- LOOT & INVENTORY HANDLERS
    give(game, args, log) {
      if (!args[0]) {
        log('Usage: /give <item_or_mat_id> [count]', 'yellow');
        return;
      }

      const id = args[0].toLowerCase();
      const count = Math.max(1, parseInt(args[1], 10) || 1);
      const inv = game.inv;

      // 1. Crafting materials
      if (MATS[id]) {
        inv.mats = inv.mats || {};
        inv.mats[id] = (inv.mats[id] || 0) + count;
        log(`Granted ${count} × ${MATS[id].name} (Total: ${inv.mats[id]}).`, 'green');
        game.save();
        return;
      }

      // 2. Consumables and currencies
      if (id === 'potion' || id === 'potions') {
        inv.potions = Math.min(inv.maxPotions || 3, (inv.potions || 0) + count);
        log(`Restocked potions to ${inv.potions}/${inv.maxPotions}.`, 'green');
        game.save();
        return;
      }
      if (id === 'key' || id === 'keys') {
        inv.keys = (inv.keys || 0) + count;
        log(`Granted ${count} small key(s). Total: ${inv.keys}.`, 'green');
        game.save();
        return;
      }
      if (id === 'bigkey') {
        inv.bigkey = true;
        log('Granted Thornwood Key (bigkey).', 'green');
        game.save();
        return;
      }
      if (id === 'bellows') {
        inv.bellows = true;
        log('Granted Gustbellows.', 'green');
        game.save();
        return;
      }
      if (id === 'vessel' || id === 'vessels') {
        inv.vessels = (inv.vessels || 0) + count;
        if (typeof game.recalc === 'function') {
          game.recalc();
        } else {
          inv.maxHp = 60 + inv.vessels * 10;
        }
        log(`Granted ${count} Vessel Heart(s). Total: ${inv.vessels}, Max HP: ${inv.maxHp}.`, 'green');
        game.save();
        return;
      }
      if (id === 'chime' || id === 'verdant') {
        inv.chimes = inv.chimes || [];
        if (!inv.chimes.includes('verdant')) inv.chimes.push('verdant');
        log('Granted Verdant Chime.', 'green');
        game.save();
        return;
      }

      // 3. Base Weapons / Armors
      const base = baseById(id);
      if (base) {
        for (let i = 0; i < count; i++) {
          const it = genItem({ developer:true, level: inv.level || 5, rarity: 1 });
          // Force base
          it.base = base.id;
          it.name = base.name;
          it.kind = base.kind || null;
          it.slot = base.kind ? 'weapon' : base.slot;
          identifyItem(it, game.profile?.id);
          game.pickupItem(it);
        }
        log(`Granted ${count} × ${base.name}.`, 'green');
        return;
      }

      // 4. Legendary items
      const leg = LEGENDARIES.find(l => l.id === id || l.u === id);
      if (leg) {
        const it = genItem({ developer:true, level: leg.lvl || 5, rarity: 4 });
        it.name = leg.name;
        it.unique = leg.u;
        it.utext = leg.text;
        identifyItem(it, game.profile?.id);
        game.pickupItem(it);
        log(`Granted Legendary: [★ ${leg.name}].`, 'gold');
        return;
      }

      log(`Unknown item or material "${id}". Type /recipes or check /give item IDs.`, 'error');
    },

    giveall(game, args, log) {
      const inv = game.inv;
      inv.mats = inv.mats || {};
      for (const k of Object.keys(MATS)) inv.mats[k] = (inv.mats[k] || 0) + 20;
      inv.mats.shard = 999;
      inv.mats.thornheart = 99;

      // Tools & keys
      inv.potions = inv.maxPotions || 3;
      inv.keys = 9;
      inv.bigkey = true;
      inv.bellows = true;
      inv.galeValve = true;
      if (!inv.chimes.includes('verdant')) inv.chimes.push('verdant');
      inv.coins = Math.max(inv.coins || 0, 500);

      // Unlock all recipes
      RECIPES.forEach(r => learn(game, r.id, true));

      // Representative high-tier weapons (at least 3 sample weapons)
      const w1 = rollWeaponWithAffixes({ cls: inv.cls || 'samurai', level: inv.level || 10, targetTier: 'epic', affixCount: 4 });
      const w2 = rollWeaponWithAffixes({ cls: inv.cls || 'samurai', level: inv.level || 10, targetTier: 'relic', affixCount: 4 });
      const w3 = rollWeaponWithAffixes({ cls: inv.cls || 'samurai', level: inv.level || 10, targetTier: 'prismatic', affixCount: 4 });
      identifyItem(w1, game.profile?.id);
      identifyItem(w2, game.profile?.id);
      identifyItem(w3, game.profile?.id);
      game.pickupItem(w1);
      game.pickupItem(w2);
      game.pickupItem(w3);

      game.save();
      log('Dev Package granted: 999 shards, 99 thornhearts, tools, keys, all recipes, and Epic/Relic/Prismatic weapons.', 'green');
      game.ui.toast('Dev Package Granted', 'All materials, keys, recipes, and test gear.', 2.0);
    },

    rollweapon(game, args, log) {
      const targetTier = args[0] ? args[0].toLowerCase() : null;
      if (targetTier && !AFFIX_RARITY_TIERS[targetTier]) {
        log(`Unknown tier "${targetTier}". Available: ${TIER_ORDER.join(', ')}`, 'error');
        return;
      }

      const ilvl = parseInt(args[1], 10) || game.inv.level || 5;
      const weapon = rollWeaponWithAffixes({
        cls: game.inv.cls || 'samurai',
        level: ilvl,
        targetTier,
        affixCount: 4,
      });

      identifyItem(weapon, game.profile?.id);
      game.pickupItem(weapon);
      log(`Rolled Weapon: [${weapon.highestAffixToken} ${weapon.name}] (ilvl ${weapon.ilvl})`, 'gold');
    },

    rollaffix(game, args, log) {
      if (!args[0]) {
        log(`Usage: /rollaffix <tier> [stat_id]. Tiers: ${TIER_ORDER.join(', ')}`, 'yellow');
        return;
      }
      const tierId = args[0].toLowerCase();
      if (!AFFIX_RARITY_TIERS[tierId]) {
        log(`Invalid tier "${tierId}". Valid: ${TIER_ORDER.join(', ')}`, 'error');
        return;
      }
      const statKey = args[1] || 'dmgPct';
      const affix = rollAffixInstance(statKey, game.inv.level || 5, 'weapon', tierId);
      log(`Affix Rolled: [${affix.tier.token} ${affix.name}] (+${affix.value}${affix.isPct ? '%' : ''}) Tier: ${affix.tier.name} (${affix.tier.weight} / 1M)`, 'cyan');
      if (affix.qualitative) log(`★ Qualitative Modifier: "${affix.qualitative.title}" - ${affix.qualitative.desc}`, 'gold');
    },

    perfectroll(game, args, log) {
      const baseId = (args[0] || 'nodachi').toLowerCase();
      const base = baseById(baseId) || WEAPONS[0];
      const ilvl = game.inv.level || 10;
      const w = rollWeaponWithAffixes({
        baseId: base.id,
        level: ilvl,
        targetTier: 'prismatic',
        affixCount: 4,
        forceMaxRolls: true,
      });
      identifyItem(w, game.profile?.id);
      game.pickupItem(w);
      log(`Perfect Roll Created: [🌈 ${w.name}] with max rolls and Prismatic chase affixes!`, 'gold');
    },

    minroll(game, args, log) {
      const baseId = (args[0] || 'rustkatana').toLowerCase();
      const base = baseById(baseId) || WEAPONS[0];
      const ilvl = game.inv.level || 1;
      const w = rollWeaponWithAffixes({
        baseId: base.id,
        level: ilvl,
        targetTier: 'common',
        affixCount: 1,
        forceMinRolls: true,
      });
      identifyItem(w, game.profile?.id);
      game.pickupItem(w);
      log(`Minimum Roll Created: [◇ ${w.name}] with lowest tier affixes.`, 'dim');
    },

    duplicate(game, args, log) {
      const it = game.inv.equip.weapon || game.inv.bag[0];
      if (!it) { log('No item equipped or in bag to duplicate.', 'error'); return; }
      const dup = copy(it);
      dup.itemInstanceId = undefined; // Force generate new identity
      identifyItem(dup, game.profile?.id, 'dev_duplicate');
      game.pickupItem(dup);
      log(`Duplicated: [${dup.name}] (New ID: ${dup.itemInstanceId})`, 'green');
    },

    deleteitem(game, args, log) {
      const target = args[0] ? args[0].toLowerCase() : 'weapon';
      if (EQUIPMENT_SLOTS.includes(target) || target === 'helm' || target === 'armor' || target === 'charm') {
        const slot = target === 'helm' ? 'head' : target === 'armor' ? 'chest' : target === 'charm' ? 'necklace' : target;
        if (!game.inv.equip[slot]) { log(`Slot "${slot}" is already empty.`, 'yellow'); return; }
        delete game.inv.equip[slot];
        game.calcStats && game.calcStats();
        game.save();
        log(`Cleared equipment slot "${slot}".`, 'green');
        return;
      }

      const idx = parseInt(target, 10);
      if (!isNaN(idx) && game.inv.bag[idx]) {
        const removed = game.inv.bag.splice(idx, 1)[0];
        game.save();
        log(`Removed "${removed.name}" from bag index ${idx}.`, 'green');
        return;
      }
      log(`Usage: /deleteitem <slot|bagIndex>`, 'yellow');
    },

    inspectitem(game, args, log) {
      const it = game.inv.equip.weapon || game.inv.bag[0];
      if (!it) { log('No item equipped or in bag to inspect.', 'yellow'); return; }
      log(`=== ITEM METADATA: ${it.name} ===`, 'gold');
      log(`Instance ID: ${it.itemInstanceId}`, 'cyan');
      log(`Definition: ${it.definitionId || it.base} | Slot: ${it.slot} | Rarity: ${it.r} | iLvl: ${it.ilvl}`, 'info');
      log(`Upgrade Level: +${it.upgradeLevel || 0} (${Math.round((reinforcementMultiplier(it) - 1) * 100)}% damage bonus)`, 'info');
      log(`Provenance: ${JSON.stringify(it.provenance || {})}`, 'dim');
      log(`Crafted Mutations: ${JSON.stringify(it.craftedMutations || [])}`, 'info');
      log(`Trade Valuation Score: ${calculateTradeValuation(it).toLocaleString()} appraisal units`, 'gold');
    },

    clearbag(game, args, log) {
      const count = (game.inv.bag || []).length;
      game.inv.bag = [];
      game.save();
      log(`Cleared ${count} item(s) from backpack. Equipped gear was preserved.`, 'green');
    },

    upgrade(game, args, log) {
      const lvl = parseInt(args[0], 10);
      const it = game.inv.equip.weapon;
      if (!it) { log('No weapon currently equipped to upgrade.', 'error'); return; }
      if (isNaN(lvl) || lvl < 0 || lvl > 20) { log('Usage: /upgrade <0-20>', 'yellow'); return; }
      it.upgradeLevel = lvl;
      game.calcStats && game.calcStats();
      game.save();
      log(`Weapon upgrade set to +${lvl} (+${Math.round((reinforcementMultiplier(it) - 1) * 100)}% base damage).`, 'green');
    },

    droptest(game, args, log) {
      const count = Math.max(1, parseInt(args[0], 10) || 1000);
      const targetSource = args[1] || 'virtual';
      log(`Running in-memory loot simulation (${count.toLocaleString()} rolls, source: ${targetSource})...`, 'cyan');
      const results = simulateAffixRolls(count, { mf: game.pstats?.mf || 0 });
      const report = formatSimulationReport(results);
      report.split('\n').forEach(line => log(line, 'info'));
    },

    affixes(game, args, log) {
      log('=== MOSSLING STAT / AFFIX RARITY FOUNDATION (8 TIERS) ===', 'gold');
      for (const tierId of TIER_ORDER) {
        const t = AFFIX_RARITY_TIERS[tierId];
        log(`${t.token} ${t.name.padEnd(12)} Weight: ${t.weight.toString().padStart(7)} / 1M (${(t.weight / 10000).toFixed(4)}%) | Mult: ${t.multRange[0]}x - ${t.multRange[1]}x`, 'cyan');
      }
    },

    // ---------------------------------------------------------------- COMBAT HANDLERS
    god(game, args, log) {
      game.godMode = !game.godMode;
      if (game.player) game.player.godMode = game.godMode;
      if (game.godMode) {
        game.inv.hp = game.inv.maxHp;
        game.res = 100;
        game.surge = 100;
        log('God Mode: ENABLED (Invulnerability, full resources, 0 damage taken)', 'green');
        game.ui.toast('God Mode Enabled', 'Immune to all incoming damage.', 2.0);
      } else {
        log('God Mode: DISABLED', 'yellow');
        game.ui.toast('God Mode Disabled', 'Normal vulnerability restored.', 2.0);
      }
    },

    noclip(game, args, log) {
      game.noclip = !game.noclip;
      if (game.player) game.player.noclip = game.noclip;
      if (game.noclip) {
        log('NoClip: ENABLED (Passing through walls, water, props and obstacles)', 'green');
        game.ui.toast('NoClip Enabled', 'Collision disabled.', 2.0);
      } else {
        log('NoClip: DISABLED', 'yellow');
        game.ui.toast('NoClip Disabled', 'Normal collision restored.', 2.0);
      }
    },

    heal(game, args, log) {
      game.inv.hp = game.inv.maxHp;
      game.inv.potions = game.inv.maxPotions || 3;
      game.res = 100;
      game.surge = 100;
      if (game.player) {
        game.player.burn = 0;
        game.player.chill = 0;
        game.player.shock = 0;
      }
      game.ui.updateVitals && game.ui.updateVitals();
      sfx('potion');
      log(`Player healed to full health (${game.inv.hp}/${game.inv.maxHp}), energy, and potions.`, 'green');
    },

    refill(game, args, log) {
      DevCommands.handlers.heal(game, args, log);
      DevCommands.handlers.resetcd(game, args, log);
    },

    resetcd(game, args, log) {
      if (game.player) {
        game.player.abilityCds = [0, 0, 0];
        game.player.surge = 100;
      }
      log('All ability cooldowns reset to 0.', 'green');
    },

    classinfo(game, args, log) {
      const cls = game.inv.cls || 'samurai';
      const C = CLASSES[cls];
      const ps = game.pstats || {};
      log(`=== CLASS TELEMETRY: ${C.name.toUpperCase()} (${C.role}) ===`, 'gold');
      log(`Weapon Damage: ${ps.wmin}–${ps.wmax} | Attack Speed: ${ps.wspd?.toFixed(2)}`, 'cyan');
      log(`Crit Chance: ${ps.crit?.toFixed(1)}% | Crit Multiplier: +${ps.critDmg}%`, 'info');
      log(`Armour: ${ps.armor} | Life Steal: ${ps.lifesteal}% | Move Speed: +${ps.moveSpd}%`, 'info');
      log(`Cooldown Reduction: ${ps.cdr}% | Magic Find: ${ps.mf}%`, 'info');
    },

    setclass(game, args, log) {
      if (!args[0]) { log('Usage: /setclass <samurai|archer|witch|soulbound|gunslinger>', 'yellow'); return; }
      const target = args[0].toLowerCase();
      if (!CLASSES[target]) { log('Valid classes: ' + Object.keys(CLASSES).join(', ') + '.', 'error'); return; }
      game.inv.cls = target;
      if (game.profile) game.profile.classId = target;
      
      // Give starter weapon
      const w = starterWeapon(target);
      identifyItem(w, game.profile?.id);
      game.inv.equip.weapon = w;
      
      game.calcStats && game.calcStats();
      game.ui.updateVitals && game.ui.updateVitals();
      game.save();
      log(`Swapped class to ${CLASSES[target].name}. Starter weapon equipped.`, 'green');
    },

    dummylevel(game, args, log) {
      const lvl = Math.max(1, Math.min(20, parseInt(args[0], 10) || 5));
      let count = 0;
      for (const e of game.entities) {
        if (e.isDummy) { e.level = lvl; count++; }
      }
      log(`Set level of ${count} training dummies to Lv ${lvl}.`, 'green');
    },

    resetdps(game, args, log) {
      let count = 0;
      for (const e of game.entities) {
        if (e.isDummy && e.resetMetrics) { e.resetMetrics(); count++; }
      }
      log(`Reset combat telemetry on ${count} dummy target(s).`, 'green');
    },

    weapontest(game, args, log) {
      const w = game.inv.equip.weapon;
      if (!w) { log('No weapon equipped.', 'yellow'); return; }
      log(`=== WEAPON TEST DATA: ${w.name} ===`, 'gold');
      log(`Base Damage: ${w.min} - ${w.max} | Speed: ${w.spd} | Reinforcement: +${w.upgradeLevel || 0}`, 'info');
      log(`Calculated Item Power: ${itemPower(w)}`, 'cyan');
    },

    // ---------------------------------------------------------------- WORLD & TELEPORT HANDLERS
    devroom(game, args, log) {
      if (args[0] === 'exit') {
        const dest = game.devRoomPrevLocation || { area: 'overworld', spawn: 'village' };
        devStress.clear(game);
        game.warpTo(dest.area, dest.spawn || 'start');
        log(`Exited devroom. Returned to ${dest.area}.`, 'green');
        return;
      }

      // Preserve return state
      game.devRoomPrevLocation = {
        area: game.area ? game.area.id : 'overworld',
        spawn: { x: game.player?.x || 48, z: game.player?.z || 54 },
      };

      game.warpTo('devroom', 'spawn');
      log('Entered Dev Testing Facility (/devroom). All 20 labs active. Type /devroom exit to return.', 'green');
    },

    teleport(game, args, log) {
      if (!args[0]) {
        log('Usage: /teleport <location> OR /teleport <x> <z>', 'yellow');
        return;
      }

      const dest = args[0].toLowerCase();
      const numX = parseFloat(args[0]);
      const numZ = parseFloat(args[1]);

      if (!isNaN(numX) && !isNaN(numZ)) {
        if (game.player) {
          game.player.x = numX;
          game.player.z = numZ;
          game.snapCamera && game.snapCamera();
          log(`Teleported to (${numX.toFixed(1)}, ${numZ.toFixed(1)})`, 'green');
        }
        return;
      }

      const LOCATIONS = {
        village: { area: 'overworld', spawn: 'village' },
        thimblewick: { area: 'overworld', spawn: 'village' },
        forest: { area: 'overworld', spawn: { x: 20.0, z: 45.0 } },
        whisperwood: { area: 'overworld', spawn: { x: 20.0, z: 45.0 } },
        desert: { area: 'overworld', spawn: { x: 130.0, z: 65.0 } },
        sunscald: { area: 'overworld', spawn: { x: 130.0, z: 65.0 } },
        cinderpeak: { area: 'overworld', spawn: { x: 125.0, z: 25.0 } },
        shore: { area: 'overworld', spawn: { x: 30.0, z: 98.0 } },
        saltwhistle: { area: 'overworld', spawn: { x: 30.0, z: 98.0 } },
        grotto: { area: 'grotto', spawn: 'entrance' },
        dungeon: { area: 'dungeon', spawn: 'entrance' },
        rootwell: { area: 'dungeon', spawn: 'entrance' },
        boss: { area: 'dungeon', spawn: 'pre' },
        bramblemaw: { area: 'dungeon', spawn: 'pre' },
        devroom: { area: 'devroom', spawn: 'spawn' },
        // Pass 5
        conservatory: { area: 'conservatory', spawn: 'entrance' },
        canopy: { area: 'conservatory', spawn: 'canopy' },
        fen: { area: 'overworld', spawn: 'fen' },
      };

      const loc = LOCATIONS[dest];
      if (!loc) {
        log(`Unknown landmark "${dest}". Type /locations for list.`, 'error');
        return;
      }

      if (loc.area === 'devroom') {
        DevCommands.handlers.devroom(game, [], log);
        return;
      }

      game.warpTo(loc.area, loc.spawn);
      log(`Teleporting to ${dest} (${loc.area})...`, 'green');
    },

    locations(game, args, log) {
      log('=== DISCOVERABLE TELEPORT LOCATIONS ===', 'gold');
      log('Overworld: village, whisperwood, sunscald, cinderpeak, saltwhistle, grotto', 'cyan');
      log('Dungeon: rootwell (entrance), pre (boss gate)', 'cyan');
      log('Pass 5: conservatory, canopy (Cracked Conservatory), fen (Crowned Toad)', 'cyan');
      log('Special: devroom', 'yellow');
    },

    bellstone(game, args, log) {
      const id = args[0] ? args[0].toLowerCase() : 'all';
      const action = args[1] ? args[1].toLowerCase() : 'discover';

      if (id === 'all') {
        BELLSTONES.forEach(b => {
          if (!game.discoveredBellstones.includes(b.id)) game.discoveredBellstones.push(b.id);
        });
        game.save();
        log('Discovered all world Bellstones.', 'green');
        return;
      }

      const match = BELLSTONES.find(b => b.id.includes(id) || b.spawn.includes(id));
      if (!match) { log(`Unknown Bellstone "${id}". Type /bellstones.`, 'error'); return; }

      if (action === 'undiscover') {
        game.discoveredBellstones = game.discoveredBellstones.filter(bid => bid !== match.id);
        log(`Undiscovered Bellstone "${match.id}".`, 'yellow');
      } else if (action === 'warp') {
        game.warpTo(match.area, match.spawn);
        log(`Warped to Bellstone "${match.id}".`, 'green');
      } else {
        if (!game.discoveredBellstones.includes(match.id)) game.discoveredBellstones.push(match.id);
        log(`Discovered Bellstone "${match.id}".`, 'green');
      }
      game.save();
    },

    bellstones(game, args, log) {
      log('=== BELLSTONE REGISTRY ===', 'gold');
      for (const b of BELLSTONES) {
        const disc = (game.discoveredBellstones || []).includes(b.id);
        log(`• ${b.id.padEnd(22)} [${b.area}:${b.spawn}] Status: ${disc ? 'DISCOVERED' : 'LOCKED'}`, disc ? 'green' : 'dim');
      }
    },

    time(game, args, log) {
      if (!args[0]) { log('Usage: /time <dawn|day|dusk|night|fraction>', 'yellow'); return; }
      const val = args[0].toLowerCase();
      const PRESETS = { dawn: 0.25, day: 0.5, dusk: 0.65, night: 0.85 };
      const frac = PRESETS[val] !== undefined ? PRESETS[val] : parseFloat(val);

      if (isNaN(frac) || frac < 0 || frac >= 1) {
        log('Specify dawn, day, dusk, night, or fraction 0.0 - 1.0', 'error');
        return;
      }

      // Convert fraction to elapsed seconds on the 420s cycle
      game.flags.dayOffset = (frac - 0.32) * 420 - (game.time || 0);
      game.dayT = frac;
      log(`Time set to: ${val.toUpperCase()} (fraction: ${frac.toFixed(2)})`, 'green');
      game.atmosphere && game.atmosphere(0.001);
    },

    weather(game, args, log) {
      if (!args[0]) { log('Usage: /weather <clear|rain|fog|storm>', 'yellow'); return; }
      const mode = args[0].toLowerCase();
      if (mode === 'rain' || mode === 'storm') {
        game.raining = true;
        game.rainK = 1.0;
        game.weatherT = 300;
        log('Weather set to: RAIN', 'green');
      } else if (mode === 'fog') {
        game.raining = false;
        game.rainK = 0;
        if (game.pr?.postMat?.uniforms?.fogAmt) game.pr.postMat.uniforms.fogAmt.value = 0.35;
        log('Weather set to: FOG', 'green');
      } else {
        game.raining = false;
        game.rainK = 0;
        if (game.pr?.postMat?.uniforms?.fogAmt) game.pr.postMat.uniforms.fogAmt.value = 0;
        log('Weather set to: CLEAR', 'green');
      }
      game.atmosphere && game.atmosphere(0.001);
    },

    resetroom(game, args, log) {
      if (game.resetRoom) game.resetRoom();
      log('Current room state reset.', 'green');
    },

    // ---------------------------------------------------------------- CRAFTING HANDLERS
    recipe(game, args, log) {
      if (!args[0]) { log('Usage: /recipe <id|all> [unlock|lock]', 'yellow'); return; }
      const id = args[0].toLowerCase();
      const action = args[1] ? args[1].toLowerCase() : 'unlock';

      if (id === 'all') {
        if (action === 'lock') {
          game.inv.recipes = [];
          log('Locked all crafting recipes.', 'yellow');
        } else {
          RECIPES.forEach(r => learn(game, r.id, true));
          log('Unlocked all crafting recipes.', 'green');
        }
        game.save();
        return;
      }

      const r = recipeById(id);
      if (!r) { log(`Unknown recipe "${id}". Type /recipes.`, 'error'); return; }

      if (action === 'lock') {
        game.inv.recipes = (game.inv.recipes || []).filter(rid => rid !== id);
        log(`Locked recipe "${r.name}".`, 'yellow');
      } else {
        learn(game, r.id, false);
        log(`Unlocked recipe "${r.name}".`, 'green');
      }
      game.save();
    },

    recipes(game, args, log) {
      log('=== DISCOVERABLE CRAFTING RECIPES ===', 'gold');
      for (const r of RECIPES) {
        const unlocked = knows(game.inv, r.id);
        log(`• ${r.id.padEnd(16)} [${r.name}] (${r.kind}) Status: ${unlocked ? 'KNOWN' : 'LOCKED'}`, unlocked ? 'green' : 'dim');
      }
    },

    materials(game, args, log) {
      const count = parseInt(args[0], 10) || 500;
      game.inv.mats = game.inv.mats || {};
      for (const k of Object.keys(MATS)) {
        game.inv.mats[k] = (game.inv.mats[k] || 0) + count;
      }
      game.save();
      sfx('pipbig');
      log(`Added +${count} to all crafting materials.`, 'green');
    },

    clearmaterials(game, args, log) {
      game.inv.mats = { shard: 0, thornheart: 0, echo: 0, ember: 0, sailcloth: 0 };
      game.save();
      log('Crafting pouch cleared of all materials.', 'yellow');
    },

    transferengraving(game, args, log) {
      log('Use the Engraving Transfer Anvil in the Crafting Lab or Posy Workbench to transfer engravings.', 'cyan');
    },

    // ---------------------------------------------------------------- QUEST & ECHO HANDLERS
    quest(game, args, log) {
      const action = args[0] ? args[0].toLowerCase() : 'status';
      if (action === 'status') {
        log(`Current Main Stage: Stage ${game.flags.stage || 0} (${game.story?.objective() || ''})`, 'gold');
        log(`Side Quests: Mill: ${game.flags.q_mill || 0} | Camp: ${game.flags.q_camp || 0} | Pier: ${game.flags.q_pier || 0}`, 'info');
        return;
      }

      if (action === 'stage') {
        const target = parseInt(args[1], 10);
        if (isNaN(target) || target < 0 || target > 3) { log('Usage: /quest stage <0-3>', 'yellow'); return; }
        // Backup before destructive change
        ProfileLab.cloneCurrentProfile(game, `${game.profile?.name}_PreQuestEdit`);
        game.flags.stage = target;
        game.save();
        log(`Main Story Stage set to ${target}. Backup profile saved.`, 'green');
        return;
      }

      if (action === 'reset') {
        const id = args[1]?.toLowerCase();
        if (id === 'mill') { delete game.flags.q_mill; delete game.flags.windmill; }
        else if (id === 'camp') delete game.flags.q_camp;
        else if (id === 'pier') delete game.flags.q_pier;
        game.save();
        log(`Reset quest "${id}".`, 'yellow');
        return;
      }

      if (action === 'complete') {
        const id = args[1]?.toLowerCase();
        if (id === 'mill') { game.flags.q_mill = 2; game.flags.windmill = true; }
        else if (id === 'camp') game.flags.q_camp = 2;
        else if (id === 'pier') game.flags.q_pier = 2;
        game.save();
        log(`Marked quest "${id}" completed.`, 'green');
        return;
      }

      log('Usage: /quest <status|stage <0-3>|reset <mill|camp|pier>|complete <mill|camp|pier>>', 'yellow');
    },

    flags(game, args, log) {
      log('=== WORLD PROGRESSION FLAGS ===', 'gold');
      log(JSON.stringify(game.flags, null, 2), 'info');
    },

    talk(game, args, log) {
      const id = args[0]?.toLowerCase() || 'tamsin';
      const npc = game.entities.find(e => e.id === id);
      if (npc && npc.interact) {
        npc.interact();
        log(`Triggered dialogue with NPC "${id}".`, 'green');
      } else {
        log(`NPC "${id}" not found in current area. Try /tp village first.`, 'yellow');
      }
    },

    echo(game, args, log) {
      const mode = args[0]?.toLowerCase() || 'toggle';
      game.inv.chimes = game.inv.chimes || [];
      const has = game.inv.chimes.includes('verdant');

      if (mode === 'on' || (!has && mode === 'toggle')) {
        if (!has) game.inv.chimes.push('verdant');
        log('Verdant Chime Echo: ACQUIRED. Gusts will now echo 1.5s later.', 'green');
      } else if (mode === 'off' || (has && mode === 'toggle')) {
        game.inv.chimes = game.inv.chimes.filter(c => c !== 'verdant');
        log('Verdant Chime Echo: REMOVED.', 'yellow');
      }
      game.save();
    },

    element(game, args, log) {
      const el = (args[0] || 'fire').toLowerCase();
      const p = game.player;
      if (!p) return;
      if (el === 'fire' || el === 'burn') {
        game.fx.burst(p.x, 0.5, p.z, 20, [0xff5a4a, 0xffb347], 3);
        log('Triggered Fire / Burn element burst.', 'green');
      } else if (el === 'frost' || el === 'chill') {
        game.fx.ring(p.x, p.z, 0.5, 3.0, 0x9ad8ff, 0.5);
        log('Triggered Frost / Chill ring.', 'cyan');
      } else if (el === 'shock') {
        game.fx.sparks(p.x, 0.5, p.z, 0, 15, 0xffd25e);
        log('Triggered Lightning Shock sparks.', 'gold');
      } else {
        game.gust(p, 10);
        log('Triggered Wind Gust.', 'green');
      }
    },

    // ---------------------------------------------------------------- VISUAL & EQUIPMENT HANDLERS
    preset(game, args, log) {
      const p = (args[0] || 'default').toLowerCase();
      const s = game.settings || {};
      if (p === 'low') {
        s.quality = 'low';
        s.pixel = 4;
        s.shake = 0;
        s.numbers = false;
        log('Applied visual preset: LOW (Fastest performance, chunky pixels, disabled shake).', 'green');
      } else if (p === 'high' || p === 'max') {
        s.quality = 'high';
        s.pixel = 2;
        s.shake = 1;
        s.numbers = true;
        log('Applied visual preset: HIGH (Fine 2x pixels, high shadows, full shake).', 'green');
      } else {
        s.quality = 'high';
        s.pixel = 0;
        s.shake = 1;
        s.numbers = true;
        log('Applied visual preset: DEFAULT (Balanced auto pixel size, shadows).', 'green');
      }
      saveSettings(s);
      applySettings(s, game);
    },

    zoom(game, args, log) {
      const z = parseFloat(args[0]);
      if (isNaN(z) || z < 0.5 || z > 2.5) { log('Usage: /zoom <0.75-1.5>', 'yellow'); return; }
      game.settings.zoom = z;
      game.camZoom = z;
      game.pr.setViewHeight(game.baseVH * z);
      saveSettings(game.settings);
      log(`Camera zoom distance set to ${z.toFixed(2)}.`, 'green');
    },

    pixel(game, args, log) {
      const px = parseInt(args[0], 10);
      if (isNaN(px) || ![0, 2, 3, 4, 5].includes(px)) { log('Usage: /pixel <0|2|3|4|5>', 'yellow'); return; }
      game.settings.pixel = px;
      game.pr.forceScale = px || null;
      game.pr.resize();
      saveSettings(game.settings);
      log(`Pixel size set to ${px === 0 ? 'Auto' : px + 'x'}.`, 'green');
    },

    shadows(game, args, log) {
      const mode = (args[0] || 'high').toLowerCase();
      game.settings.quality = mode === 'low' ? 'low' : 'high';
      applySettings(game.settings, game);
      saveSettings(game.settings);
      log(`Shadow map resolution set to ${game.settings.quality.toUpperCase()}.`, 'green');
    },

    equipslot(game, args, log) {
      if (!args[0] || !args[1]) {
        log(`Usage: /equipslot <slot> <item_id>. Slots: ${EQUIPMENT_SLOTS.join(', ')}`, 'yellow');
        return;
      }
      const slot = args[0].toLowerCase();
      const id = args[1].toLowerCase();
      const base = baseById(id);
      if (!base) { log(`Unknown base item "${id}".`, 'error'); return; }

      const isW = !!base.kind;
      const it = genItem({ developer:true, level: game.inv.level || 5, rarity: 2, slot: isW ? 'weapon' : 'charm' });
      it.base = base.id;
      it.name = base.name;
      it.slot = slot;
      if (slot === 'weapon') {
        it.min = it.min ?? 10;
        it.max = it.max ?? 15;
        it.spd = it.spd ?? (base.spd || 1.0);
      }
      identifyItem(it, game.profile?.id);
      game.inv.equip = game.inv.equip || {};
      game.inv.equip[slot] = it;
      game.calcStats && game.calcStats();
      game.save();
      log(`Equipped [${it.name}] into canonical slot "${slot}".`, 'green');
    },

    unequip(game, args, log) {
      const slot = (args[0] || 'weapon').toLowerCase();
      if (game.inv.equip[slot]) {
        const it = game.inv.equip[slot];
        delete game.inv.equip[slot];
        game.inv.bag.push(it);
        game.calcStats && game.calcStats();
        game.save();
        log(`Unequipped "${it.name}" from ${slot} to bag.`, 'green');
      } else {
        log(`Slot "${slot}" is already empty.`, 'yellow');
      }
    },

    cyclegear(game, args, log) {
      if (args[0] === 'stop' && DevCommands.gearCycleInterval) {
        clearInterval(DevCommands.gearCycleInterval);
        DevCommands.gearCycleInterval = null;
        log('Gear cycling stopped.', 'yellow');
        return;
      }

      if (DevCommands.gearCycleInterval) {
        clearInterval(DevCommands.gearCycleInterval);
      }

      let step = 0;
      const bases = [...WEAPONS, ...ARMORS];
      log('Starting automated gear appearance cycling. Type /cyclegear stop to end.', 'green');

      DevCommands.gearCycleInterval = setInterval(() => {
        if (!game.player || !game.inv) return;
        const b = bases[step % bases.length];
        const it = genItem({ developer:true, level: 5, rarity: (step % 5) });
        it.base = b.id;
        it.name = b.name;
        it.slot = b.kind ? 'weapon' : b.slot;
        identifyItem(it, game.profile?.id);
        game.inv.equip[it.slot] = it;
        game.calcStats && game.calcStats();
        step++;
      }, 700);
    },

    paperdoll(game, args, log) {
      game.ui.openInventory && game.ui.openInventory();
      log('Opened inventory and paper-doll equipment preview.', 'cyan');
    },

    // ---------------------------------------------------------------- PERFORMANCE & ENEMIES HANDLERS
    spawn(game, args, log) {
      if (!args[0]) {
        log(`Usage: /spawn <enemy_kind> [count] [level] [elite_mod]`, 'yellow');
        return;
      }
      const kind = args[0].toLowerCase();
      const count = Math.max(1, Math.min(50, parseInt(args[1], 10) || 1));
      const isElite = args.some(a => String(a).toLowerCase() === 'elite') || !!args[3];
      const level = parseInt(args[2], 10) || game.inv?.level || 1;

      const p = game.player || { x: 0, z: 0, facing: 0 };
      let spawned = 0;
      const f = p.facing || 0;
      for (let i = 0; i < count; i++) {
        const dist = 3.0 + (i * 0.8);
        const ang = f + (i - (count - 1) / 2) * 0.35;
        const x = p.x + Math.sin(ang) * dist;
        const z = p.z + Math.cos(ang) * dist;

        if (typeof game.spawnEnemy === 'function') {
          const enemy = game.spawnEnemy(kind, x, z, {
            aggro: 25,
            eliteChance: isElite ? 1.0 : 0.0,
            level,
          });
          if (isElite && enemy && !enemy.elite) {
            if (typeof game.makeElite === 'function') game.makeElite(enemy);
            enemy.elite = true;
          }
          if (enemy) spawned++;
        } else {
          try {
            const e = makeEnemy(game, kind, x, z);
            if (e) {
              e.spawnT = 0;
              e.level = level;
              if (isElite) {
                if (typeof game.makeElite === 'function') game.makeElite(e);
                e.elite = true;
              }
              game.scaleEnemy && game.scaleEnemy(e, { noElite: !isElite });
              spawned++;
            }
          } catch (err) {
            log(`Failed to spawn "${kind}": ${err.message}`, 'error');
            break;
          }
        }
      }
      sfx('spawn');
      log(`Spawned ${spawned} × ${kind}${isElite ? ' (Elite)' : ''} ahead of player.`, 'green');
    },

    enemies(game, args, log) {
      const kinds = [...BASE_ENEMY_KINDS, ...Object.keys(EXTRA_ENEMIES)];
      log('=== REGISTERED ENEMY TYPES ===', 'gold');
      log(kinds.join(', '), 'cyan');
    },

    ai(game, args, log) {
      const mode = args[0] ? args[0].toLowerCase() : 'toggle';
      if (mode === 'freeze' || (mode === 'toggle' && !game.aiFrozen)) {
        game.aiFrozen = true;
        log('Enemy AI: FROZEN (Enemies hold position and cease attacks).', 'green');
      } else {
        game.aiFrozen = false;
        log('Enemy AI: RESUMED.', 'yellow');
      }
    },

    clear(game, args, log) {
      let count = 0;
      for (const e of [...game.entities]) {
        if (e.isEnemy && !e.isBoss && !e.isDummy) {
          e.remove && e.remove();
          count++;
        }
      }
      devStress.clear(game);
      log(`Cleared ${count} active enemies/projectiles.`, 'green');
    },

    boss(game, args, log) {
      const phase = args[1] ? args[1].toLowerCase() : 'phase1';
      game.warpTo('dungeon', 'pre');
      log(`Teleported to Bramblemaw arena (Requested: ${phase}).`, 'green');
    },

    bosshp(game, args, log) {
      const pct = Math.max(1, Math.min(100, parseFloat(args[0]) || 50));
      const boss = game.entities.find(e => e.isBoss && !e.dead);
      if (!boss) { log('No active boss found in current room.', 'yellow'); return; }
      boss.hp = Math.round(boss.maxHp * (pct / 100));
      game.ui.bossBar(boss.name, boss.hp / boss.maxHp);
      log(`Boss HP set to ${pct}% (${boss.hp}/${boss.maxHp}).`, 'green');
    },

    bossreset(game, args, log) {
      const boss = game.entities.find(e => e.isBoss);
      if (boss) {
        boss.hp = boss.maxHp;
        boss.state = 'intro';
        boss.enraged = false;
        game.ui.bossBar(boss.name, 1.0);
        log('Reset active boss encounter.', 'green');
      }
    },

    killplayer(game, args, log) {
      const reason = args.join(' ') || 'Developer command test';
      if (game.player) {
        log(`Triggering developer player kill (${reason})...`, 'yellow');
        game.player.dead = true;
        game.player.setState('dead');
        game.gameOver && game.gameOver(reason);
      }
    },

    spawngrave(game, args, log) {
      const amt = parseInt(args[0], 10) || 100;
      const p = game.player;
      if (!p) return;
      game.flags.grave = { x: p.x, z: p.z, area: game.area.id, coins: amt };
      log(`Spawned death currency grave at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) with ${amt} pips.`, 'green');
    },

    stress(game, args, log) {
      const type = (args[0] || 'enemies').toLowerCase();
      const count = parseInt(args[1], 10);

      if (type === 'clear') {
        const cleared = devStress.clear(game);
        log(`Cleared ${cleared} stress testing entities and loot drops.`, 'green');
        return;
      }

      if (type === 'enemies') {
        const spawned = devStress.spawnEnemies(game, count || 30);
        log(`Spawned ${spawned} stress test enemies. Type /stress clear to purge.`, 'yellow');
      } else if (type === 'loot') {
        const spawned = devStress.spawnLoot(game, count || 50);
        log(`Spawned ${spawned} stress test loot drops. Type /stress clear to purge.`, 'yellow');
      } else if (type === 'particles') {
        const spawned = devStress.spawnParticles(game, count || 500);
        log(`Spawned ${spawned} stress test particles.`, 'yellow');
      } else {
        log('Usage: /stress <enemies|loot|particles|clear> [count]', 'yellow');
      }
    },

    perf(game, args, log) {
      const m = devStress.getMetrics(game);
      log('=== PERFORMANCE TELEMETRY ===', 'gold');
      log(`FPS: ${m.fps} | Entities: ${m.entities} | Solids: ${m.solids} | Particles: ${m.particles}`, 'cyan');
      log(`Draw Calls: ${m.drawCalls} | Triangles: ${m.triangles} | Textures: ${m.textures}`, 'info');
    },

    gamepad(game, args, log) {
      const g = readGamepadDiagnostics();
      log('=== CONTROLLER DIAGNOSTICS ===', 'gold');
      if (!g.available) {
        log(g.message || g.reason, 'yellow');
        return;
      }
      log(`Connected: ${g.connected} controller(s) | ID: ${g.id}`, 'info');
      log(`Left Stick: X=${g.leftStick.x} Y=${g.leftStick.y} (Mag: ${g.leftStick.mag})`, 'cyan');
      log(`Right Stick (Aim): X=${g.rightStick.x} Y=${g.rightStick.y} (Angle: ${g.rightStick.angleDeg}°)`, 'gold');
      log(`Buttons Active: ${g.buttonsPressed.join(', ') || 'None'}`, 'info');
    },
  };
}
