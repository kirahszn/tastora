// POST /api/recommend: { profile, feedback? } → ranked results, agent trace and Qloo evidence.
// Errors never include stack traces, upstream bodies or secrets.
import { z } from "zod";
import { recommend } from "@/lib/agent/recommend";
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

  try {
    const result = await recommend(parsed.data.profile, parsed.data.feedback);
    return Response.json(result);
  } catch (err) {
    // Log the error class only; messages could carry request details.
    console.error("recommend failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: UPSTREAM_MESSAGE }, { status: 502 });
  }
}
