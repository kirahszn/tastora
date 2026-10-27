# Agent, search layer and `/api/recommend`

Phase 3. Code: `src/lib/qloo/search.ts`, `src/lib/qloo/venueFilter.ts`, `src/lib/agent/`
(`session.ts`, `claudePlanner.ts`, `fallbackPlanner.ts`, `recommend.ts`),
`src/app/api/recommend/route.ts`. Live results: `docs/phase3-smoke.md`.

**Safety principle.** The agent decides *how to search*. It never decides what is safe. Constraint
statuses, exclusions, ranking and facts always come from the Phase 2 code
(`docs/ranking-and-constraints.md`). The agent can't add candidates or statuses. The server
collects candidates only from `search_restaurants` results.

## Pipeline

```
profile ─┬─ plannerInput (cuisines, dishes, dislikes, taste memories only) ─▶ Claude planner
         │                                                                     │ tools
         │        SearchSession: limits, ID check, location injection, trace ◀─┘
         │                      │ Qloo search layer (cache, filter, fallbacks)
         │                      ▼
         └─▶ dedupe (best Qloo rank wins) ─▶ Phase 2 evaluate → rank → facts ─▶ response
                                   main search ─▶ same search without signals ─▶ evidence
```

If Claude is unavailable (no key, API error, timeout, refusal, or no successful search), the
deterministic fallback planner runs through the same `SearchSession`. `meta.planner` is
`"agent"` or `"fallback"`, and `meta.fallbackReason` says why.

## Qloo search layer

Only endpoints and params confirmed in `docs/qloo-findings.md`:

| Function | Call | Notes |
|---|---|---|
| `findTags(query)` | `GET /v2/tags` `filter.query`, `take=15` | Keeps `urn:tag:cuisine:qloo` and `urn:tag:genre:place` (`…:restaurant:*`) tags, in Qloo's order |
| `findEntities(query, kinds)` | `GET /search` `query`, `take=10` | Kinds: artist, movie, tv_show, book, place (all seen live). `types` param not exercised live, so filtered client-side. `destination` was never seen, so it is not offered. `detail` = `short_description`, else `disambiguation` (≤ 100 chars) |
| `searchRestaurants(…)` | `GET /v2/insights` `filter.type=urn:entity:place`, `filter.location.query`, `filter.tags`, `signal.interests.entities`, `signal.interests.tags`, `take=20` | One call per cuisine tag (≤ 2), in parallel |

- **Fallbacks.** A genre tag returning 0 places is retried with the cuisine-family tag (Nigerian
  genre 0 → cuisine 18). If every tag returns 0 for a non-NYC location, the search is retried with
  "New York City". Both are noted in the trace.
- **Location behaviour (Phase 3 live).** `filter.location.query=Queens` resolves to the right
  locality ("Queens, Queens County, New York…"), but it is a proximity *bias*, not a hard filter:
  in one 20-result Italian-American call, 11 places were in Queens County and the rest in
  Manhattan, Brooklyn and Nassau. The resolved locality is shown in the trace. A borough
  post-filter is a candidate for later.
- **Cache.** In-memory, 10-minute TTL, keyed by path + sorted params, per server instance.
  In-flight requests are shared and failures are not cached. When the main search had no
  signals, the baseline is a cache hit.
- **Timeout.** The Phase 1 client's 15 s per request applies to every call.

### Non-restaurant filter (`venueFilter.ts`)

Derived from the 213 unique places in the Phase 1 E3/E5 raw responses. Test sample:
`fixtures/qloo/samples/venue-filter.json`.

1. `properties.primary_genre.id` outside `urn:tag:genre:place:restaurant[:*]` → **dropped**
   (hotel, shopping_mall, market, live_music_venue, jazz_club, night_club, tourist_attraction,
   gourmet_grocery_store, …). All of these also had a generic "Restaurant" category tag, so that tag
   is not enough to keep them. Exception: a genre id that itself contains "restaurant"
   (`southern_restaurant_(us)`) is kept.
2. Drink- or music-first restaurant genres (`bar`, `cocktail_bar`, `wine_bar`, `lounge_bar`,
   `live_music_bar`, `beer_garden`) → kept only with a specific cuisine-restaurant category tag
   (e.g. "Italian restaurant"; not "Restaurant"/"Brunch restaurant"). So Pietro Nolita and Groove
   stay; Starr Bar, Union Hall and Bar Centrale go.
