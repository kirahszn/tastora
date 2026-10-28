import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExplanationFacts } from "@/lib/agent/explanationFacts";
import { areaLabel, detectProfileBorough, detectVenueArea, type VenueGeocode } from "@/lib/domain/borough";
import { normalizePlaces } from "@/lib/domain/place";
import { rankCandidates, SCORE_WEIGHTS } from "@/lib/ranking/rank";
import { makeCandidate, makeProfile } from "./helpers/fixtures";

const geo = (county: string | null, extra: Partial<VenueGeocode> = {}): VenueGeocode => ({
  city: "New York",
  county,
  region: "New York",
  countryCode: "US",
  ...extra,
});

describe("detectProfileBorough", () => {
  it.each([
    ["Brooklyn", "Brooklyn"],
    ["bed-stuy, BROOKLYN", "Brooklyn"],
    ["Astoria, Queens", "Queens"],
    ["The Bronx", "Bronx"],
    ["Staten Island", "Staten Island"],
    ["staten-island", "Staten Island"],
    ["Harlem, Manhattan", "Manhattan"],
  ])("%s → %s", (location, borough) => {
    expect(detectProfileBorough(location)).toBe(borough);
  });

  it("returns null when no borough is named", () => {
    expect(detectProfileBorough("New York City")).toBeNull();
    expect(detectProfileBorough("Paris, France")).toBeNull();
    // Whole words only.
    expect(detectProfileBorough("Queensland")).toBeNull();
  });

  it("takes the first borough named", () => {
    expect(detectProfileBorough("Brooklyn, near Queens")).toBe("Brooklyn");
  });
});

describe("detectVenueArea", () => {
  it("uses properties.geocode.admin2_region first", () => {
    expect(detectVenueArea({ geocode: geo("Kings County"), address: "1 Main St New York, NY 10001" })).toEqual({
      kind: "borough",
      borough: "Brooklyn",
      source: "qloo.properties.geocode.admin2_region: Kings County",
    });
    expect(detectVenueArea({ geocode: geo("New York County"), address: null })).toMatchObject({ borough: "Manhattan" });
    expect(detectVenueArea({ geocode: geo("Queens County"), address: null })).toMatchObject({ borough: "Queens" });
    expect(detectVenueArea({ geocode: geo("Bronx County"), address: null })).toMatchObject({ borough: "Bronx" });
    expect(detectVenueArea({ geocode: geo("Staten Island"), address: null })).toMatchObject({ borough: "Staten Island" });
  });

  it("labels other counties and countries as outside NYC", () => {
    const nassau = detectVenueArea({ geocode: geo("Nassau County", { city: "Hempstead" }), address: null });
    expect(areaLabel(nassau)).toBe("Outside NYC (Nassau County)");
    const jersey = detectVenueArea({ geocode: geo("Hudson County", { region: "New Jersey" }), address: null });
    expect(areaLabel(jersey)).toBe("Outside NYC (Hudson County)");
    const oslo = detectVenueArea({ geocode: geo("Oslo", { city: "Oslo", countryCode: "NO" }), address: null });
    expect(areaLabel(oslo)).toBe("Outside NYC (Oslo)");
  });

  it("falls back to the address ZIP code", () => {
    const area = (address: string) => detectVenueArea({ geocode: null, address });
    expect(area("1111 Fulton St Brooklyn, NY 11238")).toMatchObject({ kind: "borough", borough: "Brooklyn" });
    expect(area("41-07 Kissena Blvd Flushing, NY 11355")).toMatchObject({ kind: "borough", borough: "Queens" });
    expect(area("63 E 125th St New York, NY 10035")).toMatchObject({ kind: "borough", borough: "Manhattan" });
    expect(area("2 Example Ave Bronx, NY 10458")).toMatchObject({ kind: "borough", borough: "Bronx" });
    expect(area("100 Industrial Rd Carlstadt, NJ 07072")).toEqual({
      kind: "outside_nyc",
      place: "NJ",
      source: "qloo.properties.address: NJ 07072",
    });
    expect(area("1 Front St Hempstead, NY 11550")).toMatchObject({ kind: "outside_nyc" });
    // 110xx is split between Queens and Nassau: not clearly outside.
    expect(area("1 Jericho Tpke Floral Park, NY 11001")).toEqual({ kind: "unknown" });
    expect(area("1 Union Tpke Glen Oaks, NY 11004")).toMatchObject({ borough: "Queens" });
    expect(area("Holmens gate 2 0250 Oslo Norway")).toEqual({ kind: "unknown" });
  });

  it("is unknown with neither field", () => {
    expect(detectVenueArea({ geocode: null, address: null })).toEqual({ kind: "unknown" });
    expect(areaLabel({ kind: "unknown" })).toBeNull();
  });

  // Raw responses are gitignored (local only), so this check is skipped in a fresh clone.
  const rawPath = join(process.cwd(), "fixtures", "qloo", "raw", "E5i-italian-signal-sinatra.json");

  it.skipIf(!existsSync(rawPath))("finds an area for every place in a recorded raw Qloo response", () => {
    const raw = JSON.parse(readFileSync(rawPath, "utf8"));
    const places = normalizePlaces(raw.body.results.entities);
    expect(places.length).toBeGreaterThan(10);
    expect(places.every((p) => p.geocode?.county)).toBe(true);
    expect(places.every((p) => detectVenueArea(p).kind !== "unknown")).toBe(true);
  });
});

