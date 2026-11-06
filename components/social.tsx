'use client';

import { useEffect, useState } from 'react';
import { experience, profile, projects, skills } from '@/lib/data';
import { sfx } from '@/lib/sound';

type GhUser = {
  avatar_url: string; name: string | null; login: string; bio: string | null; location: string | null;
  company: string | null; public_repos: number; followers: number; following: number; html_url: string;
};
type GhRepo = {
  name: string; description: string | null; language: string | null; stargazers_count: number;
  html_url: string; homepage: string | null; updated_at: string; fork: boolean;
};
type Gh = { user: GhUser; repos: GhRepo[] };

const LOGIN = profile.github.split('/').pop()!;
const LANG: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Vue: '#41b883', HTML: '#e34c26', CSS: '#563d7c', Python: '#3572a5', PHP: '#4f5d95',
};

// One request per page load; GitHub allows 60 unauthenticated calls an hour per visitor.
let cache: Promise<Gh> | null = null;
function loadGitHub(): Promise<Gh> {
  cache ??= Promise.all([
    fetch(`https://api.github.com/users/${LOGIN}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`https://api.github.com/users/${LOGIN}/repos?sort=updated&per_page=50`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ])
    .then(([user, repos]: [GhUser, GhRepo[]]) => ({ user, repos: repos.filter((r) => !r.fork && r.name !== LOGIN) }))
    .catch((err) => {
      cache = null; // let the next open retry
      throw err;
    });
  return cache;
}

// Used when the API is unreachable or rate-limited, so the app never shows a dead end
const fallback: Gh = {
  user: {
    avatar_url: profile.avatar, name: profile.name, login: LOGIN, bio: profile.intro, location: profile.location,
    company: profile.company, public_repos: projects.length, followers: 0, following: 0, html_url: profile.github,
  },
  repos: projects.map((p) => ({
    name: p.repo.split('/').pop()!, description: p.tagline, language: null, stargazers_count: 0,
    html_url: p.repo, homepage: p.live ?? null, updated_at: '', fork: false,
  })),
};

const ago = (iso: string) => {
  if (!iso) return '';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days < 1) return 'Updated today';
  if (days < 30) return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
  return `Updated ${new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
};

export function GitHubApp({ repo, onPick, onWeb }: { repo: string | null; onPick: (name: string) => void; onWeb: (url: string) => void }) {
  const [data, setData] = useState<Gh | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGitHub()
      .then((d) => alive && setData(d))
      .catch(() => {
        if (!alive) return;
        setOffline(true);
        setData(fallback);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!data) {
    return (
      <div className="body gh gh-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading GitHub…
      </div>
    );
  }

  const { user, repos } = data;
  const r = repo ? repos.find((x) => x.name === repo) : null;

  if (r) {
    return (
      <div className="body gh">
        <div className="gh-repo-head">
          <span className="gh-owner">{user.login} /</span>
          <h3>{r.name}</h3>
          {r.description && <p>{r.description}</p>}
          <div className="gh-meta">
            {r.language && <span><i style={{ background: LANG[r.language] ?? 'var(--c-lang-other)' }} />{r.language}</span>}
            <span>★ {r.stargazers_count}</span>
            {r.updated_at && <span>{ago(r.updated_at)}</span>}
          </div>
        </div>
        <div className="gh-actions">
          {r.homepage && <button type="button" className="btn" onClick={() => { sfx.tap(); onWeb(r.homepage!); }}>Run it live on the phone</button>}
          <a className="btn alt" href={r.html_url} target="_blank" rel="noreferrer">View code on github.com</a>
        </div>
      </div>
    );
  }

  return (
    <div className="body gh">
      <div className="gh-profile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatar_url} alt="" width={64} height={64} />
        <div>
          <h3>{profile.name}</h3>
          <span className="gh-login">{user.login}</span>
        </div>
      </div>
      {user.bio && <p className="gh-bio">{user.bio.trim()}</p>}
      <p className="gh-facts">
        {user.company && <span>{user.company}</span>}
        {user.location && <span>{user.location}</span>}
      </p>
      <p className="gh-facts">
        <span><b>{user.public_repos}</b> repositories</span>
        <span><b>{user.followers}</b> followers</span>
      </p>
      {offline && <p className="gh-note">Showing saved data. GitHub could not be reached.</p>}
      <h4 className="gh-section">Repositories</h4>
      <ul className="gh-repos">
        {repos.map((x) => (
          <li key={x.name}>
            <button type="button" className="chev" onClick={() => { sfx.tap(); onPick(x.name); }}>
              <strong>{x.name}</strong>
              {x.description && <small>{x.description}</small>}
              <span className="gh-meta">
                {x.language && <span><i style={{ background: LANG[x.language] ?? 'var(--c-lang-other)' }} />{x.language}</span>}
                {x.updated_at && <span>{ago(x.updated_at)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <a className="btn alt gh-bottom" href={user.html_url} target="_blank" rel="noreferrer">Open profile on github.com</a>
    </div>
  );
}

// LinkedIn blocks embedding and automated reads, so this card is built from the site's own data.
export function LinkedInApp() {
  return (
    <div className="body li">
      <section className="li-card li-top">
        <div className="li-banner" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="li-avatar" src={profile.avatar} alt="" width={84} height={84} />
        <h3>{profile.name}</h3>
        <p className="li-headline">{profile.role} at {profile.company}</p>
        <p className="li-loc">{profile.location}</p>
        <div className="li-buttons">
          <a className="li-btn primary" href={profile.linkedin} target="_blank" rel="noreferrer">Connect</a>
          <a className="li-btn" href={profile.linkedin} target="_blank" rel="noreferrer">Message</a>
        </div>
      </section>

      <section className="li-card">
        <h4>About</h4>
        <p>{profile.intro}</p>
      </section>

      <section className="li-card">
        <h4>Experience</h4>
        <ul className="li-list">
          {experience.map((e) => (
            <li key={e.org}>
              <span className="li-logo" aria-hidden="true">{e.org[0]}</span>
              <div>
                <strong>{e.title}</strong>
                <span>{e.org}</span>
                <small>{e.when}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="li-card">
        <h4>Skills</h4>
        {skills.map((s) => (
          <p key={s.group} className="li-skill"><strong>{s.group}</strong>{s.items}</p>
        ))}
      </section>

      <a className="btn li-full" href={profile.linkedin} target="_blank" rel="noreferrer">View full profile on LinkedIn</a>
    </div>
  );
}
