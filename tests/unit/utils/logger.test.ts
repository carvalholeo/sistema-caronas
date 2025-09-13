// Mock winston before any imports
const mockCreateLogger = jest.fn();
const mockAdd = jest.fn();
const mockFormat = {
  combine: jest.fn(() => 'combined-format'),
  timestamp: jest.fn(() => 'timestamp-format'),
  errors: jest.fn(() => 'errors-format'),
  json: jest.fn(() => 'json-format'),
  simple: jest.fn(() => 'simple-format'),
};
const mockTransports = {
  File: jest.fn().mockImplementation((config) => ({ config, type: 'file' })),
  Console: jest.fn().mockImplementation((config) => ({ config, type: 'console' })),
};

// Mock winston before importing
jest.mock('winston', () => ({
  createLogger: mockCreateLogger.mockReturnValue({ add: mockAdd }),
  format: mockFormat,
  transports: mockTransports,
}));

describe('Logger Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockCreateLogger.mockReturnValue({ add: mockAdd });

    // Reset environment
    process.env = { ...originalEnv };

    // Clear module cache
    delete require.cache[require.resolve('../../../src/utils/logger')];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should configure logger with file transports in production', () => {
    process.env.NODE_ENV = 'production';

    // Import logger - this should trigger winston.createLogger
    require('../../../src/utils/logger');

    // Verify winston.createLogger was called
    expect(mockCreateLogger).toHaveBeenCalledTimes(1);

    const loggerConfig = mockCreateLogger.mock.calls[0][0];
    expect(loggerConfig).toBeDefined();
    expect(loggerConfig.level).toBe('info');
    expect(loggerConfig.defaultMeta).toEqual({ service: 'carpool-backend' });
    expect(loggerConfig.transports).toHaveLength(2);

    // Verify File transports were created
    expect(mockTransports.File).toHaveBeenCalledTimes(2);
    expect(mockTransports.File).toHaveBeenCalledWith({ filename: 'logs/error.log', level: 'error' });
    expect(mockTransports.File).toHaveBeenCalledWith({ filename: 'logs/combined.log' });

    // In production, logger.add should NOT be called (no console transport)
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should add console transport in development', () => {
    process.env.NODE_ENV = 'development';

    // Import logger - this should trigger winston.createLogger and logger.add
    require('../../../src/utils/logger');

    // Verify winston.createLogger was called
    expect(mockCreateLogger).toHaveBeenCalledTimes(1);

    // In non-production, logger.add should be called to add console transport
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockTransports.Console).toHaveBeenCalledTimes(1);
  });

  it('should use correct formatters', () => {
    process.env.NODE_ENV = 'test';

    // Import logger - this should trigger winston format functions
    require('../../../src/utils/logger');

    // Verify format functions were called
    expect(mockFormat.combine).toHaveBeenCalledTimes(1);
    expect(mockFormat.timestamp).toHaveBeenCalledTimes(1);
    expect(mockFormat.errors).toHaveBeenCalledWith({ stack: true });
    expect(mockFormat.json).toHaveBeenCalledTimes(1);
  });

  it('should add console transport when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'test';

    require('../../../src/utils/logger');

    expect(mockCreateLogger).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockTransports.Console).toHaveBeenCalledTimes(1);
  });
});