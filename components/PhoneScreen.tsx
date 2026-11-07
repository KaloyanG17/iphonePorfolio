'use client';

import { profile, type AppId } from '@/lib/data';
import RaceHud from './RaceHud';
import { AppView, HomeScreen, LockScreen, Safari, StatusBar, type Open } from './screens';

export type Power = 'off' | 'boot' | 'sleep' | 'on';
export type Hud = { kind: 'volume' | 'silent' | 'ring'; id: number };

type Props = {
  power: Power;
  locked: boolean;
  app: AppId | null;
  closing: boolean;
  origin: { x: number; y: number } | null;
  project: string | null;
  web: string | null;
  racing: boolean;
  onRace: (() => void) | null;
  onExitRace: () => void;
  banner: boolean;
  hud: Hud | null;
  volume: number;
  onWake: () => void;
  onUnlock: () => void;
  onOpen: Open;
  onHome: () => void;
  onHomeButton: () => void; // the home bar: same as the old hardware home button
  onWeb: (url: string | null) => void;
  onBanner: () => void;
  setProject: (slug: string | null) => void;
};

const BARS = 16;

export default function PhoneScreen(p: Props) {
  const lit = p.power === 'on';

  return (
    <div className={`screen-inner ${lit ? 'lit' : 'dark'}`}>
      {p.power === 'off' || p.power === 'sleep' ? (
        <button type="button" className="screen-off" onClick={p.onWake} aria-label="Turn the phone on" />
      ) : p.racing ? (
        <>
          <RaceHud onExit={p.onExitRace} onWeb={p.onWeb} onContact={() => { p.onExitRace(); p.onOpen('messages'); }} />
          {/* "Run it live" opens the site over the race, in landscape; Done drops you back in the pit lane */}
          {p.web && (
            <div className="race-web">
              <Safari key={p.web} url={p.web} onClose={() => p.onWeb(null)} />
            </div>
          )}
        </>
      ) : p.power === 'boot' ? (
        <div className="boot" aria-label="Starting up">
          <span className="boot-logo">kg</span>
        </div>
      ) : (
        <>
          <StatusBar tone={!p.locked && ((p.app && !p.closing) || p.web) ? 'dark' : 'light'} />
          {p.locked ? (
            <LockScreen onUnlock={p.onUnlock} />
          ) : (
            <>
              <HomeScreen onOpen={p.onOpen} onWeb={p.onWeb} behind={!!p.app && !p.closing} onRace={p.onRace} />
              {p.app && (
                <AppView
                  key={p.app}
                  app={p.app}
                  project={p.project}
                  setProject={p.setProject}
                  onOpen={p.onOpen}
                  onHome={p.onHome}
                  onWeb={p.onWeb}
                  closing={p.closing}
                  origin={p.origin}
                />
              )}
              {p.web && <Safari key={p.web} url={p.web} onClose={() => p.onWeb(null)} />}
              {p.banner && (
                <button type="button" className="banner" onClick={p.onBanner}>
                  <strong>Messages</strong>
                  <span>{profile.short}: Hi! Have a look around, or tap here to ask me something.</span>
                </button>
              )}
              {/* The home bar: tap it to go home, like the hardware button on older phones */}
              {(p.app || p.web) && !p.closing ? (
                <button type="button" className="home-bar on-light" aria-label="Go to the home screen" onClick={p.onHomeButton} />
              ) : (
                <span className="home-bar idle" aria-hidden="true" />
              )}
            </>
          )}
        </>
      )}

      {p.hud && lit && (
        <div className="hud-pop" key={p.hud.kind} role="status">
          {p.hud.kind === 'volume' ? (
            <>
              <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">
                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff" />
                <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
              <span className="hud-bars" aria-label={`Volume ${Math.round(p.volume * 100)}%`}>
                {Array.from({ length: BARS }, (_, i) => (
                  <i key={i} className={i < Math.round(p.volume * BARS) ? 'on' : ''} />
                ))}
              </span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">
                <path d="M12 4a5 5 0 0 0-5 5v4l-2 3h14l-2-3V9a5 5 0 0 0-5-5zM10 18a2 2 0 0 0 4 0" fill="#fff" />
                {p.hud.kind === 'silent' && <path d="M4 4l16 16" stroke="#e84a3a" strokeWidth="2.2" strokeLinecap="round" />}
              </svg>
              <strong>{p.hud.kind === 'silent' ? 'Silent' : 'Ring'}</strong>
            </>
          )}
        </div>
      )}
    </div>
  );
}
