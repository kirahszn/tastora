// The person a caregiver is finding a restaurant for. Only short labels and food/taste facts;
// no full names, dates of birth or contact details are collected.
import { z } from "zod";
import { AREA_MAX, CITY_MAX, migrateLegacyLocation } from "./location";

/** A trimmed, non-empty string of at most `max` characters. */
const entry = (max: number) => z.string().trim().min(1, "must not be empty").max(max);

const list = (itemMax: number, min: number, max: number) => z.array(entry(itemMax)).min(min).max(max);

export const TEXTURE_NEEDS = ["none", "soft", "easy_to_chew"] as const;

const ProfileObjectSchema = z.object({
  /** Optional short label such as "Mum"; not a full name. */
  displayName: entry(40).optional(),
  favouriteCuisines: list(60, 1, 5),
  favouriteDishes: list(80, 0, 10).default([]),
  /** Cross-domain "taste memory" signals sent to Qloo as entity searches. */
  tasteMemories: z
    .object({
      music: list(80, 0, 5).default([]),
      films: list(80, 0, 5).default([]),
      places: list(80, 0, 5).default([]),
    })
    .default({ music: [], films: [], places: [] }),
  dislikes: list(60, 0, 15).default([]),
  allergies: list(60, 0, 10).default([]),
  /** e.g. "vegetarian", "halal", "kosher", "no pork". */
  dietaryRestrictions: list(60, 0, 10).default([]),
  texture: z.enum(TEXTURE_NEEDS).default("none"),
  /** Optional comfort needs; only evaluated when set to true. */
  comfort: z
    .object({
      quietPreferred: z.boolean().default(false),
      wheelchairAccess: z.boolean().default(false),
    })
    .default({ quietPreferred: false, wheelchairAccess: false }),
  /** Free-text city, e.g. "New York City", "London". */
  city: entry(CITY_MAX),
  /** Optional neighbourhood or area, e.g. "Bed-Stuy, Brooklyn", "Shoreditch". */
  area: entry(AREA_MAX).optional(),
});

type ProfileObjectInput = z.input<typeof ProfileObjectSchema>;

/** Caregiver input before defaults are applied. Pre-Phase 9c input with `location` is still accepted. */
export type SeniorProfileInput =
  | ProfileObjectInput
  | (Omit<ProfileObjectInput, "city" | "area"> & { location: string; city?: never; area?: never });

/** Profiles saved before Phase 9c (`location` only) are migrated on parse; see location.ts. */
export const SeniorProfileSchema = z.preprocess(
  (raw: SeniorProfileInput) => migrateLegacyLocation(raw),
  ProfileObjectSchema,
);
export type SeniorProfile = z.output<typeof SeniorProfileSchema>;
export type TextureNeed = (typeof TEXTURE_NEEDS)[number];
