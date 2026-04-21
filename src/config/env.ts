import "dotenv/config";
import { DEFAULT_SYSTEM_PROMPT } from "./prompt";

export type ProviderName = "openai" | "anthropic" | "google";

export type AppConfig = {
  port: number;
  maxInputChars: number;
  historyLimit: number;
  sessionTtlSeconds: number;
  rateLimitIpPerMin: number;
  rateLimitSessionPerMin: number;
  llmProvider: ProviderName;
  openAiModel: string;
  anthropicModel: string;
  googleModel: string;
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

function readProvider(raw: string | undefined): ProviderName {
  if (raw === "anthropic" || raw === "google" || raw === "openai") return raw;
  if (raw !== undefined) {
    throw new Error(`Invalid LLM_PROVIDER="${raw}". Valid values: openai, anthropic, google`);
  }
  return "openai";
}

export function loadConfig(): AppConfig {
  return {
    port: readNumber("PORT", 3000),
    maxInputChars: readNumber("MAX_INPUT_CHARS", 4096),
    historyLimit: readNumber("HISTORY_LIMIT", 10),
    sessionTtlSeconds: readNumber("SESSION_TTL_SECONDS", 3600),
    rateLimitIpPerMin: readNumber("RATE_LIMIT_IP_PER_MIN", 60),
    rateLimitSessionPerMin: readNumber("RATE_LIMIT_SESSION_PER_MIN", 100),
    llmProvider: readProvider(process.env.LLM_PROVIDER),
    openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    googleModel: process.env.GOOGLE_MODEL || "gemini-2.0-flash",
    redisUrl: process.env.REDIS_URL || "",
    systemPrompt: process.env.LLM_SYSTEM_PROMPT || process.env.OPENAI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
    botTimezone: process.env.BOT_TIMEZONE || "America/Santiago",
  };
}
