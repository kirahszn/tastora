// Pure constraint engine: checks one candidate against the profile's explicit needs.
//
// Ground rules (see docs/data-model.md):
// - Allergies and texture are never "matched": Qloo has no ingredient, allergen or texture data.
// - Missing information is "needs_confirmation", never safe.
// - Only a permanently closed venue, or an explicit tag contradicting required wheelchair access,
//   removes a candidate. Everything else is flagged, not hidden.
// Every evidence and warning string starts with its source: `profile.<field>` or `qloo.<field>`.
import { TAG_TYPES, type Candidate, type Tag } from "@/lib/domain/place";
import type { SeniorProfile } from "@/lib/domain/profile";
import {
  allergenRule,
  containsKeyword,
  dietRule,
  findKeyword,
  normalizeTerm,
  SOFT_DISH_KEYWORDS,
  type AllergenRule,
} from "./keywords";

export type RequirementStatus = "matched" | "needs_confirmation" | "conflict";
export type RequirementKind = "allergy" | "diet" | "texture" | "comfort";

export interface RequirementResult {
  kind: RequirementKind;
  /** Human-readable label, e.g. "allergy: peanuts". */
  requirement: string;
  status: RequirementStatus;
  /** evidence[0] always echoes the profile entry, e.g. `profile.allergies: "peanuts"`. */
  evidence: string[];
  /** Specific problems to tell the caregiver about, e.g. a dish that mentions the allergen. */
  warnings: string[];
  /** Qloo tags that support the requirement (positive notes only for allergies). */
  supportingTags: Tag[];
}

export type DishSource = "menu_highlight" | "specialty_dish";

export interface Dish {
  name: string;
  source: DishSource;
}

export interface ExcludedDish extends Dish {
  reason: "allergy" | "diet" | "dislike";
  /** The profile entry that caused it, e.g. "peanuts". */
  requirement: string;
  /** The word or dish name that matched. */
  keyword: string;
  /** Why it was removed, e.g. `mentions "peanut"` or `commonly made with peanut; recipe not verified`. */
  why: string;
}

export interface CandidateEvaluation {
  candidateId: string;
  /** True when the candidate must not be shown at all. */
  excluded: boolean;
  exclusionReasons: string[];
  requirements: RequirementResult[];
  /** Dishes left after allergy, diet and dislike exclusions ("dishes to ask about"). */
  allowedDishes: Dish[];
  excludedDishes: ExcludedDish[];
  /** Subset of allowedDishes whose names suggest softer food. Empty unless texture is set. */
  possiblySoftDishes: Dish[];
}

const DIETARY_TAG_TYPES = [TAG_TYPES.dietaryOption, TAG_TYPES.offerings];
const LOUD_NOISE = ["loud", "very loud"];
const NOISY_AMBIENCE = ["noisy"];
const QUIET = ["quiet"];
const WHEELCHAIR_ENTRANCE = "wheelchair accessible entrance";
// Never observed in Phase 1 data (216 places); kept so an explicit negative tag is honoured.
const WHEELCHAIR_CONTRADICTION =
  /\b(not|no|non)[\s-]+wheelchair|\bwheelchair[\s-]+(inaccessible|not accessible)|\binaccessible\b/i;

const TEXTURE_LABEL = { soft: "soft food", easy_to_chew: "easy to chew" } as const;

function dishSource(dish: Dish): string {
  return dish.source === "menu_highlight" ? "qloo.dishHighlights" : "qloo.specialtyDishes";
}

/** `urn:tag:dietary_option:qloo` → `qloo.tags.dietary_option`. */
function tagSource(tag: Tag): string {
  return `qloo.tags.${tag.type?.split(":")[2] ?? "unknown"}`;
}

/** Highlights first, then specialty dishes, de-duplicated by name. */
export function candidateDishes(candidate: Candidate): Dish[] {
  const seen = new Set<string>();
  const out: Dish[] = [];
  const add = (name: string, source: DishSource) => {
    const key = normalizeTerm(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, source });
  };
  candidate.dishHighlights.forEach((n) => add(n, "menu_highlight"));
  candidate.specialtyDishes.forEach((n) => add(n, "specialty_dish"));
  return out;
}

function tagsOfType(candidate: Candidate, types: readonly string[]): Tag[] {
  return candidate.tags.filter((t) => t.type !== null && types.includes(t.type));
}

function tagsNamed(tags: Tag[], names: readonly string[]): Tag[] {
  const wanted = new Set(names.map(normalizeTerm));
  return tags.filter((t) => wanted.has(normalizeTerm(t.name)));
}

