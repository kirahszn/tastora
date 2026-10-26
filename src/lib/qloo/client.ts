// Minimal Qloo HTTP client (server-only). Responses are returned as `unknown`;
// typed response schemas come in a later phase. Never log or echo the API key.
import "server-only";
import { getQlooEnv } from "@/lib/env";

// signal.interests.tags queries took up to 7.7 s in Phase 1; 15 s leaves headroom.
export const QLOO_TIMEOUT_MS = 15_000;

type ParamValue = string | number | boolean | readonly (string | number)[] | undefined;
export type QlooParams = Record<string, ParamValue>;

export interface QlooRequestOptions {
  /** Defaults to QLOO_API_KEY / QLOO_API_BASE_URL from the environment. */
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface QlooResponse {
  status: number;
  headers: Headers;
  body: unknown;
  durationMs: number;
}

export class QlooApiError extends Error {
  readonly status: number | null;
  readonly path: string;
  readonly body: unknown;

  /** `status` is null for timeouts and network failures. */
  constructor(message: string, status: number | null, path: string, body?: unknown) {
    super(message);
    this.name = "QlooApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export function buildQlooUrl(baseUrl: string, path: string, params: QlooParams = {}): URL {
  const url = new URL(baseUrl.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, ""));
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    // Qloo takes multi-valued params as comma-separated lists.
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return url;
}

function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join("[REDACTED]") : text;
}

function redactBody(body: unknown, secret: string): unknown {
  if (body === undefined) return undefined;
  return JSON.parse(redact(JSON.stringify(body), secret));
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Authenticated GET returning status, headers, parsed body and latency. */
export async function qlooRequest(
  path: string,
  params: QlooParams = {},
  options: QlooRequestOptions = {},
): Promise<QlooResponse> {
  const env = options.apiKey && options.baseUrl ? null : getQlooEnv();
  const apiKey = options.apiKey ?? env!.QLOO_API_KEY;
  const baseUrl = options.baseUrl ?? env!.QLOO_API_BASE_URL;
  const fetchImpl = options.fetch ?? fetch;
  const url = buildQlooUrl(baseUrl, path, params);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? QLOO_TIMEOUT_MS);
  const started = performance.now();

  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await readBody(res);
    const durationMs = Math.round(performance.now() - started);

    if (!res.ok) {
      throw new QlooApiError(
        `Qloo request to ${path} failed with HTTP ${res.status}`,
        res.status,
        path,
        redactBody(body, apiKey),
      );
    }
    return { status: res.status, headers: res.headers, body, durationMs };
  } catch (err) {
    if (err instanceof QlooApiError) throw err;
    if (controller.signal.aborted) {
      throw new QlooApiError(`Qloo request to ${path} timed out`, null, path);
    }
    const detail = err instanceof Error ? redact(err.message, apiKey) : "unknown error";
    throw new QlooApiError(`Qloo request to ${path} failed: ${detail}`, null, path);
  } finally {
    clearTimeout(timer);
  }
}

/** Authenticated GET returning only the parsed JSON body. */
export async function qlooGet(
  path: string,
  params: QlooParams = {},
  options: QlooRequestOptions = {},
): Promise<unknown> {
  return (await qlooRequest(path, params, options)).body;
}
