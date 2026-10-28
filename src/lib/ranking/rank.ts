// Pure, explainable ranking. Every score is a sum of integer components (see SCORE_WEIGHTS and
// docs/data-model.md); the breakdown always adds up to the total.
import { evaluateCandidate, type CandidateEvaluation } from "@/lib/constraints/evaluate";
import { containsKeyword } from "@/lib/constraints/keywords";
import { detectProfileBorough, detectVenueArea, type Borough, type VenueArea } from "@/lib/domain/borough";
import { detectCityArea, isNewYorkCity, type CityArea } from "@/lib/domain/location";
import type { Candidate } from "@/lib/domain/place";
import type { SeniorProfile } from "@/lib/domain/profile";

export const SCORE_WEIGHTS = {
  /** Qloo taste signal: rank 1 gets the full amount, scaling down linearly to the last rank. */
  tasteMax: 50,
  /** Per favourite dish found among the dishes to ask about. */
  favouriteDish: 8,
  favouriteDishMax: 16,
  /** Per comfort need (only those the caregiver set). */
  comfortMatched: 5,
  comfortConflict: -5,
  /** Information completeness: one each for website, phone, hours, any dishes. */
  completenessWebsite: 3,
  completenessPhone: 3,
  completenessHours: 2,
  completenessDishes: 2,
  /** Per dish removed because it mentions a dislike. */
  dislikedDish: -3,
  dislikedDishMax: -9,
  /**
   * Allergen-heavy venue: at least half of its listed dishes were set aside for one allergen.
   * Applied once per venue (the worst allergen), and only when it lists at least
   * `allergenHeavyMinDishes` dishes, so one removed dish out of one doesn't count.
   */
  allergenHeavy: -8,
  allergenAllDishes: -15,
  allergenHeavyRatio: 0.5,
  allergenHeavyMinDishes: 2,
  /** Caregiver feedback on earlier results. */
  feedbackDisliked: -20,
  feedbackTried: -3,
  feedbackLikedCuisine: 4,
  /** New York City, only when the profile names a borough: same borough, or clearly outside NYC. */
  sameBorough: 6,
  outsideNyc: -6,
  /** Other cities (location.ts): Qloo's geocode city or metro is the city asked for. Same weight as a borough. */
  sameCity: 6,
} as const;

/** Where a venue is: NYC borough areas, or the same-city rule elsewhere. */
export type PlaceArea = VenueArea | CityArea;

export const DEFAULT_RESULT_LIMIT = 8;

/** Candidate ids from caregiver feedback on earlier results. */
export interface RankingFeedback {
  liked?: readonly string[];
  disliked?: readonly string[];
  /** Removed entirely. */
  notSuitable?: readonly string[];
  tried?: readonly string[];
}

export interface ScoreBreakdown {
  taste: number;
  favouriteDishes: number;
  comfort: number;
  completeness: number;
  dislikePenalty: number;
  allergenPenalty: number;
  feedback: number;
  /** Location: the borough rule in NYC, the same-city rule elsewhere. */
  borough: number;
}

/** An allergen for which at least half of a venue's listed dishes were set aside. */
export interface AllergenHeavy {
  /** The profile entry, e.g. "peanut". */
  allergen: string;
  removed: number;
  total: number;
}

export interface RankedCandidate {
  rank: number;
  candidate: Candidate;
  evaluation: CandidateEvaluation;
  score: { total: number; breakdown: ScoreBreakdown };
  /** Profile favourite dishes found among the dishes to ask about. */
  matchedFavouriteDishes: string[];
  /** Cuisines shared with a candidate the caregiver liked. */
  likedCuisines: string[];
  /** Where the venue is, and the borough the profile asked for (null if none named, or not NYC). */
  area: PlaceArea;
  requestedBorough: Borough | null;
  /** The profile's city as typed. */
  requestedCity: string;
}

export interface ExcludedCandidate {
  candidate: Candidate;
  reasons: string[];
}

