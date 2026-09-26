// One item description and comparison system for the inventory, loot inspection and MOSSDEV.
// Everything is derived from the item's own data and the real combat/stat definitions; the
// item object is only read, never changed or rerolled.
//
// Words: an item's RARITY (Common .. Prismatic) is the item's own tier. Each rolled stat also
// has a ROLL QUALITY (from affixes.js); it is always labelled "roll quality", never a bare
// rarity word, so the two are not confused.
import { RARITY, AFFIXES, SETS, itemPower } from './rpg/items.js';
import { CLASSES } from './rpg/classes.js';
import { FAMILY, weaponFamily, OFFCLASS_SCALING } from './rpg/gear.js';
import { describeKit } from './rpg/weapon_attacks.js';
import { gameplayLines } from './rpg/arpg/items.js';
import { recipeById } from './rpg/crafting.js';
import { reinforcementMultiplier } from './persistence/model.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE = { revolver: 'Revolver', rifle: 'Automatic rifle', bow: 'Bow', staff: 'Staff', wand: 'Wand', oversized: 'Oversized', chain: 'SoulChain' };
const SLOT = { helm: 'Head', armor: 'Chest', charm: 'Necklace', arms: 'Arms', legs: 'Legs', boots: 'Boots', ring: 'Ring' };
export const RARITY_MARK = ['●', '◆', '◆◆', '✦', '★', '✧']; // shape as well as colour

export function rarityOf(it) {
  if (!it) return null;
  const i = Math.max(0, Math.min(5, it.r | 0));
  if (it.r === 5 || it.prismatic) return { index: 5, id: 'prismatic', name: it.r === 5 ? 'Prismatic' : 'Prismatic signature', color: '#b9e8ff', mark: RARITY_MARK[5] };
  return { index: i, id: RARITY[i].id, name: it.set ? RARITY[i].name + ' · Set' : RARITY[i].name, color: RARITY[i].color, mark: RARITY_MARK[i] };
}
export function typeName(it) { return it.slot === 'weapon' ? (it.kind === 'katana' ? (it.big ? 'Greatblade' : 'Katana') : TYPE[it.kind] || 'Weapon') : SLOT[it.slot] || it.slot; }

function statText(k, v) {
  const A = AFFIXES[k];
  if (k === 'armor') return v + ' Armour';
  if (k === 'hp') return '+' + v + ' Max Health';
  return A ? `+${v}${A.pct ? '%' : ''} ${A.name}` : `+${v} ${k}`;
}
// The build-defining effect: a named/legendary unique power, a qualitative roll, or an ARPG unique.
function uniqueLines(it) {
  const out = [];
  if (it.utext) out.push(it.utext);
  for (const a of it.rolledAffixes || []) if (a.qualitative) out.push(a.qualitative.name + ': ' + a.qualitative.description);
  if (it.craft) { const r = recipeById(it.craft); if (r) out.push(r.name + ': ' + r.effect); }
  return out;
}

// Structured description: the one source every view renders from.
export function itemInfo(it, g) {
  if (!it) return null;
  const cls = g?.inv?.cls, R = rarityOf(it), up = it.upgradeLevel || 0;
  const info = { name: it.name, upgrade: up, rarity: R, type: typeName(it), ilvl: it.ilvl, cls: it.cls || null,
    clsName: it.cls ? CLASSES[it.cls]?.name : it.slot === 'weapon' ? 'Any class' : null, own: !it.cls || it.cls === cls,
    unique: uniqueLines(it), properties: [], details: [], set: null, salvage: Math.max(1, Math.round((it.value || 0) * 0.35)), power: itemPower(it), forced: !!it.devForced };
  if (it.slot === 'weapon') {
    const m = reinforcementMultiplier ? reinforcementMultiplier(it) : 1 + up * 0.05, fam = weaponFamily(it), kd = describeKit(it, it.cls || cls);
    info.weapon = { min: Math.round(it.min * m), max: Math.round(it.max * m), speed: it.spd || 1, family: FAMILY[fam]?.name || fam,
      primary: kd.primary, secondary: kd.secondary || null, secondaryDesc: kd.secondaryDesc || '', element: kd.element || null,
      scaling: info.own ? (it.cls ? 'Your class: full scaling and specialist perks.' : 'Universal: full scaling for every class.') : `Off-class: ${Math.round(OFFCLASS_SCALING * 100)}% scaling, no ${CLASSES[cls]?.name || ''} specialist perk.` };
  }
  // properties: gameplay effects first (procs, skill mods, modifiers), then stat rolls
  for (const line of gameplayLines(it)) info.properties.push({ text: line, short: line.split('. ')[0].replace(/ \[[^\]]*\]$/, ''), kind: 'effect' });
  for (const k in it.stats || {}) {
    const aff = (it.rolledAffixes || []).find(a => a.id === k);
    info.properties.push({ text: statText(k, it.stats[k]) + (aff ? ` (roll quality: ${aff.tierName})` : ''), short: statText(k, it.stats[k]), kind: (it.affixes || []).includes(k) ? 'affix' : 'base', quality: aff ? { name: aff.tierName, color: aff.displayColor } : null });
  }
  if (it.set && SETS[it.set]) { const S = SETS[it.set], have = g?.pstats?.sets?.[it.set] || 0; info.set = { name: S.name, color: S.color, have, two: S.bonus2.text, five: S.bonus5.text }; }
  if (it.sourceHint) info.details.push('Found in: ' + it.sourceHint);
  if (it.craftedMutations?.length) info.details.push('Crafted: ' + it.craftedMutations.map(m => m.replace('engraving:', 'engraving · ')).join(', '));
  return info;
}

