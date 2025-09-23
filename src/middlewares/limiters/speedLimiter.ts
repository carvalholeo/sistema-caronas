import { Request, Response, NextFunction } from 'express';
import { RedisStore } from 'rate-limit-redis';
import slowDown, { Options, SlowDownRequestHandler } from 'express-slow-down';
import { getRedisClient } from '../../providers/cache/redis';
import { limiterKeyGenerator } from 'utils/limitersKeyGenerators';

let limiter: SlowDownRequestHandler | null = null;

export const speedLimiter = (req: Request, res: Response, next: NextFunction) => {
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
  if (!limiter) {
    const redisClient = getRedisClient();
    if (redisClient) {
      limiter = slowDown({
        ...options,
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: 'speedLimiter:',
        }),
      });
    } else {
      limiter = slowDown(options);
    }
  }

  return limiter(req, res, next);
};