3. Multi-vendor genres in the restaurant namespace (`restaurant:food_court`) → dropped (Phase 5:
   Smorgasburg Williamsburg ranked #1 for a Korean profile; no single kitchen to ask).
4. No primary genre → kept (0 of 213 lacked one).

Kept places are renumbered `qlooRank` 1..n, so a dropped hotel doesn't cost the venues below it
taste points. Drop counts appear in the trace (e.g. "19 places, 1 non-restaurant dropped").

## Agent

**Model.** `ANTHROPIC_MODEL`, default `claude-sonnet-5-5` (current Sonnet; model list checked
2026-10-26 via the Claude API skill). Sonnet-class for reliable multi-step tool use and
disambiguation. Called with `output_config.effort: "low"` to keep latency down. Planning a few
lookups is easy, and live turns took 0.9–2.2 s. Haiku 5.5 (`claude-haiku-5-5`) is the switch
if latency becomes a problem. Notes for this model: forced `tool_choice` returns a 400, so
`auto` is used; thinking can't be fully disabled; assistant content (thinking blocks included)
is passed back unchanged.

**Tools.**

| Tool | Input | Returns to the model |
|---|---|---|
| `find_cuisine_tags` | `query` | Up to 6 tags `{id, name, family}` |
| `find_taste_entities` | `query`, `kind` (artist / movie / tv_show / book / place) | Up to 6 entities `{id, name, kind, detail}` |
| `search_restaurants` | `cuisine_tag_ids` (1–2), `signal_entity_ids?` (≤ 3), `signal_tag_ids?` (≤ 3) | `{places, nonRestaurantsDropped, top: [5 names], notes}`. There is **no location field**: the server injects the profile location, and extra keys are stripped |

**Hard limits (code, `AGENT_LIMITS`).** 10 tool calls, 6 model turns, 3 restaurant searches.
The planner time budget is 30 s from request start. Every id passed to `search_restaurants` must
have come from an earlier `find_cuisine_tags` (tags) or `find_taste_entities` (entities) result in
the same run. Invented ids get an `is_error` tool result naming them, and no Qloo call is made.
Bad input, unknown tools, over-limit calls and Qloo failures also go back as `is_error` results.
Upstream bodies are never forwarded.

**Data minimisation.** The model gets only `favouriteCuisines`, `favouriteDishes`, `dislikes` and
`tasteMemories`. Allergies, dietary restrictions, texture, comfort needs, location and display
name stay on the server. A test checks every request body.

**Fallback planner.** Each favourite cuisine (≤ 3) → first tag from `find_cuisine_tags`. Each
taste memory (≤ 3; music → artist, films → movie, places → place) → first entity match. Then one
search per cuisine tag, with all the entity signals; the first cuisine is the main search.

**Trace.** `{ step, tool, inputSummary, resultSummary, ms }` in plain language, e.g.
"'Fela Kuti' as artist → Found 'Fela Kuti' (artist)" and "Nigerian restaurants in Brooklyn with
1 taste signal (Fela Kuti) → 10 places, 0 non-restaurants dropped". It includes Claude turns,
planner notes, ranking and baseline steps. No secrets, and no allergy or diet data.

## Qloo contribution evidence

The main search (the planner's first `search_restaurants`) is rerun without taste signals, with
the same tags and location. The rerun starts as soon as the main search returns, in parallel with
the rest of planning.

`evidence: { cuisineTags, baselineTop10, personalisedTop10, overlapCount, rankChanges, signalsUsed }`
(names and ids only). `rankChanges` (added beyond the brief) counts personalised top-10 places in
a different position from the baseline. It shows re-ordering even when overlap is 10/10, as with
Nigerian, where NYC has only about 10 places.

## `POST /api/recommend`

- Body `{ profile, feedback? }`: `SeniorProfileSchema` and `RankingFeedbackSchema`
  (`src/lib/ranking/feedback.ts`; ids ≤ 100 chars, ≤ 50 per list). Invalid → **400**
  `{ error, fieldErrors: [{ path, message }] }`. Non-JSON body → 400.
- **200** `{ results, excluded, trace, evidence, meta }`. `results[]` are the Phase 2 explanation
  facts, plus `venue { address, neighborhood, priceLevel, rating, cuisines }`. `meta` has
  `planner`, `model`, `fallbackReason?`, `location`, `qlooCalls`, `qlooCacheHits`,
  `anthropicRequests` and `durationMs`.
- **502** `{ error: "We couldn't get restaurant suggestions right now. Please try again in a minute." }`
  when no restaurant search succeeds. Only the error class name is logged; there are no stacks,
  upstream messages or keys.
- **Streaming (Phase 4): `POST /api/recommend?stream=1`.** Same body, validation and rate limit
  (400/429 are normal JSON responses, sent before streaming starts). Then
  `application/x-ndjson`: one `{"type":"step","step":TraceStep}` line per trace step *as it is
  recorded* (`recommend(…, { onStep })`, wired through `SearchSession`'s `onStep` hook), then one
  `{"type":"result","result":…}` or `{"type":"error","status":502,"error":…}`. The streamed steps
  equal the final `trace` (tested). The browser client falls back to plain JSON once if the stream
  breaks before a result (it never retries 400/429/502).
- `evidence.cuisineTagNames` (Phase 4): display names of the main search's cuisine tags.
- **`notices` (Phase 5, `src/lib/agent/notices.ts`)**: plain sentences shown as "About this search":
  the built-in planner standing in for Claude; the NYC-wide location retry (only from searches that
  contributed places); taste memories no used signal matches (fuzzy: accents, small typos, extra
  words, so a typo Claude corrected isn't reported); and the related-cuisine fallback. **Related
  cuisine:** if every search returned 0 places, the server looks up a favourite cuisine's family
  (`cuisineFamilyOf`, e.g. Haitian → Caribbean) and searches it once *through the same session*
  (ID rule, limits and trace apply), keeping the main search's entity signals; that search becomes
  the evidence baseline. The client only falls back to plain JSON when the stream broke before any
  step arrived; after steps it shows the 502 state rather than re-running a costly search.
- **429** above 10 requests/minute per IP (first `x-forwarded-for` address). Fixed window, in
  memory, per instance: a soft guard on API credit, not a global quota.
- **Max duration.** `export const maxDuration = 60` (Next.js 16 route segment config,
  `node_modules/next/dist/docs/…/route-segment-config/maxDuration.md`). Vercel docs
  (functions/configuring-functions/duration, updated 2026-08-24): with fluid compute (default),
  Hobby has a 300 s default and maximum; Pro/Enterprise have a 300 s default and an 800 s
  maximum (1800 s beta). 60 s fits every plan.
