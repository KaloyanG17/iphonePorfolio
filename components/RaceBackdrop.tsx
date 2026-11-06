'use client';

import { useEffect, useRef } from 'react';
import { race } from '@/lib/race';

// Behind the phone while racing: a giant italic lap counter, a live speed readout, and light streaks that build with speed.
// It reads the shared race store once a frame and writes straight to the DOM, so React never re-renders for it.
export default function RaceBackdrop() {
  const root = useRef<HTMLDivElement>(null);
  const lap = useRef<HTMLSpanElement>(null);
  const kmh = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const fast = Math.min(1, race.speed / 260);
      root.current!.style.setProperty('--fast', fast.toFixed(3));
      lap.current!.textContent = String(Math.min(race.lap, 99)).padStart(2, '0');
      kmh.current!.textContent = String(Math.round(race.speed)).padStart(3, '0');
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="race-backdrop" ref={root} aria-hidden="true">
      <div className="rb-streaks">
        {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}
      </div>
      <div className="rb-lap"><small>Lap</small><span ref={lap}>01</span></div>
      <div className="rb-speed"><span ref={kmh}>000</span><small>km/h</small></div>
    </div>
  );
}
