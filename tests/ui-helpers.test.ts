import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cityAreaLabel, coverageNotice, searchLocation } from "@/lib/domain/location";
import { SeniorProfileSchema } from "@/lib/domain/profile";
import { plainStep, priceLabel, ratingLabel, signed, toolLabel } from "@/lib/ui/format";
import { safeHttpUrl, telHref } from "@/lib/ui/links";
import { createNdjsonParser, NdjsonError, readNdjson } from "@/lib/ui/ndjson";
import { EXAMPLES, emptyDraft, exampleById, profileToDraft, validateDraft } from "@/lib/ui/profileDraft";
import { droppedOut, evidenceSentence, joinList, movementLabel, rankMovement } from "@/lib/ui/rankMovement";
import { ERROR_COPY, requestBody, runSearch, SearchError } from "@/lib/ui/searchClient";
import { cuisineArtFor, qlooImageUrl } from "@/lib/ui/cuisineArt";
import { compactNeeds, displayStatus, needName, needZones, requirementLabel, splitSource, STATUS_DISPLAY } from "@/lib/ui/status";
import {
  FEEDBACK_KEY,
  LAST_SEARCH_KEY,
  loadFeedback,
  loadLastSearch,
  loadProfile,
  PROFILE_KEY,
  saveFeedback,
  saveLastSearch,
  saveProfile,
  setVerdict,
  toRankingFeedback,
  type KeyValueStore,
} from "@/lib/ui/storage";
import type { RecommendResponse, RequirementStatus } from "@/lib/ui/types";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const profile = SeniorProfileSchema.parse({ favouriteCuisines: ["Nigerian"], location: "Brooklyn", displayName: "Mum" });

/** Every landing file with visible copy (Phase 10); the copy scans below must cover each one. */
const LANDING_COPY = [
  "Hero.tsx",
  "HeroPreview.tsx",
  "Problem.tsx",
  "SeeItWork.tsx",
  "SeeItWorkDemo.tsx",
  "Sieve.tsx",
  "HowItWorks.tsx",
  "QlooProof.tsx",
  "proofStats.ts",
  "Rules.tsx",
  "Closing.tsx",
  "Photo.tsx",
  "Section.tsx",
];

