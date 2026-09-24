import { PixelRenderer } from './engine/pixel.js';
import { Input } from './engine/input.js';
import { initAudio, playMusic, toggleMusic, sfx } from './engine/audio.js';
import { Game, defaultInv } from './game.js';
import { SettingsPanel } from './settings.js';
import * as ITEMS from './rpg/items.js';
import * as CRAFT from './rpg/crafting.js';
import * as COMBAT from './rpg/combat.js';
import { Boss } from './entities/boss.js';

const $ = id => document.getElementById(id);
const TIPS = [
  'Tap <b>K</b> just before an enemy strikes to <b>parry</b> — heavy foes stagger and take double damage.',
  'Elite monsters glow with a coloured aura. They hit harder, but always drop gear.',
  'Gear with a <b style="color:#6fdc5a">▲</b> in your bag is an upgrade over what you are wearing.',
  'Gilded chests always hold Rare gear or better. Check your map for gold ◆ markers.',
  'Crates slide until they hit something — and fill any pit they fall into.',
  'Salvage gear you do not need (<b>X</b> in the bag) for pips.',
  'Each level gives a skill point. Ranking up abilities adds 25% damage.',
  'Legendary items carry unique powers. Look for the orange light beams!',
  'The Bell Surge meter fills as you fight. Press <b>R</b> when it glows.',
];
function progress(pct, text) { $('loading').querySelector('.ld-fill').style.width = pct + '%'; $('loading').querySelector('.ld-step').textContent = text; }
const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
$('loading').querySelector('.ld-tip').innerHTML = '💡 ' + TIPS[Math.floor(Math.random() * TIPS.length)];

let pr, input, game;
let mode = 'loading';
// Test hook: deterministic fixed-step simulation with scripted held keys.
window.__sim = (frames, keys = [], dt = 1 / 30) => {
  for (let i = 0; i < frames; i++) {
    input.keys = new Set(keys);
    input.update();
    if (mode === 'play') game.update(dt);
  }
  input.keys = new Set();
};
window.__start = (fresh, cls) => { if (mode === 'play') mode = 'title'; start(fresh, fresh ? (cls || 'samurai') : undefined); };

const menu = [];
let sel = 0, titleSettings = null;
function buildMenu() {
  menu.length = 0;
  if (Game.hasSave()) menu.push({ label: 'Continue', act: () => start(false) });
  menu.push({ label: 'New Adventure', act: () => start(true) });
  menu.push({ label: 'Settings', act: () => openTitleSettings() });
  menu.push({ label: 'How to Play', act: () => { sfx('select'); game.ui.say(null, 'MOVE: WASD · ATTACK: J (hold to charge) · GUARD: K (tap to parry) · ROLL: Space\nABILITIES: 1, 2, 3 · TOOL: L · INTERACT: E · BAG: I · TONIC: Q · SURGE: R · MENU: Esc\n\nExplore Lanternreach, level up, collect gear from monsters and chests, and bring the Dawnbell\'s voices home.'); } });
}
function renderMenu() {
  $('title-menu').innerHTML = menu.map((m, i) => `<div class="${i === sel ? 'on' : ''}" data-i="${i}">${m.label}</div>`).join('');
  $('title-menu').querySelectorAll('div').forEach(d => { d.onclick = () => { sel = +d.dataset.i; initAudio(); menu[sel].act(); }; d.onmouseenter = () => { sel = +d.dataset.i; renderMenu(); }; });
}
function openTitleSettings() {
  sfx('select');
  mode = 'titlesettings';
  $('title-menu').classList.add('hidden');
  $('title-settings').classList.remove('hidden');
  titleSettings = new SettingsPanel($('title-settings'), game, () => { mode = 'title'; $('title-settings').classList.add('hidden'); $('title-menu').classList.remove('hidden'); sfx('select'); });
  titleSettings.render();
}

