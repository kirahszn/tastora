import { describe, expect, it } from "vitest";
import {
  locationNotices,
  PLANNER_FALLBACK_NOTICE,
  sameName,
  tasteMemoryNotice,
  unusedTasteMemories,
} from "@/lib/agent/notices";
import { recommend } from "@/lib/agent/recommend";
import type { QlooParams } from "@/lib/qloo/client";
import { TtlCache } from "@/lib/qloo/cache";
import { createQlooSearch } from "@/lib/qloo/search";
import { fakeQloo, IDS } from "./helpers/fakes";
import { makeProfile, SAMPLES, sampleEntities } from "./helpers/fixtures";

describe("sameName", () => {
  it("tolerates small typos, accents, case and extra words", () => {
    expect(sameName("Fela Kutti", "Fela Kuti")).toBe(true);
    expect(sameName("vicente fernandez", "Vicente Fernández")).toBe(true);
    expect(sameName("Sinatra", "Frank Sinatra")).toBe(true);
  });

  it("does not match different names", () => {
    expect(sameName("The Flatbush Porch Rockers", "Eastwest Rockers")).toBe(false);
    expect(sameName("Teresa Teng", "Tina Turner")).toBe(false);
    expect(sameName("Al", "Alicia Keys")).toBe(false); // whole words only
  });
});

describe("notices", () => {
  const profile = makeProfile({ tasteMemories: { music: ["Fela Kutti", "Teresa Teng"], films: ["Living in Bondage"] } });

  it("lists taste memories that no signal used", () => {
    const unused = unusedTasteMemories(profile, [{ id: "1", name: "Fela Kuti", kind: "artist" }]);
    expect(unused).toEqual(["Teresa Teng", "Living in Bondage"]);
    expect(tasteMemoryNotice(unused)).toBe(
      "Tastora couldn't find clear matches for “Teresa Teng”, “Living in Bondage” on Qloo, so they didn't shape these results.",
    );
    expect(tasteMemoryNotice(["Teresa Teng"])).toBe(
      "Tastora couldn't find a clear match for “Teresa Teng” on Qloo, so it didn't shape these results.",
    );
    expect(tasteMemoryNotice([])).toBeNull();
  });

  it("turns the city-wide retry note into plain words, ignoring other notes", () => {
    expect(
      locationNotices(['No places found for "Paris"; searched New York City instead', "Genre tag x returned nothing; used y"]),
    ).toEqual(["No places were found for “Paris”, so Tastora searched all of New York City."]);
  });
});

describe("recommend notices (fakes, no live calls)", () => {
  it("falls back to the related cuisine when nothing is found, and says so", async () => {
    const WEST_AFRICAN = "urn:tag:cuisine:qloo:west_african";
    const base = fakeQloo();
    const get = async (path: string, params: QlooParams) => {
      if (path === "/v2/tags" && params["filter.query"] === "West African") {
        return { success: true, results: { tags: [{ id: WEST_AFRICAN, name: "West African", type: "urn:tag:cuisine:qloo" }] } };
      }
      if (path === "/v2/insights") {
        const tags = String(params["filter.tags"]);
        return { success: true, results: { entities: tags.includes(WEST_AFRICAN) ? sampleEntities(SAMPLES.westAfricanFela) : [] } };
      }
      return base.get(path, params);
    };
    const search = createQlooSearch({ get, cache: new TtlCache() });
    const profile = makeProfile({ favouriteCuisines: ["Nigerian"], tasteMemories: { music: ["Fela Kuti"] }, location: "Brooklyn" });

    const res = await recommend(profile, {}, { search, anthropic: null });

    expect(res.results.length).toBeGreaterThan(0);
    expect(res.notices).toEqual([
      PLANNER_FALLBACK_NOTICE,
      "No Nigerian restaurants were found near Brooklyn, so Tastora is showing West African restaurants instead.",
    ]);
    expect(res.trace.some((s) => s.tool === "find_cuisine_tags" && s.inputSummary === "'West African'")).toBe(true);
    // The related search keeps the taste signal and becomes the evidence baseline.
    expect(res.evidence?.signalsUsed.map((s) => s.id)).toEqual([IDS.fela]);
    expect(res.evidence?.personalisedTop10.length).toBeGreaterThan(0);
  });

  it("adds no notices on an ordinary agent-free run where everything matched", async () => {
    const { search } = fakeQloo();
    const profile = makeProfile({ favouriteCuisines: ["Nigerian"], tasteMemories: { music: ["Fela Kuti"] } });
    const res = await recommend(profile, {}, { search, anthropic: null });
    expect(res.notices).toEqual([PLANNER_FALLBACK_NOTICE]);
  });
});
