// HTML overlay: HUD, dialogue, prompts, menus, maps.
import { sfx, duckMusic } from './engine/audio.js';
import { T } from './world/tiles.js';
import { installRpgUI } from './ui_rpg.js';
import { installCraftUI } from './ui_craft.js';
import { SettingsPanel } from './settings.js';

const $ = id => document.getElementById(id);

function pixelIcon(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } }
  return c.toDataURL();
}
const HEART = ['.kk...kk.', 'krrk.krrk', 'krwrrrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'];
const HALF = ['.kk...kk.', 'krrk.keek', 'krwrreeek', 'krrrreeek', 'krrrreeek', '.krrreek.', '..krrek..', '...kek...', '....k....'];
const ICONS = {
  full: pixelIcon(HEART, { k: '#1b1426', r: '#e8424f', w: '#ffd0d0' }),
  half: pixelIcon(HALF, { k: '#1b1426', r: '#e8424f', w: '#ffd0d0', e: '#4a3050' }),
  empty: pixelIcon(HEART.map(r => r.replace(/[rw]/g, 'e')), { k: '#1b1426', e: '#4a3050' }),
  bellows: pixelIcon(['.....cc.....', '....c..c....', '...bbbbbbb..', '..bddddddbss', '.bddwddddbs.', '.bddddddddb.', '.bddddddddb.', '..bddddddb..', '...bbbbbb...', '....h..h....', '....h..h....', '....hh.hh...'], { b: '#5a3a1a', d: '#b07a40', w: '#f0d0a0', s: '#c0c0d0', c: '#7ad8ff', h: '#6a4a2a' }),
  potion: pixelIcon(['....kk....', '....cc....', '...kddk...', '..krrrrk..', '.krwrrrrk.', '.krrrrrrk.', '.krrrrrrk.', '..krrrrk..', '...kkkk...'], { k: '#1b1426', c: '#b08a5a', d: '#dfe8f0', r: '#e8424f', w: '#ffd0d0' }),
  none: pixelIcon(['..'], {}),
};

export class UI {
  constructor(game) {
    this.g = game;
    this.dialogQ = []; this.dialogCb = null; this.typing = null;
    this.toastT = 0; this.bannerT = 0; this.areaT = 0;
    this.miniCache = null;
    $('slot-potion').querySelector('.icon').style.backgroundImage = `url(${ICONS.potion})`;
    document.querySelectorAll('#pause .tabs span').forEach(s => s.onclick = () => this.tab(s.dataset.tab));
    $('btn-save').onclick = async () => { if (await this.g.save()) this.toast('Saved.', '', 1); };
    $('btn-title').onclick = async () => { if (await this.g.save()) location.reload(); };
  }
  show(id, on = true) { $(id).classList.toggle('hidden', !on); }

  // ---------------- HUD
  hearts(pop) {
    const inv = this.g.inv, el = $('hearts');
    const n = Math.ceil(inv.maxHp / 2);
    let html = '';
    for (let i = 0; i < n; i++) {
      const v = inv.hp - i * 2;
      const ic = v >= 2 ? ICONS.full : v === 1 ? ICONS.half : ICONS.empty;
      html += `<div class="heart${pop && v >= 1 && v <= 2 ? ' pop' : ''}" style="background-image:url(${ic})"></div>`;
    }
    el.innerHTML = html;
  }
  updateHud() {
    const g = this.g, inv = g.inv;
    this.updateVitals();
    $('coins').textContent = inv.coins;
    $('surge-fill').style.width = Math.min(100, g.surge) + '%';
    $('surge').classList.toggle('full', g.surge >= 100);
    const it = $('slot-item');
    it.querySelector('.icon').style.backgroundImage = `url(${inv.bellows ? ICONS.bellows : ICONS.none})`;
    it.querySelector('.cap').textContent = inv.bellows && inv.galeValve ? '+' : '';
    $('potion-count').textContent = `${inv.potions}/${inv.maxPotions}`;
    const kd = g.area && g.area.id === 'dungeon';
    $('keys').innerHTML = kd ? `🗝 ${inv.keys}${inv.bigkey ? ' · <span style="color:#ffd25e">Thornwood Key</span>' : ''}` : '';
    $('chimes').innerHTML = ['v', 'e', 't'].map((k, i) => `<div class="chime ${k} ${inv.chimes.includes(['verdant', 'ember', 'tide'][i]) ? 'got' : ''}"></div>`).join('');
    $('objective').textContent = g.story.objective();
  }
  areaName(name) {
    const el = $('area-name'); el.textContent = name; el.classList.add('show'); this.areaT = 2.8;
  }
  prompt(text) {
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.innerHTML = `<kbd>E</kbd>${text}`; el.classList.remove('hidden');
  }
  toast(text, small = '', dur = 2) {
    const el = $('toast');
    el.innerHTML = text + (small ? `<small>${small}</small>` : '');
    el.classList.remove('hidden'); this.toastT = dur;
  }
  banner(small, big, dur = 2) {
    const el = $('banner');
    el.querySelector('.small').textContent = small; el.querySelector('.big').textContent = big;
    el.classList.remove('hidden'); el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
    this.bannerT = dur;
  }
  bossBar(name, k) {
    if (name === null) { this.show('boss-bar', false); return; }
    this.show('boss-bar', true);
    $('boss-bar').querySelector('.name').textContent = name;
    $('boss-bar').querySelector('.fill').style.width = Math.max(0, k * 100) + '%';
  }
  fade(on) { $('fade').style.opacity = on ? 1 : 0; }

