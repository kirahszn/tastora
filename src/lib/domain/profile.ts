// The person a caregiver is finding a restaurant for. Only short labels and food/taste facts;
// no full names, dates of birth or contact details are collected.
import { z } from "zod";

/** A trimmed, non-empty string of at most `max` characters. */
const entry = (max: number) => z.string().trim().min(1, "must not be empty").max(max);

const list = (itemMax: number, min: number, max: number) => z.array(entry(itemMax)).min(min).max(max);

export const TEXTURE_NEEDS = ["none", "soft", "easy_to_chew"] as const;

export const SeniorProfileSchema = z.object({
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
  /** Free-text NYC area, e.g. "Bed-Stuy, Brooklyn". */
  location: entry(80),
});

/** Caregiver input before defaults are applied. */
export type SeniorProfileInput = z.input<typeof SeniorProfileSchema>;
export type SeniorProfile = z.output<typeof SeniorProfileSchema>;
export type TextureNeed = (typeof TEXTURE_NEEDS)[number];
