// POST /api/recommend: { profile, feedback? } → ranked results, agent trace and Qloo evidence.
// `?stream=1` streams the trace steps as NDJSON first. Errors never include stack traces,
// upstream bodies or secrets.
import { z } from "zod";
import { recommend, type RecommendResponse } from "@/lib/agent/recommend";
import { LocationNotFoundError } from "@/lib/qloo/search";
import type { TraceStep } from "@/lib/agent/session";
import { SeniorProfileSchema } from "@/lib/domain/profile";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { RankingFeedbackSchema } from "@/lib/ranking/feedback";

// Route segment config (Next.js 16 docs: route-segment-config/maxDuration). Vercel with fluid
// compute allows up to 300 s on Hobby and 800 s on Pro; 60 s is plenty and caps runaway cost.
export const maxDuration = 60;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const checkRate = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

const BodySchema = z.object({
  profile: SeniorProfileSchema,
  feedback: RankingFeedbackSchema.optional(),
});

const UPSTREAM_MESSAGE =
  "We couldn't get restaurant suggestions right now. Please try again in a minute.";

// Same code as LOCATION_NOT_FOUND in lib/ui/searchClient.ts (client code, not imported here).
const LOCATION_NOT_FOUND = {
  status: 400,
  code: "location_not_found",
  error: "Qloo couldn't find that city or area. Please try the nearest larger city.",
} as const;

export async function POST(request: Request) {
  const rate = checkRate(clientIp(request.headers));
  if (!rate.ok) {
    return Response.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request.",
        fieldErrors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }

  const { profile, feedback } = parsed.data;
  if (new URL(request.url).searchParams.get("stream") === "1") return streamRecommend(profile, feedback);

  try {
    const result = await recommend(profile, feedback);
    return Response.json(result);
  } catch (err) {
    if (err instanceof LocationNotFoundError) {
      return Response.json({ error: LOCATION_NOT_FOUND.error, code: LOCATION_NOT_FOUND.code }, { status: 400 });
    }
    logFailure(err);
    return Response.json({ error: UPSTREAM_MESSAGE }, { status: 502 });
  }
}

// Log the error class only; messages could carry request details.
const logFailure = (err: unknown) =>
  console.error("recommend failed:", err instanceof Error ? err.name : "unknown");

/**
 * NDJSON stream: one `{"type":"step","step":…}` line per trace step as it happens, then a final
 * `{"type":"result","result":…}` or `{"type":"error","status":502,"error":…}`. Validation and rate
 * limits are answered before the stream starts, with normal status codes.
 */
function streamRecommend(profile: z.output<typeof BodySchema>["profile"], feedback: z.output<typeof BodySchema>["feedback"]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false; // client went away
        }
      };
      try {
        const result = await recommend(profile, feedback, { onStep: (step) => send({ type: "step", step }) });
        send({ type: "result", result });
      } catch (err) {
        if (err instanceof LocationNotFoundError) send({ type: "error", ...LOCATION_NOT_FOUND });
        else {
          logFailure(err);
          send({ type: "error", status: 502, error: UPSTREAM_MESSAGE });
        }
      }
      if (open) controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

type StreamEvent =
  | { type: "step"; step: TraceStep }
  | { type: "result"; result: RecommendResponse }
  | { type: "error"; status: number; error: string; code?: string };
