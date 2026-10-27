# Devpost submission draft

Fields in Devpost's order, ready to paste. Every figure is from `docs/` (live runs) or the test suite.

---

## Project name

Tastora

## Tagline

Restaurant ideas for someone you care for, based on their own tastes. Powered by Qloo, planned by a Claude agent, and clear about what it can't verify.

## Inspiration

The hackathon brief named senior dining as a use case. Picking a restaurant for someone else, such
as an older parent or relative, runs into two gaps in general-purpose tools. They rank by
popularity and distance, not by the person's tastes. And when allergies or dietary needs come up,
they either say nothing or guess, because restaurants rarely publish ingredient or allergen
information.

We wanted recommendations that start from who the person is (the food they grew up with, the music
and films they love) and that are honest about what can't be verified.

## What it does

A caregiver describes the person: favourite cuisines and dishes, taste memories (music, films,
places), and what they must avoid (allergies, diet, texture, quiet, wheelchair access). There is
no age field and no assumption about what older people eat.

Tastora finds New York City restaurants and explains each one: why it was suggested, a Matched /
Needs confirmation / Conflict status for every need, dishes to ask about, dishes set aside and why,
and questions to ask the restaurant. Allergies and texture are never shown as matched. An evidence
panel compares Qloo's ranking with and without the person's taste signals. Feedback shapes the
next search.

## How we built it

- **Next.js 16 + React 19 + TypeScript** on Vercel. The search streams each real step to the
  screen as NDJSON.
- **A Claude agent (claude-sonnet-5-5)** plans the searches with three tools: `find_cuisine_tags`,
  `find_taste_entities` and `search_restaurants`. Code enforces hard limits (10 tool calls, 6
  turns, 3 searches, 30 s). Every ID Claude passes must have come from an earlier Qloo result in
  the same run. Claude sees only cuisines, dishes, dislikes and taste memories; allergies, diet
  and location stay on the server. If Claude is unavailable, a deterministic planner takes over.
- **Qloo** calls: `/v2/tags` (cuisine tags), `/search` (taste memories → entities), `/v2/insights`
  (places filtered by location and cuisine, ranked by taste signals).
- **A deterministic constraint engine and ranker** (Zod-validated, 209 Vitest tests) decide
  statuses, exclusions, ranking and every fact on a card. The rule: **the agent decides how to
  search; tested code decides what is safe.**

## What makes it Qloo-powered

Qloo is both the restaurant source and the taste engine. Without it, Tastora has no restaurants to
suggest and no way to connect "loves Frank Sinatra" to a specific Italian restaurant.

- **Cross-domain signals.** A taste memory becomes a Qloo entity and re-ranks restaurants. Within
  Italian restaurants, a Sinatra signal brought up classic red-sauce places instead of Eataly and
  Marea. A Bob Marley signal moved a general restaurant search toward Caribbean places.
- **Measured, not claimed.** Every search runs again without signals, and the app shows both top-10
  lists. Live results: Sinatra (Italian-American, Queens), 4 of 10 places shared and 10 moved; Bob
  Marley (Caribbean, Bronx), 0 of 10 shared; Barbra Streisand (Jewish deli), 6 of 10; Fela Kuti
  (Nigerian, Brooklyn), 10 of 10 shared but 7 re-ordered, since NYC has only about 10 Nigerian
  places. The baseline is deterministic, so these differences are real.
- **Venue facts** from Qloo (accessibility, noise and diet tags, dish highlights, hours, Google
  Place ID) drive the Matched and Conflict statuses, such as a "Loud" tag conflicting with a quiet
  preference.

## Challenges we ran into

- **Two Qloo entity shapes.** `/v2/insights` and `/search` return places with different fields,
  and errors come in two shapes. One tolerant parser, tested on recorded responses, handles both.
- **Tag families.** In NYC, the Nigerian *genre* tag returned 0 places while the *cuisine* tag
  returned 18. The search layer now retries with the cuisine family.
- **A cuisine filter isn't a restaurant filter.** Italian results included a grocery, a hotel and a
  tourist attraction; Korean briefly ranked a food court first. We built a venue filter from 213
  real places.
- **Location is a bias.** A Queens search returned Manhattan and Nassau places too, so Tastora
  ranks the chosen borough higher and labels places outside NYC.
- **No allergen data.** Qloo has dish names but no ingredients. We built dish-name lists (suya →
  peanut, bibimbap → sesame, korma → milk) and a penalty for allergen-heavy venues, and we never
  call anything safe.
- **Latency.** Insights calls with taste signals took up to 7.7 s, so we stream real progress
  instead of showing a spinner.

## Accomplishments that we're proud of

- A 10-profile live matrix across ten cuisines: every profile returned results, Claude corrected
  misspellings ("Nigeran", "Fela Kutti") and it didn't use a weak match for an unknown band.
- Safety rules enforced by tests, including a scan that fails `npm test` if UI text contains
  ordering language or an unqualified "safe" claim.
- An evidence panel that shows Qloo's contribution instead of asserting it.

## What we learned

Taste signals work best as a re-ranker inside a cuisine and location filter; without one, a Fela
Kuti signal drifted toward live-music venues. Signal strength varies, and some artists aren't in
Qloo, so the app says when a memory wasn't used. For most allergy questions the honest answer is
"ask the restaurant", so the app's job is to make that easy. We also tested a cross-domain food
"taste portrait" against Qloo, found no food-relevant tags for these signals, and chose not to ship
a feature that would have required guessing.

## What's next

Join menu-level data through the Google Place ID Qloo returns for every venue, add an optional
strict borough filter, move the rate limit and cache to shared storage, and expand beyond NYC once
Qloo coverage is checked.

## Built with

Qloo Insights API · Claude (Anthropic API, tool use) · Next.js · React · TypeScript · Zod · Vitest ·
Vercel · Node.js

## Try it out

- Live demo: https://tastora-three.vercel.app
- Source (MIT): https://github.com/kirahszn/tastora
