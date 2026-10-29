# Qloo findings

Notes from testing the Qloo API against real NYC data (Phase 1 spike, 2026-10-26). Six other
cities were checked in Phase 9c: see "Coverage beyond NYC".
Evidence: `npm run qloo:probe` → full responses in `fixtures/qloo/raw/` (local only, gitignored),
trimmed samples (≤5 entities) in `fixtures/qloo/samples/` (slimmed to 4 files and the used fields in
Phase 2; see `fixtures/qloo/README.md`). 34 live calls in total.

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
  leaves little headroom under the 10 s client timeout (raised to 15 s in Phase 2).

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

## Phase 3 live notes

- `filter.location.query` with a borough ("Brooklyn", "Queens") resolves to that locality (echoed
  in `query.localities.filter[0].disambiguation`, e.g. "Queens, Queens County, New York, New York,
  United States"). It biases results by proximity but doesn't restrict them: in an Italian-American +
  Queens call, 11 of 20 places were in Queens County, the rest in Manhattan, Brooklyn and Nassau
  (Nassau was a mall, which the venue filter drops).
- Tags exist for `urn:tag:cuisine:qloo:italian_american` (plus "Italian-American Fusion",
  "American Italian", …). 19 NYC places came back with the Sinatra signal.
- The non-restaurant filter rule is documented in `docs/agent.md`.

## Taste portrait (Phase 7 validation, 2026-10-27)

Question: can Qloo say what people who love a taste-memory entity "also tend to love", with
**food/dining** items first (e.g. Fela Kuti → West African/Nigerian cuisine tags), plus a few
cross-domain items? 12 live calls (`npm run qloo:probe -- P1 P1b P2`), no Anthropic calls. Entity ids
reused from the Phase 1 `/search` responses (artist type): Fela Kuti `679CEADA-…`, Frank Sinatra
`FC0F8D26-…`, Bob Marley `A921B4A4-…`. Samples: `fixtures/qloo/samples/portrait-*.json` (request,
status, latency, result count, first 5 items with id/name/subtype/affinity).

**Docs.** The parameter reference (docs.qloo.com/reference/parameters) does not list `urn:tag` in the
`filter.type` enum, but `diversify.by` says "Use subtype with filter.type=urn:tag…", so tag output exists.
`filter.tag.types` is listed, though its description says "audience types" and its compatibility column
is blank. `filter.parents.types`, `signal.location.query` and `take` (max 50) are listed. `Destination`
appears in compatibility columns, not in the `filter.type` enum. **UNCLEAR in docs, CONFIRMED live:**
`filter.type=urn:tag` + `filter.tag.types` + `signal.interests.entities`, and
`filter.type=urn:entity:destination`. Tag results come back as `results.tags[]` with `tag_id`, `name`,
`subtype`, `types`, `tag_value`, `popularity`, `query.affinity`.

| Call (all `/v2/insights`, `signal.interests.entities` = artist) | Results | Latency | Verdict |
|---|---|---|---|
| Fela · `urn:tag` · `filter.tag.types=urn:tag:cuisine:qloo` | **0** | 1.5 s | nothing |
| Fela · same + `signal.location.query=New York City` | **0** | 0.5 s | nothing |
| Fela · `urn:tag` · `filter.tag.types=urn:tag:genre:place` | **0** | 0.4 s | nothing |
| Fela · `urn:tag` · `filter.parents.types=urn:entity:place` (no tag type), take 50 | 1: "Washington D.C." (`residence`) | 1.1 s | irrelevant |
| Marley · cuisine tags | **0** | 0.8 s | nothing |
| Sinatra · cuisine tags | 8: Asian, Japanese, Italian, Mexican, Seafood, American, Steakhouse, French | 0.7 s | generic, not Sinatra-specific (Italian is 3rd, after Asian/Japanese) |
| Fela · `urn:tag` · `filter.tag.types=urn:tag:genre:music` (sanity) | 10: funk, free jazz, Jazz, Roots - Reggae, avant-garde… | 1.1 s | coherent; tag insights work, same domain |
| Fela · `urn:entity:artist` | 10: Antibalas Afrobeat Orchestra, Tony Allen, Manu Dibango, Femi Kuti, Mulatu Astatke… | 3.7 s | excellent |
| Fela · `urn:entity:destination` | 10: Accra, Addis Ababa, Kampala, Lagos, Maputo, Nairobi, Harare, Johannesburg, Luanda, Dakar | 0.3 s | excellent |
| Fela · `urn:entity:movie` | The Act of Killing, The Look of Silence, Timbuktu, Leviathan, Son of Saul… | 2.6 s | arthouse/world cinema; partly coherent |
| Sinatra · movies | Boyhood, The Theory of Everything, Her, The Grand Budapest Hotel, The Imitation Game… | 1.9 s | generic 2010s prestige films; not Sinatra-like |
| Marley · movies | Lords of Dogtown, City of God, What's Eating Gilbert Grape, The Beach, The Basketball Diaries… | 2.1 s | generic; weak |

**Verdict: NO-GO for the portrait as specified.** The food part is the point of the feature, and Qloo
gives nothing usable for it: cuisine and restaurant-genre tag insights return **0** for Fela Kuti and
Bob Marley (with or without a NYC location signal), and Sinatra's list looks like a general popularity
order, not a taste association. Showing it as "people who love Sinatra also love Asian food" would be
technically true output but misleading. The "Try this" cuisine chips have no honest source. Cross-domain
results are mixed: artists and destinations are culturally coherent and human-readable; movies are
weak for 2 of 3 signals. Latency 0.3–3.7 s per call, fine in parallel with the restaurant search.

Restaurant-level taste effects (E5h–j: Fela re-ranks West African places, Sinatra pulls red-sauce
Italian) remain the real, demonstrable food signal. They are already shown in the evidence panel.

**Best honest alternative (not built):** a smaller "taste neighbours" line per signal from
`urn:entity:artist` (same domain) and `urn:entity:destination` (cross-domain), e.g. "People who love
Fela Kuti also tend to love: Tony Allen, Femi Kuti, Manu Dibango · and places like Accra, Lagos, Dakar".
No food chips, no "Try this", no cuisine inference from destinations. 2 extra calls per signal, in
parallel; destination calls ~0.3 s, artist ~3.7 s. Untested for non-music signals (films, places) and
for Sinatra/Marley destinations.

## Coverage beyond NYC (Phase 9c, 2026-10-28)

Question: does Qloo have enough restaurant data outside New York for Tastora to be useful, and which
location fields can rank and label places honestly? **23 live Qloo calls** (`npm run qloo:coverage`,
budget 24), **0 Anthropic calls**. Every search went through the real search layer
(`createQlooSearch`: venue filter, genre → cuisine fallback) with `filter.location.query=<city>`,
`take=20`. Per city: Italian (`urn:tag:genre:place:restaurant:italian`), one local cuisine, and Italian
+ Frank Sinatra (`signal.interests.entities`, artist id `FC0F8D26-…` from Phase 1) to see if a taste
signal reorders results. Tag ids for Indian, Korean and Polish came from 3 `/v2/tags` calls (genre tags
`urn:tag:genre:place:restaurant:{indian,korean,polish}` exist). Slim samples:
`fixtures/qloo/samples/city-*.json` (request, locality, counts, field coverage, phone samples, top 10,
5 slim places per search); raw responses in `fixtures/qloo/raw/city-*.json` (gitignored).

"Kept" = places left after the venue filter. "In city/metro" = kept places whose
`properties.geocode.city` or `geocode.metro` equals the city searched. Coverage columns are of kept places.

| City · search | Resolved locality (`query.localities.filter[0].disambiguation`) | Kept / raw | In city / metro | Phone | Website | Dishes |
|---|---|---|---|---|---|---|
| London · Italian | London, London Borough of Lambeth, Inner London - East, Surrey, Greater London, England, United Kingdom | 18/20 | 18/18 | 14/18 | 18/18 | 18/18 |
| London · Indian | (same) | 20/20 | 20/20 | 18/20 | 20/20 | 20/20 |
| London · Italian + Sinatra | (same) | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 |
| Toronto · Italian | Toronto, Golden Horseshoe, Ontario, Canada | 19/20 | 18/19 | 18/19 | 18/19 | 19/19 |
| Toronto · Chinese | (same) | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 |
| Toronto · Italian + Sinatra | (same) | 20/20 | 19/20 | 19/20 | 19/20 | 20/20 |
| Los Angeles · Italian | Los Angeles, Los Angeles County, California, United States | 18/20 | 18/18 | 18/18 | 18/18 | 18/18 |
| Los Angeles · Korean | (same) | 20/20 | 20/20 | 20/20 | 18/20 | 20/20 |
| Los Angeles · Italian + Sinatra | (same) | 19/20 | 18/19 | 18/19 | 19/19 | 19/19 |
| Chicago · Italian | Chicago, Cook County, Illinois, United States | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 |
| Chicago · Polish | (same) | 16/17 | 15/16 | 16/16 | 13/16 | 15/16 |
| Chicago · Italian + Sinatra | (same) | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 |
| Lagos · Italian | Lagos, Nigeria | 8/9 | 8/8 | 7/8 | 3/8 | 6/8 |
| Lagos · Nigerian (cuisine tag) | (same) | 13/20 | 13/13 | 10/13 | 9/13 | 13/13 |
| Lagos · Italian + Sinatra | (same) | 6/6 | 6/6 | 5/6 | 2/6 | 6/6 |
| Sydney · Italian | Sydney, Blacktown City Council, New South Wales, Australia | 19/20 | 19/19 | 18/19 | 19/19 | 19/19 |
| Sydney · Chinese | (same) | 17/20 | 17/17 | 17/17 | 15/17 | 17/17 |
| Sydney · Italian + Sinatra | (same) | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 |

**Taste signal (Italian + Sinatra vs Italian, top 10):** London 1/10 shared, Toronto 1/10, Los Angeles
4/10, Chicago 5/10 (2 in the same position), Sydney 5/10, Lagos 6/6 shared but **0 in the same
position**. The signal reorders results in every city; in Lagos it can only reshuffle the same few places.

**Location fields.** Every kept place in all six cities had `properties.geocode` with `city`,
`admin1_region`, `admin2_region` and `country_code`, plus `properties.address`. Differences that matter:
- `geocode.city` is the city name in London (all London boroughs → "London"), Toronto, Los Angeles,
  Chicago and Lagos, with real suburbs where they apply (Markham, Vaughan, Mississauga; Santa Monica,
  Beverly Hills, West Hollywood; Cicero, Rosemont, Hammond in Indiana). One London place had
  `geocode.city` "Inner London - West" (metro "London").
- **Sydney:** `geocode.city` is usually the local council ("Council of the City of Sydney", "Waverley
  Council", "North Sydney Council"); only 5 of 56 sampled say "Sydney". `geocode.metro` is "Sydney" on
  all of them. So a city-only rule would mislabel central Sydney; the metro is needed.
- `geocode.metro`: present in London, Toronto (incl. Markham; null for Vaughan and Mississauga), Los
  Angeles (incl. Santa Monica, Beverly Hills; null for Universal City), Chicago (incl. Harwood Heights,
  Elmwood Park; null for Hammond, Indiana) and Sydney; **null on every Lagos place**.
- `geocode.name` (neighbourhood) is patchy: London gives boroughs ("Westminster", "London Borough of
  Tower Hamlets"), Toronto gives federal ridings ("Spadina—Fort York"), LA 14/18, Lagos 5/13. Not used
  for labels.
- Phones are E.164 everywhere: `+442073994330`, `+14165049669`, `+12133826677`, `+13124641744`,
  `+2348106800744`, `+61293659000`.

**Venue filter outside NYC.** Dropped as expected: hotels, food courts, clubs and an RSL club (Sydney),
a resort, supermarkets/hypermarkets, a cultural centre, and drink-first bars without a cuisine category
(7 of 20 Lagos Nigerian results). Kept places looked like restaurants on a name check (incl. chains such
as Chicken Republic in Lagos and Eataly in LA, whose primary genre is a restaurant genre). No rule change.

**Edge checks.** An unknown place (`Qwxzvillezz`) → **HTTP 400**
`{"errors":[{"message":"filter.location.query is unable to resolve to a valid locality.","path":"filter.location"}]}`.
`"Queens, New York City"` resolved to "Court Square, Long Island City, Queens, Queens County, New York,
New York, United States" with 11 of 20 places in Queens County (6 New York County, 3 Kings): the same
11/20 as "Queens" alone in Phase 3, so "area, city" queries work.

**Verdicts** (Good: every search ≥ 15 kept places, ≥ 90% in city/metro, phone and website on most;
Thin: fewer places or weak link coverage; Poor: little or nothing):

| City | Verdict | Why |
|---|---|---|
| London | **Good** | 18–20 kept per search, 58/58 in London (city or metro), phone 51/58, website 58/58 |
| Toronto | **Good** | 19–20 kept, 56/59 in Toronto (rest Markham/Vaughan/Mississauga), phone 57/59 |
| Los Angeles | **Good** | 18–20 kept, 56/57 in the LA metro, phone 56/57 |
| Chicago | **Good** | 16–20 kept, 55/56 in city/metro; Polish website 13/16 |
| Sydney | **Good** | 17–20 kept, 56/56 in the Sydney metro (council names in `geocode.city`) |
| Lagos | **Thin** | 6–13 kept, 7 of 20 Nigerian results were not restaurants, website 14/27 |

No city was Poor. Tested once each, on one day, with two cuisines: this says Qloo *has* restaurant data
there, not how good it is for every cuisine. Dietary/accessibility tag coverage was not measured outside NYC.

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

## Place memories: `/search` types for areas (Phase 11, live, 2026-10-29)

Three direct calls (not app searches). `GET /search?query=Victoria Island, Lagos&take=10`:
"Victoria Island" (`urn:entity:locality`), then Radisson Blu Anchorage Hotel, Four Points by
Sheraton Lagos, Lagos Oriental Hotel, Eko Hotel And Suites, Federal Palace Hotel and Casino, Landmark
Beach, SPAR Market Victoria Island, Cactus Restaurant, Terra Kulture (all `urn:entity:place`).
`GET /search?query=Lagos&take=10`: several `urn:entity:locality` and `urn:entity:destination`
results named "Lagos", plus `urn:entity:place` and `urn:entity:artist` ones. `GET /v2/insights`
(`filter.type=urn:entity:place`, `filter.location.query=Lagos`,
`filter.tags=urn:tag:cuisine:qloo:nigerian`, `take=5`) with the Lagos destination id as
`signal.interests.entities`: HTTP 200, 5 places. So a destination works as a taste signal; a
locality was not tried as one. Tastora now matches place memories only to destinations
(`docs/agent.md`).
