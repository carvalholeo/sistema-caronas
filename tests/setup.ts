import { MongoMemoryServer } from "mongodb-memory-server";
import { RedisMemoryServer } from "redis-memory-server";
import mongoose from "mongoose";

declare global {
  var __MONGO_URI__: string;
  var __MONGO_DB_NAME__: string;
}

let mongoServer: MongoMemoryServer;
let redisServer: RedisMemoryServer;

export const setupRedisServer = async () => {
  redisServer = new RedisMemoryServer({
    autoStart: true,
  });
  await redisServer.ensureInstance();
  const host = await redisServer.getHost();
  const port = await redisServer.getPort();
  process.env.REDIS_URI = `redis://${host}:${port}`;
};

export const teardownRedisServer = async () => {
  if (redisServer) {
    await redisServer.stop();
  }
};

export const setupTestDatabase = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  globalThis.__MONGO_URI__ = mongoUri;
  globalThis.__MONGO_DB_NAME__ = "test-carpool-db";

  await mongoose.connect(mongoUri, {
    dbName: globalThis.__MONGO_DB_NAME__,
    autoIndex: true,
  });

  mongoose.set("runValidators", true);
};

export const teardownTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
};

export const clearDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};

// Suppress console.log in tests unless DEBUG is set
if (!process.env.DEBUG) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-unit-tests";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-key-for-unit-tests";
process.env.MONGODB_URI = globalThis.__MONGO_URI__;

beforeAll(async () => {
  await setupTestDatabase();
  await setupRedisServer();
}, 30000);

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await clearDatabase();
  jest.resetModules();
});

afterAll(async () => {
  await teardownTestDatabase();
  await teardownRedisServer();
});
