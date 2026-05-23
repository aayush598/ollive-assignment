import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  models = ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"];

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${req.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: req.messages.map((m) => ({
              role: m.role === "assistant" ? "model" : m.role,
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              maxOutputTokens: req.maxTokens ?? 4096,
              temperature: req.temperature ?? 0.7,
            },
          }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const latencyMs = Date.now() - start;
      const candidate = data.candidates?.[0];

      return {
        id: "gemini-" + Date.now(),
        content: candidate?.content?.parts?.[0]?.text ?? "",
        model: req.model,
        provider: "gemini",
        latencyMs,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
        },
        finishReason: candidate?.finishReason ?? "stop",
      };
    } catch (error) {
      throw new Error(
        `Gemini error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async *generateStream(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    const start = Date.now();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${req.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: req.messages.map((m) => ({
              role: m.role === "assistant" ? "model" : m.role,
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              maxOutputTokens: req.maxTokens ?? 4096,
              temperature: req.temperature ?? 0.7,
            },
          }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${err}`);
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

          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield { type: "chunk", content: text };
            }
            if (parsed.usageMetadata) {
              yield {
                type: "done",
                usage: {
                  promptTokens: parsed.usageMetadata.promptTokenCount ?? 0,
                  completionTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
                  totalTokens: parsed.usageMetadata.totalTokenCount ?? 0,
                },
                finishReason: "stop",
              };
            }
          } catch {
            // Skip unparseable
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
