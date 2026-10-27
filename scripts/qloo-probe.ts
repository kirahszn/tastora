// Phase 1 Qloo validation probe. Run with `npm run qloo:probe [-- E1 E2 ...]`.
// Saves full responses to fixtures/qloo/raw/ (gitignored) and trimmed samples
// (max 5 entities) to fixtures/qloo/samples/ (committed). Never writes headers or the key.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { qlooRequest, QlooApiError, type QlooParams } from "../src/lib/qloo/client";

process.loadEnvFile(".env.local");

const RAW_DIR = join("fixtures", "qloo", "raw");
const SAMPLE_DIR = join("fixtures", "qloo", "samples");
const CALLS_FILE = join(RAW_DIR, "_calls.json");
const CALL_BUDGET = 60;
const SAMPLE_MAX = 5;
const NYC = "New York City";

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(SAMPLE_DIR, { recursive: true });

// Live-call counter persisted across runs so the budget holds for the whole phase.
let callCount: number = existsSync(CALLS_FILE)
  ? (JSON.parse(readFileSync(CALLS_FILE, "utf8")) as { count: number }).count
  : 0;

interface Recorded {
  request: { path: string; params: QlooParams };
  ok: boolean;
  status: number | null;
  durationMs: number | null;
  rateLimitHeaders: Record<string, string>;
  body: unknown;
}

function rateLimitHeaders(headers: Headers | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  headers?.forEach((value, key) => {
    if (/rate|limit|retry|quota/i.test(key)) out[key] = value;
  });
  return out;
}

function trim(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.results)) return { ...b, results: b.results.slice(0, SAMPLE_MAX) };
  if (b.results && typeof b.results === "object") {
    const results = Object.fromEntries(
      Object.entries(b.results as Record<string, unknown>).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.slice(0, SAMPLE_MAX) : v,
      ]),
    );
    return { ...b, results };
  }
  return body;
}

async function call(
  name: string,
  path: string,
  params: QlooParams,
  options: { apiKey?: string } = {},
): Promise<Recorded> {
  if (callCount >= CALL_BUDGET) throw new Error(`Call budget of ${CALL_BUDGET} reached`);
  callCount += 1;
  writeFileSync(CALLS_FILE, JSON.stringify({ count: callCount }));

  const env = { baseUrl: process.env.QLOO_API_BASE_URL, ...options };
  let rec: Recorded;
  try {
    const res = await qlooRequest(path, params, env);
    rec = {
      request: { path, params },
      ok: true,
      status: res.status,
      durationMs: res.durationMs,
      rateLimitHeaders: rateLimitHeaders(res.headers),
      body: res.body,
    };
  } catch (err) {
    if (!(err instanceof QlooApiError)) throw err;
    rec = {
      request: { path, params },
      ok: false,
      status: err.status,
      durationMs: null,
      rateLimitHeaders: {},
      body: err.body ?? { clientError: err.message },
    };
  }

  writeFileSync(join(RAW_DIR, `${name}.json`), JSON.stringify(rec, null, 2));
  writeFileSync(join(SAMPLE_DIR, `${name}.json`), JSON.stringify({ ...rec, body: trim(rec.body) }, null, 2));
  console.log(`[${callCount}] ${name}: ${rec.status ?? "ERR"} ${rec.durationMs ?? "-"}ms ${path}`);
  return rec;
}

// ---- helpers over unknown response bodies ----

type Obj = Record<string, unknown>;

function entitiesOf(rec: Recorded): Obj[] {
  const b = rec.body as Obj | null;
  if (!b) return [];
  if (Array.isArray(b.results)) return b.results as Obj[];
  const r = b.results as Obj | undefined;
  if (r && Array.isArray(r.entities)) return r.entities as Obj[];
  if (r && Array.isArray(r.tags)) return r.tags as Obj[];
  return [];
}

function load(name: string): Recorded {
  return JSON.parse(readFileSync(join(RAW_DIR, `${name}.json`), "utf8")) as Recorded;
}

function firstId(name: string, match?: (e: Obj) => boolean): string | undefined {
  const list = entitiesOf(load(name));
  const hit = match ? list.find(match) : list[0];
  return (hit?.entity_id ?? hit?.id) as string | undefined;
}

const PORTRAIT_ARTISTS = [
  ["fela", "E6-search-fela-kuti"],
  ["sinatra", "E5-search-frank-sinatra"],
  ["marley", "E5-search-bob-marley"],
] as const;

