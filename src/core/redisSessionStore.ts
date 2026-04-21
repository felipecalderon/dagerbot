import { createClient } from "redis";
import { ChatMessage } from "./types";
import { SessionStore } from "./sessionStore";

const APPEND_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
local data
if raw then
  data = cjson.decode(raw)
  if type(data.history) ~= "table" then data = {history = {}} end
else
  data = {history = {}}
end
table.insert(data.history, {role = ARGV[1], content = ARGV[2]})
local limit = tonumber(ARGV[3])
while #data.history > limit do
  table.remove(data.history, 1)
end
redis.call("SET", KEYS[1], cjson.encode(data), "EX", tonumber(ARGV[4]))
return 1
`;

export async function createRedisSessionStore(params: {
  historyLimit: number;
  sessionTtlSeconds: number;
  redisUrl: string;
}): Promise<SessionStore> {
  const { historyLimit, sessionTtlSeconds, redisUrl } = params;

  const client = createClient({ url: redisUrl });
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
      const history = parsed.history.filter(
        (m: unknown): m is ChatMessage =>
          m !== null &&
          typeof m === "object" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
          typeof (m as ChatMessage).content === "string",
      );
      return { history };
    } catch {
      return { history: [] };
    }
  }

  return {
    async disconnect() {
      await client.disconnect();
    },

    async getHistory(sessionId) {
      // historyLimit=0 means history is disabled entirely.
      if (!historyLimit) return [];
      const data = await load(sessionId);
      // Refresh TTL without rewriting the whole value.
      await client.expire(key(sessionId), sessionTtlSeconds);
      return data.history.slice();
    },

    async appendUser(sessionId, text) {
      if (!historyLimit) return;
      await client.eval(APPEND_SCRIPT, {
        keys: [key(sessionId)],
        arguments: ["user", text, String(historyLimit), String(sessionTtlSeconds)],
      });
    },

    async appendAssistant(sessionId, text) {
      if (!historyLimit) return;
      await client.eval(APPEND_SCRIPT, {
        keys: [key(sessionId)],
        arguments: ["assistant", text, String(historyLimit), String(sessionTtlSeconds)],
      });
    },
  };
}
