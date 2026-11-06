// Shared, mutable race state. The 3D scene writes it every frame and the HTML HUD reads it,
// so neither side re-renders React 60 times a second.
export const race = {
  speed: 0, // km/h
  lap: 1,
  lapStart: 0, // ms timestamp, 0 until the car first moves
  time: 0, // current lap, ms
  last: 0,
  best: 0,
  laps: 0, // completed laps, so the HUD can flash on change
  newBest: false,
  offTrack: false,
  sector: 0, // 0–3, one per career chapter
  radio: 0, // bumps each time a new sector is entered forwards, so the HUD shows its message
  garage: -1, // index of the pit garage the car is parked at, or -1
  // The race ritual: title card, start lights, one racing lap, then the podium. 'free' is driving on after it.
  phase: 'title' as Phase,
  lights: 0, // red lights showing, 0–5
  lightsAt: 0, // ms timestamp the light sequence started
  hold: 0, // random pause with all five lit, ms
  result: { time: 0, pos: 1, best: false },
  rivalDone: 0, // ms the rival crossed the finish, 0 if not yet
  pos: 2, // live race position against the rival, 1 or 2
  resets: 0, // bumped by the HUD to put both cars back on the grid
  auto: false, // "Watch a lap": the autopilot drives your car
  touring: false, // autopilot is visiting the pit garages after the flag; the podium waits for it
};

// Steering for the autopilot: turn toward a target point, -1..1, with the heading difference wrapped to ±π.
// Heading h is measured like the car's: forward is (sin h, cos h); positive steer turns left.
export function steerTo(h: number, dx: number, dz: number, gain = 2.5) {
  let d = Math.atan2(dx, dz) - h;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return Math.max(-1, Math.min(1, d * gain));
}

export type Phase = 'title' | 'lights' | 'race' | 'finish' | 'free';

export const LIGHT_MS = 800;

// Start lights: one more red every LIGHT_MS, then a random hold, then all out.
export function lightsState(elapsed: number, hold: number) {
  const lit = Math.min(5, Math.floor(elapsed / LIGHT_MS) + 1);
  return { lit: elapsed < 0 ? 0 : lit, out: elapsed >= 5 * LIGHT_MS + hold };
}

// Target speed for the AI at each sample: slow for corners ahead, then spread braking backwards so it slows in time.
// tan: unit tangents round a closed loop; seg: metres between samples.
export function speedProfile(tan: { x: number; z: number }[], seg: number, vMax: number, vMin: number, decel: number) {
  const n = tan.length;
  const look = Math.round(30 / seg);
  const v = tan.map((t, i) => {
    const a = tan[(i + look) % n];
    const turn = Math.acos(Math.max(-1, Math.min(1, t.x * a.x + t.z * a.z))); // radians turned over the next 30 m
    return Math.max(vMin, vMax * (1 - Math.min(1, turn / 1.6)));
  });
  for (let pass = 0; pass < 2; pass++)
    for (let i = n - 1; i >= 0; i--) {
      const next = v[(i + 1) % n];
      v[i] = Math.min(v[i], Math.sqrt(next * next + 2 * decel * seg)); // v² = u² + 2as
    }
  return v;
}

export const SECTORS = 4;

export type SectorTracker = { sector: number; said?: number };

// Returns the sector just entered when the car moves forwards into the next one, otherwise -1.
// A sector already announced stays quiet, so reversing over a boundary and back never replays it.
export function sectorStep(s: SectorTracker, i: number, n: number): number {
  const sec = Math.min(SECTORS - 1, Math.floor((i / n) * SECTORS));
  if (sec === s.sector) return -1;
  const forward = sec === (s.sector + 1) % SECTORS;
  s.sector = sec;
  if (!forward || sec === s.said) return -1;
  s.said = sec;
  return sec;
}

// Which garage the car is parked in front of: on the pit side, within half a bay of its centre, and slow.
export function garageAt(idx: number, lat: number, kmh: number, bays: number[], halfBay: number, pitLat: number) {
  if (lat > pitLat || kmh > 30) return -1;
  return bays.findIndex((b) => Math.abs(idx - b) <= halfBay);
}

export const input = { up: false, down: false, left: false, right: false, touchSteer: 0, touchThrottle: false, touchBrake: false };

const KEYMAP: Record<string, keyof typeof input> = {
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
};
export const RACE_KEYS = Object.keys(KEYMAP);

export function bindRaceKeys() {
  const set = (on: boolean) => (e: KeyboardEvent) => {
    const k = KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!k) return;
    e.preventDefault();
    (input[k] as boolean) = on;
  };
  const down = set(true);
  const up = set(false);
  const blur = () => Object.assign(input, { up: false, down: false, left: false, right: false });
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    blur();
  };
}

export type LapTracker = { half: boolean; prev: number };

// A lap counts when the car crosses the line forwards after visiting the far side of the track,
// so reversing over the line or cutting back across it never scores.
export function lapStep(s: LapTracker, i: number, n: number): boolean {
  if (i > n * 0.4 && i < n * 0.6) s.half = true;
  let done = false;
  if (s.prev < n * 0.1 && i > n * 0.9) s.half = false; // crossed the line backwards
  if (s.prev > n * 0.9 && i < n * 0.1) {
    done = s.half;
    s.half = false;
  }
  s.prev = i;
  return done;
}

export function fmt(ms: number) {
  if (!ms) return '-:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor(ms / 1000) % 60;
  return `${m}:${String(s).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
}
