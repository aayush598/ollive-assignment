import { v4 as uuid } from "uuid";
import { db } from "../db";
import * as schema from "../db/schema";
import { InferenceLogSchema, type InferenceLog } from "../llm/types";
import { redactPII } from "../pii/redactor";
import { z } from "zod";

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
  const query = db
    .select()
    .from(schema.inferenceLogs)
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return query;
}

export async function getInferenceStats(options?: {
  userId?: string;
  provider?: string;
  since?: Date;
}) {
  const logs = await db
    .select();
  return {
    totalRequests: 0,
    totalTokens: 0,
    averageLatencyMs: 0,
    successCount: 0,
    errorCount: 0,
    cancelledCount: 0,
    byProvider: {} as Record<string, { count: number; totalTokens: number; avgLatencyMs: number }>,
  };
}
