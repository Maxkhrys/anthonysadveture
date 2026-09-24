// Developer Commands Engine for Mossling.
// DEVELOPMENT AND TESTING ONLY.
// Clearly marked as development tooling in code.
// Obscurity note: activation is obscure for dev convenience, not cryptographic security.
// NEVER put secrets/API keys in client code.

import { CLASSES, MAX_LEVEL, xpNeed } from '../rpg/classes.js';
import {
  AFFIX_RARITY_TIERS,
  TIER_ORDER,
  rollWeaponWithAffixes,
  formatAffixSummary,
  AFFIX_DEFINITIONS,
  QUALITATIVE_MODIFIERS,
} from '../rpg/affixes.js';
import { simulateAffixRolls, formatSimulationReport } from '../rpg/affix_simulation.js';
import { genItem, baseById, WEAPONS, ARMORS, LEGENDARIES } from '../rpg/items.js';
import { RECIPES, learn } from '../rpg/crafting.js';
import { sfx } from '../engine/audio.js';

export const COMMAND_DEFINITIONS = {
  help: {
    name: 'help',
    desc: 'List all commands or view help for a specific command.',
    usage: '/help [command]',
  },
  god: {
    name: 'god',
    desc: 'Toggle player invulnerability, infinite resource, and damage immunity.',
    usage: '/god',
  },
  noclip: {
    name: 'noclip',
    desc: 'Toggle walking through walls, props, water, and cliffs.',
    usage: '/noclip',
  },
  give: {
    name: 'give',
    desc: 'Give an item, base weapon, crafting material, or consumable.',
    usage: '/give <item_id|material|consumable> [count]',
  },
  giveall: {
    name: 'giveall',
    desc: 'Grant all crafting materials, keys, tools, recipes, and test gear.',
    usage: '/giveall',
  },
  level: {
    name: 'level',
    desc: 'Set player level directly (1-20), recalculating stats.',
    usage: '/level <number>',
  },
  xp: {
    name: 'xp',
    desc: 'Add experience points to player.',
    usage: '/xp <number>',
  },
  coins: {
    name: 'coins',
    desc: 'Add or set pips/coins.',
    usage: '/coins <number>',
  },
  teleport: {
    name: 'teleport',
    desc: 'Teleport to named landmark (village, forest, desert, shore, grotto, dungeon, boss, devroom) or coords.',
    usage: '/teleport <location> OR /teleport <x> <z>',
    aliases: ['tp'],
  },
  bellstone: {
    name: 'bellstone',
    desc: 'Discover and travel to a Bellstone by ID.',
    usage: '/bellstone <village|hollow|gate|testing|id>',
  },
  boss: {
    name: 'boss',
    desc: 'Teleport to boss arena and reset boss state for testing.',
    usage: '/boss [bramblemaw]',
  },
  spawn: {
    name: 'spawn',
    desc: 'Spawn enemies near player (blot, beetle, puffer, wisp, knight, etc.).',
    usage: '/spawn <enemy_kind> [count] [elite]',
  },
  clear: {
    name: 'clear',
    desc: 'Clear spawned non-boss enemies and projectiles in current area.',
    usage: '/clear',
  },
  time: {
    name: 'time',
    desc: 'Set overworld time of day.',
    usage: '/time <day|night|fraction>',
  },
  weather: {
    name: 'weather',
    desc: 'Set overworld weather.',
    usage: '/weather <rain|clear>',
  },
  classinfo: {
    name: 'classinfo',
    desc: 'Print detailed telemetry on stats, equipment power, affixes, and class perks.',
    usage: '/classinfo',
  },
  recipe: {
    name: 'recipe',
    desc: 'Learn a crafting recipe by ID or unlock all recipes.',
    usage: '/recipe <id|all>',
  },
  materials: {
    name: 'materials',
    desc: 'Grant a developer bundle of crafting essences and Hush Shards.',
    usage: '/materials',
    aliases: ['mats'],
  },
  heal: {
    name: 'heal',
    desc: 'Instantly restore maximum life, energy, Bell Surge, and tonic bottles.',
    usage: '/heal',
  },
  resetroom: {
    name: 'resetroom',
    desc: 'Reset current dungeon puzzle room (crates, switches, enemies).',
    usage: '/resetroom',
  },
  devroom: {
    name: 'devroom',
    desc: 'Enter isolated dev test room (training dummies, elemental targets, workbench, bellstone).',
    usage: '/devroom',
  },
  rollweapon: {
    name: 'rollweapon',
    desc: 'Roll a weapon using the data-driven affix rarity foundation.',
    usage: '/rollweapon [common|uncommon|rare|epic|legendary|relic|mythic|prismatic]',
  },
  affixes: {
    name: 'affixes',
    desc: 'Display affix rarity tiers, probabilities, roll ranges, and qualitative modifiers.',
    usage: '/affixes',
  },
  droptest: {
    name: 'droptest',
    desc: 'Run virtual simulation of affix roll distributions without modifying saves.',
    usage: '/droptest <count>',
  },
};

