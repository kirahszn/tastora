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
| `tastora.shortlist.v1` | sessionStorage | `{ resultSet, ids }`: shortlisted venue ids for one result set (ids joined); stale or corrupted → top 3 again. Cleared when a new search starts |

## Share and print (Phase 8)

`buildShareText()` in `src/lib/ui/share.ts` (tested in `tests/share.test.ts`) lays out shortlisted
facts as plain text within ~1,500 characters, trimming dishes, then the reason, then questions,
then whole places ("And 2 more places on the shortlist."). The "Why" line prefers a favourite dish,
then cuisine, never the Qloo rank unless nothing else exists. `ShortlistBar` offers the share sheet
(`navigator.share`), copy (clipboard API, `execCommand` fallback) and `https://wa.me/?text=`.
`/results/print` reads the cached search + shortlist; `@media print` in `globals.css` forces light
tokens and hides the site header/footer. Hours are not in the response, so the checklist relies
on the "Confirm opening hours (none listed)" question when Qloo has none.

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

Phase 9a palette: cream page `#FBF6EE`, white cards, espresso text `#2B1D16`, muted `#6B5B50`,
border `#EADFD2`, icon-tile tints peach/sage/butter/lavender; dark mode `#1C1512` / `#2A201B` /
`#F3E9DC` / `#B9A898`, tints at 12%. Terracotta is split in two: `--accent-fill` `#D9774F` (dark
`#E5936F`) is only ever a button/badge background with espresso `--on-accent` text, never white;
`--accent` is terracotta for text, links and borders. The brief's `#B85C38` gave 4.2:1 on cream,
so `--accent` is `#A44F2E`, the nearest shade that clears 4.5:1 on every light surface and tint.
Georgia-stack serif headings, system sans body, 18px base, no web fonts. WCAG contrast (computed):
espresso on cream 15.1:1 (dark 15.0), muted 6.0:1 (7.8), accent text 5.2:1 on cream and ≥ 4.57:1
on tints (dark 7.5 / ≥ 4.7), espresso on terracotta fill 5.2:1 (dark 6.8), status text on status
backgrounds 5.4–6.2:1 (7.0–8.4), input borders 4.0:1. A rendered-page audit (every visible text
node against its composited background) found no pair under AA on `/`, `/profile` or `/results`
in either mode. Focus ring 3px, offset 3px, 7.7:1 against the page (10.0 dark).

## Landing page (Phase 9a)

`src/app/page.tsx` composes `src/app/_landing/` (Hero, SampleCard, Illustration, EntryCards,
HowItWorks, TrustStrip; footer and nav stay in `layout.tsx`). The page sets `data-layout="wide"`
and `layout.module.css` widens to 1120px with `:has()`, so other pages keep the reading width.
The sample card is a static snapshot of a real result (`sampleResult.ts`, captured 2026-10-27
from one live Sinatra-example search), rendered with the same `StatusBadge` as results. The
illustration is an original inline SVG. `FadeUp` uses IntersectionObserver and only hides a
section once armed by script, so content shows without JS and with reduced motion. Tap targets ≥ 44px. `aria-live="polite"` for
progress and announcements; reduced motion stops the spinner. Error summary takes focus and links
to fields; inline errors use `aria-invalid`.
