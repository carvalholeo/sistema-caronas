
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

  it('should return 401 if user is not found', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    mockedVerifyToken.mockResolvedValue({ id: 'user-id', sessionVersion: 1 });
    (mockedUserModel.findById as jest.Mock).mockResolvedValue(null);
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuário não encontrado.' });
  });

  it('should return 401 if session version does not match', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const mockUser = { _id: 'user-id', sessionVersion: 2 };
    mockedVerifyToken.mockResolvedValue({ id: 'user-id', sessionVersion: 1 });
    (mockedUserModel.findById as jest.Mock).mockResolvedValue(mockUser);
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Sua sessão expirou. Por favor, faça login novamente.' });
  });

  it('should call next() and attach user to request on successful authentication', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const mockUser = { _id: 'user-id', sessionVersion: 1 } as IUser;
    mockedVerifyToken.mockResolvedValue({ id: 'user-id', sessionVersion: 1 });
    (mockedUserModel.findById as jest.Mock).mockResolvedValue(mockUser);
    
    await authMiddleware(req as Request, res as Response, next);

    expect(req.user).toBe(mockUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
