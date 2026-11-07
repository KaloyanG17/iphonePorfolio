# 001 — Replace the global reduced-motion kill with targeted rules

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 3 files (`app/globals.css`, `app/stage.css`, `app/tokens.css`), about 40 lines

## Problem

`app/globals.css:342-344` switches off every animation and transition on the site for anyone with reduced motion on, with `!important`:

```css
/* app/globals.css:342 — current */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

Two consequences:

1. **It breaks the race for reduced-motion users.** The site already has gentle reduced-motion fallbacks that rely on a near-instant animation to hide an element, and the `!important` rule cancels them:

   ```css
   /* app/stage.css:292 — current */
   @media (prefers-reduced-motion: reduce) {
     .rh-start, .rh-title, .rh-podium, .rh-flag { animation: none; }
     .rh-go { animation: goOut 0.01s 1s forwards; }
   }
   /* app/stage.css:377 — current */
   @media (prefers-reduced-motion: reduce) { .rh-flag { animation: flagOut 0.01s 2.4s forwards; } }
   ```

   `.rh-go` ("GO", `components/RaceHud.tsx:185`) is rendered for the whole `race` phase and only disappears through `goOut`. With the global kill it stays on screen, 96px tall, for the entire lap. `.rh-flag` (the chequered flag card) likewise never fades, so during "Watch a lap" it covers the garage tour.
2. **It removes all feedback, not just movement.** Reduced motion means fewer and gentler animations, not none: fades that explain a state change (an app opening, a message arriving) should stay; scale, slide, fly-in and overshoot should go.

## Target

Delete the global rule. Add one targeted reduced-motion block per stylesheet that swaps movement for a short fade, and keeps every opacity-only animation as it is.

```css
/* app/globals.css — replaces lines 342-344 */
@media (prefers-reduced-motion: reduce) {
  /* fewer and gentler, not none: keep fades that explain a change, drop scale, slide and shimmer */
  .app, .safari, .banner, .hud-pop { animation: fadeIn 200ms var(--ease-out); }
  .bubble { animation: fadeIn 200ms var(--ease-out) both; }
  .slide-text, .power-hint { animation: none; }
  .knob.settle { transition: none; }
}
@keyframes fadeIn { from { opacity: 0; } }
@keyframes fadeOut { to { opacity: 0; } }
```

```css
/* app/stage.css — appended at the end of the file */
@media (prefers-reduced-motion: reduce) {
  .home .app-icon { animation: fadeIn 200ms var(--ease-out) both; animation-delay: 0s; }
  .home .grid, .home .dock { transition: opacity 200ms var(--ease-out); }
  .js .home.behind .grid, .js .home.behind .dock { transform: none; }
  .app.closing { animation: fadeOut 150ms var(--ease-out) forwards; }
  .lock-notice { animation: fadeIn 200ms var(--ease-out) 0.35s both; }
  .power-hint .dot, .rh-radio small i { animation: none; }
  .hud.finishes button { transition: border-color 200ms var(--ease-out); }
  .hud.finishes button.on { transform: none; }
  .rh-flash { transition: opacity 200ms var(--ease-out); }
}
```

Kept unchanged on purpose (they are opacity, colour or brightness only, or already have a fallback): `.screen-inner.lit` (litIn, a brightness fade), `.boot-logo` (bootIn, opacity), `.spinner` (a loading indicator that conveys state), `.stage`, `.backdrop` and `.page` transitions (opacity and colour), `.race-backdrop` (rbIn, opacity), and the existing reduced-motion blocks at `app/stage.css:146`, `:234`, `:292`, `:333` and `:377`, which start working again once the global rule is gone.

## Repo conventions to follow

- Tokens live in `app/tokens.css` under `:root`. This plan needs `--ease-out`. If `grep -n "\-\-ease-out" app/tokens.css` finds nothing, add this line inside `:root` right after the `  --font-ios: ...;` line: `  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);`
- The repo already writes per-element reduced-motion blocks, e.g. `app/stage.css:333-335` hides only the speed streaks. Follow that style: name the element, drop only its movement.

## Steps

1. Check for `--ease-out` in `app/tokens.css` as described above; add it if missing.
2. In `app/globals.css`, replace the three lines quoted in Problem (342-344) with the `app/globals.css` block from Target, verbatim.
3. Append the `app/stage.css` block from Target to the very end of `app/stage.css`, verbatim.
4. Run `grep -n "animation: none !important" app/*.css`: it must return nothing.

## Boundaries

- Do NOT change any keyframe outside the two new ones (`fadeIn`, `fadeOut`).
- Do NOT touch the existing reduced-motion blocks in `app/stage.css`.
- Do NOT touch `components/Phone3D.tsx` or `components/RaceScene.tsx`; they already read `prefers-reduced-motion` in JS.
- Do NOT change markup.
- If the quoted lines don't match the file (drift since 34de031), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` (no output), `npm test` (both suites pass), `npx next build` (succeeds).
- **Feel check**: `npm run dev`. In Chrome DevTools, open Rendering and set "Emulate CSS media feature prefers-reduced-motion" to `reduce`, then:
  - Press Grand Prix, then Press start. When the lights go out, "GO" appears and is gone within about a second. Before the fix it stayed for the whole lap.
  - Choose "Watch a lap" and wait for the finish: the chequered flag card disappears after about 2.4 s and the garage tour is visible behind it.
  - Open and close an app on the phone: it fades in and out with no zoom. Home-screen icons appear with a fade, no fly-in.
  - Turn the emulation off again: every original animation is back exactly as before (icons fly in, apps zoom from their icon).
- **Done when**: the global `!important` rule is gone, "GO" and the flag clear on their own with reduced motion on, and the build passes.
