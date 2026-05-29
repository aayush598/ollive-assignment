#!/usr/bin/env tsx
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { nanoid } from "nanoid";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema, casing: "snake_case" });

const PROVIDERS = ["openai", "anthropic", "gemini", "deepseek", "nvidia"] as const;
const MODELS: Record<string, string[]> = {
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"],
  anthropic: ["claude-sonnet-4-20250514"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  nvidia: ["meta/llama-3.1-70b-instruct"],
};

const TOPICS = [
  { title: "Debugging API integration", msgs: 5, tokens: 850, latency: 3200 },
  { title: "Architecture review feedback", msgs: 12, tokens: 2400, latency: 8900 },
  { title: "Database migration planning", msgs: 8, tokens: 1600, latency: 5400 },
  { title: "Code review: authentication flow", msgs: 3, tokens: 420, latency: 1800 },
  { title: "Performance optimization tips", msgs: 15, tokens: 3200, latency: 12000 },
];

const USER_MESSAGES = [
  "Can you help me debug this API timeout issue?",
  "What's the best approach for schema design?",
  "How would you handle rate limiting in production?",
  "Can you review this authentication middleware?",
  "What are the tradeoffs between SQL and NoSQL?",
  "How do I implement cursor-based pagination?",
  "Explain the CAP theorem in simple terms.",
  "What's the difference between REST and GraphQL?",
  "How do you handle database migrations safely?",
  "What's the best logging strategy for microservices?",
  "Can you show me how to implement PII redaction?",
  "What's the recommended way to handle LLM streaming?",
  "How do you test async code properly?",
  "What are the key metrics for API performance?",
  "How would you design a multi-tenant database?",
];

const ASSISTANT_MESSAGES = [
  "Let me look into that API timeout issue. First, check your connection pool settings — if you're using the default pool size of 10 with 20 concurrent requests, you'll see queuing delays. I'd recommend setting `max: 25` and adding a 30-second timeout. Also, ensure you're using connection pooling correctly with your ORM...",
  "For schema design, I recommend starting with a clear entity relationship model. Use UUIDs or nanoids for primary keys — they're safer for distributed systems. Normalize to 3NF initially, then denormalize strategically for read-heavy paths. Add indexes on foreign keys and frequently queried columns...",
  "Rate limiting should be implemented at multiple layers: a reverse proxy (Nginx/Caddy) for IP-based limiting, application-level token bucket for authenticated users, and a per-endpoint strategy for sensitive routes like auth and ingestion. Store counters in Redis for distributed consistency...",
  "Your auth middleware looks good overall, but I'd add a few improvements: (1) Cache session lookups to reduce DB pressure, (2) Implement a refresh mechanism for expiring tokens, (3) Add rate limiting specific to auth endpoints (5 req/min per IP), and (4) Log all auth failures with structured logging...",
  "SQL vs NoSQL depends on your use case. SQL (PostgreSQL) is best for: relational data, strong consistency needs, complex queries, ACID transactions. NoSQL excels at: flexible schemas, horizontal scale, high-velocity writes, and document-oriented data. Many modern apps use both — SQL for core business data, NoSQL for event logs and analytics...",
];

async function main() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(schema.user).limit(1);
  let userId: string;

  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
    console.log(`Using existing user: ${existingUsers[0].email}`);
  } else {
    userId = nanoid();
    await db.insert(schema.user).values({
      id: userId,
      name: "Demo User",
      email: "demo@example.com",
      emailVerified: true,
    });
    console.log("Created demo user: demo@example.com");
  }

  const existingConversations = await db.select().from(schema.conversations).limit(1);

  if (existingConversations.length > 0) {
    console.log("Data already exists, skipping seed.");
    await client.end();
    return;
  }

  const convIds: string[] = [];
  for (const topic of TOPICS) {
    const convId = nanoid();
    convIds.push(convId);
    const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)];
    const model = MODELS[provider][Math.floor(Math.random() * MODELS[provider].length)];

    const createdAt = new Date(
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
    );

    await db.insert(schema.conversations).values({
      id: convId,
      userId,
      title: topic.title,
      status: "active",
      model,
      provider,
      totalTokens: topic.tokens,
      totalLatencyMs: topic.latency,
      messageCount: topic.msgs,
      createdAt,
      updatedAt: new Date(createdAt.getTime() + topic.latency),
    });

    for (let i = 0; i < topic.msgs; i++) {
      const msgId = nanoid();
      const role = i % 2 === 0 ? "user" : "assistant";
      const content =
        role === "user"
          ? USER_MESSAGES[Math.floor(Math.random() * USER_MESSAGES.length)]
          : ASSISTANT_MESSAGES[Math.floor(Math.random() * ASSISTANT_MESSAGES.length)];

      const msgCreatedAt = new Date(createdAt.getTime() + i * 60000);

      await db.insert(schema.messages).values({
        id: msgId,
        conversationId: convId,
        role,
        content,
        createdAt: msgCreatedAt,
      });

      const tokens = Math.floor(Math.random() * 200) + 50;
      const latencyMs = Math.floor(Math.random() * 3000) + 200;

      await db.insert(schema.inferenceLogs).values({
        id: nanoid(),
        messageId: msgId,
        conversationId: convId,
        userId,
        sessionId: nanoid(),
        provider,
        model,
        status: Math.random() > 0.1 ? "success" : "error",
        latencyMs,
        promptTokens: Math.floor(tokens * 0.4),
        completionTokens: Math.floor(tokens * 0.6),
        totalTokens: tokens,
        inputPreview: role === "user" ? content.slice(0, 100) : ASSISTANT_MESSAGES[0].slice(0, 100),
        outputPreview: role === "assistant" ? content.slice(0, 200) : null,
        metadata: {
          finishReason: "stop",
          requestModel: model,
          requestMaxTokens: 2048,
          requestTemperature: 0.7,
        },
        createdAt: msgCreatedAt,
      });
    }
  }

  await db.insert(schema.errorEvents).values({
    id: nanoid(),
    message: "Rate limit exceeded for API key",
    code: "RATE_LIMIT_EXCEEDED",
    severity: "warning",
    route: "/api/chat",
    method: "POST",
    userId,
    metadata: {
      provider: "openai",
      retryAfter: 30,
    },
    createdAt: new Date(Date.now() - 3600000),
  });

  await db.insert(schema.errorEvents).values({
    id: nanoid(),
    message: "LLM provider returned 503 Service Unavailable",
    code: "PROVIDER_UNAVAILABLE",
    severity: "error",
    route: "/api/chat/stream",
    method: "POST",
    userId,
    metadata: {
      provider: "nvidia",
      model: "meta/llama-3.1-70b-instruct",
    },
    createdAt: new Date(Date.now() - 7200000),
  });

  for (let i = 0; i < 24; i++) {
    const hour = new Date(Date.now() - (23 - i) * 3600000);
    hour.setMinutes(0, 0, 0);

    await db.insert(schema.analyticsEvents).values({
      id: nanoid(),
      type: "page_view",
      sessionId: nanoid(),
      userId,
      url: "/chat",
      path: "/chat",
      referrer: "https://github.com",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      data: {
        provider: PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)],
        source: "organic",
      },
      createdAt: hour,
    });
  }

  await client.end();
  console.log("\nSeed complete! Created:");
  console.log(`  • ${TOPICS.length} conversations`);
  console.log(`  • ${TOPICS.reduce((s, t) => s + t.msgs, 0)} messages`);
  console.log(`  • ${TOPICS.reduce((s, t) => s + t.msgs, 0)} inference logs`);
  console.log(`  • 2 error events`);
  console.log(`  • 24 analytics events (hourly)`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
