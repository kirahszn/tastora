# Devpost submission draft

Fields in Devpost's order, ready to paste. Every figure is from `docs/` (live runs) or the test suite.

---

## Project name

Tastora

## Tagline

Restaurant ideas for someone you care for, based on their own tastes. Powered by Qloo, planned by a Claude agent, and clear about what it can't verify.

## Inspiration

The brief named senior dining as a use case. Picking a restaurant for an older parent hits two
gaps: general tools rank by popularity and distance, not the person's tastes, and they guess about
allergies because restaurants rarely publish ingredients. We wanted recommendations that start from who the
person is (the food they grew up with, the music and films they love) and that are honest about what
can't be verified.

## What it does

A caregiver describes the person: favourite cuisines and dishes, taste memories (music, films,
places), and what they must avoid (allergies, diet, texture, quiet, wheelchair access). There is no
age field and no assumption about what older people eat.

Tastora finds restaurants near the person and explains each one: a plain reason ("One of Qloo's top
5 matches for people who love Frank Sinatra"), a Matched / Needs confirmation / Conflict status for
every need, dishes to ask about, dishes set aside and why, and questions for the restaurant ("Which
dishes are made without pork?"). Allergies and texture are never shown as matched. An evidence panel
compares Qloo's ranking with and without the taste signals and sums it up in one sentence ("Frank
Sinatra brought in 6 new places and moved all 10."). Feedback shapes the next search. A shortlist
can be shared with family as plain text (share sheet, WhatsApp or copy) or printed as a "questions
to ask" checklist.

It is best tested in New York City. Live checks in 6 more cities rated London, Toronto, Los Angeles,
Chicago and Sydney Good (16–20 restaurants per search, almost all in the city or its metro) and
Lagos Thin (6–13). Places in the chosen city rank a little higher and are labelled ("In London",
"Nearby: Markham"); when coverage is thin, the page says so.

## How we built it

- **Next.js 16 + React 19 + TypeScript** on Vercel, streaming each real search step as NDJSON.
- **A Claude agent (claude-sonnet-5-5)** plans searches with three tools: `find_cuisine_tags`,
  `find_taste_entities` and `search_restaurants`. Code enforces hard limits (10 tool calls, 6 turns,
  3 searches, 30 s), and every ID Claude passes must have come from an earlier Qloo result in the
  same run. Claude sees only cuisines, dishes, dislikes and taste memories; allergies, diet and the
  city stay on the server. If Claude is unavailable, a deterministic planner takes over.
- **Qloo**: `/v2/tags` (cuisine tags), `/search` (taste memories → entities), `/v2/insights` (places
  filtered by location and cuisine, ranked by taste signals).
- **A deterministic constraint engine and ranker** (Zod-validated, 289 Vitest tests) decide
  statuses, exclusions, ranking and every fact on a card. The rule: **the agent decides how to
  search; tested code decides what is safe.**

## What makes it Qloo-powered

Qloo is both the restaurant source and the taste engine.

- **Cross-domain signals.** Within Italian restaurants, a Sinatra signal brought up classic
  red-sauce places instead of Eataly and Marea. A Bob Marley signal moved a general search toward
  Caribbean places.
- **Measured, not claimed.** Every search runs again without signals and the app shows both top-10
  lists. From test searches in New York City: Sinatra (Italian-American, Queens), 4 of 10 places
  shared and 10 moved; Bob Marley (Caribbean, Bronx), 0 of 10 shared; Barbra Streisand (Jewish
  deli), 6 of 10; Fela Kuti (Nigerian, Brooklyn), 10 of 10 shared but 7 re-ordered, since NYC has
  only about 10 Nigerian places. The baseline is deterministic, so these differences are real.
- **Venue facts** from Qloo (accessibility, noise and diet tags, dish highlights) drive the
  statuses, e.g. a "Loud" tag conflicts with a quiet preference.

## Challenges we ran into

- **Tag families.** In NYC the Nigerian *genre* tag returned 0 places while the *cuisine* tag
  returned 18, so the search layer retries with the cuisine family.
- **A cuisine filter isn't a restaurant filter.** Italian results included a grocery and a hotel;
  Korean briefly ranked a food court first. We built a venue filter from 213 real places.
- **Location is a bias.** A Queens search returned Manhattan and Nassau places, so Tastora ranks the
  chosen area higher and labels the rest. In Sydney, `geocode.city` was usually a council, so Tastora
  also matches the metro.
- **No allergen data.** We built dish-name lists (suya → peanut, bibimbap → sesame, korma → milk)
  and a penalty for allergen-heavy venues, and never call anything safe.
- **Latency.** Signalled insights calls took up to 7.7 s, so we stream real progress.

## Accomplishments that we're proud of

- A 10-profile live matrix across ten cuisines: every profile returned results, and Claude corrected
  misspellings ("Nigeran", "Fela Kutti") without using a weak match for an unknown band.
- Safety rules enforced by tests, including a scan that fails `npm test` on ordering language or an
  unqualified "safe" claim.

## What we learned

Taste signals work best as a re-ranker inside a cuisine and location filter; without one, a Fela
Kuti signal drifted toward live-music venues. For most allergy questions the honest answer is "ask
the restaurant", so the app's job is to make that easy.

## What's next

Join menu data through the Google Place ID Qloo returns, share the rate limit and cache across
instances, and check coverage (including diet and accessibility tags) in more cities.

## Built with

Qloo Insights API · Claude (Anthropic API, tool use) · Next.js · React · TypeScript · Zod · Vitest ·
Vercel · Node.js

## Try it out

- Live demo: https://tastora-three.vercel.app
- Source (MIT): https://github.com/kirahszn/tastora
