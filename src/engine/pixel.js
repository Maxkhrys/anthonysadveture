// Low-resolution 3D renderer: the scene is drawn into a small render target with an
// orthographic, pixel-snapped camera, then upscaled with nearest filtering through a
// post shader that adds depth outlines, gentle palette banding, and a vignette.
import * as THREE from 'three';

export const PITCH = THREE.MathUtils.degToRad(42);

export class PixelRenderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.viewHeight = 15; // world units visible vertically
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
    this.camDist = 50;
    this.target = new THREE.Vector3();
    this.shake = 0;
    this.shakeT = 0;
    this.flash = 0;
    this.flashColor = new THREE.Color(1, 1, 1);
    this.silhouetteMat = new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z -= 0.014 * gl_Position.w; }`,
      fragmentShader: `void main(){ gl_FragColor = vec4(0.36,0.27,0.62,1.0); }`,
      depthFunc: THREE.GreaterDepth, depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() },
        offset: { value: new THREE.Vector2() }, flash: { value: 0 }, flashColor: { value: new THREE.Color() },
        vignette: { value: 0.35 }, grade: { value: new THREE.Vector3(1, 1, 1) }, near: { value: 0.1 }, far: { value: 120 },
        desat: { value: 0 }, bloom: { value: 0.22 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform vec2 offset;
        uniform float flash; uniform vec3 flashColor; uniform float vignette; uniform vec3 grade;
        uniform float near; uniform float far; uniform float desat; uniform float bloom;
        varying vec2 vUv;
        float dep(vec2 uv){ return texture2D(tDepth, uv).r * (far-near); }
        void main(){
          vec2 uv = vUv + offset * texel;
          vec2 px = (floor(uv / texel) + 0.5) * texel;
          vec3 c = texture2D(tColor, px).rgb;
          float d = dep(px);
          float dn = min(min(dep(px+vec2(texel.x,0.)), dep(px-vec2(texel.x,0.))), min(dep(px+vec2(0.,texel.y)), dep(px-vec2(0.,texel.y))));
          float edge = step(0.55, d - dn);
          c = mix(c, c*0.28 + vec3(0.03,0.02,0.06), edge*0.85);
          // highlight upward-facing rims (neighbor behind is farther => we are a top edge)
          float db = dep(px+vec2(0.,texel.y));
          float rim = step(0.55, db - d) * (1.0-edge);
          c += rim * 0.10 * vec3(1.0,0.95,0.8);
          // soft bloom: bright neighbours bleed light
          vec3 glow = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398;
            vec2 o = vec2(cos(a), sin(a)) * texel;
            glow += max(texture2D(tColor, px + o * 2.0).rgb - 0.7, 0.0) + max(texture2D(tColor, px + o * 4.5).rgb - 0.7, 0.0) * 0.6;
          }
          c += glow * bloom;
          c *= grade;
          float l = dot(c, vec3(0.299,0.587,0.114));
          c = mix(c, vec3(l), desat);
          // gentle palette banding with ordered dither
          vec2 ip = floor(uv / texel);
          float bay = mod(ip.x + ip.y*2.0, 4.0) / 4.0 - 0.375;
          c = floor(c * 40.0 + bay*0.45 + 0.5) / 40.0;
          vec2 v = vUv - 0.5;
          c *= 1.0 - vignette * dot(v, v) * 1.6;
          c = mix(c, flashColor, flash);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.rt = null;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    const scale = this.forceScale || Math.max(2, Math.round(h / (this.targetH || 330)));
    this.scale = scale;
    const rw = Math.ceil(w / scale) + 2, rh = Math.ceil(h / scale) + 2;
    this.rw = rw; this.rh = rh;
    if (this.rt) { this.rt.dispose(); this.rt.depthTexture.dispose(); }
    this.rt = new THREE.WebGLRenderTarget(rw, rh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, samples: 0 });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.rt.depthTexture = new THREE.DepthTexture(rw, rh);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.postMat.uniforms.tColor.value = this.rt.texture;
    this.postMat.uniforms.tDepth.value = this.rt.depthTexture;
    this.postMat.uniforms.texel.value.set(1 / rw, 1 / rh);
    this.updateProjection();
  }

  updateProjection() {
    const vh = this.viewHeight;
    const unitsPerPx = vh / (this.rh - 2);
    this.unitsPerPx = unitsPerPx;
    const hw = this.rw * unitsPerPx / 2, hh = this.rh * unitsPerPx / 2;
    const c = this.camera;
    c.left = -hw; c.right = hw; c.top = hh; c.bottom = -hh;
    c.updateProjectionMatrix();
  }

  setViewHeight(v) { if (Math.abs(v - this.viewHeight) > 1e-3) { this.viewHeight = v; this.updateProjection(); } }

  addShake(a) { this.shake = Math.max(this.shake, a * (this.shakeScale ?? 1)); }
  addFlash(a, color = 0xffffff) { this.flash = Math.max(this.flash, a); this.flashColor.set(color); }

  render(scene, dt) {
    const c = this.camera;
    // Camera basis
    const up = new THREE.Vector3(0, Math.cos(PITCH), -Math.sin(PITCH));
    const back = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
    const t = this.target.clone();
    this.shakeT += dt * 60;
    this.shakeOff = this.shakeOff || new THREE.Vector3();
    this.shakeOff.set(0, 0, 0);
    if (this.shake > 0.001) {
      this.shakeOff.x = Math.sin(this.shakeT * 1.7) * this.shake * 0.25;
      this.shakeOff.z = Math.cos(this.shakeT * 2.3) * this.shake * 0.25;
      t.add(this.shakeOff);
      this.shake *= Math.pow(0.02, dt);
    }
    // snap to texel grid in the camera plane
    const u = this.unitsPerPx;
    const sx = t.x, sy = t.dot(up), sz = t.dot(back);
    const qx = Math.round(sx / u) * u, qy = Math.round(sy / u) * u;
    const snapped = new THREE.Vector3(qx, 0, 0).addScaledVector(up, qy).addScaledVector(back, sz);
    c.position.copy(snapped).addScaledVector(back, this.camDist);
    c.up.copy(up);
    c.lookAt(snapped);
    this.postMat.uniforms.offset.value.set((sx - qx) / u, (sy - qy) / u);
    this.postMat.uniforms.near.value = c.near; this.postMat.uniforms.far.value = c.far;

    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.autoClear = true;
    c.layers.set(0);
    r.render(scene, c);
    // silhouette pass for occluded actors (layer 1)
    r.autoClear = false;
    c.layers.set(1);
    const bg = scene.background; scene.background = null;
    scene.overrideMaterial = this.silhouetteMat;
    r.render(scene, c);
    scene.overrideMaterial = null; scene.background = bg;
    c.layers.set(0);
    r.autoClear = true;
    r.setRenderTarget(null);
    this.postMat.uniforms.flash.value = this.flash;
    this.postMat.uniforms.flashColor.value.copy(this.flashColor);
    this.flash = Math.max(0, this.flash - dt * 3);
    r.render(this.postScene, this.postCam);
  }

  // world -> screen pixels (CSS). Uses the continuous (un-snapped) view the post pass
  // actually shows, so it agrees exactly with screenToWorld.
  project(v) {
    const T = this.viewCenter(), u = this.unitsPerPx;
    const dx = v.x - T.x, dy = v.y - T.y, dz = v.z - T.z;
    const a = dx, b = dy * Math.cos(PITCH) - dz * Math.sin(PITCH);
    const fx = a / (this.rw * u) + 0.5, fy = b / (this.rh * u) + 0.5;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + fx * r.width, y: r.top + (1 - fy) * r.height };
  }
  viewCenter() { const t = this.target.clone(); if (this.shakeOff) t.add(this.shakeOff); return t; }
  // screen pixels (CSS client coords) -> point on the horizontal plane y = h
  screenToWorld(cx, cy, h = 0) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const fx = (cx - r.left) / r.width, fy = 1 - (cy - r.top) / r.height;
    const T = this.viewCenter(), u = this.unitsPerPx;
    const ca = Math.cos(PITCH), sa = Math.sin(PITCH);
    const du = (fx - 0.5) * this.rw * u, dv = (fy - 0.5) * this.rh * u;
    // point on the camera plane through the target, then along the view ray (-back)
    const Cx = T.x + du, Cy = T.y + dv * ca, Cz = T.z - dv * sa;
    const lam = (Cy - h) / sa;
    return { x: Cx, y: h, z: Cz - ca * lam };
  }
}
