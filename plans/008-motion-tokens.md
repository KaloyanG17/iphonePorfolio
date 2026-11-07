# 008 — Put the easing curves into shared motion tokens

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 3 files (`app/tokens.css`, `app/stage.css`, `app/globals.css`), about 15 one-line edits

Run this plan first: plans 001, 003 and 004 use the tokens it adds (each of them also adds a token itself if it is missing).

## Problem

The site has no motion tokens. Seven hand-typed cubic-beziers do three jobs, and two of them are near-duplicates of the same strong ease-out:

```css
/* app/globals.css:222 — current */
  background: var(--c-blue-99); color: var(--c-blue-3); animation: zoomIn 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
/* app/stage.css:66 — current */
  box-shadow: 0 3px 8px var(--c-black-a55); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s;
/* app/stage.css:93 — current */
.home .app-icon { animation: flyIn 0.65s cubic-bezier(0.2, 0.9, 0.25, 1.08) both; animation-delay: calc(var(--i, 0) * 32ms + 60ms); }
/* app/stage.css:95 — current */
.home .grid, .home .dock { transition: transform 0.38s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease; }
/* app/stage.css:108 — current */
  animation: noticeIn 0.55s 0.35s cubic-bezier(0.2, 0.9, 0.25, 1.25) both;
/* app/stage.css:122 — current */
  animation: zoomIn 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
/* app/stage.css:182 — current */
  transition: opacity 0.2s, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: none;
/* app/stage.css:201 — current */
  animation: radioIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both, radioOut 0.4s ease-in 4.8s forwards;
/* app/stage.css:215 — current */
  animation: cardUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
/* app/stage.css:243 — current */
  box-shadow: 0 12px 32px var(--c-black-a50); animation: cardUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
/* app/stage.css:275 — current */
  border-radius: 6px; box-shadow: 0 10px 30px var(--c-black-a50); animation: cardUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
/* app/stage.css:375 — current */
.rh-flag { animation: cardUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both, flagOut 0.35s ease-in 2.3s forwards; }
```

`app/stage.css:98` (`cubic-bezier(0.4, 0, 0.9, 0.5)`) is handled by plan 004 and `ease-in` exits by plan 003. Leave those two curves alone here.

## Target

Five tokens in `app/tokens.css`, and every curve above replaced by one of them:

```css
/* app/tokens.css, inside :root, after the --font-* lines */
  /* motion: strong ease-out for anything entering or responding, ease-in-out for on-screen moves,
     and two soft overshoots kept only for the iOS springboard and lock-screen moments */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-spring-soft: cubic-bezier(0.2, 0.9, 0.25, 1.08);
  --ease-spring: cubic-bezier(0.2, 0.9, 0.25, 1.25);
```

Mapping:

| Current curve | Replace with |
| --- | --- |
| `cubic-bezier(0.16, 1, 0.3, 1)` (7 places) | `var(--ease-out)` |
| `cubic-bezier(0.2, 0.8, 0.2, 1)` (3 places) | `var(--ease-out)` |
| `cubic-bezier(0.2, 0.9, 0.25, 1.08)` (stage.css:93) | `var(--ease-spring-soft)` |
| `cubic-bezier(0.2, 0.9, 0.25, 1.25)` (stage.css:108) | `var(--ease-spring)` |

Durations do not change in this plan.

## Repo conventions to follow

- Every colour and font already lives in `app/tokens.css` under `:root` (the file opens with Hallmark stamp comments; leave those first lines untouched). Add the motion tokens in the same `:root` block, directly after `--font-ios: ...;`.
- Tokens are referenced with `var(--name)`, e.g. `app/stage.css:66` already uses `var(--c-black-a55)` beside the curve you are replacing.

## Steps

1. In `app/tokens.css`, inside `:root`, after the line starting `  --font-ios:`, insert the token block from Target verbatim. If `--ease-out` already exists (another plan added it), add only the missing tokens.
2. In `app/stage.css` and `app/globals.css`, replace every `cubic-bezier(0.16, 1, 0.3, 1)` with `var(--ease-out)`. Expect 7 replacements, all in `app/stage.css` (lines 66, 182, 201, 215, 243, 275 and 375 at 34de031).
3. Replace every `cubic-bezier(0.2, 0.8, 0.2, 1)` with `var(--ease-out)`: `app/globals.css:222`, `app/stage.css:95`, `app/stage.css:122`.
4. `app/stage.css:93`: replace `cubic-bezier(0.2, 0.9, 0.25, 1.08)` with `var(--ease-spring-soft)`.
5. `app/stage.css:108`: replace `cubic-bezier(0.2, 0.9, 0.25, 1.25)` with `var(--ease-spring)`.
6. Run `grep -n "cubic-bezier" app/*.css`. The only results left must be the five token definitions in `app/tokens.css` and `app/stage.css:98` (plan 004's).

## Boundaries

- Do NOT change any duration, delay or keyframe.
- Do NOT touch `app/stage.css:98` (`.app.closing`) or any `ease-in` (plans 004 and 003).
- Do NOT edit the comment lines at the top of `app/tokens.css`.
- Do NOT add dependencies.
- If a line quoted above doesn't match the file (drift since 34de031), STOP and report instead of improvising.

## Verification

- **Mechanical**: from `D:\iphoneSite\kgos-portfolio`, run `npx tsc --noEmit -p .` (no output), `npm test` (both suites print "all checks passed"), `npx next build` (ends with the route list, no errors).
- **Feel check**: `npm run dev`, open the site:
  - Open and close an app on the phone, and open a project's site: the zoom in should feel identical or slightly snappier than before, never slower to start.
  - Start the Grand Prix and park at a garage: the project card should rise in with no bounce.
  - In DevTools Animations panel at 10% speed, the springboard icons (first unlock) and the lock-screen notice should still overshoot slightly; everything else settles without overshoot.
- **Done when**: `grep -n "cubic-bezier" app/*.css` lists only `app/tokens.css` definitions and `app/stage.css:98`, and the build passes.
