import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../src/middlewares/auth';
import { UserModel } from '../../../src/models/user';
import { verifyToken } from '../../../src/utils/security';
import { IUser } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/utils/security');
jest.mock('../../../src/models/user');

const mockedVerifyToken = verifyToken as jest.Mock;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if no authorization header is present', async () => {
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado. Nenhum token fornecido.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with "Bearer "', async () => {
    req.headers = { authorization: 'Token some-token' };
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado. Nenhum token fornecido.' });
  });

  it('should return 401 if token is invalid', async () => {
    req.headers = { authorization: 'Bearer invalid-token' };
    mockedVerifyToken.mockRejectedValue(new Error('Invalid token'));
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token inválido.' });
  });

  it('should return 401 if user not found', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    mockedVerifyToken.mockResolvedValue({ id: 'user123' });
    mockedUserModel.findById = jest.fn().mockResolvedValue(null);

    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuário não encontrado.' });
  });

  it('should call next if token is valid and user exists', async () => {
    const mockUser = { _id: 'user123', email: 'test@example.com' } as IUser;
    req.headers = { authorization: 'Bearer valid-token' };
    mockedVerifyToken.mockResolvedValue({ id: 'user123' });
    mockedUserModel.findById = jest.fn().mockResolvedValue(mockUser);

    await authMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).user).toBe(mockUser);
  });

  it('should handle unexpected errors', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    mockedVerifyToken.mockRejectedValue(new Error('Unexpected error'));

    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token inválido.' });
  });
});