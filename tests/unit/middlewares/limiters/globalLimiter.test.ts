
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../../../src/providers/cache/redis';

// Mock the express-rate-limit library
jest.mock('express-rate-limit');
jest.mock('rate-limit-redis');
jest.mock('../../../src/providers/cache/redis');

const mockedRateLimit = rateLimit as jest.Mock;
const mockedRedisStore = RedisStore as jest.MockedClass<typeof RedisStore>;
const mockedGetRedisClient = getRedisClient as jest.Mock;

describe('Global Rate Limiter', () => {
  let mockRedisClient: any;

  beforeEach(() => {
    mockedRateLimit.mockClear();
    mockedRedisStore.mockClear();
    mockedGetRedisClient.mockClear();

    mockRedisClient = {
      sendCommand: jest.fn(),
    };
    mockedGetRedisClient.mockReturnValue(mockRedisClient);
  });

  it('should be configured with the correct options and RedisStore', () => {
    require('../../../../src/middlewares/limiters/globalLimiter');

    expect(mockedRateLimit).toHaveBeenCalledTimes(1);
    const options = mockedRateLimit.mock.calls[0][0];

    expect(options.windowMs).toBe(15 * 60 * 1000);
    expect(options.max).toBe(100);
    expect(options.message).toBe('Too many requests from this IP, please try again later.');
    expect(options.standardHeaders).toBe(true);
    expect(options.legacyHeaders).toBe(false);

    // Verify RedisStore is used for the store
    expect(mockedRedisStore).toHaveBeenCalledTimes(1);
    const redisStoreOptions = mockedRedisStore.mock.calls[0][0];
    expect(redisStoreOptions.sendCommand).toBeInstanceOf(Function);

    // Verify sendCommand uses getRedisClient().sendCommand
    redisStoreOptions.sendCommand('test-command', 'arg1');
    expect(mockedGetRedisClient).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.sendCommand).toHaveBeenCalledWith(['test-command', 'arg1']);
  });
});
