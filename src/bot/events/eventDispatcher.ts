import { Events, type Client } from "discord.js";
import type { SettingsManager } from "../../core/types.js";
import type { DataLayer } from "../../data/index.js";
import type { ChatService } from "../../features/chat.js";
import { handleMeme, handleMemeReward } from "./listeners/memeListener.js";
import { handleChatAi } from "./listeners/chatAiListener.js";
import { handleChannelGuard } from "./listeners/channelGuardListener.js";
import { sweepGuardedChannels } from "./listeners/channelGuardCleanup.js";
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
  const aiChatEnabled = process.env.DISCORD_AI_CHAT_ENABLED !== "false";

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.guildId) {
      // Without a catch, a failed read aborts the whole listener. discord.js
      // turns the rejection into an error event, so the bot stays up, but
      // nothing below runs, chat included. With it, only the guild features
      // that need these settings are skipped.
      const settings = await settingsManager
        .getSettings(message.guildId)
        .catch((err) => {
          console.error(
            `[settings] guild=${message.guildId}: unavailable, guild features skipped:`,
            err
          );
          return null;
        });

      if (settings) {
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
    }

    if (aiChatEnabled) {
      await handleChatAi(message, client, chatService, prefix).catch((err) => {
        console.error("[chatAiFeature] Error:", err);
      });
    }

    // next event handler
    // await handle<NameFeature>(message, deps).catch((err) => {
    //   console.error("[<name>Feature] Error:", err);
    // });
  });

  // Re-post panels missing after an upgrade, and refresh surviving ones on boot.
  client.once(Events.ClientReady, async () => {
    const sweep = () =>
      sweepGuardedChannels(
        client,
        settingsManager,
        dataLayer.channelGuardRepository
      ).catch((err) => {
        console.error("[channelGuardCleanup] Sweep failed:", err);
      });

    // Note: registered before the boot sweep so a failed sweep cannot leave the
    // hourly cleanup unregistered.
    setInterval(sweep, 60 * 60 * 1000).unref();

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

    await sweep();
  });

  // --- Other events
  // client.on(Events.MessageUpdate, async (message) => { ... });
}
