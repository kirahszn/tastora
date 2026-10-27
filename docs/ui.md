# User interface (Phase 4)

Journey: Welcome `/` → Profile `/profile` → Searching (live trace) → Results `/results` → Details →
Feedback → Search again. Code: `src/app/`, `src/components/`, pure helpers in `src/lib/ui/` (tested
in `tests/ui-helpers.test.ts`). No UI libraries; CSS modules plus `src/app/globals.css`.

## Principles, and where they live

| Principle | Implementation |
|---|---|
| Tastes, not age stereotypes | Profile asks only for the person's own foods and taste memories; no age field |
| Preferences vs hard constraints | Separate form sections; "Must avoid" has a warning frame. Results show "Why it was suggested" apart from "Their needs" |
| Allergies/texture never safe | `displayStatus()` maps any allergy/texture `matched` to "Needs confirmation" (the engine never matches them; this guards the UI too) |
| Status never colour alone | `STATUS_DISPLAY`: icon + text label + colour (Matched ✓ green, Needs confirmation ? amber, Conflict ✕ red) |
| No ordering language | `tests/ui-helpers.test.ts` scans all UI source for order/buy/checkout/purchase/cart |
| No safety claims | Same file bans "safe", "allergen-free", "guaranteed", "verified safe" in UI source and the server modules whose strings reach the screen, unless negated ("never shown as safe") |
| Say what happened | `notices` from the server appear under "About this search" (fallbacks, unmatched taste memories) |
| No invented restaurant text | Cards render only `results[]` facts; links pass `safeHttpUrl` / `telHref` |
| Evidence only from `evidence` | `EvidencePanel` + `rankMovement()` |

## Storage (all `try/catch` guarded, Zod-validated on read)

| Key | Where | Content |
|---|---|---|
| `tastora.profile.v1` | localStorage | `SeniorProfile` |
| `tastora.feedback.v1` | localStorage | `{ entries: { [venueId]: { verdict, name } } }`; verdicts liked / disliked ("Not for them") / notSuitable / tried, sent as `feedback` (≤ 50 per list) |
| `tastora.lastSearch.v1` | sessionStorage | Last response + the profile it was for, so reload/Back doesn't re-run a live search |

`displayName` is never sent to the server (`requestBody()` strips it). Loading an example or
clearing the profile clears feedback and the cached search.

## Progress

`runSearch()` posts to `/api/recommend?stream=1` and shows each real trace step as it arrives (no
timed messages). If the stream breaks before a result it shows a plain notice and makes one JSON
request. 400/429/502/offline each have their own message and a retry (or "Check the profile").

## Presentation and headers (Phase 5)

- Favicon `src/app/icon.svg` (original: bowl and steam on terracotta). Share card
  `opengraph-image.tsx` / `twitter-image.tsx` via `next/og` (1200×630 PNG at build), with
  `metadataBase` so Open Graph/Twitter URLs are absolute.
- `next.config.ts` headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy:
  frame-ancestors 'self'`, a restrictive `Permissions-Policy`. No full CSP (untested risk). Framing
  is same-origin rather than `DENY` so the app can be checked at 375px in a same-origin frame.
- "Must avoid" is a calm terracotta-bordered panel with a shield icon ("Tastora checks every
  result against these."), not an error colour. The Sinatra example is listed first.

## Design tokens and accessibility

Warm cream surfaces, terracotta accent, deep ink; dark tokens under `prefers-color-scheme: dark`.
Georgia-stack serif headings, system sans body, 18px base. WCAG contrast (computed): ink on
background 14.5:1 (dark 14.9), muted 7.5:1 (9.6), accent 5.7:1 (7.4), text on accent 6.0:1 (7.1),
status text on status backgrounds 5.4–6.2:1 (7.0–8.4), input borders 4.2:1. Focus ring 3px,
offset 3px, 7.6:1 against the page (9.8 dark). Tap targets ≥ 44px. `aria-live="polite"` for
progress and announcements; reduced motion stops the spinner. Error summary takes focus and links
to fields; inline errors use `aria-invalid`.
