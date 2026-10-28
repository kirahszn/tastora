// NYC borough detection for the profile location and for venues. Pure and client-safe.
//
// Venue fields, by priority (field paths in docs/data-model.md):
// 1. `properties.geocode.admin2_region` (the county). Present on every place in the Phase 1 raw
//    responses (322/322 with geocode): "New York County", "Kings County", "Queens County",
//    "Bronx County", "Staten Island"; outside NYC e.g. "Nassau County", "Hudson County".
// 2. The ZIP code in `properties.address` ("… Brooklyn, NY 11238"). The trimmed test samples have
//    no geocode, and Queens addresses name the neighbourhood ("Flushing, NY"), not the borough.
// Anything else is "unknown": no points either way.

export const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"] as const;
export type Borough = (typeof BOROUGHS)[number];

const PROFILE_PATTERNS: [Borough, RegExp][] = [
  ["Manhattan", /\bmanhattan\b/i],
  ["Brooklyn", /\bbrooklyn\b/i],
  ["Queens", /\bqueens\b/i],
  ["Bronx", /\bbronx\b/i],
  ["Staten Island", /\bstaten[\s-]+island\b/i],
];

/** The borough named in a free-text location ("Bed-Stuy, Brooklyn"); the earliest wins. */
export function detectProfileBorough(location: string): Borough | null {
  let best: { borough: Borough; index: number } | null = null;
  for (const [borough, pattern] of PROFILE_PATTERNS) {
    const m = pattern.exec(location);
    if (m && (!best || m.index < best.index)) best = { borough, index: m.index };
  }
  return best?.borough ?? null;
}

const COUNTY_BOROUGH: Record<string, Borough> = {
  "new york county": "Manhattan",
  "kings county": "Brooklyn",
  "queens county": "Queens",
  "bronx county": "Bronx",
  "richmond county": "Staten Island",
  "staten island": "Staten Island",
};

/** First three ZIP digits → borough. 110 is split between Queens and Nassau, so it is handled apart. */
const ZIP3_BOROUGH: Record<string, Borough> = {
  "100": "Manhattan",
  "101": "Manhattan",
  "102": "Manhattan",
  "103": "Staten Island",
  "104": "Bronx",
  "111": "Queens",
  "112": "Brooklyn",
  "113": "Queens",
  "114": "Queens",
  "116": "Queens",
};
const QUEENS_110_ZIPS = new Set(["11004", "11005"]);

export interface VenueGeocode {
  city: string | null;
  /** County, e.g. "Kings County". */
  county: string | null;
  /** State or region, e.g. "New York", "New Jersey". */
  region: string | null;
  countryCode: string | null;
  /** Metro area, e.g. "Sydney", "Los Angeles"; used outside NYC (location.ts). */
  metro?: string | null;
}

export type VenueArea =
  | { kind: "borough"; borough: Borough; source: string }
  | { kind: "outside_nyc"; place: string | null; source: string }
  | { kind: "unknown" };

function fromGeocode(g: VenueGeocode): VenueArea | null {
  if (g.countryCode && g.countryCode.toUpperCase() !== "US") {
    return {
      kind: "outside_nyc",
      place: g.city ?? g.region,
      source: `qloo.properties.geocode.country_code: ${g.countryCode}`,
    };
  }
  if (!g.county) return null;
  const borough = COUNTY_BOROUGH[g.county.trim().toLowerCase()];
  const source = `qloo.properties.geocode.admin2_region: ${g.county}`;
  return borough ? { kind: "borough", borough, source } : { kind: "outside_nyc", place: g.county, source };
}

// "… Brooklyn, NY 11238". The town can't be split from the street reliably, so only state + ZIP.
const US_ADDRESS = /\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$/;

function fromAddress(address: string): VenueArea | null {
  const m = US_ADDRESS.exec(address.trim());
  if (!m) return null;
  const [, state, zip] = m;
  const source = `qloo.properties.address: ${state} ${zip}`;
  const outside: VenueArea = { kind: "outside_nyc", place: state, source };
  if (state !== "NY") return outside;
  if (QUEENS_110_ZIPS.has(zip)) return { kind: "borough", borough: "Queens", source };
  const prefix = zip.slice(0, 3);
  // 110xx is mostly Nassau but partly Queens: not "clearly" outside NYC.
  if (prefix === "110") return null;
  const borough = ZIP3_BOROUGH[prefix];
  return borough ? { kind: "borough", borough, source } : outside;
}

export function detectVenueArea(venue: { geocode: VenueGeocode | null; address: string | null }): VenueArea {
  const fromGeo = venue.geocode ? fromGeocode(venue.geocode) : null;
  const fromAddr = venue.address ? fromAddress(venue.address) : null;
  return fromGeo ?? fromAddr ?? { kind: "unknown" };
}

/** Short label for the card: "In Brooklyn", "Outside NYC (Nassau County)". */
export function areaLabel(area: VenueArea): string | null {
  switch (area.kind) {
    case "borough":
      return area.borough === "Bronx" ? "In the Bronx" : `In ${area.borough}`;
    case "outside_nyc":
      return area.place ? `Outside NYC (${area.place})` : "Outside NYC";
    case "unknown":
      return null;
  }
}
