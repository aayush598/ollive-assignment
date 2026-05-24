import { describe, it, expect, beforeEach, vi } from "vitest";

describe("useChatStore", () => {
  let store: typeof import("../chat-store");

  beforeEach(async () => {
    vi.resetModules();
    store = await import("../chat-store");
  });

  it("should start with default state", () => {
    const state = store.useChatStore.getState();
    expect(state.conversations).toEqual([]);
    expect(state.currentConversationId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
    expect(state.streamingContent).toBe("");
    expect(state.error).toBeNull();
  });

  it("should add messages", () => {
    const { addMessage } = store.useChatStore.getState();
    addMessage({ id: "1", role: "user", content: "Hello" });
    addMessage({ id: "2", role: "assistant", content: "Hi!" });

    const messages = store.useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ id: "1", role: "user", content: "Hello" });
    expect(messages[1]).toEqual({ id: "2", role: "assistant", content: "Hi!" });
  });

  it("should append content to last message", () => {
    const store_mod = store;
    store_mod.useChatStore.getState().addMessage({ id: "1", role: "assistant", content: "Hello" });
    store_mod.useChatStore.getState().appendToLastMessage(" World");

    const messages = store_mod.useChatStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello World");
  });

  it("should not fail appending to empty messages", () => {
    store.useChatStore.getState().appendToLastMessage("content");
    expect(store.useChatStore.getState().messages).toEqual([]);
  });

  it("should set streaming content", () => {
    store.useChatStore.getState().setStreamingContent("partial");
    expect(store.useChatStore.getState().streamingContent).toBe("partial");

    store.useChatStore.getState().appendToStreamingContent(" response");
    expect(store.useChatStore.getState().streamingContent).toBe("partial response");
  });

  it("should set and clear error", () => {
    store.useChatStore.getState().setError("Something went wrong");
    expect(store.useChatStore.getState().error).toBe("Something went wrong");

    store.useChatStore.getState().setError(null);
    expect(store.useChatStore.getState().error).toBeNull();
  });

  it("should set current conversation", () => {
    store.useChatStore.getState().setCurrentConversation("conv-1");
    expect(store.useChatStore.getState().currentConversationId).toBe("conv-1");

    store.useChatStore.getState().setCurrentConversation(null);
    expect(store.useChatStore.getState().currentConversationId).toBeNull();
  });

  it("should set messages array", () => {
    const msgs = [{ id: "1", role: "user" as const, content: "Hi" }];
    store.useChatStore.getState().setMessages(msgs);
    expect(store.useChatStore.getState().messages).toEqual(msgs);
  });

  it("should set conversations", () => {
    const convs = [{
      id: "conv-1",
      title: "Test",
      status: "active" as const,
      model: "gpt-4.1",
      provider: "openai",
      messageCount: 2,
      totalTokens: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
    store.useChatStore.getState().setConversations(convs);
    expect(store.useChatStore.getState().conversations).toEqual(convs);
  });

  it("should set isStreaming", () => {
    store.useChatStore.getState().setIsStreaming(true);
    expect(store.useChatStore.getState().isStreaming).toBe(true);

    store.useChatStore.getState().setIsStreaming(false);
    expect(store.useChatStore.getState().isStreaming).toBe(false);
  });

  it("should reset to initial state", () => {
    store.useChatStore.getState().addMessage({ id: "1", role: "user", content: "Hi" });
    store.useChatStore.getState().setCurrentConversation("conv-1");
    store.useChatStore.getState().setStreamingContent("typing");
    store.useChatStore.getState().setError("err");
    store.useChatStore.getState().setIsStreaming(true);

    store.useChatStore.getState().reset();

    const state = store.useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.currentConversationId).toBeNull();
    expect(state.streamingContent).toBe("");
    expect(state.error).toBeNull();
    expect(state.isStreaming).toBe(false);
  });
});