describe("status display", () => {
  it("maps each status to an icon and a text label, never colour alone", () => {
    expect(STATUS_DISPLAY.matched).toEqual({ label: "Matched", icon: "check", tone: "ok" });
    expect(STATUS_DISPLAY.needs_confirmation).toEqual({ label: "Needs confirmation", icon: "question", tone: "warn" });
    expect(STATUS_DISPLAY.conflict).toEqual({ label: "Conflict", icon: "cross", tone: "bad" });
    for (const s of Object.values(STATUS_DISPLAY)) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.icon).toBeTruthy();
    }
  });

  it("never shows an allergy or texture as matched", () => {
    expect(displayStatus({ kind: "allergy", status: "matched" }).label).toBe("Needs confirmation");
    expect(displayStatus({ kind: "texture", status: "matched" }).label).toBe("Needs confirmation");
    expect(displayStatus({ kind: "allergy", status: "conflict" }).label).toBe("Conflict");
    expect(displayStatus({ kind: "diet", status: "matched" }).label).toBe("Matched");
    expect(displayStatus({ kind: "comfort", status: "matched" }).label).toBe("Matched");
  });

  it("compacts needs into Matched and Conflict lines and one 'To confirm' line (Phase 11)", () => {
    const need = (kind: "allergy" | "diet" | "texture" | "comfort", requirement: string, status: RequirementStatus) => ({
      kind,
      requirement,
      status,
    });
    const statuses = [
      need("allergy", "allergy: Shellfish", "needs_confirmation"),
      need("allergy", "allergy: Sesame", "needs_confirmation"),
      need("allergy", "allergy: Soy", "needs_confirmation"),
      need("diet", "diet: Halal", "matched"),
      need("diet", "diet: Dairy-free", "needs_confirmation"),
      need("texture", "texture: easy to chew", "needs_confirmation"),
      need("comfort", "comfort: quiet place", "needs_confirmation"),
      need("comfort", "comfort: wheelchair access", "conflict"),
    ];
    const c = compactNeeds(statuses);
    expect(c.matched.map((s) => s.requirement)).toEqual(["diet: Halal"]);
    expect(c.conflicts.map((s) => s.requirement)).toEqual(["comfort: wheelchair access"]);
    expect(c.toConfirm).toBe("shellfish, sesame and soy allergies · dairy-free · easy to chew · quiet place");
    expect(compactNeeds([need("allergy", "allergy: peanut", "needs_confirmation")]).toConfirm).toBe("peanut allergy");
    expect(compactNeeds([]).toConfirm).toBeNull();
  });

  it("never puts an allergy or texture need in the Matched line, whatever the engine says", () => {
    const c = compactNeeds([
      { kind: "allergy", requirement: "allergy: peanut", status: "matched" as RequirementStatus },
      { kind: "texture", requirement: "texture: soft food", status: "matched" as RequirementStatus },
    ]);
    expect(c.matched).toEqual([]);
    expect(c.toConfirm).toBe("peanut allergy · soft food");
  });

  it("lists safety zones with allergies grouped first and only ever in To confirm (Phase 12)", () => {
    const z = needZones([
      { kind: "comfort", requirement: "comfort: wheelchair access", status: "matched" as RequirementStatus },
      { kind: "texture", requirement: "texture: soft food", status: "matched" as RequirementStatus },
      { kind: "allergy", requirement: "allergy: peanut", status: "matched" as RequirementStatus },
      { kind: "allergy", requirement: "allergy: Sesame", status: "needs_confirmation" as RequirementStatus },
      { kind: "diet", requirement: "diet: no pork", status: "conflict" as RequirementStatus },
    ]);
    expect(z.matched.map(needName)).toEqual(["Wheelchair access"]);
    expect(z.conflicts.map(needName)).toEqual(["No pork"]);
    expect(z.confirm).toEqual(["peanut and sesame allergies", "soft food"]);
  });

  it("picks a cuisine illustration from the venue's own cuisine tags, first match wins", () => {
    expect(cuisineArtFor(["Italian", "Barbecue", "Seafood"])).toBe("italian");
    expect(cuisineArtFor(["Bar", "West african", "Nigerian"])).toBe("westAfrican");
    expect(cuisineArtFor(["Jamaican"])).toBe("caribbean");
    expect(cuisineArtFor(["Szechuan"])).toBe("chinese");
    expect(cuisineArtFor(["South Asian"])).toBe("indian");
    expect(cuisineArtFor(["Tex-Mex"])).toBe("mexican");
    expect(cuisineArtFor(["Sushi"])).toBe("japanese");
    expect(cuisineArtFor(["Korean"])).toBe("korean");
    expect(cuisineArtFor(["Lebanese"])).toBe("middleEastern");
    expect(cuisineArtFor(["Diner"])).toBe("plate");
    expect(cuisineArtFor([])).toBe("plate");
  });

  it("only uses images from Qloo's own https host", () => {
    const url = "https://images.qloo.com/i/6B4B5F78-B40C-478B-BB40-990A8548887F-420x-auto.jpg";
    expect(qlooImageUrl(url)).toBe(url);
    expect(qlooImageUrl("http://images.qloo.com/i/x.jpg")).toBeNull();
    expect(qlooImageUrl("https://example.com/food.jpg")).toBeNull();
    expect(qlooImageUrl("javascript:alert(1)")).toBeNull();
    expect(qlooImageUrl(null)).toBeNull();
  });

  it("formats requirement labels and splits sources", () => {
    expect(requirementLabel("allergy: peanut")).toBe("Allergy: peanut");
    expect(splitSource('qloo.dishHighlights: "Suya" commonly made with peanut')).toEqual({
      source: "qloo.dishHighlights",
      text: '"Suya" commonly made with peanut',
    });
    expect(splitSource("feedback.notSuitable: caregiver marked it not suitable")).toEqual({
      source: "feedback.notSuitable",
      text: "caregiver marked it not suitable",
    });
    expect(splitSource("Plain text")).toEqual({ source: null, text: "Plain text" });
  });
});

