import { describe, expect, it } from "vitest";
import { SeniorProfileSchema } from "@/lib/domain/profile";

const minimal = { favouriteCuisines: ["Nigerian"], location: "Bed-Stuy, Brooklyn" };

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
      location: "Bed-Stuy, Brooklyn",
    });
  });

  it("trims strings", () => {
    const p = SeniorProfileSchema.parse({
      ...minimal,
      displayName: "  Mum ",
      allergies: [" peanuts "],
      tasteMemories: { music: ["  Fela Kuti"] },
    });
    expect(p.displayName).toBe("Mum");
    expect(p.allergies).toEqual(["peanuts"]);
    expect(p.tasteMemories).toEqual({ music: ["Fela Kuti"], films: [], places: [] });
  });

  it.each([
    ["empty list entry", { ...minimal, allergies: ["  "] }],
    ["no cuisines", { ...minimal, favouriteCuisines: [] }],
    ["six cuisines", { ...minimal, favouriteCuisines: ["a", "b", "c", "d", "e", "f"] }],
    ["eleven dishes", { ...minimal, favouriteDishes: Array(11).fill("rice") }],
    ["six music memories", { ...minimal, tasteMemories: { music: Array(6).fill("x") } }],
    ["sixteen dislikes", { ...minimal, dislikes: Array(16).fill("okra") }],
    ["long display name", { ...minimal, displayName: "x".repeat(41) }],
    ["missing location", { favouriteCuisines: ["Nigerian"] }],
    ["blank location", { ...minimal, location: "   " }],
    ["long location", { ...minimal, location: "x".repeat(81) }],
    ["unknown texture", { ...minimal, texture: "pureed" }],
  ])("rejects %s", (_label, input) => {
    expect(SeniorProfileSchema.safeParse(input).success).toBe(false);
  });
});
