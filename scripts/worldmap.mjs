// Dev tool: render the built overworld to a PNG (tiles, heights, places, defs).
// node scripts/worldmap.mjs out.png [scale] [mode: tiles|places]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { buildOverworld } from '../src/world/overworld.js';
import { T } from '../src/world/tiles.js';
const out = process.argv[2] || 'worldmap.png', S = +(process.argv[3] || 3), mode = process.argv[4] || 'tiles';
const t0 = performance.now();
const a = buildOverworld();
const t1 = performance.now();
const COL = { [T.GRASS]: 0x5da843, [T.FLOWERS]: 0x6ab84a, [T.FOREST]: 0x3a7a36, [T.TREE]: 0x1f4a22, [T.PATH]: 0xd8b37a, [T.SAND]: 0xf1d38e, [T.ASH]: 0x5b4a4a, [T.WATER]: 0x4aa8c8, [T.DEEP]: 0x2a6a9a, [T.SHALLOW]: 0x5a9a8a, [T.CLIFF]: 0x8a7a68, [T.ROCK]: 0x3a3044, [T.SANDSTONE]: 0xc98a58, [T.LAVA]: 0xff7a2a, [T.PROP]: 0xa06a4a, [T.STONE]: 0xc8bca8, [T.BRIDGE]: 0xa87a48, [T.DOCK]: 0x8a5a38, [T.WALL]: 0x2a2034, [T.PILLAR]: 0x6a5a78, [T.PIT]: 0x000000, [T.MOSS]: 0x7a9a58, [T.MUD]: 0x2e3230, [T.CLAY]: 0xd0905e, [T.FIELD]: 0x8a6a3a, [T.EMBER]: 0x5a2a20, [T.STAIRS]: 0xffffff, [T.FLOOR]: 0x8c7a6a, [T.CAVE]: 0x5e5566 };
const W = a.w * S, H = a.h * S, px = Buffer.alloc(W * H * 3);
const hue = i => [((i * 97) % 255), ((i * 57 + 80) % 255), ((i * 151 + 30) % 255)];
for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
  const t = a.tiles[y * a.w + x]; let c = COL[t] ?? 0xff00ff;
  let r = c >> 16, gg = (c >> 8) & 255, b = c & 255;
  const hv = a.hv[y * a.w + x];
  if (mode === 'places') { const [pr, pg, pb] = hue(a.regionIdx[y * a.w + x]); r = (r + pr * 2) / 3; gg = (gg + pg * 2) / 3; b = (b + pb * 2) / 3; }
  else if (!Number.isNaN(hv) && hv > 0 && hv < 3) { const k = 1 + hv * 0.12; r = Math.min(255, r * k); gg = Math.min(255, gg * k); b = Math.min(255, b * k); }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const o = ((y * S + j) * W + x * S + i) * 3; px[o] = r; px[o + 1] = gg; px[o + 2] = b; }
}
const dot = (x, z, c, s = 2) => { for (let j = -s; j <= s; j++) for (let i = -s; i <= s; i++) { const X = Math.round(x * S) + i, Y = Math.round(z * S) + j; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const o = (Y * W + X) * 3; px[o] = c >> 16; px[o + 1] = (c >> 8) & 255; px[o + 2] = c & 255; } };
for (const d of a.defs) {
  if (d.x === undefined) continue;
  const c = { enemy: 0xff2020, bellstone: 0x00ffff, warp: 0xff00ff, npc: 0xffffff, lootchest: 0xffd700, chest: 0xffa500, sign: 0x202020, vista: 0x0000ff, landmark: 0xffff80 }[d.type];
  if (c !== undefined) dot(d.x, d.z, c, d.type === 'enemy' ? 1 : 2);
}
const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let v = 0xffffffff; for (const b of buf) v = crcT[(v ^ b) & 255] ^ (v >>> 8); return (v ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`built ${a.w}x${a.h} in ${(t1 - t0).toFixed(0)} ms · ${a.defs.length} defs · ${a.landmarks.length} landmarks · ${a.vistas.length} vistas · wrote ${out}`);
