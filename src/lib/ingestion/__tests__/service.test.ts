import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
  },
  schema: {},
}));

import { InferenceLogSchema } from "../../llm/types";

describe("InferenceLogSchema", () => {
  it("should validate a valid log entry", () => {
    const validLog = {
      provider: "openai",
      model: "gpt-4.1",
      status: "success",
      latencyMs: 500,
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      conversationId: "conv-1",
    };

    const result = InferenceLogSchema.safeParse(validLog);
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const invalidLog = {
      provider: "openai",
      model: "gpt-4.1",
      status: "invalid_status",
      conversationId: "conv-1",
    };

    const result = InferenceLogSchema.safeParse(invalidLog);
    expect(result.success).toBe(false);
  });

  it("should require conversationId", () => {
    const invalidLog = {
      provider: "openai",
      model: "gpt-4.1",
      status: "success",
    };

    const result = InferenceLogSchema.safeParse(invalidLog);
    expect(result.success).toBe(false);
  });

  it("should reject non-positive latencyMs", () => {
    const invalidLog = {
      provider: "openai",
      model: "gpt-4.1",
      status: "success",
      latencyMs: -500,
      conversationId: "conv-1",
    };

    const result = InferenceLogSchema.safeParse(invalidLog);
    expect(result.success).toBe(false);
  });

  it("should accept error log without token counts", () => {
    const errorLog = {
      provider: "openai",
      model: "gpt-4.1",
      status: "error",
      error: "API timeout",
      conversationId: "conv-1",
    };

    const result = InferenceLogSchema.safeParse(errorLog);
    expect(result.success).toBe(true);
  });
});

describe("processIngestBatch", () => {
  it("should return errors for invalid payload", async () => {
    const { processIngestBatch } = await import("../service");

    const result = await processIngestBatch({ logs: "invalid" });
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should handle empty logs array", async () => {
    const { processIngestBatch } = await import("../service");

    const result = await processIngestBatch({ logs: [] });
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(0);
  });
});
