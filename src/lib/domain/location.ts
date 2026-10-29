// Where the person wants to eat: a city (required) and an optional neighbourhood or area. Pure;
// usable in the browser too. New York City keeps its borough logic (borough.ts); every other city uses the
// same-city rule below, built only from fields the Phase 9c coverage check found on every place
// (docs/qloo-findings.md, "Coverage beyond NYC"; samples in fixtures/qloo/samples/city-*.json).
import { detectProfileBorough, type VenueGeocode } from "./borough";

export const CITY_MAX = 60;
export const AREA_MAX = 60;
export const NYC_CITY = "New York City";

/** Lower case, no accents or punctuation, single spaces. */
export const foldPlace = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** "London, UK" → "london": the part before the first comma, folded. */
const cityKey = (city: string) => foldPlace(city.split(",")[0] ?? "");

const NYC_NAMES = new Set(["new york city", "new york", "nyc", "new york ny"]);

/** "New York City", "NYC", "New York, NY", or a borough typed as the city ("Brooklyn"). */
export function isNewYorkCity(city: string): boolean {
  return NYC_NAMES.has(cityKey(city)) || NYC_NAMES.has(foldPlace(city)) || detectProfileBorough(city) !== null;
}

export interface ProfileLocation {
  city: string;
  area?: string;
}

/**
 * The text sent as Qloo `filter.location.query`. In NYC an area that names a borough is sent on
 * its own ("Bed-Stuy, Brooklyn"), exactly as before Phase 9c; any other area is joined to the city
 * ("Shoreditch, London"). Live: "Queens, New York City" resolved inside Queens (11 of 20 places
 * in Queens County, the same as "Queens" alone in Phase 3).
 */
export function searchLocation({ city, area }: ProfileLocation): string {
  if (!area) return city;
  if (isNewYorkCity(city) && detectProfileBorough(area)) return area;
  return `${area}, ${city}`;
}

/** Where to retry when the area finds nothing: the whole city. */
export function cityWide({ city }: ProfileLocation): string {
  return isNewYorkCity(city) ? NYC_CITY : city;
}

/** Short text for headings and notices: "Bed-Stuy, Brooklyn", "Shoreditch, London". */
export const describeLocation = (p: ProfileLocation) => searchLocation(p);

// --- Coverage ----------------------------------------------------------------------------------

export type CoverageRating = "Good" | "Thin" | "Poor";

/**
 * Verdicts from the Phase 9c live check (3 searches per city, take=20). Cities not listed have
 * not been checked: no verdict, only the result-count rule applies.
 */
export const CITY_COVERAGE: Record<string, CoverageRating> = {
  "new york city": "Good",
  london: "Good",
  toronto: "Good",
  "los angeles": "Good",
  chicago: "Good",
  sydney: "Good",
  lagos: "Thin",
};

export function cityCoverage(city: string): CoverageRating | null {
  if (isNewYorkCity(city)) return "Good";
  return CITY_COVERAGE[cityKey(city)] ?? null;
}

/** Quick-pick chips on the profile form: New York City and the cities rated Good. */
export const QUICK_CITIES = ["New York City", "London", "Toronto", "Los Angeles", "Chicago", "Sydney"] as const;

/** Below this many unique places from Qloo, the results page says coverage may be thin. */
export const FEW_RESULTS_THRESHOLD = 4;

export const coverageNotice = (city: string) =>
  `Fewer matches found around ${city}. Qloo's restaurant coverage varies by city.`;

/** The calm coverage note, or null: fewer than 4 places found, or a city rated Thin/Poor. */
export function coverageNote(city: string, placesFound: number): string | null {
  const rating = cityCoverage(city);
  return placesFound < FEW_RESULTS_THRESHOLD || rating === "Thin" || rating === "Poor" ? coverageNotice(city) : null;
}

// --- Saved-profile migration ---------------------------------------------------------------------

/**
 * Profiles saved before Phase 9c have one free-text `location` from the NYC borough form
 * ("Queens", "Bed-Stuy, Brooklyn"). A location naming a borough becomes city "New York City"
 * with the old text as the area; anything else (only possible through the API) becomes the city.
 * Input that already has a city, or is not an object, is returned unchanged.
 */
export function migrateLegacyLocation(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const { location, ...rest } = raw as Record<string, unknown>;
  if ("city" in rest || typeof location !== "string") return raw;
  const text = location.trim();
  if (!text) return { ...rest, city: text };
  return detectProfileBorough(text) ? { ...rest, city: NYC_CITY, area: text } : { ...rest, city: text };
}

// --- Venue location outside NYC ----------------------------------------------------------------

/**
 * Same-city rule for every city except New York (Phase 9c):
 * - `geocode.city` equals the city asked for → "In <city>" (same-city bonus).
 * - otherwise `geocode.metro` equals it → "In the <city> area" (same bonus). Needed for Sydney,
 *   where `geocode.city` is often a council ("Council of the City of Sydney") but `metro` is
 *   "Sydney", and for LA suburbs (Santa Monica, metro "Los Angeles").
 * - otherwise a known `geocode.city` → "Nearby: <that city>" (no bonus, no penalty).
 * - no geocode city → nothing: no label, no points.
 * The city asked for is matched as typed (before any comma) or as Qloo resolved it.
 */
export type CityArea =
  | { kind: "same_city"; city: string; source: string }
  | { kind: "same_metro"; metro: string; source: string }
  | { kind: "nearby"; place: string; source: string };

