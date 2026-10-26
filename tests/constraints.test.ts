import { describe, expect, it } from "vitest";
import { evaluateCandidate, type RequirementResult } from "@/lib/constraints/evaluate";
import { allergenRule, containsKeyword, dietRule } from "@/lib/constraints/keywords";
import { TAG_TYPES } from "@/lib/domain/place";
import {
  allSampleCandidates,
  makeCandidate,
  makeProfile,
  SAMPLES,
  sampleCandidate,
  tag,
} from "./helpers/fixtures";

const accra = () => sampleCandidate(SAMPLES.westAfricanFela, "Accra Express Restaurant");
const buka = () => sampleCandidate(SAMPLES.westAfricanFela, "Buka");

function requirement(results: RequirementResult[], label: string): RequirementResult {
  const r = results.find((x) => x.requirement === label);
  if (!r) throw new Error(`no requirement ${label}: ${results.map((x) => x.requirement)}`);
  return r;
}

describe("containsKeyword", () => {
  it("matches whole words, case-insensitively, with plurals and hyphens", () => {
    expect(containsKeyword("Peanut soup", "peanut")).toBe(true);
    expect(containsKeyword("Roasted PEANUTS", "peanut")).toBe(true);
    expect(containsKeyword("peanut-butter toast", "peanut butter")).toBe(true);
    expect(containsKeyword("Linguine with clams", "clam")).toBe(true);
  });

  it("does not match inside other words", () => {
    expect(containsKeyword("Peanut soup", "pea")).toBe(false);
    expect(containsKeyword("Pea soup", "peanut")).toBe(false);
    expect(containsKeyword("Cheesecake", "cheese")).toBe(false);
    expect(containsKeyword("Shamrock", "ham")).toBe(false);
    expect(containsKeyword("Coddled", "cod")).toBe(false);
  });
});

describe("keyword rules", () => {
  it("maps allergy synonyms to one group", () => {
    expect(allergenRule("Groundnuts").dishKeywords).toEqual(allergenRule("peanut").dishKeywords);
    expect(allergenRule("shellfish").dishKeywords).toEqual(
      expect.arrayContaining(["shrimp", "prawn", "crab", "lobster", "crayfish"]),
    );
    expect(allergenRule("dairy").dishKeywords).toContain("cheese");
    expect(allergenRule("nuts").dishKeywords).toEqual(expect.arrayContaining(["peanut", "cashew"]));
  });

  it("falls back to the term itself for unknown allergies", () => {
    expect(allergenRule("mustard").dishKeywords).toEqual(["mustard"]);
    expect(allergenRule("pea").dishKeywords).toEqual(["pea"]);
  });

  it("derives conflict words for unknown 'no X' / 'X-free' restrictions", () => {
    expect(dietRule("No beef").conflictKeywords).toEqual(["beef"]);
    expect(dietRule("onion-free").conflictKeywords).toEqual(["onion"]);
    expect(dietRule("low salt").conflictKeywords).toEqual([]);
  });
});

