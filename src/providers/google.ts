import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppConfig } from "../config/env";
import type { LLMProvider, CompletionRequest } from "./types";

export function createGoogleProvider(config: AppConfig): LLMProvider {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is required when LLM_PROVIDER=google");

  const genai = new GoogleGenerativeAI(apiKey);

  return {
    async complete({ system, history, userContent }: CompletionRequest): Promise<string> {
      const model = genai.getGenerativeModel({
        model: config.googleModel,
        systemInstruction: system,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 500,
        },
      });

      const historyContents = history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({ history: historyContents });
      const result = await chat.sendMessage(userContent);
      return result.response.text();
    },
  };
}
