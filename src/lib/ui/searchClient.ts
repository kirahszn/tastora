// Runs a search against /api/recommend: NDJSON streaming first, so progress shows the real trace
// steps; if the stream breaks before a result arrives, one plain JSON request instead.
import type { SeniorProfile } from "@/lib/domain/profile";
import type { RankingFeedback } from "@/lib/ranking/rank";
import { NdjsonError, readNdjson } from "./ndjson";
import type { RecommendResponse, TraceStep } from "./types";

export type SearchErrorKind = "invalid" | "rate_limited" | "upstream" | "offline" | "unknown";

export class SearchError extends Error {
  constructor(
    readonly kind: SearchErrorKind,
    readonly status: number | null,
    readonly fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(kind);
    this.name = "SearchError";
  }
}

export function errorKindForStatus(status: number): SearchErrorKind {
  if (status === 400) return "invalid";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream";
  return "unknown";
}

export const ERROR_COPY: Record<SearchErrorKind, { title: string; body: string }> = {
  invalid: {
    title: "Something in the profile needs a look",
    body: "Tastora couldn't read part of the profile. Please check it and try again.",
  },
  rate_limited: {
    title: "Lots of searches at once",
    body: "Please wait a minute, then try again. This keeps the service fair for everyone.",
  },
  upstream: {
    title: "We couldn't reach our restaurant data",
    body: "This is usually brief. Please try again in a minute.",
  },
  offline: {
    title: "You seem to be offline",
    body: "Check your internet connection, then try again.",
  },
  unknown: {
    title: "Something went wrong",
    body: "Please try again. If it keeps happening, try again a little later.",
  },
};

type StreamEvent =
  | { type: "step"; step: TraceStep }
  | { type: "result"; result: RecommendResponse }
  | { type: "error"; status: number; error: string };

function isStreamEvent(e: unknown): e is StreamEvent {
  return !!e && typeof e === "object" && typeof (e as { type?: unknown }).type === "string";
}

async function httpError(res: Response): Promise<SearchError> {
  let fieldErrors: { path: string; message: string }[] = [];
  try {
    const body = await res.json();
    if (Array.isArray(body?.fieldErrors)) fieldErrors = body.fieldErrors;
  } catch {
    // body is optional
  }
  return new SearchError(errorKindForStatus(res.status), res.status, fieldErrors);
}

/** The request body. The display name never leaves the device: the server has no use for it. */
export function requestBody(profile: SeniorProfile, feedback?: RankingFeedback) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { displayName, ...rest } = profile;
  return { profile: rest, ...(feedback && Object.keys(feedback).length ? { feedback } : {}) };
}

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export interface SearchOptions {
  signal?: AbortSignal;
  onStep?: (step: TraceStep) => void;
  /** Streaming failed; a plain request is running instead (no step-by-step progress). */
  onFallback?: () => void;
  fetchImpl?: typeof fetch;
}

/** Thrown errors are SearchError, or the AbortError from `signal`. */
export async function runSearch(
  body: ReturnType<typeof requestBody>,
  { signal, onStep, onFallback, fetchImpl = fetch }: SearchOptions = {},
): Promise<RecommendResponse> {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  };

  const out: { result?: RecommendResponse; failure?: SearchError; steps: number } = { steps: 0 };
  try {
    const res = await fetchImpl("/api/recommend?stream=1", init);
    if (!res.ok) throw await httpError(res);
    if (!res.body || !res.headers.get("content-type")?.includes("ndjson")) throw new NdjsonError("Not a stream");
    await readNdjson(res.body, (e) => {
      if (!isStreamEvent(e)) return;
      if (e.type === "step") {
        out.steps += 1;
        onStep?.(e.step);
      } else if (e.type === "result") out.result = e.result;
      else if (e.type === "error") out.failure = new SearchError(errorKindForStatus(e.status), e.status);
    });
    if (out.failure) throw out.failure;
    if (out.result) return out.result;
    throw new NdjsonError("Stream ended without a result");
  } catch (err) {
    if (signal?.aborted || err instanceof SearchError) throw err;
    if (isOffline()) throw new SearchError("offline", null);
    // The server was already working (steps arrived) when the stream broke, e.g. cut off at the
    // host's time limit. Re-running would double the cost and likely fail the same way.
    if (out.steps > 0) throw new SearchError("upstream", null);
    // The stream never got going (proxy buffering, parse error): try plain JSON once.
  }

  onFallback?.();
  try {
    const res = await fetchImpl("/api/recommend", init);
    if (!res.ok) throw await httpError(res);
    return (await res.json()) as RecommendResponse;
  } catch (err) {
    if (signal?.aborted || err instanceof SearchError) throw err;
    throw new SearchError(isOffline() || err instanceof TypeError ? "offline" : "unknown", null);
  }
}
