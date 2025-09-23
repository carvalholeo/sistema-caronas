jest.mock('cors');

describe('CORS Middleware validation', () => {
  const originalEnv = process.env;
  let cors: NodeJS.Require;
  let mockCors: jest.Mock;

  beforeAll(() => {
    cors = require('cors');
    mockCors = cors as unknown as jest.Mock;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockCors.mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use default origin when FRONTEND_URL is not set', () => {
    require('../../../../src/middlewares/security/corsValidation');

    expect(mockCors).toHaveBeenCalledTimes(1);
    expect(mockCors).toHaveBeenCalledWith({
      origin: "http://localhost:3000",
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'two-factor-token']
    });
  });
});
