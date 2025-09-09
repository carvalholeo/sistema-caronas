
import slowDown from 'express-slow-down';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../../../src/providers/cache/redis';

// Mock the express-slow-down library
jest.mock('express-slow-down');
jest.mock('rate-limit-redis');
jest.mock('../../../src/providers/cache/redis');

const mockedSlowDown = slowDown as jest.Mock;
const mockedRedisStore = RedisStore as jest.MockedClass<typeof RedisStore>;
const mockedGetRedisClient = getRedisClient as jest.Mock;

describe('Speed Limiter', () => {
  let mockRedisClient: any;

  beforeEach(() => {
    mockedSlowDown.mockClear();
    mockedRedisStore.mockClear();
    mockedGetRedisClient.mockClear();

    mockRedisClient = {
      sendCommand: jest.fn(),
    };
    mockedGetRedisClient.mockReturnValue(mockRedisClient);
  });

  it('should be configured with the correct options and RedisStore', () => {
    require('../../../../src/middlewares/limiters/speedLimiter');

    expect(mockedSlowDown).toHaveBeenCalledTimes(1);
    const options = mockedSlowDown.mock.calls[0][0];

    expect(options.windowMs).toBe(15 * 60 * 1000);
    expect(options.delayAfter).toBe(50);
    expect(options.delayMs).toBe(500);

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
