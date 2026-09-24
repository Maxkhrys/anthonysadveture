// Narrative, quests, NPC conversations, shop stock.
import { sfx, playMusic } from './engine/audio.js';
import { dropPips } from './entities/common.js';
import { genItem, RARITY, itemIcon } from './rpg/items.js';

export class Story {
  constructor(g) { this.g = g; }
  get f() { return this.g.flags; }
  get stage() { return this.f.stage || 0; }

  objective() {
    const f = this.f, g = this.g;
    if (g.area && g.area.rift) return `Hush Rift · Floor ${g.area.floor}: clear each room and defeat the Champion.`;
    if (g.area && g.area.id === 'dungeon' && !f.bossDead) {
      if (!g.inv.bellows) return 'Explore Rootwell Hollow. Something here hums with wind.';
      if (!g.inv.bigkey) return 'Use the Gustbellows to push deeper. Find the Thornwood Key.';
      return 'Open the Root Gate and face what guards the Verdant Chime.';
    }
    switch (this.stage) {
      case 0: return 'Drive the Hushlings out of Thimblewick!';
      case 1: return 'Head west through Whisperwood to Rootwell Hollow.';
      case 2: return 'Return the Verdant Chime to the Dawnbell in Thimblewick.';
      case 3: return 'Chapter I complete. Explore Lanternreach — secrets, bounties and upgrades await.';
    }
    return '';
  }
  markers() {
    const f = this.f, m = [];
    if (this.stage === 1) m.push({ x: 17.5, z: 29.5, color: '#7fd36a', pulse: true });
    if (this.stage === 2) m.push({ x: 58, z: 56, color: '#ffd25e', pulse: true });
    m.push({ x: 58, z: 57, color: '#ffd25e' });
    m.push({ x: 74.5, z: 9.5, color: '#c9a8ff' });
    if (f.q_camp === 1) m.push({ x: 96, z: 28, color: '#e8424f', pulse: true });
    if (f.q_pier === 1) m.push({ x: 60, z: 92, color: '#7ad8ff', pulse: true });
    if (f.q_mill === 1 && !f.windmill) m.push({ x: 47, z: 51, color: '#fff3cf', pulse: true });
    const g = this.g;
    if (g.area && g.area.id === 'overworld') for (const e of g.entities) if (e.constructor.name === 'LootChest' && !e.opened) m.push({ x: e.x, z: e.z, color: ['#c89a5a', '#c0c0d0', '#ffd25e'][e.tier] });
    return m;
  }
  labels() {
    return [{ t: 'Thimblewick', x: 50, z: 76 }, { t: 'Whisperwood', x: 8, z: 50 }, { t: 'Rootwell Hollow', x: 6, z: 24 }, { t: 'Chime Gate', x: 66, z: 20 },
      { t: 'Cinderpeak', x: 118, z: 20 }, { t: 'Sunscald Reach', x: 118, z: 90 }, { t: 'Lake Mirrow', x: 96, z: 86 }, { t: 'Hush Camp', x: 86, z: 40 }, { t: 'Saltwhistle Shore', x: 20, z: 100 }];
  }
  hasNews(id) {
    const f = this.f;
    switch (id) {
      case 'tamsin': return this.stage === 2 || (this.stage === 0 && f.introFought);
      case 'oswin': return !f.q_mill || (f.windmill && f.q_mill !== 2);
      case 'brisk': return this.stage >= 1 && (!f.q_camp || (f.q_camp === 1 && this.g.signal('camp.clear')));
      case 'ada': return !f.q_pier || (f.q_pier === 1 && this.pierDone());
    }
    return false;
  }
  pierDone() { const b = this.g.entities.find(e => e.id === 'pier-block'); return this.f['sunk:pier-block'] || (b && Math.floor(b.x) !== 60) || (this.f['moved:pier-block'] && Math.floor(this.f['moved:pier-block'][0]) !== 60); }

