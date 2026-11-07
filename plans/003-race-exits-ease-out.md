# 003 — Race overlays leave with a strong ease-out, not ease-in

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file (`app/stage.css`), 3 lines (plus 1 token line if missing)

## Problem

Three race overlays leave with `ease-in`, which starts slowly, so each exit hangs for its first frames exactly when the player is watching it go. Two also run longer than the 300 ms UI budget:

```css
/* app/stage.css:201 — current (radio message: in, then out after ~5 s) */
  animation: radioIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both, radioOut 0.4s ease-in 4.8s forwards;
/* app/stage.css:267 — current ("GO" after the start lights) */
  animation: goOut 1s ease-in 0.5s forwards;
/* app/stage.css:375 — current (chequered flag card) */
.rh-flag { animation: cardUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both, flagOut 0.35s ease-in 2.3s forwards; }
```

(If plan 008 has already run, `cubic-bezier(0.16, 1, 0.3, 1)` will read `var(--ease-out)` on those lines. Either form is fine; this plan only touches the second animation on each line.)

Timing constraints that must still hold:

- The radio element is removed by JS 5.2 s after it appears (`components/RaceHud.tsx`, `setTimeout(() => setRadio(null), 5200)`), so `radioOut` must finish before 5.2 s.
- The flag must be gone before the podium replaces it at 2.4 s (`components/RaceHud.tsx`, `performance.now() - finishAt > 2400`).

## Target

```css
/* app/stage.css:201 — target: out starts 4.8 s, ends 5.04 s */
  animation: radioIn 0.35s var(--ease-out) both, radioOut 240ms var(--ease-out) 4.8s forwards;
/* app/stage.css:267 — target: GO holds 0.6 s, then scales away in 300 ms */
  animation: goOut 300ms var(--ease-out) 0.6s forwards;
/* app/stage.css:375 — target: flag leaves at 2.1 s, gone by 2.35 s */
.rh-flag { animation: cardUp 0.4s var(--ease-out) both, flagOut 250ms var(--ease-out) 2.1s forwards; }
```

`--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`.

## Repo conventions to follow

- Tokens live in `app/tokens.css` under `:root`. If `grep -n "\-\-ease-out" app/tokens.css` finds nothing, add this line inside `:root` right after the `  --font-ios: ...;` line: `  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);`
- Entrances already use a strong ease-out (`radioIn`, `cardUp`); exits should match.

## Steps

1. Ensure `--ease-out` exists in `app/tokens.css` (see above).
2. `app/stage.css`, the `.rh-radio` rule (line 201 at 34de031): replace `radioOut 0.4s ease-in 4.8s forwards` with `radioOut 240ms var(--ease-out) 4.8s forwards`.
3. `app/stage.css`, the `.rh-go` rule (line 267): replace `animation: goOut 1s ease-in 0.5s forwards;` with `animation: goOut 300ms var(--ease-out) 0.6s forwards;`.
4. `app/stage.css`, line 375: replace `flagOut 0.35s ease-in 2.3s forwards` with `flagOut 250ms var(--ease-out) 2.1s forwards`.
5. Run `grep -n "ease-in " app/*.css` (note the trailing space): it must return nothing.

## Boundaries

- Do NOT change the keyframes (`radioOut`, `goOut`, `flagOut`) or the entrance animations.
- Do NOT change the reduced-motion blocks (`app/stage.css:234`, `:292`, `:377`).
- Do NOT touch `components/RaceHud.tsx` timers.
- If lines don't match (drift since 34de031), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .`, `npx next build` (succeeds).
- **Feel check**: `npm run dev`, press Grand Prix, then Press start:
  - When the lights go out, "GO" holds briefly, then bursts outward and fades in a single quick move, with no slow start.
  - Drive into sector 2 (or choose Watch a lap): the radio message slides in, and about 5 s later snaps away to the left quickly instead of drifting.
  - At the finish line, the chequered flag rises in, then leaves quickly just before the podium appears; the two never overlap.
  - In DevTools Animations panel at 10% speed, each exit curve shows most of its movement in the first third.
- **Done when**: no `ease-in` remains in the CSS, and all three exits finish within their windows (radio before 5.2 s, flag before 2.4 s).
