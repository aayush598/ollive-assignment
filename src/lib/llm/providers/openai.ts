import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  models = ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3-mini"];

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.7,
          stream: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const latencyMs = Date.now() - start;

      return {
        id: data.id,
        content: data.choices[0]?.message?.content ?? "",
        model: data.model,
        provider: "openai",
        latencyMs,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: data.choices[0]?.finish_reason ?? "stop",
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      throw new Error(
        `OpenAI error after ${latencyMs}ms: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async *generateStream(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.7,
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${err}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

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

            if (parsed.usage) {
              yield {
                type: "done",
                usage: {
                  promptTokens: parsed.usage.prompt_tokens ?? 0,
                  completionTokens: parsed.usage.completion_tokens ?? 0,
                  totalTokens: parsed.usage.total_tokens ?? 0,
                },
                finishReason: "stop",
              };
              continue;
            }

            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: "chunk", content: delta };
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      yield {
        type: "done",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop",
      };
    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
