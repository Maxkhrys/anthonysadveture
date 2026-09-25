// Low-resolution 3D renderer: the scene is drawn into a small render target with an
// orthographic, pixel-snapped camera, then upscaled with nearest filtering through a
// post shader that adds depth outlines, gentle palette banding, and a vignette.
import * as THREE from 'three';

export const PITCH = THREE.MathUtils.degToRad(42);

export class PixelRenderer {
  constructor(canvas, options = {}) {
    this.viewport = options.viewport;
    this.forceScale = options.scale;
    this.pitch = options.pitch ?? PITCH; // character screens look from lower than the game camera
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: !!options.transparent, premultipliedAlpha: !options.transparent, antialias: false, powerPreference: 'high-performance' });
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
        transparentBackground: { value: options.transparent ? 1 : 0 },
        tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() },
        offset: { value: new THREE.Vector2() }, flash: { value: 0 }, flashColor: { value: new THREE.Color() },
        vignette: { value: 0.35 }, grade: { value: new THREE.Vector3(1, 1, 1) }, near: { value: 0.1 }, far: { value: 120 },
        desat: { value: 0 }, bloom: { value: 0.22 }, bloomScale: { value: 1 },
        fogColor: { value: new THREE.Color(0xc8d8f0) }, fogAmt: { value: 0 }, fogNear: { value: 44 }, fogFar: { value: 60 }, contrast: { value: 1.0 },
        // Pass 10 world look: ambient occlusion, drifting cloud shadows, split-tone grade, tilt-shift
        aoAmt: { value: 0 }, cloudAmt: { value: 0 }, detailAmt: { value: 0 }, reflAmt: { value: 0 }, beamAmt: { value: 0 }, beamCol: { value: new THREE.Color(1, 0.85, 0.6) }, sunDir: { value: new THREE.Vector2(-0.81, 0.58) }, mistAmt: { value: 0 }, mistCol: { value: new THREE.Color(0xf4ecdc) }, splitAmt: { value: 0 }, tilt: { value: 0 }, time: { value: 0 }, wind: { value: new THREE.Vector2(0.9, 0.5) },
        camPos: { value: new THREE.Vector3() }, camUp: { value: new THREE.Vector3(0, 1, 0) }, camBack: { value: new THREE.Vector3(0, 0, 1) }, viewSize: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        uniform float transparentBackground;
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform vec2 offset;
        uniform float flash; uniform vec3 flashColor; uniform float vignette; uniform vec3 grade;
        uniform float near; uniform float far; uniform float desat; uniform float bloom; uniform float bloomScale; uniform vec3 fogColor; uniform float fogAmt; uniform float fogNear; uniform float fogFar; uniform float contrast;
        uniform float aoAmt; uniform float cloudAmt; uniform float detailAmt; uniform float reflAmt; uniform float beamAmt; uniform vec3 beamCol; uniform vec2 sunDir; uniform float mistAmt; uniform vec3 mistCol; uniform float splitAmt; uniform float tilt; uniform float time; uniform vec2 wind;
        uniform vec3 camPos; uniform vec3 camUp; uniform vec3 camBack; uniform vec2 viewSize;
        varying vec2 vUv;
        float dep(vec2 uv){ return texture2D(tDepth, uv).r * (far-near); }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
        void main(){
          vec2 uv = vUv + offset * texel;
          vec2 px = (floor(uv / texel) + 0.5) * texel;
          vec3 c = texture2D(tColor, px).rgb;
          float d = dep(px);
          bool sky = d > (far-near) * 0.995;
          // ambient occlusion: a pixel sitting in a crease (deeper than the average of the
          // pixels on either side of it) is darkened. Comparing opposite neighbours cancels the
          // steady depth slope of flat ground, so only real corners and contacts shade.
          if (aoAmt > 0.0 && !sky) {
            float ao = 0.0;
            for (int i = 0; i < 4; i++) {
              float a = float(i) * 0.785398;
              vec2 dir = vec2(cos(a), sin(a)) * texel;
              for (int j = 1; j <= 2; j++) {
                vec2 o = dir * (float(j) * 1.5);
                float crease = d - 0.5 * (dep(px + o) + dep(px - o));
                // only small steps count: where things meet the ground or a wall, not the drop
                // behind a tall object (that would draw a dark halo around everything)
                ao += smoothstep(0.015, 0.09, crease) * (1.0 - smoothstep(0.16, 0.34, crease));
              }
            }
            c *= 1.0 - clamp(ao / 5.0, 0.0, 1.0) * aoAmt;
          }
          // cloud shadows: rebuild this pixel's world position from the linear ortho depth and
          // let slow noise clouds drift over the land
          vec3 wp = camPos + vec3(1.0, 0.0, 0.0) * (px.x - 0.5) * viewSize.x + camUp * (px.y - 0.5) * viewSize.y - camBack * (near + d);
          // water reflections: the water shader marks its pixels with alpha 0.5. From each water
          // pixel march up the screen to the far bank, then mirror about that bank line, so trees,
          // houses and people on the shore appear upside down in the water, rippling
          float wa = texture2D(tColor, px).a;
          if (reflAmt > 0.0 && !sky && wa > 0.3 && wa < 0.7) {
            float e = 0.0;
            for (int i = 1; i <= 48; i++) { float qa = texture2D(tColor, px + vec2(0.0, float(i)) * texel).a; if (qa > 0.8) { e = float(i); break; } }
            if (e > 0.0) {
              float rip = sin(wp.x * 3.1 + time * 2.2) * 0.9 + sin(wp.z * 5.3 - time * 2.7) * 0.6;
              vec4 rc = texture2D(tColor, px + vec2(rip * texel.x, 2.0 * e * texel.y));
              float fade = (1.0 - smoothstep(14.0, 48.0, e)) * (0.85 + 0.15 * sin(time * 3.0 + wp.x * 2.0));
              if (rc.a > 0.8) c = mix(c, rc.rgb * vec3(0.82, 0.9, 1.02), reflAmt * fade);
            }
            // the sky's drifting clouds, mirrored on the surface (moving with the cloud shadows)
            float sk = vnoise(wp.xz * 0.07 + wind * time * 0.026 + vec2(13.0, 7.0)) * 0.65 + vnoise(wp.xz * 0.16 + wind * time * 0.04) * 0.35;
            c = mix(c, vec3(0.97, 0.99, 1.0), smoothstep(0.5, 0.78, sk) * reflAmt * 0.55);
          }
          // ground detail: faint world-anchored mottling so broad grass and paths never read flat
          if (detailAmt > 0.0 && !sky) c *= 1.0 + (vnoise(wp.xz * 1.7) - 0.5) * detailAmt + (vnoise(wp.xz * 0.35 + 3.1) - 0.5) * detailAmt * 0.8;
          float cl = 0.0;
          if (cloudAmt > 0.0 && !sky) {
            vec2 q = wp.xz * 0.07 + wind * time * 0.026;
            float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 7.1) * 0.35;
            cl = smoothstep(0.44, 0.64, n);
            c *= 1.0 - cl * cloudAmt;
          }
          // sunbeams: long soft streaks along the light, breaking through between the clouds
          if (beamAmt > 0.0 && !sky) {
            vec2 sp = vec2(dot(wp.xz, vec2(-sunDir.y, sunDir.x)), dot(wp.xz, sunDir));
            float bm = vnoise(vec2(sp.x * 0.42 + time * 0.035, sp.y * 0.035)) * 0.7 + vnoise(vec2(sp.x * 1.1 - time * 0.02, sp.y * 0.06 + 4.0)) * 0.3;
            bm = smoothstep(0.52, 0.86, bm) * (1.0 - cl);
            c += beamCol * bm * beamAmt;
          }
          // morning mist pooling low: thick in hollows and over water, thin on raised ground
          if (mistAmt > 0.0 && !sky) {
            float low = 1.0 - smoothstep(-0.25, 0.45, wp.y);
            float mn = vnoise(wp.xz * 0.16 + vec2(time * 0.06, time * 0.025)) * 0.6 + vnoise(wp.xz * 0.45 - vec2(time * 0.04, 0.0)) * 0.4;
            // drifting wisps, not a blanket
            c = mix(c, mistCol, clamp(low * mistAmt * smoothstep(0.35, 0.78, mn) * 1.6, 0.0, 0.6));
          }
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
          c += glow * bloom * bloomScale;
          // aerial perspective: things further up the screen (further from the camera) haze out
          float fd = clamp((d - fogNear) / (fogFar - fogNear), 0.0, 1.0);
          c = mix(c, fogColor, fd * fogAmt * (1.0 - edge * 0.5));
          c *= grade;
          // split tone: warm light, cool shadow
          if (splitAmt > 0.0) { float lt = dot(c, vec3(0.299,0.587,0.114)); c = mix(c, c * mix(vec3(0.9, 0.97, 1.12), vec3(1.07, 1.01, 0.9), smoothstep(0.15, 0.75, lt)), splitAmt); }
          // tilt-shift: the far top and near bottom soften, like a model village under glass
          if (tilt > 0.0) { float k = smoothstep(0.3, 0.5, abs(vUv.y - 0.5)) * tilt;
            if (k > 0.001) { vec3 b = vec3(0.0); for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; b += texture2D(tColor, px + vec2(cos(a), sin(a)) * texel * 1.6).rgb; } c = mix(c, b / 6.0 * grade, k * 0.7); } }
          c = (c - 0.5) * contrast + 0.5;
          float l = dot(c, vec3(0.299,0.587,0.114));
          c = mix(c, vec3(l), desat);
          // gentle palette banding with ordered dither
          vec2 ip = floor(uv / texel);
          float bay = mod(ip.x + ip.y*2.0, 4.0) / 4.0 - 0.375;
          c = floor(c * 40.0 + bay*0.45 + 0.5) / 40.0;
          vec2 v = vUv - 0.5;
          c *= 1.0 - vignette * dot(v, v) * 1.6;
          c = mix(c, flashColor, flash);
          gl_FragColor = vec4(c, mix(1.0, texture2D(tColor, px).a, transparentBackground));
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.rt = null;
    this.resize();
    this.onResize = () => this.resize();
    if (!this.viewport) addEventListener('resize', this.onResize);
  }

  resize() {
    const size = this.viewport ? this.viewport() : { width: innerWidth, height: innerHeight };
    const w = Math.max(1, size.width), h = Math.max(1, size.height);
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

  dispose() {
    if (!this.viewport) removeEventListener('resize', this.onResize);
    this.rt?.depthTexture?.dispose(); this.rt?.dispose();
    this.silhouetteMat.dispose(); this.postMat.dispose();
    this.postScene.traverse(o => o.geometry?.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss();
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
  addFlash(a, color = 0xffffff) { this.flash = Math.max(this.flash, a*(this.flashScale??1)); this.flashColor.set(color); }

  render(scene, dt) {
    const c = this.camera;
    // Camera basis
    const up = new THREE.Vector3(0, Math.cos(this.pitch), -Math.sin(this.pitch));
    const back = new THREE.Vector3(0, Math.sin(this.pitch), Math.cos(this.pitch));
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
    const U = this.postMat.uniforms;
    U.camPos.value.copy(c.position); U.camUp.value.copy(up); U.camBack.value.copy(back);
    U.viewSize.value.set(this.rw * u, this.rh * u); U.time.value += dt;

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
    const a = dx, b = dy * Math.cos(this.pitch) - dz * Math.sin(this.pitch);
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
    const ca = Math.cos(this.pitch), sa = Math.sin(this.pitch);
    const du = (fx - 0.5) * this.rw * u, dv = (fy - 0.5) * this.rh * u;
    // point on the camera plane through the target, then along the view ray (-back)
    const Cx = T.x + du, Cy = T.y + dv * ca, Cz = T.z - dv * sa;
    const lam = (Cy - h) / sa;
    return { x: Cx, y: h, z: Cz - ca * lam };
  }
}
