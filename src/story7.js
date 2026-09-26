// World pass: the people of the two new regions and their quests, plus journal and map entries
// for the places discovered. Same conversation system as the rest of the game (Story.converse).
//
//  Wind the Old Clock   (Clockwork Garden)  Cogsworth Pim, the Gearhouse tinker
//  Wake the Glowcaps    (Rootlight Caverns) Mira the Lampkeeper, Glowroot Refuge
import { sfx } from './engine/audio.js';
import { dropPips } from './entities/common.js';
import { REGIONS } from './world/layout.js';
import { regionState } from './world7.js';

export const QUESTS7 = [
  { id: 'q_clock', name: 'Wind the Old Clock', where: 'The Gearhouse, Clockwork Garden', region: 'clockwork',
    steps: ['Throw the three winding levers: the Wheelworks (west), the Bronze Belfry (east, behind the bells), and the heart of the Topiary Maze (south-west).', 'Tell Cogsworth Pim the clock has struck.'] },
  { id: 'q_bloom', name: 'Wake the Glowcaps', where: 'Glowroot Refuge, Rootlight Caverns', region: 'rootlight',
    steps: ['Wake the three dormant lumen blooms: in the Glowroot Hall, the Crystal Seam and by the Underlake.', 'Tell Mira the old route is lit.'] },
];
const done7 = (g, id) => ({ q_clock: g.signal('w7:cg.wound'), q_bloom: g.signal('w7:rl.lit') })[id];

