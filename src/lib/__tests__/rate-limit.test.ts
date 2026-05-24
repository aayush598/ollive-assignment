import { describe, it, expect } from "vitest";
import { rateLimit, getRateLimitKey } from "../rate-limit";

describe("rateLimit", () => {
  it("should allow requests under the limit", async () => {
    const result = await rateLimit("test-1", { maxRequests: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("should block requests over the limit", async () => {
    const key = "test-block";
    for (let i = 0; i < 3; i++) {
      await rateLimit(key, { maxRequests: 3, windowMs: 60000 });
    }
    const result = await rateLimit(key, { maxRequests: 3, windowMs: 60000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track remaining count", async () => {
    const key = "test-remaining";
    await rateLimit(key, { maxRequests: 10, windowMs: 60000 });
    const result = await rateLimit(key, { maxRequests: 10, windowMs: 60000 });
    expect(result.remaining).toBe(8);
  });

  it("should generate unique keys per IP and path", () => {
    const key1 = getRateLimitKey("127.0.0.1", "/api/chat");
    const key2 = getRateLimitKey("127.0.0.2", "/api/chat");
    const key3 = getRateLimitKey("127.0.0.1", "/api/ingest");
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });
});
