
import { createClient } from 'redis';
import { connectToRedis, closeRedisConnection } from '../../../../src/providers/cache/redis';

// Mock the 'redis' library
jest.mock('redis');

const mockedCreateClient = createClient as jest.Mock;

describe('Redis Connection Provider', () => {
  let mockClient: {
    connect: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    // Reset modules to clear the singleton client instance between tests
    jest.resetModules();

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    mockedCreateClient.mockReturnValue(mockClient);
  });

  describe('connectToRedis', () => {
    it('should create a new client, connect, and return it on the first call', async () => {
      const client = await connectToRedis();

      expect(mockedCreateClient).toHaveBeenCalledTimes(1);
      expect(mockedCreateClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(client).toBe(mockClient);
    });

    it('should return the existing client without creating a new one on subsequent calls', async () => {
      await connectToRedis(); // First call
      const client = await connectToRedis(); // Second call

      expect(mockedCreateClient).toHaveBeenCalledTimes(1);
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
      await closeRedisConnection();

      expect(mockClient.quit).not.toHaveBeenCalled();
    });

    it('should allow a new connection to be created after closing', async () => {
        await connectToRedis();
        await closeRedisConnection();
        await connectToRedis();

        expect(mockedCreateClient).toHaveBeenCalledTimes(2);
        expect(mockClient.connect).toHaveBeenCalledTimes(2);
    });
  });
});
