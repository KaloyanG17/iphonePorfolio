'use client';

// Textures and trackside scenery for the race. Everything is drawn in code: no image or model files.
import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { career, pitProjects, profile } from '@/lib/data';

export const LIVERY = { asphalt: '#2b2d33', chalk: '#f2f1ec', red: '#e3141d', yellow: '#ffd21f', ink: '#101218' };

// The race fonts come from next/font as CSS variables; canvases need the real family names
const family = (v: string, fallback: string) =>
  (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || fallback;
const RACE = () => family('--font-race', 'system-ui, sans-serif');
const MONO = () => family('--font-mono', 'ui-monospace, monospace');

// Draw now, then again once the race fonts have loaded, so signs never stay in the fallback font
export function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  draw(x);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (document.fonts) {
    void Promise.all([document.fonts.load(`italic 900 40px ${RACE()}`), document.fonts.load(`700 20px ${MONO()}`)]).then(() => {
      x.clearRect(0, 0, w, h);
      draw(x);
      t.needsUpdate = true;
    });
  }
  return t;
}

// Fit a line of text to a width by shrinking the font
function fitText(x: CanvasRenderingContext2D, text: string, cx: number, y: number, max: number, size: number, weight = 'italic 900') {
  let s = size;
  do x.font = `${weight} ${s--}px ${RACE()}`;
  while (x.measureText(text).width > max && s > 10);
  x.fillText(text, cx, y);
}

export function checker() {
  const t = canvasTex(128, 16, (x) => {
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
      x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4';
      x.fillRect(i * 8, j * 8, 8, 8);
    }
  });
  t.magFilter = THREE.NearestFilter;
  return t;
}

const repeat = (t: THREE.Texture) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

// Asphalt: speckled grey with faint darker racing line patches
export function asphaltTex() {
  return repeat(canvasTex(256, 256, (x) => {
    x.fillStyle = '#44464d';
    x.fillRect(0, 0, 256, 256);
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) {
      const v = 50 + rnd() * 50;
      x.fillStyle = `rgb(${v},${v},${v + 4})`;
      x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    }
    x.fillStyle = 'rgba(20,20,24,0.18)'; // rubbered-in line down the middle
    x.fillRect(96, 0, 64, 256);
  }));
}

// Grass: mown stripes
export function grassTex() {
  const t = repeat(canvasTex(64, 64, (x) => {
    x.fillStyle = '#4f9a3e';
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#5aa846';
    x.fillRect(0, 0, 64, 32);
  }));
  t.repeat.set(70, 70);
  t.magFilter = THREE.NearestFilter;
  return t;
}

// Barrier advertising: the projects and stack, repeating round the lap
export function bannerTex() {
  const words = ['KG', ...pitProjects.map((p) => p.name), 'NEXT.JS', 'THREE.JS', 'TYPESCRIPT', 'VUE', 'PHP'];
  const t = repeat(canvasTex(2048, 64, (x) => {
    let px = 0;
    words.forEach((w, i) => {
      const width = 2048 / words.length;
      const red = i % 2 === 0;
      x.fillStyle = red ? LIVERY.red : LIVERY.chalk;
      x.fillRect(px, 0, width, 64);
      x.fillStyle = red ? LIVERY.chalk : LIVERY.ink;
      x.textAlign = 'center';
      fitText(x, w.toUpperCase(), px + width / 2, 48, width - 16, 46);
      px += width;
    });
  }));
  return t;
}

// Sky: deep blue overhead fading to a warm hazy horizon
export function skyTex() {
  return canvasTex(4, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#2f6fc4');
    g.addColorStop(0.42, '#8cc0ec');
    g.addColorStop(0.5, '#f4d9b8');
    g.addColorStop(1, '#f4d9b8');
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
  });
}

// Soft round shadow for under the cars: much cheaper than real shadow maps inside the render texture
export function blobTex() {
  return canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
  });
}

