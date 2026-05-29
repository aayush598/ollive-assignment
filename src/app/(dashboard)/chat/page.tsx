"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useChatStore } from "@/store/chat-store";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";

interface AvailableModel {
  provider: string;
  model: string;
  label: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
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
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
      return;
    }

    async function loadModels() {
      try {
        const res = await fetch("/api/models");
        if (res.ok) {
          const data = await res.json();
          setAvailableModels(data.models);
          if (data.models.length > 0 && !selectedModel) {
            const defaultModel = data.models.find(
              (m: AvailableModel) => m.model === "meta/llama-3.1-70b-instruct",
            );
            setSelectedModel(defaultModel?.model ?? data.models[0].model);
          }
        }
      } catch {
        // fallback
      } finally {
        setModelsLoading(false);
      }
    }

    if (isSignedIn) {
      loadModels();
    }
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
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
        <div className="flex items-center justify-between py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">Chat</h1>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-xs text-slate-400 font-medium">AI Ops TaskFlow</span>
          </div>
          <div className="flex items-center gap-3">
            {modelsLoading ? (
              <div className="h-9 w-48 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white min-w-[200px] text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-indigo-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Start a conversation</h2>
              <p className="text-slate-500 max-w-md mx-auto text-sm">
                {hasModels
                  ? "Choose a model below and start chatting with AI."
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
                    ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-800 shadow-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="text-sm prose prose-sm max-w-none prose-headings:text-slate-800 prose-a:text-indigo-600">
                    <Markdown content={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white border border-slate-200 text-slate-800 shadow-sm">
                {streamingContent ? (
                  <>
                    <div className="text-sm prose prose-sm max-w-none">
                      <Markdown content={streamingContent} />
                    </div>
                    <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 rounded-sm" />
                  </>
                ) : (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex gap-1.5">
                      <span
                        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                    <span className="text-sm text-slate-500 font-medium">
                      Generating response...
                    </span>
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

        <div className="border-t border-slate-200 py-4">
          <form onSubmit={handleSend} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 transition-shadow duration-200"
                disabled={isStreaming || !hasModels}
              />
            </div>
            {isStreaming ? (
              <Button type="button" variant="danger" onClick={cancel}>
                Stop
              </Button>
            ) : (
              <Button type="submit" variant="brand" disabled={!input.trim() || !hasModels}>
                Send
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
