// Fully synthesized sound: every effect and tune is generated with WebAudio at runtime.
let ctx = null, master, sfxBus, musBus, noiseBuf;
const VOL = { master: 0.7, music: 0.22, sfx: 0.55 };
export function setVolumes(m, mu, s) { VOL.master = 0.7 * m; VOL.music = 0.22 * mu; VOL.sfx = 0.55 * s; if (ctx) { master.gain.value = VOL.master; musBus.gain.value = VOL.music; sfxBus.gain.value = VOL.sfx; } }
let musicOn = true;
const N = n => 440 * Math.pow(2, (n - 69) / 12);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = VOL.master; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(comp);
  musBus = ctx.createGain(); musBus.gain.value = VOL.music; musBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, attack = 0.005, delay = 0, bus = sfxBus, decay = true } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  if (decay) g.gain.exponentialRampToValueAtTime(0.001, t + dur); else g.gain.setValueAtTime(0, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', slide = 1, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
}
function bell(f, dur = 2.5, vol = 0.25, delay = 0) {
  [1, 2.01, 2.76, 5.4].forEach((m, i) => tone(f * m, dur / (1 + i * 0.6), { type: 'sine', vol: vol / (1 + i), delay }));
}

const SFX = {
  swing: () => noise(0.12, { freq: 2400, slide: 0.4, vol: 0.25, q: 2 }),
  swing2: () => noise(0.14, { freq: 3000, slide: 0.35, vol: 0.28, q: 2 }),
  spin: () => { noise(0.35, { freq: 1500, slide: 3, vol: 0.3, q: 3 }); tone(300, 0.3, { slide: 2, vol: 0.08 }); },
  hit: () => { tone(180, 0.09, { slide: 0.5, vol: 0.35 }); noise(0.08, { freq: 900, vol: 0.35 }); },
  heavyhit: () => { tone(110, 0.2, { slide: 0.4, vol: 0.45 }); noise(0.18, { freq: 500, vol: 0.45 }); },
  clang: () => { tone(1250, 0.25, { type: 'triangle', vol: 0.2 }); tone(1870, 0.18, { type: 'triangle', vol: 0.12 }); noise(0.05, { freq: 5000, vol: 0.2 }); },
  parry: () => { bell(1320, 0.6, 0.25); noise(0.06, { freq: 6000, vol: 0.3 }); },
  block: () => { tone(420, 0.1, { type: 'triangle', vol: 0.3, slide: 0.7 }); noise(0.06, { freq: 1500, vol: 0.2 }); },
  hurt: () => { tone(400, 0.25, { slide: 0.3, vol: 0.35 }); tone(300, 0.25, { slide: 0.3, vol: 0.2, type: 'sawtooth' }); },
  roll: () => noise(0.18, { freq: 700, slide: 0.5, vol: 0.2 }),
  step: () => noise(0.03, { freq: 800, vol: 0.05 }),
  pip: () => { tone(N(88), 0.06, { vol: 0.15 }); tone(N(93), 0.12, { vol: 0.15, delay: 0.05 }); },
  pipbig: () => { [88, 92, 95, 100].forEach((n, i) => tone(N(n), 0.1, { vol: 0.12, delay: i * 0.04 })); },
  heart: () => { tone(N(84), 0.1, { vol: 0.15, type: 'triangle' }); tone(N(91), 0.2, { vol: 0.15, type: 'triangle', delay: 0.08 }); },
  enemydie: () => { noise(0.3, { freq: 600, slide: 0.3, vol: 0.35 }); tone(220, 0.3, { slide: 0.25, vol: 0.15 }); },
  poof: () => noise(0.25, { freq: 400, slide: 2, vol: 0.25 }),
  cut: () => noise(0.1, { freq: 3000, vol: 0.2, q: 0.7 }),
  gust: () => { noise(0.45, { freq: 500, slide: 4, vol: 0.4, q: 0.6 }); noise(0.3, { freq: 2000, vol: 0.15, type: 'highpass' }); },
  gale: () => { noise(0.8, { freq: 300, slide: 6, vol: 0.55, q: 0.5 }); tone(90, 0.6, { type: 'sawtooth', vol: 0.08, slide: 2 }); },
  charge: () => tone(N(72), 0.1, { type: 'triangle', vol: 0.1, slide: 1.5 }),
  charged: () => { tone(N(84), 0.08, { type: 'triangle', vol: 0.15 }); tone(N(91), 0.15, { type: 'triangle', vol: 0.15, delay: 0.06 }); },
  door: () => { noise(0.5, { freq: 200, vol: 0.4, type: 'lowpass' }); tone(80, 0.4, { vol: 0.2 }); },
  unlock: () => { tone(N(76), 0.08, { vol: 0.2 }); tone(N(83), 0.15, { vol: 0.2, delay: 0.07 }); noise(0.1, { freq: 3000, vol: 0.2, delay: 0.05 }); },
  push: () => noise(0.35, { freq: 150, vol: 0.3, type: 'lowpass' }),
  slide: () => noise(0.4, { freq: 300, vol: 0.2, type: 'lowpass', slide: 0.6 }),
  fall: () => tone(600, 0.6, { slide: 0.1, vol: 0.2, type: 'triangle' }),
  splash: () => noise(0.5, { freq: 1200, slide: 0.3, vol: 0.4 }),
  thud: () => { tone(70, 0.25, { vol: 0.5, slide: 0.5 }); noise(0.2, { freq: 200, vol: 0.4, type: 'lowpass' }); },
  switch: () => { tone(N(64), 0.07, { vol: 0.25 }); tone(N(71), 0.1, { vol: 0.25, delay: 0.06 }); },
  extinguish: () => noise(0.4, { freq: 3500, slide: 0.2, vol: 0.3, q: 0.5 }),
  ignite: () => noise(0.3, { freq: 600, slide: 3, vol: 0.2 }),
  secret: () => { [67, 66, 63, 57, 56, 64, 68, 72].forEach((n, i) => tone(N(n + 12), 0.14, { type: 'square', vol: 0.12, delay: i * 0.11 })); },
  chest: () => { [60, 64, 67, 72].forEach((n, i) => tone(N(n), 0.18, { vol: 0.13, delay: i * 0.09, type: 'square' })); },
  fanfare: () => {
    const seq = [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [84, 0.65]];
    seq.forEach(([n, d]) => { tone(N(n), 0.5, { vol: 0.14, delay: d, type: 'square' }); tone(N(n - 12), 0.5, { vol: 0.1, delay: d, type: 'triangle' }); });
    bell(N(84), 2.5, 0.2, 0.65);
  },
  chime: () => { bell(N(76), 3.5, 0.3); bell(N(83), 3.5, 0.2, 0.4); bell(N(88), 4, 0.25, 0.8); },
  bellfail: () => { tone(90, 0.9, { type: 'triangle', vol: 0.5, slide: 0.6 }); noise(0.5, { freq: 150, vol: 0.4, type: 'lowpass' }); },
  surge: () => { bell(N(60), 3, 0.35); bell(N(67), 3, 0.25, 0.05); noise(0.8, { freq: 200, slide: 8, vol: 0.4 }); },
  talk: () => tone(N(70 + Math.floor(Math.random() * 6)), 0.04, { type: 'triangle', vol: 0.06 }),
  select: () => tone(N(79), 0.05, { vol: 0.12 }),
  buy: () => { tone(N(79), 0.08, { vol: 0.15 }); tone(N(86), 0.15, { vol: 0.15, delay: 0.08 }); },
  error: () => tone(140, 0.2, { vol: 0.2, type: 'sawtooth' }),
  windup: () => tone(N(58), 0.3, { type: 'sawtooth', vol: 0.06, slide: 1.6 }),
  shoot: () => { noise(0.15, { freq: 900, vol: 0.2 }); tone(300, 0.12, { slide: 0.5, vol: 0.12, type: 'triangle' }); },
  bossSting: () => { [38, 41, 45].forEach(n => tone(N(n), 1.6, { type: 'sawtooth', vol: 0.1 })); [50, 53, 57].forEach((n, i) => tone(N(n), 0.5, { type: 'square', vol: 0.08, delay: 0.5 + i * 0.12 })); noise(0.9, { freq: 160, vol: 0.3, delay: 0.5 }); },
  roar: () => { tone(80, 1.2, { type: 'sawtooth', vol: 0.25, slide: 0.6 }); noise(1.2, { freq: 300, vol: 0.4, slide: 0.5 }); },
  inhale: () => noise(1.6, { freq: 200, slide: 6, vol: 0.35, q: 0.8 }),
  bossdie: () => { for (let i = 0; i < 6; i++) { noise(0.4, { freq: 300 + i * 200, vol: 0.4, delay: i * 0.18 }); tone(200 - i * 20, 0.3, { vol: 0.2, delay: i * 0.18, slide: 0.5 }); } },
  low: () => { tone(N(81), 0.08, { vol: 0.1 }); tone(N(81), 0.08, { vol: 0.1, delay: 0.16 }); },
  potion: () => { [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.06 })); },
  spawn: () => noise(0.4, { freq: 200, slide: 3, vol: 0.2 }),
  // ---- Pass 5: skills, elements, new creatures and bosses
  crit: () => { tone(N(88), 0.06, { type: 'triangle', vol: 0.16 }); noise(0.07, { freq: 5200, vol: 0.22, q: 3 }); },
  quake: () => { tone(55, 0.5, { vol: 0.55, slide: 0.45 }); noise(0.45, { freq: 180, vol: 0.5, type: 'lowpass', slide: 0.5 }); bell(N(48), 1.2, 0.18, 0.02); },
  shatter: () => { for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 2600, 0.12 + i * 0.03, { type: 'triangle', vol: 0.09, delay: i * 0.025 }); noise(0.2, { freq: 6000, vol: 0.3, q: 0.8 }); },
  glass: () => { bell(N(96), 0.5, 0.12); noise(0.12, { freq: 7000, vol: 0.18, q: 2 }); },
  zap: () => { tone(900, 0.08, { type: 'sawtooth', vol: 0.1, slide: 0.3 }); noise(0.07, { freq: 4000, vol: 0.18, q: 1.5 }); },
  thread: () => { tone(620 + Math.random() * 120, 0.12, { type: 'sawtooth', vol: 0.05, slide: 1.4 }); noise(0.1, { freq: 5000, vol: 0.1, q: 4 }); },
  tether: () => { tone(N(62), 0.25, { type: 'triangle', vol: 0.14, slide: 1.3 }); noise(0.25, { freq: 900, vol: 0.12, q: 3 }); },
  snap: () => { noise(0.12, { freq: 2600, vol: 0.35, q: 1 }); tone(180, 0.15, { slide: 0.4, vol: 0.2 }); },
  moth: () => noise(0.5, { freq: 1600, vol: 0.12, q: 6, slide: 0.7 }),
  hex: () => { tone(N(55), 0.4, { type: 'sawtooth', vol: 0.08, slide: 0.8 }); tone(N(61), 0.4, { type: 'square', vol: 0.05, slide: 0.8, delay: 0.05 }); },
  draw: () => { noise(0.25, { freq: 5000, slide: 0.4, vol: 0.18, q: 5 }); tone(N(86), 0.2, { type: 'triangle', vol: 0.08, delay: 0.12 }); },
  weakpoint: () => { tone(N(92), 0.08, { type: 'square', vol: 0.12 }); tone(N(99), 0.12, { type: 'square', vol: 0.1, delay: 0.05 }); noise(0.1, { freq: 3000, vol: 0.25 }); },
  armorbreak: () => { tone(1500, 0.3, { type: 'triangle', vol: 0.2, slide: 0.5 }); noise(0.35, { freq: 2500, vol: 0.35, slide: 0.4 }); tone(90, 0.3, { vol: 0.3, slide: 0.5 }); },
  bonk: () => { tone(420, 0.25, { type: 'triangle', vol: 0.35, slide: 0.55 }); tone(1260, 0.35, { type: 'sine', vol: 0.15 }); },
  croak: () => { tone(70, 0.5, { type: 'sawtooth', vol: 0.35, slide: 1.3 }); tone(95, 0.35, { type: 'square', vol: 0.15, slide: 0.8, delay: 0.25 }); },
  tongue: () => { noise(0.2, { freq: 900, vol: 0.3, slide: 2.5, q: 2 }); tone(300, 0.15, { slide: 2, vol: 0.1 }); },
  stitch: () => { for (let i = 0; i < 3; i++) tone(1800 + i * 300, 0.05, { type: 'triangle', vol: 0.08, delay: i * 0.05 }); },
  wax: () => noise(0.4, { freq: 500, vol: 0.18, slide: 0.6, type: 'lowpass' }),
  lunge: () => { noise(0.14, { freq: 4200, slide: 0.3, vol: 0.3, q: 4 }); tone(700, 0.1, { type: 'sawtooth', vol: 0.08, slide: 0.4 }); },
  resonate: () => { bell(N(69), 1.0, 0.16); bell(N(70), 1.0, 0.12, 0.03); },
  oath: () => { bell(N(57), 1.4, 0.18); tone(N(45), 0.8, { type: 'triangle', vol: 0.12 }); },
  forge: () => { bell(N(84), 1.2, 0.2); noise(0.3, { freq: 3000, vol: 0.2 }); [72, 79, 84].forEach((n, i) => tone(N(n), 0.12, { vol: 0.1, delay: 0.1 + i * 0.06 })); },
  soulpick: () => { bell(N(88), 0.8, 0.15); tone(N(76), 0.3, { type: 'triangle', vol: 0.1 }); },
  windmill: () => { tone(60, 1.5, { type: 'sawtooth', vol: 0.1, slide: 1.5 }); noise(1.2, { freq: 400, vol: 0.2 }); },
};

