import Redis from 'ioredis';

export const redis = new Redis({
  host: 'redis',
  port: 6379,
  maxRetriesPerRequest: null,

  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export async function getCache(
  key: string
) {
  return redis.get(key);
}

export async function setCache(
  key: string,
  value: string,
  ttlSeconds: number
) {
  await redis.set(
    key,
    value,
    'EX',
    ttlSeconds
  );
}