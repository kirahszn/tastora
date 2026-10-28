// Phase 9c: cities beyond NYC. The same-city rule is checked on the slim live samples
// (fixtures/qloo/samples/city-*.json); NYC keeps its borough rule unchanged.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/recommend/route";
import { buildExplanationFacts } from "@/lib/agent/explanationFacts";
import { recommend } from "@/lib/agent/recommend";
import type { VenueGeocode } from "@/lib/domain/borough";
import {
  cityAreaLabel,
  cityCoverage,
  coverageNote,
  detectCityArea,
  FEW_RESULTS_THRESHOLD,
  isNewYorkCity,
  QUICK_CITIES,
  searchLocation,
} from "@/lib/domain/location";
import { QlooApiError, type QlooParams } from "@/lib/qloo/client";
import { TtlCache } from "@/lib/qloo/cache";
import { clearQlooCache, createQlooSearch, isUnresolvedLocation, LocationNotFoundError } from "@/lib/qloo/search";
import { rankCandidates, SCORE_WEIGHTS } from "@/lib/ranking/rank";
import { formatPhone, telHref } from "@/lib/ui/links";
import { makeCandidate, makeProfile, SAMPLES, sampleEntities } from "./helpers/fixtures";
import { fakeQloo, IDS } from "./helpers/fakes";

interface SlimPlace {
  entity_id: string;
  name: string;
  phone: string | null;
  geocode: {
    city: string | null;
    metro: string | null;
    admin1_region: string | null;
    admin2_region: string | null;
    country_code: string | null;
  } | null;
}

function cityPlaces(slug: string): SlimPlace[] {
  const file = JSON.parse(readFileSync(join(process.cwd(), "fixtures/qloo/samples", `city-${slug}.json`), "utf8"));
  return file.runs.flatMap((r: { samplePlaces: SlimPlace[] }) => r.samplePlaces);
}

const toGeocode = (g: SlimPlace["geocode"]): VenueGeocode | null =>
  g ? { city: g.city, county: g.admin2_region, region: g.admin1_region, countryCode: g.country_code, metro: g.metro } : null;

const place = (slug: string, name: string) => {
  const p = cityPlaces(slug).find((x) => x.name === name);
  if (!p) throw new Error(`${name} not in city-${slug}.json`);
  return p;
};

