// Qloo place entity schema (built only from fields observed in fixtures/qloo/samples) and its
// normalisation into a flat `Candidate`. Field mapping is documented in docs/data-model.md.
//
// Two shapes exist: /v2/insights entities have `subtype: "urn:entity:place"`, `query.affinity` and
// top-level `external`; /search results have `types: ["urn:entity:place"]` and `properties.external`.
// Parsing is tolerant: unknown fields are stripped and a malformed optional field becomes null
// instead of rejecting the whole place.
import { z } from "zod";
import type { VenueGeocode } from "./borough";

export const PLACE_ENTITY_TYPE = "urn:entity:place";

/** Qloo tag types Tastora reads. Everything else on a place is ignored. */
export const TAG_TYPES = {
  menuHighlight: "urn:tag:menu_highlight:qloo",
  specialtyDish: "urn:tag:specialty_dish:place",
  dietaryOption: "urn:tag:dietary_option:qloo",
  offerings: "urn:tag:offerings:place",
  accessibility: "urn:tag:accessibility:place",
  noiseLevel: "urn:tag:noise_level:qloo",
  ambience: "urn:tag:ambience:qloo",
  cuisine: "urn:tag:cuisine:qloo",
} as const;

export const USED_TAG_TYPES: readonly string[] = Object.values(TAG_TYPES);

/** Optional field that becomes null when missing or malformed. */
const opt = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null);

// Insights tags carry `id`; search tags carry `tag_id` instead.
const TagSchema = z
  .object({
    id: z.string().optional(),
    tag_id: z.string().optional(),
    name: z.string(),
    type: z.string().nullish(),
  })
  .refine((t) => t.id ?? t.tag_id, "tag has no id")
  .transform((t) => ({ id: (t.id ?? t.tag_id)!, name: t.name, type: t.type ?? null }));

const GooglePlaceSchema = z.object({ place_id: z.string().nullish() });

const HoursSlotSchema = z.object({
  opens: z.string().nullish(),
  closes: z.string().nullish(),
  closed: z.boolean().nullish(),
});

// Insights: `google_place` is an array; search: a single object.
const ExternalSchema = z.object({
  google_place: opt(
    z.union([z.array(GooglePlaceSchema), GooglePlaceSchema.transform((g) => [g])]),
  ),
});

const PropertiesSchema = z.object({
  address: opt(z.string()),
  neighborhood: opt(z.string()),
  phone: opt(z.string()),
  website: opt(z.string()),
  menu_url: opt(z.string()),
  hours: opt(z.record(z.string(), z.array(HoursSlotSchema))),
  is_closed: opt(z.boolean()),
  price_level: opt(z.number()),
  business_rating: opt(z.number()),
  description: opt(z.string()),
  short_description: opt(z.string()),
  specialty_dishes: opt(z.array(z.object({ id: z.string().nullish(), name: z.string() }))),
  external: opt(ExternalSchema),
  // Qloo's own picture of the place (Phase 12); shown on the card only, never ranked on.
  image: opt(z.object({ url: opt(z.string()) })),
  geocode: opt(
    z.object({
      city: opt(z.string()),
      metro: opt(z.string()),
      admin2_region: opt(z.string()),
      admin1_region: opt(z.string()),
      country_code: opt(z.string()),
    }),
  ),
});

