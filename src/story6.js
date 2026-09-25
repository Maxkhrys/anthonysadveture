// Pass 6: the people of the wider world, their side quests, and two new traders.
// Uses the same conversation system as Thimblewick (Story.converse). Quests are few and
// memorable; each one changes something you can see.
//
//  Hobb's Cellar         (Heartland)  rats under the farm            -> Root Cellar
//  The Lost Lamplighter  (Deepwood)   Tallow's brother Wick          -> Hollow Log Burrow
//  Old Snapjaw           (Lake)       the Landing's bounty           -> a named leech on Heron Isle
//  Brakka's Tongs        (Cinderpeak) the smith's lost tongs         -> Old Forge Deep; blast powder opens the old pass
//  The Moonwell          (Moonfen)    a well that fills by moonlight -> Moonwell Shrine (night only)
//  What Nests in the Bell (Highlands) Old Ferrule and the Tollcrow   -> the world boss
import { sfx } from './engine/audio.js';
import { gainMat, learn, MATS } from './rpg/crafting.js';
import { genItem, makeNamed, RARITY, itemIcon } from './rpg/items.js';
import { itemIconHTML } from './preview.js';
import {GearDrop} from './rpg/combat.js';
import { dropPips } from './entities/common.js';
import { Boulder } from './entities/objects.js';
import { REGIONS } from './world/layout.js';

export const QUESTS6 = [
  { id: 'q_cellar', name: "Hobb's Cellar", where: "Hobb's Farm, south-east of Thimblewick", steps: ['Clear the rats out of the Root Cellar under Hobb\'s farmhouse.', 'Tell Hobb the cellar is quiet.'] },
  { id: 'q_wick', name: 'The Lost Lamplighter', where: 'Deepwood Shrine', steps: ['Find Wick. Tallow thinks he went into the Great Hollow Log.', 'Bring the news back to Tallow at the Deepwood Shrine.'] },
  { id: 'q_snapjaw', name: 'Bounty: Old Snapjaw', where: 'Mirrow Landing', steps: ['Hunt Old Snapjaw in the reeds of Heron Isle.', 'Collect the bounty from Harbourmaster Quill.'] },
  { id: 'q_tongs', name: "Brakka's Tongs", where: 'Cinder Rest', steps: ['Find Brakka\'s tongs in the Old Forge Deep, west of Cinder Rest.', 'Return them to Smith Brakka.'] },
  { id: 'q_moonwell', name: 'The Moonwell', where: 'Moonfen, by night', steps: ['Clear the Moonwell Shrine (its door only opens at night).', 'Tell the Well-keeper the well is safe.'] },
  { id: 'q_crow', name: 'What Nests in the Bell', where: 'The Chime Highlands', steps: ['Drive the Tollcrow out of the Great Bell in the Belfry Cradle.', 'Tell Old Ferrule.'] },
];

