// Structured facts about each ranked candidate. No prose generation and no LLM: a later phase
// turns these into wording. Every fact's source is the profile, caregiver feedback or Qloo data;
// absent Qloo fields are omitted, never filled in. Dishes are "to ask about", never a confirmed
// menu, and nothing here says or implies that food can be ordered.
import type { ExcludedDish, RequirementResult } from "@/lib/constraints/evaluate";
import { containsKeyword } from "@/lib/constraints/keywords";
import { areaLabel, type VenueArea } from "@/lib/domain/borough";
import { relatedCuisineMatch } from "@/lib/domain/cuisines";
import { TAG_TYPES, type Candidate, type Tag } from "@/lib/domain/place";
import type { SeniorProfile } from "@/lib/domain/profile";
import { allergenHeavyAllergens, type RankedCandidate, type ScoreBreakdown } from "@/lib/ranking/rank";

export const POSSIBLY_SOFT_NOTE = "possibly soft — confirm";

export interface Reason {
  /** Short factual statement, e.g. "Serves Nigerian food". */
  text: string;
  /** Profile field and the Qloo field/signal it was matched against. */
  source: string;
  /** "related": a weaker match, e.g. a related cuisine rather than the favourite itself. */
  strength?: "related";
}

export interface FactWarning {
  text: string;
  source: string;
}

export interface DishToAskAbout {
  name: string;
  source: "qloo.dishHighlights" | "qloo.specialtyDishes";
  note?: typeof POSSIBLY_SOFT_NOTE;
}

export interface RemovedDish {
  name: string;
  source: "qloo.dishHighlights" | "qloo.specialtyDishes";
  reason: ExcludedDish["reason"];
  /** The profile entry that caused it, e.g. "peanut". */
  requirement: string;
  why: string;
}

export interface AreaFact {
  kind: VenueArea["kind"];
  label: string | null;
  /** True when the venue is in the borough the profile named. */
  inRequestedBorough: boolean;
  /** Qloo field the area came from; absent when unknown. */
  source?: string;
}

export interface ExplanationFacts {
  candidateId: string;
  name: string;
  rank: number;
  reasons: Reason[];
  dishesToAskAbout: DishToAskAbout[];
  removedDishes: RemovedDish[];
  /** Venue-level cautions, e.g. most listed dishes commonly contain an allergen. */
  warnings: FactWarning[];
  constraintStatuses: RequirementResult[];
  /** Plain list of things the caregiver should ask the restaurant. */
  needsConfirmation: string[];
  /** Where the venue is: "In Brooklyn", "Outside NYC (Nassau County)"; null label if unknown. */
  area: AreaFact;
  /** Only the links Qloo provided. */
  links: { website?: string; phone?: string; mapsUrl?: string };
  scoreBreakdown: ScoreBreakdown & { total: number };
}

export interface ExplanationContext {
  /**
   * The taste signals actually sent to Qloo. Defaults to every profile taste memory, which is
   * what the search layer is expected to send.
   */
  tasteSignals?: readonly string[];
}

const dishSourceField = (s: ExcludedDish["source"]) =>
  s === "menu_highlight" ? ("qloo.dishHighlights" as const) : ("qloo.specialtyDishes" as const);

function dishTagSource(candidate: Candidate, name: string, source: ExcludedDish["source"]): string {
  const type = source === "menu_highlight" ? TAG_TYPES.menuHighlight : TAG_TYPES.specialtyDish;
  const tag = candidate.tags.find((t) => t.type === type && t.name.toLowerCase() === name.toLowerCase());
  if (tag) return `Qloo tag ${tag.id}`;
  return source === "menu_highlight" ? "Qloo menu highlight" : "Qloo properties.specialty_dishes";
}

const tagIds = (tags: Tag[]) => tags.map((t) => `Qloo tag ${t.id}`).join(", ");

