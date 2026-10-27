import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SeniorProfileSchema } from "@/lib/domain/profile";
import { priceLabel, ratingLabel, signed, toolLabel } from "@/lib/ui/format";
import { safeHttpUrl, telHref } from "@/lib/ui/links";
import { createNdjsonParser, NdjsonError, readNdjson } from "@/lib/ui/ndjson";
import { EXAMPLES, emptyDraft, profileToDraft, validateDraft } from "@/lib/ui/profileDraft";
import { droppedOut, movementLabel, rankMovement } from "@/lib/ui/rankMovement";
import { requestBody, runSearch, SearchError } from "@/lib/ui/searchClient";
import { displayStatus, requirementLabel, splitSource, STATUS_DISPLAY } from "@/lib/ui/status";
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
import type { RecommendResponse } from "@/lib/ui/types";

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
    expect(loadLastSearch({ ...profile, location: "Queens" }, store)).toBeNull();
  });
});

describe("profile draft", () => {
  it("validates with the shared Zod schema and gives kind, field-level messages", () => {
    const result = validateDraft(emptyDraft());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.favouriteCuisines).toBe("Add at least one cuisine they love.");
    expect(result.errors.borough).toBe("Choose the borough you'd like to eat in.");
    const long = validateDraft({ ...EXAMPLES[0].draft, favouriteDishes: ["x".repeat(81)] });
    expect(long.ok === false && long.errors.favouriteDishes).toBe("One of these entries is too long. Please shorten it.");
  });

  it("builds the two example profiles exactly as specified", () => {
    const [a, b] = EXAMPLES.map((e) => validateDraft(e.draft));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.profile).toMatchObject({
      favouriteCuisines: ["Nigerian"],
      favouriteDishes: ["jollof rice"],
      allergies: ["peanut"],
      texture: "soft",
      tasteMemories: { music: ["Fela Kuti"] },
      location: "Brooklyn",
    });
    expect(b.profile).toMatchObject({
      favouriteCuisines: ["Italian-American"],
      favouriteDishes: ["chicken parm"],
      dietaryRestrictions: ["no pork"],
      comfort: { wheelchairAccess: true },
      tasteMemories: { music: ["Frank Sinatra"] },
      location: "Queens",
    });
  });

  it("composes and splits the location", () => {
    const r = validateDraft({ ...EXAMPLES[0].draft, neighbourhood: "Bed-Stuy" });
    expect(r.ok && r.profile.location).toBe("Bed-Stuy, Brooklyn");
    if (!r.ok) return;
    expect(profileToDraft(r.profile)).toMatchObject({ borough: "Brooklyn", neighbourhood: "Bed-Stuy" });
    expect(profileToDraft({ ...r.profile, location: "Brooklyn" })).toMatchObject({ borough: "Brooklyn", neighbourhood: "" });
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
