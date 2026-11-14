import { PermissionFlagsBits, type Message } from "discord.js";
import type { ChannelGuardSettings } from "../../../core/types.js";
import type { ChannelGuardRepository } from "../../../data/types.js";
import { syncCucumberPanel } from "./channelGuardPanel.js";
import { resolvePurgeSeconds } from "../../../features/channelGuard.js";

// Authority over people: staff stays exempt even if the whitelist was never set.
const MODERATION_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
];

// Collapses a burst from the same account into a single ban call.
const banInFlight = new Set<string>();

export async function handleChannelGuard(
  message: Message,
  config: ChannelGuardSettings,
  repository: ChannelGuardRepository
): Promise<void> {
  if (!config.enabled || !config.channelId || !message.guild) return;
  if (message.channelId !== config.channelId) return;

  const context = `guild=${message.guild.id} user=${message.author.id}`;
  const member = message.member;

  // No exemption can be evaluated without member data, and a wrong ban is permanent.
  if (!member) {
    console.warn(`[channelGuard] ${context}: no member data, skipping`);
    return;
  }

  // roles.cache holds the member's roles minus the ones the bot has not cached,
  // so anything checked against it can miss a role the member really has.
  // _roles is the list the message payload carried, and it is always complete.
  const rawRoles = (member as unknown as { _roles?: unknown })._roles;
  const memberRoleIds = Array.isArray(rawRoles)
    ? (rawRoles as string[])
    : [...member.roles.cache.keys()];

  const hasIgnoredRole = memberRoleIds.some((id) => config.ignoredRoleIds.includes(id));
  if (hasIgnoredRole) return;

  // Permissions cannot be compared by id: discord.js adds them up from the role
  // objects, so an uncached role is a permission the bot cannot see. Staff would
  // then read as an ordinary member and get banned, which is the one thing this
  // guard must never do.
  if (!memberRoleIds.every((id) => message.guild?.roles.cache.has(id))) {
    console.warn(`[channelGuard] ${context}: roles not cached, cannot verify — skipping`);
    return;
  }

  if (member.permissions.any(MODERATION_PERMISSIONS)) return;

  // `bannable` reads the bot's own member, so it has to be resolved first.
  if (!message.guild.members.me) {
    await message.guild.members.fetchMe().catch((err) => {
      console.error(`[channelGuard] ${context}: could not fetch the bot's own member:`, err);
    });
  }

  if (!message.guild.members.me) return;

  if (!member.bannable) {
    console.warn(
      `[channelGuard] ${context}: cannot ban this member — check the bot's Ban Members permission and its role position`
    );
    return;
  }

  const key = `${message.guild.id}:${message.author.id}`;
  if (banInFlight.has(key)) return;
  banInFlight.add(key);

  const cucumberEaterName = message.member?.displayName ?? message.author.username;
  // The panel counts bans, so it only moves when one went through.
  let banned = false;

  try {
    try {
      if (message.deletable) {
        await message.delete();
      }
    } catch (err) {
      console.error(`[channelGuard] ${context}: failed to delete message:`, err);
    }

    try {
      await message.guild.members.ban(message.author.id, {
        reason: "Spam",
        deleteMessageSeconds: resolvePurgeSeconds(config.deleteMessageSeconds),
      });
      banned = true;
    } catch (err) {
      console.error(`[channelGuard] ${context}: failed to ban user:`, err);
    }
  } finally {
    banInFlight.delete(key);
  }

  if (!banned) return;

  try {
    await repository.recordCatch(message.guild.id, cucumberEaterName, Date.now());
  } catch (err) {
    console.error("[channelGuardListener] Failed to record catch:", err);
  }

  await syncCucumberPanel(message.channel, message.guild.id, repository).catch((err) => {
    console.error("[channelGuardListener] Failed to sync panel:", err);
  });
}
