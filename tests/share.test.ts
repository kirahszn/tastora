import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildShareText,
  SHARE_DISCLAIMER,
  SHARE_TEXT_LIMIT,
  SITE_URL,
  shareHeading,
  topReason,
  whatsappUrl,
} from "@/lib/ui/share";
import {
  clearShortlist,
  defaultShortlist,
  initialShortlist,
  loadShortlist,
  resultSetKey,
  saveShortlist,
  SHORTLIST_KEY,
  toggleShortlist,
  type KeyValueStore,
} from "@/lib/ui/storage";
import type { RecommendResult } from "@/lib/ui/types";

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

function result(id: string, rank: number, extra: Partial<RecommendResult> = {}): RecommendResult {
  return {
    candidateId: id,
    name: `Place ${id.toUpperCase()}`,
    rank,
    reasons: [
      { text: `Qloo ranked it #${rank + 4} for this person's tastes`, source: "x" },
      { text: "Serves Italian-American food", source: "x" },
    ],
    dishesToAskAbout: [
      { name: "Chicken Parm", source: "qloo.dishHighlights" },
      { name: "Meatballs", source: "qloo.dishHighlights" },
      { name: "Polenta", source: "qloo.specialtyDishes", note: "possibly soft — confirm" },
      { name: "Lasagna", source: "qloo.dishHighlights" },
    ],
    removedDishes: [
      { name: "Pork Chop", source: "qloo.dishHighlights", reason: "diet", requirement: "no pork", why: "contains pork" },
    ],
    warnings: [],
    constraintStatuses: [],
    needsConfirmation: [
      "Ask which dishes are made without pork",
      "Confirm wheelchair access, including the entrance",
      "Confirm opening hours (none listed)",
      "Ask how quiet it is at the time you plan to visit",
    ],
    area: { kind: "borough", label: "In Queens", inRequestedBorough: true, source: "qloo.properties.geocode" },
    links: {
      phone: "+1 718-555-0100",
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=Place+${id}&query_place_id=ChIJ${id}`,
    },
    scoreBreakdown: {
      taste: 31,
      favouriteDishes: 17,
      comfort: 0,
      completeness: 4,
      dislikePenalty: 0,
      allergenPenalty: 0,
      feedback: 0,
      borough: 5,
      total: 57,
    },
    venue: { address: "1 Main St, Queens, NY", neighborhood: "Astoria", priceLevel: 2, rating: 4.5, cuisines: ["Italian"] },
    ...extra,
  } as RecommendResult;
}

const results = [result("a", 1), result("b", 2), result("c", 3), result("d", 4)];

describe("buildShareText", () => {
  it("follows the shortlist sequence and skips unknown ids", () => {
    const text = buildShareText(results, ["c", "zzz", "a"]);
    expect(text.indexOf("1. Place C")).toBeGreaterThan(-1);
    expect(text.indexOf("2. Place A")).toBeGreaterThan(text.indexOf("1. Place C"));
    expect(text).not.toContain("Place B");
  });

  it("uses the name in the heading only when there is one", () => {
    expect(buildShareText(results, ["a"], "Mum").split("\n")[0]).toBe("Restaurant ideas for Mum from Tastora");
    expect(buildShareText(results, ["a"]).split("\n")[0]).toBe("Restaurant ideas from Tastora");
    expect(shareHeading("   ")).toBe("Restaurant ideas from Tastora");
  });

  it("lays out one place from its facts", () => {
    const text = buildShareText(results, ["a"], "Dad");
    expect(text).toBe(
      [
        "Restaurant ideas for Dad from Tastora",
        "",
        "1. Place A — Astoria · In Queens",
        "Why: Serves Italian-American food",
        "Dishes to ask about: Chicken Parm, Meatballs, Polenta (possibly soft — confirm)",
        "Ask them:",
        "- Ask which dishes are made without pork",
        "- Confirm wheelchair access, including the entrance",
        "- Confirm opening hours (none listed)",
        "- and 1 more thing to check",
        "Phone: +1 718-555-0100",
        "Map: https://www.google.com/maps/search/?api=1&query=Place+a&query_place_id=ChIJa",
        "",
        SHARE_DISCLAIMER,
        SITE_URL,
      ].join("\n"),
    );
  });

  it("never includes set-aside dishes, scores or the Qloo rank", () => {
    const text = buildShareText(results, ["a", "b", "c"]);
    expect(text).not.toContain("Pork Chop");
    expect(text).not.toMatch(/\b57\b|\b31\b|score|ranked it/i);
    expect(text).not.toContain("Lasagna"); // 4th dish: at most three
  });

  it("includes warnings and conflicts from the facts", () => {
    const r = result("w", 1, {
      warnings: [{ text: "Many listed dishes here commonly contain peanut", source: "x" }],
      constraintStatuses: [
        { requirement: "comfort: quiet", kind: "comfort", status: "conflict", evidence: [], warnings: [] },
      ] as unknown as RecommendResult["constraintStatuses"],
    });
    const text = buildShareText([r], ["w"]);
    expect(text).toContain("Note: Many listed dishes here commonly contain peanut");
    expect(text).toContain("Conflict: Comfort: quiet");
  });

  it("always ends with the disclaimer and the site link, even with nothing chosen", () => {
    for (const ids of [[], ["a", "b", "c"]]) {
      expect(buildShareText(results, ids).endsWith(`${SHARE_DISCLAIMER}\n${SITE_URL}`)).toBe(true);
    }
  });

  it("stays within the limit for three places and trims detail before dropping places", () => {
    const three = buildShareText(results, ["a", "b", "c"]);
    expect(three.length).toBeLessThanOrEqual(SHARE_TEXT_LIMIT);
    expect(three).toContain("3. Place C");
    expect(three).toContain("Ask them:");

    const many = Array.from({ length: 10 }, (_, i) => result(`p${i}`, i + 1));
    const text = buildShareText(many, many.map((r) => r.candidateId));
    expect(text.length).toBeLessThanOrEqual(SHARE_TEXT_LIMIT);
    expect(text).toMatch(/And \d+ more places? on the shortlist\./);
    expect(text).toContain(SHARE_DISCLAIMER);
  });

  it("picks a favourite dish or cuisine as the top reason, not the Qloo rank or a venue tag", () => {
    expect(topReason(results[0])).toBe("Serves Italian-American food");
    const reasons = [
      { text: "Qloo ranked it #2 for this person's tastes", source: "profile.tasteMemories ↔ x" },
      { text: "Venue tag: Wheelchair accessible entrance", source: "profile.comfort ↔ x" },
      { text: "Italian — related to Italian-American", source: "profile.favouriteCuisines: x", strength: "related" as const },
      { text: "Lists Chicken Parm, a favourite dish", source: "profile.favouriteDishes: chicken parm ↔ x" },
    ];
    expect(topReason({ reasons })).toBe("Lists Chicken Parm, a favourite dish");
    expect(topReason({ reasons: reasons.slice(0, 3) })).toBe("Italian — related to Italian-American");
    expect(topReason({ reasons: reasons.slice(0, 2) })).toBe("Venue tag: Wheelchair accessible entrance");
    expect(topReason({ reasons: [{ text: "Only", source: "x" }] })).toBe("Only");
    expect(topReason({ reasons: [] })).toBeNull();
  });

  it("drops unsafe links and unusable phone numbers", () => {
    const r = result("x", 1, { links: { phone: "call us", mapsUrl: "javascript:alert(1)" } });
    const text = buildShareText([r], ["x"]);
    expect(text).not.toContain("Phone:");
    expect(text).not.toContain("javascript");
  });

  it("builds a WhatsApp click-to-chat link with the text URL-encoded", () => {
    const url = whatsappUrl("Ideas for Mum & Dad\n1. Café #1 — 50% off?");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url.slice("https://wa.me/?text=".length)).not.toMatch(/[\s#&?]/);
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("Ideas for Mum & Dad\n1. Café #1 — 50% off?");
    expect(new URL(url).searchParams.get("text")).toBe("Ideas for Mum & Dad\n1. Café #1 — 50% off?");
  });

  it("produces text without safety claims or ordering language", () => {
    const text = buildShareText(results, ["a", "b", "c"], "Mum");
    expect(text).not.toMatch(/\b(safe|safely|allergen[\s-]free|guaranteed?|verified[\s-]safe)\b/i);
    expect(text).not.toMatch(/\b(order(s|ed|ing)?|buy(s|ing)?|checkout|purchase|cart)\b/i);
  });
});

describe("shortlist storage", () => {
  it("starts with the top three and saves them", () => {
    const store = memoryStore();
    expect(defaultShortlist(results)).toEqual(["a", "b", "c"]);
    expect(initialShortlist(results, store)).toEqual(["a", "b", "c"]);
    expect(JSON.parse(store.data[SHORTLIST_KEY])).toEqual({ resultSet: "a|b|c|d", ids: ["a", "b", "c"] });
  });

  it("keeps the caregiver's picks, including an empty shortlist, in rank sequence", () => {
    const store = memoryStore();
    let ids = toggleShortlist(results, ["a", "b", "c"], "b");
    ids = toggleShortlist(results, ids, "d");
    ids = toggleShortlist(results, ids, "b");
    expect(ids).toEqual(["a", "b", "c", "d"]);
    saveShortlist(results, [], store);
    expect(initialShortlist(results, store)).toEqual([]);
  });

  it("ignores corrupted JSON, the wrong shape and blocked storage", () => {
    expect(loadShortlist(results, memoryStore({ [SHORTLIST_KEY]: "{oops" }))).toBeNull();
    expect(loadShortlist(results, memoryStore({ [SHORTLIST_KEY]: '{"ids":"a"}' }))).toBeNull();
    expect(loadShortlist(results, null)).toBeNull();
    const throwing: KeyValueStore = {
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
    expect(initialShortlist(results, throwing)).toEqual(["a", "b", "c"]);
    expect(() => clearShortlist(throwing)).not.toThrow();
  });

  it("treats a shortlist saved for another result set as stale", () => {
    const store = memoryStore();
    saveShortlist([results[0], results[1]], ["b"], store);
    expect(loadShortlist(results, store)).toBeNull();
    expect(initialShortlist(results, store)).toEqual(["a", "b", "c"]);
    expect(resultSetKey(results)).toBe("a|b|c|d");
  });

  it("drops ids that aren't in the results and clears on request", () => {
    const store = memoryStore({ [SHORTLIST_KEY]: JSON.stringify({ resultSet: "a|b|c|d", ids: ["d", "gone", "a"] }) });
    expect(loadShortlist(results, store)).toEqual(["a", "d"]);
    clearShortlist(store);
    expect(store.data).toEqual({});
  });
});

describe("share and print copy", () => {
  const files = ["src/lib/ui/share.ts", "src/app/results/ShortlistBar.tsx", "src/app/results/print/PrintView.tsx"];

  it("is covered by the UI copy scans (they read src/app and src/lib/ui)", () => {
    for (const f of files) expect(readFileSync(join(process.cwd(), f), "utf8").length).toBeGreaterThan(0);
  });

  it("print page shows the disclaimer and a checkbox per question", () => {
    const src = readFileSync(join(process.cwd(), "src/app/results/print/PrintView.tsx"), "utf8");
    expect(src).toContain("SHARE_DISCLAIMER");
    expect(src).toContain("Before you go — questions to ask");
    expect(src).toContain("☐");
    expect(src).toContain("window.print()");
  });
});