describe("same-city rule outside NYC, on live samples", () => {
  it.each([
    ["london", "Dishoom King's Cross", "London", "same_city", "In London"],
    ["sydney", "China Doll", "Sydney", "same_city", "In Sydney"],
    // geocode.city is the council; metro is Sydney.
    ["sydney", "Spice Temple Sydney", "Sydney", "same_metro", "In the Sydney area"],
    ["los-angeles", "Bestia", "Los Angeles", "same_city", "In Los Angeles"],
    ["los-angeles", "Élephante", "Los Angeles", "same_metro", "In the Los Angeles area"],
    // Mississauga has no metro in Qloo's geocode.
    ["toronto", "Zauq Mississauga - Halal Pakistani, Indian & Hakka Cuisine", "Toronto", "nearby", "Nearby: Mississauga"],
    ["los-angeles", "VIVO Italian Kitchen", "Los Angeles", "nearby", "Nearby: Universal City"],
    ["lagos", "Cactus Restaurant", "Lagos", "same_city", "In Lagos"],
  ])("%s · %s → %s", (slug, name, city, kind, label) => {
    const area = detectCityArea(toGeocode(place(slug, name).geocode), [city]);
    expect(area?.kind).toBe(kind);
    expect(area && cityAreaLabel(area)).toBe(label);
  });

  it("every sampled place outside NYC has a geocode city, so the rule never has to guess", () => {
    for (const slug of ["london", "toronto", "los-angeles", "chicago", "lagos", "sydney"]) {
      expect(cityPlaces(slug).every((p) => !!p.geocode?.city)).toBe(true);
    }
  });

  it("gives the same-city bonus (same weight as a borough) to city and metro matches only, and never filters", () => {
    expect(SCORE_WEIGHTS.sameCity).toBe(SCORE_WEIGHTS.sameBorough);
    const london = makeCandidate({ id: "ldn", qlooRank: 1, geocode: toGeocode(place("los-angeles", "Bestia").geocode) });
    const metro = makeCandidate({ id: "met", qlooRank: 2, geocode: toGeocode(place("los-angeles", "Élephante").geocode) });
    const nearby = makeCandidate({ id: "nb", qlooRank: 3, geocode: toGeocode(place("los-angeles", "VIVO Italian Kitchen").geocode) });
    const unknown = makeCandidate({ id: "un", qlooRank: 4, geocode: null });
    const profile = makeProfile({ city: "Los Angeles" });
    const { ranked, excluded } = rankCandidates(profile, [london, metro, nearby, unknown]);
    expect(excluded).toEqual([]);
    expect(Object.fromEntries(ranked.map((r) => [r.candidate.id, r.score.breakdown.borough]))).toEqual({
      ldn: 6,
      met: 6,
      nb: 0,
      un: 0,
    });
    const facts = Object.fromEntries(ranked.map((r) => [r.candidate.id, buildExplanationFacts(profile, r)]));
    expect(facts.ldn.area).toMatchObject({ kind: "same_city", label: "In Los Angeles", inRequestedCity: true, inRequestedBorough: false });
    expect(facts.ldn.reasons.map((r) => r.text)).toContain("In Los Angeles, the city you chose");
    expect(facts.ldn.reasons.find((r) => r.text.endsWith("the city you chose"))?.source).toBe(
      "profile.city: Los Angeles ↔ Qloo properties.geocode.city: Los Angeles",
    );
    expect(facts.met.area.label).toBe("In the Los Angeles area");
    expect(facts.nb.area).toMatchObject({ kind: "nearby", label: "Nearby: Universal City", inRequestedCity: false });
    expect(facts.nb.reasons.some((r) => r.text.includes("city you chose"))).toBe(false);
    // No geocode city: no label rather than a guess.
    expect(facts.un.area).toEqual({ kind: "unknown", label: null, inRequestedBorough: false, inRequestedCity: false });
  });

  it("matches the city as typed before a comma, or as Qloo resolved it", () => {
    const g = toGeocode(place("london", "Dishoom King's Cross").geocode);
    expect(detectCityArea(g, ["London, UK"])?.kind).toBe("same_city");
    expect(detectCityArea(toGeocode(place("los-angeles", "Bestia").geocode), ["LA"])?.kind).toBe("nearby");
    const viaResolved = rankCandidates(makeProfile({ city: "LA" }), [makeCandidate({ geocode: toGeocode(place("los-angeles", "Bestia").geocode) })], {}, {
      cityNames: ["Los Angeles"],
    });
    expect(viaResolved.ranked[0].score.breakdown.borough).toBe(6);
  });

  it("does not treat a place in another city as the same city", () => {
    const chicago = cityPlaces("chicago");
    const area = detectCityArea(toGeocode(chicago[0].geocode), ["Toronto"]);
    expect(area).toMatchObject({ kind: "nearby", place: "Chicago" });
  });
});

describe("NYC borough behaviour is unchanged", () => {
  const brooklyn = makeCandidate({ id: "bk", address: "1 Fulton St Brooklyn, NY 11238", qlooRank: 2 });
  const manhattan = makeCandidate({ id: "mn", address: "1 Broadway New York, NY 10004", qlooRank: 1 });
  const nassau = makeCandidate({
    id: "na",
    geocode: { city: "Garden City", county: "Nassau County", region: "New York", countryCode: "US", metro: "New York City" },
    qlooRank: 3,
  });
  const all = [brooklyn, manhattan, nassau];
  const scores = (profile: ReturnType<typeof makeProfile>) =>
    rankCandidates(profile, all).ranked.map((r) => [r.candidate.id, r.score.breakdown.borough, r.area.kind]);

  it("city New York City + area Brooklyn scores exactly like the old location \"Brooklyn\"", () => {
    const legacy = scores(makeProfile({ location: "Brooklyn" }));
    expect(scores(makeProfile({ city: "New York City", area: "Brooklyn" }))).toEqual(legacy);
    expect(legacy).toEqual([
      ["mn", 0, "borough"],
      ["bk", 6, "borough"],
      ["na", -6, "outside_nyc"],
    ]);
  });

  it("uses the borough rule (not the city rule) for every way of naming NYC", () => {
    for (const city of ["New York City", "NYC", "new york", "New York, NY", "Brooklyn"]) {
      expect(isNewYorkCity(city)).toBe(true);
      const kinds = rankCandidates(makeProfile({ city, area: "Brooklyn" }), all).ranked.map((r) => r.area.kind);
      expect(kinds.every((k) => k === "borough" || k === "outside_nyc")).toBe(true);
    }
    expect(isNewYorkCity("London")).toBe(false);
    expect(isNewYorkCity("York")).toBe(false);
  });

  it("sends NYC areas that name a borough on their own, as before; other areas joined to the city", () => {
    expect(searchLocation({ city: "New York City", area: "Bed-Stuy, Brooklyn" })).toBe("Bed-Stuy, Brooklyn");
    expect(searchLocation({ city: "New York City", area: "Queens" })).toBe("Queens");
    expect(searchLocation({ city: "New York City", area: "Harlem" })).toBe("Harlem, New York City");
    expect(searchLocation({ city: "New York City" })).toBe("New York City");
    expect(searchLocation({ city: "London", area: "Shoreditch" })).toBe("Shoreditch, London");
    expect(searchLocation({ city: "London" })).toBe("London");
  });
});

