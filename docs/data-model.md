# Data model

Phase 2: typed profile, Qloo place → `Candidate` mapping, constraint engine, ranking and explanation
facts. All pure TypeScript; no UI, no live calls, no LLM. Field names come from the recorded samples in
`fixtures/qloo/samples/` (see `docs/qloo-findings.md`).

## SeniorProfile (`src/lib/domain/profile.ts`)

| Field | Type | Limits |
|---|---|---|
| `displayName` | string, optional | ≤ 40; a label like "Mum", not a full name |
| `favouriteCuisines` | string[] | 1–5, each ≤ 60 |
| `favouriteDishes` | string[] | 0–10, each ≤ 80 |
| `tasteMemories.music` / `.films` / `.places` | string[] | 0–5 each, each ≤ 80 |
| `dislikes` | string[] | 0–15, each ≤ 60 |
| `allergies` | string[] | 0–10, each ≤ 60 |
| `dietaryRestrictions` | string[] | 0–10, each ≤ 60 |
| `texture` | `none` \| `soft` \| `easy_to_chew` | default `none` |
| `comfort.quietPreferred` / `.wheelchairAccess` | boolean | default false |
| `location` | string | required, ≤ 80 |

All strings are trimmed; empty entries are rejected. Optional lists default to `[]`.

## Qloo place → Candidate (`src/lib/domain/place.ts`)

Two entity shapes exist and both are accepted:

| | `/v2/insights` | `/search` |
|---|---|---|
| Place marker | `subtype: "urn:entity:place"` | `types: ["urn:entity:place"]` |
| Tag id | `tags[].id` | `tags[].tag_id` |
| Google Place | `external.google_place[]` (array) | `properties.external.google_place` (object) |
| Affinity | `query.affinity` | absent |

Parsing is tolerant: unknown fields are dropped, a malformed optional field becomes `null`, a
malformed tag is dropped. Only `entity_id` and `name` are required.

| Candidate field | Qloo path | Notes |
|---|---|---|
| `id` | `entity_id` | |
| `name` | `name` | trimmed |
| `address` | `properties.address`, else `disambiguation` | |
| `neighborhood` | `properties.neighborhood` | |
| `lat`, `lon` | `location.lat`, `location.lon` | |
| `phone` | `properties.phone` | |
| `website` | `properties.website` | |
| `hours` | `properties.hours.<weekday>[] {opens, closes, closed}` | times like `"T12:00:00"` |
| `priceLevel` | `properties.price_level` | 1–4 |
| `rating` | `properties.business_rating` | rounded to 1 decimal |
| `description` | `properties.description`, else `properties.short_description` | |
| `tags` | `tags[] {id \| tag_id, name, type}` | all tags kept |
| `cuisines` | names of tags with type `urn:tag:cuisine:qloo` | |
| `dishHighlights` | names of tags with type `urn:tag:menu_highlight:qloo` | shown as "dishes to ask about" |
| `specialtyDishes` | `properties.specialty_dishes[].name` + tags `urn:tag:specialty_dish:place` | de-duplicated; fragments starting "And/With/Or/Of" dropped; may still be garbled ("Ball Soup") |
| `menuUrl` | `properties.menu_url` | rare (16/152) |
| `googlePlaceId` | first `google_place.place_id` (see shapes above) | |
| `mapsUrl` | built from `googlePlaceId` + name/address | `https://www.google.com/maps/search/?api=1&query=…&query_place_id=…` ([Maps URLs, search action](https://developers.google.com/maps/documentation/urls/get-started#search-action)) |
| `accessibilityTags` | names of tags with type `urn:tag:accessibility:place` | |
| `noiseTags` | names of tags with type `urn:tag:noise_level:qloo` | Moderate / Loud / Very loud |
| `isClosed` | `properties.is_closed === true` | freshness unverified |
| `qlooRank` | 1-based position among place entities in the response | |
| `affinity` | `query.affinity` | null for search results |

Other tag types read by the constraint engine: `urn:tag:dietary_option:qloo`, `urn:tag:offerings:place`,
`urn:tag:ambience:qloo`.

## RankingFeedback (`src/lib/ranking/feedback.ts`)

`{ liked?, disliked?, notSuitable?, tried? }`: candidate ids, each ≤ 100 chars, ≤ 50 per list
(Phase 3, validated by `/api/recommend`).

## Constraints, ranking and explanation facts

Rules, statuses, weights, exclusions, the allergen dish-name list and a worked example are in
`docs/ranking-and-constraints.md`.
