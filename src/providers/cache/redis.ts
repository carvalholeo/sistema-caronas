import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

const redisUri = process.env.REDIS_URI || 'redis://localhost:6379';

export async function connectToRedis(): Promise<RedisClientType|null> {
  const canRedisBeEnabled = process.env.ENABLE_REDIS === 'true';
  if (!canRedisBeEnabled) {
    return null;
  }

  if (client === null && canRedisBeEnabled) {
    client = createClient({ url: redisUri });
    await client.connect();
  }

  return client;
}

export function getRedisClient() {
  const canRedisBeEnabled = process.env.ENABLE_REDIS === 'true';
  if (!canRedisBeEnabled) {
    throw new Error('Redis not enabled');
  }

  if (!client) {
    throw new Error('Redis client not initialized');
  }
  return client;
}

export async function closeRedisConnection(): Promise<void> {
  const canRedisBeEnabled = process.env.ENABLE_REDIS === 'true';
  if (client && canRedisBeEnabled) {
    await client.quit();
  }
  client = null;
}
