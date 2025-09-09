
import cors from 'cors';

// Mock the cors library
jest.mock('cors');

const mockedCors = cors as jest.Mock;

describe('CORS Validation Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockedCors.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use default origin when FRONTEND_URL is not set', () => {
    delete process.env.FRONTEND_URL;

    require('../../../../src/middlewares/security/corsValidation');

    expect(mockedCors).toHaveBeenCalledWith({
      origin: 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-two-factor-token'],
    });
  });

  it('should use FRONTEND_URL for origin when it is set', () => {
    const frontendUrl = 'https://my-app.com';
    process.env.FRONTEND_URL = frontendUrl;

    require('../../../../src/middlewares/security/corsValidation');

    expect(mockedCors).toHaveBeenCalledWith({
      origin: frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-two-factor-token'],
    });
  });
});
