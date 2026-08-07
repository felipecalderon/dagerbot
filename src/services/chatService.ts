import OpenAI from "openai";
import { AppConfig } from "../config/env";
import { SessionRepository, SessionPolicy } from "../data/types";
import { HttpError } from "../http/httpError";
import { DEFAULT_SYSTEM_PROMPT } from "../config/systemPrompt";

export type ChatService = {
  sendMessage(params: {
    sessionId: string;
    text: string;
    ip: string;
  }): Promise<{ reply: string }>;
};

export function createChatService(params: {
  config: AppConfig;
  openai: OpenAI;
  sessionRepository: SessionRepository;
  allowIp: (key: string) => boolean;
  allowSession: (key: string) => boolean;
}): ChatService {
  const { config, openai, sessionRepository, allowIp, allowSession } = params;

  const policy: SessionPolicy = {
    historyLimit: config.historyLimit,
    sessionTtlSeconds: config.sessionTtlSeconds,
  };

  return {
    async sendMessage({ sessionId, text, ip }) {
      if (!allowIp(ip)) {
        throw new HttpError(429, "rate_limited", "IP rate limit exceeded.");
      }
      if (!allowSession(`session:${sessionId}`)) {
        throw new HttpError(
          429,
          "rate_limited",
          "Session rate limit exceeded.",
        );
      }

      const history = await sessionRepository.getHistory(sessionId, policy);
      await sessionRepository.append(sessionId, { role: "user", content: text }, policy);

      const messages = [
        { role: "system", content: DEFAULT_SYSTEM_PROMPT },
      ].concat(history, [{ role: "user", content: text }]);

      const completion = await openai.chat.completions.create({
        model: config.openAiModel,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      });

      const reply = completion.choices[0]?.message?.content || "";
      if (!reply) {
        throw new HttpError(
          502,
          "empty_response",
          "OpenAI returned an empty response.",
        );
      }

      await sessionRepository.append(sessionId, { role: "assistant", content: reply }, policy);

      return { reply };
    },
  };
}
