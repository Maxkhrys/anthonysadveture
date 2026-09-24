// Narrative, quests, NPC conversations, shop stock.
import { sfx, playMusic } from './engine/audio.js';
import { dropPips } from './entities/common.js';
import { genItem, RARITY, itemIcon } from './rpg/items.js';
import { gainMat, learn } from './rpg/crafting.js';

export class Story {
  constructor(g) { this.g = g; }
  get f() { return this.g.flags; }
  get stage() { return this.f.stage || 0; }

  objective() {
    const f = this.f, g = this.g;
    if (g.area && g.area.rift) return `Hush Rift · Floor ${g.area.floor}: clear each room and defeat the Champion.`;
    if (g.area && g.area.id === 'dungeon' && !f.bossDead) {
      if (f.bossKilled) return 'Take the Verdant Chime from its pedestal.';
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
    if (this.g.inv.chimes.includes('verdant') && !f['chest:echo-chest']) m.push({ x: 32.5, z: 29.5, color: '#9ad8ff' });
    if (this.g.inv.mats && (this.g.inv.mats.thornheart || this.g.inv.mats.echo || this.g.inv.mats.ember || this.g.inv.mats.sailcloth)) m.push({ x: 55.3, z: 64.8, color: '#c9a8ff', pulse: true });
    const g = this.g;
    if (g.area && g.area.id === 'overworld') for (const e of g.entities) if (e.constructor.name === 'LootChest' && !e.opened && f['seenchest:' + e.id]) m.push({ x: e.x, z: e.z, color: ['#c89a5a', '#c0c0d0', '#ffd25e'][e.tier] });
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
          g.ui.toast('Mouse: aim  ·  Click / J: attack  ·  K: guard  ·  Space: roll', '1-3: abilities  ·  Hold to charge  ·  A red ! means an attack is coming', 6);
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
  // Short authored talks: a greeting that reacts to what you've done, then a few topics.
  // Unread topics are marked •; once read, a topic gives its short version instead.
  converse(npc, greet, topics, onEnd) {
    const g = this.g, f = this.f, ui = g.ui;
    const avail = topics.filter(t => !t.when || t.when());
    let first = true;
    const menu = () => {
      const text = first ? (typeof greet === 'function' ? greet() : greet) : 'Anything else?';
      first = false;
      const opts = avail.filter(t => !t.once || !f['topic:' + npc.id + ':' + t.id]).map(t => {
        const read = !!f['topic:' + npc.id + ':' + t.id];
        return { label: (read || t.act ? '' : '• ') + t.label, cb: () => {
          const lines = typeof t.lines === 'function' ? t.lines(read) : (read && t.short ? t.short : t.lines);
          f['topic:' + npc.id + ':' + t.id] = true;
          if (t.act) return t.act();
          ui.lines(lines.map(l => Array.isArray(l) ? l : [npc.name, l]), () => { if (t.then) t.then(); g.save(); menu(); });
        } };
      });
      opts.push({ label: 'Goodbye', cb: () => { onEnd && onEnd(); } });
      ui.ask(npc.name, text, opts);
    };
    menu();
  }
  // class-aware words
  get cw() {
    const c = this.g.inv.cls;
    return {
      samurai: { tool: 'blade', pet: 'little blade', heir: 'your grandfather\'s katana', style: 'You cut like wind through barley.' },
      archer: { tool: 'bow', pet: 'sharp-eye', heir: 'your mother\'s hunting bow', style: 'You loose arrows like a flock of swifts.' },
      witch: { tool: 'staff', pet: 'little witch', heir: 'old Nettle\'s acorn staff', style: 'You hex like a thundercloud in a teacup.' },
    }[c] || { tool: 'blade', pet: 'little one', heir: 'that old heirloom', style: '' };
  }
  talk(npc) {
    const g = this.g, f = this.f, ui = g.ui, s = this.stage, cw = this.cw, inv = g.inv;
    const L = (arr, cb) => ui.lines(arr.map(t => Array.isArray(t) ? t : [npc.name, t]), cb);
    const crafted = inv.equip.weapon && inv.equip.weapon.craft;
    switch (npc.id) {
      case 'tamsin': {
        if (s === 0 && !f.introFought) return L(['Hushlings at the south path! Hurry, Moss!']);
        if (s === 0) return L([
          `You fought like a bell-ringer thrice your size! ${cw.style}`,
          'Now listen. The Dawnbell sings with three *Voices* — three Chimes the old Bellwrights forged. Together they keep the Hush asleep.',
          'Last night all three left the bell. Not stolen… it was as if they *walked away*.',
          'I can feel the *Verdant Chime* humming from the west — deep in Whisperwood, inside *Rootwell Hollow*.',
          'Take the west road. Rest at any *Bellstone* you find: it will mend you and remember you. And spend your pips at Posy\'s stall.',
        ], () => { f.stage = 1; g.gainXp(40); g.ui.updateHud(); g.save(); ui.toast('New objective', 'Rootwell Hollow — west through Whisperwood. (Esc: map)', 3); });
        if (s === 2) return this.ringBell();
        const greet = () => {
          if (s === 1 && f.q_mill === 2 && !f['said:tamsin:mill']) { f['said:tamsin:mill'] = true; return 'Did you hear it? Oswin\'s mill, *humming*. First honest sound this village has made in days. You did that.'; }
          if (s === 1) return `Rootwell Hollow lies west, ${cw.pet}. The Hush grows bolder the longer the bell is quiet.`;
          if (crafted && !f['said:tamsin:craft']) { f['said:tamsin:craft'] = true; return `Posy tells me you've been at her bench. That ${cw.tool} of yours hums now. Mind it doesn't hum louder than you.`; }
          return 'One Voice home. Listen — the forest is breathing again. What\'s on your mind?';
        };
        return this.converse(npc, greet, [
          { id: 'bell', label: 'The Dawnbell', lines: [
            'It doesn\'t just ring, you know. It *remembers*. Every sound Thimblewick makes, the bell keeps, and gives back at dawn.',
            'Since the Voices left, things have been going quiet. The birds. The mill. Old Hobb\'s snoring, which I don\'t miss.',
            'Sounds that aren\'t remembered don\'t simply vanish, Moss. They go *somewhere*.',
          ], short: ['The bell remembers every sound we make. Without its Voices, sounds are slipping away.'] },
          { id: 'hush', label: 'The Hush', lines: [
            'The Hush is what sound leaves behind when it\'s lost. Ink and quiet, given teeth.',
            `It hates anything that rings — and that ${cw.tool} of yours rings plenty. That's why they come at you.`,
            'Watch them before they strike. They draw breath first; you\'ll see it. Strike when they\'ve spent it.',
          ], short: ['They draw breath before they strike. Wait for it, then answer.'] },
          { id: 'heir', label: 'About my ' + cw.tool, lines: [
            `That's ${cw.heir}. It was too big for its first owner too, once.`,
            inv.cls === 'samurai' ? 'Your grandfather didn\'t win fights by swinging hardest. He won them by *not* being where the other fellow swung.' : inv.cls === 'archer' ? 'Your mother could split a falling leaf from the bell tower. She said the trick was to aim where it would be, not where it was.' : 'Old Nettle used to say a hex is only a promise the world hasn\'t noticed yet. Then she\'d set her hat on fire.',
          ], short: [`${cw.heir[0].toUpperCase() + cw.heir.slice(1)}. Look after it and it will look after you.`] },
          { id: 'rest', label: 'Bellstones', lines: [
            'Every Bellstone was cast from the Dawnbell\'s own bronze. Touch one and it mends you, refills your tonics — and remembers you.',
            'Fall, and you\'ll wake at the last one that knew your name. Nothing you carry is lost.',
          ], short: ['Rest at Bellstones. They mend you and remember you.'] },
          { id: 'vision', label: 'The vision', when: () => s >= 3, lines: [
            'The Bellwrights *hid* the Voices. On purpose. And now something has called them out again.',
            '"Never let the Last Toll ring," you said she whispered. I have read every book in this village, Moss. Not one of them mentions a Last Toll.',
            'Which means someone made very sure they wouldn\'t.',
          ], short: ['The Bellwrights hid the Voices on purpose. We need to know why.'] },
          { id: 'next', label: 'What now?', when: () => s >= 3, lines: [
            'The Ember Chime burns past *Cinderpeak Pass*; the Tide Chime sleeps beneath *Lake Mirrow*. Both roads are shut for now.',
            f.q_mill === 2 ? 'Meanwhile the mill sings, the camp — well. Help where you can. Posy\'s bench might teach that ' + cw.tool + ' some new tricks.' : 'Meanwhile, Oswin\'s mill still stands silent. Perhaps that bellows of yours could help.',
          ] },
        ]);
      }
      case 'posy': {
        const greet = () => {
          if (!f.metPosy) { f.metPosy = true; return inv.cls === 'samurai' ? 'A samurai! Welcome to the Bramble & Bolt. My whetstones are trembling with excitement.' : inv.cls === 'archer' ? 'An archer! Welcome to the Bramble & Bolt. Fletching\'s on the left, please don\'t test it on the pigeons.' : 'A witch! Welcome to the Bramble & Bolt. Nothing on the shelves is cursed. Probably.'; }
          if (crafted && !f['said:posy:' + crafted]) { f['said:posy:' + crafted] = true; return 'Is that my engraving? Oh, look at it *sing*. Don\'t tell Oswin, but that\'s my best work.'; }
          if (inv.mats && (inv.mats.thornheart || inv.mats.echo || inv.mats.ember || inv.mats.sailcloth)) return 'I can *smell* essence on you. Bring it to the bench and we\'ll make something loud.';
          return 'Back again! Tonics, gear, or a little work at the bench?';
        };
        return this.converse(npc, greet, [
          { id: 'shop', label: 'Trade', act: () => this.shop() },
          { id: 'bench', label: 'Use the workbench', act: () => g.ui.openCraft() },
          { id: 'craft', label: 'How does crafting work?', lines: [
            'Simple! A weapon, one *rare essence*, and a pinch of *Hush Shards*. You get shards by salvaging gear — X in your bag.',
            'The essence decides what your weapon *does*. Not just hit harder — do something different. A bow that echoes. A staff that plants embers.',
            'I only work with what you bring. And I never, ever touch a Chime. Tamsin would have my ears.',
          ], short: ['Weapon + essence + shards. The essence changes what it does. Salvage gear for shards.'] },
          { id: 'essence', label: 'Where do essences come from?', lines: [
            'A *Thornheart* beats inside whatever guards Rootwell Hollow — and Barkhulks carry little ones.',
            '*Hollow Echoes* hang about where the Bellwrights built things. There\'s an old door east of the Hollow that nobody\'s ever opened.',
            '*Ember Motes* fall off Ember Imps near Cinderpeak, and those twitchy, glowing Volatile brutes.',
            f.q_mill === 2 ? 'And Oswin\'s *sailcloth*, of course. Flour and wind — best binding I\'ve ever used.' : 'Oswin swears his old mill sails would make a fine binding, if the mill ever turned again.',
          ], short: ['Thornhearts from the Hollow\'s guardian and Barkhulks. Echoes near Bellwright ruins. Embers from Imps and Volatile elites.'] },
          { id: 'gossip', label: 'Any news?', lines: () => [
            f.q_camp === 2 ? 'Captain Brisk has been telling everyone he cleared the Hush camp himself. I told him I saw you do it. He\'s sulking.' :
              f.q_mill === 2 ? 'Bread! Real bread, from Oswin\'s flour. I sold three loaves before breakfast.' :
                'Fennel tried to sell me a "genuine Hush tooth." It was a pebble. I gave him a pip for effort.',
          ] },
        ]);
      }
      case 'oswin': {
        if (!f.q_mill) return this.converse(npc, 'Hm? Oh. Hello, Moss. Mind the millstones. Not that they\'re going anywhere.', [
          { id: 'mill', label: 'Why is the mill still?', lines: [
            'She\'s gone still since the Hush came. Not a breath of wind in her sails, even on a blustery day.',
            'She used to *hum*, you know. One long, low note, right in tune with the Dawnbell. When the bell went quiet, so did she.',
            'If you ever find a way to make a proper *gale*, you come blow her back to life. I\'ll make it worth your while.',
          ], then: () => { f.q_mill = 1; ui.updateHud(); ui.toast('Side quest: The Still Mill', 'Oswin needs a gale for his windmill.', 2.4); } },
        ]);
        if (f.q_mill === 1 && f.windmill) return L([
          'She\'s TURNING! Listen to her — she\'s *humming* again! Half the note, but it\'s there!',
          `Here. Eighty pips, and something better: my spare sailcloth. Posy's been begging for it for years — says it binds wind to a ${cw.tool}.`,
          'Take it to her bench. I\'ll show you the trick of it: a *Millwind* edge. Every big swing throws a gale, same as your bellows.',
          'And look — I\'ve hooked the sails to a whetwheel. The whole yard\'s awake!',
        ], () => {
          f.q_mill = 2; g.addCoins(80); g.gainXp(80); sfx('pipbig');
          gainMat(g, 'sailcloth', 1, npc.x, npc.z);
          learn(g, 'millwind');
          const d = g.area.defs.find(d => d.type === 'millyard'); if (d) g.spawnDef(d);
          g.fx.ring(47, 51, 0.8, 3.2, 0xfff3cf, 1.4, 0.15); g.pr.addFlash(0.2, 0xfff3cf);
          ui.toast('Side quest complete: The Still Mill', '+80 pips · +80 XP · Mill Sailcloth · recipe: Millwind Edge', 3.5);
          g.save();
        });
        if (f.q_mill === 1) return L([inv.bellows ? 'That bellows of yours… could it puff hard enough? *Hold* it longer. Build a real gale, then let her have it.' : 'A proper gale is what she needs. Not your huffing and puffing, little one.']);
        return this.converse(npc, () => f['said:oswin:hello'] ? 'Flour\'s flowing. Bread\'s baking. What can I do for you?' : (f['said:oswin:hello'] = true, 'Listen to her hum! The whole village smells of bread. Thank you, Moss.'), [
          { id: 'song', label: 'The mill\'s song', lines: [
            'She hums again, but only *half* the note. The other half always came from the bell.',
            'My gran said the Bellwrights built this mill to sing along with it. Everything old in this valley sings along with it, if you listen.',
          ], short: ['Half the note. The other half belongs to the bell.'] },
          { id: 'millwind', label: 'The Millwind edge', lines: [
            'Wind\'s just air that\'s decided where it\'s going. The sailcloth teaches your weapon to decide too.',
            'Put it on at Posy\'s bench. Then every *charged* strike throws a gust: knocks the Hush back, spins a pinwheel, snuffs a candle. Handy when your bellows is busy.',
          ], short: ['Charged strikes throw a gust. Posy\'s bench does the work.'] },
          { id: 'sail', label: 'Another sailcloth? (60 pips)', when: () => (inv.mats.sailcloth || 0) === 0, act: () => {
            if (inv.coins < 60) { sfx('error'); return L(['Sixty pips, Moss. Sails don\'t grow on trees. Well. The wood does.']); }
            inv.coins -= 60; gainMat(g, 'sailcloth', 1, npc.x, npc.z); ui.updateHud(); g.save();
            L(['Here. Cut from the old spring sail. Don\'t let Posy charge you twice for the stitching.']);
          } },
        ]);
      }
      case 'brisk':
        if (s < 1) return L([`Ho, Moss. Hushlings at the south path, they say. Show 'em that ${cw.tool}!`]);
        if (!f.q_camp) return L(['The Hush has dug a camp across the *north bridge*, east of the river. Tents, stakes, the lot.', 'I\'ve got two guards and one of them\'s asleep. Clear that camp and the guard purse is yours: *150 pips*.'], () => { f.q_camp = 1; ui.updateHud(); ui.toast('Side quest: Bounty — Hush Camp', 'Marked on your map.', 2.4); });
        if (f.q_camp === 1 && g.signal('camp.clear')) return L(['You cleared the WHOLE camp? By yourself? …Don\'t tell the other guards. Here\'s your bounty.'], () => { f.q_camp = 2; dropPips(g, g.player.x, g.player.z + 0.6, 150); g.gainXp(250); g.dropGear(g.player.x, g.player.z + 0.8, { level: g.inv.level + 1, floor: 3, bonus: 1 }); ui.toast('Bounty complete!', '+150 pips · +250 XP · a gift from the armoury', 2.5); g.save(); });
        if (f.q_camp === 1) return L(['The Hush camp is across the north bridge. The big armoured ones swing *slow and heavy* — a plain guard won\'t hold. Time a parry, or get out of the way.']);
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
          'When a Hush gets a red *!* over its head it\'s about to bite. Roll away — or guard right as it lunges!',
          'The big armoured ones get an *orange* !. Grandpa says don\'t just hold your shield up. Tap it *right* when they swing!',
          'When your *Bell Surge* bar glows, press R. BONNNG!',
          f.q_mill === 2 ? 'The mill hums now! I can hear it from my bed. It\'s only half a song, though. Where\'s the other half?' : 'Leaf piles sometimes hide pips. But leaves are stubborn. Swords don\'t move them!',
          inv.chimes.length ? 'There\'s a door east of the Hollow with TWO pinwheels. I tried running between them. I fell over.' : 'Did you know there\'s a Bellstone right by the well? Grown-ups touch it for luck.',
        ];
        f.fennelI = ((f.fennelI ?? -1) + 1) % hints.length;
        return L([hints[f.fennelI]]);
      }
      case 'hermit':
        if (!f.bossKilled) return L([
          'Mm. A Mossling, at the Hollow\'s mouth. The roots told me you\'d come.',
          'Inside, the Hollow shifts its breath. Wind will be your friend there — and remember: *what falls into a hole becomes floor.*',
          'And if a room tangles you up, step out and come back. The Hollow forgives.',
        ]);
        return L([
          'You carry the Verdant Voice. I hear it. It is… sad, isn\'t it? Like a song that ended too early.',
          'Listen to it when you use your bellows. It repeats you. That is what the Voices were *for*.',
          'East of here, the Bellwrights left a door that only a repeated wind can open.',
          inv.cls === 'witch' ? 'And little witch — frost remembers, too. Let your Frost Nova linger, and the Hollow\'s thorn-heart will teach it to *bloom*. Posy will know how.' : 'The Bellwrights did not lose the Voices, child. They *hid* them. Ask yourself what they were afraid of.',
        ], () => { if (inv.cls === 'witch') learn(g, 'rimebloom'); });
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
        [null, 'The vision fades. The Chime keeps humming — and when you squeeze your bellows, it *answers*: the same gust, blown again a breath later, from where you stood.'],
        [null, 'The Hollow\'s roots curl upward, lifting you toward the light…'],
      ], () => {
        g.endHold();
        this.f.stage = 2; this.f.bossDead = true;
        g.heal(99);
        g.save();
        g.warpTo('overworld', 'dungeon', () => { g.ui.toast('Return the Verdant Chime to Thimblewick', 'Follow the gold marker on your map (Esc). Your gusts now echo.', 4); });
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
    if (f.q_mill === 2) h += q('The Humming Mill', true, 'The mill turns and hums again. Oswin gave you his sailcloth and the Millwind recipe — Posy\'s workbench can put it on any weapon.');
    if (g.inv.chimes.includes('verdant')) h += q('The Echo Door', !!f['chest:echo-chest'], f['chest:echo-chest'] ? 'Opened. The Bellwrights taught the Voices to repeat.' : 'East of Rootwell Hollow, two pinwheels with a hedge between them. Your gusts echo now…');
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
