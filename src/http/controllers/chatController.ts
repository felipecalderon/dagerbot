import { FastifyReply, FastifyRequest } from "fastify";
import { AppConfig } from "../../config/env";
import { ChatService } from "../../services/chatService";
import { HttpError } from "../httpError";

type ChatQuery = {
  sessionId: string;
  text: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseChatQuery(raw: unknown): ChatQuery | null {
  if (!isObject(raw)) return null;
  const sessionId = raw.sessionId;
  const text = raw.text;
  if (typeof sessionId !== "string") return null;
  if (typeof text !== "string") return null;
  return { sessionId, text };
}

export function createChatController(params: {
  config: AppConfig;
  chatService: ChatService;
}) {
  const { config, chatService } = params;

  function sendText(reply: FastifyReply, status: number, text: string) {
    reply.status(status).type("text/plain").send(text);
  }

  async function handleChat(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = parseChatQuery(request.body);
      if (!query) {
        sendText(
          reply,
          400,
          "invalid_query: tu payload vino incompleto. necesito sessionId y text, los dos strings. sin eso ni me acerco."
        );
        return;
      }

      if (!query.text.trim()) {
        sendText(reply, 400, "invalid_input: me mandaste aire. si quieres algo de mí, dame algo con qué trabajar.");
        return;
      }
      if (query.text.length > config.maxInputChars) {
        sendText(
          reply,
          413,
          `input_too_large: tranquilo, tanto no. máx ${config.maxInputChars} caracteres — ve de a poco conmigo.`
        );
        return;
      }

      const ip = request.ip || "unknown";
      const result = await chatService.sendMessage({
        sessionId: query.sessionId,
        text: query.text,
        ip,
      });

      sendText(reply, 200, result.reply);
    } catch (err) {
      if (err instanceof HttpError) {
        sendText(reply, err.status, `${err.code}: ${err.message}`);
        return;
      }
      request.log.error({ err }, "chat_error");
      sendText(reply, 500, "server_error: algo se rompió aquí adentro. no fuiste tú, fui yo — dame un momento y vuelve.");
    }
  }

  return { handleChat };
}
