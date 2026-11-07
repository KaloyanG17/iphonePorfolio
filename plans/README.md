# Animation plans

Written by an `improve-animations` audit at commit `34de031` (2026-11-07). Each plan is self-contained: any agent can run one with no other context. Plans change motion only, never content.

| # | Plan | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| 001 | [Replace the global reduced-motion kill with targeted rules](001-reduced-motion-targeted.md) | HIGH | Accessibility | DONE |
| 002 | [Stop the volume pop-up replaying its entrance on every press](002-volume-hud-no-replay.md) | HIGH | Purpose & frequency | DONE |
| 003 | [Race overlays leave with a strong ease-out, not ease-in](003-race-exits-ease-out.md) | MEDIUM | Easing & duration | DONE |
| 004 | [Close apps with a responsive ease-out, 220 ms](004-app-close-curve.md) | MEDIUM | Easing & duration | DONE |
| 005 | [Drive the race backdrop with opacity, not a repainted gradient](005-race-backdrop-opacity-only.md) | MEDIUM | Performance | DONE |
| 006 | [Stop repainting the whole page background on colour changes and mouse moves](006-page-background-repaints.md) | MEDIUM | Performance | DONE |
| 007 | [Give the radio dot its own keyframes](007-duplicate-blink-keyframes.md) | LOW | Cohesion & tokens | DONE |
| 008 | [Put the easing curves into shared motion tokens](008-motion-tokens.md) | LOW | Cohesion & tokens | DONE |

## Recommended order

1. **008** first: it adds `--ease-out`, `--ease-in-out` and the other motion tokens that 001, 003, 004 and 006 use. (Each of those plans adds the token itself if it's missing, so running them out of order still works.)
2. **001**: the HIGH bug ("GO" and the flag never clear with reduced motion on).
3. **002**: one-line fix.
4. **003**, then **004**: easing swaps.
5. **005**, then **006**: performance; both need a paint-flashing check in DevTools.
6. **007**: cleanup.

## Dependencies and overlaps

- 001 and 003 both touch race overlay animations in `app/stage.css`: 001 only adds reduced-motion rules; 003 only changes the normal exit curves. They don't edit the same lines.
- 003 and 008 touch the same lines (201, 375): 008 swaps the first curve on each line, 003 the second. Run 008 first to keep the diffs clean.
- 007 must not undo the `.rh-radio small i { animation: none; }` reduced-motion rule that 001 adds.

## Not planned (from the audit)

- Two missed opportunities were reported but not selected: a 150 ms fade on the race HUD when leaving the race, and a quick blur-masked crossfade when the garage card changes project.
- Left alone on purpose: the iOS app zoom to and from its icon (origin set at `components/screens.tsx:380`), the springboard fly-in (first unlock only), and the lock-screen notice's overshoot (once per visit).

## Execution

All eight ran on 2026-11-07 in the order above, one commit each (97e3001 to 19284b8), then one follow-up fix: plan 001 gave `.safari` its reduced-motion fade in `app/globals.css`, but `app/stage.css` loads later and redefines `.safari`, so the fade was moved into the reduced-motion block at the end of `app/stage.css`.