export function numberTex(n: string, bg: string, fg: string) {
  return canvasTex(128, 128, (x) => {
    x.fillStyle = bg;
    x.beginPath();
    x.arc(64, 64, 60, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = fg;
    x.textAlign = 'center';
    fitText(x, n, 64, 92, 100, 84);
  });
}

function billboardTex(k: number) {
  const c = career[k];
  return canvasTex(512, 256, (x) => {
    x.fillStyle = LIVERY.ink;
    x.fillRect(0, 0, 512, 256);
    x.fillStyle = LIVERY.red;
    x.beginPath();
    x.moveTo(0, 0); x.lineTo(150, 0); x.lineTo(110, 256); x.lineTo(0, 256);
    x.fill();
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    fitText(x, 'S', 62, 116, 90, 90);
    fitText(x, String(k + 1), 62, 214, 90, 110);
    x.textAlign = 'left';
    x.fillStyle = LIVERY.yellow;
    x.font = `700 22px ${MONO()}`;
    x.fillText(`SECTOR ${k + 1} · ${c.when.replace(/\s/g, '')}`, 150, 58);
    x.fillStyle = '#fff';
    fitText(x, c.title.toUpperCase(), 150, 132, 340, 60);
    x.fillStyle = '#aab1c0';
    fitText(x, c.org, 150, 186, 340, 36, '600');
  });
}

function garageSignTex(k: number) {
  const p = pitProjects[k];
  return canvasTex(512, 96, (x) => {
    const g = x.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, p.colors[1]);
    g.addColorStop(1, p.colors[0]);
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 96);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(0, 0, 64, 96);
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    fitText(x, String(k + 1), 32, 70, 56, 60);
    fitText(x, p.name.toUpperCase(), 288, 70, 420, 64);
  });
}

// One garage: open-fronted box facing the track, a branded sign, and a roller door that lifts when you park
export const Garage = forwardRef<THREE.Mesh, { k: number; at: THREE.Vector3; facing: number; width: number }>(function Garage({ k, at, facing, width }, door) {
  const sign = useMemo(() => garageSignTex(k), [k]);
  const p = pitProjects[k];
  const D = 8;
  const H = 5;
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, facing, 0]}>
      {/* floor, back wall lit in the project's colour, side walls, roof */}
      <mesh position={[0, 0.02, -D / 2]} rotation-x={-Math.PI / 2}><planeGeometry args={[width, D]} /><meshLambertMaterial color="#5a5d66" /></mesh>
      <mesh position={[0, H / 2, -D]}><planeGeometry args={[width, H]} /><meshBasicMaterial color={p.colors[1]} /></mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[(sd * width) / 2, H / 2, -D / 2]}><boxGeometry args={[0.5, H, D]} /><meshLambertMaterial color="#e9eaee" /></mesh>
      ))}
      <mesh position={[0, H + 0.25, -D / 2]}><boxGeometry args={[width + 0.5, 0.5, D]} /><meshLambertMaterial color="#d9dbe0" /></mesh>
      <mesh position={[0, H + 1.1, 0.02]}><planeGeometry args={[width, width * (96 / 512)]} /><meshBasicMaterial map={sign} /></mesh>
      <mesh ref={door} position={[0, H / 2, -0.1]}><planeGeometry args={[width - 0.5, H]} /><meshLambertMaterial color="#9aa0aa" /></mesh>
    </group>
  );
});

export function Billboard({ k, at, facing }: { k: number; at: THREE.Vector3; facing: number }) {
  const tex = useMemo(() => billboardTex(k), [k]);
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, facing, 0]}>
      {[-4.5, 4.5].map((x) => (
        <mesh key={x} position={[x, 2.5, -0.15]}><boxGeometry args={[0.35, 5, 0.35]} /><meshLambertMaterial color="#2b2d33" /></mesh>
      ))}
      <mesh position={[0, 5.6, 0]}><planeGeometry args={[12, 6]} /><meshBasicMaterial map={tex} /></mesh>
      <mesh position={[0, 5.6, -0.05]} rotation-y={Math.PI}><planeGeometry args={[12, 6]} /><meshLambertMaterial color="#1a1c22" /></mesh>
    </group>
  );
}

