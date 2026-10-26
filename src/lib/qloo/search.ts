// Live Qloo search layer (server-only). Uses only endpoints and params confirmed in
// docs/qloo-findings.md: GET /v2/tags (filter.query, take), GET /search (query, take) and
// GET /v2/insights (filter.type, filter.location.query, filter.tags, signal.interests.entities,
// signal.interests.tags, take). `/search` result types are filtered client-side because the
// `types` param was not exercised live.
import "server-only";
import { isPlaceEntity, normalizePlaces, type Candidate } from "@/lib/domain/place";
import { cacheKey, TtlCache } from "./cache";
import { qlooGet, type QlooParams } from "./client";
import { venueVerdict } from "./venueFilter";

export const NYC_LOCATION = "New York City";
const PLACE = "urn:entity:place";
const GENRE_PREFIX = "urn:tag:genre:place:restaurant:";
const CUISINE_PREFIX = "urn:tag:cuisine:qloo:";

/** Entity kinds seen in live `/search` results and usable as taste signals. */
export const ENTITY_KINDS = {
  artist: "urn:entity:artist",
  movie: "urn:entity:movie",
  tv_show: "urn:entity:tv_show",
  book: "urn:entity:book",
  place: "urn:entity:place",
} as const;
export type EntityKind = keyof typeof ENTITY_KINDS;

export interface TagCandidate {
  id: string;
  name: string;
  /** cuisine: `urn:tag:cuisine:qloo:*`; genre: `urn:tag:genre:place:restaurant:*`. */
  family: "cuisine" | "genre";
}

export interface EntityCandidate {
  id: string;
  name: string;
  kind: EntityKind;
  /** Short disambiguating detail: description, year or address. */
  detail: string | null;
}

export interface RestaurantSearchParams {
  cuisineTagIds: readonly string[];
  location: string;
  signalEntityIds?: readonly string[];
  signalTagIds?: readonly string[];
  take?: number;
}

export interface DroppedVenue {
  id: string;
  name: string;
  reason: string;
}

export interface RestaurantSearchResult {
  /** Normalised food venues, `qlooRank` renumbered 1..n after filtering. */
  candidates: Candidate[];
  dropped: DroppedVenue[];
  /** Cuisine tags actually used, after any genre → cuisine fallback. */
  tagsUsed: string[];
  /** Location actually sent to Qloo. */
  locationUsed: string;
  /** Locality Qloo resolved it to (`query.localities.filter[0].disambiguation`), if echoed. */
  localityResolved: string | null;
  /** Plain-language notes about fallbacks. */
  notes: string[];
}

export interface QlooStats {
  /** Network calls made (cache hits excluded). */
  calls: number;
  cacheHits: number;
}

export interface QlooSearchDeps {
  get?: (path: string, params: QlooParams) => Promise<unknown>;
  cache?: TtlCache;
}

const sharedCache = new TtlCache();

