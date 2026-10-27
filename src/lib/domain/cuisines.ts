// Small, hand-checked map of related cuisines. Used only to add a lower-weight explanation
// reason (e.g. "West African — related to Nigerian") when a venue doesn't carry the exact
// cuisine tag; it never filters or scores. Only obvious country → regional-family links are
// listed; members are not treated as related to each other (Nigerian ≠ Senegalese).
import { containsKeyword, normalizeTerm } from "@/lib/constraints/keywords";

export interface CuisineFamily {
  family: string;
  members: readonly string[];
}

export const CUISINE_FAMILIES: readonly CuisineFamily[] = [
  { family: "West African", members: ["Nigerian", "Ghanaian", "Senegalese"] },
  { family: "Caribbean", members: ["Jamaican", "Trinidadian", "Haitian"] },
  { family: "Italian", members: ["Italian-American"] },
];

const same = (a: string, b: string) =>
  normalizeTerm(a).replace(/-/g, " ") === normalizeTerm(b).replace(/-/g, " ");

/** Cuisines related to `cuisine`: its family if it is a member, or the members if it is a family. */
export function relatedCuisines(cuisine: string): string[] {
  const out: string[] = [];
  for (const f of CUISINE_FAMILIES) {
    if (f.members.some((m) => same(m, cuisine))) out.push(f.family);
    else if (same(f.family, cuisine)) out.push(...f.members);
  }
  return out;
}

/** The broader family of a member cuisine ("Haitian" → "Caribbean"), or null. */
export function cuisineFamilyOf(cuisine: string): string | null {
  return CUISINE_FAMILIES.find((f) => f.members.some((m) => same(m, cuisine)))?.family ?? null;
}

/**
 * The related cuisine (as spelled in the map) that a venue tag names, or null. Qloo tag names
 * vary in case ("West african"), so the map's spelling is used for display.
 */
export function relatedCuisineMatch(tagName: string, cuisine: string): string | null {
  return relatedCuisines(cuisine).find((r) => same(tagName, r) || containsKeyword(tagName, r)) ?? null;
}

export function isRelatedCuisine(tagName: string, cuisine: string): boolean {
  return relatedCuisineMatch(tagName, cuisine) !== null;
}
