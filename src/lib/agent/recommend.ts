// The recommendation pipeline: plan searches (Claude, or the deterministic fallback), collect
// and dedupe candidates, then run the Phase 2 code (evaluate → rank → facts). The planner only
// decides how to search; statuses, exclusions, ranking and facts always come from Phase 2.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { cityWide, coverageNote, describeLocation, searchLocation } from "@/lib/domain/location";
import type { Candidate } from "@/lib/domain/place";
import type { SeniorProfile } from "@/lib/domain/profile";
import { getAnthropicEnv } from "@/lib/env";
import { cuisineFamilyOf } from "@/lib/domain/cuisines";
import {
  createQlooSearch,
  LocationNotFoundError,
  mergeByBestRank,
  type QlooSearch,
  type RestaurantSearchResult,
  type TagCandidate,
} from "@/lib/qloo/search";
import { rankCandidates, type RankingFeedback } from "@/lib/ranking/rank";
import { buildExplanationFacts, type ExplanationFacts } from "./explanationFacts";
import { plannerInput, runClaudePlanner, type AnthropicLike } from "./claudePlanner";
import { runFallbackPlanner } from "./fallbackPlanner";
import {
  locationNotices,
  PLANNER_FALLBACK_NOTICE,
  relatedCuisineNotice,
  tasteMemoryNotices,
} from "./notices";
import { SearchSession, type SearchRecord, type TasteSignal, type TraceStep } from "./session";

/** Time the planner may use before the pipeline stops it (route maxDuration is 60 s). */
export const AGENT_BUDGET_MS = 30_000;
const EVIDENCE_SIZE = 10;

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export interface PlaceRef {
  id: string;
  name: string;
}

export interface QlooEvidence {
  /** The main search's cuisine tag(s), as actually sent to Qloo. */
  cuisineTags: string[];
  /** Display names of the main search's cuisine tags, e.g. "Nigerian". */
  cuisineTagNames: string[];
  baselineTop10: PlaceRef[];
  personalisedTop10: PlaceRef[];
  overlapCount: number;
  /**
   * Personalised top-10 places whose position differs from the baseline (or that are new).
   * Overlap alone hides re-ordering when a cuisine has only ~10 places in NYC.
   */
  rankChanges: number;
  signalsUsed: TasteSignal[];
}

export interface RecommendResult extends ExplanationFacts {
  venue: Pick<Candidate, "address" | "neighborhood" | "priceLevel" | "rating" | "cuisines">;
}

export interface RecommendResponse {
  results: RecommendResult[];
  excluded: (PlaceRef & { reasons: string[] })[];
  trace: TraceStep[];
  evidence: QlooEvidence | null;
  /** Plain notes on how the search went (fallbacks, unmatched taste memories); see notices.ts. */
  notices: string[];
  /** "Fewer matches found around <city>…" when few places came back or the city's coverage is Thin/Poor. */
  coverageNote: string | null;
  meta: {
    planner: "agent" | "fallback";
    model: string | null;
    fallbackReason?: string;
    /** What was sent to Qloo as the location, e.g. "Bed-Stuy, Brooklyn", "Shoreditch, London". */
    location: string;
    city: string;
    qlooCalls: number;
    qlooCacheHits: number;
    anthropicRequests: number;
    durationMs: number;
  };
}

export interface RecommendDeps {
  search?: QlooSearch;
  /** Undefined: built from the environment. Null: no Claude, use the fallback planner. */
  anthropic?: AnthropicLike | null;
  model?: string;
  agentBudgetMs?: number;
  now?: () => number;
  /** Each trace step as it happens, numbered as in the final `trace`. */
  onStep?: (step: TraceStep) => void;
}

/** Plain reason for falling back; never includes upstream messages. */
function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "Claude timed out";
  if (err instanceof Anthropic.APIError && err.status) return `Claude API error ${err.status}`;
  if (err instanceof Anthropic.APIConnectionError) return "could not reach Claude";
  return "Claude request failed";
}

function countingClient(client: AnthropicLike, counter: { n: number }): AnthropicLike {
  return {
    messages: {
      create: (body, options) => {
        counter.n += 1;
        return client.messages.create(body, options);
      },
    },
  };
}

const refs = (cs: readonly Candidate[]): PlaceRef[] =>
  cs.slice(0, EVIDENCE_SIZE).map((c) => ({ id: c.id, name: c.name }));

