import { Events, type Client } from "discord.js";
import type { SettingsManager } from "../../core/types.js";
import type { DataLayer } from "../../data/index.js";
import type { ChatService } from "../../services/chatService.js";
import { handleMeme, handleMemeReward } from "./listeners/memeListener.js";
import { handleChatAi } from "./listeners/chatAiListener.js";
import { handleChannelGuard } from "./listeners/channelGuardListener.js";
import { syncCucumberPanel } from "./listeners/channelGuardPanel.js";

export function registerEventDispatcher(
  client: Client,
  deps: {
    settingsManager: SettingsManager;
    dataLayer: DataLayer;
    chatService: ChatService;
    prefix: string;
  }
): void {
  const { settingsManager, dataLayer, chatService, prefix } = deps;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.guildId) {
      const settings = await settingsManager.getSettings(message.guildId);

      await handleChannelGuard(
        message,
        settings.channelGuard,
        dataLayer.channelGuardRepository
      ).catch((err) => {
        console.error("[channelGuardFeature] Error:", err);
      });

      await handleMeme(message, settings.meme).catch((err) => {
        console.error("[memeFeature] Error:", err);
      });

      await handleMemeReward(message, settings.memeReward, settings.meme, dataLayer.memeRepository).catch((err) => {
        console.error("[memeRewardFeature] Error:", err);
      });
    }

    await handleChatAi(message, client, chatService, prefix).catch((err) => {
      console.error("[chatAiFeature] Error:", err);
    });

    // next event handler
    // await handle<NameFeature>(message, deps).catch((err) => {
    //   console.error("[<name>Feature] Error:", err);
    // });
  });

  // Re-post panels missing after an upgrade, and refresh surviving ones on boot.
  client.once(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const settings = await settingsManager.getSettings(guild.id);
        const { enabled, channelId } = settings.channelGuard;
        if (!enabled || !channelId) continue;

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased() || !channel.isSendable()) continue;

        await syncCucumberPanel(
          channel,
          guild.id,
          dataLayer.channelGuardRepository
        );
      } catch (err) {
        console.error(
          `[channelGuardFeature] Failed to sync panel for guild ${guild.id}:`,
          err
        );
      }
    }
  });

  // --- Other events
  // client.on(Events.MessageUpdate, async (message) => { ... });
}
