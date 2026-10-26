# Phase 3 smoke test

Live run of `npm run smoke:recommend` on 2026-10-26: Claude planner → Qloo search → Phase 2
evaluate/rank/facts. Summary only; no raw Qloo responses are stored.

**Totals:** 8 Qloo calls (budget 40), 6 Anthropic requests (budget 10).

Notes added after the run (the code changed afterwards; the run was not repeated, to stay within budget):
- `rankChanges` was added to the evidence after this run. From the tables below: profile A has 7
  of 10 personalised places in a different position from the baseline; profile B has 10 of 10.
- The trace now also shows the locality Qloo resolved. A separate diagnostic call (1 Qloo call)
  confirmed "Queens" resolves to Queens County, but results are only biased towards it. That
  explains the Midtown and Upper East Side places for profile B (see `docs/qloo-findings.md`).

## Profile A — Nigerian, Brooklyn

- Planner: **agent** (claude-sonnet-5-5)
- Latency: **7.3 s**; Qloo calls: 4 (+0 cache hits); Anthropic requests: 3
- Results: 8 shown, 0 excluded

### Top 5

| # | Restaurant | Area | Score | Reasons | Cautions |
|---|---|---|---|---|---|
| 1 | Buka | Bedford-Stuyvesant | 68 | Qloo ranked it #1 for this person's tastes; Serves Nigerian food; Lists Jollof rice, a favourite dish | Suya set aside (commonly made with peanut; recipe not verified) |
| 2 | DF Nigerian Food Truck | Turtle Bay | 58 | Qloo ranked it #3 for this person's tastes; Serves Nigerian food; Lists Jollof rice, a favourite dish | Suya set aside (commonly made with peanut; recipe not verified) |
| 3 | Festac NYC | East New York | 50 | Qloo ranked it #4 for this person's tastes; Serves Nigerian food; Lists Jollof rice efo riro, a favourite dish | Suya set aside (commonly made with peanut; recipe not verified) |
| 4 | The Green Place | Bedford-Stuyvesant | 48 | Qloo ranked it #5 for this person's tastes; Serves Nigerian food; Lists Jollof rice, a favourite dish | — |
| 5 | Brooklyn Suya | Crown Heights | 40 | Qloo ranked it #2 for this person's tastes; Serves Nigerian food | Many listed dishes here commonly contain peanut; Tofu suya bowl set aside (commonly made with peanut; recipe not verified); Eggplant suya bowl set aside (commonly made with peanut; recipe not verified); Shrimp suya bowl set aside (commonly made with peanut; recipe not verified) |

### Trace

| Step | Tool | Input | Result | ms |
|---|---|---|---|---|
| 1 | claude | turn 1 | Requested find_cuisine_tags, find_taste_entities | 2154 |
| 2 | find_taste_entities | 'Fela Kuti' as artist | Found 'Fela Kuti' (artist) | 1817 |
| 3 | find_cuisine_tags | 'Nigerian' | Found 'Nigerian' (cuisine), 'Nigerian' (genre) | 1845 |
| 4 | claude | turn 2 | Requested search_restaurants | 1524 |
| 5 | search_restaurants | Nigerian restaurants in Brooklyn with 1 taste signal (Fela Kuti) | 10 places, 0 non-restaurants dropped | 841 |
| 6 | claude | turn 3 | Finished (end_turn) | 867 |
| 7 | planner | Claude | Planned 1 search(es) in 3 turn(s); ended by end_turn | 0 |
| 8 | rank | 10 unique places from 1 search(es) | Checked against the person's needs: 8 shown, 0 excluded | 63 |
| 9 | baseline | Nigerian without taste signals | 10/10 of the personalised top 10 also in the baseline top 10 | 0 |

### With vs without taste signals

- Cuisine tag(s): `urn:tag:cuisine:qloo:nigerian`
- Signals: Fela Kuti (artist)
- **Top-10 overlap: 10/10**

