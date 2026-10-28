// Phase 9c coverage check beyond NYC. Run with `npm run qloo:coverage`.
// Goes through the real search layer (createQlooSearch: venue filter, genre → cuisine fallback)
// with a recording `get`, so each live call is saved raw to fixtures/qloo/raw/city-*.json
// (gitignored) and summarised into slim samples fixtures/qloo/samples/city-*.json.
// Hard budget: 24 live calls for the whole phase (counter persisted in raw/_coverage-calls.json).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { qlooRequest, type QlooParams } from "../src/lib/qloo/client";
import { createQlooSearch, type RestaurantSearchResult } from "../src/lib/qloo/search";

process.loadEnvFile(".env.local");

const RAW_DIR = join("fixtures", "qloo", "raw");
const SAMPLE_DIR = join("fixtures", "qloo", "samples");
const CALLS_FILE = join(RAW_DIR, "_coverage-calls.json");
const CALL_BUDGET = 24;
/** Frank Sinatra (artist), from the Phase 1 /search response E5-search-frank-sinatra. */
const SINATRA = "FC0F8D26-BA80-4D83-8BBF-FC011DC8D241";
const ITALIAN = "urn:tag:genre:place:restaurant:italian";

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(SAMPLE_DIR, { recursive: true });

let callCount: number = existsSync(CALLS_FILE)
  ? (JSON.parse(readFileSync(CALLS_FILE, "utf8")) as { count: number }).count
  : 0;

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

interface RawCall {
  path: string;
  params: QlooParams;
  status: number | null;
  durationMs: number | null;
  body: unknown;
}

/** Records every live call made through the search layer during one experiment. */
function recorder() {
  const calls: RawCall[] = [];
  const get = async (path: string, params: QlooParams) => {
    if (callCount >= CALL_BUDGET) throw new Error(`Coverage call budget of ${CALL_BUDGET} reached`);
    callCount += 1;
    writeFileSync(CALLS_FILE, JSON.stringify({ count: callCount }));
    try {
      const res = await qlooRequest(path, params, { baseUrl: process.env.QLOO_API_BASE_URL });
      calls.push({ path, params, status: res.status, durationMs: res.durationMs, body: res.body });
      console.log(`  [${callCount}] ${res.status} ${res.durationMs}ms ${path} ${params["filter.location.query"] ?? params["filter.query"] ?? ""}`);
      return res.body;
    } catch (err) {
      const e = err as { status?: number | null; body?: unknown; message?: string };
      calls.push({ path, params, status: e.status ?? null, durationMs: null, body: e.body ?? { clientError: e.message } });
      console.log(`  [${callCount}] ERR ${e.status ?? "-"} ${path}: ${e.message}`);
      throw err;
    }
  };
  return { calls, search: createQlooSearch({ get }) };
}

// ---- per-place location / field summary over the raw body ----

function entities(body: unknown): Obj[] {
  const r = asObj(asObj(body).results).entities;
  return Array.isArray(r) ? (r as Obj[]) : [];
}

function slimPlace(e: Obj) {
  const p = asObj(e.properties);
  const g = asObj(p.geocode);
  const loc = asObj(p.locality);
  const tags = Array.isArray(e.tags) ? (e.tags as Obj[]) : [];
  const dishes =
    tags.filter((t) => t.type === "urn:tag:menu_highlight:qloo" || t.type === "urn:tag:specialty_dish:place").length +
    (Array.isArray(p.specialty_dishes) ? p.specialty_dishes.length : 0);
  return {
    entity_id: e.entity_id,
    name: e.name,
    primary_genre: asObj(p.primary_genre).id ?? p.primary_genre ?? null,
    address: p.address ?? null,
    neighborhood: p.neighborhood ?? null,
    geocode: Object.keys(g).length
      ? {
          city: g.city ?? null,
          name: g.name ?? null,
          metro: g.metro ?? null,
          admin1_region: g.admin1_region ?? null,
          admin2_region: g.admin2_region ?? null,
          country_code: g.country_code ?? null,
        }
      : null,
    locality: Object.keys(loc).length
      ? {
          city: asObj(loc.city).name ?? null,
          metro: asObj(loc.metro).name ?? null,
          neighborhood: asObj(loc.neighborhood).name ?? null,
        }
      : null,
    phone: p.phone ?? null,
    hasWebsite: !!p.website,
    hasHours: !!p.hours,
    dishCount: dishes,
  };
}

