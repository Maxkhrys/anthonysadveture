// Persistent settings with a keyboard/mouse-driven panel.
import { controlsHTML } from './engine/actions.js';
import { setVolumes, sfx } from './engine/audio.js';

const KEY = 'mossling-settings';
const OPTS = [
  { k: 'difficulty', name: 'Difficulty', vals: ['story', 'normal', 'hard'], labels: ['Story (gentle)', 'Normal', 'Hard'] },
  { k: 'master', name: 'Master volume', vals: [0, 0.25, 0.5, 0.75, 1], pct: true },
  { k: 'music', name: 'Music volume', vals: [0, 0.25, 0.5, 0.75, 1, 1.25], pct: true },
  { k: 'sfx', name: 'Effects volume', vals: [0, 0.25, 0.5, 0.75, 1, 1.25], pct: true },
  { k: 'zoom', name: 'Camera distance', vals: [0.75, 0.85, 1, 1.15, 1.3, 1.5], labels: ['Very close', 'Close', 'Default', 'Far', 'Farther', 'Widest'] },
  { k: 'shake', name: 'Screen shake', vals: [0, 0.5, 1], labels: ['Off', 'Reduced', 'Full'] },
  { k: 'numbers', name: 'Damage numbers', vals: [true, false], labels: ['On', 'Off'] },
  { k: 'guide', name: 'Tutorial guide', vals: [true, false], labels: ['Shown', 'Hidden'] },
  { k: 'pixel', name: 'Pixel size', vals: [0, 2, 3, 4, 5], labels: ['Auto', 'Fine (2x)', 'Classic (3x)', 'Chunky (4x)', 'Huge (5x)'] },
  { k: 'quality', name: 'Shadows', vals: ['max', 'high', 'low'], labels: ['Max (4096)', 'High', 'Low (faster)'] },
  // ---- Pass 5
  { k: 'preset', name: 'Graphics preset', vals: ['low', 'default', 'high', 'max', 'custom'], labels: ['Low', 'Default', 'High', 'Max', 'Custom'], preset: true },
  { k: 'bloom', name: 'Bloom', vals: [0, 0.5, 1, 1.4], labels: ['Off', 'Soft', 'Normal', 'Strong'] },
  { k: 'fx', name: 'Particles / effects', vals: [0.35, 0.65, 1], labels: ['Light', 'Medium', 'Full'] },
  { k: 'questGuide', name: 'Quest tracker', vals: [true, false], labels: ['Shown', 'Hidden'] },
  { k: 'reducedMotion', name: 'Reduced UI motion', vals: [false, true], labels: ['Off', 'On'] },
  { k: 'hudScale', name: 'HUD scale', vals: [0.8, 0.9, 1, 1.15, 1.3], pct: true },
  { k: 'combatText', name: 'Combat text (SHATTER, CONDUCTED…)', vals: [true, false], labels: ['On', 'Off'] },
  { k: 'abilityLabels', name: 'Ability names on hotbar', vals: [false, true], labels: ['Off', 'On'] },
];
// Presets only touch settings that change rendering cost; everything stays individually adjustable.
export const PRESETS = {
  low: { quality: 'low', bloom: 0, fx: 0.35, pixel: 4 },
  default: { quality: 'high', bloom: 1, fx: 1, pixel: 0 },
  high: { quality: 'high', bloom: 1, fx: 1, pixel: 2 },
  max: { quality: 'max', bloom: 1.4, fx: 1, pixel: 2 },
};
export const DEFAULTS = { zoom: 1, difficulty: 'normal', master: 1, music: 1, sfx: 1, shake: 1, numbers: true, guide: true, pixel: 0, quality: 'high', preset: 'default', bloom: 1, fx: 1, hudScale: 1, combatText: true, abilityLabels: false, questGuide: true, reducedMotion: false };

export function loadSettings() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

export function applySettings(s, game) {
  setVolumes(s.master, s.music, s.sfx);
  const pr = game.pr;
  pr.shakeScale = s.shake;
  const scale = s.pixel || null;
  if (pr.forceScale !== scale) { pr.forceScale = scale; pr.resize(); }
  const sz = s.quality === 'low' ? 1024 : s.quality === 'max' ? 4096 : 2048;
  pr.postMat.uniforms.bloomScale.value = s.bloom ?? 1;
  if (game.fx) game.fx.density = s.fx ?? 1;
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--hud', s.hudScale ?? 1);
  if (game.sun.shadow.mapSize.x !== sz) { game.sun.shadow.mapSize.set(sz, sz); if (game.sun.shadow.map) { game.sun.shadow.map.dispose(); game.sun.shadow.map = null; } }
  document.documentElement.classList.toggle('reduce-motion', !!s.reducedMotion);
  game.settings = s;
  document.getElementById('guide') && document.getElementById('guide').classList.toggle('hidden', !s.guide || !game.guide || game.guide.finished);
}

