import { describeKit } from './rpg/weapon_attacks.js';
import {updateEnemyHud} from './enemy_hud.js';
import {textAllowed} from './rpg/combat_readability.js';
import { gameplayLines } from './rpg/arpg/items.js';
import { abilityIcon } from './ui_icons.js';
// RPG-layer UI: vitals, ability bar, floating numbers, enemy bars, loot feed, inventory, skills, class select.
import * as THREE from 'three';
import { sfx } from './engine/audio.js';
import { CLASSES, xpNeed, computeStats } from './rpg/classes.js';
import { RARITY, AFFIXES, itemIcon, itemPower, statLine, baseById, SETS } from './rpg/items.js';
import { FAMILY, weaponFamily, CLASS_FAMILIES, OFFCLASS_SCALING, SET_PIECES } from './rpg/gear.js';
import { AFFIX_RARITY_TIERS } from './rpg/affixes.js';
import { recipeById, MATS } from './rpg/crafting.js';
import { DollPreview, itemIconURL, itemIconHTML } from './preview.js';

const $ = id => document.getElementById(id);
const AB_ICON = { quickdraw:abilityIcon('quickdraw'),powdergrenade:abilityIcon('powdergrenade'),sentryturret:abilityIcon('sentryturret'), iaido: '💨', tempest: '🌀', oni: '👹', multishot: '🎯', snare: '🪤', rain: '🌧️', nova: '❄️', chain: '⚡', familiar: '🐈‍⬛', soulhook: '🪝', veilshift: '🌫️', kindred: '🏮' };
const CLASS_ICON = { samurai: abilityIcon('iaido'), archer: abilityIcon('multishot'), witch: abilityIcon('familiar'), soulbound: abilityIcon('soulhook'),gunslinger:abilityIcon('quickdraw') };
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
    if (this.g.settings && this.g.settings.numbers === false && /^[+−\-]?\d/.test(text)) return;
    if (this.g.settings && this.g.settings.combatText === false && small && /[A-Z]{3}/.test(text)) return;
    if(!textAllowed(this.g.settings?.damageIntensity,text,big,small,this.g.time,this.numberAt??-1))return;
    if(/^[+−\-]?\d/.test(text))this.numberAt=this.g.time;
    if(small&&/[A-Z]{3}/.test(text)){this.labelTimes ||=new Map();if(this.g.time-(this.labelTimes.get(text)??-10)<.35)return;this.labelTimes.set(text,this.g.time);if(this.labelTimes.size>32)this.labelTimes.delete(this.labelTimes.keys().next().value);}
    const el = document.createElement('div');
    el.className = 'flt' + (big ? ' crit' : '') + (small ? ' small' : '');
    el.textContent = text; el.style.color = color;
    $('floaters').appendChild(el);
    (this.floats || (this.floats = [])).push({ el, x: x + (Math.random() - 0.5) * 0.3, y: y + (this.g.groundAt ? this.g.groundAt(x, z) : 0), z, t: 0, vy: big ? 1.6 : 1.2 });
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
    updateEnemyHud(this,dt);
  };
  P.clearFloats = function () { for (const f of this.floats || []) f.el.remove(); this.floats = []; if (this.bars) { for (const b of this.bars.values()) b.remove(); this.bars.clear(); } };

  P.lootToast = function (it, up) {
    const R = RARITY[it.r];
    const el = document.createElement('div');
    el.className = 'lootmsg'; el.style.borderColor = R.color; el.style.color = R.color;
    // the item's own icon (weapons: the approved sprite), then its name as plain text
    const ico = itemIconHTML(it, this.g && this.g.inv && this.g.inv.cls);
    if (ico) { el.innerHTML = ico; el.append(' ' + it.name + (up || '')); } else el.textContent = itemIcon(it) + ' ' + it.name + (up || '');
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
  // ---- presentation helpers (display only; item rules live in game.js / items.js)
  const SLOT_DEFS = [
    { k: 'helm', alts: ['head'], label: 'Head', side: 'L' }, { k: 'charm', alts: ['neck', 'necklace'], label: 'Neck', side: 'L' },
    { k: 'armor', alts: ['chest'], label: 'Chest', side: 'L' }, { k: 'arms', alts: ['gloves'], label: 'Arms', side: 'L' },
    { k: 'weapon', alts: [], label: 'Weapon', side: 'R' }, { k: 'legs', alts: ['pants'], label: 'Legs', side: 'R' },
    { k: 'boots', alts: ['feet'], label: 'Boots', side: 'R' }, { k: 'ring1', alts: [], label: 'Ring', side: 'R' }, { k: 'ring2', alts: [], label: 'Ring', side: 'R' },
  ];
  // only slots the character actually has are shown (new slots appear automatically)
  P.dollSlots = function () {
    const eq = this.g.inv.equip;
    const out = [];
    for (const d of SLOT_DEFS) { const k = [d.k, ...d.alts].find(k => k in eq); if (k) out.push({ ...d, key: k }); }
    return out;
  };
  const icon = (it, cls) => { try { const u = itemIconURL(it, cls); return u ? `<img class="ico" src="${u}" alt="">` : itemIcon(it); } catch (e) { return itemIcon(it); } };
  P.icon = function (it) { return icon(it, this.g.inv.cls); };
  const statVal = (it, k) => (it && it.stats && it.stats[k]) || 0;
  P.compareHtml = function (it, cur) {
    if (!it || !cur || it === cur) return '';
    const rows = [];
    const d = (label, a, b, fmt = v => v, better = 1) => { const diff = Math.round((a - b) * 10) / 10; if (!diff) return; rows.push(`<div class="${diff * better > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' : '▼ '}${fmt(diff)} ${label}</div>`); };
    if (it.slot === 'weapon') { d('avg damage', (it.min + it.max) / 2, (cur.min + cur.max) / 2); d('speed', it.spd, cur.spd, v => v.toFixed(2)); }
    const keys = new Set([...Object.keys(it.stats || {}), ...Object.keys(cur.stats || {})]);
    for (const k of keys) { const A = AFFIXES[k]; d(A ? A.name + (A.pct ? ' %' : '') : k === 'armor' ? 'Armour' : k === 'hp' ? 'Max Health' : k, statVal(it, k), statVal(cur, k)); }
    return rows.length ? `<div class="delta"><div class="sub">vs. equipped</div>${rows.join('')}</div>` : '<div class="delta"><div class="sub">Same stats as equipped</div></div>';
  };
  P.itemHtml = function (it, cmp) {
    if (!it) return '<div class="tt"><div class="sub">Empty slot</div></div>';
    const g = this.g, R = it.prismatic ? {...RARITY[it.r],color:'#9edfff'} : RARITY[it.r];
    const typeName = it.slot === 'weapon' ? { revolver:'Revolver',rifle:'Automatic rifle',katana: it.big ? 'Greatblade' : 'Katana', bow: 'Bow', staff: 'Staff', wand: 'Wand', oversized: 'Oversized', chain: 'SoulChain' }[it.kind] : { helm: 'Head', armor: 'Chest', charm: 'Necklace', arms: 'Arms', legs: 'Legs', boots: 'Boots', ring: 'Ring' }[it.slot] || it.slot;
    const clsTxt = it.cls ? ` · <span style="color:${it.cls === g.inv.cls ? '#9f9' : '#fc8'}">${CLASSES[it.cls].name}</span>` : it.slot === 'weapon' ? ' · <span style="color:#9df">any class</span>' : '';
    const up = it.upgradeLevel ? ` <span class="uplvl">+${it.upgradeLevel}</span>` : '';
    const locked = g.isLocked(it) ? ' <span title="Locked: cannot be salvaged">🔒</span>' : '';
    let h = `<div class="tt-head"><div class="big-ico rar${it.r}${it.prismatic ? " prism" : ""}">${this.icon(it)}</div><div><h4 style="color:${it.set ? SETS[it.set].color : R.color}">${it.name}${up}${locked}</h4><div class="sub">${it.r === 5 ? 'Prismatic' : it.prismatic ? 'Prismatic signature' : it.set ? 'Set' : R.name} ${typeName} · item level ${it.ilvl}${clsTxt}</div>`;
    if (it.slot === 'weapon') {
      const m = 1 + (it.upgradeLevel || 0) * 0.05;
      h += `<div class="dmg">${Math.round(it.min * m)}–${Math.round(it.max * m)} damage · ${it.spd.toFixed(2)} speed</div>`;
      const fam = weaponFamily(it), own = !it.cls || it.cls === g.inv.cls;
      const kd = describeKit(it, g.inv.cls); if (kd.secondary) h += `<div class="sub kit"><b>Left click:</b> ${kd.primary} · <b>Right click:</b> ${kd.secondary}</div><div class="sub kit-desc">${kd.secondaryDesc}</div>`;
      h += `<div class="sub fam">${FAMILY[fam].name}${own ? (it.cls ? ' · your class: full scaling and specialist perks' : ' · universal: full scaling for everyone') : ` · off-class: ${Math.round(OFFCLASS_SCALING * 100)}% scaling, no ${CLASSES[g.inv.cls].name} specialist perk`}</div>`;
    }
    h += `</div></div>`;
    for (const line of gameplayLines(it)) h += `<div class="aff">${line.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</div>`;
    const lines = [];
    for (const k in it.stats) {
      const isAff = it.affixes.includes(k);
      const affDetail = it.rolledAffixes ? it.rolledAffixes.find(a => a.id === k) : null;
      if (k === 'armor' && !isAff) lines.push(`<div>${it.stats[k]} Armour</div>`);
      else if (k === 'hp' && !isAff) lines.push(`<div>+${it.stats[k]} Max Health</div>`);
      else if (affDetail) {
        lines.push(`<div class="aff" style="color:${affDetail.displayColor}">${affDetail.displayToken} ${statLine(k, it.stats[k])} <span style="font-size:11px;opacity:0.85">[${affDetail.tierName}]</span></div>`);
      } else lines.push(`<div class="${isAff ? 'aff' : ''}">${statLine(k, it.stats[k])}</div>`);
    }
    h += lines.join('');
    if (it.rolledAffixes) {
      for (const aff of it.rolledAffixes) {
        if (aff.qualitative) h += `<div class="uq" style="color:${aff.displayColor}">★ ${aff.qualitative.name}: ${aff.qualitative.description}</div>`;
      }
    }
    if (it.sourceHint) h += `<div class="sub">Found in: ${it.sourceHint}</div>`;
    if (it.utext) h += `<div class="uq">★ ${it.utext}</div>`;
    if (it.set) {
      const S = SETS[it.set], have = g.pstats.sets[it.set] || 0;
      h += `<div class="setbox" style="--sc:${S.color}"><b>${S.name} set</b> (${have}/5 worn)<div class="${have >= 2 ? 'on' : ''}">2: ${S.bonus2.text}</div><div class="${have >= 5 ? 'on' : ''}">5: ${S.bonus5.text}</div><small>${SET_PIECES(it.set).map(id => baseById(id).name.replace(S.name + ' ', '')).join(' · ')}</small></div>`;
    }
    if (it.slot === 'weapon' && it === g.inv.equip.weapon) { const ps = g.pstats; h += `<div class="sub">Abilities scale with this weapon: a ×1.0 ability hit ≈ ${Math.round((ps.wmin + ps.wmax) / 2 * (1 + ps.dmgPct / 100) * (1 + ps.abilityDmg / 100))}</div>`; }
    if (it.craftedMutations && it.craftedMutations.length) h += `<div class="sub">Crafted: ${it.craftedMutations.map(m => m.replace('engraving:', 'engraving · ')).join(', ')}</div>`;
    if (it.craft) { const r = recipeById(it.craft); h += `<div class="uq" style="color:#9ad8ff">✦ ${r.name}: ${r.effect}</div>`; }
    if (cmp !== undefined) h += this.compareHtml(it, cmp);
    h += `<div class="sub" style="margin-top:4px">Salvage: ${Math.max(1, Math.round(it.value * 0.35))} pips · Power ${itemPower(it)}</div>`;
    return `<div class="tt rarb${it.r}">${h}</div>`;
  };
  P.renderInventory = function () {
    const g = this.g, inv = g.inv;
    document.querySelectorAll('#inventory .tabs span[data-itab]').forEach(s => s.classList.toggle('on', s.dataset.itab === this.invTab));
    $('inv-bag').classList.toggle('hidden', this.invTab !== 'bag');
    $('inv-skills').classList.toggle('hidden', this.invTab !== 'skills');
    if (this.invTab === 'skills') return this.renderSkills();
    const slots = this.dollSlots();
    const shown = this.bagView();
    if (this.invSel >= 0 && !shown.includes(this.invSel)) this.invSel = shown[0] ?? 30;
    this.invSel = Math.max(-slots.length, this.invSel);
    const slotHtml = (d, i) => { const it = inv.equip[d.key]; return `<div class="slotbox ${this.invSel === -1 - i ? 'sel' : ''} ${it ? 'rar' + it.r + (it.prismatic ? ' prism' : '') : 'empty'}" data-eq="${i}" title="${d.label}">${it ? this.icon(it) : `<span class="ghost">${{ Head: '⛑', Neck: '◌', Chest: '▣', Arms: '✋', Weapon: '⚔', Legs: '‖', Boots: '▙', Ring: '○' }[d.label] || '·'}</span>`}<small>${d.label}</small></div>`; };
    const Ls = slots.map((d, i) => d.side === 'L' ? slotHtml(d, i) : '').join(''), Rs = slots.map((d, i) => d.side === 'R' ? slotHtml(d, i) : '').join('');
    $('paperdoll').innerHTML = `<div class="doll-col">${Ls}</div><div class="doll-stage"><div class="doll-name">${CLASSES[inv.cls].name} · Lv ${inv.level}</div></div><div class="doll-col">${Rs}</div>`;
    this.doll = this.doll || new DollPreview(g);
    this.doll.mount($('paperdoll').querySelector('.doll-stage'));
    this.doll.setGear(inv.cls, inv.equip, inv.appearance);
    const ps = g.pstats;
    const C = CLASSES[inv.cls];
    const row = (a, b) => `<div>${a}: <b>${b}</b></div>`;
    $('statsheet').innerHTML = [row('Health', Math.round(inv.hp) + '/' + inv.maxHp), row('Damage', Math.round(ps.wmin * 10) / 10 + '–' + Math.round(ps.wmax * 10) / 10), row('Armour', ps.armor), row('Crit', ps.crit.toFixed(0) + '%'), row('Crit dmg', '+' + ps.critDmg + '%'), row('Atk speed', ps.wspd.toFixed(2)), row('Dmg +', ps.dmgPct + '%'), row('Life steal', ps.lifesteal + '%'), row('Cooldowns', '-' + ps.cdr + '%'), row('Move', '+' + ps.moveSpd + '%'), row('Magic find', ps.mf + '%'), row('XP', inv.xp + '/' + xpNeed(inv.level)), row('Pips', inv.coins), row('Bag', inv.bag.length + '/' + g.bagCapacity())].join('') + (inv.mats ? `<div class="mats">${Object.keys(MATS).filter(k => inv.mats[k]).map(k => `<span title="${MATS[k].desc}"><b style="color:${MATS[k].color}">${MATS[k].icon}</b> ${MATS[k].name} ×${inv.mats[k]}</span>`).join('') || '<span style="color:#a99">No crafting materials yet.</span>'}</div>` : '');
    const view = this.bagView();
    let cells = '';
    for (let v = 0; v < g.bagCapacity(); v++) {
      const i = view[v], it = i === undefined ? null : inv.bag[i];
      if (!it) { cells += `<div class="cell" data-i="-99"></div>`; continue; }
      const cur = inv.equip[it.slot === 'ring' ? (this.compareRing || 'ring1') : it.slot];
      const mark = g.isOffClass(it) ? '<span class="oc" title="Off-class">◐</span>' : itemPower(it) > itemPower(cur) ? '<span class="up">▲</span>' : '';
      const hi = it.highestAffixTier && AFFIX_RARITY_TIERS[it.highestAffixTier] && AFFIX_RARITY_TIERS[it.highestAffixTier].tierIndex >= 5 ? ` style="--ac:${it.highestAffixColor}"` : '';
      cells += `<div class="cell rar${it.r}${it.prismatic ? " prism" : ""} ${it.set ? 'isset' : ''} ${hi ? 'afx' : ''} ${this.invSel === i ? 'sel' : ''}" data-i="${i}"${hi}>${this.icon(it)}${mark}${g.isLocked(it) ? '<span class="lk">🔒</span>' : ''}${it.upgradeLevel ? `<span class="ul">+${it.upgradeLevel}</span>` : ''}</div>`;
    }
    const F = ['all', 'weapon', 'armour', 'jewel', 'set', 'named'], FN = { all: 'All', weapon: 'Weapons', armour: 'Armour', jewel: 'Jewellery', set: 'Sets', named: 'Named' };
    const SO = { new: 'Newest', rarity: 'Rarity', power: 'Power', slot: 'Slot', name: 'Name' };
    $('baggrid').innerHTML = `<div class="bagbar">${F.map(f => `<span data-f="${f}" class="${(this.bagFilter || 'all') === f ? 'on' : ''}">${FN[f]}</span>`).join('')}<span class="sort" data-s="1">⇅ ${SO[this.bagSort || 'new']}</span></div>` + cells;
    $('baggrid').querySelectorAll('[data-f]').forEach(el => { el.style.pointerEvents = 'auto'; el.onclick = () => { this.bagFilter = el.dataset.f; sfx('select'); this.renderInventory(); }; });
    const so = $('baggrid').querySelector('[data-s]'); so.style.pointerEvents = 'auto'; so.onclick = () => this.cycleSort();
    const sel = this.invSel >= 0 ? inv.bag[this.invSel] : inv.equip[(slots[-1 - this.invSel] || {}).key];
    const cmp = sel && this.invSel >= 0 ? inv.equip[sel.slot === 'ring' ? (this.compareRing || 'ring1') : sel.slot] || null : undefined;
    $('tooltip').innerHTML = this.itemHtml(sel, cmp) + (sel && this.invSel >= 0 ? `<div class="cmp"><div class="sub">Currently equipped:</div>${cmp ? this.itemHtml(cmp) : '<div class="tt">—</div>'}</div>` : '');
    $('baggrid').querySelectorAll('.cell').forEach(c => {
      const i = +c.dataset.i;
      if (i < 0) return;
      c.onclick = () => { this.invSel = i; sfx('select'); this.renderInventory(); };
      c.ondblclick = () => { this.invSel = i; g.equipItem(i, inv.bag[i]?.slot === 'ring' ? (this.compareRing || 'ring1') : undefined); this.renderInventory(); };
      c.oncontextmenu = e => { e.preventDefault(); this.invSel = i; g.salvageItem(i); g.save(); this.renderInventory(); };
    });
    $('paperdoll').querySelectorAll('.slotbox').forEach(c => { c.onclick = () => { this.invSel = -1 - +c.dataset.eq; this.renderInventory(); }; });
    // equip feedback: the slot that just changed pulses
    if (g.lastEquip && performance.now() - g.lastEquip.t < 600) { const k = slots.findIndex(d => d.key === g.lastEquip.slot || (d.k === g.lastEquip.slot)); const el = $('paperdoll').querySelector(`.slotbox[data-eq="${k}"]`); if (el) el.classList.add('justeq'); }
    const st = $('paperdoll').querySelector('.doll-stage'); if (st && !st.dataset.zoomHint) { st.dataset.zoomHint = 1; st.title = 'Drag to turn · wheel or double-click to zoom'; }
    if (!this.dollLoop) {
      let last = performance.now();
      const loop = now => { if (!this.invOpen) { this.dollLoop = null; return; } this.dollLoop = requestAnimationFrame(loop); this.doll.frame(Math.max(0, Math.min(0.05, (now - last) / 1000))); last = now; };
      this.dollLoop = requestAnimationFrame(loop);
    }
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
  // filtered + sorted view of the bag (indices into inv.bag); the bag order itself never changes
  P.bagView = function () {
    const inv = this.g.inv, f = this.bagFilter || 'all', s = this.bagSort || 'new';
    const ok = it => f === 'all' || (f === 'weapon' && it.slot === 'weapon') || (f === 'armour' && ['helm', 'armor', 'arms', 'legs', 'boots'].includes(it.slot)) || (f === 'jewel' && (it.slot === 'charm' || it.slot === 'ring')) || (f === 'set' && it.set) || (f === 'named' && it.unique);
    const matches = it => {
      const rank=it.prismatic?'Prismatic':RARITY[it.r].name;
      return (this.bagRarity===undefined||this.bagRarity==='all'||(this.bagRarity==='prismatic'?it.prismatic:!it.prismatic&&it.r===+this.bagRarity))
        && (!this.bagOwnClass||!it.cls||it.cls===inv.cls) && (!this.bagProtected||this.g.isLocked(it))
        && (this.bagSearch||'').toLowerCase().trim().split(/\s+/).every(word=>(it.name+' '+it.slot+' '+(it.kind||'')+' '+(it.cls||'universal')+' '+rank+' '+(it.utext||'')+' '+gameplayLines(it).join(' ')).toLowerCase().includes(word));
    };
    const idx = inv.bag.map((it, i) => i).filter(i => inv.bag[i] && ok(inv.bag[i]) && matches(inv.bag[i]));
    const order = { weapon: 0, helm: 1, armor: 2, arms: 3, legs: 4, boots: 5, charm: 6, ring: 7 };
    if (s === 'new') idx.reverse();
    if (s === 'rarity') idx.sort((a, b) => (inv.bag[b].prismatic?5:inv.bag[b].r) - (inv.bag[a].prismatic?5:inv.bag[a].r) || itemPower(inv.bag[b]) - itemPower(inv.bag[a]));
    if (s === 'name') idx.sort((a,b)=>inv.bag[a].name.localeCompare(inv.bag[b].name));
    if (s === 'power') idx.sort((a, b) => itemPower(inv.bag[b]) - itemPower(inv.bag[a]));
    if (s === 'slot') idx.sort((a, b) => (order[inv.bag[a].slot] ?? 9) - (order[inv.bag[b].slot] ?? 9) || inv.bag[b].r - inv.bag[a].r);
    return idx;
  };
  P.cycleSort = function () { const S = ['new', 'rarity', 'power', 'slot', 'name']; this.bagSort = S[(S.indexOf(this.bagSort || 'new') + 1) % S.length]; sfx('select'); this.renderInventory(); };
  P.updateInventory = function (input) {
    if (!this.invOpen) return false;
    const g = this.g, inv = g.inv;
    if (input.pressed('inventory') && this.invTab === 'skills') { this.invTab = 'bag'; this.renderInventory(); return true; }
    if (input.pressed('inventory') || input.pressed('pause')) { this.closeInventory(); input.consume('pause'); return true; }
    if (this.creativeActive && g.area?.id === 'devroom') return true;
    if (input.pressed('shield')) { this.invTab = this.invTab === 'bag' ? 'skills' : 'bag'; sfx('select'); this.renderInventory(); return true; }
    if (this.invTab === 'skills') { this.updateSkillsInput(input); return true; }
    if (input.pressed('sort')) { this.cycleSort(); return true; }
    if (input.pressed('filter')) { const F = ['all', 'weapon', 'armour', 'jewel', 'set', 'named']; this.bagFilter = F[(F.indexOf(this.bagFilter || 'all') + 1) % F.length]; sfx('select'); this.renderInventory(); return true; }
    if (input.pressed('lock')) { const it = this.invSel >= 0 ? inv.bag[this.invSel] : null; if (it) { g.toggleLock(it); this.renderInventory(); } return true; }
    // navigate in the order the bag is shown (filtered / sorted)
    const view = this.bagView();
    const columns = getComputedStyle($('baggrid')).gridTemplateColumns.split(' ').length;
    let s = this.invSel, moved = false;
    if (s >= 0) {
      let v = view.indexOf(s); if (v < 0) v = 0;
      if (input.pressed('left')) { v = Math.max(0, v - 1); moved = true; }
      if (input.pressed('right')) { v = Math.min(Math.max(0, view.length - 1), v + 1); moved = true; }
      if (input.pressed('down')) { v = Math.min(Math.max(0, view.length - 1), v + columns); moved = true; }
      if (input.pressed('up')) { if (v < columns) { this.invSel = -1; sfx('select'); this.renderInventory(); return true; } v -= columns; moved = true; }
      if (input.pressed('interact')) { g.equipItem(s, inv.bag[s]?.slot === 'ring' ? (this.compareRing || 'ring1') : undefined); this.renderInventory(); }
      if (input.pressed('salvage')) { g.salvageItem(s); g.save(); this.renderInventory(); }
      if (moved) { this.invSel = view[v] ?? s; sfx('select'); this.renderInventory(); document.querySelector('#baggrid .cell.sel')?.scrollIntoView({block:'nearest'}); }
      return true;
    }
    if (s < 0) {
      if (input.pressed('left')) { s = Math.min(-1, s + 1); moved = true; }
      if (input.pressed('right')) { s = Math.max(-this.dollSlots().length, s - 1); moved = true; }
      if (input.pressed('down')) { s = this.bagView()[0] ?? 0; moved = true; }
    } else {
      if (input.pressed('left')) { s = Math.max(0, s - 1); moved = true; }
      if (input.pressed('right')) { s = Math.min(29, s + 1); moved = true; }
      if (input.pressed('down')) { s = Math.min(29, s + 10); moved = true; }
      if (input.pressed('up')) { s = s < 10 ? -1 : s - 10; moved = true; }
      if (input.pressed('interact')) { g.equipItem(s, inv.bag[s]?.slot === 'ring' ? (this.compareRing || 'ring1') : undefined); this.renderInventory(); }
      if (input.pressed('salvage')) { g.salvageItem(s); g.save(); this.renderInventory(); }
    }
    if (moved) { this.invSel = s; sfx('select'); this.renderInventory(); }
    return true;
  };

  // ---------------- class select
  P.classSelect = function (input, onPick) {
    const ids = ['samurai', 'archer', 'witch', 'soulbound', 'gunslinger'];
    this.csSel = this.csSel ?? 0;
    const render = () => {
      $('classcards').innerHTML = ids.map((id, i) => {
        const C = CLASSES[id];
        return `<div class="ccard ${i === this.csSel ? 'on' : ''}" data-i="${i}"><div class="ico">${CLASS_ICON[id]}</div><h3>${C.name}</h3><div class="role">${C.role}</div>${C.tagline ? `<div class="tagline">“${C.tagline}”</div>` : ''}<p>${C.blurb}</p>
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
    const n = cs.ids.length;
    if (input.pressed('left')) { this.csSel = (this.csSel + n - 1) % n; sfx('select'); cs.render(); }
    if (input.pressed('right')) { this.csSel = (this.csSel + 1) % n; sfx('select'); cs.render(); }
    if (input.pressed('interact') || input.pressed('attack')) cs.done();
    return true;
  };
}
