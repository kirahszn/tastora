// Fakes for Qloo and Anthropic: no live calls in tests.
import type Anthropic from "@anthropic-ai/sdk";
import type { AnthropicLike } from "@/lib/agent/claudePlanner";
import type { QlooParams } from "@/lib/qloo/client";
import { TtlCache } from "@/lib/qloo/cache";
import { createQlooSearch } from "@/lib/qloo/search";
import { SAMPLES, sampleEntities } from "./fixtures";

export const IDS = {
  nigerianCuisine: "urn:tag:cuisine:qloo:nigerian",
  nigerianGenre: "urn:tag:genre:place:restaurant:nigerian",
  fela: "679CEADA-31C3-4A06-99D0-D7384D6693BF",
  felaPerson: "F173D293-803E-4D6C-9BEF-874CA9932331",
};

export interface QlooCall {
  path: string;
  params: QlooParams;
}

/** A hotel that a cuisine search can return; must be filtered out. */
export const HOTEL = {
  entity_id: "HOTEL-1",
  name: "Grand Test Hotel",
  subtype: "urn:entity:place",
  properties: { primary_genre: { id: "urn:tag:genre:place:hotel", name: "Hotel" } },
  tags: [{ id: "urn:tag:category:place:restaurant", name: "Restaurant", type: "urn:tag:category:place" }],
};

/**
 * Fake Qloo GET. Insights returns the recorded West African + Fela sample (plus a hotel) when
 * signals are sent, and the same places reversed without signals, so the evidence differs.
 */
export function fakeQloo(overrides: { insights?: (params: QlooParams) => unknown[]; fail?: boolean } = {}) {
  const calls: QlooCall[] = [];
  const get = async (path: string, params: QlooParams): Promise<unknown> => {
    calls.push({ path, params });
    if (overrides.fail) throw new Error("upstream down");
    if (path === "/v2/tags") {
      return {
        success: true,
        results: {
          tags: [
            { id: "urn:tag:genre:music:nigerian", name: "Nigerian", type: "urn:tag:genre:music" },
            { id: IDS.nigerianCuisine, name: "Nigerian", type: "urn:tag:cuisine:qloo" },
            { id: IDS.nigerianGenre, name: "Nigerian", type: "urn:tag:genre:place" },
            { id: "urn:tag:menu_highlight:qloo:nigerian_menu", name: "Nigerian Menu", type: "urn:tag:menu_highlight:qloo" },
          ],
        },
      };
    }
    if (path === "/search") {
      return {
        results: [
          { entity_id: IDS.felaPerson, name: "Fela Kuti", types: ["urn:entity:person"], disambiguation: "1938-10-15" },
          {
            entity_id: IDS.fela,
            name: "Fela Kuti",
            types: ["urn:entity:artist"],
            disambiguation: "Fela Kuti",
            properties: { short_description: "Nigerian multi-instrumentalist and bandleader" },
          },
          { entity_id: "ALBUM-1", name: "The Best of Fela Kuti", types: ["urn:entity:album"] },
        ],
      };
    }
    if (path === "/v2/insights") {
      const places = overrides.insights?.(params) ?? [...sampleEntities(SAMPLES.westAfricanFela), HOTEL];
      const signalled = "signal.interests.entities" in params || "signal.interests.tags" in params;
      return { success: true, results: { entities: signalled ? places : [...places].reverse() } };
    }
    throw new Error(`unexpected path ${path}`);
  };
  const search = createQlooSearch({ get, cache: new TtlCache() });
  return { get, calls, search };
}

// ---- Anthropic ----

type Block = Anthropic.ContentBlock;

export function toolUse(id: string, name: string, input: unknown): Block {
  return { type: "tool_use", id, name, input, caller: { type: "direct" } } as unknown as Block;
}

export function text(t: string): Block {
  return { type: "text", text: t, citations: null } as unknown as Block;
}

export function message(content: Block[], stop_reason: Anthropic.StopReason = "tool_use"): Anthropic.Message {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Message;
}

/** Scripted client: returns the given responses in turn (or calls a function), recording requests. */
export function scriptedClaude(
  script: (Anthropic.Message | ((body: Anthropic.MessageCreateParamsNonStreaming) => Anthropic.Message))[],
) {
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: AnthropicLike = {
    messages: {
      create: async (body) => {
        // Snapshot: the planner keeps appending to the same messages array.
        requests.push(structuredClone(body));
        const next = script[requests.length - 1];
        if (!next) return message([text("Done.")], "end_turn");
        return typeof next === "function" ? next(body) : next;
      },
    },
  };
  return { client, requests };
}

/** The standard happy path: tags + entity lookup in parallel, one search, then done. */
export function happyPathScript(extraSearchInput: Record<string, unknown> = {}) {
  return [
    message([
      toolUse("t1", "find_cuisine_tags", { query: "Nigerian" }),
      toolUse("t2", "find_taste_entities", { query: "Fela Kuti", kind: "artist" }),
    ]),
    message([
      toolUse("t3", "search_restaurants", {
        cuisine_tag_ids: [IDS.nigerianCuisine],
        signal_entity_ids: [IDS.fela],
        ...extraSearchInput,
      }),
    ]),
    message([text("Searched Nigerian restaurants with Fela Kuti as a taste signal.")], "end_turn"),
  ];
}
