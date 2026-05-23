import { v4 as uuid } from "uuid";
import { db } from "./index";
import * as schema from "./schema";
import { redactPII } from "../pii/redactor";
import type { LLMRequest, LLMResponse } from "../llm/types";

export async function insertInferenceLog(
  req: LLMRequest,
  response: LLMResponse,
  options?: {
    sessionId?: string;
    conversationId?: string;
    userId?: string;
    messageId?: string;
    redact?: boolean;
  },
) {
  const inputRaw = req.messages.map((m) => m.content).join("\n");
  let inputPreview = inputRaw.slice(0, 500);
  let outputPreview = response.content.slice(0, 500);
  let piiRedacted = false;

  if (options?.redact ?? true) {
    const inputRedacted = redactPII(inputPreview);
    const outputRedacted = redactPII(outputPreview);
    inputPreview = inputRedacted.redacted;
    outputPreview = outputRedacted.redacted;
    if (inputRedacted.hasPII || outputRedacted.hasPII) piiRedacted = true;
  }

  await db.insert(schema.inferenceLogs).values({
    id: uuid(),
    messageId: options?.messageId ?? null,
    conversationId: options?.conversationId ?? req.conversationId ?? "",
    userId: options?.userId ?? req.userId ?? null,
    sessionId: options?.sessionId ?? null,
    provider: response.provider,
    model: response.model,
    status: "success",
    latencyMs: response.latencyMs,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
    inputPreview,
    outputPreview,
    metadata: {
      finishReason: response.finishReason,
      requestModel: req.model,
      requestMaxTokens: req.maxTokens,
      requestTemperature: req.temperature,
    },
    piiRedacted,
  });
}

export async function insertErrorLog(
  req: LLMRequest,
  error: string,
  options?: {
    sessionId?: string;
    conversationId?: string;
    userId?: string;
    provider?: string;
    redact?: boolean;
  },
) {
  const inputRaw = req.messages.map((m) => m.content).join("\n");
  let inputPreview = inputRaw.slice(0, 500);
  let piiRedacted = false;

  if (options?.redact ?? true) {
    const result = redactPII(inputPreview);
    inputPreview = result.redacted;
    if (result.hasPII) piiRedacted = true;
  }

  await db.insert(schema.inferenceLogs).values({
    id: uuid(),
    conversationId: options?.conversationId ?? req.conversationId ?? "",
    userId: options?.userId ?? req.userId ?? null,
    sessionId: options?.sessionId ?? null,
    provider: options?.provider ?? req.provider ?? "unknown",
    model: req.model,
    status: "error",
    error,
    inputPreview,
    piiRedacted,
  });
}