function buildEvidence(main: SearchRecord, baseline: RestaurantSearchResult): QlooEvidence {
  const personalisedTop10 = refs(main.result.candidates);
  const baselineTop10 = refs(baseline.candidates);
  const baseIds = new Set(baselineTop10.map((p) => p.id));
  return {
    cuisineTags: main.result.tagsUsed,
    cuisineTagNames: main.cuisineTags.map((t) => t.name),
    baselineTop10,
    personalisedTop10,
    overlapCount: personalisedTop10.filter((p) => baseIds.has(p.id)).length,
    rankChanges: personalisedTop10.filter((p, i) => baselineTop10[i]?.id !== p.id).length,
    signalsUsed: main.signals,
  };
}

/** For each place, the search that gave it its best rank (earliest search on ties). */
function originBySearch(searches: readonly SearchRecord[]): Map<string, SearchRecord> {
  const origin = new Map<string, { record: SearchRecord; rank: number }>();
  for (const record of searches) {
    for (const c of record.result.candidates) {
      const current = origin.get(c.id);
      if (!current || c.qlooRank < current.rank) origin.set(c.id, { record, rank: c.qlooRank });
    }
  }
  return new Map([...origin].map(([id, o]) => [id, o.record]));
}

/**
 * Every search came back empty: try the regional family of a favourite cuisine once (Haitian →
 * Caribbean), through the session, so the ID rule, limits and trace still apply. Taste signals
 * from the main search are kept. Returns what was tried, or null if nothing was found.
 */
async function searchRelatedCuisine(
  session: SearchSession,
  profile: SeniorProfile,
): Promise<{ cuisine: string; family: string } | null> {
  const main = session.searches[0];
  for (const cuisine of profile.favouriteCuisines) {
    const family = cuisineFamilyOf(cuisine);
    if (!family) continue;
    const before = session.searches.length;
    const lookup = await session.run("find_cuisine_tags", { query: family });
    if (lookup.isError) return null;
    const tags = (JSON.parse(lookup.content) as { tags: TagCandidate[] }).tags;
    const tag = tags.find((t) => t.family === "cuisine") ?? tags[0];
    if (!tag) continue;
    const entityIds = main.signals.filter((s) => s.kind !== "tag").map((s) => s.id);
    await session.run("search_restaurants", {
      cuisine_tag_ids: [tag.id],
      ...(entityIds.length ? { signal_entity_ids: entityIds } : {}),
    });
    const added = session.searches.slice(before);
    if (added.some((s) => s.result.candidates.length)) return { cuisine, family };
  }
  return null;
}

