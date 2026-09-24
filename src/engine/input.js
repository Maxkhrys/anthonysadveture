// Unified keyboard / mouse / gamepad input with edge detection.
const KEYMAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'], shield: ['KeyK'], roll: ['Space', 'ShiftLeft', 'ShiftRight'], item: ['KeyL'],
  interact: ['KeyE', 'Enter'], surge: ['KeyR'], potion: ['KeyQ'], pause: ['Escape', 'Tab', 'KeyP'], music: ['KeyM'],
  ab1: ['Digit1', 'Numpad1', 'KeyU'], ab2: ['Digit2', 'Numpad2', 'KeyO'], ab3: ['Digit3', 'Numpad3', 'KeyH'], inventory: ['KeyI', 'KeyB'], salvage: ['KeyX', 'Delete'],
};
const PAD = { attack: 2, roll: 0, interact: 1, item: 3, shield: [4, 6], surge: [5, 7], pause: 9, potion: 8 };

export class Input {
  constructor() {
    this.keys = new Set();
    this.taps = new Set(); // keys pressed since last update (so quick taps are never lost)
    this.mouse = new Set(); this.mtaps = new Set();
    this.state = {}; this.prev = {};
    this.mx = 0; this.mz = 0;
    this.usingPad = false;
    addEventListener('keydown', e => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.taps.add(e.code); this.usingPad = false;
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
    const cv = document.getElementById('game');
    cv.addEventListener('mousedown', e => { this.mouse.add(e.button); this.mtaps.add(e.button); e.preventDefault(); });
    addEventListener('mouseup', e => this.mouse.delete(e.button));
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }
  update() {
    this.prev = this.state;
    const s = {};
    for (const k in KEYMAP) s[k] = KEYMAP[k].some(c => this.keys.has(c) || this.taps.has(c));
    if (this.mouse.has(0) || this.mtaps.has(0)) s.attack = true;
    if (this.mouse.has(2) || this.mtaps.has(2)) s.shield = true;
    // a tap that was already released counts as pressed this frame, released the next
    this.taps.clear(); this.mtaps.clear();
    let mx = (s.right ? 1 : 0) - (s.left ? 1 : 0), mz = (s.down ? 1 : 0) - (s.up ? 1 : 0);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0, az = p.axes[1] || 0;
      if (Math.hypot(ax, az) > 0.25) { mx = ax; mz = az; this.usingPad = true; }
      const b = i => p.buttons[i] && p.buttons[i].pressed;
      if (b(12)) { mz = -1; s.up = true; } if (b(13)) { mz = 1; s.down = true; }
      if (b(14)) { mx = -1; s.left = true; } if (b(15)) { mx = 1; s.right = true; }
      if (az < -0.5) s.up = true; if (az > 0.5) s.down = true;
      for (const k in PAD) {
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