function tasteReason(profile: SeniorProfile, candidate: Candidate, ctx: ExplanationContext): Reason {
  const signals = ctx.tasteSignals ?? [
    ...profile.tasteMemories.music,
    ...profile.tasteMemories.films,
    ...profile.tasteMemories.places,
  ];
  const affinity = candidate.affinity !== null ? ` (query.affinity ${candidate.affinity.toFixed(2)})` : "";
  return {
    text: `Qloo ranked it #${candidate.qlooRank} for this person's tastes`,
    source: signals.length
      ? `profile.tasteMemories ↔ Qloo taste rank #${candidate.qlooRank} with signals: ${signals.join(", ")}${affinity}`
      : `profile.favouriteCuisines: ${profile.favouriteCuisines.join(", ")} ↔ Qloo rank #${candidate.qlooRank} (no taste signals)${affinity}`,
  };
}

function buildReasons(profile: SeniorProfile, item: RankedCandidate, ctx: ExplanationContext): Reason[] {
  const { candidate, evaluation } = item;
  const reasons = [tasteReason(profile, candidate, ctx)];

  const cuisineTags = candidate.tags.filter((t) => t.type === TAG_TYPES.cuisine);
  const related: Reason[] = [];
  for (const cuisine of profile.favouriteCuisines) {
    const tag =
      cuisineTags.find((t) => t.name.toLowerCase() === cuisine.toLowerCase()) ??
      cuisineTags.find((t) => containsKeyword(t.name, cuisine));
    if (!tag) {
      const relatedTag = cuisineTags.find((t) => relatedCuisineMatch(t.name, cuisine));
      if (relatedTag) {
        related.push({
          text: `${relatedCuisineMatch(relatedTag.name, cuisine)} — related to ${cuisine}`,
          source: `profile.favouriteCuisines: ${cuisine} ↔ Qloo tag ${relatedTag.id} (related cuisine)`,
          strength: "related",
        });
      }
      continue;
    }
    reasons.push({
      text: `Serves ${tag.name} food`,
      source: `profile.favouriteCuisines: ${cuisine} ↔ Qloo tag ${tag.id}`,
    });
  }
  // Related-cuisine reasons are weaker, so they follow the direct cuisine matches.
  reasons.push(...related);

  for (const fav of item.matchedFavouriteDishes) {
    const dish = evaluation.allowedDishes.find((d) => containsKeyword(d.name, fav));
    if (!dish) continue;
    reasons.push({
      text: `Lists ${dish.name}, a favourite dish`,
      source: `profile.favouriteDishes: ${fav} ↔ ${dishTagSource(candidate, dish.name, dish.source)}`,
    });
  }

  for (const r of evaluation.requirements) {
    if (r.status !== "matched" || !r.supportingTags.length) continue;
    reasons.push({
      text:
        r.kind === "diet"
          ? `Venue tag: ${r.supportingTags.map((t) => t.name).join(", ")} (venue-level; confirm)`
          : `Venue tag: ${r.supportingTags.map((t) => t.name).join(", ")}`,
      source: `${r.evidence[0]} ↔ ${tagIds(r.supportingTags)}`,
    });
  }

  const area = buildArea(item);
  if (area.inRequestedBorough) {
    reasons.push({
      text: `${area.label}, the borough you chose`,
      // area.source is "qloo.properties.…"; reasons cite "Qloo <field>".
      source: `profile.location: ${item.requestedBorough} ↔ Qloo ${area.source!.replace(/^qloo\./, "")}`,
    });
  }

  if (item.likedCuisines.length) {
    const tags = cuisineTags.filter((t) => item.likedCuisines.includes(t.name));
    reasons.push({
      text: `Same cuisine as a place you liked: ${item.likedCuisines.join(", ")}`,
      source: `feedback.liked ↔ ${tagIds(tags)}`,
    });
  }
  return reasons;
}