function dishConflicts(
  dishes: Dish[],
  keywords: readonly string[],
  reason: ExcludedDish["reason"],
  requirement: string,
): ExcludedDish[] {
  return dishes.flatMap((dish) => {
    const keyword = findKeyword(dish.name, keywords);
    return keyword ? [{ ...dish, reason, requirement, keyword, why: `mentions "${keyword}"` }] : [];
  });
}

/** Dishes that name the allergen, or are commonly made with it (e.g. suya for peanut). */
function allergyConflicts(dishes: Dish[], allergy: string, rule: AllergenRule): ExcludedDish[] {
  return dishes.flatMap((dish): ExcludedDish[] => {
    const keyword = findKeyword(dish.name, rule.dishKeywords);
    if (keyword) {
      return [{ ...dish, reason: "allergy", requirement: allergy, keyword, why: `mentions "${keyword}"` }];
    }
    const common = rule.commonDishes.find((c) => containsKeyword(dish.name, c.dish));
    if (!common) return [];
    return [
      {
        ...dish,
        reason: "allergy",
        requirement: allergy,
        keyword: common.dish,
        why: `commonly made with ${common.allergen}; recipe not verified`,
      },
    ];
  });
}

function evaluateAllergy(candidate: Candidate, dishes: Dish[], allergy: string) {
  const rule = allergenRule(allergy);
  const conflicts = allergyConflicts(dishes, allergy, rule);
  const venueTags = tagsNamed(tagsOfType(candidate, DIETARY_TAG_TYPES), rule.venueTags);

  const result: RequirementResult = {
    kind: "allergy",
    requirement: `allergy: ${allergy}`,
    status: "needs_confirmation",
    evidence: [
      `profile.allergies: "${allergy}"`,
      ...venueTags.map(
        (t) => `${tagSource(t)}: "${t.name}" (venue-level claim, not a guarantee for any dish)`,
      ),
      "qloo: no ingredient or allergen data for dishes; confirm with the restaurant",
    ],
    warnings: conflicts.map((d) => `${dishSource(d)}: "${d.name}" ${d.why}; not suggested`),
    supportingTags: venueTags,
  };
  return { result, conflicts };
}

function evaluateDiet(candidate: Candidate, dishes: Dish[], restriction: string) {
  const rule = dietRule(restriction);
  const named = dishConflicts(dishes, rule.conflictKeywords, "diet", restriction);
  const often = dishes.flatMap((dish): ExcludedDish[] => {
    if (named.some((d) => d.name === dish.name)) return [];
    const common = rule.commonDishes?.find((c) => containsKeyword(dish.name, c.dish));
    if (!common) return [];
    const why = `often made with ${common.madeWith}; recipe not verified`;
    return [{ ...dish, reason: "diet", requirement: restriction, keyword: common.dish, why }];
  });
  const conflicts = [...named, ...often];
  const venueTags = tagsNamed(tagsOfType(candidate, DIETARY_TAG_TYPES), rule.venueTags);
  const dishList = conflicts.map((d) => `"${d.name}"`).join(", ");
  // A venue-wide tag contradicted by a dish name (e.g. "Halal" + "Pork chops") is not a match.
  const contradicted = rule.venueWide === true && venueTags.length > 0 && conflicts.length > 0;

  const result: RequirementResult = {
    kind: "diet",
    requirement: `diet: ${restriction}`,
    status: venueTags.length && !contradicted ? "matched" : "needs_confirmation",
    evidence: [
      `profile.dietaryRestrictions: "${restriction}"`,
      ...(venueTags.length
        ? venueTags.map(
            (t) => `${tagSource(t)}: "${t.name}" (venue-level tag; confirm with the restaurant)`,
          )
        : [`qloo.tags: no venue tag supports "${rule.key}"`]),
      ...(conflicts.length ? [`qloo.dishes: not suggested because of their names: ${dishList}`] : []),
    ],
    warnings: contradicted
      ? [`qloo.tags: venue tag "${venueTags[0].name}" but dish names conflict: ${dishList}; ask the restaurant`]
      : [],
    supportingTags: venueTags,
  };
  return { result, conflicts };
}

function evaluateQuiet(candidate: Candidate): RequirementResult {
  const noise = tagsOfType(candidate, [TAG_TYPES.noiseLevel]);
  const ambience = tagsOfType(candidate, [TAG_TYPES.ambience]);
  const contradicting = [...tagsNamed(noise, LOUD_NOISE), ...tagsNamed(ambience, NOISY_AMBIENCE)];
  const supporting = [...tagsNamed(noise, QUIET), ...tagsNamed(ambience, QUIET)];
  const neutral = noise.filter((t) => !contradicting.includes(t) && !supporting.includes(t));

  const evidence = ["profile.comfort.quietPreferred: true"];
  for (const t of contradicting) evidence.push(`${tagSource(t)}: "${t.name}" (contradicts quiet)`);
  for (const t of supporting) evidence.push(`${tagSource(t)}: "${t.name}" (supports quiet)`);
  for (const t of neutral) evidence.push(`${tagSource(t)}: "${t.name}" (neither quiet nor loud)`);
  if (!noise.length && !ambience.length) evidence.push("qloo.tags: no noise or ambience tags");

  return {
    kind: "comfort",
    requirement: "comfort: quiet place",
    status: contradicting.length ? "conflict" : supporting.length ? "matched" : "needs_confirmation",
    evidence,
    warnings: [],
    supportingTags: supporting,
  };
}