async function boot() {
  progress(8, 'Waking the world…'); await tick();
  pr = new PixelRenderer($('game'));
  input = new Input();
  progress(25, 'Carving Mosslings…'); await tick();
  game = new Game(pr, input);
  window.__game = game; window.__items = ITEMS; window.__craft = CRAFT; window.__combat = COMBAT; window.__Boss = Boss; // test hooks
  progress(45, 'Growing Whisperwood…'); await tick();
  game.loadArea('overworld', 'start');
  game.cutscene = true;
  game.player.obj.visible = false;
  progress(80, 'Tuning the Dawnbell…'); await tick();
  game.render(1 / 60);
  progress(100, 'Ready!'); await tick();
  buildMenu(); renderMenu();
  mode = 'title';
  $('loading').classList.add('done');
  setTimeout(() => $('loading').remove(), 700);
  requestAnimationFrame(frame);
}

function start(fresh, cls) {
  if (mode !== 'title' && mode !== 'classsel') return;
  initAudio();
  if (fresh && !cls) {
    // choose a class first
    mode = 'classsel';
    $('title').classList.add('hidden');
    game.ui.classSelect(input, c => { mode = 'title'; start(true, c); });
    return;
  }
  mode = 'play';
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  game.cutscene = false; game.camFocus = null;
  if (fresh) {
    try { localStorage.removeItem('mossling-save-v2'); } catch (e) {}
    game.inv = defaultInv(); game.flags = {}; game.stats = {}; game.playTime = 0;
    game.setClass(cls || 'samurai');
    game.story.bounties();
    game.res = 100;
    game.checkpoint = { area: 'overworld', spawn: 'village' };
    game.loadArea('overworld', 'start');
    game.ui.areaName('Thimblewick');
    game.story.opening();
  } else {
    game.load();
    game.loadArea(game.checkpoint.area, game.checkpoint.spawn);
    game.ui.areaName(game.area.name);
    if (game.area.id === 'overworld' && !game.flags.introFought && (game.flags.stage || 0) === 0) game.startIntroFight();
  }
  game.ui.updateHud();
}

let last = performance.now();
let titleT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.update();
  if (input.pressed('music')) { const on = toggleMusic(); game.ui.toast(on ? 'Music on' : 'Music off', '', 0.8); }
  if (mode === 'title') {
    titleT += dt;
    if (game.ui.talking) { game.ui.updateDialog(dt, input); game.render(dt); return; }
    if (input.pressed('up')) { sel = (sel + menu.length - 1) % menu.length; renderMenu(); }
    if (input.pressed('down')) { sel = (sel + 1) % menu.length; renderMenu(); }
    if (input.pressed('interact') || input.pressed('attack') || input.pressed('roll')) { initAudio(); menu[sel].act(); return; }
    game.time += dt;
    game.camFocus = { x: 40 + Math.sin(titleT * 0.05) * 18, z: 55 + Math.cos(titleT * 0.04) * 8 };
    game.fx.update(dt, game.cam);
    game.liquidTime.value = game.time;
    game.render(dt);
    return;
  }
  if (mode === 'titlesettings') {
    titleSettings.update(input);
    game.time += dt; titleT += dt;
    game.camFocus = { x: 40 + Math.sin(titleT * 0.05) * 18, z: 55 + Math.cos(titleT * 0.04) * 8 };
    game.render(dt);
    return;
  }
  if (mode === 'classsel') {
    game.ui.updateClassSelect(input);
    game.time += dt; titleT += dt;
    game.camFocus = { x: 40 + Math.sin(titleT * 0.05) * 18, z: 55 + Math.cos(titleT * 0.04) * 8 };
    game.render(dt);
    return;
  }
  if (mode === 'pause') {
    game.ui.updatePause(input);
    if (input.pressed('pause')) { mode = 'play'; game.ui.show('pause', false); sfx('select'); }
    game.render(0.0001);
    return;
  }
  if (mode === 'play') {
    const shopOpen = !$('shop').classList.contains('hidden');
    if (input.pressed('pause') && !shopOpen && !game.ui.invOpen && !game.ui.craftOpen && !game.dead && !game.ui.talking) { mode = 'pause'; game.ui.openPause(); sfx('select'); return; }
    game.update(dt);
  }
}
boot();

// Keep the game from scrolling on space etc.
addEventListener('keydown', e => { if (mode === 'title' && e.code === 'Enter') e.preventDefault(); });
