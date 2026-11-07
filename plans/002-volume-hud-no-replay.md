# 002 — Stop the volume pop-up replaying its entrance on every press

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: HIGH
- **Category**: Purpose & frequency / Interruptibility
- **Estimated scope**: 1 file, 1 line

## Problem

The phone's volume / silent pop-up is keyed by a timestamp that changes on every press, so React unmounts and remounts it each time and its entrance animation replays:

```tsx
// components/PhoneScreen.tsx:89-90 — current
      {p.hud && lit && (
        <div className="hud-pop" key={p.hud.id} role="status">
```

```ts
// components/Portfolio.tsx:171 — current (in changeVolume, runs on every volume step)
    setHud({ kind: 'volume', id: Date.now() });
```

```css
/* app/globals.css:372-378 — current */
.hud-pop {
  ...
  box-shadow: inset 0 1px 0 var(--c-white-a12); animation: hudIn 0.18s ease-out;
}
@keyframes hudIn { from { opacity: 0; transform: scale(1.12); } }
```

Volume is a high-frequency control (arrow keys and the phone's 3D volume buttons). Holding the up arrow fires repeated presses, and each one restarts the pop-up from 112% scale and 0 opacity, so it flickers instead of staying put while the bars fill. On iOS the volume overlay appears once and then only its bars update.

## Target

Key the pop-up by its kind, not by the press. Repeated presses of the same kind keep the same element, so only the bars update; the entrance plays only when the pop-up first appears, or when it switches between volume and silent/ring.

```tsx
// components/PhoneScreen.tsx:90 — target
        <div className="hud-pop" key={p.hud.kind} role="status">
```

No change in `components/Portfolio.tsx`: its effect at lines 86-90 already restarts the 1300 ms hide timer whenever `hud` changes (the `id` still changes every press, which is what resets the timer).

## Repo conventions to follow

- Elements whose entrance should play once per appearance are keyed by what they show, not by a timestamp, e.g. `components/RaceHud.tsx:229` keys the garage card by `p.slug`.

## Steps

1. In `components/PhoneScreen.tsx`, on the line `<div className="hud-pop" key={p.hud.id} role="status">`, change `key={p.hud.id}` to `key={p.hud.kind}`. Nothing else.

## Boundaries

- Do NOT change `components/Portfolio.tsx`, the `Hud` type, or the hide timer.
- Do NOT change the `hudIn` keyframe or its duration.
- If the line doesn't match (drift since 34de031), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` (no output), `npx next build` (succeeds).
- **Feel check**: `npm run dev`, power the phone on (press any key), then:
  - Hold the up arrow key for two seconds: the pop-up appears once and stays still while the bars fill. Before, it pulsed on every step.
  - Release and wait: it disappears about 1.3 s after the last press.
  - Press M (silent): the pop-up switches to the crossed-out bell and plays its entrance once. Press M again (ring): it plays once more, which is expected because silent and ring are different kinds.
  - In DevTools Animations panel at 10% speed, pressing the arrow repeatedly records only one `hudIn` while the pop-up is visible.
- **Done when**: holding a volume key no longer restarts the pop-up's animation.