export class SettingsPanel {
  constructor(el, game, onClose) { this.el = el; this.g = game; this.sel = 0; this.onClose = onClose; }
  label(o) {
    const v = this.g.settings[o.k];
    const i = o.vals.indexOf(v);
    if (o.labels) return o.labels[Math.max(0, i)];
    if (o.pct) return Math.round(v * 100) + '%';
    return String(v);
  }
  change(i, d) {
    const o = OPTS[i], s = this.g.settings;
    const idx = Math.max(0, o.vals.indexOf(s[o.k]));
    s[o.k] = o.vals[(idx + d + o.vals.length) % o.vals.length];
    if (o.preset && PRESETS[s.preset]) Object.assign(s, PRESETS[s.preset]);
    else if (['quality', 'bloom', 'fx', 'pixel'].includes(o.k)) s.preset = Object.keys(PRESETS).find(p => Object.entries(PRESETS[p]).every(([k, v]) => s[k] === v)) || 'custom';
    saveSettings(s); applySettings(s, this.g); sfx('select');
    this.render();
  }
  categoryOptions() {
    const groups = {
      Graphics: ['preset','pixel','quality','bloom','fx','zoom'],
      Audio: ['master','music','sfx'], Gameplay: ['difficulty','shake'],
      Interface: ['hudScale','numbers','combatText','guide','questGuide','abilityLabels','reducedMotion'], Controls: []
    };
    return groups[this.category || 'Graphics'].map(k => OPTS.findIndex(o => o.k === k));
  }
  render() {
    this.category ||= 'Graphics';
    const ids = this.categoryOptions();
    if (!ids.includes(this.sel)) this.sel = ids[0] ?? 0;
    this.el.innerHTML = `<div class="page-heading"><span class="page-kicker">Make yourself at home</span><h2>Settings</h2></div><div class="settings-layout"><nav class="settings-nav" aria-label="Settings categories">${['Graphics','Audio','Gameplay','Controls','Interface'].map(c => `<button data-category="${c}" class="${c === this.category ? 'on' : ''}">${c}</button>`).join('')}</nav><div class="settings-options">${this.category === 'Controls' ? controlsHTML() : ids.map(i => {
      const o = OPTS[i];
      return `<div class="setrow ${i === this.sel ? 'on' : ''}" data-i="${i}"><label for="setting-${o.k}">${o.name}</label>${['master','music','sfx','hudScale'].includes(o.k) ? `<input id="setting-${o.k}" type="range" min="0" max="${o.vals.length-1}" step="1" value="${Math.max(0,o.vals.indexOf(this.g.settings[o.k]))}" aria-label="${o.name}"><output>${this.label(o)}</output>` : `<select id="setting-${o.k}" aria-label="${o.name}">${o.vals.map((v,j)=>`<option value="${j}" ${v === this.g.settings[o.k] ? 'selected' : ''}>${o.labels ? o.labels[j] : o.pct ? Math.round(v*100)+'%' : String(v)}</option>`).join('')}</select>`}</div>`;
    }).join('')}<p class="setnote">Changes apply immediately and are saved on this device.${this.onClose ? ' Esc to return.' : ''}</p></div></div>`;
    this.el.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{this.category=b.dataset.category;this.render();});
    this.el.querySelectorAll('.setrow').forEach(row=>{
      const i=+row.dataset.i, control=row.querySelector('input,select');
      control.onchange=()=>{this.sel=i;const old=Math.max(0,OPTS[i].vals.indexOf(this.g.settings[OPTS[i].k]));this.change(i,+control.value-old);};
    });
  }
  update(input) {
    const ids=this.categoryOptions();
    if(ids.length){
      let pos=Math.max(0,ids.indexOf(this.sel));
      if(input.pressed('up')){this.sel=ids[(pos+ids.length-1)%ids.length];this.render();}
      if(input.pressed('down')){this.sel=ids[(pos+1)%ids.length];this.render();}
      if(input.pressed('left'))this.change(this.sel,-1);
      if(input.pressed('right')||input.pressed('interact'))this.change(this.sel,1);
    }
    if(this.onClose&&(input.pressed('pause')||input.pressed('shield'))){input.consume('pause');this.onClose();}
  }
}