describe("format and links", () => {
  it("formats price, rating and signed scores", () => {
    expect(priceLabel(2)).toEqual({ symbols: "$$", text: "Price level 2 of 4" });
    expect(priceLabel(null)).toBeNull();
    expect(priceLabel(7)).toBeNull();
    expect(ratingLabel(4.46)).toEqual({ short: "4.5 ★", text: "Rated 4.5 out of 5" });
    expect(ratingLabel(null)).toBeNull();
    expect([signed(6), signed(-15), signed(0)]).toEqual(["+6", "−15", "0"]);
    expect(toolLabel("search_restaurants")).toBe("Searched restaurants");
    expect(toolLabel("something_new")).toBe("something_new");
  });

  it("turns each trace step into plain words for the searching screen (Phase 11)", () => {
    const plain = (tool: string, inputSummary: string, resultSummary: string) =>
      plainStep({ tool, inputSummary, resultSummary });
    expect(plain("claude", "turn 1", "Requested find_cuisine_tags, find_taste_entities")).toEqual({
      title: "Planning the search",
    });
    expect(plain("claude", "turn 2", "Requested search_restaurants").title).toBe("The AI planner chose the next lookups");
    expect(plain("find_cuisine_tags", "'Nigerian'", "Found 'Nigerian' (cuisine), 'Nigerian' (genre)")).toEqual({
      title: "Looked up the Nigerian cuisine",
    });
    expect(plain("find_taste_entities", "'Davido' as artist", "Found 'Davido' (artist) and 2 other matches")).toEqual({
      title: "Looked up a taste memory: Davido (artist)",
    });
    expect(plain("find_taste_entities", "'Victoria Island, Lagos' as place", "No area found")).toEqual({
      title: "Looked up a taste memory: Victoria Island, Lagos",
      detail: "No clear match on Qloo, so it won't be used",
    });
    expect(
      plain(
        "search_restaurants",
        "Nigerian restaurants in Lagos with 2 taste signals (Davido, Burna Boy)",
        "18 places, 1 non-restaurant dropped; location resolved to Lagos, Nigeria",
      ),
    ).toEqual({ title: "Searching Nigerian restaurants near Lagos with 2 taste signals", detail: "18 places found" });
    expect(plain("rank", "18 unique places from 1 search(es)", "Checked against the person's needs: 16 shown, 2 excluded")).toEqual({
      title: "Checking every place against their needs",
      detail: "16 to show, 2 left out",
    });
    expect(plain("planner", "Claude", "Planned 1 search(es) in 3 turn(s); ended by end_turn").title).toBe(
      "The AI planner planned 1 restaurant search",
    );
    expect(plain("search_restaurants", "", "Rejected: Unknown id(s): x").title).toMatch(/^Skipped a step/);
    expect(plain("find_cuisine_tags", "", "Qloo request failed (500)").title).toMatch(/^A Qloo request didn't work/);
    expect(plain("something_new", "x", "y")).toEqual({ title: "something_new" });
  });

  it("uses no tool names, ids or 'turn' jargon in plain steps", () => {
    const samples: [string, string, string][] = [
      ["claude", "turn 1", "Requested find_cuisine_tags, find_taste_entities"],
      ["claude", "turn 3", "Finished (end_turn)"],
      ["planner", "built-in plan", "Searching with Tastora's built-in plan instead (no Anthropic API key configured)"],
      ["baseline", "Nigerian without taste signals", "8/10 of the personalised top 10 also in the baseline top 10"],
    ];
    for (const [tool, inputSummary, resultSummary] of samples) {
      const p = plainStep({ tool, inputSummary, resultSummary });
      expect(`${p.title} ${p.detail ?? ""}`).not.toMatch(/find_|search_restaurants|turn \d|end_turn|urn:/);
    }
  });

  it("only allows http(s) links and clean tel: hrefs", () => {
    expect(safeHttpUrl("https://buka.example/menu")).toBe("https://buka.example/menu");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(telHref("+1 (718) 555-0100")).toBe("tel:+17185550100");
    expect(telHref("718-555-0100")).toBe("tel:7185550100");
    expect(telHref("call us")).toBeNull();
  });
});

describe("rank movement", () => {
  const p = (id: string) => ({ id, name: id.toUpperCase() });
  const baseline = ["a", "b", "c", "d", "e"].map(p);
  const personalised = ["c", "a", "x", "b", "e"].map(p);

  it("computes up, down, same and new against the baseline", () => {
    expect(rankMovement(baseline, personalised).map((r) => [r.id, r.rank, r.baselineRank, r.movement])).toEqual([
      ["c", 1, 3, { kind: "up", by: 2 }],
      ["a", 2, 1, { kind: "down", by: 1 }],
      ["x", 3, null, { kind: "new" }],
      ["b", 4, 2, { kind: "down", by: 2 }],
      ["e", 5, 5, { kind: "same" }],
    ]);
  });

  it("lists places that left the top 10, and labels movement for sight and screen readers", () => {
    expect(droppedOut(baseline, personalised).map((x) => x.id)).toEqual(["d"]);
    expect(movementLabel({ kind: "up", by: 3 })).toEqual({ symbol: "↑3", text: "up 3 places" });
    expect(movementLabel({ kind: "down", by: 1 })).toEqual({ symbol: "↓1", text: "down 1 place" });
    expect(movementLabel({ kind: "new" })).toEqual({ symbol: "new", text: "new in the top 10" });
    expect(movementLabel({ kind: "same" }).text).toBe("same position");
  });

  it("handles empty lists", () => {
    expect(rankMovement([], [])).toEqual([]);
    expect(rankMovement([], [p("a")])[0].movement).toEqual({ kind: "new" });
  });
});

describe("evidence sentence", () => {
  const top = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const sig = (name: string) => ({ id: name, name, kind: "artist" as const });
  const ev = (overlapCount: number, rankChanges: number, signals = [sig("Frank Sinatra")], n = 10) =>
    ({ signalsUsed: signals, personalisedTop10: top(n), overlapCount, rankChanges }) as Parameters<typeof evidenceSentence>[0];

  it("is computed from the evidence numbers", () => {
    // The Sinatra figures in README: 4 of 10 shared, all 10 moved.
    expect(evidenceSentence(ev(4, 10))).toBe("Frank Sinatra brought in 6 new places and moved all 10.");
    expect(evidenceSentence(ev(9, 3))).toBe("Frank Sinatra brought in 1 new place and moved 3 of the 10.");
    expect(evidenceSentence(ev(10, 7, [sig("Fela Kuti")]))).toBe("Fela Kuti brought in no new places but moved 7 of the 10.");
    expect(evidenceSentence(ev(10, 0))).toBe("Frank Sinatra didn't change Qloo's top 10.");
    expect(evidenceSentence(ev(2, 6, [sig("A"), sig("B")], 6))).toBe("A and B brought in 4 new places and moved all 6.");
  });

  it("says nothing without signals or places", () => {
    expect(evidenceSentence(ev(4, 10, []))).toBeNull();
    expect(evidenceSentence(ev(0, 0, undefined, 0))).toBeNull();
    expect(joinList(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("NDJSON parser", () => {
  it("parses lines split across chunks and skips blank lines", () => {
    const parser = createNdjsonParser();
    expect(parser.push('{"type":"step","st')).toEqual([]);
    expect(parser.push('ep":1}\n\n{"type":')).toEqual([{ type: "step", step: 1 }]);
    expect(parser.push('"result"}\n')).toEqual([{ type: "result" }]);
    expect(parser.flush()).toEqual([]);
  });

  it("parses a final line without a trailing newline, and rejects malformed lines", () => {
    const parser = createNdjsonParser();
    parser.push('{"a":1}');
    expect(parser.flush()).toEqual([{ a: 1 }]);
    expect(() => createNdjsonParser().push("{oops}\n")).toThrow(NdjsonError);
  });

  it("reads a byte stream, including multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode('{"name":"Phở Bằng"}\n{"n":2}');
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, 11)); // splits inside "ở"
        c.enqueue(bytes.slice(11));
        c.close();
      },
    });
    const seen: unknown[] = [];
    await readNdjson(stream, (e) => seen.push(e));
    expect(seen).toEqual([{ name: "Phở Bằng" }, { n: 2 }]);
  });
});

describe("storage", () => {
  it("round-trips the profile under tastora.profile.v1", () => {
    const store = memoryStore();
    expect(saveProfile(profile, store)).toBe(true);
    expect(Object.keys(store.data)).toEqual([PROFILE_KEY]);
    expect(PROFILE_KEY).toBe("tastora.profile.v1");
    expect(loadProfile(store)).toEqual(profile);
  });

  it("returns null or empty for corrupted, invalid or blocked storage", () => {
    expect(loadProfile(memoryStore({ [PROFILE_KEY]: "{not json" }))).toBeNull();
    expect(loadProfile(memoryStore({ [PROFILE_KEY]: JSON.stringify({ favouriteCuisines: [] }) }))).toBeNull();
    expect(loadProfile(memoryStore({ [PROFILE_KEY]: "null" }))).toBeNull();
    expect(loadProfile(throwingStore)).toBeNull();
    expect(loadProfile(null)).toBeNull();
    expect(saveProfile(profile, throwingStore)).toBe(false);
    expect(loadFeedback(memoryStore({ [FEEDBACK_KEY]: "]]" }))).toEqual({ entries: {} });
    expect(loadFeedback(memoryStore({ [FEEDBACK_KEY]: '{"entries":{"x":{"verdict":"maybe","name":"X"}}}' }))).toEqual({
      entries: {},
    });
    expect(loadFeedback(throwingStore)).toEqual({ entries: {} });
    expect(loadLastSearch(profile, memoryStore({ [LAST_SEARCH_KEY]: "{" }))).toBeNull();
  });

  it("stores feedback verdicts and turns them into the API's feedback body", () => {
    const store = memoryStore();
    let fb = loadFeedback(store);
    fb = setVerdict(fb, "a", "Buka", "liked");
    fb = setVerdict(fb, "b", "Joloff", "notSuitable");
    fb = setVerdict(fb, "c", "Suya", "tried");
    fb = setVerdict(fb, "c", "Suya", "disliked"); // changing a verdict replaces it
    fb = setVerdict(fb, "a", "Buka", null); // clearing removes it
    saveFeedback(fb, store);
    expect(FEEDBACK_KEY).toBe("tastora.feedback.v1");
    expect(toRankingFeedback(loadFeedback(store))).toEqual({ notSuitable: ["b"], disliked: ["c"] });
    expect(toRankingFeedback({ entries: {} })).toEqual({});
  });

  it("caps each feedback list at the server's limit of 50", () => {
    let fb = { entries: {} } as ReturnType<typeof loadFeedback>;
    for (let i = 0; i < 60; i++) fb = setVerdict(fb, `id${i}`, `P${i}`, "tried");
    const tried = toRankingFeedback(fb).tried!;
    expect(tried).toHaveLength(50);
    expect(tried.at(-1)).toBe("id59");
  });

  it("only reuses the last search for the same profile", () => {
    const store = memoryStore();
    const response = { results: [], excluded: [], trace: [], evidence: null, meta: {} } as unknown as RecommendResponse;
    saveLastSearch(profile, response, store);
    expect(loadLastSearch(profile, store)).toEqual(response);
    expect(loadLastSearch({ ...profile, area: "Queens" }, store)).toBeNull();
  });
});

describe("profile draft", () => {
  it("validates with the shared Zod schema and gives kind, field-level messages", () => {
    const result = validateDraft(emptyDraft());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.favouriteCuisines).toBe("Add at least one cuisine they love.");
    expect(result.errors.city).toBe("Type the city they'd like to eat in, for example London.");
    const long = validateDraft({ ...EXAMPLES[0].draft, favouriteDishes: ["x".repeat(81)] });
    expect(long.ok === false && long.errors.favouriteDishes).toBe("One of these entries is too long. Please shorten it.");
  });

  it("validates the city and area: required, trimmed, length-limited", () => {
    const base = exampleById("london").draft;
    const blank = validateDraft({ ...base, city: "   " });
    expect(blank.ok === false && blank.errors.city).toBe("Type the city they'd like to eat in, for example London.");
    const longCity = validateDraft({ ...base, city: "x".repeat(61) });
    expect(longCity.ok === false && longCity.errors.city).toBe("Please keep the city to 60 characters or fewer.");
    const longArea = validateDraft({ ...base, area: "x".repeat(61) });
    expect(longArea.ok === false && longArea.errors.area).toBe("Please keep the area to 60 characters or fewer.");
    const trimmed = validateDraft({ ...base, city: "  Toronto ", area: "  " });
    expect(trimmed.ok && trimmed.profile).toMatchObject({ city: "Toronto" });
    expect(trimmed.ok && trimmed.profile).not.toHaveProperty("area");
  });

  it("lists the Sinatra (Queens) example first, then Fela (Brooklyn) and London", () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(["sinatra", "fela", "london"]);
  });

  it("builds the example profiles exactly as specified", () => {
    const [a, b, c] = [exampleById("fela"), exampleById("sinatra"), exampleById("london")].map((e) => validateDraft(e.draft));
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;
    expect(a.profile).toMatchObject({
      favouriteCuisines: ["Nigerian"],
      favouriteDishes: ["jollof rice"],
      allergies: ["peanut"],
      texture: "soft",
      tasteMemories: { music: ["Fela Kuti"] },
      city: "New York City",
      area: "Brooklyn",
    });
    expect(b.profile).toMatchObject({
      favouriteCuisines: ["Italian-American"],
      favouriteDishes: ["chicken parm"],
      dietaryRestrictions: ["no pork"],
      comfort: { wheelchairAccess: true },
      tasteMemories: { music: ["Frank Sinatra"] },
      city: "New York City",
      area: "Queens",
    });
    expect(c.profile).toMatchObject({
      favouriteCuisines: ["Indian"],
      favouriteDishes: ["dal"],
      dietaryRestrictions: ["vegetarian"],
      comfort: { quietPreferred: true },
      tasteMemories: { music: ["Lata Mangeshkar"] },
      city: "London",
    });
    // The NYC examples send Qloo the same location text as before Phase 9c.
    expect([a, b, c].map((r) => searchLocation(r.profile))).toEqual(["Brooklyn", "Queens", "London"]);
  });

  it("round-trips the city and area through the draft", () => {
    const r = validateDraft({ ...exampleById("fela").draft, area: "Bed-Stuy, Brooklyn" });
    expect(r.ok && r.profile).toMatchObject({ city: "New York City", area: "Bed-Stuy, Brooklyn" });
    if (!r.ok) return;
    expect(profileToDraft(r.profile)).toMatchObject({ city: "New York City", area: "Bed-Stuy, Brooklyn" });
    const { area: _area, ...noArea } = r.profile;
    void _area;
    expect(profileToDraft(noArea)).toMatchObject({ city: "New York City", area: "" });
  });

  it("never sends the display name", () => {
    expect(requestBody(profile).profile).not.toHaveProperty("displayName");
    expect(requestBody(profile, {})).not.toHaveProperty("feedback");
    expect(requestBody(profile, { tried: ["x"] }).feedback).toEqual({ tried: ["x"] });
  });
});

