// Small display helpers. They format Tastora/Qloo data; they never add facts about a restaurant.
import type { RecommendResult } from "./types";

export function priceLabel(level: number | null): { symbols: string; text: string } | null {
  if (level == null || !Number.isInteger(level) || level < 1 || level > 4) return null;
  return { symbols: "$".repeat(level), text: `Price level ${level} of 4` };
}

export function ratingLabel(rating: number | null): { short: string; text: string } | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  return { short: `${rating.toFixed(1)} ★`, text: `Rated ${rating.toFixed(1)} out of 5` };
}

export const SCORE_LABELS: Record<keyof Omit<RecommendResult["scoreBreakdown"], "total">, string> = {
  taste: "Qloo taste match",
  favouriteDishes: "Favourite dishes listed",
  comfort: "Comfort needs",
  completeness: "Information available",
  dislikePenalty: "Disliked dishes",
  allergenPenalty: "Many dishes with an allergen",
  feedback: "Your feedback",
  borough: "Location",
};

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** Plain headings for trace steps; the step's own text says what actually happened. */
const TOOL_LABELS: Record<string, string> = {
  find_cuisine_tags: "Looked up a cuisine",
  find_taste_entities: "Looked up a taste memory",
  search_restaurants: "Searched restaurants",
  claude: "Claude planned the search",
  planner: "Planner",
  rank: "Checked against their needs",
  baseline: "Compared without taste signals",
};

export const toolLabel = (tool: string): string => TOOL_LABELS[tool] ?? tool;

/** "Bedford-Stuyvesant · In Brooklyn", from what the venue actually has. */
export function placeLine(r: Pick<RecommendResult, "venue" | "area">): string {
  return [r.venue.neighborhood, r.area.label].filter(Boolean).join(" · ");
}
