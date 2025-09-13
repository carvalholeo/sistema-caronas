
import { RedisStore } from 'rate-limit-redis';
import { Request, Response, RequestHandler } from 'express';
import { getRedisClient } from '../../../../src/providers/cache/redis';
import * as limiters from '../../../../src/middlewares/limiters/globalLimiter';

interface MockRedisClient {
  sendCommand: jest.Mock;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  store?: unknown;
}

// Mock express-rate-limit
const mockRateLimitMiddleware = jest.fn((req: Request, res: Response, next: () => void) => next());
const mockRateLimit = jest.fn<(req: Request, res: Response, next: () => void) => void, [RateLimitOptions]>(() => mockRateLimitMiddleware);

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: mockRateLimit
}));

jest.mock('rate-limit-redis');
jest.mock('../../../../src/providers/cache/redis', () => ({
  getRedisClient: jest.fn(),
  connectToRedis: jest.fn(),
  closeRedisConnection: jest.fn(),
}));

const mockedRedisStore = RedisStore as jest.MockedClass<typeof RedisStore>;
const mockedGetRedisClient = getRedisClient as jest.Mock;

describe('Global Rate Limiter', () => {
  let mockRedisClient: MockRedisClient;
  let limiter: RequestHandler;

  beforeEach(() => {
    // Clear mocks
    mockRateLimit.mockClear();
    mockRateLimitMiddleware.mockClear();
    mockedRedisStore.mockClear();
    mockedGetRedisClient.mockClear();

    // Setup Redis client mock
    mockRedisClient = {
      sendCommand: jest.fn(),
    };
    mockedGetRedisClient.mockReturnValue(mockRedisClient);

    // Import the module in beforeEach to ensure clean state
    jest.isolateModules(() => {
      limiter = limiters.globalLimiter;
    });
  });

  it('should configure express rate limit with Redis store', () => {
    // Create test request, response, next
    const req = {
      get: jest.fn(),
      header: jest.fn(),
      accepts: jest.fn(),
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    // Call the middleware
    limiter(req, res, next);

    // Check rate limit initialization
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    const options = mockRateLimit.mock.calls[0]?.[0];
    expect(options).toBeDefined();

    expect(options?.windowMs).toBe(15 * 60 * 1000);
    expect(options?.max).toBe(100);
    expect(options?.standardHeaders).toBe(true);
    expect(options?.legacyHeaders).toBe(false);

    // Verify RedisStore is used for the store
    expect(mockedRedisStore).toHaveBeenCalledTimes(1);
    const redisStoreOptions = mockedRedisStore.mock.calls[0]?.[0];
    expect(redisStoreOptions?.sendCommand).toBeInstanceOf(Function);

    // Verify sendCommand uses getRedisClient().sendCommand
    redisStoreOptions?.sendCommand('test-command', 'arg1');
    expect(mockedGetRedisClient).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.sendCommand).toHaveBeenCalledWith(['test-command', 'arg1']);

    // Verify the middleware was called
    expect(mockRateLimitMiddleware).toHaveBeenCalledWith(req, res, next);
  });

  it('should use in-memory store when Redis is not available', () => {
    // Mock Redis client as not available
    mockedGetRedisClient.mockReturnValue(null);

    // Create test request, response, next
    const req = {
      get: jest.fn(),
      header: jest.fn(),
      accepts: jest.fn(),
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    // Call the middleware
    limiter(req, res, next);

    // Check rate limit initialization
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    const options = mockRateLimit.mock.calls[0]?.[0];
    expect(options).toBeDefined();

    expect(options?.windowMs).toBe(15 * 60 * 1000);
    expect(options?.max).toBe(100);
    expect(options?.standardHeaders).toBe(true);
    expect(options?.legacyHeaders).toBe(false);

    // Should not use RedisStore
    expect(mockedRedisStore).not.toHaveBeenCalled();

    // Verify the middleware was called
    expect(mockRateLimitMiddleware).toHaveBeenCalledWith(req, res, next);
  });
});
