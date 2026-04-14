import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { ChatService } from "../services/chatService";
import { AppConfig } from "../config/env";

const MAX_DISCORD_MESSAGE_LENGTH = 2000;

export async function startDiscordBot(params: {
  chatService: ChatService;
  config: AppConfig;
}) {
  const { chatService, config } = params;

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
    let replyContext: string | null = null;
    if (message.reference?.messageId && client.user) {
      try {
        const replied = await message.fetchReference();
        if (replied.author?.id === client.user.id) {
          isReplyToBot = true;
        } else if (replied.content?.trim()) {
          replyContext = `[${replied.author?.username ?? "unknown"} dijo: ${replied.content.trim()}]`;
        }
      } catch {
        // ignore
      }
    }

    if (!isDm && !hasMention && !hasPrefix && !isReplyToBot) return;

    let text = raw;
    if (hasMention) {
      text = text.replace(mention, "").replace(mentionNick, "").trim();
    }
    if (hasPrefix) {
      text = text.slice(prefix.length).trim();
    }

    if (replyContext) {
      text = `${replyContext}\n${text}`.trim();
    }

    if (!text) return;

    if (text.length > config.maxInputChars) {
      try {
        await message.reply(`mensaje demasiado largo (máx ${config.maxInputChars} caracteres).`);
      } catch {
        // ignore
      }
      return;
    }

    try {
      await message.channel.sendTyping();
      const sessionId = `${message.guildId ?? "dm"}:${message.channelId}:${message.author.id}`;
      const senderName = message.member?.displayName ?? message.author.displayName ?? message.author.username;
      const result = await chatService.sendMessage({
        sessionId,
        text,
        ip: `discord:${message.author.id}`,
        senderName,
      });
      const reply = result.reply.length > MAX_DISCORD_MESSAGE_LENGTH
        ? result.reply.slice(0, MAX_DISCORD_MESSAGE_LENGTH - 3) + "..."
        : result.reply;
      await message.reply(reply);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unexpected error.";
      try {
        await message.reply(`error: ${errorMessage}`);
      } catch {
        console.error("Failed to send error reply:", errorMessage);
      }
    }
  });

  await client.login(token);
  return client;
}