export async function recommend(
  profile: SeniorProfile,
  feedback: RankingFeedback = {},
  deps: RecommendDeps = {},
): Promise<RecommendResponse> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const search = deps.search ?? createQlooSearch();
  const env = getAnthropicEnv();
  const model = deps.model ?? env.model;
  const anthropicCounter = { n: 0 };
  const rawClient =
    deps.anthropic !== undefined ? deps.anthropic : env.apiKey ? new Anthropic({ apiKey: env.apiKey }) : null;

  // The no-signal baseline starts as soon as the main search returns, while planning continues.
  let baseline: { main: SearchRecord; promise: Promise<RestaurantSearchResult> } | null = null;
  const onSearch = (record: SearchRecord) => {
    // The main search is the first one, unless it found nothing and a later one (e.g. the
    // related-cuisine fallback) did: compare against a list that has places.
    const replacesEmpty = baseline && !baseline.main.result.candidates.length && record.result.candidates.length;
    if (baseline ? !replacesEmpty : record.index !== 1) return;
    const promise = search.searchRestaurants({
      cuisineTagIds: record.result.tagsUsed,
      location: record.result.locationUsed,
    });
    promise.catch(() => undefined); // awaited (and reported) below
    baseline = { main: record, promise };
  };

  // Steps reach the final trace in the sequence they are recorded, so a running count matches it.
  let emitted = 0;
  const onStep = (s: TraceStep) => deps.onStep?.({ ...s, step: ++emitted });

  const input = plannerInput(profile);
  const location = searchLocation(profile);
  const sessionHooks = { onSearch, onStep, fallbackLocation: cityWide(profile) };
  let session = new SearchSession(search, location, sessionHooks);
  const trace: TraceStep[] = [];
  let planner: "agent" | "fallback" = "fallback";
  let fallbackReason: string | undefined;

  if (rawClient) {
    try {
      const result = await runClaudePlanner({
        client: countingClient(rawClient, anthropicCounter),
        model,
        input,
        session,
        deadline: startedAt + (deps.agentBudgetMs ?? AGENT_BUDGET_MS),
        now,
      });
      session.note("planner", "Claude", `Planned ${session.searches.length} search(es) in ${result.turns} turn(s); ended by ${result.endedBy}`);
    } catch (err) {
      if (err instanceof LocationNotFoundError) throw err;
      const reason = describeAnthropicError(err);
      session.note("planner", "Claude", `Not available right now (${reason})`);
      if (!session.searches.length) fallbackReason = reason;
    }
    if (session.searches.length) planner = "agent";
    else fallbackReason ??= "Claude ran no successful restaurant search";
  } else {
    fallbackReason = "no Anthropic API key configured";
  }

  if (planner === "fallback") {
    trace.push(...session.trace);
    session = new SearchSession(search, location, sessionHooks);
    session.note("planner", "built-in plan", `Searching with Tastora's built-in plan instead (${fallbackReason})`);
    await runFallbackPlanner(session, input);
  }

  const notices: string[] = [];
  if (planner === "fallback") notices.push(PLANNER_FALLBACK_NOTICE);
  if (session.searches.length && session.searches.every((s) => !s.result.candidates.length)) {
    const related = await searchRelatedCuisine(session, profile);
    if (related) notices.push(relatedCuisineNotice(related.cuisine, related.family, describeLocation(profile)));
  }
  trace.push(...session.trace);

  if (!session.searches.length) {
    throw new UpstreamError("No restaurant search succeeded");
  }

  const searches = session.searches;
  const merged = mergeByBestRank(searches.map((s) => s.result.candidates));
  const origin = originBySearch(searches);
  const rankStarted = performance.now();
  // "Los Angeles, Los Angeles County, …" → "Los Angeles": lets "LA" match Qloo's geocode city.
  const cityNames = searches.flatMap((s) => s.result.localityResolved?.split(",")[0]?.trim() || []);
  const { ranked, excluded } = rankCandidates(profile, merged, feedback, { cityNames });
  const results: RecommendResult[] = ranked.map((item) => ({
    ...buildExplanationFacts(profile, item, {
      tasteSignals: (origin.get(item.candidate.id)?.signals ?? []).map((s) => s.name),
    }),
    venue: {
      address: item.candidate.address,
      neighborhood: item.candidate.neighborhood,
      priceLevel: item.candidate.priceLevel,
      rating: item.candidate.rating,
      cuisines: item.candidate.cuisines,
    },
  }));
  const step = (tool: string, inputSummary: string, resultSummary: string, ms: number) => {
    const s = { step: 0, tool, inputSummary, resultSummary, ms };
    trace.push(s);
    onStep(s);
  };
  step(
    "rank",
    `${merged.length} unique places from ${searches.length} search(es)`,
    `Checked against the person's needs: ${ranked.length} shown, ${excluded.length} excluded`,
    Math.round(performance.now() - rankStarted),
  );

  let evidence: QlooEvidence | null = null;
  const pending = baseline as { main: SearchRecord; promise: Promise<RestaurantSearchResult> } | null;
  if (pending) {
    const t = performance.now();
    try {
      evidence = buildEvidence(pending.main, await pending.promise);
      step(
        "baseline",
        `${pending.main.cuisineTags.map((c) => c.name).join(" + ")} without taste signals`,
        `${evidence.overlapCount}/${evidence.personalisedTop10.length} of the personalised top 10 also in the baseline top 10; ${evidence.rankChanges} in a different position`,
        Math.round(performance.now() - t),
      );
    } catch {
      step("baseline", "main cuisine without taste signals", "Qloo request failed; no evidence", Math.round(performance.now() - t));
    }
  }

  // Only searches that contributed places: an empty first search's retry note would just confuse.
  const contributing = searches.filter((s) => s.result.candidates.length);
  notices.push(...new Set(contributing.flatMap((s) => locationNotices(s.result.notes))));
  notices.push(...tasteMemoryNotices(profile, searches.flatMap((s) => s.signals)));

  return {
    results,
    excluded: excluded.map((e) => ({ id: e.candidate.id, name: e.candidate.name, reasons: e.reasons })),
    trace: trace.map((s, i) => ({ ...s, step: i + 1 })),
    evidence,
    notices,
    coverageNote: coverageNote(profile.city, merged.length),
    meta: {
      planner,
      model: planner === "agent" ? model : null,
      ...(fallbackReason ? { fallbackReason } : {}),
      location,
      city: profile.city,
      qlooCalls: search.stats.calls,
      qlooCacheHits: search.stats.cacheHits,
      anthropicRequests: anthropicCounter.n,
      durationMs: now() - startedAt,
    },
  };
}
