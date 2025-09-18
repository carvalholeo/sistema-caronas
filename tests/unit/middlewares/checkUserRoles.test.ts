import { Request, Response, NextFunction } from 'express';
import rbac from '../../../src/middlewares/checkUserRoles';
import { UserRole } from '../../../src/types/enums/enums';
import { IUser } from '../../../src/types';

describe('RBAC (checkUserRoles) Middleware', () => {
  interface RequestWithUser extends Request {
    user?: IUser;
  }

  let req: Partial<RequestWithUser>;
  let res: Partial<Response>;
  let next: NextFunction;


  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('should return 403 if user is not on the request', () => {
    const middleware = rbac([UserRole.Admin]);
    middleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
  });

  it('should call next if user has one of the required roles', () => {
    const middleware = rbac([UserRole.Admin, UserRole.Motorista]);
    req.user = { roles: [UserRole.Caroneiro, UserRole.Admin] } as IUser;
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 if user does not have any of the required roles', () => {
    const middleware = rbac([UserRole.Admin, UserRole.Motorista]);
    req.user = { roles: [UserRole.Caroneiro] } as IUser;
    middleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
  });

  it('should return 403 if user has no roles', () => {
    const middleware = rbac([UserRole.Admin]);
    req.user = { roles: [] } as unknown as IUser;
    middleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
  });
});