export function detectCityArea(geocode: VenueGeocode | null, cityNames: readonly string[]): CityArea | null {
  const city = geocode?.city?.trim();
  if (!city) return null;
  const wanted = new Set(cityNames.map(cityKey).filter(Boolean));
  if (wanted.has(foldPlace(city))) {
    return { kind: "same_city", city, source: `qloo.properties.geocode.city: ${city}` };
  }
  const metro = geocode?.metro?.trim();
  if (metro && wanted.has(foldPlace(metro))) {
    return { kind: "same_metro", metro, source: `qloo.properties.geocode.metro: ${metro}` };
  }
  return { kind: "nearby", place: city, source: `qloo.properties.geocode.city: ${city}` };
}

export function cityAreaLabel(area: CityArea): string {
  switch (area.kind) {
    case "same_city":
      return `In ${area.city}`;
    case "same_metro":
      return `In the ${area.metro} area`;
    case "nearby":
      return `Nearby: ${area.place}`;
  }
}

// --- Far-away venues (hotfix, 2026-10-29) --------------------------------------------------------
//
// Qloo's `filter.location.query` is a bias, not a boundary, and can resolve to the wrong place:
// "Benin city" resolved to the locality "Mexico City, Cuauhtémoc, Mexico City, Mexico" and every
// Caribbean result was in Mexico City. Fields used: the locality Qloo echoes
// (`query.localities.filter[0].disambiguation` and `.location`) and each venue's `location.lat/lon`
// and `properties.geocode` (city, metro, admin1_region). Far venues are excluded, never ranked.

/** Within this distance of the requested locality's centre a venue counts as nearby. */
export const NEARBY_KM = 50;

export interface ResolvedLocality {
  /** "Lagos, Nigeria". */
  disambiguation: string;
  center: { lat: number; lon: number } | null;
}

const localityParts = (l: ResolvedLocality) => l.disambiguation.split(",").map(foldPlace).filter(Boolean);

// Words too common to show two place names are the same ("Benin City" / "Mexico City").
const GENERIC_WORDS = new Set(["city", "town", "north", "south", "east", "west", "port", "fort", "saint", "santa", "lake", "great", "upper", "lower"]);
const words = (s: string) => s.split(" ").filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
const initials = (s: string) => s.split(" ").map((w) => w[0]).join("");

/**
 * Whether the locality Qloo resolved to is the place the person typed: a part of its
 * disambiguation equals the city or area, is New York City for an NYC profile, has the typed
 * short form as initials ("LA" → "Los Angeles"), or shares a 4-letter word start ("Philly" →
 * "Philadelphia"). "Benin city" → "Mexico City, …" is not.
 */
export function localityMatchesRequest(locality: ResolvedLocality, { city, area }: ProfileLocation): boolean {
  const parts = localityParts(locality);
  if (isNewYorkCity(city) && parts.some(isNewYorkCity)) return true;
  const typed = [cityKey(city), ...(area ? [cityKey(area)] : [])].filter(Boolean);
  return typed.some(
    (t) =>
      parts.includes(t) ||
      (t.length <= 4 && !t.includes(" ") && parts.some((p) => initials(p) === t)) ||
      words(t).some((w) => parts.some((p) => words(p).some((pw) => pw.slice(0, 4) === w.slice(0, 4)))),
  );
}

export interface SearchArea {
  /** Resolved localities that name the place asked for. */
  localities: ResolvedLocality[];
  /** Qloo echoed a locality, but none of them is the place asked for. */
  mismatched: boolean;
}

export function buildSearchArea(resolved: readonly ResolvedLocality[], profile: ProfileLocation): SearchArea {
  const localities = resolved.filter((l) => localityMatchesRequest(l, profile));
  return { localities, mismatched: resolved.length > 0 && localities.length === 0 };
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface FarVenue {
  /** Where the venue is, for the reason text: its geocode city, metro or region. */
  place: string | null;
  source: string;
}

export const FAR_REASON = "qloo.location: Outside the area you chose";

export const farVenueReason = (far: FarVenue) => `${FAR_REASON}${far.place ? ` (${far.place})` : ""}`;

/**
 * Whether a venue is far from the area asked for. `inArea` is the existing same-borough /
 * same-city / same-metro result. Kept (null): in the area, within NEARBY_KM of a matching
 * locality, or in a region that locality names (its `admin1_region` is a part of the
 * disambiguation). Far: none of those, with coordinates on both sides; or, when Qloo resolved the
 * search to another place altogether, any venue with a geocode that is not in the city asked for.
 * Anything without the fields to tell stays as before (kept).
 */
export function detectFarVenue(
  venue: { geocode: VenueGeocode | null; lat: number | null; lon: number | null },
  area: SearchArea,
  inArea: boolean,
): FarVenue | null {
  if (inArea) return null;
  const g = venue.geocode;
  const place = g?.city ?? g?.metro ?? g?.region ?? null;
  if (area.mismatched) {
    return place ? { place, source: `qloo.properties.geocode.city: ${place}` } : null;
  }
  const at = venue.lat != null && venue.lon != null ? { lat: venue.lat, lon: venue.lon } : null;
  const region = g?.region ? foldPlace(g.region) : null;
  if (region && area.localities.some((l) => localityParts(l).includes(region))) return null;
  const distances = at ? area.localities.flatMap((l) => (l.center ? [distanceKm(at, l.center)] : [])) : [];
  if (!distances.length) return null;
  const km = Math.min(...distances);
  return km <= NEARBY_KM ? null : { place, source: `qloo.location: ${Math.round(km)} km away` };
}
