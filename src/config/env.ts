import "dotenv/config";

export type AppConfig = {
  port: number;
  maxInputChars: number;
  historyLimit: number;
  sessionTtlSeconds: number;
  rateLimitIpPerMin: number;
  rateLimitSessionPerMin: number;
  openAiModel: string;
  redisUrl: string;
};

function readNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  return {
    port: readNumber("PORT", 3000),
    maxInputChars: readNumber("MAX_INPUT_CHARS", 4096),
    historyLimit: readNumber("HISTORY_LIMIT", 10),
    sessionTtlSeconds: readNumber("SESSION_TTL_SECONDS", 3600),
    rateLimitIpPerMin: readNumber("RATE_LIMIT_IP_PER_MIN", 60),
    rateLimitSessionPerMin: readNumber("RATE_LIMIT_SESSION_PER_MIN", 100),
    openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    redisUrl: process.env.REDIS_URL || "",
  };
}

export const VALID_CONFIG_PERMISSIONS = [
  "Administrator",
  "ManageGuild",
  "BanMembers",
  "KickMembers",
  "ModerateMembers",
  "ManageChannels",
] as const;

export type ConfigPermission = (typeof VALID_CONFIG_PERMISSIONS)[number];
