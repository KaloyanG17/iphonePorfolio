import { profile, projects, type AppId } from './data.ts';

export type TermResult = { lines: string[]; open?: AppId; project?: string; clear?: boolean };

const APPS: AppId[] = ['about', 'career', 'projects', 'messages', 'terminal', 'github', 'linkedin', 'cv'];

export function run(raw: string): TermResult {
  const [cmd = '', ...args] = raw.trim().split(/\s+/);
  const arg = args.join(' ').toLowerCase();

  switch (cmd.toLowerCase()) {
    case '':
      return { lines: [] };
    case 'help':
      return {
        lines: [
          'whoami        who is this?',
          'ls            list apps',
          'projects      list projects',
          'open <name>   open an app or project',
          'socials       GitHub and LinkedIn',
          'clear         clear the screen',
          'sudo hire-me',
        ],
      };
    case 'whoami':
      return { lines: [`${profile.name}, ${profile.role}`, profile.location] };
    case 'ls':
      return { lines: [APPS.join('  ')] };
    case 'projects':
      return { lines: projects.map((p) => p.slug) };
    case 'socials':
      return { lines: [`github    ${profile.github}`, `linkedin  ${profile.linkedin}`] };
    case 'clear':
      return { lines: [], clear: true };
    case 'open': {
      if ((APPS as string[]).includes(arg)) return { lines: [`Opening ${arg}…`], open: arg as AppId };
      const p = projects.find((x) => x.slug === arg || x.name.toLowerCase() === arg);
      if (p) return { lines: [`Opening ${p.name}…`], open: 'projects', project: p.slug };
      return { lines: [`open: no app or project called "${arg}". Try "ls" or "projects".`] };
    }
    case 'sudo':
      return arg === 'hire-me'
        ? { lines: ['Permission granted. Opening Messages…'], open: 'messages' }
        : { lines: ['Nice try.'] };
    default:
      return { lines: [`command not found: ${cmd}. Type "help".`] };
  }
}
