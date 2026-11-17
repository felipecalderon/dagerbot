import type { MemeSettings, MemeRewardSettings } from "../core/types.js";

const MEDIA_MIME_PREFIXES = ["image/", "video/"] as const;

export const MAX_REACT_EMOJIS = 5;

export const DEFAULT_REWARD_MESSAGE =
  "🎉 Congratulations {user}! You’ve reached the goal and earned the {role} role.";

/**
 * Returns true if at least one attachment is an image or video.
 * Receives raw MIME types so this function stays pure and testable.
 */
export function hasMediaAttachment(contentTypes: (string | null)[]): boolean {
  return contentTypes.some(
    (type) =>
      type !== null &&
      MEDIA_MIME_PREFIXES.some((prefix) => type.startsWith(prefix))
  );
}

export type PermissionCheckContext = {
  effectiveChannelId: string | null;
  activatingAutoReact: boolean;
  activatingMediaOnly: boolean;
};

export type PermissionChecks = {
  checkViewChannel: boolean;
  checkAddReactions: boolean;
  checkManageMessages: boolean;
};

export function getRequiredPermissionChecks(
  ctx: PermissionCheckContext
): PermissionChecks {
  return {
    checkViewChannel: ctx.effectiveChannelId !== null,
    checkAddReactions: ctx.activatingAutoReact && ctx.effectiveChannelId !== null,
    checkManageMessages: ctx.activatingMediaOnly && ctx.effectiveChannelId !== null,
  };
}

export function selectEmojis(emojis: string[], random: boolean): string[] {
  if (emojis.length === 0) return [];

  if (random) {
    return [emojis[Math.floor(Math.random() * emojis.length)]];
  }
  return emojis;
}

export function hasReachedGoal(count: number, goal: number): boolean {
  return goal > 0 && count >= goal;
}

/**
 * Resolves the announcement template, falling back to the default when the
 * stored value cannot produce one. Discord refuses an empty send, and by then
 * the role has already been granted.
 * Receives the raw stored value so this function stays pure and testable.
 */
export function resolveRewardMessage(configured: unknown): string {
  if (typeof configured !== "string" || !configured.trim()) {
    return DEFAULT_REWARD_MESSAGE;
  }
  return configured;
}

export function buildRewardMessage(
  template: unknown,
  userMention: string,
  roleMention: string
): string {
  return resolveRewardMessage(template)
    .replace("{user}", userMention)
    .replace("{role}", roleMention);
}

export type RankEntry = {
  position: number;
  userId: string;
  count: number;
};

export function formatRankPage(
  entries: RankEntry[],
  page: number,
  totalPages: number
): string {
  const lines = entries.map((e) => {
    const pos = String(e.position).padStart(2, " ");
    return `\`${pos}.\` <@${e.userId}> — ${e.count}`;
  });
  return lines.join("\n") + `\n\nPage ${page}/${totalPages}`;
}

// The heading stays with the caller: /config meme titles a standalone reply,
// /config show titles a section inside a list.
export function formatMemeSettings(settings: MemeSettings): string[] {
  return [
    `  • channel: ${settings.channelId ? `<#${settings.channelId}>` : "not set"}`,
    `  • auto-react: ${settings.autoReact.enabled ? "✅ on" : "❌ off"}`,
    `  • random-react: ${settings.autoReact.random ? "✅ on" : "❌ off"}`,
    `  • emojis: ${settings.autoReact.emojis.join(" ")}`,
    `  • media-only: ${settings.mediaOnly.enabled ? "✅ on" : "❌ off"}`,
  ];
}

export function formatMemeRewardSettings(settings: MemeRewardSettings): string[] {
  return [
    `  • enabled: ${settings.enabled ? "✅ on" : "❌ off"}`,
    `  • role: ${settings.roleId ? `<@&${settings.roleId}>` : "not set"}`,
    `  • goal: ${settings.goal} memes`,
    `  • message: ${resolveRewardMessage(settings.message)}`,
  ];
}
