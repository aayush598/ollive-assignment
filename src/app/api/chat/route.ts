import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed } = await rateLimit(getRateLimitKey(ip, "chat"), {
      maxRequests: 30,
      windowMs: 60000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await requireAuth();
    const body = await req.json();

    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { conversationId, message, model, provider } = parsed.data;

    let convId = conversationId;

    if (!convId) {
      convId = uuid();
      await db.insert(schema.conversations).values({
        id: convId,
        userId: session.user.id,
        title: message.slice(0, 100),
        status: "active",
        model: model ?? llmRegistry.getDefaultModel(provider),
        provider: provider ?? llmRegistry.getDefault().name,
        messageCount: 0,
      });
    } else {
      const conv = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, convId))
        .limit(1);

      if (!conv.length) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      if (conv[0].status !== "active") {
        return NextResponse.json({ error: "Conversation is not active" }, { status: 400 });
      }
    }

    const messageId = uuid();
    await db.insert(schema.messages).values({
      id: messageId,
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

    const llmMessages = prevMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const llmProvider = llmRegistry.get(provider ?? llmRegistry.getDefault().name);
    const llmModel = model ?? llmRegistry.getDefaultModel(provider);

    const isFirstMessage = llmMessages.length <= 1;
    const augmentedMessages = await augmentMessagesWithContext(
      session.user.id,
      message,
      llmMessages,
      isFirstMessage,
    );

    const response = await llmProvider.generate({
      messages: augmentedMessages,
      model: llmModel,
      conversationId: convId,
      userId: session.user.id,
    });

    const assistantMsgId = uuid();
    await db.insert(schema.messages).values({
      id: assistantMsgId,
      conversationId: convId,
      role: "assistant",
      content: response.content,
    });

    await db
      .update(schema.conversations)
      .set({
        messageCount: sql`${schema.conversations.messageCount} + 1`,
        totalTokens: sql`${schema.conversations.totalTokens} + ${response.usage.totalTokens}`,
        totalLatencyMs: sql`${schema.conversations.totalLatencyMs} + ${response.latencyMs}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.conversations.id, convId));

    await insertInferenceLog(
      {
        messages: llmMessages,
        model: llmModel,
        provider: llmProvider.name,
        conversationId: convId,
        userId: session.user.id,
      },
      response,
      { conversationId: convId, userId: session.user.id, messageId: assistantMsgId },
    );

    await storeConversationTurn({
      userId: session.user.id,
      conversationId: convId,
      userMessage: message,
      assistantMessage: response.content,
      model: llmModel,
      provider: llmProvider.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      conversationId: convId,
      messageId: assistantMsgId,
      content: response.content,
      usage: response.usage,
      latencyMs: response.latencyMs,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
