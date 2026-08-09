import type { AppSettings, SettingsManager } from "../core/types.js";
import type { SettingsRepository } from "../data/types.js";
import { DEFAULT_PURGE_SECONDS } from "../features/channelGuard.js";

/**
 * Dynamic settings manager — multi-server implementation.
 *
 * Stores each guild's config as a versioned JSON row, keyed by guildId.
 * On startup, auto-repairs all guilds to ensure new feature fields are present.
 * The database provider is injected — see src/data/ for available providers.
 *
 * Adding a new feature:
 *   1. Add its types to core/types.ts
 *   2. Add its defaults to defaultSettings() below
 *   3. Call getSettings(guildId) wherever needed
 *   See docs/extensibility-es.md for the full guide.
 */

const CURRENT_SETTINGS_VERSION = 1;

// Source of truth for default values.
// When adding a new feature, add its defaults here.
function defaultSettings(): AppSettings {
  return {
    meme: {
      channelId: "",
      autoReact: { enabled: false, random: false, emojis: ["🔥", "😂", "👍"] },
      mediaOnly: { enabled: false },
    },
    memeReward: {
      enabled: false,
      roleId: "",
      goal: 50,
      message: "🎉 Congratulations {user}! You’ve reached the goal and earned the {role} role.",
    },
    channelGuard: {
      enabled: false,
      channelId: "",
      ignoredRoleIds: [],
      deleteMessageSeconds: DEFAULT_PURGE_SECONDS,
    },
  };
}

// Deep merge: fills missing fields with defaults without overwriting existing values.
// Handles arrays as complete user preferences — never merges array elements individually.
// This allows adding new features without writing migrations for existing guilds.
function mergeDefaults<T>(defaults: T, data: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(data) && data.length > 0 ? data : defaults) as T;
  }
  if (typeof defaults !== "object" || defaults === null) {
    return (data !== undefined && data !== null ? data : defaults) as T;
  }
  const result: Record<string, unknown> = {};
  for (const key in defaults) {
    result[key] = mergeDefaults(
      (defaults as Record<string, unknown>)[key],
      (data as Record<string, unknown> | null | undefined)?.[key]
    );
  }
  return result as T;
}

type StoredRow = { version: number; data: AppSettings };

export async function createSettingsManager(
  repository: SettingsRepository
): Promise<SettingsManager> {
  // Repair outdated configs before the bot starts serving requests.
  await repository.repairAll((raw) => {
    const parsed = JSON.parse(raw) as StoredRow | AppSettings;
    // Support both old format (raw AppSettings) and new format ({ version, data })
    const rawData = "data" in parsed ? parsed.data : parsed;
    const repaired = mergeDefaults(defaultSettings(), rawData);
    return JSON.stringify({ version: CURRENT_SETTINGS_VERSION, data: repaired });
  });

  return {
    getSettings: async (guildId: string): Promise<Readonly<AppSettings>> => {
      const raw = await repository.findById(guildId);

      if (!raw) {
        // Lazy init: first access creates the guild's config with defaults
        const defaults = defaultSettings();
        await repository.save(
          guildId,
          JSON.stringify({ version: CURRENT_SETTINGS_VERSION, data: defaults })
        );
        return defaults;
      }

      const parsed = JSON.parse(raw) as StoredRow;
      return mergeDefaults(defaultSettings(), parsed.data);
    },

    saveSettings: async (guildId: string, updated: AppSettings): Promise<void> => {
      await repository.save(
        guildId,
        JSON.stringify({ version: CURRENT_SETTINGS_VERSION, data: updated })
      );
    },
  };
}
