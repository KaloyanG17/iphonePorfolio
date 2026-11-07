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

// Satin metal frame and a frosted-glass back in four colourways; the front is always black glass
const FINISH: Record<Finish, { band: string; back: string; logo: string; module: string }> = {
  black: { band: '#3d3f45', back: '#1d1e22', logo: '#8f9299', module: '#25262b' },
  white: { band: '#cdc9c0', back: '#e8e5de', logo: '#8a867e', module: '#dcd8d0' },
  teal: { band: '#3e7c75', back: '#2d6a63', logo: '#bfe8e2', module: '#33736c' },
  sunset: { band: '#c4623d', back: '#d7764e', logo: '#ffe1d2', module: '#cc6b45' },
};

// kgOS 5 hardware, in centimetres: flat edges, thin even bezels, a 390 x 844 point screen
const W = 7.0;
const H = 14.7;
const D = 0.8;
const R = 1.12;
const GLASS = 0.035;
const FRONT = D / 2;
const SCREEN_PX = 390;
const SCREEN_PX_H = 844;
const SCREEN_W = 6.6;
const SCREEN_H = (SCREEN_W * SCREEN_PX_H) / SCREEN_PX;
const SCREEN_R = R - (W - SCREEN_W) / 2; // the display's corners follow the frame's
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

