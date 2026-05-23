"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useChatStore } from "@/store/chat-store";
import type { Conversation } from "@/store/chat-store";

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { setMessages, setCurrentConversation } = useChatStore();

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    try {
      const session = await authClient.getSession();
      if (!session.data) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    await fetch(`/api/conversations/${id}/cancel`, { method: "POST" });
    loadConversations();
  }

  async function handleResume(id: string) {
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(
        data.messages.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt,
        })),
      );
      setCurrentConversation(id);
      router.push("/chat");
    }
  }

  function getStatusBadge(status: string) {
    const styles = {
      active: "bg-green-100 text-green-700",
      cancelled: "bg-gray-100 text-gray-600",
      completed: "bg-blue-100 text-blue-700",
    };
    return styles[status as keyof typeof styles] ?? "bg-gray-100 text-gray-600";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <Button onClick={() => router.push("/chat")}>+ New Chat</Button>
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                No conversations yet
              </h2>
              <p className="text-gray-500 mb-4">
                Start a chat to see your conversations here.
              </p>
              <Button onClick={() => router.push("/chat")}>Start Chatting</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <Card key={conv.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {conv.title}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(conv.status)}`}
                    >
                      {conv.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {conv.messageCount} messages
                    {conv.totalTokens ? ` · ${conv.totalTokens} tokens` : ""}
                    {conv.model ? ` · ${conv.model}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conv.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(conv.id)}
                    >
                      Cancel
                    </Button>
                  )}
                  {conv.status !== "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResume(conv.id)}
                    >
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleResume(conv.id)}
                  >
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
