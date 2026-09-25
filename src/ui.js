// HTML overlay: HUD, dialogue, prompts, menus, maps.
import { drawDevOverlay } from './dev/pass6.js';
import { sfx, duckMusic } from './engine/audio.js';
import { T } from './world/tiles.js';
import { installRpgUI } from './ui_rpg.js';
import { installCraftUI } from './ui_craft.js';
import { installSkillUI } from './ui_skills.js';
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
      case T.DEEP: return '#2a6a9a'; case T.SHALLOW: return '#5a9a8a'; case T.CLIFF: return '#8a7a68'; case T.ROCK: return '#4a4054'; case T.SANDSTONE: return '#c98a58';
      case T.LAVA: return '#ff7a2a'; case T.PROP: return '#a06a4a'; case T.STONE: return '#c8bca8'; case T.BRIDGE: case T.DOCK: return '#a87a48';
      case T.WALL: return '#2a2034'; case T.PILLAR: return '#4a3a58'; case T.PIT: return '#000'; case T.FILLED: return '#a0703e';
      case T.FLOOR: case T.MOSS: return '#8c7a6a'; case T.CAVE: return '#5e5566';
      case T.MUD: return '#343a36'; case T.CLAY: return '#d0905e'; case T.FIELD: return '#8a6a3a'; case T.EMBER: return '#4a2a24'; case T.STAIRS: return '#d8ccb4';
    }
    return '#555';
  }
  buildMapCanvas() {
    const a = this.g.area;
    const c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
    const x = c.getContext('2d');
    // one pixel per tile, written straight into an ImageData (fast even for the big world)
    const img = x.createImageData(a.w, a.h), px = img.data, cache = {};
    for (let k = 0, n = a.w * a.h; k < n; k++) {
      const t = a.tiles[k];
      const rgb = cache[t] || (cache[t] = (() => { const h = parseInt(this.tileColor(t).slice(1), 16); return [h >> 16, (h >> 8) & 255, h & 255]; })());
      px[k * 4] = rgb[0]; px[k * 4 + 1] = rgb[1]; px[k * 4 + 2] = rgb[2]; px[k * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
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
    for (const r of (a.rooms || [])) {
      if (!g.flags['visited:' + a.id + ':' + r.id] && g.room !== r) continue;
      x.drawImage(this.miniCache, r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0, ox + r.x0 * sc, oz + r.z0 * sc, (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
      if (r.def && r.def.boss) { x.fillStyle = '#e8424f'; x.fillRect(ox + (r.x0 + 8) * sc - 2, oz + (r.z0 + 5) * sc - 2, 5, 5); }
    }
    for (const e of g.entities) if (e.constructor.name === 'Chest' && e.visible && !e.opened && g.flags['visited:' + a.id + ':' + g.roomAt(e.x, e.z)?.id]) { x.fillStyle = '#ffd25e'; x.fillRect(ox + e.x * sc - 1, oz + e.z * sc - 1, 3, 3); }
    x.fillStyle = '#fff'; x.fillRect(ox + p.x * sc - 2, oz + p.z * sc - 2, 4, 4);
  }
  // An illustrated parchment map (4 px per tile), built once per area.
  buildIllustrated() {
    const a = this.g.area, S = 4;
    const c = document.createElement('canvas'); c.width = a.w * S; c.height = a.h * S;
    const x = c.getContext('2d');
    const H = (i, j, k = 0) => { let h = (i * 374761393 + j * 668265263 + k * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const PAL = { land: '#e8d6a8', land2: '#dcc592', forest: '#9fb07a', forest2: '#8a9c68', sand: '#f0dca6', ash: '#a8908a', water: '#8fb8c8', deep: '#6e9ab4', cliff: '#b8a07a', rock: '#8a7a78', path: '#c89a62', stone: '#d8cbb0', lava: '#e07a4a' };
    const T_ = a.tiles, tl = (i, j) => (i < 0 || j < 0 || i >= a.w || j >= a.h) ? T.CLIFF : T_[j * a.w + i];
    // base colours straight into pixels (the Pass 6 world is 83k tiles)
    const base = x.createImageData(c.width, c.height), bp = base.data, rgb = {};
    const RGB = hex => rgb[hex] || (rgb[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
    Object.assign(PAL, { mud: '#7a8878', clay: '#e0b48a', field: '#c8aa6a', ember: '#8a6a60', high: '#e4e2cc', fen: '#8a9c88' });
    for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) {
      const t = tl(i, j), n = H(i, j);
      let col = PAL.land;
      const bio = a.biome ? a.biome[j * a.w + i] : -1;
      if (t === T.FOREST || t === T.TREE) col = n < 0.5 ? PAL.forest : PAL.forest2;
      else if (t === T.SAND || t === T.SANDSTONE) col = PAL.sand; else if (t === T.ASH) col = PAL.ash;
      else if (t === T.WATER || t === T.SHALLOW) col = PAL.water; else if (t === T.DEEP) col = PAL.deep;
      else if (t === T.CLIFF) col = PAL.cliff; else if (t === T.ROCK) col = PAL.rock; else if (t === T.PATH || t === T.BRIDGE || t === T.DOCK || t === T.STAIRS) col = PAL.path;
      else if (t === T.STONE) col = PAL.stone; else if (t === T.LAVA) col = PAL.lava;
      else if (t === T.MUD) col = PAL.mud; else if (t === T.CLAY) col = PAL.clay; else if (t === T.FIELD) col = PAL.field; else if (t === T.EMBER) col = PAL.ember;
      else if (bio === 8) col = PAL.high; else if (bio === 7) col = PAL.fen; else if (n < 0.3) col = PAL.land2;
      const [r, g2, b] = RGB(col);
      for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const o = ((j * S + yy) * c.width + i * S + xx) * 4; bp[o] = r; bp[o + 1] = g2; bp[o + 2] = b; bp[o + 3] = 255; }
    }
    x.putImageData(base, 0, 0);
    // ink details
    for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) {
      const t = tl(i, j), n = H(i, j, 1), X = i * S, Y = j * S;
      if (t === T.TREE && n < 0.55) { x.fillStyle = n < 0.25 ? '#5a7a44' : '#6a8a4e'; x.fillRect(X + 1, Y, 2, 2); x.fillRect(X, Y + 1, 4, 2); x.fillStyle = '#4a3a2a'; x.fillRect(X + 1, Y + 3, 1, 1); }
      if ((t === T.WATER || t === T.DEEP) && n < 0.12) { x.fillStyle = '#e8f4f8a0'; x.fillRect(X, Y + 1, 2, 1); x.fillRect(X + 2, Y + 2, 2, 1); }
      if ((t === T.CLIFF || t === T.ROCK) && ((i + j) % 2 === 0)) { x.fillStyle = '#6a5a4a80'; x.fillRect(X, Y + 3, 3, 1); }
      if ((t === T.WATER || t === T.DEEP) && tl(i, j - 1) !== T.WATER && tl(i, j - 1) !== T.DEEP) { x.fillStyle = '#5a7a8a'; x.fillRect(X, Y, S, 1); }
      if (t === T.PATH && n < 0.35) { x.fillStyle = '#9a6a3a'; x.fillRect(X + 1, Y + 1, 1, 1); }
    }
    for (const d of a.defs) if (d.type === 'deco' && ['house', 'shop', 'windmill', 'belltower', 'tent', 'hollowtree', 'chimegate', 'shrine', 'stilthouse', 'forgehut', 'farmhouse', 'bigforge', 'glasshouse'].includes(d.model)) {
      const X = (d.x - d.w / 2) * S, Y = (d.z - d.d / 2) * S, W = d.w * S, D = d.d * S;
      x.fillStyle = d.model === 'hollowtree' ? '#5a7a44' : d.model === 'tent' ? '#6a4a6a' : '#b05a42';
      x.fillRect(X + 1, Y + 1, W - 2, D - 2); x.fillStyle = '#3a2a2a'; x.fillRect(X + 1, Y + D - 2, W - 2, 1);
    }
    // paper grain + deckled edge
    const img = x.getImageData(0, 0, c.width, c.height), px = img.data;
    for (let k = 0; k < px.length; k += 4) { const v = (H(k, 7, 3) - 0.5) * 14; px[k] += v; px[k + 1] += v; px[k + 2] += v * 0.8; }
    x.putImageData(img, 0, 0);
    const gr = x.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.width * 0.62);
    gr.addColorStop(0, '#0000'); gr.addColorStop(1, '#5a3a1a70'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#5a3a1a'; x.lineWidth = 3; x.strokeRect(4, 4, c.width - 8, c.height - 8); x.strokeStyle = '#8a6a3a'; x.lineWidth = 1; x.strokeRect(9, 9, c.width - 18, c.height - 18);
    // compass rose
    const cx = c.width - 44, cy = c.height - 50;
    x.fillStyle = '#5a3a1a'; x.beginPath(); x.moveTo(cx, cy - 24); x.lineTo(cx + 6, cy); x.lineTo(cx, cy + 24); x.lineTo(cx - 6, cy); x.fill();
    x.beginPath(); x.moveTo(cx - 24, cy); x.lineTo(cx, cy - 6); x.lineTo(cx + 24, cy); x.lineTo(cx, cy + 6); x.fill();
    x.fillStyle = '#c8402a'; x.beginPath(); x.moveTo(cx, cy - 24); x.lineTo(cx + 6, cy); x.lineTo(cx - 6, cy); x.fill();
    x.font = 'bold 13px Pixelify Sans, monospace'; x.fillStyle = '#5a3a1a'; x.fillText('N', cx - 4, cy - 28);
    this.illus = c; this.illusArea = a;
  }
  // one soft parchment patch over every undiscovered 8x8-tile cell
  fogCanvas() {
    const g = this.g, a = g.area, D = g.world6.discovery;
    if (this.fogKey === D.fog && this.fogC) return this.fogC;
    this.fogKey = D.fog;
    const S = 4, c = this.fogC || (this.fogC = document.createElement('canvas'));
    c.width = a.w * S; c.height = a.h * S;
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    const cols = Math.ceil(a.w / 8), rows = Math.ceil(a.h / 8);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i, nib = parseInt(D.fog[k >> 2] || '0', 16);
      if (nib & (1 << (k & 3))) continue;
      x.fillStyle = (i + j) % 2 ? '#c8b48ae8' : '#c4ae84e8'; x.fillRect(i * 8 * S - 2, j * 8 * S - 2, 8 * S + 4, 8 * S + 4);
    }
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#8a6a3a30';
    for (let k = 0; k < c.width + c.height; k += 12) { x.fillRect(k, 0, 2, c.height); }
    x.globalCompositeOperation = 'source-over';
    return c;
  }
  drawBigMap() {
    const g = this.g, a = g.area;
    const cv = $('bigmap'), x = cv.getContext('2d');
    if (this.miniArea !== a) this.buildMapCanvas();
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#1b1426'; x.fillRect(0, 0, cv.width, cv.height);
    if (a.dungeon) { this.drawDungeon(x, cv.width, cv.height, Math.min(cv.width / a.w, cv.height / a.h) * 0.9); x.fillStyle = '#fff'; x.font = '16px Pixelify Sans, monospace'; x.fillText(a.name, 10, 22); return; }
    if (this.illusArea !== a) this.buildIllustrated();
    const sc = Math.min(cv.width / a.w, cv.height / a.h);
    x.drawImage(this.illus, 0, 0, a.w * sc, a.h * sc);
    // Pass 6: land you haven't seen stays under the fog (the map remembers what you walked)
    if (g.world6 && a.id === 'overworld' && !g.devMapOverlay) { const fog = this.fogCanvas(); if (fog) x.drawImage(fog, 0, 0, a.w * sc, a.h * sc); }
    if (g.devMapOverlay && g.world6 && a.id === 'overworld') drawDevOverlay(g, x, sc);
    // markers: friendly pins, the current objective pulses
    const t = performance.now() / 1000;
    for (const m of this.g.story.markers()) {
      const px = m.x * sc, pz = m.z * sc;
      if (m.pulse) { x.strokeStyle = m.color; x.lineWidth = 2; x.beginPath(); x.arc(px, pz, 7 + (t * 8) % 8, 0, 6.3); x.stroke(); }
      x.fillStyle = '#2a1a10'; x.beginPath(); x.moveTo(px, pz + 2); x.lineTo(px - 5, pz - 6); x.lineTo(px + 5, pz - 6); x.fill();
      x.fillStyle = m.color; x.beginPath(); x.arc(px, pz - 7, 5, 0, 6.3); x.fill(); x.strokeStyle = '#2a1a10'; x.lineWidth = 1.5; x.stroke();
    }
    x.font = '13px Pixelify Sans, monospace'; x.textAlign = 'center';
    for (const l of this.g.story.labels()) { const hw = x.measureText(l.t).width / 2 + 8, lx = Math.max(hw, Math.min(a.w * sc - hw, l.x * sc)); x.lineWidth = 3; x.strokeStyle = '#f0e0b8'; x.strokeText(l.t, lx, l.z * sc); x.fillStyle = '#4a2a14'; x.fillText(l.t, lx, l.z * sc); }
    x.textAlign = 'left';
    const p = g.player;
    x.save(); x.translate(p.x * sc, p.z * sc); x.rotate(-p.facing + Math.PI);
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -8); x.lineTo(6, 6); x.lineTo(0, 3); x.lineTo(-6, 6); x.fill(); x.strokeStyle = '#c8302a'; x.lineWidth = 2; x.stroke();
    x.restore();
  }

  update(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.show('toast', false); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.show('banner', false); }
    if (this.areaT > 0) { this.areaT -= dt; if (this.areaT <= 0) $('area-name').classList.remove('show'); }
  }
}
installRpgUI(UI);
installSkillUI(UI);
installCraftUI(UI);
