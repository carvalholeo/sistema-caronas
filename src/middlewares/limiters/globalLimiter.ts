import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { getRedisClient } from 'providers/cache/redis';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';

let limiter: RateLimitRequestHandler | null = null;

const globalLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (!limiter) {
    const redisClient = getRedisClient();
    if (redisClient) {
      limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        }),
        standardHeaders: true,
        legacyHeaders: false,
      });
    } else {
      limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      });
    }
  }
  return limiter(req, res, next);
};

export { globalLimiter };