import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import type { ChatService } from "../services/chatService.js";
import type { SettingsManager } from "../core/types.js";
import { registerMessageCreateEvent } from "./events/onMessageCreate.js";
import { createCommandManager } from "./commands/commandManager.js";
import { createConfigCommand } from "./commands/config/index.js";
// import { NewFeatureCommand } from "./commands/NewFeature/index.js"; <- future command

export async function startDiscordBot(params: {
  chatService: ChatService;
  settingsManager: SettingsManager;
}): Promise<Client | null> {
  const { chatService, settingsManager } = params;

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.warn("DISCORD_TOKEN not set. Discord bot disabled.");
    return null;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const prefix = process.env.DISCORD_PREFIX || "!";

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  // Prevent unhandled Discord API errors from crashing the process
  client.on(Events.Error, (err) => {
    console.error("[client] Unhandled error:", err.message);
  });

  // --- Command setup ---
  const commands = createCommandManager();
  commands.add(createConfigCommand(settingsManager));
  // commands.add(create<Name>Command(settingsManager)); <- future command

  client.on(Events.ClientReady, async () => {
    console.log(`Discord bot logged in as ${client.user?.tag ?? "unknown"}`);

    if (clientId) {
      try {
        await commands.registerToDiscord(clientId, token, guildId);
      } catch (err) {
        console.error("[commands] Failed to register slash commands.", err);
      }
    } else {
      console.warn(
        "[commands] DISCORD_CLIENT_ID not set — slash commands not registered."
      );
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await commands.route(interaction).catch((err) => {
      console.error("[commands] Error handling interaction:", err);
    });
  });

  registerMessageCreateEvent(client, settingsManager);

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const raw = message.content ?? "";
    if (!raw.trim()) return;

    const isDm = !message.guildId;

    const mention = client.user ? `<@${client.user.id}>` : "";
    const mentionNick = client.user ? `<@!${client.user.id}>` : "";
    const hasMention =
      mention &&
      (raw.includes(mention) || raw.includes(mentionNick));
    const hasPrefix = raw.startsWith(prefix);

    let isReplyToBot = false;
    if (message.reference?.messageId && client.user) {
      try {
        const replied = await message.fetchReference();
        isReplyToBot = replied.author?.id === client.user.id;
      } catch {
        isReplyToBot = false;
      }
    }

    if (!isDm && !hasMention && !hasPrefix && !isReplyToBot) return;

    let text = raw;
    let repliedText = "";
    let repliedAuthorName = "";
    if (hasMention) {
      text = text.replace(mention, "").replace(mentionNick, "").trim();
    }
    if (hasPrefix) {
      text = text.slice(prefix.length).trim();
    }

    if (!text) return;

    try {
      const senderName = isDm
        ? message.author.globalName ?? message.author.username
        : message.member?.nickname ??
          message.author.globalName ??
          message.author.username;
      if (message.reference?.messageId) {
        try {
          const replied = await message.fetchReference();
          repliedText = replied.content ?? "";
          repliedAuthorName = replied.guildId
            ? replied.member?.nickname ??
              replied.author?.globalName ??
              replied.author?.username ??
              ""
            : replied.author?.globalName ?? replied.author?.username ?? "";
        } catch {
          repliedText = "";
          repliedAuthorName = "";
        }
      }
      const combinedText = repliedText
        ? `${repliedAuthorName || "Usuario"} dijo: ${repliedText}\n${senderName} dijo: ${text}`
        : text;
      await message.channel.sendTyping();
      const formattedText = `${senderName}: ${combinedText}`;
      const sessionId = `${message.guildId ?? "dm"}:${message.channelId}:${message.author.id}`;
      const result = await chatService.sendMessage({
        sessionId,
        text: formattedText,
        ip: `discord:${message.author.id}`,
      });
      await message.reply(result.reply);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unexpected error.";
      await message.reply(`error: ${errorMessage}`);
    }
  });

  await client.login(token);
  return client;
}
