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

const ROLE_TOKEN = /^(?:<@&(\d+)>|(\d+))$/;

/**
 * Splits a free-text list of role mentions or IDs. Anything that is neither comes
 * back untouched, so the caller can name it and refuse the whole input: a whitelist
 * that is applied halfway leaves people unprotected without saying so.
 */
export function parseRoleTokens(raw: string): { ids: string[]; invalid: string[] } {
  const ids: string[] = [];
  const invalid: string[] = [];

  for (const token of raw.split(/[\s,]+/).filter(Boolean)) {
    const match = ROLE_TOKEN.exec(token);
    if (match) ids.push(match[1] ?? match[2]);
    else invalid.push(token);
  }

  return { ids, invalid };
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

export function formatLastChannelClear(
  at: number | undefined,
  count: number | undefined
): string {
  if (!at) return "Todavía no.";
  const messages = count === 1 ? "1 mensaje" : `${count ?? 0} mensajes`;
  return `<t:${Math.floor(at / 1000)}:R> (${messages})`;
}

// Note: Discord bulk-deletes only messages under 14 days old.
// shortcut: older messages go one by one, revisit if the bot stays offline for weeks.
export const BULK_DELETE_MAX_AGE_MS = 13 * 24 * 60 * 60 * 1000;

type ClearableMessage = {
  id: string;
  createdTimestamp: number;
  pinned: boolean;
  author: { bot: boolean };
};

// Note: skips the panel, pinned messages and bot posts; splits the rest by the
// 14-day bulk-delete limit.
export function bulkDeleteTargets<T extends ClearableMessage>(
  messages: Iterable<T>,
  panelMessageId: string,
  now: number
): { bulk: T[]; single: T[] } {
  const bulk: T[] = [];
  const single: T[] = [];

  for (const message of messages) {
    if (message.id === panelMessageId || message.pinned || message.author.bot) continue;
    if (now - message.createdTimestamp < BULK_DELETE_MAX_AGE_MS) bulk.push(message);
    else single.push(message);
  }

  return { bulk, single };
}