describe("allergies", () => {
  it("flags and removes dishes that mention the allergen; venue still needs confirmation", () => {
    const ev = evaluateCandidate(makeProfile({ allergies: ["peanuts"] }), accra());
    const r = requirement(ev.requirements, "allergy: peanuts");

    expect(r.status).toBe("needs_confirmation");
    expect(r.warnings).toEqual([
      'qloo.dishHighlights: "Peanut soup" mentions "peanut"; not suggested',
    ]);
    expect(ev.allowedDishes.map((d) => d.name)).not.toContain("Peanut soup");
    expect(ev.allowedDishes.map((d) => d.name)).toContain("Okra soup");
    expect(ev.excluded).toBe(false);
  });

  it("'pea' allergy does not flag peanut dishes, and 'peanut' does not flag pea dishes", () => {
    expect(evaluateCandidate(makeProfile({ allergies: ["pea"] }), accra()).excludedDishes).toEqual([]);
    const peaSoup = makeCandidate({ dishHighlights: ["Pea soup", "Split pea stew"] });
    expect(evaluateCandidate(makeProfile({ allergies: ["peanut"] }), peaSoup).excludedDishes).toEqual([]);
  });

  it("removes dishes commonly made with the allergen (suya), noting the recipe is unverified", () => {
    const ev = evaluateCandidate(makeProfile({ allergies: ["peanut"] }), buka());
    const r = requirement(ev.requirements, "allergy: peanut");
    expect(r.status).toBe("needs_confirmation");
    expect(ev.excludedDishes).toEqual([
      {
        name: "Suya",
        source: "menu_highlight",
        reason: "allergy",
        requirement: "peanut",
        keyword: "suya",
        why: "commonly made with peanut; recipe not verified",
      },
    ]);
    expect(r.warnings).toEqual([
      'qloo.dishHighlights: "Suya" commonly made with peanut; recipe not verified; not suggested',
    ]);
  });

  it("keeps suya when there is no peanut allergy", () => {
    const ev = evaluateCandidate(makeProfile({ allergies: ["shellfish"] }), buka());
    expect(ev.allowedDishes.map((d) => d.name)).toContain("Suya");
  });

  it("covers the tree-nut and sesame dish-name lists", () => {
    const c = makeCandidate({ dishHighlights: ["Basil pesto pasta", "Baklava", "Hummus plate", "Rice"] });
    const removed = (allergy: string) =>
      evaluateCandidate(makeProfile({ allergies: [allergy] }), c).excludedDishes.map((d) => d.name);
    expect(removed("tree nuts")).toEqual(["Basil pesto pasta", "Baklava"]);
    expect(removed("sesame")).toEqual(["Hummus plate"]);
  });

  it("is never matched, even with an 'Allergy friendly' venue tag", () => {
    const izakaya = sampleCandidate(SAMPLES.soup, "The Izakaya NYC");
    const ev = evaluateCandidate(makeProfile({ allergies: ["shellfish"] }), izakaya);
    const r = requirement(ev.requirements, "allergy: shellfish");

    expect(r.status).toBe("needs_confirmation");
    expect(r.evidence).toContain(
      'qloo.tags.dietary_option: "Allergy friendly" (venue-level claim, not a guarantee for any dish)',
    );
    expect(ev.excludedDishes.map((d) => d.name)).toEqual(["Sake clams"]);
  });

  it("adds gluten-free venue tags as positive evidence only", () => {
    const ev = evaluateCandidate(makeProfile({ allergies: ["gluten"] }), buka());
    const r = requirement(ev.requirements, "allergy: gluten");
    expect(r.status).toBe("needs_confirmation");
    expect(r.evidence.some((e) => e.includes('"Gluten free"'))).toBe(true);
  });

  it("states that Qloo has no dish allergen data", () => {
    const ev = evaluateCandidate(makeProfile({ allergies: ["sesame"] }), makeCandidate());
    expect(requirement(ev.requirements, "allergy: sesame").evidence).toContain(
      "qloo: no ingredient or allergen data for dishes; confirm with the restaurant",
    );
  });

  it("flags shellfish in Spanish and Italian dish names", () => {
    const rueDix = sampleCandidate(SAMPLES.westAfricanFela, "Cafe Rue Dix");
    const ev = evaluateCandidate(makeProfile({ allergies: ["shellfish"] }), rueDix);
    expect(ev.excludedDishes.map((d) => d.name)).toEqual(["Gambas a la plancha"]);
  });
});

