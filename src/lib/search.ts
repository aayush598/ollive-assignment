// Typesense search integration.
// Uses Typesense when available (Docker/K8s).
// Falls back to basic DB search on Vercel.

import { db, schema } from "./db";
import { eq, like, and } from "drizzle-orm";

interface SearchResult {
  id: string;
  type: "conversation" | "message";
  title?: string;
  content?: string;
  score: number;
}

let searchClient: {
  collections: (name: string) => {
    documents: () => {
      search: (
        params: Record<string, unknown>,
      ) => Promise<{ hits?: Array<{ document: Record<string, unknown>; text_match?: number }> }>;
      upsert: (doc: Record<string, unknown>) => Promise<void>;
      del: (id: string) => Promise<void>;
    };
    retrieve: () => Promise<unknown>;
  };
} | null = null;

async function getSearchClient() {
  if (searchClient) return searchClient;
  const apiKey = process.env.TYPESENSE_API_KEY || "xyz";
  const host = process.env.TYPESENSE_HOST || "localhost";
  const port = process.env.TYPESENSE_PORT || "8108";
  const protocol = process.env.TYPESENSE_PROTOCOL || "http";
  if (!apiKey) return null;

  try {
    const Typesense = (await import("typesense")).default;
    const client = new Typesense.Client({
      nodes: [{ host, port: Number(port), protocol }],
      apiKey,
      connectionTimeoutSeconds: 2,
    }) as never;
    searchClient = client as never;
    return searchClient;
  } catch {
    return null;
  }
}

async function ensureCollections() {
  const client = await getSearchClient();
  if (!client) return;

  const collections = [
    {
      name: "conversations",
      fields: [
        { name: "id", type: "string" as const },
        { name: "title", type: "string" as const },
        { name: "userId", type: "string" as const, facet: true },
        { name: "status", type: "string" as const, facet: true },
        { name: "createdAt", type: "int64" as const },
      ],
      default_sorting_field: "createdAt",
    },
    {
      name: "messages",
      fields: [
        { name: "id", type: "string" as const },
        { name: "content", type: "string" as const },
        { name: "conversationId", type: "string" as const, facet: true },
        { name: "role", type: "string" as const, facet: true },
        { name: "createdAt", type: "int64" as const },
      ],
      default_sorting_field: "createdAt",
    },
  ];

  for (const schema of collections) {
    try {
      const col = client.collections(schema.name);
      await col.retrieve();
    } catch {
      try {
        await (
          client as unknown as { collections: () => { create: (s: unknown) => Promise<void> } }
        )
          .collections()
          .create(schema);
      } catch {
        // Collection already exists or typesense unavailable
      }
    }
  }
}

export async function indexConversation(conversation: {
  id: string;
  title: string;
  userId: string;
  status: string;
  createdAt: Date;
}) {
  const client = await getSearchClient();
  if (!client) return;
  await ensureCollections();

  try {
    await client
      .collections("conversations")
      .documents()
      .upsert({
        id: conversation.id,
        title: conversation.title,
        userId: conversation.userId,
        status: conversation.status,
        createdAt: Math.floor(conversation.createdAt.getTime() / 1000),
      });
  } catch {
    // Search indexing best-effort
  }
}

export async function indexMessage(message: {
  id: string;
  content: string;
  conversationId: string;
  role: string;
  createdAt: Date;
}) {
  const client = await getSearchClient();
  if (!client) return;
  await ensureCollections();

  try {
    await client
      .collections("messages")
      .documents()
      .upsert({
        id: message.id,
        content: message.content,
        conversationId: message.conversationId,
        role: message.role,
        createdAt: Math.floor(message.createdAt.getTime() / 1000),
      });
  } catch {
    // Search indexing best-effort
  }
}

export async function search(query: string, userId: string): Promise<SearchResult[]> {
  const client = await getSearchClient();
  if (client) {
    await ensureCollections();
    try {
      const convResults = await client
        .collections("conversations")
        .documents()
        .search({
          q: query,
          query_by: "title",
          filter_by: `userId:=${userId}`,
          per_page: 5,
        });

      const msgResults = await client.collections("messages").documents().search({
        q: query,
        query_by: "content",
        per_page: 5,
      });

      const results: SearchResult[] = [];

      for (const hit of convResults.hits || []) {
        results.push({
          id: hit.document.id as string,
          type: "conversation",
          title: hit.document.title as string,
          score: hit.text_match ?? 0,
        });
      }

      for (const hit of msgResults.hits || []) {
        results.push({
          id: hit.document.id as string,
          type: "message",
          content: (hit.document.content as string)?.slice(0, 200),
          score: hit.text_match ?? 0,
        });
      }

      return results.sort((a, b) => b.score - a.score);
    } catch {
      // Search unavailable, fallback to DB
    }
  }

  // Fallback: basic DB LIKE search
  const convResults = await db
    .select({ id: schema.conversations.id, title: schema.conversations.title })
    .from(schema.conversations)
    .where(
      and(eq(schema.conversations.userId, userId), like(schema.conversations.title, `%${query}%`)),
    )
    .limit(5);

  const msgResults = await db
    .select({ id: schema.messages.id, content: schema.messages.content })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.messages.conversationId, schema.conversations.id))
    .where(
      and(eq(schema.conversations.userId, userId), like(schema.messages.content, `%${query}%`)),
    )
    .limit(5);

  return [
    ...convResults.map((r: { id: string; title: string | null }) => ({
      id: r.id,
      type: "conversation" as const,
      title: r.title || undefined,
      score: 1,
    })),
    ...msgResults.map((r: { id: string; content: string | null }) => ({
      id: r.id,
      type: "message" as const,
      content: r.content?.slice(0, 200),
      score: 1,
    })),
  ];
}
