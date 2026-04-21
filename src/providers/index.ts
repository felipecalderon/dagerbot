import type { AppConfig } from "../config/env";
import { createOpenAIProvider } from "./openai";
import { createAnthropicProvider } from "./anthropic";
import { createGoogleProvider } from "./google";

export function createProvider(config: AppConfig) {
  switch (config.llmProvider) {
    case "openai":
      return createOpenAIProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    case "google":
      return createGoogleProvider(config);
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${config.llmProvider}". Valid values: openai, anthropic, google`,
      );
  }
}

export type { LLMProvider, CompletionRequest, ConversationMessage } from "./types";
