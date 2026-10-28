import { describe, expect, it } from "vitest";
import { migrateLegacyLocation } from "@/lib/domain/location";
import { SeniorProfileSchema } from "@/lib/domain/profile";

const minimal = { favouriteCuisines: ["Nigerian"], city: "New York City", area: "Bed-Stuy, Brooklyn" };

describe("SeniorProfileSchema", () => {
  it("applies defaults to a minimal profile", () => {
    expect(SeniorProfileSchema.parse(minimal)).toEqual({
      favouriteCuisines: ["Nigerian"],
      favouriteDishes: [],
      tasteMemories: { music: [], films: [], places: [] },
      dislikes: [],
      allergies: [],
      dietaryRestrictions: [],
      texture: "none",
      comfort: { quietPreferred: false, wheelchairAccess: false },
      city: "New York City",
      area: "Bed-Stuy, Brooklyn",
    });
  });

  it("trims strings", () => {
    const p = SeniorProfileSchema.parse({
      ...minimal,
      city: "  London ",
      area: " Shoreditch  ",
      displayName: "  Mum ",
      allergies: [" peanuts "],
      tasteMemories: { music: ["  Fela Kuti"] },
    });
    expect(p.city).toBe("London");
    expect(p.area).toBe("Shoreditch");
    expect(p.displayName).toBe("Mum");
    expect(p.allergies).toEqual(["peanuts"]);
    expect(p.tasteMemories).toEqual({ music: ["Fela Kuti"], films: [], places: [] });
  });

  it("accepts a city with no area", () => {
    const p = SeniorProfileSchema.parse({ favouriteCuisines: ["Indian"], city: "London" });
    expect(p.city).toBe("London");
    expect(p).not.toHaveProperty("area");
  });

  it("accepts a city of exactly 60 characters and an area of exactly 60", () => {
    expect(SeniorProfileSchema.safeParse({ ...minimal, city: "x".repeat(60), area: "y".repeat(60) }).success).toBe(true);
  });

  it.each([
    ["empty list entry", { ...minimal, allergies: ["  "] }],
    ["no cuisines", { ...minimal, favouriteCuisines: [] }],
    ["six cuisines", { ...minimal, favouriteCuisines: ["a", "b", "c", "d", "e", "f"] }],
    ["eleven dishes", { ...minimal, favouriteDishes: Array(11).fill("rice") }],
    ["six music memories", { ...minimal, tasteMemories: { music: Array(6).fill("x") } }],
    ["sixteen dislikes", { ...minimal, dislikes: Array(16).fill("okra") }],
    ["long display name", { ...minimal, displayName: "x".repeat(41) }],
    ["missing city", { favouriteCuisines: ["Nigerian"] }],
    ["blank city", { ...minimal, city: "   " }],
    ["long city", { ...minimal, city: "x".repeat(61) }],
    ["blank area (send none instead)", { ...minimal, area: "  " }],
    ["long area", { ...minimal, area: "x".repeat(61) }],
    ["blank legacy location", { favouriteCuisines: ["Nigerian"], location: "   " }],
    ["long legacy location", { favouriteCuisines: ["Nigerian"], location: "x".repeat(81) }],
    ["unknown texture", { ...minimal, texture: "pureed" }],
  ])("rejects %s", (_label, input) => {
    expect(SeniorProfileSchema.safeParse(input).success).toBe(false);
  });
});

describe("saved-profile migration (pre-Phase 9c `location`)", () => {
  it.each([
    ["Queens", { city: "New York City", area: "Queens" }],
    ["Bed-Stuy, Brooklyn", { city: "New York City", area: "Bed-Stuy, Brooklyn" }],
    ["The Bronx", { city: "New York City", area: "The Bronx" }],
    ["Staten Island", { city: "New York City", area: "Staten Island" }],
  ])("an old NYC borough value %j becomes city New York City + that area", (location, expected) => {
    const p = SeniorProfileSchema.parse({ favouriteCuisines: ["Nigerian"], location });
    expect({ city: p.city, area: p.area }).toEqual(expected);
    expect(p).not.toHaveProperty("location");
  });

  it("a location naming no borough (API only) becomes the city", () => {
    const p = SeniorProfileSchema.parse({ favouriteCuisines: ["Nigerian"], location: "Paris, France" });
    expect(p.city).toBe("Paris, France");
    expect(p.area).toBeUndefined();
  });

  it("leaves new-shape input and non-objects alone", () => {
    const input = { favouriteCuisines: ["x"], city: "London", location: "Queens" };
    expect(migrateLegacyLocation(input)).toBe(input);
    expect(SeniorProfileSchema.parse(input).city).toBe("London");
    expect(migrateLegacyLocation(null)).toBeNull();
    expect(migrateLegacyLocation("Queens")).toBe("Queens");
  });

  it("is what loadProfile uses, so an old saved profile still loads", async () => {
    const { loadProfile, PROFILE_KEY } = await import("@/lib/ui/storage");
    const data = new Map([[PROFILE_KEY, JSON.stringify({ favouriteCuisines: ["Nigerian"], location: "Brooklyn", texture: "soft" })]]);
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: () => undefined, removeItem: () => undefined };
    expect(loadProfile(store)).toMatchObject({ city: "New York City", area: "Brooklyn", texture: "soft" });
  });
});
