// Small display helpers. They format Tastora/Qloo data; they never add facts about a restaurant.
import type { RecommendResult, TraceStep } from "./types";

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
  claude: "AI planner (Claude)",
  planner: "Planner",
  rank: "Checked against their needs",
  baseline: "Compared without taste signals",
};

export const toolLabel = (tool: string): string => TOOL_LABELS[tool] ?? tool;

const KIND_WORDS: Record<string, string> = { movie: "film", tv_show: "TV show", place: "area" };
const unquote = (s: string) => s.replace(/^'(.*)'$/, "$1");

/**
 * One trace step in plain words for the searching screen ("Looked up a taste memory: Davido
 * (artist)"). Built only from the step's own text, which the server writes in fixed forms
 * (src/lib/agent/session.ts, recommend.ts); anything unrecognised falls back to the tool label.
 * The raw step stays available under "Technical details".
 */
export function plainStep(s: Pick<TraceStep, "tool" | "inputSummary" | "resultSummary">): { title: string; detail?: string } {
  const result = s.resultSummary;
  if (result.startsWith("Rejected:")) return { title: "Skipped a step the AI planner asked for (outside Tastora's limits)" };
  if (result.startsWith("Qloo request failed")) return { title: "A Qloo request didn't work, so Tastora carried on without it" };
  switch (s.tool) {
    case "claude": {
      if (result.startsWith("Finished")) return { title: "The AI planner finished planning" };
      return { title: s.inputSummary === "turn 1" ? "Planning the search" : "The AI planner chose the next lookups" };
    }
    case "planner": {
      const planned = /^Planned (\d+) search/.exec(result);
      if (planned) {
        const n = Number(planned[1]);
        return { title: `The AI planner planned ${n} restaurant search${n === 1 ? "" : "es"}` };
      }
      if (result.startsWith("Not available")) return { title: "The AI planner isn't available right now" };
      if (s.inputSummary === "built-in plan") return { title: "Searching with Tastora's built-in plan instead" };
      break;
    }
    case "find_cuisine_tags": {
      const cuisine = unquote(s.inputSummary);
      return result.startsWith("Found")
        ? { title: `Looked up the ${cuisine} cuisine` }
        : { title: `Looked up the ${cuisine} cuisine`, detail: "No match on Qloo" };
    }
    case "find_taste_entities": {
      const found = /^Found '(.+?)' \((\w+)\)/.exec(result);
      if (found) return { title: `Looked up a taste memory: ${found[1]} (${KIND_WORDS[found[2]] ?? found[2]})` };
      const query = /^'(.+)' as \w+$/.exec(s.inputSummary)?.[1] ?? s.inputSummary;
      return { title: `Looked up a taste memory: ${query}`, detail: "No clear match on Qloo, so it won't be used" };
    }
    case "search_restaurants": {
      const m = /^(.+) restaurants in (.+?) with (\d+ taste signals?)/.exec(s.inputSummary);
      const places = /^(\d+ places?)/.exec(result)?.[1];
      if (m) return { title: `Searching ${m[1]} restaurants near ${m[2]} with ${m[3]}`, ...(places ? { detail: `${places} found` } : {}) };
      break;
    }
    case "rank": {
      const m = /(\d+) shown, (\d+) excluded/.exec(result);
      return {
        title: "Checking every place against their needs",
        ...(m ? { detail: `${m[1]} to show, ${m[2]} left out` } : {}),
      };
    }
    case "baseline":
      return { title: "Comparing with the same search without taste signals" };
  }
  return { title: toolLabel(s.tool) };
}

/** "Bedford-Stuyvesant · In Brooklyn", from what the venue actually has. */
export function placeLine(r: Pick<RecommendResult, "venue" | "area">): string {
  return [r.venue.neighborhood, r.area.label].filter(Boolean).join(" · ");
}