  // ------------------------------------------------ opening
  opening() {
    const g = this.g;
    g.cutscene = true;
    g.camFocus = { x: 58, z: 57.5 };
    setTimeout(() => {
      g.ui.lines([
        ['Elder Tamsin', 'Moss! Oh, thank the roots you\'re awake. Come, quick — listen.'],
      ], () => {
        sfx('bellfail'); g.bell && g.bell.ring(false); g.pr.addShake(0.4);
        setTimeout(() => g.ui.lines([
          ['Elder Tamsin', '…Nothing. The *Dawnbell* has rung every morning for a thousand years. Today it only *thunks*.'],
          ['Elder Tamsin', 'Without its voice, the ~Hush~ creeps closer — and there! At the south path! ~Hushlings~!'],
          ['Elder Tamsin', 'You\'ve got your grandfather\'s sword and that pot-lid of a shield. Go on, little one — *drive them off!*'],
        ], () => {
          g.cutscene = false; g.camFocus = null;
          g.startIntroFight();
          g.ui.toast('J / Click: Attack  ·  K: Guard  ·  Space: Roll', '1-3: Abilities  ·  Hold J: Charged attack  ·  Follow the GUIDE (top left)', 6);
        }), 900);
      });
    }, 700);
  }
  introWon() {
    const g = this.g;
    this.f.introFought = true;
    g.ui.toast('Talk to Elder Tamsin', 'Press E near someone to talk.', 4);
    g.ui.updateHud();
  }

