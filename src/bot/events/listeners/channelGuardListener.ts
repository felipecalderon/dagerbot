import type { Message } from "discord.js";
import type { ChannelGuardSettings } from "../../../core/types.js";
import type { ChannelGuardRepository } from "../../../data/types.js";
import { syncCucumberPanel } from "./channelGuardPanel.js";

export async function handleChannelGuard(
  message: Message,
  config: ChannelGuardSettings,
  repository: ChannelGuardRepository
): Promise<void> {
  if (!config.enabled || !config.channelId || !message.guild) return;
  if (message.channelId !== config.channelId) return;

  // Check if member has an ignored role
  if (message.member) {
    const hasIgnoredRole = message.member.roles.cache.some((role) =>
      config.ignoredRoleIds.includes(role.id)
    );
    if (hasIgnoredRole) return;
  }

  const cucumberEaterName = message.member?.displayName ?? message.author.username;

  // Delete message first if possible
  try {
    if (message.deletable) {
      await message.delete();
    }
  } catch (err) {
    console.error("[channelGuardListener] Failed to delete message:", err);
  }

  // Ban user with reason "Spam" and delete messages sent in the specified time frame (default 1h)
  try {
    await message.guild.members.ban(message.author.id, {
      reason: "Spam",
      deleteMessageSeconds: config.deleteMessageSeconds || 3600,
    });
  } catch (err) {
    console.error("[channelGuardListener] Failed to ban user:", err);
    return;
  }

  try {
    await repository.recordCatch(message.guild.id, cucumberEaterName, Date.now());
  } catch (err) {
    console.error("[channelGuardListener] Failed to record catch:", err);
  }

  await syncCucumberPanel(message.channel, message.guild.id, repository).catch((err) => {
    console.error("[channelGuardListener] Failed to sync panel:", err);
  });
}
