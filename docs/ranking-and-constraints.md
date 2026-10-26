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
`evidence[0]` always echoes the profile entry.

## Rules

Matching is whole-word and case-insensitive, tolerating a plural `s`/`es` and space/hyphen variants:
`pea` ≠ `peanut` (both directions), `cheese` ≠ `cheesecake`.

**Allergies**: always `needs_confirmation`.
- Synonym groups (profile term → dish keywords): peanut (peanut, groundnut); tree nuts (almond, cashew,
  walnut…); shellfish (shrimp, prawn, crab, lobster, crayfish, and molluscs: clam, squid…); fish
  (salmon, tilapia…); egg; milk/dairy (cheese, butter, cream…); sesame; soy (tofu, miso…); wheat/gluten
  (bread, pasta, pizza…). "nuts" selects both peanut and tree nuts. Unknown allergies match their own word.
- A dish naming the allergen is removed from suggestions: `mentions "peanut"`.
- **Dish-name list**: dishes commonly made with an allergen, even though the name doesn't say so. They
  are removed with `commonly made with <allergen>; recipe not verified`:

  | Allergen | Dish names |
  |---|---|
  | peanut | suya, satay, groundnut stew, maafe, mafe, domoda, pad thai, kung pao |
  | tree nuts | pesto, baklava |
  | sesame | hummus, tahini |

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
| Feedback | disliked −20; tried −3; shares a cuisine with a liked candidate +4 |

- The taste signal uses Qloo's rank rather than raw affinity. Affinities cluster (0.80–0.85 in a
  cuisine-filtered list), search results have none, and Qloo already sorts by it.
- A dish removed for an allergy or diet never counts as a favourite match.
- Ties are broken by score (desc), then `qlooRank` (asc), then `id` (asc).

## Explanation facts

`buildExplanationFacts(profile, ranked, { tasteSignals? })` returns structured facts only, with no prose:

| Field | Content |
|---|---|
| `reasons[] {text, source}` | Source names the profile field and the Qloo tag or signal, e.g. `profile.favouriteCuisines: Nigerian ↔ Qloo tag urn:tag:cuisine:qloo:nigerian` |
| `dishesToAskAbout[] {name, source, note?}` | After allergy/diet/dislike removals; favourites first; `note: "possibly soft — confirm"` |
| `removedDishes[] {name, source, reason, requirement, why}` | What was removed, and why |
| `constraintStatuses` | The `evaluateCandidate` results |
| `needsConfirmation[]` | Plain questions for the caregiver to ask the restaurant |
| `links` | `website` / `phone` / `mapsUrl`, only when present |
| `scoreBreakdown` | Components plus `total` |

`tasteSignals` defaults to all profile taste memories; the search layer should pass the signals it
actually sent.

## Worked example

Profile: Nigerian food, favourite dish jollof rice, peanut allergy, soft texture, music Fela Kuti,
Brooklyn. Candidates: recorded sample `E5h-west-african-signal-fela.json` (West African filter + Fela
Kuti signal, 5 places). Nothing is excluded. Locked in `tests/explanation-facts.test.ts`.

| # | Venue | Taste | Fav. dish | Comfort | Complete | Dislike | Feedback | **Total** |
|---|---|---|---|---|---|---|---|---|
| 1 | Buka | 50 | 8 | 0 | 10 | 0 | 0 | **68** |
| 2 | Joloff | 40 | 0 | 0 | 10 | 0 | 0 | **50** |
| 3 | Accra Express Restaurant | 30 | 8 | 0 | 10 | 0 | 0 | **48** |
| 4 | Cafe Rue Dix | 20 | 0 | 0 | 10 | 0 | 0 | 30 |
| 5 | Brooklyn Suya | 10 | 0 | 0 | 10 | 0 | 0 | 20 |

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
  African and Senegalese, not Nigerian, so there is no cuisine reason.
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
  "Every dish Qloo lists was set aside; ask what they can serve that fits".

**Needs confirmation (all five):**
- "Ask whether dishes can be made without peanut (Qloo has no allergen data)"
- "Ask which dishes are soft food"
