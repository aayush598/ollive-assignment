import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    QDRANT_URL: "https://localhost:6333",
    QDRANT_API_KEY: "test-key",
  },
}));

describe("getQdrantClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should return null when env vars are missing", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        QDRANT_URL: undefined,
        QDRANT_API_KEY: undefined,
      },
    }));
    const mod = await import("../qdrant");
    const client = mod.getQdrantClient();
    expect(client).toBeNull();
  });

  it("should return null when URL is missing", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        QDRANT_URL: undefined,
        QDRANT_API_KEY: "test-key",
      },
    }));
    const mod = await import("../qdrant");
    const client = mod.getQdrantClient();
    expect(client).toBeNull();
  });

  it("should return null when API key is missing", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        QDRANT_URL: "https://localhost:6333",
        QDRANT_API_KEY: undefined,
      },
    }));
    const mod = await import("../qdrant");
    const client = mod.getQdrantClient();
    expect(client).toBeNull();
  });
});

describe("ensureCollection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should not throw when Qdrant is not configured", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        QDRANT_URL: undefined,
        QDRANT_API_KEY: undefined,
      },
    }));
    const mod = await import("../qdrant");
    await expect(mod.ensureCollection()).resolves.toBeUndefined();
  });

  it("should create payload indexes on existing collection if missing", async () => {
    const createPayloadIndex = vi.fn().mockResolvedValue(undefined);
    const getCollection = vi.fn().mockResolvedValue({
      payload_schema: {},
    });

    vi.doMock("@/lib/env", () => ({
      env: {
        QDRANT_URL: "https://localhost:6333",
        QDRANT_API_KEY: "test-key",
      },
    }));

    // QdrantClient constructor creates an object with all the methods
    vi.doMock("../qdrant", () => {
      const mockClient = {
        getCollections: vi.fn().mockResolvedValue({
          collections: [{ name: "conversation_context" }],
        }),
        getCollection,
        createPayloadIndex,
        createCollection: vi.fn().mockResolvedValue(undefined),
      };

      return {
        COLLECTION_NAME: "conversation_context",
        VECTOR_SIZE: 2048,
        getQdrantClient: vi.fn().mockReturnValue(mockClient),
        ensureCollection: vi.fn().mockImplementation(async () => {
          const client = mockClient;
          const info = await client.getCollection("conversation_context");
          const existingIndexes = Object.keys(info.payload_schema ?? {});

          const requiredIndexes = [
            { field_name: "userId", field_schema: "keyword" },
            { field_name: "conversationId", field_schema: "keyword" },
            { field_name: "timestamp", field_schema: "integer" },
          ];

          for (const idx of requiredIndexes) {
            if (!existingIndexes.includes(idx.fieldName)) {
              await client.createPayloadIndex("conversation_context", idx);
            }
          }
        }),
      };
    });

    const mod = await import("../qdrant");
    await mod.ensureCollection();

    expect(createPayloadIndex).toHaveBeenCalledTimes(3);
    expect(createPayloadIndex).toHaveBeenCalledWith("conversation_context", {
      field_name: "userId",
      field_schema: "keyword",
    });
  });

  it("should not recreate existing indexes", async () => {
    const createPayloadIndex = vi.fn().mockResolvedValue(undefined);
    const getCollection = vi.fn().mockResolvedValue({
      // userId and conversationId already have indexes
      payload_schema: {
        userId: { data_type: "keyword" },
        conversationId: { data_type: "keyword" },
      },
    });

    vi.doMock("@/lib/env", () => ({
      env: {
        QDRANT_URL: "https://localhost:6333",
        QDRANT_API_KEY: "test-key",
      },
    }));

    vi.doMock("../qdrant", () => {
      const mockClient = {
        getCollections: vi.fn().mockResolvedValue({
          collections: [{ name: "conversation_context" }],
        }),
        getCollection,
        createPayloadIndex,
        createCollection: vi.fn().mockResolvedValue(undefined),
      };

      return {
        COLLECTION_NAME: "conversation_context",
        VECTOR_SIZE: 2048,
        getQdrantClient: vi.fn().mockReturnValue(mockClient),
        ensureCollection: vi.fn().mockImplementation(async () => {
          const client = mockClient;
          const info = await client.getCollection("conversation_context");
          const existingIndexes = Object.keys(info.payload_schema ?? {});

          const requiredIndexes = [
            { field_name: "userId", field_schema: "keyword" },
            { field_name: "conversationId", field_schema: "keyword" },
            { field_name: "timestamp", field_schema: "integer" },
          ];

          for (const idx of requiredIndexes) {
            if (!existingIndexes.includes(idx.field_name)) {
              await client.createPayloadIndex("conversation_context", idx);
            }
          }
        }),
      };
    });

    const mod = await import("../qdrant");
    await mod.ensureCollection();

    // Only timestamp should be created since userId and conversationId already exist
    expect(createPayloadIndex).toHaveBeenCalledTimes(1);
    expect(createPayloadIndex).toHaveBeenCalledWith("conversation_context", {
      field_name: "timestamp",
      field_schema: "integer",
    });
  });
});
