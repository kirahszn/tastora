// Hotfix (2026-10-29): Qloo's location is a bias, not a boundary. Live, "Benin city" resolved to
// the locality "Mexico City, Cuauhtémoc, Mexico City, Mexico" and every Caribbean result was in
// Mexico City. Far venues are excluded with a reason; NYC behaviour is unchanged.
import { describe, expect, it } from "vitest";
import { recommend } from "@/lib/agent/recommend";
import type { VenueGeocode } from "@/lib/domain/borough";
import {
  buildSearchArea,
  detectFarVenue,
  distanceKm,
  localityMatchesRequest,
  type ResolvedLocality,
} from "@/lib/domain/location";
import type { QlooParams } from "@/lib/qloo/client";
import { TtlCache } from "@/lib/qloo/cache";
import { createQlooSearch } from "@/lib/qloo/search";
import { rankCandidates } from "@/lib/ranking/rank";
import { suggestionCountText } from "@/lib/ui/format";
import { splitSource } from "@/lib/ui/status";
import { makeCandidate, makeProfile, SAMPLES, sampleEntities } from "./helpers/fixtures";
import { fakeQloo } from "./helpers/fakes";

// Live values: query.localities.filter[0] for "Benin city" (2026-10-29) and "Lagos" (Phase 9c).
const MEXICO_CITY: ResolvedLocality = {
  disambiguation: "Mexico City, Cuauhtémoc, Mexico City, Mexico",
  center: { lat: 19.38194195463108, lon: -99.14063414450813 },
};
const LAGOS: ResolvedLocality = { disambiguation: "Lagos, Nigeria", center: { lat: 6.520236604701515, lon: 3.5956709582495026 } };
const TORONTO: ResolvedLocality = { disambiguation: "Toronto, Golden Horseshoe, Ontario, Canada", center: { lat: 43.6532, lon: -79.3832 } };
const NEW_YORK: ResolvedLocality = { disambiguation: "New York, New York, United States", center: { lat: 40.66320611815103, lon: -73.93889084762313 } };

// Live venue: Palapa Cantina Caribeña (location + properties.geocode).
const PALAPA = {
  lat: 19.4255785,
  lon: -99.15663239999999,
  geocode: { city: "Mexico City", metro: "Mexico City", region: "Mexico City", county: "Cuauhtémoc", countryCode: "MX" } as VenueGeocode,
};
// Live venue: Cactus Restaurant, Victoria Island, Lagos.
const CACTUS = {
  lat: 6.4390122,
  lon: 3.4378511,
  geocode: { city: "Lagos", metro: null, region: "Lagos", county: "Eti Osa", countryCode: "NG" } as VenueGeocode,
};

describe("does the resolved locality name the place asked for?", () => {
  it.each([
    [{ city: "Benin city" }, MEXICO_CITY, false],
    [{ city: "Lagos" }, LAGOS, true],
    [{ city: "Lagos, Nigeria" }, LAGOS, true],
    [{ city: "LA" }, { disambiguation: "Los Angeles, Los Angeles County, California, United States", center: null }, true],
    [{ city: "Philly" }, { disambiguation: "Philadelphia, Pennsylvania, United States", center: null }, true],
    [{ city: "New York City" }, NEW_YORK, true],
    [{ city: "NYC", area: "Queens" }, { disambiguation: "Court Square, Long Island City, Queens, Queens County, New York, New York, United States", center: null }, true],
    [{ city: "London", area: "Shoreditch" }, { disambiguation: "Shoreditch, London Borough of Hackney, Greater London, England, United Kingdom", center: null }, true],
  ])("%j → %j: %s", (profile, locality, matches) => {
    expect(localityMatchesRequest(locality, profile)).toBe(matches);
  });
});