// Grandstand: stepped terraces with an instanced crowd and a roof carrying the event name
export function Grandstand({ at, facing, length }: { at: THREE.Vector3; facing: number; length: number }) {
  const crowd = useRef<THREE.InstancedMesh>(null);
  const ROWS = 6;
  const PER = Math.floor(length / 1.1);
  const roof = useMemo(
    () => canvasTex(1024, 96, (x) => {
      x.fillStyle = LIVERY.ink;
      x.fillRect(0, 0, 1024, 96);
      x.fillStyle = LIVERY.red;
      x.fillRect(0, 84, 1024, 12);
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      fitText(x, `${profile.name.toUpperCase()} GRAND PRIX`, 512, 70, 980, 76);
    }),
    [],
  );
  useLayoutEffect(() => {
    const m = crowd.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const shirts = ['#e3141d', '#f2f1ec', '#ffd21f', '#1f5fd1', '#2b2d33', '#e86a1c', '#3a9a4a'];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let n = 0;
    for (let r = 0; r < ROWS; r++)
      for (let k = 0; k < PER; k++) {
        o.position.set(-length / 2 + 0.6 + k * 1.1 + (rnd() - 0.5) * 0.3, 1.0 + r * 0.9 + 0.45, -1 - r * 1.4);
        o.scale.set(1, 0.8 + rnd() * 0.4, 1);
        o.updateMatrix();
        m.setMatrixAt(n, o.matrix);
        m.setColorAt(n++, c.set(shirts[Math.floor(rnd() * shirts.length)]));
      }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [length, PER]);
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, facing, 0]}>
      {Array.from({ length: ROWS }, (_, r) => (
        <mesh key={r} position={[0, 0.5 + r * 0.45, -1 - r * 1.4]}>
          <boxGeometry args={[length, 1 + r * 0.9, 1.4]} />
          <meshLambertMaterial color={r % 2 ? '#c9ccd2' : '#b8bcc4'} />
        </mesh>
      ))}
      <instancedMesh ref={crowd} args={[undefined, undefined, ROWS * PER]}>
        <boxGeometry args={[0.6, 0.9, 0.5]} />
        <meshLambertMaterial />
      </instancedMesh>
      {[-1, 0, 1].map((s) => (
        <mesh key={s} position={[(s * length) / 2.2, 5, -9]}><boxGeometry args={[0.4, 10, 0.4]} /><meshLambertMaterial color="#2b2d33" /></mesh>
      ))}
      <mesh position={[0, 10, -5]} rotation-x={-0.12}><boxGeometry args={[length + 2, 0.4, 10]} /><meshLambertMaterial color="#e9eaee" /></mesh>
      <mesh position={[0, 9.4, 0.02]}><planeGeometry args={[length, length * (96 / 1024)]} /><meshBasicMaterial map={roof} /></mesh>
    </group>
  );
}

// Braking boards counting down to a big corner
export function BrakeBoard({ at, facing, metres }: { at: THREE.Vector3; facing: number; metres: number }) {
  const tex = useMemo(
    () => canvasTex(128, 128, (x) => {
      x.fillStyle = LIVERY.chalk;
      x.fillRect(0, 0, 128, 128);
      x.strokeStyle = LIVERY.ink;
      x.lineWidth = 8;
      x.strokeRect(4, 4, 120, 120);
      x.fillStyle = LIVERY.ink;
      x.textAlign = 'center';
      fitText(x, String(metres), 64, 92, 110, 80);
    }),
    [metres],
  );
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, facing, 0]}>
      <mesh position={[0, 1.2, -0.05]}><boxGeometry args={[0.15, 2.4, 0.15]} /><meshLambertMaterial color="#2b2d33" /></mesh>
      <mesh position={[0, 2.6, 0]}><planeGeometry args={[1.8, 1.8]} /><meshBasicMaterial map={tex} /></mesh>
    </group>
  );
}

// Distant low-poly hills all round, so the horizon isn't a flat line
export function Hills() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 40;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 480 + (i % 3) * 40;
      const h = 40 + ((i * 37) % 50);
      o.position.set(20 + Math.cos(a) * r, h / 2 - 4, 70 + Math.sin(a) * r);
      o.scale.set(1.4 + (i % 4) * 0.3, h / 40, 1.4);
      o.rotation.y = a * 3;
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <coneGeometry args={[60, 40, 6]} />
      <meshLambertMaterial color="#6b8f78" flatShading />
    </instancedMesh>
  );
}
