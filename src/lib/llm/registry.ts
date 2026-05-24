import type { LLMProvider } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { DeepSeekProvider } from "./providers/deepseek";
import { OpenRouterProvider } from "./providers/openrouter";
import { NVIDIAProvider } from "./providers/nvidia";
import { env } from "../env";

class LLMProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider) {
    this.providers.set(provider.name, provider);
  }

  get(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(
        `LLM provider "${name}" not registered. Available: ${Array.from(this.providers.keys()).join(", ")}`,
      );
    }
    return provider;
  }

  getDefault(): LLMProvider {
    return this.get(env.DEFAULT_LLM_PROVIDER);
  }

  getDefaultModel(providerName?: string): string {
    const name = providerName ?? env.DEFAULT_LLM_PROVIDER;
    const provider = this.get(name);
    return env.DEFAULT_LLM_MODEL || provider.models[0];
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  listModels(providerName?: string): string[] {
    if (providerName) {
      return this.get(providerName).models;
    }
    return Array.from(this.providers.values()).flatMap((p) => p.models);
  }

  listAvailableModels(): Array<{ provider: string; model: string; label: string }> {
    const result: Array<{ provider: string; model: string; label: string }> = [];
    const providerLabels: Record<string, string> = {
      nvidia: "NVIDIA",
      openai: "OpenAI",
      anthropic: "Anthropic",
      gemini: "Google Gemini",
      deepseek: "DeepSeek",
      openrouter: "OpenRouter",
    };
    for (const [name, provider] of this.providers) {
      for (const model of provider.models) {
        const shortName = model.split("/").pop() ?? model;
        result.push({
          provider: name,
          model,
          label: `${providerLabels[name] ?? name} — ${shortName}`,
        });
      }
    }
    return result;
  }
}

export const llmRegistry = new LLMProviderRegistry();

// Register available providers based on API keys
if (env.OPENAI_API_KEY) {
  llmRegistry.register(new OpenAIProvider(env.OPENAI_API_KEY));
}
if (env.ANTHROPIC_API_KEY) {
  llmRegistry.register(new AnthropicProvider(env.ANTHROPIC_API_KEY));
}
if (env.GEMINI_API_KEY) {
  llmRegistry.register(new GeminiProvider(env.GEMINI_API_KEY));
}
if (env.DEEPSEEK_API_KEY) {
  llmRegistry.register(new DeepSeekProvider(env.DEEPSEEK_API_KEY));
}
if (env.OPENROUTER_API_KEY) {
  llmRegistry.register(new OpenRouterProvider(env.OPENROUTER_API_KEY));
}
if (env.NVIDIA_API_KEY) {
  llmRegistry.register(new NVIDIAProvider(env.NVIDIA_API_KEY));
}
