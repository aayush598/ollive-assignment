import { describe, it, expect, vi, beforeEach } from "vitest";

describe("createEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("should parse valid environment variables", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.BETTER_AUTH_SECRET = "a".repeat(32);
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.OPENAI_API_KEY = "sk-test";

    const { env } = await import("../env");
    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/test");
    expect(env.OPENAI_API_KEY).toBe("sk-test");
    expect(env.NODE_ENV).toBe("test");
  });

  it("should apply defaults for optional fields", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.BETTER_AUTH_SECRET = "a".repeat(32);
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const { env } = await import("../env");
    expect(env.DEFAULT_LLM_PROVIDER).toBe("nvidia");
    expect(env.DEFAULT_LLM_MODEL).toBe("minimaxai/minimax-m2.7");
  });

  it("should apply NEXT_PUBLIC_APP_URL default", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.BETTER_AUTH_SECRET = "a".repeat(32);
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const { env } = await import("../env");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("should use env-provided NEXT_PUBLIC_APP_URL", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.BETTER_AUTH_SECRET = "a".repeat(32);
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    const { env } = await import("../env");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://example.com");
  });

  it("should fallback in non-production mode when env vars are missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;

    const { env } = await import("../env");
    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/llmchat");
    expect(env.BETTER_AUTH_SECRET).toBe("dev-secret-change-in-production-must-be-longer-than-32-chars-here");
    expect(env.NODE_ENV).toBe("development");
  });
});
