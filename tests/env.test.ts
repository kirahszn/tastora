import { afterEach, describe, expect, it, vi } from "vitest";
import { getQlooEnv, getServerEnv } from "@/lib/env";

const VALID = {
  QLOO_API_KEY: "test-qloo-key-SECRET123",
  QLOO_API_BASE_URL: "https://example.test",
  ANTHROPIC_API_KEY: "test-anthropic-key-SECRET456",
};

function stubEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

function thrownMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error("expected function to throw");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getServerEnv", () => {
  it("returns all vars when valid", () => {
    stubEnv(VALID);
    expect(getServerEnv()).toEqual(VALID);
  });

  it("names the missing var and never includes values", () => {
    stubEnv({ ...VALID, ANTHROPIC_API_KEY: undefined });
    const message = thrownMessage(getServerEnv);

    expect(message).toContain("ANTHROPIC_API_KEY");
    expect(message).not.toContain("QLOO_API_KEY");
    expect(message).not.toContain(VALID.QLOO_API_KEY);
    expect(message).not.toContain(VALID.QLOO_API_BASE_URL);
  });

  it("rejects an empty key and an invalid URL without echoing them", () => {
    stubEnv({ ...VALID, QLOO_API_KEY: "", QLOO_API_BASE_URL: "not-a-url-SECRET789" });
    const message = thrownMessage(getServerEnv);

    expect(message).toContain("QLOO_API_KEY");
    expect(message).toContain("QLOO_API_BASE_URL");
    expect(message).not.toContain("SECRET789");
    expect(message).not.toContain(VALID.ANTHROPIC_API_KEY);
  });
});

describe("getQlooEnv", () => {
  it("does not require ANTHROPIC_API_KEY", () => {
    stubEnv({ ...VALID, ANTHROPIC_API_KEY: undefined });
    expect(getQlooEnv()).toEqual({
      QLOO_API_KEY: VALID.QLOO_API_KEY,
      QLOO_API_BASE_URL: VALID.QLOO_API_BASE_URL,
    });
  });

  it("names the missing Qloo var", () => {
    stubEnv({ ...VALID, QLOO_API_KEY: undefined });
    expect(thrownMessage(getQlooEnv)).toContain("QLOO_API_KEY");
  });
});
