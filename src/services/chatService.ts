import type { AppConfig } from "../config/env";
import type { SessionStore } from "../core/sessionStore";
import type { LLMProvider } from "../providers/types";
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
  provider: LLMProvider;
  sessionStore: SessionStore;
  allowIp: (key: string) => boolean;
  allowSession: (key: string) => boolean;
}): ChatService {
  const { config, provider, sessionStore, allowIp, allowSession } = params;

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

      const system = [
        config.systemPrompt,
        `Hora actual de la invocación: ${nowFormatted} (${config.botTimezone}).`,
      ].join("\n\n");

      const reply = await provider.complete({ system, history, userContent });

      if (!reply) {
        throw new HttpError(
          502,
          "empty_response",
          "el modelo devolvió silencio. raro, pero pasa. inténtalo de nuevo.",
        );
      }

      await sessionStore.appendUser(sessionId, text);
      await sessionStore.appendAssistant(sessionId, reply);

      return { reply };
    },
  };
}
