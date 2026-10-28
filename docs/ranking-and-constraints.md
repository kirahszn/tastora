# Ranking and constraints

How Tastora decides what to show, what to flag and what to hide. Code: `src/lib/constraints/`,
`src/lib/ranking/rank.ts`, `src/lib/agent/explanationFacts.ts`. Field mapping: `docs/data-model.md`.

Ground rules:
- Qloo has **no ingredients, no dish-level allergens and no texture data**. Allergy and texture
  requirements are therefore never "matched".
- Missing information is `needs_confirmation`, never safe.
- Uncertainty is flagged, not hidden. Only two things remove a venue (see Exclusions).
- Dishes are "dishes to ask about", never a confirmed menu. Nothing says or implies ordering.

## Statuses

`evaluateCandidate(profile, candidate)` returns one result per requirement:
`{ kind, requirement, status, evidence[], warnings[], supportingTags[] }`.

| Status | Meaning |
|---|---|
| `matched` | An explicit Qloo tag supports it. Diet matches are still labelled venue-level, to confirm. |
| `needs_confirmation` | No data, or data that can't prove it. The caregiver should ask the restaurant. |
| `conflict` | An explicit Qloo tag contradicts it. |

Every evidence and warning string starts with its source: `profile.<field>` or `qloo.<field>`.
`evidence[0]` always echoes the profile entry. More generally, every fact Tastora shows names its
source, which is the profile, caregiver feedback (`feedback.<field>`) or Qloo data.

## Rules

Matching is whole-word and case-insensitive, tolerating a plural `s`/`es` and space/hyphen variants:
`pea` ≠ `peanut` (both directions), `cheese` ≠ `cheesecake`.

**Allergies**: always `needs_confirmation`.
- Synonym groups (profile term → dish keywords): peanut (peanut, groundnut); tree nuts (almond, cashew,
  walnut…); shellfish (shrimp, prawn, crab, lobster, crayfish, and molluscs: clam, squid…); fish
  (salmon, tilapia…); egg; milk/dairy (cheese, butter, cream…); sesame; soy (tofu, miso…); wheat/gluten
  (bread, pasta, pizza…). "nuts" selects both peanut and tree nuts. Unknown allergies match their own word.
- Phase 5 (live profile matrix, `docs/phase5-profile-matrix.md`) extended the lists: shellfish adds
  conch, lambi, whelk, scampi, snail, escargot; "seafood" (also "mariscos", "fruits de mer") counts
  for shellfish *and* fish allergies but not for kosher conflicts; fish adds saltfish, codfish,
  bacalao, whitefish, eel…; milk adds malai, khoya, queso, feta, halloumi, labneh, kefir ("curd" is
  left out: bean curd is tofu).
- A dish naming the allergen is removed from suggestions: `mentions "peanut"`.
- **Dish-name list**: dishes commonly made with an allergen, even though the name doesn't say so. They
  are removed with `commonly made with <allergen>; recipe not verified`:

  | Allergen | Dish names |
  |---|---|
  | peanut | suya, satay, groundnut stew, maafe, mafe, domoda, pad thai, kung pao |
  | tree nuts | pesto, baklava |
  | sesame | hummus, tahini, baba ghanoush, bibimbap, japchae, kimbap, gimbap, namul, bulgogi |
  | shellfish | paella, gumbo, jambalaya |
  | milk | gulab jamun, kheer, kulfi, lassi, raita, rasmalai, rasgulla, falooda, makhani, korma, tikka masala, tzatziki, moussaka, pastitsio, alfredo, tres leches, tiramisu, cannoli |

- Each removed dish adds a warning naming it. Venue tags "Allergy friendly", plus group-specific ones
  ("Peanut free", "Gluten free", "Dairy free"…), are positive evidence only.

