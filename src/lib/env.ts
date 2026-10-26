// Server-only environment reader. Validates lazily (at call time) so the app
// builds and deploys even when keys are missing. Never log the returned values.
import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  QLOO_API_KEY: z.string().min(1),
  QLOO_API_BASE_URL: z.url(),
  ANTHROPIC_API_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    QLOO_API_KEY: process.env.QLOO_API_KEY,
    QLOO_API_BASE_URL: process.env.QLOO_API_BASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });

  if (!result.success) {
    // Report variable names only, never values.
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Missing or invalid server env vars: ${names.join(", ")}`);
  }

  return result.data;
}
