export type AppId = 'about' | 'career' | 'projects' | 'messages' | 'terminal' | 'github' | 'linkedin' | 'cv';

export const profile = {
  name: 'Kaloyan Gaydarov',
  short: 'Kaloyan',
  role: 'Full-stack web developer',
  location: 'Varna, Bulgaria',
  company: 'Secure.bg',
  avatar: 'https://avatars.githubusercontent.com/u/93589310?v=4',
  github: 'https://github.com/KaloyanG17',
  linkedin: 'https://www.linkedin.com/in/kaloyan-gaydarov/',
  oldSite: 'https://kaloyan.vercel.app',
  cv: '/cv.pdf', // drop the PDF into public/cv.pdf; the CV app and pit wall pick it up
  intro:
    'Computer Science graduate from the University of Exeter. I work professionally with JavaScript and PHP, and build on the side with TypeScript, React, Next.js, Vue and Nuxt, plus a lot of Three.js.',
};

export const skills: { group: string; items: string }[] = [
  { group: 'Frontend', items: 'React, Next.js, TypeScript, Vue, Nuxt, Tailwind' },
  { group: 'Backend', items: 'PHP, Node.js, SQL, PostgreSQL, Prisma, MongoDB' },
  { group: '3D', items: 'Three.js, React Three Fiber' },
];

export const experience: { when: string; title: string; org: string; text: string }[] = [
  { when: '2025 – now', title: 'Web Developer', org: 'Secure.bg', text: 'Building and maintaining production web applications with JavaScript and PHP.' },
  { when: '2023', title: 'Summer Intern', org: 'Refactory BG', text: 'Vue to Nuxt migrations, plus upgrades of Angular 7 and Electron 3 projects.' },
  { when: '2021 – 24', title: 'BSc Computer Science, 2:1', org: 'University of Exeter', text: 'Dissertation: an AI-driven 3D motorsport simulation.' },
  { when: '2019 – 21', title: 'A Levels', org: 'Havering Sixth Form College', text: 'Maths (A), Computer Science (B), Further Maths (C).' },
];

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  stack: string[];
  live?: string;
  repo: string;
  colors: [string, string];
};

export const projects: Project[] = [
  {
    slug: 'shiplog',
    name: 'Shiplog',
    tagline: 'A dev board that keeps itself up to date from GitHub',
    description:
      'Issues become cards, pull requests move them across the board, every push, issue and PR lands in an activity feed, and each evening an AI writes up the day in a dev journal. Shiplog tracks its own roadmap.',
    stack: ['Next.js 16', 'React 19', 'TypeScript', 'Prisma', 'PostgreSQL', 'Tailwind', 'R3F'],
    live: 'https://shiplog-silk.vercel.app',
    repo: 'https://github.com/KaloyanG17/shiplog',
    colors: ['#5ec8ff', '#1b5fc4'],
  },
  {
    slug: 'hexbound',
    name: 'Hexbound',
    tagline: 'An auto-battler with an original cast',
    description:
      'One deterministic TypeScript game core (seeded RNG, hex maths, shop, merging and combat simulation) that runs in the browser against bots today and on a game server for PvP next. Bots issue the same commands as a human player.',
    stack: ['TypeScript', 'Next.js', 'Monorepo', 'Game AI'],
    live: 'https://hexbound-six.vercel.app',
    repo: 'https://github.com/KaloyanG17/hexbound',
    colors: ['#c58cff', '#5b2bb5'],
  },
  {
    slug: 'motorsport',
    name: 'Simulated Motorsport',
    tagline: 'AI-driven 3D race simulation (dissertation)',
    description:
      'My University of Exeter dissertation: a 3D motorsport race where both the driver and the race strategy are controlled entirely by AI.',
    stack: ['Three.js', 'YUKA', 'Brain.js', 'JavaScript'],
    live: 'https://simulated-motorsport.vercel.app',
    repo: 'https://github.com/KaloyanG17/Simulated-Motorsport',
    colors: ['#ff8a5b', '#c4321b'],
  },
  {
    slug: 'imaginify',
    name: 'Imaginify',
    tagline: 'Full-stack AI SaaS platform',
    description: 'An AI image SaaS built with Next.js 14, using Clerk for user management and MongoDB Atlas for data.',
    stack: ['Next.js 14', 'TypeScript', 'Clerk', 'MongoDB'],
    repo: 'https://github.com/KaloyanG17/Imaginify',
    colors: ['#ffd36b', '#d98a0b'],
  },
  {
    slug: 'twitter-clone',
    name: 'Twitter Clone',
    tagline: 'Social feed with Nuxt 3 and Prisma',
    description: 'A custom Twitter clone with posting, feeds and auth, built with Vue 3, Nuxt 3, Tailwind CSS and Prisma.',
    stack: ['Vue 3', 'Nuxt 3', 'Tailwind', 'Prisma'],
    live: 'https://twitter-clone-kaloyang17.vercel.app',
    repo: 'https://github.com/KaloyanG17/twitter-clone',
    colors: ['#7fd6ff', '#1d8fd1'],
  },
  {
    slug: 'spotify-clone',
    name: 'Spotify Clone',
    tagline: 'Music player UI with Vue 3 and Pinia',
    description: 'A custom Spotify clone with an album included, built with Vue 3, Pinia and Tailwind CSS.',
    stack: ['Vue 3', 'Pinia', 'Tailwind'],
    live: 'https://spotify-clone-kaloyang17.vercel.app',
    repo: 'https://github.com/KaloyanG17/spotify-clone',
    colors: ['#7ff0a0', '#1f9f4a'],
  },
  {
    slug: 'portfolio-v1',
    name: '3D Portfolio (v1)',
    tagline: 'My previous site, with Three.js',
    description: 'My previous personal website, using Three.js for 3D effects with React and Tailwind CSS.',
    stack: ['React', 'Three.js', 'Tailwind'],
    live: 'https://kaloyan.vercel.app',
    repo: 'https://github.com/KaloyanG17/3d-website',
    colors: ['#9aa4ff', '#3b3fb0'],
  },
];

// The race: career chapters oldest first, one per sector, and the projects that get a pit garage
export const career = [...experience].reverse();
export const pitProjects = projects.filter((p) => p.slug !== 'portfolio-v1');
