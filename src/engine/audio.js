// Fully synthesized sound: every effect and tune is generated with WebAudio at runtime.
let ctx = null, master, sfxBus, musBus, noiseBuf;
let musicOn = true;
const N = n => 440 * Math.pow(2, (n - 69) / 12);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(comp);
  musBus = ctx.createGain(); musBus.gain.value = 0.22; musBus.connect(comp);
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
  roar: () => { tone(80, 1.2, { type: 'sawtooth', vol: 0.25, slide: 0.6 }); noise(1.2, { freq: 300, vol: 0.4, slide: 0.5 }); },
  inhale: () => noise(1.6, { freq: 200, slide: 6, vol: 0.35, q: 0.8 }),
  bossdie: () => { for (let i = 0; i < 6; i++) { noise(0.4, { freq: 300 + i * 200, vol: 0.4, delay: i * 0.18 }); tone(200 - i * 20, 0.3, { vol: 0.2, delay: i * 0.18, slide: 0.5 }); } },
  low: () => { tone(N(81), 0.08, { vol: 0.1 }); tone(N(81), 0.08, { vol: 0.1, delay: 0.16 }); },
  potion: () => { [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.06 })); },
  spawn: () => noise(0.4, { freq: 200, slide: 3, vol: 0.2 }),
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
export function duckMusic(on) { if (musBus && ctx) musBus.gain.setTargetAtTime(on ? 0.06 : 0.22, ctx.currentTime, 0.2); }
