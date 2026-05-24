import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("IngestionSDK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a log entry from a request and response", async () => {
    const { IngestionSDK } = await import("../ingestion-sdk");

    const sdk = new IngestionSDK({ autoSend: false });

    const log = sdk.capture(
      {
        messages: [{ role: "user" as const, content: "Hello" }],
        model: "gpt-4.1",
        provider: "openai",
        conversationId: "conv-1",
      },
      {
        id: "resp-1",
        content: "Hi there!",
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 500,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
      { conversationId: "conv-1" },
    );

    expect(log.provider).toBe("openai");
    expect(log.model).toBe("gpt-4.1");
    expect(log.status).toBe("success");
    expect(log.latencyMs).toBe(500);
    expect(log.totalTokens).toBe(15);
    expect(log.metadata?.finishReason).toBe("stop");
  });

  it("should create error log entries", async () => {
    const { IngestionSDK } = await import("../ingestion-sdk");

    const sdk = new IngestionSDK({ autoSend: false });

    const log = sdk.captureError(
      {
        messages: [{ role: "user" as const, content: "Hello" }],
        model: "gpt-4.1",
        provider: "openai",
        conversationId: "conv-1",
      },
      new Error("API timeout"),
      { conversationId: "conv-1" },
    );

    expect(log.status).toBe("error");
    expect(log.error).toBe("API timeout");
  });

  it("should batch flush logs", async () => {
    const { IngestionSDK } = await import("../ingestion-sdk");

    mockFetch.mockResolvedValueOnce({ ok: true });

    const sdk = new IngestionSDK({
      ingestEndpoint: "http://test/api/ingest",
      flushIntervalMs: 10000,
      maxBatchSize: 10,
      autoSend: false,
    });

    sdk.capture(
      {
        messages: [{ role: "user" as const, content: "Hello" }],
        model: "gpt-4.1",
        conversationId: "conv-1",
      },
      {
        id: "resp-1",
        content: "Hi",
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 100,
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
      },
      { conversationId: "conv-1" },
    );

    await sdk.flush();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test/api/ingest",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});
