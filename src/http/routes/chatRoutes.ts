import { FastifyInstance, RouteHandlerMethod } from "fastify";

export function registerChatRoutes(params: {
  app: FastifyInstance;
  controller: { handleChat: RouteHandlerMethod };
}) {
  const { app, controller } = params;

  app.post("/chat", controller.handleChat);
}
