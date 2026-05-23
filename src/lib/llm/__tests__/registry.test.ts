import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
    DEEPSEEK_API_KEY: undefined,
    OPENROUTER_API_KEY: undefined,
    NVIDIA_API_KEY: undefined,
    DEFAULT_LLM_PROVIDER: "openai",
    DEFAULT_LLM_MODEL: "gpt-4.1",
    DATABASE_URL: "postgresql://localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret-32-chars-long-here-okay!!!",
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

describe("LLMProviderRegistry", () => {
  it("should be empty when no API keys set", async () => {
    const { llmRegistry } = await import("../registry");
    expect(llmRegistry.listProviders()).toEqual([]);
  });

  it("should throw for unregistered provider", async () => {
    const { llmRegistry } = await import("../registry");
    expect(() => llmRegistry.get("nonexistent")).toThrow("LLM provider");
  });

  it("should handle empty model list", async () => {
    const { llmRegistry } = await import("../registry");
    expect(llmRegistry.listModels()).toEqual([]);
  });

  it("should not register providers without API keys", async () => {
    const { llmRegistry } = await import("../registry");
    expect(llmRegistry.listProviders()).not.toContain("openai");
  });
});