**Dietary restrictions**: `matched` only on an explicit `dietary_option`/`offerings` venue tag, labelled
venue-level. Dishes whose names conflict (e.g. "pork" for no-pork) are removed.
- Halal and kosher are venue-wide claims: a dish contradicting the tag ("Halal" + "Pork chops")
  downgrades to `needs_confirmation`, with a warning.
- Vegetarian, vegan, gluten-free and dairy-free tags mean "has options": the tag still matches, and meat
  or other conflicting dishes are just not suggested.
- "No pork" has no supporting tag, so it is never `matched`. Unknown "no X" or "X-free" conflicts with X.

**Texture** (only if not `none`): always `needs_confirmation`. Remaining dishes whose names suggest soft
food (soup, stew, porridge, mashed, pudding, fufu, pounded yam, amala, moi moi…) are flagged
"possibly soft — confirm".

**Comfort** (only if the caregiver set it):
- Quiet: `conflict` on noise "Loud"/"Very loud" or ambience "Noisy"; `matched` on a "Quiet" tag; else
  `needs_confirmation`. "Moderate" is neutral.
- Wheelchair: `conflict` on an explicit negative accessibility tag; `matched` on "Wheelchair accessible
  entrance"; else `needs_confirmation`. Seating or a restroom alone doesn't confirm entry.

**Dislikes**: not a requirement. Dishes naming a dislike are removed and the venue takes a ranking penalty.

## Exclusions

A candidate is removed entirely only if:
1. Qloo marks it closed (`properties.is_closed`), or
2. wheelchair access is required and an accessibility tag explicitly contradicts it. No such tag
   appeared in 216 recorded places, so this is a safeguard.

The caregiver's `notSuitable` feedback also removes a candidate. Removed candidates are returned in
`excluded` with their reasons, never ranked, and a strong Qloo rank cannot bring them back.

## Weights

`rankCandidates(profile, candidates, feedback?, { limit = 8 })`. All components are integers; the
total is their sum.

| Component | Points |
|---|---|
| Qloo taste signal (largest) | `round(50 × (maxRank − qlooRank + 1) / maxRank)`: rank 1 = 50 |
| Favourite dishes | +8 per favourite found among the dishes to ask about, max +16 |
| Comfort (only if set) | +5 per `matched`, −5 per `conflict` |
| Completeness | website +3, phone +3, hours +2, any dishes +2 (max 10) |
| Dislike penalty | −3 per removed disliked dish, max −9 |
| Allergen-heavy penalty | −8 when ≥ 50% of the venue's listed dishes were set aside for one allergen; −15 when all of them were. Once per venue (worst allergen); only for venues listing ≥ 2 dishes |
| Feedback | disliked −20; tried −3; shares a cuisine with a liked candidate +4 |
| Borough (Phase 4), NYC only | +6 same borough as the profile; −6 clearly outside New York City; else 0. Only when the profile names a borough |
| Same city (Phase 9c), other cities | +6 when Qloo's `geocode.city` or `geocode.metro` is the profile city; else 0 (never negative). Same breakdown field (`borough`, shown as "Location") |

- **Allergen-heavy penalty (Phase 3).** A venue whose menu is mostly an allergen (Brooklyn Suya:
  every dish is suya, commonly made with peanut) is a poor suggestion even though nothing excludes
  it. −8 is about one favourite dish's worth; −15 is 30% of the taste maximum, enough to drop a
  mid-list venue several places without hiding it. "Listed dishes" are the de-duplicated
  highlights + specialty dishes. The facts add a warning: "Many listed dishes here commonly contain
  <allergen>" (source: the profile allergy and the dish count).
