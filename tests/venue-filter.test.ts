import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { venueVerdict } from "@/lib/qloo/venueFilter";

// Real recorded places (slimmed): every non-restaurant / drink-first place from the Phase 1
// E3+E5 runs, plus 10 ordinary restaurants. See scripts/extract-venue-filter-samples.ts.
const { places } = JSON.parse(
  readFileSync(join(process.cwd(), "fixtures", "qloo", "samples", "venue-filter.json"), "utf8"),
) as { places: { name: string; properties: { primary_genre: { id: string } | null } }[] };

const verdicts = places.map((p) => ({ name: p.name, genre: p.properties.primary_genre?.id, verdict: venueVerdict(p) }));
const kept = verdicts.filter((v) => v.verdict.keep).map((v) => v.name);
const dropped = verdicts.filter((v) => !v.verdict.keep).map((v) => v.name);

describe("non-restaurant filter on recorded places", () => {
  it("drops hotels, malls, markets, music venues and attractions", () => {
    for (const name of [
      "The Bowery Hotel",
      "Wythe Hotel",
      "Queens Center",
      "Westfield World Trade Center",
      "Eataly",
      "Little Italy",
      "Bronx Little Italy",
      "Baby's All Right",
      "Sony Hall",
      "The Iridium",
      "Birdland Jazz Club",
      "Jouvay Night Club",
    ]) {
      expect(dropped).toContain(name);
    }
  });

  it("drops drink-first bars without a cuisine-restaurant category", () => {
    for (const name of ["Starr Bar", "Union Hall", "Bar Centrale", "Pianos", "ALPHAVILLE"]) expect(dropped).toContain(name);
  });

  it("keeps bars that are also tagged as a cuisine restaurant, and restaurant-named genres", () => {
    for (const name of ["Pietro Nolita", "Groove", "Barawine", "Jacob's Pickles"]) expect(kept).toContain(name);
  });

  it("keeps every ordinary restaurant", () => {
    const ordinary = verdicts.filter(
      (v) => v.genre?.startsWith("urn:tag:genre:place:restaurant") && !/:(bar|cocktail_bar|wine_bar|lounge_bar|live_music_bar|beer_garden)$/.test(v.genre),
    );
    expect(ordinary.length).toBeGreaterThanOrEqual(10);
    expect(ordinary.every((v) => v.verdict.keep)).toBe(true);
  });

  it("gives every drop a plain reason", () => {
    for (const v of verdicts) if (!v.verdict.keep) expect(v.verdict.reason).toMatch(/^[a-z]/);
    const hotel = verdicts.find((v) => v.name === "Wythe Hotel")!.verdict;
    expect(hotel).toEqual({ keep: false, reason: "primary genre is hotel" });
  });

  it("drops a clear majority of the 45 edge cases", () => {
    // Recorded for the docs: how the rule splits the hard cases.
    expect(places.length).toBe(55);
    expect(dropped.length).toBeGreaterThanOrEqual(35);
  });

  it("keeps places with no primary genre", () => {
    expect(venueVerdict({ entity_id: "x", name: "No Genre" })).toEqual({ keep: true });
  });
});
