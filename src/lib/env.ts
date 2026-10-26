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

// Subset used by the Qloo client, so it works before the Anthropic key exists.
const qlooEnvSchema = serverEnvSchema.pick({ QLOO_API_KEY: true, QLOO_API_BASE_URL: true });

export type QlooEnv = z.infer<typeof qlooEnvSchema>;

function parseEnv<T extends z.ZodObject>(schema: T): z.infer<T> {
  const input = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, process.env[k]]));
  const result = schema.safeParse(input);

  if (!result.success) {
    // Report variable names only, never values.
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Missing or invalid server env vars: ${names.join(", ")}`);
  }

  return result.data;
}

export function getServerEnv(): ServerEnv {
  return parseEnv(serverEnvSchema);
}

export function getQlooEnv(): QlooEnv {
  return parseEnv(qlooEnvSchema);
}
