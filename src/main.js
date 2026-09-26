import { CharacterCreator } from './character_creator.js';
import { HEART } from './world/layout.js';
import {BUILD,chooseImport} from './alpha.js';
import { PixelRenderer } from './engine/pixel.js';
import {ControllerUI} from './engine/controller.js';
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
import { SurvivalUI } from './survival/ui.js';

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
let sel = 0, titleSettings = null, screen = 'main', newWorld = null;
const HOW_TO = 'MOVE: WASD · AIM: mouse · ATTACK: click or C · WEAPON SECONDARY: right click or X (changes with your weapon) · GUARD: Q (tap to parry) · ROLL: Space\nABILITIES: 1–6 · TOOL: L · INTERACT: F · BAG: E · TONIC: H · SKILLS: K · JOURNAL: J · MAP: M · SURGE: R · MENU: Esc\n\nSURVIVAL: hit trees and rocks with your weapon to gather · G opens crafting and building · stand by a workbench for walls, doors, roofs and storage.\n\nWatch for the *!* over an enemy: it is about to strike.';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = iso => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const CLS = ['samurai', 'archer', 'witch', 'soulbound', 'gunslinger'];
// The title menu is a set of small screens; each item has a label, an action and a card that
// explains it. Story and Survival never share a list.
async function buildMenu(to = screen) {
  screen = to; menu.length = 0;
  const go = s => async () => { sfx('select'); await buildMenu(s); sel = 0; renderMenu(); };
  if (screen === 'main') {
    menu.push({ label: 'Play Story', act: go('story'), card: ['Story', 'The handcrafted adventure: Thimblewick, the Silent Bell and the lands of Lanternreach. Your story characters and their progress live here.'] });
    menu.push({ label: 'Play Survival', act: go('survival'), card: ['Survival', 'A generated wilderness for every world seed. Gather with your weapon, craft a camp, explore caves, and come back to the same world later. Separate saves: it never touches your story characters.'] });
    menu.push({ label: 'Settings', act: () => openTitleSettings(), card: ['Settings', 'Graphics, sound, HUD, controls and accessibility.'] });
    menu.push({ label: 'How to Play', act: () => { sfx('select'); game.ui.say(null, HOW_TO); }, card: ['How to play', 'Controls for both modes.'] });
    menu.push({ label: 'Saves & recovery', act: go('saves'), card: ['Saves & recovery', 'Export a recovery copy, import adventures, or export survival worlds.'] });
    if (game.settings.devMode && game.devlab) menu.push({ label: 'MOSSDEV lab', act: () => enterLab(), card: ['MOSSDEV (developer mode)', 'The sandbox test lab. It has its own storage and never writes to your saves.'] });
  }
  if (screen === 'story') {
    try {
      const profiles = await game.saveProvider.loadCharacters();
      for (const p of profiles) menu.push({ label: `${p.name} · ${p.classId} · Lv ${p.inventory.level}`, act: () => start(false, null, p.id), card: [p.name, `${p.classId[0].toUpperCase() + p.classId.slice(1)} · level ${p.inventory.level}${p.updatedAt ? ' · played ' + ago(p.updatedAt) : ''}. Continue this story adventure.`] });
      menu.push({ label: 'New Character', act: () => start(true), card: ['New character', 'Create a Mossling for the story adventure.'] });
      if (profiles.length) menu.push({ label: 'Delete Character…', act: () => deleteMenu(profiles), card: ['Delete a character', 'Asks before deleting. Survival worlds are not affected.'] });
      if (game.saveProvider.notice) game.ui.toast('Save notice', game.saveProvider.notice, 8);
    } catch (error) {
      game.ui.toast('Save could not be loaded', error.message, 12);
      menu.push({ label: 'Save unavailable — export recovery data', act: exportRecovery, card: ['Recovery', error.message] });
    }
    menu.push({ label: 'Back', act: go('main'), card: ['Back', 'Return to the main menu.'] });
  }
  if (screen === 'survival') {
    const S = game.survivalMode.store, worlds = S.list();
    for (const w of worlds) menu.push({ label: `${w.name} · ${w.character.cls} · seed ${w.seed}`, act: () => startSurvival(w.id), card: [w.name, `${w.character.cls[0].toUpperCase() + w.character.cls.slice(1)} · seed ${w.seed} · generator v${w.genVersion}\nCreated ${new Date(w.createdAt).toLocaleDateString()} · played ${Math.round((w.playTime || 0) / 60)} min · last saved ${ago(w.updatedAt)}\n${w.structures.length} pieces built · ${Object.keys(w.removed).length} trees and rocks gathered · ${Object.values(w.discovered).filter(d => d.type === 'cave').length} caves found`] });
    menu.push({ label: 'New Survival World', act: go('newworld'), card: ['New survival world', 'Pick a name, a class and a seed (or leave the seed blank for a random one). The same seed always grows the same wilderness.'] });
    if (worlds.length) menu.push({ label: 'Delete World…', act: go('delworld'), card: ['Delete a world', 'Asks before deleting. Story characters are not affected.'] });
    if (S.notice) game.ui.toast('Survival saves', S.notice, 6);
    menu.push({ label: 'Back', act: go('main'), card: ['Back', 'Return to the main menu.'] });
  }
  if (screen === 'newworld') {
    newWorld = newWorld || { name: 'Wild World', cls: 'samurai', seed: '' };
    menu.push({ label: 'Create & play', act: () => createSurvival(), card: null, form: true });
    menu.push({ label: 'Back', act: async () => { newWorld = null; await go('survival')(); }, card: null, form: true });
  }
  if (screen === 'delworld') {
    const S = game.survivalMode.store;
    for (const w of S.list()) menu.push({ label: 'Delete ' + w.name, act: async () => { if (!confirm('Delete the survival world "' + w.name + '"? This cannot be undone. Story characters are not affected.')) return; S.delete(w.id); await buildMenu('survival'); sel = 0; renderMenu(); }, card: [w.name, 'Seed ' + w.seed + ' · ' + w.structures.length + ' pieces built. Deleting removes this world only.'] });
    menu.push({ label: 'Back', act: go('survival'), card: ['Back', 'Keep every world.'] });
  }
  if (screen === 'saves') {
    if (game.saveProvider.exportRecovery) menu.push({ label: 'Export Save / Recovery Copy', act: exportRecovery, card: ['Export story saves', 'Downloads every story character as a recovery file.'] });
    menu.push({ label: 'Import adventures…', act: () => chooseImport(game, async () => { await buildMenu(); sel = 0; renderMenu(); }), card: ['Import adventures', 'Adds story characters from an export. Existing ones stay.'] });
    menu.push({ label: 'Export survival worlds', act: exportSurvival, card: ['Export survival worlds', 'Downloads every survival world as a file.'] });
    menu.push({ label: 'Back', act: go('main'), card: ['Back', 'Return to the main menu.'] });
  }
}
function renderMenu() {
  $('title').dataset.build = BUILD; $('title').dataset.screen = screen;
  $('title-menu').replaceChildren();
  menu.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = i === sel ? 'on' : ''; d.dataset.i = i; d.textContent = m.label; d.setAttribute('role', 'button'); d.tabIndex = 0;
    d.onclick = () => { sel = i; initAudio(); m.act(); };
    d.onmouseenter = () => { if (sel !== i) { sel = i; $('title-menu').querySelectorAll('[data-i]').forEach(n => n.classList.toggle('on', +n.dataset.i === sel)); renderCard(); } };
    $('title-menu').append(d);
  });
  const crumb = { main: '', story: 'Story', survival: 'Survival', newworld: 'Survival · new world', delworld: 'Survival · delete', saves: 'Saves & recovery' }[screen];
  let c = $('title-crumb'); if (!c) { c = document.createElement('div'); c.id = 'title-crumb'; $('title-menu').before(c); } c.textContent = crumb;
  renderCard();
}
function renderCard() {
  let card = $('title-card'); if (!card) { card = document.createElement('aside'); card.id = 'title-card'; document.querySelector('#title .title-body').append(card); }
  if (screen === 'newworld') {
    const n = newWorld;
    card.innerHTML = `<h3>New survival world</h3><label>World name<input id="nw-name" maxlength="28" value="${esc(n.name)}"></label><label>Seed <small>(blank = random; words work too)</small><input id="nw-seed" maxlength="24" value="${esc(n.seed)}" placeholder="random"></label><div class="nw-cls" role="radiogroup" aria-label="Class">${CLS.map(k => `<button type="button" role="radio" aria-checked="${n.cls === k}" data-cls="${k}" class="${n.cls === k ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div><p>You start in a small clearing with your class's starter weapon. Gather, craft a campfire, and head for the cave east of camp.</p>`;
    card.querySelector('#nw-name').oninput = e => n.name = e.target.value; card.querySelector('#nw-seed').oninput = e => n.seed = e.target.value;
    card.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { n.cls = b.dataset.cls; renderCard(); });
    for (const i of card.querySelectorAll('input')) i.onkeydown = e => e.stopPropagation();
    return;
  }
  const m = menu[sel]; card.hidden = !m || !m.card;
  if (m && m.card) card.innerHTML = `<h3>${esc(m.card[0])}</h3>${m.card[1].split('\n').map(l => `<p>${esc(l)}</p>`).join('')}`;
}
async function createSurvival() {
  const n = newWorld; let w;
  try { const { seedFromText } = await import('./survival/store.js'); w = game.survivalMode.store.create({ name: n.name, cls: n.cls, seed: seedFromText(n.seed) }); }
  catch (e) { game.ui.toast('World could not be created', e.message, 6); return; }
  newWorld = null; await startSurvival(w.id);
}
async function startSurvival(id) {
  if (!['title', 'titlesettings'].includes(mode)) return;
  initAudio();
  const w = game.survivalMode.store.get(id); if (!w) return;
  mode = 'starting';
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  game.cutscene = false; game.camFocus = null;
  if (!game.survivalUI) game.survivalUI = new SurvivalUI(game.survivalMode);
  game.survivalMode.onQuit = () => location.reload();
  game.survivalMode.start(w);
  mode = 'play';
  game.ui.updateHud();
  await game.save();
}
window.__startSurvival = startSurvival; // test hook
function exportSurvival() {
  const url = URL.createObjectURL(new Blob([game.survivalMode.store.export()], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'mossling-survival-worlds.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    try { await game.saveProvider.deleteCharacter(p.id, p.revision); await buildMenu('story'); sel = 0; renderMenu(); }
    catch (error) { game.ui.toast('Delete failed', error.message, 6); }
  } });
  menu.push({ label: 'Back', act: async () => { await buildMenu('story'); sel = 0; renderMenu(); } });
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
  game.controllerUI = new ControllerUI(game);
  game.openDevLab = async () => {
    if(!['title','titlesettings','play','pause'].includes(mode))throw new Error('Finish character creation before opening the lab.');
    if(!game.devlab)throw new Error('MOSSDEV is unavailable in this build.');
    game.devConsole?.close();game.ui.closeInventory();
    game.settings.devMode=true;SETTINGS.saveSettings(game.settings);
    await enterLab();
  };
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
  // Also available when a persisted lab returns to Survival after a page refresh.
  game.survivalUI = new SurvivalUI(game.survivalMode);
  game.survivalMode.onQuit = () => location.reload();
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
// Route menus before gameplay so a confirming button can never also swing a weapon.
function routeController(dt) {
  let root=null,back=()=>{};
  const shown=id=>{const e=$(id);return e&&!e.classList.contains('hidden')?e:null;};
  if(game.devConsole?.isOpen){root=game.devConsole.el;back=()=>game.devConsole.close();}
  else if(mode==='creator'){root=creator.el;back=()=>root.querySelector('[data-action="back"]')?.click();}
  else if(game.devlab?.overlayOpen){root=$('mossdev');back=()=>game.devlabUI.close();}
  else if(game.survivalUI?.open){root=shown('sv-chest')||$('inventory');back=()=>{game.survivalUI.closeAll();game.ui.closeInventory();};}
  else if(game.ui.invOpen){root=$('inventory');back=()=>game.ui.closeInventory();}
  else if(mode==='pause'){root=$('pause');back=()=>{mode='play';game.ui.show('pause',false);};}
  else if(mode==='titlesettings'){root=$('title-settings');back=()=>titleSettings.onClose?.();}
  else if(mode==='title'){root=game.ui.talking?null:$('title');back=()=>{if(screen!=='main')buildMenu('main').then(renderMenu);};}
  else if(mode==='classsel'){root=$('classsel');back=()=>{};}
  else if(game.ui.talking){root=shown('dialog')?.querySelector('.choices');if(!root?.children.length)root=null;back=()=>{};}
  // Legacy shop / workbench use action navigation, but do not accept combat bindings.
  if(!root&&(shown('shop')||game.ui.craftOpen)&&input.usingPad){
    const r=input.padRaw;if(r){input.state.up=r.buttons[12]||r.move[1]<-.5;input.state.down=r.buttons[13]||r.move[1]>.5;input.state.left=r.buttons[14]||r.move[0]<-.5;input.state.right=r.buttons[15]||r.move[0]>.5;input.state.pause=!!r.buttons[1]||!!r.buttons[9];}
  }
  game.controllerUI.update(dt,root,back);
  if(input.padDisconnected&&mode==='play'&&!root&&!game.dead){mode='pause';game.ui.openPause();}
}
window.__routeController=routeController;
let last = performance.now();
let titleT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.update();
  routeController(dt);
  if (mode === 'creator') { creator.frame(dt); return; }
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
  if (mode === 'play' && game.survivalUI?.open) { if (input.pressed('pause') || input.pressed('craft')) game.ui.closeInventory(); input.keys.clear(); game.render(0.0001); return; } // survival panels pause play
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
