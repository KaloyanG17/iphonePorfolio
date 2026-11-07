# 007 — Give the radio dot its own keyframes

- **Status**: DONE
- **Commit**: 34de031
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (`app/stage.css`), 2 lines

## Problem

`app/stage.css` defines `@keyframes blink` twice. In CSS the last definition wins for the whole document, so the second silently replaces the first:

```css
/* app/stage.css:71-72 — current (power hint dot, breathing slowly) */
.power-hint .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c-red-60); box-shadow: 0 0 10px var(--c-red-60); animation: blink 1.2s ease-in-out infinite; }
@keyframes blink { 50% { opacity: 0.25; } }

/* app/stage.css:204 and :209 — current (race radio's "on air" dot, hard blink) */
.rh-radio small i { width: 7px; height: 7px; border-radius: 50%; background: var(--c-red-48); animation: blink 0.6s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0.2; } }
```

The power hint's dot is meant to dim to 25% but actually uses the later block (20%). It's a small visual difference, but the next person to tune either dot will change both without knowing.

## Target

```css
/* app/stage.css:204 — target */
.rh-radio small i { width: 7px; height: 7px; border-radius: 50%; background: var(--c-red-48); animation: radioBlink 0.6s steps(2) infinite; }
/* app/stage.css:209 — target */
@keyframes radioBlink { 50% { opacity: 0.2; } }
```

Lines 71-72 stay exactly as they are, and are now the only `blink`.

## Repo conventions to follow

- Keyframes in `app/stage.css` are named after what they do to their element (`radioIn`, `radioOut`, `cardUp`, `flagOut`); `radioBlink` follows that.

## Steps

1. `app/stage.css:204`: in the `.rh-radio small i` rule, change `animation: blink 0.6s steps(2) infinite;` to `animation: radioBlink 0.6s steps(2) infinite;`.
2. `app/stage.css:209`: change `@keyframes blink { 50% { opacity: 0.2; } }` to `@keyframes radioBlink { 50% { opacity: 0.2; } }`.
3. Run `grep -n "keyframes blink" app/*.css`: exactly one result, at `app/stage.css:72`.

## Boundaries

- Do NOT change lines 71-72, durations or opacities.
- If plan 001 already added `.rh-radio small i` to a reduced-motion rule, leave that rule alone.
- If the lines don't match (drift since 34de031), STOP and report.

## Verification

- **Mechanical**: `npx next build` (succeeds).
- **Feel check**: `npm run dev`:
  - With the phone off, the red dot in the "Press any key" hint breathes softly (dims to 25%).
  - In the race, the radio message's red dot blinks hard on/off.
- **Done when**: each dot has its own keyframes and `grep` finds one `@keyframes blink`.
