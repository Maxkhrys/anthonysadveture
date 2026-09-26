// Survival HUD and panels: a resource strip, the build-mode bar, the crafting / building panel
// (G, or the workbench) and chest storage. One delegated click handler per panel; the game is
// paused while a panel is open.
import { RECIPES } from './craft.js';
import { PIECES } from './entities.js';
import { RESOURCES } from './store.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = { wood: '🪵', stone: '🪨', fibre: '🌿', ore: '⛏', crystal: '💎' };
const NAME = { wood: 'Wood', stone: 'Stone', fibre: 'Fibre', ore: 'Ore', crystal: 'Crystal' };
const cost = (c, have) => Object.entries(c).map(([k, v]) => `<span class="${(have[k] || 0) >= v ? 'ok' : 'no'}">${ICON[k]} ${v} ${NAME[k]}</span>`).join(' ');

export class SurvivalUI {
  constructor(mode, host = document.getElementById('ui') || document.body) {
    this.m = mode; this.g = mode.g; mode.ui = this; this.tab = 'craft';
    const el = (id, cls = '') => { const d = document.createElement('div'); d.id = id; d.className = 'hidden ' + cls; host.appendChild(d); return d; };
    this.hud = el('sv-hud'); this.bar = el('sv-build'); this.panel = el('sv-panel', 'sv-sheet'); this.chest = el('sv-chest', 'sv-sheet');
    this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-label', 'Crafting and building');
    this.chest.setAttribute('role', 'dialog'); this.chest.setAttribute('aria-label', 'Storage chest');
    this.panel.addEventListener('click', e => this.onPanel(e)); this.chest.addEventListener('click', e => this.onChest(e));
    this.hud.addEventListener('click', e => { if (e.target.closest('[data-act="craft"]')) this.toggleCraft(); });
  }
  get open() { return !this.panel.classList.contains('hidden') || !this.chest.classList.contains('hidden'); }
  show() { this.hud.classList.remove('hidden'); this.refresh(); }
  hide() { for (const e of [this.hud, this.bar, this.panel, this.chest]) e.classList.add('hidden'); }
  refresh() {
    const R = this.m.record; if (!R) return;
    this.hud.innerHTML = `<div class="sv-res">${RESOURCES.map(r => `<span title="${NAME[r]}">${ICON[r]} <b>${R.resources[r]}</b></span>`).join('')}</div><button type="button" data-act="craft" title="Crafting and building (G)">Craft & build <kbd>G</kbd></button>`;
    if (!this.panel.classList.contains('hidden')) this.renderPanel();
    if (!this.m.build) this.bar.classList.add('hidden');
  }
  buildStatus(b) {
    this.bar.classList.remove('hidden');
    const name = b.type === 'demolish' ? 'Take down' : PIECES[b.type].name, left = b.type === 'demolish' ? '' : ` · ${(this.m.record.kits || {})[b.type] || 0} left`;
    const html = `<b>${esc(name)}</b>${left} — ${b.ok ? '<span class="ok">click or C to ' + (b.type === 'demolish' ? 'take it down (you keep the piece)' : 'place') + '</span>' : '<span class="no">' + esc(b.why) + '</span>'} · right click or X to stop`;
    if (this.bar.innerHTML !== html) this.bar.innerHTML = html;
  }
  // ---------------------------------------------------------------- crafting / building
  toggleCraft() { this.panel.classList.contains('hidden') ? this.openCraft() : this.closeAll(); }
  openCraft(station) { this.closeAll(); this.tab = 'craft'; this.panel.classList.remove('hidden'); this.renderPanel(); this.g.input.keys.clear(); }
  closeAll() { this.panel.classList.add('hidden'); this.chest.classList.add('hidden'); this.chestFor = null; }
  renderPanel() {
    const m = this.m, R = m.record, kits = R.kits || {};
    const bench = m.nearStation('workbench');
    const recipes = RECIPES.map(r => { const c = m.canCraft(r.id); return `<div class="sv-row ${c.ok ? '' : 'dim'}"><div><b>${esc(r.name)}</b>${r.station ? ` <small class="sv-tag">${bench ? 'workbench' : 'needs workbench'}</small>` : ''}<p>${esc(r.desc)}</p><p class="sv-cost">${cost(r.cost, R.resources)}</p></div><button type="button" data-act="craftit" data-id="${r.id}" ${c.ok ? '' : 'disabled'} title="${esc(c.why)}">Craft</button></div>`; }).join('');
    const pieces = Object.keys(PIECES).map(k => `<div class="sv-row ${kits[k] > 0 ? '' : 'dim'}"><div><b>${esc(PIECES[k].name)}</b> <small>×${kits[k] || 0}</small><p>${esc(PIECES[k].desc)}</p></div><button type="button" data-act="place" data-id="${k}" ${kits[k] > 0 ? '' : 'disabled'}>Place</button></div>`).join('');
    this.panel.innerHTML = `<header><h2>Camp craft</h2><div class="sv-tabs"><button type="button" data-tab="craft" class="${this.tab === 'craft' ? 'on' : ''}">Craft</button><button type="button" data-tab="build" class="${this.tab === 'build' ? 'on' : ''}">Build</button></div><button type="button" data-act="close" aria-label="Close">✕</button></header>
      <div class="sv-have">${RESOURCES.map(r => `<span>${ICON[r]} ${NAME[r]} <b>${R.resources[r]}</b></span>`).join('')}</div>
      <div class="sv-list">${this.tab === 'craft' ? recipes : pieces + `<div class="sv-row"><div><b>Take down a piece</b><p>Point at something you built. You get the piece back (chests empty into your resources).</p></div><button type="button" data-act="place" data-id="demolish">Take down</button></div>`}</div>
      <footer><button type="button" data-act="home">Go home</button><button type="button" data-act="unstuck">Unstuck</button><button type="button" data-act="quit">Save & quit to menu</button><span>${bench ? 'At your workbench: every recipe unlocked.' : 'Stand by a workbench for walls, doors, roofs and storage.'}</span></footer>`;
  }
  onPanel(e) {
    const t = e.target.closest('[data-tab]'); if (t) { this.tab = t.dataset.tab; return this.renderPanel(); }
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const m = this.m;
    switch (b.dataset.act) {
      case 'close': this.closeAll(); break;
      case 'craftit': m.craft(b.dataset.id); this.renderPanel(); break;
      case 'place': if (m.startBuild(b.dataset.id)) this.closeAll(); break;
      case 'home': this.closeAll(); m.goHome(); break;
      case 'unstuck': this.closeAll(); m.unstick(); break;
      case 'quit': this.closeAll(); m.quit(); break;
    }
  }
  // ---------------------------------------------------------------- storage
  openChest(s) { this.closeAll(); this.chestFor = s; this.chest.classList.remove('hidden'); this.renderChest(); this.g.input.keys.clear(); }
  renderChest() {
    const R = this.m.record, S = R.storage[this.chestFor.id] || {};
    this.chest.innerHTML = `<header><h2>Storage chest</h2><button type="button" data-act="close" aria-label="Close">✕</button></header>
      <table><thead><tr><th></th><th>Carried</th><th></th><th>In chest</th></tr></thead><tbody>${RESOURCES.map(r => `<tr><th>${ICON[r]} ${NAME[r]}</th><td>${R.resources[r]}</td><td class="sv-moves"><button type="button" data-act="in" data-r="${r}" data-n="10">Store 10</button><button type="button" data-act="in" data-r="${r}" data-n="9999">Store all</button><button type="button" data-act="out" data-r="${r}" data-n="10">Take 10</button><button type="button" data-act="out" data-r="${r}" data-n="9999">Take all</button></td><td>${S[r] || 0}</td></tr>`).join('')}</tbody></table>`;
  }
  onChest(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'close') return this.closeAll();
    const n = +b.dataset.n, r = b.dataset.r;
    if (b.dataset.act === 'in') this.m.deposit(this.chestFor, r, n); else this.m.withdraw(this.chestFor, r, n);
    this.renderChest(); this.refresh();
  }
}
