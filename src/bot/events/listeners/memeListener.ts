import type { Message } from "discord.js";
import type { MemeSettings, MemeRewardSettings } from "../../../core/types.js";
import type { MemeRepository } from "../../../data/types.js";
import {
  hasMediaAttachment,
  selectEmojis,
  hasReachedGoal,
  buildRewardMessage,
} from "../../../features/meme.js";

export async function handleMeme(
  message: Message,
  config: MemeSettings
): Promise<void> {
  if (!config.channelId || message.channelId !== config.channelId) return;

  const contentTypes = [...message.attachments.values()].map((a) => a.contentType);
  const hasMedia = hasMediaAttachment(contentTypes);

  if (config.autoReact.enabled && hasMedia) {
    const toReact = selectEmojis(config.autoReact.emojis, config.autoReact.random);
    for (const emoji of toReact) {
      // One emoji Discord refuses must not cancel the ones after it.
      await message.react(emoji).catch((err) => {
        console.error(`[memeFeature] could not react with ${emoji}:`, err);
      });
    }
  }

  if (config.mediaOnly.enabled && !hasMedia) {
    // Requires "Manage Messages" permission in the meme channel
    await message.delete();
  }
}

export async function handleMemeReward(
  message: Message,
  config: MemeRewardSettings,
  memeConfig: MemeSettings,
  memeRepository: MemeRepository
): Promise<void> {
  if (!config.enabled || !config.roleId || !message.guildId) return;
  if (!memeConfig.channelId || message.channelId !== memeConfig.channelId) return;

  const contentTypes = [...message.attachments.values()].map((a) => a.contentType);
  if (!hasMediaAttachment(contentTypes)) return;

  const { count } = await memeRepository.increment(message.guildId, message.author.id);
  if (!hasReachedGoal(count, config.goal)) return;

  const member = await message.guild?.members.fetch(message.author.id);
  if (!member) return;

  // Skip if member already has the role
  if (member.roles.cache.has(config.roleId)) return;

  await member.roles.add(config.roleId);

  const rewardMessage = buildRewardMessage(
    config.message,
    `<@${message.author.id}>`,
    `<@&${config.roleId}>`
  );
  if (message.channel.isTextBased() && !message.channel.isDMBased()) {
    await message.channel.send(rewardMessage);
  }
}
