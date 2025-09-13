// Mock Redis client
export const mockRedisClient = {
  sendCommand: jest.fn(),
  connect: jest.fn(),
  quit: jest.fn(),
};

// Mock Redis functions
export const createClient = jest.fn(() => mockRedisClient);

// Add any other Redis exports/functions that need to be mocked