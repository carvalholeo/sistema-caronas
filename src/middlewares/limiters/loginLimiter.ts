import { Request, Response, NextFunction } from 'express';
import rateLimit, { Options as OptionsRateLimite, RateLimitRequestHandler } from 'express-rate-limit';
import { loginKeyGenerator } from 'utils/limitersKeyGenerators';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../providers/cache/redis';
import slowDown, { Options } from 'express-slow-down';

let limiter: RateLimitRequestHandler | null = null;
const maxFreeRequestsAtLogin = 5;
const timeWindowOfRequestsinMs = 30 * 60 * 1000;

export const loginRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const options: Partial<OptionsRateLimite> = {
        windowMs: timeWindowOfRequestsinMs,
        max: maxFreeRequestsAtLogin, // limit each IP to 5 login attempts per windowMs
        skipSuccessfulRequests: true,
        message: { error: 'Muitas tentativas de login. Sua conta está temporariamente bloqueada.' },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: Request) => loginKeyGenerator(req),
    };

    if (!limiter) {
        const redisClient = getRedisClient();
        if (redisClient) {
            limiter = rateLimit({
                ...options,
                store: new RedisStore({
                    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
                    prefix: 'loginLimiter:',
                }),
            });
        } else {
            limiter = rateLimit(options);
        }
    }
    return limiter(req, res, next);
};

export const loginSlowDown = (req: Request, res: Response, next: NextFunction) => {
  const options: Partial<Options> = {
    windowMs: timeWindowOfRequestsinMs,
    delayAfter: maxFreeRequestsAtLogin,
    delayMs: (hits) => {
      return (hits - maxFreeRequestsAtLogin) * 1000;
    },
    keyGenerator: (req: Request) => loginKeyGenerator(req),
    legacyHeaders: false,
  };

  if (!limiter) {
    const redisClient = getRedisClient();
    if (redisClient) {
      limiter = slowDown({
        ...options,
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: 'loginSpeedLimiter:',
        }),
      });
    } else {
      limiter = slowDown(options);
    }
  }

  return limiter(req, res, next);
};
