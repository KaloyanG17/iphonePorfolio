'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as RPointerEvent } from 'react';
import { experience, profile, projects, skills, type AppId } from '@/lib/data';
import { run } from '@/lib/terminal';
import { sfx } from '@/lib/sound';
import { APP_META, LINK_ICONS } from './icons';
import { GitHubApp, LinkedInApp } from './social';

export type Open = (app: AppId, project?: string, origin?: { x: number; y: number }) => void;

const glossy = (bg: [string, string]): CSSProperties => ({ background: `linear-gradient(${bg[0]}, ${bg[1]})` });

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

export function StatusBar({ tone }: { tone: 'black' | 'clear' | 'gray' }) {
  const { time } = useClock();
  return (
    <div className={`statusbar ${tone}`} aria-hidden="true">
      <span>kgOS</span>
      <span>{time}</span>
      <span className="batt">100% <i /></span>
    </div>
  );
}

/* ---------- Lock screen ---------- */

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { time, date } = useClock();
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ px: number; x: number; k: number } | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const max = () => (track.current ? track.current.offsetWidth - 78 : 0);

  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    const el = track.current!;
    // the phone is CSS-scaled, so convert screen pixels back to design pixels
    const k = el.getBoundingClientRect().width / el.offsetWidth;
    start.current = { px: e.clientX, x, k };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (s) setX(Math.max(0, Math.min(max(), s.x + (e.clientX - s.px) / s.k)));
  };
  const up = () => {
    start.current = null;
    setDragging(false);
    if (x > max() * 0.85) onUnlock();
    else setX(0);
  };

  return (
    <div className="lock wallpaper">
      <div className="lock-top">
        <div className="lock-time">{time}</div>
        <div className="lock-date">{date}</div>
      </div>
      <div className="lock-notice" aria-live="polite">
        <span className="lock-notice-icon" aria-hidden="true">{APP_META.messages.icon}</span>
        <div>
          <strong>{profile.short}</strong>
          <small>now</small>
          <p>Hey! I build web apps. Slide the bar below to come in and look around.</p>
        </div>
      </div>
      <div className="lock-bottom">
        <div className="slider" ref={track}>
          <span className="slide-text" style={{ opacity: 1 - x / 120 }}>slide to open</span>
          <button
            type="button"
            className={`knob ${dragging ? '' : 'settle'}`}
            style={{ transform: `translateX(${x}px)` }}
            aria-label="Slide to open (or press Enter)"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                e.preventDefault();
                onUnlock();
              }
            }}
          >
            ➜
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Home screen ---------- */

function Icon({ bg, children }: { bg: [string, string]; children: React.ReactNode }) {
  return <span className="icon" style={glossy(bg)}>{children}</span>;
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

export function HomeScreen({ onOpen, onWeb, behind, onRace }: {
  onOpen: Open;
  onWeb: (url: string) => void;
  behind: boolean;
  onRace: (() => void) | null; // null when 3D is unavailable
}) {
  let i = 0;
  // Each icon flies in from outside its own corner of the grid, staggered, like the springboard
  const fly = (col: number, row: number) => ({ '--i': i++, '--fx': `${(col - 1.5) * 46}px`, '--fy': `${(row - 1.5) * 60}px` }) as CSSProperties;
  const appBtn = (id: AppId, col: number, row: number) => (
    <button key={id} type="button" className="app-icon" style={fly(col, row)} onClick={(e) => onOpen(id, undefined, originOf(e.currentTarget))}>
      <Icon bg={APP_META[id].bg}>{APP_META[id].icon}</Icon>
      {APP_META[id].label}
    </button>
  );

  return (
    <div className={`home wallpaper ${behind ? 'behind' : ''}`}>
      <nav className="grid" aria-label="Apps">
        {appBtn('about', 0, 0)}
        {appBtn('career', 1, 0)}
        {appBtn('github', 2, 0)}
        {appBtn('linkedin', 3, 0)}
        <button type="button" className="app-icon" style={fly(0, 1)} onClick={() => onWeb(profile.oldSite)}>
          <Icon bg={LINK_ICONS.oldSite.bg}><b className="icon-text">{LINK_ICONS.oldSite.text}</b></Icon>
          {LINK_ICONS.oldSite.label}
        </button>
        {onRace && (
          <button type="button" className="app-icon" style={fly(1, 1)} onClick={onRace}>
            <Icon bg={['#ff5a4f', '#b3060f']}>
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                <path d="M6 3.5v17" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M6.5 4.5h12l-2.5 4 2.5 4h-12z" fill="#fff" />
                <path d="M9 4.5h2.5v2h-2.5zM14 4.5h2.5v2H14zM11.5 6.5H14v2h-2.5zM9 8.5h2.5v2H9zM14 8.5h2.5v2H14zM11.5 10.5H14v2h-2.5z" fill="#1d1d1f" />
              </svg>
            </Icon>
            Grand Prix
          </button>
        )}
      </nav>
      <div className="dots" aria-hidden="true"><i /></div>
      <nav className="dock" aria-label="Dock">
        {appBtn('messages', 1, 3)}
        {appBtn('projects', 1.5, 3)}
        {appBtn('terminal', 2, 3)}
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
      <button type="button" className="back" onClick={() => { sfx.tap(); back.onClick(); }}>{back.label}</button>
      <h2>{title}</h2>
    </header>
  );
}

function About() {
  return (
    <div className="body pinstripe">
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
            <span className="picon" style={glossy(p.colors)}>{initials(p.name)}</span>
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
        <span className="picon big" style={glossy(p.colors)}>{initials(p.name)}</span>
        <div><h3>{p.name}</h3><p>{p.tagline}</p></div>
      </div>
      <p>{p.description}</p>
      <ul className="chips">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
      {p.live && <button type="button" className="btn" onClick={() => { sfx.tap(); onWeb(p.live!); }}>Run it live on the phone</button>}
      <a className="btn alt" href={p.repo} target="_blank" rel="noreferrer">View source on GitHub</a>
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
    <section className={`app ${closing ? 'closing' : ''}`} aria-label={title} style={origin ? { transformOrigin: `${origin.x}px ${origin.y - 20}px` } : undefined}>
      <NavBar title={title} back={detail ? { label: APP_META[app].label, onClick: () => setProject(null) } : home} />
      {app === 'about' && <About />}
      {app === 'career' && <Career />}
      {app === 'projects' && (project ? <ProjectDetail slug={project} onWeb={onWeb} /> : <ProjectList onPick={setProject} />)}
      {app === 'messages' && <Messages onOpen={onOpen} />}
      {app === 'terminal' && <Terminal onOpen={onOpen} />}
      {app === 'github' && <GitHubApp repo={project} onPick={setProject} onWeb={onWeb} />}
      {app === 'linkedin' && <LinkedInApp />}
    </section>
  );
}
