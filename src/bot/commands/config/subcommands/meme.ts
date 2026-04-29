import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import type { AppSettings, SettingsManager } from "../../../../core/types.js";
import {
  MAX_REACT_EMOJIS,
  getRequiredPermissionChecks,
} from "../../../../features/meme.js";

type SubcommandMap = Map<
  string,
  (i: ChatInputCommandInteraction, s: SettingsManager) => Promise<void>
>;

// Unicode emoji or Discord custom emoji format <:name:id> / <a:name:id>
const EMOJI_REGEX =
  /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>)$/u;

function isValidEmoji(value: string): boolean {
  return EMOJI_REGEX.test(value.trim());
}

function parseEmojis(raw: string): string[] {
  // Handles both space-separated and consecutive emojis from Discord's picker
  return (
    raw.trim().match(
      /\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>/gu
    ) ?? []
  );
}

export function memeSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand((sub) =>
    sub
      .setName("meme")
      .setDescription("View or update meme module settings")
      .addChannelOption((opt) =>
        opt
      .setName("channel")
      .setDescription("Meme channel")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addStringOption((opt) =>
        opt
          .setName("auto-react")
          .setDescription("Toggle auto reactions on images and videos")
          .setRequired(false)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      )
      .addStringOption((opt) =>
        opt
          .setName("emojis")
          .setDescription(`Reaction emojis, space-separated (max ${MAX_REACT_EMOJIS})`)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("media-only")
          .setDescription("Delete non-media messages in the meme channel")
          .setRequired(false)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      )
  );

  handlers.set("meme", handleMeme);
}

async function validateBotChannelPermissions(
  interaction: ChatInputCommandInteraction,
  channelId: string,
  checks: { checkViewChannel: boolean; checkAddReactions: boolean; checkManageMessages: boolean }
): Promise<string | null> {
  const botMember = await interaction.guild?.members.fetchMe();
  if (!botMember) return "Could not verify bot permissions.";

  if (checks.checkViewChannel) {
    if (!botMember.permissionsIn(channelId).has(PermissionFlagsBits.ViewChannel)) {
      return "❌ The bot cannot see that channel. Check its permissions.";
    }
  }

  if (checks.checkAddReactions) {
    if (!botMember.permissionsIn(channelId).has(PermissionFlagsBits.AddReactions)) {
      return "❌ The bot cannot add reactions in that channel. Auto-react won't work.";
    }
  }

  if (checks.checkManageMessages) {
    if (!botMember.permissionsIn(channelId).has(PermissionFlagsBits.ManageMessages)) {
      return "❌ The bot cannot delete messages in that channel. Media-only won't work.";
    }
  }

  return null;
}

async function handleMeme(
  interaction: ChatInputCommandInteraction,
  settingsManager: SettingsManager
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "This command only works in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel<ChannelType.GuildText>("channel");
  const autoReact = interaction.options.getString("auto-react");
  const emojisRaw = interaction.options.getString("emojis");
  const mediaOnly = interaction.options.getString("media-only");
  const nothingProvided = !channel && !autoReact && !emojisRaw && !mediaOnly;

  if (channel && !interaction.guild?.channels.cache.has(channel.id)) {
    await interaction.reply({
      content: "❌ That channel does not belong to this server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // No options — show current config
  if (nothingProvided) {
    const { meme } = await settingsManager.getSettings(guildId);
    await interaction.reply({
      content: [
        "**Meme Module Settings**",
        `  • channel: ${meme.channelId ? `<#${meme.channelId}>` : "not set"}`,
        `  • auto-react: ${meme.autoReact.enabled ? "✅ on" : "❌ off"}`,
        `  • emojis: ${meme.autoReact.emojis.join(" ")}`,
        `  • media-only: ${meme.mediaOnly.enabled ? "✅ on" : "❌ off"}`,
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Validate emojis before anything else
  if (emojisRaw) {
    const emojis = parseEmojis(emojisRaw);

    if (emojis.length === 0) {
      await interaction.reply({
        content: "❌ No valid emojis found. Use unicode emojis or server custom emojis.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (emojis.length > MAX_REACT_EMOJIS) {
      await interaction.reply({
        content: `❌ Maximum ${MAX_REACT_EMOJIS} emojis allowed.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const invalidEmojis = emojis.filter((e) => !isValidEmoji(e));
    if (invalidEmojis.length > 0) {
      await interaction.reply({
        content: `❌ Invalid emoji(s): ${invalidEmojis.join(" ")}. Use unicode emojis or server custom emojis only.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // Read current settings to determine effective channel
  const current = await settingsManager.getSettings(guildId);

  // Effective channel: the new one if provided, otherwise the already saved one
  const effectiveChannelId = channel?.id ?? (current.meme.channelId || null);

  // Determine which permission checks are needed based on what's being activated
  const checks = getRequiredPermissionChecks({
    effectiveChannelId,
    activatingAutoReact: autoReact === "on",
    activatingMediaOnly: mediaOnly === "on",
  });

  // Run bot permission checks if there's a channel to validate against
  if (effectiveChannelId) {
    const permissionError = await validateBotChannelPermissions(
      interaction,
      effectiveChannelId,
      checks
    );
    if (permissionError) {
      await interaction.reply({
        content: permissionError,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // Apply changes
  const updated: AppSettings = JSON.parse(JSON.stringify(current));
  const changes: string[] = [];
  const warnings: string[] = [];

  if (channel) {
    updated.meme.channelId = channel.id;
    changes.push(`Channel → <#${channel.id}>`);
  }
  if (autoReact) {
    updated.meme.autoReact.enabled = autoReact === "on";
    changes.push(`Auto-react → ${autoReact === "on" ? "✅ on" : "❌ off"}`);
    if (autoReact === "on" && !effectiveChannelId) {
      warnings.push("⚠️ No channel configured yet. Set a channel for auto-react to work.");
    }
  }
  if (emojisRaw) {
    const emojis = parseEmojis(emojisRaw);
    updated.meme.autoReact.emojis = emojis;
    changes.push(`Emojis → ${emojis.join(" ")}`);
  }
  if (mediaOnly) {
    updated.meme.mediaOnly.enabled = mediaOnly === "on";
    changes.push(`Media-only → ${mediaOnly === "on" ? "✅ on" : "❌ off"}`);
    if (mediaOnly === "on" && !effectiveChannelId) {
      warnings.push("⚠️ No channel configured yet. Set a channel for media-only to work.");
    }
  }

  await settingsManager.saveSettings(guildId, updated);

  const lines = [`✅ Meme settings updated:\n${changes.join("\n")}`];
  if (warnings.length > 0) lines.push("", ...warnings);

  await interaction.reply({
    content: lines.join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}
