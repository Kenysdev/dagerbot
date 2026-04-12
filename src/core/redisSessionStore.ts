import { ChatMessage } from "./types";
import { SessionStore } from "./sessionStore";

export async function createRedisSessionStore(params: {
  historyLimit: number;
  sessionTtlSeconds: number;
  redisUrl: string;
}): Promise<SessionStore> {
  const { historyLimit, sessionTtlSeconds, redisUrl } = params;
  // Optional dependency: only required when REDIS_URL is set.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const redis = require("redis") as typeof import("redis");

  const client = redis.createClient({ url: redisUrl });
  client.on("error", (err: Error) => {
    console.error("Redis error:", err);
  });
  await client.connect();

  function key(sessionId: string) {
    return `session:${sessionId}`;
  }

  async function load(sessionId: string): Promise<{ history: ChatMessage[] }> {
    const raw = await client.get(key(sessionId));
    if (!raw) return { history: [] };
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.history)) return { history: [] };
      return parsed;
    } catch {
      return { history: [] };
    }
  }

  async function save(sessionId: string, data: { history: ChatMessage[] }) {
    await client.set(key(sessionId), JSON.stringify({ history: data.history }), {
      EX: sessionTtlSeconds,
    });
  }

  function trim(history: ChatMessage[]) {
    if (history.length <= historyLimit) return;
    history.splice(0, history.length - historyLimit);
  }

  return {
    async getHistory(sessionId) {
      if (!historyLimit) return [];
      const data = await load(sessionId);
      await save(sessionId, data);
      return data.history.slice();
    },
    async appendUser(sessionId, text) {
      if (!historyLimit) return;
      const data = await load(sessionId);
      data.history.push({ role: "user", content: text });
      trim(data.history);
      await save(sessionId, data);
    },
    async appendAssistant(sessionId, text) {
      if (!historyLimit) return;
      const data = await load(sessionId);
      data.history.push({ role: "assistant", content: text });
      trim(data.history);
      await save(sessionId, data);
    },
  };
}