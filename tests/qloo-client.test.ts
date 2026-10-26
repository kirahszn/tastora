import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildQlooUrl,
  qlooGet,
  qlooRequest,
  QlooApiError,
  QLOO_TIMEOUT_MS,
} from "@/lib/qloo/client";

const KEY = "test-key-SECRET-abc123";
const BASE = "https://qloo.example.test";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(impl: (url: URL, init: RequestInit) => Promise<Response>) {
  return vi.fn(impl as unknown as typeof fetch);
}

async function caught(promise: Promise<unknown>): Promise<QlooApiError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(QlooApiError);
    return err as QlooApiError;
  }
  throw new Error("expected promise to reject");
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("buildQlooUrl", () => {
  it("joins base and path and encodes params, comma-joining arrays", () => {
    const url = buildQlooUrl(`${BASE}/`, "/v2/insights", {
      "filter.type": "urn:entity:place",
      "filter.location.query": "New York City",
      "signal.interests.tags": ["urn:tag:a", "urn:tag:b"],
      take: 10,
      skipped: undefined,
    });

    expect(url.origin + url.pathname).toBe(`${BASE}/v2/insights`);
    expect(url.searchParams.get("filter.type")).toBe("urn:entity:place");
    expect(url.searchParams.get("filter.location.query")).toBe("New York City");
    expect(url.searchParams.get("signal.interests.tags")).toBe("urn:tag:a,urn:tag:b");
    expect(url.searchParams.get("take")).toBe("10");
    expect(url.searchParams.has("skipped")).toBe(false);
    expect(url.search).toContain("New+York+City");
  });
});

describe("qlooRequest", () => {
  it("sends the X-Api-Key header and returns parsed JSON", async () => {
    const fetch = mockFetch(async () => jsonResponse({ success: true, results: [] }));

    const res = await qlooRequest("/search", { query: "fela" }, { apiKey: KEY, baseUrl: BASE, fetch });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, results: [] });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(`${BASE}/search?query=fela`);
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(KEY);
    expect(init.method).toBe("GET");
  });

  it("reads key and base URL from the environment by default", async () => {
    vi.stubEnv("QLOO_API_KEY", KEY);
    vi.stubEnv("QLOO_API_BASE_URL", BASE);
    const fetch = mockFetch(async () => jsonResponse({ ok: 1 }));

    expect(await qlooGet("/v2/tags", {}, { fetch })).toEqual({ ok: 1 });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(`${BASE}/v2/tags`);
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(KEY);
  });

  it("throws a typed error with status and body on non-2xx, without the key", async () => {
    const fetch = mockFetch(async () =>
      jsonResponse({ error: { message: `bad key ${KEY}` } }, 401),
    );

    const err = await caught(qlooRequest("/v2/insights", {}, { apiKey: KEY, baseUrl: BASE, fetch }));

    expect(err.status).toBe(401);
    expect(err.path).toBe("/v2/insights");
    expect(err.message).toContain("401");
    expect(err.message).not.toContain(KEY);
    expect(JSON.stringify(err.body)).not.toContain(KEY);
    expect(JSON.stringify(err.body)).toContain("[REDACTED]");
  });

  it("aborts after the 15 s default timeout and throws a typed error", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetch = mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    );

    expect(QLOO_TIMEOUT_MS).toBe(15_000);
    const pending = caught(qlooRequest("/search", {}, { apiKey: KEY, baseUrl: BASE, fetch }));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = await pending;

    expect(err.status).toBeNull();
    expect(err.message).toMatch(/timed out/);
  });

  it("redacts the key from network error messages", async () => {
    const fetch = mockFetch(async () => {
      throw new Error(`connect failed with header ${KEY}`);
    });

    const err = await caught(qlooRequest("/search", {}, { apiKey: KEY, baseUrl: BASE, fetch }));

    expect(err.status).toBeNull();
    expect(err.message).not.toContain(KEY);
    expect(err.message).toContain("[REDACTED]");
  });
});
