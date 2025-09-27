import { Request } from 'express';
import { RedisStore } from 'rate-limit-redis';
import slowDown, { Options } from 'express-slow-down';
import { getRedisClient } from '../../providers/cache/redis';
import { limiterKeyGenerator } from '../../utils/limitersKeyGenerators';

const delayAfter = 50;
const options: Partial<Options> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter,
  delayMs: (hits) => {
    return (hits - delayAfter) * 500;
  },
  keyGenerator: (req: Request) => limiterKeyGenerator(req),
  legacyHeaders: false,
};
export const speedLimiter = () => {
  const redisClient = getRedisClient();
  if (redisClient) {
    options.store = new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: 'speedLimiter:',
    })
  }

  return slowDown(options);
};
