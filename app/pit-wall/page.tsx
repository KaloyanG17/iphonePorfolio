import type { Metadata } from 'next';
import Link from 'next/link';
import { experience, profile, projects, skills } from '@/lib/data';
import './pit-wall.css';

// The plain, fast version of the site: everything the game shows, as ordinary HTML for recruiters, crawlers and screen readers.
export const metadata: Metadata = {
  title: `Pit wall | ${profile.name}`,
  description: `${profile.name}: ${profile.role} in ${profile.location}. Career, projects and contact details on one page.`,
};

export default function PitWall() {
  return (
    <main className="pitwall">
      <header>
        <p className="pw-kicker">Pit wall · the whole site on one page</p>
        <h1>{profile.name}</h1>
        <p className="pw-role">{profile.role} · {profile.location} · {profile.company}</p>
        <p className="pw-intro">{profile.intro}</p>
        <nav className="pw-links" aria-label="Contact">
          <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a href={profile.github} target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/" className="pw-back">Back to the Grand Prix</Link>
        </nav>
      </header>

      <section aria-labelledby="career">
        <h2 id="career">Career</h2>
        <ol className="pw-career">
          {experience.map((e) => (
            <li key={e.org + e.when}>
              <span className="pw-when">{e.when}</span>
              <div>
                <h3>{e.title}</h3>
                <p className="pw-org">{e.org}</p>
                <p>{e.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="projects">
        <h2 id="projects">Projects</h2>
        <ul className="pw-projects">
          {projects.map((p) => (
            <li key={p.slug} style={{ ['--c1' as string]: p.colors[0] }}>
              <h3>{p.name}</h3>
              <p className="pw-tag">{p.tagline}</p>
              <p>{p.description}</p>
              <p className="pw-stack">{p.stack.join(' · ')}</p>
              <p className="pw-plinks">
                {p.live && <a href={p.live} target="_blank" rel="noreferrer">Live site</a>}
                <a href={p.repo} target="_blank" rel="noreferrer">Code</a>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="skills">
        <h2 id="skills">Skills</h2>
        <dl className="pw-skills">
          {skills.map((s) => (
            <div key={s.group}><dt>{s.group}</dt><dd>{s.items}</dd></div>
          ))}
        </dl>
      </section>
    </main>
  );
}
