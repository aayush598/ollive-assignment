// Rate limiting with optional Redis backend.
// Falls back to in-memory Map when Redis is unavailable (Vercel).

const rateMap = new Map<string, { count: number; resetAt: number }>();

let redisRatelimiter: {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<number>;
} | null = null;

async function getRedisRatelimiter() {
  if (redisRatelimiter) return redisRatelimiter;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const { createClient } = await import("redis");
    const client = createClient({ url });
    await client.connect();
    redisRatelimiter = {
      incr: (key: string) => client.incr(key),
      pexpire: (key: string, ms: number) => client.pExpire(key, ms),
    };
    return redisRatelimiter;
  } catch {
    return null;
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 30, windowMs: 60000 },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = await getRedisRatelimiter();

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, config.windowMs);
    }
    const resetAt = Date.now() + config.windowMs;
    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt,
    };
  }

  // In-memory fallback
  const now = Date.now();
  let entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    rateMap.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

export function getRateLimitKey(ip: string, path: string): string {
  return `rl:${ip}:${path}`;
}

// Periodic cleanup for in-memory entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now > entry.resetAt) {
      rateMap.delete(key);
    }
  }
}, 60000);