  // ---------------- dialogue
  get talking() { return this.dialogQ.length > 0 || !!this.typing || !$('dialog').classList.contains('hidden'); }
  say(who, text, cb) { this.lines([[who, text]], cb); }
  lines(arr, cb) {
    const wasEmpty = $('dialog').classList.contains('hidden');
    this.dialogQ.push(...arr);
    if (cb) this.dialogCb = cb;
    if (wasEmpty) this.next();
  }
  next() {
    const el = $('dialog');
    if (!this.dialogQ.length) {
      el.classList.add('hidden'); this.typing = null; duckMusic(false);
      const cb = this.dialogCb; this.dialogCb = null;
      if (cb) cb();
      return;
    }
    duckMusic(true);
    const item = this.dialogQ.shift();
    const [who, text, choices] = item;
    el.classList.remove('hidden');
    el.querySelector('.who').textContent = who || '';
    el.querySelector('.who').style.display = who ? '' : 'none';
    this.choice = null;
    el.querySelector('.choices').innerHTML = '';
    this.typing = { full: text, i: 0, t: 0, choices };
    el.querySelector('.text').innerHTML = '';
    el.querySelector('.more').style.visibility = 'hidden';
  }
  format(s) { return s.replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/_(.+?)_/g, '<i>$1</i>').replace(/~(.+?)~/g, '<u>$1</u>').replace(/\n/g, '<br>'); }
  updateDialog(dt, input) {
    const el = $('dialog');
    if (el.classList.contains('hidden')) return false;
    const ty = this.typing;
    if (ty && ty.i < ty.full.length) {
      ty.t += dt * 70;
      const ni = Math.min(ty.full.length, Math.floor(ty.t));
      if (ni > ty.i) { if (Math.floor(ni / 3) !== Math.floor(ty.i / 3)) sfx('talk'); ty.i = ni; }
      // avoid cutting inside markup tokens by formatting the substring
      el.querySelector('.text').innerHTML = this.format(ty.full.slice(0, ty.i).replace(/[*_~]$/, ''));
      if (input.pressed('interact') || input.pressed('attack')) { ty.i = ty.full.length; ty.t = ty.i; el.querySelector('.text').innerHTML = this.format(ty.full); }
      return true;
    }
    if (ty && ty.choices && !this.choice) {
      this.choice = { i: 0, opts: ty.choices };
      this.renderChoices();
    }
    el.querySelector('.more').style.visibility = this.choice ? 'hidden' : 'visible';
    if (this.choice) {
      if (input.pressed('left') || input.pressed('up')) { this.choice.i = (this.choice.i + this.choice.opts.length - 1) % this.choice.opts.length; sfx('select'); this.renderChoices(); }
      if (input.pressed('right') || input.pressed('down')) { this.choice.i = (this.choice.i + 1) % this.choice.opts.length; sfx('select'); this.renderChoices(); }
      if (input.pressed('interact')) this.pick(this.choice.i);
      else if (input.pressed('pause')) { input.consume('pause'); this.pick(this.choice.opts.length - 1); } // Esc: the last option (Goodbye / Not now)
      return true;
    }
    if (input.pressed('interact') || input.pressed('attack')) { sfx('select'); this.next(); }
    return true;
  }
  pick(i) {
    const el = $('dialog'), o = this.choice && this.choice.opts[i];
    if (!o) return;
    this.choice = null; this.typing = null; this.dialogQ.length = 0; this.dialogCb = null; el.classList.add('hidden'); duckMusic(false); sfx('select');
    o.cb && o.cb();
  }
  renderChoices() {
    const c = $('dialog').querySelector('.choices');
    c.innerHTML = this.choice.opts.map((o, i) => `<span class="${i === this.choice.i ? 'on' : ''}" data-i="${i}">${o.label}</span>`).join('');
    c.querySelectorAll('span').forEach(s => { s.onclick = () => this.pick(+s.dataset.i); s.onmouseenter = () => { if (this.choice) { this.choice.i = +s.dataset.i; this.renderChoices(); } }; });
  }
  ask(who, text, opts) { this.lines([[who, text, opts]]); }

  // ---------------- shop
  openShop(items) {
    this.shopItems = items; this.shopI = 0; this.show('shop', true); this.renderShop();
  }
  renderShop() {
    const g = this.g;
    $('shop-list').innerHTML = this.shopItems.map((it, i) => {
      const st = it.state(g);
      return `<div class="shop-row ${i === this.shopI ? 'on' : ''} ${st !== 'ok' ? 'sold' : ''}"><div>${it.name}<div class="desc">${st === 'ok' ? it.desc : st}</div></div><div class="price">${it.price} ◆</div></div>`;
    }).join('') + `<div class="shop-row" style="justify-content:flex-end;color:#ffd25e">Purse: ${g.inv.coins} ◆</div>`;
  }
  updateShop(input) {
    if ($('shop').classList.contains('hidden')) return false;
    const n = this.shopItems.length;
    if (input.pressed('up')) { this.shopI = (this.shopI + n - 1) % n; sfx('select'); this.renderShop(); }
    if (input.pressed('down')) { this.shopI = (this.shopI + 1) % n; sfx('select'); this.renderShop(); }
    if (input.pressed('interact') || input.pressed('attack')) {
      const it = this.shopItems[this.shopI], g = this.g;
      if (it.state(g) !== 'ok') sfx('error');
      else if (g.inv.coins < it.price) { sfx('error'); this.toast('Not enough pips.', '', 1.2); }
      else { g.inv.coins -= it.price; it.buy(g); sfx('buy'); this.updateHud(); g.save(); this.toast(`Bought ${it.name}!`, '', 1.2); }
      this.renderShop();
    }
    if (input.pressed('pause') || input.pressed('shield')) { this.show('shop', false); input.consume('pause'); this.g.story.shopBye(); }
    return true;
  }

  // ---------------- pause / maps
  tab(name) {
    document.querySelectorAll('#pause .tabs span').forEach(s => s.classList.toggle('on', s.dataset.tab === name));
    ['map', 'quests', 'gear', 'controls', 'settings'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== name));
    if (name === 'settings') { this.setPanel = this.setPanel || new SettingsPanel($('tab-settings'), this.g); this.setPanel.render(); }
    this.curTab = name;
    if (name === 'map') this.drawBigMap();
    if (name === 'quests') $('tab-quests').innerHTML = this.g.story.journal();
    if (name === 'gear') $('tab-gear').innerHTML = this.g.story.gear();
  }
  openPause() { this.show('pause', true); this.tab(this.curTab || 'map'); }
  updatePause(input) {
    const tabs = ['map', 'quests', 'gear', 'controls', 'settings'];
    if (this.curTab === 'settings') { if (input.pressed('shield') || input.pressed('roll')) { this.tab('controls'); sfx('select'); } else this.setPanel.update(input); return; }
    if (input.pressed('right')) { this.tab(tabs[(tabs.indexOf(this.curTab) + 1) % 5]); sfx('select'); }
    if (input.pressed('left')) { this.tab(tabs[(tabs.indexOf(this.curTab) + 4) % 5]); sfx('select'); }
  }
  tileColor(t) {
    switch (t) {
      case T.GRASS: case T.FLOWERS: return '#5da843'; case T.FOREST: return '#3a7a36'; case T.TREE: return '#2a5a2a';
      case T.PATH: return '#d8b37a'; case T.SAND: return '#f1d38e'; case T.ASH: return '#5b4a4a'; case T.WATER: return '#4aa8c8';
      case T.DEEP: return '#2a6a9a'; case T.CLIFF: return '#8a7a68'; case T.ROCK: return '#4a4054'; case T.SANDSTONE: return '#c98a58';
      case T.LAVA: return '#ff7a2a'; case T.PROP: return '#a06a4a'; case T.STONE: return '#c8bca8'; case T.BRIDGE: case T.DOCK: return '#a87a48';
      case T.WALL: return '#2a2034'; case T.PILLAR: return '#4a3a58'; case T.PIT: return '#000'; case T.FILLED: return '#a0703e';
      case T.FLOOR: case T.MOSS: return '#8c7a6a'; case T.CAVE: return '#5e5566';
    }
    return '#555';
  }
  buildMapCanvas() {
    const a = this.g.area;
    const c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
    const x = c.getContext('2d');
    for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) { x.fillStyle = this.tileColor(a.tiles[j * a.w + i]); x.fillRect(i, j, 1, 1); }
    this.miniCache = c; this.miniArea = a;
  }
  drawMini() {
    const g = this.g, a = g.area, p = g.player;
    if (!a || !p) return;
    if (this.miniArea !== a || this.g.tilesDirty) { this.buildMapCanvas(); this.g.tilesDirty = false; }
    const cv = $('minimap'), x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#0d0a14'; x.fillRect(0, 0, cv.width, cv.height);
    if (a.dungeon) { this.drawDungeon(x, cv.width, cv.height, 2.2); return; }
    const sc = 2, vw = cv.width / sc, vh = cv.height / sc;
    const ox = p.x - vw / 2, oz = p.z - vh / 2;
    x.drawImage(this.miniCache, ox, oz, vw, vh, 0, 0, cv.width, cv.height);
    this.markers(x, (mx, mz) => [(mx - ox) * sc, (mz - oz) * sc], 3);
    x.fillStyle = '#fff'; x.fillRect(cv.width / 2 - 2, cv.height / 2 - 2, 4, 4);
    x.fillStyle = '#e0463c'; x.fillRect(cv.width / 2 - 1, cv.height / 2 - 1, 2, 2);
  }
  markers(x, tr, s) {
    for (const m of this.g.story.markers()) {
      const [px, pz] = tr(m.x, m.z);
      x.fillStyle = m.color; x.fillRect(px - s / 2, pz - s / 2, s, s);
      if (m.pulse) { x.strokeStyle = m.color; x.strokeRect(px - s, pz - s, s * 2, s * 2); }
    }
  }
  drawDungeon(x, W, H, sc) {
    const g = this.g, a = g.area, p = g.player;
    const ox = (W - a.w * sc) / 2, oz = (H - a.h * sc) / 2;
    for (const r of a.rooms) {
      if (!g.flags['visited:' + a.id + ':' + r.id] && g.room !== r) continue;
      x.drawImage(this.miniCache, r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0, ox + r.x0 * sc, oz + r.z0 * sc, (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
      if (r.def && r.def.boss) { x.fillStyle = '#e8424f'; x.fillRect(ox + (r.x0 + 8) * sc - 2, oz + (r.z0 + 5) * sc - 2, 5, 5); }
    }
    for (const e of g.entities) if (e.constructor.name === 'Chest' && e.visible && !e.opened && g.flags['visited:' + a.id + ':' + g.roomAt(e.x, e.z)?.id]) { x.fillStyle = '#ffd25e'; x.fillRect(ox + e.x * sc - 1, oz + e.z * sc - 1, 3, 3); }
    x.fillStyle = '#fff'; x.fillRect(ox + p.x * sc - 2, oz + p.z * sc - 2, 4, 4);
  }
  drawBigMap() {
    const g = this.g, a = g.area;
    const cv = $('bigmap'), x = cv.getContext('2d');
    if (this.miniArea !== a) this.buildMapCanvas();
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#0d0a14'; x.fillRect(0, 0, cv.width, cv.height);
    if (a.dungeon) { this.drawDungeon(x, cv.width, cv.height, Math.min(cv.width / a.w, cv.height / a.h) * 0.9); x.fillStyle = '#fff'; x.font = '16px Pixelify Sans, monospace'; x.fillText(a.name, 10, 22); return; }
    const sc = Math.min(cv.width / a.w, cv.height / a.h);
    x.drawImage(this.miniCache, 0, 0, a.w * sc, a.h * sc);
    this.markers(x, (mx, mz) => [mx * sc, mz * sc], 7);
    x.font = '12px Pixelify Sans, monospace'; x.fillStyle = '#fff';
    for (const l of this.g.story.labels()) { x.fillStyle = '#000a'; x.fillText(l.t, l.x * sc + 1, l.z * sc + 1); x.fillStyle = '#fff3cf'; x.fillText(l.t, l.x * sc, l.z * sc); }
    const p = g.player;
    x.fillStyle = '#fff'; x.fillRect(p.x * sc - 4, p.z * sc - 4, 8, 8); x.fillStyle = '#e0463c'; x.fillRect(p.x * sc - 2, p.z * sc - 2, 4, 4);
  }

  update(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.show('toast', false); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.show('banner', false); }
    if (this.areaT > 0) { this.areaT -= dt; if (this.areaT <= 0) $('area-name').classList.remove('show'); }
  }
}
installRpgUI(UI);
installCraftUI(UI);
