import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  models = ["claude-sonnet-4-20250514", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"];

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    try {
      const systemMsg = req.messages.find((m) => m.role === "system");
      const otherMessages = req.messages.filter((m) => m.role !== "system");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.7,
          system: systemMsg?.content,
          messages: otherMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const latencyMs = Date.now() - start;

      return {
        id: data.id,
        content: data.content?.[0]?.text ?? "",
        model: data.model,
        provider: "anthropic",
        latencyMs,
        usage: {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
        finishReason: data.stop_reason ?? "stop",
      };
    } catch (error) {
      throw new Error(
        `Anthropic error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async *generateStream(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    try {
      const systemMsg = req.messages.find((m) => m.role === "system");
      const otherMessages = req.messages.filter((m) => m.role !== "system");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.7,
          system: systemMsg?.content,
          messages: otherMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${err}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let inputTokens = 0;
      let outputTokens = 0;

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

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield { type: "chunk", content: parsed.delta.text };
            }
            if (parsed.type === "message_start" && parsed.message?.usage) {
              inputTokens = parsed.message.usage.input_tokens ?? 0;
            }
            if (parsed.type === "message_delta" && parsed.usage) {
              outputTokens = parsed.usage.output_tokens ?? 0;
            }
          } catch {
            // Skip unparseable
          }
        }
      }

      yield {
        type: "done",
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
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
