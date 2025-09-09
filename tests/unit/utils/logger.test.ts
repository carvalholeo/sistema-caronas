
import winston from 'winston';

// Mock the winston library
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    add: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn(),
  },
}));

const mockedWinston = winston as jest.Mocked<typeof winston>;

describe('Logger Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Clear module cache
    process.env = { ...originalEnv }; // Reset env variables
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should configure logger with file transports in production', () => {
    process.env.NODE_ENV = 'production';
    require('../../../src/utils/logger');

    expect(mockedWinston.createLogger).toHaveBeenCalledTimes(1);
    const loggerConfig = mockedWinston.createLogger.mock.calls[0][0];

    expect(loggerConfig.level).toBe('info');
    expect(loggerConfig.defaultMeta).toEqual({ service: 'carpool-backend' });
    expect(loggerConfig.transports).toHaveLength(2);
    expect(mockedWinston.transports.File).toHaveBeenCalledTimes(2);
    expect(mockedWinston.transports.File).toHaveBeenCalledWith({ filename: 'logs/error.log', level: 'error' });
    expect(mockedWinston.transports.File).toHaveBeenCalledWith({ filename: 'logs/combined.log' });

    // Ensure console transport is NOT added in production
    const loggerInstance = mockedWinston.createLogger.mock.results[0].value;
    expect(loggerInstance.add).not.toHaveBeenCalled();
  });

  it('should add console transport in development', () => {
    process.env.NODE_ENV = 'development';
    require('../../../src/utils/logger');

    expect(mockedWinston.createLogger).toHaveBeenCalledTimes(1);
    const loggerInstance = mockedWinston.createLogger.mock.results[0].value;
    expect(loggerInstance.add).toHaveBeenCalledTimes(1);
    expect(mockedWinston.transports.Console).toHaveBeenCalledTimes(1);
  });

  it('should use correct formatters', () => {
    require('../../../src/utils/logger');

    expect(mockedWinston.format.combine).toHaveBeenCalledTimes(1);
    expect(mockedWinston.format.timestamp).toHaveBeenCalledTimes(1);
    expect(mockedWinston.format.errors).toHaveBeenCalledWith({ stack: true });
    expect(mockedWinston.format.json).toHaveBeenCalledTimes(1);
  });
});
