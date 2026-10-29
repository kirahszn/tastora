# User interface (Phase 4)

Journey: Welcome `/` → Profile `/profile` → Searching (live trace) → Results `/results` → Details →
Feedback → Search again. Code: `src/app/`, `src/components/`, pure helpers in `src/lib/ui/` (tested
in `tests/ui-helpers.test.ts`). No UI libraries; CSS modules plus `src/app/globals.css`.

## Principles, and where they live

| Principle | Implementation |
|---|---|
| Tastes, not age stereotypes | Profile asks only for the person's own foods and taste memories; no age field |
| Preferences vs hard constraints | Separate form sections; "Must avoid" has a calm terracotta frame. Each card's one-line reason sits apart from "Their needs" |
| Allergies/texture never safe | `displayStatus()` maps any allergy/texture `matched` to "Needs confirmation" (the engine never matches them; this guards the UI too) |
| Status never colour alone | `STATUS_DISPLAY`: icon + text label + colour (Matched ✓ green, Needs confirmation ? amber, Conflict ✕ red) |
| No ordering language | `tests/ui-helpers.test.ts` scans all UI source for order/buy/checkout/purchase/cart |
| No safety claims | Same file bans "safe", "allergen-free", "guaranteed", "verified safe" in UI source and the server modules whose strings reach the screen, unless negated ("never shown as safe") |
| Say what happened | `notices` from the server appear under "About this search" (fallbacks, unmatched taste memories) |
| No invented restaurant text | Cards render only `results[]` facts; links pass `safeHttpUrl` / `telHref` |
| Evidence only from `evidence` | `EvidencePanel` + `rankMovement()` |

## Location (Phase 9c)

The profile's "Where" section has a required free-text **City** (≤ 60 characters, trimmed) with
quick-pick chips for New York City and the cities rated Good in the coverage check (London, Toronto,
Los Angeles, Chicago, Sydney; Lagos was Thin, so no chip), and an optional **Neighbourhood or area**
(≤ 60). Saved profiles from before Phase 9c had one `location` string from the borough form;
`SeniorProfileSchema` migrates it on read: a value naming a borough ("Queens", "Bed-Stuy, Brooklyn")
becomes city "New York City" + that area. The same key `tastora.profile.v1` is kept.

Results: card labels come from `area.label` ("In Brooklyn", "Outside NYC (…)"; elsewhere "In
London", "In the Sydney area", "Nearby: Markham"; nothing when unknown). A calm note (grey panel, not
the warning style) shows `coverageNote` from the server: "Fewer matches found around <city>. Qloo's
restaurant coverage varies by city." when fewer than 4 places came back or the city is rated
Thin/Poor. If Qloo can't resolve the city, the server answers 400 `code: "location_not_found"` and the
page says "We couldn't find that place … try the nearest larger city" with a "Change the city" button.
Phones in share text and the print checklist: US/Canada as "(416) 504-9669", others as Qloo gives them
(international form); `tel:` links stay E.164. Landing copy has no NYC-only wording; the Qloo proof
caption says the figures are "From Tastora's test searches in New York City, October 2026."

## Storage (all `try/catch` guarded, Zod-validated on read)

| Key | Where | Content |
|---|---|---|
| `tastora.profile.v1` | localStorage | `SeniorProfile` |
| `tastora.feedback.v1` | localStorage | `{ entries: { [venueId]: { verdict, name } } }`; verdicts liked / disliked ("Not for them") / notSuitable / tried, sent as `feedback` (≤ 50 per list) |
| `tastora.lastSearch.v1` | sessionStorage | Last response + the profile it was for, so reload/Back doesn't re-run a live search |
| `tastora.shortlist.v1` | sessionStorage | `{ resultSet, ids }`: shortlisted venue ids for one result set (ids joined); stale or corrupted → top 3 again. Cleared when a new search starts |

## Share and print (Phase 8)