describe("borough ranking", () => {
  const brooklyn = makeCandidate({ id: "bk", name: "BK", address: "1 Fulton St Brooklyn, NY 11238", qlooRank: 2 });
  const manhattan = makeCandidate({ id: "mn", name: "MN", address: "1 Broadway New York, NY 10004", qlooRank: 1 });
  const nassau = makeCandidate({ id: "na", name: "NA", geocode: geo("Nassau County"), qlooRank: 3 });
  const unknown = makeCandidate({ id: "un", name: "UN", address: null, qlooRank: 4 });
  const all = [brooklyn, manhattan, nassau, unknown];
  const borough = (location: string) =>
    Object.fromEntries(
      rankCandidates(makeProfile({ location }), all).ranked.map((r) => [r.candidate.id, r.score.breakdown.borough]),
    );

  it("gives +6 for the same borough, −6 outside NYC, 0 otherwise", () => {
    expect(borough("Bed-Stuy, Brooklyn")).toEqual({
      bk: SCORE_WEIGHTS.sameBorough,
      mn: 0,
      na: SCORE_WEIGHTS.outsideNyc,
      un: 0,
    });
    expect(SCORE_WEIGHTS.sameBorough).toBe(6);
    expect(SCORE_WEIGHTS.outsideNyc).toBe(-6);
  });

  it("scores nothing when the profile names no borough", () => {
    expect(borough("New York City")).toEqual({ bk: 0, mn: 0, na: 0, un: 0 });
  });

  it("never filters: venues outside NYC stay ranked, with a label", () => {
    const profile = makeProfile({ location: "Brooklyn" });
    const { ranked, excluded } = rankCandidates(profile, all);
    expect(ranked).toHaveLength(4);
    expect(excluded).toEqual([]);
    const facts = ranked.map((r) => buildExplanationFacts(profile, r));
    expect(facts.find((f) => f.candidateId === "na")!.area).toEqual({
      kind: "outside_nyc",
      label: "Outside NYC (Nassau County)",
      inRequestedBorough: false,
      inRequestedCity: false,
      source: "qloo.properties.geocode.admin2_region: Nassau County",
    });
    const bk = facts.find((f) => f.candidateId === "bk")!;
    expect(bk.area.inRequestedBorough).toBe(true);
    expect(bk.reasons.map((r) => r.text)).toContain("In Brooklyn, the borough you chose");
    expect(facts.find((f) => f.candidateId === "un")!.area).toEqual({
      kind: "unknown",
      label: null,
      inRequestedBorough: false,
      inRequestedCity: false,
    });
  });

  it("doesn't override a large taste gap", () => {
    // Taste 50 vs 25: +6 nudges the order, it can't outweigh Qloo.
    const { ranked } = rankCandidates(makeProfile({ location: "Brooklyn" }), [manhattan, brooklyn]);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["mn", "bk"]);
  });
});
