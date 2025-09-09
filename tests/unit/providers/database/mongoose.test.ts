
import mongoose from 'mongoose';
import { connectToDatabase, closeDatabaseConnection } from '../../../../src/providers/database/mongoose';

// Mock the 'mongoose' library
jest.mock('mongoose', () => ({
  __esModule: true, // This is important for default exports
  ...jest.requireActual('mongoose'), // Import and retain default behavior
  connect: jest.fn(),
  set: jest.fn(),
}));

const mockedMongoose = mongoose as jest.Mocked<typeof mongoose>;

describe('Mongoose Connection Provider', () => {
  const originalEnv = process.env;
  let mockMongooseClient: {
    disconnect: jest.Mock;
  };

  beforeEach(() => {
    // Reset modules to clear the singleton client instance between tests
    jest.resetModules();

    mockMongooseClient = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    mockedMongoose.connect.mockResolvedValue(mockMongooseClient as any);
    mockedMongoose.set.mockClear();
    mockedMongoose.connect.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('connectToDatabase', () => {
    it('should set runValidators and connect on the first call', async () => {
      const client = await connectToDatabase();

      expect(mockedMongoose.set).toHaveBeenCalledWith('runValidators', true);
      expect(mockedMongoose.connect).toHaveBeenCalledTimes(1);
      expect(mockedMongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/carpool', {});
      expect(client).toBe(mockMongooseClient);
    });

    it('should use MONGODB_URI from environment variables if set', async () => {
        process.env.MONGODB_URI = 'mongodb://test-host:27017/test-db';
        await connectToDatabase();
        expect(mockedMongoose.connect).toHaveBeenCalledWith('mongodb://test-host:27017/test-db', {});
    });

    it('should return the existing client without connecting again on subsequent calls', async () => {
      await connectToDatabase(); // First call
      const client = await connectToDatabase(); // Second call

      expect(mockedMongoose.set).toHaveBeenCalledTimes(1);
      expect(mockedMongoose.connect).toHaveBeenCalledTimes(1);
      expect(client).toBe(mockMongooseClient);
    });
  });

  describe('closeDatabaseConnection', () => {
    it('should disconnect the client if a connection exists', async () => {
      await connectToDatabase(); // Establish connection
      await closeDatabaseConnection();

      expect(mockMongooseClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if no connection exists', async () => {
      await closeDatabaseConnection();

      expect(mockMongooseClient.disconnect).not.toHaveBeenCalled();
    });

    it('should allow a new connection to be created after closing', async () => {
        await connectToDatabase();
        await closeDatabaseConnection();
        await connectToDatabase();

        expect(mockedMongoose.connect).toHaveBeenCalledTimes(2);
        expect(mockMongooseClient.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
