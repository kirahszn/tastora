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

- Favicon `src/app/icon.svg` (original chef mark on a terracotta tile, Phase 9a-2). Share card
  `opengraph-image.tsx` / `twitter-image.tsx` via `next/og` (1200×630 PNG at build), with
  `metadataBase` so Open Graph/Twitter URLs are absolute.
- `next.config.ts` headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy:
  frame-ancestors 'self'`, a restrictive `Permissions-Policy`. No full CSP (untested risk). Framing
  is same-origin rather than `DENY` so the app can be checked at 375px in a same-origin frame.
- "Must avoid" is a calm terracotta-bordered panel with a shield icon ("Tastora checks every
  result against these."), not an error colour. The Sinatra example is listed first.

## Design tokens and accessibility

One warm light theme only (Phase 9a-2): no `prefers-color-scheme` rules, `color-scheme: light`
and a single `theme-color` `#FFFBF7`, so every page (/, /profile, /results, /results/print) is
light whatever the OS setting. Page `#FFFBF7` (warm white), section band `#FBF0E6`, white cards,
panel `#F5ECE0`, espresso text `#2B1D16`, muted `#6B5B50`, border `#EADFD2`. The landing page
adds a very soft terracotta radial glow (8%) behind the hero, painted on the body so it has no
edge, and a full-width warm band behind "How it works", and a peach band (`--tint-peach`) for the closing call to action. Pastel tints (peach/sage/butter/lavender)
back text; the icon-only tiles use slightly deeper versions (`--tile-*`) so they read on white.
Terracotta is split in two: `--accent-fill` `#D9774F` is only ever a button/badge background with
espresso `--on-accent` text, never white; `--accent` `#A44F2E` is terracotta for text, links and
borders (the brief's `#B85C38` gave 4.2:1 on cream). Georgia-stack serif headings, system sans
body, 18px base, no web fonts.

WCAG contrast (computed): espresso on page 15.8:1, on band 14.5:1, on the glow's strongest point
14.6:1; muted 6.3:1 (band 5.8, glow 5.8); accent text 5.5:1 on the page, 5.0:1 on the band and
glow, ≥ 4.57:1 on text tints; espresso on terracotta fill 5.2:1; status text on status
backgrounds 5.4–6.2:1, and Matched/Needs confirmation/Conflict text on the band 5.7/6.3/6.5:1;
icons on tiles ≥ 12.5:1; input borders 4.1:1 (band 3.8). A rendered-page audit (every visible
text node against its composited background, OS set to dark) found no pair under AA on `/`,
`/profile`, `/results` or `/results/print`. Focus ring 3px, offset 3px, 8.1:1 against the page.
Tap targets ≥ 44px. `aria-live="polite"` for progress and announcements; reduced motion stops
the spinner. Error summary takes focus and links to fields; inline errors use `aria-invalid`.

## Landing page (Phase 9a, 9a-2, 9a-3)

`src/app/page.tsx` composes `src/app/_landing/` as a story: Hero (laptop frame) → Problem (photo
+ four rows) → Values (three tinted cards) → Showcase (`#how`, accordion + phone) → QlooProof
(`#qloo`, stat cards) → Steps → Closing band. Footer and nav stay in `layout.tsx`. The page sets
`data-layout="wide"`, and `:has()` rules widen it to 1120px and swap the nav: on the landing page
"How it works", "Why Qloo", "Profile" and a "Find food" pill (phones: the pill only); every other
page keeps the single Profile link.

- **Device frames** (`Devices.tsx`) are pure CSS around real screenshots in `public/images/screen-*`,
  captured 2026-10-28 from the live app with the Sinatra-example response of 2026-10-27 seeded into
  storage (no new search): the results page (laptop) and four 390×844 phone views (taste memories,
  must avoid, a result card's reasons, its "Ask the restaurant" box).
- **Accordion** (`Showcase.tsx`): `<button aria-expanded aria-controls>` in an `h3`, panels with
  `role="region"`. Before hydration (and without JS) every panel is open and the phone shows the
  first screen; after it one panel is open at a time and the phone swaps screens (all four images
  load eagerly so a swap never waits).
- **Qloo proof** (`proofStats.ts`): each figure carries the doc and the exact quote it comes from;
  `tests/landing.test.ts` fails if a quote disappears from its doc.
- `FadeUp` uses IntersectionObserver and only hides a section once armed by script, so content
  shows without JS and with reduced motion.

- **Logo:** `ChefMark` (`src/components/ChefMark.tsx`), an original flat chef (puffed hat, round
  smiling face), decorative next to the "Tastora" wordmark. The favicon `src/app/icon.svg` and the
  share card use the same shapes.
- **Photo:** `Photo.tsx` serves `public/images/family-dinner.jpg` (2000×1333, 304 KB) through
  `next/image` with a blur placeholder and `sizes`, so phones get a small WebP. Pexels photo
  11368637 by Anna Shvets, Pexels License; credited under the photo and in the README, worded so
  it doesn't imply the people use Tastora.
