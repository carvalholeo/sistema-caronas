import { Request } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import { limiterKeyGenerator } from '../../utils/limitersKeyGenerators';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../providers/cache/redis';

const options: Partial<Options> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req: Request) => limiterKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
};


export function globalLimiter() {
  const redisClient = getRedisClient();
  if (redisClient) {
    options.store = new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: 'globalLimiter:',
    });
  }
  return rateLimit(options);
}
