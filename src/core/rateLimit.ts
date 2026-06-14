export function createFixedWindowLimiter(limitPerMin: number) {
  const windowMs = 60 * 1000;
  const buckets = new Map<string, { windowStart: number; count: number }>();
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
  return function allow(key: string): boolean {
    const now = Date.now();
    const last = lastUsed.get(key);
    if (last !== undefined && now - last < ttlMs) return false;
    lastUsed.set(key, now);
    return true;
  };
}
