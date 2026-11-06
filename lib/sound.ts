// All sounds are synthesised with Web Audio, so there are no audio files to load or license.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const state = { volume: 0.6, muted: false };

function apply() {
  if (master) master.gain.value = state.muted ? 0 : state.volume * 0.9;
}

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.connect(ctx.destination);
    apply();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function click(freq: number, dur: number, gain: number, when = 0) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(freq: number, dur: number, gain: number, when = 0, type: OscillatorType = 'sine') {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => click(4200, 0.012, 0.35),
  key: () => click(5600, 0.009, 0.22),
  button: () => {
    click(2000, 0.018, 0.8);
    click(950, 0.03, 0.45, 0.05);
  },
  lock: () => {
    click(1300, 0.04, 1);
    tone(110, 0.08, 0.5, 0, 'triangle');
  },
  unlock: () => {
    click(2600, 0.02, 0.7);
    click(1500, 0.03, 0.7, 0.07);
  },
  boot: () => {
    tone(659.25, 0.6, 0.22);
    tone(987.77, 1, 0.2, 0.16);
    tone(1318.5, 1.3, 0.1, 0.32);
  },
  message: () => {
    tone(1046.5, 0.16, 0.18);
    tone(1567.98, 0.3, 0.18, 0.13);
  },
  volume: () => click(3200, 0.014, 0.6),
  radio: () => {
    click(1800, 0.12, 0.5); // squelch
    tone(1320, 0.07, 0.12, 0.1, 'square');
    tone(1760, 0.09, 0.1, 0.18, 'square');
  },
  door: () => {
    for (let i = 0; i < 9; i++) click(380 + (i % 3) * 140, 0.03, 0.5, i * 0.055); // shutter slats rattling up
  },
  light: () => tone(880, 0.18, 0.22, 0, 'square'),
  go: () => {
    tone(1320, 0.55, 0.22, 0, 'square');
    click(2600, 0.25, 0.6, 0.05); // tyre chirp off the line
  },
  finish: () => {
    tone(1046.5, 0.25, 0.18);
    tone(1318.5, 0.25, 0.18, 0.12);
    tone(1568, 0.6, 0.18, 0.24);
    for (let i = 0; i < 14; i++) click(900 + Math.random() * 1600, 0.25, 0.25, 0.1 + i * 0.09); // crowd cheer
  },
};

// Engine and tyres: long-running nodes whose pitch and level follow the car every frame
const GEARS = [0, 70, 120, 165, 210, 255, 300]; // km/h where each gear tops out
let eng: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode; tyre: GainNode; src: AudioBufferSourceNode; gear: number } | null = null;

export const engine = {
  start() {
    const c = ac();
    if (!c || !master || eng) return;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    const sub = c.createOscillator();
    sub.type = 'square';
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const gain = c.createGain();
    gain.gain.value = 0;
    osc.connect(lp);
    sub.connect(lp);
    lp.connect(gain).connect(master);
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 3;
    const tyre = c.createGain();
    tyre.gain.value = 0;
    src.connect(bp).connect(tyre).connect(master);
    osc.start();
    sub.start();
    src.start();
    eng = { osc, sub, gain, tyre, src, gear: 1 };
  },
  // kmh: road speed, throttle: 0–1, slip: 0–1 how hard the tyres are working
  set(kmh: number, throttle: number, slip: number) {
    if (!eng || !ctx) return;
    let g = 1;
    while (g < GEARS.length - 1 && kmh > GEARS[g]) g++;
    if (g !== eng.gear) {
      if (g > eng.gear) click(700, 0.04, 0.5); // upshift blip
      eng.gear = g;
    }
    const rpm = Math.min(1, Math.max(0, (kmh - GEARS[g - 1]) / (GEARS[g] - GEARS[g - 1])));
    const f = 70 + rpm * 150 + g * 8;
    const t = ctx.currentTime;
    eng.osc.frequency.setTargetAtTime(f, t, 0.03);
    eng.sub.frequency.setTargetAtTime(f / 2, t, 0.03);
    eng.gain.gain.setTargetAtTime(0.05 + throttle * 0.07, t, 0.05);
    eng.tyre.gain.setTargetAtTime(slip > 0.35 ? (slip - 0.35) * 0.35 : 0, t, 0.06);
  },
  stop() {
    if (!eng || !ctx) return;
    const e = eng;
    eng = null;
    const t = ctx.currentTime;
    e.gain.gain.setTargetAtTime(0, t, 0.05);
    e.tyre.gain.setTargetAtTime(0, t, 0.05);
    for (const n of [e.osc, e.sub, e.src]) n.stop(t + 0.3);
  },
};

export function setVolume(v: number) {
  state.volume = v;
  apply();
}

export function setMuted(m: boolean) {
  state.muted = m;
  apply();
}

export const haptic = (ms = 8) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
};
