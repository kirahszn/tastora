# Qloo fixtures

Recorded real Qloo API responses from `npm run qloo:probe` (Phase 1). Never store API keys or request headers here.

- `raw/`: full responses. Gitignored, local only.
- `samples/`: the same responses trimmed to at most 5 entities/tags, same structure. Committed, for tests.

Each file has the shape `{ request: { path, params }, ok, status, durationMs, rateLimitHeaders, body }`.
