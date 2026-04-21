import OpenAI from "openai";
import type { AppConfig } from "../config/env";
import type { LLMProvider, CompletionRequest } from "./types";

export function createOpenAIProvider(config: AppConfig): LLMProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");

  const client = new OpenAI({ apiKey });

  return {
    async complete({ system, history, userContent }: CompletionRequest): Promise<string> {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: system },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ];

      const completion = await client.chat.completions.create({
        model: config.openAiModel,
        messages,
        temperature: 0.85,
        presence_penalty: 0.3,
        frequency_penalty: 0.4,
        max_tokens: 500,
      });

      return completion.choices[0]?.message?.content ?? "";
    },
  };
}
