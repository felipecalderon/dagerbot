import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { ChatService } from "../services/chatService";

export async function startDiscordBot(params: {
  chatService: ChatService;
}) {
  const { chatService } = params;

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.warn("DISCORD_TOKEN not set. Discord bot disabled.");
    return null;
  }

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

  client.on("clientReady", () => {
    console.log(`Discord bot logged in as ${client.user?.tag ?? "unknown"}`);
  });

  client.on("messageCreate", async (message) => {
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
