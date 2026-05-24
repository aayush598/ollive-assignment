import { describe, it, expect, vi } from "vitest";

describe("IngestionEventEmitter", () => {
  it("should emit and receive log:ingested events", async () => {
    const { ingestionEvents } = await import("../events");
    const callback = vi.fn();

    const unsubscribe = ingestionEvents.onLogIngested(callback);
    ingestionEvents.emitLogIngested({
      id: "log-1",
      provider: "openai",
      model: "gpt-4.1",
      status: "success",
      latencyMs: 500,
      totalTokens: 30,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "log-1",
        provider: "openai",
        status: "success",
      }),
    );
    unsubscribe();
  });

  it("should not call callback after unsubscribe", async () => {
    const { ingestionEvents } = await import("../events");
    const callback = vi.fn();

    const unsubscribe = ingestionEvents.onLogIngested(callback);
    unsubscribe();

    ingestionEvents.emitLogIngested({
      id: "log-2",
      provider: "anthropic",
      model: "claude-3",
      status: "error",
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("should handle null latencyMs and totalTokens", async () => {
    const { ingestionEvents } = await import("../events");
    const callback = vi.fn();

    ingestionEvents.onLogIngested(callback);
    ingestionEvents.emitLogIngested({
      id: "log-3",
      provider: "gemini",
      model: "gemini-pro",
      status: "cancelled",
      latencyMs: null,
      totalTokens: null,
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        latencyMs: null,
        totalTokens: null,
      }),
    );
  });

  it("should return singleton instance", async () => {
    const { ingestionEvents } = await import("../events");
    const { ingestionEvents: ingestionEventsAgain } = await import("../events");
    expect(ingestionEvents).toBe(ingestionEventsAgain);
  });
});
