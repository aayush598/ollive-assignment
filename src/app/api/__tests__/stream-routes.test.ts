import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("Chat Stream Request Schema validation", () => {
  const ChatRequestSchema = z.object({
    conversationId: z.string().nullish(),
    message: z.string().trim().min(1).max(10000),
    model: z.string().optional(),
    provider: z.string().optional(),
  });

  it("should accept valid stream request", () => {
    const result = ChatRequestSchema.safeParse({
      message: "Hello streaming world",
      model: "gpt-4.1",
      provider: "openai",
    });
    expect(result.success).toBe(true);
  });

  it("should accept stream request with conversationId", () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: "conv-stream-123",
      message: "Continue from here",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conversationId).toBe("conv-stream-123");
    }
  });

  it("should reject empty message in stream request", () => {
    const result = ChatRequestSchema.safeParse({
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("should accept stream request with all optional fields", () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: "conv-1",
      message: "Hello",
      model: "claude-sonnet-4-20250514",
      provider: "anthropic",
    });
    expect(result.success).toBe(true);
  });
});

describe("Stream response parsing logic", () => {
  function parseSSELine(line: string): { type: string; content?: string; error?: string } | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) return null;
    const data = trimmed.slice(6);
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  it("should parse a valid chunk SSE event", () => {
    const result = parseSSELine('data: {"type":"chunk","content":"Hello"}');
    expect(result).toEqual({ type: "chunk", content: "Hello" });
  });

  it("should parse a done SSE event", () => {
    const result = parseSSELine(
      'data: {"type":"done","usage":{"promptTokens":10,"completionTokens":20,"totalTokens":30},"conversationId":"conv-1"}',
    );
    expect(result?.type).toBe("done");
    if (result && result.type === "done") {
      expect(result).toHaveProperty("conversationId");
    }
  });

  it("should parse an error SSE event", () => {
    const result = parseSSELine('data: {"type":"error","error":"API timeout"}');
    expect(result).toEqual({ type: "error", error: "API timeout" });
  });

  it("should return null for non-data lines", () => {
    expect(parseSSELine(": heartbeat")).toBeNull();
    expect(parseSSELine("")).toBeNull();
    expect(parseSSELine("event: message")).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    expect(parseSSELine("data: {invalid}")).toBeNull();
  });

  it("should handle [DONE] marker gracefully", () => {
    const result = parseSSELine("data: [DONE]");
    expect(result).toBeNull();
  });
});

describe("Stream abort handling", () => {
  it("should detect aborted signal", () => {
    const controller = new AbortController();
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it("should not detect non-aborted signal", () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
  });

  it("should allow cancellation mid-stream", () => {
    const controller = new AbortController();

    function simulateStream(chunks: string[], signal: AbortSignal): string[] {
      const result: string[] = [];
      for (const chunk of chunks) {
        if (signal.aborted) break;
        result.push(chunk);
      }
      return result;
    }

    const chunks = simulateStream(["chunk1", "chunk2", "chunk3"], controller.signal);
    expect(chunks).toHaveLength(3);

    controller.abort();
    const afterAbort = simulateStream(["chunk4"], controller.signal);
    expect(afterAbort).toHaveLength(0);
  });
});

describe("Stream encoder/decoder", () => {
  it("should encode and decode SSE data correctly", () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const original = 'data: {"type":"chunk","content":"Hello"}\n\n';
    const encoded = encoder.encode(original);
    const decoded = decoder.decode(encoded);

    expect(decoded).toBe(original);
  });

  it("should handle streaming decode with buffer", () => {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const chunk1 = 'data: {"type":"chunk","content":"Hel';
    const chunk2 = 'lo"}\n\ndata: {"type":"done","usage":{"totalTokens":5}}\n\n';

    let buffer = "";
    buffer += decoder.decode(encoder.encode(chunk1), { stream: true });
    buffer += decoder.decode(encoder.encode(chunk2));

    const lines = buffer.split("\n");
    const events = lines
      .filter((l) => l.trim().startsWith("data: "))
      .map((l) => {
        try {
          return JSON.parse(l.trim().slice(6));
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    expect(events).toHaveLength(2);
    expect(events[0]).toHaveProperty("content", "Hello");
    expect(events[1]).toHaveProperty("type", "done");
  });
});
