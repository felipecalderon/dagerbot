import OpenAI from "openai";
import { AppConfig } from "../config/env";
import { SessionStore } from "../core/sessionStore";
import { HttpError } from "../http/httpError";

export type ChatService = {
  sendMessage(params: {
    sessionId: string;
    text: string;
    ip: string;
    senderName?: string;
  }): Promise<{ reply: string }>;
};

export function createChatService(params: {
  config: AppConfig;
  openai: OpenAI;
  sessionStore: SessionStore;
  allowIp: (key: string) => boolean;
  allowSession: (key: string) => boolean;
}): ChatService {
  const { config, openai, sessionStore, allowIp, allowSession } = params;

  return {
    async sendMessage({ sessionId, text, ip, senderName }) {
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

      const history = await sessionStore.getHistory(sessionId);

      const userContent = senderName ? `[${senderName}]: ${text}` : text;

      const messages = [
        { role: "system", content: config.systemPrompt },
      ].concat(history, [{ role: "user", content: userContent }]);

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

      // Only persist to history after a successful OpenAI response
      // to avoid orphaned user messages if the API call fails.
      await sessionStore.appendUser(sessionId, text);
      await sessionStore.appendAssistant(sessionId, reply);

      return { reply };
    },
  };
}
