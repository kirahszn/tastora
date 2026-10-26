# Qloo findings

Notes from testing the Qloo API against real NYC data (Phase 1 spike, 2026-10-26).
Evidence: `npm run qloo:probe` → full responses in `fixtures/qloo/raw/` (local only, gitignored),
trimmed samples (≤5 entities, same structure) in `fixtures/qloo/samples/`. 34 live calls in total.

**Docs status.** Read from docs.qloo.com: API onboarding, parameter overview, parameter reference,
entity-type parameter guide, Insights deep dive, `GET /search`, `GET /entities`, `GET /v2/tags`.
**Not found:** a hackathon-specific developer guide (no public page found by link or search). The base
URL (`https://hackathon.api.qloo.com`) is the one in `.env.local`; the public docs only show
`staging.api.qloo.com` / `api.qloo.com`.

## Endpoints tested

| Endpoint | Docs | Live | Notes |
|---|---|---|---|
| Auth header `X-Api-Key` | CONFIRMED | CONFIRMED | Bad key → 401 |
| `GET /search` (`query`, `take`) | CONFIRMED | CONFIRMED | Mixed types (place, brand, artist, album, person, movie…) unless `types` is set |
| `GET /v2/tags` (`filter.query`, `take`) | CONFIRMED | CONFIRMED | Body: `results.tags[]` with `id`, `name`, `type`, `parents`, `properties`, `popularity` |
| `GET /v2/insights` `filter.type=urn:entity:place` | CONFIRMED | CONFIRMED | Body: `success`, `results.entities[]`, `query.localities` |
| `filter.location.query=New York City` | CONFIRMED | CONFIRMED | Resolved to locality "New York, New York, United States" (echoed in `query.localities.filter`) |
| `filter.tags` | CONFIRMED | CONFIRMED | Works with live IDs like `urn:tag:genre:place:restaurant:italian`. Docs examples use `urn:tag:genre:restaurant:Italian`, which we did **not** use |
| `signal.interests.tags` | CONFIRMED | CONFIRMED | Strong effect (see E5) |
| `signal.interests.entities` | CONFIRMED | CONFIRMED | Works cross-domain (artist/movie → places) |
| `signal.demographics.age=55_and_older` | Param CONFIRMED, value UNCLEAR | Accepted (200) | Changed affinity scores but **not** the ranking |
| `take` | CONFIRMED (default 20, max 50) | CONFIRMED | |
| `GET /entities` | CONFIRMED | not called | Not needed: search and insights already return full entities |

Rate-limit headers (E1): `x-second-ratelimit-limit: 10`, `x-month-ratelimit-limit: 50000`,
with matching `-remaining`/`-reset` headers. Latency: search/tags ~300 ms; insights 0.5–1.6 s; insights
with `signal.interests.tags` was 4.5–7.7 s (the slowest by far).

## Entity types

Insights `filter.type` URNs (docs): artist, book, brand, locality (partial), movie, person, place, podcast,
tv_show, videogame, `urn:heatmap`. Search also returned `urn:entity:album` and `urn:entity:author`.
Insights place entities come back with `type: "urn:entity"`, `subtype: "urn:entity:place"`; search
results use `types: ["urn:entity:place"]`. **The two shapes differ.**

## Place fields observed

Per-entity top level: `name`, `entity_id`, `type`, `subtype`, `popularity`, `location` (`lat`, `lon`,
`geohash`), `tags[]` (~100+ per place), `query` (`affinity` when signals are used), `disambiguation`
(= address), `external` (`google_place`, `tripadvisor`, `opentable`, `resy`, `michelin`, `tablet`, `expedia`).

`properties`: `address`, `geocode` (city, neighborhood name, admin regions, country, metro), `locality`,
`localities`, `neighborhood`, `phone`, `website`, `menu_url`, `hours` (per weekday opens/closes/closed),
`is_closed`, `price_level` (1–4), `price_range` (`from`/`to`/`currency`, often null), `business_rating`,
`description`, `short_description`, `overall_description`, `cuisine_description`, `ambience_description`,
`service_description`, `amenities_description`, `physical_setting_description`,
`neighborhood_description`, `customer_demographics_description`, `unique_selling_points`,
`primary_genre`, `specialty_dishes[]` (tag id/name/weight), `keywords[]` (review keyword + count),
`good_for`, `parking`, `pet_friendly`, `live_music`, `event_spaces`, `loyalty_program`, `image(s)`;
hotels also get `hotel_class`, `star_rating`, `number_of_rooms`, check-in/out times.

