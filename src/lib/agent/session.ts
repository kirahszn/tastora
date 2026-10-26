// The search session behind the agent's tools. It enforces the hard limits and the ID rule,
// injects the location, records a plain-language trace and collects candidates. The planner
// (Claude or the deterministic fallback) only chooses which tools to call; it never sees or
// sets constraint statuses, and it cannot add candidates.
import "server-only";
import { z } from "zod";
import { QlooApiError } from "@/lib/qloo/client";
import {
  ENTITY_KINDS,
  type EntityCandidate,
  type EntityKind,
  type QlooSearch,
  type RestaurantSearchResult,
  type TagCandidate,
} from "@/lib/qloo/search";

export const AGENT_LIMITS = {
  maxToolCalls: 10,
  maxModelTurns: 6,
  maxRestaurantSearches: 3,
  maxCuisineTagsPerSearch: 2,
  maxSignalsPerSearch: 3,
  /** Tag/entity matches shown to the planner per lookup. */
  maxLookupResults: 6,
} as const;

export interface TraceStep {
  step: number;
  tool: string;
  inputSummary: string;
  resultSummary: string;
  ms: number;
}

export interface TasteSignal {
  id: string;
  name: string;
  kind: EntityKind | "tag";
}

export interface SearchRecord {
  /** Order the search ran in; 1 is the main search. */
  index: number;
  cuisineTags: { id: string; name: string }[];
  signals: TasteSignal[];
  result: RestaurantSearchResult;
}

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

const KIND_NAMES = Object.keys(ENTITY_KINDS) as [EntityKind, ...EntityKind[]];

export const ToolInputs = {
  find_cuisine_tags: z.object({ query: z.string().trim().min(1).max(60) }),
  find_taste_entities: z.object({
    query: z.string().trim().min(1).max(80),
    kind: z.enum(KIND_NAMES),
  }),
  search_restaurants: z.object({
    cuisine_tag_ids: z.array(z.string().min(1)).min(1).max(AGENT_LIMITS.maxCuisineTagsPerSearch),
    signal_entity_ids: z.array(z.string().min(1)).max(AGENT_LIMITS.maxSignalsPerSearch).optional(),
    signal_tag_ids: z.array(z.string().min(1)).max(AGENT_LIMITS.maxSignalsPerSearch).optional(),
  }),
};

export type ToolName = keyof typeof ToolInputs;

