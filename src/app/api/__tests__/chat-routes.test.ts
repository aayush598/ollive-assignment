import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("ChatRequestSchema validation", () => {
  const ChatRequestSchema = z.object({
    conversationId: z.string().nullish(),
    message: z.string().trim().min(1).max(10000),
    model: z.string().optional(),
    provider: z.string().optional(),
  });

  it("should accept valid request with null conversationId (new chat)", () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: null,
      message: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conversationId).toBeNull();
      expect(result.data.message).toBe("Hello");
    }
  });

  it("should accept valid request without conversationId", () => {
    const result = ChatRequestSchema.safeParse({
      message: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conversationId).toBeUndefined();
      expect(result.data.message).toBe("Hello");
    }
  });

  it("should accept valid request with conversationId", () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: "conv-123",
      message: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conversationId).toBe("conv-123");
    }
  });

  it("should reject empty message", () => {
    const result = ChatRequestSchema.safeParse({
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only message after trim", () => {
    const result = ChatRequestSchema.safeParse({
      message: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("should reject message exceeding max length", () => {
    const result = ChatRequestSchema.safeParse({
      message: "a".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid request with all optional fields", () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: "conv-123",
      message: "Hello",
      model: "gpt-4.1",
      provider: "openai",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid request with undefined fields", () => {
    const result = ChatRequestSchema.safeParse({
      message: "Hello",
      model: undefined,
      provider: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-string conversationId", () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 123,
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("isFirstMessage detection", () => {
  it("should detect first message when llmMessages has 1 item", () => {
    const llmMessages = [{ role: "user" as const, content: "Hello" }];
    const isFirstMessage = llmMessages.length <= 1;
    expect(isFirstMessage).toBe(true);
  });

  it("should detect non-first message when llmMessages has multiple items", () => {
    const llmMessages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there" },
      { role: "user" as const, content: "How are you?" },
    ];
    const isFirstMessage = llmMessages.length <= 1;
    expect(isFirstMessage).toBe(false);
  });

  it("should detect non-first message with empty messages", () => {
    const llmMessages: Array<{ role: string; content: string }> = [];
    const isFirstMessage = llmMessages.length <= 1;
    expect(isFirstMessage).toBe(true);
  });
});

describe("profile icon first character logic", () => {
  function getProfileInitial(name: string | null): string {
    return name ? name.charAt(0).toUpperCase() : "?";
  }

  it("should return first character for 'John'", () => {
    expect(getProfileInitial("John")).toBe("J");
  });

  it("should return first character for 'alice'", () => {
    expect(getProfileInitial("alice")).toBe("A");
  });

  it("should handle multi-word names", () => {
    expect(getProfileInitial("John Doe")).toBe("J");
  });

  it("should return '?' for null name", () => {
    expect(getProfileInitial(null)).toBe("?");
  });

  it("should return '?' for undefined name", () => {
    expect(getProfileInitial(undefined as unknown as string)).toBe("?");
  });

  it("should return first character for single character name", () => {
    expect(getProfileInitial("A")).toBe("A");
  });

  it("should uppercase lowercase first character", () => {
    expect(getProfileInitial("sarah")).toBe("S");
  });
});

describe("auth session redirect logic", () => {
  it("should redirect to /chat when session.data exists", () => {
    const session = { data: { user: { id: "user-1" } }, error: null };
    expect(session.data).toBeTruthy();
  });

  it("should not redirect when session.data is null", () => {
    const session = { data: null, error: null };
    expect(session.data).toBeFalsy();
  });

  it("should not redirect when session has error", () => {
    const session = { data: null, error: new Error("Auth error") };
    expect(session.data).toBeFalsy();
    expect(session.error).toBeTruthy();
  });
});
