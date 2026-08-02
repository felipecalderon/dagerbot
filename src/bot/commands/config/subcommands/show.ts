import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import type { SettingsManager } from "../../../../core/types.js";
import { formatChannelGuardSettings } from "../../../../features/channelGuard.js";

type SubcommandMap = Map<
  string,
  (i: ChatInputCommandInteraction, s: SettingsManager) => Promise<void>
>;

export function showSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand((sub) =>
    sub.setName("show").setDescription("Show all features status")
  );

  handlers.set("show", handleShow);
}

async function handleShow(
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

  const { meme, memeReward, channelGuard } = await settingsManager.getSettings(interaction.guildId);

  await interaction.reply({
    content: [
      "**Bot Settings**",
      "",
      "🎭 **meme**",
      `  • channel: ${meme.channelId ? `<#${meme.channelId}>` : "not set"}`,
      `  • auto-react: ${meme.autoReact.enabled ? "✅ on" : "❌ off"}`,
      `  • random-react: ${meme.autoReact.random ? "✅ on" : "❌ off"}`,
      `  • emojis: ${meme.autoReact.emojis.join(" ")}`,
      `  • media-only: ${meme.mediaOnly.enabled ? "✅ on" : "❌ off"}`,
      ``,
      `🏆 **meme-reward**`,
      `  • enabled: ${memeReward.enabled ? "✅ on" : "❌ off"}`,
      `  • role: ${memeReward.roleId ? `<@&${memeReward.roleId}>` : "not set"}`,
      `  • goal: ${memeReward.goal} memes`,
      `  • message: ${memeReward.message || "not set"}`,
      ``,
      `🛡️ **channel-guard** — trap channel: everyone who posts there is banned`,
      ...formatChannelGuardSettings(channelGuard),
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}
