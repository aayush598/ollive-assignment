import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DEFAULT_LLM_PROVIDER: z
    .enum(["openai", "anthropic", "gemini", "deepseek", "openrouter", "nvidia"])
    .default("nvidia"),
  DEFAULT_LLM_MODEL: z.string().default("minimaxai/minimax-m2.7"),
  QDRANT_URL: z.string().url().optional(),
  QDRANT_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

function createEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build"
    ) {
      throw new Error("Invalid environment variables");
    }
    return envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost:5432/llmchat",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "dev-secret-change-in-production-must-be-longer-than-32-chars-here",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      NODE_ENV: "development",
      NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      DEFAULT_LLM_PROVIDER: "nvidia",
      DEFAULT_LLM_MODEL: "minimaxai/minimax-m2.7",
      QDRANT_URL: process.env.QDRANT_URL,
      QDRANT_API_KEY: process.env.QDRANT_API_KEY,
      LOG_LEVEL: (process.env.LOG_LEVEL as "info") ?? "info",
      ENABLE_METRICS: process.env.ENABLE_METRICS !== "false",
      SENTRY_DSN: process.env.SENTRY_DSN,
    });
  }
  return parsed.data;
}

export const env = createEnv();