describe("dietary restrictions", () => {
  it("matches on an explicit venue tag, labelled venue-level", () => {
    const violino = sampleCandidate(SAMPLES.soup, "Il Violino");
    const r = requirement(
      evaluateCandidate(makeProfile({ dietaryRestrictions: ["halal"] }), violino).requirements,
      "diet: halal",
    );
    expect(r.status).toBe("matched");
    expect(r.evidence).toContain(
      'qloo.tags.dietary_option: "Halal" (venue-level tag; confirm with the restaurant)',
    );
  });

  it("does not match when a dish contradicts the venue tag", () => {
    const comePrima = sampleCandidate(SAMPLES.italianSinatra, "Come Prima");
    const ev = evaluateCandidate(makeProfile({ dietaryRestrictions: ["halal"] }), comePrima);
    const r = requirement(ev.requirements, "diet: halal");
    expect(r.status).toBe("needs_confirmation");
    expect(r.warnings).toEqual([
      'qloo.tags: venue tag "Halal" but dish names conflict: "Pork chops"; ask the restaurant',
    ]);
    expect(ev.allowedDishes.map((d) => d.name)).not.toContain("Pork chops");
  });

  it("an 'options' tag (vegetarian) still matches; meat dishes are just not suggested", () => {
    const accraVenue = accra();
    const ev = evaluateCandidate(makeProfile({ dietaryRestrictions: ["vegetarian"] }), accraVenue);
    const r = requirement(ev.requirements, "diet: vegetarian");
    expect(r.status).toBe("matched");
    expect(r.warnings).toEqual([]);
    expect(r.evidence).toContain('qloo.dishes: not suggested because of their names: "Turkey tail", "Baked tilapia"');
    expect(ev.allowedDishes.map((d) => d.name)).toEqual(
      expect.not.arrayContaining(["Turkey tail", "Baked tilapia"]),
    );
  });

  it("'no pork' can never be matched and removes pork dishes", () => {
    const pho = sampleCandidate(SAMPLES.soup, "Phở Bằng");
    const ev = evaluateCandidate(makeProfile({ dietaryRestrictions: ["No pork"] }), pho);
    expect(requirement(ev.requirements, "diet: No pork").status).toBe("needs_confirmation");
    expect(ev.excludedDishes.map((d) => d.name)).toEqual(["Grilled pork chop with rice"]);
  });

  it("needs confirmation when no tag supports it", () => {
    const daMarino = sampleCandidate(SAMPLES.italianSinatra, "Da Marino NYC");
    const ev = evaluateCandidate(makeProfile({ dietaryRestrictions: ["kosher"] }), daMarino);
    const r = requirement(ev.requirements, "diet: kosher");
    expect(r.status).toBe("needs_confirmation");
    expect(r.evidence).toContain('qloo.tags: no venue tag supports "kosher"');
  });
});

describe("texture", () => {
  it("is always needs_confirmation and lists possibly-soft dishes", () => {
    const ev = evaluateCandidate(makeProfile({ texture: "soft" }), buka());
    const r = requirement(ev.requirements, "texture: soft food");
    expect(r.status).toBe("needs_confirmation");
    expect(ev.possiblySoftDishes.map((d) => d.name)).toEqual([
      "Pounded yam",
      "Amala",
      "Moi moi",
      "Pepper soup",
      "Fufu",
    ]);
    expect(r.evidence).toContain('qloo.dishHighlights: "Pepper soup" (possibly soft; confirm)');
  });

  it("never lists a dish excluded for an allergy as possibly soft", () => {
    const ev = evaluateCandidate(makeProfile({ texture: "easy_to_chew", allergies: ["peanut"] }), accra());
    expect(ev.possiblySoftDishes.map((d) => d.name)).not.toContain("Peanut soup");
    expect(ev.possiblySoftDishes.map((d) => d.name)).toContain("Okra soup");
  });

  it("is not evaluated when texture is none", () => {
    const ev = evaluateCandidate(makeProfile(), buka());
    expect(ev.requirements.filter((r) => r.kind === "texture")).toEqual([]);
    expect(ev.possiblySoftDishes).toEqual([]);
  });
});

