// RPG-layer UI: vitals, ability bar, floating numbers, enemy bars, loot feed, inventory, skills, class select.
import * as THREE from 'three';
import { sfx } from './engine/audio.js';
import { CLASSES, xpNeed, computeStats } from './rpg/classes.js';
import { RARITY, AFFIXES, itemIcon, itemPower, statLine, baseById } from './rpg/items.js';

const $ = id => document.getElementById(id);
const AB_ICON = { iaido: '💨', tempest: '🌀', oni: '👹', multishot: '🎯', snare: '🪤', rain: '🌧️', nova: '❄️', chain: '⚡', familiar: '🐈‍⬛' };
const CLASS_ICON = { samurai: '⚔️', archer: '🏹', witch: '🧙' };
const _v = new THREE.Vector3();

export function installRpgUI(UI) {
  const P = UI.prototype;

  P.hearts = function (pop) {
    const g = this.g, inv = g.inv;
    const hp = Math.max(0, Math.round(inv.hp));
    $('hpbar').querySelector('.fill').style.width = (hp / inv.maxHp * 100) + '%';
    $('hpbar').querySelector('span').textContent = hp + ' / ' + inv.maxHp;
    if (pop) { const b = $('hpbar'); b.classList.remove('pop'); void b.offsetWidth; }
  };
  P.updateVitals = function () {
    const g = this.g, inv = g.inv, C = CLASSES[inv.cls];
    this.hearts();
    const rb = $('resbar');
    rb.querySelector('.fill').style.width = g.res + '%';
    rb.querySelector('.fill').style.background = `linear-gradient(${C.resColor}, ${C.resColor}aa)`;
    rb.querySelector('span').textContent = C.res + ' ' + Math.floor(g.res);
    $('xpbar').querySelector('.fill').style.width = (inv.xp / xpNeed(inv.level) * 100) + '%';
    $('lvl').textContent = inv.level;
    $('lvl').title = `XP ${inv.xp} / ${xpNeed(inv.level)}`;
    // ability bar
    const p = g.player;
    if (!p) return;
    const html = C.abilities.map((a, i) => {
      const rank = inv.skills[i] || 0;
      const cdMax = a.cd * (1 - 0.06 * (Math.max(1, rank) - 1)) * (1 - g.pstats.cdr / 100);
      const cd = p.cds ? p.cds[i] : 0;
      return `<div class="ab ${rank ? '' : 'locked'} ${g.res < a.cost ? 'nores' : ''}"><b>${a.key}</b>${AB_ICON[a.id]}<div class="cd" style="height:${rank ? Math.min(100, cd / cdMax * 100) : 100}%"></div><span class="rk">${rank ? 'R' + rank : 'L' + a.lvl}</span></div>`;
    }).join('');
    if (html !== this._abHtml) { $('abilities').innerHTML = html; this._abHtml = html; }
  };

  // ---------------- floating numbers & enemy bars
  P.float = function (x, y, z, text, color, big, small) {
    if (this.g.settings && this.g.settings.numbers === false && !small) return;
    const el = document.createElement('div');
    el.className = 'flt' + (big ? ' crit' : '') + (small ? ' small' : '');
    el.textContent = text; el.style.color = color;
    $('floaters').appendChild(el);
    (this.floats || (this.floats = [])).push({ el, x: x + (Math.random() - 0.5) * 0.3, y, z, t: 0, vy: big ? 1.6 : 1.2 });
    if (this.floats.length > 60) { const f = this.floats.shift(); f.el.remove(); }
  };
  P.updateFloats = function (dt) {
    const pr = this.g.pr;
    const fl = this.floats || [];
    for (let i = fl.length - 1; i >= 0; i--) {
      const f = fl[i];
      f.t += dt; f.y += f.vy * dt; f.vy *= 0.93;
      if (f.t > 0.9) { f.el.remove(); fl.splice(i, 1); continue; }
      const s = pr.project(_v.set(f.x, f.y, f.z));
      f.el.style.left = s.x + 'px'; f.el.style.top = s.y + 'px';
      f.el.style.opacity = Math.min(1, (0.9 - f.t) * 3);
    }
    // enemy health bars
    const g = this.g, host = $('floaters');
    this.bars = this.bars || new Map();
    const seen = new Set();
    for (const e of g.entities) {
      if (!e.isEnemy || e.dead || e.isBoss) continue;
      if (e.hpShow > 0) e.hpShow -= dt;
      if (!(e.hpShow > 0 || e.elite)) continue;
      if (Math.abs(e.x - g.player.x) > 16 || Math.abs(e.z - g.player.z) > 12) continue;
      if (g.room && g.roomAt(e.x, e.z) !== g.room) continue;
      seen.add(e);
      let b = this.bars.get(e);
      if (!b) {
        b = document.createElement('div'); b.className = 'ehp' + (e.elite ? ' elite' : '');
        b.innerHTML = `<i></i>${e.elite ? `<label>${e.displayName}</label>` : ''}<small>${e.level || ''}</small>`;
        host.appendChild(b); this.bars.set(e, b);
      }
      const s = this.g.pr.project(_v.set(e.x, (e.alt || 0) + 0.95 * (e.eliteScale || 1) + (e.kind === 'knight' ? 0.5 : 0), e.z));
      b.style.left = s.x + 'px'; b.style.top = s.y + 'px';
      b.firstChild.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
    }
    for (const [e, b] of this.bars) if (!seen.has(e)) { b.remove(); this.bars.delete(e); }
  };
  P.clearFloats = function () { for (const f of this.floats || []) f.el.remove(); this.floats = []; if (this.bars) { for (const b of this.bars.values()) b.remove(); this.bars.clear(); } };

  P.lootToast = function (it, up) {
    const R = RARITY[it.r];
    const el = document.createElement('div');
    el.className = 'lootmsg'; el.style.borderColor = R.color; el.style.color = R.color;
    el.textContent = itemIcon(it) + ' ' + it.name + (up || '');
    $('loot-feed').appendChild(el);
    setTimeout(() => el.remove(), 3500);
    while ($('loot-feed').children.length > 6) $('loot-feed').firstChild.remove();
  };

  // ---------------- inventory
  P.openInventory = function () {
    this.invOpen = true; this.invSel = this.invSel ?? 0; this.invTab = this.invTab || 'bag';
    this.show('inventory', true);
    document.querySelectorAll('#inventory .tabs span[data-itab]').forEach(s => s.onclick = () => { this.invTab = s.dataset.itab; this.renderInventory(); });
    this.renderInventory();
  };
  P.closeInventory = function () { this.invOpen = false; this.show('inventory', false); };
  P.itemHtml = function (it, cmp) {
    if (!it) return '<div class="tt"><div class="sub">Empty</div></div>';
    const g = this.g, R = RARITY[it.r];
    const base = baseById(it.base);
    const typeName = it.slot === 'weapon' ? { katana: 'Katana', bow: 'Bow', staff: 'Staff', wand: 'Wand' }[it.kind] : { helm: 'Helm', armor: 'Armour', charm: 'Charm' }[it.slot];
    const clsTxt = it.cls ? ` · <span style="color:${it.cls === g.inv.cls ? '#9f9' : '#f88'}">${CLASSES[it.cls].name}</span>` : '';
    let h = `<h4 style="color:${R.color}">${it.name}</h4><div class="sub">${R.name} ${typeName} · item level ${it.ilvl}${clsTxt}</div>`;
    if (it.slot === 'weapon') h += `<div class="dmg">${it.min}–${it.max} damage · ${it.spd.toFixed(2)} speed</div>`;
    const lines = [];
    for (const k in it.stats) {
      const isAff = it.affixes.includes(k);
      if (k === 'armor' && !isAff) lines.push(`<div>${it.stats[k]} Armour</div>`);
      else if (k === 'hp' && !isAff) lines.push(`<div>+${it.stats[k]} Max Health</div>`);
      else lines.push(`<div class="${isAff ? 'aff' : ''}">${statLine(k, it.stats[k])}</div>`);
    }
    h += lines.join('');
    if (it.utext) h += `<div class="uq">★ ${it.utext}</div>`;
    h += `<div class="sub" style="margin-top:4px">Salvage: ${Math.max(1, Math.round(it.value * 0.35))} pips · Power ${itemPower(it)}</div>`;
    return `<div class="tt">${h}</div>`;
  };
  P.renderInventory = function () {
    const g = this.g, inv = g.inv;
    document.querySelectorAll('#inventory .tabs span[data-itab]').forEach(s => s.classList.toggle('on', s.dataset.itab === this.invTab));
    $('inv-bag').classList.toggle('hidden', this.invTab !== 'bag');
    $('inv-skills').classList.toggle('hidden', this.invTab !== 'skills');
    if (this.invTab === 'skills') return this.renderSkills();
    const slots = ['weapon', 'helm', 'armor', 'charm'];
    $('paperdoll').innerHTML = slots.map((s, i) => { const it = inv.equip[s]; return `<div class="slotbox ${this.invSel === -1 - i ? 'sel' : ''}" data-eq="${i}" style="border-color:${it ? RARITY[it.r].color : '#3a3050'}">${it ? itemIcon(it) : ''}<small>${s}</small></div>`; }).join('');
    const ps = g.pstats;
    const C = CLASSES[inv.cls];
    const row = (a, b) => `<div>${a}: <b>${b}</b></div>`;
    $('statsheet').innerHTML = [row('Class', C.name), row('Level', inv.level), row('XP', inv.xp + '/' + xpNeed(inv.level)), row('Health', Math.round(inv.hp) + '/' + inv.maxHp), row('Damage', ps.wmin + '–' + ps.wmax), row('Atk speed', ps.wspd.toFixed(2)), row('Crit', ps.crit.toFixed(0) + '%'), row('Crit dmg', '+' + ps.critDmg + '%'), row('Armour', ps.armor), row('Dmg +', ps.dmgPct + '%'), row('Life steal', ps.lifesteal + '%'), row('Cooldowns', '-' + ps.cdr + '%'), row('Move', '+' + ps.moveSpd + '%'), row('Magic find', ps.mf + '%'), row('Pips', inv.coins), row('Bag', inv.bag.length + '/30')].join('');
    let cells = '';
    for (let i = 0; i < 30; i++) {
      const it = inv.bag[i];
      if (!it) { cells += `<div class="cell ${this.invSel === i ? 'sel' : ''}" data-i="${i}"></div>`; continue; }
      const cur = inv.equip[it.slot];
      const mark = !g.canEquip(it) ? '<span class="no">✕</span>' : itemPower(it) > itemPower(cur) ? '<span class="up">▲</span>' : '';
      cells += `<div class="cell ${this.invSel === i ? 'sel' : ''}" data-i="${i}" style="border-color:${RARITY[it.r].color};background:${RARITY[it.r].color}18">${itemIcon(it)}${mark}</div>`;
    }
    $('baggrid').innerHTML = cells;
    const sel = this.invSel >= 0 ? inv.bag[this.invSel] : inv.equip[slots[-1 - this.invSel]];
    const cmp = sel && this.invSel >= 0 ? inv.equip[sel.slot] : null;
    $('tooltip').innerHTML = this.itemHtml(sel) + (sel && this.invSel >= 0 ? `<div class="cmp"><div class="sub">Currently equipped:</div>${cmp ? this.itemHtml(cmp) : '<div class="tt">—</div>'}</div>` : '');
    $('baggrid').querySelectorAll('.cell').forEach(c => {
      const i = +c.dataset.i;
      c.onclick = () => { this.invSel = i; sfx('select'); this.renderInventory(); };
      c.ondblclick = () => { this.invSel = i; g.equipItem(i); this.renderInventory(); };
      c.oncontextmenu = e => { e.preventDefault(); this.invSel = i; g.salvageItem(i); this.renderInventory(); };
    });
    $('paperdoll').querySelectorAll('.slotbox').forEach(c => { c.onclick = () => { this.invSel = -1 - +c.dataset.eq; this.renderInventory(); }; });
  };
  P.renderSkills = function () {
    const g = this.g, inv = g.inv, C = CLASSES[inv.cls];
    this.skSel = this.skSel ?? 0;
    $('inv-skills').innerHTML = `<div style="font-size:16px">Skill points: <b style="color:#ffd25e">${inv.sp}</b> <span style="color:#a99;font-size:13px">— earn one each level. Each rank: +25% damage, −6% cooldown.</span></div>` +
      C.abilities.map((a, i) => {
        const r = inv.skills[i] || 0;
        const can = inv.sp > 0 && r > 0 && r < 5;
        return `<div class="skill ${this.skSel === i ? 'sel' : ''}"><div class="ic">${AB_ICON[a.id]}</div><div class="inf"><b>[${a.key}] ${a.name}</b> — ${r ? 'Rank ' + r + ' / 5' : '<span style="color:#f88">Unlocks at level ' + a.lvl + '</span>'}<small>${a.desc} · Cost ${a.cost} ${C.res} · ${a.cd}s cooldown</small></div><button data-sk="${i}" ${can ? '' : 'disabled'}>+</button></div>`;
      }).join('') + `<div class="skill"><div class="ic">${CLASS_ICON[inv.cls]}</div><div class="inf"><b>Basic: </b>${C.basic}<small>${C.blurb}</small></div></div>`;
    $('inv-skills').querySelectorAll('button[data-sk]').forEach(b => b.onclick = () => { this.skSel = +b.dataset.sk; this.rankUp(); });
  };
  P.rankUp = function () {
    const g = this.g, inv = g.inv, i = this.skSel;
    if (inv.sp > 0 && inv.skills[i] > 0 && inv.skills[i] < 5) { inv.skills[i]++; inv.sp--; sfx('buy'); g.save(); this.updateVitals(); } else sfx('error');
    this.renderSkills();
  };
  P.updateInventory = function (input) {
    if (!this.invOpen) return false;
    const g = this.g, inv = g.inv;
    if (input.pressed('inventory') || input.pressed('pause')) { this.closeInventory(); input.consume('pause'); return true; }
    if (input.pressed('shield')) { this.invTab = this.invTab === 'bag' ? 'skills' : 'bag'; sfx('select'); this.renderInventory(); return true; }
    if (this.invTab === 'skills') {
      if (input.pressed('up')) { this.skSel = (this.skSel + 2) % 3; this.renderSkills(); }
      if (input.pressed('down')) { this.skSel = (this.skSel + 1) % 3; this.renderSkills(); }
      if (input.pressed('interact')) this.rankUp();
      return true;
    }
    let s = this.invSel, moved = false;
    if (s < 0) {
      if (input.pressed('left')) { s = Math.min(-1, s + 1); moved = true; }
      if (input.pressed('right')) { s = Math.max(-4, s - 1); moved = true; }
      if (input.pressed('down')) { s = 0; moved = true; }
    } else {
      if (input.pressed('left')) { s = Math.max(0, s - 1); moved = true; }
      if (input.pressed('right')) { s = Math.min(29, s + 1); moved = true; }
      if (input.pressed('down')) { s = Math.min(29, s + 10); moved = true; }
      if (input.pressed('up')) { s = s < 10 ? -1 : s - 10; moved = true; }
      if (input.pressed('interact')) { g.equipItem(s); this.renderInventory(); }
      if (input.pressed('salvage')) { g.salvageItem(s); this.renderInventory(); }
    }
    if (moved) { this.invSel = s; sfx('select'); this.renderInventory(); }
    return true;
  };

  // ---------------- class select
  P.classSelect = function (input, onPick) {
    const ids = ['samurai', 'archer', 'witch'];
    this.csSel = this.csSel ?? 0;
    const render = () => {
      $('classcards').innerHTML = ids.map((id, i) => {
        const C = CLASSES[id];
        return `<div class="ccard ${i === this.csSel ? 'on' : ''}" data-i="${i}"><div class="ico">${CLASS_ICON[id]}</div><h3>${C.name}</h3><div class="role">${C.role}</div><p>${C.blurb}</p>
        <div class="st">${Object.entries(C.stats).map(([k, v]) => `<span>${k}</span><i style="width:${v * 20}%"></i>`).join('')}</div>
        <div style="font-size:12px;color:#ffd25e">${C.basic}</div><ul>${C.abilities.map(a => `<li>${AB_ICON[a.id]} ${a.name} <span style="color:#a99">(lv ${a.lvl})</span></li>`).join('')}</ul></div>`;
      }).join('');
      $('classcards').querySelectorAll('.ccard').forEach(c => { c.onclick = () => { if (this.csSel === +c.dataset.i) done(); else { this.csSel = +c.dataset.i; sfx('select'); render(); } }; });
    };
    const done = () => { this.show('classsel', false); this.csActive = false; sfx('fanfare'); onPick(ids[this.csSel]); };
    this.csActive = { render, done, ids };
    this.show('classsel', true);
    render();
  };
  P.updateClassSelect = function (input) {
    const cs = this.csActive;
    if (!cs) return false;
    if (input.pressed('left')) { this.csSel = (this.csSel + 2) % 3; sfx('select'); cs.render(); }
    if (input.pressed('right')) { this.csSel = (this.csSel + 1) % 3; sfx('select'); cs.render(); }
    if (input.pressed('interact') || input.pressed('attack')) cs.done();
    return true;
  };
}
