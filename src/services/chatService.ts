import OpenAI from "openai";
import { AppConfig } from "../config/env";
import { SessionRepository, SessionPolicy } from "../data/types";
import { HttpError } from "../http/httpError";

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
      if (text.length > config.maxInputChars) {
        throw new HttpError(
          413,
          "input_too_large",
          `Vamo a calmarno' mascapito solo te voy a decir 2 cosas: mucho texto (Max ${config.maxInputChars} chars)`,
        );
      }
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

      const messages = [
        { role: "system", content: config.openAiSystemPrompt },
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

      await sessionRepository.append(sessionId, { role: "user", content: text }, policy);
      await sessionRepository.append(sessionId, { role: "assistant", content: reply }, policy);

      return { reply };
    },
  };
}
