// The tile grid every area is painted into.
import { T } from './tiles.js';

export class Grid {
  constructor(w, h, fill) { this.w = w; this.h = h; this.t = new Uint8Array(w * h).fill(fill); this.hv = new Float32Array(w * h); this.defs = []; }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.t[y * this.w + x] : T.CLIFF; }
  set(x, y, v) { if (this.in(x, y)) this.t[y * this.w + x] = v; }
  rect(x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, v); }
  ellipse(cx, cy, rx, ry, v, test) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1 && (!test || test(this.get(x, y), x, y, d))) this.set(x, y, v);
    }
  }
  road(pts, width, v, onWater = T.BRIDGE) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
        for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) {
          if (ox * ox + oy * oy > width * width + 0.5) continue;
          const tx = Math.round(x + ox), ty = Math.round(y + oy);
          const cur = this.get(tx, ty);
          if (cur === T.WATER || cur === T.DEEP) this.set(tx, ty, onWater);
          else if (cur !== T.BRIDGE && cur !== T.STONE && cur !== T.PROP) this.set(tx, ty, v);
        }
      }
    }
  }
  def(d) { this.defs.push(d); return d; }
  deco(model, x, y, w, d, extra = {}) { // solid footprint prop
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, T.PROP);
    return this.def({ type: 'deco', model, x: x + w / 2, z: y + d / 2, w, d, ...extra });
  }
}
