import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QLOO_PROOF } from "@/app/_landing/proofStats";

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
