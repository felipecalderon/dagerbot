import "dotenv/config";
import { DEFAULT_SYSTEM_PROMPT } from "./prompt";

export type AppConfig = {
  port: number;
  maxInputChars: number;
  historyLimit: number;
  sessionTtlSeconds: number;
  rateLimitIpPerMin: number;
  rateLimitSessionPerMin: number;
  openAiModel: string;
  redisUrl: string;
  systemPrompt: string;
  botTimezone: string;
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
    systemPrompt: process.env.OPENAI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
    botTimezone: process.env.BOT_TIMEZONE || "America/Santiago",
  };
}
