// Pass 5 UI: the six-slot combat HUD and the skill-tree screen (mouse + keyboard/pad).
import { sfx } from './engine/audio.js';
import { CLASSES, xpNeed } from './rpg/classes.js';
import { SKILLS, PATHS, TREES, treeOf, rankOf, lockReason, spendNode, setLoadout, respecTree, pathPoints, spentPoints, rankMult, rankCd, LOADOUT_SIZE, MAX_ACTIVE_RANK } from './rpg/skills.js';
import { SETS } from './rpg/gear.js';

const $ = id => document.getElementById(id);
const KEYS = ['1', '2', '3', '4', '5', '6'];
const TYPE_NAME = { active: 'Active ability', passive: 'Passive', mod: 'Ability modifier', res: 'Resource', util: 'Utility', key: 'Keystone' };

export function installSkillUI(UI) {
  const P = UI.prototype;

  // ---------------------------------------------------------------- HUD
  P.hearts = function () {
    const inv = this.g.inv, hp = Math.max(0, Math.round(inv.hp));
    const el = $('hpbar'); if (!el) return;
    el.style.setProperty('--k', (hp / inv.maxHp * 100) + '%');
    el.querySelector('span').textContent = hp;
    el.classList.toggle('low', hp <= inv.maxHp * 0.25 && hp > 0);
  };
  P.buildHotbar = function () {
    const inv = this.g.inv;
    const key = (inv.loadout || []).join(',') + '|' + inv.cls + '|' + (this.g.settings.abilityLabels ? 1 : 0);
    if (key === this._hotKey) return;
    this._hotKey = key;
    const lbl = this.g.settings.abilityLabels;
    $('abilities').innerHTML = Array.from({ length: LOADOUT_SIZE }, (_, i) => {
      const id = inv.loadout && inv.loadout[i], S = id && SKILLS[id];
      return `<div class="ab ${S ? '' : 'empty'} ${lbl ? 'lbl' : ''}" data-slot="${i}" title="${S ? S.name : 'Empty slot'}"><b>${KEYS[i]}</b><span class="ic">${S ? S.icon : '+'}</span>${S ? `<span class="cost">${S.cost}</span><span class="rk"></span><i class="cdr"></i><em class="cdt"></em><i class="dur" style="display:none"></i>` : ''}${lbl && S ? `<span class="nm">${S.name}</span>` : ''}</div>`;
    }).join('');
    this._slots = [...$('abilities').children];
    this._slots.forEach((el, i) => { el.style.pointerEvents = 'auto'; el.onclick = () => { this.openInventory(); this.invTab = 'skills'; this.treeSlot = i; this.renderInventory(); }; });
  };
  P.flashSlot = function (i, why) { const el = this._slots && this._slots[i]; if (!el) return; el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny'); };
  // what's currently running for an ability (0..1 remaining), for the duration strip
  P.activeFrac = function (id) {
    const g = this.g, p = g.player;
    if (!p) return 0;
    if (id === 'tempest' && p.state === 'tempest') return 1 - p.st / (p.tempestDur || 1.3);
    if (id === 'stormthread' && p.state === 'thread') return 1 - p.threadT / 3;
    const cls = { familiar: 'Familiar', mothstorm: 'MothSwarm', stormpin: 'StormPins', tether: 'Tether', witherhex: 'HexCurse' }[id];
    if (!cls) return 0;
    const e = g.entities.find(e => e.constructor.name === cls && !e.dead);
    if (!e) return 0;
    const dur = { Familiar: e.dur, MothSwarm: e.dur, StormPins: 4, Tether: 5, HexCurse: 3 }[cls];
    return dur > 1e6 ? 1 : Math.max(0, 1 - e.t / dur);
  };
  P.updateVitals = function () {
    const g = this.g, inv = g.inv, C = CLASSES[inv.cls], p = g.player;
    this.hearts();
    const rb = $('resbar');
    rb.style.setProperty('--k', g.res + '%'); rb.style.setProperty('--rc', C.resColor);
    rb.querySelector('span').textContent = Math.floor(g.res);
    rb.title = C.res;
    $('xpbar').querySelector('.fill').style.width = (inv.xp / xpNeed(inv.level) * 100) + '%';
    $('lvl').textContent = inv.level;
    $('lvl').title = `Level ${inv.level} · XP ${inv.xp} / ${xpNeed(inv.level)}${inv.sp ? ` · ${inv.sp} skill point${inv.sp > 1 ? 's' : ''} to spend` : ''}`;
    $('lvl').classList.toggle('sp', inv.sp > 0);
    $('surge').style.setProperty('--k', Math.min(100, g.surge) + '%');
    if (!p) return;
    this.buildHotbar();
    const cdr = 1 - g.pstats.cdr / 100;
    (this._slots || []).forEach((el, i) => {
      const id = inv.loadout[i]; if (!id) return;
      const S = SKILLS[id], rank = rankOf(inv, id);
      const cdMax = rankCd(S, rank) * cdr, cd = p.cdOf(id);
      const ready = cd <= 0;
      el.querySelector('.cdr').style.setProperty('--cd', (ready ? 0 : cd / cdMax) + 'turn');
      el.querySelector('.cdt').textContent = ready ? '' : cd >= 1 ? Math.ceil(cd) : cd.toFixed(1);
      el.classList.toggle('nores', g.res < p.costOf(id));
      el.classList.toggle('target', !!(p.targeting && p.targeting.id === id));
      if (ready && !el.classList.contains('ready')) { el.classList.add('ready', 'flash'); setTimeout(() => el.classList.remove('flash'), 450); }
      if (!ready) el.classList.remove('ready');
      el.classList.toggle('cool', !ready);
      const rk = '●'.repeat(rank) + '○'.repeat(Math.max(0, MAX_ACTIVE_RANK - rank));
      const rkEl = el.querySelector('.rk'); if (rkEl.textContent !== rk) rkEl.textContent = rk;
      const f = this.activeFrac(id), dur = el.querySelector('.dur');
      dur.style.display = f > 0 ? '' : 'none'; if (f > 0) dur.style.transform = `scaleX(${f})`;
      el.classList.toggle('active', f > 0);
      if (p.costOf(id) === 0 && S.cost > 0) el.querySelector('.cost').textContent = 'FREE'; else if (el.querySelector('.cost').textContent !== String(S.cost)) el.querySelector('.cost').textContent = S.cost;
    });
    $('abilities').classList.toggle('disrupted', p.disruptT > 0);
    // calm HUD out of combat
    $('chud').classList.toggle('calm', !(p.combatT > 0) && inv.hp >= inv.maxHp && g.res >= 99 && !g.bossActive);
    // buffs
    const b = [];
    if (g.thornstepT > g.time) b.push('<i style="color:#7fd36a">Thornstep</i>');
    if (g.quickT > g.time) b.push(`<i style="color:#9ad8ff">Quickthread ×${g.quickStacks}</i>`);
    if (p.stillT > 0) b.push('<i style="color:#9ad8ff">Stillwater</i>');
    if (p.counterT > 0) b.push('<i style="color:#fff3b0">Counterdraw</i>');
    if (g.deathDrop && g.deathDrop.area === (g.area && g.area.id)) b.push(`<i style="color:#ffd25e">◆ ${g.deathDrop.coins} pips to recover</i>`);
    const bh = b.join('');
    if (bh !== this._buffHtml) { $('buffs').innerHTML = bh; this._buffHtml = bh; }
  };

  // ---------------------------------------------------------------- skill tree
  const NODE_W = 58, COLW = 250, ROWH = 80, PADX = 70, TOP = 92;
  const pos = n => ({ x: PADX + n.path * COLW + n.x * 62, y: TOP + (4 - n.y) * ROWH });
  P.skillPreview = function (S, rank) {
    const g = this.g, ps = g.pstats;
    const avg = (ps.wmin + ps.wmax) / 2 * (1 + ps.dmgPct / 100) * (1 + ps.abilityDmg / 100);
    const r = Math.max(1, rank);
    return { dmg: Math.round(avg * S.power * rankMult(r)), cd: rankCd(S, r) * (1 - ps.cdr / 100) };
  };
  P.renderSkills = function () {
    const g = this.g, inv = g.inv, cls = inv.cls, nodes = treeOf(cls), paths = PATHS[cls];
    this.treeSel = this.treeSel && nodes.find(n => n.id === this.treeSel) ? this.treeSel : nodes[0].id;
    const sel = nodes.find(n => n.id === this.treeSel);
    const W = PADX * 2 + COLW * 2 + 124 + 10, H = TOP + ROWH * 4 + 60;
    let lines = '', dots = '';
    for (const n of nodes) {
      const a = pos(n);
      for (const q of n.req) {
        const b = pos(nodes.find(m => m.id === q));
        const lit = rankOf(inv, n.id) > 0 && rankOf(inv, q) > 0, open = rankOf(inv, q) > 0;
        lines += `<line x1="${b.x}" y1="${b.y}" x2="${a.x}" y2="${a.y}" class="${lit ? 'lit' : open ? 'open' : ''}" style="--pc:${paths[n.path].color}"/>`;
      }
      if (!n.req.length && !n.free) { /* root passives float free */ }
    }
    // path trunks: from the class sigil up to each path's roots
    const base = { x: W / 2 - 5, y: H - 22 };
    for (let p = 0; p < 3; p++) { const roots = nodes.filter(n => n.path === p && !n.req.length); for (const r of roots) { const a = pos(r); const lit = rankOf(inv, r.id) > 0; lines += `<path d="M${base.x},${base.y} C${base.x},${base.y - 40} ${a.x},${a.y + 60} ${a.x},${a.y + 22}" class="trunk ${lit ? 'lit' : ''}" style="--pc:${paths[p].color}"/>`; } }
    for (const n of nodes) {
      const a = pos(n), r = rankOf(inv, n.id), why = lockReason(inv, n);
      const can = !why, maxed = r >= n.max;
      const icon = n.icon || { passive: '◆', mod: '✦', res: '◉', util: '⟳', key: '✺' }[n.type];
      const slot = n.skill ? inv.loadout.indexOf(n.skill) : -1;
      dots += `<div class="tn ${n.type} ${r ? 'on' : ''} ${can ? 'can' : ''} ${maxed ? 'max' : ''} ${n.id === this.treeSel ? 'sel' : ''}" data-id="${n.id}" style="left:${a.x}px;top:${a.y}px;--pc:${paths[n.path].color}">
        <span class="ti">${icon}</span>${n.max > 1 ? `<span class="tr">${r}/${n.max}</span>` : ''}${slot >= 0 ? `<span class="tk">${slot + 1}</span>` : ''}</div>`;
    }
    const heads = paths.map((p, i) => `<div class="tp" style="left:${PADX + i * COLW + 62}px;--pc:${p.color}"><b>${p.name}</b><small>${p.blurb}</small><em>${pathPoints(inv, cls, i)} pts</em></div>`).join('');
    // detail panel
    const r = rankOf(inv, sel.id), why = lockReason(inv, sel), S = sel.skill && SKILLS[sel.skill];
    let d = `<div class="td-type" style="color:${paths[sel.path].color}">${TYPE_NAME[sel.type]} · ${paths[sel.path].name}</div><h4>${sel.icon || ''} ${sel.name}</h4>`;
    d += `<div class="td-rank">Rank <b>${r}</b> / ${sel.max}${sel.free ? ' · <span style="color:#9f9">granted free at level ' + sel.lvl + '</span>' : sel.lvl > 1 ? ' · level ' + sel.lvl : ''}</div>`;
    if (S) {
      const cur = this.skillPreview(S, r), nxt = this.skillPreview(S, r + 1);
      d += `<p>${S.desc}</p><div class="td-stats"><div><span>Cost</span><b>${S.cost} ${CLASSES[cls].res}</b></div><div><span>Cooldown</span><b>${cur.cd.toFixed(1)} s${r && r < sel.max ? ` → ${nxt.cd.toFixed(1)}` : ''}</b></div><div><span>Damage</span><b>≈${cur.dmg}${r && r < sel.max ? ` → ${nxt.dmg}` : ''}</b></div><div><span>Hits</span><b>${S.hits}</b></div><div><span>Targeting</span><b>${{ self: 'Around you', dir: 'Aimed direction', ground: 'Placed (hold to aim)', unit: 'Aimed foe' }[S.target]}</b></div><div><span>Element</span><b>${S.element}</b></div></div>`;
    } else {
      d += `<p>${sel.desc(Math.max(1, r))}</p>`;
      if (r && r < sel.max) d += `<p class="td-next">Next rank: ${sel.desc(r + 1)}</p>`;
    }
    if (sel.req.length) d += `<div class="td-req">Requires: ${sel.req.map(q => { const qn = TREES[cls].find(n => n.id === q); return `<span style="color:${rankOf(inv, q) ? '#9f9' : '#f99'}">${qn.name}</span>`; }).join(', ')}</div>`;
    if (sel.pathMin) d += `<div class="td-req">Requires ${sel.pathMin} points in ${paths[sel.path].name} (${pathPoints(inv, cls, sel.path)} spent)</div>`;
    d += why ? `<button class="tbtn" disabled>${why}</button>` : `<button class="tbtn go" data-act="learn">Learn${r ? ' rank ' + (r + 1) : ''} (1 point)</button>`;
    if (S && r) d += `<div class="td-assign">Hotbar: ${KEYS.map((k, i) => `<button data-assign="${i}" class="${inv.loadout[i] === sel.skill ? 'on' : ''}">${k}</button>`).join('')} <small>or press 1-6</small></div>`;
    // loadout strip
    const lo = inv.loadout.map((id, i) => `<div class="lo ${this.treeSlot === i ? 'sel' : ''}" data-lo="${i}"><b>${KEYS[i]}</b>${id ? SKILLS[id].icon : '<i>·</i>'}<small>${id ? SKILLS[id].name : 'empty'}</small></div>`).join('');
    // armour sets currently active
    const sets = Object.entries(g.pstats.setBonus || {}).filter(([, t]) => t >= 2).map(([id, t]) => `<span style="color:${SETS[id].color}">${SETS[id].name} (${t === 5 ? 'full set' : '2-piece'})</span>`).join(' · ');
    $('inv-skills').innerHTML = `<div class="tree-top"><div>Skill points: <b class="spn">${inv.sp}</b> <small>· one per level · ${spentPoints(inv)} spent</small></div><div class="lorow">${lo}</div><button class="tbtn" data-act="respec">Reset tree</button></div>
      <div class="tree-body"><div class="tree-wrap"><div class="tree" style="width:${W}px;height:${H}px">${heads}<svg width="${W}" height="${H}">${lines}</svg>${dots}<div class="tsig" style="left:${base.x}px;top:${base.y}px">${{ samurai: '⚔️', archer: '🏹', witch: '🧙' }[cls]}</div></div></div>
      <div class="tree-detail">${d}${sets ? `<div class="td-sets">Set bonuses: ${sets}</div>` : ''}<div class="td-keys">Arrows / click: select · E: learn · 1-6: put on hotbar · K: back to bag</div></div></div>`;
    const root = $('inv-skills');
    root.querySelectorAll('.tn').forEach(el => { el.onclick = () => { this.treeSel = el.dataset.id; sfx('select'); this.renderSkills(); }; el.ondblclick = () => { this.treeSel = el.dataset.id; this.rankUp(); }; el.onmouseenter = () => { if (this.treeSel !== el.dataset.id) { this.treeSel = el.dataset.id; this.renderSkills(); } }; });
    root.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => this.assignSlot(+b.dataset.assign));
    root.querySelectorAll('[data-lo]').forEach(b => b.onclick = () => { const i = +b.dataset.lo; if (this.treeSel && SKILLS[this.treeSel] && rankOf(inv, this.treeSel)) this.assignSlot(i); else { this.treeSlot = this.treeSlot === i ? null : i; this.renderSkills(); } });
    const learn = root.querySelector('[data-act=learn]'); if (learn) learn.onclick = () => this.rankUp();
    root.querySelector('[data-act=respec]').onclick = () => this.confirmRespec();
  };
  P.assignSlot = function (i) {
    const g = this.g, inv = g.inv, sel = this.treeSel;
    if (!SKILLS[sel] || !rankOf(inv, sel)) { sfx('error'); return; }
    if (inv.loadout[i] === sel) setLoadout(inv, i, null); else setLoadout(inv, i, sel);
    sfx('select'); this._hotKey = null; g.save(); this.renderSkills();
  };
  P.rankUp = function () {
    const g = this.g, inv = g.inv;
    if (spendNode(inv, this.treeSel)) {
      sfx('buy'); g.recalc(); g.save(); this._hotKey = null;
      const el = document.querySelector(`#inv-skills .tn[data-id="${this.treeSel}"]`);
      this.renderSkills();
      const n = document.querySelector(`#inv-skills .tn[data-id="${this.treeSel}"]`); if (n) n.classList.add('learned');
    } else { sfx('error'); }
  };
  P.confirmRespec = function () {
    const g = this.g, inv = g.inv, n = spentPoints(inv);
    if (!n) { this.toast('Nothing to reset', 'Your tree has no bought ranks.', 1.4); return; }
    if (this._respecArm && performance.now() - this._respecArm < 3000) {
      this._respecArm = 0;
      g.respec().then(() => { this._hotKey = null; this.toast('Skill tree reset', `${n} point${n > 1 ? 's' : ''} refunded. Class, items and level unchanged.`, 2.4); this.renderSkills(); });
      sfx('chime');
    } else { this._respecArm = performance.now(); sfx('select'); this.toast('Reset the whole tree?', `Refunds ${n} point${n > 1 ? 's' : ''}. Click “Reset tree” again within 3 s to confirm.`, 3); }
  };
  // keyboard / pad navigation on the tree: move to the nearest node in the pressed direction
  P.updateSkillsInput = function (input) {
    const g = this.g, inv = g.inv, nodes = treeOf(inv.cls);
    const cur = nodes.find(n => n.id === this.treeSel) || nodes[0];
    const dir = input.pressed('left') ? [-1, 0] : input.pressed('right') ? [1, 0] : input.pressed('up') ? [0, -1] : input.pressed('down') ? [0, 1] : null;
    if (dir) {
      const a = pos(cur); let best = null, bd = 1e9;
      for (const n of nodes) { if (n === cur) continue; const b = pos(n), dx = b.x - a.x, dy = b.y - a.y; const along = dx * dir[0] + dy * dir[1]; if (along <= 4) continue; const off = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]); const d = along + off * 2.2; if (d < bd) { bd = d; best = n; } }
      if (best) { this.treeSel = best.id; sfx('select'); this.renderSkills(); }
    }
    if (input.pressed('interact') || input.pressed('attack')) this.rankUp();
    for (let i = 0; i < LOADOUT_SIZE; i++) if (input.pressed('ab' + (i + 1))) this.assignSlot(i);
    if (input.pressed('salvage')) this.confirmRespec();
  };
}
