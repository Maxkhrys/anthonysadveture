// Butterflies over the meadows: little two-winged models that flit around flower tiles near the
// camera by day, settle on the ground now and then with their wings slowly opening and closing,
// and scatter when the hero runs through them. They leave at dusk and hide from the rain.
// Bird flocks: now and then a V of small birds crosses high over the view, wings beating then
// gliding, and their real sun shadows sweep over the land below them.
import * as THREE from 'three';
import { T } from './world/tiles.js';

const N = 12;
const COLS = [0xffd25e, 0xf06a8a, 0x9ad8ff, 0xfff6e8, 0xf49a3a, 0xc89aff];

function wing(w, h, col, dz) {
  const g = new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2).translate(w / 2, 0, dz);
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
}

function butterfly(col) {
  const root = new THREE.Group(), trim = new THREE.Color(col).multiplyScalar(0.62);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), new THREE.MeshLambertMaterial({ color: 0x2a1d14 }));
  root.add(body);
  const L = new THREE.Group(), R = new THREE.Group();
  L.add(wing(0.1, 0.09, col, -0.025), wing(0.075, 0.06, trim, 0.045));
  R.add(wing(0.1, 0.09, col, -0.025), wing(0.075, 0.06, trim, 0.045)); R.scale.x = -1;
  root.add(L, R);
  return { root, L, R };
}

function bird() {
  const root = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x3a3440 });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.3), mat));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.08), mat); head.position.set(0, 0.02, 0.18); root.add(head);
  const L = new THREE.Group(), R = new THREE.Group();
  const w = () => new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.13).translate(0.17, 0, -0.02), mat);
  L.add(w()); R.add(w()); R.scale.x = -1; L.position.x = 0.04; R.position.x = -0.04;
  root.add(L, R);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, L, R };
}

