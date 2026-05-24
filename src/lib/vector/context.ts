import { v4 as uuid } from "uuid";
import { getQdrantClient, COLLECTION_NAME } from "./qdrant";
import { generateEmbedding } from "./embeddings";
import type { LLMMessage } from "../llm/types";

const CONTEXT_LIMIT = 3;
const SCORE_THRESHOLD = 0.5;

export interface ContextEntry {
  userId: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  model: string;
  provider: string;
  timestamp: number;
}

export async function storeConversationTurn(entry: ContextEntry): Promise<void> {
  const client = getQdrantClient();
  if (!client) {
    // Qdrant not configured, skip storing context
    return;
  }

  try {
    const vector = await generateEmbedding(entry.userMessage);
    await client.upsert(COLLECTION_NAME, {
      points: [
        {
          id: uuid(),
          vector,
          payload: {
            userId: entry.userId,
            conversationId: entry.conversationId,
            userMessage: entry.userMessage,
            assistantMessage: entry.assistantMessage,
            model: entry.model,
            provider: entry.provider,
            timestamp: entry.timestamp,
          },
        },
      ],
    });
  } catch (error) {
    console.debug("[context] Failed to store conversation turn:", error);
  }
}

function formatContextSections(
  points: Array<{ score?: number; payload?: Record<string, unknown> | null }>,
): string | null {
  const sections = points.map((p) => {
    const payload = p.payload ?? {};
    return `User: ${payload.userMessage ?? "?"}\nAssistant: ${payload.assistantMessage ?? "?"}`;
  });
  return `Here is relevant context from past conversations:\n---\n${sections.join("\n---\n")}`;
}

export async function retrieveRelevantContext(
  userId: string,
  message: string,
): Promise<string | null> {
  const client = getQdrantClient();
  if (!client) {
    // Qdrant not configured, return null to indicate no context available
    return null;
  }

  try {
    const vector = await generateEmbedding(message);

    // Strategy 1: query with userId filter (requires payload index)
    try {
      const result = await client.query(COLLECTION_NAME, {
        query: vector,
        filter: {
          must: [{ key: "userId", match: { value: userId } }],
        },
        with_payload: true,
        limit: CONTEXT_LIMIT,
      });

      const relevant = result.points.filter((p) => (p.score ?? 0) >= SCORE_THRESHOLD);
      if (relevant.length === 0) return null;
      return formatContextSections(relevant);
    } catch {
      // Strategy 2: fall back to unfiltered query, then filter by userId in-memory
      // This handles the case where the userId index hasn't been created yet
      console.debug("[context] Filtered query unavailable, falling back to in-memory filter");
    }

    try {
      const result = await client.query(COLLECTION_NAME, {
        query: vector,
        with_payload: true,
        limit: CONTEXT_LIMIT * 5,
      });

      const userPoints = result.points
        .filter((p) => p.payload?.userId === userId && (p.score ?? 0) >= SCORE_THRESHOLD)
        .slice(0, CONTEXT_LIMIT);

      if (userPoints.length === 0) return null;
      return formatContextSections(userPoints);
    } catch (error) {
      console.debug(
        "[context] Qdrant query failed:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  } catch (error) {
    console.debug(
      "[context] Failed to retrieve context:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function augmentMessagesWithContext(
  userId: string,
  message: string,
  messages: LLMMessage[],
  isFirstMessage?: boolean,
): Promise<LLMMessage[]> {
  // Skip context retrieval for first message in a conversation since there's
  // no prior context to retrieve; we only store after the response comes back
  if (!isFirstMessage) {
    const context = await retrieveRelevantContext(userId, message);
    if (context) {
      return [{ role: "system", content: context }, ...messages];
    }
  }

  return messages;
}
