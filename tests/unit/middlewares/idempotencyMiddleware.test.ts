
import { Request, Response, NextFunction } from 'express';
import { idempotencyMiddleware } from '../../../src/middlewares/idempotencyMiddleware';
import { idempotencyService } from '../../../src/services/idempotencyService';
import logger from '../../../src/utils/logger';

// Mock services and logger
jest.mock('../../../src/services/idempotencyService');
jest.mock('../../../src/utils/logger');

const mockedIdempotencyService = idempotencyService as jest.Mocked<typeof idempotencyService>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('Idempotency Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: { 'x-request-key': 'test-key-123' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should skip for non-modifying methods like GET', async () => {
    req.method = 'GET';
    await idempotencyMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockedIdempotencyService.getRequest).not.toHaveBeenCalled();
  });

  it('should return 409 if request is already processing', async () => {
    mockedIdempotencyService.getRequest.mockResolvedValue({ status: 'processing' } as any);
    await idempotencyMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return saved response if request is already completed', async () => {
    const savedResponse = { data: 'success' };
    mockedIdempotencyService.getRequest.mockResolvedValue({
      status: 'completed',
      responseStatusCode: 201,
      responseBody: savedResponse,
    } as any);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(savedResponse);
    expect(next).not.toHaveBeenCalled();
  });

  it('should process a new request and capture the response', async () => {
    mockedIdempotencyService.getRequest.mockResolvedValue(null);
    
    // This is a bit tricky. We need to simulate the flow.
    // 1. The middleware is called.
    await idempotencyMiddleware(req as Request, res as Response, next);

    // 2. It should call startRequest and next()
    expect(mockedIdempotencyService.startRequest).toHaveBeenCalledWith('test-key-123');
    expect(next).toHaveBeenCalledTimes(1);

    // 3. The original res.json is replaced. Let's simulate a controller calling it.
    const responseBody = { id: 'new-resource' };
    res.statusCode = 201;
    res.json!(responseBody);

    // 4. The overridden json function should call completeRequest and the original json function.
    expect(mockedIdempotencyService.completeRequest).toHaveBeenCalledWith('test-key-123', 201, responseBody);
  });

  it('should log error and call next if the service fails', async () => {
    const error = new Error('DB connection failed');
    mockedIdempotencyService.getRequest.mockRejectedValue(error);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(mockedLogger.error).toHaveBeenCalledWith('Erro no middleware de idempotência:', error);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