// ------------------------------------------------------------------ HTML views
const head = (info, icon) => `<div class="ii-head"><div class="ii-icon rar${info.rarity.index}">${icon || ''}</div><div class="ii-title">
  <span class="ii-rarity" style="--rc:${info.rarity.color}">${info.rarity.mark} ${esc(info.rarity.name)}</span>
  <h4>${esc(info.name)}${info.upgrade ? ` <span class="uplvl">+${info.upgrade}</span>` : ''}</h4>
  <div class="ii-kind">${esc(info.type)}${info.weapon && info.weapon.family !== info.type ? ' · ' + esc(info.weapon.family) : ''}${info.clsName ? ` · <span class="${info.own ? 'own' : 'other'}">${esc(info.clsName)}</span>` : ''}${info.forced ? ' · <b class="ii-forced">DEV FORCED</b>' : ''}</div></div></div>`;
const weaponRows = w => `<div class="ii-stats"><div><span>Damage</span><b>${w.min}–${w.max}</b></div><div><span>Attack speed</span><b>×${w.speed.toFixed(2)}</b><small>vs. family base rate</small></div>${w.element ? `<div><span>Element</span><b>${esc(w.element)}</b></div>` : ''}</div>
  <div class="ii-kit"><div><kbd>Left</kbd> ${esc(w.primary)}</div>${w.secondary ? `<div><kbd>Right</kbd> ${esc(w.secondary)}</div>` : ''}</div>`;

