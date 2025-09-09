
import { Request, Response, NextFunction } from 'express';
import { checkPermission } from '../../../src/middlewares/checkPermissions';
import { AuditLogModel } from '../../../src/models/auditLog';
import { AuditActionType } from '../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/auditLog');

describe('checkPermission Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const saveSpy = jest.fn();

  beforeEach(() => {
    req = { headers: {}, ip: '127.0.0.1' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    saveSpy.mockClear();
    (AuditLogModel as jest.Mock).mockImplementation(() => ({
      save: saveSpy,
    }));
    jest.clearAllMocks();
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
    req.user = { permissions: ['users:edit', 'rides:create'] } as any;
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('should return 403 and create an audit log if user does not have permission', async () => {
    req.user = { _id: 'user-id-123', permissions: ['rides:view'], roles: [] } as any;
    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: expect.any(String) });
    expect(next).not.toHaveBeenCalled();

    // Check that an audit log was created
    expect(AuditLogModel).toHaveBeenCalledTimes(1);
    const auditCall = (AuditLogModel as jest.Mock).mock.calls[0][0];
    expect(auditCall.actor.userId).toBe('user-id-123');
    expect(auditCall.action.actionType).toBe(AuditActionType.SECURITY_ACCESS_DENIED);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});