// A flat rounded rectangle whose UVs run 0..1 across it, so a texture fills it edge to edge
function roundedPlane(w: number, h: number, r: number) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24);
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
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
    // Fine, low-contrast streaks give the frame a satin finish rather than a mirror
    const brushed = canvasTexture(512, 512, (c) => {
      c.fillStyle = '#8a8a8a';
      c.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 4200; i++) {
        const v = 125 + Math.random() * 30;
        c.fillStyle = `rgba(${v},${v},${v},0.25)`;
        c.fillRect(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 120, 1);
      }
    });
    brushed.colorSpace = THREE.NoColorSpace;
    brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
    brushed.repeat.set(3, 3);

    // The back mark: a small "kg" at the centre and the maker's line near the bottom, tinted by the finish
    const back = canvasTexture(512, 1024, (c) => {
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.font = '700 96px system-ui, "Segoe UI", sans-serif';
      c.fillText('kg', 256, 540);
      c.font = '500 20px system-ui, "Segoe UI", sans-serif';
      c.globalAlpha = 0.7;
      c.fillText('Designed by Kaloyan in Varna', 256, 930);
    });

    return { brushed, back };
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
      band: slab(W, H, R, D - GLASS * 2 + 0.02, 0.045),
      glass: slab(W - 0.06, H - 0.06, R - 0.03, GLASS, 0.01),
      panel: roundedPlane(SCREEN_W + 0.03, SCREEN_H + 0.03, SCREEN_R + 0.015),
      race: roundedPlane(SCREEN_H, SCREEN_W, SCREEN_R),
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#3d3f45', metalness: 0.85, roughness: 0.34, roughnessMap: tex.brushed, bumpMap: tex.brushed, bumpScale: 0.12 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#050506', metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
      backGlass: new THREE.MeshPhysicalMaterial({ color: '#1d1e22', metalness: 0.1, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
      module: new THREE.MeshPhysicalMaterial({ color: '#25262b', metalness: 0.2, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#05070b', metalness: 0.7, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }),
      line: new THREE.MeshStandardMaterial({ color: '#2a2b2f', roughness: 0.6 }),
      hole: new THREE.MeshStandardMaterial({ color: '#030303', roughness: 1 }),
      panel: new THREE.MeshPhysicalMaterial({ color: '#020203', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }),
      logo: new THREE.MeshStandardMaterial({ map: tex.back, transparent: true, metalness: 0.4, roughness: 0.4 }),
    }),
    [tex],
  );

  useEffect(() => {
    const f = FINISH[finish];
    mats.steel.color.set(f.band);
    mats.backGlass.color.set(f.back);
    mats.module.color.set(f.module);
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
    if (mute.current) mute.current.position.y += ((muted ? -0.08 : 0.08) - mute.current.position.y) * Math.min(1, dt * 18);
  });

  return (
    <group ref={group} rotation={[0, reduced ? 0 : -Math.PI, 0]}>
      <group ref={body}>
        <mesh geometry={geo.band} material={mats.steel} castShadow />
        <mesh geometry={geo.glass} material={mats.glass} position={[0, 0, FRONT - GLASS / 2]} />
        <mesh geometry={geo.glass} material={mats.backGlass} position={[0, 0, -FRONT + GLASS / 2]} />
      </group>

      {/* Antenna lines across the frame, near each corner */}
      {([[-W / 2 + 1.4, H / 2], [W / 2 - 1.4, H / 2], [-W / 2 + 1.4, -H / 2], [W / 2 - 1.4, -H / 2]] as const).map(([x, y]) => (
        <mesh key={`${x}${y}`} position={[x, y, 0]} material={mats.line}>
          <boxGeometry args={[0.06, 0.12, D - 0.12]} />
        </mesh>
      ))}

      {/* Front: an earpiece slit in the top bezel (the camera is a punch-hole in the display) */}
      <RoundedBox args={[1.1, 0.045, 0.02]} radius={0.02} position={[0, SCREEN_H / 2 + (H - SCREEN_H) / 4, FRONT + 0.001]} material={mats.hole} />

      {/* Back: the mark, and a raised pill-shaped camera block with two lenses and a flash beside it */}
      <mesh position={[0, -0.4, -FRONT - 0.003]} rotation={[0, Math.PI, 0]} material={mats.logo}>
        <planeGeometry args={[2.4, 4.8]} />
      </mesh>
      <group position={[W / 2 - 1.2, H / 2 - 2.05, -FRONT - 0.05]} rotation={[0, Math.PI, 0]}>
        <RoundedBox args={[1.32, 2.9, 0.1]} radius={0.05} smoothness={4} material={mats.module} />
        {[0.72, -0.72].map((y) => (
          <group key={y} position={[0, y, 0.06]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.steel}><cylinderGeometry args={[0.5, 0.5, 0.07, 48]} /></mesh>
            <mesh position={[0, 0, 0.037]} material={mats.lens}><circleGeometry args={[0.39, 48]} /></mesh>
            <mesh position={[0.1, 0.1, 0.039]}><circleGeometry args={[0.12, 24]} /><meshStandardMaterial color="#1b2a44" metalness={0.9} roughness={0.05} /></mesh>
          </group>
        ))}
        <mesh position={[-1.05, 0.72, -0.045]}><circleGeometry args={[0.13, 32]} /><meshStandardMaterial color="#e3dcc4" emissive="#2a2410" roughness={0.3} /></mesh>
        <mesh position={[-1.05, 0.22, -0.045]} material={mats.hole}><circleGeometry args={[0.04, 16]} /></mesh>
      </group>

      {/* The display panel under the glass stays black whatever the finish */}
      <mesh geometry={geo.panel} position={[0, 0, FRONT + 0.001]} material={mats.panel} />

      {/* Bottom edge: USB-C port and two rows of speaker holes */}
      <RoundedBox args={[0.95, 0.07, 0.3]} radius={0.03} position={[0, -H / 2 - 0.005, 0]} material={mats.hole} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.85, -H / 2 - 0.002, 0]}>
          {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0]} material={mats.hole}><cylinderGeometry args={[0.045, 0.045, 0.02, 12]} /></mesh>
          ))}
        </group>
      ))}

      {/* Side buttons: power on the right, volume and the silent switch on the left */}
      <PressButton name="sleep" label="Power button" position={[W / 2 + 0.035, 2.4, 0]} travel={[-0.05, 0, 0]} pulse={pulse} onPress={onButton}>
        <RoundedBox args={[0.1, 1.6, 0.3]} radius={0.045} material={mats.steel} />
      </PressButton>

      {([['volUp', 3.3], ['volDown', 2.0]] as const).map(([name, y]) => (
        <PressButton key={name} name={name} label={name === 'volUp' ? 'Volume up' : 'Volume down'} position={[-W / 2 - 0.035, y, 0]} travel={[0.05, 0, 0]} pulse={pulse} onPress={onButton}>
          <RoundedBox args={[0.1, 1.05, 0.3]} radius={0.045} material={mats.steel} />
        </PressButton>
      ))}

      <PressButton name="mute" label="Silent switch" position={[-W / 2 - 0.03, 4.7, 0]} travel={[0, 0, 0]} pulse={pulse} onPress={onButton}>
        <mesh position={[-0.052, 0, 0]} rotation={[0, -Math.PI / 2, 0]} visible={muted}>
          <planeGeometry args={[0.2, 0.3]} />
          <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
        </mesh>
        <group ref={mute}>
          <RoundedBox args={[0.1, 0.36, 0.22]} radius={0.04} material={mats.steel} />
        </group>
      </PressButton>

      {/* The live screen: real DOM, so text stays sharp and everything stays accessible */}
      {/* The race is drawn into a texture on the screen glass; counter-rotated so it reads upright in landscape */}
      {racing && (
        <mesh geometry={geo.race} position={[0, 0, FRONT + 0.002]} rotation={[0, 0, -Math.PI / 2]}>
          <meshBasicMaterial toneMapped={false}>
            <RenderTexture attach="map" width={LOW_POWER ? 1080 : 1620} height={LOW_POWER ? 500 : 750} anisotropy={LOW_POWER ? 2 : 8}>
              <RaceScene />
            </RenderTexture>
          </meshBasicMaterial>
        </mesh>
      )}

      <Html transform occlude={[body as RefObject<THREE.Object3D>]} position={[0, 0, FRONT + 0.004]} scale={HTML_SCALE} zIndexRange={[20, 0]}>
        <div className="screen3d">
          {screen}
          <span className="punch" aria-hidden="true" />
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
    const narrow = aspect < 0.8; // a phone held upright
    const tall = H * (1 - l.current) + W * l.current;
    // On a narrow screen the race fits the phone's display, not its body, to the width: the bezels run off the
    // edges and the game gets about twice the pixels. Elsewhere the whole phone stays in view.
    const wide = W * (1 - l.current) + (narrow ? SCREEN_H : H) * l.current;
    const fillH = narrow ? 0.9 : 0.76;
    const fillW = narrow ? 0.94 + 0.03 * l.current : 0.8 - 0.08 * l.current;
    const fit = Math.max(tall / fillH / 2 / half, wide / fillW / 2 / half / aspect);
    const near = narrow ? 0.98 : 0.9; // portrait screens have no room to push in
    const target = focus === 'far' ? (narrow ? 1.03 : 1.12) : focus === 'near' ? near : 1;
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