| # | Personalised | Baseline |
|---|---|---|
| 1 | Buka | Buka |
| 2 | Brooklyn Suya | Pitanga |
| 3 | DF Nigerian Food Truck | The Green Place |
| 4 | Festac NYC | Festac NYC |
| 5 | The Green Place | Brooklyn Suya |
| 6 | Pitanga | Fingerlicking restaurant inc |
| 7 | Naira Bread | Naira Bread |
| 8 | Fingerlicking restaurant inc | DF Nigerian Food Truck |
| 9 | African Pride | Dept. of Culture |
| 10 | Dept. of Culture | African Pride |

## Profile B — Italian-American, Queens

- Planner: **agent** (claude-sonnet-5-5)
- Latency: **5.3 s**; Qloo calls: 4 (+0 cache hits); Anthropic requests: 3
- Results: 8 shown, 0 excluded

### Top 5

| # | Restaurant | Area | Score | Reasons | Cautions |
|---|---|---|---|---|---|
| 1 | Chazz Palminteri Italian Restaurant | Midtown | 65 | Qloo ranked it #1 for this person's tastes; Italian — related to Italian-American; Venue tag: Wheelchair accessible entrance | comfort: wheelchair access: matched |
| 2 | Lenny's Clam Bar | Howard Beach | 60 | Qloo ranked it #3 for this person's tastes; Italian — related to Italian-American; Venue tag: Wheelchair accessible entrance | comfort: wheelchair access: matched |
| 3 | Quality Italian | Midtown | 60 | Qloo ranked it #6 for this person's tastes; Italian — related to Italian-American; Lists Chicken Parm Pizza, a favourite dish; Venue tag: Wheelchair accessible entrance | comfort: wheelchair access: matched |
| 4 | Nicola's | Upper East Side | 57 | Qloo ranked it #2 for this person's tastes; Italian — related to Italian-American | — |
| 5 | Bella Blu | Lenox Hill | 57 | Qloo ranked it #4 for this person's tastes; Italian — related to Italian-American; Venue tag: Wheelchair accessible entrance | comfort: wheelchair access: matched |

### Trace

| Step | Tool | Input | Result | ms |
|---|---|---|---|---|
| 1 | claude | turn 1 | Requested find_cuisine_tags, find_taste_entities | 1416 |
| 2 | find_cuisine_tags | 'Italian-American' | Found 'Italian American' (cuisine), 'Italian American' (genre), 'Italian-American Fusion' (cuisine), 'Italian-American Soul Food' (cuisine), 'American Italian' (cuisine), 'American Italian Fusion' (cuisine) | 323 |
| 3 | find_taste_entities | 'Frank Sinatra' as artist | Found 'Frank Sinatra' (artist) | 356 |
| 4 | claude | turn 2 | Requested search_restaurants | 1334 |
| 5 | search_restaurants | Italian American restaurants in Queens with 1 taste signal (Frank Sinatra) | 19 places, 1 non-restaurant dropped | 1069 |
| 6 | claude | turn 3 | Finished (end_turn) | 1118 |
| 7 | planner | Claude | Planned 1 search(es) in 3 turn(s); ended by end_turn | 0 |
| 8 | rank | 19 unique places from 1 search(es) | Checked against the person's needs: 8 shown, 0 excluded | 24 |
| 9 | baseline | Italian American without taste signals | 4/10 of the personalised top 10 also in the baseline top 10 | 0 |

### With vs without taste signals

- Cuisine tag(s): `urn:tag:cuisine:qloo:italian_american`
- Signals: Frank Sinatra (artist)
- **Top-10 overlap: 4/10**

| # | Personalised | Baseline |
|---|---|---|
| 1 | Chazz Palminteri Italian Restaurant | Quality Italian |
| 2 | Nicola's | Luigi's Restaurant And Bar |
| 3 | Lenny's Clam Bar | San Marzano |
| 4 | Bella Blu | Lenny's Clam Bar |
| 5 | Patrizia's Of Manhattan | Martha’s Country Bakery |
| 6 | Quality Italian | Bamonte's |
| 7 | Gotham Pizza | Rosa's Pizza |
| 8 | Paul & Jimmy’s Ristorante | Trattoria 35 |
| 9 | Rosa's Pizza | Giorgio's of Gramercy |
| 10 | Allora | Patrizia's Of Manhattan |
