import { describe, expect, it } from "vitest";
import { TtlCache } from "@/lib/qloo/cache";
import { createQlooSearch, mergeByBestRank, NYC_LOCATION } from "@/lib/qloo/search";
import { makeCandidate, SAMPLES, sampleEntities } from "./helpers/fixtures";
import { fakeQloo, HOTEL, IDS } from "./helpers/fakes";

/** The 5 recorded West African places, without the hotel. */
const fakeQlooPlaces = () => sampleEntities(SAMPLES.westAfricanFela);

describe("findTags", () => {
  it("keeps only cuisine and restaurant-genre tags, in Qloo's order", async () => {
    const { search } = fakeQloo();
    expect(await search.findTags("nigerian")).toEqual([
      { id: IDS.nigerianCuisine, name: "Nigerian", family: "cuisine" },
      { id: IDS.nigerianGenre, name: "Nigerian", family: "genre" },
    ]);
  });
});

describe("findEntities", () => {
  it("filters by kind and adds a short disambiguating detail", async () => {
    const { search } = fakeQloo();
    expect(await search.findEntities("Fela Kuti", ["artist"])).toEqual([
      { id: IDS.fela, name: "Fela Kuti", kind: "artist", detail: "Nigerian multi-instrumentalist and bandleader" },
    ]);
  });

  it("drops kinds that are not taste signals (person, album)", async () => {
    const { search } = fakeQloo();
    const kinds = (await search.findEntities("Fela Kuti")).map((e) => e.kind);
    expect(kinds).toEqual(["artist"]);
  });
});

describe("searchRestaurants", () => {
  it("sends only confirmed params, with location and signals", async () => {
    const { search, calls } = fakeQloo();
    await search.searchRestaurants({ cuisineTagIds: [IDS.nigerianCuisine], location: "Brooklyn", signalEntityIds: [IDS.fela] });
    expect(calls).toEqual([
      {
        path: "/v2/insights",
        params: {
          "filter.type": "urn:entity:place",
          "filter.location.query": "Brooklyn",
          "filter.tags": IDS.nigerianCuisine,
          "signal.interests.entities": [IDS.fela],
          take: 20,
        },
      },
    ]);
  });

  it("drops non-restaurants, reports them and renumbers ranks", async () => {
    const { search } = fakeQloo({ insights: () => [HOTEL, ...fakeQlooPlaces()] });
    const r = await search.searchRestaurants({ cuisineTagIds: [IDS.nigerianCuisine], location: "Brooklyn", signalEntityIds: [IDS.fela] });
    expect(r.dropped).toEqual([{ id: "HOTEL-1", name: "Grand Test Hotel", reason: "primary genre is hotel" }]);
    expect(r.candidates.map((c) => c.qlooRank)).toEqual([1, 2, 3, 4, 5]);
    expect(r.candidates[0].name).toBe("Buka");
  });

  it("falls back from an empty genre tag to the cuisine-family tag", async () => {
    const { search, calls } = fakeQloo({
      insights: (p) => (String(p["filter.tags"]).startsWith("urn:tag:genre") ? [] : fakeQlooPlaces()),
    });
    const r = await search.searchRestaurants({ cuisineTagIds: [IDS.nigerianGenre], location: "Brooklyn" });
    expect(calls.map((c) => c.params["filter.tags"])).toEqual([IDS.nigerianGenre, IDS.nigerianCuisine]);
    expect(r.tagsUsed).toEqual([IDS.nigerianCuisine]);
    expect(r.candidates).toHaveLength(5);
    expect(r.notes[0]).toMatch(/returned nothing/);
  });

  it("retries city-wide (New York City when no fallback is given) when the location finds nothing", async () => {
    const { search } = fakeQloo({
      insights: (p) => (p["filter.location.query"] === NYC_LOCATION ? fakeQlooPlaces() : []),
    });
    const r = await search.searchRestaurants({ cuisineTagIds: [IDS.nigerianCuisine], location: "Bed-Stuy" });
    expect(r.locationUsed).toBe(NYC_LOCATION);
    expect(r.candidates).toHaveLength(5);
  });

  it("caches identical requests for 10 minutes", async () => {
    let t = 0;
    const { get, calls } = fakeQloo();
    const search = createQlooSearch({ get, cache: new TtlCache(10 * 60_000, () => t) });
    const params = { cuisineTagIds: [IDS.nigerianCuisine], location: "Brooklyn" };
    await Promise.all([search.searchRestaurants(params), search.searchRestaurants(params)]);
    await search.searchRestaurants(params);
    expect(calls).toHaveLength(1);
    expect(search.stats).toEqual({ calls: 1, cacheHits: 2 });
    t = 10 * 60_000 + 1;
    await search.searchRestaurants(params);
    expect(calls).toHaveLength(2);
  });

  it("does not cache failures", async () => {
    const { get } = fakeQloo({ fail: true });
    const search = createQlooSearch({ get, cache: new TtlCache() });
    await expect(search.findTags("x")).rejects.toThrow();
    await expect(search.findTags("x")).rejects.toThrow();
    expect(search.stats.calls).toBe(2);
  });
});

describe("mergeByBestRank", () => {
  it("keeps each place once, at its best Qloo rank", () => {
    const a = [makeCandidate({ id: "x", qlooRank: 5, name: "X from A" }), makeCandidate({ id: "y", qlooRank: 1 })];
    const b = [makeCandidate({ id: "x", qlooRank: 2, name: "X from B" })];
    const merged = mergeByBestRank([a, b]);
    expect(merged.map((c) => [c.id, c.qlooRank, c.name])).toEqual([
      ["y", 1, "Test Place"],
      ["x", 2, "X from B"],
    ]);
  });
});