export function installStory6(Story) {
  const P = Story.prototype;
  const baseTalk = P.talk, baseHasNews = P.hasNews, baseJournal = P.journal;
  const NEW = new Set(['hobb', 'tallow', 'wick', 'quill', 'tobi', 'loma', 'brakka', 'pell', 'ysolde', 'ferrule', 'wisp-keeper']);
  P.talk = function (npc) { if (NEW.has(npc.id)) return this.talk6(npc); return baseTalk.call(this, npc); };
  P.hasNews = function (id) {
    const f = this.f;
    switch (id) {
      case 'hobb': return !f.q_cellar || (f.q_cellar === 1 && f['md:rootcellar']);
      case 'tallow': return !f.q_wick || (f.q_wick === 1 && f['md:logburrow']);
      case 'quill': return !f.q_snapjaw || (f.q_snapjaw === 1 && f.snapjawDead);
      case 'brakka': return !f.q_tongs || (f.q_tongs === 1 && f.tongs);
      case 'wisp-keeper': return !f.q_moonwell || (f.q_moonwell === 1 && f['md:moonwell']);
      case 'ferrule': return !f.q_crow || (f.q_crow === 1 && f.tollcrowKills);
    }
    return baseHasNews.call(this, id);
  };
  P.journal = function () {
    const f = this.f;
    let html = baseJournal.call(this);
    const rows = QUESTS6.filter(q => f[q.id]).map(q => {
      const done = f[q.id] === 2, step = q.steps[Math.min(q.steps.length - 1, (f[q.id] || 1) - 1 + (this.readyToHandIn(q.id) ? 1 : 0))];
      return `<div class="quest ${done ? 'done' : ''}"><b>${done ? '✔ ' : ''}${q.name}</b> <small>${q.where}</small><br>${done ? 'Done.' : step}</div>`;
    }).join('');
    return html + (rows ? `<h3>Out in Lanternreach</h3>${rows}` : '');
  };
  P.readyToHandIn = function (id) {
    const f = this.f;
    return { q_cellar: f['md:rootcellar'], q_wick: f['md:logburrow'], q_snapjaw: f.snapjawDead, q_tongs: f.tongs, q_moonwell: f['md:moonwell'], q_crow: f.tollcrowKills }[id] && f[id] === 1;
  };
  const accept = (g, id, text) => { g.flags[id] = 1; g.ui.updateHud(); const q = QUESTS6.find(q => q.id === id); g.ui.toast('Side quest: ' + q.name, text || q.steps[0], 3); g.save(); };
  const finish = (g, id, text) => { g.flags[id] = 2; const q = QUESTS6.find(q => q.id === id); sfx('fanfare'); g.ui.toast('Side quest complete: ' + q.name, text, 4); g.stats.quests6 = (g.stats.quests6 || 0) + 1; g.save(); };

  P.talk6 = function (npc) {
    const g = this.g, f = this.f, ui = g.ui, inv = g.inv, cw = this.cw;
    const L = (arr, cb) => ui.lines(arr.map(t => Array.isArray(t) ? t : [npc.name, t]), cb);
    switch (npc.id) {
      case 'hobb': {
        if (!f.q_cellar) return L([
          'Moss! You\'ve got the look of someone who doesn\'t mind a bit of squeaking.',
          'The cellar under my house — rats. Not ordinary rats. They wear a *crown*. Well, one of them does. Made it out of a thimble.',
          'The door\'s round the side of the farmhouse. Clear them out and there\'s a jar of pips and a new tonic bottle in it for you.',
        ], () => accept(g, 'q_cellar'));
        if (f.q_cellar === 1 && f['md:rootcellar']) return L(['Quiet as a Sunday! You did it. Here — pips, and my gran\'s tonic bottle. Mind it, it\'s older than me.'], () => { dropPips(g, g.player.x, g.player.z + 0.6, 80); g.inv.maxPotions++; g.inv.potions = g.inv.maxPotions; g.gainXp(150); const gift=makeNamed({samurai:'azureedge',archer:'moonfeather',witch:'sagesrod'}[inv.cls],3); if(!g.pickupItem(gift))g.spawn(new GearDrop(g,npc.x,npc.z+1,gift)); finish(g, 'q_cellar', '+80 pips · +1 tonic bottle · class weapon · +150 XP'); });
        if (f.q_cellar === 1) return L(['Round the side of the house. Mind the crates, and don\'t push them into the potato holes. Actually — do. That\'s how you get across.']);
        return this.converse(npc, g.isNight ? 'Can\'t sleep either? The fields are loud at night now.' : 'Morning, Moss. The crops are finally listening to the rain again.', [
          { id: 'can', label: 'The giant watering can', lines: ['My great-grandad found it. Bigger than the house. We think a big-folk gardener dropped it, back when there were big folk.', 'It still fills when it rains. We water the whole field from its spout.'] },
          { id: 'roads', label: 'Where do the roads go?', lines: ['East over the trowel bridge: the Sunscald Reach, and past that the Landing on the lake.', 'West: Whisperwood and the Deepwood. North: the Conservatory and the Windstair, if your legs are good.'], then: () => g.markLandmarks(['landing', 'wells', 'windstair']) },
        ]);
      }
      case 'tallow': {
        if (!f.q_wick) return L([
          'Oh — you\'re not Wick. Sorry. I keep thinking every footstep is him.',
          'My brother lights the Deepwood\'s lamps. Three nights ago he said he heard singing inside the *Great Hollow Log*, north of here, and went to look.',
          'He hasn\'t come back. And every lamp in the wood has gone out. Please — the log is easy to find. It\'s the one you can walk through.',
        ], () => { accept(g, 'q_wick'); g.markLandmarks(['hollowlog']); });
        if (f.q_wick === 1 && f['md:logburrow']) return L([
          [npc.name, 'You found — he\'s *alive*? Hiding in the heartwood with his lamp out, the silly, brave… thank you.'],
          ['Wick', 'Sorry, sis. Something big lives in there. It doesn\'t like light. I didn\'t like it either.'],
          [npc.name, 'Here. His spare wick-ring. It remembers every fire it\'s touched. Burning things burn *worse* near it.'],
        ], () => { g.pickupItem(makeNamed('wickring', Math.max(6, inv.level))); g.gainXp(300); g.flags.wickHome = true; finish(g, 'q_wick', "Lamplighter's Wick · +300 XP · the Deepwood's lamps are lit again"); });
        if (f.q_wick === 1) return L(['The Great Hollow Log. North, where the trail runs through it. There\'s a knot hole on its north side.']);
        return this.converse(npc, f.wickHome ? 'The lamps are lit, and Wick is sulking about it. Thank you, Moss.' : 'Mind the dark out there.', [
          { id: 'deep', label: 'The Deepwood', lines: ['The old wood. Oaks older than the village, and roots big enough to walk on — there\'s one you can climb, north-west of here. The Rootway.', 'Further west there\'s a bell caught in an oak. Nobody rings it. Nobody\'s tall enough.'], then: () => g.markLandmarks(['rootway', 'belloak']) },
        ]);
      }
      case 'wick': return L(['I\'m relighting them one by one. Did you know the Hush hates lamplight? I didn\'t. Now I do.']);
      case 'quill': {
        if (!f.q_snapjaw) return L([
          'Harbourmaster Quill. The Landing\'s fish belong to the Landing — except the ones *Old Snapjaw* eats, which is most of them.',
          'It\'s a leech the size of a rowboat. Lives in the reeds off Heron Isle. The ferry from Ada\'s pier will get you there, then the boardwalk.',
          'Bring it down and the bounty board pays two hundred. I\'ll add something from the lost-and-found.',
        ], () => { accept(g, 'q_snapjaw'); g.markLandmarks(['heron']); });
        if (f.q_snapjaw === 1 && f.snapjawDead) return L(['You got it? *The* Snapjaw? Here — two hundred, and this came up in a net last spring. Nobody could lift it.'], () => { dropPips(g, g.player.x, g.player.z + 0.6, 200); g.dropGear(g.player.x, g.player.z + 0.8, { level: inv.level + 1, floor: 3, bonus: 1 }); g.gainXp(400); finish(g, 'q_snapjaw', '+200 pips · +400 XP · a treasure from the nets'); });
        if (f.q_snapjaw === 1) return L(['Heron Isle. The reeds on its south side. It comes up when something small walks by. Something like you.']);
        return this.converse(npc, 'The water\'s calmer since the bell stirred. Don\'t tell it I said so.', [
          { id: 'board', label: 'The bounty board', act: () => this.board() },
          { id: 'chapel', label: 'The drowned chapel', lines: ['Past Heron Isle, stepping stones to Chapel Isle. The Bellwrights rang a bell there to calm the lake. Now it\'s full of water and worse.'], then: () => g.markLandmarks(['chapel']) },
        ]);
      }
      case 'tobi': return this.converse(npc, 'Nets, tonics, wax. Everything floats if you ask it nicely.', [
        { id: 'shop', label: 'Trade', act: () => this.shop6('tobi') },
        { id: 'lake', label: 'The lake', lines: ['Lake Mirrow goes deeper than anyone\'s rope. On still mornings you can see a stone head out there, up to its chin. The Sunken Bellwright, we call him.'], then: () => g.markLandmarks(['statue']) },
      ]);
      case 'loma': return this.converse(npc, g.isNight ? 'Can\'t sleep, child? Neither can the lake.' : 'Sit, sit. Old Loma knows every story the water tells.', [
        { id: 'tide', label: 'The Tide Shrine', lines: ['Up north, in the round lake above the channel — an island with a shrine that hums. The *Tide Chime* sleeps there.', 'No boat has ever reached it. The water pushes them back. When the bell calls it home, it\'ll let you through. Not before.', '(This part of the tale belongs to a later chapter.)'] },
        { id: 'moon', label: 'Moonfen', lines: ['West of the lake the water goes black and still. Moonfen. At night the dead walk there in a line, carrying lights.', 'Follow them, if you\'re brave. They always stop somewhere interesting.'], then: () => g.markLandmarks(['moonwillow', 'lantern']) },
      ]);
      case 'brakka': {
        if (!f.q_tongs) return L([
          'Brakka. Smith. You\'re small, but you\'ve got a smith\'s eyes — you looked at my forge before you looked at me.',
          'My good tongs are down in the *Old Forge Deep*, west of here up the lava steps. Dropped them running from something that was *very* hot and *very* angry.',
          'Fetch them and I\'ll make you something that goes *bang*. There\'s an old rockfall on the Heartland road I\'ve wanted to see gone for years.',
        ], () => { accept(g, 'q_tongs'); g.markLandmarks(['forgedeep']); });
        if (f.q_tongs === 1 && f.tongs) return L([
          'My tongs! Hah! Here — *blast powder*. Kiln clay, ember motes, a secret.',
          'Take it to the boulders blocking Cinderpeak Pass — the old road from Thimblewick. Light it, stand back. You\'ll have a shortcut home.',
        ], () => { f.blastpowder = true; g.gainXp(400); gainMat(g, 'ember', 2, npc.x, npc.z); finish(g, 'q_tongs', 'Blast Powder · +400 XP · 2 Ember Motes. The old pass can be opened.'); });
        if (f.q_tongs === 1) return L(['West of Cinder Rest. Up the steps between the lava channels. Mind your boots.']);
        return this.converse(npc, 'Hammer\'s warm. What do you need?', [
          { id: 'shop', label: 'Trade', act: () => this.shop6('brakka') },
          { id: 'bench', label: 'Use the workbench', act: () => g.ui.openCraft() },
          { id: 'ember', label: 'The Emberwell Gate', lines: ['That door up on the volcano\'s shoulder? Bellwright work. One green lock remembers the Verdant Voice. Nobody\'s opened it in my lifetime.', 'Whatever burns behind it keeps my forge warm for free, so I\'m not complaining.', 'Bring the Verdant Chime and Gustbellows. Inside, recover the Cinder Rod; heat wakes the kiln, wind cools the metal. The Regent vents its mouth before attacking.'], then: () => g.markLandmarks(['emberwell']) },
        ]);
      }
      case 'pell': return this.converse(npc, g.isNight ? 'Night shift\'s over. Mine\'s the hut with the lamp.' : 'Watch your step. Half this mountain is still warm.', [
        { id: 'anvil', label: 'The Great Anvil', lines: ['North-west on the rise. The big folk forged bells on it. You can see the whole range from the top.'], then: () => g.markLandmarks(['anvil']) },
        { id: 'foundry', label: 'Bronze arches?', lines: ['The old bell-metal foundry, north-east. Things still hum there at night.'], then: () => g.markLandmarks(['foundry']) },
        { id: 'bridge', label: 'The rope bridge', lines: ['West, over the gorge, into the Chime Highlands. The Bellwrights never finished paying the rope-maker. It holds anyway.'] },
      ]);
      case 'ysolde': return this.converse(npc, 'Ysolde. I keep the tally for the camp — and the stories nobody else writes down.', [
        { id: 'toll', label: 'The Last Toll', lines: ['The miners say the Bellwrights built one bell that was never meant to ring. The Last Toll.', 'If you hear it, they say, every lost sound comes home at once. Nobody knows if that\'s a promise or a warning.'] },
        { id: 'high', label: 'The Highlands', lines: ['Over the rope bridge. Ruins, cairns, and the Great Bell — a black bird nests in it now. Old Ferrule up there knows more.'], then: () => g.markLandmarks(['greatbell', 'ruins']) },
      ]);
      case 'ferrule': {
        if (!f.q_crow) return L([
          'Ferrule. Keeper of the Great Bell. Or I was, before the *Tollcrow* moved in.',
          'It\'s been pecking the bronze. Every peck, a sound goes missing somewhere in the valley. Your village bell stopped the same week it came.',
          'It perches on the beam when it tires. If the bell rings while it\'s up there, the toll shakes it right off. I\'m too old to swing at bells. You aren\'t.',
        ], () => { accept(g, 'q_crow'); g.markLandmarks(['greatbell']); });
        if (f.q_crow === 1 && f.tollcrowKills) return L([
          'Listen… the bell hums again. Only a little. But it *hums*.',
          'The Chime Spire\'s door is behind the ruins, cut into the mountain. It\'s the back of your Chime Gate. When you have all three Voices, it will open for you.',
          'Take this. Every Keeper wore one. (+600 XP)',
        ], () => { g.gainXp(600); gainMat(g, 'echo', 2, npc.x, npc.z); finish(g, 'q_crow', '+600 XP · 2 Hollow Echoes · the Chime Spire marked on your map'); g.markLandmarks(['spire']); });
        if (f.q_crow === 1) return L(['The Belfry Cradle, west of here, under the Great Bell. Strike the bell\'s mouth when the bird sits on the beam.']);
        return this.converse(npc, 'The wind\'s changed. It sounds like the bell again.', [
          { id: 'spire', label: 'The Chime Spire', lines: ['Behind the ruins, cut into the mountain: the back of your Chime Gate. Three Voices open it. (The end of this road belongs to a later chapter.)'], then: () => g.markLandmarks(['spire']) },
        ]);
      }
      case 'wisp-keeper': {
        if (!f.q_moonwell) return L([
          'Ah. A living one. You can see me, so it must be night.',
          'I kept the Moonwell. Something drank it dry and nests at the bottom. The shrine\'s door opens only while the moon is up.',
          'Wake the two lamps in the cloister — the wind that repeats knows how — and clear the well.',
        ], () => accept(g, 'q_moonwell'));
        if (f.q_moonwell === 1 && f['md:moonwell']) return L(['It\'s filling. I can feel the moon in it again. Take this, and my thanks. Come back on clear nights — the well shows things.'], () => { g.gainXp(700); gainMat(g, 'moth', 2, npc.x, npc.z); gainMat(g, 'stardust', 1); finish(g, 'q_moonwell', '+700 XP · Moth Dust · Stardust'); });
        return L(['The well is quiet. Go on. The night is shorter than it looks.']);
      }
    }
  };

  // traders: Tobi at the Landing, Brakka at Cinder Rest, and the travelling pedlar
  P.shop6 = function (who) {
    const g = this.g, inv = g.inv;
    const mat = (id, price, n = 1) => ({ name: `${MATS[id].icon} ${MATS[id].name}${n > 1 ? ' ×' + n : ''}`, price, desc: MATS[id].desc, state: () => 'ok', buy: g => gainMat(g, id, n) });
    const tonic = { name: 'Red Tonic', price: 30, desc: 'Restores 45% health.', state: g => g.inv.potions >= g.inv.maxPotions ? 'Your bottles are full.' : 'ok', buy: g => { g.inv.potions++; } };
    const key = who + ':' + inv.level + ':' + g.worldDay();
    this.stock6 = this.stock6 || {};
    if (!this.stock6[key]) this.stock6[key] = [0, 1, 2].map(i => genItem({ level: inv.level + 1, cls: i === 0 ? inv.cls : null, slot: i === 0 ? 'weapon' : null, floor: 2, bonus: 0.5 }));
    const gear = this.stock6[key].map(it => ({ name: `<span style="color:${RARITY[it.r].color}">${itemIconHTML(it, it.cls) || itemIcon(it)} ${it.name}</span>`, price: it.value * 3, desc: `${RARITY[it.r].name} ${it.slot}`, state: g => it.sold ? 'Sold.' : g.inv.bag.length >= g.bagCapacity() ? 'Your bag is full.' : 'ok', buy: g => { it.sold = true; g.pickupItem(it); } }));
    const lists = {
      tobi: [tonic, mat('wax', 40), mat('echo', 90), ...gear.slice(1)],
      brakka: [tonic, mat('ember', 60), mat('filament', 80), mat('shard', 30, 3), ...gear],
      pedlar: [tonic, mat('stardust', 160), mat('moth', 45), ...this.mapFrags(), ...gear.slice(0, 2)],
    };
    g.ui.openShop(lists[who]);
  };
  P.mapFrags = function () {
    const g = this.g, D = g.world6 && g.world6.discovery; if (!D) return [];
    return Object.keys(REGIONS).filter(r => !D.regions.includes(r)).slice(0, 2).map(r => ({ name: '🗺 Map of ' + REGIONS[r].name, price: 120, desc: 'A pedlar\'s sketch. Fills in that region on your map.', state: g => g.flags['boughtmap:' + r] ? 'Sold.' : 'ok', buy: g => { g.flags['boughtmap:' + r] = true; g.revealRegion(r); if (!g.world6.discovery.regions.includes(r)) g.world6.discovery.regions.push(r); } }));
  };
  P.pedlar = function (npc) {
    const g = this.g;
    this.converse(npc, g.flags.metPedlar ? 'Pip the Pedlar, still walking! Different road today, same bargains.' : (g.flags.metPedlar = true, 'Pip the Pedlar! I walk the whole of Lanternreach, one stop a day. Never the same stop twice in a row.'), [
      { id: 'shop', label: 'Trade', act: () => this.shop6('pedlar') },
      { id: 'where', label: 'Where will you be tomorrow?', lines: () => { const M = g.world6.generated.merchants[0]; const s = M.stops[(g.worldDay() + 1 + M.offset) % M.stops.length]; return [`Tomorrow? ${REGIONS[s.region].name}, if my feet agree.`]; } },
    ]);
  };

  // Brakka's blast powder clears the rockfall on the old Cinderpeak road
  const bInteract = Boulder.prototype.interact;
  Boulder.prototype.interact = function () {
    const g = this.g;
    if (!g.flags.blastpowder) return bInteract.call(this);
    g.ui.ask('Cinderpeak Pass', 'Pack Brakka\'s blast powder into the crack and light it?', [
      { label: 'Light it and run', cb: () => {
        g.flags.passOpen = true; sfx('thud'); sfx('roar'); g.pr.addShake(1.4); g.pr.addFlash(0.6, 0xffb060);
        for (const e of g.entities) if (e instanceof Boulder) { g.fx.burst(e.x, 0.6, e.z, 40, [0x6a5a5a, 0xffb060, 0x3a2a2a], 6, { life: 1 }); e.remove(); }
        g.ui.toast('The pass is open!', 'A shortcut between Thimblewick and Cinderpeak.', 3.5); g.save();
      } },
      { label: 'Not yet', cb: () => {} },
    ]);
  };
}
