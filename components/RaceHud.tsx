'use client';

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { career, pitProjects, profile } from '@/lib/data';
import { fmt, input, race, type Phase } from '@/lib/race';
import { sfx } from '@/lib/sound';

type Props = { onExit: () => void; onWeb: (url: string) => void; onContact: () => void };

// Drawn over the race texture. The phone is on its side, so this layer is turned upright with CSS.
export default function RaceHud({ onExit, onWeb, onContact }: Props) {
  const speed = useRef<HTMLElement>(null);
  const time = useRef<HTMLElement>(null);
  const best = useRef<HTMLElement>(null);
  const lap = useRef<HTMLElement>(null);
  const sector = useRef<HTMLElement>(null);
  const warn = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(true);
  const [radio, setRadio] = useState<{ k: number; id: number } | null>(null);
  const [garage, setGarage] = useState(-1);
  const [phase, setPhase] = useState<Phase>('title');
  const [lights, setLights] = useState(0);
  const [podium, setPodium] = useState(false);
  const [auto, setAuto] = useState(false);
  const pos = useRef<HTMLElement>(null);

  const start = (autopilot = false) => {
    sfx.tap();
    Object.assign(race, { phase: 'lights', lightsAt: performance.now(), hold: 300 + Math.random() * 900, auto: autopilot, touring: false });
    setPodium(false);
  };
  const again = () => {
    race.resets++;
    start();
  };
  const freeDrive = () => {
    sfx.tap();
    race.phase = 'free';
    setPodium(false);
  };

  // Enter or Space starts from the title card
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && race.phase === 'title' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let id = 0;
    let seen = race.laps;
    let heard = race.radio;
    let parked = -1;
    let ph: Phase = race.phase;
    let lit = 0;
    let finishAt = 0;
    let shown = false;
    let piloted = false;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    let radioTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      speed.current!.textContent = String(Math.round(race.speed));
      time.current!.textContent = fmt(race.time);
      best.current!.textContent = fmt(race.best);
      lap.current!.textContent = String(race.lap);
      sector.current!.textContent = `S${race.sector + 1}`;
      warn.current!.classList.toggle('show', race.offTrack && race.speed > 10);
      // A completed lap flashes its time, except the finishing lap, which the flag screen shows
      const lapDone = race.laps !== seen;
      seen = race.laps;
      if (lapDone && race.phase !== 'finish') {
        const f = flash.current!;
        f.innerHTML = `<small>${race.newBest ? 'New best lap' : 'Lap time'}</small><b>${fmt(race.last)}</b>`;
        f.classList.toggle('best', race.newBest);
        f.classList.add('show');
        if (race.newBest) sfx.message();
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => f.classList.remove('show'), 2600);
      }
      // React state only changes on these rare events, never per frame
      if (race.radio !== heard) {
        heard = race.radio;
        setRadio({ k: race.sector, id: heard });
        clearTimeout(radioTimer);
        radioTimer = setTimeout(() => setRadio(null), 5200);
      }
      if (race.garage !== parked) {
        parked = race.garage;
        setGarage(parked);
      }
      pos.current!.textContent = race.phase === 'free' ? '–' : `P${race.pos}`;
      if (race.lights !== lit) setLights((lit = race.lights));
      if (race.auto !== piloted) setAuto((piloted = race.auto));
      if (race.phase !== ph) {
        ph = race.phase;
        setPhase(ph);
        finishAt = performance.now();
        shown = false;
      }
      // Flag first, then the podium; after Watch a lap it waits until the garage tour is done
      if (ph === 'finish' && !shown && !race.touring && performance.now() - finishAt > 2400) {
        shown = true;
        setPodium(true);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    const t = setTimeout(() => setHint(false), 14000); // covers the title card and the first seconds of driving
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
      clearTimeout(flashTimer);
      clearTimeout(radioTimer);
      Object.assign(input, { touchSteer: 0, touchThrottle: false, touchBrake: false });
      race.auto = false;
    };
  }, []);

  // Touch: hold the left or right half to steer that way; throttle is automatic while touching
  const press = (side: number) => (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    Object.assign(input, { touchSteer: side, touchThrottle: true });
  };
  const release = () => Object.assign(input, { touchSteer: 0, touchThrottle: false });

  // Touch pedals (shown on touch screens instead of the halves): each holds its own input while pressed, so they combine
  const pedal = (on: Partial<typeof input>, off: Partial<typeof input>) => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      Object.assign(input, on);
    },
    onPointerUp: () => Object.assign(input, off),
    onPointerCancel: () => Object.assign(input, off),
    onLostPointerCapture: () => Object.assign(input, off),
  });

  const c = radio && career[radio.k];
  const p = garage >= 0 ? pitProjects[garage] : null;

  return (
    <div className="race-hud">
      <div className="rh-touch" onPointerDown={press(1)} onPointerUp={release} onPointerCancel={release} />
      <div className="rh-touch right" onPointerDown={press(-1)} onPointerUp={release} onPointerCancel={release} />

      <div className="rh-pads left">
        <button type="button" aria-label="Steer left" {...pedal({ touchSteer: 1 }, { touchSteer: 0 })}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M16 4 6 12l10 8z" fill="currentColor" /></svg></button>
        <button type="button" aria-label="Steer right" {...pedal({ touchSteer: -1 }, { touchSteer: 0 })}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 4l10 8-10 8z" fill="currentColor" /></svg></button>
      </div>
      <div className="rh-pads right">
        <button type="button" aria-label="Brake" {...pedal({ touchBrake: true }, { touchBrake: false })}>Brake</button>
        <button type="button" aria-label="Throttle" className="gas" {...pedal({ touchThrottle: true }, { touchThrottle: false })}>Gas</button>
      </div>

      <div className="rh-top">
        <div className="rh-box"><small>Lap</small><b ref={lap}>1</b><small ref={sector}>S4</small></div>
        <div className="rh-box"><small>Time</small><b ref={time}>-:--.---</b><small>Best <span ref={best} /></small></div>
        <div className="rh-box"><small>Pos</small><b ref={pos}>P2</b><small>of 2</small></div>
        <div className="rh-speed"><b ref={speed}>0</b><small>km/h</small></div>
      </div>

      {phase === 'title' && (
        <div className="rh-title">
          <small>One lap, four sectors, six garages</small>
          <h2><span>{profile.name}</span>Grand Prix</h2>
          <p>Drive one lap of my career against an AI rival, then pull into the pit lane to try my projects.</p>
          <div className="rh-title-actions">
            <button type="button" className="rh-start" onClick={() => start()}>Press start</button>
            <button type="button" className="rh-watch" onClick={() => start(true)}>Watch a lap</button>
          </div>
          <a className="rh-pitwall" href="/pit-wall">Not driving? Read the pit wall</a>
        </div>
      )}

      {phase === 'lights' && (
        <div className="rh-lights" aria-label={`${lights} of 5 start lights on`}>
          {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= lights ? 'on' : ''} />)}
        </div>
      )}
      {phase === 'race' && <div className="rh-go" key="go">GO</div>}

      {phase === 'finish' && !podium && (
        <div className="rh-flag">
          <small>Chequered flag</small>
          <b>{fmt(race.result.time)}</b>
          <span>{race.result.pos === 1 ? 'P1, you beat the rival.' : 'P2, the rival got you.'}{race.result.best ? ' New best lap.' : ''}</span>
        </div>
      )}

      {phase === 'finish' && podium && (
        <div className="rh-podium">
          <div className="rh-podium-head">
            <span className={`rh-p p${race.result.pos}`}>P{race.result.pos}</span>
            <div>
              <small>Lap {fmt(race.result.time)}, best {fmt(race.best)}</small>
              <b>Hire the driver</b>
            </div>
          </div>
          <p>{profile.name}, {profile.role.toLowerCase()} in {profile.location}. Currently at {profile.company}.</p>
          <div className="rh-actions">
            <a className="go" href={profile.linkedin} target="_blank" rel="noreferrer" onClick={() => sfx.tap()}>LinkedIn ↗</a>
            <a href={profile.github} target="_blank" rel="noreferrer" onClick={() => sfx.tap()}>GitHub ↗</a>
            <button type="button" onClick={() => { sfx.tap(); onContact(); }}>Message me</button>
          </div>
          <div className="rh-actions quiet">
            <button type="button" onClick={again}>Race again</button>
            <button type="button" onClick={freeDrive}>Free drive &amp; pit lane</button>
          </div>
        </div>
      )}
      <div className="rh-warn" ref={warn}>Track limits</div>
      {auto && phase !== 'title' && <div className="rh-auto">Autopilot: press any driving key to take over</div>}
      <div className="rh-flash" ref={flash} aria-live="polite" />

      {c && (
        <div className="rh-radio" key={radio!.id} role="status">
          <small><i />Sector {radio!.k + 1}, {c.when}</small>
          <b>{c.title}</b>
          <span>{c.org}. {c.text}</span>
        </div>
      )}

      {p && (
        <div className="rh-card" key={p.slug} style={{ ['--c1' as string]: p.colors[0], ['--c2' as string]: p.colors[1] }}>
          <small>Pit lane, garage {garage + 1}</small>
          <b>{p.name}</b>
          <span>{p.tagline}</span>
          <div className="rh-stack">{p.stack.slice(0, 4).map((s) => <i key={s}>{s}</i>)}</div>
          <div className="rh-actions">
            {p.live && <button type="button" className="go" onClick={() => { sfx.tap(); onWeb(p.live!); }}>Run it live</button>}
            {/* GitHub refuses to be framed, so the code opens in a real tab */}
            <a href={p.repo} target="_blank" rel="noreferrer" onClick={() => sfx.tap()}>Code ↗</a>
          </div>
        </div>
      )}

      {hint && phase !== 'title' && <div className="rh-hint"><span><kbd>↑</kbd> throttle</span><span><kbd>←</kbd><kbd>→</kbd> steer</span><span><kbd>↓</kbd> brake</span><span><kbd>Esc</kbd> exit</span></div>}
      <button type="button" className="rh-exit" onClick={() => { sfx.tap(); onExit(); }}>Exit</button>
    </div>
  );
}
