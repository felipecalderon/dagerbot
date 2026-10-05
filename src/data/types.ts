// Core data layer contracts.
// DbProvider: infrastructure contract — any database must implement this.
// Repository<T>: data operations contract — typed per feature.

import type { ChatMessage } from "../core/types.js";

export type DbProvider = {
  name: "sqlite" | "mongo";
  initialize: () => Promise<void>;
};

export type SettingsRepository = {
  findById: (guildId: string) => Promise<string | null>;
  save: (guildId: string, raw: string) => Promise<void>;
  repairAll: (repairFn: (raw: string) => string) => Promise<void>;
};

export type MemeCount = {
  guildId: string;
  userId: string;
  count: number;
  startedAt: number;
  updatedAt: number;
};

export type MemeRepository = {
  increment: (guildId: string, userId: string) => Promise<MemeCount>;
  getCount: (guildId: string, userId: string) => Promise<number>;
  getTopCounts: (guildId: string, limit: number, offset: number) => Promise<MemeCount[]>;
  getTotalUsers: (guildId: string) => Promise<number>;
};

// Not persisted forever: the policy caps how much history is kept and for how
// long, the same way limit/offset shape a MemeRepository query. The caller
// decides the policy per call, same as any other repository — a session
// repository is not special because its data happens to be short-lived.
export type SessionPolicy = {
  historyLimit: number;
  sessionTtlSeconds: number;
};

export type SessionRepository = {
  getHistory: (sessionId: string, policy: SessionPolicy) => Promise<ChatMessage[]>;
  append: (sessionId: string, message: ChatMessage, policy: SessionPolicy) => Promise<void>;
};
