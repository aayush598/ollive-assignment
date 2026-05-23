"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat-store";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { authClient } from "@/lib/auth/client";

interface AvailableModel {
  provider: string;
  model: string;
  label: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    streamingContent,
    error,
    currentConversationId,
    addMessage,
    setCurrentConversation,
    setMessages,
    setStreamingContent,
    setError,
  } = useChatStore();

  const { sendMessage, cancel, isStreaming } = useStreamChat();

  useEffect(() => {
    async function loadModels() {
      try {
        const session = await authClient.getSession();
        if (!session.data) {
          router.push("/login");
          return;
        }
        const res = await fetch("/api/models");
        if (res.ok) {
          const data = await res.json();
          setAvailableModels(data.models);
          if (data.models.length > 0 && !selectedModel) {
            setSelectedModel(data.models[0].model);
          }
        }
      } catch {
        // fallback
      } finally {
        setModelsLoading(false);
      }
    }
    loadModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function getProviderForModel(model: string): string | undefined {
    return availableModels.find((m) => m.model === model)?.provider;
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");

    addMessage({
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
    });

    const provider = getProviderForModel(selectedModel);

    sendMessage("/api/chat/stream", {
      conversationId: currentConversationId,
      message: userMessage,
      model: selectedModel,
      provider,
    });
  }

  function startNewChat() {
    setMessages([]);
    setCurrentConversation(null);
    setStreamingContent("");
    setError(null);
  }

  const hasModels = availableModels.length > 0;
  const groupedModels = availableModels.reduce(
    (acc, m) => {
      if (!acc[m.provider]) acc[m.provider] = [];
      acc[m.provider].push(m);
      return acc;
    },
    {} as Record<string, AvailableModel[]>,
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4">
        <div className="flex items-center justify-between py-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold">Chat</h1>
          <div className="flex items-center gap-3">
            {modelsLoading ? (
              <div className="h-9 w-48 bg-gray-200 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white min-w-[200px]"
                disabled={!hasModels}
              >
                {!hasModels && <option value="">No models available</option>}
                {Object.entries(groupedModels).map(([provider, models]) => (
                  <optgroup key={provider} label={provider}>
                    {models.map((m) => (
                      <option key={m.model} value={m.model}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            <Button variant="ghost" size="sm" onClick={startNewChat}>
              + New Chat
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">🤖</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                {hasModels
                  ? "Choose a model and start chatting."
                  : "No LLM providers configured. Add API keys to your .env file."}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="text-sm prose prose-sm max-w-none">
                    <Markdown content={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-900">
                {streamingContent ? (
                  <>
                    <div className="text-sm prose prose-sm max-w-none">
                      <Markdown content={streamingContent} />
                    </div>
                    <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
                  </>
                ) : (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm text-gray-500 font-medium">Generating response...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 py-4">
          <form onSubmit={handleSend} className="flex gap-3 items-end">
            <div className="flex-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                disabled={isStreaming || !hasModels}
              />
            </div>
            {isStreaming ? (
              <Button type="button" variant="danger" onClick={cancel}>
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim() || !hasModels}>
                Send
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
