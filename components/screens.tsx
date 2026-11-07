'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as RPointerEvent } from 'react';
import { experience, profile, projects, skills, type AppId } from '@/lib/data';
import { fmt } from '@/lib/race';
import { run } from '@/lib/terminal';
import { sfx } from '@/lib/sound';
import { APP_META, LINK_ICONS } from './icons';
import { GitHubApp, LinkedInApp } from './social';

export type Open = (app: AppId, project?: string, origin?: { x: number; y: number }) => void;

const fill = (bg: [string, string]): CSSProperties => ({ background: `linear-gradient(160deg, ${bg[0]}, ${bg[1]})` });

export function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return {
    time: now ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
    date: now ? now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
  };
}

const Signal = () => (
  <svg viewBox="0 0 18 12" width="18" height="12" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4.6} y={9 - i * 3} width="3.2" height={3 + i * 3} rx="0.8" fill="currentColor" />)}
  </svg>
);
const Wifi = () => (
  <svg viewBox="0 0 16 12" width="16" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M1.5 4.2a9.5 9.5 0 0 1 13 0M4.2 7a5.6 5.6 0 0 1 7.6 0" /><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export function StatusBar({ tone }: { tone: 'light' | 'dark' }) {
  const { time } = useClock();
  return (
    <div className={`statusbar ${tone}`} aria-hidden="true">
      <span className="sb-time">{time}</span>
      <span className="sb-icons"><Signal /><Wifi /><i className="sb-batt" /></span>
    </div>
  );
}

