import { PixelRenderer } from './engine/pixel.js';
import { Input } from './engine/input.js';
import { initAudio, playMusic, toggleMusic, sfx } from './engine/audio.js';
import { Game, defaultInv } from './game.js';

const pr = new PixelRenderer(document.getElementById('game'));
const input = new Input();
const game = new Game(pr, input);
window.__game = game;

let mode = 'title';
// Test hook: deterministic fixed-step simulation with scripted held keys.
window.__sim = (frames, keys = [], dt = 1 / 30) => {
  for (let i = 0; i < frames; i++) {
    input.keys = new Set(keys);
    input.update();
    if (mode === 'play') game.update(dt);
  }
  input.keys = new Set();
};
window.__start = fresh => start(fresh);
game.loadArea('overworld', 'start');
game.cutscene = true;
game.player.obj.visible = false;

const $ = id => document.getElementById(id);
const menu = [];
if (Game.hasSave()) menu.push({ label: 'Continue', act: () => start(false) });
menu.push({ label: 'New Adventure', act: () => start(true) });
let sel = 0;
function renderMenu() {
  $('title-menu').innerHTML = menu.map((m, i) => `<div class="${i === sel ? 'on' : ''}" data-i="${i}">${m.label}</div>`).join('');
  $('title-menu').querySelectorAll('div').forEach(d => { d.onclick = () => { sel = +d.dataset.i; initAudio(); menu[sel].act(); }; d.onmouseenter = () => { sel = +d.dataset.i; renderMenu(); }; });
}
renderMenu();

function start(fresh) {
  if (mode !== 'title') return;
  initAudio();
  mode = 'play';
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  game.cutscene = false; game.camFocus = null;
  if (fresh) {
    try { localStorage.removeItem('mossling-save-v1'); } catch (e) {}
    game.inv = defaultInv(); game.flags = {}; game.stats = {}; game.playTime = 0;
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
  if (mode === 'pause') {
    game.ui.updatePause(input);
    if (input.pressed('pause')) { mode = 'play'; game.ui.show('pause', false); sfx('select'); }
    game.render(0.0001);
    return;
  }
  if (mode === 'play') {
    const shopOpen = !$('shop').classList.contains('hidden');
    if (input.pressed('pause') && !shopOpen && !game.dead && !game.ui.talking) { mode = 'pause'; game.ui.openPause(); sfx('select'); return; }
    game.update(dt);
  }
}
requestAnimationFrame(frame);

// Keep the game from scrolling on space etc.
addEventListener('keydown', e => { if (mode === 'title' && e.code === 'Enter') e.preventDefault(); });
