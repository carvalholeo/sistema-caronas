
import { Request, Response } from 'express';
import { errorHandler } from '../../../src/middlewares/errorHandler';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/utils/logger');

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('Error Handler Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  const originalEnv = process.env;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should handle operational errors with the specified status and message', () => {
    const err = {
      statusCode: 404,
      isOperational: true,
      message: 'Resource not found',
      stack: 'Error stack trace'
    };

    errorHandler(err, req as Request, res as Response);

    expect(mockedLogger.error).toHaveBeenCalledWith(expect.stringContaining(err.stack));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Resource not found' });
  });

  it('should handle non-operational errors with a 500 status and generic message', () => {
    const err = new Error('A technical error');
    (err as any).stack = 'Some stack trace';

    errorHandler(err, req as Request, res as Response);

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Ocorreu um erro inesperado no servidor.' });
  });

  it('should include stack trace in development environment', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Dev error');
    err.stack = 'dev stack trace';

    errorHandler(err, req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ stack: 'dev stack trace' }));
  });

  it('should not include stack trace in production environment', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Prod error');
    err.stack = 'prod stack trace';

    errorHandler(err, req as Request, res as Response);

    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ stack: expect.any(String) }));
  });
});
