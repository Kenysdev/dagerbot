import type { ChatMessage } from "../../core/types.js";
import type { SessionRepository } from "../types.js";

export function createMemorySessionRepository(): SessionRepository {
  const sessions = new Map<string, { history: ChatMessage[]; expiresAt: number }>();

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
