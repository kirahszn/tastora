import { describe, expect, it } from "vitest";
import {
  buildAllExplanationFacts,
  buildExplanationFacts,
  midSentence,
  POSSIBLY_SOFT_NOTE,
  tasteReasonText,
} from "@/lib/agent/explanationFacts";
import { rankCandidates } from "@/lib/ranking/rank";
import {
  allSampleCandidates,
  makeCandidate,
  makeProfile,
  SAMPLES,
  sampleCandidates,
} from "./helpers/fixtures";

// The worked example from docs/ranking-and-constraints.md.
const workedProfile = makeProfile({
  favouriteCuisines: ["Nigerian"],
  favouriteDishes: ["jollof rice"],
  allergies: ["peanut"],
  texture: "soft",
  tasteMemories: { music: ["Fela Kuti"] },
  location: "Brooklyn",
});

function workedFacts() {
  const { ranked } = rankCandidates(workedProfile, sampleCandidates(SAMPLES.westAfricanFela));
  return buildAllExplanationFacts(workedProfile, ranked);
}

const factsFor = (name: string) => workedFacts().find((f) => f.name === name)!;

describe("worked example (West African + Fela Kuti sample)", () => {
  it("ranks Buka, Joloff, Accra Express with these breakdowns", () => {
    const zero = { comfort: 0, completeness: 10, dislikePenalty: 0, feedback: 0 };
    // Borough: the profile asks for Brooklyn; Accra Express is in Manhattan (ZIP 10035).
    expect(workedFacts().map((f) => [f.name, f.scoreBreakdown])).toEqual([
      ["Buka", { ...zero, taste: 50, favouriteDishes: 8, allergenPenalty: 0, borough: 6, total: 74 }],
      ["Joloff", { ...zero, taste: 40, favouriteDishes: 0, allergenPenalty: 0, borough: 6, total: 56 }],
      ["Accra Express Restaurant", { ...zero, taste: 30, favouriteDishes: 8, allergenPenalty: 0, borough: 0, total: 48 }],
      ["Cafe Rue Dix", { ...zero, taste: 20, favouriteDishes: 0, allergenPenalty: 0, borough: 6, total: 36 }],
      // Every listed dish was set aside for peanut: the largest allergen penalty.
      ["Brooklyn Suya", { ...zero, taste: 10, favouriteDishes: 0, allergenPenalty: -15, borough: 6, total: 11 }],
    ]);
    expect(workedFacts().map((f) => f.area.label)).toEqual([
      "In Brooklyn",
      "In Brooklyn",
      "In Manhattan",
      "In Brooklyn",
      "In Brooklyn",
    ]);
  });

  it("warns when most listed dishes commonly contain the allergen", () => {
    const suya = factsFor("Brooklyn Suya");
    expect(suya.warnings).toHaveLength(1);
    expect(suya.warnings[0].text).toBe("Many listed dishes here commonly contain peanut");
    expect(suya.warnings[0].source).toMatch(/^profile\.allergies: "peanut" ↔ qloo\.dishes: (\d+) of \1 listed/);
    expect(factsFor("Buka").warnings).toEqual([]);
  });

  it("gives Joloff a lower-weight related-cuisine reason (West African ↔ Nigerian)", () => {
    const related = factsFor("Joloff").reasons.filter((r) => r.strength === "related");
    expect(related).toEqual([
      {
        text: "West African — related to Nigerian",
        source: "profile.favouriteCuisines: Nigerian ↔ Qloo tag urn:tag:cuisine:qloo:west_african (related cuisine)",
        strength: "related",
      },
    ]);
    // Buka carries the Nigerian tag itself, so no related reason.
    expect(factsFor("Buka").reasons.some((r) => r.strength === "related")).toBe(false);
  });

  it("explains Buka with sourced reasons", () => {
    expect(factsFor("Buka").reasons).toEqual([
      {
        text: "One of Qloo's top 5 matches for people who love Fela Kuti",
        source: "profile.tasteMemories ↔ Qloo taste rank #1 with signals: Fela Kuti (query.affinity 0.85)",
      },
      {
        text: "Serves Nigerian food",
        source: "profile.favouriteCuisines: Nigerian ↔ Qloo tag urn:tag:cuisine:qloo:nigerian",
      },
      {
        text: "Lists Jollof rice, a favourite dish",
        source: "profile.favouriteDishes: jollof rice ↔ Qloo tag urn:tag:menu_highlight:qloo:jollof_rice",
      },
      {
        text: "In Brooklyn, the borough you chose",
        source: "profile.location: Brooklyn ↔ Qloo properties.address: NY 11238",
      },
    ]);
  });

  it("removes suya (dish-name list) and peanut soup (keyword), keeping favourites first", () => {
    const buka = factsFor("Buka");
    expect(buka.removedDishes).toEqual([
      {
        name: "Suya",
        source: "qloo.dishHighlights",
        reason: "allergy",
        requirement: "peanut",
        why: "commonly made with peanut; recipe not verified",
      },
    ]);
    expect(buka.dishesToAskAbout[0]).toEqual({ name: "Jollof rice", source: "qloo.dishHighlights" });
    expect(buka.dishesToAskAbout[1]).toEqual({ name: "Pounded yam", source: "qloo.dishHighlights", note: POSSIBLY_SOFT_NOTE });

    const accra = factsFor("Accra Express Restaurant");
    expect(accra.removedDishes.map((d) => [d.name, d.why])).toEqual([["Peanut soup", 'mentions "peanut"']]);
  });

  it("keeps allergy and texture as needs_confirmation and lists what to ask", () => {
    const buka = factsFor("Buka");
    expect(buka.constraintStatuses.map((r) => [r.requirement, r.status])).toEqual([
      ["allergy: peanut", "needs_confirmation"],
      ["texture: soft food", "needs_confirmation"],
    ]);
    expect(buka.needsConfirmation).toEqual([
      "Can dishes be made without peanut? (Qloo has no allergen data)",
      "Which dishes are soft food?",
    ]);
  });

  it("says so when every listed dish was set aside", () => {
    const suya = factsFor("Brooklyn Suya");
    expect(suya.dishesToAskAbout).toEqual([]);
    expect(suya.needsConfirmation).toContain(
      "What can you serve that fits their needs? (every dish Qloo lists was set aside)",
    );
  });
});

