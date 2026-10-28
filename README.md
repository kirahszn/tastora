# Tastora

> Good food should still feel like home.

Tastora helps caregivers find restaurants near an older person they care for that the person will
actually enjoy. It is best tested in New York City, and Qloo's coverage was checked in six other
cities (see [Where it works](#where-it-works)). You describe the person's own tastes: favourite cuisines and dishes, plus the music,
films and places that feel familiar to them. You also list what they must avoid. A Claude agent
plans searches against **Qloo's taste intelligence**, and Tastora's own tested code checks every
result against the person's needs. Each suggestion says why it was picked and what to confirm with
the restaurant. Tastora never presents an allergy as safe. Built for the Qloo Agentic Hackathon
2026.

**Live demo: <https://tastora-three.vercel.app>**

The landing page has two live demos built from real data: **Watch Qloo re-rank** (tap Frank
Sinatra, Bob Marley or Fela Kuti and Qloo's real top 10 for the same Italian search in New York City
re-orders; lists in [`src/app/_landing/rerankSnapshot.json`](src/app/_landing/rerankSnapshot.json),
built by [`scripts/landing-rerank.ts`](scripts/landing-rerank.ts)) and **The safety check** (Tastora's
own Phase 2 checks run at build time on a committed Qloo sample for a peanut allergy, setting dishes
aside with the real reason; [`src/app/_landing/sieveData.ts`](src/app/_landing/sieveData.ts)).

**Try it in 30 seconds:** open the site → **Try an example** → **Italian-American in Queens** (the
Frank Sinatra profile) → **Find restaurants**. Results stream in within a few seconds. Scroll to
**How Qloo shaped these results** to compare Qloo's ranking with and without the person's taste
signals.

![Landing page at 1440px: two-tone headline "Good food should still feel like home." beside a real result card for Lenny's Clam Bar](docs/screenshots/landing-1440.jpg)

| Watch Qloo re-rank | The safety check |
|---|---|
| ![Frank Sinatra chosen: Qloo's top 6 Italian restaurants in New York City, all marked New, with "Frank Sinatra brought in 10 new places and moved all 10."](docs/screenshots/landing-rerank.jpg) | ![Buka's dishes for a peanut allergy: 11 to ask about, Suya set aside as "commonly made with peanut; recipe not verified"](docs/screenshots/landing-safety-check.jpg) |

| Phone (375px) | Tablet (768px) | Results (375px) |
|---|---|---|
| ![Landing page at 375px](docs/screenshots/landing-375.jpg) | ![Landing page at 768px](docs/screenshots/landing-768.jpg) | ![Results page at 375px with the shortlist bar](docs/screenshots/results-375.jpg) |

Full page: [1440px](docs/screenshots/landing-1440-full.jpg) · [768px](docs/screenshots/landing-768-full.jpg) · [375px](docs/screenshots/landing-375-full.jpg).
## The problem

Choosing a restaurant for someone else is hard when what matters is their taste, not yours. A
caregiver might know that their dad grew up on red-sauce Italian and Sinatra, or that their mum
misses home cooking from Lagos. General search tools rank places by popularity and distance, not by
the person. Allergies and dietary needs are a second problem. Restaurant listings rarely include
ingredient or allergen information, so a tool that sounds confident about safety is guessing.

Tastora starts from the person's own tastes, with no age field and no assumptions about what older
people eat. It keeps preferences ("what they love") separate from hard constraints ("what they
must avoid"), and it is explicit about what it cannot verify.

## What Tastora does

1. **Profile.** Enter favourite cuisines and a city (the only required fields), with an optional
   neighbourhood or area. You can also add favourite dishes, dislikes, taste memories (music, films,
   places), allergies, dietary restrictions, texture needs and comfort needs (quiet, wheelchair
   access). Three example profiles are available (Queens, Brooklyn, London).
2. **Search.** The search runs live: each real step (Claude's tool calls, Qloo lookups, ranking) is
   streamed to the screen as it happens.
3. **Results.** You get up to 8 restaurants. Each card leads with one plain reason (for example
   "One of Qloo's top 5 matches for people who love Frank Sinatra"), then a status for each of the
   person's needs, dishes to ask about, questions to ask the restaurant ("Which dishes are made
   without pork?"), and shortlist, website, phone and Maps buttons. "Show details" lists every
   reason with its source, dishes set aside for the person's needs (with the reason), Qloo's exact
   rank and the score breakdown.
4. **Evidence.** The "How Qloo shaped these results" panel opens with one sentence computed from
   the comparison ("Frank Sinatra brought in 6 new places and moved all 10.") and shows Qloo's top
   10 with and without the person's taste signals.
5. **Feedback.** Mark places Like, Not for them, Not suitable or Already tried, then search
   again. The ranking takes the feedback into account, and "Not suitable" places are not shown
   again.
6. **Share and print.** See below.

### Share and print

Caregivers rarely decide alone, and the restaurant still has to be asked about allergies and
texture. The top 3 places start on a shortlist; "Add to shortlist" on any card changes it.

- **Share** builds plain text on the device (no emoji, at most about 1,500 characters): for each
  place its area, one reason, a "Good signs" line for comfort or diet needs a venue tag supports
  (never allergies or texture), up to 3 dishes to ask about, up to 3 questions to ask, phone and a
  Google Maps link, then "Tastora can't confirm ingredients or allergens. Please check with the
  restaurant." Send it with the phone's share sheet, copy it, or open it in WhatsApp
  (`https://wa.me/?text=…`). Scores and set-aside dishes are never included.
- **Print checklist** (`/results/print`) is a "Before you go — questions to ask" sheet: address,
  phone in large type, dishes to ask about, warnings, and every question with a ☐ box and a line
  for notes. "Print or save as PDF"; paper is always black on white, one place per block.

| Shortlist and share text | Print checklist (print styles) |
|---|---|
| ![Share panel with the shortlist text](docs/screenshots/share-panel.jpg) | ![Printed questions checklist](docs/screenshots/print-page.jpg) |

| Profile: where | Profile: must avoid |
|---|---|
| ![Where section of the profile: City field with quick picks, optional neighbourhood](docs/screenshots/profile-where.jpg) | ![Must avoid section of the profile form](docs/screenshots/profile-must-avoid.jpg) |

| Result card | Mobile (375 px) |
|---|---|
| ![Result card for Lenny's Clam Bar](docs/screenshots/results-card.jpg) | ![Result card on a phone-width screen](docs/screenshots/mobile-card.jpg) |

![How Qloo shaped these results: "Frank Sinatra brought in 6 new places and moved all 10."](docs/screenshots/evidence-panel.jpg)

Screenshots were taken on 2026-10-28 from the stored Sinatra-example response of 2026-10-27 (no new
search). All of them are in [`docs/screenshots/`](docs/screenshots/).

## How Qloo powers it

Qloo is the restaurant source and the taste engine. Tastora uses three Qloo endpoints. Details are
in [`docs/agent.md`](docs/agent.md) and [`docs/qloo-findings.md`](docs/qloo-findings.md).

| Purpose | Qloo call |
|---|---|
| Turn "Nigerian" or "Italian-American" into cuisine tags | `GET /v2/tags` (`filter.query`). Tastora keeps `urn:tag:cuisine:qloo:*` and `urn:tag:genre:place:restaurant:*` tags |
| Turn taste memories into Qloo entities ("Frank Sinatra" → artist) | `GET /search` (`query`). Artists, films, TV shows, books and places |
| Find and rank restaurants | `GET /v2/insights` with `filter.type=urn:entity:place`, `filter.location.query` (the area and city), `filter.tags` (cuisine) and `signal.interests.entities` / `signal.interests.tags` (the taste signals) |

**Cross-domain taste memories.** A favourite singer or film becomes a Qloo entity, and Qloo
re-ranks restaurants by affinity with it. Tastora's Phase 1 tests found that the effect is real and
fits the culture involved. Within Italian restaurants, a Frank Sinatra signal brought up classic
red-sauce places (Chazz Palminteri, Original Vincent's) in place of Eataly and Marea. A Bob Marley
signal moved a general restaurant search toward Caribbean places. With no signals, the baseline
ranking is fully deterministic, so the differences are not noise.

**Evidence panel.** For every search, Tastora runs the main Qloo query again without taste
signals and shows both top-10 lists. It reports how many places appear in both, how many are new
and how many moved. Results from Tastora's test searches in New York City, October 2026
([`docs/phase5-profile-matrix.md`](docs/phase5-profile-matrix.md),
[`docs/phase3-smoke.md`](docs/phase3-smoke.md)):

| Profile | Taste signal | Same places in top 10 | Moved |
|---|---|---|---|
| Italian-American, Queens | Frank Sinatra | 4 of 10 | 10 |
| Caribbean, Bronx | Bob Marley | 0 of 10 | 10 |
| Jewish deli, Manhattan | Barbra Streisand | 6 of 10 | 9 |
| Indian, Jackson Heights | Lata Mangeshkar | 5 of 10 | 10 |
| Nigerian, Brooklyn | Fela Kuti | 10 of 10 | 7 |

The strength of the signal varies. Bob Marley replaced the whole Caribbean top 10, while Fela Kuti
only re-ordered NYC's roughly 10 Nigerian places. Where Qloo finds no entity for a memory (for
example Teresa Teng), Tastora says so under "About this search" instead of implying the memory was
used.

Qloo data is also used for venue facts: address, borough or city (from geocode), hours, phone,
website, Google Place ID, dish highlights, and venue tags for accessibility, noise and diet options.

### Where it works

Tastora was built and tested in New York City. In Phase 9c, Qloo's restaurant coverage was checked in
six more cities with 23 live calls: Italian, one local cuisine, and Italian with a Frank Sinatra
signal ([details](docs/qloo-findings.md#coverage-beyond-nyc-phase-9c-2026-10-28)).

| City | Verdict | Places kept per search (of 20) | In the city or its metro |
|---|---|---|---|
| New York City | Good (main test city) | 18–20 (Phase 1, before the venue filter) | most; a few NJ/Nassau places, labelled |
| London | Good | 18–20 | 58/58 |
| Toronto | Good | 19–20 | 56/59 |
| Los Angeles | Good | 18–20 | 56/57 |
| Chicago | Good | 16–20 | 55/56 |
| Sydney | Good | 17–20 | 56/56 |
| Lagos | Thin | 6–13 | 27/27 |

The Sinatra signal reordered the Italian top 10 in every city. In Lagos it could only reshuffle the
same handful of places, and 7 of 20 Nigerian results there were not restaurants (supermarkets, bars).
Other cities may work, but they are untested. When a search finds fewer than 4 places, or the city is
rated Thin, the results page says: "Fewer matches found around <city>. Qloo's restaurant coverage
varies by city." If Qloo can't find the city at all, Tastora asks for the nearest larger city.

## How the agent works

```mermaid
flowchart TD
    P["Caregiver profile"] --> S{"Split on the server"}
    S -- "cuisines, dishes, dislikes, taste memories" --> C["Claude planner<br/>(claude-sonnet-5-5)"]
    S -- "allergies, diet, texture, comfort" --> E
    S -- "location" --> T
    C -- "tool calls" --> T["SearchSession<br/>limits: 10 tool calls, 6 turns, 3 searches, 30 s<br/>ID check: only IDs Qloo returned this run<br/>location injected by the server"]
    T --> F1["find_cuisine_tags → Qloo /v2/tags"]
    T --> F2["find_taste_entities → Qloo /search"]
    T --> F3["search_restaurants → Qloo /v2/insights"]
    F1 & F2 & F3 -- "results" --> C
    F3 --> V["Venue filter<br/>drops hotels, bars without a cuisine, food courts…"]
    V --> E["Constraint engine (Phase 2)<br/>Matched / Needs confirmation / Conflict"]
    E --> R["Ranking<br/>Qloo taste rank + favourites + comfort + borough/city + feedback"]
    R --> X["Explanation facts<br/>reasons, dishes to ask about, removed dishes, questions"]
    F3 -. "same search without signals" .-> B["Evidence panel"]
    X --> U["Results UI (streamed)"]
    B --> U
    K["Fallback planner<br/>(if Claude is unavailable)"] -.-> T
```

**The agent decides how to search. Tastora's tested code decides what is safe.**

- Claude gets three tools: `find_cuisine_tags`, `find_taste_entities` and `search_restaurants`. It
  picks the tags, resolves taste memories (in the matrix, it corrected "Nigeran" and "Fela Kutti"),
  and chooses which signals to send.
- Hard limits are enforced in code: 10 tool calls, 6 model turns, 3 restaurant searches and a
  30-second planning budget. Every ID passed to `search_restaurants` must have come from an
  earlier tool result in the same run. An invented ID returns an error to the model, and no Qloo
  call is made. `search_restaurants` has no location field: the server injects the profile's
  location.
- Claude can't add candidates, set statuses, or write the text on a card. Candidates come only
  from Qloo search results. Statuses, exclusions, ranking and explanation facts come from
  deterministic code ([`docs/ranking-and-constraints.md`](docs/ranking-and-constraints.md)).
- **Fallback planner.** If Claude is unavailable (no key, API error, timeout, refusal, or no
  successful search), a deterministic planner runs through the same session and limits. Results
  are checked the same way, and the page says the fallback was used.
- If every search returns nothing, Tastora tries the cuisine's family once (Haitian → Caribbean)
  through the same session and tells the caregiver.

## Safety and honesty model

Qloo has no ingredient, per-dish allergen or texture data. Tastora is built around that limit
instead of hiding it.

- **Three statuses**, each shown with an icon and a text label, not colour alone: **Matched**
  (an explicit Qloo tag supports it), **Needs confirmation** (no data, or data that can't prove it)
  and **Conflict** (an explicit Qloo tag contradicts it, e.g. "Loud" for a quiet preference).
- **Allergies and texture are never "Matched".** The engine always returns Needs confirmation for
  them, and the UI maps any such match to Needs confirmation as a second guard. Diet tags (kosher,
  vegetarian…) are labelled venue-level, to confirm.
- **Dish screening.** Dishes that name an allergen are removed, with tolerance for plurals and
  synonyms (shellfish → shrimp, crab, conch…). Tastora also keeps lists of dishes commonly made
  with an allergen whose names don't say so: suya and satay for peanut; bibimbap and japchae for
  sesame; gulab jamun, korma and tiramisu for milk. These are set aside with "commonly made with
  peanut; recipe not verified".
- **Allergen-heavy penalty.** If at least half of a venue's listed dishes were removed for one
  allergen, it drops 8 points (15 if all of them were) and carries a warning. Example: Brooklyn
  Suya for a peanut allergy.
- Only two things remove a venue entirely: Qloo marks it closed, or wheelchair access is required
  and a tag explicitly contradicts it. Everything else is flagged, not hidden.
- **No ordering language.** Dishes are "dishes to ask about", never a menu.
  [`tests/ui-helpers.test.ts`](tests/ui-helpers.test.ts) scans all UI source for
  order/buy/checkout/purchase/cart. It also scans for "safe", "allergen-free" and "guaranteed",
  including in server strings that reach the screen, unless the word is negated.
- A banner that stays at the top of the results says: "Tastora can't verify ingredients or allergens. Always
  confirm with the restaurant."

## Privacy

| Where | What |
|---|---|
| **Qloo** | Cuisine and taste-memory search text (e.g. "Italian-American", "Frank Sinatra"), the Qloo tag and entity IDs chosen, and the location text (e.g. "Queens", "London"). |
| **Anthropic (Claude)** | Only favourite cuisines, favourite dishes, dislikes and taste memories, plus the Qloo tool results (tag and entity names, top restaurant names). A test checks every request body. |
| **Never sent to Qloo or Claude** | Allergies, dietary restrictions, texture, comfort needs and the display name. The display name ("Dad") is not sent to the server at all; it only appears in share text you choose to send. |
| **On the device** | The profile and feedback in `localStorage`, and the last search and shortlist in `sessionStorage` (so reloading doesn't run a new search). Clearing the profile clears all of them. Share text and the print checklist are built in the browser. |
| **On the server** | No database and no accounts. An in-memory cache of Qloo responses (10 minutes) and in-memory rate-limit counters, per server instance. A failed search logs only the error's class name. |

API keys are read server-side only and are never sent to the browser.

## Tech stack

- **Next.js 16** (App Router, route handlers, streaming NDJSON), **React 19**, **TypeScript**
- **Qloo Insights API**: `/v2/tags`, `/search`, `/v2/insights`
- **Claude** via `@anthropic-ai/sdk` (tool use; default model `claude-sonnet-5-5`)
- **Zod** for profile, feedback and storage validation
- **Vitest** (289 tests), ESLint
- CSS modules, no UI library. WCAG contrast checked, 44 px tap targets, one warm light theme.
- Hosted on **Vercel**

## Project structure

```
src/
  app/                  pages (/, /profile, /results), API routes (/api/recommend, /api/health), OG image
  components/           form inputs, status badge, icons
  lib/
    agent/              Claude planner, fallback planner, SearchSession, recommend(), notices, explanation facts
    qloo/               Qloo client, search layer, cache, non-restaurant filter
    constraints/        allergy / diet / texture / comfort evaluation, keyword lists
    ranking/            scoring and feedback
    domain/             profile schema, Qloo place → candidate mapping, boroughs, city/area + coverage, related cuisines
    ui/                 client helpers: streaming, storage, status display, rank movement
tests/                  Vitest suites (unit, route, agent with fake Claude/Qloo)
fixtures/qloo/samples/  trimmed real Qloo responses used by tests
scripts/                live probes: Qloo spike, smoke test, profile matrix
docs/                   design notes and live-run findings
```

## Run it locally

Requires Node.js 20 or newer.

```bash
git clone https://github.com/kirahszn/tastora.git
cd tastora
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open <http://localhost:3000>. `QLOO_API_KEY` and `QLOO_API_BASE_URL` are needed for searches.
`ANTHROPIC_API_KEY` is optional: without it, the built-in planner is used. `ANTHROPIC_MODEL`
defaults to `claude-sonnet-5-5`. The app builds and the tests run with no keys at all.

| Script | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Run the Vitest suite once (no network, no keys) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run smoke:recommend` | Live end-to-end run for two profiles (uses API credit) |
| `npm run matrix` | Live 10-profile matrix (uses API credit, budget-capped) |
| `npm run qloo:probe` | Phase 1 Qloo API spike (uses API credit) |
| `npm run qloo:coverage` | Phase 9c coverage check for six cities (uses API credit, 24-call cap) |

**Tests:** `npm test` runs 289 tests in 19 files. They cover the constraint engine, ranking, the
Qloo client and search layer (recorded responses), the agent (fake Claude and Qloo: limits,
invented IDs, fallback, data minimisation), the API route (validation, streaming, rate limit), UI
helpers (banned words, storage, status display) and locations beyond NYC (profile migration, the
same-city rule on live samples, coverage note, phone format). One test reads a gitignored raw Qloo
response and is skipped in a fresh clone (288 pass, 1 skipped).

## Known limitations

- **Location is a bias, not a boundary.** Qloo's `filter.location.query` favours the area but can
  return places elsewhere. In New York, Tastora ranks the chosen borough higher (+6) and labels places
  outside NYC. Elsewhere, places whose Qloo city or metro is the chosen city rank higher (+6) and are
  labelled "In London" / "In the Sydney area"; others are labelled "Nearby: <city>". Nothing is
  filtered out.
- **Best tested in New York City.** Coverage was checked in six other cities, once each with two
  cuisines (see [Where it works](#where-it-works)); Lagos is thin, and other cities are untested.
  Dietary and accessibility tag coverage was only measured in NYC.
- **No menu, ingredient or allergen data.** Dishes come from Qloo's highlights and can be partial
  or garbled. Allergy safety can never be confirmed; the caregiver has to ask the restaurant.
- **Texture can't be verified.** Soft-sounding dishes are only marked "possibly soft — confirm".
- **Taste-signal strength varies.** Some memories reorder results strongly, some only slightly,
  and some (e.g. Teresa Teng) have no Qloo match. Some venue cuisine tags are odd.
- **Rate limit is in-memory.** 10 searches per minute per IP, per server instance. It protects API
  credit but is not a global quota.
- Searches take about 4–12 s (matrix and live runs), mostly in Qloo calls with taste signals and in
  Claude turns. Progress is streamed so the wait is visible.

## What's next

- Join menu-level data through the Google Place ID that Qloo returns for every venue, so dish and
  ingredient checks can use real menus where they exist.
- An optional strict borough filter alongside the current ranking boost.
- A shared rate limit and cache for multi-instance deployments.
- Coverage checks for more cities and cuisines, and dietary/accessibility tag coverage outside NYC.

## Licence

[MIT](LICENSE).

## Acknowledgements

- [Qloo](https://www.qloo.com/) for the Taste AI API and for running the hackathon.
- [Anthropic](https://www.anthropic.com/) for Claude, which plans the searches.

## Credits

- Landing page photos, all used under the [Pexels License](https://www.pexels.com/license/) (free
  to use; attribution appreciated, not required). The people in them are not Tastora users and do
  not endorse it:
  [Anna Shvets](https://www.pexels.com/photo/a-family-eating-dinner-together-11368637/) (family dinner),
  [Nothing Ahead](https://www.pexels.com/photo/choice-of-food-during-family-dinner-20089303/) (hands sharing dishes),
  [Juan TM](https://www.pexels.com/photo/engaging-dinner-gathering-with-shared-plates-31705508/) (shared plates, closing band).
- Body type: [Manrope](https://fonts.google.com/specimen/Manrope) (SIL Open Font License),
  self-hosted at build time by `next/font`.
- Logo, favicon and icons are original to this project.
