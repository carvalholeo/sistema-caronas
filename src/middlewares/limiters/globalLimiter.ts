import rateLimit from "express-rate-limit";
import { RedisStore } from 'rate-limit-redis'
import { getRedisClient } from "providers/cache/redis";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
      sendCommand: (...args: string[]) => getRedisClient().sendCommand(args),
    }),
});
