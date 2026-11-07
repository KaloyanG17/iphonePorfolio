# 004 — Close apps with a responsive ease-out, 220 ms

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 2 files, 2 lines (plus 1 token line if missing)

## Problem

Closing an app on the phone (the 3D home button, or Esc) shrinks it back into its icon with an ease-in curve:

```css
/* app/stage.css:98 — current */
.app.closing { animation: zoomOut 0.28s cubic-bezier(0.4, 0, 0.9, 0.5) forwards; }
@keyframes zoomOut { to { transform: scale(0.12); opacity: 0; } }
```

`cubic-bezier(0.4, 0, 0.9, 0.5)` starts slow and accelerates, so for the first ~100 ms after pressing home nothing seems to happen. Visitors open and close apps tens of times a visit, so that dead start is felt every time. The zoom down to the icon itself is the iOS metaphor and stays (its `transform-origin` is set to the icon, so `scale(0.12)` lands on the icon; this is by design, not a `scale(0)` problem).

The JS waits for the animation before unmounting the app:

```ts
// components/Portfolio.tsx:144-148 — current (closeApp)
    closeTimer.current = setTimeout(() => {
      ...
    }, 280);
```

## Target

```css
/* app/stage.css:98 — target */
.app.closing { animation: zoomOut 220ms var(--ease-out) forwards; }
```

```ts
// components/Portfolio.tsx:148 — target
    }, 220);
```

`--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`.

## Repo conventions to follow

- Tokens live in `app/tokens.css` under `:root`. If `grep -n "\-\-ease-out" app/tokens.css` finds nothing, add this line inside `:root` right after the `  --font-ios: ...;` line: `  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);`
- The opening zoom (`app/globals.css:222`, `zoomIn 0.32s`) already uses a strong ease-out; the close should match its character.

## Steps

1. Ensure `--ease-out` exists in `app/tokens.css` (see above).
2. `app/stage.css:98`: replace `animation: zoomOut 0.28s cubic-bezier(0.4, 0, 0.9, 0.5) forwards;` with `animation: zoomOut 220ms var(--ease-out) forwards;`.
3. `components/Portfolio.tsx`: in `closeApp`, change the timer's delay from `280` to `220` (the `}, 280);` line, line 148 at 34de031). Change only that number.

## Boundaries

- Do NOT change the `zoomOut` keyframe or `transform-origin`.
- Do NOT change any other timer in `components/Portfolio.tsx`.
- If the quoted lines don't match (drift since 34de031), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` (no output), `npx next build` (succeeds).
- **Feel check**: `npm run dev`, power the phone on, open About, then press Esc:
  - The app starts shrinking toward its icon the instant you press, with no pause.
  - The home screen is interactive right after the app disappears (no frame where the app is gone but clicks are blocked).
  - Open and close an app five times quickly: no flash of the app reappearing after it vanishes.
  - In DevTools Animations panel at 10% speed, most of the shrink happens in the first third of the 220 ms.
- **Done when**: the close curve is `var(--ease-out)` at 220 ms and the JS timer matches it.
