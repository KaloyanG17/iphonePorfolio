import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './stage.css';

export const metadata: Metadata = {
  title: 'Kaloyan Gaydarov | Full-stack web developer',
  description:
    'Kaloyan Gaydarov is a full-stack web developer in Varna, Bulgaria, building with React, Next.js, Vue, PHP and Three.js. Unlock the phone to explore projects and experience.',
  openGraph: {
    title: 'Kaloyan Gaydarov | Full-stack web developer',
    description: 'Unlock the phone to explore projects and experience.',
    type: 'website',
  },
};

export const viewport: Viewport = { themeColor: '#0e1015' };

// Race livery type: condensed italic for headlines, a timing-screen mono for numbers (both SIL Open Font License)
const race = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '800', '900'], style: ['normal', 'italic'], variable: '--font-race' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700', '800'], style: ['normal', 'italic'], variable: '--font-mono' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${race.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
