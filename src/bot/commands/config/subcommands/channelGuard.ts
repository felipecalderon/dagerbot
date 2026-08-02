import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import type { SettingsManager } from "../../../../core/types.js";
import type { ChannelGuardRepository } from "../../../../data/types.js";
import { syncCucumberPanel } from "../../../events/listeners/channelGuardPanel.js";
import {
  MAX_PURGE_SECONDS,
  formatChannelGuardSettings,
} from "../../../../features/channelGuard.js";

type SubcommandMap = Map<
  string,
  (i: ChatInputCommandInteraction, s: SettingsManager) => Promise<void>
>;

async function validateChannelGuardPermissions(
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<string | null> {
  const botMember = await interaction.guild?.members.fetchMe();
  if (!botMember) return "❌ Could not verify bot permissions.";

  const errors: string[] = [];

  if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
    errors.push("❌ The bot cannot ban members, so the trap would never act.");
  }

  if (channelId) {
    if (!botMember.permissionsIn(channelId).has(PermissionFlagsBits.ViewChannel)) {
      errors.push("❌ The bot cannot see the trap channel, so it never sees what is posted there.");
    }
    if (!botMember.permissionsIn(channelId).has(PermissionFlagsBits.ManageMessages)) {
      errors.push("❌ The bot cannot delete messages in the trap channel.");
    }
  }

  return errors.length > 0 ? errors.join("\n") : null;
}

