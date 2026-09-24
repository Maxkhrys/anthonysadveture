// Persistent settings with a keyboard/mouse-driven panel.
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
export const DEFAULTS = { zoom: 1, difficulty: 'normal', master: 1, music: 1, sfx: 1, shake: 1, numbers: true, guide: true, pixel: 0, quality: 'high', preset: 'default', bloom: 1, fx: 1, hudScale: 1, combatText: true, abilityLabels: false };

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
  render() {
    this.el.innerHTML = (this.onClose ? '<h3>Settings</h3>' : '') + OPTS.map((o, i) => `<div class="setrow ${i === this.sel ? 'on' : ''}" data-i="${i}"><span>${o.name}</span><span class="val">${this.label(o)}</span></div>`).join('') +
      `<div class="setnote">W/S select · A/D change${this.onClose ? ' · Esc back' : ''} · Keys: WASD move, J attack, K guard, Space roll, 1-6 abilities, L tool, E interact, I bag, Q tonic, R surge</div>`;
    this.el.querySelectorAll('.setrow').forEach(r => {
      const i = +r.dataset.i;
      r.onclick = e => { this.sel = i; this.change(i, e.shiftKey ? -1 : 1); };
      r.oncontextmenu = e => { e.preventDefault(); this.sel = i; this.change(i, -1); };
    });
  }
  update(input) {
    if (input.pressed('up')) { this.sel = (this.sel + OPTS.length - 1) % OPTS.length; sfx('select'); this.render(); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % OPTS.length; sfx('select'); this.render(); }
    if (input.pressed('left')) this.change(this.sel, -1);
    if (input.pressed('right') || input.pressed('interact')) this.change(this.sel, 1);
    if (this.onClose && (input.pressed('pause') || input.pressed('shield'))) { input.consume('pause'); this.onClose(); }
  }
}
