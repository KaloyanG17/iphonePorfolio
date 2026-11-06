'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Environment, Html, Lightformer, RenderTexture, RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import RaceScene from './RaceScene';

// Phones and low-core machines get a smaller race texture and pixel ratio, to hold the frame rate
const LOW_POWER = typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4);

export type Btn = 'home' | 'sleep' | 'volUp' | 'volDown' | 'mute';
export type Pulse = { btn: Btn; id: number };
export type Finish = 'black' | 'white' | 'teal' | 'sunset';
export type Focus = 'far' | 'mid' | 'near';

const FINISH: Record<Finish, { front: string; back: string; logo: string; home: string; ear: string }> = {
  black: { front: '#050506', back: '#0b0b0d', logo: '#ffffff', home: '#0c0c0e', ear: '#141416' },
  white: { front: '#efefec', back: '#f3f3f0', logo: '#5d6068', home: '#f4f4f1', ear: '#8f9298' },
  teal: { front: '#050506', back: '#13a597', logo: '#e6fffb', home: '#0c0c0e', ear: '#141416' },
  sunset: { front: '#050506', back: '#ff5f33', logo: '#fff0e8', home: '#0c0c0e', ear: '#141416' },
};
const SCREEN_H = 7.41;

// Real iPhone 4-class proportions in centimetres
const W = 5.86;
const H = 11.52;
const D = 0.93;
const R = 0.86;
const GLASS = 0.04;
const FRONT = D / 2;
const HOME_Y = -4.73;
const TOP_Y = 4.75;
const SCREEN_PX = 320;
const SCREEN_W = 4.94;
// drei <Html transform> renders 1 CSS px as 1/40 of a world unit
const HTML_SCALE = SCREEN_W / (SCREEN_PX / 40);

// R3F listens on the canvas wrapper, which also contains the screen DOM: ignore taps that started on the screen
const fromCanvas = (e: ThreeEvent<PointerEvent>) => (e.nativeEvent.target as HTMLElement).tagName === "CANVAS";

type Rot = {
  rx: number; ry: number; vx: number; vy: number;
  dragging: boolean; lastX: number; lastY: number; lastT: number;
  px: number; py: number;
  rz: number; vz: number; tz: number; // tz: 0 portrait, PI/2 landscape
};

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function slab(w: number, h: number, r: number, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, r - bevel), {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 32,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  draw(el.getContext('2d')!);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function useTextures() {
  return useMemo(() => {
    // Fine horizontal streaks give the steel band a brushed finish
    const brushed = canvasTexture(512, 512, (c) => {
      c.fillStyle = '#888';
      c.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2600; i++) {
        const v = 110 + Math.random() * 60;
        c.fillStyle = `rgba(${v},${v},${v},0.35)`;
        c.fillRect(Math.random() * 512, Math.random() * 512, 40 + Math.random() * 160, 1);
      }
    });
    brushed.colorSpace = THREE.NoColorSpace;
    brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
    brushed.repeat.set(3, 3);

    const back = canvasTexture(512, 1024, (c) => {
      const g = c.createLinearGradient(0, 300, 0, 520);
      g.addColorStop(0, '#f2f3f5');
      g.addColorStop(1, '#9ea3ab');
      c.fillStyle = g;
      c.textAlign = 'center';
      c.font = '700 150px "Helvetica Neue", Helvetica, Arial, sans-serif';
      c.fillText('kg', 256, 470);
      c.fillStyle = 'rgba(220,222,226,0.85)';
      c.font = '500 46px "Helvetica Neue", Helvetica, Arial, sans-serif';
      c.fillText('kgOS', 256, 760);
      c.font = '20px "Helvetica Neue", Helvetica, Arial, sans-serif';
      c.fillStyle = 'rgba(200,202,206,0.7)';
      c.fillText('Designed by Kaloyan in Varna', 256, 900);
      c.fillText('Model KG-4  ·  Full-stack edition', 256, 930);
    });

    const homeIcon = canvasTexture(128, 128, (c) => {
      c.strokeStyle = 'rgba(170,172,178,0.9)';
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(40, 40, 48, 48, 11);
      c.stroke();
    });

    return { brushed, back, homeIcon };
  }, []);
}

