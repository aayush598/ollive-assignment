import { v4 as uuid } from "uuid";
import type { InferenceLog, LLMResponse, LLMRequest } from "../llm/types";
import { InferenceLogSchema } from "../llm/types";
import { redactPII } from "../pii/redactor";
import { env } from "../env";

export interface SDKConfig {
  ingestEndpoint: string;
  flushIntervalMs: number;
  maxBatchSize: number;
  enablePIIRedaction: boolean;
  autoSend: boolean;
}

export interface SDKCaptureOptions {
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  redactPII?: boolean;
}

export class IngestionSDK {
  private config: SDKConfig;
  private buffer: InferenceLog[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<SDKConfig>) {
    this.config = {
      ingestEndpoint: config?.ingestEndpoint ?? "/api/ingest",
      flushIntervalMs: config?.flushIntervalMs ?? 5000,
      maxBatchSize: config?.maxBatchSize ?? 50,
      enablePIIRedaction: config?.enablePIIRedaction ?? true,
      autoSend: config?.autoSend ?? true,
    };

    if (this.config.autoSend) {
      this.startAutoFlush();
    }
  }

  capture(
    req: LLMRequest,
    response: LLMResponse,
    options?: SDKCaptureOptions,
  ): InferenceLog {
    const inputRaw = req.messages.map((m) => m.content).join("\n");
    const outputRaw = response.content;

    let inputPreview = inputRaw.slice(0, 500);
    let outputPreview = outputRaw.slice(0, 500);
    let piiRedacted = false;

    if (this.config.enablePIIRedaction || options?.redactPII) {
      const inputRedacted = redactPII(inputPreview);
      const outputRedacted = redactPII(outputPreview);
      inputPreview = inputRedacted.redacted;
      outputPreview = outputRedacted.redacted;
      if (inputRedacted.hasPII || outputRedacted.hasPII) {
        piiRedacted = true;
      }
    }

    const log: InferenceLog = {
      provider: response.provider,
      model: response.model,
      status: "success",
      latencyMs: response.latencyMs,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      inputPreview,
      outputPreview,
      sessionId: options?.sessionId,
      conversationId: options?.conversationId ?? req.conversationId ?? "",
      userId: options?.userId ?? req.userId,
      metadata: {
        ...options?.metadata,
        finishReason: response.finishReason,
        requestModel: req.model,
        requestMaxTokens: req.maxTokens,
        requestTemperature: req.temperature,
      },
      piiRedacted,
    };

    this.buffer.push(log);

    if (this.buffer.length >= this.config.maxBatchSize) {
      this.flush().catch(() => {});
    }

    return log;
  }

  captureError(
    req: LLMRequest,
    error: Error | string,
    options?: SDKCaptureOptions,
  ): InferenceLog {
    const inputRaw = req.messages.map((m) => m.content).join("\n");
    let inputPreview = inputRaw.slice(0, 500);
    let piiRedacted = false;

    if (this.config.enablePIIRedaction || options?.redactPII) {
      const result = redactPII(inputPreview);
      inputPreview = result.redacted;
      piiRedacted = result.hasPII;
    }

    const log: InferenceLog = {
      provider: (options?.metadata?.provider as string) ?? req.provider ?? "unknown",
      model: req.model,
      status: "error",
      error: typeof error === "string" ? error : error.message,
      inputPreview,
      sessionId: options?.sessionId,
      conversationId: options?.conversationId ?? req.conversationId ?? "",
      userId: options?.userId ?? req.userId,
      metadata: options?.metadata,
      piiRedacted,
    };

    this.buffer.push(log);

    if (this.buffer.length >= this.config.maxBatchSize) {
      this.flush().catch(() => {});
    }

    return log;
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.config.maxBatchSize);

    try {
      const validated = batch.map((log) => InferenceLogSchema.parse(log));
      const res = await fetch(this.config.ingestEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: validated }),
      });

      if (!res.ok) {
        console.error(`Ingestion flush failed (${res.status}): ${await res.text()}`);
      }
    } catch (error) {
      console.error("Ingestion flush error:", error);
    }
  }

  private startAutoFlush(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => { this.flush().catch(() => {}); }, this.config.flushIntervalMs);

    if (typeof process !== "undefined" && typeof process.on === "function") {
      process.on("beforeExit", () => { this.flush().catch(() => {}); });
      process.on("SIGINT", () => {
        this.flush().finally(() => process.exit(0));
      });
      process.on("SIGTERM", () => {
        this.flush().finally(() => process.exit(0));
      });
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush().catch(() => {});
  }
}

export const ingestionSDK = new IngestionSDK({
  ingestEndpoint:
    process.env.NEXT_PUBLIC_INGEST_ENDPOINT ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/ingest`,
  enablePIIRedaction: true,
});
