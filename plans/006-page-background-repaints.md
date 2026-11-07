# 006 — Stop repainting the whole page background on colour changes and mouse moves

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files (`app/stage.css`, `components/Portfolio.tsx`), about 20 lines

## Problem

The full-screen page background is one stack of gradients that depends on two kinds of changing values:

```css
/* app/stage.css:6-14 — current */
.page {
  position: relative; display: block; height: 100dvh; max-width: none; margin: 0; padding: 0; overflow: hidden;
  transition: --accent 0.9s ease;
  background:
    var(--noise),
    radial-gradient(38% 52% at 50% 50%, color-mix(in srgb, var(--accent) 75%, transparent) 0%, transparent 72%),
    radial-gradient(30% 34% at var(--mx, 50%) var(--my, 40%), color-mix(in srgb, var(--accent) 38%, transparent), transparent 75%),
    linear-gradient(160deg, color-mix(in srgb, var(--accent) 28%, var(--c-blue-4-3)) 0%, var(--c-blue-4-3) 75%);
}
```

```tsx
// components/Portfolio.tsx:282-285 — current
      onPointerMove={(e) => {
        mainRef.current?.style.setProperty('--mx', `${(e.clientX / innerWidth) * 100}%`);
        mainRef.current?.style.setProperty('--my', `${(e.clientY / innerHeight) * 100}%`);
      }}
```

1. **Every mouse move repaints the whole viewport.** `--mx`/`--my` move the spotlight gradient's centre, so each pointer event recalculates style for the page and everything inside it (custom properties inherit) and repaints the full-screen background, while the 3D phone renders on top.
2. **Every accent change animates a repaint for 0.9 s.** `--accent` is a registered colour property (`@property` in `app/tokens.css`), so the transition repaints all three gradients every frame for 900 ms whenever the screen changes state (opening an app, starting the race, locking).

## Target

1. The spotlight becomes its own element, a fixed-size soft circle moved with `transform` (composited, no repaint, no inherited style recalc). The pointer handler writes a transform on that element only.
2. The accent transition shortens to 400 ms with an on-screen-morph curve. It still repaints, but for less than half as long. (A full crossfade of two stacked colour layers would remove the repaint entirely; it is not worth the extra markup here, so it is out of scope.)

```css
/* app/stage.css — target .page rule (spotlight line removed, transition shortened) */
.page {
  position: relative; display: block; height: 100dvh; max-width: none; margin: 0; padding: 0; overflow: hidden;
  transition: --accent 400ms var(--ease-in-out);
  background:
    var(--noise),
    radial-gradient(38% 52% at 50% 50%, color-mix(in srgb, var(--accent) 75%, transparent) 0%, transparent 72%),
    linear-gradient(160deg, color-mix(in srgb, var(--accent) 28%, var(--c-blue-4-3)) 0%, var(--c-blue-4-3) 75%);
}
/* new rule, directly after .page */
.spot {
  position: absolute; left: 0; top: 0; z-index: 0; width: 60vmax; height: 60vmax; margin: -30vmax 0 0 -30vmax;
  border-radius: 50%; pointer-events: none; will-change: transform;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 38%, transparent), transparent);
  transform: translate(50vw, 40vh);
}
@media (prefers-reduced-motion: reduce) { .spot { display: none; } }
```

```tsx
// components/Portfolio.tsx — target pointer handler on <main>
      onPointerMove={(e) => {
        if (spotRef.current) spotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }}
```

```tsx
// components/Portfolio.tsx — target: first child inside <main>, before {racing && <RaceBackdrop />}
      <div className="spot" ref={spotRef} aria-hidden="true" />
```

```tsx
// components/Portfolio.tsx — target: a ref next to the existing mainRef declaration
  const spotRef = useRef<HTMLDivElement>(null);
```

`--ease-in-out` is `cubic-bezier(0.77, 0, 0.175, 1)`.

## Repo conventions to follow

- Tokens live in `app/tokens.css` under `:root`. If `grep -n "\-\-ease-in-out" app/tokens.css` finds nothing, add `  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);` inside `:root` right after the `  --font-ios: ...;` line.
- Refs follow the existing `mainRef` pattern in `components/Portfolio.tsx` (`const mainRef = useRef<HTMLElement>(null);`).
- No literal colours in CSS; the spotlight keeps using `var(--accent)`.

## Steps

1. Ensure `--ease-in-out` exists in `app/tokens.css` (see above).
2. `app/stage.css`: replace the `.page { ... }` rule (lines 6-14 at 34de031) with the target `.page` rule, then insert the `.spot` rule and its reduced-motion line directly after it.
3. `components/Portfolio.tsx`: next to `const mainRef = useRef...`, add `const spotRef = useRef<HTMLDivElement>(null);`.
4. `components/Portfolio.tsx`: replace the body of `onPointerMove` (the two `setProperty('--mx'...)`/`('--my'...)` lines) with the single target line.
5. `components/Portfolio.tsx`: insert `<div className="spot" ref={spotRef} aria-hidden="true" />` as the first child of `<main ...>`, before `{racing && <RaceBackdrop />}`.
6. Run `grep -rn "\-\-mx\|\-\-my" app components`: it must return nothing.

## Boundaries

- Do NOT change `.page::after` (the vignette), the `--accent` values in `components/Portfolio.tsx`, or `app/tokens.css`'s `@property`.
- Do NOT move the HUD or the phone stage; `.spot` sits under them (`z-index: 0`; `.slot` is `z-index: 2`, HUD is `z-index: 5`).
- If the quoted code doesn't match (drift since 34de031), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .`, `npm test`, `npx next build` (all pass). Hallmark lint, if available, reports 0 FAIL.
- **Feel check**: `npm run dev` on a desktop browser:
  - Move the mouse: a soft accent-coloured glow follows the cursor as before, without lag.
  - DevTools Rendering > "Paint flashing" on: moving the mouse must not flash the whole page green (only the glow layer composites).
  - Open an app, then start the Grand Prix: the background colour shifts noticeably faster (about 0.4 s) and settles smoothly, with no flicker.
  - With reduced motion emulated, the cursor glow is gone and the colour still changes.
- **Done when**: no `--mx`/`--my` remain, mouse moves cause no full-page repaint, and the accent transition is 400 ms.