export class DevCommands {
  /**
   * Dispatches and runs a command string.
   * @param {Object} game - Game instance
   * @param {string} rawInput - Full command input line
   * @param {Function} log - Output callback: (text, type = 'info') => void
   */
  static execute(game, rawInput, log = console.log) {
    if (!rawInput || !rawInput.trim()) return;

    let clean = rawInput.trim();
    if (clean.startsWith('/')) clean = clean.substring(1);
    const parts = clean.split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Resolve alias
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
      DevCommands.handlers[matchedCmd](game, args, log);
    } catch (err) {
      log(`Error running /${cmdName}: ${err.message}`, 'error');
    }
  }

  static handlers = {
    help(game, args, log) {
      if (args[0]) {
        const target = args[0].toLowerCase().replace(/^\//, '');
        const def = COMMAND_DEFINITIONS[target];
        if (!def) {
          log(`No help entry for "${target}".`, 'error');
          return;
        }
        log(`Command: /${def.name}`, 'gold');
        log(`Usage: ${def.usage}`, 'cyan');
        log(`Description: ${def.desc}`, 'info');
        if (def.aliases) log(`Aliases: ${def.aliases.map(a => '/' + a).join(', ')}`, 'info');
        return;
      }

      log('=== MOSSLING DEVELOPER COMMANDS (SLASH COMMANDS) ===', 'gold');
      log('Commands marked [DEV TOOLING] — for development and testing only.', 'dim');
      for (const [key, def] of Object.entries(COMMAND_DEFINITIONS)) {
        log(`/${def.name.padEnd(12)} - ${def.desc}`, 'info');
      }
      log('Type /help <command> for detailed argument usage.', 'cyan');
    },

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
        log('NoClip: ENABLED (Walking through walls, water, props and obstacles)', 'green');
        game.ui.toast('NoClip Enabled', 'Collision disabled.', 2.0);
      } else {
        log('NoClip: DISABLED', 'yellow');
        game.ui.toast('NoClip Disabled', 'Normal collision restored.', 2.0);
      }
    },

    give(game, args, log) {
      if (!args[0]) {
        log('Usage: /give <item_or_mat_id> [count]', 'yellow');
        return;
      }

      const id = args[0].toLowerCase();
      const count = Math.max(1, parseInt(args[1], 10) || 1);
      const mats = game.inv.mats || (game.inv.mats = {});

      // 1. Crafting materials
      if (['shard', 'thornheart', 'echo', 'ember', 'sailcloth'].includes(id)) {
        mats[id] = (mats[id] || 0) + count;
        log(`Added ${count} × ${id} to crafting materials (Total: ${mats[id]}).`, 'green');
        game.ui.toast('Material Granted', `+${count} ${id}`, 1.5);
        game.save();
        return;
      }

      // 2. Consumables / quest items
      if (id === 'potion' || id === 'tonic') {
        game.inv.potions = Math.min(game.inv.maxPotions, game.inv.potions + count);
        log(`Granted ${count} tonics (Current: ${game.inv.potions}/${game.inv.maxPotions}).`, 'green');
        return;
      }
      if (id === 'vessel' || id === 'heart') {
        game.inv.vessels = (game.inv.vessels || 0) + count;
        game.recalc();
        game.inv.hp = game.inv.maxHp;
        log(`Granted ${count} Heart Vessel(s). Max HP is now ${game.inv.maxHp}.`, 'green');
        return;
      }
      if (id === 'key') {
        game.inv.keys = (game.inv.keys || 0) + count;
        log(`Added ${count} Small Key(s) (Total: ${game.inv.keys}).`, 'green');
        return;
      }
      if (id === 'bigkey' || id === 'bosskey') {
        game.inv.bigkey = true;
        log('Granted Thornwood (Boss) Key.', 'green');
        return;
      }
      if (id === 'bellows') {
        game.inv.bellows = true;
        log('Granted Gustbellows.', 'green');
        return;
      }

      // 3. Equipment bases or legendaries
      const base = baseById(id);
      if (base) {
        const item = genItem({ level: game.inv.level || 1, slot: base.kind ? 'weapon' : base.slot });
        game.pickupItem(item);
        log(`Granted gear: ${item.name} (${item.slot} · ilvl ${item.ilvl}).`, 'green');
        return;
      }

      const legend = LEGENDARIES.find(l => l.id === id || l.u === id);
      if (legend) {
        const item = genItem({ level: legend.lvl || 5, rarity: 4 });
        game.pickupItem(item);
        log(`Granted Legendary: ${item.name}!`, 'green');
        return;
      }

      log(`Unrecognized item or material ID: "${id}".`, 'error');
    },

    giveall(game, args, log) {
      const inv = game.inv;
      inv.mats = {
        shard: 999,
        thornheart: 99,
        echo: 99,
        ember: 99,
        sailcloth: 99,
      };
      inv.keys = 9;
      inv.bigkey = true;
      inv.bellows = true;
      inv.galeValve = true;
      inv.potions = inv.maxPotions;
      inv.coins += 5000;

      // Unlock all authored recipes
      for (const r of RECIPES) {
        learn(game, r.id, true);
      }

      // Give sample weapons
      for (const cls of ['samurai', 'archer', 'witch']) {
        const w = rollWeaponWithAffixes({ cls, level: 10, affixCount: 4, targetTier: 'legendary' });
        game.pickupItem(w);
      }

      game.recalc();
      game.save();
      log('Granted developer bundle: 999 materials, all recipes, max tools, keys, and top gear.', 'green');
      game.ui.toast('Dev Bundle Granted', 'All materials, keys, recipes unlocked.', 2.5);
    },

    level(game, args, log) {
      if (!args[0]) {
        log(`Current Level: ${game.inv.level}. Usage: /level <1-${MAX_LEVEL}>`, 'yellow');
        return;
      }
      const lvl = Math.max(1, Math.min(MAX_LEVEL, parseInt(args[0], 10) || 1));
      const inv = game.inv;
      inv.level = lvl;
      inv.xp = 0;
      inv.sp = Math.max(0, lvl - 1);

      // Unlock abilities for class up to this level
      const C = CLASSES[inv.cls];
      if (C) {
        C.abilities.forEach((a, i) => {
          if (inv.level >= a.lvl && !inv.skills[i]) inv.skills[i] = 1;
        });
      }

      game.recalc();
      inv.hp = inv.maxHp;
      game.res = 100;
      game.hudDirty = true;
      game.save();
      log(`Player level set to ${lvl}. Stats and skill points updated.`, 'green');
      game.ui.toast(`Level ${lvl}`, 'Stats recalculated.', 2.0);
    },

    xp(game, args, log) {
      const amount = parseInt(args[0], 10);
      if (!amount || isNaN(amount)) {
        log('Usage: /xp <amount>', 'yellow');
        return;
      }
      game.gainXp(amount);
      log(`Granted ${amount} XP. (Current: ${game.inv.xp}/${xpNeed(game.inv.level)} · Level ${game.inv.level})`, 'green');
    },

    coins(game, args, log) {
      const val = parseInt(args[0], 10);
      if (isNaN(val)) {
        log(`Current Pips/Coins: ${game.inv.coins}. Usage: /coins <amount>`, 'yellow');
        return;
      }
      game.inv.coins = Math.max(0, game.inv.coins + val);
      game.hudDirty = true;
      log(`Pips updated by ${val >= 0 ? '+' : ''}${val}. Total: ${game.inv.coins}`, 'green');
    },

    teleport(game, args, log) {
      if (!args[0]) {
        log('Usage: /teleport <village|forest|shore|desert|cinderpeak|mountains|grotto|dungeon|boss|devroom> OR /teleport <x> <z>', 'yellow');
        return;
      }

      // Coordinate mode
      if (args.length >= 2 && !isNaN(Number(args[0])) && !isNaN(Number(args[1]))) {
        const x = parseFloat(args[0]);
        const z = parseFloat(args[1]);
        if (game.player) {
          game.player.x = x;
          game.player.z = z;
          game.player.sync();
          game.snapCamera();
          log(`Teleported player to coordinates (${x}, ${z}).`, 'green');
        }
        return;
      }

      const dest = args[0].toLowerCase();
      const destinations = {
        village: { area: 'overworld', spawn: 'village', x: 48, z: 54 },
        forest: { area: 'overworld', spawn: { x: 25, z: 45 } },
        shore: { area: 'overworld', spawn: { x: 65, z: 96 } },
        desert: { area: 'overworld', spawn: { x: 125, z: 60 } },
        cinderpeak: { area: 'overworld', spawn: { x: 118, z: 25 } },
        mountains: { area: 'overworld', spawn: { x: 60, z: 15 } },
        mill: { area: 'overworld', spawn: { x: 47, z: 50 } },
        camp: { area: 'overworld', spawn: { x: 35, z: 65 } },
        gate: { area: 'overworld', spawn: { x: 75, z: 12 } },
        grotto: { area: 'grotto', spawn: 'entrance' },
        dungeon: { area: 'dungeon', spawn: 'entrance' },
        boss: { area: 'dungeon', spawn: 'pre' },
        devroom: { area: 'devroom', spawn: 'spawn' },
      };

      const target = destinations[dest];
      if (!target) {
        log(`Unknown landmark "${dest}". Available: ${Object.keys(destinations).join(', ')}`, 'error');
        return;
      }

      if (dest === 'devroom') {
        // Record return location before entering devroom
        game.devRoomPrevLocation = {
          area: game.area ? game.area.id : 'overworld',
          spawn: { x: game.player?.x || 48, z: game.player?.z || 54 },
        };
      }

      game.warpTo(target.area, target.spawn);
      log(`Warping to ${dest} (${target.area})...`, 'green');
    },

    bellstone(game, args, log) {
      if (!args[0]) {
        log('Discovered Bellstones: ' + (game.discoveredBellstones.join(', ') || 'None'), 'info');
        log('Usage: /bellstone <village|hollow|gate|testing|id>', 'yellow');
        return;
      }

      const id = args[0].toLowerCase();
      const stoneKey = id.includes(':') ? id : `overworld:${id}`;
      if (!game.discoveredBellstones.includes(stoneKey)) {
        game.discoveredBellstones.push(stoneKey);
      }

      // Rest and refill
      game.inv.hp = game.inv.maxHp;
      game.inv.potions = game.inv.maxPotions;
      game.res = 100;
      sfx('chime');
      log(`Discovered Bellstone "${stoneKey}". Vitals and tonics replenished.`, 'green');
    },

    boss(game, args, log) {
      // Reset boss kill flag for testing
      game.flags.bossKilled = false;
      game.flags.bossDoor = false;
      log('Reset Bramblemaw boss encounters. Warping to Rootwell Hollow boss arena...', 'green');
      game.warpTo('dungeon', 'pre');
    },

    spawn(game, args, log) {
      if (!args[0]) {
        log('Usage: /spawn <enemy_kind> [count] [elite]', 'yellow');
        log('Available kinds: blot, beetle, puffer, wisp, knight, scorpion, imp, wraith, brigand, sporeling, treant, golem, thief', 'info');
        return;
      }

      const kind = args[0].toLowerCase();
      const count = Math.max(1, Math.min(20, parseInt(args[1], 10) || 1));
      const forceElite = args.includes('elite') || args[2] === 'elite';

      const p = game.player;
      if (!p) {
        log('Player not spawned.', 'error');
        return;
      }

      const f = p.facing || 0;
      for (let i = 0; i < count; i++) {
        const dist = 3.0 + (i * 0.8);
        const ang = f + (i - (count - 1) / 2) * 0.35;
        const x = p.x + Math.sin(ang) * dist;
        const z = p.z + Math.cos(ang) * dist;

        const enemy = game.spawnEnemy(kind, x, z, {
          aggro: 25,
          eliteChance: forceElite ? 1.0 : 0.0,
        });

        if (forceElite && enemy && !enemy.elite) {
          game.makeElite(enemy);
        }
      }

      sfx('spawn');
      log(`Spawned ${count} × ${kind}${forceElite ? ' (Elite)' : ''} ahead of player.`, 'green');
    },

    clear(game, args, log) {
      let count = 0;
      for (const e of [...game.entities]) {
        if (e.isEnemy && !e.isDummy) {
          e.remove();
          count++;
        }
      }
      log(`Cleared ${count} enemies from current area.`, 'green');
      game.ui.toast('Area Cleared', `Removed ${count} enemies.`, 1.5);
    },

    time(game, args, log) {
      if (!args[0]) {
        log(`Usage: /time <day|night|fraction (0.0-1.0)>`, 'yellow');
        return;
      }

      const val = args[0].toLowerCase();
      const fraction = val === 'day' ? 0.5 : val === 'night' ? 0.85 : Number(val);
      if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) {
        log('Time must be day, night, or a fraction from 0 (inclusive) to 1 (exclusive).', 'error');
        return;
      }
      // The persisted world clock uses seconds, a 420-second cycle and a 0.32 phase offset.
      game.flags.dayOffset = (fraction - 0.32) * 420 - game.time;
      log(`Time set to: ${val.toUpperCase()}`, 'green');
      game.atmosphere(0.001);
    },

    weather(game, args, log) {
      if (!args[0]) {
        log('Usage: /weather <rain|clear>', 'yellow');
        return;
      }

      const w = args[0].toLowerCase();
      if (w === 'rain') {
        game.raining = true;
        game.rainK = 1.0;
        game.weatherT = 99999;
        log('Weather set to: RAIN', 'green');
      } else {
        game.raining = false;
        game.rainK = 0.0;
        game.weatherT = 99999;
        log('Weather set to: CLEAR', 'green');
      }
      game.atmosphere(0.001);
    },

    classinfo(game, args, log) {
      const inv = game.inv;
      const ps = game.pstats || {};
      const C = CLASSES[inv.cls] || { name: inv.cls };

      log(`=== CHARACTER TELEMETRY: ${C.name} (Lv ${inv.level}) ===`, 'gold');
      log(`Health: ${Math.round(inv.hp)}/${inv.maxHp} | Pips: ${inv.coins} | SP: ${inv.sp}`, 'info');
      log(`Weapon Damage: ${ps.wmin}-${ps.wmax} (Spd: ${ps.wspd?.toFixed(2)}) | Power: ${ps.wpower || 'N/A'}`, 'info');
      log(`Combat Stats: Crit: ${ps.crit?.toFixed(1)}% (+${ps.critDmg}%) | Armour: ${ps.armor} (DR: ${((1 - (ps.dr || 1)) * 100).toFixed(0)}%)`, 'info');
      log(`Passives: Life Steal: ${ps.lifesteal}% | CDR: ${ps.cdr}% | Move: +${ps.moveSpd}% | MF: +${ps.mf}%`, 'info');

      const eq = inv.equip?.weapon;
      if (eq) {
        log(`Equipped Weapon: ${eq.name} (ilvl ${eq.ilvl})`, 'cyan');
        if (eq.rolledAffixes && eq.rolledAffixes.length) {
          for (const a of eq.rolledAffixes) {
            log(`  ${formatAffixSummary(a)}`, 'dim');
          }
        }
      }
    },

    recipe(game, args, log) {
      if (!args[0]) {
        log('Usage: /recipe <id|all>. Available: thornrebuke, echofletch, emberseeds, millwind, returningcut, echosnare, rimebloom', 'yellow');
        return;
      }

      const id = args[0].toLowerCase();
      if (id === 'all') {
        for (const r of RECIPES) learn(game, r.id, true);
        log('Learned all crafting recipes!', 'green');
        game.save();
        return;
      }

      const r = RECIPES.find(x => x.id === id);
      if (!r) {
        log(`Unknown recipe: "${id}".`, 'error');
        return;
      }
      learn(game, r.id);
      log(`Learned recipe: ${r.name} (${r.desc}).`, 'green');
      game.save();
    },

    materials(game, args, log) {
      game.inv.mats = {
        shard: (game.inv.mats?.shard || 0) + 500,
        thornheart: (game.inv.mats?.thornheart || 0) + 10,
        echo: (game.inv.mats?.echo || 0) + 10,
        ember: (game.inv.mats?.ember || 0) + 10,
        sailcloth: (game.inv.mats?.sailcloth || 0) + 10,
      };
      sfx('pipbig');
      log('Granted material package: +500 Hush Shards, +10 Thornhearts, +10 Echoes, +10 Embers, +10 Sailcloth.', 'green');
      game.ui.toast('Materials Added', 'Full crafting bundle granted.', 2.0);
      game.save();
    },

    heal(game, args, log) {
      game.inv.hp = game.inv.maxHp;
      game.inv.potions = game.inv.maxPotions;
      game.res = 100;
      game.surge = 100;
      game.hudDirty = true;
      sfx('chime');
      log(`Healed to maximum (${game.inv.maxHp} HP, tonics refilled, Bell Surge full).`, 'green');
      game.ui.toast('Vitals Restored', 'Full life, energy, and tonics.', 1.5);
    },

    resetroom(game, args, log) {
      if (!game.area || !game.area.dungeon) {
        log('Room reset is only available in dungeons/puzzle grottos.', 'yellow');
        return;
      }
      game.resetRoom && game.resetRoom();
      log('Current puzzle room state reset to initial conditions.', 'green');
      game.ui.toast('Room Reset', 'Puzzles and crates restored.', 1.5);
    },

    devroom(game, args, log) {
      // Record return location before entering devroom
      game.devRoomPrevLocation = {
        area: game.area ? game.area.id : 'overworld',
        spawn: { x: game.player?.x || 48, z: game.player?.z || 54 },
      };

      game.warpTo('devroom', 'spawn');
      log('Teleporting to developer test arena (/devroom)...', 'green');
    },

    rollweapon(game, args, log) {
      const targetTier = args[0] ? args[0].toLowerCase() : null;
      if (targetTier && !AFFIX_RARITY_TIERS[targetTier]) {
        log(`Unknown tier "${targetTier}". Available: ${TIER_ORDER.join(', ')}`, 'error');
        return;
      }

      const weapon = rollWeaponWithAffixes({
        cls: game.inv.cls || 'samurai',
        level: game.inv.level || 5,
        targetTier,
        affixCount: 4,
      });

      game.pickupItem(weapon);

      log(`Rolled Weapon: [${weapon.highestAffixToken} ${weapon.name}] (ilvl ${weapon.ilvl})`, 'gold');
      log(`Damage: ${weapon.min}-${weapon.max} | Speed: ${weapon.spd} | Score: ${weapon.valuationTotal?.toLocaleString()}`, 'cyan');
      for (const aff of weapon.rolledAffixes) {
        const qual = aff.qualitative ? ` ★ [${aff.qualitative.name}: ${aff.qualitative.description}]` : '';
        log(`  • ${aff.displayToken} ${aff.name}: +${aff.actualRoll}${aff.unit} (${aff.tierName})${qual}`, 'info');
      }
    },

    affixes(game, args, log) {
      log('=== STAT & AFFIX RARITY TIER STRUCTURE ===', 'gold');
      log('Data-driven tier hierarchy (independent of item rarity):', 'info');
      for (const id of TIER_ORDER) {
        const t = AFFIX_RARITY_TIERS[id];
        const pct = (t.probability * 100).toFixed(4);
        log(`${t.token} ${t.name.padEnd(10)} [${pct.padStart(8)}%] - ${t.description}`, 'cyan');
      }
      log('\nRegistered Qualitative Modifiers (Relic, Mythic, Prismatic):', 'gold');
      for (const [k, q] of Object.entries(QUALITATIVE_MODIFIERS)) {
        log(`★ ${q.name} (${q.minTier}): ${q.description}`, 'info');
      }
    },

    droptest(game, args, log) {
      const count = Math.max(10, Math.min(1000000, parseInt(args[0], 10) || 10000));
      log(`Running drop simulation for ${count.toLocaleString()} virtual affixes (zero save modification)...`, 'cyan');

      const results = simulateAffixRolls(count);
      log(formatSimulationReport(results), 'info');
    },
  };
}
