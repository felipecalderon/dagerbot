import type { Client, Message } from "discord.js";
import type { ChatService } from "../../../services/chatService.js";

export async function handleChatAi(
  message: Message,
  client: Client,
  chatService: ChatService,
  prefix: string
): Promise<void> {
  const raw = message.content ?? "";
  if (!raw.trim()) return;

  const isDm = !message.guildId;

  const mention = client.user ? `<@${client.user.id}>` : "";
  const mentionNick = client.user ? `<@!${client.user.id}>` : "";
  const hasMention =
    mention && (raw.includes(mention) || raw.includes(mentionNick));
  const hasPrefix = raw.startsWith(prefix);

  let isReplyToBot = false;
  let cachedReference: Awaited<ReturnType<typeof message.fetchReference>> | null = null;
  if (message.reference?.messageId && client.user) {
    try {
      cachedReference = await message.fetchReference();
      isReplyToBot = cachedReference.author?.id === client.user.id;
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

    if (cachedReference) {
      repliedText = cachedReference.content ?? "";
      repliedAuthorName = cachedReference.guildId
        ? cachedReference.member?.nickname ??
          cachedReference.author?.globalName ??
          cachedReference.author?.username ??
          ""
        : cachedReference.author?.globalName ?? cachedReference.author?.username ?? "";
    }

    const combinedText = repliedText
      ? `${repliedAuthorName || "Usuario"} dijo: ${repliedText}\n${senderName} dijo: ${text}`
      : text;

    if (message.channel.isTextBased() && "sendTyping" in message.channel) {
      await message.channel.sendTyping();
    }

    const formattedText = `${senderName}: ${combinedText}`;
    const sessionId = `${message.guildId ?? "dm"}:${message.channelId}:${message.author.id}`;
    const result = await chatService.sendMessage({
      sessionId,
      text: formattedText,
      ip: `discord:${message.author.id}`,
    });
    // The model writes this text and a user can steer what it says, so no
    // mention in it is allowed to fire. repliedUser keeps the reply ping.
    await message.reply({
      content: result.reply,
      allowedMentions: { parse: [], repliedUser: true },
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unexpected error.";
    await message.reply(`error: ${errorMessage}`);
  }
}