describe("coverage note", () => {
  const note = "Fewer matches found around London. Qloo's restaurant coverage varies by city.";

  it(`shows when fewer than ${FEW_RESULTS_THRESHOLD} places were found`, () => {
    expect(coverageNote("London", 3)).toBe(note);
    expect(coverageNote("London", 0)).toBe(note);
    expect(coverageNote("London", 4)).toBeNull();
    expect(coverageNote("New York City", 20)).toBeNull();
  });

  it("shows for a city rated Thin or Poor, whatever the count; unrated cities use the count only", () => {
    expect(cityCoverage("Lagos")).toBe("Thin");
    expect(coverageNote("Lagos", 13)).toBe("Fewer matches found around Lagos. Qloo's restaurant coverage varies by city.");
    expect(cityCoverage("Paris")).toBeNull();
    expect(coverageNote("Paris", 10)).toBeNull();
    expect(coverageNote("Paris", 2)).not.toBeNull();
  });

  it("offers quick picks only for New York City and cities rated Good", () => {
    expect(QUICK_CITIES[0]).toBe("New York City");
    expect(QUICK_CITIES.every((c) => cityCoverage(c) === "Good")).toBe(true);
    expect(QUICK_CITIES).not.toContain("Lagos");
  });

  it("is in the recommend response (fake Qloo: 5 places for a Thin city)", async () => {
    const res = await recommend(makeProfile({ city: "Lagos" }), {}, { search: fakeQloo().search, anthropic: null });
    expect(res.coverageNote).toBe("Fewer matches found around Lagos. Qloo's restaurant coverage varies by city.");
    expect(res.meta).toMatchObject({ city: "Lagos", location: "Lagos" });
    const nyc = await recommend(makeProfile({ city: "New York City", area: "Brooklyn" }), {}, { search: fakeQloo().search, anthropic: null });
    expect(nyc.coverageNote).toBeNull();
    expect(nyc.meta.location).toBe("Brooklyn");
  });
});

describe("phone formatting", () => {
  it.each([
    ["+14165049669", "(416) 504-9669"], // Toronto, from city-toronto.json
    ["+12133826677", "(213) 382-6677"], // Los Angeles
    ["+1 718-555-0100", "(718) 555-0100"],
    ["2125550100", "(212) 555-0100"],
    ["+442073994330", "+442073994330"], // London: as provided (international form)
    ["+61293659000", "+61293659000"], // Sydney
    ["+2348106800744", "+2348106800744"], // Lagos
    ["  +442074209321 ", "+442074209321"],
  ])("%s → %s", (input, shown) => {
    expect(formatPhone(input)).toBe(shown);
  });

  it("keeps tel: links in E.164 whatever the display", () => {
    expect(telHref("+14165049669")).toBe("tel:+14165049669");
    expect(telHref("+442073994330")).toBe("tel:+442073994330");
    expect(formatPhone(null)).toBeNull();
    expect(formatPhone("  ")).toBeNull();
  });

  it("formats every US/Canada number in the live samples, and leaves the rest alone", () => {
    for (const slug of ["london", "toronto", "los-angeles", "chicago", "lagos", "sydney"]) {
      for (const p of cityPlaces(slug).filter((x) => x.phone)) {
        const shown = formatPhone(p.phone)!;
        if (p.phone!.startsWith("+1")) expect(shown).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
        else expect(shown).toBe(p.phone);
      }
    }
  });
});

// ---- location that can't be resolved ----

const UNRESOLVED_BODY = {
  errors: [{ message: "filter.location.query is unable to resolve to a valid locality.", path: "filter.location" }],
};
const unresolved = () => new QlooApiError("Qloo request to /v2/insights failed with HTTP 400", 400, "/v2/insights", UNRESOLVED_BODY);

