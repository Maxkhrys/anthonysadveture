// The MOSSDEV overlay: nine sections over one delegated click handler (no per-render listener
// leaks), re-rendered only on change. While the full overlay is open the simulation is paused;
// a small live telemetry panel stays on screen during a test.
import { CLASSES, MAX_LEVEL } from '../rpg/classes.js';
import { RARITY, WEAPONS, ARMORS, makeNamed, baseById } from '../rpg/items.js';
import { PROC_DEFS } from '../rpg/arpg/definitions.js';
import { WEAPON_ELEMENT, describeKit } from '../rpg/weapon_attacks.js';
import { FAMILY, weaponFamily } from '../rpg/gear.js';
import { REGISTRY } from '../rpg/registry.js';
import { CREATIVE_ITEMS, creativeIcon } from '../dev/creative.js';
import { copy } from '../persistence/model.js';
import { compactHtml, detailsHtml, compareHtml, rarityOf, esc } from '../item_info.js';
import { RECENT, manifestStatus, PATHS, BUILD_PRESETS, ARENA_NAMES, LAB_ENEMIES, ELEMENT_TARGETS, STATUS_NAMES, eliteCompatible } from './lab.js';
import { FX_PREVIEWS, previewFx } from '../combat_fx.js';
import { ARENAS } from './store.js';

const SECTIONS = [['overview', 'Recently added'], ['character', 'Character'], ['items', 'Items'], ['skills', 'Skills & builds'], ['enemies', 'Enemies & bosses'], ['arenas', 'Arenas'], ['loot', 'Loot'], ['vfx', 'VFX'], ['presets', 'Presets']];
const RECENT_IDS = new Set(RECENT.map(e => e.item?.named).filter(Boolean));
const ELEMENTS = ['fire', 'frost', 'lightning', 'wind', 'glass', 'thorn', 'water'];
// catalogue rows from the creative registry (so new gear appears automatically) plus searchable
// attack names and element
const CATALOGUE = CREATIVE_ITEMS.filter(x => x.category === 'Equipment').map(x => {
  const pv = x.preview, id = x.id.slice(5), weapon = pv.slot === 'weapon';
  let kit = null; try { kit = weapon ? describeKit({ ...pv, base: pv.base, unique: pv.unique }, pv.cls) : null; } catch (e) {}
  const element = WEAPON_ELEMENT[id] || WEAPON_ELEMENT[pv.base] || kit?.element || null;
  const special = x.rarity === 'Prismatic' ? 'prismatic' : x.rarity === 'Legendary' ? 'legendary' : pv.unique ? 'named' : '';
  return { id, entry: x, name: x.name, cls: pv.cls || 'any', slot: weapon ? 'weapon' : pv.slot, family: weapon ? weaponFamily(pv) : '', rarity: x.rarity, element, special, recent: RECENT_IDS.has(id),
    hay: [x.name, id, x.hint, x.rarity, pv.cls, pv.kind, pv.slot, kit?.primary, kit?.secondary, kit?.secondaryDesc, element].filter(Boolean).join(' ').toLowerCase() };
});

