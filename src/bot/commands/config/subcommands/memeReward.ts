import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import type { AppSettings, SettingsManager } from "../../../../core/types.js";
import { formatMemeRewardSettings } from "../../../../features/meme.js";

type SubcommandMap = Map<
  string,
  (i: ChatInputCommandInteraction, s: SettingsManager) => Promise<void>
>;

export function memeRewardSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand((sub) =>
    sub
      .setName("meme-reward")
      .setDescription("View or update meme role reward settings")
      .addStringOption((opt) =>
        opt
          .setName("enabled")
          .setDescription("Enable or disable meme role reward")
          .setRequired(false)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      )
      .addRoleOption((opt) =>
        opt
          .setName("role")
          .setDescription("Role to assign when goal is reached")
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("goal")
          .setDescription("Number of memes needed to earn the role")
          .setRequired(false)
          .setMinValue(1)
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription(
            "Reward message — use {user} and {role} as placeholders"
          )
          .setRequired(false)
      )
  );

  handlers.set("meme-reward", handleMemeReward);
}

async function validateMemeRewardPermissions(
  interaction: ChatInputCommandInteraction,
  channelId: string | null,
  roleId: string | null
): Promise<string | null> {
  const botMember = await interaction.guild?.members.fetchMe();
  if (!botMember) return "❌ Could not verify bot permissions.";

  const errors: string[] = [];

  if (channelId) {
    if (!botMember.permissionsIn(channelId).has(PermissionFlagsBits.SendMessages)) {
      errors.push("❌ The bot cannot send messages in the meme channel.");
    }
  }

  if (roleId) {
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      errors.push("❌ The bot does not have permission to manage roles.");
    } else {
      const targetRole = await interaction.guild?.roles.fetch(roleId);
      if (targetRole && botMember.roles.highest.position <= targetRole.position) {
        errors.push("❌ The bot's role must be higher than the reward role in the hierarchy.");
      }
    }
  }

  return errors.length > 0 ? errors.join("\n") : null;
}

async function handleMemeReward(
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
  const enabled = interaction.options.getString("enabled");
  const role = interaction.options.getRole("role");
  const goal = interaction.options.getInteger("goal");
  const message = interaction.options.getString("message");
  const nothingProvided = !enabled && !role && !goal && !message;

  if (nothingProvided) {
    const { memeReward } = await settingsManager.getSettings(guildId);
    await interaction.reply({
      content: [
        "**Meme Reward Settings**",
        ...formatMemeRewardSettings(memeReward),
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const current = await settingsManager.getSettings(guildId);

  const permissionError = await validateMemeRewardPermissions(
    interaction,
    enabled === "on" ? current.meme.channelId : null,
    role?.id ?? (enabled === "on" ? current.memeReward.roleId : null)
  );
  if (permissionError) {
    await interaction.reply({
      content: permissionError,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const updated: AppSettings = JSON.parse(JSON.stringify(current));
  const changes: string[] = [];
  const warnings: string[] = [];

  if (enabled) {
    updated.memeReward.enabled = enabled === "on";
    changes.push(`Enabled → ${enabled === "on" ? "✅ on" : "❌ off"}`);
  }
  if (role) {
    updated.memeReward.roleId = role.id;
    changes.push(`Role → <@&${role.id}>`);
  }
  if (goal) {
    updated.memeReward.goal = goal;
    changes.push(`Goal → ${goal} memes`);
  }
  if (message) {
    updated.memeReward.message = message;
    changes.push(`Message → ${message}`);
  }
  if (enabled === "on" && !current.meme.channelId) {
    warnings.push("⚠️ No meme channel configured. Set one with `/config meme` first.");
  }
  if (enabled === "on" && !updated.memeReward.roleId) {
    warnings.push("⚠️ No role configured yet.");
  }

  await settingsManager.saveSettings(guildId, updated);

  const lines = [`✅ Meme reward settings updated:\n${changes.join("\n")}`];
  if (warnings.length > 0) lines.push("", ...warnings);

  await interaction.reply({
    content: lines.join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}
