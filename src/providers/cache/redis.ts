import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null;

const redisUri = process.env.REDIS_URI || 'redis://localhost:6379';

export async function connectToRedis(): Promise<RedisClientType> {
  if (client === null) {
    client = createClient({ url: redisUri });
    await client.connect();
  }
  return client;
}

export function getRedisClient() {
  if (!client) {
    throw new Error('Redis client not initialized');
  }
  return client;
}

export async function closeRedisConnection(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
