// Particles, sword arcs, shockwaves and ambient motes.
import * as THREE from 'three';

const MAX = 1400;
export class FX {
  constructor(scene) {
    this.scene = scene;
    const g = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.p = [];
    this.arcs = [];
    this.rings = [];
    this._m = new THREE.Matrix4(); this._c = new THREE.Color(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3();
    this.ambient = null; this.ambientT = 0;
  }
  clear() { this.p.length = 0; for (const a of this.arcs) this.scene.remove(a.m); this.arcs.length = 0; for (const r of this.rings) this.scene.remove(r.m); this.rings.length = 0; }
  add(o) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push({ x: o.x, y: o.y ?? 0.3, z: o.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, life: o.life ?? 0.6, max: o.life ?? 0.6,
      size: o.size ?? 0.08, color: new THREE.Color(o.color ?? 0xffffff), g: o.g ?? 6, drag: o.drag ?? 1.5, shrink: o.shrink ?? true, floor: o.floor ?? 0, stretch: o.stretch ?? 0 });
  }
  burst(x, y, z, n, color, speed = 3, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      const col = Array.isArray(color) ? color[i % color.length] : color;
      this.add({ x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: (opts.up ?? 2) + Math.random() * (opts.upv ?? 3), color: col, life: (opts.life ?? 0.5) * (0.6 + Math.random() * 0.8), size: (opts.size ?? 0.08) * (0.7 + Math.random() * 0.6), g: opts.g ?? 8 });
    }
  }
  sparks(x, y, z, dir, n = 8, color = 0xfff3b0) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * 1.6, s = 3 + Math.random() * 4;
      this.add({ x, y, z, vx: Math.sin(a) * s, vz: Math.cos(a) * s, vy: 1 + Math.random() * 3, color, life: 0.25 + Math.random() * 0.2, size: 0.06, g: 10 });
    }
  }
  dust(x, z, n = 4, color = 0xd8c8a8) {
    for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5) * 0.3, y: 0.05, z: z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 1.2, vz: (Math.random() - 0.5) * 1.2, vy: 0.6 + Math.random(), color, life: 0.4, size: 0.1, g: 1, drag: 3 });
  }
  wind(x, z, dir, range, spread, n = 26, strong = false) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread * 2, s = (strong ? 14 : 10) * (0.6 + Math.random() * 0.6);
      this.add({ x: x + Math.sin(dir) * 0.4, y: 0.25 + Math.random() * 0.4, z: z + Math.cos(dir) * 0.4, vx: Math.sin(a) * s, vz: Math.cos(a) * s, vy: (Math.random() - 0.3) * 0.6, color: i % 3 ? 0xeaf6ff : 0xb8e0ff, life: range / s * 1.1, size: 0.05, g: 0, drag: 0.4, stretch: 3 });
    }
  }
  arc(x, y, z, facing, radius, sweep, color = 0xffffff, dur = 0.16, width = 0.35, full = false) {
    const seg = new THREE.RingGeometry(radius - width, radius, 18, 1, 0, full ? Math.PI * 2 : sweep);
    const m = new THREE.Mesh(seg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = full ? 0 : facing - Math.PI / 2 - sweep / 2 + Math.PI;
    // RingGeometry lies in XY; after rotating -90deg about X, angle theta maps to (cos, -sin) in XZ
    m.rotation.z = full ? 0 : -(Math.PI / 2 - facing) - sweep / 2 + 0;
    m.position.set(x, y, z);
    this.scene.add(m);
    this.arcs.push({ m, t: 0, dur });
  }
  ring(x, z, r0, r1, color = 0xfff3b0, dur = 0.5, y = 0.1) {
    const g = new THREE.RingGeometry(0.8, 1, 40);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
    this.scene.add(m);
    this.rings.push({ m, t: 0, dur, r0, r1 });
  }
  setAmbient(kind) { this.ambient = kind; }
  update(dt, cam) {
    // ambient motes around camera target
    if (this.ambient && cam) {
      this.ambientT += dt;
      const rate = this.ambient === 'embers' ? 0.04 : 0.07;
      while (this.ambientT > rate) {
        this.ambientT -= rate;
        const x = cam.x + (Math.random() - 0.5) * 26, z = cam.z + (Math.random() - 0.5) * 20;
        if (this.ambient === 'pollen') this.add({ x, y: 0.4 + Math.random() * 1.5, z, vx: 0.4 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.3, vy: 0.05, color: Math.random() < 0.5 ? 0xfff6c0 : 0xffffff, life: 3, size: 0.04, g: 0, drag: 0 });
        else if (this.ambient === 'motes') this.add({ x, y: 0.3 + Math.random() * 1.2, z, vx: (Math.random() - 0.5) * 0.2, vz: (Math.random() - 0.5) * 0.2, vy: 0.1, color: Math.random() < 0.5 ? 0xb8ff9a : 0xd8c0ff, life: 3, size: 0.04, g: 0, drag: 0 });
        else if (this.ambient === 'embers') this.add({ x, y: 0.1, z, vx: (Math.random() - 0.5) * 0.4, vz: -0.3, vy: 0.8 + Math.random(), color: Math.random() < 0.5 ? 0xff8a2a : 0xffd25e, life: 2.5, size: 0.05, g: -0.1, drag: 0 });
      }
    }
    const m = this._m, c = this._c, q = this._q, s = this._s, v = this._v;
    let n = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.life -= dt;
      if (p.life <= 0) { this.p.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; if (p.g === 0) p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor + p.size / 2) { p.y = p.floor + p.size / 2; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    }
    for (const p of this.p) {
      const k = p.shrink ? Math.min(1, p.life / p.max * 1.6) : 1;
      const sz = p.size * k;
      if (p.stretch) {
        const sp = Math.hypot(p.vx, p.vz) + 1e-4;
        q.setFromAxisAngle(v.set(0, 1, 0), Math.atan2(p.vx, p.vz));
        s.set(sz, sz, sz * (1 + p.stretch * Math.min(1, sp / 8)));
      } else { q.identity(); s.set(sz, sz, sz); }
      m.compose(v.set(p.x, p.y, p.z), q, s);
      this.mesh.setMatrixAt(n, m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i]; a.t += dt;
      a.m.material.opacity = Math.max(0, 0.9 * (1 - a.t / a.dur));
      if (a.t >= a.dur) { this.scene.remove(a.m); a.m.geometry.dispose(); a.m.material.dispose(); this.arcs.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      const k = r.t / r.dur;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2));
      r.m.scale.setScalar(rad);
      r.m.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (r.t >= r.dur) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
  }
}