- **Borough (Phase 4, `src/lib/domain/borough.ts`).** Qloo's `filter.location.query` is only a
  proximity bias (a Queens search returned Manhattan, Brooklyn and Nassau places), so the borough is
  ranked, never filtered. Profile: the first of Manhattan / Brooklyn / Queens / Bronx / Staten Island
  named in `profile.location` (whole word, any case, neighbourhood text allowed). Venue, by priority:
  (1) `properties.geocode.admin2_region`: New York / Kings / Queens / Bronx County, Staten Island or
  Richmond County map to boroughs; any other county, or a non-US `country_code`, is outside NYC;
  (2) the ZIP in `properties.address` (100–102 Manhattan, 103 Staten Island, 104 Bronx, 112 Brooklyn,
  111/113/114/116 and 11004–5 Queens; another state or NY ZIP is outside; 110xx is split with Nassau,
  so unknown); otherwise unknown (0). +6 is about one favourite dish's worth: it reorders close
  neighbours but can't beat a large taste gap. Facts add `area {kind, label, inRequestedBorough,
  source}` ("In Brooklyn", "Outside NYC (Nassau County)") and, in the requested borough, the reason
  "In Brooklyn, the borough you chose". Since Phase 9c the profile has `city` + optional `area`; the
  borough comes from the area (or a borough typed as the city), and this rule runs only when the city
  is New York City ("New York City", "NYC", "New York", "New York, NY", or a borough name). It is
  otherwise unchanged (`tests/location.test.ts` checks old `location: "Brooklyn"` and new
  `city: "New York City", area: "Brooklyn"` score the same).
- **Same city (Phase 9c, `src/lib/domain/location.ts`), every other city.** Built only from fields the
  coverage check found on every place (docs/qloo-findings.md, "Coverage beyond NYC"). The profile city
  is compared (lower case, accents and punctuation removed, text before any comma) with the venue's
  `properties.geocode.city`, then `geocode.metro`; the locality Qloo resolved the search to (first part
  of `query.localities.filter[0].disambiguation`) also counts as a name for the city, so "LA" matches
  "Los Angeles". Venue city matches → +6, label "In London", reason "In London, the city you chose";
  metro matches → +6, "In the Sydney area" (Sydney's `geocode.city` is usually a council name; LA
  suburbs such as Santa Monica have metro "Los Angeles"); another `geocode.city` → 0, "Nearby:
  Markham"; no geocode city → 0 and no label (nothing is guessed). +6 is the same weight as a borough
  match. Ranks, never filters. `area.kind` is `same_city` / `same_metro` / `nearby` / `unknown`, with
  `inRequestedCity`. Tested on the live samples in `tests/location.test.ts`.
- **Taste decay (verified Phase 3).** Over a 20-result list the linear formula gives rank 1 = 50,
  rank 10 = 28, rank 20 = 3, with steps of 2–3 points between neighbours (no cliff). Kept as is;
  locked by a test.

- The taste signal uses Qloo's rank rather than raw affinity. Affinities cluster (0.80–0.85 in a
  cuisine-filtered list), search results have none, and Qloo already sorts by it.
- A dish removed for an allergy or diet never counts as a favourite match.
- Ties are broken by score (desc), then `qlooRank` (asc), then `id` (asc).

## Explanation facts

`buildExplanationFacts(profile, ranked, { tasteSignals? })` returns structured facts only, with no prose:

| Field | Content |
|---|---|
| `reasons[] {text, source, strength?}` | Source names the profile field and the Qloo tag or signal, e.g. `profile.favouriteCuisines: Nigerian ↔ Qloo tag urn:tag:cuisine:qloo:nigerian`. `strength: "related"` marks a weaker, related-cuisine reason |
| `dishesToAskAbout[] {name, source, note?}` | After allergy/diet/dislike removals; favourites first; `note: "possibly soft — confirm"` |
| `removedDishes[] {name, source, reason, requirement, why}` | What was removed, and why |
| `warnings[] {text, source}` | Venue-level cautions, e.g. the allergen-heavy warning above |
| `constraintStatuses` | The `evaluateCandidate` results |
| `needsConfirmation[]` | Plain questions for the caregiver to ask the restaurant |
| `links` | `website` / `phone` / `mapsUrl`, only when present |
| `scoreBreakdown` | Components plus `total` |

`tasteSignals` defaults to all profile taste memories; the search layer should pass the signals it
actually sent.

**Related cuisines** (`src/lib/domain/cuisines.ts`). When a venue lacks the favourite cuisine's
tag but carries a related one, a lower-weight reason follows the direct cuisine reasons:
"West African — related to Nigerian" (`strength: "related"`). It never filters or scores. The map
lists only obvious country → regional-family links, and members are not related to each other:

| Family | Members |
|---|---|
| West African | Nigerian, Ghanaian, Senegalese |
| Caribbean | Jamaican, Trinidadian, Haitian |
| Italian | Italian-American |

## Worked example

Profile: Nigerian food, favourite dish jollof rice, peanut allergy, soft texture, music Fela Kuti,
Brooklyn. Candidates: recorded sample `E5h-west-african-signal-fela.json` (West African filter + Fela
Kuti signal, 5 places). Nothing is excluded. Locked in `tests/explanation-facts.test.ts`.

| # | Venue | Taste | Fav. dish | Comfort | Complete | Dislike | Allergen | Feedback | Borough | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Buka | 50 | 8 | 0 | 10 | 0 | 0 | 0 | 6 | **74** |
| 2 | Joloff | 40 | 0 | 0 | 10 | 0 | 0 | 0 | 6 | **56** |
| 3 | Accra Express Restaurant | 30 | 8 | 0 | 10 | 0 | 0 | 0 | 0 (Manhattan) | **48** |
| 4 | Cafe Rue Dix | 20 | 0 | 0 | 10 | 0 | 0 | 0 | 6 | 36 |
| 5 | Brooklyn Suya | 10 | 0 | 0 | 10 | 0 | −15 | 0 | 6 | 11 |

**Constraint statuses.** All five venues have the same two: `allergy: peanut` → `needs_confirmation`
and `texture: soft food` → `needs_confirmation`.

**Buka**
- Reasons:
  - Qloo taste rank #1 with signals: Fela Kuti (affinity 0.85)
  - Serves Nigerian food (`urn:tag:cuisine:qloo:nigerian`)
  - Lists Jollof rice, a favourite (`urn:tag:menu_highlight:qloo:jollof_rice`)
- Dishes to ask about: Jollof rice; Pounded yam, Amala, Moi moi, Pepper soup, Fufu (possibly soft —
  confirm); Grilled tilapia, Nkwobi, Akara, Ewa agoyin, Fried rice.
- Removed: **Suya** (commonly made with peanut; recipe not verified).

**Joloff**
- Reasons: Qloo taste rank #2 with signals: Fela Kuti (affinity 0.83). Its cuisine tags are West
  African and Senegalese, not Nigerian, so there is no direct cuisine reason; it gets the related
  reason "West African — related to Nigerian" (Phase 3).
- Dishes to ask about: Tiebou jeun.
- Removed: none.

**Accra Express Restaurant**
- Reasons: Qloo taste rank #3 (affinity 0.83); lists Jollof rice, a favourite. Ghanaian, not Nigerian.
- Dishes to ask about: Jollof rice; Okra soup, Fufu, Egusi soup, Palmnut soup, Pepper soup (possibly
  soft — confirm); Turkey tail, Waakye, Baked tilapia.
- Removed: **Peanut soup** (mentions "peanut").

**Further down the list**
- Cafe Rue Dix (#4) loses Mafe (commonly made with peanut).
- Brooklyn Suya (#5) loses every dish: 7 suya dishes, plus "Peanut aeoli" by keyword. Its facts say
  "Every dish Qloo lists was set aside; ask what they can serve that fits", it takes the −15
  allergen-heavy penalty and carries the warning "Many listed dishes here commonly contain peanut".

**Needs confirmation (all five):**
- "Ask whether dishes can be made without peanut (Qloo has no allergen data)"
- "Ask which dishes are soft food"
