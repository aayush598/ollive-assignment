import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";
import { env } from "../../env";

export class OpenRouterProvider implements LLMProvider {
  name = "openrouter";
  models = [
    "openai/gpt-4.1",
    "anthropic/claude-sonnet-4-20250514",
    "google/gemini-2.5-pro",
    "deepseek/deepseek-chat",
    "x-ai/grok-3",
  ];

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.7,
          stream: false,
        }),
        signal: AbortSignal.timeout(env.LLM_REQUEST_TIMEOUT),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const latencyMs = Date.now() - start;

      return {
        id: data.id,
        content: data.choices[0]?.message?.content ?? "",
        model: data.model,
        provider: "openrouter",
        latencyMs,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: data.choices[0]?.finish_reason ?? "stop",
      };
    } catch (error) {
      throw new Error(
        `OpenRouter error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async *generateStream(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.7,
          stream: true,
        }),
        signal: AbortSignal.timeout(env.LLM_STREAM_TIMEOUT),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${err}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: "chunk", content: delta };
            }
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: parsed.usage.completion_tokens ?? 0,
                totalTokens: parsed.usage.total_tokens ?? 0,
              };
            }
          } catch {
            // Skip unparseable
          }
        }
      }

      yield { type: "done", usage, finishReason: "stop" };
    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
