// Phase 10: builds the landing page's "Watch Qloo re-rank" snapshot from real Qloo responses.
// Run with `npx tsx --conditions=react-server scripts/landing-rerank.ts [--live]`.
//
// Sources (all the same request: Italian genre tag, New York City, take 20; only the signal differs):
//   fixtures/qloo/raw/E3-nyc-italian.json               no signal      (Phase 1 probe, 2026-10-26)
//   fixtures/qloo/raw/E5i-italian-signal-sinatra.json   Frank Sinatra  (Phase 1 probe, 2026-10-26)
//   fixtures/qloo/raw/E5j-italian-signal-fela.json      Fela Kuti      (Phase 1 probe, 2026-10-26)
//   fixtures/qloo/raw/P10-italian-baseline-repeat.json  no signal      (--live, 2026-10-28: checks the baseline is unchanged)
//   fixtures/qloo/raw/P10-italian-signal-marley.json    Bob Marley     (--live, 2026-10-28)
// Each list goes through the app's own code (isPlaceEntity, venueVerdict, normalizePlaces), the
// same way `searchRestaurants` builds the evidence lists, then the top 10 are written to
// src/app/_landing/rerankSnapshot.json (committed; raw/ is gitignored).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isPlaceEntity, normalizePlaces } from "../src/lib/domain/place";
import { qlooRequest, type QlooParams } from "../src/lib/qloo/client";
import { venueVerdict } from "../src/lib/qloo/venueFilter";

const RAW = join("fixtures", "qloo", "raw");
const OUT = join("src", "app", "_landing", "rerankSnapshot.json");
const LIVE = process.argv.includes("--live");

const ITALIAN: QlooParams = {
  "filter.type": "urn:entity:place",
  "filter.location.query": "New York City",
  take: 20,
  "filter.tags": "urn:tag:genre:place:restaurant:italian",
};
// From fixtures/qloo/raw/E5-search-bob-marley.json (the urn:entity:artist result).
const MARLEY = "A921B4A4-466B-4868-8DD2-D0B168EAA306";

interface Recorded {
  request: { path: string; params: QlooParams };
  capturedOn?: string;
  body: { results?: { entities?: unknown[] } };
}

const load = (name: string): Recorded => JSON.parse(readFileSync(join(RAW, `${name}.json`), "utf8"));

async function capture(name: string, params: QlooParams): Promise<Recorded> {
  if (existsSync(join(RAW, `${name}.json`))) return load(name);
  if (!LIVE) throw new Error(`${name} is missing; run with --live to capture it`);
  process.loadEnvFile(".env.local");
  const res = await qlooRequest("/v2/insights", params, { baseUrl: process.env.QLOO_API_BASE_URL });
  const rec: Recorded = {
    request: { path: "/v2/insights", params },
    capturedOn: new Date().toISOString().slice(0, 10),
    body: res.body as Recorded["body"],
  };
  writeFileSync(join(RAW, `${name}.json`), JSON.stringify(rec, null, 2));
  console.log(`live: ${name} ${res.status} ${res.durationMs}ms`);
  return rec;
}

function top10(rec: Recorded) {
  const kept = (rec.body.results?.entities ?? []).filter((e) => isPlaceEntity(e) && venueVerdict(e).keep);
  return normalizePlaces(kept)
    .slice(0, 10)
    .map((c) => ({ id: c.id, name: c.name, area: c.neighborhood }));
}

const ids = (l: { id: string }[]) => l.map((p) => p.id).join();

async function main() {
  const baseline = load("E3-nyc-italian");
  const repeat = await capture("P10-italian-baseline-repeat", ITALIAN);
  const marley = await capture("P10-italian-signal-marley", { ...ITALIAN, "signal.interests.entities": MARLEY });
  const baseTop = top10(baseline);
  const sameBaseline = ids(baseTop) === ids(top10(repeat));
  console.log(`baseline repeat on ${repeat.capturedOn}: ${sameBaseline ? "same top 10, same order" : "DIFFERENT"}`);

  const snapshot = {
    note:
      "Real Qloo /v2/insights results for Italian restaurants in New York City (genre tag urn:tag:genre:place:restaurant:italian, take 20), " +
      "filtered to food venues by Tastora's venue filter. Built by scripts/landing-rerank.ts from fixtures/qloo/raw/.",
    city: "New York City",
    cuisine: "Italian",
    baseline: { capturedOn: "2026-10-26", source: "E3-nyc-italian", top10: baseTop },
    baselineRepeat: { capturedOn: repeat.capturedOn, source: "P10-italian-baseline-repeat", sameTop10: sameBaseline },
    signals: [
      { name: "Frank Sinatra", kind: "artist", capturedOn: "2026-10-26", source: "E5i-italian-signal-sinatra", top10: top10(load("E5i-italian-signal-sinatra")) },
      { name: "Bob Marley", kind: "artist", capturedOn: marley.capturedOn, source: "P10-italian-signal-marley", top10: top10(marley) },
      { name: "Fela Kuti", kind: "artist", capturedOn: "2026-10-26", source: "E5j-italian-signal-fela", top10: top10(load("E5j-italian-signal-fela")) },
    ],
  };
  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  for (const s of snapshot.signals) {
    const base = new Set(baseTop.map((p) => p.id));
    const added = s.top10.filter((p) => !base.has(p.id)).length;
    const moved = s.top10.filter((p, i) => baseTop[i]?.id !== p.id).length;
    console.log(`${s.name}: ${added} new, ${moved} moved`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