  // ------------------------------------------------ conversations
  talk(npc) {
    const g = this.g, f = this.f, ui = g.ui, s = this.stage;
    const L = (arr, cb) => ui.lines(arr.map(t => Array.isArray(t) ? t : [npc.name, t]), cb);
    switch (npc.id) {
      case 'tamsin':
        if (s === 0 && !f.introFought) return L(['Hushlings at the south path! Hurry, Moss!']);
        if (s === 0) return L([
          'You fought like a bell-ringer thrice your size! Now listen well.',
          'The Dawnbell sings with three *Voices* — three Chimes, each forged by the old Bellwrights. Together they keep the Hush asleep.',
          'Last night, all three Voices left the bell. Not stolen… it was as if they *walked away*.',
          'I can feel the *Verdant Chime* humming from the west — deep in Whisperwood, inside *Rootwell Hollow*.',
          'Take the west road. And Moss — the Hush drops pips like any honest creature. Spend them at Posy\'s stall by the plaza.',
        ], () => { f.stage = 1; g.gainXp(40); g.ui.updateHud(); g.save(); ui.toast('New objective', 'Rootwell Hollow — west through Whisperwood. (Esc: map)', 3); });
        if (s === 1) return L(['Rootwell Hollow lies west, where the road dives into Whisperwood. Follow the old path.', f.q_camp ? 'And be careful. The Hush has grown bolder since the bell fell quiet.' : 'Captain Brisk at the east gate could use a hand too, if you\'ve pips to earn.']);
        if (s === 2) return this.ringBell();
        return L(['One Voice returned. Can you hear it? The forest is breathing again.', 'The Ember Chime burns somewhere past *Cinderpeak Pass*, and the Tide Chime sleeps beneath *Lake Mirrow*.', 'When all three sing, the *Chime Gate* will open. And then… we will learn why they left.']);
      case 'posy':
        if (!f.metPosy) { f.metPosy = true; return L(['Welcome to the Bramble & Bolt! Tonics, whetstones, heart vessels — all fair priced in pips.'], () => this.shop()); }
        return this.shop();
      case 'oswin':
        if (!f.q_mill) return L(['My mill\'s gone still since the Hush came. Not a breath of wind in her sails.', 'If you ever find a way to make a proper *gale*, you come blow her back to life. I\'ll make it worth your while.'], () => { f.q_mill = 1; ui.updateHud(); ui.toast('Side quest: The Still Mill', '', 2); });
        if (f.q_mill === 1 && f.windmill) return L(['She\'s TURNING! Listen to her creak! Here, take these — 80 pips, and my eternal gratitude.'], () => { f.q_mill = 2; g.addCoins(80); g.gainXp(80); sfx('pipbig'); ui.toast('Side quest complete!', '+80 pips · +80 XP', 2); g.save(); });
        if (f.q_mill === 1) return L([g.inv.bellows ? 'That bellows of yours… could it puff hard enough? Try holding it longer, build up a real gale.' : 'A proper gale is what she needs. Not your huffing and puffing, little one.']);
        return L(['Flour\'s flowing again. The whole village smells like bread. Thank you, Moss.']);
      case 'brisk':
        if (s < 1) return L(['Ho, Moss. Hushlings at the south path, they say. Show \'em that sword!']);
        if (!f.q_camp) return L(['The Hush has dug a camp across the *north bridge*, east of the river. Tents, stakes, the lot.', 'I\'ve got two guards and one of them\'s asleep. Clear that camp and the guard purse is yours: *150 pips*.'], () => { f.q_camp = 1; ui.updateHud(); ui.toast('Side quest: Bounty — Hush Camp', 'Marked on your map.', 2.4); });
        if (f.q_camp === 1 && g.signal('camp.clear')) return L(['You cleared the WHOLE camp? By yourself? …Don\'t tell the other guards. Here\'s your bounty.'], () => { f.q_camp = 2; dropPips(g, g.player.x, g.player.z + 0.6, 150); g.gainXp(250); g.dropGear(g.player.x, g.player.z + 0.8, { level: g.inv.level + 1, floor: 3, bonus: 1 }); ui.toast('Bounty complete!', '+150 pips · +250 XP · a gift from the armoury', 2.5); g.save(); });
        if (f.q_camp === 1) return L(['The Hush camp is across the north bridge. Watch for the big armoured ones — a well-timed shield can knock them off balance.']);
        return L(['The roads are safer thanks to you. Mostly.']);
      case 'ada':
        if (!f.q_pier) return L(['A great stone came rolling down in last night\'s rumble. Right onto my pier path!', 'Too heavy for these old arms. You\'re small but stubborn — *walk into it* and push it out of the way?'], () => { f.q_pier = 1; ui.updateHud(); ui.toast('Side quest: Ada\'s Pier', 'Push the stone off the path.', 2.4); });
        if (f.q_pier === 1 && this.pierDone()) return L(['Ha! Clear as a summer tide. Take this — an old tonic bottle of mine. You can carry one more tonic now.'], () => { f.q_pier = 2; g.inv.maxPotions++; g.inv.potions = g.inv.maxPotions; g.gainXp(60); sfx('fanfare'); ui.toast('Tonic Bottle!', 'You can carry one more Red Tonic. All bottles filled.', 3); ui.updateHud(); g.save(); });
        if (f.q_pier === 1) return L(['Push it off the path, dear. Walk right into it. Push it down, then shove it sideways.']);
        return L(['The fish have gone strange since the bell stopped. They swim in circles around the lake shrine.']);
      case 'fennel': {
        const hints = [
          'Grandpa says the stone door in the north woods only opens for the *wind*. There\'s a pinwheel next to it!',
          'Beetles have hard shells in front. You gotta get *behind* them. Or knock \'em on their backs!',
          'If you hold your sword before you swing, you can do a SPIN! Whoosh!',
          'Big armoured Hush? Raise your shield *just* as they hit — they\'ll stumble. I saw a guard do it once!',
          'When your *Bell Surge* bar glows, press R. BONNNG!',
          'Leaf piles sometimes hide pips. But leaves are stubborn. Swords don\'t move them!',
        ];
        f.fennelI = ((f.fennelI ?? -1) + 1) % hints.length;
        return L([hints[f.fennelI]]);
      }
      case 'hermit':
        if (!f.bossDead) return L([
          'Mm. A Mossling, at the Hollow\'s mouth. The roots told me you\'d come.',
          'Inside, the Hollow shifts its breath. Wind will be your friend there — and remember: *what falls into a hole becomes floor.*',
          'And if a room tangles you up, step out and come back. The Hollow forgives.',
        ]);
        return L(['You carry the Verdant Voice. I hear it. It is… sad, isn\'t it? Like a song that ended too early.', 'The Bellwrights did not lose the Voices, child. They *hid* them. Ask yourself what they were afraid of.']);
    }
  }

