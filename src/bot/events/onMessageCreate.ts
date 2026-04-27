import { Events, type Client, type Message } from "discord.js";
import type { MemeSettings, SettingsManager } from "../../core/types.js";
import { hasMediaAttachment } from "../../features/meme.js";

async function handleMemeFeature(
  message: Message,
  config: MemeSettings
): Promise<void> {
  if (!config.channelId || message.channelId !== config.channelId) return;

  const contentTypes = [...message.attachments.values()].map(
    (a) => a.contentType
  );
  const hasMedia = hasMediaAttachment(contentTypes);

  if (config.autoReact.enabled && hasMedia) {
    for (const emoji of config.autoReact.emojis) {
      await message.react(emoji);
    }
  }

  if (config.mediaOnly.enabled && !hasMedia) {
    // Requires "Manage Messages" permission in the meme channel
    await message.delete();
  }
}

export function registerMessageCreateEvent(
  client: Client,
  settingsManager: SettingsManager
): void {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.guildId) return;

    const settings = await settingsManager.getSettings(message.guildId);

    await handleMemeFeature(message, settings.meme).catch((err) => {
      console.error("[memeFeature] Error handling message:", err);
    });

    // next feature
    // await handle<NameFeature>(message, settings.<NameFeature>).catch((err) => {
    //   console.error("[<NameFeature>Feature] Error handling message:", err);
    // });
  });
}
