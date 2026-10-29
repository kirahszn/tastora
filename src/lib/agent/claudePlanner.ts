// Claude plans the Qloo searches through three tools. Manual loop so every limit is enforced
// here: model turns, tool calls (in SearchSession), restaurant searches, and a time budget.
// Data minimisation: the model only receives cuisines, dishes, dislikes and taste memories.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SeniorProfile } from "@/lib/domain/profile";
import { ENTITY_KINDS } from "@/lib/qloo/search";
import { AGENT_LIMITS, type SearchSession } from "./session";

/** Minimal surface of the Anthropic client, so tests can pass a fake. */
export interface AnthropicLike {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: { timeout?: number; maxRetries?: number; signal?: AbortSignal },
    ): PromiseLike<Anthropic.Message>;
  };
}

/** The only profile fields the model ever sees. */
export interface PlannerInput {
  favouriteCuisines: string[];
  favouriteDishes: string[];
  dislikes: string[];
  tasteMemories: { music: string[]; films: string[]; places: string[] };
}

export function plannerInput(profile: SeniorProfile): PlannerInput {
  return {
    favouriteCuisines: [...profile.favouriteCuisines],
    favouriteDishes: [...profile.favouriteDishes],
    dislikes: [...profile.dislikes],
    tasteMemories: {
      music: [...profile.tasteMemories.music],
      films: [...profile.tasteMemories.films],
      places: [...profile.tasteMemories.places],
    },
  };
}

export const SYSTEM_PROMPT = `You plan restaurant searches for Tastora, which helps caregivers find restaurants near an older person. You get the person's favourite cuisines, favourite dishes, dislikes and taste memories (music, films, places). Your only job is to decide how to search Qloo, a taste-intelligence service. You do not judge safety or suitability: the server checks allergies, diets and other needs, and ranks the results, after you finish.

How to plan:
1. For each favourite cuisine, most important first, call find_cuisine_tags and pick the tag that names that cuisine. Prefer the "cuisine" family; a "genre" tag is fine when there is no cuisine tag. If nothing fits, try a broader regional cuisine (for example West African for Nigerian). Favourite dishes can help you choose the cuisine.
2. For each taste memory, call find_taste_entities with the matching kind: music → artist, films → movie or tv_show, places → place (only areas such as cities come back, never hotels, restaurants or other businesses). Pick the entity that clearly is the one the person remembers, using the detail to tell apart people or works with the same name. If no result clearly matches, skip that memory rather than guess.
3. Call search_restaurants at most ${AGENT_LIMITS.maxRestaurantSearches} times. Make the first search the main one: the most important cuisine with the best taste signals (up to ${AGENT_LIMITS.maxSignalsPerSearch} entity ids). Use any further searches for other favourite cuisines. The server sets the location.

Use only ids returned by the tools in this conversation. Run independent lookups in parallel. You have at most ${AGENT_LIMITS.maxToolCalls} tool calls in total. When the searches are done, reply with one short sentence describing the plan. Do not list or recommend restaurants.`;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "find_cuisine_tags",
    description:
      "Look up Qloo restaurant cuisine tags for a cuisine name (e.g. 'Nigerian', 'Italian'). Returns tags with id, name and family ('cuisine' or 'genre').",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Cuisine name, e.g. 'West African'." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "find_taste_entities",
    description:
      "Look up a taste memory (an artist, film, TV show, book or place) in Qloo. Returns candidate entities with id, name, kind and a short detail for telling apart similar names.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name as the caregiver wrote it, e.g. 'Fela Kuti'." },
        kind: { type: "string", enum: Object.keys(ENTITY_KINDS) },
      },
      required: ["query", "kind"],
      additionalProperties: false,
    },
  },
  {
    name: "search_restaurants",
    description:
      "Search Qloo for restaurants with the given cuisine tags, re-ranked by the person's taste signals. Location is set by the server. Returns how many places were found and the first few names.",
    input_schema: {
      type: "object",
      properties: {
        cuisine_tag_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: AGENT_LIMITS.maxCuisineTagsPerSearch,
          description: "Tag ids from find_cuisine_tags.",
        },
        signal_entity_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: AGENT_LIMITS.maxSignalsPerSearch,
          description: "Entity ids from find_taste_entities.",
        },
        signal_tag_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: AGENT_LIMITS.maxSignalsPerSearch,
          description: "Optional extra tag ids from find_cuisine_tags to use as taste signals.",
        },
      },
      required: ["cuisine_tag_ids"],
      additionalProperties: false,
    },
  },
];

export interface ClaudePlanResult {
  turns: number;
  /** Why the loop ended: end_turn, tool limit, turn limit, time budget, or a stop reason. */
  endedBy: string;
}

/** Run the planning loop. Throws on Anthropic errors (the caller falls back). */
export async function runClaudePlanner(opts: {
  client: AnthropicLike;
  model: string;
  input: PlannerInput;
  session: SearchSession;
  deadline: number;
  now?: () => number;
}): Promise<ClaudePlanResult> {
  const { client, model, input, session, deadline } = opts;
  const now = opts.now ?? Date.now;
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Plan the searches for this person:\n${JSON.stringify(input, null, 2)}` },
  ];

  for (let turn = 1; turn <= AGENT_LIMITS.maxModelTurns; turn++) {
    const remaining = deadline - now();
    if (remaining < 2_000) return { turns: turn - 1, endedBy: "time budget" };

    const started = performance.now();
    const response = await client.messages.create(
      {
        model,
        max_tokens: 4_096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        // Low effort keeps latency down; planning a few lookups is not a hard problem.
        output_config: { effort: "low" },
        messages,
      },
      { timeout: remaining, maxRetries: 1 },
    );
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    session.note(
      "claude",
      `turn ${turn}`,
      toolUses.length ? `Requested ${toolUses.map((t) => t.name).join(", ")}` : `Finished (${response.stop_reason})`,
      Math.round(performance.now() - started),
    );

    // Full content goes back unchanged, thinking blocks included.
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use" || !toolUses.length) {
      return { turns: turn, endedBy: response.stop_reason ?? "unknown" };
    }

    // All results go back in one user message. Calls start in order, so the limit counter is
    // deterministic even though they run in parallel.
    const outcomes = await Promise.all(toolUses.map((t) => session.run(t.name, t.input)));
    messages.push({
      role: "user",
      content: toolUses.map(
        (t, i): Anthropic.ToolResultBlockParam => ({
          type: "tool_result",
          tool_use_id: t.id,
          content: outcomes[i].content,
          ...(outcomes[i].isError ? { is_error: true } : {}),
        }),
      ),
    });
    if (session.limitReached) return { turns: turn, endedBy: "tool-call limit" };
  }
  return { turns: AGENT_LIMITS.maxModelTurns, endedBy: "turn limit" };
}
