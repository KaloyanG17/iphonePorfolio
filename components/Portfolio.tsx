'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { profile, type AppId } from '@/lib/data';
import { RACE_KEYS } from '@/lib/race';
import { haptic, setMuted as setSoundMuted, setVolume as setSoundVolume, sfx } from '@/lib/sound';
import { APP_META } from './icons';
import Phone2D from './Phone2D';
import type { Btn, Finish, Focus, Pulse } from './Phone3D';
import PhoneScreen, { type Hud, type Power } from './PhoneScreen';
import RaceBackdrop from './RaceBackdrop';

const Phone3D = dynamic(() => import('./Phone3D'), { ssr: false });

const JUMP: AppId[] = ['about', 'career', 'projects', 'messages', 'terminal'];
const KEY_BTN: Record<string, Btn> = {
  Escape: 'home', h: 'home', l: 'sleep', m: 'mute',
  ArrowUp: 'volUp', '+': 'volUp', '=': 'volUp', ArrowDown: 'volDown', '-': 'volDown',
};
// The backdrop takes on the colour of whatever is on screen
const ACCENT: Record<AppId, string> = {
  about: '#56627a', career: '#d5641a', projects: '#1c5fc0', messages: '#279a1f',
  terminal: '#1d7a3c', github: '#3e4756', linkedin: '#0a66c2', cv: '#b8302a',
};
const FINISHES: { id: Finish; label: string; swatch: string }[] = [
  { id: 'black', label: 'Black', swatch: '#111214' },
  { id: 'white', label: 'White', swatch: '#f1f1ee' },
  { id: 'teal', label: 'Teal', swatch: '#1fb5a8' },
  { id: 'sunset', label: 'Sunset', swatch: '#ff6a3d' },
];
type Origin = { x: number; y: number };

