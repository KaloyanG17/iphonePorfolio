'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const DESIGN_W = 400;
const DESIGN_H = 770;

// Flat CSS phone: shown while the 3D scene loads, and kept when WebGL is unavailable.
export default function Phone2D({ screen, onHome }: { screen: ReactNode; onHome: () => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = slot.current!;
    const fit = () => setScale(Math.min(1.2, el.clientWidth / DESIGN_W, el.clientHeight / DESIGN_H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="slot-fill" ref={slot}>
      <div className="phone-box" style={{ width: DESIGN_W * scale, height: DESIGN_H * scale, opacity: scale ? 1 : 0 }}>
        <div className="phone-design" style={{ transform: `scale(${scale})` }}>
          <div className="phone">
            <span className="camera" aria-hidden="true" />
            <span className="speaker" aria-hidden="true" />
            <div className="screen">{screen}</div>
            <button type="button" className="home-btn" aria-label="Home button" onClick={onHome}><span /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
