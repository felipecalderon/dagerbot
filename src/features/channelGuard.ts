import type { ChannelGuardSettings } from "../core/types.js";

// Discord's own cap for deleteMessageSeconds on a ban.
export const MAX_PURGE_SECONDS = 604800;

export const DEFAULT_PURGE_SECONDS = 3600;

/**
 * Resolves how much of the banned user's recent history to purge, in seconds.
 * Receives the raw stored value so this function stays pure and testable.
 */
export function resolvePurgeSeconds(configured: unknown): number {
  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    return DEFAULT_PURGE_SECONDS;
  }
  return Math.min(Math.max(Math.trunc(configured), 0), MAX_PURGE_SECONDS);
}

/**
 * Renders the guard's state, shared by `/config show` and `/config channel-guard`
 * so the two screens cannot drift apart. Callers supply their own heading.
 */
export function formatChannelGuardSettings(settings: ChannelGuardSettings): string[] {
  const purge = resolvePurgeSeconds(settings.deleteMessageSeconds);

  return [
    `  • status: ${settings.enabled ? "✅ on" : "❌ off"}`,
    `  • channel: ${settings.channelId ? `<#${settings.channelId}>` : "not set"}`,
    `  • purge: ${purge === 0 ? "nothing" : `${purge}s of the banned user's messages, server-wide`}`,
    `  • ignored-roles: ${
      settings.ignoredRoleIds.length > 0
        ? settings.ignoredRoleIds.map((id) => `<@&${id}>`).join(", ")
        : "none configured"
    }`,
    `  • always exempt: staff (admin · manage-server · ban · kick · timeout)`,
  ];
}

export type CucumberEater = {
  name: string;
  caughtAt: number;
};

// Backticks would close the inline-code span in the panel.
export function sanitizeCucumberEaterName(name: string): string {
  return name.replace(/`/g, "'").trim() || "unknown";
}

export function formatMostRecentCucumberEater(eater: CucumberEater | null): string {
  if (!eater) return "Nadie recibio hasta ahora.";
  const seconds = Math.floor(eater.caughtAt / 1000);
  return `\`${sanitizeCucumberEaterName(eater.name)}\` <t:${seconds}:R>`;
}
