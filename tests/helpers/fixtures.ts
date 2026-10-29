import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePlaces, type Candidate, type Tag } from "@/lib/domain/place";
import { SeniorProfileSchema, type SeniorProfile, type SeniorProfileInput } from "@/lib/domain/profile";

const SAMPLE_DIR = join(process.cwd(), "fixtures", "qloo", "samples");

export const SAMPLES = {
  westAfricanFela: "E5h-west-african-signal-fela.json",
  italianSinatra: "E5i-italian-signal-sinatra.json",
  soup: "E5k-restaurant-signal-dish-soup.json",
  searchKatz: "E6-search-katzs.json",
} as const;

/** Raw entity list of a recorded sample (insights `results.entities` or search `results`). */
export function sampleEntities(file: string): unknown[] {
  const { body } = JSON.parse(readFileSync(join(SAMPLE_DIR, file), "utf8"));
  return Array.isArray(body.results) ? body.results : body.results.entities;
}

export function sampleCandidates(file: string): Candidate[] {
  return normalizePlaces(sampleEntities(file));
}

export function sampleCandidate(file: string, name: string): Candidate {
  const found = sampleCandidates(file).find((c) => c.name === name);
  if (!found) throw new Error(`${name} not in ${file}`);
  return found;
}

export function allSampleCandidates(): Candidate[] {
  return Object.values(SAMPLES).flatMap(sampleCandidates);
}

export function makeProfile(input: Partial<SeniorProfileInput> = {}): SeniorProfile {
  return SeniorProfileSchema.parse({
    favouriteCuisines: ["Nigerian"],
    location: "Brooklyn, NY",
    ...input,
  });
}

export function tag(type: string, name: string): Tag {
  return { id: `${type}:${name.toLowerCase().replace(/\s+/g, "_")}`, name, type };
}

export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "cand-1",
    name: "Test Place",
    address: "1 Test St, New York, NY",
    neighborhood: null,
    geocode: null,
    lat: 40.7,
    lon: -73.9,
    phone: "+12125550100",
    website: "https://example.test",
    hours: { monday: [{ opens: "T12:00:00", closes: "T22:00:00", closed: false }] },
    priceLevel: 2,
    rating: 4.5,
    description: null,
    tags: [],
    cuisines: [],
    dishHighlights: [],
    specialtyDishes: [],
    menuUrl: null,
    imageUrl: null,
    googlePlaceId: null,
    mapsUrl: null,
    accessibilityTags: [],
    noiseTags: [],
    isClosed: false,
    qlooRank: 1,
    affinity: null,
    ...overrides,
  };
}
