import { buildApp } from "./app";
import { loadConfig } from "./config/env";
import { createMemorySessionStore } from "./core/memorySessionStore";
import { createRedisSessionStore } from "./core/redisSessionStore";
import { createFixedWindowLimiter } from "./core/rateLimit";
import { createProvider } from "./providers";
import { createChatService } from "./services/chatService";
import { startDiscordBot } from "./bot/discordBot";

async function main() {
  const config = loadConfig();
  const provider = createProvider(config);

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
    provider,
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
    await sessionStore.disconnect?.();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
