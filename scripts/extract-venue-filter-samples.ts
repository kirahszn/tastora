// One-off (Phase 3): build fixtures/qloo/samples/venue-filter.json from the local raw fixtures,
// for the non-restaurant filter tests. Keeps every place whose primary genre is outside the
// restaurant namespace or drink/music-first, plus the first 10 ordinary restaurants, with only
// the fields the filter reads. Run: `npx tsx scripts/extract-venue-filter-samples.ts`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isPlaceEntity } from "../src/lib/domain/place";

const RAW_DIR = join("fixtures", "qloo", "raw");
const OUT = join("fixtures", "qloo", "samples", "venue-filter.json");
const DRINK_FIRST = /restaurant:(bar|cocktail_bar|wine_bar|lounge_bar|live_music_bar|beer_garden)$/;
const ORDINARY_MAX = 10;

type Obj = Record<string, unknown>;
const seen = new Set<string>();
const special: Obj[] = [];
const ordinary: Obj[] = [];

for (const file of readdirSync(RAW_DIR).filter((f) => /^E[35]/.test(f)).sort()) {
  const body = (JSON.parse(readFileSync(join(RAW_DIR, file), "utf8")) as Obj).body as Obj;
  const results = body?.results as Obj | undefined;
  const entities = (Array.isArray(results) ? results : (results?.entities ?? [])) as Obj[];
  for (const e of entities.filter(isPlaceEntity)) {
    const id = e.entity_id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const genre = ((e.properties as Obj)?.primary_genre ?? null) as Obj | null;
    const slim = {
      entity_id: id,
      name: e.name,
      subtype: e.subtype,
      properties: { primary_genre: genre && { id: genre.id, name: genre.name } },
      tags: ((e.tags ?? []) as Obj[])
        .filter((t) => t.type === "urn:tag:category:place")
        .map((t) => ({ id: t.id ?? t.tag_id, name: t.name, type: t.type })),
      source: file,
    };
    const gid = String(genre?.id ?? "");
    const inRestaurantNamespace = gid.startsWith("urn:tag:genre:place:restaurant");
    if (!inRestaurantNamespace || DRINK_FIRST.test(gid)) special.push(slim);
    else if (ordinary.length < ORDINARY_MAX) ordinary.push(slim);
  }
}

writeFileSync(OUT, JSON.stringify({ note: "Slim places for the venue filter; see scripts/extract-venue-filter-samples.ts", places: [...special, ...ordinary] }, null, 2) + "\n");
console.log(`${special.length} special + ${ordinary.length} ordinary places from ${seen.size} unique → ${OUT}`);