/* A hardware button that sinks along `travel` while pressed, by pointer or by keyboard pulse */
function PressButton({ name, travel, pulse, onPress, children, position, label }: {
  name: Btn;
  travel: [number, number, number];
  pulse: Pulse | null;
  onPress: (b: Btn) => void;
  children: ReactNode;
  position: [number, number, number];
  label: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const held = useRef(false);
  const p = useRef(0);

  useEffect(() => {
    if (pulse?.btn !== name) return;
    held.current = true;
    const id = setTimeout(() => (held.current = false), 140);
    return () => clearTimeout(id);
  }, [pulse, name]);

  useEffect(() => {
    const up = () => (held.current = false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  useFrame((_, dt) => {
    p.current += ((held.current ? 1 : 0) - p.current) * Math.min(1, dt * 30);
    ref.current?.position.set(position[0] + travel[0] * p.current, position[1] + travel[1] * p.current, position[2] + travel[2] * p.current);
  });

  return (
    <group
      ref={ref}
      position={position}
      name={label}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!fromCanvas(e)) return;
        e.stopPropagation();
        held.current = true;
        onPress(name);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {children}
    </group>
  );
}

function Device({ screen, muted, pulse, onButton, rot, reduced, finish, racing }: {
  racing: boolean;
  screen: ReactNode;
  muted: boolean;
  finish: Finish;
  pulse: Pulse | null;
  onButton: (b: Btn) => void;
  rot: RefObject<Rot>;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const glare = useRef<HTMLDivElement>(null);
  const mute = useRef<THREE.Group>(null);
  const tex = useTextures();

  const geo = useMemo(
    () => ({
      band: slab(W, H, R, D - GLASS * 2 + 0.02, 0.06),
      glass: slab(W - 0.12, H - 0.12, R - 0.06, GLASS, 0.012),
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#d7dade', metalness: 1, roughness: 0.2, roughnessMap: tex.brushed, bumpMap: tex.brushed, bumpScale: 0.6 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#050506', metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
      backGlass: new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', metalness: 0.2, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
      dark: new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.4, roughness: 0.5 }),
      hole: new THREE.MeshStandardMaterial({ color: '#030303', roughness: 1 }),
      panel: new THREE.MeshPhysicalMaterial({ color: '#020203', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }),
      home: new THREE.MeshPhysicalMaterial({ color: '#0c0c0e', roughness: 0.18, clearcoat: 0.6 }),
      logo: new THREE.MeshStandardMaterial({ map: tex.back, transparent: true, metalness: 0.6, roughness: 0.25 }),
    }),
    [tex],
  );

  useEffect(() => {
    const f = FINISH[finish];
    mats.glass.color.set(f.front);
    mats.backGlass.color.set(f.back);
    mats.home.color.set(f.home);
    mats.dark.color.set(f.ear);
    mats.logo.color.set(f.logo);
  }, [finish, mats]);

  useFrame((state, delta) => {
    const s = rot.current;
    const dt = Math.min(delta, 1 / 30);
    if (!s.dragging) {
      // Underdamped spring (damping 0.75, response 0.9s) pulls the phone back to face you after a throw
      const k = (2 * Math.PI / 0.9) ** 2;
      const c = 2 * 0.75 * Math.sqrt(k);
      const ty = Math.round(s.ry / (Math.PI * 2)) * Math.PI * 2 + s.px * 0.22;
      const tx = s.py * 0.12 + 0.03;
      s.vy += (k * (ty - s.ry) - c * s.vy) * dt;
      s.vx += (k * (tx - s.rx) - c * s.vx) * dt;
      s.ry += s.vy * dt;
      s.rx += s.vx * dt;
    }
    const g = group.current!;
    // Turning to landscape: a firm, barely overshooting spring (damping 0.85, response 0.7s)
    const kz = (2 * Math.PI / 0.7) ** 2;
    s.vz += (kz * (s.tz - s.rz) - 2 * 0.85 * Math.sqrt(kz) * s.vz) * dt;
    s.rz += s.vz * dt;
    g.rotation.set(s.rx, s.ry, s.rz);
    g.position.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.9) * 0.08;

    if (glare.current) {
      glare.current.style.setProperty('--gx', `${50 - Math.sin(s.ry) * 120}%`);
      glare.current.style.setProperty('--gy', `${50 + s.rx * 120}%`);
    }
    if (mute.current) mute.current.position.z += ((muted ? -0.09 : 0.09) - mute.current.position.z) * Math.min(1, dt * 18);
  });

  return (
    <group ref={group} rotation={[0, reduced ? 0 : -Math.PI, 0]}>
      <group ref={body}>
        <mesh geometry={geo.band} material={mats.steel} castShadow />
        <mesh geometry={geo.glass} material={mats.glass} position={[0, 0, FRONT - GLASS / 2]} />
        <mesh geometry={geo.glass} material={mats.backGlass} position={[0, 0, -FRONT + GLASS / 2]} />
      </group>

      {/* Antenna gaps in the steel band */}
      {([[-1.7, H / 2], [-1.35, -H / 2], [1.35, -H / 2]] as const).map(([x, y]) => (
        <mesh key={`${x}${y}`} position={[x, y, 0]} material={mats.hole}>
          <boxGeometry args={[0.07, 0.16, D - 0.1]} />
        </mesh>
      ))}

      {/* Front details */}
      <RoundedBox args={[0.95, 0.13, 0.02]} radius={0.06} position={[0, TOP_Y, FRONT + 0.002]} material={mats.dark} />
      <mesh position={[-1.05, TOP_Y, FRONT + 0.003]}>
        <circleGeometry args={[0.1, 32]} />
        <meshStandardMaterial color="#0a1630" metalness={0.6} roughness={0.15} />
      </mesh>

      {/* Back details */}
      <mesh position={[0, 0, -FRONT - 0.003]} rotation={[0, Math.PI, 0]} material={mats.logo}>
        <planeGeometry args={[3.2, 6.4]} />
      </mesh>
      {/* The display panel under the glass stays black whatever the finish */}
      <mesh position={[0, 0, FRONT + 0.001]} material={mats.panel}>
        <planeGeometry args={[SCREEN_W + 0.04, SCREEN_H + 0.04]} />
      </mesh>
      <group position={[W / 2 - 0.75, H / 2 - 0.75, -FRONT - 0.004]} rotation={[0, Math.PI, 0]}>
        <mesh material={mats.steel}><circleGeometry args={[0.3, 48]} /></mesh>
        <mesh position={[0, 0, 0.002]}><circleGeometry args={[0.22, 48]} /><meshStandardMaterial color="#05070c" metalness={0.8} roughness={0.08} /></mesh>
        <mesh position={[-0.75, 0, 0.002]}><circleGeometry args={[0.13, 32]} /><meshStandardMaterial color="#d9d2b8" emissive="#2a2410" roughness={0.3} /></mesh>
      </group>

      {/* Bottom: dock connector and speaker grilles. Top: headphone jack */}
      <RoundedBox args={[1.9, 0.08, 0.26]} radius={0.03} position={[0, -H / 2 - 0.01, 0]} material={mats.hole} />
      {[-1.65, 1.65].map((x) => (
        <group key={x} position={[x, -H / 2 - 0.01, 0]}>
          {[-0.3, -0.15, 0, 0.15, 0.3].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0]} material={mats.hole}><boxGeometry args={[0.07, 0.06, 0.07]} /></mesh>
          ))}
        </group>
      ))}
      <mesh position={[-1.75, H / 2 + 0.001, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.hole}>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 32]} />
      </mesh>

      {/* Hardware buttons */}
      <PressButton name="home" label="Home button" position={[0, HOME_Y, FRONT - 0.012]} travel={[0, 0, -0.03]} pulse={pulse} onPress={onButton}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.03, 64]} />
          <primitive object={mats.home} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <planeGeometry args={[1.1, 1.1]} />
          <meshBasicMaterial map={tex.homeIcon} transparent toneMapped={false} />
        </mesh>
      </PressButton>

      <PressButton name="sleep" label="Sleep button" position={[1.55, H / 2 + 0.05, 0]} travel={[0, -0.06, 0]} pulse={pulse} onPress={onButton}>
        <RoundedBox args={[0.95, 0.12, 0.36]} radius={0.05} material={mats.steel} />
      </PressButton>

      {([['volUp', 2.95], ['volDown', 2.05]] as const).map(([name, y]) => (
        <PressButton key={name} name={name} label={name === 'volUp' ? 'Volume up' : 'Volume down'} position={[-W / 2 - 0.05, y, 0]} travel={[0.06, 0, 0]} pulse={pulse} onPress={onButton}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={mats.steel}>
            <cylinderGeometry args={[0.24, 0.24, 0.12, 48]} />
          </mesh>
          <mesh position={[-0.065, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.18, 0.03]} />
            <meshStandardMaterial color="#6d7077" metalness={1} roughness={0.4} />
          </mesh>
          {name === 'volUp' && (
            <mesh position={[-0.065, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.03, 0.18]} />
              <meshStandardMaterial color="#6d7077" metalness={1} roughness={0.4} />
            </mesh>
          )}
        </PressButton>
      ))}

      <PressButton name="mute" label="Silent switch" position={[-W / 2 - 0.04, 3.85, 0]} travel={[0, 0, 0]} pulse={pulse} onPress={onButton}>
        <mesh position={[0.02, 0, 0.12]} rotation={[0, -Math.PI / 2, 0]} visible={muted}>
          <planeGeometry args={[0.16, 0.36]} />
          <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
        </mesh>
        <group ref={mute}>
          <RoundedBox args={[0.12, 0.42, 0.2]} radius={0.04} material={mats.steel} />
        </group>
      </PressButton>

      {/* The live screen: real DOM, so text stays sharp and everything stays accessible */}
      {/* The race is drawn into a texture on the screen glass; counter-rotated so it reads upright in landscape */}
      {racing && (
        <mesh position={[0, 0, FRONT + 0.002]} rotation={[0, 0, -Math.PI / 2]}>
          <planeGeometry args={[SCREEN_H, SCREEN_W]} />
          <meshBasicMaterial toneMapped={false}>
            <RenderTexture attach="map" width={LOW_POWER ? 720 : 1110} height={LOW_POWER ? 480 : 740} anisotropy={LOW_POWER ? 2 : 8}>
              <RaceScene />
            </RenderTexture>
          </meshBasicMaterial>
        </mesh>
      )}

      <Html transform occlude={[body as RefObject<THREE.Object3D>]} position={[0, 0, FRONT + 0.004]} scale={HTML_SCALE} zIndexRange={[20, 0]}>
        <div className="screen3d">
          {screen}
          <div ref={glare} className="glass-glare" aria-hidden="true" />
        </div>
      </Html>
    </group>
  );
}