/* ---------- Lock screen ---------- */

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { time, date } = useClock();
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; k: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);

  // Swipe up anywhere to open. The phone is CSS-scaled in 3D, so convert screen pixels back to design pixels.
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const el = root.current!;
    start.current = { y: e.clientY, k: el.getBoundingClientRect().height / el.offsetHeight || 1, t: e.timeStamp };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const st = start.current;
    if (st) setDy(Math.min(0, (e.clientY - st.y) / st.k));
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    const st = start.current;
    start.current = null;
    if (!st) return;
    const speed = dy / Math.max(1, e.timeStamp - st.t); // px per ms, negative is upwards
    // a long drag or a quick flick both count
    if (dy < -140 || (dy < -30 && speed < -0.5)) onUnlock();
    else setDy(0);
  };

  return (
    <div
      ref={root}
      className={`lock wallpaper ${dy ? 'dragging' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="lock-content" style={{ transform: `translateY(${dy}px)`, opacity: 1 + dy / 420 }}>
        <div className="lock-top">
          <div className="lock-date">{date}</div>
          <div className="lock-time">{time}</div>
        </div>
        <div className="lock-notice" aria-live="polite">
          <span className="lock-notice-icon" aria-hidden="true">{APP_META.messages.icon}</span>
          <div>
            <strong>{profile.short}</strong>
            <small>now</small>
            <p>Hey! I build web apps. Swipe up to come in and look around.</p>
          </div>
        </div>
        <div className="lock-bottom">
          <span className="lock-hint">Swipe up to open</span>
          <button
            type="button"
            className="home-bar lock-bar"
            aria-label="Open the phone (or press Enter)"
            onClick={onUnlock}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') {
                e.preventDefault();
                onUnlock();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- Home screen ---------- */

function Icon({ bg, children }: { bg: [string, string]; children: React.ReactNode }) {
  return <span className="icon" style={fill(bg)}>{children}</span>;
}

// Centre of the tapped icon in screen pixels, so the app can zoom out of it
const originOf = (el: HTMLElement) => {
  const icon = el.querySelector('.icon') as HTMLElement;
  let x = icon.offsetWidth / 2;
  let y = icon.offsetHeight / 2;
  for (let n: HTMLElement | null = icon; n && !n.classList.contains('screen-inner'); n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
};

const Flag = ({ size = 30 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M6 3.5v17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    <path d="M6.5 4.5h12l-2.5 4 2.5 4h-12z" fill="currentColor" />
    <path d="M9 4.5h2.5v2h-2.5zM14 4.5h2.5v2H14zM11.5 6.5H14v2h-2.5zM9 8.5h2.5v2H9zM14 8.5h2.5v2H14zM11.5 10.5H14v2h-2.5z" fill="var(--os-flag-check)" />
  </svg>
);

export function HomeScreen({ onOpen, onWeb, behind, onRace }: {
  onOpen: Open;
  onWeb: (url: string) => void;
  behind: boolean;
  onRace: (() => void) | null; // null when 3D is unavailable
}) {
  // The best lap lives in the browser; read it after mount so server and client render the same first frame
  const [best, setBest] = useState(0);
  useEffect(() => setBest(Number(localStorage.getItem('kg-best-lap') ?? 0)), []);

  let i = 0;
  // Each tile flies in from outside its own corner of the grid, staggered
  const fly = (col: number, row: number) => ({ '--i': i++, '--fx': `${(col - 1.5) * 46}px`, '--fy': `${(row - 1.5) * 60}px` }) as CSSProperties;
  const appBtn = (id: AppId, col: number, row: number) => (
    <button key={id} type="button" className="app-icon" style={fly(col, row)} onClick={(e) => onOpen(id, undefined, originOf(e.currentTarget))}>
      <Icon bg={APP_META[id].bg}>{APP_META[id].icon}</Icon>
      {APP_META[id].label}
    </button>
  );

  return (
    <div className={`home wallpaper ${behind ? 'behind' : ''}`}>
      <div className="grid">
        <section className="widget profile-widget" style={fly(0.5, 0)} aria-label="About Kaloyan">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatar} alt="" width={46} height={46} />
          <strong>{profile.name}</strong>
          <span>{profile.role}</span>
          <small>{profile.company}, Varna</small>
        </section>
        {onRace ? (
          <button type="button" className="widget race-widget" style={fly(2.5, 0)} onClick={onRace}>
            <Flag />
            <strong>Grand Prix</strong>
            <span>{best ? `Your best lap ${fmt(best)}` : 'Drive a lap of my career'}</span>
            <small>Tap to race</small>
          </button>
        ) : (
          <section className="widget race-widget" style={fly(2.5, 0)} aria-label="Location">
            <strong>{profile.location}</strong>
            <span>Full-stack web developer</span>
          </section>
        )}
        <nav className="icons" aria-label="Apps">
          {appBtn('about', 0, 2)}
          {appBtn('career', 1, 2)}
          {appBtn('github', 2, 2)}
          {appBtn('linkedin', 3, 2)}
          <button type="button" className="app-icon" style={fly(0, 3)} onClick={() => onWeb(profile.oldSite)}>
            <Icon bg={LINK_ICONS.oldSite.bg}><b className="icon-text">{LINK_ICONS.oldSite.text}</b></Icon>
            {LINK_ICONS.oldSite.label}
          </button>
          {appBtn('cv', 1, 3)}
        </nav>
      </div>
      <div className="dots" aria-hidden="true"><i /></div>
      <nav className="dock" aria-label="Dock">
        {appBtn('messages', 0.5, 4)}
        {appBtn('projects', 1.5, 4)}
        {appBtn('terminal', 2.5, 4)}
      </nav>
    </div>
  );
}

/* In-phone browser: project sites run live inside the screen */
export function Safari({ url, onClose }: { url: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <section className="safari" aria-label={`Browser: ${host}`}>
      <header className="safari-bar">
        <span className="safari-url">{loading && <i className="safari-progress" />}{host}</span>
        <button type="button" className="safari-done" onClick={() => { sfx.tap(); onClose(); }}>Done</button>
      </header>
      <iframe src={url} title={host} onLoad={() => setLoading(false)} allow="fullscreen" />
      {loading && <span className="spinner safari-spin" aria-hidden="true" />}
      <footer className="safari-tools">
        <span>{loading ? 'Loading…' : 'Live site'}</span>
        <a href={url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
      </footer>
    </section>
  );
}

/* ---------- Apps ---------- */

function NavBar({ title, back }: { title: string; back: { label: string; onClick: () => void } }) {
  return (
    <header className="navbar">
      <button type="button" className="back" onClick={() => { sfx.tap(); back.onClick(); }}>
        <svg viewBox="0 0 12 20" width="11" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8" /></svg>
        {back.label}
      </button>
      <h2>{title}</h2>
    </header>
  );
}

function About() {
  return (
    <div className="body grouped">
      <div className="card-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={profile.avatar} alt="" width={64} height={64} />
        <div>
          <h3>{profile.name}</h3>
          <p>{profile.role}</p>
        </div>
      </div>
      <p className="note">{profile.intro}</p>
      <h4 className="group-title">Info</h4>
      <div className="group">
        <div className="row"><span className="k">Location</span><span className="v">{profile.location}</span></div>
        <div className="row"><span className="k">Works at</span><span className="v">{profile.company}</span></div>
        <div className="row"><span className="k">Studied</span><span className="v">CS, Exeter</span></div>
      </div>
      <h4 className="group-title">Skills</h4>
      <div className="group">
        {skills.map((s) => (
          <div className="row stack" key={s.group}><span className="k">{s.group}</span><span className="v">{s.items}</span></div>
        ))}
      </div>
      <h4 className="group-title">Links</h4>
      <div className="group">
        <a className="row chev" href={profile.github} target="_blank" rel="noreferrer"><span className="k">GitHub</span></a>
        <a className="row chev" href={profile.linkedin} target="_blank" rel="noreferrer"><span className="k">LinkedIn</span></a>
      </div>
    </div>
  );
}

function Career() {
  return (
    <ol className="body career">
      {experience.map((e) => (
        <li key={e.org}>
          <span className="when">{e.when}</span>
          <div>
            <strong>{e.title}</strong>
            <em>{e.org}</em>
            <p>{e.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);

function ProjectList({ onPick }: { onPick: (slug: string) => void }) {
  return (
    <ul className="body plist">
      {projects.map((p) => (
        <li key={p.slug}>
          <button type="button" className="prow chev" onClick={() => { sfx.tap(); onPick(p.slug); }}>
            <span className="picon" style={fill(p.colors)}>{initials(p.name)}</span>
            <span className="ptext"><strong>{p.name}</strong><small>{p.tagline}</small></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProjectDetail({ slug, onWeb }: { slug: string; onWeb: (url: string) => void }) {
  const p = projects.find((x) => x.slug === slug);
  if (!p) return <p className="body detail">Project not found.</p>;
  return (
    <div className="body detail">
      <div className="detail-head">
        <span className="picon big" style={fill(p.colors)}>{initials(p.name)}</span>
        <div><h3>{p.name}</h3><p>{p.tagline}</p></div>
      </div>
      <p>{p.description}</p>
      <ul className="chips">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
      {p.live && <button type="button" className="btn" onClick={() => { sfx.tap(); onWeb(p.live!); }}>Run it live on the phone</button>}
      <a className="btn alt" href={p.repo} target="_blank" rel="noreferrer">View source on GitHub</a>
    </div>
  );
}

function Cv() {
  // Check the PDF is really there, so a missing file reads as a message, not a broken viewer
  const [state, setState] = useState<'checking' | 'ready' | 'missing'>('checking');
  useEffect(() => {
    let alive = true;
    fetch(profile.cv, { method: 'HEAD' })
      .then((r) => alive && setState(r.ok ? 'ready' : 'missing'))
      .catch(() => alive && setState('missing'));
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'checking') {
    return <div className="body gh gh-loading" role="status"><span className="spinner" aria-hidden="true" />Loading CV…</div>;
  }
  if (state === 'missing') {
    return (
      <div className="body grouped">
        <p className="note">My CV is being updated. Message me on LinkedIn and I’ll send you the latest copy.</p>
        <a className="btn" href={profile.linkedin} target="_blank" rel="noreferrer">Message me on LinkedIn</a>
      </div>
    );
  }
  return (
    <div className="body cv">
      <iframe className="cv-frame" src={`${profile.cv}#view=FitH`} title={`CV of ${profile.name}`} />
      <div className="cv-actions">
        <a className="btn" href={profile.cv} download={`${profile.name.replace(/\s+/g, '-')}-CV.pdf`}>Download CV</a>
        <a className="btn alt" href={profile.cv} target="_blank" rel="noreferrer">Open in a new tab</a>
      </div>
    </div>
  );
}