export function sfx(name) { if (ctx && SFX[name]) SFX[name](); }

// ---------------- music -----------------
// Each track: bpm, and lines of "note:len" tokens. Note names like C4, rests as '-'.
const TRACKS = {
  title: { bpm: 84, lead: 'E5:2 G5:2 A5:4 G5:2 E5:2 D5:4 C5:2 D5:2 E5:4 - :4 E5:2 G5:2 A5:4 C6:2 B5:2 A5:4 G5:2 E5:2 G5:8', bass: 'A2:8 F2:8 C3:8 G2:8 A2:8 F2:8 C3:8 E3:8', wave: 'triangle', pad: true },
  village: { bpm: 108, lead: 'G4:2 B4:2 D5:2 B4:2 C5:2 E5:2 D5:4 B4:2 G4:2 A4:2 B4:2 A4:6 - :2 G4:2 B4:2 D5:2 G5:2 F#5:2 E5:2 D5:4 C5:2 B4:2 A4:2 F#4:2 G4:6 - :2', bass: 'G2:4 D3:4 C3:4 D3:4 G2:4 E2:4 D2:4 D3:4 G2:4 D3:4 C3:4 A2:4 D3:4 D2:4 G2:8', wave: 'square' },
  field: { bpm: 126, lead: 'A4:3 E5:1 E5:2 D5:1 C5:1 B4:2 C5:2 D5:4 C5:3 A4:1 A4:2 G4:2 A4:6 - :2 A4:3 E5:1 E5:2 G5:2 F5:2 E5:2 D5:4 C5:2 D5:2 E5:2 B4:2 A4:6 - :2', bass: 'A2:2 A3:2 A2:2 A3:2 F2:2 F3:2 G2:2 G3:2 A2:2 A3:2 E2:2 E3:2 A2:2 A3:2 A2:2 A3:2 A2:2 A3:2 C3:2 C4:2 D3:2 D4:2 G2:2 G3:2 F2:2 F3:2 E2:2 E3:2 A2:4 A2:4', wave: 'square' },
  dungeon: { bpm: 92, lead: 'D5:4 - :2 F5:2 E5:4 C5:4 D5:4 - :2 A4:2 C5:6 - :2 D5:4 - :2 F5:2 G5:4 A5:2 G5:2 F5:4 E5:4 D5:8', bass: 'D2:8 C2:8 D2:8 A1:8 D2:8 E2:8 F2:4 C2:4 D2:8', wave: 'triangle' },
  boss: { bpm: 156, lead: 'D5:1 D5:1 F5:1 D5:1 G5:1 D5:1 G#5:1 A5:1 D5:1 D5:1 F5:1 D5:1 C5:2 A4:2 D5:1 D5:1 F5:1 D5:1 G5:1 D5:1 A5:2 C6:1 A5:1 G5:1 F5:1 E5:2 C5:2', bass: 'D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 A#1:1 A#2:1 A#1:1 A#2:1 C2:1 C3:1 C2:1 C3:1 D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 A#1:1 A#2:1 C2:1 C3:1 A1:1 A2:1 A1:1 A2:1', wave: 'sawtooth' },
  cave: { bpm: 70, lead: 'E5:6 B4:2 C5:4 A4:4 - :4 E5:2 F5:2 E5:4 B4:4 - :4', bass: 'E2:8 A1:8 E2:8 B1:8', wave: 'triangle' },
  // Pass 6: one theme per region (same small synth, each with its own mode and pulse)
  forest: { bpm: 96, lead: 'D5:2 F5:2 A5:4 G5:2 F5:2 E5:4 D5:2 C5:2 D5:4 A4:4 - :2 D5:2 F5:2 G5:2 A5:4 C6:2 A5:2 G5:4 F5:2 E5:2 D5:8', bass: 'D3:8 C3:8 A2:8 D3:8 D3:8 F2:8 G2:8 D3:8', wave: 'triangle' },
  glass: { bpm: 88, lead: 'E5:2 B5:2 G5:4 F#5:2 D5:2 E5:4 - :2 B4:2 C#5:2 D5:4 E5:2 F#5:2 G5:4 A5:2 B5:2 E5:8', bass: 'E2:8 C3:8 D3:8 E3:8', wave: 'triangle', pad: true },
  lake: { bpm: 78, lead: 'G4:4 B4:2 D5:2 E5:4 D5:4 B4:2 A4:2 G4:4 - :4 E4:2 G4:2 A4:4 B4:4 D5:2 B4:2 A4:8', bass: 'G2:8 E2:8 C3:8 D3:8', wave: 'triangle', pad: true },
  desert: { bpm: 116, lead: 'E5:2 F5:1 E5:1 D5:2 E5:2 - :2 B4:2 C5:4 B4:2 A4:2 G#4:2 A4:2 B4:4 - :4 E5:2 F5:1 G#5:1 A5:2 G#5:2 F5:2 E5:2 F5:4 E5:8', bass: 'E2:4 E3:4 E2:4 F2:4 E2:4 E3:4 D2:4 E2:4', wave: 'square' },
  volcano: { bpm: 132, lead: 'A4:2 A4:1 C5:1 A4:2 D#5:2 D5:2 C5:2 A4:4 G4:2 A4:2 C5:2 D5:2 D#5:4 D5:4 A4:8', bass: 'A1:2 A2:2 A1:2 A2:2 F1:2 F2:2 G1:2 G2:2 A1:2 A2:2 A1:2 A2:2 D#2:2 D2:2 A1:4', wave: 'sawtooth' },
  marsh: { bpm: 72, lead: 'C5:4 D#5:4 G4:4 - :4 C5:2 D5:2 D#5:4 F5:4 D#5:4 D5:8 - :4', bass: 'C2:8 G#1:8 F1:8 G1:8', wave: 'triangle', pad: true },
  highlands: { bpm: 100, lead: 'A4:2 D5:2 E5:4 F#5:4 E5:2 D5:2 B4:4 A4:4 - :2 A4:2 B4:2 D5:2 F#5:4 A5:4 G5:2 F#5:2 E5:8', bass: 'D2:8 G2:8 D2:8 A2:8', wave: 'triangle', pad: true },
  camp: { bpm: 140, lead: 'E5:1 E5:1 - :1 E5:1 G5:2 E5:2 D5:2 B4:2 D5:2 E5:1 E5:1 - :1 E5:1 A5:2 G5:2 E5:4 - :4', bass: 'E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 C2:1 C3:1 C2:1 C3:1 D2:1 D3:1 D2:1 D3:1 E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 C2:1 C3:1 D2:1 D3:1 E2:4', wave: 'square' },
};
function parse(line) {
  const names = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const out = [];
  const toks = line.replace(/- :/g, '-:').split(/\s+/).filter(Boolean);
  for (const t of toks) {
    const [n, l] = t.split(':');
    const len = +l || 1;
    if (n === '-') out.push([null, len]);
    else { const m = n.match(/^([A-G]#?)(\d)$/); out.push([12 * (+m[2] + 1) + names[m[1]], len]); }
  }
  return out;
}
let cur = null, curName = null, schedTimer = null;
export function playMusic(name) {
  if (curName === name) return;
  curName = name;
  if (cur) { cur.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); const g = cur.gain; setTimeout(() => g.disconnect(), 1500); }
  cur = null;
  clearInterval(schedTimer);
  if (!ctx || !name || !TRACKS[name]) return;
  const tr = TRACKS[name];
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(musBus);
  gain.gain.setTargetAtTime(musicOn ? 1 : 0, ctx.currentTime, 0.4);
  const step = 60 / tr.bpm / 2; // eighth note
  const voices = [{ notes: parse(tr.lead), wave: tr.wave, vol: 0.18, i: 0, t: ctx.currentTime + 0.1, oct: 0 },
                  { notes: parse(tr.bass), wave: 'triangle', vol: 0.3, i: 0, t: ctx.currentTime + 0.1, oct: 0 }];
  cur = { gain, voices };
  const sched = () => {
    if (!cur || cur.gain !== gain) return;
    for (const v of voices) {
      while (v.t < ctx.currentTime + 0.4) {
        const [n, len] = v.notes[v.i];
        const d = len * step;
        if (n !== null) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = v.wave; o.frequency.value = N(n);
          g.gain.setValueAtTime(0, v.t); g.gain.linearRampToValueAtTime(v.vol, v.t + 0.01);
          g.gain.setTargetAtTime(v.vol * 0.5, v.t + 0.02, 0.08);
          g.gain.setTargetAtTime(0, v.t + d * 0.85, 0.03);
          o.connect(g); g.connect(gain); o.start(v.t); o.stop(v.t + d + 0.2);
          if (tr.pad && v === voices[1]) { const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = N(n + 19); o2.connect(g); o2.start(v.t); o2.stop(v.t + d + 0.2); }
        }
        v.t += d; v.i = (v.i + 1) % v.notes.length;
      }
    }
  };
  sched();
  schedTimer = setInterval(sched, 100);
}
export function toggleMusic() {
  musicOn = !musicOn;
  if (cur && ctx) cur.gain.gain.setTargetAtTime(musicOn ? 1 : 0, ctx.currentTime, 0.2);
  return musicOn;
}
export function duckMusic(on) { if (musBus && ctx) musBus.gain.setTargetAtTime(on ? VOL.music * 0.3 : VOL.music, ctx.currentTime, 0.2); }
// a single pitched bell (puzzle bells ring their own note)
export function playTone(midi) { if (ctx) bell(N(midi), 1.6, 0.28); }

// ---------------- Pass 6: regional ambience -----------------
// Sparse, quiet sound beds under the music: a few one-shots every few seconds, chosen by the
// region you stand in (and whether it's night). No looping noise.
const AMB = {
  meadow: n => n ? (Math.random() < 0.5 && crickets()) : (Math.random() < 0.6 && chirp()),
  forest: n => n ? (Math.random() < 0.4 && owl()) : Math.random() < 0.5 ? chirp() : Math.random() < 0.3 && knock(),
  deepforest: n => Math.random() < 0.35 ? owl() : Math.random() < 0.3 && creak(),
  glass: () => Math.random() < 0.5 && tinkle(),
  water: n => Math.random() < 0.5 ? lap() : !n && Math.random() < 0.3 && gull(),
  dry: () => Math.random() < 0.6 && breeze(0.05),
  volcanic: () => Math.random() < 0.5 ? rumble() : crackle(),
  marsh: n => n ? (Math.random() < 0.6 ? frog() : crickets()) : Math.random() < 0.4 && frog(),
  wind: () => Math.random() < 0.6 ? breeze(0.09) : Math.random() < 0.25 && bell(N(45), 3, 0.05),
  cave: () => Math.random() < 0.4 && drip(),
};
const chirp = () => { const f = 2600 + Math.random() * 900; tone(f, 0.07, { type: 'sine', vol: 0.03, slide: 1.3 }); tone(f * 1.1, 0.06, { type: 'sine', vol: 0.025, slide: 1.25, delay: 0.1 }); };
const crickets = () => { for (let i = 0; i < 4; i++) tone(4200, 0.03, { type: 'square', vol: 0.006, delay: i * 0.07 }); };
const owl = () => { tone(N(57), 0.35, { type: 'sine', vol: 0.03 }); tone(N(55), 0.5, { type: 'sine', vol: 0.03, delay: 0.45 }); };
const knock = () => { for (let i = 0; i < 5; i++) noise(0.02, { freq: 1500, vol: 0.03, delay: i * 0.09 }); };
const creak = () => tone(140, 0.6, { type: 'sawtooth', vol: 0.012, slide: 1.3 });
const tinkle = () => { const s = [76, 79, 81, 84, 88]; bell(N(s[Math.floor(Math.random() * s.length)] + 12), 1.4, 0.025); };
const lap = () => noise(1.2, { freq: 500, vol: 0.03, slide: 0.6, type: 'lowpass' });
const gull = () => tone(1400, 0.3, { type: 'triangle', vol: 0.015, slide: 0.7 });
const breeze = v => noise(2.2, { freq: 700, vol: v * 0.5, slide: 1.6, q: 0.4 });
const rumble = () => { tone(45, 1.5, { type: 'sine', vol: 0.05 }); noise(1.2, { freq: 120, vol: 0.04, type: 'lowpass' }); };
const crackle = () => { for (let i = 0; i < 6; i++) noise(0.02, { freq: 3000 + Math.random() * 2000, vol: 0.02, delay: Math.random() * 0.6 }); };
const frog = () => { tone(N(45), 0.12, { type: 'square', vol: 0.02, slide: 0.8 }); tone(N(45), 0.12, { type: 'square', vol: 0.02, slide: 0.8, delay: 0.18 }); };
const drip = () => tone(1800 + Math.random() * 600, 0.08, { type: 'sine', vol: 0.03, slide: 0.5 });
let ambId = null, ambNight = false, ambTimer = null;
export const AMBIENCES = Object.keys(AMB);
export function setAmbience(id, night = false) {
  ambNight = night;
  if (id === ambId) return;
  ambId = id; clearInterval(ambTimer); ambTimer = null;
  if (!id || !AMB[id]) return;
  ambTimer = setInterval(() => { if (ctx && musicOn && ambId === id) AMB[id](ambNight); }, 2600);
}
export function currentAmbience() { return ambId; }
