jest.mock('cors');

describe('CORS Middleware validation - 1', () => {
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
    require('../../../../src/middlewares/security/corsValidation').corsValidation();

    expect(mockCors).toHaveBeenCalledTimes(1);
    expect(mockCors).toHaveBeenCalledWith({
      origin: "http://localhost:3000",
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'two-factor-token']
    });
  });

  it('should use FRONTEND_URL for origin when it is set', () => {
    process.env.FRONTEND_URL = 'https://my-app.com';

    require('../../../../src/middlewares/security/corsValidation').corsValidation();

    expect(mockCors).toHaveBeenCalledTimes(1);
    expect(mockCors).toHaveBeenCalledWith({
      origin: 'https://my-app.com',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'two-factor-token']
    });
  });
});
