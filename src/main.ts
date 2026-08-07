import { buildApp } from "./app";
import { loadConfig } from "./config/env";
import { createFixedWindowLimiter } from "./core/rateLimit";
import { createOpenAIClient } from "./infra/openaiClient";
import { createChatService } from "./services/chatService";
import { startDiscordBot } from "./bot/discordBot";
import { createDataLayer } from "./data/index.js";
import { createSettingsManager } from "./config/settingsManager.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const config = loadConfig();
  const openai = createOpenAIClient(process.env.OPENAI_API_KEY);

  const dataLayer = await createDataLayer();
  const settingsManager = await createSettingsManager(dataLayer.settingsRepository);

  const allowIp = createFixedWindowLimiter(config.rateLimitIpPerMin);
  const allowSession = createFixedWindowLimiter(config.rateLimitSessionPerMin);

  const chatService = createChatService({
    config,
    openai,
    sessionRepository: dataLayer.sessionRepository,
    allowIp,
    allowSession,
  });

  const app = buildApp({ config, chatService });

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`HTTP listening on port ${config.port}`);

  await startDiscordBot({ chatService, settingsManager, dataLayer });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