export function channelGuardSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap,
  channelGuardRepository: ChannelGuardRepository
): void {
  builder.addSubcommand((sub) =>
    sub
      .setName("channel-guard")
      .setDescription("Trap channel — everyone who posts there is banned")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Trap channel: must be unused, everyone who posts there is banned")
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addStringOption((opt) =>
        opt
          .setName("status")
          .setDescription("Enable or disable channel guard")
          .setRequired(false)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      )
      .addRoleOption((opt) =>
        opt
          .setName("add-ignored-role")
          .setDescription("Role to whitelist from channel guard")
          .setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName("add-ignored-role-2")
          .setDescription("Second role to whitelist from channel guard")
          .setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName("add-ignored-role-3")
          .setDescription("Third role to whitelist from channel guard")
          .setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName("remove-ignored-role")
          .setDescription("Role to remove from channel guard whitelist")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("ignored-roles")
          .setDescription("Space or comma-separated role mentions/IDs to add (e.g. @Role1 @Role2)")
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("purge-seconds")
          .setDescription("Seconds of the banned user's history to delete, server-wide (0-604800)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(MAX_PURGE_SECONDS)
      )
  );

  handlers.set("channel-guard", async (interaction, settingsManager) => {
    if (!interaction.guildId) return;
    const guildId = interaction.guildId;

    const channel = interaction.options.getChannel("channel");
    const statusStr = interaction.options.getString("status");
    const addRoles = [
      interaction.options.getRole("add-ignored-role"),
      interaction.options.getRole("add-ignored-role-2"),
      interaction.options.getRole("add-ignored-role-3"),
    ].filter((r): r is NonNullable<typeof r> => r !== null);

    const removeRole = interaction.options.getRole("remove-ignored-role");
    const rawRolesStr = interaction.options.getString("ignored-roles");
    const purgeSeconds = interaction.options.getInteger("purge-seconds");

    const current = await settingsManager.getSettings(guildId);
    const previousChannelId = current.channelGuard.channelId;
    let updatedGuard = { ...current.channelGuard };
    let hasChanges = false;
    const changes: string[] = [];
    const warnings: string[] = [];

    if (channel) {
      updatedGuard.channelId = channel.id;
      changes.push(`Channel set to <#${channel.id}>`);
      hasChanges = true;
    }

    if (statusStr) {
      updatedGuard.enabled = statusStr === "on";
      changes.push(`Channel guard set to **${statusStr}**`);
      hasChanges = true;
    }

    if (purgeSeconds !== null) {
      updatedGuard.deleteMessageSeconds = purgeSeconds;
      changes.push(`Purge window set to ${purgeSeconds}s`);
      hasChanges = true;
    }

    for (const role of addRoles) {
      if (!updatedGuard.ignoredRoleIds.includes(role.id)) {
        updatedGuard.ignoredRoleIds = [...updatedGuard.ignoredRoleIds, role.id];
        changes.push(`Added <@&${role.id}> to ignored roles`);
        hasChanges = true;
      }
    }

    if (rawRolesStr) {
      // Parse role mentions <@&ID> or raw IDs
      const matches = rawRolesStr.match(/\d+/g) ?? [];
      for (const roleId of matches) {
        if (!updatedGuard.ignoredRoleIds.includes(roleId)) {
          updatedGuard.ignoredRoleIds = [...updatedGuard.ignoredRoleIds, roleId];
          changes.push(`Added <@&${roleId}> to ignored roles`);
          hasChanges = true;
        }
      }
    }

    if (removeRole) {
      if (updatedGuard.ignoredRoleIds.includes(removeRole.id)) {
        updatedGuard.ignoredRoleIds = updatedGuard.ignoredRoleIds.filter(
          (id) => id !== removeRole.id
        );
        changes.push(`Removed <@&${removeRole.id}> from ignored roles`);
        hasChanges = true;
      } else {
        changes.push(`Role <@&${removeRole.id}> was not in the ignored list`);
      }
    }

    if (!hasChanges && changes.length === 0) {
      await interaction.reply({
        content: [
          "🛡️ **channel-guard** — trap channel: everyone who posts there is banned",
          ...formatChannelGuardSettings(updatedGuard),
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Arming a ban trap on a bot that cannot ban leaves it firing and failing in silence.
    if (updatedGuard.enabled) {
      const permissionError = await validateChannelGuardPermissions(
        interaction,
        updatedGuard.channelId
      );
      if (permissionError) {
        await interaction.reply({
          content: permissionError,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (updatedGuard.enabled && !updatedGuard.channelId) {
      warnings.push("⚠️ No trap channel configured. The guard does nothing until you set one.");
    }

    if (hasChanges) {
      await settingsManager.saveSettings(guildId, {
        ...current,
        channelGuard: updatedGuard,
      });

      const guild = interaction.guild;
      if (guild) {
        try {
          const previousPanelId = (await channelGuardRepository.get(guildId))
            ?.panelMessageId;

          // Drop the old sign when the guard moves or turns off. Stats stay in
          // the database, so re-enabling restores the counter.
          if (previousPanelId && (previousChannelId !== updatedGuard.channelId || !updatedGuard.enabled)) {
            const oldChannel = previousChannelId
              ? await guild.channels.fetch(previousChannelId).catch(() => null)
              : null;
            if (oldChannel?.isTextBased() && oldChannel.isSendable()) {
              await oldChannel.messages
                .fetch(previousPanelId)
                .then((message) => message.delete())
                .catch(() => undefined);
            }
            await channelGuardRepository.savePanelMessageId(guildId, "");
          }

          if (updatedGuard.enabled && updatedGuard.channelId) {
            const target = await guild.channels
              .fetch(updatedGuard.channelId)
              .catch(() => null);
            if (!target?.isTextBased() || !target.isSendable()) {
              changes.push("⚠️ Panel not posted: the channel could not be accessed.");
            } else {
              await syncCucumberPanel(target, guildId, channelGuardRepository);
            }
          }
        } catch (err) {
          console.error("[channelGuard] Failed to sync panel:", err);
          changes.push(
            "⚠️ Settings saved, but the panel could not be updated. Check the bot's channel permissions."
          );
        }
      }
    }

    const lines = [
      `**Updated Channel Guard Settings:**\n${changes.map((c) => `• ${c}`).join("\n")}`,
    ];
    if (warnings.length > 0) lines.push("", ...warnings);

    await interaction.reply({
      content: lines.join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  });
}
