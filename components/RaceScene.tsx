'use client';

import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { career, pitProjects } from '@/lib/data';
import { SECTORS, bindRaceKeys, garageAt, input, lapStep, lightsState, race, sectorStep, speedProfile, steerTo } from '@/lib/race';
import { engine, sfx } from '@/lib/sound';
import {
  Billboard, BrakeBoard, Garage, Grandstand, Hills, LIVERY,
  asphaltTex, bannerTex, blobTex, checker, grassTex, numberTex, skyTex,
} from './trackside';

// Units are metres. The circuit: a long start straight, a hairpin, an esses section and a fast sweeper.
const CONTROL: [number, number][] = [
  [0, 0], [110, 0], [165, 25], [175, 85], [130, 120], [90, 95], [60, 125], [10, 150],
  [-60, 140], [-120, 105], [-130, 40], [-80, 0],
];
const SAMPLES = 700;
const HALF = 7; // half the road width
const WALL = HALF + 9; // the car can run wide onto the grass this far before hitting the barrier

const ACCEL = 17;
const BRAKE = 34;
const MAX = 72; // m/s, about 260 km/h
const TURN = 1.9;
const RIVAL_MAX = 58; // m/s: quicker than you on a messy lap, beatable on a clean one
const AUTO_MAX = 72; // m/s: simulated, laps clean in about 22.6 s, level with the rival
const GRID_BACK = 10; // grid slots sit this many samples behind the line

type Track = { pts: THREE.Vector3[]; nrm: THREE.Vector3[]; tan: THREE.Vector3[]; seg: number };

// Pit lane: six garages on the outside of the start straight, just after the line
const BAY = 14; // metres per garage
const PIT_X0 = 20; // x of the first garage centre
const PIT_LAT = -(HALF + 3); // the car counts as "in the pit lane" past this lateral offset

