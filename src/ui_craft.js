// Posy's workbench: pick a recipe, see exactly what it needs and does, pick a weapon, craft.
import { sfx } from './engine/audio.js';
import { CLASSES } from './rpg/classes.js';
import { RARITY, itemIcon } from './rpg/items.js';
import { itemIconURL } from './preview.js';
import { RECIPES, MATS, check, craft, allWeapons, knows, removeSigil, ensureCraftState, TRANSFER, recipeById } from './rpg/crafting.js';

const $ = id => document.getElementById(id);
const matLine = (inv, k, n) => { const have = inv.mats[k] || 0, M = MATS[k]; return `<span class="mat ${have >= n ? 'ok' : 'no'}" title="${M.desc}"><b style="color:${M.color}">${M.icon}</b> ${M.name} ${have}/${n}</span>`; };

export function installCraftUI(UI) {
  const P = UI.prototype;
  P.openCraft = function () {
    ensureCraftState(this.g.inv);
    this.craftOpen = true; this.crI = this.crI || 0; this.crW = 0; this.crConfirm = false;
    this.show('craft', true); this.renderCraft();
  };
  P.closeCraft = function () { this.craftOpen = false; this.show('craft', false); };
  P.craftRecipes = function () {
    // your class first, then universal, then the rest (greyed)
    const cls = this.g.inv.cls;
    return [...RECIPES].sort((a, b) => ((a.cls === cls ? 0 : a.cls ? 2 : 1) - (b.cls === cls ? 0 : b.cls ? 2 : 1)));
  };
  P.craftBases = function (r) {
    if (r.kind !== 'weapon') return [null];
    const inv = this.g.inv;
    return allWeapons(inv).filter(w => r.bases.includes(w.it.kind) && (!r.cls || !w.it.cls || w.it.cls === r.cls));
  };
  P.renderCraft = function () {
    const g = this.g, inv = g.inv, list = this.craftRecipes();
    this.crI = Math.min(this.crI, list.length - 1);
    const r = list[this.crI];
    $('craft-list').innerHTML = list.map((x, i) => {
      const known = knows(inv, x.id), mine = !x.cls || x.cls === inv.cls;
      const tag = x.kind === 'sigil' ? 'Sigil' : 'Engraving';
      const who = x.cls ? CLASSES[x.cls].name : 'Any class';
      const owned = x.kind === 'weapon' ? allWeapons(inv).some(w => w.it.craft === x.id) : (inv.sigilsOwned || []).includes(x.id);
      return `<div class="cr-row ${i === this.crI ? 'on' : ''} ${!known || !mine ? 'dim' : ''}" data-i="${i}"><b>${known ? x.name : '??? ' + tag}</b>${owned ? ' <span class="own">✦ made</span>' : ''}<small>${tag} · ${who}</small></div>`;
    }).join('');
    const known = knows(inv, r.id);
    const bases = this.craftBases(r);
    this.crW = Math.max(0, Math.min(this.crW, bases.length - 1));
    const base = bases[this.crW];
    const c = check(g, r, base ? base.it : null);
    const cost = c.cost || { mats: r.mats, pips: r.pips };
    // the recipe as a sum: base + essence + material = result
    const ess = Object.keys(r.mats).find(k => k !== 'shard');
    const tile = (inner, label, cls = '') => `<div class="fx-tile ${cls}"><div class="fx-ico">${inner}</div><small>${label}</small></div>`;
    const baseIt = base ? base.it : null;
    const AB = { 0: '1', 1: '2', 2: '3' };
    const baseTile = r.kind === 'weapon' ? tile(baseIt ? `<img src="${itemIconURL(baseIt, inv.cls)}">` : '?', baseIt ? baseIt.name : 'a ' + r.bases.join('/'), baseIt ? 'rar' + baseIt.r : 'empty')
      : tile(`<b class="abk">${AB[r.ability]}</b>`, r.cls ? CLASSES[r.cls].abilities[r.ability].name : 'ability');
    const essTile = ess ? tile(`<b style="color:${MATS[ess].color}">${MATS[ess].icon}</b>`, `${MATS[ess].name} ×${(c.cost || { mats: r.mats }).mats[ess] ?? 0}`, (inv.mats[ess] || 0) >= ((c.cost || { mats: r.mats }).mats[ess] ?? 0) ? 'have' : 'lack') : '';
    const shTile = tile(`<b style="color:${MATS.shard.color}">${MATS.shard.icon}</b>`, `Shards ×${(c.cost || { mats: r.mats }).mats.shard || 0}`, (inv.mats.shard || 0) >= ((c.cost || { mats: r.mats }).mats.shard || 0) ? 'have' : 'lack');
    const resTile = tile(r.kind === 'weapon' && baseIt ? `<img src="${itemIconURL({ ...baseIt, craft: r.id }, inv.cls)}"><i class="sparkle">✦</i>` : `<b class="abk res">✦</b>`, known ? r.name : '???', 'result' + (this.crForged ? ' forged' : ''));
    let h = `<div class="formula">${baseTile}<span class="op">+</span>${essTile ? essTile + '<span class="op">+</span>' : ''}${shTile}<span class="op">=</span>${resTile}</div>`;
    h += `<h4>${known ? r.name : 'Undiscovered recipe'}</h4>`;
    h += `<div class="sub">${r.kind === 'sigil' ? 'Ability sigil — ' + CLASSES[r.cls].abilities[r.ability].name : 'Weapon engraving — ' + r.bases.join(' / ')} · ${r.cls ? '<span style="color:' + (r.cls === inv.cls ? '#9f9' : '#f88') + '">' + CLASSES[r.cls].name + ' only</span>' : 'any class'}</div>`;
    if (known) h += `<div class="cr-effect">${r.effect}</div>`;
    else h += `<div class="cr-effect dim">Hint: ${r.hint}</div>`;
    if (r.kind === 'weapon') {
      h += `<div class="sub">Weapon (A/D to choose):</div>`;
      h += bases.length ? `<div class="cr-bases">${bases.map((b, i) => `<span class="cr-base ${i === this.crW ? 'on' : ''}" data-w="${i}" style="border-color:${RARITY[b.it.r].color}">${itemIcon(b.it)} ${b.it.name}${b.where === 'equipped' ? ' <small>(equipped)</small>' : ''}${b.it.craft ? ` <small>· has ${recipeById(b.it.craft).name}</small>` : ''}</span>`).join('')}</div>` : `<div class="cr-effect dim">You carry no weapon this can go on.</div>`;
    } else {
      const cur = inv.sigils[r.ability];
      if (cur) h += `<div class="sub">Installed on this ability: <b>${recipeById(cur).name}</b>${cur === r.id ? ' — press X to remove it' : ''}</div>`;
    }
    h += `<div class="sub" style="margin-top:8px">${c.transfer ? `Moves your ${r.name} engraving off <b>${c.transfer.name}</b> (no essence needed):` : 'Needs:'}</div><div class="cr-cost">${Object.keys(cost.mats).map(k => matLine(inv, k, cost.mats[k])).join('')}<span class="mat ${inv.coins >= cost.pips ? 'ok' : 'no'}">◆ ${cost.pips} pips (${inv.coins})</span></div>`;
    if (base && base.it.craft && base.it.craft !== r.id && c.ok) h += `<div class="cr-warn">This replaces the ${recipeById(base.it.craft).name} engraving on that weapon.</div>`;
    h += c.ok ? `<button id="cr-go" class="${this.crConfirm ? 'confirm' : ''}">${this.crConfirm ? 'Press E again to confirm' : 'Craft (E)'}</button>` : `<div class="cr-warn">${c.reason}</div>`;
    $('craft-detail').innerHTML = h;
    $('craft-mats').innerHTML = 'Pouch: ' + Object.keys(MATS).map(k => `<span title="${MATS[k].desc}"><b style="color:${MATS[k].color}">${MATS[k].icon}</b> ${MATS[k].name} ${inv.mats[k] || 0}</span>`).join(' · ') + ` · ◆ ${inv.coins}`;
    $('craft-list').querySelectorAll('.cr-row').forEach(el => el.onclick = () => { this.crI = +el.dataset.i; this.crW = 0; this.crConfirm = false; sfx('select'); this.renderCraft(); });
    $('craft-detail').querySelectorAll('.cr-base').forEach(el => el.onclick = () => { this.crW = +el.dataset.w; this.crConfirm = false; sfx('select'); this.renderCraft(); });
    const go = $('cr-go'); if (go) go.onclick = () => this.craftSelected();
  };
  P.craftSelected = function () {
    const g = this.g, list = this.craftRecipes(), r = list[this.crI];
    const base = this.craftBases(r)[this.crW];
    const c = check(g, r, base ? base.it : null);
    if (!c.ok) { sfx('error'); this.renderCraft(); return; }
    // anything that overwrites an engraving asks twice
    if ((c.transfer || (base && base.it.craft)) && !this.crConfirm) { this.crConfirm = true; sfx('select'); this.renderCraft(); return; }
    this.crConfirm = false;
    const res = craft(g, r.id, base ? base.it : null);
    if (!res.ok) { sfx('error'); this.toast(res.reason, '', 1.6); this.renderCraft(); return; }
    sfx('fanfare'); g.pr.addFlash(0.25, 0xffd25e);
    this.crForged = true; setTimeout(() => { this.crForged = false; if (this.craftOpen) this.renderCraft(); }, 1100);
    const p = g.player; g.fx.burst(p.x, 0.8, p.z, 26, [0xffd25e, 0xffffff, 0x9ad8ff], 3, { g: -1 });
    this.toast(r.kind === 'sigil' ? `${r.name} sigil set into ${CLASSES[r.cls].abilities[r.ability].name}` : `${base.it.name} now carries ${r.name}`, r.effect, 3.4);
    this.updateHud();
    this.renderCraft();
  };
  P.updateCraft = function (input) {
    if (!this.craftOpen) return false;
    const list = this.craftRecipes(), n = list.length;
    if (input.pressed('up')) { this.crI = (this.crI + n - 1) % n; this.crW = 0; this.crConfirm = false; sfx('select'); this.renderCraft(); }
    if (input.pressed('down')) { this.crI = (this.crI + 1) % n; this.crW = 0; this.crConfirm = false; sfx('select'); this.renderCraft(); }
    if (input.pressed('left')) { this.crW--; this.crConfirm = false; sfx('select'); this.renderCraft(); }
    if (input.pressed('right')) { this.crW++; this.crConfirm = false; sfx('select'); this.renderCraft(); }
    if (input.pressed('interact')) this.craftSelected();
    if (input.pressed('salvage')) { const r = list[this.crI]; if (r.kind === 'sigil' && this.g.inv.sigils[r.ability] === r.id) { removeSigil(this.g, r.ability); sfx('select'); this.toast(r.name + ' removed', 'Install it again here for free.', 1.6); this.renderCraft(); } }
    if (input.pressed('pause') || input.pressed('shield') || input.pressed('inventory')) { this.closeCraft(); input.consume('pause'); }
    return true;
  };
}
