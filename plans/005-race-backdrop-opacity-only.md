# 005 — Drive the race backdrop with opacity, not a repainted gradient

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files (`components/RaceBackdrop.tsx`, `app/stage.css`), about 20 lines

## Problem

While racing, a `requestAnimationFrame` loop writes the car's speed into a CSS variable on the backdrop root every frame:

```tsx
// components/RaceBackdrop.tsx:15-17 — current
    const tick = () => {
      const fast = Math.min(1, race.speed / 260);
      root.current!.style.setProperty('--fast', fast.toFixed(3));
```

That variable feeds a full-viewport radial gradient and a text colour:

```css
/* app/stage.css:305-310 — current */
.race-backdrop {
  --fast: 0; position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; user-select: none;
  animation: rbIn 0.8s ease both;
  background:
    radial-gradient(60% 50% at 50% 55%, color-mix(in srgb, var(--c-signal-red) calc((0.12 + var(--fast) * 0.25) * 100%), transparent), transparent 70%);
}
/* app/stage.css:318-321 — current */
.rb-speed {
  position: absolute; right: 38px; bottom: 76px; display: flex; align-items: baseline; gap: 8px;
  font: italic 800 clamp(48px, 7vw, 110px)/1 var(--font-numeric); font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--c-chalk) calc((0.18 + var(--fast) * 0.5) * 100%), transparent); letter-spacing: -0.04em;
}
/* app/stage.css:324 — current */
.rb-streaks { position: absolute; inset: 0; opacity: calc(var(--fast) * 1.2); }
```

Changing a gradient colour or a text colour forces a style recalculation and a repaint of the whole viewport-sized backdrop on every frame, on top of the WebGL race that is already using the GPU. Custom properties also inherit, so all 14 streak elements and both text blocks recalculate style each frame. Opacity on its own layer is composited without a repaint.

## Target

The glow becomes its own layer at full strength, and the loop sets three opacities directly. `--fast` goes away.

```tsx
// components/RaceBackdrop.tsx — target (whole component body)
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
```

```css
/* app/stage.css — target for the three rules */
.race-backdrop {
  position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; user-select: none;
  animation: rbIn 0.8s ease both;
}
.rb-glow {
  position: absolute; inset: 0; opacity: 0.32; will-change: opacity;
  background: radial-gradient(60% 50% at 50% 55%, color-mix(in srgb, var(--c-signal-red) 37%, transparent), transparent 70%);
}
.rb-speed {
  position: absolute; right: 38px; bottom: 76px; display: flex; align-items: baseline; gap: 8px;
  font: italic 800 clamp(48px, 7vw, 110px)/1 var(--font-numeric); font-variant-numeric: tabular-nums;
  color: var(--c-chalk); opacity: 0.18; letter-spacing: -0.04em;
}
.rb-streaks { position: absolute; inset: 0; opacity: 0; will-change: opacity; }
```

The yellow `km/h` label inside `.rb-speed` now fades with the number (it inherits the parent's opacity); that is acceptable and intended.

## Repo conventions to follow

- The race HUD already writes straight to the DOM from a rAF loop instead of React state (`components/RaceHud.tsx`, the `tick` function that sets `textContent`); keep that pattern.
- Colours stay as tokens (`var(--c-signal-red)`, `var(--c-chalk)`); no literal colours in CSS (the site's Hallmark lint enforces it).
- The `@media (min-width: 1600px)` rule near the end of `app/stage.css` sets `.rb-speed { right: ... }`; leave it, it still applies.

## Steps

1. Replace the body of `components/RaceBackdrop.tsx` from `export default function RaceBackdrop() {` to the end of the file with the target component above. Keep the imports and the top comment as they are.
2. In `app/stage.css`, replace the `.race-backdrop { ... }` rule (lines 305-310 at 34de031) with the target `.race-backdrop` and `.rb-glow` rules.
3. In `app/stage.css`, replace the `.rb-speed { ... }` rule (lines 318-322) with the target `.rb-speed` rule.
4. In `app/stage.css`, replace `.rb-streaks { position: absolute; inset: 0; opacity: calc(var(--fast) * 1.2); }` (line 324) with the target `.rb-streaks` rule.
5. Run `grep -rn "\-\-fast" app components`: it must return nothing.

## Boundaries

- Do NOT change `.rb-lap`, `.rb-streaks i`, the `streak` keyframe or the reduced-motion block at `app/stage.css:333-335`.
- Do NOT change `components/RaceHud.tsx` or `lib/race.ts`.
- Do NOT add dependencies.
- If the quoted code doesn't match (drift since 34de031), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` (no output), `npm test` (passes), `npx next build` (succeeds). Hallmark lint, if available: `node C:/Users/Kaloyan/.claude/skills/hallmark/scripts/sloplint.mjs app components --genre playful` reports 0 FAIL.
- **Feel check**: `npm run dev`, press Grand Prix, Press start, hold throttle:
  - The red glow behind the phone, the speed number bottom right and the light streaks all build smoothly with speed, as before.
  - In DevTools Performance, record 5 s of driving: the "Paint" entries for the full-viewport backdrop should be gone from each frame (only "Composite Layers" remains for it). Turn on Rendering > "Paint flashing": the backdrop area must not flash green every frame.
  - With reduced motion emulated, the streaks stay hidden and the glow and number still respond to speed.
- **Done when**: no `--fast` remains, and paint flashing shows no per-frame repaint of the backdrop while driving.
