// Non-restaurant filter for Qloo place results. A cuisine filter is not a "restaurants only"
// filter (docs/qloo-findings.md): hotels, malls, markets, music venues and bars come back because
// they carry restaurant tags. Rule derived from the 213 unique places in the Phase 1 E3/E5 raw
// fixtures (sample set: fixtures/qloo/samples/venue-filter.json):
//
// 1. `properties.primary_genre.id` outside the restaurant genre namespace
//    (`urn:tag:genre:place:restaurant[:*]`) → dropped. Covers hotel, shopping_mall, market,
//    live_music_venue, jazz_club, night_club, tourist_attraction, gourmet_grocery_store, … Every
//    such place in the samples also had a generic "Restaurant" category tag, so that tag can't
//    rescue it. Exception: a genre id that itself says "restaurant" (e.g.
//    `urn:tag:genre:place:southern_restaurant_(us)`, Jacob's Pickles) is kept.
// 2. Drink- or music-first restaurant genres (bar, cocktail_bar, wine_bar, lounge_bar,
//    live_music_bar, beer_garden) → kept only when the place is also tagged with a specific
//    cuisine-restaurant category (`urn:tag:category:place`, e.g. "Italian restaurant"), so
//    Pietro Nolita and Groove stay while Starr Bar and Union Hall go.
// 3. Multi-vendor genres inside the restaurant namespace (food_court) → dropped (Phase 5 matrix:
//    Smorgasburg Williamsburg ranked #1 for a Korean profile). There is no single kitchen to ask
//    about allergens, and the "dishes" belong to different stalls.
// 4. No primary genre → kept (nothing proves it isn't a restaurant; 0 of 213 lacked one).
import { z } from "zod";

const RESTAURANT_GENRE = "urn:tag:genre:place:restaurant";
const CATEGORY_TAG_TYPE = "urn:tag:category:place";
const DRINK_FIRST = new Set(
  ["bar", "cocktail_bar", "wine_bar", "lounge_bar", "live_music_bar", "beer_garden"].map(
    (g) => `${RESTAURANT_GENRE}:${g}`,
  ),
);
const MULTI_VENDOR = new Set([`${RESTAURANT_GENRE}:food_court`]);
/** Category names that end in "restaurant" but say nothing about cuisine. */
const GENERIC_CATEGORIES = new Set([
  "restaurant",
  "brunch restaurant",
  "lunch restaurant",
  "breakfast restaurant",
  "dinner restaurant",
]);

const VenueSchema = z.object({
  properties: z
    .object({
      primary_genre: z
        .union([z.object({ id: z.string() }).transform((g) => g.id), z.string()])
        .nullish()
        .catch(null),
    })
    .nullish()
    .catch(null),
  tags: z
    .array(z.unknown())
    .nullish()
    .catch(null)
    .transform((tags) =>
      (tags ?? []).flatMap((t) => {
        const parsed = z.object({ name: z.string(), type: z.string().nullish() }).safeParse(t);
        return parsed.success && parsed.data.type === CATEGORY_TAG_TYPE ? [parsed.data.name] : [];
      }),
    ),
});

export type VenueVerdict = { keep: true } | { keep: false; reason: string };

const slug = (genre: string) => genre.split(":").pop() ?? genre;

/** Decide whether a raw Qloo place entity is a food venue worth suggesting. */
export function venueVerdict(raw: unknown): VenueVerdict {
  const parsed = VenueSchema.safeParse(raw);
  if (!parsed.success) return { keep: true };
  const genre = parsed.data.properties?.primary_genre ?? null;
  if (!genre) return { keep: true };

  const inRestaurantNamespace = genre === RESTAURANT_GENRE || genre.startsWith(`${RESTAURANT_GENRE}:`);
  if (!inRestaurantNamespace && !/restaurant/i.test(slug(genre))) {
    return { keep: false, reason: `primary genre is ${slug(genre).replace(/_/g, " ")}` };
  }
  if (MULTI_VENDOR.has(genre)) {
    return { keep: false, reason: `primary genre is ${slug(genre).replace(/_/g, " ")} (several vendors, no single kitchen)` };
  }
  if (DRINK_FIRST.has(genre)) {
    const cuisineCategory = parsed.data.tags.some(
      (name) => /\brestaurant$/i.test(name) && !GENERIC_CATEGORIES.has(name.trim().toLowerCase()),
    );
    if (!cuisineCategory) {
      return { keep: false, reason: `${slug(genre).replace(/_/g, " ")} without a cuisine-restaurant category` };
    }
  }
  return { keep: true };
}
