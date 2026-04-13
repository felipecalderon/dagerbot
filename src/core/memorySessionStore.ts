import { ChatMessage } from "./types";
import { SessionStore } from "./sessionStore";

export function createMemorySessionStore(params: {
  historyLimit: number;
  sessionTtlSeconds: number;
}): SessionStore {
  const { historyLimit, sessionTtlSeconds } = params;
  const sessions = new Map<
    string,
    { history: ChatMessage[]; expiresAt: number }
  >();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) {
        sessions.delete(id);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanup.unref) cleanup.unref();

  function getSession(sessionId: string) {
    const now = Date.now();
    const existing = sessions.get(sessionId);
    if (existing && existing.expiresAt > now) {
      existing.expiresAt = now + sessionTtlSeconds * 1000;
      return existing;
    }
    const fresh = {
      history: [],
      expiresAt: now + sessionTtlSeconds * 1000,
    };
    sessions.set(sessionId, fresh);
    return fresh;
  }

  function trim(history: ChatMessage[]) {
    if (history.length <= historyLimit) return;
    history.splice(0, history.length - historyLimit);
  }

  return {
    async getHistory(sessionId) {
      if (!historyLimit) return [];
      return getSession(sessionId).history.slice();
    },
    async appendUser(sessionId, text) {
      if (!historyLimit) return;
      const session = getSession(sessionId);
      session.history.push({ role: "user", content: text });
      trim(session.history);
    },
    async appendAssistant(sessionId, text) {
      if (!historyLimit) return;
      const session = getSession(sessionId);
      session.history.push({ role: "assistant", content: text });
      trim(session.history);
    },
  };
}
