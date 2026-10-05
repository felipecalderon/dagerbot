// Chat history kept in the process, deliberately: it is working context for the
// model, not a record worth preserving, and it is bounded by historyLimit and
// SESSION_TTL_SECONDS on both ends. The cost is that a restart clears it.
//
// A SQLite-backed implementation would only buy surviving restarts, and would
// need: a `chats` table (session_id TEXT PRIMARY KEY, history TEXT as JSON,
// expires_at INTEGER) STRICT; write-through on every append; and expiry by hand,
// since SQLite has no TTL index — filter `WHERE expires_at > ?` on read and
// delete expired rows on the same timer this file uses to sweep.
import type { ChatMessage } from "../../core/types.js";
import type { SessionRepository } from "../types.js";

const SWEEP_INTERVAL_MS = 60_000;

export function createMemorySessionRepository(): SessionRepository {
  const sessions = new Map<string, { history: ChatMessage[]; expiresAt: number }>();

  // Expired sessions are only overwritten when that exact id is used again, so
  // without this sweep the map keeps every session ever seen — each holding its
  // messages — for the lifetime of the process. This mirrors what the TTL index
  // does on the Mongo side, and unref() keeps it from holding the process open.
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(id);
    }
  }, SWEEP_INTERVAL_MS).unref();

  function getSession(sessionId: string, sessionTtlSeconds: number) {
    const now = Date.now();
    const existing = sessions.get(sessionId);
    if (existing && existing.expiresAt > now) {
      existing.expiresAt = now + sessionTtlSeconds * 1000;
      return existing;
    }
    const fresh = { history: [], expiresAt: now + sessionTtlSeconds * 1000 };
    sessions.set(sessionId, fresh);
    return fresh;
  }

  return {
    getHistory: async (sessionId, { historyLimit, sessionTtlSeconds }) => {
      if (!historyLimit) return [];
      return getSession(sessionId, sessionTtlSeconds).history.slice();
    },

    append: async (sessionId, message, { historyLimit, sessionTtlSeconds }) => {
      if (!historyLimit) return;
      const session = getSession(sessionId, sessionTtlSeconds);
      session.history.push(message);
      if (session.history.length > historyLimit) {
        session.history.splice(0, session.history.length - historyLimit);
      }
    },
  };
}