// Dollies the camera: swoops in on load, pulls back when off, pushes in when an app is open
function CameraRig({ focus, reduced, landscape }: { focus: Focus; reduced: boolean; landscape: boolean }) {
  const l = useRef(0);
  const { camera, size } = useThree();
  const k = useRef(reduced ? 1.12 : 2.2);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const half = Math.tan((cam.fov * Math.PI) / 360);
    const aspect = size.width / size.height;
    l.current += ((landscape ? 1 : 0) - l.current) * (1 - Math.exp(-delta * 4));
    // Swap which side of the phone must fit the view as it turns on its side
    const tall = H * (1 - l.current) + W * l.current;
    const wide = W * (1 - l.current) + H * l.current;
    const fit = Math.max(tall / 0.76 / 2 / half, wide / (0.8 - 0.08 * l.current) / 2 / half / aspect);
    const near = aspect < 0.8 ? 0.98 : 0.9; // portrait screens have no room to push in
    const target = focus === 'far' ? 1.12 : focus === 'near' ? near : 1;
    k.current += (target - k.current) * (1 - Math.exp(-delta * (reduced ? 30 : 2.6)));
    cam.position.set(0, 0, fit * k.current);
  });
  return null;
}

export default function Phone3D({ screen, muted, pulse, onButton, onReady, finish, focus, racing }: {
  racing: boolean;
  screen: ReactNode;
  finish: Finish;
  focus: Focus;
  muted: boolean;
  pulse: Pulse | null;
  onButton: (b: Btn) => void;
  onReady: () => void;
}) {
  const reduced = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rot = useRef<Rot>({ rx: 0, ry: reduced ? 0 : -Math.PI, vx: 0, vy: 0, dragging: false, lastX: 0, lastY: 0, lastT: 0, px: 0, py: 0, rz: 0, vz: 0, tz: 0 });
  rot.current.tz = racing ? Math.PI / 2 : 0;

  useEffect(() => {
    const s = rot.current;
    const move = (e: PointerEvent) => {
      s.px = (e.clientX / innerWidth) * 2 - 1;
      s.py = (e.clientY / innerHeight) * 2 - 1;
      if (!s.dragging) return;
      const dt = Math.max(1, e.timeStamp - s.lastT) / 1000;
      const dy = (e.clientX - s.lastX) * 0.009;
      const dx = (e.clientY - s.lastY) * 0.007;
      s.ry += dy;
      s.rx = Math.max(-0.8, Math.min(0.8, s.rx + dx));
      // Smoothed velocity so the release hands the spring the finger's speed
      s.vy = s.vy * 0.6 + (dy / dt) * 0.4;
      s.vx = s.vx * 0.6 + (dx / dt) * 0.4;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.lastT = e.timeStamp;
    };
    const up = () => {
      s.dragging = false;
      document.body.classList.remove('grabbing');
    };
    // The browser can scroll the screen's wrappers (focus, iframes loading); that knocks the DOM
    // out of line with the 3D glass, so snap any wrapper around the screen back to 0.
    const unscroll = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.classList.contains('screen3d') || t.querySelector(':scope > * .screen3d, :scope > .screen3d'))) {
        t.scrollTop = 0;
        t.scrollLeft = 0;
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('scroll', unscroll, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('scroll', unscroll, true);
    };
  }, []);

  const grab = (e: ThreeEvent<PointerEvent>) => {
    if (!fromCanvas(e) || rot.current.tz) return; // no spinning the phone mid-race
    const s = rot.current;
    s.dragging = true;
    s.vx = s.vy = 0;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = e.timeStamp;
    document.body.classList.add('grabbing');
  };

  return (
    <Canvas
      className="phone-canvas"
      dpr={LOW_POWER ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 27], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={onReady}
    >
      <CameraRig focus={focus} reduced={reduced} landscape={racing} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 8, 10]} intensity={1.2} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.4} position={[0, 4, 12]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={3} position={[-12, 2, 2]} rotation-y={Math.PI / 2} scale={[24, 2, 1]} />
        <Lightformer form="rect" intensity={3} position={[12, -2, 2]} rotation-y={-Math.PI / 2} scale={[24, 2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="circle" intensity={4} position={[6, 6, -8]} scale={4} />
      </Environment>

      {/* Invisible backdrop: grabbing anywhere around the phone rotates it */}
      <mesh position={[0, 0, -6]} onPointerDown={grab}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group onPointerDown={grab}>
        <Device screen={screen} muted={muted} pulse={pulse} onButton={onButton} rot={rot} reduced={reduced} finish={finish} racing={racing} />
      </group>
      <ContactShadows position={[0, -H / 2 - 0.9, 0]} opacity={0.5} scale={16} blur={2.6} far={4} color="#000" />
    </Canvas>
  );
}
