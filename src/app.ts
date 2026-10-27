import fastify from "fastify";
import { AppConfig } from "./config/env";
import { createChatController } from "./http/controllers/chatController";
import { createLegalController } from "./http/controllers/legalController";
import { registerChatRoutes } from "./http/routes/chatRoutes";
import { registerLegalRoutes } from "./http/routes/legalRoutes";
import { ChatService } from "./services/chatService";

export function buildApp(params: {
  config: AppConfig;
  chatService: ChatService;
}) {
  const { config, chatService } = params;

  const app = fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  const legalController = createLegalController();
  registerLegalRoutes({ app, controller: legalController });

  const chatController = createChatController({ config, chatService });
  registerChatRoutes({ app, controller: chatController });

  return app;
}