export class Critters {
  constructor(g) {
    this.g = g; this.t = 0;
    this.group = new THREE.Group(); this.group.name = 'critters';
    this.list = [];
    for (let i = 0; i < N; i++) {
      const b = butterfly(COLS[i % COLS.length]); b.root.scale.setScalar(1.7);
      b.root.visible = false;
      this.group.add(b.root);
      this.list.push({ ...b, on: false, x: 0, y: 0, z: 0, hx: 0, hz: 0, tx: 0, ty: 0, tz: 0, rest: 0, retarget: 0, ph: Math.random() * 6, speed: 1 });
    }
    this.flock = null; this.flockT = 6;
    this.birds = [];
    for (let i = 0; i < 7; i++) { const b = bird(); b.root.visible = false; this.group.add(b.root); this.birds.push({ ...b, ph: Math.random() * 6 }); }
  }
  // a V of birds crossing high over the view; their shadows follow on the ground
  launchFlock() {
    const c = this.g.cam, a = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.2 + (Math.random() < 0.5 ? Math.PI : 0);
    const dx = Math.cos(a), dz = Math.sin(a), n = 3 + Math.floor(Math.random() * 5);
    this.flock = { x: c.x - dx * 26 + (Math.random() - 0.5) * 10, z: c.z - dz * 22 + (Math.random() - 0.5) * 8, dx, dz, y: 4.2 + Math.random() * 1.5, n, t: 0, sp: 4.2 + Math.random() * 1.2 };
  }
  updateBirds(dt, out) {
    const g = this.g, fx = (g.pr && g.pr.worldFx) || {};
    const freq = fx.birds ?? 0.3;
    if (!this.flock) {
      this.flockT -= dt;
      if (this.flockT <= 0) { this.flockT = (14 + Math.random() * 22) / Math.max(0.2, freq * 3); if (!out && freq > 0) this.launchFlock(); }
    }
    if (out && this.flock) this.flock = null;
    const F = this.flock;
    this.birds.forEach((b, i) => {
      if (!F || i >= F.n) { b.root.visible = false; return; }
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      // V formation behind the leader, each bird drifting a little in its slot
      const bx = F.x - F.dx * row * 0.9 + (-F.dz) * side * row * 0.75 + Math.sin(F.t * 0.8 + b.ph) * 0.15;
      const bz = F.z - F.dz * row * 0.9 + F.dx * side * row * 0.75 + Math.cos(F.t * 0.7 + b.ph) * 0.15;
      b.root.visible = true;
      b.root.position.set(bx, F.y + Math.sin(F.t * 1.3 + b.ph) * 0.12, bz);
      b.root.rotation.y = Math.atan2(F.dx, F.dz);
      // beat, beat, glide
      const cyc = (F.t * 1.1 + b.ph * 0.2) % 2, flap = cyc < 1.2 ? Math.sin(cyc * Math.PI * 5) * 0.75 : 0.12;
      b.L.rotation.z = flap; b.R.rotation.z = -flap;
    });
    if (F) {
      F.t += dt; F.x += F.dx * F.sp * dt; F.z += F.dz * F.sp * dt;
      if (Math.abs(F.x - g.cam.x) > 34 || Math.abs(F.z - g.cam.z) > 30) this.flock = null;
    }
  }
  daylight() {
    const d = this.g.dayT ?? 0.35;
    return Math.max(0, Math.min(1, Math.sin((d - 0.2) * Math.PI * 2) * 1.4 + 0.45));
  }
  // a flower tile near the camera (falls back to grass now and then)
  home() {
    const g = this.g, c = g.cam;
    for (let k = 0; k < 24; k++) {
      const x = Math.floor(c.x + (Math.random() - 0.5) * 24), z = Math.floor(c.z + (Math.random() - 0.5) * 17), t = g.tileAt(x, z);
      if (t === T.FLOWERS || (k > 16 && t === T.GRASS)) return { x: x + 0.5, z: z + 0.5 };
    }
    return null;
  }
  pickTarget(b) {
    const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 1.4;
    b.tx = b.hx + Math.cos(a) * r; b.tz = b.hz + Math.sin(a) * r;
    b.ty = 0.25 + Math.random() * 0.7;
    b.retarget = 0.6 + Math.random() * 1.4;
  }
  update(dt) {
    const g = this.g;
    if (!g.scene || !g.cam) return;
    if (this.group.parent !== g.scene) g.scene.add(this.group);
    this.t += dt;
    const out = !g.area || g.area.id !== 'overworld' || this.daylight() < 0.55 || (g.rainK || 0) > 0.3;
    const want = out ? 0 : Math.round(N * Math.min(1, g.fx ? g.fx.density ?? 1 : 1));
    this.updateBirds(dt, !g.area || g.area.id !== 'overworld' || this.daylight() < 0.4 || (g.rainK || 0) > 0.5);
    const p = g.player;
    this.list.forEach((b, i) => {
      const far = Math.abs(b.x - g.cam.x) > 15 || Math.abs(b.z - g.cam.z) > 11;
      if (b.on && (i >= want || far)) { b.on = false; b.root.visible = false; }
      if (!b.on && i < want && Math.random() < dt * 0.6) {
        const h = this.home(); if (!h) return;
        b.hx = h.x; b.hz = h.z; b.x = h.x + (Math.random() - 0.5); b.z = h.z + (Math.random() - 0.5); b.y = 0.5 + Math.random() * 0.4;
        b.on = true; b.rest = 0; b.root.visible = true; this.pickTarget(b);
      }
      if (!b.on) return;
      const gy = g.groundAt ? g.groundAt(b.x, b.z) : 0;
      // the hero running through the meadow scatters them
      const pd = p ? Math.hypot(p.x - b.x, p.z - b.z) : 9;
      if (pd < 0.9 && b.rest > 0) { b.rest = 0; b.ty = 0.8 + Math.random() * 0.4; b.tx = b.x + (b.x - p.x) * 2; b.tz = b.z + (b.z - p.z) * 2; b.retarget = 1; }
      let flap;
      if (b.rest > 0) {
        // settled: wings fold up and open slowly
        b.rest -= dt; b.y += (gy + 0.03 - b.y) * Math.min(1, dt * 8);
        flap = 0.9 + Math.sin(this.t * 1.6 + b.ph) * 0.55;
        if (b.rest <= 0) { b.ty = 0.5; this.pickTarget(b); }
      } else {
        b.retarget -= dt;
        if (b.retarget <= 0) {
          if (Math.random() < 0.18 && pd > 1.5) { b.tx = b.x; b.tz = b.z; b.ty = 0; b.rest = 2 + Math.random() * 4; }
          else this.pickTarget(b);
        }
        const dx = b.tx - b.x, dz = b.tz - b.z, dl = Math.hypot(dx, dz) || 1, sp = 1.1;
        b.x += dx / dl * Math.min(dl, sp * dt) + Math.sin(this.t * 5 + b.ph) * dt * 0.35;
        b.z += dz / dl * Math.min(dl, sp * dt) + Math.cos(this.t * 4.3 + b.ph) * dt * 0.35;
        // bobbing flight: every wingbeat lifts it a little
        const ty = gy + b.ty + Math.sin(this.t * 13 + b.ph) * 0.05;
        b.y += (ty - b.y) * Math.min(1, dt * 4);
        if (dl > 0.05) b.root.rotation.y = Math.atan2(dx, dz);
        flap = Math.abs(Math.sin(this.t * 16 + b.ph)) * 1.25;
      }
      b.L.rotation.z = flap; b.R.rotation.z = -flap;
      b.root.position.set(b.x, b.y, b.z);
    });
  }
}
