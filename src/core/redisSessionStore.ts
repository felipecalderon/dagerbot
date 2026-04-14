import { ChatMessage } from "./types";
import { SessionStore } from "./sessionStore";

// Lua script: atomically appends a message, trims history to limit, and resets TTL.
// KEYS[1] = session key
// ARGV[1] = role ("user" | "assistant")
// ARGV[2] = content
// ARGV[3] = historyLimit (number as string)
// ARGV[4] = sessionTtlSeconds (number as string)
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
}): Promise<SessionStore & { disconnect(): Promise<void> }> {
  const { historyLimit, sessionTtlSeconds, redisUrl } = params;
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
    } catch (e) {
      console.warn(`Failed to parse session data for ${sessionId}:`, e);
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
