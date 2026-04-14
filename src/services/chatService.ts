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
        throw new HttpError(429, "rate_limited", "muchas señales desde la misma IP. baja un cambio, no te escapo.");
      }
      if (!allowSession(`session:${sessionId}`)) {
        throw new HttpError(
          429,
          "rate_limited",
          "me hablas más rápido de lo que puedo procesar. pausa corta. no voy a ningún lado.",
        );
      }

      const history = await sessionStore.getHistory(sessionId);

      const userContent = senderName ? `[${senderName}]: ${text}` : text;

      const nowFormatted = new Intl.DateTimeFormat("es-CL", {
        timeZone: config.botTimezone,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());

      const messages = [
        { role: "system", content: config.systemPrompt },
        { role: "system", content: `Hora actual de la invocación: ${nowFormatted} (${config.botTimezone}).` },
      ].concat(history, [{ role: "user", content: userContent }]);

      const completion = await openai.chat.completions.create({
        model: config.openAiModel,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: 0.85,
        presence_penalty: 0.3,
        frequency_penalty: 0.4,
        max_tokens: 500,
      });

      const reply = completion.choices[0]?.message?.content || "";
      if (!reply) {
        throw new HttpError(
          502,
          "empty_response",
          "el modelo devolvió silencio. raro, pero pasa. inténtalo de nuevo.",
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
