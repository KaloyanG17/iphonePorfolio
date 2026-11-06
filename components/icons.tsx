import type { ReactNode } from 'react';
import type { AppId } from '@/lib/data';

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const APP_META: Record<AppId, { label: string; bg: [string, string]; icon: ReactNode }> = {
  about: {
    label: 'About',
    bg: ['#9fa8b6', '#4d5666'],
    icon: svg(<><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 19.5c1.2-3.6 4-5.3 7.2-5.3s6 1.7 7.2 5.3" /></>),
  },
  career: {
    label: 'Career',
    bg: ['#ffb36b', '#d5641a'],
    icon: svg(<><rect x="3.5" y="7.5" width="17" height="12" rx="2.2" /><path d="M9 7.5V6a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 6v1.5M3.5 12.5h17" /></>),
  },
  projects: {
    label: 'Projects',
    bg: ['#6fc2ff', '#1c5fc0'],
    icon: svg(<><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>),
  },
  messages: {
    label: 'Messages',
    bg: ['#8ff36a', '#27a51a'],
    icon: svg(<path d="M12 4.5c4.7 0 8.5 3 8.5 6.8s-3.8 6.8-8.5 6.8c-.9 0-1.8-.1-2.6-.3L5 19.5l1.2-3.4C4.4 14.9 3.5 13.2 3.5 11.3c0-3.8 3.8-6.8 8.5-6.8z" />),
  },
  terminal: {
    label: 'Terminal',
    bg: ['#4a4d55', '#0e0f12'],
    icon: svg(<><path d="m6 8.5 3.5 3.5L6 15.5" /><path d="M12 16h6" /></>),
  },
  github: { label: 'GitHub', bg: ['#5b6270', '#1d2129'], icon: <b className="icon-text">GH</b> },
  linkedin: { label: 'LinkedIn', bg: ['#4fa3e6', '#0a5aa8'], icon: <b className="icon-text">in</b> },
};

export const LINK_ICONS = {
  oldSite: { label: 'v1 Site', bg: ['#b7a8ff', '#5940c9'] as [string, string], text: 'v1' },
};