function portraitArtist(searchFile: string): string {
  const id = firstId(searchFile, (e) => (e.types as string[] | undefined)?.includes("urn:entity:artist") ?? false);
  if (!id) throw new Error(`No artist in ${searchFile}`);
  return id;
}

// ---- experiments ----

const RESTAURANT = "urn:tag:category:place:restaurant";
const placeBase: QlooParams = {
  "filter.type": "urn:entity:place",
  "filter.location.query": NYC,
  take: 20,
};

const experiments: Record<string, () => Promise<void>> = {
  async E1() {
    await call("E1-connectivity", "/search", { query: "pizza", take: 1 });
  },

  async E2() {
    const terms = [
      "nigerian",
      "west african",
      "caribbean",
      "soul food",
      "italian",
      "chinese",
      "jewish deli",
      "soup",
      "vegetarian",
    ];
    for (const t of terms) {
      await call(`E2-tags-${t.replace(/\s+/g, "-")}`, "/v2/tags", { "filter.query": t, take: 15 });
    }
  },

  async E3() {
    // Tag IDs taken from the E2 /v2/tags results.
    const cuisines: Record<string, string> = {
      nigerian: "urn:tag:genre:place:restaurant:nigerian",
      "west-african": "urn:tag:genre:place:restaurant:west_african",
      caribbean: "urn:tag:genre:place:restaurant:caribbean",
      italian: "urn:tag:genre:place:restaurant:italian",
    };
    for (const [name, tag] of Object.entries(cuisines)) {
      await call(`E3-nyc-${name}`, "/v2/insights", { ...placeBase, "filter.tags": tag });
    }
  },

  async E5() {
    const base: QlooParams = { ...placeBase, "filter.tags": RESTAURANT };
    const artist = (e: Obj) => (e.types as string[] | undefined)?.includes("urn:entity:artist") ?? false;
    const movie = (e: Obj) => (e.types as string[] | undefined)?.includes("urn:entity:movie") ?? false;

    await call("E5-search-bob-marley", "/search", { query: "Bob Marley", take: 5 });
    await call("E5-search-living-in-bondage", "/search", { query: "Living in Bondage", take: 5 });
    await call("E5-search-frank-sinatra", "/search", { query: "Frank Sinatra", take: 5 });

    const fela = firstId("E6-search-fela-kuti", artist);
    const marley = firstId("E5-search-bob-marley", artist);
    const nollywood = firstId("E5-search-living-in-bondage", movie);
    const sinatra = firstId("E5-search-frank-sinatra", artist);
    console.log({ fela, marley, nollywood, sinatra });

    await call("E5a-baseline", "/v2/insights", base);
    await call("E5a2-baseline-repeat", "/v2/insights", base);
    await call("E5b-signal-tags", "/v2/insights", {
      ...base,
      "signal.interests.tags": [
        "urn:tag:genre:place:restaurant:nigerian",
        "urn:tag:genre:place:restaurant:west_african",
        "urn:tag:genre:place:restaurant:caribbean",
      ],
    });
    if (fela) await call("E5c-signal-entity-fela-kuti", "/v2/insights", { ...base, "signal.interests.entities": fela });
    if (marley) await call("E5d-signal-entity-bob-marley", "/v2/insights", { ...base, "signal.interests.entities": marley });
    if (nollywood) {
      await call("E5e-signal-entity-nollywood", "/v2/insights", { ...base, "signal.interests.entities": nollywood });
    }
    if (sinatra) {
      // Control: a culturally different signal, to tell real taste shifts from generic reshuffling.
      await call("E5f-signal-entity-frank-sinatra", "/v2/insights", { ...base, "signal.interests.entities": sinatra });
    }
    await call("E5g-signal-age-55plus", "/v2/insights", { ...base, "signal.demographics.age": "55_and_older" });
  },

  // Follow-ups after the first E3/E5 run.
  async E3b() {
    // The genre tag for Nigerian returned 0 NYC places; try the cuisine tag from E2.
    await call("E3b-nyc-nigerian-cuisine-tag", "/v2/insights", {
      ...placeBase,
      "filter.tags": "urn:tag:cuisine:qloo:nigerian",
    });
  },

  async E5x() {
    // Does a taste signal re-rank *within* a cuisine-filtered set (Tastora's real use)?
    const westAfrican = { ...placeBase, "filter.tags": "urn:tag:genre:place:restaurant:west_african" };
    const italian = { ...placeBase, "filter.tags": "urn:tag:genre:place:restaurant:italian" };
    const fela = firstId("E6-search-fela-kuti");
    const sinatra = firstId("E5-search-frank-sinatra");
    await call("E5h-west-african-signal-fela", "/v2/insights", { ...westAfrican, "signal.interests.entities": fela });
    await call("E5i-italian-signal-sinatra", "/v2/insights", { ...italian, "signal.interests.entities": sinatra });
    await call("E5j-italian-signal-fela", "/v2/insights", { ...italian, "signal.interests.entities": fela });
    await call("E5k-restaurant-signal-dish-soup", "/v2/insights", {
      ...placeBase,
      "filter.tags": RESTAURANT,
      "signal.interests.tags": "urn:tag:specialty_dish:place:soup",
    });
  },

  async E6() {
    await call("E6-search-katzs", "/search", { query: "Katz's Delicatessen", take: 5 });
    await call("E6-search-fela-kuti", "/search", { query: "Fela Kuti", take: 5 });
  },

  // Phase 7: taste-portrait validation. Entity ids come from the E5/E6 search responses.
  async P1() {
    await call("portrait-fela-tags-cuisine", "/v2/insights", {
      "filter.type": "urn:tag",
      "filter.tag.types": "urn:tag:cuisine:qloo",
      "signal.interests.entities": portraitArtist("E6-search-fela-kuti"),
      take: 10,
    });
  },

  async P1b() {
    // P1 (filter.tag.types=cuisine) returned 0 tags; see which tag types a place-parent filter gives.
    await call("portrait-fela-tags-place-parent", "/v2/insights", {
      "filter.type": "urn:tag",
      "filter.parents.types": "urn:entity:place",
      "signal.interests.entities": portraitArtist("E6-search-fela-kuti"),
      take: 50,
    });
  },

  async P2() {
    const sinatra = portraitArtist("E5-search-frank-sinatra");
    const marley = portraitArtist("E5-search-bob-marley");
    // Sanity check: does tag insights work for a same-domain (music) tag family?
    await call("portrait-fela-tags-genre-music", "/v2/insights", {
      "filter.type": "urn:tag",
      "filter.tag.types": "urn:tag:genre:music",
      "signal.interests.entities": portraitArtist("E6-search-fela-kuti"),
      take: 10,
    });
    for (const [name, id] of [["sinatra", sinatra], ["marley", marley]] as const) {
      await call(`portrait-${name}-tags-cuisine`, "/v2/insights", {
        "filter.type": "urn:tag",
        "filter.tag.types": "urn:tag:cuisine:qloo",
        "signal.interests.entities": id,
        take: 10,
      });
    }
    // Cross-domain entities: movies for all three.
    for (const [name, file] of PORTRAIT_ARTISTS) {
      await call(`portrait-${name}-movies`, "/v2/insights", {
        "filter.type": "urn:entity:movie",
        "signal.interests.entities": portraitArtist(file),
        take: 10,
      });
    }
    const fela = portraitArtist("E6-search-fela-kuti");
    await call("portrait-fela-artists", "/v2/insights", {
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": fela,
      take: 10,
    });
    await call("portrait-fela-destinations", "/v2/insights", {
      "filter.type": "urn:entity:destination",
      "signal.interests.entities": fela,
      take: 10,
    });
    // Dining tags with a NYC location signal, and the restaurant-genre family.
    await call("portrait-fela-tags-cuisine-nyc", "/v2/insights", {
      "filter.type": "urn:tag",
      "filter.tag.types": "urn:tag:cuisine:qloo",
      "signal.interests.entities": fela,
      "signal.location.query": NYC,
      take: 10,
    });
    await call("portrait-fela-tags-genre-place", "/v2/insights", {
      "filter.type": "urn:tag",
      "filter.tag.types": "urn:tag:genre:place",
      "signal.interests.entities": fela,
      take: 10,
    });
  },

  async E7() {
    await call("E7-invalid-param", "/v2/insights", { "filter.type": "urn:entity:not_a_type", take: 5 });
    // Deliberately fake key; the real key is never used here.
    await call("E7-bad-key", "/search", { query: "pizza", take: 1 }, { apiKey: "fake-key-for-error-test" });
  },
};

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(experiments);
  for (const n of names) {
    const fn = experiments[n];
    if (!fn) throw new Error(`Unknown experiment ${n}`);
    console.log(`== ${n}`);
    await fn();
  }
  console.log(`Total live Qloo calls so far: ${callCount}/${CALL_BUDGET}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
