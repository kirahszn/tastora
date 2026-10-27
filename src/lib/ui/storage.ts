// Browser storage for the profile, feedback and the last search. Everything is validated on read
// and every access is guarded: storage can be missing, full, blocked or hold corrupted JSON, and
// the app must still work (it just forgets).
import { z } from "zod";
import { SeniorProfileSchema, type SeniorProfile } from "@/lib/domain/profile";
import type { RankingFeedback } from "@/lib/ranking/rank";
import type { RecommendResponse } from "./types";

export const PROFILE_KEY = "tastora.profile.v1";
export const FEEDBACK_KEY = "tastora.feedback.v1";
export const LAST_SEARCH_KEY = "tastora.lastSearch.v1";

/** Minimal Storage surface, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStore(kind: "localStorage" | "sessionStorage"): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null; // access itself can throw when storage is blocked
  }
}

export const local = () => browserStore("localStorage");
export const session = () => browserStore("sessionStorage");

export function readJson<T>(store: KeyValueStore | null, key: string, schema: z.ZodType<T>): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (raw == null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeJson(store: KeyValueStore | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(store: KeyValueStore | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // nothing to do
  }
}

// --- Profile ---------------------------------------------------------------------------------

export const loadProfile = (store = local()): SeniorProfile | null => readJson(store, PROFILE_KEY, SeniorProfileSchema);
export const saveProfile = (profile: SeniorProfile, store = local()) => writeJson(store, PROFILE_KEY, profile);

// --- Feedback --------------------------------------------------------------------------------

export const VERDICTS = ["liked", "disliked", "notSuitable", "tried"] as const;
export type Verdict = (typeof VERDICTS)[number];

const FeedbackStoreSchema = z.object({
  entries: z.record(
    z.string().min(1).max(100),
    z.object({ verdict: z.enum(VERDICTS), name: z.string().max(200) }),
  ),
});
export type FeedbackStore = z.output<typeof FeedbackStoreSchema>;

/** Matches the server's limit (RankingFeedbackSchema: ≤ 50 ids per list). */
const MAX_PER_VERDICT = 50;

export const emptyFeedback = (): FeedbackStore => ({ entries: {} });
export const loadFeedback = (store = local()): FeedbackStore =>
  readJson(store, FEEDBACK_KEY, FeedbackStoreSchema) ?? emptyFeedback();
export const saveFeedback = (fb: FeedbackStore, store = local()) => writeJson(store, FEEDBACK_KEY, fb);

/** Set or clear (verdict null) one venue's verdict; returns a new object. */
export function setVerdict(fb: FeedbackStore, id: string, name: string, verdict: Verdict | null): FeedbackStore {
  const entries = { ...fb.entries };
  if (verdict) entries[id] = { verdict, name };
  else delete entries[id];
  return { entries };
}

/** The `feedback` body for /api/recommend; the newest entries win when a list is over the limit. */
export function toRankingFeedback(fb: FeedbackStore): RankingFeedback {
  const out: Record<Verdict, string[]> = { liked: [], disliked: [], notSuitable: [], tried: [] };
  for (const [id, e] of Object.entries(fb.entries)) out[e.verdict].push(id);
  const result: RankingFeedback = {};
  for (const v of VERDICTS) if (out[v].length) result[v] = out[v].slice(-MAX_PER_VERDICT);
  return result;
}

export const feedbackCount = (fb: FeedbackStore) => Object.keys(fb.entries).length;

// --- Last search (sessionStorage) ------------------------------------------------------------
// Lets the results page survive a reload or Back without paying for another live search.

const LastSearchSchema = z.object({
  profileKey: z.string(),
  response: z.looseObject({ results: z.array(z.unknown()), excluded: z.array(z.unknown()), trace: z.array(z.unknown()) }),
});

export const profileKey = (profile: SeniorProfile) => JSON.stringify(profile);

export function loadLastSearch(profile: SeniorProfile, store = session()): RecommendResponse | null {
  const last = readJson(store, LAST_SEARCH_KEY, LastSearchSchema);
  return last && last.profileKey === profileKey(profile) ? (last.response as unknown as RecommendResponse) : null;
}

export const saveLastSearch = (profile: SeniorProfile, response: RecommendResponse, store = session()) =>
  writeJson(store, LAST_SEARCH_KEY, { profileKey: profileKey(profile), response });

export const clearLastSearch = (store = session()) => remove(store, LAST_SEARCH_KEY);

/** "Clear profile": the profile, its feedback and the cached search. */
export function clearAll(): void {
  remove(local(), PROFILE_KEY);
  remove(local(), FEEDBACK_KEY);
  clearLastSearch();
}