Place tag types relevant to Tastora: `menu_highlight`, `specialty_dish`, `cuisine`, `dietary_option`
(Vegan, Gluten free, Halal, Dairy free, Allergy friendly, Peanut free), `offerings`, `accessibility`
(wheelchair entrance/seating/restroom), `noise_level` (Moderate/Loud/Very loud), `ambience`,
`time_of_day_fit`, `customer_identity`, `age_range`, `service_options`, `parking`, `cost_description`.

### E4 field coverage (152 unique NYC places from E3 + E5a–g)

| Field | Coverage | Field | Coverage |
|---|---|---|---|
| name, entity_id, location (lat/lon), address, geocode | 152/152 | `price_level` | 130/152 |
| `business_rating`, description(s), `primary_genre` | 152/152 | `keywords` (review terms) | 124/152 |
| external `google_place` id | 152/152 | `specialty_dishes` property | 72/152 |
| `hours` | 145/152 | `menu_url` | 16/152 |
| `phone` | 144/152 | external `tripadvisor` / `opentable` / `resy` | 97 / 27 / 24 |
| `website` | 139/152 | `cuisine_description` | 138/152 |

| Tag type | Coverage | Tag type | Coverage |
|---|---|---|---|
| `accessibility` | 138/152 | `dietary_option` | 113/152 |
| `noise_level` | 137/152 | `offerings` | 120/152 |
| `menu_highlight` | 137/152 | `specialty_dish` tags | 56/152 |
| `cuisine` | 137/152 | `age_range` | 136/152 |

