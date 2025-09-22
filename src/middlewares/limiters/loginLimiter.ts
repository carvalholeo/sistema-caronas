import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator, Options, RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../providers/cache/redis';

let limiter: RateLimitRequestHandler | null = null;
const options: Partial<Options> = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    skipSuccessfulRequests: true,
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "::1"),
};

export const loginLimiter = (req: Request, res: Response, next: NextFunction) => {
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