export default function Portfolio() {
  const [power, setPower] = useState<Power>('off');
  const [locked, setLocked] = useState(true);
  const [app, setApp] = useState<AppId | null>(null);
  const [closing, setClosing] = useState(false);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [web, setWeb] = useState<string | null>(null);
  const [racing, setRacing] = useState(false);
  const [banner, setBanner] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [volume, setVolume] = useState(0.6);
  const [muted, setMuted] = useState(false);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [finish, setFinish] = useState<Finish>('black');
  const [webgl, setWebgl] = useState(false);
  const [ready3d, setReady3d] = useState(false);
  const bootTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mainRef = useRef<HTMLElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  // Latest state for the global key handler without re-binding it every render
  const live = useRef({ power, locked, app, volume, muted, racing });
  live.current = { power, locked, app, volume, muted, racing };

  useEffect(() => {
    document.documentElement.classList.add('js');
  }, []);

  useEffect(() => {
    const c = document.createElement('canvas');
    setWebgl(!!(c.getContext('webgl2') || c.getContext('webgl')));
    const v = Number(localStorage.getItem('kg-volume') ?? 0.6);
    const m = localStorage.getItem('kg-muted') === '1';
    const f = localStorage.getItem('kg-finish') as Finish | null;
    setVolume(v);
    setMuted(m);
    setSoundVolume(v);
    setSoundMuted(m);
    if (f && FINISHES.some((x) => x.id === f)) setFinish(f);
    if (sessionStorage.getItem('kg-unlocked')) {
      setPower('on');
      setLocked(false);
    }
  }, []);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(false), 5000);
    return () => clearTimeout(id);
  }, [banner]);

  useEffect(() => {
    if (!hud) return;
    const id = setTimeout(() => setHud(null), 1300);
    return () => clearTimeout(id);
  }, [hud]);

  function wake() {
    const s = live.current;
    if (s.power === 'sleep') {
      setPower('on');
      sfx.tap();
    } else if (s.power === 'off') {
      setPower('boot');
      sfx.boot();
      bootTimer.current = setTimeout(() => {
        setPower('on');
        setLocked(true);
        sfx.message();
      }, 2200);
    }
  }

  function unlock() {
    sfx.unlock();
    haptic(12);
    setLocked(false);
    if (!sessionStorage.getItem('kg-unlocked')) {
      sessionStorage.setItem('kg-unlocked', '1');
      setTimeout(() => {
        setBanner(true);
        sfx.message();
      }, 900);
    }
  }

  function open(id: AppId, slug?: string, from?: Origin) {
    clearTimeout(bootTimer.current);
    clearTimeout(closeTimer.current);
    if (live.current.power !== 'on') setPower('on');
    if (live.current.locked) {
      setLocked(false);
      sessionStorage.setItem('kg-unlocked', '1');
    }
    sfx.tap();
    setBanner(false);
    setWeb(null);
    setClosing(false);
    setOrigin(from ?? null);
    setApp(id);
    setProject(slug ?? null);
  }

  // Apps shrink back into their icon before the home screen settles
  function closeApp() {
    setWeb(null);
    if (!live.current.app) return;
    setClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setApp(null);
      setProject(null);
      setClosing(false);
    }, 220);
  }

  function startRace() {
    clearTimeout(bootTimer.current);
    if (live.current.power !== 'on') setPower('on');
    setLocked(false);
    sessionStorage.setItem('kg-unlocked', '1');
    setBanner(false);
    setWeb(null);
    setApp(null);
    setProject(null);
    sfx.tap();
    setRacing(true);
  }

  function changeVolume(delta: number) {
    const v = Math.max(0, Math.min(1, Math.round((live.current.volume + delta) * 16) / 16));
    setVolume(v);
    setSoundVolume(v);
    localStorage.setItem('kg-volume', String(v));
    if (live.current.muted && delta > 0) toggleMute(false);
    sfx.volume();
    setHud({ kind: 'volume', id: Date.now() });
  }

  function toggleMute(next = !live.current.muted) {
    setMuted(next);
    setSoundMuted(next);
    localStorage.setItem('kg-muted', next ? '1' : '0');
    if (!next) sfx.tap();
    setHud({ kind: next ? 'silent' : 'ring', id: Date.now() });
  }

  function press(b: Btn) {
    haptic();
    const s = live.current;
    if (b === 'volUp' || b === 'volDown') {
      if (s.power === 'on') changeVolume(b === 'volUp' ? 1 / 16 : -1 / 16);
      else sfx.button();
      return;
    }
    if (b === 'mute') return toggleMute();
    sfx.button();
    if (s.racing) {
      setRacing(false); // home and lock both leave the race
      setWeb(null);
      if (b === 'home') return;
    }
    if (b === 'sleep') {
      if (s.power === 'on') {
        setPower('sleep');
        setLocked(true);
        setBanner(false);
        setWeb(null);
        sfx.lock();
      } else wake();
      return;
    }
    if (s.power !== 'on') wake();
    else if (!s.locked) closeApp();
  }

  // Keyboard presses animate the matching 3D button too
  function pressFromKey(b: Btn) {
    setPulse({ btn: b, id: Date.now() });
    press(b);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) {
        if (e.key === 'Escape') pressFromKey('home');
        return;
      }
      const s = live.current;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (s.racing && RACE_KEYS.includes(key)) return; // driving keys belong to the car
      const b = KEY_BTN[key];
      if (s.power === 'off' && !b) return wake();
      if (s.power === 'on' && s.locked && e.key === 'Enter' && t.tagName !== 'BUTTON') return unlock();
      if (b) {
        e.preventDefault();
        pressFromKey(b);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pickFinish = (f: Finish) => {
    setFinish(f);
    localStorage.setItem('kg-finish', f);
    sfx.tap();
  };

  const lit = power === 'on' || power === 'boot';
  const accent = !lit ? '#2a1d52' : racing ? '#9a0f17' : locked ? '#2c4a8a' : web ? '#0f7fbf' : app && !closing ? ACCENT[app] : '#5b3a9a';
  const focus: Focus = !lit ? 'far' : racing ? 'mid' : (app && !closing) || web ? 'near' : 'mid';

  const screen = (
    <PhoneScreen
      power={power}
      locked={locked}
      app={app}
      closing={closing}
      origin={origin}
      project={project}
      web={web}
      racing={racing}
      onRace={webgl && ready3d ? startRace : null}
      onExitRace={() => { setRacing(false); setWeb(null); }}
      banner={banner}
      hud={hud}
      volume={volume}
      onWake={wake}
      onUnlock={unlock}
      onOpen={open}
      onHome={closeApp}
      onHomeButton={() => press('home')}
      onWeb={setWeb}
      onBanner={() => {
        setBanner(false);
        open('messages');
      }}
      setProject={setProject}
    />
  );

  return (
    <main
      ref={mainRef}
      className={`page ${lit ? 'is-lit' : 'is-off'}`}
      style={{ '--accent': accent } as CSSProperties}
      onPointerMove={(e) => {
        if (spotRef.current) spotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }}
    >
      <div className="spot" ref={spotRef} aria-hidden="true" />
      {racing && <RaceBackdrop />}
      <div className={`backdrop ${racing ? 'hide' : ''}`} aria-hidden="true">
        <div className="marquee"><span>KALOYAN GAYDAROV · FULL-STACK DEVELOPER · KALOYAN GAYDAROV · FULL-STACK DEVELOPER ·&nbsp;</span></div>
        <div className="marquee reverse"><span>REACT · NEXT.JS · VUE · PHP · THREE.JS · TYPESCRIPT · REACT · NEXT.JS · VUE · PHP · THREE.JS · TYPESCRIPT ·&nbsp;</span></div>
        <div className="marquee"><span>SHIPLOG · HEXBOUND · SIMULATED MOTORSPORT · IMAGINIFY · SHIPLOG · HEXBOUND · SIMULATED MOTORSPORT ·&nbsp;</span></div>
      </div>

      <div className="slot">
        {webgl && (
          <div className={`stage ${ready3d ? 'ready' : ''}`}>
            <Phone3D racing={racing} screen={screen} muted={muted} pulse={pulse} finish={finish} focus={focus} onButton={press} onReady={() => setReady3d(true)} />
          </div>
        )}
        {!ready3d && <Phone2D screen={screen} />}
      </div>

      <header className="hud hud-tl">
        <h1>{profile.name}</h1>
        <p className="role">{profile.role} · {profile.location}</p>
        <nav className="jump" aria-label="Open an app on the phone">
          {webgl && <button type="button" className="jump-race" onClick={startRace}>Grand Prix</button>}
          {JUMP.map((id) => (
            <button key={id} type="button" onClick={() => open(id)}>{APP_META[id].label}</button>
          ))}
        </nav>
      </header>

      <nav className="hud hud-tr" aria-label="Links">
        <a className="pitwall-link" href="/pit-wall">Pit wall</a>
        <button type="button" onClick={() => open('github')}>GitHub</button>
        <button type="button" onClick={() => open('linkedin')}>LinkedIn</button>
        <button type="button" onClick={() => toggleMute()} aria-pressed={!muted}>{muted ? 'Sound off' : 'Sound on'}</button>
      </nav>

      <dl className="hud hud-bl legend">
        <div><dt><kbd>L</kbd></dt><dd>Power</dd></div>
        <div><dt><kbd>Esc</kbd></dt><dd>Home</dd></div>
        <div><dt><kbd>↑</kbd><kbd>↓</kbd></dt><dd>Volume</dd></div>
        <div><dt><kbd>M</kbd></dt><dd>Silent</dd></div>
        <div><dt><kbd>Drag</kbd></dt><dd>Spin it</dd></div>
      </dl>

      <div className="hud hud-br finishes" role="radiogroup" aria-label="Phone colour">
        {FINISHES.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={finish === f.id}
            aria-label={f.label}
            title={f.label}
            className={finish === f.id ? 'on' : ''}
            style={{ '--sw': f.swatch } as CSSProperties}
            onClick={() => pickFinish(f.id)}
          />
        ))}
      </div>

      {power === 'off' && (
        <button type="button" className="power-hint" onClick={wake}>
          <span className="dot" /> Press any key or tap the screen to power on
        </button>
      )}
    </main>
  );
}
