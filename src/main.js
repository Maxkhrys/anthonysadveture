import { CharacterCreator } from './character_creator.js';
import { HEART } from './world/layout.js';
import {BUILD,chooseImport} from './alpha.js';
import { PixelRenderer } from './engine/pixel.js';
import { Input } from './engine/input.js';
import { initAudio, playMusic, toggleMusic, sfx } from './engine/audio.js';
import { Game } from './game.js';
import { LocalSaveProvider } from './persistence/provider.js';
import { SettingsPanel } from './settings.js';
import * as SOULBOUND from './rpg/soulbound.js';
import * as ITEMS from './rpg/items.js';
import * as CRAFT from './rpg/crafting.js';
import * as SKILLS from './rpg/skills.js';
import * as GEAR from './rpg/gear.js';
import * as ELEMENTS from './rpg/elements.js';
import * as M3 from './entities/monsters3.js';
import * as SETTINGS from './settings.js';
import { COMMAND_DEFINITIONS as DEVDEFS } from './dev/commands.js';
import * as COMBAT from './rpg/combat.js';
import { Boss } from './entities/boss.js';
import { DevLabUI } from './devlab/ui.js';
import { makeEnemy } from './entities/enemies.js';

const $ = id => document.getElementById(id);
const TIPS = [
  'Tap <b>Q</b> just before an enemy strikes to <b>parry</b> — the next blow is a guaranteed critical.',
  'An <b style="color:#ffa02a">orange !</b> means a heavy blow: a held guard will break. Parry it or roll.',
  'Elite monsters glow with a coloured aura. Light hits won\'t stop their attacks — but they always drop gear.',
  'Bellstones refill your life and tonics, and you wake at the last one if you fall. Gear stays safe; half your carried pips drop where you fall.',
  'Salvage gear for <b>Hush Shards</b>, then take a rare essence to Posy\'s workbench.',
  'Hold <b>2</b> (Snare) or <b>3</b> (Rain) to see where it will land. Release to cast.',
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

let pr, input, game, creator;
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
window.__start = (fresh, cls) => { if (mode === 'play') mode = 'title'; return start(fresh, fresh ? (cls || 'samurai') : undefined); };

const menu = [];
let sel = 0, titleSettings = null;
async function buildMenu() {
  menu.length = 0;
  let profiles;
  try {
    profiles = await game.saveProvider.loadCharacters();
    for (const p of profiles) menu.push({ label: `${p.name} · ${p.classId} · Lv ${p.inventory.level}`, act: () => start(false, null, p.id) });
    menu.push({ label: 'New Character', act: () => start(true) });
    if (profiles.length) menu.push({ label: 'Delete Character…', act: () => deleteMenu(profiles) });
    if (game.saveProvider.notice) game.ui.toast('Save notice', game.saveProvider.notice, 8);
  } catch (error) {
    game.ui.toast('Save could not be loaded', error.message, 12);
    menu.push({ label: 'Save unavailable — export recovery data', act: exportRecovery });
  }
  if (game.saveProvider.exportRecovery) menu.push({ label: 'Export Save / Recovery Copy', act: exportRecovery });
  menu.push({label:'Import adventures…',act:()=>chooseImport(game,async()=>{await buildMenu();sel=0;renderMenu();})});
  if (game.settings.devMode && game.devlab) menu.push({ label: 'MOSSDEV lab (developer mode)', act: () => enterLab() });
  menu.push({ label: 'Settings', act: () => openTitleSettings() });
  menu.push({ label: 'How to Play', act: () => { sfx('select'); game.ui.say(null, 'MOVE: WASD · AIM: mouse · ATTACK: click or C · WEAPON SECONDARY: right click or X (changes with your weapon) · GUARD: Q (tap to parry) · ROLL: Space\nABILITIES: 1–6 · TOOL: L · INTERACT: F · BAG: E · TONIC: H · SKILLS: K · JOURNAL: J · MAP: M · SURGE: R · MENU: Esc\n\nWatch for the *!* over an enemy: it is about to strike. Rest at Bellstones to refill tonics. Bring essences to Posy\'s workbench.'); } });
}
function renderMenu() {
  $('title').dataset.build=BUILD;
  $('title-menu').replaceChildren();
  menu.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = i === sel ? 'on' : ''; d.dataset.i = i; d.textContent = m.label;
    d.onclick = () => { sel = i; initAudio(); m.act(); };
    d.onmouseenter = () => { if (sel !== i) { sel = i; $('title-menu').querySelectorAll('[data-i]').forEach(n => n.classList.toggle('on', +n.dataset.i === sel)); } };
    $('title-menu').append(d);
  });
}
function exportRecovery() {
  try {
    const data = game.saveProvider.exportRecovery();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mossling-save-recovery.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { game.ui.toast('Export failed', error.message, 6); }
}
function deleteMenu(profiles) {
  menu.length = 0; sel = 0;
  for (const p of profiles) menu.push({ label: 'Delete ' + p.name + ' (' + p.classId + ')', act: async () => {
    if (!confirm('Delete ' + p.name + '? Export a recovery copy first if you want to keep this character.')) return;
    try { await game.saveProvider.deleteCharacter(p.id, p.revision); await buildMenu(); sel = 0; renderMenu(); }
    catch (error) { game.ui.toast('Delete failed', error.message, 6); }
  } });
  menu.push({ label: 'Back', act: async () => { await buildMenu(); sel = 0; renderMenu(); } });
  renderMenu();
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
  // Storage access can itself throw (blocked browser storage). Keep the title usable.
  let provider;
  try { provider = new LocalSaveProvider(localStorage); }
  catch { provider = { loadCharacters() { throw new Error('Browser storage unavailable. Enable storage to play with durable saves.'); } }; }
  game = new Game(pr, input, provider);
  game.ui.navigate = page => {
    if (!['play', 'pause'].includes(mode) || game.dead || game.locked() || game.ui.craftOpen || !$('shop').classList.contains('hidden')) return;
    game.ui.closeInventory(); game.ui.show('pause', false);
    input.keys.clear(); input.taps.clear(); input.mouse.clear(); input.mtaps.clear();
    input.state = {}; input.prev = {};
    if (page === 'resume') { mode = 'play'; return; }
    if (page === 'bag' || page === 'skills') {
      mode = 'play'; game.ui.invTab = page; game.ui.openInventory();
    } else { mode = 'pause'; game.ui.openPause(); game.ui.tab(page); }
  };
  window.__game = game; window.__items = ITEMS; window.__craft = CRAFT; window.__combat = COMBAT; window.__Boss = Boss; window.__skills = SKILLS; window.__gear = GEAR; window.__elements = ELEMENTS; window.__m3 = M3; window.__settings = SETTINGS; window.__devDefs = DEVDEFS; window.__sb = SOULBOUND; window.__makeEnemy = makeEnemy; // test hooks
  progress(45, 'Growing Whisperwood…'); await tick();
  game.loadArea('overworld', 'start');
  game.cutscene = true;
  game.player.obj.visible = false;
  progress(80, 'Tuning the Dawnbell…'); await tick();
  game.render(1 / 60);
  progress(100, 'Ready!'); await tick();
  if (game.devlab) { game.devlabUI = new DevLabUI(game.devlab); game.devlab.onTitle = () => location.reload(); window.__devlab = game.devlab; }
  await buildMenu(); renderMenu();
  mode = 'title';
  // a lab that was open when the page closed comes back exactly as it was set up
  if (game.devlab?.store.data.active && game.settings.devMode) await enterLab(false);
  $('loading').classList.add('done');
  setTimeout(() => $('loading').remove(), 700);
  requestAnimationFrame(frame);
}

async function start(fresh, cls, characterId, name = 'Mossling', appearance) {
  if (!['title','classsel','creator'].includes(mode)) return;
  initAudio();
  if (fresh && !cls) {
    mode = 'creator';
    $('title').classList.add('hidden');
    input.paused = true;
    const clearInput = () => { input.keys.clear(); input.taps.clear(); input.mouse.clear(); input.mtaps.clear(); input.state={}; input.prev={}; };
    clearInput();
    creator = new CharacterCreator({
      game,
      onBack: () => { creator.dispose(); creator=null; input.paused=false; clearInput(); mode='title'; $('title').classList.remove('hidden'); document.querySelector('#title-menu button')?.focus(); },
      onConfirm: async ({name,cls,appearance}) => {
        const ok = await start(true,cls,null,name,appearance);
        if (!ok) { mode='creator'; $('title').classList.add('hidden'); throw new Error('Could not save character. Check available browser storage and try again.'); }
        creator.dispose(); creator=null; input.paused=false; clearInput();
      },
    });
    window.__creator = creator; // test hook
    return;
  }
  mode = 'starting';
  try {
    if (fresh) await game.createCharacter(name, cls || 'samurai', appearance);
    else await game.load(characterId);
  } catch (error) {
    mode = 'title'; $('title').classList.remove('hidden');
    game.ui.toast('Character could not be opened', error.message, 8);
    return false;
  }
  mode = 'play';
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  game.cutscene = false; game.camFocus = null;
  if (fresh) {
    game.story.bounties();
    game.res = 100;
    game.checkpoint = { area: 'overworld', spawn: 'village' };
    game.loadArea('overworld', 'start');
    game.ui.areaName('Thimblewick');
    game.story.opening();
  } else {
    game.loadArea(game.checkpoint.area, game.checkpoint.spawn);
    game.ui.areaName(game.area.name);
    if (!game.onboarding.active && game.area.id === 'overworld' && !game.flags.introFought && (game.flags.stage || 0) === 0) game.startIntroFight();
  }
  game.ui.updateHud();
  await game.save();
  return true;
}

// ---------------- MOSSDEV (developer mode only; a key is a convenience, not authentication)
async function enterLab(open = true) {
  const lab = game.devlab; if (!lab || !game.settings.devMode) return;
  if (!['title', 'titlesettings', 'play', 'pause'].includes(mode)) return;
  initAudio();
  if (mode === 'pause') { game.ui.show('pause', false); }
  if (mode === 'title' || mode === 'titlesettings') { $('title').classList.add('hidden'); $('title-settings').classList.add('hidden'); $('title-menu').classList.remove('hidden'); $('hud').classList.remove('hidden'); game.cutscene = false; game.camFocus = null; }
  mode = 'play';
  await lab.enter();
  game.ui.updateHud();
  if (open) game.devlabUI.open('overview');
}
window.__enterLab = enterLab; // test hook
addEventListener('keydown', e => {
  if (e.code !== 'F10' || !game?.devlab || !game.settings.devMode) return;
  e.preventDefault();
  if (game.devlab.active) game.devlabUI.toggle(); else enterLab();
});
let last = performance.now();
let titleT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'creator') { creator.frame(dt); return; }
  input.update();
  if (input.pressed('music')) { const on = toggleMusic(); game.ui.toast(on ? 'Music on' : 'Music off', '', 0.8); }
  if (mode === 'title') {
    titleT += dt;
    if (game.ui.talking) { game.ui.updateDialog(dt, input); game.render(dt); return; }
    if (input.pressed('up')) { sel = (sel + menu.length - 1) % menu.length; renderMenu(); }
    if (input.pressed('down')) { sel = (sel + 1) % menu.length; renderMenu(); }
    if (input.pressed('interact') || input.pressed('attack') || input.pressed('roll')) { initAudio(); menu[sel].act(); return; }
    game.time += dt;
    // a slow drift over Thimblewick at golden hour, lanterns just coming on
    game.flags.dayOffset = (0.665 - 0.32) * 420 - game.time;
    game.camFocus = { x: HEART.x + 55 + Math.sin(titleT * 0.05) * 9, z: HEART.z + 60 + Math.cos(titleT * 0.04) * 5 };
    game.fx.update(dt, game.cam);
    game.liquidTime.value = game.time;
    game.render(dt);
    return;
  }
  if (mode === 'titlesettings') {
    titleSettings.update(input);
    game.time += dt; titleT += dt;
    game.camFocus = { x: HEART.x + 40 + Math.sin(titleT * 0.05) * 18, z: HEART.z + 55 + Math.cos(titleT * 0.04) * 8 };
    game.render(dt);
    return;
  }
  if (mode === 'classsel') {
    game.ui.updateClassSelect(input);
    game.time += dt; titleT += dt;
    game.camFocus = { x: HEART.x + 40 + Math.sin(titleT * 0.05) * 18, z: HEART.z + 55 + Math.cos(titleT * 0.04) * 8 };
    game.render(dt);
    return;
  }
  if (['play', 'pause'].includes(mode) && !game.locked() && !game.dead && !game.ui.craftOpen && $('shop').classList.contains('hidden')) {
    const page = input.pressed('map') ? 'map' : input.pressed('journal') ? 'quests' : input.pressed('skills') ? 'skills' : mode === 'pause' && input.pressed('inventory') ? 'bag' : null;
    if (page) { const same = mode === 'pause' && game.ui.curTab === page || game.ui.invOpen && game.ui.invTab === page; game.ui.navigate(same ? 'resume' : page); game.render(0.0001); return; }
  }
  if (mode === 'pause') {
    game.ui.updatePause(input);
    if (input.pressed('pause')) { mode = 'play'; game.ui.show('pause', false); sfx('select'); }
    game.render(0.0001);
    return;
  }
  if (game.devlabUI) game.devlabUI.tick(dt);
  if (mode === 'play' && game.devlab?.overlayOpen) { if (input.pressed('pause')) game.devlabUI.close(); input.keys.clear(); game.render(0.0001); return; } // configuration pauses the test
  if (mode === 'play') {
    const shopOpen = !$('shop').classList.contains('hidden');
    if (input.pressed('pause') && !shopOpen && !game.ui.invOpen && !game.ui.craftOpen && !game.dead && !game.ui.talking) { mode = 'pause'; game.ui.openPause(); sfx('select'); return; }
    game.update(dt);
  }
}
boot();

// Keep the game from scrolling on space etc.
addEventListener('keydown', e => { if (mode === 'title' && e.code === 'Enter') e.preventDefault(); });

// Flush local writes before leaving; async cloud providers need their own offline queue.
addEventListener('pagehide', () => { if (game?.profile) game.save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game?.profile) game.save(); });