function summarise(label: string, rec: { calls: RawCall[] }, result: RestaurantSearchResult | null, cityNames: string[]) {
  const insights = rec.calls.filter((c) => c.path === "/v2/insights");
  const raw = insights.flatMap((c) => entities(c.body));
  const places = raw.map(slimPlace);
  const keptIds = new Set(result?.candidates.map((c) => c.id) ?? []);
  const kept = places.filter((p) => keptIds.has(String(p.entity_id)));
  const norm = (s: unknown) => (typeof s === "string" ? s.toLowerCase() : "");
  const inCity = (p: ReturnType<typeof slimPlace>) =>
    cityNames.some((n) => [p.geocode?.city, p.locality?.city, p.geocode?.metro, p.locality?.metro].some((v) => norm(v) === n.toLowerCase()));
  const count = (f: (p: ReturnType<typeof slimPlace>) => unknown) => kept.filter((p) => !!f(p)).length;
  const tally = (f: (p: ReturnType<typeof slimPlace>) => unknown) => {
    const t: Record<string, number> = {};
    for (const p of kept) {
      const k = String(f(p) ?? "∅");
      t[k] = (t[k] ?? 0) + 1;
    }
    return t;
  };
  const localities = insights.map((c) => {
    const f = asObj(asObj(asObj(c.body).query).localities).filter;
    const first = Array.isArray(f) ? asObj(f[0]) : {};
    return (first.disambiguation as string) ?? (first.name as string) ?? null;
  });
  return {
    label,
    requests: rec.calls.map((c) => ({
      path: c.path,
      params: c.params,
      status: c.status,
      durationMs: c.durationMs,
      error: c.status && c.status >= 400 ? c.body : undefined,
    })),
    localityResolved: localities,
    rawPlaces: raw.length,
    kept: kept.length,
    dropped: result?.dropped ?? [],
    notes: result?.notes ?? [],
    inCity: kept.filter(inCity).length,
    geocodeCity: tally((p) => p.geocode?.city),
    localityCity: tally((p) => p.locality?.city),
    geocodeName: tally((p) => p.geocode?.name),
    countryCode: tally((p) => p.geocode?.country_code),
    fieldCoverage: {
      geocode: count((p) => p.geocode),
      geocodeCity: count((p) => p.geocode?.city),
      geocodeName: count((p) => p.geocode?.name),
      admin1: count((p) => p.geocode?.admin1_region),
      admin2: count((p) => p.geocode?.admin2_region),
      localityCity: count((p) => p.locality?.city),
      localityNeighborhood: count((p) => p.locality?.neighborhood),
      neighborhoodProp: count((p) => p.neighborhood),
      address: count((p) => p.address),
      phone: count((p) => p.phone),
      website: count((p) => p.hasWebsite),
      hours: count((p) => p.hasHours),
      dishes: count((p) => p.dishCount > 0),
    },
    phoneSamples: kept.map((p) => p.phone).filter(Boolean).slice(0, 4),
    top10: (result?.candidates ?? []).slice(0, 10).map((c) => ({ id: c.id, name: c.name })),
    samplePlaces: kept.slice(0, 5),
  };
}

type Summary = ReturnType<typeof summarise>;

function saveRaw(name: string, calls: RawCall[]) {
  writeFileSync(join(RAW_DIR, `${name}.json`), JSON.stringify(calls, null, 2));
}

async function runSearch(name: string, label: string, location: string, tag: string, cityNames: string[], signal?: string) {
  const rec = recorder();
  let result: RestaurantSearchResult | null = null;
  try {
    result = await rec.search.searchRestaurants({
      cuisineTagIds: [tag],
      location,
      ...(signal ? { signalEntityIds: [signal] } : {}),
    });
  } catch {
    // recorded in rec.calls
  }
  saveRaw(name, rec.calls);
  return summarise(label, rec, result, cityNames);
}

interface City {
  slug: string;
  location: string;
  /** Names that count as "inside the city" in geocode.city / locality.city / metro. */
  names: string[];
  local: { name: string; tag: string };
}

