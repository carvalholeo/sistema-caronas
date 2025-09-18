import { Request, Response, NextFunction } from 'express';
import { checkPermission } from '../../../src/middlewares/checkPermissions';
import { IUser } from '../../../src/types';
import { UserModel } from '../../../src/models/user';

describe('checkPermission Middleware', () => {
  interface RequestWithUser extends Request {
    user?: IUser;
  }

  let req: Partial<RequestWithUser>;
  let res: Partial<Response>;
  let next: NextFunction;
  const saveSpy = jest.fn();

  let user: IUser;

  beforeEach(async () => {
    req = { headers: {}, ip: '127.0.0.1', body: {}, query: {}, params: {}, method: 'POST', originalUrl: '/test' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    saveSpy.mockClear();
    jest.clearAllMocks();

    user = await new UserModel({
      name: 'Test User',
      email: 'testuser@example.com',
      matricula: 'TEST123',
      password: 'password123',
      permissions: ['rides:view', 'users:view'],
    }).save();
  });

  const requiredPermission = 'users:edit';
  const middleware = checkPermission(requiredPermission);

  it('should return 401 if user is not authenticated', async () => {
    req.user = undefined;
    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Autenticação necessária.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next if user has the required permission', async () => {
    req.user = user;
    req.user.permissions.push(requiredPermission);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('should return 403 if user does not have permission', async () => {
    req.user = user;
    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });
});
