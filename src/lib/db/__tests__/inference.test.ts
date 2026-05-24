import { describe, it, expect, vi, beforeEach } from "vitest";

const mockValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

vi.mock("../index", () => ({
  db: { insert: mockInsert },
  schema: {},
}));

const mockRedactPII = vi.fn((text: string) => ({ redacted: text, hasPII: false, redactedCount: 0 }));

vi.mock("../../pii/redactor", () => ({
  redactPII: mockRedactPII,
}));

describe("insertInferenceLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedactPII.mockImplementation((text: string) => ({ redacted: text, hasPII: false, redactedCount: 0 }));
  });

  it("should insert a success inference log with metadata", async () => {
    const { insertInferenceLog } = await import("../inference");

    await insertInferenceLog(
      {
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4.1",
        provider: "openai",
        conversationId: "conv-1",
        userId: "user-1",
      },
      {
        id: "resp-1",
        content: "Hi there!",
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 500,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      },
      { conversationId: "conv-1", userId: "user-1", messageId: "msg-1" },
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.anything());
    expect(mockValues).toHaveBeenCalledOnce();
    const values = mockValues.mock.calls[0][0];
    expect(values.provider).toBe("openai");
    expect(values.model).toBe("gpt-4.1");
    expect(values.status).toBe("success");
    expect(values.latencyMs).toBe(500);
    expect(values.totalTokens).toBe(30);
    expect(values.conversationId).toBe("conv-1");
    expect(values.messageId).toBe("msg-1");
    expect(values.userId).toBe("user-1");
    expect(values.metadata.finishReason).toBe("stop");
  });

  it("should insert error log with error message", async () => {
    const { insertErrorLog } = await import("../inference");

    await insertErrorLog(
      {
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4.1",
        provider: "openai",
        conversationId: "conv-1",
      },
      "API timeout after 30s",
      { conversationId: "conv-1", provider: "openai" },
    );

    expect(mockValues).toHaveBeenCalledOnce();
    const values = mockValues.mock.calls[0][0];
    expect(values.status).toBe("error");
    expect(values.error).toBe("API timeout after 30s");
    expect(values.provider).toBe("openai");
    expect(values.conversationId).toBe("conv-1");
  });

  it("should handle empty options", async () => {
    const { insertInferenceLog } = await import("../inference");

    await insertInferenceLog(
      {
        messages: [{ role: "user", content: "Test" }],
        model: "gpt-4.1",
        conversationId: "conv-1",
      },
      {
        id: "resp-1",
        content: "OK",
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 100,
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
      },
    );

    const values = mockValues.mock.calls[0][0];
    expect(values.messageId).toBeNull();
    expect(values.sessionId).toBeNull();
  });

  it("should mark PII redacted when detected in input", async () => {
    mockRedactPII.mockReturnValue({ redacted: "[REDACTED_INPUT]", hasPII: true, redactedCount: 1 });

    const { insertInferenceLog } = await import("../inference");

    await insertInferenceLog(
      {
        messages: [{ role: "user", content: "test@email.com" }],
        model: "gpt-4.1",
        conversationId: "conv-1",
      },
      {
        id: "resp-1",
        content: "clean reply",
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 100,
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
      },
      { conversationId: "conv-1", redact: true },
    );

    const values = mockValues.mock.calls[0][0];
    expect(values.inputPreview).toBe("[REDACTED_INPUT]");
    expect(values.piiRedacted).toBe(true);
  });

  it("should skip PII redaction when disabled", async () => {
    const { insertInferenceLog } = await import("../inference");

    await insertInferenceLog(
      {
        messages: [{ role: "user", content: "test@email.com" }],
        model: "gpt-4.1",
        conversationId: "conv-1",
      },
      {
        id: "resp-1",
        content: "reply",
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 100,
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
      },
      { conversationId: "conv-1", redact: false },
    );

    const values = mockValues.mock.calls[0][0];
    expect(values.piiRedacted).toBe(false);
  });

  it("should trim long input/output to 500 chars", async () => {
    const { insertInferenceLog } = await import("../inference");

    await insertInferenceLog(
      {
        messages: [{ role: "user", content: "a".repeat(1000) }],
        model: "gpt-4.1",
        conversationId: "conv-1",
      },
      {
        id: "resp-1",
        content: "b".repeat(1000),
        model: "gpt-4.1",
        provider: "openai",
        latencyMs: 100,
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
      },
      { conversationId: "conv-1" },
    );

    const values = mockValues.mock.calls[0][0];
    expect(values.inputPreview).toHaveLength(500);
    expect(values.outputPreview).toHaveLength(500);
  });
});