describe("comfort", () => {
  const quiet = makeProfile({ comfort: { quietPreferred: true } });
  const wheelchair = makeProfile({ comfort: { wheelchairAccess: true } });

  it("quiet: matched on a Quiet tag, conflict on Loud, otherwise needs confirmation", () => {
    const status = (c: Parameters<typeof evaluateCandidate>[1]) =>
      requirement(evaluateCandidate(quiet, c).requirements, "comfort: quiet place").status;
    expect(status(sampleCandidate(SAMPLES.italianSinatra, "Chazz Palminteri Italian Restaurant"))).toBe("matched");
    expect(status(sampleCandidate(SAMPLES.searchKatz, "Delicatessen Aker Brygge"))).toBe("conflict");
    expect(status(buka())).toBe("needs_confirmation");
  });

  it("a loud venue is flagged, not excluded", () => {
    const ev = evaluateCandidate(quiet, sampleCandidate(SAMPLES.searchKatz, "Delicatessen Aker Brygge"));
    expect(ev.excluded).toBe(false);
  });

  it("wheelchair: matched on an accessible-entrance tag, else needs confirmation", () => {
    const status = (c: Parameters<typeof evaluateCandidate>[1]) =>
      requirement(evaluateCandidate(wheelchair, c).requirements, "comfort: wheelchair access").status;
    expect(status(buka())).toBe("matched");
    expect(status(sampleCandidate(SAMPLES.italianSinatra, "Da Marino NYC"))).toBe("needs_confirmation");
    expect(
      status(makeCandidate({ tags: [tag(TAG_TYPES.accessibility, "Wheelchair accessible seating")] })),
    ).toBe("needs_confirmation");
  });

  it("wheelchair: an explicit contradicting tag is a conflict and excludes the venue", () => {
    const c = makeCandidate({ tags: [tag(TAG_TYPES.accessibility, "Not wheelchair accessible")] });
    const ev = evaluateCandidate(wheelchair, c);
    expect(requirement(ev.requirements, "comfort: wheelchair access").status).toBe("conflict");
    expect(ev.excluded).toBe(true);
  });

  it("is not evaluated unless the caregiver set it", () => {
    const c = makeCandidate({ tags: [tag(TAG_TYPES.accessibility, "Not wheelchair accessible")] });
    const ev = evaluateCandidate(makeProfile(), c);
    expect(ev.requirements).toEqual([]);
    expect(ev.excluded).toBe(false);
  });
});

describe("missing data", () => {
  it("every requirement is needs_confirmation when Qloo has no relevant tags", () => {
    const profile = makeProfile({
      allergies: ["peanut"],
      dietaryRestrictions: ["vegetarian"],
      texture: "soft",
      comfort: { quietPreferred: true, wheelchairAccess: true },
    });
    const ev = evaluateCandidate(profile, makeCandidate());
    expect(ev.requirements.map((r) => r.status)).toEqual(Array(5).fill("needs_confirmation"));
    expect(ev.excluded).toBe(false);
  });
});

describe("hard exclusion and dislikes", () => {
  it("excludes a permanently closed venue", () => {
    const ev = evaluateCandidate(makeProfile(), makeCandidate({ isClosed: true }));
    expect(ev.excluded).toBe(true);
    expect(ev.exclusionReasons).toEqual(["qloo.isClosed: venue is marked permanently closed"]);
  });

  it("dislikes remove dishes but are not requirements and never exclude", () => {
    const ev = evaluateCandidate(makeProfile({ dislikes: ["okra"] }), accra());
    expect(ev.excludedDishes).toEqual([
      {
        name: "Okra soup",
        source: "menu_highlight",
        reason: "dislike",
        requirement: "okra",
        keyword: "okra",
        why: 'mentions "okra"',
      },
    ]);
    expect(ev.requirements).toEqual([]);
    expect(ev.excluded).toBe(false);
  });
});

describe("evidence sources", () => {
  it("every evidence and warning string names its source", () => {
    const profile = makeProfile({
      allergies: ["peanuts", "shellfish", "dairy", "mustard"],
      dietaryRestrictions: ["halal", "vegetarian", "no pork", "low salt"],
      dislikes: ["okra"],
      texture: "soft",
      comfort: { quietPreferred: true, wheelchairAccess: true },
    });
    for (const c of allSampleCandidates()) {
      const ev = evaluateCandidate(profile, c);
      for (const r of ev.requirements) {
        for (const line of [...r.evidence, ...r.warnings]) {
          expect(line).toMatch(/^(profile|qloo)(\.[\w.]+)?: /);
        }
        if (r.kind === "allergy" || r.kind === "texture") expect(r.status).toBe("needs_confirmation");
      }
      for (const line of ev.exclusionReasons) expect(line).toMatch(/^qloo\.[\w.]+: /);
    }
  });
});
