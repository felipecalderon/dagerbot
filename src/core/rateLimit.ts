// Both maps below only overwrite an entry when that exact key comes back, so
// without a sweep they keep one entry per key ever seen — every Discord user,
// every conversation — for the lifetime of the process. Dropping an expired
// entry is invisible to callers: allow() already treats a missing entry and an
// expired one the same way. unref() keeps the timer from holding the process up.
const SWEEP_INTERVAL_MS = 60_000;

export function createFixedWindowLimiter(limitPerMin: number) {
  const windowMs = 60 * 1000;
  const buckets = new Map<string, { windowStart: number; count: number }>();

  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, bucket] of buckets) {
      if (bucket.windowStart <= cutoff) buckets.delete(key);
    }
  }, SWEEP_INTERVAL_MS).unref();

  return function allow(key: string) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(key, { windowStart: now, count: 1 });
      return true;
    }
    if (bucket.count >= limitPerMin) return false;
    bucket.count += 1;
    return true;
  };
}

export function createCooldown(ttlSeconds: number) {
  const ttlMs = ttlSeconds * 1000;
  const lastUsed = new Map<string, number>();

  setInterval(() => {
    const cutoff = Date.now() - ttlMs;
    for (const [key, last] of lastUsed) {
      if (last <= cutoff) lastUsed.delete(key);
    }
  }, SWEEP_INTERVAL_MS).unref();

  return function allow(key: string): boolean {
    const now = Date.now();
    const last = lastUsed.get(key);
    if (last !== undefined && now - last < ttlMs) return false;
    lastUsed.set(key, now);
    return true;
  };
}