function buildTrack(): Track {
  const curve = new THREE.CatmullRomCurve3(CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const seg = curve.getLength() / SAMPLES;
  const pts: THREE.Vector3[] = [];
  const nrm: THREE.Vector3[] = [];
  const tan: THREE.Vector3[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = curve.getPointAt(t);
    const d = curve.getTangentAt(t);
    pts.push(p);
    tan.push(d);
    nrm.push(new THREE.Vector3(-d.z, 0, d.x)); // points to the left of the direction of travel
  }
  return { pts, nrm, tan, seg };
}

// Sample index of each garage centre, found along the opening stretch of the straight
function pitBays(tr: Track) {
  return pitProjects.map((_, k) => {
    const x = PIT_X0 + k * BAY;
    let best = 0;
    for (let i = 0; i < SAMPLES / 4; i++) if (Math.abs(tr.pts[i].x - x) < Math.abs(tr.pts[best].x - x)) best = i;
    return best;
  });
}

// A flat strip following the track between two lateral offsets, optionally striped red/white
function strip(tr: Track, from: number, to: number, y: number, stripes?: [THREE.Color, THREE.Color], keep?: (i: number) => boolean) {
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    if (keep && !keep(i)) continue;
    const j = (i + 1) % SAMPLES;
    const a0 = tr.pts[i].clone().addScaledVector(tr.nrm[i], from);
    const a1 = tr.pts[i].clone().addScaledVector(tr.nrm[i], to);
    const b0 = tr.pts[j].clone().addScaledVector(tr.nrm[j], from);
    const b1 = tr.pts[j].clone().addScaledVector(tr.nrm[j], to);
    for (const v of [a0, a1, b0, a1, b1, b0]) pos.push(v.x, y, v.z); // counter-clockwise from above, so faces point up
    // u across the strip, v along it in metres / 8, so a texture tiles every 8 m
    const v0 = (i * tr.seg) / 8;
    const v1 = ((i + 1) * tr.seg) / 8;
    uv.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1);
    if (stripes) {
      const c = stripes[Math.floor(i / 3) % 2];
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (stripes) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// An upright barrier at one lateral offset, with UVs so an advertising banner runs along it
function barrier(tr: Track, lat: number, h: number, keep?: (i: number) => boolean) {
  const pos: number[] = [];
  const uv: number[] = [];
  const BANNER = 160; // metres before the banner repeats
  for (let i = 0; i < SAMPLES; i++) {
    if (keep && !keep(i)) continue;
    const j = (i + 1) % SAMPLES;
    const a = tr.pts[i].clone().addScaledVector(tr.nrm[i], lat);
    const b = tr.pts[j].clone().addScaledVector(tr.nrm[j], lat);
    const u0 = (i * tr.seg) / BANNER;
    const u1 = ((i + 1) * tr.seg) / BANNER;
    pos.push(a.x, 0, a.z, b.x, 0, b.z, a.x, h, a.z, b.x, 0, b.z, b.x, h, b.z, a.x, h, a.z);
    uv.push(u0, 0, u1, 0, u0, 1, u1, 0, u1, 1, u0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

type CarProps = { wheels: React.RefObject<THREE.Group[]>; livery?: string; accent?: string; num?: string };

const Car = forwardRef<THREE.Group, CarProps>(function Car({ wheels, livery = LIVERY.red, accent = LIVERY.yellow, num = '17' }, ref) {
  const red = livery;
  const plate = useMemo(() => numberTex(num, LIVERY.chalk, LIVERY.ink), [num]);
  const shadow = useMemo(blobTex, []);
  const wheel = (key: string, x: number, z: number, r: number, i: number) => (
    <group key={key} position={[x, r, z]} ref={(g) => { if (g && wheels.current) wheels.current[i] = g; }}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r, r, 0.42, 16]} />
        <meshLambertMaterial color="#141414" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[x > 0 ? 0.22 : -0.22, 0, 0]}>
        <cylinderGeometry args={[r * 0.55, r * 0.55, 0.02, 12]} />
        <meshLambertMaterial color="#d8d8d8" />
      </mesh>
    </group>
  );
  return (
    <group ref={ref}>
      {/* body, nose and sidepods */}
      <mesh position={[0, 0.45, 0.2]} castShadow><boxGeometry args={[0.85, 0.42, 3.4]} /><meshLambertMaterial color={red} /></mesh>
      <mesh position={[0, 0.36, 2.35]}><boxGeometry args={[0.45, 0.24, 1.3]} /><meshLambertMaterial color={red} /></mesh>
      <mesh position={[0, 0.42, -0.2]}><boxGeometry args={[1.5, 0.34, 1.4]} /><meshLambertMaterial color="#f2f2f2" /></mesh>
      {/* cockpit, helmet, airbox */}
      <mesh position={[0, 0.7, 0.35]}><boxGeometry args={[0.55, 0.12, 0.9]} /><meshLambertMaterial color="#111" /></mesh>
      <mesh position={[0, 0.82, 0.25]}><sphereGeometry args={[0.2, 14, 10]} /><meshLambertMaterial color="#ffd21f" /></mesh>
      <mesh position={[0, 0.85, -0.45]}><boxGeometry args={[0.35, 0.45, 0.7]} /><meshLambertMaterial color={red} /></mesh>
      {/* wings */}
      <mesh position={[0, 0.18, 2.95]}><boxGeometry args={[1.9, 0.06, 0.45]} /><meshLambertMaterial color="#111" /></mesh>
      <mesh position={[0, 0.95, -1.75]}><boxGeometry args={[1.5, 0.08, 0.45]} /><meshLambertMaterial color="#111" /></mesh>
      <mesh position={[0.7, 0.7, -1.7]}><boxGeometry args={[0.05, 0.55, 0.5]} /><meshLambertMaterial color={red} /></mesh>
      <mesh position={[-0.7, 0.7, -1.7]}><boxGeometry args={[0.05, 0.55, 0.5]} /><meshLambertMaterial color={red} /></mesh>
      {/* livery: accent stripe down the spine, nose number, end plates in the accent colour, blob shadow */}
      <mesh position={[0, 0.665, 0.9]}><boxGeometry args={[0.18, 0.01, 2.2]} /><meshBasicMaterial color={accent} /></mesh>
      <mesh position={[0, 0.49, 2.35]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.42, 0.42]} /><meshBasicMaterial map={plate} transparent /></mesh>
      <mesh position={[0, 1.0, -1.75]}><boxGeometry args={[1.52, 0.02, 0.47]} /><meshBasicMaterial color={accent} /></mesh>
      <mesh position={[0, 0.02, 0.3]} rotation-x={-Math.PI / 2}><planeGeometry args={[3.2, 6.4]} /><meshBasicMaterial map={shadow} transparent depthWrite={false} /></mesh>
      {wheel('fl', 0.95, 1.75, 0.33, 0)}
      {wheel('fr', -0.95, 1.75, 0.33, 1)}
      {wheel('rl', 0.98, -1.15, 0.38, 2)}
      {wheel('rr', -0.98, -1.15, 0.38, 3)}
    </group>
  );
});

export default function RaceScene() {
  const track = useMemo(buildTrack, []);
  const bays = useMemo(() => pitBays(track), [track]);
  const halfBay = Math.round(BAY / 2 / track.seg);
  const inPit = (i: number) => i >= bays[0] - halfBay && i <= bays[bays.length - 1] + halfBay;
  const geo = useMemo(() => {
    const red = new THREE.Color('#d8262c');
    const white = new THREE.Color('#f2f2f2');
    return {
      road: strip(track, -HALF, HALF, 0),
      kerbL: strip(track, HALF, HALF + 1.4, 0.02, [red, white]),
      kerbR: strip(track, -HALF - 1.4, -HALF, 0.02, [red, white]),
      lineL: strip(track, HALF - 0.5, HALF - 0.25, 0.01),
      lineR: strip(track, -HALF + 0.25, -HALF + 0.5, 0.01),
      wallL: barrier(track, WALL, 1.1),
      // the garages are the barrier along the pit lane, so the wall stops there
      wallR: barrier(track, -WALL, 1.1, (i) => !inPit(i)),
      pit: strip(track, -WALL, -HALF - 1.4, 0.005, undefined, inPit),
      pitLine: strip(track, PIT_LAT - 0.15, PIT_LAT + 0.15, 0.012, undefined, inPit),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, bays]);
  const tex = useMemo(() => {
    const asphalt = asphaltTex();
    return { flag: checker(), asphalt, banner: bannerTex(), sky: skyTex(), grass: grassTex() };
  }, []);
  const doors = useRef<(THREE.Mesh | null)[]>([]);
  const startLights = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  // Grandstand on the inside of the run-up to the line, facing the grid
  const stand = (() => {
    const i = SAMPLES - Math.round(38 / track.seg);
    const n = track.nrm[i];
    return { at: track.pts[i].clone().addScaledVector(n, WALL + 2.5), facing: Math.atan2(-n.x, -n.z), length: 56 };
  })();

  // Braking boards before the first big corner: find where the rival's speed first drops hard, count back from it
  const brakeBoards = useMemo(() => {
    const prof = speedProfile(track.tan, track.seg, RIVAL_MAX, 15, 22);
    const corner = prof.findIndex((v, i) => i > SAMPLES * 0.08 && v < RIVAL_MAX * 0.6);
    return [150, 100, 50].map((m) => {
      const i = (corner - Math.round(m / track.seg) + SAMPLES) % SAMPLES;
      const n = track.nrm[i];
      const face = track.tan[i].clone().negate();
      // on the inside: the outside of this straight is the pit lane
      return { m, at: track.pts[i].clone().addScaledVector(n, HALF + 4), facing: Math.atan2(face.x, face.z) };
    });
  }, [track]);

  // Garage centres sit just behind the barrier line, facing the track; billboards stand on the inside at each sector start
  const garageSpots = bays.map((i) => ({
    at: track.pts[i].clone().addScaledVector(track.nrm[i], -WALL),
    facing: Math.atan2(track.nrm[i].x, track.nrm[i].z),
  }));
  const boards = Array.from({ length: SECTORS }, (_, k) => {
    const i = Math.round((k / SECTORS) * SAMPLES + 30 / track.seg) % SAMPLES; // 30 m into the sector
    const n = track.nrm[i];
    const face = track.tan[i].clone().negate().addScaledVector(n, -0.6); // toward oncoming cars, angled at the road
    return { at: track.pts[i].clone().addScaledVector(n, WALL + 4), facing: Math.atan2(face.x, face.z) };
  });

  const car = useRef<THREE.Group>(null);
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const wheels = useRef<THREE.Group[]>([]);
  const trees = useRef<THREE.InstancedMesh>(null);
  const s = useRef({ x: 0, z: 0, h: 0, v: 0, idx: 0, prog: 0, lap: { half: false, prev: 0 }, sec: { sector: 3, said: 3 } as { sector: number; said?: number }, steerVis: 0 });
  const rival = useRef<THREE.Group>(null);
  const rivalWheels = useRef<THREE.Group[]>([]);
  const r = useRef({ u: 0, v: 0 }); // u: distance round the track in samples, unwrapped
  const profile = useMemo(() => speedProfile(track.tan, track.seg, RIVAL_MAX, 15, 22), [track]);
  // Autopilot ("Watch a lap") drives the line at the speed the corners allow
  const autoProfile = useMemo(() => speedProfile(track.tan, track.seg, AUTO_MAX, 24, 32), [track]);
  const tour = useRef({ bay: 0, until: 0 });
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const resets = useRef(race.resets);

  // Line both cars up on the grid: the rival on pole, the player one row back on the other side
  const grid = () => {
    const i = SAMPLES - GRID_BACK;
    const p = track.pts[i].clone().addScaledVector(track.nrm[i], -3);
    const d = track.tan[i];
    Object.assign(s.current, {
      x: p.x, z: p.z, h: Math.atan2(d.x, d.z), v: 0, idx: i, prog: i,
      lap: { half: false, prev: i }, sec: { sector: SECTORS - 1, said: SECTORS - 1 },
    });
    Object.assign(r.current, { u: SAMPLES - GRID_BACK + 6, v: 0 });
    Object.assign(race, {
      speed: 0, lap: 1, lapStart: 0, time: 0, last: 0, laps: 0, newBest: false, offTrack: false,
      sector: SECTORS - 1, radio: 0, garage: -1, lights: 0, rivalDone: 0, pos: 2, touring: false,
    });
  };

  useEffect(() => {
    grid();
    race.phase = 'title';
    race.best = Number(localStorage.getItem('kg-best-lap') ?? 0);
    engine.start();
    const unbind = bindRaceKeys();
    return () => {
      unbind();
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  // Scatter trees on the infield and outfield, never on the track
  useLayoutEffect(() => {
    const m = trees.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let n = 0;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    while (n < m.count) {
      const x = -260 + rnd() * 520;
      const z = -140 + rnd() * 420;
      const near = track.pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (WALL + 11) ** 2); // clear of garages and billboards too
      if (near) continue;
      const sc = 0.8 + rnd() * 1.4;
      o.position.set(x, 3 * sc, z);
      o.scale.setScalar(sc);
      o.updateMatrix();
      m.setColorAt(n, new THREE.Color().setHSL(0.27 + rnd() * 0.08, 0.45, 0.2 + rnd() * 0.12)); // a mix of greens
      m.setMatrixAt(n++, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [track]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const st = s.current;
    const now = performance.now();

    // "Race again" from the HUD puts both cars back on the grid
    if (race.resets !== resets.current) {
      resets.current = race.resets;
      grid();
    }

    // Start lights: a beep per red light, then lights out starts the clock
    if (race.phase === 'lights') {
      const ls = lightsState(now - race.lightsAt, race.hold);
      if (ls.out) {
        race.lights = 0;
        race.phase = 'race';
        race.lapStart = now;
        sfx.go();
      } else if (ls.lit !== race.lights) {
        race.lights = ls.lit;
        sfx.light();
      }
    }

    // Controls only work once the lights are out; after the flag the car coasts to a stop
    const live = race.phase === 'race' || race.phase === 'free';
    let steer = live ? (input.left ? 1 : 0) - (input.right ? 1 : 0) + input.touchSteer : 0;
    let throttle = live && (input.up || input.touchThrottle) ? 1 : 0;
    let brake = live ? (input.down || input.touchBrake ? 1 : 0) : race.phase === 'finish' && st.v > 0 ? 0.5 : 0;

    // Any driving input takes the wheel back from the autopilot
    if (race.auto && live && (steer || throttle || brake)) race.auto = false;
    if (race.auto && (live || race.phase === 'finish')) {
      let lat = 0;
      let target = autoProfile[(st.idx + 4) % SAMPLES];
      if (race.phase === 'finish') {
        // Garage tour: pull up at each door in turn, wait, then roll on to the next one
        lat = -(WALL - 1.6);
        target = 0;
        if (race.touring) {
          const ahead = (bays[tour.current.bay] - st.idx + SAMPLES) % SAMPLES;
          const arrived = ahead <= 1 || ahead > SAMPLES / 2;
          target = arrived ? 0 : Math.min(13, Math.sqrt(2 * 5 * ahead * track.seg));
          if (arrived && Math.abs(st.v) < 0.6) {
            if (!tour.current.until) tour.current.until = now + 3200;
            else if (now > tour.current.until) {
              tour.current = { bay: tour.current.bay + 1, until: 0 };
              if (tour.current.bay >= bays.length) race.touring = false;
            }
          }
        }
      }
      const look = Math.round(5 + Math.abs(st.v) * 0.3);
      const j = (st.idx + look) % SAMPLES;
      steer = steerTo(st.h, track.pts[j].x + track.nrm[j].x * lat - st.x, track.pts[j].z + track.nrm[j].z * lat - st.z);
      throttle = st.v < target - 0.5 ? 1 : 0;
      brake = st.v > target + 1.5 ? 1 : 0;
    }

    // Arcade longitudinal model: throttle, brakes, then reverse once stopped
    if (throttle) st.v += ACCEL * (1 - Math.max(0, st.v) / MAX) * dt;
    if (brake) st.v -= (st.v > 0 ? BRAKE : ACCEL * 0.5) * dt;
    st.v -= st.v * 0.12 * dt;
    if (!throttle && !brake) st.v -= Math.sign(st.v) * Math.min(Math.abs(st.v), 3 * dt);

    // Find the nearest track sample, searching only near the last one
    let best = st.idx;
    let bestD = Infinity;
    for (let k = -30; k <= 30; k++) {
      const i = (st.idx + k + SAMPLES) % SAMPLES;
      const p = track.pts[i];
      const d = (p.x - st.x) ** 2 + (p.z - st.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    st.prog += ((best - st.idx + SAMPLES * 1.5) % SAMPLES) - SAMPLES / 2; // unwrapped progress, for race position
    st.idx = best;
    const p = track.pts[best];
    const n = track.nrm[best];
    const lat = (st.x - p.x) * n.x + (st.z - p.z) * n.z;
    race.offTrack = Math.abs(lat) > HALF + 1.4 && !(lat < 0 && inPit(best)); // the pit lane is tarmac, not grass
    if (race.offTrack) st.v -= st.v * 1.6 * dt; // grass scrubs speed

    // Steering needs speed, and tightens less at the top end
    const grip = Math.min(1, Math.abs(st.v) / 7) * (1 - 0.45 * Math.min(1, Math.abs(st.v) / MAX));
    st.h += steer * TURN * grip * Math.sign(st.v) * dt;
    st.x += Math.sin(st.h) * st.v * dt;
    st.z += Math.cos(st.h) * st.v * dt;

    // Barrier: push back inside and bleed speed
    const lat2 = (st.x - p.x) * n.x + (st.z - p.z) * n.z;
    if (Math.abs(lat2) > WALL - 1) {
      const back = Math.abs(lat2) - (WALL - 1);
      st.x -= n.x * Math.sign(lat2) * back;
      st.z -= n.z * Math.sign(lat2) * back;
      st.v *= 0.55;
    }

    // Rival: follows the racing line at the speed the corners allow
    const rv = r.current;
    if (race.phase !== 'title' && race.phase !== 'lights') {
      const target = profile[Math.floor(rv.u) % SAMPLES];
      rv.v += Math.max(-26 * dt, Math.min(14 * dt, target - rv.v));
      rv.u += (rv.v * dt) / track.seg;
      if (!race.rivalDone && race.phase === 'race' && rv.u >= SAMPLES * 2) race.rivalDone = now;
    }
    {
      const i = Math.floor(rv.u) % SAMPLES;
      const j = (i + 1) % SAMPLES;
      const f = rv.u % 1;
      const lane = 3 * Math.cos((rv.u / SAMPLES) * Math.PI * 6); // drifts across the road so it isn't on rails
      const rx = THREE.MathUtils.lerp(track.pts[i].x, track.pts[j].x, f) + track.nrm[i].x * lane;
      const rz = THREE.MathUtils.lerp(track.pts[i].z, track.pts[j].z, f) + track.nrm[i].z * lane;
      const rc = rival.current!;
      rc.position.set(rx, 0, rz);
      rc.rotation.y = Math.atan2(track.tan[i].x, track.tan[i].z);
      rivalWheels.current.forEach((w) => w.children.forEach((m) => (m.rotation.x += (rv.v * dt) / 0.35)));
      // Contact: the cars can't overlap; the player gets nudged aside and loses a little speed
      const dx = st.x - rx;
      const dz = st.z - rz;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.6 && dist > 0.001) {
        st.x += (dx / dist) * (2.6 - dist);
        st.z += (dz / dist) * (2.6 - dist);
        st.v *= 0.97;
      }
    }
    race.pos = st.prog >= rv.u ? 1 : 2;

    // Lap timing. In the race the first completed lap is the finish; in free drive laps just keep counting.
    if (race.phase === 'free' && !race.lapStart && Math.abs(st.v) > 0.5) race.lapStart = now;
    if (lapStep(st.lap, best, SAMPLES) && race.lapStart) {
      race.last = now - race.lapStart;
      race.newBest = !race.auto && (!race.best || race.last < race.best); // autopilot laps never count as yours
      if (race.newBest) {
        race.best = race.last;
        localStorage.setItem('kg-best-lap', String(Math.round(race.last)));
      }
      race.laps++;
      race.lap++;
      race.lapStart = now;
      if (race.phase === 'race') {
        race.phase = 'finish';
        race.result = { time: race.last, pos: race.rivalDone ? 2 : 1, best: race.newBest };
        if (race.auto) {
          race.touring = true;
          tour.current = { bay: 0, until: 0 };
        }
        sfx.finish();
      }
    }
    race.time = race.lapStart ? now - race.lapStart : 0;
    race.speed = Math.abs(st.v) * 3.6;
    engine.set(race.speed, throttle, Math.abs(steer) * grip * Math.min(1, Math.abs(st.v) / 35) + (race.offTrack ? 0.25 : 0));

    // Career sectors: a radio message each time the car drives into the next one
    const entered = sectorStep(st.sec, best, SAMPLES);
    race.sector = st.sec.sector;
    if (entered >= 0) {
      race.radio++;
      sfx.radio();
    }

    // Pit garages: park in front of one and its door rolls up
    const g = garageAt(best, lat2, race.speed, bays, halfBay, PIT_LAT);
    if (g !== race.garage) {
      if (g >= 0) sfx.door();
      race.garage = g;
    }
    doors.current.forEach((d, i) => {
      if (!d) return;
      const open = i === race.garage ? 1 : 0;
      const cur = d.scale.y;
      d.scale.y = Math.max(0.04, cur + (1 - open - cur) * Math.min(1, dt * 5));
      d.position.y = 5 - (5 * d.scale.y) / 2; // rolls up into the top of the opening
    });

    // Car pose, wheel spin and visual steering
    const c = car.current!;
    c.position.set(st.x, 0, st.z);
    c.rotation.y = st.h;
    st.steerVis += (steer * 0.4 - st.steerVis) * Math.min(1, dt * 12);
    wheels.current.forEach((w, i) => {
      w.children.forEach((m) => (m.rotation.x += (st.v * dt) / 0.35));
      if (i < 2) w.rotation.y = Math.max(-0.4, Math.min(0.4, st.steerVis));
    });

    // Gantry lights mirror the HUD lights
    startLights.current.forEach((m, k) => m?.color.set(race.phase === 'lights' && k < race.lights ? '#ff2020' : '#2a0c0e'));

    // Chase camera: sits back further and widens its view as speed builds
    const cm = cam.current!;
    const fx = Math.sin(st.h);
    const fz = Math.cos(st.h);
    const back = 8.5 + Math.max(0, st.v) * 0.04;
    const k = 1 - Math.exp(-dt * 7);
    cm.position.x += (st.x - fx * back - cm.position.x) * k;
    cm.position.y += (3.4 - cm.position.y) * k;
    cm.position.z += (st.z - fz * back - cm.position.z) * k;
    cm.lookAt(st.x + fx * 7, 1, st.z + fz * 7);
    cm.fov += (58 + (reduced ? 0 : Math.max(0, st.v) * 0.22) - cm.fov) * k; // reduced motion: no speed zoom
    cm.updateProjectionMatrix();
  });

  const start = track.pts[0];
  const startDir = Math.atan2(track.tan[0].x, track.tan[0].z);

  return (
    <>
      {/* Late-afternoon light: warm low sun, cool sky fill, hazy peach horizon */}
      <color attach="background" args={['#8cc0ec']} />
      <fog attach="fog" args={['#ecd6bc', 120, 520]} />
      <hemisphereLight args={['#cfe6ff', '#4a6b33', 1.15]} />
      <directionalLight position={[-120, 70, 90]} intensity={2.1} color="#fff0d8" />
      <mesh>
        <sphereGeometry args={[760, 24, 16]} />
        <meshBasicMaterial map={tex.sky} side={THREE.BackSide} fog={false} />
      </mesh>
      <Hills />
      <PerspectiveCamera ref={cam} makeDefault fov={58} near={0.1} far={800} position={[0, 4, -12]} />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.03}>
        <planeGeometry args={[1400, 1400]} />
        <meshLambertMaterial map={tex.grass} />
      </mesh>
      <mesh geometry={geo.road}><meshLambertMaterial map={tex.asphalt} /></mesh>
      <mesh geometry={geo.lineL}><meshBasicMaterial color="#e8e8e8" /></mesh>
      <mesh geometry={geo.lineR}><meshBasicMaterial color="#e8e8e8" /></mesh>
      <mesh geometry={geo.kerbL}><meshLambertMaterial vertexColors /></mesh>
      <mesh geometry={geo.kerbR}><meshLambertMaterial vertexColors /></mesh>
      <mesh geometry={geo.wallL}><meshLambertMaterial map={tex.banner} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.wallR}><meshLambertMaterial map={tex.banner} side={THREE.DoubleSide} /></mesh>

      {/* Start / finish line and gantry */}
      <group position={[start.x, 0, start.z]} rotation={[0, startDir, 0]}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <planeGeometry args={[HALF * 2, 2]} />
          <meshBasicMaterial map={tex.flag} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (HALF + 2.5), 3.5, 0]}><boxGeometry args={[0.6, 7, 0.6]} /><meshLambertMaterial color="#2b2d33" /></mesh>
        ))}
        <mesh position={[0, 7.2, 0]}><boxGeometry args={[HALF * 2 + 6, 1.4, 0.6]} /><meshLambertMaterial color={LIVERY.red} /></mesh>
        {/* the start lights: five pods facing the grid, lit by the race in useFrame */}
        <mesh position={[0, 5.9, -0.2]}><boxGeometry args={[6.4, 1.2, 0.4]} /><meshLambertMaterial color={LIVERY.ink} /></mesh>
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} position={[(k - 2) * 1.25, 5.9, -0.42]} rotation-y={Math.PI}>
            <circleGeometry args={[0.42, 20]} />
            <meshBasicMaterial ref={(m) => { startLights.current[k] = m; }} color="#2a0c0e" />
          </mesh>
        ))}
      </group>

      <Grandstand at={stand.at} facing={stand.facing} length={stand.length} />
      {brakeBoards.map((b) => <BrakeBoard key={b.m} metres={b.m} at={b.at} facing={b.facing} />)}

      <mesh geometry={geo.pit}><meshLambertMaterial color="#4a4c53" /></mesh>
      <mesh geometry={geo.pitLine}><meshBasicMaterial color="#f2f2f2" /></mesh>
      {garageSpots.map((g, k) => (
        <Garage key={k} k={k} at={g.at} facing={g.facing} width={BAY - 0.6} ref={(m) => { doors.current[k] = m; }} />
      ))}
      {boards.map((b, k) => <Billboard key={k} k={k} at={b.at} facing={b.facing} />)}

      <instancedMesh ref={trees} args={[undefined, undefined, 260]}>
        <coneGeometry args={[2.2, 6, 7]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>

      <Car ref={car} wheels={wheels} />
      <Car ref={rival} wheels={rivalWheels} livery="#1f5fd1" accent={LIVERY.chalk} num="AI" />
    </>
  );
}
