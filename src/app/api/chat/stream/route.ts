import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { eq, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { llmRegistry } from "@/lib/llm/registry";
import { insertInferenceLog } from "@/lib/db/inference";
import { requireAuth } from "@/lib/auth/api";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { z } from "zod";
import { augmentMessagesWithContext, storeConversationTurn } from "@/lib/vector/context";

const ChatRequestSchema = z.object({
  conversationId: z.string().nullish(),
  message: z.string().trim().min(1).max(10000),
  model: z.string().optional(),
  provider: z.string().optional(),
});

async function setupConversation(
  session: { user: { id: string } },
  conversationId: string | undefined,
  message: string,
  model: string,
  provider: string | undefined,
) {
  let convId = conversationId;

  if (!convId) {
    convId = uuid();
    await db.insert(schema.conversations).values({
      id: convId,
      userId: session.user.id,
      title: message.slice(0, 100),
      status: "active",
      model,
      provider: provider ?? llmRegistry.getDefault().name,
      messageCount: 0,
    });
  } else {
    const conv = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId))
      .limit(1);

    if (!conv.length) throw new Error("Conversation not found");
    if (conv[0].status !== "active") throw new Error("Conversation is not active");
  }

  await db.insert(schema.messages).values({
    id: uuid(),
    conversationId: convId,
    role: "user",
    content: message,
  });

  await db
    .update(schema.conversations)
    .set({
      messageCount: sql`${schema.conversations.messageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.conversations.id, convId));

  const prevMessages = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, convId))
    .orderBy(asc(schema.messages.createdAt))
    .limit(20);

  return {
    convId,
    llmMessages: prevMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  };
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, remaining } = rateLimit(getRateLimitKey(ip, "chat:stream"), { maxRequests: 20, windowMs: 60000 });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests", remaining }), { status: 429 });
    }

    const session = await requireAuth();
    const body = await req.json();

    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request", details: parsed.error.issues }), { status: 400 });
    }

    const { conversationId, message, model, provider } = parsed.data;

    const resolvedModel = model ?? llmRegistry.getDefaultModel(provider);
    const llmProvider = llmRegistry.get(provider ?? llmRegistry.getDefault().name);

    const { convId, llmMessages } = await setupConversation(
      session, conversationId, message, resolvedModel, provider,
    );

    const isFirstMessage = llmMessages.length <= 1;
    const augmentedMessages = await augmentMessagesWithContext(
      session.user.id, message, llmMessages, isFirstMessage,
    );

    let fullContent = "";
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const startTime = Date.now();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          const gen = llmProvider.generateStream({
            messages: augmentedMessages,
            model: resolvedModel,
            conversationId: convId,
            userId: session.user.id,
          });

          for await (const event of gen) {
            if (req.signal.aborted) break;

            if (event.type === "chunk") {
              fullContent += event.content;
              send(JSON.stringify({ type: "chunk", content: event.content }));
            } else if (event.type === "done") {
              usage = event.usage;
              send(JSON.stringify({ type: "done", usage: event.usage, conversationId: convId }));
            } else if (event.type === "error") {
              send(JSON.stringify({ type: "error", error: event.error }));
              controller.close();
              return;
            }
          }

          controller.close();

          const latency = Date.now() - startTime;

          const assistantMsgId = uuid();

          await db.insert(schema.messages).values({
            id: assistantMsgId,
            conversationId: convId,
            role: "assistant",
            content: fullContent,
          });

          await insertInferenceLog(
            { messages: llmMessages, model: resolvedModel, provider: llmProvider.name, conversationId: convId, userId: session.user.id },
            { content: fullContent, provider: llmProvider.name, model: resolvedModel, latencyMs: latency, usage, finishReason: "stop", id: assistantMsgId },
            { conversationId: convId, userId: session.user.id, messageId: assistantMsgId },
          );

          await db
            .update(schema.conversations)
            .set({
              messageCount: sql`${schema.conversations.messageCount} + 1`,
              totalTokens: sql`${schema.conversations.totalTokens} + ${usage.totalTokens}`,
              totalLatencyMs: sql`${schema.conversations.totalLatencyMs} + ${latency}`,
              updatedAt: new Date(),
            })
            .where(eq(schema.conversations.id, convId));

          await storeConversationTurn({
            userId: session.user.id,
            conversationId: convId,
            userMessage: message,
            assistantMessage: fullContent,
            model: resolvedModel,
            provider: llmProvider.name,
            timestamp: Date.now(),
          });
        } catch (error) {
          if (!req.signal.aborted) {
            send(JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Stream error" }));
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500 },
    );
  }
}
