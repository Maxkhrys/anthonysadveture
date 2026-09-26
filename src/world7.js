// World pass runtime: the object types of the new Thimblewick, the Clockwork Garden and the
// Rootlight Caverns; the discovery moment; the map waypoint. Installed onto Game like world6.
// New save data is namespaced: persistent puzzle state uses signals ('sig:w7:*' flags), the
// waypoint lives in flags['w7:waypoint'], discoveries extend world6.discovery (no new database).
import * as THREE from 'three';
import { Entity } from './entities/entity.js';
import { Arena } from './entities/objects.js';
import { mesh, B, MAT_GLOW } from './models.js';
import { sfx, playTone } from './engine/audio.js';
import { REGIONS } from './world/layout.js';
import { dropPips } from './entities/common.js';

export const CLOCK_LEVERS = ['A', 'B', 'C'];
export const BLOOMS = ['hall', 'seam', 'lake'];
const leverSig = id => 'w7:cg.lever.' + id;
const bloomSig = id => 'w7:rl.bloom.' + id;

// ---------------------------------------------------------------- the Clockwork Garden
class GearLever extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.interactable = true; this.solid = true; this.hw = 0.35; this.hd = 0.35;
    this.obj.add(mesh([B(0.9, 0.5, 0.7, 0, 0, 0, 0x8a6428), B(0.7, 0.14, 0.5, 0, 0.5, 0, 0xb88a3a), B(0.5, 0.3, 0.12, 0, 0.62, 0.3, 0xd8aa4a)]));
    this.arm = mesh([B(0.12, 0.9, 0.12, 0, 0, 0, 0x4a4a52), B(0.26, 0.2, 0.26, 0, 0.9, 0, 0xc0503a)]); this.arm.position.set(0, 0.6, 0); this.obj.add(this.arm);
    this.thrown = g.signal(leverSig(d.id)); this.k = this.thrown ? 1 : 0;
  }
  get prompt() { return this.thrown ? null : 'Throw ' + this.d.name; }
  interact() {
    const g = this.g; if (this.thrown) return;
    this.thrown = true; g.setSignal(leverSig(this.d.id), true, true);
    sfx('switch'); sfx('clang'); g.pr.addShake(0.2);
    const n = CLOCK_LEVERS.filter(id => g.signal(leverSig(id))).length;
    g.ui.toast('Winding lever ' + n + ' / 3', n < 3 ? 'Somewhere under the garden, a spring tightens.' : 'The old clock shudders…', 2.6);
    g.stats.w7Levers = n;
    if (n >= 3 && !g.signal('w7:cg.wound')) setTimeout(() => g.windClock && g.windClock(), 900);
    g.save();
  }
  update(dt) { this.k += ((this.thrown ? 1 : 0) - this.k) * Math.min(1, dt * 6); this.arm.rotation.x = -0.9 + this.k * 1.8; }
}
class ClockHands extends Entity {
  constructor(g, d) {
    super(g, d.x, d.z); this.solid = false; this.y0 = d.y || 6;
    const hour = mesh([B(0.4, 2.8, 0.14, 0, 0, 0, 0x2a2438), B(0.6, 0.6, 0.14, 0, 2.5, 0, 0x2a2438)]), minute = mesh([B(0.28, 4.4, 0.12, 0, 0, 0.08, 0x3a3048), B(0.44, 0.44, 0.12, 0, 4.1, 0.08, 0x3a3048)]);
    for (const h of [hour, minute]) { h.position.set(0, this.y0 + 1.4, 0.55); this.obj.add(h); }
    this.hour = hour; this.minute = minute; this.spin = 0;
    // the minute hand is the one lying on the lawn: an unwound clock shows only its hour hand
    this.minute.visible = g.signal('w7:cg.wound');
    this.hour.rotation.z = -2.3;
  }
  update(dt) {
    const g = this.g, wound = g.signal('w7:cg.wound');
    this.spin = Math.max(0, this.spin - dt);
    if (wound) {
      this.minute.visible = true;
      const t = g.time * (this.spin > 0 ? 4 : 0.02);
      this.minute.rotation.z = -t; this.hour.rotation.z = -2.3 - t / 12;
    }
  }
}
class Wicket extends Entity { // a one-way latch: lift it from the far side and the gate stays open
  constructor(g, d) { super(g, d.x, d.z); this.d = d; this.interactable = true; this.solid = false; this.obj.add(mesh([B(0.2, 0.9, 0.2, 0, 0, 0, 0x6a4a2a), B(0.5, 0.14, 0.14, 0.15, 0.7, 0, 0x8a8a90)])); }
  get prompt() { return this.g.signal(this.d.signal) ? null : this.d.label; }
  interact() { const g = this.g; if (g.signal(this.d.signal)) return; g.setSignal(this.d.signal, true, true); sfx('secret'); g.ui.toast('Shortcut opened', 'The wicket gate will stay open from now on.', 2.4); g.stats.shortcuts = (g.stats.shortcuts || 0) + 1; g.save(); }
}