/** Empty the process-wide response cache (tests, smoke script). */
export function clearQlooCache(): void {
  sharedCache.clear();
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function clip(text: string | null, max = 100): string | null {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** `results.entities` for insights, `results` for search, `results.tags` for tags. */
function list(body: unknown, key?: "entities" | "tags"): unknown[] {
  const results = asObj(body).results;
  if (!key) return Array.isArray(results) ? results : [];
  const inner = asObj(results)[key];
  return Array.isArray(inner) ? inner : [];
}

function genreToCuisine(tagId: string): string | null {
  return tagId.startsWith(GENRE_PREFIX) ? CUISINE_PREFIX + tagId.slice(GENRE_PREFIX.length) : null;
}

export function createQlooSearch(deps: QlooSearchDeps = {}) {
  const get = deps.get ?? ((path: string, params: QlooParams) => qlooGet(path, params));
  const cache = deps.cache ?? sharedCache;
  const stats: QlooStats = { calls: 0, cacheHits: 0 };

  async function cachedGet(path: string, params: QlooParams): Promise<unknown> {
    const { value, hit } = await cache.getOrLoad(cacheKey(path, params), () => {
      stats.calls += 1;
      return get(path, params);
    });
    if (hit) stats.cacheHits += 1;
    return value;
  }

  /** Cuisine and restaurant-genre tags matching a free-text query, in Qloo's order. */
  async function findTags(query: string): Promise<TagCandidate[]> {
    const body = await cachedGet("/v2/tags", { "filter.query": query, take: 15 });
    const out: TagCandidate[] = [];
    for (const raw of list(body, "tags")) {
      const t = asObj(raw);
      const id = str(t.id);
      const name = str(t.name);
      if (!id || !name) continue;
      if (t.type === "urn:tag:cuisine:qloo") out.push({ id, name, family: "cuisine" });
      else if (t.type === "urn:tag:genre:place" && id.startsWith(GENRE_PREFIX)) out.push({ id, name, family: "genre" });
    }
    return out;
  }

  /** Entities (artist, movie, …) matching a query, optionally limited to some kinds. */
  async function findEntities(query: string, kinds?: readonly EntityKind[]): Promise<EntityCandidate[]> {
    const body = await cachedGet("/search", { query, take: 10 });
    const wanted = (kinds?.length ? kinds : (Object.keys(ENTITY_KINDS) as EntityKind[])).map((k) => [
      k,
      ENTITY_KINDS[k],
    ]) as [EntityKind, string][];
    const out: EntityCandidate[] = [];
    for (const raw of list(body)) {
      const e = asObj(raw);
      const id = str(e.entity_id);
      const name = str(e.name);
      const types = Array.isArray(e.types) ? e.types : [];
      const kind = wanted.find(([, urn]) => types.includes(urn))?.[0];
      if (!id || !name || !kind) continue;
      const props = asObj(e.properties);
      const disambiguation = str(e.disambiguation);
      out.push({
        id,
        name,
        kind,
        // A disambiguation equal to the name adds nothing ("Fela Kuti" / "Fela Kuti").
        detail: clip(
          str(props.short_description) ?? (disambiguation && disambiguation !== name ? disambiguation : null),
        ),
      });
    }
    return out;
  }

  async function insightsPlaces(params: QlooParams): Promise<{ places: unknown[]; locality: string | null }> {
    const body = await cachedGet("/v2/insights", params);
    const localities = asObj(asObj(asObj(body).query).localities).filter;
    const first = Array.isArray(localities) ? asObj(localities[0]) : {};
    return {
      places: list(body, "entities").filter(isPlaceEntity),
      locality: str(first.disambiguation) ?? str(first.name),
    };
  }

  /**
   * One insights call per cuisine tag (in parallel). If a genre tag returns no places, retry with
   * the cuisine-family tag (Nigerian genre returned 0, cuisine 18). If a non-NYC location
   * returns nothing, retry with New York City. Results are filtered to food venues, merged
   * (best rank wins) and normalised.
   */
  async function searchRestaurants(p: RestaurantSearchParams): Promise<RestaurantSearchResult> {
    const take = p.take ?? 20;
    const notes: string[] = [];
    const signals: QlooParams = {
      ...(p.signalEntityIds?.length ? { "signal.interests.entities": [...p.signalEntityIds] } : {}),
      ...(p.signalTagIds?.length ? { "signal.interests.tags": [...p.signalTagIds] } : {}),
    };
    const base = (tag: string, location: string): QlooParams => ({
      "filter.type": PLACE,
      "filter.location.query": location,
      "filter.tags": tag,
      ...signals,
      take,
    });

    let locationUsed = p.location;
    const runTag = async (tag: string, location: string) => {
      let used = tag;
      let res = await insightsPlaces(base(tag, location));
      const fallback = genreToCuisine(tag);
      if (!res.places.length && fallback) {
        used = fallback;
        res = await insightsPlaces(base(fallback, location));
        notes.push(`Genre tag ${tag} returned nothing; used ${fallback}`);
      }
      return { used, places: res.places, locality: res.locality };
    };

    let runs = await Promise.all(p.cuisineTagIds.map((t) => runTag(t, p.location)));
    if (runs.every((r) => !r.places.length) && p.location !== NYC_LOCATION) {
      notes.push(`No places found for "${p.location}"; searched ${NYC_LOCATION} instead`);
      locationUsed = NYC_LOCATION;
      runs = await Promise.all(p.cuisineTagIds.map((t) => runTag(t, NYC_LOCATION)));
    }

    const dropped: DroppedVenue[] = [];
    const lists = runs.map((r) => {
      const kept: unknown[] = [];
      for (const raw of r.places) {
        const verdict = venueVerdict(raw);
        if (verdict.keep) kept.push(raw);
        else {
          const e = asObj(raw);
          dropped.push({ id: String(e.entity_id ?? ""), name: String(e.name ?? ""), reason: verdict.reason });
        }
      }
      return normalizePlaces(kept);
    });

    return {
      candidates: mergeByBestRank(lists),
      dropped: dedupeById(dropped),
      tagsUsed: runs.map((r) => r.used),
      locationUsed,
      localityResolved: runs.find((r) => r.locality)?.locality ?? null,
      notes,
    };
  }

  return { stats, findTags, findEntities, searchRestaurants };
}

export type QlooSearch = ReturnType<typeof createQlooSearch>;

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/**
 * Merge candidate lists, keeping each place once at its best (lowest) Qloo rank. Output is sorted
 * by that rank, then by id, so it is deterministic.
 */
export function mergeByBestRank(lists: readonly (readonly Candidate[])[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const l of lists) {
    for (const c of l) {
      const current = best.get(c.id);
      if (!current || c.qlooRank < current.qlooRank) best.set(c.id, c);
    }
  }
  return [...best.values()].sort((a, b) => a.qlooRank - b.qlooRank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
