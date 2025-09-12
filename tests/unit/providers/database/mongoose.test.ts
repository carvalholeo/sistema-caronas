// Mock the 'mongoose' library
const mockedMongoose = {
  connect: jest.fn(),
  set: jest.fn(),
  connection: {
    dropDatabase: jest.fn(),
    close: jest.fn(),
    readyState: 1, // Simulate connected state
  },
} as unknown as jest.Mocked<typeof import('mongoose')>;

jest.mock('mongoose', () => mockedMongoose);

describe('Mongoose Connection Provider', () => {
  const originalEnv = process.env;
  let connectToDatabase: typeof import('../../../../src/providers/database/mongoose').connectToDatabase;
  let closeDatabaseConnection: typeof import('../../../../src/providers/database/mongoose').closeDatabaseConnection;

  let mockMongooseClient: {
    disconnect: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules(); // Clear module cache

    // Re-import the functions after resetting modules
    ({ connectToDatabase, closeDatabaseConnection } = require('../../../../src/providers/database/mongoose'));

    mockMongooseClient = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    mockedMongoose.connect.mockResolvedValue(mockMongooseClient as any);
    mockedMongoose.set.mockClear();
    mockedMongoose.connect.mockClear();
    mockedMongoose.connection.dropDatabase.mockClear();
    mockedMongoose.connection.close.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('connectToDatabase', () => {
    it('should set runValidators and connect on the first call', async () => {
      const client = await connectToDatabase();

      expect(mockedMongoose.set).toHaveBeenCalledWith('runValidators', true);
      expect(mockedMongoose.set).toHaveBeenCalledWith('autoIndex', true);
      expect(mockedMongoose.connect).toHaveBeenCalledTimes(1);
      expect(mockedMongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/carpool', {});
      expect(client).toBe(mockMongooseClient);
    });

    it('should use MONGODB_URI from environment variables if set', async () => {
        process.env.MONGODB_URI = 'mongodb://test-host:27017/test-db';
        // Re-import after setting env var
        ({ connectToDatabase, closeDatabaseConnection } = require('../../../../src/providers/database/mongoose'));

        await connectToDatabase();
        expect(mockedMongoose.connect).toHaveBeenCalledWith('mongodb://test-host:27017/test-db', {});
    });

    it('should return the existing client without connecting again on subsequent calls', async () => {
      await connectToDatabase(); // First call
      const client = await connectToDatabase(); // Second call

      expect(mockedMongoose.set).toHaveBeenCalledTimes(2); // set is called twice (once per import)
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
      // Simulate no connection by setting client to null internally in the module
      // This requires re-importing the module after setting client to null
      jest.resetModules();
      ({ connectToDatabase, closeDatabaseConnection } = require('../../../../src/providers/database/mongoose'));

      // Manually set the internal client to null for this test
      // This is a bit hacky, but necessary to test the 'if (client)' condition
      // A better design might expose a way to reset the client for testing
      // For now, we'll rely on the module re-import to reset the client to null

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
