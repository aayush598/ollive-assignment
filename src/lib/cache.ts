// Lightweight cache abstraction.
// Uses Redis when available (Docker/K8s), falls back to in-memory Map on Vercel.

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry>();

let redisAvailable: boolean | null = null;
let redisClient: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { EX?: number }) => Promise<string | null>;
  del: (key: string) => Promise<number>;
} | null = null;

async function getRedisClient() {
  if (redisAvailable === false) return null;
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    redisAvailable = false;
    return null;
  }

  try {
    const { createClient } = await import("redis");
    const client = createClient({ url });
    client.on("error", () => {
      redisAvailable = false;
      redisClient = null;
    });
    await client.connect();
    redisClient = {
      get: (key: string) => client.get(key),
      set: (key: string, value: string, options?: { EX?: number }) =>
        client.set(key, value, options),
      del: (key: string) => client.del(key),
    };
    redisAvailable = true;
    return redisClient;
  } catch {
    redisAvailable = false;
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const fullKey = `app:${key}`;

  const client = await getRedisClient();
  if (client) {
    const raw = await client.get(fullKey);
    if (raw) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return null;
  }

  const entry = memoryStore.get(fullKey);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value as T;
  }
  if (entry) memoryStore.delete(fullKey);
  return null;
}

export async function cacheSet<T>(key: string, value: T, ttlMs = 60_000): Promise<void> {
  const fullKey = `app:${key}`;

  const client = await getRedisClient();
  if (client) {
    const serialized = JSON.stringify(value);
    await client.set(fullKey, serialized, { EX: Math.ceil(ttlMs / 1000) });
    return;
  }

  memoryStore.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
}

export async function cacheDelete(key: string): Promise<void> {
  const fullKey = `app:${key}`;

  const client = await getRedisClient();
  if (client) {
    await client.del(fullKey);
    return;
  }

  memoryStore.delete(fullKey);
}

export function clearMemoryCache() {
  memoryStore.clear();
}
