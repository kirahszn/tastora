# Qloo fixtures

Recorded real Qloo API responses from `npm run qloo:probe` (Phase 1). Never store API keys or request headers here.

- `raw/`: full responses. Gitignored, local only.
- `samples/`: committed, for tests. Slimmed in Phase 2 by `scripts/slim-qloo-samples.ts`: only the 4 files
  the tests use, at most 5 place entities each, and only the fields `src/lib/domain/place.ts` reads.
  - `E5h-west-african-signal-fela.json`: insights shape, with `query.affinity`
  - `E5i-italian-signal-sinatra.json`: insights shape, Italian
  - `E5k-restaurant-signal-dish-soup.json`: soup dishes (texture hints)
  - `E6-search-katzs.json`: `/search` shape (`tag_id`, object `google_place`), garbled specialty dishes

- `venue-filter.json` (Phase 3): 55 slimmed places (45 non-restaurant or drink-first, 10 ordinary) with only
  `primary_genre` and `category:place` tags, for the non-restaurant filter tests. Built from `raw/` by
  `scripts/extract-venue-filter-samples.ts`; shape `{ note, places[] }`.

- `portrait-*.json` (Phase 7 validation, not used by tests): tag and cross-domain insights for Fela Kuti,
  Frank Sinatra and Bob Marley. Shape `{ request, ok, status, durationMs, resultCount, body }`, with the
  first 5 items slimmed to id/name/subtype/affinity. See "Taste portrait" in `docs/qloo-findings.md`.

- `city-*.json` (Phase 9c coverage check, `npm run qloo:coverage`; read by `tests/location.test.ts`):
  one file per city (London, Toronto, Los Angeles, Chicago, Lagos, Sydney) plus `city-edges.json`
  (unresolvable location, "Queens, New York City"). Shape `{ city, sinatraTop10OverlapWithItalian,
  runs[] }`; each run has its requests, resolved locality, raw/kept/in-city counts, field coverage,
  phone samples, top 10 ids/names and 5 slim places (name, primary genre, address, geocode, locality,
  phone, website/hours/dish flags). See "Coverage beyond NYC" in `docs/qloo-findings.md`.

The other files have the shape `{ request: { path, params }, ok, status, body }`.
Re-running `npm run qloo:probe` rewrites samples at full size; run the slim script afterwards.
