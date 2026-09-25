import {renderCreative} from './dev/creative.js';
// Shared journal presentation. Uses existing inventory, quest, map and service systems.
import { glyph, controlsHTML } from './engine/actions.js';
import { abilityIcon } from './ui_icons.js';
import { CLASSES, xpNeed } from './rpg/classes.js';
import { SKILLS, treeOf } from './rpg/skills.js';
import { sfx } from './engine/audio.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NAV = [['bag','Inventory','inventory'],['skills','Skills','skills'],['quests','Journal','journal'],['gear','Codex',null],['map','Map','map'],['settings','Settings',null]];
const nav = active => `<nav class="journal-tabs" aria-label="Adventure journal">${NAV.map(([id,label,action]) => `<button data-page="${id}" class="${id === active ? 'on' : ''}" aria-current="${id === active ? 'page' : 'false'}">${label}${action ? `<kbd>${glyph(action)}</kbd>` : ''}</button>`).join('')}<button data-page="resume" class="journal-close" aria-label="Close journal">×<kbd>Esc</kbd></button></nav>`;
function bindNav(ui, panel, active) {
  let host = panel.querySelector('.journal-nav');
  if (!host) { host = document.createElement('div'); host.className = 'journal-nav'; panel.prepend(host); }
  host.innerHTML = nav(active);
  host.querySelectorAll('[data-page]').forEach(b => b.onclick = () => ui.navigate?.(b.dataset.page));
}
function buttonize(root) {
  root.querySelectorAll('[data-f], [data-s], .cell[data-i], .slotbox, .cr-row[data-i], .cr-base, .cr-tabs [data-m], .choices span, .ccard, .lo').forEach(el => {
    if (el.dataset.i === '-99') return;
    el.tabIndex = 0; el.setAttribute('role','button');
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); el.click(); } };
  });
}
export function installJournalUI(UI) {
  const P = UI.prototype;
  const renderInventory = P.renderInventory;
  P.renderInventory = function () {
    renderInventory.call(this);
    bindNav(this, document.querySelector('.inv-panel'), this.invTab === 'skills' ? 'skills' : 'bag');
    document.querySelector('#inventory .tabs').classList.add('hidden');
    if (this.invTab === 'skills') { renderCreative(this); return; }
    const inv = this.g.inv, slots = this.dollSlots();
    $('paperdoll').querySelectorAll('[data-eq]').forEach(el => {
      const it = inv.equip[slots[+el.dataset.eq].key];
      el.setAttribute('aria-label', slots[+el.dataset.eq].label + ': ' + (it?.name || 'Empty'));
    });
    $('baggrid').querySelectorAll('[data-i]').forEach(el => { const it = inv.bag[+el.dataset.i]; if (it) { el.title = it.name; el.setAttribute('aria-label', it.name); } });
    let head = document.querySelector('.bag-heading');
    if (!head) {
      head = document.createElement('div'); head.className = 'bag-heading';
      head.innerHTML = '<div><h2>Field inventory</h2><span class="bag-capacity"></span></div><label class="bag-search">Find an item<input type="search" placeholder="Search your bag…" aria-label="Search inventory"></label>';
      $('baggrid').before(head);
      head.querySelector('input').addEventListener('input', e => { this.bagSearch = e.target.value; this.renderInventory(); });
    }
    head.querySelector('.bag-capacity').textContent = `${inv.bag.length} / ${this.g.bagCapacity()} spaces · ${inv.coins} pips`;
    let actions = document.querySelector('.item-actions');
    if (!actions) { actions = document.createElement('div'); actions.className = 'item-actions'; $('tooltip').after(actions); }
    const it = this.invSel >= 0 ? inv.bag[this.invSel] : inv.equip[slots[-1-this.invSel]?.key];
    const inBag = this.invSel >= 0;
    actions.innerHTML = it ? `${it.slot === 'ring' && inBag ? `<label>Compare & equip<select aria-label="Ring slot"><option value="ring1">Ring 1</option><option value="ring2">Ring 2</option></select></label>` : ''}<button data-act="equip" ${!inBag ? 'disabled' : ''}>Equip <kbd>${glyph('interact')}</kbd></button><button data-act="favourite">${this.g.isLocked(it) ? '★ Protected' : '☆ Favourite'} <kbd>${glyph('lock')}</kbd></button>${!inBag && slots[-1-this.invSel]?.key !== 'weapon' ? '<button data-act="unequip">Unequip</button>' : ''}<button data-act="salvage" class="danger" ${!inBag || this.g.isLocked(it) || it.craft ? 'disabled' : ''}>Salvage <kbd>${glyph('salvage')}</kbd></button>` : '<span class="empty-note">Select an item to inspect its stats and compare equipment.</span>';
    const ring = actions.querySelector('select');
    if (ring) { ring.value = this.compareRing || 'ring1'; ring.onchange = () => { this.compareRing = ring.value; this.renderInventory(); }; }
    actions.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      if (b.dataset.act === 'equip') this.g.equipItem(this.invSel, it.slot === 'ring' ? (this.compareRing || 'ring1') : undefined);
      if (b.dataset.act === 'favourite') this.g.toggleLock(it);
      if (b.dataset.act === 'salvage') { this.g.salvageItem(this.invSel); this.g.save(); }
      if (b.dataset.act === 'unequip') {
        if (inv.bag.length + 1 > (it.unique==='wayfarersatchel'?30:this.g.bagCapacity())) { this.toast('Your bag is full.', 'Make room before removing equipment.'); return; }
        inv.bag.push(it); inv.equip[slots[-1-this.invSel].key] = null; this.g.recalc(); this.g.save();
      }
      this.renderInventory();
    });
    $('tooltip').querySelector('.tt')?.insertAdjacentHTML('afterbegin', `<div class="card-caption">${inBag ? 'Selected item' : 'Equipped'}</div>`);
    $('tooltip').querySelector('.cmp > .sub')?.classList.add('card-caption');
    const selectedCard = $('tooltip').querySelector('.tt');
    const delta = selectedCard?.querySelector('.delta');
    if (delta) selectedCard.querySelector('.tt-head')?.after(delta);
    if (!it) $('tooltip').innerHTML = '<div class="empty-inventory"><span>◇</span><h3>Your next discovery awaits.</h3><p>Pick up equipment from foes and treasure chests.<br>Select any equipped slot to inspect it.</p></div>';
    document.querySelector('.inv-keys').textContent = 'Arrows select · F equip · V protect · X salvage · T sort · G filter';
    buttonize($('inventory'));
    renderCreative(this);
  };
  const skills = P.renderSkills;
  P.renderSkills = function () {
    skills.call(this);
    const top = $('inv-skills').querySelector('.tree-top');
    top.insertAdjacentHTML('beforebegin', `<div class="skill-heading"><div><span class="page-kicker">The path you choose</span><h2>${CLASSES[this.g.inv.cls].name} disciplines</h2></div><span>□ Active ability &nbsp; ○ Passive &nbsp; ◇ Keystone</span></div>`);
    buttonize($('inv-skills'));
  };
  const hotbar = P.buildHotbar;
  P.buildHotbar = function () {
    hotbar.call(this);
    (this._slots || []).forEach((el,i) => {
      const S = SKILLS[this.g.inv.loadout[i]];
      el.title = S ? `${glyph('ab'+(i+1))} · ${S.name}\n${S.desc}\n${S.cost} ${CLASSES[this.g.inv.cls].res} · ${S.cd}s cooldown\nClick to edit loadout` : `Slot ${i+1} · Click to assign an ability`;
      el.tabIndex = 0; el.setAttribute('role','button'); el.setAttribute('aria-label', el.title);
      el.onclick = () => { this.treeSlot = i; if (S) this.treeSel = this.g.inv.loadout[i]; this.navigate?.('skills'); };
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); el.click(); } };
    });
  };
  const hud = P.updateHud;
  P.updateHud = function () {
    hud.call(this);
    if (!$('hero-plaque')) {
      $('hud').insertAdjacentHTML('afterbegin', '<div id="hero-plaque"><span class="hero-seal">♜</span><div><b></b><small></small><div class="hero-hp"><i></i><span></span></div><div class="hero-resource"><i></i><span></span></div></div></div><div id="map-caption"></div><div id="hud-links"></div><div id="dev-state" class="hidden"></div>');
      $('hud-links').innerHTML = [['bag','Inventory','inventory'],['skills','Skills','skills'],['quests','Journal','journal'],['map','Map','map']].map(([p,l,a]) => `<button data-page="${p}"><kbd>${glyph(a)}</kbd>${l}</button>`).join('');
      $('hud-links').querySelectorAll('button').forEach(b => b.onclick = () => this.navigate?.(b.dataset.page));
      $('slot-potion').querySelector('b').textContent = glyph('potion');
      $('slot-potion').title = `Tonic (${glyph('potion')})`;
      $('title').querySelector('.foot').textContent = 'WASD move · Mouse aim / attack · Q guard · Space dodge · F interact · H tonic · E inventory · K skills · J journal · M map';
    }
    const inv = this.g.inv, C = CLASSES[inv.cls], plaque = $('hero-plaque');
    if (plaque.dataset.cls !== inv.cls) { plaque.dataset.cls = inv.cls; plaque.querySelector('.hero-seal').innerHTML = abilityIcon({samurai:'iaido',archer:'multishot',witch:'familiar'}[inv.cls]); }
    if(inv.fireRod){const tool=$('slot-item');tool.title=(inv.activeTool==='fireRod'?'Cinder Rod':'Gustbellows')+' · L use · Y swap';tool.querySelector('.cap').textContent=inv.activeTool==='fireRod'?'FIRE':'WIND';tool.querySelector('.icon').style.filter=inv.activeTool==='fireRod'?'hue-rotate(160deg) saturate(2)':'';}
    $('xpbar').title = `Experience ${inv.xp} / ${xpNeed(inv.level)}`;
    $('xpbar').setAttribute('aria-label', $('xpbar').title);
    plaque.querySelector('b').textContent = C.name;
    plaque.querySelector('small').textContent = `Level ${inv.level} · ${inv.sp} skill points`;
    plaque.querySelector('.hero-hp i').style.width = `${Math.max(0,inv.hp/inv.maxHp*100)}%`;
    plaque.querySelector('.hero-hp span').textContent = `${Math.ceil(inv.hp)} / ${inv.maxHp}`;
    plaque.querySelector('.hero-resource i').style.width = `${this.g.res}%`;
    plaque.querySelector('.hero-resource i').style.backgroundColor = C.resColor;
    plaque.querySelector('.hero-resource span').textContent = `${Math.floor(this.g.res)} ${C.res}`;
    $('map-caption').textContent = this.g.area?.name || 'The world';
    $('objective').classList.toggle('hidden', this.g.settings.questGuide === false);
    const dev = this.g.area?.id === 'devroom' || !!this.g.devSandbox;
    $('dev-state').classList.toggle('hidden', !dev);
    $('dev-state').textContent = this.g.devSandbox ? 'SANDBOX · saving disabled' : 'DEVELOPER TEST ROOM';
  };
  const tab = P.tab;
  P.tab = function (name) {
    tab.call(this,name);
    bindNav(this, document.querySelector('#pause > .panel'), name);
    document.querySelector('#pause .tabs').classList.add('hidden');
    $('tab-controls').innerHTML = `<h2>Controls</h2>${controlsHTML()}`;
    if (name === 'quests') this.renderJournal();
    if (name === 'gear') this.renderCodex();
    if (name === 'map') {
      if (!$('map-legend')) $('bigmap').insertAdjacentHTML('afterend','<div id="map-legend"><span>△ You</span><span>◆ Quest / landmark</span><span>◇ Discovered Bellstone</span><span>Gold · treasure</span></div>');
    }
  };
  P.renderJournal = function () {
    const temp = document.createElement('div'); temp.innerHTML = this.g.story.journal();
    const rows = [...temp.querySelectorAll('.quest')];
    this.questSel = Math.min(this.questSel || 0, rows.length - 1);
    const selected = rows[this.questSel];
    $('tab-quests').innerHTML = `<div class="page-heading"><span class="page-kicker">Stories still unfolding</span><h2>Your journal</h2></div><div class="journal-layout"><div class="quest-list">${rows.map((r,i) => `<button data-q="${i}" class="${i===this.questSel?'on':''}"><span>${r.classList.contains('done')?'✓':'◇'}</span><div>${esc(r.querySelector('b').textContent)}<small>${r.classList.contains('done')?'Completed':'Adventure notes'}</small></div></button>`).join('')}</div><article class="quest-detail">${selected?.innerHTML || 'No entries yet.'}<button id="track-quest" ${selected?.classList.contains('done')?'disabled':''}>${this.trackedQuest === this.questSel ? 'Tracking this entry' : 'Track this entry'}</button></article></div>`;
    $('tab-quests').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { this.questSel = +b.dataset.q; this.renderJournal(); });
    $('track-quest').onclick = () => { this.trackedQuest = this.questSel; this.trackedQuestTitle = selected?.querySelector('b')?.textContent || ''; this.g.flags.trackedQuestTitle=this.trackedQuestTitle; this.g.save(); this.renderJournal(); };
  };
  const update = P.update;
  P.update = function (dt) {
    update.call(this,dt);
    this._questTick = (this._questTick || 0) + dt;
    if(this._trackedProfile!==this.g.profile?.id){this._trackedProfile=this.g.profile?.id;this.trackedQuestTitle=this.g.flags?.trackedQuestTitle||null;}
    if (this.trackedQuestTitle && this.g.inv && this._questTick > .3) {
      this._questTick = 0;
      const t = document.createElement('div'); t.innerHTML = this.g.story.journal();
      const row = [...t.children].find(r => r.querySelector('b')?.textContent.replace(/^✔ /,'') === this.trackedQuestTitle.replace(/^✔ /,''));
      if (row && !row.classList.contains('done')) $('objective').textContent = row.textContent;
      else { this.trackedQuestTitle = null; delete this.g.flags.trackedQuestTitle; }
    }
  };
  P.renderCodex = function () {
    const inv = this.g.inv;
    const sections = ['Equipment','Relics','Discoveries']; this.codexPage ||= 'Equipment';
    let content = '';
    if (this.codexPage === 'Equipment') content = `<div class="codex-items">${Object.values(inv.equip).filter(Boolean).map(it => this.itemHtml(it)).join('')}</div>`;
    if (this.codexPage === 'Relics') content = `<h3>Chimes recovered</h3><p>${inv.chimes.length ? inv.chimes.map(esc).join(' · ') : 'No Chimes recovered yet.'}</p><h3>Dungeon tools</h3>${inv.fireRod?'<p>Cinder Rod · L use · Y swap tools</p>':''}<p>${inv.bellows ? 'Gustbellows'+(inv.galeValve ? ' · Gale Valve fitted' : '') : 'Explore Rootwell Hollow to discover your first tool.'}</p>${inv.chimes.includes('verdant') ? '<p>Your gust repeats after 1.5 seconds. The Bellwrights called this an Echo.</p>' : ''}`;
    if (this.codexPage === 'Discoveries') content = `<h3>Awakened Bellstones</h3>${this.g.unlockedBellstones().map(b=>`<p>◇ ${esc(this.g.bellstoneName(b.id))}<small> ${esc(b.area)}</small></p>`).join('') || '<p>Rest at a Bellstone to record it here.</p>'}`;
    $('tab-gear').innerHTML = `<div class="page-heading"><span class="page-kicker">An adventurer’s record</span><h2>Field codex</h2></div><div class="codex-nav">${sections.map(s=>`<button class="${s===this.codexPage?'on':''}" data-codex="${s}">${s}</button>`).join('')}</div><div class="codex-content">${content}</div>`;
    $('tab-gear').querySelectorAll('[data-codex]').forEach(b=>b.onclick=()=>{this.codexPage=b.dataset.codex;this.renderCodex();});
  };
  const map = P.drawBigMap;
  P.drawBigMap = function () {
    map.call(this);
    const g=this.g, cv=$('bigmap'), ctx=cv.getContext('2d');
    if(g.area.dungeon) return;
    const scale=Math.min(cv.width/g.area.w,cv.height/g.area.h);
    for(const b of g.unlockedBellstones().filter(b=>b.area===g.area.id)) {
      const d=g.area.defs.find(d=>d.type==='bellstone'&&d.spawn===b.spawn);if(!d)continue;
      ctx.save();ctx.translate(d.x*scale,d.z*scale);ctx.rotate(Math.PI/4);ctx.fillStyle='#e9c56d';ctx.strokeStyle='#453317';ctx.lineWidth=2;ctx.fillRect(-4,-4,8,8);ctx.strokeRect(-4,-4,8,8);ctx.restore();
    }
  };
  const craft=P.renderCraft;
  P.renderCraft=function(){craft.call(this);buttonize($('craft'));this.serviceClose('craft',()=>this.closeCraft());};
  P.serviceClose=function(id,fn){const panel=$(id).querySelector('.panel');if(!panel.querySelector('.service-close')){const b=document.createElement('button');b.className='service-close';b.textContent='Close · Esc';b.onclick=fn;panel.prepend(b);}};
  const ask=P.ask;
  P.ask=function(who,text,opts){ $('dialog').classList.toggle('bellstone-dialog', /Bellstone/.test(who || '')); ask.call(this,who,text,opts); };
  const choices=P.renderChoices;
  P.renderChoices=function(){choices.call(this);buttonize($('dialog'));};
  const shop=P.renderShop;
  P.renderShop=function(){
    shop.call(this);this.serviceClose('shop',()=>{this.show('shop',false);this.g.story.shopBye();});
    $('shop-list').querySelectorAll('.shop-row').forEach((row,i)=>{
      const it=this.shopItems[i];if(!it)return;
      const b=document.createElement('button');b.textContent=it.state(this.g)==='ok'?'Buy':'Unavailable';b.disabled=it.state(this.g)!=='ok'||this.g.inv.coins<it.price;
      b.onclick=()=>{this.shopI=i;this.updateShop({pressed:k=>k==='interact',consume:()=>{}});};row.append(b);
    });
  };
}
