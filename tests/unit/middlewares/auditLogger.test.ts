
import { Request, Response, NextFunction } from 'express';
import auditLogger from '../../../src/middlewares/auditLogger';
import { AuditLogModel } from '../../../src/models/auditLog';
import logger from '../../../src/utils/logger';
import { UserRole, UserStatus } from '../../../src/types/enums/enums';
import { IUser } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/models/auditLog');
jest.mock('../../../src/utils/logger');

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('Audit Logger Middleware', () => {
  interface RequestWithUser extends Request {
    user?: IUser;
  }
  let req: Partial<RequestWithUser>;
  let res: Partial<Response>;
  let next: NextFunction;
  const saveSpy = jest.fn();

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest-test' },
      body: { data: 'test-body' },
      query: { param: 'test-query' },
      params: { id: 'test-id' },
      method: 'POST',
      originalUrl: '/test-url',
      user: undefined,
    } as Partial<Request>;
    res = {} as Partial<Response>;
    next = jest.fn();
    saveSpy.mockClear();
    (AuditLogModel as unknown as jest.Mock).mockImplementation(() => ({
      save: saveSpy,
    }));
    jest.clearAllMocks();
  });

  it('should log a request with an authenticated admin user', async () => {
    req.user = {
      _id: 'admin-user-id',
      name: 'Admin',
      email: 'admin@test.com',
      matricula: 'A00000',
      password: 'hashedPassword',
      roles: [UserRole.Admin],
      permissions: [],
      status: UserStatus.Approved,
      twoFactorSecret: '',
      twoFactorEnabled: false,
      forcePasswordChangeOnNextLogin: false,
      sessionVersion: 1,
      accessibilitySettings: {
        highContrast: false,
        largeFont: false,
        reduceAnimations: false,
        muteSounds: false,
      },
      languagePreference: 'pt-BR',
    } as unknown as IUser;

    await auditLogger(req as Request, res as Response, next);

    expect(AuditLogModel).toHaveBeenCalledTimes(1);
    const auditCall = (AuditLogModel as unknown as jest.Mock).mock.calls[0][0];

    expect(auditCall.actor.userId).toBe('admin-user-id');
    expect(auditCall.actor.isAdmin).toBe(true);
    expect(auditCall.actor.ip).toBe('127.0.0.1');
    expect(auditCall.metadata.extra.body).toEqual({ data: 'test-body' });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log a request with a non-admin user', async () => {
    req.user = {
      _id: 'normal-user-id',
      name: 'Normal User',
      email: 'normal@test.com',
      matricula: 'N00000',
      password: 'hashedPassword',
      roles: [UserRole.Caroneiro],
      permissions: [],
      status: UserStatus.Approved,
      twoFactorSecret: '',
      twoFactorEnabled: false,
      forcePasswordChangeOnNextLogin: false,
      sessionVersion: 1,
      accessibilitySettings: {
        highContrast: false,
        largeFont: false,
        reduceAnimations: false,
        muteSounds: false,
      },
      languagePreference: 'pt-BR',
    } as unknown as IUser;

    await auditLogger(req as Request, res as Response, next);

    const auditCall = (AuditLogModel as unknown as jest.Mock).mock.calls[0][0];
    expect(auditCall.actor.userId).toBe('normal-user-id');
    expect(auditCall.actor.isAdmin).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log a request without a user', async () => {
    req.user = undefined;

    await auditLogger(req as Request, res as Response, next);

    const auditCall = (AuditLogModel as unknown as jest.Mock).mock.calls[0][0];
    expect(auditCall.actor.userId).toBeNull();
    expect(auditCall.actor.isAdmin).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should call next even if saving the audit log fails', async () => {
    const saveError = new Error('Failed to save audit log');
    saveSpy.mockRejectedValue(saveError);

    await auditLogger(req as Request, res as Response, next);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(mockedLogger.error).toHaveBeenCalledWith('Error saving audit log:', saveError);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
