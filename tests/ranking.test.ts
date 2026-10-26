import { describe, expect, it } from "vitest";
import { TAG_TYPES } from "@/lib/domain/place";
import { rankCandidates, SCORE_WEIGHTS, type RankedCandidate } from "@/lib/ranking/rank";
import { makeCandidate, makeProfile, SAMPLES, sampleCandidates, tag } from "./helpers/fixtures";

const westAfrican = () => sampleCandidates(SAMPLES.westAfricanFela);
const names = (ranked: RankedCandidate[]) => ranked.map((r) => r.candidate.name);
const byName = (ranked: RankedCandidate[], name: string) => ranked.find((r) => r.candidate.name === name)!;

describe("rankCandidates", () => {
  it("follows Qloo's order when the profile adds nothing else", () => {
    const { ranked, excluded } = rankCandidates(makeProfile(), westAfrican());
    expect(names(ranked)).toEqual([
      "Buka",
      "Joloff",
      "Accra Express Restaurant",
      "Cafe Rue Dix",
      "Brooklyn Suya",
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(excluded).toEqual([]);
  });

  it("gives the Qloo taste signal the largest weight", () => {
    const { ranked } = rankCandidates(makeProfile(), westAfrican());
    expect(ranked[0].score.breakdown.taste).toBe(SCORE_WEIGHTS.tasteMax);
    for (const r of ranked) {
      const { taste, ...rest } = r.score.breakdown;
      expect(taste).toBeGreaterThanOrEqual(Math.max(...Object.values(rest)));
    }
  });

  it("breakdown components always sum to the total", () => {
    const profile = makeProfile({
      favouriteDishes: ["jollof rice", "fufu"],
      dislikes: ["okra", "tilapia"],
      allergies: ["peanut"],
      comfort: { quietPreferred: true, wheelchairAccess: true },
    });
    const { ranked } = rankCandidates(profile, westAfrican(), { liked: [westAfrican()[1].id], tried: [westAfrican()[0].id] });
    for (const r of ranked) {
      const sum = Object.values(r.score.breakdown).reduce((a, n) => a + n, 0);
      expect(r.score.total).toBe(sum);
      expect(Number.isInteger(r.score.total)).toBe(true);
    }
  });

  it("boosts favourite dishes, whole-word, among dishes to ask about", () => {
    const { ranked } = rankCandidates(makeProfile({ favouriteDishes: ["jollof rice", "fufu"] }), westAfrican());
    expect(byName(ranked, "Accra Express Restaurant").matchedFavouriteDishes).toEqual(["jollof rice", "fufu"]);
    expect(byName(ranked, "Accra Express Restaurant").score.breakdown.favouriteDishes).toBe(16);
    expect(byName(ranked, "Joloff").matchedFavouriteDishes).toEqual([]);
  });

  it("does not boost a favourite dish that conflicts with an allergy", () => {
    const { ranked } = rankCandidates(
      makeProfile({ favouriteDishes: ["peanut soup"], allergies: ["peanuts"] }),
      westAfrican(),
    );
    expect(byName(ranked, "Accra Express Restaurant").score.breakdown.favouriteDishes).toBe(0);
  });

  it("penalises dislikes without excluding the venue", () => {
    const { ranked } = rankCandidates(makeProfile({ dislikes: ["soup"] }), westAfrican());
    const accra = byName(ranked, "Accra Express Restaurant");
    // Okra, Peanut, Egusi, Palmnut, Pepper soup: 5 dishes, capped.
    expect(accra.score.breakdown.dislikePenalty).toBe(SCORE_WEIGHTS.dislikedDishMax);
    expect(byName(ranked, "Buka").score.breakdown.dislikePenalty).toBe(SCORE_WEIGHTS.dislikedDish);
  });

  it("scores comfort only when set", () => {
    const plain = rankCandidates(makeProfile(), westAfrican()).ranked;
    expect(plain.every((r) => r.score.breakdown.comfort === 0)).toBe(true);
    const withComfort = rankCandidates(makeProfile({ comfort: { wheelchairAccess: true } }), westAfrican()).ranked;
    expect(byName(withComfort, "Buka").score.breakdown.comfort).toBe(SCORE_WEIGHTS.comfortMatched);
  });

  it("scores information completeness", () => {
    const full = makeCandidate({ id: "a", dishHighlights: ["Rice"] });
    const bare = makeCandidate({ id: "b", website: null, phone: null, hours: null });
    const { ranked } = rankCandidates(makeProfile(), [full, bare]);
    expect(byName(ranked, full.name).score.breakdown.completeness).toBe(10);
    expect(ranked.find((r) => r.candidate.id === "b")!.score.breakdown.completeness).toBe(0);
  });

  it("a closed venue stays excluded despite the best Qloo rank and a favourite dish", () => {
    const closed = makeCandidate({ id: "closed", isClosed: true, qlooRank: 1, dishHighlights: ["Jollof rice"] });
    const open = makeCandidate({ id: "open", qlooRank: 20 });
    const { ranked, excluded } = rankCandidates(makeProfile({ favouriteDishes: ["jollof rice"] }), [closed, open]);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["open"]);
    expect(excluded.map((e) => e.candidate.id)).toEqual(["closed"]);
  });

  it("never ranks hard-excluded candidates, and reports them", () => {
    const closed = makeCandidate({ id: "closed", isClosed: true, qlooRank: 1 });
    const blocked = makeCandidate({
      id: "blocked",
      qlooRank: 2,
      tags: [tag(TAG_TYPES.accessibility, "Not wheelchair accessible")],
    });
    const ok = makeCandidate({ id: "ok", qlooRank: 3 });
    const { ranked, excluded } = rankCandidates(makeProfile({ comfort: { wheelchairAccess: true } }), [closed, blocked, ok]);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["ok"]);
    expect(excluded.map((e) => e.candidate.id)).toEqual(["closed", "blocked"]);
    expect(excluded[0].reasons[0]).toMatch(/^qloo\.isClosed/);
  });

  describe("feedback", () => {
    const list = westAfrican();
    const [buka, joloff, , rueDix] = list.map((c) => c.id);

    it("removes notSuitable", () => {
      const { ranked, excluded } = rankCandidates(makeProfile(), list, { notSuitable: [buka] });
      expect(ranked.map((r) => r.candidate.id)).not.toContain(buka);
      expect(excluded[0].reasons).toEqual(["feedback.notSuitable: caregiver marked it not suitable"]);
    });

    it("demotes disliked", () => {
      const before = rankCandidates(makeProfile(), list).ranked.find((r) => r.candidate.id === buka)!;
      const after = rankCandidates(makeProfile(), list, { disliked: [buka] }).ranked.find(
        (r) => r.candidate.id === buka,
      )!;
      expect(after.score.total).toBe(before.score.total + SCORE_WEIGHTS.feedbackDisliked);
      expect(after.rank).toBeGreaterThan(before.rank);
    });

    it("demotes tried slightly", () => {
      const { ranked } = rankCandidates(makeProfile(), list, { tried: [joloff] });
      expect(byName(ranked, "Joloff").score.breakdown.feedback).toBe(SCORE_WEIGHTS.feedbackTried);
      expect(byName(ranked, "Joloff").rank).toBe(2); // slight: not enough to drop a rank here
    });

    it("boosts candidates sharing a cuisine with a liked one", () => {
      const { ranked } = rankCandidates(makeProfile(), list, { liked: [rueDix] });
      // Cafe Rue Dix: French, Senegalese, African.
      expect(byName(ranked, "Joloff").likedCuisines).toEqual(["African", "Senegalese"]);
      expect(byName(ranked, "Joloff").score.breakdown.feedback).toBe(SCORE_WEIGHTS.feedbackLikedCuisine);
      expect(byName(ranked, "Accra Express Restaurant").likedCuisines).toEqual(["African"]);
    });
  });

  it("returns the top 8 by default, and honours a limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => makeCandidate({ id: `c${i}`, qlooRank: i + 1 }));
    expect(rankCandidates(makeProfile(), many).ranked).toHaveLength(8);
    expect(rankCandidates(makeProfile(), many, {}, { limit: 3 }).ranked).toHaveLength(3);
  });

  it("breaks ties by qlooRank, then id, independent of input order", () => {
    // Same qlooRank and data: tie on score and rank, so id decides.
    const a = makeCandidate({ id: "b-id", qlooRank: 2 });
    const b = makeCandidate({ id: "a-id", qlooRank: 2 });
    const c = makeCandidate({ id: "z-id", qlooRank: 1, website: null }); // loses 3 completeness, gains taste
    const forward = rankCandidates(makeProfile(), [a, b, c]).ranked.map((r) => r.candidate.id);
    const reverse = rankCandidates(makeProfile(), [c, b, a]).ranked.map((r) => r.candidate.id);
    expect(forward).toEqual(["z-id", "a-id", "b-id"]);
    expect(reverse).toEqual(forward);
  });

  it("is deterministic", () => {
    const profile = makeProfile({ favouriteDishes: ["suya"], dislikes: ["okra"] });
    expect(rankCandidates(profile, westAfrican())).toEqual(rankCandidates(profile, westAfrican()));
  });
});