// ---------------------------------------------------------------- the Rootlight Caverns
class GlowBloom extends Entity { // a dormant lumen bloom: strike or touch it and it wakes, for good
  constructor(g, d) {
    super(g, d.x, d.z); this.d = d; this.interactable = true; this.solid = true; this.hw = 0.45; this.hd = 0.45; this.isBloom = true;
    this.obj.add(mesh([B(0.25, 1.1, 0.25, 0, 0, 0, 0x4a6a58), B(0.8, 0.12, 0.3, 0.2, 0.5, 0, 0x3f7a5a, 0, 0, -0.4), B(0.7, 0.12, 0.3, -0.2, 0.7, 0, 0x3f7a5a, 0, 0, 0.4)]));
    this.head = mesh([B(0.9, 0.5, 0.9, 0, 0, 0, 0x6a9a8a), B(0.5, 0.3, 0.5, 0, 0.5, 0, 0x8ac8b8)], MAT_GLOW, false); this.head.position.y = 1.1; this.obj.add(this.head);
    this.light = new THREE.PointLight(0x9af0e0, 0, 9, 1.6); this.light.position.y = 1.6; this.obj.add(this.light);
    this.lit = g.signal(bloomSig(d.id)); this.k = this.lit ? 1 : 0;
  }
  get prompt() { return this.lit ? null : 'Wake the lumen bloom'; }
  onHit() { this.wake(); return 'hit'; }
  interact() { this.wake(); }
  wake() {
    const g = this.g; if (this.lit) return;
    this.lit = true; g.setSignal(bloomSig(this.d.id), true, true);
    sfx('chime'); g.fx.ring(this.x, this.z, 0.2, 3.2, 0x9af0e0, 0.6); g.fx.burst(this.x, 1.2, this.z, 24, [0x9af0e0, 0xe8fffb, 0xc8b0ff], 3);
    const n = BLOOMS.filter(id => g.signal(bloomSig(id))).length;
    g.ui.toast('Lumen bloom ' + n + ' / 3', n < 3 ? 'Light runs along the roots.' : 'Every bloom is awake. Far to the west, the roots part.', 2.8);
    if (n >= 3 && !g.signal('w7:rl.lit')) { g.setSignal('w7:rl.lit', true, true); setTimeout(() => { sfx('secret'); g.ui.banner && g.ui.banner('THE OLD ROUTE', 'The Hanging Roots open', 2.2); }, 800); }
    g.save();
  }
  update(dt) {
    this.k += ((this.lit ? 1 : 0) - this.k) * Math.min(1, dt * 2);
    const pulse = 0.85 + Math.sin(this.g.time * 2 + this.x) * 0.15;
    this.light.intensity = this.k * 2.4 * pulse;
    this.head.scale.setScalar(0.7 + this.k * 0.5);
    this.head.material = MAT_GLOW; this.head.visible = true;
    if (this.k > 0.5 && Math.random() < 0.2) this.g.fx.add({ x: this.x + (Math.random() - 0.5), y: 1.4 + Math.random(), z: this.z + (Math.random() - 0.5), vy: 0.4, g: 0, color: 0x9af0e0, life: 0.8, size: 0.05 });
  }
}
class RootLift extends Entity { // the lift between the caverns (lever below) and Thimblewick's garden
  constructor(g, d) { super(g, d.x, d.z); this.d = d; this.interactable = true; this.solid = false; }
  get prompt() { const g = this.g; if (this.d.below) return g.signal('w7:rootlift') ? 'Ride the Root Lift up' : 'Pull the lift lever'; return g.signal('w7:rootlift') ? 'Ride the Root Lift down' : 'Try the lift'; }
  interact() {
    const g = this.g;
    if (this.d.below) {
      if (!g.signal('w7:rootlift')) { g.setSignal('w7:rootlift', true, true); sfx('secret'); g.ui.toast('Shortcut: the Root Lift', 'It runs between the caverns and Thimblewick\'s Hedge Garden now.', 3); g.stats.shortcuts = (g.stats.shortcuts || 0) + 1; }
      sfx('chainpull'); g.save(); return g.warpTo('overworld', 'rootlift');
    }
    if (!g.signal('w7:rootlift')) { g.ui.say(null, 'The cage is wound tight into the roots. The lever must be at the bottom — wherever the roots go.'); return; }
    sfx('chainpull'); g.warpTo('rootlight', 'lift');
  }
}

