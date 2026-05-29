import { z } from "zod";

function envLog(level: "error" | "warn" | "info", msg: string, data?: Record<string, unknown>) {
  const prefix = level === "error" ? "[ENV ERROR]" : level === "warn" ? "[ENV WARN]" : "[ENV INFO]";
  if (data) {
    console[level](`${prefix} ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${msg}`);
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z
    .string()
    .url()
    .transform((v) => {
      if (
        process.env.VERCEL === "1" &&
        (v.startsWith("http://localhost") || v.startsWith("https://localhost"))
      ) {
        return `https://${process.env.VERCEL_URL}`;
      }
      return v;
    }),
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
  QDRANT_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  QDRANT_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  SENTRY_DSN: z.string().optional(),
  ADMIN_EMAILS: z
    .string()
    .default("admin@example.com")
    .transform((s) => s.split(",").map((e) => e.trim())),
  MAX_CONTEXT_MESSAGES: z.coerce.number().int().positive().default(20),
  LLM_REQUEST_TIMEOUT: z.coerce.number().int().positive().default(30000),
  LLM_STREAM_TIMEOUT: z.coerce.number().int().positive().default(60000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

function appUrl(): string {
  if (process.env.VERCEL === "1") return `https://${process.env.VERCEL_URL}`;
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

function createEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    envLog("error", "Invalid environment variables", {
      errors: parsed.error.flatten().fieldErrors,
    });
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
      BETTER_AUTH_URL: appUrl(),
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
      ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "admin@example.com",
      MAX_CONTEXT_MESSAGES: parseInt(process.env.MAX_CONTEXT_MESSAGES ?? "20", 10),
      LLM_REQUEST_TIMEOUT: parseInt(process.env.LLM_REQUEST_TIMEOUT ?? "30000", 10),
      LLM_STREAM_TIMEOUT: parseInt(process.env.LLM_STREAM_TIMEOUT ?? "60000", 10),
    });
  }
  return parsed.data;
}

export const env = createEnv();
