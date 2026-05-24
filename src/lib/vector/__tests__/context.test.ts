import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/vector/qdrant", () => ({
  getQdrantClient: vi.fn(),
  COLLECTION_NAME: "conversation_context",
}));

vi.mock("@/lib/vector/embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

describe("augmentMessagesWithContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip context retrieval for first message and return messages unchanged", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { augmentMessagesWithContext } = await import("../context");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(qdrantModule.getQdrantClient).mockReturnValue({} as any);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const result = await augmentMessagesWithContext("user-1", "Hello", messages, true);

    expect(result).toEqual(messages);
    expect(qdrantModule.getQdrantClient).not.toHaveBeenCalled();
  });

  it("should query context for non-first message when Qdrant is available", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { augmentMessagesWithContext } = await import("../context");

    const mockClient = {
      query: vi.fn().mockResolvedValue({
        points: [
          {
            score: 0.85,
            payload: { userId: "user-1", userMessage: "Previous Q", assistantMessage: "Previous A" },
          },
        ],
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const result = await augmentMessagesWithContext("user-1", "Hello", messages, false);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toContain("Previous Q");
    expect(result[1]).toEqual(messages[0]);
  });

  it("should return messages unchanged when Qdrant returns no relevant context", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { augmentMessagesWithContext } = await import("../context");

    const mockClient = {
      query: vi.fn().mockResolvedValue({ points: [] }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const result = await augmentMessagesWithContext("user-1", "Hello", messages, false);

    expect(result).toEqual(messages);
  });

  it("should return messages unchanged when Qdrant is not configured", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { augmentMessagesWithContext } = await import("../context");

    vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(null);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const result = await augmentMessagesWithContext("user-1", "Hello", messages, false);

    expect(result).toEqual(messages);
    expect(result).toHaveLength(1);
  });
});

describe("retrieveRelevantContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when Qdrant is not configured", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { retrieveRelevantContext } = await import("../context");

    vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(null);

    const result = await retrieveRelevantContext("user-1", "Hello");
    expect(result).toBeNull();
  });

  it("should return context string when relevant points found", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { retrieveRelevantContext } = await import("../context");

    const mockClient = {
      query: vi.fn().mockResolvedValue({
        points: [
          {
            score: 0.85,
            payload: { userId: "user-1", userMessage: "What is AI?", assistantMessage: "AI is..." },
          },
        ],
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const result = await retrieveRelevantContext("user-1", "What is AI?");
    expect(result).not.toBeNull();
    expect(result).toContain("What is AI?");
    expect(result).toContain("AI is...");
  });

  it("should return null when no points meet score threshold", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { retrieveRelevantContext } = await import("../context");

    const mockClient = {
      query: vi.fn().mockResolvedValue({
        points: [
          {
            score: 0.3,
            payload: { userId: "user-1", userMessage: "Hi", assistantMessage: "Hello!" },
          },
        ],
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const result = await retrieveRelevantContext("user-1", "Hi");
    expect(result).toBeNull();
  });

  it("should return null on Qdrant query error", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { retrieveRelevantContext } = await import("../context");

    const mockClient = {
      query: vi.fn().mockRejectedValue(new Error("Bad Request")),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const result = await retrieveRelevantContext("user-1", "Hello");
    expect(result).toBeNull();
  });

  it("should fall back to unfiltered query when filtered query fails", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { retrieveRelevantContext } = await import("../context");

    // First call (filtered) fails, second call (unfiltered) succeeds
    const mockQuery = vi.fn()
      .mockRejectedValueOnce(new Error("Bad Request"))
      .mockResolvedValueOnce({
        points: [
          {
            score: 0.85,
            payload: { userId: "user-1", userMessage: "Hello", assistantMessage: "Hi!" },
          },
        ],
      });

    const mockClient = { query: mockQuery };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const result = await retrieveRelevantContext("user-1", "Hello");
    expect(result).not.toBeNull();
    expect(result).toContain("Hello");
    expect(result).toContain("Hi!");
    // Should have tried both strategies
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("should filter unfiltered results by userId in-memory", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { retrieveRelevantContext } = await import("../context");

    const mockQuery = vi.fn()
      .mockRejectedValueOnce(new Error("Bad Request"))
      .mockResolvedValueOnce({
        points: [
          {
            score: 0.9,
            payload: { userId: "user-2", userMessage: "Other user Q", assistantMessage: "Other user A" },
          },
          {
            score: 0.85,
            payload: { userId: "user-1", userMessage: "My Q", assistantMessage: "My A" },
          },
        ],
      });

    const mockClient = { query: mockQuery };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const result = await retrieveRelevantContext("user-1", "Hello");
    expect(result).not.toBeNull();
    expect(result).toContain("My Q");
    expect(result).toContain("My A");
    expect(result).not.toContain("Other user");
  });

  it("should return null when unfiltered fallback also fails", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { retrieveRelevantContext } = await import("../context");

    const mockQuery = vi.fn()
      .mockRejectedValueOnce(new Error("Bad Request"))
      .mockRejectedValueOnce(new Error("Connection refused"));

    const mockClient = { query: mockQuery };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    const result = await retrieveRelevantContext("user-1", "Hello");
    expect(result).toBeNull();
  });
});

describe("storeConversationTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip storing when Qdrant is not configured", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { storeConversationTurn } = await import("../context");

    vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(null);

    await storeConversationTurn({
      userId: "user-1",
      conversationId: "conv-1",
      userMessage: "Hello",
      assistantMessage: "Hi!",
      model: "gpt-4.1",
      provider: "openai",
      timestamp: Date.now(),
    });

    expect(qdrantModule.getQdrantClient).toHaveBeenCalled();
  });

  it("should store when Qdrant is configured", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { storeConversationTurn } = await import("../context");

    const mockClient = {
      upsert: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    await storeConversationTurn({
      userId: "user-1",
      conversationId: "conv-1",
      userMessage: "Hello",
      assistantMessage: "Hi!",
      model: "gpt-4.1",
      provider: "openai",
      timestamp: Date.now(),
    });

    expect(mockClient.upsert).toHaveBeenCalled();
  });

  it("should handle upsert errors gracefully", async () => {
    const qdrantModule = await import("@/lib/vector/qdrant");
    const { storeConversationTurn } = await import("../context");

    const mockClient = {
      upsert: vi.fn().mockRejectedValue(new Error("Storage error")),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(qdrantModule.getQdrantClient).mockReturnValue(mockClient as any);

    await expect(
      storeConversationTurn({
        userId: "user-1",
        conversationId: "conv-1",
        userMessage: "Hello",
        assistantMessage: "Hi!",
        model: "gpt-4.1",
        provider: "openai",
        timestamp: Date.now(),
      }),
    ).resolves.toBeUndefined();
  });
});
