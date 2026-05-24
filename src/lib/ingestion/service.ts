import { v4 as uuid } from "uuid";
import { sql, eq, and, type SQL } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { InferenceLogSchema, type InferenceLog } from "../llm/types";
import { redactPII } from "../pii/redactor";
import { z } from "zod";
import { ingestionEvents } from "./events";

const BatchIngestSchema = z.object({
  logs: z.array(InferenceLogSchema),
});

export interface IngestResult {
  accepted: number;
  rejected: number;
  errors: string[];
}

export async function processIngestBatch(
  body: unknown,
): Promise<IngestResult> {
  const result: IngestResult = { accepted: 0, rejected: 0, errors: [] };

  const parsed = BatchIngestSchema.safeParse(body);
  if (!parsed.success) {
    result.rejected = 1;
    result.errors.push(parsed.error.message);
    return result;
  }

  for (const log of parsed.data.logs) {
    try {
      const processedLog = processInferenceLog(log);
      await db.insert(schema.inferenceLogs).values({
        id: uuid(),
        messageId: processedLog.messageId ?? null,
        conversationId: processedLog.conversationId,
        userId: processedLog.userId ?? null,
        sessionId: processedLog.sessionId ?? null,
        provider: processedLog.provider,
        model: processedLog.model,
        status: processedLog.status,
        latencyMs: processedLog.latencyMs ?? null,
        promptTokens: processedLog.promptTokens ?? null,
        completionTokens: processedLog.completionTokens ?? null,
        totalTokens: processedLog.totalTokens ?? null,
        inputPreview: processedLog.inputPreview ?? null,
        outputPreview: processedLog.outputPreview ?? null,
        error: processedLog.error ?? null,
        metadata: processedLog.metadata ?? null,
        piiRedacted: processedLog.piiRedacted ?? false,
      });
      result.accepted++;

      ingestionEvents.emit("log:ingested", {
        id: uuid(),
        provider: processedLog.provider,
        model: processedLog.model,
        status: processedLog.status,
        latencyMs: processedLog.latencyMs,
        totalTokens: processedLog.totalTokens,
      });
    } catch (error) {
      result.rejected++;
      result.errors.push(
        `Log processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return result;
}

function processInferenceLog(log: InferenceLog): InferenceLog {
  const processed = { ...log };

  if (processed.inputPreview) {
    const redacted = redactPII(processed.inputPreview);
    processed.inputPreview = redacted.redacted;
    if (redacted.hasPII) processed.piiRedacted = true;
  }

  if (processed.outputPreview) {
    const redacted = redactPII(processed.outputPreview);
    processed.outputPreview = redacted.redacted;
    if (redacted.hasPII) processed.piiRedacted = true;
  }

  return processed;
}

export async function getInferenceLogs(
  options?: {
    conversationId?: string;
    userId?: string;
    provider?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
) {
  const conditions = [];
  if (options?.conversationId) conditions.push(eq(schema.inferenceLogs.conversationId, options.conversationId));
  if (options?.userId) conditions.push(eq(schema.inferenceLogs.userId, options.userId));
  if (options?.provider) conditions.push(eq(schema.inferenceLogs.provider, options.provider));
  if (options?.status) conditions.push(sql`${schema.inferenceLogs.status} = ${options.status}`);

  const query = db
    .select()
    .from(schema.inferenceLogs)
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  return query;
}

export interface DashboardStats {
  totalRequests: number;
  totalTokens: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  successCount: number;
  errorCount: number;
  cancelledCount: number;
  successRate: number;
  errorRate: number;
  byProvider: Record<string, {
    count: number;
    totalTokens: number;
    avgLatencyMs: number;
    errors: number;
  }>;
  recentErrors: Array<{
    id: string;
    provider: string;
    model: string;
    error: string | null;
    createdAt: Date;
  }>;
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export async function getInferenceStats(options?: {
  userId?: string;
  provider?: string;
  since?: Date;
}): Promise<DashboardStats> {
  const since = options?.since ?? new Date(Date.now() - 3600000);
  const since5m = new Date(Date.now() - 300000);

  function andConditions(parts: SQL[]): SQL {
    return sql.join(parts, sql` AND `);
  }

  const filters: SQL[] = [];
  if (options?.userId) filters.push(sql`user_id = ${options.userId}`);
  if (options?.provider) filters.push(sql`provider = ${options.provider}`);

  const whereClause = filters.length > 0 ? sql`WHERE ${andConditions(filters)}` : sql``;
  const p95SubClause = filters.length > 0 ? sql`AND ${andConditions(filters)}` : sql``;

  const [total] = await db.execute<{ count: number; total_tokens: number; avg_latency: number; p95_latency: number; success: number; error: number; cancelled: number }>(sql`
    SELECT
      COUNT(*)::int as count,
      COALESCE(SUM(total_tokens), 0)::int as total_tokens,
      COALESCE(AVG(latency_ms), 0)::int as avg_latency,
      COALESCE(
        (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FROM inference_logs WHERE latency_ms IS NOT NULL ${p95SubClause}),
        0
      )::int as p95_latency,
      COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0)::int as success,
      COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0)::int as error,
      COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0)::int as cancelled
    FROM inference_logs
    ${whereClause}
  `);

  const [recent] = await db.execute<{ requests: number; tokens: number }>(sql`
    SELECT
      COUNT(*)::int as requests,
      COALESCE(SUM(total_tokens), 0)::int as tokens
    FROM inference_logs
    WHERE created_at >= ${since5m.toISOString()}
    ${filters.length > 0 ? sql`AND ${andConditions(filters)}` : sql``}
  `);

  const perProvider = await db.execute<{ provider: string; count: number; total_tokens: number; avg_latency: number; errors: number }>(sql`
    SELECT
      provider,
      COUNT(*)::int as count,
      COALESCE(SUM(total_tokens), 0)::int as total_tokens,
      COALESCE(AVG(latency_ms), 0)::int as avg_latency,
      COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0)::int as errors
    FROM inference_logs
    ${whereClause}
    GROUP BY provider
    ORDER BY count DESC
  `);

  const recentErrorsQuery = db
    .select({
      id: schema.inferenceLogs.id,
      provider: schema.inferenceLogs.provider,
      model: schema.inferenceLogs.model,
      error: schema.inferenceLogs.error,
      createdAt: schema.inferenceLogs.createdAt,
    })
    .from(schema.inferenceLogs)
    .where(
      and(
        eq(schema.inferenceLogs.status, "error"),
        options?.userId ? eq(schema.inferenceLogs.userId, options.userId) : sql`1=1`,
      ),
    )
    .orderBy(sql`created_at DESC`)
    .limit(10);

  const recentErrors = await recentErrorsQuery;

  const totalRequests = total?.count ?? 0;
  const totalErrors = total?.error ?? 0;

  return {
    totalRequests,
    totalTokens: total?.total_tokens ?? 0,
    averageLatencyMs: total?.avg_latency ?? 0,
    p95LatencyMs: total?.p95_latency ?? 0,
    successCount: total?.success ?? 0,
    errorCount: total?.error ?? 0,
    cancelledCount: total?.cancelled ?? 0,
    successRate: totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 100,
    errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
    byProvider: Object.fromEntries(
      (perProvider ?? []).map((p: Record<string, unknown>) => [
        p.provider,
        {
          count: p.count as number,
          totalTokens: p.total_tokens as number,
          avgLatencyMs: p.avg_latency as number,
          errors: p.errors as number,
        },
      ]),
    ),
    recentErrors: (recentErrors ?? []).map((e) => ({
      id: e.id,
      provider: e.provider,
      model: e.model,
      error: e.error,
      createdAt: e.createdAt,
    })),
    requestsPerMinute: Math.round((recent?.requests ?? 0) / 5),
    tokensPerMinute: Math.round((recent?.tokens ?? 0) / 5),
  };
}