export class DevLabUI {
  constructor(lab, host = document.getElementById('ui') || document.body) {
    this.lab = lab; this.g = lab.g; this.tab = 'overview'; this.f = { q: '', cls: 'all', slot: 'all', family: 'all', rarity: 'all', element: 'all', special: 'all', recent: false };
    this.detail = false; this.sel = null; this.forge = { base: 'candlestaff', rarity: 3, effect: '' };
    this.root = document.createElement('div'); this.root.id = 'mossdev'; this.root.className = 'hidden'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', 'MOSSDEV developer lab');
    this.root.innerHTML = `<header class="md-top"><div class="md-brand"><b>MOSSDEV</b><span>Sandbox lab · adventure saves are never written</span></div><div class="md-status"></div>
      <div class="md-actions"><button data-act="start" class="md-go">Start test ▶</button><button data-act="reset">Reset test</button><button data-act="return">Return to adventure</button><button data-act="close" aria-label="Close lab (F10)">✕</button></div></header>
      <nav class="md-tabs" role="tablist">${SECTIONS.map(([id, name]) => `<button role="tab" data-tab="${id}">${name}</button>`).join('')}</nav>
      <main class="md-body" tabindex="-1"></main><footer class="md-notice" role="status" aria-live="polite"></footer>`;
    host.appendChild(this.root);
    this.hud = document.createElement('div'); this.hud.id = 'mossdev-hud'; this.hud.className = 'hidden'; host.appendChild(this.hud);
    // the visible control, shown only with Developer mode on (Settings → Developer mode)
    this.launch = document.createElement('button'); this.launch.id = 'mossdev-launch'; this.launch.type = 'button'; this.launch.className = 'hidden'; this.launch.textContent = 'MOSSDEV · F10'; this.launch.title = 'Open the sandbox test lab (your adventure is saved first and never changed by the lab)';
    this.launch.onclick = () => window.__enterLab && window.__enterLab(); host.appendChild(this.launch);
    this.root.addEventListener('click', e => this.onClick(e));
    this.root.addEventListener('input', e => this.onInput(e));
    this.root.addEventListener('change', e => this.onInput(e));
    this.hud.addEventListener('click', e => { if (e.target.closest('[data-act="open"]')) this.open(); if (e.target.closest('[data-act="hudreset"]')) this.lab.telemetry.reset(); });
    lab.onChange = () => this.renderNotice();
    this.hudT = 0;
  }
  get open_() { return !this.root.classList.contains('hidden'); }
  open(tab) { if (tab) this.tab = tab; this.root.classList.remove('hidden'); this.lab.overlayOpen = true; this.render(); this.root.querySelector('.md-body').focus({ preventScroll: true }); }
  close() { this.root.classList.add('hidden'); this.lab.overlayOpen = false; }
  toggle() { this.open_ ? this.close() : this.open(); }

