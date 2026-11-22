import fastify from "fastify";
import { createLegalController } from "./http/controllers/legalController";
import { registerLegalRoutes } from "./http/routes/legalRoutes";

export function buildApp() {
  const app = fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  const legalController = createLegalController();
  registerLegalRoutes({ app, controller: legalController });

  return app;
}