  shop() {
    const g = this.g, inv = g.inv;
    // rotating stock: refreshes whenever you level up or return later
    const key = inv.level + ':' + Math.floor(g.playTime / 300);
    if (!this.stock || this.stockKey !== key) {
      this.stockKey = key;
      this.stock = [0, 1, 2, 3, 4].map(i => genItem({ level: inv.level + (i === 4 ? 1 : 0), cls: i < 3 ? inv.cls : null, slot: i < 2 ? 'weapon' : null, floor: i >= 3 ? 2 : 1, bonus: 0.3 }));
    }
    const gear = this.stock.map(it => ({
      name: `<span style="color:${RARITY[it.r].color}">${itemIcon(it)} ${it.name}</span>`, price: it.value * 3,
      desc: it.slot === 'weapon' ? `${it.min}–${it.max} dmg · ${RARITY[it.r].name}${it.utext ? ' · ' + it.utext : ''}` : `${RARITY[it.r].name} ${it.slot} · ${Object.keys(it.stats).length} stats`,
      state: g => it.sold ? 'Sold.' : g.inv.bag.length >= 30 ? 'Your bag is full.' : 'ok',
      buy: g => { it.sold = true; g.pickupItem(it); },
    }));
    g.ui.openShop([
      { name: 'Red Tonic', price: 25, desc: 'Restores 45% health. Drink with Q.', state: g => g.inv.potions >= g.inv.maxPotions ? 'Your bottles are full.' : 'ok', buy: g => { g.inv.potions++; } },
      { name: 'Heart Vessel', price: 150, desc: '+15 maximum health.', state: g => g.flags.shopHeart ? 'Sold out.' : 'ok', buy: g => { g.flags.shopHeart = true; g.gainHeartContainer(true); } },
      { name: 'Gale Valve', price: 150, desc: 'Gustbellows reach +40%, and gales hit harder.', state: g => !g.inv.bellows ? 'Posy: "Valve for what, exactly?"' : g.inv.galeValve ? 'Owned.' : 'ok', buy: g => { g.inv.galeValve = true; } },
      ...gear,
    ]);
  }
  // ------------------------------------------------ bounty board (repeatable)
  newBounty(exclude = []) {
    const g = this.g, L = g.inv.level;
    const T = [
      { kind: 'kill', target: 'blot', n: 12, name: 'Blotlings', where: 'anywhere' },
      { kind: 'kill', target: 'sporeling', n: 10, name: 'Sporelings', where: 'Whisperwood' },
      { kind: 'kill', target: 'beetle', n: 5, name: 'Thornback beetles', where: 'the east fields' },
      { kind: 'kill', target: 'brigand', n: 5, name: 'Hushbound Brigands', where: 'the east road' },
      { kind: 'kill', target: 'wraith', n: 5, name: 'Mirewraiths', where: 'Lake Mirrow', minL: 3 },
      { kind: 'kill', target: 'scorpion', n: 6, name: 'Sand Scorpions', where: 'the Sunscald Reach', minL: 4 },
      { kind: 'kill', target: 'imp', n: 5, name: 'Ember Imps', where: 'near Cinderpeak Pass', minL: 5 },
      { kind: 'kill', target: 'treant', n: 1, name: 'a Barkhulk', where: 'deep Whisperwood' },
      { kind: 'kill', target: 'golem', n: 1, name: 'a Stone Sentinel', where: 'the Chime Gate', minL: 5 },
      { kind: 'kill', target: 'elite', n: 3, name: 'elite monsters', where: 'anywhere (glowing auras)' },
      { kind: 'kill', target: 'thief', n: 1, name: 'a Pip Thief', where: 'wherever one appears', minL: 2 },
      { kind: 'chest', target: 'chest', n: 3, name: 'loot chests', where: 'the gold ◆ on your map' },
    ].filter(t => (t.minL || 1) <= L && !exclude.includes(t.target));
    const t = T[Math.floor(Math.random() * T.length)];
    return { ...t, have: 0, pips: 25 * L + t.n * 4, xp: 40 * L + t.n * 6, id: Math.random().toString(36).slice(2) };
  }
  bounties() {
    const f = this.f;
    if (!f.bounties) { f.bounties = []; }
    while (f.bounties.length < 3) f.bounties.push(this.newBounty(f.bounties.map(b => b.target)));
    return f.bounties;
  }
  bountyEvent(tags) {
    const g = this.g, list = this.f.bounties;
    if (!list) return;
    for (const b of list) {
      if (b.have >= b.n) continue;
      const match = (b.kind === 'chest' && tags[0] === 'chest') || (b.kind === 'kill' && tags[0] === 'kill' && (tags.includes(b.target)));
      if (!match) continue;
      b.have++;
      if (b.have >= b.n) { sfx('secret'); g.ui.toast('Bounty complete: ' + b.name, 'Claim your reward at the Bounty Board in Thimblewick.', 3); }
      else if (b.n > 2) g.ui.lootToast({ r: 0, name: `Bounty: ${b.name} ${b.have}/${b.n}`, slot: 'charm', kind: null }, '');
    }
  }
  board() {
    const g = this.g, list = this.bounties();
    let claimed = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.have >= b.n) {
        claimed++;
        g.addCoins(b.pips); g.gainXp(b.xp);
        g.dropGear(g.player.x, g.player.z + 0.8, { level: g.inv.level + 1, floor: 2, bonus: 0.5 });
        this.f.bountiesDone = (this.f.bountiesDone || 0) + 1;
        list[i] = this.newBounty(list.map(x => x.target));
      }
    }
    if (claimed) { sfx('fanfare'); g.ui.toast(`Claimed ${claimed} bount${claimed > 1 ? 'ies' : 'y'}!`, 'Pips, experience and gear.', 2.5); g.save(); }
    g.ui.lines([[ 'Bounty Board', 'Pinned notices, stamped with Captain Brisk\'s seal:\n\n' + list.map(b => `• Defeat ${b.n} ${b.name} — ${b.where}  (${Math.min(b.have, b.n)}/${b.n})\n   Reward: ${b.pips} pips, ${b.xp} XP + gear`).join('\n') ]]);
  }
  riftStone() {
    const g = this.g, best = this.f.riftBest || 0;
    if (g.inv.level < 2) return g.ui.say('Rift Stone', 'The stone hums, but pushes your hand away. (Reach level 2 to enter the Hush Rift.)');
    const opts = [{ label: 'Floor 1', cb: () => g.enterRift(1) }];
    if (best >= 1) opts.push({ label: `Floor ${best + 1} (deepest)`, cb: () => g.enterRift(best + 1) });
    if (best >= 6) opts.push({ label: `Floor ${Math.max(1, best - 3)}`, cb: () => g.enterRift(Math.max(1, best - 3)) });
    opts.push({ label: 'Not now', cb: () => {} });
    g.ui.ask('Rift Stone', `A crack in the world, humming with the Hush. Inside, monsters grow stronger with every floor — and so does their treasure.\nDeepest floor cleared: ${best}. Enter?`, opts);
  }
  shopBye() { this.g.ui.say('Posy', 'Come back with fuller pockets!'); }

  gate() {
    const g = this.g, n = g.inv.chimes.length;
    g.ui.lines([[null, `THE CHIME GATE\nThree sockets are set into the stone: green, ember, and tide-blue.\n${n ? `*${n} of 3* glow${n === 1 ? 's' : ''}.` : 'All three are dark.'}`],
      ...(n < 3 ? [[null, n ? 'The green socket hums in answer to your Verdant Chime. The others are silent. The gate does not move.' : 'Cold stone. No handle, no hinge — only the sockets.']] : [])]);
  }

  // ------------------------------------------------ artifact & ending of Chapter I
  takeChime(ped) {
    const g = this.g;
    g.cutscene = true;
    ped.remove();
    const m = ped.chime;
    g.holdUp(m, 'verdant');
    sfx('chime');
    g.inv.chimes.push('verdant');
    g.pr.addFlash(0.6, 0xb8ff9a);
    g.ui.banner('THE FIRST VOICE', 'Verdant Chime', 3);
    setTimeout(() => {
      g.ui.lines([
        [null, 'You got the *Verdant Chime*!\nThe first Voice of the Dawnbell. It hums a note like new leaves.'],
        [null, 'As you lift it, the Chime *sings* — and for a moment you see a vision:'],
        [null, 'Three Bellwrights on a mountaintop, prising the Voices from a great bell. One of them is weeping.\n"~Never let the Last Toll ring~," she whispers. "~Not until it must.~"'],
        [null, 'The vision fades. The Hollow\'s roots curl upward, lifting you toward the light…'],
      ], () => {
        g.endHold();
        this.f.stage = 2; this.f.bossDead = true;
        g.heal(99);
        g.save();
        g.warpTo('overworld', 'dungeon', () => { g.ui.toast('Return the Verdant Chime to Thimblewick', 'Follow the gold marker on your map (Esc).', 4); });
      });
    }, 1400);
  }
  ringBell() {
    const g = this.g, f = this.f;
    g.cutscene = true;
    g.camFocus = { x: 58, z: 57.5 };
    g.ui.lines([
      ['Elder Tamsin', 'Moss… is that… the Verdant Voice? Quickly — set it in the bell!'],
    ], () => {
      sfx('chime'); g.bell && g.bell.ring(true);
      g.pr.addFlash(0.8, 0xfff3b0);
      g.hushLift();
      setTimeout(() => {
        g.ui.lines([
          ['Elder Tamsin', 'Hear that? One voice of three — thin, but *true*. The Hush is pulling back from the forest.'],
          ['Elder Tamsin', 'The bell sings of its lost siblings: the *Ember Chime* past Cinderpeak Pass, and the *Tide Chime* beneath Lake Mirrow.'],
          ['Elder Tamsin', 'And that vision you spoke of… the Bellwrights hid the Voices *on purpose*? Then who called them out again?'],
          ['Elder Tamsin', 'Rest a while, Moss. Help the village. When the paths open, the Chime Gate will be waiting.'],
        ], () => {
          f.stage = 3; g.cutscene = false; g.camFocus = null; g.gainXp(400); g.save();
          const st = g.stats;
          g.ui.banner('CHAPTER I COMPLETE', 'The Verdant Voice', 4);
          setTimeout(() => g.ui.lines([[null, `*Thank you for playing Chapter I of Mossling: The Silent Bell.*\n\nHushlings defeated: ${st.kills || 0}   ·   Perfect parries: ${st.parries || 0}   ·   Time: ${Math.floor(g.playTime / 60)}m`],
            [null, 'Cinderpeak and Lake Mirrow are still sealed in this build. The overworld stays open: the Hush camp bounty, the Still Mill, Ada\'s pier, the Hollow Grotto, the Sunken Courtyard and hidden leaf piles are all waiting.']]), 1500);
        });
      }, 2200);
    });
  }

  journal() {
    const f = this.f, g = this.g;
    const q = (title, done, text) => `<div class="quest ${done ? 'done' : ''}"><b>${done ? '✔ ' : ''}${title}</b><br>${text}</div>`;
    let h = q('The Silent Bell', f.stage >= 3, this.objective());
    if (f.q_mill) h += q('The Still Mill', f.q_mill === 2, f.windmill ? 'The mill turns! Tell Miller Oswin.' : 'Miller Oswin needs a gale to restart the windmill in Thimblewick.');
    if (f.q_camp) h += q('Bounty: Hush Camp', f.q_camp === 2, g.signal('camp.clear') ? 'Camp cleared. Collect the bounty from Captain Brisk.' : 'Clear the Hush camp across the north bridge.');
    for (const b of (f.bounties || [])) h += q('Bounty: ' + b.name, b.have >= b.n, b.have >= b.n ? 'Complete! Claim it at the Bounty Board.' : `${b.have}/${b.n} — ${b.where}`);
    if (f.q_pier) h += q('Ada\'s Pier', f.q_pier === 2, this.pierDone() ? 'Path cleared. Tell Fisher Ada.' : 'Push the fallen stone off the pier path, south of the village.');
    const rum = [];
    if (!f['chest:grotto-chest']) rum.push('A stone door in the north of Whisperwood only opens for the wind.');
    if (!f['chest:ruin-chest']) rum.push('Sand has swallowed a courtyard in the Sunscald Reach.');
    if (rum.length) h += `<div class="quest"><b>Rumours</b><br>${rum.join('<br>')}</div>`;
    return h;
  }
  gear() {
    const inv = this.g.inv;
    const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
    return `<table>${['weapon', 'helm', 'armor', 'charm'].map(k => row(k[0].toUpperCase() + k.slice(1), inv.equip[k] ? `<span style="color:${RARITY[inv.equip[k].r].color}">${inv.equip[k].name}</span>` : '—')).join('')}${row('Tool', inv.bellows ? 'Gustbellows' + (inv.galeValve ? ' + Gale Valve' : '') : '—')}${row('Tonics', inv.potions + ' / ' + inv.maxPotions)}${row('Chimes', inv.chimes.length ? inv.chimes.map(c => c[0].toUpperCase() + c.slice(1)).join(', ') : '—')}</table>
    <p style="font-size:14px;color:#e2c98f">Press I for your bag, stats and skills. Gustbellows: tap L for a puff, hold for a gale.</p>`;
  }
}
