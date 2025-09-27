import { Request } from 'express';
import rateLimit, { Options as OptionsRateLimite } from 'express-rate-limit';
import { loginKeyGenerator } from '../../utils/limitersKeyGenerators';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../providers/cache/redis';
import slowDown, { Options } from 'express-slow-down';

const maxFreeRequestsAtLogin = 5;
const timeWindowOfRequestsinMs = 30 * 60 * 1000;

const limiterOptions: Partial<OptionsRateLimite> = {
  windowMs: timeWindowOfRequestsinMs,
  max: maxFreeRequestsAtLogin, // limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas de login. Sua conta está temporariamente bloqueada.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => loginKeyGenerator(req),
};

const slowDownOptions: Partial<Options> = {
  windowMs: timeWindowOfRequestsinMs,
  delayAfter: maxFreeRequestsAtLogin,
  delayMs: (hits) => {
    return (hits - maxFreeRequestsAtLogin) * 1000;
  },
  keyGenerator: (req: Request) => loginKeyGenerator(req),
  legacyHeaders: false,
};

export const loginRateLimiter = () => {
  const redisClient = getRedisClient();
  if (redisClient) {
    limiterOptions.store = new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: 'loginLimiter:',
    })
  }

  return rateLimit(limiterOptions);
};

export const loginSlowDown = () => {
  const redisClient = getRedisClient();
  if (redisClient) {
    slowDownOptions.store = new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: 'loginSpeedLimiter:',
    });
  }

  return slowDown(slowDownOptions);
};