async function main() {
  // Tag ids for cuisines not looked up in Phase 1, through the real findTags.
  const tagRec = recorder();
  const tagIds: Record<string, string> = {};
  for (const q of ["indian", "korean", "polish"]) {
    const tags = await tagRec.search.findTags(q);
    const t = tags.find((x) => x.family === "genre") ?? tags[0];
    if (t) tagIds[q] = t.id;
    console.log(`tags ${q}:`, tags.slice(0, 4));
  }
  saveRaw("city-tags", tagRec.calls);

  const cities: City[] = [
    { slug: "london", location: "London", names: ["London"], local: { name: "Indian", tag: tagIds.indian } },
    { slug: "toronto", location: "Toronto", names: ["Toronto"], local: { name: "Chinese", tag: "urn:tag:genre:place:restaurant:chinese" } },
    { slug: "los-angeles", location: "Los Angeles", names: ["Los Angeles"], local: { name: "Korean", tag: tagIds.korean } },
    { slug: "chicago", location: "Chicago", names: ["Chicago"], local: { name: "Polish", tag: tagIds.polish } },
    { slug: "lagos", location: "Lagos", names: ["Lagos"], local: { name: "Nigerian", tag: "urn:tag:cuisine:qloo:nigerian" } },
    { slug: "sydney", location: "Sydney", names: ["Sydney"], local: { name: "Chinese", tag: "urn:tag:genre:place:restaurant:chinese" } },
  ];

  for (const city of cities) {
    console.log(`== ${city.location}`);
    const runs: Summary[] = [];
    runs.push(await runSearch(`city-${city.slug}-italian`, "Italian", city.location, ITALIAN, city.names));
    if (city.local.tag) {
      runs.push(await runSearch(`city-${city.slug}-local`, city.local.name, city.location, city.local.tag, city.names));
    }
    const signalled = await runSearch(`city-${city.slug}-italian-sinatra`, "Italian + Frank Sinatra", city.location, ITALIAN, city.names, SINATRA);
    const base = new Set(runs[0].top10.map((p) => p.id));
    const overlap = signalled.top10.filter((p) => base.has(p.id)).length;
    const samePos = signalled.top10.filter((p, i) => runs[0].top10[i]?.id === p.id).length;
    runs.push(signalled);
    const out = { city: city.location, phase: "9c coverage", sinatraTop10OverlapWithItalian: overlap, sinatraTop10SamePosition: samePos, runs };
    writeFileSync(join(SAMPLE_DIR, `city-${city.slug}.json`), JSON.stringify(out, null, 2));
    for (const r of runs) {
      console.log(
        `  ${r.label}: locality=${JSON.stringify(r.localityResolved)} raw=${r.rawPlaces} kept=${r.kept} inCity=${r.inCity} dropped=${r.dropped.length} cov=${JSON.stringify(r.fieldCoverage)} phones=${JSON.stringify(r.phoneSamples)} cities=${JSON.stringify(r.geocodeCity)}`,
      );
    }
    console.log(`  Sinatra overlap ${overlap}/10, same position ${samePos}`);
  }

  // Edge checks: an unresolvable place, and an "area, city" query.
  // The unresolvable one is a single direct call: through searchRestaurants an empty answer would
  // trigger the genre → cuisine and NYC retries, spending budget on nothing new.
  const edges: Summary[] = [];
  {
    const rec = { calls: [] as RawCall[] };
    if (callCount < CALL_BUDGET) {
      callCount += 1;
      writeFileSync(CALLS_FILE, JSON.stringify({ count: callCount }));
      const params = { "filter.type": "urn:entity:place", "filter.location.query": "Qwxzvillezz", "filter.tags": ITALIAN, take: 20 };
      try {
        const res = await qlooRequest("/v2/insights", params, { baseUrl: process.env.QLOO_API_BASE_URL });
        rec.calls.push({ path: "/v2/insights", params, status: res.status, durationMs: res.durationMs, body: res.body });
      } catch (err) {
        const e = err as { status?: number | null; body?: unknown; message?: string };
        rec.calls.push({ path: "/v2/insights", params, status: e.status ?? null, durationMs: null, body: e.body ?? { clientError: e.message } });
      }
      console.log(`  [${callCount}] unresolvable: ${rec.calls[0].status} ${JSON.stringify(rec.calls[0].body).slice(0, 300)}`);
    }
    saveRaw("city-edge-unresolvable", rec.calls);
    edges.push(summarise("Italian @ unresolvable (direct call)", rec, null, []));
  }
  edges.push(await runSearch("city-edge-area-city", "Italian @ Queens, New York City", "Queens, New York City", ITALIAN, ["New York"]));
  writeFileSync(join(SAMPLE_DIR, "city-edges.json"), JSON.stringify({ phase: "9c coverage", runs: edges }, null, 2));
  for (const r of edges) {
    console.log(`  ${r.label}: ${JSON.stringify({ req: r.requests.map((q) => [q.status, q.params["filter.location.query"], q.error]), loc: r.localityResolved, raw: r.rawPlaces, kept: r.kept, notes: r.notes, cities: r.geocodeCity, county: r.samplePlaces.map((p) => p.geocode?.admin2_region) })}`);
  }
  console.log(`Total coverage calls: ${callCount}/${CALL_BUDGET}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