// Compact: what matters at a glance. Unique powers are always shown in full.
export function compactHtml(it, g, icon, max = 3) {
  const info = itemInfo(it, g); if (!info) return '<div class="ii ii-empty">Empty slot</div>';
  const props = info.properties.filter(p => p.kind !== 'base' || !info.weapon), shown = props.slice(0, max), more = props.length - shown.length;
  return `<div class="ii ii-compact" style="--rc:${info.rarity.color}">${head(info, icon)}${info.weapon ? weaponRows(info.weapon) : ''}
    ${info.unique.map(u => `<div class="ii-unique">★ ${esc(u)}</div>`).join('')}
    <ul class="ii-props">${shown.map(p => `<li>${esc(p.short)}</li>`).join('')}</ul>${more > 0 ? `<div class="ii-more">+${more} more ${more === 1 ? 'property' : 'properties'} · open Details</div>` : ''}</div>`;
}
// Expanded: every property with its exact numbers, proc conditions, cooldowns and roll ranges.
export function detailsHtml(it, g, icon) {
  const info = itemInfo(it, g); if (!info) return '<div class="ii ii-empty">Empty slot</div>';
  const w = info.weapon;
  return `<div class="ii ii-details" style="--rc:${info.rarity.color}">${head(info, icon)}${w ? weaponRows(w) : ''}
    ${w && w.secondaryDesc ? `<section><h5>Right-click attack</h5><p>${esc(w.secondaryDesc)}</p></section>` : ''}
    ${info.unique.length ? `<section><h5>Unique</h5>${info.unique.map(u => `<p class="ii-unique">★ ${esc(u)}</p>`).join('')}</section>` : ''}
    ${info.properties.some(p => p.kind === 'effect') ? `<section><h5>Effects</h5><ul>${info.properties.filter(p => p.kind === 'effect').map(p => `<li>${esc(p.text)}</li>`).join('')}</ul></section>` : ''}
    ${info.properties.some(p => p.kind !== 'effect') ? `<section><h5>Stats</h5><ul>${info.properties.filter(p => p.kind !== 'effect').map(p => `<li>${esc(p.short)}${p.quality ? ` <small style="color:${p.quality.color}">roll quality: ${esc(p.quality.name)}</small>` : ''}</li>`).join('')}</ul></section>` : ''}
    ${info.set ? `<section class="ii-set" style="--sc:${info.set.color}"><h5>${esc(info.set.name)} set (${info.set.have}/5 worn)</h5><p class="${info.set.have >= 2 ? 'on' : ''}">2 pieces: ${esc(info.set.two)}</p><p class="${info.set.have >= 5 ? 'on' : ''}">5 pieces: ${esc(info.set.five)}</p></section>` : ''}
    ${w ? `<section><h5>Scaling</h5><p>${esc(w.scaling)}</p></section>` : ''}
    <section class="ii-meta"><h5>Item</h5><p>Item level ${info.ilvl}${info.upgrade ? ` · reinforced +${info.upgrade}` : ''} · salvages for ${info.salvage} pips</p>${info.details.map(d => `<p>${esc(d)}</p>`).join('')}</section></div>`;
}

// Like-for-like rows. No verdict: a single power score cannot judge conditional powers.
export function compareRows(it, cur, g) {
  if (!it || !cur || it === cur) return [];
  const rows = [], add = (label, a, b, fmt = v => String(v)) => { if (a === b) return; rows.push({ label, a: fmt(a), b: fmt(b), dir: a > b ? 'up' : 'down' }); };
  const A = itemInfo(it, g), B = itemInfo(cur, g);
  if (A.weapon && B.weapon) {
    add('Average damage', Math.round((A.weapon.min + A.weapon.max) / 2), Math.round((B.weapon.min + B.weapon.max) / 2));
    const sa = +A.weapon.speed.toFixed(2), sb = +B.weapon.speed.toFixed(2); rows.push({ label: 'Attack speed', a: '×' + sa.toFixed(2), b: '×' + sb.toFixed(2), dir: sa === sb ? 'same' : sa > sb ? 'up' : 'down' }); // always shown: the base rate matters for every weapon
    if (A.weapon.primary !== B.weapon.primary) rows.push({ label: 'Left click', a: A.weapon.primary, b: B.weapon.primary, dir: 'change' });
    if (A.weapon.secondary !== B.weapon.secondary) rows.push({ label: 'Right click', a: A.weapon.secondary || '—', b: B.weapon.secondary || '—', dir: 'change' });
  }
  const val = (x, k) => (x.stats || {})[k] || 0;
  for (const k of new Set([...Object.keys(it.stats || {}), ...Object.keys(cur.stats || {})])) { const D = AFFIXES[k]; add(D ? D.name + (D.pct ? ' %' : '') : k === 'armor' ? 'Armour' : k === 'hp' ? 'Max Health' : k, val(it, k), val(cur, k), v => v + (D?.pct ? '%' : '')); }
  if (A.unique.join() !== B.unique.join()) rows.push({ label: 'Unique power', a: A.unique.length ? 'Yes' : '—', b: B.unique.length ? 'Yes' : '—', dir: 'change' });
  return rows;
}
export function compareHtml(it, cur, g) {
  if (!it || !cur || it === cur) return '';
  const rows = compareRows(it, cur, g);
  if (!rows.length) return '<div class="ii-compare"><h5>Compared with equipped</h5><p>Same numbers as the equipped item.</p></div>';
  return `<div class="ii-compare"><h5>Compared with equipped</h5><table><thead><tr><th></th><th>This</th><th>Equipped</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.dir}"><th>${esc(r.label)}</th><td>${esc(r.a)}</td><td>${esc(r.b)}</td></tr>`).join('')}</tbody></table>
    <p class="ii-note">Conditional effects and set bonuses depend on your build; the table does not pick a winner.</p></div>`;
}