export interface RankingResult {
  ranked: RankedCandidate[];
  /** Hard-excluded or marked not suitable; never ranked, listed so nothing is hidden silently. */
  excluded: ExcludedCandidate[];
}

const sum = (b: ScoreBreakdown) => Object.values(b).reduce((a, n) => a + n, 0);

function tasteScore(qlooRank: number, maxRank: number): number {
  return Math.round((SCORE_WEIGHTS.tasteMax * (maxRank - qlooRank + 1)) / maxRank);
}

function matchFavouriteDishes(profile: SeniorProfile, evaluation: CandidateEvaluation): string[] {
  return profile.favouriteDishes.filter((fav) =>
    evaluation.allowedDishes.some((d) => containsKeyword(d.name, fav)),
  );
}

function comfortScore(evaluation: CandidateEvaluation): number {
  return evaluation.requirements
    .filter((r) => r.kind === "comfort")
    .reduce(
      (n, r) =>
        n +
        (r.status === "matched"
          ? SCORE_WEIGHTS.comfortMatched
          : r.status === "conflict"
            ? SCORE_WEIGHTS.comfortConflict
            : 0),
      0,
    );
}

function completenessScore(c: Candidate): number {
  const w = SCORE_WEIGHTS;
  return (
    (c.website ? w.completenessWebsite : 0) +
    (c.phone ? w.completenessPhone : 0) +
    (c.hours ? w.completenessHours : 0) +
    (c.dishHighlights.length || c.specialtyDishes.length ? w.completenessDishes : 0)
  );
}

function dislikePenalty(evaluation: CandidateEvaluation): number {
  const dishes = new Set(
    evaluation.excludedDishes.filter((d) => d.reason === "dislike").map((d) => d.name.toLowerCase()),
  );
  // Guard keeps 0 rather than -0 (0 × -3) when nothing is disliked.
  return dishes.size ? Math.max(SCORE_WEIGHTS.dislikedDishMax, dishes.size * SCORE_WEIGHTS.dislikedDish) : 0;
}

/** Allergens that removed at least half of the venue's listed dishes, worst first. */
export function allergenHeavyAllergens(evaluation: CandidateEvaluation): AllergenHeavy[] {
  const key = (name: string) => name.toLowerCase();
  const total = new Set([...evaluation.allowedDishes, ...evaluation.excludedDishes].map((d) => key(d.name))).size;
  if (total < SCORE_WEIGHTS.allergenHeavyMinDishes) return [];
  const removedBy = new Map<string, Set<string>>();
  for (const d of evaluation.excludedDishes) {
    if (d.reason !== "allergy") continue;
    const set = removedBy.get(d.requirement) ?? new Set<string>();
    set.add(key(d.name));
    removedBy.set(d.requirement, set);
  }
  return [...removedBy]
    .map(([allergen, dishes]) => ({ allergen, removed: dishes.size, total }))
    .filter((a) => a.removed / a.total >= SCORE_WEIGHTS.allergenHeavyRatio)
    .sort((a, b) => b.removed - a.removed);
}

/** Ranks, never filters: a venue elsewhere stays in the list with a label. */
export function boroughScore(requested: Borough | null, area: VenueArea): number {
  if (!requested) return 0;
  if (area.kind === "borough") return area.borough === requested ? SCORE_WEIGHTS.sameBorough : 0;
  return area.kind === "outside_nyc" ? SCORE_WEIGHTS.outsideNyc : 0;
}

/** Outside NYC. Ranks, never filters: "Nearby" and unknown places get 0, not a penalty. */
export function cityScore(area: CityArea | null): number {
  return area && (area.kind === "same_city" || area.kind === "same_metro") ? SCORE_WEIGHTS.sameCity : 0;
}

function allergenPenalty(heavy: AllergenHeavy[]): number {
  if (!heavy.length) return 0;
  return heavy[0].removed === heavy[0].total ? SCORE_WEIGHTS.allergenAllDishes : SCORE_WEIGHTS.allergenHeavy;
}

