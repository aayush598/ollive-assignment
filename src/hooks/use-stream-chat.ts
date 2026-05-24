"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore } from "@/store/chat-store";

export function useStreamChat() {
  const [isStreaming, setIsStreamingLocal] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fullContentRef = useRef("");

  const { addMessage, setStreamingContent, setCurrentConversation, setError } = useChatStore();

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    async (endpoint: string, body: Record<string, unknown>) => {
      if (isStreaming) return;

      setIsStreamingLocal(true);
      fullContentRef.current = "";
      setStreamingContent("");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(trimmed.slice(6));

              if (event.type === "chunk") {
                fullContentRef.current += event.content;
                setStreamingContent(fullContentRef.current);
              } else if (event.type === "done") {
                addMessage({
                  id: Date.now().toString(),
                  role: "assistant",
                  content: fullContentRef.current,
                });
                setStreamingContent("");
                if (event.conversationId) {
                  setCurrentConversation(event.conversationId);
                }
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setIsStreamingLocal(false);
        abortRef.current = null;
      }
    },
    [isStreaming, addMessage, setStreamingContent, setCurrentConversation, setError],
  );

  return {
    sendMessage,
    cancel,
    isStreaming,
  };
}