export const QlooPlaceSchema = z.object({
  entity_id: z.string().min(1),
  name: z.string().min(1),
  subtype: opt(z.string()),
  types: opt(z.array(z.string())),
  location: opt(z.object({ lat: z.number(), lon: z.number() })),
  disambiguation: opt(z.string()),
  // Drop individual malformed tags rather than the whole list.
  tags: z
    .array(z.unknown())
    .nullish()
    .catch(null)
    .transform((tags) =>
      (tags ?? []).flatMap((t) => {
        const parsed = TagSchema.safeParse(t);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  query: opt(z.object({ affinity: opt(z.number()) })),
  external: opt(ExternalSchema),
  properties: PropertiesSchema.nullish()
    .catch(null)
    .transform((p) => p ?? PropertiesSchema.parse({})),
});

export type QlooPlace = z.output<typeof QlooPlaceSchema>;

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface HoursSlot {
  /** Qloo time strings such as "T12:00:00". */
  opens: string | null;
  closes: string | null;
  closed: boolean;
}

export interface Tag {
  id: string;
  name: string;
  type: string | null;
}

export interface Candidate {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  /** `properties.geocode`; used for the borough (borough.ts) or the city elsewhere (location.ts). */
  geocode: VenueGeocode | null;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  website: string | null;
  hours: Partial<Record<Weekday, HoursSlot[]>> | null;
  /** 1 (cheap) to 4 (expensive). */
  priceLevel: number | null;
  /** Google-style business rating, 1 decimal. */
  rating: number | null;
  description: string | null;
  tags: Tag[];
  cuisines: string[];
  /** From menu_highlight tags. Names only; not a confirmed menu. */
  dishHighlights: string[];
  /** From specialty_dishes + specialty_dish tags. Names can be garbled. */
  specialtyDishes: string[];
  menuUrl: string | null;
  /** `properties.image.url`: Qloo's image of the place, for display only. */
  imageUrl: string | null;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  accessibilityTags: string[];
  noiseTags: string[];
  isClosed: boolean;
  /** 1-based position among places in the Qloo response. */
  qlooRank: number;
  /** `query.affinity` (insights with signals only). */
  affinity: number | null;
}

const WEEKDAYS: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** Leading words that mark a garbled dish fragment, e.g. "And pickles", "With pastrami". */
const DISH_FRAGMENT = /^(and|with|or|of)\s/i;

export function isPlaceEntity(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const e = raw as { subtype?: unknown; types?: unknown };
  return (
    e.subtype === PLACE_ENTITY_TYPE ||
    (Array.isArray(e.types) && e.types.includes(PLACE_ENTITY_TYPE))
  );
}

/**
 * Google Maps link from a Place ID, using the documented Maps URLs search action:
 *   https://www.google.com/maps/search/?api=1&query=<text>&query_place_id=<place id>
 * `query` is required; when `query_place_id` is present Maps opens that exact place.
 * Source: https://developers.google.com/maps/documentation/urls/get-started#search-action
 */
export function buildMapsUrl(placeId: string, query: string): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  url.searchParams.set("query_place_id", placeId);
  return url.toString();
}

function nonEmpty(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function uniqueNames(names: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function tagNames(tags: Tag[], type: string): string[] {
  return uniqueNames(tags.filter((t) => t.type === type).map((t) => t.name));
}

function normalizeHours(hours: QlooPlace["properties"]["hours"]): Candidate["hours"] {
  if (!hours) return null;
  const out: Partial<Record<Weekday, HoursSlot[]>> = {};
  for (const day of WEEKDAYS) {
    const slots = hours[day];
    if (!slots) continue;
    out[day] = slots.map((s) => ({
      opens: s.opens ?? null,
      closes: s.closes ?? null,
      closed: s.closed ?? false,
    }));
  }
  return Object.keys(out).length ? out : null;
}

/** Flatten a parsed Qloo place into a `Candidate`. */
export function normalizePlace(place: QlooPlace, qlooRank: number): Candidate {
  const p = place.properties;
  const tags: Tag[] = place.tags;
  const googlePlaces = place.external?.google_place ?? p.external?.google_place ?? [];
  const googlePlaceId = googlePlaces.map((g) => nonEmpty(g.place_id)).find(Boolean) ?? null;
  const address = nonEmpty(p.address) ?? nonEmpty(place.disambiguation);
  const rating = p.business_rating == null ? null : Math.round(p.business_rating * 10) / 10;

  return {
    id: place.entity_id,
    name: place.name.trim(),
    address,
    neighborhood: nonEmpty(p.neighborhood),
    geocode: p.geocode
      ? {
          city: nonEmpty(p.geocode.city),
          county: nonEmpty(p.geocode.admin2_region),
          region: nonEmpty(p.geocode.admin1_region),
          countryCode: nonEmpty(p.geocode.country_code),
          metro: nonEmpty(p.geocode.metro),
        }
      : null,
    lat: place.location?.lat ?? null,
    lon: place.location?.lon ?? null,
    phone: nonEmpty(p.phone),
    website: nonEmpty(p.website),
    hours: normalizeHours(p.hours),
    priceLevel: p.price_level ?? null,
    rating,
    description: nonEmpty(p.description) ?? nonEmpty(p.short_description),
    tags,
    cuisines: tagNames(tags, TAG_TYPES.cuisine),
    dishHighlights: tagNames(tags, TAG_TYPES.menuHighlight),
    specialtyDishes: uniqueNames([
      ...(p.specialty_dishes ?? []).map((d) => d.name),
      ...tags.filter((t) => t.type === TAG_TYPES.specialtyDish).map((t) => t.name),
    ]).filter((name) => !DISH_FRAGMENT.test(name)),
    menuUrl: nonEmpty(p.menu_url),
    imageUrl: nonEmpty(p.image?.url),
    googlePlaceId,
    mapsUrl: googlePlaceId
      ? buildMapsUrl(googlePlaceId, [place.name.trim(), address].filter(Boolean).join(", "))
      : null,
    accessibilityTags: tagNames(tags, TAG_TYPES.accessibility),
    noiseTags: tagNames(tags, TAG_TYPES.noiseLevel),
    isClosed: p.is_closed === true,
    qlooRank,
    affinity: place.query?.affinity ?? null,
  };
}

/**
 * Parse and normalise the place entities of a Qloo response (`results.entities` for insights,
 * `results` for search). Non-place and invalid entities are skipped; `qlooRank` is the 1-based
 * position among the remaining places, in Qloo's order.
 */
export function normalizePlaces(entities: readonly unknown[]): Candidate[] {
  const out: Candidate[] = [];
  for (const raw of entities) {
    if (!isPlaceEntity(raw)) continue;
    const parsed = QlooPlaceSchema.safeParse(raw);
    if (parsed.success) out.push(normalizePlace(parsed.data, out.length + 1));
  }
  return out;
}
