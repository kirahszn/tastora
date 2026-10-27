# Phase 5 profile matrix

Ten realistic profiles through the live pipeline (Claude planner → Qloo → Phase 2 checks), run
2026-10-27 with `npm run matrix` (`scripts/profile-matrix.ts`, budget-capped). Summary only; no raw
Qloo responses are stored. Rows marked † are from the re-run after the fixes below.

**Usage:** 10 matrix runs + 5 re-runs = 15 full searches; 52 Qloo calls (cache shared within a
run) + 1 `/search` lookup to inspect a venue's genre; 45 Anthropic requests.

## Results

| # | Profile | Planner | Latency | Results | Top 3 | Tags / entities resolved | Evidence (same of 10 / moved) | Statuses seen |
|---|---|---|---|---|---|---|---|---|
| 1† | Caribbean, oxtail, shellfish allergy, Bob Marley, Bronx | agent | 12.1 s | 8 | Triple Deuce Restaurant & Grill / Fish N' Ting / Ripe Kitchen & Bar | Caribbean (genre); Bob Marley (artist) | 0 / 10 | shellfish: needs confirmation |
| 2† | Cantonese + Chinese, dim sum, congee, easy to chew, Teresa Teng, Chinatown | agent | 7.9 s | 8 | Nom Wah Tea Parlor / Golden Unicorn / Wo Hop | Chinese, Cantonese (genres); **Teresa Teng: no artist found** | 10 / 0 (no signal) | texture: needs confirmation |
| 3 | Jewish deli, matzo ball soup, kosher, Barbra Streisand, Manhattan | agent | 6.2 s | 8 | Sarge's Delicatessen / Barney Greengrass / Mr. Broadway | Jewish Deli (cuisine); Barbra Streisand (artist) | 6 / 9 | kosher: matched on 5 (venue-level tag), needs confirmation on 3 |
| 4† | Indian, dal, vegetarian, dairy allergy, Lata Mangeshkar, Jackson Heights | agent | 7.0 s | 8 | Raja Sweets & Fast Food / Himalayan Yak / Taste of Lahore | Indian (genre); Lata Mangeshkar (artist) | 5 / 10 | dairy: needs confirmation; vegetarian: matched (venue tag) |
| 5 | Mexican, pozole, no restrictions, Vicente Fernández, Bronx | agent | 6.3 s | 8 | Cocina Chente / Made In Mexico / Boca Restaurant and Lounge | Mexican (genre); Vicente Fernández (artist) | 4 / 9 | none set |
| 6† | Korean, soft tofu stew, sesame allergy, soft texture, Brooklyn | agent | 6.6 s | 8 | Insa / Fat Buddha / Golden Diner | Korean (genre) | 10 / 0 (no memories given) | sesame, texture: needs confirmation |
| 7 | Greek, moussaka, wheelchair + quiet, Astoria | agent | 6.6 s | 8 | Bel Aire Diner / The Grand / Omonia Cafe | Greek (genre) | 10 / 0 (no memories given) | wheelchair: matched; quiet: **conflict** on 3 (Qloo "Loud" tags), needs confirmation on 5 |
| 8 | Polish, pierogi, Greenpoint, no taste memories | agent | 5.3 s | 8 | Karczma / Pierozek / Amber Steak House | Polish (genre) | 10 / 0 (no memories given) | none set |
| 9 | Misspelt "Nigeran", "Fela Kutti", Brooklyn | agent | 6.0 s | 8 | Buka / Brooklyn Suya / DF Nigerian Food Truck | Claude corrected both: Nigerian (cuisine), Fela Kuti (artist) | 10 / 7 | none set |
| 10† | Haitian + unknown band "The Flatbush Porch Rockers", Brooklyn | agent | 6.5 s | 8 | BK9 / Bamboo Walk Caribbean / Grandchamps | Haitian (genre); band → Qloo offered "Eastwest Rockers", **Claude did not use it** | 10 / 0 (no signal) | none set |

Every profile resolved its cuisine and returned 8 results. No invented IDs: misspellings were
corrected by Claude before lookup, and the unknown band's weak match was not used.

## Problems found and fixed

| Problem (first run) | Fix | Re-run result |
|---|---|---|
| **Non-restaurant leak:** Smorgasburg Williamsburg ranked #1 for #6. Its primary genre is `restaurant:food_court`, which is inside the restaurant namespace | `venueFilter.ts` rule 3 drops multi-vendor genres (`food_court`): no single kitchen to ask about allergens | Gone; "6 non-restaurants dropped" (was 5). Top 3 now all Korean restaurants |
| **Shellfish misses (#1):** "Seafood platter", "Seafood buckets" kept | `seafood` / `mariscos` / `fruits de mer` now count for shellfish *and* fish allergies (kept out of the kosher conflict list so fish dishes don't downgrade a kosher tag). Added conch, lambi, whelk, scampi, snail, escargot; paella / gumbo / jambalaya as "commonly made with" | Seafood platter set aside. Remaining flag "Escovitch fish" is fish, correctly kept for a shellfish allergy |
| **Dairy misses (#4):** gulab jamun, kheer mohan, ras malai, malai, falooda kulfi kept | Ingredient words: malai, khoya, queso, feta, halloumi, labneh, kefir… "Commonly made with milk": gulab jamun, kheer, kulfi, lassi, raita, rasmalai, makhani, korma, tikka masala, tzatziki, moussaka… ("curd" left out: bean curd is tofu) | 0 possible misses |
| **Sesame misses (#6):** japchae, bibimbap, bulgogi kept | "Commonly made with sesame": bibimbap, japchae, kimbap/gimbap, namul, bulgogi, baba ghanoush | 0 possible misses (Insa: japchae and bibimbap set aside) |
| **Silent taste memories (#2, #10):** the evidence panel said "No taste memories were used" though the caregiver had entered one | New `notices` in the response, shown as "About this search": "Tastora couldn't find a clear match for “Teresa Teng” on Qloo, so it didn't shape these results." Fuzzy matching, so a typo Claude corrected (Fela Kutti) is not reported | Notice shown on #2 and #10, not on #9 |
| **Cuisine with no results** (not hit live; Qloo's location is a soft bias, so 0 results is rare) | If every search is empty, Tastora tries the cuisine's family once through the same session (ID rule and limits apply): "No Haitian restaurants were found near Brooklyn, so Tastora is showing Caribbean restaurants instead." | Covered by a fake-Qloo test (`tests/notices.test.ts`) |

"Possible misses" were found with a deliberately broader watch-list than the engine's (in the
script), then reviewed by hand.

## Qloo data limitations (documented, not fixed)

- **Teresa Teng** is not found as an artist by Qloo search, so Cantonese results get no taste signal.
- **Cuisine tags on venues can be odd:** "Aunts et Uncles" (a Caribbean vegan café) is tagged
  Sushi / Steakhouse and appears for both Korean and Haitian searches; "99 Favor Taste" shows up as Chinese.
- **Location is a bias, not a filter:** #1 includes three Westchester places (labelled "Outside NYC
  (Westchester County)" and ranked −6); Mexican/Bronx returns several Manhattan places.
- **Venue-level diet tags** (Kosher, Vegetarian) are shown as matched but always "venue-level; confirm".
- **Taste-signal strength varies:** Bob Marley replaced the whole Caribbean top 10 (0/10 shared),
  Fela Kuti only re-ordered Nigerian places (10/10 shared, 7 moved).
