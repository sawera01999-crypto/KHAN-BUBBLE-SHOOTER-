// Fully synthesized audio (no files, works offline).
import type { Theme } from "./themes";

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode;
let noiseBuf: AudioBuffer;
let sfxOn = true, musicOn = true;

function ensure(): Ctx | null {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxOn ? 0.8 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicOn ? 0.22 : 0;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; to?: number; bus?: GainNode; attack?: number } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + (opts.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const v = opts.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(opts.bus ?? sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { vol?: number; at?: number; freq?: number; q?: number; type?: BiquadFilterType; sweepTo?: number } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + (opts.at ?? 0);
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? "bandpass";
  f.frequency.setValueAtTime(opts.freq ?? 1000, t);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.vol ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export const sfx = {
  unlock: () => ensure(),
  setSfx(on: boolean) {
    sfxOn = on;
    if (ctx) sfxBus.gain.value = on ? 0.8 : 0;
  },
  setMusic(on: boolean) {
    musicOn = on;
    if (ctx) musicBus.gain.value = on ? 0.22 : 0;
  },
  shoot() {
    noise(0.18, { freq: 600, sweepTo: 3000, q: 0.8, vol: 0.25 });
    tone(320, 0.09, { type: "sine", to: 700, vol: 0.2 });
  },
  click() { tone(1800, 0.04, { type: "triangle", vol: 0.12 }); },
  stick() { tone(520, 0.06, { type: "sine", vol: 0.18, to: 380 }); noise(0.04, { freq: 2500, vol: 0.08 }); },
  pop(i = 0) {
    const f = 500 + Math.min(i, 14) * 70 + Math.random() * 40;
    tone(f, 0.11, { type: "sine", to: f * 2.2, vol: 0.22, at: 0 });
    noise(0.05, { freq: 3000, q: 2, vol: 0.1 });
  },
  drop(i = 0) { tone(900 - Math.min(i, 10) * 40, 0.15, { type: "triangle", to: 300, vol: 0.12 }); },
  ui() { tone(880, 0.06, { type: "triangle", vol: 0.15 }); tone(1320, 0.06, { type: "triangle", vol: 0.1, at: 0.04 }); },
  swap() { tone(600, 0.08, { type: "square", vol: 0.06, to: 1200 }); tone(1200, 0.08, { type: "sine", vol: 0.1, to: 600, at: 0.06 }); },
  bomb() {
    noise(0.9, { type: "lowpass", freq: 1800, sweepTo: 80, vol: 0.9, q: 0.5 });
    tone(110, 0.7, { type: "sine", to: 30, vol: 0.7 });
    tone(55, 0.9, { type: "triangle", to: 25, vol: 0.5 });
  },
  fireball() {
    noise(1.0, { type: "bandpass", freq: 400, sweepTo: 2400, q: 0.7, vol: 0.5 });
    tone(200, 0.8, { type: "sawtooth", to: 800, vol: 0.08 });
  },
  burn() { noise(0.12, { freq: 1500 + Math.random() * 800, q: 1.5, vol: 0.18 }); },
  star(i = 0) {
    const base = [76, 79, 84][i % 3];
    [0, 4, 7, 12].forEach((s, k) => tone(midi(base + s), 0.35, { type: "triangle", vol: 0.16, at: k * 0.05 }));
  },
  coin() { tone(988, 0.08, { type: "square", vol: 0.07 }); tone(1319, 0.25, { type: "square", vol: 0.07, at: 0.08 }); },
  victory() {
    const seq = [60, 64, 67, 72, 67, 72, 76, 79];
    seq.forEach((n, i) => {
      tone(midi(n), 0.3, { type: "square", vol: 0.08, at: i * 0.11 });
      tone(midi(n - 12), 0.3, { type: "triangle", vol: 0.12, at: i * 0.11 });
    });
    tone(midi(84), 0.9, { type: "triangle", vol: 0.18, at: seq.length * 0.11 });
    // cheering + clapping
    noise(1.8, { type: "bandpass", freq: 1200, q: 0.4, vol: 0.12, at: 0.6 });
    for (let k = 0; k < 40; k++) noise(0.05, { freq: 1400 + Math.random() * 900, q: 1.2, vol: 0.25, at: 0.6 + Math.random() * 1.8 });
  },
  defeat() {
    [67, 66, 65, 64].forEach((n, i) => tone(midi(n), i === 3 ? 0.9 : 0.35, { type: "triangle", vol: 0.18, at: i * 0.32, to: i === 3 ? midi(58) : undefined }));
    tone(midi(43), 1.4, { type: "sawtooth", vol: 0.05, at: 0.9 });
  },
  danger() { tone(300, 0.15, { type: "square", vol: 0.06 }); },
};

// ---------------- Background music sequencer ----------------
let timer: number | null = null;
let step = 0;
let nextTime = 0;
let current: { key: string; theme: Theme; mode: "menu" | "map" | "game" } | null = null;

const PROG = [0, 7, 9, 5]; // I V vi IV
function schedule() {
  if (!ctx || !current) return;
  const { theme, mode } = current;
  const tempo = theme.music.tempo * (mode === "game" ? 1.08 : mode === "map" ? 0.95 : 1);
  const eighth = 60 / tempo / 2;
  while (nextTime < ctx.currentTime + 0.15) {
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    const root = theme.music.root + PROG[bar] - (PROG[bar] > 6 ? 12 : 0);
    const at = nextTime - ctx.currentTime;
    if (s === 0 || s === 4) tone(midi(root - 24), eighth * 3.5, { type: "triangle", vol: 0.32, at, bus: musicBus, attack: 0.01 });
    const chord = [0, 4, 7, 12];
    const minor = PROG[bar] === 9;
    const arp = chord[s % 4] - (minor && s % 4 === 1 ? 1 : 0);
    tone(midi(root + arp), eighth * 1.6, { type: theme.music.wave, vol: theme.music.wave === "square" ? 0.05 : 0.12, at, bus: musicBus, attack: 0.01 });
    if (mode !== "map" && (s === 2 || s === 5 || s === 7) && Math.random() < 0.6) {
      const sc = theme.music.scale;
      const n = theme.music.root + 12 + sc[Math.floor(Math.random() * sc.length)];
      tone(midi(n), eighth * 2.5, { type: "sine", vol: 0.1, at, bus: musicBus, attack: 0.02 });
    }
    if (mode === "game" && s % 2 === 1) noise(0.03, { freq: 8000, type: "highpass", vol: 0.02, at });
    nextTime += eighth;
    step++;
  }
}

export const music = {
  play(mode: "menu" | "map" | "game", theme: Theme) {
    const key = mode + theme.id;
    if (current?.key === key && timer) return;
    current = { key, theme, mode };
    const c = ensure();
    if (!c) return;
    nextTime = c.currentTime + 0.1;
    step = 0;
    if (!timer) timer = window.setInterval(schedule, 40);
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    current = null;
  },
};
