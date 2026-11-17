import {
  PermissionFlagsBits,
  SnowflakeUtil,
  type Client,
  type GuildTextBasedChannel,
} from "discord.js";
import type { SettingsManager } from "../../../core/types.js";
import type { ChannelGuardRepository } from "../../../data/types.js";
import { bulkDeleteTargets } from "../../../features/channelGuard.js";
import { syncCucumberPanel } from "./channelGuardPanel.js";

export const CHANNEL_GUARD_RETENTION_MS = 24 * 60 * 60 * 1000;

const PAGE_SIZE = 100;

// Note: the cutoff is a snowflake from the clock, so a restart finds what aged
// out with no stored schedule.
export async function purgeStaleMessages(
  channel: GuildTextBasedChannel,
  panelMessageId: string,
  now: number
): Promise<number> {
  let before = SnowflakeUtil.generate({
    timestamp: now - CHANNEL_GUARD_RETENTION_MS,
  }).toString();
  let deleted = 0;

  for (;;) {
    const batch = await channel.messages.fetch({ before, limit: PAGE_SIZE });
    if (batch.size === 0) break;

    const { bulk, single } = bulkDeleteTargets(batch.values(), panelMessageId, now);

    if (bulk.length > 0) {
      deleted += (await channel.bulkDelete(bulk, true)).size;
    }

    for (const message of single) {
      try {
        await message.delete();
        deleted += 1;
      } catch (err) {
        console.error(
          `[channelGuardCleanup] Failed to delete message ${message.id}:`,
          err
        );
      }
    }

    // Note: advance past this page's oldest message; exempt messages stay, so a
    // fixed cutoff would fetch them again.
    before = batch.last()!.id;
    if (batch.size < PAGE_SIZE) break;
  }

  return deleted;
}

export async function sweepGuardedChannels(
  client: Client,
  settingsManager: SettingsManager,
  repository: ChannelGuardRepository
): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      const settings = await settingsManager.getSettings(guild.id);
      const { enabled, channelId } = settings.channelGuard;
      if (!enabled || !channelId) continue;

      const me = guild.members.me;
      if (
        !me ||
        !me
          .permissionsIn(channelId)
          .has([
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ])
      ) {
        // Note: /config refuses to arm without these; if revoked, stay quiet
        // instead of logging every hour.
        continue;
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (
        !channel?.isTextBased() ||
        channel.isDMBased() ||
        !channel.isSendable()
      ) {
        continue;
      }

      const now = Date.now();
      const panelMessageId =
        (await repository.get(guild.id))?.panelMessageId ?? "";
      const cleared = await purgeStaleMessages(channel, panelMessageId, now);
      if (cleared === 0) continue;

      await repository.markChannelCleared(guild.id, now, cleared);
      await syncCucumberPanel(channel, guild.id, repository);
    } catch (err) {
      console.error(
        `[channelGuardCleanup] Failed to sweep guild ${guild.id}:`,
        err
      );
    }
  }
}