function evaluateWheelchair(candidate: Candidate): RequirementResult {
  const tags = tagsOfType(candidate, [TAG_TYPES.accessibility]);
  const contradicting = tags.filter((t) => WHEELCHAIR_CONTRADICTION.test(t.name));
  const entrance = tagsNamed(tags, [WHEELCHAIR_ENTRANCE]);
  const otherWheelchair = tags.filter(
    (t) => /wheelchair/i.test(t.name) && !contradicting.includes(t) && !entrance.includes(t),
  );

  const evidence = ["profile.comfort.wheelchairAccess: true"];
  for (const t of contradicting) evidence.push(`${tagSource(t)}: "${t.name}" (contradicts access)`);
  for (const t of entrance) evidence.push(`${tagSource(t)}: "${t.name}"`);
  for (const t of otherWheelchair) evidence.push(`${tagSource(t)}: "${t.name}"`);
  if (!contradicting.length && !entrance.length) {
    evidence.push("qloo.tags.accessibility: no tag confirms a wheelchair accessible entrance");
  }

  return {
    kind: "comfort",
    requirement: "comfort: wheelchair access",
    status: contradicting.length ? "conflict" : entrance.length ? "matched" : "needs_confirmation",
    evidence,
    warnings: [],
    supportingTags: entrance,
  };
}

function evaluateTexture(
  texture: Exclude<SeniorProfile["texture"], "none">,
  softDishes: Dish[],
): RequirementResult {
  return {
    kind: "texture",
    requirement: `texture: ${TEXTURE_LABEL[texture]}`,
    status: "needs_confirmation",
    evidence: [
      `profile.texture: "${texture}"`,
      "qloo: no texture data for any dish; confirm with the restaurant",
      ...softDishes.map((d) => `${dishSource(d)}: "${d.name}" (possibly soft; confirm)`),
    ],
    warnings: [],
    supportingTags: [],
  };
}

/** Evaluate one candidate against the profile's allergies, diet, texture and comfort needs. */
export function evaluateCandidate(profile: SeniorProfile, candidate: Candidate): CandidateEvaluation {
  const dishes = candidateDishes(candidate);
  const requirements: RequirementResult[] = [];
  const excludedDishes: ExcludedDish[] = [];

  for (const allergy of profile.allergies) {
    const { result, conflicts } = evaluateAllergy(candidate, dishes, allergy);
    requirements.push(result);
    excludedDishes.push(...conflicts);
  }
  for (const restriction of profile.dietaryRestrictions) {
    const { result, conflicts } = evaluateDiet(candidate, dishes, restriction);
    requirements.push(result);
    excludedDishes.push(...conflicts);
  }
  for (const dislike of profile.dislikes) {
    excludedDishes.push(...dishConflicts(dishes, [dislike], "dislike", dislike));
  }

  const excludedNames = new Set(excludedDishes.map((d) => normalizeTerm(d.name)));
  const allowedDishes = dishes.filter((d) => !excludedNames.has(normalizeTerm(d.name)));
  const possiblySoftDishes =
    profile.texture === "none"
      ? []
      : allowedDishes.filter((d) => findKeyword(d.name, SOFT_DISH_KEYWORDS) !== null);
  if (profile.texture !== "none") {
    requirements.push(evaluateTexture(profile.texture, possiblySoftDishes));
  }

  const exclusionReasons: string[] = [];
  if (candidate.isClosed) exclusionReasons.push("qloo.isClosed: venue is marked permanently closed");
  if (profile.comfort.quietPreferred) requirements.push(evaluateQuiet(candidate));
  if (profile.comfort.wheelchairAccess) {
    const wheelchair = evaluateWheelchair(candidate);
    requirements.push(wheelchair);
    if (wheelchair.status === "conflict") {
      exclusionReasons.push(
        "qloo.tags.accessibility: a tag contradicts wheelchair access, which the caregiver requires",
      );
    }
  }

  return {
    candidateId: candidate.id,
    excluded: exclusionReasons.length > 0,
    exclusionReasons,
    requirements,
    allowedDishes,
    excludedDishes,
    possiblySoftDishes,
  };
}
