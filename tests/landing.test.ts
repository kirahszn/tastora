import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import heroSnapshot from "@/app/_landing/heroSnapshot.json";
import { QLOO_PROOF } from "@/app/_landing/proofStats";
import rerank from "@/app/_landing/rerankSnapshot.json";
import { sieveSamples } from "@/app/_landing/sieveData";
import { evidenceSentence } from "@/lib/ui/rankMovement";
import { displayStatus } from "@/lib/ui/status";

describe("landing page Qloo proof", () => {
  it("quotes each number from its source doc", () => {
    for (const s of QLOO_PROOF) {
      const doc = readFileSync(join(process.cwd(), s.source.doc), "utf8");
      expect({ figure: s.figure, found: doc.includes(s.source.quote) }).toEqual({ figure: s.figure, found: true });
    }
  });

  it("derives each figure from the logged comparison", () => {
    const [sinatra, marley, fela] = QLOO_PROOF;
    // 4 of 10 shared with the baseline → 6 of the top 10 were new.
    expect(sinatra.source.quote).toContain("4/10");
    expect(sinatra.figure).toBe(`${10 - 4} of 10`);
    expect(marley.source.quote).toContain("0/10 shared");
    expect(marley.figure).toBe("0 of 10");
    expect(fela.source.quote).toContain("7 moved");
    expect(fela.figure).toBe("7 of 10");
  });
});

describe("landing re-rank snapshot (Phase 10)", () => {
  it("holds real top-10 lists from one request, with dated sources", () => {
    expect(rerank.baseline.top10).toHaveLength(10);
    expect(rerank.baselineRepeat.sameTop10).toBe(true);
    expect(rerank.signals.map((s) => s.name)).toEqual(["Frank Sinatra", "Bob Marley", "Fela Kuti"]);
    for (const list of [rerank.baseline, ...rerank.signals]) {
      expect(list.top10).toHaveLength(10);
      expect(list.capturedOn).toMatch(/^2026-10-2\d$/);
      expect(new Set(list.top10.map((p) => p.id)).size).toBe(10);
    }
  });

  it("gives the sentence the evidence panel would give", () => {
    const base = new Set(rerank.baseline.top10.map((p) => p.id));
    const sentence = (name: string) => {
      const s = rerank.signals.find((x) => x.name === name)!;
      return evidenceSentence({
        signalsUsed: [{ id: s.source, name: s.name, kind: "artist" }],
        personalisedTop10: s.top10,
        overlapCount: s.top10.filter((p) => base.has(p.id)).length,
        rankChanges: s.top10.filter((p, i) => rerank.baseline.top10[i].id !== p.id).length,
      });
    };
    expect(sentence("Frank Sinatra")).toBe("Frank Sinatra brought in 10 new places and moved all 10.");
    expect(sentence("Bob Marley")).toBe("Bob Marley brought in 8 new places and moved 9 of the 10.");
  });
});

describe("landing safety check (sieve), computed by the Phase 2 engine", () => {
  const [buka, accra, suya] = sieveSamples();

  it("sets Buka's suya aside with the engine's reason and keeps jollof rice to ask about", () => {
    expect(buka.setAside).toEqual([{ name: "Suya", why: "commonly made with peanut; recipe not verified" }]);
    expect(buka.kept[0].name).toBe("Jollof rice");
    expect(buka.listed).toHaveLength(buka.kept.length + buka.setAside.length);
  });

  it("sets aside a dish that names the allergen", () => {
    expect(accra.setAside.map((d) => d.name)).toContain("Peanut soup");
  });

  it("flags a venue where most dishes commonly contain the allergen", () => {
    expect(suya.kept).toEqual([]);
    expect(suya.warnings).toEqual(["Many listed dishes here commonly contain peanut"]);
  });

  it("never shows the peanut allergy or soft food as matched", () => {
    for (const p of [buka, accra, suya]) {
      expect(p.statuses.map((s) => [s.requirement, displayStatus(s).label])).toEqual([
        ["allergy: peanut", "Needs confirmation"],
        ["texture: soft food", "Needs confirmation"],
      ]);
    }
  });

  it("never offers a set-aside dish as one to ask about", () => {
    for (const p of [buka, accra, suya]) {
      const kept = new Set(p.kept.map((d) => d.name));
      expect(p.setAside.filter((d) => kept.has(d.name))).toEqual([]);
    }
  });
});

describe("landing hero card", () => {
  it("is the stored live result, with no need shown as matched unless a venue tag supports it", () => {
    const r = heroSnapshot.result;
    expect(heroSnapshot.capturedOn).toBe("2026-10-27");
    expect(r.name).toBe("Lenny's Clam Bar");
    expect(r.reasons[0].text).toBe("One of Qloo's top 5 matches for people who love Frank Sinatra");
    expect(r.constraintStatuses.map((s) => [s.requirement, s.status])).toEqual([
      ["diet: no pork", "needs_confirmation"],
      ["comfort: wheelchair access", "matched"],
    ]);
    expect(r.reasons.some((x) => x.text === "Venue tag: Wheelchair accessible entrance")).toBe(true);
  });
});
