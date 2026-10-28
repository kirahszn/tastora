import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/recommend/route";
import { clearQlooCache } from "@/lib/qloo/search";
import { fakeQloo } from "./helpers/fakes";

// Sentinel secrets: if any response body ever contains one, the test fails.
const QLOO_KEY = "qloo-key-SENTINEL-1234567890";
const ANTHROPIC_KEY = "sk-ant-SENTINEL-0987654321";

const profileA = {
  favouriteCuisines: ["Nigerian"],
  favouriteDishes: ["jollof rice"],
  allergies: ["peanut"],
  texture: "soft",
  tasteMemories: { music: ["Fela Kuti"] },
  location: "Brooklyn",
};

let ip = 0;
function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** Fetch stub: Qloo answers from the fake (or fails, echoing the key); Anthropic always 500s. */
function stubFetch(mode: { qlooDown?: boolean } = {}) {
  const qloo = fakeQloo();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname.includes("anthropic")) {
      return Response.json({ type: "error", error: { type: "api_error", message: `bad ${ANTHROPIC_KEY}` } }, { status: 500 });
    }
    const headers = new Headers(init?.headers);
    if (headers.get("X-Api-Key") !== QLOO_KEY) return Response.json({ error: "no key" }, { status: 401 });
    if (mode.qlooDown) return Response.json({ error: { message: `upstream echo ${QLOO_KEY}` } }, { status: 503 });
    const params = Object.fromEntries(url.searchParams.entries());
    return Response.json(await qloo.get(url.pathname, params));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearQlooCache();
  vi.stubEnv("QLOO_API_KEY", QLOO_KEY);
  vi.stubEnv("QLOO_API_BASE_URL", "https://qloo.test");
  vi.stubEnv("ANTHROPIC_API_KEY", ANTHROPIC_KEY);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/recommend", () => {
  it("returns 400 with field errors on a bad profile", async () => {
    stubFetch();
    const res = await post({ profile: { favouriteCuisines: [], location: "" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request.");
    expect(body.fieldErrors.map((e: { path: string }) => e.path)).toEqual(
      expect.arrayContaining(["profile.favouriteCuisines", "profile.city"]),
    );
  });

  it("returns 400 on invalid JSON and on bad feedback", async () => {
    stubFetch();
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ profile: profileA, feedback: { liked: "x" } })).status).toBe(400);
  });

  it("returns 200 with results, trace, evidence and meta; falls back when Claude fails", async () => {
    stubFetch();
    const res = await post({ profile: profileA });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(QLOO_KEY);
    expect(text).not.toContain(ANTHROPIC_KEY);
    const body = JSON.parse(text);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.meta.planner).toBe("fallback");
    expect(body.meta.fallbackReason).toBe("Claude API error 500");
    expect(body.evidence.personalisedTop10.length).toBeGreaterThan(0);
    expect(Object.keys(body)).toEqual(["results", "excluded", "trace", "evidence", "notices", "coverageNote", "meta"]);
  });

  it("returns 502 with a friendly message when Qloo is down, leaking nothing", async () => {
    stubFetch({ qlooDown: true });
    const res = await post({ profile: profileA });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      error: "We couldn't get restaurant suggestions right now. Please try again in a minute.",
    });
    expect(text).not.toContain(QLOO_KEY);
    expect(text).not.toContain(ANTHROPIC_KEY);
    expect(text).not.toMatch(/at \w+ \(|stack/i);
  });

  it("rate-limits to 10 requests per minute per IP", async () => {
    stubFetch();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await post("{bad", { "x-forwarded-for": "203.0.113.9" })).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  describe("?stream=1 (NDJSON)", () => {
    const postStream = (body: unknown) =>
      POST(
        new Request("http://localhost/api/recommend?stream=1", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": `10.0.1.${++ip}` },
          body: JSON.stringify(body),
        }),
      );
    const events = async (res: Response) =>
      (await res.text())
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l));

    it("streams each trace step, then the same result as JSON mode", async () => {
      stubFetch();
      const res = await postStream({ profile: profileA });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/x-ndjson");
      const lines = await events(res);
      const steps = lines.filter((e) => e.type === "step").map((e) => e.step);
      const last = lines.at(-1);
      expect(last.type).toBe("result");
      expect(lines.filter((e) => e.type === "result")).toHaveLength(1);
      // The streamed steps are exactly the final trace, in order.
      expect(steps).toEqual(last.result.trace);
      expect(steps.map((s: { step: number }) => s.step)).toEqual(steps.map((_: unknown, i: number) => i + 1));
      expect(Object.keys(last.result)).toEqual(["results", "excluded", "trace", "evidence", "notices", "coverageNote", "meta"]);
    });

    it("ends with an error event when Qloo is down, leaking nothing", async () => {
      stubFetch({ qlooDown: true });
      const res = await postStream({ profile: profileA });
      const text = await res.text();
      expect(text).not.toContain(QLOO_KEY);
      expect(text).not.toContain(ANTHROPIC_KEY);
      const last = JSON.parse(text.trim().split("\n").at(-1)!);
      expect(last).toEqual({
        type: "error",
        status: 502,
        error: "We couldn't get restaurant suggestions right now. Please try again in a minute.",
      });
    });

    it("answers validation errors with a normal 400 before streaming", async () => {
      stubFetch();
      const res = await postStream({ profile: { favouriteCuisines: [], location: "" } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Invalid request.");
    });
  });

  it("exports a max duration for Vercel", async () => {
    const route = await import("@/app/api/recommend/route");
    expect(route.maxDuration).toBe(60);
  });
});
