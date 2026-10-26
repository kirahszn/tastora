// Deterministic planner used when Claude is unavailable (no key, error, timeout, refusal). Same
// tools and limits as the agent, via SearchSession: each favourite cuisine → its first tag
// match; each taste memory → its first entity match of the matching kind; then one search per
// cuisine tag with all the signals. The first cuisine's search is the main one.
import "server-only";
import type { EntityKind } from "@/lib/qloo/search";
import type { PlannerInput } from "./claudePlanner";
import { AGENT_LIMITS, type SearchSession } from "./session";

const MEMORY_KINDS: { key: keyof PlannerInput["tasteMemories"]; kind: EntityKind }[] = [
  { key: "music", kind: "artist" },
  { key: "films", kind: "movie" },
  { key: "places", kind: "place" },
];

const firstId = (content: string, key: "tags" | "entities"): string | null => {
  const items = (JSON.parse(content) as Record<string, { id: string }[]>)[key];
  return items?.[0]?.id ?? null;
};

export async function runFallbackPlanner(session: SearchSession, input: PlannerInput): Promise<void> {
  const cuisines = input.favouriteCuisines.slice(0, AGENT_LIMITS.maxRestaurantSearches);
  const memories = MEMORY_KINDS.flatMap(({ key, kind }) => input.tasteMemories[key].map((query) => ({ query, kind })))
    // Leave room for the searches within the tool-call cap.
    .slice(0, Math.min(AGENT_LIMITS.maxSignalsPerSearch, AGENT_LIMITS.maxToolCalls - 2 * cuisines.length));

  const [tagOutcomes, entityOutcomes] = await Promise.all([
    Promise.all(cuisines.map((query) => session.run("find_cuisine_tags", { query }))),
    Promise.all(memories.map((m) => session.run("find_taste_entities", m))),
  ]);
  const tagIds = tagOutcomes.map((o) => (o.isError ? null : firstId(o.content, "tags")));
  const entityIds = entityOutcomes
    .map((o) => (o.isError ? null : firstId(o.content, "entities")))
    .filter((id): id is string => !!id);

  await Promise.all(
    tagIds
      .filter((id): id is string => !!id)
      .map((id) =>
        session.run("search_restaurants", {
          cuisine_tag_ids: [id],
          ...(entityIds.length ? { signal_entity_ids: entityIds } : {}),
        }),
      ),
  );
}
