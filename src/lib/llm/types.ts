import { z } from "zod";

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model: string;
  provider?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  sessionId?: string;
  conversationId?: string;
  userId?: string;
}

export interface LLMResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  latencyMs: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface LLMStreamChunk {
  type: "chunk";
  content: string;
}

export interface LLMStreamDone {
  type: "done";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface LLMStreamError {
  type: "error";
  error: string;
}

export type LLMStreamEvent = LLMStreamChunk | LLMStreamDone | LLMStreamError;

export interface LLMProvider {
  name: string;
  models: string[];
  generate(req: LLMRequest): Promise<LLMResponse>;
  generateStream(req: LLMRequest): AsyncGenerator<LLMStreamEvent>;
}

export const InferenceLogSchema = z.object({
  provider: z.string(),
  model: z.string(),
  status: z.enum(["success", "error", "cancelled"]),
  latencyMs: z.number().int().positive().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  inputPreview: z.string().max(500).optional(),
  outputPreview: z.string().max(500).optional(),
  error: z.string().optional(),
  sessionId: z.string().optional(),
  conversationId: z.string(),
  messageId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  piiRedacted: z.boolean().optional(),
});

export type InferenceLog = z.infer<typeof InferenceLogSchema>;
