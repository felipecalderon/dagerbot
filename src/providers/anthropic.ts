import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "../config/env";
import type { LLMProvider, CompletionRequest } from "./types";

export function createAnthropicProvider(config: AppConfig): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");

  const client = new Anthropic({ apiKey });

  return {
    async complete({ system, history, userContent }: CompletionRequest): Promise<string> {
      const messages: Anthropic.MessageParam[] = [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ];

      const response = await client.messages.create({
        model: config.anthropicModel,
        max_tokens: 500,
        // cache_control on system caches the stable persona prompt across all requests
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages,
        temperature: 0.85,
      });

      const block = response.content.find((b) => b.type === "text");
      return block?.type === "text" ? block.text : "";
    },
  };
}