describe("Qloo taste reason wording", () => {
  it("names the signals and a rank band, never the exact rank", () => {
    expect(tasteReasonText(3, ["Frank Sinatra"])).toBe("One of Qloo's top 5 matches for people who love Frank Sinatra");
    expect(tasteReasonText(5, ["Frank Sinatra", "Dean Martin"])).toBe(
      "One of Qloo's top 5 matches for people who love Frank Sinatra and Dean Martin",
    );
    expect(tasteReasonText(6, ["Frank Sinatra"])).toBe("In Qloo's top 10 for people who love Frank Sinatra");
    expect(tasteReasonText(10, ["A", "B", "C"])).toBe("In Qloo's top 10 for people who love A, B and C");
    expect(tasteReasonText(11, ["Frank Sinatra"])).toBe("Matched by Qloo's taste data for this search");
    expect(tasteReasonText(1, [])).toBe("Matched by Qloo's taste data for this search");
  });

  it("keeps the exact rank in the source", () => {
    const profile = makeProfile({ favouriteCuisines: ["Italian"] });
    const [item] = rankCandidates(profile, [makeCandidate({ qlooRank: 7 })]).ranked;
    const reason = buildExplanationFacts(profile, item, { tasteSignals: [] }).reasons[0];
    expect(reason.text).toBe("Matched by Qloo's taste data for this search");
    expect(reason.source).toContain("Qloo rank #7 (no taste signals)");
    for (const f of workedFacts()) expect(f.reasons[0].text).not.toMatch(/#\d/);
  });
});

describe("allergen dishes never reach dishesToAskAbout", () => {
  const dishes = ["Groundnut stew", "Beef suya", "Chicken satay", "Peanut soup", "Jollof rice", "Pea soup"];
  const candidate = makeCandidate({ dishHighlights: dishes });
  const names = (allergies: string[]) => {
    const profile = makeProfile({ allergies });
    const [item] = rankCandidates(profile, [candidate]).ranked;
    return buildExplanationFacts(profile, item).dishesToAskAbout.map((d) => d.name);
  };

  it("removes synonym and dish-name matches for a 'groundnuts' allergy", () => {
    expect(names(["groundnuts"])).toEqual(["Jollof rice", "Pea soup"]);
  });

  it("keeps them all with no allergy", () => {
    expect(names([])).toEqual(dishes);
  });

  it("holds across every recorded sample", () => {
    const profile = makeProfile({ allergies: ["peanut", "shellfish"] });
    const { ranked } = rankCandidates(profile, allSampleCandidates(), {}, { limit: 50 });
    for (const f of buildAllExplanationFacts(profile, ranked)) {
      for (const d of f.dishesToAskAbout) {
        expect(d.name).not.toMatch(/\b(peanut|groundnut|suya|satay|mafe|shrimp|clams?|gambas)\b/i);
      }
    }
  });
});

describe("facts contain only source data", () => {
  const richProfile = makeProfile({
    favouriteCuisines: ["Italian", "Nigerian"],
    favouriteDishes: ["lasagna", "jollof rice", "soup"],
    allergies: ["peanut", "dairy"],
    dietaryRestrictions: ["halal", "vegetarian"],
    dislikes: ["okra"],
    texture: "easy_to_chew",
    tasteMemories: { music: ["Frank Sinatra"] },
    comfort: { quietPreferred: true, wheelchairAccess: true },
  });
  const candidates = allSampleCandidates();
  const { ranked } = rankCandidates(richProfile, candidates, { liked: [candidates[0].id] }, { limit: 50 });
  const facts = buildAllExplanationFacts(richProfile, ranked);

  it("never mentions ordering", () => {
    expect(JSON.stringify(facts)).not.toMatch(/\border(s|ed|ing)?\b/i);
  });

  it("only cites dishes and tags the candidate actually has", () => {
    for (const f of facts) {
      const c = candidates.find((x) => x.id === f.candidateId)!;
      const known = new Set([...c.dishHighlights, ...c.specialtyDishes]);
      for (const d of [...f.dishesToAskAbout, ...f.removedDishes]) expect(known.has(d.name)).toBe(true);
      const tagIds = new Set(c.tags.map((t) => t.id));
      for (const r of f.reasons) {
        expect(r.source).toMatch(/^(profile\.|feedback\.)/);
        expect(r.source).toContain("Qloo");
        for (const [, id] of r.source.matchAll(/Qloo tag (\S+?)(?:,|$|\s)/g)) expect(tagIds.has(id)).toBe(true);
      }
    }
  });

  it("omits links Qloo did not provide and asks about missing hours", () => {
    const bare = makeCandidate({ website: null, phone: null, mapsUrl: null, hours: null });
    const [item] = rankCandidates(makeProfile(), [bare]).ranked;
    const f = buildExplanationFacts(makeProfile(), item);
    expect(f.links).toEqual({});
    expect(f.needsConfirmation).toEqual(["What are your opening hours? (none listed)"]);
  });

  it("phrases 'no X' restrictions as a plain question", () => {
    const profile = makeProfile({ dietaryRestrictions: ["no pork", "halal"] });
    const [item] = rankCandidates(profile, [makeCandidate()]).ranked;
    const asks = buildExplanationFacts(profile, item).needsConfirmation;
    expect(asks).toContain("Which dishes are made without pork?");
    expect(asks).toContain("What halal options do you have?");
  });

  it("asks about every allergy in one question, with the allergen note once (Phase 11)", () => {
    const profile = makeProfile({
      allergies: ["Shellfish", "Sesame", "Soy"],
      dietaryRestrictions: ["Dairy-free", "No pork"],
      texture: "easy_to_chew",
    });
    const [item] = rankCandidates(profile, [makeCandidate()]).ranked;
    const asks = buildExplanationFacts(profile, item).needsConfirmation;
    expect(asks.slice(0, 4)).toEqual([
      "Can dishes be made without shellfish, sesame or soy? (Qloo has no allergen data)",
      "What dairy-free options do you have?",
      "Which dishes are made without pork?",
      "Which dishes are easy to chew?",
    ]);
    expect(asks.join(" ").match(/Qloo has no allergen data/g)).toHaveLength(1);
  });

  it("keeps a need typed in capitals as typed mid-sentence", () => {
    expect(midSentence("MSG")).toBe("MSG");
    expect(midSentence("Tree nuts")).toBe("tree nuts");
    expect(midSentence("halal")).toBe("halal");
  });

  it("writes every question as a question, with no 'Ask…' prefix", () => {
    for (const f of facts) {
      for (const q of f.needsConfirmation) {
        expect(q).not.toMatch(/^(Ask|Confirm)\b/);
        expect(q).toMatch(/\?( \(.+\))?$/);
      }
    }
  });

  it("score breakdown sums to its total", () => {
    for (const f of facts) {
      const { total, ...parts } = f.scoreBreakdown;
      expect(Object.values(parts).reduce((a, n) => a + n, 0)).toBe(total);
    }
  });
});
