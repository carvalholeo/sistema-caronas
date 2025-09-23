import { Request, Response, NextFunction } from 'express';
import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import { limiterKeyGenerator } from 'utils/limitersKeyGenerators';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../providers/cache/redis';

let limiter: RateLimitRequestHandler | null = null;
const options: Partial<Options> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req: Request) => limiterKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
};

export const globalLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (!limiter) {
    const redisClient = getRedisClient();
    if (redisClient) {
      limiter = rateLimit({
        ...options,
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: 'globalLimiter:',
        }),
      });
    } else {
      limiter = rateLimit(options);
    }
  }
  return limiter(req, res, next);
};