`buildShareText()` in `src/lib/ui/share.ts` (tested in `tests/share.test.ts`) lays out shortlisted
facts as plain text within ~1,500 characters, trimming dishes, then the reason and good signs, then
questions, then whole places ("And 2 more places on the shortlist."). The "Why" line prefers Qloo's
taste reason when it names a signal, then a favourite dish, then cuisine. "Good signs:" lists comfort
and diet needs a venue tag matched ("Wheelchair access (venue tag)"), never allergies or texture.
Questions are listed under "Questions to ask:" exactly as the facts phrase them. `ShortlistBar` offers the share sheet
(`navigator.share`), copy (clipboard API, `execCommand` fallback) and `https://wa.me/?text=`.
`/results/print` reads the cached search + shortlist; `@media print` in `globals.css` forces light
tokens and hides the site header/footer. Hours are not in the response, so the checklist relies
on the "Confirm opening hours (none listed)" question when Qloo has none.

`displayName` is never sent to the server (`requestBody()` strips it). Loading an example or
clearing the profile clears feedback and the cached search.

## Progress

`runSearch()` posts to `/api/recommend?stream=1` and shows each real trace step as it arrives (no
timed messages). If the stream breaks before a result it shows a plain notice and makes one JSON
request. 400/429/502/offline each have their own message and a retry (or "Check the profile";
"Change the city" for an unresolvable location).

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
borders (the brief's `#B85C38` gave 4.2:1 on cream).

**Type and layout (Phase 10).** Manrope via `next/font/google` (self-hosted at build; the browser
never calls Google) for headings (700, tight tracking) and body (17px, `--text-body`), a mono stack
for captions and numbers (`.mono`), and the Georgia serif only for the "Tastora" wordmark. Sizes are
tokens in `globals.css` (`--text-h1` clamp(2.25rem, 5vw, 3.75rem), `--text-h2` clamp(1.75rem, 3.5vw,
2.75rem)), with a spacing scale `--space-1…10`, page width `--page-max` 1180px and line length
`--measure` 62ch. Shared pieces: `.card` (the one card: white, thin warm border, soft shadow),
`.chip` (pill toggle; `aria-pressed` shows the choice), `.eyebrow`, `.tone-muted` (second clause of
a two-tone headline). The header is a floating, sticky pill on every page.

WCAG contrast (computed): espresso on page 15.8:1, on band 14.5:1, on the glow's strongest point
14.6:1; muted 6.3:1 (band 5.8, glow 5.8); accent text 5.5:1 on the page, 5.0:1 on the band and
glow, ≥ 4.57:1 on text tints; espresso on terracotta fill 5.2:1; status text on status
backgrounds 5.4–6.2:1, and Matched/Needs confirmation/Conflict text on the band 5.7/6.3/6.5:1;
icons on tiles ≥ 12.5:1; input borders 4.1:1 (band 3.8). A rendered-page audit (every visible
text node against its composited background, OS set to dark) found no pair under AA on `/`,
`/profile`, `/results` or `/results/print`. Focus ring 3px, offset 3px, 8.1:1 against the page.
Tap targets ≥ 44px. `aria-live="polite"` for progress and announcements; reduced motion stops
the spinner. Error summary takes focus and links to fields; inline errors use `aria-invalid`.

## Landing page (Phase 10)

`src/app/page.tsx` composes `src/app/_landing/`, left-aligned and editorial: Hero (HTML result
card) → Problem (numbered 01–04 + photo) → Rerank (`#qloo`) → SafetyCheck (sieve) → HowItWorks
(`#how`, three numbered steps with line drawings) → QlooProof (metric cards) → Rules (`#rules`) →
Closing band (dimmed photo). The page sets `data-layout="wide"`: `:has()` rules make `<main>` full
width (each section keeps to 1180px; the closing band spans the page without `100vw`) and swap the
nav to "How it works · Why Qloo · Our rules" and a "Find food ↗" pill (phones: the pill and a
`<details>` menu, `NavMenu.tsx`); every other page keeps the single Profile link.

- **Hero card** (`HeroCard.tsx`): HTML, from `heroSnapshot.json`, one real result (Lenny's Clam Bar)
  of the live Sinatra-example search on 2026-10-27, laid out with the results page's own helpers.
- **Watch Qloo re-rank** (`Rerank.tsx`): chips for Plain search, Frank Sinatra, Bob Marley and Fela
  Kuti. Lists are `rerankSnapshot.json`, built by `scripts/landing-rerank.ts` from stored Qloo
  responses: one request (Italian genre tag, New York City, take 20), only the signal differs
  (Sinatra and Fela from the Phase 1 probe, 2026-10-26; Bob Marley and a repeat of the plain search
  live on 2026-10-28, 2 Qloo calls; the repeat matched the stored top 10 exactly), filtered by the
  app's venue filter. Rows glide with FLIP (`useFlip.ts`, Web Animations; none with reduced
  motion); "New"/"↑n"/"↓n" and the sentence come from `rankMovement`/`evidenceSentence`; an
  `aria-live` line announces it. Top 6 shown; counts compare the full top 10s.
- **The safety check** (`Sieve.tsx`, data `sieveData.ts`): at build time the app's Phase 2 code
  (`normalizePlaces` → `rankCandidates` → `buildExplanationFacts`) runs on the committed sample
  `E5h-west-african-signal-fela.json` with the "Nigerian food in Brooklyn" example profile. Brooklyn
  Suya (selected first), Buka and Accra Express are shown: dishes as Qloo lists them, then sorted into "Dishes to
  ask about" and "Set aside" with the engine's reason. Server render, no JS and reduced motion show
  the sorted state; with motion it sorts once when scrolled into view and on each tap.
- **Our rules** (`Rules.tsx`): seven statements, each with the test that backs it in a comment.
  Called "Our rules" (`#rules`), not "Guarantees": the UI-copy test bans "guarantee(s)" outside a
  negation, and a guarantee next to allergies reads as a safety promise.
- **Qloo proof** (`proofStats.ts`): each figure carries the doc and the exact quote it comes from;
  `tests/landing.test.ts` fails if a quote disappears from its doc. The same file checks the
  re-rank snapshot, the sieve output and the hero snapshot.
- `FadeUp` uses IntersectionObserver and only hides a section once armed by script, so content
  shows without JS and with reduced motion.

- **Logo:** `ChefMark` (`src/components/ChefMark.tsx`), an original flat chef (puffed hat, round
  smiling face), decorative next to the "Tastora" wordmark. The favicon `src/app/icon.svg` and the
  share card use the same shapes.
- **Photos:** `Photo.tsx` and `Closing.tsx` serve two Pexels photos (Pexels License) through
  `next/image` with blur placeholders and `sizes`: 11368637 by Anna Shvets (`family-dinner.jpg`)
  and 31705508 by Juan TM (`shared-plates.jpg`, 2000px), both downloaded 2026-10-28. Credited
  under each photo, in the footer and in the README, worded so it doesn't imply the people use
  Tastora. (Phase 11 removed the photo beside "Our rules": two food photos in a row.)

## Mobile polish (Phase 11)

- Nav at ≤ 760px: a solid 56px bar across the top (no translucency, no floating gap), a smaller
  "Find food" pill (44px target); anchors use `scroll-padding-top: 4.5rem`. Desktop keeps the
  floating pill. No hide-on-scroll (optional in the brief; left out to keep the bar predictable).
- Landing on phones: 64px between sections (56px ≤ 480px); the hero's muted second line is
  large-body size (`--text-lead`, weight 500). Re-rank has a two-line intro and no sentence for
  the plain search (the intro already says what the list is). The safety check opens on Brooklyn
  Suya (most dishes set aside, with the warning); "Run it again" is now "Replay".
- Searching screen: each real trace step in plain words (`plainStep()` in `src/lib/ui/format.ts`:
  "Planning the search", "Looked up the Nigerian cuisine", "Looked up a taste memory: Davido
  (artist)", "Searching Nigerian restaurants near Lagos with 2 taste signals", "Checking every place
  against their needs"), the raw steps under a collapsed "Technical details". Progress copy says "AI
  agent"/"AI planner".
- Results: one sticky layer only (the nav). The "can't verify ingredients" notice is shown once at
  the top, not sticky. On phones the shortlist bar is one slim row (~56px: count, Share, Print)
  and the page leaves 5.5rem at the bottom so the last card clears it.
- Card needs, compact (`compactNeeds()` in `src/lib/ui/status.ts`): one line per Matched need
  ("✓ Matched · Diet: Halal (venue tag)") and per Conflict (red, with "Qloo's tags contradict this
  need"; no longer repeated in the red warning box), and one line for everything to confirm ("?
  To confirm: shellfish, sesame and soy allergies · dairy-free · easy to chew · quiet place").
  Grouped by `displayStatus`, so allergies and texture can only land in "To confirm". Icon + text on
  every line. "Show details" keeps the full per-need list with evidence.
- "Add to shortlist" / "On your shortlist" is a small secondary toggle (44px, `aria-pressed`;
  pressed = soft terracotta with a check), no longer a solid orange button.
## App pages (Phase 10 part 2)

- `/profile`, `/results`, `/results/print` and the search progress use the Phase 10 tokens: Manrope,
  smaller balanced sizes, the one card (`--radius-lg`, thin border, soft shadow), mono for the
  card's cuisine/price/rating line and "possibly soft" notes, and eyebrows above the page headings.
- Result card order: rank + name → area → cuisines/price/rating → one-line why (peach panel, no
  serif) → warnings → needs → dishes → questions → shortlist and contact actions → details → feedback.
- The "can't verify ingredients" notice sits at the top of the results (sticky until Phase 11),
  and cards scroll to below the nav (`scroll-margin-top: 6rem`, 4.5rem on phones).
- **Evidence panel** reuses the landing re-rank list (`src/components/RerankList.tsx`, `useFlip`)
  with this search's own `evidence`: chips switch between "With <signals>" and "Without taste
  signals", rows glide, "New"/"↑n"/"↓n" come from `rankMovement`, and places that left the top 10
  are listed underneath. No other data is used.
- **Console:** on the live site (Phase 9b build) the only console error was "MetaMask encountered
  an error setting the global Ethereum provider" from the MetaMask browser extension's `inpage.js`
  (`chrome-extension://…`), not from Tastora; with it filtered out, `/`, `/profile`, `/results`
  (with results) and `/results/print` log no errors or warnings of ours.
- Checked at 375, 768, 1024 and 1440px (same-origin iframe, real stored results): no horizontal
  scroll, no text under AA contrast, no tap target under 44px, on every page.
## Show the product (Phase 12)

- **Place images (Part 0).** Qloo's raw place responses carry `properties.image.url` (and
  `images[]`, type `urn:image:place:unknown`) on 225 of 235 unique places in `fixtures/qloo/raw/`
  (96%), all on `images.qloo.com`; the committed `samples/` are slimmed and drop them. A card shows
  Qloo's image only when the response has one for that place (`qlooImageUrl()` accepts https on
  `images.qloo.com` only), with alt text and an "Image: Qloo" credit. Otherwise, or if it fails to
  load, `CuisineArt` draws an original flat plate (Italian, West African, Caribbean, Chinese, Indian,
  Mexican, Japanese, Korean, Middle Eastern, or a plain plate) picked by `cuisineArtFor()` from the
  venue's own cuisine tags; decorative (`aria-hidden`). No stock food photos on restaurant cards.
- **Hero preview** (`HeroPreview.tsx`): a CSS-drawn phone cycling three states built in HTML from
  stored data: "Their tastes" (the Sinatra example profile), "Qloo's match" (Qloo's top 4 without →
  with the Frank Sinatra signal, from the live Phase 3 run in `docs/phase3-smoke.md`, Profile B;
  `tests/landing.test.ts` checks the lists against that table), and "The check" (the Lenny's Clam Bar
  result with Qloo's image of the place). Advances every 3.5s; pauses on hover, focus, off-screen,
  with the Pause button, or once a step is tapped. Reduced motion shows "The check", still.
- **Safety zones** (`SafetyZones.tsx`): Matched = thin solid green row, ✓, "venue tag" chip; To
  confirm = dashed amber box, ?, grouped items with allergies first (`needZones()`); Conflict = heavy
  solid red row, ⛔, reason; then "Ask the restaurant" as a numbered call script with the Call button
  attached. Print keeps the shapes in black and white.