Menu / dish / ingredient / allergen check:
- **Dishes:** yes, partly. `menu_highlight` tags (137/152), `specialty_dishes` (72/152) and review
  `keywords` give dish names (e.g. Katz's: Matzah ball soup, Pastrami sandwich, Knish).
- **Full menus:** no. Only `menu_url` (16/152) links out.
- **Ingredients:** no structured field. They show up only inside free-text `cuisine_description` (33/152
  mention "ingredient", usually as "fresh ingredients").
- **Allergens:** no per-dish data. Some venue-level `dietary_option` tags exist: Gluten free 52, Dairy
  free 5, Allergy friendly 9, Peanut free 1 (of 152). These are venue claims, not dish facts.
- **Texture (soft / pureed):** nothing. Only 2 incidental text hits.
- **Data-quality note:** names can be garbled. Katz's `specialty_dishes` lists "Ball Soup", while its
  `menu_highlight` tag correctly says "Matzah ball soup".

## Tags

Exact IDs from `/v2/tags` (E2), first `genre:place:restaurant` / `cuisine:qloo` / `category:place` hits:

| Query | Genre (place) | Cuisine | Category |
|---|---|---|---|
| nigerian | `urn:tag:genre:place:restaurant:nigerian` | `urn:tag:cuisine:qloo:nigerian` | — |
| west african | `urn:tag:genre:place:restaurant:west_african` | `urn:tag:cuisine:qloo:west_african` | `urn:tag:category:place:west_african_restaurant` |
| caribbean | `urn:tag:genre:place:restaurant:caribbean` | `urn:tag:cuisine:qloo:caribbean` | `urn:tag:category:place:caribbean_restaurant` |
| soul food | `urn:tag:genre:place:restaurant:soul_food` | `urn:tag:cuisine:qloo:soul_food` | `urn:tag:category:place:soul_food_restaurant` |
| italian | `urn:tag:genre:place:restaurant:italian` | `urn:tag:cuisine:qloo:italian` | `urn:tag:category:place:italian_restaurant` |
| chinese | `urn:tag:genre:place:restaurant:chinese` | `urn:tag:cuisine:qloo:chinese` | `urn:tag:category:place:chinese_restaurant` |
| jewish deli | `urn:tag:genre:place:restaurant:deli` (+ `...:jewish`) | `urn:tag:cuisine:qloo:jewish_deli` | `urn:tag:category:place:jewish_restaurant` |
| soup | `urn:tag:genre:place:restaurant:soup` | — (dish: `urn:tag:specialty_dish:place:soup`, `urn:tag:menu_highlight:qloo:soup`) | `urn:tag:category:place:soup_restaurant` |
| vegetarian | `urn:tag:genre:place:restaurant:vegetarian` | `urn:tag:cuisine:qloo:vegetarian` | `urn:tag:category:place:vegetarian_restaurant` (+ `urn:tag:dietary_option:qloo:vegetarian`) |

Each query returns 15 mixed tags across music, media, hotel, decor and so on. **Filter by tag `type`
before using them.** Dish tags come in two families: `urn:tag:specialty_dish:place:*` and
`urn:tag:menu_highlight:qloo:*` (e.g. `nigerian_pepper_soup`, `nigerian_suya_skewers`).

## Location coverage NYC

- `filter.location.query=New York City` resolves to the NYC locality, and results are NYC places
  (Manhattan, Brooklyn, Bronx, Queens). A few spill over into New Jersey: Rumba Cubana (Guttenberg) and
  Battello (Jersey City), which have NYC `metro` but a NJ city. Filter on `geocode.city` / borough if needed.
- E3 result counts (take=20): West African genre **20**, Caribbean genre **20**, Italian genre **20**.
  Nigerian **genre** tag: **0**. Nigerian **cuisine** tag (`urn:tag:cuisine:qloo:nigerian`): **18**
  (Buka, Lagos TSQ, Accra, Festac NYC, Brooklyn Suya…). The tag family matters, so try genre, then cuisine.
- **A cuisine filter is not a "restaurant only" filter.** Italian returned Eataly (grocery), a hotel, a
  cocktail bar and a "Bronx Little Italy" tourist attraction. `urn:tag:category:place:restaurant` let in a
  shopping mall (Queens Center), a hotel (Wythe) and a music venue, because those venues carry restaurant
  tags. We need a post-filter on `primary_genre` / `category:place` tags.

## Cross-domain signal test

E5 base query: `/v2/insights`, place, NYC, `filter.tags=urn:tag:category:place:restaurant`, take=20.
Compared top-10 lists by `entity_id`.

| Run | Signal | Top-10 overlap with baseline |
|---|---|---|
| a2 | none (repeat) | **10/10, same order** (deterministic) |
| b | `signal.interests.tags` = nigerian + west african + caribbean genre tags | **0/10**: 9 of 10 are West African/African restaurants (Aso Rock, Festac NYC, Akwaaba…) |
| c | entity: Fela Kuti (artist) | **1/10**: mostly live-music venues and bars (Baby's All Right 9→1, Iridium, Sony Hall) |
| d | entity: Bob Marley (artist) | **0/10**: Caribbean restaurants and lounges (Suede, The Simpson, Island Grill Cafe, Jouvay) |
| e | entity: *Living in Bondage: Breaking Free* (Nollywood film) | **2/10**: generic/touristy (Little Italy, WTC mall, Hard Rock); no African signal |
| f | entity: Frank Sinatra (control) | **0/10**: Tavern on the Green, Press Lounge, Bar Centrale, a steakhouse |
| g | `signal.demographics.age=55_and_older` | **10/10, same order**: affinity values changed, ranking did not |

Within a cuisine-filtered set (Tastora's real pattern: constraint filter + taste re-rank):

| Run | Filter + signal | Overlap |
|---|---|---|
| h | West African + Fela Kuti | 5/10 vs unsignalled West African: real re-rank (Joloff 8→2, Buka 3→1) plus 5 new places |
| i | Italian + Frank Sinatra | 0/10 vs unsignalled Italian: classic red-sauce places (Chazz Palminteri, Original Vincent's, Cafe Fiorello) instead of Eataly/Marea/Cipriani |
| j | Italian + Fela Kuti | 0/10 vs unsignalled; **3/10 vs Italian+Sinatra**: different people, different Italian places (Pangea, Groove, Gran Torino) |
| k | restaurant + dish tag `specialty_dish:place:soup` | 0/10: pho, Chinese, deli, izakaya (soup-serving places), but includes McDonald's |

**Verdict:** taste signals change results a lot, and the change is meaningful, not noise. The baseline
is fully deterministic, so 0–2/10 overlaps are real effects. Tag signals are the most precise. Music-artist
signals do cross domains, and they shift results in a culturally coherent way: Bob Marley → Caribbean
venues, Sinatra → old-school NYC/Italian-American. But without a restaurant/cuisine filter they drift
toward music venues and bars (Fela). The Nollywood film signal was weak and generic, probably a sparse
entity. The age demographic signal did nothing to the order. **Best pattern: hard filter
(cuisine/location) plus a taste signal to re-rank (runs h–j).** Without Qloo, Tastora could not produce
these personalized orderings.

## Limits/errors

- E7 invalid `filter.type` (`urn:entity:not_a_type`): **400**,
  `{"errors":[{"message":"at least one valid signal or filter is required for entity insights"}]}`.
- E7 bad key: **401**, `{"error":{"reason":"API keys mismatch","message":"Unauthorized","code":401}}`.
- So there are two error shapes (`errors[]` vs `error{}`), and both differ from the documented
  `{code, reason, message}`. The client treats bodies as `unknown`.
- No rate-limit or 5xx hits in 34 calls. `signal.interests.tags` queries are slow (4.5–7.7 s), which
  leaves little headroom under the 10 s client timeout.

## CONFIRMED / NOT AVAILABLE / UNCLEAR

**CONFIRMED (docs + live):** `X-Api-Key` auth; `/search`, `/v2/tags`, `/v2/insights`; place insights in NYC
via `filter.location.query`; `filter.tags`; `signal.interests.tags`; `signal.interests.entities` (cross-domain);
`take`. Place data: name, address, lat/lon, phone, website, hours, price level, rating, descriptions,
dish highlights, venue dietary/accessibility/noise tags, external IDs (Google Place on all).

**NOT AVAILABLE:** structured menus; ingredients; per-dish allergens; texture/softness info; verified
allergen-safety claims. A reliable "restaurants only" type filter (needs a post-filter).

**UNCLEAR:** `signal.demographics.age` value set and effect (accepted, but no re-rank observed); whether
`hackathon.api.qloo.com` differs in behavior from production (no hackathon guide found); why the Nigerian
genre tag returns 0 in NYC while the cuisine tag returns 18; freshness of `is_closed` / hours; `/entities`
lookup (not exercised).

## Data gaps

| Tastora needs | Qloo provides | Gap |
|---|---|---|
| Restaurant name | Yes (152/152) | — |
| Location (address, lat/lon, neighborhood) | Yes (152/152) | Some NJ spill-over; filter by city |
| Link | `website` 139/152; OpenTable/Resy/TripAdvisor IDs on some; Google Place ID 152/152 | Small |
| Hours / phone | 145/152 / 144/152 | Small; freshness unverified |
| Dishes | `menu_highlight` 137/152, `specialty_dishes` 72/152, `keywords` | Names only, sometimes garbled; no full menu |
| Ingredients | Free-text descriptions only | **Large** |
| Allergens | Venue-level tags (Gluten free 52, Allergy friendly 9, Peanut free 1, Dairy free 5) | **Large**: no dish-level data; must be flagged unverifiable |
| Texture (soft/pureed) | None | **Total** |
| Accessibility / noise (older diners) | `accessibility` 138/152, `noise_level` 137/152 | Bonus. Qloo is strong here |
| Taste fit | Affinity under signals | Qloo's core value |

## Decisions

**Recommendation (not integrated):** Qloo **can be the primary restaurant source for NYC**. It covers
discovery, identity, location, links, hours, dish highlights, accessibility, noise and, critically,
taste-based ranking that Tastora cannot do without it. A second source is **not** needed for core
restaurant data. Ingredients, per-dish allergens and texture are not available from Qloo. The
cheapest honest approach is to treat them as **"unverifiable — call the restaurant"** flags and surface
the phone/website. If a second source is added later, it should be menu-level data (a menu
API, or the restaurant's `menu_url` page), and only for ingredients/allergens. The Google Place ID on every
entity is a ready join key for that.

Implementation notes for later phases:
- Query pattern: `filter.tags` (cuisine, genre → cuisine fallback) + `filter.location.query` +
  `signal.interests.tags`/`entities` from the caregiver's described tastes.
- Post-filter to food venues via `primary_genre` / `category:place` tags, and by NYC city.
- Pick tags by `type` (`genre:place`, `cuisine:qloo`, `specialty_dish:place`, `menu_highlight:qloo`).
- Raise the timeout or add a retry for `signal.interests.tags` queries (seen up to 7.7 s).
- Don't rely on `signal.demographics.age`.