// ---------------------------------------------------------------- install
export function installWorld7(Game) {
  const P = Game.prototype, base = P.spawnDef6;
  P.spawnDef6 = function (d) {
    switch (d.type) {
      case 'gearlever': return new GearLever(this, d);
      case 'clockhands': return new ClockHands(this, d);
      case 'wicket7': return new Wicket(this, d);
      case 'glowbloom': return new GlowBloom(this, d);
      case 'rootlift': return new RootLift(this, d);
      case 'arena7': {
        const g = this, lvl = g.zoneLevel(d.x, d.z);
        const A = new Arena(g, { id: d.id, x: d.x, z: d.z, radius: d.radius }, d.waves, { title: d.title, victory: 'The way is clear.', eliteChance: 0.05, onClear: () => { g.dropGear(d.x, d.z, { level: lvl + 1, floor: 2, bonus: 0.8 }); g.gainXp(60 + lvl * 20); g.save(); } });
        A.alwaysUpdate = true; return A;
      }
    }
    return base.call(this, d);
  };
  // all three levers: the Great Clock strikes, the Mainspring Gate opens
  P.windClock = function () {
    if (this.signal('w7:cg.wound')) return;
    this.setSignal('w7:cg.wound', true, true);
    const hands = this.entities.find(e => e instanceof ClockHands); if (hands) hands.spin = 4;
    [52, 57, 60, 64, 60, 57].forEach((n, i) => setTimeout(() => playTone && playTone(n), i * 420));
    this.pr.addShake(0.4); this.ui.banner && this.ui.banner('THE GREAT CLOCK STRIKES', 'The Mainspring Gate opens', 2.6);
    this.stats.shortcuts = (this.stats.shortcuts || 0) + 1;
    this.save();
  };

  // ---------------------------------------------------------------- discovery moments
  // One queue. A reveal waits while you fight, talk or watch a scene; it never pauses play,
  // moves the camera or covers the middle of the screen.
  P.announceRegion = function (id) {
    const R = REGIONS[id]; if (!R) return;
    (this.revealQ || (this.revealQ = [])).push({ id, name: R.name, major: !!R.major, level: R.level });
  };
  P.world7Tick = function (dt) {
    const q = this.revealQ; if (!q || !q.length) return;
    const p = this.player, busy = this.cutscene || this.ui.talking || this.bossActive || (p && p.combatT > 0.5) || this.dead || this.ui.invOpen;
    if (busy) return;
    this.revealWait = (this.revealWait || 0) - dt; if (this.revealWait > 0) return;
    const r = q.shift(); this.revealWait = 3.5;
    const mode = (this.settings && this.settings.discovery) || 'full';
    this.stats.discoveries = (this.stats.discoveries || 0) + 1;
    if (mode === 'off') return;
    if (mode === 'subtle' || !this.ui.showReveal) { sfx('secret'); this.ui.toast('Discovered: ' + r.name, 'Added to your map and journal.', 2.6); return; }
    // a short bell-like cue from the existing tone generator, then the parchment card
    [72, 79, 76].forEach((n, i) => setTimeout(() => playTone && playTone(n), i * 180));
    this.ui.showReveal(r);
  };
}

// the Rootlight / Clockwork quest-ish state, read by the journal and tests
export function regionState(g) {
  return {
    levers: CLOCK_LEVERS.filter(id => g.signal(leverSig(id))),
    wound: g.signal('w7:cg.wound'), wicket: g.signal('w7:cg.wicket'), bells: g.signal('w7:cg.bells'),
    blooms: BLOOMS.filter(id => g.signal(bloomSig(id))), lit: g.signal('w7:rl.lit'), lift: g.signal('w7:rootlift'),
  };
}
