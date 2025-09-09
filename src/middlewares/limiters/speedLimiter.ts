import  slowDown, {SlowDownRequestHandler} from 'express-slow-down';
import { getRedisClient } from 'providers/cache/redis';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';

let limiter: SlowDownRequestHandler | null = null;

export const speedLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (!limiter) {
    const redisClient = getRedisClient();
    if (redisClient) {
      limiter = slowDown({
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: 50, // allow 50 requests per 15 minutes without delay
        delayMs: 500, // add 500ms delay per request after delayAfter
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        }),
      });
    } else {
      limiter = slowDown({
        windowMs: 15 * 60 * 1000,
        delayAfter: 50,
        delayMs: 500,
      });
    }
  }
  if (limiter) {
    return limiter(req, res, next);
  }
};