describe("runSearch", () => {
  const result = { results: [], excluded: [], trace: [], evidence: null, meta: {} };
  const ndjson = (lines: unknown[]) =>
    new Response(lines.map((l) => JSON.stringify(l)).join("\n"), {
      headers: { "content-type": "application/x-ndjson" },
    });
  const body = requestBody(profile);

  it("reports streamed steps, then returns the result", async () => {
    const steps: unknown[] = [];
    const fetchImpl = vi.fn(async () => ndjson([{ type: "step", step: { step: 1 } }, { type: "result", result }]));
    await expect(runSearch(body, { fetchImpl, onStep: (s) => steps.push(s) })).resolves.toEqual(result);
    expect(steps).toEqual([{ step: 1 }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]).toEqual(["/api/recommend?stream=1", expect.anything()]);
  });

  it("falls back to JSON mode once when the stream breaks", async () => {
    const onFallback = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{broken\n", { headers: { "content-type": "application/x-ndjson" } }))
      .mockResolvedValueOnce(Response.json(result));
    await expect(runSearch(body, { fetchImpl, onFallback })).resolves.toEqual(result);
    expect(onFallback).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[1][0]).toBe("/api/recommend");
  });

  it("doesn't re-run the search when the stream breaks after progress arrived", async () => {
    const onFallback = vi.fn();
    const fetchImpl = vi.fn(async () =>
      new Response('{"type":"step","step":{"step":1}}\n', { headers: { "content-type": "application/x-ndjson" } }),
    );
    const err = await runSearch(body, { fetchImpl, onFallback }).catch((e) => e);
    expect(err).toBeInstanceOf(SearchError);
    expect(err.kind).toBe("upstream");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("does not retry real HTTP errors or streamed upstream errors", async () => {
    for (const [res, kind] of [
      [Response.json({ error: "x", fieldErrors: [{ path: "profile.location", message: "bad" }] }, { status: 400 }), "invalid"],
      [Response.json({ error: "slow down" }, { status: 429 }), "rate_limited"],
      [ndjson([{ type: "error", status: 502, error: "x" }]), "upstream"],
    ] as const) {
      const fetchImpl = vi.fn(async () => res);
      const err = await runSearch(body, { fetchImpl }).catch((e) => e);
      expect(err).toBeInstanceOf(SearchError);
      expect(err.kind).toBe(kind);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      if (kind === "invalid") expect(err.fieldErrors).toEqual([{ path: "profile.location", message: "bad" }]);
    }
  });

  it("reports offline when the network fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const err = await runSearch(body, { fetchImpl }).catch((e) => e);
    expect(err.kind).toBe("offline");
  });

  it("doesn't fall back after the caller cancels", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const err = await runSearch(body, { fetchImpl, signal: controller.signal }).catch((e) => e);
    expect(err.name).toBe("AbortError");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("UI copy", () => {
  const roots = ["src/app", "src/components", "src/lib/ui"];
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "api" ? [] : files(path);
      return /\.(tsx?|css)$/.test(name) ? [path] : [];
    });
  const all = roots.flatMap((r) => files(join(process.cwd(), r)));

  it("scans the UI source", () => {
    expect(all.some((f) => f.endsWith("ResultCard.tsx"))).toBe(true);
    expect(all.some((f) => f.endsWith("ProfileForm.tsx"))).toBe(true);
    // Landing copy (Phase 10), including the "never call one safe" and rules claims.
    for (const name of LANDING_COPY) {
      expect(all.some((f) => f.endsWith(join("_landing", name)))).toBe(true);
    }
  });

  it("never claims food is safe (only negated forms like \"never shown as safe\")", () => {
    // UI source plus the server modules whose strings reach the screen.
    const copyFiles = [
      ...all.filter((f) => /\.tsx?$/.test(f)),
      ...[
        "src/lib/agent/explanationFacts.ts",
        "src/lib/agent/notices.ts",
        "src/lib/constraints/evaluate.ts",
        // Phase 9c: coverage note, "In <city>" labels and the location-not-found message.
        "src/lib/domain/location.ts",
        "src/app/api/recommend/route.ts",
      ].map((f) => join(process.cwd(), f)),
    ];
    const unsafe = /\b(safe|safely|allergen[\s-]free|guaranteed?|guarantees|verified[\s-]safe)\b/gi;
    const negation = /\b(not|never|no|can['’]t|cannot|isn['’]t|don['’]t|won['’]t|without)\b[^.;:]{0,40}$/i;
    const hits: string[] = [];
    for (const file of copyFiles) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(unsafe)) {
        const before = text.slice(Math.max(0, m.index - 60), m.index);
        if (!negation.test(before)) hits.push(`${file.split(/[\\/]/).slice(-2).join("/")}: …${before.slice(-30)}${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("the unsafe-claim check catches a positive claim and allows a negated one", () => {
    const unsafe = /\b(safe|allergen[\s-]free|guaranteed?)\b/i;
    const negation = /\b(not|never|no|can['’]t|cannot)\b[^.;:]{0,40}$/i;
    const flagged = (s: string) => {
      const m = unsafe.exec(s);
      return !!m && !negation.test(s.slice(0, m.index));
    };
    expect(flagged("This dish is safe for her")).toBe(true);
    expect(flagged("Guaranteed allergen-free")).toBe(true);
    expect(flagged("Tastora can't confirm it's safe")).toBe(false);
    expect(flagged("never shown as safe")).toBe(false);
  });

  it("has no NYC-only wording in the public copy (Phase 9c)", () => {
    const publicCopy = [...LANDING_COPY.map((n) => `_landing/${n}`), "layout.tsx", "shareCard.tsx", "../components/NavMenu.tsx"];
    const nycOnly = /\b(in NYC|NYC only|New York restaurants|NYC restaurants|caregivers in NYC|borough)\b/i;
    for (const name of publicCopy) {
      const text = readFileSync(join(process.cwd(), "src/app", name), "utf8");
      expect({ name, hit: text.match(nycOnly)?.[0] ?? null }).toEqual({ name, hit: null });
    }
    const hero = readFileSync(join(process.cwd(), "src/app/_landing/Hero.tsx"), "utf8");
    expect(hero).toContain(">For caregivers<");
    expect(hero).toContain("Find restaurants that fit their taste");
    expect(readFileSync(join(process.cwd(), "src/app/_landing/HowItWorks.tsx"), "utf8")).toContain("Qloo ranks restaurants near them by taste");
    expect(readFileSync(join(process.cwd(), "src/app/_landing/QlooProof.tsx"), "utf8")).toContain(
      "From Tastora&rsquo;s test searches in New York City, October 2026.",
    );
  });

  it("keeps the new location copy free of safety claims and ordering language", () => {
    const copy = [
      coverageNotice("Lagos"),
      cityAreaLabel({ kind: "same_city", city: "London", source: "" }),
      cityAreaLabel({ kind: "same_metro", metro: "Sydney", source: "" }),
      cityAreaLabel({ kind: "nearby", place: "Markham", source: "" }),
      ERROR_COPY.location_not_found.title,
      ERROR_COPY.location_not_found.body,
    ].join("\n");
    expect(copy).not.toMatch(/\b(safe|safely|allergen[\s-]free|guaranteed?|verified[\s-]safe)\b/i);
    expect(copy).not.toMatch(/\b(order(s|ed|ing)?|buy(s|ing)?|checkout|purchase|cart)\b/i);
  });

  it("never uses ordering language (order, buy, checkout)", () => {
    for (const file of all) {
      // CSS can't hold copy except `content:`; check only those lines there.
      const text = file.endsWith(".css")
        ? readFileSync(file, "utf8")
            .split("\n")
            .filter((l) => l.includes("content:"))
            .join("\n")
        : readFileSync(file, "utf8");
      expect({ file, hit: text.match(/\b(order(s|ed|ing)?|buy(s|ing)?|checkout|check[\s-]out|purchase|cart)\b/i)?.[0] ?? null }).toEqual({
        file,
        hit: null,
      });
    }
  });
});
