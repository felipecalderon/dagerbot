import { buildApp } from "./app";
import { loadConfig } from "./config/env";
import { createMemorySessionStore } from "./core/memorySessionStore";
import { createRedisSessionStore } from "./core/redisSessionStore";
import { createFixedWindowLimiter } from "./core/rateLimit";
import { createOpenAIClient } from "./infra/openaiClient";
import { createChatService } from "./services/chatService";
import { startDiscordBot } from "./bot/discordBot";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const config = loadConfig();
  const openai = createOpenAIClient(process.env.OPENAI_API_KEY);

  const sessionStore = config.redisUrl
    ? await createRedisSessionStore({
        historyLimit: config.historyLimit,
        sessionTtlSeconds: config.sessionTtlSeconds,
        redisUrl: config.redisUrl,
      })
    : createMemorySessionStore({
        historyLimit: config.historyLimit,
        sessionTtlSeconds: config.sessionTtlSeconds,
      });

  const ipLimiter = createFixedWindowLimiter(config.rateLimitIpPerMin);
  const sessionLimiter = createFixedWindowLimiter(config.rateLimitSessionPerMin);

  const chatService = createChatService({
    config,
    openai,
    sessionStore,
    allowIp: (key) => ipLimiter.allow(key),
    allowSession: (key) => sessionLimiter.allow(key),
  });

  const app = buildApp({ config, chatService });

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`HTTP listening on port ${config.port}`);

  await startDiscordBot({ chatService, config });

  async function shutdown() {
    await app.close();
    if ("disconnect" in sessionStore && typeof (sessionStore as any).disconnect === "function") {
      await (sessionStore as any).disconnect();
    }
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