describe("far-venue rule", () => {
  it("measures great-circle distance (Lagos → Mexico City is about 11,000 km)", () => {
    expect(distanceKm(LAGOS.center!, MEXICO_CITY.center!)).toBeGreaterThan(10_000);
    expect(distanceKm(LAGOS.center!, CACTUS)).toBeLessThan(25);
  });

  it("marks every venue far when Qloo resolved the search to another place", () => {
    const area = buildSearchArea([MEXICO_CITY], { city: "Benin city" });
    expect(area).toEqual({ localities: [], mismatched: true });
    expect(detectFarVenue(PALAPA, area, false)).toMatchObject({ place: "Mexico City" });
    // A venue whose geocode is the city typed is still in the area.
    expect(detectFarVenue(PALAPA, area, true)).toBeNull();
  });

  it("marks a venue in another country far from a correctly resolved city", () => {
    const area = buildSearchArea([LAGOS], { city: "Lagos" });
    expect(area.mismatched).toBe(false);
    expect(detectFarVenue(PALAPA, area, false)).toMatchObject({ place: "Mexico City", source: expect.stringMatching(/km away/) });
    expect(detectFarVenue(CACTUS, area, true)).toBeNull();
  });

  it("keeps a venue within 50 km, or in a region the locality names", () => {
    const area = buildSearchArea([TORONTO], { city: "Toronto" });
    const mississauga = { lat: 43.589, lon: -79.6441, geocode: { city: "Mississauga", metro: null, region: "Ontario", county: "Peel", countryCode: "CA" } };
    const ottawa = { lat: 45.4215, lon: -75.6972, geocode: { city: "Ottawa", metro: null, region: "Ontario", county: null, countryCode: "CA" } };
    const buffalo = { lat: 42.8864, lon: -78.8784, geocode: { city: "Buffalo", metro: null, region: "New York", county: "Erie County", countryCode: "US" } };
    expect(detectFarVenue(mississauga, area, false)).toBeNull();
    expect(detectFarVenue(ottawa, area, false)).toBeNull(); // 350 km, but Ontario
    expect(detectFarVenue(buffalo, area, false)).toMatchObject({ place: "Buffalo" }); // ~95 km, another country
  });

  it("never guesses: no locality echoed, or no coordinates, means kept", () => {
    expect(detectFarVenue(PALAPA, buildSearchArea([], { city: "Lagos" }), false)).toBeNull();
    const noCoords = buildSearchArea([{ ...LAGOS, center: null }], { city: "Lagos" });
    expect(detectFarVenue(PALAPA, noCoords, false)).toBeNull();
  });
});

describe("rankCandidates with a search area", () => {
  const far = makeCandidate({ id: "far", name: "Palapa Cantina Caribeña", qlooRank: 1, ...PALAPA });
  const local = makeCandidate({ id: "local", name: "Cactus Restaurant", qlooRank: 2, ...CACTUS });
  const ikeja = makeCandidate({
    id: "ikeja",
    qlooRank: 3,
    lat: 6.6018,
    lon: 3.3515,
    geocode: { city: "Ikeja", metro: null, region: "Lagos", county: "Ikeja", countryCode: "NG" },
  });

  it("excludes a far venue (other country) with the reason, and keeps nearby ones with their labels", () => {
    const profile = makeProfile({ city: "Lagos" });
    const searchArea = buildSearchArea([LAGOS], profile);
    const { ranked, excluded } = rankCandidates(profile, [far, local, ikeja], {}, { cityNames: ["Lagos"], searchArea });
    expect(ranked.map((r) => [r.candidate.id, r.area.kind])).toEqual([
      ["local", "same_city"],
      ["ikeja", "nearby"],
    ]);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].candidate.id).toBe("far");
    expect(excluded[0].reasons).toEqual(["qloo.location: Outside the area you chose (Mexico City)"]);
    expect(splitSource(excluded[0].reasons[0]).text).toBe("Outside the area you chose (Mexico City)");
  });

  it("is unchanged without a search area", () => {
    const { ranked, excluded } = rankCandidates(makeProfile({ city: "Lagos" }), [far, local, ikeja]);
    expect(excluded).toEqual([]);
    expect(ranked).toHaveLength(3);
  });
});

describe("header count", () => {
  it("counts only the places shown", () => {
    expect(suggestionCountText(2, "Benin city")).toBe("2 suggestions near Benin city, best first. ");
    expect(suggestionCountText(1, "Lagos")).toBe("1 suggestion near Lagos, best first. ");
    expect(suggestionCountText(0, "Benin city")).toBeNull();
  });
});

