import { FastifyInstance, RouteHandlerMethod } from "fastify";

export function registerLegalRoutes(params: {
  app: FastifyInstance;
  controller: {
    handlePrivacy: RouteHandlerMethod;
    handleTerms: RouteHandlerMethod;
  };
}) {
  const { app, controller } = params;

  app.get("/privacy", controller.handlePrivacy);
  app.get("/privacy-policy", controller.handlePrivacy);

  app.get("/terms", controller.handleTerms);
  app.get("/terms-of-service", controller.handleTerms);
}
