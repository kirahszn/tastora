// One-off (Phase 2): shrink fixtures/qloo/samples/ to what the tests use.
// Keeps the listed files only, at most 5 place entities each, and only the fields that
// src/lib/domain/place.ts reads (plus ids/names). Run: `npx tsx scripts/slim-qloo-samples.ts`.
// Note: re-running `npm run qloo:probe` rewrites samples at full size.
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isPlaceEntity, USED_TAG_TYPES } from "../src/lib/domain/place";

const SAMPLE_DIR = join("fixtures", "qloo", "samples");
const MAX_ENTITIES = 5;
const KEEP_FILES = [
  "E5h-west-african-signal-fela.json", // insights shape, with affinity
  "E5i-italian-signal-sinatra.json", // insights shape, Italian
  "E5k-restaurant-signal-dish-soup.json", // soup dishes (texture hints)
  "E6-search-katzs.json", // search shape, garbled specialty dishes
];
const KEEP_PROPERTIES = [
  "address",
  "neighborhood",
  "phone",
  "website",
  "menu_url",
  "hours",
  "is_closed",
  "price_level",
  "business_rating",
  "description",
  "short_description",
  "specialty_dishes",
  "external",
];

type Obj = Record<string, unknown>;

function pick(obj: Obj, keys: readonly string[]): Obj {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

function slimExternal(ext: unknown): unknown {
  if (!ext || typeof ext !== "object") return ext;
  // Array in insights results, single object in search results.
  const gp = (ext as Obj).google_place;
  if (Array.isArray(gp)) return { google_place: gp.map((g) => pick(g as Obj, ["place_id"])) };
  return { google_place: gp && typeof gp === "object" ? pick(gp as Obj, ["place_id"]) : gp };
}

function slimPlace(e: Obj): Obj {
  const props = pick((e.properties ?? {}) as Obj, KEEP_PROPERTIES);
  if ("external" in props) props.external = slimExternal(props.external);
  if (Array.isArray(props.specialty_dishes)) {
    props.specialty_dishes = props.specialty_dishes.map((d) => pick(d as Obj, ["id", "name"]));
  }
  const out = pick(e, ["entity_id", "name", "subtype", "types", "disambiguation"]);
  if (e.location) out.location = pick(e.location as Obj, ["lat", "lon"]);
  if (e.query) out.query = pick(e.query as Obj, ["affinity"]);
  if (e.external) out.external = slimExternal(e.external);
  out.tags = ((e.tags ?? []) as Obj[])
    .filter((t) => USED_TAG_TYPES.includes(t.type as string))
    .map((t) => pick(t, ["id", "tag_id", "name", "type"])); // search tags use tag_id
  out.properties = props;
  return out;
}

function slimBody(body: unknown): unknown {
  const b = body as Obj;
  const slim = (list: unknown[]) =>
    list.filter(isPlaceEntity).slice(0, MAX_ENTITIES).map((e) => slimPlace(e as Obj));
  if (Array.isArray(b.results)) return { results: slim(b.results) };
  const entities = (b.results as Obj | undefined)?.entities;
  if (Array.isArray(entities)) return { success: b.success, results: { entities: slim(entities) } };
  throw new Error("unexpected body shape");
}

function dirSize(): number {
  return readdirSync(SAMPLE_DIR).reduce((n, f) => n + statSync(join(SAMPLE_DIR, f)).size, 0);
}

const before = dirSize();
for (const file of readdirSync(SAMPLE_DIR)) {
  const path = join(SAMPLE_DIR, file);
  if (!KEEP_FILES.includes(file)) {
    rmSync(path);
    continue;
  }
  const rec = JSON.parse(readFileSync(path, "utf8")) as Obj;
  const slim = { request: rec.request, ok: rec.ok, status: rec.status, body: slimBody(rec.body) };
  writeFileSync(path, JSON.stringify(slim, null, 2) + "\n");
}
const after = dirSize();
console.log(`samples: ${before} bytes -> ${after} bytes (${KEEP_FILES.length} files kept)`);
