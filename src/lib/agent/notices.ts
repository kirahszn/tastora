// Plain-language notes for the results page about how the search went (Phase 5): taste memories
// that couldn't be used, cuisine and location fallbacks, and the built-in planner standing in for
// Claude. Built only from what actually happened in the run.
import type { SeniorProfile } from "@/lib/domain/profile";
import type { TasteSignal } from "./session";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/**
 * Whether a caregiver's entry and a Qloo entity name refer to the same thing, allowing small
 * typos ("Fela Kutti" ↔ "Fela Kuti"), accents and extra words ("Frank Sinatra" ↔ "Sinatra").
 */
export function sameName(entry: string, entityName: string): boolean {
  const a = fold(entry);
  const b = fold(entityName);
  if (!a || !b) return false;
  const words = (s: string) => ` ${s} `;
  if (a === b || words(a).includes(words(b)) || words(b).includes(words(a))) return true;
  return editDistance(a, b) <= Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.2));
}

/** Profile taste memories that no taste signal actually sent to Qloo corresponds to. */
export function unusedTasteMemories(profile: SeniorProfile, signals: readonly TasteSignal[]): string[] {
  const entries = [...profile.tasteMemories.music, ...profile.tasteMemories.films, ...profile.tasteMemories.places];
  return entries.filter((e) => !signals.some((s) => sameName(e, s.name)));
}

const quoteList = (items: string[]) => items.map((i) => `“${i}”`).join(", ");

export function tasteMemoryNotice(unused: string[]): string | null {
  if (!unused.length) return null;
  return unused.length === 1
    ? `Tastora couldn't find a clear match for ${quoteList(unused)} on Qloo, so it didn't shape these results.`
    : `Tastora couldn't find clear matches for ${quoteList(unused)} on Qloo, so they didn't shape these results.`;
}

/** Place memories match only areas (Phase 11), so an unused one gets its own wording. */
export function placeMemoryNotice(unused: string[]): string | null {
  if (!unused.length) return null;
  return unused.length === 1
    ? `Tastora couldn't match ${quoteList(unused)} to an area on Qloo, so it wasn't used.`
    : `Tastora couldn't match ${quoteList(unused)} to areas on Qloo, so they weren't used.`;
}

/** Notices for every taste memory no signal sent to Qloo corresponds to; place memories get the area wording. */
export function tasteMemoryNotices(profile: SeniorProfile, signals: readonly TasteSignal[]): string[] {
  const unused = unusedTasteMemories(profile, signals);
  const places = unused.filter((e) => profile.tasteMemories.places.includes(e));
  return [tasteMemoryNotice(unused.filter((e) => !places.includes(e))), placeMemoryNotice(places)].filter(
    (n): n is string => !!n,
  );
}

export const relatedCuisineNotice = (cuisine: string, family: string, location: string) =>
  `No ${cuisine} restaurants were found near ${location}, so Tastora is showing ${family} restaurants instead.`;

export const PLANNER_FALLBACK_NOTICE =
  "The AI planner (Claude) wasn't available, so Tastora planned this search with its built-in rules. Results are checked the same way.";

/** Search-layer notes worth telling the caregiver about (the city-wide location retry). */
export function locationNotices(notes: readonly string[]): string[] {
  return notes.flatMap((n) => {
    const empty = /^No places found for "(.+)"; searched (.+) instead$/.exec(n);
    if (empty) return [`No places were found for “${empty[1]}”, so Tastora searched all of ${empty[2]}.`];
    const unknown = /^Qloo could not find "(.+)"; searched (.+) instead$/.exec(n);
    if (unknown) return [`Qloo couldn't find “${unknown[1]}”, so Tastora searched all of ${unknown[2]}.`];
    return [];
  });
}