  // ---------------------------------------------------------------- rendering
  render() {
    const L = this.lab, P = L.profile, C = CLASSES[P.cls];
    this.root.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === this.tab); b.setAttribute('aria-selected', b.dataset.tab === this.tab); });
    this.root.querySelector('.md-status').innerHTML = `<span>${esc(C.name)} · level ${P.level}</span><span>${esc(ARENA_NAMES[P.arena])}</span>${L.store.data.returnTo ? `<span>from ${esc(L.store.data.returnTo.name || 'adventure')}</span>` : '<span>no adventure open</span>'}`;
    this.root.querySelector('[data-act="return"]').textContent = L.store.data.returnTo?.survivalId ? 'Return to Survival' : L.store.data.returnTo ? 'Return to adventure' : 'Leave lab';
    const body = this.root.querySelector('.md-body');
    body.innerHTML = this['s_' + this.tab]();
    this.renderNotice();
  }
  renderNotice() { const n = this.root.querySelector('.md-notice'); if (n) n.textContent = this.lab.notice || 'Everything here is sandbox-only. F10 or ✕ closes the panel without resetting the test.'; }
  s_overview() {
    const last = this.lab.store.data.lastTest;
    return `<section class="md-intro"><h2>Recently added</h2><p>One click prepares the sandbox character, the exact item, a legal build, the arena and suitable targets, then tells you what to try.</p></section>
      <div class="md-cards">${RECENT.map(e => { const st = manifestStatus(e); return `<article class="md-card ${st.ok ? '' : 'off'} ${last === e.id ? 'last' : ''}"><small>${esc(e.pass)} · ${esc(CLASSES[e.cls].name)} · level ${e.level} · ${esc(ARENA_NAMES[e.arena])}</small><h3>${esc(e.title)}</h3><p>${esc(e.desc)}</p>
        ${st.ok ? `<button data-act="manifest" data-id="${e.id}" class="md-go">Test it ▶</button>` : `<p class="md-warn">Not available: ${esc(st.why)}</p>`}<code>${esc(e.id)}</code></article>`; }).join('')}</div>`;
  }
  s_character() {
    const L = this.lab, P = L.profile, c = P.cheats, g = this.g, resName = CLASSES[P.cls].res;
    return `<div class="md-grid2"><section><h3>Class</h3><div class="md-row">${Object.keys(CLASSES).map(k => `<button data-act="class" data-id="${k}" class="${k === P.cls ? 'on' : ''}">${esc(CLASSES[k].name)}</button>`).join('')}</div>
      <p class="md-hint">Switching rebuilds the character through the normal construction path: new rig, resources and starter weapon; armour it can wear stays.</p>
      <h3>Level and experience</h3><div class="md-row"><label>Level <input type="number" min="1" max="${MAX_LEVEL}" value="${P.level}" data-in="level"></label><button data-act="level">Apply</button><label>XP <input type="number" min="0" value="${g.inv.xp || 0}" data-in="xp"></label><button data-act="xp">Set XP</button></div>
      <p>Skill points available: <b>${g.inv.sp}</b> (level ${g.inv.level} gives ${g.inv.level - 1} in total)</p>
      <h3>Vitals</h3><div class="md-row"><label>Health <input type="range" min="1" max="${g.inv.maxHp}" value="${Math.round(g.inv.hp)}" data-in="hp"></label><label>${esc(resName)} <input type="range" min="0" max="100" value="${Math.round(g.res)}" data-in="res"></label></div>
      <div class="md-row"><button data-act="refill">Refill health and ${esc(resName)}</button><button data-act="cooldowns">Reset cooldowns</button></div></section>
      <section><h3>Sandbox cheats <small>(never reach an adventure)</small></h3>
      ${this.cheatRow('god', 'God mode', c.god)}${this.cheatRow('infRes', 'Infinite ' + resName + (P.cls === 'soulbound' ? ' (five Echoes)' : ''), c.infRes)}${P.cls === 'gunslinger' ? this.cheatRow('infAmmo', 'Infinite ammunition (cylinder / magazine refills)', c.infAmmo) : ''}
      <label class="md-toggle">Movement speed <select data-in="speed">${[1, 1.25, 1.5, 2].map(v => `<option value="${v}" ${c.speed === v ? 'selected' : ''}>×${v}</option>`).join('')}</select></label>
      ${this.cheatRow('ignoreRestrictions', 'Rule bypass: equip anything (sandbox only, off by default)', c.ignoreRestrictions, 'md-danger')}
      <h3>Character</h3><div class="md-row"><button data-act="copyadv" ${L.store.data.returnTo ? '' : 'disabled'}>Copy my adventure character in</button><button data-act="resetchar">Reset test character</button></div>
      <p class="md-hint">The lab keeps its own character between visits and refreshes. It started as a copy of your adventure the first time you opened it.</p></section></div>`;
  }
  cheatRow(k, label, on, cls = '') { return `<label class="md-toggle ${cls}"><input type="checkbox" data-cheat="${k}" ${on ? 'checked' : ''}> ${esc(label)}</label>`; }
  filtered() {
    const f = this.f, q = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return CATALOGUE.filter(x => (f.cls === 'all' || x.cls === f.cls) && (f.slot === 'all' || x.slot === f.slot) && (f.family === 'all' || x.family === f.family) && (f.rarity === 'all' || x.rarity === f.rarity) && (f.element === 'all' || x.element === f.element) && (f.special === 'all' || x.special === f.special) && (!f.recent || x.recent) && q.every(w => x.hay.includes(w)));
  }
  s_items() {
    const f = this.f, list = this.filtered(), sel = this.sel, g = this.g;
    const opt = (k, vals, labelAll) => `<select data-f="${k}"><option value="all">${labelAll}</option>${vals.map(([v, l]) => `<option value="${v}" ${f[k] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    let right = '<p class="md-hint">Select an item to see its exact roll before you spawn it.</p>';
    if (sel) {
      const it = sel.item, other = it.cls && it.cls !== this.lab.profile.cls, eq = g.inv.equip[g.equipSlotFor(it)];
      right = `<div class="md-itemview">${this.detail ? detailsHtml(it, g, `<img src="${creativeIcon(sel.row.entry)}" alt="">`) : compactHtml(it, g, `<img src="${creativeIcon(sel.row.entry)}" alt="">`)}
        <div class="md-row"><button data-act="details" aria-pressed="${this.detail}">${this.detail ? 'Compact view' : 'Details'}</button><button data-act="reroll">Roll another copy</button></div>
        ${eq && eq !== it ? compareHtml(it, eq, g) : ''}
        <div class="md-row md-sticky"><button data-act="spawn">Spawn</button>${other ? `<button data-act="switchequip" class="md-go">Switch to ${esc(CLASSES[it.cls].name)} and test</button>` : `<button data-act="equip" class="md-go">Spawn + Equip</button>`}<button data-act="copyid">Copy ID</button><button data-act="topreset">Save to test preset</button></div>
        <p class="md-hint">${it.devForced ? 'Developer-forced item: built by the real factory with a chosen base and rarity.' : 'Normal-rules item: rolled by the real factory for this class and level.'} Equipping or viewing never rerolls it.</p></div>`;
    }
    return `<div class="md-filters"><input type="search" placeholder="Name, effect, attack or element…" value="${esc(f.q)}" data-f="q" aria-label="Search items">
      ${opt('cls', [...Object.keys(CLASSES).map(k => [k, CLASSES[k].name]), ['any', 'Any class']], 'All classes')}${opt('slot', [['weapon', 'Weapon'], ['helm', 'Head'], ['armor', 'Chest'], ['arms', 'Arms'], ['legs', 'Legs'], ['boots', 'Boots'], ['charm', 'Necklace'], ['ring', 'Ring']], 'All slots')}
      ${opt('family', Object.keys(FAMILY).map(k => [k, FAMILY[k].name]), 'All weapon families')}${opt('rarity', [...RARITY.map(r => [r.name, r.name])], 'All rarities')}${opt('element', ELEMENTS.map(e => [e, e]), 'All elements')}
      ${opt('special', [['named', 'Named'], ['legendary', 'Legendary'], ['prismatic', 'Prismatic']], 'Named / Legendary / Prismatic')}<label class="md-toggle"><input type="checkbox" data-f="recent" ${f.recent ? 'checked' : ''}> Recently added</label></div>
      <div class="md-split"><div class="md-list" role="listbox" aria-label="Catalogue">${list.slice(0, 160).map(x => `<button class="md-item ${sel && sel.row.id === x.id ? 'on' : ''}" data-act="pick" data-id="${x.id}" style="--rc:${x.entry.color}"><img src="${creativeIcon(x.entry)}" alt="" loading="lazy" width="40" height="40"><span><small>${esc(x.rarity)} · ${esc(x.slot)}${x.family ? ' · ' + esc(x.family) : ''}</small><b>${esc(x.name)}</b></span></button>`).join('')}
      ${list.length > 160 ? `<p class="md-hint">${list.length - 160} more: narrow the search.</p>` : ''}${!list.length ? '<p>No items match.</p>' : ''}</div><div class="md-view">${right}</div></div>
      <section class="md-forge"><h3>Controlled item (developer-forced)</h3><div class="md-row"><label>Base <select data-forge="base">${[...WEAPONS, ...ARMORS].filter(b => !b.named).map(b => `<option value="${b.id}" ${this.forge.base === b.id ? 'selected' : ''}>${esc(b.name)} (${esc(b.cls || b.slot)})</option>`).join('')}</select></label>
      <label>Rarity <select data-forge="rarity">${RARITY.map((r, i) => `<option value="${i}" ${+this.forge.rarity === i ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label>
      <label>Add effect <select data-forge="effect"><option value="">(none)</option>${Object.entries(PROC_DEFS).map(([id, d]) => `<option value="${id}" ${this.forge.effect === id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label><button data-act="forge">Build and preview</button></div>
      <p class="md-hint">Uses the real factory and validation. Effects can only be added to items that carry gameplay rolls; element comes from the base or unique and cannot be forced in current data.</p></section>`;
  }
  s_skills() {
    const g = this.g, P = this.lab.profile, paths = PATHS[P.cls] || [];
    return `<section><h3>Legal builds</h3><p>Spends every available point through the real skill-tree rules (requirements, path minimums, one Gunslinger capstone). No rule is bypassed.</p>
      <div class="md-cards">${paths.map((p, i) => `<article class="md-card" style="--rc:${p.color}"><h3>${esc(p.name)}</h3><p>${esc(p.blurb)}</p><button data-act="maxpath" data-id="${i}" class="md-go">Max this path</button></article>`).join('')}</div>
      <div class="md-row"><button data-act="resetskills">Reset skills (refund every rank)</button><span>Points left: <b>${g.inv.sp}</b></span></div></section>
      <section><h3>Build presets</h3><div class="md-cards">${BUILD_PRESETS.map(b => `<article class="md-card"><small>${esc(CLASSES[b.cls].name)} · ${esc(PATHS[b.cls][b.path].name)}</small><h3>${esc(b.name)}</h3><p>${esc(makeNamed(b.weapon, 20, null, b.cls)?.name || b.weapon)}</p><button data-act="build" data-id="${b.id}">Load build</button></article>`).join('')}</div></section>`;
  }
  s_enemies() {
    const o = this.lab.profile.arenaOpts, why = eliteCompatible(o.eliteKind, o.eliteMod);
    return `<div class="md-grid2"><section><h3>Crowd</h3><div class="md-row"><label>Size <select data-opt="crowdSize">${[5, 10, 20, 30].map(n => `<option ${+o.crowdSize === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="md-chips">${LAB_ENEMIES.map(k => `<label><input type="checkbox" data-kind="${k}" ${o.crowdKinds.includes(k) ? 'checked' : ''}> ${k}</label>`).join('')}</div>
      <div class="md-row"><button data-act="arena" data-id="crowd" class="md-go">Spawn crowd</button><button data-act="clear">Clear enemies</button><button data-act="refill">Refill</button></div></section>
      <section><h3>Elite</h3><div class="md-row"><label>Enemy <select data-opt="eliteKind">${LAB_ENEMIES.map(k => `<option ${o.eliteKind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Modifier <select data-opt="eliteMod">${REGISTRY.eliteModifiers.map(m => `<option ${o.eliteMod === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
      ${why ? `<p class="md-warn">${esc(why)}</p>` : '<p class="md-hint">One modifier per elite, as in the game. Stacked modifiers are not supported by the enemy data, so they are not offered.</p>'}
      <button data-act="arena" data-id="elite" ${why ? 'disabled' : ''} class="md-go">Spawn elite</button>
      <h3>Boss</h3><div class="md-row"><button data-act="arena" data-id="boss" class="md-go">Bramblemaw (its own room)</button></div>
      <p class="md-hint">Phase select is disabled: Bramblemaw's phases follow its encounter state, and changing health alone would leave it inconsistent. Other bosses are not yet wired to the lab.</p></section></div>`;
  }
  s_arenas() {
    const P = this.lab.profile, o = P.arenaOpts;
    const blurb = { dummy: 'An immortal target with real statuses. Measures damage from resolved hits.', crowd: 'Packs of 5–30 real enemies with their normal AI.', elite: 'One enemy with a chosen, validated elite modifier.', boss: 'Bramblemaw in its own room, via its real trigger.', element: 'Seven targets holding Wet, Burning, Chilled, Frozen, Shocked, Hexed and Marked.', loot: 'The test floor, for rolling loot samples into the lab tray.', vfx: 'The test floor with a target, for previewing effects.' };
    return `<div class="md-cards">${ARENAS.map(a => `<article class="md-card ${P.arena === a ? 'last' : ''}"><h3>${esc(ARENA_NAMES[a])}</h3><p>${blurb[a]}</p><button data-act="arena" data-id="${a}" class="md-go">Load</button></article>`).join('')}</div>
      <section><h3>Dummy options</h3>${this.opt('dummyMove', 'Moving dummy (side to side)', o.dummyMove)}${this.opt('dummyArmour', 'Armoured dummy (the game\'s 50% damage-taken multiplier)', o.dummyArmour)}
      <h3>Element lab</h3><button data-act="restatus">Reapply statuses</button><p class="md-hint">${ELEMENT_TARGETS.map(s => STATUS_NAMES[s]).join(' · ')} — applied through each enemy's own status code.</p></section>`;
  }
  opt(k, label, on) { return `<label class="md-toggle"><input type="checkbox" data-opt="${k}" ${on ? 'checked' : ''}> ${esc(label)}</label>`; }
  s_loot() {
    const T = this.lab.profile.tray, counts = {}; for (const it of T) { const n = rarityOf(it).name; counts[n] = (counts[n] || 0) + 1; }
    const fr = this.trayRarity || 'all', shown = T.filter(it => fr === 'all' || rarityOf(it).name === fr);
    return `<section><h3>Samples (real class-correct loot)</h3><div class="md-row">${RARITY.map(r => `<button data-act="loot" data-id="${r.id}">10 × ${r.name}</button>`).join('')}<button data-act="loot" data-id="class100" class="md-go">100-drop class sample</button></div>
      <p class="md-hint">Samples go to the lab tray, not the world or your 30-slot bag. Same seed, same sample.</p>${this.lastLoot ? `<p>Last sample: <b>${this.lastLoot.n}</b> items · ${Object.entries(this.lastLoot.counts).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')} · other-class items: <b>${this.lastLoot.wrongClass}</b></p>` : ''}</section>
      <section><h3>Lab tray (${T.length})</h3><div class="md-row"><select data-in="trayrarity"><option value="all">All (${T.length})</option>${Object.entries(counts).map(([k, v]) => `<option value="${esc(k)}" ${fr === k ? 'selected' : ''}>${esc(k)} (${v})</option>`).join('')}</select><button data-act="traytobag">Move shown to bag (fills free slots)</button><button data-act="trayclear">Empty tray</button></div>
      <div class="md-tray">${shown.slice(0, 60).map((it, i) => `<button class="md-titem" style="--rc:${rarityOf(it).color}" data-act="trayequip" data-id="${T.indexOf(it)}" title="Equip ${esc(it.name)}"><small>${esc(rarityOf(it).name)}</small>${esc(it.name)}</button>`).join('')}</div></section>`;
  }
  s_vfx() {
    return `<section><h3>Effect previews</h3><p>These call the same presentation functions combat uses, on the nearest target (or in front of you). They never deal damage or grant anything.</p>
      <div class="md-row md-wrap">${FX_PREVIEWS.map(([id, name]) => `<button data-act="fx" data-id="${id}">${esc(name)}</button>`).join('')}</div>
      <p class="md-hint">Settings → Combat effects and Blood apply here exactly as in the adventure.</p></section>`;
  }
  s_presets() {
    const S = this.lab.store.data.presets;
    return `<section><h3>Save this setup</h3><div class="md-row"><input type="text" maxlength="60" placeholder="Preset name" data-in="presetname" value="${esc(this.presetName || '')}"><button data-act="savepreset" class="md-go">Save preset</button></div>
      <p class="md-hint">Stores class, level, exact item rolls, skill ranks, arena and cheats. Loading one rebuilds that exact test.</p></section>
      <section><h3>Saved tests (${S.length})</h3>${S.map(p => `<div class="md-preset"><b>${esc(p.name)}</b><small>${esc(CLASSES[p.profile.cls].name)} · level ${p.profile.level} · ${esc(p.profile.equip.weapon?.name || 'starter weapon')} · ${esc(ARENA_NAMES[p.profile.arena])}</small><button data-act="loadpreset" data-id="${p.id}" class="md-go">Load</button><button data-act="exportpreset" data-id="${p.id}">Export</button><button data-act="delpreset" data-id="${p.id}">Delete</button></div>`).join('') || '<p>No saved tests yet.</p>'}</section>
      <section><h3>Import</h3><textarea data-in="importtext" rows="4" placeholder="Paste an exported MOSSDEV preset">${esc(this.importText || '')}</textarea><button data-act="importpreset">Import</button>${this.exportText ? `<h3>Export</h3><textarea readonly rows="4">${esc(this.exportText)}</textarea>` : ''}</section>`;
  }

  // ---------------------------------------------------------------- events
  onInput(e) {
    const t = e.target, L = this.lab, P = L.profile;
    if (t.dataset.f) { this.f[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; if (e.type === 'change' || t.type === 'search') this.refreshList(); return; }
    if (t.dataset.cheat && e.type === 'change') { L.setCheat(t.dataset.cheat, t.checked); return this.render(); }
    if (t.dataset.opt && e.type === 'change') { P.arenaOpts[t.dataset.opt] = t.type === 'checkbox' ? t.checked : isNaN(+t.value) ? t.value : +t.value; L.store.write(); return this.render(); }
    if (t.dataset.kind && e.type === 'change') { const k = t.dataset.kind, s = new Set(P.arenaOpts.crowdKinds); t.checked ? s.add(k) : s.delete(k); P.arenaOpts.crowdKinds = [...s]; L.store.write(); return; }
    if (t.dataset.forge) { this.forge[t.dataset.forge] = t.value; return; }
    const k = t.dataset.in; if (!k) return;
    if (k === 'hp' && e.type === 'change') { this.g.inv.hp = +t.value; this.g.hudDirty = true; }
    if (k === 'res' && e.type === 'change') { this.g.res = +t.value; this.g.hudDirty = true; }
    if (k === 'speed' && e.type === 'change') { L.setCheat('speed', +t.value); }
    if (k === 'presetname') this.presetName = t.value;
    if (k === 'importtext') this.importText = t.value;
    if (k === 'trayrarity' && e.type === 'change') { this.trayRarity = t.value; this.render(); }
  }
  refreshList() { const body = this.root.querySelector('.md-body'), scroll = body.scrollTop, focus = document.activeElement?.dataset?.f; this.render(); body.scrollTop = scroll; if (focus) { const el = this.root.querySelector(`[data-f="${focus}"]`); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } } }
  onClick(e) {
    const tab = e.target.closest('[data-tab]'); if (tab) { this.tab = tab.dataset.tab; return this.render(); }
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const L = this.lab, P = L.profile, g = this.g, id = b.dataset.id, val = n => this.root.querySelector(`[data-in="${n}"]`)?.value;
    switch (b.dataset.act) {
      case 'close': case 'start': this.close(); break;
      case 'reset': L.resetTest(); break;
      case 'return': this.close(); L.exit(); return;
      case 'manifest': L.runManifest(id); this.close(); return;
      case 'class': L.setClass(id); break;
      case 'level': L.setLevel(+val('level')); break;
      case 'xp': g.inv.xp = Math.max(0, +val('xp') || 0); g.hudDirty = true; break;
      case 'refill': L.refill(); break;
      case 'cooldowns': L.resetCooldowns(); break;
      case 'copyadv': this.copyAdventure(); break;
      case 'resetchar': L.store.data.profile = { ...L.store.data.profile, ...{ level: 12, equip: {}, tree: null, loadout: null, bag: [] } }; L.store.write(); L.rebuild(); break;
      case 'pick': { const row = CATALOGUE.find(x => x.id === id); this.sel = { row, item: this.build(row) }; break; }
      case 'reroll': if (this.sel) this.sel.item = this.sel.forged ? this.forgeItem() : this.build(this.sel.row); break;
      case 'details': this.detail = !this.detail; break;
      case 'spawn': if (this.sel) this.result(L.spawnItem(this.sel.item, false), this.sel.item); break;
      case 'equip': if (this.sel) this.result(L.spawnItem(this.sel.item, true), this.sel.item); break;
      case 'switchequip': if (this.sel) this.result(L.switchClassAndEquip(this.sel.item), this.sel.item); break;
      case 'copyid': if (this.sel) { navigator.clipboard?.writeText(this.sel.row?.id || this.sel.item.base).catch(() => {}); L.notice = 'Copied ID: ' + (this.sel.row?.id || this.sel.item.base); } break;
      case 'topreset': if (this.sel) { const prof = copy(P); prof.equip = { ...prof.equip, [g.equipSlotFor(this.sel.item) === 'weapon' ? 'weapon' : g.equipSlotFor(this.sel.item)]: copy(this.sel.item) }; const r = L.store.savePreset(this.sel.item.name + ' test', prof); L.notice = r.ok ? 'Saved a preset with this exact item.' : r.errors.join(' '); } break;
      case 'forge': { const it = this.forgeItem(); if (it) this.sel = { row: { id: it.base, entry: { color: rarityOf(it).color, preview: it, id: 'gear:' + it.base } }, item: it, forged: true }; this.tab = 'items'; break; }
      case 'maxpath': { const n = L.maxPath(+id); L.notice = `Spent ${n} points legally, ${PATHS[P.cls][+id].name} first.`; break; }
      case 'resetskills': L.resetSkills(); L.notice = 'Every rank refunded.'; break;
      case 'build': { const bp = BUILD_PRESETS.find(x => x.id === id); L.applyBuildPreset(bp); L.notice = 'Loaded ' + bp.name + '.'; break; }
      case 'arena': L.loadArena(id); if (id !== 'loot' && id !== 'vfx') { this.close(); return; } break;
      case 'clear': L.clearEnemies(); break;
      case 'restatus': L.refreshStatuses(); break;
      case 'loot': this.lastLoot = L.lootSample(id); break;
      case 'traytobag': { const T = P.tray, fr = this.trayRarity || 'all'; let moved = 0; for (let i = T.length - 1; i >= 0; i--) { if (g.inv.bag.length >= g.bagCapacity()) break; if (fr !== 'all' && rarityOf(T[i]).name !== fr) continue; g.inv.bag.push(T.splice(i, 1)[0]); moved++; } L.captureProfile(); L.notice = `Moved ${moved} item(s) to the bag.`; break; }
      case 'trayclear': P.tray = []; L.store.write(); break;
      case 'trayequip': { const it = P.tray[+id]; if (it) { P.tray.splice(+id, 1); this.result(L.spawnItem(it, true), it); } break; }
      case 'fx': previewFx(g, id); this.close(); return;
      case 'savepreset': { const r = L.store.savePreset(this.presetName || 'Saved test'); L.notice = r.ok ? 'Preset saved.' : r.errors.join(' '); break; }
      case 'loadpreset': L.loadPreset(id); L.notice = 'Preset loaded.'; break;
      case 'delpreset': L.store.deletePreset(id); break;
      case 'exportpreset': this.exportText = L.store.exportPreset(id); break;
      case 'importpreset': { const r = L.store.importPreset(this.importText || ''); L.notice = r.ok ? 'Preset imported.' : 'Import refused: ' + r.errors.join(' '); break; }
    }
    this.render();
  }
  build(row) { const P = this.lab.profile; return makeNamed(row.id, P.level, null, row.cls !== 'any' && row.cls !== P.cls ? row.cls : P.cls); }
  forgeItem() {
    const f = this.forge, it = this.lab.buildItem({ id: f.base, rarity: +f.rarity, forced: true });
    if (!it) { this.lab.notice = 'That base cannot be built.'; return null; }
    if (f.effect && it.itemizationVersion && Array.isArray(it.effects)) {
      if (!it.effects.some(e => e.id === f.effect) && it.effects.length < 3) { it.effects.push({ id: f.effect, chance: PROC_DEFS[f.effect].chance }); it.devForced.effect = f.effect; }
    } else if (f.effect) this.lab.notice = 'This item has no gameplay rolls, so effects cannot be added to it.';
    return it;
  }
  result(r, it) {
    const L = this.lab;
    L.notice = { bag: 'Added ' + it.name + ' to the bag.', tray: 'Bag full: ' + it.name + ' went to the lab tray.', equipped: 'Equipped ' + it.name + ' (exact roll).', restricted: 'Your class cannot equip this. Use Switch class and test, or the sandbox rule bypass.', otherclass: 'This belongs to another class. Use Switch class and test.' }[r] || String(r);
  }
  async copyAdventure() { const ok = await this.lab.copyAdventureFromSave(); this.lab.notice = ok ? 'Copied your adventure character (read from its save; the save is unchanged).' : 'No adventure save to copy.'; this.render(); }

  // ---------------------------------------------------------------- live telemetry panel
  tick(dt) {
    const L = this.lab;
    this.launch.classList.toggle('hidden', !(this.g.settings.devMode && !L.active && this.g.profile && !document.getElementById('hud')?.classList.contains('hidden')));
    this.hud.classList.toggle('hidden', !L.active || this.open_);
    if (!L.active || this.open_) return;
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 0.25;
    const s = L.telemetry.summary(), P = L.profile;
    this.hud.innerHTML = `<header><b>MOSSDEV</b> ${esc(ARENA_NAMES[P.arena])}<button data-act="open" title="Open lab (F10)">☰</button></header>
      ${s.hits ? `<dl><dt>Total</dt><dd>${s.total}</dd><dt>DPS · last 5 s</dt><dd>${s.rolling}</dd><dt>DPS · test average</dt><dd>${s.average}</dd><dt>Per hit</dt><dd>${s.perHit}</dd><dt>Crit rate (direct)</dt><dd>${Math.round(s.critRate * 100)}%</dd><dt>Releases / s</dt><dd>${s.releaseRate.toFixed(2)}</dd><dt>Status uptime</dt><dd>${Math.round(s.uptime * 100)}%</dd><dt>Procs</dt><dd>${s.procs}</dd></dl>
      <p class="md-split4">Direct ${s.by.direct} · DoT ${s.by.dot} · Summon ${s.by.summon} · Proc ${s.by.proc}</p><p class="md-small">${s.elapsed.toFixed(1)} s since first hit <button data-act="hudreset">Reset numbers</button></p>` : '<p class="md-small">Hit a target to start measuring.</p>'}`;
  }
}
