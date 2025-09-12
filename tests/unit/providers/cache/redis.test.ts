
jest.mock('redis', () => {
  const mockCreateClient = jest.fn();
  return {
    __esModule: true,
    createClient: mockCreateClient,
  };
});

describe('Redis Connection Provider', () => {
  let connectToRedis: typeof import('../../../../src/providers/cache/redis').connectToRedis;
  let closeRedisConnection: typeof import('../../../../src/providers/cache/redis').closeRedisConnection;

  let mockClient: {
    connect: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules(); // Clear module cache

    // Re-import the functions after resetting modules
    ({ connectToRedis, closeRedisConnection } = require('../../../../src/providers/cache/redis'));

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    // Access the mockCreateClient from the mocked module
    const { createClient: actualMockCreateClient } = require('redis');
    actualMockCreateClient.mockReturnValue(mockClient);
  });

  describe('connectToRedis', () => {
    it('should create a new client, connect, and return it on the first call', async () => {
      const client = await connectToRedis();

      const { createClient: actualMockCreateClient } = require('redis');
      expect(actualMockCreateClient).toHaveBeenCalledTimes(1);
      expect(actualMockCreateClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(client).toBe(mockClient);
    });

    it('should return the existing client without creating a new one on subsequent calls', async () => {
      await connectToRedis(); // First call
      const client = await connectToRedis(); // Second call

      const { createClient: actualMockCreateClient } = require('redis');
      expect(actualMockCreateClient).toHaveBeenCalledTimes(1);
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(client).toBe(mockClient);
    });
  });

  describe('closeRedisConnection', () => {
    it('should quit the client if a connection exists', async () => {
      await connectToRedis(); // Establish connection
      await closeRedisConnection();

      expect(mockClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if no connection exists', async () => {
      // Simulate no connection by ensuring the client is null
      // This is handled by jest.resetModules() and the singleton pattern in the source
      await closeRedisConnection();

      expect(mockClient.quit).not.toHaveBeenCalled();
    });

    it('should allow a new connection to be created after closing', async () => {
        await connectToRedis();
        await closeRedisConnection();
        await connectToRedis();

        const { createClient: actualMockCreateClient } = require('redis');
        expect(actualMockCreateClient).toHaveBeenCalledTimes(2);
        expect(mockClient.connect).toHaveBeenCalledTimes(2);
    });
  });
});
