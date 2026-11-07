'use client';

import { useEffect, useRef } from 'react';
import { race } from '@/lib/race';

// Behind the phone while racing: a giant italic lap counter, a live speed readout, and light streaks that build with speed.
// It reads the shared race store once a frame and writes straight to the DOM, so React never re-renders for it.
export default function RaceBackdrop() {
  const glow = useRef<HTMLDivElement>(null);
  const streaks = useRef<HTMLDivElement>(null);
  const speedBox = useRef<HTMLDivElement>(null);
  const lap = useRef<HTMLSpanElement>(null);
  const kmh = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const fast = Math.min(1, race.speed / 260);
      // opacity only: composited, no repaint of the full-screen gradient
      glow.current!.style.opacity = ((0.12 + fast * 0.25) / 0.37).toFixed(3);
      streaks.current!.style.opacity = Math.min(1, fast * 1.2).toFixed(3);
      speedBox.current!.style.opacity = (0.18 + fast * 0.5).toFixed(3);
      lap.current!.textContent = String(Math.min(race.lap, 99)).padStart(2, '0');
      kmh.current!.textContent = String(Math.round(race.speed)).padStart(3, '0');
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="race-backdrop" aria-hidden="true">
      <div className="rb-glow" ref={glow} />
      <div className="rb-streaks" ref={streaks}>
        {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}
      </div>
      <div className="rb-lap"><small>Lap</small><span ref={lap}>01</span></div>
      <div className="rb-speed" ref={speedBox}><span ref={kmh}>000</span><small>km/h</small></div>
    </div>
  );
}