const quote = (s: string) => `'${s}'`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export class SearchSession {
  readonly trace: TraceStep[] = [];
  readonly searches: SearchRecord[] = [];
  toolCalls = 0;
  failedSearches = 0;
  private readonly tags = new Map<string, TagCandidate>();
  private readonly entities = new Map<string, EntityCandidate>();
  private searchCount = 0;

  constructor(
    private readonly search: QlooSearch,
    /** From the profile; the planner cannot change it. */
    private readonly location: string,
    private readonly hooks: { onSearch?: (record: SearchRecord) => void } = {},
  ) {}

  get limitReached(): boolean {
    return this.toolCalls >= AGENT_LIMITS.maxToolCalls;
  }

  /** Add a non-tool step (planner notes, ranking) to the trace. */
  note(tool: string, inputSummary: string, resultSummary: string, ms = 0): void {
    this.trace.push({ step: this.trace.length + 1, tool, inputSummary, resultSummary, ms });
  }

  async run(name: string, rawInput: unknown): Promise<ToolOutcome> {
    this.toolCalls += 1;
    if (this.toolCalls > AGENT_LIMITS.maxToolCalls) {
      return this.reject(name, `Tool-call limit (${AGENT_LIMITS.maxToolCalls}) reached. Stop calling tools.`);
    }
    if (!(name in ToolInputs)) return this.reject(name, `Unknown tool "${name}".`);
    const schema = ToolInputs[name as ToolName];
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return this.reject(name, `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`);
    }

    const started = performance.now();
    try {
      switch (name as ToolName) {
        case "find_cuisine_tags":
          return await this.findCuisineTags(parsed.data as z.output<typeof ToolInputs.find_cuisine_tags>, started);
        case "find_taste_entities":
          return await this.findTasteEntities(parsed.data as z.output<typeof ToolInputs.find_taste_entities>, started);
        case "search_restaurants":
          return await this.searchRestaurants(parsed.data as z.output<typeof ToolInputs.search_restaurants>, started);
      }
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      // Never forward upstream bodies or messages; they could echo request details.
      const status = err instanceof QlooApiError ? (err.status ?? "timeout") : "error";
      this.note(name, "", `Qloo request failed (${status})`, ms);
      if (name === "search_restaurants") this.failedSearches += 1;
      return { content: `Qloo request failed (${status}). You may retry once or continue without it.`, isError: true };
    }
    return this.reject(name, `Unknown tool "${name}".`);
  }

  private reject(tool: string, message: string): ToolOutcome {
    this.note(tool, "", `Rejected: ${message}`);
    return { content: message, isError: true };
  }

  private async findCuisineTags(input: { query: string }, started: number): Promise<ToolOutcome> {
    const tags = (await this.search.findTags(input.query)).slice(0, AGENT_LIMITS.maxLookupResults);
    for (const t of tags) this.tags.set(t.id, t);
    this.note(
      "find_cuisine_tags",
      quote(input.query),
      tags.length
        ? `Found ${tags.map((t) => `${quote(t.name)} (${t.family})`).join(", ")}`
        : "No cuisine tags found",
      Math.round(performance.now() - started),
    );
    return { content: JSON.stringify({ tags }), isError: false };
  }

  private async findTasteEntities(input: { query: string; kind: EntityKind }, started: number): Promise<ToolOutcome> {
    const found = (await this.search.findEntities(input.query, [input.kind])).slice(0, AGENT_LIMITS.maxLookupResults);
    for (const e of found) this.entities.set(e.id, e);
    this.note(
      "find_taste_entities",
      `${quote(input.query)} as ${input.kind}`,
      found.length
        ? `Found ${quote(found[0].name)} (${found[0].kind})${found.length > 1 ? ` and ${plural(found.length - 1, "other match")}` : ""}`
        : `No ${input.kind} found`,
      Math.round(performance.now() - started),
    );
    return { content: JSON.stringify({ entities: found }), isError: false };
  }

  private async searchRestaurants(
    input: z.output<typeof ToolInputs.search_restaurants>,
    started: number,
  ): Promise<ToolOutcome> {
    if (this.searchCount >= AGENT_LIMITS.maxRestaurantSearches) {
      return this.reject("search_restaurants", `At most ${AGENT_LIMITS.maxRestaurantSearches} restaurant searches per run.`);
    }
    const entityIds = input.signal_entity_ids ?? [];
    const tagIds = input.signal_tag_ids ?? [];
    const unknown = [
      ...input.cuisine_tag_ids.filter((id) => !this.tags.has(id)),
      ...entityIds.filter((id) => !this.entities.has(id)),
      ...tagIds.filter((id) => !this.tags.has(id)),
    ];
    if (unknown.length) {
      return this.reject(
        "search_restaurants",
        `Unknown id(s): ${unknown.join(", ")}. Use only ids returned by find_cuisine_tags or find_taste_entities in this run.`,
      );
    }

    // Numbered when the search starts, so parallel searches keep the planner's order.
    const index = ++this.searchCount;
    const cuisineTags = input.cuisine_tag_ids.map((id) => ({ id, name: this.tags.get(id)!.name }));
    const signals: TasteSignal[] = [
      ...entityIds.map((id) => ({ id, name: this.entities.get(id)!.name, kind: this.entities.get(id)!.kind })),
      ...tagIds.map((id) => ({ id, name: this.tags.get(id)!.name, kind: "tag" as const })),
    ];
    const result = await this.search.searchRestaurants({
      cuisineTagIds: input.cuisine_tag_ids,
      location: this.location,
      signalEntityIds: entityIds,
      signalTagIds: tagIds,
    });
    const record: SearchRecord = { index, cuisineTags, signals, result };
    this.searches.push(record);
    this.searches.sort((a, b) => a.index - b.index);
    this.hooks.onSearch?.(record);

    const cuisine = cuisineTags.map((t) => t.name).join(" + ");
    this.note(
      "search_restaurants",
      `${cuisine} restaurants in ${result.locationUsed} with ${plural(signals.length, "taste signal")}${signals.length ? ` (${signals.map((s) => s.name).join(", ")})` : ""}`,
      [
        `${plural(result.candidates.length, "place")}, ${plural(result.dropped.length, "non-restaurant")} dropped`,
        ...(result.localityResolved ? [`location resolved to ${result.localityResolved}`] : []),
        ...result.notes,
      ].join("; "),
      Math.round(performance.now() - started),
    );
    return {
      content: JSON.stringify({
        places: result.candidates.length,
        nonRestaurantsDropped: result.dropped.length,
        top: result.candidates.slice(0, 5).map((c) => c.name),
        notes: result.notes,
      }),
      isError: false,
    };
  }
}
