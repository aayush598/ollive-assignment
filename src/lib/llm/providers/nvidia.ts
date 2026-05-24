import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";

export class NVIDIAProvider implements LLMProvider {
  name = "nvidia";
  models = [
    "google/gemma-4-31b-it",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    "mistralai/mistral-large-24-07",
    "meta/llama-3.1-70b-instruct",
    "minimaxai/minimax-m2.7",
  ];

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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
        throw new Error(`NVIDIA API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const latencyMs = Date.now() - start;

      return {
        id: data.id ?? "nvidia-" + Date.now(),
        content: data.choices?.[0]?.message?.content ?? "",
        model: data.model ?? req.model,
        provider: "nvidia",
        latencyMs,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: data.choices?.[0]?.finish_reason ?? "stop",
      };
    } catch (error) {
      throw new Error(`NVIDIA error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async *generateStream(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`NVIDIA API error (${res.status}): ${err}`);
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
            // skip
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
