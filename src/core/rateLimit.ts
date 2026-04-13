export function createFixedWindowLimiter(limitPerMin: number) {
  const windowMs = 60 * 1000;
  const buckets = new Map<string, { windowStart: number; count: number }>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) {
        buckets.delete(k);
      }
    }
  }, 2 * 60 * 1000);

  if (cleanup.unref) cleanup.unref();

  return {
    allow(key: string): boolean {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return true;
      }
      if (bucket.count >= limitPerMin) return false;
      bucket.count += 1;
      return true;
    },
    destroy() {
      clearInterval(cleanup);
    },
  };
}
