// Unified keyboard / mouse / gamepad input with edge detection.
import { KEYMAP } from './actions.js';
import {readPad,padActions} from './controller.js';

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
      // Native control activation must not also become an attack/equip command.
      if(['Enter','Space'].includes(e.code)&&e.target.closest?.('button,[role=button],a'))return;
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
      this.keys.add(e.code); this.taps.add(e.code); this.usingPad = false; this.padDisconnected=false;
      // attacking from the keyboard (C) is an intentional switch to keyboard aiming
      if (e.code === 'KeyC' && this.aimPref !== 'mouse') this.aimSrc = 'keys';
    });
    addEventListener('keyup', e => { if (!this.paused) this.keys.delete(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.taps.clear(); this.mouse.clear(); this.mtaps.clear(); });
    const cv = document.getElementById('game');
    cv.addEventListener('mousedown', e => { if (this.paused) return; this.mouse.add(e.button); this.mtaps.add(e.button); this.mouseAt(e); this.usingPad=false; if (this.aimPref !== 'keys') this.aimSrc = 'mouse'; e.preventDefault(); });
    addEventListener('mousemove', e => {
      const moved = Math.hypot(e.clientX - this.mouseX, e.clientY - this.mouseY);
      this.mouseAt(e);
      if(moved>3)this.usingPad=false;
      if (moved > 3 && this.aimPref !== 'keys') this.aimSrc = 'mouse';
    });
    cv.addEventListener('mouseleave', () => { this.onCanvas = false; });
    cv.addEventListener('mouseenter', () => { this.onCanvas = true; });
    addEventListener('mouseup', e => this.mouse.delete(e.button));
    cv.addEventListener('contextmenu', e => e.preventDefault());
    this.wheel = 0; // accumulated wheel notches (Survival build mode reads and clears it)
    addEventListener('wheel', e => { if (!this.paused && !e.target.closest?.('.sv-sheet,.screen:not(.hidden),.panel,#title')) this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }
  mouseAt(e) { this.mouseX = e.clientX; this.mouseY = e.clientY; this.onCanvas = true; }
  get mouseAim() { return this.aimSrc === 'mouse' && this.aimPref !== 'keys'; }
  update() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(p=>p?.connected!==false&&p?.mapping==='standard') : [];
    const pad = pads.find(p=>readPad(p).active)||pads.find(p=>p.index===this.padIndex)||pads[0];
    this.padDisconnected=!!this.padConnected&&!pad;this.padConnected=!!pad;this.padIndex=pad?.index;
    this.padRaw=pad?readPad(pad):null;this.padLayer=!!this.padRaw?.buttons[6];
    if(this.padRaw?.active)this.usingPad=true;
    if(!pad){this.padAim=null;this.padLayer=false;}

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
    this.padAim = null;
    if(this.padRaw){
      const raw=this.padRaw, [ax,az]=raw.move,[rx,rz]=raw.aim;
      if(ax||az){mx=ax;mz=az;this.usingPad=true;}
      if(rx||rz){const n=Math.hypot(rx,rz);this.padAim={x:rx/n,z:rz/n};this.aimSrc='pad';}
      if(!raw.buttons.some(Boolean))this.suppressPadUntilRelease=false;
      const actions=this.suppressPadUntilRelease?{}:padActions(raw);for(const k in actions)if(actions[k])s[k]=true;
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
