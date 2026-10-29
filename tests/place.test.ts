import { describe, expect, it } from "vitest";
import { buildMapsUrl, normalizePlaces, QlooPlaceSchema } from "@/lib/domain/place";
import { SAMPLES, sampleCandidate, sampleCandidates, sampleEntities } from "./helpers/fixtures";

describe("normalizePlaces on recorded insights results", () => {
  const candidates = sampleCandidates(SAMPLES.westAfricanFela);

  it("keeps Qloo order as qlooRank", () => {
    expect(candidates.map((c) => [c.qlooRank, c.name])).toEqual([
      [1, "Buka"],
      [2, "Joloff"],
      [3, "Accra Express Restaurant"],
      [4, "Cafe Rue Dix"],
      [5, "Brooklyn Suya"],
    ]);
  });

  it("maps the fields Tastora uses", () => {
    const buka = candidates[0];
    expect(buka).toMatchObject({
      id: "152FDD94-EE27-4193-813B-6D32996B3A24",
      address: "1111 Fulton St Brooklyn, NY 11238",
      neighborhood: "Bedford-Stuyvesant",
      phone: "+13477630619",
      website: "https://bukanewyork.com/",
      priceLevel: 2,
      rating: 3.6,
      isClosed: false,
      googlePlaceId: "ChIJPdXlLqNbwokRToFmx2p9CJ4",
      noiseTags: ["Moderate"],
    });
    expect(buka.lat).toBeCloseTo(40.6817, 4);
    expect(buka.affinity).toBeCloseTo(0.8458, 4);
    expect(buka.hours?.monday?.[0]).toEqual({ opens: "T16:00:00", closes: "T23:00:00", closed: false });
    expect(buka.cuisines).toEqual(["Nigerian", "African", "West african"]);
    expect(buka.dishHighlights).toContain("Pepper soup");
    expect(buka.accessibilityTags).toContain("Wheelchair accessible entrance");
    expect(buka.description).toMatch(/Nigerian/);
    expect(buka.mapsUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=Buka%2C+1111+Fulton+St+Brooklyn%2C+NY+11238&query_place_id=ChIJPdXlLqNbwokRToFmx2p9CJ4",
    );
  });
});

describe("normalizePlaces on recorded search results", () => {
  const katz = sampleCandidate(SAMPLES.searchKatz, "Katz's Delicatessen");

  it("reads search-shaped tags (tag_id) and external.google_place as an object", () => {
    expect(katz.googlePlaceId).toBe("ChIJCar0f49ZwokR6ozLV-dHNTE");
    expect(katz.affinity).toBeNull();
    expect(katz.dishHighlights).toContain("Matzah ball soup");
    expect(katz.tags.every((t) => t.id.startsWith("urn:tag:"))).toBe(true);
  });

  it("merges specialty dishes, de-duplicates them and drops garbled fragments", () => {
    expect(katz.specialtyDishes).toContain("Ball Soup"); // garbled, but kept: Qloo's own value
    expect(katz.specialtyDishes.filter((d) => d.toLowerCase() === "ball soup")).toHaveLength(1);
    expect(katz.specialtyDishes).not.toContain("And pickles");
    expect(katz.specialtyDishes).not.toContain("With pastrami");
  });
});

describe("tolerant parsing", () => {
  const [base] = sampleEntities(SAMPLES.westAfricanFela) as Record<string, unknown>[];

  it("nulls a malformed optional field instead of rejecting the place", () => {
    const props = { ...(base.properties as object), hours: "always", price_level: "cheap" };
    const [c] = normalizePlaces([{ ...base, properties: props, surprise: { x: 1 } }]);
    expect(c.name).toBe("Buka");
    expect(c.hours).toBeNull();
    expect(c.priceLevel).toBeNull();
    expect(c).not.toHaveProperty("surprise");
  });

  it("drops individual malformed tags", () => {
    const tags = [{ name: "No id" }, { id: "urn:tag:cuisine:qloo:x", name: "X", type: "urn:tag:cuisine:qloo" }];
    const parsed = QlooPlaceSchema.parse({ ...base, tags });
    expect(parsed.tags).toEqual([{ id: "urn:tag:cuisine:qloo:x", name: "X", type: "urn:tag:cuisine:qloo" }]);
  });

  it("skips non-place and invalid entities; ranks only the places kept", () => {
    const artist = { entity_id: "a1", name: "Fela Kuti", types: ["urn:entity:artist"] };
    const broken = { subtype: "urn:entity:place", name: "" };
    const out = normalizePlaces([artist, broken, base, null]);
    expect(out.map((c) => [c.qlooRank, c.name])).toEqual([[1, "Buka"]]);
  });

  it("survives a place with no properties, tags or external ids", () => {
    const [c] = normalizePlaces([{ entity_id: "p1", name: "Bare", subtype: "urn:entity:place" }]);
    expect(c).toMatchObject({ id: "p1", name: "Bare", address: null, tags: [], mapsUrl: null, isClosed: false });
  });
});

describe("buildMapsUrl", () => {
  it("uses the documented search action with query and query_place_id", () => {
    const url = new URL(buildMapsUrl("ChIJabc", "Katz's, 205 E Houston St"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Katz's, 205 E Houston St");
    expect(url.searchParams.get("query_place_id")).toBe("ChIJabc");
  });
});

describe("Qloo place image (Phase 12)", () => {
  const place = (properties: unknown) => ({ entity_id: "p1", name: "Lenny's Clam Bar", subtype: "urn:entity:place", properties });

  it("keeps properties.image.url for display", () => {
    const url = "https://images.qloo.com/i/6B4B5F78-B40C-478B-BB40-990A8548887F-420x-auto.jpg";
    expect(normalizePlaces([place({ image: { url } })])[0].imageUrl).toBe(url);
  });

  it("is null when Qloo has no image, and a malformed one doesn't drop the place", () => {
    expect(normalizePlaces([place({})])[0].imageUrl).toBeNull();
    expect(normalizePlaces([place({ image: "not an object" })]).map((c) => [c.name, c.imageUrl])).toEqual([
      ["Lenny's Clam Bar", null],
    ]);
  });
});