function buildDishes(item: RankedCandidate): DishToAskAbout[] {
  const { evaluation, matchedFavouriteDishes } = item;
  const soft = new Set(evaluation.possiblySoftDishes.map((d) => d.name));
  const isFavourite = (name: string) => matchedFavouriteDishes.some((f) => containsKeyword(name, f));
  const dishes = evaluation.allowedDishes.map(
    (d): DishToAskAbout => ({
      name: d.name,
      source: dishSourceField(d.source),
      ...(soft.has(d.name) ? { note: POSSIBLY_SOFT_NOTE } : {}),
    }),
  );
  // Favourites first, then possibly-soft, otherwise Qloo's order (stable sort).
  const weight = (d: DishToAskAbout) => (isFavourite(d.name) ? 0 : d.note ? 1 : 2);
  return dishes.sort((a, b) => weight(a) - weight(b));
}

function buildRemovedDishes(item: RankedCandidate): RemovedDish[] {
  return item.evaluation.excludedDishes.map((d) => ({
    name: d.name,
    source: dishSourceField(d.source),
    reason: d.reason,
    requirement: d.requirement,
    why: d.why,
  }));
}

function buildWarnings(item: RankedCandidate): FactWarning[] {
  return allergenHeavyAllergens(item.evaluation).map((a) => ({
    text: `Many listed dishes here commonly contain ${a.allergen}`,
    source: `profile.allergies: "${a.allergen}" ↔ qloo.dishes: ${a.removed} of ${a.total} listed dishes set aside`,
  }));
}

function confirmationQuestion(r: RequirementResult): string | null {
  const value = r.requirement.slice(r.requirement.indexOf(":") + 2);
  switch (r.kind) {
    case "allergy":
      return `Ask whether dishes can be made without ${value} (Qloo has no allergen data)`;
    case "diet":
      return r.status === "matched"
        ? `Confirm the "${value}" claim; it is a venue-level tag`
        : `Ask about ${value} options`;
    case "texture":
      return `Ask which dishes are ${value}`;
    case "comfort":
      if (r.status === "matched") return null;
      if (r.requirement === "comfort: wheelchair access") {
        return "Confirm wheelchair access, including the entrance";
      }
      return r.status === "conflict"
        ? "Qloo tags say it can be loud; ask about quieter times"
        : "Ask how quiet it is at the time you plan to visit";
  }
}

function buildNeedsConfirmation(item: RankedCandidate): string[] {
  const { evaluation, candidate } = item;
  const out = evaluation.requirements.map(confirmationQuestion).filter((q): q is string => !!q);
  if (!evaluation.allowedDishes.length && evaluation.excludedDishes.length) {
    out.push("Every dish Qloo lists was set aside; ask what they can serve that fits");
  }
  if (!candidate.hours) out.push("Confirm opening hours (none listed)");
  return [...new Set(out)];
}

function buildArea(item: RankedCandidate): AreaFact {
  const { area, requestedBorough } = item;
  return {
    kind: area.kind,
    label: areaLabel(area),
    inRequestedBorough: area.kind === "borough" && area.borough === requestedBorough,
    ...(area.kind !== "unknown" ? { source: area.source } : {}),
  };
}

function buildLinks(c: Candidate): ExplanationFacts["links"] {
  return {
    ...(c.website ? { website: c.website } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.mapsUrl ? { mapsUrl: c.mapsUrl } : {}),
  };
}

/** Facts for one ranked candidate. */
export function buildExplanationFacts(
  profile: SeniorProfile,
  item: RankedCandidate,
  ctx: ExplanationContext = {},
): ExplanationFacts {
  return {
    candidateId: item.candidate.id,
    name: item.candidate.name,
    rank: item.rank,
    reasons: buildReasons(profile, item, ctx),
    dishesToAskAbout: buildDishes(item),
    removedDishes: buildRemovedDishes(item),
    warnings: buildWarnings(item),
    constraintStatuses: item.evaluation.requirements,
    needsConfirmation: buildNeedsConfirmation(item),
    area: buildArea(item),
    links: buildLinks(item.candidate),
    scoreBreakdown: { ...item.score.breakdown, total: item.score.total },
  };
}

export function buildAllExplanationFacts(
  profile: SeniorProfile,
  ranked: readonly RankedCandidate[],
  ctx: ExplanationContext = {},
): ExplanationFacts[] {
  return ranked.map((item) => buildExplanationFacts(profile, item, ctx));
}
