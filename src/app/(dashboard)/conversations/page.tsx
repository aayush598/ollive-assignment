"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useChatStore } from "@/store/chat-store";
import type { Conversation } from "@/store/chat-store";

const PAGE_SIZE = 20;

export default function ConversationsPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const { setMessages, setCurrentConversation } = useChatStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  const loadConversations = useCallback(async (cursor?: string | null) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setConversations((prev) => [...prev, ...data.conversations]);
        } else {
          setConversations(data.conversations);
        }
        setHasMore(data.pagination.hasMore);
        setNextCursor(data.pagination.nextCursor);
        setTotal(data.pagination.total);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadConversations();
    }
  }, [isSignedIn, loadConversations]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor) {
          loadConversations(nextCursor);
        }
      },
      { threshold: 0.1 },
    );

    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [hasMore, loadingMore, nextCursor, loadConversations]);

  async function handleCancel(id: string) {
    await fetch(`/api/conversations/${id}/cancel`, { method: "POST" });
    loadConversations();
  }

  async function handleResume(id: string) {
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(
        data.messages.map(
          (m: { id: string; role: string; content: string; createdAt: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            createdAt: m.createdAt,
          }),
        ),
      );
      setCurrentConversation(id);
      router.push("/chat");
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      cancelled: "bg-slate-50 text-slate-600 border border-slate-200",
      completed: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    };
    return styles[status] ?? "bg-slate-50 text-slate-600 border border-slate-200";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Conversations{" "}
            {total > 0 && <span className="text-slate-400 font-normal">({total})</span>}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Browse and resume your past conversations</p>
        </div>
        <Button variant="brand" onClick={() => router.push("/chat")}>
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </Button>
      </div>

      {/* Stats summary */}
      {conversations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Total",
              value: total,
              color: "bg-indigo-50 text-indigo-700 border-indigo-200",
            },
            {
              label: "Active",
              value: conversations.filter((c) => c.status === "active").length,
              color: "bg-emerald-50 text-emerald-700 border-emerald-200",
            },
            {
              label: "Messages",
              value: conversations.reduce((s, c) => s + (c.messageCount || 0), 0),
              color: "bg-violet-50 text-violet-700 border-violet-200",
            },
            {
              label: "Tokens Used",
              value: conversations.reduce((s, c) => s + (c.totalTokens || 0), 0).toLocaleString(),
              color: "bg-amber-50 text-amber-700 border-amber-200",
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border ${s.color} p-3 text-center`}>
              <p className="font-mono-alt text-lg font-bold">{s.value}</p>
              <p className="text-[10px] font-mono-alt uppercase tracking-wider opacity-70">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {conversations.length === 0 ? (
        <Card variant="brand">
          <CardContent>
            <div className="text-center py-12">
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
              <h2 className="text-lg font-semibold text-slate-900 mb-2">No conversations yet</h2>
              <p className="text-slate-500 mb-6 text-sm">
                Start a chat to see your conversations here.
              </p>
              <Button variant="brand" onClick={() => router.push("/chat")}>
                Start Chatting
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {conversations.map((conv) => (
              <Card key={conv.id} variant="brand">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-medium text-slate-900 truncate">{conv.title}</h3>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${getStatusBadge(conv.status)}`}
                      >
                        {conv.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {conv.messageCount} messages
                      {conv.totalTokens ? ` · ${conv.totalTokens.toLocaleString()} tokens` : ""}
                      {conv.model ? ` · ${conv.model}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {conv.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => handleCancel(conv.id)}>
                        Cancel
                      </Button>
                    )}
                    {conv.status !== "active" && (
                      <Button variant="ghost" size="sm" onClick={() => handleResume(conv.id)}>
                        Resume
                      </Button>
                    )}
                    <Button variant="primary" size="sm" onClick={() => handleResume(conv.id)}>
                      Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div ref={sentinelRef} className="py-4">
            {loadingMore && (
              <div className="flex justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
              </div>
            )}
            {!hasMore && conversations.length > 0 && (
              <p className="text-center text-sm text-slate-400">
                Showing all {total} conversations
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