type Msg = { me?: boolean; text: string; action?: { label: string; href?: string; open?: AppId } };

const QA: { q: string; a: Msg }[] = [
  { q: 'What do you build?', a: { text: 'Web apps end to end: React and Next.js on the front, PHP, Node and SQL on the back, and Three.js when it should be 3D.' } },
  { q: 'Show me your work', a: { text: 'My latest is Shiplog, a dev board that updates itself from GitHub.', action: { label: 'Open Projects', open: 'projects' } } },
  { q: 'Where are you based?', a: { text: `${profile.location}, working at ${profile.company}.` } },
  { q: 'How do I reach you?', a: { text: 'LinkedIn is the best way.', action: { label: 'Open LinkedIn', open: 'linkedin' } } },
];

function Messages({ onOpen }: { onOpen: Open }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { text: `Hey! I'm ${profile.short}, a full-stack developer.` },
    { text: 'Tap a question below to ask me something.' },
  ]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll only the list itself: scrollIntoView would also scroll the 3D screen's wrappers out of line
    end.current?.parentElement?.scrollTo({ top: 1e6 });
  }, [msgs]);

  return (
    <div className="body messages">
      <div className="thread" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.me ? 'me' : 'them'}`}>
            {m.text}
            {m.action &&
              (m.action.href ? (
                <a className="bubble-btn" href={m.action.href} target="_blank" rel="noreferrer">{m.action.label}</a>
              ) : (
                <button type="button" className="bubble-btn" onClick={() => onOpen(m.action!.open!)}>{m.action.label}</button>
              ))}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="quick">
        {QA.map(({ q, a }) => (
          <button key={q} type="button" onClick={() => { sfx.tap(); setTimeout(sfx.message, 380); setMsgs((m) => [...m, { me: true, text: q }, a]); }}>{q}</button>
        ))}
      </div>
    </div>
  );
}

function Terminal({ onOpen }: { onOpen: Open }) {
  const [lines, setLines] = useState<string[]>(['kgOS terminal. Type "help".']);
  const [val, setVal] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll only the list itself: scrollIntoView would also scroll the 3D screen's wrappers out of line
    end.current?.parentElement?.scrollTo({ top: 1e6 });
  }, [lines]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = run(val);
    setLines((l) => (r.clear ? [] : [...l, `$ ${val}`, ...r.lines]));
    setVal('');
    if (r.open) setTimeout(() => onOpen(r.open!, r.project), 450);
  };

  return (
    <form className="body term" onSubmit={submit} onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
      <label className="term-line">
        <span>$</span>
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={() => sfx.key()} autoFocus autoComplete="off" spellCheck={false} autoCapitalize="off" aria-label="Terminal command" />
      </label>
      <div ref={end} />
    </form>
  );
}

export function AppView({ app, project, setProject, onOpen, onHome, onWeb, closing, origin }: {
  app: AppId;
  project: string | null;
  setProject: (slug: string | null) => void;
  onOpen: Open;
  onHome: () => void;
  onWeb: (url: string) => void;
  closing: boolean;
  origin: { x: number; y: number } | null;
}) {
  const home = { label: 'Home', onClick: onHome };
  const detail = (app === 'projects' || app === 'github') && project;
  const title = !detail ? APP_META[app].label : app === 'github' ? project : projects.find((p) => p.slug === project)?.name ?? 'Project';

  return (
    <section className={`app ${closing ? 'closing' : ''}`} aria-label={title} style={origin ? { transformOrigin: `${origin.x}px ${origin.y}px` } : undefined}>
      <NavBar title={title} back={detail ? { label: APP_META[app].label, onClick: () => setProject(null) } : home} />
      {app === 'about' && <About />}
      {app === 'career' && <Career />}
      {app === 'projects' && (project ? <ProjectDetail slug={project} onWeb={onWeb} /> : <ProjectList onPick={setProject} />)}
      {app === 'messages' && <Messages onOpen={onOpen} />}
      {app === 'terminal' && <Terminal onOpen={onOpen} />}
      {app === 'github' && <GitHubApp repo={project} onPick={setProject} onWeb={onWeb} />}
      {app === 'linkedin' && <LinkedInApp />}
      {app === 'cv' && <Cv />}
    </section>
  );
}
