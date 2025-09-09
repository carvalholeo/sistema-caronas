import rateLimit, {RateLimitRequestHandler} from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from 'providers/cache/redis';
import { Request, Response, NextFunction } from 'express';

let limiter: RateLimitRequestHandler | null = null;

export const loginLimiter = (req: Request, res: Response, next: NextFunction) => {
    if (!limiter) {
        const redisClient = getRedisClient();
        if (redisClient) {
            limiter = rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 5, // limit each IP to 5 login attempts per windowMs
                skipSuccessfulRequests: true,
                message: 'Too many login attempts, please try again later.',
                standardHeaders: true,
                legacyHeaders: false,
                store: new RedisStore({
                    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
                }),
            });
        } else {
            limiter = rateLimit({
                windowMs: 15 * 60 * 1000,
                max: 5,
                skipSuccessfulRequests: true,
                message: 'Too many login attempts, please try again later.',
                standardHeaders: true,
                legacyHeaders: false,
            });
        }
    }
    if (limiter) {
        return limiter(req, res, next);
    }
};
