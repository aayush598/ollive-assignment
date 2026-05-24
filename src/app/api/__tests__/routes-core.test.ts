import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "conv-1" }]),
  },
  schema: {},
}));

vi.mock("@/lib/auth/api", () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/llm/registry", () => ({
  llmRegistry: {
    getDefault: vi.fn().mockReturnValue({ name: "openai" }),
    getDefaultModel: vi.fn().mockReturnValue("gpt-4.1"),
    get: vi.fn().mockReturnValue({
      name: "openai",
      models: ["gpt-4.1"],
      generate: vi.fn().mockResolvedValue({
        id: "resp-1",
        content: "Test response",
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 200,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      }),
      generateStream: vi.fn().mockReturnValue(
        (async function* () {
          yield { type: "chunk" as const, content: "Hello" };
          yield {
            type: "done" as const,
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            finishReason: "stop",
          };
        })(),
      ),
    }),
    listAvailableModels: vi
      .fn()
      .mockReturnValue([{ provider: "openai", model: "gpt-4.1", label: "OpenAI — gpt-4.1" }]),
    listProviders: vi.fn().mockReturnValue(["openai"]),
  },
}));

describe("processIngestBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept valid logs", async () => {
    const { processIngestBatch } = await import("@/lib/ingestion/service");

    const result = await processIngestBatch({
      logs: [
        {
          provider: "openai",
          model: "gpt-4.1",
          status: "success",
          latencyMs: 500,
          conversationId: "conv-1",
        },
      ],
    });

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(0);
  });

  it("should reject invalid payload structure", async () => {
    const { processIngestBatch } = await import("@/lib/ingestion/service");

    const result = await processIngestBatch({ logs: "not-an-array" });
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should handle DB errors gracefully", async () => {
    const dbModule = await import("@/lib/db");
    vi.mocked(dbModule.db.insert).mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error("DB write failed")),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { processIngestBatch } = await import("@/lib/ingestion/service");

    const result = await processIngestBatch({
      logs: [
        {
          provider: "openai",
          model: "gpt-4.1",
          status: "success",
          conversationId: "conv-1",
        },
      ],
    });

    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
  });

  it("should accept multiple logs in a batch", async () => {
    const { processIngestBatch } = await import("@/lib/ingestion/service");

    const result = await processIngestBatch({
      logs: [
        { provider: "openai", model: "gpt-4.1", status: "success", conversationId: "conv-1" },
        { provider: "anthropic", model: "claude-3", status: "success", conversationId: "conv-2" },
      ],
    });

    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(0);
  });
});

describe("health check API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return healthy when DB responds", async () => {
    const mod = await import("@/app/api/health/route");
    const response = await mod.GET();
    const data = await response.json();

    expect(data.status).toBe("healthy");
    expect(data.database).toBe("connected");
    expect(data).toHaveProperty("timestamp");
  });
});

describe("models API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return available models list", async () => {
    const mod = await import("@/app/api/models/route");
    const response = await mod.GET();
    const data = await response.json();

    expect(data.models).toHaveLength(1);
    expect(data.models[0]).toHaveProperty("provider");
    expect(data.models[0]).toHaveProperty("model");
    expect(data.models[0]).toHaveProperty("label");
  });

  it("should return empty models on auth failure", async () => {
    const authModule = await import("@/lib/auth/api");
    vi.mocked(authModule.requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

    const mod = await import("@/app/api/models/route");
    const response = await mod.GET();
    const data = await response.json();

    expect(data.models).toEqual([]);
  });
});

describe("ingestion API stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return stats for the ingestion API", async () => {
    const dbModule = await import("@/lib/db");

    vi.mocked(dbModule.db.execute).mockResolvedValue([
      {
        count: 10,
        total_tokens: 500,
        avg_latency: 200,
        p95_latency: 800,
        success: 8,
        error: 1,
        cancelled: 1,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbModule.db.select).mockReturnValue(mockSelectChain as any);

    const mod = await import("@/app/api/ingest/route");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = new Request("http://localhost:3000/api/ingest?stats=true") as any;
    const response = await mod.GET(req);
    const data = await response.json();

    expect(data).toHaveProperty("totalRequests");
    expect(data).toHaveProperty("totalTokens");
    expect(data).toHaveProperty("averageLatencyMs");
    expect(data).toHaveProperty("p95LatencyMs");
    expect(data).toHaveProperty("successRate");
    expect(data).toHaveProperty("errorRate");
  });
});

describe("rate limit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should block requests over limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = "test-" + Date.now();
    for (let i = 0; i < 3; i++) {
      rateLimit(key, { maxRequests: 3, windowMs: 60000 });
    }
    const result = rateLimit(key, { maxRequests: 3, windowMs: 60000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should allow requests within limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = "test-within-" + Date.now();
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(key, { maxRequests: 5, windowMs: 60000 });
      expect(result.allowed).toBe(true);
    }
  });

  it("should generate unique rate limit keys", async () => {
    const { getRateLimitKey } = await import("@/lib/rate-limit");
    const key1 = getRateLimitKey("ip-1", "/api/chat");
    const key2 = getRateLimitKey("ip-2", "/api/chat");
    expect(key1).not.toBe(key2);
  });
});