/** Fake Qloo where insights for `bad` locations fail like the live 400. */
function qlooWithUnresolvable(bad: (location: string) => boolean) {
  const base = fakeQloo();
  const calls: QlooParams[] = [];
  const get = async (path: string, params: QlooParams) => {
    if (path === "/v2/insights") {
      calls.push(params);
      if (bad(String(params["filter.location.query"]))) throw unresolved();
    }
    return base.get(path, params);
  };
  return { calls, search: createQlooSearch({ get, cache: new TtlCache() }) };
}

describe("unresolvable location", () => {
  it("recognises the live 400 body, and nothing else", () => {
    expect(isUnresolvedLocation(unresolved())).toBe(true);
    expect(isUnresolvedLocation(new QlooApiError("x", 400, "/v2/insights", { errors: [{ message: "at least one valid signal or filter is required" }] }))).toBe(false);
    expect(isUnresolvedLocation(new QlooApiError("x", 503, "/v2/insights", UNRESOLVED_BODY))).toBe(false);
    expect(isUnresolvedLocation(new Error("x"))).toBe(false);
  });

  it("retries the whole city when the area can't be resolved, and says so", async () => {
    const { search, calls } = qlooWithUnresolvable((l) => l === "Nowhereville, London");
    const r = await search.searchRestaurants({ cuisineTagIds: [IDS.nigerianCuisine], location: "Nowhereville, London", fallbackLocation: "London" });
    expect(calls.map((c) => c["filter.location.query"])).toEqual(["Nowhereville, London", "London"]);
    expect(r.locationUsed).toBe("London");
    expect(r.candidates).toHaveLength(5);
    expect(r.notes).toContain('Qloo could not find "Nowhereville, London"; searched London instead');
  });

  it("retries the whole city when the area finds nothing", async () => {
    const { search } = fakeQloo({ insights: (p) => (p["filter.location.query"] === "Sydney" ? sampleEntities(SAMPLES.westAfricanFela) : []) });
    const r = await search.searchRestaurants({ cuisineTagIds: [IDS.nigerianCuisine], location: "Bondi, Sydney", fallbackLocation: "Sydney" });
    expect(r.locationUsed).toBe("Sydney");
    expect(r.notes).toContain('No places found for "Bondi, Sydney"; searched Sydney instead');
  });

  it("throws LocationNotFoundError when the city itself can't be resolved", async () => {
    const { search } = qlooWithUnresolvable(() => true);
    await expect(
      search.searchRestaurants({ cuisineTagIds: [IDS.nigerianCuisine], location: "Qwxzvillezz", fallbackLocation: "Qwxzvillezz" }),
    ).rejects.toBeInstanceOf(LocationNotFoundError);
  });

  it("stops the whole recommendation (no NYC results passed off as the city)", async () => {
    const { search } = qlooWithUnresolvable(() => true);
    await expect(recommend(makeProfile({ city: "Qwxzvillezz" }), {}, { search, anthropic: null })).rejects.toBeInstanceOf(LocationNotFoundError);
  });

  describe("POST /api/recommend", () => {
    let ip = 100;
    beforeEach(() => {
      clearQlooCache();
      vi.stubEnv("QLOO_API_KEY", "k");
      vi.stubEnv("QLOO_API_BASE_URL", "https://qloo.test");
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      const qloo = fakeQloo();
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          const url = new URL(input instanceof Request ? input.url : String(input));
          if (url.pathname === "/v2/insights") return Response.json(UNRESOLVED_BODY, { status: 400 });
          return Response.json(await qloo.get(url.pathname, Object.fromEntries(url.searchParams.entries())));
        }),
      );
      vi.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });
    const post = (stream: boolean) =>
      POST(
        new Request(`http://localhost/api/recommend${stream ? "?stream=1" : ""}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": `10.9.0.${++ip}` },
          body: JSON.stringify({ profile: { favouriteCuisines: ["Nigerian"], city: "Qwxzvillezz" } }),
        }),
      );

    it("answers 400 with a friendly message asking for a nearby larger city", async () => {
      const res = await post(false);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Qloo couldn't find that city or area. Please try the nearest larger city.",
        code: "location_not_found",
      });
    });

    it("streams the same as an error event with status 400", async () => {
      const lines = (await (await post(true)).text()).trim().split("\n").map((l) => JSON.parse(l));
      expect(lines.at(-1)).toEqual({
        type: "error",
        status: 400,
        code: "location_not_found",
        error: "Qloo couldn't find that city or area. Please try the nearest larger city.",
      });
    });
  });
});
