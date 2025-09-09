import rateLimit from "express-rate-limit";
import { RedisStore } from 'rate-limit-redis'
import { getRedisClient } from "providers/cache/redis";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
		sendCommand: (...args: string[]) => getRedisClient().sendCommand(args),
	}),
});
