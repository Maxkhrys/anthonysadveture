// Unified keyboard / mouse / gamepad input with edge detection.
import { KEYMAP } from './actions.js';
const PAD = { attack: 2, roll: 0, interact: 1, item: 3, shield: [4], secondary: [7], surge: [5], pause: 9, potion: 8 };
// Holding LT (button 6) switches the face and shoulder buttons to the six ability slots:
// X/Y/B/A = slots 1-4, LB/RB = slots 5-6. Release LT for normal controls.
const PAD_LAYER = { ab1: 2, ab2: 3, ab3: 1, ab4: 0, ab5: 4, ab6: 5 };

export class Input {
  constructor() {
    this.keys = new Set();
    this.taps = new Set(); // keys pressed since last update (so quick taps are never lost)
    this.mouse = new Set(); this.mtaps = new Set();
    this.state = {}; this.prev = {};
    this.mx = 0; this.mz = 0;
    this.usingPad = false;
    // aiming: the last-used source wins ('mouse', 'pad' or 'keys')
    this.aimSrc = 'keys'; this.mouseX = innerWidth / 2; this.mouseY = innerHeight / 2; this.onCanvas = false;
    this.padAim = null; // {x,z} unit vector from the right stick
    this.aimPref = 'auto';
    this.paused = false;
    addEventListener('keydown', e => {
      if (this.paused) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) {
        if (e.code !== 'Escape') return;
        e.target.blur();
      }
      if (e.code === 'Tab') {
        const dialog = document.querySelector('#dialog:not(.hidden)');
        const screen = dialog || document.querySelector('.screen:not(.hidden):not(#title)');
        if (screen) {
          const nodes = [...screen.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"],a')].filter(el => el.getClientRects().length);
          if(nodes.length) { e.preventDefault(); const i=nodes.indexOf(document.activeElement); nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length].focus(); }
          return;
        }
      }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.taps.add(e.code); this.usingPad = false;
      // attacking from the keyboard (C) is an intentional switch to keyboard aiming
      if (e.code === 'KeyC' && this.aimPref !== 'mouse') this.aimSrc = 'keys';
    });
    addEventListener('keyup', e => { if (!this.paused) this.keys.delete(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.taps.clear(); this.mouse.clear(); this.mtaps.clear(); });
    const cv = document.getElementById('game');
    cv.addEventListener('mousedown', e => { if (this.paused) return; this.mouse.add(e.button); this.mtaps.add(e.button); this.mouseAt(e); if (this.aimPref !== 'keys') this.aimSrc = 'mouse'; e.preventDefault(); });
    addEventListener('mousemove', e => {
      const moved = Math.hypot(e.clientX - this.mouseX, e.clientY - this.mouseY);
      this.mouseAt(e);
      if (moved > 3 && this.aimPref !== 'keys') this.aimSrc = 'mouse';
    });
    cv.addEventListener('mouseleave', () => { this.onCanvas = false; });
    cv.addEventListener('mouseenter', () => { this.onCanvas = true; });
    addEventListener('mouseup', e => this.mouse.delete(e.button));
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }
  mouseAt(e) { this.mouseX = e.clientX; this.mouseY = e.clientY; this.onCanvas = true; }
  get mouseAim() { return this.aimSrc === 'mouse' && this.aimPref !== 'keys'; }
  update() {
    if (this.paused) {
      this.keys.clear(); this.taps.clear(); this.mouse.clear(); this.mtaps.clear();
      this.prev = this.state || {}; this.state = {}; this.mx = 0; this.mz = 0;
      return;
    }
    this.prev = this.state;
    const s = {};
    for (const k in KEYMAP) s[k] = KEYMAP[k].some(c => this.keys.has(c) || this.taps.has(c));
    if (this.mouse.has(0) || this.mtaps.has(0)) s.attack = true;
    // right click is the weapon's secondary attack (guard/parry lives on Q / LB)
    if (this.mouse.has(2) || this.mtaps.has(2)) s.secondary = true;
    // a tap that was already released counts as pressed this frame, released the next
    this.taps.clear(); this.mtaps.clear();
    let mx = (s.right ? 1 : 0) - (s.left ? 1 : 0), mz = (s.down ? 1 : 0) - (s.up ? 1 : 0);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.padAim = null;
    for (const p of pads) {
      if (!p) continue;
      const rx = p.axes[2] || 0, rz = p.axes[3] || 0, rl = Math.hypot(rx, rz);
      if (rl > 0.35) { this.padAim = { x: rx / rl, z: rz / rl }; this.aimSrc = 'pad'; this.usingPad = true; }
      const ax = p.axes[0] || 0, az = p.axes[1] || 0;
      if (Math.hypot(ax, az) > 0.25) { mx = ax; mz = az; this.usingPad = true; }
      const b = i => p.buttons[i] && p.buttons[i].pressed;
      if (b(12)) { mz = -1; s.up = true; } if (b(13)) { mz = 1; s.down = true; }
      if (b(14)) { mx = -1; s.left = true; } if (b(15)) { mx = 1; s.right = true; }
      if (az < -0.5) s.up = true; if (az > 0.5) s.down = true;
      const layer = b(6);
      this.padLayer = layer;
      if (layer) { for (const k in PAD_LAYER) if (b(PAD_LAYER[k])) { s[k] = true; this.usingPad = true; } if (b(9)) s.pause = true; if (b(8)) s.potion = true; }
      else for (const k in PAD) {
        const v = PAD[k];
        if (Array.isArray(v) ? v.some(b) : b(v)) { s[k] = true; this.usingPad = true; }
      }
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    this.mx = mx; this.mz = mz;
    this.state = s;
  }
  down(k) { return !!this.state[k]; }
  pressed(k) { return !!this.state[k] && !this.prev[k]; }
  released(k) { return !this.state[k] && !!this.prev[k]; }
  consume(k) { this.prev[k] = true; }
}
