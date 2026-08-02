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
