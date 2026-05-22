import Redis from 'ioredis';

export const redis =
  new Redis({
    host:
      process.env.REDIS_HOST,
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