// ---- the whole pipeline, with Qloo echoing a locality ----

/** Fake Qloo whose insights echo `locality` and put each place at the given venue location. */
function qlooAt(locality: ResolvedLocality, venues: { lat: number; lon: number; geocode: VenueGeocode }[]) {
  const base = fakeQloo({
    insights: () =>
      sampleEntities(SAMPLES.westAfricanFela)
        .slice(0, venues.length)
        .map((e, i) => {
          const v = venues[i];
          const entity = e as { properties?: Record<string, unknown> };
          const g = v.geocode;
          return {
            ...entity,
            location: { lat: v.lat, lon: v.lon },
            properties: {
              ...entity.properties,
              geocode: { city: g.city, metro: g.metro, admin1_region: g.region, admin2_region: g.county, country_code: g.countryCode },
            },
          };
        }),
  });
  const get = async (path: string, params: QlooParams) => {
    const body = (await base.get(path, params)) as Record<string, unknown>;
    if (path !== "/v2/insights") return body;
    return { ...body, query: { localities: { filter: [{ name: locality.disambiguation.split(",")[0], location: locality.center, disambiguation: locality.disambiguation }] } } };
  };
  return createQlooSearch({ get, cache: new TtlCache() });
}

describe("recommend: far venues never reach the results", () => {
  it("Benin city resolved to Mexico City: nothing shown, honest note, count 0", async () => {
    const search = qlooAt(MEXICO_CITY, [PALAPA, PALAPA, PALAPA]);
    const res = await recommend(makeProfile({ city: "Benin city" }), {}, { search, anthropic: null });
    expect(res.results).toEqual([]);
    expect(suggestionCountText(res.results.length, res.meta.location)).toBeNull();
    expect(res.excluded).toHaveLength(3);
    expect(res.excluded.every((e) => e.reasons[0] === "qloo.location: Outside the area you chose (Mexico City)")).toBe(true);
    expect(res.outsideAreaNote).toMatch(/^Qloo doesn't have .*restaurants near Benin city yet\.$/);
    expect(res.coverageNote).toBeNull();
  });

  it("a few local places among far ones: only the local ones, with the coverage note", async () => {
    const search = qlooAt(LAGOS, [CACTUS, PALAPA, CACTUS, PALAPA, PALAPA]);
    const res = await recommend(makeProfile({ city: "Lagos" }), {}, { search, anthropic: null });
    expect(res.results).toHaveLength(2);
    expect(res.results.every((r) => r.area.label === "In Lagos")).toBe(true);
    expect(res.excluded.filter((e) => e.reasons[0].includes("Outside the area you chose"))).toHaveLength(3);
    expect(suggestionCountText(res.results.length, res.meta.location)).toBe("2 suggestions near Lagos, best first. ");
    expect(res.coverageNote).toBe("Fewer matches found around Lagos. Qloo's restaurant coverage varies by city.");
    expect(res.outsideAreaNote).toBeNull();
  });

  it("NYC: the same results and labels with or without the locality echo", async () => {
    const profile = makeProfile({ city: "New York City", area: "Brooklyn" });
    const plain = await recommend(profile, {}, { search: fakeQloo().search, anthropic: null });
    const base = fakeQloo();
    const echoed = createQlooSearch({
      cache: new TtlCache(),
      get: async (path, params) => {
        const body = (await base.get(path, params)) as Record<string, unknown>;
        return path === "/v2/insights"
          ? { ...body, query: { localities: { filter: [{ name: "Brooklyn", location: { lat: 40.65, lon: -73.95 }, disambiguation: "Brooklyn, Kings County, New York, New York, United States" }] } } }
          : body;
      },
    });
    const withEcho = await recommend(profile, {}, { search: echoed, anthropic: null });
    const view = (r: typeof plain) => r.results.map((x) => [x.candidateId, x.area.label, x.scoreBreakdown.total]);
    expect(view(withEcho)).toEqual(view(plain));
    expect(withEcho.excluded).toEqual(plain.excluded);
    expect(withEcho.outsideAreaNote).toBeNull();
  });
});