/**
 * Rank candidates for a profile. Hard-excluded and "not suitable" candidates never appear in
 * `ranked`. Order: total score desc, then qlooRank asc, then id asc (deterministic).
 */
export function rankCandidates(
  profile: SeniorProfile,
  candidates: readonly Candidate[],
  feedback: RankingFeedback = {},
  options: {
    limit?: number;
    /** Other names for the profile city, e.g. the locality Qloo resolved it to ("Los Angeles" for "LA"). */
    cityNames?: readonly string[];
  } = {},
): RankingResult {
  const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
  const maxRank = Math.max(1, ...candidates.map((c) => c.qlooRank));
  const nyc = isNewYorkCity(profile.city);
  const requestedBorough = nyc ? (detectProfileBorough(profile.area ?? "") ?? detectProfileBorough(profile.city)) : null;
  const cityNames = [profile.city, ...(options.cityNames ?? [])];
  const locate = (c: Candidate): { area: PlaceArea; points: number } => {
    if (nyc) {
      const area = detectVenueArea(c);
      return { area, points: boroughScore(requestedBorough, area) };
    }
    const area = detectCityArea(c.geocode, cityNames);
    return { area: area ?? { kind: "unknown" }, points: cityScore(area) };
  };
  const notSuitable = new Set(feedback.notSuitable ?? []);
  const disliked = new Set(feedback.disliked ?? []);
  const tried = new Set(feedback.tried ?? []);
  const likedIds = new Set(feedback.liked ?? []);
  const likedCuisineSet = new Set(
    candidates.filter((c) => likedIds.has(c.id)).flatMap((c) => c.cuisines.map((x) => x.toLowerCase())),
  );

  const excluded: ExcludedCandidate[] = [];
  const scored: Omit<RankedCandidate, "rank">[] = [];

  for (const candidate of candidates) {
    const evaluation = evaluateCandidate(profile, candidate);
    const reasons = [...evaluation.exclusionReasons];
    if (notSuitable.has(candidate.id)) reasons.push("feedback.notSuitable: caregiver marked it not suitable");
    if (reasons.length) {
      excluded.push({ candidate, reasons });
      continue;
    }

    const matchedFavouriteDishes = matchFavouriteDishes(profile, evaluation);
    const likedCuisines = candidate.cuisines.filter((c) => likedCuisineSet.has(c.toLowerCase()));
    const { area, points } = locate(candidate);
    const breakdown: ScoreBreakdown = {
      taste: tasteScore(candidate.qlooRank, maxRank),
      favouriteDishes: Math.min(
        SCORE_WEIGHTS.favouriteDishMax,
        matchedFavouriteDishes.length * SCORE_WEIGHTS.favouriteDish,
      ),
      comfort: comfortScore(evaluation),
      completeness: completenessScore(candidate),
      dislikePenalty: dislikePenalty(evaluation),
      allergenPenalty: allergenPenalty(allergenHeavyAllergens(evaluation)),
      feedback:
        (disliked.has(candidate.id) ? SCORE_WEIGHTS.feedbackDisliked : 0) +
        (tried.has(candidate.id) ? SCORE_WEIGHTS.feedbackTried : 0) +
        (likedCuisines.length ? SCORE_WEIGHTS.feedbackLikedCuisine : 0),
      borough: points,
    };
    scored.push({
      candidate,
      evaluation,
      score: { total: sum(breakdown), breakdown },
      matchedFavouriteDishes,
      likedCuisines,
      area,
      requestedBorough,
      requestedCity: profile.city,
    });
  }

  scored.sort(
    (a, b) =>
      b.score.total - a.score.total ||
      a.candidate.qlooRank - b.candidate.qlooRank ||
      (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0),
  );

  return {
    ranked: scored.slice(0, limit).map((s, i) => ({ ...s, rank: i + 1 })),
    excluded,
  };
}