export function installStory7(Story) {
  const P = Story.prototype;
  const baseTalk = P.talk, baseHasNews = P.hasNews, baseJournal = P.journal, baseMarkers = P.markers, baseLabels = P.labels;
  const NEW = new Set(['pim', 'mira']);
  P.talk = function (npc) { if (NEW.has(npc.id)) return this.talk7(npc); return baseTalk.call(this, npc); };
  P.hasNews = function (id) {
    const f = this.f, g = this.g;
    if (id === 'pim') return !f.q_clock || (f.q_clock === 1 && done7(g, 'q_clock'));
    if (id === 'mira') return !f.q_bloom || (f.q_bloom === 1 && done7(g, 'q_bloom'));
    return baseHasNews.call(this, id);
  };
  P.journal = function () {
    const f = this.f, g = this.g;
    let html = baseJournal.call(this);
    const rows = QUESTS7.filter(q => f[q.id]).map(q => {
      const fin = f[q.id] === 2, ready = !fin && done7(g, q.id), st = regionState(g);
      const progress = q.id === 'q_clock' ? ` (${st.levers.length}/3 levers)` : ` (${st.blooms.length}/3 blooms)`;
      return `<div class="quest ${fin ? 'done' : ''}"><b>${fin ? '✔ ' : ''}${q.name}</b> <small>${q.where}</small><br>${fin ? 'Done.' : (ready ? q.steps[1] : q.steps[0] + progress)}</div>`;
    }).join('');
    // places you have found: the regions, each with where it is
    const D = g.world6 && g.world6.discovery, places = D ? D.regions.filter(r => REGIONS[r] && REGIONS[r].major) : [];
    const where = { clockwork: 'Through the Clockwork Gate, north of the east road past the Mirrowrun bridge.', rootlight: 'Down the Rootlight Mouth, south-west of the Deepwood Shrine. The Root Lift rises into Thimblewick\'s Hedge Garden.' };
    const found = places.map(r => `<div class="quest"><b>${REGIONS[r].name}</b> <small>around level ${REGIONS[r].level}</small><br>${where[r] || ''}</div>`).join('');
    return html + (rows ? `<h3>Further afield</h3>${rows}` : '') + (found ? `<h3>Places discovered</h3>${found}` : '');
  };
  // map markers: region-local ones inside the region areas, the old world's everywhere else
  P.markers = function () {
    const g = this.g, a = g.area, f = this.f;
    if (a && a.region7) {
      const m = [], ob = g.onboarding?.target(); void ob;
      const on = id => a.defs.find(d => (d.type === 'gearlever' || d.type === 'glowbloom') && d.id === id);
      if (a.region7 === 'clockwork' && f.q_clock === 1) for (const id of ['A', 'B', 'C']) if (!g.signal('w7:cg.lever.' + id)) { const d = on(id); if (d) m.push({ x: d.x, z: d.z, color: '#d8aa4a', pulse: true, name: 'Winding lever' }); }
      if (a.region7 === 'rootlight' && f.q_bloom === 1) for (const id of ['hall', 'seam', 'lake']) if (!g.signal('w7:rl.bloom.' + id)) { const d = on(id); if (d) m.push({ x: d.x, z: d.z, color: '#9af0e0', pulse: true, name: 'Dormant lumen bloom' }); }
      const npc = a.defs.find(d => d.type === 'npc' && NEW.has(d.id));
      if (npc && this.hasNews(npc.id)) m.push({ x: npc.x, z: npc.z, color: '#ffd25e', name: npc.name });
      const wp = g.flags['w7:waypoint']; if (wp && wp.area === a.id) m.push({ x: wp.x, z: wp.z, color: '#c0503a', name: 'Waypoint: ' + wp.name, waypoint: true });
      return m;
    }
    const m = baseMarkers.call(this);
    const wp = g.flags['w7:waypoint']; if (wp && (!a || wp.area === a.id)) m.push({ x: wp.x, z: wp.z, color: '#c0503a', name: 'Waypoint: ' + wp.name, waypoint: true });
    return m;
  };
  P.labels = function () {
    const g = this.g, a = g.area;
    if (a && a.region7 && g.world6) { const D = g.world6.discovery; return a.landmarks.filter(L => D.landmarks.includes(L.id)).map(L => ({ t: L.name, x: L.x, z: L.z + 2 })); }
    return baseLabels.call(this);
  };

  P.talk7 = function (npc) {
    const g = this.g, f = this.f, ui = g.ui;
    const L = (arr, cb) => ui.lines(arr.map(t => Array.isArray(t) ? t : [npc.name, t]), cb);
    const accept = (id) => { f[id] = 1; const q = QUESTS7.find(q => q.id === id); sfx('select'); ui.toast('Side quest: ' + q.name, q.steps[0], 3.4); ui.updateHud(); g.save(); };
    const finish = (id, text, lvl) => {
      f[id] = 2; const q = QUESTS7.find(q => q.id === id); sfx('fanfare'); ui.toast('Side quest complete: ' + q.name, text, 4);
      const p = g.player; g.dropGear(p.x, p.z + 1.2, { level: Math.max(lvl, g.inv.level), floor: 3, bonus: 1 }); dropPips(g, p.x + 0.8, p.z + 0.8, 120); g.gainXp(420 + lvl * 30);
      g.stats.quests7 = (g.stats.quests7 || 0) + 1; g.save();
    };
    switch (npc.id) {
      case 'pim': {
        const st = regionState(g);
        if (!f.q_clock) return L([
          'Mind the cogs! Oh — a Mossling. A proper one. I\'m Pim. Cogsworth Pim. I tinker.',
          'You\'ve seen her? The Great Clock, up past the Hedge Gallery. Stopped since before my grandmother\'s grandmother.',
          'Three winding levers wind her: one in the Wheelworks, one in the Bronze Belfry — the bells guard that one — and one at the heart of the Topiary Maze.',
          'Throw all three and she\'ll strike. And when she strikes, the Mainspring Gate opens: a quick way back up to the court from the lawn.',
        ], () => accept('q_clock'));
        if (f.q_clock === 1 && st.wound) return L(['You did it! Did you HEAR her? Every gear in the garden jumped.', 'Here — I\'ve been saving these for whoever managed it. And the Mainspring Gate is yours to use now.'], () => finish('q_clock', 'The Great Clock keeps time again.', 7));
        if (f.q_clock === 1) return L([`${st.levers.length} of 3 levers so far. ${st.levers.includes('B') ? '' : 'The Belfry lever sits behind a gate the bells open — read the plaque by the frame. '}${st.levers.includes('C') ? '' : 'The maze lever is right in the middle; the maze is less clever than it looks.'}`]);
        return this.converse(npc, 'Tick, tock. Lovely sound. I never get tired of it.', [
          { id: 'garden', label: 'Who built the garden?', lines: ['Big folk. Gardeners with clocks for hearts, my gran said. They wound everything — even the hedges grew on a timer.', 'When they left, the hedges kept growing and the clock stopped. Guess which one won.'] },
          { id: 'undercroft', label: 'What is under the Gearhouse?', lines: ['The Undercroft. The garden\'s workings go down there. Weights and springs, and whatever has nested among them.', 'Put a weight on each side of the Weight Room and the spring door listens.'] },
          { id: 'wicket', label: 'Any shortcuts?', lines: ['The wicket in the court\'s south hedge. Latched from the court side — lift it once and it stays open, straight down to me.'] },
        ]);
      }
      case 'mira': {
        const st = regionState(g);
        if (!f.q_bloom) return L([
          'Careful with that light of yours — the dark down here is old, but it isn\'t cruel. Mostly.',
          'I\'m Mira. I keep the lamps at the Refuge. The lumen blooms used to light the whole route, from the Hall to the Hanging Roots.',
          'Three of them have gone dormant: in the Glowroot Hall, in the Crystal Seam, and out by the Underlake. Touch them — or give them a good knock — and they wake.',
          'Wake all three and the roots will part at the Hanging Roots. There\'s an old lift there. It goes all the way up to daylight.',
        ], () => accept('q_bloom'));
        if (f.q_bloom === 1 && st.lit) return L(['I felt it — the roots breathing light again. You\'ve done more than you know.', 'Take these. And take the lift: it comes up in a garden in Thimblewick, of all places.'], () => finish('q_bloom', 'The old route glows again.', 9));
        if (f.q_bloom === 1) return L([`${st.blooms.length} of 3 blooms awake. The lake bloom sits on the western shore; the ford crosses the shallows if you keep to the pale stones.`]);
        return this.converse(npc, 'The lamps are lit. Rest, if you need to.', [
          { id: 'burrow', label: 'The Lumen Burrow?', lines: ['Under the Crystal Seam. Something in there drinks light. Ring its crystal chimes in the right order and the way opens.'] },
          { id: 'islet', label: 'That islet in the lake…', lines: ['There\'s a block of old stone on the near shore. If it were to go into the water, the gap would be a step. Just saying.'] },
          { id: 'up', label: 'Where does the lift go?', lines: ['Up through the roots of a very old tree. Into a garden, someone once told me. A garden with a bell tree.'] },
        ]);
      }
    }
    return baseTalk.call(this, npc);
  };
}
